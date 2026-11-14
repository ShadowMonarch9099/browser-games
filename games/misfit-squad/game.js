// Misfit Squad: 1 to 4 heroes hold a room against 15 waves of robots. Heroes
// aim and shoot by themselves; you move and use each hero's special. Stand
// next to a fallen teammate to revive them. Pick one upgrade after each wave.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  const save = Arcade.save('misfit-squad');

  const DISPLAY = '"Audiowide", "Trebuchet MS", sans-serif';
  const BODY = '"Exo 2", "Segoe UI", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Misfit Squad',
    tagline: 'Four odd heroes. Fifteen waves of robots.',
    how: [['Move', 'WASD  ·  arrows  ·  IJKL  ·  number pad  ·  gamepads'], ['Special', 'F  ·  Enter  ·  O  ·  pad A'], ['Shooting', 'Automatic, at the nearest robot'], ['Fallen friend', 'Stand beside them to revive']],
    // Misfit Squad's own look: a cartoon space lab. Teal panels, orange warning lights.
    theme: {
      fonts: 'family=Audiowide&family=Exo+2:wght@500;700',
      display: DISPLAY, body: BODY,
      overlay: 'rgba(4, 30, 38, .84)',
      panel: '#0f4c5c', panel2: '#0b3c49', edge: '#5fd3c4',
      text: '#eafffb', muted: '#9fd6cd',
      accent: '#f9a03f', accentInk: '#1a1200',
      radius: '18px 4px 18px 4px', border: '2px',
      shadow: '0 0 30px rgba(95, 211, 196, .35)', buttonShadow: 'none',
      titleSize: 'clamp(1.7rem, 7.5vw, 2.3rem)',
    },
  });

  const VW = 16, VH = 9, WAVES = 15;
  const HEROES = [
    { name: 'Brick', role: 'Tank', color: '#f9a03f', hp: 170, speed: 3.2, rate: 0.5, dmg: 9, special: 'Shove' },
    { name: 'Patch', role: 'Medic', color: '#7ae582', hp: 95, speed: 4, rate: 0.4, dmg: 7, special: 'Heal' },
    { name: 'Snare', role: 'Trapper', color: '#c77dff', hp: 105, speed: 4, rate: 0.45, dmg: 8, special: 'Mine' },
    { name: 'Dot', role: 'Sharpshooter', color: '#4cc9f0', hp: 85, speed: 4.3, rate: 0.75, dmg: 20, special: 'Big shot' },
  ];
  const BOTS = {
    grunt: { hp: 22, speed: 1.7, dmg: 9, r: 0.3, color: '#e56b6f' },
    zip: { hp: 10, speed: 3.4, dmg: 6, r: 0.22, color: '#ffd166' },
    brute: { hp: 90, speed: 1.1, dmg: 20, r: 0.48, color: '#b56576' },
    boss: { hp: 520, speed: 0.9, dmg: 30, r: 0.9, color: '#6d597a' },
  };
  const UPGRADES = [
    ['Sharper shots', 'Damage +20%', (m) => { m.dmg *= 1.2; }],
    ['Quick triggers', 'Fire rate +15%', (m) => { m.rate *= 0.87; }],
    ['Thicker suits', 'Max health +25, and heal that much', (m, hs) => { m.hp += 25; hs.forEach((h) => { h.hp = Math.min(h.max + 25, h.hp + 25); }); }],
    ['Fast boots', 'Move speed +10%', (m) => { m.speed *= 1.1; }],
    ['Field medic', 'Everyone healed to full, fallen revived', (m, hs) => { hs.forEach((h) => { h.down = false; h.hp = h.max; }); }],
    ['Short fuse', 'Specials recharge 20% faster', (m) => { m.cool *= 0.8; }],
    ['Piercing rounds', 'Shots pass through one more robot', (m) => { m.pierce += 1; }],
    ['Long barrels', 'Range +20%', (m) => { m.range *= 1.2; }],
  ];
  const KEYS = ['kb1', 'kb2', 'kb3', 'kb4'];

  let state = 'menu';
  let heroes, foes, shots, mines, rings, wave, queue, spawnT, mods, secondWind, time = 0, rand = Arcade.rng(), endT, picking;

  function start(count) {
    mods = { dmg: 1, rate: 1, hp: 0, speed: 1, cool: 1, pierce: 0, range: 1 };
    heroes = Array.from({ length: count }, (_, i) => {
      const c = HEROES[i];
      return { i, c, x: 6.5 + i, y: 4.5, hp: c.hp, max: c.hp, down: false, fire: 0, cool: 0, revive: 0, face: 0 };
    });
    foes = []; shots = []; mines = []; rings = []; wave = 0; endT = 0; picking = false;
    ui.hide(); input.flush();
    state = 'playing';
    nextWave();
  }

  function nextWave() {
    wave++;
    queue = [];
    const n = 5 + wave * 3 + heroes.length * 2;
    for (let i = 0; i < n; i++) {
      const r = rand();
      queue.push(wave > 2 && r < 0.2 ? 'zip' : wave > 4 && r < 0.2 + Math.min(0.25, wave * 0.02) ? 'brute' : 'grunt');
    }
    if (wave % 5 === 0) queue.splice(Math.floor(n / 2), 0, 'boss');
    spawnT = 1.5; secondWind = heroes.length === 1;
    heroes.forEach((h) => { h.max = h.c.hp + mods.hp; });
    ui.toast(wave % 5 === 0 ? 'Wave ' + wave + ': BOSS' : 'Wave ' + wave, 1400);
    Arcade.audio.sfx('select');
  }

  function spawnFoe(type) {
    const side = rand.int(0, 3), b = BOTS[type];
    const x = side === 0 ? -0.6 : side === 1 ? VW + 0.6 : rand() * VW, y = side === 2 ? -0.6 : side === 3 ? VH + 0.6 : rand() * VH;
    const hp = b.hp * (1 + wave * 0.08) * (type === 'boss' ? 1 + wave / 10 : 1);
    foes.push({ type, b, x, y, hp, max: hp, hit: 0 });
  }

  function special(h) {
    if (h.cool > 0) return;
    h.cool = 7 * mods.cool;
    Arcade.audio.sfx('win', { dur: 0.2, vol: 0.2 });
    if (h.c.role === 'Tank') {
      rings.push({ x: h.x, y: h.y, r: 2.6, t: 0, color: h.c.color });
      for (const f of foes) { const d = Math.hypot(f.x - h.x, f.y - h.y); if (d < 2.6) { f.x += ((f.x - h.x) / d) * 2.2; f.y += ((f.y - h.y) / d) * 2.2; f.hp -= 18 * mods.dmg; f.hit = 0.15; } }
    } else if (h.c.role === 'Medic') {
      rings.push({ x: h.x, y: h.y, r: 3.2, t: 0, color: h.c.color });
      for (const o of heroes) if (!o.down && Math.hypot(o.x - h.x, o.y - h.y) < 3.2) o.hp = Math.min(o.max, o.hp + 40);
    } else if (h.c.role === 'Trapper') {
      mines.push({ x: h.x, y: h.y, t: 0 });
    } else {
      const a = h.face;
      shots.push({ x: h.x, y: h.y, vx: Math.cos(a) * 16, vy: Math.sin(a) * 16, dmg: 70 * mods.dmg, pierce: 99, life: 1.2, big: true, color: h.c.color });
    }
  }

  function update(dt) {
    input.poll();
    time += dt;
    if (state !== 'playing' || ui.visible) return;
    rings.forEach((r) => { r.t += dt; }); rings = rings.filter((r) => r.t < 0.35);

    // robots arrive a few at a time
    spawnT -= dt;
    if (queue.length && spawnT <= 0) { spawnFoe(queue.shift()); spawnT = Math.max(0.25, 1.1 - wave * 0.05); }

    for (const h of heroes) {
      if (h.down) {
        const helper = heroes.find((o) => o !== h && !o.down && Math.hypot(o.x - h.x, o.y - h.y) < 1.2);
        h.revive = helper ? h.revive + dt : Math.max(0, h.revive - dt);
        if (h.revive > 2.2) { h.down = false; h.hp = h.max * 0.5; h.revive = 0; Arcade.audio.sfx('coin'); }
        continue;
      }
      const k = input.device(KEYS[h.i]), pad = input.device('pad' + h.i);
      const mx = k.x || pad.x, my = k.y || pad.y, n = Math.hypot(mx, my) || 1;
      h.x = Math.max(0.4, Math.min(VW - 0.4, h.x + (mx / n) * h.c.speed * mods.speed * dt));
      h.y = Math.max(0.4, Math.min(VH - 0.4, h.y + (my / n) * h.c.speed * mods.speed * dt));
      h.cool = Math.max(0, h.cool - dt); h.fire -= dt;
      const range = 6.5 * mods.range;
      const target = foes.filter((f) => Math.hypot(f.x - h.x, f.y - h.y) < range).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
      if (target) {
        h.face = Math.atan2(target.y - h.y, target.x - h.x);
        if (h.fire <= 0) {
          h.fire = h.c.rate * mods.rate;
          shots.push({ x: h.x, y: h.y, vx: Math.cos(h.face) * 11, vy: Math.sin(h.face) * 11, dmg: h.c.dmg * mods.dmg, pierce: mods.pierce, life: range / 11, color: h.c.color });
          Arcade.audio.beep({ freq: 500 + h.i * 90, dur: 0.03, type: 'square', vol: 0.05 });
        }
      }
      if (k.pressed('a') || pad.pressed('a')) special(h);
    }

    for (const s of shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      for (const f of foes) {
        if (s.life <= 0 || (s.seen && s.seen.includes(f))) continue;
        if (Math.hypot(f.x - s.x, f.y - s.y) < f.b.r + (s.big ? 0.3 : 0.1)) {
          f.hp -= s.dmg; f.hit = 0.1;
          (s.seen = s.seen || []).push(f);
          if (s.pierce-- <= 0) s.life = 0;
        }
      }
    }
    shots = shots.filter((s) => s.life > 0);

    for (const m of mines) {
      m.t += dt;
      if (m.t > 0.6 && foes.some((f) => Math.hypot(f.x - m.x, f.y - m.y) < 0.8)) {
        m.boom = true; rings.push({ x: m.x, y: m.y, r: 1.9, t: 0, color: '#c77dff' });
        for (const f of foes) if (Math.hypot(f.x - m.x, f.y - m.y) < 1.9) { f.hp -= 55 * mods.dmg; f.hit = 0.15; }
        Arcade.audio.sfx('thud');
      }
    }
    mines = mines.filter((m) => !m.boom);

    const standing = heroes.filter((h) => !h.down);
    for (const f of foes) {
      f.hit = Math.max(0, f.hit - dt);
      const t = standing.sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
      if (!t) continue;
      const d = Math.hypot(t.x - f.x, t.y - f.y) || 1;
      if (d > f.b.r + 0.3) { f.x += ((t.x - f.x) / d) * f.b.speed * dt; f.y += ((t.y - f.y) / d) * f.b.speed * dt; }
      else {
        t.hp -= f.b.dmg * dt;
        if (t.hp <= 0) {
          if (secondWind) { secondWind = false; t.hp = t.max * 0.5; ui.toast('Second wind!', 1000); rings.push({ x: t.x, y: t.y, r: 3, t: 0, color: '#fff' }); foes.forEach((o) => { if (Math.hypot(o.x - t.x, o.y - t.y) < 3) { o.x += (o.x - t.x) * 1.2; o.y += (o.y - t.y) * 1.2; } }); }
          else { t.down = true; t.hp = 0; t.revive = 0; Arcade.audio.sfx('lose', { dur: 0.3 }); }
        }
      }
      if (f.type === 'boss' && rand() < dt * 0.5) spawnFoe('grunt');
    }
    const before = foes.length;
    foes = foes.filter((f) => f.hp > 0);
    if (foes.length < before) Arcade.audio.beep({ freq: 180, slide: 60, dur: 0.08, type: 'sawtooth', vol: 0.12 });

    if (heroes.every((h) => h.down)) return gameOver(false);
    if (!queue.length && !foes.length && !picking) {
      if (wave >= WAVES) return gameOver(true);
      picking = true;
      const picks = rand.shuffle([...UPGRADES]).slice(0, 3);
      ui.results({
        heading: 'Wave ' + wave + ' cleared',
        rows: picks.map(([name, text]) => [name, text]),
        note: 'Pick one upgrade for the whole squad.',
        buttons: picks.map(([name, , fn]) => ({ label: name, onClick() { fn(mods, heroes); picking = false; ui.hide(); input.flush(); nextWave(); } })),
      });
    }
  }

  function gameOver(won) {
    state = 'over';
    const best = Math.max(wave, save.get('best', 0));
    save.set('best', best);
    Arcade.audio.sfx(won ? 'win' : 'lose');
    ui.results({
      heading: won ? 'Lab secured!' : 'Squad down',
      rows: [['Wave reached', wave + ' / ' + WAVES], ['Best', best]],
      buttons: [{ label: 'Go again', onClick: () => start(heroes.length) }, { label: 'Change squad size', onClick: menu }],
    });
  }

  function render() {
    ctx.fillStyle = '#0b3c49'; ctx.fillRect(0, 0, W, H);
    const u = Math.min(W / VW, (H - 84) / VH), ox = (W - VW * u) / 2, oy = (H - 84 - VH * u) / 2 + 6;
    const X = (v) => ox + v * u, Y = (v) => oy + v * u;
    // lab floor: panels with rivets
    ctx.fillStyle = '#0f4c5c'; ctx.fillRect(X(0), Y(0), VW * u, VH * u);
    ctx.strokeStyle = 'rgba(95, 211, 196, .16)'; ctx.lineWidth = 2;
    for (let x = 0; x <= VW; x += 2) { ctx.beginPath(); ctx.moveTo(X(x), Y(0)); ctx.lineTo(X(x), Y(VH)); ctx.stroke(); }
    for (let y = 0; y <= VH; y += 1.5) { ctx.beginPath(); ctx.moveTo(X(0), Y(y)); ctx.lineTo(X(VW), Y(y)); ctx.stroke(); }
    ctx.strokeStyle = '#f9a03f'; ctx.lineWidth = 4; ctx.setLineDash([18, 12]); ctx.strokeRect(X(0), Y(0), VW * u, VH * u); ctx.setLineDash([]);
    if (state === 'menu') return;

    for (const m of mines) { ctx.fillStyle = '#c77dff'; ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), u * 0.18, 0, 6.3); ctx.fill(); ctx.fillStyle = Math.sin(time * 10) > 0 ? '#fff' : '#3c096c'; ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), u * 0.07, 0, 6.3); ctx.fill(); }
    for (const f of foes) {
      const r = f.b.r * u;
      ctx.fillStyle = f.hit > 0 ? '#fff' : f.b.color;
      ctx.beginPath(); ctx.roundRect(X(f.x) - r, Y(f.y) - r, r * 2, r * 2, r * 0.3); ctx.fill();
      ctx.fillStyle = '#1a1200'; ctx.fillRect(X(f.x) - r * 0.6, Y(f.y) - r * 0.3, r * 1.2, r * 0.3);
      ctx.fillStyle = '#ff4d4d'; ctx.fillRect(X(f.x) - r * 0.4 + Math.sin(time * 6 + f.x) * r * 0.2, Y(f.y) - r * 0.25, r * 0.3, r * 0.2);
      if (f.hp < f.max) { ctx.fillStyle = '#062a33'; ctx.fillRect(X(f.x) - r, Y(f.y) - r - 8, r * 2, 5); ctx.fillStyle = '#ff6b6b'; ctx.fillRect(X(f.x) - r, Y(f.y) - r - 8, r * 2 * (f.hp / f.max), 5); }
    }
    for (const s of shots) { ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(X(s.x), Y(s.y), u * (s.big ? 0.2 : 0.08), 0, 6.3); ctx.fill(); }
    for (const h of heroes) {
      const x = X(h.x), y = Y(h.y), r = u * 0.32;
      ctx.globalAlpha = h.down ? 0.45 : 1;
      ctx.fillStyle = h.c.color; ctx.strokeStyle = '#062a33'; ctx.lineWidth = 3;
      ctx.beginPath();
      if (h.i === 0) ctx.roundRect(x - r, y - r, r * 2, r * 2, r * 0.3);
      else if (h.i === 1) ctx.arc(x, y, r, 0, 6.3);
      else if (h.i === 2) { ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.1, y + r); ctx.lineTo(x - r * 1.1, y + r); ctx.closePath(); }
      else { ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.2, y); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r * 1.2, y); ctx.closePath(); }
      ctx.fill(); ctx.stroke();
      if (!h.down) { ctx.strokeStyle = '#eafffb'; ctx.lineWidth = u * 0.08; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(h.face) * r * 1.5, y + Math.sin(h.face) * r * 1.5); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (h.down) {
        ctx.fillStyle = '#eafffb'; ctx.font = `700 ${Math.round(u * 0.24)}px ${BODY}`; ctx.textAlign = 'center'; ctx.fillText('HELP', x, y - r * 1.5);
        if (h.revive > 0) { ctx.strokeStyle = '#7ae582'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, r * 1.5, -1.57, -1.57 + (h.revive / 2.2) * 6.283); ctx.stroke(); }
      }
    }
    for (const r of rings) { ctx.strokeStyle = r.color; ctx.globalAlpha = 1 - r.t / 0.35; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(X(r.x), Y(r.y), r.r * u * (0.3 + (r.t / 0.35) * 0.7), 0, 6.3); ctx.stroke(); ctx.globalAlpha = 1; }

    // HUD: wave readout and a status card per hero
    ctx.fillStyle = '#eafffb'; ctx.textAlign = 'left'; ctx.font = `18px ${DISPLAY}`;
    ctx.fillText('WAVE ' + wave + ' / ' + WAVES, 16, 30);
    ctx.font = `500 14px ${BODY}`; ctx.fillStyle = '#9fd6cd'; ctx.fillText('Robots left: ' + (foes.length + queue.length), 16, 50);
    const bw = Math.min(190, (W - 16) / heroes.length - 8), total = heroes.length * (bw + 8) - 8;
    heroes.forEach((h, i) => {
      const x = (W - total) / 2 + i * (bw + 8), y = H - 70;
      ctx.fillStyle = 'rgba(6, 42, 51, .9)'; ctx.beginPath(); ctx.roundRect(x, y, bw, 58, [14, 3, 14, 3]); ctx.fill();
      ctx.strokeStyle = h.c.color; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = h.c.color; ctx.font = `13px ${DISPLAY}`; ctx.textAlign = 'left'; ctx.fillText(h.c.name.toUpperCase(), x + 12, y + 20);
      ctx.fillStyle = '#9fd6cd'; ctx.font = `500 12px ${BODY}`; ctx.textAlign = 'right';
      ctx.fillText(h.down ? 'DOWN' : h.cool > 0 ? h.c.special + ' ' + Math.ceil(h.cool) + 's' : h.c.special + ' READY', x + bw - 12, y + 20);
      ctx.fillStyle = '#062a33'; ctx.fillRect(x + 12, y + 32, bw - 24, 12);
      ctx.fillStyle = h.hp / h.max > 0.35 ? '#7ae582' : '#ff6b6b'; ctx.fillRect(x + 12, y + 32, (bw - 24) * Math.max(0, h.hp / h.max), 12);
    });
  }

  ui.onPause(() => { if (state === 'playing' && !picking) ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart: () => start(heroes.length) }); });
  function menu() {
    state = 'menu';
    const best = save.get('best', 0);
    ui.title({ note: best ? 'Best: wave ' + best : '', buttons: [1, 2, 3, 4].map((n) => ({ label: n === 1 ? 'Solo' : n + ' players', onClick: () => start(n) })) });
  }
  menu();
  Arcade.loop({ update, render }).start();
})();
