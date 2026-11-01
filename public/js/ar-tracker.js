// Head tracking for the AR quiz (Google MediaPipe Face Landmarker, bundled in /vendor).
// Reports the face position on screen and which way the head points:
//   left / right  = tilt (or turn) the head
//   up / down     = look up / look down, measured against the player's own neutral pose

window.ARTracker = (() => {
  const LOCAL_MODEL = "vendor/face_landmarker/face_landmarker.task";
  const GOOGLE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

  let landmarker = null, loading = null;
  let video = null, container = null, raf = 0, lastTime = -1, onFrame = null;
  let settings = { tiltDegrees: 16, turnAmount: 0.3, lookUp: 0.1, lookDown: 0.12 };

  // Face state in container (CSS pixel) coordinates
  const face = { found: false, x: 0, y: 0, unit: 0, roll: 0, turn: 0, pitch: 0, base: null, lastSeen: 0 };

  async function load() {
    if (landmarker) return landmarker;
    if (!loading) {
      loading = (async () => {
        const { FaceLandmarker, FilesetResolver } = await import("../vendor/tasks-vision/vision_bundle.mjs");
        const fileset = await FilesetResolver.forVisionTasks(new URL("vendor/tasks-vision/wasm", location.href).href);
        let model = GOOGLE_MODEL;
        try { if ((await fetch(LOCAL_MODEL, { method: "HEAD" })).ok) model = LOCAL_MODEL; } catch { /* use Google */ }
        const opts = (delegate) => ({ baseOptions: { modelAssetPath: model, delegate }, runningMode: "VIDEO", numFaces: 1 });
        try { landmarker = await FaceLandmarker.createFromOptions(fileset, opts("GPU")); }
        catch { landmarker = await FaceLandmarker.createFromOptions(fileset, opts("CPU")); }
        return landmarker;
      })();
      loading.catch(() => { loading = null; });
    }
    return loading;
  }

  function configure(s) { Object.assign(settings, s || {}); }

  function start(videoEl, containerEl, cb) {
    video = videoEl; container = containerEl; onFrame = cb;
    face.base = null; face.found = false;
    cancelAnimationFrame(raf);
    const loop = (now) => { track(now); onFrame && onFrame(face, direction()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; onFrame = null; }

  // video drawn with object-fit: cover and mirrored (scaleX(-1))
  function toScreen(p, r, cw) { return { x: cw - (r.x + p.x * r.w), y: r.y + p.y * r.h }; }

  function track(now) {
    if (!landmarker || !video || video.readyState < 2 || video.currentTime === lastTime) return;
    lastTime = video.currentTime;
    let res;
    try { res = landmarker.detectForVideo(video, now); } catch { return; }
    const lm = res.faceLandmarks && res.faceLandmarks[0];
    if (!lm) { if (now - face.lastSeen > 400) face.found = false; return; }

    const cw = container.clientWidth, ch = container.clientHeight;
    const vw = video.videoWidth, vh = video.videoHeight;
    const s = Math.max(cw / vw, ch / vh);
    const r = { x: (cw - vw * s) / 2, y: (ch - vh * s) / 2, w: vw * s, h: vh * s };

    const a = toScreen(lm[33], r, cw), b = toScreen(lm[263], r, cw);
    const [eL, eR] = a.x < b.x ? [a, b] : [b, a];
    const nose = toScreen(lm[1], r, cw);
    const cA = toScreen(lm[234], r, cw), cB = toScreen(lm[454], r, cw);
    const mid = { x: (eL.x + eR.x) / 2, y: (eL.y + eR.y) / 2 };
    const ed = Math.hypot(eR.x - eL.x, eR.y - eL.y) || 1;
    const ux = (eR.x - eL.x) / ed, uy = (eR.y - eL.y) / ed;       // along the eye line
    const px = -uy, py = ux;                                       // perpendicular (pointing down the face)

    const k = face.found ? 0.4 : 1;                                // smoothing
    face.x += (mid.x - face.x) * k;
    face.y += (mid.y - face.y) * k;
    face.unit += (Math.hypot(cB.x - cA.x, cB.y - cA.y) - face.unit) * k;
    face.roll = Math.atan2(eR.y - eL.y, eR.x - eL.x) * 180 / Math.PI;
    face.turn = ((nose.x - mid.x) * ux + (nose.y - mid.y) * uy) / ed;
    // Nose drops below the eye line when looking down, rises when looking up.
    const pitch = ((nose.x - mid.x) * px + (nose.y - mid.y) * py) / ed;
    face.pitch += (pitch - face.pitch) * (face.found ? 0.5 : 1);
    face.found = true; face.lastSeen = now;

    // Learn this player's neutral pose: start from the first frames, then follow slowly while they're not choosing.
    if (face.base === null) face.base = face.pitch;
    else if (!direction()) face.base += (face.pitch - face.base) * 0.02;
  }

  function direction() {
    if (!face.found || face.base === null) return null;
    const t = settings;
    if (face.roll < -t.tiltDegrees || face.turn < -t.turnAmount) return "left";
    if (face.roll > t.tiltDegrees || face.turn > t.turnAmount) return "right";
    if (Math.abs(face.roll) > t.tiltDegrees * 0.6) return null;    // half-tilted: don't guess up/down
    const d = face.pitch - face.base;
    if (d < -t.lookUp) return "up";
    if (d > t.lookDown) return "down";
    return null;
  }

  function neutral() {
    if (!face.found || face.base === null) return false;
    const t = settings;
    return Math.abs(face.roll) < t.tiltDegrees * 0.5 && Math.abs(face.turn) < t.turnAmount * 0.5 &&
      Math.abs(face.pitch - face.base) < Math.min(t.lookUp, t.lookDown) * 0.5;
  }

  function recalibrate() { face.base = face.found ? face.pitch : null; }

  return { load, configure, start, stop, neutral, recalibrate, face, isReady: () => Boolean(landmarker) };
})();
