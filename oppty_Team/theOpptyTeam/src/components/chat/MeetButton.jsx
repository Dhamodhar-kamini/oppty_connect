// src/components/chat/MeetButton.jsx
import React, { useState, useEffect } from "react";
import { createMeet, getSavedMeets, deleteSavedMeet } from "../../utils/api.js";
import "./MeetButton.css";

export default function MeetButton({ targetId, groupId, members = [], disabled, onMeetCreated }) {
  const [showModal, setShowModal] = useState(false);
  const [meetLink, setMeetLink] = useState("");
  const [meetTitle, setMeetTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [selectedInvitees, setSelectedInvitees] = useState([]);
  const [saveLink, setSaveLink] = useState(false);
  const [savedMeets, setSavedMeets] = useState([]);
  const [showSaved, setShowSaved] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (showModal) {
      loadSavedMeets();
      // Auto-select all members for groups
      if (groupId && members.length > 0) {
        setSelectedInvitees(members.map(m => m.id));
      }
    }
  }, [showModal, groupId, members]);

  const loadSavedMeets = async () => {
    try {
      const meets = await getSavedMeets();
      setSavedMeets(meets);
    } catch (err) {
      console.error("Error loading saved meets:", err);
    }
  };

  const handleUseSaved = (meet) => {
    setMeetLink(meet.meetLink);
    setMeetTitle(meet.title);
    setShowSaved(false);
  };

  const handleDeleteSaved = async (meetId, e) => {
    e.stopPropagation();
    try {
      await deleteSavedMeet(meetId);
      setSavedMeets(prev => prev.filter(m => m.id !== meetId));
    } catch (err) {
      alert("Failed to delete saved meet");
    }
  };

  const toggleInvitee = (memberId) => {
    setSelectedInvitees(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  const selectAllInvitees = () => {
    setSelectedInvitees(members.map(m => m.id));
  };

  const clearInvitees = () => {
    setSelectedInvitees([]);
  };

  const handleCreate = async () => {
    if (!meetLink.trim()) {
      alert("Please enter a meeting link");
      return;
    }

    setIsCreating(true);
    try {
      const result = await createMeet({
        meet_link: meetLink.trim(),
        title: meetTitle.trim() || "Meeting",
        scheduled_at: scheduledAt || null,
        invitees: selectedInvitees,
        receiver_id: !groupId ? targetId : null,
        group_id: groupId || null,
        save_link: saveLink,
      });
      
      // ✅ Call callback with result so parent can handle it instantly
      if (onMeetCreated) {
        onMeetCreated(result);
      }
      
      // Reset and close
      setMeetLink("");
      setMeetTitle("");
      setScheduledAt("");
      setSelectedInvitees([]);
      setSaveLink(false);
      setShowModal(false);
      
    } catch (err) {
      alert(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setMeetLink("");
    setMeetTitle("");
    setScheduledAt("");
    setSelectedInvitees([]);
    setSaveLink(false);
    setShowSaved(false);
  };

  return (
    <>
      <button
        type="button"
        className="meet-trigger-btn"
        onClick={() => setShowModal(true)}
        disabled={disabled}
        title="Schedule Meeting"
      >
        📅
      </button>

      {showModal && (
        <div className="meet-modal-overlay" onClick={handleClose}>
          <div className="meet-modal" onClick={e => e.stopPropagation()}>
            <div className="meet-modal-header">
              <h3>📅 Schedule Meeting</h3>
              <button className="close-btn" onClick={handleClose} type="button">✕</button>
            </div>

            <div className="meet-modal-body">
              {/* Saved Meets */}
              {savedMeets.length > 0 && (
                <div className="saved-meets-section">
                  <button 
                    className="toggle-saved-btn"
                    onClick={() => setShowSaved(!showSaved)}
                    type="button"
                  >
                    📌 Saved Links ({savedMeets.length}) {showSaved ? '▲' : '▼'}
                  </button>
                  
                  {showSaved && (
                    <div className="saved-meets-list">
                      {savedMeets.map(meet => (
                        <div 
                          key={meet.id} 
                          className="saved-meet-item"
                          onClick={() => handleUseSaved(meet)}
                        >
                          <div className="saved-meet-info">
                            <span className="saved-meet-title">{meet.title}</span>
                            <span className="saved-meet-uses">Used {meet.useCount}x</span>
                          </div>
                          <button 
                            className="delete-saved-btn"
                            onClick={(e) => handleDeleteSaved(meet.id, e)}
                            type="button"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Meeting Link */}
              <div className="form-group">
                <label>Meeting Link *</label>
                <input
                  type="url"
                  value={meetLink}
                  onChange={e => setMeetLink(e.target.value)}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                />
              </div>

              {/* Meeting Title */}
              <div className="form-group">
                <label>Meeting Title</label>
                <input
                  type="text"
                  value={meetTitle}
                  onChange={e => setMeetTitle(e.target.value)}
                  placeholder="Team Standup"
                />
              </div>

              {/* Schedule Time */}
              <div className="form-group">
                <label>Schedule Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                />
              </div>

              {/* Invitees (for groups) */}
              {members.length > 0 && (
                <div className="form-group">
                  <label>
                    Invite Members ({selectedInvitees.length}/{members.length})
                  </label>
                  <div className="select-actions">
                    <button type="button" onClick={selectAllInvitees}>Select All</button>
                    <button type="button" onClick={clearInvitees}>Clear</button>
                  </div>
                  <div className="invitees-list">
                    {members.map(member => (
                      <div 
                        key={member.id}
                        className={`invitee-item ${selectedInvitees.includes(member.id) ? 'selected' : ''}`}
                        onClick={() => toggleInvitee(member.id)}
                      >
                        <img 
                          src={member.avatarUrl} 
                          alt=""
                          onError={(e) => {
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&size=32`;
                          }}
                        />
                        <span>{member.name}</span>
                        <div className={`checkbox ${selectedInvitees.includes(member.id) ? 'checked' : ''}`}>
                          {selectedInvitees.includes(member.id) && '✓'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Link Option */}
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={saveLink}
                    onChange={e => setSaveLink(e.target.checked)}
                  />
                  Save link for future use
                </label>
              </div>
            </div>

            <div className="meet-modal-footer">
              <button 
                className="cancel-btn"
                onClick={handleClose}
                disabled={isCreating}
                type="button"
              >
                Cancel
              </button>
              <button 
                className="create-btn"
                onClick={handleCreate}
                disabled={!meetLink.trim() || isCreating}
                type="button"
              >
                {isCreating ? "Sending..." : "Share Meeting"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}