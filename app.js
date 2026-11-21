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

// ---------- Math problem generators (grade-banded) ----------
// Each generator returns { prompt: string, answer: number, hint?: string }.
// Answers are always exact numbers; checks are integer-equal or |delta| < 1e-3.
const MATH_GENS = {
  '7': [
    // Two-step with negatives: -3x + 7 = -8 → x=5
    () => { const x = randi(2, 9), a = randi(2, 6), b = randi(-9, 9); const c = -a * x + b; return { prompt: `Solve for x:  −${a}x + ${b >= 0 ? b : '(' + b + ')'} = ${c}`, answer: x }; },
    // Variables on both sides: 5x - 8 = 2x + 7 → x=5
    () => { const x = randi(2, 8), a = randi(3, 7), b = randi(1, a - 1), c = randi(-9, 9); return { prompt: `Solve:  ${a}x + ${c} = ${b}x + ${(a - b) * x + c}`, answer: x }; },
    // Distributive: 4(2x - 3) + 5 = 25 → x=4
    () => { const a = randi(2, 5), x = randi(2, 7), b = randi(2, 6), c = randi(-5, 5); const total = a * (2 * x - b) + c; return { prompt: `${a}(2x − ${b}) + ${c} = ${total}.  x = ?`, answer: x }; },
    // Negative arithmetic: (-7) - (-12) + (-3) = 2
    () => { const a = randi(-15, 15), b = randi(-15, 15), c = randi(-15, 15); return { prompt: `(${a}) − (${b}) + (${c}) = ?`, answer: a - b + c }; },
    // Combined percent: 80 → +25% → -10%
    () => { const start = randi(4, 10) * 20, up = [10, 20, 25][randi(0, 2)], dn = [10, 15, 20][randi(0, 2)]; const ans = Math.round(start * (1 + up / 100) * (1 - dn / 100) * 100) / 100; return { prompt: `${start} increased by ${up}%, then decreased by ${dn}% = ?`, answer: ans }; },
    // Ratio: 3:5 = x:25 → x=15
    () => { const a = randi(2, 7), b = randi(a + 1, a + 7), k = randi(2, 8); return { prompt: `${a}:${b} = x:${b * k}.  x = ?`, answer: a * k }; },
    // Order of ops: 24 ÷ 2 - 5 × (3-1) → 12 - 10 = 2
    () => { const a = randi(2, 6), b = randi(2, 5), c = randi(2, 6), d = randi(2, 4); return { prompt: `${a * b * 2} ÷ ${a} − ${c} × (${d + 1} − ${d}) = ?`, answer: b * 2 - c }; },
    // Mixed fraction: 3/4 + 5/6 over 12 → 19
    () => { const ans = 14 + randi(0, 8); return { prompt: `2/3 + 5/12 + 1/4 written with denominator 12, the numerator is ?`, answer: 8 + 5 + 3 }; },
    // GCD/divisibility
    () => { const a = randi(2, 6), b = randi(3, 6), x = a * b * randi(2, 5), y = a * b * randi(3, 7); return { prompt: `Greatest common factor of ${x} and ${y} ≥ ${a * b}.  GCF = ?`, answer: gcd(x, y) }; },
  ],
  '8': [
    // Real Pythagorean (find c, not c²)
    () => { const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [9, 40, 41], [20, 21, 29], [6, 8, 10], [9, 12, 15]]; const t = triples[randi(0, triples.length - 1)]; return { prompt: `Right triangle legs ${t[0]} and ${t[1]}. Hypotenuse = ?`, answer: t[2] }; },
    // Sum of squares + sqrt: √(9 + 16) = 5
    () => { const a = randi(3, 8), b = randi(3, 12); return { prompt: `√(${a}² + ${b}²) (round to 2 decimals)`, answer: Math.round(Math.sqrt(a * a + b * b) * 100) / 100 }; },
    // 2^x = N
    () => { const p = randi(3, 7); return { prompt: `2^x = ${Math.pow(2, p)}.  x = ?`, answer: p }; },
    // Powers + sums
    () => { const a = randi(2, 4), b = randi(2, 3); return { prompt: `${a}^${randi(2, 4)} + ${b}^${randi(2, 4)} where exponents are 4 and 3 respectively: ${a}^4 + ${b}^3 = ?`, answer: Math.pow(a, 4) + Math.pow(b, 3) }; },
    // Three-step linear: 3(x + 4) - 2x = 19
    () => { const x = randi(2, 9), b = randi(2, 6); const lhs = 3 * (x + b) - 2 * x; return { prompt: `3(x + ${b}) − 2x = ${lhs}.  x = ?`, answer: x }; },
    // Solve quadratic-square: x² = N
    () => { const x = randi(5, 14); return { prompt: `x² = ${x * x}.  Positive value of x = ?`, answer: x }; },
    // Slope through two points
    () => { const m = randi(-4, 5) || 2, x1 = randi(-4, 4), y1 = randi(-6, 6), dx = randi(2, 5); return { prompt: `Slope of line through (${x1}, ${y1}) and (${x1 + dx}, ${y1 + m * dx}) = ?`, answer: m }; },
    // f(x) = 2x² - x at given x
    () => { const x = randi(-3, 5); return { prompt: `f(x) = 2x² − x.  f(${x}) = ?`, answer: 2 * x * x - x }; },
    // Scientific notation arithmetic
    () => { const a = randi(2, 9), b = randi(2, 9), p = randi(2, 4); return { prompt: `${a} × 10^${p} + ${b} × 10^${p - 1} = ?`, answer: a * Math.pow(10, p) + b * Math.pow(10, p - 1) }; },
    // Simplify cube root
    () => { const x = randi(2, 5); return { prompt: `∛${x * x * x} = ?`, answer: x }; },
  ],
  '9': [
    // Quadratic factoring — give larger root
    () => {
      const r1 = randi(-6, -1), r2 = randi(1, 7);
      const b = -(r1 + r2), c = r1 * r2;
      const bStr = b >= 0 ? `+ ${b}` : `− ${-b}`;
      const cStr = c >= 0 ? `+ ${c}` : `− ${-c}`;
      return { prompt: `Roots of x² ${bStr}x ${cStr} = 0.  Larger root = ?`, answer: Math.max(r1, r2) };
    },
    // Quadratic formula proper
    () => {
      const roots = [[1, 6], [2, 5], [3, 4], [-2, 6], [-3, 5], [1, 8]];
      const [r1, r2] = roots[randi(0, roots.length - 1)];
      const b = -(r1 + r2), c = r1 * r2;
      const bStr = b >= 0 ? `+ ${b}` : `− ${-b}`;
      const cStr = c >= 0 ? `+ ${c}` : `− ${-c}`;
      return { prompt: `x² ${bStr}x ${cStr} = 0.  Larger root = ?`, answer: Math.max(r1, r2) };
    },
    // Function composition
    () => {
      const a = randi(2, 4), b = randi(1, 5), x = randi(2, 4);
      return { prompt: `f(x) = ${a}x + ${b}.  g(x) = x².  f(g(${x})) = ?`, answer: a * x * x + b };
    },
    // Distance formula
    () => {
      const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
      const t = triples[randi(0, triples.length - 1)];
      return { prompt: `Distance from (0, 0) to (${t[0]}, ${t[1]}) = ?`, answer: t[2] };
    },
    // Slope-intercept from standard form
    () => {
      const a = randi(2, 5), b = randi(2, 4), k = a * randi(3, 8);
      return { prompt: `${a}x + ${b}y = ${k}.  y-intercept = ?`, answer: k / b };
    },
    // Systems of equations
    () => {
      const x = randi(2, 6), y = randi(1, 5);
      return { prompt: `Solve:  3x − y = ${3 * x - y},  x + 2y = ${x + 2 * y}.  x = ?`, answer: x };
    },
    // Vertex of parabola: y = x² - 8x + 11 → vertex x = 4
    () => {
      const h = randi(2, 6), k = randi(-5, 5);
      // y = (x - h)² + k = x² - 2hx + h² + k
      return { prompt: `Parabola  y = x² − ${2 * h}x + ${h * h + k}.  Vertex x-coordinate = ?`, answer: h };
    },
    // Simplify radical: √72 = a√b where b is square-free
    () => {
      const a = randi(2, 6), b = [2, 3, 5, 6, 7][randi(0, 4)];
      return { prompt: `Simplify  √${a * a * b} = a√${b}.  a = ?`, answer: a };
    },
    // Inequality: 3x - 5 < 16 → x < 7
    () => {
      const a = randi(2, 5), b = randi(1, 9), x = randi(3, 8);
      return { prompt: `${a}x − ${b} < ${a * x - b + 1}.  Largest integer x that satisfies = ?`, answer: x };
    },
  ],
  '10': [
    // Quadratic formula — sum of roots (Vieta)
    () => {
      const r1 = randi(-4, 4) || 1, r2 = randi(-4, 4) || -1;
      const b = -(r1 + r2), c = r1 * r2;
      const bStr = b >= 0 ? `+ ${b}` : `− ${-b}`;
      const cStr = c >= 0 ? `+ ${c}` : `− ${-c}`;
      return { prompt: `x² ${bStr}x ${cStr} = 0.  Sum of roots = ?`, answer: r1 + r2 };
    },
    // Trig identity: sin² + cos² = 1
    () => {
      const a = [30, 45, 60][randi(0, 2)];
      return { prompt: `sin²(${a}°) + cos²(${a}°) = ?`, answer: 1 };
    },
    // sin · cos at specific angles
    () => {
      const opts = [{ a: 30, v: Math.round(Math.sqrt(3) / 4 * 1000) / 1000 }, { a: 45, v: 0.5 }, { a: 60, v: Math.round(Math.sqrt(3) / 4 * 1000) / 1000 }];
      const o = opts[randi(0, 2)];
      return { prompt: `sin(${o.a}°) × cos(${o.a}°) = ?  (3 decimals)`, answer: o.v };
    },
    // Combined log
    () => {
      const a = [2, 3, 4, 5][randi(0, 3)], p1 = randi(2, 5);
      const b = [2, 3, 4][randi(0, 2)], p2 = randi(2, 4);
      return { prompt: `log_${a}(${Math.pow(a, p1)}) + log_${b}(${Math.pow(b, p2)}) = ?`, answer: p1 + p2 };
    },
    // Polynomial expansion: constant term of (x+a)(x-b)(x+c)
    () => {
      const a = randi(2, 5), b = randi(2, 5), c = randi(2, 5);
      return { prompt: `Constant term of (x + ${a})(x − ${b})(x + ${c}) = ?`, answer: a * -b * c };
    },
    // Vector magnitude
    () => {
      const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]];
      const t = triples[randi(0, triples.length - 1)];
      return { prompt: `Magnitude of vector ⟨${t[0]}, ${t[1]}⟩ = ?`, answer: t[2] };
    },
    // Area of right triangle with given legs
    () => {
      const a = randi(3, 12), b = randi(4, 15);
      return { prompt: `Right triangle with legs ${a} and ${b}.  Area = ?`, answer: a * b / 2 };
    },
    // Absolute value equation: |2x - 3| = 11 → larger x = 7
    () => {
      const a = randi(2, 5), b = randi(1, 7), x = randi(3, 8);
      const k = a * x - b;
      return { prompt: `|${a}x − ${b}| = ${k}.  Larger solution x = ?`, answer: x };
    },
    // Composition of sqrt: f(f(81)) where f(x) = √x
    () => {
      const x4 = [16, 81, 256, 625, 1296][randi(0, 4)];
      const x = Math.round(Math.sqrt(Math.sqrt(x4)));
      return { prompt: `f(x) = √x.  f(f(${x4})) = ?`, answer: x };
    },
    // Polygon angle sum
    () => {
      const n = randi(4, 12);
      return { prompt: `Sum of interior angles of a ${n}-gon (degrees) = ?`, answer: (n - 2) * 180 };
    },
  ],
};

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }

function nextMathProblem() {
  const grade = state.mathGrade || '7';
  const pool = MATH_GENS[grade] || MATH_GENS['7'];
  return pool[randi(0, pool.length - 1)]();
}

function setMathGrade(g) {
  state.mathGrade = g;
  localStorage.setItem('gs_math_grade', g);
}

function openMathGate() {
  state.mathPending = nextMathProblem();
  // Pause the game while the gate is up — update() bails out on this mode
  state.mode = 'math';
  const m = document.getElementById('math-gate');
  document.getElementById('math-grade').textContent = `Grade ${state.mathGrade}`;
  document.getElementById('math-prompt').textContent = state.mathPending.prompt;
  const fb = document.getElementById('math-feedback');
  fb.textContent = '';
  fb.className = 'math-feedback';
  const inp = document.getElementById('math-input');
  inp.value = '';
  m.classList.remove('hidden');
  // Focus input after the screen transitions in
  setTimeout(() => inp.focus(), 100);
}

function submitMathAnswer() {
  if (!state.mathPending || state.mode !== 'math') return;
  const inp = document.getElementById('math-input');
  const raw = (inp.value || '').trim();
  if (raw === '') return;
  const v = parseFloat(raw);
  const correct = state.mathPending.answer;
  const close = !isNaN(v) && Math.abs(v - correct) < 1e-3;
  const fb = document.getElementById('math-feedback');
  if (close) {
    state.mathSolved++;
    state.runCoins += 150;
    state.score += 100;
    fb.textContent = `✓ Correct! +150 🪙 +100 score`;
    fb.className = 'math-feedback good';
    sfx.power();
    setTimeout(() => closeMathGate(true), 700);
  } else {
    fb.textContent = `✗ Not quite — answer was ${correct}. Next wave still loading…`;
    fb.className = 'math-feedback bad';
    sfx.wrong && sfx.wrong();
    setTimeout(() => closeMathGate(false), 1400);
  }
}

function closeMathGate(/* solved */) {
  state.mathPending = null;
  document.getElementById('math-gate').classList.add('hidden');
  state.betweenWaves = false;
  state.mode = 'playing';
  const w = state.mathNextWave || (state.wave + 1);
  state.mathNextWave = 0;
  startWave(w);
}

// Vertex-side count per enemy shape (used for the "weak point" bonus).
// Orbiter is a circle — no vertices, no bonus.
const SHAPE_SIDES = { tri: 3, sq: 4, diamond: 4, star4: 4, cross: 4, pent: 5, hex: 6, hept: 7, octa: 8, star: 10 };

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
  highestWaveCleared: parseInt(localStorage.getItem('gs_highest_wave') || '0', 10),
  startWave: 0,   // 0 = default to highest checkpoint on first title render
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
  mathGrade: localStorage.getItem('gs_math_grade') || '7',
  mathPending: null,        // { prompt, answer, hint } while modal is up
  mathNextWave: 0,          // wave to start after solving
  mathSolved: 0,            // per-run count
};

// ---------- Upgrade & ship config ----------
const UPGRADE_DEFS = {
  fireRate: { name: 'Fire Rate', icon: '⚡', max: 5, costs: [50, 100, 200, 400, 800],   per: '−15ms per tier' },
  hull:     { name: 'Hull',      icon: '❤',  max: 5, costs: [100, 200, 400, 800, 1600], per: '+1 starting life' },
  speed:    { name: 'Speed',     icon: '🚀', max: 5, costs: [50, 100, 200, 400, 800],   per: '+0.4 max speed' },
  damage:   { name: 'Damage',    icon: '💥', max: 5, costs: [100, 200, 400, 800, 1600], per: '+1 bullet damage' },
};

// Ships get strictly better as they get pricier (George: "make the good
// ones actually good").  Expensive ships STACK: bigger base stats, more
// shots per volley, AND several bullet effects at once.
//   shots:  1 single · 2 twin (parallel) · 3 triple spread · 5 fan
//   fx:     slow · explode · fire · homing (flags) · pierce / chain (counts)
//   drones: little helper ships that orbit you and fire on their own
const SHIPS = {
  scout:   { name: 'Scout',   icon: '🛸', cost: 0,     color: '#7df9ff', desc: 'Balanced starter.',
             mods: {} },
  striker: { name: 'Striker', icon: '⚔️', cost: 500,   color: '#fff85d', desc: '+20% fire rate, but −1 life.',
             mods: { fireMul: 0.83, livesAdd: -1 } },
  titan:   { name: 'Titan',   icon: '🛡️', cost: 1200,  color: '#6ee7b7', desc: 'Tanky: +2 lives, a bit slower.',
             mods: { livesAdd: 2, speedMul: 0.85 } },
  crystal: { name: 'Crystal', icon: '💎', cost: 2200,  color: '#ff5dd2', desc: '+1 damage on every shot.',
             mods: { dmgAdd: 1 } },
  phantom: { name: 'Phantom', icon: '🌟', cost: 3500,  color: '#fa5400', desc: 'Tiny hitbox, fast, +1 damage.',
             mods: { dmgAdd: 1, hitboxMul: 0.7, speedMul: 1.2, fireMul: 0.92 } },
  vortex:  { name: 'Vortex',  icon: '🌀', cost: 4500,  color: '#c084fc', desc: 'Shots freeze-slow enemies. +1 dmg, +1 life.',
             mods: { dmgAdd: 1, livesAdd: 1, fx: { slow: true } } },
  comet:   { name: 'Comet',   icon: '☄️', cost: 6500,  color: '#ff8c42', desc: 'Twin shots that EXPLODE. +1 dmg.',
             mods: { dmgAdd: 1, shots: 2, fx: { explode: true } } },
  trident: { name: 'Trident', icon: '🔱', cost: 9000,  color: '#5ee3e0', desc: 'Always triple shot. +1 dmg, +1 life.',
             mods: { dmgAdd: 1, livesAdd: 1, shots: 3 } },
  inferno: { name: 'Inferno', icon: '🔥', cost: 12000, color: '#ff6b35', desc: 'Triple FLAMING shots that burn. +2 dmg.',
             mods: { dmgAdd: 2, shots: 3, fireMul: 0.9, fx: { fire: true } } },
  photon:  { name: 'Photon',  icon: '✨', cost: 16000, color: '#b794f6', desc: 'Triple shots pierce 3 enemies + slow. +2 dmg.',
             mods: { dmgAdd: 2, livesAdd: 1, shots: 3, fireMul: 0.85, fx: { pierce: 3, slow: true } } },
  voltage: { name: 'Voltage', icon: '⚡', cost: 22000, color: '#fbbf24', desc: 'Every hit zaps lightning to 2 more enemies. +2 dmg.',
             mods: { dmgAdd: 2, livesAdd: 1, shots: 3, fireMul: 0.8, fx: { chain: 2, pierce: 1 } } },
  seeker:  { name: 'Seeker',  icon: '🎯', cost: 28000, color: '#34d399', desc: 'HOMING flaming shots + a helper drone. +3 dmg.',
             mods: { dmgAdd: 3, livesAdd: 1, shots: 3, fireMul: 0.8, drones: 1, fx: { homing: true, fire: true } } },
  nova:    { name: 'Nova',    icon: '💫', cost: 36000, color: '#f472b6', desc: '5-shot fan of burning explosions + 2 drones. +3 dmg.',
             mods: { dmgAdd: 3, livesAdd: 2, shots: 5, fireMul: 0.8, drones: 2, fx: { explode: true, fire: true } } },
  eclipse: { name: 'Eclipse', icon: '🌑', cost: 48000, color: '#e2e8f0', desc: 'Homing, piercing, chain-lightning 5-shot fan + 2 drones. +4 dmg.',
             mods: { dmgAdd: 4, livesAdd: 2, shots: 5, fireMul: 0.75, speedMul: 1.1, drones: 2, fx: { homing: true, pierce: 3, chain: 2, slow: true } } },
  omega:   { name: 'Omega',   icon: '👑', cost: 65000, color: '#ffd700', desc: 'THE ULTIMATE SHIP. Every effect at once + 4 drones. +5 dmg.',
             mods: { dmgAdd: 5, livesAdd: 3, shots: 5, fireMul: 0.7, speedMul: 1.15, hitboxMul: 0.8, drones: 4,
                     fx: { homing: true, explode: true, fire: true, slow: true, pierce: 3, chain: 3 } } },
};

const FX_LABELS = {
  slow: '❄ Slow', explode: '💥 Explode', fire: '🔥 Burn', homing: '🎯 Homing', pierce: '✨ Pierce', chain: '⚡ Chain',
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
  // The zones are marked up with a CLASS (.stick-zone-left), not an id.
  // Looking them up by id returned null and threw here on every touch
  // device — which killed the rest of this script, so START never got
  // wired up on iPad.  Look up by class, and bail safely if anything's missing.
  const zone = document.getElementById(zoneId) || document.querySelector('.' + zoneId);
  const stick = document.getElementById(stickId);
  const knob = document.getElementById(knobId);
  if (!zone || !stick || !knob) return;
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
// Particle budget so big ships + big fights stay smooth on iPad.
const MAX_PARTICLES = 900;
function pushParticle(p) {
  if (state.particles.length < MAX_PARTICLES) state.particles.push(p);
}

function spawnParticles(x, y, color, n = 12, speed = 4, life = 600) {
  if (state.particles.length > MAX_PARTICLES * 0.7) n = Math.min(n, 3);
  if (state.particles.length >= MAX_PARTICLES) return;
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
function computeLoadout(shipId) {
  // Combine upgrades + ship modifiers into the per-run stats the player uses.
  const u = state.upgrades;
  const ship = SHIPS[shipId || state.ship] || SHIPS.scout;
  const mods = ship.mods || {};
  // Defensive: avoid `??` so older iOS Safari (< 13.4) can still parse this
  // file.  If parsing fails, the whole script dies and the START button
  // never binds — exactly the symptom we keep hitting on iPads.
  const def = (v, d) => (v === undefined || v === null) ? d : v;
  const fireRate = Math.max(55, (CFG.player.fireRate - u.fireRate * 15) * def(mods.fireMul, 1));
  const maxSpeed = (CFG.player.maxSpeed + u.speed * 0.4) * def(mods.speedMul, 1);
  const lives = Math.max(1, 3 + u.hull + def(mods.livesAdd, 0));
  const bulletDmg = 1 + u.damage + def(mods.dmgAdd, 0);
  const hitboxMul = def(mods.hitboxMul, 1);
  return {
    fireRate, maxSpeed, lives, bulletDmg, hitboxMul,
    color: ship.color,
    shots: def(mods.shots, 1),
    fx: mods.fx || null,
    drones: def(mods.drones, 0),
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
    shots: lo.shots,
    fx: lo.fx,
    drones: lo.drones,
    droneFire: 0,
  };
}

// Each ship draws as a stroked silhouette in the local frame, facing +x.
// `r` is the visual radius — kept constant across ships so the hitbox
// change on Phantom doesn't shrink the rendered ship.
const SHIP_DRAW = {
  scout(c, r) {
    // Sleek fighter: pointed nose, swept-back wings, central cockpit
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
    // Cockpit bubble
    c.beginPath();
    c.arc(r * 0.35, 0, r * 0.22, 0, TAU);
    c.stroke();
  },
  striker(c, r) {
    // Aggressive: long body + forward-swept wings + twin barrels
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
    // Twin gun barrels extending past the wings
    c.beginPath();
    c.moveTo(r * 0.7, -r * 0.75); c.lineTo(r * 1.15, -r * 0.6);
    c.moveTo(r * 0.7,  r * 0.75); c.lineTo(r * 1.15,  r * 0.6);
    c.stroke();
  },
  titan(c, r) {
    // Bulky armored hex-front cruiser
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
    // Shield ridge across the prow
    c.beginPath();
    c.moveTo(r * 0.55, -r * 0.55);
    c.lineTo(r * 0.95, 0);
    c.lineTo(r * 0.55,  r * 0.55);
    c.stroke();
    // Rear engine block lines
    c.beginPath();
    c.moveTo(-r * 0.95, -r * 0.3); c.lineTo(-r * 0.6, -r * 0.3);
    c.moveTo(-r * 0.95,  r * 0.3); c.lineTo(-r * 0.6,  r * 0.3);
    c.stroke();
  },
  crystal(c, r) {
    // Faceted kite/diamond
    c.beginPath();
    c.moveTo(r * 1.35, 0);
    c.lineTo(r * 0.3, -r * 0.85);
    c.lineTo(-r * 0.85, -r * 0.5);
    c.lineTo(-r * 0.55, 0);
    c.lineTo(-r * 0.85,  r * 0.5);
    c.lineTo(r * 0.3,    r * 0.85);
    c.closePath();
    c.stroke();
    // Inner facet lines
    c.beginPath();
    c.moveTo(r * 1.35, 0); c.lineTo(-r * 0.55, 0);
    c.moveTo(r * 0.3, -r * 0.85); c.lineTo(r * 0.3,  r * 0.85);
    c.stroke();
  },
  phantom(c, r) {
    // Sleek stealth — long swept wings + small canopy
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
    // Canopy + center fin
    c.beginPath();
    c.arc(r * 0.7, 0, r * 0.14, 0, TAU);
    c.moveTo(r * 0.3, 0); c.lineTo(-r * 0.55, 0);
    c.stroke();
  },
  vortex(c, r) {
    // Crescent / sickle — outer arc curving around a central core
    c.beginPath();
    c.arc(0, 0, r * 1.05, -Math.PI * 0.65, Math.PI * 0.65, false);
    c.lineTo(r * 0.35, 0);
    c.arc(0, 0, r * 0.55, Math.PI * 0.65, -Math.PI * 0.65, true);
    c.closePath();
    c.stroke();
    // Central core + small inner orbit ring
    c.beginPath();
    c.arc(0, 0, r * 0.22, 0, TAU);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, r * 0.42, -Math.PI * 0.3, Math.PI * 0.3);
    c.stroke();
  },
  comet(c, r) {
    // Compact teardrop with twin curved fins — looks like a missile
    c.beginPath();
    c.moveTo(r * 1.4, 0);
    c.bezierCurveTo(r * 0.9, -r * 0.55, r * 0.0, -r * 0.5, -r * 0.7, -r * 0.3);
    c.lineTo(-r * 0.85, 0);
    c.lineTo(-r * 0.7, r * 0.3);
    c.bezierCurveTo(r * 0.0, r * 0.5, r * 0.9, r * 0.55, r * 1.4, 0);
    c.closePath();
    c.stroke();
    // Curved fins
    c.beginPath();
    c.moveTo(-r * 0.1, -r * 0.45);
    c.quadraticCurveTo(-r * 0.6, -r * 0.95, -r * 0.95, -r * 0.5);
    c.moveTo(-r * 0.1,  r * 0.45);
    c.quadraticCurveTo(-r * 0.6,  r * 0.95, -r * 0.95,  r * 0.5);
    c.stroke();
    // Cockpit dot
    c.beginPath();
    c.arc(r * 0.55, 0, r * 0.13, 0, TAU);
    c.stroke();
  },
  trident(c, r) {
    // Three-prong forward attack — like a trident
    c.beginPath();
    c.moveTo(r * 1.4, -r * 0.55);          // top prong tip
    c.lineTo(r * 0.5, -r * 0.4);
    c.lineTo(r * 1.4, 0);                  // center prong tip
    c.lineTo(r * 0.5,  r * 0.4);
    c.lineTo(r * 1.4,  r * 0.55);          // bottom prong tip
    c.lineTo(r * 0.35, r * 0.7);           // wing tip lower
    c.lineTo(-r * 0.55, r * 0.6);
    c.lineTo(-r * 0.95, 0);
    c.lineTo(-r * 0.55, -r * 0.6);
    c.lineTo(r * 0.35, -r * 0.7);          // wing tip upper
    c.closePath();
    c.stroke();
    // Central spine
    c.beginPath();
    c.moveTo(r * 0.5, 0); c.lineTo(-r * 0.55, 0);
    c.stroke();
  },
  inferno(c, r) {
    // Flame-shaped fighter with curved tail tips
    c.beginPath();
    c.moveTo(r * 1.3, 0);
    c.bezierCurveTo(r * 0.7, -r * 0.4, r * 0.2, -r * 0.55, -r * 0.2, -r * 0.85);
    c.lineTo(-r * 0.5, -r * 0.35);
    c.lineTo(-r * 0.85, -r * 0.55);
    c.lineTo(-r * 0.95, 0);
    c.lineTo(-r * 0.85, r * 0.55);
    c.lineTo(-r * 0.5, r * 0.35);
    c.lineTo(-r * 0.2, r * 0.85);
    c.bezierCurveTo(r * 0.2, r * 0.55, r * 0.7, r * 0.4, r * 1.3, 0);
    c.closePath();
    c.stroke();
    // Inner flame curl
    c.beginPath();
    c.arc(r * 0.2, 0, r * 0.32, -Math.PI * 0.6, Math.PI * 0.6);
    c.stroke();
  },
  photon(c, r) {
    // Prism / crystal-light shape — outer diamond with bright inner beam
    c.beginPath();
    c.moveTo(r * 1.4, 0);
    c.lineTo(r * 0.2, -r * 0.85);
    c.lineTo(-r * 0.85, -r * 0.35);
    c.lineTo(-r * 0.85, r * 0.35);
    c.lineTo(r * 0.2, r * 0.85);
    c.closePath();
    c.stroke();
    // Inner beam axis + diagonals
    c.beginPath();
    c.moveTo(r * 1.4, 0); c.lineTo(-r * 0.85, 0);
    c.moveTo(r * 0.2, -r * 0.85); c.lineTo(r * 0.2, r * 0.85);
    c.stroke();
  },
  voltage(c, r) {
    // Jagged lightning-bolt silhouette
    c.beginPath();
    c.moveTo(r * 1.35, -r * 0.05);
    c.lineTo(r * 0.55, -r * 0.6);
    c.lineTo(r * 0.75, -r * 0.15);
    c.lineTo(r * 0.05, -r * 0.85);
    c.lineTo(-r * 0.35, -r * 0.4);
    c.lineTo(-r * 0.85, -r * 0.55);
    c.lineTo(-r * 0.65, 0);
    c.lineTo(-r * 0.85, r * 0.55);
    c.lineTo(-r * 0.35, r * 0.4);
    c.lineTo(r * 0.05, r * 0.85);
    c.lineTo(r * 0.75, r * 0.15);
    c.lineTo(r * 0.55, r * 0.6);
    c.closePath();
    c.stroke();
    // Spark in the core
    c.beginPath();
    c.moveTo(r * 0.4, -r * 0.2);
    c.lineTo(-r * 0.2, r * 0.2);
    c.stroke();
  },
  seeker(c, r) {
    // Arrowhead with a targeting reticle
    c.beginPath();
    c.moveTo(r * 1.4, 0);
    c.lineTo(-r * 0.2, -r * 0.9);
    c.lineTo(-r * 0.6, -r * 0.9);
    c.lineTo(-r * 0.3, -r * 0.3);
    c.lineTo(-r * 0.9, 0);
    c.lineTo(-r * 0.3, r * 0.3);
    c.lineTo(-r * 0.6, r * 0.9);
    c.lineTo(-r * 0.2, r * 0.9);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.arc(r * 0.25, 0, r * 0.28, 0, TAU);
    c.moveTo(r * 0.25 - r * 0.42, 0); c.lineTo(r * 0.25 + r * 0.42, 0);
    c.moveTo(r * 0.25, -r * 0.42); c.lineTo(r * 0.25, r * 0.42);
    c.stroke();
  },
  nova(c, r) {
    // Starburst cruiser: 4 swept blades around a glowing core
    c.beginPath();
    c.moveTo(r * 1.45, 0);
    c.lineTo(r * 0.35, -r * 0.3);
    c.lineTo(r * 0.3, -r * 1.05);
    c.lineTo(-r * 0.2, -r * 0.35);
    c.lineTo(-r * 0.95, -r * 0.55);
    c.lineTo(-r * 0.55, 0);
    c.lineTo(-r * 0.95, r * 0.55);
    c.lineTo(-r * 0.2, r * 0.35);
    c.lineTo(r * 0.3, r * 1.05);
    c.lineTo(r * 0.35, r * 0.3);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.arc(r * 0.05, 0, r * 0.3, 0, TAU);
    c.stroke();
    c.beginPath();
    c.arc(r * 0.05, 0, r * 0.12, 0, TAU);
    c.stroke();
  },
  eclipse(c, r) {
    // Dark ring with a crescent blade sweeping forward
    c.beginPath();
    c.arc(0, 0, r * 0.75, 0, TAU);
    c.stroke();
    c.beginPath();
    c.moveTo(r * 1.45, 0);
    c.quadraticCurveTo(r * 0.6, -r * 1.25, -r * 0.95, -r * 0.85);
    c.quadraticCurveTo(-r * 0.2, -r * 0.6, r * 0.55, 0);
    c.quadraticCurveTo(-r * 0.2, r * 0.6, -r * 0.95, r * 0.85);
    c.quadraticCurveTo(r * 0.6, r * 1.25, r * 1.45, 0);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.arc(-r * 0.15, 0, r * 0.22, 0, TAU);
    c.stroke();
  },
  omega(c, r) {
    // Royal flagship: crown-tipped prow, layered wings, gem core
    c.beginPath();
    c.moveTo(r * 1.5, 0);
    c.lineTo(r * 1.05, -r * 0.25);
    c.lineTo(r * 1.2, -r * 0.6);
    c.lineTo(r * 0.6, -r * 0.45);
    c.lineTo(r * 0.45, -r * 1.1);
    c.lineTo(-r * 0.25, -r * 0.6);
    c.lineTo(-r * 1.0, -r * 0.95);
    c.lineTo(-r * 0.7, -r * 0.25);
    c.lineTo(-r * 1.0, 0);
    c.lineTo(-r * 0.7, r * 0.25);
    c.lineTo(-r * 1.0, r * 0.95);
    c.lineTo(-r * 0.25, r * 0.6);
    c.lineTo(r * 0.45, r * 1.1);
    c.lineTo(r * 0.6, r * 0.45);
    c.lineTo(r * 1.2, r * 0.6);
    c.lineTo(r * 1.05, r * 0.25);
    c.closePath();
    c.stroke();
    // Gem core
    c.beginPath();
    c.moveTo(r * 0.55, 0);
    c.lineTo(r * 0.15, -r * 0.28);
    c.lineTo(-r * 0.25, 0);
    c.lineTo(r * 0.15, r * 0.28);
    c.closePath();
    c.stroke();
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
  inferno: [{ x: -0.9, y: 0 }],
  photon:  [{ x: -0.85, y: -0.18 }, { x: -0.85, y: 0.18 }],
  voltage: [{ x: -0.75, y: 0 }],
  seeker:  [{ x: -0.85, y: 0 }],
  nova:    [{ x: -0.6, y: -0.3 }, { x: -0.6, y: 0.3 }],
  eclipse: [{ x: -0.75, y: -0.2 }, { x: -0.75, y: 0.2 }],
  omega:   [{ x: -0.95, y: -0.45 }, { x: -0.95, y: 0 }, { x: -0.95, y: 0.45 }],
};

// Helper drones (Seeker / Nova / Eclipse / Omega) orbit the ship.
function dronePositions(p) {
  const out = [];
  const n = p.drones || 0;
  for (let i = 0; i < n; i++) {
    const a = state.t / 700 + (i / n) * TAU;
    out.push({ x: p.x + Math.cos(a) * 34, y: p.y + Math.sin(a) * 34 });
  }
  return out;
}

function drawDrones(p) {
  if (!p.drones) return;
  ctx.save();
  ctx.strokeStyle = p.color;
  ctx.shadowColor = p.color;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 1.8;
  for (const d of dronePositions(p)) {
    ctx.beginPath();
    ctx.moveTo(d.x, d.y - 6);
    ctx.lineTo(d.x + 5, d.y);
    ctx.lineTo(d.x, d.y + 6);
    ctx.lineTo(d.x - 5, d.y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function updateDrones(p) {
  if (!p.drones || state.enemies.length === 0) return;
  if (state.t - p.droneFire < 420) return;
  p.droneFire = state.t;
  const dmg = Math.max(1, Math.ceil((p.bulletDmg || 1) * 0.5));
  for (const d of dronePositions(p)) {
    let best = null, bestD = 520;
    for (const e of state.enemies) {
      const dd = len(e.x - d.x, e.y - d.y);
      if (dd < bestD) { bestD = dd; best = e; }
    }
    if (!best) continue;
    const a = Math.atan2(best.y - d.y, best.x - d.x);
    state.bullets.push({
      x: d.x, y: d.y,
      vx: Math.cos(a) * CFG.bullet.speed, vy: Math.sin(a) * CFG.bullet.speed,
      life: CFG.bullet.life, age: 0, dmg, fx: null, pierceLeft: 0, color: p.color, small: true,
    });
  }
}

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
  SHIP_DRAW[shipId](ctx, r);

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
  updateDrones(p);
}

// Volley patterns. `side` = sideways offset (twin guns), `a` = angle offset.
const SHOT_PATTERNS = {
  1: [{ a: 0, side: 0 }],
  2: [{ a: 0, side: -6 }, { a: 0, side: 6 }],
  3: [{ a: -0.2, side: 0 }, { a: 0, side: 0 }, { a: 0.2, side: 0 }],
  5: [{ a: -0.36, side: 0 }, { a: -0.18, side: 0 }, { a: 0, side: 0 }, { a: 0.18, side: 0 }, { a: 0.36, side: 0 }],
  7: [{ a: -0.48, side: 0 }, { a: -0.32, side: 0 }, { a: -0.16, side: 0 }, { a: 0, side: 0 },
      { a: 0.16, side: 0 }, { a: 0.32, side: 0 }, { a: 0.48, side: 0 }],
};

function fireBullets(p) {
  // Triple Shot power-up STACKS with the ship: single/twin → 3, 3 → 5, 5 → 7.
  let shots = p.shots || 1;
  if (state.active && state.active.kind === 'triple') shots = shots < 3 ? 3 : shots + 2;
  const pattern = SHOT_PATTERNS[shots] || SHOT_PATTERNS[1];
  const fx = p.fx || null;
  for (const s of pattern) {
    const a = p.angle + s.a;
    const px = -Math.sin(p.angle) * s.side, py = Math.cos(p.angle) * s.side;
    state.bullets.push({
      x: p.x + Math.cos(a) * p.r + px,
      y: p.y + Math.sin(a) * p.r + py,
      vx: Math.cos(a) * CFG.bullet.speed,
      vy: Math.sin(a) * CFG.bullet.speed,
      life: CFG.bullet.life,
      age: 0,
      dmg: p.bulletDmg || 1,
      fx,
      pierceLeft: fx && fx.pierce ? fx.pierce : 0,
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
// big:  boss-class — gets a named HP bar, survives ramming, takes partial
//       bomb damage, never spawns as an elite.
// mini: mini-boss (one of three, rotating on waves 8, 13, 18, 23…)
const ENEMY_KINDS = {
  drifter:  { hp: 2,  r: 14, speed: 1.0,  color: '#ff5dd2', score: 10,  coin: 1,  shape: 'hex' },
  zoomer:   { hp: 1,  r: 11, speed: 2.6,  color: '#fff85d', score: 20,  coin: 2,  shape: 'tri' },
  weaver:   { hp: 2,  r: 13, speed: 1.7,  color: '#a3e635', score: 20,  coin: 2,  shape: 'diamond' },
  splitter: { hp: 3,  r: 17, speed: 1.3,  color: '#6ee7b7', score: 30,  coin: 3,  shape: 'sq' },
  swarmer:  { hp: 1,  r: 8,  speed: 2.3,  color: '#fb923c', score: 8,   coin: 1,  shape: 'tri' },
  orbiter:  { hp: 3,  r: 13, speed: 1.5,  color: '#7df9ff', score: 40,  coin: 4,  shape: 'circle' },
  sniper:   { hp: 4,  r: 14, speed: 1.2,  color: '#60a5fa', score: 60,  coin: 6,  shape: 'pent' },
  tank:     { hp: 7,  r: 22, speed: 0.75, color: '#ff4d6d', score: 80,  coin: 8,  shape: 'octa' },
  // Shielder removed per George's request — replaced by aggressive chasers.
  hunter:   { hp: 8,  r: 15, speed: 2.1,  color: '#ff3860', score: 150, coin: 14, shape: 'tri' },
  pulsar:   { hp: 6,  r: 17, speed: 1.0,  color: '#a78bfa', score: 90,  coin: 9,  shape: 'star4' },
  blinker:  { hp: 5,  r: 14, speed: 1.4,  color: '#f0abfc', score: 100, coin: 10, shape: 'hept' },
  warden:   { hp: 18, r: 24, speed: 1.15, color: '#38d39f', score: 220, coin: 22, shape: 'sq' },
  mender:   { hp: 8,  r: 16, speed: 1.1,  color: '#86efac', score: 140, coin: 14, shape: 'cross' },
  colossus: { hp: 40, r: 32, speed: 0.55, color: '#f6b93b', score: 500, coin: 55, shape: 'hex' },
  // Mini-bosses — real bosses with their own attack patterns
  sentinel: { hp: 70, r: 34, speed: 1.0,  color: '#22d3ee', score: 400, coin: 60, shape: 'hex',     big: true, mini: true, name: 'MINI-BOSS · SENTINEL' },
  hive:     { hp: 80, r: 36, speed: 0.6,  color: '#facc15', score: 400, coin: 60, shape: 'octa',    big: true, mini: true, name: 'MINI-BOSS · HIVE QUEEN' },
  ravager:  { hp: 75, r: 32, speed: 1.0,  color: '#f43f5e', score: 400, coin: 60, shape: 'diamond', big: true, mini: true, name: 'MINI-BOSS · RAVAGER' },
  boss:     { hp: 180, r: 46, speed: 0.95, color: '#ff5dd2', score: 800, coin: 120, shape: 'star',  big: true, name: 'BOSS' },
};
const MINI_BOSSES = ['sentinel', 'hive', 'ravager'];

// Ranged / support enemies stay on screen once they've arrived so the wave
// can always be finished (and so you can always shoot them).
const KEEP_ON_SCREEN = { sniper: 1, pulsar: 1, mender: 1, blinker: 1, sentinel: 1, hive: 1, ravager: 1 };

function isMiniBossWave(n) { return n >= 8 && n % 5 === 3; }   // 8, 13, 18, 23, 28…

// Per-wave HP scaling. Linear through wave 20, then compounding so a
// maxed-out pilot still gets a fight.  Bosses scale gentler than before
// (George: "bosses are a bit too hard").
function enemyHpScale(kind, wave) {
  const big = ENEMY_KINDS[kind] && ENEMY_KINDS[kind].big;
  const w = Math.max(0, wave - 5);
  let s = 1 + w * (big ? 0.4 : 0.32);
  if (wave > 20) s *= Math.pow(1.12, wave - 20);   // wave 25 ≈ 1.76×, wave 30 ≈ 3.1×
  return s;
}

// Late-game speed boost (cap +80%) so enemies catch up to a maxed player.
function enemySpeedScale(wave) {
  return 1 + Math.min(0.8, Math.max(0, wave - 5) * 0.055);
}

// Elite spawn — any regular enemy can be elevated on high waves:
// 3× HP, +30% speed, +40% size, drops 2× coins.
function eliteChance(wave) {
  if (wave < 10) return 0;
  return Math.min(0.28, (wave - 10) * 0.018);   // 0% @ w10 → 28% @ w25+
}

function makeEnemy(kind, x, y, opts = {}) {
  const k = ENEMY_KINDS[kind];
  const scale = (opts.hp ? 1 : enemyHpScale(kind, state.wave));
  let hp = Math.ceil((opts.hp || k.hp) * scale);
  let speed = (opts.speed || k.speed) * (k.big ? 1 : enemySpeedScale(state.wave));
  let r = opts.r || k.r;
  let score = opts.score || k.score;
  let coin = k.coin || 1;
  let elite = false;
  if (!opts.hp && !opts.noElite && !k.big && Math.random() < eliteChance(state.wave)) {
    elite = true;
    hp = Math.ceil(hp * 3);
    speed *= 1.3;
    r *= 1.4;
    score = Math.round(score * 2);
    coin *= 2;
  }
  return {
    kind, x, y, vx: 0, vy: 0,
    r, hp, maxHp: hp, speed,
    color: k.color,
    shape: k.shape,
    big: !!k.big, mini: !!k.mini,
    name: kind === 'boss' ? (MILESTONES[state.wave] ? `BOSS · ${MILESTONES[state.wave]}` : 'BOSS') : k.name,
    score, coin, elite,
    born: state.t,
    fireT: state.t + rand(1200, 2400),
    orbitA: rand(0, TAU),
    spinPhase: rand(0, TAU),
  };
}

function spawnEnemyAtEdge(kind, near) {
  let x, y;
  if (near) {
    // Packs (swarmers) arrive together from the same spot
    x = near.x + rand(-26, 26); y = near.y + rand(-26, 26);
  } else {
    const side = randi(0, 3);
    if (side === 0) { x = rand(0, state.w); y = -30; }
    else if (side === 1) { x = state.w + 30; y = rand(0, state.h); }
    else if (side === 2) { x = rand(0, state.w); y = state.h + 30; }
    else { x = -30; y = rand(0, state.h); }
  }
  return makeEnemy(kind, x, y);
}

// Accelerate toward (tx, ty) with friction and a speed cap.
function steer(e, tx, ty, accel, fric, cap) {
  e.vx += tx * accel; e.vy += ty * accel;
  e.vx *= fric; e.vy *= fric;
  const sp = len(e.vx, e.vy);
  if (sp > cap) { e.vx = e.vx / sp * cap; e.vy = e.vy / sp * cap; }
}

function spawnEBullet(x, y, a, speed, opts) {
  opts = opts || {};
  state.ebullets.push({
    x, y,
    vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
    life: CFG.enemyBullet.life, age: 0,
    r: opts.r || CFG.enemyBullet.r,
    color: opts.color || null,
  });
}

function pickAnchor(e) {
  const p = state.player;
  let ax = state.w / 2, ay = state.h * 0.3;
  for (let tries = 0; tries < 8; tries++) {
    ax = rand(state.w * 0.15, state.w * 0.85);
    ay = rand(state.h * 0.15, state.h * 0.75);
    if (len(ax - p.x, ay - p.y) > 200) break;
  }
  e.ax = ax; e.ay = ay;
}

function updateEnemy(e, dt) {
  const p = state.player;
  const dx = p.x - e.x, dy = p.y - e.y;
  const d = len(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  e.spinPhase += e.big ? 0.02 : 0.04;

  switch (e.kind) {
    case 'drifter': case 'splitter': case 'tank': case 'warden': case 'colossus':
      // Direct chase (colossus and warden included — George wants strong
      // things that actually MOVE toward you)
      steer(e, ux, uy, e.speed * 0.12, 0.92, e.speed);
      break;

    case 'swarmer':
      steer(e, ux, uy, e.speed * 0.2, 0.93, e.speed);
      break;

    case 'weaver': {
      // Snakes toward you in an S-curve — hard to line up a shot
      const wob = Math.sin(state.t / 260 + e.orbitA) * 1.3;
      const tx = ux - uy * wob, ty = uy + ux * wob;
      const tl = len(tx, ty) || 1;
      e.vx = tx / tl * e.speed; e.vy = ty / tl * e.speed;
      break;
    }

    case 'hunter': {
      // Aggressive dasher — steers straight for you with a periodic burst
      e.vx += ux * e.speed * 0.18;
      e.vy += uy * e.speed * 0.18;
      e.dashT = (e.dashT || 0) + dt;
      const dashing = e.dashT > 1400 && e.dashT < 1900;
      if (e.dashT > 1900) e.dashT = 0;
      const cap = e.speed * (dashing ? 1.7 : 1);
      e.vx *= 0.9; e.vy *= 0.9;
      const sp = len(e.vx, e.vy);
      if (sp > cap) { e.vx = e.vx / sp * cap; e.vy = e.vy / sp * cap; }
      break;
    }

    case 'zoomer': {
      // commits to a direction once close, otherwise chases
      if (d < 320) { e.vx += ux * 0.18; e.vy += uy * 0.18; }
      const sp = len(e.vx, e.vy);
      if (sp > e.speed) { e.vx = e.vx / sp * e.speed; e.vy = e.vy / sp * e.speed; }
      if (sp < 0.1) { e.vx = ux * e.speed; e.vy = uy * e.speed; }
      break;
    }

    case 'orbiter': {
      // orbits at distance + shoots
      const desired = 240;
      e.orbitA += 0.03;
      const tx = Math.cos(e.orbitA), ty = Math.sin(e.orbitA);
      e.vx = ux * 0.6 * Math.sign(d - desired) * e.speed + (-ty) * e.speed * 0.7;
      e.vy = uy * 0.6 * Math.sign(d - desired) * e.speed + (tx) * e.speed * 0.7;
      if (state.t > e.fireT) {
        e.fireT = state.t + rand(1800, 2800);
        enemyShoot(e);
      }
      break;
    }

    case 'sniper': {
      // Hangs back, locks on with a red laser, then fires a FAST shot at
      // where you were.  Keep moving and it misses.
      const want = Math.min(380, Math.min(state.w, state.h) * 0.42);
      const radial = d > want + 30 ? 1 : d < want - 30 ? -1 : 0;
      e.orbitA += 0.01;
      const strafe = Math.sin(e.orbitA) >= 0 ? 0.5 : -0.5;
      const slowAim = e.aimUntil ? 0.15 : 1;
      e.vx = (ux * radial - uy * strafe) * e.speed * slowAim;
      e.vy = (uy * radial + ux * strafe) * e.speed * slowAim;
      if (!e.aimUntil && state.t > e.fireT && e.onScreen) {
        e.aimUntil = state.t + 900;
        e.aimX = p.x; e.aimY = p.y;
      } else if (e.aimUntil && state.t >= e.aimUntil) {
        spawnEBullet(e.x, e.y, Math.atan2(e.aimY - e.y, e.aimX - e.x), 8.5, { r: 4.5, color: '#60a5fa' });
        e.aimUntil = 0;
        e.fireT = state.t + rand(2600, 3400);
      }
      break;
    }

    case 'pulsar': {
      // Floats to mid-range and pulses out a ring of bullets
      const radial = d > 230 ? 1 : -0.5;
      steer(e, ux * radial, uy * radial, e.speed * 0.1, 0.93, e.speed);
      if (state.t > e.fireT && e.onScreen) {
        e.fireT = state.t + 2800;
        const n = state.wave >= 20 ? 10 : 8;
        const off = rand(0, TAU);
        for (let i = 0; i < n; i++) spawnEBullet(e.x, e.y, off + (i / n) * TAU, 3.1, { color: '#a78bfa' });
      }
      break;
    }

    case 'blinker': {
      // Drifts toward you, flickers, then TELEPORTS close by
      steer(e, ux, uy, e.speed * 0.1, 0.92, e.speed);
      e.blinkT = (e.blinkT || 0) + dt;
      if (e.blinkT > 3000 && e.onScreen) {
        e.blinkT = 0;
        spawnParticles(e.x, e.y, e.color, 10, 4, 400);
        const a = rand(0, TAU), rr = rand(150, 210);
        e.x = clamp(p.x + Math.cos(a) * rr, 30, state.w - 30);
        e.y = clamp(p.y + Math.sin(a) * rr, 30, state.h - 30);
        e.vx = 0; e.vy = 0;
        spawnParticles(e.x, e.y, e.color, 10, 4, 400);
      }
      break;
    }

    case 'mender': {
      // Support unit — keeps its distance and HEALS nearby enemies.
      // Shoot it first!
      const radial = d > 300 ? 0.6 : -1;
      steer(e, ux * radial, uy * radial, e.speed * 0.1, 0.92, e.speed);
      if (state.t > e.fireT && e.onScreen) {
        e.fireT = state.t + 2400;
        e.healFlash = state.t;
        for (const o of state.enemies) {
          if (o === e || o.big || o.hp <= 0 || o.hp >= o.maxHp) continue;
          if (len(o.x - e.x, o.y - e.y) < 170) {
            o.hp = Math.min(o.maxHp, o.hp + Math.ceil(o.maxHp * 0.25));
            addFloatText(o.x, o.y - o.r - 6, '+', '#86efac');
          }
        }
      }
      break;
    }

    // ----- Mini-bosses -----
    case 'sentinel': {
      // Glides between anchor points, then stops and spins out spiral streams
      if (!e.phase) { e.phase = 'move'; e.phaseT = 0; pickAnchor(e); }
      e.phaseT += dt;
      if (e.phase === 'move') {
        const ax = e.ax - e.x, ay = e.ay - e.y, ad = len(ax, ay) || 1;
        steer(e, ax / ad, ay / ad, 0.12, 0.93, 2.2);
        if (e.phaseT > 1800 && e.onScreen) { e.phase = 'fire'; e.phaseT = 0; e.shotT = 0; }
      } else {
        e.vx *= 0.9; e.vy *= 0.9;
        e.shotT -= dt;
        if (e.shotT <= 0) {
          e.shotT = 150;
          const arms = state.wave >= 23 ? 4 : 3;
          e.spiralA = (e.spiralA || 0) + 0.26;
          for (let i = 0; i < arms; i++) spawnEBullet(e.x, e.y, e.spiralA + (i / arms) * TAU, 3, { color: '#22d3ee' });
        }
        if (e.phaseT > 2200) { e.phase = 'move'; e.phaseT = 0; pickAnchor(e); }
      }
      break;
    }

    case 'hive': {
      // Slow mother ship: hatches swarmers + fires 3-shot spreads
      steer(e, ux, uy, e.speed * 0.1, 0.93, e.speed);
      e.spawnT = (e.spawnT || 0) + dt;
      if (e.spawnT > 3800 && e.onScreen && state.enemies.length < 45) {
        e.spawnT = 0;
        const n = state.wave >= 23 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const a = rand(0, TAU);
          const s = makeEnemy('swarmer', e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, { noElite: true });
          s.vx = Math.cos(a) * 3; s.vy = Math.sin(a) * 3;
          s.onScreen = true;
          state.enemies.push(s);
        }
        spawnParticles(e.x, e.y, e.color, 14, 5, 500);
      }
      if (state.t > e.fireT && e.onScreen) {
        e.fireT = state.t + 1900;
        const a = Math.atan2(dy, dx);
        for (const off of [-0.25, 0, 0.25]) spawnEBullet(e.x, e.y, a + off, 3.6, { color: '#facc15' });
      }
      break;
    }

    case 'ravager': {
      // Stalks you, winds up (red warning line), CHARGES, then bursts
      if (!e.phase) { e.phase = 'stalk'; e.phaseT = 0; }
      e.phaseT += dt;
      if (e.phase === 'stalk') {
        steer(e, ux, uy, 0.1, 0.92, e.speed);
        if (e.phaseT > 1600 && e.onScreen) { e.phase = 'windup'; e.phaseT = 0; e.aimX = p.x; e.aimY = p.y; }
      } else if (e.phase === 'windup') {
        e.vx *= 0.85; e.vy *= 0.85;
        if (e.phaseT > 800) {
          const a = Math.atan2(e.aimY - e.y, e.aimX - e.x);
          const sp = 8 + Math.min(3, state.wave * 0.08);
          e.vx = Math.cos(a) * sp; e.vy = Math.sin(a) * sp;
          e.phase = 'dash'; e.phaseT = 0;
          shake(4);
        }
      } else {
        const atWall = e.x <= e.r + 2 || e.x >= state.w - e.r - 2 || e.y <= e.r + 2 || e.y >= state.h - e.r - 2;
        if (e.phaseT > 650 || (atWall && e.phaseT > 100)) {
          e.vx *= 0.2; e.vy *= 0.2;
          const n = state.wave >= 23 ? 12 : 8;
          const off = rand(0, TAU);
          for (let i = 0; i < n; i++) spawnEBullet(e.x, e.y, off + (i / n) * TAU, 3, { color: '#f43f5e' });
          spawnParticles(e.x, e.y, e.color, 18, 6, 500);
          shake(6);
          e.phase = 'stalk'; e.phaseT = 0;
        }
      }
      break;
    }

    case 'boss': {
      // drifts around upper area + shoots
      const target = { x: state.w / 2 + Math.sin(state.t / 1200) * 200, y: state.h * 0.28 + Math.cos(state.t / 1700) * 60 };
      e.vx += (target.x - e.x) * 0.0015;
      e.vy += (target.y - e.y) * 0.0015;
      e.vx *= 0.97; e.vy *= 0.97;
      if (state.t > e.fireT) {
        // Toned down (George: bosses too hard): slower cadence, fewer
        // bullets, and every ring has a GAP you can slip through.
        const cool = Math.max(750, 1250 - state.wave * 12);
        e.fireT = state.t + cool;
        e.volley = (e.volley || 0) + 1;
        if (e.volley % 3 === 0) bossFan(e); else bossBarrage(e);
      }
      break;
    }
  }

  const slowMul = (e.slowUntil && state.t < e.slowUntil) ? (e.big ? 0.7 : 0.4) : 1;
  const tailMul = e.big ? 1 : (state.tailMul || 1);
  e.x += e.vx * state.slowmo * slowMul * tailMul;
  e.y += e.vy * state.slowmo * slowMul * tailMul;

  if (!e.onScreen && e.x > e.r && e.x < state.w - e.r && e.y > e.r && e.y < state.h - e.r) e.onScreen = true;
  if (e.onScreen && KEEP_ON_SCREEN[e.kind]) {
    e.x = clamp(e.x, e.r, state.w - e.r);
    e.y = clamp(e.y, e.r, state.h - e.r);
  }

  // Burn damage-over-time: every 250ms while burning, take fireDmg.
  if (e.fireUntil && state.t < e.fireUntil) {
    if (state.t - (e.fireLastTick || 0) > 250) {
      e.fireLastTick = state.t;
      e.hp -= (e.fireDmg || 0.4);
      pushParticle({
        x: e.x + rand(-e.r * 0.5, e.r * 0.5),
        y: e.y + rand(-e.r * 0.5, 0),
        vx: rand(-0.6, 0.6), vy: -1.6,
        size: 2.5, life: 480, age: 0, color: '#ff6b35',
      });
    }
  }
}

function enemyShoot(e) {
  const p = state.player;
  spawnEBullet(e.x, e.y, Math.atan2(p.y - e.y, p.x - e.x), CFG.enemyBullet.speed);
}

function bossBarrage(boss) {
  // Rotating ring with a 3-bullet gap — find the gap and you're safe.
  const N = Math.min(18, 10 + Math.floor(state.wave / 5));
  const base = state.t / 400;
  const gap = randi(0, N - 1);
  for (let i = 0; i < N; i++) {
    const k = (i - gap + N) % N;
    if (k < 3) continue;
    spawnEBullet(boss.x, boss.y, base + (i / N) * TAU, CFG.enemyBullet.speed * 0.8);
  }
}

function bossFan(boss) {
  // Aimed 5-bullet fan — sidestep it.
  const p = state.player;
  const a = Math.atan2(p.y - boss.y, p.x - boss.x);
  for (let i = -2; i <= 2; i++) spawnEBullet(boss.x, boss.y, a + i * 0.2, CFG.enemyBullet.speed * 0.9);
}

// --- Shape paths (shared by the game canvas and the enemy guide) ---
function polyPath(c, sides, r) {
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * TAU - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
}
function starPath(c, points, outer, inner) {
  for (let i = 0; i <= points * 2; i++) {
    const a = (i / (points * 2)) * TAU - Math.PI / 2;
    const r = (i % 2 === 0) ? outer : inner;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
}
function traceShape(c, shape, r) {
  c.beginPath();
  if (shape === 'circle') {
    c.arc(0, 0, r, 0, TAU);
    c.moveTo(r * 0.55, 0);
    c.arc(0, 0, r * 0.55, 0, TAU);
  } else if (shape === 'star') {
    starPath(c, 5, r, r * 0.5);
  } else if (shape === 'star4') {
    starPath(c, 4, r, r * 0.45);
  } else if (shape === 'diamond') {
    c.moveTo(0, -r); c.lineTo(r * 0.68, 0); c.lineTo(0, r); c.lineTo(-r * 0.68, 0); c.closePath();
  } else if (shape === 'cross') {
    const t = r * 0.36;
    const pts = [[-t, -r], [t, -r], [t, -t], [r, -t], [r, t], [t, t], [t, r], [-t, r], [-t, t], [-r, t], [-r, -t], [-t, -t]];
    pts.forEach((q, i) => { if (i === 0) c.moveTo(q[0], q[1]); else c.lineTo(q[0], q[1]); });
    c.closePath();
  } else {
    polyPath(c, SHAPE_SIDES[shape] || 6, r);
  }
  c.stroke();
}

function drawEnemy(e) {
  // Lock-on warning lines (Sniper aim, Ravager wind-up) — world space
  const aiming = (e.kind === 'sniper' && e.aimUntil) || (e.kind === 'ravager' && e.phase === 'windup');
  if (aiming) {
    const a = Math.atan2(e.aimY - e.y, e.aimX - e.x);
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(state.t / 50);
    ctx.strokeStyle = e.color;
    ctx.lineWidth = e.kind === 'ravager' ? e.r * 0.9 : 1.5;
    if (e.kind === 'ravager') ctx.globalAlpha *= 0.35;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(a) * 1400, e.y + Math.sin(a) * 1400);
    ctx.stroke();
    ctx.restore();
  }
  // Mender heal pulse
  if (e.kind === 'mender' && e.healFlash && state.t - e.healFlash < 450) {
    const k = (state.t - e.healFlash) / 450;
    ctx.save();
    ctx.globalAlpha = 0.6 * (1 - k);
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, 20 + 150 * k, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.kind === 'ravager' && e.phase === 'windup') ctx.translate(rand(-2.5, 2.5), rand(-2.5, 2.5));
  if (e.kind === 'blinker' && (e.blinkT || 0) > 2400) ctx.globalAlpha = Math.floor(state.t / 70) % 2 ? 0.25 : 1;
  ctx.strokeStyle = e.color;
  ctx.shadowColor = e.color;
  ctx.shadowBlur = (e.elite || e.big) ? 22 : 14;
  ctx.lineWidth = e.elite || e.big ? 3.4 : 2.5;
  const r = e.r;
  ctx.rotate(e.spinPhase);

  traceShape(ctx, e.shape, r);
  if (e.kind === 'boss') {
    traceShape(ctx, 'star', r * 0.7);
  } else if (e.mini) {
    // Counter-rotating inner core marks a mini-boss
    ctx.save();
    ctx.rotate(-e.spinPhase * 3);
    ctx.lineWidth = 2;
    traceShape(ctx, e.shape, r * 0.55);
    ctx.restore();
  }

  // Attack tells: Boss & Pulsar glow white just before they fire
  const tell = (e.kind === 'boss' || e.kind === 'pulsar') && e.fireT - state.t < 300 && e.fireT > state.t;
  if (tell) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, TAU); ctx.stroke();
  }

  // Elite: white pulsing halo ring around the enemy
  if (e.elite) {
    ctx.shadowBlur = 24;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 + 0.3 * Math.sin(state.t / 140)})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, r + 6, 0, TAU);
    ctx.stroke();
  }

  // HP indicator for tougher regular enemies
  if (e.maxHp > 1 && !e.big) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = e.color;
    ctx.globalAlpha = clamp(e.hp / e.maxHp, 0, 1);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// Named HP bars for bosses and mini-bosses, stacked at the top.
function drawBigBars() {
  let row = 0;
  for (const e of state.enemies) {
    if (!e.big) continue;
    const w = Math.min(state.w - 40, 480);
    const x = (state.w - w) / 2;
    const y = 74 + row * 30;
    ctx.save();
    ctx.font = '800 11px Quicksand, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = e.color;
    ctx.fillText(e.name || 'BOSS', state.w / 2, y - 4);
    ctx.fillStyle = 'rgba(10, 14, 38, 0.7)';
    ctx.fillRect(x, y, w, 9);
    ctx.fillStyle = e.color;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 12;
    ctx.fillRect(x, y, w * clamp(e.hp / e.maxHp, 0, 1), 9);
    ctx.restore();
    row++;
  }
}

function killEnemy(e, fromPlayer = true) {
  spawnParticles(e.x, e.y, e.color, e.big ? 90 : 18, e.big ? 9 : 5, e.big ? 1400 : 700);
  shake(e.big ? 22 : 8);

  if (fromPlayer) {
    bumpCombo();
    const pts = Math.round(e.score * state.combo);
    state.score += pts;
    state.kills++;
    state.totalKills++;
    // Coins: base from enemy, bumped by combo (capped at 3x so the wallet
    // doesn't explode on long chains).
    const baseCoin = e.coin || Math.max(1, Math.floor((e.score || 10) / 10));
    const comboMul = 1 + Math.min(2, state.combo / 5);
    const coinReward = Math.max(1, Math.round(baseCoin * comboMul));
    state.runCoins += coinReward;
    addFloatText(e.x, e.y, `+${pts}`, e.color);
    addFloatText(e.x, e.y + 14, `🪙 ${coinReward}`, '#fff85d');

    if (e.big) sfx.bigKill();
    else sfx.kill();

    // Maybe drop power-up (bosses & mini-bosses always drop one)
    if (Math.random() < CFG.powerupDrop || e.big) {
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
  // Warden explodes into 3 fast zoomers on death — punishes killing it
  // in the middle of a swarm.
  if (e.kind === 'warden') {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + rand(-0.3, 0.3);
      const baby = makeEnemy('zoomer', e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14, { r: 9, hp: 1, score: 20 });
      baby.vx = Math.cos(a) * 3.5;
      baby.vy = Math.sin(a) * 3.5;
      state.enemies.push(baby);
    }
    addFloatText(e.x, e.y - 30, 'WARDEN BURST!', '#38d39f');
  }

  // Remove from array
  const idx = state.enemies.indexOf(e);
  if (idx >= 0) state.enemies.splice(idx, 1);

  if (e.kind === 'boss') {
    addFloatText(state.w / 2, state.h / 2 - 60, 'BOSS DOWN!', '#fff85d');
  } else if (e.mini) {
    addFloatText(state.w / 2, state.h / 2 - 60, 'MINI-BOSS DOWN!', e.color);
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
    if (e.big) {
      // Bombs chunk big enemies instead of one-shotting them
      e.hp -= Math.max(12, Math.ceil(e.maxHp * (e.mini ? 0.2 : 0.1)));
      if (e.hp <= 0) killEnemy(e);
    } else killEnemy(e);
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

  // Banner — milestone name wins; otherwise mini-boss / generic
  const milestoneName = MILESTONES[n];
  if (milestoneName) {
    showBanner(`WAVE ${n}`, milestoneName);
    state.milestonesHit.push({ wave: n, name: milestoneName });
  } else if (isMiniBossWave(n)) {
    const minis = miniBossesFor(n).map(k => ENEMY_KINDS[k].name.replace('MINI-BOSS · ', ''));
    showBanner(`WAVE ${n} · MINI-BOSS`, minis.join(' + '));
  } else if (n === 1) {
    showBanner(`WAVE ${n}`, 'INCOMING');
  } else {
    showBanner(`WAVE ${n}`, '');
  }
}

// Which mini-boss(es) guard a mini-boss wave.  They rotate Sentinel → Hive
// → Ravager, and from wave 28 two different ones team up.
function miniBossesFor(n) {
  const idx = Math.floor((n - 8) / 5) % MINI_BOSSES.length;
  const list = [MINI_BOSSES[idx]];
  if (n >= 28) list.push(MINI_BOSSES[(idx + 1) % MINI_BOSSES.length]);
  return list;
}

// Spawn weights for regular waves.  Each enemy unlocks at a wave and its
// weight shifts as waves climb (early fodder fades, heavies grow).
function enemyWeights(n) {
  const w = [];
  const add = (kind, from, weight) => { if (n >= from && weight > 0) w.push([kind, weight]); };
  add('drifter',  1,  Math.max(0.5, 6 - n * 0.4));
  add('zoomer',   1,  3);
  add('weaver',   3,  2.4);
  add('splitter', 3,  2.2);
  add('swarmer',  4,  1.4);
  add('orbiter',  5,  2);
  add('sniper',   6,  1.3);
  add('tank',     7,  1.5);
  add('hunter',   8,  1 + Math.min(1.5, (n - 8) * 0.12));
  add('pulsar',   9,  1.2);
  add('blinker',  11, 1.2);
  add('warden',   12, 0.8 + Math.min(1.2, (n - 12) * 0.1));
  add('mender',   14, 0.7);
  add('colossus', 15, 0.4 + Math.min(1.2, (n - 15) * 0.08));
  return w;
}

function pickWeighted(list) {
  let total = 0;
  for (const it of list) total += it[1];
  let r = Math.random() * total;
  for (const it of list) { r -= it[1]; if (r <= 0) return it[0]; }
  return list[list.length - 1][0];
}

// Push a regular enemy into the queue; swarmers arrive as a pack.
function queueEnemy(q, kind, delay, n) {
  if (kind === 'swarmer') {
    const pack = n >= 15 ? 6 : 4;
    for (let i = 0; i < pack; i++) {
      q.push({ kind, delay: i < pack - 1 ? 70 : delay, follow: i > 0 });
    }
    return 2;   // a pack takes up two "slots" of the wave budget
  }
  q.push({ kind, delay });
  return 1;
}

function buildWave(n) {
  const q = [];
  // Major boss every 5 waves — fewer, lighter escorts than before
  if (n % CFG.bossEvery === 0) {
    q.push({ kind: 'boss', delay: 900 });
    const minions = Math.min(4, 1 + Math.floor(n / 10));
    for (let i = 0; i < minions; i++) {
      const r = Math.random();
      const escort = n >= 20 ? (r < 0.35 ? 'warden' : r < 0.7 ? 'hunter' : 'tank')
                   : n >= 15 ? (r < 0.35 ? 'hunter' : r < 0.7 ? 'tank' : 'orbiter')
                   : n >= 10 ? (r < 0.5 ? 'tank' : 'orbiter')
                   : 'orbiter';
      q.push({ kind: escort, delay: 1400 });
    }
    return q;
  }
  // Mini-boss waves (8, 13, 18, 23…): a REAL mini-boss + a light swarm
  if (isMiniBossWave(n)) {
    const minis = miniBossesFor(n);
    q.push({ kind: minis[0], delay: 1500 });
    const swarm = 4 + Math.floor(n / 5);
    const pool = enemyWeights(Math.min(n, 12));
    for (let i = 0; i < swarm; ) {
      i += queueEnemy(q, pickWeighted(pool), rand(700, 1100), n);
      if (minis[1] && i >= Math.floor(swarm / 2) && !q.some(s => s.kind === minis[1])) {
        q.push({ kind: minis[1], delay: 1500 });
      }
    }
    return q;
  }
  const minDelay = Math.max(220, 450 - n * 12);
  const maxDelay = Math.max(420, 850 - n * 20);
  const totalBase = 5 + Math.floor(n * 1.1);
  const pool = enemyWeights(n);
  for (let i = 0; i < totalBase; ) {
    i += queueEnemy(q, pickWeighted(pool), rand(minDelay, maxDelay), n);
  }
  return q;
}

function updateWave(dt) {
  // Spawn from queue
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const s = state.spawnQueue.shift();
      const en = spawnEnemyAtEdge(s.kind, s.follow ? state.lastSpawn : null);
      state.lastSpawn = { x: en.x, y: en.y };
      state.enemies.push(en);
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
    // Wave clear → shop, then level select.  (George: "once you finish a
    // level, it takes you to the shop, and when you press start you can
    // choose which level to do".)
    state.betweenWaves = true;
    const N = state.wave;
    state.score += 25;
    if (N > state.highestWaveCleared) {
      state.highestWaveCleared = N;
      localStorage.setItem('gs_highest_wave', String(N));
    }
    addFloatText(state.w / 2, state.h / 2 - 20, `WAVE ${N} CLEAR`, '#fff85d');
    // Also bank the run's coin haul now so the shop actually has spending
    // money in it — otherwise you'd stare at an empty wallet mid-run.
    if (state.runCoins > 0) {
      state.coins += state.runCoins;
      state.runCoins = 0;
      saveCoins();
    }
    setTimeout(() => {
      if (state.mode === 'gameover') return;
      // Hide the gameplay HUD before opening the shop overlay so the
      // shop's sticky wallet header isn't fighting the SCORE/WAVE row.
      document.getElementById('hud').classList.add('hidden');
      state.mode = 'paused';   // freeze rAF gameplay updates
      openShop('wave-clear');
    }, 900);
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
// Voltage ship: when a chain-tagged bullet kills an enemy, deal damage
// to the nearest live enemy within `range`, with a visible spark trail.
// Chain lightning: hop from enemy to enemy up to `hops` times.  Deaths are
// resolved by the sweep in update() so we never splice mid-collision.
function chainStrike(fromX, fromY, exclude, range, baseDmg, hops) {
  const visited = [exclude];
  const dmg = Math.max(1, Math.round((baseDmg || 1) * 0.5));
  for (let h = 0; h < (hops || 1); h++) {
    let best = null, bestD = Infinity;
    for (const e of state.enemies) {
      if (visited.indexOf(e) >= 0 || e.hp <= 0) continue;
      const d = len(e.x - fromX, e.y - fromY);
      if (d < range && d < bestD) { bestD = d; best = e; }
    }
    if (!best) return;
    visited.push(best);
    best.hp -= dmg;
    // Lightning visual
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pushParticle({
        x: fromX + (best.x - fromX) * t + rand(-6, 6),
        y: fromY + (best.y - fromY) * t + rand(-6, 6),
        vx: 0, vy: 0,
        size: 2.6, life: 220, age: 0, color: '#fbbf24',
      });
    }
    fromX = best.x; fromY = best.y;
  }
}

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
      if (b.hitIds && b.hitIds.indexOf(e) >= 0) continue;   // pierce: already hit
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

        // Ship bullet effects — these STACK on the expensive ships.
        const fx = b.fx;
        if (fx && fx.slow) {
          e.slowUntil = state.t + 1300;
          spawnParticles(b.x, b.y, '#c084fc', 5, 3, 400);
        }
        if (fx && fx.fire) {
          // Ignite for damage-over-time (ticks in updateEnemy)
          const burning = e.fireUntil && state.t < e.fireUntil;
          e.fireDmg = Math.max(burning ? (e.fireDmg || 0) : 0, baseDmg * 0.35);
          e.fireUntil = state.t + 2500;
          if (!burning) e.fireLastTick = state.t;
          spawnParticles(b.x, b.y, '#ff6b35', 5, 4, 500);
        }
        if (fx && fx.explode) {
          const aoeR = 72;
          const aoeDmg = Math.max(1, Math.ceil(baseDmg * 0.6));
          for (const e2 of state.enemies) {
            if (e2 === e) continue;
            const d = len(e2.x - b.x, e2.y - b.y);
            if (d < aoeR + e2.r) e2.hp -= aoeDmg;
          }
          spawnParticles(b.x, b.y, '#ff8c42', 10, 7, 500);
          if (state.shake < 3) shake(2);
        }

        const killedThis = e.hp <= 0;
        // Chain lightning jumps from the struck enemy to the next nearest
        if (fx && fx.chain) chainStrike(e.x, e.y, e, 160, baseDmg, fx.chain);

        // Pierce keeps the bullet alive for up to N more enemies
        if (b.pierceLeft > 0) {
          b.pierceLeft--;
          b.hitIds = b.hitIds || [];
          b.hitIds.push(e);
          // Don't splice; keep flying. Still resolve the kill on this enemy.
          if (killedThis) killEnemy(e); else sfx.hit();
          break;
        }

        state.bullets.splice(i, 1);
        if (killedThis) killEnemy(e);
        else sfx.hit();
        break;
      }
    }
  }

  // Enemies vs player
  for (const e of state.enemies) {
    if (len(p.x - e.x, p.y - e.y) < e.r + p.r) {
      damagePlayer(p);
      if (!e.big) { e.hp = 0; killEnemy(e, false); }
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

// Homing bullets gently curve toward the nearest enemy ahead of them.
function steerHoming(b) {
  let best = null, bestD = 320;
  for (const e of state.enemies) {
    const d = len(e.x - b.x, e.y - b.y);
    if (d < bestD && !(b.hitIds && b.hitIds.indexOf(e) >= 0)) { bestD = d; best = e; }
  }
  if (!best) return;
  const cur = Math.atan2(b.vy, b.vx);
  const want = Math.atan2(best.y - b.y, best.x - b.x);
  const diff = ((want - cur + Math.PI * 3) % TAU) - Math.PI;
  const a = cur + clamp(diff, -0.12, 0.12);
  const sp = len(b.vx, b.vy);
  b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
}

// ---------- Screen shake ----------
function shake(amt) { state.shake = Math.min(CFG.shake.max, state.shake + amt); }

// ---------- Update / draw loop ----------
function update(dt) {
  if (state.mode !== 'playing') return;
  state.t += dt;
  // Wave-tail acceleration: when the spawn queue is empty and enemies
  // remain on screen, push them toward the player so the wave can finish
  // without bombing. The speedup ramps from 1× → 2.2× over 8 seconds.
  if (state.spawnQueue.length === 0 && state.enemies.length > 0 && !state.betweenWaves) {
    state.tailT = (state.tailT || 0) + dt;
    state.tailMul = 1 + clamp(state.tailT / 8000, 0, 1) * 1.2;
  } else {
    state.tailT = 0;
    state.tailMul = 1;
  }

  updatePlayer(state.player, dt);

  // Update bullets
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    if (b.fx && b.fx.homing) steerHoming(b);
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
  // Sweep any enemies that died via DoT / AoE / chain that didn't go
  // through updateCollisions' kill path. Iterate backward — killEnemy
  // splices the array.
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    if (state.enemies[i].hp <= 0) killEnemy(state.enemies[i]);
  }
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
  // Lots of bullets on screen with top ships — drop the glow when it gets
  // busy so older iPads keep a smooth frame rate.
  ctx.shadowBlur = state.bullets.length > 60 ? 0 : 18;
  ctx.lineCap = 'round';
  for (const b of state.bullets) {
    const col = b.color || '#7df9ff';
    const br = b.small ? CFG.bullet.r * 0.65 : CFG.bullet.r;
    ctx.shadowColor = col;
    // Trail (in the ship's color)
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = col;
    ctx.lineWidth = br * 1.4;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 1.6, b.y - b.vy * 1.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Bright core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, br, 0, TAU);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(b.x, b.y, br * 0.6, 0, TAU);
    ctx.fill();
  }

  // Enemy bullets (colored by who fired them)
  ctx.shadowBlur = state.ebullets.length > 80 ? 0 : 14;
  for (const b of state.ebullets) {
    const col = b.color || '#ff4d6d';
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();
    // Hot white core so every enemy shot reads as "dangerous"
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.4, 0, TAU);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Enemies
  for (const e of state.enemies) drawEnemy(e);
  drawBigBars();

  // Player
  if (state.player) { drawDrones(state.player); drawPlayer(state.player); }

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
  state.mathSolved = 0;
  state.mathPending = null;
  state.mathNextWave = 0;
  state.tailT = 0;
  state.tailMul = 1;
  state.t = 0;
  state.shake = 0;
  state.betweenWaves = false;

  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('title').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('shop').classList.add('hidden');
  document.getElementById('math-gate').classList.add('hidden');
  document.getElementById('enemies').classList.add('hidden');
  buildLivesHud();
  updatePowerupHud();
  updateCoinHud();
  const w = Math.max(1, state.startWave || 1);
  startWave(w);
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
  state.mathPending = null;
  document.getElementById('gameover').classList.add('hidden');
  document.getElementById('pause').classList.add('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('shop').classList.add('hidden');
  document.getElementById('math-gate').classList.add('hidden');
  document.getElementById('enemies').classList.add('hidden');
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
  // Sync grade-pill active state
  document.querySelectorAll('.grade-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.grade === state.mathGrade);
  });
  renderWaveChips();
}

// Wave-checkpoint picker: chips at every 5 waves up through the highest
// wave the player has cleared, plus wave 1 as an always-available start.
function renderWaveChips() {
  const wrap = document.getElementById('wave-chips');
  if (!wrap) return;
  const highest = state.highestWaveCleared || 0;
  const maxUnlocked = highest + 1;             // George: can play the next un-cleared level too
  const previewLocked = 6;                     // show a few locked ahead so you see what's coming
  const total = maxUnlocked + previewLocked;
  // Default selection: highest unlocked (= maxUnlocked)
  if (!state.startWave || state.startWave > maxUnlocked) {
    state.startWave = maxUnlocked;
  }
  wrap.innerHTML = '';
  for (let n = 1; n <= total; n++) {
    const b = document.createElement('button');
    const locked = n > maxUnlocked;
    const isActive = n === state.startWave;
    b.className = 'wave-chip' + (isActive ? ' active' : '') + (locked ? ' locked' : '');
    b.textContent = locked ? `🔒 ${n}` : `${n}`;
    b.setAttribute('ontouchstart', '');
    if (!locked) {
      b.addEventListener('click', () => { state.startWave = n; renderWaveChips(); });
      b.addEventListener('touchend', (e) => { e.preventDefault(); state.startWave = n; renderWaveChips(); }, { passive: false });
    } else {
      b.setAttribute('aria-disabled', 'true');
      b.title = `Clear wave ${n - 1} first`;
    }
    wrap.appendChild(b);
  }
  // Scroll the active chip into view (horizontal scroll)
  requestAnimationFrame(() => {
    const active = wrap.querySelector('.wave-chip.active');
    if (active && active.scrollIntoView) {
      try { active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' }); } catch (e) {}
    }
  });
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
  } else if (shopReturn === 'wave-clear') {
    // Wave-clear → shop → level select (title).  Snap the wave picker
    // default to the next unlocked wave so the CTA is obviously "keep going".
    const next = (state.highestWaveCleared || 0) + 1;
    state.startWave = next;
    state.mode = 'title';
    document.getElementById('title').classList.remove('hidden');
    updateTitleStats();
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
      ${shipStatsHtml(id)}
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

// Stat block for a ship card — includes your pilot upgrades, so you see
// exactly what you'd fly with.  Effects show as chips.
function shipStatsHtml(id) {
  const lo = computeLoadout(id);
  const perSec = (1000 / lo.fireRate) * lo.shots;
  const power = Math.round(perSec * lo.bulletDmg);
  const fx = lo.fx || {};
  const chips = Object.keys(FX_LABELS).filter(k => fx[k]).map(k => {
    const n = typeof fx[k] === 'number' ? ` ${fx[k]}` : '';
    return `<span class="fx-chip">${FX_LABELS[k]}${n}</span>`;
  });
  if (lo.shots > 1) chips.unshift(`<span class="fx-chip">🔫 ×${lo.shots} shots</span>`);
  if (lo.drones) chips.push(`<span class="fx-chip">🛰 ${lo.drones} drone${lo.drones > 1 ? 's' : ''}</span>`);
  return `
    <div class="ship-stats">
      <span title="Damage per bullet">💥 ${lo.bulletDmg}</span>
      <span title="Lives">❤ ${lo.lives}</span>
      <span title="Bullets per second">⚡ ${perSec.toFixed(1)}/s</span>
      <span title="Firepower (damage per second, before effects)" class="power">🔥 ${power}</span>
    </div>
    ${chips.length ? `<div class="fx-chips">${chips.join('')}</div>` : ''}`;
}

// Enemy guide — list every enemy kind with a tiny preview and the
// wave they start showing up. Mirrors what buildWave actually does.
const ENEMY_GUIDE = [
  { kind: 'drifter',  name: 'Drifter',  when: 'Wave 1+',  desc: 'Slow pink chaser. 2 HP. The easiest enemy.' },
  { kind: 'zoomer',   name: 'Zoomer',   when: 'Wave 1+',  desc: 'Fast yellow triangle that commits to a direct dash. 1 HP.' },
  { kind: 'weaver',   name: 'Weaver',   when: 'Wave 3+',  desc: 'Lime diamond that snakes toward you in an S-curve — tricky to hit. 2 HP.' },
  { kind: 'splitter', name: 'Splitter', when: 'Wave 3+',  desc: 'Green square. 3 HP. Splits into two small drifters when killed.' },
  { kind: 'swarmer',  name: 'Swarmer',  when: 'Wave 4+',  desc: 'Tiny orange triangles that arrive in a PACK of 4–6. 1 HP each.' },
  { kind: 'orbiter',  name: 'Orbiter',  when: 'Wave 5+',  desc: 'Cyan circle that orbits you at distance and shoots at you. 3 HP.' },
  { kind: 'sniper',   name: 'Sniper',   when: 'Wave 6+',  desc: 'Blue pentagon that hangs back, shows a laser, then fires a FAST shot. Keep moving! 4 HP.' },
  { kind: 'tank',     name: 'Tank',     when: 'Wave 7+',  desc: 'Slow red octagon. 7 HP. Soaks up bullets.' },
  { kind: 'hunter',   name: 'Hunter',   when: 'Wave 8+',  desc: 'Fast red triangle that AGGRESSIVELY chases and periodically dashes at you. 8 HP.' },
  { kind: 'pulsar',   name: 'Pulsar',   when: 'Wave 9+',  desc: 'Violet 4-point star. Flashes white, then pulses out a ring of bullets. 6 HP.' },
  { kind: 'blinker',  name: 'Blinker',  when: 'Wave 11+', desc: 'Heptagon that flickers and TELEPORTS right next to you. 5 HP.' },
  { kind: 'warden',   name: 'Warden',   when: 'Wave 12+', desc: 'Bulky green square that chases and BURSTS into 3 zoomers on death. 18 HP.' },
  { kind: 'mender',   name: 'Mender',   when: 'Wave 14+', desc: 'Green plus-sign medic. Heals nearby enemies — shoot it FIRST. 8 HP.' },
  { kind: 'colossus', name: 'Colossus', when: 'Wave 15+', desc: 'Massive gold hexagon. Slow but unstoppable — it just walks straight at you. 40 HP.' },
];

const BOSS_GUIDE = [
  { kind: 'sentinel', name: 'Sentinel', when: 'Mini-boss · Wave 8, 23, 38…',  desc: 'Glides to a spot, stops, and spins out SPIRAL bullet streams. Move around the spiral.' },
  { kind: 'hive',     name: 'Hive Queen', when: 'Mini-boss · Wave 13, 28…',   desc: 'Slow mother ship that HATCHES swarmers and fires 3-shot spreads. Kill her fast.' },
  { kind: 'ravager',  name: 'Ravager',  when: 'Mini-boss · Wave 18, 33…',     desc: 'Shakes + shows a red lane, then CHARGES and bursts into a bullet ring. Dodge sideways!' },
  { kind: 'boss',     name: 'Boss',     when: 'Wave 5, 10, 15, 20…',         desc: 'Big star. Rotating rings always have a GAP — find it. Every 3rd volley is an aimed fan.' },
];

function renderEnemyGuide() {
  const wrap = document.getElementById('enemy-grid');
  wrap.innerHTML = '';
  const addCard = (row, extraClass) => {
    const card = document.createElement('div');
    card.className = 'enemy-card' + (extraClass ? ' ' + extraClass : '');
    card.innerHTML = `
      <canvas data-kind="${row.kind}"></canvas>
      <div class="name">${row.name}</div>
      <div class="when">${row.when}</div>
      <div class="desc">${row.desc}</div>`;
    wrap.appendChild(card);
  };
  for (const row of BOSS_GUIDE) addCard(row, 'enemy-card--boss');
  for (const row of ENEMY_GUIDE) addCard(row);
  addCard({ kind: 'hunter', name: '⭐ Elite Variants', when: 'Wave 10+ (rare)',
    desc: 'Any regular enemy can spawn as an elite — 3× HP, faster, bigger, and drops double coins. Look for the white pulsing ring.' });
  addCard({ kind: 'hive', name: '👑 Double Trouble', when: 'Wave 28+',
    desc: 'From wave 28, mini-boss waves send TWO different mini-bosses at once.' });

  // Render each tiny preview
  wrap.querySelectorAll('canvas[data-kind]').forEach(cv => {
    drawEnemyPreview(cv, cv.dataset.kind);
  });
}

function drawEnemyPreview(canvas, kind) {
  const k = ENEMY_KINDS[kind];
  if (!k) return;
  const dpr = window.devicePixelRatio || 1;
  const w = 200, h = 70;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  c.save();
  c.translate(w / 2, h / 2);
  c.rotate(0.4);    // tilted for visual interest
  c.strokeStyle = k.color;
  c.shadowColor = k.color;
  c.shadowBlur = 14;
  c.lineWidth = k.big ? 2.8 : 2.2;
  const r = k.big ? 26
          : (kind === 'colossus') ? 24
          : (kind === 'tank' || kind === 'warden') ? 20
          : (kind === 'swarmer') ? 11
          : 17;
  traceShape(c, k.shape, r);
  if (kind === 'boss') traceShape(c, 'star', r * 0.7);
  else if (k.mini) { c.rotate(0.6); c.lineWidth = 1.8; traceShape(c, k.shape, r * 0.55); }
  c.restore();
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

// Draw a ship against any 2D context (game canvas or shop preview).
function drawShipInto(c, shipId, r) {
  (SHIP_DRAW[shipId] || SHIP_DRAW.scout)(c, r);
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
// Math gate + grade pills + enemy guide
document.querySelectorAll('.grade-pill').forEach(p => {
  p.onclick = () => { setMathGrade(p.dataset.grade); updateTitleStats(); };
});
bindActivation(document.getElementById('math-submit'), submitMathAnswer);
document.getElementById('math-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); submitMathAnswer(); }
});
bindActivation(document.getElementById('enemies-btn'), () => {
  document.getElementById('title').classList.add('hidden');
  document.getElementById('enemies').classList.remove('hidden');
  renderEnemyGuide();
});
document.getElementById('enemies-back').onclick = () => {
  document.getElementById('enemies').classList.add('hidden');
  document.getElementById('title').classList.remove('hidden');
};

// iOS Safari sometimes drops the synthesized `click` from a tap on the
// very first interaction (especially when AudioContext + touch-action
// combine).  Bind both `click` AND `touchend` for the critical screen
// transitions, with a small dedupe window so each tap fires once.
function bindActivation(el, handler) {
  if (!el) return;
  let lastT = 0;
  const wrapped = (e) => {
    const now = (e && e.timeStamp) ? e.timeStamp : Date.now();
    if (now - lastT < 450) return;
    lastT = now;
    if (e && e.type === 'touchend' && e.cancelable) e.preventDefault();
    try { handler(e); } catch (err) { /* swallow — game must not stay stuck */ console && console.error && console.error(err); }
  };
  el.addEventListener('click', wrapped, { passive: false });
  el.addEventListener('touchend', wrapped, { passive: false });
}

bindActivation(document.getElementById('start-btn'), () => {
  try { audio(); } catch (e) { /* iOS AudioContext may need a real user gesture later */ }
  startGame();
});
bindActivation(document.getElementById('how-btn'), () => {
  document.getElementById('title').classList.add('hidden');
  document.getElementById('how').classList.remove('hidden');
  document.getElementById('how-back').classList.remove('hidden');
  document.getElementById('how-back-pause').classList.add('hidden');
});
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
bindActivation(document.getElementById('shop-btn'), () => openShop('title'));
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
