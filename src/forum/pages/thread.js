import { api, authorLink, escapeHtml, formatDate, googleLoginUrl } from "../api.js";
import { mountAuthSlot } from "../auth-ui.js";

const params = new URLSearchParams(window.location.search);
const id = params.get("id") || "";

async function main() {
  const user = await mountAuthSlot();
  const status = document.getElementById("forum-status");
  const list = document.getElementById("post-list");

  if (!id) {
    status.textContent = "Missing thread.";
    return;
  }

  status.textContent = "Loading…";
  try {
    const data = await api(`/api/threads/${encodeURIComponent(id)}`);
    const t = data.thread;
    document.getElementById("thread-title").textContent = t.title;
    document.title = `${t.title} — USC Minecraft Forum`;
    const crumb = document.getElementById("crumb-cat");
    crumb.textContent = t.category.title;
    crumb.href = `/forum/category.html?c=${encodeURIComponent(t.category.slug)}`;
    document.getElementById("thread-meta").innerHTML =
      `${authorLink(t.author)} · started ${formatDate(t.createdAt)}`;

    list.innerHTML = data.posts
      .map(
        (p) => `
      <li class="forum-post panel">
        <header class="forum-post-head">
          ${authorLink(p.author)}
          <time datetime="${escapeHtml(p.createdAt)}">${formatDate(p.createdAt)}</time>
        </header>
        <div class="forum-post-body">${escapeHtml(p.body).replace(/\n/g, "<br>")}</div>
      </li>`
      )
      .join("");

    status.textContent = "";

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
