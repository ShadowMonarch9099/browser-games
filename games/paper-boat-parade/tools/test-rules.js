// Checks Paper Boat Parade's rules and plays many computer-only games to the
// end. Usage: node games/paper-boat-parade/tools/test-rules.js
const R = require('../js/rules.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } };

// the board
ok(R.PATH.length === 52 && new Set(R.PATH.map((p) => p.join())).size === 52, 'the river has 52 different squares');
for (let i = 0; i < 52; i++) { const a = R.PATH[i], b = R.PATH[(i + 1) % 52]; ok(Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) === 1, `square ${i} touches the next (diagonally at the inner corners)`); }
for (let s = 0; s < 4; s++) {
  const last = R.PATH[R.abs(s, 50)], first = R.CHANNEL[s][0];
  ok(Math.abs(last[0] - first[0]) + Math.abs(last[1] - first[1]) === 1, `seat ${s}: channel starts beside its last river square`);
  const mouth = R.PATH[R.START[s]], [yx, yy] = R.YARD[s];
  ok(mouth[0] >= yx - 1 && mouth[0] <= yx + 6 && mouth[1] >= yy - 1 && mouth[1] <= yy + 6, `seat ${s}: harbour mouth is beside its harbour`);
}

// launching needs a six; a six rolls again
{
  const g = R.create({ seats: ['human', 'human', null, null], seed: 3 });
  R.roll(g, 3);
  ok(g.turn === 1 && g.phase === 'roll', 'no six with all boats home: turn passes');
  R.roll(g, 6);
  ok(g.phase === 'move' && R.moves(g).length === 4, 'a six can launch any boat');
  R.move(g, 0);
  ok(g.boats[1][0] === 0 && g.turn === 1, 'launched boat sits on the mouth, and a six rolls again');
}
// capture and safe squares
{
  const g = R.create({ seats: ['human', 'human', null, null], seed: 5, currents: false });
  g.boats[0][0] = 3; g.boats[1][0] = 50 - 10;                 // seat 1 step 40 = absolute (13 + 40) % 52 = 1
  g.turn = 1; g.phase = 'roll';
  R.roll(g, 2);
  const ev = R.move(g, 0);                                    // seat 1 to step 42 = absolute 3: where seat 0's boat sits
  ok(ev.some((e) => e.type === 'capture') && g.boats[0][0] === -1, 'landing on a lone rival sends it home');
  ok(g.turn === 1, 'a capture earns another roll');
  g.boats[0][1] = 8; g.phase = 'roll';                        // absolute 8 is a lamp buoy
  g.boats[1][0] = 47; g.turn = 1;                             // step 47 = absolute 8
  g.boats[1][0] = 46; R.roll(g, 1); R.move(g, 0);
  ok(g.boats[0][1] === 8, 'boats on lamp buoys are safe');
}
// exact roll home, currents
{
  const g = R.create({ seats: ['human', 'human', null, null], seed: 9 });
  g.boats[0] = [54, -1, -1, -1]; g.turn = 0; g.phase = 'roll';
  R.roll(g, 5);
  ok(g.turn === 1, 'overshooting home is not a move');
  g.turn = 0; g.phase = 'roll'; R.roll(g, 2); R.move(g, 0);
  ok(g.boats[0][0] === R.HOME, 'an exact roll brings a boat home');
  const h = R.create({ seats: ['human', 'human', null, null], seed: 11 });
  h.boats[0][0] = 7; h.turn = 0; h.phase = 'roll'; R.roll(h, 3);
  const ev = R.move(h, 0);
  ok(ev.some((e) => e.type === 'current') && h.boats[0][0] === 13, 'fast water carries a boat three squares');
}
// whole games between computer captains
const wins = [0, 0, 0, 0];
let turns = 0, stuck = 0;
for (let n = 0; n < 400; n++) {
  const seats = n % 2 ? ['normal', 'easy', 'normal', 'easy'] : ['easy', 'normal', 'easy', 'normal'];
  const g = R.create({ seats, seed: 1000 + n });
  let guard = 0;
  while (g.winner < 0 && guard++ < 6000) {
    R.roll(g);
    if (g.phase === 'move') R.move(g, R.think(g, g.seats[g.turn]));
  }
  if (g.winner < 0) { stuck++; continue; }
  wins[g.winner]++; turns += g.turnCount;
  for (let s = 0; s < 4; s++) for (const st of g.boats[s]) ok(st >= -1 && st <= R.HOME, 'boat positions stay in range');
}
ok(stuck === 0, `every game finishes (${stuck} did not)`);
console.log(`400 games: wins by seat ${wins.join(' / ')}, about ${Math.round(turns / 400)} turns each`);
// the normal captain should beat the easy one more often than not
{
  let nW = 0, eW = 0;
  for (let n = 0; n < 300; n++) {
    const g = R.create({ seats: ['normal', 'easy', null, null], seed: 5000 + n });
    if (n % 2) g.seats.reverse(), (g.boats = g.boats.slice().reverse()), (g.turn = g.seats.findIndex(Boolean));
    let guard = 0;
    while (g.winner < 0 && guard++ < 6000) { R.roll(g); if (g.phase === 'move') R.move(g, R.think(g, g.seats[g.turn])); }
    if (g.winner >= 0) (g.seats[g.winner] === 'normal' ? nW++ : eW++);
  }
  console.log(`normal vs easy: ${nW} - ${eW}`);
  ok(nW > eW, 'the normal captain beats the easy one more often');
}
if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('paper-boat-parade: rules hold');
