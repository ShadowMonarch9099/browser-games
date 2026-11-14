// Bounce Tanks: 2 to 4 tanks in a maze that is rebuilt every round. Shells
// bounce off walls and one hit knocks a tank out, including your own.
// Empty seats can be filled by computer tanks. First to 5 rounds wins.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });

  const DISPLAY = '"Black Ops One", "Impact", sans-serif';
  const BODY = '"Share Tech Mono", "Consolas", monospace';
  const ui = Arcade.ui.create({
    title: 'Bounce Tanks',
    tagline: 'Shells bounce. Mind your own.',
    how: [['Orange', 'W A S D to drive, F to fire'], ['Green', 'Arrows to drive, Enter to fire'], ['Pink', 'I J K L to drive, O to fire'], ['Cyan', 'Number pad 8 4 5 6, 0 to fire'], ['Gamepads', 'Also work, one per tank']],
    // Bounce Tanks' own look: a battle plan drawn on blueprint paper.
    theme: {
      fonts: 'family=Black+Ops+One&family=Share+Tech+Mono',
      display: DISPLAY, body: BODY,
      overlay: 'rgba(8, 24, 52, .82)',
      panel: '#12305c', panel2: '#0c2447', edge: '#e8f1ff',
      text: '#e8f1ff', muted: '#9db8de',
      accent: '#ffb703', accentInk: '#12305c',
      radius: '0px', border: '2px',
      shadow: '0 0 0 6px #12305c, 0 0 0 7px #e8f1ff', buttonShadow: 'none',
      caps: 'uppercase',
    },
  });

  const COLS = 9, ROWS = 6, T = 0.1, R = 0.2, WIN = 5;
  const TEAM = [['Orange', '#ffb703'], ['Green', '#8ac926'], ['Pink', '#ff5d8f'], ['Cyan', '#4cc9f0']];
  const KEYS = ['kb1', 'kb2', 'kb3', 'kb4'];

  let state = 'menu';
  let tanks, shells, walls, pickup, pickupAt, roundT, score, humans, rand = Arcade.rng(), time = 0, endT;

  // A maze from a random walk, with extra gaps knocked through so it isn't all corridors.
  function buildMaze() {
    const right = Array.from({ length: ROWS }, () => Array(COLS).fill(true));
    const down = Array.from({ length: ROWS }, () => Array(COLS).fill(true));
    const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const stack = [[0, 0]]; seen[0][0] = true;
    while (stack.length) {
      const [c, r] = stack[stack.length - 1];
      const next = rand.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]]).find(([dx, dy]) => {
        const x = c + dx, y = r + dy;
        return x >= 0 && y >= 0 && x < COLS && y < ROWS && !seen[y][x];
      });
      if (!next) { stack.pop(); continue; }
      const [dx, dy] = next;
      if (dx === 1) right[r][c] = false; if (dx === -1) right[r][c - 1] = false;
      if (dy === 1) down[r][c] = false; if (dy === -1) down[r - 1][c] = false;
      seen[r + dy][c + dx] = true; stack.push([c + dx, r + dy]);
    }
    walls = [[-T, -T, COLS + 2 * T, T], [-T, ROWS, COLS + 2 * T, T], [-T, 0, T, ROWS], [COLS, 0, T, ROWS]];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (c < COLS - 1 && right[r][c] && rand() > 0.45) walls.push([c + 1 - T / 2, r - T / 2, T, 1 + T]);
      if (r < ROWS - 1 && down[r][c] && rand() > 0.45) walls.push([c - T / 2, r + 1 - T / 2, 1 + T, T]);
    }
  }
  const hitsWall = (x, y, rad) => walls.some(([wx, wy, ww, wh]) => {
    const cx = Math.max(wx, Math.min(x, wx + ww)), cy = Math.max(wy, Math.min(y, wy + wh));
    return (x - cx) ** 2 + (y - cy) ** 2 < rad * rad;
  });
  function clearLine(a, b) {
    const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 0.12);
    for (let i = 1; i < n; i++) if (hitsWall(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, 0.04)) return false;
    return true;
  }

  function startMatch(humanCount, total) {
    humans = humanCount;
    score = Array(total).fill(0);
    ui.hide(); input.flush();
    newRound();
  }
  function newRound() {
    buildMaze();
    const spots = rand.shuffle([[0, 0], [COLS - 1, ROWS - 1], [COLS - 1, 0], [0, ROWS - 1]]);
    tanks = score.map((_, i) => ({
      i, x: spots[i][0] + 0.5, y: spots[i][1] + 0.5, a: rand() * 6.28, alive: true, cool: 0, shells: 0, power: null,
      bot: i >= humans, turn: 0, stuck: 0,
    }));
    shells = []; pickup = null; pickupAt = time + 6; roundT = 0; endT = 0;
    state = 'playing';
  }

  function fire(t) {
    if (t.cool > 0 || t.shells >= 5) return;
    t.cool = 0.3;
    const shots = t.power === 'triple' ? [-0.25, 0, 0.25] : [0];
    const fast = t.power === 'laser';
    for (const off of shots) {
      const a = t.a + off, sp = fast ? 8 : 3.4;
      shells.push({ x: t.x + Math.cos(a) * (R + 0.08), y: t.y + Math.sin(a) * (R + 0.08), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: fast ? 1.6 : 6, owner: t, age: 0, fast });
      t.shells++;
    }
    t.power = null;
    Arcade.audio.beep({ freq: fast ? 900 : 260, slide: 90, dur: 0.12, type: 'square', vol: 0.2 });
  }

  function drive(t, turn, go, dt) {
    t.a += turn * 3.2 * dt;
    const sp = go * (go > 0 ? 2.1 : 1.4) * dt;
    const nx = t.x + Math.cos(t.a) * sp, ny = t.y + Math.sin(t.a) * sp;
    const before = t.x + t.y;
    if (!hitsWall(nx, t.y, R)) t.x = nx;
    if (!hitsWall(t.x, ny, R)) t.y = ny;
    return Math.abs(t.x + t.y - before) > 0.0005;
  }

  // Computer tanks: turn to face the nearest tank they can see and shoot; otherwise wander.
  function think(t, dt) {
    const foes = tanks.filter((o) => o.alive && o !== t);
    const target = foes.sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0];
    let turn = 0, go = 1;
    if (target && clearLine(t, target)) {
      let diff = Math.atan2(target.y - t.y, target.x - t.x) - t.a;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      turn = Math.max(-1, Math.min(1, diff * 3));
      go = Math.abs(diff) < 0.5 ? 0.5 : 0;
      if (Math.abs(diff) < 0.12 && roundT > 1.5) fire(t);
    } else {
      t.turn -= dt;
      if (t.turn <= 0) { t.turn = 0.4 + rand() * 1.2; t.dir = rand.pick([-1, 0, 0, 1]); }
      turn = t.stuck > 0.25 ? 1 : t.dir;
    }
    const moved = drive(t, turn, go, dt);
    t.stuck = moved || go === 0 ? 0 : t.stuck + dt;
  }

  function update(dt) {
    input.poll();
    time += dt;
    if (state === 'menu' || ui.visible) return;
    roundT += dt;
    for (const t of tanks) {
      if (!t.alive) continue;
      t.cool = Math.max(0, t.cool - dt);
      if (t.bot) { think(t, dt); continue; }
      const k = input.device(KEYS[t.i]), pad = input.device('pad' + t.i);
      drive(t, k.x || pad.x, -(k.y || pad.y), dt);
      if (k.pressed('a') || pad.pressed('a')) fire(t);
      if (pickup && Math.hypot(pickup.x - t.x, pickup.y - t.y) < R + 0.2) { t.power = pickup.type; pickup = null; pickupAt = time + 7; Arcade.audio.sfx('select'); }
    }
    for (const t of tanks) if (t.alive && t.bot && pickup && Math.hypot(pickup.x - t.x, pickup.y - t.y) < R + 0.2) { t.power = pickup.type; pickup = null; pickupAt = time + 7; }
    if (!pickup && time > pickupAt) pickup = { x: rand.int(0, COLS - 1) + 0.5, y: rand.int(0, ROWS - 1) + 0.5, type: rand.pick(['triple', 'laser']) };

    for (const s of shells) {
      s.life -= dt; s.age += dt;
      const steps = s.fast ? 4 : 2;
      for (let i = 0; i < steps; i++) {
        s.x += (s.vx * dt) / steps;
        if (hitsWall(s.x, s.y, 0.05)) { s.x -= (s.vx * dt) / steps; s.vx = -s.vx; bounce(); }
        s.y += (s.vy * dt) / steps;
        if (hitsWall(s.x, s.y, 0.05)) { s.y -= (s.vy * dt) / steps; s.vy = -s.vy; bounce(); }
      }
      for (const t of tanks) {
        if (!t.alive || (t === s.owner && s.age < 0.3)) continue;
        if (Math.hypot(t.x - s.x, t.y - s.y) < R + 0.04) { t.alive = false; t.boom = 0; s.life = 0; Arcade.audio.sfx('lose', { dur: 0.3 }); }
      }
    }
    shells = shells.filter((s) => { if (s.life <= 0) s.owner.shells = Math.max(0, s.owner.shells - 1); return s.life > 0; });
    for (const t of tanks) if (!t.alive && t.boom !== undefined) t.boom += dt;

    const alive = tanks.filter((t) => t.alive);
    if (alive.length <= 1) {
      endT += dt;
      if (endT > 1.6) {
        if (alive.length) score[alive[0].i]++;
        const champ = score.findIndex((s) => s >= WIN);
        if (champ === -1) return newRound();
        state = 'over';
        Arcade.audio.sfx('win');
        ui.results({
          heading: TEAM[champ][0] + ' wins!',
          rows: score.map((s, i) => [TEAM[i][0] + (i >= humans ? ' (computer)' : ''), s]),
          buttons: [{ label: 'Rematch', onClick: () => startMatch(humans, score.length) }, { label: 'Change players', onClick: menu }],
        });
      }
    }
  }
  let lastBounce = 0;
  function bounce() { if (time - lastBounce > 0.04) { lastBounce = time; Arcade.audio.beep({ freq: 520, dur: 0.03, type: 'triangle', vol: 0.12 }); } }

  function render() {
    // blueprint paper
    ctx.fillStyle = '#12305c'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(232,241,255,.08)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x < W; x += 24) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y < H; y += 24) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    if (state === 'menu') return;
    const u = Math.min((W - 24) / (COLS + 0.3), (H - 96) / (ROWS + 0.3));
    const ox = (W - COLS * u) / 2, oy = (H - ROWS * u) / 2 + 26;
    const X = (v) => ox + v * u, Y = (v) => oy + v * u;

    ctx.fillStyle = '#e8f1ff';
    for (const [x, y, w, h] of walls) ctx.fillRect(X(x), Y(y), w * u, h * u);
    if (pickup) {
      ctx.strokeStyle = '#ffb703'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.arc(X(pickup.x), Y(pickup.y), u * 0.2, 0, 6.3); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ffb703'; ctx.font = `${Math.round(u * 0.2)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pickup.type === 'triple' ? 'x3' : 'L', X(pickup.x), Y(pickup.y)); ctx.textBaseline = 'alphabetic';
    }
    for (const t of tanks) {
      const color = TEAM[t.i][1];
      if (!t.alive) {
        if (t.boom < 0.5) { ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(X(t.x), Y(t.y), u * (0.2 + t.boom), 0, 6.3); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(232,241,255,.5)'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(X(t.x - 0.14), Y(t.y - 0.14)); ctx.lineTo(X(t.x + 0.14), Y(t.y + 0.14)); ctx.moveTo(X(t.x + 0.14), Y(t.y - 0.14)); ctx.lineTo(X(t.x - 0.14), Y(t.y + 0.14)); ctx.stroke();
        continue;
      }
      ctx.save(); ctx.translate(X(t.x), Y(t.y)); ctx.rotate(t.a);
      ctx.fillStyle = '#0c2447'; ctx.fillRect(-u * 0.21, -u * 0.2, u * 0.42, u * 0.4);
      ctx.fillStyle = color; ctx.fillRect(-u * 0.17, -u * 0.14, u * 0.34, u * 0.28);
      ctx.fillRect(0, -u * 0.04, u * 0.3, u * 0.08);
      ctx.fillStyle = '#0c2447'; ctx.beginPath(); ctx.arc(0, 0, u * 0.08, 0, 6.3); ctx.fill();
      ctx.restore();
      if (t.power) { ctx.fillStyle = '#ffb703'; ctx.font = `${Math.round(u * 0.16)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillText(t.power === 'triple' ? 'x3' : 'L', X(t.x), Y(t.y) - u * 0.3); }
    }
    for (const s of shells) { ctx.fillStyle = s.fast ? '#ffb703' : '#e8f1ff'; ctx.beginPath(); ctx.arc(X(s.x), Y(s.y), u * 0.05, 0, 6.3); ctx.fill(); }

    // HUD: stencilled score blocks
    const bw = Math.min(150, (W - 130) / score.length);
    score.forEach((s, i) => {
      const x = 12 + i * bw;
      ctx.fillStyle = TEAM[i][1]; ctx.fillRect(x, 12, 8, 34);
      ctx.fillStyle = '#e8f1ff'; ctx.textAlign = 'left';
      ctx.font = `13px ${BODY}`; ctx.fillText(TEAM[i][0].toUpperCase() + (i >= humans ? ' CPU' : ''), x + 14, 24);
      ctx.font = `20px ${DISPLAY}`; ctx.fillText('■'.repeat(s) + '□'.repeat(WIN - s), x + 14, 45);
    });
  }

  ui.onPause(() => { if (state === 'playing') ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart: () => startMatch(humans, score.length) }); });
  function menu() {
    state = 'menu';
    ui.title({ buttons: [
      { label: '2 players', onClick: () => startMatch(2, 2) }, { label: '3 players', onClick: () => startMatch(3, 3) },
      { label: '4 players', onClick: () => startMatch(4, 4) }, { label: '1 player vs 2 computers', onClick: () => startMatch(1, 3) },
    ] });
  }
  menu();
  Arcade.loop({ update, render }).start();
})();
