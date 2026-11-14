// Knot Alone: two climbers on one rope, one keyboard. Ledges can be jumped up
// through from below. A 2-high step is a normal jump; a 3-high step needs a
// boost off your partner's head. Anchor yourself and you can reel your
// partner up to you, or let rope out. Both must reach the summit flag.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  const save = Arcade.save('knot-alone');

  const DISPLAY = '"Righteous", "Trebuchet MS", sans-serif';
  const BODY = '"Nunito Sans", "Segoe UI", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Knot Alone',
    tagline: 'Two climbers. One rope. No solo summits.',
    how: [['Red', 'A D move · W jump · hold F to anchor'], ['Blue', '← → move · ↑ jump · hold Enter to anchor'], ['While anchored', 'Up reels your partner in, down lets rope out'], ['Too high?', 'Stand on your partner\'s head and jump']],
    // Knot Alone's own look: alpine morning. Snow white, glacier blue, rope orange.
    theme: {
      fonts: 'family=Righteous&family=Nunito+Sans:wght@600;800',
      display: DISPLAY, body: BODY,
      overlay: 'rgba(30, 60, 90, .55)',
      panel: '#ffffff', panel2: '#e6f2fb', edge: '#264653',
      text: '#264653', muted: '#5c7c8a',
      accent: '#e76f51', accentInk: '#ffffff',
      radius: '14px', border: '0px',
      shadow: '0 18px 40px rgba(38, 70, 83, .35)', buttonShadow: '0 4px 0 rgba(38, 70, 83, .2)',
    },
  });

  const COLS = 20, G = 40, RUN = 5, JUMP = 13.5, PW = 0.6, PH = 0.9, ROPE_MIN = 1.2, ROPE_MAX = 6.5, LEVELS = 10;
  const TEAM = [{ color: '#e76f51', dark: '#a0432c', kb: 'kb1', pad: 'pad0' }, { color: '#2a9d8f', dark: '#1d6d63', kb: 'kb2', pad: 'pad1' }];

  // Ledges climb from the floor in steps of 2 or 3, alternating sides, getting
  // narrower. Every step can be made by a boost (3) or a plain jump (2).
  function makeLevel(n) {
    const rand = Arcade.rng(Arcade.rng.hash('knot-alone:' + n));
    const count = 5 + n;
    const ledges = [{ x: 1, y: 0, w: COLS - 2 }];
    let y = 0, side = rand() < 0.5 ? 0 : 1;
    for (let i = 0; i < count; i++) {
      y += rand() < 0.3 + n * 0.06 ? 3 : 2;
      const w = Math.max(3, 8 - Math.floor(n / 2) - (rand() < 0.4 ? 1 : 0));
      const prev = ledges[ledges.length - 1];
      // overlap the previous ledge a little so a jump from its edge can land
      let x = side ? Math.min(COLS - 1 - w, prev.x + prev.w - 2) : Math.max(1, prev.x - w + 2);
      if (i === 0) x = side ? COLS - 1 - w - 2 : 3;
      ledges.push({ x, y, w });
      side = 1 - side;
    }
    const top = ledges[ledges.length - 1];
    return { ledges, rows: y + 6, flag: top };
  }

  let state = 'menu', level = Math.min(save.get('level', 1), LEVELS), lv, solid, climbers, rope, ropeLen, t0, endT, camY = 0, time = 0;

  function load(n) {
    level = n; lv = makeLevel(n);
    solid = new Set();
    for (const l of lv.ledges) for (let x = l.x; x < l.x + l.w; x++) solid.add(x + ',' + l.y);
    climbers = [0, 1].map((i) => ({ i, x: 7 + i * 3, y: 0, vx: 0, vy: 0, ground: true, pinned: false, face: 1 }));
    ropeLen = 4;
    rope = Array.from({ length: 14 }, (_, k) => ({ x: 7 + (3 * k) / 13, y: -0.5, px: 7 + (3 * k) / 13, py: -0.5 }));
    t0 = time; endT = 0; camY = 0;
    ui.hide(); input.flush(); state = 'playing';
  }
  // Heights count up from the floor (0). A ledge at height y is walked on at y; a climber's y is their feet.
  const ledgeAt = (x, y) => solid.has(Math.floor(x) + ',' + y);

  function controls(c) {
    const kb = input.device(TEAM[c.i].kb), pad = input.device(TEAM[c.i].pad);
    return {
      x: kb.x || pad.x,
      jump: kb.pressed('up') || pad.pressed('a'),
      up: kb.held('up') || pad.held('up'),
      down: kb.held('down') || pad.held('down'),
      anchor: kb.held('a') || pad.held('b'),
    };
  }

  function step(c, k, other, dt) {
    if (k.anchor && (c.ground || c.pinned)) {
      if (!c.pinned) Arcade.audio.beep({ freq: 900, dur: 0.04, type: 'square', vol: 0.15 });
      c.pinned = true; c.vx = 0; c.vy = 0;
      if (k.up) ropeLen = Math.max(ROPE_MIN, ropeLen - 3 * dt);
      if (k.down) ropeLen = Math.min(ROPE_MAX, ropeLen + 3 * dt);
      return;
    }
    c.pinned = false;
    if (k.x) c.face = k.x;
    c.vx += (k.x * RUN - c.vx) * Math.min(1, dt * (c.ground ? 16 : 6));
    if (k.jump && c.ground) { c.vy = JUMP; c.ground = false; Arcade.audio.sfx('jump', { vol: 0.12 }); }
    c.vy -= G * dt;
    c.x = Math.max(1 + PW / 2, Math.min(COLS - 1 - PW / 2, c.x + c.vx * dt));
    const before = c.y;
    c.y += c.vy * dt;
    c.ground = false;
    if (c.vy <= 0) {
      // land on a ledge we were above (ledges are one-way: you can jump up through them)
      for (let top = Math.floor(before); top >= Math.ceil(c.y); top--) {
        if (before >= top - 0.0001 && c.y <= top && [c.x - PW / 2 + 0.05, c.x + PW / 2 - 0.05].some((fx) => ledgeAt(fx, top))) { c.y = top; c.vy = 0; c.ground = true; break; }
      }
      if (c.y <= 0) { c.y = 0; c.vy = 0; c.ground = true; }
      // stand on your partner's head
      if (!c.ground && Math.abs(c.x - other.x) < PW && before >= other.y + PH - 0.001 && c.y <= other.y + PH) { c.y = other.y + PH; c.vy = 0; c.ground = true; }
    }
  }

  // Keep the two within rope length. A pinned climber never moves; otherwise share the pull.
  function tie() {
    const [a, b] = climbers;
    const dx = b.x - a.x, dy = (b.y + PH / 2) - (a.y + PH / 2), d = Math.hypot(dx, dy);
    if (a.pinned && b.pinned) { ropeLen = Math.max(ropeLen, d); return; }
    if (d <= ropeLen || d === 0) return;
    const over = d - ropeLen, nx = dx / d, ny = dy / d;
    const share = a.pinned ? [0, 1] : b.pinned ? [1, 0] : [0.5, 0.5];
    a.x += nx * over * share[0]; a.y += ny * over * share[0];
    b.x -= nx * over * share[1]; b.y -= ny * over * share[1];
    // remove the part of each climber's speed that stretches the rope (this makes swinging work)
    for (const [c, s] of [[a, -1], [b, 1]]) {
      const along = (c.vx * nx + c.vy * ny) * s;
      if (along > 0) { c.vx -= along * nx * s; c.vy -= along * ny * s; }
      c.x = Math.max(1 + PW / 2, Math.min(COLS - 1 - PW / 2, c.x));
      if (c.y < 0) c.y = 0;
    }
  }

  function update(dt) {
    input.poll();
    time += dt;
    if (state !== 'playing' || ui.visible) {
      if (state === 'won') { endT += dt; if (endT > 1.2 && !ui.visible) results(); }
      return;
    }
    const ks = climbers.map(controls);
    climbers.forEach((c, i) => step(c, ks[i], climbers[1 - i], dt));
    for (let k = 0; k < 3; k++) tie();
    // the drawn rope: a chain of points that sags under gravity, ends tied to the climbers
    const ends = climbers.map((c) => ({ x: c.x, y: c.y + PH * 0.55 }));
    rope[0].x = ends[0].x; rope[0].y = ends[0].y; rope[rope.length - 1].x = ends[1].x; rope[rope.length - 1].y = ends[1].y;
    for (let k = 1; k < rope.length - 1; k++) { const q = rope[k], vx = (q.x - q.px) * 0.96, vy = (q.y - q.py) * 0.96; q.px = q.x; q.py = q.y; q.x += vx; q.y += vy - 9 * dt * dt; }
    const seg = ropeLen / (rope.length - 1);
    for (let it = 0; it < 6; it++) for (let k = 0; k < rope.length - 1; k++) {
      const p = rope[k], q = rope[k + 1], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1, diff = (d - seg) / d / 2;
      if (k > 0) { p.x += dx * diff; p.y += dy * diff; }
      if (k + 1 < rope.length - 1) { q.x -= dx * diff; q.y -= dy * diff; }
    }
    const f = lv.flag, inFlag = (c) => (c.ground || c.pinned) && Math.abs(c.y - f.y) < 0.01 && c.x > f.x && c.x < f.x + f.w;
    if (climbers.every(inFlag)) { state = 'won'; endT = 0; Arcade.audio.sfx('win'); }
    const mid = (climbers[0].y + climbers[1].y) / 2;
    camY += (mid - camY) * Math.min(1, dt * 4);
  }

  function results() {
    const secs = Math.round(time - t0), key = 'best' + level, best = Math.min(secs, save.get(key, 9999));
    save.set(key, best);
    if (level < LEVELS) save.set('level', Math.max(save.get('level', 1), level + 1));
    ui.results({
      heading: level === LEVELS ? 'Summit of summits!' : 'Summit!',
      rows: [['Climb', level + ' / ' + LEVELS], ['Time', secs + ' s'], ['Best', best + ' s']],
      buttons: level < LEVELS ? [{ label: 'Next climb', onClick: () => load(level + 1) }, { label: 'Again', onClick: () => load(level) }] : [{ label: 'Climb 1', onClick: () => load(1) }],
    });
  }

  function render() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#8ecae6'); sky.addColorStop(1, '#dceefb');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // far peaks
    ctx.fillStyle = '#b8d8ec';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H * 0.55 - Math.abs(Math.sin(x * 0.011 + camY * 0.02)) * H * 0.3);
    ctx.lineTo(W, H); ctx.fill();
    if (state === 'menu') return;
    const u = Math.min(W / COLS, H / 12), ox = (W - COLS * u) / 2;
    const X = (v) => ox + v * u, Y = (v) => H * 0.62 - (v - camY) * u;
    // the cliff face
    ctx.fillStyle = 'rgba(38, 70, 83, .12)'; ctx.fillRect(X(0), 0, u, H); ctx.fillRect(X(COLS - 1), 0, u, H);
    for (const l of lv.ledges) {
      ctx.fillStyle = '#6c757d'; ctx.fillRect(X(l.x), Y(l.y), l.w * u, u * (l.y ? 0.7 : 3));
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(X(l.x) - 2, Y(l.y) - u * 0.12, l.w * u + 4, u * 0.3, u * 0.1); ctx.fill();
    }
    const f = lv.flag;
    ctx.fillStyle = '#264653'; ctx.fillRect(X(f.x + f.w / 2) - 2, Y(f.y + 2.2), 4, u * 2.2);
    ctx.fillStyle = '#e9c46a'; ctx.beginPath(); ctx.moveTo(X(f.x + f.w / 2) + 2, Y(f.y + 2.2)); ctx.lineTo(X(f.x + f.w / 2) + u * 1.1, Y(f.y + 1.9) + Math.sin(time * 5) * 3); ctx.lineTo(X(f.x + f.w / 2) + 2, Y(f.y + 1.5)); ctx.fill();
    // rope
    const taut = Math.hypot(climbers[1].x - climbers[0].x, climbers[1].y - climbers[0].y) > ropeLen - 0.05;
    ctx.strokeStyle = taut ? '#d62828' : '#f4a261'; ctx.lineWidth = Math.max(3, u * 0.12); ctx.lineCap = 'round';
    ctx.beginPath(); rope.forEach((q, k) => (k ? ctx.lineTo(X(q.x), Y(q.y)) : ctx.moveTo(X(q.x), Y(q.y)))); ctx.stroke();
    // climbers
    for (const c of climbers) {
      const T = TEAM[c.i], x = X(c.x), y = Y(c.y);
      ctx.fillStyle = T.color; ctx.beginPath(); ctx.roundRect(x - u * 0.3, y - u * 0.75, u * 0.6, u * 0.75, u * 0.15); ctx.fill();
      ctx.fillStyle = '#ffe8d6'; ctx.beginPath(); ctx.arc(x, y - u * 0.85, u * 0.2, 0, 6.3); ctx.fill();
      ctx.fillStyle = T.dark; ctx.fillRect(x - u * 0.22, y - u * 1.05, u * 0.44, u * 0.12);
      ctx.fillStyle = '#264653'; ctx.beginPath(); ctx.arc(x + c.face * u * 0.08, y - u * 0.86, u * 0.04, 0, 6.3); ctx.fill();
      if (c.pinned) { ctx.strokeStyle = '#264653'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + u * 0.25, y + u * 0.2); ctx.stroke(); ctx.fillStyle = '#264653'; ctx.font = `800 ${Math.round(u * 0.32)}px ${BODY}`; ctx.textAlign = 'center'; ctx.fillText('⚓', x, y - u * 1.25); }
    }
    // HUD: altitude and rope length on a snowy card
    const height = Math.max(climbers[0].y, climbers[1].y), goal = lv.flag.y;
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.roundRect(12, 12, 210, 66, 14); ctx.fill();
    ctx.fillStyle = '#264653'; ctx.textAlign = 'left'; ctx.font = `20px ${DISPLAY}`; ctx.fillText('Climb ' + level, 26, 38);
    ctx.font = `800 13px ${BODY}`; ctx.fillStyle = '#5c7c8a';
    ctx.fillText('Altitude ' + Math.round((height / goal) * 100) + '%  ·  Rope ' + ropeLen.toFixed(1) + ' m', 26, 62);
  }

  ui.onPause(() => { if (state === 'playing') ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart: () => load(level) }); });
  ui.title({ note: 'For two players on one keyboard, or two gamepads.', buttons: level > 1 ? [{ label: 'Continue: climb ' + level, onClick: () => load(level) }, { label: 'Start from climb 1', onClick: () => load(1) }] : [{ label: 'Rope up', onClick: () => load(1) }] });
  Arcade.loop({ update, render }).start();
})();
