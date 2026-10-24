"use strict";
(function () {
  var READ_KEY = "blackhole_notify_read_v1";
  var FEED_URLS = [
    "notifications.json",
    "./notifications.json",
    "/notifications.json"
  ];
  var feed = [];

  function loadRead() {
    try { return JSON.parse(localStorage.getItem(READ_KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function saveRead(map) {
    try { localStorage.setItem(READ_KEY, JSON.stringify(map || {})); } catch (e) {}
  }
  function normalize(m, i) {
    if (!m || typeof m !== "object") return null;
    return {
      id: m.id || ("n_" + i + "_" + String(m.title || m.Title || "").slice(0, 40)),
      title: m.title || m.Title || "",
      body: m.body || m.Body || m.text || m.Text || m.message || "",
      from: m.from || m.From || m.author || "Wes"
    };
  }
  function unreadCount() {
    var read = loadRead();
    return feed.filter(function (m) { return !read[m.id]; }).length;
  }
  function markAllRead() {
    var read = loadRead();
    feed.forEach(function (m) { read[m.id] = true; });
    saveRead(read);
    updateDot();
  }
  function updateDot() {
    var n = unreadCount();
    document.querySelectorAll(".bh-notify-dot").forEach(function (el) {
      if (n > 0) {
        el.hidden = false;
        el.style.display = "block";
        el.textContent = n > 9 ? "9+" : String(n);
      } else {
        el.hidden = true;
        el.style.display = "none";
      }
    });
  }

  function ensureStyles() {
    if (document.getElementById("bh-notify-styles")) return;
    var style = document.createElement("style");
    style.id = "bh-notify-styles";
    style.textContent = [
      ".bh-dock .bh-dock-sep{width:1px;height:22px;background:rgba(255,255,255,.18);margin:0 4px;flex-shrink:0}",
      ".bh-dock a.bh-notify-btn{position:relative}",
      ".bh-notify-dot{position:absolute;top:6px;right:6px;min-width:14px;height:14px;padding:0 3px;border-radius:999px;background:#e11d48;color:#fff;font-size:9px;font-weight:800;line-height:14px;text-align:center;display:none;box-shadow:0 0 0 2px #0c0c0e}",
      "#bh-notify-panel{position:fixed;left:50%;bottom:78px;transform:translateX(-50%);width:min(360px,92vw);max-height:min(440px,62vh);overflow:auto;z-index:300;background:rgba(12,12,14,.97);border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.55);backdrop-filter:blur(16px);display:none}",
      "#bh-notify-panel.open{display:block}",
      "#bh-notify-panel header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08)}",
      "#bh-notify-panel header strong{font-size:13px}",
      "#bh-notify-panel header button{background:transparent;border:0;color:#9a9a9a;cursor:pointer;font-size:12px;font-weight:700}",
      ".bh-n-item{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.06)}",
      ".bh-n-item.unread{background:rgba(255,122,47,.08)}",
      ".bh-n-from{font-size:11px;font-weight:800;color:#ffb347}",
      ".bh-n-title{font-size:13px;font-weight:700;color:#fff;margin-top:4px}",
      ".bh-n-msg{font-size:13px;color:#ccc;margin-top:4px;line-height:1.4;white-space:pre-wrap;word-break:break-word}",
      ".bh-n-empty{padding:28px 14px;text-align:center;color:#777;font-size:13px}"
    ].join("");
    document.head.appendChild(style);
  }

  function ensurePanel() {
    if (document.getElementById("bh-notify-panel")) return;
    ensureStyles();
    var panel = document.createElement("div");
    panel.id = "bh-notify-panel";
    panel.innerHTML =
      "<header><strong>Notifications</strong><button type='button' id='bh-n-clear'>Mark read</button></header>" +
      "<div id='bh-n-list'><div class='bh-n-empty'>Loading…</div></div>";
    document.body.appendChild(panel);
    document.getElementById("bh-n-clear").addEventListener("click", function () {
      markAllRead();
      renderPanel();
    });
    document.addEventListener("click", function (e) {
      var panel = document.getElementById("bh-notify-panel");
      if (e.target.closest && e.target.closest(".bh-notify-btn")) return;
      if (panel && !panel.contains(e.target)) panel.classList.remove("open");
    });
  }

  function renderPanel() {
    ensurePanel();
    var list = document.getElementById("bh-n-list");
    if (!list) return;
    var read = loadRead();
    if (!feed.length) {
      list.innerHTML = "<div class='bh-n-empty'>No notifications<br><span style='font-size:11px'>Check notifications.json is on the site</span></div>";
      return;
    }
    list.innerHTML = "";
    feed.forEach(function (m) {
      var div = document.createElement("div");
      div.className = "bh-n-item" + (read[m.id] ? "" : " unread");
      div.innerHTML = "<div class='bh-n-from'></div><div class='bh-n-title'></div><div class='bh-n-msg'></div>";
      div.querySelector(".bh-n-from").textContent = m.from;
      div.querySelector(".bh-n-title").textContent = m.title;
      div.querySelector(".bh-n-msg").textContent = m.body;
      list.appendChild(div);
    });
  }

  function togglePanel() {
    ensurePanel();
    var panel = document.getElementById("bh-notify-panel");
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      pull().then(function () {
        renderPanel();
        markAllRead();
        renderPanel();
      });
    }
  }

  async function pull() {
    var lastErr = null;
    for (var i = 0; i < FEED_URLS.length; i++) {
      try {
        var res = await fetch(FEED_URLS[i] + (FEED_URLS[i].indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now(), {
          cache: "no-store",
          credentials: "same-origin"
        });
        if (!res.ok) { lastErr = res.status; continue; }
        var data = await res.json();
        var raw = Array.isArray(data) ? data : (data.messages || data.notifications || []);
        feed = raw.map(normalize).filter(Boolean);
        updateDot();
        return feed;
      } catch (e) {
        lastErr = e;
      }
    }
    console.warn("[Blackhole] notifications.json failed", lastErr);
    return feed;
  }

  function wireBell() {
    ensureStyles();
    document.querySelectorAll(".bh-notify-btn").forEach(function (a) {
      if (a.dataset.wired) return;
      a.dataset.wired = "1";
      a.addEventListener("click", function (e) {
        e.preventDefault();
        togglePanel();
      });
    });
  }

  function boot() {
    wireBell();
    ensurePanel();
    pull().then(function () {
      updateDot();
    });
    setInterval(function () { pull().then(updateDot); }, 20000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
