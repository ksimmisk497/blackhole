// Blackhole AI — Cloudflare Worker (Workers AI, no API key)
// Setup:
// 1. Create Worker, paste this file
// 2. Settings > Bindings > Add > Workers AI, variable name: AI
// 3. Deploy, copy URL (e.g. https://blackhole-ai.you.workers.dev)
// 4. In Blackhole ai.html set window.BH_AI_URL to that URL
//
// Credits to Teo

const MODELS = [
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/meta/llama-3.2-3b-instruct",
  "@cf/meta/llama-3.1-8b-instruct-fast"
];
const SYSTEM =
  "You are Blackhole AI, a friendly helpful assistant for students. Keep answers clear and short. Be age-appropriate and respectful. If asked for something unsafe or inappropriate, politely decline and suggest talking to a trusted adult or teacher.";
const MAX_MESSAGES_PER_10_MIN = 15;
const MAX_REPLY_TOKENS = 500;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type"
};

const PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Blackhole AI</title>
<style>
:root{--bg:#0a0a0f;--surface:#14141c;--text:#eee;--muted:#888;--accent:#ff7a2f;--accent-text:#0a0a0f;--border:#2a2a35;--user:#1e1a16}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--text);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column}
header{padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px}
h1{font-size:15px;margin:0;font-weight:700;color:var(--accent)}
.credits{font-size:11px;color:var(--muted)}
header button{background:none;border:1px solid var(--border);color:var(--muted);border-radius:8px;padding:6px 12px;cursor:pointer;font:inherit;font-size:13px}
header button:hover{color:#fff;border-color:#444}
main{flex:1;min-height:0;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
.empty{margin:auto;text-align:center;color:var(--muted);max-width:280px}
.empty h2{color:var(--text);font-size:20px;margin:0 0 8px}
.msg{max-width:88%;padding:10px 14px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}
.msg.user{align-self:flex-end;background:var(--user);border:1px solid #3a2e24}
.msg.ai{align-self:flex-start;background:var(--surface);border:1px solid var(--border)}
.msg.err{color:#ff6b6b}
form{display:flex;gap:8px;padding:10px 12px 14px;border-top:1px solid var(--border)}
textarea{flex:1;resize:none;border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:12px;padding:12px 14px;font:inherit;max-height:140px}
textarea:focus{outline:2px solid var(--accent);outline-offset:-1px}
#send{background:var(--accent);color:var(--accent-text);border:0;border-radius:12px;padding:0 20px;font:inherit;font-weight:700;cursor:pointer}
#send:disabled{opacity:.5;cursor:default}
</style>
</head>
<body>
<header>
  <div>
    <h1>Blackhole AI</h1>
    <div class="credits">Credits to Teo</div>
  </div>
  <button id="clear" type="button">New chat</button>
</header>
<main id="log"></main>
<form id="f">
  <textarea id="q" rows="1" placeholder="Ask anything…" autofocus></textarea>
  <button id="send" type="submit">Send</button>
</form>
<script>
const API_URL = "/api/chat";
const log = document.getElementById("log"), q = document.getElementById("q"), send = document.getElementById("send");
let history = [], busy = false;
function showEmpty() {
  log.innerHTML = '<div class="empty"><h2>What can I help with?</h2><div>Type a question below. No sign-in needed.</div><div style="margin-top:10px;font-size:12px">Credits to Teo</div></div>';
}
function add(role, text, cls) {
  const e = log.querySelector(".empty"); if (e) e.remove();
  const d = document.createElement("div");
  d.className = "msg " + role + (cls ? " " + cls : "");
  d.textContent = text;
  log.appendChild(d); log.scrollTop = log.scrollHeight;
  return d;
}
async function ask() {
  const text = q.value.trim(); if (!text || busy) return;
  busy = true; send.disabled = true; q.value = ""; q.style.height = "auto";
  add("user", text); history.push({ role: "user", content: text });
  const out = add("ai", "Thinking…");
  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Request failed.");
    out.textContent = data.text;
    history.push({ role: "assistant", content: data.text });
  } catch (e) {
    out.textContent = e.message || "Something went wrong. Please try again.";
    out.classList.add("err"); history.pop();
  }
  busy = false; send.disabled = false; q.focus();
}
document.getElementById("f").addEventListener("submit", e => { e.preventDefault(); ask(); });
q.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } });
q.addEventListener("input", () => { q.style.height = "auto"; q.style.height = Math.min(q.scrollHeight, 140) + "px"; });
document.getElementById("clear").onclick = () => { history = []; showEmpty(); };
showEmpty();
</script>
</body>
</html>
`;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors }
  });

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 600000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_MESSAGES_PER_10_MIN;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return new Response(PAGE, {
        headers: { "Content-Type": "text/html; charset=utf-8", ...cors }
      });
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      if (!env.AI) return json({ error: "Missing the Workers AI binding named AI." }, 500);
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (limited(ip)) return json({ error: "Too many messages. Please wait a few minutes." }, 429);
      try {
        const { messages } = await request.json();
        if (!Array.isArray(messages) || !messages.length) return json({ error: "No messages." }, 400);
        const clean = messages.slice(-10).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content).slice(0, 2000)
        }));
        let text = "", lastErr = "";
        for (const model of MODELS) {
          try {
            const result = await env.AI.run(model, {
              messages: [{ role: "system", content: SYSTEM }, ...clean],
              max_tokens: MAX_REPLY_TOKENS
            });
            text = result && result.response ? String(result.response).trim() : "";
            if (text) break;
          } catch (err) {
            lastErr = String((err && err.message) || err);
          }
        }
        if (!text) return json({ error: "AI error: " + (lastErr || "no answer") }, 502);
        return json({ text });
      } catch (e) {
        return json({ error: "Something went wrong: " + String((e && e.message) || e) }, 500);
      }
    }

    return new Response("Not found", { status: 404, headers: cors });
  }
};
