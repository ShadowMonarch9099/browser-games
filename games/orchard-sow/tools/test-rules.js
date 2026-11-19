// Checks both Orchard Sow rule sets and the computer player.
// Run: node games/orchard-sow/tools/test-rules.js
const R = require('../js/rules.js');
const assert = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1; } };
const total = (s) => s.board.reduce((a, b) => a + b, 0);

// orchard rules
{
  const s = R.create({ variant: 'orchard' });
  const ev = R.move(s, 2); // 4 seeds from pit 2: 3,4,5, store
  assert(ev[0].path.join() === '3,4,5,6' && s.board[6] === 1, 'sowing runs into your store');
  assert(s.turn === 0 && ev.some((e) => e.type === 'again'), 'finishing in your store gives another turn');
  assert(!R.move(s, 2), 'an empty pit can\'t be sown');
}
{
  const s = R.create({ variant: 'orchard' });
  s.board = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0];
  s.board[11] = 5; // opposite of pit 1 is 11
  const ev = R.move(s, 0);
  assert(ev.some((e) => e.type === 'capture' && e.n === 6) && s.board[6] === 6, 'finishing in your own empty pit captures it and the opposite pit');
}
{
  const s = R.create({ variant: 'orchard' });
  s.board = [0, 0, 0, 0, 0, 1, 10, 2, 2, 0, 0, 0, 0, 7];
  const ev = R.move(s, 5);
  assert(s.over && ev.some((e) => e.type === 'sweep'), 'when your side runs dry the game ends and the rest is swept');
  assert(s.board[13] === 11 && s.board[6] === 11 && s.winner === -1, 'sweep goes to the side that owns it');
}
{
  // the opponent's store is skipped
  const s = R.create({ variant: 'orchard' });
  s.board = [0, 0, 0, 0, 0, 10, 0, 1, 1, 1, 1, 1, 1, 0];
  const ev = R.move(s, 5);
  assert(!ev[0].path.includes(13) && total(s) === 16, 'seeds never land in the opponent\'s store');
}
// harvest rules
{
  const s = R.create({ variant: 'harvest' });
  const ev = R.move(s, 5);
  assert(ev[0].path.join() === '7,8,9,10', 'harvest sowing skips the stores');
}
{
  const s = R.create({ variant: 'harvest' });
  s.board = [0, 0, 0, 0, 0, 3, 0, 1, 2, 2, 4, 4, 4, 0];
  const ev = R.move(s, 5); // lands on 7 (->2), 8 (->3), 9 (->3)... last is 8? 3 seeds: 7,8,9
  const cap = ev.find((e) => e.type === 'capture');
  assert(cap && cap.pits.join() === '9,8,7' && s.board[6] === 8, 'harvest captures 2s and 3s back along their row: ' + JSON.stringify(ev));
}
{
  // grand slam: a capture that would take everything they have is void
  const s = R.create({ variant: 'harvest' });
  s.board = [0, 0, 0, 0, 0, 2, 0, 1, 1, 0, 0, 0, 0, 0];
  const ev = R.move(s, 5);
  assert(!ev.some((e) => e.type === 'capture'), 'taking every seed they have is not allowed');
}
{
  // feeding: if they have nothing, you must give them seeds
  const s = R.create({ variant: 'harvest' });
  s.board = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0];
  assert(R.legal(s).join() === '5', 'you must feed a starving opponent');
}
// whole games finish, conserve seeds, and deeper search plays better
for (const variant of ['orchard', 'harvest']) {
  const wins = [0, 0, 0];
  for (let g = 0; g < 16; g++) {
    let seed = g * 7 + 1; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const s = R.create({ variant, first: g % 2 });
    let guard = 0;
    while (!s.over && guard++ < 600) { const lvl = s.turn === 0 ? 2 : 0; R.move(s, R.bot(s, lvl, rand)); assert(total(s) === 48, `${variant}: seeds are never lost`); }
    assert(s.over, `${variant}: game ends`);
    wins[s.winner === -1 ? 2 : s.winner]++;
  }
  console.log(`${variant}: sharp beats easy ${wins[0]}-${wins[1]} (${wins[2]} drawn)`);
  assert(wins[0] > wins[1] * 2, `${variant}: sharp player beats easy`);
}
if (!process.exitCode) console.log('orchard-sow: rules hold');
