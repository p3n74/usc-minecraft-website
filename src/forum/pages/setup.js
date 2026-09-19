import { api, googleLoginUrl } from "../api.js";
import { mountAuthSlot } from "../auth-ui.js";

async function main() {
  const params = new URLSearchParams(window.location.search);
  const status = document.getElementById("forum-status");
  if (params.get("error")) {
    status.textContent = "Sign-in failed. Please try again.";
  }

  // Don't redirect away from setup when incomplete
  const slot = document.getElementById("auth-slot");
  let user = null;
  try {
    const data = await api("/api/auth/me");
    user = data.user;
  } catch {
    user = null;
  }

  if (!user) {
    document.getElementById("setup-signin").hidden = false;
    document.getElementById("setup-google-link").href = googleLoginUrl("/forum/setup.html");
    if (slot) {
      slot.innerHTML = `<a class="btn btn-green btn-sm" href="${googleLoginUrl("/forum/setup.html")}">Sign in</a>`;
    }
    return;
  }

  if (user.profileCompleted) {
    window.location.href = "/forum/";
    return;
  }

  await mountAuthSlot();

  const form = document.getElementById("setup-form");
  form.hidden = false;
  document.getElementById("setup-email").textContent = user.email;
  document.getElementById("setup-google-name").textContent =
    user.googleDisplayName || "(none)";
  if (user.username) {
    document.getElementById("setup-username").value = user.username;
  }
  document.getElementById("hide-google-name").checked = Boolean(user.hideGoogleName);
  document.getElementById("email-public").checked = Boolean(user.emailPublic);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "Saving…";
    try {
      await api("/api/profile/setup", {
        method: "POST",
        body: JSON.stringify({
          username: document.getElementById("setup-username").value.trim(),
          hideGoogleName: document.getElementById("hide-google-name").checked,
          emailPublic: document.getElementById("email-public").checked,
        }),
      });
      window.location.href = "/forum/";
    } catch (err) {
      status.textContent = err.message || "Could not save profile";
    }
  });
}

main();
