import { api, googleLoginUrl } from "../api.js";
import { mountAuthSlot } from "../auth-ui.js";
import { mountCommandPalette } from "../palette.js";
import { mcHeadsUrl } from "../mc-identity.js";

function syncPreview(user) {
  const name = document.getElementById("profile-username")?.value || user.username;
  const mcName = document.getElementById("profile-mc-name")?.value || user.mcUsername;
  const mcUuid = document.getElementById("profile-mc-uuid")?.value || user.mcUuid;
  const color = document.getElementById("profile-banner-color")?.value || user.bannerColor || "#2d641c";
  document.getElementById("profile-preview-name").textContent = user.displayName || name || "Player";
  document.getElementById("profile-preview-handle").textContent = name ? `@${name}` : "";
  document.getElementById("profile-banner").style.background = color;
  const img = document.getElementById("profile-avatar");
  const src = mcHeadsUrl({ uuid: mcUuid, name: mcName, size: 80 });
  if (src) {
    img.src = src;
    img.alt = `${mcName || "Minecraft"} skin`;
    img.hidden = false;
  } else {
    img.removeAttribute("src");
    img.alt = "";
    img.hidden = true;
  }
}

async function main() {
  const user = await mountAuthSlot();
  await mountCommandPalette(user);
  const status = document.getElementById("forum-status");
  const form = document.getElementById("profile-form");

  if (!user) {
    status.innerHTML = `Sign in required. <a href="${googleLoginUrl()}">Sign in with Google</a>`;
    return;
  }
  if (!user.profileCompleted) {
    window.location.href = "/forum/setup.html";
    return;
  }

  form.hidden = false;
  document.getElementById("profile-email").textContent = user.email;
  document.getElementById("profile-google-name").textContent =
    user.googleDisplayName || "(none)";
  document.getElementById("profile-username").value = user.username || "";
  document.getElementById("hide-google-name").checked = Boolean(user.hideGoogleName);
  document.getElementById("email-public").checked = Boolean(user.emailPublic);
  document.getElementById("profile-mc-name").value = user.mcUsername || "";
  document.getElementById("profile-mc-uuid").value = user.mcUuid || "";
  document.getElementById("profile-banner-color").value = user.bannerColor || "#2d641c";
  document.getElementById("profile-discord").value = user.discordHandle || "";
  syncPreview(user);

  form.addEventListener("input", () => syncPreview(user));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "Saving…";
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          username: document.getElementById("profile-username").value.trim(),
          hideGoogleName: document.getElementById("hide-google-name").checked,
          emailPublic: document.getElementById("email-public").checked,
          mcUsername: document.getElementById("profile-mc-name").value.trim(),
          mcUuid: document.getElementById("profile-mc-uuid").value.trim(),
          bannerColor: document.getElementById("profile-banner-color").value,
          discordHandle: document.getElementById("profile-discord").value.trim(),
        }),
      });
      status.textContent = "Saved.";
    } catch (err) {
      status.textContent = err.message || "Could not save";
    }
  });
}

main();
