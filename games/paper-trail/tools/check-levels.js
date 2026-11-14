// Builds all Paper Trail levels with the game's own generator and confirms each
// can be solved with its folds and can't be solved flat.
// Usage: node games/paper-trail/tools/check-levels.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..', '..');
const ctx = { Math, console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'site/lib/rng.js'), 'utf8'), ctx);
const src = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const rules = src.slice(src.indexOf('  const LEVELS'), src.indexOf('  // ---------- play'));
vm.runInContext(`(function () {${rules}; globalThis.api = { makeLevel, solvable, LEVELS }; })()`, ctx);

let bad = 0;
for (let n = 1; n <= ctx.api.LEVELS; n++) {
  let lv;
  try { lv = ctx.api.makeLevel(n); } catch (e) { console.log(`BAD ${n}: ${e.message}`); bad++; continue; }
  const withFolds = ctx.api.solvable(lv, lv.folds, 2000000);
  const flat = ctx.api.solvable(lv, { x: false, y: false }, 2000000);
  const ok = withFolds === true && flat === false;
  if (!ok) bad++;
  const squares = lv.open.filter(Boolean).length;
  console.log(`${ok ? 'ok ' : 'BAD'} ${String(n).padStart(2)}: ${lv.w}x${lv.h}, ${squares} squares, folds ${lv.folds.x ? 'sides ' : ''}${lv.folds.y ? 'top-bottom' : ''}`);
}
if (bad) { console.error(`\n${bad} level(s) failed.`); process.exit(1); }
console.log('\nEvery level needs its folds and can be solved with them.');
