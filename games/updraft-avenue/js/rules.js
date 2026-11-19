// Updraft Avenue rules: a race over the hundred rooftops of a hill town on
// kite-festival day. Roll and fly your kite forward square by square.
// Land at the foot of an updraft and it lifts you up the hill; land at the
// mouth of a drainpipe and you slide down it. Reach 100 exactly to win
// (a roll that overshoots bounces back off the clocktower).
// House rules, all optional:
//   pick a die    roll two dice and fly either one
//   sixes again   a six gives another roll
//   ribbons       some squares hold a festival ribbon: spend it for a re-roll
(function (root) {
  const N = 100;
  const BOARDS = {
    oldtown: {
      name: 'Old Town',
      up: [[4, 23], [11, 32], [19, 38], [35, 57], [47, 66], [60, 79], [71, 88], [82, 97]],
      down: [[26, 8], [44, 24], [51, 29], [59, 40], [69, 48], [77, 55], [86, 64], [93, 72], [98, 79]],
      ribbons: [15, 42, 63, 90],
    },
    harbour: {
      name: 'Harbour Hill',
      up: [[6, 27], [14, 45], [24, 56], [39, 61], [52, 73], [64, 85], [78, 94]],
      down: [[17, 3], [33, 12], [49, 30], [57, 36], [68, 46], [75, 54], [84, 62], [91, 70], [96, 77], [99, 81]],
      ribbons: [9, 37, 66, 88],
    },
    clocktower: {
      name: 'Clocktower Climb',
      up: [[3, 41], [18, 37], [29, 71], [46, 65], [55, 90], [67, 86], [76, 95]],
      down: [[22, 2], [38, 9], [53, 16], [63, 34], [79, 42], [88, 47], [94, 58], [97, 68]],
      ribbons: [12, 50, 73, 85],
    },
  };
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // square number (1..100) to grid cell, row 0 at the bottom, alternating direction
  function cell(n) {
    const i = n - 1, row = Math.floor(i / 10), col = row % 2 ? 9 - (i % 10) : i % 10;
    return [col, row];
  }
  function jumps(board) { const m = {}; for (const [a, b] of board.up) m[a] = b; for (const [a, b] of board.down) m[a] = b; return m; }

  function create(o) {
    const board = BOARDS[o.board || 'oldtown'];
    return {
      board, jump: jumps(board), players: o.players, pos: o.players.map(() => 0), ribbons: o.players.map(() => 0), taken: {},
      turn: 0, rand: o.rand || Math.random, rules: Object.assign({ pick: false, sixes: true, ribbons: true }, o.rules), dice: null, phase: 'roll',
      over: false, winner: -1, stats: o.players.map(() => ({ ups: 0, downs: 0, rolls: 0 })), sixesInRow: 0,
    };
  }
  const d6 = (r) => 1 + Math.floor(r() * 6);
  function roll(s, values) {
    if (s.phase !== 'roll' && s.phase !== 'reroll') return false;
    s.dice = values || (s.rules.pick ? [d6(s.rand), d6(s.rand)] : [d6(s.rand)]);
    s.stats[s.turn].rolls++;
    s.phase = 'move';
    return s.dice;
  }
  // where a move of k from square p ends up, and what happens on the way
  function plan(s, p, k) {
    const steps = [];
    let to = p + k, bounce = false;
    if (to > N) { bounce = true; to = N - (to - N); }
    for (let i = 1; i <= k; i++) { const q = p + i; steps.push(q <= N ? q : N - (q - N)); }
    const ev = [{ type: 'fly', from: p, to, steps, bounce }];
    if (s.jump[to]) { const j = s.jump[to]; ev.push({ type: j > to ? 'up' : 'down', from: to, to: j }); to = j; }
    return { to, ev };
  }
  // fly with die i (0 or 1). Returns the events to animate.
  function move(s, i = 0) {
    if (s.phase !== 'move' || !s.dice || s.dice[i] === undefined) return null;
    const p = s.turn, k = s.dice[i];
    const { to, ev } = plan(s, s.pos[p], k);
    s.pos[p] = to;
    for (const e of ev) { if (e.type === 'up') s.stats[p].ups++; if (e.type === 'down') s.stats[p].downs++; }
    // a ribbon is picked up the first time anyone lands on its square
    if (s.rules.ribbons && s.board.ribbons.includes(to) && !s.taken[to]) { s.taken[to] = true; s.ribbons[p]++; ev.push({ type: 'ribbon', at: to }); }
    // knock-on: land on someone and they drift back three squares
    for (let q = 0; q < s.pos.length; q++) if (q !== p && s.pos[q] === to && to !== N && to > 0) { const back = Math.max(0, to - 3); s.pos[q] = back; ev.push({ type: 'bump', who: q, from: to, to: back }); }
    if (to === N) { s.over = true; s.winner = p; s.phase = 'over'; ev.push({ type: 'win', who: p }); return ev; }
    const six = s.rules.sixes && k === 6;
    if (six) s.sixesInRow++; else s.sixesInRow = 0;
    if (six && s.sixesInRow < 3) { s.phase = 'roll'; ev.push({ type: 'again' }); }
    else { s.sixesInRow = 0; s.turn = (s.turn + 1) % s.players.length; s.phase = 'roll'; ev.push({ type: 'next', who: s.turn }); }
    s.dice = null;
    return ev;
  }
  // spend a ribbon to roll again before moving
  function reroll(s) {
    if (s.phase !== 'move' || !s.ribbons[s.turn]) return false;
    s.ribbons[s.turn]--; s.phase = 'reroll';
    return roll(s);
  }
  // how good a square is for the player standing on it (higher is better)
  function value(s, sq) { return sq; }
  // computer player: which die to fly, and whether to spend a ribbon first
  function bot(s) {
    const p = s.pos[s.turn];
    const outcomes = s.dice.map((k, i) => ({ i, to: plan(s, p, k).to }));
    outcomes.sort((a, b) => value(s, b.to) - value(s, a.to));
    const best = outcomes[0];
    // re-roll if every choice slides down a drainpipe a long way
    const loss = p - best.to;
    if (loss > 8 && s.ribbons[s.turn]) return { reroll: true };
    return { die: best.i };
  }

  const api = { N, BOARDS, cell, create, roll, move, plan, reroll, bot, rng, jumps };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.UA = root.UA || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
