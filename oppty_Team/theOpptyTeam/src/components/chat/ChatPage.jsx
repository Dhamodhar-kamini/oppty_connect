import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useChats } from "../../context/ChatContext.jsx";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import { employeeDB } from "../../data/employees";
import MessageBubble from "./MessageBubble.jsx";
import { getAuthUser } from "../../utils/auth.js";

try {
  const savedEmps = JSON.parse(localStorage.getItem("opty_employees"));
  if (savedEmps && Array.isArray(savedEmps) && savedEmps.length >= employeeDB.length) {
    employeeDB.length = 0; 
    employeeDB.push(...savedEmps); 
  }
} catch(e) {}

function formatDay(ts) {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function HighlightText({ text, query }) {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${escapeRegExp(query.trim())})`, "gi");
  const parts = String(text).split(regex);
  return parts.map((part, index) => regex.test(part) ? <mark key={`${part}-${index}`} className="chatSearchHighlight">{part}</mark> : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>);
}
function isLink(text) { return /^https?:\/\//i.test(text || ""); }

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMediaQuery("(min-width: 900px)");

  const {
    chats, getChatById, sendMessage, sendThreadMessage, sendAttachment, sendPoll, votePoll, editMessage, toggleReaction, toggleStar, togglePin,
    updateChatName, updateGroupAbout, deleteChat, toggleBlockChat, addGroupMember, removeGroupMember,
    promoteAdmin, demoteAdmin, leaveGroup, deleteMessageForMe, deleteMessageForAll, setDisappearingMode, toggleBroadcastMode, addContact, addBookmark, removeBookmark, isAdmin, isLoading, showToast
  } = useChats();

  const chat = chatId ? getChatById(chatId) : null;
  const authUser = getAuthUser();

  const isGroupAdmin = useMemo(() => {
    if (chat?.kind !== "group") return false;
    const me = chat.members?.find(m => m.email === authUser?.email);
    return me?.isAdmin === true;
  }, [chat, authUser]);

  const canEditGroupInfo = chat?.kind === "group" ? (isAdmin || isGroupAdmin) : true;
  const isBroadcast = chat?.isBroadcast === true;
  const canPost = !chat?.hasLeft && (!isBroadcast || isGroupAdmin || isAdmin);

  const [drafts, setDrafts] = useState({});
  const text = drafts[chatId] || "";
  const setText = (val) => setDrafts((prev) => ({ ...prev, [chatId]: val }));

  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSender, setFilterSender] = useState("");
  const [filterDate, setFilterDate] = useState("");
  
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);

  const [activeThreadMsgId, setActiveThreadMsgId] = useState(null);
  const [threadText, setThreadText] = useState("");

  const [showAddBookmark, setShowAddBookmark] = useState(false);
  const [bookmarkTitle, setBookmarkTitle] = useState("");
  const [bookmarkUrl, setBookmarkUrl] = useState("");

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [draftAbout, setDraftAbout] = useState("");

  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [groupMemberFilter, setGroupMemberFilter] = useState("");
  const [previewMedia, setPreviewMedia] = useState("");

  const [showMediaPanel, setShowMediaPanel] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState("media");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showStickerMenu, setShowStickerMenu] = useState(false);

  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [forwardSelectedChats, setForwardSelectedChats] = useState([]); // ADDED FOR MULTI-FORWARD
  const [deletePrompt, setDeletePrompt] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  
  const [isTyping, setIsTyping] = useState(false);
  const [mentionState, setMentionState] = useState({ active: false, query: "", startIndex: -1, selectedIndex: 0 });

  const endRef = useRef(null);
  const optionsRef = useRef(null);
  const searchInputRef = useRef(null);
  const editNameInputRef = useRef(null);
  const editAboutInputRef = useRef(null);
  const messageRefs = useRef({});
  const composerInputRef = useRef(null);

  const addMemberSearchRef = useRef(null);
  const membersFilterRef = useRef(null);
  const addMemberSectionRef = useRef(null);
  const membersListSectionRef = useRef(null);

  const attachMenuRef = useRef(null);
  const stickerMenuRef = useRef(null);
  const attachBtnRef = useRef(null);
  const stickerBtnRef = useRef(null);
  const imageInputRef = useRef(null);
  const documentInputRef = useRef(null);

  const stickerOptions = ["😀", "😂", "😍", "🔥", "🎉", "❤️", "👍", "🙏", "😎", "🥳"];

  const canSend = text.trim().length > 0;
  const memberCount = chat?.kind === "group" ? chat.members?.length || 0 : 0;

  const toggleSelection = (msgId) => { setSelectedMessages(prev => prev.includes(msgId) ? prev.filter(id => id !== msgId) : [...prev, msgId]); };

  useEffect(() => { if (selectedMessages.length === 0 && selectionMode) setSelectionMode(false); }, [selectedMessages, selectionMode]);

  const pinnedMessages = chat?.messages?.filter(m => m.isPinned && !m.deletedForAll) || [];
  const firstUnreadId = useMemo(() => { if (!chat) return null; const unreadMsg = chat.messages.find((m) => m.unread && !m.isMine); return unreadMsg ? unreadMsg.id : null; }, [chat]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetMsgId = params.get("msg");
    if (targetMsgId && chat) { setTimeout(() => { handleScrollToMessage(targetMsgId); }, 400); }
  }, [location.search, chat]);

  const availableEmployees = useMemo(() => {
    if (!chat || chat.kind !== "group") return [];
    const memberIds = new Set((chat.members || []).map((m) => String(m.id)));
    const q = memberSearch.trim().toLowerCase();
    return employeeDB.filter((emp) => emp.role === "employee").filter((emp) => !memberIds.has(String(emp.id))).filter((emp) => q ? `${emp.name} ${emp.email}`.toLowerCase().includes(q) : true);
  }, [chat, memberSearch]);

  const filteredGroupMembers = useMemo(() => {
    if (!chat || chat.kind !== "group") return [];
    const q = groupMemberFilter.trim().toLowerCase();
    return (chat.members || []).filter((member) => q ? `${member.name} ${member.email}`.toLowerCase().includes(q) : true);
  }, [chat, groupMemberFilter]);

  const filteredMentionMembers = useMemo(() => {
    if (!mentionState.active || chat?.kind !== "group") return [];
    const q = mentionState.query.toLowerCase();
    return (chat.members || []).filter(m => m.name && m.name.toLowerCase().includes(q));
  }, [mentionState, chat]);

  const matchedMessages = useMemo(() => {
    if (!chat?.messages?.length) return [];
    if (!searchTerm.trim() && !filterSender && !filterDate) return [];
    const q = searchTerm.trim().toLowerCase();
    return chat.messages.filter((m) => {
      if (m.type === "system") return false;
      let matchText = true;
      if (q) {
        const textMatch = m.text ? m.text.toLowerCase().includes(q) : false;
        const fileMatch = m.fileName ? m.fileName.toLowerCase().includes(q) : false;
        const senderMatch = m.senderName ? m.senderName.toLowerCase().includes(q) : false;
        matchText = textMatch || fileMatch || senderMatch;
      }
      let matchSender = true;
      if (filterSender) {
         if (filterSender === "me") matchSender = m.isMine;
         else matchSender = m.senderName === chat.members.find(x => String(x.id) === String(filterSender))?.name;
      }
      let matchDate = true;
      if (filterDate) matchDate = new Date(m.createdAt).toDateString() === new Date(filterDate).toDateString();
      return matchText && matchSender && matchDate;
    });
  }, [chat, searchTerm, filterSender, filterDate]);

  const groups = useMemo(() => {
    if (!chat?.messages?.length) return [];
    const map = new Map();
    for (const m of chat.messages) {
      const day = formatDay(m.createdAt);
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(m);
    }
    return Array.from(map.entries()).map(([day, messages]) => ({ day, messages }));
  }, [chat]);

  const uploadedMediaItems = useMemo(() => { return (chat?.messages || []).filter((m) => m.type === "image"); }, [chat]);
  const uploadedDocItems = useMemo(() => { return (chat?.messages || []).filter((m) => m.type === "document"); }, [chat]);
  const linkItems = useMemo(() => { return (chat?.messages || []).filter((m) => isLink(m.text)); }, [chat]);

  const mediaItems = uploadedMediaItems;
  const docItems = uploadedDocItems;
  const totalSharedCount = mediaItems.length + docItems.length + linkItems.length;

  const commonGroups = useMemo(() => {
    if (!chat || chat.kind !== "dm") return [];
    const targetEmail = chat.contact;
    if (!targetEmail || targetEmail === "Not available") return [];
    
    return chats.filter(c => {
      if (c.kind !== "group") return false;
      return c.members?.some(m => m.email === targetEmail);
    });
  }, [chat, chats]);

  const isOtherUserDND = chat?.kind === 'dm' && chat?.otherUserStatus === 'dnd';

  const activeThreadMsg = useMemo(() => {
    if (!chat || !activeThreadMsgId) return null;
    return chat.messages.find(m => m.id === activeThreadMsgId);
  }, [chat, activeThreadMsgId]);

  const handleStartDirectMessage = (empEmail) => {
    if (empEmail === authUser?.email) return; 
    const emp = employeeDB.find(e => e.email === empEmail);
    if (!emp) return;

    const existingChat = chats.find(c => c.kind === "dm" && c.participants?.includes(emp.email));
    if (existingChat) {
      handleCloseChatInfo(); navigate(`/chats/${existingChat.id}`);
    } else {
      const newChatId = `dm_${Date.now()}`;
      addContact({ id: newChatId, name: emp.name, contact: emp.email, avatarUrl: emp.avatarUrl, about: emp.role === "admin" ? "Admin Account" : "Available for chat" });
      handleCloseChatInfo(); navigate(`/chats/${newChatId}`);
    }
  };

  useEffect(() => {
    setReplyingTo(null); setEditingMessage(null); setSelectionMode(false); setSelectedMessages([]);
    setSearchOpen(false); setSearchTerm(""); setFilterSender(""); setFilterDate("");
    setMentionState({ active: false, query: "", startIndex: -1, selectedIndex: 0 });
    setActiveThreadMsgId(null);
    
    if (chat && chat.isOnline) { setIsTyping(true); const t = setTimeout(() => setIsTyping(false), 3000); return () => clearTimeout(t); } 
    else { setIsTyping(false); }
  }, [chatId]);

  useEffect(() => { if (!new URLSearchParams(location.search).has("msg")) endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatId, chat?.messages?.length, location.search]);
  useEffect(() => { if (searchOpen) searchInputRef.current?.focus(); }, [searchOpen]);
  useEffect(() => { if (isEditingName) editNameInputRef.current?.focus(); }, [isEditingName]);
  useEffect(() => { if (isEditingAbout) editAboutInputRef.current?.focus(); }, [isEditingAbout]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target)) setShowOptionsMenu(false);
      if (showAttachMenu && attachMenuRef.current && !attachMenuRef.current.contains(event.target) && attachBtnRef.current && !attachBtnRef.current.contains(event.target)) setShowAttachMenu(false);
      if (showStickerMenu && stickerMenuRef.current && !stickerMenuRef.current.contains(event.target) && stickerBtnRef.current && !stickerBtnRef.current.contains(event.target)) setShowStickerMenu(false);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowOptionsMenu(false); setShowChatInfo(false); setIsEditingName(false); setIsEditingAbout(false); setPreviewMedia(""); setShowMediaPanel(false); setShowAttachMenu(false); setShowStickerMenu(false); 
        setForwardingMessage(null); 
        setForwardSelectedChats([]); // ADDED FOR MULTI-FORWARD
        setDeletePrompt(null); setShowPollModal(false); setActiveThreadMsgId(null);
        if (mentionState.active) setMentionState(p => ({ ...p, active: false }));
        if (selectionMode) { setSelectionMode(false); setSelectedMessages([]); }
        if (searchOpen) { setSearchOpen(false); setSearchTerm(""); setFilterSender(""); setFilterDate(""); setActiveSearchIndex(0); }
      }
    };
    document.addEventListener("mousedown", handleClickOutside); document.addEventListener("keydown", handleEscape);
    return () => { document.removeEventListener("mousedown", handleClickOutside); document.removeEventListener("keydown", handleEscape); };
  }, [searchOpen, showAttachMenu, showStickerMenu, selectionMode, mentionState.active]);

  useEffect(() => {
    if (!matchedMessages.length) { setActiveSearchIndex(0); return; }
    if (activeSearchIndex >= matchedMessages.length) setActiveSearchIndex(0);
  }, [matchedMessages, activeSearchIndex]);

  useEffect(() => {
    if (!matchedMessages.length) return;
    const currentMatch = matchedMessages[activeSearchIndex];
    const node = messageRefs.current[currentMatch.id];
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeSearchIndex, matchedMessages]);

  if (!chat) {
    return (
      <div className="chatEmpty animatedFadeIn">
        <div className="chatEmptyIllustration">
          <svg viewBox="0 0 200 200" fill="none" width="160" height="160">
            <rect x="20" y="40" width="160" height="120" rx="16" fill="#e7fce3" />
            <path d="M60 80h80M60 110h50" stroke="#00a884" strokeWidth="8" strokeLinecap="round" />
            <circle cx="150" cy="120" r="24" fill="#ffb36b" />
            <path d="M142 120l5 5 10-10" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="chatEmptyTitle">Oppty Chats for Web</div>
        <div className="muted chatEmptySubtitle">Select a chat to start messaging or create a new conversation from the sidebar.</div>
      </div>
    );
  }

  const handleTextInput = (e) => {
    const val = e.target.value; setText(val);
    e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
    if (chat?.kind === "group") {
      const cursor = e.target.selectionStart;
      const textBeforeCursor = val.slice(0, cursor);
      const match = textBeforeCursor.match(/(?:^|\s)@([^ \n]*)$/);
      if (match) setMentionState({ active: true, query: match[1].toLowerCase(), startIndex: cursor - match[1].length, selectedIndex: 0 });
      else setMentionState((prev) => prev.active ? { ...prev, active: false } : prev);
    }
  };

  const insertMention = (member) => {
    if (!member) return;
    const beforeAt = text.slice(0, mentionState.startIndex - 1); 
    const afterCursor = text.slice(composerInputRef.current.selectionStart);
    const newText = `${beforeAt}@${member.name} ${afterCursor}`;
    setText(newText); setMentionState({ active: false, query: "", startIndex: -1, selectedIndex: 0 });
    setTimeout(() => { if (composerInputRef.current) { composerInputRef.current.focus(); const newCursorPos = beforeAt.length + member.name.length + 2; composerInputRef.current.setSelectionRange(newCursorPos, newCursorPos); }}, 0);
  };

  const handleKeyDown = (e) => {
    if (mentionState.active && filteredMentionMembers.length > 0) {
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionState(p => ({ ...p, selectedIndex: Math.max(0, p.selectedIndex - 1) })); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionState(p => ({ ...p, selectedIndex: Math.min(filteredMentionMembers.length - 1, p.selectedIndex + 1) })); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(filteredMentionMembers[mentionState.selectedIndex]); return; }
      if (e.key === "Escape") { setMentionState(p => ({ ...p, active: false })); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  const onSend = () => {
    const v = text.trim(); if (!v || chat.blocked || !canPost) return;
    if (editingMessage) { editMessage(chat.id, editingMessage.id, v); setEditingMessage(null); } 
    else { sendMessage(chat.id, v, replyingTo); }
    setText(""); setReplyingTo(null); setShowAttachMenu(false); setShowStickerMenu(false);
    if (composerInputRef.current) composerInputRef.current.style.height = "auto";
  };

  const onSendThread = () => {
    const v = threadText.trim(); if (!v || !activeThreadMsgId) return;
    sendThreadMessage(chat.id, activeThreadMsgId, v);
    setThreadText("");
  };

  const handleSaveBookmark = () => {
    if (!bookmarkTitle.trim() || !bookmarkUrl.trim()) return;
    let finalUrl = bookmarkUrl.trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = `https://${finalUrl}`;
    addBookmark(chat.id, bookmarkTitle.trim(), finalUrl);
    setBookmarkTitle(""); setBookmarkUrl(""); setShowAddBookmark(false); showToast("Bookmark added");
  };

  const handleAttachmentAction = (type) => {
    if (chat.blocked || !canPost) return;
    if (type === "image") imageInputRef.current?.click();
    else if (type === "document") documentInputRef.current?.click();
    else if (type === "contact") { setText((prev) => `${prev}${prev ? " " : ""}[Shared Contact]`); setShowAttachMenu(false); }
  };

  const handleImageSelected = (e) => {
    const file = e.target.files?.[0]; if (!file || chat.blocked || !canPost) return;
    sendAttachment(chat.id, "image", URL.createObjectURL(file), file.name, replyingTo);
    setReplyingTo(null); setShowAttachMenu(false); e.target.value = "";
  };

  const handleDocumentSelected = (e) => {
    const file = e.target.files?.[0]; if (!file || chat.blocked || !canPost) return;
    sendAttachment(chat.id, "document", URL.createObjectURL(file), file.name, replyingTo);
    setReplyingTo(null); setShowAttachMenu(false); e.target.value = "";
  };

  const handleStickerSelect = (sticker) => {
    if (chat.blocked || !canPost) return;
    setText((prev) => `${prev}${prev ? " " : ""}${sticker}`); setShowStickerMenu(false);
  };

  const handleAddPollOption = () => { setPollOptions(prev => [...prev, ""]); };
  const handlePollOptionChange = (index, val) => { const newOptions = [...pollOptions]; newOptions[index] = val; setPollOptions(newOptions); };
  const handleRemovePollOption = (index) => { if (pollOptions.length <= 2) return; setPollOptions(prev => prev.filter((_, i) => i !== index)); };
  const handleSendPoll = () => {
    if (!pollQuestion.trim()) return;
    const validOptions = pollOptions.filter(opt => opt.trim());
    if (validOptions.length < 2) return;
    sendPoll(chat.id, pollQuestion, validOptions, pollAllowMultiple);
    setShowPollModal(false); setPollQuestion(""); setPollOptions(["", ""]); setPollAllowMultiple(false); setShowAttachMenu(false);
  };

  const handleOpenSearch = () => { setSearchOpen(true); setShowOptionsMenu(false); };
  const handleCloseSearch = () => { setSearchOpen(false); setSearchTerm(""); setFilterSender(""); setFilterDate(""); setActiveSearchIndex(0); };
  const handleNextMatch = () => { if (matchedMessages.length) setActiveSearchIndex((prev) => (prev + 1) % matchedMessages.length); };
  const handlePrevMatch = () => { if (matchedMessages.length) setActiveSearchIndex((prev) => prev === 0 ? matchedMessages.length - 1 : prev - 1); };
  const handleToggleOptions = () => setShowOptionsMenu((prev) => !prev);
  const handleScrollToLatest = () => { endRef.current?.scrollIntoView({ behavior: "smooth" }); setShowOptionsMenu(false); };

  const handleOpenChatInfo = () => { setShowChatInfo(true); setShowOptionsMenu(false); setEditedName(chat.name || ""); setIsEditingName(false); setDraftAbout(chat.about || ""); setIsEditingAbout(false); setShowAddBookmark(false); };
  const handleCloseChatInfo = () => { setShowChatInfo(false); setIsEditingName(false); setIsEditingAbout(false); setEditedName(chat.name || ""); setDraftAbout(chat.about || ""); setSelectedMemberId(""); setMemberSearch(""); setGroupMemberFilter(""); };

  const handleStartEditName = () => { if (canEditGroupInfo) { setEditedName(chat.name || ""); setIsEditingName(true); }};
  const handleCancelEditName = () => { setIsEditingName(false); setEditedName(chat.name || ""); };
  const handleSaveEditName = () => { const trimmed = editedName.trim(); if (!trimmed || !canEditGroupInfo) return; updateChatName(chat.id, trimmed); setIsEditingName(false); showToast("Group name updated"); };

  const handleStartEditAbout = () => { if (canEditGroupInfo) { setDraftAbout(chat.about || ""); setIsEditingAbout(true); }};
  const handleCancelEditAbout = () => { setIsEditingAbout(false); setDraftAbout(chat.about || ""); };
  const handleSaveEditAbout = () => { const trimmed = draftAbout.trim(); if (!trimmed || !canEditGroupInfo) return; updateGroupAbout(chat.id, trimmed); setIsEditingAbout(false); showToast("Group description updated"); };

  const handleDeleteChat = () => { deleteChat(chat.id); setShowOptionsMenu(false); setShowChatInfo(false); navigate(chat.kind === "group" ? "/groups" : "/chats"); showToast(chat.kind === "group" ? "Group deleted" : "Contact deleted"); };
  const handleToggleBlock = () => { toggleBlockChat(chat.id); setShowOptionsMenu(false); showToast(chat.blocked ? "Chat unblocked" : "Chat blocked"); };
  const handleLeaveGroup = () => { leaveGroup(chat.id); setShowOptionsMenu(false); setShowChatInfo(false); showToast("You left the group"); };

  const handleAddMember = () => {
    if (!canEditGroupInfo || chat.kind !== "group" || !selectedMemberId) return;
    const employee = employeeDB.find((emp) => String(emp.id) === String(selectedMemberId));
    if (!employee) return;
    addGroupMember(chat.id, { id: employee.id, name: employee.name, email: employee.email, avatarUrl: employee.avatarUrl });
    setSelectedMemberId(""); setMemberSearch(""); showToast("Member added");
  };

  const handleRemoveMember = (memberId) => { if (canEditGroupInfo && chat.kind === "group") { removeGroupMember(chat.id, memberId); showToast("Member removed"); } };
  const handlePromoteAdmin = (memberId) => { if (canEditGroupInfo && chat.kind === "group") { promoteAdmin(chat.id, memberId); showToast("Admin promoted"); } };
  const handleDemoteAdmin = (memberId) => { if (canEditGroupInfo && chat.kind === "group") { demoteAdmin(chat.id, memberId); showToast("Admin demoted"); } };

  const handleFocusAddMember = () => { if (canEditGroupInfo) { addMemberSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => addMemberSearchRef.current?.focus(), 250); }};
  const handleFocusMemberSearch = () => { membersListSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => membersFilterRef.current?.focus(), 250); };

  const handleReplyMessage = (message) => { setReplyingTo(message); setEditingMessage(null); setActiveThreadMsgId(null); };
  const handleEditMessage = (message) => { setEditingMessage(message); setText(message.text); setReplyingTo(null); setActiveThreadMsgId(null); if (composerInputRef.current) { composerInputRef.current.style.height = "auto"; composerInputRef.current.style.height = Math.min(composerInputRef.current.scrollHeight, 120) + "px"; } };

  // ADDED FOR MULTI-FORWARD
  const toggleForwardSelection = (cId) => {
    setForwardSelectedChats(prev => prev.includes(cId) ? prev.filter(id => id !== cId) : [...prev, cId]);
  };

  // ADDED FOR MULTI-FORWARD
  const handleMultiForwardSubmit = () => {
    if (!forwardingMessage || forwardSelectedChats.length === 0) return;
    const messagesToForward = Array.isArray(forwardingMessage) ? forwardingMessage : [forwardingMessage];
    
    forwardSelectedChats.forEach(targetChatId => {
      messagesToForward.forEach(msg => { 
        if (msg.type === "text") sendMessage(targetChatId, msg.text); 
        else sendAttachment(targetChatId, msg.type, msg.fileUrl, msg.fileName); 
      });
    });
    
    setForwardingMessage(null); 
    setForwardSelectedChats([]); 
    setSelectionMode(false); 
    setSelectedMessages([]); 
    showToast(`Forwarded to ${forwardSelectedChats.length} chat${forwardSelectedChats.length > 1 ? 's' : ''}`);
  };

  const confirmDelete = () => {
    if (!deletePrompt) return;
    if (deletePrompt.type === 'me') deleteMessageForMe(chat.id, deletePrompt.id);
    if (deletePrompt.type === 'all') deleteMessageForAll(chat.id, deletePrompt.id);
    setDeletePrompt(null); setSelectionMode(false); setSelectedMessages([]); showToast("Messages deleted");
  };

  const handleScrollToMessage = (msgId) => {
    const node = messageRefs.current[msgId];
    if (node) { node.scrollIntoView({ behavior: "smooth", block: "center" }); node.classList.add("chatMatchedMessageActive"); setTimeout(() => node.classList.remove("chatMatchedMessageActive"), 1500); }
  };

  return (
    <div className="chat">
      <header className={`chatHeader ${selectionMode ? 'selectionModeActive' : ''}`}>
        {selectionMode ? (
          <div className="selectionHeaderContent">
            <button className="iconBtn" onClick={() => {setSelectionMode(false); setSelectedMessages([]);}}>✕</button>
            <span className="selectionCount">{selectedMessages.length} selected</span>
            <div className="selectionActions">
              <button className="iconBtn" title="Star" onClick={() => { selectedMessages.forEach(id => toggleStar(chat.id, id)); setSelectionMode(false); setSelectedMessages([]); }}>⭐</button>
              <button className="iconBtn" title="Delete" onClick={() => setDeletePrompt({ id: selectedMessages, type: 'me' })}>🗑️</button>
              <button className="iconBtn" title="Forward" onClick={() => { const msgs = chat.messages.filter(m => selectedMessages.includes(m.id)); setForwardingMessage(msgs); }}>↪</button>
            </div>
          </div>
        ) : (
          <>
            {!isDesktop && <button className="iconBtn" onClick={() => navigate("..", { relative: "path" })} aria-label="Back">←</button>}
            <button type="button" className="chatProfileTrigger" onClick={handleOpenChatInfo} aria-label="Open profile info" title="View profile"><img className="avatar" src={chat.avatarUrl} alt={chat.name} /></button>
            
            <button type="button" className="chatHeaderIdentity" onClick={handleOpenChatInfo} aria-label="Open profile information" title="View profile">
              <div className="chatHeaderText">
                <div className="chatHeaderName">
                  {chat.name} 
                  {chat.isBroadcast && <span className="broadcastBadge">📢 Announcement</span>}
                </div>
                <div className="chatHeaderMeta">
                  {isTyping ? (<span className="typingIndicator">{chat.kind === 'group' ? "Someone is typing..." : "typing..."}</span>) 
                  : chat.kind === "group" ? (`${memberCount} member${memberCount !== 1 ? "s" : ""}`) 
                  : chat.blocked ? ("blocked") 
                  : (
                    <span className="userStatusText">
                      {chat.otherUserStatus === 'dnd' ? '🔴 Do Not Disturb' : chat.otherUserStatus === 'meeting' ? '🗓️ In a Meeting' : '🟢 Available'}
                    </span>
                  )}
                </div>
              </div>
            </button>

            <div className="chatHeaderActions" ref={optionsRef}>
              <button className="iconBtn" onClick={handleOpenSearch}>⌕</button>
              <button className="iconBtn" onClick={handleToggleOptions}>⋯</button>
              {showOptionsMenu && (
                <div className="chatOptionsMenu">
                  <button type="button" className="chatOptionsItem" onClick={handleOpenChatInfo}>View chat info</button>
                  <button type="button" className="chatOptionsItem" onClick={() => {setSelectionMode(true); setShowOptionsMenu(false);}}>Select messages</button>
                  <button type="button" className="chatOptionsItem" onClick={handleCloseSearch}>Clear search</button>
                  <button type="button" className="chatOptionsItem" onClick={handleScrollToLatest}>Scroll to latest</button>
                  
                  {chat.kind === "dm" && (
                    <button type="button" className="chatOptionsItem chatOptionsItemDanger" onClick={handleDeleteChat}>Delete Contact</button>
                  )}
                  {chat.kind === "group" && (
                    <>
                      {!chat.hasLeft ? (
                         <button type="button" className="chatOptionsItem chatOptionsItemDanger" onClick={handleLeaveGroup}>Exit Group</button>
                      ) : (
                         <button type="button" className="chatOptionsItem chatOptionsItemDanger" onClick={handleDeleteChat}>Delete Group</button>
                      )}
                    </>
                  )}
                  <button type="button" className="chatOptionsItem" onClick={() => setShowOptionsMenu(false)}>Close</button>
                </div>
              )}
            </div>
          </>
        )}
      </header>

      {!selectionMode && pinnedMessages.length > 0 && (
        <div className="pinnedMessagesBanner animatedFadeIn" onClick={() => handleScrollToMessage(pinnedMessages[0].id)}>
          <div className="pinnedIcon">📌</div>
          <div className="pinnedContent">
            <div className="pinnedTitle">Pinned Message</div>
            <div className="pinnedSnippet">{pinnedMessages[0].text || "Attachment"}</div>
          </div>
        </div>
      )}

      {searchOpen && (
        <div className="chatSearchContainer animatedFadeIn">
          <div className="chatSearchBar">
            <input ref={searchInputRef} type="text" className="chatSearchInput" placeholder="Search in this chat" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setActiveSearchIndex(0); }} />
            <div className="chatSearchMeta">
              <span className="chatSearchCount">{matchedMessages.length ? `${activeSearchIndex + 1}/${matchedMessages.length}` : "0/0"}</span>
              <button type="button" className="iconBtn" onClick={handlePrevMatch} disabled={!matchedMessages.length}>↑</button>
              <button type="button" className="iconBtn" onClick={handleNextMatch} disabled={!matchedMessages.length}>↓</button>
              <button type="button" className="iconBtn" onClick={handleCloseSearch}>✕</button>
            </div>
          </div>
          <div className="chatSearchAdvancedFilters">
            {chat.kind === "group" && (
              <select className="chatSearchFilterSelect" value={filterSender} onChange={(e) => setFilterSender(e.target.value)}>
                <option value="">All senders</option>
                <option value="me">You</option>
                {chat.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
            <input type="date" className="chatSearchFilterDate" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} title="Jump to date" />
          </div>
        </div>
      )}

      {showChatInfo && (
        <div className="chatInfoOverlay" onClick={handleCloseChatInfo}>
          <aside className="chatInfoDrawer whatsappGroupInfoDrawer" onClick={(e) => e.stopPropagation()}>
            <div className="chatInfoDrawerHeader whatsappGroupInfoHeader"><button type="button" className="iconBtn" onClick={handleCloseChatInfo}>←</button><div className="chatInfoDrawerTitle">{chat.kind === "group" ? "Group info" : "Contact info"}</div></div>
            <div className="whatsappGroupTopCard">
              <img className="whatsappGroupAvatar" src={chat.avatarUrl} alt={chat.name} />
              {!isEditingName ? (
                <><div className="whatsappGroupNameRow"><div className="whatsappGroupName">{chat.name}</div>{canEditGroupInfo && (<button type="button" className="groupInlineEditBtn" onClick={handleStartEditName}>✎</button>)}</div>{chat.kind === "group" ? (<div className="whatsappGroupMeta">Group · {memberCount} member{memberCount !== 1 ? "s" : ""}</div>) : (<div className="whatsappGroupMeta">{chat.blocked ? "Blocked" : chat.isOnline ? "online" : chat.lastSeen ? chat.lastSeen : "offline"}</div>)}</>
              ) : (
                <div className="chatEditNameBox"><input ref={editNameInputRef} type="text" className="chatEditNameInput" value={editedName} onChange={(e) => setEditedName(e.target.value)} placeholder={chat.kind === "group" ? "Enter group name" : "Enter name"} onKeyDown={(e) => { if (e.key === "Enter") handleSaveEditName(); }} /><div className="chatEditNameActions"><button type="button" className="popup-btn popup-btn-secondary" onClick={handleCancelEditName}>Cancel</button><button type="button" className="popup-btn popup-btn-danger" onClick={handleSaveEditName} disabled={!editedName.trim()}>Save</button></div></div>
              )}

              {chat.kind === "group" && (
                <>
                  {canEditGroupInfo && (<div className="groupQuickActions"><button type="button" className="groupQuickActionBtn" onClick={handleFocusAddMember}><span>👤+</span><span>Add</span></button><button type="button" className="groupQuickActionBtn" onClick={handleFocusMemberSearch}><span>🔍</span><span>Search</span></button></div>)}
                  <div className="groupDescriptionCard">
                    <div className="groupSectionLabel">Add group description</div>
                    {!isEditingAbout ? (
                      <div className="groupSectionValue">{chat.about || "No description added yet."}{canEditGroupInfo && (<button type="button" className="groupInlineEditBtn" style={{marginLeft: 8}} onClick={handleStartEditAbout}>✎</button>)}</div>
                    ) : (
                      <div className="chatEditNameBox"><input ref={editAboutInputRef} type="text" className="chatEditNameInput" value={draftAbout} onChange={(e) => setDraftAbout(e.target.value)} placeholder="Group description..." onKeyDown={(e) => { if (e.key === "Enter") handleSaveEditAbout(); }} /><div className="chatEditNameActions"><button type="button" className="popup-btn popup-btn-secondary" onClick={handleCancelEditAbout}>Cancel</button><button type="button" className="popup-btn popup-btn-danger" onClick={handleSaveEditAbout} disabled={!draftAbout.trim()}>Save</button></div></div>
                    )}
                  </div>
                  
                  <div className="groupDescriptionCard" style={{marginTop: 10}}>
                    <div className="groupSectionLabel" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <span>Saved Bookmarks</span>
                      {canEditGroupInfo && !showAddBookmark && (
                        <button type="button" className="groupInlineEditBtn" style={{fontSize: 18, padding: 0}} onClick={() => setShowAddBookmark(true)}>+</button>
                      )}
                    </div>
                    {showAddBookmark && (
                      <div className="chatEditNameBox" style={{marginTop: 8}}>
                        <input type="text" className="profile-input" value={bookmarkTitle} onChange={(e) => setBookmarkTitle(e.target.value)} placeholder="Link Title (e.g. Jira Board)" style={{marginBottom: 6}} />
                        <input type="text" className="profile-input" value={bookmarkUrl} onChange={(e) => setBookmarkUrl(e.target.value)} placeholder="URL (https://...)" />
                        <div className="chatEditNameActions" style={{marginTop: 8}}>
                          <button type="button" className="popup-btn popup-btn-secondary" onClick={() => setShowAddBookmark(false)}>Cancel</button>
                          <button type="button" className="popup-btn popup-btn-danger" onClick={handleSaveBookmark} disabled={!bookmarkTitle.trim() || !bookmarkUrl.trim()}>Save</button>
                        </div>
                      </div>
                    )}
                    {(!chat.bookmarks || chat.bookmarks.length === 0) && !showAddBookmark ? (
                      <div className="muted" style={{fontSize: 13, marginTop: 4}}>No bookmarks saved yet.</div>
                    ) : (
                      <div className="bookmarkList">
                        {chat.bookmarks?.map(b => (
                          <div key={b.id} className="bookmarkCard">
                            <a href={b.url} target="_blank" rel="noreferrer" className="bookmarkLink">📌 {b.title}</a>
                            {canEditGroupInfo && (
                              <button className="iconBtn" style={{padding: 2, margin: 0, opacity: 0.6}} onClick={() => removeBookmark(chat.id, b.id)}>✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="groupCreatedMeta">Group created by +91 78934 58943, on 2/24/2026 at 11:44 AM</div>
                </>
              )}

              {chat.kind !== "group" && (
                <div className="chatInfoSection chatInfoSectionContactOnly">
                  <div className="chatInfoCardRow"><span className="chatInfoLabel">About</span><strong className="chatInfoValue">{chat.about || "Hey there! I am using Oppty Chats."}</strong></div>
                  <div className="chatInfoCardRow"><span className="chatInfoLabel">Phone / Email</span><strong className="chatInfoValue">{chat.contact || chat.email || "Not available"}</strong></div>
                  <div className="groupInfoSectionCard mediaLinksDocsCard" onClick={() => setShowMediaPanel(true)} role="button" tabIndex={0}><div className="groupInfoSectionTop"><div className="groupInfoSectionTitle">Media, links and docs</div><div className="groupInfoSectionCount">{totalSharedCount}</div></div><div className="groupMediaPreviewRow">{mediaItems.slice(0, 2).map((item) => (<button key={item.id} type="button" className="groupMediaPreviewItem" onClick={(e) => { e.stopPropagation(); if (item.fileUrl && item.fileUrl !== "#") setPreviewMedia(item.fileUrl); }}><img src={item.fileUrl} alt={item.fileName} /></button>))}</div></div>
                  
                  {commonGroups.length > 0 && (
                    <div className="groupInfoSectionCard mediaLinksDocsCard">
                      <div className="groupInfoSectionTop" style={{marginBottom: 8}}>
                        <div className="groupInfoSectionTitle">{commonGroups.length} group{commonGroups.length > 1 ? 's' : ''} in common</div>
                      </div>
                      <div className="groupMembersListWhatsapp" style={{margin: '0 -16px'}}>
                        {commonGroups.map(grp => {
                          const memberNames = grp.members.map(m => m.email === authUser?.email ? 'You' : m.name).join(', ');
                          return (
                            <div key={grp.id} className="groupMemberWhatsappItem" onClick={() => { handleCloseChatInfo(); navigate(`/groups/${grp.id}`); }} style={{ cursor: 'pointer', border: 'none' }}>
                              <div className="groupMemberInfoWrap">
                                <img src={grp.avatarUrl || "https://i.pravatar.cc/100"} alt={grp.name} className="groupMemberAvatar" />
                                <div className="groupMemberInfo">
                                  <div style={{display: 'flex', alignItems: 'center'}}><strong>{grp.name}</strong></div>
                                  <span style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>{memberNames}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="groupInfoSectionCard">
                    <div className="groupInfoSectionTop" style={{marginBottom: 8}}><div className="groupInfoSectionTitle">Disappearing messages</div></div>
                    <div className="disappearingSettings">
                      <select className="chatSearchFilterSelect" style={{ width: '100%', marginBottom: 6 }} value={chat.disappearingMode || "off"} onChange={(e) => { setDisappearingMode(chat.id, e.target.value); showToast("Disappearing messages updated"); }}>
                        <option value="off">Off</option><option value="24h">24 hours</option><option value="7d">7 days</option><option value="90d">90 days</option>
                      </select>
                      <div className="muted" style={{ fontSize: 13, lineHeight: 1.4 }}>Make messages in this chat disappear after the selected time. Pinned messages will be kept.</div>
                    </div>
                  </div>

                  <div className="chatInfoAdminActions">
                    <button type="button" className="popup-btn popup-btn-secondary" onClick={handleToggleBlock}>{chat.blocked ? "Unblock" : "Block"} Contact</button>
                    <button type="button" className="popup-btn popup-btn-danger" onClick={handleDeleteChat}>Delete Contact</button>
                  </div>
                </div>
              )}
            </div>

            {chat.kind === "group" && (
              <>
                <div className="groupInfoSectionCard mediaLinksDocsCard" onClick={() => setShowMediaPanel(true)} role="button" tabIndex={0}><div className="groupInfoSectionTop"><div className="groupInfoSectionTitle">Media, links and docs</div><div className="groupInfoSectionCount">{totalSharedCount}</div></div><div className="groupMediaPreviewRow">{mediaItems.slice(0, 2).length ? (mediaItems.slice(0, 2).map((item) => (<button key={item.id} type="button" className="groupMediaPreviewItem" onClick={(e) => { e.stopPropagation(); if (item.fileUrl && item.fileUrl !== "#") setPreviewMedia(item.fileUrl); }}><img src={item.fileUrl} alt={item.fileName} /></button>))) : ( <div className="muted">No media, docs or links shared yet.</div> )}</div></div>
                
                {canEditGroupInfo && (
                  <div className="groupInfoSectionCard">
                    <div className="groupInfoSectionTop" style={{marginBottom: 8}}>
                      <div className="groupInfoSectionTitle">Broadcast Channel</div>
                    </div>
                    <div className="disappearingSettings">
                      <label className="pollToggleRow" style={{marginTop: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <input 
                          type="checkbox" 
                          checked={chat.isBroadcast || false} 
                          onChange={() => { toggleBroadcastMode(chat.id); showToast(chat.isBroadcast ? "Broadcast mode disabled" : "Broadcast mode enabled"); }} 
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '14px', fontWeight: 500 }}>Only admins can send messages</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="groupInfoSectionCard">
                  <div className="groupInfoSectionTop" style={{marginBottom: 8}}><div className="groupInfoSectionTitle">Disappearing messages</div></div>
                  <div className="disappearingSettings">
                    {canEditGroupInfo ? (
                      <select className="chatSearchFilterSelect" style={{ width: '100%', marginBottom: 6 }} value={chat.disappearingMode || "off"} onChange={(e) => { setDisappearingMode(chat.id, e.target.value); showToast("Disappearing messages updated"); }}>
                        <option value="off">Off</option><option value="24h">24 hours</option><option value="7d">7 days</option><option value="90d">90 days</option>
                      </select>
                    ) : (
                      <div style={{ marginBottom: 6, fontWeight: 500, color: 'var(--text)' }}>
                        {chat.disappearingMode === "off" ? "Off" : chat.disappearingMode === "24h" ? "24 hours" : chat.disappearingMode === "7d" ? "7 days" : "90 days"}
                      </div>
                    )}
                    <div className="muted" style={{ fontSize: 13, lineHeight: 1.4 }}>Make messages in this chat disappear after the selected time. Pinned messages will be kept.</div>
                  </div>
                </div>

                <div className="groupMembersSection" ref={membersListSectionRef}>
                  <div className="groupMembersHeaderRow"><div className="groupMembersHeaderTitle">{memberCount} member{memberCount !== 1 ? "s" : ""}</div></div>
                  <div className="groupAddMemberSearchBox groupMembersFilterBox"><input ref={membersFilterRef} type="text" className="groupMemberSearchInput" value={groupMemberFilter} onChange={(e) => setGroupMemberFilter(e.target.value)} placeholder="Search members by name or email" /></div>

                  {canEditGroupInfo && (
                    <div className="groupAddMemberCard" ref={addMemberSectionRef}>
                      <div className="groupAddMemberCardHeader">Add member</div>
                      <div className="groupAddMemberSearchBox"><input ref={addMemberSearchRef} type="text" className="groupMemberSearchInput" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search employee by name or email" /></div>
                      <div className="groupAddMemberBox"><select className="groupMemberSelect" value={selectedMemberId} onChange={(e) => setSelectedMemberId(e.target.value)}><option value="">Select employee</option>{availableEmployees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>))}</select><button type="button" className="popup-btn popup-btn-danger" onClick={handleAddMember} disabled={!selectedMemberId}>Add</button></div>
                    </div>
                  )}

                  <div className="groupMembersListWhatsapp">
                    {filteredGroupMembers.length ? (
                      filteredGroupMembers.map((member) => (
                        <div 
                          key={member.id} 
                          className="groupMemberWhatsappItem" 
                          onClick={() => handleStartDirectMessage(member.email)}
                          style={{ cursor: member.email !== authUser?.email ? 'pointer' : 'default' }}
                        >
                          <div className="groupMemberInfoWrap">
                            <img src={member.avatarUrl || "https://i.pravatar.cc/100"} alt={member.name} className="groupMemberAvatar" />
                            <div className="groupMemberInfo">
                              <div style={{display: 'flex', alignItems: 'center'}}><strong>{member.name}</strong>{member.isAdmin && <span className="groupAdminBadge">Admin</span>}</div>
                              <span>
                                {member.email} 
                                <span style={{opacity: 0.8, fontSize: '0.9em', marginLeft: 4}}>
                                  {member.status === 'dnd' ? '• 🔴 DND' : member.status === 'meeting' ? '• 🗓️ Meeting' : '• 🟢 Available'}
                                </span>
                              </span>
                            </div>
                          </div>
                          <div className="groupMemberRightMeta" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end', marginLeft: '12px' }}>
                            {canEditGroupInfo && member.email !== authUser?.email && !member.isAdmin && <button type="button" className="groupMemberActionBtn" onClick={() => handlePromoteAdmin(member.id)}>Make Admin</button>}
                            {canEditGroupInfo && member.email !== authUser?.email && member.isAdmin && <button type="button" className="groupMemberActionBtn" onClick={() => handleDemoteAdmin(member.id)}>Dismiss Admin</button>}
                            {canEditGroupInfo && member.email !== authUser?.email && <button type="button" className="groupMemberRemoveBtn" onClick={() => handleRemoveMember(member.id)}>Remove</button>}
                          </div>
                        </div>
                      ))
                    ) : ( <div className="emptyList"><div className="muted">No members found.</div></div> )}
                  </div>

                  <div className="groupBottomActions">
                     {!chat.hasLeft ? (
                       <button type="button" className="groupBottomActionBtn danger" onClick={handleLeaveGroup}>Exit group</button>
                     ) : (
                       <button type="button" className="groupBottomActionBtn danger" onClick={handleDeleteChat}>Delete group</button>
                     )}
                  </div>
                </div>
              </>
            )}
            <div className="chatInfoDrawerActions"><button type="button" className="popup-btn popup-btn-secondary" onClick={handleCloseChatInfo}>Close</button></div>
          </aside>
        </div>
      )}

      {activeThreadMsgId && activeThreadMsg && (
        <div className="chatInfoOverlay" onClick={() => setActiveThreadMsgId(null)}>
          <aside className="chatInfoDrawer threadDrawer" onClick={(e) => e.stopPropagation()}>
            <div className="chatInfoDrawerHeader whatsappGroupInfoHeader">
              <button type="button" className="iconBtn" onClick={() => setActiveThreadMsgId(null)}>←</button>
              <div className="chatInfoDrawerTitle">Thread</div>
            </div>
            
            <div className="threadDrawerBody">
              <div className="threadOriginalMsg">
                <div className="waSenderName">{activeThreadMsg.senderName}</div>
                <div className="threadMsgText">{activeThreadMsg.text}</div>
                <div className="waTime">{formatTime(activeThreadMsg.createdAt)}</div>
              </div>
              
              <div className="threadRepliesList">
                {activeThreadMsg.thread && activeThreadMsg.thread.length > 0 ? (
                  activeThreadMsg.thread.map(tm => (
                    <div key={tm.id} className="threadReplyItem">
                      <div className="waSenderName">{tm.senderName}</div>
                      <div className="threadMsgText">{tm.text}</div>
                      <div className="waTime">{formatTime(tm.createdAt)}</div>
                    </div>
                  ))
                ) : (
                  <div className="muted" style={{textAlign: 'center', marginTop: 40}}>No replies yet. Start the conversation!</div>
                )}
              </div>
            </div>

            <footer className="composer threadComposer">
              <textarea 
                className="composerInput" 
                value={threadText} 
                onChange={(e) => setThreadText(e.target.value)} 
                placeholder="Reply in thread..." 
                rows={1}
                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendThread(); }}}
              />
              <button type="button" className="sendBtn" onClick={onSendThread} disabled={!threadText.trim()}>
                <svg className="sendIcon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </button>
            </footer>
          </aside>
        </div>
      )}

      <section className="messages" aria-label="Messages">
        {isLoading ? (
          <>
             <div className="skeleton skeletonBubble skeletonMine" />
             <div className="skeleton skeletonBubble skeletonTheirs" />
             <div className="skeleton skeletonBubble skeletonMine" style={{width: 300}} />
             <div className="skeleton skeletonBubble skeletonTheirs" style={{height: 80}} />
             <div className="skeleton skeletonBubble skeletonMine" />
          </>
        ) : (
          groups.map((g) => (
            <div key={g.day}>
              <div className="dayChip">{g.day}</div>
              {g.messages.map((m) => {
                const isMatched = searchTerm.trim() && typeof m.text === "string" && m.text.toLowerCase().includes(searchTerm.toLowerCase());
                const matchedIndex = matchedMessages.findIndex((item) => item.id === m.id);
                const isActiveMatched = isMatched && matchedIndex === activeSearchIndex;

                return (
                  <React.Fragment key={m.id}>
                    {m.id === firstUnreadId && <div className="unreadDivider animatedFadeIn"><span>Unread messages</span></div>}
                    <div ref={(el) => { messageRefs.current[m.id] = el; }} className={isActiveMatched ? "chatMatchedMessageActive" : ""}>
                      <MessageBubble
                        message={{ ...m, displayText: isMatched ? (<HighlightText text={m.text} query={searchTerm} />) : null }}
                        selectionMode={selectionMode}
                        isSelected={selectedMessages.includes(m.id)}
                        onToggleSelect={() => { setSelectionMode(true); toggleSelection(m.id); }}
                        onReaction={(emoji) => toggleReaction(chat.id, m.id, emoji)}
                        onStar={() => toggleStar(chat.id, m.id)}
                        onPin={() => togglePin(chat.id, m.id)}
                        onVote={(optId) => votePoll(chat.id, m.id, optId)}
                        onReply={() => handleReplyMessage(m)}
                        onOpenThread={() => setActiveThreadMsgId(m.id)} 
                        onEdit={() => handleEditMessage(m)}
                        onForward={() => setForwardingMessage(m)}
                        onDeleteForMe={() => setDeletePrompt({ id: m.id, type: 'me' })}
                        onDeleteForAll={() => setDeletePrompt({ id: m.id, type: 'all' })}
                        canDeleteForAll={m.isMine || isAdmin}
                        onScrollToReply={handleScrollToMessage}
                        onPreviewImage={(url) => setPreviewMedia(url)}
                      />
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          ))
        )}
        <div ref={endRef} />
      </section>

      {showPollModal && (
        <div className="mediaPreviewOverlay animatedFadeIn" onClick={() => setShowPollModal(false)}>
          <div className="customModal pollModal" onClick={(e) => e.stopPropagation()}>
            <div className="forwardModalHeader">
              <h3 className="customModalTitle">Create Poll</h3>
              <button className="iconBtn" onClick={() => setShowPollModal(false)}>✕</button>
            </div>
            <div className="pollModalBody">
              <label className="profile-input-group">
                <span className="profile-input-label">Question</span>
                <input type="text" className="profile-input" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Ask a question" autoFocus />
              </label>
              <div className="profile-input-label" style={{marginTop: 16}}>Options</div>
              <div className="pollOptionsEditor">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="pollOptionRow">
                    <input type="text" className="profile-input" value={opt} onChange={e => handlePollOptionChange(i, e.target.value)} placeholder={`Option ${i + 1}`} />
                    {pollOptions.length > 2 && (<button className="iconBtn deleteOptBtn" onClick={() => handleRemovePollOption(i)}>✕</button>)}
                  </div>
                ))}
                {pollOptions.length < 12 && (<button className="addOptBtn" onClick={handleAddPollOption}>+ Add Option</button>)}
              </div>
              <label className="pollToggleRow">
                <input type="checkbox" checked={pollAllowMultiple} onChange={e => setPollAllowMultiple(e.target.checked)} /><span>Allow multiple answers</span>
              </label>
            </div>
            <div className="customModalActions" style={{padding: "16px 20px", borderTop: "1px solid var(--border)"}}>
              <button className="popup-btn popup-btn-secondary" onClick={() => setShowPollModal(false)}>Cancel</button>
              <button className="popup-btn popup-btn-danger" onClick={handleSendPoll} disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}>Send Poll</button>
            </div>
          </div>
        </div>
      )}

      {isOtherUserDND && (
        <div className="dndWarningBar">
          🔴 {chat.name} is currently in Do Not Disturb mode. Notifications are muted.
        </div>
      )}

      {chat.hasLeft ? (
        <footer className="composer composerDisabled animatedFadeIn">You can't send messages to this group because you're no longer a participant.</footer>
      ) : chat.kind === "group" && chat.isBroadcast && !canEditGroupInfo ? (
        <footer className="composer composerDisabled animatedFadeIn" style={{justifyContent: 'center', color: 'var(--muted)', fontWeight: 500}}>Only admins can send messages.</footer>
      ) : (
        <footer className="composer">
          {replyingTo && (
            <div className="waComposerReplyBar animatedFadeIn">
              <div className="waComposerReplyAccent" />
              <div className="waComposerReplyContent"><div className="waComposerReplyTitle">{replyingTo.senderName || "Reply"}</div><div className="waComposerReplyText">{replyingTo.type === "image" ? `🖼 ${replyingTo.fileName || "Photo"}` : replyingTo.type === "document" ? `📄 ${replyingTo.fileName || "Document"}` : replyingTo.text}</div></div>
              <button type="button" className="waComposerReplyClose" onClick={() => setReplyingTo(null)}>✕</button>
            </div>
          )}

          {editingMessage && (
            <div className="waComposerReplyBar animatedFadeIn">
              <div className="waComposerReplyAccent" />
              <div className="waComposerReplyContent"><div className="waComposerReplyTitle">Editing message</div><div className="waComposerReplyText">{editingMessage.text}</div></div>
              <button type="button" className="waComposerReplyClose" onClick={() => { setEditingMessage(null); setText(""); }}>✕</button>
            </div>
          )}

          <div className="composer-actions-left" style={{ position: 'relative' }}>
            {mentionState.active && filteredMentionMembers.length > 0 && (
              <div className="mentionPopup animatedFadeIn">
                {filteredMentionMembers.map((member, idx) => (
                  <div key={member.id} className={`mentionItem ${idx === mentionState.selectedIndex ? "selected" : ""}`} onClick={() => insertMention(member)}>
                    <img src={member.avatarUrl || "https://i.pravatar.cc/100"} alt="" className="mentionAvatar" />
                    <span className="mentionName">{member.name}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="composer-action-wrapper">
              <button ref={attachBtnRef} type="button" className="composerActionBtn" onClick={() => { setShowAttachMenu((prev) => !prev); setShowStickerMenu(false); }} title="Attach" disabled={chat.blocked || !canPost}>+</button>
              {showAttachMenu && (
                <div ref={attachMenuRef} className="waAttachMenu">
                  <button type="button" className="waAttachMenuItem" onClick={() => handleAttachmentAction("document")}>
                    <div className="waAttachIcon waAttachIcon-doc"><svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg></div><span>Document</span>
                  </button>
                  <button type="button" className="waAttachMenuItem" onClick={() => handleAttachmentAction("image")}>
                    <div className="waAttachIcon waAttachIcon-image"><svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div><span>Photos & Videos</span>
                  </button>
                  {chat.kind === "group" && canEditGroupInfo && (
                    <button type="button" className="waAttachMenuItem" onClick={() => { setShowPollModal(true); setShowAttachMenu(false); }}>
                      <div className="waAttachIcon waAttachIcon-poll"><svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg></div><span>Poll</span>
                    </button>
                  )}
                  <button type="button" className="waAttachMenuItem" onClick={() => handleAttachmentAction("contact")}>
                    <div className="waAttachIcon waAttachIcon-contact"><svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div><span>Contact</span>
                  </button>
                </div>
              )}
            </div>

            <div className="composer-action-wrapper">
              <button ref={stickerBtnRef} type="button" className="composerActionBtn" onClick={() => { setShowStickerMenu((prev) => !prev); setShowAttachMenu(false); }} title="Stickers" disabled={chat.blocked || !canPost}>☺</button>
              {showStickerMenu && (
                <div ref={stickerMenuRef} className="composerPopupMenu stickerMenu">
                  <div className="stickerGrid">{stickerOptions.map((sticker, index) => (<button key={`${sticker}-${index}`} type="button" className="stickerBtn" onClick={() => handleStickerSelect(sticker)}>{sticker}</button>))}</div>
                </div>
              )}
            </div>
            <input ref={imageInputRef} type="file" accept="image/*" className="hiddenFileInput" onChange={handleImageSelected} />
            <input ref={documentInputRef} type="file" className="hiddenFileInput" onChange={handleDocumentSelected} />
          </div>

          <textarea ref={composerInputRef} className="composerInput" value={text} onChange={handleTextInput} placeholder={chat.blocked ? "This chat is blocked" : editingMessage ? "Edit message" : "Type a message"} rows={1} disabled={chat.blocked || !canPost} onKeyDown={handleKeyDown} />
          <button type="button" className="sendBtn" onClick={onSend} aria-label="Send" title="Send" disabled={!canSend || chat.blocked || !canPost}>
            <svg className="sendIcon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </button>
        </footer>
      )}

      {/* Shared Media/Links/Docs Overlays... */}
      {showMediaPanel && (
        <div className="mediaSharedOverlay animatedFadeIn">
          <div className="mediaSharedPanel">
            <div className="mediaSharedHeader">
              <button type="button" className="iconBtn" onClick={() => setShowMediaPanel(false)}>←</button>
              <div className="mediaSharedTabs">
                <button className={`mediaTabBtn ${activeMediaTab === "media" ? "active" : ""}`} onClick={() => setActiveMediaTab("media")}>Media</button>
                <button className={`mediaTabBtn ${activeMediaTab === "docs" ? "active" : ""}`} onClick={() => setActiveMediaTab("docs")}>Docs</button>
                <button className={`mediaTabBtn ${activeMediaTab === "links" ? "active" : ""}`} onClick={() => setActiveMediaTab("links")}>Links</button>
              </div>
            </div>
            <div className="mediaSharedBody">
              {activeMediaTab === "media" && (
                <>{mediaItems.length ? (<div className="mediaSharedGrid">{mediaItems.map((item) => (<button key={item.id} type="button" className="mediaSharedItem" onClick={() => item.fileUrl !== "#" && setPreviewMedia(item.fileUrl)}><img src={item.fileUrl} alt={item.fileName} /><div className="mediaSharedLabel">{item.fileName}</div></button>))}</div>) : (<div className="mediaEmptyState"><h3>No media</h3><p>Media shared in this chat will appear here.</p></div>)}</>
              )}
              {activeMediaTab === "docs" && (
                <>{docItems.length ? (<div className="docsSharedList">{docItems.map((item) => (<a key={item.id} href={item.fileUrl || "#"} target="_blank" rel="noreferrer" className="docsSharedItem"><span>📄</span><div><strong>{item.fileName}</strong><small>{item.fileUrl && item.fileUrl !== "#" ? "Open document" : "Sample document"}</small></div></a>))}</div>) : (<div className="mediaEmptyState"><h3>No docs</h3><p>Documents shared in this chat will appear here.</p></div>)}</>
              )}
              {activeMediaTab === "links" && (
                <>{linkItems.length ? (<div className="docsSharedList">{linkItems.map((item) => (<a key={item.id} href={item.text} target="_blank" rel="noreferrer" className="docsSharedItem"><span>🔗</span><div><strong>{item.text}</strong><small>Open link</small></div></a>))}</div>) : (<div className="mediaEmptyState"><h3>No links</h3><p>Links shared in this chat will appear here.</p></div>)}</>
              )}
            </div>
          </div>
        </div>
      )}

      {deletePrompt && (
        <div className="mediaPreviewOverlay animatedFadeIn" onClick={() => setDeletePrompt(null)}>
          <div className="customModal" onClick={(e) => e.stopPropagation()}>
            <h3 className="customModalTitle">Delete Message?</h3>
            <p className="customModalText">Are you sure you want to delete this message {deletePrompt.type === 'all' ? "for everyone" : "for yourself"}?</p>
            <div className="customModalActions">
              <button className="popup-btn popup-btn-secondary" onClick={() => setDeletePrompt(null)}>Cancel</button>
              <button className="popup-btn popup-btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ADDED FOR MULTI-FORWARD: REPLACED FORWARD MODAL UI */}
      {forwardingMessage && (
        <div className="mediaPreviewOverlay animatedFadeIn" onClick={() => { setForwardingMessage(null); setForwardSelectedChats([]); }}>
          <div className="customModal forwardModal" onClick={(e) => e.stopPropagation()}>
            <div className="forwardModalHeader">
              <h3 className="customModalTitle">Forward to...</h3>
              <button className="iconBtn" onClick={() => { setForwardingMessage(null); setForwardSelectedChats([]); }}>✕</button>
            </div>
            
            <div className="forwardChatList" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              {chats.map(c => (
                <label key={c.id} className="forwardChatRow" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px 16px', borderBottom: '1px solid var(--border)', margin: 0 }}>
                  <input 
                    type="checkbox" 
                    checked={forwardSelectedChats.includes(c.id)}
                    onChange={() => toggleForwardSelection(c.id)}
                    style={{ marginRight: '16px', width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                  />
                  <img src={c.avatarUrl} alt={c.name} className="forwardChatAvatar" style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '12px' }} />
                  <div className="forwardChatName" style={{ flex: 1, fontWeight: 500 }}>{c.name}</div>
                </label>
              ))}
            </div>

            <div className="customModalActions" style={{ padding: "16px 20px", borderTop: "1px solid var(--border)" }}>
              <button className="popup-btn popup-btn-secondary" onClick={() => { setForwardingMessage(null); setForwardSelectedChats([]); }}>Cancel</button>
              <button 
                className="popup-btn popup-btn-danger" 
                onClick={handleMultiForwardSubmit} 
                disabled={forwardSelectedChats.length === 0}
              >
                Forward {forwardSelectedChats.length > 0 ? `(${forwardSelectedChats.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewMedia && (
        <div className="mediaPreviewOverlay animatedFadeIn" onClick={() => setPreviewMedia("")}>
          <div className="mediaPreviewModal" onClick={(e) => e.stopPropagation()}><button type="button" className="mediaPreviewCloseBtn" onClick={() => setPreviewMedia("")}>✕</button><img src={previewMedia} alt="Preview" className="mediaPreviewImage" /></div>
        </div>
      )}
    </div>
  );
}