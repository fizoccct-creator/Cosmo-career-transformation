// Cosmo Career Transformation — kiosk server
// - Serves the app from /public
// - POST /api/portrait  → asks Google Gemini to turn the photo into a career portrait
// - GET  /api/status    → tells the app whether AI is switched on
// The Gemini API key stays here on the kiosk computer and never reaches the browser.
// Photos are only held in memory for the length of one request; nothing is written to disk.
//
// Run:  node server.js    (needs Node 18 or newer, no npm install required)

const http = require("http");
const fs = require("fs");
const path = require("path");

// ---------- settings (from .env or environment) ----------
loadDotEnv(path.join(__dirname, ".env"));
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-nano-banana-2.1";
const API_BASE = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
const ASPECT = process.env.PORTRAIT_ASPECT_RATIO || "4:5";
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY = 12 * 1024 * 1024; // 12 MB

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

// Career prompts are read from content.json on the server, so the browser can only pick a career,
// never send its own prompt.
function readContent() {
  return JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, "content.json"), "utf8"));
}

// ---------- Gemini ----------
async function generatePortrait(imageBase64, careerId) {
  const content = readContent();
  const career = content.careers[careerId];
  if (!career) throw httpError(400, "Unknown career");
  const prompt = `${career.aiPrompt} ${content.aiPromptRules || ""}`.trim();

  const body = (withAspect) => ({
    contents: [{ parts: [
      { text: prompt },
      { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
    ] }],
    generationConfig: Object.assign(
      { responseModalities: ["IMAGE", "TEXT"] },
      withAspect ? { imageConfig: { aspectRatio: ASPECT } } : {}
    ),
  });

  const call = async (withAspect) => {
    const res = await fetch(`${API_BASE}/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
      body: JSON.stringify(body(withAspect)),
      signal: AbortSignal.timeout(90_000),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { ok: res.ok, status: res.status, json, text };
  };

  let r = await call(true);
  // Some model versions don't accept the aspect-ratio option; retry once without it.
  if (!r.ok && r.status === 400 && /aspect|imageConfig|image_config/i.test(r.text)) r = await call(false);
  if (!r.ok) {
    const msg = r.json?.error?.message || r.text.slice(0, 300);
    throw httpError(502, `Gemini error ${r.status}: ${msg}`);
  }

  const parts = r.json?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData || p.inline_data);
  if (!img) {
    const reason = r.json?.candidates?.[0]?.finishReason || r.json?.promptFeedback?.blockReason || "no image returned";
    throw httpError(502, `Gemini returned no image (${reason})`);
  }
  const data = img.inlineData || img.inline_data;
  return { mimeType: data.mimeType || data.mime_type || "image/png", data: data.data };
}

// ---------- HTTP ----------
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(httpError(413, "Photo too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".wasm": "application/wasm",
  ".tflite": "application/octet-stream", ".binarypb": "application/octet-stream", ".data": "application/octet-stream",
  ".mp4": "video/mp4", ".ico": "image/x-icon",
};

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache" });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/api/status" && req.method === "GET") {
      return sendJson(res, 200, { ai: Boolean(API_KEY), model: API_KEY ? MODEL : null });
    }
    if (req.url === "/api/portrait" && req.method === "POST") {
      if (!API_KEY) throw httpError(503, "AI is off: no GEMINI_API_KEY set");
      const { image, career } = JSON.parse(await readBody(req) || "{}");
      if (typeof image !== "string" || !image.startsWith("data:image/jpeg;base64,")) throw httpError(400, "Expected a JPEG photo");
      const started = Date.now();
      const out = await generatePortrait(image.split(",")[1], String(career || ""));
      console.log(`[portrait] ${career} ok in ${((Date.now() - started) / 1000).toFixed(1)}s`);
      return sendJson(res, 200, { image: `data:${out.mimeType};base64,${out.data}` });
    }
    if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res);
    res.writeHead(405); res.end();
  } catch (e) {
    console.warn(`[error] ${req.method} ${req.url}: ${e.message}`);
    sendJson(res, e.status || 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Cosmo Career kiosk running at  http://localhost:${PORT}`);
  console.log(API_KEY ? `  AI portraits: ON  (model ${MODEL})` : "  AI portraits: OFF (no GEMINI_API_KEY) — using the template portrait instead");
  console.log("  Press Ctrl+C to stop.\n");
});
