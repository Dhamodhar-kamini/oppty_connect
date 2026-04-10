// src/components/chat/RealTimeChatPage.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useChat } from "../../hooks/useChat";
import { useChats } from "../../context/ChatContext.jsx"; // ✅ IMPORT ADDED
import { getAuthUser } from "../../utils/auth";
import { fetchUsers, fetchGroupDetails } from "../../utils/api";
import MessageBubble from "./MessageBubble";
import FileUploadButton from "./FileUploadButton";
import MeetButton from "./MeetButton";
import "./FileUpload.css";

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDay(ts) {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export default function RealTimeChatPage({ isGroup = false }) {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const authUser = getAuthUser();
  
  const [chatInfo, setChatInfo] = useState(null);
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const lastTypingRef = useRef(0);

  // Extract target ID
  const targetId = chatId ? String(chatId).replace("emp-", "").replace("group-", "") : null;

  // ✅ Extract receiveMessage from context to inject the meet message locally
  const { receiveMessage } = useChats();

  // Use chat hook for real-time messaging
  const {
    messages,
    loading,
    error,
    connectionStatus,
    isConnected,
    typingUsers,
    sendTextMessage,
    sendFile,
    sendTypingIndicator,
    sendReaction,
    editMessage,
    deleteMessage,
    markAsRead,
    updateMessageLocal,
    deleteMessageLocal,
  } = useChat(chatId, isGroup);

  // Fetch chat/user info
  useEffect(() => {
    const loadInfo = async () => {
      if (!targetId) return;
      
      try {
        if (isGroup) {
          const groupData = await fetchGroupDetails(targetId);
          setChatInfo({
            id: groupData.id,
            name: groupData.name,
            avatarUrl: groupData.avatarUrl,
            memberCount: groupData.memberCount,
            members: groupData.members || [],
            isGroup: true,
          });
        } else {
          const users = await fetchUsers();
          const user = users.find(u => String(u.id) === targetId);
          if (user) {
            setChatInfo({
              id: user.id,
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl,
              status: user.status,
              isGroup: false,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load chat info:", err);
      }
    };
    
    loadInfo();
  }, [targetId, isGroup]);

  // Scroll to bottom on new messages
  useEffect(() => {
    const timer = setTimeout(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages.length]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (isConnected && messages.length > 0) {
      markAsRead();
    }
  }, [isConnected, messages.length, markAsRead]);

  // Handle send message
  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    
    const success = sendTextMessage(trimmed, replyingTo);
    if (success) {
      setText("");
      setReplyingTo(null);
      inputRef.current?.focus();
    }
  }, [text, replyingTo, sendTextMessage]);

  // Handle typing
  const handleTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingRef.current > 1000) {
      sendTypingIndicator(true);
      lastTypingRef.current = now;
    }
  }, [sendTypingIndicator]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file) => {
    try {
      await sendFile(file);
    } catch (err) {
      alert("Failed to upload file: " + err.message);
    }
  }, [sendFile]);

  // Handle reaction
  const handleReaction = useCallback((messageId, emoji) => {
    const reactionMap = {
      '👍': 'ok',
      '👎': 'not_ok',
      '❤️': 'love',
      '😂': 'laugh',
      '😮': 'wow',
      '😢': 'sad',
    };
    const reaction = reactionMap[emoji] || 'ok';
    sendReaction(messageId, reaction);
  }, [sendReaction]);

  // Handle delete
  const handleDelete = useCallback((messageId, forEveryone = false) => {
    deleteMessage(messageId, forEveryone ? "for_everyone" : "for_me");
  }, [deleteMessage]);

  // ✅ NEW: Handle incoming created meet to update UI immediately
  const handleMeetCreated = useCallback((newMeetMessage) => {
    if (receiveMessage) {
      receiveMessage(chatId, newMeetMessage);
    }
  }, [chatId, receiveMessage]);

  // Group messages by day
  const groupedMessages = React.useMemo(() => {
    const groups = new Map();
    messages.forEach(m => {
      const day = formatDay(m.createdAt);
      if (!groups.has(day)) {
        groups.set(day, []);
      }
      groups.get(day).push(m);
    });
    return Array.from(groups.entries());
  }, [messages]);

  // Get typing text
  const getTypingText = () => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].name} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`;
    return `${typingUsers.length} people are typing...`;
  };

  // Back button handler
  const handleBack = () => {
    navigate(isGroup ? "/groups" : "/chats");
  };

  if (!authUser) {
    return (
      <div className="chatEmpty">
        <div className="emptyTitle">Please login</div>
      </div>
    );
  }

  if (!chatId) {
    return (
      <div className="chatEmpty">
        <div className="chatEmptyIllustration">
          <svg viewBox="0 0 200 200" fill="none" width="160" height="160">
            <rect x="20" y="40" width="160" height="120" rx="16" fill="#e7fce3" />
            <path d="M60 80h80M60 110h50" stroke="#00a884" strokeWidth="8" strokeLinecap="round" />
          </svg>
        </div>
        <div className="chatEmptyTitle">Select a chat</div>
        <div className="muted">Choose a conversation to start messaging</div>
      </div>
    );
  }

  return (
    <div className="chat">
      {/* Header */}
      <header className="chatHeader">
        <button className="back-btn-mobile" onClick={handleBack}>←</button>
        <img 
          className="avatar" 
          src={chatInfo?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(chatInfo?.name || 'U')}&background=random`}
          alt={chatInfo?.name}
          onError={(e) => {
            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(chatInfo?.name || 'U')}&background=random`;
          }}
        />
        <div className="chatHeaderText">
          <div className="chatHeaderName">
            {isGroup ? "👥 " : ""}{chatInfo?.name || "Loading..."}
          </div>
          <div className="chatHeaderMeta">
            {getTypingText() || (
              isGroup 
                ? `${chatInfo?.memberCount || 0} members` 
                : (chatInfo?.status === 'dnd' ? '🔴 Do Not Disturb' : chatInfo?.status === 'meeting' ? '🗓️ In a Meeting' : '🟢 Available')
            )}
            {!isConnected && <span style={{ marginLeft: 8, color: '#f59e0b' }}>• Connecting...</span>}
          </div>
        </div>
        <div className="chatHeaderStatus">
          <span className={`status-dot ${connectionStatus}`} title={connectionStatus}></span>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="errorBanner" style={{ background: '#fef2f2', color: '#dc2626', padding: '8px 16px', fontSize: '13px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Messages */}
      <section className="messages">
        {loading ? (
          <>
            <div className="skeleton skeletonBubble skeletonTheirs" />
            <div className="skeleton skeletonBubble skeletonMine" />
            <div className="skeleton skeletonBubble skeletonTheirs" />
          </>
        ) : messages.length === 0 ? (
          <div className="emptyMessages" style={{ textAlign: 'center', padding: '40px', color: '#667781' }}>
            <span style={{ fontSize: '48px' }}>💬</span>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          groupedMessages.map(([day, dayMessages]) => (
            <div key={day}>
              <div className="dayChip">{day}</div>
              {dayMessages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  onReaction={(emoji) => handleReaction(m.id, emoji)}
                  onReply={() => setReplyingTo(m)}
                  onDeleteForMe={() => handleDelete(m.id, false)}
                  onDeleteForAll={() => handleDelete(m.id, true)}
                  canDeleteForAll={m.isMine && m.canDeleteForEveryone}
                  onPreviewImage={(url) => window.open(url, '_blank')}
                />
              ))}
            </div>
          ))
        )}
        <div ref={endRef} />
      </section>

      {/* Composer */}
      <footer className="composer">
        {replyingTo && (
          <div className="waComposerReplyBar animatedFadeIn">
            <div className="waComposerReplyAccent" />
            <div className="waComposerReplyContent">
              <div className="waComposerReplyTitle">{replyingTo.senderName || "Reply"}</div>
              <div className="waComposerReplyText">
                {replyingTo.messageType === "image" ? "🖼 Photo" : 
                 replyingTo.messageType === "file" ? "📄 Document" : 
                 replyingTo.text?.substring(0, 50) || "Message"}
              </div>
            </div>
            <button type="button" className="waComposerReplyClose" onClick={() => setReplyingTo(null)}>✕</button>
          </div>
        )}

        <FileUploadButton
          onFileSelect={handleFileUpload}
          disabled={!isConnected}
        />
        
        {/* ✅ FIX: Passed onMeetCreated down to MeetButton */}
        {isGroup && chatInfo?.members && (
          <MeetButton
            groupId={targetId}
            members={chatInfo.members}
            disabled={!isConnected}
            onMeetCreated={handleMeetCreated} 
          />
        )}
        {!isGroup && (
          <MeetButton
            targetId={targetId}
            disabled={!isConnected}
            onMeetCreated={handleMeetCreated}
          />
        )}

        <textarea
          ref={inputRef}
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
          placeholder={isConnected ? "Type a message..." : "Connecting..."}
          disabled={!isConnected}
          rows={1}
        />
        
        <button
          className="sendBtn"
          onClick={handleSend}
          disabled={!text.trim() || !isConnected}
        >
          <svg className="sendIcon" viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </footer>
    </div>
  );
}