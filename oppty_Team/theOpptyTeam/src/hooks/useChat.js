import { useState, useCallback, useEffect, useRef } from "react";
import { useWebSocket } from "./useWebSocket";
import { fetchMessages, fetchGroupMessages, uploadMessageFile, markMessagesRead } from "../utils/api";
import { getAuthUser, getAuthUserId } from "../utils/auth";

export function useChat(chatId, isGroup = false) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);

  const authUser = getAuthUser();
  const myId = getAuthUserId();
  const typingTimeoutRef = useRef(null);
  const typingUsersTimeoutRef = useRef({});

  const getCleanId = useCallback(() => {
    if (!chatId) return null;
    const id = String(chatId);
    if (isGroup) return id.replace("group-", "");
    return id.replace("emp-", "");
  }, [chatId, isGroup]);

  const getWebSocketUrl = useCallback(() => {
    const cleanId = getCleanId();
    if (!cleanId || !authUser) return null;
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    if (isGroup) {
      return `${wsProtocol}//${wsHost}/ws/chat/group/${cleanId}/`;
    } else {
      return `${wsProtocol}//${wsHost}/ws/chat/${cleanId}/`;
    }
  }, [getCleanId, isGroup, authUser]);

  // ===== NORMALIZE any message into a consistent shape =====
  const normalizeMessage = useCallback((m, source = "unknown") => {
    // Determine isMine consistently
    let isMine;
    if (m.isMine !== undefined && m.isMine !== null) {
      isMine = m.isMine;
    } else if (m.sender === "me") {
      isMine = true;
    } else if (m.sender === "them") {
      isMine = false;
    } else if (m.sender_id) {
      isMine = Number(m.sender_id) === Number(myId);
    } else {
      isMine = false;
    }

    // Determine type consistently
    const msgType = m.type || m.messageType || m.message_type || "text";

    const normalized = {
      id: m.id,
      text: m.text || m.content || m.message || "",
      isMine,
      sender: isMine ? "me" : "them",
      senderId: m.sender_id || m.senderId,
      senderName: m.sender_name || m.senderName || "",
      senderAvatar: m.sender_avatar || m.senderAvatar || "",
      createdAt: m.createdAt
        ? (typeof m.createdAt === "number" ? m.createdAt : new Date(m.createdAt).getTime())
        : Date.now(),

      // Type fields — always set both
      type: msgType,
      messageType: msgType,

      // File fields
      fileUrl: m.fileUrl || m.file_url || null,
      fileName: m.fileName || m.file_name || null,
      fileSize: m.fileSize || m.file_size || null,

      // Meet fields
      meetLink: m.meetLink || m.meet_link || null,
      meetTitle: m.meetTitle || m.meet_title || null,
      meetScheduledAt: m.meetScheduledAt || m.meet_scheduled_at || null,

      // Interaction fields
      reactions: m.reactions || {},
      userReaction: m.userReaction || null,
      isEdited: m.isEdited || false,
      canEdit: m.canEdit !== undefined ? m.canEdit : isMine,
      canDeleteForEveryone: m.canDeleteForEveryone !== undefined ? m.canDeleteForEveryone : isMine,
      isRead: m.isRead || false,
      isDeleted: m.isDeleted || false,
      deletedForAll: m.deletedForEveryone || m.deletedForAll || false,
      deletedForEveryone: m.deletedForEveryone || m.deletedForAll || false,
      replyTo: m.replyTo || null,
      myInviteStatus: m.myInviteStatus || null,
      isStarred: m.isStarred || false,
      isPinned: m.isPinned || false,
      thread: m.thread || [],
      status: m.isRead ? "read" : (isMine ? "sent" : undefined),

      // ===== POLL FIELDS — the key fix =====
      pollQuestion: m.pollQuestion || null,
      pollOptions: m.pollOptions || null,
      pollId: m.pollId || null,
      myVotes: m.myVotes || [],
      allowMultiple: m.allowMultiple || false,
      totalVotes: m.totalVotes || 0,
    };

    return normalized;
  }, [myId]);

  const handleWebSocketMessage = useCallback((payload) => {
    const { type, data } = payload;

    switch (type) {
      case "message":
      case "file":
        setMessages(prev => {
          if (prev.find(m => m.id === data.id)) return prev;

          const newMsg = normalizeMessage(data, "websocket");

          if (newMsg.isMine) {
            const withoutTemp = prev.filter(m => {
              if (String(m.id).startsWith("temp-") && m.text === newMsg.text) return false;
              return true;
            });
            return [...withoutTemp, newMsg];
          }

          return [...prev, newMsg];
        });
        break;

      case "reaction":
        setMessages(prev => prev.map(m => {
          if (m.id === data.message_id) {
            return {
              ...m,
              reactions: data.reactions,
              userReaction: Number(data.employee_id) === Number(myId) ? data.reaction : m.userReaction
            };
          }
          return m;
        }));
        break;

      case "edited":
        setMessages(prev => prev.map(m => {
          if (m.id === data.message_id) {
            return { ...m, text: data.content, isEdited: true, editedAt: data.editedAt };
          }
          return m;
        }));
        break;

      case "deleted":
        if (data.deletedForEveryone) {
          setMessages(prev => prev.map(m => {
            if (m.id === data.message_id) {
              return {
                ...m, text: "🚫 This message was deleted",
                isDeleted: true, deletedForAll: true, deletedForEveryone: true,
                type: "text", messageType: "text",
                fileUrl: null, fileName: null, meetLink: null,
                pollOptions: null, pollQuestion: null, pollId: null,
              };
            }
            return m;
          }));
        } else if (data.deletedForMe && Number(data.employee_id) === Number(myId)) {
          setMessages(prev => prev.filter(m => m.id !== data.message_id));
        }
        break;

      case "typing":
        const { sender_id, sender_name, is_typing } = data;
        if (Number(sender_id) !== Number(myId)) {
          setTypingUsers(prev => {
            if (is_typing) {
              if (!prev.find(u => u.id === sender_id)) {
                return [...prev, { id: sender_id, name: sender_name }];
              }
            } else {
              return prev.filter(u => u.id !== sender_id);
            }
            return prev;
          });

          if (is_typing) {
            if (typingUsersTimeoutRef.current[sender_id]) {
              clearTimeout(typingUsersTimeoutRef.current[sender_id]);
            }
            typingUsersTimeoutRef.current[sender_id] = setTimeout(() => {
              setTypingUsers(prev => prev.filter(u => u.id !== sender_id));
            }, 3000);
          }
        }
        break;

      case "read":
        if (Number(data.reader_id) !== Number(myId)) {
          setMessages(prev => prev.map(m => {
            if (m.isMine && !m.isRead) {
              return { ...m, isRead: true, status: "read" };
            }
            return m;
          }));
        }
        break;

      case "poll_update":
        // Dispatch custom event for ChatPage to handle
        window.dispatchEvent(new CustomEvent("poll_update", { detail: data }));
        // Also update local messages directly
        setMessages(prev => prev.map(m => {
          if (m.id === data.message_id) {
            return {
              ...m,
              pollOptions: data.pollOptions || m.pollOptions,
              myVotes: data.myVotes || m.myVotes,
              totalVotes: data.totalVotes !== undefined ? data.totalVotes : m.totalVotes,
            };
          }
          return m;
        }));
        break;

      default:
        break;
    }
  }, [myId, normalizeMessage]);

  const {
    connectionStatus,
    sendMessage: wsSendMessage,
    sendTyping: wsSendTyping,
    isConnected
  } = useWebSocket(getWebSocketUrl(), {
    onMessage: handleWebSocketMessage,
    onOpen: () => { setError(null); },
    onClose: () => {},
    onError: () => { setError("Connection failed. Retrying..."); },
  });

  useEffect(() => {
    const loadMessages = async () => {
      const cleanId = getCleanId();
      if (!cleanId) return;

      setLoading(true);
      setError(null);

      try {
        let data;
        if (isGroup) {
          data = await fetchGroupMessages(cleanId);
        } else {
          data = await fetchMessages(cleanId);
        }

        // Use the same normalizeMessage for REST API data
        const formatted = (data || []).map(m => normalizeMessage(m, "rest"));

        setMessages(formatted);
      } catch (err) {
        console.error("Failed to load messages:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    setMessages([]);
    loadMessages();

    return () => {
      Object.values(typingUsersTimeoutRef.current).forEach(clearTimeout);
    };
  }, [chatId, isGroup, myId, getCleanId, normalizeMessage]);

  const sendTextMessage = useCallback((text, replyTo = null) => {
    if (!text.trim() || !isConnected) return false;
    return wsSendMessage({
      type: "message",
      message: text.trim(),
      reply_to: replyTo?.id || replyTo || null,
    });
  }, [wsSendMessage, isConnected]);

  const sendFile = useCallback(async (file, content = "") => {
    const cleanId = getCleanId();
    if (!cleanId) return null;

    try {
      const targetId = isGroup ? null : cleanId;
      const groupId = isGroup ? cleanId : null;

      const result = await uploadMessageFile(file, targetId, groupId, content);

      const newMessage = normalizeMessage({
        ...result,
        isMine: true,
        senderName: authUser?.name,
        senderAvatar: authUser?.avatarUrl,
        sender_id: myId,
      }, "upload");

      setMessages(prev => {
        if (prev.find(m => m.id === result.id)) return prev;
        return [...prev, newMessage];
      });

      return result;
    } catch (err) {
      console.error("File upload error:", err);
      throw err;
    }
  }, [getCleanId, isGroup, authUser, myId, normalizeMessage]);

  const sendTypingIndicator = useCallback((isTyping = true) => {
    wsSendTyping(isTyping);
    if (isTyping) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => { wsSendTyping(false); }, 2000);
    }
  }, [wsSendTyping]);

  const sendReaction = useCallback((messageId, reaction) => {
    return wsSendMessage({ type: "reaction", message_id: messageId, reaction });
  }, [wsSendMessage]);

  const editMessageWs = useCallback((messageId, newContent) => {
    return wsSendMessage({ type: "edit", message_id: messageId, content: newContent });
  }, [wsSendMessage]);

  const deleteMessageWs = useCallback((messageId, deleteType = "for_me") => {
    return wsSendMessage({ type: "delete", message_id: messageId, delete_type: deleteType });
  }, [wsSendMessage]);

  const markAsRead = useCallback(() => {
    wsSendMessage({ type: "read" });
    const cleanId = getCleanId();
    if (cleanId && !isGroup) {
      markMessagesRead(cleanId).catch(() => {});
    }
  }, [wsSendMessage, getCleanId, isGroup]);

  const updateMessageLocal = useCallback((messageId, updates) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, ...updates } : m));
  }, []);

  const deleteMessageLocal = useCallback((messageId) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      Object.values(typingUsersTimeoutRef.current).forEach(clearTimeout);
    };
  }, []);

  return {
    messages, loading, error, connectionStatus, isConnected, typingUsers,
    sendTextMessage, sendFile, sendTypingIndicator, sendReaction,
    editMessage: editMessageWs, deleteMessage: deleteMessageWs,
    markAsRead, updateMessageLocal, deleteMessageLocal, setMessages,
  };
}