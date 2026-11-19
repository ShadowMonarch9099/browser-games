// Paper Boat Parade rules: the traditional cross-and-circle race (the family
// of Pachisi and Ludo), sailed by paper boats on a festival river. Four
// harbours, four boats each, one die. No page code here, so
// tools/test-rules.js can play whole games in Node.
//
// A boat's position is a step count from its own harbour mouth:
//   -1      waiting in the harbour
//   0..50   on the river (the shared 52-square loop)
//   51..55  in its own lantern channel (no one else can enter)
//   56      home at the central ghat
(function (root) {
  const SEATS = 4, BOATS = 4, LOOP = 52, HOME = 56;
  const COLORS = ['marigold', 'jade', 'rose', 'indigo'];
  const NAMES = ['Marigold', 'Jade', 'Rose', 'Indigo'];
  const START = [0, 13, 26, 39];                 // where each harbour joins the river
  const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);   // harbour mouths and lamp buoys
  const CURRENTS = [10, 23, 36, 49];             // the fast water round each bend

  // The river, square by square, on a 15 x 15 grid (column, row), clockwise
  // from Marigold's harbour mouth on the left arm.
  const PATH = (() => {
    const p = [];
    for (let c = 1; c <= 5; c++) p.push([c, 6]);
    for (let r = 5; r >= 0; r--) p.push([6, r]);
    p.push([7, 0]);
    for (let r = 0; r <= 5; r++) p.push([8, r]);
    for (let c = 9; c <= 14; c++) p.push([c, 6]);
    p.push([14, 7]);
    for (let c = 14; c >= 9; c--) p.push([c, 8]);
    for (let r = 9; r <= 14; r++) p.push([8, r]);
    p.push([7, 14]);
    for (let r = 14; r >= 9; r--) p.push([6, r]);
    for (let c = 5; c >= 0; c--) p.push([c, 8]);
    p.push([0, 7]);
    p.push([0, 6]);
    return p;
  })();
  // each seat's lantern channel into the middle
  const CHANNEL = [
    [1, 2, 3, 4, 5].map((c) => [c, 7]),
    [1, 2, 3, 4, 5].map((r) => [7, r]),
    [13, 12, 11, 10, 9].map((c) => [c, 7]),
    [13, 12, 11, 10, 9].map((r) => [7, r]),
  ];
  const YARD = [[0, 0], [9, 0], [9, 9], [0, 9]];     // top-left corner of each 6x6 harbour

  const abs = (seat, step) => (START[seat] + step) % LOOP;
  // grid cell of a boat (yard boats sit on their own spots)
  function cell(seat, step, boat) {
    if (step < 0) { const [x, y] = YARD[seat]; return [x + 1.5 + (boat % 2) * 3, y + 1.5 + Math.floor(boat / 2) * 3]; }
    if (step <= 50) { const [c, r] = PATH[abs(seat, step)]; return [c + 0.5, r + 0.5]; }
    if (step < HOME) { const [c, r] = CHANNEL[seat][step - 51]; return [c + 0.5, r + 0.5]; }
    const off = [[-0.5, 0], [0, -0.5], [0.5, 0], [0, 0.5]][seat];
    return [7.5 + off[0] * 0.9, 7.5 + off[1] * 0.9];
  }

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // opts: { seats: [ 'human' | 'easy' | 'normal' | null ] x4, needSix, currents, threeSixes, seed }
  function create(opts) {
    const seats = (opts.seats || ['human', 'normal', null, null]).map((k) => k || null);
    const g = {
      seats, rules: { needSix: opts.needSix !== false, currents: opts.currents !== false, threeSixes: opts.threeSixes !== false },
      boats: seats.map((k) => (k ? Array(BOATS).fill(-1) : null)),
      turn: seats.findIndex(Boolean), roll: 0, sixes: 0, phase: 'roll', rand: rng(opts.seed || 1),
      finished: [], winner: -1, log: [], turnCount: 0, stats: seats.map(() => ({ captures: 0, captured: 0, sixes: 0 })),
    };
    return g;
  }
  const active = (g) => g.seats.map((k, i) => (k && g.finished.indexOf(i) < 0 ? i : -1)).filter((i) => i >= 0);

  // Where would this boat end up? null if it cannot move.
  function target(g, seat, boat, roll) {
    const step = g.boats[seat][boat];
    if (step === HOME) return null;
    if (step < 0) return roll === 6 || !g.rules.needSix ? 0 : null;
    const to = step + roll;
    return to > HOME ? null : to;
  }
  function moves(g) {
    if (g.phase !== 'move') return [];
    const out = [];
    for (let b = 0; b < BOATS; b++) if (target(g, g.turn, b, g.roll) !== null) out.push(b);
    return out;
  }

  // Roll the die. Returns events; may pass the turn if nothing can move.
  function roll(g, value) {
    const ev = [];
    if (g.phase !== 'roll') return ev;
    const r = value || 1 + Math.floor(g.rand() * 6);
    g.roll = r;
    ev.push({ type: 'roll', seat: g.turn, value: r });
    if (r === 6) { g.sixes++; g.stats[g.turn].sixes++; } else g.sixes = 0;
    if (r === 6 && g.sixes >= 3 && g.rules.threeSixes) {
      ev.push({ type: 'threeSixes', seat: g.turn });
      g.sixes = 0;
      nextTurn(g, ev);
      return ev;
    }
    g.phase = 'move';
    if (!moves(g).length) { ev.push({ type: 'stuck', seat: g.turn }); g.phase = 'roll'; nextTurn(g, ev, r === 6); }
    return ev;
  }
  function nextTurn(g, ev, again) {
    g.phase = 'roll';
    if (g.winner >= 0 && active(g).length <= 1) { g.phase = 'over'; return; }
    if (again && g.finished.indexOf(g.turn) < 0) { ev.push({ type: 'again', seat: g.turn }); return; }
    g.sixes = 0;
    let t = g.turn;
    for (let i = 0; i < SEATS; i++) { t = (t + 1) % SEATS; if (g.seats[t] && g.finished.indexOf(t) < 0) break; }
    g.turn = t; g.turnCount++;
    ev.push({ type: 'turn', seat: t });
  }

  // Move one boat by the current roll.
  function move(g, boat) {
    const ev = [], seat = g.turn;
    if (g.phase !== 'move') return ev;
    const to = target(g, seat, boat, g.roll);
    if (to === null) return ev;
    const from = g.boats[seat][boat];
    let dest = to;
    ev.push({ type: from < 0 ? 'launch' : 'move', seat, boat, from, to });
    let bonus = g.roll === 6;
    // fast water: a boat stopping on a current is carried three squares on
    if (g.rules.currents && dest <= 50 && CURRENTS.indexOf(abs(seat, dest)) >= 0 && dest + 3 <= 50) {
      ev.push({ type: 'current', seat, boat, from: dest, to: dest + 3 });
      dest += 3;
    }
    g.boats[seat][boat] = dest;
    // capture: any lone rival boat on this river square (not a safe one) goes back to its harbour
    if (dest <= 50 && !SAFE.has(abs(seat, dest))) {
      const here = abs(seat, dest);
      for (let s = 0; s < SEATS; s++) {
        if (s === seat || !g.boats[s]) continue;
        g.boats[s].forEach((st, b) => {
          if (st >= 0 && st <= 50 && abs(s, st) === here) {
            g.boats[s][b] = -1; bonus = true;
            g.stats[seat].captures++; g.stats[s].captured++;
            ev.push({ type: 'capture', seat, by: boat, victim: s, boat: b });
          }
        });
      }
    }
    if (dest === HOME) {
      bonus = true;
      ev.push({ type: 'home', seat, boat });
      if (g.boats[seat].every((st) => st === HOME)) {
        g.finished.push(seat);
        if (g.winner < 0) g.winner = seat;
        ev.push({ type: 'finish', seat, place: g.finished.length });
        bonus = false;
      }
    }
    nextTurn(g, ev, bonus);
    return ev;
  }

  // ---------- the computer captains ----------
  // How many rival boats could reach this river square with one roll?
  function danger(g, seat, step) {
    if (step < 0 || step > 50) return 0;
    const here = abs(seat, step);
    if (SAFE.has(here)) return 0;
    let n = 0;
    for (let s = 0; s < SEATS; s++) {
      if (s === seat || !g.boats[s]) continue;
      for (const st of g.boats[s]) {
        if (st < 0 || st > 50) continue;
        const d = (here - abs(s, st) + LOOP) % LOOP;
        if (d >= 1 && d <= 6 && st + d <= 50) n++;
      }
    }
    return n;
  }
  function think(g, level) {
    const opts = moves(g);
    if (!opts.length) return -1;
    const seat = g.turn;
    const scored = opts.map((b) => {
      const from = g.boats[seat][b], to = target(g, seat, b, g.roll);
      let land = to;
      if (g.rules.currents && land <= 50 && CURRENTS.indexOf(abs(seat, land)) >= 0 && land + 3 <= 50) land += 3;
      let s = land * 0.6;
      if (from < 0) s += 32;
      if (land === HOME) s += 45;
      else if (land > 50) s += 22;
      if (land <= 50) {
        const here = abs(seat, land);
        for (let o = 0; o < SEATS; o++) if (o !== seat && g.boats[o]) for (const st of g.boats[o]) if (st >= 0 && st <= 50 && abs(o, st) === here && !SAFE.has(here)) s += 55 + st;
        if (SAFE.has(here)) s += 12;
        s -= danger(g, seat, land) * 18;
      }
      s += danger(g, seat, from) * 16;
      return { b, s: s + (level === 'easy' ? g.rand() * 40 : g.rand() * 2) };
    });
    scored.sort((a, b) => b.s - a.s);
    return scored[0].b;
  }

  const api = { SEATS, BOATS, LOOP, HOME, COLORS, NAMES, START, SAFE, CURRENTS, PATH, CHANNEL, YARD, abs, cell, create, roll, move, moves, target, think, active, danger };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PB = root.PB || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
