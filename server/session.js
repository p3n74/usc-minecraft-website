import { createHash, randomBytes } from "node:crypto";
import { query } from "./db.js";

const COOKIE_NAME = "usc_session";
const SESSION_DAYS = 30;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions(maxAgeSec) {
  const secure = process.env.COOKIE_SECURE !== "false";
  return {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "Lax",
    maxAge: maxAgeSec,
  };
}

export async function createSession(profileId) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO sessions (profile_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [profileId, tokenHash, expiresAt.toISOString()]
  );
  return { token, expiresAt };
}

export async function destroySession(token) {
  if (!token) return;
  await query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
}

export async function getProfileFromToken(token) {
  if (!token) return null;
  const { rows } = await query(
    `SELECT p.*
     FROM sessions s
     JOIN profiles p ON p.id = s.profile_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [hashToken(token)]
  );
  return rows[0] || null;
}

export { COOKIE_NAME };
