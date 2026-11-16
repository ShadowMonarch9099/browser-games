// Headless checks for Sky Stack's rules.
//   node games/sky-stack/tools/test-rules.js
// The reworked Tower is compared, drop by drop, with a copy of the original
// game's logic (from the shared-kit version), so the rules stay unchanged.
const path = require('path');
const SS = require(path.join(__dirname, '..', 'js', 'core.js'));
require(path.join(__dirname, '..', 'js', 'rules.js'));
const { BLOCK_H, RANGE, PERFECT, STAGE_LEN } = SS.Rules;

let checks = 0;
function ok(c, msg) { checks++; if (!c) { console.error('FAIL: ' + msg); process.exit(1); } }

// ---- the original logic, trimmed to the rules ----
function Original(seed) {
  const rand = SS.rng(seed);
  const o = { rand, hue0: rand.int(0, 359), stack: [{ x: 0, z: 0, w: 1, d: 1 }], streak: 0, over: false };
  const height = () => o.stack.length - 1;
  const stage = () => Math.min(3, Math.floor(height() / STAGE_LEN));
  const windy = () => stage() === 1 || stage() === 3;
  o.nextMover = () => {
    const top = o.stack[o.stack.length - 1], axis = o.stack.length % 2 ? 'x' : 'z', side = rand() < 0.5 ? -1 : 1;
    o.mover = { x: top.x, z: top.z, w: top.w, d: top.d, axis, dir: -side, t: 0, vel: 0, speed: Math.min(1.5 + o.stack.length * 0.022, 3.4), gust: 2.5 + rand() * 1.5, phase: rand() * 6.28 };
    o.mover[axis] = top[axis] + side * RANGE;
  };
  o.step = (dt) => {
    const top = o.stack[o.stack.length - 1], m = o.mover, a = m.axis;
    m.t += dt;
    const gust = windy() ? 1 + 0.55 * Math.sin(m.t * m.gust + m.phase) : 1;
    m.vel = m.dir * m.speed * gust; m[a] += m.vel * dt;
    if (m[a] > top[a] + RANGE) { m[a] = top[a] + RANGE; m.dir = -1; }
    if (m[a] < top[a] - RANGE) { m[a] = top[a] - RANGE; m.dir = 1; }
  };
  o.drop = () => {
    const top = o.stack[o.stack.length - 1], m = o.mover, a = m.axis, s = a === 'x' ? 'w' : 'd';
    const delta = m[a] - top[a], overlap = top[s] - Math.abs(delta);
    if (overlap <= 0) { o.over = true; return; }
    const placed = { x: top.x, z: top.z, w: top.w, d: top.d };
    if (Math.abs(delta) <= PERFECT) { o.streak++; if (o.streak >= 3) placed[s] = Math.min(1, placed[s] + 0.05); }
    else { o.streak = 0; placed[s] = overlap; placed[a] = top[a] + delta / 2; }
    o.stack.push(placed); o.nextMover();
  };
  o.nextMover();
  return o;
}

// 1. the daily seed matches the old kit: hash(today + 'sky-stack')
ok(SS.dailySeed('2026-11-14') === SS.hash('2026-11-14sky-stack'), 'daily seed formula');

// 2. identical towers from identical inputs, across many random players
for (let trial = 0; trial < 60; trial++) {
  const seed = SS.hash('t' + trial), a = new SS.Tower(seed), b = Original(seed);
  ok(a.hue0 === b.hue0, 'same colour seed');
  const r = SS.rng(trial + 1);
  let frames = 0;
  while (!a.over && frames < 60 * 600) {
    const wait = 10 + Math.floor(r() * 90);
    for (let i = 0; i < wait; i++) { a.step(1 / 60); b.step(1 / 60); frames++; }
    ok(Math.abs(a.mover[a.mover.axis] - b.mover[b.mover.axis]) < 1e-9, 'mover positions agree');
    const res = a.drop(); b.drop();
    ok(!!res, 'drop returns a result');
    ok(a.over === b.over, 'game over agrees');
    if (a.over) break;
    const ta = a.top(), tb = b.stack[b.stack.length - 1];
    ok(Math.abs(ta.x - tb.x) + Math.abs(ta.z - tb.z) + Math.abs(ta.w - tb.w) + Math.abs(ta.d - tb.d) < 1e-9, 'placed blocks agree');
    ok(a.streak === b.streak, 'streaks agree');
  }
}

// 3. slicing conserves width; perfect streaks grow it back
{
  const t = new SS.Tower(5);
  const m = t.mover, top = t.top();
  m[m.axis] = top[m.axis] + 0.3;
  const res = t.drop();
  ok(res.type === 'cut', 'offset drop is a cut');
  const s = res.axis === 'x' ? 'w' : 'd';
  ok(Math.abs(res.placed[s] + res.piece[s] - 1) < 1e-9, 'placed + sliced = old width');
  ok(Math.abs(res.placed[s] - 0.7) < 1e-9, 'placed width is the overlap');
  for (let i = 0; i < 4; i++) { const mm = t.mover; mm[mm.axis] = t.top()[mm.axis]; const r2 = t.drop(); ok(r2.type === 'perfect', 'aligned drop is perfect'); }
  ok(t.streak === 4 && t.perfects === 4, 'streak counted');
  const grown = t.top();
  ok(grown.w > 0.7 || grown.d > 0.7, 'third perfect onwards grows the block back');
  const mm = t.mover; mm[mm.axis] = t.top()[mm.axis] + 2;
  ok(t.drop().type === 'miss' && t.over, 'a block that misses ends the run');
}

// 4. weather stages every 25 floors
{
  const t = new SS.Tower(9);
  const stages = [];
  for (let i = 0; i < 100; i++) { const m = t.mover; m[m.axis] = t.top()[m.axis]; const r = t.drop(); if (r.stageUp > 0) stages.push([t.height(), r.stageUp]); }
  ok(JSON.stringify(stages) === JSON.stringify([[25, 1], [50, 2], [75, 3]]), 'stages change at 25, 50, 75: ' + JSON.stringify(stages));
  ok(t.windy() && t.foggy(), 'the storm is windy and foggy');
  ok(t.top().w === 1 && t.top().d === 1, 'all-perfect tower keeps full size');
}

// 5. the block always stays within range of the tower while sliding
{
  const t = new SS.Tower(3);
  for (let i = 0; i < 3000; i++) { t.step(1 / 60); const m = t.mover; ok(Math.abs(m[m.axis] - t.top()[m.axis]) <= RANGE + 1e-9, 'mover in range'); }
}
console.log(`sky-stack: ${checks} checks passed (BLOCK_H ${BLOCK_H})`);
