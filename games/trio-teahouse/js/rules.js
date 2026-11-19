// Trio Teahouse rules: porcelain tiles are stacked on the tea table. A tile
// can be picked up when no tile above overlaps it. Picked tiles go onto the
// serving tray (seven saucers); three of a kind on the tray are served and
// leave. Fill the tray with no three alike and the table is lost. Clear the
// table to win.
// Positions are in half-tile units: a tile at (x, y) covers x..x+2, y..y+2,
// so tiles on upper layers can sit half over two below them.
(function (root) {
  const TRAY = 7;
  const KINDS = ['teapot', 'cup', 'leaf', 'dumpling', 'mooncake', 'lotus', 'fan', 'lantern', 'bamboo', 'blossom', 'koi', 'whisk', 'kettle', 'citrus', 'honey', 'bun'];

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const overlaps = (a, b) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;

  // ---------- table layouts ----------
  // Each layer is a list of rows of '#' (a tile) and '.' (none), on a grid of
  // whole tiles; odd layers are shifted by half a tile so they bridge gaps.
  const SHAPES = {
    square: (w, h) => Array.from({ length: h }, () => '#'.repeat(w)),
    diamond: (w, h) => Array.from({ length: h }, (_, y) => { const r = Math.round(Math.abs(y - (h - 1) / 2) * (w / h)); return Array.from({ length: w }, (_, x) => (x >= Math.floor(r / 2) && x < w - Math.floor(r / 2) ? '#' : '.')).join(''); }),
    ring: (w, h) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (y === 0 || y === h - 1 || x === 0 || x === w - 1 ? '#' : '.')).join('')),
    cross: (w, h) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (Math.abs(x - (w - 1) / 2) < w / 5 || Math.abs(y - (h - 1) / 2) < h / 5 ? '#' : '.')).join('')),
    pillars: (w, h) => Array.from({ length: h }, () => Array.from({ length: w }, (_, x) => (x % 2 === 0 ? '#' : '.')).join('')),
    checker: (w, h) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => ((x + y) % 2 === 0 ? '#' : '.')).join('')),
  };
  // build a list of positions for level n
  function layout(n, rand) {
    const plans = [
      [['square', 4, 3]],
      [['square', 5, 4], ['square', 2, 2]],
      [['diamond', 6, 5], ['square', 3, 2]],
      [['square', 6, 5], ['ring', 5, 4], ['square', 2, 1]],
      [['cross', 7, 6], ['square', 4, 3], ['square', 3, 2]],
      [['ring', 7, 6], ['checker', 6, 5], ['square', 3, 3], ['square', 2, 2]],
      [['diamond', 7, 7], ['diamond', 6, 6], ['cross', 5, 5], ['square', 2, 2]],
      [['pillars', 7, 6], ['square', 6, 5], ['ring', 5, 4], ['square', 4, 3], ['square', 1, 1]],
      [['square', 7, 6], ['checker', 6, 5], ['square', 5, 4], ['ring', 4, 3], ['square', 3, 2]],
      [['diamond', 8, 7], ['square', 7, 6], ['cross', 6, 5], ['square', 3, 3], ['diamond', 2, 2], ['square', 1, 1]],
    ];
    const plan = plans[Math.min(plans.length - 1, Math.floor((n - 1) / 3))];
    const tiles = [];
    plan.forEach(([shape, w, h], z) => {
      const rows = SHAPES[shape](w, h);
      // centre every layer on the same middle; half-tile offsets come for free
      const base = plan[0], ox = base[1] - w, oy = base[2] - h;
      rows.forEach((row, y) => row.split('').forEach((c, x) => { if (c === '#') tiles.push({ x: x * 2 + ox, y: y * 2 + oy, z }); }));
    });
    // a few loose tiles scattered on top in later levels, for variety
    const extra = Math.min(6, Math.floor(n / 4));
    for (let i = 0, tries = 0; i < extra && tries < 60; tries++) {
      const t = tiles[Math.floor(rand() * tiles.length)], c = { x: t.x + (rand() < 0.5 ? 1 : -1), y: t.y + (rand() < 0.5 ? 1 : -1), z: plan.length + Math.floor(i / 3) };
      if (tiles.some((o) => o.z === c.z && overlaps(o, c))) continue;
      tiles.push(c); i++;
    }
    // keep a multiple of three, dropping from the top
    tiles.sort((a, b) => a.z - b.z);
    while (tiles.length % 3) tiles.pop();
    return tiles;
  }

  // ---------- dealing ----------
  // Find an order in which every tile is free when its turn comes (taking
  // from the top), then hand out kinds in triples along that order, a few
  // triples overlapping, so the table can always be cleared.
  function deal(pos, kinds, mix, rand) {
    const left = pos.map((p, i) => Object.assign({ i }, p)), order = [];
    while (left.length) {
      const free = left.filter((a) => !left.some((b) => b.z > a.z && overlaps(a, b)));
      const pick = free[Math.floor(rand() * free.length)];
      order.push(pick.i); left.splice(left.indexOf(pick), 1);
    }
    const kindOf = new Array(pos.length);
    const groups = order.length / 3, labels = [];
    for (let g = 0; g < groups; g++) labels.push(g);
    // interleave: within each window of `mix` triples, shuffle the 3*mix slots
    const seq = [];
    for (let g = 0; g < groups; g += mix) {
      const win = [];
      for (let k = g; k < Math.min(groups, g + mix); k++) win.push(k, k, k);
      for (let i = win.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [win[i], win[j]] = [win[j], win[i]]; }
      seq.push(...win);
    }
    // each group gets a kind (kinds repeat when there are more groups)
    const kindForGroup = labels.map((g) => kinds[(g + Math.floor(rand() * kinds.length)) % kinds.length]);
    order.forEach((ti, n) => { kindOf[ti] = kindForGroup[seq[n]]; });
    return { kindOf, order };
  }

  // level n (1-based) or a daily blend (seed)
  function level(n, seed) {
    const rand = rng(seed || n * 7919);
    const pos = layout(n, rand);
    const nk = Math.min(KINDS.length, 5 + Math.floor(n / 3));
    const kinds = KINDS.slice().sort(() => rand() - 0.5).slice(0, nk);
    const mix = n < 4 ? 1 : n < 10 ? 2 : 3;
    const { kindOf, order } = deal(pos, kinds, mix, rand);
    return { n, tiles: pos.map((p, i) => ({ id: i, x: p.x, y: p.y, z: p.z, k: kindOf[i] })), order, kinds };
  }

  function create(lv, tools) {
    return {
      lv, tiles: lv.tiles.map((t) => Object.assign({ gone: false }, t)), tray: [], aside: [], served: 0, picks: 0, history: [], over: null, combo: 0,
      tools: Object.assign({ undo: 3, aside: 1, stir: 2 }, tools),
    };
  }
  const onTable = (s) => s.tiles.filter((t) => !t.gone && !t.inTray);
  function isFree(s, t) {
    if (t.gone || t.inTray) return false;
    if (t.aside) return true;
    for (const o of s.tiles) if (!o.gone && !o.inTray && !o.aside && o.z > t.z && overlaps(t, o)) return false;
    return true;
  }
  function snapshot(s) { return { tiles: s.tiles.map((t) => [t.gone, t.inTray, t.aside, t.k]), tray: s.tray.slice(), aside: s.aside.slice(), served: s.served }; }
  function restore(s, snap) { s.tiles.forEach((t, i) => { [t.gone, t.inTray, t.aside, t.k] = snap.tiles[i]; }); s.tray = snap.tray; s.aside = snap.aside; s.served = snap.served; s.over = null; }

  // Pick up a tile. Returns events: { type: 'pick', id, slot } and maybe
  // { type: 'serve', ids, k } and { type: 'win' | 'lose' }.
  function pick(s, id) {
    if (s.over) return null;
    const t = s.tiles[id];
    if (!t || !isFree(s, t)) return null;
    s.history.push(snapshot(s));
    if (s.history.length > 30) s.history.shift();
    if (t.aside) { t.aside = false; s.aside.splice(s.aside.indexOf(id), 1); }
    t.inTray = true; s.picks++;
    // slide in beside its own kind
    let at = s.tray.length;
    for (let i = s.tray.length - 1; i >= 0; i--) if (s.tiles[s.tray[i]].k === t.k) { at = i + 1; break; }
    s.tray.splice(at, 0, id);
    const ev = [{ type: 'pick', id, slot: at }];
    const same = s.tray.filter((x) => s.tiles[x].k === t.k);
    if (same.length >= 3) {
      const ids = same.slice(0, 3);
      for (const x of ids) { s.tiles[x].gone = true; s.tiles[x].inTray = false; }
      s.tray = s.tray.filter((x) => !ids.includes(x));
      s.served++; s.combo++;
      ev.push({ type: 'serve', ids, k: t.k, combo: s.combo });
    } else s.combo = 0;
    if (!onTable(s).length && !s.tray.length && !s.aside.length) { s.over = 'won'; ev.push({ type: 'win' }); }
    else if (s.tray.length >= TRAY) { s.over = 'lost'; ev.push({ type: 'lose' }); }
    return ev;
  }
  function undo(s) {
    if (!s.history.length || s.tools.undo <= 0) return false;
    const snap = s.history.pop();
    // can't take back a serving
    if (snap.served !== s.served) { s.history.push(snap); return false; }
    restore(s, snap); s.tools.undo--;
    return true;
  }
  // set the first three tray tiles aside on the counter, where they stay free
  function setAside(s) {
    if (s.tools.aside <= 0 || !s.tray.length || s.over === 'won') return false;
    const ids = s.tray.splice(0, 3);
    for (const id of ids) { const t = s.tiles[id]; t.inTray = false; t.aside = true; s.aside.push(id); }
    s.tools.aside--; s.over = null; s.history = [];
    return ids;
  }
  // stir the pot: shuffle the kinds of every tile still on the table
  function stir(s, rand) {
    if (s.tools.stir <= 0 || s.over) return false;
    const t = s.tiles.filter((x) => !x.gone && !x.inTray && !x.aside), ks = t.map((x) => x.k);
    rand = rand || Math.random;
    for (let i = ks.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [ks[i], ks[j]] = [ks[j], ks[i]]; }
    t.forEach((x, i) => { x.k = ks[i]; });
    s.tools.stir--; s.history = [];
    return true;
  }
  // stars: no helpers used and a clean finish give three
  function stars(s) {
    if (s.over !== 'won') return 0;
    const used = 3 - s.tools.undo + (1 - s.tools.aside) * 2 + (2 - s.tools.stir) * 2;
    return used === 0 ? 3 : used <= 2 ? 2 : 1;
  }
  // a careful player, for checking tables: prefer picks that serve, then
  // picks that pair, never one that would fill the tray
  function bot(s, rand) {
    rand = rand || Math.random;
    const free = s.tiles.filter((t) => isFree(s, t));
    if (!free.length) return null;
    const inTray = (k) => s.tray.filter((x) => s.tiles[x].k === k).length;
    let best = null, bs = -1e9;
    for (const t of free) {
      const n = inTray(t.k);
      let sc = n === 2 ? 100 : n === 1 ? 20 : 0;
      if (n < 2 && s.tray.length >= TRAY - 1) sc -= 1000;
      // look at how many of this kind are free right now
      sc += free.filter((o) => o.k === t.k).length * 4;
      if (t.aside) sc += 5;
      sc += rand();
      if (sc > bs) { bs = sc; best = t; }
    }
    return best.id;
  }

  const api = { TRAY, KINDS, level, create, isFree, pick, undo, setAside, stir, stars, bot, onTable, rng, overlaps };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.TT = root.TT || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
