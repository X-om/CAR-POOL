const ACCESS_TOKEN_KEY = "cp_access_token";
const USER_ID_KEY = "cp_user_id";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getAccessToken() {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getUserId() {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(USER_ID_KEY);
}

export function setSession(session: { token: string; userId: string }) {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, session.token);
  window.localStorage.setItem(USER_ID_KEY, session.userId);
}

export function clearSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(USER_ID_KEY);
}
