// Headless checks for Courier Sprint's rules: node games/courier-sprint/tools/test-rules.js
'use strict';
const path = require('path');
const R = require(path.join(__dirname, '..', 'js', 'rules.js'));
const DT = 1 / 60;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('FAIL ' + msg); } };

function lone(type, lane, z) {
  const s = R.create(1);
  s.things = [{ type, lane: lane || 0, z: z || 20 }];
  s.nextZ = 1e9;
  return s;
}
function runTo(s, z, inpFn) {
  let ev = [];
  for (let i = 0; i < 2000 && s.dist < z && s.state === 'playing'; i++) ev = ev.concat(R.step(s, DT, inpFn ? inpFn(s) : {}));
  return ev;
}

// same seed, same street
{
  const a = R.create(99), b = R.create(99);
  for (let i = 0; i < 900; i++) { R.step(a, DT, {}); R.step(b, DT, {}); }
  check(JSON.stringify(a.things) === JSON.stringify(b.things), 'seeded streets differ');
}
// every generated row leaves at least one lane without an obstacle
{
  for (let seed = 1; seed <= 200; seed++) {
    const s = R.create(seed);
    s.dist = seed * 37;
    R.step(s, 0, {});
    const rows = {};
    for (const t of s.things) if (['barrier', 'sign', 'van'].includes(t.type)) (rows[t.z] = rows[t.z] || new Set()).add(t.lane);
    for (const z in rows) check(rows[z].size <= 2, 'row fully blocked at seed ' + seed);
  }
}
// barrier: running in crashes, jumping clears
{
  const s = lone('barrier'); runTo(s, 25);
  check(s.state === 'over' && s.crashedBy === 'barrier', 'barrier should crash you');
  const j = lone('barrier');
  runTo(j, 25, (q) => ({ up: q.things[0] && q.things[0].z - q.dist < 3.5 && q.p.y === 0 }));
  check(j.state === 'playing', 'jumping should clear a barrier');
}
// sign: rolling under clears; jumping does not
{
  const s = lone('sign');
  runTo(s, 25, (q) => ({ down: q.things[0] && q.things[0].z - q.dist < 4 && q.p.roll <= 0 }));
  check(s.state === 'playing', 'rolling should clear a sign');
  const j = lone('sign');
  runTo(j, 25, (q) => ({ up: q.things[0] && q.things[0].z - q.dist < 3.5 }));
  check(j.state === 'over', 'jumping into a sign should crash');
}
// van: only a lane change (or a power-up) saves you
{
  const s = lone('van');
  runTo(s, 25, (q) => ({ up: q.things[0] && q.things[0].z - q.dist < 3.5 }));
  check(s.state === 'over' && s.crashedBy === 'van', 'a van cannot be jumped');
  const d = lone('van'); R.step(d, DT, { right: true }); runTo(d, 25);
  check(d.state === 'playing', 'changing lane dodges a van');
}
// scooter absorbs one crash; drone flies over; magnet pulls parcels from other lanes
{
  const s = lone('van'); s.power.scooter = true; const ev = runTo(s, 25);
  check(s.state === 'playing' && !s.power.scooter && ev.includes('scooterSave'), 'scooter should take one hit');
  const d = lone('van'); d.power.drone = 5; runTo(d, 25);
  check(d.state === 'playing', 'drone flies over vans');
  const m = R.create(2); m.nextZ = 1e9; m.power.magnet = 8;
  m.things = [{ type: 'parcel', lane: 1, z: 10 }, { type: 'parcel', lane: -1, z: 12 }];
  runTo(m, 20);
  check(m.parcels === 2, 'magnet pulls parcels from other lanes');
  check(R.score(m) === Math.floor(m.dist) + 20, 'score is distance + 10 per parcel');
}
// the demo driver gets a fair way
{
  let total = 0;
  const N = 40;
  for (let seed = 1; seed <= N; seed++) {
    const s = R.create(seed * 104729);
    for (let i = 0; i < 60 * 90 && s.state === 'playing'; i++) R.step(s, DT, R.autopilot(s));
    total += s.dist;
  }
  console.log('autopilot average ' + Math.round(total / N) + ' m');
  check(total / N > 400, 'autopilot should average over 400 m');
}

if (fails) { console.log(fails + ' check(s) failed'); process.exit(1); }
console.log('courier-sprint rules: all checks passed');
