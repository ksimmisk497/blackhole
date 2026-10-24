"use strict";
/**
 * Blackhole live presence — glowing online-users indicator.
 *
 * Configure (optional):
 *   window.BH_PRESENCE_URL = "https://your-worker.workers.dev";
 * If unset, uses local demo mode (same-browser tabs only via BroadcastChannel).
 */
(function () {
  var PING_MS = 45000;
  var FETCH_MS = 20000;
  var STALE_MS = 120000;
  var STORAGE_KEY = "bh_presence_id_v1";
  var DEMO_KEY = "bh_presence_demo_v1";

  var endpoint = (typeof window !== "undefined" && window.BH_PRESENCE_URL) || "https://presence.weswoodland13.workers.dev";
  var id = null;
  var countEl = null;
  var wrapEl = null;
  var lastCount = null;
  var bc = null;

  function uid() {
    try {
      var existing = localStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
      var n = "bh_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEY, n);
      return n;
    } catch (e) {
      return "bh_" + Math.random().toString(36).slice(2);
    }
  }

  function setCount(n) {
    if (!countEl) return;
    var v = typeof n === "number" && n >= 0 ? n : null;
    if (v === lastCount) return;
    lastCount = v;
    countEl.textContent = v === null ? "—" : String(v);
    if (wrapEl) {
      wrapEl.setAttribute("data-count", v === null ? "unknown" : String(v));
      wrapEl.classList.toggle("bh-online-pulse", v !== null && v > 0);
    }
  }

  // ── Demo mode: count open Blackhole tabs in this browser via BroadcastChannel ──
  function demoInit() {
    var tabs = {};
    try {
      tabs = JSON.parse(sessionStorage.getItem(DEMO_KEY) || "{}");
    } catch (e) {}
    tabs[id] = Date.now();
    try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(tabs)); } catch (e) {}

    function pruneAndCount() {
      var now = Date.now();
      var map = {};
      try { map = JSON.parse(sessionStorage.getItem(DEMO_KEY) || "{}"); } catch (e) {}
      map[id] = now;
      var alive = 0;
      Object.keys(map).forEach(function (k) {
        if (now - map[k] < STALE_MS) alive++;
        else delete map[k];
      });
      try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(map)); } catch (e) {}
      setCount(Math.max(1, alive));
      if (bc) {
        try { bc.postMessage({ type: "ping", id: id, t: now }); } catch (e) {}
      }
    }

    try {
      bc = new BroadcastChannel("bh_presence");
      bc.onmessage = function (ev) {
        if (!ev.data || ev.data.type !== "ping") return;
        var map = {};
        try { map = JSON.parse(sessionStorage.getItem(DEMO_KEY) || "{}"); } catch (e) {}
        map[ev.data.id] = ev.data.t || Date.now();
        map[id] = Date.now();
        try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(map)); } catch (e) {}
        var now = Date.now();
        var alive = 0;
        Object.keys(map).forEach(function (k) {
          if (now - map[k] < STALE_MS) alive++;
        });
        setCount(Math.max(1, alive));
      };
    } catch (e) {}

    pruneAndCount();
    setInterval(pruneAndCount, 8000);
  }

  // ── Real mode: hit a Worker endpoint ──
  async function realPing() {
    if (!endpoint) return;
    try {
      await fetch(endpoint.replace(/\/$/, "") + "/ping", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: id }),
        mode: "cors",
        cache: "no-store",
        keepalive: true
      });
    } catch (e) {}
  }

  async function realFetch() {
    if (!endpoint) return;
    try {
      var r = await fetch(endpoint.replace(/\/$/, "") + "/count", {
        method: "GET",
        mode: "cors",
        cache: "no-store"
      });
      if (!r.ok) return;
      var data = await r.json();
      if (typeof data.count === "number") setCount(data.count);
    } catch (e) {}
  }

  function mount() {
    wrapEl = document.getElementById("bh-online");
    countEl = document.getElementById("bh-online-count");
    if (!wrapEl || !countEl) return;

    id = uid();
    setCount(null);

    if (endpoint) {
      realPing();
      realFetch();
      setInterval(realPing, PING_MS);
      setInterval(realFetch, FETCH_MS);
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") {
          realPing();
          realFetch();
        }
      });
    } else {
      demoInit();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  window.BlackholePresence = {
    setEndpoint: function (url) {
      endpoint = url || "";
      window.BH_PRESENCE_URL = endpoint;
      if (endpoint) {
        realPing();
        realFetch();
      }
    },
    getId: function () { return id; }
  };
})();
