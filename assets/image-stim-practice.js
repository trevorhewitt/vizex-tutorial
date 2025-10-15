// Practice image stimulus (two pages: practice-1.html and practice-2.html)
// Uses <body data-practice="p1|p2"> to select which trial to run (no query params).
// Requires assets/util.js (window.VE) but does not rely on VE routing for next pages.

(function(){
  // ====== CONFIGURE EVERYTHING HERE ======
  // Fixation image (green X placeholder)
  const FIXATION_SRC = "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Eo_circle_green_letter-x.svg/768px-Eo_circle_green_letter-x.svg.png?20200417132944";
  const FIXATION_ALT = "Fixation cross placeholder";

  // Per-practice configuration
  // - imageSrc / imageAlt: the exact pre-selected image to show
  // - drawPage: where to send the participant after "Begin drawing" is clicked
  const PRACTICE_CONFIG = {
    p1: {
      imageSrc: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Woman_teaching_geometry.jpg/800px-Woman_teaching_geometry.jpg",
      imageAlt: "Practice 1 image (pre-selected)",
      drawPage: "practice-1-draw.html"
    },
    p2: {
      imageSrc: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/800px-Cat03.jpg",
      imageAlt: "Practice 2 image (pre-selected)",
      drawPage: "practice-2-draw.html"
    }
  };

  // Timings (ms)
  const FIXATION_MIN_MS = 5000;  // minimum fixation duration
  const FADE_AT_MS       = 17000; // stimulus starts fading at 17s
  const END_AT_MS        = 20000; // stimulus fully ends at 20s (then show "Begin drawing")
  const PRELOAD_SAFETY_CAP_MS = 30000; // cap waiting for preload

  // ====== HELPERS ======
  function esc(s){ return window.VE && VE.esc ? VE.esc(s) : String(s); }
  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function preload(src){
    return new Promise((resolve, reject)=>{
      const img = new Image();
      img.onload = ()=> resolve(true);
      img.onerror = ()=> reject(new Error("image failed to load: " + src));
      img.src = src;
    });
  }

  // ====== HTML BUILDERS ======
  function htmlStage1(){
    return `
      <div class="center-wrap stage1-wrap">
        <div class="button-bar">
          <button id="startStimBtn" class="primary">
            click here when you are ready to see the image
          </button>
        </div>
      </div>
    `;
  }

  function htmlFixation(){
    return `
      <div class="center-wrap">
        <div class="stimulus-box">
          <img id="fixImg" src="${FIXATION_SRC}" alt="${esc(FIXATION_ALT)}" />
        </div>
      </div>
    `;
  }

  function htmlStimulus(stim){
    return `
      <div class="center-wrap">
        <div class="stimulus-box">
          <img id="stimImg" src="${esc(stim.imageSrc)}" alt="${esc(stim.imageAlt)}" />
        </div>
      </div>
    `;
  }

  function htmlBeginDrawing(drawPage){
    // Minimal page: single centered button; nothing else on screen
    return `
      <div class="post-wrap">
        <div class="button-bar">
          <button id="beginDrawBtn" class="primary">Begin drawing</button>
        </div>
      </div>
    `;
  }

  // ====== MAIN ======
  document.addEventListener("DOMContentLoaded", async function(){
    const body = document.body;
    const root = document.getElementById("root");
    const practiceKey = (body.getAttribute("data-practice") || "").toLowerCase();

    // Bind / nav visibility via util.js
    if (window.VE && VE.bindNavForPage) {
      // Treat both pages as the same logical page id for consistency
      VE.bindNavForPage("image-stim-practice", {});
    }
    if (window.VE && VE.setupNavVisibility) {
      // Hide Back in experiment (allowBack:false)
      VE.setupNavVisibility({}, { allowBack: false });

      // Check m=1 in query params
      const params = VE.parseParams ? VE.parseParams() : {};
      const showNav = params.m === "1";

      const backBtn = document.getElementById("backBtn");
      const nextBtn = document.getElementById("nextBtn");

      if (backBtn) backBtn.style.display = showNav ? "" : "none";
      if (nextBtn) nextBtn.style.display = showNav ? "" : "none";
    }

    // Validate config
    const stim = PRACTICE_CONFIG[practiceKey];
    if (!stim) {
      // Fail-safe: clear UI and show error for dev; in experiment, keep blank
      root.innerHTML = `
        <div class="center-wrap"><p>Configuration error: unknown practice key "${esc(practiceKey)}".</p></div>
      `;
      return;
    }

    // Preload as soon as possible
    let imageReady = false;
    let preloadErr = null;
    preload(stim.imageSrc).then(()=> { imageReady = true; })
                          .catch(err => { preloadErr = err; });

    // ===== Stage 1: Ready button =====
    root.innerHTML = htmlStage1();

    // Optional dev footer note
    if (window.VE && VE.renderDevFooter) {
      VE.renderDevFooter({}, `practice=${practiceKey}`);
    }

    // Wait for start
    const startBtn = document.getElementById("startStimBtn");
    startBtn.addEventListener("click", async ()=>{
      // ===== Stage 2: Fixation =====
      root.innerHTML = htmlFixation();

      const tStartFix = performance.now();
      // Ensure minimum fixation duration
      const need = FIXATION_MIN_MS;
      await sleep(need);

      // If image not ready, keep waiting up to safety cap
      const tFixMaxEnd = tStartFix + PRELOAD_SAFETY_CAP_MS;
      while (!imageReady && performance.now() < tFixMaxEnd) {
        await sleep(100);
      }

      // ===== Stage 3: Stimulus (or fallback) =====
      if (preloadErr) {
        // If failed to preload, skip stimulus and go straight to Begin Drawing
        root.innerHTML = htmlBeginDrawing(stim.drawPage);
        const btn = document.getElementById("beginDrawBtn");
        btn.addEventListener("click", ()=> { location.href = stim.drawPage; });
        return;
      }

      // Show stimulus
      root.innerHTML = htmlStimulus(stim);
      const imgEl = document.getElementById("stimImg");

      // Schedule fade at 17s and end at 20s
      const timers = [];
      timers.push(setTimeout(()=> { if (imgEl) imgEl.style.opacity = "0"; }, FADE_AT_MS));
      timers.push(setTimeout(()=> {
        // After stimulus ends: show ONLY the centered "Begin drawing" button
        root.innerHTML = htmlBeginDrawing(stim.drawPage);
        const btn = document.getElementById("beginDrawBtn");
        btn.addEventListener("click", ()=> { location.href = stim.drawPage; });
      }, END_AT_MS));

      // Clean up if the user navigates away early
      window.addEventListener("beforeunload", ()=> timers.forEach(clearTimeout), { once:true });
    });
  });
})();
