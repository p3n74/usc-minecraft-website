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

  if (row.mc_username) out.mcUsername = row.mc_username;
  if (row.mc_uuid) out.mcUuid = row.mc_uuid;
  if (row.banner_color) out.bannerColor = row.banner_color;

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
    mcUsername: row.mc_username || null,
    mcUuid: row.mc_uuid || null,
    bannerColor: row.banner_color || "#2d641c",
    discordHandle: row.discord_handle || null,
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

export function normalizeMcUuid(raw) {
  if (!raw) return null;
  const hex = String(raw).replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function validateMcUsername(name) {
  if (!name) return null;
  if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) {
    return "Minecraft username must be 1–16 letters, numbers, or underscore";
  }
  return null;
}

export function validateDiscordHandle(handle) {
  if (!handle) return null;
  if (!/^[a-zA-Z0-9._]{2,32}$/.test(handle)) {
    return "Discord handle must be 2–32 letters, numbers, dots, or underscores";
  }
  return null;
}

export function validateBannerColor(color) {
  if (!color) return "#2d641c";
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return null;
  return color.toLowerCase();
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
