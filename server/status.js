let cache = { at: 0, data: null };
const TTL_MS = 15000;

export async function fetchServerStatus(host) {
  const now = Date.now();
  if (cache.data && now - cache.at < TTL_MS) return cache.data;

  const target = encodeURIComponent(host || "mc-direct.citadel-codex.com");
  const fallback = {
    online: false,
    players: { online: 0, max: 0 },
    version: "",
  };

  try {
    const res = await fetch(`https://api.mcsrvstat.us/3/${target}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      cache = { at: now, data: fallback };
      return fallback;
    }
    const json = await res.json();
    const data = {
      online: Boolean(json.online),
      players: {
        online: Number(json.players?.online || 0),
        max: Number(json.players?.max || 0),
      },
      version: String(json.version || json.protocol?.name || ""),
    };
    cache = { at: now, data };
    return data;
  } catch {
    cache = { at: now, data: fallback };
    return fallback;
  }
}
