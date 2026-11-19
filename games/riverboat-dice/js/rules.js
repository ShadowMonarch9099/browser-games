// Riverboat Dice rules: four traditional dice games, each with its own
// engine and computer players. No page code, so tools/ can check them in Node.
//   Hot Dice      push your luck with six dice; bank before you bust
//   Yacht         five dice, three rolls, twelve boxes on a scorecard
//   Shut the Box  roll two dice and flip down tiles that add up to the roll
//   Bluff         hidden dice under cups; raise the bid or call it a lie
(function (root) {
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const d6 = (r) => 1 + Math.floor(r() * 6);
  const counts = (dice) => { const c = [0, 0, 0, 0, 0, 0, 0]; for (const d of dice) c[d]++; return c; };
  const sum = (a) => a.reduce((x, y) => x + y, 0);

  // ======================= HOT DICE =======================
  // Score a set of dice where every die must count. Returns 0 if any doesn't.
  function hotScore(dice) {
    if (!dice.length) return 0;
    const c = counts(dice);
    if (dice.length === 6 && c.slice(1).every((n) => n === 1)) return 1500;
    if (dice.length === 6 && c.slice(1).filter((n) => n === 2).length === 3) return 1500;
    let score = 0;
    for (let f = 1; f <= 6; f++) {
      if (c[f] >= 3) { score += (f === 1 ? 1000 : f * 100) * Math.pow(2, c[f] - 3); c[f] = 0; }
    }
    score += c[1] * 100 + c[5] * 50; c[1] = 0; c[5] = 0;
    return c.some((n) => n > 0) ? 0 : score;
  }
  // every subset of a roll that scores, best first (as index lists)
  function hotOptions(dice) {
    const out = [];
    for (let m = 1; m < 1 << dice.length; m++) {
      const idx = []; for (let i = 0; i < dice.length; i++) if (m & (1 << i)) idx.push(i);
      const sc = hotScore(idx.map((i) => dice[i]));
      if (sc) out.push({ idx, score: sc });
    }
    return out.sort((a, b) => b.score - a.score || a.idx.length - b.idx.length);
  }
  const hotBust = (dice) => hotOptions(dice).length === 0;

  function hotCreate(o) {
    return { game: 'hot', players: o.players, target: o.target || 5000, scores: o.players.map(() => 0), turn: 0, dice: [], left: 6, turnScore: 0, kept: [], phase: 'roll', rand: o.rand || Math.random, over: false, winner: -1, lastRound: -1 };
  }
  function hotRoll(s, values) {
    s.dice = values || Array.from({ length: s.left }, () => d6(s.rand));
    if (hotBust(s.dice)) { s.phase = 'bust'; return { bust: true }; }
    s.phase = 'choose';
    return { bust: false };
  }
  // keep the dice at these indexes; they must all score
  function hotKeep(s, idx) {
    if (s.phase !== 'choose') return false;
    const sc = hotScore(idx.map((i) => s.dice[i]));
    if (!sc) return false;
    s.turnScore += sc;
    s.kept.push(idx.map((i) => s.dice[i]));
    s.left -= idx.length;
    const hot = s.left === 0;
    if (hot) s.left = 6;
    s.dice = s.dice.filter((_, i) => !idx.includes(i));
    s.phase = 'decide';
    return { score: sc, hot };
  }
  function hotEndTurn(s, bank) {
    const p = s.turn;
    if (bank) s.scores[p] += s.turnScore;
    const banked = bank ? s.turnScore : 0;
    // reaching the target gives everyone else one last turn
    if (s.lastRound < 0 && s.scores[p] >= s.target) s.lastRound = p;
    s.turn = (s.turn + 1) % s.players.length;
    s.dice = []; s.left = 6; s.turnScore = 0; s.kept = []; s.phase = 'roll';
    if (s.lastRound >= 0 && s.turn === s.lastRound) {
      s.over = true; s.phase = 'over';
      const best = Math.max(...s.scores); s.winner = s.scores.indexOf(best);
    }
    return banked;
  }
  // computer player: which dice to keep, and whether to bank
  function hotBotKeep(s, bold) {
    const opts = hotOptions(s.dice);
    const all = opts[0];
    if (all.idx.length === s.dice.length) return all.idx;                         // hot dice: take everything
    // otherwise keep the best option that leaves the most dice, unless the best is much better
    const lean = opts.slice().sort((a, b) => a.idx.length - b.idx.length || b.score - a.score)[0];
    const leftIfAll = s.dice.length - all.idx.length;
    if (all.score >= lean.score + 300 || leftIfAll >= 3 || (bold && leftIfAll >= 2)) return all.idx;
    return lean.idx;
  }
  function hotBotBank(s, bold) {
    const me = s.turn, total = s.scores[me] + s.turnScore;
    if (total >= s.target && s.lastRound < 0) return true;
    // in the last round, keep going until you're ahead
    if (s.lastRound >= 0) return total > Math.max(...s.scores.filter((_, i) => i !== me));
    const need = { 1: 250, 2: 300, 3: 400, 4: 1000, 5: 2000, 6: 3000 }[s.left] * (bold ? 1.5 : 1);
    return s.turnScore >= need;
  }

  // ======================= YACHT =======================
  const BOXES = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'full', 'four', 'little', 'big', 'choice', 'yacht'];
  function yachtScore(box, dice) {
    const c = counts(dice);
    const i = BOXES.indexOf(box);
    if (i < 6) return c[i + 1] * (i + 1);
    switch (box) {
      case 'full': return c.some((n) => n === 3) && c.some((n) => n === 2) ? sum(dice) : 0;
      case 'four': { const f = c.findIndex((n) => n >= 4); return f > 0 ? f * 4 : 0; }
      case 'little': return [1, 2, 3, 4, 5].every((f) => c[f] === 1) ? 30 : 0;
      case 'big': return [2, 3, 4, 5, 6].every((f) => c[f] === 1) ? 30 : 0;
      case 'choice': return sum(dice);
      case 'yacht': return c.some((n) => n === 5) ? 50 : 0;
    }
    return 0;
  }
  function yachtCreate(o) {
    return { game: 'yacht', players: o.players, cards: o.players.map(() => ({})), turn: 0, round: 1, dice: [0, 0, 0, 0, 0], held: [false, false, false, false, false], rolls: 0, rand: o.rand || Math.random, over: false, winner: -1 };
  }
  function yachtRoll(s, values) {
    if (s.rolls >= 3) return false;
    s.dice = s.dice.map((d, i) => (s.held[i] && s.rolls > 0 ? d : values ? values[i] : d6(s.rand)));
    s.rolls++;
    return true;
  }
  const yachtTotal = (card) => sum(Object.values(card));
  function yachtPick(s, box) {
    const card = s.cards[s.turn];
    if (s.rolls === 0 || box in card) return false;
    card[box] = yachtScore(box, s.dice);
    s.turn = (s.turn + 1) % s.players.length;
    if (s.turn === 0) s.round++;
    s.rolls = 0; s.held = [false, false, false, false, false];
    if (s.round > BOXES.length) {
      s.over = true;
      const t = s.cards.map(yachtTotal), best = Math.max(...t);
      s.winner = t.indexOf(best);
    }
    return card[box];
  }
  // what each box is worth on average, to judge whether a score is a good use of it
  const PAR = { ones: 2, twos: 5, threes: 8, fours: 11, fives: 14, sixes: 17, full: 14, four: 9, little: 8, big: 8, choice: 22, yacht: 6 };
  function yachtBotBox(s) {
    const card = s.cards[s.turn];
    let best = null, bs = -1e9;
    for (const b of BOXES) {
      if (b in card) continue;
      const v = yachtScore(b, s.dice) - PAR[b];
      if (v > bs) { bs = v; best = b; }
    }
    return best;
  }
  // choose dice to hold by trying every hold and estimating the best box after one more roll
  function yachtBotHold(s, rand) {
    rand = rand || Math.random;
    const card = s.cards[s.turn], open = BOXES.filter((b) => !(b in card));
    let best = null, bs = -1e9;
    for (let m = 0; m < 32; m++) {
      let total = 0;
      const trials = 24;
      for (let t = 0; t < trials; t++) {
        const d = s.dice.map((v, i) => (m & (1 << i) ? v : d6(rand)));
        let top = -1e9; for (const b of open) top = Math.max(top, yachtScore(b, d) - PAR[b] * 0.6);
        total += top;
      }
      if (total / trials > bs) { bs = total / trials; best = m; }
    }
    return [0, 1, 2, 3, 4].map((i) => !!(best & (1 << i)));
  }

  // ======================= SHUT THE BOX =======================
  const TILES = 9;
  const tilesSum = (mask) => { let t = 0; for (let i = 0; i < TILES; i++) if (mask & (1 << i)) t += i + 1; return t; };
  // every way to flip open tiles (as a bitmask) that adds up to n
  function boxWays(open, n) {
    const out = [];
    for (let m = open; m; m = (m - 1) & open) if (tilesSum(m) === n) out.push(m);
    return out;
  }
  // whether one die may be rolled: once the open tiles add up to six or less
  const oneDieAllowed = (open) => tilesSum(open) <= 6;
  // the expected final score under best play from every position (lower is better)
  let EXP = null;
  function boxTable() {
    if (EXP) return EXP;
    EXP = new Float64Array(1 << TILES);
    const two = []; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) two.push(a + b);
    const val = (open, rolls) => {
      let t = 0;
      for (const r of rolls) { const ways = boxWays(open, r); t += ways.length ? Math.min(...ways.map((m) => EXP[open & ~m])) : tilesSum(open); }
      return t / rolls.length;
    };
    for (let open = 0; open < 1 << TILES; open++) {
      // positions only get smaller, so fill in order of how many tiles are open
    }
    const order = Array.from({ length: 1 << TILES }, (_, i) => i).sort((a, b) => popcount(a) - popcount(b));
    for (const open of order) {
      if (!open) { EXP[0] = 0; continue; }
      let e = val(open, two);
      if (oneDieAllowed(open)) e = Math.min(e, val(open, [1, 2, 3, 4, 5, 6]));
      EXP[open] = e;
    }
    return EXP;
  }
  function popcount(m) { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; }
  function boxCreate(o) {
    return { game: 'box', players: o.players, rounds: o.rounds || 3, round: 1, turn: 0, open: (1 << TILES) - 1, roll: null, oneDie: false, totals: o.players.map(() => 0), last: o.players.map(() => null), phase: 'roll', rand: o.rand || Math.random, over: false, winner: -1, shut: 0 };
  }
  function boxRoll(s, one, values) {
    if (s.phase !== 'roll') return false;
    if (one && !oneDieAllowed(s.open)) one = false;
    s.oneDie = !!one;
    s.roll = values || (one ? [d6(s.rand)] : [d6(s.rand), d6(s.rand)]);
    const n = sum(s.roll);
    if (!boxWays(s.open, n).length) { s.phase = 'stuck'; return { stuck: true }; }
    s.phase = 'flip';
    return { stuck: false };
  }
  function boxFlip(s, mask) {
    if (s.phase !== 'flip' || (mask & ~s.open) || tilesSum(mask) !== sum(s.roll)) return false;
    s.open &= ~mask; s.phase = 'roll'; s.roll = null;
    if (!s.open) { s.phase = 'stuck'; return { shut: true }; }
    return { shut: false };
  }
  // end the turn: the player scores what's left open
  function boxEndTurn(s) {
    const left = tilesSum(s.open);
    s.totals[s.turn] += left; s.last[s.turn] = left;
    if (!left) s.shut++;
    s.turn = (s.turn + 1) % s.players.length;
    if (s.turn === 0) s.round++;
    s.open = (1 << TILES) - 1; s.roll = null; s.phase = 'roll';
    if (s.round > s.rounds) { s.over = true; const best = Math.min(...s.totals); s.winner = s.totals.indexOf(best); }
    return left;
  }
  function boxBotFlip(s, sloppy, rand) {
    const t = boxTable(), ways = boxWays(s.open, sum(s.roll));
    if (sloppy && (rand || Math.random)() < 0.35) return ways.sort((a, b) => popcount(a) - popcount(b))[0];
    return ways.sort((a, b) => t[s.open & ~a] - t[s.open & ~b])[0];
  }
  function boxBotOneDie(s) {
    if (!oneDieAllowed(s.open)) return false;
    const t = boxTable(), open = s.open;
    const v = (rolls) => sum(rolls.map((r) => { const w = boxWays(open, r); return w.length ? Math.min(...w.map((m) => t[open & ~m])) : tilesSum(open); })) / rolls.length;
    const two = []; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) two.push(a + b);
    return v([1, 2, 3, 4, 5, 6]) < v(two);
  }

  // ======================= BLUFF =======================
  // Each player has dice under a cup. Bids are "at least q dice showing f"
  // across every cup; ones are wild and count as any face, so bids are on
  // faces 2 to 6. Call a bid a lie: whoever was wrong loses a die.
  function bluffCreate(o) {
    const s = { game: 'bluff', players: o.players, cups: o.players.map(() => []), counts: o.players.map(() => o.dice || 5), turn: 0, bid: null, bidder: -1, rand: o.rand || Math.random, over: false, winner: -1, phase: 'bid', round: 0, history: [] };
    bluffDeal(s);
    return s;
  }
  function bluffDeal(s) {
    s.cups = s.counts.map((n) => Array.from({ length: n }, () => d6(s.rand)).sort());
    s.bid = null; s.bidder = -1; s.phase = 'bid'; s.round++; s.history = [];
  }
  const bluffDiceTotal = (s) => sum(s.counts);
  const bluffValid = (s, q, f) => f >= 2 && f <= 6 && q >= 1 && q <= bluffDiceTotal(s) && (!s.bid || q > s.bid.q || (q === s.bid.q && f > s.bid.f));
  function bluffBid(s, q, f) {
    if (s.phase !== 'bid' || !bluffValid(s, q, f)) return false;
    s.bid = { q, f }; s.bidder = s.turn; s.history.push({ p: s.turn, q, f });
    s.turn = bluffNext(s, s.turn);
    return true;
  }
  const bluffNext = (s, p) => { let n = p; do { n = (n + 1) % s.players.length; } while (s.counts[n] === 0); return n; };
  const bluffCount = (s, f) => sum(s.cups.map((c) => c.filter((d) => d === f || d === 1).length));
  // call the standing bid a lie. Returns who lost a die.
  function bluffCall(s) {
    if (s.phase !== 'bid' || !s.bid) return false;
    const actual = bluffCount(s, s.bid.f), caller = s.turn;
    const loser = actual >= s.bid.q ? caller : s.bidder;
    s.counts[loser]--;
    s.phase = 'reveal';
    const res = { caller, bidder: s.bidder, actual, bid: s.bid, loser, out: s.counts[loser] === 0 };
    const alive = s.counts.map((n, i) => (n > 0 ? i : -1)).filter((i) => i >= 0);
    if (alive.length === 1) { s.over = true; s.winner = alive[0]; s.phase = 'over'; }
    s.lastLoser = loser;
    return res;
  }
  // after the reveal, the loser starts the next round (or the next player if they're out)
  function bluffNextRound(s) {
    if (s.over) return;
    s.turn = s.counts[s.lastLoser] > 0 ? s.lastLoser : bluffNext(s, s.lastLoser);
    bluffDeal(s);
  }
  // chance that at least q of n unknown dice show f (or a one)
  function atLeast(n, q) {
    if (q <= 0) return 1;
    if (q > n) return 0;
    const p = 1 / 3; let t = 0, c = 1;
    for (let k = 0; k <= n; k++) { if (k > 0) c = (c * (n - k + 1)) / k; if (k >= q) t += c * Math.pow(p, k) * Math.pow(1 - p, n - k); }
    return t;
  }
  function bluffChance(s, p, q, f) {
    const mine = s.cups[p].filter((d) => d === f || d === 1).length;
    return atLeast(bluffDiceTotal(s) - s.counts[p], q - mine);
  }
  // computer player: { call: true } or { q, f }. nerve 0..1: how readily it bluffs
  function bluffBot(s, nerve, rand) {
    rand = rand || Math.random;
    const p = s.turn;
    if (s.bid) {
      const truth = bluffChance(s, p, s.bid.q, s.bid.f);
      if (truth < 0.32 + (1 - nerve) * 0.12) return { call: true };
    }
    // candidate raises: the next few quantities for each face
    const cands = [];
    for (let f = 2; f <= 6; f++) {
      const q0 = !s.bid ? 1 : f > s.bid.f ? s.bid.q : s.bid.q + 1;
      for (let q = q0; q <= Math.min(bluffDiceTotal(s), q0 + 2); q++) if (bluffValid(s, q, f)) cands.push({ q, f, p: bluffChance(s, p, q, f) });
    }
    if (!cands.length) return { call: true };
    // prefer a likely bid that isn't too timid; a bold bot sometimes bluffs higher
    const ok = cands.filter((c) => c.p >= 0.5 - nerve * 0.25);
    const pool = ok.length ? ok : cands.sort((a, b) => b.p - a.p).slice(0, 2);
    pool.sort((a, b) => b.q - a.q || b.p - a.p);
    const pick = rand() < nerve * 0.5 ? pool[0] : pool[pool.length - 1];
    if (s.bid && pick.p < 0.2) return { call: true };
    return { q: pick.q, f: pick.f };
  }

  const api = {
    rng, d6, counts, sum,
    hotScore, hotOptions, hotBust, hotCreate, hotRoll, hotKeep, hotEndTurn, hotBotKeep, hotBotBank,
    BOXES, yachtScore, yachtCreate, yachtRoll, yachtPick, yachtTotal, yachtBotBox, yachtBotHold,
    TILES, tilesSum, boxWays, oneDieAllowed, boxTable, boxCreate, boxRoll, boxFlip, boxEndTurn, boxBotFlip, boxBotOneDie,
    bluffCreate, bluffBid, bluffCall, bluffNextRound, bluffValid, bluffCount, bluffChance, bluffBot, bluffDiceTotal,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.RD = root.RD || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
