import { api, googleLoginUrl } from "../api.js";
import { mountAuthSlot } from "../auth-ui.js";

async function main() {
  const user = await mountAuthSlot();
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
        }),
      });
      status.textContent = "Saved.";
    } catch (err) {
      status.textContent = err.message || "Could not save";
    }
  });
}

main();
