// Flick Parlour rules and physics: a carrom-style board game. The board is
// a unit square (0..1 on both axes, y down). Flick the striker from your
// baseline into the coins; sink coins of your colour in the four corner
// pockets. Sinking one of yours (or the queen) earns another flick.
//   The queen (red) must be "covered": sink one of your own coins on the
//   same or the next flick, or she goes back to the middle.
//   Sinking the striker is a foul: one of your sunk coins comes back.
//   Your last coin only counts once the queen is gone; first to sink all
//   nine of theirs wins.
// No page code here, so tools/ can simulate whole games in Node.
(function (root) {
  const COIN = 0.0215, STRIKER = 0.028, POCKET = 0.034, PCORNER = 0.036;
  const POCKETS = [[PCORNER, PCORNER], [1 - PCORNER, PCORNER], [PCORNER, 1 - PCORNER], [1 - PCORNER, 1 - PCORNER]];
  // each side flicks from its own baseline: you at the bottom, them at the top
  const BASE = [{ y: 0.855, x0: 0.24, x1: 0.76, dir: -1 }, { y: 0.145, x0: 0.24, x1: 0.76, dir: 1 }];
  const FRICTION = 0.62, REST = 0.92, WALL = 0.72;

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // the opening flower: queen in the middle, two rings of alternating colours
  function setup() {
    const coins = [{ id: 0, kind: 'queen', x: 0.5, y: 0.5 }];
    const d = COIN * 2.02;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; coins.push({ kind: i % 2 ? 'black' : 'white', x: 0.5 + Math.cos(a) * d, y: 0.5 + Math.sin(a) * d }); }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + Math.PI / 6; const r = i % 2 ? d * 2 * Math.cos(Math.PI / 6) * 1.0 : d * 2; coins.push({ kind: i % 2 ? 'white' : 'black', x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r }); }
    coins.forEach((c, i) => { c.id = i; c.r = COIN; c.vx = 0; c.vy = 0; c.in = false; });
    return coins;
  }
  function create(o = {}) {
    const s = {
      coins: setup(), striker: { id: 'S', kind: 'striker', x: 0.5, y: BASE[0].y, r: STRIKER, vx: 0, vy: 0, in: false },
      colours: ['white', 'black'], turn: 0, sunk: [[], []], queenBy: -1, queenPending: -1, fouls: [0, 0], flicks: [0, 0], over: false, winner: -1,
      phase: 'aim', solo: !!o.solo, events: [],
    };
    if (s.solo) s.colours = ['any', 'any'];
    placeStriker(s, 0.5);
    return s;
  }
  const all = (s) => s.coins.concat([s.striker]);
  const mine = (s, p, c) => c.kind === s.colours[p] || s.colours[p] === 'any' && c.kind !== 'queen';
  const onBoard = (s, kind) => s.coins.filter((c) => !c.in && (!kind || c.kind === kind));

  // put the striker on the current player's baseline, nudged clear of coins
  function placeStriker(s, x) {
    const b = BASE[s.turn], st = s.striker;
    st.x = Math.max(b.x0, Math.min(b.x1, x)); st.y = b.y; st.vx = st.vy = 0; st.in = false;
    return st.x;
  }
  function strikerClear(s) { const st = s.striker; return !s.coins.some((c) => !c.in && Math.hypot(c.x - st.x, c.y - st.y) < c.r + st.r); }
  // flick: angle in radians (0 = right, -PI/2 = up), power 0..1
  function flick(s, angle, power) {
    if (s.phase !== 'aim' || !strikerClear(s)) return false;
    const v = 0.35 + power * 2.65;
    s.striker.vx = Math.cos(angle) * v; s.striker.vy = Math.sin(angle) * v;
    s.phase = 'moving'; s.events = []; s.shot = { sunk: [], striker: false, firstHit: null };
    s.flicks[s.turn]++;
    return true;
  }
  // advance the physics by dt seconds; returns true while anything moves
  function step(s, dt) {
    if (s.phase !== 'moving') return false;
    const n = 6, h = dt / n, bodies = all(s).filter((b) => !b.in);
    for (let k = 0; k < n; k++) {
      for (const b of bodies) {
        if (b.in) continue;
        b.x += b.vx * h; b.y += b.vy * h;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 0) { const ns = Math.max(0, sp - FRICTION * h); b.vx *= ns / sp; b.vy *= ns / sp; }
        // cushions
        if (b.x < b.r) { b.x = b.r; b.vx = -b.vx * WALL; s.events.push({ type: 'wall', speed: sp }); }
        if (b.x > 1 - b.r) { b.x = 1 - b.r; b.vx = -b.vx * WALL; s.events.push({ type: 'wall', speed: sp }); }
        if (b.y < b.r) { b.y = b.r; b.vy = -b.vy * WALL; s.events.push({ type: 'wall', speed: sp }); }
        if (b.y > 1 - b.r) { b.y = 1 - b.r; b.vy = -b.vy * WALL; s.events.push({ type: 'wall', speed: sp }); }
        // pockets: the centre has to pass over the hole
        for (const [px, py] of POCKETS) if (Math.hypot(b.x - px, b.y - py) < POCKET) { b.in = true; b.vx = b.vy = 0; b.px = px; b.py = py; s.events.push({ type: 'pocket', id: b.id, kind: b.kind }); if (b.kind === 'striker') s.shot.striker = true; else s.shot.sunk.push(b); break; }
      }
      // collisions between every pair
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], c = bodies[j];
        if (a.in || c.in) continue;
        const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), min = a.r + c.r;
        if (d >= min || d === 0) continue;
        const nx = dx / d, ny = dy / d, ma = a.kind === 'striker' ? 1.6 : 1, mc = c.kind === 'striker' ? 1.6 : 1;
        // push apart, then exchange momentum along the normal
        const over = (min - d) / 2; a.x -= nx * over; a.y -= ny * over; c.x += nx * over; c.y += ny * over;
        const rel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        if (rel <= 0) continue;
        const imp = ((1 + REST) * rel) / (1 / ma + 1 / mc);
        a.vx -= (imp / ma) * nx; a.vy -= (imp / ma) * ny; c.vx += (imp / mc) * nx; c.vy += (imp / mc) * ny;
        if (!s.shot.firstHit && (a.kind === 'striker' || c.kind === 'striker')) s.shot.firstHit = a.kind === 'striker' ? c.kind : a.kind;
        s.events.push({ type: 'hit', speed: rel, striker: a.kind === 'striker' || c.kind === 'striker' });
      }
    }
    const moving = bodies.some((b) => !b.in && Math.hypot(b.vx, b.vy) > 0.004);
    if (!moving) { for (const b of bodies) { b.vx = b.vy = 0; } settle(s); }
    return moving;
  }
  // run a flick to the end instantly (for computer players and tests)
  function simulate(s, maxT = 12) { let t = 0; while (s.phase === 'moving' && t < maxT) { step(s, 1 / 60); t += 1 / 60; } if (s.phase === 'moving') { for (const b of all(s)) b.vx = b.vy = 0; settle(s); } }

  // after everything stops: who sunk what, fouls, the queen, whose turn
  function settle(s) {
    const p = s.turn, shot = s.shot, out = [];
    let again = false;
    const respot = (c) => { c.in = false; c.vx = c.vy = 0; let a = 0, r = 0; do { c.x = 0.5 + Math.cos(a) * r; c.y = 0.5 + Math.sin(a) * r; a += 1.3; r += 0.004; } while (s.coins.some((o) => o !== c && !o.in && Math.hypot(o.x - c.x, o.y - c.y) < o.r + c.r)); };
    for (const c of shot.sunk) {
      if (c.kind === 'queen') continue;
      const owner = s.solo ? p : s.colours.indexOf(c.kind);
      s.sunk[owner].push(c.id);
      if (owner === p) again = true;
    }
    // the queen needs covering by one of your own coins, this flick or the next
    const queenNow = shot.sunk.some((c) => c.kind === 'queen');
    const ownSunk = shot.sunk.some((c) => c.kind !== 'queen' && mine(s, p, c));
    if (queenNow) {
      if (ownSunk) { s.queenBy = p; out.push({ type: 'queen-covered', by: p }); }
      else { s.queenPending = p; again = true; out.push({ type: 'queen-sunk' }); }
    } else if (s.queenPending === p) {
      s.queenPending = -1;
      if (ownSunk) { s.queenBy = p; out.push({ type: 'queen-covered', by: p }); }
      else { respot(s.coins[0]); out.push({ type: 'queen-back' }); }
    }
    // fouls: sinking the striker returns one of your coins
    if (shot.striker) {
      s.fouls[p]++; again = false;
      const back = s.sunk[p].pop();
      if (back !== undefined) respot(s.coins[back]);
      out.push({ type: 'foul', returned: back !== undefined });
      if (s.queenPending === p) { respot(s.coins[0]); s.queenPending = -1; out.push({ type: 'queen-back' }); }
    }
    // your last coin can't go down while the queen is still in play
    for (const q of [0, 1]) {
      const left = s.solo ? onBoard(s).filter((c) => c.kind !== 'queen').length : onBoard(s, s.colours[q]).length;
      if (!left && s.queenBy < 0) { const last = s.sunk[q].pop(); if (last !== undefined) { respot(s.coins[last]); out.push({ type: 'last-back', who: q }); } }
    }
    // the end
    if (s.solo) { if (!onBoard(s).length) { s.over = true; s.winner = 0; } }
    else for (const q of [0, 1]) if (!onBoard(s, s.colours[q]).length && s.queenBy >= 0) { s.over = true; s.winner = q; }
    if (s.over) out.push({ type: 'over', winner: s.winner });
    if (!again && !s.solo) s.turn = 1 - s.turn;
    out.push({ type: again ? 'again' : 'next', who: s.turn });
    s.phase = s.over ? 'over' : 'aim';
    s.result = out;
    placeStriker(s, 0.5);
    return out;
  }

  // ---------- the computer player ----------
  // A "ghost" position for the striker to hit a coin into a pocket.
  function clearPath(s, x0, y0, x1, y1, r, skip) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
    for (const c of s.coins) {
      if (c.in || skip.includes(c)) continue;
      const t = Math.max(0, Math.min(1, ((c.x - x0) * dx + (c.y - y0) * dy) / (L * L)));
      if (Math.hypot(x0 + dx * t - c.x, y0 + dy * t - c.y) < r + c.r) return false;
    }
    return true;
  }
  function plan(s, skill = 1, rand = Math.random) {
    const p = s.turn, b = BASE[p], st = s.striker;
    const targets = s.coins.filter((c) => !c.in && (mine(s, p, c) || (c.kind === 'queen' && s.queenBy < 0)));
    let best = null;
    for (const c of targets) for (const [px, py] of POCKETS) {
      const tx = px - c.x, ty = py - c.y, tl = Math.hypot(tx, ty);
      const gx = c.x - (tx / tl) * (c.r + st.r), gy = c.y - (ty / tl) * (c.r + st.r);
      if (!clearPath(s, c.x, c.y, px, py, c.r * 0.9, [c])) continue;
      for (let i = 0; i <= 16; i++) {
        const sx = b.x0 + ((b.x1 - b.x0) * i) / 16, sy = b.y;
        const ax = gx - sx, ay = gy - sy, al = Math.hypot(ax, ay);
        // the striker must travel away from its own baseline edge
        if (Math.sign(ay) !== b.dir && Math.abs(ay) > 0.01) continue;
        const cut = Math.acos(Math.max(-1, Math.min(1, (ax * tx + ay * ty) / (al * tl))));
        if (cut > 1.15) continue;
        if (s.coins.some((o) => !o.in && Math.hypot(o.x - sx, o.y - sy) < o.r + st.r)) continue;
        if (!clearPath(s, sx, sy, gx, gy, st.r * 0.95, [c])) continue;
        const score = 3 - cut * 1.6 - al * 0.8 - tl * 1.2 + (c.kind === 'queen' ? 0.6 : 0);
        if (!best || score > best.score) best = { score, x: sx, angle: Math.atan2(ay, ax), power: Math.min(1, 0.18 + (al + tl / Math.max(0.3, Math.cos(cut))) * 0.42), target: c.id };
      }
    }
    if (!best) {
      // nothing clean: break up the pile toward the middle
      const x = b.x0 + rand() * (b.x1 - b.x0);
      best = { x, angle: Math.atan2(0.5 - b.y, 0.5 + (rand() - 0.5) * 0.3 - x), power: 0.55 + rand() * 0.3, score: -1 };
    }
    const wobble = [0.06, 0.025, 0.008][skill];
    best.angle += (rand() - 0.5) * wobble; best.power = Math.max(0.1, Math.min(1, best.power * (1 + (rand() - 0.5) * wobble * 2)));
    return best;
  }

  const api = { COIN, STRIKER, POCKET, POCKETS, BASE, create, setup, placeStriker, strikerClear, flick, step, simulate, plan, onBoard, mine, rng };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.FP = root.FP || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
