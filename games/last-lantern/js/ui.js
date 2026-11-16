// Screens and HUD for Last Lantern, in brass and slate: menus are lines of
// engraved text, and the focused line has a small living flame beside it.
// Every interactive thing is registered on g.buttons each frame, so mouse,
// touch, keyboard and gamepad drive the same menus.
(function () {
  const C = LL.CFG;
  const G = LL.G;
  const U = LL.U;
  const I = LL.Input;
  const COL = LL.COL;
  const W = window.LLWorld;
  const R = LL.Render;
  const TAU = Math.PI * 2;
  const ROW = 38;

  const enter = (g, d = 0, dur = 0.35) => U.easeOut(U.clamp01((g.stateT - d) / dur));

  const GLYPH = {
    swing: { keyboard: 'SPACE', gamepad: 'A' },
    flame: { keyboard: 'G', gamepad: 'B' },
    map: { keyboard: 'M', gamepad: 'Y' },
    satchel: { keyboard: 'I', gamepad: 'X' },
    pause: { keyboard: 'ESC', gamepad: 'START' },
    confirm: { keyboard: 'ENTER', gamepad: 'A' },
    back: { keyboard: 'ESC', gamepad: 'B' },
    nav: { keyboard: '↑ ↓', gamepad: 'D-PAD' },
  };
  const glyph = (a) => (GLYPH[a] || {})[I.device] || null;

  function key(ctx, label, x, y, draw = true) {
    const round = I.device === 'gamepad' && label.length === 1;
    const h = 22;
    const w = round ? h : Math.max(h, G.measure(ctx, label, 12, 700) + 14);
    if (!draw) return w;
    ctx.save();
    if (round) {
      ctx.beginPath();
      ctx.arc(x + w / 2, y, h / 2, 0, TAU);
    } else {
      ctx.beginPath();
      ctx.rect(x, y - h / 2, w, h);
    }
    ctx.fillStyle = 'rgba(30,24,16,0.85)';
    ctx.fill();
    ctx.strokeStyle = COL.brass;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    G.text(ctx, label, x + w / 2, y + 1, 12, COL.parch, 'center', 700);
    return w;
  }
  function prompt(ctx, a, label, x, y, align = 'left') {
    const gl = glyph(a);
    if (!gl) return 0;
    const kw = key(ctx, gl, 0, 0, false);
    const tw = kw + 8 + G.measure(ctx, label, 16, 600);
    const x0 = align === 'right' ? x - tw : align === 'center' ? x - tw / 2 : x;
    key(ctx, gl, x0, y);
    G.text(ctx, label, x0 + kw + 8, y + 1, 16, COL.mute, 'left', 600);
    return tw;
  }
  function footer(ctx, list, y = C.H - 22) {
    if (I.device === 'touch') return;
    let x = C.W - 24;
    for (const [a, l] of list) {
      const w = prompt(ctx, a, l, x, y, 'right');
      if (w) x -= w + 22;
    }
  }

  function flame(ctx, x, y, s, t) {
    const h = s * (1 + Math.sin(t * 13) * 0.12 + Math.sin(t * 29) * 0.06);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(x, y, 0, x, y, s * 2.2);
    gr.addColorStop(0, 'rgba(255,170,70,0.45)');
    gr.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - s * 2.2, y - s * 2.2, s * 4.4, s * 4.4);
    ctx.restore();
    ctx.fillStyle = COL.flame;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.quadraticCurveTo(x + s * 0.7, y, x, y + s * 0.5);
    ctx.quadraticCurveTo(x - s * 0.7, y, x, y - h);
    ctx.fill();
    ctx.fillStyle = COL.flameHot;
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.5);
    ctx.quadraticCurveTo(x + s * 0.35, y + s * 0.1, x, y + s * 0.4);
    ctx.quadraticCurveTo(x - s * 0.35, y + s * 0.1, x, y - h * 0.5);
    ctx.fill();
  }
  LL.flameIcon = flame;

  const hl = { key: '', y: 0 };
  function list(ctx, g, items, x, y, w) {
    const k0 = g.state + items.length + x;
    const target = y + g.focus * ROW;
    if (hl.key !== k0) {
      hl.key = k0;
      hl.y = target;
    } else hl.y += (target - hl.y) * 0.25;
    items.forEach((it, i) => {
      const k = enter(g, 0.08 + i * 0.05, 0.4);
      const ry = y + i * ROW;
      const f = i === g.focus;
      ctx.save();
      ctx.globalAlpha *= k;
      const col = f ? (g.pulse > 0 ? COL.flameHot : COL.flame) : COL.parchDim;
      G.text(ctx, it.label, x + 30 + (f ? 6 : 0), ry + ROW / 2, f ? 22 : 20, col, 'left', 700, f ? { glow: 'rgba(255,150,60,0.55)', blur: 14 } : {});
      if (it.sub) G.text(ctx, it.sub, x + w, ry + ROW / 2 + 1, 15, COL.faint, 'right', 600, { maxWidth: w * 0.45 });
      if (it.slider) {
        const v = it.slider();
        const bx = x + w - 150;
        for (let s = 0; s < 10; s++) {
          ctx.fillStyle = s < v ? (f ? COL.flame : COL.brassDark) : 'rgba(255,255,255,0.07)';
          ctx.fillRect(bx + s * 13, ry + ROW / 2 - 6 + (s < v ? 0 : 3), 9, s < v ? 12 : 6);
        }
        G.text(ctx, String(v), x + w, ry + ROW / 2 + 1, 16, COL.parch, 'right', 700);
        g.buttons.push({ x: bx - 30, y: ry, w: 60, h: ROW, focus: i, action: () => it.adjust(-1) });
        g.buttons.push({ x: bx + 70, y: ry, w: 90, h: ROW, focus: i, action: () => it.adjust(1) });
      } else if (it.toggle) {
        const on = it.toggle();
        G.text(ctx, on ? 'lit' : 'dark', x + w, ry + ROW / 2 + 1, 17, on ? COL.flame : COL.faint, 'right', 700);
      }
      ctx.restore();
      g.buttons.push({ x, y: ry, w, h: ROW, focus: i, action: () => g.activate(it) });
    });
    if (items[g.focus]) {
      ctx.save();
      ctx.globalAlpha *= enter(g, 0.1);
      flame(ctx, x + 14, hl.y + ROW / 2 + 3, 7, g.time);
      ctx.strokeStyle = 'rgba(199,154,79,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 36, hl.y + ROW - 4);
      ctx.lineTo(x + 36 + (w - 36) * U.easeOut(U.clamp01(g.stateT * 3)), hl.y + ROW - 4);
      ctx.stroke();
      ctx.restore();
    }
  }

  function dim(ctx, a) {
    ctx.fillStyle = `rgba(3,3,8,${a})`;
    ctx.fillRect(0, 0, C.W, C.H);
  }
  function panelIn(ctx, g, x, y, w, h, fn) {
    const k = enter(g, 0, 0.3);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 16);
    G.frame(ctx, x, y, w, h);
    fn();
    ctx.restore();
  }
  function closeButton(ctx, g, x, y) {
    G.text(ctx, '✕', x, y, 20, COL.mute, 'center', 700);
    g.buttons.push({ x: x - 22, y: y - 22, w: 44, h: 44, action: () => g.close() });
  }

  const UI = {
    title(ctx, g) {
      const k = enter(g, 0, 1.2);
      ctx.save();
      ctx.globalAlpha = k;
      const flick = g.settings.flicker ? 0.85 + Math.sin(g.time * 7) * 0.08 + Math.sin(g.time * 17) * 0.05 : 1;
      G.text(ctx, 'LAST', 72, 104, 30, `rgba(191,166,122,${flick})`, 'left', 700, { display: true, spacing: 12 });
      G.text(ctx, 'Lantern', 66, 156, 64, COL.flame, 'left', 700, { display: true, glow: `rgba(255,140,40,${0.6 * flick})`, blur: 26 });
      G.text(ctx, 'Keep the flame. Relight the beacons.', 74, 206, 20, COL.parchDim, 'left', 600);
      ctx.restore();
      list(ctx, g, g.menu().items, 50, 240, 380);
      const wins = LL.Save.get('wins', 0);
      if (wins) G.text(ctx, 'Dawns brought back: ' + wins, 74, C.H - 24, 16, COL.faint, 'left', 600);
      footer(ctx, [['confirm', 'Choose'], ['nav', 'Move']]);
    },

    paused(ctx, g) {
      dim(ctx, 0.6 * enter(g, 0, 0.2));
      const items = g.menu().items;
      const w = 440;
      const h = 100 + items.length * ROW;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2;
      panelIn(ctx, g, x, y, w, h, () => {
        G.text(ctx, 'The flame waits', x + 30, y + 42, 26, COL.flame, 'left', 700, { display: true });
      });
      list(ctx, g, items, x + 20, y + 70, w - 50);
      footer(ctx, [['back', 'Return'], ['nav', 'Move']]);
    },

    settings(ctx, g) {
      dim(ctx, 0.65 * enter(g, 0, 0.2));
      const items = g.menu().items;
      const w = 520;
      const h = 100 + items.length * ROW;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2;
      panelIn(ctx, g, x, y, w, h, () => G.text(ctx, 'Settings', x + 30, y + 42, 26, COL.flame, 'left', 700, { display: true }));
      list(ctx, g, items, x + 20, y + 70, w - 50);
      footer(ctx, [['back', 'Back']]);
    },

    help(ctx, g) {
      dim(ctx, 0.7 * enter(g, 0, 0.2));
      const w = 780;
      const h = 440;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2;
      panelIn(ctx, g, x, y, w, h, () => {
        G.text(ctx, 'How to keep the flame', x + 30, y + 42, 26, COL.flame, 'left', 700, { display: true });
        closeButton(ctx, g, x + w - 30, y + 34);
        const cols = [x + 34, x + 230, x + 410, x + 570];
        ['', 'KEYBOARD', 'GAMEPAD', 'TOUCH'].forEach((s, i) => G.text(ctx, s, cols[i], y + 84, 13, COL.brass, 'left', 700, { spacing: 2 }));
        const rows = [
          ['Walk', 'WASD or arrows', 'Left stick', 'Drag on the left'],
          ['Swing / use', 'Space or F', 'A', 'SWING'],
          ['Change flame', 'G or Shift', 'B', 'FLAME'],
          ['Cave map', 'M or Tab', 'Y', 'MAP'],
          ['Satchel', 'I', 'X', 'Pause menu'],
          ['Pause', 'Esc or P', 'Start', 'Top-right'],
        ];
        rows.forEach((r, i) => r.forEach((s, j) => G.text(ctx, s, cols[j], y + 114 + i * 27, 18, j ? COL.mute : COL.parch, 'left', j ? 600 : 700)));
        ctx.fillStyle = 'rgba(199,154,79,0.35)';
        ctx.fillRect(x + 34, y + 286, w - 68, 1);
        [
          'Oil is your light, your health and your coin. Watch the vial.',
          'Swing at a beacon to light it (30 oil), or at a shrine to buy its gift.',
          'Near a lit beacon your lamp rests and refills. Every beacon saves the run.',
          'A bright flame shows more and scares the gloom, but burns fast and draws more of it.',
        ].forEach((s, i) => {
          flame(ctx, x + 42, y + 314 + i * 28, 4, g.time + i);
          G.text(ctx, s, x + 58, y + 312 + i * 28, 18, COL.parch, 'left', 600);
        });
      });
      footer(ctx, [['back', 'Back']]);
    },

    journal(ctx, g) {
      dim(ctx, 0.75 * enter(g, 0, 0.2));
      const x = 40;
      const y = 40;
      const w = 880;
      const h = 460;
      const J = LL.JOURNAL;
      panelIn(ctx, g, x, y, w, h, () => {
        G.text(ctx, 'Keeper’s Journal', x + 30, y + 40, 24, COL.flame, 'left', 700, { display: true });
        closeButton(ctx, g, x + w - 30, y + 34);
        J.forEach((e, i) => {
          const ry = y + 80 + i * 40;
          const on = i === g.journalSel;
          const known = !e.seen || g.stats[e.seen];
          if (on) {
            ctx.fillStyle = 'rgba(255,179,71,0.1)';
            ctx.fillRect(x + 20, ry - 4, 250, 34);
            flame(ctx, x + 36, ry + 15, 5, g.time);
          }
          G.text(ctx, known ? e.name : '? ? ?', x + 54, ry + 13, 19, on ? COL.flame : known ? COL.parchDim : COL.faint, 'left', 700);
          g.buttons.push({ x: x + 20, y: ry - 4, w: 250, h: 34, action: () => { if (g.journalSel !== i) { g.journalSel = i; g.journalT = 0; LL.Audio.play('page'); } } });
        });
        // the page
        const px = x + 290;
        const py = y + 70;
        const pw = w - 320;
        const ph = h - 100;
        const gr = ctx.createLinearGradient(px, py, px + pw, py + ph);
        gr.addColorStop(0, '#e9d6ad');
        gr.addColorStop(1, '#cbb183');
        ctx.fillStyle = gr;
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeStyle = 'rgba(80,50,20,0.5)';
        ctx.strokeRect(px + 6, py + 6, pw - 12, ph - 12);
        g.journalT = (g.journalT || 0) + 1 / 60;
        const e = J[g.journalSel];
        const known = !e.seen || g.stats[e.seen];
        const k = U.easeOut(U.clamp01(g.journalT * 3));
        ctx.save();
        ctx.globalAlpha *= k;
        // illustration on a dark plate with a lantern glow
        const ix = px + 30;
        const iy = py + 30;
        ctx.fillStyle = '#0b0a10';
        ctx.fillRect(ix, iy, 200, 170);
        const glow = ctx.createRadialGradient(ix + 100, iy + 100, 4, ix + 100, iy + 100, 120);
        glow.addColorStop(0, 'rgba(255,170,80,0.35)');
        glow.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(ix, iy, 200, 170);
        ctx.strokeStyle = COL.brassDark;
        ctx.lineWidth = 3;
        ctx.strokeRect(ix, iy, 200, 170);
        ctx.save();
        ctx.beginPath();
        ctx.rect(ix, iy, 200, 170);
        ctx.clip();
        if (known) this.illustrate(ctx, e.id, ix + 100, iy + 110, g.time);
        else G.text(ctx, '?', ix + 100, iy + 85, 70, '#3a3224', 'center', 700, { display: true });
        ctx.restore();
        G.text(ctx, known ? e.name : 'Not yet met', ix + 230, iy + 22, 26, '#3a2410', 'left', 700, { display: true });
        const lines = G.wrap(ctx, known ? e.text : 'Something moves out there that you have not met. Keep walking, and keep the flame high.', pw - 300, 19, 600);
        lines.forEach((l, i) => G.text(ctx, l, ix + 230, iy + 62 + i * 25, 19, '#3a2a18', 'left', 600));
        if (known && e.id === 'flame') {
          W.LIGHT.forEach((L, i) => {
            const ry = py + 250 + i * 30;
            G.text(ctx, L.name, px + 40, ry, 19, '#3a2410', 'left', 700);
            G.text(ctx, 'reach ' + L.r + '  ·  burns ' + L.burn + '/s  ·  draws ' + L.lure + '×', px + 130, ry, 18, '#4a3420', 'left', 600);
          });
        }
        ctx.restore();
      });
      footer(ctx, [['back', 'Close'], ['nav', 'Turn']]);
    },

    illustrate(ctx, id, x, y, t) {
      const fake = { face: 0.3, walk: t * 4, moving: 0.4 };
      if (id === 'keeper') {
        ctx.save();
        ctx.translate(x, y + 10);
        ctx.scale(2.6, 2.6);
        R.keeper(ctx, 0, 0, fake, t, 1);
        R.lantern(ctx, 0, 0, fake, t, 1, true);
        ctx.restore();
      } else if (id === 'oil' || id === 'jar') {
        ctx.fillStyle = '#a8673a';
        ctx.beginPath();
        ctx.ellipse(x, y - 10, 30, 34, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#7a4524';
        ctx.fillRect(x - 12, y - 56, 24, 14);
        ctx.fillStyle = 'rgba(255,220,160,0.35)';
        ctx.fillRect(x - 18, y - 30, 7, 30);
        if (id === 'oil') for (let i = 0; i < 3; i++) flame(ctx, x - 50 + i * 50, y - 80, 6, t + i);
      } else if (id === 'flame') {
        [6, 11, 17].forEach((s, i) => flame(ctx, x - 60 + i * 60, y - 20, s, t + i));
      } else if (id === 'gloom' || id === 'murk') {
        const f = { big: id === 'murk', flash: 0, ph: 1, flinch: Math.max(0, Math.sin(t)) * 0.8 };
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(id === 'murk' ? 2.4 : 3.2, id === 'murk' ? 2.4 : 3.2);
        R.gloom(ctx, 0, 0, f, t);
        R.eyes(ctx, 0, 0, f, t, 0);
        ctx.restore();
      } else if (id === 'beacon') {
        ctx.fillStyle = '#5a503e';
        ctx.fillRect(x - 26, y - 20, 52, 40);
        ctx.fillStyle = '#2b2419';
        ctx.beginPath();
        ctx.ellipse(x, y - 24, 32, 10, 0, 0, TAU);
        ctx.fill();
        for (let i = 0; i < 4; i++) {
          const h = 40 + i * 8 + Math.sin(t * 11 + i * 2) * 6;
          ctx.fillStyle = ['#ff6a2b', '#ffb347', '#ffe08a', '#fff6d0'][i];
          ctx.beginPath();
          ctx.moveTo(x - 26 + i * 6, y - 26);
          ctx.quadraticCurveTo(x - 12, y - 26 - h * 0.6, x + Math.sin(t * 7 + i) * 4, y - 26 - h);
          ctx.quadraticCurveTo(x + 12, y - 26 - h * 0.6, x + 26 - i * 6, y - 26);
          ctx.fill();
        }
      } else if (id === 'shrine') {
        ctx.fillStyle = '#5b5560';
        ctx.beginPath();
        ctx.moveTo(x - 24, y + 20);
        ctx.lineTo(x - 18, y - 60);
        ctx.lineTo(x, y - 74);
        ctx.lineTo(x + 18, y - 60);
        ctx.lineTo(x + 24, y + 20);
        ctx.closePath();
        ctx.fill();
        G.sigil(ctx, x, y - 30, 12, `rgba(95,242,216,${0.6 + Math.sin(t * 2.5) * 0.3})`);
      } else if (id === 'glowcap') {
        for (let k = 0; k < 5; k++) {
          const mx = x - 40 + k * 20;
          const my = y + (k % 2) * 10;
          ctx.fillStyle = '#d9fff6';
          ctx.fillRect(mx - 2, my - 14, 4, 16);
          ctx.fillStyle = '#5ff2d8';
          ctx.beginPath();
          ctx.ellipse(mx, my - 15, 11, 7, 0, Math.PI, 0);
          ctx.fill();
        }
        for (let k = -1; k <= 1; k++) {
          ctx.fillStyle = k ? '#6d5bc4' : '#9d8df1';
          ctx.beginPath();
          ctx.moveTo(x + 60 + k * 14 - 6, y - 40);
          ctx.lineTo(x + 60 + k * 14, y - 80 - (k ? 0 : 14));
          ctx.lineTo(x + 60 + k * 14 + 6, y - 40);
          ctx.fill();
        }
      }
    },

    map(ctx, g) {
      const r = g.run;
      dim(ctx, 0.8 * enter(g, 0, 0.2));
      const s = 11;
      const w = W.MW * s;
      const h = W.MH * s;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2 + 6;
      panelIn(ctx, g, x - 14, y - 34, w + 28, h + 48, () => {
        G.text(ctx, 'The cave, as far as your light has reached', x, y - 16, 16, COL.brass, 'left', 700);
        closeButton(ctx, g, x + w - 6, y - 16);
        ctx.fillStyle = '#0a0907';
        ctx.fillRect(x, y, w, h);
        R.map(ctx, r, x, y, s, g.time, true);
        G.text(ctx, Math.round((r.exploredN / (W.MW * W.MH)) * 100) + '% seen', x + w - 8, y + h - 12, 15, COL.mute, 'right', 600);
      });
      footer(ctx, [['back', 'Close']]);
    },

    satchel(ctx, g) {
      const r = g.run;
      const p = r.p;
      dim(ctx, 0.75 * enter(g, 0, 0.2));
      const w = 700;
      const h = 420;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2;
      panelIn(ctx, g, x, y, w, h, () => {
        G.text(ctx, 'Satchel', x + 30, y + 42, 26, COL.flame, 'left', 700, { display: true });
        closeButton(ctx, g, x + w - 30, y + 34);
        // the lamp's oil vial
        UI.vial(ctx, x + 70, y + 90, 46, 250, p.oil / g.maxOil(), g.time);
        G.text(ctx, Math.ceil(p.oil) + ' / ' + g.maxOil(), x + 93, y + 360, 18, COL.parch, 'center', 700);
        G.text(ctx, W.LIGHT[r.light].name + ' flame', x + 93, y + 384, 16, COL.mute, 'center', 600);
        const cx = x + 190;
        G.text(ctx, 'GIFTS OF THE SHRINES', cx, y + 86, 13, COL.brass, 'left', 700, { spacing: 2 });
        W.UPGRADES.forEach((u, i) => {
          const own = r.owned.has(u.id);
          const ry = y + 116 + i * 30;
          G.sigil(ctx, cx + 8, ry, 7, own ? COL.glow : 'rgba(255,255,255,0.15)');
          G.text(ctx, u.name, cx + 24, ry + 1, 19, own ? COL.parch : COL.faint, 'left', 700);
          G.text(ctx, own ? u.desc : u.cost + ' oil at its shrine', cx + 190, ry + 1, 16, own ? COL.mute : COL.faint, 'left', 600);
        });
        G.text(ctx, 'BEACONS', cx, y + 216, 13, COL.brass, 'left', 700, { spacing: 2 });
        r.w.beacons.forEach((b, i) => {
          const ry = y + 246 + (i % 2) * 28;
          const bx = cx + Math.floor(i / 2) * 230;
          G.sigil(ctx, bx + 8, ry, 8, b.lit ? COL.flame : 'rgba(255,255,255,0.15)');
          G.text(ctx, b.name, bx + 24, ry + 1, 18, b.lit ? COL.parch : COL.faint, 'left', 700);
        });
        G.text(ctx, 'THIS CAVE', cx, y + 326, 13, COL.brass, 'left', 700, { spacing: 2 });
        const mins = Math.floor(r.t / 60);
        const secs = Math.floor(r.t % 60);
        const line = Math.round((r.exploredN / (W.MW * W.MH)) * 100) + '% seen  ·  ' + r.banished + ' gloom banished  ·  ' + r.jars + ' jars  ·  ' + mins + ':' + String(secs).padStart(2, '0');
        G.text(ctx, line, cx, y + 356, 17, COL.mute, 'left', 600);
      });
      footer(ctx, [['back', 'Close']]);
    },

    vial(ctx, x, y, w, h, frac, t) {
      ctx.save();
      ctx.fillStyle = '#0e0c09';
      ctx.fillRect(x, y, w, h);
      const lvl = y + h * (1 - U.clamp01(frac));
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      for (let i = 0; i <= 10; i++) ctx.lineTo(x + (i / 10) * w, lvl + Math.sin(t * 3 + i) * 1.5);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      const gr = ctx.createLinearGradient(0, lvl, 0, y + h);
      gr.addColorStop(0, frac > 0.3 ? '#ffc65c' : '#ff6a4d');
      gr.addColorStop(1, frac > 0.3 ? '#a8561c' : '#7a1d10');
      ctx.fillStyle = gr;
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 4, y + 4, 4, h - 8);
      ctx.strokeStyle = COL.brass;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      for (let i = 1; i < 4; i++) {
        ctx.fillStyle = 'rgba(199,154,79,0.6)';
        ctx.fillRect(x + w - 8, y + (h * i) / 4, 8, 1);
      }
      ctx.restore();
    },

    hud(ctx, g) {
      const r = g.run;
      const p = r.p;
      const t = g.time;
      // oil vial and flame level, top left
      G.frame(ctx, 12, 12, 210, 70);
      const frac = p.oil / g.maxOil();
      ctx.save();
      ctx.translate(26, 47);
      ctx.rotate(-Math.PI / 2);
      ctx.restore();
      // horizontal glass gauge
      ctx.fillStyle = '#0e0c09';
      ctx.fillRect(26, 26, 182, 18);
      const lw = 182 * U.clamp01(frac);
      const gr = ctx.createLinearGradient(0, 26, 0, 44);
      gr.addColorStop(0, frac > 0.3 ? '#ffd07a' : '#ff7a5a');
      gr.addColorStop(1, frac > 0.3 ? '#b8661e' : '#8a2414');
      ctx.fillStyle = gr;
      ctx.fillRect(26, 26, lw, 18);
      if (frac < 0.3 && Math.sin(t * 8) > 0) {
        ctx.fillStyle = 'rgba(255,80,60,0.25)';
        ctx.fillRect(26, 26, 182, 18);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(26, 28, lw, 3);
      ctx.strokeStyle = COL.brass;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(26, 26, 182, 18);
      G.text(ctx, Math.ceil(Math.max(0, p.oil)) + ' oil', 30, 63, 17, COL.parch, 'left', 700);
      for (let i = 0; i < 3; i++) {
        const on = i <= r.light;
        if (on) flame(ctx, 150 + i * 22, 64, 5 + i, t + i);
        else {
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.beginPath();
          ctx.arc(150 + i * 22, 64, 3, 0, TAU);
          ctx.fill();
        }
      }
      // beacons, top centre
      r.w.beacons.forEach((b, i) => {
        const bx = C.W / 2 - 54 + i * 36;
        if (b.lit) {
          const gl = ctx.createRadialGradient(bx, 30, 0, bx, 30, 18);
          gl.addColorStop(0, 'rgba(255,170,70,0.5)');
          gl.addColorStop(1, 'rgba(255,170,70,0)');
          ctx.fillStyle = gl;
          ctx.fillRect(bx - 18, 12, 36, 36);
        }
        G.sigil(ctx, bx, 30, b.lit ? 11 : 9, b.lit ? COL.flame : 'rgba(191,166,122,0.35)');
      });
      // corner map
      if (g.settings.minimap) {
        const s = 3;
        const mx = C.W - W.MW * s - 18;
        const my = 74;
        ctx.fillStyle = 'rgba(8,7,5,0.75)';
        ctx.fillRect(mx - 4, my - 4, W.MW * s + 8, W.MH * s + 8);
        ctx.strokeStyle = COL.brassDark;
        ctx.lineWidth = 2;
        ctx.strokeRect(mx - 4, my - 4, W.MW * s + 8, W.MH * s + 8);
        R.map(ctx, r, mx, my, s, t, false);
        g.buttons.push({ x: mx - 4, y: my - 4, w: W.MW * s + 8, h: W.MH * s + 8, action: () => g.open('map') });
      }
      // pause button
      const px = C.W - 36;
      ctx.beginPath();
      ctx.arc(px, 36, 20, 0, TAU);
      ctx.fillStyle = 'rgba(20,16,12,0.8)';
      ctx.fill();
      ctx.strokeStyle = COL.brass;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = COL.parch;
      ctx.fillRect(px - 7, 28, 4, 16);
      ctx.fillRect(px + 3, 28, 4, 16);
      g.buttons.push({ x: px - 30, y: 6, w: 60, h: 60, action: () => g.pause() });
      // a hint near a beacon or shrine
      if (g.settings.hints) {
        const near =
          r.w.beacons.filter((b) => !b.lit && Math.hypot(b.x - p.x, b.y - p.y) < 1.6).map((b) => 'Light ' + b.name + ' (' + W.BEACON_COST + ' oil)')[0] ||
          r.w.shrines.filter((s) => !r.owned.has(s.up.id) && Math.hypot(s.x - p.x, s.y - p.y) < 1.4).map((s) => s.up.name + ': ' + s.up.desc.toLowerCase() + ' (' + s.up.cost + ' oil)')[0];
        if (near) {
          const gl = glyph('swing');
          const tw = G.measure(ctx, near, 19, 700) + (gl ? key(ctx, gl, 0, 0, false) + 16 : 0) + 40;
          const hx = (C.W - tw) / 2;
          const hy = C.H - 120;
          ctx.fillStyle = 'rgba(12,10,8,0.85)';
          ctx.fillRect(hx, hy - 18, tw, 36);
          ctx.strokeStyle = 'rgba(199,154,79,0.6)';
          ctx.strokeRect(hx + 0.5, hy - 17.5, tw - 1, 35);
          let tx = hx + 20;
          if (gl) tx += key(ctx, gl, tx, hy) + 12;
          else if (I.device === 'touch') {
            /* the SWING button does it */
          }
          G.text(ctx, near, tx, hy + 1, 19, COL.flame, 'left', 700);
        }
      }
      if (I.device !== 'touch') footer(ctx, [['pause', 'Pause'], ['map', 'Map'], ['satchel', 'Satchel'], ['flame', 'Flame']]);
    },

    touch(ctx, g) {
      if (!I.touchOn) return;
      ctx.save();
      const st = I.stick;
      const sx = st ? st.ox : 130;
      const sy = st ? st.oy : C.H - 110;
      ctx.globalAlpha = st ? 0.9 : 0.45;
      ctx.strokeStyle = COL.brass;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, I.R, 0, TAU);
      ctx.stroke();
      let kx = sx;
      let ky = sy;
      if (st) {
        const dx = st.x - st.ox;
        const dy = st.y - st.oy;
        const d = Math.hypot(dx, dy) || 1;
        kx += (dx / d) * Math.min(d, I.R);
        ky += (dy / d) * Math.min(d, I.R);
      }
      ctx.fillStyle = 'rgba(255,179,71,0.35)';
      ctx.beginPath();
      ctx.arc(kx, ky, 18, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      for (const b of Object.values(I.TOUCH)) {
        const down = I.down.has(b.code);
        ctx.globalAlpha = down ? 0.95 : 0.6;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * (down ? 0.94 : 1), 0, TAU);
        ctx.fillStyle = 'rgba(20,16,12,0.75)';
        ctx.fill();
        ctx.strokeStyle = COL.brass;
        ctx.lineWidth = 2;
        ctx.stroke();
        G.text(ctx, b.label, b.x, b.y + 1, b.r > 40 ? 17 : 13, COL.flame, 'center', 700);
      }
      ctx.restore();
    },

    over(ctx, g) {
      const res = g.result;
      const a = U.clamp01(res.t / 1.2);
      if (res.won) {
        // dawn spills in from the top
        const gr = ctx.createLinearGradient(0, 0, 0, C.H);
        gr.addColorStop(0, `rgba(255,190,120,${0.75 * a})`);
        gr.addColorStop(0.5, `rgba(255,140,90,${0.4 * a})`);
        gr.addColorStop(1, `rgba(40,20,40,${0.7 * a})`);
        ctx.fillStyle = gr;
        ctx.fillRect(0, 0, C.W, C.H);
      } else dim(ctx, 0.85 * a);
      ctx.save();
      ctx.globalAlpha = a;
      G.text(ctx, res.won ? 'The dawn returns' : 'The flame went out', C.W / 2, 110, 46, res.won ? '#fff1d0' : COL.mute, 'center', 700, { display: true, glow: res.won ? 'rgba(255,200,120,0.8)' : null, blur: 24 });
      G.text(ctx, res.won ? 'Four beacons burn. The cave breathes again.' : 'The cave keeps its dark a while longer. Another waits.', C.W / 2, 160, 21, COL.parch, 'center', 600);
      ctx.fillStyle = 'rgba(8,6,4,0.62)';
      ctx.fillRect(C.W / 2 - 220, 188, 440, 312);
      ctx.strokeStyle = 'rgba(199,154,79,0.45)';
      ctx.strokeRect(C.W / 2 - 220.5, 188.5, 440, 312);
      const rows = [
        ['Beacons lit', res.lit + ' / 4'],
        ['Shrine gifts', res.owned + ' / 3'],
        ['Cave seen', Math.round((res.explored / (W.MW * W.MH)) * 100) + '%'],
        ['Gloom banished', res.banished],
        ['Time', Math.floor(res.time / 60) + ':' + String(Math.floor(res.time % 60)).padStart(2, '0')],
      ];
      rows.forEach(([k, v], i) => {
        const kk = U.clamp01((res.t - 0.4 - i * 0.12) / 0.3);
        ctx.globalAlpha = a * kk;
        G.text(ctx, k, C.W / 2 - 20, 214 + i * 30, 19, COL.parchDim, 'right', 600);
        G.text(ctx, String(v), C.W / 2 + 20, 214 + i * 30, 20, COL.flame, 'left', 700);
      });
      ctx.restore();
      if (res.t > 1.4) list(ctx, g, g.menu().items, C.W / 2 - 160, 380, 320);
    },

    toast(ctx, g) {
      const m = g.toastMsg;
      if (!m) return;
      const k = U.clamp01(m.life / 0.4) * U.clamp01((m.max - m.life) / 0.25);
      ctx.save();
      ctx.globalAlpha = k;
      const y = g.state === 'play' ? 120 : 30;
      G.text(ctx, m.s, C.W / 2, y, 21, COL.flameHot, 'center', 700, { glow: 'rgba(0,0,0,0.9)', blur: 8 });
      ctx.restore();
    },
  };
  LL.UI = UI;
})();
