// Discover Your Creative Career — kiosk app
// Screens: welcome → consent → photo → quiz (5) → loading → result → (back to welcome)
// All wording, questions and careers come from content.json.

(() => {
  const $ = (id) => document.getElementById(id);
  const app = $("app");
  let C = null;                      // content.json
  let aiOn = false;

  const state = {
    screen: "welcome",
    photo: null,                     // captured photo (data URL), kept in memory only
    answers: [],                     // career id per question, in order
    q: 0,
    career: null,
    stream: null,
    busy: false,
    ar: false,                       // quiz answered with head movements
    positions: [],                   // per question: direction for each option (shuffled)
  };
  const DEBUG = new URLSearchParams(location.search).has("debug");
  window.kiosk = state;              // handy for testing in the browser console

  // ---------- helpers ----------
  const get = (obj, path) => path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
  function fillText() {
    document.querySelectorAll("[data-text]").forEach((el) => {
      const v = get(C, el.dataset.text);
      if (typeof v === "string") el.textContent = v;
    });
  }
  function hasCssImage(varName) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return v && v !== "none";
  }

  // ---------- screens ----------
  const STEP_OF = { welcome: 0, consent: 1, photo: 1, quiz: 2, loading: 3, result: 3, error: 3 };
  function show(name) {
    state.screen = name;
    app.dataset.screen = name;
    const step = STEP_OF[name];
    document.querySelectorAll("#progress li").forEach((li, i) => {
      li.classList.toggle("done", i + 1 < step || name === "result");
      li.classList.toggle("active", i + 1 === step && name !== "result");
    });
    resetIdle();
  }

  function buildProgress() {
    $("progress").innerHTML = C.steps.map((s, i) => `<li data-n="${i + 1}">${s}</li>`).join("");
  }

  // ---------- reset (also used by the idle timer) ----------
  function resetAll() {
    stopAR();
    stopCamera();
    state.photo = null;            // wipe the photo
    state.answers = []; state.q = 0; state.career = null; state.busy = false;
    $("shot").removeAttribute("src"); $("shot").hidden = true;
    $("portrait").removeAttribute("src"); $("loadingPhoto").removeAttribute("src");
    document.querySelectorAll(".confetti").forEach((c) => c.remove());
    hideIdle();
    show("welcome");
  }

  // ---------- camera ----------
  async function startCamera() {
    $("cameraError").hidden = true;
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
      });
      $("video").srcObject = state.stream;
      await $("video").play();
      setPhotoMode("live");
    } catch (e) {
      console.error(e);
      $("cameraError").textContent = C.photo.noCamera;
      $("cameraError").hidden = false;
      $("liveControls").hidden = true;
    }
  }
  function stopCamera() {
    if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
    $("video").srcObject = null;
  }
  function setPhotoMode(mode) {
    const live = mode === "live";
    $("video").hidden = !live; $("shot").hidden = live;
    $("liveControls").hidden = !live; $("reviewControls").hidden = live;
    document.querySelector(".camera-frame").classList.toggle("captured", !live);
  }

  async function countdownAndCapture() {
    if (state.busy) return;
    state.busy = true;
    const cd = $("countdown");
    cd.hidden = false;
    for (let n = C.kiosk.countdownSeconds; n > 0; n--) {
      cd.innerHTML = `<span>${n}</span>`;
      await wait(900);
      if (state.screen !== "photo") { cd.hidden = true; state.busy = false; return; }
    }
    cd.hidden = true;
    capture();
    state.busy = false;
  }

  function capture() {
    const v = $("video");
    const vw = v.videoWidth, vh = v.videoHeight;
    if (!vw) return;
    // Crop the centre 4:5 area (what the visitor sees in the frame), mirrored like the preview.
    const targetRatio = 4 / 5;
    let sw = vw, sh = vh;
    if (vw / vh > targetRatio) sw = vh * targetRatio; else sh = vw / targetRatio;
    const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
    const outH = Math.min(1350, sh), outW = outH * targetRatio;
    const c = document.createElement("canvas");
    c.width = Math.round(outW); c.height = Math.round(outH);
    const ctx = c.getContext("2d");
    ctx.translate(c.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    state.photo = c.toDataURL("image/jpeg", 0.9);
    $("shot").src = state.photo;
    $("flash").classList.remove("go"); void $("flash").offsetWidth; $("flash").classList.add("go");
    setPhotoMode("review");
  }

  // ---------- quiz ----------
  function renderQuestion() {
    const total = C.questions.length;
    const q = C.questions[state.q];
    $("quizCount").textContent = C.quiz.progress.replace("{n}", state.q + 1).replace("{total}", total);
    $("quizDots").innerHTML = C.questions.map((_, i) =>
      `<span class="${i < state.q ? "done" : i === state.q ? "now" : ""}"></span>`).join("");
    $("questionText").textContent = q.text;
    const letters = "ABCDEFGH";
    if (!state.positions[state.q]) state.positions[state.q] = shuffle(["up", "left", "right", "down"]);
    const pos = state.positions[state.q];
    const dirLabel = { up: "↑ " + C.quiz.dirUp, down: "↓ " + C.quiz.dirDown, left: "← " + C.quiz.dirLeft, right: C.quiz.dirRight + " →" };
    $("options").innerHTML = q.options.map((o, i) => `
      <button class="option${state.answers[state.q] === i ? " selected" : ""}" role="listitem" data-index="${i}" data-dir="${pos[i] || ""}">
        <span class="dir">${dirLabel[pos[i]] || ""}</span>
        <span class="letter">${letters[i]}</span><span>${escapeHtml(o.text)}</span>
      </button>`).join("");
    document.querySelector(".screen-quiz").classList.toggle("answered", state.answers[state.q] !== undefined);
    ar.armed = false; ar.holdDir = null;
    const last = state.q === total - 1;
    $("finishBtn").hidden = !last;
    $("finishBtn").disabled = state.answers[state.q] === undefined;
    // restart the entry animation for each question
    const s = document.querySelector(".screen-quiz");
    s.style.animation = "none"; void s.offsetWidth; s.style.animation = "";
  }

  let advancing = false;
  async function choose(i) {
    if (advancing) return;
    state.answers[state.q] = i;
    document.querySelectorAll(".option").forEach((b) => b.classList.toggle("selected", Number(b.dataset.index) === i));
    document.querySelector(".screen-quiz").classList.add("answered");
    const last = state.q === C.questions.length - 1;
    if (last) { $("finishBtn").disabled = false; return; }
    advancing = true;
    await wait(state.ar ? 650 : 260); // brief highlight, then auto-advance
    advancing = false;
    if (state.screen !== "quiz") return;
    state.q++;
    renderQuestion();
  }

  // Most answers wins. Tie → the tied career that was picked most recently.
  function tally() {
    const counts = {}, lastSeen = {};
    state.answers.forEach((optIndex, qIndex) => {
      const id = C.questions[qIndex].options[optIndex].career;
      counts[id] = (counts[id] || 0) + 1;
      lastSeen[id] = qIndex;
    });
    return Object.keys(counts).sort((a, b) => (counts[b] - counts[a]) || (lastSeen[b] - lastSeen[a]))[0];
  }

  // ---------- result ----------
  async function finish() {
    if (state.answers.length !== C.questions.length || state.answers.includes(undefined)) return;
    state.career = tally();
    const career = C.careers[state.career];
    stopAR(); stopCamera();
    $("loadingPhoto").src = state.photo;
    show("loading");
    const lines = C.loading.lines; let li = 0;
    $("loadingLine").textContent = lines[0];
    const ticker = setInterval(() => {
      li = (li + 1) % lines.length;
      $("loadingLine").style.opacity = 0;
      setTimeout(() => { $("loadingLine").textContent = lines[li]; $("loadingLine").style.opacity = 1; }, 250);
    }, 2600);

    const started = Date.now();
    let image = null, error = null;
    try {
      image = await Portrait.create(state.photo, state.career, C.kiosk.aiTimeoutSeconds);
    } catch (e) { error = e; } finally { clearInterval(ticker); }
    if (Date.now() - started < 1800) await wait(1800 - (Date.now() - started));  // let the moment land
    if (state.screen !== "loading") return;    // reset while waiting

    if (error) {
      // Keep the photo and answers so TRY AGAIN can reuse them.
      console.warn("Portrait failed:", error.message);
      state.lastError = error.message;
      $("errorDetail").textContent = DEBUG ? error.message : "";
      show("error");
      return;
    }
    $("portrait").src = image;
    $("careerTitle").textContent = career.title;
    $("careerText").textContent = career.description;
    state.photo = null;                         // photo no longer needed
    show("result");
    confetti();
  }

  function confetti() {
    const colors = ["#FDD00D", "#FFFFFF", "#8fa2ff", "#FDD00D"];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement("i");
      c.className = "confetti";
      c.style.left = Math.random() * 100 + "vw";
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = 2.2 + Math.random() * 2.2 + "s";
      c.style.animationDelay = Math.random() * 0.8 + "s";
      c.style.transform = `rotate(${Math.random() * 360}deg)`;
      app.appendChild(c);
      setTimeout(() => c.remove(), 6000);
    }
  }

  // ---------- AR quiz (answer with head movements) ----------
  const ar = { armed: false, holdDir: null, holdStart: 0, lastIdleBump: 0, anchor: null };

  async function startQuiz() {
    state.q = 0; state.answers = []; state.positions = [];
    state.ar = false; ar.anchor = null;
    if (C.ar?.enabled && state.stream) {
      try {
        await ARTracker.load();
        ARTracker.configure(C.ar);
        $("arVideo").srcObject = state.stream;
        await $("arVideo").play();
        state.ar = true;
      } catch (e) { console.warn("AR quiz off, using touch:", e.message); }
    }
    if (!state.ar) stopCamera();
    document.querySelector(".screen-quiz").classList.toggle("ar", state.ar);
    renderQuestion();
    show("quiz");
    if (state.ar) ARTracker.start($("arVideo"), document.querySelector(".screen-quiz"), arFrame);
  }

  function stopAR() {
    ARTracker.stop();
    $("arVideo").srcObject = null;
    $("arHint").hidden = true;
    $("arDebug").hidden = true;
  }

  function arFrame(face, dir) {
    if (state.screen !== "quiz") return;
    const now = performance.now();
    const box = document.querySelector(".screen-quiz");
    const W = box.clientWidth, H = box.clientHeight;
    // Anchor: the face, or the middle of the screen if no face is visible yet.
    // Cards glide after the face and ignore small wobbles, so they stay easy to read and tap.
    const tU = face.found ? Math.max(face.unit, H * 0.16) : H * 0.22;
    const tx = face.found ? face.x : W / 2, ty = face.found ? face.y : H * 0.55;
    if (!ar.anchor) ar.anchor = { x: tx, y: ty, u: tU };
    const A = ar.anchor, dead = A.u * 0.06;
    if (Math.hypot(tx - A.x, ty - A.y) > dead || Math.abs(tU - A.u) > dead) {
      A.x += (tx - A.x) * 0.18; A.y += (ty - A.y) * 0.18; A.u += (tU - A.u) * 0.18;
    }
    const U = A.u, ax = A.x, ay = A.y;

    // Keep cards between the question (top) and the buttons (bottom)
    const qRect = $("questionText").getBoundingClientRect(), bRect = box.getBoundingClientRect();
    const topLimit = qRect.bottom - bRect.top + 12;
    const bottomLimit = $("finishBtn").closest(".quiz-foot").getBoundingClientRect().top - bRect.top - 12;
    document.querySelectorAll(".screen-quiz.ar .option").forEach((el) => {
      const w = el.offsetWidth, h = el.offsetHeight;
      let x = ax, y = ay;
      // Cards sit around the head: above the eyebrows, beside the ears, below the chin.
      switch (el.dataset.dir) {
        case "up":    y = ay - U * 0.55 - h / 2; break;
        case "down":  y = ay + U * 1.2 + h / 2; break;
        case "left":  x = ax - U * 0.95 - w / 2; y = ay + U * 0.25; break;
        case "right": x = ax + U * 0.95 + w / 2; y = ay + U * 0.25; break;
      }
      x = Math.min(Math.max(x, w / 2 + 16), W - w / 2 - 16);
      if (el.dataset.dir === "up") y = Math.max(Math.min(y, ay - U * 0.4 - h / 2), topLimit + h / 2);
      y = Math.min(Math.max(y, topLimit + h / 2), bottomLimit - h / 2);
      el.style.left = Math.round(x) + "px"; el.style.top = Math.round(y) + "px";
    });

    // Too close / too high in the frame: the "up" card can't fit above the eyebrows
    const upCard = document.querySelector('.screen-quiz.ar .option[data-dir="up"]');
    const tooClose = face.found && upCard && (ay - U * 0.4 - upCard.offsetHeight) < topLimit - 4;

    // A visible face counts as activity for the idle timer
    if (face.found && now - ar.lastIdleBump > 2000) { ar.lastIdleBump = now; resetIdle(); }

    // Choosing: head back to neutral first, then hold a direction
    if (!advancing && !ar.armed && ARTracker.neutral()) ar.armed = true;
    const active = ar.armed && !advancing ? dir : null;
    if (active !== ar.holdDir) { ar.holdDir = active; ar.holdStart = now; }
    const progress = active ? Math.min((now - ar.holdStart) / C.ar.holdMs, 1) : 0;
    document.querySelectorAll(".screen-quiz.ar .option").forEach((el) => {
      const on = el.dataset.dir === active;
      el.classList.toggle("holding", on);
      el.style.setProperty("--hold", on ? progress : 0);
    });
    if (active && progress >= 1) {
      const el = document.querySelector(`.screen-quiz.ar .option[data-dir="${active}"]`);
      ar.armed = false; ar.holdDir = null;
      if (el) choose(Number(el.dataset.index));
    }

    // Hint
    let hint = "";
    if (!face.found) hint = C.quiz.hintNoFace;
    else if (tooClose) hint = C.quiz.hintStepBack;
    else if (!ar.armed && !advancing && state.answers[state.q] !== undefined && state.q === C.questions.length - 1) hint = "";
    else if (!ar.armed && !advancing) hint = C.quiz.hintReset;
    else if (state.q === 0 && state.answers[0] === undefined) hint = C.quiz.hintStart;
    if ($("arHint").textContent !== hint) $("arHint").textContent = hint;
    $("arHint").hidden = !hint;

    if (DEBUG) {
      $("arDebug").hidden = false;
      $("arDebug").textContent = `face ${face.found ? "yes" : "no"}  roll ${face.roll.toFixed(1)}°  turn ${face.turn.toFixed(2)}  ` +
        `look ${(face.pitch - (face.base ?? face.pitch)).toFixed(3)}  dir ${dir || "-"}  armed ${ar.armed}`;
    }
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ---------- idle timeout ----------
  let idleTimer = null, idleTick = null;
  function resetIdle() {
    clearTimeout(idleTimer);
    if (state.screen === "welcome" || !C) return;
    if (state.screen === "loading") return;     // never time out while the portrait is being made
    const secs = state.screen === "result" ? C.kiosk.resultIdleSeconds : C.kiosk.idleSeconds;
    idleTimer = setTimeout(showIdle, Math.max(secs - 10, 5) * 1000);
  }
  function showIdle() {
    let n = 10;
    $("idleCount").textContent = n;
    $("idle").hidden = false;
    idleTick = setInterval(() => {
      n--; $("idleCount").textContent = n;
      if (n <= 0) resetAll();
    }, 1000);
  }
  function hideIdle() { clearInterval(idleTick); $("idle").hidden = true; }

  // ---------- events ----------
  document.addEventListener("pointerdown", () => { if ($("idle").hidden) resetIdle(); }, { passive: true });
  document.addEventListener("click", (e) => {
    const opt = e.target.closest(".option");
    if (opt) return choose(Number(opt.dataset.index));
    const btn = e.target.closest("[data-action]");
    if (!btn || btn.disabled) return;
    switch (btn.dataset.action) {
      case "start": show("consent"); break;
      case "home": resetAll(); break;
      case "agree":
        show("photo"); startCamera();
        if (C.ar?.enabled) ARTracker.load().catch((e) => console.warn("Face tracking unavailable:", e.message));
        break;
      case "take": countdownAndCapture(); break;
      case "retake": if (state.stream) setPhotoMode("live"); else startCamera(); break;
      case "continue": startQuiz(); break;
      case "quiz-back":
        if (state.q > 0) { state.q--; renderQuestion(); }
        else { stopAR(); show("photo"); setPhotoMode("review"); }
        break;
      case "finish": finish(); break;
      case "restart": resetAll(); break;
      case "retry": finish(); break;
      case "still-here": hideIdle(); resetIdle(); break;
    }
  });
  // Staff shortcuts: F = fullscreen, Esc = back to the welcome screen
  document.addEventListener("keydown", (e) => {
    if (e.key === "f" || e.key === "F") {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {});
    }
    if (e.key === "Escape") resetAll();
  });
  document.addEventListener("contextmenu", (e) => e.preventDefault());   // no long-press menus on touchscreens

  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // ---------- boot ----------
  (async function init() {
    C = await (await fetch("content.json", { cache: "no-cache" })).json();
    const st = await Portrait.status();
    aiOn = st.ai;
    fillText();
    buildProgress();
    $("consentText").textContent = C.consent.text;
    // Staff-only warning: the kiosk can't make portraits without the server + API key.
    if (!aiOn) {
      $("staffWarning").textContent = st.reason === "nokey" ? C.staff.noKey : C.staff.noServer;
      $("staffWarning").hidden = false;
    }
    if (hasCssImage("--art-welcome")) document.querySelector(".welcome-art").classList.add("has-art");
    document.body.dataset.ai = aiOn ? "on" : "off";
    show("welcome");
  })();
})();
