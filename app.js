// ========== Tiny helper UI ==========
const toastEl = document.getElementById('toast');
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 1200);
}

// ========== Canvas + drawing ==========
const canvas = document.getElementById('pad');
const ctx = canvas.getContext('2d');
ctx.lineWidth = 4;
ctx.lineJoin = 'round';
ctx.lineCap = 'round';
ctx.strokeStyle = '#8fb3ff';

let drawing = false;
let points = [];

// --- Simple gesture metrics ---
const logs = [];
let totalGestures = 0;
let successfulGestures = 0;
let totalLatency = 0;

function logGesture(name, score, duration, success) {
  logs.push({ name, score, duration, success, timestamp: new Date() });
  totalGestures++;
  if (success) successfulGestures++;
  totalLatency += duration;
  updateStats();
}
function updateStats() {
  const accuracy = successfulGestures ? ((successfulGestures / totalGestures) * 100).toFixed(1) : 0;
  const avgLatency = totalGestures ? (totalLatency / totalGestures).toFixed(1) : 0;
  document.getElementById('metrics').textContent =
    `Gestures: ${totalGestures} | Accuracy: ${accuracy}% | Avg Latency: ${avgLatency} ms`;
}
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  if (e.touches && e.touches[0]) {
    return {
      x: (e.touches[0].clientX - rect.left) * (canvas.width / rect.width),
      y: (e.touches[0].clientY - rect.top) * (canvas.height / rect.height),
    };
  } else {
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }
}
// --- Performance utilities ---
function debounce(fn, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}
// --- Performance utility ---
function throttle(fn, limit) {
  let inThrottle = false;
  return function throttled(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}
function moveDraw(e) {
  if (!drawing) return;
  const p = getPos(e);
  const last = points[points.length - 1];
  const dx = p.x - last.x;
  const dy = p.y - last.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 1.5) return; // ignore micro-movements

  points.push(p);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  e.preventDefault();
}
/* function endDraw(e) {
  if (!drawing) return;
  drawing = false;

  // Only try to recognize if we actually drew something
  if (points.length > 10) {
    const { name, score } = recognize(points);
    if (score > 0.7) {
      performAction(name);
    } else {
      toast('🤔 Gesture not recognized (try bigger/clearer)');
    }
  }
  e.preventDefault();
} */
function endDraw(e) {
  if (!drawing) return;
  drawing = false;

  const duration = performance.now() - gestureStartTime; // latency measurement

  if (points.length > 10) {
    const { name, score } = recognize(points);
    const success = score > 0.6;
    logGesture(name, score, duration, success);

    if (success) {
      performAction(name);
    } else {
      toast('🤔 Gesture not recognized (try clearer shape)');
    }
  }
  e.preventDefault();
}

let gestureStartTime = 0;

function startDraw(e) {
  if (!document.getElementById('enableToggle').checked) return;
  drawing = true;
  points = [];
  gestureStartTime = performance.now();
  const p = getPos(e);
  points.push(p);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  e.preventDefault();
}



// Mouse events
canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', throttle(moveDraw, 5));  // <-- throttled
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('mouseleave', endDraw);

// Touch events (keep passive:false so we can preventDefault while drawing)
canvas.addEventListener('touchstart', startDraw, { passive: false });
canvas.addEventListener('touchmove', throttle(moveDraw, 5), { passive: false }); // <-- throttled
canvas.addEventListener('touchend', endDraw, { passive: false });
canvas.addEventListener('touchcancel', endDraw, { passive: false });



document.getElementById('clearBtn').addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  toast('Canvas cleared');
});

// ========== Gesture recognition ($1-like) ==========
const N = 64;         // resample to N points
const SQUARE = 250;   // normalize scale
const ORIGIN = { x: 0, y: 0 };

function centroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}
function pathLength(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i-1].x;
    const dy = pts[i].y - pts[i-1].y;
    d += Math.hypot(dx, dy);
  }
  return d;
}
function resample(pts, n = N) {
  const I = pathLength(pts) / (n - 1);
  let D = 0;
  const newPts = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i-1], nxt = pts[i];
    const d = Math.hypot(nxt.x - cur.x, nxt.y - cur.y);
    if ((D + d) >= I) {
      const t = (I - D) / d;
      const q = { x: cur.x + t * (nxt.x - cur.x), y: cur.y + t * (nxt.y - cur.y) };
      newPts.push(q);
      pts.splice(i, 0, q);
      D = 0;
    } else {
      D += d;
    }
  }
  // If we fell a rounding hair short, pad last point
  while (newPts.length < n) newPts.push(pts[pts.length - 1]);
  return newPts;
}
function indicativeAngle(pts) {
  const c = centroid(pts);
  return Math.atan2(c.y - pts[0].y, c.x - pts[0].x);
}
function rotateBy(pts, angle) {
  const c = centroid(pts);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return pts.map(p => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}
function scaleTo(pts, size = SQUARE) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  return pts.map(p => ({
    x: (p.x - minX) * (size / width),
    y: (p.y - minY) * (size / height),
  }));
}
function translateTo(pts, target = ORIGIN) {
  const c = centroid(pts);
  return pts.map(p => ({ x: p.x + (target.x - c.x), y: p.y + (target.y - c.y) }));
}
function pathDistance(pts1, pts2) {
  let d = 0;
  for (let i = 0; i < pts1.length; i++) {
    d += Math.hypot(pts1[i].x - pts2[i].x, pts1[i].y - pts2[i].y);
  }
  return d / pts1.length;
}
function normalize(pts) {
  let r = resample(pts, N);
  r = rotateBy(r, -indicativeAngle(r));
  r = scaleTo(r, SQUARE);
  r = translateTo(r, ORIGIN);
  return r;
}
function templateArrow(direction = 'right') {
  // A simple arrow: shaft + small triangular head
  // We draw in a unit square then normalize (like others).
  const pts = [];
  const segs = N; // reuse the global N

  // Shaft goes horizontally across the middle
  const shaftStartX = direction === 'right' ? 0.1 : 0.9;
  const shaftEndX   = direction === 'right' ? 0.8 : 0.2;
  const yMid = 0.5;

  // shaft
  for (let i = 0; i < Math.floor(segs * 0.6); i++) {
    const t = i / (Math.floor(segs * 0.6) - 1 || 1);
    const x = shaftStartX + t * (shaftEndX - shaftStartX);
    pts.push({ x, y: yMid });
  }

  // arrow head: a small triangle at the end
  // For right: tip at (0.9, 0.5). For left: tip at (0.1, 0.5).
  const tipX = direction === 'right' ? 0.9 : 0.1;
  const baseX = shaftEndX;
  const headTopY = 0.35, headBotY = 0.65;

  // draw from shaft end -> top of head -> tip -> bottom -> back to tip (suggesting a point)
  const headPts = direction === 'right'
    ? [
        { x: baseX, y: yMid },
        { x: baseX - 0.15, y: headTopY },
        { x: tipX, y: yMid },
        { x: baseX - 0.15, y: headBotY },
        { x: tipX, y: yMid },
      ]
    : [
        { x: baseX, y: yMid },
        { x: baseX + 0.15, y: headTopY },
        { x: tipX, y: yMid },
        { x: baseX + 0.15, y: headBotY },
        { x: tipX, y: yMid },
      ];
  pts.push(...headPts);

  return normalize(pts);
}

// Create simple template generators
function templateLine(direction = 'right', len = 1) {
  const pts = [];
  const steps = N;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    let x = t * len, y = 0;
    if (direction === 'left') x = (1 - t) * len;
    pts.push({ x, y });
  }
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
  // top horizontal (left to right)
  for (let i = 0; i < seg; i++) {
    const t = i / (seg - 1);
    pts.push({ x: t, y: 0 });
  }
  // diagonal (right-top to left-bottom)
  for (let i = 0; i < seg; i++) {
    const t = i / (seg - 1);
    pts.push({ x: 1 - t, y: t });
  }
  // bottom horizontal (left to right)
  for (let i = 0; i < seg; i++) {
    const t = i / (seg - 1);
    pts.push({ x: t, y: 1 });
  }
  return normalize(pts);
}



// Prepare templates
const TEMPLATES = [
  { name: 'line-right', pts: templateLine('right') },
  { name: 'line-left', pts: templateLine('left') },
  { name: 'arrow-right', pts: templateArrow('right') },
  { name: 'arrow-left',  pts: templateArrow('left')  },
  { name: 'circle', pts: templateCircle() },
  { name: 'z', pts: templateZ() },
];

function isClosedCircleHeuristic(rawPts) {
  // Work on normalized copy
  const pts = normalize(rawPts.slice());

  // 1) Closed loop: first↔last close
  const first = pts[0], last = pts[pts.length - 1];
  const close = Math.hypot(first.x - last.x, first.y - last.y);
  const diag = Math.hypot(SQUARE, SQUARE);
  const isClosed = (close / diag) < 0.12; // ~12% of square diagonal

  // 2) Roundish bounding box: width ~ height
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) { 
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX, h = maxY - minY;
  const aspect = w / (h || 1);
  const isRoundish = aspect > 0.65 && aspect < 1.35;

  // 3) Low radial variance: distances to centroid cluster tightly
  const c = centroid(pts);
  const dists = pts.map(p => Math.hypot(p.x - c.x, p.y - c.y));
  const mean = dists.reduce((a,b)=>a+b,0) / dists.length;
  const sd = Math.sqrt(dists.reduce((a,d)=>a + (d - mean)*(d - mean), 0) / dists.length);
  const radialCV = sd / (mean || 1);      // coefficient of variation
  const isCircularSpread = radialCV < 0.38; // tolerate wobble

  // 4) Sufficient path length (avoid tiny scribbles)
  const len = pathLength(pts);
  const longEnough = len > SQUARE * 1.6;

  return isClosed && isRoundish && isCircularSpread && longEnough;
}

function recognize(pts) {

    if (isClosedCircleHeuristic(pts)) {
    return { name: 'circle', score: 0.92, dist: 0 };
  }

  const np = normalize(pts.slice());
  let best = { name: 'unknown', score: 0, dist: Infinity };
  const maxPossible = Math.hypot(SQUARE, SQUARE);
  for (const t of TEMPLATES) {
    const d = pathDistance(np, t.pts);
    const score = 1 - Math.min(d / maxPossible, 1);
    if (score > best.score) best = { name: t.name, score, dist: d };
  }
  return best;

}

// ========== Map gestures to browser actions ==========
function performAction(name) {
  // Clear the strokes after performing action
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  switch (name) {
    case 'circle':
      toast('↻ Circle → Reload');
      // Reload current page
      location.reload();
      break;

    case 'line-left':
      toast('← Line Left → Back');
      // Navigate back in history (if possible)
      history.forward();
      break;

    case 'line-right':
      toast('→ Line Right → Forward');
      // Navigate forward (if possible)
      
      history.back();
      break;

    case 'arrow-left':
        toast('← Arrow Left → Back');
        history.back();
        break;

    case 'arrow-right':
        toast('→ Arrow Right → Forward');
        history.forward();
        break;
    
     case 'z':
        toast('Z → New Tab: Google');
        // Open Google in a new tab (safer with noopener/noreferrer)
        const url = 'https://www.google.com';
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        if (!w) {
            toast('Popup blocked. Allow popups for this page to open a new tab.');
         // Optional fallback: open in same tab if blocked
            // location.assign(url);
  }
  break;

  }
}
function summarizeSession() {
  const accuracy = ((successfulGestures / totalGestures) * 100).toFixed(1);
  const avgLatency = (totalLatency / totalGestures).toFixed(1);
  console.table(logs.slice(-5)); // show last 5 gestures
  alert(`Session Summary:
  Total Gestures: ${totalGestures}
  Accuracy: ${accuracy}%
  Avg Input-to-Action Latency: ${avgLatency} ms`);
}

// Enable/disable toggle just blocks drawing start
document.getElementById('enableToggle').addEventListener('change', (e) => {
  toast(e.target.checked ? 'Gestures enabled' : 'Gestures disabled');
});
