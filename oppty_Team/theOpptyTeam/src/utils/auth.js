export function getAuthUser() {
  try {
    const raw = localStorage.getItem("employeeAuth");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function isAdminUser() {
  const user = getAuthUser();
  return user?.role === "admin";
}

export function isEmployeeUser() {
  const user = getAuthUser();
  return user?.role === "employee";
}