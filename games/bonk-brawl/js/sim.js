// Bonk Brawl rules. No drawing or browser APIs, so a whole match also runs
// under Node (tools/match-test.js).
//
// Every hit raises a fighter's damage, and the higher it is the further the
// next hit sends them. Leave the screen and you lose a life. Last one
// standing wins. Light hits are quick; heavy hits wind up but launch.
(function () {
  const VW = 16, VH = 9, GRAV = 40;
  const COUNT_STEP = 0.7;

  function create(opts) {
    const stage = BB.STAGES[opts.stage | 0];
    const m = {
      VW, VH, stage, stageIndex: opts.stage | 0, rand: BB.rng(opts.seed), skill: opts.skill === undefined ? 1 : opts.skill,
      lives: opts.lives || 3, time: 0, events: [], phase: 'countdown', phaseT: 0, count: 4, freeze: 0, winner: -1,
      fighters: [], timeLimit: opts.timeLimit || 0,
    };
    const n = opts.seats.length;
    m.fighters = opts.seats.map((s, i) => ({
      i, slot: s.slot === undefined ? i : s.slot, c: BB.FIGHTERS[s.fighter | 0], bot: !!s.bot,
      stocks: m.lives, out: false, place: 0,
      stats: { kos: 0, falls: 0, dealt: 0, taken: 0, hits: 0, best: 0 },
      lastHitBy: -1, lastHitT: -9,
    }));
    m.fighters.forEach((f, i) => spawn(m, f, 5 + (i * 6) / Math.max(1, n - 1), 0));
    return m;
  }

  function spawn(m, f, x, safe) {
    Object.assign(f, {
      x: x === undefined ? 8 : x, y: 1.5, vx: 0, vy: 0, face: f.i % 2 ? -1 : 1, dmg: 0, jumps: 0, ground: false,
      atk: null, stun: 0, safe: safe === undefined ? 2 : safe, think: 0, drop: 0, landT: 0, airT: 0, runT: 0, hurtT: 0, tumble: 0,
    });
  }

  function attack(m, f, heavy) {
    if (f.atk || f.stun > 0) return;
    f.atk = { heavy, t: 0, hit: false, at: heavy ? 0.28 : 0.08, end: heavy ? 0.55 : 0.25, landed: false };
    m.events.push({ t: 'swing', i: f.i, heavy });
  }

  function land(m, f, prevY) {
    const was = f.ground;
    f.ground = false;
    for (const p of m.stage.plats) {
      const px = p[0], py = p[1], pw = p[2], solid = p[3];
      if (f.x < px - 0.2 || f.x > px + pw + 0.2) continue;
      if (f.vy >= 0 && prevY <= py + 0.001 && f.y >= py && !(f.drop > 0 && !solid)) {
        if (!was && f.airT > 0.15) m.events.push({ t: 'land', i: f.i, x: f.x, y: py, hard: f.vy > 14 });
        f.y = py; f.vy = 0; f.ground = true; f.jumps = 0;
      }
    }
  }

  const onStage = (m, x) => m.stage.plats.some((p) => x > p[0] && x < p[0] + p[2]);

  // Computer fighters: chase the nearest rival, swing when close, get back
  // to the stage when knocked off.
  function botControl(m, f, dt) {
    const rand = m.rand, sk = BB.clamp(m.skill | 0, 0, 2);
    const k = { x: 0, jump: false, down: false, light: false, heavy: false };
    f.think -= dt;
    let foe = null, best = 1e9;
    for (const o of m.fighters) {
      if (o === f || o.out) continue;
      const d = Math.abs(o.x - f.x) + Math.abs(o.y - f.y) * 0.5;
      if (d < best) { best = d; foe = o; }
    }
    const off = !onStage(m, f.x);
    if (off || f.y > m.stage.plats[0][1] + 0.6) {
      // recover: head for the nearest platform and jump when falling
      let tx = 8, bd = 1e9;
      for (const p of m.stage.plats) { const cx = p[0] + p[2] / 2, d = Math.abs(cx - f.x); if (d < bd) { bd = d; tx = cx; } }
      k.x = f.x < tx ? 1 : -1;
      k.jump = f.vy > (sk === 0 ? 4 : 2) && f.jumps < 2;
      return k;
    }
    if (foe) {
      const dx = foe.x - f.x, dy = foe.y - f.y;
      const reach = sk === 0 ? 1.0 : 1.3;
      k.x = Math.abs(dx) > 0.9 ? Math.sign(dx) : 0;
      // don't walk off the edge chasing someone who is off-stage
      if (k.x && !onStage(m, f.x + k.x * 0.8) && f.ground) k.x = 0;
      if (Math.abs(dx) < reach && Math.abs(dy) < 1.2 && f.think <= 0) {
        f.face = Math.sign(dx) || f.face;
        const heavyChance = 0.15 + sk * 0.1 + Math.min(0.3, foe.dmg / 300);
        k.heavy = rand() < heavyChance; k.light = !k.heavy;
        f.think = [0.75, 0.42, 0.25][sk] + rand() * [0.5, 0.4, 0.2][sk];
      }
      if (dy < -1.4 && f.ground && rand() < 0.05 + sk * 0.03) k.jump = true;
      if (dy > 1.4 && f.ground && rand() < 0.03) k.down = true;
    }
    return k;
  }

  // intents[i] = { x: -1..1, jump, down, light, heavy } for human fighters.
  function step(m, dt, intents) {
    m.time += dt; m.phaseT += dt;
    if (m.phase === 'countdown') {
      const n = 3 - Math.floor(m.phaseT / COUNT_STEP);
      if (n !== m.count) { m.count = n; m.events.push(n > 0 ? { t: 'count', n } : { t: 'go' }); }
      // fighters drop in and can shuffle but not attack yet
      for (const f of m.fighters) physics(m, f, { x: 0 }, dt, true);
      if (n <= 0) { m.phase = 'fight'; m.phaseT = 0; }
      return;
    }
    if (m.phase === 'over') return;
    if (m.freeze > 0) { m.freeze -= dt; return; }

    const slowmo = m.phase === 'game';
    for (const f of m.fighters) {
      if (f.out) continue;
      f.stun = Math.max(0, f.stun - dt); f.safe = Math.max(0, f.safe - dt); f.drop = Math.max(0, f.drop - dt);
      let k = { x: 0 };
      if (!slowmo) k = f.bot ? botControl(m, f, dt) : (intents && intents[f.i]) || { x: 0 };
      physics(m, f, k, dt, false);

      if (f.atk) {
        f.atk.t += dt;
        if (!f.atk.hit && f.atk.t >= f.atk.at) {
          f.atk.hit = true;
          const heavy = f.atk.heavy, reach = heavy ? 1.15 : 0.85, hx = f.x + f.face * reach * 0.8, hy = f.y - 0.6;
          for (const o of m.fighters) {
            if (o === f || o.out || o.safe > 0) continue;
            if (Math.hypot(o.x - hx, o.y - 0.6 - hy) > reach) continue;
            const add = heavy ? 14 : 6;
            o.dmg += add;
            const kb = ((heavy ? 7 : 3.5) + o.dmg * (heavy ? 0.16 : 0.07)) * f.c.power / o.c.weight;
            o.vx = f.face * kb; o.vy = -kb * 0.75; o.stun = Math.min(0.9, kb * 0.035); o.ground = false;
            o.hurtT = 0; o.tumble = kb > 11 ? 1 : 0;
            o.lastHitBy = f.i; o.lastHitT = m.time;
            f.atk.landed = true;
            f.stats.dealt += add; f.stats.hits++; o.stats.taken += add;
            f.stats.best = Math.max(f.stats.best, Math.round(kb * 10));
            m.freeze = Math.max(m.freeze, (heavy ? 0.07 : 0.035) + Math.min(0.12, kb * 0.006));
            m.events.push({ t: 'hit', by: f.i, to: o.i, heavy, kb, dmg: o.dmg, x: (f.x + o.x) / 2, y: o.y - 0.6, dir: f.face });
          }
          if (!f.atk.landed) m.events.push({ t: 'whiff', i: f.i, heavy });
        }
        if (f.atk && f.atk.t >= f.atk.end) f.atk = null;
      }
      // off the page
      if (f.x < -3 || f.x > VW + 3 || f.y > VH + 4 || f.y < -6) {
        if (m.phase === 'game') { spawn(m, f, 8); continue; } // the winner's victory lap
        f.stocks--;
        f.stats.falls++;
        const by = m.time - f.lastHitT < 6 ? f.lastHitBy : -1;
        if (by >= 0) m.fighters[by].stats.kos++;
        m.events.push({ t: 'ko', i: f.i, by, x: BB.clamp(f.x, 0, VW), y: BB.clamp(f.y, 0, VH), side: f.x < -3 ? 'left' : f.x > VW + 3 ? 'right' : f.y > VH + 4 ? 'bottom' : 'top', left: f.stocks });
        if (f.stocks <= 0) {
          f.out = true;
          f.place = m.fighters.filter((o) => !o.out).length + 1;
          m.events.push({ t: 'out', i: f.i });
        } else { spawn(m, f, 8); m.events.push({ t: 'respawn', i: f.i }); }
      }
    }
    if (m.timeLimit && m.time > m.timeLimit && m.phase === 'fight') {
      // headless test safety valve only: the most stocks then least damage wins
      const alive = m.fighters.filter((o) => !o.out).sort((a, b) => b.stocks - a.stocks || a.dmg - b.dmg);
      alive.slice(1).forEach((o) => { o.out = true; o.place = 2; });
    }
    const left = m.fighters.filter((f) => !f.out);
    if (m.phase === 'fight' && left.length <= 1) {
      m.phase = 'game'; m.phaseT = 0;
      m.winner = left.length ? left[0].i : -1;
      if (left[0]) left[0].place = 1;
      m.events.push({ t: 'game', winner: m.winner });
    }
    if (m.phase === 'game' && m.phaseT > 2.6) { m.phase = 'over'; m.phaseT = 0; m.events.push({ t: 'over', winner: m.winner }); }
  }

  function physics(m, f, k, dt, noAttack) {
    if (f.out) return;
    f.hurtT += dt;
    if (f.stun <= 0) {
      if (k.x) f.face = k.x > 0 ? 1 : -1;
      const accel = f.ground ? 60 : 30;
      f.vx += (k.x * f.c.speed - f.vx) * Math.min(1, (accel * dt) / f.c.speed);
      if (k.jump && f.jumps < 2) {
        f.vy = -f.c.jump * (f.jumps ? 0.85 : 1); f.jumps++; f.ground = false;
        m.events.push({ t: 'jump', i: f.i, double: f.jumps > 1, x: f.x, y: f.y });
      }
      if (k.down) { f.drop = 0.2; if (!f.ground) f.vy += 30 * dt; }
      if (!noAttack) { if (k.light) attack(m, f, false); if (k.heavy) attack(m, f, true); }
    }
    const floaty = f.c.id === 'zephyr' && f.vy > 0 ? 0.6 : 1;
    f.vy += GRAV * floaty * dt;
    const prevY = f.y;
    f.x += f.vx * dt; f.y += f.vy * dt;
    land(m, f, prevY);
    if (f.ground) { f.airT = 0; f.runT += Math.abs(f.vx) * dt; } else f.airT += dt;
  }

  BB.Sim = { VW, VH, COUNT_STEP, create, step, onStage };
})();
