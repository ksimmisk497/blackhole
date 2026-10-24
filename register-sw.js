"use strict";
var __bhSWReady = null;

function bhBase() {
  // Directory of the current page, ending with /
  try {
    var path = location.pathname || "/";
    if (/\.html?$/i.test(path)) {
      path = path.replace(/\/[^/]+$/, "/");
    } else if (!path.endsWith("/")) {
      path = path + "/";
    }
    // Prefer path of uv.config.js if present
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute("src") || "";
      var m = src.match(/^(.*\/)uv\/uv\.config\.js/i);
      if (m) {
        // m[1] is like "uv/" or "/repo/uv/" or "./uv/"
        var full = scripts[i].src;
        var u = new URL(full);
        var dir = u.pathname.replace(/\/uv\/uv\.config\.js$/i, "/");
        return dir;
      }
    }
    return path;
  } catch (e) {
    return "/";
  }
}

async function registerSW() {
  if (location.protocol === "file:" || location.origin === "null") {
    throw new Error("Open via HTTPS, not a local file.");
  }
  if (!navigator.serviceWorker) return;

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
    var base = (__uv$config && __uv$config.base) || bhBase();
    if (!base.endsWith("/")) base += "/";

    // Scope must cover the whole site so iframe /service/ fetches are intercepted
    var scope = base;
    var swUrl = base + "uv.js?v=" + (Date.now() >> 8);
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

    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });

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
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            resolve,
            { once: true }
          );
        }),
        new Promise(function (r) { setTimeout(r, 1000); })
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
