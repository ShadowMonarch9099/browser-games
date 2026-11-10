// Level model: map parsing, tile collision, line of sight and grid pathfinding.
//
// Map legend (see js/levels.js):
//   #  wall            .  floor           =  grate (only the clone slips through)
//   P  player start    E  exit            k  key        *  shadow shard
//   L  locked door (consumes a key)       1-9  door tile belonging to that group
//   a-j  plate/lever/bell, configured in the level's `plates` table
//   X  crate    B  barrel    O  pillar   (solid for everyone, block sight)
//   ,  carpet (plain floor, decorative)
(function () {
  const C = SCE.CFG;
  const T = C.TILE;
  const PLATE_CHARS = 'abcdefghij';
  const SOLID = '#XBO'; // base tiles nobody walks or sees through
  const DIRS = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  const center = (c, r) => ({ x: (c + 0.5) * T, y: (r + 0.5) * T });

  // Level rows are authored as 30 interior chars split into "10|10|10" chunks;
  // the outer wall ring is added here.
  function expandMap(def) {
    const rows = ['#'.repeat(C.COLS)];
    for (const line of def.map) rows.push('#' + line.split('|').join('') + '#');
    rows.push('#'.repeat(C.COLS));
    return rows;
  }

  class Level {
    constructor(def) {
      this.def = def;
      this.base = [];
      this.doorAt = [];
      this.lockAt = [];
      this.doors = {};
      this.plates = [];
      this.items = [];
      this.locks = [];
      this.exits = [];
      this.start = null;

      const rows = expandMap(def);
      for (let r = 0; r < C.ROWS; r++) {
        this.base.push([]);
        this.doorAt.push(new Array(C.COLS).fill(null));
        this.lockAt.push(new Array(C.COLS).fill(null));
        for (let c = 0; c < C.COLS; c++) {
          const ch = rows[r][c] || '#';
          let b = '.';
          if (SOLID.includes(ch) || ch === '=' || ch === ',') b = ch;
          else if (ch === 'P') this.start = center(c, r);
          else if (ch === 'E') this.exits.push({ c, r, ...center(c, r) });
          else if (ch === 'k' || ch === '*') {
            this.items.push({ type: ch === 'k' ? 'key' : 'shard', c, r, ...center(c, r), taken: false, wisp: 0 });
          } else if (ch === 'L') {
            const lock = { c, r, open: false };
            this.locks.push(lock);
            this.lockAt[r][c] = lock;
          } else if (ch >= '1' && ch <= '9') {
            const d = this.door(+ch);
            d.tiles.push({ c, r });
            this.doorAt[r][c] = d;
          } else if (PLATE_CHARS.includes(ch)) {
            const cfg = (def.plates || {})[ch] || { type: 'hold' };
            const plate = {
              ch,
              c,
              r,
              ...center(c, r),
              type: cfg.type || 'hold',
              group: cfg.door || null,
              pressed: false,
              active: false,
              timer: 0,
              on: false,
            };
            this.plates.push(plate);
            if (plate.group) this.door(plate.group).plates.push(plate);
          }
          this.base[r].push(b);
        }
      }
      for (const d of Object.values(this.doors)) {
        d.open = d.invert;
        d.anim = d.open ? 1 : 0;
        const sx = d.tiles.reduce((s, t) => s + t.c, 0) / d.tiles.length;
        const sy = d.tiles.reduce((s, t) => s + t.r, 0) / d.tiles.length;
        d.cx = (sx + 0.5) * T;
        d.cy = (sy + 0.5) * T;
      }
    }

    door(group) {
      if (!this.doors[group]) {
        const cfg = (this.def.doors || {})[group] || {};
        this.doors[group] = {
          group,
          tiles: [],
          plates: [],
          twin: !!cfg.twin,
          invert: !!cfg.invert,
          latched: false,
          open: false,
          anim: 0,
          color: C.GROUP_COLORS[(group - 1) % C.GROUP_COLORS.length],
        };
      }
      return this.doors[group];
    }

    inBounds(c, r) {
      return c >= 0 && r >= 0 && c < C.COLS && r < C.ROWS;
    }

    // who: 'player' | 'clone' | 'guard'
    solid(c, r, who) {
      if (!this.inBounds(c, r)) return true;
      const b = this.base[r][c];
      if (SOLID.includes(b)) return true;
      if (b === '=' && who !== 'clone') return true;
      const d = this.doorAt[r][c];
      if (d && !d.open) return true;
      const l = this.lockAt[r][c];
      if (l && !l.open) return true;
      return false;
    }

    blocksSight(c, r) {
      if (!this.inBounds(c, r)) return true;
      if (SOLID.includes(this.base[r][c])) return true;
      const d = this.doorAt[r][c];
      if (d && !d.open) return true;
      const l = this.lockAt[r][c];
      return !!(l && !l.open);
    }

    collides(x, y, h, who) {
      const c0 = Math.floor((x - h) / T);
      const c1 = Math.floor((x + h - 1e-4) / T);
      const r0 = Math.floor((y - h) / T);
      const r1 = Math.floor((y + h - 1e-4) / T);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) if (this.solid(c, r, who)) return { c, r };
      }
      return null;
    }

    los(x0, y0, x1, y1) {
      const d = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.ceil(d / 5);
      for (let i = 1; i < steps; i++) {
        const x = x0 + ((x1 - x0) * i) / steps;
        const y = y0 + ((y1 - y0) * i) / steps;
        if (this.blocksSight(Math.floor(x / T), Math.floor(y / T))) return false;
      }
      return true;
    }

    rayLength(x, y, angle, max) {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      for (let d = 4; d < max; d += 4) {
        if (this.blocksSight(Math.floor((x + dx * d) / T), Math.floor((y + dy * d) / T))) return d;
      }
      return max;
    }

    // BFS from `from` toward `goal`. If the goal is unreachable, heads for the
    // reachable tile closest to it. Returns the first step, the destination and
    // how far (in tiles) the destination is from the goal.
    path(from, goal, who) {
      const W = C.COLS;
      const start = from.r * W + from.c;
      const prev = new Int16Array(W * C.ROWS).fill(-1);
      const seen = new Uint8Array(W * C.ROWS);
      const queue = [start];
      seen[start] = 1;
      let best = start;
      let bestD = (from.c - goal.c) ** 2 + (from.r - goal.r) ** 2;
      for (let qi = 0; qi < queue.length; qi++) {
        const k = queue[qi];
        const c = k % W;
        const r = (k / W) | 0;
        const d = (c - goal.c) ** 2 + (r - goal.r) ** 2;
        if (d < bestD) {
          best = k;
          bestD = d;
        }
        if (d === 0) break;
        for (const [dc, dr] of DIRS) {
          const nc = c + dc;
          const nr = r + dr;
          if (!this.inBounds(nc, nr)) continue;
          const nk = nr * W + nc;
          if (seen[nk] || this.solid(nc, nr, who)) continue;
          seen[nk] = 1;
          prev[nk] = k;
          queue.push(nk);
        }
      }
      const dest = { c: best % W, r: (best / W) | 0 };
      const dist = Math.sqrt(bestD);
      if (best === start) return { next: null, dest, dist };
      let k = best;
      while (prev[k] !== start) k = prev[k];
      return { next: { c: k % W, r: (k / W) | 0 }, dest, dist };
    }
  }

  // Axis-separated box movement with a small corner nudge so 20px bodies slip
  // into 30px gaps without pixel-perfect alignment. onHit may clear the
  // obstacle (e.g. unlocking a door) and return true to retry.
  function moveAxis(L, e, ax, d, who, onHit) {
    const h = C.HALF;
    e[ax] += d;
    let hit = L.collides(e.x, e.y, h, who);
    if (hit && onHit && onHit(hit)) hit = L.collides(e.x, e.y, h, who);
    if (!hit) return;

    const other = ax === 'x' ? 'y' : 'x';
    const mid = (Math.floor(e[other] / T) + 0.5) * T;
    const off = mid - e[other];
    if (Math.abs(off) > 0.5 && Math.abs(off) < 9) {
      const test = { x: e.x, y: e.y };
      test[other] = mid;
      if (!L.collides(test.x, test.y, h, who)) {
        e[ax] -= d;
        e[other] += Math.sign(off) * Math.min(Math.abs(off), Math.abs(d));
        return;
      }
    }
    if (ax === 'x') e.x = d > 0 ? hit.c * T - h - 0.001 : (hit.c + 1) * T + h + 0.001;
    else e.y = d > 0 ? hit.r * T - h - 0.001 : (hit.r + 1) * T + h + 0.001;
  }

  SCE.moveEntity = function (L, e, dx, dy, who, onHit) {
    if (dx) moveAxis(L, e, 'x', dx, who, onHit);
    if (dy) moveAxis(L, e, 'y', dy, who, onHit);
  };

  SCE.expandMap = expandMap;
  SCE.Level = Level;
})();
