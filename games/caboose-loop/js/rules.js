// Caboose Loop rules: the snake game, played with a wooden toy train. Pick up
// passengers to add a carriage; hit a fence, a tree or a train (yours too) and
// you're off the rails. Four timetables:
//   classic   one train, one passenger at a time, faster as it grows
//   delivery  passengers wear a colour; drive through a station of that colour
//             and every matching carriage unloads (and the train gets shorter)
//   duel      two trains, two players, last one running wins the round
//   rivals    you against three computer trains on a big layout
// No page code, so tools/test-rules.js can run whole games in Node.
(function (root) {
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const COLORS = ['scarlet', 'cobalt', 'mustard'];
  const MODES = {
    classic: { w: 20, h: 13, trains: ['human'], passengers: 1, obstacles: 0, start: 6.5, max: 13 },
    delivery: { w: 20, h: 13, trains: ['human'], passengers: 3, obstacles: 6, start: 6, max: 11, stations: 3 },
    duel: { w: 24, h: 14, trains: ['human', 'human'], passengers: 4, obstacles: 4, start: 7, max: 11 },
    rivals: { w: 30, h: 19, trains: ['human', 'bot', 'bot', 'bot'], passengers: 9, obstacles: 14, start: 7, max: 9 },
  };

  function rng(seed) {
    let s = seed >>> 0;
    const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
    return r;
  }
  const key = (x, y) => x + ',' + y;

  // opts: { mode, seed, portrait }  (portrait swaps width and height)
  function create(opts) {
    const M = MODES[opts.mode], w = opts.portrait ? M.h : M.w, h = opts.portrait ? M.w : M.h;
    const s = { mode: opts.mode, M, w, h, rand: rng(opts.seed || 1), trains: [], passengers: [], stations: [], blocks: new Set(), time: 0, ticks: 0, events: [], over: false, golden: null };
    // where the trains start: spread along the middle, facing inward
    const starts = [[3, Math.floor(h / 2), 'right'], [w - 4, Math.floor(h / 2), 'left'], [Math.floor(w / 2), 3, 'down'], [Math.floor(w / 2), h - 4, 'up']];
    if (opts.mode === 'duel') { starts[0] = [3, Math.floor(h / 3), 'right']; starts[1] = [w - 4, Math.floor((h * 2) / 3), 'left']; }
    M.trains.forEach((kind, i) => {
      const [x, y, d] = starts[i], [dx, dy] = DIRS[d];
      s.trains.push({ id: i, kind, dir: d, queue: [], body: [[x, y], [x - dx, y - dy], [x - 2 * dx, y - 2 * dy]], cars: [null, null], grow: 0, alive: true, score: 0, carried: 0, respawn: 0, wins: 0 });
    });
    // stations sit by the edges, a short platform of two squares each
    if (M.stations) {
      const spots = [[Math.floor(w / 2) - 1, 1], [1, Math.floor(h / 2)], [w - 3, h - 2]];
      for (let i = 0; i < M.stations; i++) { const [x, y] = spots[i]; s.stations.push({ cells: [[x, y], [x + 1, y]], color: COLORS[i] }); }
    }
    // scenery: trees and cottages, never on a train's starting run or a station
    for (let n = 0, guard = 0; n < M.obstacles && guard < 500; guard++) {
      const x = s.rand.int(1, w - 2), y = s.rand.int(1, h - 2);
      if (occupied(s, x, y, 3)) continue;
      s.blocks.add(key(x, y)); n++;
    }
    for (let i = 0; i < M.passengers; i++) spawn(s);
    return s;
  }
  // is this square taken (with a margin around the train heads)?
  function occupied(s, x, y, margin = 0) {
    if (s.blocks.has(key(x, y))) return true;
    for (const st of s.stations) for (const [a, b] of st.cells) if (Math.abs(a - x) <= 1 && Math.abs(b - y) <= 1) return true;
    for (const t of s.trains) {
      if (!t.alive && !margin) continue;
      for (let i = 0; i < t.body.length; i++) { const [a, b] = t.body[i]; if (a === x && b === y) return true; if (i === 0 && margin && Math.abs(a - x) + Math.abs(b - y) <= margin) return true; }
      if (margin) { const [hx, hy] = t.body[0], [dx, dy] = DIRS[t.dir]; for (let k = 1; k <= 5; k++) if (hx + dx * k === x && hy + dy * k === y) return true; }
    }
    for (const p of s.passengers) if (p.x === x && p.y === y) return true;
    return false;
  }
  function spawn(s, at) {
    for (let guard = 0; guard < 400; guard++) {
      const x = at ? at[0] : s.rand.int(0, s.w - 1), y = at ? at[1] : s.rand.int(0, s.h - 1);
      if (!at && occupied(s, x, y)) continue;
      if (at && (s.blocks.has(key(x, y)) || s.passengers.some((p) => p.x === x && p.y === y))) return;
      s.passengers.push({ x, y, color: s.mode === 'delivery' ? COLORS[s.rand.int(0, COLORS.length - 1)] : null, born: s.time });
      return;
    }
  }
  function speed(s) {
    const M = s.M;
    if (s.mode === 'classic' || s.mode === 'delivery') { const t = s.trains[0]; return Math.min(M.max, M.start + (t.body.length - 3) * 0.12); }
    return Math.min(M.max, M.start + s.time / 40);
  }
  const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
  // queue a turn; at most two waiting, so quick double-taps make a U-turn
  function turn(s, i, dir) {
    const t = s.trains[i];
    if (!t || !t.alive) return;
    const last = t.queue.length ? t.queue[t.queue.length - 1] : t.dir;
    if (dir === last || dir === opposite[last] || t.queue.length >= 2) return;
    t.queue.push(dir);
  }
  const stationAt = (s, x, y) => s.stations.find((st) => st.cells.some(([a, b]) => a === x && b === y));

  // ---------- one tick: every train moves one square ----------
  function tick(s) {
    const ev = (s.events = []);
    s.ticks++;
    for (const t of s.trains) if (t.alive && t.kind === 'bot') botThink(s, t);
    const heads = s.trains.map((t) => {
      if (!t.alive) return null;
      if (t.queue.length) t.dir = t.queue.shift();
      const [dx, dy] = DIRS[t.dir], [x, y] = t.body[0];
      return [x + dx, y + dy];
    });
    // collisions are judged against where every train will be after this tick
    const bodies = new Map();
    s.trains.forEach((t) => { if (!t.alive) return; const keep = t.grow > 0 ? t.body.length : t.body.length - 1; for (let i = 0; i < keep; i++) bodies.set(key(...t.body[i]), t.id); });
    const crashed = new Set();
    heads.forEach((h, i) => {
      if (!h) return;
      const [x, y] = h;
      if (x < 0 || y < 0 || x >= s.w || y >= s.h || s.blocks.has(key(x, y)) || bodies.has(key(x, y))) crashed.add(i);
      heads.forEach((o, j) => { if (o && j !== i && o[0] === x && o[1] === y) crashed.add(i); });
    });
    s.trains.forEach((t, i) => {
      if (!t.alive) { if (t.kind === 'bot' && (t.respawn -= 1) <= 0) revive(s, t); return; }
      if (crashed.has(i)) {
        t.alive = false; t.respawn = 30;
        ev.push({ type: 'crash', train: i, at: heads[i], length: t.body.length });
        // in rivals a wrecked train scatters its passengers along the line
        if (s.mode === 'rivals') t.body.forEach((c, k) => { if (k % 2 === 0) spawn(s, c); });
        return;
      }
      const [x, y] = heads[i];
      t.body.unshift([x, y]);
      if (t.grow > 0) t.grow--; else { t.body.pop(); }
      if (t.cars.length > t.body.length - 1) t.cars.length = t.body.length - 1;
      // picking up a passenger
      const pi = s.passengers.findIndex((p) => p.x === x && p.y === y);
      if (pi >= 0) {
        const p = s.passengers.splice(pi, 1)[0];
        t.grow += 1; t.cars.push(p.color); t.score += p.golden ? 50 : 10; t.carried++;
        ev.push({ type: 'pickup', train: i, x, y, color: p.color, golden: !!p.golden });
        if (s.passengers.length < s.M.passengers) spawn(s);
      }
      // a station unloads every carriage of its colour
      const st = stationAt(s, x, y);
      if (st) {
        const n = t.cars.filter((c) => c === st.color).length;
        if (n) {
          t.cars = t.cars.filter((c) => c !== st.color);
          const drop = Math.min(n, t.body.length - 3);
          t.body.length -= drop;
          if (t.cars.length > t.body.length - 1) t.cars.length = t.body.length - 1;
          t.score += n * n * 10;
          ev.push({ type: 'deliver', train: i, n, color: st.color, x, y, points: n * n * 10 });
        }
      }
    });
    // the occasional golden passenger in classic, worth five, who won't wait long
    if (s.mode === 'classic') {
      if (!s.passengers.some((p) => p.golden) && s.ticks % 120 === 60) { spawn(s); const p = s.passengers[s.passengers.length - 1]; if (p) { p.golden = true; p.until = s.ticks + 55; ev.push({ type: 'golden', x: p.x, y: p.y }); } }
      s.passengers = s.passengers.filter((p) => !p.golden || p.until > s.ticks);
    }
    // the end
    const humans = s.trains.filter((t) => t.kind === 'human');
    if (s.mode === 'duel') {
      const alive = humans.filter((t) => t.alive);
      if (alive.length <= 1) { s.over = true; ev.push({ type: 'over', winner: alive.length ? alive[0].id : -1 }); }
    } else if (humans.length && !humans[0].alive) { s.over = true; ev.push({ type: 'over', winner: -1 }); }
    return ev;
  }
  function revive(s, t) {
    for (let guard = 0; guard < 100; guard++) {
      const x = s.rand.int(3, s.w - 4), y = s.rand.int(3, s.h - 4), dir = ['up', 'down', 'left', 'right'][s.rand.int(0, 3)], [dx, dy] = DIRS[dir];
      const cells = [[x, y], [x - dx, y - dy], [x - 2 * dx, y - 2 * dy]];
      if (cells.some(([a, b]) => occupied(s, a, b, 0)) || occupied(s, x + dx, y + dy, 0)) continue;
      Object.assign(t, { body: cells, dir, queue: [], cars: [null, null], grow: 0, alive: true });
      return;
    }
  }

  // ---------- the computer drivers ----------
  // breadth-first search for the nearest passenger, steering round everything
  function botThink(s, t) {
    const blocked = new Set(s.blocks);
    for (const o of s.trains) if (o.alive) o.body.forEach((c, i) => { if (!(o === t && i === o.body.length - 1)) blocked.add(key(...c)); });
    // squares other heads could step into next tick are risky
    for (const o of s.trains) if (o.alive && o !== t) for (const d of Object.values(DIRS)) blocked.add(key(o.body[0][0] + d[0], o.body[0][1] + d[1]));
    const [hx, hy] = t.body[0], free = (x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h && !blocked.has(key(x, y));
    const goal = new Set(s.passengers.map((p) => key(p.x, p.y)));
    const seen = new Map([[key(hx, hy), null]]), q = [[hx, hy]];
    let found = null;
    for (let i = 0; i < q.length && i < 900; i++) {
      const [x, y] = q[i];
      if (i && goal.has(key(x, y))) { found = [x, y]; break; }
      for (const [d, [dx, dy]] of Object.entries(DIRS)) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (seen.has(k) || !free(nx, ny)) continue;
        if (i === 0 && d === opposite[t.dir]) continue;
        seen.set(k, [x, y, i === 0 ? d : seen.get(key(x, y))[2]]); q.push([nx, ny]);
      }
    }
    let dir = found ? seen.get(key(...found))[2] : null;
    // no route: take the direction with the most room to breathe
    if (!dir || flood(s, hx + DIRS[dir][0], hy + DIRS[dir][1], blocked, 40) < Math.min(20, t.body.length)) {
      let best = -1;
      for (const [d, [dx, dy]] of Object.entries(DIRS)) {
        if (d === opposite[t.dir] || !free(hx + dx, hy + dy)) continue;
        const room = flood(s, hx + dx, hy + dy, blocked, 60);
        if (room > best) { best = room; dir = d; }
      }
    }
    if (dir && dir !== opposite[t.dir]) { t.queue = []; t.dir = dir; }
  }
  function flood(s, x, y, blocked, cap) {
    const seen = new Set([key(x, y)]), q = [[x, y]];
    for (let i = 0; i < q.length && seen.size < cap; i++) for (const [dx, dy] of Object.values(DIRS)) {
      const nx = q[i][0] + dx, ny = q[i][1] + dy, k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h || blocked.has(k) || seen.has(k)) continue;
      seen.add(k); q.push([nx, ny]);
    }
    return seen.size;
  }

  const api = { DIRS, COLORS, MODES, create, tick, turn, speed, stationAt, key };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.CL = root.CL || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
