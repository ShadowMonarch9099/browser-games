// Headless checks for Jungle Getaway's rules (node games/jungle-getaway/tools/test-rules.js).
// Runs the same js/rules.js the browser loads.
'use strict';
const path = require('path');
const R = require(path.join(__dirname, '..', 'js', 'rules.js'));

let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('FAIL ' + msg); } };
const DT = 1 / 60;

// 1. Same seed, same jungle.
{
  const a = R.create(42), b = R.create(42);
  for (let i = 0; i < 600; i++) { R.step(a, DT, {}); R.step(b, DT, {}); }
  check(JSON.stringify(a.things.map((t) => [t.type, t.x, t.lanes])) === JSON.stringify(b.things.map((t) => [t.type, t.x, t.lanes])), 'seeded runs differ');
}

// 2. Generated obstacles are well formed: a 3-lane mask covering 1-3 lanes,
//    coins in a real lane, and stored nearest first.
{
  let n = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const s = R.create(seed);
    s.d = 0;
    R.step(s, 0, {});
    for (let k = 0; k < 40; k++) { s.d += 2000; s.run.m = Math.floor(s.d / 10); R.step(s, 0, {}); }
    let lastX = -Infinity;
    for (const t of s.things) {
      n++;
      check(t.x >= lastX, 'things out of order');
      lastX = t.x;
      if (t.type === 'coin') check([-1, 0, 1].includes(t.lane), 'coin lane');
      else check(Array.isArray(t.lanes) && t.lanes.length === 3 && t.lanes.some(Boolean), 'obstacle mask');
    }
  }
  check(n > 500, 'generated enough things to inspect (' + n + ')');
}

// 3. Standing still in a lane: the first log or branch in that lane stumbles you.
{
  const s = R.create(3);
  s.things = [{ type: 'log', x: 800, lanes: [true, true, true], done: false }];
  s.nextX = 1e9;
  let stumbled = false;
  for (let i = 0; i < 300 && !stumbled; i++) { const ev = R.step(s, DT, {}); if (ev.includes('stumble')) stumbled = true; }
  check(stumbled, 'running into a log should stumble');
  check(s.stumbles === 1, 'one stumble counted');
}

// 4. Jumping clears a log; sliding clears a branch.
{
  const s = R.create(4);
  s.things = [{ type: 'log', x: 600, lanes: [true, true, true], done: false }, { type: 'branch', x: 1400, lanes: [true, true, true], done: false }];
  s.nextX = 1e9;
  let bad = false;
  for (let i = 0; i < 400; i++) {
    const inp = {};
    const log = s.things.find((t) => t.type === 'log');
    const br = s.things.find((t) => t.type === 'branch');
    if (log && log.x - s.d < s.speed * 0.16 && log.x - s.d > 0 && s.p.h <= 0) inp.jump = true;
    if (br && br.x - s.d < s.speed * 0.24 && br.x + 130 - s.d > 0) inp.slideHeld = true;
    const ev = R.step(s, DT, inp);
    if (ev.includes('stumble')) bad = true;
  }
  check(!bad, 'jump over log + slide under branch should be clean');
  check(s.run.logs === 1 && s.run.slides === 1, `counted log ${s.run.logs} slide ${s.run.slides}`);
}

// 5. A different lane dodges a partial obstacle.
{
  const s = R.create(5);
  s.things = [{ type: 'log', x: 700, lanes: [false, true, false], done: false }];
  s.nextX = 1e9;
  R.step(s, DT, { left: true });
  let bad = false;
  for (let i = 0; i < 200; i++) if (R.step(s, DT, {}).includes('stumble')) bad = true;
  check(!bad, 'changing lane should dodge a one-lane log');
}

// 6. Two stumbles and the boulder catches you; ten calm seconds forgive one.
{
  const s = R.create(6);
  s.things = [{ type: 'log', x: 600, lanes: [true, true, true], done: false }, { type: 'log', x: 1500, lanes: [true, true, true], done: false }];
  s.nextX = 1e9;
  for (let i = 0; i < 600 && s.state === 'playing'; i++) R.step(s, DT, {});
  check(s.state === 'over' && !s.p.fell, 'two stumbles end the run');
  const t = R.create(8);
  t.things = [{ type: 'log', x: 600, lanes: [true, true, true], done: false }];
  t.nextX = 1e9;
  for (let i = 0; i < 60 * 13; i++) R.step(t, DT, {});
  check(t.stumbles === 0 && t.state === 'playing', 'ten clean seconds reset the stumble');
}

// 7. Pits swallow you if you do not jump.
{
  const s = R.create(9);
  s.things = [{ type: 'pit', x: 600, lanes: [true, true, true], done: false }];
  s.nextX = 1e9;
  for (let i = 0; i < 300 && s.state === 'playing'; i++) R.step(s, DT, {});
  check(s.state === 'over' && s.p.fell, 'walking into a pit ends the run');
}

// 8. The autopilot survives a long way on most seeds (the course is fair).
{
  let total = 0, far = 0;
  const N = 60;
  for (let seed = 1; seed <= N; seed++) {
    const s = R.create(seed * 7919);
    for (let i = 0; i < 60 * 120 && s.state === 'playing'; i++) R.step(s, DT, R.autopilot(s));
    total += s.run.m;
    if (s.run.m >= 1000) far++;
  }
  console.log(`autopilot: average ${Math.round(total / N)} m, ${far}/${N} runs past 1000 m`);
  check(far >= N * 0.6, 'the perfect autopilot should get past 1000 m on most seeds');
}

// 9. Missions advance one at a time and unlock hats every third.
{
  let saved = { best: 0, bank: 0, mission: 0 };
  const run = { m: 2000, coins: 50, slides: 20, logs: 20, cleanM: 1000 };
  for (let i = 0; i < 10; i++) { const r = R.finish(run, saved); check(r.mission === i + 1, 'mission advance ' + i); check(r.hat === ((i + 1) % 3 === 0), 'hat flag ' + i); saved = r; }
  check(R.finish(run, saved).mission === 10, 'missions cap at 10');
  check(R.hatsUnlocked(0) === 1 && R.hatsUnlocked(3) === 2 && R.hatsUnlocked(9) === 4 && R.hatsUnlocked(10) === 4, 'hat unlock counts');
  check(saved.bank === 500, 'coins bank across runs');
}

if (fails) { console.log(fails + ' check(s) failed'); process.exit(1); }
console.log('jungle-getaway rules: all checks passed');
