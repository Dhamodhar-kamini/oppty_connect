// src/context/ChatContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
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

function NotificationPopup({ notifications, onDismiss, onNavigate }) {
  return (
    <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 99998, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '340px' }}>
      {notifications.map(notif => (
        <div
          key={notif.id}
          style={{
            background: '#fff', borderRadius: '12px', padding: '12px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '12px',
            animation: 'slideInRight 0.3s ease forwards', borderLeft: '4px solid #00a884'
          }}
          onClick={() => onNavigate(notif)}
        >
          <img
            src={notif.icon || `https://ui-avatars.com/api/?name=${encodeURIComponent(notif.title || 'U')}&background=random`}
            style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }}
            alt=""
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#111b21', marginBottom: '2px' }}>
              {notif.title}
            </div>
            <div style={{ fontSize: '13px', color: '#667781', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {notif.body}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(notif.id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8696a0', fontSize: '18px', flexShrink: 0, padding: '0 4px' }}
          >
            ×
          </button>
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

  const [onlineStatusMap, setOnlineStatusMap] = useState({});
  const [notificationPopups, setNotificationPopups] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({ direct: {}, groups: {}, total: 0 });

  const presenceWsRef = useRef(null);
  const notificationWsRef = useRef(null);
  const presenceReconnectRef = useRef(null);
  const notificationReconnectRef = useRef(null);
  const heartbeatRef = useRef(null);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", theme === "dark");
    localStorage.setItem("opty_theme", theme);
  }, [theme]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // ── Presence WebSocket ──────────────────────────────────────
  const connectPresenceWs = useCallback(() => {
    const authUser = getAuthUser();
    if (!authUser) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/presence/`;

    try {
      const ws = new WebSocket(wsUrl);
      presenceWsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ Presence WS connected");
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "heartbeat" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const { type, data } = payload;

          if (type === "online_users_list") {
            const newMap = {};
            (data || []).forEach(u => {
              newMap[u.employee_id] = {
                isOnline: u.is_online,
                status: u.status || 'available',
                lastSeen: null,
              };
            });
            setOnlineStatusMap(prev => ({ ...prev, ...newMap }));
          } else if (type === "online_status") {
            setOnlineStatusMap(prev => ({
              ...prev,
              [data.employee_id]: {
                isOnline: data.is_online,
                lastSeen: data.last_seen || null,
                status: data.status || prev[data.employee_id]?.status || 'available',
              }
            }));
            setUsers(prev => prev.map(u => {
              if (String(u.odooId) === String(data.employee_id)) {
                return { ...u, isOnline: data.is_online, lastSeen: data.last_seen };
              }
              return u;
            }));
          } else if (type === "status_changed") {
            setOnlineStatusMap(prev => ({
              ...prev,
              [data.employee_id]: {
                ...prev[data.employee_id],
                status: data.status,
                isOnline: true,
              }
            }));
            setUsers(prev => prev.map(u => {
              if (String(u.odooId) === String(data.employee_id)) {
                return { ...u, status: data.status };
              }
              return u;
            }));
          }
        } catch (err) {
          console.error("Presence WS parse error:", err);
        }
      };

      ws.onclose = (event) => {
        clearInterval(heartbeatRef.current);
        if (event.code !== 1000) {
          presenceReconnectRef.current = setTimeout(connectPresenceWs, 5000);
        }
      };

      ws.onerror = () => {
        clearInterval(heartbeatRef.current);
      };
    } catch (err) {
      console.error("Presence WS error:", err);
    }
  }, []);

  // ── Notification WebSocket ──────────────────────────────────
  const connectNotificationWs = useCallback((navigate) => {
    const authUser = getAuthUser();
    if (!authUser) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/notifications/`;

    try {
      const ws = new WebSocket(wsUrl);
      notificationWsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ Notification WS connected");
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const { type, data } = payload;

          if (type === "notification") {
            const notifId = Date.now() + Math.random();
            const newNotif = { id: notifId, ...data };
            setNotificationPopups(prev => [...prev.slice(-2), newNotif]);
            setTimeout(() => {
              setNotificationPopups(prev => prev.filter(n => n.id !== notifId));
            }, 5000);

            if (data.sound) {
              try {
                const audio = new Audio('/notification.mp3');
                audio.volume = 0.3;
                audio.play().catch(() => {});
              } catch (_) {}
            }

            if (data.chat_type === 'direct' && data.sender_id) {
              setUnreadCounts(prev => ({
                ...prev,
                direct: {
                  ...prev.direct,
                  [data.sender_id]: {
                    count: (prev.direct[data.sender_id]?.count || 0) + 1,
                    sender_name: data.sender_name,
                  }
                },
                total: prev.total + 1,
              }));
              setUsers(prev => prev.map(u => {
                if (String(u.odooId) === String(data.sender_id)) {
                  return { ...u, unreadCount: (u.unreadCount || 0) + 1 };
                }
                return u;
              }));
            } else if (data.chat_type === 'group' && data.group_id) {
              setUnreadCounts(prev => ({
                ...prev,
                groups: {
                  ...prev.groups,
                  [data.group_id]: {
                    count: (prev.groups[data.group_id]?.count || 0) + 1,
                    group_name: data.group_name,
                  }
                },
                total: prev.total + 1,
              }));
              setGroups(prev => prev.map(g => {
                if (String(g.odooId) === String(data.group_id)) {
                  return { ...g, unreadCount: (g.unreadCount || 0) + 1 };
                }
                return g;
              }));
            }
          } else if (type === "unread_counts") {
            setUnreadCounts(data);
            if (data.direct) {
              setUsers(prev => prev.map(u => {
                const unreadInfo = data.direct[String(u.odooId)];
                return unreadInfo ? { ...u, unreadCount: unreadInfo.count } : u;
              }));
            }
            if (data.groups) {
              setGroups(prev => prev.map(g => {
                const unreadInfo = data.groups[String(g.odooId)];
                return unreadInfo ? { ...g, unreadCount: unreadInfo.count } : g;
              }));
            }
          }
        } catch (err) {
          console.error("Notification WS parse error:", err);
        }
      };

      ws.onclose = (event) => {
        if (event.code !== 1000) {
          notificationReconnectRef.current = setTimeout(() => connectNotificationWs(navigate), 5000);
        }
      };

      ws.onerror = () => {};
    } catch (err) {
      console.error("Notification WS error:", err);
    }
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotificationPopups(prev => prev.filter(n => n.id !== id));
  }, []);

  const updatePresenceStatus = useCallback((status) => {
    if (presenceWsRef.current?.readyState === WebSocket.OPEN) {
      presenceWsRef.current.send(JSON.stringify({ type: "status_update", status }));
    }
  }, []);

  // ── Load Data ───────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const authUser = getAuthUser();
    const myId = authUser?.id || authUser?.employeeId;
    if (!myId) { setIsLoading(false); return; }

    setIsLoading(true);
    try {
      const [usersData, groupsData, meData] = await Promise.all([
        API.fetchUsers().catch(() => []),
        API.fetchGroups().catch(() => []),
        fetch('/api/me/', { credentials: 'include' }).then(res => res.ok ? res.json() : null).catch(() => null)
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
        lastMessage: u.lastMessage || null, messages: [],
        isOnline: u.isOnline || false,
        lastSeen: u.lastSeen || null,
      })));

      setGroups((groupsData || []).map(g => ({
        id: `group-${g.id}`, odooId: g.id, kind: "group", name: g.name,
        description: g.description, avatarUrl: g.avatarUrl, memberCount: g.memberCount,
        isBroadcast: g.isBroadcast || false, lastMessage: g.lastMessage || null,
        members: g.members || [], messages: [],
        canChat: g.canChat !== undefined ? g.canChat : true,
        chatPermission: g.chatPermission || 'all',
        allowedChatters: g.allowedChatters || [],
        unreadCount: g.unreadCount || 0,
      })));
    } catch (err) {
      console.error("Load Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Connect WS after load ──────────────────────────────────
  useEffect(() => {
    const authUser = getAuthUser();
    if (!authUser) return;

    const timer = setTimeout(() => {
      connectPresenceWs();
      connectNotificationWs();
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(heartbeatRef.current);
      clearTimeout(presenceReconnectRef.current);
      clearTimeout(notificationReconnectRef.current);
      if (presenceWsRef.current) {
        presenceWsRef.current.close(1000, "Unmounting");
        presenceWsRef.current = null;
      }
      if (notificationWsRef.current) {
        notificationWsRef.current.close(1000, "Unmounting");
        notificationWsRef.current = null;
      }
    };
  }, [connectPresenceWs, connectNotificationWs]);

  // ── Message Operations ──────────────────────────────────────
  const receiveMessage = useCallback((chatId, message) => {
    const updater = (prev) => prev.map(chat => {
      if (chat.id !== chatId) return chat;
      const formatted = {
        ...message,
        isStarred: message.isStarred || false,
        isPinned: message.isPinned || false,
        reactions: message.reactions || {},
        thread: message.thread || []
      };
      if (chat.messages?.find(m => m.id === formatted.id)) return chat;
      return { ...chat, messages: [...(chat.messages || []), formatted], lastMessage: formatted };
    });
    if (String(chatId).startsWith("group-")) setGroups(updater); else setUsers(updater);
  }, []);

  const clearUnreadCount = useCallback((chatId) => {
    const updater = prev => prev.map(c => c.id === chatId ? { ...c, unreadCount: 0 } : c);
    if (String(chatId).startsWith("group-")) setGroups(updater); else setUsers(updater);
    if (notificationWsRef.current?.readyState === WebSocket.OPEN) {
      if (String(chatId).startsWith("group-")) {
        const groupId = String(chatId).replace("group-", "");
        notificationWsRef.current.send(JSON.stringify({ type: "mark_group_read", group_id: groupId }));
      } else {
        const senderId = String(chatId).replace("emp-", "");
        notificationWsRef.current.send(JSON.stringify({ type: "mark_chat_read", sender_id: senderId }));
      }
    }
  }, []);

  const updateGroupChatPermission = useCallback(async (chatId, chatPermission, allowedChatters = []) => {
    try {
      const groupId = String(chatId).replace("group-", "");
      const result = await API.updateGroupChatPermission(groupId, chatPermission, allowedChatters);

      setGroups(prev => prev.map(g => {
        if (g.id === chatId) {
          return {
            ...g,
            chatPermission: result.chatPermission || chatPermission,
            allowedChatters: result.allowedChatters || allowedChatters,
            canChat: result.canChat !== undefined ? result.canChat : g.canChat,
          };
        }
        return g;
      }));

      showToast("Chat permission updated", "success");
      return result;
    } catch (err) {
      showToast(err.message || "Failed to update permission", "error");
      throw err;
    }
  }, [showToast]);

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
      try { await fetch(`/api/messages/${id}/delete-for-me/`, { method: "POST", headers: { "X-CSRFToken": getCsrfToken() }, credentials: "include" }); } catch (e) {}
    });
  }, []);

  const deleteMessageForAll = useCallback(async (chatId, msgIds) => {
    const updater = (prev) => prev.map(c => c.id === chatId ? { ...c, messages: c.messages.map(m => msgIds.includes(m.id) ? { ...m, isDeleted: true, deletedForAll: true, text: "🚫 This message was deleted", fileUrl: null } : m) } : c);
    chatId.startsWith("group-") ? setGroups(updater) : setUsers(updater);
    msgIds.forEach(async (id) => {
      try { await fetch(`/api/messages/${id}/delete-for-everyone/`, { method: "POST", headers: { "X-CSRFToken": getCsrfToken() }, credentials: "include" }); } catch (e) {}
    });
  }, []);

  const toggleBlockChat = useCallback(async (chatId) => {
    const isAdminUser = currentUser?.role === "admin" || currentUser?.role === "superadmin";
    setUsers(prev => prev.map(u => {
      if (u.id === chatId) {
        if (isAdminUser) return { ...u, adminBlocked: !u.adminBlocked };
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

  const createEmployee = useCallback(async (data) => {
    try {
      const result = await API.createEmployee(data);
      const newUser = {
        id: `emp-${result.id}`, odooId: result.id, kind: "dm", name: result.name,
        email: result.email,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(result.name)}&background=random&size=200`,
        about: "Hey there!", status: "available", contact: result.email,
        unreadCount: 0, blocked: false, adminBlocked: false,
        lastMessage: null, messages: [], isOnline: false, lastSeen: null,
      };
      setUsers(prev => {
        if (prev.find(u => u.id === newUser.id)) return prev;
        return [...prev, newUser];
      });
      setTimeout(() => loadData(), 500);
      showToast("Employee created successfully", "success");
      return result;
    } catch (err) {
      showToast(err.message || "Failed to create employee", "error");
      throw err;
    }
  }, [showToast, loadData]);

  const createGroup = useCallback(async (data) => {
    try {
      const result = await API.createGroup(data);
      const newGroup = {
        id: `group-${result.id}`, odooId: result.id, kind: "group", name: result.name,
        description: result.description || "",
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(result.name)}&background=00a884&color=fff&size=200`,
        memberCount: result.memberCount || 1, isBroadcast: result.isBroadcast || false,
        lastMessage: null, members: [], messages: [],
        canChat: true, chatPermission: result.chatPermission || 'all',
        allowedChatters: result.allowedChatters || [], unreadCount: 0,
      };
      setGroups(prev => {
        if (prev.find(g => g.id === newGroup.id)) return prev;
        return [...prev, newGroup];
      });
      setTimeout(() => loadData(), 500);
      showToast("Group created successfully", "success");
      return result;
    } catch (err) {
      showToast(err.message || "Failed to create group", "error");
      throw err;
    }
  }, [showToast, loadData]);

  const getOnlineStatus = useCallback((odooId) => {
    return onlineStatusMap[odooId] || { isOnline: false, lastSeen: null, status: 'available' };
  }, [onlineStatusMap]);

  const setMessages = useCallback((chatId, msgs) => {
    const updater = prev => prev.map(c => c.id === chatId ? { ...c, messages: msgs } : c);
    if (String(chatId).startsWith("group-")) setGroups(updater); else setUsers(updater);
  }, []);

  const updateMessage = useCallback((chatId, messageId, updates) => {
    const updater = prev => prev.map(c => c.id === chatId ? {
      ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, ...updates } : m)
    } : c);
    if (String(chatId).startsWith("group-")) setGroups(updater); else setUsers(updater);
  }, []);

  const deleteMessage = useCallback((chatId, messageId, deleteType) => {
    if (deleteType === 'for_everyone') {
      const updater = prev => prev.map(c => c.id === chatId ? {
        ...c, messages: c.messages.map(m => m.id === messageId ? {
          ...m, isDeleted: true, deletedForAll: true, text: "🚫 This message was deleted"
        } : m)
      } : c);
      if (String(chatId).startsWith("group-")) setGroups(updater); else setUsers(updater);
    } else {
      const updater = prev => prev.map(c => c.id === chatId ? {
        ...c, messages: c.messages.filter(m => m.id !== messageId)
      } : c);
      if (String(chatId).startsWith("group-")) setGroups(updater); else setUsers(updater);
    }
  }, []);

  // ── Build API object ────────────────────────────────────────
  const api = useMemo(() => ({
    chats: [...users, ...groups],
    users,
    groups,
    isLoading,
    theme,
    chatFilter,
    currentUser,
    onlineStatusMap,
    unreadCounts,
    setChatFilter,
    toggleTheme: () => setTheme(prev => prev === "light" ? "dark" : "light"),
    showToast,
    getChatById: (id) => [...users, ...groups].find(c => c.id === String(id)),
    receiveMessage,
    toggleStar,
    togglePin,
    toggleBlockChat,
    deleteEmployeeGlobally,
    loadData,
    deleteMessageForMe,
    deleteMessageForAll,
    clearUnreadCount,
    createEmployee,
    createGroup,
    updateGroupChatPermission,
    getOnlineStatus,
    updatePresenceStatus,
    setMessages,
    updateMessage,
    deleteMessage,

    deleteChat: async (chatId) => {
      const updater = prev => prev.map(c => c.id === chatId ? { ...c, messages: [] } : c);
      if (String(chatId).startsWith("group-")) setGroups(updater); else setUsers(updater);
      showToast("Chat deleted", "success");
    },

    forwardMessages: async (msgs, targets) => {
      targets.forEach(t => msgs.forEach(m => receiveMessage(t, {
        ...m, id: `fwd-${Date.now()}-${Math.random()}`, isForwarded: true,
        sender: "me", createdAt: Date.now(),
        type: m.type || m.messageType || 'text',
        messageType: m.messageType || m.type || 'text',
        fileUrl: m.fileUrl, fileName: m.fileName, fileSize: m.fileSize,
        meetLink: m.meetLink, meetTitle: m.meetTitle, meetScheduledAt: m.meetScheduledAt
      })));
      await API.forwardMessagesApi(msgs, targets);
    },

    editMessage: async (chatId, msgId, text) => {
      const upd = (prev) => prev.map(c => c.id === chatId ? {
        ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, text, isEdited: true } : m)
      } : c);
      chatId.startsWith("group-") ? setGroups(upd) : setUsers(upd);
      await API.editMessage(msgId, text);
    },

    // ✅ FIXED: Don't call loadData() — let ChatPage handle reload via reloadChatInfo
    addGroupMember: async (chatId, empId) => {
      const groupId = String(chatId).replace("group-", "");
      await API.addGroupMembers(groupId, [empId]);
      // ✅ No loadData() here — ChatPage calls reloadChatInfo() after this
    },

    // ✅ FIXED: Don't call loadData() — let ChatPage handle reload via reloadChatInfo
    removeGroupMember: async (chatId, empId) => {
      const groupId = String(chatId).replace("group-", "");
      await API.removeGroupMember(groupId, empId);
      // ✅ No loadData() here — ChatPage calls reloadChatInfo() after this
    },

    promoteAdmin: async (chatId, empId) => {
      showToast("Promoted to Admin", "success");
      loadData();
    },

    leaveGroup: async (chatId) => {
      await API.leaveGroup(String(chatId).replace("group-", ""));
      showToast("Left Group", "success");
      loadData();
    },

    isAdmin: currentUser?.role === "admin" || currentUser?.role === "superadmin",
  }), [
    users, groups, isLoading, theme, chatFilter, currentUser, onlineStatusMap, unreadCounts,
    receiveMessage, toggleStar, togglePin, toggleBlockChat, deleteEmployeeGlobally,
    deleteMessageForMe, deleteMessageForAll, clearUnreadCount, showToast, loadData,
    createEmployee, createGroup, updateGroupChatPermission, getOnlineStatus,
    updatePresenceStatus, setMessages, updateMessage, deleteMessage,
  ]);

  return (
    <ChatContext.Provider value={api}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      {children}
      <ToastContainer toasts={toasts} />
      {notificationPopups.length > 0 && (
        <NotificationPopup
          notifications={notificationPopups}
          onDismiss={dismissNotification}
          onNavigate={(notif) => {
            dismissNotification(notif.id);
            if (notif.chat_type === 'group' && notif.group_id) {
              window.location.href = `/groups/group-${notif.group_id}`;
            } else if (notif.chat_type === 'direct' && notif.sender_id) {
              window.location.href = `/chats/emp-${notif.sender_id}`;
            }
          }}
        />
      )}
    </ChatContext.Provider>
  );
}

export const useChats = () => useContext(ChatContext);