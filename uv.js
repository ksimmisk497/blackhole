// Blackhole UV Service Worker — multi-bare failover + fast activate
"use strict";

var _bareIndex = 0;
var _UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function getBase() {
  var p = self.location.pathname.replace(/\/[^\/]*$/, "");
  return p;
}
var base = getBase();
function u(p) {
  if (p.charAt(0) === "/") return p;
  return base + "/" + p;
}

importScripts("/uv/uv.bundle.js");
importScripts("/uv/uv.config.js");
importScripts("/uv/uv.sw.js");

var sw = new UVServiceWorker();

// ── Bare server health probe — pick the fastest responding one ──────────────
var _barePicked = false;

async function pickBestBare() {
  if (_barePicked) return;
  _barePicked = true;
  var list = (self.__uv$config && self.__uv$config.bare) || [];
  if (!Array.isArray(list)) list = [list];
  if (!list.length) return;

  try {
    var winner = await Promise.any(
      list.map(function (url) {
        return fetch(url, {
          method: "OPTIONS",
          cache: "no-store",
          mode: "cors",
          signal: AbortSignal.timeout(2500)
        }).then(function (r) {
          if (r.ok || r.status < 500 || r.status === 204) return url;
          return Promise.reject();
        });
      })
    );
    if (winner && self.__uv$config) {
      self.__uv$config.bare = winner;
      // UVServiceWorker may have already bound an address — update if possible
      try {
        if (sw && sw.address) sw.address = winner;
        if (sw && sw.bareClient) {
          // recreate client against winner when API allows
        }
      } catch (e) {}
    }
  } catch (e) {
    // All failed — keep first bare
    if (self.__uv$config && list[0]) self.__uv$config.bare = list[0];
  }
}

// ── UA persistence ───────────────────────────────────────────────────────────
async function loadUA() {
  try {
    var c = await caches.open("bh-meta");
    var r = await c.match("/__ua__");
    if (r) {
      var t = await r.text();
      if (t) _UA = t;
    }
  } catch (e) {}
}
async function storeUA(ua) {
  _UA = ua;
  try {
    var c = await caches.open("bh-meta");
    await c.put("/__ua__", new Response(ua, { headers: { "content-type": "text/plain" } }));
  } catch (e) {}
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
self.addEventListener("install", function () {
  self.skipWaiting();
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      loadUA(),
      pickBestBare(),
      caches.keys().then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k !== "bh-meta";
            })
            .map(function (k) {
              return caches.delete(k);
            })
        );
      })
    ])
  );
});

self.addEventListener("message", function (e) {
  try {
    if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
    if (e.data && e.data.type === "DIZZY_UA" && e.data.ua) storeUA(e.data.ua);
    if (e.data && e.data.type === "BH_UA" && e.data.ua) storeUA(e.data.ua);
  } catch (err) {}
});

// Inject a modern UA on outbound proxy fetches when possible
var _origFetch = self.fetch.bind(self);
self.fetch = function (input, init) {
  try {
    if (_UA && init && init.headers) {
      var h = init.headers;
      if (h instanceof Headers) {
        if (!h.has("user-agent")) h.set("user-agent", _UA);
      } else if (typeof h === "object") {
        if (!h["user-agent"] && !h["User-Agent"]) h["user-agent"] = _UA;
      }
    }
  } catch (e) {}
  return _origFetch(input, init);
};

// ── Route proxied traffic through UV ─────────────────────────────────────────
self.addEventListener("fetch", function (e) {
  var prefix = (self.__uv$config && self.__uv$config.prefix) || "/service/";
  if (e.request.url.indexOf(prefix) === -1) return;

  e.respondWith(
    (async function () {
      if (!_barePicked) await pickBestBare();
      return sw.fetch(e);
    })()
  );
});
