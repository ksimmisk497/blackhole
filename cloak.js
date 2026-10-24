"use strict";
(function () {
  var KEY = "blackhole_cloak_v1";
  var defaults = {
    title: "Blackhole",
    favicon: "favicon.png",
    panicKey: "`",
    panicUrl: "https://canvas.instructure.com/"
  };

  function load() {
    try {
      var cfg = Object.assign({}, defaults, JSON.parse(
        localStorage.getItem(KEY) || localStorage.getItem("dizzy_cloak_v1") || "{}"
      ));
      // Migrate old default title/favicon to Blackhole branding
      if (!cfg.title || cfg.title === "Dashboard") cfg.title = defaults.title;
      if (!cfg.favicon || cfg.favicon === "canvas-favicon.svg") cfg.favicon = defaults.favicon;
      return cfg;
    } catch (e) {
      return Object.assign({}, defaults);
    }
  }

  function save(cfg) {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  }

  function applyCloak(cfg) {
    cfg = cfg || load();
    // Always prefer Canvas-style identity unless user set a custom title in settings
    var title = cfg.title || defaults.title;
    var favicon = cfg.favicon || defaults.favicon;
    try {
      document.title = title;
    } catch (e) {}
    var links = document.querySelectorAll('link[rel*="icon"]');
    if (!links.length) {
      var l = document.createElement("link");
      l.rel = "icon";
      document.head.appendChild(l);
      links = [l];
    }
    links.forEach(function (link) {
      try {
        link.href = favicon;
      } catch (e) {}
    });
  }

  function panic() {
    var cfg = load();
    var url = cfg.panicUrl || defaults.panicUrl;
    try {
      window.location.replace(url);
    } catch (e) {
      window.location.href = url;
    }
  }

  // Apply immediately + keep locked so tab always looks like Canvas
  applyCloak();
  setInterval(function () {
    var cfg = load();
    if (document.title !== (cfg.title || defaults.title)) {
      document.title = cfg.title || defaults.title;
    }
  }, 1000);

  document.addEventListener("keydown", function (e) {
    var cfg = load();
    var key = cfg.panicKey || "`";
    if (!key) return;
    if (e.key === key || e.key.toLowerCase() === String(key).toLowerCase()) {
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      panic();
    }
  });

  window.BlackholeCloak = window.DizzyCloak = {
    load: load,
    save: save,
    apply: applyCloak,
    panic: panic,
    defaults: defaults
  };
})();
