// Lot Jam: a packed car park. Tap a car and it drives straight ahead and out,
// if nothing is in its way. Tapping a blocked car costs a cone. Later levels
// add an ambulance on a deadline and drivers who are asleep at the wheel.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  const save = Arcade.save('lot-jam');

  const DISPLAY = '"Titan One", "Arial Black", sans-serif';
  const BODY = '"Rubik", "Segoe UI", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Lot Jam',
    tagline: 'Everyone wants out. Pick who goes first.',
    how: [['Tap a car', 'It drives straight ahead'], ['Blocked?', 'You lose a cone. Three cones per level'], ['Ambulance', 'Must be out before its counter hits 0'], ['Zzz', 'Tap once to wake, again to drive']],
    // Lot Jam's own look: road signs. Yellow boards, black edges, chunky type.
    theme: {
      fonts: 'family=Titan+One&family=Rubik:wght@500;700',
      display: DISPLAY, body: BODY,
      overlay: 'rgba(34, 38, 46, .8)',
      panel: '#ffd23f', panel2: '#f7c21c', edge: '#1c1f26',
      text: '#1c1f26', muted: '#5b4c12',
      accent: '#1c1f26', accentInk: '#ffd23f',
      radius: '16px', border: '5px',
      shadow: '0 10px 0 #1c1f26', buttonShadow: '0 4px 0 #1c1f26',
    },
  });

  const style = document.createElement('style');
  style.textContent = `
    .lj-top, .lj-bottom { position: fixed; z-index: 50; left: 0; right: 0; display: flex; gap: 10px; align-items: center; justify-content: center; font-family: ${BODY}; pointer-events: none; }
    .lj-top { top: max(12px, env(safe-area-inset-top)); padding: 0 110px 0 12px; justify-content: flex-start; flex-wrap: wrap; }
    .lj-bottom { bottom: max(16px, env(safe-area-inset-bottom)); }
    .lj-sign { font: 1.05rem ${DISPLAY}; color: #1c1f26; background: #ffd23f; border: 3px solid #1c1f26; border-radius: 8px; padding: 3px 12px; }
    .lj-sign.white { background: #fff; }
    .lj-sign.red { background: #e5383b; color: #fff; }
    .lj-bottom button { pointer-events: auto; font: 1rem ${DISPLAY}; color: #ffd23f; background: #1c1f26; border: 3px solid #ffd23f; border-radius: 10px; padding: 9px 20px; cursor: pointer; }
    .lj-bottom button:active { transform: translateY(2px); }
    .lj-bottom button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
    .lj-hide { display: none; }`;
  document.head.appendChild(style);
  const top = document.createElement('div');
  top.className = 'lj-top lj-hide';
  top.innerHTML = '<span class="lj-sign" data-k="level"></span><span class="lj-sign white" data-k="cones"></span><span class="lj-sign red lj-hide" data-k="amb"></span>';
  const bottom = document.createElement('div');
  bottom.className = 'lj-bottom lj-hide';
  bottom.innerHTML = '<button type="button" data-a="undo">Undo</button><button type="button" data-a="restart">Restart</button>';
  document.body.append(top, bottom);

  const LEVELS = 60;
  const DIRS = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  const ANGLE = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };
  const PAINT = ['#e5383b', '#2a9d8f', '#3a86ff', '#ff9f1c', '#8338ec', '#06d6a0', '#ef476f', '#118ab2', '#f4a261'];

  // ---------- rules (also used by the level generator) ----------
  const cellsOf = (c) => Array.from({ length: c.len }, (_, i) => (c.dir === 'E' || c.dir === 'W' ? [c.x + i, c.y] : [c.x, c.y + i]));
  function frontOf(c) {
    if (c.dir === 'E') return [c.x + c.len - 1, c.y];
    if (c.dir === 'S') return [c.x, c.y + c.len - 1];
    return [c.x, c.y];
  }
  // The first car in the way of `c`, and how many free cells are in front of it.
  function lookAhead(c, cars, n) {
    const [dx, dy] = DIRS[c.dir];
    let [x, y] = frontOf(c), free = 0;
    for (;;) {
      x += dx; y += dy;
      if (x < 0 || y < 0 || x >= n || y >= n) return { blocker: null, free };
      const hit = cars.find((o) => o !== c && !o.out && cellsOf(o).some(([cx, cy]) => cx === x && cy === y));
      if (hit) return { blocker: hit, free };
      free++;
    }
  }
  // A lot can be emptied if you can keep finding a car with a clear run.
  // Letting a car out never blocks another, so trying them in any order works.
  function solveRounds(cars, n) {
    const left = cars.map((c) => ({ ...c, out: false }));
    let rounds = 0;
    while (left.some((c) => !c.out)) {
      const free = left.filter((c) => !c.out && !lookAhead(c, left, n).blocker);
      if (!free.length) return 0;
      free.forEach((c) => { c.out = true; });
      rounds++;
    }
    return rounds;
  }
  // Every car that has to leave before `c` can.
  function mustLeaveFirst(c, cars, n, seen = new Set()) {
    const [dx, dy] = DIRS[c.dir];
    let [x, y] = frontOf(c);
    for (;;) {
      x += dx; y += dy;
      if (x < 0 || y < 0 || x >= n || y >= n) break;
      const hit = cars.find((o) => o !== c && cellsOf(o).some(([cx, cy]) => cx === x && cy === y));
      if (hit && !seen.has(hit)) { seen.add(hit); mustLeaveFirst(hit, cars, n, seen); }
    }
    return seen;
  }

  // The same level number builds the same lot for everyone. Cars are added one
  // at a time and kept only if the lot can still be emptied.
  function makeLevel(lv) {
    const rand = Arcade.rng(Arcade.rng.hash('lot-jam:' + lv));
    const n = lv <= 5 ? 5 : lv <= 16 ? 6 : lv <= 36 ? 7 : 8;
    const want = Math.min(4 + Math.floor(lv * 0.45), Math.floor(n * n * 0.3));
    const cars = [];
    for (let tries = 0; tries < 900 && cars.length < want; tries++) {
      const dir = rand.pick(['N', 'E', 'S', 'W']);
      const len = rand() < 0.7 ? 2 : 3;
      const horiz = dir === 'E' || dir === 'W';
      const c = { x: rand.int(0, n - (horiz ? len : 1)), y: rand.int(0, n - (horiz ? 1 : len)), dir, len };
      if (cellsOf(c).some(([x, y]) => cars.some((o) => cellsOf(o).some(([ox, oy]) => ox === x && oy === y)))) continue;
      cars.push(c);
      // Early on, prefer cars that are boxed in, so there is something to work out.
      const boring = tries < 500 && cars.length > 2 && !lookAhead(c, cars, n).blocker;
      if (boring || !solveRounds(cars, n)) cars.pop();
    }
    cars.forEach((c, i) => { c.color = PAINT[i % PAINT.length]; c.kind = 'car'; c.asleep = false; });
    let deadline = 0;
    if (lv >= 8) {
      // The ambulance is a car with a few others in its way, and its deadline
      // leaves only one spare move, so it has to be a priority.
      const half = Math.floor(cars.length / 2);
      const ranked = cars.map((c) => [c, mustLeaveFirst(c, cars, n).size]).filter(([, k]) => k >= 2 && k <= half).sort((a, b) => b[1] - a[1]);
      if (ranked.length) {
        const [amb, k] = ranked[0];
        amb.kind = 'ambulance';
        deadline = k + 2;
      }
    }
    if (lv >= 14) {
      const sleepy = rand.shuffle(cars.filter((c) => c.kind === 'car')).slice(0, 1 + (lv > 30) + (lv > 45));
      sleepy.forEach((c) => { c.asleep = true; });
    }
    return { n, cars, deadline };
  }

  // ---------- game state ----------
  let state = 'menu'; // menu | playing | won | lost
  let level = Math.min(save.get('level', 1), LEVELS);
  let lot, cars, cones, exits, history, endT, lostWhy, cursor, showCursor, time = 0, G;

  function load(lv) {
    level = lv;
    lot = makeLevel(level);
    reset();
    top.classList.remove('lj-hide'); bottom.classList.remove('lj-hide');
    ui.hide(); input.flush();
  }
  function reset() {
    cars = lot.cars.map((c) => ({ ...c, out: false, anim: null }));
    cones = 3; exits = 0; history = []; endT = 0;
    cursor = [0, 0];
    state = 'playing';
    paintHud();
  }
  function paintHud() {
    top.querySelector('[data-k="level"]').textContent = 'Level ' + level;
    top.querySelector('[data-k="cones"]').textContent = '▲'.repeat(cones) + '△'.repeat(3 - cones);
    const amb = top.querySelector('[data-k="amb"]');
    const waiting = lot.deadline && cars.some((c) => c.kind === 'ambulance' && !c.out);
    amb.classList.toggle('lj-hide', !waiting);
    amb.textContent = 'Ambulance: ' + Math.max(0, lot.deadline - exits) + ' left';
  }

  function tap(c) {
    if (state !== 'playing' || c.out || c.anim) return;
    if (c.asleep) { c.asleep = false; c.wake = time; Arcade.audio.sfx('blip', { freq: 700 }); return; }
    const look = lookAhead(c, cars, lot.n);
    if (look.blocker) {
      c.anim = { type: 'bump', t: 0, free: look.free };
      cones--;
      Arcade.audio.sfx('hit');
      paintHud();
      if (cones <= 0) lose('Out of cones');
      return;
    }
    c.out = true;
    c.anim = { type: 'out', t: 0 };
    exits++;
    history.push(c);
    Arcade.audio.beep({ freq: 220, slide: 520, dur: 0.25, type: 'sawtooth', vol: 0.18 });
    paintHud();
    if (cars.every((o) => o.out)) { state = 'won'; endT = 0; Arcade.audio.sfx('win', { delay: 0.3 }); }
    else if (lot.deadline && exits >= lot.deadline && cars.some((o) => o.kind === 'ambulance' && !o.out)) lose('The ambulance got stuck');
  }
  function lose(why) { state = 'lost'; endT = 0; lostWhy = why; Arcade.audio.sfx('lose', { delay: 0.2 }); }
  function undo() {
    if (state !== 'playing' || !history.length) return;
    const c = history.pop();
    c.out = false; c.anim = null; exits--;
    paintHud();
  }

  bottom.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    b.blur();
    if (b.dataset.a === 'undo') undo();
    if (b.dataset.a === 'restart' && state === 'playing') reset();
  });
  const carAt = (gx, gy) => cars.find((c) => !c.out && cellsOf(c).some(([x, y]) => x === gx && y === gy));
  canvas.addEventListener('pointerdown', (e) => {
    if (!G || state !== 'playing') return;
    showCursor = false;
    const c = carAt(Math.floor((e.offsetX - G.x) / G.cell), Math.floor((e.offsetY - G.y) / G.cell));
    if (c) tap(c);
  });

  function update(dt) {
    input.poll();
    time += dt;
    if (state === 'menu') return;
    for (const c of cars) {
      if (!c.anim) continue;
      c.anim.t += dt * (c.anim.type === 'out' ? 1.6 : 3.2);
      if (c.anim.t >= 1) c.anim = c.anim.type === 'out' ? { type: 'gone', t: 1 } : null;
    }
    if (state === 'playing' && !ui.visible) {
      const p = input.solo;
      const moved = [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]].filter(([k]) => p.pressed(k));
      for (const [, dx, dy] of moved) {
        cursor = [Math.max(0, Math.min(lot.n - 1, cursor[0] + dx)), Math.max(0, Math.min(lot.n - 1, cursor[1] + dy))];
        showCursor = true;
      }
      if (p.pressed('a')) { if (showCursor) { const c = carAt(...cursor); if (c) tap(c); } else showCursor = true; }
      if (p.pressed('b')) undo();
    }
    if (state === 'won' || state === 'lost') {
      endT += dt;
      if (endT > 1.2 && !ui.visible) {
        top.classList.add('lj-hide'); bottom.classList.add('lj-hide');
        if (state === 'won') {
          const stars = cones;
          const all = save.get('stars', {});
          all[level] = Math.max(all[level] || 0, stars);
          save.set('stars', all);
          if (level < LEVELS) save.set('level', Math.max(save.get('level', 1), level + 1));
          const total = Object.values(all).reduce((a, b) => a + b, 0);
          ui.results({
            heading: 'Lot cleared!',
            rows: [['Level ' + level, '★'.repeat(stars) + '☆'.repeat(3 - stars)], ['All stars', total + ' / ' + LEVELS * 3]],
            buttons: level < LEVELS
              ? [{ label: 'Next level', onClick: () => load(level + 1) }, { label: 'Replay', onClick: () => load(level) }]
              : [{ label: 'Replay', onClick: () => load(level) }, { label: 'Back to level 1', onClick: () => load(1) }],
          });
        } else {
          ui.results({ heading: lostWhy, rows: [['Level', level]], buttons: [{ label: 'Try again', onClick: () => load(level) }] });
        }
      }
    }
  }

  // ---------- drawing ----------
  function drawCar(c) {
    const cell = G.cell, horiz = c.dir === 'E' || c.dir === 'W';
    let cx = G.x + (c.x + (horiz ? c.len / 2 : 0.5)) * cell;
    let cy = G.y + (c.y + (horiz ? 0.5 : c.len / 2)) * cell;
    const [dx, dy] = DIRS[c.dir];
    let move = 0;
    if (c.anim && c.anim.type === 'out') move = c.anim.t * c.anim.t * (lot.n + 3);
    if (c.anim && c.anim.type === 'bump') move = Math.sin(c.anim.t * Math.PI) * (c.anim.free + 0.28);
    cx += dx * move * cell; cy += dy * move * cell;

    const L = c.len * cell - cell * 0.16, Wd = cell * 0.72;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ANGLE[c.dir]);
    const amb = c.kind === 'ambulance';
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.roundRect(-L / 2 + 3, -Wd / 2 + 5, L, Wd, cell * 0.2); ctx.fill();
    ctx.fillStyle = '#1c1f26';   // wheels
    for (const wx of [-L * 0.28, L * 0.28]) for (const wy of [-Wd / 2 - 2, Wd / 2 - cell * 0.1 + 2]) ctx.fillRect(wx - cell * 0.11, wy, cell * 0.22, cell * 0.1);
    ctx.fillStyle = amb ? '#ffffff' : c.color;
    ctx.beginPath(); ctx.roundRect(-L / 2, -Wd / 2, L, Wd, cell * 0.2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#1c1f26'; ctx.stroke();
    ctx.fillStyle = '#bfe6ff';   // windscreen, at the front
    ctx.beginPath(); ctx.roundRect(L / 2 - cell * 0.42, -Wd / 2 + cell * 0.1, cell * 0.2, Wd - cell * 0.2, cell * 0.05); ctx.fill();
    ctx.fillStyle = '#fff3b0';   // headlights
    ctx.fillRect(L / 2 - cell * 0.07, -Wd / 2 + cell * 0.08, cell * 0.06, cell * 0.12);
    ctx.fillRect(L / 2 - cell * 0.07, Wd / 2 - cell * 0.2, cell * 0.06, cell * 0.12);
    if (amb) {
      ctx.fillStyle = '#e5383b';
      ctx.fillRect(-cell * 0.3, -cell * 0.07, cell * 0.36, cell * 0.14);
      ctx.fillRect(-cell * 0.19, -cell * 0.18, cell * 0.14, cell * 0.36);
      ctx.fillStyle = Math.sin(time * 12) > 0 ? '#3a86ff' : '#e5383b';
      ctx.beginPath(); ctx.arc(cell * 0.3, 0, cell * 0.07, 0, 6.3); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = cell * 0.07; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-cell * 0.28, -cell * 0.14); ctx.lineTo(-cell * 0.1, 0); ctx.lineTo(-cell * 0.28, cell * 0.14); ctx.stroke();
    }
    ctx.restore();
    if (c.asleep) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1c1f26'; ctx.lineWidth = 4;
      ctx.font = `${Math.round(cell * 0.34)}px ${DISPLAY}`; ctx.textAlign = 'center';
      const bob = Math.sin(time * 3) * 3;
      ctx.strokeText('Zzz', cx, cy - cell * 0.1 + bob); ctx.fillText('Zzz', cx, cy - cell * 0.1 + bob);
    }
  }

  function render() {
    // Tarmac, with a grass verge around the lot.
    ctx.fillStyle = '#5a8f4e'; ctx.fillRect(0, 0, W, H);
    if (state === 'menu') return;
    const size = Math.min(W - 24, H - 170), n = lot.n, cell = size / n;
    G = { x: (W - size) / 2, y: (H - size) / 2 + 12, cell, size };
    ctx.fillStyle = '#d8d2c4';
    ctx.beginPath(); ctx.roundRect(G.x - 10, G.y - 10, size + 20, size + 20, 14); ctx.fill();
    ctx.fillStyle = '#4a4f5a';
    ctx.beginPath(); ctx.roundRect(G.x, G.y, size, size, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 210, 63, 0.55)'; ctx.lineWidth = 2; ctx.setLineDash([cell * 0.3, cell * 0.2]);
    ctx.beginPath();
    for (let k = 1; k < n; k++) {
      ctx.moveTo(G.x + k * cell, G.y + 6); ctx.lineTo(G.x + k * cell, G.y + size - 6);
      ctx.moveTo(G.x + 6, G.y + k * cell); ctx.lineTo(G.x + size - 6, G.y + k * cell);
    }
    ctx.stroke(); ctx.setLineDash([]);

    if (showCursor && state === 'playing') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
      ctx.strokeRect(G.x + cursor[0] * cell + 3, G.y + cursor[1] * cell + 3, cell - 6, cell - 6);
    }
    // Keep cars that are driving away inside the picture's edges.
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    for (const c of cars) if (!c.out) drawCar(c);
    for (const c of cars) if (c.out && c.anim && c.anim.type === 'out') drawCar(c);
    ctx.restore();
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
