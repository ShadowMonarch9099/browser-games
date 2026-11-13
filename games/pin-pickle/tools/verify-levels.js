// Plays every Pin Pickle level with the game's own rules, trying every order
// of pulling the pins (waiting for things to settle between pulls).
// A level passes if its stated solution wins, and (after the first level) at
// least one order loses, so there is something to work out.
// Usage: node games/pin-pickle/tools/verify-levels.js
const path = require('path');
const Sim = require(path.join(__dirname, '..', 'sim.js'));
const LEVELS = require(path.join(__dirname, '..', 'levels.js'));

const SETTLE = 1200; // steps to wait after each pull

function orders(list) {
  if (list.length <= 1) return [list];
  return list.flatMap((x, i) => orders([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [x, ...rest]));
}

function play(level, order) {
  const s = Sim.create(level);
  for (const pin of order) {
    Sim.pull(s, pin);
    for (let t = 0; t < SETTLE; t++) {
      Sim.step(s);
      if (Sim.won(s)) return 'win';
      if (Sim.failed(s)) return 'lose';
    }
  }
  return 'stuck';
}

// Above 5 pins there are too many orders to try them all, so try a fixed random sample.
function sample(pins, count) {
  let seed = 12345;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const out = [];
  for (let n = 0; n < count; n++) {
    const o = [...pins];
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    out.push(o);
  }
  return out;
}

let bad = 0;
LEVELS.forEach((level, n) => {
  const label = `${String(n + 1).padStart(2)} ${level.name.padEnd(15)}`;
  const widths = new Set(level.map.map((r) => r.length));
  if (widths.size !== 1) { console.log(`BAD ${label} rows have different lengths (${[...widths].join(', ')})`); bad++; return; }
  const pins = Sim.create(level).pins;
  const tried = pins.length <= 5 ? orders(pins) : sample(pins, 120);
  const results = tried.map((o) => [o.join(''), play(level, o)]);
  const wins = results.filter(([, r]) => r === 'win').map(([o]) => o);
  const losses = results.filter(([, r]) => r !== 'win').length;
  // The level's own stated solution must win.
  const stated = level.solution ? play(level, [...level.solution].map(Number)) : 'none';
  const ok = stated === 'win' && (n === 0 || losses > 0);
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'} ${label} ${pins.length} pins, solution ${level.solution || '-'}: ${stated}; ` +
    `${wins.length}/${results.length} ${pins.length <= 5 ? 'orders' : 'sampled orders'} win` + (!ok && wins.length ? ` (e.g. ${wins[0]})` : ''));
});
if (bad) { console.error(`
${bad} level(s) need fixing.`); process.exit(1); }
console.log(`
All ${LEVELS.length} levels: the stated solution wins, and a wrong order can lose.`);
