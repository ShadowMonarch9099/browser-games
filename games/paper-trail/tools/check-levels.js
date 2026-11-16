// Builds all Paper Trail pages with the game's own generator (js/rules.js)
// and confirms each can be solved with its folds and can't be solved flat.
// Usage: node games/paper-trail/tools/check-levels.js
const R = require('../js/rules.js');

let bad = 0;
for (let n = 1; n <= R.LEVELS; n++) {
  let lv;
  try { lv = R.makeLevel(n); } catch (e) { console.log(`BAD ${n}: ${e.message}`); bad++; continue; }
  const withFolds = R.solvable(lv, lv.folds, 2000000);
  const flat = R.solvable(lv, { x: false, y: false }, 2000000);
  const hint = R.solveFrom(lv, lv.folds, [lv.start], 2000000);
  const ok = withFolds === true && flat === false && Array.isArray(hint);
  if (!ok) bad++;
  const squares = lv.open.filter(Boolean).length;
  console.log(`${ok ? 'ok ' : 'BAD'} ${String(n).padStart(2)}: ${lv.w}x${lv.h}, ${squares} squares, folds ${lv.folds.x ? 'sides ' : ''}${lv.folds.y ? 'top-bottom' : ''}`);
}
if (bad) { console.error(`\n${bad} level(s) failed.`); process.exit(1); }
console.log('\nEvery page needs its folds, can be solved with them, and has a hint line.');
