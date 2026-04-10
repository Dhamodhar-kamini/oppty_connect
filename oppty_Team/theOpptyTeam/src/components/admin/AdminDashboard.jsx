// src/components/admin/AdminDashboard.jsx - CLEAN & DECENT
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { adminGetAllEmployees, adminGetStatistics } from "../../utils/api.js";
import { getAuthUser } from "../../utils/auth.js";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const [employees, setEmployees] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const authUser = getAuthUser();

  useEffect(() => {
    if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'superadmin')) {
      navigate('/chats');
      return;
    }
    fetchEmployees();
    fetchStatistics();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminGetAllEmployees();
      setEmployees(data.employees || data);
    } catch (err) {
      console.error("Error fetching employees:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const data = await adminGetStatistics();
      setStatistics(data);
    } catch (err) {
      console.log("Statistics not available:", err);
    }
  };

  const handleViewEmployee = (employeeId) => {
    navigate(`/admin/employee/${employeeId}`);
  };

  const handleBackToChats = () => {
    navigate('/chats');
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatLastActivity = (timestamp) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <div className="spinner"></div>
          <p>Loading employees...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="admin-error">
          <span className="error-icon">⚠️</span>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={fetchEmployees} className="btn-primary">Try Again</button>
            <button onClick={handleBackToChats} className="btn-secondary">Back to Chats</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* Back Navigation */}
      <div className="top-bar">
        <button className="back-btn" onClick={handleBackToChats}>
          ← Back to Chats
        </button>
      </div>

      {/* Header */}
      <header className="admin-header">
        <div className="header-left">
          <h1>Admin Dashboard</h1>
          <p>Monitor employee conversations</p>
        </div>
        <div className="header-right">
          {statistics && (
            <div className="stats-row">
              <div className="stat-pill">
                <span>💬</span> {statistics.totalMessages || 0}
              </div>
              <div className="stat-pill">
                <span>📅</span> {statistics.messagesToday || 0} today
              </div>
              <div className="stat-pill">
                <span>👥</span> {statistics.totalGroups || 0} groups
              </div>
            </div>
          )}
          <div className="stat-pill highlight">{employees.length} Employees</div>
          <button className="refresh-btn" onClick={() => { fetchEmployees(); fetchStatistics(); }}>
            ↻
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="🔍 Search employees..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-btn" onClick={() => setSearchTerm("")}>✕</button>
        )}
      </div>

      {/* Employee List */}
      <div className="employee-grid">
        {filteredEmployees.map(emp => (
          <div key={emp.id} className="employee-card" onClick={() => handleViewEmployee(emp.id)}>
            <div className="card-header">
              <img 
                src={emp.avatarUrl} 
                alt={emp.name} 
                className="avatar"
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=f97316&color=fff`;
                }}
              />
              <div className="info">
                <h3>{emp.name}</h3>
                <p>{emp.email}</p>
                <span className={`role ${emp.role}`}>{emp.role}</span>
              </div>
            </div>

            <div className="card-stats">
              <div className="stat">
                <span className="value">{emp.stats?.messagesSent || 0}</span>
                <span className="label">Sent</span>
              </div>
              <div className="stat">
                <span className="value">{emp.stats?.messagesReceived || 0}</span>
                <span className="label">Received</span>
              </div>
              <div className="stat">
                <span className="value">{emp.stats?.activeChatPartners || 0}</span>
                <span className="label">Chats</span>
              </div>
              <div className="stat">
                <span className="value">{emp.stats?.groupsJoined || 0}</span>
                <span className="label">Groups</span>
              </div>
            </div>

            <div className="card-footer">
              <span className="activity">Last: {formatLastActivity(emp.lastActivity)}</span>
              <button className="view-btn">View →</button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredEmployees.length === 0 && (
        <div className="empty-state">
          <span>👤</span>
          <p>No employees found</p>
          {searchTerm && (
            <button onClick={() => setSearchTerm("")}>Clear Search</button>
          )}
        </div>
      )}
    </div>
  );
}