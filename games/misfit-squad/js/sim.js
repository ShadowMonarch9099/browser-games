// Misfit Squad rules. No drawing or browser APIs, so a whole 15-wave run can
// be played by computer heroes under Node (tools/run-test.js).
//
// 1 to 4 heroes hold the station against 15 waves of robots. Heroes aim and
// shoot by themselves; players move and fire each hero's special. Stand next
// to a fallen teammate to revive them. Pick one squad upgrade after each wave.
(function () {
  const VW = 16, VH = 9, WAVES = 15, REVIVE = 2.2;

  function create(opts) {
    const m = {
      VW, VH, WAVES, rand: MS.rng(opts.seed), time: 0, events: [],
      mods: { dmg: 1, rate: 1, hp: 0, speed: 1, cool: 1, pierce: 0, range: 1 },
      heroes: [], foes: [], shots: [], mines: [], rings: [], wave: 0, queue: [], spawnT: 0,
      phase: 'intro', phaseT: 0, picks: null, secondWind: false, result: null, kills: 0,
    };
    m.heroes = opts.seats.map((s, i) => {
      const c = MS.HEROES[s.hero];
      return {
        i, c, hero: s.hero, slot: s.slot === undefined ? i : s.slot, bot: !!s.bot,
        x: 8 - (opts.seats.length - 1) * 0.5 + i, y: 4.5, hp: c.hp, max: c.hp, down: false, fire: 0, cool: 2, revive: 0, face: -Math.PI / 2,
        vx: 0, vy: 0, walk: 0, recoil: 0, hurt: 0, plan: 0, gx: 8, gy: 4.5,
        stats: { kills: 0, dealt: 0, revives: 0, specials: 0, downs: 0 },
      };
    });
    nextWave(m);
    return m;
  }

  function nextWave(m) {
    m.wave++;
    m.queue = [];
    const n = 5 + m.wave * 3 + m.heroes.length * 2;
    for (let i = 0; i < n; i++) {
      const r = m.rand();
      m.queue.push(m.wave > 2 && r < 0.2 ? 'zip' : m.wave > 4 && r < 0.2 + Math.min(0.25, m.wave * 0.02) ? 'brute' : 'grunt');
    }
    if (m.wave % 5 === 0) m.queue.splice(Math.floor(n / 2), 0, 'boss');
    m.spawnT = 1.5; m.secondWind = m.heroes.length === 1;
    m.heroes.forEach((h) => { h.max = h.c.hp + m.mods.hp; });
    m.phase = 'wave'; m.phaseT = 0;
    m.events.push({ t: 'wave', n: m.wave, boss: m.wave % 5 === 0 });
  }

  function spawnFoe(m, type) {
    const rand = m.rand, side = rand.int(0, 3), b = MS.BOTS[type];
    const x = side === 0 ? -0.6 : side === 1 ? VW + 0.6 : rand() * VW, y = side === 2 ? -0.6 : side === 3 ? VH + 0.6 : rand() * VH;
    const hp = b.hp * (1 + m.wave * 0.08) * (type === 'boss' ? 1 + m.wave / 10 : 1);
    const f = { type, b, x, y, hp, max: hp, hit: 0, side, id: m.time + rand(), walk: rand() * 6, atk: 0 };
    m.foes.push(f);
    m.events.push({ t: type === 'boss' ? 'boss' : 'spawn', x, y, side, type });
  }

  function special(m, h) {
    if (h.cool > 0 || h.down) return;
    h.cool = 7 * m.mods.cool;
    h.stats.specials++;
    const role = h.c.role;
    m.events.push({ t: 'special', i: h.i, role, x: h.x, y: h.y, a: h.face });
    if (role === 'Tank') {
      m.rings.push({ x: h.x, y: h.y, r: 2.6, t: 0, color: h.c.color });
      for (const f of m.foes) {
        const d = Math.hypot(f.x - h.x, f.y - h.y);
        if (d < 2.6 && d > 0) { f.x += ((f.x - h.x) / d) * 2.2; f.y += ((f.y - h.y) / d) * 2.2; damage(m, f, 18 * m.mods.dmg, h); f.hit = 0.15; }
      }
    } else if (role === 'Medic') {
      m.rings.push({ x: h.x, y: h.y, r: 3.2, t: 0, color: h.c.color });
      for (const o of m.heroes) if (!o.down && Math.hypot(o.x - h.x, o.y - h.y) < 3.2) { o.hp = Math.min(o.max, o.hp + 40); m.events.push({ t: 'healed', i: o.i, x: o.x, y: o.y }); }
    } else if (role === 'Trapper') {
      m.mines.push({ x: h.x, y: h.y, t: 0, owner: h });
    } else {
      const a = h.face;
      m.shots.push({ x: h.x, y: h.y, vx: Math.cos(a) * 16, vy: Math.sin(a) * 16, dmg: 70 * m.mods.dmg, pierce: 99, life: 1.2, big: true, color: h.c.color, owner: h });
      h.recoil = 1;
    }
  }

  function damage(m, f, amount, h) {
    const before = f.hp;
    f.hp -= amount;
    if (h) h.stats.dealt += Math.min(before, amount);
    if (before > 0 && f.hp <= 0) {
      if (h) h.stats.kills++;
      m.kills++;
      m.events.push({ t: 'scrap', x: f.x, y: f.y, type: f.type });
    }
  }

  // Computer heroes: keep their distance, stick with the squad, revive the
  // fallen and fire specials when they would do some good.
  function botIntent(m, h, dt) {
    const k = { x: 0, y: 0, special: false };
    let near = null, nd = 1e9, crowd = 0;
    for (const f of m.foes) { const d = Math.hypot(f.x - h.x, f.y - h.y); if (d < nd) { nd = d; near = f; } if (d < 2.3) crowd++; }
    const fallen = m.heroes.find((o) => o !== h && o.down);
    let tx = 8, ty = 4.5, n = 0;
    for (const o of m.heroes) if (!o.down) { tx += o.x; ty += o.y; n++; }
    tx /= n + 1; ty /= n + 1;
    let gx = tx, gy = ty;
    if (fallen && nd > 1.2) { gx = fallen.x; gy = fallen.y; }
    let dx = gx - h.x, dy = gy - h.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.6) { k.x = dx / dist; k.y = dy / dist; }
    if (near && nd < 2.6 && !(fallen && Math.hypot(fallen.x - h.x, fallen.y - h.y) < 1.2)) {
      // back away from the closest robot, sliding sideways a little
      const ax = h.x - near.x, ay = h.y - near.y, ad = Math.hypot(ax, ay) || 1;
      k.x = ax / ad + (-ay / ad) * 0.4; k.y = ay / ad + (ax / ad) * 0.4;
    }
    // stay off the walls
    if (h.x < 1.5) k.x += 0.8; if (h.x > VW - 1.5) k.x -= 0.8; if (h.y < 1.2) k.y += 0.8; if (h.y > VH - 1.2) k.y -= 0.8;
    const role = h.c.role;
    if (role === 'Tank') k.special = crowd >= 3;
    else if (role === 'Medic') k.special = m.heroes.some((o) => !o.down && o.hp < o.max * 0.6 && Math.hypot(o.x - h.x, o.y - h.y) < 3.2);
    else if (role === 'Trapper') k.special = nd < 3;
    else k.special = !!near && nd < 6 && (m.foes.length > 4 || near.type === 'boss' || near.type === 'brute');
    return k;
  }

  // intents[i] = { x, y (-1..1), special: bool } for human heroes.
  function step(m, dt, intents) {
    m.time += dt; m.phaseT += dt;
    for (const r of m.rings) r.t += dt;
    m.rings = m.rings.filter((r) => r.t < 0.4);
    if (m.phase === 'pick' || m.phase === 'won' || m.phase === 'lost') return;

    // robots arrive a few at a time
    m.spawnT -= dt;
    if (m.queue.length && m.spawnT <= 0) { spawnFoe(m, m.queue.shift()); m.spawnT = Math.max(0.25, 1.1 - m.wave * 0.05); }

    for (const h of m.heroes) {
      h.recoil = Math.max(0, h.recoil - dt * 5); h.hurt = Math.max(0, h.hurt - dt);
      if (h.down) {
        const helper = m.heroes.find((o) => o !== h && !o.down && Math.hypot(o.x - h.x, o.y - h.y) < 1.2);
        h.revive = helper ? h.revive + dt : Math.max(0, h.revive - dt);
        if (h.revive > REVIVE) {
          h.down = false; h.hp = h.max * 0.5; h.revive = 0;
          if (helper) helper.stats.revives++;
          m.events.push({ t: 'revive', i: h.i, by: helper ? helper.i : -1, x: h.x, y: h.y });
        }
        continue;
      }
      const k = h.bot ? botIntent(m, h, dt) : (intents && intents[h.i]) || { x: 0, y: 0 };
      let mx = k.x || 0, my = k.y || 0;
      const n = Math.hypot(mx, my);
      if (n > 1) { mx /= n; my /= n; }
      const sp = h.c.speed * m.mods.speed;
      h.vx = mx * sp; h.vy = my * sp;
      h.x = MS.clamp(h.x + h.vx * dt, 0.4, VW - 0.4);
      h.y = MS.clamp(h.y + h.vy * dt, 0.4, VH - 0.4);
      h.walk += Math.hypot(h.vx, h.vy) * dt;
      h.cool = Math.max(0, h.cool - dt); h.fire -= dt;
      const range = 6.5 * m.mods.range;
      let target = null, td = range;
      for (const f of m.foes) { const d = Math.hypot(f.x - h.x, f.y - h.y); if (d < td) { td = d; target = f; } }
      if (target) {
        h.face = Math.atan2(target.y - h.y, target.x - h.x);
        if (h.fire <= 0) {
          h.fire = h.c.rate * m.mods.rate; h.recoil = 0.6;
          m.shots.push({ x: h.x, y: h.y, vx: Math.cos(h.face) * 11, vy: Math.sin(h.face) * 11, dmg: h.c.dmg * m.mods.dmg, pierce: m.mods.pierce, life: range / 11, color: h.c.color, owner: h });
          m.events.push({ t: 'shot', i: h.i, x: h.x, y: h.y, a: h.face });
        }
      } else if (n > 0.1) h.face = Math.atan2(my, mx);
      if (k.special) special(m, h);
    }

    for (const s of m.shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      for (const f of m.foes) {
        if (s.life <= 0 || f.hp <= 0 || (s.seen && s.seen.indexOf(f) >= 0)) continue;
        if (Math.hypot(f.x - s.x, f.y - s.y) < f.b.r + (s.big ? 0.3 : 0.1)) {
          damage(m, f, s.dmg, s.owner); f.hit = 0.1;
          (s.seen = s.seen || []).push(f);
          m.events.push({ t: 'hit', x: s.x, y: s.y, big: !!s.big, color: s.color });
          if (s.pierce-- <= 0) s.life = 0;
        }
      }
    }
    m.shots = m.shots.filter((s) => s.life > 0);

    for (const mi of m.mines) {
      mi.t += dt;
      if (mi.t > 0.6 && m.foes.some((f) => Math.hypot(f.x - mi.x, f.y - mi.y) < 0.8)) {
        mi.boom = true; m.rings.push({ x: mi.x, y: mi.y, r: 1.9, t: 0, color: '#b57bff' });
        for (const f of m.foes) if (Math.hypot(f.x - mi.x, f.y - mi.y) < 1.9) { damage(m, f, 55 * m.mods.dmg, mi.owner); f.hit = 0.15; }
        m.events.push({ t: 'mine', x: mi.x, y: mi.y });
      }
    }
    m.mines = m.mines.filter((mi) => !mi.boom);

    const standing = m.heroes.filter((h) => !h.down);
    for (const f of m.foes) {
      f.hit = Math.max(0, f.hit - dt); f.atk = Math.max(0, f.atk - dt);
      let t = null, td = 1e9;
      for (const h of standing) { const d = Math.hypot(h.x - f.x, h.y - f.y); if (d < td) { td = d; t = h; } }
      if (!t) continue;
      const d = td || 1;
      if (d > f.b.r + 0.3) { f.x += ((t.x - f.x) / d) * f.b.speed * dt; f.y += ((t.y - f.y) / d) * f.b.speed * dt; f.walk += f.b.speed * dt; f.face = Math.atan2(t.y - f.y, t.x - f.x); }
      else {
        t.hp -= f.b.dmg * dt; t.hurt = 0.15; f.atk = 0.2;
        if (t.hp <= 0) {
          if (m.secondWind) {
            m.secondWind = false; t.hp = t.max * 0.5;
            m.rings.push({ x: t.x, y: t.y, r: 3, t: 0, color: '#ffffff' });
            for (const o of m.foes) if (Math.hypot(o.x - t.x, o.y - t.y) < 3) { o.x += (o.x - t.x) * 1.2; o.y += (o.y - t.y) * 1.2; }
            m.events.push({ t: 'secondWind', i: t.i, x: t.x, y: t.y });
          } else {
            t.down = true; t.hp = 0; t.revive = 0; t.stats.downs++;
            m.events.push({ t: 'down', i: t.i, x: t.x, y: t.y });
            standing.splice(standing.indexOf(t), 1);
          }
        }
      }
      if (f.type === 'boss' && m.rand() < dt * 0.5) spawnFoe(m, 'grunt');
    }
    m.foes = m.foes.filter((f) => f.hp > 0);

    if (m.heroes.every((h) => h.down)) { m.phase = 'lost'; m.phaseT = 0; m.result = { won: false, wave: m.wave }; m.events.push({ t: 'lost', wave: m.wave }); return; }
    if (!m.queue.length && !m.foes.length) {
      if (m.wave >= WAVES) { m.phase = 'won'; m.phaseT = 0; m.result = { won: true, wave: m.wave }; m.events.push({ t: 'won' }); return; }
      m.phase = 'pick'; m.phaseT = 0;
      m.picks = m.rand.shuffle(MS.UPGRADES.map((_, i) => i)).slice(0, 3);
      m.shots.length = 0;
      m.events.push({ t: 'clear', n: m.wave });
    }
  }

  // Apply the chosen upgrade (index into m.picks) and start the next wave.
  function choose(m, k) {
    if (m.phase !== 'pick') return;
    const up = MS.UPGRADES[m.picks[k]];
    up.apply(m);
    m.events.push({ t: 'upgrade', name: up.name });
    m.picks = null;
    nextWave(m);
  }

  MS.Sim = { VW, VH, WAVES, REVIVE, create, step, choose };
})();
