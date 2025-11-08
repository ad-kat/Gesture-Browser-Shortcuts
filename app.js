/************* Toast + HUD *************/
const toastEl = document.getElementById('toast');
function toast(msg){ toastEl.textContent = msg; toastEl.classList.add('show'); setTimeout(()=>toastEl.classList.remove('show'), 1200); }
const hud = document.getElementById('hud');
function showHUD(t){ hud.textContent = t; }

/************* Simple SPA (tabs) *************/
const app = document.getElementById('app');
const navlinks = document.querySelectorAll('.navlink, .cta, .cats a');
function card(title, price, tag){
  return `<article class="card">
    <div class="thumb"></div>
    <h4>${title}</h4>
    ${tag ? `<span class="badge">${tag}</span>` : ``}
    <div class="price">$${price}</div>
    <div class="actions">
      <button>Add</button><button>Details</button>
    </div>
  </article>`;
}
const VIEWS = {
  home: () => `
    <section>
      <h3>Popular Now</h3>
      <div class="grid">
        ${card('Golden Asian Pears (4 ct)', 6.99, 'Fresh')}
        ${card('Matcha Milk Tea (6-pack)', 12.49)}
        ${card('Spicy Seaweed Crisps', 3.99)}
        ${card('Udon Family Pack', 7.49)}
      </div>
    </section>
  `,
  fresh: () => `
    <h3>Fresh Produce</h3>
    <div class="grid">
      ${card('Crisp Fuji Apples (3 lb)', 5.99, 'Today\'s pick')}
      ${card('Shanghai Bok Choy (1 lb)', 2.79)}
      ${card('Korean Strawberries (1 lb)', 8.49)}
      ${card('Thai Basil Bunch', 1.99)}
    </div>
  `,
  snacks: () => `
    <h3>Snacks & Sweets</h3>
    <div class="grid">
      ${card('Pocky Variety Box', 9.99)}
      ${card('Honey Butter Chips', 2.99)}
      ${card('Sesame Mochi (8 ct)', 6.49)}
      ${card('Taro Wafer Rolls', 3.49)}
    </div>
  `,
  beverages: () => `
    <h3>Beverages</h3>
    <div class="grid">
      ${card('Calpico Original (1.5L)', 4.99)}
      ${card('Yuzu Sparkling (4-pack)', 6.99)}
      ${card('Milk Tea (bottled 6-pack)', 11.49)}
    </div>
  `,
  household: () => `
    <h3>Household</h3>
    <div class="grid">
      ${card('Kitchen Towels (6-roll)', 7.99)}
      ${card('Bamboo Chopsticks (50 ct)', 3.49)}
      ${card('Dish Soap Citrus', 2.49)}
    </div>
  `,
  deals: () => `
    <h3>Deals</h3>
    <div class="grid">
      ${card('Frozen Dumplings (3-bag bundle)', 14.99, 'Bundle')}
      ${card('Oolong Tea Leafs (500g)', 9.99, '-20%')}
    </div>
  `,
  cart: () => `<h3>Your Cart</h3><p>Your cart is empty.</p>`
};
function activate(route){
  document.querySelectorAll('.navlink').forEach(a=>a.classList.toggle('active', a.getAttribute('href') === `#/${route}`));
}
function render(route){
  if(!VIEWS[route]) route='home';
  app.innerHTML = VIEWS[route]();
  activate(route);
}
function go(route){ history.pushState({route}, '', `#/${route}`); render(route); }
navlinks.forEach(a=>{
  a.addEventListener('click', e=>{
    const r = a.dataset.route; if(!r) return;
    e.preventDefault(); go(r);
  });
});
window.addEventListener('popstate', e=>{
  const r = (e.state && e.state.route) || (location.hash.replace('#/','') || 'home');
  render(r);
});
render((location.hash.replace('#/','')) || 'home');

/************* Metrics *************/
const logs=[]; let totalGestures=0, successfulGestures=0, totalLatency=0;
function updateStats(){
  const acc = totalGestures ? ((successfulGestures/totalGestures)*100).toFixed(1) : 0;
  const avg = totalGestures ? (totalLatency/totalGestures).toFixed(1) : 0;
  mCount.textContent = totalGestures; mAcc.textContent = acc; mLatency.textContent = avg;
}
function logGesture(name, score, duration, success){
  logs.push({name, score:+score.toFixed(3), duration:Math.round(duration), success, at:new Date().toISOString()});
  totalGestures++; if(success) successfulGestures++; totalLatency += duration; updateStats();
}
const mCount = document.getElementById('mCount');
const mAcc   = document.getElementById('mAcc');
const mLatency = document.getElementById('mLatency');
document.getElementById('summaryBtn').addEventListener('click', ()=>{
  console.table(logs);
  alert(`Session Summary:
  Total Gestures: ${totalGestures}
  Accuracy: ${totalGestures?((successfulGestures/totalGestures)*100).toFixed(1):0}%
  Avg Input-to-Action Latency: ${totalGestures?(totalLatency/totalGestures).toFixed(1):0} ms`);
});

/************* Drawing onto non-blocking overlay *************/
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d', {alpha:true});
ctx.lineWidth = 4; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.strokeStyle='#2a7cf7';

function sizeOverlay(){ overlay.width = window.innerWidth; overlay.height = window.innerHeight; }
sizeOverlay(); window.addEventListener('resize', sizeOverlay);

let drawing=false, points=[], gestureStartTime=0;
const enabled = ()=> document.getElementById('enableToggle').checked;
function throttle(fn, limit){ let t=false; return (...a)=>{ if(!t){ fn(...a); t=true; setTimeout(()=>t=false,limit);} }; }
function getPosFromEvent(e){
  if(e.touches && e.touches[0]) return { x:e.touches[0].clientX, y:e.touches[0].clientY, touch:true };
  return { x:e.clientX, y:e.clientY, touch:false };
}
function startDraw(e){
  if(!enabled()) return;
  const p = getPosFromEvent(e);
  drawing = true; points = []; gestureStartTime = performance.now();
  points.push(p); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  if(p.touch) e.preventDefault(); // prevent page scroll while drawing via touch
}
function moveDraw(e){
  if(!drawing) return;
  const p = getPosFromEvent(e);
  const last = points[points.length-1];
  const dist = Math.hypot(p.x-last.x, p.y-last.y);
  if(dist < 1.5) return;
  points.push(p); ctx.lineTo(p.x, p.y); ctx.stroke();
  if(p.touch) e.preventDefault();
}
function endDraw(e){
  if(!drawing) return; drawing=false;
  const duration = performance.now()-gestureStartTime;
  if(points.length>10){
    const {name, score} = recognize(points);
    const success = score>0.6;
    logGesture(name, score, duration, success);
    showHUD(`Detected: ${name} (score ${score.toFixed(2)})`);
    if(success) performAction(name); else toast('🤔 Gesture not recognized (try clearer/bigger)');
  }
  ctx.clearRect(0,0,overlay.width,overlay.height);
}

/* Listen on document so overlay never blocks clicks/scrolls */
document.addEventListener('mousedown', startDraw);
document.addEventListener('mousemove', throttle(moveDraw, 5));
document.addEventListener('mouseup',   endDraw);

document.addEventListener('touchstart', startDraw, {passive:false});
document.addEventListener('touchmove',  throttle(moveDraw, 5), {passive:false});
document.addEventListener('touchend',   endDraw, {passive:false});
document.addEventListener('touchcancel',endDraw, {passive:false});

document.getElementById('enableToggle').addEventListener('change', e=>{
  toast(e.target.checked ? 'Gestures enabled' : 'Gestures disabled');
});

/************* $1-like Recognizer (same as before) *************/
const N=96, SQUARE=250, ORIGIN={x:0,y:0};
function centroid(pts){ let x=0,y=0; for(const p of pts){x+=p.x;y+=p.y;} return {x:x/pts.length,y:y/pts.length}; }
function pathLength(pts){ let d=0; for(let i=1;i<pts.length;i++){ d+=Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y);} return d; }
function resample(pts,n=N){ const I=pathLength(pts)/(n-1); let D=0; const out=[pts[0]];
  for(let i=1;i<pts.length;i++){ const a=pts[i-1], b=pts[i], dist=Math.hypot(b.x-a.x,b.y-a.y);
    if((D+dist)>=I){ const t=(I-D)/dist; const q={x:a.x+t*(b.x-a.x), y:a.y+t*(b.y-a.y)}; out.push(q); pts.splice(i,0,q); D=0; }
    else D+=dist;
  }
  while(out.length<n) out.push(pts[pts.length-1]); return out;
}
function indicativeAngle(pts){ const c=centroid(pts); return Math.atan2(c.y-pts[0].y, c.x-pts[0].x); }
function rotateBy(pts,a){ const c=centroid(pts), cos=Math.cos(a), sin=Math.sin(a);
  return pts.map(p=>({x:(p.x-c.x)*cos-(p.y-c.y)*sin+c.x, y:(p.x-c.x)*sin+(p.y-c.y)*cos+c.y})); }
function scaleTo(pts,size=SQUARE){
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of pts){ if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x; if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y; }
  const w=maxX-minX||1, h=maxY-minY||1;
  return pts.map(p=>({x:(p.x-minX)*(size/w), y:(p.y-minY)*(size/h)}));
}
function translateTo(pts,t=ORIGIN){ const c=centroid(pts); return pts.map(p=>({x:p.x+(t.x-c.x), y:p.y+(t.y-c.y)})); }
function pathDistance(a,b){ let d=0; for(let i=0;i<a.length;i++) d+=Math.hypot(a[i].x-b[i].x,a[i].y-b[i].y); return d/a.length; }
function normalize(pts){ let r=resample(pts.slice(),N); r=rotateBy(r,-indicativeAngle(r)); r=scaleTo(r,SQUARE); r=translateTo(r,ORIGIN); return r; }

function templateLine(dir='right',len=1){ const pts=[]; for(let i=0;i<N;i++){ const t=i/(N-1); let x=t*len,y=0; if(dir==='left') x=(1-t)*len; pts.push({x,y}); } return normalize(pts); }
function templateArrow(dir='right'){
  const pts=[], segs=N, y=0.5, start=dir==='right'?0.1:0.9, end=dir==='right'?0.8:0.2;
  for(let i=0;i<Math.floor(segs*0.6);i++){ const t=i/(Math.floor(segs*0.6)-1||1); const x=start+t*(end-start); pts.push({x,y}); }
  const tip=dir==='right'?0.9:0.1, base=end, top=0.35, bot=0.65;
  const head = dir==='right'
    ? [{x:base,y},{x:base-0.15,y:top},{x:tip,y},{x:base-0.15,y:bot},{x:tip,y}]
    : [{x:base,y},{x:base+0.15,y:top},{x:tip,y},{x:base+0.15,y:bot},{x:tip,y}];
  pts.push(...head); return normalize(pts);
}
function templateCircle(){ const pts=[]; for(let i=0;i<N;i++){ const t=(i/N)*Math.PI*2; pts.push({x:Math.cos(t),y:Math.sin(t)});} return normalize(pts); }
function templateZ(){ const pts=[], seg=Math.floor(N/3);
  for(let i=0;i<seg;i++){ const t=i/(seg-1); pts.push({x:t,y:0}); }
  for(let i=0;i<seg;i++){ const t=i/(seg-1); pts.push({x:1-t,y:t}); }
  for(let i=0;i<seg;i++){ const t=i/(seg-1); pts.push({x:t,y:1}); }
  return normalize(pts);
}
const TEMPLATES=[
  {name:'line-right',pts:templateLine('right')},
  {name:'line-left', pts:templateLine('left') },
  {name:'arrow-right',pts:templateArrow('right')},
  {name:'arrow-left', pts:templateArrow('left') },
  {name:'circle',pts:templateCircle()},
  {name:'z',pts:templateZ()},
];

function isClosedCircleHeuristic(raw){
  const pts=normalize(raw.slice());
  const first=pts[0], last=pts[pts.length-1];
  const close=Math.hypot(first.x-last.x, first.y-last.y);
  const diag=Math.hypot(SQUARE,SQUARE);
  const isClosed=(close/diag)<0.12;

  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of pts){ if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x; if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y; }
  const w=maxX-minX, h=maxY-minY, aspect=w/((h)||1);
  const isRoundish = aspect>0.65 && aspect<1.35;

  const c=centroid(pts), dists=pts.map(p=>Math.hypot(p.x-c.x,p.y-c.y));
  const mean=dists.reduce((a,b)=>a+b,0)/dists.length;
  const sd=Math.sqrt(dists.reduce((a,d)=>a+(d-mean)*(d-mean),0)/dists.length);
  const radialCV=sd/(mean||1), circular = radialCV<0.38;

  const len=pathLength(pts), longEnough = len > SQUARE*1.6;
  return isClosed && isRoundish && circular && longEnough;
}
function inferHorizontalDirection(raw){
  const f=raw[0], l=raw[raw.length-1]; const dx=l.x-f.x, dy=l.y-f.y;
  if(Math.hypot(dx,dy)<30) return 'unknown';
  if(Math.abs(dx) < Math.abs(dy)*0.7) return 'unknown';
  return dx<0 ? 'left' : 'right';
}
function recognize(pts){
  if(isClosedCircleHeuristic(pts)) return {name:'circle', score:0.92, dist:0};
  const np=normalize(pts.slice());
  let best={name:'unknown', score:0, dist:Infinity};
  const max=Math.hypot(SQUARE,SQUARE);
  for(const t of TEMPLATES){
    const d=pathDistance(np,t.pts); const s=1-Math.min(d/max,1);
    if(s>best.score) best={name:t.name, score:s, dist:d};
  }
  const dir=inferHorizontalDirection(pts);
  if(['arrow-right','arrow-left','line-right','line-left'].includes(best.name) && dir!=='unknown'){
    best.name = best.name.startsWith('arrow')
      ? (dir==='left' ? 'arrow-left' : 'arrow-right')
      : (dir==='left' ? 'line-left' : 'line-right');
  }
  return best;
}

/************* Actions (same mappings) *************/
function performAction(name){
  switch(name){
    case 'circle': toast('↻ Circle → Reload'); location.reload(); break;
    case 'line-left':
    case 'arrow-left': toast('← Back'); history.back(); break;
    case 'line-right':
    case 'arrow-right': toast('→ Forward'); history.forward(); break;
    case 'z': {
      toast('Z → New Tab: Google');
      const w = window.open('https://www.google.com','_blank','noopener,noreferrer');
      if(!w) toast('Popup blocked. Allow popups for this page.');
      break;
    }
    default: toast('Gesture recognized, but no action mapped.');
  }
}
