// Paper Trail: draw one line, starting at the marked square, that visits every
// square exactly once. Some grids can't be done flat. Fold the paper (left edge
// to right edge, or top to bottom) and the squares on those edges touch, so
// the line can pass over the fold. Every level is built from a real path and
// checked to need its folds.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  const save = Arcade.save('paper-trail');

  const HAND = '"Caveat", "Segoe Print", cursive';
  const BODY = '"Karla", "Segoe UI", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Paper Trail',
    tagline: 'One line. Every square. Fold if you must.',
    how: [['Drag or tap', 'Draw from the dot to the next square'], ['Fold buttons', 'Join the left and right edges, or top and bottom'], ['Back over the line', 'Erases it to that point'], ['Arrows / R', 'Draw with keys / restart']],
    // Paper Trail's own look: a notebook. Cream paper, pencil grey, a red margin line.
    theme: {
      fonts: 'family=Caveat:wght@600;700&family=Karla:wght@500;700',
      display: HAND, body: BODY,
      overlay: 'rgba(80, 64, 40, .45)',
      panel: '#fffaf0', panel2: '#f3ead6', edge: '#c9bfa8',
      text: '#3b3a36', muted: '#7d776b',
      accent: '#d1495b', accentInk: '#ffffff',
      radius: '3px', border: '1px',
      shadow: '0 2px 0 #c9bfa8, 0 20px 40px rgba(60, 40, 10, .25)', buttonShadow: 'none',
      titleSize: 'clamp(2.8rem, 13vw, 4rem)',
    },
  });

  const LEVELS = 50;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // ---------- rules (shared with tools/check-levels.js) ----------
  // Neighbours of a cell, passing over the folds that are on.
  function neighbours(lv, folds, x, y) {
    const out = [];
    for (const [dx, dy] of DIRS) {
      let nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= lv.w) { if (!folds.x) continue; nx = (nx + lv.w) % lv.w; }
      if (ny < 0 || ny >= lv.h) { if (!folds.y) continue; ny = (ny + lv.h) % lv.h; }
      if (lv.open[ny * lv.w + nx]) out.push(ny * lv.w + nx);
    }
    return out;
  }
  // Is there a line from the start through every open square? (Depth-first,
  // trying squares with fewest exits first; gives up after `limit` steps.)
  function solvable(lv, folds, limit = 200000) {
    const total = lv.open.filter(Boolean).length;
    const seen = new Uint8Array(lv.w * lv.h);
    let steps = 0;
    function go(c, n) {
      if (n === total) return true;
      if (++steps > limit) throw new Error('limit');
      const next = neighbours(lv, folds, c % lv.w, (c / lv.w) | 0).filter((k) => !seen[k]);
      next.sort((a, b) => neighbours(lv, folds, a % lv.w, (a / lv.w) | 0).filter((k) => !seen[k]).length - neighbours(lv, folds, b % lv.w, (b / lv.w) | 0).filter((k) => !seen[k]).length);
      for (const k of next) { seen[k] = 1; if (go(k, n + 1)) return true; seen[k] = 0; }
      return false;
    }
    seen[lv.start] = 1;
    try { return go(lv.start, 1); } catch (e) { return null; }
  }

  // Build a level: a random walk that uses the folds; every square it misses
  // becomes a hole. Keep it only if it really can't be done without the folds.
  function makeLevel(n) {
    const rand = Arcade.rng(Arcade.rng.hash('paper-trail:' + n));
    const size = n <= 8 ? [4, 4] : n <= 20 ? [5, 4] : n <= 35 ? [5, 5] : [6, 5];
    const need = n <= 6 ? { x: true, y: false } : n <= 12 ? { x: false, y: true } : rand() < 0.4 ? { x: true, y: true } : rand() < 0.5 ? { x: true, y: false } : { x: false, y: true };
    for (let tries = 0; tries < 400; tries++) {
      const [w, h] = size;
      const lv = { w, h, open: Array(w * h).fill(true), start: 0, folds: need };
      const path = [rand.int(0, w * h - 1)];
      const used = new Set(path);
      let crossings = 0;
      for (;;) {
        const c = path[path.length - 1];
        const options = neighbours(lv, need, c % w, (c / w) | 0).filter((k) => !used.has(k));
        if (!options.length) break;
        const k = rand.pick(options);
        if (Math.abs((k % w) - (c % w)) > 1 || Math.abs(((k / w) | 0) - ((c / w) | 0)) > 1) crossings++;
        path.push(k); used.add(k);
      }
      if (path.length < w * h * 0.7 || crossings < 1) continue;
      lv.open = lv.open.map((_, i) => used.has(i));
      lv.start = path[0];
      if (solvable(lv, { x: false, y: false }) !== false) continue;           // must need a fold
      if (need.x && need.y && (solvable(lv, { x: true, y: false }) !== false || solvable(lv, { x: false, y: true }) !== false)) continue;
      return lv;
    }
    throw new Error('could not build level ' + n);
  }

  // ---------- play ----------
  let state = 'menu', level = Math.min(save.get('level', 1), LEVELS), lv, folds, path, drawing = false, wonT = 0, G, time = 0, foldAnim = { x: 0, y: 0 };

  function load(n) {
    level = n; lv = makeLevel(n);
    folds = { x: false, y: false }; path = [lv.start]; wonT = 0;
    ui.hide(); input.flush(); state = 'playing';
  }
  const total = () => lv.open.filter(Boolean).length;
  function stepTo(k) {
    if (state !== 'playing' || !lv.open[k]) return;
    const at = path.indexOf(k);
    if (at !== -1) { path.length = at + 1; Arcade.audio.sfx('blip', { freq: 300 }); return; }
    const end = path[path.length - 1];
    if (!neighbours(lv, folds, end % lv.w, (end / lv.w) | 0).includes(k)) return;
    path.push(k);
    Arcade.audio.beep({ freq: 380 + path.length * 18, dur: 0.06, type: 'triangle', vol: 0.25 });
    if (path.length === total()) { state = 'won'; wonT = 0; Arcade.audio.sfx('win'); }
  }
  function toggleFold(axis) {
    if (state !== 'playing') return;
    folds[axis] = !folds[axis];
    Arcade.audio.beep({ freq: folds[axis] ? 240 : 180, slide: folds[axis] ? 420 : 120, dur: 0.18, type: 'sine', vol: 0.4 });
    // If the line used a fold that is now open, cut it back to before that step.
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      if (!neighbours(lv, folds, a % lv.w, (a / lv.w) | 0).includes(b)) { path.length = i; break; }
    }
  }

  function cellAt(px, py) {
    if (!G) return -1;
    const x = Math.floor((px - G.x) / G.c), y = Math.floor((py - G.y) / G.c);
    return x >= 0 && y >= 0 && x < lv.w && y < lv.h ? y * lv.w + x : -1;
  }
  function onButton(px, py) {
    for (const b of G.buttons) if (px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.h) return b;
    return null;
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'playing' || !G) return;
    const b = onButton(e.offsetX, e.offsetY);
    if (b) { b.act(); return; }
    const k = cellAt(e.offsetX, e.offsetY);
    if (k >= 0) { drawing = true; canvas.setPointerCapture(e.pointerId); stepTo(k); }
  });
  canvas.addEventListener('pointermove', (e) => { if (drawing) { const k = cellAt(e.offsetX, e.offsetY); if (k >= 0 && k !== path[path.length - 1]) stepTo(k); } });
  canvas.addEventListener('pointerup', () => { drawing = false; });
  addEventListener('keydown', (e) => {
    if (state !== 'playing' || ui.visible) return;
    if (e.code === 'KeyR') { path = [lv.start]; }
    if (e.code === 'Digit1') toggleFold('x');
    if (e.code === 'Digit2') toggleFold('y');
  });

  function update(dt) {
    input.poll();
    time += dt;
    foldAnim.x += ((folds && folds.x ? 1 : 0) - foldAnim.x) * Math.min(1, dt * 8);
    foldAnim.y += ((folds && folds.y ? 1 : 0) - foldAnim.y) * Math.min(1, dt * 8);
    if (state === 'playing' && !ui.visible) {
      const p = input.solo, end = path[path.length - 1];
      for (const [k, dx, dy] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]) {
        if (!p.pressed(k)) continue;
        let nx = (end % lv.w) + dx, ny = ((end / lv.w) | 0) + dy;
        if (folds.x) nx = (nx + lv.w) % lv.w;
        if (folds.y) ny = (ny + lv.h) % lv.h;
        if (nx >= 0 && ny >= 0 && nx < lv.w && ny < lv.h) {
          const k2 = ny * lv.w + nx;
          if (path.length > 1 && path[path.length - 2] === k2) path.pop(); else stepTo(k2);
        }
      }
    }
    if (state === 'won') {
      wonT += dt;
      if (wonT > 1.2 && !ui.visible) {
        if (level < LEVELS) save.set('level', Math.max(save.get('level', 1), level + 1));
        const usedFolds = (folds.x ? 1 : 0) + (folds.y ? 1 : 0);
        ui.results({
          heading: 'Every square, one line',
          rows: [['Level', level + ' / ' + LEVELS], ['Folds used', usedFolds]],
          buttons: level < LEVELS ? [{ label: 'Next page', onClick: () => load(level + 1) }, { label: 'Again', onClick: () => load(level) }]
            : [{ label: 'Back to page 1', onClick: () => load(1) }],
        });
      }
    }
  }

  // ---------- drawing ----------
  function render() {
    // the desk and a notebook page
    ctx.fillStyle = '#8a6f4e'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,.06)'; for (let y = 0; y < H; y += 7) ctx.fillRect(0, y, W, 2);
    const pw = Math.min(W - 24, 620), ph = H - 24, px = (W - pw) / 2, py = 12;
    ctx.fillStyle = '#efe6d2'; ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = 'rgba(80, 140, 200, .25)'; ctx.lineWidth = 1;
    for (let y = py + 40; y < py + ph; y += 28) { ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + pw, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(209, 73, 91, .55)'; ctx.beginPath(); ctx.moveTo(px + 44, py); ctx.lineTo(px + 44, py + ph); ctx.stroke();
    if (state === 'menu') return;

    const c = Math.min((pw - 120) / lv.w, (ph - 210) / lv.h, 90);
    G = { c, x: px + (pw - c * lv.w) / 2 + 12, y: py + 96, buttons: [] };
    ctx.fillStyle = '#3b3a36'; ctx.textAlign = 'left'; ctx.font = `700 34px ${HAND}`;
    ctx.fillText('Page ' + level, px + 58, py + 50);
    ctx.font = `500 15px ${BODY}`; ctx.fillStyle = '#7d776b';
    ctx.fillText(path.length + ' / ' + total() + ' squares', px + 58, py + 74);

    // fold marks: the edges that would meet, curling when folded
    const gw = c * lv.w, gh = c * lv.h;
    const curl = (x, y, w, h, k) => { ctx.fillStyle = `rgba(209, 73, 91, ${0.12 + k * 0.3})`; ctx.fillRect(x, y, w, h); };
    if (foldAnim.x > 0.02) { curl(G.x - 10, G.y, 10, gh, foldAnim.x); curl(G.x + gw, G.y, 10, gh, foldAnim.x); }
    if (foldAnim.y > 0.02) { curl(G.x, G.y - 10, gw, 10, foldAnim.y); curl(G.x, G.y + gh, gw, 10, foldAnim.y); }

    for (let i = 0; i < lv.w * lv.h; i++) {
      const x = G.x + (i % lv.w) * c, y = G.y + ((i / lv.w) | 0) * c;
      if (!lv.open[i]) {           // a hole torn in the page
        ctx.fillStyle = '#8a6f4e'; ctx.beginPath(); ctx.roundRect(x + c * 0.12, y + c * 0.12, c * 0.76, c * 0.76, c * 0.2); ctx.fill();
        continue;
      }
      ctx.strokeStyle = '#b5ab95'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.strokeRect(x + 2, y + 2, c - 4, c - 4); ctx.setLineDash([]);
      if (path.includes(i)) { ctx.fillStyle = 'rgba(209, 73, 91, .12)'; ctx.fillRect(x + 3, y + 3, c - 6, c - 6); }
    }
    // the pencil line; steps over a fold leave the page and come back on the other side
    ctx.strokeStyle = '#d1495b'; ctx.lineWidth = Math.max(4, c * 0.12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const mid = (k) => [G.x + (k % lv.w + 0.5) * c, G.y + (((k / lv.w) | 0) + 0.5) * c];
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = mid(path[i - 1]), [bx, by] = mid(path[i]);
      ctx.beginPath();
      if (Math.abs(ax - bx) > c * 1.5) { const s = Math.sign(ax - bx); ctx.moveTo(ax, ay); ctx.lineTo(ax + s * c * 0.75, ay); ctx.moveTo(bx - s * c * 0.75, by); ctx.lineTo(bx, by); }
      else if (Math.abs(ay - by) > c * 1.5) { const s = Math.sign(ay - by); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay + s * c * 0.75); ctx.moveTo(bx, by - s * c * 0.75); ctx.lineTo(bx, by); }
      else { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); }
      ctx.stroke();
    }
    const [sx, sy] = mid(lv.start);
    ctx.fillStyle = '#3b3a36'; ctx.beginPath(); ctx.arc(sx, sy, c * 0.16, 0, 6.3); ctx.fill();
    const [ex, ey] = mid(path[path.length - 1]);
    if (state === 'playing') { ctx.strokeStyle = '#3b3a36'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ex, ey, c * 0.24 + Math.sin(time * 5) * 2, 0, 6.3); ctx.stroke(); }

    // fold buttons, drawn as paper tabs
    const by = G.y + gh + 36, bw = Math.min(170, (pw - 100) / 2);
    [['x', '⇆ Fold sides', '1'], ['y', '⇅ Fold top & bottom', '2']].forEach(([axis, text, key], i) => {
      const b = { x: px + pw / 2 - bw - 6 + i * (bw + 12), y: by, w: bw, h: 46, act: () => toggleFold(axis) };
      G.buttons.push(b);
      const on = folds[axis];
      ctx.fillStyle = on ? '#d1495b' : '#fffaf0'; ctx.strokeStyle = '#3b3a36'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = on ? '#fff' : '#3b3a36'; ctx.font = `700 ${Math.min(24, bw / 7)}px ${HAND}`; ctx.textAlign = 'center';
      ctx.fillText(text, b.x + b.w / 2, b.y + 30);
      ctx.font = `500 11px ${BODY}`; ctx.fillStyle = on ? '#ffe' : '#7d776b'; ctx.fillText('key ' + key, b.x + b.w - 22, b.y + 42);
    });
  }

  ui.onPause(() => { if (state === 'playing') ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart: () => load(level) }); });
  ui.title({ buttons: level > 1 ? [{ label: 'Continue: page ' + level, onClick: () => load(level) }, { label: 'Start from page 1', onClick: () => load(1) }] : [{ label: 'Play', onClick: () => load(1) }] });
  Arcade.loop({ update, render }).start();
})();
