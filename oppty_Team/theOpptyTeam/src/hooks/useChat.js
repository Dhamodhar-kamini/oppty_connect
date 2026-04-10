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

  const handleWebSocketMessage = useCallback((payload) => {
    const { type, data } = payload;

    switch (type) {
      case "message":
      case "file":
        setMessages(prev => {
          if (prev.find(m => m.id === data.id)) return prev;

          const isMineMessage = Number(data.sender_id) === Number(myId);

          const newMsg = {
            id: data.id,
            text: data.text || data.message || "",
            isMine: isMineMessage,
            senderId: data.sender_id,
            senderName: data.sender_name,
            senderAvatar: data.sender_avatar,
            createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
            
            // ✅ FIX: Ensure all media and meeting properties are captured perfectly
            type: data.messageType || data.message_type || "text",
            messageType: data.messageType || data.message_type || "text",
            fileUrl: data.fileUrl || data.file_url || null,
            fileName: data.fileName || data.file_name || null,
            fileSize: data.fileSize || data.file_size || null,
            
            meetLink: data.meetLink || data.meet_link || null,
            meetTitle: data.meetTitle || data.meet_title || null,
            meetScheduledAt: data.meetScheduledAt || data.meet_scheduled_at || null,
            
            reactions: data.reactions || {},
            userReaction: data.userReaction,
            isEdited: data.isEdited || false,
            canEdit: isMineMessage,
            canDeleteForEveryone: isMineMessage,
            isRead: data.isRead || false,
            replyTo: data.replyTo,
            isStarred: false,
            isPinned: false,
            thread: [],
            status: isMineMessage ? "sent" : undefined,
          };

          if (isMineMessage) {
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
                fileUrl: null, fileName: null, meetLink: null
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

      default:
        break;
    }
  }, [myId]);

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

        const formatted = (data || []).map(m => ({
          id: m.id,
          text: m.text || "",
          isMine: m.sender === "me" || m.isMine || Number(m.sender_id) === Number(myId),
          senderId: m.sender_id,
          senderName: m.sender_name,
          senderAvatar: m.sender_avatar,
          createdAt: new Date(m.createdAt).getTime(),
          
          // ✅ FIX: Extracting standard properties correctly on initial load
          type: m.messageType || m.message_type || "text",
          messageType: m.messageType || m.message_type || "text",
          fileUrl: m.fileUrl || m.file_url,
          fileName: m.fileName || m.file_name,
          fileSize: m.fileSize || m.file_size,
          meetLink: m.meetLink || m.meet_link,
          meetTitle: m.meetTitle || m.meet_title,
          meetScheduledAt: m.meetScheduledAt || m.meet_scheduled_at,
          
          reactions: m.reactions || {},
          userReaction: m.userReaction,
          isEdited: m.isEdited || false,
          canEdit: m.canEdit || false,
          canDeleteForEveryone: m.canDeleteForEveryone || false,
          isRead: m.isRead || false,
          isDeleted: m.isDeleted || false,
          deletedForAll: m.deletedForEveryone || false,
          deletedForEveryone: m.deletedForEveryone || false,
          replyTo: m.replyTo,
          myInviteStatus: m.myInviteStatus,
          isStarred: m.isStarred || false,
          isPinned: m.isPinned || false,
          thread: m.thread || [],
          status: m.isRead ? "read" : "sent",
        }));

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
  }, [chatId, isGroup, myId, getCleanId]);

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

      const newMessage = {
        id: result.id,
        text: result.text || "",
        isMine: true,
        senderName: authUser?.name,
        senderAvatar: authUser?.avatarUrl,
        createdAt: new Date(result.createdAt).getTime(),
        type: result.messageType || result.message_type,
        messageType: result.messageType || result.message_type,
        fileUrl: result.fileUrl || result.file_url,
        fileName: result.fileName || result.file_name,
        fileSize: result.fileSize || result.file_size,
        reactions: {},
        userReaction: null,
        canEdit: false,
        canDeleteForEveryone: true,
        isRead: false,
        isStarred: false,
        isPinned: false,
        thread: [],
      };

      setMessages(prev => {
        if (prev.find(m => m.id === result.id)) return prev;
        return [...prev, newMessage];
      });

      return result;
    } catch (err) {
      console.error("File upload error:", err);
      throw err;
    }
  }, [getCleanId, isGroup, authUser]);

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