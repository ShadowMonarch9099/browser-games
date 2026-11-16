// Pin Pickle's world: a grid of cells where gold and rubble fall like sand and
// water and lava flow. No page code in here, so the level checker
// (tools/verify-levels.js) runs exactly the same rules in Node.
(function (root) {
  const EMPTY = 0, WALL = 1, GOLD = 2, WATER = 3, LAVA = 4, STONE = 5, PIN = 6, HERO = 7;
  const SCALE = 3;          // each map character is a 3x3 block of cells
  const NEED = 0.8;         // share of the gold the explorer must get

  function create(level) {
    const rows = level.map;
    const w = rows[0].length * SCALE, h = rows.length * SCALE;
    const s = {
      w, h, cells: new Uint8Array(w * h), pinId: new Uint8Array(w * h),
      dir: new Int8Array(w * h).fill(1), stamp: new Int32Array(w * h),
      pins: [], gold: 0, collected: 0, lost: 0, dead: false, tick: 0,
    };
    rows.forEach((row, ry) => [...row].forEach((ch, rx) => {
      let type = EMPTY, id = 0;
      if (ch === '#') type = WALL;
      else if (ch === 'g') type = GOLD;
      else if (ch === 'w') type = WATER;
      else if (ch === 'l') type = LAVA;
      else if (ch === 'E') type = HERO;
      else if (ch >= '1' && ch <= '9') { type = PIN; id = +ch; if (!s.pins.includes(id)) s.pins.push(id); }
      for (let y = 0; y < SCALE; y++) for (let x = 0; x < SCALE; x++) {
        const i = (ry * SCALE + y) * w + rx * SCALE + x;
        s.cells[i] = type; s.pinId[i] = id;
        // Alternate starting directions so liquids spread both ways.
        s.dir[i] = (rx * SCALE + x + ry) % 2 ? 1 : -1;
      }
      if (type === GOLD) s.gold += SCALE * SCALE;
    }));
    s.pins.sort();
    s.need = Math.ceil(s.gold * NEED);
    return s;
  }

  function pull(s, id) {
    if (!s.pins.includes(id)) return false;
    s.pins = s.pins.filter((p) => p !== id);
    for (let i = 0; i < s.cells.length; i++) if (s.cells[i] === PIN && s.pinId[i] === id) { s.cells[i] = EMPTY; s.pinId[i] = 0; }
    return true;
  }

  const won = (s) => !s.dead && s.collected >= s.need;
  const failed = (s) => s.dead || s.gold - s.lost < s.need;

  function step(s) {
    const { w, h, cells, dir, stamp } = s;
    const tick = ++s.tick;
    const move = (from, to) => { cells[to] = cells[from]; dir[to] = dir[from]; cells[from] = EMPTY; stamp[to] = tick; };
    const swap = (a, b) => { const t = cells[a], d = dir[a]; cells[a] = cells[b]; dir[a] = dir[b]; cells[b] = t; dir[b] = d; stamp[a] = stamp[b] = tick; };
    const touches = (i, type) => cells[i - 1] === type || cells[i + 1] === type || cells[i - w] === type || cells[i + w] === type;

    for (let y = h - 2; y >= 1; y--) {
      const ltr = (tick + y) & 1;
      for (let k = 1; k < w - 1; k++) {
        const x = ltr ? k : w - 1 - k;
        const i = y * w + x, t = cells[i];
        if (t < GOLD || t > STONE || stamp[i] === tick) continue;
        const below = i + w, b = cells[below];

        if (t === GOLD || t === STONE) {
          if (t === GOLD && touches(i, LAVA)) { cells[i] = EMPTY; s.lost++; continue; }   // gold melts
          if (b === EMPTY) { move(i, below); continue; }
          if (b === HERO) { cells[i] = EMPTY; if (t === GOLD) s.collected++; continue; }
          if (b === WATER || (t === STONE && b === LAVA)) { swap(i, below); continue; }     // sinks
          const first = dir[i];
          for (const side of [first, -first]) {
            const d = cells[below + side];
            if (cells[i + side] !== EMPTY && cells[i + side] !== WATER) continue;
            if (d === EMPTY) { move(i, below + side); break; }
            if (d === HERO) { cells[i] = EMPTY; if (t === GOLD) s.collected++; break; }
          }
          continue;
        }

        // liquids
        const other = t === WATER ? LAVA : WATER;
        if (touches(i, other)) {
          // Water meets lava: the lava cell turns to rubble, the water boils away.
          const j = cells[below] === other ? below : cells[i - w] === other ? i - w : cells[i + 1] === other ? i + 1 : i - 1;
          const lavaCell = t === LAVA ? i : j, waterCell = t === LAVA ? j : i;
          cells[lavaCell] = STONE; cells[waterCell] = EMPTY; stamp[lavaCell] = tick;
          continue;
        }
        if (touches(i, HERO)) {
          if (t === LAVA) { s.dead = true; return; }
          cells[i] = EMPTY; continue;                       // water just splashes the explorer
        }
        if (t === LAVA && (tick & 1)) continue;             // lava is thick: half speed
        if (b === EMPTY) { move(i, below); continue; }
        let d = dir[i];
        if (cells[below + d] === EMPTY && cells[i + d] === EMPTY) { move(i, below + d); continue; }
        if (cells[below - d] === EMPTY && cells[i - d] === EMPTY) { dir[i] = -d; move(i, below - d); continue; }
        if (cells[i + d] !== EMPTY) { d = -d; dir[i] = d; }  // bounced off something: turn around
        if (cells[i + d] === EMPTY) move(i, i + d);
      }
    }
  }

  const api = { EMPTY, WALL, GOLD, WATER, LAVA, STONE, PIN, HERO, SCALE, create, pull, step, won, failed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PinSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
