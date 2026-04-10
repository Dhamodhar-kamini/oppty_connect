// src/components/chatList/ChatListPage.jsx
import React, { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useChats } from "../../context/ChatContext.jsx";
import opptyLogo from "../../assets/opptylogo.png";

function formatTime(ts) {
  if (!ts) return "";
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function SectionTitle({ mode }) {
  if (mode === "group") {
    return (
      <span className="sectionTitle">
        <span className="titleOrange">Gro</span>
        <span className="titleBlack">ups</span>
      </span>
    );
  }
  return (
    <span className="sectionTitle">
      <span className="titleOrange">Cha</span>
      <span className="titleBlack">ts</span>
    </span>
  );
}

export default function ChatListPage({ mode = "dm" }) {
  const { chats, isLoading } = useChats();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const targetKind = mode === "group" ? "group" : "dm";

    return chats
      .filter((c) => c.kind === targetKind)
      .filter((c) => (query ? c.name.toLowerCase().includes(query) : true))
      .sort((a, b) => {
        // ✅ FIX: Check if there's a newer message stored locally in messages array
        const aLastMsg = a.messages?.length > 0 ? a.messages[a.messages.length - 1] : a.lastMessage;
        const bLastMsg = b.messages?.length > 0 ? b.messages[b.messages.length - 1] : b.lastMessage;

        const aTime = aLastMsg?.createdAt ? new Date(aLastMsg.createdAt).getTime() : 0;
        const bTime = bLastMsg?.createdAt ? new Date(bLastMsg.createdAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [chats, mode, q]);

  const placeholder = mode === "group" ? "Search groups" : "Search or start new chat";
  const emptyText = mode === "group" ? "groups" : "chats";

  return (
    <div className="sidebarInner">
      <div className="sidebarTop">
        <div className="brandRow">
          <img className="opptyLogo" src={opptyLogo} alt="Oppty" />
          <SectionTitle mode={mode} />
        </div>

        <input
          className="searchInput"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
        />
      </div>

      <div className="chatList" role="list">
        {isLoading ? (
          <>
            <div className="chatRowSkeleton" style={{ height: 72, background: '#f5f6f6', margin: '4px 12px', borderRadius: 8 }} />
            <div className="chatRowSkeleton" style={{ height: 72, background: '#f5f6f6', margin: '4px 12px', borderRadius: 8 }} />
            <div className="chatRowSkeleton" style={{ height: 72, background: '#f5f6f6', margin: '4px 12px', borderRadius: 8 }} />
          </>
        ) : (
          filtered.map((chat) => {
            // ✅ FIX: Find true last message directly from combined arrays ensuring injected meetings display
            const lastMsg = chat.messages?.length > 0 ? chat.messages[chat.messages.length - 1] : chat.lastMessage;
            const chatPath = chat.kind === "group" ? `/groups/${chat.id}` : `/chats/${chat.id}`;

            return (
              <NavLink
                key={chat.id}
                to={chatPath}
                className={({ isActive }) => `chatRow ${isActive ? "active" : ""}`}
                role="listitem"
              >
                <div className="avatarWrapper" style={{ position: 'relative' }}>
                  <img
                    className="avatar"
                    src={chat.avatarUrl}
                    alt={chat.name}
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name)}&background=random`;
                    }}
                  />
                  {chat.kind === "dm" && (
                    <span
                      className={`statusDotSmall ${chat.status || chat.otherUserStatus || 'available'}`}
                      style={{
                        position: 'absolute', bottom: 0, right: 0,
                        width: 10, height: 10, borderRadius: '50%',
                        border: '2px solid white',
                        background: (chat.status || chat.otherUserStatus) === 'dnd' ? '#ef4444' :
                          (chat.status || chat.otherUserStatus) === 'meeting' ? '#f59e0b' : '#22c55e'
                      }}
                    />
                  )}
                </div>

                <div className="chatRowBody">
                  <div className="chatRowTop">
                    <div className="chatName">
                      {chat.kind === "group" && "👥 "}
                      {chat.name}
                    </div>
                    <div className="chatRowMetaRight">
                      <div className="chatTime">
                        {lastMsg?.createdAt ? formatTime(lastMsg.createdAt) : ""}
                      </div>
                      {chat.unreadCount > 0 && (
                        <span className="chatUnreadBadge">{chat.unreadCount}</span>
                      )}
                    </div>
                  </div>

                  <div className="chatPreview">
                    {chat.blocked ? (
                      <span className="muted">Blocked</span>
                    ) : lastMsg ? (
                      <span>
                        {lastMsg.sender === "me" && "You: "}
                        {/* Ensure meeting type messages are accurately labeled */}
                        {lastMsg.type === "meet" || lastMsg.messageType === "meet" 
                          ? "📅 Meeting Link" 
                          : lastMsg.text || `[${lastMsg.messageType || 'message'}]`}
                      </span>
                    ) : (
                      <span className="muted">No messages yet</span>
                    )}
                  </div>
                </div>
              </NavLink>
            );
          })
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="emptyList">
            <div className="muted">No {emptyText} found.</div>
          </div>
        )}
      </div>
    </div>
  );
}