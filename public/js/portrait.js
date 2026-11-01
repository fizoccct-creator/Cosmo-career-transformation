// Portrait maker
// 1) AI portrait from the local server (/api/portrait → Google Gemini)
// 2) If that's off or fails: template portrait — the person is cut out of the photo
//    (MediaPipe selfie segmentation, bundled, works offline) and placed on the career scene.
// 3) If even that fails: the photo framed on the career scene.

window.Portrait = (() => {
  const OUT_W = 1080, OUT_H = 1350;   // 4:5
  let segmenter = null, segmenterLoading = null;

  async function aiAvailable() {
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      if (!r.ok) return false;
      return Boolean((await r.json()).ai);
    } catch { return false; }
  }

  async function fromAI(photoDataUrl, careerId, timeoutSeconds) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutSeconds * 1000);
    try {
      const r = await fetch("/api/portrait", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: photoDataUrl, career: careerId }), signal: ctrl.signal,
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok || !json.image) throw new Error(json.error || `HTTP ${r.status}`);
      return json.image;
    } finally { clearTimeout(t); }
  }

  // ---------- template portrait ----------
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load " + src));
      img.src = src;
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Could not load " + src));
      document.head.appendChild(s);
    });
  }

  async function getSegmenter() {
    if (segmenter) return segmenter;
    if (!segmenterLoading) {
      segmenterLoading = (async () => {
        if (!window.SelfieSegmentation) await loadScript("vendor/selfie_segmentation/selfie_segmentation.js");
        const seg = new window.SelfieSegmentation({ locateFile: (f) => `vendor/selfie_segmentation/${f}` });
        seg.setOptions({ modelSelection: 0, selfieMode: false });
        await seg.initialize();
        segmenter = seg;
        return seg;
      })();
    }
    return segmenterLoading;
  }

  // Warm up the cut-out model while the visitor answers the quiz.
  function preload() { getSegmenter().catch((e) => console.warn("Segmenter unavailable:", e.message)); }

  async function segment(img) {
    const seg = await getSegmenter();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Segmentation timed out")), 15000);
      seg.onResults((r) => { clearTimeout(timer); resolve(r.segmentationMask); });
      seg.send({ image: img }).catch((e) => { clearTimeout(timer); reject(e); });
    });
  }

  function drawCover(ctx, img, w, h) {
    const s = Math.max(w / img.width, h / img.height);
    const dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  async function fromTemplate(photoDataUrl, career) {
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W; canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    const photo = await loadImage(photoDataUrl);

    // Background scene
    try { drawCover(ctx, await loadImage(career.background), OUT_W, OUT_H); }
    catch { ctx.fillStyle = "#202959"; ctx.fillRect(0, 0, OUT_W, OUT_H); }

    // Person: photo is 4:5 already; place it slightly smaller and anchored to the bottom.
    const pw = OUT_W * 0.92, ph = pw * (photo.height / photo.width);
    const px = (OUT_W - pw) / 2, py = OUT_H - ph;
    let cutOut = false;
    try {
      const mask = await segment(photo);
      const layer = document.createElement("canvas");
      layer.width = photo.width; layer.height = photo.height;
      const lc = layer.getContext("2d");
      lc.filter = "blur(3px)";                       // soften the cut-out edge
      lc.drawImage(mask, 0, 0, photo.width, photo.height);
      lc.filter = "none";
      lc.globalCompositeOperation = "source-in";
      lc.drawImage(photo, 0, 0);
      // soft shadow to sit the person in the scene
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
      ctx.drawImage(layer, px, py, pw, ph);
      ctx.restore();
      cutOut = true;
    } catch (e) {
      console.warn("Cut-out failed, using framed photo:", e.message);
      const fw = OUT_W * 0.7, fh = fw * 1.25, fx = (OUT_W - fw) / 2, fy = OUT_H * 0.16;
      ctx.save(); roundRect(ctx, fx, fy, fw, fh, 36); ctx.clip();
      const s = Math.max(fw / photo.width, fh / photo.height);
      ctx.drawImage(photo, fx + (fw - photo.width * s) / 2, fy + (fh - photo.height * s) / 2, photo.width * s, photo.height * s);
      ctx.restore();
      ctx.lineWidth = 12; ctx.strokeStyle = "#FDD00D"; roundRect(ctx, fx, fy, fw, fh, 36); ctx.stroke();
    }

    // Optional foreground layer from Figma (props in front of the person)
    if (career.foreground) {
      try { drawCover(ctx, await loadImage(career.foreground), OUT_W, OUT_H); } catch { /* optional */ }
    }
    return { src: canvas.toDataURL("image/jpeg", 0.92), cutOut };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // Main entry: always resolves with an image.
  async function create(photoDataUrl, careerId, career, opts) {
    if (opts.ai) {
      try {
        const src = await fromAI(photoDataUrl, careerId, opts.timeoutSeconds || 60);
        return { src, source: "ai" };
      } catch (e) {
        console.warn("AI portrait failed, using template:", e.message);
      }
    }
    const t = await fromTemplate(photoDataUrl, career);
    return { src: t.src, source: t.cutOut ? "template" : "framed" };
  }

  return { aiAvailable, create, preload };
})();
