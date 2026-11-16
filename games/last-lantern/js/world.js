// Last Lantern rules: the cave generator, the numbers that balance a run,
// and line-of-sight lighting. No drawing here, so it also runs under Node
// (tools/check-world.js builds hundreds of caves and checks them).
//
// The generator draws its random numbers in exactly the same order as the
// first version did, so a saved run's seed rebuilds the same cave.
(function (root) {
  const MW = 56;
  const MH = 40;
  const LIGHT = [
    { name: 'Dim', r: 2.6, burn: 0.35, lure: 0.4 },
    { name: 'Steady', r: 4.6, burn: 0.7, lure: 1 },
    { name: 'Bright', r: 7.2, burn: 1.5, lure: 2.2 },
  ];
  const UPGRADES = [
    { id: 'blade', name: 'Sharper blade', cost: 40, desc: 'Creatures fall in one less swing' },
    { id: 'wick', name: 'Better wick', cost: 55, desc: 'Burn 30% less oil' },
    { id: 'tank', name: 'Bigger tank', cost: 70, desc: 'Hold 50 more oil' },
  ];
  const BEACON_COST = 30;
  const BEACON_NAMES = ['Mossy Hollow', 'Bone Gallery', 'Drowned Steps', 'Ember Throne'];

  // mulberry32, as used before
  function rng(seed) {
    let s = seed >>> 0;
    const r = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
    r.pick = (l) => l[Math.floor(r() * l.length)];
    return r;
  }
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function build(seed) {
    const rand = rng(seed);
    let map = Array.from({ length: MH }, (_, y) => Array.from({ length: MW }, (_, x) => (x === 0 || y === 0 || x === MW - 1 || y === MH - 1 || rand() < 0.44 ? 1 : 0)));
    for (let pass = 0; pass < 4; pass++) {
      const next = map.map((r) => [...r]);
      for (let y = 1; y < MH - 1; y++) {
        for (let x = 1; x < MW - 1; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += map[y + dy][x + dx];
          next[y][x] = n >= 5 ? 1 : 0;
        }
      }
      map = next;
    }
    const cx = MW / 2;
    const cy = MH / 2;
    const dig = (x0, y0, x1, y1) => {
      let x = x0;
      let y = y0;
      while (Math.abs(x - x1) + Math.abs(y - y1) > 0) {
        if (rand() < 0.5) x += Math.sign(x1 - x);
        else y += Math.sign(y1 - y);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (x + dx > 0 && y + dy > 0 && x + dx < MW - 1 && y + dy < MH - 1) map[y + dy][x + dx] = 0;
      }
    };
    const room = (x, y, r) => {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) map[y + dy][x + dx] = 0;
    };
    room(Math.floor(cx), Math.floor(cy), 3);
    const beacons = [[9, 8], [MW - 10, 8], [9, MH - 9], [MW - 10, MH - 9]].map(([x, y], i) => {
      room(x, y, 3);
      dig(Math.floor(cx), Math.floor(cy), x, y);
      return { x: x + 0.5, y: y + 0.5, name: BEACON_NAMES[i], lit: false };
    });
    const shrines = UPGRADES.map((u, i) => {
      const a = (i / 3) * 6.283 + 0.6;
      const x = Math.floor(cx + Math.cos(a) * 12);
      const y = Math.floor(cy + Math.sin(a) * 9);
      room(x, y, 2);
      dig(Math.floor(cx), Math.floor(cy), x, y);
      return { x: x + 0.5, y: y + 0.5, up: u };
    });
    const jars = [];
    for (let i = 0; i < 40; i++) {
      const x = rand.int(1, MW - 2);
      const y = rand.int(1, MH - 2);
      if (!map[y][x] && Math.hypot(x - cx, y - cy) > 4) jars.push({ x: x + 0.5, y: y + 0.5, taken: -1 });
    }
    // Decoration has its own generator so the cave above never changes.
    const dr = rng(seed ^ 0x5bd1e995);
    const glowcaps = [];
    const crystals = [];
    for (let y = 1; y < MH - 1; y++) {
      for (let x = 1; x < MW - 1; x++) {
        const nearWall = map[y - 1][x] + map[y + 1][x] + map[y][x - 1] + map[y][x + 1];
        if (!map[y][x] && nearWall >= 1 && dr() < 0.06 && Math.hypot(x - cx, y - cy) > 3) glowcaps.push({ x: x + 0.2 + dr() * 0.6, y: y + 0.2 + dr() * 0.6, n: 2 + Math.floor(dr() * 3), ph: dr() * 6 });
        if (map[y][x] && y + 1 < MH && !map[y + 1][x] && dr() < 0.05) crystals.push({ x, y, ph: dr() * 6 });
      }
    }
    return { seed, map, beacons, shrines, jars, glowcaps, crystals, rand, start: { x: cx, y: cy } };
  }

  const isWall = (w, x, y) => {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    return tx < 0 || ty < 0 || tx >= MW || ty >= MH || w.map[ty][tx] === 1;
  };

  // Cast rays across the grid from (x, y). Returns the light's outline (in
  // cells) and calls seen(cx, cy) for every cell the light touches.
  function visibility(w, x, y, r, rays, seen) {
    const pts = [];
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      let mx = Math.floor(x);
      let my = Math.floor(y);
      const sx = dx > 0 ? 1 : -1;
      const sy = dy > 0 ? 1 : -1;
      const ddx = Math.abs(1 / (dx || 1e-9));
      const ddy = Math.abs(1 / (dy || 1e-9));
      let tx = (dx > 0 ? mx + 1 - x : x - mx) * ddx;
      let ty = (dy > 0 ? my + 1 - y : y - my) * ddy;
      let dist = 0;
      for (;;) {
        if (seen) seen(mx, my);
        if (tx < ty) {
          dist = tx;
          tx += ddx;
          mx += sx;
        } else {
          dist = ty;
          ty += ddy;
          my += sy;
        }
        if (dist >= r) {
          dist = r;
          break;
        }
        if (mx < 0 || my < 0 || mx >= MW || my >= MH || w.map[my][mx] === 1) {
          if (seen) seen(mx, my);
          dist += 0.8; // light the face and top of the wall it hits
          break;
        }
      }
      pts.push(x + dx * Math.min(dist, r), y + dy * Math.min(dist, r));
    }
    return pts;
  }

  // Every floor cell reachable from the start, for the checker.
  function reachable(w) {
    const seen = new Set();
    const q = [[Math.floor(w.start.x), Math.floor(w.start.y)]];
    seen.add(q[0].join(','));
    while (q.length) {
      const [x, y] = q.pop();
      for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const k = a + ',' + b;
        if (!seen.has(k) && !isWall(w, a, b)) {
          seen.add(k);
          q.push([a, b]);
        }
      }
    }
    return seen;
  }

  const api = { MW, MH, LIGHT, UPGRADES, BEACON_COST, rng, hash, build, isWall, visibility, reachable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LLWorld = api;
})(typeof window !== 'undefined' ? window : globalThis);
