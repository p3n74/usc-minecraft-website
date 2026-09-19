import { authorLink, escapeHtml, formatDate } from "./api.js";
import { mcHeadsUrl } from "./mc-identity.js";
import { applyVote, nextVote, paintVote } from "./votes.js";

export function scoreControversial(node) {
  const ups = node.ups || 0;
  const downs = node.downs || 0;
  const total = ups + downs;
  if (!total) return 0;
  return total * (1 - Math.abs(ups - downs) / total);
}

export function buildCommentTree(posts) {
  const map = new Map();
  const roots = [];
  for (const p of posts) {
    map.set(p.id, { ...p, children: [] });
  }
  for (const p of map.values()) {
    if (p.parentId && map.has(p.parentId)) {
      map.get(p.parentId).children.push(p);
    } else {
      roots.push(p);
    }
  }
  return roots;
}

export function sortTree(nodes, mode) {
  const copy = nodes.map((n) => ({
    ...n,
    children: sortTree(n.children || [], mode),
  }));
  copy.sort((a, b) => {
    if (mode === "new") {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (mode === "controversial") {
      return scoreControversial(b) - scoreControversial(a);
    }
    if (b.score !== a.score) return b.score - a.score;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
  return copy;
}

function face(author) {
  const src = mcHeadsUrl({ uuid: author?.mcUuid, name: author?.mcUsername, size: 24 });
  if (!src) return "";
  return `<img class="mc-face" src="${escapeHtml(src)}" width="24" height="24" alt="">`;
}

function commentHtml(node, depth, canReply) {
  const kids = (node.children || [])
    .map((c) => commentHtml(c, depth + 1, canReply))
    .join("");
  return `
    <li class="comment${depth === 0 && !node.parentId ? " is-op" : ""}" id="c-${node.id}"
        data-id="${node.id}" data-depth="${depth}" style="--depth:${depth}">
      <article class="comment-card panel">
        <div class="comment-vote">
          <button type="button" class="vote-btn vote-up${node.myVote === 1 ? " is-on" : ""}" data-vote="1" data-type="post" data-id="${node.id}"
            aria-pressed="${node.myVote === 1}" ${canReply ? "" : "disabled"} aria-label="Upvote">▲</button>
          <span class="vote-score">${node.score || 0}</span>
          <button type="button" class="vote-btn vote-down${node.myVote === -1 ? " is-on" : ""}" data-vote="-1" data-type="post" data-id="${node.id}"
            aria-pressed="${node.myVote === -1}" ${canReply ? "" : "disabled"} aria-label="Downvote">▼</button>
        </div>
        <div class="comment-main">
          <header class="comment-head">
            <button type="button" class="comment-collapse" aria-expanded="true" aria-controls="c-${node.id}-body">−</button>
            ${face(node.author)}
            ${authorLink(node.author)}
            <time datetime="${escapeHtml(node.createdAt)}">${formatDate(node.createdAt)}</time>
          </header>
          <div id="c-${node.id}-body" class="comment-body-wrap">
            <div class="comment-body">${escapeHtml(node.body).replace(/\n/g, "<br>")}</div>
            <footer class="comment-actions">
              ${canReply ? `<button type="button" class="comment-reply-btn" data-parent="${node.id}">Reply</button>` : ""}
            </footer>
            <form class="comment-reply-form forum-compose" hidden data-parent="${node.id}">
              <label class="forum-label">
                <span class="sr-only">Reply</span>
                <textarea rows="3" maxlength="10000" required></textarea>
              </label>
              <button class="btn btn-green btn-sm" type="submit">Post</button>
              <button class="btn btn-dark btn-sm" type="button" data-cancel-reply>Cancel</button>
            </form>
            <ol class="comment-children">${kids}</ol>
          </div>
        </div>
      </article>
    </li>`;
}

export function renderCommentTree(el, nodes, { canReply }) {
  el.innerHTML = nodes.map((n) => commentHtml(n, 0, canReply)).join("") ||
    `<li class="forum-empty">No comments yet.</li>`;
}

export function bindThreadComments(root, { onReply, canVote }) {
  root.addEventListener("click", async (e) => {
    const collapse = e.target.closest(".comment-collapse");
    if (collapse) {
      const li = collapse.closest(".comment");
      const open = collapse.getAttribute("aria-expanded") === "true";
      collapse.setAttribute("aria-expanded", String(!open));
      collapse.textContent = open ? "+" : "−";
      li.classList.toggle("is-collapsed", open);
      return;
    }

    const cancel = e.target.closest("[data-cancel-reply]");
    if (cancel) {
      cancel.closest("form").hidden = true;
      return;
    }

    const replyBtn = e.target.closest(".comment-reply-btn");
    if (replyBtn) {
      const form = replyBtn.closest(".comment-body-wrap").querySelector(".comment-reply-form");
      form.hidden = false;
      form.querySelector("textarea").focus();
      return;
    }

    const voteBtn = e.target.closest(".vote-btn");
    if (voteBtn) {
      if (!canVote) return;
      const box = voteBtn.closest(".comment-vote, .thread-vote");
      const type = voteBtn.dataset.type;
      const id = voteBtn.dataset.id;
      const clicked = Number(voteBtn.dataset.vote);
      const current = voteBtn.classList.contains("vote-up") && voteBtn.classList.contains("is-on")
        ? 1
        : voteBtn.classList.contains("vote-down") && voteBtn.classList.contains("is-on")
          ? -1
          : 0;
      const value = nextVote(current, clicked);
      try {
        const res = await applyVote(type, id, value);
        paintVote(box, res);
      } catch {
        /* status handled by caller if needed */
      }
    }
  });

  root.addEventListener("submit", async (e) => {
    const form = e.target.closest(".comment-reply-form");
    if (!form) return;
    e.preventDefault();
    const parentId = form.dataset.parent;
    const body = form.querySelector("textarea").value.trim();
    await onReply(parentId, body);
  });
}
