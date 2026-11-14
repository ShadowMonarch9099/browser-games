// Bullet Garden: a twin-stick shooter where missed shots matter. A seed that
// lands on empty soil grows into a plant: walls, spitters, slowing vines or
// bomb pods. Bugs find their way to the greenhouse around your plants, and
// plants wilt unless you walk near them to water them.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  input.touchPad(['left', 'right', 'up', 'down']);
  const save = Arcade.save('bullet-garden');

  const DISPLAY = '"Grandstander", "Trebuchet MS", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Bullet Garden',
    tagline: 'Every miss grows into a friend.',
    how: [['WASD / arrows', 'Walk'], ['Mouse / tap', 'Aim and fire seeds'], ['1 – 4', 'Choose a seed'], ['Missed seeds', 'Grow where they land'], ['Plants', 'Wilt unless you walk near them']],
    // Bullet Garden's own look: a seed packet. Kraft paper, leaf green, beet red.
    theme: {
      fonts: 'family=Grandstander:wght@600;800',
      display: DISPLAY, body: DISPLAY,
      overlay: 'rgba(45, 30, 18, .78)',
      panel: '#e9d8b4', panel2: '#dcc59a', edge: '#5a3e24',
      text: '#3a2614', muted: '#7a5c3a',
      accent: '#80b918', accentInk: '#1e3a08',
      radius: '10px', border: '3px',
      shadow: '0 0 0 6px #e9d8b4, 0 0 0 9px #5a3e24', buttonShadow: '0 3px 0 #5a3e24',
    },
  });

  const GW = 20, GH = 13, NIGHTS = 10, CORE = { x: 9.5, y: 6 };
  const SEEDS = {
    spitter: { name: 'Spitter', color: '#80b918', hp: 30, desc: 'Shoots nearby bugs' },
    wall: { name: 'Thornwall', color: '#7f5539', hp: 90, desc: 'Blocks the way' },
    vine: { name: 'Sticky vine', color: '#9d4edd', hp: 40, desc: 'Slows bugs that cross it' },
    bomb: { name: 'Bomb pod', color: '#d00000', hp: 20, desc: 'Bursts when a bug comes close' },
  };
  const ORDER = ['spitter', 'wall', 'vine', 'bomb'];
  const BUGS = { ant: { hp: 6, speed: 1.6, dmg: 4, r: 0.22, color: '#f4a261' }, beetle: { hp: 22, speed: 0.9, dmg: 10, r: 0.34, color: '#00bbf9' }, wasp: { hp: 5, speed: 2.8, dmg: 3, r: 0.2, color: '#ffb703', flies: true } };

  let state = 'menu', p, plants, bugs, seeds, spits, night, nightT, toSpawn, spawnT, unlocked, current, greenhouse, aim = { x: 0, y: 0, down: false }, flow, time = 0, rand = Arcade.rng(), pops;

  function start() {
    p = { x: CORE.x, y: CORE.y + 2, cool: 0 };
    plants = new Map(); bugs = []; seeds = []; spits = []; pops = [];
    unlocked = ['spitter']; current = 'spitter'; greenhouse = 100; night = 0;
    ui.hide(); input.flush(); state = 'playing';
    nextNight();
  }
  function nextNight() {
    night++; nightT = 0; spawnT = 2;
    toSpawn = [];
    const n = 8 + night * 4;
    for (let i = 0; i < n; i++) toSpawn.push(night >= 3 && rand() < 0.2 ? 'wasp' : night >= 2 && rand() < 0.25 + night * 0.02 ? 'beetle' : 'ant');
    if (night === NIGHTS) for (let i = 0; i < 6; i++) toSpawn.push('beetle');
    ui.toast('Night ' + night + (night === NIGHTS ? ': the swarm' : ''), 1500);
    buildFlow();
  }
  const key = (x, y) => y * GW + x;

  // Distance-to-greenhouse for every cell, walking around walls (and around
  // plants, which bugs prefer not to cross). Bugs roll downhill on it.
  function buildFlow() {
    flow = new Float32Array(GW * GH).fill(1e9);
    const cx = Math.floor(CORE.x), cy = Math.floor(CORE.y), queue = [[cx, cy]];
    flow[key(cx, cy)] = 0;
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i], d = flow[key(x, y)];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const pl = plants.get(key(nx, ny));
        const cost = pl ? (pl.type === 'wall' ? 12 : 3) : 1;
        if (d + cost < flow[key(nx, ny)]) { flow[key(nx, ny)] = d + cost; queue.push([nx, ny]); }
      }
    }
  }

  function fire() {
    if (p.cool > 0) return;
    const dx = aim.x - p.x, dy = aim.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d < 0.4) return;
    p.cool = 0.22;
    // A seed flies to where you aimed (up to 6 tiles) and plants itself there if it hits nothing.
    const reach = Math.min(6, d);
    seeds.push({ x: p.x, y: p.y, vx: (dx / d) * 11, vy: (dy / d) * 11, left: reach / 11, type: current });
    Arcade.audio.beep({ freq: 640, slide: 420, dur: 0.06, type: 'square', vol: 0.1 });
  }
  function plant(type, fx, fy) {
    const x = Math.floor(fx), y = Math.floor(fy);
    if (x < 0 || y < 0 || x >= GW || y >= GH || plants.has(key(x, y))) return;
    if (Math.abs(x + 0.5 - CORE.x) < 1.2 && Math.abs(y + 0.5 - CORE.y) < 1.2) return;   // not on the greenhouse
    plants.set(key(x, y), { type, x: x + 0.5, y: y + 0.5, hp: SEEDS[type].hp, water: 1, grow: 0, cool: 0 });
    buildFlow();
  }

  canvas.addEventListener('pointermove', (e) => { aim.screen = [e.offsetX, e.offsetY]; });
  canvas.addEventListener('pointerdown', (e) => {
    aim.screen = [e.offsetX, e.offsetY]; aim.down = true; aim.tap = true;   // a quick tap still fires once
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not a real pointer */ }
  });
  canvas.addEventListener('pointerup', () => { aim.down = false; });
  addEventListener('keydown', (e) => {
    const m = e.code.match(/^Digit([1-4])$/);
    if (m && state === 'playing' && unlocked.includes(ORDER[m[1] - 1])) current = ORDER[m[1] - 1];
  });

  let V;
  function update(dt) {
    input.poll();
    time += dt;
    if (state !== 'playing' || ui.visible) return;
    pops.forEach((q) => { q.t += dt; }); pops = pops.filter((q) => q.t < 0.5);
    const k = input.solo, n = Math.hypot(k.x, k.y) || 1;
    p.x = Math.max(0.4, Math.min(GW - 0.4, p.x + (k.x / n) * 4.2 * dt));
    p.y = Math.max(0.4, Math.min(GH - 0.4, p.y + (k.y / n) * 4.2 * dt));
    if (V && aim.screen) { aim.x = (aim.screen[0] - V.ox) / V.u; aim.y = (aim.screen[1] - V.oy) / V.u; }
    p.cool -= dt;
    if (aim.down || aim.tap) { fire(); aim.tap = false; }

    for (const s of seeds) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.left -= dt;
      const hit = bugs.find((b) => Math.hypot(b.x - s.x, b.y - s.y) < b.t.r + 0.1);
      if (hit) { hit.hp -= 3; hit.flash = 0.1; s.done = true; continue; }
      if (s.left <= 0) { s.done = true; plant(s.type, s.x, s.y); }
    }
    seeds = seeds.filter((s) => !s.done);

    // plants: grow, drink, wilt, act
    for (const [id, pl] of plants) {
      pl.grow = Math.min(1, pl.grow + dt * 1.5);
      const near = Math.hypot(pl.x - p.x, pl.y - p.y) < 2.5;
      pl.water = near ? Math.min(1, pl.water + dt * 0.5) : pl.water - dt / 40;
      if (pl.water <= 0 || pl.hp <= 0) { plants.delete(id); pops.push({ x: pl.x, y: pl.y, t: 0, color: '#7a5c3a' }); buildFlow(); continue; }
      if (pl.grow < 1 || pl.water < 0.15) continue;
      pl.cool -= dt;
      if (pl.type === 'spitter' && pl.cool <= 0) {
        const tgt = bugs.find((b) => Math.hypot(b.x - pl.x, b.y - pl.y) < 3.2);
        if (tgt) { pl.cool = 0.8; const d = Math.hypot(tgt.x - pl.x, tgt.y - pl.y); spits.push({ x: pl.x, y: pl.y, vx: ((tgt.x - pl.x) / d) * 8, vy: ((tgt.y - pl.y) / d) * 8, life: 0.5 }); }
      }
      if (pl.type === 'bomb' && bugs.some((b) => Math.hypot(b.x - pl.x, b.y - pl.y) < 1)) {
        for (const b of bugs) if (Math.hypot(b.x - pl.x, b.y - pl.y) < 2) { b.hp -= 25; b.flash = 0.15; }
        pops.push({ x: pl.x, y: pl.y, t: 0, color: '#d00000', big: true });
        Arcade.audio.sfx('thud', { vol: 0.6 });
        plants.delete(id); buildFlow();
      }
    }
    for (const s of spits) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      const hit = bugs.find((b) => Math.hypot(b.x - s.x, b.y - s.y) < b.t.r + 0.08);
      if (hit) { hit.hp -= 4; hit.flash = 0.1; s.life = 0; }
    }
    spits = spits.filter((s) => s.life > 0);

    // bugs arrive from the edges and head for the greenhouse
    nightT += dt; spawnT -= dt;
    if (toSpawn.length && spawnT <= 0) {
      const type = toSpawn.shift(), t = BUGS[type], side = rand.int(0, 3);
      bugs.push({ type, t, hp: t.hp * (1 + night * 0.08), x: side === 0 ? 0.3 : side === 1 ? GW - 0.3 : rand() * GW, y: side === 2 ? 0.3 : side === 3 ? GH - 0.3 : rand() * GH, flash: 0, bite: 0 });
      spawnT = Math.max(0.35, 1.6 - night * 0.12);
    }
    for (const b of bugs) {
      b.flash = Math.max(0, b.flash - dt);
      const cx = Math.floor(b.x), cy = Math.floor(b.y), here = plants.get(key(cx, cy));
      let speed = b.t.speed * (here && here.type === 'vine' && here.grow >= 1 && !b.t.flies ? 0.35 : 1);
      let tx = CORE.x, ty = CORE.y;
      if (!b.t.flies) {
        // step toward the lowest neighbouring cell
        let best = flow[key(cx, cy)];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && ny >= 0 && nx < GW && ny < GH && flow[key(nx, ny)] < best) { best = flow[key(nx, ny)]; tx = nx + 0.5; ty = ny + 0.5; }
        }
      }
      const ahead = plants.get(key(Math.floor(tx), Math.floor(ty)));
      if (!b.t.flies && ahead && ahead.type === 'wall' && ahead.grow >= 1 && Math.hypot(ahead.x - b.x, ahead.y - b.y) < 0.9) {
        ahead.hp -= b.t.dmg * dt; speed = 0;                          // chewing through
      }
      const d = Math.hypot(tx - b.x, ty - b.y) || 1;
      b.x += ((tx - b.x) / d) * speed * dt; b.y += ((ty - b.y) / d) * speed * dt;
      if (Math.hypot(b.x - CORE.x, b.y - CORE.y) < 1.1) { greenhouse -= b.t.dmg * dt; b.bite += dt; }
      if (Math.hypot(b.x - p.x, b.y - p.y) < b.t.r + 0.3) { p.x += (p.x - b.x) * 0.2; p.y += (p.y - b.y) * 0.2; }
    }
    const before = bugs.length;
    for (const b of bugs) if (b.hp <= 0) pops.push({ x: b.x, y: b.y, t: 0, color: b.t.color });
    bugs = bugs.filter((b) => b.hp > 0);
    if (bugs.length < before) Arcade.audio.beep({ freq: 220, slide: 90, dur: 0.07, type: 'triangle', vol: 0.2 });

    if (greenhouse <= 0) return end(false);
    if (!toSpawn.length && !bugs.length) {
      if (night >= NIGHTS) return end(true);
      const locked = ORDER.filter((s) => !unlocked.includes(s));
      Arcade.audio.sfx('win', { dur: 0.3 });
      greenhouse = Math.min(100, greenhouse + 15);
      ui.results({
        heading: 'Dawn, night ' + night,
        rows: [['Greenhouse', Math.ceil(greenhouse) + '%'], ['Plants', plants.size]],
        note: locked.length ? 'Pick a new seed to unlock. Switch seeds with 1 – 4.' : 'Every seed unlocked. Rest, then the next night.',
        buttons: locked.length
          ? locked.map((s) => ({ label: SEEDS[s].name + ': ' + SEEDS[s].desc, onClick() { unlocked.push(s); current = s; ui.hide(); input.flush(); nextNight(); } }))
          : [{ label: 'Next night', onClick() { ui.hide(); input.flush(); nextNight(); } }],
      });
    }
  }

  function end(won) {
    state = 'over';
    const best = Math.max(won ? NIGHTS : night - 1, save.get('best', 0)); save.set('best', best);
    Arcade.audio.sfx(won ? 'win' : 'lose');
    ui.results({ heading: won ? 'The garden held!' : 'The bugs got in', rows: [['Nights survived', (won ? NIGHTS : night - 1) + ' / ' + NIGHTS], ['Best', best]], buttons: [{ label: 'Plant again', onClick: start }] });
  }

  function render() {
    // kraft-paper night garden
    ctx.fillStyle = '#2d1e12'; ctx.fillRect(0, 0, W, H);
    const u = Math.min(W / GW, (H - 64) / GH), ox = (W - GW * u) / 2, oy = 56 + (H - 64 - GH * u) / 2;
    V = { u, ox, oy };
    const X = (v) => ox + v * u, Y = (v) => oy + v * u;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#5a3e24' : '#4f361f';
      ctx.fillRect(X(x), Y(y), u + 0.5, u + 0.5);
    }
    if (state === 'menu') return;
    // greenhouse
    ctx.fillStyle = 'rgba(200, 240, 255, .35)'; ctx.strokeStyle = '#e9d8b4'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(X(CORE.x - 1), Y(CORE.y - 1), u * 2, u * 2, u * 0.3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(CORE.x), Y(CORE.y - 1)); ctx.lineTo(X(CORE.x), Y(CORE.y + 1)); ctx.moveTo(X(CORE.x - 1), Y(CORE.y)); ctx.lineTo(X(CORE.x + 1), Y(CORE.y)); ctx.stroke();
    for (const pl of plants.values()) {
      const s = u * (0.25 + pl.grow * 0.25), col = SEEDS[pl.type].color;
      ctx.globalAlpha = 0.4 + 0.6 * Math.max(0, pl.water);
      ctx.fillStyle = col;
      if (pl.type === 'wall') { ctx.fillRect(X(pl.x) - s, Y(pl.y) - s, s * 2, s * 2); ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 2; ctx.strokeRect(X(pl.x) - s, Y(pl.y) - s, s * 2, s * 2); }
      else if (pl.type === 'vine') { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(X(pl.x) - s, Y(pl.y) - s + i * s * 0.66); ctx.quadraticCurveTo(X(pl.x), Y(pl.y) + s * (i % 2 ? 1 : -1) * 0.4, X(pl.x) + s, Y(pl.y) - s + i * s * 0.66); } ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(X(pl.x), Y(pl.y), s, 0, 6.3); ctx.fill(); ctx.fillStyle = '#1e3a08'; ctx.beginPath(); ctx.arc(X(pl.x), Y(pl.y), s * 0.35, 0, 6.3); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (pl.water < 0.4) { ctx.fillStyle = '#4cc9f0'; ctx.font = `800 ${Math.round(u * 0.35)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillText('💧', X(pl.x), Y(pl.y) - s - 2); }
    }
    for (const s of seeds) { ctx.fillStyle = SEEDS[s.type].color; ctx.beginPath(); ctx.ellipse(X(s.x), Y(s.y), u * 0.09, u * 0.13, Math.atan2(s.vy, s.vx) + 1.57, 0, 6.3); ctx.fill(); }
    for (const s of spits) { ctx.fillStyle = '#c7f464'; ctx.beginPath(); ctx.arc(X(s.x), Y(s.y), u * 0.07, 0, 6.3); ctx.fill(); }
    for (const b of bugs) {
      ctx.fillStyle = b.flash > 0 ? '#fff' : b.t.color;
      ctx.beginPath(); ctx.ellipse(X(b.x), Y(b.y), b.t.r * u, b.t.r * u * 0.75, 0, 0, 6.3); ctx.fill();
      if (b.t.flies) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(X(b.x), Y(b.y) - b.t.r * u, b.t.r * u * 0.8, b.t.r * u * 0.3, Math.sin(time * 40) * 0.4, 0, 6.3); ctx.fill(); }
    }
    for (const q of pops) { ctx.globalAlpha = 1 - q.t * 2; ctx.strokeStyle = q.color; ctx.lineWidth = q.big ? 6 : 3; ctx.beginPath(); ctx.arc(X(q.x), Y(q.y), u * (q.big ? 2 : 0.5) * (0.3 + q.t * 1.4), 0, 6.3); ctx.stroke(); ctx.globalAlpha = 1; }
    // the gardener and the aim line
    ctx.fillStyle = '#e9d8b4'; ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), u * 0.3, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#80b918'; ctx.beginPath(); ctx.ellipse(X(p.x), Y(p.y) - u * 0.25, u * 0.38, u * 0.12, 0, 0, 6.3); ctx.fill();
    if (aim.screen) {
      const d = Math.hypot(aim.x - p.x, aim.y - p.y), r = Math.min(6, d), ax = p.x + ((aim.x - p.x) / (d || 1)) * r, ay = p.y + ((aim.y - p.y) / (d || 1)) * r;
      ctx.strokeStyle = 'rgba(233, 216, 180, .5)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(X(p.x), Y(p.y)); ctx.lineTo(X(ax), Y(ay)); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = SEEDS[current].color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(ax), Y(ay), u * 0.3, 0, 6.3); ctx.stroke();
    }

    // HUD: seed packets along the top
    ctx.textAlign = 'left'; ctx.fillStyle = '#e9d8b4'; ctx.font = `800 18px ${DISPLAY}`;
    ctx.fillText('Night ' + night + ' / ' + NIGHTS, 14, 26);
    ctx.fillStyle = greenhouse > 35 ? '#80b918' : '#d00000'; ctx.fillRect(14, 34, 120 * (greenhouse / 100), 10);
    ctx.strokeStyle = '#e9d8b4'; ctx.strokeRect(14, 34, 120, 10);
    ORDER.forEach((s, i) => {
      const x = Math.max(150, W / 2 - 170) + i * 86, on = s === current, open = unlocked.includes(s);
      ctx.fillStyle = open ? (on ? '#e9d8b4' : '#b89c70') : '#4f361f';
      ctx.fillRect(x, 8, 80, 40);
      ctx.fillStyle = SEEDS[s].color; ctx.beginPath(); ctx.arc(x + 14, 28, 7, 0, 6.3); ctx.fill();
      ctx.fillStyle = open ? '#3a2614' : '#7a5c3a'; ctx.font = `800 12px ${DISPLAY}`;
      ctx.fillText((i + 1) + ' ' + (open ? SEEDS[s].name.split(' ').pop() : 'locked'), x + 26, 32);
      if (on) { ctx.strokeStyle = '#80b918'; ctx.lineWidth = 3; ctx.strokeRect(x, 8, 80, 40); }
    });
  }

  ui.onPause(() => { if (state === 'playing') ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart: start }); });
  const best = save.get('best', 0);
  ui.title({ note: best ? 'Best: ' + best + ' nights' : '', buttons: [{ label: 'Start planting', onClick: start }] });
  Arcade.loop({ update, render }).start();
})();
