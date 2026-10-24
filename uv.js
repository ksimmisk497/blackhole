// Blackhole UV Service Worker — GitHub Pages compatible
"use strict";

var _barePicked = false;

// Base path from this SW's URL: /repo/uv.js -> /repo/
var _swPath = self.location.pathname || "/uv.js";
var _base = _swPath.replace(/\/[^/]*$/, "/");
if (!_base) _base = "/";

importScripts(_base + "uv/uv.bundle.js");

self.__uv$config = {
  prefix: _base + "service/",
  bare: [
    "https://wes-prox.ksimmisk497.workers.dev/",
    "https://tomp.app/"
  ],
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: _base + "uv/uv.handler.js",
  client: _base + "uv/uv.client.js",
  bundle: _base + "uv/uv.bundle.js",
  config: _base + "uv/uv.config.js",
  sw: _base + "uv/uv.sw.js",
  base: _base
};

importScripts(_base + "uv/uv.sw.js");

var sw = new UVServiceWorker(self.__uv$config);

async function pickBestBare() {
  if (_barePicked) return;
  _barePicked = true;
  var list = self.__uv$config.bare || [];
  if (!Array.isArray(list)) list = [list];
  try {
    var winner = await Promise.any(
      list.map(function (url) {
        return fetch(url, {
          method: "OPTIONS",
          cache: "no-store",
          mode: "cors",
          signal: AbortSignal.timeout(2500)
        }).then(function (r) {
          if (r.ok || r.status === 204 || r.status < 500) return url;
          return Promise.reject();
        });
      })
    );
    if (winner) {
      self.__uv$config.bare = winner;
      try {
        if (sw) sw.address = winner;
      } catch (e) {}
    }
  } catch (e) {
    if (list[0]) self.__uv$config.bare = list[0];
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
  } catch (err) {}
});

self.addEventListener("fetch", function (e) {
  var prefix = self.__uv$config.prefix;
  if (e.request.url.indexOf(prefix) === -1) return;

  e.respondWith(
    (async function () {
      if (!_barePicked) await pickBestBare();
      try {
        return await sw.fetch(e);
      } catch (err) {
        return new Response(
          "<!DOCTYPE html><html><body style='background:#0a0a0f;color:#ccc;font-family:sans-serif;padding:40px'>" +
            "<h2 style='color:#ff7a2f'>Proxy error</h2><p>" +
            String(err && err.message ? err.message : err) +
            "</p></body></html>",
          { status: 502, headers: { "content-type": "text/html;charset=utf-8" } }
        );
      }
    })()
  );
});
