"use strict";
var __bhSWReady = null;

async function registerSW() {
  if (location.protocol === "file:" || location.origin === "null") {
    throw new Error("Open via HTTPS, not a local file.");
  }
  if (!navigator.serviceWorker) return;
  if (typeof __uv$config === "undefined") {
    // Wait briefly for uv.config.js
    await new Promise(function (r) { setTimeout(r, 100); });
    if (typeof __uv$config === "undefined") return;
  }
  if (__bhSWReady) return __bhSWReady;

  __bhSWReady = (async function () {
    var scope = __uv$config.prefix || "/service/";
    // Register root uv.js under the UV prefix scope
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

    if (!reg.active) {
      await Promise.race([
        new Promise(function (resolve) {
          var s = reg.installing || reg.waiting;
          if (!s) return resolve();
          s.addEventListener("statechange", function () {
            if (s.state === "activated" || s.state === "redundant") resolve();
          });
        }),
        new Promise(function (r) { setTimeout(r, 800); })
      ]);
    }

    // Ensure controller is ready
    if (!navigator.serviceWorker.controller) {
      await Promise.race([
        new Promise(function (resolve) {
          navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
        }),
        new Promise(function (r) { setTimeout(r, 500); })
      ]);
    }

    reg.update().catch(function () {});
  })();

  try {
    await __bhSWReady;
  } catch (e) {
    __bhSWReady = null;
    throw e;
  }
}
