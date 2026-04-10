// src/utils/auth.js

const AUTH_KEY = "employeeAuth";

export function getAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthUser(user) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    isAuthenticated: true,
    ...user
  }));
}

export function clearAuthUser() {
  localStorage.removeItem(AUTH_KEY);
}

export function updateAuthUser(updates) {
  const current = getAuthUser();
  if (current) {
    setAuthUser({ ...current, ...updates });
  }
}

export function isAuthenticated() {
  const user = getAuthUser();
  return user?.isAuthenticated === true;
}

export function isAdminUser() {
  const user = getAuthUser();
  return user?.role === "admin" || user?.role === "superadmin";
}

export function isEmployeeUser() {
  const user = getAuthUser();
  return user?.role === "employee";
}

export function getAuthUserId() {
  const user = getAuthUser();
  return user?.id || user?.employeeId || null;
}

export function getAuthUserEmail() {
  const user = getAuthUser();
  return user?.email || null;
}