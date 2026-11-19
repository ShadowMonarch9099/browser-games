// Headless checks for Beat Sprint's composer and judge.
//   node games/beat-sprint/tools/test-song.js
// Exits non-zero on the first failure.
const path = require('path');
const js = (f) => path.join(__dirname, '..', 'js', f);
const BS = require(js('core.js'));
require(js('classics.js'));
require(js('song.js'));
require(js('analyze.js'));
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

// 7. the classics: every bar adds up, every chart is fair, and a perfect run clears it
let classicPads = 0;
for (const def of BS.Classics.LIST) {
  let parts;
  try { parts = BS.Classics.bars(def); } catch (e) { ok(false, e.message); }
  for (const [part] of def.form) ok(parts[part], `${def.title}: form uses part ${part}`);
  for (let lv = 0; lv < LEVELS.length; lv++) {
    const song = BS.Song.composeClassic(def, lv), ch = song.chart;
    ok(song.end > 55 && song.end < 130, `${def.title}: ${Math.round(song.end)} s long`);
    ok(ch.length >= 60, `${def.title} level ${lv}: ${ch.length} pads`);
    const leads = new Set(song.events.filter((e) => e.k === 'lead').map((e) => e.t.toFixed(6) + ':' + e.n));
    for (let i = 1; i < song.events.length; i++) ok(song.events[i].t >= song.events[i - 1].t, 'events in time order');
    for (let i = 0; i < ch.length; i++) {
      const n = ch[i], sec = song.sections[n.sec];
      ok(n.lane >= 0 && n.lane <= 2 && (n.kind === 'tap' || n.kind === 'wide'), 'pad well formed');
      ok(n.t >= song.t0 + 2 * song.bar - 1e-6, `${def.title}: no pads in the count-in`);
      ok(leads.has(n.t.toFixed(6) + ':' + n.n), `${def.title}: every pad is a melody note`);
      if (i) ok(n.t - ch[i - 1].t >= LEVELS[lv].gap * sec.beat - 1e-5, `${def.title}: pads respect the level gap`);
      ok(n.n >= 48 && n.n <= 96, `${def.title}: melody note ${n.n} in a playable range`);
    }
    ok([0, 1, 2].every((l) => ch.some((n) => n.lane === l)), `${def.title}: all three lanes used`);
    const run = new BS.Run(song);
    for (const n of ch) { run.press(n.lane, n.t); run.tick(n.t); }
    run.tick(song.end + 1);
    ok(run.done && !run.failed && run.grade() === 'S', `${def.title}: a perfect run clears with an S`);
    classicPads += ch.length;
  }
}

// 8. the originals: fixed seeds, one per style and then round again
const orig = BS.Song.originalList();
ok(orig.length >= 24 && new Set(orig.map((o) => o.seed)).size === orig.length, 'originals have distinct seeds');
ok(BS.Song.STYLES.every((st) => orig.some((o) => o.style === st)), 'every style has an original');
for (const o of orig) { const st = BS.Song.make({ kind: 'original', id: o.id }, 1).style; ok(st.genre === o.style.name && st.name === o.title && st.bpm === o.style.bpm, `${o.title} plays in ${o.style.name}`); }

// 9. the ear: on a synthetic drum track it finds the tempo and the beat, and its chart is fair
{
  const sr = 22050, len = 60;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (const bpm of [96, 123, 142]) {
    const x = new Float32Array(sr * len), off = 0.37, beat = 60 / bpm;
    let prev = 0;
    for (let b = 0; off + b * beat < len - 1; b++) {
      const i0 = Math.round((off + b * beat) * sr);
      for (let i = 0; i < sr * 0.18 && i0 + i < x.length; i++) { const tt = i / sr; x[i0 + i] += 0.9 * Math.sin(2 * Math.PI * (55 + 80 * Math.exp(-tt * 30)) * tt) * Math.exp(-tt * 14); }
      if (b % 2) for (let i = 0; i < sr * 0.15 && i0 + i < x.length; i++) { const tt = i / sr; x[i0 + i] += (0.35 * rnd() + 0.3 * Math.sin(2 * Math.PI * 330 * tt)) * Math.exp(-tt * 22); }
      const h0 = Math.round((off + (b + 0.5) * beat) * sr);
      for (let i = 0; i < sr * 0.04 && h0 + i < x.length; i++) { const n = rnd(); x[h0 + i] += 0.35 * (n - prev) * Math.exp(-(i / sr) * 90); prev = n; }
    }
    const an = BS.Analyze.analyze(x, sr);
    ok(Math.abs(an.bpm - bpm) < 0.4, `ear finds ${bpm} BPM (got ${an.bpm.toFixed(2)})`);
    const ph = ((an.phase - off) % beat + beat) % beat, err = Math.min(ph, beat - ph);
    ok(err < 0.03, `ear finds the beat within 30 ms (off by ${(err * 1000).toFixed(1)} ms)`);
    for (let lv = 0; lv < LEVELS.length; lv++) {
      const song = BS.Analyze.chart(an, lv, { id: 'synth', title: 'Synth', by: 'test', lead: 2 }), ch = song.chart;
      ok(ch.length >= 30, `ear chart at ${bpm} BPM level ${lv} has ${ch.length} pads`);
      for (let i = 1; i < ch.length; i++) ok(ch[i].t - ch[i - 1].t >= Math.max(LEVELS[lv].gap * song.beat, [0.55, 0.36, 0.2][lv]) - 1e-5, 'ear chart respects the gap');
      ok(ch.every((n) => n.t >= song.t0 + 2 * song.bar - 1e-6 && n.t < song.end), 'ear chart stays inside the song after the count-in');
      ok([0, 1, 2].every((l) => ch.some((n) => n.lane === l)), 'ear chart uses all three lanes');
      const run = new BS.Run(song);
      for (const n of ch) { run.press(n.lane, n.t); run.tick(n.t); }
      run.tick(song.end + 1);
      ok(run.done && !run.failed, 'a perfect run clears an ear chart');
    }
  }
}

console.log(`beat-sprint: ${checks} checks passed (${totalNotes} pads across ${150 * LEVELS.length} random charts, ${classicPads} across ${BS.Classics.LIST.length * LEVELS.length} classic charts)`);
