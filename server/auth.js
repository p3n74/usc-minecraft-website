import { Google } from "arctic";
import { randomBytes } from "node:crypto";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { query } from "./db.js";
import {
  COOKIE_NAME,
  createSession,
  destroySession,
  getProfileFromToken,
  sessionCookieOptions,
} from "./session.js";
import {
  privateProfile,
  validateUsername,
  normalizeMcUuid,
  validateMcUsername,
  validateDiscordHandle,
  validateBannerColor,
} from "./privacy.js";

const OAUTH_STATE_COOKIE = "usc_oauth_state";
const OAUTH_VERIFIER_COOKIE = "usc_oauth_verifier";

function googleClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.PUBLIC_ORIGIN || "http://localhost:3000"}/api/auth/google/callback`;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required");
  }
  return new Google(clientId, clientSecret, redirectUri);
}

export async function getCurrentProfile(c) {
  const token = getCookie(c, COOKIE_NAME);
  return getProfileFromToken(token);
}

export function requireAuth() {
  return async (c, next) => {
    const profile = await getCurrentProfile(c);
    if (!profile) {
      return c.json({ error: "Sign in required" }, 401);
    }
    c.set("profile", profile);
    await next();
  };
}

export function requireCompletedProfile() {
  return async (c, next) => {
    const profile = c.get("profile");
    if (!profile?.profile_completed) {
      return c.json({ error: "Complete your profile first", code: "PROFILE_INCOMPLETE" }, 403);
    }
    await next();
  };
}

export function registerAuthRoutes(app) {
  app.get("/api/auth/me", async (c) => {
    const profile = await getCurrentProfile(c);
    if (!profile) return c.json({ user: null });
    return c.json({ user: privateProfile(profile) });
  });

  app.get("/api/auth/google", async (c) => {
    try {
      const google = googleClient();
      const state = randomBytes(16).toString("hex");
      const codeVerifier = randomBytes(32).toString("base64url");
      const url = google.createAuthorizationURL(state, codeVerifier, [
        "openid",
        "profile",
        "email",
      ]);
      const cookieOpts = sessionCookieOptions(600);
      setCookie(c, OAUTH_STATE_COOKIE, state, cookieOpts);
      setCookie(c, OAUTH_VERIFIER_COOKIE, codeVerifier, cookieOpts);
      const returnTo = c.req.query("returnTo") || "/forum/";
      setCookie(c, "usc_return_to", returnTo.slice(0, 200), cookieOpts);
      return c.redirect(url.toString());
    } catch (err) {
      console.error("Google OAuth start failed:", err);
      return c.json({ error: "Google sign-in is not configured" }, 503);
    }
  });

  app.get("/api/auth/google/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const storedState = getCookie(c, OAUTH_STATE_COOKIE);
    const codeVerifier = getCookie(c, OAUTH_VERIFIER_COOKIE);
    const returnTo = getCookie(c, "usc_return_to") || "/forum/";

    deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });
    deleteCookie(c, OAUTH_VERIFIER_COOKIE, { path: "/" });
    deleteCookie(c, "usc_return_to", { path: "/" });

    if (!code || !state || !storedState || state !== storedState || !codeVerifier) {
      return c.redirect("/forum/setup.html?error=oauth_state");
    }

    try {
      const google = googleClient();
      const tokens = await google.validateAuthorizationCode(code, codeVerifier);
      const accessToken = tokens.accessToken();

      const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userRes.ok) {
        throw new Error(`userinfo ${userRes.status}`);
      }
      const info = await userRes.json();
      const sub = info.sub;
      const email = info.email;
      const name = info.name || info.given_name || "";
      if (!sub || !email) {
        throw new Error("Google account missing sub/email");
      }

      let { rows } = await query(`SELECT * FROM profiles WHERE google_sub = $1`, [sub]);
      let profile = rows[0];
      if (!profile) {
        const inserted = await query(
          `INSERT INTO profiles (google_sub, email, google_display_name)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [sub, email, name]
        );
        profile = inserted.rows[0];
      } else {
        const updated = await query(
          `UPDATE profiles
           SET email = $2, google_display_name = $3, updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [profile.id, email, name]
        );
        profile = updated.rows[0];
      }

      const { token, expiresAt } = await createSession(profile.id);
      const maxAge = Math.max(60, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setCookie(c, COOKIE_NAME, token, sessionCookieOptions(maxAge));

      if (!profile.profile_completed) {
        return c.redirect("/forum/setup.html");
      }
      const safeReturn = returnTo.startsWith("/") ? returnTo : "/forum/";
      return c.redirect(safeReturn);
    } catch (err) {
      console.error("Google OAuth callback failed:", err);
      return c.redirect("/forum/setup.html?error=oauth_failed");
    }
  });

  app.post("/api/auth/logout", async (c) => {
    const token = getCookie(c, COOKIE_NAME);
    await destroySession(token);
    deleteCookie(c, COOKIE_NAME, { path: "/" });
    return c.json({ ok: true });
  });

  app.post("/api/profile/setup", requireAuth(), async (c) => {
    const profile = c.get("profile");
    const body = await c.req.json().catch(() => ({}));
    const hideGoogleName = Boolean(body.hideGoogleName);
    const emailPublic = Boolean(body.emailPublic);
    let username = typeof body.username === "string" ? body.username.trim() : "";

    if (hideGoogleName || !username) {
      // Username always required before posting / completing profile
    }
    if (!username) {
      return c.json({ error: "Username is required" }, 400);
    }
    const usernameError = validateUsername(username);
    if (usernameError) {
      return c.json({ error: usernameError }, 400);
    }
    if (hideGoogleName && !username) {
      return c.json({ error: "Username is required when hiding your Google name" }, 400);
    }

    const conflict = await query(
      `SELECT id FROM profiles WHERE LOWER(username) = LOWER($1) AND id <> $2`,
      [username, profile.id]
    );
    if (conflict.rows.length) {
      return c.json({ error: "Username is already taken" }, 409);
    }

    const { rows } = await query(
      `UPDATE profiles
       SET username = $2,
           hide_google_name = $3,
           email_public = $4,
           profile_completed = TRUE,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [profile.id, username, hideGoogleName, emailPublic]
    );
    return c.json({ user: privateProfile(rows[0]) });
  });

  app.patch("/api/profile", requireAuth(), async (c) => {
    const profile = c.get("profile");
    if (!profile.profile_completed) {
      return c.json({ error: "Complete setup first", code: "PROFILE_INCOMPLETE" }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    const hideGoogleName =
      body.hideGoogleName !== undefined
        ? Boolean(body.hideGoogleName)
        : profile.hide_google_name;
    const emailPublic =
      body.emailPublic !== undefined ? Boolean(body.emailPublic) : profile.email_public;
    let username =
      typeof body.username === "string" ? body.username.trim() : profile.username;

    if (!username) {
      return c.json({ error: "Username is required" }, 400);
    }
    const usernameError = validateUsername(username);
    if (usernameError) {
      return c.json({ error: usernameError }, 400);
    }
    if (hideGoogleName && !username) {
      return c.json({ error: "Username is required when hiding your Google name" }, 400);
    }

    const conflict = await query(
      `SELECT id FROM profiles WHERE LOWER(username) = LOWER($1) AND id <> $2`,
      [username, profile.id]
    );
    if (conflict.rows.length) {
      return c.json({ error: "Username is already taken" }, 409);
    }

    const mcUsername =
      typeof body.mcUsername === "string" ? body.mcUsername.trim() : profile.mc_username;
    const mcNameErr = validateMcUsername(mcUsername);
    if (mcNameErr) return c.json({ error: mcNameErr }, 400);
    const mcUuidRaw =
      typeof body.mcUuid === "string" ? body.mcUuid.trim() : profile.mc_uuid;
    let mcUuid = profile.mc_uuid;
    if (body.mcUuid !== undefined) {
      if (!mcUuidRaw) mcUuid = null;
      else {
        mcUuid = normalizeMcUuid(mcUuidRaw);
        if (!mcUuid) return c.json({ error: "Invalid Minecraft UUID" }, 400);
      }
    }
    const bannerColor = validateBannerColor(
      body.bannerColor !== undefined ? body.bannerColor : profile.banner_color
    );
    if (bannerColor === null) return c.json({ error: "Invalid banner color" }, 400);
    const discordHandle =
      body.discordHandle !== undefined
        ? String(body.discordHandle || "").trim() || null
        : profile.discord_handle;
    const discordErr = validateDiscordHandle(discordHandle);
    if (discordErr) return c.json({ error: discordErr }, 400);

    const { rows } = await query(
      `UPDATE profiles
       SET username = $2,
           hide_google_name = $3,
           email_public = $4,
           mc_username = $5,
           mc_uuid = $6,
           banner_color = $7,
           discord_handle = $8,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        profile.id,
        username,
        hideGoogleName,
        emailPublic,
        mcUsername || null,
        mcUuid,
        bannerColor,
        discordHandle,
      ]
    );
    return c.json({ user: privateProfile(rows[0]) });
  });
}
