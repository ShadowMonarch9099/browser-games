// Last Lantern: explore a dark cave world and relight four beacons. Lantern
// oil is everything at once: it lights the way, it is your health (creatures
// knock it out of the lamp), and it pays for upgrades and beacons. A brighter
// lamp shows more but burns faster and draws more creatures; a dim one sneaks.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  input.touchPad(['left', 'right', 'up', 'down', 'a', 'b']);
  const save = Arcade.save('last-lantern');

  const DISPLAY = '"Cinzel Decorative", "Georgia", serif';
  const BODY = '"Cormorant Garamond", "Georgia", serif';
  const ui = Arcade.ui.create({
    title: 'Last Lantern',
    tagline: 'Keep the flame. Relight the beacons.',
    how: [['Move', 'WASD / arrows'], ['Swing', 'Space / F / pad A'], ['Brightness', 'G / Shift / pad B'], ['Use', 'Stand at a beacon or shrine and swing'], ['Oil', 'Light, health and coin. All three']],
    // Last Lantern's own look: candlelight on old parchment and ink.
    theme: {
      fonts: 'family=Cinzel+Decorative:wght@700&family=Cormorant+Garamond:wght@500;700',
      display: DISPLAY, body: BODY,
      overlay: 'rgba(3, 3, 6, .86)',
      panel: '#1b1610', panel2: '#2a2117', edge: '#ffb347',
      text: '#f6e7c8', muted: '#bfa67a',
      accent: '#ffb347', accentInk: '#1b1610',
      radius: '2px', border: '1px',
      shadow: '0 0 60px rgba(255, 179, 71, .25)', buttonShadow: 'none',
      titleSize: 'clamp(1.9rem, 8.5vw, 2.6rem)',
    },
  });

  const MW = 56, MH = 40;
  const LIGHT = [{ name: 'Dim', r: 2.6, burn: 0.35, lure: 0.4 }, { name: 'Steady', r: 4.6, burn: 0.7, lure: 1 }, { name: 'Bright', r: 7.2, burn: 1.5, lure: 2.2 }];
  const UPGRADES = [
    { id: 'blade', name: 'Sharper blade', cost: 40, desc: 'Creatures fall in one less swing' },
    { id: 'wick', name: 'Better wick', cost: 55, desc: 'Burn 30% less oil' },
    { id: 'tank', name: 'Bigger tank', cost: 70, desc: 'Hold 50 more oil' },
  ];
  const BEACON_COST = 30;

  let state = 'menu', seed, map, beacons, shrines, jars, foes, p, lightLv, owned, rand, time = 0, cam = { x: 0, y: 0 }, fx, dark;

  // ---------- world: caves grown from noise, with tunnels to each beacon ----------
  function buildWorld(s) {
    rand = Arcade.rng(s);
    map = Array.from({ length: MH }, (_, y) => Array.from({ length: MW }, (_, x) => (x === 0 || y === 0 || x === MW - 1 || y === MH - 1 || rand() < 0.44 ? 1 : 0)));
    for (let pass = 0; pass < 4; pass++) {
      const next = map.map((r) => [...r]);
      for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += map[y + dy][x + dx];
        next[y][x] = n >= 5 ? 1 : 0;
      }
      map = next;
    }
    const cx = MW / 2, cy = MH / 2;
    const dig = (x0, y0, x1, y1) => {
      let x = x0, y = y0;
      while (Math.abs(x - x1) + Math.abs(y - y1) > 0) {
        if (rand() < 0.5) x += Math.sign(x1 - x); else y += Math.sign(y1 - y);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (x + dx > 0 && y + dy > 0 && x + dx < MW - 1 && y + dy < MH - 1) map[y + dy][x + dx] = 0;
      }
    };
    const room = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) map[y + dy][x + dx] = 0; };
    room(Math.floor(cx), Math.floor(cy), 3);
    beacons = [[9, 8, 'Mossy Hollow'], [MW - 10, 8, 'Bone Gallery'], [9, MH - 9, 'Drowned Steps'], [MW - 10, MH - 9, 'Ember Throne']]
      .map(([x, y, name]) => { room(x, y, 3); dig(Math.floor(cx), Math.floor(cy), x, y); return { x: x + 0.5, y: y + 0.5, name, lit: false }; });
    shrines = UPGRADES.map((u, i) => {
      const a = (i / 3) * 6.283 + 0.6, x = Math.floor(cx + Math.cos(a) * 12), y = Math.floor(cy + Math.sin(a) * 9);
      room(x, y, 2); dig(Math.floor(cx), Math.floor(cy), x, y);
      return { x: x + 0.5, y: y + 0.5, up: u };
    });
    jars = [];
    for (let i = 0; i < 40; i++) {
      const x = rand.int(1, MW - 2), y = rand.int(1, MH - 2);
      if (!map[y][x] && Math.hypot(x - cx, y - cy) > 4) jars.push({ x: x + 0.5, y: y + 0.5, taken: -1 });
    }
  }
  const wall = (x, y) => { const tx = Math.floor(x), ty = Math.floor(y); return tx < 0 || ty < 0 || tx >= MW || ty >= MH || map[ty][tx] === 1; };

  function newGame(fromSave) {
    const s = fromSave || {};
    seed = s.seed || Arcade.rng.hash(String(Math.random()));
    buildWorld(seed);
    (s.lit || []).forEach((i) => { beacons[i].lit = true; });
    owned = new Set(s.owned || []);
    p = { x: MW / 2, y: MH / 2, face: 0, oil: s.oil || 100, swing: 0, cool: 0, hurt: 0 };
    lightLv = 1; foes = []; fx = [];
    ui.hide(); input.flush(); state = 'playing';
    if (!fromSave) ui.toast('Four beacons wait in the dark', 2600);
  }
  const maxOil = () => 100 + (owned.has('tank') ? 50 : 0);
  function persist() { save.set('run', { seed, lit: beacons.map((b, i) => (b.lit ? i : -1)).filter((i) => i >= 0), owned: [...owned], oil: Math.round(p.oil) }); }
  const litNear = (x, y) => beacons.some((b) => b.lit && Math.hypot(b.x - x, b.y - y) < 8);

  function use() {
    for (const b of beacons) if (!b.lit && Math.hypot(b.x - p.x, b.y - p.y) < 1.6) {
      if (p.oil < BEACON_COST + 5) { ui.toast('A beacon needs ' + BEACON_COST + ' oil', 1500); return true; }
      p.oil -= BEACON_COST; b.lit = true;
      fx.push({ x: b.x, y: b.y, t: 0, r: 8, color: '#ffb347' });
      Arcade.audio.sfx('win');
      ui.toast(b.name + ' is lit', 2200);
      foes = foes.filter((f) => Math.hypot(f.x - b.x, f.y - b.y) > 8);
      persist();
      if (beacons.every((q) => q.lit)) setTimeout(() => end(true), 1200);
      return true;
    }
    for (const s of shrines) if (Math.hypot(s.x - p.x, s.y - p.y) < 1.4) {
      if (owned.has(s.up.id)) { ui.toast('Already yours: ' + s.up.name, 1300); return true; }
      if (p.oil < s.up.cost + 5) { ui.toast(s.up.name + ' costs ' + s.up.cost + ' oil', 1500); return true; }
      p.oil -= s.up.cost; owned.add(s.up.id);
      Arcade.audio.sfx('coin'); ui.toast(s.up.name + ': ' + s.up.desc, 2400);
      persist();
      return true;
    }
    return false;
  }

  function update(dt) {
    input.poll();
    time += dt;
    if (state !== 'playing' || ui.visible) return;
    fx.forEach((f) => { f.t += dt; }); fx = fx.filter((f) => f.t < 0.6);
    const k = input.solo, n = Math.hypot(k.x, k.y) || 1, sp = 3.6 * dt;
    if (k.x || k.y) p.face = Math.atan2(k.y, k.x);
    const nx = p.x + (k.x / n) * sp, ny = p.y + (k.y / n) * sp, r = 0.3;
    if (!wall(nx - r, p.y - r) && !wall(nx + r, p.y - r) && !wall(nx - r, p.y + r) && !wall(nx + r, p.y + r)) p.x = nx;
    if (!wall(p.x - r, ny - r) && !wall(p.x + r, ny - r) && !wall(p.x - r, ny + r) && !wall(p.x + r, ny + r)) p.y = ny;
    if (k.pressed('b')) { lightLv = (lightLv + 1) % 3; Arcade.audio.sfx('blip', { freq: 300 + lightLv * 200 }); }
    p.cool -= dt; p.swing -= dt; p.hurt -= dt;
    if (k.pressed('a') && p.cool <= 0 && !use()) {
      p.swing = 0.18; p.cool = 0.35;
      Arcade.audio.beep({ freq: 200, slide: 520, dur: 0.08, type: 'triangle', vol: 0.2 });
      for (const f of foes) {
        const d = Math.hypot(f.x - p.x, f.y - p.y);
        let diff = Math.atan2(f.y - p.y, f.x - p.x) - p.face; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if (d < 1.4 && Math.abs(diff) < 1.1) { f.hp -= owned.has('blade') ? 2 : 1; f.x += Math.cos(p.face) * 0.6; f.y += Math.sin(p.face) * 0.6; f.flash = 0.12; }
      }
    }
    // the lamp burns; lit beacons let you breathe and slowly refill
    const L = LIGHT[lightLv];
    p.oil -= L.burn * (owned.has('wick') ? 0.7 : 1) * dt * (litNear(p.x, p.y) ? 0 : 1);
    if (litNear(p.x, p.y)) p.oil = Math.min(maxOil(), p.oil + dt * 1.5);
    for (const j of jars) {
      if (j.taken > 0) { j.taken -= dt; continue; }
      if (Math.hypot(j.x - p.x, j.y - p.y) < 0.6) { j.taken = 90; p.oil = Math.min(maxOil(), p.oil + 18); Arcade.audio.sfx('coin', { vol: 0.15 }); }
    }

    // creatures gather at the edge of your light: more of them the brighter it is
    if (!litNear(p.x, p.y) && foes.length < 3 + lightLv * 3 && rand() < dt * 0.35 * L.lure) {
      const a = rand() * 6.283, d = L.r + 2 + rand() * 3, fxp = p.x + Math.cos(a) * d, fyp = p.y + Math.sin(a) * d;
      if (!wall(fxp, fyp) && !litNear(fxp, fyp)) foes.push({ x: fxp, y: fyp, hp: 2 + (rand() < 0.25 ? 2 : 0), flash: 0, wait: 0 });
    }
    for (const f of foes) {
      f.flash -= dt; f.wait -= dt;
      const d = Math.hypot(p.x - f.x, p.y - f.y) || 1, speed = (f.hp > 2 ? 1.4 : 2.1) * dt;
      if (d < L.r + 6 && f.wait <= 0) {
        const mx = f.x + ((p.x - f.x) / d) * speed, my = f.y + ((p.y - f.y) / d) * speed;
        if (!wall(mx, f.y)) f.x = mx;
        if (!wall(f.x, my)) f.y = my;
      }
      if (d < 0.6 && p.hurt <= 0) { p.oil -= 12; p.hurt = 0.8; f.wait = 0.8; Arcade.audio.sfx('hit'); fx.push({ x: p.x, y: p.y, t: 0, r: 1.2, color: '#ff4d4d' }); }
      if (litNear(f.x, f.y)) f.hp = 0;
    }
    for (const f of foes) if (f.hp <= 0) { p.oil = Math.min(maxOil(), p.oil + 5); fx.push({ x: f.x, y: f.y, t: 0, r: 0.9, color: '#9d8df1' }); }
    foes = foes.filter((f) => f.hp > 0);
    if (p.oil <= 0) end(false);
    cam.x += (p.x - cam.x) * Math.min(1, dt * 8); cam.y += (p.y - cam.y) * Math.min(1, dt * 8);
  }

  function end(won) {
    if (state !== 'playing') return;
    state = 'over';
    save.set('run', null);
    if (won) save.set('wins', save.get('wins', 0) + 1);
    Arcade.audio.sfx(won ? 'win' : 'lose');
    ui.results({
      heading: won ? 'The dawn returns' : 'The flame went out',
      rows: [['Beacons lit', beacons.filter((b) => b.lit).length + ' / 4'], ['Upgrades', owned.size + ' / 3']],
      note: won ? 'Each new world is a different cave.' : 'The world is lost. A new one waits.',
      buttons: [{ label: 'New world', onClick: () => newGame() }],
    });
  }

  // ---------- drawing ----------
  function render() {
    ctx.fillStyle = '#07080d'; ctx.fillRect(0, 0, W, H);
    if (state === 'menu') {
      const g = ctx.createRadialGradient(W / 2, H * 0.62, 10, W / 2, H * 0.62, 260);
      g.addColorStop(0, `rgba(255, 179, 71, ${0.35 + Math.sin(time * 6) * 0.04})`); g.addColorStop(1, 'rgba(255,179,71,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      return;
    }
    const u = Math.max(22, Math.min(W, H) / 15);
    const X = (v) => W / 2 + (v - cam.x) * u, Y = (v) => H / 2 + (v - cam.y) * u;
    const x0 = Math.floor(cam.x - W / u / 2) - 1, x1 = Math.ceil(cam.x + W / u / 2) + 1, y0 = Math.floor(cam.y - H / u / 2) - 1, y1 = Math.ceil(cam.y + H / u / 2) + 1;
    for (let y = Math.max(0, y0); y < Math.min(MH, y1); y++) for (let x = Math.max(0, x0); x < Math.min(MW, x1); x++) {
      ctx.fillStyle = map[y][x] ? ((x * 7 + y * 3) % 5 ? '#5a4632' : '#664f38') : ((x + y) % 2 ? '#2b241b' : '#30281e');
      ctx.fillRect(X(x), Y(y), u + 0.5, u + 0.5);
    }
    for (const j of jars) if (j.taken <= 0) { ctx.fillStyle = '#c98b4b'; ctx.fillRect(X(j.x) - u * 0.15, Y(j.y) - u * 0.2, u * 0.3, u * 0.38); ctx.fillStyle = '#ffb347'; ctx.fillRect(X(j.x) - u * 0.1, Y(j.y) - u * 0.05, u * 0.2, u * 0.2); }
    for (const s of shrines) { ctx.fillStyle = owned.has(s.up.id) ? '#4f4a3a' : '#bfa67a'; ctx.beginPath(); ctx.moveTo(X(s.x), Y(s.y) - u * 0.6); ctx.lineTo(X(s.x) + u * 0.45, Y(s.y) + u * 0.4); ctx.lineTo(X(s.x) - u * 0.45, Y(s.y) + u * 0.4); ctx.fill(); }
    for (const b of beacons) {
      ctx.fillStyle = '#4f4a3a'; ctx.fillRect(X(b.x) - u * 0.35, Y(b.y) - u * 0.2, u * 0.7, u * 0.6);
      ctx.fillStyle = b.lit ? '#ffb347' : '#2a2117'; ctx.beginPath(); ctx.arc(X(b.x), Y(b.y) - u * 0.35, u * 0.32 + (b.lit ? Math.sin(time * 8) * 2 : 0), 0, 6.3); ctx.fill();
    }
    for (const f of foes) {
      ctx.fillStyle = f.flash > 0 ? '#fff' : f.hp > 2 ? '#6c5ce7' : '#9d8df1';
      const wob = Math.sin(time * 10 + f.x) * u * 0.04;
      ctx.beginPath(); ctx.arc(X(f.x), Y(f.y) + wob, u * (f.hp > 2 ? 0.4 : 0.3), Math.PI, 0); ctx.lineTo(X(f.x) + u * 0.3, Y(f.y) + u * 0.35); ctx.lineTo(X(f.x) - u * 0.3, Y(f.y) + u * 0.35); ctx.fill();
      ctx.fillStyle = '#ffe66d'; ctx.fillRect(X(f.x) - u * 0.15, Y(f.y) - u * 0.08, u * 0.08, u * 0.08); ctx.fillRect(X(f.x) + u * 0.07, Y(f.y) - u * 0.08, u * 0.08, u * 0.08);
    }
    // the keeper and the lantern
    if (!(p.hurt > 0 && Math.floor(time * 16) % 2)) {
      ctx.fillStyle = '#3d2f22'; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), u * 0.32, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(X(p.x) + Math.cos(p.face + 0.8) * u * 0.32, Y(p.y) + Math.sin(p.face + 0.8) * u * 0.32, u * 0.12, 0, 6.3); ctx.fill();
    }
    if (p.swing > 0) { ctx.strokeStyle = '#f6e7c8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), u * 1.1, p.face - 1 + (0.18 - p.swing) * 8, p.face - 0.6 + (0.18 - p.swing) * 8); ctx.stroke(); }

    // darkness, with holes for the lamp and lit beacons
    if (!dark) dark = document.createElement('canvas');
    if (dark.width !== canvas.width || dark.height !== canvas.height) { dark.width = canvas.width; dark.height = canvas.height; }
    const d = dark.getContext('2d'), scale = canvas.width / W;
    d.setTransform(scale, 0, 0, scale, 0, 0);
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, W, H);
    d.fillStyle = 'rgba(2, 2, 5, .97)'; d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r) => { const g = d.createRadialGradient(x, y, r * 0.25, x, y, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.fillRect(x - r, y - r, r * 2, r * 2); };
    hole(X(p.x), Y(p.y), LIGHT[lightLv].r * u * (0.97 + Math.sin(time * 9) * 0.03) * Math.min(1, 0.4 + p.oil / 60));
    for (const b of beacons) if (b.lit) hole(X(b.x), Y(b.y), 8.5 * u);
    for (const j of jars) if (j.taken <= 0) hole(X(j.x), Y(j.y), u * 0.6);
    ctx.drawImage(dark, 0, 0, W, H);
    ctx.fillStyle = `rgba(255, 140, 40, ${0.06 + lightLv * 0.03})`; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), LIGHT[lightLv].r * u, 0, 6.3); ctx.fill();
    for (const f of fx) { ctx.globalAlpha = 1 - f.t / 0.6; ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X(f.x), Y(f.y), f.r * u * (f.t / 0.6), 0, 6.3); ctx.stroke(); ctx.globalAlpha = 1; }

    // HUD: an oil gauge in a brass frame, beacon marks, and a hint when near something
    const gw = Math.min(260, W - 140);
    ctx.fillStyle = 'rgba(27, 22, 16, .85)'; ctx.fillRect(14, 14, gw + 20, 58);
    ctx.strokeStyle = '#bfa67a'; ctx.lineWidth = 1; ctx.strokeRect(14, 14, gw + 20, 58);
    ctx.fillStyle = '#2a2117'; ctx.fillRect(24, 22, gw, 14);
    ctx.fillStyle = p.oil > 30 ? '#ffb347' : '#ff4d4d'; ctx.fillRect(24, 22, gw * Math.max(0, p.oil) / maxOil(), 14);
    ctx.fillStyle = '#f6e7c8'; ctx.textAlign = 'left'; ctx.font = `700 15px ${BODY}`;
    ctx.fillText(Math.ceil(p.oil) + ' oil · ' + LIGHT[lightLv].name + ' flame', 24, 56);
    ctx.textAlign = 'right';
    ctx.fillText(beacons.map((b) => (b.lit ? '✦' : '✧')).join(' '), 14 + gw + 10, 56);
    const near = [...beacons.filter((b) => !b.lit).map((b) => [b, 'Swing to light ' + b.name + ' (' + BEACON_COST + ' oil)']), ...shrines.filter((s) => !owned.has(s.up.id)).map((s) => [s, s.up.name + ': ' + s.up.desc + ' (' + s.up.cost + ' oil)'])]
      .find(([o]) => Math.hypot(o.x - p.x, o.y - p.y) < 1.6);
    if (near) { ctx.textAlign = 'center'; ctx.font = `700 18px ${BODY}`; ctx.fillStyle = '#ffb347'; ctx.fillText(near[1], W / 2, H - 110); }
  }

  ui.onPause(() => { if (state === 'playing') ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart: () => newGame() }); });
  addEventListener('beforeunload', () => { if (state === 'playing') persist(); });
  const run = save.get('run', null), wins = save.get('wins', 0);
  ui.title({
    note: wins ? 'Dawns brought back: ' + wins : 'Takes about 15 minutes. Your progress saves at every beacon.',
    buttons: run ? [{ label: 'Continue (' + run.lit.length + ' / 4 lit)', onClick: () => newGame(run) }, { label: 'New world', onClick: () => newGame() }] : [{ label: 'Light the lantern', onClick: () => newGame() }],
  });
  Arcade.loop({ update, render }).start();
})();
