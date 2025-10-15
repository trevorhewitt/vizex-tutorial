// Demo drawing app for older iPad Air (2016) Safari
// Keeps exact UI. Adds aspect-ratio fallback enforcement for old Safari.

(function(){
  /* ---------- square viewport fallback (JS safety net) ---------- */
  const viewport = document.getElementById('viewport');
  function enforceSquare() {
    if (!viewport) return;

    // Always enforce a square by height = width AND neutralize the CSS fallback
    // padding-top to avoid “double height” on old Safari (no aspect-ratio support).
    const w = viewport.offsetWidth; // includes borders; stable for our layout
    viewport.style.height = w + 'px';
    viewport.style.paddingTop = '0'; // <-- critical: kill the 100% padding fallback when height is set
  }
  window.addEventListener('load', enforceSquare);
  window.addEventListener('resize', enforceSquare);
  window.addEventListener('orientationchange', enforceSquare);

  const MIN_COLOR_DISTANCE = 10;
  const $ = (sel, root=document) => root.querySelector(sel);
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
    view: mIdentity(),   // <- critical default
    offsetX: 0,          // legacy (kept for history compatibility)
    offsetY: 0,          // legacy (kept for history compatibility)
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

    /* ---------- one-off deterministic color init (like Script 1) ---------- */
  (function initDeterministicColors(){
    const seed = getSeedFromParamsUsingP();
    const rand = mulberry32FromSeed(seed);

    // 0–255 range
    const min = 0, max = 255;
    const INIT_MIN_DISTANCE = 64; // ~0.25 * 255

    let bg = Math.floor(rand() * (max - min + 1) + min);
    let fg = Math.floor(rand() * (max - min + 1) + min);

    if (Math.abs(bg - fg) < INIT_MIN_DISTANCE) {
      fg = (bg + INIT_MIN_DISTANCE) % (max + 1);
    }

    // Apply to state + sliders
    state.background = bg;
    state.brushColor = fg;
    const bgEl = $('#background');
    const fgEl = $('#brushColor');
    if (bgEl) bgEl.value = String(bg);
    if (fgEl) fgEl.value = String(fg);

    updateUnderlay(); // keep viewport underlay in sync
  })();


  const history = [];
  let histIndex = -1;

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function gray(v){ v = clamp(v|0, 0, 255); return 'rgb(' + v + ',' + v + ',' + v + ')'; }

  function updateUnderlay(){
    var vp = document.getElementById('viewport');
    if (vp) vp.style.background = gray(state.background); // matches canvas bg
  }

  /* ---------- seeded color helpers (match Script 1 behavior) ---------- */
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

  // 2D affine matrix utilities (model -> canvas pixels): [a,b,c,d,e,f]
  // x' = a*x + c*y + e;  y' = b*x + d*y + f
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
  // Flip about canvas center (pixel space)
  function mFlipXAbout(cx, cy){ return mMultiply(mTranslate(cx,cy), mMultiply([-1,0,0,1,0,0], mTranslate(-cx,-cy))); }

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

    // view matrix (fallback to identity if missing in very old snapshots)
    state.view = (h.view && h.view.length === 6) ? h.view.slice(0) : mIdentity();

    // accept both isErase (new) and erase (legacy)
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
    // overfill by 2*blur pixels (safe even if blur=0)
    var pad = Math.max(0, (state.blur|0) * 2);
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
    for (let i = 1; i < pts.length; i++) {
        c.lineTo(pts[i].x, pts[i].y);
    }
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


  /* UI wiring */
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
    // No path mutation — redraw updates colors
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
    // Do not mutate stored paths — color updates procedurally
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
    updateUnderlay();  // keep viewport underlay in sync
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

  $('#saveButton').addEventListener('click', ()=>{ location.href = 'practice-1-wait.html'; });

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

    // Single-finger: if move tool => start pan via mouse-style drag; else draw/erase
    const t = e.changedTouches[0];
    if (state.tool === 'move'){
      moveDragging = true; lastMove = {x:t.clientX, y:t.clientY}; temporarilyDisableBlur(); e.preventDefault(); return;
    }
    // draw/erase
    const pt = cssToCanvas(t.clientX, t.clientY);
    drawing = true; currentPath = [pt]; temporarilyDisableBlur(); redraw(); e.preventDefault();
  }, {passive:false});

  window.addEventListener('touchmove', (e)=>{
    if (!e.touches || e.touches.length === 0) return;

    // Ongoing gesture only if move tool and 2+ touches
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

    // Single-finger: move tool => pan; draw/erase otherwise
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
    // End gesture if fewer than 2 touches remain (only matters in Move tool)
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

  /* Init */
  reflectToolButtons();
  applyCanvasFilter();
  updateUnderlay();
  saveHistory();
  redraw();
  enforceSquare(); // final guard on first paint
})();
