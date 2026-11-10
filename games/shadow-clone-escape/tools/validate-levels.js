// Sanity-checks js/levels.js: map shape, legend, plate/door wiring, guard
// positions, and that every goal is reachable. Usage: node tools/validate-levels.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { Math, console };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/config.js', 'js/levels.js', 'js/level.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const { CFG: C, LEVELS, Level } = ctx.SCE;
const T = C.TILE;
const ALLOWED = new Set('#.=,XBOPEk*L123456789abcdefghij'.split(''));

let failures = 0;
const fail = (lvl, msg) => {
  failures++;
  console.log(`  ✗ [${lvl}] ${msg}`);
};

LEVELS.forEach((def, li) => {
  const tag = `${li + 1}. ${def.name}`;
  if (def.map.length !== 16) fail(tag, `expected 16 rows, got ${def.map.length}`);
  def.map.forEach((row, r) => {
    const chunks = row.split('|');
    if (chunks.length !== 3 || chunks.some((c) => c.length !== 10)) fail(tag, `row ${r + 1} is not "10|10|10": "${row}"`);
    for (const ch of chunks.join('')) if (!ALLOWED.has(ch)) fail(tag, `row ${r + 1} has unknown char "${ch}"`);
  });

  const L = new Level(def);
  if (!L.start) fail(tag, 'no player start P');
  if (!L.exits.length) fail(tag, 'no exit E');
  const shards = L.items.filter((i) => i.type === 'shard').length;
  const keys = L.items.filter((i) => i.type === 'key').length;
  if (shards !== 3) fail(tag, `expected 3 shards, found ${shards}`);
  if (keys < L.locks.length) fail(tag, `${L.locks.length} locks but only ${keys} keys`);

  const used = new Set(L.plates.map((p) => p.ch));
  for (const ch of Object.keys(def.plates || {})) if (!used.has(ch)) fail(tag, `plate "${ch}" configured but not on map`);
  for (const d of Object.values(L.doors)) {
    if (!d.tiles.length) fail(tag, `door group ${d.group} has plates but no tiles`);
    if (!d.plates.length) fail(tag, `door group ${d.group} has no plates`);
    if (d.twin && d.plates.length < 2) fail(tag, `twin door ${d.group} needs 2+ plates`);
    // Brief: twin doors need player AND clone. Only hold plates guarantee two
    // bodies; a lever or timed plate could be pressed by one in turn.
    if (d.twin && d.plates.some((p) => p.type !== 'hold')) fail(tag, `twin door ${d.group} must use hold plates only`);
  }

  // Open everything, then flood-fill what the player can reach.
  for (const d of Object.values(L.doors)) d.open = true;
  for (const l of L.locks) l.open = true;
  const reach = new Set();
  const sc = Math.floor(L.start.x / T);
  const sr = Math.floor(L.start.y / T);
  const q = [[sc, sr]];
  reach.add(`${sc},${sr}`);
  while (q.length) {
    const [c, r] = q.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${c + dc},${r + dr}`;
      if (!reach.has(k) && !L.solid(c + dc, r + dr, 'player')) {
        reach.add(k);
        q.push([c + dc, r + dr]);
      }
    }
  }
  const has = (o) => reach.has(`${o.c},${o.r}`);
  L.exits.forEach((e) => has(e) || fail(tag, `exit at col ${e.c} row ${e.r} unreachable`));
  L.items.forEach((it) => has(it) || fail(tag, `${it.type} at col ${it.c} row ${it.r} unreachable`));

  // Plates must be reachable by the player, or by a clone cast from a
  // reachable tile (within the leash).
  for (const p of L.plates) {
    if (has(p)) continue;
    let best = Infinity;
    for (const k of reach) {
      const [c, r] = k.split(',').map(Number);
      best = Math.min(best, Math.hypot((c - p.c) * T, (r - p.r) * T));
    }
    if (best > C.CLONE_LEASH - 5) fail(tag, `plate "${p.ch}" is ${best.toFixed(0)}px from any reachable tile (leash ${C.CLONE_LEASH})`);
  }

  (def.guards || []).forEach((g, gi) => {
    const pts = g.type === 'patrol' ? g.path : [g.at];
    for (const [i, r] of pts) if (L.solid(i + 1, r, 'guard')) fail(tag, `guard ${gi} point [${i},${r}] is solid`);
  });
});

if (failures) {
  console.log(`\n${failures} problem(s) found.`);
  process.exit(1);
}
console.log(`All ${LEVELS.length} levels look valid.`);
