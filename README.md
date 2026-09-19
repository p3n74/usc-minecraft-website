# USC Minecraft website

One-page site + community forum for **https://usc.citadel-codex.com**.

## Stack

- Vite + vanilla HTML/CSS/JS (MPA)
- Hono API (Google OAuth, sessions, forum) + Postgres
- Docker: multi-stage Node build → Node runtime (serves `dist/` + `/api`)
- Coolify project `usc` + Cloudflare DNS

**Do not deploy with `Dockerfile.coolify`.** That file is a frozen snapshot and is gitignored. Always use the root `Dockerfile` from a real git repository.

## Local development

```bash
cp .env.example .env
# Fill DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
# For Vite proxy + cookies: PUBLIC_ORIGIN=http://localhost:5173
# GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
# COOKIE_SECURE=false

npm install
# Terminal 1 — API (requires Postgres)
npm run dev:server
# Terminal 2 — Vite (proxies /api → :3000)
npm run dev
```

Privacy unit tests (no DB):

```bash
npm run test:privacy
```

Production-like locally:

```bash
npm run build
STATIC_ROOT=dist COOKIE_SECURE=false npm start
```

## Coolify (production)

1. Push this repo to GitHub/GitLab (or any git Coolify can pull).
2. In Coolify project **usc**, point `usc-website` at that repo, branch `main`, **Dockerfile** (not Dockerfile.coolify). Set **Ports Exposes** to `3000`.
3. Add a **Postgres** database in the same project; set `DATABASE_URL` on the app (internal Coolify URL).
4. Env vars (runtime):

| Key | Notes |
|-----|--------|
| `DATABASE_URL` | Postgres connection string |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth Web client |
| `GOOGLE_REDIRECT_URI` | `https://usc.citadel-codex.com/api/auth/google/callback` |
| `PUBLIC_ORIGIN` | `https://usc.citadel-codex.com` |
| `VITE_JAVA_ADDRESS` | Java join address for `config.js` |
| `VITE_BEDROCK_ADDRESS` | Bedrock join address for `config.js` |
| `COOKIE_SECURE` | `true` |
| `PORT` | `3000` |

5. Google Cloud Console → authorized redirect URI must match `GOOGLE_REDIRECT_URI`.
6. Redeploy and hit `/api/health`, then `/forum/`.

Schema migrations run automatically on process start (`server/migrations/001_init.sql`).

## Forum

- Public: browse categories → threads → replies
- Google sign-in required to post
- First login → `/forum/setup.html` (username required; hide Google name optional; email public opt-in, default off)
