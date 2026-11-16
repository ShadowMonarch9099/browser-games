// Borrowed Boots rules: the whole platformer simulation, with no drawing or
// sound in it, so the same code runs in the browser and under Node
// (tools/check-levels.js plays every level with it).
//
// Units are tiles and seconds. y grows downward; the hero's y is their feet.
(function (root) {
  const G = 40, RUN = 7, JUMP = 15, SPRING = 22, GLIDE = 1.8, CLIMB = 5, PW = 0.7, PH = 0.9, MAXFALL = 24;
  const CRITTERS = 'bgot';

  function create(level) {
    const map = level.map.map((r) => r.split(''));
    const s = {
      map, rows: map.length, cols: map[0].length, ownMap: true,
      critters: [], stars: [], got: 0, spawn: null, flag: null,
      time: 0, won: false, deaths: 0, smashed: false, ev: [],
      p: null,
    };
    for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) {
      const ch = map[y][x];
      if (ch === 'S') s.spawn = { x: x + 0.5, y: y + 1 };
      if (ch === 'F') s.flag = { x: x + 0.5, y: y + 1 };
      if (CRITTERS.includes(ch)) s.critters.push({ type: ch, home: x + 0.5, x: x + 0.5, y: y + 1, dir: 1, gone: 0 });
      if (ch === '*') s.stars.push({ x: x + 0.5, y: y + 0.5, taken: false });
      if (ch === 'S' || ch === '*' || CRITTERS.includes(ch)) map[y][x] = '.';
    }
    respawn(s, true);
    return s;
  }

  // A copy that can be stepped without touching the original (used by the level checker).
  function clone(s) {
    return {
      map: s.map, rows: s.rows, cols: s.cols, ownMap: false,
      critters: s.critters.map((c) => ({ type: c.type, home: c.home, x: c.x, y: c.y, dir: c.dir, gone: c.gone })),
      stars: s.stars.map((t) => ({ x: t.x, y: t.y, taken: t.taken })), got: s.got,
      spawn: s.spawn, flag: s.flag, time: s.time, won: s.won, deaths: s.deaths, smashed: s.smashed, ev: [],
      p: Object.assign({}, s.p),
    };
  }
  function writable(s) { if (!s.ownMap) { s.map = s.map.map((r) => r.slice()); s.ownMap = true; } }

  function respawn(s, first) {
    s.p = { x: s.spawn.x, y: s.spawn.y, vx: 0, vy: 0, ground: false, power: null, hurt: first ? 0 : 1, coyote: 0, buffer: 0, face: 1, wall: 0, gliding: false, climbing: false, air: 0 };
  }

  const tile = (s, x, y) => (x < 0 || x >= s.cols ? '#' : y < 0 || y >= s.rows ? '.' : s.map[y][x]);
  const solid = (ch) => ch === '#' || ch === 'C';

  function moveX(s, dx) {
    const p = s.p;
    p.x += dx;
    const top = Math.floor(p.y - PH + 0.01), bot = Math.floor(p.y - 0.01);
    const edge = dx > 0 ? p.x + PW / 2 : p.x - PW / 2;
    const tx = Math.floor(edge);
    for (let ty = top; ty <= bot; ty++) if (solid(tile(s, tx, ty))) { p.x = dx > 0 ? tx - PW / 2 - 0.001 : tx + 1 + PW / 2 + 0.001; p.wall = dx > 0 ? 1 : -1; return; }
    p.wall = 0;
  }
  function moveY(s, dy) {
    const p = s.p, falling = dy > 0, speed = p.vy;
    p.y += dy;
    const l = Math.floor(p.x - PW / 2 + 0.01), r = Math.floor(p.x + PW / 2 - 0.01);
    if (falling) {
      const ty = Math.floor(p.y);
      for (let tx = l; tx <= r; tx++) {
        if (!solid(tile(s, tx, ty))) continue;
        if (tile(s, tx, ty) === 'C' && p.power === 't' && speed > 9) { smash(s, tx, ty); return; }
        if (!p.ground && speed > 4) s.ev.push({ t: 'land', v: speed });
        p.y = ty; p.vy = 0; p.ground = true; return;
      }
      p.ground = false;
    } else {
      const ty = Math.floor(p.y - PH);
      for (let tx = l; tx <= r; tx++) if (solid(tile(s, tx, ty))) { p.y = ty + 1 + PH; p.vy = 0; s.ev.push({ t: 'bonk' }); return; }
    }
  }
  function smash(s, x0, y0) {
    writable(s);
    const todo = [[x0, y0]], cells = [];
    while (todo.length) {
      const [x, y] = todo.pop();
      if (tile(s, x, y) !== 'C') continue;
      s.map[y][x] = '.';
      cells.push([x, y]);
      todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    s.smashed = true;
    s.ev.push({ t: 'smash', cells });
  }

  function die(s, why) {
    s.ev.push({ t: 'die', why, x: s.p.x, y: s.p.y });
    s.deaths++;
    respawn(s, false);
  }
  function hurt(s) {
    const p = s.p;
    if (p.hurt > 0) return;
    if (p.power) {
      s.ev.push({ t: 'hurt', power: p.power });
      p.power = null; p.hurt = 1.2; p.vy = -9; p.vx = -p.face * 6;
      return;
    }
    die(s, 'hurt');
  }

  // inp: { x: -1|0|1, hold: jump held, press: jump went down this step, up: up held }
  function step(s, inp, dt) {
    if (s.won) return;
    const p = s.p;
    s.time += dt;
    p.hurt = Math.max(0, p.hurt - dt);
    const want = inp.x * RUN;
    p.vx += (want - p.vx) * Math.min(1, dt * (p.ground ? 18 : 8));
    if (inp.x) p.face = inp.x;
    // a little forgiveness either side of leaving the ground
    p.coyote = p.ground ? 0.1 : p.coyote - dt;
    p.buffer = inp.press ? 0.12 : p.buffer - dt;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -(p.power === 'b' ? SPRING : JUMP); p.ground = false; p.coyote = 0; p.buffer = 0;
      s.ev.push({ t: 'jump', spring: p.power === 'b' });
    }
    if (!inp.hold && p.vy < -5) p.vy = -5;                 // short hop on a quick tap
    p.vy += G * dt;
    p.gliding = p.power === 'o' && inp.hold && p.vy > GLIDE;
    if (p.gliding) p.vy = GLIDE;
    p.climbing = p.power === 'g' && !!p.wall && (inp.x === p.wall || inp.up);
    if (p.climbing) p.vy = -CLIMB;
    p.vy = Math.min(p.vy, MAXFALL);
    moveX(s, p.vx * dt);
    // two half steps so fast falls can't skip through thin rock
    moveY(s, (p.vy * dt) / 2); moveY(s, (p.vy * dt) / 2);
    p.air = p.ground ? 0 : p.air + dt;

    // spikes only bite near their points: the lower half of the tile
    const fr = Math.floor(p.y - 0.01);
    if (fr + 1 - p.y < 0.5 && (tile(s, Math.floor(p.x - 0.22), fr) === '^' || tile(s, Math.floor(p.x + 0.22), fr) === '^')) { hurt(s); if (s.p !== p) return; }
    if (p.y > s.rows + 2) { die(s, 'fall'); return; }
    const cx = Math.floor(p.x), cy = Math.floor(p.y - 0.1), mid = Math.floor(p.y - PH / 2);
    if (tile(s, cx, cy) === 'k') {
      writable(s);
      s.spawn = { x: cx + 0.5, y: cy + 1 }; s.map[cy][cx] = 'K';
      s.ev.push({ t: 'check', x: cx, y: cy });
    }
    if (tile(s, cx, cy) === 'F' || tile(s, cx, mid) === 'F') { s.won = true; s.ev.push({ t: 'win' }); return; }
    for (const st of s.stars) if (!st.taken && Math.abs(st.x - p.x) < 0.6 && Math.abs(st.y - (p.y - PH / 2)) < 0.8) { st.taken = true; s.got++; s.ev.push({ t: 'star', x: st.x, y: st.y }); }

    // critters pace on their ledge; land on one to borrow its trick
    for (const c of s.critters) {
      if (c.gone > 0) { c.gone -= dt; if (c.gone <= 0) s.ev.push({ t: 'back', x: c.x, y: c.y }); continue; }
      const ahead = c.x + c.dir * 0.4;
      if (Math.abs(c.x + c.dir * dt * 1.5 - c.home) > 2.5 || solid(tile(s, Math.floor(ahead), Math.floor(c.y - 0.5))) || !solid(tile(s, Math.floor(ahead), Math.floor(c.y + 0.1)))) c.dir = -c.dir;
      c.x += c.dir * 1.5 * dt;
      if (Math.abs(c.x - p.x) < 0.65 && p.y > c.y - 0.9 && p.y - PH < c.y) {
        if (p.vy > 0 && p.y < c.y - 0.35) {
          p.power = c.type; p.vy = -10; c.gone = 4; p.hurt = 0;
          s.ev.push({ t: 'borrow', type: c.type, x: c.x, y: c.y });
        } else if (p.hurt <= 0) { hurt(s); if (s.p !== p) return; }
      }
    }
  }

  const api = { create, clone, step, tile, solid, K: { G, RUN, JUMP, SPRING, GLIDE, CLIMB, PW, PH } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BootsSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
