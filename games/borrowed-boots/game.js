// Borrowed Boots: a platformer where you have no powers of your own. Land on a
// creature to borrow its trick. You hold one at a time, and getting hurt drops
// it. Levels come from levels.js.
(function () {
  const LEVELS = window.BootsLevels;
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  input.touchPad(['left', 'right', 'a']);
  const save = Arcade.save('borrowed-boots');

  const DISPLAY = '"Fredoka", "Trebuchet MS", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Borrowed Boots',
    tagline: 'No powers. Lots of friends.',
    how: [['← → / A D', 'Run'], ['Space / ↑', 'Jump. Hold it to jump higher'], ['Land on a critter', 'Borrow its trick'], ['Get hurt', 'and you drop it']],
    // Borrowed Boots' own look: a storybook. Soft greens, cream and a tomato red.
    theme: {
      fonts: 'family=Fredoka:wght@500;600;700',
      display: DISPLAY, body: DISPLAY,
      overlay: 'rgba(40, 90, 60, .55)',
      panel: '#fff8e7', panel2: '#e9f5db', edge: '#386641',
      text: '#283618', muted: '#6a7a52',
      accent: '#f25f5c', accentInk: '#ffffff',
      radius: '30px', border: '4px',
      shadow: '0 8px 0 #386641', buttonShadow: '0 5px 0 rgba(56, 102, 65, .35)',
      titleSize: 'clamp(2rem, 9vw, 2.8rem)',
    },
  });

  const G = 40, RUN = 7, JUMP = 15, SPRING = 22, GLIDE = 1.8, CLIMB = 5, PW = 0.7, PH = 0.9;
  const POWERS = {
    b: { name: 'Spring legs', color: '#ffb703', hint: 'Jumps much higher' },
    g: { name: 'Gecko claws', color: '#52b788', hint: 'Walk into a wall to climb it' },
    o: { name: 'Owl tail', color: '#9c89b8', hint: 'Hold Jump in the air to glide' },
    t: { name: 'Turtle shell', color: '#6b9080', hint: 'Land on cracked rock to smash it' },
  };

  let state = 'menu', level = Math.min(save.get('level', 1), LEVELS.length);
  let map, cols, rows, p, critters, stars, got, spawnAt, endT, time = 0, cam = { x: 0, y: 0 }, bursts;

  const tile = (x, y) => (x < 0 || x >= cols ? '#' : y < 0 || y >= rows ? '.' : map[y][x]);
  const solid = (ch) => ch === '#' || ch === 'C';

  function load(n) {
    level = n;
    map = LEVELS[n - 1].map.map((r) => r.split(''));
    rows = map.length; cols = map[0].length;
    critters = []; stars = []; got = 0; bursts = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const ch = map[y][x];
      if (ch === 'S') spawnAt = { x: x + 0.5, y: y + 1 };
      if ('bgot'.includes(ch)) critters.push({ type: ch, home: x + 0.5, x: x + 0.5, y: y + 1, dir: 1, gone: 0 });
      if (ch === '*') stars.push({ x: x + 0.5, y: y + 0.5, taken: false });
      if ('Sbgot*'.includes(ch)) map[y][x] = '.';
    }
    respawn(true);
    endT = 0;
    ui.hide(); input.flush(); state = 'playing';
    ui.toast(LEVELS[n - 1].tip, 3200);
  }
  function respawn(first) {
    p = { x: spawnAt.x, y: spawnAt.y, vx: 0, vy: 0, ground: false, power: null, hurt: first ? 0 : 1, coyote: 0, buffer: 0, face: 1, wall: 0 };
  }

  // Move along one axis and stop at rock. y is the player's feet.
  function moveX(dx) {
    p.x += dx;
    const top = Math.floor(p.y - PH + 0.01), bot = Math.floor(p.y - 0.01);
    const edge = dx > 0 ? p.x + PW / 2 : p.x - PW / 2;
    const tx = Math.floor(edge);
    for (let ty = top; ty <= bot; ty++) if (solid(tile(tx, ty))) { p.x = dx > 0 ? tx - PW / 2 - 0.001 : tx + 1 + PW / 2 + 0.001; p.wall = dx > 0 ? 1 : -1; return; }
    p.wall = 0;
  }
  function moveY(dy) {
    const falling = dy > 0, speed = p.vy;
    p.y += dy;
    const l = Math.floor(p.x - PW / 2 + 0.01), r = Math.floor(p.x + PW / 2 - 0.01);
    if (falling) {
      const ty = Math.floor(p.y);
      for (let tx = l; tx <= r; tx++) {
        if (!solid(tile(tx, ty))) continue;
        if (tile(tx, ty) === 'C' && p.power === 't' && speed > 9) { smash(tx, ty); return; }
        p.y = ty; p.vy = 0; p.ground = true; return;
      }
      p.ground = false;
    } else {
      const ty = Math.floor(p.y - PH);
      for (let tx = l; tx <= r; tx++) if (solid(tile(tx, ty))) { p.y = ty + 1 + PH; p.vy = 0; return; }
    }
  }
  function smash(x0, y0) {
    const todo = [[x0, y0]];
    while (todo.length) {
      const [x, y] = todo.pop();
      if (tile(x, y) !== 'C') continue;
      map[y][x] = '.';
      bursts.push({ x: x + 0.5, y: y + 0.5, t: 0, color: '#a68a64' });
      todo.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    Arcade.audio.sfx('thud', { vol: 0.7 });
  }

  function hurt() {
    if (p.hurt > 0) return;
    if (p.power) { p.power = null; p.hurt = 1.2; p.vy = -9; p.vx = -p.face * 6; Arcade.audio.sfx('hit'); return; }
    Arcade.audio.sfx('lose', { dur: 0.3 });
    respawn(false);
  }

  function update(dt) {
    input.poll();
    time += dt;
    bursts.forEach((b) => { b.t += dt; }); bursts = bursts.filter((b) => b.t < 0.5);
    if (state !== 'playing' || ui.visible) {
      if (state === 'won') { endT += dt; if (endT > 1 && !ui.visible) results(); }
      return;
    }
    const k = input.solo;
    p.hurt = Math.max(0, p.hurt - dt);
    // run
    const want = k.x * RUN;
    p.vx += (want - p.vx) * Math.min(1, dt * (p.ground ? 18 : 8));
    if (k.x) p.face = k.x;
    // jump, with a little forgiveness either side of leaving the ground
    p.coyote = p.ground ? 0.1 : p.coyote - dt;
    p.buffer = k.pressed('a') || k.pressed('up') ? 0.12 : p.buffer - dt;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -(p.power === 'b' ? SPRING : JUMP); p.ground = false; p.coyote = 0; p.buffer = 0;
      Arcade.audio.sfx('jump', { freq: p.power === 'b' ? 200 : 300 });
    }
    const holding = k.held('a') || k.held('up');
    if (!holding && p.vy < -5) p.vy = -5;                 // short hop on a quick tap
    p.vy += G * dt;
    if (p.power === 'o' && holding && p.vy > GLIDE) p.vy = GLIDE;
    if (p.power === 'g' && p.wall && (k.x === p.wall || k.held('up'))) p.vy = -CLIMB;
    p.vy = Math.min(p.vy, 24);
    moveX(p.vx * dt);
    // two half steps so fast falls can't skip through thin rock
    moveY((p.vy * dt) / 2); moveY((p.vy * dt) / 2);

    const feet = Math.floor(p.y + 0.05), mid = Math.floor(p.y - PH / 2);
    if ([Math.floor(p.x - 0.3), Math.floor(p.x + 0.3)].some((x) => tile(x, Math.floor(p.y - 0.1)) === '^' || tile(x, feet) === '^')) hurt();
    if (p.y > rows + 2) { Arcade.audio.sfx('lose', { dur: 0.3 }); respawn(false); }
    if (tile(Math.floor(p.x), mid) === 'k' || tile(Math.floor(p.x), Math.floor(p.y - 0.1)) === 'k') {
      const cy = Math.floor(p.y - 0.1);
      if (tile(Math.floor(p.x), cy) === 'k') { spawnAt = { x: Math.floor(p.x) + 0.5, y: cy + 1 }; map[cy][Math.floor(p.x)] = 'K'; Arcade.audio.sfx('select'); }
    }
    if (tile(Math.floor(p.x), Math.floor(p.y - 0.1)) === 'F' || tile(Math.floor(p.x), mid) === 'F') { state = 'won'; endT = 0; Arcade.audio.sfx('win'); }
    for (const s of stars) if (!s.taken && Math.abs(s.x - p.x) < 0.6 && Math.abs(s.y - (p.y - PH / 2)) < 0.8) { s.taken = true; got++; Arcade.audio.sfx('coin'); }

    // critters pace on their ledge; land on one to borrow its trick
    for (const c of critters) {
      if (c.gone > 0) { c.gone -= dt; continue; }
      const ahead = c.x + c.dir * 0.4;
      if (Math.abs(c.x + c.dir * dt * 1.5 - c.home) > 2.5 || solid(tile(Math.floor(ahead), Math.floor(c.y - 0.5))) || !solid(tile(Math.floor(ahead), Math.floor(c.y + 0.1)))) c.dir = -c.dir;
      c.x += c.dir * 1.5 * dt;
      if (Math.abs(c.x - p.x) < 0.65 && p.y > c.y - 0.9 && p.y - PH < c.y) {
        if (p.vy > 0 && p.y < c.y - 0.35) {
          p.power = c.type; p.vy = -10; c.gone = 4; p.hurt = 0;
          bursts.push({ x: c.x, y: c.y - 0.4, t: 0, color: POWERS[c.type].color });
          ui.toast(POWERS[c.type].name + ': ' + POWERS[c.type].hint, 2200);
          Arcade.audio.sfx('select');
        } else hurt();
      }
    }
    cam.x += (Math.max(0, Math.min(cols - W / TS(), p.x - W / TS() / 2)) - cam.x) * Math.min(1, dt * 6);
    cam.y += (Math.max(0, Math.min(rows - H / TS(), p.y - H / TS() * 0.55)) - cam.y) * Math.min(1, dt * 6);
  }

  function results() {
    const all = save.get('stars', {});
    all[level] = Math.max(all[level] || 0, got);
    save.set('stars', all);
    if (level < LEVELS.length) save.set('level', Math.max(save.get('level', 1), level + 1));
    const total = Object.values(all).reduce((a, b) => a + b, 0), max = LEVELS.reduce((n, l) => n + [...l.map.join('')].filter((c) => c === '*').length, 0);
    ui.results({
      heading: level === LEVELS.length ? 'Top of the mountain!' : 'Made it!',
      rows: [[LEVELS[level - 1].name, got + ' / ' + stars.length + ' ★'], ['All stars', total + ' / ' + max]],
      buttons: level < LEVELS.length ? [{ label: 'Next level', onClick: () => load(level + 1) }, { label: 'Replay', onClick: () => load(level) }]
        : [{ label: 'Replay', onClick: () => load(level) }, { label: 'Level 1', onClick: () => load(1) }],
    });
  }

  // ---------- drawing ----------
  const TS = () => Math.max(28, Math.min(H / 13, W / 16));
  function critter(type, x, y, s, flip) {
    ctx.save(); ctx.translate(x, y); ctx.scale(flip, 1);
    ctx.fillStyle = POWERS[type].color; ctx.strokeStyle = '#283618'; ctx.lineWidth = 2;
    if (type === 'b') { ctx.beginPath(); ctx.ellipse(0, -s * 0.45, s * 0.38, s * 0.32, 0, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#283618'; ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.15); ctx.lineTo(-s * 0.25, 0); ctx.lineTo(-s * 0.05, -s * 0.05); ctx.lineTo(-s * 0.15, 0); ctx.stroke(); }
    if (type === 'g') { ctx.beginPath(); ctx.ellipse(0, -s * 0.18, s * 0.42, s * 0.16, 0, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.2); ctx.quadraticCurveTo(-s * 0.7, -s * 0.5, -s * 0.5, -s * 0.05); ctx.stroke(); }
    if (type === 'o') { ctx.beginPath(); ctx.ellipse(0, -s * 0.42, s * 0.3, s * 0.38, 0, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.1, -s * 0.55, s * 0.09, 0, 6.3); ctx.fill(); }
    if (type === 't') { ctx.beginPath(); ctx.arc(0, -s * 0.12, s * 0.42, Math.PI, 0); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#a4c3b2'; ctx.beginPath(); ctx.arc(s * 0.45, -s * 0.2, s * 0.12, 0, 6.3); ctx.fill(); }
    ctx.fillStyle = '#283618'; ctx.beginPath(); ctx.arc(s * 0.18, type === 'g' ? -s * 0.2 : -s * 0.5, s * 0.05, 0, 6.3); ctx.fill();
    ctx.restore();
  }

  function render() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#87c7ff'); sky.addColorStop(1, '#e9f5db');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // painted hills, two depths
    const t = TS();
    for (const [depth, color, base] of [[0.2, '#b5d99c', 0.62], [0.45, '#90c290', 0.74]]) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 16) ctx.lineTo(x, H * base - Math.sin((x + (cam.x || 0) * t * depth) * 0.008) * 40);
      ctx.lineTo(W, H); ctx.fill();
    }
    if (state === 'menu') return;
    const X = (v) => (v - cam.x) * t, Y = (v) => (v - cam.y) * t;
    const x0 = Math.floor(cam.x), x1 = Math.ceil(cam.x + W / t), y0 = Math.floor(cam.y), y1 = Math.ceil(cam.y + H / t);
    for (let y = Math.max(0, y0); y < Math.min(rows, y1); y++) for (let x = Math.max(0, x0); x < Math.min(cols, x1); x++) {
      const ch = map[y][x], px = X(x), py = Y(y);
      if (ch === '#') {
        const topEdge = y === 0 || !solid(map[y - 1][x]);
        ctx.fillStyle = '#7f5539'; ctx.fillRect(px, py, t + 0.5, t + 0.5);
        if (topEdge) { ctx.fillStyle = '#6a994e'; ctx.fillRect(px, py, t + 0.5, t * 0.28); ctx.fillStyle = '#a7c957'; ctx.fillRect(px, py, t + 0.5, t * 0.1); }
      } else if (ch === 'C') {
        ctx.fillStyle = '#b08968'; ctx.fillRect(px, py, t + 0.5, t + 0.5);
        ctx.strokeStyle = '#5c4033'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + t * 0.2, py); ctx.lineTo(px + t * 0.45, py + t * 0.5); ctx.lineTo(px + t * 0.3, py + t); ctx.moveTo(px + t * 0.45, py + t * 0.5); ctx.lineTo(px + t * 0.85, py + t * 0.4); ctx.stroke();
      } else if (ch === '^') {
        ctx.fillStyle = '#d9d9d9'; ctx.strokeStyle = '#495057'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px + (i / 3) * t, py + t); ctx.lineTo(px + ((i + 0.5) / 3) * t, py + t * 0.35); ctx.lineTo(px + ((i + 1) / 3) * t, py + t); ctx.fill(); ctx.stroke(); }
      } else if (ch === 'F') {
        ctx.fillStyle = '#283618'; ctx.fillRect(px + t * 0.45, py - t, t * 0.08, t * 2);
        ctx.fillStyle = '#f25f5c'; ctx.beginPath(); ctx.moveTo(px + t * 0.53, py - t); ctx.lineTo(px + t * 1.1, py - t * 0.7 + Math.sin(time * 4) * 3); ctx.lineTo(px + t * 0.53, py - t * 0.4); ctx.fill();
      } else if (ch === 'k' || ch === 'K') {
        ctx.fillStyle = '#283618'; ctx.fillRect(px + t * 0.45, py + t * 0.1, t * 0.06, t * 0.9);
        ctx.fillStyle = ch === 'K' ? '#ffb703' : '#adb5bd'; ctx.fillRect(px + t * 0.51, py + t * 0.1, t * 0.36, t * 0.24);
      }
    }
    for (const s of stars) if (!s.taken) {
      const cx = X(s.x), cy = Y(s.y) + Math.sin(time * 3 + s.x) * 3;
      ctx.fillStyle = '#ffd60a'; ctx.strokeStyle = '#b08900'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? t * 0.15 : t * 0.34; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    for (const c of critters) if (c.gone <= 0) critter(c.type, X(c.x), Y(c.y), t, c.dir);
    for (const b of bursts) { ctx.globalAlpha = 1 - b.t * 2; ctx.fillStyle = b.color; for (let i = 0; i < 6; i++) { const a = i * 1.05; ctx.beginPath(); ctx.arc(X(b.x) + Math.cos(a) * b.t * t * 2, Y(b.y) + Math.sin(a) * b.t * t * 2, t * 0.12, 0, 6.3); ctx.fill(); } ctx.globalAlpha = 1; }

    // the hero: a round little thing in red boots; borrowed tricks show on them
    if (!(p.hurt > 0 && Math.floor(time * 14) % 2)) {
      const hx = X(p.x), hy = Y(p.y), s = t;
      if (p.power === 'o' && p.vy > 0 && (input.solo.held('a') || input.solo.held('up'))) { ctx.fillStyle = POWERS.o.color; ctx.beginPath(); ctx.ellipse(hx, hy - s * 0.95, s * 0.9, s * 0.18, 0, 0, 6.3); ctx.fill(); }
      if (p.power === 't') { ctx.fillStyle = POWERS.t.color; ctx.beginPath(); ctx.arc(hx - p.face * s * 0.08, hy - s * 0.45, s * 0.42, Math.PI * 0.9, Math.PI * 2.1); ctx.fill(); }
      ctx.fillStyle = '#fff8e7'; ctx.strokeStyle = '#283618'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(hx, hy - s * 0.5, s * 0.33, s * 0.38, 0, 0, 6.3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#283618'; ctx.beginPath(); ctx.arc(hx + p.face * s * 0.12, hy - s * 0.58, s * 0.05, 0, 6.3); ctx.fill();
      const step = p.ground ? Math.sin(time * 18) * Math.min(1, Math.abs(p.vx) / RUN) * s * 0.08 : 0;
      ctx.fillStyle = p.power ? POWERS[p.power].color : '#f25f5c';
      ctx.fillRect(hx - s * 0.28, hy - s * 0.16 + step, s * 0.22, s * 0.16); ctx.fillRect(hx + s * 0.06, hy - s * 0.16 - step, s * 0.22, s * 0.16);
      if (p.power === 'g') { ctx.strokeStyle = POWERS.g.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx + p.face * s * 0.3, hy - s * 0.4); ctx.lineTo(hx + p.face * s * 0.45, hy - s * 0.5); ctx.stroke(); }
    }

    // HUD: a little paper tag
    ctx.fillStyle = 'rgba(255, 248, 231, .95)'; ctx.strokeStyle = '#386641'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(12, 12, 250, 62, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#283618'; ctx.textAlign = 'left'; ctx.font = `700 18px ${DISPLAY}`;
    ctx.fillText(level + '. ' + LEVELS[level - 1].name, 28, 38);
    ctx.font = `600 15px ${DISPLAY}`; ctx.fillStyle = '#6a7a52';
    ctx.fillText('★ ' + got + ' / ' + stars.length + '   ' + (p.power ? POWERS[p.power].name : 'No trick'), 28, 60);
    if (p.power) { ctx.fillStyle = POWERS[p.power].color; ctx.beginPath(); ctx.arc(244, 52, 8, 0, 6.3); ctx.fill(); }
  }

  ui.onPause(() => { if (state === 'playing') ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart: () => load(level) }); });
  ui.title({ buttons: level > 1 ? [{ label: 'Continue: level ' + level, onClick: () => load(level) }, { label: 'Start from level 1', onClick: () => load(1) }] : [{ label: 'Play', onClick: () => load(1) }] });
  Arcade.loop({ update, render }).start();
})();
