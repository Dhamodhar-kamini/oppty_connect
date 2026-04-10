// src/App.jsx
import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Sidebar from "./components/sidebar/sidebar.jsx";
import ChatsLayout from "./components/chat/ChatsLayout.jsx";
import EmptyState from "./components/chat/EmptyState.jsx";
import ChatPage from "./components/chat/ChatPage.jsx";
import AdminDashboard from "./components/admin/AdminDashboard.jsx";
import EmployeeViewer from "./components/admin/EmployeeViewer.jsx";
import EmployeeLogin from "./pages/auth/EmployeeLogin.jsx";
import { isAuthenticated, isAdminUser } from "./utils/auth.js";
import "./App.css";

function ProtectedRoute({ children, adminOnly = false }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  
  if (adminOnly && !isAdminUser()) {
    return <Navigate to="/chats" replace />;
  }
  
  return children;
}

function ProtectedApp() {
  return (
    <div className="app">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/chats" replace />} />

          {/* Chat Routes */}
          <Route path="/chats" element={<ChatsLayout mode="dm" />}>
            <Route index element={<EmptyState />} />
            <Route path=":chatId" element={<ChatPage />} />
          </Route>

          {/* Group Routes */}
          <Route path="/groups" element={<ChatsLayout mode="group" />}>
            <Route index element={<EmptyState />} />
            <Route path=":chatId" element={<ChatPage />} />
          </Route>

          {/* Admin Routes */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute adminOnly>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/employee/:employeeId" 
            element={
              <ProtectedRoute adminOnly>
                <EmployeeViewer />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/employee/:employeeId/chat/:targetId" 
            element={
              <ProtectedRoute adminOnly>
                <EmployeeViewer />
              </ProtectedRoute>
            } 
          />

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
      <Route 
        path="/*" 
        element={
          <ProtectedRoute>
            <ProtectedApp />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}