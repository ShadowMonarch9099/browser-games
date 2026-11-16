// Snap Grid rules: the 8x8 board, the shapes, dealing, placing, line clears
// and scoring. No page code in here, so tools/test-rules.js runs exactly the
// same rules in Node. The random calls happen in the same order as the first
// version of the game, so a daily board deals the same shapes it always did.
(function (root) {
  const N = 8;
  const PALETTE = ['#2de2e6', '#ff3864', '#f9c80e', '#9d4edd', '#3ddc97', '#ff8c42'];
  const GOLD_CHANCE = 0.18;

  // mulberry32, as the arcade kit had it
  function rng(seed) {
    let s = seed >>> 0;
    const rand = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rand.int = (min, max) => min + Math.floor(rand() * (max - min + 1));
    rand.pick = (list) => list[Math.floor(rand() * list.length)];
    return rand;
  }
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  const today = () => new Date().toISOString().slice(0, 10); // UTC date, as before
  const dailyRng = (date = today()) => rng(hash(date + 'snap-grid'));
  const freshRng = () => rng((Math.random() * 2 ** 32) >>> 0);

  // Base shapes; every rotation is generated below (same order as before).
  const BASE = [
    [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
    [[0, 0], [1, 0], [0, 1]],
    [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[1, 0], [2, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 2]], [[1, 0], [1, 1], [1, 2], [0, 2]],
  ];
  const SHAPES = (() => {
    const out = new Map();
    for (const base of BASE) {
      let cells = base;
      for (let r = 0; r < 4; r++) {
        const minX = Math.min(...cells.map((c) => c[0]));
        const minY = Math.min(...cells.map((c) => c[1]));
        const norm = cells.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
        out.set(JSON.stringify(norm), norm);
        cells = cells.map(([x, y]) => [-y, x]);
      }
    }
    return [...out.values()];
  })();

  const size = (p) => ({ w: Math.max(...p.cells.map((c) => c[0])) + 1, h: Math.max(...p.cells.map((c) => c[1])) + 1 });
  const emptyGrid = () => Array.from({ length: N }, () => Array(N).fill(null));
  const fits = (grid, p, gx, gy) => p.cells.every(([x, y]) => gx + x >= 0 && gx + x < N && gy + y >= 0 && gy + y < N && !grid[gy + y][gx + x]);
  function anyFit(grid, p) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (fits(grid, p, x, y)) return true;
    return false;
  }
  function newPiece(rand) {
    const cells = rand.pick(SHAPES);
    return { cells, color: rand.pick(PALETTE), gold: rand() < GOLD_CHANCE ? rand.int(0, cells.length - 1) : -1, used: false };
  }
  // Deal three shapes. If the board has room for anything, at least one fits.
  function deal(grid, rand) {
    let tray;
    for (let tries = 0; tries < 40; tries++) {
      tray = [newPiece(rand), newPiece(rand), newPiece(rand)];
      if (tray.some((p) => anyFit(grid, p))) return tray;
    }
    return tray;
  }

  // A whole game: { grid, tray, score, streak, rand, over, lines, golds, bestStreak }
  function create(rand) {
    const g = { grid: emptyGrid(), tray: null, score: 0, streak: 0, rand, over: false, lines: 0, golds: 0, bestStreak: 0, placed: 0 };
    g.tray = deal(g.grid, rand);
    return g;
  }

  // Which full lines a placement would clear (for previews), without changing anything.
  function wouldClear(grid, p, gx, gy) {
    const filled = (x, y) => !!grid[y][x] || p.cells.some(([cx, cy]) => gx + cx === x && gy + cy === y);
    const rows = [];
    const cols = [];
    for (let k = 0; k < N; k++) {
      let r = true;
      let c = true;
      for (let j = 0; j < N; j++) { if (!filled(j, k)) r = false; if (!filled(k, j)) c = false; }
      if (r) rows.push(k);
      if (c) cols.push(k);
    }
    return { rows, cols };
  }

  // Place tray piece i at (gx, gy). Returns null if it can't go there, or an
  // event: { cells:[[x,y]], cleared:[{x,y,color,gold}], rows, cols, points,
  // placePoints, gold, streak, dealt, over }.
  function place(g, i, gx, gy) {
    const p = g.tray[i];
    if (!p || p.used || g.over || !fits(g.grid, p, gx, gy)) return null;
    const grid = g.grid;
    const cells = [];
    p.cells.forEach(([x, y], k) => { grid[gy + y][gx + x] = { color: p.color, gold: k === p.gold }; cells.push([gx + x, gy + y]); });
    p.used = true;
    g.score += p.cells.length;
    g.placed++;
    const ev = { cells, color: p.color, cleared: [], rows: [], cols: [], points: 0, placePoints: p.cells.length, gold: false, streak: 0, dealt: false, over: false };
    for (let k = 0; k < N; k++) {
      if (grid[k].every(Boolean)) ev.rows.push(k);
      if (grid.every((r) => r[k])) ev.cols.push(k);
    }
    const lines = ev.rows.length + ev.cols.length;
    if (lines) {
      const hit = new Set();
      ev.rows.forEach((y) => { for (let x = 0; x < N; x++) hit.add(y * N + x); });
      ev.cols.forEach((x) => { for (let y = 0; y < N; y++) hit.add(y * N + x); });
      for (const id of hit) {
        const x = id % N;
        const y = (id / N) | 0;
        if (grid[y][x].gold) ev.gold = true;
        ev.cleared.push({ x, y, color: grid[y][x].color, gold: grid[y][x].gold });
        grid[y][x] = null;
      }
      g.streak++;
      ev.points = 10 * lines * lines * (ev.gold ? 2 : 1) + 5 * (g.streak - 1);
      g.score += ev.points;
      g.lines += lines;
      if (ev.gold) g.golds++;
      g.bestStreak = Math.max(g.bestStreak, g.streak);
    } else g.streak = 0;
    ev.streak = g.streak;
    if (g.tray.every((t) => t.used)) { g.tray = deal(grid, g.rand); ev.dealt = true; }
    if (!g.tray.some((t) => !t.used && anyFit(grid, t))) { g.over = true; ev.over = true; }
    return ev;
  }

  // A suggested move for hints and the title-screen autopilot: prefers line
  // clears, then keeping the board open (fewer lonely holes, low and tidy).
  function suggest(g) {
    let best = null;
    g.tray.forEach((p, i) => {
      if (p.used) return;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (!fits(g.grid, p, x, y)) continue;
        const { rows, cols } = wouldClear(g.grid, p, x, y);
        const lines = rows.length + cols.length;
        // simulate to count isolated empty cells afterwards
        const sim = g.grid.map((r) => r.map((c) => !!c));
        p.cells.forEach(([cx, cy]) => { sim[y + cy][x + cx] = true; });
        rows.forEach((r) => { for (let k = 0; k < N; k++) sim[r][k] = false; });
        cols.forEach((c) => { for (let k = 0; k < N; k++) sim[k][c] = false; });
        let holes = 0;
        let contact = 0;
        for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
          if (sim[yy][xx]) continue;
          const closed = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => { const a = xx + dx; const b = yy + dy; return a < 0 || b < 0 || a >= N || b >= N || sim[b][a]; }).length;
          if (closed >= 3) holes++;
        }
        p.cells.forEach(([cx, cy]) => {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const a = x + cx + dx;
            const b = y + cy + dy;
            if (a < 0 || b < 0 || a >= N || b >= N || g.grid[b][a]) contact++;
          }
        });
        const score = lines * 100 + contact * 3 - holes * 12 + p.cells.length;
        if (!best || score > best.score) best = { i, x, y, score, lines };
      }
    });
    return best;
  }

  const api = { N, PALETTE, SHAPES, rng, hash, today, dailyRng, freshRng, size, emptyGrid, fits, anyFit, newPiece, deal, create, wouldClear, place, suggest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.SnapGrid = root.SnapGrid || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
