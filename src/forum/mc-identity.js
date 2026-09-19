export function mcHeadsUrl({ uuid, name, size = 80 }) {
  const hex = uuid ? String(uuid).replace(/-/g, "") : "";
  if (/^[0-9a-fA-F]{32}$/.test(hex)) {
    return `https://mc-heads.net/avatar/${hex}/${size}`;
  }
  if (name) {
    return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/${size}`;
  }
  return "";
}

export function normalizeUuid(s) {
  const hex = String(s || "").replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return "";
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
