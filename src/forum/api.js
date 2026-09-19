/**
 * Client helpers for forum API (same-origin, credentials for session cookie).
 */

export async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || "Request failed");
    err.status = res.status;
    err.code = data.code;
    err.data = data;
    throw err;
  }
  return data;
}

export function getMe() {
  return api("/api/auth/me");
}

export function logout() {
  return api("/api/auth/logout", { method: "POST" });
}

export function googleLoginUrl(returnTo = window.location.pathname) {
  const q = new URLSearchParams({ returnTo });
  return `/api/auth/google?${q}`;
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

export function authorLink(author) {
  if (!author) return "Unknown";
  const name = escapeHtml(author.displayName || "Player");
  if (author.username) {
    return `<a href="/forum/user.html?u=${encodeURIComponent(author.username)}">${name}</a>`;
  }
  return name;
}
