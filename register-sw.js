"use strict";
var __bhSWReady = null;

async function registerSW() {
  if (location.protocol === "file:" || location.origin === "null") {
    throw new Error("Open via HTTPS, not a local file.");
  }
  if (!navigator.serviceWorker) return;

  // Wait for UV config (bundle + config scripts)
  if (typeof __uv$config === "undefined") {
    await new Promise(function (resolve) {
      var n = 0;
      var iv = setInterval(function () {
        n++;
        if (typeof __uv$config !== "undefined" || n > 80) {
          clearInterval(iv);
          resolve();
        }
      }, 50);
    });
  }
  if (typeof __uv$config === "undefined") return;
  if (__bhSWReady) return __bhSWReady;

  __bhSWReady = (async function () {
    // Scope `/` so the parent page is controlled and iframe /service/* fetches are intercepted
    var scope = "/";
    var swUrl = new URL("/uv.js", location.href).href + "?v=" + (Date.now() >> 8);
    var reg;

    try {
      reg = await navigator.serviceWorker.register(swUrl, {
        scope: scope,
        updateViaCache: "none"
      });
    } catch (err) {
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function (r) { return r.unregister(); }));
      reg = await navigator.serviceWorker.register(swUrl, {
        scope: scope,
        updateViaCache: "none"
      });
    }

    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    // Wait until active
    if (!reg.active) {
      await Promise.race([
        new Promise(function (resolve) {
          var s = reg.installing || reg.waiting;
          if (!s) return resolve();
          s.addEventListener("statechange", function () {
            if (s.state === "activated" || s.state === "redundant") resolve();
          });
        }),
        new Promise(function (r) { setTimeout(r, 1500); })
      ]);
    }

    // Wait for this page to be controlled (critical for first proxy load)
    if (!navigator.serviceWorker.controller) {
      await Promise.race([
        new Promise(function (resolve) {
          navigator.serviceWorker.addEventListener("controllerchange", function () {
            resolve();
          }, { once: true });
        }),
        new Promise(function (r) { setTimeout(r, 1200); })
      ]);
    }

    try { reg.update(); } catch (e) {}
  })();

  try {
    await __bhSWReady;
  } catch (e) {
    __bhSWReady = null;
    throw e;
  }
}
