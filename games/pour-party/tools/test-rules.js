// Checks Pour Party's rules and level maker in Node: every level from 1 to
// 150 must come out the same twice, have no finished glass at the start, be
// solvable from its start (with mystery layers treated as known), and the
// solver's own solution must play out legally to a sorted counter.
// Run: node games/pour-party/tools/test-rules.js
const path = require('path');
const R = require(path.join(__dirname, '..', 'js', 'rules.js'));

let fails = 0;
const fail = (lv, msg) => { fails++; console.log(`level ${lv}: ${msg}`); };

for (let lv = 1; lv <= 150; lv++) {
  const a = R.makeLevel(lv);
  const b = R.makeLevel(lv);
  if (JSON.stringify(a) !== JSON.stringify(b)) fail(lv, 'not repeatable');
  if (a.some(R.complete)) fail(lv, 'starts with a finished glass');
  const colours = R.coloursFor(lv);
  if (a.length !== colours + 2) fail(lv, `expected ${colours + 2} glasses, got ${a.length}`);
  const hidden = a.some((t) => t.some((u) => u.hidden));
  if ((lv >= R.HIDDEN_FROM) !== hidden) fail(lv, 'mystery layers in the wrong levels');
  const sol = R.solve(a);
  if (!sol) { fail(lv, 'no solution found'); continue; }
  const ts = R.copy(a);
  // The solver ignores mystery layers; replay it on an all-visible copy.
  ts.forEach((t) => t.forEach((u) => { u.hidden = false; }));
  for (const [i, j] of sol) if (!R.pour(ts, i, j)) { fail(lv, `illegal move ${i}->${j}`); break; }
  if (!R.solved(ts)) fail(lv, 'solution does not sort the counter');
  const par = R.par(a, lv);
  if (!(par > 0 && par <= sol.length)) fail(lv, `bad par ${par}`);
}
if (R.stars(10, 10, 0) !== 3 || R.stars(10, 10, 1) !== 2 || R.stars(30, 10, 0) !== 1) fails++, console.log('stars rule wrong');

console.log(fails ? `${fails} problem(s)` : 'Pour Party rules: levels 1-150 OK');
process.exit(fails ? 1 : 0);
