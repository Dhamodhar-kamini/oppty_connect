import React, { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useChats } from "../../context/ChatContext.jsx";
import opptyLogo from "../../assets/opptylogo.png";


function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const { chats } = useChats();
  const [q, setQ] = useState("");
  

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return chats
      .filter((c) => (c.kind ?? "dm") === mode)
      .filter((c) => (query ? c.name.toLowerCase().includes(query) : true));
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
        {filtered.map((chat) => {
          const last = chat.messages?.[chat.messages.length - 1];
          const chatPath = chat.kind === "group" ? `/groups/${chat.id}` : `/chats/${chat.id}`;

          return (
            <NavLink
              key={chat.id}
              to={chatPath}
              className={({ isActive }) => `chatRow ${isActive ? "active" : ""}`}
              role="listitem"
            >
              <img className="avatar" src={chat.avatarUrl} alt={chat.name} />

              <div className="chatRowBody">
                <div className="chatRowTop">
                  <div className="chatName">{chat.name}</div>

                  <div className="chatRowMetaRight">
                    <div className="chatTime">{formatTime(last?.createdAt)}</div>
                    {chat.unreadCount > 0 && (
                      <span className="chatUnreadBadge">{chat.unreadCount}</span>
                    )}
                  </div>
                </div>

                <div className="chatPreview">
                  {chat.blocked ? (
                    <span className="muted">Blocked by admin</span>
                  ) : last?.text ? (
                    last.text
                  ) : (
                    <span className="muted">No messages yet</span>
                  )}
                </div>
              </div>
            </NavLink>
          );
        })}

        {filtered.length === 0 && (
          <div className="emptyList">
            <div className="muted">No {emptyText} found.</div>
          </div>
        )}
      </div>
    </div>
  );
}