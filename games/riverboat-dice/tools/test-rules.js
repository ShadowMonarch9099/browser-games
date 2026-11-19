// Checks the four Riverboat Dice games and their computer players.
// Run: node games/riverboat-dice/tools/test-rules.js
const R = require('../js/rules.js');
const assert = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exitCode = 1; } };
const eq = (a, b, m) => assert(a === b, `${m}: expected ${b}, got ${a}`);

// ---- Hot Dice scoring ----
eq(R.hotScore([1]), 100, 'a one'); eq(R.hotScore([5]), 50, 'a five'); eq(R.hotScore([2]), 0, 'a two alone');
eq(R.hotScore([3, 3, 3]), 300, 'three threes'); eq(R.hotScore([1, 1, 1]), 1000, 'three ones');
eq(R.hotScore([4, 4, 4, 4]), 800, 'four fours'); eq(R.hotScore([2, 2, 2, 2, 2, 2]), 1600, 'six twos');
eq(R.hotScore([1, 2, 3, 4, 5, 6]), 1500, 'a straight'); eq(R.hotScore([2, 2, 3, 3, 6, 6]), 1500, 'three pairs');
eq(R.hotScore([1, 5, 5]), 200, 'one and two fives'); eq(R.hotScore([1, 5, 2]), 0, 'a two spoils it');
assert(R.hotBust([2, 3, 4, 6, 2, 3]), 'no scoring dice is a bust'); assert(!R.hotBust([2, 3, 4, 6, 2, 5]), 'a five saves it');
{
  const s = R.hotCreate({ players: ['you', 'bot'] });
  R.hotRoll(s, [1, 1, 1, 5, 5, 5]);
  const k = R.hotKeep(s, [0, 1, 2, 3, 4, 5]);
  assert(k.hot && s.left === 6 && s.turnScore === 1500, 'all six scoring is hot dice');
  R.hotRoll(s, [2, 3, 4, 6, 2, 3]);
  assert(s.phase === 'bust', 'bust after a bad roll');
  eq(R.hotEndTurn(s, false), 0, 'a bust banks nothing');
  eq(s.scores[0], 0, 'score unchanged after a bust');
}
// bots finish games
{
  let rounds = 0;
  for (let g = 0; g < 200; g++) {
    const rand = R.rng(g + 1), s = R.hotCreate({ players: ['a', 'b', 'c'], rand, target: 5000 });
    let guard = 0;
    while (!s.over && guard++ < 3000) {
      const r = R.hotRoll(s);
      if (r.bust) { R.hotEndTurn(s, false); continue; }
      R.hotKeep(s, R.hotBotKeep(s, s.turn === 2));
      if (R.hotBotBank(s, s.turn === 2)) R.hotEndTurn(s, true);
      rounds++;
    }
    assert(s.over && s.scores[s.winner] >= 5000, 'hot dice game ends with a winner over the target');
  }
}

// ---- Yacht ----
eq(R.yachtScore('full', [2, 2, 3, 3, 3]), 13, 'full house'); eq(R.yachtScore('full', [2, 2, 2, 2, 3]), 0, 'four and one is not a full house');
eq(R.yachtScore('four', [6, 6, 6, 6, 1]), 24, 'four of a kind'); eq(R.yachtScore('four', [6, 6, 6, 6, 6]), 24, 'five count as four');
eq(R.yachtScore('little', [5, 4, 3, 2, 1]), 30, 'little straight'); eq(R.yachtScore('big', [2, 3, 4, 5, 6]), 30, 'big straight');
eq(R.yachtScore('yacht', [4, 4, 4, 4, 4]), 50, 'yacht'); eq(R.yachtScore('threes', [3, 3, 1, 2, 3]), 9, 'threes');
{
  const s = R.yachtCreate({ players: ['you'] });
  R.yachtRoll(s, [1, 2, 3, 4, 5]); s.held = [true, true, false, false, false];
  R.yachtRoll(s, [6, 6, 6, 6, 6]);
  assert(s.dice.join() === '1,2,6,6,6', 'held dice stay put');
  assert(R.yachtRoll(s) && !R.yachtRoll(s), 'three rolls a turn');
}
{
  let tot = 0;
  for (let g = 0; g < 40; g++) {
    const rand = R.rng(g + 7), s = R.yachtCreate({ players: ['bot'], rand });
    while (!s.over) { R.yachtRoll(s); for (let i = 0; i < 2; i++) { s.held = R.yachtBotHold(s, rand); R.yachtRoll(s); } R.yachtPick(s, R.yachtBotBox(s)); }
    tot += R.yachtTotal(s.cards[0]);
  }
  console.log('yacht: bot averages', Math.round(tot / 40));
  assert(tot / 40 > 130, 'yacht bot plays sensibly');
}

// ---- Shut the Box ----
assert(R.boxWays(0b111111111, 3).length === 2, 'a 3 can be 3 or 1+2');
assert(R.oneDieAllowed(0b000000111) && !R.oneDieAllowed(0b100000000), 'one die once the open tiles add up to six or less');
{
  const t = R.boxTable();
  console.log('shut the box: expected score with best play', t[(1 << 9) - 1].toFixed(2));
  assert(t[(1 << 9) - 1] > 5 && t[(1 << 9) - 1] < 15, 'expected score is sensible');
  const s = R.boxCreate({ players: ['you', 'bot'] });
  R.boxRoll(s, false, [4, 5]);
  assert(!R.boxFlip(s, 0b1) && R.boxFlip(s, 1 << 8), 'flip tiles that add to the roll');
  eq(R.boxEndTurn(s), 36, 'what is left open is the score');
  let shut = 0, total = 0;
  for (let g = 0; g < 300; g++) {
    const b = R.boxCreate({ players: ['bot'], rounds: 1, rand: R.rng(g + 3) });
    while (b.phase !== 'stuck') { const r = R.boxRoll(b, R.boxBotOneDie(b)); if (r.stuck) break; R.boxFlip(b, R.boxBotFlip(b)); }
    const left = R.boxEndTurn(b); total += left; if (!left) shut++;
  }
  console.log(`shut the box: best play averages ${(total / 300).toFixed(1)}, shuts the box ${Math.round((shut / 300) * 100)}% of the time`);
}

// ---- Bluff ----
{
  const s = R.bluffCreate({ players: ['you', 'a', 'b'], rand: R.rng(4) });
  s.cups = [[1, 2, 2, 5, 6], [2, 3, 4, 4, 4], [1, 1, 6, 6, 6]];
  eq(R.bluffCount(s, 2), 6, 'ones are wild');
  assert(R.bluffBid(s, 3, 4) && !R.bluffBid(s, 3, 3) && R.bluffBid(s, 3, 5), 'bids must go up');
  const res = R.bluffCall(s); // bid is 3 fives: there are 1+0+2 = 3 (ones) ... count it
  eq(res.actual, R.bluffCount(s, 5), 'reveal counts');
  eq(res.loser, res.actual >= 3 ? res.caller : res.bidder, 'the wrong side loses a die');
}
{
  const wins = [0, 0, 0, 0];
  for (let g = 0; g < 300; g++) {
    const rand = R.rng(g + 11), s = R.bluffCreate({ players: ['a', 'b', 'c', 'd'], rand });
    let guard = 0;
    while (!s.over && guard++ < 2000) {
      const m = R.bluffBot(s, [0.2, 0.4, 0.6, 0.8][s.turn], rand);
      if (m.call && s.bid) { R.bluffCall(s); R.bluffNextRound(s); } else if (!m.call) R.bluffBid(s, m.q, m.f); else R.bluffBid(s, 1, 2);
    }
    assert(s.over, 'bluff game ends'); wins[s.winner]++;
  }
  console.log('bluff: wins by nerve 0.2/0.4/0.6/0.8:', wins.join(' '));
}
if (!process.exitCode) console.log('riverboat-dice: rules hold');
