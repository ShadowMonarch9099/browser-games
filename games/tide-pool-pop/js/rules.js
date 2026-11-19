// Tide Pool Pop rules: a swap-and-match puzzle in a rock pool. Swap two
// neighbouring creatures to line up three or more of a kind.
//   4 in a line   makes a Wave (clears its whole row or column)
//   L or T shape  makes a Bubble (bursts the 3 x 3 around it)
//   5 in a line   makes a Pearl (swap it with any creature to clear that kind)
// Special pairs combine. Sand under a square is washed away by a match on
// it; barnacle rocks crack when something pops beside them.
// The engine records each phase (swap, pop, fall) so the page can animate it,
// and has no page code, so tools/ can build and check levels in Node.
(function (root) {
  const W = 8, H = 9;
  const KINDS = ['star', 'shell', 'urchin', 'crab', 'clam', 'fish'];

  function rng(seed) {
    let s = seed >>> 0;
    const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.state = () => s; r.set = (v) => { s = v >>> 0; };
    return r;
  }

  // level: { mask: [rows of '#'(square) or '.'(no square)], colors, moves, goals: { score?, collect?: {kind: n}, sand?: true, rocks?: true }, sand: [rows of digits], rocks: [rows of digits], seed }
  function create(level) {
    const s = {
      level, colors: level.colors, rand: rng(level.seed || 7), nextId: 1,
      grid: [], sand: [], open: [], score: 0, moves: level.moves, movesUsed: 0,
      collected: KINDS.map(() => 0), rocksLeft: 0, sandLeft: 0, cascade: 0, phases: [], over: null,
    };
    for (let y = 0; y < H; y++) {
      s.grid.push([]); s.sand.push([]); s.open.push([]);
      for (let x = 0; x < W; x++) {
        const open = level.mask[y][x] === '#';
        s.open[y].push(open);
        s.sand[y].push(open && level.sand ? +level.sand[y][x] || 0 : 0);
        s.sandLeft += s.sand[y][x];
        const rock = open && level.rocks ? +level.rocks[y][x] || 0 : 0;
        s.grid[y].push(!open ? null : rock ? { id: s.nextId++, rock } : null);
        if (rock) s.rocksLeft++;
      }
    }
    s.sandTotal = s.sandLeft; s.rocksTotal = s.rocksLeft;
    // fill without ready-made matches, and make sure a move exists
    for (let tries = 0; tries < 50; tries++) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (s.open[y][x] && !(s.grid[y][x] && s.grid[y][x].rock)) s.grid[y][x] = null;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!s.open[y][x] || s.grid[y][x]) continue;
        let t, guard = 0;
        do { t = Math.floor(s.rand() * s.colors); } while (guard++ < 20 && ((x >= 2 && same(s, x - 1, y, t) && same(s, x - 2, y, t)) || (y >= 2 && same(s, x, y - 1, t) && same(s, x, y - 2, t))));
        s.grid[y][x] = { id: s.nextId++, t, sp: null };
      }
      if (findMoves(s).length) break;
    }
    return s;
  }
  const at = (s, x, y) => (x >= 0 && y >= 0 && x < W && y < H ? s.grid[y][x] : null);
  const same = (s, x, y, t) => { const p = at(s, x, y); return p && !p.rock && p.sp !== 'pearl' && p.t === t; };
  const swappable = (p) => p && !p.rock;

  // ---------- finding matches ----------
  // Runs of three or more, merged into groups (so L and T shapes are one group).
  function findGroups(s) {
    const runs = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; ) {
      const p = at(s, x, y);
      if (!p || p.rock || p.sp === 'pearl') { x++; continue; }
      let n = 1; while (same(s, x + n, y, p.t)) n++;
      if (n >= 3) runs.push({ cells: Array.from({ length: n }, (_, i) => [x + i, y]), dir: 'h', t: p.t });
      x += n;
    }
    for (let x = 0; x < W; x++) for (let y = 0; y < H; ) {
      const p = at(s, x, y);
      if (!p || p.rock || p.sp === 'pearl') { y++; continue; }
      let n = 1; while (same(s, x, y + n, p.t)) n++;
      if (n >= 3) runs.push({ cells: Array.from({ length: n }, (_, i) => [x, y + i]), dir: 'v', t: p.t });
      y += n;
    }
    const groups = [];
    for (const r of runs) {
      const keys = new Set(r.cells.map((c) => c.join()));
      const g = groups.find((gr) => gr.t === r.t && gr.cells.some((c) => keys.has(c.join())));
      if (g) { g.runs.push(r); for (const c of r.cells) if (!g.cells.some((d) => d[0] === c[0] && d[1] === c[1])) g.cells.push(c); }
      else groups.push({ t: r.t, runs: [r], cells: r.cells.slice() });
    }
    return groups;
  }
  // what a group turns into, and where (the swapped square if it's in the group)
  function specialFor(g, prefer) {
    const long = Math.max(...g.runs.map((r) => r.cells.length));
    const both = g.runs.some((r) => r.dir === 'h') && g.runs.some((r) => r.dir === 'v');
    let kind = null;
    if (long >= 5) kind = 'pearl';
    else if (both) kind = 'bomb';
    else if (long === 4) kind = g.runs[0].dir;     // 'h' clears the row, 'v' the column
    if (!kind) return null;
    let cell = prefer && g.cells.find((c) => prefer.some((p) => p[0] === c[0] && p[1] === c[1]));
    if (!cell) {
      if (both) { const h = g.runs.find((r) => r.dir === 'h'), v = g.runs.find((r) => r.dir === 'v'); cell = h.cells.find((c) => v.cells.some((d) => d[0] === c[0] && d[1] === c[1])) || g.cells[0]; }
      else cell = g.cells[Math.floor(g.cells.length / 2)];
    }
    return { kind, cell };
  }

  // ---------- clearing ----------
  // Pop a set of squares, letting any specials inside go off too.
  function blast(s, start, info) {
    const pop = new Map(), queue = [...start];
    const add = (x, y, why) => { if (x < 0 || y < 0 || x >= W || y >= H || !s.open[y][x]) return; const k = x + ',' + y; if (pop.has(k)) return; pop.set(k, why || 'match'); queue.push([x, y]); };
    for (const [x, y] of start) pop.set(x + ',' + y, 'match');
    const fired = [];
    while (queue.length) {
      const [x, y] = queue.shift(), p = at(s, x, y);
      if (!p || p.rock || !p.sp || p.fired) continue;
      p.fired = true; fired.push({ x, y, sp: p.sp, t: p.t });
      if (p.sp === 'h') for (let i = 0; i < W; i++) add(i, y, 'wave');
      else if (p.sp === 'v') for (let i = 0; i < H; i++) add(x, i, 'wave');
      else if (p.sp === 'bomb') for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) add(x + dx, y + dy, 'bomb');
      else if (p.sp === 'pearl') { const c = info && info.pearlColor !== undefined ? info.pearlColor : mostCommon(s); for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) { const q = at(s, xx, yy); if (q && !q.rock && q.t === c) add(xx, yy, 'pearl'); } }
    }
    return { pop, fired };
  }
  function mostCommon(s) {
    const n = Array(s.colors).fill(0);
    for (const row of s.grid) for (const p of row) if (p && !p.rock && p.t >= 0) n[p.t]++;
    return n.indexOf(Math.max(...n));
  }
  // Remove popped pieces: score, collect, wash sand, crack rocks beside matches.
  function remove(s, pop, makeSpecials) {
    const cleared = [], cracked = [], washed = [];
    const keep = new Set((makeSpecials || []).map((m) => m.cell.join()));
    const near = new Set();
    for (const [k, why] of pop) {
      const [x, y] = k.split(',').map(Number), p = at(s, x, y);
      if (p && p.rock) { hitRock(s, x, y, cracked); continue; }
      if (s.sand[y][x] > 0) { s.sand[y][x]--; s.sandLeft--; washed.push([x, y, s.sand[y][x]]); }
      if (why === 'match') for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) near.add((x + dx) + ',' + (y + dy));
      if (!p || keep.has(k)) continue;
      if (p.t >= 0) s.collected[p.t]++;
      cleared.push({ id: p.id, x, y, t: p.t, sp: p.sp });
      s.grid[y][x] = null;
    }
    for (const k of near) { const [x, y] = k.split(',').map(Number), p = at(s, x, y); if (p && p.rock && !pop.has(k)) hitRock(s, x, y, cracked); }
    for (const m of makeSpecials || []) {
      const [x, y] = m.cell, p = at(s, x, y);
      if (p) { p.sp = m.kind; p.fired = false; if (m.kind === 'pearl') p.t = -1; }
    }
    s.cascade++;
    s.score += cleared.length * 30 * Math.min(6, s.cascade) + (makeSpecials || []).length * 60;
    return { cleared, cracked, washed };
  }
  function hitRock(s, x, y, out) {
    const p = at(s, x, y);
    if (!p || !p.rock) return;
    p.rock--;
    out.push({ x, y, id: p.id, left: p.rock });
    if (p.rock <= 0) { s.grid[y][x] = null; s.rocksLeft--; }
  }
  // Let everything fall, and drop new creatures in from the top of each column.
  function gravity(s) {
    const moves = [], spawns = [];
    for (let x = 0; x < W; x++) {
      const cells = [];
      for (let y = 0; y < H; y++) if (s.open[y][x]) cells.push(y);
      let write = cells.length - 1;
      for (let i = cells.length - 1; i >= 0; i--) {
        const y = cells[i], p = s.grid[y][x];
        if (!p) continue;
        const to = cells[write--];
        if (to !== y) { s.grid[to][x] = p; s.grid[y][x] = null; moves.push({ id: p.id, x, from: y, to }); }
      }
      for (let i = write, k = 1; i >= 0; i--, k++) {
        const y = cells[i], p = { id: s.nextId++, t: Math.floor(s.rand() * s.colors), sp: null };
        s.grid[y][x] = p;
        spawns.push({ id: p.id, x, to: y, from: cells[0] - k, t: p.t });
      }
    }
    return { moves, spawns };
  }

  // ---------- a turn ----------
  // Try swapping (x1,y1) with its neighbour (x2,y2). Returns false if nothing
  // would happen, otherwise records phases and resolves every cascade.
  function swap(s, x1, y1, x2, y2) {
    if (s.over) return false;
    if (Math.abs(x1 - x2) + Math.abs(y1 - y2) !== 1) return false;
    const a = at(s, x1, y1), b = at(s, x2, y2);
    if (!swappable(a) || !swappable(b)) return false;
    s.phases = []; s.cascade = 0;
    // special pairs and pearls go off without needing a line
    const combo = a.sp && b.sp ? true : a.sp === 'pearl' || b.sp === 'pearl';
    s.grid[y1][x1] = b; s.grid[y2][x2] = a;
    if (!combo && !findGroups(s).length) { s.grid[y1][x1] = a; s.grid[y2][x2] = b; return false; }
    s.phases.push({ type: 'swap', a: a.id, b: b.id, from: [x1, y1], to: [x2, y2] });
    s.moves--; s.movesUsed++;
    if (combo) comboBlast(s, a, b, x2, y2, x1, y1);
    resolve(s, [[x1, y1], [x2, y2]]);
    if (!findMoves(s).length) shuffle(s);
    checkEnd(s);
    return true;
  }
  function comboBlast(s, a, b, ax, ay, bx, by) {
    // a now sits at (ax, ay), b at (bx, by)
    let start = [[ax, ay], [bx, by]], info = {};
    const kinds = [a.sp, b.sp];
    if (a.sp === 'pearl' && b.sp === 'pearl') { start = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (s.open[y][x]) start.push([x, y]); a.sp = b.sp = null; }
    else if (kinds.includes('pearl')) {
      const pearl = a.sp === 'pearl' ? a : b, other = pearl === a ? b : a, c = other.t;
      info.pearlColor = c;
      if (other.sp) {
        // every creature of that kind turns into the other special, then they all go off
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = at(s, x, y); if (q && !q.rock && q.t === c) { q.sp = other.sp === 'pearl' ? 'bomb' : other.sp === 'bomb' ? 'bomb' : (x + y) % 2 ? 'h' : 'v'; start.push([x, y]); } }
      }
      pearl.sp = 'pearl';
    } else if (kinds.every((k) => k === 'h' || k === 'v')) { a.sp = 'h'; b.sp = 'v'; }
    else if (kinds.every((k) => k === 'bomb')) { a.sp = b.sp = null; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) start.push([ax + dx, ay + dy]); }
    else { // wave + bubble: three rows and three columns
      a.sp = b.sp = null;
      for (let d = -1; d <= 1; d++) { for (let i = 0; i < W; i++) start.push([i, ay + d]); for (let i = 0; i < H; i++) start.push([ax + d, i]); }
    }
    start = start.filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H && s.open[y][x]);
    const { pop, fired } = blast(s, start, info);
    const r = remove(s, pop, []);
    s.phases.push({ type: 'pop', cleared: r.cleared, cracked: r.cracked, washed: r.washed, fired, combo: true, made: [], score: s.score, cascade: s.cascade });
    s.phases.push(Object.assign({ type: 'fall' }, gravity(s)));
  }
  function resolve(s, swapped) {
    for (let guard = 0; guard < 40; guard++) {
      const groups = findGroups(s);
      if (!groups.length) break;
      const made = [], cells = [];
      for (const g of groups) {
        const sp = specialFor(g, guard === 0 ? swapped : null);
        if (sp && at(s, ...sp.cell).sp) { const free = g.cells.find((c) => !at(s, ...c).sp); sp.cell = free; }
        if (sp && sp.cell) made.push(Object.assign({ t: g.t }, sp));
        cells.push(...g.cells);
      }
      // a special made in this match keeps its square (and doesn't go off yet)
      const { pop, fired } = blast(s, cells.filter((c) => !made.some((m) => m.cell[0] === c[0] && m.cell[1] === c[1])));
      for (const m of made) pop.set(m.cell.join(), 'match');
      const r = remove(s, pop, made);
      s.phases.push({ type: 'pop', cleared: r.cleared, cracked: r.cracked, washed: r.washed, fired, score: s.score, cascade: s.cascade, made: made.map((m) => ({ x: m.cell[0], y: m.cell[1], kind: m.kind, id: at(s, m.cell[0], m.cell[1]).id })) });
      s.phases.push(Object.assign({ type: 'fall' }, gravity(s)));
    }
  }
  // every swap that would do something
  function findMoves(s) {
    const out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const a = at(s, x, y), b = at(s, x + dx, y + dy);
      if (!swappable(a) || !swappable(b)) continue;
      if ((a.sp && b.sp) || a.sp === 'pearl' || b.sp === 'pearl') { out.push([x, y, x + dx, y + dy]); continue; }
      s.grid[y][x] = b; s.grid[y + dy][x + dx] = a;
      if (findGroups(s).length) out.push([x, y, x + dx, y + dy]);
      s.grid[y][x] = a; s.grid[y + dy][x + dx] = b;
    }
    return out;
  }
  function shuffle(s) {
    const pieces = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = at(s, x, y); if (p && !p.rock) pieces.push(p); }
    for (let tries = 0; tries < 30; tries++) {
      for (let i = pieces.length - 1; i > 0; i--) { const j = Math.floor(s.rand() * (i + 1)); [pieces[i], pieces[j]] = [pieces[j], pieces[i]]; }
      let k = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = at(s, x, y); if (p && !p.rock) s.grid[y][x] = pieces[k++]; }
      if (!findGroups(s).length && findMoves(s).length) break;
    }
    s.phases.push({ type: 'shuffle' });
  }

  // ---------- goals ----------
  function progress(s) {
    const g = s.level.goals, parts = [];
    if (g.score) parts.push({ kind: 'score', have: s.score, need: g.score });
    if (g.collect) for (const [k, n] of Object.entries(g.collect)) parts.push({ kind: 'collect', what: k, have: Math.min(n, s.collected[KINDS.indexOf(k)]), need: n });
    if (g.sand) parts.push({ kind: 'sand', have: s.sandTotal - s.sandLeft, need: s.sandTotal });
    if (g.rocks) parts.push({ kind: 'rocks', have: s.rocksTotal - s.rocksLeft, need: s.rocksTotal });
    return parts;
  }
  const done = (s) => progress(s).every((p) => p.have >= p.need);
  function checkEnd(s) {
    if (done(s)) s.over = 'won';
    else if (s.moves <= 0) s.over = 'lost';
  }
  // stars come from the moves left over when the goal is met
  function stars(s) {
    if (s.over !== 'won') return 0;
    const f = (s.bonusMoves !== undefined ? s.bonusMoves : s.moves) / s.level.moves;
    return f >= 0.3 ? 3 : f >= 0.12 ? 2 : 1;
  }

  // When a pool is won, each move left over becomes a wave that goes off at
  // random: the tide bonus. Returns the phases to play.
  function tideBonus(s) {
    s.phases = []; s.cascade = 0;
    const n = Math.min(s.moves, 8);
    for (let i = 0; i < n; i++) {
      const spots = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = at(s, x, y); if (p && !p.rock && !p.sp) spots.push([x, y]); }
      if (!spots.length) break;
      const [x, y] = spots[Math.floor(s.rand() * spots.length)], p = at(s, x, y);
      p.sp = s.rand() < 0.5 ? 'h' : 'v'; p.fired = false;
      s.phases.push({ type: 'charge', id: p.id, x, y, sp: p.sp });
      const { pop, fired } = blast(s, [[x, y]]);
      const r = remove(s, pop, []);
      s.phases.push({ type: 'pop', cleared: r.cleared, cracked: r.cracked, washed: r.washed, fired, made: [], score: s.score, cascade: s.cascade });
      s.phases.push(Object.assign({ type: 'fall' }, gravity(s)));
      resolve(s, null);
    }
    s.score += s.moves * 250;
    s.bonusMoves = s.moves; s.moves = 0;
    return s.phases;
  }

  // ---------- a simple player, for building and checking levels ----------
  function clone(s) {
    const c = JSON.parse(JSON.stringify({ ...s, rand: null, level: null }));
    c.level = s.level; c.rand = rng(0); c.rand.set(s.rand.state());
    return c;
  }
  function bot(s) {
    const moves = findMoves(s);
    let best = null, bs = -Infinity;
    for (const m of moves) {
      const c = clone(s);
      swap(c, ...m);
      const p = progress(c), q = progress(s);
      let sc = (c.score - s.score) * 0.01;
      p.forEach((x, i) => { if (x.kind !== 'score') sc += Math.max(0, Math.min(x.need, x.have) - Math.min(q[i].need, q[i].have)) * 3; });
      if (c.over === 'won') sc += 1000;
      sc += Math.random() * 0.5;
      if (sc > bs) { bs = sc; best = m; }
    }
    return best;
  }

  const api = { W, H, KINDS, create, swap, tideBonus, findMoves, findGroups, progress, done, stars, bot, clone, rng, at };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.TP = root.TP || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
