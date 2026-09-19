import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { migrate } from "./db.js";
import { registerAuthRoutes } from "./auth.js";
import { registerForumRoutes } from "./forum.js";

const PORT = Number(process.env.PORT || 3000);
const STATIC_ROOT = process.env.STATIC_ROOT || "dist";

function writeRuntimeConfig() {
  const clean = (s, fallback) => {
    const raw = String(s || "").trim().replace(/^['"]|['"]$/g, "");
    return raw || fallback;
  };
  const server = clean(
    process.env.VITE_JAVA_ADDRESS || process.env.SERVER_ADDRESS,
    "mc-direct.citadel-codex.com"
  );
  const bedrock = clean(
    process.env.VITE_BEDROCK_ADDRESS || process.env.BEDROCK_ADDRESS,
    "bedrock.citadel-codex.com"
  );
  const escape = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const body = `window.__USC_CONFIG__={server:"${escape(server)}",java:"${escape(server)}",bedrock:"${escape(bedrock)}"};\n`;
  if (!existsSync(STATIC_ROOT)) mkdirSync(STATIC_ROOT, { recursive: true });
  writeFileSync(join(STATIC_ROOT, "config.js"), body, "utf8");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  await migrate();
  writeRuntimeConfig();

  const app = new Hono();

  app.use("*", async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff");
    await next();
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  registerAuthRoutes(app);
  registerForumRoutes(app);

  app.get("/forum", (c) => c.redirect("/forum/", 302));
  app.get("/data-policy", (c) => c.redirect("/data-policy.html", 301));
  app.get("/privacy-policy", (c) => c.redirect("/privacy-policy.html", 301));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

  app.use(
    "/*",
    serveStatic({
      root: STATIC_ROOT,
      rewriteRequestPath: (path) => {
        let p = path;
        if (p === "/forum" || p === "/forum/") p = "/forum/index.html";
        // strip leading slash so join(STATIC_ROOT, path) stays under dist/
        return p.replace(/^\/+/, "");
      },
      onFound: (_path, c) => {
        const reqPath = c.req.path;
        if (reqPath.startsWith("/assets/")) {
          c.header("Cache-Control", "public, max-age=31536000, immutable");
        } else if (/\.(?:webp|png|jpe?g|svg|ico|woff2?)$/i.test(reqPath)) {
          c.header(
            "Cache-Control",
            "public, max-age=86400, stale-while-revalidate=604800"
          );
        } else if (
          /\.(?:html?)$/i.test(reqPath) ||
          reqPath === "/" ||
          reqPath.endsWith("/")
        ) {
          c.header("Cache-Control", "public, max-age=60, must-revalidate");
        }
      },
    })
  );

  app.notFound((c) => {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.text("Not found", 404);
  });

  console.log(`USC site listening on :${PORT} (static=${STATIC_ROOT})`);
  serve({ fetch: app.fetch, port: PORT });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
