// Portrait maker: AI only (Google Gemini through the local server, /api/portrait).
// Throws a readable error if the portrait can't be made, so the app can show the "try again" screen.

window.Portrait = (() => {
  async function status() {
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      if (!r.ok) return { ai: false, reason: "server" };
      const j = await r.json();
      return { ai: Boolean(j.ai), reason: j.ai ? "" : "nokey" };
    } catch { return { ai: false, reason: "server" }; }
  }

  async function create(photoDataUrl, careerId, timeoutSeconds) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), (timeoutSeconds || 60) * 1000);
    try {
      const r = await fetch("/api/portrait", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: photoDataUrl, career: careerId }), signal: ctrl.signal,
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok || !json.image) throw new Error(json.error || `Server error ${r.status}`);
      return json.image;
    } catch (e) {
      if (e.name === "AbortError") throw new Error(`Timed out after ${timeoutSeconds || 60} s`);
      if (e instanceof TypeError) throw new Error("Can't reach the kiosk server (is node server.js running?)");
      throw e;
    } finally { clearTimeout(t); }
  }

  return { status, create };
})();
