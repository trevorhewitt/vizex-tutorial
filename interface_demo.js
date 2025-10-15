// interface_demo.js
// iPad Air (2016) Safari–safe tutorial using an absolute, JS-positioned overlay layer
// + real rectangular mask boxes. Includes an added step for "brush softness & size" before draw/erase.

// ---------- square viewport fallback for old Safari ----------
(function(){
  const viewport = document.getElementById('viewport');
  function enforceSquare(){
    if (!viewport) return;
    const w = viewport.offsetWidth;
    viewport.style.height = w + 'px';
    viewport.style.paddingTop = '0';
  }
  window.addEventListener('load', enforceSquare);
  window.addEventListener('resize', enforceSquare);
  window.addEventListener('orientationchange', enforceSquare);
})();

/* ===== Utilities ===== */
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const clamp = (v,lo,hi)=>Math.max(lo, Math.min(hi, v));
const gray = (v)=>`rgb(${v|0},${v|0},${v|0})`;

/* ===== Drawing app (kept identical in behavior) ===== */
(function(){
  const canvas = $('#drawingCanvas');
  const ctx = canvas.getContext('2d');

  const state = {
    tool: 'draw',
    brushColor: clamp(+$('#brushColor').value, 0, 255),
    background: clamp(+$('#background').value, 0, 255),
    thickness: clamp(+$('#thickness').value, 1, 60),
    blur: +$('#blur').value,
    view: [1,0,0,1,0,0],
    paths: []
  };

  // seeded colors for consistent start
  (function initColors(){
    const seed = getSeed();
    const rnd = mulberry32(seed);
    let bg = Math.floor(rnd()*256), fg = Math.floor(rnd()*256);
    if (Math.abs(bg - fg) < 64) fg = (bg + 64) % 256;
    state.background = bg; state.brushColor = fg;
    $('#background').value = String(bg);
    $('#brushColor').value = String(fg);
    updateUnderlay();
  })();

  function getSeed(){
    try{
      if (window.VE?.parseParams){ const p=(VE.parseParams().p||'').trim(); if (p) return p; }
      const q=new URLSearchParams(location.search||''); const p=(q.get('p')||'').trim();
      return p || 'rand_' + Math.random().toString(36).slice(2);
    }catch(_){ return 'rand_' + Math.random().toString(36).slice(2); }
  }
  function mulberry32(s){
    let h=1779033703 ^ s.length;
    for(let i=0;i<s.length;i++){ h=Math.imul(h ^ s.charCodeAt(i),3432918353); h=(h<<13)|(h>>>19); }
    let t=h>>>0;
    return function(){ t=Math.imul(t^(t>>>15),2246822507); t=Math.imul(t^(t>>>13),3266489909); return ((t^=t>>>16)>>>0)/4294967296; };
  }

  // matrix utils
  const I=[1,0,0,1,0,0];
  const mMul=(A,B)=>[A[0]*B[0]+A[2]*B[1],A[1]*B[0]+A[3]*B[1],A[0]*B[2]+A[2]*B[3],A[1]*B[2]+A[3]*B[3],A[0]*B[4]+A[2]*B[5]+A[4],A[1]*B[4]+A[3]*B[5]+A[5]];
  const mTr=(tx,ty)=>[1,0,0,1,tx,ty];
  const mInv=M=>{const[a,b,c,d,e,f]=M||I; const det=a*d-b*c; if(!det) return I; const k=1/det; const na=d*k,nb=-b*k,nc=-c*k,nd=a*k,ne=-(na*e+nc*f),nf=-(nb*e+nd*f); return [na,nb,nc,nd,ne,nf];};
  const mAp=(M,x,y)=>({x:M[0]*x+M[2]*y+M[4], y:M[1]*x+M[3]*y+M[5]});
  const flipAbout=(cx,cy)=>mMul(mTr(cx,cy), mMul([-1,0,0,1,0,0], mTr(-cx,-cy)));

  // history
  const hist=[]; let hi=-1;
  function saveHistory(){
    const snap = {
      tool: state.tool, brushColor: state.brushColor, background: state.background,
      thickness: state.thickness, blur: state.blur, view: state.view.slice(0),
      paths: state.paths.map(p=>({isErase:p.isErase, points:p.points.map(q=>({x:q.x,y:q.y}))}))
    };
    hist.splice(hi+1); hist.push(snap); hi=hist.length-1; updateUndoRedo();
  }
  function loadHistory(i){
    const h=hist[i]; if(!h) return;
    Object.assign(state, { tool:h.tool, brushColor:h.brushColor, background:h.background, thickness:h.thickness, blur:h.blur, view:h.view.slice(0), paths:h.paths.map(p=>({isErase:p.isErase, points:p.points.map(q=>({x:q.x,y:q.y}))})) });
    $('#brushColor').value=state.brushColor; $('#background').value=state.background; $('#thickness').value=state.thickness; $('#blur').value=state.blur;
    reflectTools(); applyBlur(); updateUnderlay(); redraw();
    hi=i; updateUndoRedo();
  }
  function updateUndoRedo(){ $('#undo').disabled = hi<=0; $('#redo').disabled = hi>=hist.length-1; }

  // UI wiring
  function reflectTools(){ $$('.tool-row button[data-tool]').forEach(b=>b.classList.toggle('selected', b.getAttribute('data-tool')===state.tool)); }
  $('#flipH').addEventListener('click', ()=>{
    const cx=canvas.width*0.5, cy=canvas.height*0.5;
    state.view = mMul(flipAbout(cx,cy), state.view);
    saveHistory(); redraw();
  });
  $$('.tool-row button[data-tool]').forEach(btn=>btn.addEventListener('click', ()=>{ state.tool=btn.getAttribute('data-tool'); reflectTools(); }));

  $('#swapColors').addEventListener('click', ()=>{
    const t=state.brushColor; state.brushColor=state.background; state.background=t;
    $('#brushColor').value=state.brushColor; $('#background').value=state.background;
    updateUnderlay(); saveHistory(); redraw();
  });

  $('#brushColor').addEventListener('input', ()=>{
    let v=+$('#brushColor').value, bg=+$('#background').value;
    if (Math.abs(v-bg)<10){ v = v>bg ? bg+10 : bg-10; v=clamp(v,0,255); $('#brushColor').value=v; }
    state.brushColor=v; redraw();
  });
  $('#brushColor').addEventListener('change', saveHistory);

  $('#background').addEventListener('input', ()=>{
    let v=+$('#background').value, fg=+$('#brushColor').value;
    if (Math.abs(v-fg)<10){ v = v>fg ? fg+10 : fg-10; v=clamp(v,0,255); $('#background').value=v; }
    state.background=v; updateUnderlay(); redraw();
  });
  $('#background').addEventListener('change', saveHistory);

  $('#thickness').addEventListener('input', ()=>{ state.thickness=clamp(+$('#thickness').value,1,60); redraw(); });
  $('#thickness').addEventListener('change', saveHistory);

  function applyBlur(){ const px=+state.blur||0; canvas.style.filter = px>0 ? `blur(${px}px)` : 'none'; }
  $('#blur').addEventListener('input', ()=>{ state.blur=+$('#blur').value; applyBlur(); });
  $('#blur').addEventListener('change', saveHistory);

  $('#undo').addEventListener('click', ()=>{ if (hi>0) loadHistory(hi-1); });
  $('#redo').addEventListener('click', ()=>{ if (hi<hist.length-1) loadHistory(hi+1); });
  $('#clear').addEventListener('click', ()=>{ state.paths=[]; saveHistory(); redraw(); });
  $('#saveButton').addEventListener('click', ()=>{ location.href='nextpage.html'; });

  function updateUnderlay(){ const vp=$('#viewport'); if (vp) vp.style.background = gray(state.background); }

  // drawing
  let drawing=false, curr=[];
  let moveDragging=false, last={x:0,y:0};
  let gesture={ active:false, view0:null, p0a:null, p0b:null, c0:null };

  function cssToCanvas(x,y){
    const r=canvas.getBoundingClientRect();
    const px=(x-r.left)*(canvas.width/r.width), py=(y-r.top)*(canvas.height/r.height);
    return mAp(mInv(state.view), px, py);
  }

  canvas.addEventListener('mousedown', e=>{
    if (state.tool==='move'){ moveDragging=true; last={x:e.clientX,y:e.clientY}; return; }
    drawing=true; curr=[cssToCanvas(e.clientX,e.clientY)]; redraw();
  });
  window.addEventListener('mousemove', e=>{
    if (state.tool==='move' && moveDragging){
      const r=canvas.getBoundingClientRect();
      state.view = mMul(mTr((e.clientX-last.x)*(canvas.width/r.width), (e.clientY-last.y)*(canvas.height/r.height)), state.view);
      last={x:e.clientX,y:e.clientY}; redraw(); return;
    }
    if (!drawing) return;
    curr.push(cssToCanvas(e.clientX,e.clientY)); redraw();
  });
  window.addEventListener('mouseup', ()=>{
    if (state.tool==='move' && moveDragging){ moveDragging=false; saveHistory(); return; }
    if (!drawing) return;
    state.paths.push({ isErase:(state.tool==='erase'), points: curr.slice() });
    drawing=false; curr=[]; saveHistory(); redraw();
  });

  canvas.addEventListener('touchstart', e=>{
    if (state.tool==='move' && e.touches.length>=2){
      const a=clientPx(e.touches[0]), b=clientPx(e.touches[1]);
      gesture={ active:true, view0:state.view.slice(0), p0a:a, p0b:b, c0:{x:(a.x+b.x)/2,y:(a.y+b.y)/2} };
      e.preventDefault(); return;
    }
    const t=e.changedTouches[0]; if(!t) return;
    if (state.tool==='move'){ moveDragging=true; last={x:t.clientX,y:t.clientY}; e.preventDefault(); return; }
    drawing=true; curr=[cssToCanvas(t.clientX,t.clientY)]; redraw(); e.preventDefault();
  }, {passive:false});
  window.addEventListener('touchmove', e=>{
    if (state.tool==='move' && gesture.active && e.touches.length>=2){
      // simple pan/scale/rotate (kept minimal for brevity)
      const a=clientPx(e.touches[0]), b=clientPx(e.touches[1]), c={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      const v0={x:gesture.p0b.x-gesture.p0a.x,y:gesture.p0b.y-gesture.p0a.y};
      const v1={x:b.x-a.x,y:b.y-a.y};
      const s=clamp(Math.hypot(v1.x,v1.y)/Math.max(1e-6,Math.hypot(v0.x,v0y= v0.y)),0.2,8); // tiny guard
      const ang0=Math.atan2(v0.y,v0.x), ang1=Math.atan2(v1.y,v1.x), dtheta=ang1-ang0;
      // compose around center
      let M=[1,0,0,1,0,0];
      M=mMul(M,[1,0,0,1,c.x,c.y]); // translate to center
      const cth=Math.cos(dtheta), sth=Math.sin(dtheta);
      M=mMul(M,[cth,sth,-sth,cth,0,0]); // rotate
      M=mMul(M,[s,0,0,s,0,0]);          // scale
      M=mMul(M,[1,0,0,1,-gesture.c0.x,-gesture.c0.y]);
      state.view = mMul(M, gesture.view0);
      redraw(); e.preventDefault(); return;
    }
    const t=e.changedTouches[0]; if(!t) return;
    if (state.tool==='move' && moveDragging){
      const r=canvas.getBoundingClientRect();
      state.view = mMul(mTr((t.clientX-last.x)*(canvas.width/r.width), (t.clientY-last.y)*(canvas.height/r.height)), state.view);
      last={x:t.clientX,y:t.clientY}; redraw(); e.preventDefault(); return;
    }
    if (!drawing) return;
    curr.push(cssToCanvas(t.clientX,t.clientY)); redraw(); e.preventDefault();
  }, {passive:false});
  window.addEventListener('touchend', e=>{
    if (state.tool==='move' && gesture.active && e.touches.length<2){ gesture.active=false; saveHistory(); return; }
    if (state.tool==='move' && moveDragging){ moveDragging=false; saveHistory(); return; }
    if (!drawing) return;
    state.paths.push({ isErase:(state.tool==='erase'), points: curr.slice() });
    drawing=false; curr=[]; saveHistory(); redraw();
  });

  function clientPx(t){
    const r=canvas.getBoundingClientRect();
    return { x:(t.clientX-r.left)*(canvas.width/r.width), y:(t.clientY-r.top)*(canvas.height/r.height) };
  }

  function drawPath(g, obj){
    const pts=obj.points; if(!pts || pts.length<2) return;
    g.globalCompositeOperation='source-over';
    g.strokeStyle = obj.isErase ? gray(state.background) : gray(state.brushColor);
    g.lineWidth = state.thickness; g.lineCap='round'; g.lineJoin='round';
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y); for (let i=1;i<pts.length;i++) g.lineTo(pts[i].x, pts[i].y); g.stroke();
  }
  function redraw(){
    const w=canvas.width, h=canvas.height;
    ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,w,h);
    ctx.fillStyle = gray(state.background); ctx.fillRect(0,0,w,h);
    const V=state.view; ctx.setTransform(V[0],V[1],V[2],V[3],V[4],V[5]);
    for (const p of state.paths) drawPath(ctx,p);
    if (drawing && curr.length>1) drawPath(ctx,{isErase:(state.tool==='erase'), points:curr});
  }

  // init
  reflectTools(); updateUndoRedo(); applyBlur(); updateUnderlay(); saveHistory(); redraw();
})();

/* ===== Tutorial system: absolute overlay + mask rectangles ===== */
(function(){
  const layer    = $('#tutorialLayer');
  const maskRoot = $('#maskLayer');
  const dialog   = $('#dialogLayer');
  const nextBar  = $('#footerLayer');
  const nextBtn  = $('#tutorialNext');
  const tryBtn   = $('#tutorialTry');
  const titleEl  = $('#tutorialTitle');
  const bodyEl   = $('#tutorialBody');

  // Full set of controllable selectors we may mask
  const ALL_TARGETS = [
    '#background', '#brushColor', '#swapColors',
    '#blur', '#thickness',
    '#btnDraw', '#btnErase', '#btnMove', '#flipH',
    '#undo', '#redo', '#clear', '#saveButton'
  ];

  // 10-step flow (with added Softness/Size before Draw/Erase, and grouping Undo/Redo/Clear)
  const STEPS = {
    1:  { title:'Welcome', body:'welcome and drawing canvas placeholder', unlock:[] },
    2:  { title:'Colours', body:'colour placeholder', unlock:['#background','#brushColor'] },
    3:  { title:'Swap colours', body:'swap colours placeholder', unlock:['#swapColors'] },
    4:  { title:'Brush softness & size', body:'adjust softness and brush size', unlock:['#blur','#thickness'] },
    5:  { title:'Draw & erase', body:'draw & erase placeholder', unlock:['#btnDraw','#btnErase'] },
    6:  { title:'Move tool', body:'move placeholder', unlock:['#btnMove'] },
    7:  { title:'Two-finger controls', body:'use two fingers to pan/zoom/rotate while in Move', unlock:[] },
    8:  { title:'Flip', body:'flip placeholder', unlock:['#flipH'] },
    9:  { title:'Undo, Redo & Clear', body:'history and clear controls', unlock:['#undo','#redo','#clear'] },
    10: { title:'Finish', body:'finish placeholder', unlock:['#saveButton'] }
  };

  let step = 1;
  const unlocked = new Set(); // tracks which controls are active

  // start masked
  applyDisableState(); drawMasks();
  showStep(step);

  // Interactions
  tryBtn.addEventListener('click', ()=>{ hideDialog(); if (step < 10) showNextBar(); });
  nextBtn.addEventListener('click', ()=>{
    step = Math.min(step+1, 10);
    (STEPS[step].unlock || []).forEach(sel=>unlocked.add(sel));
    applyDisableState();
    drawMasks();
    showStep(step);      // overlay shows again with next message
    hideNextBar();
  });

  // Recompute overlay sizing/positions on window changes
  ['scroll','resize','orientationchange'].forEach(ev=>window.addEventListener(ev, repositionOverlay, {passive:true}));
  function repositionOverlay(){
    // cover the current window viewport (no fixed)
    layer.style.left   = window.scrollX + 'px';
    layer.style.top    = window.scrollY + 'px';
    layer.style.width  = window.innerWidth + 'px';
    layer.style.height = window.innerHeight + 'px';
    drawMasks(); // masked rects need to move with layout/scroll
  }
  repositionOverlay();

  // ---- masking logic ----
  function applyDisableState(){
    // everything disabled unless explicitly unlocked
    for (const sel of ALL_TARGETS){
      const enable = unlocked.has(sel);
      $$(sel).forEach(el=>{
        if (enable){
          el.removeAttribute('disabled');
          el.removeAttribute('aria-disabled');
          el.style.pointerEvents = '';
        } else {
          el.setAttribute('disabled','true');
          el.setAttribute('aria-disabled','true');
          // pointer events still blocked by mask rectangles; this prevents focus via keyboard
          el.style.pointerEvents = 'none';
        }
      });
    }
  }

  function drawMasks(){
    // Clear existing masks
    maskRoot.innerHTML = '';
    // Build a dark box for every disabled target (sliders become full grey blocks)
    const disabled = ALL_TARGETS.filter(sel => !unlocked.has(sel));
    disabled.forEach(sel=>{
      $$(sel).forEach(el=>{
        const r = el.getBoundingClientRect();
        // Skip if not in viewport (optional)
        if (r.width <= 0 || r.height <= 0) return;
        const m = document.createElement('div');
        m.className = 'mask-rect';
        // position relative to tutorialLayer (which is aligned to window)
        m.style.left   = (r.left - window.scrollX) + 'px';
        m.style.top    = (r.top  - window.scrollY) + 'px';
        m.style.width  = r.width  + 'px';
        m.style.height = r.height + 'px';
        maskRoot.appendChild(m);
      });
    });

    // Special case: also mask the labels above disabled sliders/buttons
    // (find the closest .slider-group and cover its label area if its input is disabled)
    disabled.forEach(sel=>{
      $$(sel).forEach(el=>{
        const sg = el.closest('.slider-group');
        if (!sg) return;
        const label = sg.querySelector('.label-text');
        if (!label) return;
        const lr = label.getBoundingClientRect();
        const m = document.createElement('div');
        m.className = 'mask-rect';
        m.style.left   = (lr.left - window.scrollX) + 'px';
        m.style.top    = (lr.top  - window.scrollY) + 'px';
        m.style.width  = lr.width  + 'px';
        m.style.height = lr.height + 'px';
        maskRoot.appendChild(m);
      });
    });
  }

  // ---- dialog & footer ----
  function showDialog(){ dialog.style.display = 'block'; }
  function hideDialog(){ dialog.style.display = 'none'; }
  function showNextBar(){
    nextBar.style.display = (step < 10) ? 'block' : 'none';
    // place it along the bottom of the visible window
    footerReflow();
  }
  function hideNextBar(){ nextBar.style.display = 'none'; }
  function footerReflow(){
    const pad = 8;
    nextBar.style.left   = window.scrollX + 'px';
    nextBar.style.top    = (window.scrollY + window.innerHeight - ($('#footerInner').offsetHeight || 60) - pad) + 'px';
    nextBar.style.width  = window.innerWidth + 'px';
  }
  window.addEventListener('resize', footerReflow);
  window.addEventListener('scroll', footerReflow);
  window.addEventListener('orientationchange', footerReflow);

  function showStep(n){
    const s = STEPS[n];
    titleEl.textContent = s.title || '';
    bodyEl.textContent  = s.body || '';
    showDialog();
    if (n === 10){ hideNextBar(); } // finish: user must tap "finish"
  }

  // unlock everything for step 1? no — only canvas. Subsequent steps:
  (STEPS[1].unlock||[]).forEach(sel=>unlocked.add(sel));

  // initial state: everything else disabled & masked
  drawMasks();

})();
