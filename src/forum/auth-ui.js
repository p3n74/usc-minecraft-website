import { getMe, logout, googleLoginUrl } from "./api.js";

/**
 * Fill #auth-slot in the topbar with Sign in / user menu.
 */
export async function mountAuthSlot() {
  const slot = document.getElementById("auth-slot");
  if (!slot) return null;

  let user = null;
  try {
    const data = await getMe();
    user = data.user;
  } catch {
    user = null;
  }

  if (!user) {
    slot.innerHTML = `<a class="btn btn-green btn-sm" href="${googleLoginUrl()}">Sign in</a>`;
    return null;
  }

  if (!user.profileCompleted && !window.location.pathname.includes("setup")) {
    window.location.href = "/forum/setup.html";
    return user;
  }

  const label = user.displayName || user.username || "Account";
  slot.innerHTML = `
    <div class="auth-menu">
      <a class="auth-name" href="/forum/profile.html">${escapeAttr(label)}</a>
      <button type="button" class="btn btn-dark btn-sm" id="auth-logout">Sign out</button>
    </div>
  `;
  document.getElementById("auth-logout")?.addEventListener("click", async () => {
    await logout();
    window.location.href = "/forum/";
  });
  return user;
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

export { googleLoginUrl };
