import { api, authorLink, escapeHtml, formatDate } from "../api.js";
import { mountAuthSlot, googleLoginUrl } from "../auth-ui.js";

const params = new URLSearchParams(window.location.search);
const slug = params.get("c") || "";

async function main() {
  const user = await mountAuthSlot();
  const status = document.getElementById("forum-status");
  const list = document.getElementById("thread-list");

  if (!slug) {
    status.textContent = "Missing category.";
    return;
  }

  status.textContent = "Loading…";
  try {
    const data = await api(`/api/categories/${encodeURIComponent(slug)}/threads`);
    document.getElementById("cat-title").textContent = data.category.title;
    document.getElementById("cat-desc").textContent = data.category.description || "";
    document.title = `${data.category.title} — USC Minecraft Forum`;

    const actions = document.getElementById("cat-actions");
    const newLink = document.getElementById("new-thread-link");
    if (user?.profileCompleted) {
      actions.hidden = false;
      newLink.href = `/forum/new.html?c=${encodeURIComponent(slug)}`;
    } else if (!user) {
      actions.hidden = false;
      newLink.href = googleLoginUrl(`/forum/new.html?c=${encodeURIComponent(slug)}`);
      newLink.textContent = "Sign in to post";
    } else {
      actions.hidden = false;
      newLink.href = "/forum/setup.html";
      newLink.textContent = "Finish profile to post";
    }

    status.textContent = "";
    if (!data.threads.length) {
      list.innerHTML = `<li class="forum-empty">No threads yet. Be the first.</li>`;
      return;
    }
    list.innerHTML = data.threads
      .map(
        (t) => `
      <li class="forum-thread">
        <a href="/forum/thread.html?id=${encodeURIComponent(t.id)}">
          <span class="forum-thread-title">${escapeHtml(t.title)}</span>
          <span class="forum-thread-meta">
            ${authorLink(t.author)} · ${t.replyCount} ${t.replyCount === 1 ? "reply" : "replies"} · ${formatDate(t.updatedAt)}
          </span>
        </a>
      </li>`
      )
      .join("");
  } catch (err) {
    status.textContent = err.message || "Failed to load category";
  }
}

main();
