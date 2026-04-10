// src/components/chat/GroupChatPage.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useChats } from "../../context/ChatContext.jsx";
import { getAuthUser } from "../../utils/auth.js";
import { apiFetch, uploadMessageFile, fetchGroupDetails } from "../../utils/api.js";
import MessageBubble from "./MessageBubble.jsx";
import FileUploadButton from "./FileUploadButton.jsx";
import MeetButton from "./MeetButton.jsx";

export default function GroupChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { getChatById, receiveMessage, setMessages, updateMessage, deleteMessage } = useChats();
  const authUser = getAuthUser();

  const [text, setText] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [error, setError] = useState(null);
  const [groupInfo, setGroupInfo] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  
  const socketRef = useRef(null);
  const endRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const isConnectingRef = useRef(false);
  const typingTimeoutRef = useRef(null);

  // Extract group ID
  const groupId = useMemo(() => {
    if (!chatId) return null;
    return String(chatId).replace("group-", "");
  }, [chatId]);

  const myId = useMemo(() => {
    return authUser?.id ? String(authUser.id) : null;
  }, [authUser]);

  const chat = useMemo(() => getChatById(chatId), [chatId, getChatById]);

  // Fetch group info
  const loadGroupInfo = useCallback(async () => {
    if (!groupId) return;
    
    try {
      const data = await fetchGroupDetails(groupId);
      setGroupInfo(data);
    } catch (err) {
      console.error("Fetch group info error:", err);
    }
  }, [groupId]);

  // Fetch group messages
  const fetchMessages = useCallback(async () => {
    if (!groupId) return;

    try {
      const response = await apiFetch(`/api/groups/${groupId}/messages/`, {
        method: "GET",
      });

      if (!response.ok) {
        console.error("Failed to fetch group messages:", response.status);
        return;
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        const formatted = data.map((m) => ({
          id: m.id,
          text: m.text || "",
          isMine: m.sender === "me" || m.sender_id === Number(myId),
          senderId: m.sender_id,
          senderName: m.sender_name,
          senderAvatar: m.sender_avatar,
          createdAt: new Date(m.createdAt).getTime(),
          messageType: m.messageType || "text",
          fileUrl: m.fileUrl || null,
          fileName: m.fileName || null,
          fileSize: m.fileSize || null,
          reactions: m.reactions || {},
          userReaction: m.userReaction || null,
          isEdited: m.isEdited || false,
          editedAt: m.editedAt,
          canEdit: m.canEdit || false,
          canDeleteForEveryone: m.canDeleteForEveryone || false,
          isDeleted: m.isDeleted || false,
          deletedForEveryone: m.deletedForEveryone || false,
          meetLink: m.meetLink,
          meetTitle: m.meetTitle,
          meetScheduledAt: m.meetScheduledAt,
          myInviteStatus: m.myInviteStatus,
        }));
        setMessages(chatId, formatted);
      }
    } catch (err) {
      console.error("Fetch group messages error:", err);
    }
  }, [chatId, groupId, myId, setMessages]);

  // Connect WebSocket for group
  const connectWebSocket = useCallback(() => {
    if (isConnectingRef.current || !groupId || !myId) return;

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    isConnectingRef.current = true;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/ws/chat/group/${groupId}/`;
    
    console.log("🔌 Connecting Group WebSocket:", wsUrl);
    setConnectionStatus("connecting");
    setError(null);

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("✅ Group WebSocket Connected");
        setConnectionStatus("connected");
        setError(null);
        isConnectingRef.current = false;
      };

      ws.onclose = (event) => {
        console.log("🔌 Group WebSocket Closed:", event.code);
        setConnectionStatus("disconnected");
        isConnectingRef.current = false;
        
        if (event.code !== 1000 && socketRef.current === ws) {
          reconnectTimerRef.current = setTimeout(() => {
            connectWebSocket();
          }, 3000);
        }
      };

      ws.onerror = () => {
        console.error("❌ Group WebSocket Error");
        setConnectionStatus("disconnected");
        setError("Connection failed");
        isConnectingRef.current = false;
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === "message" || payload.type === "file") {
            const data = payload.data || payload;
            receiveMessage(chatId, {
              id: data.id || `msg-${Date.now()}`,
              text: data.text || data.message || "",
              isMine: Number(data.sender_id) === Number(myId),
              senderId: data.sender_id,
              senderName: data.sender_name,
              senderAvatar: data.sender_avatar,
              createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
              messageType: data.messageType || "text",
              fileUrl: data.fileUrl || null,
              fileName: data.fileName || null,
              fileSize: data.fileSize || null,
              reactions: data.reactions || {},
              userReaction: data.userReaction || null,
              canEdit: Number(data.sender_id) === Number(myId),
              canDeleteForEveryone: Number(data.sender_id) === Number(myId),
              meetLink: data.meetLink,
              meetTitle: data.meetTitle,
              meetScheduledAt: data.meetScheduledAt,
            });
          } else if (payload.type === "typing") {
            const { sender_id, sender_name, is_typing } = payload.data || {};
            if (sender_id !== Number(myId)) {
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
            }
          }
        } catch (err) {
          console.error("Error parsing group message:", err);
        }
      };
    } catch (err) {
      console.error("❌ Group WebSocket creation error:", err);
      setConnectionStatus("disconnected");
      setError("Failed to connect");
      isConnectingRef.current = false;
    }
  }, [chatId, groupId, myId, receiveMessage]);

  // Effect: Setup group chat
  useEffect(() => {
    if (!groupId || !myId) return;

    loadGroupInfo();
    fetchMessages();
    
    const connectTimer = setTimeout(() => {
      connectWebSocket();
    }, 300);

    return () => {
      clearTimeout(connectTimer);
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounting");
        socketRef.current = null;
      }
      
      isConnectingRef.current = false;
    };
  }, [chatId, groupId, myId, loadGroupInfo, fetchMessages, connectWebSocket]);

  // Effect: Scroll to bottom
  useEffect(() => {
    const timer = setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [chat?.messages?.length]);

  // Send message
  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    socketRef.current.send(JSON.stringify({ 
      type: "message",
      message: trimmed 
    }));
    setText("");
  }, [text]);

  // Send typing indicator
  const handleTyping = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ 
        type: "typing",
        is_typing: true
      }));
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ 
            type: "typing",
            is_typing: false
          }));
        }
      }, 2000);
    }
  }, []);

  // File upload
  const handleFileUpload = useCallback(async (file) => {
    if (!groupId) return;

    try {
      const result = await uploadMessageFile(file, null, groupId, "");
      
      receiveMessage(chatId, {
        id: result.id,
        text: result.text || "",
        isMine: true,
        senderName: authUser?.name,
        createdAt: new Date(result.createdAt).getTime(),
        messageType: result.messageType,
        fileUrl: result.fileUrl,
        fileName: result.fileName,
        fileSize: result.fileSize,
        reactions: {},
        userReaction: null,
        canEdit: false,
        canDeleteForEveryone: true,
      });
      
    } catch (err) {
      console.error("File upload error:", err);
      throw err;
    }
  }, [chatId, groupId, authUser, receiveMessage]);

  // Handle message update
  const handleMessageUpdate = useCallback((messageId, updates) => {
    updateMessage(chatId, messageId, updates);
  }, [chatId, updateMessage]);

  // Handle message delete
  const handleMessageDelete = useCallback((messageId, deleteType) => {
    deleteMessage(chatId, messageId, deleteType);
  }, [chatId, deleteMessage]);

  // Back button for mobile
  const handleBack = () => {
    navigate("/groups");
  };

  if (!authUser) {
    return (
      <div className="chatEmpty">
        <div className="emptyTitle">Please login</div>
      </div>
    );
  }

  if (!chat && !groupInfo) {
    return (
      <div className="chatEmpty">
        <div className="emptyIcon">👥</div>
        <div className="emptyTitle">Select a group</div>
        <div className="muted">Choose a group to start messaging</div>
      </div>
    );
  }

  const displayInfo = groupInfo || chat;
  const members = groupInfo?.members || [];

  // Typing indicator text
  const getTypingText = () => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].name} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`;
    return `${typingUsers.length} people are typing...`;
  };

  return (
    <div className="chat">
      <header className="chatHeader">
        <button className="back-btn-mobile" onClick={handleBack}>←</button>
        <img 
          className="avatar" 
          src={displayInfo?.avatarUrl} 
          alt={displayInfo?.name}
          onError={(e) => {
            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayInfo?.name || 'G')}&background=4CAF50&color=fff`;
          }}
        />
        <div className="chatHeaderText">
          <div className="chatHeaderName">
            👥 {displayInfo?.name}
          </div>
          <div className="chatHeaderMeta">
            {getTypingText() || (
              <>
                {groupInfo?.memberCount || displayInfo?.memberCount || 0} members
                {connectionStatus === "connected" ? "" : 
                 connectionStatus === "connecting" ? " • Connecting..." : " • Offline"}
              </>
            )}
          </div>
        </div>
        <div className="chatHeaderStatus">
          <span className={`status-dot ${connectionStatus}`}></span>
        </div>
      </header>

      {error && (
        <div className="errorBanner">
          ⚠️ {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <section className="messages">
        {(!chat?.messages || chat.messages.length === 0) && (
          <div className="emptyMessages">
            <span>👥</span>
            <p>No messages in this group yet. Start the conversation!</p>
          </div>
        )}

        {chat?.messages?.map((m) => (
          <MessageBubble 
            key={m.id} 
            message={m}
            showSenderInfo={!m.isMine}
            onMessageUpdate={handleMessageUpdate}
            onMessageDelete={handleMessageDelete}
          />
        ))}

        <div ref={endRef} />
      </section>

      <footer className="composer">
        <FileUploadButton
          onFileSelect={handleFileUpload}
          disabled={connectionStatus !== "connected"}
        />
        <MeetButton
          targetId={null}
          groupId={groupId}
          members={members}
          disabled={connectionStatus !== "connected"}
        />
        <textarea
          className="composerInput"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={connectionStatus === "connected" ? "Type a message..." : "Connecting..."}
          disabled={connectionStatus !== "connected"}
          rows={1}
        />
        <button
          className="sendBtn"
          onClick={handleSend}
          disabled={!text.trim() || connectionStatus !== "connected"}
        >
          Send
        </button>
      </footer>
    </div>
  );
}