import { mountCommandPalette } from "./forum/palette.js";

const DEFAULTS = {
  server: "mc-direct.citadel-codex.com",
  bedrock: "bedrock.citadel-codex.com",
};

function readConfig() {
  const runtime = typeof window !== "undefined" ? window.__USC_CONFIG__ : null;
  return {
    server:
      (runtime && (runtime.server || runtime.java)) ||
      import.meta.env.VITE_JAVA_ADDRESS ||
      DEFAULTS.server,
    bedrock:
      (runtime && runtime.bedrock) ||
      import.meta.env.VITE_BEDROCK_ADDRESS ||
      DEFAULTS.bedrock,
  };
}

function fillAddresses() {
  const { server, bedrock } = readConfig();
  const javaEl = document.getElementById("server-address");
  const bedrockEl = document.getElementById("bedrock-address");
  if (javaEl) javaEl.textContent = String(server).trim() || DEFAULTS.server;
  if (bedrockEl)
    bedrockEl.textContent = String(bedrock).trim() || DEFAULTS.bedrock;
}

function showUnlocked() {
  const gate = document.getElementById("consent-gate");
  const unlocked = document.getElementById("join-unlocked");
  if (gate) gate.hidden = true;
  if (unlocked) unlocked.hidden = false;
  fillAddresses();
}

function initConsent() {
  const gate = document.getElementById("consent-gate");
  if (!gate) {
    fillAddresses();
    return;
  }

  try {
    localStorage.removeItem("usc_policy_consent_v1");
  } catch {
    /* ignore */
  }

  const check = document.getElementById("consent-check");
  const button = document.getElementById("consent-agree");
  const unlocked = document.getElementById("join-unlocked");
  if (unlocked) unlocked.hidden = true;
  gate.hidden = false;
  if (check) {
    check.checked = false;
  }
  if (button) {
    button.disabled = true;
  }
  if (!check || !button) return;

  check.addEventListener("change", () => {
    button.disabled = !check.checked;
  });

  button.addEventListener("click", () => {
    if (!check.checked) return;
    showUnlocked();
    showToast("Policies accepted");
  });
}

const toast = document.getElementById("toast");
let toastTimer;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 220);
  }, 1800);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
}

async function copyJoinAddress({ kind = "java", reveal = false } = {}) {
  const { server, bedrock } = readConfig();
  const text = kind === "bedrock" ? bedrock : server;
  await copyText(String(text).trim());
  const unlocked = document.getElementById("join-unlocked");
  if (reveal && unlocked && !unlocked.hidden) {
    showToast("Address copied");
  } else {
    showToast("Copied. Agree below to see it.");
  }
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    const targetId = button.getAttribute("data-copy");
    const source = targetId ? document.getElementById(targetId) : null;
    const text = source?.textContent?.trim();
    if (!text || text === "loading…") return;

    const label = button.getAttribute("data-label") || "Copy";
    try {
      await copyText(text);
      button.classList.add("is-copied");
      button.textContent = "Copied!";
      showToast("Address copied");
      setTimeout(() => {
        button.classList.remove("is-copied");
        button.textContent = label;
      }, 1600);
    } catch {
      showToast("Could not copy");
    }
  });
});

document.getElementById("hero-copy")?.addEventListener("click", async () => {
  const btn = document.getElementById("hero-copy");
  try {
    await copyJoinAddress({ kind: "java", reveal: false });
    btn.classList.add("is-copied");
    const prev = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => {
      btn.classList.remove("is-copied");
      btn.textContent = prev;
    }, 1600);
  } catch {
    showToast("Could not copy");
  }
});

async function initStatusChip() {
  const chip = document.getElementById("status-chip");
  if (!chip) return;
  const dot = document.getElementById("status-dot");
  const players = document.getElementById("status-players");
  const version = document.getElementById("status-version");

  async function refresh() {
    try {
      const res = await fetch("/api/status", { credentials: "include" });
      if (!res.ok) throw new Error("status");
      const data = await res.json();
      dot.className = `status-dot ${data.online ? "is-online" : "is-offline"}`;
      players.textContent = data.online
        ? `${data.players?.online ?? 0} / ${data.players?.max ?? 0} online`
        : "World offline";
      version.textContent = data.version || "";
    } catch {
      dot.className = "status-dot is-unknown";
      players.textContent = "Status unavailable";
      version.textContent = "";
    }
  }

  refresh();
  setInterval(refresh, 30000);
}

function initReveal() {
  const nodes = document.querySelectorAll(".reveal");
  if (!nodes.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    nodes.forEach((n) => n.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12 }
  );
  nodes.forEach((n) => io.observe(n));
}

initConsent();
initStatusChip();
initReveal();
mountCommandPalette();
