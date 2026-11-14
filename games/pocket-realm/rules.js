// Pocket Realm rules, with no page code, so tools/simulate.js can play
// thousands of runs to check the balance. game.js draws it and asks the player.
(function (root) {
  const SIZE = 7, KEEP_AT = 26;

  function rng(seed) {
    let s = seed >>> 0;
    const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
    r.pick = (l) => l[Math.floor(r() * l.length)];
    return r;
  }

  const CLASSES = {
    knight: { name: 'Knight', hp: 30, atk: 5, def: 2, perk: 'Tough: takes 1 less damage from every hit' },
    ranger: { name: 'Ranger', hp: 35, atk: 7, def: 1, perk: 'Quick: always strikes first, and can flee for free' },
    mage: { name: 'Mage', hp: 28, atk: 8, def: 1, perk: 'Mend: heal 14 once per fight' },
  };
  const FOES = {
    wolf: { name: 'Wolf', hp: 8, atk: 4, def: 0, xp: 3, gold: 2 },
    bandit: { name: 'Bandit', hp: 11, atk: 5, def: 1, xp: 4, gold: 6 },
    ghost: { name: 'Ghost', hp: 10, atk: 6, def: 2, xp: 5, gold: 3 },
    troll: { name: 'Troll', hp: 20, atk: 6, def: 2, xp: 8, gold: 8 },
    bog: { name: 'Bog lurker', hp: 13, atk: 5, def: 1, xp: 5, gold: 3 },
    dragon: { name: 'The Dragon', hp: 56, atk: 9, def: 3, xp: 0, gold: 0 },
  };
  // Each land: weight in the deck, foe chance and table, and what it gives.
  const LANDS = {
    meadow: { name: 'Meadow', w: 4, foe: 0.15, foes: ['wolf'], gold: [0, 2], heal: 3 },
    forest: { name: 'Forest', w: 5, foe: 0.5, foes: ['wolf', 'wolf', 'bandit'], gold: [1, 3], herb: 0.4 },
    ruins: { name: 'Ruins', w: 3, foe: 0.65, foes: ['ghost', 'bandit'], gold: [4, 9] },
    village: { name: 'Village', w: 3, foe: 0, foes: [], gold: [0, 0], shop: true },
    swamp: { name: 'Swamp', w: 3, foe: 0.55, foes: ['bog'], gold: [1, 4], herb: 0.6 },
    mountain: { name: 'Mountain', w: 3, foe: 0.5, foes: ['troll', 'bandit'], gold: [3, 7] },
    lake: { name: 'Lake', w: 2, foe: 0, foes: [], gold: [0, 0], heal: 8 },
    keep: { name: "Dragon's Keep", w: 0, foe: 1, foes: ['dragon'], gold: [0, 0] },
  };
  // Lands change when placed next to certain neighbours.
  const COMBOS = [
    ['village', 'swamp', 'witch', "Witch's hut", 'Potions here cost half'],
    ['forest', 'ruins', 'grove', 'Haunted grove', 'Ghosts guard double gold'],
    ['mountain', 'lake', 'falls', 'Waterfall', 'Heals you to full'],
    ['meadow', 'village', 'farm', 'Farm', 'A hot meal: heal 6'],
  ];
  const PRICES = { potion: 8, blade: 18, armor: 18 };

  function newRun(seed, cls) {
    const r = rng(seed), c = CLASSES[cls];
    const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    const mid = Math.floor(SIZE / 2);
    board[mid][mid] = { land: 'meadow', name: 'Home', done: true };
    const run = { seed, r, cls, board, x: mid, y: mid, placed: 1, hero: { hp: c.hp, max: c.hp, atk: c.atk, def: c.def, xp: 0, lvl: 1, gold: 5, potions: 1, herbs: 0 }, offer: null, log: [], fight: null, over: null };
    run.offer = drawOffer(run);
    return run;
  }
  function drawOffer(run) {
    if (run.placed >= KEEP_AT) return ['keep'];
    const deck = [];
    for (const [k, v] of Object.entries(LANDS)) for (let i = 0; i < v.w; i++) deck.push(k);
    const a = run.r.pick(deck);
    let b = run.r.pick(deck);
    while (b === a) b = run.r.pick(deck);
    return [a, b];
  }
  const inside = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  const around = (x, y) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([a, b]) => inside(a, b));
  const freeSpots = (run) => around(run.x, run.y).filter(([x, y]) => !run.board[y][x]);
  const walkSpots = (run) => around(run.x, run.y).filter(([x, y]) => run.board[y][x]);

  // Place a land next to the hero, move there, and find out what happens.
  function place(run, land, x, y) {
    const neighbours = around(x, y).map(([a, b]) => run.board[b][a]).filter(Boolean).map((t) => t.land);
    let tile = { land, name: LANDS[land].name, special: null, done: false };
    for (const [a, b, id, name, text] of COMBOS) if (land === a && neighbours.includes(b)) { tile.special = id; tile.name = name; run.log.push(name + ': ' + text); break; }
    run.board[y][x] = tile;
    run.placed++;
    return enter(run, x, y);
  }
  function walk(run, x, y) { return enter(run, x, y); }

  function enter(run, x, y) {
    run.x = x; run.y = y;
    const t = run.board[y][x], L = LANDS[t.land], h = run.hero;
    run.offer = drawOffer(run);
    if (t.done) { if (t.land === 'lake' || t.special === 'falls') heal(run, t.special === 'falls' ? h.max : 4); return 'walk'; }
    t.done = true;
    if (L.heal) heal(run, L.heal);
    if (t.special === 'falls') heal(run, h.max);
    if (t.special === 'farm') heal(run, 6);
    if (L.herb && run.r() < L.herb) { h.herbs++; run.log.push('Found a healing herb'); }
    if (L.foe && run.r() < L.foe) {
      const type = run.r.pick(L.foes), f = FOES[type], tough = 1 + (run.placed / KEEP_AT) * 0.5;
      const hp = type === 'dragon' ? f.hp : Math.round(f.hp * tough);
      run.fight = { type, name: f.name, hp, max: hp, atk: type === 'dragon' ? f.atk : Math.round(f.atk * (0.85 + tough * 0.15)), def: f.def, mended: false, double: t.special === 'grove' };
      run.log.push('A ' + f.name.toLowerCase() + ' attacks!');
      return 'fight';
    }
    loot(run, L);
    return L.shop || t.special === 'witch' ? 'shop' : 'calm';
  }
  function heal(run, n) { const h = run.hero; const before = h.hp; h.hp = Math.min(h.max, h.hp + n); if (h.hp > before) run.log.push('Healed ' + (h.hp - before)); }
  function loot(run, L, mult = 1) { const g = run.r.int(L.gold[0], L.gold[1]) * mult; if (g) { run.hero.gold += g; run.log.push('+' + g + ' gold'); } }

  // One round of a fight. action: attack | potion | herb | mend | flee
  function round(run, action) {
    const f = run.fight, h = run.hero, c = run.cls, r = run.r;
    const hit = (atk, def) => Math.max(1, atk - def + r.int(-1, 2));
    const foeHits = () => { const d = Math.max(1, hit(f.atk, h.def) - (c === 'knight' ? 1 : 0)); h.hp -= d; run.log.push(f.name + ' hits you for ' + d); };
    if (action === 'flee') {
      if (f.type === 'dragon') { run.log.push('There is no running from the dragon'); }
      else { if (c !== 'ranger') foeHits(); run.fight = null; run.log.push('You got away'); return check(run) || 'fled'; }
    } else if (action === 'potion' && h.potions) { h.potions--; heal(run, 14); }
    else if (action === 'herb' && h.herbs) { h.herbs--; heal(run, 7); }
    else if (action === 'mend' && c === 'mage' && !f.mended) { f.mended = true; heal(run, 14); }
    else {
      if (c === 'ranger' || r() < 0.5) { strike(run); if (f.hp <= 0) return win(run); foeHits(); }
      else { foeHits(); if (h.hp <= 0) return check(run); strike(run); if (f.hp <= 0) return win(run); }
      return check(run) || 'fight';
    }
    foeHits();
    return check(run) || 'fight';
  }
  function strike(run) { const f = run.fight, d = Math.max(1, run.hero.atk - f.def + run.r.int(-1, 2)); f.hp -= d; run.log.push('You hit for ' + d); }
  function win(run) {
    const f = run.fight, h = run.hero, foe = FOES[f.type];
    run.fight = null;
    if (f.type === 'dragon') { run.over = 'won'; run.log.push('The dragon falls!'); return 'won'; }
    h.xp += foe.xp; h.gold += foe.gold * (f.double ? 2 : 1);
    run.log.push(f.name + ' defeated: +' + foe.xp + ' xp, +' + foe.gold * (f.double ? 2 : 1) + ' gold');
    while (h.xp >= h.lvl * 8) { h.xp -= h.lvl * 8; h.lvl++; h.max += 5; h.hp += 5; h.atk += 1; run.log.push('Level ' + h.lvl + '! Stronger and tougher'); }
    const t = run.board[run.y][run.x];
    loot(run, LANDS[t.land], t.special === 'grove' ? 2 : 1);
    return t.land === 'village' ? 'shop' : 'calm';
  }
  function check(run) { if (run.hero.hp <= 0) { run.over = 'lost'; run.fight = null; return 'lost'; } return null; }

  function price(run, item) { const t = run.board[run.y][run.x]; return item === 'potion' && t.special === 'witch' ? PRICES.potion / 2 : PRICES[item]; }
  function buy(run, item) {
    const h = run.hero, cost = price(run, item);
    if (h.gold < cost) return false;
    h.gold -= cost;
    if (item === 'potion') h.potions++;
    if (item === 'blade') h.atk += 2;
    if (item === 'armor') h.def += 1;
    run.log.push('Bought ' + item);
    return true;
  }
  const stuck = (run) => !freeSpots(run).length && !walkSpots(run).length;

  const api = { SIZE, KEEP_AT, CLASSES, FOES, LANDS, COMBOS, PRICES, newRun, place, walk, round, buy, price, freeSpots, walkSpots, stuck };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Realm = api;
})(typeof window !== 'undefined' ? window : globalThis);
