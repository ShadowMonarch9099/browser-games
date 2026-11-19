// Checks Flick Parlour's physics and rules, and that computer games finish.
// Run: node games/flick-parlour/tools/test-rules.js
const R = require('../js/rules.js');
const assert = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1; } };

// the opening layout: 19 coins, none overlapping, all inside the board
{
  const coins = R.setup();
  assert(coins.length === 19, '19 coins');
  assert(coins.filter((c) => c.kind === 'white').length === 9 && coins.filter((c) => c.kind === 'black').length === 9, 'nine of each colour');
  for (const a of coins) for (const b of coins) if (a !== b) assert(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r - 1e-6, `coins ${a.id} and ${b.id} overlap`);
}
// a straight flick at a lone coin sinks it in the corner
{
  const s = R.create();
  for (const c of s.coins) { c.in = true; }
  const c = s.coins[1]; c.in = false; c.x = 0.2; c.y = 0.2;
  const other = s.coins[3]; other.in = false; other.x = 0.85; other.y = 0.4; // so it isn't the last white coin
  // aim the striker so it pushes the coin along the diagonal into the top-left pocket
  s.striker.x = 0.5; s.striker.y = 0.5; // place by hand for the test
  const ang = Math.atan2(c.y - 0.5, c.x - 0.5);
  s.phase = 'aim';
  assert(R.flick(s, ang, 0.22), 'flick accepted');
  R.simulate(s);
  assert(c.in, 'a diagonal shot sinks the coin');
  assert(s.result.some((e) => e.type === 'again') || s.result.some((e) => e.type === 'next'), 'turn resolves');
}
// sinking the striker is a foul
{
  const s = R.create();
  s.sunk[0].push(1); s.coins[1].in = true;
  s.striker.x = 0.12; s.striker.y = 0.12;
  R.flick(s, Math.atan2(-1, -1), 0.5);
  R.simulate(s);
  assert(s.fouls[0] === 1 && s.result.some((e) => e.type === 'foul'), 'striker in a pocket is a foul');
  assert(!s.coins[1].in && s.sunk[0].length === 0, 'a sunk coin comes back after a foul');
  assert(s.turn === 1, 'a foul ends the turn');
}
// energy dies away; nothing escapes the board
{
  const s = R.create();
  R.flick(s, -Math.PI / 2, 1);
  let t = 0; while (s.phase === 'moving' && t < 20) { R.step(s, 1 / 60); t += 1 / 60; }
  assert(s.phase !== 'moving', 'everything comes to rest');
  for (const c of s.coins) if (!c.in) assert(c.x >= 0 && c.x <= 1 && c.y >= 0 && c.y <= 1, 'coins stay on the board');
}
// whole games between computer players finish, and better aim wins more
{
  const wins = [0, 0, 0];
  let flicks = 0;
  for (let g = 0; g < 24; g++) {
    const rand = R.rng(g + 3), s = R.create();
    let guard = 0;
    while (!s.over && guard++ < 400) {
      const m = R.plan(s, s.turn === 0 ? 2 : 0, rand);
      R.placeStriker(s, m.x);
      if (!R.strikerClear(s)) R.placeStriker(s, 0.5 + (rand() - 0.5) * 0.4);
      if (!R.flick(s, m.angle, m.power)) { R.placeStriker(s, 0.3 + rand() * 0.4); if (!R.flick(s, m.angle, m.power)) { s.turn = 1 - s.turn; continue; } }
      R.simulate(s); flicks++;
    }
    wins[s.over ? s.winner : 2]++;
  }
  console.log(`sharp vs easy: ${wins[0]}-${wins[1]} (${wins[2]} unfinished), ${Math.round(flicks / 24)} flicks a game`);
  assert(wins[2] <= 4, 'most games finish');
  assert(wins[0] > wins[1], 'better aim wins more');
}
// solo practice clears the board
{
  const s = R.create({ solo: true }), rand = R.rng(9);
  let guard = 0;
  while (!s.over && guard++ < 400) { const m = R.plan(s, 2, rand); R.placeStriker(s, m.x); if (R.flick(s, m.angle, m.power)) R.simulate(s); else R.placeStriker(s, 0.3 + rand() * 0.4); }
  console.log(`solo: cleared in ${s.flicks[0]} flicks`);
  assert(s.over, 'solo board clears');
}
if (!process.exitCode) console.log('flick-parlour: rules hold');
