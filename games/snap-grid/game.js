// Snap Grid: drag shapes onto an 8x8 board. Full rows and columns clear.
// Gold cells double the points of any line they are cleared in. The game ends
// when none of your shapes fit.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  const save = Arcade.save('snap-grid');

  const DISPLAY = '"Orbitron", "Consolas", monospace';
  const BODY = '"Rajdhani", "Segoe UI", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Snap Grid',
    tagline: 'Fill lines. Chain clears. Don\'t run out of room.',
    how: [['Drag', 'Drop a shape on the board'], ['Arrows + Space', 'Move and place with keys'], ['X', 'Switch shape'], ['Gold cell', 'Doubles its line']],
    // Snap Grid's own look: a neon sign on a night-time grid.
    theme: {
      fonts: 'family=Orbitron:wght@600;800&family=Rajdhani:wght@500;700',
      display: DISPLAY, body: BODY,
      overlay: 'rgba(6, 6, 22, .82)',
      panel: '#0e1030', panel2: '#171a45', edge: '#2de2e6',
      text: '#e9f9ff', muted: '#8f9bd6',
      accent: '#ff3864', accentInk: '#ffffff',
      radius: '4px', border: '2px',
      shadow: '0 0 0 1px #2de2e6, 0 0 34px rgba(45, 226, 230, .45)', buttonShadow: '0 0 16px rgba(255, 56, 100, .35)',
      caps: 'uppercase', titleSize: 'clamp(1.6rem, 7vw, 2.2rem)',
    },
  });

  const N = 8;
  const PALETTE = ['#2de2e6', '#ff3864', '#f9c80e', '#9d4edd', '#3ddc97', '#ff8c42'];
  const GOLD = '#ffe66d';

  // Base shapes; every rotation is generated below.
  const BASE = [
    [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
    [[0, 0], [1, 0], [0, 1]],
    [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[1, 0], [2, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 2]], [[1, 0], [1, 1], [1, 2], [0, 2]],
  ];
  const SHAPES = (() => {
    const out = new Map();
    for (const base of BASE) {
      let cells = base;
      for (let r = 0; r < 4; r++) {
        const minX = Math.min(...cells.map((c) => c[0])), minY = Math.min(...cells.map((c) => c[1]));
        const norm = cells.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
        out.set(JSON.stringify(norm), norm);
        cells = cells.map(([x, y]) => [-y, x]);
      }
    }
    return [...out.values()];
  })();

  let state = 'menu'; // menu | playing | over
  let mode = 'classic', rand, grid, tray, score, streak, drag, kb, clearing, pops, overT, time = 0, L;
  const bestKey = () => (mode === 'daily' ? 'daily:' + Arcade.rng.today() : 'best');

  const size = (p) => ({ w: Math.max(...p.cells.map((c) => c[0])) + 1, h: Math.max(...p.cells.map((c) => c[1])) + 1 });
  const fits = (p, gx, gy) => p.cells.every(([x, y]) => gx + x >= 0 && gx + x < N && gy + y >= 0 && gy + y < N && !grid[gy + y][gx + x]);
  function anyFit(p) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (fits(p, x, y)) return true;
    return false;
  }

  function newPiece() {
    const cells = rand.pick(SHAPES);
    return { cells, color: rand.pick(PALETTE), gold: rand() < 0.18 ? rand.int(0, cells.length - 1) : -1, used: false };
  }
  // Deal three shapes. If the board has room for anything, at least one of them fits.
  function deal() {
    for (let tries = 0; tries < 40; tries++) {
      tray = [newPiece(), newPiece(), newPiece()];
      if (tray.some(anyFit)) return;
    }
  }

  function start(newMode) {
    mode = newMode;
    rand = mode === 'daily' ? Arcade.rng.daily('snap-grid') : Arcade.rng();
    grid = Array.from({ length: N }, () => Array(N).fill(null));
    score = 0; streak = 0; drag = null; clearing = []; pops = []; overT = 0;
    kb = { on: false, piece: 0, x: 3, y: 3 };
    deal();
    ui.hide();
    input.flush();
    state = 'playing';
  }

  function place(i, gx, gy) {
    const p = tray[i];
    if (p.used || !fits(p, gx, gy)) return false;
    p.cells.forEach(([x, y], k) => { grid[gy + y][gx + x] = { color: p.color, gold: k === p.gold }; });
    p.used = true;
    score += p.cells.length;
    Arcade.audio.sfx('thud', { freq: 180 });

    const rows = [], cols = [];
    for (let k = 0; k < N; k++) {
      if (grid[k].every(Boolean)) rows.push(k);
      if (grid.every((r) => r[k])) cols.push(k);
    }
    const lines = rows.length + cols.length;
    if (lines) {
      const hit = new Set();
      rows.forEach((y) => { for (let x = 0; x < N; x++) hit.add(y * N + x); });
      cols.forEach((x) => { for (let y = 0; y < N; y++) hit.add(y * N + x); });
      let gold = false;
      for (const id of hit) {
        const x = id % N, y = (id / N) | 0;
        if (grid[y][x].gold) gold = true;
        clearing.push({ x, y, color: grid[y][x].gold ? GOLD : grid[y][x].color, t: 0 });
        grid[y][x] = null;
      }
      streak++;
      const points = 10 * lines * lines * (gold ? 2 : 1) + 5 * (streak - 1);
      score += points;
      pops.push({ text: (gold ? 'GOLD x2  ' : '') + '+' + points, t: 0, gold });
      for (let k = 0; k < Math.min(lines, 4); k++) Arcade.audio.beep({ freq: 520 * Math.pow(1.26, k + Math.min(streak, 5)), dur: 0.14, type: 'square', vol: 0.2, delay: k * 0.07 });
    } else streak = 0;

    if (tray.every((t) => t.used)) deal();
    if (kb.on && tray[kb.piece].used) cyclePiece();
    if (!tray.some((t) => !t.used && anyFit(t))) { state = 'over'; overT = 0; Arcade.audio.sfx('lose'); }
    return true;
  }

  function cyclePiece() {
    for (let k = 1; k <= 3; k++) {
      const i = (kb.piece + k) % 3;
      if (!tray[i].used) { kb.piece = i; return; }
    }
  }

  // ---------- pointer ----------
  function snap(p, px, py) {
    const s = size(p);
    return [Math.round((px - (s.w * L.cell) / 2 - L.gx) / L.cell), Math.round((py - (s.h * L.cell) / 2 - L.gy) / L.cell)];
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'playing' || !L) return;
    kb.on = false;
    const i = L.slots.findIndex(([sx, sy]) => Math.abs(e.offsetX - sx) < L.slotR && Math.abs(e.offsetY - sy) < L.slotR);
    if (i === -1 || tray[i].used) return;
    // On a touch screen, hold the shape above the finger so it stays visible.
    drag = { i, x: e.offsetX, y: e.offsetY, lift: e.pointerType === 'touch' ? L.cell * 1.8 : 0 };
    canvas.setPointerCapture(e.pointerId);
    Arcade.audio.sfx('blip');
  });
  canvas.addEventListener('pointermove', (e) => { if (drag) { drag.x = e.offsetX; drag.y = e.offsetY; } });
  const drop = () => {
    if (!drag) return;
    const [gx, gy] = snap(tray[drag.i], drag.x, drag.y - drag.lift);
    place(drag.i, gx, gy);
    drag = null;
  };
  canvas.addEventListener('pointerup', drop);
  canvas.addEventListener('pointercancel', () => { drag = null; });

  function update(dt) {
    input.poll();
    time += dt;
    if (state === 'menu') return;
    clearing.forEach((c) => { c.t += dt; });
    clearing = clearing.filter((c) => c.t < 0.35);
    pops.forEach((p) => { p.t += dt; });
    pops = pops.filter((p) => p.t < 1.1);

    if (state === 'playing' && !ui.visible) {
      const p = input.solo;
      const moved = p.pressed('left') || p.pressed('right') || p.pressed('up') || p.pressed('down');
      if (moved || p.pressed('a') || p.pressed('b')) {
        if (!kb.on) { kb.on = true; if (tray[kb.piece].used) cyclePiece(); }
        const s = size(tray[kb.piece]);
        if (p.pressed('left')) kb.x--;
        if (p.pressed('right')) kb.x++;
        if (p.pressed('up')) kb.y--;
        if (p.pressed('down')) kb.y++;
        if (p.pressed('b')) cyclePiece();
        const s2 = size(tray[kb.piece]);
        kb.x = Math.max(0, Math.min(N - s2.w, kb.x));
        kb.y = Math.max(0, Math.min(N - s2.h, kb.y));
        if (p.pressed('a') && !moved && s) {
          if (!place(kb.piece, kb.x, kb.y)) Arcade.audio.beep({ freq: 140, dur: 0.1, type: 'sawtooth', vol: 0.2 });
        }
      }
    }
    if (state === 'over') {
      overT += dt;
      if (overT > 1.2 && !ui.visible) {
        const best = Math.max(score, save.get(bestKey(), 0));
        save.set(bestKey(), best);
        ui.results({
          heading: score >= best && score > 0 ? 'New high score' : 'No room left',
          rows: [['Score', score], [mode === 'daily' ? "Today's best" : 'Best', best]],
          note: mode === 'daily' ? 'Daily board: the same shapes for everyone today.' : '',
          buttons: [
            { label: 'Play again', onClick: () => start(mode) },
            mode === 'daily' ? { label: 'Classic', onClick: () => start('classic') } : { label: 'Daily board', onClick: () => start('daily') },
          ],
        });
      }
    }
  }

  // ---------- drawing ----------
  function layout() {
    const wide = W > H * 1.15;
    let g, gx, gy, slots;
    if (wide) {
      g = Math.min(H - 120, W * 0.56);
      const trayW = g * 0.42;
      gx = (W - g - trayW) / 2; gy = (H - g) / 2 + 24;
      slots = [1, 3, 5].map((k) => [gx + g + trayW / 2 + 12, gy + (g * k) / 6]);
    } else {
      g = Math.min(W * 0.92, (H - 110) * 0.66);
      gx = (W - g) / 2; gy = 96;
      const ty = gy + g + (H - gy - g) / 2;
      slots = [1, 3, 5].map((k) => [gx + (g * k) / 6, ty]);
    }
    const cell = g / N;
    L = { g, gx, gy, cell, slots, slotR: g / 6, mini: cell * 0.5 };
  }

  function block(x, y, s, color, alpha = 1, glow = true) {
    ctx.globalAlpha = alpha;
    const pad = s * 0.07, r = s * 0.14;
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = s * 0.35; }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x + pad, y + pad, s - pad * 2, s - pad * 2, r); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath(); ctx.roundRect(x + pad * 2, y + pad * 2, s - pad * 4, (s - pad * 4) * 0.34, r * 0.6); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function star(cx, cy, r) {
    ctx.fillStyle = '#5a4500';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.fill();
  }
  function drawPiece(p, x, y, s, alpha = 1) {
    p.cells.forEach(([cx, cy], k) => {
      block(x + cx * s, y + cy * s, s, k === p.gold ? GOLD : p.color, alpha, s > 20);
      if (k === p.gold) star(x + cx * s + s / 2, y + cy * s + s / 2, s * 0.26);
    });
  }

  function render() {
    // Night sky with a slow-moving grid floor.
    ctx.fillStyle = '#0a0b1e'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(121, 30, 148, 0.28)'; ctx.lineWidth = 1;
    const step = 44, off = (time * 14) % step;
    ctx.beginPath();
    for (let x = -step + off; x < W + step; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = -step + off; y < H + step; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    if (state === 'menu') return;
    layout();
    const { g, gx, gy, cell } = L;

    // board
    ctx.fillStyle = 'rgba(14, 16, 48, 0.92)';
    ctx.shadowColor = '#2de2e6'; ctx.shadowBlur = 24;
    ctx.fillRect(gx - 6, gy - 6, g + 12, g + 12);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#2de2e6'; ctx.lineWidth = 2; ctx.strokeRect(gx - 6, gy - 6, g + 12, g + 12);
    ctx.strokeStyle = 'rgba(45, 226, 230, 0.14)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < N; k++) {
      ctx.moveTo(gx + k * cell, gy); ctx.lineTo(gx + k * cell, gy + g);
      ctx.moveTo(gx, gy + k * cell); ctx.lineTo(gx + g, gy + k * cell);
    }
    ctx.stroke();

    // where the held shape would land
    let ghost = null;
    if (state === 'playing') {
      if (drag) { const [x, y] = snap(tray[drag.i], drag.x, drag.y - drag.lift); ghost = { p: tray[drag.i], x, y }; }
      else if (kb.on && !tray[kb.piece].used) ghost = { p: tray[kb.piece], x: kb.x, y: kb.y };
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const c = grid[y][x];
      if (!c) continue;
      block(gx + x * cell, gy + y * cell, cell, c.gold ? GOLD : c.color, state === 'over' ? 0.35 : 1);
      if (c.gold) star(gx + x * cell + cell / 2, gy + y * cell + cell / 2, cell * 0.26);
    }
    if (ghost) {
      const ok = fits(ghost.p, ghost.x, ghost.y);
      if (ok || kb.on) {
        ghost.p.cells.forEach(([cx, cy]) => {
          const x = ghost.x + cx, y = ghost.y + cy;
          if (x < 0 || y < 0 || x >= N || y >= N) return;
          ctx.fillStyle = ok ? 'rgba(255,255,255,0.3)' : 'rgba(255,56,100,0.45)';
          ctx.fillRect(gx + x * cell + 3, gy + y * cell + 3, cell - 6, cell - 6);
        });
      }
    }
    for (const c of clearing) {
      const k = c.t / 0.35;
      block(gx + c.x * cell - k * 6, gy + c.y * cell - k * 6, cell + k * 12, '#ffffff', 1 - k, false);
    }

    // tray
    tray.forEach((p, i) => {
      const [sx, sy] = L.slots[i];
      if (kb.on && i === kb.piece && state === 'playing') {
        ctx.strokeStyle = '#ff3864'; ctx.lineWidth = 2;
        ctx.strokeRect(sx - L.slotR * 0.9, sy - L.slotR * 0.9, L.slotR * 1.8, L.slotR * 1.8);
      }
      if (p.used || (drag && drag.i === i)) return;
      const s = size(p), m = L.mini;
      drawPiece(p, sx - (s.w * m) / 2, sy - (s.h * m) / 2, m, anyFit(p) ? 1 : 0.3);
    });
    if (drag) {
      const p = tray[drag.i], s = size(p);
      drawPiece(p, drag.x - (s.w * cell) / 2, drag.y - drag.lift - (s.h * cell) / 2, cell, 0.92);
    }

    // HUD: neon readouts
    const best = Math.max(score, save.get(bestKey(), 0));
    ctx.textAlign = 'left';
    ctx.font = `700 13px ${BODY}`; ctx.fillStyle = '#8f9bd6';
    ctx.fillText(mode === 'daily' ? 'DAILY SCORE' : 'SCORE', gx - 4, gy - 52);
    ctx.fillText('BEST', gx + g * 0.52, gy - 52);
    ctx.font = `800 ${Math.round(Math.min(34, g * 0.09))}px ${DISPLAY}`;
    ctx.shadowColor = '#2de2e6'; ctx.shadowBlur = 14; ctx.fillStyle = '#e9f9ff';
    ctx.fillText(score, gx - 4, gy - 20);
    ctx.shadowColor = '#ff3864'; ctx.fillStyle = '#ffd0db';
    ctx.fillText(best, gx + g * 0.52, gy - 20);
    ctx.shadowBlur = 0;

    for (const p of pops) {
      ctx.globalAlpha = 1 - p.t / 1.1;
      ctx.textAlign = 'center';
      ctx.font = `800 ${Math.round(cell * 0.62)}px ${DISPLAY}`;
      ctx.shadowColor = p.gold ? GOLD : '#2de2e6'; ctx.shadowBlur = 18;
      ctx.fillStyle = p.gold ? GOLD : '#ffffff';
      ctx.fillText(p.text, gx + g / 2, gy + g / 2 - p.t * 60);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
  }

  ui.onPause(() => {
    if (state !== 'playing') return;
    drag = null;
    ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart: () => start(mode) });
  });
  const best = save.get('best', 0);
  ui.title({
    note: best ? 'High score: ' + best : '',
    buttons: [{ label: 'Play', onClick: () => start('classic') }, { label: 'Daily board', onClick: () => start('daily') }],
  });
  Arcade.loop({ update, render }).start();
})();
