"use strict";
(function () {
  var STORAGE_USER = "blackhole_chat_user";
  var STORAGE_CFG = "blackhole_chat_cfg";
  var ROOM = "blackhole-global";
  var sb = null;
  var channel = null;
  var myName = "";

  function loadCfg() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_CFG) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveCfg(cfg) {
    localStorage.setItem(STORAGE_CFG, JSON.stringify(cfg || {}));
  }

  function loadUser() {
    try {
      return (localStorage.getItem(STORAGE_USER) || "").trim();
    } catch (e) {
      return "";
    }
  }

  function saveUser(name) {
    myName = String(name || "").trim().slice(0, 24);
    localStorage.setItem(STORAGE_USER, myName);
    return myName;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function timeStr(ts) {
    try {
      var d = ts ? new Date(ts) : new Date();
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  }

  function addBubble(msg, mine) {
    var list = el("chat-messages");
    if (!list) return;
    var empty = el("chat-empty");
    if (empty) empty.style.display = "none";

    var row = document.createElement("div");
    row.className = "chat-row" + (mine ? " mine" : "");
    row.innerHTML =
      '<div class="chat-meta"><span class="chat-user"></span><span class="chat-time"></span></div>' +
      '<div class="chat-bubble"></div>';
    row.querySelector(".chat-user").textContent = msg.username || "anon";
    row.querySelector(".chat-time").textContent = timeStr(msg.created_at);
    row.querySelector(".chat-bubble").textContent = msg.body || "";
    list.appendChild(row);
    list.scrollTop = list.scrollHeight;
  }

  function setStatus(text, ok) {
    var s = el("chat-status");
    if (!s) return;
    s.textContent = text;
    s.className = "chat-status" + (ok ? " ok" : " bad");
  }

  async function loadHistory() {
    if (!sb) return;
    try {
      var res = await sb
        .from("messages")
        .select("id,username,body,created_at,room")
        .eq("room", ROOM)
        .order("created_at", { ascending: true })
        .limit(150);
      if (res.error) throw res.error;
      var list = el("chat-messages");
      if (list) list.innerHTML = "";
      (res.data || []).forEach(function (m) {
        addBubble(m, m.username === myName);
      });
      if (!(res.data || []).length) {
        var empty = el("chat-empty");
        if (empty) empty.style.display = "";
      }
    } catch (e) {
      setStatus("Could not load messages: " + (e.message || e), false);
    }
  }

  function subscribe() {
    if (!sb) return;
    if (channel) {
      try { sb.removeChannel(channel); } catch (e) {}
    }
    channel = sb
      .channel("room:" + ROOM)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: "room=eq." + ROOM },
        function (payload) {
          var m = payload.new;
          if (!m) return;
          addBubble(m, m.username === myName);
        }
      )
      .subscribe(function (status) {
        if (status === "SUBSCRIBED") setStatus("Connected · global room", true);
        else if (status === "CHANNEL_ERROR") setStatus("Realtime error — check Supabase setup", false);
      });
  }

  async function send() {
    var input = el("chat-input");
    if (!input || !sb || !myName) return;
    var body = input.value.trim();
    if (!body) return;
    input.value = "";
    try {
      var res = await sb.from("messages").insert([
        { room: ROOM, username: myName, body: body.slice(0, 500) }
      ]);
      if (res.error) throw res.error;
    } catch (e) {
      setStatus("Send failed: " + (e.message || e), false);
    }
  }

  async function connect() {
    var cfg = loadCfg();
    var url = (cfg.url || "").trim();
    var key = (cfg.key || "").trim();
    if (!url || !key) {
      setStatus("Add Supabase URL + anon key in the setup panel (one-time).", false);
      return;
    }
    if (typeof supabase === "undefined" || !supabase.createClient) {
      setStatus("Chat library failed to load.", false);
      return;
    }
    try {
      sb = supabase.createClient(url, key);
      setStatus("Connecting…", true);
      await loadHistory();
      subscribe();
    } catch (e) {
      setStatus("Connect failed: " + (e.message || e), false);
    }
  }

  function showApp() {
    var gate = el("chat-gate");
    var app = el("chat-app");
    if (gate) gate.style.display = "none";
    if (app) app.style.display = "flex";
    var label = el("chat-who");
    if (label) label.textContent = myName;
    connect();
  }

  function showGate() {
    var gate = el("chat-gate");
    var app = el("chat-app");
    if (gate) gate.style.display = "";
    if (app) app.style.display = "none";
  }

  function init() {
    myName = loadUser();
    var cfg = loadCfg();

    var urlInput = el("cfg-url");
    var keyInput = el("cfg-key");
    if (urlInput) urlInput.value = cfg.url || "";
    if (keyInput) keyInput.value = cfg.key || "";

    var nameInput = el("chat-username");
    if (nameInput && myName) nameInput.value = myName;

    el("btn-save-cfg") && el("btn-save-cfg").addEventListener("click", function () {
      saveCfg({
        url: (el("cfg-url") && el("cfg-url").value) || "",
        key: (el("cfg-key") && el("cfg-key").value) || ""
      });
      setStatus("Saved backend settings.", true);
    });

    el("btn-join") && el("btn-join").addEventListener("click", function () {
      var n = nameInput ? nameInput.value.trim() : "";
      if (n.length < 2) {
        setStatus("Username must be at least 2 characters.", false);
        return;
      }
      saveUser(n);
      var c = loadCfg();
      if (!c.url || !c.key) {
        setStatus("Save Supabase URL + anon key first.", false);
        return;
      }
      showApp();
    });

    el("btn-leave") && el("btn-leave").addEventListener("click", function () {
      if (channel && sb) {
        try { sb.removeChannel(channel); } catch (e) {}
      }
      channel = null;
      showGate();
      setStatus("Left chat.", true);
    });

    el("btn-send") && el("btn-send").addEventListener("click", send);
    el("chat-input") && el("chat-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    if (myName && cfg.url && cfg.key) showApp();
    else showGate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else init();
})();
