// Orchard Sow rules: two traditional ways to play the sowing game on a board
// of two rows of six pits with a store at each end. Both use one layout:
//   slots 0-5   your pits, left to right      slot 6   your store (right)
//   slots 7-12  their pits, right to left     slot 13  their store (left)
// Seeds always travel counter-clockwise: along your row, up past your store,
// back along their row.
//   Orchard rules (store sowing): sow into your own store too. Finish in your
//     store and you go again; finish in an empty pit of yours and you take it
//     and everything opposite. When a side runs dry the other side keeps the rest.
//   Harvest rules (two-or-three): stores are only for captures. Finish in an
//     opponent's pit that now holds 2 or 3 and you take it, and keep taking
//     back along their row while pits hold 2 or 3. Never leave an opponent with
//     nothing to sow if you can help it. First to more than half the seeds wins.
(function (root) {
  const STORE = [6, 13];
  const pitsOf = (p) => (p === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);
  const owner = (i) => (i < 6 ? 0 : i > 6 && i < 13 ? 1 : i === 6 ? 0 : 1);
  const opposite = (i) => 12 - i;

  function create(o = {}) {
    const n = o.seeds || 4, b = Array(14).fill(n);
    b[6] = 0; b[13] = 0;
    return { variant: o.variant || 'orchard', board: b, turn: o.first || 0, over: false, winner: -1, total: n * 12, quiet: 0, moves: 0 };
  }
  const clone = (s) => ({ ...s, board: s.board.slice() });
  const sideSum = (s, p) => pitsOf(p).reduce((a, i) => a + s.board[i], 0);

  function legal(s) {
    if (s.over) return [];
    const mine = pitsOf(s.turn).filter((i) => s.board[i] > 0);
    if (s.variant === 'harvest' && sideSum(s, 1 - s.turn) === 0) {
      // must feed a starving opponent if any move reaches them
      const feeding = mine.filter((i) => { const t = clone(s); sow(t, i); return sideSum(t, 1 - s.turn) > 0; });
      if (feeding.length) return feeding;
    }
    return mine;
  }
  // move the seeds; returns the path (slot for each seed in order) and the last slot
  function sow(s, from) {
    const b = s.board, p = owner(from);
    let n = b[from], i = from;
    b[from] = 0;
    const path = [];
    while (n > 0) {
      i = (i + 1) % 14;
      if (s.variant === 'orchard' && i === STORE[1 - p]) continue;
      if (s.variant === 'harvest' && (i === 6 || i === 13 || i === from)) continue;
      b[i]++; n--; path.push(i);
    }
    return { path, last: i };
  }
  // play a move. Returns events for the page to animate.
  function move(s, from) {
    if (!legal(s).includes(from)) return null;
    const p = s.turn, ev = [], { path, last } = sow(s, from);
    ev.push({ type: 'sow', from, path, who: p });
    s.moves++;
    let again = false, captured = 0;
    if (s.variant === 'orchard') {
      if (last === STORE[p]) { again = true; ev.push({ type: 'again' }); }
      else if (owner(last) === p && last !== STORE[p] && s.board[last] === 1 && s.board[opposite(last)] > 0) {
        const take = [last, opposite(last)], n = s.board[last] + s.board[opposite(last)];
        s.board[last] = 0; s.board[opposite(last)] = 0; s.board[STORE[p]] += n; captured = n;
        ev.push({ type: 'capture', pits: take, to: STORE[p], n });
      }
    } else if (owner(last) !== p && last !== 6 && last !== 13) {
      // take back along their row while the pits hold 2 or 3
      const take = [];
      let i = last;
      while (owner(i) !== p && i !== 6 && i !== 13 && (s.board[i] === 2 || s.board[i] === 3)) { take.push(i); i--; if (i === 6) break; }
      const n = take.reduce((a, j) => a + s.board[j], 0);
      // a capture that would leave them nothing at all doesn't count
      if (take.length && n < sideSum(s, 1 - p)) {
        for (const j of take) s.board[j] = 0;
        s.board[STORE[p]] += n; captured = n;
        ev.push({ type: 'capture', pits: take, to: STORE[p], n });
      }
    }
    s.quiet = captured ? 0 : s.quiet + 1;
    if (!again) s.turn = 1 - s.turn;
    checkEnd(s, ev);
    return ev;
  }
  function checkEnd(s, ev) {
    const b = s.board;
    let end = false;
    if (s.variant === 'orchard') end = sideSum(s, 0) === 0 || sideSum(s, 1) === 0;
    else end = b[6] > s.total / 2 || b[13] > s.total / 2 || legal(s).length === 0 || s.quiet >= 80;
    if (!end) return;
    // whatever is left on each side goes to that side's store
    const sweep = [];
    for (const p of [0, 1]) for (const i of pitsOf(p)) if (b[i]) { sweep.push({ from: i, to: STORE[p], n: b[i] }); b[STORE[p]] += b[i]; b[i] = 0; }
    if (sweep.length) ev.push({ type: 'sweep', moves: sweep });
    s.over = true;
    s.winner = b[6] > b[13] ? 0 : b[13] > b[6] ? 1 : -1;
    ev.push({ type: 'over', winner: s.winner });
  }
  const score = (s, p) => s.board[STORE[p]] - s.board[STORE[1 - p]];

  // ---------- the computer player: minimax with alpha-beta ----------
  function evaluate(s, p) {
    if (s.over) return s.winner === p ? 1000 + score(s, p) : s.winner === -1 ? 0 : -1000 + score(s, p);
    // stores matter most; seeds still on your side are worth a little
    return score(s, p) * 4 + (sideSum(s, p) - sideSum(s, 1 - p)) * (s.variant === 'orchard' ? 0.5 : 0.25);
  }
  function search(s, depth, alpha, beta, p) {
    const moves = legal(s);
    if (depth === 0 || s.over || !moves.length) return evaluate(s, p);
    const maxing = s.turn === p;
    let best = maxing ? -Infinity : Infinity;
    for (const m of moves) {
      const t = clone(s); move(t, m);
      // an extra turn doesn't use up depth
      const v = search(t, t.turn === s.turn ? depth : depth - 1, alpha, beta, p);
      if (maxing) { best = Math.max(best, v); alpha = Math.max(alpha, v); } else { best = Math.min(best, v); beta = Math.min(beta, v); }
      if (beta <= alpha) break;
    }
    return best;
  }
  // level: 0 easy, 1 fair, 2 sharp
  function bot(s, level = 1, rand = Math.random) {
    const moves = legal(s);
    if (!moves.length) return null;
    if (level === 0 && rand() < 0.4) return moves[Math.floor(rand() * moves.length)];
    const depth = [1, 4, 7][level];
    let best = null, bv = -Infinity;
    for (const m of moves) {
      const t = clone(s); move(t, m);
      const v = search(t, t.turn === s.turn ? depth : depth - 1, -Infinity, Infinity, s.turn) + rand() * 0.01;
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  }

  const api = { STORE, pitsOf, owner, opposite, create, legal, move, bot, sideSum, clone };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.OS = root.OS || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
