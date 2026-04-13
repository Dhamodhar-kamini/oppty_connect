import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useChats } from "../../context/ChatContext.jsx";
import { useChat } from "../../hooks/useChat.js";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import { fetchGroupDetails, fetchUsers, createPoll, votePoll } from "../../utils/api.js";
import { getAuthUserId } from "../../utils/auth.js";
import MessageBubble from "./MessageBubble.jsx";
import FileUploadButton from "./FileUploadButton.jsx";
import MeetButton from "./MeetButton.jsx";
import "../../App.css";

// ==================== HELPERS ====================
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

// ==================== STYLES ====================
// ✅ YOUR ORIGINAL STYLES - NOT CHANGED
const STYLES = `
  /* Poll Message */
  .pollMessageContainer { max-width: 340px; padding: 12px; border-radius: 12px; margin: 4px 0; position: relative; }
  .pollMine { background: #d9fdd3; margin-left: auto; border-bottom-right-radius: 4px; }
  .pollTheirs { background: #fff; margin-right: auto; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
  .pollHeader { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
  .pollIcon { font-size: 16px; }
  .pollLabel { font-size: 12px; font-weight: 600; color: #00a884; text-transform: uppercase; letter-spacing: 0.5px; }
  .pollQuestion { font-size: 15px; font-weight: 600; color: #111b21; margin-bottom: 12px; line-height: 1.4; }
  .pollOptionsList { display: flex; flex-direction: column; gap: 8px; }
  .pollOptionBtn { width: 100%; padding: 12px 14px; border: 1.5px solid #e9edef; border-radius: 10px; background: #fff; cursor: pointer; transition: all 0.2s ease; text-align: left; position: relative; overflow: hidden; }
  .pollOptionBtn:hover { border-color: #00a884; background: #f0fdf4; }
  .pollOptionSelected { border-color: #00a884; background: #dcfce7; }
  .pollOptionContent { display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 1; }
  .pollOptionLeft { display: flex; align-items: center; gap: 10px; }
  .pollCheckCircle { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #d1d5db; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; flex-shrink: 0; }
  .pollCheckCircleSelected { background: #00a884; border-color: #00a884; }
  .pollCheckMark { color: #fff; font-size: 12px; font-weight: bold; }
  .pollOptionText { font-size: 14px; color: #111b21; font-weight: 500; }
  .pollVoteCount { font-size: 13px; font-weight: 600; color: #00a884; min-width: 24px; text-align: right; }
  .pollProgressBar { position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: #e9edef; border-radius: 0 0 8px 8px; }
  .pollProgressFill { height: 100%; background: #d1d5db; border-radius: 0 0 8px 8px; transition: width 0.4s ease; }
  .pollProgressFillSelected { background: #00a884; }
  .pollFooter { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.06); }
  .pollTotalVotes { font-size: 12px; color: #667781; font-weight: 500; }
  .pollMultipleHint { font-size: 11px; color: #8696a0; }
  .pollTimestamp { font-size: 11px; color: #667781; text-align: right; margin-top: 6px; }

  /* Poll Modal */
  .pollModal { width: 90%; max-width: 420px; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
  .pollModalHeader { padding: 20px 24px; background: linear-gradient(135deg, #00a884 0%, #00876a 100%); color: #fff; }
  .pollModalTitle { font-size: 20px; font-weight: 700; margin: 0 0 4px 0; display: flex; align-items: center; gap: 10px; }
  .pollModalSubtitle { font-size: 13px; opacity: 0.9; margin: 0; }
  .pollModalBody { padding: 24px; max-height: 60vh; overflow-y: auto; }
  .pollInputGroup { margin-bottom: 20px; }
  .pollInputLabel { font-size: 13px; font-weight: 600; color: #00a884; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block; }
  .pollQuestionInput { width: 100%; padding: 14px 16px; border: 2px solid #e9edef; border-radius: 12px; font-size: 15px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; resize: none; box-sizing: border-box; }
  .pollQuestionInput:focus { border-color: #00a884; box-shadow: 0 0 0 3px rgba(0,168,132,0.1); }
  .pollQuestionInput::placeholder { color: #a0aec0; }
  .pollOptionsContainer { display: flex; flex-direction: column; gap: 10px; }
  .pollOptionInputRow { display: flex; align-items: center; gap: 10px; }
  .pollOptionNumber { width: 28px; height: 28px; border-radius: 50%; background: #f0f2f5; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: #667781; flex-shrink: 0; }
  .pollOptionInput { flex: 1; padding: 12px 14px; border: 2px solid #e9edef; border-radius: 10px; font-size: 14px; outline: none; transition: border-color 0.2s; }
  .pollOptionInput:focus { border-color: #00a884; }
  .pollOptionInput::placeholder { color: #a0aec0; }
  .pollRemoveOptionBtn { width: 32px; height: 32px; border-radius: 50%; border: none; background: #fee2e2; color: #dc2626; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
  .pollRemoveOptionBtn:hover { background: #fecaca; transform: scale(1.05); }
  .pollRemoveOptionBtn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }
  .pollAddOptionBtn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border: 2px dashed #d1d5db; border-radius: 10px; background: transparent; color: #00a884; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-top: 6px; width: 100%; }
  .pollAddOptionBtn:hover { border-color: #00a884; background: #f0fdf4; }
  .pollAddOptionBtn:disabled { opacity: 0.4; cursor: not-allowed; }
  .pollSettingsSection { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e9edef; }
  .pollSettingRow { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; }
  .pollSettingInfo { flex: 1; }
  .pollSettingTitle { font-size: 14px; font-weight: 600; color: #111b21; margin-bottom: 2px; }
  .pollSettingDesc { font-size: 12px; color: #667781; }
  .toggleSwitch { position: relative; width: 48px; height: 26px; flex-shrink: 0; }
  .toggleSwitch input { opacity: 0; width: 0; height: 0; }
  .toggleSlider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #d1d5db; border-radius: 26px; transition: 0.3s; }
  .toggleSlider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
  .toggleSwitch input:checked + .toggleSlider { background-color: #00a884; }
  .toggleSwitch input:checked + .toggleSlider:before { transform: translateX(22px); }
  .pollModalFooter { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e9edef; }
  .pollCancelBtn { padding: 12px 24px; border: 1px solid #d1d5db; border-radius: 10px; background: #fff; color: #374151; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .pollCancelBtn:hover { background: #f3f4f6; }
  .pollCreateBtn { padding: 12px 28px; border: none; border-radius: 10px; background: linear-gradient(135deg, #00a884 0%, #00876a 100%); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
  .pollCreateBtn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,168,132,0.4); }
  .pollCreateBtn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

  /* System Message */
  .waSystemMessageWrap { display: flex; justify-content: center; padding: 6px 20px; }
  .waSystemMessage { background: #fdf6e3; color: #54656f; font-size: 12.5px; padding: 6px 14px; border-radius: 8px; text-align: center; max-width: 85%; box-shadow: 0 1px 1px rgba(0,0,0,0.06); }

  /* Info Drawer */
  .drawerHeader { display: flex; align-items: center; gap: 15px; padding: 15px 20px; background: #fff; border-bottom: 1px solid #e9edef; }
  .drawerTitle { font-size: 16px; font-weight: 600; color: #111b21; }
  .drawerBody { flex: 1; overflow-y: auto; background: #f0f2f5; display: flex; flex-direction: column; }
  .infoProfileHero { background: #f0f2f5; padding: 25px 20px; text-align: center; }
  .infoAvatarLarge { width: 150px; height: 150px; border-radius: 50%; object-fit: cover; margin: 0 auto 15px; display: block; }
  .infoNameDisplay { font-size: 22px; font-weight: 700; color: #111b21; margin: 0 0 5px 0; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .infoStatusDisplay { font-size: 14px; color: #667781; margin: 0; }
  .infoCardSection { background: #fff; padding: 14px 20px; border-radius: 8px; margin: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  .sectionLabel { font-size: 14px; font-weight: 600; color: #8696a0; margin-bottom: 6px; display: block; }
  .sectionLabelGreen { font-size: 14px; font-weight: 600; color: #00a884; margin-bottom: 6px; display: block; }
  .infoValueText { font-size: 15px; color: #111b21; line-height: 1.4; }
  .groupQuickActions { display: flex; justify-content: center; gap: 30px; background: #fff; padding: 20px; margin: 0 10px 10px 10px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  .quickActionItem { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; }
  .actionCircle { width: 44px; height: 44px; border-radius: 50%; border: 1px solid #e9edef; display: flex; align-items: center; justify-content: center; color: #00a884; font-size: 20px; }
  .actionLabel { color: #111b21; font-size: 13px; font-weight: 500; }
  .infoListItem { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: #fff; margin: 0 10px 10px 10px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); cursor: pointer; }
  .listItemTitle { font-size: 15px; color: #111b21; font-weight: 600; }
  .drawerSearchInput { width: 100%; padding: 10px 14px; background: #f0f2f5; border: 1px solid #e9edef; border-radius: 8px; outline: none; font-size: 14px; margin-bottom: 15px; box-sizing: border-box; }
  .footerBtnGrid { display: flex; gap: 10px; margin: 0 10px 10px 10px; }
  .footerActionBtn { flex: 1; padding: 12px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; font-size: 14px; }
  .footerActionBtn.gray { background: #f0f2f5; color: #111b21; border: 1px solid #e9edef; }
  .footerActionBtn.orange { background: #ff6b00; color: white; }
  .exitLinkBtn { width: 100%; color: #ea0038; background: none; border: none; font-size: 15px; padding: 15px 20px; text-align: left; cursor: pointer; }
  .closeBtnMain { background: #00a884; color: white; padding: 8px 24px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
`;

// ==================== POLL MESSAGE COMPONENT ====================
function PollMessage({ message, onVote }) {
  const pollData = message.pollOptions || [];
  const totalVotes = pollData.reduce((sum, opt) => sum + (opt.votes || 0), 0);
  const myVotes = message.myVotes || [];
  const isMine = message.isMine || message.sender === "me";
  const hasVoted = myVotes.length > 0;

  return (
    <div className={`pollMessageContainer ${isMine ? "pollMine" : "pollTheirs"}`}>
      <div className="pollHeader">
        <span className="pollIcon">📊</span>
        <span className="pollLabel">Poll</span>
      </div>

      <div className="pollQuestion">{message.pollQuestion || message.text}</div>

      <div className="pollOptionsList">
        {pollData.map((option, index) => {
          const voteCount = option.votes || 0;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isSelected = myVotes.includes(index);
          return (
            <button
              key={option.id || index}
              className={`pollOptionBtn ${isSelected ? "pollOptionSelected" : ""} ${hasVoted ? "pollOptionVoted" : ""}`}
              onClick={() => onVote(message.id, option.id, index)}
            >
              <div className="pollOptionContent">
                <div className="pollOptionLeft">
                  <div className={`pollCheckCircle ${isSelected ? "pollCheckCircleSelected" : ""}`}>
                    {isSelected && <span className="pollCheckMark">✓</span>}
                  </div>
                  <span className="pollOptionText">{option.text}</span>
                </div>
                {hasVoted && <span className="pollVoteCount">{voteCount}</span>}
              </div>
              {hasVoted && (
                <div className="pollProgressBar">
                  <div className={`pollProgressFill ${isSelected ? "pollProgressFillSelected" : ""}`} style={{ width: `${percentage}%` }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="pollFooter">
        <span className="pollTotalVotes">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
        {message.allowMultiple && <span className="pollMultipleHint">• Select multiple</span>}
      </div>
      <div className="pollTimestamp">{formatTime(message.createdAt)}</div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMediaQuery("(min-width: 900px)");
  const myId = getAuthUserId();

  // ── Derived values ──────────────────────────────────────────────
  const isGroup = useMemo(
    () => String(chatId).startsWith("group-") || location.pathname.startsWith("/groups"),
    [chatId, location.pathname]
  );
  const targetId = useMemo(
    () => String(chatId).replace("emp-", "").replace("group-", ""),
    [chatId]
  );

  // ── Hooks ───────────────────────────────────────────────────────
  const {
    messages, loading: messagesLoading, isConnected, connectionStatus,
    sendTextMessage, sendFile, sendTypingIndicator, sendReaction,
    markAsRead, typingUsers, canChat, chatRestrictionReason,
  } = useChat(chatId, isGroup);

  const {
    chats, getChatById, toggleStar, togglePin, isAdmin, receiveMessage,
    showToast, toggleBlockChat, deleteEmployeeGlobally, forwardMessages,
    editMessage: ctxEditMessage, addGroupMember, removeGroupMember,
    promoteAdmin, leaveGroup, deleteChat, deleteMessageForMe,
    deleteMessageForAll, currentUser, getOnlineStatus, updateGroupChatPermission,
  } = useChats();

  // ── Derived state ───────────────────────────────────────────────
  const currentChat = getChatById(chatId);
  const isPersonalBlock = currentChat?.blocked || false;
  const isAdminBlocked = currentChat?.adminBlocked || false;
  const amISuspended = currentUser?.is_suspended || false;

  // ── Local state ─────────────────────────────────────────────────
  const [chatInfo, setChatInfo] = useState(null);
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [previewMedia, setPreviewMedia] = useState("");
  const [deletePrompt, setDeletePrompt] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [activeThreadMsgId, setActiveThreadMsgId] = useState(null);
  const [threadText, setThreadText] = useState("");
  const [showMediaDocs, setShowMediaDocs] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [addMemberSelect, setAddMemberSelect] = useState("");

  // Forward
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardTargets, setForwardTargets] = useState([]);

  // Local message overrides
  const [localStars, setLocalStars] = useState({});
  const [localPins, setLocalPins] = useState({});
  const [localMeets, setLocalMeets] = useState([]);
  const [localEdits, setLocalEdits] = useState({});
  const [localDeletes, setLocalDeletes] = useState(new Set());
  const [localDeletesForAll, setLocalDeletesForAll] = useState(new Set());
  const [localThreads, setLocalThreads] = useState({});
  const [localPollUpdates, setLocalPollUpdates] = useState({});

  // Poll modal
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [creatingPoll, setCreatingPoll] = useState(false);

  // Chat permissions
  const [permissionSetting, setPermissionSetting] = useState("all");
  const [selectedChatters, setSelectedChatters] = useState([]);
  const [savingPermission, setSavingPermission] = useState(false);

  // ✅ NEW: Member operation loading states
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);

  // ── Refs ─────────────────────────────────────────────────────────
  const endRef = useRef(null);
  const membersRef = useRef(null);
  const composerInputRef = useRef(null);
  const messageRefs = useRef({});
  const lastTypingRef = useRef(0);
  const combinedMessagesRef = useRef([]);

  // ── Computed ─────────────────────────────────────────────────────
  const isGroupAdmin = isGroup && (
    chatInfo?.members?.find((m) => String(m.id) === String(currentUser?.id))?.isAdmin ||
    chatInfo?.members?.find((m) => String(m.id) === String(currentUser?.id))?.isCreator ||
    isAdmin
  );

  const canPost =
    !amISuspended &&
    !chatInfo?.hasLeft &&
    (!chatInfo?.isBroadcast || isGroupAdmin || isAdmin) &&
    ((!isPersonalBlock && !isAdminBlocked) || isAdmin) &&
    (!isGroup || canChat || isAdmin);

  // ── Reset on chat change ─────────────────────────────────────────
  useEffect(() => {
    setSearchOpen(false);
    setSearchTerm("");
    setShowChatInfo(false);
    setMemberSearchQuery("");
    setShowMediaDocs(false);
    setSelectionMode(false);
    setSelectedMessages([]);
    setEditingMessage(null);
    setReplyingTo(null);
    setLocalStars({});
    setLocalPins({});
    setLocalEdits({});
    setLocalDeletes(new Set());
    setLocalPollUpdates({});
    setLocalMeets([]);
    setPermissionSetting("all");
    setSelectedChatters([]);
  }, [chatId]);

  // ── Load chat info ───────────────────────────────────────────────
  // ✅ FIXED: Extracted as reusable callback so it can be called after add/remove
  const reloadChatInfo = useCallback(async () => {
    if (!targetId) return;
    try {
      if (isGroup) {
        setChatInfo(await fetchGroupDetails(targetId));
      } else {
        const users = await fetchUsers();
        setChatInfo(users.find((u) => String(u.id) === targetId));
      }
    } catch (err) {
      console.error("ChatPage loadInfo error:", err);
    }
  }, [targetId, isGroup]);

  useEffect(() => {
    reloadChatInfo();
  }, [reloadChatInfo]);

  // ── Sync permission settings from chatInfo ───────────────────────
  useEffect(() => {
    if (chatInfo?.chatPermission) setPermissionSetting(chatInfo.chatPermission);
    if (chatInfo?.allowedChatters) setSelectedChatters(chatInfo.allowedChatters);
  }, [chatInfo?.chatPermission, chatInfo?.allowedChatters]);

  // ── Scroll & mark read ───────────────────────────────────────────
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    if (isConnected && messages.length > 0) markAsRead();
  }, [messages.length, isConnected, markAsRead]);

  // ── WebSocket event listeners ────────────────────────────────────
  useEffect(() => {
    const onPollUpdate = (e) => {
      if (!e.detail) return;
      const d = e.detail;
      setLocalPollUpdates((prev) => ({
        ...prev,
        [d.message_id]: {
          pollOptions: d.pollOptions,
          myVotes: d.myVotes || prev[d.message_id]?.myVotes || [],
          totalVotes: d.totalVotes,
        },
      }));
    };
    window.addEventListener("poll_update", onPollUpdate);
    return () => window.removeEventListener("poll_update", onPollUpdate);
  }, []);

  useEffect(() => {
    // ✅ FIXED: Use reloadChatInfo instead of inline fetch
    const onPermissionChange = () => { reloadChatInfo(); };
    window.addEventListener("chat_permission_changed", onPermissionChange);
    return () => window.removeEventListener("chat_permission_changed", onPermissionChange);
  }, [reloadChatInfo]);

  // ── Combined messages ────────────────────────────────────────────
  const combinedMessages = useMemo(() => {
    const map = new Map();

    const process = (m) => {
      if (localDeletes.has(m.id)) return null;
      let msg = { ...m };

      if (!msg.type && msg.messageType) msg.type = msg.messageType;
      if (!msg.messageType && msg.type) msg.messageType = msg.type;
      if (!msg.senderName && msg.sender_name) msg.senderName = msg.sender_name;

      if (msg.isMine == null) {
        if (msg.sender === "me") msg.isMine = true;
        else if (msg.sender === "them") msg.isMine = false;
        else if (msg.senderId || msg.sender_id) {
          msg.isMine = String(msg.senderId || msg.sender_id) === String(myId);
          msg.sender = msg.isMine ? "me" : "them";
        }
      }

      if (localDeletesForAll.has(m.id)) {
        msg = { ...msg, text: "🚫 This message was deleted", isDeleted: true, deletedForAll: true, type: "text", messageType: "text", fileUrl: null, pollOptions: null, pollQuestion: null };
      } else if (localEdits[m.id]) {
        msg.text = localEdits[m.id];
        msg.isEdited = true;
      }

      if ((msg.type === "poll" || msg.messageType === "poll") && localPollUpdates[m.id]) {
        const u = localPollUpdates[m.id];
        msg.pollOptions = u.pollOptions;
        msg.myVotes = u.myVotes;
        msg.totalVotes = u.totalVotes;
      }

      if (localThreads[m.id]) {
        const existingIds = new Set((msg.thread || []).map((t) => t.id));
        msg.thread = [...(msg.thread || []), ...localThreads[m.id].filter((t) => !existingIds.has(t.id))];
      }

      if (localStars[m.id] !== undefined) msg.isStarred = localStars[m.id];
      if (localPins[m.id] !== undefined) msg.isPinned = localPins[m.id];
      return msg;
    };

    [...(messages || []), ...localMeets].forEach((m) => {
      const p = process(m);
      if (p) map.set(p.id, p);
    });

    return Array.from(map.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [messages, localMeets, localEdits, localDeletes, localDeletesForAll, localThreads, localStars, localPins, localPollUpdates, myId]);

  useEffect(() => { combinedMessagesRef.current = combinedMessages; }, [combinedMessages]);

  // ── Derived message lists ────────────────────────────────────────
  const filteredMessages = useMemo(() => {
    if (!searchTerm) return combinedMessages;
    return combinedMessages.filter((m) => m.text?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [combinedMessages, searchTerm]);

  const messageGroups = useMemo(() => {
    const groups = [];
    filteredMessages.forEach((m) => {
      if (m.deletedForAll && m.isDeleted) return;
      const day = formatDay(m.createdAt);
      let group = groups.find((g) => g.day === day);
      if (!group) { group = { day, messages: [] }; groups.push(group); }
      group.messages.push(m);
    });
    return groups;
  }, [filteredMessages]);

  const pinnedMessages = useMemo(() => combinedMessages.filter((m) => m.isPinned && !m.deletedForAll), [combinedMessages]);
  const mediaMessages = useMemo(() => combinedMessages.filter((m) => ["image", "video", "document"].includes(m.type) || m.fileUrl), [combinedMessages]);
  const activeThreadMsg = useMemo(() => activeThreadMsgId ? combinedMessages.find((m) => m.id === activeThreadMsgId) : null, [combinedMessages, activeThreadMsgId]);
  const commonGroups = useMemo(() => {
    if (isGroup || !chats) return [];
    return chats.filter((c) => c.kind === "group" && c.members?.some((m) => String(m.id) === targetId));
  }, [chats, targetId, isGroup]);

  // ── Header subtext ───────────────────────────────────────────────
  const getHeaderSubtext = () => {
    if (typingUsers?.length > 0) {
      return typingUsers.length === 1
        ? `${typingUsers[0].name} is typing...`
        : `${typingUsers.length} people are typing...`;
    }
    if (isGroup) return `${chatInfo?.memberCount || 0} members`;

    const info = getOnlineStatus(String(chatInfo?.id));
    if (info?.isOnline || chatInfo?.isOnline) return "🟢 Online";

    const lastSeen = info?.lastSeen || chatInfo?.lastSeen;
    if (lastSeen) {
      const mins = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000);
      if (mins < 1) return "Last seen just now";
      if (mins < 60) return `Last seen ${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `Last seen ${hrs}h ago`;
      return `Last seen ${new Date(lastSeen).toLocaleDateString()}`;
    }

    const status = chatInfo?.status;
    if (status === "dnd") return "🔴 Do Not Disturb";
    if (status === "meeting") return "🗓️ In a Meeting";
    return isConnected ? "offline" : connectionStatus;
  };

  // ── Handlers ─────────────────────────────────────────────────────
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
      setLocalEdits((prev) => ({ ...prev, [editingMessage.id]: v }));
      setEditingMessage(null);
    } else {
      sendTextMessage(v, replyingTo?.id || null);
    }
    setText("");
    setReplyingTo(null);
    if (composerInputRef.current) composerInputRef.current.style.height = "auto";
  };

  const handleDeleteForMe = (id) => {
    const ids = Array.isArray(id) ? id : [id];
    ids.forEach((i) => { deleteMessageForMe(chatId, [i]); setLocalDeletes((prev) => new Set(prev).add(i)); });
    setDeletePrompt(null); setSelectionMode(false); setSelectedMessages([]);
  };

  const handleDeleteForAll = (id) => {
    const ids = Array.isArray(id) ? id : [id];
    ids.forEach((i) => { deleteMessageForAll(chatId, [i]); setLocalDeletesForAll((prev) => new Set(prev).add(i)); });
    setDeletePrompt(null); setSelectionMode(false); setSelectedMessages([]);
  };

  const handleMeetCreated = useCallback((apiResult) => {
    const msg = {
      id: apiResult?.id || `meet-${Date.now()}`,
      type: "meet", messageType: "meet",
      text: apiResult?.title ? `Meeting: ${apiResult.title}` : "Join Meeting",
      meetTitle: apiResult?.title || "Meeting",
      meetLink: apiResult?.meet_link || apiResult?.meetLink || "",
      meetScheduledAt: apiResult?.scheduled_at || apiResult?.scheduledAt || Date.now(),
      createdAt: Date.now(), isMine: true,
      senderName: currentUser?.name || "You", sender: "me",
    };
    setLocalMeets((prev) => [...prev, msg]);
    if (receiveMessage) receiveMessage(chatId, msg);
  }, [chatId, receiveMessage, currentUser]);

  const handleSendThread = () => {
    const v = threadText.trim();
    if (!v || !activeThreadMsgId) return;
    setLocalThreads((prev) => ({
      ...prev,
      [activeThreadMsgId]: [...(prev[activeThreadMsgId] || []), {
        id: `thread-${Date.now()}`, sender: "me",
        senderName: currentUser?.name || "You", text: v, createdAt: Date.now(),
      }],
    }));
    setThreadText("");
  };

  const handlePollVote = useCallback(async (messageId, optionId) => {
    const msg = combinedMessagesRef.current.find((m) => m.id === messageId);
    if (!msg?.pollId) { showToast("Poll not found", "error"); return; }
    try {
      const result = await votePoll(msg.pollId, optionId);
      setLocalPollUpdates((prev) => ({
        ...prev,
        [messageId]: { pollOptions: result.pollOptions, myVotes: result.myVotes, totalVotes: result.totalVotes },
      }));
    } catch (err) {
      showToast(err.message || "Failed to vote", "error");
    }
  }, [showToast]);

  const handleCreatePoll = async () => {
    const validOptions = pollOptions.filter((o) => o.trim());
    if (!pollQuestion.trim()) { showToast("Please add a question", "error"); return; }
    if (validOptions.length < 2) { showToast("Please add at least 2 options", "error"); return; }
    setCreatingPoll(true);
    try {
      const result = await createPoll({
        question: pollQuestion.trim(),
        options: validOptions.map((o) => o.trim()),
        allowMultiple: allowMultipleVotes,
        receiverId: !isGroup ? parseInt(targetId) : null,
        groupId: isGroup ? parseInt(targetId) : null,
      });
      setLocalMeets((prev) => [...prev, {
        id: result.id, type: "poll", messageType: "poll",
        text: result.pollQuestion, pollQuestion: result.pollQuestion,
        pollOptions: result.pollOptions, pollId: result.pollId,
        allowMultiple: result.allowMultiple, totalVotes: 0, myVotes: [],
        createdAt: result.createdAt, isMine: true,
        senderName: currentUser?.name || "You", sender: "me", sender_id: myId,
      }]);
      setShowPollModal(false); setPollQuestion(""); setPollOptions(["", ""]); setAllowMultipleVotes(false);
      // showToast("Poll created!", "success");
    } catch (err) {
      showToast(err.message || "Failed to create poll", "error");
    } finally {
      setCreatingPoll(false);
    }
  };

  // ✅ FIXED: Use reloadChatInfo after saving permission
  const handleSavePermission = async () => {
    setSavingPermission(true);
    try {
      await updateGroupChatPermission(chatId, permissionSetting, selectedChatters);
      await reloadChatInfo();
    } catch (_) {}
    finally { setSavingPermission(false); }
  };

  // ✅ FIXED: Add member with guard + reload
  const handleAddMember = useCallback(async () => {
    if (!addMemberSelect || addingMember) return;
    setAddingMember(true);
    try {
      await addGroupMember(chatId, addMemberSelect);
      setAddMemberSelect("");
      showToast("Member added", "success");
      await new Promise(r => setTimeout(r, 500));
      await reloadChatInfo();
    } catch (err) {
      showToast(err?.message || "Failed to add member", "error");
    } finally {
      setAddingMember(false);
    }
  }, [addMemberSelect, addingMember, chatId, addGroupMember, reloadChatInfo, showToast]);

  // ✅ FIXED: Remove member with guard + reload
  const handleRemoveMember = useCallback(async (memberId) => {
    if (removingMemberId) return;
    setRemovingMemberId(memberId);
    try {
      await removeGroupMember(chatId, memberId);
      showToast("Member removed", "success");
      await new Promise(r => setTimeout(r, 500));
      await reloadChatInfo();
    } catch (err) {
      showToast(err?.message || "Failed to remove member", "error");
    } finally {
      setRemovingMemberId(null);
    }
  }, [removingMemberId, chatId, removeGroupMember, reloadChatInfo, showToast]);

  // ── Early return ─────────────────────────────────────────────────
  if (!chatId) {
    return (
      <div className="chatEmpty">
        <div className="chatEmptyIllustration">💬</div>
        <div className="chatEmptyTitle">Oppty Chats</div>
        <div className="muted chatEmptySubtitle">Select a conversation to start messaging.</div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="chat">
      <style>{STYLES}</style>

      {/* ── HEADER ── */}
      <header className={`chatHeader ${selectionMode ? "selectionModeActive" : ""}`}>
        {selectionMode ? (
          <div className="selectionHeaderContent">
            <button className="iconBtn" onClick={() => { setSelectionMode(false); setSelectedMessages([]); }}>✕</button>
            <span className="selectionCount">{selectedMessages.length} selected</span>
            <div className="selectionActions">
              <button className="iconBtn" title="Star" onClick={() => {
                selectedMessages.forEach((id) => {
                  const current = localStars[id] !== undefined ? localStars[id] : combinedMessages.find((m) => m.id === id)?.isStarred;
                  setLocalStars((prev) => ({ ...prev, [id]: !current }));
                  toggleStar(chatId, id);
                });
                setSelectionMode(false); setSelectedMessages([]);
              }}>⭐</button>
              <button className="iconBtn" title="Delete" onClick={() => setDeletePrompt({ id: selectedMessages, type: "me" })}>🗑️</button>
              <button className="iconBtn" title="Forward" onClick={() => {
                setForwardingMessage(combinedMessages.filter((m) => selectedMessages.includes(m.id)));
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
              {!isDesktop && (
                <div className="iconBtn" style={{ marginRight: 8 }} onClick={(e) => { e.stopPropagation(); navigate(isGroup ? "/groups" : "/chats"); }}>←</div>
              )}
              <img className="avatar" src={chatInfo?.avatarUrl} alt=""
                onError={(e) => (e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(chatInfo?.name || "U")}&background=random`)} />
              <div className="chatHeaderText">
                <div className="chatHeaderName">
                  {chatInfo?.name} {isAdminBlocked ? "🚫" : isPersonalBlock ? "🔒" : ""}
                </div>
                <div className="chatHeaderMeta">{getHeaderSubtext()}</div>
              </div>
            </button>
            <div className="chatHeaderActions">
              <button className="iconBtn" onClick={() => setSearchOpen(true)}>⌕</button>
              <button className="iconBtn" onClick={() => setShowOptionsMenu((p) => !p)}>⋯</button>
              {showOptionsMenu && (
                <div className="chatOptionsMenu">
                  <button className="chatOptionsItem" onClick={() => { setShowChatInfo(true); setShowOptionsMenu(false); }}>View info</button>
                  <button className="chatOptionsItem" onClick={() => { setSelectionMode(true); setShowOptionsMenu(false); }}>Select messages</button>
                </div>
              )}
            </div>
          </>
        )}
      </header>

      {/* ── PINNED BANNER ── */}
      {pinnedMessages.length > 0 && !searchOpen && !selectionMode && (
        <div className="pinnedMessagesBanner" onClick={() => messageRefs.current[pinnedMessages[0].id]?.scrollIntoView({ behavior: "smooth", block: "center" })}>
          <span className="pinnedIcon">📌</span>
          <div>
            <div className="pinnedTitle">Pinned Message</div>
            <div className="pinnedSnippet">{pinnedMessages[0].text || "Attachment"}</div>
          </div>
        </div>
      )}

      {/* ── MESSAGES ── */}
      <section className="messages" aria-label="Messages">
        {messageGroups.map((g) => (
          <div key={g.day}>
            <div className="dayChip">{g.day}</div>
            {g.messages.map((m) => (
              <div key={m.id} ref={(el) => { messageRefs.current[m.id] = el; }}>
                {(m.type === "system" || m.messageType === "system" || m.isSystemMessage) ? (
                  <div className="waSystemMessageWrap">
                    <div className="waSystemMessage">{m.text}</div>
                  </div>
                ) : (m.type === "poll" || m.messageType === "poll") ? (
                  <PollMessage message={m} onVote={handlePollVote} />
                ) : (
                  <MessageBubble
                    message={m}
                    isGroup={isGroup}
                    selectionMode={selectionMode}
                    isSelected={selectedMessages.includes(m.id)}
                    onToggleSelect={() => {
                      setSelectionMode(true);
                      setSelectedMessages((prev) => prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]);
                    }}
                    onReaction={(emoji) => {
                      const map = { "👍": "ok", "👎": "not_ok", "❤️": "love", "😂": "laugh", "😮": "wow", "😢": "sad", "🙏": "ok" };
                      sendReaction(m.id, map[emoji] || "ok");
                    }}
                    onStar={() => {
                      const cur = localStars[m.id] !== undefined ? localStars[m.id] : m.isStarred;
                      setLocalStars((prev) => ({ ...prev, [m.id]: !cur }));
                      toggleStar(chatId, m.id);
                    }}
                    onPin={() => {
                      const cur = localPins[m.id] !== undefined ? localPins[m.id] : m.isPinned;
                      setLocalPins((prev) => ({ ...prev, [m.id]: !cur }));
                      togglePin(chatId, m.id);
                    }}
                    onEdit={() => { setEditingMessage(m); setText(m.text); setReplyingTo(null); }}
                    onForward={() => { setForwardingMessage([m]); setShowForwardModal(true); }}
                    onDeleteForMe={() => setDeletePrompt({ id: m.id, type: "me" })}
                    onDeleteForAll={() => setDeletePrompt({ id: m.id, type: "all" })}
                    canDeleteForAll={m.isMine && m.canDeleteForEveryone}
                    onReply={() => { setReplyingTo(m); setEditingMessage(null); }}
                    onOpenThread={() => setActiveThreadMsgId(m.id)}
                    onPreviewImage={(url) => setPreviewMedia(url)}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
        <div ref={endRef} />
      </section>

      {/* ── COMPOSER / FOOTER ── */}
      {amISuspended ? (
        <footer className="composer composerDisabled" style={{ background: "#ffebee", color: "#c62828" }}>
          🚫 Your account has been suspended by an Admin.
        </footer>
      ) : isAdminBlocked && !isAdmin ? (
        <footer className="composer composerDisabled" style={{ background: "#ffebee", color: "#c62828" }}>
          🚫 This employee has been suspended globally.
        </footer>
      ) : isPersonalBlock ? (
        <footer className="composer composerDisabled">🔒 You have blocked this contact.</footer>
      ) : chatInfo?.hasLeft ? (
        <footer className="composer composerDisabled">You are no longer a participant.</footer>
      ) : isGroup && !canChat && !isAdmin ? (
        <footer className="composer composerDisabled" style={{ background: "#fff8e1", color: "#92400e", justifyContent: "center" }}>
          <span style={{ fontSize: 18, marginRight: 8 }}>🔒</span>
          {chatRestrictionReason || "Only admins can send messages in this group."}
        </footer>
      ) : (
        <footer className="composer">
          {/* Reply bar */}
          {replyingTo && (
            <div className="waComposerReplyBar animatedFadeIn">
              <div className="waComposerReplyAccent" />
              <div className="waComposerReplyContent">
                <div className="waComposerReplyTitle">{replyingTo.senderName || "Reply"}</div>
                <div className="waComposerReplyText">
                  {replyingTo.type === "image" ? "🖼 Photo" : replyingTo.type === "document" ? "📄 Document" : replyingTo.text?.substring(0, 50) || "Message"}
                </div>
              </div>
              <button type="button" className="waComposerReplyClose" onClick={() => setReplyingTo(null)}>✕</button>
            </div>
          )}

          {/* Edit bar */}
          {editingMessage && (
            <div className="waComposerReplyBar animatedFadeIn">
              <div className="waComposerReplyAccent" style={{ background: "#f59e0b" }} />
              <div className="waComposerReplyContent">
                <div className="waComposerReplyTitle">Editing message</div>
                <div className="waComposerReplyText">{editingMessage.text}</div>
              </div>
              <button type="button" className="waComposerReplyClose" onClick={() => { setEditingMessage(null); setText(""); }}>✕</button>
            </div>
          )}

          <button className="iconBtn" onClick={() => setShowPollModal(true)} title="Create Poll" disabled={!isConnected || !canPost}>📊</button>
          <FileUploadButton onFileSelect={(f) => { if (canPost) sendFile(f); }} disabled={!isConnected || !canPost} />
          <MeetButton targetId={!isGroup ? targetId : null} groupId={isGroup ? targetId : null} members={chatInfo?.members || []} disabled={!isConnected || !canPost} onMeetCreated={handleMeetCreated} />

          <textarea
            ref={composerInputRef}
            className="composerInput"
            value={text}
            rows={1}
            onChange={handleTextInput}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={isConnected ? "Type a message..." : "Connecting..."}
            disabled={!isConnected || !canPost}
          />
          <button className="sendBtn" onClick={handleSend} disabled={!text.trim() || !isConnected || !canPost}>
            <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </button>
        </footer>
      )}

      {/* ── POLL MODAL ── */}
      {showPollModal && (
        <div className="mediaPreviewOverlay" style={{ zIndex: 4000 }} onClick={() => { setShowPollModal(false); setPollQuestion(""); setPollOptions(["", ""]); setAllowMultipleVotes(false); }}>
          <div className="pollModal" onClick={(e) => e.stopPropagation()}>
            <div className="pollModalHeader">
              <h3 className="pollModalTitle">📊 Create a Poll</h3>
              <p className="pollModalSubtitle">Ask a question and get instant feedback</p>
            </div>
            <div className="pollModalBody">
              <div className="pollInputGroup">
                <label className="pollInputLabel">Question</label>
                <textarea className="pollQuestionInput" placeholder="Ask your question here..." value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} rows={2} autoFocus />
              </div>
              <div className="pollInputGroup">
                <label className="pollInputLabel">Options</label>
                <div className="pollOptionsContainer">
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="pollOptionInputRow">
                      <div className="pollOptionNumber">{i + 1}</div>
                      <input type="text" className="pollOptionInput" placeholder={`Option ${i + 1}`} value={opt} onChange={(e) => { const u = [...pollOptions]; u[i] = e.target.value; setPollOptions(u); }} />
                      <button type="button" className="pollRemoveOptionBtn" onClick={() => { if (pollOptions.length > 2) setPollOptions(pollOptions.filter((_, j) => j !== i)); }} disabled={pollOptions.length <= 2}>×</button>
                    </div>
                  ))}
                  <button type="button" className="pollAddOptionBtn" onClick={() => { if (pollOptions.length < 12) setPollOptions([...pollOptions, ""]); }} disabled={pollOptions.length >= 12}>
                    <span style={{ fontSize: 18 }}>+</span> Add option {pollOptions.length < 12 && `(${12 - pollOptions.length} remaining)`}
                  </button>
                </div>
              </div>
              <div className="pollSettingsSection">
                <div className="pollSettingRow">
                  <div className="pollSettingInfo">
                    <div className="pollSettingTitle">Allow multiple answers</div>
                    <div className="pollSettingDesc">Let participants select more than one option</div>
                  </div>
                  <label className="toggleSwitch">
                    <input type="checkbox" checked={allowMultipleVotes} onChange={(e) => setAllowMultipleVotes(e.target.checked)} />
                    <span className="toggleSlider" />
                  </label>
                </div>
              </div>
            </div>
            <div className="pollModalFooter">
              <button className="pollCancelBtn" onClick={() => { setShowPollModal(false); setPollQuestion(""); setPollOptions(["", ""]); }} disabled={creatingPoll}>Cancel</button>
              <button className="pollCreateBtn" onClick={handleCreatePoll} disabled={!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2 || creatingPoll}>
                📤 {creatingPoll ? "Sending..." : "Send Poll"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INFO DRAWER ── */}
      {showChatInfo && (
        <div className="chatInfoOverlay" onClick={() => setShowChatInfo(false)}>
          <aside className="chatInfoDrawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawerHeader">
              <button className="iconBtn" onClick={() => setShowChatInfo(false)}>←</button>
              <div className="drawerTitle">{isGroup ? "Group info" : "Contact info"}</div>
            </div>

            <div className="drawerBody">
              {/* Profile hero */}
              <div className="infoProfileHero">
                <img className="infoAvatarLarge" src={chatInfo?.avatarUrl} alt=""
                  onError={(e) => (e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(chatInfo?.name || "U")}&background=random`)} />
                <h1 className="infoNameDisplay">
                  {chatInfo?.name}
                  {isGroup && isGroupAdmin && <span className="editPencilSmall">✎</span>}
                </h1>
                <p className="infoStatusDisplay">
                  {isGroup ? `Group · ${chatInfo?.memberCount} members` : getHeaderSubtext()}
                </p>
                {isAdminBlocked && <div className="adminTag" style={{ background: "#ffebee", color: "#c62828", display: "inline-block", marginTop: 5 }}>Suspended Globally</div>}
              </div>

              {/* Group quick actions */}
              {isGroup && (
                <div className="groupQuickActions">
                  <div className="quickActionItem" onClick={() => membersRef.current?.scrollIntoView({ behavior: "smooth" })}>
                    <div className="actionCircle">+</div>
                    <span className="actionLabel">Add</span>
                  </div>
                  <div className="quickActionItem" onClick={() => { setShowChatInfo(false); setSearchOpen(true); }}>
                    <div className="actionCircle">⌕</div>
                    <span className="actionLabel">Search</span>
                  </div>
                </div>
              )}

              {/* About / Description */}
              <div className="infoCardSection">
                <label className={isGroup ? "sectionLabelGreen" : "sectionLabel"}>
                  {isGroup ? "Description" : "About"}
                </label>
                <div className="infoValueText">
                  {isGroup ? chatInfo?.description || "Official team discussion group." : chatInfo?.about || "Available for chat"}
                </div>
              </div>

              {/* Email (DM only) */}
              {!isGroup && (
                <div className="infoCardSection">
                  <label className="sectionLabel">Email</label>
                  <div className="infoValueText">{chatInfo?.email || "N/A"}</div>
                </div>
              )}

              {/* Group created info */}
              {isGroup && (
                <div className="infoCardSection">
                  <div style={{ fontSize: 12, color: "#8696a0" }}>
                    Group created by {chatInfo?.createdBy || "Admin"} on {new Date(chatInfo?.createdAt || Date.now()).toLocaleDateString()}
                  </div>
                </div>
              )}

              {/* Media */}
              <div className="infoListItem" onClick={() => setShowMediaDocs(true)}>
                <span className="listItemTitle">Media, links and docs</span>
                <span style={{ color: "#8696a0", fontSize: 14, fontWeight: 600 }}>{mediaMessages.length} ❯</span>
              </div>

              {/* Disappearing messages */}
              <div className="infoCardSection" style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span className="listItemTitle">Disappearing messages</span>
                  <select style={{ padding: 6, border: "1px solid #e9edef", borderRadius: 6, outline: "none", background: "#f0f2f5" }}>
                    <option>Off</option>
                    <option>24 hours</option>
                    <option>7 days</option>
                  </select>
                </div>
                <div style={{ fontSize: 13, color: "#667781", lineHeight: 1.4 }}>
                  Messages disappear after the selected time. Pinned messages are kept.
                </div>
              </div>

              {/* Common groups (DM only) */}
              {!isGroup && commonGroups.length > 0 && (
                <div className="infoCardSection">
                  <label className="sectionLabel">{commonGroups.length} group{commonGroups.length > 1 ? "s" : ""} in common</label>
                  {commonGroups.map((g) => (
                    <div key={g.id} className="memberRow" style={{ cursor: "pointer", padding: "10px 0", borderBottom: "1px solid #f0f2f5" }} onClick={() => navigate(`/groups/${g.id}`)}>
                      <img src={g.avatarUrl} className="avatarSmall" alt="" />
                      <div className="memberMeta">
                        <span className="memberName">{g.name}</span>
                        <span className="memberEmail">You, {chatInfo?.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── MEMBERS (group only) - FIXED ── */}
              {isGroup && (
                <div className="infoCardSection" ref={membersRef}>
                  <div className="listItemTitle" style={{ marginBottom: 15 }}>{chatInfo?.memberCount} members</div>
                  <input className="drawerSearchInput" placeholder="Search members..." value={memberSearchQuery} onChange={(e) => setMemberSearchQuery(e.target.value)} />

                  {/* ✅ FIXED: Add member uses handleAddMember with loading guard */}
                  {isGroupAdmin && (
                    <div style={{ marginBottom: 15 }}>
                      <label className="sectionLabelGreen">Add member</label>
                      <div style={{ display: "flex", gap: 10 }}>
                        <select
                          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #e9edef", outline: "none", background: "#fff" }}
                          value={addMemberSelect}
                          onChange={(e) => setAddMemberSelect(e.target.value)}
                          disabled={addingMember}
                        >
                          <option value="">Select employee</option>
                          {chats.filter((c) => c.kind === "dm" && !chatInfo?.members?.some((m) => String(m.id) === String(c.odooId)))
                            .map((u) => <option key={u.odooId} value={u.odooId}>{u.name}</option>)}
                        </select>
                        <button
                          style={{
                            padding: "10px 20px",
                            background: addingMember ? "#ccc" : "#ffb36b",
                            color: "#fff", border: "none", borderRadius: 8, fontWeight: 600,
                            cursor: addingMember || !addMemberSelect ? "not-allowed" : "pointer",
                            opacity: addingMember || !addMemberSelect ? 0.6 : 1,
                          }}
                          onClick={handleAddMember}
                          disabled={!addMemberSelect || addingMember}
                        >
                          {addingMember ? "Adding..." : "Add"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Member list */}
                  <div className="memberList">
                    {(chatInfo?.members?.filter((m) => m.name.toLowerCase().includes(memberSearchQuery.toLowerCase())) || []).map((m) => {
                      const isRemoving = removingMemberId === m.id;
                      return (
                        <div key={m.id} className="memberRow" style={{ padding: "12px 0", borderBottom: "1px solid #f0f2f5" }}>
                          <img className="avatarSmall" src={m.avatarUrl} alt=""
                            onError={(e) => (e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=random`)} />
                          <div className="memberMeta">
                            <span className="memberName">
                              {m.name}
                              {String(m.id) === String(myId) && (
                                <span style={{ color: "#8696a0", fontWeight: 400 }}> (You)</span>
                              )}
                              {(m.isAdmin || m.isCreator || m.role === "admin" || m.role === "superadmin") && (
                                <span className="adminTag" style={{ color: "#00a884", background: "none", marginLeft: 4 }}>Admin</span>
                              )}
                              {chatInfo?.chatPermission !== "all" && !m.canChat && (
                                <span style={{ color: "#f59e0b", fontSize: 11, marginLeft: 4 }} title="Cannot chat">🔇</span>
                              )}
                            </span>
                            <span className="memberEmail" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: (() => { const o = getOnlineStatus(String(m.id)); return o?.isOnline ? "#00a884" : "#9ca3af"; })() }} />
                              {getOnlineStatus(String(m.id))?.isOnline ? "Online" : "Offline"}
                            </span>
                          </div>
                          <div className="memberActions">
                            {/* ✅ FIXED: Remove uses handleRemoveMember with loading guard */}
                            {isGroupAdmin && String(m.id) !== String(myId) && (
                              <button
                                style={{
                                  color: isRemoving ? "#999" : "#ea0038",
                                  background: "none", border: "none", fontWeight: 600,
                                  cursor: isRemoving ? "not-allowed" : "pointer",
                                  marginLeft: 10,
                                  opacity: isRemoving ? 0.5 : 1,
                                }}
                                onClick={() => handleRemoveMember(m.id)}
                                disabled={isRemoving}
                              >
                                {isRemoving ? "Removing..." : "Remove"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button className="exitLinkBtn" style={{ marginTop: 10 }} onClick={() => { leaveGroup(chatId); navigate("/groups"); }}>Exit group</button>
                </div>
              )}

              {/* ── CHAT PERMISSIONS (group admin only) ── */}
              {isGroup && isGroupAdmin && (
                <div className="infoCardSection" style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <label className="sectionLabelGreen" style={{ marginBottom: 0 }}>Chat Permissions</label>
                    <span style={{ fontSize: 12, color: "#667781", fontWeight: 500 }}>
                      {chatInfo?.chatPermission === "all" ? "👥 All" : chatInfo?.chatPermission === "admins_only" ? "👑 Admins" : "✅ Selected"}
                    </span>
                  </div>

                  <select style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e9edef", outline: "none", background: "#fff", marginBottom: 12, fontSize: 14 }}
                    value={permissionSetting} onChange={(e) => setPermissionSetting(e.target.value)}>
                    <option value="all">👥 All Members Can Chat</option>
                    <option value="admins_only">👑 Only Admins Can Chat</option>
                    <option value="selected">✅ Only Selected Members</option>
                  </select>

                  {permissionSetting === "selected" && (
                    <div style={{ marginBottom: 12 }}>
                      <label className="sectionLabel" style={{ marginBottom: 8, display: "block" }}>Select who can chat:</label>
                      <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e9edef", borderRadius: 8 }}>
                        {(chatInfo?.members || []).filter((m) => m.role !== "admin" && m.role !== "superadmin" && !m.isCreator).map((m) => (
                          <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f0f2f5" }}>
                            <input type="checkbox" checked={selectedChatters.includes(m.id)}
                              onChange={(e) => { if (e.target.checked) setSelectedChatters((p) => [...p, m.id]); else setSelectedChatters((p) => p.filter((id) => id !== m.id)); }}
                              style={{ width: 16, height: 16 }} />
                            <img src={m.avatarUrl} style={{ width: 28, height: 28, borderRadius: "50%" }} alt="" />
                            <span style={{ fontSize: 14, color: "#111b21" }}>{m.name}</span>
                          </label>
                        ))}
                      </div>
                      {selectedChatters.length > 0 && (
                        <div style={{ fontSize: 12, color: "#667781", marginTop: 6 }}>{selectedChatters.length} member{selectedChatters.length !== 1 ? "s" : ""} selected</div>
                      )}
                    </div>
                  )}

                  <button
                    style={{ width: "100%", padding: 12, background: savingPermission ? "#ccc" : "linear-gradient(135deg, #00a884, #00876a)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: savingPermission || (permissionSetting === "selected" && selectedChatters.length === 0) ? "not-allowed" : "pointer", opacity: savingPermission || (permissionSetting === "selected" && selectedChatters.length === 0) ? 0.5 : 1 }}
                    disabled={savingPermission || (permissionSetting === "selected" && selectedChatters.length === 0)}
                    onClick={handleSavePermission}>
                    {savingPermission ? "Saving..." : "Apply Permission"}
                  </button>
                </div>
              )}

              {/* ── DRAWER FOOTER ── */}
              <div className="drawerFooter" style={{ marginTop: "auto", paddingBottom: 20 }}>
                {!isGroup && isAdmin && (
                  <div className="footerBtnGrid">
                    <button className="footerActionBtn gray" onClick={() => { toggleBlockChat(chatId); showToast(isAdminBlocked ? "Employee Restored" : "Employee Suspended", "success"); }}>
                      {isAdminBlocked ? "Restore Employee" : "Suspend (Global)"}
                    </button>
                    <button className="footerActionBtn orange" onClick={() => { if (window.confirm("WARNING: This completely deletes the employee. Continue?")) { deleteEmployeeGlobally(chatId); navigate("/chats"); } }}>
                      Delete Contact
                    </button>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button className="closeBtnMain" onClick={() => setShowChatInfo(false)}>Close</button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── MEDIA DOCS ── */}
      {showMediaDocs && (
        <div className="mediaSharedOverlay" style={{ zIndex: 3500 }}>
          <div className="drawerHeader">
            <button className="iconBtn" onClick={() => setShowMediaDocs(false)}>←</button>
            <div className="drawerTitle">Media, links and docs</div>
          </div>
          <div className="mediaSharedBody" style={{ padding: 20, background: "#f0f2f5", flex: 1, overflowY: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 10 }}>
              {mediaMessages.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#667781", padding: 40 }}>No media shared yet.</div>
              ) : mediaMessages.map((m) => (
                <div key={m.id} style={{ aspectRatio: "1/1", background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e9edef", cursor: "pointer" }} onClick={() => setPreviewMedia(m.fileUrl)}>
                  {m.type === "image" ? <img src={m.fileUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <div style={{ display: "grid", placeItems: "center", height: "100%", fontSize: 30 }}>📄</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FORWARD MODAL ── */}
      {showForwardModal && (
        <div className="mediaPreviewOverlay" style={{ zIndex: 4000 }} onClick={() => { setShowForwardModal(false); setForwardTargets([]); }}>
          <div className="customModal" onClick={(e) => e.stopPropagation()} style={{ width: "90%", maxWidth: 400, padding: 0, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: 20, borderBottom: "1px solid #eee", background: "#f5f6f6" }}>
              <h3 style={{ margin: 0, color: "#111b21", fontSize: 18 }}>Forward to...</h3>
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto", padding: 10 }}>
              {chats.map((c) => (
                <label key={c.id} style={{ display: "flex", alignItems: "center", padding: 10, cursor: "pointer", gap: 12, borderRadius: 8 }}
                  onMouseOver={(e) => (e.currentTarget.style.background = "#f5f6f6")}
                  onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}>
                  <input type="checkbox" checked={forwardTargets.includes(c.id)}
                    onChange={(e) => { if (e.target.checked) setForwardTargets((p) => [...p, c.id]); else setForwardTargets((p) => p.filter((id) => id !== c.id)); }}
                    style={{ width: 18, height: 18, cursor: "pointer" }} />
                  <img src={c.avatarUrl} alt="" style={{ width: 40, height: 40, borderRadius: "50%" }} />
                  <div style={{ fontWeight: 500, color: "#111b21" }}>{c.kind === "group" ? "👥 " : ""}{c.name}</div>
                </label>
              ))}
            </div>
            <div style={{ padding: 20, borderTop: "1px solid #eee", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="popup-btn popup-btn-secondary" onClick={() => { setShowForwardModal(false); setForwardTargets([]); }}>Cancel</button>
              <button style={{ background: "#00a884", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 600, opacity: forwardTargets.length === 0 ? 0.5 : 1, cursor: forwardTargets.length === 0 ? "not-allowed" : "pointer" }}
                disabled={forwardTargets.length === 0}
                onClick={() => { forwardMessages(Array.isArray(forwardingMessage) ? forwardingMessage : [forwardingMessage], forwardTargets); setShowForwardModal(false); setForwardTargets([]); setSelectionMode(false); setSelectedMessages([]); showToast("Messages forwarded", "success"); }}>
                Forward
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE PROMPT ── */}
      {deletePrompt && (
        <div className="mediaPreviewOverlay" style={{ zIndex: 4000 }} onClick={() => setDeletePrompt(null)}>
          <div className="customModal" onClick={(e) => e.stopPropagation()}>
            <h3 className="customModalTitle">Delete Message?</h3>
            <p className="customModalText">
              Are you sure you want to delete {Array.isArray(deletePrompt.id) ? "these messages" : "this message"} {deletePrompt.type === "all" ? "for everyone" : "for yourself"}?
            </p>
            <div className="customModalActions">
              <button className="popup-btn popup-btn-secondary" onClick={() => setDeletePrompt(null)}>Cancel</button>
              <button className="popup-btn popup-btn-danger" style={{ background: "#d93025", color: "white", border: "none", padding: "10px 20px", borderRadius: 8 }}
                onClick={() => deletePrompt.type === "all" ? handleDeleteForAll(deletePrompt.id) : handleDeleteForMe(deletePrompt.id)}>
                {deletePrompt.type === "all" ? "Delete for Everyone" : "Delete for Me"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MEDIA PREVIEW ── */}
      {previewMedia && (
        <div className="mediaPreviewOverlay" style={{ zIndex: 6000 }} onClick={() => setPreviewMedia(null)}>
          <img src={previewMedia} style={{ maxWidth: "90%", maxHeight: "90vh", borderRadius: 10, objectFit: "contain" }} alt="Preview" />
        </div>
      )}

      {/* ── THREAD DRAWER ── */}
      {isGroup && activeThreadMsgId && activeThreadMsg && (
        <div className="chatInfoOverlay" style={{ zIndex: 4500 }} onClick={() => setActiveThreadMsgId(null)}>
          <aside className="chatInfoDrawer threadDrawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawerHeader">
              <button type="button" className="iconBtn" onClick={() => setActiveThreadMsgId(null)}>←</button>
              <div className="drawerTitle">Thread</div>
            </div>
            <div className="threadDrawerBody" style={{ flex: 1, padding: 20, background: "#efeae2", overflowY: "auto" }}>
              <div style={{ background: "#fff", padding: 15, borderRadius: 10, marginBottom: 20, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                <div className="waSenderName" style={{ color: "#00a884", fontWeight: 700, fontSize: 14, marginBottom: 5 }}>{activeThreadMsg.senderName}</div>
                <div style={{ fontSize: 15, color: "#111b21", marginBottom: 8 }}>{activeThreadMsg.text}</div>
                <div className="waTime" style={{ fontSize: 11, color: "#667781" }}>{formatTime(activeThreadMsg.createdAt)}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeThreadMsg.thread?.map((tm) => (
                  <div key={tm.id} style={{ padding: "10px 15px", borderRadius: 10, alignSelf: tm.sender === "me" ? "flex-end" : "flex-start", background: tm.sender === "me" ? "#d9fdd3" : "#fff", maxWidth: "85%" }}>
                    {tm.sender !== "me" && <div className="waSenderName" style={{ color: "#00a884", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{tm.senderName}</div>}
                    <div style={{ fontSize: 14, color: "#111b21", marginBottom: 5 }}>{tm.text}</div>
                    <div className="waTime" style={{ fontSize: 10, color: "#667781", textAlign: "right" }}>{formatTime(tm.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
            <footer className="composer" style={{ background: "#f0f2f5", padding: 15, borderTop: "1px solid #e9edef" }}>
              <textarea className="composerInput" value={threadText} onChange={(e) => setThreadText(e.target.value)} placeholder="Reply in thread..." rows={1}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendThread(); } }} />
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