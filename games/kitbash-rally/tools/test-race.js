// Headless checks for Kitbash Rally's rules (js/rules.js), run with:
//   node games/kitbash-rally/tools/test-race.js
// Races every track with computer drivers and checks that the part effects
// still do what the garage promises.
const path = require('path');
const KR = require(path.join(__dirname, '..', 'js', 'rules.js'));
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL ' + msg); } else console.log('ok   ' + msg); };
const DT = 1 / 60;

function run(track, builds, maxSec, hook) {
  const race = KR.createRace({ track, builds, difficulty: 1 });
  let steps = 0;
  while (!race.over && steps < maxSec * 60) {
    const inputs = builds.map((_, i) => { const me = race.karts.find((k) => k.human === i); return KR.think(race, me, DT); });
    KR.stepRace(race, DT, inputs);
    if (hook) hook(race);
    race.events.length = 0;
    steps++;
  }
  return { race, secs: steps / 60 };
}

// 1. every track: the race ends, nobody goes NaN, the human finishes
for (let t = 0; t < KR.TRACKS.length; t++) {
  const { race, secs } = run(t, [KR.DEFAULT], 400);
  const me = race.karts.find((k) => k.human === 0);
  ok(race.over && me.done && race.karts.every((k) => Number.isFinite(k.z) && Number.isFinite(k.x)), `${KR.TRACKS[t].name}: race finishes (${secs.toFixed(0)}s, you ${me.place}/${race.karts.length})`);
}
// 2. no rocket pod, no boosts
{
  let maxBoosts = 0;
  run(0, [['wheels', 'wheels', 'engine', 'engine', 'spring', 'spoiler']], 120, (r) => { maxBoosts = Math.max(maxBoosts, r.karts.find((k) => k.human === 0).boosts); });
  ok(maxBoosts === 0, 'a kart without a rocket pod never holds a boost');
  let got = 0;
  run(0, [['wheels', 'wheels', 'engine', 'rocket', 'spring', 'engine']], 120, (r) => { got = Math.max(got, r.karts.find((k) => k.human === 0).boosts); });
  ok(got > 0, 'a kart with a rocket pod picks up boosts');
}
// 3. spring hops, no spring cannot
{
  const race = KR.createRace({ track: 0, builds: [['empty', 'empty', 'engine', 'engine', 'empty', 'empty']], difficulty: 1 });
  race.time = race.startT + 1;
  KR.stepRace(race, DT, [{ hop: true }]);
  ok(race.karts.find((k) => k.human === 0).hop === 0, 'no spring: hop does nothing');
  const r2 = KR.createRace({ track: 0, builds: [KR.DEFAULT], difficulty: 1 });
  r2.time = r2.startT + 1;
  KR.stepRace(r2, DT, [{ hop: true }]);
  ok(r2.karts.find((k) => k.human === 0).hop > 0, 'spring: hop lifts the kart');
}
// 4. armour shortens an oil spin
{
  const spin = (build) => {
    const r = KR.createRace({ track: 0, builds: [build], difficulty: 1 });
    r.time = r.startT + 1;
    const me = r.karts.find((k) => k.human === 0);
    me.z = 300; me.x = 0; me.speed = 15;
    r.oils.length = 0; r.oils.push({ z: 301, x: 0 });
    KR.stepRace(r, DT, [{ gas: 1 }]);
    return me.spin;
  };
  ok(spin(['plate', 'empty', 'engine', 'engine', 'empty', 'plate']) < spin(['empty', 'empty', 'engine', 'engine', 'empty', 'empty']), 'armour shrugs off oil faster');
}
// 5. a lopsided build pulls to its heavy side
{
  const drift = (build) => {
    const r = KR.createRace({ track: 0, builds: [build], difficulty: 1 });
    r.time = r.startT + 1;
    const me = r.karts.find((k) => k.human === 0);
    me.z = 10; me.x = 0; me.speed = 12;
    const saved = r.track.segs.map((s) => s.curve);
    for (const s of r.track.segs) s.curve = 0; // a dead straight road for this test
    for (let i = 0; i < 60; i++) KR.stepRace(r, DT, [{ gas: 1 }]);
    r.track.segs.forEach((s, i) => (s.curve = saved[i]));
    return me.x;
  };
  const right = drift(['empty', 'plate', 'engine', 'turbo', 'empty', 'plate']);
  ok(right > 0.05, 'heavy right side pulls right (' + right.toFixed(2) + ')');
}
// 6. the magnet drags pickups sideways
{
  const r = KR.createRace({ track: 1, builds: [['magnet', 'magnet', 'engine', 'engine', 'empty', 'empty']], difficulty: 1 });
  r.time = r.startT + 1;
  const me = r.karts.find((k) => k.human === 0);
  const it = r.items[0];
  me.z = it.z - 20; me.x = it.x + 0.9; me.speed = 0;
  const before = it.x;
  KR.stepRace(r, DT, [{}]);
  ok(Math.abs(it.x - me.x) < Math.abs(before - me.x), 'magnet pulls a pickup toward the kart');
}
console.log(fails ? fails + ' check(s) failed' : 'all checks passed');
process.exit(fails ? 1 : 0);
