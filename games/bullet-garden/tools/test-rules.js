// Plays Bullet Garden nights in Node with a simple gardener bot (rings the
// greenhouse with spitters, keeps them watered, shoots the nearest bug) to
// check the rules: seeds grow, bugs path around walls, nights end at dawn,
// and a careful player can reach the last night.
// Usage: node games/bullet-garden/tools/test-rules.js
const R = require('../js/rules.js');
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL ' + msg); } };

// a seed that misses lands and grows
{
  const g = R.create(1);
  g.toSpawn = ['ant']; g.spawnT = 99;
  R.step(g, 1 / 60, { mx: 0, my: 0, ax: g.p.x + 3, ay: g.p.y, fire: true });
  for (let i = 0; i < 60; i++) R.step(g, 1 / 60, {});
  ok(g.plants.size === 1, 'missed seed grows into a plant');
  const pl = [...g.plants.values()][0];
  ok(Math.abs(pl.x - Math.floor(g.p.x + 3) - 0.5) < 1e-9, 'the plant grows where the seed was aimed');
}
// walls bend the bugs' path: a cell behind a thornwall row gets further from the greenhouse
{
  const g = R.create(2);
  const at = 2 * R.GW + 9, before = g.flow[at];
  for (let x = 4; x < 16; x++) g.plants.set(3 * R.GW + x, { type: 'wall', x: x + 0.5, y: 3.5, hp: 90, water: 1, grow: 1, cool: 0 });
  R.buildFlow(g);
  ok(g.flow[at] > before + 3, 'bugs walk around a thornwall');
}
// a bot plays every night
function bot(seed) {
  const g = R.create(seed);
  const ring = [];
  for (let a = 0; a < 12; a++) ring.push([R.CORE.x + Math.cos((a / 12) * Math.PI * 2) * 2.6, R.CORE.y + Math.sin((a / 12) * Math.PI * 2) * 2.6]);
  let t = 0, nights = 0;
  while (t < 60 * 60 * 6) {
    t++;
    let input = { mx: 0, my: 0, fire: false };
    const p = g.p, near = g.bugs.slice().sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    // walk a slow circle round the greenhouse to keep the ring watered
    const ang = Math.atan2(p.y - R.CORE.y, p.x - R.CORE.x) + 0.6, tx = R.CORE.x + Math.cos(ang) * 1.8, ty = R.CORE.y + Math.sin(ang) * 1.8;
    input.mx = tx - p.x; input.my = ty - p.y;
    const missing = ring.find(([x, y]) => R.canPlant(g, x, y) && Math.hypot(x - p.x, y - p.y) < R.REACH);
    if (near && Math.hypot(near.x - p.x, near.y - p.y) < 5) input = Object.assign(input, { ax: near.x, ay: near.y, fire: true });
    else if (missing && g.plants.size < 14) input = Object.assign(input, { ax: missing[0], ay: missing[1], fire: true });
    const ev = R.step(g, 1 / 60, input);
    if (ev.some((e) => e.type === 'dawn')) { nights++; const l = R.locked(g); if (l.length) R.unlock(g, l[0]); R.choose(g, 'spitter'); R.nextNight(g); }
    if (g.state === 'won' || g.state === 'lost') break;
  }
  return { state: g.state, night: g.night, kills: g.kills, grown: g.grown, greenhouse: Math.round(g.greenhouse) };
}
let wins = 0;
for (let s = 1; s <= 6; s++) {
  const r = bot(s * 977);
  console.log(`seed ${s}: ${r.state} on night ${r.night}, ${r.kills} bugs, ${r.grown} plants grown, greenhouse ${r.greenhouse}%`);
  ok(r.night >= 3, 'the bot survives a few nights');
  if (r.state === 'won') wins++;
}
ok(wins >= 1, 'a careful player can reach the last dawn');
if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('\nbullet-garden: rules hold');
