// interface_demo.js
// Tutorial version that preserves the exact app behavior,
// and gates features behind a dim/disable mask revealed step-by-step.
// Target: iPad Air 2016 Safari-ready.

(function(){
  /* ---------- square viewport fallback (JS safety net) ---------- */
  const viewport = document.getElementById('viewport');
  function enforceSquare() {
    if (!viewport) return;
    const w = viewport.offsetWidth;
    viewport.style.height = w + 'px';
    viewport.style.paddingTop = '0';
  }
  window.addEventListener('load', enforceSquare);
  window.addEventListener('resize', enforceSquare);
  window.addEventListener('orientationchange', enforceSquare);

  const MIN_COLOR_DISTANCE = 10;
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const canvas = $('#drawingCanvas');
  const ctx = canvas.getContext('2d');

  const state = {
    tool: 'draw',
    brushColor: clamp(+$('#brushColor').value, 0, 255),
    background: clamp(+$('#background').value, 0, 255),
    thickness: clamp(+$('#thickness').value, 1, 20),
    blur: +$('#blur').value,
    flipX: false,
    view: mIdentity(),
    offsetX: 0,
    offsetY: 0,
    paths: []
  };

  let drawing = false;
  let currentPath = [];
  let moveDragging = false;
  let lastMove = {x:0, y:0};
  let blurRestoreTimer = null;

  let gesture = { active:false, view0:null, p0a:null, p0b:null, c0:null };

  function clientToCanvasPx(clientX, clientY){
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top)  * (canvas.height / rect.height)
    };
  }

  /* ---------- deterministic color init (seeded) ---------- */
  (function initDeterministicColors(){
    const seed = getSeedFromParamsUsingP();
    const rand = mulberry32FromSeed(seed);

    const min = 0, max = 255;
    const INIT_MIN_DISTANCE = 64;

    let bg = Math.floor(rand() * (max - min + 1) + min);
    let fg = Math.floor(rand() * (max - min + 1) + min);
    if (Math.abs(bg - fg) < INIT_MIN_DISTANCE) {
      fg = (bg + INIT_MIN_DISTANCE) % (max + 1);
    }

    state.background = bg;
    state.brushColor = fg;
    const bgEl = $('#background');
    const fgEl = $('#brushColor');
    if (bgEl) bgEl.value = String(bg);
    if (fgEl) fgEl.value = String(fg);
    updateUnderlay();
  })();

  const history = [];
  let histIndex = -1;

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function gray(v){ v = clamp(v|0, 0, 255); return `rgb(${v},${v},${v})`; }

  function updateUnderlay(){
    const vp = document.getElementById('viewport');
    if (vp) vp.style.background = gray(state.background);
  }

  /* ---------- seeded color helpers ---------- */
  function mulberry32FromSeed(seedStr){
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) {
      h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let t = h >>> 0;
    return function() {
      t = Math.imul(t ^ (t >>> 15), 2246822507);
      t = Math.imul(t ^ (t >>> 13), 3266489909);
      return ((t ^= t >>> 16) >>> 0) / 4294967296;
    };
  }
  function getSeedFromParamsUsingP(){
    try {
      if (window.VE && typeof VE.parseParams === 'function') {
        const p = (VE.parseParams().p || '').trim();
        if (p) return p;
      } else if (typeof URLSearchParams !== 'undefined') {
        const params = new URLSearchParams(window.location.search || '');
        const p = (params.get('p') || '').trim();
        if (p) return p;
      }
    } catch(_) {}
    return 'rand_' + Math.random().toString(36).slice(2);
  }

  // 2D affine matrix utilities
  function mIdentity(){ return [1,0,0,1,0,0]; }
  function mMultiply(A,B){
    return [
      A[0]*B[0] + A[2]*B[1],  A[1]*B[0] + A[3]*B[1],
      A[0]*B[2] + A[2]*B[3],  A[1]*B[2] + A[3]*B[3],
      A[0]*B[4] + A[2]*B[5] + A[4],
      A[1]*B[4] + A[3]*B[5] + A[5]
    ];
  }
  function mTranslate(tx,ty){ return [1,0,0,1,tx,ty]; }
  function mScale(s){ return [s,0,0,s,0,0]; }
  function mRotate(theta){ var c=Math.cos(theta), s=Math.sin(theta); return [c,s,-s,c,0,0]; }
  function mApply(M,x,y){ return { x:M[0]*x + M[2]*y + M[4], y:M[1]*x + M[3]*y + M[5] }; }
  function mInvert(M){
    M = M && M.length === 6 ? M : mIdentity();
    var a=M[0], b=M[1], c=M[2], d=M[3], e=M[4], f=M[5];
    var det = a*d - b*c; if (!det) return mIdentity();
    var invDet = 1/det;
    var na =  d*invDet, nb = -b*invDet, nc = -c*invDet, nd = a*invDet;
    var ne = -(na*e + nc*f), nf = -(nb*e + nd*f);
    return [na,nb,nc,nd,ne,nf];
  }
  function mFlipXAbout(cx, cy){
    return mMultiply(mTranslate(cx,cy), mMultiply([-1,0,0,1,0,0], mTranslate(-cx,-cy)));
  }

  function saveHistory(){
    const snap = {
      tool: state.tool,
      brushColor: state.brushColor,
      background: state.background,
      thickness: state.thickness,
      blur: state.blur,
      flipX: state.flipX,
      view: (state.view && state.view.length === 6) ? state.view.slice(0) : mIdentity(),
      paths: state.paths.map(p => ({
        isErase: !!p.isErase,
        points: p.points.map(q => ({ x: q.x, y: q.y }))
      }))
    };
    history.splice(histIndex + 1);
    history.push(snap);
    histIndex = history.length - 1;
    updateUndoRedo();
  }

  function loadHistory(i){
    const h = history[i]; if(!h) return;

    state.tool = h.tool;
    state.brushColor = h.brushColor;
    state.background = h.background;
    state.thickness = h.thickness;
    state.blur = h.blur;
    state.flipX = !!h.flipX;
    state.view = (h.view && h.view.length === 6) ? h.view.slice(0) : mIdentity();
    state.paths = (h.paths || []).map(p => ({
      isErase: !!(p.isErase !== undefined ? p.isErase : p.erase),
      points: (p.points || []).map(q => ({ x:q.x, y:q.y }))
    }));

    $('#brushColor').value = state.brushColor;
    $('#background').value = state.background;
    $('#thickness').value = state.thickness;
    $('#blur').value = state.blur;

    reflectToolButtons();
    applyCanvasFilter();
    updateUnderlay();
    redraw();

    histIndex = i;
    updateUndoRedo();
  }

  function updateUndoRedo(){
    $('#undo').disabled = histIndex <= 0;
    $('#redo').disabled = histIndex >= history.length - 1;
  }
  function reflectToolButtons(){
    $$('.tool-row button[data-tool]').forEach(btn=>{
      btn.classList.toggle('selected', btn.getAttribute('data-tool') === state.tool);
    });
    $('#flipH').classList.toggle('active', state.flipX);
  }

  function redraw(){
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,w,h);

    ctx.fillStyle = gray(state.background);
    const pad = Math.max(0, (state.blur|0) * 2);
    ctx.fillRect(-pad, -pad, w + 2*pad, h + 2*pad);

    const V = (state.view && state.view.length === 6) ? state.view : mIdentity();
    ctx.setTransform(V[0], V[1], V[2], V[3], V[4], V[5]);

    for (let p of state.paths){
      drawPath(ctx, p, state.thickness);
    }
    if (drawing && currentPath.length > 1){
      drawPath(ctx, { isErase: (state.tool === 'erase'), points: currentPath }, state.thickness);
    }
  }

  function drawPath(c, obj, thickness){
    const pts = obj.points;
    if (!pts || pts.length < 2) return;

    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = obj.isErase ? gray(state.background) : gray(state.brushColor);
    c.lineWidth = thickness;
    c.lineCap = 'round';
    c.lineJoin = 'round';

    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.stroke();
  }

  function applyCanvasFilter(){
    const px = +state.blur || 0;
    canvas.style.filter = px > 0 ? `blur(${px}px)` : 'none';
  }
  function temporarilyDisableBlur(){
    canvas.style.filter = 'none';
    if (blurRestoreTimer) clearTimeout(blurRestoreTimer);
    blurRestoreTimer = setTimeout(()=>{ applyCanvasFilter(); }, 140);
  }

  function cssToCanvas(xCss, yCss){
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const px = (xCss - rect.left) * sx;
    const py = (yCss - rect.top) * sy;
    const inv = mInvert(state.view || mIdentity());
    return mApply(inv, px, py);
  }

  /* ====== UI wiring (unchanged behavior) ====== */
  $$('.tool-row button[data-tool]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      state.tool = btn.getAttribute('data-tool');
      reflectToolButtons();
    });
  });
  $('#flipH').addEventListener('click', ()=>{
    state.flipX = !state.flipX;
    const cx = canvas.width * 0.5, cy = canvas.height * 0.5;
    state.view = mMultiply(mFlipXAbout(cx, cy), state.view);
    reflectToolButtons();
    saveHistory();
    redraw();
  });
  $('#swapColors').addEventListener('click', ()=>{
    const tmp = state.brushColor;
    state.brushColor = state.background;
    state.background = tmp;
    $('#brushColor').value = state.brushColor;
    $('#background').value = state.background;
    updateUnderlay();
    saveHistory();
    redraw();
  });

  $('#brushColor').addEventListener('input', ()=>{
    let v = +$('#brushColor').value;
    const bg = +$('#background').value;
    if (Math.abs(v - bg) < MIN_COLOR_DISTANCE){
      v = v > bg ? bg + MIN_COLOR_DISTANCE : bg - MIN_COLOR_DISTANCE;
      v = clamp(v, 0, 255);
      $('#brushColor').value = v;
    }
    state.brushColor = v;
    redraw();
  });
  $('#brushColor').addEventListener('change', ()=>{ saveHistory(); });

  $('#background').addEventListener('input', ()=>{
    let v = +$('#background').value;
    const fg = +$('#brushColor').value;
    if (Math.abs(v - fg) < MIN_COLOR_DISTANCE){
      v = v > fg ? fg + MIN_COLOR_DISTANCE : fg - MIN_COLOR_DISTANCE;
      v = clamp(v, 0, 255);
      $('#background').value = v;
    }
    state.background = v;
    updateUnderlay();
    redraw();
  });
  $('#background').addEventListener('change', ()=>{ saveHistory(); });

  $('#thickness').addEventListener('input', ()=>{
    state.thickness = clamp(+$('#thickness').value, 1, 40);
    redraw();
  });
  $('#thickness').addEventListener('change', ()=>{ saveHistory(); });

  $('#blur').addEventListener('input', ()=>{
    state.blur = +$('#blur').value;
    applyCanvasFilter();
  });
  $('#blur').addEventListener('change', ()=>{ saveHistory(); });

  $('#undo').addEventListener('click', ()=>{ if (histIndex > 0) loadHistory(histIndex - 1); });
  $('#redo').addEventListener('click', ()=>{ if (histIndex < history.length - 1) loadHistory(histIndex + 1); });
  $('#clear').addEventListener('click', ()=>{
    state.paths = [];
    saveHistory();
    redraw();
  });

  // Replace with your real save/finish behavior as needed
  $('#saveButton').addEventListener('click', ()=>{ location.href = 'nextpage.html'; });

  /* Mouse */
  canvas.addEventListener('mousedown', (e)=>{
    const {clientX, clientY} = e;
    if (state.tool === 'move'){
      moveDragging = true; lastMove = {x:clientX, y:clientY}; temporarilyDisableBlur(); return;
    }
    const pt = cssToCanvas(clientX, clientY);
    drawing = true; currentPath = [pt]; temporarilyDisableBlur(); redraw();
  });
  window.addEventListener('mousemove', (e)=>{
    if (state.tool === 'move' && moveDragging){
      const dx = e.clientX - lastMove.x, dy = e.clientY - lastMove.y;
      lastMove = {x:e.clientX, y:e.clientY};
      const rect = canvas.getBoundingClientRect();
      const tx = dx * (canvas.width / rect.width);
      const ty = dy * (canvas.height / rect.height);
      state.view = mMultiply(mTranslate(tx, ty), state.view);
      temporarilyDisableBlur(); redraw(); return;
    }
    if (!drawing) return;
    const pt = cssToCanvas(e.clientX, e.clientY);
    currentPath.push(pt); temporarilyDisableBlur(); redraw();
  });
  window.addEventListener('mouseup', ()=>{
    if (state.tool === 'move' && moveDragging){ moveDragging = false; saveHistory(); return; }
    if (!drawing) return;
    state.paths.push({ isErase: (state.tool === 'erase'), points: currentPath.slice() });
    drawing = false; currentPath = []; saveHistory(); redraw();
  });

  /* Touch with 2-finger pan/zoom/rotate ONLY in Move tool */
  canvas.addEventListener('touchstart', (e)=>{
    if (!e.changedTouches || e.touches.length === 0) return;

    // Start gesture only if tool === 'move' and 2+ touches
    if (state.tool === 'move' && e.touches.length >= 2){
      const a = clientToCanvasPx(e.touches[0].clientX, e.touches[0].clientY);
      const b = clientToCanvasPx(e.touches[1].clientX, e.touches[1].clientY);
      gesture.active = true;
      gesture.view0 = (state.view && state.view.length === 6) ? state.view.slice(0) : mIdentity();
      gesture.p0a = a;
      gesture.p0b = b;
      gesture.c0 = { x:(a.x+b.x)/2, y:(a.y+b.y)/2 };
      drawing = false; currentPath = [];
      temporarilyDisableBlur();
      e.preventDefault();
      return;
    }

    // Single-finger: if move tool => start pan; else draw/erase
    const t = e.changedTouches[0];
    if (state.tool === 'move'){
      moveDragging = true; lastMove = {x:t.clientX, y:t.clientY}; temporarilyDisableBlur(); e.preventDefault(); return;
    }
    const pt = cssToCanvas(t.clientX, t.clientY);
    drawing = true; currentPath = [pt]; temporarilyDisableBlur(); redraw(); e.preventDefault();
  }, {passive:false});

  window.addEventListener('touchmove', (e)=>{
    if (!e.touches || e.touches.length === 0) return;

    if (state.tool === 'move' && gesture.active && e.touches.length >= 2){
      const a1 = clientToCanvasPx(e.touches[0].clientX, e.touches[0].clientY);
      const b1 = clientToCanvasPx(e.touches[1].clientX, e.touches[1].clientY);
      const c1 = { x:(a1.x+b1.x)/2, y:(a1.y+b1.y)/2 };

      const v0x = gesture.p0b.x - gesture.p0a.x, v0y = gesture.p0b.y - gesture.p0a.y;
      const v1x = b1.x - a1.x,            v1y = b1.y - a1.y;
      const len0 = Math.max(1e-6, Math.hypot(v0x, v0y));
      const len1 = Math.max(1e-6, Math.hypot(v1x, v1y));
      const s = clamp(len1 / len0, 0.2, 8);
      const ang0 = Math.atan2(v0y, v0x);
      const ang1 = Math.atan2(v1y, v1x);
      const dtheta = ang1 - ang0;

      let G = mTranslate(c1.x, c1.y);
      G = mMultiply(G, mRotate(dtheta));
      G = mMultiply(G, mScale(s));
      G = mMultiply(G, mTranslate(-gesture.c0.x, -gesture.c0.y));

      state.view = mMultiply(G, gesture.view0);
      temporarilyDisableBlur(); redraw(); e.preventDefault();
      return;
    }

    const t = e.changedTouches[0];
    if (state.tool === 'move' && moveDragging){
      const dx = t.clientX - lastMove.x, dy = t.clientY - lastMove.y;
      lastMove = {x:t.clientX, y:t.clientY};
      const rect = canvas.getBoundingClientRect();
      const tx = dx * (canvas.width / rect.width);
      const ty = dy * (canvas.height / rect.height);
      state.view = mMultiply(mTranslate(tx, ty), state.view);
      temporarilyDisableBlur(); redraw(); e.preventDefault(); return;
    }
    if (!drawing) return;
    const pt = cssToCanvas(t.clientX, t.clientY);
    currentPath.push(pt); temporarilyDisableBlur(); redraw(); e.preventDefault();
  }, {passive:false});

  window.addEventListener('touchend', (e)=>{
    if (state.tool === 'move' && gesture.active && e.touches.length < 2){
      gesture.active = false;
      saveHistory();
      return;
    }
    if (state.tool === 'move' && moveDragging){ moveDragging = false; saveHistory(); return; }
    if (!drawing) return;
    state.paths.push({ isErase: (state.tool === 'erase'), points: currentPath.slice() });
    drawing = false; currentPath = []; saveHistory(); redraw();
  });

  /* Init app rendering */
  reflectToolButtons();
  applyCanvasFilter();
  updateUnderlay();
  saveHistory();
  redraw();
  enforceSquare();

  /* ===========================================================
     TUTORIAL GATING (overlay + stepwise reveal)
     Steps:
       (1) canvas only (message: "welcome and drawing canvas placeholder")
       (2) reveal background & brush colour sliders
       (3) reveal swap colours button
       (4) reveal draw & erase
       (5) reveal move
       (6) reveal nothing extra (two-finger explanation only)
       (7) reveal flip
       (8) reveal undo & redo
       (9) reveal clear
       (10) reveal finish (and hide "next")
     =========================================================== */

  const overlay    = $('#tutorialOverlay');
  const titleEl    = $('#tutorialTitle');
  const bodyEl     = $('#tutorialBody');
  const tryBtn     = $('#tutorialTry');
  const nextBar    = $('#tutorialNext');
  const nextBtn    = $('#tutorialNextBtn');

  // Map each step to messages and elements that become enabled at that step.
  const steps = [
    null, // 0 unused
    { title: 'Welcome', body: 'welcome and drawing canvas placeholder', enable: [] },
    { title: 'Colours', body: 'colour placeholder', enable: ['#background', '#brushColor'] },
    { title: 'Swap Colours', body: 'swap colours placeholder', enable: ['#swapColors'] },
    { title: 'Draw & Erase', body: 'draw & erase placeholder', enable: ['[data-tool="draw"]', '[data-tool="erase"]'] },
    { title: 'Move Tool', body: 'move placeholder', enable: ['[data-tool="move"]'] },
    { title: 'Two-finger Controls', body: 'two finger controls with the move tool placeholder', enable: [] },
    { title: 'Flip', body: 'flip placeholder', enable: ['#flipH'] },
    { title: 'Undo & Redo', body: 'undo & redo placeholder', enable: ['#undo', '#redo'] },
    { title: 'Clear', body: 'clear placeholder', enable: ['#clear'] },
    { title: 'Finish', body: 'finish placeholder', enable: ['#saveButton'] },
  ];

  // Everything except the canvas is masked at the beginning.
  const maskAllSelectors = [
    '#background', '#brushColor', '#swapColors',
    '[data-tool="draw"]','[data-tool="erase"]','[data-tool="move"]','#flipH',
    '#undo','#redo','#clear','#saveButton'
  ];

  function addMask(sel){
    $$(sel).forEach(el=>{
      el.classList.add('demo-disabled');
      el.setAttribute('aria-disabled','true');
      // prevent accidental focus
      if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
        el.tabIndex = -1;
      }
    });
  }
  function removeMask(sel){
    $$(sel).forEach(el=>{
      el.classList.remove('demo-disabled');
      el.removeAttribute('aria-disabled');
      if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
        el.tabIndex = 0;
      }
    });
  }

  // Initialize: mask all
  maskAllSelectors.forEach(addMask);

  let step = 1;
  showOverlayForStep(step);

  function showOverlayForStep(s){
    const info = steps[s];
    if (!info) return;
    titleEl.textContent = info.title;
    bodyEl.textContent  = info.body;
    overlay.style.display = 'flex';
  }

  function revealForStep(s){
    const info = steps[s];
    if (!info) return;
    info.enable.forEach(removeMask);

    // After step 10 (finish revealed), hide the Next bar permanently.
    if (s >= 10) {
      nextBar.style.display = 'none';
    }
  }

  // "try it yourself" => hide overlay, show Next (except after Finish where Next is hidden)
  tryBtn.addEventListener('click', ()=>{
    overlay.style.display = 'none';
    // After first try, Next becomes available (until step 10 hides it)
    if (step < 10) nextBar.style.display = 'block';
  });

  // "next" => advance step, reveal items for the new step, show overlay with that step's message
  nextBtn.addEventListener('click', ()=>{
    // Show overlay before changing (per your flow)
    step = Math.min(step + 1, 10);
    revealForStep(step);
    showOverlayForStep(step);
    // Keep Next visible unless we just hit 10 (handled by revealForStep)
  });

  // Reveal nothing at step 1 (canvas-only), but do reveal from step 2 onwards
  // when "next" is pressed. If you want to auto-reveal step 1 (nothing), leave as-is.

  /* Accessibility nicety: pressing Escape reopens overlay (optional) */
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') {
      overlay.style.display = 'flex';
    }
  });

})();
