// Checks Updraft Avenue's boards and rules, and that races finish.
// Run: node games/updraft-avenue/tools/test-rules.js
const R = require('../js/rules.js');
const assert = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1; } };

// boards: no square starts two things, nothing starts where another ends, ribbons sit on plain squares
for (const [key, b] of Object.entries(R.BOARDS)) {
  const starts = new Set(), ends = new Set();
  for (const [a, c] of [...b.up, ...b.down]) {
    assert(a > 1 && a < 100 && c >= 1 && c <= 100, `${key}: ${a}→${c} on the board`);
    assert(!starts.has(a), `${key}: ${a} starts twice`); starts.add(a); ends.add(c);
  }
  for (const [a, c] of b.up) assert(c > a, `${key}: updraft ${a}→${c} goes up`);
  for (const [a, c] of b.down) assert(c < a, `${key}: drainpipe ${a}→${c} goes down`);
  for (const e of ends) assert(!starts.has(e), `${key}: ${e} is both an end and a start`);
  for (const r of b.ribbons) assert(!starts.has(r) && !ends.has(r), `${key}: ribbon ${r} on a plain square`);
  // the board's squares are laid out as a snake
  assert(R.cell(1).join() === '0,0' && R.cell(10).join() === '9,0' && R.cell(11).join() === '9,1' && R.cell(100).join() === '0,9', 'square layout');
}
// moves
{
  const s = R.create({ players: ['a', 'b'], board: 'oldtown', rules: { sixes: false } });
  R.roll(s, [4]); const ev = R.move(s, 0);
  assert(ev[1].type === 'up' && s.pos[0] === 23, 'square 4 rides the updraft to 23');
  s.pos[1] = 20; R.roll(s, [6]); R.move(s, 0);
  assert(s.pos[1] === 8, 'square 26 slides down to 8');
  s.pos[0] = 97; R.roll(s, [5]); const b = R.move(s, 0);
  assert(b[0].bounce && s.pos[0] === 98 - 19 + 0 || s.pos[0] === 79, 'overshoot bounces back (to 98, then down the pipe to 79)');
  s.pos[1] = 94; R.roll(s, [6]); const w = R.move(s, 0);
  assert(s.over && s.winner === 1 && w.some((e) => e.type === 'win'), 'exactly 100 wins');
}
{
  const s = R.create({ players: ['a', 'b'], board: 'harbour', rules: { sixes: false } });
  s.pos = [10, 13]; R.roll(s, [3]); const ev = R.move(s, 0);
  assert(ev.some((e) => e.type === 'bump') && s.pos[1] === 10, 'landing on someone sends them back three');
}
{
  const s = R.create({ players: ['a', 'b'], board: 'oldtown', rules: { sixes: true } });
  R.roll(s, [6]); const ev = R.move(s, 0);
  assert(ev.some((e) => e.type === 'again') && s.turn === 0, 'a six rolls again');
  const t = R.create({ players: ['a', 'b'], board: 'oldtown', rules: { pick: true } });
  const d = R.roll(t); assert(d.length === 2, 'pick-a-die rolls two');
}
{
  const s = R.create({ players: ['a', 'b'], board: 'oldtown', rules: { sixes: false } });
  s.pos[0] = 12; R.roll(s, [3]); const ev = R.move(s, 0);
  assert(ev.some((e) => e.type === 'ribbon') && s.ribbons[0] === 1, 'landing on a ribbon square collects it');
  s.turn = 0; R.roll(s, [1]); assert(R.reroll(s) && s.ribbons[0] === 0 && s.phase === 'move', 'a ribbon buys a re-roll');
}
// races finish, and picking dice helps
for (const key of Object.keys(R.BOARDS)) for (const pick of [false, true]) {
  let turns = 0, wins = [0, 0, 0, 0];
  for (let g = 0; g < 300; g++) {
    const s = R.create({ players: ['a', 'b', 'c', 'd'], board: key, rand: R.rng(g + 1), rules: { pick } });
    let guard = 0;
    while (!s.over && guard++ < 5000) { R.roll(s); const m = R.bot(s); if (m.reroll) R.reroll(s); R.move(s, m.die || 0); turns++; }
    assert(s.over, `${key}: race finishes`); wins[s.winner]++;
  }
  console.log(`${R.BOARDS[key].name}${pick ? ' (pick a die)' : ''}: ${(turns / 300).toFixed(0)} moves a race, wins by seat ${wins.join('/')}`);
}
if (!process.exitCode) console.log('updraft-avenue: rules hold');
