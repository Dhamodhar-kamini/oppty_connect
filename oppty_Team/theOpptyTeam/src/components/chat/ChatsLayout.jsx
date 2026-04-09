import React from "react";
import { Outlet, useParams } from "react-router-dom";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import ChatListPage from "../chatList/ChatListPage.jsx";

export default function ChatsLayout({ mode }) {
  const { chatId } = useParams();
  const isDesktop = useMediaQuery("(min-width: 900px)");

  const showList = isDesktop || !chatId;
  const showChat = isDesktop || !!chatId;

  return (
    <div className="chatShell">
      {showList && (
        <aside className="chatListPanel" aria-label="Chat list">
          <ChatListPage mode={mode} />
        </aside>
      )}

      {showChat && (
        <section className="chatPanel" aria-label="Chat panel">
          <Outlet />
        </section>
      )}
    </div>
  );
}