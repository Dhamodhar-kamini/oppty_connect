// src/components/chat/MessageBubble.jsx
import React, { useEffect, useRef, useState } from "react";
import { useChats } from "../../context/ChatContext.jsx";

function formatTime(ts) {
  const value = Number(ts);
  if (!Number.isFinite(value)) return "";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

// Map backend reaction keys to emojis
const REACTION_EMOJI_MAP = {
  ok: "👍",
  not_ok: "👎",
  love: "❤️",
  laugh: "😂",
  wow: "😮",
  sad: "😢",
};

// Normalize reactions: handle both object {ok: 2, love: 1} and array ['❤️', '👍'] formats
function normalizeReactions(reactions) {
  if (!reactions) return { list: [], map: {} };

  // Already an array of emojis (old local format)
  if (Array.isArray(reactions)) {
    return { list: reactions, map: {} };
  }

  // Object format from backend: {ok: 2, love: 1}
  if (typeof reactions === "object") {
    const list = [];
    const map = {};
    Object.entries(reactions).forEach(([key, count]) => {
      const emoji = REACTION_EMOJI_MAP[key] || key;
      map[key] = count;
      for (let i = 0; i < count; i++) {
        list.push(emoji);
      }
    });
    return { list, map };
  }

  return { list: [], map: {} };
}

function ReplySnippet({ replyTo, onClick }) {
  if (!replyTo) return null;
  return (
    <div className="waReplySnippet" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div className="waReplyBar" />
      <div className="waReplyBody">
        <div className="waReplyTitle">{replyTo.senderName || replyTo.sender_name || "Reply"}</div>
        <div className="waReplyMessage">
          {replyTo.type === "image" ? `🖼 ${replyTo.fileName || "Photo"}` :
           replyTo.type === "document" ? `📄 ${replyTo.fileName || "Document"}` :
           replyTo.text || "Message"}
        </div>
      </div>
    </div>
  );
}

function renderTextWithMentions(text) {
  if (typeof text !== "string") return text;
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="waMention">{part}</span>
    ) : (
      part
    )
  );
}

export default function MessageBubble({
  message, isGroup, onReply, onOpenThread, onEdit, onForward, onDeleteForMe, onDeleteForAll, canDeleteForAll,
  onScrollToReply, onPreviewImage, onReaction, onStar, onPin, onVote,
  selectionMode, isSelected, onToggleSelect
}) {
  const { showToast } = useChats();
  const isMine = message.isMine;
  const wrapRef = useRef(null);

  const [menuPos, setMenuPos] = useState({ visible: false, x: 0, y: 0 });
  const [showHoverReactions, setShowHoverReactions] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(null);
  const longPressTimer = useRef(null);

  // Normalize reactions for display
  const { list: reactionsList, map: reactionsMap } = normalizeReactions(message.reactions);
  const hasReactions = reactionsList.length > 0 || Object.keys(reactionsMap).length > 0;

  useEffect(() => {
    const handleOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setMenuPos({ visible: false, x: 0, y: 0 });
        setShowHoverReactions(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (menuPos.visible || showHoverReactions) {
        setMenuPos({ visible: false, x: 0, y: 0 });
        setShowHoverReactions(false);
      }
    };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [menuPos.visible, showHoverReactions]);

  // System messages
  if (message.type === "system") {
    return (
      <div className="waSystemMessageWrap animatedFadeIn">
        <div className="waSystemMessage">{message.text}</div>
      </div>
    );
  }

  const openMenuAt = (clientX, clientY) => {
    let x = clientX;
    let y = clientY;
    const menuWidth = 200;
    const menuHeight = 350;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
    if (x < 10) x = 10;
    if (y < 10) y = 10;
    setMenuPos({ visible: true, x, y });
  };

  const handleTouchStart = (e) => {
    if (selectionMode) return;
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    touchStartX.current = touchX;
    longPressTimer.current = setTimeout(() => {
      openMenuAt(touchX, touchY);
      if (window.navigator?.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchMove = (e) => {
    if (selectionMode || touchStartX.current === null) return;
    clearTimeout(longPressTimer.current);
    const deltaX = e.touches[0].clientX - touchStartX.current;
    if (deltaX > 0 && deltaX < 80) setSwipeX(deltaX);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
    touchStartX.current = null;
    if (swipeX > 50 && !message.deletedForAll) {
      onReply?.();
      if (window.navigator?.vibrate) navigator.vibrate(30);
    }
    setSwipeX(0);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (!selectionMode && !message.deletedForAll) {
      openMenuAt(e.clientX, e.clientY);
    }
  };

  const handleChevronClick = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    openMenuAt(rect.left, rect.bottom + 4);
  };

  const handleBubbleClick = () => {
    if (selectionMode) onToggleSelect?.();
  };

  const handleCopy = () => {
    if (message.text) {
      navigator.clipboard.writeText(message.text);
      showToast("Message copied to clipboard");
    }
    setMenuPos({ visible: false, x: 0, y: 0 });
  };

  const hasUserReaction = (emoji) => {
    if (Array.isArray(message.reactions)) {
      return message.reactions.includes(emoji);
    }
    const reverseMap = { "👍": "ok", "👎": "not_ok", "❤️": "love", "😂": "laugh", "😮": "wow", "😢": "sad", "🙏": "ok" };
    const reactionKey = reverseMap[emoji];
    return message.userReaction === reactionKey;
  };

  const displayContent = () => {
    // Deleted message
    if (message.deletedForAll || message.isDeleted) {
      return (
        <div className="waBubbleText deleted" style={{ fontStyle: "italic", opacity: 0.6 }}>
          🚫 This message was deleted
        </div>
      );
    }

    // Image
    if (message.type === "image" || message.messageType === "image") {
      return (
        <div className="waAttachmentWrap">
          <img
            src={message.fileUrl}
            alt={message.fileName || "Image"}
            className="chatAttachmentImage"
            onClick={() => { if (!selectionMode) onPreviewImage?.(message.fileUrl); }}
            style={{ cursor: selectionMode ? "default" : "pointer" }}
          />
          {message.fileName && <div className="chatAttachmentName">{message.fileName}</div>}
        </div>
      );
    }

    // Document / file
    if (message.type === "document" || message.type === "file" || message.messageType === "file") {
      return (
        <a href={message.fileUrl || "#"} target="_blank" rel="noreferrer" className="chatDocumentCard"
           onClick={(e) => selectionMode && e.preventDefault()}>
          <div className="chatDocumentIcon">📄</div>
          <div className="chatDocumentInfo">
            <div className="chatDocumentName">{message.fileName || "Document"}</div>
            <div className="chatDocumentSubtext">
              {message.fileSize ? `${(message.fileSize / 1024).toFixed(1)} KB` : "Open document"}
            </div>
          </div>
        </a>
      );
    }

    // Video
    if (message.type === "video" || message.messageType === "video") {
      return (
        <div className="waAttachmentWrap">
          <video controls src={message.fileUrl} style={{ maxWidth: "100%", borderRadius: 8 }} />
        </div>
      );
    }

    // Audio
    if (message.type === "audio" || message.messageType === "audio") {
      return (
        <div className="waAttachmentWrap">
          <audio controls src={message.fileUrl} style={{ maxWidth: "100%" }} />
        </div>
      );
    }

    // Meet
    if (message.type === "meet" || message.messageType === "meet") {
      return (
        <div style={{
          background: "linear-gradient(135deg, #1a73e8, #4285f4)",
          borderRadius: 8, padding: 12, color: "#fff", marginBottom: 4
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            📅 {message.meetTitle || "Meeting"}
          </div>
          {message.meetScheduledAt && (
            <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 6 }}>
              🕐 {new Date(message.meetScheduledAt).toLocaleString()}
            </div>
          )}
          {message.meetLink && (
            <a href={message.meetLink} target="_blank" rel="noopener noreferrer"
               style={{
                 display: "inline-block", background: "#fff", color: "#1a73e8",
                 padding: "6px 12px", borderRadius: 6, textDecoration: "none",
                 fontSize: 13, fontWeight: 600
               }}>
              🎥 Join Meeting
            </a>
          )}
        </div>
      );
    }

    // Poll
    if (message.type === "poll") {
      const uniqueVoters = new Set();
      (message.pollOptions || []).forEach(opt => (opt.votedBy || []).forEach(id => uniqueVoters.add(id)));
      const totalVoters = uniqueVoters.size;

      return (
        <div className="waPollContainer">
          <div className="waPollQuestion">📊 {message.text}</div>
          <div className="waPollMultipleText">{message.allowMultiple ? "Select one or more" : "Select one"}</div>
          <div className="waPollOptionsList">
            {(message.pollOptions || []).map((opt) => {
              const hasVoted = (opt.votedBy || []).includes("me");
              const percent = totalVoters > 0 ? ((opt.votedBy || []).length / totalVoters) * 100 : 0;
              return (
                <div key={opt.id} className="waPollOption" onClick={() => onVote?.(opt.id)}>
                  <div className="waPollOptionControl">
                    <div className={`waPollCheckbox ${message.allowMultiple ? "square" : "circle"} ${hasVoted ? "active" : ""}`}>
                      {hasVoted && (message.allowMultiple ? "✓" : <div className="waPollRadioDot" />)}
                    </div>
                  </div>
                  <div className="waPollOptionBody">
                    <div className="waPollOptionHeader">
                      <span className="waPollOptionText">{opt.text}</span>
                      {(opt.votedBy || []).length > 0 && <span className="waPollOptionCount">{opt.votedBy.length}</span>}
                    </div>
                    <div className="waPollProgressTrack">
                      <div className="waPollProgressFill" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="waPollFooter">{totalVoters} vote{totalVoters !== 1 ? "s" : ""}</div>
        </div>
      );
    }

    // Text with link detection
    const urlMatch = message.text?.match(/https?:\/\/[^\s]+/i)?.[0];

    return (
      <div className="waBubbleText">
        {message.isForwarded && (
          <div style={{ fontSize: '12px', color: '#8696a0', marginBottom: '4px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" style={{ transform: 'scaleX(-1)' }}><path fill="currentColor" d="M10.89 16.276l4.606-4.606-4.606-4.606.848-.848 5.454 5.454-5.454 5.454-.848-.848z"/></svg>
            Forwarded
          </div>
        )}
        {message.displayText ?? (
          urlMatch
            ? <a href={urlMatch} target="_blank" rel="noreferrer" className="chatLinkPreview"
                 onClick={(e) => selectionMode && e.preventDefault()}>{message.text}</a>
            : renderTextWithMentions(message.text || "")
        )}
      </div>
    );
  };

  const renderContextMenu = () => {
    if (!menuPos.visible || selectionMode) return null;

    const style = {
      position: "fixed", top: menuPos.y, left: menuPos.x,
      margin: 0, zIndex: 9999999, minWidth: "180px", width: "max-content"
    };

    return (
      <div className={`waBubbleMenu ${isMine ? "mine" : "theirs"}`} style={style} onClick={(e) => e.stopPropagation()}>
        {!message.deletedForAll && !message.isDeleted && (
          <div className="waQuickReactions">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`reactionBtn ${hasUserReaction(emoji) ? "active" : ""}`}
                onClick={() => {
                  onReaction?.(emoji);
                  setMenuPos({ visible: false, x: 0, y: 0 });
                  setShowHoverReactions(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <button type="button" className="waBubbleMenuItem" onClick={() => { onToggleSelect?.(); setMenuPos({ visible: false, x: 0, y: 0 }); }}>
          Select messages
        </button>

        {!message.deletedForAll && !message.isDeleted && (
          <>
            <button type="button" className="waBubbleMenuItem" onClick={() => { onReply?.(); setMenuPos({ visible: false, x: 0, y: 0 }); }}>
              Reply directly
            </button>
            {/* FIXED: Thread only for groups */}
            {isGroup && (
              <button type="button" className="waBubbleMenuItem" onClick={() => { onOpenThread?.(); setMenuPos({ visible: false, x: 0, y: 0 }); }}>
                Reply in thread
              </button>
            )}
          </>
        )}

        {/* FIXED: Ensure Edit shows accurately */}
        {!message.deletedForAll && !message.isDeleted && isMine && (message.type === "text" || message.messageType === "text" || !message.type) && (
          <button type="button" className="waBubbleMenuItem" onClick={() => { onEdit?.(); setMenuPos({ visible: false, x: 0, y: 0 }); }}>
            Edit
          </button>
        )}

        {!message.deletedForAll && !message.isDeleted && message.text && (
          <button type="button" className="waBubbleMenuItem" onClick={handleCopy}>Copy</button>
        )}

        {!message.deletedForAll && !message.isDeleted && (
          <>
            <button type="button" className="waBubbleMenuItem" onClick={() => { onForward?.(); setMenuPos({ visible: false, x: 0, y: 0 }); }}>
              Forward
            </button>
            <button type="button" className="waBubbleMenuItem" onClick={() => {
              onStar?.();
              setMenuPos({ visible: false, x: 0, y: 0 });
              showToast(message.isStarred ? "Unstarred" : "Message Starred");
            }}>
              {message.isStarred ? "Unstar" : "Star"}
            </button>
            <button type="button" className="waBubbleMenuItem" onClick={() => {
              onPin?.();
              setMenuPos({ visible: false, x: 0, y: 0 });
              showToast(message.isPinned ? "Unpinned" : "Message Pinned");
            }}>
              {message.isPinned ? "Unpin" : "Pin"}
            </button>
          </>
        )}

        <button type="button" className="waBubbleMenuItem" onClick={() => { onDeleteForMe?.(); setMenuPos({ visible: false, x: 0, y: 0 }); }}>
          Delete for me
        </button>

        {canDeleteForAll && !message.deletedForAll && !message.isDeleted && (
          <button type="button" className="waBubbleMenuItem danger" onClick={() => { onDeleteForAll?.(); setMenuPos({ visible: false, x: 0, y: 0 }); }}>
            Delete for all
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={`waRow ${isMine ? "mine" : "theirs"} ${selectionMode && isSelected ? "selected" : ""}`}>
      {selectionMode && (
        <div className="waSelectionArea" onClick={onToggleSelect}>
          <div className={`waCheckbox ${isSelected ? "checked" : ""}`}>{isSelected && "✓"}</div>
        </div>
      )}

      <div className="waBubbleContainer" ref={wrapRef} onClick={handleBubbleClick}>
        <div className="swipeReplyIcon" style={{
          opacity: swipeX / 50,
          transform: `translateX(${swipeX - 40}px) scale(${Math.min(swipeX / 50, 1)})`
        }}>↩</div>

        {!selectionMode && !message.deletedForAll && !message.isDeleted && (
          <div className="waHoverActions">
            <button onClick={(e) => { e.stopPropagation(); setShowHoverReactions(!showHoverReactions); }} title="React">😀</button>
            {/* FIXED: Thread icon only for groups */}
            {isGroup && (
              <button onClick={(e) => { e.stopPropagation(); onOpenThread?.(); }} title="Reply in thread">💬</button>
            )}
            <button onClick={handleChevronClick} title="Menu">▾</button>

            {showHoverReactions && (
              <div className="waHoverReactionsMenu">
                {QUICK_REACTIONS.map((emoji) => (
                  <button key={emoji} onClick={(e) => {
                    e.stopPropagation();
                    onReaction?.(emoji);
                    setShowHoverReactions(false);
                  }}>{emoji}</button>
                ))}
              </div>
            )}
          </div>
        )}

        <div
          className={`waBubble ${isMine ? "mine" : "theirs"}`}
          style={{
            transform: `translateX(${swipeX}px)`,
            transition: swipeX === 0 ? "transform 0.2s ease" : "none",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={handleContextMenu}
        >
          {!selectionMode && (
            <button type="button" className="waBubbleMenuBtn mobile-only" aria-label="Options" onClick={handleChevronClick}>▾</button>
          )}

          {!isMine && message.senderName && !message.deletedForAll && !message.isDeleted && (
            <div className="waSenderName">{message.senderName}</div>
          )}

          <ReplySnippet
            replyTo={message.replyTo}
            onClick={() => { if (!selectionMode && message.replyTo?.id) onScrollToReply?.(message.replyTo.id); }}
          />

          {displayContent()}

          {/* FIXED: Thread badge only for groups */}
          {isGroup && message.thread && message.thread.length > 0 && !message.deletedForAll && !message.isDeleted && (
            <div className="waThreadBadge" onClick={(e) => { e.stopPropagation(); onOpenThread?.(); }}>
              💬 {message.thread.length} repl{message.thread.length > 1 ? "ies" : "y"}
            </div>
          )}

          {/* Footer */}
          <div className="waBubbleFooter">
            {message.isStarred && <span className="waStarIcon">⭐</span>}
            {message.isEdited && <span className="waEdited">Edited</span>}
            <span className="waTime">{formatTime(message.createdAt)}</span>
            {isMine && !message.deletedForAll && !message.isDeleted && (
              <span className={`waStatus ${message.isRead ? "read" : message.status || "sent"}`}>
                {message.isRead ? "✓✓" : message.status === "read" ? "✓✓" : "✓"}
              </span>
            )}
          </div>

          {/* Reactions display */}
          {hasReactions && !message.deletedForAll && !message.isDeleted && (
            <div className="waReactionsDisplay">
              {Object.keys(reactionsMap).length > 0 ? (
                // Backend format: {ok: 2, love: 1}
                Object.entries(reactionsMap).map(([key, count]) => (
                  <span key={key} className="waReactionBadge">
                    {REACTION_EMOJI_MAP[key] || key} {count > 1 ? count : ""}
                  </span>
                ))
              ) : (
                // Array format: ['❤️', '👍']
                reactionsList.map((emoji, i) => (
                  <span key={i} className="waReactionBadge">{emoji}</span>
                ))
              )}
            </div>
          )}
        </div>

        {renderContextMenu()}
      </div>
    </div>
  );
}