import { api, googleLoginUrl } from "../api.js";
import { mountAuthSlot } from "../auth-ui.js";

const params = new URLSearchParams(window.location.search);
const preset = params.get("c") || "";

async function main() {
  const user = await mountAuthSlot();
  const status = document.getElementById("forum-status");
  const form = document.getElementById("new-thread-form");
  const select = document.getElementById("thread-category");

  if (!user) {
    status.innerHTML = `Sign in required. <a href="${googleLoginUrl()}">Sign in with Google</a>`;
    form.hidden = true;
    return;
  }
  if (!user.profileCompleted) {
    window.location.href = "/forum/setup.html";
    return;
  }

  try {
    const data = await api("/api/categories");
    select.innerHTML = data.categories
      .map(
        (c) =>
          `<option value="${c.slug}" ${c.slug === preset ? "selected" : ""}>${c.title}</option>`
      )
      .join("");
  } catch (err) {
    status.textContent = err.message || "Could not load categories";
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "Posting…";
    try {
      const result = await api("/api/threads", {
        method: "POST",
        body: JSON.stringify({
          categorySlug: select.value,
          title: document.getElementById("thread-title-input").value.trim(),
          body: document.getElementById("thread-body").value.trim(),
        }),
      });
      window.location.href = `/forum/thread.html?id=${encodeURIComponent(result.id)}`;
    } catch (err) {
      status.textContent = err.message || "Could not create thread";
    }
  });
}

main();
