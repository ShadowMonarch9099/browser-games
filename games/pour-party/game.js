// Pour Party: pour coloured liquid between tubes until every tube holds one
// colour. From level 10, layers below the top are a mystery until uncovered.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  const save = Arcade.save('pour-party');

  const FONT = '"Fredoka", "Trebuchet MS", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Pour Party',
    tagline: 'Sort the colours. One tube, one colour.',
    how: [['Tap a tube', 'Pick it up, then tap where to pour'], ['← → + Space', 'Same, on a keyboard'], ['U', 'Undo']],
    // Pour Party's own look: a soda-fountain party in teal, cream and coral.
    theme: {
      fonts: 'family=Fredoka:wght@500;600;700',
      display: FONT, body: FONT,
      overlay: 'rgba(6, 40, 48, .7)',
      panel: '#fff8ec', panel2: '#f6e9d2', edge: '#e6d3b3',
      text: '#17404a', muted: '#5e7f86',
      accent: '#ff6f59', accentInk: '#ffffff',
      radius: '28px', border: '0px',
      shadow: '0 22px 0 rgba(0, 0, 0, .18)', buttonShadow: '0 5px 0 rgba(23, 64, 74, .18)',
    },
  });

  // The HUD is plain HTML so it stays crisp and easy to tap.
  const style = document.createElement('style');
  style.textContent = `
    .pp-info, .pp-actions { position: fixed; z-index: 50; font-family: ${FONT}; color: #fff8ec; display: flex; gap: 10px; align-items: center; }
    .pp-info { top: max(12px, env(safe-area-inset-top)); left: max(14px, env(safe-area-inset-left)); }
    .pp-level { font-weight: 700; font-size: 1.25rem; background: #ff6f59; padding: 4px 16px; border-radius: 999px; box-shadow: 0 4px 0 rgba(0,0,0,.2); }
    .pp-moves { font-weight: 500; opacity: .85; }
    .pp-actions { bottom: max(18px, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); }
    .pp-actions button { font: 600 1rem ${FONT}; color: #17404a; background: #fff8ec; border: 0; border-radius: 999px; padding: 10px 20px; box-shadow: 0 5px 0 rgba(0,0,0,.22); cursor: pointer; }
    .pp-actions button:active { transform: translateY(3px); box-shadow: 0 2px 0 rgba(0,0,0,.22); }
    .pp-actions button:focus-visible { outline: 3px solid #ffd166; outline-offset: 2px; }
    .pp-hide { display: none; }`;
  document.head.appendChild(style);
  const info = document.createElement('div');
  info.className = 'pp-info pp-hide';
  info.innerHTML = '<span class="pp-level"></span><span class="pp-moves"></span>';
  const actions = document.createElement('div');
  actions.className = 'pp-actions pp-hide';
  actions.innerHTML = '<button type="button" data-a="undo">Undo</button><button type="button" data-a="hint">Hint</button><button type="button" data-a="restart">Restart</button>';
  document.body.append(info, actions);

  const CAP = 4;
  // Each colour has a symbol too, so colour is never the only clue.
  const COLORS = [
    ['#ff5d73', '●'], ['#ffb400', '▲'], ['#3ddc97', '■'], ['#3fa7ff', '◆'], ['#b388ff', '✚'],
    ['#ff8fd0', '★'], ['#f4f1de', '✖'], ['#00c2c7', '◐'], ['#a06a42', '♥'],
  ];
  const coloursFor = (lv) => (lv <= 3 ? 3 : lv <= 8 ? 4 : lv <= 15 ? 5 : lv <= 30 ? 6 : lv <= 60 ? 7 : lv <= 100 ? 8 : 9);

  let state = 'menu'; // menu | playing | won
  let level = save.get('level', 1);
  let tubes, start, history, moves, selected, cursor, showCursor, hint, lift, rects, wonT, time = 0;

  // ---------- rules ----------
  const top = (t) => t[t.length - 1];
  const complete = (t) => t.length === CAP && t.every((u) => u.c === t[0].c);
  const solved = (ts) => ts.every((t) => t.length === 0 || complete(t));
  // How many units on top share a colour (hidden ones never come along).
  function run(t) {
    let k = 0;
    for (let i = t.length - 1; i >= 0 && t[i].c === top(t).c && !t[i].hidden; i--) k++;
    return k;
  }
  function canPour(from, to) {
    if (from === to || !from.length || to.length >= CAP) return 0;
    if (to.length && top(to).c !== top(from).c) return 0;
    return Math.min(run(from), CAP - to.length);
  }

  // Depth-first search for a solution. Used to make sure every level can be
  // solved, and to give hints. Returns a list of [from, to] or null.
  function solve(ts, limit = 40000) {
    const cur = ts.map((t) => t.map((u) => u.c));
    const seen = new Set();
    const path = [];
    let nodes = 0;
    const done = () => cur.every((t) => !t.length || (t.length === CAP && t.every((c) => c === t[0])));
    function dfs() {
      if (done()) return true;
      if (++nodes > limit) return false;
      const key = cur.map((t) => t.join(',')).sort().join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      for (let i = 0; i < cur.length; i++) {
        const a = cur[i];
        if (!a.length) continue;
        const c = a[a.length - 1];
        let k = 1;
        while (k < a.length && a[a.length - 1 - k] === c) k++;
        if (k === CAP) continue;            // finished tube
        let triedEmpty = false;
        for (let j = 0; j < cur.length; j++) {
          const b = cur[j];
          if (j === i || b.length + k > CAP) continue;
          if (b.length) { if (b[b.length - 1] !== c) continue; }
          else { if (k === a.length || triedEmpty) continue; triedEmpty = true; }
          for (let n = 0; n < k; n++) b.push(a.pop());
          path.push([i, j]);
          if (dfs()) return true;
          path.pop();
          for (let n = 0; n < k; n++) a.push(b.pop());
        }
      }
      return false;
    }
    return dfs() ? path : null;
  }

  // The same level number gives everyone the same puzzle.
  function makeLevel(lv) {
    const rand = Arcade.rng(Arcade.rng.hash('pour-party:' + lv));
    const n = coloursFor(lv);
    for (;;) {
      const units = [];
      for (let c = 0; c < n; c++) for (let i = 0; i < CAP; i++) units.push(c);
      rand.shuffle(units);
      const ts = [];
      for (let t = 0; t < n; t++) ts.push(units.slice(t * CAP, t * CAP + CAP).map((c) => ({ c, hidden: false })));
      ts.push([], []);
      if (ts.some(complete) || !solve(ts)) continue;
      if (lv >= 10) for (const t of ts) t.forEach((u, i) => { u.hidden = i < t.length - 1; });
      return ts;
    }
  }

  const copy = (ts) => ts.map((t) => t.map((u) => ({ ...u })));

  function load(lv) {
    level = lv;
    save.set('level', level);
    start = makeLevel(level);
    reset();
    info.classList.remove('pp-hide');
    actions.classList.remove('pp-hide');
    ui.hide();
    input.flush();
    state = 'playing';
  }
  function reset() {
    tubes = copy(start);
    history = []; moves = 0; selected = null; hint = null; wonT = 0;
    cursor = 0;
    lift = tubes.map(() => 0);
    paintHud();
  }
  function paintHud() {
    info.querySelector('.pp-level').textContent = 'Level ' + level;
    info.querySelector('.pp-moves').textContent = moves + (moves === 1 ? ' move' : ' moves');
  }

  function pour(i, j) {
    const n = canPour(tubes[i], tubes[j]);
    if (!n) return false;
    history.push(copy(tubes));
    for (let k = 0; k < n; k++) tubes[j].push(tubes[i].pop());
    if (tubes[i].length) top(tubes[i]).hidden = false;
    moves++;
    hint = null;
    paintHud();
    Arcade.audio.beep({ freq: 300 + tubes[j].length * 70, slide: 520 + tubes[j].length * 70, dur: 0.18, type: 'sine', vol: 0.4 });
    if (complete(tubes[j])) Arcade.audio.sfx('coin', { delay: 0.12 });
    if (solved(tubes)) { state = 'won'; wonT = 0; Arcade.audio.sfx('win', { delay: 0.25 }); }
    return true;
  }

  function tap(i) {
    if (state !== 'playing') return;
    if (selected === null) {
      if (tubes[i].length && !complete(tubes[i])) { selected = i; Arcade.audio.sfx('blip'); }
    } else if (i === selected) {
      selected = null;
    } else if (pour(selected, i)) {
      selected = null;
    } else if (tubes[i].length && !complete(tubes[i])) {
      selected = i; Arcade.audio.sfx('blip');
    } else {
      Arcade.audio.beep({ freq: 160, dur: 0.1, type: 'triangle', vol: 0.3 });
    }
  }
  function undo() {
    if (state !== 'playing' || !history.length) return;
    tubes = history.pop(); moves--; selected = null; hint = null;
    paintHud();
    Arcade.audio.sfx('blip', { freq: 330 });
  }
  function giveHint() {
    if (state !== 'playing') return;
    const path = solve(tubes);
    if (path && path.length) { hint = { from: path[0][0], to: path[0][1], t: 0 }; selected = null; }
    else ui.toast('Stuck! Try Undo or Restart');
  }

  actions.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    b.blur();
    if (b.dataset.a === 'undo') undo();
    if (b.dataset.a === 'hint') giveHint();
    if (b.dataset.a === 'restart' && state === 'playing') reset();
  });
  canvas.addEventListener('pointerdown', (e) => {
    showCursor = false;
    const i = rects.findIndex((r) => e.offsetX >= r.x - r.pad && e.offsetX <= r.x + r.w + r.pad && e.offsetY >= r.y - r.pad && e.offsetY <= r.y + r.h + r.pad);
    if (i !== -1) tap(i);
    else selected = null;
  });
  addEventListener('keydown', (e) => {
    if (state !== 'playing' || ui.visible) return;
    const m = e.code.match(/^Digit(\d)$/);
    if (m) { const i = (+m[1] + 9) % 10; if (i < tubes.length) tap(i); }
    if (e.code === 'KeyU' || e.code === 'Backspace') undo();
    if (e.code === 'KeyH') giveHint();
    if (e.code === 'KeyR') reset();
  });

  function update(dt) {
    input.poll();
    time += dt;
    if (state === 'menu') return;
    const p = input.solo;
    if (state === 'playing' && !ui.visible) {
      if (p.pressed('left')) { cursor = (cursor + tubes.length - 1) % tubes.length; showCursor = true; }
      if (p.pressed('right')) { cursor = (cursor + 1) % tubes.length; showCursor = true; }
      if (p.pressed('a')) { if (showCursor) tap(cursor); else showCursor = true; }
    }
    tubes.forEach((_, i) => { lift[i] += ((i === selected ? 1 : 0) - lift[i]) * Math.min(1, dt * 16); });
    if (hint) { hint.t += dt; if (hint.t > 4) hint = null; }
    if (state === 'won') {
      wonT += dt;
      if (wonT > 1.1 && !ui.visible) {
        info.classList.add('pp-hide'); actions.classList.add('pp-hide');
        ui.results({
          heading: 'Level ' + level + ' sorted!',
          rows: [['Moves', moves]],
          buttons: [{ label: 'Next level', onClick: () => load(level + 1) }, { label: 'Play it again', onClick: () => load(level) }],
        });
      }
    }
  }

  // ---------- drawing ----------
  const bubbles = (() => { const r = Arcade.rng(3); return Array.from({ length: 26 }, () => [r(), r(), 6 + r() * 26, 0.3 + r() * 0.7]); })();

  function layout() {
    const T = tubes.length;
    let best = null;
    for (const rows of [1, 2]) {
      const per = Math.ceil(T / rows);
      const u = Math.min((W * 0.94) / (per * 1.7), (H - 190) / (rows * 5.5), 62);
      if (!best || u > best.u) best = { rows, per, u };
    }
    const { rows, per, u } = best;
    const pitch = u * 1.7, rowH = u * 5.5;
    const y0 = (H - rows * rowH) / 2 + u * 0.7 + 10;
    rects = tubes.map((_, i) => {
      const r = Math.floor(i / per), inRow = r === rows - 1 ? T - per * (rows - 1) : per;
      const x0 = (W - inRow * pitch) / 2 + (pitch - u) / 2;
      return { x: x0 + (i % per) * pitch, y: y0 + r * rowH, w: u, h: u * 4.3, pad: u * 0.3, u };
    });
  }

  function tubePath(r, dy) {
    const rad = r.w / 2;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + dy);
    ctx.lineTo(r.x, r.y + dy + r.h - rad);
    ctx.arc(r.x + rad, r.y + dy + r.h - rad, rad, Math.PI, 0, true);
    ctx.lineTo(r.x + r.w, r.y + dy);
  }

  function render() {
    // Teal backdrop with slow fizzy bubbles.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0f5261'); g.addColorStop(1, '#0a2f3a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const [bx, by, br, bs] of bubbles) {
      const y = H - (((by * H + time * 22 * bs) % (H + 80)) - 40);
      ctx.beginPath(); ctx.arc(bx * W + Math.sin(time * bs + bx * 9) * 10, y, br, 0, 6.3);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
    }
    if (state === 'menu') return;
    layout();

    tubes.forEach((t, i) => {
      const r = rects[i], u = r.u;
      const dy = -lift[i] * u * 0.55 + (state === 'won' && complete(t) ? Math.sin(time * 9 + i) * 3 : 0);
      // liquid, clipped to the glass
      ctx.save();
      tubePath(r, dy); ctx.closePath(); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(r.x, r.y + dy, r.w, r.h);
      t.forEach((unit, k) => {
        const y = r.y + dy + r.h - (k + 1) * u;
        ctx.fillStyle = unit.hidden ? '#35525a' : COLORS[unit.c][0];
        ctx.fillRect(r.x, y, r.w, u + 0.6);
        ctx.fillStyle = unit.hidden ? '#9fb8be' : 'rgba(0,0,0,0.3)';
        ctx.font = `600 ${Math.round(u * 0.46)}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(unit.hidden ? '?' : COLORS[unit.c][1], r.x + r.w / 2, y + u / 2);
      });
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(r.x + r.w * 0.14, r.y + dy, r.w * 0.12, r.h);
      ctx.restore();
      // glass
      tubePath(r, dy);
      ctx.lineWidth = Math.max(2.5, u * 0.07); ctx.lineCap = 'round';
      ctx.strokeStyle = complete(t) ? '#ffd166' : 'rgba(255,248,236,0.85)';
      ctx.stroke();
      if (showCursor && i === cursor && state === 'playing') {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        const cx = r.x + r.w / 2, cy = r.y + r.h + u * 0.35;
        ctx.moveTo(cx, cy); ctx.lineTo(cx - u * 0.22, cy + u * 0.3); ctx.lineTo(cx + u * 0.22, cy + u * 0.3); ctx.fill();
      }
      if (hint && (i === hint.from || i === hint.to)) {
        const cx = r.x + r.w / 2, cy = r.y - u * 0.55 + Math.sin(time * 7) * 4;
        ctx.fillStyle = '#ffd166';
        ctx.font = `700 ${Math.round(u * 0.5)}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(i === hint.from ? '1' : '2', cx, cy);
      }
    });
    ctx.textBaseline = 'alphabetic';
  }

  ui.onPause(() => {
    if (state !== 'playing') return;
    ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart() { reset(); ui.hide(); input.flush(); } });
  });

  ui.title({
    buttons: level > 1
      ? [{ label: 'Continue: level ' + level, onClick: () => load(level) }, { label: 'Start from level 1', onClick: () => load(1) }]
      : [{ label: 'Play', onClick: () => load(1) }],
  });
  Arcade.loop({ update, render }).start();
})();
