// Pin Pickle: pull the pins in the right order so the gold reaches the
// explorer's cart and the lava doesn't. The falling and flowing is done by
// sim.js; this file draws it and handles the player.
(function () {
  const Sim = window.PinSim, LEVELS = window.PinLevels;
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  const save = Arcade.save('pin-pickle');

  const DISPLAY = '"Pirata One", "Georgia", serif';
  const BODY = '"Alegreya Sans", "Trebuchet MS", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Pin Pickle',
    tagline: 'Gold to the cart. Lava anywhere else.',
    how: [['Tap a pin', 'Pull it out'], ['1 – 9', 'Pull by number'], ['Gold', 'Melts in lava, sinks in water'], ['Water + lava', 'Makes harmless rubble']],
    // Pin Pickle's own look: an old treasure map. Parchment, ink and a ruby seal.
    theme: {
      fonts: 'family=Pirata+One&family=Alegreya+Sans:wght@500;700',
      display: DISPLAY, body: BODY,
      overlay: 'rgba(20, 12, 30, .8)',
      panel: '#f1e3c4', panel2: '#e4d2a8', edge: '#5b3a1e',
      text: '#3a2412', muted: '#7a5a3a',
      accent: '#b3261e', accentInk: '#fdf3dc',
      radius: '6px', border: '3px',
      shadow: '0 0 0 6px #f1e3c4, 0 0 0 8px #5b3a1e, 0 18px 40px rgba(0,0,0,.5)', buttonShadow: 'none',
      titleSize: 'clamp(2.4rem, 11vw, 3.4rem)',
    },
  });

  const style = document.createElement('style');
  style.textContent = `
    .pk-tag, .pk-bottom { position: fixed; z-index: 50; font-family: ${BODY}; }
    .pk-tag { top: max(12px, env(safe-area-inset-top)); left: max(12px, env(safe-area-inset-left)); max-width: calc(100% - 130px);
      color: #3a2412; background: #f1e3c4; border: 2px solid #5b3a1e; border-radius: 4px; padding: 4px 12px; transform: rotate(-1.5deg); box-shadow: 3px 4px 0 rgba(0,0,0,.35); }
    .pk-tag b { font: 1.35rem ${DISPLAY}; margin-right: 8px; }
    .pk-tag small { display: block; font-size: .85rem; font-style: italic; color: #7a5a3a; line-height: 1.2; padding-bottom: 2px; }
    .pk-bottom { bottom: max(14px, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); }
    .pk-bottom button { font: 1.2rem ${DISPLAY}; color: #fdf3dc; background: #b3261e; border: 2px solid #5b3a1e; border-radius: 4px; padding: 6px 22px; cursor: pointer; box-shadow: 3px 4px 0 rgba(0,0,0,.35); }
    .pk-bottom button:active { transform: translate(2px, 3px); box-shadow: none; }
    .pk-bottom button:focus-visible { outline: 3px solid #ffd23f; outline-offset: 2px; }
    .pk-hide { display: none; }`;
  document.head.appendChild(style);
  const tag = document.createElement('div');
  tag.className = 'pk-tag pk-hide';
  const bottom = document.createElement('div');
  bottom.className = 'pk-bottom pk-hide';
  bottom.innerHTML = '<button type="button">Start over</button>';
  document.body.append(tag, bottom);

  let state = 'menu'; // menu | playing | won | lost
  let level = Math.min(save.get('level', 1), LEVELS.length);
  let sim, pins, pulled, endT, time = 0, view, pixels, small, sctx;

  function load(n) {
    level = n;
    const def = LEVELS[level - 1];
    sim = Sim.create(def);
    // Where each pin sits, for drawing and tapping.
    pins = sim.pins.map((id) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let i = 0; i < sim.cells.length; i++) if (sim.pinId[i] === id) {
        const x = i % sim.w, y = (i / sim.w) | 0;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
      }
      return { id, x0, y0, x1, y1, out: 0 };
    });
    small = document.createElement('canvas');
    small.width = sim.w; small.height = sim.h;
    sctx = small.getContext('2d');
    pixels = sctx.createImageData(sim.w, sim.h);
    endT = 0;
    tag.innerHTML = `<b>${level}</b>${def.name}${def.tip ? `<small>${def.tip}</small>` : ''}`;
    tag.classList.remove('pk-hide'); bottom.classList.remove('pk-hide');
    ui.hide(); input.flush();
    state = 'playing';
  }

  function pullPin(p) {
    if (state !== 'playing' || p.out) return;
    Sim.pull(sim, p.id);
    p.out = 0.001;
    Arcade.audio.beep({ freq: 700, slide: 240, dur: 0.14, type: 'triangle', vol: 0.4 });
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'playing' || !view) return;
    const cx = (e.offsetX - view.x) / view.px, cy = (e.offsetY - view.y) / view.px;
    const pad = 4;
    const hit = pins.filter((p) => !p.out && cx > p.x0 - pad && cx < p.x1 + pad && cy > p.y0 - pad && cy < p.y1 + pad)
      .sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - cx, (a.y0 + a.y1) / 2 - cy) - Math.hypot((b.x0 + b.x1) / 2 - cx, (b.y0 + b.y1) / 2 - cy))[0];
    if (hit) pullPin(hit);
  });
  addEventListener('keydown', (e) => {
    if (state !== 'playing' || ui.visible) return;
    const m = e.code.match(/^(?:Digit|Numpad)(\d)$/);
    if (m) { const p = pins.find((q) => q.id === +m[1]); if (p) pullPin(p); }
    if (e.code === 'KeyR') load(level);
  });
  bottom.addEventListener('click', (e) => { e.target.blur(); if (state === 'playing' || state === 'lost') load(level); });

  let lastGold = 0;
  function update(dt) {
    input.poll();
    time += dt;
    if (state === 'menu' || ui.visible) return;
    for (const p of pins) if (p.out) p.out = Math.min(1, p.out + dt * 3);
    if (state === 'playing' || endT < 0.8) {
      for (let k = 0; k < 2; k++) if (!sim.dead) Sim.step(sim);
    }
    if (sim.collected > lastGold && time - (update.chime || 0) > 0.06) {
      update.chime = time;
      Arcade.audio.beep({ freq: 900 + (sim.collected % 7) * 60, dur: 0.05, type: 'square', vol: 0.12 });
    }
    lastGold = sim.collected;
    if (state === 'playing') {
      if (Sim.won(sim)) { state = 'won'; endT = 0; Arcade.audio.sfx('win'); }
      else if (Sim.failed(sim)) { state = 'lost'; endT = 0; Arcade.audio.sfx('lose'); }
    } else {
      endT += dt;
      if (endT > 1.3) {
        tag.classList.add('pk-hide'); bottom.classList.add('pk-hide');
        if (state === 'won') {
          const last = level === LEVELS.length;
          if (!last) save.set('level', Math.max(save.get('level', 1), level + 1));
          ui.results({
            heading: last ? 'Every vault emptied!' : 'Struck gold!',
            rows: [['Level', level + ' / ' + LEVELS.length], ['Gold saved', Math.round((sim.collected / sim.gold) * 100) + '%']],
            note: last ? 'That was the last level for now. More are on the way.' : '',
            buttons: last
              ? [{ label: 'Play from level 1', onClick: () => load(1) }]
              : [{ label: 'Next level', onClick: () => load(level + 1) }, { label: 'Replay', onClick: () => load(level) }],
          });
        } else {
          ui.results({
            heading: sim.dead ? 'Lava in the cart!' : 'The gold melted',
            rows: [['Level', level + ' / ' + LEVELS.length]],
            buttons: [{ label: 'Try again', onClick: () => load(level) }],
          });
        }
      }
    }
  }

  // ---------- drawing ----------
  function paintCells() {
    const d = pixels.data, { cells, w } = sim, t = sim.tick;
    for (let i = 0; i < cells.length; i++) {
      const x = i % w, y = (i / w) | 0, n = ((((x * 73856093) ^ (y * 19349663)) >>> 0) % 5) * 4;
      let r = 0, g = 0, b = 0, a = 255;
      switch (cells[i]) {
        case Sim.WALL: r = 74 + n; g = 52 + n; b = 92 + n; break;
        case Sim.GOLD: { const s = (x * 3 + y * 5 + (t >> 3)) % 9 === 0 ? 40 : 0; r = 255; g = 196 + s; b = 40 + s * 3; break; }
        case Sim.WATER: r = 50 + n; g = 150 + n; b = 255; a = 225; break;
        case Sim.LAVA: { const f = ((x + y * 3 + (t >> 2)) % 6) * 12; r = 255; g = 70 + f; b = 20; break; }
        case Sim.STONE: r = 140 + n; g = 134 + n; b = 148 + n; break;
        default: a = 0;
      }
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = a;
    }
    sctx.putImageData(pixels, 0, 0);
  }

  function render() {
    const bg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, Math.max(W, H) * 0.7);
    bg.addColorStop(0, '#34224a'); bg.addColorStop(1, '#150d20');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    if (state === 'menu') return;

    const px = Math.min((W - 16) / sim.w, (H - 200) / sim.h);
    view = { px, x: (W - sim.w * px) / 2, y: (H - sim.h * px) / 2 + 22 };
    ctx.fillStyle = '#231733';
    ctx.fillRect(view.x, view.y, sim.w * px, sim.h * px);
    paintCells();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, view.x, view.y, sim.w * px, sim.h * px);
    const X = (c) => view.x + c * px, Y = (c) => view.y + c * px;

    // the explorer's cart, over the collecting cells
    let hx0 = 1e9, hx1 = -1, hy0 = 1e9, hy1 = -1;
    for (let i = 0; i < sim.cells.length; i++) if (sim.cells[i] === Sim.HERO) {
      const x = i % sim.w, y = (i / sim.w) | 0;
      hx0 = Math.min(hx0, x); hx1 = Math.max(hx1, x + 1); hy0 = Math.min(hy0, y); hy1 = Math.max(hy1, y + 1);
    }
    const cw = (hx1 - hx0) * px, ch = (hy1 - hy0) * px;
    ctx.fillStyle = sim.dead ? '#3a2412' : '#8a5a2b';
    ctx.beginPath(); ctx.roundRect(X(hx0), Y(hy0) + ch * 0.2, cw, ch * 0.8, px); ctx.fill();
    ctx.strokeStyle = '#3a2412'; ctx.lineWidth = Math.max(2, px * 0.5); ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    const fill = Math.min(1, sim.collected / sim.need);
    if (fill > 0.05) ctx.fillRect(X(hx0) + px, Y(hy0) + ch * (1 - fill * 0.7), cw - px * 2, ch * fill * 0.7 - px * 0.5);
    ctx.fillStyle = '#3a2412';
    for (const k of [0.2, 0.8]) { ctx.beginPath(); ctx.arc(X(hx0) + cw * k, Y(hy1), px * 0.9, 0, 6.3); ctx.fill(); }

    // pins: a steel bar with a numbered ring
    for (const p of pins) {
      if (p.out >= 1) continue;
      const horiz = p.x1 - p.x0 >= p.y1 - p.y0;
      const slide = p.out * px * 14;
      ctx.globalAlpha = 1 - p.out;
      const bx = X(p.x0) + (horiz ? slide : 0), by = Y(p.y0) - (horiz ? 0 : slide);
      const bw = (p.x1 - p.x0) * px, bh = (p.y1 - p.y0) * px;
      const thick = Math.min(bw, bh);
      ctx.fillStyle = '#cfd6e2'; ctx.strokeStyle = '#2c2238'; ctx.lineWidth = Math.max(2, px * 0.45);
      ctx.beginPath();
      if (horiz) ctx.roundRect(bx, by + thick * 0.2, bw, thick * 0.6, thick * 0.3);
      else ctx.roundRect(bx + thick * 0.2, by, thick * 0.6, bh, thick * 0.3);
      ctx.fill(); ctx.stroke();
      const rx = horiz ? bx + bw : bx + thick / 2, ry = horiz ? by + thick / 2 : by;
      ctx.beginPath(); ctx.arc(rx, ry, thick * 0.85, 0, 6.3);
      ctx.fillStyle = '#b3261e'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fdf3dc'; ctx.font = `${Math.round(thick * 1.25)}px ${DISPLAY}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.id, rx, ry + thick * 0.08);
      ctx.globalAlpha = 1;
    }

    // gold tally: a strip of parchment above the cave
    const mw = Math.min(260, sim.w * px), mx = W / 2 - mw / 2, my = view.y - 30;
    ctx.fillStyle = '#f1e3c4'; ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(mx, my, mw, 18, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e0a800';
    ctx.fillRect(mx + 2, my + 2, (mw - 4) * Math.min(1, sim.collected / sim.gold), 14);
    ctx.fillStyle = '#b3261e';
    ctx.fillRect(mx + 2 + (mw - 4) * 0.8 - 1, my - 3, 3, 24);       // the 80% line
    ctx.font = `700 12px ${BODY}`; ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f1e3c4';
    ctx.fillText(Math.round((sim.collected / sim.gold) * 100) + '%  (need 80%)', mx + mw, my - 6);
    ctx.fillStyle = '#f1e3c4'; ctx.textAlign = 'left';
    ctx.fillText('GOLD', mx, my - 6);
  }

  ui.onPause(() => {
    if (state !== 'playing') return;
    ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart: () => load(level) });
  });
  ui.title({
    buttons: level > 1
      ? [{ label: 'Continue: level ' + level, onClick: () => load(level) }, { label: 'Start from level 1', onClick: () => load(1) }]
      : [{ label: 'Play', onClick: () => load(1) }],
  });
  Arcade.loop({ update, render }).start();
})();
