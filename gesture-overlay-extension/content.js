(() => {
  if (window.__gbgInjected) return;
  window.__gbgInjected = true;

  /************* DOM scaffolding *************/
  const doc = document;

  // Toast
  const toastEl = doc.createElement('div');
  toastEl.id = 'gbg-toast';
  doc.body.appendChild(toastEl);
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 1200);
  }

  // HUD panel (toggle + metrics + hints)
  const panel = doc.createElement('div');
  panel.id = 'gbg-panel';
  panel.innerHTML = `
    <div id="gbg-panel-row">
      <label id="gbg-toggle-label">
        <input type="checkbox" id="gbg-enable" checked />
        <span>Gestures</span>
      </label>
      <span id="gbg-hud">—</span>
    </div>
    <div id="gbg-metrics">
      Gestures: <span id="gbg-mCount">0</span> ·
      Acc: <span id="gbg-mAcc">0</span>% ·
      Lat: <span id="gbg-mLatency">0</span> ms
    </div>
    <div id="gbg-help">
      ◯ Reload · ←/→ Back/Forward · Z New Tab · ↑ Top · ↓ Bottom
    </div>
  `;
  doc.body.appendChild(panel);
  const hud = panel.querySelector('#gbg-hud');
  const enableCheckbox = panel.querySelector('#gbg-enable');
  function showHUD(t) { hud.textContent = t; }

  // Overlay canvas
  const overlay = doc.createElement('canvas');
  overlay.id = 'gbg-overlay';
  doc.body.appendChild(overlay);
  const ctx = overlay.getContext('2d', { alpha: true });

  // ---------- Dynamic stroke color (contrast against page background) ----------
  function parseRGB(str) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(str || '');
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3] };
  }

  function pickStrokeColor() {
    // Try <body> background first
    let cs = getComputedStyle(document.body);
    let color = cs.backgroundColor;

    // If transparent, fall back to <html>
    if (!color || color === 'rgba(0, 0, 0, 0)' || color === 'transparent') {
      cs = getComputedStyle(document.documentElement);
      color = cs.backgroundColor;
    }

    const rgb = parseRGB(color) || { r: 255, g: 255, b: 255 };

    // Rough relative luminance
    const L = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;

    // Dark background → light stroke; light background → dark stroke
    return L < 0.5 ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)';
  }

  let strokeColor = pickStrokeColor();
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = strokeColor;

  function refreshStrokeColor() {
    strokeColor = pickStrokeColor();
    ctx.strokeStyle = strokeColor;
  }

  function sizeOverlay() {
    overlay.width = window.innerWidth;
    overlay.height = window.innerHeight;
  }
  sizeOverlay();
  window.addEventListener('resize', sizeOverlay);

  const enabled = () => enableCheckbox.checked;

  /************* Metrics *************/
  const logs = [];
  let totalGestures = 0,
    successfulGestures = 0,
    totalLatency = 0;

  const mCount   = panel.querySelector('#gbg-mCount');
  const mAcc     = panel.querySelector('#gbg-mAcc');
  const mLatency = panel.querySelector('#gbg-mLatency');

  function updateStats() {
    const acc = totalGestures ? ((successfulGestures / totalGestures) * 100).toFixed(1) : 0;
    const avg = totalGestures ? (totalLatency / totalGestures).toFixed(1) : 0;
    mCount.textContent = totalGestures;
    mAcc.textContent = acc;
    mLatency.textContent = avg;
  }

  function logGesture(name, score, duration, success) {
    logs.push({
      name,
      score: +score.toFixed(3),
      duration: Math.round(duration),
      success,
      at: new Date().toISOString(),
    });
    totalGestures++;
    if (success) successfulGestures++;
    totalLatency += duration;
    updateStats();
  }

  /************* Drawing + event handlers *************/
  let drawing = false;
  let points = [];
  let gestureStartTime = 0;

  function throttle(fn, limit) {
    let t = false;
    return (...a) => {
      if (!t) {
        fn(...a);
        t = true;
        setTimeout(() => (t = false), limit);
      }
    };
  }

  function getPosFromEvent(e) {
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY, touch: true };
    }
    return { x: e.clientX, y: e.clientY, touch: false };
  }

  function startDraw(e) {
    if (!enabled()) return;
    const p = getPosFromEvent(e);
    drawing = true;
    points = [];
    gestureStartTime = performance.now();
    points.push(p);

    // Refresh stroke color at the start of each gesture
    refreshStrokeColor();

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    if (p.touch) e.preventDefault();
  }

  function moveDraw(e) {
    if (!drawing) return;
    const p = getPosFromEvent(e);
    const last = points[points.length - 1];
    const dist = Math.hypot(p.x - last.x, p.y - last.y);
    if (dist < 1.5) return;
    points.push(p);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (p.touch) e.preventDefault();
  }

  function endDraw(e) {
    if (!drawing) return;
    drawing = false;
    const duration = performance.now() - gestureStartTime;
    if (points.length > 10) {
      const { name, score } = recognize(points);
      const success = isGestureConfident(name, score);
      logGesture(name, score, duration, success);
      showHUD(`Detected: ${name} (${score.toFixed(2)})`);
      if (success) performAction(name);
      else toast('Gesture not recognized — draw bigger/clearer.');
    }
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  }

  // Listen on document so canvas never blocks interaction
  document.addEventListener('mousedown', startDraw);
  document.addEventListener('mousemove', throttle(moveDraw, 5));
  document.addEventListener('mouseup', endDraw);

  document.addEventListener('touchstart', startDraw, { passive: false });
  document.addEventListener('touchmove', throttle(moveDraw, 5), { passive: false });
  document.addEventListener('touchend', endDraw, { passive: false });
  document.addEventListener('touchcancel', endDraw, { passive: false });

  /************* $1-like Recognizer *************/
  const N = 96;
  const SQUARE = 250;
  const ORIGIN = { x: 0, y: 0 };

  function centroid(pts) {
    let x = 0,
      y = 0;
    for (const p of pts) {
      x += p.x;
      y += p.y;
    }
    return { x: x / pts.length, y: y / pts.length };
  }

  function pathLength(pts) {
    let d = 0;
    for (let i = 1; i < pts.length; i++) {
      d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return d;
  }

  function resample(pts, n = N) {
    const I = pathLength(pts) / (n - 1);
    let D = 0;
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (D + dist >= I) {
        const t = (I - D) / dist;
        const q = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
        out.push(q);
        pts.splice(i, 0, q);
        D = 0;
      } else {
        D += dist;
      }
    }
    while (out.length < n) out.push(pts[pts.length - 1]);
    return out;
  }

  // Orientation-sensitive normalization (no rotation)
  function normalize(pts) {
    let r = resample(pts.slice(), N);
    r = scaleTo(r, SQUARE);
    r = translateTo(r, ORIGIN);
    return r;
  }

  function scaleTo(pts, size = SQUARE) {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    return pts.map((p) => ({
      x: ((p.x - minX) * size) / w,
      y: ((p.y - minY) * size) / h,
    }));
  }

  function translateTo(pts, t = ORIGIN) {
    const c = centroid(pts);
    return pts.map((p) => ({ x: p.x + (t.x - c.x), y: p.y + (t.y - c.y) }));
  }

  function pathDistance(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i++) {
      d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
    }
    return d / a.length;
  }

  /************* Caret-style arrow templates: > < ^ v *************/
  function rawCaretRight() {
    // ">" : top-left → tip → bottom-left
    return [
      { x: 0.25, y: 0.2 },
      { x: 0.75, y: 0.5 },
      { x: 0.25, y: 0.8 },
    ];
  }

  function rawCaretLeft() {
    // "<" : top-right → tip → bottom-right
    return [
      { x: 0.75, y: 0.2 },
      { x: 0.25, y: 0.5 },
      { x: 0.75, y: 0.8 },
    ];
  }

  function rawCaretUp() {
    // "^" : bottom-left → tip → bottom-right
    return [
      { x: 0.2, y: 0.75 },
      { x: 0.5, y: 0.25 },
      { x: 0.8, y: 0.75 },
    ];
  }

  function rawCaretDown() {
    // "v" : top-left → tip → top-right
    return [
      { x: 0.2, y: 0.25 },
      { x: 0.5, y: 0.75 },
      { x: 0.8, y: 0.25 },
    ];
  }

  function makeTemplateFromRaw(rawPts) {
    return normalize(rawPts);
  }

  function makeReversedTemplateFromRaw(rawPts) {
    const pts = rawPts.slice().reverse();
    return normalize(pts);
  }

  function templateCircle() {
    const pts = [];
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      pts.push({ x: Math.cos(t), y: Math.sin(t) });
    }
    return normalize(pts);
  }

  function templateZ() {
    const pts = [];
    const seg = Math.floor(N / 3);
    for (let i = 0; i < seg; i++) {
      const t = i / (seg - 1);
      pts.push({ x: t, y: 0 });
    }
    for (let i = 0; i < seg; i++) {
      const t = i / (seg - 1);
      pts.push({ x: 1 - t, y: t });
    }
    for (let i = 0; i < seg; i++) {
      const t = i / (seg - 1);
      pts.push({ x: t, y: 1 });
    }
    return normalize(pts);
  }

  const TEMPLATES = [
    // > (right)
    { name: 'arrow-right', pts: makeTemplateFromRaw(rawCaretRight()) },
    { name: 'arrow-right', pts: makeReversedTemplateFromRaw(rawCaretRight()) },
    // < (left)
    { name: 'arrow-left', pts: makeTemplateFromRaw(rawCaretLeft()) },
    { name: 'arrow-left', pts: makeReversedTemplateFromRaw(rawCaretLeft()) },
    // ^ (up)
    { name: 'arrow-up', pts: makeTemplateFromRaw(rawCaretUp()) },
    { name: 'arrow-up', pts: makeReversedTemplateFromRaw(rawCaretUp()) },
    // v (down)
    { name: 'arrow-down', pts: makeTemplateFromRaw(rawCaretDown()) },
    { name: 'arrow-down', pts: makeReversedTemplateFromRaw(rawCaretDown()) },
    // Extra gestures
    { name: 'circle', pts: templateCircle() },
    { name: 'z', pts: templateZ() },
  ];

  // ---------- Thresholds to reduce false positives ----------
  const MIN_SCORE = 0.70;
  const MIN_SCORE_BY_NAME = {
    circle: 0.78,
    z: 0.78,
    'arrow-right': 0.70,
    'arrow-left': 0.70,
    'arrow-up': 0.70,
    'arrow-down': 0.70,
  };

  function isGestureConfident(name, score) {
    const perGesture = MIN_SCORE_BY_NAME[name] ?? MIN_SCORE;
    return score >= perGesture;
  }

  function isClosedCircleHeuristic(raw) {
    const pts = normalize(raw.slice());
    const first = pts[0];
    const last = pts[pts.length - 1];
    const close = Math.hypot(first.x - last.x, first.y - last.y);
    const diag = Math.hypot(SQUARE, SQUARE);
    const isClosed = close / diag < 0.12;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const w = maxX - minX;
    const h = maxY - minY;
    const aspect = w / (h || 1);
    const isRoundish = aspect > 0.65 && aspect < 1.35;

    const c = centroid(pts);
    const dists = pts.map((p) => Math.hypot(p.x - c.x, p.y - c.y));
    const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
    const sd = Math.sqrt(
      dists.reduce((a, d) => a + (d - mean) * (d - mean), 0) / dists.length
    );
    const radialCV = sd / (mean || 1);
    const circular = radialCV < 0.38;

    const len = pathLength(pts);
    const longEnough = len > SQUARE * 1.6;

    return isClosed && isRoundish && circular && longEnough;
  }

  function recognize(pts) {
    if (isClosedCircleHeuristic(pts)) {
      return { name: 'circle', score: 0.92, dist: 0 };
    }
    const np = normalize(pts.slice());
    let best = { name: 'unknown', score: 0, dist: Infinity };
    const max = Math.hypot(SQUARE, SQUARE);
    for (const t of TEMPLATES) {
      const d = pathDistance(np, t.pts);
      const s = 1 - Math.min(d / max, 1);
      if (s > best.score) best = { name: t.name, score: s, dist: d };
    }
    return best;
  }

  /************* Actions *************/
  function performAction(name) {
    switch (name) {
      case 'circle':
        toast('↻ Circle → Reload');
        location.reload();
        break;

      case 'arrow-left':
        toast('← Back');
        history.back();
        break;

      case 'arrow-right':
        toast('→ Forward');
        history.forward();
        break;

      case 'z': {
        toast('Z → New Tab: Google');
        const w = window.open('https://www.google.com', '_blank', 'noopener,noreferrer');
        if (!w) toast('Popup blocked. Allow popups for this page.');
        break;
      }

      case 'arrow-up':
        toast('↑ Up Arrow → Scroll to top');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;

      case 'arrow-down': {
        toast('↓ Down Arrow → Scroll to bottom');
        const bottom =
          document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: bottom, behavior: 'smooth' });
        break;
      }

      default:
        toast('Gesture recognized, but no action mapped.');
    }
  }

  console.log('[Gesture Shortcuts] Injected on this page.');
})();
