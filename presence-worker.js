/**
 * Blackhole Presence — Cloudflare Worker
 *
 * Deploy: Cloudflare Dashboard → Workers → Create → paste this file.
 * Then set window.BH_PRESENCE_URL = "https://YOUR_WORKER.workers.dev" in Blackhole
 * (or add a one-line script before presence.js).
 *
 * Endpoints:
 *   POST /ping   body: {"id":"bh_xxx"}   → registers presence
 *   GET  /count  → {"count": N}
 */
const STALE_MS = 120000; // 2 minutes

export default {
  async fetch(request, env) {
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

    // Prefer Durable Object if bound as PRESENCE; else fall back to KV "presence"
    const store = env.PRESENCE_KV || env.presence;

    if (url.pathname === "/ping" && request.method === "POST") {
      let id = "anon";
      try {
        const body = await request.json();
        if (body && typeof body.id === "string" && body.id.length < 80) id = body.id;
      } catch (_) {}

      const now = Date.now();
      if (store && store.put) {
        // KV: key = id, value = timestamp
        await store.put(id, String(now), { expirationTtl: Math.ceil(STALE_MS / 1000) + 30 });
      } else {
        // In-memory fallback (single isolate — good enough for low traffic)
        globalThis.__bh = globalThis.__bh || new Map();
        globalThis.__bh.set(id, now);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cors, "content-type": "application/json" }
      });
    }

    if (url.pathname === "/count" && request.method === "GET") {
      let count = 0;
      const now = Date.now();

      if (store && store.list) {
        const listed = await store.list({ limit: 1000 });
        for (const k of listed.keys) {
          const v = await store.get(k.name);
          const t = parseInt(v, 10);
          if (t && now - t < STALE_MS) count++;
        }
      } else if (globalThis.__bh) {
        for (const [id, t] of globalThis.__bh) {
          if (now - t < STALE_MS) count++;
          else globalThis.__bh.delete(id);
        }
      }

      return new Response(JSON.stringify({ count }), {
        headers: { ...cors, "content-type": "application/json" }
      });
    }

    return new Response("Blackhole Presence\nPOST /ping  GET /count", {
      headers: { ...cors, "content-type": "text/plain" }
    });
  }
};
