/**
 * Public author DTO — never leaks email or Google name unless allowed.
 * @param {object} row
 * @param {{ includeEmail?: boolean }} [opts]
 */
export function publicAuthor(row, opts = {}) {
  if (!row) return null;
  const hide = Boolean(row.hide_google_name);
  const displayName = hide
    ? row.username || "Player"
    : row.google_display_name || row.username || "Player";

  const out = {
    id: row.id,
    displayName,
    username: row.username || null,
  };

  if (opts.includeEmail && row.email_public && row.email) {
    out.email = row.email;
  }

  return out;
}

/**
 * Owner-facing profile (session /me and setup).
 * @param {object} row
 */
export function privateProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    googleDisplayName: row.google_display_name,
    username: row.username,
    hideGoogleName: row.hide_google_name,
    emailPublic: row.email_public,
    profileCompleted: row.profile_completed,
    displayName: row.hide_google_name
      ? row.username || "Player"
      : row.google_display_name || row.username || "Player",
  };
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;
const RESERVED = new Set([
  "admin",
  "administrator",
  "mod",
  "moderator",
  "owner",
  "usc",
  "system",
  "null",
  "undefined",
]);

export function validateUsername(username) {
  if (typeof username !== "string") return "Username is required";
  const trimmed = username.trim();
  if (!USERNAME_RE.test(trimmed)) {
    return "Username must be 3–24 characters: letters, numbers, underscore";
  }
  if (RESERVED.has(trimmed.toLowerCase())) {
    return "That username is reserved";
  }
  return null;
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
