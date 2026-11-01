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
  };
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
  const STEP_OF = { welcome: 0, consent: 1, photo: 1, quiz: 2, loading: 3, result: 3 };
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
    $("options").innerHTML = q.options.map((o, i) => `
      <button class="option${state.answers[state.q] === i ? " selected" : ""}" role="listitem" data-index="${i}">
        <span class="letter">${letters[i]}</span><span>${escapeHtml(o.text)}</span>
      </button>`).join("");
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
    const last = state.q === C.questions.length - 1;
    if (last) { $("finishBtn").disabled = false; return; }
    advancing = true;
    await wait(260);                 // brief highlight, then auto-advance
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
    let result;
    try {
      result = await Portrait.create(state.photo, state.career, career, { ai: aiOn, timeoutSeconds: C.kiosk.aiTimeoutSeconds });
    } finally { clearInterval(ticker); }
    if (Date.now() - started < 1800) await wait(1800 - (Date.now() - started));  // let the moment land
    if (state.screen !== "loading") return;    // reset while waiting

    state.portraitSource = result.source;
    $("portrait").src = result.src;
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
      case "agree": show("photo"); startCamera(); break;
      case "take": countdownAndCapture(); break;
      case "retake": if (state.stream) setPhotoMode("live"); else startCamera(); break;
      case "continue":
        stopCamera(); state.q = 0; state.answers = []; renderQuestion(); show("quiz"); Portrait.preload(); break;
      case "quiz-back":
        if (state.q > 0) { state.q--; renderQuestion(); }
        else { show("photo"); setPhotoMode("review"); }
        break;
      case "finish": finish(); break;
      case "restart": resetAll(); break;
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
    aiOn = await Portrait.aiAvailable();
    fillText();
    buildProgress();
    $("consentText").textContent = aiOn ? C.consent.textAi : C.consent.textLocal;
    if (hasCssImage("--art-welcome")) document.querySelector(".welcome-art").classList.add("has-art");
    document.body.dataset.ai = aiOn ? "on" : "off";
    show("welcome");
  })();
})();
