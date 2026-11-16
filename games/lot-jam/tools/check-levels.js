// Builds all 60 Lot Jam levels with the game's own generator (js/rules.js,
// the same file the browser loads) and checks each one can be emptied, that
// the ambulance can make its deadline, and that playing the hint car every
// time clears the lot without losing a cone.
// Usage: node games/lot-jam/tools/check-levels.js
const path = require('path');
const R = require(path.join(__dirname, '..', 'js', 'rules.js'));

let bad = 0;
for (let lv = 1; lv <= R.LEVELS; lv++) {
  const lot = R.makeLevel(lv);
  const { n, cars, deadline } = lot;
  const rounds = R.solveRounds(cars, n);
  const sleepy = cars.filter((c) => c.asleep).length;
  // play it through by always taking the hint
  const g = R.start(lot);
  let taps = 0;
  while (!g.over && taps < 200) {
    const c = R.hint(g);
    if (!c) break;
    R.tap(g, c);
    taps++;
  }
  const played = g.over === 'won' && g.cones === R.CONES;
  const ok = rounds > 0 && cars.length >= 3 && played;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'} level ${String(lv).padStart(2)}: ${n}x${n}, ${String(cars.length).padStart(2)} cars, ${rounds} waves` +
    (deadline ? `, ambulance within ${deadline}` : '') + (sleepy ? `, ${sleepy} asleep` : '') + (played ? '' : `, hint play-through ended: ${g.over}`));
}
if (bad) { console.error(`\n${bad} level(s) failed.`); process.exit(1); }
console.log('\nAll levels can be cleared.');
