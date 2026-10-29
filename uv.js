// Blackhole UV Service Worker — multi-bare failover
"use strict";

var _UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var _barePicked = false;

function getBase() {
  var p = self.location.pathname.replace(/\/[^\/]*$/, "");
  return p;
}
var base = getBase();
function u(p) {
  return base + p;
}

importScripts(u("/uv/uv.bundle.js"));
importScripts(u("/uv/uv.config.js"));
importScripts(u("/uv/uv.sw.js"));

var sw = new UVServiceWorker();

async function pickBestBare() {
  if (_barePicked) return;
  _barePicked = true;

  var list = (self.__uv$config && self.__uv$config.bareServers) || [
    "https://tomp.app/",
    "https://wes-prox.ksimmisk497.workers.dev/"
  ];
  if (!Array.isArray(list)) list = [list];

  async function probe(url) {
    // Try OPTIONS then GET — reject rate-limits (429) and hard failures
    try {
      var r = await fetch(url, {
        method: "OPTIONS",
        cache: "no-store",
        mode: "cors",
        signal: AbortSignal.timeout(2500)
      });
      if (r.status === 429) return Promise.reject(new Error("rate limit"));
      if (r.ok || r.status === 204 || r.status < 500) return url;
    } catch (e) {}
    try {
      var r2 = await fetch(url, {
        method: "GET",
        cache: "no-store",
        mode: "cors",
        signal: AbortSignal.timeout(2500)
      });
      if (r2.status === 429) return Promise.reject(new Error("rate limit"));
      if (r2.ok || r2.status === 204 || r2.status < 500) return url;
    } catch (e2) {}
    return Promise.reject(new Error("dead"));
  }

  try {
    var winner = await Promise.any(list.map(probe));
    if (winner && self.__uv$config) {
      self.__uv$config.bare = winner;
      try {
        if (sw) sw.address = winner;
        if (sw && sw.bareClient) {
          // UV 1.x BareClient is constructed with address — reassign when possible
          sw.address = winner;
        }
      } catch (e) {}
    }
  } catch (e) {
    if (self.__uv$config && list[0]) {
      self.__uv$config.bare = list[0];
      try { if (sw) sw.address = list[0]; } catch (err) {}
    }
  }
}

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      pickBestBare()
    ])
  );
});

self.addEventListener("message", function (e) {
  try {
    if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
    if (e.data && (e.data.type === "DIZZY_UA" || e.data.type === "BH_UA") && e.data.ua) {
      _UA = e.data.ua;
    }
  } catch (err) {}
});

self.addEventListener("fetch", function (e) {
  var prefix = (self.__uv$config && self.__uv$config.prefix) || "/service/";
  if (e.request.url.indexOf(prefix) === -1) return;

  e.respondWith(
    (async function () {
      if (!_barePicked) await pickBestBare();
      try {
        return await sw.fetch(e);
      } catch (err) {
        // On failure, try next bare once
        var list = (self.__uv$config && self.__uv$config.bareServers) || [];
        if (Array.isArray(list) && list.length > 1) {
          var cur = self.__uv$config.bare;
          var idx = list.indexOf(cur);
          var next = list[(idx + 1) % list.length];
          if (next && next !== cur) {
            self.__uv$config.bare = next;
            try { if (sw) sw.address = next; } catch (e2) {}
            try {
              return await sw.fetch(e);
            } catch (e3) {}
          }
        }
        return new Response(
          "<!DOCTYPE html><html><body style='background:#0a0a0f;color:#ccc;font-family:sans-serif;padding:40px'>" +
            "<h2 style='color:#ff7a2f'>Proxy error</h2><p>" +
            String(err && err.message ? err.message : err) +
            "</p><p style='color:#666'>Try refreshing or searching again.</p></body></html>",
          { status: 502, headers: { "content-type": "text/html;charset=utf-8" } }
        );
      }
    })()
  );
});
