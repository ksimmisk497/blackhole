// Blackhole UV Service Worker — scope `/` so iframe navigations are intercepted
"use strict";

var _UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var _barePicked = false;

importScripts("/uv/uv.bundle.js");
importScripts("/uv/uv.config.js");
importScripts("/uv/uv.sw.js");

var sw = new UVServiceWorker();

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
          return Promise.reject(new Error("bad"));
        });
      })
    );
    if (winner && self.__uv$config) {
      self.__uv$config.bare = winner;
      try {
        if (sw) sw.address = winner;
      } catch (e) {}
    }
  } catch (e) {
    if (self.__uv$config && list[0]) self.__uv$config.bare = list[0];
  }
}

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

self.addEventListener("install", function (e) {
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
    if (e.data && (e.data.type === "DIZZY_UA" || e.data.type === "BH_UA") && e.data.ua) {
      _UA = e.data.ua;
    }
  } catch (err) {}
});

self.addEventListener("fetch", function (e) {
  var prefix = (self.__uv$config && self.__uv$config.prefix) || "/service/";
  var url = e.request.url;

  // Only handle proxied paths — let normal site assets pass through
  if (url.indexOf(prefix) === -1) return;

  e.respondWith(
    (async function () {
      if (!_barePicked) await pickBestBare();
      try {
        return await sw.fetch(e);
      } catch (err) {
        return new Response(
          "<!DOCTYPE html><html><head><meta charset=utf-8><title>Proxy error</title></head><body style='background:#0a0a0f;color:#ccc;font-family:sans-serif;padding:40px'>" +
            "<h2 style='color:#ff7a2f'>Proxy failed</h2>" +
            "<p>Could not load this site through the proxy.</p>" +
            "<pre style='color:#888;white-space:pre-wrap'>" +
            String(err && err.message ? err.message : err) +
            "</pre>" +
            "<p><a href='/' style='color:#ff7a2f'>Back to Blackhole</a></p>" +
            "</body></html>",
          {
            status: 502,
            headers: { "content-type": "text/html; charset=utf-8" }
          }
        );
      }
    })()
  );
});
