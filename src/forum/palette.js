import { api } from "./api.js";

let lastFocus = null;

function commandsFromCats(cats, user) {
  const base = [
    { id: "home", label: "Home", href: "/", group: "Site" },
    { id: "join", label: "Join server", href: "/#join", group: "Site" },
    { id: "rules", label: "Server rules", href: "/#rules", group: "Site" },
    { id: "forum", label: "Forum", href: "/forum/", group: "Site" },
    {
      id: "modpacks",
      label: "Other modpacks",
      href: "/#modpacks",
      group: "Also",
    },
    { id: "privacy", label: "Privacy", href: "/privacy-policy.html", group: "Site" },
    { id: "data", label: "Data policy", href: "/data-policy.html", group: "Site" },
  ];
  if (user) {
    base.push({
      id: "profile",
      label: "Your profile",
      href: "/forum/profile.html",
      group: "Site",
    });
  }
  for (const c of cats || []) {
    base.push({
      id: `cat-${c.slug}`,
      label: c.title,
      href: `/forum/category.html?c=${encodeURIComponent(c.slug)}`,
      group: "Forum",
      keywords: [c.slug, c.description || ""],
    });
  }
  return base;
}

function renderList(items, active) {
  const list = document.getElementById("cmdk-list");
  const empty = document.getElementById("cmdk-empty");
  if (!list) return;
  if (!items.length) {
    list.innerHTML = "";
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  list.innerHTML = items
    .map(
      (item, i) => `
    <li>
      <button type="button" class="cmdk-item${i === active ? " is-active" : ""}"
        id="cmdk-opt-${i}" role="option" aria-selected="${i === active}"
        data-href="${item.href}">
        <span>${item.label}</span>
        <span class="cmdk-item-hint">${item.group}</span>
      </button>
    </li>`
    )
    .join("");
}

function ensureCmdTrigger() {
  if (document.querySelector("[data-open-cmdk]")) return;
  const bar = document.querySelector(".topbar");
  if (!bar) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cmd-trigger";
  btn.setAttribute("data-open-cmdk", "");
  btn.setAttribute("aria-haspopup", "dialog");
  btn.innerHTML = `<span class="cmd-trigger-label">Search</span><kbd class="cmd-kbd">Ctrl K</kbd>`;
  const after = bar.querySelector("#auth-slot") || bar.querySelector(".btn-sm");
  bar.insertBefore(btn, after);
}

export async function mountCommandPalette(user) {
  ensureCmdTrigger();
  if (document.getElementById("cmdk")) return;
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="cmdk" id="cmdk" hidden>
      <div class="cmdk-backdrop" data-cmdk-dismiss tabindex="-1"></div>
      <div class="cmdk-dialog panel" role="dialog" aria-modal="true" aria-labelledby="cmdk-title">
        <h2 id="cmdk-title" class="sr-only">Command palette</h2>
        <input class="cmdk-input" id="cmdk-input" type="search" autocomplete="off"
          placeholder="Go to…" aria-controls="cmdk-list">
        <ul class="cmdk-list" id="cmdk-list" role="listbox"></ul>
        <p class="cmdk-empty forum-muted" id="cmdk-empty" hidden>No matches</p>
      </div>
    </div>`;
  document.body.appendChild(wrap.firstElementChild);

  let cats = [];
  try {
    const data = await api("/api/categories");
    cats = data.categories || [];
  } catch {
    cats = [];
  }
  const all = commandsFromCats(cats, user);
  let filtered = all;
  let active = 0;

  function open() {
    lastFocus = document.activeElement;
    document.getElementById("cmdk").hidden = false;
    const input = document.getElementById("cmdk-input");
    input.value = "";
    filtered = all;
    active = 0;
    renderList(filtered, active);
    input.focus();
  }

  function close() {
    document.getElementById("cmdk").hidden = true;
    lastFocus?.focus?.();
  }

  function run(i) {
    const item = filtered[i];
    if (!item) return;
    close();
    window.location.href = item.href;
  }

  document.getElementById("cmdk").addEventListener("click", (e) => {
    if (e.target.closest("[data-cmdk-dismiss]")) close();
    const btn = e.target.closest(".cmdk-item");
    if (btn) {
      const href = btn.getAttribute("data-href");
      close();
      window.location.href = href;
    }
  });

  document.getElementById("cmdk-input").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    filtered = all.filter((c) => {
      const blob = `${c.label} ${c.keywords?.join(" ") || ""}`.toLowerCase();
      return !q || blob.includes(q);
    });
    active = 0;
    renderList(filtered, active);
  });

  document.getElementById("cmdk-input").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      active = Math.min(filtered.length - 1, active + 1);
      renderList(filtered, active);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = Math.max(0, active - 1);
      renderList(filtered, active);
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });

  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const openNow = !document.getElementById("cmdk").hidden;
      if (openNow) close();
      else open();
    } else if (e.key === "Escape" && !document.getElementById("cmdk").hidden) {
      close();
    }
  });

  document.querySelectorAll("[data-open-cmdk]").forEach((el) => {
    el.addEventListener("click", open);
  });
}
