// src/components/admin/EmployeeViewer.jsx - COMPLETE UPDATED VERSION
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  adminViewEmployeeDashboard, 
  adminViewEmployeeMessages,
  adminViewEmployeeGroups,
  adminViewEmployeeGroupMessages,
  adminExitEmployeeView
} from "../../utils/api.js";
import { getAuthUser } from "../../utils/auth.js";
import "./EmployeeViewer.css";

export default function EmployeeViewer() {
  const { employeeId, targetId } = useParams();
  const navigate = useNavigate();
  const authUser = getAuthUser();
  const messagesEndRef = useRef(null);
  
  const [employee, setEmployee] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('chats');

  // Check if user is admin
  useEffect(() => {
    if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'superadmin')) {
      navigate('/chats');
      return;
    }
    fetchEmployeeDashboard();
  }, [employeeId]);

  // Auto-load messages if targetId is in URL
  useEffect(() => {
    if (targetId && employee) {
      fetchMessages(targetId);
    }
  }, [targetId, employeeId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const fetchEmployeeDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminViewEmployeeDashboard(employeeId);
      setEmployee(data.employee);
      // ✅ FIX: Ensure contacts is always an array
      setContacts(data.contacts || []);
      
      // Also fetch groups
      try {
        const groupsData = await adminViewEmployeeGroups(employeeId);
        // ✅ FIX: Ensure groups is always an array
        setGroups(groupsData.groups || []);
      } catch (e) {
        console.log("No groups or error:", e);
        setGroups([]);
      }
    } catch (err) {
      console.error("Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (contactId) => {
    setMessagesLoading(true);
    setSelectedGroup(null);
    try {
      const data = await adminViewEmployeeMessages(employeeId, contactId);
      // ✅ FIX: Ensure messages is always an array
      setMessages(data.messages || []);
      setSelectedContact(data.chattingWith);
    } catch (err) {
      console.error("Error fetching messages:", err);
      alert("Failed to load messages");
    } finally {
      setMessagesLoading(false);
    }
  };

  const fetchGroupMessages = async (groupId) => {
    setMessagesLoading(true);
    setSelectedContact(null);
    try {
      const data = await adminViewEmployeeGroupMessages(employeeId, groupId);
      // ✅ FIX: Ensure messages is always an array
      setMessages(data.messages || []);
      setSelectedGroup(data.group);
    } catch (err) {
      console.error("Error fetching group messages:", err);
      alert("Failed to load group messages");
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleContactClick = (contact) => {
    navigate(`/admin/employee/${employeeId}/chat/${contact.id}`);
    fetchMessages(contact.id);
  };

  const handleGroupClick = (group) => {
    fetchGroupMessages(group.id);
  };

  // ✅ FIX: Log admin exit when going back
  const handleBackToAdmin = async () => {
    try {
      await adminExitEmployeeView(employeeId);
    } catch (err) {
      console.log("Exit log failed:", err);
    }
    navigate("/admin");
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // ✅ NEW: Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (loading) {
    return (
      <div className="employee-viewer">
        <div className="viewer-loading">
          <div className="spinner"></div>
          <p>Loading employee dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="employee-viewer">
        <div className="viewer-error">
          <p>⚠️ {error}</p>
          <button onClick={handleBackToAdmin} className="back-btn">Back to Admin</button>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-viewer">
      {/* Header */}
      <header className="viewer-header">
        <button className="back-btn" onClick={handleBackToAdmin}>
          ← Back to Admin
        </button>
        <div className="viewer-employee-info">
          <img 
            src={employee?.avatarUrl} 
            alt={employee?.name}
            onError={(e) => {
              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(employee?.name || 'U')}&background=random`;
            }}
          />
          <div>
            <h2>Viewing: {employee?.name}</h2>
            <p>{employee?.email} • {employee?.role}</p>
          </div>
        </div>
        <div className="viewer-badge">
          <span className="admin-viewing-label">👁️ Admin View Mode</span>
        </div>
      </header>

      <div className="viewer-content">
        {/* Sidebar - Contacts & Groups */}
        <aside className="viewer-sidebar">
          {/* Tabs */}
          <div className="viewer-tabs">
            <button 
              className={`tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
              onClick={() => setActiveTab('chats')}
            >
              💬 Chats ({contacts.length})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
              onClick={() => setActiveTab('groups')}
            >
              👥 Groups ({groups.length})
            </button>
          </div>

          {/* Chats List */}
          {activeTab === 'chats' && (
            <div className="viewer-contacts-list">
              {contacts.length === 0 ? (
                <div className="empty-list">
                  <p>No conversations found</p>
                </div>
              ) : (
                contacts.map(contact => (
                  <div
                    key={contact.id}
                    className={`viewer-contact-item ${selectedContact?.id === contact.id ? 'active' : ''}`}
                    onClick={() => handleContactClick(contact)}
                  >
                    <img 
                      src={contact.avatarUrl} 
                      alt={contact.name}
                      onError={(e) => {
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random`;
                      }}
                    />
                    <div className="contact-info">
                      <div className="contact-name">{contact.name}</div>
                      <div className="contact-preview">
                        {contact.lastMessage?.text
                          ? (contact.lastMessage.text.length > 30 
                              ? contact.lastMessage.text.substring(0, 30) + "..." 
                              : contact.lastMessage.text)
                          : "No messages"
                        }
                      </div>
                    </div>
                    <div className="contact-meta">
                      <span className="message-count">{contact.totalMessages} msgs</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Groups List */}
          {activeTab === 'groups' && (
            <div className="viewer-contacts-list">
              {groups.length === 0 ? (
                <div className="empty-list">
                  <p>No groups found</p>
                </div>
              ) : (
                groups.map(group => (
                  <div
                    key={group.id}
                    className={`viewer-contact-item ${selectedGroup?.id === group.id ? 'active' : ''}`}
                    onClick={() => handleGroupClick(group)}
                  >
                    <img 
                      src={group.avatarUrl} 
                      alt={group.name}
                      onError={(e) => {
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(group.name)}&background=4CAF50`;
                      }}
                    />
                    <div className="contact-info">
                      <div className="contact-name">{group.name}</div>
                      <div className="contact-preview">
                        {group.memberCount} members • {group.employeeMessagesCount || 0} msgs by {employee?.name}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </aside>

        {/* Messages Panel */}
        <main className="viewer-messages">
          {messagesLoading ? (
            <div className="viewer-loading">
              <div className="spinner"></div>
              <p>Loading messages...</p>
            </div>
          ) : selectedContact || selectedGroup ? (
            <>
              <div className="viewer-messages-header">
                <img 
                  src={selectedContact?.avatarUrl || selectedGroup?.avatarUrl} 
                  alt={selectedContact?.name || selectedGroup?.name}
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedContact?.name || selectedGroup?.name || 'U')}&background=random`;
                  }}
                />
                <div>
                  <h3>
                    {selectedContact?.name || selectedGroup?.name}
                    {selectedGroup && (
                      <span className="group-badge">Group Chat</span>
                    )}
                  </h3>
                  {selectedContact?.email && (
                    <span style={{ fontSize: '12px', color: '#667781' }}>{selectedContact.email}</span>
                  )}
                </div>
                <span className="message-count-header">
                  {messages.length} messages
                </span>
              </div>
              
              <div className="viewer-messages-list">
                {messages.length === 0 ? (
                  <div className="empty-messages">
                    <p>No messages in this conversation</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    // ✅ FIX: Handle both response formats
                    const isSent = msg.sender === "me" || msg.isFromViewedEmployee || msg.isMine;
                    const senderName = msg.sender_name || msg.senderName || "Unknown";
                    const senderAvatar = msg.sender_avatar || msg.senderAvatar;
                    const messageText = msg.text || msg.content || "";
                    const fileUrl = msg.fileUrl || msg.file_url;
                    const fileName = msg.fileName || msg.file_name;
                    const msgType = msg.messageType || msg.message_type || "text";
                    const msgReactions = msg.reactions || {};
                    const isDeleted = msg.isDeleted || msg.deletedForEveryone;
                    const isEdited = msg.isEdited || msg.is_edited;

                    return (
                      <div
                        key={msg.id}
                        className={`viewer-message ${isSent ? 'sent' : 'received'}`}
                      >
                        <div className="message-avatar">
                          <img 
                            src={senderAvatar}
                            alt={senderName}
                            onError={(e) => {
                              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=random&size=32`;
                            }}
                          />
                        </div>
                        <div className="message-content">
                          <div className="message-sender">
                            {senderName}
                            {isSent && (
                              <span className="viewed-employee-tag"> ({employee?.name})</span>
                            )}
                          </div>
                          
                          {/* Deleted message */}
                          {isDeleted ? (
                            <div className="message-text" style={{ fontStyle: 'italic', color: '#667781' }}>
                              🚫 This message was deleted
                            </div>
                          ) : (
                            <>
                              {/* File Preview */}
                              {fileUrl && (
                                <div className="message-file">
                                  {msgType === 'image' ? (
                                    <img 
                                      src={fileUrl} 
                                      alt={fileName || "Image"} 
                                      className="message-image"
                                      onClick={() => window.open(fileUrl, '_blank')}
                                    />
                                  ) : msgType === 'video' ? (
                                    <video controls src={fileUrl} style={{ maxWidth: '200px', borderRadius: '8px' }} />
                                  ) : msgType === 'audio' ? (
                                    <audio controls src={fileUrl} style={{ maxWidth: '200px' }} />
                                  ) : (
                                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="file-link">
                                      📎 {fileName || "File"} {msg.fileSize ? `(${formatFileSize(msg.fileSize)})` : ''}
                                    </a>
                                  )}
                                </div>
                              )}

                              {/* Meet message */}
                              {msgType === 'meet' && msg.meetLink && (
                                <div style={{
                                  background: 'linear-gradient(135deg, #1a73e8, #4285f4)',
                                  borderRadius: '8px',
                                  padding: '10px',
                                  color: '#fff',
                                  marginBottom: '4px'
                                }}>
                                  <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                                    📅 {msg.meetTitle || "Meeting"}
                                  </div>
                                  {msg.meetScheduledAt && (
                                    <div style={{ fontSize: '12px', opacity: 0.9, marginBottom: '6px' }}>
                                      🕐 {new Date(msg.meetScheduledAt).toLocaleString()}
                                    </div>
                                  )}
                                  <a 
                                    href={msg.meetLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-block',
                                      background: '#fff',
                                      color: '#1a73e8',
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      textDecoration: 'none',
                                      fontSize: '13px',
                                      fontWeight: 600
                                    }}
                                  >
                                    🎥 Open Meeting Link
                                  </a>
                                </div>
                              )}
                              
                              {/* Text Content */}
                              {messageText && msgType !== 'meet' && (
                                <div className="message-text">{messageText}</div>
                              )}
                            </>
                          )}
                          
                          {/* Reactions */}
                          {Object.keys(msgReactions).length > 0 && !isDeleted && (
                            <div className="message-reactions-display">
                              {msgReactions.ok > 0 && <span>👍 {msgReactions.ok}</span>}
                              {msgReactions.not_ok > 0 && <span>👎 {msgReactions.not_ok}</span>}
                            </div>
                          )}
                          
                          <div className="message-time">
                            {isEdited && <span style={{ fontStyle: 'italic', marginRight: '4px' }}>edited</span>}
                            {formatTime(msg.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="viewer-messages-footer">
                <span className="admin-notice">
                  ⚠️ You are viewing this conversation as an admin. You cannot send messages.
                </span>
              </div>
            </>
          ) : (
            <div className="viewer-empty">
              <span className="empty-icon">💬</span>
              <p>Select a conversation to view messages</p>
              <span className="hint">Click on a chat or group from the left panel</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}