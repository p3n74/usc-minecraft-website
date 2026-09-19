import { api } from "../api.js";
import { mountAuthSlot } from "../auth-ui.js";

async function main() {
  await mountAuthSlot();
  const status = document.getElementById("forum-status");
  const username = new URLSearchParams(window.location.search).get("u") || "";
  if (!username) {
    status.textContent = "Missing username.";
    return;
  }

  try {
    const data = await api(`/api/users/${encodeURIComponent(username)}`);
    const u = data.user;
    document.getElementById("user-card").hidden = false;
    document.getElementById("user-title").textContent = u.displayName;
    document.getElementById("user-display").textContent = u.displayName;
    document.getElementById("user-username").textContent = u.username || "—";
    document.title = `${u.displayName} — USC Minecraft Forum`;

    if (u.email) {
      document.getElementById("user-email-row").hidden = false;
      document.getElementById("user-email").textContent = u.email;
    }
  } catch (err) {
    status.textContent = err.message || "User not found";
  }
}

main();
