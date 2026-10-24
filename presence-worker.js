/**
 * Blackhole Presence — Cloudflare Worker (no KV binding required)
 *
 * Uses the Cache API so counts work across requests without setup.
 *
 * Deploy: paste into a Worker → Save & Deploy
 * URL example: https://presence.weswoodland13.workers.dev
 *
 *   POST /ping   body: {"id":"bh_xxx"}
 *   GET  /count  → {"count": N}
 */
const STALE_MS = 120000; // 2 min
const CACHE_KEY = "https://bh-presence.internal/state";

async function readState(cache) {
  try {
    const res = await cache.match(CACHE_KEY);
    if (!res) return {};
    return await res.json();
  } catch (_) {
    return {};
  }
}

async function writeState(cache, state) {
  const body = JSON.stringify(state);
  await cache.put(
    CACHE_KEY,
    new Response(body, {
      headers: {
        "content-type": "application/json",
        "cache-control": "max-age=300"
      }
    })
  );
}

function prune(state, now) {
  const out = {};
  for (const [id, t] of Object.entries(state)) {
    if (typeof t === "number" && now - t < STALE_MS) out[id] = t;
  }
  return out;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Cache-Control": "no-store"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const cache = caches.default;
    const now = Date.now();

    if (url.pathname === "/ping" && request.method === "POST") {
      let id = "anon_" + Math.random().toString(36).slice(2, 10);
      try {
        const body = await request.json();
        if (body && typeof body.id === "string" && body.id.length > 2 && body.id.length < 80) {
          id = body.id;
        }
      } catch (_) {}

      let state = await readState(cache);
      state = prune(state, now);
      state[id] = now;
      await writeState(cache, state);

      return new Response(JSON.stringify({ ok: true, count: Object.keys(state).length }), {
        headers: { ...cors, "content-type": "application/json" }
      });
    }

    if (url.pathname === "/count" && request.method === "GET") {
      let state = await readState(cache);
      state = prune(state, now);
      await writeState(cache, state);
      const count = Object.keys(state).length;
      return new Response(JSON.stringify({ count }), {
        headers: { ...cors, "content-type": "application/json" }
      });
    }

    return new Response("Blackhole Presence\nPOST /ping  GET /count", {
      headers: { ...cors, "content-type": "text/plain" }
    });
  }
};
