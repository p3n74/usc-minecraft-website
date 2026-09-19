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
    ${alias}.email AS author_email,
    ${alias}.mc_username AS author_mc_username,
    ${alias}.mc_uuid AS author_mc_uuid,
    ${alias}.banner_color AS author_banner_color`;
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
      mc_username: row.author_mc_username,
      mc_uuid: row.author_mc_uuid,
      banner_color: row.author_banner_color,
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
              COALESCE((
                SELECT SUM(v.value)::int FROM votes v
                WHERE v.target_type = 'thread' AND v.target_id = t.id
              ), 0) AS score,
              ${authorSelect("a")}
       FROM threads t
       JOIN profiles a ON a.id = t.author_id
       LEFT JOIN posts p ON p.thread_id = t.id AND p.is_hidden = FALSE
       WHERE t.category_id = $1 AND t.is_hidden = FALSE
       GROUP BY t.id, a.id
       ORDER BY score DESC, t.updated_at DESC
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
        score: r.score,
        author: mapAuthor(r),
      })),
    });
  });

  app.get("/api/threads/:id", async (c) => {
    const id = c.req.param("id");
    const viewer = await getCurrentProfile(c);
    const threadRes = await query(
      `SELECT t.id, t.title, t.created_at, t.updated_at, t.category_id,
              c.slug AS category_slug, c.title AS category_title,
              COALESCE((
                SELECT SUM(v.value)::int FROM votes v
                WHERE v.target_type = 'thread' AND v.target_id = t.id
              ), 0) AS score,
              ${authorSelect("a")}
       FROM threads t
       JOIN categories c ON c.id = t.category_id
       JOIN profiles a ON a.id = t.author_id
       WHERE t.id = $1 AND t.is_hidden = FALSE AND c.is_hidden = FALSE`,
      [id]
    );
    if (!threadRes.rows[0]) return c.json({ error: "Thread not found" }, 404);
    const t = threadRes.rows[0];

    let myThreadVote = 0;
    if (viewer) {
      const vr = await query(
        `SELECT value FROM votes WHERE profile_id = $1 AND target_type = 'thread' AND target_id = $2`,
        [viewer.id, id]
      );
      myThreadVote = vr.rows[0]?.value || 0;
    }

    const postsRes = await query(
      `SELECT p.id, p.body, p.created_at, p.parent_id,
              COALESCE(SUM(v.value), 0)::int AS score,
              COUNT(*) FILTER (WHERE v.value = 1)::int AS ups,
              COUNT(*) FILTER (WHERE v.value = -1)::int AS downs,
              ${authorSelect("a")}
       FROM posts p
       JOIN profiles a ON a.id = p.author_id
       LEFT JOIN votes v ON v.target_type = 'post' AND v.target_id = p.id
       WHERE p.thread_id = $1 AND p.is_hidden = FALSE
       GROUP BY p.id, a.id
       ORDER BY p.created_at ASC`,
      [id]
    );

    let myVotes = new Map();
    if (viewer && postsRes.rows.length) {
      const ids = postsRes.rows.map((p) => p.id);
      const mine = await query(
        `SELECT target_id, value FROM votes
         WHERE profile_id = $1 AND target_type = 'post' AND target_id = ANY($2::uuid[])`,
        [viewer.id, ids]
      );
      myVotes = new Map(mine.rows.map((r) => [r.target_id, r.value]));
    }

    return c.json({
      thread: {
        id: t.id,
        title: t.title,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        score: t.score,
        myVote: myThreadVote,
        category: {
          id: t.category_id,
          slug: t.category_slug,
          title: t.category_title,
        },
        author: mapAuthor(t),
      },
      posts: postsRes.rows.map((p) => ({
        id: p.id,
        parentId: p.parent_id,
        body: p.body,
        createdAt: p.created_at,
        score: p.score,
        ups: p.ups,
        downs: p.downs,
        myVote: myVotes.get(p.id) || 0,
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
      const parentId = body.parentId || null;
      if (content.length < 1 || content.length > BODY_MAX) {
        return c.json({ error: `Body must be 1–${BODY_MAX} characters` }, 400);
      }

      const thread = await query(
        `SELECT id FROM threads WHERE id = $1 AND is_hidden = FALSE`,
        [threadId]
      );
      if (!thread.rows[0]) return c.json({ error: "Thread not found" }, 404);

      if (parentId) {
        const parent = await query(
          `SELECT id FROM posts WHERE id = $1 AND thread_id = $2 AND is_hidden = FALSE`,
          [parentId, threadId]
        );
        if (!parent.rows[0]) return c.json({ error: "Parent comment not found" }, 404);
      }

      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        const postIns = await client.query(
          `INSERT INTO posts (thread_id, author_id, body, parent_id)
           VALUES ($1, $2, $3, $4)
           RETURNING id, created_at, parent_id`,
          [threadId, profile.id, content, parentId]
        );
        await client.query(
          `UPDATE threads SET updated_at = NOW() WHERE id = $1`,
          [threadId]
        );
        await client.query("COMMIT");
        return c.json(
          {
            id: postIns.rows[0].id,
            parentId: postIns.rows[0].parent_id,
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

  app.put(
    "/api/votes/:type/:id",
    requireAuth(),
    requireCompletedProfile(),
    async (c) => {
      const profile = c.get("profile");
      const type = c.req.param("type");
      const targetId = c.req.param("id");
      if (type !== "post" && type !== "thread") {
        return c.json({ error: "Invalid vote target" }, 400);
      }
      const body = await c.req.json().catch(() => ({}));
      let value = Number(body.value);
      if (![ -1, 0, 1 ].includes(value)) {
        return c.json({ error: "Vote must be -1, 0, or 1" }, 400);
      }

      if (type === "thread") {
        const exists = await query(
          `SELECT id FROM threads WHERE id = $1 AND is_hidden = FALSE`,
          [targetId]
        );
        if (!exists.rows[0]) return c.json({ error: "Thread not found" }, 404);
      } else {
        const exists = await query(
          `SELECT id FROM posts WHERE id = $1 AND is_hidden = FALSE`,
          [targetId]
        );
        if (!exists.rows[0]) return c.json({ error: "Post not found" }, 404);
      }

      if (value === 0) {
        await query(
          `DELETE FROM votes WHERE profile_id = $1 AND target_type = $2 AND target_id = $3`,
          [profile.id, type, targetId]
        );
      } else {
        await query(
          `INSERT INTO votes (profile_id, target_type, target_id, value)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (profile_id, target_type, target_id)
           DO UPDATE SET value = EXCLUDED.value`,
          [profile.id, type, targetId, value]
        );
      }

      const sum = await query(
        `SELECT COALESCE(SUM(value), 0)::int AS score,
                COUNT(*) FILTER (WHERE value = 1)::int AS ups,
                COUNT(*) FILTER (WHERE value = -1)::int AS downs
         FROM votes WHERE target_type = $1 AND target_id = $2`,
        [type, targetId]
      );
      return c.json({
        score: sum.rows[0].score,
        ups: sum.rows[0].ups,
        downs: sum.rows[0].downs,
        myVote: value,
      });
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
        mcUsername: rows[0].mc_username || null,
        mcUuid: rows[0].mc_uuid || null,
        bannerColor: rows[0].banner_color || "#2d641c",
        ...(isSelf
          ? {
              email: rows[0].email,
              googleDisplayName: rows[0].google_display_name,
              hideGoogleName: rows[0].hide_google_name,
              emailPublic: rows[0].email_public,
              discordHandle: rows[0].discord_handle,
            }
          : {}),
      },
    });
  });
}
