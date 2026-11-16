// Gate Stampede rules. Pure simulation shared by the browser and the Node
// tools. Levels are generated from their number with the same generator and
// hash the game has always used, so level N is identical for everyone and to
// every earlier version of the game (tools/check-levels.js guards this).
//
// Units: distance in "track px" (the crowd moves 330 per second), x is the
// crowd's position across the track from -0.85 (left) to 0.85 (right).
(function (root) {
  'use strict';
  const LEVELS = 30, GAP = 460, SPEED = 330;

  // mulberry32 + FNV-1a, identical to the generator the levels were made with
  function rng(seed) {
    let s = seed >>> 0;
    const r = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (min, max) => min + Math.floor(r() * (max - min + 1));
    r.pick = (list) => list[Math.floor(r() * list.length)];
    return r;
  }
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function apply(n, g) {
    if (g.op === '+') return n + g.v;
    if (g.op === '-') return Math.max(0, n - g.v);
    if (g.op === 'x') return n * g.v;
    return Math.floor(n / g.v);
  }
  const label = (g) => ({ '+': '+', '-': '−', x: '×', '/': '÷' }[g.op] + g.v);
  const kind = (g) => (g.op === '+' || g.op === 'x' ? 'good' : 'bad');

  function makeLevel(lv) {
    const rand = rng(hash('gate-stampede:' + lv));
    const rows = [];
    let best = 10;
    const count = Math.min(16, 6 + Math.floor(lv / 2));
    for (let i = 0; i < count; i++) {
      const roll = rand();
      if (roll < 0.62 || i === 0) {
        const good = rand() < 0.3 && best < 400 ? { op: 'x', v: rand() < 0.15 ? 3 : 2 } : { op: '+', v: rand.int(5, 12 + lv) };
        const r2 = rand();
        const bad = r2 < 0.4 ? { op: '-', v: rand.int(3, 6 + Math.floor(lv / 2)) } : r2 < 0.65 ? { op: '/', v: 2 } : { op: '+', v: rand.int(1, 4) };
        const goodLeft = rand() < 0.5;
        rows.push({ kind: 'gates', left: goodLeft ? good : bad, right: goodLeft ? bad : good });
        best = apply(best, good);
      } else if (roll < 0.82) {
        rows.push({ kind: 'saw', x: rand.pick([-0.55, 0, 0.55]) });
      } else if (best > 20) {
        const n = Math.floor(best * 0.3);
        rows.push({ kind: 'rivals', n });
        best -= n;
      } else rows.push({ kind: 'saw', x: rand.pick([-0.55, 0.55]) });
    }
    rows.forEach((r, i) => { r.d = 700 + i * GAP; });
    return { rows, castle: Math.max(8, Math.floor(best * (0.5 + Math.min(0.2, lv * 0.007)))), end: 700 + count * GAP + 200, best };
  }

  function stars(n, castle) { return n >= castle * 1.5 ? 3 : n >= castle * 1.2 ? 2 : 1; }

  function create(lv) {
    const L = makeLevel(lv);
    L.rows.forEach((r) => { r.done = false; });
    return { lv, L, n: 10, x: 0, dist: 0, state: 'playing', won: false, events: [] };
  }

  // inp: { steer: -1..1 (held axis), target: null | -1..1 (absolute pointer) , nudge: -1|0|1 }
  function step(s, dt, inp) {
    const ev = s.events; ev.length = 0;
    if (s.state !== 'playing') return ev;
    inp = inp || {};
    if (inp.steer) s.x += inp.steer * 2.2 * dt;
    else if (inp.target !== null && inp.target !== undefined) s.x += (inp.target - s.x) * Math.min(1, dt * 14);
    if (inp.nudge) s.x += inp.nudge * 0.55;
    s.x = Math.max(-0.85, Math.min(0.85, s.x));
    s.dist += SPEED * dt;
    for (const r of s.L.rows) {
      if (r.done || r.d > s.dist) continue;
      r.done = true;
      if (r.kind === 'gates') {
        const side = s.x < 0 ? 'left' : 'right';
        const g = r[side];
        const before = s.n;
        s.n = apply(s.n, g);
        r.took = side;
        ev.push({ type: 'gate', good: kind(g) === 'good', text: label(g), side, before, after: s.n });
      } else if (r.kind === 'saw') {
        if (Math.abs(s.x - r.x) < 0.42) {
          const lost = Math.max(3, Math.floor(s.n * 0.3));
          const before = s.n;
          s.n = Math.max(0, s.n - lost);
          r.hit = true;
          ev.push({ type: 'saw', lost: before - s.n, text: '−' + lost });
        } else ev.push({ type: 'sawMiss' });
      } else {
        const before = s.n;
        s.n = Math.max(0, s.n - r.n);
        ev.push({ type: 'rivals', lost: before - s.n, text: '−' + r.n });
      }
      if (s.n <= 0) { s.won = false; s.state = 'done'; ev.push({ type: 'wiped' }); return ev; }
    }
    if (s.dist >= s.L.end) {
      s.won = s.n >= s.L.castle; s.state = 'done';
      ev.push({ type: s.won ? 'win' : 'short' });
    }
    return ev;
  }

  // Steers through every good gate and around saws: used by the title demo
  // and by tools/check-levels.js to prove each level can be won.
  function autopilot(s) {
    for (const r of s.L.rows) {
      if (r.done) continue;
      // both sides can be "good" (+2 against x3), so compare what each gives
      if (r.kind === 'gates') return { target: apply(s.n, r.left) >= apply(s.n, r.right) ? -0.5 : 0.5 };
      if (r.kind === 'saw') return { target: r.x === 0 ? (s.x < 0 ? -0.6 : 0.6) : r.x < 0 ? 0.5 : -0.5 };
      return { target: 0 };
    }
    return { target: 0 };
  }

  const api = { LEVELS, GAP, SPEED, rng, hash, apply, label, kind, makeLevel, stars, create, step, autopilot };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.GS = root.GS || {}; root.GS.Rules = api; }
})(typeof window !== 'undefined' ? window : globalThis);
