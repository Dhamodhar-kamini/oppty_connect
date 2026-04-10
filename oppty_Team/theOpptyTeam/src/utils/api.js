// src/utils/api.js

const API_BASE = '';

export function getCsrfToken() {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrftoken') return value;
  }
  return null;
}

export async function ensureCsrfToken() {
  if (!getCsrfToken()) {
    try { await fetch('/api/login/', { method: 'GET', credentials: 'include' }); } 
    catch (e) { console.log('CSRF fetch:', e); }
  }
}

export async function apiFetch(url, options = {}) {
  const csrfToken = getCsrfToken();
  const defaultHeaders = {};
  if (!(options.body instanceof FormData)) defaultHeaders["Content-Type"] = "application/json";
  if (csrfToken) defaultHeaders["X-CSRFToken"] = csrfToken;
  
  const config = { ...options, credentials: "include", headers: { ...defaultHeaders, ...options.headers } };
  const response = await fetch(`${API_BASE}${url}`, config);
  return response;
}

// ==================== AUTH ====================
export async function loginUser(email, password) {
  await ensureCsrfToken();
  const response = await apiFetch("/api/login/", { method: "POST", body: JSON.stringify({ email, password }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Login failed");
  return result;
}

export async function logoutUser() {
  const response = await apiFetch("/api/logout/", { method: "POST" });
  return response.json();
}

export async function getCurrentUser() {
  const response = await apiFetch("/api/me/", { method: "GET" });
  if (!response.ok) throw new Error("Not authenticated");
  return response.json();
}

// ==================== USERS & BLOCKING ====================
export async function fetchUsers() {
  const response = await apiFetch("/api/users/", { method: "GET" });
  if (!response.ok) throw new Error("Failed to fetch users");
  return response.json();
}

export async function createEmployee(data) {
  const response = await apiFetch("/api/create-employee/", { method: "POST", body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to create employee");
  return result;
}

// ✅ NEW: Block/Unblock user API
export async function toggleBlockUser(userId) {
  const cleanId = String(userId).replace('emp-', '');
  const response = await apiFetch(`/api/users/${cleanId}/block/`, { method: "POST" });
  if (!response.ok) throw new Error("Failed to block/unblock user");
  return response.json();
}

// ==================== PROFILE ====================
export async function updateProfile(data) {
  const response = await apiFetch("/api/profile/update/", { method: "POST", body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to update profile");
  return result;
}

export async function uploadProfileImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const response = await apiFetch("/api/profile/upload-image/", { method: "POST", body: formData });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to upload image");
  return result;
}

// ==================== MESSAGES ====================
export async function fetchMessages(targetId) {
  const cleanId = String(targetId).replace('emp-', '');
  const response = await apiFetch(`/api/messages/${cleanId}/`, { method: "GET" });
  if (!response.ok) throw new Error("Failed to fetch messages");
  return response.json();
}

export async function markMessagesRead(targetId) {
  const cleanId = String(targetId).replace('emp-', '');
  const response = await apiFetch(`/api/messages/${cleanId}/read/`, { method: "POST" });
  if (!response.ok) throw new Error("Failed to mark messages as read");
  return response.json();
}

// ✅ NEW: Forward Messages
export async function forwardMessagesApi(messages, targetIds) {
  const response = await apiFetch("/api/messages/forward/", {
    method: "POST",
    body: JSON.stringify({ messages, target_ids: targetIds }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to forward messages");
  return result;
}

// ✅ NEW: Toggle Star
export async function toggleMessageStar(messageId) {
  const response = await apiFetch(`/api/messages/${messageId}/star/`, { method: "POST" });
  if (!response.ok) throw new Error("Failed to star message");
  return response.json();
}

// ✅ NEW: Toggle Pin
export async function toggleMessagePin(messageId) {
  const response = await apiFetch(`/api/messages/${messageId}/pin/`, { method: "POST" });
  if (!response.ok) throw new Error("Failed to pin message");
  return response.json();
}

// ==================== FILE UPLOAD ====================
export async function uploadMessageFile(file, targetId, groupId = null, content = "") {
  const formData = new FormData();
  formData.append('file', file);
  if (groupId) formData.append('group_id', String(groupId).replace('group-', ''));
  else if (targetId) formData.append('receiver_id', String(targetId).replace('emp-', ''));
  if (content) formData.append('content', content);
  
  const response = await apiFetch("/api/messages/upload/", { method: "POST", body: formData });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to upload file");
  return result;
}

// ==================== REACTIONS ====================
export async function addReaction(messageId, reaction) {
  const response = await apiFetch(`/api/messages/${messageId}/react/`, { method: "POST", body: JSON.stringify({ reaction }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to add reaction");
  return result;
}

export async function removeReaction(messageId) {
  const response = await apiFetch(`/api/messages/${messageId}/react/remove/`, { method: "POST" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to remove reaction");
  return result;
}

// ==================== MESSAGE EDIT/DELETE ====================
export async function editMessage(messageId, content) {
  const response = await apiFetch(`/api/messages/${messageId}/edit/`, { method: "POST", body: JSON.stringify({ content }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to edit message");
  return result;
}

export async function deleteMessageForMe(messageId) {
  const response = await apiFetch(`/api/messages/${messageId}/delete-for-me/`, { method: "POST" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to delete message");
  return result;
}

export async function deleteMessageForEveryone(messageId) {
  const response = await apiFetch(`/api/messages/${messageId}/delete-for-everyone/`, { method: "POST" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to delete message");
  return result;
}

// ==================== GROUPS ====================
export async function fetchGroups() {
  const response = await apiFetch("/api/groups/", { method: "GET" });
  if (!response.ok) throw new Error("Failed to fetch groups");
  return response.json();
}

export async function createGroup(data) {
  const response = await apiFetch("/api/groups/create/", { method: "POST", body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to create group");
  return result;
}

export async function fetchGroupDetails(groupId) {
  const cleanId = String(groupId).replace('group-', '');
  const response = await apiFetch(`/api/groups/${cleanId}/`, { method: "GET" });
  if (!response.ok) throw new Error("Failed to fetch group details");
  return response.json();
}

export async function fetchGroupMessages(groupId) {
  const cleanId = String(groupId).replace('group-', '');
  const response = await apiFetch(`/api/groups/${cleanId}/messages/`, { method: "GET" });
  if (!response.ok) throw new Error("Failed to fetch group messages");
  return response.json();
}

export async function addGroupMembers(groupId, memberIds) {
  const cleanId = String(groupId).replace('group-', '');
  const response = await apiFetch(`/api/groups/${cleanId}/members/add/`, { method: "POST", body: JSON.stringify({ member_ids: memberIds }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to add members");
  return result;
}

export async function removeGroupMember(groupId, memberId) {
  const cleanId = String(groupId).replace('group-', '');
  const response = await apiFetch(`/api/groups/${cleanId}/members/remove/`, { method: "POST", body: JSON.stringify({ member_id: memberId }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to remove member");
  return result;
}

export async function updateGroup(groupId, data) {
  const cleanId = String(groupId).replace('group-', '');
  const response = await apiFetch(`/api/groups/${cleanId}/update/`, { method: "POST", body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to update group");
  return result;
}

export async function leaveGroup(groupId) {
  const cleanId = String(groupId).replace('group-', '');
  const response = await apiFetch(`/api/groups/${cleanId}/leave/`, { method: "POST" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to leave group");
  return result;
}

// ==================== GOOGLE MEET ====================
export async function createMeet(data) {
  const response = await apiFetch("/api/meet/create/", { method: "POST", body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to create meeting");
  return result;
}

export async function getSavedMeets() {
  const response = await apiFetch("/api/meet/saved/", { method: "GET" });
  if (!response.ok) throw new Error("Failed to fetch saved meets");
  return response.json();
}

export async function deleteSavedMeet(meetId) {
  const response = await apiFetch(`/api/meet/saved/${meetId}/`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete saved meet");
  return response.json();
}

export async function respondToMeetInvite(messageId, status) {
  const response = await apiFetch(`/api/meet/invite/${messageId}/respond/`, { method: "POST", body: JSON.stringify({ status }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Failed to respond to invitation");
  return result;
}

// ==================== ADMIN ====================
export async function adminGetAllEmployees() {
  const response = await apiFetch("/api/admin/employees/", { method: "GET" });
  if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Failed to fetch employees"); }
  return response.json();
}

export async function adminGetStatistics() {
  const response = await apiFetch("/api/admin/statistics/", { method: "GET" });
  if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Failed to fetch statistics"); }
  return response.json();
}

export async function adminViewEmployeeDashboard(employeeId) {
  const response = await apiFetch(`/api/admin/employee/${employeeId}/dashboard/`, { method: "GET" });
  if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Failed to fetch employee dashboard"); }
  return response.json();
}

export async function adminViewEmployeeMessages(employeeId, targetId) {
  const response = await apiFetch(`/api/admin/employee/${employeeId}/messages/${targetId}/`, { method: "GET" });
  if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Failed to fetch messages"); }
  return response.json();
}

export async function adminViewEmployeeGroups(employeeId) {
  const response = await apiFetch(`/api/admin/employee/${employeeId}/groups/`, { method: "GET" });
  if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Failed to fetch employee groups"); }
  return response.json();
}

export async function adminViewEmployeeGroupMessages(employeeId, groupId) {
  const response = await apiFetch(`/api/admin/employee/${employeeId}/groups/${groupId}/messages/`, { method: "GET" });
  if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Failed to fetch group messages"); }
  return response.json();
}

export async function adminGetActivityLog(limit = 100, offset = 0) {
  const response = await apiFetch(`/api/admin/activity-log/?limit=${limit}&offset=${offset}`, { method: "GET" });
  if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Failed to fetch activity log"); }
  return response.json();
}

export async function adminExitEmployeeView(employeeId) {
  const response = await apiFetch("/api/admin/exit-employee-view/", { method: "POST", body: JSON.stringify({ employee_id: employeeId }) });
  if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Failed to exit employee view"); }
  return response.json();
}

export function getWebSocketUrl(targetId, isGroup = false) {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = window.location.host;
  
  if (isGroup) {
    const cleanId = String(targetId).replace('group-', '');
    return `${wsProtocol}//${wsHost}/ws/chat/group/${cleanId}/`;
  } else {
    const cleanId = String(targetId).replace('emp-', '');
    return `${wsProtocol}//${wsHost}/ws/chat/${cleanId}/`;
  }
}