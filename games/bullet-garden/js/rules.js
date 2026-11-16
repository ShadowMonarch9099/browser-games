// Bullet Garden rules: a twin-stick shooter where missed shots matter. A seed
// that lands on empty soil grows into a plant: spitters, thornwalls, sticky
// vines or bomb pods. Bugs find their way to the greenhouse around your
// plants, and plants wilt unless you walk near them to water them.
// No page code here, so tools/test-rules.js can play whole nights in Node.
(function (root) {
  const GW = 20, GH = 13, NIGHTS = 10, CORE = { x: 9.5, y: 6 }, REACH = 6, SEED_SPEED = 11;
  const SEEDS = {
    spitter: { name: 'Spitter', color: '#9ef01a', hp: 30, desc: 'Shoots nearby bugs' },
    wall: { name: 'Thornwall', color: '#c08552', hp: 90, desc: 'Blocks the way' },
    vine: { name: 'Sticky vine', color: '#c77dff', hp: 40, desc: 'Slows bugs that cross it' },
    bomb: { name: 'Bomb pod', color: '#ff4d6d', hp: 20, desc: 'Bursts when a bug comes close' },
  };
  const ORDER = ['spitter', 'wall', 'vine', 'bomb'];
  const BUGS = {
    ant: { name: 'Ant', hp: 6, speed: 1.6, dmg: 4, r: 0.22, color: '#f4a261' },
    beetle: { name: 'Beetle', hp: 22, speed: 0.9, dmg: 10, r: 0.34, color: '#4cc9f0' },
    wasp: { name: 'Wasp', hp: 5, speed: 2.8, dmg: 3, r: 0.2, color: '#ffd166', flies: true },
  };
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function rng(seed) {
    let s = seed >>> 0;
    const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
    return r;
  }
  const key = (x, y) => y * GW + x;

  function create(seed) {
    const g = {
      rand: rng(seed || 1), p: { x: CORE.x, y: CORE.y + 2, cool: 0, face: [0, 1] },
      plants: new Map(), bugs: [], seeds: [], spits: [], flow: null,
      unlocked: ['spitter'], current: 'spitter', greenhouse: 100, night: 0, nightT: 0, toSpawn: [], spawnT: 2, total: 0,
      state: 'night', events: [], kills: 0, grown: 0, time: 0,
    };
    nextNight(g);
    return g;
  }
  function nextNight(g) {
    g.night++; g.nightT = 0; g.spawnT = 2; g.state = 'night';
    g.toSpawn = [];
    const n = 8 + g.night * 4;
    for (let i = 0; i < n; i++) g.toSpawn.push(g.night >= 3 && g.rand() < 0.2 ? 'wasp' : g.night >= 2 && g.rand() < 0.25 + g.night * 0.02 ? 'beetle' : 'ant');
    if (g.night === NIGHTS) for (let i = 0; i < 6; i++) g.toSpawn.push('beetle');
    g.total = g.toSpawn.length;
    buildFlow(g);
  }
  // Distance-to-greenhouse for every cell, walking around walls (and around
  // plants, which bugs prefer not to cross). Bugs roll downhill on it.
  function buildFlow(g) {
    const flow = (g.flow = new Float32Array(GW * GH).fill(1e9));
    const cx = Math.floor(CORE.x), cy = Math.floor(CORE.y), queue = [[cx, cy]];
    flow[key(cx, cy)] = 0;
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i], d = flow[key(x, y)];
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const pl = g.plants.get(key(nx, ny));
        const cost = pl ? (pl.type === 'wall' ? 12 : 3) : 1;
        if (d + cost < flow[key(nx, ny)]) { flow[key(nx, ny)] = d + cost; queue.push([nx, ny]); }
      }
    }
  }
  // A seed flies to where you aimed (up to REACH tiles) and plants itself there if it hits nothing.
  function fire(g, ax, ay) {
    const p = g.p;
    if (p.cool > 0) return false;
    const dx = ax - p.x, dy = ay - p.y, d = Math.hypot(dx, dy) || 1;
    if (d < 0.4) return false;
    p.cool = 0.22;
    const reach = Math.min(REACH, d);
    g.seeds.push({ x: p.x, y: p.y, x0: p.x, y0: p.y, vx: (dx / d) * SEED_SPEED, vy: (dy / d) * SEED_SPEED, left: reach / SEED_SPEED, flight: reach / SEED_SPEED, type: g.current });
    g.events.push({ type: 'fire', seed: g.current });
    return true;
  }
  function canPlant(g, fx, fy) {
    const x = Math.floor(fx), y = Math.floor(fy);
    if (x < 0 || y < 0 || x >= GW || y >= GH || g.plants.has(key(x, y))) return false;
    return !(Math.abs(x + 0.5 - CORE.x) < 1.2 && Math.abs(y + 0.5 - CORE.y) < 1.2);
  }
  function plant(g, type, fx, fy) {
    if (!canPlant(g, fx, fy)) { g.events.push({ type: 'fizzle', x: fx, y: fy }); return; }
    const x = Math.floor(fx), y = Math.floor(fy);
    g.plants.set(key(x, y), { type, x: x + 0.5, y: y + 0.5, hp: SEEDS[type].hp, water: 1, grow: 0, cool: 0, shot: 0 });
    g.grown++;
    g.events.push({ type: 'sprout', seed: type, x: x + 0.5, y: y + 0.5 });
    buildFlow(g);
  }
  function choose(g, type) { if (g.unlocked.includes(type)) { g.current = type; return true; } return false; }
  function unlock(g, type) { if (!g.unlocked.includes(type)) g.unlocked.push(type); g.current = type; }
  function locked(g) { return ORDER.filter((s) => !g.unlocked.includes(s)); }

  // input: { mx, my (move -1..1), ax, ay (aim point in garden tiles), fire }
  function step(g, dt, input) {
    g.events = [];
    if (g.state !== 'night') return g.events;
    g.time += dt;
    const ev = g.events, p = g.plants, P = g.p, i = input || {};
    const n = Math.hypot(i.mx || 0, i.my || 0), mag = Math.min(1, n);
    if (n > 0.05) { P.x = Math.max(0.4, Math.min(GW - 0.4, P.x + ((i.mx / n) * mag) * 4.2 * dt)); P.y = Math.max(0.4, Math.min(GH - 0.4, P.y + ((i.my / n) * mag) * 4.2 * dt)); P.face = [i.mx / n, i.my / n]; }
    // the gardener walks round the greenhouse, not through it
    const ox = P.x - CORE.x, oy = P.y - CORE.y;
    if (Math.abs(ox) < 1.3 && Math.abs(oy) < 1.3) { if (Math.abs(ox) > Math.abs(oy)) P.x = CORE.x + Math.sign(ox || 1) * 1.3; else P.y = CORE.y + Math.sign(oy || 1) * 1.3; }
    P.cool -= dt;
    if (i.fire && i.ax !== undefined) fire(g, i.ax, i.ay);

    for (const s of g.seeds) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.left -= dt;
      const hit = g.bugs.find((b) => Math.hypot(b.x - s.x, b.y - s.y) < b.t.r + 0.1);
      if (hit) { hit.hp -= 3; hit.flash = 0.1; s.done = true; ev.push({ type: 'hit', x: s.x, y: s.y }); continue; }
      if (s.left <= 0) { s.done = true; plant(g, s.type, s.x, s.y); }
    }
    g.seeds = g.seeds.filter((s) => !s.done);

    // plants: grow, drink, wilt, act
    for (const [id, pl] of p) {
      pl.grow = Math.min(1, pl.grow + dt * 1.5);
      pl.shot = Math.max(0, pl.shot - dt);
      const near = Math.hypot(pl.x - P.x, pl.y - P.y) < 2.5;
      const was = pl.water;
      pl.water = near ? Math.min(1, pl.water + dt * 0.5) : pl.water - dt / 40;
      if (was >= 0.3 && pl.water < 0.3) ev.push({ type: 'thirsty', x: pl.x, y: pl.y });
      if (pl.water <= 0 || pl.hp <= 0) { p.delete(id); ev.push({ type: pl.hp <= 0 ? 'eaten' : 'wilt', x: pl.x, y: pl.y, seed: pl.type }); buildFlow(g); continue; }
      if (pl.grow < 1 || pl.water < 0.15) continue;
      pl.cool -= dt;
      if (pl.type === 'spitter' && pl.cool <= 0) {
        const tgt = g.bugs.find((b) => Math.hypot(b.x - pl.x, b.y - pl.y) < 3.2);
        if (tgt) { pl.cool = 0.8; pl.shot = 0.15; const d = Math.hypot(tgt.x - pl.x, tgt.y - pl.y); g.spits.push({ x: pl.x, y: pl.y, vx: ((tgt.x - pl.x) / d) * 8, vy: ((tgt.y - pl.y) / d) * 8, life: 0.5 }); ev.push({ type: 'spit', x: pl.x, y: pl.y }); }
      }
      if (pl.type === 'bomb' && g.bugs.some((b) => Math.hypot(b.x - pl.x, b.y - pl.y) < 1)) {
        for (const b of g.bugs) if (Math.hypot(b.x - pl.x, b.y - pl.y) < 2) { b.hp -= 25; b.flash = 0.15; }
        ev.push({ type: 'boom', x: pl.x, y: pl.y });
        p.delete(id); buildFlow(g);
      }
    }
    for (const s of g.spits) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      const hit = g.bugs.find((b) => Math.hypot(b.x - s.x, b.y - s.y) < b.t.r + 0.08);
      if (hit) { hit.hp -= 4; hit.flash = 0.1; s.life = 0; }
    }
    g.spits = g.spits.filter((s) => s.life > 0);

    // bugs arrive from the edges and head for the greenhouse
    g.nightT += dt; g.spawnT -= dt;
    if (g.toSpawn.length && g.spawnT <= 0) {
      const type = g.toSpawn.shift(), t = BUGS[type], side = g.rand.int(0, 3);
      g.bugs.push({ type, t, hp: t.hp * (1 + g.night * 0.08), max: t.hp * (1 + g.night * 0.08), x: side === 0 ? 0.3 : side === 1 ? GW - 0.3 : g.rand() * GW, y: side === 2 ? 0.3 : side === 3 ? GH - 0.3 : g.rand() * GH, flash: 0, bite: 0, dir: 0, chew: false });
      g.spawnT = Math.max(0.35, 1.6 - g.night * 0.12);
    }
    const flow = g.flow;
    for (const b of g.bugs) {
      b.flash = Math.max(0, b.flash - dt);
      const cx = Math.floor(b.x), cy = Math.floor(b.y), here = p.get(key(cx, cy));
      let speed = b.t.speed * (here && here.type === 'vine' && here.grow >= 1 && !b.t.flies ? 0.35 : 1);
      let tx = CORE.x, ty = CORE.y;
      if (!b.t.flies) {
        let best = flow[key(Math.max(0, Math.min(GW - 1, cx)), Math.max(0, Math.min(GH - 1, cy)))];
        for (const [dx, dy] of DIRS) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && ny >= 0 && nx < GW && ny < GH && flow[key(nx, ny)] < best) { best = flow[key(nx, ny)]; tx = nx + 0.5; ty = ny + 0.5; }
        }
      }
      const ahead = p.get(key(Math.floor(tx), Math.floor(ty)));
      b.chew = false;
      if (!b.t.flies && ahead && ahead.type === 'wall' && ahead.grow >= 1 && Math.hypot(ahead.x - b.x, ahead.y - b.y) < 0.9) { ahead.hp -= b.t.dmg * dt; speed = 0; b.chew = true; }
      const d = Math.hypot(tx - b.x, ty - b.y) || 1;
      b.x += ((tx - b.x) / d) * speed * dt; b.y += ((ty - b.y) / d) * speed * dt;
      b.dir = Math.atan2(ty - b.y, tx - b.x);
      if (Math.hypot(b.x - CORE.x, b.y - CORE.y) < 1.1) {
        g.greenhouse -= b.t.dmg * dt; b.bite += dt;
        if (b.bite > 0.5) { b.bite = 0; ev.push({ type: 'bite', x: b.x, y: b.y }); }
      }
      if (Math.hypot(b.x - P.x, b.y - P.y) < b.t.r + 0.3) { P.x += (P.x - b.x) * 0.2; P.y += (P.y - b.y) * 0.2; ev.push({ type: 'bump' }); }
    }
    for (const b of g.bugs) if (b.hp <= 0) { g.kills++; ev.push({ type: 'squish', x: b.x, y: b.y, bug: b.type, color: b.t.color }); }
    g.bugs = g.bugs.filter((b) => b.hp > 0);

    if (g.greenhouse <= 0) { g.greenhouse = 0; g.state = 'lost'; ev.push({ type: 'lost' }); }
    else if (!g.toSpawn.length && !g.bugs.length) {
      if (g.night >= NIGHTS) { g.state = 'won'; ev.push({ type: 'won' }); }
      else { g.state = 'dawn'; g.greenhouse = Math.min(100, g.greenhouse + 15); ev.push({ type: 'dawn' }); }
    }
    return ev;
  }

  const api = { GW, GH, NIGHTS, CORE, REACH, SEEDS, ORDER, BUGS, create, step, nextNight, choose, unlock, locked, canPlant, buildFlow };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.BG = root.BG || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
