// Gate Stampede: steer a crowd through gates that add, subtract, multiply or
// divide it. Saws and rival crowds thin it out. Reach the castle with enough
// runners to take it. 30 levels, the same for everyone.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  const save = Arcade.save('gate-stampede');

  const FONT = '"Lilita One", "Arial Black", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Gate Stampede',
    tagline: 'Bigger crowd wins. Choose your gates.',
    how: [['Drag / ← →', 'Steer the crowd'], ['Blue gates', 'Add or multiply'], ['Red gates', 'Subtract or divide'], ['Castle', 'Arrive with more runners than it has guards']],
    // Gate Stampede's own look: a bright toy box. White cards, blue and pink.
    theme: {
      fonts: 'family=Lilita+One',
      display: FONT, body: '"Trebuchet MS", sans-serif',
      overlay: 'rgba(40, 110, 180, .55)',
      panel: '#ffffff', panel2: '#e8f4ff', edge: '#1b4f8a',
      text: '#1b3a5c', muted: '#5b7a99',
      accent: '#ff4d6d', accentInk: '#ffffff',
      radius: '24px', border: '4px',
      shadow: '0 10px 0 #1b4f8a', buttonShadow: '0 5px 0 rgba(27, 79, 138, .35)',
    },
  });

  const LEVELS = 30, GAP = 460, SPEED = 330;

  // Each level is built from its number, so everyone gets the same one.
  function makeLevel(lv) {
    const rand = Arcade.rng(Arcade.rng.hash('gate-stampede:' + lv));
    const rows = [];
    let best = 10;
    const count = Math.min(16, 6 + Math.floor(lv / 2));
    for (let i = 0; i < count; i++) {
      const roll = rand();
      if (roll < 0.62 || i === 0) {
        const good = rand() < 0.3 && best < 400 ? { op: 'x', v: rand() < 0.15 ? 3 : 2 } : { op: '+', v: rand.int(5, 12 + lv) };
        const r2 = rand();
        const bad = r2 < 0.4 ? { op: '-', v: rand.int(3, 6 + Math.floor(lv / 2)) } : r2 < 0.65 ? { op: '/', v: 2 } : { op: '+', v: rand.int(1, 4) };
        const goodLeft = rand() < 0.5;
        rows.push({ kind: 'gates', left: goodLeft ? good : bad, right: goodLeft ? bad : good });
        best = apply(best, good);
      } else if (roll < 0.82) {
        rows.push({ kind: 'saw', x: rand.pick([-0.55, 0, 0.55]) });
      } else if (best > 20) {
        const n = Math.floor(best * 0.3);
        rows.push({ kind: 'rivals', n });
        best -= n;
      } else rows.push({ kind: 'saw', x: rand.pick([-0.55, 0.55]) });
    }
    rows.forEach((r, i) => { r.d = 700 + i * GAP; });
    return { rows, castle: Math.max(8, Math.floor(best * (0.5 + Math.min(0.2, lv * 0.007)))), end: 700 + count * GAP + 200, best };
  }
  function apply(n, g) {
    if (g.op === '+') return n + g.v;
    if (g.op === '-') return Math.max(0, n - g.v);
    if (g.op === 'x') return n * g.v;
    return Math.floor(n / g.v);
  }
  const label = (g) => ({ '+': '+', '-': '−', x: '×', '/': '÷' }[g.op] + g.v);
  const kind = (g) => (g.op === '+' || g.op === 'x' ? 'good' : 'bad');

  let state = 'menu';
  let level = Math.min(save.get('level', 1), LEVELS);
  let L, n, x, dist, endT, won, pops, pointerX = null, time = 0;

  function load(lv) {
    level = lv; L = makeLevel(lv);
    L.rows.forEach((r) => { r.done = false; });
    n = 10; x = 0; dist = 0; endT = 0; pops = []; pointerX = null;
    ui.hide(); input.flush();
    state = 'playing';
  }
  const pop = (text, good) => pops.push({ text, good, t: 0 });

  canvas.addEventListener('pointerdown', (e) => { pointerX = e.offsetX; });
  canvas.addEventListener('pointermove', (e) => { if (pointerX !== null || e.pointerType === 'mouse') pointerX = e.offsetX; });
  canvas.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') pointerX = null; });
  canvas.style.touchAction = 'none';

  function update(dt) {
    input.poll();
    time += dt;
    if (state === 'menu' || ui.visible) return;
    pops.forEach((p) => { p.t += dt; });
    pops = pops.filter((p) => p.t < 1);
    if (state === 'done') {
      endT += dt;
      if (endT > 1.6) finish();
      return;
    }
    const k = input.solo;
    if (k.x) { x += k.x * 2.2 * dt; pointerX = null; }
    else if (pointerX !== null) {
      const half = Math.min(W * 0.44, 230);
      x += (((pointerX - W / 2) / half) - x) * Math.min(1, dt * 14);
    }
    x = Math.max(-0.85, Math.min(0.85, x));
    dist += SPEED * dt;

    for (const r of L.rows) {
      if (r.done || r.d > dist) continue;
      r.done = true;
      if (r.kind === 'gates') {
        const g = x < 0 ? r.left : r.right;
        n = apply(n, g);
        pop(label(g), kind(g) === 'good');
        Arcade.audio.sfx(kind(g) === 'good' ? 'coin' : 'hit');
      } else if (r.kind === 'saw') {
        if (Math.abs(x - r.x) < 0.42) { const lost = Math.max(3, Math.floor(n * 0.3)); n = Math.max(0, n - lost); pop('−' + lost, false); Arcade.audio.sfx('hit'); }
      } else {
        n = Math.max(0, n - r.n); pop('−' + r.n, false); Arcade.audio.sfx('thud');
      }
      if (n <= 0) { won = false; state = 'done'; endT = 0.8; Arcade.audio.sfx('lose'); return; }
    }
    if (dist >= L.end) {
      won = n >= L.castle; state = 'done'; endT = 0;
      Arcade.audio.sfx(won ? 'win' : 'lose');
    }
  }

  function finish() {
    if (ui.visible) return;
    if (won) {
      const stars = n >= L.castle * 1.5 ? 3 : n >= L.castle * 1.2 ? 2 : 1;
      const all = save.get('stars', {});
      all[level] = Math.max(all[level] || 0, stars);
      save.set('stars', all);
      if (level < LEVELS) save.set('level', Math.max(save.get('level', 1), level + 1));
      ui.results({
        heading: 'Castle taken!',
        rows: [['Level ' + level, '★'.repeat(stars) + '☆'.repeat(3 - stars)], ['Runners left', n - L.castle]],
        buttons: level < LEVELS ? [{ label: 'Next level', onClick: () => load(level + 1) }, { label: 'Replay', onClick: () => load(level) }]
          : [{ label: 'Replay', onClick: () => load(level) }, { label: 'Level 1', onClick: () => load(1) }],
      });
    } else {
      ui.results({
        heading: n <= 0 ? 'Nobody left!' : 'Not enough runners',
        rows: [['Your crowd', n], ['Castle guards', L.castle]],
        buttons: [{ label: 'Try again', onClick: () => load(level) }],
      });
    }
  }

  // ---------- drawing ----------
  function crowd(cx, cy, count, color, scale) {
    const shown = Math.min(count, 140);
    ctx.fillStyle = color;
    for (let i = 0; i < shown; i++) {
      const a = i * 2.4, r = Math.sqrt(i) * 5.2 * scale;
      const bob = Math.sin(time * 12 + i) * 1.5;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8 + bob, 4.6 * scale, 0, 6.3); ctx.fill();
    }
  }
  function tag(text, cx, cy, bg) {
    ctx.font = `22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 22;
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(cx - w / 2, cy - 17, w, 34, 17); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(text, cx, cy + 1);
    ctx.textBaseline = 'alphabetic';
  }

  function render() {
    ctx.fillStyle = '#8fd3ff'; ctx.fillRect(0, 0, W, H);
    const half = Math.min(W * 0.44, 230), py = H * 0.76;
    ctx.fillStyle = '#6fbf73'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#eef3f8'; ctx.fillRect(W / 2 - half - 26, 0, half * 2 + 52, H);
    ctx.fillStyle = '#c9d6e3'; ctx.fillRect(W / 2 - half - 26, 0, 8, H); ctx.fillRect(W / 2 + half + 18, 0, 8, H);
    const off = state === 'menu' ? time * 120 : dist;
    ctx.fillStyle = '#dbe5ee';
    for (let y = (off % 90) - 90; y < H; y += 90) ctx.fillRect(W / 2 - 4, y, 8, 44);
    if (state === 'menu') return;
    const sy = (d) => py - (d - dist);

    for (const r of L.rows) {
      const y = sy(r.d);
      if (y < -80 || y > H + 80) continue;
      if (r.kind === 'gates') {
        [[r.left, -1], [r.right, 1]].forEach(([g, side]) => {
          const good = kind(g) === 'good';
          ctx.globalAlpha = r.done ? 0.25 : 0.85;
          ctx.fillStyle = good ? '#3a86ff' : '#ff4d6d';
          const gx = side < 0 ? W / 2 - half - 18 : W / 2 + 4;
          ctx.beginPath(); ctx.roundRect(gx, y - 34, half + 14, 46, 10); ctx.fill();
          ctx.globalAlpha = r.done ? 0.3 : 1;
          ctx.fillStyle = '#fff'; ctx.font = `30px ${FONT}`; ctx.textAlign = 'center';
          ctx.fillText(label(g), gx + (half + 14) / 2, y);
          ctx.globalAlpha = 1;
        });
      } else if (r.kind === 'saw') {
        const cx = W / 2 + r.x * half;
        ctx.save(); ctx.translate(cx, y); ctx.rotate(time * 9);
        ctx.fillStyle = '#7c8794';
        ctx.beginPath();
        for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.283, rr = k % 2 ? 40 : 54; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.fill();
        ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 6.3); ctx.fill();
        ctx.restore();
      } else if (!r.done) {
        crowd(W / 2, y - 20, r.n, '#ff4d6d', 1);
        tag(String(r.n), W / 2, y - 70, '#c9184a');
      }
    }
    // the castle
    const cy = sy(L.end + 120);
    if (cy > -200) {
      ctx.fillStyle = '#8d99ae'; ctx.fillRect(W / 2 - 130, cy - 110, 260, 120);
      for (let k = 0; k < 5; k++) ctx.fillRect(W / 2 - 130 + k * 58, cy - 140, 30, 34);
      ctx.fillStyle = '#5c677d'; ctx.beginPath(); ctx.roundRect(W / 2 - 34, cy - 70, 68, 80, [34, 34, 0, 0]); ctx.fill();
      tag('Guards: ' + L.castle, W / 2, cy - 160, '#c9184a');
    }

    const cx = W / 2 + x * half;
    if (n > 0) crowd(cx, py, n, '#3a86ff', 1);
    tag(String(n), cx, py - 26 - Math.sqrt(Math.min(n, 140)) * 4.4, '#1b4f8a');
    for (const p of pops) {
      ctx.globalAlpha = 1 - p.t; ctx.font = `34px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillStyle = p.good ? '#1b4f8a' : '#c9184a';
      ctx.fillText(p.text, cx + 70, py - 40 - p.t * 60);
      ctx.globalAlpha = 1;
    }
    // HUD: level pill and progress bar
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(14, 14, 132, 38, 19); ctx.fill();
    ctx.fillStyle = '#1b3a5c'; ctx.font = `20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('Level ' + level, 80, 40);
    const bw = Math.min(W - 280, 300);
    if (bw > 60) {
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.roundRect(W / 2 - bw / 2, 26, bw, 12, 6); ctx.fill();
      ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.roundRect(W / 2 - bw / 2, 26, bw * Math.min(1, dist / L.end), 12, 6); ctx.fill();
    }
  }

  ui.onPause(() => { if (state === 'playing') ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart: () => load(level) }); });
  ui.title({
    buttons: level > 1 ? [{ label: 'Continue: level ' + level, onClick: () => load(level) }, { label: 'Start from level 1', onClick: () => load(1) }]
      : [{ label: 'Play', onClick: () => load(1) }],
  });
  Arcade.loop({ update, render }).start();
})();
