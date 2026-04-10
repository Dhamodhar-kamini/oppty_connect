// src/components/admin/AdminDashboard.jsx - COMPLETE UPDATED VERSION
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

  // Check if user is admin
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
      // ✅ FIX: Backend now returns { employees: [...], totalCount, adminId, adminName }
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
      <div className="admin-dashboard">
        <div className="admin-loading">
          <div className="spinner"></div>
          <p>Loading employees...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="admin-error">
          <p>⚠️ {error}</p>
          <button onClick={fetchEmployees} className="retry-btn">Retry</button>
          <button onClick={handleBackToChats} className="back-btn">Back to Chats</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-left">
          <button className="back-to-chats-btn" onClick={handleBackToChats}>
            ← Back to Chats
          </button>
          <div className="admin-title">
            <h1>👨‍💼 Admin Dashboard</h1>
            <p>View and monitor employee conversations</p>
          </div>
        </div>
        <div className="admin-header-right">
          {/* ✅ NEW: Show statistics if available */}
          {statistics && (
            <div className="admin-stats-bar">
              <span className="stat-chip" title="Total Messages">
                💬 {statistics.totalMessages || 0}
              </span>
              <span className="stat-chip" title="Messages Today">
                📅 {statistics.messagesToday || 0} today
              </span>
              <span className="stat-chip" title="Total Groups">
                👥 {statistics.totalGroups || 0} groups
              </span>
            </div>
          )}
          <span className="employee-count">{employees.length} Employees</span>
          <button className="refresh-btn" onClick={() => { fetchEmployees(); fetchStatistics(); }} title="Refresh">
            🔄
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="admin-search-container">
        <input
          type="text"
          className="admin-search"
          placeholder="🔍 Search employees by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Employee Grid */}
      <div className="employee-grid">
        {filteredEmployees.map(emp => (
          <div
            key={emp.id}
            className="employee-card"
            onClick={() => handleViewEmployee(emp.id)}
          >
            <div className="employee-card-header">
              <img 
                src={emp.avatarUrl} 
                alt={emp.name} 
                className="employee-avatar"
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=random`;
                }}
              />
              <div className="employee-basic-info">
                <h3>{emp.name}</h3>
                <p className="employee-email">{emp.email}</p>
                <span className={`employee-role ${emp.role}`}>{emp.role}</span>
              </div>
            </div>

            <div className="employee-stats">
              <div className="stat">
                <span className="stat-icon">📤</span>
                <span className="stat-value">{emp.stats?.messagesSent || 0}</span>
                <span className="stat-label">Sent</span>
              </div>
              <div className="stat">
                <span className="stat-icon">📥</span>
                <span className="stat-value">{emp.stats?.messagesReceived || 0}</span>
                <span className="stat-label">Received</span>
              </div>
              <div className="stat">
                <span className="stat-icon">💬</span>
                <span className="stat-value">{emp.stats?.activeChatPartners || 0}</span>
                <span className="stat-label">Chats</span>
              </div>
              <div className="stat">
                <span className="stat-icon">👥</span>
                <span className="stat-value">{emp.stats?.groupsJoined || 0}</span>
                <span className="stat-label">Groups</span>
              </div>
            </div>

            <div className="employee-card-footer">
              <span className="last-activity">
                Last active: {formatLastActivity(emp.lastActivity)}
              </span>
              <button className="view-btn">
                View Chats →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredEmployees.length === 0 && (
        <div className="admin-empty">
          <span className="empty-icon">👤</span>
          <p>No employees found</p>
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="clear-search-btn">
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  );
}