// Pour Party rules: the glasses, the pours, the solver and the level maker.
// No page code in here, so tools/test-rules.js runs exactly the same rules in
// Node that the browser plays with.
(function (root) {
  const CAP = 4; // units of drink in a full glass

  // ---- repeatable random numbers (mulberry32): same level number, same level, everywhere ----
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
    rand.shuffle = (list) => {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    };
    return rand;
  }
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  const coloursFor = (lv) => (lv <= 3 ? 3 : lv <= 8 ? 4 : lv <= 15 ? 5 : lv <= 30 ? 6 : lv <= 60 ? 7 : lv <= 100 ? 8 : 9);
  const HIDDEN_FROM = 10; // from this level, everything under the top unit starts as a mystery

  const top = (t) => t[t.length - 1];
  const complete = (t) => t.length === CAP && t.every((u) => u.c === t[0].c);
  const solved = (ts) => ts.every((t) => t.length === 0 || complete(t));
  // How many units on top share a colour (hidden ones never come along).
  function run(t) {
    let k = 0;
    for (let i = t.length - 1; i >= 0 && t[i].c === top(t).c && !t[i].hidden; i--) k++;
    return k;
  }
  function canPour(from, to) {
    if (from === to || !from.length || to.length >= CAP) return 0;
    if (to.length && top(to).c !== top(from).c) return 0;
    return Math.min(run(from), CAP - to.length);
  }
  const copy = (ts) => ts.map((t) => t.map((u) => ({ c: u.c, hidden: u.hidden })));

  // Pour glass i into glass j. Returns null if it isn't allowed, otherwise what
  // moved: { n, c, revealed } (revealed: a mystery unit was uncovered).
  function pour(ts, i, j) {
    const n = canPour(ts[i], ts[j]);
    if (!n) return null;
    const c = top(ts[i]).c;
    for (let k = 0; k < n; k++) ts[j].push(ts[i].pop());
    let revealed = false;
    if (ts[i].length && top(ts[i]).hidden) { top(ts[i]).hidden = false; revealed = true; }
    return { n, c, revealed };
  }

  // Depth-first search for a solution. Used to make sure every level can be
  // solved, and to give hints. Returns a list of [from, to] or null.
  // `order` (optional) is the order to try glasses in; the level maker never
  // passes it, so levels never change.
  function solve(ts, limit = 40000, order = null) {
    const cur = ts.map((t) => t.map((u) => u.c));
    const idx = order || cur.map((_, i) => i);
    const seen = new Set();
    const path = [];
    let nodes = 0;
    const done = () => cur.every((t) => !t.length || (t.length === CAP && t.every((c) => c === t[0])));
    function dfs() {
      if (done()) return true;
      if (++nodes > limit) return false;
      const key = cur.map((t) => t.join(',')).sort().join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      for (const i of idx) {
        const a = cur[i];
        if (!a.length) continue;
        const c = a[a.length - 1];
        let k = 1;
        while (k < a.length && a[a.length - 1 - k] === c) k++;
        if (k === CAP) continue; // finished glass
        let triedEmpty = false;
        for (const j of idx) {
          const b = cur[j];
          if (j === i || b.length + k > CAP) continue;
          if (b.length) { if (b[b.length - 1] !== c) continue; }
          else { if (k === a.length || triedEmpty) continue; triedEmpty = true; }
          for (let n = 0; n < k; n++) b.push(a.pop());
          path.push([i, j]);
          if (dfs()) return true;
          path.pop();
          for (let n = 0; n < k; n++) a.push(b.pop());
        }
      }
      return false;
    }
    return dfs() ? path : null;
  }

  // The same level number gives everyone the same puzzle.
  function makeLevel(lv) {
    const rand = rng(hash('pour-party:' + lv));
    const n = coloursFor(lv);
    for (;;) {
      const units = [];
      for (let c = 0; c < n; c++) for (let i = 0; i < CAP; i++) units.push(c);
      rand.shuffle(units);
      const ts = [];
      for (let t = 0; t < n; t++) ts.push(units.slice(t * CAP, t * CAP + CAP).map((c) => ({ c, hidden: false })));
      ts.push([], []);
      if (ts.some(complete) || !solve(ts)) continue;
      if (lv >= HIDDEN_FROM) for (const t of ts) t.forEach((u, i) => { u.hidden = i < t.length - 1; });
      return ts;
    }
  }

  // "Par": the shortest of a handful of solver runs that try the glasses in
  // different (repeatable) orders. Not a proven best, but a fair target.
  function par(ts, lv, runs = 10) {
    const rand = rng(hash('pour-party-par:' + lv));
    let best = solve(ts);
    for (let r = 0; r < runs; r++) {
      const order = rand.shuffle(ts.map((_, i) => i));
      const p = solve(ts, 12000, order);
      if (p && (!best || p.length < best.length)) best = p;
    }
    return best ? best.length : 0;
  }

  // Stars for a finished level: 3 for matching par, 2 for close, 1 for finishing.
  // A hint caps the level at two stars.
  function stars(moves, parMoves, hints) {
    let s = moves <= parMoves ? 3 : moves <= parMoves + Math.ceil(parMoves * 0.35) ? 2 : 1;
    if (hints > 0) s = Math.min(s, 2);
    return s;
  }

  const api = { CAP, HIDDEN_FROM, rng, hash, coloursFor, top, complete, solved, run, canPour, copy, pour, solve, makeLevel, par, stars };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PourParty = root.PourParty || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
