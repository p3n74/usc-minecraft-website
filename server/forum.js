import { getPool, query } from "./db.js";
import { publicAuthor } from "./privacy.js";
import {
  getCurrentProfile,
  requireAuth,
  requireCompletedProfile,
} from "./auth.js";

const TITLE_MAX = 120;
const BODY_MAX = 10000;

function authorSelect(alias = "p") {
  return `${alias}.id AS author_id,
    ${alias}.username AS author_username,
    ${alias}.google_display_name AS author_google_display_name,
    ${alias}.hide_google_name AS author_hide_google_name,
    ${alias}.email_public AS author_email_public,
    ${alias}.email AS author_email`;
}

function mapAuthor(row) {
  return publicAuthor(
    {
      id: row.author_id,
      username: row.author_username,
      google_display_name: row.author_google_display_name,
      hide_google_name: row.author_hide_google_name,
      email_public: row.author_email_public,
      email: row.author_email,
    },
    { includeEmail: true }
  );
}

export function registerForumRoutes(app) {
  app.get("/api/categories", async (c) => {
    const { rows } = await query(
      `SELECT c.id, c.slug, c.title, c.description, c.sort_order,
              COUNT(t.id)::int AS thread_count
       FROM categories c
       LEFT JOIN threads t ON t.category_id = c.id AND t.is_hidden = FALSE
       WHERE c.is_hidden = FALSE
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.title ASC`
    );
    return c.json({
      categories: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        description: r.description,
        threadCount: r.thread_count,
      })),
    });
  });

  app.get("/api/categories/:slug/threads", async (c) => {
    const slug = c.req.param("slug");
    const cat = await query(
      `SELECT id, slug, title, description FROM categories
       WHERE slug = $1 AND is_hidden = FALSE`,
      [slug]
    );
    if (!cat.rows[0]) return c.json({ error: "Category not found" }, 404);

    const { rows } = await query(
      `SELECT t.id, t.title, t.created_at, t.updated_at,
              COUNT(p.id)::int AS reply_count,
              ${authorSelect("a")}
       FROM threads t
       JOIN profiles a ON a.id = t.author_id
       LEFT JOIN posts p ON p.thread_id = t.id AND p.is_hidden = FALSE
       WHERE t.category_id = $1 AND t.is_hidden = FALSE
       GROUP BY t.id, a.id
       ORDER BY t.updated_at DESC
       LIMIT 100`,
      [cat.rows[0].id]
    );

    return c.json({
      category: {
        id: cat.rows[0].id,
        slug: cat.rows[0].slug,
        title: cat.rows[0].title,
        description: cat.rows[0].description,
      },
      threads: rows.map((r) => ({
        id: r.id,
        title: r.title,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        replyCount: Math.max(0, r.reply_count - 1),
        postCount: r.reply_count,
        author: mapAuthor(r),
      })),
    });
  });

  app.get("/api/threads/:id", async (c) => {
    const id = c.req.param("id");
    const threadRes = await query(
      `SELECT t.id, t.title, t.created_at, t.updated_at, t.category_id,
              c.slug AS category_slug, c.title AS category_title,
              ${authorSelect("a")}
       FROM threads t
       JOIN categories c ON c.id = t.category_id
       JOIN profiles a ON a.id = t.author_id
       WHERE t.id = $1 AND t.is_hidden = FALSE AND c.is_hidden = FALSE`,
      [id]
    );
    if (!threadRes.rows[0]) return c.json({ error: "Thread not found" }, 404);
    const t = threadRes.rows[0];

    const postsRes = await query(
      `SELECT p.id, p.body, p.created_at,
              ${authorSelect("a")}
       FROM posts p
       JOIN profiles a ON a.id = p.author_id
       WHERE p.thread_id = $1 AND p.is_hidden = FALSE
       ORDER BY p.created_at ASC`,
      [id]
    );

    return c.json({
      thread: {
        id: t.id,
        title: t.title,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        category: {
          id: t.category_id,
          slug: t.category_slug,
          title: t.category_title,
        },
        author: mapAuthor(t),
      },
      posts: postsRes.rows.map((p) => ({
        id: p.id,
        body: p.body,
        createdAt: p.created_at,
        author: mapAuthor(p),
      })),
    });
  });

  app.post(
    "/api/threads",
    requireAuth(),
    requireCompletedProfile(),
    async (c) => {
      const profile = c.get("profile");
      const body = await c.req.json().catch(() => ({}));
      const categorySlug = String(body.categorySlug || "").trim();
      const title = String(body.title || "").trim();
      const content = String(body.body || "").trim();

      if (!categorySlug) return c.json({ error: "Category is required" }, 400);
      if (title.length < 3 || title.length > TITLE_MAX) {
        return c.json({ error: `Title must be 3–${TITLE_MAX} characters` }, 400);
      }
      if (content.length < 1 || content.length > BODY_MAX) {
        return c.json({ error: `Body must be 1–${BODY_MAX} characters` }, 400);
      }

      const cat = await query(
        `SELECT id FROM categories WHERE slug = $1 AND is_hidden = FALSE`,
        [categorySlug]
      );
      if (!cat.rows[0]) return c.json({ error: "Category not found" }, 404);

      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        const threadIns = await client.query(
          `INSERT INTO threads (category_id, author_id, title)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [cat.rows[0].id, profile.id, title]
        );
        const threadId = threadIns.rows[0].id;
        await client.query(
          `INSERT INTO posts (thread_id, author_id, body)
           VALUES ($1, $2, $3)`,
          [threadId, profile.id, content]
        );
        await client.query("COMMIT");
        return c.json({ id: threadId }, 201);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
  );

  app.post(
    "/api/threads/:id/replies",
    requireAuth(),
    requireCompletedProfile(),
    async (c) => {
      const profile = c.get("profile");
      const threadId = c.req.param("id");
      const body = await c.req.json().catch(() => ({}));
      const content = String(body.body || "").trim();
      if (content.length < 1 || content.length > BODY_MAX) {
        return c.json({ error: `Body must be 1–${BODY_MAX} characters` }, 400);
      }

      const thread = await query(
        `SELECT id FROM threads WHERE id = $1 AND is_hidden = FALSE`,
        [threadId]
      );
      if (!thread.rows[0]) return c.json({ error: "Thread not found" }, 404);

      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        const postIns = await client.query(
          `INSERT INTO posts (thread_id, author_id, body)
           VALUES ($1, $2, $3)
           RETURNING id, created_at`,
          [threadId, profile.id, content]
        );
        await client.query(
          `UPDATE threads SET updated_at = NOW() WHERE id = $1`,
          [threadId]
        );
        await client.query("COMMIT");
        return c.json(
          {
            id: postIns.rows[0].id,
            createdAt: postIns.rows[0].created_at,
          },
          201
        );
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
  );

  app.get("/api/users/:username", async (c) => {
    const username = c.req.param("username");
    const { rows } = await query(
      `SELECT * FROM profiles
       WHERE LOWER(username) = LOWER($1) AND profile_completed = TRUE`,
      [username]
    );
    if (!rows[0]) return c.json({ error: "User not found" }, 404);
    const viewer = await getCurrentProfile(c);
    const isSelf = viewer && viewer.id === rows[0].id;
    const author = publicAuthor(rows[0], { includeEmail: true });
    return c.json({
      user: {
        ...author,
        ...(isSelf
          ? {
              email: rows[0].email,
              googleDisplayName: rows[0].google_display_name,
              hideGoogleName: rows[0].hide_google_name,
              emailPublic: rows[0].email_public,
            }
          : {}),
      },
    });
  });
}
