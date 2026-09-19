import { api, escapeHtml } from "../api.js";
import { mountAuthSlot } from "../auth-ui.js";

const list = document.getElementById("category-list");
const status = document.getElementById("forum-status");

function setStatus(msg) {
  if (status) status.textContent = msg || "";
}

async function main() {
  await mountAuthSlot();
  setStatus("Loading categories…");
  try {
    const data = await api("/api/categories");
    setStatus("");
    if (!data.categories?.length) {
      setStatus("No categories yet.");
      return;
    }
    list.innerHTML = data.categories
      .map(
        (c) => `
      <li class="forum-category">
        <a href="/forum/category.html?c=${encodeURIComponent(c.slug)}">
          <span class="forum-category-title">${escapeHtml(c.title)}</span>
          <span class="forum-category-desc">${escapeHtml(c.description || "")}</span>
          <span class="forum-category-meta">${c.threadCount} thread${c.threadCount === 1 ? "" : "s"}</span>
        </a>
      </li>`
      )
      .join("");
  } catch (err) {
    setStatus(err.message || "Could not load forum. Is the API running?");
  }
}

main();
