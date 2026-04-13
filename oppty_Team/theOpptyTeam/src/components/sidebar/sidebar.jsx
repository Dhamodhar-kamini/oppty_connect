// src/components/sidebar/sidebar.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useChats } from "../../context/ChatContext.jsx";
import { fetchUsers, createEmployee, logoutUser, updateProfile, uploadProfileImage } from "../../utils/api.js";
import { getAuthUser, clearAuthUser, isAdminUser as checkIsAdmin } from "../../utils/auth.js";
import AppLoader from "../common/AppLoader.jsx";
import "./Sidebar.css";

// Icons
function ChatsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function GroupsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.67 0-8 1.34-8 4v2h12v-2c0-2.66-5.33-4-4-4zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.95v2h7v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
    </svg>
  );
}

function NewChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" />
    </svg>
  );
}

function AddUserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path fill="currentColor" d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

const ICON_BY_ID = {
  chats: <ChatsIcon />,
  groups: <GroupsIcon />,
  admin: <AdminIcon />,
};

function getInitials(name) {
  if (!name) return "U";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return words[0].substring(0, 2).toUpperCase();
}

export default function Sidebar({ isChatOpen }) {
  const navigate = useNavigate();
  const { chats, addContact, addGroup, showToast, theme, toggleTheme, reloadChats } = useChats();

  const authUser = getAuthUser();
  const isAdminUser = checkIsAdmin();

  // State
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isViewingProfile, setIsViewingProfile] = useState(false);
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [createMode, setCreateMode] = useState("contacts");
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Group creation state
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupAbout, setNewGroupAbout] = useState("");
  const [newGroupIsBroadcast, setNewGroupIsBroadcast] = useState(false);

  // Employee creation state
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpPassword, setNewEmpPassword] = useState("");
  const [creatingEmployee, setCreatingEmployee] = useState(false);

  // Profile state
  const [profile, setProfile] = useState({
    name: authUser?.name || "Your Name",
    email: authUser?.email || "yourmail@example.com",
    about: authUser?.about || "Hey there!",
    photo: authUser?.avatarUrl || "",
    status: authUser?.status || "available",
  });
  const [draftName, setDraftName] = useState(profile.name);
  const [draftPhoto, setDraftPhoto] = useState(profile.photo);
  const [draftStatus, setDraftStatus] = useState(profile.status);
  const [savingProfile, setSavingProfile] = useState(false);

  // Refs
  const popupRef = useRef(null);
  const profileBtnRef = useRef(null);
  const fileInputRef = useRef(null);
  const createPopupRef = useRef(null);
  const createBtnRef = useRef(null);

  // Navigation items
  const navItems = useMemo(() => {
    const items = [
      { id: "chats", to: "/chats" },
      { id: "groups", to: "/groups" },
    ];
    if (isAdminUser) {
      items.push({ id: "admin", to: "/admin" });
    }
    return items;
  }, [isAdminUser]);

  // Load contacts when create popup opens
  useEffect(() => {
    if (showCreatePopup && createMode === "contacts") {
      loadContacts();
    }
  }, [showCreatePopup, createMode]);

  const loadContacts = async () => {
    setLoadingContacts(true);
    try {
      const users = await fetchUsers();
      setContacts(users.filter(u => u.email !== authUser?.email));
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      setLoadingContacts(false);
    }
  };

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    const q = contactSearchTerm.toLowerCase();
    return contacts.filter(emp =>
      emp.name.toLowerCase().includes(q) || emp.email.toLowerCase().includes(q)
    );
  }, [contacts, contactSearchTerm]);

  // Handlers
  const handleCloseAll = () => {
    setShowProfilePopup(false);
    setShowCreatePopup(false);
    setShowLogoutConfirm(false);
    setIsEditingProfile(false);
    setIsViewingProfile(false);
  };

  const handleTogglePopup = () => {
    setShowProfilePopup((prev) => !prev);
    setShowCreatePopup(false);
    setShowLogoutConfirm(false);
    setIsEditingProfile(false);
    setIsViewingProfile(false);
    setDraftName(profile.name);
    setDraftPhoto(profile.photo);
    setDraftStatus(profile.status);
  };

  const handleStartDirectMessage = (emp) => {
    const existingChat = chats.find(c =>
      c.kind === "dm" && (c.email === emp.email || c.contact === emp.email)
    );

    if (existingChat) {
      handleCloseAll();
      navigate(`/chats/${existingChat.id}`);
    } else {
      const newChat = addContact({
        id: `emp-${emp.id}`,
        name: emp.name,
        contact: emp.email,
        avatarUrl: emp.avatarUrl,
        about: emp.about || "Hey there!",
      });
      handleCloseAll();
      navigate(`/chats/emp-${emp.id}`);
    }
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;

    try {
      const newGroup = await addGroup({
        name,
        about: newGroupAbout,
        isBroadcast: newGroupIsBroadcast,
      });
      handleCloseAll();
      navigate(`/groups/${newGroup.id}`);
      setNewGroupName("");
      setNewGroupAbout("");
      setNewGroupIsBroadcast(false);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleCreateEmployee = async () => {
    if (!newEmpName.trim() || !newEmpEmail.trim() || !newEmpPassword.trim()) return;

    setCreatingEmployee(true);
    try {
      await createEmployee({
        name: newEmpName.trim(),
        email: newEmpEmail.trim(),
        password: newEmpPassword.trim(),
        role: "employee",
      });
      showToast("Employee created successfully!");
      setCreateMode("contacts");
      setNewEmpName("");
      setNewEmpEmail("");
      setNewEmpPassword("");
      loadContacts();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setCreatingEmployee(false);
    }
  };

  const handleViewProfile = () => {
    setIsViewingProfile(true);
    setIsEditingProfile(false);
  };

  const handleStartEdit = () => {
    setIsEditingProfile(true);
    setIsViewingProfile(false);
    setDraftName(profile.name);
    setDraftPhoto(profile.photo);
    setDraftStatus(profile.status);
  };

  const handleBackToMenu = () => {
    setIsEditingProfile(false);
    setIsViewingProfile(false);
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setDraftName(profile.name);
    setDraftPhoto(profile.photo);
    setDraftStatus(profile.status);
  };

  const handleSaveProfile = async () => {
    const trimmedName = draftName.trim();
    if (!trimmedName) return;

    setSavingProfile(true);
    try {
      await updateProfile({
        name: trimmedName,
        status: draftStatus,
      });

      setProfile({
        ...profile,
        name: trimmedName,
        status: draftStatus,
        photo: draftPhoto,
      });

      // Update localStorage
      const current = getAuthUser();
      if (current) {
        localStorage.setItem("employeeAuth", JSON.stringify({
          ...current,
          name: trimmedName,
          status: draftStatus,
          avatarUrl: draftPhoto,
        }));
      }

      setIsEditingProfile(false);
      showToast("Profile updated");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadProfileImage(file);
      setDraftPhoto(result.avatarUrl);
      showToast("Photo uploaded");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    handleCloseAll();

    try {
      await logoutUser();
    } catch (err) {
      console.error("Logout error:", err);
    }

    setTimeout(() => {
      clearAuthUser();
      window.location.href = "/login";
    }, 1500);
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedOutsideProfile = showProfilePopup &&
        popupRef.current && !popupRef.current.contains(event.target) &&
        profileBtnRef.current && !profileBtnRef.current.contains(event.target);

      const clickedOutsideCreate = showCreatePopup &&
        createPopupRef.current && !createPopupRef.current.contains(event.target) &&
        createBtnRef.current && !createBtnRef.current.contains(event.target);

      if (clickedOutsideProfile) handleCloseAll();
      if (clickedOutsideCreate) handleCloseAll();
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") handleCloseAll();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showProfilePopup, showCreatePopup]);

  return (
    <>
      <aside className={`sidebar ${isChatOpen ? "sidebar-hidden-mobile" : ""}`}>
        <div className="sidebar-top">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              className={({ isActive }) => `sidebar-item ${isActive ? "active" : ""}`}
              aria-label={item.id}
              title={item.id.charAt(0).toUpperCase() + item.id.slice(1)}
            >
              <span className="sidebar-icon">{ICON_BY_ID[item.id]}</span>
            </NavLink>
          ))}

          <div className="sidebar-divider" />

          {/* Create New Chat Button */}
          <div className="sidebar-create-wrapper">
            <button
              ref={createBtnRef}
              type="button"
              className={`sidebar-item sidebar-create-btn ${showCreatePopup ? "active" : ""}`}
              title="New chat"
              onClick={() => {
                setShowCreatePopup(p => !p);
                setCreateMode("contacts");
                setShowProfilePopup(false);
              }}
            >
              <span className="sidebar-icon"><NewChatIcon /></span>
            </button>

            {showCreatePopup && (
              <div ref={createPopupRef} className="create-popup contacts-popup" role="dialog">
                {createMode === "contacts" && (
                  <>
                    <div className="create-popup-header">
                      <div className="create-popup-title">New Chat</div>
                      <div className="flyout-search-bar" style={{ padding: '10px 0 0', border: 'none' }}>
                        <input
                          type="text"
                          placeholder="Search contacts..."
                          value={contactSearchTerm}
                          onChange={e => setContactSearchTerm(e.target.value)}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="contacts-list-container">
                      {isAdminUser && !contactSearchTerm && (
                        <>
                          <div
                            className="contact-list-item create-group-action"
                            onClick={() => setCreateMode("group")}
                          >
                            <div className="contact-avatar-placeholder"><GroupsIcon /></div>
                            <span className="contact-name">New Group</span>
                          </div>
                          <div
                            className="contact-list-item create-group-action"
                            onClick={() => setCreateMode("create_employee")}
                          >
                            <div className="contact-avatar-placeholder" style={{ background: '#007bfc' }}>
                              <AddUserIcon />
                            </div>
                            <span className="contact-name">Create Employee</span>
                          </div>
                        </>
                      )}

                      <div className="contacts-section-title">Contacts</div>

                      {loadingContacts ? (
                        <div className="flyout-empty">Loading...</div>
                      ) : filteredContacts.length > 0 ? (
                        filteredContacts.map(emp => (
                          <div
                            key={emp.id}
                            className="contact-list-item"
                            onClick={() => handleStartDirectMessage(emp)}
                          >
                            <div style={{ position: 'relative' }}>
                              <img
                                src={emp.avatarUrl}
                                alt={emp.name}
                                className="contact-avatar"
                                onError={(e) => {
                                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=random`;
                                }}
                              />
                              <div className={`statusDot ${emp.status || 'available'}`}></div>
                            </div>
                            <div className="contact-info">
                              <span className="contact-name">{emp.name}</span>
                              <span className="contact-status">{emp.email}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flyout-empty">No contacts found</div>
                      )}
                    </div>
                  </>
                )}

                {createMode === "group" && (
                  <div className="create-group-form">
                    <div className="create-popup-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button className="iconBtn" onClick={() => setCreateMode("contacts")}>←</button>
                      <div className="create-popup-title">Create New Group</div>
                    </div>
                    <div className="create-form" style={{ marginTop: 16 }}>
                      <label className="profile-input-group">
                        <span className="profile-input-label">Group Name</span>
                        <input
                          type="text"
                          className="profile-input"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="Enter group name"
                        />
                      </label>
                      <label className="profile-input-group">
                        <span className="profile-input-label">Description</span>
                        <input
                          type="text"
                          className="profile-input"
                          value={newGroupAbout}
                          onChange={(e) => setNewGroupAbout(e.target.value)}
                          placeholder="Group description (optional)"
                        />
                      </label>
                      <label className="pollToggleRow" style={{ marginTop: 12 }}>
                        <input
                          type="checkbox"
                          checked={newGroupIsBroadcast}
                          onChange={e => setNewGroupIsBroadcast(e.target.checked)}
                        />
                        <span>Broadcast Channel (Only admins can post)</span>
                      </label>
                      <div className="profile-popup-actions" style={{ marginTop: 20 }}>
                        <button
                          type="button"
                          className="popup-btn popup-btn-secondary"
                          onClick={() => setCreateMode("contacts")}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="popup-btn popup-btn-danger"
                          onClick={handleCreateGroup}
                          disabled={!newGroupName.trim()}
                        >
                          Create
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {createMode === "create_employee" && (
                  <div className="create-group-form">
                    <div className="create-popup-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button className="iconBtn" onClick={() => setCreateMode("contacts")}>←</button>
                      <div className="create-popup-title">Create Employee</div>
                    </div>
                    <div className="create-form" style={{ marginTop: 16 }}>
                      <label className="profile-input-group">
                        <span className="profile-input-label">Full Name</span>
                        <input
                          type="text"
                          className="profile-input"
                          value={newEmpName}
                          onChange={(e) => setNewEmpName(e.target.value)}
                          placeholder="Enter full name"
                        />
                      </label>
                      <label className="profile-input-group">
                        <span className="profile-input-label">Email Address</span>
                        <input
                          type="email"
                          className="profile-input"
                          value={newEmpEmail}
                          onChange={(e) => setNewEmpEmail(e.target.value)}
                          placeholder="employee@oppty.com"
                        />
                      </label>
                      <label className="profile-input-group">
                        <span className="profile-input-label">Password</span>
                        <input
                          type="text"
                          className="profile-input"
                          value={newEmpPassword}
                          onChange={(e) => setNewEmpPassword(e.target.value)}
                          placeholder="Assign a password"
                        />
                      </label>
                      <div className="profile-popup-actions" style={{ marginTop: 20 }}>
                        <button
                          type="button"
                          className="popup-btn popup-btn-secondary"
                          onClick={() => setCreateMode("contacts")}
                          disabled={creatingEmployee}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="popup-btn popup-btn-danger"
                          onClick={handleCreateEmployee}
                          disabled={!newEmpName.trim() || !newEmpEmail.trim() || !newEmpPassword.trim() || creatingEmployee}
                        >
                          {creatingEmployee ? "Creating..." : "Create"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Profile Section */}
        <div className="sidebar-bottom">
          <div className="sidebar-profile-wrapper">
            <button
              ref={profileBtnRef}
              type="button"
              className={`sidebar-profile ${!profile.photo && isAdminUser ? "sidebar-admin-badge" : ""}`}
              style={{
                background: profile.photo ? 'transparent' : (isAdminUser ? '#f0f2f5' : '#00a884'),
                color: isAdminUser ? 'var(--text)' : '#fff',
                padding: profile.photo ? 0 : undefined,
                position: 'relative'
              }}
              title={isAdminUser ? "Admin Profile" : "Profile"}
              onClick={handleTogglePopup}
            >
              {profile.photo ? (
                <img
                  src={profile.photo}
                  alt="User"
                  className="sidebar-profile-img"
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : isAdminUser ? (
                <span className="sidebar-admin-text">AD</span>
              ) : (
                <span className="sidebar-employee-text">{getInitials(profile.name)}</span>
              )}
              <div className={`statusDot ${profile.status}`}></div>
            </button>

            {/* Profile Popup */}
            {showProfilePopup && (
              <div ref={popupRef} className="profile-popup profile-popup--expanded" role="dialog">
                {/* Main Menu */}
                {!isEditingProfile && !isViewingProfile && !showLogoutConfirm && (
                  <>
                    <div className="profile-popup-header">
                      <div style={{ position: 'relative' }}>
                        {profile.photo ? (
                          <img src={profile.photo} alt="User" className="profile-popup-avatar" />
                        ) : isAdminUser ? (
                          <div className="profile-popup-admin-avatar">AD</div>
                        ) : (
                          <div className="profile-popup-avatar-placeholder">{getInitials(profile.name)}</div>
                        )}
                        <div className={`statusDot ${profile.status}`}></div>
                      </div>
                      <div className="profile-popup-user">
                        <h4>{isAdminUser ? `${profile.name} (Admin)` : profile.name}</h4>
                        <p>{profile.email}</p>
                      </div>
                    </div>
                    <div className="profile-popup-menu">
                      <button type="button" className="profile-menu-btn" onClick={handleViewProfile}>
                        View Profile
                      </button>
                      <button type="button" className="profile-menu-btn" onClick={handleStartEdit}>
                        Edit Profile
                      </button>
                      <button type="button" className="profile-menu-btn" onClick={toggleTheme}>
                        {theme === 'light' ? '🌙 Enable Dark Mode' : '☀️ Enable Light Mode'}
                      </button>
                      {isAdminUser && (
                        <button
                          type="button"
                          className="profile-menu-btn"
                          onClick={() => { handleCloseAll(); navigate('/admin'); }}
                        >
                          👨‍💼 Admin Dashboard
                        </button>
                      )}
                      <button
                        type="button"
                        className="profile-menu-btn profile-menu-btn-danger"
                        onClick={() => setShowLogoutConfirm(true)}
                      >
                        Logout
                      </button>
                    </div>
                  </>
                )}

                {/* Logout Confirmation */}
                {showLogoutConfirm && (
                  <div className="logout-confirm-box">
                    <div className="logout-confirm-icon">⎋</div>
                    <h4 className="logout-confirm-title">Confirm Logout</h4>
                    <p className="logout-confirm-text">Are you sure you want to logout?</p>
                    <div className="profile-popup-actions">
                      <button
                        type="button"
                        className="popup-btn popup-btn-secondary"
                        onClick={() => setShowLogoutConfirm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="popup-btn popup-btn-danger"
                        onClick={handleConfirmLogout}
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}

                {/* View Profile */}
                {isViewingProfile && !showLogoutConfirm && (
                  <>
                    <div className="profile-popup-header">
                      <div style={{ position: 'relative', margin: '0 auto' }}>
                        {profile.photo ? (
                          <img src={profile.photo} alt="User" className="profile-popup-avatar profile-popup-avatar-large" />
                        ) : (
                          <div className="profile-popup-avatar-placeholder profile-popup-avatar-large">
                            {getInitials(profile.name)}
                          </div>
                        )}
                        <div className={`statusDot ${profile.status}`} style={{ width: 20, height: 20 }}></div>
                      </div>
                      <div className="profile-popup-user">
                        <h4>{profile.name}</h4>
                        <p>{profile.email}</p>
                      </div>
                    </div>
                    <div className="profile-view-details">
                      <div className="profile-detail-card">
                        <span className="profile-detail-label">Status</span>
                        <span className="profile-detail-value">
                          {profile.status === 'dnd' ? '🔴 Do Not Disturb' :
                           profile.status === 'meeting' ? '🗓️ In a Meeting' : '🟢 Available'}
                        </span>
                      </div>
                      <div className="profile-detail-card">
                        <span className="profile-detail-label">About</span>
                        <span className="profile-detail-value">{profile.about || "Hey there!"}</span>
                      </div>
                    </div>
                    <div className="profile-popup-actions">
                      <button type="button" className="popup-btn popup-btn-secondary" onClick={handleBackToMenu}>
                        Back
                      </button>
                      <button type="button" className="popup-btn popup-btn-danger" onClick={handleStartEdit}>
                        Edit Profile
                      </button>
                    </div>
                  </>
                )}

                {/* Edit Profile */}
                {isEditingProfile && !showLogoutConfirm && (
                  <>
                    <div className="profile-popup-header">
                      <div style={{ position: 'relative', margin: '0 auto' }}>
                        {draftPhoto ? (
                          <img src={draftPhoto} alt="Preview" className="profile-popup-avatar" />
                        ) : (
                          <div className="profile-popup-avatar-placeholder">{getInitials(draftName)}</div>
                        )}
                      </div>
                      <div className="profile-popup-user">
                        <h4>Edit Profile</h4>
                        <p>Update your details</p>
                      </div>
                    </div>
                    <div className="profile-edit-form">
                      <label className="profile-input-group">
                        <span className="profile-input-label">Name</span>
                        <input
                          type="text"
                          className="profile-input"
                          value={draftName}
                          onChange={(e) => setDraftName(e.target.value)}
                          placeholder="Enter your name"
                        />
                      </label>

                      <label className="profile-input-group">
                        <span className="profile-input-label">Status</span>
                        <select
                          className="profile-input"
                          value={draftStatus}
                          onChange={(e) => setDraftStatus(e.target.value)}
                        >
                          <option value="available">🟢 Available</option>
                          <option value="dnd">🔴 Do Not Disturb</option>
                          <option value="meeting">🗓️ In a Meeting</option>
                        </select>
                      </label>

                      <div className="profile-input-group">
                        <span className="profile-input-label">Photo</span>
                        <div className="profile-edit-actions" style={{ display: 'flex', gap: '8px' }}>
                          <button type="button" className="popup-btn popup-btn-secondary" onClick={handlePhotoButtonClick}>
                            Choose Photo
                          </button>
                          {draftPhoto && (
                            <button
                              type="button"
                              className="popup-btn popup-btn-secondary"
                              style={{ color: '#d93025' }}
                              onClick={() => setDraftPhoto("")}
                            >
                              Remove
                            </button>
                          )}
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handlePhotoChange}
                          />
                        </div>
                      </div>

                      <div className="profile-popup-actions" style={{ marginTop: 16 }}>
                        <button
                          type="button"
                          className="popup-btn popup-btn-secondary"
                          onClick={handleCancelEdit}
                          disabled={savingProfile}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="popup-btn popup-btn-danger"
                          onClick={handleSaveProfile}
                          disabled={!draftName.trim() || savingProfile}
                        >
                          {savingProfile ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Logout Loader */}
      {isLoggingOut && (
        <AppLoader
          title="Signing you out..."
          subtitle="Securing your session"
        />
      )}
    </>
  );
}
