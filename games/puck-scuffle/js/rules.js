// Puck Scuffle rules: the table, puck and mallet physics, tokens and the
// computer player. No page code, so tools/test-rules.js can play whole
// matches in Node. Table units: 1 wide, LEN long. Player 0 (red) defends the
// y = LEN end, player 1 (blue) the y = 0 end.
(function (root) {
  const LEN = 1.7, GOAL = 0.38, MR = 0.075, PR = 0.045, MAX_SPEED = 3.4;
  const AI = [{ speed: 1.0, wobble: 0.16 }, { speed: 1.6, wobble: 0.07 }, { speed: 2.4, wobble: 0.02 }];
  const TOKENS = { split: 'Split puck!', big: 'Giant puck!', shrink: 'Goal shrinks!' };

  function rng(seed) {
    let s = seed >>> 0;
    const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.pick = (l) => l[Math.floor(r() * l.length)];
    return r;
  }

  // opts: { ai: [level|null, level|null], win, tokens, seed }
  function create(opts) {
    const m = {
      ai: opts.ai || [null, null], win: opts.win || 7, tokens: opts.tokens !== false, rand: rng(opts.seed || 1),
      mallets: [{ x: 0.5, y: LEN - 0.25, vx: 0, vy: 0 }, { x: 0.5, y: 0.25, vx: 0, vy: 0 }],
      pucks: [], score: [0, 0], token: null, tokenAt: 7, bigUntil: 0, shrinkUntil: [0, 0],
      time: 0, state: 'play', stateT: 0, lastScorer: -1, events: [], rally: 0,
    };
    serve(m, m.rand() < 0.5 ? 0 : 1);
    return m;
  }
  function serve(m, toPlayer) {
    m.pucks = [{ x: 0.5, y: LEN / 2 + (toPlayer === 0 ? 0.22 : -0.22), vx: 0, vy: 0, last: -1, trail: [] }];
    m.token = null; m.tokenAt = m.time + 7; m.bigUntil = 0; m.shrinkUntil = [0, 0]; m.rally = 0;
  }
  const puckR = (m) => (m.time < m.bigUntil ? PR * 1.7 : PR);
  const goalW = (m, p) => GOAL * (m.time < m.shrinkUntil[p] ? 0.55 : 1);

  function clampMallet(m, p) {
    const k = m.mallets[p];
    k.x = Math.max(MR, Math.min(1 - MR, k.x));
    k.y = p === 0 ? Math.max(LEN / 2 + MR, Math.min(LEN - MR, k.y)) : Math.max(MR, Math.min(LEN / 2 - MR, k.y));
  }
  // control: { target: [x, y] } follows a finger or mouse; { axis: [dx, dy] } moves at key speed
  function steer(m, p, c, dt) {
    const k = m.mallets[p], ox = k.x, oy = k.y;
    if (m.ai[p] !== null && m.ai[p] !== undefined) think(m, p, dt);
    else if (c && c.target) {
      const dx = c.target[0] - k.x, dy = c.target[1] - k.y, d = Math.hypot(dx, dy), max = 6 * dt;
      if (d > 0) { const f = Math.min(1, max / d); k.x += dx * f; k.y += dy * f; }
    } else if (c && c.axis) {
      const [dx, dy] = c.axis, n = Math.hypot(dx, dy);
      if (n > 0.01) { const s = Math.min(1, n); k.x += (dx / n) * s * 1.9 * dt; k.y += (dy / n) * s * 1.9 * dt; }
    }
    clampMallet(m, p);
    k.vx = (k.x - ox) / dt; k.vy = (k.y - oy) / dt;
  }
  // The computer: when the puck is on its half, get behind it (on the side of
  // its own goal) and strike it toward the far goal; otherwise guard.
  function think(m, p, dt) {
    const k = m.mallets[p], a = AI[m.ai[p]];
    const sgn = p === 1 ? 1 : -1;                         // +y is toward the far goal for blue
    const home = p === 1 ? 0.24 : LEN - 0.24, mine = (q) => (p === 1 ? q.y < LEN / 2 : q.y > LEN / 2);
    const puck = m.pucks.reduce((b, q) => ((p === 1 ? q.y < b.y : q.y > b.y) ? q : b), m.pucks[0]);
    let tx = 0.5 + ((puck ? puck.x : 0.5) - 0.5) * 0.7, ty = home, speed = a.speed;
    if (puck && mine(puck) && sgn * puck.vy < 0.8) {
      const gx = 0.5 + Math.sin(m.time * 1.7 + p) * 0.12, gy = p === 1 ? LEN : 0;
      let ux = gx - puck.x, uy = gy - puck.y;
      const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
      const reach = MR + puckR(m) + 0.03;
      const sx = puck.x - ux * reach, sy = puck.y - uy * reach;
      const behind = sgn * (puck.y - k.y) > 0.01;           // mallet is on its own goal's side of the puck
      if (!behind) { tx = puck.x + (puck.x < 0.5 ? 1 : -1) * reach * 1.6; ty = puck.y - sgn * reach * 1.4; }
      else if (Math.hypot(sx - k.x, sy - k.y) > 0.05) { tx = sx; ty = sy; }
      else { tx = puck.x + ux * 0.2; ty = puck.y + uy * 0.2; speed *= 1.6; }  // strike
    }
    tx += Math.sin(m.time * 2.3 + p) * a.wobble * 0.5;
    const dx = tx - k.x, dy = ty - k.y, d = Math.hypot(dx, dy), max = speed * dt;
    if (d > 0) { const f = Math.min(1, max / d); k.x += dx * f; k.y += dy * f; }
  }

  function movePuck(m, q, dt) {
    const r = puckR(m), ev = m.events;
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vx *= 0.9988; q.vy *= 0.9988;
    const wall = () => { if (Math.hypot(q.vx, q.vy) > 0.3) ev.push({ type: 'wall', x: q.x, y: q.y, speed: Math.hypot(q.vx, q.vy) }); };
    if (q.x < r) { q.x = r; q.vx = Math.abs(q.vx) * 0.95; wall(); }
    if (q.x > 1 - r) { q.x = 1 - r; q.vx = -Math.abs(q.vx) * 0.95; wall(); }
    if (q.y < r) {
      if (Math.abs(q.x - 0.5) < goalW(m, 1) / 2 - r * 0.4) { if (q.y < -r) return goal(m, 0, q); }
      else { q.y = r; q.vy = Math.abs(q.vy) * 0.95; wall(); }
    }
    if (q.y > LEN - r) {
      if (Math.abs(q.x - 0.5) < goalW(m, 0) / 2 - r * 0.4) { if (q.y > LEN + r) return goal(m, 1, q); }
      else { q.y = LEN - r; q.vy = -Math.abs(q.vy) * 0.95; wall(); }
    }
    m.mallets.forEach((k, p) => {
      const dx = q.x - k.x, dy = q.y - k.y, d = Math.hypot(dx, dy), min = r + MR;
      if (d >= min || d === 0) return;
      const nx = dx / d, ny = dy / d;
      q.x = k.x + nx * min; q.y = k.y + ny * min;
      const rel = (q.vx - k.vx) * nx + (q.vy - k.vy) * ny;
      if (rel < 0) { q.vx -= 1.9 * rel * nx; q.vy -= 1.9 * rel * ny; q.last = p; if (-rel > 0.08) { m.rally++; ev.push({ type: 'hit', p, x: q.x, y: q.y, power: -rel }); } }
    });
    const sp = Math.hypot(q.vx, q.vy);
    if (sp > MAX_SPEED) { q.vx *= MAX_SPEED / sp; q.vy *= MAX_SPEED / sp; }
    const t = m.token;
    if (t && Math.hypot(q.x - t.x, q.y - t.y) < r + 0.06) {
      m.token = null; m.tokenAt = m.time + 9;
      ev.push({ type: 'token', kind: t.type, x: t.x, y: t.y });
      if (t.type === 'split' && m.pucks.length < 3) m.pucks.push({ x: q.x, y: q.y, vx: -q.vx || 0.6, vy: q.vy, last: q.last, trail: [] });
      if (t.type === 'big') m.bigUntil = m.time + 8;
      // the goal of whoever hit it last gets smaller, so scoring on them is harder
      if (t.type === 'shrink') m.shrinkUntil[q.last === -1 ? (m.rand() < 0.5 ? 0 : 1) : q.last] = m.time + 10;
    }
  }
  function goal(m, scorer, q) {
    m.score[scorer]++;
    m.lastScorer = scorer;
    m.state = m.score[scorer] >= m.win ? 'over' : 'goal';
    m.stateT = 0;
    m.events.push({ type: 'goal', scorer, x: q.x, rally: m.rally, over: m.state === 'over' });
    m.pucks = [];
  }

  // controls: [control for red, control for blue]
  function step(m, dt, controls) {
    m.events = [];
    m.time += dt; m.stateT += dt;
    if (m.state === 'goal') { if (m.stateT > 1.4) { serve(m, 1 - m.lastScorer); m.state = 'play'; m.events.push({ type: 'serve' }); } return m.events; }
    if (m.state !== 'play') return m.events;
    steer(m, 0, controls && controls[0], dt);
    steer(m, 1, controls && controls[1], dt);
    for (let sub = 0; sub < 2; sub++) for (const q of [...m.pucks]) if (m.state === 'play') movePuck(m, q, dt / 2);
    for (const q of m.pucks) { q.trail.push([q.x, q.y]); if (q.trail.length > 8) q.trail.shift(); }
    if (m.tokens && !m.token && m.time > m.tokenAt && m.state === 'play') {
      m.token = { x: 0.2 + m.rand() * 0.6, y: LEN / 2 + (m.rand() - 0.5) * 0.5, type: m.rand.pick(Object.keys(TOKENS)) };
      m.events.push({ type: 'tokenAppear' });
    }
    return m.events;
  }

  const api = { LEN, GOAL, MR, PR, AI, TOKENS, create, step, puckR, goalW };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PS = root.PS || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
