// Lot Jam rules: the car park, who blocks whom, the level generator and what a
// tap does. No page code here, so tools/check-levels.js runs exactly these
// rules in Node. The generator makes the same 60 lots as the first version
// (same random numbers, drawn in the same order).
(function (root) {
  const LEVELS = 60;
  const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  const PAINT = ['#e5383b', '#2a9d8f', '#3a86ff', '#ff9f1c', '#8338ec', '#06d6a0', '#ef476f', '#118ab2', '#f4a261'];
  const CONES = 3;

  // mulberry32 and FNV hash, as the old arcade kit had them
  function rng(seed) {
    let s = seed >>> 0;
    const rand = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rand.int = (min, max) => min + Math.floor(rand() * (max - min + 1));
    rand.pick = (list) => list[Math.floor(rand() * list.length)];
    rand.shuffle = (list) => {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    };
    return rand;
  }
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  const cellsOf = (c) => Array.from({ length: c.len }, (_, i) => (c.dir === 'E' || c.dir === 'W' ? [c.x + i, c.y] : [c.x, c.y + i]));
  function frontOf(c) {
    if (c.dir === 'E') return [c.x + c.len - 1, c.y];
    if (c.dir === 'S') return [c.x, c.y + c.len - 1];
    return [c.x, c.y];
  }
  // The first car in the way of `c`, and how many free cells are in front of it.
  function lookAhead(c, cars, n) {
    const [dx, dy] = DIRS[c.dir];
    let [x, y] = frontOf(c);
    let free = 0;
    for (;;) {
      x += dx;
      y += dy;
      if (x < 0 || y < 0 || x >= n || y >= n) return { blocker: null, free };
      const hit = cars.find((o) => o !== c && !o.out && cellsOf(o).some(([cx, cy]) => cx === x && cy === y));
      if (hit) return { blocker: hit, free };
      free++;
    }
  }
  // A lot can be emptied if you can keep finding a car with a clear run.
  // Letting a car out never blocks another, so any order works.
  function solveRounds(cars, n) {
    const left = cars.map((c) => ({ ...c, out: false }));
    let rounds = 0;
    while (left.some((c) => !c.out)) {
      const free = left.filter((c) => !c.out && !lookAhead(c, left, n).blocker);
      if (!free.length) return 0;
      free.forEach((c) => { c.out = true; });
      rounds++;
    }
    return rounds;
  }
  // Every car that has to leave before `c` can (cars already out are ignored
  // only if `live` is true; the generator counts every car).
  function mustLeaveFirst(c, cars, n, seen = new Set(), live = false) {
    const [dx, dy] = DIRS[c.dir];
    let [x, y] = frontOf(c);
    for (;;) {
      x += dx;
      y += dy;
      if (x < 0 || y < 0 || x >= n || y >= n) break;
      const hit = cars.find((o) => o !== c && !(live && o.out) && cellsOf(o).some(([cx, cy]) => cx === x && cy === y));
      if (hit && !seen.has(hit)) { seen.add(hit); mustLeaveFirst(hit, cars, n, seen, live); }
    }
    return seen;
  }

  // The same level number builds the same lot for everyone.
  function makeLevel(lv) {
    const rand = rng(hash('lot-jam:' + lv));
    const n = lv <= 5 ? 5 : lv <= 16 ? 6 : lv <= 36 ? 7 : 8;
    const want = Math.min(4 + Math.floor(lv * 0.45), Math.floor(n * n * 0.3));
    const cars = [];
    for (let tries = 0; tries < 900 && cars.length < want; tries++) {
      const dir = rand.pick(['N', 'E', 'S', 'W']);
      const len = rand() < 0.7 ? 2 : 3;
      const horiz = dir === 'E' || dir === 'W';
      const c = { x: rand.int(0, n - (horiz ? len : 1)), y: rand.int(0, n - (horiz ? 1 : len)), dir, len };
      if (cellsOf(c).some(([x, y]) => cars.some((o) => cellsOf(o).some(([ox, oy]) => ox === x && oy === y)))) continue;
      cars.push(c);
      // Early on, prefer cars that are boxed in, so there is something to work out.
      const boring = tries < 500 && cars.length > 2 && !lookAhead(c, cars, n).blocker;
      if (boring || !solveRounds(cars, n)) cars.pop();
    }
    cars.forEach((c, i) => { c.color = PAINT[i % PAINT.length]; c.kind = 'car'; c.asleep = false; });
    let deadline = 0;
    if (lv >= 8) {
      // The ambulance has a few cars in its way; its deadline leaves one spare exit.
      const half = Math.floor(cars.length / 2);
      const ranked = cars.map((c) => [c, mustLeaveFirst(c, cars, n).size]).filter(([, k]) => k >= 2 && k <= half).sort((a, b) => b[1] - a[1]);
      if (ranked.length) {
        const [amb, k] = ranked[0];
        amb.kind = 'ambulance';
        deadline = k + 2;
      }
    }
    if (lv >= 14) {
      const sleepy = rand.shuffle(cars.filter((c) => c.kind === 'car')).slice(0, 1 + (lv > 30) + (lv > 45));
      sleepy.forEach((c) => { c.asleep = true; });
    }
    return { n, cars, deadline };
  }

  // ---------- a game in progress ----------
  function start(lot) {
    return { n: lot.n, deadline: lot.deadline, cars: lot.cars.map((c, id) => ({ ...c, id, out: false })), cones: CONES, exits: 0, history: [], over: null };
  }
  const ambulanceWaiting = (g) => !!g.deadline && g.cars.some((c) => c.kind === 'ambulance' && !c.out);
  const exitsLeft = (g) => Math.max(0, g.deadline - g.exits);

  // Tap a car. Returns { type: 'wake' | 'bump' | 'out' | 'none', blocker, free, won, lost }.
  function tap(g, c) {
    if (g.over || !c || c.out) return { type: 'none' };
    if (c.asleep) { c.asleep = false; return { type: 'wake' }; }
    const look = lookAhead(c, g.cars, g.n);
    if (look.blocker) {
      g.cones--;
      const res = { type: 'bump', blocker: look.blocker, free: look.free };
      if (g.cones <= 0) { g.over = 'cones'; res.lost = 'cones'; }
      return res;
    }
    c.out = true;
    g.exits++;
    g.history.push(c.id);
    const res = { type: 'out', free: look.free };
    if (g.cars.every((o) => o.out)) { g.over = 'won'; res.won = true; }
    else if (g.deadline && g.exits >= g.deadline && ambulanceWaiting(g)) { g.over = 'ambulance'; res.lost = 'ambulance'; }
    return res;
  }
  function undo(g) {
    if (g.over || !g.history.length) return null;
    const c = g.cars[g.history.pop()];
    c.out = false;
    g.exits--;
    return c;
  }
  // A safe car to send next (for hints): the ambulance or one of the cars in
  // its way first, otherwise any car with a clear run. Sleeping cars count.
  function hint(g) {
    const free = g.cars.filter((c) => !c.out && !lookAhead(c, g.cars, g.n).blocker);
    if (!free.length) return null;
    if (ambulanceWaiting(g)) {
      const amb = g.cars.find((c) => c.kind === 'ambulance' && !c.out);
      if (free.includes(amb)) return amb;
      const need = mustLeaveFirst(amb, g.cars, g.n, new Set(), true);
      const pick = free.find((c) => need.has(c));
      if (pick) return pick;
    }
    return free.find((c) => !c.asleep) || free[0];
  }
  const starsFor = (g) => (g.over === 'won' ? g.cones : 0);

  const api = { LEVELS, DIRS, PAINT, CONES, rng, hash, cellsOf, frontOf, lookAhead, solveRounds, mustLeaveFirst, makeLevel, start, tap, undo, hint, ambulanceWaiting, exitsLeft, starsFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.LotJam = root.LotJam || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
