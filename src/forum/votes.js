import { api } from "./api.js";

export async function applyVote(type, id, nextValue) {
  return api(`/api/votes/${type}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ value: nextValue }),
  });
}

export function nextVote(current, clicked) {
  return current === clicked ? 0 : clicked;
}

export function paintVote(root, { score, myVote }) {
  const scoreEl = root.querySelector(".vote-score");
  const up = root.querySelector(".vote-up");
  const down = root.querySelector(".vote-down");
  if (scoreEl) {
    scoreEl.textContent = String(score);
    scoreEl.classList.add("is-pulse");
    setTimeout(() => scoreEl.classList.remove("is-pulse"), 180);
  }
  up?.classList.toggle("is-on", myVote === 1);
  down?.classList.toggle("is-on", myVote === -1);
  up?.setAttribute("aria-pressed", String(myVote === 1));
  down?.setAttribute("aria-pressed", String(myVote === -1));
}
