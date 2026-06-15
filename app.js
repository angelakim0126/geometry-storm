'use strict';

// ======================================================================
// Geometry Storm — twin-stick arcade shooter
// ======================================================================

const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');

// ---------- Config ----------
const CFG = {
  player: { r: 12, accel: 0.55, maxSpeed: 6.2, friction: 0.92, fireRate: 160, invulnMs: 1200 },
  bullet: { r: 5.5, speed: 11, life: 900 },
  enemyBullet: { r: 5, speed: 4.2, life: 4000 },
  combo: { decayMs: 2200, max: 10 },
  powerupDrop: 0.13,
  powerupLifeMs: 14000,
  shake: { decay: 0.86, max: 22 },
  bossEvery: 5,
};

function isPrime(n) {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0) return false;
  for (let i = 3, lim = Math.floor(Math.sqrt(n)); i <= lim; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

// Vertex-side count per enemy shape (used for the "weak point" bonus).
// Orbiter is a circle — no vertices, no bonus.
const SHAPE_SIDES = { tri: 3, sq: 4, hex: 6, octa: 8, star: 10 };

const MILESTONES = {
  5:  'ASTEROID BELT',
  10: 'NEBULA',
  15: 'BLACK HOLE',
  20: 'QUASAR',
  25: 'SINGULARITY',
  30: 'EVENT HORIZON',
  40: 'COSMIC OBLIVION',
  50: 'INFINITY',
};

// ---------- State ----------
const state = {
  mode: 'title',          // title | playing | paused | gameover
  w: 0, h: 0, dpr: 1,
  t: 0, last: 0,
  shake: 0,
  player: null,
  bullets: [],
  enemies: [],
  ebullets: [],
  particles: [],
  powerups: [],
  drops: [],              // visual "floating text" pickups
  wave: 1,
  spawnQueue: [],
  spawnTimer: 0,
  waveStart: 0,
  score: 0,
  best: parseInt(localStorage.getItem('gs_best') || '0', 10),
  bestWave: parseInt(localStorage.getItem('gs_best_wave') || '0', 10),
  totalKills: parseInt(localStorage.getItem('gs_kills') || '0', 10),
  kills: 0,
  combo: 1,
  comboTimer: 0,
  bestCombo: 1,
  active: null,           // active power-up: { kind, untilT }
  bomb: false,
  milestonesHit: [],
  vertexHits: 0,
  soundOn: localStorage.getItem('gs_sound') !== 'off',
  slowmo: 1,
  coins: parseInt(localStorage.getItem('gs_coins') || '0', 10),     // persistent wallet
  runCoins: 0,                                                       // earned this run
  upgrades: loadUpgrades(),
  ownedShips: loadOwnedShips(),
  ship: localStorage.getItem('gs_ship') || 'scout',
};

// ---------- Upgrade & ship config ----------
const UPGRADE_DEFS = {
  fireRate: { name: 'Fire Rate', icon: '⚡', max: 5, costs: [50, 100, 200, 400, 800],   per: '−15ms per tier' },
  hull:     { name: 'Hull',      icon: '❤',  max: 5, costs: [100, 200, 400, 800, 1600], per: '+1 starting life' },
  speed:    { name: 'Speed',     icon: '🚀', max: 5, costs: [50, 100, 200, 400, 800],   per: '+0.4 max speed' },
  damage:   { name: 'Damage',    icon: '💥', max: 5, costs: [100, 200, 400, 800, 1600], per: '+1 bullet damage' },
};

const SHIPS = {
  scout:   { name: 'Scout',   icon: '🛸', cost: 0,    color: '#7df9ff', desc: 'Balanced starter.',                  mods: {} },
  striker: { name: 'Striker', icon: '⚔️', cost: 500,  color: '#fff85d', desc: '+30% fire rate · −1 starting life.', mods: { fireMul: 0.7, livesAdd: -1 } },
  titan:   { name: 'Titan',   icon: '🛡️', cost: 1200, color: '#6ee7b7', desc: '+2 lives · −15% speed.',             mods: { livesAdd: 2, speedMul: 0.85 } },
  crystal: { name: 'Crystal', icon: '💎', cost: 2200, color: '#ff5dd2', desc: '+1 base damage · −20% fire rate.',   mods: { dmgAdd: 1, fireMul: 1.2 } },
  phantom: { name: 'Phantom', icon: '🌟', cost: 3500, color: '#fa5400', desc: 'Smaller hitbox · +25% speed.',       mods: { hitboxMul: 0.7, speedMul: 1.25 } },
  vortex:  { name: 'Vortex',  icon: '🌀', cost: 4500, color: '#c084fc', desc: 'Shots briefly slow enemies they hit.',mods: { bulletEffect: 'slow' } },
  comet:   { name: 'Comet',   icon: '☄️', cost: 6500, color: '#ff8c42', desc: 'Bullets explode on impact (small AoE).', mods: { bulletEffect: 'explode' } },
  trident: { name: 'Trident', icon: '🔱', cost: 9000, color: '#5ee3e0', desc: 'Always triple-shot · −25% fire rate.',  mods: { fireMul: 1.25, alwaysTriple: true } },
};

function loadUpgrades() {
  try {
    const raw = JSON.parse(localStorage.getItem('gs_upgrades') || '{}');
    return { fireRate: raw.fireRate || 0, hull: raw.hull || 0, speed: raw.speed || 0, damage: raw.damage || 0 };
  } catch (e) { return { fireRate: 0, hull: 0, speed: 0, damage: 0 }; }
}
function saveUpgrades() { localStorage.setItem('gs_upgrades', JSON.stringify(state.upgrades)); }

function loadOwnedShips() {
  try {
    const raw = JSON.parse(localStorage.getItem('gs_owned_ships') || '["scout"]');
    return Array.isArray(raw) && raw.length ? raw : ['scout'];
  } catch (e) { return ['scout']; }
}
function saveOwnedShips() { localStorage.setItem('gs_owned_ships', JSON.stringify(state.ownedShips)); }

function saveCoins() { localStorage.setItem('gs_coins', String(state.coins)); }
function setShip(id) { state.ship = id; localStorage.setItem('gs_ship', id); }

// ---------- Helpers ----------
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const len = (x, y) => Math.hypot(x, y);
const angle = (x, y) => Math.atan2(y, x);

function resize() {
  state.dpr = window.devicePixelRatio || 1;
  state.w = window.innerWidth;
  state.h = window.innerHeight;
  cvs.width = state.w * state.dpr;
  cvs.height = state.h * state.dpr;
  cvs.style.width = state.w + 'px';
  cvs.style.height = state.h + 'px';
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ---------- Audio ----------
let actx = null;
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function beep(freq, dur, type = 'sine', vol = 0.05) {
  if (!state.soundOn) return;
  try {
    const a = audio();
    const o = a.createOscillator(); const g = a.createGain();
    o.connect(g); g.connect(a.destination);
    o.frequency.value = freq; o.type = type;
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.start(); o.stop(a.currentTime + dur);
  } catch (e) {}
}
const sfx = {
  shoot:   () => beep(880 + rand(-40, 40), 0.05, 'square', 0.025),
  hit:     () => beep(520, 0.06, 'triangle', 0.05),
  kill:    () => beep(220, 0.12, 'sawtooth', 0.06),
  bigKill: () => { [330, 220, 165].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'sawtooth', 0.07), i * 60)); },
  power:   () => { [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.1, 'sine', 0.06), i * 60)); },
  hurt:    () => beep(140, 0.25, 'sawtooth', 0.09),
  wave:    () => { [392, 523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.14, 'triangle', 0.06), i * 80)); },
  bomb:    () => { for (let i = 0; i < 8; i++) setTimeout(() => beep(120 - i * 8, 0.18, 'sawtooth', 0.08 - i * 0.008), i * 40); },
  over:    () => { [300, 250, 200, 150, 100].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'sawtooth', 0.07), i * 110)); },
};

// ---------- Input ----------
const input = {
  keys: new Set(),
  mouse: { x: 0, y: 0, down: false, present: false },
  touch: { move: null, aim: null },  // { id, baseX, baseY, dx, dy }
  aimX: 0, aimY: -1,                  // unit vector
  moveX: 0, moveY: 0,
  shooting: false,
  touchAimActive: false,              // true only while right stick is held
};

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  input.keys.add(k);
  if (k === 'p' || e.key === 'Escape') togglePause();
  if (k === 'm') { state.soundOn = !state.soundOn; localStorage.setItem('gs_sound', state.soundOn ? 'on' : 'off'); document.getElementById('sound-btn').textContent = state.soundOn ? '🔊' : '🔇'; }
  if (k === 'b' && state.mode === 'playing' && state.bomb) detonateBomb();
});
document.addEventListener('keyup', e => input.keys.delete(e.key.toLowerCase()));

cvs.addEventListener('mousemove', e => {
  input.mouse.x = e.clientX; input.mouse.y = e.clientY; input.mouse.present = true;
});
cvs.addEventListener('mousedown', () => input.mouse.down = true);
cvs.addEventListener('mouseup', () => input.mouse.down = false);
window.addEventListener('blur', () => { if (state.mode === 'playing') togglePause(); });

// Touch joysticks
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.getElementById('touch').classList.remove('hidden');

function setupStick(zoneId, stickId, knobId, onChange) {
  const zone = document.getElementById(zoneId);
  const stick = document.getElementById(stickId);
  const knob = document.getElementById(knobId);
  let active = null;
  const RADIUS = 60;

  zone.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    active = { id: t.identifier, x: t.clientX, y: t.clientY };
    stick.style.left = t.clientX + 'px';
    stick.style.top = t.clientY + 'px';
    stick.classList.add('active');
    knob.style.transform = 'translate(-50%, -50%)';
  }, { passive: false });

  zone.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!active) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== active.id) continue;
      let dx = t.clientX - active.x;
      let dy = t.clientY - active.y;
      const d = len(dx, dy);
      if (d > RADIUS) { dx = dx / d * RADIUS; dy = dy / d * RADIUS; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      onChange(dx / RADIUS, dy / RADIUS, true);
    }
  }, { passive: false });

  const end = e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (active && t.identifier === active.id) {
        active = null;
        stick.classList.remove('active');
        knob.style.transform = 'translate(-50%, -50%)';
        onChange(0, 0, false);
      }
    }
  };
  zone.addEventListener('touchend', end);
  zone.addEventListener('touchcancel', end);
}

if (isTouch) {
  setupStick('stick-zone-left', 'stick-move', 'knob-move', (dx, dy) => {
    input.moveX = dx; input.moveY = dy;
  });
  setupStick('stick-zone-right', 'stick-aim', 'knob-aim', (dx, dy, active) => {
    if (active && (dx !== 0 || dy !== 0)) {
      const d = len(dx, dy);
      input.aimX = dx / d; input.aimY = dy / d;
      input.touchAimActive = true;
    } else {
      input.touchAimActive = false;
    }
  });
}

// ---------- Particles ----------
function spawnParticles(x, y, color, n = 12, speed = 4, life = 600) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const s = rand(speed * 0.3, speed);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life, age: 0,
      size: rand(2, 4.5),
      color,
    });
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.96; p.vy *= 0.96;
    p.age += dt;
    if (p.age >= p.life) state.particles.splice(i, 1);
  }
}

// ---------- Player ----------
function computeLoadout() {
  // Combine upgrades + ship modifiers into the per-run stats the player uses.
  const u = state.upgrades;
  const ship = SHIPS[state.ship] || SHIPS.scout;
  const mods = ship.mods || {};
  const fireRate = Math.max(50, (CFG.player.fireRate - u.fireRate * 15) * (mods.fireMul ?? 1));
  const maxSpeed = (CFG.player.maxSpeed + u.speed * 0.4) * (mods.speedMul ?? 1);
  const lives = Math.max(1, 3 + u.hull + (mods.livesAdd ?? 0));
  const bulletDmg = 1 + u.damage + (mods.dmgAdd ?? 0);
  const hitboxMul = mods.hitboxMul ?? 1;
  return {
    fireRate, maxSpeed, lives, bulletDmg, hitboxMul,
    color: ship.color,
    bulletEffect: mods.bulletEffect || null,    // 'slow' | 'explode' | null
    alwaysTriple: !!mods.alwaysTriple,
  };
}

function makePlayer() {
  const lo = computeLoadout();
  return {
    x: state.w / 2, y: state.h / 2,
    vx: 0, vy: 0,
    r: CFG.player.r * lo.hitboxMul,
    visualR: CFG.player.r,           // for rendering — keep ship size consistent
    angle: -Math.PI / 2,
    lives: lo.lives,
    shield: 0,                       // hits absorbed remaining
    invulnUntil: 0,
    lastFire: 0,
    fireRate: lo.fireRate,
    maxSpeed: lo.maxSpeed,
    bulletDmg: lo.bulletDmg,
    color: lo.color,
    bulletEffect: lo.bulletEffect,
    alwaysTriple: lo.alwaysTriple,
  };
}

// Each ship draws as a stroked silhouette in the local frame, facing +x.
// `r` is the visual radius — kept constant across ships so the hitbox
// change on Phantom doesn't shrink the rendered ship.
const SHIP_DRAW = {
  scout(r) {
    // Sleek fighter: pointed nose, swept-back wings, central cockpit
    ctx.beginPath();
    ctx.moveTo(r * 1.25, 0);
    ctx.lineTo(r * 0.25, -r * 0.4);
    ctx.lineTo(-r * 0.15, -r * 0.95);
    ctx.lineTo(-r * 0.75, -r * 0.55);
    ctx.lineTo(-r * 0.5,  -r * 0.18);
    ctx.lineTo(-r * 0.8, 0);
    ctx.lineTo(-r * 0.5,   r * 0.18);
    ctx.lineTo(-r * 0.75,  r * 0.55);
    ctx.lineTo(-r * 0.15,  r * 0.95);
    ctx.lineTo(r * 0.25,   r * 0.4);
    ctx.closePath();
    ctx.stroke();
    // Cockpit bubble
    ctx.beginPath();
    ctx.arc(r * 0.35, 0, r * 0.22, 0, TAU);
    ctx.stroke();
  },
  striker(r) {
    // Aggressive: long body + forward-swept wings + twin barrels
    ctx.beginPath();
    ctx.moveTo(r * 1.35, 0);
    ctx.lineTo(r * 0.5, -r * 0.3);
    ctx.lineTo(r * 0.7, -r * 0.95);
    ctx.lineTo(-r * 0.15, -r * 0.95);
    ctx.lineTo(-r * 0.4, -r * 0.45);
    ctx.lineTo(-r * 0.85, -r * 0.55);
    ctx.lineTo(-r * 0.95, 0);
    ctx.lineTo(-r * 0.85,  r * 0.55);
    ctx.lineTo(-r * 0.4,   r * 0.45);
    ctx.lineTo(-r * 0.15,  r * 0.95);
    ctx.lineTo(r * 0.7,    r * 0.95);
    ctx.lineTo(r * 0.5,    r * 0.3);
    ctx.closePath();
    ctx.stroke();
    // Twin gun barrels extending past the wings
    ctx.beginPath();
    ctx.moveTo(r * 0.7, -r * 0.75); ctx.lineTo(r * 1.15, -r * 0.6);
    ctx.moveTo(r * 0.7,  r * 0.75); ctx.lineTo(r * 1.15,  r * 0.6);
    ctx.stroke();
  },
  titan(r) {
    // Bulky armored hex-front cruiser
    ctx.beginPath();
    ctx.moveTo(r * 1.15, 0);
    ctx.lineTo(r * 0.85, -r * 0.55);
    ctx.lineTo(r * 0.2, -r * 1.05);
    ctx.lineTo(-r * 0.55, -r * 1.05);
    ctx.lineTo(-r * 0.95, -r * 0.55);
    ctx.lineTo(-r * 0.95,  r * 0.55);
    ctx.lineTo(-r * 0.55,  r * 1.05);
    ctx.lineTo(r * 0.2,   r * 1.05);
    ctx.lineTo(r * 0.85,  r * 0.55);
    ctx.closePath();
    ctx.stroke();
    // Shield ridge across the prow
    ctx.beginPath();
    ctx.moveTo(r * 0.55, -r * 0.55);
    ctx.lineTo(r * 0.95, 0);
    ctx.lineTo(r * 0.55,  r * 0.55);
    ctx.stroke();
    // Rear engine block lines
    ctx.beginPath();
    ctx.moveTo(-r * 0.95, -r * 0.3); ctx.lineTo(-r * 0.6, -r * 0.3);
    ctx.moveTo(-r * 0.95,  r * 0.3); ctx.lineTo(-r * 0.6,  r * 0.3);
    ctx.stroke();
  },
  crystal(r) {
    // Faceted kite/diamond
    ctx.beginPath();
    ctx.moveTo(r * 1.35, 0);
    ctx.lineTo(r * 0.3, -r * 0.85);
    ctx.lineTo(-r * 0.85, -r * 0.5);
    ctx.lineTo(-r * 0.55, 0);
    ctx.lineTo(-r * 0.85,  r * 0.5);
    ctx.lineTo(r * 0.3,    r * 0.85);
    ctx.closePath();
    ctx.stroke();
    // Inner facet lines
    ctx.beginPath();
    ctx.moveTo(r * 1.35, 0); ctx.lineTo(-r * 0.55, 0);
    ctx.moveTo(r * 0.3, -r * 0.85); ctx.lineTo(r * 0.3,  r * 0.85);
    ctx.stroke();
  },
  phantom(r) {
    // Sleek stealth — long swept wings + small canopy
    ctx.beginPath();
    ctx.moveTo(r * 1.5, 0);
    ctx.lineTo(r * 0.4, -r * 0.22);
    ctx.lineTo(r * 0.05, -r * 1.0);
    ctx.lineTo(-r * 0.6, -r * 0.55);
    ctx.lineTo(-r * 0.85, -r * 0.18);
    ctx.lineTo(-r * 0.7, 0);
    ctx.lineTo(-r * 0.85,  r * 0.18);
    ctx.lineTo(-r * 0.6,   r * 0.55);
    ctx.lineTo(r * 0.05,   r * 1.0);
    ctx.lineTo(r * 0.4,    r * 0.22);
    ctx.closePath();
    ctx.stroke();
    // Canopy + center fin
    ctx.beginPath();
    ctx.arc(r * 0.7, 0, r * 0.14, 0, TAU);
    ctx.moveTo(r * 0.3, 0); ctx.lineTo(-r * 0.55, 0);
    ctx.stroke();
  },
  vortex(r) {
    // Crescent / sickle — outer arc curving around a central core
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.05, -Math.PI * 0.65, Math.PI * 0.65, false);
    ctx.lineTo(r * 0.35, 0);
    ctx.arc(0, 0, r * 0.55, Math.PI * 0.65, -Math.PI * 0.65, true);
    ctx.closePath();
    ctx.stroke();
    // Central core + small inner orbit ring
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, -Math.PI * 0.3, Math.PI * 0.3);
    ctx.stroke();
  },
  comet(r) {
    // Compact teardrop with twin curved fins — looks like a missile
    ctx.beginPath();
    ctx.moveTo(r * 1.4, 0);
    ctx.bezierCurveTo(r * 0.9, -r * 0.55, r * 0.0, -r * 0.5, -r * 0.7, -r * 0.3);
    ctx.lineTo(-r * 0.85, 0);
    ctx.lineTo(-r * 0.7, r * 0.3);
    ctx.bezierCurveTo(r * 0.0, r * 0.5, r * 0.9, r * 0.55, r * 1.4, 0);
    ctx.closePath();
    ctx.stroke();
    // Curved fins
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.45);
    ctx.quadraticCurveTo(-r * 0.6, -r * 0.95, -r * 0.95, -r * 0.5);
    ctx.moveTo(-r * 0.1,  r * 0.45);
    ctx.quadraticCurveTo(-r * 0.6,  r * 0.95, -r * 0.95,  r * 0.5);
    ctx.stroke();
    // Cockpit dot
    ctx.beginPath();
    ctx.arc(r * 0.55, 0, r * 0.13, 0, TAU);
    ctx.stroke();
  },
  trident(r) {
    // Three-prong forward attack — like a trident
    ctx.beginPath();
    ctx.moveTo(r * 1.4, -r * 0.55);          // top prong tip
    ctx.lineTo(r * 0.5, -r * 0.4);
    ctx.lineTo(r * 1.4, 0);                  // center prong tip
    ctx.lineTo(r * 0.5,  r * 0.4);
    ctx.lineTo(r * 1.4,  r * 0.55);          // bottom prong tip
    ctx.lineTo(r * 0.35, r * 0.7);           // wing tip lower
    ctx.lineTo(-r * 0.55, r * 0.6);
    ctx.lineTo(-r * 0.95, 0);
    ctx.lineTo(-r * 0.55, -r * 0.6);
    ctx.lineTo(r * 0.35, -r * 0.7);          // wing tip upper
    ctx.closePath();
    ctx.stroke();
    // Central spine
    ctx.beginPath();
    ctx.moveTo(r * 0.5, 0); ctx.lineTo(-r * 0.55, 0);
    ctx.stroke();
  },
};

// Per-ship engine attachment points (offsets from ship center in local
// frame, behind the ship). Used to render thrust trails from the right spot.
const SHIP_ENGINES = {
  scout:   [{ x: -0.6, y: -0.18 }, { x: -0.6, y: 0.18 }],
  striker: [{ x: -0.85, y: -0.35 }, { x: -0.85, y: 0.35 }],
  titan:   [{ x: -0.9, y: -0.35 }, { x: -0.9, y: 0 }, { x: -0.9, y: 0.35 }],
  crystal: [{ x: -0.55, y: 0 }],
  phantom: [{ x: -0.78, y: 0 }],
  vortex:  [{ x: -0.5, y: -0.55 }, { x: -0.5, y: 0.55 }],
  comet:   [{ x: -0.85, y: 0 }],
  trident: [{ x: -0.95, y: -0.18 }, { x: -0.95, y: 0.18 }],
};

function drawPlayer(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  const r = p.visualR || p.r;
  const shipId = state.ship in SHIP_DRAW ? state.ship : 'scout';
  const flick = (state.t < p.invulnUntil && Math.floor(state.t / 60) % 2 === 0);
  const shipColor = p.color || '#7df9ff';

  // Thrust trails — drawn in the ship's local frame so each engine
  // pours fire straight backward, regardless of which way the ship is aimed.
  const speed = len(p.vx, p.vy);
  if (speed > 0.5) {
    const engines = SHIP_ENGINES[shipId] || SHIP_ENGINES.scout;
    // Trail length scales with speed, color matches ship
    const trailLen = Math.min(28, 10 + speed * 3);
    for (const eng of engines) {
      const ex = eng.x * r;
      const ey = eng.y * r;
      const g = ctx.createLinearGradient(ex, ey, ex - trailLen, ey);
      g.addColorStop(0, shipColor);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(ex, ey - r * 0.13);
      ctx.lineTo(ex - trailLen, ey);
      ctx.lineTo(ex, ey + r * 0.13);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Ship body
  ctx.strokeStyle = flick ? 'rgba(255, 255, 255, 0.3)' : shipColor;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = shipColor;
  ctx.shadowBlur = 14;
  SHIP_DRAW[shipId](r);

  // Shield ring
  if (p.shield > 0) {
    ctx.shadowBlur = 18;
    ctx.strokeStyle = `rgba(110, 231, 183, ${0.5 + 0.3 * Math.sin(state.t / 100)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 9, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function updatePlayer(p, dt) {
  // Movement input
  let mx = input.moveX, my = input.moveY;
  if (input.keys.has('w') || input.keys.has('arrowup')) my -= 1;
  if (input.keys.has('s') || input.keys.has('arrowdown')) my += 1;
  if (input.keys.has('a') || input.keys.has('arrowleft')) mx -= 1;
  if (input.keys.has('d') || input.keys.has('arrowright')) mx += 1;
  const m = len(mx, my);
  if (m > 1) { mx /= m; my /= m; }
  p.vx += mx * CFG.player.accel;
  p.vy += my * CFG.player.accel;
  // Cap speed
  const sp = len(p.vx, p.vy);
  const cap = p.maxSpeed || CFG.player.maxSpeed;
  if (sp > cap) {
    p.vx = p.vx / sp * cap;
    p.vy = p.vy / sp * cap;
  }
  p.vx *= CFG.player.friction;
  p.vy *= CFG.player.friction;
  p.x = clamp(p.x + p.vx, p.r, state.w - p.r);
  p.y = clamp(p.y + p.vy, p.r, state.h - p.r);

  // Aim — right joystick (while held) wins, then mouse. If neither is
  // engaged, auto-aim at the nearest enemy so the player can focus on
  // dodging. Auto-fire is always on while playing.
  if (input.touchAimActive) {
    p.angle = Math.atan2(input.aimY, input.aimX);
  } else if (input.mouse.present) {
    p.angle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
  } else {
    // Auto-aim at nearest enemy
    let best = null, bestD = Infinity;
    for (const e of state.enemies) {
      const d = len(e.x - p.x, e.y - p.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (best) {
      const targetA = Math.atan2(best.y - p.y, best.x - p.x);
      // Smoothly rotate toward target so it doesn't snap
      const diff = ((targetA - p.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      p.angle += clamp(diff, -0.25, 0.25);
    } else if (len(p.vx, p.vy) > 0.5) {
      p.angle = Math.atan2(p.vy, p.vx);
    }
  }
  input.shooting = true;

  // Fire — Rapid Fire power-up keeps a fixed fast cadence regardless of
  // upgrades; otherwise use the player's upgraded fireRate.
  const baseFire = p.fireRate || CFG.player.fireRate;
  const fireDelay = (state.active && state.active.kind === 'rapid') ? Math.min(70, baseFire * 0.45) : baseFire;
  if (input.shooting && state.t - p.lastFire >= fireDelay) {
    p.lastFire = state.t;
    fireBullets(p);
    sfx.shoot();
  }
}

function fireBullets(p) {
  const triple = (state.active && state.active.kind === 'triple') || p.alwaysTriple;
  const spread = triple ? [-0.22, 0, 0.22] : [0];
  const effect = p.bulletEffect || null;
  for (const off of spread) {
    const a = p.angle + off;
    state.bullets.push({
      x: p.x + Math.cos(a) * p.r,
      y: p.y + Math.sin(a) * p.r,
      vx: Math.cos(a) * CFG.bullet.speed,
      vy: Math.sin(a) * CFG.bullet.speed,
      life: CFG.bullet.life,
      age: 0,
      dmg: p.bulletDmg || 1,
      effect,
      color: p.color,
    });
  }
}

function damagePlayer(p) {
  if (state.t < p.invulnUntil) return;
  if (p.shield > 0) {
    p.shield--;
    spawnParticles(p.x, p.y, '#6ee7b7', 16, 5, 500);
    p.invulnUntil = state.t + 400;
    sfx.hit();
    if (p.shield === 0) clearActivePower();
    return;
  }
  p.lives--;
  p.invulnUntil = state.t + CFG.player.invulnMs;
  shake(18);
  spawnParticles(p.x, p.y, '#ff4d6d', 28, 7, 800);
  sfx.hurt();
  resetCombo();
  if (p.lives <= 0) gameOver();
}

// ---------- Enemies ----------
const ENEMY_KINDS = {
  drifter:  { hp: 1, r: 14, speed: 1.0, color: '#ff5dd2', score: 10,  coin: 1,  shape: 'hex' },
  zoomer:   { hp: 1, r: 11, speed: 2.4, color: '#fff85d', score: 20,  coin: 2,  shape: 'tri' },
  splitter: { hp: 2, r: 17, speed: 1.2, color: '#6ee7b7', score: 30,  coin: 3,  shape: 'sq' },
  orbiter:  { hp: 2, r: 13, speed: 1.4, color: '#7df9ff', score: 40,  coin: 4,  shape: 'circle' },
  tank:     { hp: 4, r: 22, speed: 0.7, color: '#ff4d6d', score: 80,  coin: 8,  shape: 'octa' },
  shielder: { hp: 6, r: 20, speed: 0.9, color: '#a78bfa', score: 120, coin: 12, shape: 'octa' },
  boss:     { hp: 50, r: 46, speed: 0.8, color: '#ff5dd2', score: 800, coin: 80, shape: 'star' },
};

function makeEnemy(kind, x, y, opts = {}) {
  const k = ENEMY_KINDS[kind];
  return {
    kind, x, y, vx: 0, vy: 0,
    r: opts.r || k.r,
    hp: opts.hp || k.hp,
    maxHp: opts.hp || k.hp,
    speed: opts.speed || k.speed,
    color: k.color,
    shape: k.shape,
    score: opts.score || k.score,
    born: state.t,
    fireT: state.t + rand(800, 2200),
    orbitA: rand(0, TAU),
    spinPhase: rand(0, TAU),
  };
}

function spawnEnemyAtEdge(kind) {
  const side = randi(0, 3);
  let x, y;
  if (side === 0) { x = rand(0, state.w); y = -30; }
  else if (side === 1) { x = state.w + 30; y = rand(0, state.h); }
  else if (side === 2) { x = rand(0, state.w); y = state.h + 30; }
  else { x = -30; y = rand(0, state.h); }
  return makeEnemy(kind, x, y);
}

function updateEnemy(e, dt) {
  const p = state.player;
  const dx = p.x - e.x, dy = p.y - e.y;
  const d = len(dx, dy) || 1;
  e.spinPhase += 0.04;

  if (e.kind === 'drifter' || e.kind === 'splitter' || e.kind === 'tank') {
    // chase
    e.vx += (dx / d) * e.speed * 0.12;
    e.vy += (dy / d) * e.speed * 0.12;
    e.vx *= 0.92; e.vy *= 0.92;
    const cap = e.speed;
    const sp = len(e.vx, e.vy);
    if (sp > cap) { e.vx = e.vx / sp * cap; e.vy = e.vy / sp * cap; }
  } else if (e.kind === 'zoomer') {
    // commits to a direction once close, otherwise chases
    if (d < 320) {
      e.vx += (dx / d) * 0.18;
      e.vy += (dy / d) * 0.18;
    }
    const sp = len(e.vx, e.vy);
    if (sp > e.speed) { e.vx = e.vx / sp * e.speed; e.vy = e.vy / sp * e.speed; }
    if (sp < 0.1) { e.vx = (dx / d) * e.speed; e.vy = (dy / d) * e.speed; }
  } else if (e.kind === 'orbiter') {
    // orbits at distance + shoots
    const desired = 240;
    const radial = (dx / d) * (d - desired) * 0.01;
    e.orbitA += 0.03;
    const tx = Math.cos(e.orbitA), ty = Math.sin(e.orbitA);
    e.vx = (dx / d) * 0.6 * Math.sign(d - desired) * e.speed + (-ty) * e.speed * 0.7;
    e.vy = (dy / d) * 0.6 * Math.sign(d - desired) * e.speed + (tx) * e.speed * 0.7;
    if (state.t > e.fireT) {
      e.fireT = state.t + rand(1800, 2800);
      enemyShoot(e);
    }
  } else if (e.kind === 'boss') {
    // drifts around upper area + shoots barrages
    const target = { x: state.w / 2 + Math.sin(state.t / 1200) * 200, y: state.h * 0.28 + Math.cos(state.t / 1700) * 60 };
    e.vx += (target.x - e.x) * 0.0015;
    e.vy += (target.y - e.y) * 0.0015;
    e.vx *= 0.97; e.vy *= 0.97;
    if (state.t > e.fireT) {
      e.fireT = state.t + 900;
      bossBarrage(e);
    }
  }

  const slowMul = (e.slowUntil && state.t < e.slowUntil) ? 0.4 : 1;
  e.x += e.vx * state.slowmo * slowMul;
  e.y += e.vy * state.slowmo * slowMul;
}

function enemyShoot(e) {
  const p = state.player;
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  state.ebullets.push({
    x: e.x, y: e.y,
    vx: Math.cos(a) * CFG.enemyBullet.speed,
    vy: Math.sin(a) * CFG.enemyBullet.speed,
    life: CFG.enemyBullet.life, age: 0,
    r: CFG.enemyBullet.r,
  });
}

function bossBarrage(boss) {
  const N = 12;
  const base = state.t / 400;
  for (let i = 0; i < N; i++) {
    const a = base + (i / N) * TAU;
    state.ebullets.push({
      x: boss.x, y: boss.y,
      vx: Math.cos(a) * CFG.enemyBullet.speed * 0.85,
      vy: Math.sin(a) * CFG.enemyBullet.speed * 0.85,
      life: CFG.enemyBullet.life, age: 0,
      r: CFG.enemyBullet.r,
    });
  }
}

function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.strokeStyle = e.color;
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 14;
  ctx.lineWidth = 2.5;
  const r = e.r;
  ctx.rotate(e.spinPhase);

  if (e.shape === 'hex') drawPoly(6, r);
  else if (e.shape === 'tri') drawPoly(3, r);
  else if (e.shape === 'sq') drawPoly(4, r);
  else if (e.shape === 'octa') drawPoly(8, r);
  else if (e.shape === 'circle') {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, TAU); ctx.stroke();
  } else if (e.shape === 'star') {
    drawStar(5, r, r * 0.5);
    ctx.shadowBlur = 22;
    drawStar(5, r * 0.7, r * 0.35);
  }

  // HP indicator for tougher enemies
  if (e.maxHp > 1 && e.kind !== 'boss') {
    ctx.shadowBlur = 0;
    ctx.fillStyle = e.color;
    ctx.globalAlpha = e.hp / e.maxHp;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Boss HP bar at top
  if (e.kind === 'boss') {
    const w = Math.min(state.w - 40, 480);
    const x = (state.w - w) / 2;
    const y = 60;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 14, 38, 0.7)';
    ctx.fillRect(x, y, w, 10);
    ctx.fillStyle = e.color;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 12;
    ctx.fillRect(x, y, w * (e.hp / e.maxHp), 10);
    ctx.restore();
  }
}

function drawPoly(sides, r) {
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * TAU - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
function drawStar(points, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * TAU - Math.PI / 2;
    const r = (i % 2 === 0) ? outer : inner;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function killEnemy(e, fromPlayer = true) {
  spawnParticles(e.x, e.y, e.color, e.kind === 'boss' ? 90 : 18, e.kind === 'boss' ? 9 : 5, e.kind === 'boss' ? 1400 : 700);
  shake(e.kind === 'boss' ? 22 : 8);

  if (fromPlayer) {
    bumpCombo();
    const pts = Math.round(e.score * state.combo);
    state.score += pts;
    state.kills++;
    state.totalKills++;
    // Coins: base from enemy, bumped by combo (capped at 3x so the wallet
    // doesn't explode on long chains), doubled on prime waves.
    const baseCoin = e.coin || Math.max(1, Math.floor((e.score || 10) / 10));
    const comboMul = 1 + Math.min(2, state.combo / 5);
    let coinReward = Math.max(1, Math.round(baseCoin * comboMul));
    if (isPrime(state.wave)) coinReward *= 2;
    state.runCoins += coinReward;
    addFloatText(e.x, e.y, `+${pts}`, e.color);
    addFloatText(e.x, e.y + 14, `🪙 ${coinReward}`, '#fff85d');

    if (e.kind === 'boss') sfx.bigKill();
    else sfx.kill();

    // Maybe drop power-up (doubled on prime waves)
    const dropChance = isPrime(state.wave) ? CFG.powerupDrop * 2 : CFG.powerupDrop;
    if (Math.random() < dropChance || e.kind === 'boss') {
      spawnPowerup(e.x, e.y);
    }
  }

  // Splitter spawns 2 small drifters
  if (e.kind === 'splitter') {
    for (let i = 0; i < 2; i++) {
      const a = rand(0, TAU);
      const baby = makeEnemy('drifter', e.x + Math.cos(a) * 12, e.y + Math.sin(a) * 12, { r: 9, hp: 1, score: 15 });
      baby.vx = Math.cos(a) * 2.5;
      baby.vy = Math.sin(a) * 2.5;
      state.enemies.push(baby);
    }
  }

  // Remove from array
  const idx = state.enemies.indexOf(e);
  if (idx >= 0) state.enemies.splice(idx, 1);

  if (e.kind === 'boss') {
    addFloatText(state.w / 2, state.h / 2 - 60, 'BOSS DOWN!', '#fff85d');
  }
}

// ---------- Power-ups ----------
const POWERS = ['rapid', 'triple', 'shield', 'slowmo', 'bomb'];
const POWER_INFO = {
  rapid:  { label: '⚡ RAPID FIRE', color: '#fff85d', dur: 7000 },
  triple: { label: '✦ TRIPLE SHOT', color: '#7df9ff', dur: 8000 },
  shield: { label: '🛡 SHIELD',     color: '#6ee7b7', dur: 0 },
  slowmo: { label: '⏱ SLOW-MO',     color: '#ff5dd2', dur: 5000 },
  bomb:   { label: '💣 BOMB (B)',   color: '#ff4d6d', dur: 0 },
};

function spawnPowerup(x, y) {
  const kind = POWERS[randi(0, POWERS.length - 1)];
  state.powerups.push({
    x, y, vx: rand(-1, 1), vy: rand(-1, 1),
    kind, born: state.t,
    pulse: rand(0, TAU),
  });
}

function updatePowerups(dt) {
  for (let i = state.powerups.length - 1; i >= 0; i--) {
    const u = state.powerups[i];
    u.x += u.vx; u.y += u.vy;
    u.vx *= 0.97; u.vy *= 0.97;
    if (u.x < 20 || u.x > state.w - 20) u.vx *= -1;
    if (u.y < 20 || u.y > state.h - 20) u.vy *= -1;
    u.pulse += 0.05;
    if (state.t - u.born > CFG.powerupLifeMs) { state.powerups.splice(i, 1); continue; }
    // Pickup
    const p = state.player;
    if (len(p.x - u.x, p.y - u.y) < p.r + 16) {
      grantPower(u.kind);
      state.powerups.splice(i, 1);
    }
  }
}

function drawPowerup(u) {
  const info = POWER_INFO[u.kind];
  const r = 14 + Math.sin(u.pulse) * 2;
  const t = state.t - u.born;
  const blink = t > CFG.powerupLifeMs - 3000 ? (Math.floor(t / 100) % 2 === 0) : false;
  if (blink) return;
  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.strokeStyle = info.color;
  ctx.shadowColor = info.color;
  ctx.shadowBlur = 18;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, TAU); ctx.stroke();
  ctx.fillStyle = info.color;
  ctx.font = '700 14px Quicksand, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(u.kind[0].toUpperCase(), 0, 1);
  ctx.restore();
}

function grantPower(kind) {
  sfx.power();
  const info = POWER_INFO[kind];
  addFloatText(state.player.x, state.player.y - 30, info.label, info.color);

  if (kind === 'shield') {
    state.player.shield = 3;
    state.active = { kind: 'shield', untilT: 0 };
  } else if (kind === 'bomb') {
    state.bomb = true;
    state.active = { kind: 'bomb', untilT: 0 };
  } else {
    state.active = { kind, untilT: state.t + info.dur };
    if (kind === 'slowmo') state.slowmo = 0.4;
  }
  updatePowerupHud();
}

function clearActivePower() {
  state.active = null;
  state.slowmo = 1;
  updatePowerupHud();
}

function detonateBomb() {
  if (!state.bomb) return;
  state.bomb = false;
  sfx.bomb();
  shake(28);
  // Radial wave
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * TAU;
    state.particles.push({
      x: state.player.x, y: state.player.y,
      vx: Math.cos(a) * 14, vy: Math.sin(a) * 14,
      life: 700, age: 0, size: 4, color: '#ff5dd2',
    });
  }
  // Damage all on screen (except boss takes partial)
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.kind === 'boss') { e.hp -= 12; if (e.hp <= 0) killEnemy(e); }
    else killEnemy(e);
  }
  state.ebullets.length = 0;
  if (state.active && state.active.kind === 'bomb') clearActivePower();
}

// ---------- Float text ----------
function addFloatText(x, y, text, color) {
  state.drops.push({ x, y, text, color, age: 0, life: 900 });
}
function updateDrops(dt) {
  for (let i = state.drops.length - 1; i >= 0; i--) {
    const d = state.drops[i];
    d.age += dt; d.y -= 0.5;
    if (d.age >= d.life) state.drops.splice(i, 1);
  }
}

// ---------- Combo ----------
function bumpCombo() {
  state.combo = Math.min(CFG.combo.max, state.combo + 1);
  state.comboTimer = CFG.combo.decayMs;
  if (state.combo > state.bestCombo) state.bestCombo = state.combo;
  const el = document.getElementById('combo');
  el.classList.add('active');
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}
function resetCombo() {
  state.combo = 1;
  state.comboTimer = 0;
  document.getElementById('combo').classList.remove('active', 'bump');
}

// ---------- Waves ----------
function startWave(n) {
  state.wave = n;
  state.waveStart = state.t;
  state.spawnQueue = buildWave(n);
  state.spawnTimer = 800;
  sfx.wave();

  // Banner — milestone name wins; otherwise mini-boss / prime / generic
  const milestoneName = MILESTONES[n];
  const prime = isPrime(n);
  const miniBoss = (n === 8 || n === 12 || n === 16 || (n >= 22 && (n - 22) % 5 === 2));
  if (milestoneName) {
    showBanner(`WAVE ${n}${prime ? ' · PRIME' : ''}`, milestoneName);
    state.milestonesHit.push({ wave: n, name: milestoneName });
  } else if (miniBoss) {
    showBanner(`WAVE ${n}${prime ? ' · PRIME' : ''}`, 'MINI-BOSS · ELITE SQUAD');
  } else if (prime) {
    showBanner(`WAVE ${n}`, `PRIME · ${n} IS PRIME`);
  } else if (n === 1) {
    showBanner(`WAVE ${n}`, 'INCOMING');
  } else {
    showBanner(`WAVE ${n}`, '');
  }
}

function buildWave(n) {
  const q = [];
  // Major boss every 5 waves
  if (n % CFG.bossEvery === 0) {
    q.push({ kind: 'boss', delay: 600 });
    const minions = Math.min(6, 1 + Math.floor(n / 8));
    for (let i = 0; i < minions; i++) {
      // Higher boss waves bring tougher escorts
      const r = Math.random();
      const escort = n >= 20 ? (r < 0.4 ? 'shielder' : 'orbiter')
                   : n >= 10 ? (r < 0.5 ? 'tank' : 'orbiter')
                   : 'orbiter';
      q.push({ kind: escort, delay: 750 });
    }
    return q;
  }
  // Mini-boss waves at 8, 12, 16 (not 20 — that's a major boss) — one Tank + many minions
  const isMiniBoss = (n === 8 || n === 12 || n === 16 || (n >= 22 && (n - 22) % 5 === 2));
  if (isMiniBoss) {
    q.push({ kind: 'tank', delay: 500 });
    q.push({ kind: 'shielder', delay: 700 });
    const swarm = 6 + Math.floor(n / 4);
    for (let i = 0; i < swarm; i++) {
      const r = Math.random();
      const k = r < 0.5 ? 'zoomer' : r < 0.85 ? 'splitter' : 'orbiter';
      q.push({ kind: k, delay: rand(380, 620) });
    }
    return q;
  }
  // Spawn-delay scales down with wave so high waves feel intense.
  const minDelay = Math.max(220, 450 - n * 12);
  const maxDelay = Math.max(420, 850 - n * 20);
  const totalBase = 6 + n * 2;
  for (let i = 0; i < totalBase; i++) {
    let kind;
    const r = Math.random();
    if (n <= 2) {
      kind = r < 0.7 ? 'drifter' : 'zoomer';
    } else if (n <= 4) {
      kind = r < 0.45 ? 'drifter' : r < 0.75 ? 'zoomer' : 'splitter';
    } else if (n <= 6) {
      kind = r < 0.3 ? 'drifter' : r < 0.55 ? 'zoomer' : r < 0.78 ? 'splitter' : 'orbiter';
    } else if (n <= 10) {
      // Wave 7-10: tanks join the mix
      kind = r < 0.22 ? 'drifter' : r < 0.45 ? 'zoomer' : r < 0.65 ? 'splitter' : r < 0.85 ? 'orbiter' : 'tank';
    } else if (n <= 14) {
      // Wave 11-14: shielders appear
      kind = r < 0.16 ? 'drifter' : r < 0.36 ? 'zoomer' : r < 0.54 ? 'splitter' : r < 0.74 ? 'orbiter' : r < 0.9 ? 'tank' : 'shielder';
    } else {
      // Wave 15+: heavy mix, shielders more common
      kind = r < 0.12 ? 'drifter' : r < 0.3 ? 'zoomer' : r < 0.48 ? 'splitter' : r < 0.68 ? 'orbiter' : r < 0.85 ? 'tank' : 'shielder';
    }
    q.push({ kind, delay: rand(minDelay, maxDelay) });
  }
  return q;
}

function updateWave(dt) {
  // Spawn from queue
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const s = state.spawnQueue.shift();
      state.enemies.push(spawnEnemyAtEdge(s.kind));
      state.spawnTimer = s.delay;
    }
  } else {
    // Cull enemies that have wandered far off-screen (zoomers commit to a
    // direction and have no friction, so a missed pass can leave one drifting
    // forever — that used to freeze the wave's clear condition).
    const margin = 600;
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      if (e.x < -margin || e.x > state.w + margin || e.y < -margin || e.y > state.h + margin) {
        state.enemies.splice(i, 1);
      }
    }
  }
  if (state.spawnQueue.length === 0 && state.enemies.length === 0 && !state.betweenWaves) {
    // Wave clear — gap before next wave starts. Triangular-number bonus
    // (Σ from 1..N times 10), doubled on prime waves.
    state.betweenWaves = true;
    const N = state.wave;
    let bonus = N * (N + 1) * 5;       // = 10 * Σ(1..N)
    const prime = isPrime(N);
    if (prime) bonus *= 2;
    state.score += bonus;
    const label = prime
      ? `Σ(1..${N})·10 ×2 PRIME = ${bonus}`
      : `Σ(1..${N})·10 = ${bonus}`;
    addFloatText(state.w / 2, state.h / 2, label, prime ? '#ff5dd2' : '#fff85d');
    const nextWave = N + 1;
    setTimeout(() => {
      state.betweenWaves = false;
      if (state.mode === 'playing') startWave(nextWave);
    }, 1300);
  }
}

function showBanner(sub, title) {
  const b = document.getElementById('banner');
  document.getElementById('banner-sub').textContent = sub;
  document.getElementById('banner-title').textContent = title || ' ';
  b.classList.remove('hidden');
  // Restart animation
  b.style.animation = 'none';
  void b.offsetWidth;
  b.style.animation = '';
  setTimeout(() => b.classList.add('hidden'), 2600);
}

// ---------- Collisions ----------
function vertexHitBonus(e, bx, by) {
  // True when the bullet impact lines up with one of the polygon's
  // vertices (within ~12°). Circles/orbiters have no vertices → false.
  const sides = SHAPE_SIDES[e.shape];
  if (!sides) return false;
  const step = (Math.PI * 2) / sides;
  let theta = Math.atan2(by - e.y, bx - e.x);
  // Polygon vertex 0 is drawn at angle -PI/2, then ctx-rotated by spinPhase
  theta -= (-Math.PI / 2) + e.spinPhase;
  theta = ((theta % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  const nearest = Math.round(theta / step) * step;
  return Math.abs(theta - nearest) < 0.21;   // ~12°
}

function updateCollisions() {
  const p = state.player;
  // Player bullets vs enemies
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const e = state.enemies[j];
      if (len(b.x - e.x, b.y - e.y) < e.r + CFG.bullet.r) {
        const vertex = vertexHitBonus(e, b.x, b.y);
        const baseDmg = (b.dmg || 1);
        const dmg = vertex ? baseDmg * 2 : baseDmg;
        e.hp -= dmg;
        if (vertex) {
          state.vertexHits++;
          spawnParticles(b.x, b.y, '#fff85d', 16, 6, 600);
          addFloatText(b.x, b.y - 8, '✦ VERTEX', '#fff85d');
        } else {
          spawnParticles(b.x, b.y, '#ffffff', 4, 3, 280);
        }

        // Ship-specific bullet effect
        if (b.effect === 'slow') {
          // Vortex — slow this enemy briefly
          e.slowUntil = state.t + 900;
          spawnParticles(b.x, b.y, '#c084fc', 10, 3, 500);
        } else if (b.effect === 'explode') {
          // Comet — small AoE around impact
          const aoeR = 64;
          const aoeDmg = Math.max(1, Math.floor(baseDmg * 0.6));
          for (const e2 of state.enemies) {
            if (e2 === e) continue;
            const d = len(e2.x - b.x, e2.y - b.y);
            if (d < aoeR + e2.r) e2.hp -= aoeDmg;
          }
          // Visual: orange burst + screen shake
          spawnParticles(b.x, b.y, '#ff8c42', 24, 8, 600);
          shake(6);
          // Kill anything that dropped to 0 from the AoE — iterate backward
          for (let k = state.enemies.length - 1; k >= 0; k--) {
            const e3 = state.enemies[k];
            if (e3 !== e && e3.hp <= 0) killEnemy(e3);
          }
        }

        state.bullets.splice(i, 1);
        if (e.hp <= 0) killEnemy(e);
        else sfx.hit();
        break;
      }
    }
  }

  // Enemies vs player
  for (const e of state.enemies) {
    if (len(p.x - e.x, p.y - e.y) < e.r + p.r) {
      damagePlayer(p);
      if (e.kind !== 'boss') { e.hp = 0; killEnemy(e, false); }
    }
  }

  // Enemy bullets vs player
  for (let i = state.ebullets.length - 1; i >= 0; i--) {
    const b = state.ebullets[i];
    if (len(p.x - b.x, p.y - b.y) < b.r + p.r) {
      damagePlayer(p);
      state.ebullets.splice(i, 1);
    }
  }
}

// ---------- Screen shake ----------
function shake(amt) { state.shake = Math.min(CFG.shake.max, state.shake + amt); }

// ---------- Update / draw loop ----------
function update(dt) {
  if (state.mode !== 'playing') return;
  state.t += dt;

  updatePlayer(state.player, dt);

  // Update bullets
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * state.slowmo; b.y += b.vy * state.slowmo;
    b.age += dt;
    if (b.age > b.life || b.x < -20 || b.x > state.w + 20 || b.y < -20 || b.y > state.h + 20) {
      state.bullets.splice(i, 1);
    }
  }
  for (let i = state.ebullets.length - 1; i >= 0; i--) {
    const b = state.ebullets[i];
    b.x += b.vx * state.slowmo; b.y += b.vy * state.slowmo;
    b.age += dt;
    if (b.age > b.life || b.x < -30 || b.x > state.w + 30 || b.y < -30 || b.y > state.h + 30) {
      state.ebullets.splice(i, 1);
    }
  }

  for (const e of state.enemies) updateEnemy(e, dt);

  updatePowerups(dt);
  updateParticles(dt);
  updateDrops(dt);
  updateCollisions();
  updateWave(dt);

  // Combo decay
  if (state.combo > 1) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) resetCombo();
  }

  // Active power expiry
  if (state.active && state.active.untilT > 0 && state.t > state.active.untilT) {
    clearActivePower();
  }

  // Shake decay
  state.shake *= CFG.shake.decay;

  // HUD updates (cheap)
  document.getElementById('score').textContent = state.score;
  document.getElementById('wave').textContent = state.wave;
  document.getElementById('combo').textContent = `x${state.combo}`;
  updateCoinHud();
}

function updateCoinHud() {
  const el = document.getElementById('coins-run');
  if (el) el.textContent = state.runCoins;
}

function draw() {
  ctx.save();
  // Shake
  if (state.shake > 0.2) {
    ctx.translate(rand(-state.shake, state.shake), rand(-state.shake, state.shake));
  }

  // BG starfield (subtle, persistent)
  drawStarfield();

  // Trails — clear with semi-transparent overlay for motion blur
  // (Use a full clear, simpler)
  // No-op; starfield clears.

  // Particles behind ships
  for (const p of state.particles) {
    const a = 1 - p.age / p.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;

  // Power-ups
  for (const u of state.powerups) drawPowerup(u);

  // Bullets — with a short trail for visibility
  ctx.shadowColor = '#7df9ff';
  ctx.shadowBlur = 18;
  for (const b of state.bullets) {
    // Trail
    ctx.strokeStyle = 'rgba(125, 249, 255, 0.55)';
    ctx.lineWidth = CFG.bullet.r * 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 1.6, b.y - b.vy * 1.6);
    ctx.stroke();
    // Bright core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, CFG.bullet.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7df9ff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, CFG.bullet.r * 0.6, 0, TAU);
    ctx.fill();
  }

  // Enemy bullets
  ctx.fillStyle = '#ff4d6d';
  ctx.shadowColor = '#ff4d6d';
  ctx.shadowBlur = 14;
  for (const b of state.ebullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Enemies
  for (const e of state.enemies) drawEnemy(e);

  // Player
  if (state.player) drawPlayer(state.player);

  // Float text
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';
  ctx.font = '700 16px Quicksand, sans-serif';
  for (const d of state.drops) {
    const a = 1 - d.age / d.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = d.color;
    ctx.fillText(d.text, d.x, d.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ---------- Starfield ----------
let stars = null;
function buildStars() {
  stars = [];
  const count = Math.floor((state.w * state.h) / 14000);
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand(0, state.w),
      y: rand(0, state.h),
      r: rand(0.3, 1.6),
      a: rand(0.2, 0.8),
      tw: rand(0, TAU),
    });
  }
}
buildStars();
window.addEventListener('resize', buildStars);

function drawStarfield() {
  // Full clear with deep space gradient
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, state.w, state.h);

  // Radial vignette
  const grad = ctx.createRadialGradient(state.w / 2, state.h / 2, 0, state.w / 2, state.h / 2, Math.max(state.w, state.h) * 0.7);
  grad.addColorStop(0, 'rgba(20, 25, 60, 0.6)');
  grad.addColorStop(1, 'rgba(5, 6, 15, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, state.w, state.h);

  // Stars
  ctx.fillStyle = '#ffffff';
  for (const s of stars) {
    const a = s.a * (0.6 + 0.4 * Math.sin(state.t / 600 + s.tw));
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------- HUD wiring ----------
function buildLivesHud() {
  const el = document.getElementById('lives');
  el.innerHTML = '';
  for (let i = 0; i < (state.player ? state.player.lives : 0); i++) {
    const d = document.createElement('div'); d.className = 'life'; el.appendChild(d);
  }
}

function updatePowerupHud() {
  const el = document.getElementById('powerup');
  if (state.bomb) {
    el.textContent = '💣 BOMB READY — press B';
    el.classList.add('active');
  } else if (state.active) {
    el.textContent = POWER_INFO[state.active.kind].label;
    el.classList.add('active');
  } else {
    el.classList.remove('active');
  }
}

// ---------- Game lifecycle ----------
function startGame() {
  state.mode = 'playing';
  state.player = makePlayer();
  state.bullets = [];
  state.ebullets = [];
  state.enemies = [];
  state.particles = [];
  state.powerups = [];
  state.drops = [];
  state.score = 0;
  state.kills = 0;
  state.combo = 1;
  state.bestCombo = 1;
  state.comboTimer = 0;
  state.active = null;
  state.bomb = false;
  state.slowmo = 1;
  state.milestonesHit = [];
  state.vertexHits = 0;
  state.runCoins = 0;
  state.t = 0;
  state.shake = 0;
  state.betweenWaves = false;

  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('title').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('shop').classList.add('hidden');
  buildLivesHud();
  updatePowerupHud();
  updateCoinHud();
  startWave(1);
}

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    document.getElementById('pause').classList.remove('hidden');
  } else if (state.mode === 'paused') {
    state.mode = 'playing';
    document.getElementById('pause').classList.add('hidden');
  }
}

function gameOver() {
  state.mode = 'gameover';
  sfx.over();
  // Save best
  if (state.score > state.best) { state.best = state.score; localStorage.setItem('gs_best', String(state.best)); }
  if (state.wave > state.bestWave) { state.bestWave = state.wave; localStorage.setItem('gs_best_wave', String(state.bestWave)); }
  localStorage.setItem('gs_kills', String(state.totalKills));
  // Bank the run's coins into the persistent wallet
  state.coins += state.runCoins;
  saveCoins();

  document.getElementById('result-score').textContent = state.score;
  document.getElementById('result-wave').textContent = state.wave;
  document.getElementById('result-combo').textContent = `x${state.bestCombo}`;
  document.getElementById('result-kills').textContent = state.kills;
  document.getElementById('result-vertex').textContent = state.vertexHits;
  document.getElementById('result-coins').textContent = state.runCoins;
  document.getElementById('result-coins-total').textContent = state.coins;
  document.getElementById('result-title').textContent = state.wave >= 5 ? `Reached Wave ${state.wave}` : 'Game Over';
  document.getElementById('result-emoji').textContent = state.score >= state.best && state.score > 0 ? '🏆' : '💥';

  const ml = document.getElementById('milestone-list');
  ml.innerHTML = '';
  for (const m of state.milestonesHit) {
    const chip = document.createElement('span');
    chip.className = 'milestone-chip';
    chip.textContent = `Wave ${m.wave}: ${m.name}`;
    ml.appendChild(chip);
  }

  document.getElementById('hud').classList.add('hidden');
  document.getElementById('gameover').classList.remove('hidden');
}

function backToTitle() {
  state.mode = 'title';
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('pause').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('shop').classList.add('hidden');
  document.getElementById('title').classList.remove('hidden');
  updateTitleStats();
}

function updateTitleStats() {
  document.getElementById('best').textContent = state.best;
  document.getElementById('title-best').textContent = state.best;
  document.getElementById('title-wave').textContent = state.bestWave;
  document.getElementById('title-kills').textContent = state.totalKills;
  document.getElementById('title-coins').textContent = state.coins;
  // Show selected ship + level summary on the title screen
  const ship = SHIPS[state.ship] || SHIPS.scout;
  const u = state.upgrades;
  const totalLevel = u.fireRate + u.hull + u.speed + u.damage;
  document.getElementById('title-ship').textContent = `${ship.icon} ${ship.name} · Lv ${totalLevel}/20`;
}

// ---------- Shop ----------
let shopReturn = 'title';
function openShop(from) {
  shopReturn = from;
  document.getElementById('title').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('shop').classList.remove('hidden');
  renderShop();
}
function closeShop() {
  document.getElementById('shop').classList.add('hidden');
  if (shopReturn === 'gameover') {
    document.getElementById('gameover').classList.remove('hidden');
  } else {
    document.getElementById('title').classList.remove('hidden');
    updateTitleStats();
  }
}

function renderShop() {
  document.getElementById('shop-wallet').textContent = state.coins;
  // Upgrade cards
  const upWrap = document.getElementById('shop-upgrades');
  upWrap.innerHTML = '';
  for (const [key, def] of Object.entries(UPGRADE_DEFS)) {
    const lvl = state.upgrades[key];
    const maxed = lvl >= def.max;
    const cost = maxed ? null : def.costs[lvl];
    const card = document.createElement('div');
    card.className = 'shop-card' + (maxed ? ' maxed' : '');
    const bar = Array.from({ length: def.max }, (_, i) => `<span class="${i < lvl ? 'filled' : ''}"></span>`).join('');
    card.innerHTML = `
      <div class="shop-card-row">
        <span class="icon">${def.icon}</span>
        <h4>${def.name}</h4>
        <span class="lvl">${lvl}/${def.max}</span>
      </div>
      <div class="bar">${bar}</div>
      <p class="desc">${def.per}</p>
      <button class="shop-buy" data-up="${key}" ${maxed || state.coins < cost ? 'disabled' : ''}>
        ${maxed ? 'MAX' : `Buy · 🪙 ${cost}`}
      </button>
    `;
    upWrap.appendChild(card);
  }
  upWrap.querySelectorAll('button[data-up]').forEach(b => {
    b.onclick = () => buyUpgrade(b.dataset.up);
  });

  // Ship cards
  const shipWrap = document.getElementById('shop-ships');
  shipWrap.innerHTML = '';
  for (const [id, def] of Object.entries(SHIPS)) {
    const owned = state.ownedShips.includes(id);
    const equipped = state.ship === id;
    const card = document.createElement('div');
    card.className = 'shop-card' + (equipped ? ' selected' : '');
    let btnHtml;
    if (equipped) {
      btnHtml = `<button class="shop-buy equipped" disabled>EQUIPPED</button>`;
    } else if (owned) {
      btnHtml = `<button class="shop-buy equip" data-equip="${id}">Equip</button>`;
    } else if (state.coins >= def.cost) {
      btnHtml = `<button class="shop-buy" data-buy-ship="${id}">Buy · 🪙 ${def.cost}</button>`;
    } else {
      btnHtml = `<button class="shop-buy" disabled>🪙 ${def.cost}</button>`;
    }
    card.innerHTML = `
      <div class="shop-card-row">
        <span class="icon" style="color:${def.color}">${def.icon}</span>
        <h4>${def.name}</h4>
      </div>
      <canvas class="ship-preview" data-ship="${id}" width="160" height="80"></canvas>
      <p class="desc">${def.desc}</p>
      ${btnHtml}
    `;
    shipWrap.appendChild(card);
  }
  // Render each ship preview on its mini canvas
  shipWrap.querySelectorAll('canvas.ship-preview').forEach(cv => {
    const id = cv.dataset.ship;
    drawShipPreview(cv, id);
  });
  shipWrap.querySelectorAll('button[data-buy-ship]').forEach(b => {
    b.onclick = () => buyShip(b.dataset.buyShip);
  });
  shipWrap.querySelectorAll('button[data-equip]').forEach(b => {
    b.onclick = () => { setShip(b.dataset.equip); sfx.power(); renderShop(); };
  });
}

function drawShipPreview(canvas, shipId) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 160 * dpr;
  canvas.height = 80 * dpr;
  canvas.style.width = '160px';
  canvas.style.height = '80px';
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, 160, 80);

  const ship = SHIPS[shipId] || SHIPS.scout;
  const r = 26;
  const cx = 80, cy = 40;

  c.save();
  c.translate(cx, cy);
  c.rotate(-0.06);    // slight tilt looks more dynamic than flat
  c.strokeStyle = ship.color;
  c.shadowColor = ship.color;
  c.shadowBlur = 14;
  c.lineWidth = 2.5;

  // Thrust glow
  c.save();
  const grad = c.createLinearGradient(-r * 0.6, 0, -r * 1.8, 0);
  grad.addColorStop(0, ship.color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = 0.75;
  c.fillStyle = grad;
  for (const e of (SHIP_ENGINES[shipId] || SHIP_ENGINES.scout)) {
    const ex = e.x * r, ey = e.y * r;
    c.beginPath();
    c.moveTo(ex, ey - r * 0.13);
    c.lineTo(ex - 22, ey);
    c.lineTo(ex, ey + r * 0.13);
    c.closePath();
    c.fill();
  }
  c.restore();

  drawShipInto(c, shipId, r);
  c.restore();
}

// Re-implement ship drawing against a passed-in ctx (so the shop preview
// can render without touching the global game canvas).
function drawShipInto(c, shipId, r) {
  if (shipId === 'striker') {
    c.beginPath();
    c.moveTo(r * 1.35, 0);
    c.lineTo(r * 0.5, -r * 0.3);
    c.lineTo(r * 0.7, -r * 0.95);
    c.lineTo(-r * 0.15, -r * 0.95);
    c.lineTo(-r * 0.4, -r * 0.45);
    c.lineTo(-r * 0.85, -r * 0.55);
    c.lineTo(-r * 0.95, 0);
    c.lineTo(-r * 0.85,  r * 0.55);
    c.lineTo(-r * 0.4,   r * 0.45);
    c.lineTo(-r * 0.15,  r * 0.95);
    c.lineTo(r * 0.7,    r * 0.95);
    c.lineTo(r * 0.5,    r * 0.3);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(r * 0.7, -r * 0.75); c.lineTo(r * 1.15, -r * 0.6);
    c.moveTo(r * 0.7,  r * 0.75); c.lineTo(r * 1.15,  r * 0.6);
    c.stroke();
  } else if (shipId === 'titan') {
    c.beginPath();
    c.moveTo(r * 1.15, 0);
    c.lineTo(r * 0.85, -r * 0.55);
    c.lineTo(r * 0.2, -r * 1.05);
    c.lineTo(-r * 0.55, -r * 1.05);
    c.lineTo(-r * 0.95, -r * 0.55);
    c.lineTo(-r * 0.95,  r * 0.55);
    c.lineTo(-r * 0.55,  r * 1.05);
    c.lineTo(r * 0.2,   r * 1.05);
    c.lineTo(r * 0.85,  r * 0.55);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(r * 0.55, -r * 0.55);
    c.lineTo(r * 0.95, 0);
    c.lineTo(r * 0.55,  r * 0.55);
    c.stroke();
    c.beginPath();
    c.moveTo(-r * 0.95, -r * 0.3); c.lineTo(-r * 0.6, -r * 0.3);
    c.moveTo(-r * 0.95,  r * 0.3); c.lineTo(-r * 0.6,  r * 0.3);
    c.stroke();
  } else if (shipId === 'crystal') {
    c.beginPath();
    c.moveTo(r * 1.35, 0);
    c.lineTo(r * 0.3, -r * 0.85);
    c.lineTo(-r * 0.85, -r * 0.5);
    c.lineTo(-r * 0.55, 0);
    c.lineTo(-r * 0.85,  r * 0.5);
    c.lineTo(r * 0.3,    r * 0.85);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(r * 1.35, 0); c.lineTo(-r * 0.55, 0);
    c.moveTo(r * 0.3, -r * 0.85); c.lineTo(r * 0.3,  r * 0.85);
    c.stroke();
  } else if (shipId === 'phantom') {
    c.beginPath();
    c.moveTo(r * 1.5, 0);
    c.lineTo(r * 0.4, -r * 0.22);
    c.lineTo(r * 0.05, -r * 1.0);
    c.lineTo(-r * 0.6, -r * 0.55);
    c.lineTo(-r * 0.85, -r * 0.18);
    c.lineTo(-r * 0.7, 0);
    c.lineTo(-r * 0.85,  r * 0.18);
    c.lineTo(-r * 0.6,   r * 0.55);
    c.lineTo(r * 0.05,   r * 1.0);
    c.lineTo(r * 0.4,    r * 0.22);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.arc(r * 0.7, 0, r * 0.14, 0, Math.PI * 2);
    c.moveTo(r * 0.3, 0); c.lineTo(-r * 0.55, 0);
    c.stroke();
  } else if (shipId === 'vortex') {
    c.beginPath();
    c.arc(0, 0, r * 1.05, -Math.PI * 0.65, Math.PI * 0.65, false);
    c.lineTo(r * 0.35, 0);
    c.arc(0, 0, r * 0.55, Math.PI * 0.65, -Math.PI * 0.65, true);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, r * 0.42, -Math.PI * 0.3, Math.PI * 0.3);
    c.stroke();
  } else if (shipId === 'comet') {
    c.beginPath();
    c.moveTo(r * 1.4, 0);
    c.bezierCurveTo(r * 0.9, -r * 0.55, r * 0.0, -r * 0.5, -r * 0.7, -r * 0.3);
    c.lineTo(-r * 0.85, 0);
    c.lineTo(-r * 0.7, r * 0.3);
    c.bezierCurveTo(r * 0.0, r * 0.5, r * 0.9, r * 0.55, r * 1.4, 0);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(-r * 0.1, -r * 0.45);
    c.quadraticCurveTo(-r * 0.6, -r * 0.95, -r * 0.95, -r * 0.5);
    c.moveTo(-r * 0.1,  r * 0.45);
    c.quadraticCurveTo(-r * 0.6,  r * 0.95, -r * 0.95,  r * 0.5);
    c.stroke();
    c.beginPath();
    c.arc(r * 0.55, 0, r * 0.13, 0, Math.PI * 2);
    c.stroke();
  } else if (shipId === 'trident') {
    c.beginPath();
    c.moveTo(r * 1.4, -r * 0.55);
    c.lineTo(r * 0.5, -r * 0.4);
    c.lineTo(r * 1.4, 0);
    c.lineTo(r * 0.5,  r * 0.4);
    c.lineTo(r * 1.4,  r * 0.55);
    c.lineTo(r * 0.35, r * 0.7);
    c.lineTo(-r * 0.55, r * 0.6);
    c.lineTo(-r * 0.95, 0);
    c.lineTo(-r * 0.55, -r * 0.6);
    c.lineTo(r * 0.35, -r * 0.7);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(r * 0.5, 0); c.lineTo(-r * 0.55, 0);
    c.stroke();
  } else {
    // scout
    c.beginPath();
    c.moveTo(r * 1.25, 0);
    c.lineTo(r * 0.25, -r * 0.4);
    c.lineTo(-r * 0.15, -r * 0.95);
    c.lineTo(-r * 0.75, -r * 0.55);
    c.lineTo(-r * 0.5,  -r * 0.18);
    c.lineTo(-r * 0.8, 0);
    c.lineTo(-r * 0.5,   r * 0.18);
    c.lineTo(-r * 0.75,  r * 0.55);
    c.lineTo(-r * 0.15,  r * 0.95);
    c.lineTo(r * 0.25,   r * 0.4);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.arc(r * 0.35, 0, r * 0.22, 0, Math.PI * 2);
    c.stroke();
  }
}

function buyUpgrade(key) {
  const def = UPGRADE_DEFS[key];
  const lvl = state.upgrades[key];
  if (lvl >= def.max) return;
  const cost = def.costs[lvl];
  if (state.coins < cost) return;
  state.coins -= cost;
  state.upgrades[key] = lvl + 1;
  saveCoins();
  saveUpgrades();
  sfx.power();
  renderShop();
}

function buyShip(id) {
  const def = SHIPS[id];
  if (!def || state.ownedShips.includes(id)) return;
  if (state.coins < def.cost) return;
  state.coins -= def.cost;
  state.ownedShips.push(id);
  saveOwnedShips();
  saveCoins();
  setShip(id);
  sfx.bigKill();
  renderShop();
}

// ---------- Wire UI ----------
document.getElementById('start-btn').onclick = () => {
  try { audio(); } catch (e) { /* mobile may block AudioContext — keep going, sfx is non-critical */ }
  startGame();
};
document.getElementById('how-btn').onclick = () => {
  document.getElementById('title').classList.add('hidden');
  document.getElementById('how').classList.remove('hidden');
  document.getElementById('how-back').classList.remove('hidden');
  document.getElementById('how-back-pause').classList.add('hidden');
};
document.getElementById('how-back').onclick = () => {
  document.getElementById('how').classList.add('hidden');
  document.getElementById('title').classList.remove('hidden');
};
document.getElementById('how-from-pause').onclick = () => {
  document.getElementById('pause').classList.add('hidden');
  document.getElementById('how').classList.remove('hidden');
  document.getElementById('how-back').classList.add('hidden');
  document.getElementById('how-back-pause').classList.remove('hidden');
};
document.getElementById('how-back-pause').onclick = () => {
  document.getElementById('how').classList.add('hidden');
  document.getElementById('pause').classList.remove('hidden');
};
document.getElementById('resume-btn').onclick = togglePause;
document.getElementById('quit-btn').onclick = () => {
  document.getElementById('pause').classList.add('hidden');
  backToTitle();
};
document.getElementById('retry-btn').onclick = startGame;
document.getElementById('title-btn').onclick = backToTitle;
document.getElementById('shop-btn').onclick = () => openShop('title');
document.getElementById('gameover-shop-btn').onclick = () => openShop('gameover');
document.getElementById('shop-back').onclick = closeShop;
document.getElementById('sound-btn').onclick = () => {
  state.soundOn = !state.soundOn;
  localStorage.setItem('gs_sound', state.soundOn ? 'on' : 'off');
  document.getElementById('sound-btn').textContent = state.soundOn ? '🔊' : '🔇';
};

// Sync HUD lives when player loses lives
const _origDamage = damagePlayer;
// Wrap to keep DOM in sync
window.addEventListener('blur', () => {});
const _drawWrap = draw;

// Repaint lives each frame (cheap)
function syncHud() {
  if (state.mode === 'playing' && state.player) {
    const el = document.getElementById('lives');
    if (el.children.length !== state.player.lives) buildLivesHud();
  }
}

// ---------- Main loop ----------
function loop(t) {
  const dt = state.last ? Math.min(64, t - state.last) : 16;
  state.last = t;
  update(dt);
  syncHud();
  draw();
  requestAnimationFrame(loop);
}

// Init
updateTitleStats();
document.getElementById('sound-btn').textContent = state.soundOn ? '🔊' : '🔇';
requestAnimationFrame(loop);
