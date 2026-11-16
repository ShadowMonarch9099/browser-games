// Headless checks for Beat Sprint's composer and judge.
//   node games/beat-sprint/tools/test-song.js
// Exits non-zero on the first failure.
const path = require('path');
const js = (f) => path.join(__dirname, '..', 'js', f);
const BS = require(js('core.js'));
require(js('song.js'));
require(js('rules.js'));

let checks = 0;
function ok(cond, msg) {
  checks++;
  if (!cond) { console.error('FAIL: ' + msg); process.exit(1); }
}

const { compose, LEVELS, STYLES, sectionAt } = BS.Song;
const { WINDOW, PERFECT } = BS.Rules;

// 1. same seed, same track
const a = JSON.stringify(compose(123456, 1)), b = JSON.stringify(compose(123456, 1));
ok(a === b, 'compose is deterministic');
ok(JSON.stringify(compose(123457, 1)) !== a, 'different seeds give different tracks');

// 2. the daily seed keeps the original salt
ok(BS.dailySeed() === BS.hash('beat-sprint:' + BS.today()), 'daily seed formula unchanged');

// 3. charts are well formed for many seeds and every level
let totalNotes = 0;
for (let s = 0; s < 150; s++) {
  const seed = BS.hash('seed' + s);
  for (let lv = 0; lv < LEVELS.length; lv++) {
    const song = compose(seed, lv);
    const ch = song.chart;
    ok(song.style === STYLES[seed % STYLES.length], 'style follows seed');
    ok(ch.length >= 30, `seed ${seed} level ${lv}: chart has ${ch.length} pads`);
    const gap = LEVELS[lv].gap * song.beat - 1e-5;
    const leads = new Set(song.events.filter((e) => e.k === 'lead').map((e) => e.t.toFixed(6) + ':' + e.n));
    for (let i = 0; i < ch.length; i++) {
      const n = ch[i];
      ok(n.lane >= 0 && n.lane <= 2, 'lane in range');
      ok(n.kind === 'tap' || n.kind === 'wide', 'kind known');
      ok(n.t >= song.t0 + 2 * song.bar - 1e-6, 'no pads in the two count-in bars');
      ok(n.t < song.end, 'pad before the end');
      ok(leads.has(n.t.toFixed(6) + ':' + n.n), 'every pad is a lead note of the song');
      if (i) ok(n.t - ch[i - 1].t >= gap, `pads respect the level gap (${(n.t - ch[i - 1].t).toFixed(3)} < ${gap.toFixed(3)})`);
    }
    const lanes = [0, 0, 0];
    for (const n of ch) lanes[n.lane]++;
    ok(lanes.every((c) => c > 0), 'all three lanes are used');
    for (const sec of song.sections) ok(sec.pal >= 0 && sec.pal <= 5, 'section palette in range');
    ok(sectionAt(song, song.t0 + 0.01) === song.sections[0], 'sectionAt finds the first section');
    totalNotes += ch.length;
  }
}

// 4. a perfect run
{
  const song = compose(777, 1), run = new BS.Run(song);
  for (const n of song.chart) { const r = run.press(n.lane, n.t); ok(r.type === 'hit' && r.grade === 'perfect', 'exact press is perfect'); run.tick(n.t); }
  run.tick(song.end + 1);
  ok(!run.failed && run.done, 'perfect run completes');
  ok(run.perfect === song.chart.length && run.miss === 0, 'all perfects');
  ok(run.grade() === 'S', 'perfect run grades S');
  ok(run.mult() === 8, 'multiplier caps at x8');
}

// 5. doing nothing fails after missRow misses
for (let lv = 0; lv < LEVELS.length; lv++) {
  const song = compose(4242, lv), run = new BS.Run(song);
  for (let t = 0; t < song.end && !run.failed; t += 1 / 60) run.tick(t);
  ok(run.failed, 'idle run fails');
  ok(run.miss === LEVELS[lv].missRow, `fails after exactly ${LEVELS[lv].missRow} misses (got ${run.miss})`);
  ok(run.grade() === 'F', 'failed run grades F');
}

// 6. wrong lane, late, early and stray presses
{
  const song = compose(99, 1), run = new BS.Run(song);
  const n0 = song.chart.find((n) => n.kind === 'tap');
  const wrong = (n0.lane + 1) % 3;
  let r = run.press(wrong, n0.t);
  ok(r.type === 'miss' && run.missRow === 1, 'wrong lane is a miss');
  const run2 = new BS.Run(song);
  r = run2.press(n0.lane, n0.t - (PERFECT + WINDOW) / 2);
  ok(r.type === 'hit' && r.grade === 'good' && r.err < 0, 'early press inside the window is good');
  const run3 = new BS.Run(song);
  r = run3.press(n0.lane, n0.t - 1.0);
  ok(r.type === 'stray' && run3.missRow === 0, 'stray press costs nothing');
  r = run3.press(n0.lane, n0.t + WINDOW * 0.99);
  ok(r.type === 'hit', 'late press inside the window hits');
  const wide = song.chart.find((n) => n.kind === 'wide');
  if (wide) {
    const run4 = new BS.Run(song);
    // judge every pad before the wide one so the window is clean
    for (const n of song.chart) { if (n === wide) break; run4.press(n.lane, n.t); }
    r = run4.press((wide.lane + 2) % 3, wide.t);
    ok(r.type === 'hit', 'a wide bar takes any lane');
  }
}

console.log(`beat-sprint: ${checks} checks passed (${totalNotes} pads across ${150 * LEVELS.length} charts)`);
