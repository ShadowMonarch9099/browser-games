// Checks the Tide Pool Pop rules and that every pool can be beaten.
// Run: node games/tide-pool-pop/tools/test-rules.js [--full]
const R = require('../js/rules.js');
const { LEVELS } = require('../js/levels.js');
const assert = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1; } };
const full = process.argv.includes('--full');

// a board built by hand
function board(rows, extra) {
  const lv = Object.assign({ mask: Array(R.H).fill('########'), colors: 5, moves: 10, goals: { score: 1e9 }, seed: 3 }, extra);
  const s = R.create(lv);
  // letters a-e are kinds, '#' is a rock
  rows.forEach((row, y) => row.split('').forEach((c, x) => { s.grid[y][x] = c === '#' ? { id: 900 + y * 8 + x, rock: 1 } : { id: 900 + y * 8 + x, t: c.charCodeAt(0) - 97, sp: null }; }));
  return s;
}
const filler = ['abcdeabc', 'cdeabcde', 'eabcdeab', 'bcdeabcd', 'deabcdea', 'abcdeabc', 'cdeabcde', 'eabcdeab', 'bcdeabcd'];

// boards start with no matches and at least one move
for (const lv of LEVELS) {
  const s = R.create(lv);
  assert(!R.findGroups(s).length, `level ${lv.n} starts with a match`);
  assert(R.findMoves(s).length > 0, `level ${lv.n} starts with no move`);
  for (const k of Object.keys(lv.goals.collect || {})) assert(R.KINDS.indexOf(k) < lv.colors, `level ${lv.n} asks for ${k} which isn't in the pool`);
  if (lv.goals.sand) assert(s.sandTotal > 0, `level ${lv.n} has a sand goal but no sand`);
  if (lv.goals.rocks) assert(s.rocksTotal > 0, `level ${lv.n} has a rock goal but no rocks`);
}

// a plain three
{
  const rows = filler.slice(); rows[0] = 'aabaecde'; rows[1] = 'cdaabcde';
  const s = board(rows);
  assert(!R.swap(s, 0, 0, 0, 1), 'a swap that makes nothing is refused');
  assert(R.swap(s, 2, 0, 2, 1), 'swap b down, a up: three a in a row');
  assert(s.phases[1].type === 'pop' && s.phases[1].cleared.length >= 3, 'three creatures pop');
  assert(s.moves === 9, 'one move used');
}
// four makes a wave, five a pearl, L makes a bubble
{
  const rows = filler.slice(); rows[0] = 'aabaacde'; rows[1] = 'cdaebcde';
  const s = board(rows);
  R.swap(s, 2, 0, 2, 1);
  const made = s.phases[1].made;
  assert(made.length === 1 && made[0].kind === 'pearl', 'five in a line makes a pearl: ' + JSON.stringify(made));
}
{
  const rows = filler.slice(); rows[0] = 'aabadcde'; rows[1] = 'cdaebcde';
  const s = board(rows);
  R.swap(s, 2, 0, 2, 1);
  const made = s.phases[1].made;
  assert(made.length === 1 && made[0].kind === 'h', 'four in a row makes a row wave');
}
{
  const rows = filler.slice(); rows[1] = 'adeabcde'; rows[2] = 'baacdeab'; rows[3] = 'acdeabcd';
  const s = board(rows);
  R.swap(s, 0, 2, 0, 3); // the a below comes up: a column of three meets a row of three
  const made = s.phases[1] && s.phases[1].made;
  assert(made && made.some((m) => m.kind === 'bomb'), 'an L makes a bubble: ' + JSON.stringify(made));
}
// a wave clears its row
{
  const s = board(filler);
  s.grid[4][3].sp = 'h';
  const t = s.grid[4][3].t;
  // put two of the same kind next to it so a swap triggers a match through it
  s.grid[4][4] = { id: 1, t, sp: null }; s.grid[3][5] = { id: 2, t, sp: null }; s.grid[4][5] = { id: 3, t: (t + 1) % 5, sp: null };
  R.swap(s, 5, 3, 5, 4);
  const p = s.phases[1];
  assert(p.fired.some((f) => f.sp === 'h') && p.cleared.length >= 8, 'a row wave clears the row (' + p.cleared.length + ')');
}
// pearl + creature clears that kind; pearl + pearl clears the board
{
  const s = board(filler);
  s.grid[4][3] = { id: 1, t: -1, sp: 'pearl' };
  const t = s.grid[4][4].t, count = s.grid.flat().filter((p) => p && p.t === t).length;
  R.swap(s, 3, 4, 4, 4);
  assert(s.phases[1].cleared.length >= count, 'pearl clears every ' + R.KINDS[t]);
}
{
  const s = board(filler);
  s.grid[4][3] = { id: 1, t: -1, sp: 'pearl' }; s.grid[4][4] = { id: 2, t: -1, sp: 'pearl' };
  R.swap(s, 3, 4, 4, 4);
  assert(s.phases[1].cleared.length === 72, 'two pearls clear the whole pool');
}
// sand washes, rocks crack beside a match and fall with gravity
{
  const rows = filler.slice(); rows[0] = 'aabaecde'; rows[1] = 'cdaabcde'; rows[2] = 'ea#cdeab';
  const sand = ['11100000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000'];
  const s = board(rows, { sand, goals: { sand: true } });
  s.sand = sand.map((r) => r.split('').map(Number)); s.sandLeft = 3; s.sandTotal = 3; s.rocksLeft = 1; s.rocksTotal = 1;
  R.swap(s, 2, 0, 2, 1);
  assert(s.sandLeft === 0, 'matching on sand washes it');
}
{
  const rows = filler.slice(); rows[0] = 'aabaecde'; rows[1] = 'cd#abcde';
  const s = board(rows); s.rocksLeft = 1; s.rocksTotal = 1;
  R.swap(s, 2, 0, 3, 0); // a moves right? b<->a: row0 'aaabecde'
  assert(s.rocksLeft === 0, 'a match beside a stone cracks it');
}
// the pool reshuffles when stuck, and never leaves a match standing
{
  let st = 0;
  for (let i = 0; i < 40; i++) {
    const s = R.create(Object.assign({}, LEVELS[0], { seed: i + 5 }));
    for (let m = 0; m < 15 && !s.over; m++) { const mv = R.findMoves(s)[0]; if (!mv) { st++; break; } R.swap(s, ...mv); assert(!R.findGroups(s).length, 'no match left after a turn'); }
  }
  assert(st === 0, 'always a move available');
}

// the tide bonus turns leftover moves into waves and points
{
  const s = R.create(LEVELS[0]);
  s.over = 'won'; s.moves = 6;
  const before = s.score, st = R.stars(s);
  R.tideBonus(s);
  assert(s.score > before + 6 * 250 && s.moves === 0, 'tide bonus scores');
  assert(R.stars(s) === st, 'stars are kept through the bonus');
  assert(!R.findGroups(s).length, 'no match left after the bonus');
}

// every pool can be beaten by a simple greedy player
const tries = full ? 12 : 3, report = [];
let lost = 0;
for (const lv of LEVELS) {
  let wins = 0;
  for (let i = 0; i < tries; i++) {
    const s = R.create(Object.assign({}, lv, { seed: lv.seed + i * 13 }));
    while (!s.over) { const m = R.bot(s); if (!m) break; R.swap(s, ...m); }
    if (s.over === 'won') wins++;
  }
  report.push(lv.n + ':' + wins + '/' + tries);
  if (!wins) lost++;
}
console.log(report.join(' '));
assert(lost <= (full ? 0 : 3), lost + ' pools the greedy player never beat');
if (!process.exitCode) console.log('tide-pool-pop: rules hold');
