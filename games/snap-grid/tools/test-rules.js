// Checks Snap Grid's rules in Node: a daily board deals the same shapes every
// time, every deal offers a shape that fits while the board has room, line
// clears and scores add up, and the autopilot's suggestions are always legal.
// Run: node games/snap-grid/tools/test-rules.js
const path = require('path');
const R = require(path.join(__dirname, '..', 'js', 'rules.js'));

let fails = 0;
const fail = (msg) => { fails++; console.log(msg); };

function play(rand, limit = 400) {
  const g = R.create(rand);
  const log = [];
  let n = 0;
  while (!g.over && n < limit) {
    const s = R.suggest(g);
    if (!s) { fail('suggest found nothing although the run is not over'); break; }
    const before = g.score;
    const ev = R.place(g, s.i, s.x, s.y);
    if (!ev) { fail(`suggested move was illegal at move ${n}`); break; }
    const lines = ev.rows.length + ev.cols.length;
    if (g.score - before !== ev.placePoints + ev.points) fail('score did not add up');
    if (lines && ev.cleared.length < lines * R.N - (lines - 1) * lines) fail('too few cells cleared');
    for (const r of ev.rows) if (g.grid[r].some(Boolean)) fail('a cleared row still has blocks');
    if (ev.dealt && !g.over && !g.tray.some((p) => R.anyFit(g.grid, p))) fail('a deal left nothing that fits');
    log.push(`${s.i}:${s.x},${s.y}:${g.score}`);
    n++;
  }
  return { g, log: log.join(' ') };
}

for (const date of ['2026-11-13', '2026-12-25', '2027-06-01']) {
  const a = play(R.dailyRng(date));
  const b = play(R.dailyRng(date));
  if (a.log !== b.log) fail(`daily ${date} is not repeatable`);
  if (!a.g.over) fail(`daily ${date}: autopilot never finished`);
}
for (let k = 0; k < 20; k++) play(R.freshRng());
if (R.SHAPES.length < 20) fail('shape list looks wrong');

console.log(fails ? `${fails} problem(s)` : 'Snap Grid rules OK');
process.exit(fails ? 1 : 0);
