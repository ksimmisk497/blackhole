"use strict";
var __dizzySWReady = null;

async function registerSW() {
  if (location.protocol === "file:" || location.origin === "null") {
    throw new Error("Open via HTTPS, not a local file.");
  }
  if (!navigator.serviceWorker) return;
  if (typeof __uv$config === "undefined") return;
  if (__dizzySWReady) return __dizzySWReady;

  __dizzySWReady = (async function () {
    // Scope = site base (e.g. / or /repo/) so navigations under /service/ are controlled
    var prefix = __uv$config.prefix || "/service/";
    var scope = prefix.replace(/service\/?$/, "") || "/";
    if (!scope.endsWith("/")) scope += "/";

    var swUrl = new URL("uv.js", location.href).href + "?v=" + (Date.now() >> 8);
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
        new Promise(function (r) { setTimeout(r, 1500); })
      ]);
    }

    if (!navigator.serviceWorker.controller) {
      await Promise.race([
        new Promise(function (resolve) {
          navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
        }),
        new Promise(function (r) { setTimeout(r, 1000); })
      ]);
    }

    try { reg.update(); } catch (e) {}
  })();

  try {
    await __dizzySWReady;
  } catch (e) {
    __dizzySWReady = null;
    throw e;
  }
}
