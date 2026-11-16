// Knot Alone rules: two climbers on one rope. Ledges can be jumped up through
// from below. A 2-high step is a normal jump; a 3-high step needs a boost off
// your partner's head. Anchor yourself and you can reel your partner up to
// you, or let rope out. Both must reach the summit ledge. No page code here,
// so tools/check-levels.js can build and test the climbs in Node.
// Heights count up from the floor (0); a climber's y is their feet.
(function (root) {
  const COLS = 20, G = 40, RUN = 5, JUMP = 13.5, PW = 0.6, PH = 0.9, ROPE_MIN = 1.2, ROPE_MAX = 6.5, LEVELS = 10;
  const NAMES = ['First Pitch', 'Pine Chimney', 'Goat Steps', 'Ice Shelf', 'The Ladder', 'Cloud Crack', 'Eagle Ledges', 'Hanging Garden', 'Knife Edge', 'Sky Summit'];

  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(text) { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; }

  // Ledges climb from the floor in steps of 2 or 3, alternating sides, getting
  // narrower. Every step can be made by a boost (3) or a plain jump (2).
  // (The same generator as the first version, so every climb is unchanged.)
  function makeLevel(n) {
    const rand = rng(hash('knot-alone:' + n));
    const count = 5 + n;
    const ledges = [{ x: 1, y: 0, w: COLS - 2 }];
    let y = 0, side = rand() < 0.5 ? 0 : 1;
    for (let i = 0; i < count; i++) {
      y += rand() < 0.3 + n * 0.06 ? 3 : 2;
      const w = Math.max(3, 8 - Math.floor(n / 2) - (rand() < 0.4 ? 1 : 0));
      const prev = ledges[ledges.length - 1];
      let x = side ? Math.min(COLS - 1 - w, prev.x + prev.w - 2) : Math.max(1, prev.x - w + 2);
      if (i === 0) x = side ? COLS - 1 - w - 2 : 3;
      ledges.push({ x, y, w });
      side = 1 - side;
    }
    const top = ledges[ledges.length - 1];
    return { n, name: NAMES[n - 1], ledges, rows: y + 6, flag: top, par: Math.round(count * 7) };
  }

  function create(n) {
    const lv = makeLevel(n), solid = new Set();
    for (const l of lv.ledges) for (let x = l.x; x < l.x + l.w; x++) solid.add(x + ',' + l.y);
    return {
      lv, solid, time: 0, won: false, falls: 0, ropeLen: 4,
      climbers: [0, 1].map((i) => ({ i, x: 7 + i * 3, y: 0, vx: 0, vy: 0, ground: true, pinned: false, face: 1, peak: 0, best: 0 })),
      rope: Array.from({ length: 16 }, (_, k) => ({ x: 7 + (3 * k) / 15, y: 0.5, px: 7 + (3 * k) / 15, py: 0.5 })),
      taut: false, events: [],
    };
  }
  const ledgeAt = (s, x, y) => s.solid.has(Math.floor(x) + ',' + y);

  function move(s, c, k, other, dt) {
    const ev = s.events;
    if (k.anchor && (c.ground || c.pinned)) {
      if (!c.pinned) ev.push({ type: 'anchor', i: c.i });
      c.pinned = true; c.vx = 0; c.vy = 0;
      const before = s.ropeLen;
      if (k.up) s.ropeLen = Math.max(ROPE_MIN, s.ropeLen - 3 * dt);
      if (k.down) s.ropeLen = Math.min(ROPE_MAX, s.ropeLen + 3 * dt);
      if (Math.floor(before * 4) !== Math.floor(s.ropeLen * 4)) ev.push({ type: 'reel', i: c.i, dir: s.ropeLen < before ? -1 : 1 });
      return;
    }
    if (c.pinned) ev.push({ type: 'release', i: c.i });
    c.pinned = false;
    if (k.x) c.face = Math.sign(k.x);
    c.vx += (k.x * RUN - c.vx) * Math.min(1, dt * (c.ground ? 16 : 6));
    if (k.jump && c.ground) { c.vy = JUMP; c.ground = false; ev.push({ type: 'jump', i: c.i, x: c.x, y: c.y }); }
    c.vy -= G * dt;
    c.x = Math.max(1 + PW / 2, Math.min(COLS - 1 - PW / 2, c.x + c.vx * dt));
    const before = c.y, wasGround = c.ground;
    c.y += c.vy * dt;
    c.ground = false;
    if (c.vy <= 0) {
      for (let top = Math.floor(before); top >= Math.ceil(c.y); top--) {
        if (before >= top - 0.0001 && c.y <= top && [c.x - PW / 2 + 0.05, c.x + PW / 2 - 0.05].some((fx) => ledgeAt(s, fx, top))) { c.y = top; c.vy = 0; c.ground = true; break; }
      }
      if (c.y <= 0) { c.y = 0; c.vy = 0; c.ground = true; }
      if (!c.ground && Math.abs(c.x - other.x) < PW && before >= other.y + PH - 0.001 && c.y <= other.y + PH) { c.y = other.y + PH; c.vy = 0; c.ground = true; ev.push({ type: 'head', i: c.i }); }
    }
    if (c.ground && !wasGround) {
      const drop = c.peak - c.y;
      ev.push({ type: 'land', i: c.i, x: c.x, y: c.y, drop });
      if (drop > 2.6) { s.falls++; ev.push({ type: 'fall', i: c.i, drop }); }
    }
    if (c.ground) c.peak = c.y; else c.peak = Math.max(c.peak, c.y);
    c.best = Math.max(c.best, c.ground ? c.y : 0);
  }

  // Keep the two within rope length. A pinned climber never moves; otherwise share the pull.
  function tie(s) {
    const [a, b] = s.climbers;
    const dx = b.x - a.x, dy = b.y + PH / 2 - (a.y + PH / 2), d = Math.hypot(dx, dy);
    if (a.pinned && b.pinned) { s.ropeLen = Math.max(s.ropeLen, d); return; }
    if (d <= s.ropeLen || d === 0) return;
    const over = d - s.ropeLen, nx = dx / d, ny = dy / d;
    const share = a.pinned ? [0, 1] : b.pinned ? [1, 0] : [0.5, 0.5];
    a.x += nx * over * share[0]; a.y += ny * over * share[0];
    b.x -= nx * over * share[1]; b.y -= ny * over * share[1];
    for (const [c, sg] of [[a, -1], [b, 1]]) {
      const along = (c.vx * nx + c.vy * ny) * sg;
      if (along > 0) { c.vx -= along * nx * sg; c.vy -= along * ny * sg; }
      c.x = Math.max(1 + PW / 2, Math.min(COLS - 1 - PW / 2, c.x));
      if (c.y < 0) c.y = 0;
    }
  }

  // controls: [{ x, jump, up, down, anchor }, { ... }]
  function step(s, dt, controls) {
    s.events = [];
    if (s.won) return s.events;
    s.time += dt;
    const none = { x: 0, jump: false, up: false, down: false, anchor: false };
    s.climbers.forEach((c, i) => move(s, c, (controls && controls[i]) || none, s.climbers[1 - i], dt));
    for (let k = 0; k < 3; k++) tie(s);
    const [a, b] = s.climbers, dist = Math.hypot(b.x - a.x, b.y - a.y);
    const taut = dist > s.ropeLen - 0.05;
    if (taut && !s.taut) s.events.push({ type: 'taut' });
    s.taut = taut;
    // the drawn rope: a chain of points that sags under gravity, ends tied to the climbers
    const rope = s.rope, ends = s.climbers.map((c) => ({ x: c.x, y: c.y + PH * 0.55 }));
    rope[0].x = ends[0].x; rope[0].y = ends[0].y; rope[rope.length - 1].x = ends[1].x; rope[rope.length - 1].y = ends[1].y;
    for (let k = 1; k < rope.length - 1; k++) { const q = rope[k], vx = (q.x - q.px) * 0.96, vy = (q.y - q.py) * 0.96; q.px = q.x; q.py = q.y; q.x += vx; q.y += vy - 9 * dt * dt; }
    const seg = s.ropeLen / (rope.length - 1);
    for (let it = 0; it < 6; it++) for (let k = 0; k < rope.length - 1; k++) {
      const p = rope[k], q = rope[k + 1], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, diff = (d - seg) / d / 2;
      if (k > 0) { p.x += dx * diff; p.y += dy * diff; }
      if (k + 1 < rope.length - 1) { q.x -= dx * diff; q.y -= dy * diff; }
    }
    const f = s.lv.flag, inFlag = (c) => (c.ground || c.pinned) && Math.abs(c.y - f.y) < 0.01 && c.x > f.x && c.x < f.x + f.w;
    if (s.climbers.every(inFlag)) { s.won = true; s.events.push({ type: 'win' }); }
    return s.events;
  }

  const api = { COLS, G, RUN, JUMP, PW, PH, ROPE_MIN, ROPE_MAX, LEVELS, NAMES, makeLevel, create, step };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.KA = root.KA || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
