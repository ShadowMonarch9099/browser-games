// Headless check of the Misfit Squad rules: squads of computer heroes play
// whole runs. Every run must end (all 15 waves cleared, or the squad down),
// waves must count up one at a time with a boss on 5, 10 and 15, and the
// upgrade pick must offer three different upgrades.
//   node games/misfit-squad/tools/run-test.js [runs]
const path = require('path');
const MS = require(path.join(__dirname, '..', 'js', 'core.js'));
global.MS = MS;
require(path.join(__dirname, '..', 'js', 'sim.js'));

const S = MS.Sim;
const runs = Number(process.argv[2]) || 16;
const DT = 1 / 60;
let fails = 0, wins = 0, waveSum = 0;
for (let n = 0; n < runs; n++) {
  const size = 1 + (n % 4);
  const seats = Array.from({ length: size }, (_, i) => ({ hero: (n + i) % 4, bot: true, slot: i }));
  const m = S.create({ seats, seed: 77 + n });
  let steps = 0, lastWave = 0, bosses = 0;
  while (m.phase !== 'won' && m.phase !== 'lost' && steps < 60 * 60 * 40) {
    S.step(m, DT, []);
    for (const e of m.events) {
      if (e.t === 'wave') { if (e.n !== lastWave + 1) { fails++; console.log('wave skipped', n, e.n); } lastWave = e.n; if (e.boss !== (e.n % 5 === 0)) { fails++; console.log('boss flag wrong', e.n); } }
      if (e.t === 'boss') bosses++;
    }
    m.events.length = 0;
    if (m.phase === 'pick') {
      if (!m.picks || new Set(m.picks).size !== 3) { fails++; console.log('bad picks', n, m.picks); }
      S.choose(m, Math.floor(m.rand() * 3));
    }
    for (const h of m.heroes) if (h.x < 0.4 || h.x > 15.6 || h.y < 0.4 || h.y > 8.6) { fails++; console.log('hero left the room', n); break; }
    steps++;
  }
  if (m.phase !== 'won' && m.phase !== 'lost') { fails++; console.log('run ' + n + ' never ended'); continue; }
  if (bosses !== Math.floor(m.wave / 5) && m.phase === 'won') { fails++; console.log('boss count', n, bosses); }
  if (m.phase === 'won') wins++;
  waveSum += m.wave;
  console.log(`run ${n}: ${size} heroes, ${m.phase} on wave ${m.wave}, ${m.kills} robots scrapped, ${Math.round(m.time)}s`);
}
console.log(`${runs} runs, ${wins} cleared all 15 waves, average wave ${(waveSum / runs).toFixed(1)}`);
if (fails) { console.log(fails + ' problem(s)'); process.exit(1); }
console.log('ok');
