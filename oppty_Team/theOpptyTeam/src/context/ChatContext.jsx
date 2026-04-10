import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import * as API from "../utils/api.js";
import { getAuthUser } from "../utils/auth.js";

const ChatContext = createContext(null);

function ToastContainer({ toasts }) {
  return (
    <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{
          background: toast.type === 'error' ? '#ea0038' : '#22c55e',
          color: '#fff', padding: '10px 20px', borderRadius: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '14px', fontWeight: 600,
          animation: 'fadeInUp 0.3s ease forwards'
        }}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function getCsrfToken() {
  return document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1] || '';
}

export function ChatProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem("opty_theme") || "light");
  const [chatFilter, setChatFilter] = useState("all");

  const [currentUser, setCurrentUser] = useState(() => getAuthUser());

  useEffect(() => {
    document.body.classList.toggle("dark-mode", theme === "dark");
    localStorage.setItem("opty_theme", theme);
  }, [theme]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const loadData = useCallback(async () => {
    const authUser = getAuthUser();
    const myId = authUser?.id || authUser?.employeeId;

    if (!myId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [usersData, groupsData, meData] = await Promise.all([
        API.fetchUsers().catch(() => []),
        API.fetchGroups().catch(() => []),
        fetch('/api/me/', {credentials: 'include'}).then(res => res.ok ? res.json() : null).catch(() => null)
      ]);

      if (meData) {
        setCurrentUser(meData);
        const currentAuth = JSON.parse(localStorage.getItem("employeeAuth") || "{}");
        localStorage.setItem("employeeAuth", JSON.stringify({ ...currentAuth, ...meData }));
      }

      setUsers((usersData || []).map(u => ({
        id: `emp-${u.id}`, odooId: u.id, kind: "dm", name: u.name, email: u.email,
        avatarUrl: u.avatarUrl, about: u.about || "Hey there!", status: u.status || "available",
        contact: u.email, unreadCount: u.unreadCount || 0,
        blocked: u.blocked || false, adminBlocked: u.adminBlocked || false, 
        lastMessage: u.lastMessage || null, 
        messages: [],
      })));

      setGroups((groupsData || []).map(g => ({
        id: `group-${g.id}`, odooId: g.id, kind: "group", name: g.name, description: g.description,
        avatarUrl: g.avatarUrl, memberCount: g.memberCount, isBroadcast: g.isBroadcast || false,
        lastMessage: g.lastMessage || null, 
        members: g.members || [], messages: [],
      })));
    } catch (err) { 
      console.error("Load Error:", err); 
    } finally { 
      setIsLoading(false); 
    }
  }, []); 

  useEffect(() => { loadData(); }, [loadData]);

  const receiveMessage = useCallback((chatId, message) => {
    const updater = (prev) => prev.map(chat => {
      if (chat.id !== chatId) return chat;
      const formatted = { ...message, isStarred: message.isStarred || false, isPinned: message.isPinned || false, reactions: message.reactions || {}, thread: message.thread || [] };
      if (chat.messages?.find(m => m.id === formatted.id)) return chat;
      
      return { 
        ...chat, 
        messages: [...(chat.messages || []), formatted],
        lastMessage: formatted
      };
    });
    if (String(chatId).startsWith("group-")) setGroups(updater); else setUsers(updater);
  }, []);

  // ✅ THIS IS THE FUNCTION YOUR APP WAS LOOKING FOR
  const clearUnreadCount = useCallback((chatId) => {
    const updater = prev => prev.map(c => c.id === chatId ? { ...c, unreadCount: 0 } : c);
    if (String(chatId).startsWith("group-")) setGroups(updater); else setUsers(updater);
  }, []);

  const toggleStar = useCallback(async (chatId, messageId) => {
    const updater = (prev) => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, isStarred: !m.isStarred } : m) } : c);
    chatId.startsWith("group-") ? setGroups(updater) : setUsers(updater);
    try { await fetch(`/api/messages/${messageId}/star/`, { method: "POST", headers: { "X-CSRFToken": getCsrfToken() }, credentials: "include" }); } catch (e) {}
  }, []);

  const togglePin = useCallback(async (chatId, messageId) => {
    const updater = (prev) => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, isPinned: !m.isPinned } : m) } : c);
    chatId.startsWith("group-") ? setGroups(updater) : setUsers(updater);
    try { await fetch(`/api/messages/${messageId}/pin/`, { method: "POST", headers: { "X-CSRFToken": getCsrfToken() }, credentials: "include" }); } catch (e) {}
  }, []);

  const deleteMessageForMe = useCallback(async (chatId, msgIds) => {
    const updater = (prev) => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.filter(m => !msgIds.includes(m.id)) } : c);
    chatId.startsWith("group-") ? setGroups(updater) : setUsers(updater);
    msgIds.forEach(async (id) => {
        try { await fetch(`/api/messages/${id}/delete-for-me/`, { method: "POST", headers: { "X-CSRFToken": getCsrfToken() }, credentials: "include" }); } catch(e) {}
    });
  }, []);

  const deleteMessageForAll = useCallback(async (chatId, msgIds) => {
    const updater = (prev) => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => msgIds.includes(m.id) ? { ...m, isDeleted: true, deletedForAll: true, text: "🚫 This message was deleted", fileUrl: null } : m) } : c);
    chatId.startsWith("group-") ? setGroups(updater) : setUsers(updater);
    msgIds.forEach(async (id) => {
        try { await fetch(`/api/messages/${id}/delete-for-everyone/`, { method: "POST", headers: { "X-CSRFToken": getCsrfToken() }, credentials: "include" }); } catch(e) {}
    });
  }, []);

  const toggleBlockChat = useCallback(async (chatId) => {
    const isAdmin = currentUser?.role === "admin" || currentUser?.role === "superadmin";
    setUsers(prev => prev.map(u => {
      if (u.id === chatId) {
         if (isAdmin) return { ...u, adminBlocked: !u.adminBlocked };
         return { ...u, blocked: !u.blocked };
      }
      return u;
    }));
    await API.toggleBlockUser(String(chatId).replace("emp-", ""));
  }, [currentUser]);

  const deleteEmployeeGlobally = useCallback(async (chatId) => {
    const id = String(chatId).replace("emp-", "");
    try {
      const response = await fetch(`/api/admin/employee/${id}/delete/`, {
        method: "DELETE", headers: { "X-CSRFToken": getCsrfToken(), "Content-Type": "application/json" }, credentials: "include"
      });
      if (response.ok) {
        setUsers(prev => prev.filter(u => u.id !== chatId));
        showToast("Employee deleted completely", "success");
      }
    } catch (err) { showToast("Network error", "error"); }
  }, [showToast]);

  const api = useMemo(() => ({
    chats: [...users, ...groups], users, groups, isLoading, theme, chatFilter, currentUser,
    setChatFilter, toggleTheme: () => setTheme(prev => prev === "light" ? "dark" : "light"),
    showToast, getChatById: (id) => [...users, ...groups].find(c => c.id === String(id)),
    receiveMessage, toggleStar, togglePin, toggleBlockChat, deleteEmployeeGlobally, loadData,
    deleteMessageForMe, deleteMessageForAll, clearUnreadCount, // ✅ clearUnreadCount exported here!
    forwardMessages: async (msgs, targets) => {
      targets.forEach(t => msgs.forEach(m => receiveMessage(t, { 
        ...m, id: `fwd-${Date.now()}-${Math.random()}`, isForwarded: true, sender: "me", createdAt: Date.now(),
        type: m.type || m.messageType || 'text', messageType: m.messageType || m.type || 'text',
        fileUrl: m.fileUrl, fileName: m.fileName, fileSize: m.fileSize, meetLink: m.meetLink, meetTitle: m.meetTitle, meetScheduledAt: m.meetScheduledAt
      })));
      await API.forwardMessagesApi(msgs, targets);
    },
    editMessage: async (chatId, msgId, text) => {
      const upd = (prev) => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, text, isEdited: true } : m) } : c);
      chatId.startsWith("group-") ? setGroups(upd) : setUsers(upd);
      await API.editMessage(msgId, text);
    },
    addGroupMember: async (chatId, empId) => {
      await API.addGroupMembers(String(chatId).replace("group-", ""), [empId]);
      showToast("Member Added", "success"); loadData();
    },
    removeGroupMember: async (chatId, empId) => {
      await API.removeGroupMember(String(chatId).replace("group-", ""), empId);
      showToast("Member Removed", "success"); loadData();
    },
    promoteAdmin: async (chatId, empId) => {
      await API.promoteAdmin(String(chatId).replace("group-", ""), empId); 
      showToast("Promoted to Admin", "success"); loadData();
    },
    leaveGroup: async (chatId) => {
      await API.leaveGroup(String(chatId).replace("group-", ""));
      showToast("Left Group", "success"); loadData();
    },
    isAdmin: currentUser?.role === "admin" || currentUser?.role === "superadmin",
  }), [users, groups, isLoading, theme, chatFilter, currentUser, receiveMessage, toggleStar, togglePin, toggleBlockChat, deleteEmployeeGlobally, deleteMessageForMe, deleteMessageForAll, clearUnreadCount, showToast, loadData]);

  return (
    <ChatContext.Provider value={api}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {children}
      <ToastContainer toasts={toasts} />
    </ChatContext.Provider>
  );
}

export const useChats = () => useContext(ChatContext);