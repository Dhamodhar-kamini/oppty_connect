// src/components/admin/EmployeeViewer.jsx - CLEAN & DECENT ORANGE THEME
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

  useEffect(() => {
    if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'superadmin')) {
      navigate('/chats');
      return;
    }
    fetchEmployeeDashboard();
  }, [employeeId]);

  useEffect(() => {
    if (targetId && employee) {
      fetchMessages(targetId);
    }
  }, [targetId, employeeId]);

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
      setContacts(data.contacts || []);
      
      try {
        const groupsData = await adminViewEmployeeGroups(employeeId);
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

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (loading) {
    return (
      <div className="viewer-page">
        <div className="viewer-loading">
          <div className="spinner"></div>
          <p>Loading employee data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="viewer-page">
        <div className="viewer-error">
          <span className="error-icon">⚠️</span>
          <h3>Something went wrong</h3>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={fetchEmployeeDashboard} className="btn-primary">Try Again</button>
            <button onClick={handleBackToAdmin} className="btn-secondary">Back to Admin</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="viewer-page">
      {/* Top Bar - Back Button */}
      <div className="top-bar">
        <button className="back-btn" onClick={handleBackToAdmin}>
          ← Back to Admin Dashboard
        </button>
      </div>

      {/* Header */}
      <header className="viewer-header">
        <div className="header-employee">
          <img 
            src={employee?.avatarUrl} 
            alt={employee?.name}
            onError={(e) => {
              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(employee?.name || 'U')}&background=f97316&color=fff`;
            }}
          />
          <div className="header-employee-info">
            <h1>{employee?.name}</h1>
            <p>{employee?.email}</p>
          </div>
          <span className={`role-badge ${employee?.role}`}>{employee?.role}</span>
        </div>
        <div className="header-badge">
          <span>👁️ Admin View Mode</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="viewer-content">
        {/* Sidebar */}
        <aside className="viewer-sidebar">
          <div className="sidebar-tabs">
            <button 
              className={`tab-btn ${activeTab === 'chats' ? 'active' : ''}`}
              onClick={() => setActiveTab('chats')}
            >
              Chats ({contacts.length})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
              onClick={() => setActiveTab('groups')}
            >
              Groups ({groups.length})
            </button>
          </div>

          <div className="sidebar-list">
            {activeTab === 'chats' && (
              <>
                {contacts.length === 0 ? (
                  <div className="empty-list">
                    <span>💬</span>
                    <p>No conversations</p>
                  </div>
                ) : (
                  contacts.map(contact => (
                    <div
                      key={contact.id}
                      className={`list-item ${selectedContact?.id === contact.id ? 'active' : ''}`}
                      onClick={() => handleContactClick(contact)}
                    >
                      <img 
                        src={contact.avatarUrl} 
                        alt={contact.name}
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=eee&color=333`;
                        }}
                      />
                      <div className="list-item-info">
                        <span className="list-item-name">{contact.name}</span>
                        <span className="list-item-preview">
                          {contact.lastMessage?.text
                            ? (contact.lastMessage.text.length > 25 
                                ? contact.lastMessage.text.substring(0, 25) + "..." 
                                : contact.lastMessage.text)
                            : "No messages"
                          }
                        </span>
                      </div>
                      <span className="list-item-count">{contact.totalMessages}</span>
                    </div>
                  ))
                )}
              </>
            )}

            {activeTab === 'groups' && (
              <>
                {groups.length === 0 ? (
                  <div className="empty-list">
                    <span>👥</span>
                    <p>No groups</p>
                  </div>
                ) : (
                  groups.map(group => (
                    <div
                      key={group.id}
                      className={`list-item ${selectedGroup?.id === group.id ? 'active' : ''}`}
                      onClick={() => handleGroupClick(group)}
                    >
                      <img 
                        src={group.avatarUrl} 
                        alt={group.name}
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(group.name)}&background=f97316&color=fff`;
                        }}
                      />
                      <div className="list-item-info">
                        <span className="list-item-name">{group.name}</span>
                        <span className="list-item-preview">
                          {group.memberCount} members
                        </span>
                      </div>
                      <span className="list-item-count">{group.employeeMessagesCount || 0}</span>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
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
              {/* Chat Header */}
              <div className="chat-header">
                <img 
                  src={selectedContact?.avatarUrl || selectedGroup?.avatarUrl} 
                  alt={selectedContact?.name || selectedGroup?.name}
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedContact?.name || selectedGroup?.name || 'U')}&background=eee&color=333`;
                  }}
                />
                <div className="chat-header-info">
                  <h3>{selectedContact?.name || selectedGroup?.name}</h3>
                  {selectedGroup && <span className="group-tag">Group</span>}
                  {selectedContact?.email && <p>{selectedContact.email}</p>}
                </div>
                <span className="msg-count">{messages.length} messages</span>
              </div>
              
              {/* Messages List */}
              <div className="messages-list">
                {messages.length === 0 ? (
                  <div className="empty-messages">
                    <p>No messages in this conversation</p>
                  </div>
                ) : (
                  messages.map(msg => {
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
                      <div key={msg.id} className={`message ${isSent ? 'sent' : 'received'}`}>
                        <img 
                          src={senderAvatar}
                          alt={senderName}
                          className="message-avatar"
                          onError={(e) => {
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=eee&color=333&size=32`;
                          }}
                        />
                        <div className="message-bubble">
                          <span className="message-sender">
                            {senderName}
                            {isSent && <span className="employee-tag"> ({employee?.name})</span>}
                          </span>
                          
                          {isDeleted ? (
                            <p className="message-text deleted">🚫 This message was deleted</p>
                          ) : (
                            <>
                              {fileUrl && (
                                <div className="message-file">
                                  {msgType === 'image' ? (
                                    <img 
                                      src={fileUrl} 
                                      alt={fileName || "Image"} 
                                      className="file-image"
                                      onClick={() => window.open(fileUrl, '_blank')}
                                    />
                                  ) : msgType === 'video' ? (
                                    <video controls src={fileUrl} className="file-video" />
                                  ) : msgType === 'audio' ? (
                                    <audio controls src={fileUrl} className="file-audio" />
                                  ) : (
                                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="file-link">
                                      📎 {fileName || "File"} {msg.fileSize ? `(${formatFileSize(msg.fileSize)})` : ''}
                                    </a>
                                  )}
                                </div>
                              )}

                              {msgType === 'meet' && msg.meetLink && (
                                <div className="message-meet">
                                  <div className="meet-title">📅 {msg.meetTitle || "Meeting"}</div>
                                  {msg.meetScheduledAt && (
                                    <div className="meet-time">🕐 {new Date(msg.meetScheduledAt).toLocaleString()}</div>
                                  )}
                                  <a href={msg.meetLink} target="_blank" rel="noopener noreferrer" className="meet-link">
                                    🎥 Join Meeting
                                  </a>
                                </div>
                              )}
                              
                              {messageText && msgType !== 'meet' && (
                                <p className="message-text">{messageText}</p>
                              )}
                            </>
                          )}
                          
                          {Object.keys(msgReactions).length > 0 && !isDeleted && (
                            <div className="message-reactions">
                              {msgReactions.ok > 0 && <span>👍 {msgReactions.ok}</span>}
                              {msgReactions.not_ok > 0 && <span>👎 {msgReactions.not_ok}</span>}
                            </div>
                          )}
                          
                          <span className="message-time">
                            {isEdited && <em>edited · </em>}
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Footer Notice */}
              <div className="chat-footer">
                <div className="admin-notice">
                  ⚠️ Admin view mode — You cannot send messages
                </div>
              </div>
            </>
          ) : (
            <div className="empty-panel">
              <span className="empty-icon">💬</span>
              <h3>Select a conversation</h3>
              <p>Click on a chat or group from the sidebar</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}