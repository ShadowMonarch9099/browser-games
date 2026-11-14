// Plays many Pocket Realm runs with a simple sensible player and prints the
// win rate per class, so balance changes in rules.js can be checked.
// Usage: node games/pocket-realm/tools/simulate.js [runs per class]
const path = require('path');
const R = require(path.join(__dirname, '..', 'rules.js'));
const RUNS = Number(process.argv[2]) || 2000;

// The bot: shop when it can, heal in fights when low, prefer safe land when hurt,
// and place tiles toward the open middle of the board.
function play(seed, cls) {
  const run = R.newRun(seed, cls);
  let outcome = 'calm', guard = 0;
  while (!run.over && guard++ < 400) {
    if (outcome === 'fight') {
      const h = run.hero, f = run.fight;
      const low = h.hp <= Math.max(6, f.atk + 1);
      if (low && h.potions) outcome = R.round(run, 'potion');
      else if (low && cls === 'mage' && !f.mended) outcome = R.round(run, 'mend');
      else if (low && h.herbs) outcome = R.round(run, 'herb');
      else if (low && f.type !== 'dragon' && f.hp > h.atk * 2) outcome = R.round(run, 'flee');
      else outcome = R.round(run, 'attack');
      continue;
    }
    if (outcome === 'shop') {
      if (run.hero.gold >= R.price(run, 'blade') + 8 && run.hero.atk < 12) R.buy(run, 'blade');
      else if (run.hero.gold >= R.price(run, 'armor') + 8 && run.hero.def < 5) R.buy(run, 'armor');
      while (run.hero.potions < 3 && R.buy(run, 'potion'));
    }
    const spots = R.freeSpots(run);
    if (!spots.length) {
      const w = R.walkSpots(run);
      if (!w.length) { run.over = 'lost'; break; }
      const [x, y] = w[Math.floor(Math.random() * w.length)];
      outcome = R.walk(run, x, y);
      continue;
    }
    const hurt = run.hero.hp < run.hero.max * 0.5;
    const rank = (land) => (hurt ? { lake: 0, village: 1, meadow: 2 }[land] ?? 5 : { ruins: 0, mountain: 1, forest: 2 }[land] ?? 3);
    const land = [...run.offer].sort((a, b) => rank(a) - rank(b))[0];
    const mid = (R.SIZE - 1) / 2;
    const [x, y] = spots.sort((a, b) => R.freeSpots({ ...run, x: b[0], y: b[1] }).length - R.freeSpots({ ...run, x: a[0], y: a[1] }).length || Math.hypot(a[0] - mid, a[1] - mid) - Math.hypot(b[0] - mid, b[1] - mid))[0];
    outcome = R.place(run, land, x, y);
  }
  return run.over === 'won';
}

for (const cls of Object.keys(R.CLASSES)) {
  let wins = 0;
  for (let i = 0; i < RUNS; i++) if (play(1000 + i * 7919, cls)) wins++;
  console.log(`${R.CLASSES[cls].name.padEnd(7)} wins ${((wins / RUNS) * 100).toFixed(1)}% of ${RUNS} runs`);
}
