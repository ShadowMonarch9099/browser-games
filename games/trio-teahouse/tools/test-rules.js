// Checks the Trio Teahouse rules and that every table can be cleared.
// Run: node games/trio-teahouse/tools/test-rules.js
const R = require('../js/rules.js');
const assert = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1; } };
const LEVELS = 30;

for (let n = 1; n <= LEVELS; n++) {
  const lv = R.level(n);
  assert(lv.tiles.length % 3 === 0, `table ${n} has ${lv.tiles.length} tiles`);
  const count = {};
  for (const t of lv.tiles) count[t.k] = (count[t.k] || 0) + 1;
  assert(Object.values(count).every((c) => c % 3 === 0), `table ${n}: every kind comes in threes`);
  // no two tiles in the same spot on the same layer
  for (const a of lv.tiles) for (const b of lv.tiles) if (a !== b && a.z === b.z) assert(!R.overlaps(a, b), `table ${n}: tiles ${a.id} and ${b.id} collide`);
  // following the dealing order always clears the table
  const s = R.create(lv);
  for (const id of lv.order) { assert(R.isFree(s, s.tiles[id]), `table ${n}: tile ${id} free in order`); R.pick(s, id); }
  assert(s.over === 'won', `table ${n} clears in dealing order (${s.over})`);
}

// basics
{
  const s = R.create(R.level(1));
  const top = s.tiles.find((t) => R.isFree(s, t));
  const ev = R.pick(s, top.id);
  assert(ev[0].type === 'pick' && s.tray.length === 1, 'a free tile goes to the tray');
  assert(R.pick(s, top.id) === null, 'a tile in the tray can\'t be picked again');
  assert(R.undo(s) && s.tray.length === 0 && s.tools.undo === 2, 'undo returns it');
}
{
  // a covered tile can't be picked
  const lv = R.level(5), s = R.create(lv);
  const covered = s.tiles.find((t) => !R.isFree(s, t));
  assert(covered && R.pick(s, covered.id) === null, 'covered tiles stay put');
}
{
  // three alike are served; seven unlike lose
  const lv = { tiles: [], order: [] };
  const kinds = ['teapot', 'cup', 'leaf', 'dumpling', 'mooncake', 'lotus', 'fan', 'lantern'];
  kinds.forEach((k, i) => { for (let j = 0; j < 3; j++) lv.tiles.push({ id: lv.tiles.length, x: (i * 3 + j) * 2, y: 0, z: 0, k }); });
  let s = R.create(lv);
  R.pick(s, 0); R.pick(s, 3); R.pick(s, 1);
  assert(s.tray.map((i) => s.tiles[i].k).join() === 'teapot,teapot,cup', 'tiles slide in beside their kind');
  const ev = R.pick(s, 2);
  assert(ev.some((e) => e.type === 'serve') && s.tray.length === 1 && s.served === 1, 'three alike are served');
  s = R.create(lv);
  for (let i = 0; i < 7; i++) R.pick(s, i * 3);
  assert(s.over === 'lost', 'a full tray with no three loses');
  const aside = R.setAside(s);
  assert(aside && aside.length === 3 && s.over === null && s.tray.length === 4, 'setting aside reopens the tray');
  assert(R.isFree(s, s.tiles[aside[0]]), 'aside tiles can be picked');
  assert(R.stir(s) && s.tools.stir === 1, 'stir shuffles');
}

// a careful player clears most tables without helpers
let wins = 0, tries = 0;
const per = [];
for (let n = 1; n <= LEVELS; n++) {
  let w = 0;
  for (let i = 0; i < 6; i++) {
    const s = R.create(R.level(n)), rand = R.rng(n * 100 + i);
    while (!s.over) { const id = R.bot(s, rand); if (id === null) break; R.pick(s, id); }
    if (s.over === 'won') w++;
  }
  per.push(`${n}:${w}`); wins += w; tries += 6;
}
console.log(per.join(' '), `→ ${Math.round((wins / tries) * 100)}% without helpers; ${R.level(LEVELS).tiles.length} tiles on the last table`);
if (!process.exitCode) console.log('trio-teahouse: rules hold');
