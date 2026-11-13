// Puck Scuffle: air hockey for two on one device (or one against the computer).
// Lay a phone flat and each drag a mallet, or share a keyboard: WASD vs arrows.
// Power-up tokens on the ice split the puck, grow it, or shrink a goal.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });

  const DISPLAY = '"Russo One", "Arial Black", sans-serif';
  const BODY = '"Barlow", "Segoe UI", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Puck Scuffle',
    tagline: 'Air hockey. First to 7.',
    how: [['Touch', 'Drag the mallet on your half'], ['Red', 'W A S D'], ['Blue', 'Arrow keys'], ['Tokens', 'Hit them with the puck']],
    // Puck Scuffle's own look: a scoreboard over fresh ice.
    theme: {
      fonts: 'family=Russo+One&family=Barlow:wght@500;700',
      display: DISPLAY, body: BODY,
      overlay: 'rgba(13, 34, 64, .78)',
      panel: '#f4fbff', panel2: '#dcedf7', edge: '#0d2240',
      text: '#0d2240', muted: '#4c6a8a',
      accent: '#e63946', accentInk: '#ffffff',
      radius: '10px', border: '4px',
      shadow: '0 0 0 4px #f4fbff, 0 0 0 8px #e63946', buttonShadow: 'none',
      caps: 'uppercase',
    },
  });

  // The table in its own units: 1 wide, LEN long. Player 0 (red) defends the
  // y = LEN end, player 1 (blue) the y = 0 end.
  const LEN = 1.7, GOAL = 0.38, MR = 0.075, PR = 0.045, WIN = 7, MAX_SPEED = 3.4;
  const TEAM = [{ name: 'Red', color: '#e63946', dark: '#a61e2a' }, { name: 'Blue', color: '#1d6fe0', dark: '#124a9c' }];
  const AI = [{ speed: 1.0, wobble: 0.16 }, { speed: 1.6, wobble: 0.07 }, { speed: 2.4, wobble: 0.02 }];
  const TOKENS = { split: ['Split puck!', '#9d4edd'], big: ['Giant puck!', '#f4a300'], shrink: ['Goal shrinks!', '#2a9d8f'] };

  let state = 'menu'; // menu | playing | goal | over
  let cpu = null;     // null for 2 players, else 0..2
  let mallets, pucks, score, token, tokenAt, bigUntil, shrinkUntil, goalT, lastScorer, time = 0, T;
  const pointers = new Map();
  const rand = Arcade.rng();

  function start(cpuLevel) {
    cpu = cpuLevel;
    score = [0, 0];
    mallets = [{ x: 0.5, y: LEN - 0.25, vx: 0, vy: 0 }, { x: 0.5, y: 0.25, vx: 0, vy: 0 }];
    serve(rand() < 0.5 ? 0 : 1);
    pointers.clear();
    ui.hide();
    input.flush();
    state = 'playing';
  }
  // Put one puck on the ice, on the side of the player who was scored on.
  function serve(toPlayer) {
    pucks = [{ x: 0.5, y: LEN / 2 + (toPlayer === 0 ? 0.22 : -0.22), vx: 0, vy: 0, last: -1 }];
    token = null; tokenAt = time + 7; bigUntil = 0; shrinkUntil = [0, 0];
  }
  const puckR = () => (time < bigUntil ? PR * 1.7 : PR);
  const goalW = (p) => GOAL * (time < shrinkUntil[p] ? 0.55 : 1);

  // ---------- screen mapping: upright on tall screens, sideways on wide ones ----------
  function fit() {
    const tall = H >= W;
    const s = tall ? Math.min(W * 0.96, (H * 0.96) / LEN) : Math.min(H * 0.92, (W * 0.94) / LEN);
    T = { tall, s, ox: (W - (tall ? s : s * LEN)) / 2, oy: (H - (tall ? s * LEN : s)) / 2 };
  }
  const toScreen = (x, y) => (T.tall ? [T.ox + x * T.s, T.oy + y * T.s] : [T.ox + (LEN - y) * T.s, T.oy + x * T.s]);
  const toTable = (sx, sy) => (T.tall ? [(sx - T.ox) / T.s, (sy - T.oy) / T.s] : [(sy - T.oy) / T.s, LEN - (sx - T.ox) / T.s]);

  function track(e) { if (T) pointers.set(e.pointerId, toTable(e.offsetX, e.offsetY)); }
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); track(e); });
  canvas.addEventListener('pointermove', (e) => {
    // A mouse steers without holding the button when playing the computer.
    if (pointers.has(e.pointerId) || (e.pointerType === 'mouse' && cpu !== null)) track(e);
  });
  const lift = (e) => { if (!(e.pointerType === 'mouse' && cpu !== null)) pointers.delete(e.pointerId); };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));
  canvas.style.touchAction = 'none';

  function steer(p, dt) {
    const m = mallets[p];
    const ox = m.x, oy = m.y;
    let target = null;
    for (const [x, y] of pointers.values()) {
      const mine = cpu !== null ? p === 0 : (y > LEN / 2) === (p === 0);
      if (mine) target = [x, y];
    }
    if (target) {
      const dx = target[0] - m.x, dy = target[1] - m.y, d = Math.hypot(dx, dy), max = 6 * dt;
      if (d > 0) { const k = Math.min(1, max / d); m.x += dx * k; m.y += dy * k; }
    } else {
      const dev = cpu !== null ? input.solo : [input.device('kb1'), input.device('kb2')][p];
      const pad = input.device('pad' + p);
      const sx = dev.x || pad.x, sy = dev.y || pad.y;
      // Keys are in screen directions; turn them into table directions.
      const dx = T.tall ? sx : sy, dy = T.tall ? sy : -sx;
      const n = Math.hypot(dx, dy) || 1;
      m.x += (dx / n) * 1.9 * dt; m.y += (dy / n) * 1.9 * dt;
    }
    clampMallet(p);
    m.vx = (m.x - ox) / dt; m.vy = (m.y - oy) / dt;
  }
  function clampMallet(p) {
    const m = mallets[p];
    m.x = Math.max(MR, Math.min(1 - MR, m.x));
    m.y = p === 0 ? Math.max(LEN / 2 + MR, Math.min(LEN - MR, m.y)) : Math.max(MR, Math.min(LEN / 2 - MR, m.y));
  }

  function think(dt) {
    const m = mallets[1], a = AI[cpu];
    const ox = m.x, oy = m.y;
    // Watch the puck closest to our goal.
    const puck = pucks.reduce((best, q) => (q.y < best.y ? q : best));
    let tx, ty;
    if (puck.y < LEN / 2 && puck.vy < 0.6) { tx = puck.x; ty = puck.y - 0.02; }           // go and hit it
    else { tx = 0.5 + (puck.x - 0.5) * 0.7; ty = 0.24; }                                  // guard the goal
    tx += Math.sin(time * 2.3) * a.wobble;
    const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy), max = a.speed * dt;
    if (d > 0) { const k = Math.min(1, max / d); m.x += dx * k; m.y += dy * k; }
    clampMallet(1);
    m.vx = (m.x - ox) / dt; m.vy = (m.y - oy) / dt;
  }

  function goal(scorer) {
    score[scorer]++;
    lastScorer = scorer;
    state = score[scorer] >= WIN ? 'over' : 'goal';
    goalT = 0;
    pucks = [];
    Arcade.audio.sfx(state === 'over' ? 'win' : 'coin');
  }

  function movePuck(q, dt) {
    const r = puckR();
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vx *= 0.9988; q.vy *= 0.9988;
    if (q.x < r) { q.x = r; q.vx = Math.abs(q.vx) * 0.95; wallSound(q); }
    if (q.x > 1 - r) { q.x = 1 - r; q.vx = -Math.abs(q.vx) * 0.95; wallSound(q); }
    // Ends: through the goal mouth, or bounce off the end wall.
    if (q.y < r) {
      if (Math.abs(q.x - 0.5) < goalW(1) / 2 - r * 0.4) { if (q.y < -r) return goal(0); }
      else { q.y = r; q.vy = Math.abs(q.vy) * 0.95; wallSound(q); }
    }
    if (q.y > LEN - r) {
      if (Math.abs(q.x - 0.5) < goalW(0) / 2 - r * 0.4) { if (q.y > LEN + r) return goal(1); }
      else { q.y = LEN - r; q.vy = -Math.abs(q.vy) * 0.95; wallSound(q); }
    }
    mallets.forEach((m, p) => {
      const dx = q.x - m.x, dy = q.y - m.y, d = Math.hypot(dx, dy), min = r + MR;
      if (d >= min || d === 0) return;
      const nx = dx / d, ny = dy / d;
      q.x = m.x + nx * min; q.y = m.y + ny * min;
      const rel = (q.vx - m.vx) * nx + (q.vy - m.vy) * ny;
      if (rel < 0) {
        q.vx -= 1.9 * rel * nx; q.vy -= 1.9 * rel * ny;
        q.last = p;
        Arcade.audio.beep({ freq: 240 + Math.min(600, -rel * 160), dur: 0.05, type: 'square', vol: 0.25 });
      }
    });
    const sp = Math.hypot(q.vx, q.vy);
    if (sp > MAX_SPEED) { q.vx *= MAX_SPEED / sp; q.vy *= MAX_SPEED / sp; }

    if (token && Math.hypot(q.x - token.x, q.y - token.y) < r + 0.06) {
      const type = token.type;
      token = null; tokenAt = time + 9;
      ui.toast(TOKENS[type][0], 1300);
      Arcade.audio.sfx('select');
      if (type === 'split' && pucks.length < 3) pucks.push({ x: q.x, y: q.y, vx: -q.vx || 0.6, vy: q.vy, last: q.last });
      if (type === 'big') bigUntil = time + 8;
      // The goal of whoever hit the puck last gets smaller, so it is harder to score on them.
      if (type === 'shrink') shrinkUntil[q.last === -1 ? (rand() < 0.5 ? 0 : 1) : q.last] = time + 10;
    }
  }
  let lastWall = 0;
  function wallSound(q) {
    if (time - lastWall < 0.05 || Math.hypot(q.vx, q.vy) < 0.3) return;
    lastWall = time;
    Arcade.audio.beep({ freq: 150, dur: 0.04, type: 'triangle', vol: 0.3 });
  }

  function update(dt) {
    input.poll();
    if (state === 'menu' || ui.visible || !T) return;
    time += dt;
    if (state === 'playing') {
      steer(0, dt);
      if (cpu === null) steer(1, dt); else think(dt);
      for (let sub = 0; sub < 2; sub++) for (const q of [...pucks]) if (state === 'playing') movePuck(q, dt / 2);
      if (!token && time > tokenAt && state === 'playing') {
        token = { x: 0.2 + rand() * 0.6, y: LEN / 2 + (rand() - 0.5) * 0.5, type: rand.pick(Object.keys(TOKENS)) };
      }
    } else {
      goalT += dt;
      if (state === 'goal' && goalT > 1.2) { serve(1 - lastScorer); state = 'playing'; }
      if (state === 'over' && goalT > 1.2) {
        ui.results({
          heading: (cpu !== null ? (lastScorer === 0 ? 'You win' : 'Computer wins') : TEAM[lastScorer].name + ' wins') + '!',
          rows: [[cpu !== null ? 'You' : 'Red', score[0]], [cpu !== null ? 'Computer' : 'Blue', score[1]]],
          buttons: [{ label: 'Rematch', onClick: () => start(cpu) }, { label: 'Change mode', onClick: menu }],
        });
      }
    }
  }

  // ---------- drawing ----------
  function disc(x, y, r, fill, ring) {
    const [sx, sy] = toScreen(x, y);
    ctx.beginPath(); ctx.arc(sx, sy + 3, r * T.s, 0, 6.3); ctx.fillStyle = 'rgba(13,34,64,0.25)'; ctx.fill();
    ctx.beginPath(); ctx.arc(sx, sy, r * T.s, 0, 6.3); ctx.fillStyle = fill; ctx.fill();
    if (ring) { ctx.beginPath(); ctx.arc(sx, sy, r * T.s * 0.5, 0, 6.3); ctx.fillStyle = ring; ctx.fill(); }
  }
  function line(x1, y1, x2, y2, color, width) {
    ctx.beginPath(); ctx.moveTo(...toScreen(x1, y1)); ctx.lineTo(...toScreen(x2, y2));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }

  function render() {
    fit();
    ctx.fillStyle = '#0d2240'; ctx.fillRect(0, 0, W, H);
    // the ice
    const [ax, ay] = toScreen(0, 0), [bx, by] = toScreen(1, LEN);
    const x = Math.min(ax, bx), y = Math.min(ay, by), w = Math.abs(bx - ax), h = Math.abs(by - ay);
    ctx.fillStyle = '#eef8fd';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, T.s * 0.06); ctx.fill();
    ctx.save(); ctx.clip();
    // big painted score numbers, each facing its player
    [0, 1].forEach((p) => {
      const [cx, cy] = toScreen(0.5, p === 0 ? LEN * 0.75 : LEN * 0.25);
      ctx.save(); ctx.translate(cx, cy);
      if (T.tall && p === 1) ctx.rotate(Math.PI);
      ctx.font = `${Math.round(T.s * 0.42)}px ${DISPLAY}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = state !== 'menu' && (state === 'goal' || state === 'over') && lastScorer === p && Math.sin(goalT * 20) > 0 ? TEAM[p].color : p === 0 ? 'rgba(230,57,70,0.2)' : 'rgba(29,111,224,0.2)';
      ctx.fillText(state === 'menu' ? '' : score[p], 0, 0);
      ctx.restore();
    });
    line(0, LEN / 2, 1, LEN / 2, '#e63946', T.s * 0.012);
    const [mx, my] = toScreen(0.5, LEN / 2);
    ctx.beginPath(); ctx.arc(mx, my, T.s * 0.17, 0, 6.3); ctx.strokeStyle = '#1d6fe0'; ctx.lineWidth = T.s * 0.01; ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#f4fbff'; ctx.lineWidth = T.s * 0.02;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, T.s * 0.06); ctx.stroke();
    if (state === 'menu') return;
    // goal mouths, in the colour of the player defending them
    line(0.5 - goalW(1) / 2, 0, 0.5 + goalW(1) / 2, 0, TEAM[1].color, T.s * 0.035);
    line(0.5 - goalW(0) / 2, LEN, 0.5 + goalW(0) / 2, LEN, TEAM[0].color, T.s * 0.035);

    if (token) {
      const [tx, ty] = toScreen(token.x, token.y), r = T.s * (0.05 + Math.sin(time * 6) * 0.006);
      ctx.beginPath(); ctx.arc(tx, ty, r, 0, 6.3); ctx.fillStyle = TOKENS[token.type][1]; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `${Math.round(r * 1.1)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText({ split: '2', big: '+', shrink: '<' }[token.type], tx, ty + 1);
    }
    for (const q of pucks) disc(q.x, q.y, puckR(), '#0d2240', '#3a5578');
    mallets.forEach((m, p) => disc(m.x, m.y, MR, TEAM[p].color, TEAM[p].dark));
    ctx.textBaseline = 'alphabetic';
  }

  ui.onPause(() => {
    if (state !== 'playing') return;
    pointers.clear();
    ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart: () => start(cpu) });
  });
  function menu() {
    state = 'menu';
    ui.title({
      buttons: [
        { label: '2 players', onClick: () => start(null) },
        { label: 'Vs computer: easy', onClick: () => start(0) },
        { label: 'Vs computer: medium', onClick: () => start(1) },
        { label: 'Vs computer: hard', onClick: () => start(2) },
      ],
    });
  }
  menu();
  Arcade.loop({ update, render }).start();
})();
