import { api } from "../api.js";
import { mountAuthSlot } from "../auth-ui.js";
import { mountCommandPalette } from "../palette.js";
import { mcHeadsUrl } from "../mc-identity.js";

async function main() {
  const me = await mountAuthSlot();
  await mountCommandPalette(me);
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
    document.getElementById("user-username").textContent = u.username ? `@${u.username}` : "—";
    document.title = `${u.displayName} — USC Minecraft Forum`;
    document.getElementById("user-banner").style.background = u.bannerColor || "#2d641c";
    const img = document.getElementById("user-avatar");
    const src = mcHeadsUrl({ uuid: u.mcUuid, name: u.mcUsername, size: 80 });
    if (src) {
      img.src = src;
      img.alt = `${u.mcUsername || u.displayName} Minecraft skin`;
    } else {
      img.hidden = true;
    }
    if (u.mcUsername || u.mcUuid) {
      document.getElementById("user-mc-row").hidden = false;
      document.getElementById("user-mc").textContent = [u.mcUsername, u.mcUuid]
        .filter(Boolean)
        .join(" · ");
    }
    if (u.email) {
      document.getElementById("user-email-row").hidden = false;
      document.getElementById("user-email").textContent = u.email;
    }
  } catch (err) {
    status.textContent = err.message || "User not found";
  }
}

main();
