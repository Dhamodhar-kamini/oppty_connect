import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Sidebar from "./components/sidebar/sidebar.jsx";
import ChatsLayout from "./components/chat/ChatsLayout.jsx";
import EmptyState from "./components/chat/EmptyState.jsx";
import ChatPage from "./components/chat/ChatPage.jsx";
import EmployeeLogin from "./pages/auth/EmployeeLogin.jsx";
import "./App.css";

function isAuthenticated() {
  const raw = localStorage.getItem("employeeAuth");
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw);
    return parsed?.isAuthenticated === true;
  } catch {
    return false;
  }
}

function ProtectedApp() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/chats" replace />} />

          <Route path="/chats" element={<ChatsLayout mode="dm" />}>
            <Route index element={<EmptyState />} />
            <Route path=":chatId" element={<ChatPage />} />
          </Route>

          <Route path="/groups" element={<ChatsLayout mode="group" />}>
            <Route index element={<EmptyState />} />
            <Route path=":chatId" element={<ChatPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/chats" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<EmployeeLogin />} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  );
}