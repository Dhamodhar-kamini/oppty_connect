import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useChats } from "../../context/ChatContext.jsx";
import { useChat } from "../../hooks/useChat.js";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import { fetchGroupDetails, fetchUsers } from "../../utils/api.js";
import { getAuthUserId } from "../../utils/auth.js";
import MessageBubble from "./MessageBubble.jsx";
import FileUploadButton from "./FileUploadButton.jsx";
import MeetButton from "./MeetButton.jsx";

import "../../App.css";

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

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMediaQuery("(min-width: 900px)");
  const myId = getAuthUserId();

  const isGroup = useMemo(() => String(chatId).startsWith("group-") || location.pathname.startsWith("/groups"), [chatId, location.pathname]);
  const targetId = useMemo(() => String(chatId).replace("emp-", "").replace("group-", ""), [chatId]);

  const {
    messages, loading: messagesLoading, isConnected, connectionStatus,
    sendTextMessage, sendFile, sendTypingIndicator, sendReaction, markAsRead, typingUsers
  } = useChat(chatId, isGroup);

  const {
    chats, getChatById, toggleStar, togglePin, isAdmin, receiveMessage, showToast,
    toggleBlockChat, deleteEmployeeGlobally, forwardMessages, editMessage: ctxEditMessage,
    addGroupMember, removeGroupMember, promoteAdmin, leaveGroup, deleteChat,
    deleteMessageForMe, deleteMessageForAll, currentUser
  } = useChats();

  const currentChat = getChatById(chatId);
  const isPersonalBlock = currentChat?.blocked || false;
  const isAdminBlocked = currentChat?.adminBlocked || false; 
  const amISuspended = currentUser?.is_suspended || false; 

  const [chatInfo, setChatInfo] = useState(null);
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardTargets, setForwardTargets] = useState([]);

  const [localStars, setLocalStars] = useState({}); 
  const [localPins, setLocalPins] = useState({});   
  const [localMeets, setLocalMeets] = useState([]);
  const [localEdits, setLocalEdits] = useState({});
  const [localDeletes, setLocalDeletes] = useState(new Set());
  const [localDeletesForAll, setLocalDeletesForAll] = useState(new Set());
  const [localThreads, setLocalThreads] = useState({});
  
  const [activeThreadMsgId, setActiveThreadMsgId] = useState(null);
  const [threadText, setThreadText] = useState("");
  const [deletePrompt, setDeletePrompt] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [previewMedia, setPreviewMedia] = useState("");

  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [showMediaDocs, setShowMediaDocs] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [addMemberSelect, setAddMemberSelect] = useState("");

  const endRef = useRef(null);
  const membersRef = useRef(null);
  const composerInputRef = useRef(null);
  const messageRefs = useRef({});
  const lastTypingRef = useRef(0);

  useEffect(() => {
    const loadInfo = async () => {
      if (!targetId) return;
      try {
        if (isGroup) {
          setChatInfo(await fetchGroupDetails(targetId));
        } else {
          const usersList = await fetchUsers();
          setChatInfo(usersList.find(u => String(u.id) === targetId));
        }
      } catch (err) { console.error(err); }
    };
    loadInfo();
  }, [targetId, isGroup]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    if (isConnected && messages.length > 0) markAsRead();
  }, [messages.length, isConnected, markAsRead]);

  useEffect(() => {
    setSearchOpen(false); setSearchTerm(""); setShowChatInfo(false);
    setMemberSearchQuery(""); setShowMediaDocs(false); setSelectionMode(false);
    setSelectedMessages([]); setEditingMessage(null); setReplyingTo(null);
    setLocalStars({}); setLocalPins({}); setLocalEdits({}); setLocalDeletes(new Set());
  }, [chatId]);

  const combinedMessages = useMemo(() => {
    const map = new Map();
    const processMessage = (m) => {
      if (localDeletes.has(m.id)) return null; 
      let msg = { ...m };
      
      if (localDeletesForAll.has(m.id)) {
        msg.text = "🚫 This message was deleted"; 
        msg.isDeleted = true; 
        msg.deletedForAll = true; 
        msg.type = "text"; 
        msg.fileUrl = null; 
      } else if (localEdits[m.id]) {
        msg.text = localEdits[m.id]; 
        msg.isEdited = true;
      }
      
      if (localThreads[m.id]) {
        const existingIds = new Set((msg.thread || []).map(t => t.id));
        const newThreads = localThreads[m.id].filter(t => !existingIds.has(t.id));
        msg.thread = [...(msg.thread || []), ...newThreads];
      }

      if (localStars[m.id] !== undefined) msg.isStarred = localStars[m.id];
      if (localPins[m.id] !== undefined) msg.isPinned = localPins[m.id];
      return msg;
    };

    (messages || []).forEach(m => { const p = processMessage(m); if (p) map.set(p.id, p); });
    localMeets.forEach(m => { const p = processMessage(m); if (p) map.set(p.id, p); });
    return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
  }, [messages, localMeets, localEdits, localDeletes, localDeletesForAll, localThreads, localStars, localPins]);

  const filteredMessages = useMemo(() => {
    if (!searchTerm) return combinedMessages;
    return combinedMessages.filter(m => m.text?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [combinedMessages, searchTerm]);

  const messageGroups = useMemo(() => {
    const groupsMap = [];
    filteredMessages.forEach(m => {
      if (m.deletedForAll && m.isDeleted) return; 
      const day = formatDay(m.createdAt);
      let group = groupsMap.find(g => g.day === day);
      if (!group) { group = { day, messages: [] }; groupsMap.push(group); }
      group.messages.push(m);
    });
    return groupsMap;
  }, [filteredMessages]);

  const pinnedMessages = useMemo(() => combinedMessages.filter(m => m.isPinned && !m.deletedForAll), [combinedMessages]);
  const mediaMessages = useMemo(() => combinedMessages.filter(m => ['image', 'video', 'document'].includes(m.type) || m.fileUrl), [combinedMessages]);
  const activeThreadMsg = useMemo(() => activeThreadMsgId ? combinedMessages.find(m => m.id === activeThreadMsgId) : null, [combinedMessages, activeThreadMsgId]);

  const commonGroups = useMemo(() => {
    if (isGroup || !chats) return [];
    return chats.filter(c => c.kind === 'group' && c.members?.some(m => String(m.id) === targetId));
  }, [chats, targetId, isGroup]);

  const isGroupAdmin = isGroup && (chatInfo?.members?.find(m => String(m.id) === String(currentUser?.id))?.isAdmin || isAdmin);
  
  const canPost = !amISuspended && !chatInfo?.hasLeft && (!chatInfo?.isBroadcast || isGroupAdmin || isAdmin) && (!isPersonalBlock && !isAdminBlocked || isAdmin);

  const handleTextInput = (e) => {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
    
    const now = Date.now();
    if (now - lastTypingRef.current > 1000) {
      sendTypingIndicator(true);
      lastTypingRef.current = now;
    }
  };

  const handleSend = () => {
    const v = text.trim();
    if (!v || !canPost) return;
    if (editingMessage) {
      ctxEditMessage(chatId, editingMessage.id, v);
      setLocalEdits(prev => ({ ...prev, [editingMessage.id]: v }));
      setEditingMessage(null);
    } else {
      sendTextMessage(v, replyingTo?.id || null);
    }
    setText(""); setReplyingTo(null);
    if (composerInputRef.current) composerInputRef.current.style.height = "auto";
  };

  const executeAddMember = () => {
    if (!addMemberSelect) return showToast("Select an employee first", "error");
    addGroupMember(chatId, addMemberSelect);
    setAddMemberSelect(""); setAddMemberSearch("");
  };

  const handleMeetCreated = useCallback((apiResult) => {
    const newMeetMessage = {
      id: apiResult?.id || `meet-${Date.now()}`, type: "meet", messageType: "meet",
      text: apiResult?.title ? `Meeting: ${apiResult.title}` : "Join Meeting",
      meetTitle: apiResult?.title || "Meeting", meetLink: apiResult?.meet_link || apiResult?.meetLink || "",
      meetScheduledAt: apiResult?.scheduled_at || apiResult?.scheduledAt || Date.now(),
      createdAt: Date.now(), isMine: true, senderName: currentUser?.name || "You", sender: "me" 
    };
    setLocalMeets(prev => [...prev, newMeetMessage]);
    if (receiveMessage) receiveMessage(chatId, newMeetMessage);
  }, [chatId, receiveMessage, currentUser]);

  const handleSendThread = () => {
    const v = threadText.trim();
    if (!v || !activeThreadMsgId) return;
    const newThreadMsg = { id: `thread-${Date.now()}`, sender: "me", senderName: currentUser?.name || "You", text: v, createdAt: Date.now() };
    setLocalThreads(prev => ({ ...prev, [activeThreadMsgId]: [...(prev[activeThreadMsgId] || []), newThreadMsg] }));
    sendThreadMessage(chatId, activeThreadMsgId, v);
    setThreadText("");
  };

  const handleDeleteForMe = (id) => {
    deleteMessageForMe(chatId, [id]);
    setLocalDeletes(prev => new Set(prev).add(id));
    setDeletePrompt(null);
  };

  const handleDeleteForAll = (id) => {
    deleteMessageForAll(chatId, [id]);
    setLocalDeletesForAll(prev => new Set(prev).add(id));
    setDeletePrompt(null);
  };

  const getTypingText = () => {
    if (!typingUsers || typingUsers.length === 0) return null;
    return typingUsers.length === 1 ? `${typingUsers[0].name} is typing...` : `${typingUsers.length} people are typing...`;
  };

  if (!chatId) return <div className="chatEmpty"><div className="chatEmptyIllustration">💬</div><div className="chatEmptyTitle">Oppty Chats</div><div className="muted chatEmptySubtitle">Select a conversation to start messaging.</div></div>;

  return (
    <div className="chat">
      {/* 🟢 EXACT MATCH UI STYLES FOR THE DRAWER INJECTED HERE */}
      <style>{`
        .drawerHeader {
          display: flex; align-items: center; gap: 15px; padding: 15px 20px;
          background: #fff; border-bottom: 1px solid #e9edef;
        }
        .drawerTitle { font-size: 16px; font-weight: 600; color: #111b21; }
        
        .drawerBody {
          flex: 1; overflow-y: auto; background: #f0f2f5; display: flex; flex-direction: column;
        }
        
        .infoProfileHero {
          background: #f0f2f5; padding: 25px 20px; text-align: center;
        }
        .infoAvatarLarge {
          width: 150px; height: 150px; border-radius: 50%; object-fit: cover;
          margin: 0 auto 15px; display: block;
        }
        .infoNameDisplay {
          font-size: 22px; font-weight: 700; color: #111b21; margin: 0 0 5px 0;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .infoStatusDisplay {
          font-size: 14px; color: #667781; margin: 0;
        }

        .infoCardSection {
          background: #fff; margin-bottom: 10px; padding: 14px 20px;
          border-radius: 8px; margin: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .sectionLabel {
          font-size: 14px; font-weight: 600; color: #8696a0; margin-bottom: 6px; display: block;
        }
        .sectionLabelGreen {
          font-size: 14px; font-weight: 600; color: #00a884; margin-bottom: 6px; display: block;
        }
        .infoValueText { font-size: 15px; color: #111b21; line-height: 1.4; }

        .groupQuickActions {
          display: flex; justify-content: center; gap: 30px; background: #fff; padding: 20px;
          margin: 0 10px 10px 10px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .quickActionItem {
          display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer;
        }
        .actionCircle {
          width: 44px; height: 44px; border-radius: 50%; border: 1px solid #e9edef;
          display: flex; align-items: center; justify-content: center; color: #00a884; font-size: 20px;
        }
        .actionLabel { color: #111b21; font-size: 13px; font-weight: 500; }

        .infoListItem {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 20px; background: #fff; margin: 0 10px 10px 10px; border-radius: 8px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: pointer;
        }
        .listItemTitle { font-size: 15px; color: #111b21; font-weight: 600; }
        .listItemTitleGreen { font-size: 15px; color: #00a884; font-weight: 600; }

        .drawerSearchInput {
          width: 100%; padding: 10px 14px; background: #f0f2f5; border: 1px solid #e9edef;
          border-radius: 8px; outline: none; font-size: 14px; margin-bottom: 15px;
        }
        
        .footerBtnGrid { display: flex; gap: 10px; margin: 0 10px 10px 10px; }
        .footerActionBtn {
          flex: 1; padding: 12px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; font-size: 14px;
        }
        .footerActionBtn.gray { background: #f0f2f5; color: #111b21; border: 1px solid #e9edef; }
        .footerActionBtn.orange { background: #ff6b00; color: white; }
        .exitLinkBtn { width: 100%; color: #ea0038; background: none; border: none; font-size: 15px; padding: 15px 20px; text-align: left; cursor: pointer; }
        .closeBtnMain { background: #00a884; color: white; padding: 8px 24px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-right: 10px;}
      `}</style>

      <header className={`chatHeader ${selectionMode ? 'selectionModeActive' : ''}`}>
        {selectionMode ? (
          <div className="selectionHeaderContent">
            <button className="iconBtn" onClick={() => { setSelectionMode(false); setSelectedMessages([]); }}>✕</button>
            <span className="selectionCount">{selectedMessages.length} selected</span>
            <div className="selectionActions">
              <button className="iconBtn" title="Star" onClick={() => {
                selectedMessages.forEach(id => {
                    const current = localStars[id] !== undefined ? localStars[id] : combinedMessages.find(m=>m.id===id)?.isStarred;
                    setLocalStars(prev => ({ ...prev, [id]: !current }));
                    toggleStar(chatId, id);
                });
                setSelectionMode(false); setSelectedMessages([]);
              }}>⭐</button>
              <button className="iconBtn" title="Delete" onClick={() => setDeletePrompt({ id: selectedMessages, type: 'me' })}>🗑️</button>
              <button className="iconBtn" title="Forward" onClick={() => {
                setForwardingMessage(combinedMessages.filter(m => selectedMessages.includes(m.id)));
                setShowForwardModal(true); 
              }}>↪</button>
            </div>
          </div>
        ) : searchOpen ? (
          <div className="searchHeaderActive">
            <button className="iconBtn" onClick={() => { setSearchOpen(false); setSearchTerm(""); }}>←</button>
            <input autoFocus className="chatSearchInput" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search messages..." />
          </div>
        ) : (
          <>
            <button className="chatHeaderIdentity" onClick={() => setShowChatInfo(true)}>
              {!isDesktop && <div className="iconBtn" onClick={(e) => { e.stopPropagation(); navigate(isGroup ? "/groups" : "/chats"); }} style={{ marginRight: '8px' }}>←</div>}
              <img src={chatInfo?.avatarUrl} className="avatar" alt="" onError={(e) => e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(chatInfo?.name || 'U')}&background=random`} />
              <div className="chatHeaderText">
                <div className="chatHeaderName">{chatInfo?.name} {isAdminBlocked ? "🚫" : (isPersonalBlock ? "🔒" : "")}</div>
                <div className="chatHeaderMeta">
                  {getTypingText() || (isGroup ? `${chatInfo?.memberCount || 0} members` : (isConnected ? 'online' : connectionStatus))}
                </div>
              </div>
            </button>
            <div className="chatHeaderActions">
              <button className="iconBtn" onClick={() => setSearchOpen(true)}>⌕</button>
              <button className="iconBtn" onClick={() => setShowOptionsMenu(!showOptionsMenu)}>⋯</button>
              {showOptionsMenu && (
                <div className="chatOptionsMenu">
                  <button className="chatOptionsItem" onClick={() => { setShowChatInfo(true); setShowOptionsMenu(false); }}>View info</button>
                  <button className="chatOptionsItem" onClick={() => { setSelectionMode(true); setShowOptionsMenu(false); }}>Select messages</button>
                  {/* {isAdmin && !isGroup && (
                    // <button className="chatOptionsItem" onClick={() => { toggleBlockChat(chatId); setShowOptionsMenu(false); }}>
                    //   {isAdminBlocked ? "Restore Employee" : "Suspend Employee (Global)"}
                    // </button>
                  )} */}
                  {/* <button className="chatOptionsItem chatOptionsItemDanger" onClick={() => { setShowOptionsMenu(false); if (window.confirm(`Delete this ${isGroup ? 'group' : 'contact'}?`)) { deleteChat(chatId); navigate("/chats"); } }}>Delete {isGroup ? "Group" : "Contact"}</button> */}
                </div>
              )}
            </div>
          </>
        )}
      </header>

      {pinnedMessages.length > 0 && !searchOpen && !selectionMode && (
        <div className="pinnedMessagesBanner" onClick={() => { const node = messageRefs.current[pinnedMessages[0].id]; if(node) node.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
          <span className="pinnedIcon">📌</span>
          <div>
            <div className="pinnedTitle">Pinned Message</div>
            <div className="pinnedSnippet">{pinnedMessages[0].text || "Attachment"}</div>
          </div>
        </div>
      )}

      <section className="messages" aria-label="Messages">
        {messageGroups.map((g) => (
          <div key={g.day}>
            <div className="dayChip">{g.day}</div>
            {g.messages.map((m) => (
              <div key={m.id} ref={(el) => { messageRefs.current[m.id] = el; }}>
                <MessageBubble
                  message={m} isGroup={isGroup} selectionMode={selectionMode} isSelected={selectedMessages.includes(m.id)}
                  onToggleSelect={() => { setSelectionMode(true); setSelectedMessages(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]); }}
                  onReaction={(emoji) => { const r = { '👍': 'ok', '👎': 'not_ok', '❤️': 'love', '😂': 'laugh', '😮': 'wow', '😢': 'sad', '🙏': 'ok' }; sendReaction(m.id, r[emoji] || 'ok'); }}
                  onStar={() => { const current = localStars[m.id] !== undefined ? localStars[m.id] : m.isStarred; setLocalStars(prev => ({ ...prev, [m.id]: !current })); toggleStar(chatId, m.id); }}
                  onPin={() => { const current = localPins[m.id] !== undefined ? localPins[m.id] : m.isPinned; setLocalPins(prev => ({ ...prev, [m.id]: !current })); togglePin(chatId, m.id); }}
                  onEdit={() => { setEditingMessage(m); setText(m.text); setReplyingTo(null); }}
                  onForward={() => { setForwardingMessage([m]); setShowForwardModal(true); }}
                  onDeleteForMe={() => setDeletePrompt({ id: m.id, type: 'me' })}
                  onDeleteForAll={() => setDeletePrompt({ id: m.id, type: 'all' })}
                  canDeleteForAll={m.isMine && m.canDeleteForEveryone}
                  onReply={() => { setReplyingTo(m); setEditingMessage(null); }}
                  onOpenThread={() => setActiveThreadMsgId(m.id)}
                  onPreviewImage={(url) => setPreviewMedia(url)}
                />
              </div>
            ))}
          </div>
        ))}
        <div ref={endRef} />
      </section>

      {/* ✅ RESTRICTED FOOTER ALERTS */}
      {amISuspended ? (
        <footer className="composer composerDisabled" style={{ background: '#ffebee', color: '#c62828' }}>🚫 Your account has been suspended by an Admin.</footer>
      ) : isAdminBlocked && !isAdmin ? (
        <footer className="composer composerDisabled" style={{ background: '#ffebee', color: '#c62828' }}>🚫 This employee has been suspended globally.</footer>
      ) : isPersonalBlock ? (
        <footer className="composer composerDisabled">🔒 You have blocked this contact.</footer>
      ) : chatInfo?.hasLeft ? (
        <footer className="composer composerDisabled">You are no longer a participant.</footer>
      ) : (
        <footer className="composer">
          {replyingTo && (
            <div className="waComposerReplyBar animatedFadeIn">
              <div className="waComposerReplyAccent" />
              <div className="waComposerReplyContent">
                <div className="waComposerReplyTitle">{replyingTo.senderName || "Reply"}</div>
                <div className="waComposerReplyText">{replyingTo.type === "image" ? "🖼 Photo" : replyingTo.type === "document" ? "📄 Document" : replyingTo.text?.substring(0, 50) || "Message"}</div>
              </div>
              <button type="button" className="waComposerReplyClose" onClick={() => setReplyingTo(null)}>✕</button>
            </div>
          )}

          {editingMessage && (
            <div className="waComposerReplyBar animatedFadeIn">
              <div className="waComposerReplyAccent" style={{ background: '#f59e0b' }} />
              <div className="waComposerReplyContent">
                <div className="waComposerReplyTitle">Editing message</div>
                <div className="waComposerReplyText">{editingMessage.text}</div>
              </div>
              <button type="button" className="waComposerReplyClose" onClick={() => { setEditingMessage(null); setText(""); }}>✕</button>
            </div>
          )}

          <button className="iconBtn" onClick={() => setShowPollModal(true)}>📊</button>
          <FileUploadButton onFileSelect={(f) => { if (canPost) sendFile(f); }} disabled={!isConnected || !canPost} />
          <MeetButton targetId={!isGroup ? targetId : null} groupId={isGroup ? targetId : null} members={chatInfo?.members || []} disabled={!isConnected || !canPost} onMeetCreated={handleMeetCreated} />

          <textarea
            ref={composerInputRef} className="composerInput" value={text} rows={1}
            onChange={handleTextInput}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
            disabled={!isConnected || !canPost}
          />

          <button className="sendBtn" onClick={handleSend} disabled={!text.trim() || !isConnected || !canPost}>
            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </button>
        </footer>
      )}

      {/* ==================== EXACT MATCH INFO DRAWER ==================== */}
      {showChatInfo && (
        <div className="chatInfoOverlay" onClick={() => setShowChatInfo(false)}>
          <aside className="chatInfoDrawer" onClick={e => e.stopPropagation()}>
            <div className="drawerHeader">
              <button className="iconBtn" onClick={() => setShowChatInfo(false)}>←</button>
              <div className="drawerTitle">{isGroup ? "Group info" : "Contact info"}</div>
            </div>

            <div className="drawerBody">
              
              {/* Profile Image & Name - Centered */}
              <div className="infoProfileHero">
                <img className="infoAvatarLarge" src={chatInfo?.avatarUrl} alt="" onError={(e) => e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(chatInfo?.name || 'U')}&background=random`} />
                <h1 className="infoNameDisplay">
                  {chatInfo?.name} 
                  {isGroup && isGroupAdmin && <span className="editPencilSmall">✎</span>}
                </h1>
                <p className="infoStatusDisplay">{isGroup ? `Group · ${chatInfo?.memberCount} members` : (chatInfo?.status || "online")}</p>
                {isAdminBlocked && <div className="adminTag" style={{ background: '#ffebee', color: '#c62828', display: 'inline-block', marginTop: '5px' }}>Suspended Globally</div>}
              </div>

              {/* Group Buttons */}
              {isGroup && (
                <div className="groupQuickActions">
                  <div className="quickActionItem" onClick={() => membersRef.current?.scrollIntoView({ behavior: 'smooth' })}>
                    <div className="actionCircle"><span>+</span></div>
                    <span className="actionLabel">Add</span>
                  </div>
                  <div className="quickActionItem" onClick={() => { setShowChatInfo(false); setSearchOpen(true); }}>
                    <div className="actionCircle"><span>⌕</span></div>
                    <span className="actionLabel">Search</span>
                  </div>
                </div>
              )}

              {/* About / Description Card */}
              <div className="infoCardSection">
                <label className={isGroup ? "sectionLabelGreen" : "sectionLabel"}>{isGroup ? "Add group description" : "About"}</label>
                <div className="infoValueText">
                  {isGroup ? (chatInfo?.description || "Official team discussion group.") : (chatInfo?.about || "Available for chat")}
                </div>
              </div>
              
              {!isGroup && (
                <div className="infoCardSection">
                  <label className="sectionLabel">Phone / Email</label>
                  <div className="infoValueText">{chatInfo?.email || "N/A"}</div>
                </div>
              )}

              {/* Saved Bookmarks (Group Only) */}
              {isGroup && (
                <div className="infoCardSection">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label className="sectionLabelGreen">Saved Bookmarks</label>
                    <span style={{ color: '#00a884', fontSize: '18px', cursor: 'pointer' }}>+</span>
                  </div>
                  <div className="infoValueText" style={{ fontSize: '13px', color: '#667781' }}>No bookmarks saved yet.</div>
                  <div style={{ fontSize: '12px', color: '#8696a0', marginTop: '10px', borderTop: '1px solid #f0f2f5', paddingTop: '10px' }}>
                    Group created by {chatInfo?.createdBy || "Admin"} on {new Date(chatInfo?.createdAt || Date.now()).toLocaleDateString()}
                  </div>
                </div>
              )}

              {/* Media List Item */}
              <div className="infoListItem" onClick={() => setShowMediaDocs(true)}>
                 <div>
                    <span className="listItemTitle">Media, links and docs</span>
                    {isGroup && <div style={{ fontSize: '13px', color: '#667781', marginTop: '4px' }}>No media, docs or links shared yet.</div>}
                 </div>
                 <span style={{ color: '#8696a0', fontSize: '14px', fontWeight: 600 }}>{mediaMessages.length} ❯</span>
              </div>

              {/* Broadcast Channel (Group Only) */}
              {isGroup && (
                <div className="infoListItem" style={{ cursor: 'default' }}>
                  <div>
                      <span className="listItemTitle">Broadcast Channel</span>
                      <div style={{ fontSize: '13px', color: '#667781', marginTop: '4px' }}>Only admins can send messages</div>
                  </div>
                  <input type="checkbox" checked={chatInfo?.isBroadcast} readOnly style={{ width: '18px', height: '18px', accentColor: '#00a884' }} />
                </div>
              )}

              {/* Disappearing Messages */}
              <div className="infoCardSection" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span className="listItemTitle">Disappearing messages</span>
                    <select style={{ padding: '6px', border: '1px solid #e9edef', borderRadius: '6px', outline: 'none', background: '#f0f2f5' }}>
                      <option>Off</option><option>24 hours</option><option>7 days</option>
                    </select>
                  </div>
                  <div style={{ fontSize: '13px', color: '#667781', lineHeight: '1.4' }}>
                    Make messages in this chat disappear after the selected time. Pinned messages will be kept.
                  </div>
              </div>

              {/* 1-on-1 Common Groups */}
              {!isGroup && commonGroups.length > 0 && (
                <div className="infoCardSection">
                  <label className="sectionLabel">{commonGroups.length} group{commonGroups.length > 1 ? 's' : ''} in common</label>
                  {commonGroups.map(g => (
                    <div key={g.id} className="memberRow" style={{ cursor: 'pointer', padding: '10px 0', borderBottom: '1px solid #f0f2f5' }} onClick={() => navigate(`/groups/${g.id}`)}>
                      <img src={g.avatarUrl} className="avatarSmall" alt="" />
                      <div className="memberMeta">
                        <span className="memberName" style={{ fontSize: '15px' }}>{g.name}</span>
                        <span className="memberEmail" style={{ fontSize: '13px' }}>You, {chatInfo?.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* GROUP MEMBER MANAGEMENT */}
              {isGroup && (
                <div className="infoCardSection" ref={membersRef}>
                  <div className="listItemTitle" style={{ marginBottom: '15px' }}>{chatInfo?.memberCount} members</div>
                  
                  <input className="drawerSearchInput" placeholder="Search members by name or email" value={memberSearchQuery} onChange={e => setMemberSearchQuery(e.target.value)} />
                  
                  {isGroupAdmin && (
                    <div style={{ marginBottom: '15px' }}>
                      <label className="sectionLabelGreen">Add member</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <select style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e9edef', outline: 'none', background: '#fff' }} value={addMemberSelect} onChange={e => setAddMemberSelect(e.target.value)}>
                          <option value="">Select employee</option>
                          {chats.filter(c => c.kind === 'dm' && !chatInfo?.members?.some(m => String(m.id) === String(c.odooId))).map(u => <option key={u.odooId} value={u.odooId}>{u.name}</option>)}
                        </select>
                        <button style={{ padding: '10px 20px', background: '#ffb36b', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }} onClick={executeAddMember}>Add</button>
                      </div>
                    </div>
                  )}

                  <div className="memberList">
                    {(chatInfo?.members?.filter(m => m.name.toLowerCase().includes(memberSearchQuery.toLowerCase())) || []).map(m => (
                      <div key={m.id} className="memberRow" style={{ padding: '12px 0', borderBottom: '1px solid #f0f2f5' }}>
                        <img className="avatarSmall" src={m.avatarUrl} alt="" />
                        <div className="memberMeta">
                          <span className="memberName">{m.name} {m.isAdmin && <span className="adminTag" style={{ color: '#00a884', background: 'none' }}>Admin</span>}</span>
                          <span className="memberEmail" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                             <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: m.status === 'dnd' ? '#ea0038' : '#00a884' }}></span>
                             Available
                          </span>
                        </div>
                        <div className="memberActions">
                           {!m.isAdmin && isGroupAdmin && <button style={{ color: '#00a884', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }} onClick={() => promoteAdmin(chatId, m.id)}>Make Admin</button>}
                           {isGroupAdmin && String(m.id) !== String(myId) && <button style={{ color: '#ea0038', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer', marginLeft: '10px' }} onClick={() => removeGroupMember(chatId, m.id)}>Remove</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <button className="exitLinkBtn" style={{ marginTop: '10px' }} onClick={() => { leaveGroup(chatId); navigate("/groups"); }}>Exit group</button>
                </div>
              )}

              {/* Action Buttons Footer */}
              <div className="drawerFooter" style={{ marginTop: 'auto', paddingBottom: '20px' }}>
                {!isGroup && (
                  <div className="footerBtnGrid">
                    {isAdmin ? (
                      <button className="footerActionBtn gray" onClick={() => { toggleBlockChat(chatId); showToast(isAdminBlocked ? "Employee Restored" : "Employee Suspended", "success"); }}>
                        {isAdminBlocked ? "Restore Employee" : "Suspend (Global)"}
                      </button>
                    ) : (
                      <button className="footerActionBtn gray" disabled={isAdminBlocked} onClick={() => { toggleBlockChat(chatId); showToast(isPersonalBlock ? "Unblocked" : "Blocked", "success"); }}>
                        {isPersonalBlock ? "Unblock Contact" : "Block Contact"}
                      </button>
                    )}
                    
                    {isAdmin ? (
                       <button className="footerActionBtn orange" onClick={() => { if(window.confirm('WARNING: This completely deletes the employee. Continue?')) { deleteEmployeeGlobally(chatId); navigate("/chats"); } }}>Delete Contact</button>
                    ) : (
                       <button className="footerActionBtn orange" onClick={() => { if(window.confirm('Delete local chat history?')) { deleteChat(chatId); navigate("/chats"); } }}>Delete Chat</button>
                    )}
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                   <button className="closeBtnMain" onClick={() => setShowChatInfo(false)}>Close</button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* OVERLAYS & MODALS */}
      {showMediaDocs && (
        <div className="mediaSharedOverlay" style={{ zIndex: 3500 }}>
           <div className="drawerHeader">
              <button className="iconBtn" onClick={() => setShowMediaDocs(false)}>←</button>
              <div className="drawerTitle">Media, links and docs</div>
           </div>
           <div className="mediaSharedBody" style={{ padding: '20px', background: '#f0f2f5', flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px' }}>
                 {mediaMessages.length === 0 ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#667781', padding: '40px' }}>No media shared yet.</div>
                 ) : (
                    mediaMessages.map(m => (
                       <div key={m.id} style={{ aspectRatio: '1/1', background: '#fff', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e9edef', cursor: 'pointer' }} onClick={() => setPreviewMedia(m.fileUrl)}>
                          {m.type === 'image' ? <img src={m.fileUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: '30px' }}>📄</div>}
                       </div>
                    ))
                 )}
              </div>
           </div>
        </div>
      )}

      {showPollModal && (
        <div className="mediaPreviewOverlay" style={{ zIndex: 4000 }} onClick={() => setShowPollModal(false)}>
          <div className="customModal" onClick={e => e.stopPropagation()}>
            <h3 className="customModalTitle">Create Poll</h3>
            <input style={{ width: '100%', padding: '12px', border: '1px solid #e9edef', borderRadius: '8px', margin: '15px 0' }} placeholder="Ask a question..." value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} autoFocus />
            <div className="customModalActions">
              <button className="popup-btn popup-btn-secondary" onClick={() => setShowPollModal(false)}>Cancel</button>
              <button className="popup-btn primary" style={{ background: '#00a884', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px' }} onClick={() => { sendTextMessage(`📊 POLL: ${pollQuestion}`); setShowPollModal(false); setPollQuestion(""); }}>Send</button>
            </div>
          </div>
        </div>
      )}

      {showForwardModal && (
        <div className="mediaPreviewOverlay" style={{ zIndex: 4000 }} onClick={() => { setShowForwardModal(false); setForwardTargets([]); }}>
          <div className="customModal" onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '400px', padding: '0', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #eee', background: '#f5f6f6' }}>
              <h3 style={{ margin: 0, color: '#111b21', fontSize: '18px' }}>Forward to...</h3>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '10px' }}>
              {chats.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', padding: '10px', cursor: 'pointer', gap: '12px', borderRadius: '8px', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#f5f6f6'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                  <input type="checkbox" checked={forwardTargets.includes(c.id)} onChange={(e) => { if (e.target.checked) setForwardTargets(prev => [...prev, c.id]); else setForwardTargets(prev => prev.filter(id => id !== c.id)); }} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  <img src={c.avatarUrl} alt="" style={{ width: 40, height: 40, borderRadius: '50%' }} />
                  <div style={{ fontWeight: 500, color: '#111b21' }}>{c.kind === 'group' ? "👥 " : ""}{c.name}</div>
                </label>
              ))}
            </div>
            <div style={{ padding: '20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="popup-btn popup-btn-secondary" onClick={() => { setShowForwardModal(false); setForwardTargets([]); }}>Cancel</button>
              <button className="popup-btn" style={{ background: '#00a884', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, opacity: forwardTargets.length === 0 ? 0.5 : 1, cursor: forwardTargets.length === 0 ? 'not-allowed' : 'pointer' }} disabled={forwardTargets.length === 0} onClick={() => { forwardMessages(Array.isArray(forwardingMessage) ? forwardingMessage : [forwardingMessage], forwardTargets); setShowForwardModal(false); setForwardTargets([]); setSelectionMode(false); setSelectedMessages([]); showToast("Messages forwarded", "success"); }}>Forward</button>
            </div>
          </div>
        </div>
      )}

      {deletePrompt && (
        <div className="mediaPreviewOverlay" style={{ zIndex: 4000 }} onClick={() => setDeletePrompt(null)}>
          <div className="customModal" onClick={(e) => e.stopPropagation()}>
            <h3 className="customModalTitle">Delete Message?</h3>
            <p className="customModalText">Are you sure you want to delete {Array.isArray(deletePrompt.id) ? 'these messages' : 'this message'} {deletePrompt.type === 'all' ? "for everyone" : "for yourself"}?</p>
            <div className="customModalActions">
              <button className="popup-btn popup-btn-secondary" onClick={() => setDeletePrompt(null)}>Cancel</button>
              <button className="popup-btn popup-btn-danger" style={{ background: '#d93025', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px' }} onClick={() => { if (deletePrompt.type === 'all') handleDeleteForAll(deletePrompt.id); else handleDeleteForMe(deletePrompt.id); }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {previewMedia && (
        <div className="mediaPreviewOverlay" style={{ zIndex: 6000 }} onClick={() => setPreviewMedia(null)}>
            <img src={previewMedia} style={{ maxWidth: '90%', maxHeight: '90vh', borderRadius: '10px', objectFit: 'contain' }} alt="Preview" />
        </div>
      )}

      {isGroup && activeThreadMsgId && activeThreadMsg && (
        <div className="chatInfoOverlay" style={{ zIndex: 4500 }} onClick={() => setActiveThreadMsgId(null)}>
          <aside className="chatInfoDrawer threadDrawer" onClick={(e) => e.stopPropagation()}>
            <div className="chatInfoDrawerHeader" style={{ padding: '15px 20px', background: '#fff', borderBottom: '1px solid #e9edef', display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button type="button" className="iconBtn" onClick={() => setActiveThreadMsgId(null)}>←</button>
              <div className="chatInfoDrawerTitle" style={{ fontSize: '18px', fontWeight: 600 }}>Thread</div>
            </div>
            <div className="threadDrawerBody" style={{ flex: 1, padding: '20px', background: '#efeae2', overflowY: 'auto' }}>
              <div className="threadOriginalMsg" style={{ background: '#fff', padding: '15px', borderRadius: '10px', marginBottom: '20px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <div className="waSenderName" style={{ color: '#00a884', fontWeight: 700, fontSize: '14px', marginBottom: '5px' }}>{activeThreadMsg.senderName}</div>
                <div className="threadMsgText" style={{ fontSize: '15px', color: '#111b21', marginBottom: '8px' }}>{activeThreadMsg.text}</div>
                <div className="waTime" style={{ fontSize: '11px', color: '#667781' }}>{formatTime(activeThreadMsg.createdAt)}</div>
              </div>
              <div className="threadRepliesList" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeThreadMsg.thread?.map(tm => (
                  <div key={tm.id} className="threadReplyItem" style={{ background: '#fff', padding: '10px 15px', borderRadius: '10px', alignSelf: tm.sender === 'me' ? 'flex-end' : 'flex-start', background: tm.sender === 'me' ? '#d9fdd3' : '#fff', maxWidth: '85%' }}>
                    {tm.sender !== 'me' && <div className="waSenderName" style={{ color: '#00a884', fontWeight: 700, fontSize: '13px', marginBottom: '3px' }}>{tm.senderName}</div>}
                    <div className="threadMsgText" style={{ fontSize: '14px', color: '#111b21', marginBottom: '5px' }}>{tm.text}</div>
                    <div className="waTime" style={{ fontSize: '10px', color: '#667781', textAlign: 'right' }}>{formatTime(tm.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
            <footer className="composer threadComposer" style={{ background: '#f0f2f5', padding: '15px', borderTop: '1px solid #e9edef' }}>
              <textarea className="composerInput" value={threadText} onChange={(e) => setThreadText(e.target.value)} placeholder="Reply in thread..." rows={1} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendThread(); } }} />
              <button type="button" className="sendBtn" onClick={handleSendThread} disabled={!threadText.trim()}>
                <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}