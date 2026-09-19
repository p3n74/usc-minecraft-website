import { api, authorLink, formatDate, googleLoginUrl } from "../api.js";
import { mountAuthSlot } from "../auth-ui.js";
import { mountCommandPalette } from "../palette.js";
import {
  buildCommentTree,
  sortTree,
  renderCommentTree,
  bindThreadComments,
} from "../comments.js";
import { applyVote, nextVote, paintVote } from "../votes.js";

const params = new URLSearchParams(window.location.search);
const id = params.get("id") || "";
let posts = [];
let user = null;
let sortMode = localStorage.getItem("usc_comment_sort") || "top";

function redraw() {
  const tree = sortTree(buildCommentTree(posts), sortMode);
  renderCommentTree(document.getElementById("comment-tree"), tree, {
    canReply: Boolean(user?.profileCompleted),
  });
}

async function main() {
  user = await mountAuthSlot();
  await mountCommandPalette(user);
  const status = document.getElementById("forum-status");

  if (!id) {
    status.textContent = "Missing thread.";
    return;
  }

  status.textContent = "Loading…";
  try {
    const data = await api(`/api/threads/${encodeURIComponent(id)}`);
    const t = data.thread;
    posts = data.posts || [];
    document.getElementById("thread-title").textContent = t.title;
    document.title = `${t.title} — USC Minecraft Forum`;
    const crumb = document.getElementById("crumb-cat");
    crumb.textContent = t.category.title;
    crumb.href = `/forum/category.html?c=${encodeURIComponent(t.category.slug)}`;
    document.getElementById("thread-meta").innerHTML =
      `${authorLink(t.author)} · started ${formatDate(t.createdAt)}`;

    const tVote = document.getElementById("thread-vote");
    if (tVote) {
      tVote.dataset.id = t.id;
      paintVote(tVote, { score: t.score || 0, myVote: t.myVote || 0 });
      tVote.querySelectorAll(".vote-btn").forEach((b) => {
        b.disabled = !user?.profileCompleted;
        b.dataset.id = t.id;
      });
    }

    document.querySelectorAll(".forum-sort-btn").forEach((btn) => {
      const on = btn.dataset.sort === sortMode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", String(on));
      btn.addEventListener("click", () => {
        sortMode = btn.dataset.sort;
        localStorage.setItem("usc_comment_sort", sortMode);
        document.querySelectorAll(".forum-sort-btn").forEach((b) => {
          const active = b.dataset.sort === sortMode;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-selected", String(active));
        });
        redraw();
      });
    });

    redraw();
    status.textContent = "";

    bindThreadComments(document.getElementById("comment-tree"), {
      canVote: Boolean(user?.profileCompleted),
      onReply: async (parentId, body) => {
        await api(`/api/threads/${encodeURIComponent(id)}/replies`, {
          method: "POST",
          body: JSON.stringify({ body, parentId }),
        });
        window.location.reload();
      },
    });

    tVote?.addEventListener("click", async (e) => {
      const btn = e.target.closest(".vote-btn");
      if (!btn || !user?.profileCompleted) return;
      const clicked = Number(btn.dataset.vote);
      const current = btn.classList.contains("is-on") ? clicked : 0;
      const other = tVote.querySelector(".vote-btn.is-on");
      const cur = other ? Number(other.dataset.vote) : 0;
      const value = nextVote(cur, clicked);
      try {
        const res = await applyVote("thread", t.id, value);
        paintVote(tVote, res);
      } catch (err) {
        status.textContent = err.message || "Could not vote";
      }
    });

    const replySection = document.getElementById("reply-section");
    const replyGate = document.getElementById("reply-gate");
    if (user?.profileCompleted) {
      replySection.hidden = false;
      document.getElementById("reply-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const body = document.getElementById("reply-body").value.trim();
        try {
          await api(`/api/threads/${encodeURIComponent(id)}/replies`, {
            method: "POST",
            body: JSON.stringify({ body }),
          });
          window.location.reload();
        } catch (err) {
          status.textContent = err.message || "Could not post reply";
        }
      });
    } else if (!user) {
      replyGate.hidden = false;
      replyGate.innerHTML = `<a class="btn btn-green" href="${googleLoginUrl()}">Sign in to reply</a>`;
    } else {
      replyGate.hidden = false;
      replyGate.innerHTML = `<a class="btn btn-green" href="/forum/setup.html">Finish your profile to reply</a>`;
    }
  } catch (err) {
    status.textContent = err.message || "Failed to load thread";
  }
}

main();
