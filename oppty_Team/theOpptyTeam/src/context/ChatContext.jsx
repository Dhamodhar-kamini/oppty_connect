import React, { createContext, useContext, useEffect, useMemo, useState, useReducer } from "react";
import { getAuthUser } from "../utils/auth.js";
import { employeeDB } from "../data/employees"; 

const STORAGE_KEY = "opty_chat_v8";

function uid() { return crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`; }
function now() { return Date.now(); }

function loadChats() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } 
  catch { return null; }
}
function saveChats(chats) { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); }
function safeTime(value) {
  const parsed = Number(value); if (Number.isFinite(parsed)) return parsed;
  const dateValue = new Date(value).getTime(); if (Number.isFinite(dateValue)) return dateValue;
  return now();
}

function generateMockLinkPreview(text) {
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (!urlMatch) return null;
  try {
    const url = new URL(urlMatch[0]);
    let preview = { domain: url.hostname.replace('www.', ''), title: "Shared Link Overview", description: "Tap to preview the website content shared in this link.", imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=80" };
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) { preview.title = "YouTube Video"; preview.description = "Watch this video on YouTube."; preview.imageUrl = "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&q=80"; }
    return preview;
  } catch (e) { return null; }
}

function getDisappearingThreshold(mode) {
  if (mode === "24h") return 24 * 60 * 60 * 1000;
  if (mode === "7d") return 7 * 24 * 60 * 60 * 1000;
  if (mode === "90d") return 90 * 24 * 60 * 60 * 1000;
  return null;
}

const seed = [
  {
    id: "g1", kind: "group", name: "Oppty Team", avatarUrl: "https://i.pravatar.cc/100?img=20",
    isOnline: false, lastSeen: "", about: "Official team discussion group.", contact: "opptyteam@oppty.com",
    isAdmin: true, blocked: false, hasLeft: false, disappearingMode: "off", isBroadcast: false, bookmarks: [],
    members: [
      { id: "emp-1", name: "Employee One", email: "employee@oppty.com", avatarUrl: "https://i.pravatar.cc/100?img=11", isAdmin: false },
      { id: "emp-3", name: "Dhamu", email: "dhamu@oppty.com", avatarUrl: "https://i.pravatar.cc/100?img=21", isAdmin: true },
      { id: "emp-4", name: "Jason", email: "jason@oppty.com", avatarUrl: "https://i.pravatar.cc/100?img=22", isAdmin: false },
    ],
    messages: [
      { id: uid(), chatId: "g1", sender: "system", senderName: "System", type: "system", text: "You created this group", createdAt: now() - 1000 * 60 * 305, replyTo: null, deletedForAll: false, deletedFor: [], status: "read", unread: false, reactions: [], isStarred: false, isPinned: false, thread: [] },
      { id: uid(), chatId: "g1", sender: "dhamu@oppty.com", senderName: "Dhamu", type: "text", text: "Welcome to Oppty Team group!", createdAt: now() - 1000 * 60 * 300, replyTo: null, deletedForAll: false, deletedFor: [], status: "read", unread: false, reactions: [], isStarred: false, isPinned: false, thread: [] },
    ],
  },
];

function normalizeAndMerge(persisted) {
  if (!Array.isArray(persisted)) return seed;
  const nowMs = now();

  const persistedNormalized = persisted.map((c) => {
    const disappearingMode = c.disappearingMode ?? "off";
    const threshold = getDisappearingThreshold(disappearingMode);
    
    const rawMessages = Array.isArray(c.messages) ? c.messages.map((m) => ({
      ...m, id: m.id ?? uid(), chatId: m.chatId ?? c.id, sender: m.sender ?? "them", senderName: m.senderName ?? (m.sender === "me" ? "You" : "Them"),
      type: m.type ?? "text", text: m.text ?? "", fileUrl: m.fileUrl ?? "", fileName: m.fileName ?? "", replyTo: m.replyTo ?? null,
      deletedForAll: m.deletedForAll ?? false, deletedFor: Array.isArray(m.deletedFor) ? m.deletedFor : [], createdAt: safeTime(m.createdAt),
      isEdited: m.isEdited ?? false, status: m.status ?? "read", unread: m.unread ?? false, reactions: Array.isArray(m.reactions) ? m.reactions : [],
      isStarred: m.isStarred ?? false, isPinned: m.isPinned ?? false, linkPreview: m.linkPreview ?? null, pollOptions: Array.isArray(m.pollOptions) ? m.pollOptions : [], allowMultiple: m.allowMultiple ?? false,
      thread: Array.isArray(m.thread) ? m.thread : []
    })) : [];

    const activeMessages = rawMessages.filter(m => {
      if (m.isPinned) return true;
      if (threshold && (nowMs - m.createdAt > threshold)) return false;
      return true;
    });

    return {
      ...c, kind: c.kind ?? "dm", about: c.about ?? "Hey there! I am using Oppty Chats.", contact: c.contact ?? "Not available", isAdmin: c.isAdmin ?? false, blocked: c.blocked ?? false, hasLeft: c.hasLeft ?? false,
      disappearingMode, isBroadcast: c.isBroadcast ?? false, bookmarks: Array.isArray(c.bookmarks) ? c.bookmarks : [], participants: Array.isArray(c.participants) ? c.participants : [], members: Array.isArray(c.members) ? c.members.map(m => ({ ...m, isAdmin: m.isAdmin ?? false })) : [], messages: activeMessages
    };
  });

  const byId = new Map(persistedNormalized.map((c) => [c.id, c]));
  for (const s of seed) { if (!byId.has(s.id)) byId.set(s.id, s); }
  return Array.from(byId.values());
}

const ChatContext = createContext(null);

function isSystemAdmin() { return getAuthUser()?.role === "admin"; }
function createSystemMessage(chatId, text) { return { id: uid(), chatId, sender: "system", senderName: "System", type: "system", text, createdAt: now(), replyTo: null, deletedForAll: false, deletedFor: [], status: "read", unread: false, reactions: [], isStarred: false, isPinned: false, thread: [] }; }

function reducer(state, action) {
  const currentUser = getAuthUser();
  const currentEmail = currentUser ? currentUser.email : "me";

  switch (action.type) {
    case "INIT": return { chats: action.chats };
    case "RESET": saveChats(seed); return { chats: seed };

    case "CLEAN_EXPIRED": {
      const nowMs = now(); let changed = false;
      const chats = state.chats.map(c => {
        const threshold = getDisappearingThreshold(c.disappearingMode); if (!threshold) return c;
        const initialLen = c.messages.length;
        const validMessages = c.messages.filter(m => { if (m.isPinned) return true; return (nowMs - m.createdAt) <= threshold; });
        if (validMessages.length !== initialLen) { changed = true; return { ...c, messages: validMessages }; }
        return c;
      });
      if (changed) { saveChats(chats); return { chats }; }
      return state;
    }

    case "SET_DISAPPEARING_MODE": {
      const chats = state.chats.map((c) => {
        if (c.id !== action.chatId) return c;
        const text = action.mode === "off" ? "You turned off disappearing messages." : `You turned on disappearing messages. New messages will disappear from this chat after ${action.mode === '24h' ? '24 hours' : action.mode === '7d' ? '7 days' : '90 days'}.`;
        return { ...c, disappearingMode: action.mode, messages: [...c.messages, createSystemMessage(c.id, text)] };
      });
      saveChats(chats); return { chats };
    }

    case "TOGGLE_BROADCAST_MODE": {
      const chats = state.chats.map(c => {
        if (c.id !== action.chatId || c.kind !== "group") return c;
        const newMode = !c.isBroadcast;
        const text = newMode ? "This group is now a broadcast channel. Only admins can send messages." : "This group is no longer a broadcast channel. All members can send messages.";
        return { ...c, isBroadcast: newMode, messages: [...c.messages, createSystemMessage(c.id, text)] };
      });
      saveChats(chats); return { chats };
    }

    case "SEND": {
      const text = action.text.trim(); if (!text) return state;
      const target = state.chats.find((c) => c.id === action.chatId); if (!target || target.blocked || target.hasLeft) return state;
      const linkPreview = generateMockLinkPreview(text);
      const msg = { id: uid(), chatId: action.chatId, sender: currentEmail, senderName: currentUser?.name || "You", type: "text", text, createdAt: now(), replyTo: action.replyTo ? { id: action.replyTo.id, text: action.replyTo.text, type: action.replyTo.type, fileName: action.replyTo.fileName, senderName: action.replyTo.senderName || 'Them' } : null, deletedForAll: false, deletedFor: [], status: "read", unread: false, reactions: [], isStarred: false, isPinned: false, linkPreview, thread: [] };
      const chats = state.chats.map((c) => c.id === action.chatId ? { ...c, messages: [...c.messages, msg] } : c);
      saveChats(chats); return { chats };
    }

    case "SEND_THREAD_MESSAGE": {
      const text = action.text.trim(); if (!text) return state;
      const chats = state.chats.map((c) => {
        if (c.id !== action.chatId) return c;
        return {
          ...c, messages: c.messages.map((m) => {
            if (m.id !== action.messageId) return m;
            const threadMsg = { id: uid(), sender: currentEmail, senderName: currentUser?.name || "You", text, createdAt: now() };
            return { ...m, thread: [...(m.thread || []), threadMsg] };
          })
        };
      });
      saveChats(chats); return { chats };
    }

    case "SEND_ATTACHMENT": {
      const target = state.chats.find((c) => c.id === action.chatId); if (!target || target.blocked || target.hasLeft) return state;
      const msg = { id: uid(), chatId: action.chatId, sender: currentEmail, senderName: currentUser?.name || "You", type: action.attachmentType, text: action.fileName || "", fileUrl: action.fileUrl || "", fileName: action.fileName || "", createdAt: now(), replyTo: action.replyTo ? { id: action.replyTo.id, text: action.replyTo.text, type: action.replyTo.type, fileName: action.replyTo.fileName, senderName: action.replyTo.senderName || 'Them' } : null, deletedForAll: false, deletedFor: [], status: "read", unread: false, reactions: [], isStarred: false, isPinned: false, thread: [] };
      const chats = state.chats.map((c) => c.id === action.chatId ? { ...c, messages: [...c.messages, msg] } : c);
      saveChats(chats); return { chats };
    }

    case "SEND_POLL": {
      const target = state.chats.find((c) => c.id === action.chatId); if (!target || target.blocked || target.hasLeft) return state;
      const msg = { id: uid(), chatId: action.chatId, sender: currentEmail, senderName: currentUser?.name || "You", type: "poll", text: action.question, createdAt: now(), pollOptions: action.options.map(opt => ({ id: uid(), text: opt, votedBy: [] })), allowMultiple: action.allowMultiple, replyTo: null, deletedForAll: false, deletedFor: [], status: "read", unread: false, reactions: [], isStarred: false, isPinned: false, thread: [] };
      const chats = state.chats.map((c) => c.id === action.chatId ? { ...c, messages: [...c.messages, msg] } : c);
      saveChats(chats); return { chats };
    }

    case "VOTE_POLL": {
      const chats = state.chats.map((chat) => {
        if (chat.id !== action.chatId) return chat;
        return {
          ...chat, messages: chat.messages.map((msg) => {
            if (msg.id !== action.messageId || msg.type !== "poll") return msg;
            const newOptions = msg.pollOptions.map(opt => {
              if (opt.id === action.optionId) {
                const hasVoted = opt.votedBy.includes(currentEmail);
                return { ...opt, votedBy: hasVoted ? opt.votedBy.filter(id => id !== currentEmail) : [...opt.votedBy, currentEmail] };
              } else if (!msg.allowMultiple) return { ...opt, votedBy: opt.votedBy.filter(id => id !== currentEmail) };
              return opt;
            });
            return { ...msg, pollOptions: newOptions };
          })
        };
      });
      saveChats(chats); return { chats };
    }

    case "ADD_BOOKMARK": {
      const chats = state.chats.map((c) => {
        if (c.id !== action.chatId) return c;
        const newBookmark = { id: uid(), title: action.title, url: action.url };
        return { ...c, bookmarks: [...(c.bookmarks || []), newBookmark], messages: [...c.messages, createSystemMessage(c.id, `You pinned a bookmark: ${action.title}`)] };
      });
      saveChats(chats); return { chats };
    }
    
    case "REMOVE_BOOKMARK": {
      const chats = state.chats.map((c) => {
        if (c.id !== action.chatId) return c;
        return { ...c, bookmarks: (c.bookmarks || []).filter(b => b.id !== action.bookmarkId) };
      });
      saveChats(chats); return { chats };
    }

    case "EDIT_MESSAGE": {
      const chats = state.chats.map((c) => { if (c.id !== action.chatId) return c; return { ...c, messages: c.messages.map((m) => m.id === action.messageId ? { ...m, text: action.text.trim(), isEdited: true } : m) }; });
      saveChats(chats); return { chats };
    }

    case "TOGGLE_REACTION": {
      const chats = state.chats.map(c => { if (c.id !== action.chatId) return c; return { ...c, messages: c.messages.map(m => { if (m.id !== action.messageId) return m; const exists = m.reactions.includes(action.emoji); return { ...m, reactions: exists ? m.reactions.filter(e => e !== action.emoji) : [...m.reactions, action.emoji] }; })}; });
      saveChats(chats); return { chats };
    }

    case "TOGGLE_STAR": {
      const chats = state.chats.map(c => { if (c.id !== action.chatId) return c; return { ...c, messages: c.messages.map(m => m.id === action.messageId ? { ...m, isStarred: !m.isStarred } : m) }; });
      saveChats(chats); return { chats };
    }

    case "TOGGLE_PIN": {
      const chats = state.chats.map(c => { if (c.id !== action.chatId) return c; return { ...c, messages: c.messages.map(m => m.id === action.messageId ? { ...m, isPinned: !m.isPinned } : m) }; });
      saveChats(chats); return { chats };
    }

    case "DELETE_MESSAGE_FOR_ME": {
      const ids = Array.isArray(action.messageId) ? action.messageId : [action.messageId];
      const chats = state.chats.map((chat) => {
        if (chat.id !== action.chatId) return chat;
        return { ...chat, messages: chat.messages.map(msg => { if (ids.includes(msg.id)) { return { ...msg, deletedFor: [...(msg.deletedFor || []), currentEmail] }; } return msg; }) };
      });
      saveChats(chats); return { chats };
    }

    case "DELETE_MESSAGE_FOR_ALL": {
      const ids = Array.isArray(action.messageId) ? action.messageId : [action.messageId];
      const chats = state.chats.map((chat) => {
        if (String(chat.id) !== String(action.chatId)) return chat;
        return {
          ...chat, messages: chat.messages.map((msg) => {
            if (!ids.includes(msg.id)) return msg;
            if (msg.sender !== currentEmail && !isSystemAdmin()) return msg; 
            return { ...msg, type: "text", text: "This message was deleted", fileUrl: "", fileName: "", deletedForAll: true, reactions: [], isPinned: false };
          }),
        };
      });
      saveChats(chats); return { chats };
    }

    case "ADD_CONTACT": {
      const name = action.payload.name.trim(); if (!name) return state;
      const targetEmail = action.payload.contact?.trim();
      const newChat = { id: action.payload.id || uid(), kind: "dm", name, avatarUrl: action.payload.avatarUrl || `https://i.pravatar.cc/100?u=${encodeURIComponent(name + Date.now())}`, isOnline: true, lastSeen: "online", about: action.payload.about || "Hey there! I am using Oppty Chats.", contact: targetEmail || "Not available", blocked: false, hasLeft: false, disappearingMode: "off", isBroadcast: false, bookmarks: [], participants: targetEmail ? [currentEmail, targetEmail] : [currentEmail], messages: [], };
      const chats = [newChat, ...state.chats];
      saveChats(chats); return { chats };
    }

    case "ADD_GROUP": {
      const name = action.payload.name.trim(); if (!name) return state;
      const sysMsg = createSystemMessage(uid(), "You created this group");
      const adminMember = { id: currentUser?.id || uid(), name: currentUser?.name || "You", email: currentEmail, avatarUrl: currentUser?.avatarUrl, isAdmin: true };
      const newGroup = { id: sysMsg.chatId, kind: "group", name, avatarUrl: action.payload.avatarUrl || `https://i.pravatar.cc/100?u=${encodeURIComponent("group_" + name + Date.now())}`, isOnline: false, lastSeen: "", about: action.payload.about?.trim() || "New group created in Oppty Chats.", contact: action.payload.contact?.trim() || "Not available", isAdmin: true, blocked: false, hasLeft: false, disappearingMode: "off", isBroadcast: action.payload.isBroadcast ?? false, bookmarks: [], members: [adminMember], messages: [sysMsg], };
      const chats = [newGroup, ...state.chats];
      saveChats(chats); return { chats };
    }

    case "UPDATE_CHAT_NAME": {
      const name = action.name.trim(); if (!name) return state;
      const chats = state.chats.map((chat) => {
        if (String(chat.id) !== String(action.chatId)) return chat;
        let updatedChat = { ...chat, name };
        if (chat.kind === "group" && !chat.hasLeft) updatedChat.messages = [...chat.messages, createSystemMessage(chat.id, `You changed the subject to "${name}"`)];
        return updatedChat;
      });
      saveChats(chats); return { chats };
    }

    case "UPDATE_GROUP_ABOUT": {
      const about = action.about.trim();
      const chats = state.chats.map((chat) => {
        if (String(chat.id) !== String(action.chatId)) return chat;
        return { ...chat, about, messages: [...chat.messages, createSystemMessage(chat.id, "You changed the group description")] };
      });
      saveChats(chats); return { chats };
    }

    case "DELETE_CHAT": {
      const chats = state.chats.filter((chat) => String(chat.id) !== String(action.chatId));
      saveChats(chats); return { chats };
    }

    case "TOGGLE_BLOCK_CHAT": {
      const chats = state.chats.map((chat) => String(chat.id) === String(action.chatId) ? { ...chat, blocked: !chat.blocked } : chat);
      saveChats(chats); return { chats };
    }

    case "ADD_GROUP_MEMBER": {
      const chats = state.chats.map((chat) => {
        if (String(chat.id) !== String(action.chatId) || chat.kind !== "group") return chat;
        const exists = (chat.members || []).some((member) => String(member.id) === String(action.member.id));
        if (exists) return chat;
        return { ...chat, members: [...(chat.members || []), { ...action.member, isAdmin: false }], messages: [...chat.messages, createSystemMessage(chat.id, `You added ${action.member.name}`)] };
      });
      saveChats(chats); return { chats };
    }

    case "REMOVE_GROUP_MEMBER": {
      const chats = state.chats.map((chat) => {
        if (String(chat.id) !== String(action.chatId) || chat.kind !== "group") return chat;
        const memberToRemove = chat.members.find(m => String(m.id) === String(action.memberId));
        if (!memberToRemove) return chat;
        return { ...chat, members: chat.members.filter((m) => String(m.id) !== String(action.memberId)), messages: [...chat.messages, createSystemMessage(chat.id, `You removed ${memberToRemove.name}`)] };
      });
      saveChats(chats); return { chats };
    }

    case "PROMOTE_ADMIN": {
      const chats = state.chats.map((chat) => {
        if (String(chat.id) !== String(action.chatId) || chat.kind !== "group") return chat;
        const member = chat.members.find(m => String(m.id) === String(action.memberId));
        if (!member) return chat;
        return { ...chat, members: chat.members.map(m => String(m.id) === String(action.memberId) ? { ...m, isAdmin: true } : m), messages: [...chat.messages, createSystemMessage(chat.id, `You made ${member.name} a group admin`)] }
      });
      saveChats(chats); return { chats };
    }

    case "DEMOTE_ADMIN": {
      const chats = state.chats.map((chat) => {
        if (String(chat.id) !== String(action.chatId) || chat.kind !== "group") return chat;
        const member = chat.members.find(m => String(m.id) === String(action.memberId));
        if (!member) return chat;
        return { ...chat, members: chat.members.map(m => String(m.id) === String(action.memberId) ? { ...m, isAdmin: false } : m), messages: [...chat.messages, createSystemMessage(chat.id, `You dismissed ${member.name} as admin`)] }
      });
      saveChats(chats); return { chats };
    }

    case "LEAVE_GROUP": {
      const chats = state.chats.map((chat) => {
        if (String(chat.id) !== String(action.chatId) || chat.kind !== "group") return chat;
        return { ...chat, hasLeft: true, messages: [...chat.messages, createSystemMessage(chat.id, "You left")] }
      });
      saveChats(chats); return { chats };
    }

    default: return state;
  }
}

function ToastContainer({ toasts }) {
  return (
    <div className="globalToastContainer">
      {toasts.map(toast => (
        <div key={toast.id} className={`globalToast ${toast.type}`}>{toast.message}</div>
      ))}
    </div>
  );
}

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { chats: seed });
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  // --- NEW: THEME MANAGER (DARK MODE) ---
  const [theme, setTheme] = useState(() => localStorage.getItem("opty_theme") || "light");
  
  useEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
    localStorage.setItem("opty_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light");
  };

  // --- NEW: CHAT FILTER ENGINE ---
  const [chatFilter, setChatFilter] = useState("all"); // 'all', 'unread', 'mentions', 'groups'

  const currentUser = getAuthUser();
  const currentUserEmail = currentUser?.email;

  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 3000);
  };

  useEffect(() => {
    const persisted = loadChats();
    const merged = normalizeAndMerge(persisted);
    dispatch({ type: "INIT", chats: merged });
    saveChats(merged);
    const timer = setTimeout(() => setIsLoading(false), 600);
    const cleanupInterval = setInterval(() => { dispatch({ type: "CLEAN_EXPIRED" }); }, 60000);
    return () => { clearTimeout(timer); clearInterval(cleanupInterval); };
  }, []);

  const userSpecificChats = useMemo(() => {
    if (!currentUserEmail) return [];

    return state.chats
      .filter(chat => {
        if (chat.kind === "group") {
          return chat.members.some(m => m.email === currentUserEmail);
        }
        if (chat.kind === "dm") {
          if (chat.participants && chat.participants.length > 0) {
            return chat.participants.includes(currentUserEmail);
          }
          return true; 
        }
        return false;
      })
      .map(chat => {
        let updatedChat = { ...chat };
        let otherUserStatus = "available";
        
        if (chat.kind === "dm" && chat.participants) {
          const otherEmail = chat.participants.find(e => e !== currentUserEmail) || chat.contact;
          const otherUser = employeeDB.find(emp => emp.email === otherEmail);
          if (otherUser) {
            updatedChat.name = otherUser.name;
            updatedChat.avatarUrl = otherUser.avatarUrl;
            updatedChat.contact = otherUser.email;
            otherUserStatus = otherUser.status || "available";
          }
        }
        
        updatedChat.otherUserStatus = otherUserStatus;

        if (updatedChat.members) {
          updatedChat.members = updatedChat.members.map(m => {
            const dbEmp = employeeDB.find(e => e.email === m.email);
            return { ...m, status: dbEmp?.status || "available" };
          });
        }

        updatedChat.messages = chat.messages
          .filter(m => !(m.deletedFor || []).includes(currentUserEmail))
          .map(m => ({ ...m, isMine: m.sender === currentUserEmail || m.sender === "me" }));
        return updatedChat;
      });
  }, [state.chats, currentUserEmail]);

  // --- DERIVED FILTERED LIST FOR THE UI ---
  const displayChats = useMemo(() => {
    let list = userSpecificChats;
    if (chatFilter === "unread") {
      list = list.filter(c => c.messages.some(m => m.unread && !m.isMine));
    } else if (chatFilter === "groups") {
      list = list.filter(c => c.kind === "group");
    } else if (chatFilter === "mentions") {
       const myName = currentUser?.name || "";
       list = list.filter(c => c.messages.some(m => m.text?.includes(`@${myName}`)));
    }
    return list;
  }, [userSpecificChats, chatFilter, currentUser]);

  const api = useMemo(
    () => ({
      isLoading, showToast, 
      chats: userSpecificChats,
      displayChats, // Provide the filtered list to your ChatList component!
      chatFilter, setChatFilter, // For the filter pills
      theme, toggleTheme, // For Dark Mode
      getChatById: (id) => userSpecificChats.find((c) => String(c.id) === String(id)),
      sendMessage: (chatId, text, replyTo = null) => dispatch({ type: "SEND", chatId, text, replyTo }),
      sendThreadMessage: (chatId, messageId, text) => dispatch({ type: "SEND_THREAD_MESSAGE", chatId, messageId, text }),
      sendAttachment: (chatId, attachmentType, fileUrl, fileName, replyTo = null) => dispatch({ type: "SEND_ATTACHMENT", chatId, attachmentType, fileUrl, fileName, replyTo }),
      sendPoll: (chatId, question, options, allowMultiple) => dispatch({ type: "SEND_POLL", chatId, question, options, allowMultiple }),
      votePoll: (chatId, messageId, optionId) => dispatch({ type: "VOTE_POLL", chatId, messageId, optionId }),
      editMessage: (chatId, messageId, text) => dispatch({ type: "EDIT_MESSAGE", chatId, messageId, text }),
      toggleReaction: (chatId, messageId, emoji) => dispatch({ type: "TOGGLE_REACTION", chatId, messageId, emoji }),
      toggleStar: (chatId, messageId) => dispatch({ type: "TOGGLE_STAR", chatId, messageId }),
      togglePin: (chatId, messageId) => dispatch({ type: "TOGGLE_PIN", chatId, messageId }),
      deleteMessageForMe: (chatId, messageId) => dispatch({ type: "DELETE_MESSAGE_FOR_ME", chatId, messageId }),
      deleteMessageForAll: (chatId, messageId) => dispatch({ type: "DELETE_MESSAGE_FOR_ALL", chatId, messageId }),
      addContact: (payload) => dispatch({ type: "ADD_CONTACT", payload }),
      addGroup: (payload) => dispatch({ type: "ADD_GROUP", payload }),
      updateChatName: (chatId, name) => dispatch({ type: "UPDATE_CHAT_NAME", chatId, name }),
      updateGroupAbout: (chatId, about) => dispatch({ type: "UPDATE_GROUP_ABOUT", chatId, about }),
      addBookmark: (chatId, title, url) => dispatch({ type: "ADD_BOOKMARK", chatId, title, url }),
      removeBookmark: (chatId, bookmarkId) => dispatch({ type: "REMOVE_BOOKMARK", chatId, bookmarkId }),
      deleteChat: (chatId) => dispatch({ type: "DELETE_CHAT", chatId }),
      toggleBlockChat: (chatId) => dispatch({ type: "TOGGLE_BLOCK_CHAT", chatId }),
      setDisappearingMode: (chatId, mode) => dispatch({ type: "SET_DISAPPEARING_MODE", chatId, mode }),
      toggleBroadcastMode: (chatId) => dispatch({ type: "TOGGLE_BROADCAST_MODE", chatId }),
      addGroupMember: (chatId, member) => dispatch({ type: "ADD_GROUP_MEMBER", chatId, member }),
      removeGroupMember: (chatId, memberId) => dispatch({ type: "REMOVE_GROUP_MEMBER", chatId, memberId }),
      promoteAdmin: (chatId, memberId) => dispatch({ type: "PROMOTE_ADMIN", chatId, memberId }),
      demoteAdmin: (chatId, memberId) => dispatch({ type: "DEMOTE_ADMIN", chatId, memberId }),
      leaveGroup: (chatId) => dispatch({ type: "LEAVE_GROUP", chatId }),
      resetChats: () => dispatch({ type: "RESET" }),
      isAdmin: isSystemAdmin(),
    }),
    [userSpecificChats, displayChats, chatFilter, theme, isLoading]
  );

  return (
    <ChatContext.Provider value={api}>
      {children}
      <ToastContainer toasts={toasts} />
    </ChatContext.Provider>
  );
}

export function useChats() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChats must be used inside ChatProvider");
  return ctx;
}