// Builds all 60 Lot Jam levels with the game's own generator and checks each
// one can be emptied. Usage: node games/lot-jam/tools/check-levels.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..', '..');
const ctx = { window: {}, Math, console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'site/lib/rng.js'), 'utf8'), ctx);
// The rules and generator sit between these two markers in game.js and don't touch the page.
const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const rules = src.slice(src.indexOf('  const LEVELS'), src.indexOf('  // ---------- game state'));
vm.runInContext(`(function () {${rules}; globalThis.api = { makeLevel, solveRounds, LEVELS }; })()`, ctx);

let bad = 0;
for (let lv = 1; lv <= ctx.api.LEVELS; lv++) {
  const { n, cars, deadline } = ctx.api.makeLevel(lv);
  const rounds = ctx.api.solveRounds(cars, n);
  const sleepy = cars.filter((c) => c.asleep).length;
  const ok = rounds > 0 && cars.length >= 3;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'} level ${String(lv).padStart(2)}: ${n}x${n}, ${String(cars.length).padStart(2)} cars, ${rounds} waves` +
    (deadline ? `, ambulance within ${deadline}` : '') + (sleepy ? `, ${sleepy} asleep` : ''));
}
if (bad) { console.error(`\n${bad} level(s) failed.`); process.exit(1); }
console.log('\nAll levels can be cleared.');
