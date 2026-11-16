// Paper Trail rules: draw one line, starting at the marked square, that visits
// every square exactly once. Some pages can't be done flat. Fold the paper
// (left edge to right edge, or top to bottom) and the squares on those edges
// touch, so the line can pass over the fold. Every page is built from a real
// path and checked to need its folds. No page code here, so
// tools/check-levels.js runs the same generator in Node.
(function (root) {
  const LEVELS = 50;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // mulberry32 and FNV-1a, exactly as the first version used them, so every
  // page is the same page it always was.
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

  // Neighbours of a cell, passing over the folds that are on.
  function neighbours(lv, folds, x, y) {
    const out = [];
    for (const [dx, dy] of DIRS) {
      let nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= lv.w) { if (!folds.x) continue; nx = (nx + lv.w) % lv.w; }
      if (ny < 0 || ny >= lv.h) { if (!folds.y) continue; ny = (ny + lv.h) % lv.h; }
      if (lv.open[ny * lv.w + nx]) out.push(ny * lv.w + nx);
    }
    return out;
  }
  const nb = (lv, folds, k) => neighbours(lv, folds, k % lv.w, (k / lv.w) | 0);

  // Finish a line from `prefix` through every open square (depth-first,
  // squares with fewest exits first). Returns the whole line, false when there
  // is none, or null when it gives up after `limit` steps.
  function solveFrom(lv, folds, prefix, limit = 200000) {
    const total = lv.open.filter(Boolean).length;
    const seen = new Uint8Array(lv.w * lv.h), line = prefix.slice();
    for (const k of line) seen[k] = 1;
    let steps = 0;
    function go(c, n) {
      if (n === total) return true;
      if (++steps > limit) throw new Error('limit');
      const next = nb(lv, folds, c).filter((k) => !seen[k]);
      next.sort((a, b) => nb(lv, folds, a).filter((k) => !seen[k]).length - nb(lv, folds, b).filter((k) => !seen[k]).length);
      for (const k of next) { seen[k] = 1; line.push(k); if (go(k, n + 1)) return true; seen[k] = 0; line.pop(); }
      return false;
    }
    try { return go(line[line.length - 1], line.length) ? line : false; } catch (e) { return null; }
  }
  // Is there a line from the start through every open square?
  function solvable(lv, folds, limit = 200000) {
    const r = solveFrom(lv, folds, [lv.start], limit);
    return r === null ? null : !!r;
  }

  // Build a page: a random walk that uses the folds; every square it misses
  // becomes a hole. Keep it only if it really can't be done without the folds.
  function makeLevel(n) {
    const rand = rng(hash('paper-trail:' + n));
    const size = n <= 8 ? [4, 4] : n <= 20 ? [5, 4] : n <= 35 ? [5, 5] : [6, 5];
    const need = n <= 6 ? { x: true, y: false } : n <= 12 ? { x: false, y: true } : rand() < 0.4 ? { x: true, y: true } : rand() < 0.5 ? { x: true, y: false } : { x: false, y: true };
    for (let tries = 0; tries < 400; tries++) {
      const [w, h] = size;
      const lv = { w, h, open: Array(w * h).fill(true), start: 0, folds: need };
      const path = [rand.int(0, w * h - 1)];
      const used = new Set(path);
      let crossings = 0;
      for (;;) {
        const c = path[path.length - 1];
        const options = neighbours(lv, need, c % w, (c / w) | 0).filter((k) => !used.has(k));
        if (!options.length) break;
        const k = rand.pick(options);
        if (Math.abs((k % w) - (c % w)) > 1 || Math.abs(((k / w) | 0) - ((c / w) | 0)) > 1) crossings++;
        path.push(k); used.add(k);
      }
      if (path.length < w * h * 0.7 || crossings < 1) continue;
      lv.open = lv.open.map((_, i) => used.has(i));
      lv.start = path[0];
      if (solvable(lv, { x: false, y: false }) !== false) continue;           // must need a fold
      if (need.x && need.y && (solvable(lv, { x: true, y: false }) !== false || solvable(lv, { x: false, y: true }) !== false)) continue;
      lv.n = n;
      return lv;
    }
    throw new Error('could not build level ' + n);
  }
  // A step from a to b that goes over a fold rather than across the page.
  const wraps = (lv, a, b) => Math.abs((a % lv.w) - (b % lv.w)) > 1 ? 'x' : Math.abs(((a / lv.w) | 0) - ((b / lv.w) | 0)) > 1 ? 'y' : null;

  const api = { LEVELS, neighbours, solvable, solveFrom, makeLevel, wraps, rng, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PT = root.PT || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
