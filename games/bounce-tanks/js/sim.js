// Bounce Tanks rules. No drawing and no browser APIs in here, so the same file
// runs a whole match under Node (tools/match-test.js).
//
// 2 to 4 tanks in a maze that is rebuilt every round. Shells bounce off walls
// and one hit knocks a tank out, including your own. Last tank rolling takes
// the round; first to the target number of rounds wins the match.
(function () {
  const COLS = 9, ROWS = 6, T = 0.1, R = 0.2;
  const COUNT_STEP = 0.62; // seconds per "3", "2", "1"

  let uidSeq = 0;
  // Computer skill: how closely a bot must be lined up before it fires, how
  // long it hesitates after spotting a target, and how fast it turns.
  const SKILL = [
    { aim: 0.2, wait: 0.55, turn: 0.75 },
    { aim: 0.12, wait: 0.25, turn: 1 },
    { aim: 0.07, wait: 0.08, turn: 1 },
  ];

  function create(opts) {
    const seats = opts.seats; // [{ team: 0-3, bot: bool }]
    const m = {
      COLS, ROWS, T, R, uid: ++uidSeq, skill: opts.skill === undefined ? 1 : opts.skill,
      seats, target: opts.target || 5, rand: BT.rng(opts.seed), timeLimit: opts.timeLimit || 0,
      score: seats.map(() => 0),
      stats: seats.map(() => ({ shots: 0, bounces: 0, hits: 0, own: 0 })),
      round: 0, time: 0, events: [], mazeId: 0,
      tanks: [], shells: [], walls: [], pickup: null,
      phase: 'countdown', phaseT: 0, roundT: 0, endT: 0, lastWinner: -1, champ: -1,
    };
    newRound(m);
    return m;
  }

  // A maze from a random walk, with extra gaps knocked through so it isn't all corridors.
  function buildMaze(m) {
    const rand = m.rand;
    const right = Array.from({ length: ROWS }, () => Array(COLS).fill(true));
    const down = Array.from({ length: ROWS }, () => Array(COLS).fill(true));
    const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const stack = [[0, 0]]; seen[0][0] = true;
    while (stack.length) {
      const c = stack[stack.length - 1][0], r = stack[stack.length - 1][1];
      const next = rand.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]]).find((d) => {
        const x = c + d[0], y = r + d[1];
        return x >= 0 && y >= 0 && x < COLS && y < ROWS && !seen[y][x];
      });
      if (!next) { stack.pop(); continue; }
      const dx = next[0], dy = next[1];
      if (dx === 1) right[r][c] = false; if (dx === -1) right[r][c - 1] = false;
      if (dy === 1) down[r][c] = false; if (dy === -1) down[r - 1][c] = false;
      seen[r + dy][c + dx] = true; stack.push([c + dx, r + dy]);
    }
    // [x, y, w, h, isBorder]
    const walls = [[-T, -T, COLS + 2 * T, T, 1], [-T, ROWS, COLS + 2 * T, T, 1], [-T, 0, T, ROWS, 1], [COLS, 0, T, ROWS, 1]];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (c < COLS - 1 && right[r][c] && rand() > 0.45) walls.push([c + 1 - T / 2, r - T / 2, T, 1 + T, 0]);
      if (r < ROWS - 1 && down[r][c] && rand() > 0.45) walls.push([c - T / 2, r + 1 - T / 2, 1 + T, T, 0]);
    }
    m.walls = walls;
    m.mazeId++;
  }

  function hitsWall(m, x, y, rad) {
    const walls = m.walls;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      const cx = Math.max(w[0], Math.min(x, w[0] + w[2])), cy = Math.max(w[1], Math.min(y, w[1] + w[3]));
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < rad * rad) return true;
    }
    return false;
  }
  function clearLine(m, a, b) {
    const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 0.12);
    for (let i = 1; i < n; i++) if (hitsWall(m, a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, 0.04)) return false;
    return true;
  }

  function newRound(m) {
    const rand = m.rand;
    buildMaze(m);
    m.round++;
    const spots = rand.shuffle([[0, 0], [COLS - 1, ROWS - 1], [COLS - 1, 0], [0, ROWS - 1]]);
    m.tanks = m.seats.map((s, i) => ({
      i, team: s.team, bot: !!s.bot, x: spots[i][0] + 0.5, y: spots[i][1] + 0.5, a: rand() * 6.28,
      alive: true, cool: 0, shells: 0, power: null, turn: 0, dir: 0, stuck: 0, plan: 0, wp: null, bank: null, seen: 0, recoil: 0, boom: 0, speed: 0,
    }));
    m.shells = []; m.pickup = null; m.pickupAt = m.time + 6; m.roundT = 0; m.endT = 0;
    m.phase = 'countdown'; m.phaseT = 0; m.count = 4;
    m.events.push({ t: 'round', n: m.round });
  }

  function fire(m, t) {
    if (t.cool > 0 || t.shells >= 5) return;
    t.cool = 0.3; t.recoil = 1;
    const shots = t.power === 'triple' ? [-0.25, 0, 0.25] : [0];
    const fast = t.power === 'laser';
    for (const off of shots) {
      const a = t.a + off, sp = fast ? 8 : 3.4;
      m.shells.push({ x: t.x + Math.cos(a) * (R + 0.08), y: t.y + Math.sin(a) * (R + 0.08), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: fast ? 1.6 : 6, owner: t, age: 0, fast, bounces: 0 });
      t.shells++;
    }
    m.stats[t.i].shots += shots.length;
    m.events.push({ t: 'fire', i: t.i, x: t.x, y: t.y, a: t.a, fast, triple: shots.length > 1 });
    t.power = null;
  }

  function drive(m, t, turn, go, dt) {
    t.a += turn * 3.2 * dt;
    const sp = go * (go > 0 ? 2.1 : 1.4) * dt;
    const nx = t.x + Math.cos(t.a) * sp, ny = t.y + Math.sin(t.a) * sp;
    const bx = t.x, by = t.y;
    if (!hitsWall(m, nx, t.y, R)) t.x = nx;
    if (!hitsWall(m, t.x, ny, R)) t.y = ny;
    const moved = Math.abs(t.x + t.y - bx - by) > 0.0005;
    t.speed = Math.hypot(t.x - bx, t.y - by) / dt * (go < 0 ? -1 : 1);
    return moved;
  }

  // Which neighbouring cells are open to each other (worked out once per maze).
  function passages(m) {
    if (m._pass && m._pass.id === m.mazeId) return m._pass;
    const open = (c, r, dc, dr) => {
      const c2 = c + dc, r2 = r + dr;
      if (c2 < 0 || r2 < 0 || c2 >= COLS || r2 >= ROWS) return false;
      return !hitsWall(m, dc ? Math.max(c, c2) : c + 0.5, dr ? Math.max(r, r2) : r + 0.5, 0.03);
    };
    const p = { id: m.mazeId, open };
    p.cache = {};
    m._pass = p;
    return p;
  }
  // Breadth-first route from one cell to another; returns the next cell to head for.
  function nextCell(m, c0, r0, c1, r1) {
    const p = passages(m);
    if (c0 === c1 && r0 === r1) return null;
    const prev = new Int16Array(COLS * ROWS).fill(-1);
    const q = [c0 + r0 * COLS];
    prev[q[0]] = q[0];
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (q.length) {
      const cur = q.shift(), c = cur % COLS, r = (cur / COLS) | 0;
      if (c === c1 && r === r1) break;
      for (const d of DIRS) {
        const k = (c + d[0]) + (r + d[1]) * COLS;
        const key = cur + ':' + k;
        let ok = p.cache[key];
        if (ok === undefined) ok = p.cache[key] = p.open(c, r, d[0], d[1]);
        if (ok && prev[k] === -1) { prev[k] = cur; q.push(k); }
      }
    }
    let k = c1 + r1 * COLS;
    if (prev[k] === -1) return null;
    while (prev[k] !== c0 + r0 * COLS) k = prev[k];
    return { c: k % COLS, r: (k / COLS) | 0 };
  }
  // Trace a shell fired at angle a; returns 1 if it would hit `foe`, -1 if it
  // would come back and hit the shooter first, 0 otherwise.
  function traceShot(m, t, a, foe) {
    let x = t.x + Math.cos(a) * (R + 0.08), y = t.y + Math.sin(a) * (R + 0.08);
    let vx = Math.cos(a) * 0.08, vy = Math.sin(a) * 0.08, bounces = 0;
    for (let i = 0; i < 110; i++) {
      x += vx; if (hitsWall(m, x, y, 0.05)) { x -= vx; vx = -vx; bounces++; }
      y += vy; if (hitsWall(m, x, y, 0.05)) { y -= vy; vy = -vy; bounces++; }
      if (bounces > 2) return 0;
      if (Math.hypot(foe.x - x, foe.y - y) < R + 0.02) return 1;
      if (i > 6 && Math.hypot(t.x - x, t.y - y) < R + 0.12) return -1;
    }
    return 0;
  }

  // Computer tanks: hunt the nearest tank through the maze, shoot when lined
  // up (directly, or off a wall on higher skills) and dodge incoming shells.
  function think(m, t, dt) {
    const rand = m.rand;
    let target = null, best = 1e9;
    for (const o of m.tanks) {
      if (!o.alive || o === t) continue;
      const d = Math.hypot(o.x - t.x, o.y - t.y);
      if (d < best) { best = d; target = o; }
    }
    let turn = 0, go = 1;
    const skill = BT.clamp(m.skill | 0, 0, 2), sk = SKILL[skill];
    const face = (ang) => { let d = ang - t.a; d = Math.atan2(Math.sin(d), Math.cos(d)); return d; };
    // Shell close and closing? Side-step.
    let threat = null;
    for (const s of m.shells) {
      if (s.owner === t && s.age < 0.3) continue;
      const dx = t.x - s.x, dy = t.y - s.y, d = Math.hypot(dx, dy);
      if (d < 1.1 && (dx * s.vx + dy * s.vy) > 0) { threat = s; break; }
    }
    if (target && clearLine(m, t, target)) {
      t.seen = (t.seen || 0) + dt;
      const diff = face(Math.atan2(target.y - t.y, target.x - t.x));
      turn = BT.clamp(diff * 3, -1, 1) * sk.turn;
      go = Math.abs(diff) < 0.5 ? 0.4 : 0;
      if (Math.abs(diff) < sk.aim && m.roundT > 1.2 && t.seen > sk.wait) fire(m, t);
    } else if (target) {
      t.seen = 0;
      t.plan -= dt;
      // Look for a bank shot now and then (not on easy).
      if (skill > 0 && t.cool <= 0 && m.roundT > 1.5 && t.plan <= 0) {
        if (traceShot(m, t, t.a, target) === 1) fire(m, t);
      }
      if (t.plan <= 0) {
        t.plan = 0.35 + rand() * 0.25;
        t.wp = nextCell(m, Math.floor(t.x), Math.floor(t.y), Math.floor(target.x), Math.floor(target.y));
        if (skill > 0 && rand() < 0.35 * skill) {
          // sweep for a one or two cushion shot and remember the best angle
          let bestA = null;
          for (let k = 0; k < 20; k++) {
            const a = t.a + (k - 10) * 0.08;
            if (traceShot(m, t, a, target) === 1) { bestA = a; break; }
          }
          t.bank = bestA;
        } else t.bank = null;
      }
      if (t.bank !== null && t.bank !== undefined) {
        const diff = face(t.bank);
        turn = BT.clamp(diff * 4, -1, 1); go = 0;
        if (Math.abs(diff) < 0.04 && t.cool <= 0) { if (traceShot(m, t, t.a, target) === 1) fire(m, t); t.bank = null; }
      } else if (t.wp) {
        const diff = face(Math.atan2(t.wp.r + 0.5 - t.y, t.wp.c + 0.5 - t.x));
        turn = BT.clamp(diff * 3, -1, 1);
        go = Math.abs(diff) < 0.7 ? 1 : 0;
      } else {
        t.turn -= dt;
        if (t.turn <= 0) { t.turn = 0.4 + rand() * 1.2; t.dir = rand.pick([-1, 0, 0, 1]); }
        turn = t.dir;
      }
      if (t.stuck > 0.3) { turn = 1; go = -0.6; }
    }
    if (threat && skill > 0) {
      const side = face(Math.atan2(threat.vy, threat.vx) + Math.PI / 2);
      turn = BT.clamp(side * 3, -1, 1); go = Math.abs(side) < 1.2 ? 1 : -1;
    }
    const moved = drive(m, t, turn, go, dt);
    t.stuck = moved || go === 0 ? 0 : t.stuck + dt;
  }

  // intents[i] = { turn: -1..1, go: -1..1, fire: bool } for human seats.
  function step(m, dt, intents) {
    m.time += dt; m.phaseT += dt;
    for (const t of m.tanks) { t.recoil = Math.max(0, t.recoil - dt * 5); if (!t.alive) t.boom += dt; }

    if (m.phase === 'countdown') {
      const n = 3 - Math.floor(m.phaseT / COUNT_STEP);
      if (n !== m.count) { m.count = n; m.events.push(n > 0 ? { t: 'count', n } : { t: 'go' }); }
      if (n <= 0) { m.phase = 'play'; m.phaseT = 0; }
      return;
    }
    if (m.phase === 'score') {
      if (m.phaseT > 2.1) {
        if (m.champ >= 0) { m.phase = 'over'; m.phaseT = 0; m.events.push({ t: 'over', champ: m.champ }); } else newRound(m);
      }
      return;
    }
    if (m.phase === 'over') return;

    m.roundT += dt;
    for (const t of m.tanks) {
      if (!t.alive) continue;
      t.cool = Math.max(0, t.cool - dt);
      if (t.bot) think(m, t, dt);
      else {
        const k = (intents && intents[t.i]) || {};
        drive(m, t, BT.clamp(k.turn || 0, -1, 1), BT.clamp(k.go || 0, -1, 1), dt);
        if (k.fire) fire(m, t);
      }
      const p = m.pickup;
      if (p && Math.hypot(p.x - t.x, p.y - t.y) < R + 0.2) {
        t.power = p.type; m.pickup = null; m.pickupAt = m.time + 7;
        m.events.push({ t: 'pickup', i: t.i, type: p.type, x: p.x, y: p.y });
      }
    }
    if (!m.pickup && m.time > m.pickupAt) {
      m.pickup = { x: m.rand.int(0, COLS - 1) + 0.5, y: m.rand.int(0, ROWS - 1) + 0.5, type: m.rand.pick(['triple', 'laser']), born: m.time };
      m.events.push({ t: 'crate', x: m.pickup.x, y: m.pickup.y });
    }

    for (const s of m.shells) {
      s.life -= dt; s.age += dt;
      const steps = s.fast ? 4 : 2;
      for (let i = 0; i < steps; i++) {
        s.x += (s.vx * dt) / steps;
        if (hitsWall(m, s.x, s.y, 0.05)) { s.x -= (s.vx * dt) / steps; s.vx = -s.vx; bounce(m, s); }
        s.y += (s.vy * dt) / steps;
        if (hitsWall(m, s.x, s.y, 0.05)) { s.y -= (s.vy * dt) / steps; s.vy = -s.vy; bounce(m, s); }
      }
      for (const t of m.tanks) {
        if (s.life <= 0 || !t.alive || (t === s.owner && s.age < 0.3)) continue;
        if (Math.hypot(t.x - s.x, t.y - s.y) < R + 0.04) {
          t.alive = false; t.boom = 0; s.life = 0;
          const own = t === s.owner;
          if (own) m.stats[t.i].own++; else m.stats[s.owner.i].hits++;
          m.events.push({ t: 'boom', i: t.i, by: s.owner.i, own, x: t.x, y: t.y, a: t.a, bounces: s.bounces });
        }
      }
    }
    m.shells = m.shells.filter((s) => {
      if (s.life <= 0) { s.owner.shells = Math.max(0, s.owner.shells - 1); m.events.push({ t: 'fizzle', x: s.x, y: s.y, fast: s.fast }); }
      return s.life > 0;
    });

    let alive = 0, last = null;
    for (const t of m.tanks) if (t.alive) { alive++; last = t; }
    // Optional round limit (used by the attract demo and headless tests only).
    if (m.timeLimit && m.roundT > m.timeLimit && alive > 1) {
      for (const t of m.tanks) t.alive = false;
      alive = 0; m.endT = 99;
    }
    if (alive <= 1) {
      m.endT += dt;
      if (m.endT > 1.6) {
        m.lastWinner = alive ? last.i : -1;
        if (alive) m.score[last.i]++;
        m.champ = m.score.findIndex((s) => s >= m.target);
        m.phase = 'score'; m.phaseT = 0;
        m.events.push({ t: 'roundEnd', winner: m.lastWinner, champ: m.champ });
      }
    }
  }
  function bounce(m, s) {
    s.bounces++;
    m.stats[s.owner.i].bounces++;
    m.events.push({ t: 'bounce', x: s.x, y: s.y, fast: s.fast });
  }

  BT.Sim = { COLS, ROWS, T, R, COUNT_STEP, create, step, hitsWall, clearLine };
})();
