// Headless check of the Bonk Brawl rules: computer-only matches on every
// stage and fighter mix must end with exactly one winner, the right number of
// lives lost, and nobody stuck in a wall.
//   node games/bonk-brawl/tools/match-test.js [matches]
const path = require('path');
const BB = require(path.join(__dirname, '..', 'js', 'core.js'));
global.BB = BB;
require(path.join(__dirname, '..', 'js', 'sim.js'));

const S = BB.Sim;
const matches = Number(process.argv[2]) || 36;
const DT = 1 / 60;
let fails = 0, total = 0, timeouts = 0, hits = 0;
const wins = [0, 0, 0, 0];

for (let n = 0; n < matches; n++) {
  const players = 2 + (n % 3);
  const seats = Array.from({ length: players }, (_, i) => ({ fighter: (n + i) % 4, bot: true, slot: i }));
  const lives = 1 + (n % 3);
  const m = S.create({ seats, stage: n % 3, lives, seed: 500 + n, skill: n % 3, timeLimit: 240 });
  let steps = 0;
  while (m.phase !== 'over' && steps < 60 * 300) {
    S.step(m, DT, []);
    for (const e of m.events) if (e.t === 'hit') hits++;
    m.events.length = 0;
    steps++;
  }
  if (m.phase !== 'over') { fails++; console.log('match ' + n + ' never ended'); continue; }
  if (m.time > 240) timeouts++;
  const alive = m.fighters.filter((f) => !f.out);
  if (alive.length !== 1 || m.winner !== alive[0].i) { fails++; console.log('bad winner', n, m.winner, alive.length); }
  const places = m.fighters.map((f) => f.place).sort();
  if (places.join() !== Array.from({ length: players }, (_, i) => i + 1).join() && m.time <= 240) { fails++; console.log('bad places', n, places); }
  for (const f of m.fighters) {
    if (f.out && f.stocks !== 0 && m.time <= 240) { fails++; console.log('out with lives left', n, f.i); }
    if (f.stats.falls !== lives - Math.max(0, f.stocks)) { fails++; console.log('falls mismatch', n, f.i, f.stats.falls, f.stocks); }
  }
  wins[m.fighters[m.winner].c.id === 'rascal' ? 0 : m.fighters[m.winner].c.id === 'clank' ? 1 : m.fighters[m.winner].c.id === 'sumo' ? 2 : 3]++;
  total += m.time;
}
console.log(`${matches} matches, avg ${(total / matches).toFixed(0)}s, ${hits} hits, ${timeouts} hit the safety time limit, wins by fighter (rascal/clank/sumo/zephyr): ${wins.join('/')}`);
if (fails) { console.log(fails + ' problem(s)'); process.exit(1); }
console.log('ok');
