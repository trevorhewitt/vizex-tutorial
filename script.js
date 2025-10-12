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
    offsetX: 0,
    offsetY: 0,
    paths: []
  };

  let drawing = false;
  let currentPath = [];
  let moveDragging = false;
  let lastMove = {x:0, y:0};
  let blurRestoreTimer = null;

  const history = [];
  let histIndex = -1;

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function gray(v){ v = clamp(v|0,0,255); return `rgb(${v},${v},${v})`; }

  function saveHistory(){
    const snap = {
      tool: state.tool,
      brushColor: state.brushColor,
      background: state.background,
      thickness: state.thickness,
      blur: state.blur,
      flipX: state.flipX,
      offsetX: state.offsetX,
      offsetY: state.offsetY,
      paths: state.paths.map(p => ({ erase: p.erase, color: p.color, points: p.points.map(q => ({x:q.x, y:q.y})) }))
    };
    history.splice(histIndex+1);
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
    state.flipX = h.flipX;
    state.offsetX = h.offsetX;
    state.offsetY = h.offsetY;
    state.paths = h.paths.map(p => ({ erase: p.erase, color: p.color, points: p.points.map(q => ({x:q.x, y:q.y})) }));
    $('#brushColor').value = state.brushColor;
    $('#background').value = state.background;
    $('#thickness').value = state.thickness;
    $('#blur').value = state.blur;
    reflectToolButtons();
    applyCanvasFilter();
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Fill with current background color
    ctx.fillStyle = gray(state.background);
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (state.flipX) {
        ctx.translate(w / 2, 0);
        ctx.scale(-1, 1);
        ctx.translate(-w / 2, 0);
    }
    ctx.translate(state.offsetX, state.offsetY);

    // Draw stored paths with live procedural colors
    for (let p of state.paths) {
        drawPath(ctx, p, state.thickness);
    }

    // Preview current path
    if (drawing && currentPath.length > 1) {
        drawPath(ctx, { erase: (state.tool === 'erase'), points: currentPath }, state.thickness);
    }

    ctx.restore();
    }


  function drawPath(c, obj, thickness){
    const pts = obj.points;
    if (!pts || pts.length < 2) return;

    // Always draw with live procedural color
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = obj.erase ? gray(state.background) : gray(state.brushColor);

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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let x = (xCss - rect.left) * scaleX;
    let y = (yCss - rect.top) * scaleY;
    if (state.flipX){ x = canvas.width - x; }
    x -= state.offsetX;
    y -= state.offsetY;
    return {x, y};
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
      state.offsetX += dx * (canvas.width / rect.width) * (state.flipX ? -1 : 1);
      state.offsetY += dy * (canvas.height / rect.height);
      temporarilyDisableBlur(); redraw(); return;
    }
    if (!drawing) return;
    const pt = cssToCanvas(e.clientX, e.clientY);
    currentPath.push(pt); temporarilyDisableBlur(); redraw();
  });
  window.addEventListener('mouseup', ()=>{
    if (state.tool === 'move' && moveDragging){ moveDragging = false; saveHistory(); return; }
    if (!drawing) return;
    state.paths.push({ erase: (state.tool === 'erase'), points: currentPath.slice() });
    drawing = false; currentPath = []; saveHistory(); redraw();
  });

  /* Touch */
  canvas.addEventListener('touchstart', (e)=>{
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    if (state.tool === 'move'){
      moveDragging = true; lastMove = {x:t.clientX, y:t.clientY}; temporarilyDisableBlur(); e.preventDefault(); return;
    }
    const pt = cssToCanvas(t.clientX, t.clientY);
    drawing = true; currentPath = [pt]; temporarilyDisableBlur(); redraw(); e.preventDefault();
  }, {passive:false});
  window.addEventListener('touchmove', (e)=>{
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    if (state.tool === 'move' && moveDragging){
      const dx = t.clientX - lastMove.x, dy = t.clientY - lastMove.y;
      lastMove = {x:t.clientX, y:t.clientY};
      const rect = canvas.getBoundingClientRect();
      state.offsetX += dx * (canvas.width / rect.width) * (state.flipX ? -1 : 1);
      state.offsetY += dy * (canvas.height / rect.height);
      temporarilyDisableBlur(); redraw(); e.preventDefault(); return;
    }
    if (!drawing) return;
    const pt = cssToCanvas(t.clientX, t.clientY);
    currentPath.push(pt); temporarilyDisableBlur(); redraw(); e.preventDefault();
  }, {passive:false});
  window.addEventListener('touchend', (e)=>{
    if (state.tool === 'move' && moveDragging){ moveDragging = false; saveHistory(); return; }
    if (!drawing) return;
    state.paths.push({ erase: (state.tool === 'erase'), points: currentPath.slice() });
    drawing = false; currentPath = []; saveHistory(); redraw();
  });

  /* Init */
  reflectToolButtons();
  applyCanvasFilter();
  saveHistory();
  redraw();
  enforceSquare(); // final guard on first paint
})();
