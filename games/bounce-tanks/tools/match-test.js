// Headless check of the Bounce Tanks rules: runs whole computer-only matches
// through js/sim.js and checks that every one ends with a champion, that the
// score never passes the target, and that shells and tanks stay inside the maze.
//   node games/bounce-tanks/tools/match-test.js [matches]
const path = require('path');
const BT = require(path.join(__dirname, '..', 'js', 'core.js'));
global.BT = BT;
require(path.join(__dirname, '..', 'js', 'sim.js'));

const S = BT.Sim;
const matches = Number(process.argv[2]) || 40;
const DT = 1 / 60;
let fails = 0, rounds = 0, totalTime = 0, shots = 0, bounces = 0, own = 0;

for (let n = 0; n < matches; n++) {
  const players = 2 + (n % 3);
  const seats = Array.from({ length: players }, (_, i) => ({ team: i, bot: true }));
  const target = [3, 5, 7][n % 3];
  const m = S.create({ seats, target, seed: 1000 + n, skill: n % 3, timeLimit: 60 });
  let steps = 0;
  while (m.phase !== 'over' && steps < 60 * 60 * 40) {
    S.step(m, DT, []);
    m.events.length = 0;
    steps++;
    for (const t of m.tanks) {
      if (t.x < 0 || t.y < 0 || t.x > S.COLS || t.y > S.ROWS) { fails++; console.log('tank left the maze', n, t.x, t.y); break; }
    }
    for (const s of m.shells) {
      if (s.x < -0.2 || s.y < -0.2 || s.x > S.COLS + 0.2 || s.y > S.ROWS + 0.2) { fails++; console.log('shell escaped', n); s.life = 0; }
    }
  }
  if (m.phase !== 'over') { fails++; console.log('match ' + n + ' did not finish'); continue; }
  const best = Math.max.apply(null, m.score);
  if (best !== target || m.score[m.champ] !== target || m.score.filter((s) => s === target).length !== 1) {
    fails++; console.log('bad final score', n, m.score, target);
  }
  rounds += m.round; totalTime += steps * DT;
  for (const s of m.stats) { shots += s.shots; bounces += s.bounces; own += s.own; }
}
console.log(`${matches} matches, ${rounds} rounds, avg ${(totalTime / matches).toFixed(0)}s per match, ${shots} shots, ${bounces} bounces, ${own} own goals`);
if (fails) { console.log(fails + ' problem(s)'); process.exit(1); }
console.log('ok');
