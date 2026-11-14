// Bonk Brawl: a platform fighter for 2 to 4 on one device. Every hit raises
// a fighter's damage, and the higher it is the further the next hit sends
// them. Fall off the screen and you lose a life. Last one standing wins.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });

  const DISPLAY = '"Bangers", "Impact", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Bonk Brawl',
    tagline: 'Hit them until they fly.',
    how: [['Move / jump', 'Left, right, up (twice for a double jump)'], ['Quick hit', 'F  ·  Enter  ·  O  ·  pad A'], ['Big hit', 'G  ·  Right Shift  ·  P  ·  pad B'], ['Players', 'WASD  ·  arrows  ·  IJKL  ·  number pad  ·  gamepads']],
    // Bonk Brawl's own look: a comic book page. Yellow, red, thick black ink.
    theme: {
      fonts: 'family=Bangers',
      display: DISPLAY, body: '"Comic Sans MS", "Trebuchet MS", sans-serif',
      overlay: 'rgba(255, 228, 92, .82)',
      panel: '#ffffff', panel2: '#fff3b0', edge: '#111111',
      text: '#111111', muted: '#444444',
      accent: '#ef233c', accentInk: '#ffffff',
      radius: '4px', border: '5px',
      shadow: '10px 10px 0 #111111', buttonShadow: '4px 4px 0 #111111',
      caps: 'uppercase', titleSize: 'clamp(2.6rem, 12vw, 3.8rem)',
    },
  });

  const VW = 16, VH = 9, GRAV = 40;
  // Four fighters with different feels.
  const CHARS = [
    { name: 'Rascal', color: '#8d99ae', speed: 6.5, jump: 15, weight: 1, power: 1 },       // raccoon: all-rounder
    { name: 'Clank', color: '#4cc9f0', speed: 5, jump: 14, weight: 1.35, power: 1.25 },    // wind-up robot: slow, heavy, hits hard
    { name: 'Sumo', color: '#70e000', speed: 5.6, jump: 18, weight: 1.2, power: 1.1 },     // frog: big jumps
    { name: 'Zephyr', color: '#ff70a6', speed: 7.6, jump: 15, weight: 0.8, power: 0.9 },   // kite pilot: fast, light, floaty
  ];
  const STAGES = [
    [[3, 6.6, 10, true], [4.2, 4.4, 2.6], [9.2, 4.4, 2.6]],
    [[4, 6.6, 8, true], [1.6, 5, 2.2], [12.2, 5, 2.2], [6.7, 3.6, 2.6]],
    [[2.5, 6.8, 4.5, true], [9, 6.8, 4.5, true], [6.6, 4.6, 2.8]],
  ];
  const KEYS = ['kb1', 'kb2', 'kb3', 'kb4'];

  let state = 'menu';
  let fighters, stage, humans, sparks, time = 0, endT, rand = Arcade.rng();

  function startMatch(humanCount, total) {
    humans = humanCount;
    stage = rand.pick(STAGES);
    fighters = Array.from({ length: total }, (_, i) => ({ i, c: CHARS[i], stocks: 3, bot: i >= humanCount, out: false }));
    fighters.forEach((f, i) => spawn(f, 5 + (i * 6) / Math.max(1, total - 1)));
    sparks = []; endT = 0;
    ui.hide(); input.flush();
    state = 'playing';
  }
  function spawn(f, x) {
    Object.assign(f, { x: x === undefined ? 8 : x, y: 1.5, vx: 0, vy: 0, face: f.i % 2 ? -1 : 1, dmg: 0, jumps: 0, ground: false, atk: null, stun: 0, safe: 2, think: 0 });
  }

  function attack(f, heavy) {
    if (f.atk || f.stun > 0) return;
    f.atk = { heavy, t: 0, hit: false, at: heavy ? 0.28 : 0.08, end: heavy ? 0.55 : 0.25 };
    Arcade.audio.beep({ freq: heavy ? 150 : 320, dur: 0.06, type: 'square', vol: 0.12 });
  }

  function land(f, prevY) {
    f.ground = false;
    for (const [px, py, pw, solid] of stage) {
      if (f.x < px - 0.2 || f.x > px + pw + 0.2) continue;
      if (f.vy >= 0 && prevY <= py + 0.001 && f.y >= py && !(f.drop > 0 && !solid)) {
        f.y = py; f.vy = 0; f.ground = true; f.jumps = 0;
      }
    }
  }

  function control(f, dt) {
    let x = 0, jump = false, light = false, heavy = false, down = false;
    if (f.bot) {
      f.think -= dt;
      const foe = fighters.filter((o) => o !== f && !o.out).sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x))[0];
      const offstage = !stage.some(([px, , pw]) => f.x > px && f.x < px + pw);
      if (offstage) { x = f.x < 8 ? 1 : -1; jump = f.vy > 2; }
      else if (foe) {
        const dx = foe.x - f.x, dy = foe.y - f.y;
        x = Math.abs(dx) > 1 ? Math.sign(dx) : 0;
        if (Math.abs(dx) < 1.3 && Math.abs(dy) < 1.2 && f.think <= 0) { f.face = Math.sign(dx) || f.face; heavy = rand() < 0.3; light = !heavy; f.think = 0.35 + rand() * 0.4; }
        if (dy < -1.4 && f.ground && rand() < 0.05) jump = true;
      }
    } else {
      const k = input.device(KEYS[f.i]), pad = input.device('pad' + f.i);
      x = k.x || pad.x;
      jump = k.pressed('up') || pad.pressed('up');
      down = k.held('down') || pad.held('down');
      light = k.pressed('a') || pad.pressed('a');
      heavy = k.pressed('b') || pad.pressed('b');
    }
    if (f.stun > 0) return;
    if (x) f.face = x;
    const accel = f.ground ? 60 : 30;
    f.vx += (x * f.c.speed - f.vx) * Math.min(1, accel * dt / f.c.speed);
    if (jump && f.jumps < 2) { f.vy = -f.c.jump * (f.jumps ? 0.85 : 1); f.jumps++; f.ground = false; Arcade.audio.sfx('jump', { vol: 0.1 }); }
    if (down) { f.drop = 0.2; if (!f.ground) f.vy += 30 * dt; }
    if (light) attack(f, false);
    if (heavy) attack(f, true);
  }

  function update(dt) {
    input.poll();
    time += dt;
    if (state === 'menu' || ui.visible) return;
    sparks.forEach((s) => { s.t += dt; });
    sparks = sparks.filter((s) => s.t < 0.3);

    for (const f of fighters) {
      if (f.out) continue;
      f.stun = Math.max(0, f.stun - dt); f.safe = Math.max(0, f.safe - dt); f.drop = Math.max(0, (f.drop || 0) - dt);
      control(f, dt);
      const floaty = f.c.name === 'Zephyr' && f.vy > 0 ? 0.6 : 1;
      f.vy += GRAV * floaty * dt;
      const prevY = f.y;
      f.x += f.vx * dt; f.y += f.vy * dt;
      land(f, prevY);

      if (f.atk) {
        f.atk.t += dt;
        if (!f.atk.hit && f.atk.t >= f.atk.at) {
          f.atk.hit = true;
          const reach = f.atk.heavy ? 1.15 : 0.85, hx = f.x + f.face * reach * 0.8, hy = f.y - 0.6;
          for (const o of fighters) {
            if (o === f || o.out || o.safe > 0) continue;
            if (Math.hypot(o.x - hx, o.y - 0.6 - hy) > reach) continue;
            o.dmg += f.atk.heavy ? 14 : 6;
            const kb = ((f.atk.heavy ? 7 : 3.5) + o.dmg * (f.atk.heavy ? 0.16 : 0.07)) * f.c.power / o.c.weight;
            o.vx = f.face * kb; o.vy = -kb * 0.75; o.stun = Math.min(0.9, kb * 0.035); o.ground = false;
            sparks.push({ x: o.x, y: o.y - 0.6, t: 0, big: f.atk.heavy });
            Arcade.audio.sfx(f.atk.heavy ? 'thud' : 'hit', { vol: 0.3 });
          }
        }
        if (f.atk.t >= f.atk.end) f.atk = null;
      }
      // off the page
      if (f.x < -3 || f.x > VW + 3 || f.y > VH + 4 || f.y < -6) {
        f.stocks--;
        Arcade.audio.sfx('lose', { dur: 0.25 });
        if (f.stocks <= 0) f.out = true; else spawn(f);
      }
    }
    const left = fighters.filter((f) => !f.out);
    if (left.length <= 1) {
      endT += dt;
      if (endT > 1.2 && !ui.visible) {
        state = 'over';
        Arcade.audio.sfx('win');
        ui.results({
          heading: (left[0] ? left[0].c.name : 'Nobody') + ' wins!',
          rows: fighters.map((f) => [f.c.name + (f.bot ? ' (computer)' : ''), f.out ? 'OUT' : '●'.repeat(f.stocks)]),
          buttons: [{ label: 'Rematch', onClick: () => startMatch(humans, fighters.length) }, { label: 'Change players', onClick: menu }],
        });
      }
    }
  }

  // ---------- drawing ----------
  function drawFighter(f, u, X, Y) {
    const x = X(f.x), y = Y(f.y), c = f.c, s = u * 0.55;
    if (f.safe > 0 && Math.floor(time * 12) % 2) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(f.face, 1);
    if (f.stun > 0) ctx.rotate(Math.sin(time * 30) * 0.2);
    ctx.lineWidth = Math.max(3, u * 0.07); ctx.strokeStyle = '#111'; ctx.fillStyle = c.color;
    if (c.name === 'Clank') { ctx.beginPath(); ctx.rect(-s * 0.8, -s * 2.1, s * 1.6, s * 2.1); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#111'; ctx.fillRect(-s * 0.1, -s * 2.5, s * 0.2, s * 0.4); }
    else if (c.name === 'Sumo') { ctx.beginPath(); ctx.ellipse(0, -s * 0.95, s * 1.05, s * 0.95, 0, 0, 6.3); ctx.fill(); ctx.stroke(); }
    else if (c.name === 'Zephyr') { ctx.beginPath(); ctx.moveTo(0, -s * 2.3); ctx.lineTo(s * 0.9, -s * 1.1); ctx.lineTo(0, 0); ctx.lineTo(-s * 0.9, -s * 1.1); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else { ctx.beginPath(); ctx.roundRect(-s * 0.75, -s * 2, s * 1.5, s * 2, s * 0.6); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#111'; ctx.fillRect(-s * 0.75, -s * 1.5, s * 1.5, s * 0.35); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 0.3, -s * 1.32, s * 0.2, 0, 6.3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(s * 0.36, -s * 1.32, s * 0.08, 0, 6.3); ctx.fill();
    if (f.atk) {
      const k = f.atk.t / f.atk.end, big = f.atk.heavy;
      ctx.strokeStyle = big ? '#ef233c' : '#111'; ctx.lineWidth = u * (big ? 0.16 : 0.1);
      ctx.beginPath(); ctx.arc(s * 0.4, -s, s * (big ? 2 : 1.5), -1.2 + k * 2.4 - 0.9, -1.2 + k * 2.4); ctx.stroke();
    }
    ctx.restore();
  }

  function render() {
    // halftone comic page
    ctx.fillStyle = '#ffe45c'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(239, 35, 60, .14)';
    for (let y = 0; y < H; y += 22) for (let x = (y / 22) % 2 ? 11 : 0; x < W; x += 22) { ctx.beginPath(); ctx.arc(x, y, 3 + (y / H) * 4, 0, 6.3); ctx.fill(); }
    if (state === 'menu') return;
    const u = Math.min(W / VW, (H - 90) / VH), ox = (W - VW * u) / 2, oy = (H - 90 - VH * u) / 2;
    const X = (v) => ox + v * u, Y = (v) => oy + v * u;

    for (const [px, py, pw, solid] of stage) {
      ctx.fillStyle = solid ? '#3a2e6e' : '#ffffff'; ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(3, u * 0.08);
      ctx.beginPath(); ctx.roundRect(X(px), Y(py), pw * u, u * (solid ? 1.6 : 0.3), u * 0.12); ctx.fill(); ctx.stroke();
    }
    for (const f of fighters) if (!f.out) drawFighter(f, u, X, Y);
    for (const s of sparks) {
      ctx.save(); ctx.translate(X(s.x), Y(s.y)); ctx.rotate(s.t * 4);
      ctx.fillStyle = s.big ? '#ef233c' : '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.283, r = u * (k % 2 ? 0.3 : 0.75) * (s.big ? 1.3 : 1) * (0.5 + s.t * 2); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // HUD: a caption box per fighter
    const bw = Math.min(170, (W - 20) / fighters.length - 8), total = fighters.length * (bw + 8) - 8;
    fighters.forEach((f, i) => {
      const x = (W - total) / 2 + i * (bw + 8), y = H - 80;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
      ctx.fillRect(x, y, bw, 66); ctx.strokeRect(x, y, bw, 66);
      ctx.fillStyle = f.c.color; ctx.fillRect(x, y, 12, 66);
      ctx.fillStyle = '#111'; ctx.textAlign = 'left';
      ctx.font = `18px ${DISPLAY}`; ctx.fillText(f.c.name.toUpperCase() + (f.bot ? ' · CPU' : ''), x + 20, y + 20);
      ctx.font = `34px ${DISPLAY}`; ctx.fillStyle = f.out ? '#999' : `hsl(${Math.max(0, 50 - f.dmg / 3)} 90% 40%)`;
      ctx.fillText(f.out ? 'OUT' : Math.round(f.dmg) + '%', x + 20, y + 54);
      ctx.fillStyle = '#ef233c'; ctx.font = `18px ${DISPLAY}`; ctx.textAlign = 'right';
      ctx.fillText('●'.repeat(Math.max(0, f.stocks)), x + bw - 8, y + 52);
    });
  }

  ui.onPause(() => { if (state === 'playing') ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart: () => startMatch(humans, fighters.length) }); });
  function menu() {
    state = 'menu';
    ui.title({ buttons: [
      { label: '2 players', onClick: () => startMatch(2, 2) }, { label: '3 players', onClick: () => startMatch(3, 3) },
      { label: '4 players', onClick: () => startMatch(4, 4) }, { label: '1 player vs computer', onClick: () => startMatch(1, 2) },
      { label: '1 player vs 3 computers', onClick: () => startMatch(1, 4) },
    ] });
  }
  menu();
  Arcade.loop({ update, render }).start();
})();
