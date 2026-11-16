// Bonk Brawl screens in a 1000x620 design space: slanted comic panels with
// thick ink borders, halftone fills, speech-burst buttons and shouty
// lettering. Buttons go on G.buttons each frame so mouse, touch, keyboard and
// gamepads all drive the same menus.
(function () {
  const R = BB.Render, I = BB.Input, TAU = Math.PI * 2;
  const DISPLAY = R.DISPLAY, BODY = R.BODY, INK = R.INK;
  const DW = 1000, DH = 620;
  const YEL = '#ffd233', RED = '#ff3d3d', CREAM = '#fff8e1';
  const clamp = BB.clamp, ease = BB.easeOut, back = BB.easeBack;
  let s = 1, ox = 0, oy = 0, lastMouse = '';

  function layout() { s = Math.min(R.W / DW, R.H / DH); ox = (R.W - DW * s) / 2; oy = (R.H - DH * s) / 2; }
  function begin(g) { g.setTransform(R.dpr * s, 0, 0, R.dpr * s, R.dpr * ox, R.dpr * oy); }
  const enter = (G, d, dur) => ease(((G.t || 0) - (d || 0)) / (dur || 0.3));

  function txt(g, str, x, y, size, color, align, font, weight) {
    g.font = (weight || 600) + ' ' + Math.round(size) + 'px ' + (font || BODY);
    g.textAlign = align || 'left'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(str, x, y);
  }
  function shout(g, str, x, y, size, color, align, rot) {
    g.save(); g.translate(x, y); g.rotate(rot || 0);
    g.font = Math.round(size) + 'px ' + DISPLAY; g.textAlign = align || 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.fillStyle = INK; g.fillText(str, size * 0.05, size * 0.07);
    g.strokeStyle = INK; g.lineWidth = Math.max(3, size * 0.13); g.strokeText(str, 0, 0);
    g.fillStyle = color; g.fillText(str, 0, 0);
    g.restore();
  }
  function width(g, str, size, font, weight) { g.font = (weight || 600) + ' ' + Math.round(size) + 'px ' + (font || BODY); return g.measureText(str).width; }
  // A comic panel: slanted parallelogram, solid ink drop shadow, optional halftone.
  function panel(g, x, y, w, h, o) {
    o = o || {};
    const sk = o.skew === undefined ? 10 : o.skew;
    const path = (dx, dy) => { g.beginPath(); g.moveTo(x + sk + dx, y + dy); g.lineTo(x + w + dx, y + dy); g.lineTo(x + w - sk + dx, y + h + dy); g.lineTo(x + dx, y + h + dy); g.closePath(); };
    if (!o.noShadow) { g.fillStyle = INK; path(7, 7); g.fill(); }
    g.fillStyle = o.fill || CREAM; path(0, 0); g.fill();
    if (o.dots) { g.fillStyle = R.dots(g, o.dots, 12); path(0, 0); g.fill(); }
    if (o.fn) { g.save(); path(0, 0); g.clip(); o.fn(); g.restore(); }
    g.strokeStyle = INK; g.lineWidth = o.line || 5; g.lineJoin = 'round'; path(0, 0); g.stroke();
  }
  function burst(g, x, y, r, color, spikes, rot) {
    g.save(); g.translate(x, y); g.rotate(rot || 0);
    g.beginPath();
    for (let i = 0; i < spikes * 2; i++) { const a = (i / (spikes * 2)) * TAU, q = i % 2 ? r * 0.72 : r * (1 + (i % 4 === 0 ? 0.08 : 0)); g.lineTo(Math.cos(a) * q, Math.sin(a) * q * 0.82); }
    g.closePath(); g.fillStyle = INK; g.save(); g.translate(6, 6); g.fill(); g.restore();
    g.fillStyle = color; g.fill(); g.strokeStyle = INK; g.lineWidth = 5; g.stroke();
    g.restore();
  }
  // Key cap: white comic box. Pad buttons: coloured inked circles.
  function cap(g, label, x, y, size, o) {
    o = o || {};
    const pad = o.pad;
    const fs = label.length > 2 ? size * 0.42 : size * 0.6;
    const w = pad ? size : Math.max(size, width(g, label, fs, DISPLAY, 400) + size * 0.5);
    if (pad) {
      const col = { A: '#33c45a', B: '#ff3d3d', X: '#2f6bff', Y: '#ffd233' }[label] || '#888';
      g.fillStyle = INK; g.beginPath(); g.arc(x + w / 2 + 3, y + 3, size / 2, 0, TAU); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(x + w / 2, y, size / 2, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
      shout(g, label, x + w / 2, y + 1, fs, '#fff');
      return w;
    }
    g.fillStyle = INK; R.rr(g, x + 3, y - size / 2 + 3, w, size, 5); g.fill();
    g.fillStyle = o.fill || '#fff'; R.rr(g, x, y - size / 2, w, size, 5); g.fill();
    g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
    txt(g, label, x + w / 2, y + 1, fs, INK, 'center', DISPLAY, 400);
    return w;
  }
  const dev = () => I.last;
  function capW(g, label, size) {
    if (dev() === 'gamepad' && label.length === 1) return size;
    const fs = label.length > 2 ? size * 0.42 : size * 0.6;
    return Math.max(size, width(g, label, fs, DISPLAY, 400) + size * 0.5);
  }
  function prompts(g, list, x, y, align, color) {
    const d = dev();
    if (d === 'touch') return;
    const items = list.map(([k, p, t]) => ({ key: d === 'gamepad' ? p : k, t })).filter((it) => it.key);
    const size = 24;
    let total = 0;
    for (const it of items) total += capW(g, it.key, size) + 8 + width(g, it.t, 15, BODY, 700) + 20;
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    for (const it of items) {
      cx += cap(g, it.key, cx, y, size, { pad: d === 'gamepad' && it.key.length === 1 }) + 8;
      txt(g, it.t, cx, y + 1, 15, color || '#fff', 'left', BODY, 700);
      cx += width(g, it.t, 15, BODY, 700) + 20;
    }
  }
  const NAV = [['↑↓', '✚', 'Choose'], ['Enter', 'A', 'OK'], ['Esc', 'B', 'Back']];

  // Vertical list of caption boxes.
  function list(g, G, items, x, y, w, rowH, o) {
    o = o || {};
    items.forEach((it, i) => {
      const k = enter(G, 0.04 + i * 0.04, 0.3), f = G.focus === i;
      const cx = x + (1 - k) * 80 + (f ? 10 : 0), cy = y + i * rowH, h = rowH - 10;
      g.save(); g.globalAlpha *= clamp(k * 1.5, 0, 1);
      panel(g, cx, cy, w, h, { fill: f ? (it.danger ? RED : YEL) : '#fff', skew: 8, line: 4, noShadow: !f });
      const lc = INK;
      txt(g, it.label.toUpperCase(), cx + 24, cy + h / 2 + 2, o.size || 22, lc, 'left', DISPLAY, 400);
      if (it.value) {
        const v = it.value();
        txt(g, v, cx + w - 26, cy + h / 2 + 2, 20, v === 'NOPE' ? '#8a7f86' : v === 'YES!' ? '#1d8a3a' : INK, 'right', DISPLAY, 400);
        if (f) { txt(g, '◀', cx + w - 34 - width(g, v, 20, DISPLAY, 400), cy + h / 2, 13, INK, 'right'); txt(g, '▶', cx + w - 12, cy + h / 2, 13, INK, 'right'); }
      }
      if (it.slider) {
        const v = it.slider();
        for (let j = 0; j < 10; j++) {
          g.save(); g.translate(cx + w - 250 + j * 21, cy + h / 2);
          g.fillStyle = j < v ? RED : 'rgba(21,16,24,.15)'; g.beginPath(); R.starPath(g, 0, 0, 9, 5); g.fill();
          if (j < v) { g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); }
          g.restore();
        }
        txt(g, String(v), cx + w - 22, cy + h / 2 + 2, 20, INK, 'right', DISPLAY, 400);
      }
      if (f && !it.value && !it.slider) shout(g, '!', cx + w - 30 + Math.sin(G.time * 10) * 3, cy + h / 2 + 2, 30, RED);
      g.restore();
      if (it.slider) {
        G.buttons.push({ x: cx + w - 262, y: cy, w: 110, h, focus: i, action: () => { it.adjust(-1); G.saveNow(); } });
        G.buttons.push({ x: cx + w - 152, y: cy, w: 152, h, focus: i, action: () => { it.adjust(1); G.saveNow(); } });
        G.buttons.push({ x: cx, y: cy, w: w - 262, h, focus: i, action: () => {} });
      } else G.buttons.push({ x: cx, y: cy, w, h, focus: i, action: () => G.activate(it) });
    });
  }

  function dim(g, a, color) { g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); g.fillStyle = color || 'rgba(21,16,24,' + a + ')'; g.fillRect(0, 0, R.W, R.H); }

  // A fighter drawn inside the UI at a given size (u = world unit in px).
  function fighterPose(g, fighterIdx, x, y, u, t, pose) {
    const fake = {
      i: fighterIdx, c: BB.FIGHTERS[fighterIdx], face: pose && pose.face || 1, ground: !(pose && pose.air), vx: pose && pose.run ? 3 : 0, vy: pose && pose.air ? -3 : 0,
      stun: 0, atk: null, runT: t * 1.5, hurtT: 0, tumble: 0,
    };
    if (pose && pose.punch) { const k = (t * 1.2) % 1; fake.atk = { heavy: true, t: k * 0.55, at: 0.28, end: 0.55 }; }
    const v = pose && pose.vis || { sx: 1, sy: 1, blink: 0, flash: 0 };
    R.drawFighter(g, fake, x, y, u, { vis: v });
  }

  // ---------- title ----------
  function title(g, G) {
    R.draw(G.demo, { noTags: true });
    dim(g, 0.25);
    begin(g);
    const k = back(G.t / 0.6);
    // logo burst
    g.save(); g.translate(DW / 2, 170); g.scale(k, k); g.rotate(-0.05 + Math.sin(G.time * 1.5) * 0.015);
    burst(g, 0, 0, 260, YEL, 14, G.time * 0.05);
    shout(g, 'BONK', -10, -42, 120, RED, 'center', -0.06);
    shout(g, 'BRAWL', 18, 58, 120, '#2f6bff', 'center', -0.06);
    g.restore();
    // tagline caption box
    g.save(); g.globalAlpha = enter(G, 0.3, 0.4);
    panel(g, DW / 2 - 200, 318, 400, 40, { fill: '#fff', skew: 12, line: 4 });
    txt(g, 'Hit them until they fly.', DW / 2, 339, 20, INK, 'center', BODY, 700);
    g.restore();
    // menu: three comic panels across the bottom
    const items = G.menu(), bw = 230, gap = 26, x0 = (DW - (items.length * bw + (items.length - 1) * gap)) / 2;
    items.forEach((it, i) => {
      const f = G.focus === i, kk = back((G.t - 0.25 - i * 0.08) / 0.4);
      const x = x0 + i * (bw + gap), y = 410 + (1 - clamp(kk, 0, 1)) * 140 - (f ? 10 : 0);
      g.save(); g.translate(x + bw / 2, y + 45); g.rotate(f ? Math.sin(G.time * 6) * 0.02 : 0); g.translate(-(x + bw / 2), -(y + 45));
      panel(g, x, y, bw, 90, {
        fill: f ? (i === 0 ? RED : YEL) : '#fff', dots: f ? 'rgba(21,16,24,.12)' : 'rgba(255,61,61,.12)', skew: 14,
      });
      shout(g, it.label.toUpperCase(), x + bw / 2, y + 47, i === 0 ? 46 : 32, f ? '#fff' : INK === INK && !f ? '#fff' : '#fff', 'center', -0.04);
      g.restore();
      G.buttons.push({ x, y, w: bw, h: 90, focus: i, action: () => G.activate(it) });
    });
    const sv = G.save.stats;
    txt(g, sv.matches + ' brawls · ' + sv.kos + ' knockouts', DW - 20, DH - 18, 14, '#fff', 'right', BODY, 700);
    prompts(g, [['←→', '✚', 'Choose'], ['Enter', 'A', 'OK']], 20, DH - 20, 'left');
  }

  // ---------- character select ----------
  function statBar(g, label, v, x, y, w, color) {
    txt(g, label, x, y, 12, INK, 'left', BODY, 700);
    const bx = x + 54, bw = w - 54;
    g.fillStyle = '#fff'; R.rr(g, bx, y - 6, bw, 12, 3); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    g.fillStyle = color; R.rr(g, bx + 2, y - 4, (bw - 4) * clamp(v, 0.05, 1), 8, 2); g.fill();
  }
  function deviceKeys(g, d, x, y) {
    if (!d) return;
    if (d.kind === 'pad') {
      cap(g, 'A', x, y, 24, { pad: true }); txt(g, 'bonk', x + 28, y, 13, INK, 'left', BODY, 700);
      cap(g, 'B', x + 80, y, 24, { pad: true }); txt(g, 'big bonk', x + 108, y, 13, INK, 'left', BODY, 700);
      txt(g, 'Stick moves · up or Y jumps', x, y + 26, 12, INK, 'left', BODY, 600);
      return;
    }
    if (d.kind === 'touch') { txt(g, 'On-screen stick + BONK / BIG', x, y, 13, INK, 'left', BODY, 700); return; }
    const c = d.caps;
    let cx = x;
    cx += cap(g, c.left, cx, y, 22) + 3; cx += cap(g, c.up, cx, y, 22, { fill: '#e7f0ff' }) + 3; cx += cap(g, c.down, cx, y, 22) + 3; cx += cap(g, c.right, cx, y, 22) + 10;
    cx += cap(g, c.a, cx, y, 22, { fill: YEL }) + 3; cap(g, c.b, cx, y, 22, { fill: '#ffb3b3' });
    txt(g, 'move · ' + c.up + ' jump · ' + c.a + ' bonk · ' + c.b + ' big', x, y + 24, 11, INK, 'left', BODY, 700);
  }
  function lobby(g, G) {
    R.draw(G.demo, { noTags: true });
    dim(g, 0.55);
    begin(g);
    shout(g, 'CHOOSE YOUR BRAWLER!', DW / 2, 46, 52, YEL, 'center', -0.02);
    txt(g, 'Press your BONK key to jump in.  ◀ ▶ picks a fighter.  BONK again when ready.', DW / 2, 88, 16, '#fff', 'center', BODY, 700);
    const pw = 230, gap = 14, x0 = (DW - (pw * 4 + gap * 3)) / 2, y0 = 110, ph = 330;
    G.seats.forEach((seat, i) => {
      const k = back((G.t - 0.05 - i * 0.06) / 0.4), x = x0 + i * (pw + gap), y = y0 + (1 - clamp(k, 0, 1)) * 400;
      seatPanel(g, G, seat, i, x, y, pw, ph);
    });
    // option bar
    const by = 462;
    const bar = [
      { label: '‹ BACK', w: 110, act: () => { G.go('title'); G.sfx('back'); } },
      { label: (G.st.lives || 3) + ' LIVES', w: 130, act: () => G.cycleLives(1) },
      { label: G.stageName().toUpperCase(), w: 230, act: () => G.cycleStage(1) },
      { label: 'CPU: ' + G.SKILLS[G.skill()].toUpperCase(), w: 170, act: () => G.cycleSkill(1) },
      { label: 'FIGHT! ▶', w: 180, act: () => G.startFromLobby(), go: true },
    ];
    let bx = (DW - bar.reduce((a, b) => a + b.w, 0) - 12 * (bar.length - 1)) / 2;
    for (const b of bar) {
      const ready = b.go && G.canStart();
      panel(g, bx, by, b.w, 48, { fill: b.go ? (ready ? RED : '#ccc') : '#fff', skew: 10, line: 4 });
      if (b.go) shout(g, b.label, bx + b.w / 2, by + 26, 28, '#fff');
      else txt(g, b.label, bx + b.w / 2, by + 26, 17, INK, 'center', DISPLAY, 400);
      G.buttons.push({ x: bx, y: by, w: b.w, h: 48, action: b.act });
      bx += b.w + 12;
    }
    const help = dev() === 'gamepad'
      ? [['', 'Y', 'Add CPU'], ['', 'X', 'Remove'], ['', 'RB', 'Lives'], ['', 'SELECT', 'Stage'], ['', 'START', 'Fight'], ['', 'B', 'Back']]
      : [['C', '', 'Add CPU'], ['X', '', 'Remove'], ['L', '', 'Lives'], ['T', '', 'Stage'], ['V', '', 'CPU skill'], ['Space', '', 'Fight'], ['Esc', '', 'Back']];
    prompts(g, help, DW / 2, 548, 'center');
    if (G.lobbyGo > 0) {
      g.save(); g.translate(DW / 2, 290); const p = 1 + (G.lobbyGo % 0.6) * 0.5; g.scale(p, p);
      burst(g, 0, 0, 120, YEL, 12, G.time);
      shout(g, 'GET READY!', 0, 0, 44, RED, 'center', -0.08);
      g.restore();
    }
  }
  function seatPanel(g, G, seat, i, x, y, w, h) {
    const slot = BB.SLOTS[i];
    if (seat.kind === 'empty') {
      panel(g, x, y, w, h, {
        fill: 'rgba(255,248,225,.92)', dots: 'rgba(21,16,24,.08)',
        fn: () => {
          shout(g, slot.name, x + w / 2, y + 40, 40, slot.color);
          txt(g, 'press your BONK key', x + w / 2, y + 76, 14, INK, 'center', BODY, 700);
          [['F', 'W A S D'], ['Enter', 'Arrow keys'], ['O', 'I J K L'], ['0', 'Number pad']].forEach(([k2, lab], r) => {
            const ry = y + 108 + r * 34;
            cap(g, k2, x + 30, ry, 26, { fill: YEL });
            txt(g, lab, x + 96, ry + 1, 15, INK, 'left', BODY, 700);
          });
          const anyPad = I.devices.some((d) => d.kind === 'pad' && d.connected);
          cap(g, 'A', x + 30, y + 246, 26, { pad: true });
          txt(g, anyPad ? 'any gamepad' : 'gamepad (plug in)', x + 66, y + 247, 15, anyPad ? INK : '#8a7f86', 'left', BODY, 700);
        },
      });
      const bx = x + 22, bw = w - 44, by = y + h - 60;
      panel(g, bx, by, bw, 26, { fill: '#fff', skew: 6, line: 3, noShadow: true });
      txt(g, '+ COMPUTER', bx + bw / 2, by + 14, 15, INK, 'center', DISPLAY, 400);
      G.buttons.push({ x: bx, y: by, w: bw, h: 26, action: () => G.addCpu(seat) });
      if (I.hasTouch() || dev() === 'touch') {
        panel(g, bx, by + 30, bw, 26, { fill: YEL, skew: 6, line: 3, noShadow: true });
        txt(g, 'TAP TO JOIN', bx + bw / 2, by + 44, 15, INK, 'center', DISPLAY, 400);
        G.buttons.push({ x: bx, y: by + 30, w: bw, h: 26, action: () => G.joinTouch() });
      }
      return;
    }
    const F = BB.FIGHTERS[seat.fighter], human = seat.kind === 'human', d = human ? I.byId[seat.dev] : null;
    const pick = back((G.time - (seat.pickT || seat.joinT || 0)) / 0.35);
    panel(g, x, y, w, h, {
      fill: slot.color, dots: 'rgba(255,255,255,.25)',
      fn: () => {
        // speed lines behind the fighter
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.beginPath();
        for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU + G.time * 0.3; g.moveTo(x + w / 2 + Math.cos(a) * 30, y + 120 + Math.sin(a) * 30); g.lineTo(x + w / 2 + Math.cos(a) * 200, y + 120 + Math.sin(a) * 200); }
        g.stroke();
        g.fillStyle = CREAM; g.fillRect(x, y + 178, w, h - 178);
        g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y + 178); g.lineTo(x + w, y + 178); g.stroke();
      },
    });
    // header
    shout(g, human ? slot.name : 'CPU', x + 34, y + 26, 30, '#fff', 'center', -0.05);
    shout(g, F.name.toUpperCase(), x + w - 16, y + 28, 30, YEL, 'right', -0.04);
    // fighter on display
    g.save(); g.translate(x + w / 2, y + 168); g.scale(clamp(pick, 0, 1.3), clamp(pick, 0, 1.3));
    const pose = seat.ready ? { punch: true } : {};
    fighterPose(g, seat.fighter, 0, 0, 78, G.time + i, pose);
    g.restore();
    if (human && !seat.ready && d && d.kind !== 'touch') {
      shout(g, '◀', x + 20, y + 120, 30, '#fff'); shout(g, '▶', x + w - 22, y + 120, 30, '#fff');
    }
    // info
    txt(g, F.what, x + 16, y + 196, 13, INK, 'left', BODY, 700);
    statBar(g, 'Speed', (F.speed - 4) / 4, x + 16, y + 218, w - 32, '#2f6bff');
    statBar(g, 'Jump', (F.jump - 12) / 6.5, x + 16, y + 236, w - 32, '#33c45a');
    statBar(g, 'Weight', (F.weight - 0.6) / 0.8, x + 16, y + 254, w - 32, '#8a5cff');
    statBar(g, 'Power', (F.power - 0.75) / 0.55, x + 16, y + 272, w - 32, RED);
    if (human) {
      deviceKeys(g, d, x + 14, y + 298);
      if (seat.ready) { g.save(); g.translate(x + w - 48, y + 78); const p = back((G.time - (seat.readyT || 0)) / 0.3); g.scale(p, p); burst(g, 0, 0, 44, YEL, 10, 0.2); shout(g, 'READY!', 0, 2, 22, RED, 'center', -0.15); g.restore(); }
    } else {
      txt(g, 'Computer · ' + G.SKILLS[G.skill()], x + 16, y + 298, 13, INK, 'left', BODY, 700);
      G.buttons.push({ x, y: y + 40, w, h: 140, action: () => G.cycleFighter(seat, 1) });
      const bx = x + 20, by = y + h - 30;
      panel(g, bx, by, w - 40, 22, { fill: '#fff', skew: 6, line: 3, noShadow: true });
      txt(g, '× REMOVE', bx + (w - 40) / 2, by + 12, 14, INK, 'center', DISPLAY, 400);
      G.buttons.push({ x: bx, y: by, w: w - 40, h: 22, action: () => G.removeCpu(seat) });
    }
    if (human && seat.dev === 'touch') {
      G.buttons.push({ x, y: y + 40, w: w / 2, h: 140, action: () => G.cycleFighter(seat, -1) });
      G.buttons.push({ x: x + w / 2, y: y + 40, w: w / 2, h: 140, action: () => G.cycleFighter(seat, 1) });
    }
  }

  // ---------- settings / how / pause ----------
  function backdrop(g, G) {
    if (G.match) R.draw(G.match, { labels: G.labels() }); else R.draw(G.demo, { noTags: true });
    dim(g, 0.6);
    begin(g);
  }
  function settings(g, G) {
    backdrop(g, G);
    const items = G.menu(), w = 600, x = (DW - w) / 2, y = 70;
    const k = back(G.t / 0.35);
    g.save(); g.translate(DW / 2, 40); g.scale(k, k); shout(g, 'SETTINGS', 0, 0, 54, YEL, 'center', -0.03); g.restore();
    list(g, G, items, x, y + 16, w, 52, { size: 20 });
    prompts(g, [['↑↓', '✚', 'Choose'], ['◀▶', '✚', 'Change'], ['Esc', 'B', 'Back']], DW / 2, DH - 18, 'center');
  }
  function how(g, G) {
    backdrop(g, G);
    shout(g, 'HOW TO BRAWL', DW / 2, 40, 50, YEL, 'center', -0.03);
    const pw = 228, ph = 250, gap = 16, x0 = (DW - (4 * pw + 3 * gap)) / 2, y = 80;
    const panels = [
      ['1. JUMP IN', 'Press your BONK key on the select screen. Pick a fighter with left and right.', 'join'],
      ['2. BONK!', 'BONK is a quick hit. BIG BONK winds up, then launches. Jump twice in the air.', 'punch'],
      ['3. PERCENT', 'Every hit adds damage. The higher it gets, the further the next hit sends them flying.', 'pct'],
      ['4. OFF THE PAGE', 'Leave the screen and you lose a life. Down drops through thin ledges. Last one standing wins!', 'ko'],
    ];
    panels.forEach(([h, body, icon], i) => {
      const k = back((G.t - i * 0.08) / 0.4), x = x0 + i * (pw + gap), yy = y + (1 - clamp(k, 0, 1)) * 60;
      g.save(); g.globalAlpha = clamp(k, 0, 1);
      panel(g, x, yy, pw, ph, { fill: ['#fff', YEL, '#bfe3ff', '#ffc2d6'][i], dots: 'rgba(21,16,24,.08)', skew: 10 });
      shout(g, h, x + pw / 2, yy + 28, 26, '#fff', 'center', -0.04);
      if (icon === 'punch') { fighterPose(g, 0, x + pw / 2 - 10, yy + 140, 64, G.time, { punch: true }); }
      else if (icon === 'join') { cap(g, 'F', x + 40, yy + 100, 40, { fill: YEL }); shout(g, '→', x + 110, yy + 100, 34, INK); fighterPose(g, 2, x + 172, yy + 140, 52, G.time); }
      else if (icon === 'pct') { shout(g, '0%', x + 60, yy + 100, 34, '#fff', 'center', -0.1); shout(g, '87%', x + 150, yy + 110, 48, RED, 'center', 0.08); }
      else { burst(g, x + pw / 2, yy + 105, 50, RED, 10, G.time); shout(g, 'K.O.!', x + pw / 2, yy + 105, 34, '#fff', 'center', -0.1); }
      const words = body.split(' '); let line = '', ly = yy + 172;
      for (const wd of words) {
        const t = line ? line + ' ' + wd : wd;
        if (width(g, t, 14, BODY, 700) > pw - 36 && line) { txt(g, line, x + 18, ly, 14, INK, 'left', BODY, 700); line = wd; ly += 18; } else line = t;
      }
      txt(g, line, x + 18, ly, 14, INK, 'left', BODY, 700);
      g.restore();
    });
    // controls table
    const ty = 352;
    panel(g, 40, ty, 700, 218, { fill: '#fff', skew: 10 });
    shout(g, 'WHO PRESSES WHAT', 70, ty + 26, 24, YEL, 'left', -0.03);
    I.KEYBOARDS.forEach((kb, r) => {
      const ry = ty + 62 + r * 34;
      g.fillStyle = BB.SLOTS[r].color; g.beginPath(); g.arc(70, ry, 9, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
      let cx = 90;
      for (const key of [kb.caps.left, kb.caps.up, kb.caps.down, kb.caps.right]) cx += cap(g, key, cx, ry, 24) + 3;
      txt(g, 'move / jump / drop', cx + 6, ry, 13, INK, 'left', BODY, 700);
      cx += 150;
      cx += cap(g, kb.caps.a, cx, ry, 24, { fill: YEL }) + 6; txt(g, 'bonk', cx, ry, 13, INK, 'left', BODY, 700); cx += 46;
      cx += cap(g, kb.caps.b, cx, ry, 24, { fill: '#ffb3b3' }) + 6; txt(g, 'big bonk', cx, ry, 13, INK, 'left', BODY, 700);
    });
    txt(g, 'Gamepads: stick moves, up or Y jumps, A bonk, B or X big bonk, Start pauses.', 70, ty + 200, 13, INK, 'left', BODY, 700);
    list(g, G, G.menu(), 770, ty + 130, 200, 64, { size: 20 });
  }
  function pause(g, G) {
    R.draw(G.match, { labels: G.labels() });
    dim(g, 0.55);
    begin(g);
    const items = G.menu();
    g.save(); g.translate(250, 80); g.rotate(-0.05); burst(g, 0, 0, 120, YEL, 12, 0); shout(g, 'TIME OUT!', 0, 2, 50, RED, 'center', 0); g.restore();
    list(g, G, items, 90, 170, 340, 56, { size: 22 });
    // a panel per fighter with their keys
    const m = G.match;
    m.fighters.forEach((f, k) => {
      const y = 70 + k * 120, x = 520, slot = BB.SLOTS[f.slot];
      panel(g, x, y, 420, 104, { fill: '#fff', skew: 10 });
      g.fillStyle = slot.color; g.fillRect(x + 12, y + 3, 6, 98);
      fighterPose(g, BB.FIGHTERS.indexOf(f.c), x + 60, y + 92, 52, G.time);
      shout(g, (f.bot ? 'CPU' : slot.name) + ' ' + f.c.name.toUpperCase(), x + 110, y + 24, 22, slot.color, 'left');
      txt(g, Math.round(f.dmg) + '%  ·  ' + (f.out ? 'out' : f.stocks + ' lives'), x + 400, y + 24, 14, INK, 'right', BODY, 700);
      if (!f.bot) deviceKeys(g, I.byId[m.seatInfo[k].dev], x + 110, y + 60);
    });
    prompts(g, NAV, 260, DH - 18, 'center');
  }

  // ---------- fight HUD ----------
  function dmgColor(d) {
    if (d < 30) return '#fff';
    if (d < 70) return '#ffe14f';
    if (d < 110) return '#ff9a2e';
    return '#ff3d3d';
  }
  function hud(g, G) {
    const m = G.match, hs = R.hs, W = R.W, H = R.H, n = m.fighters.length;
    g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    const pw = Math.min(220 * hs, (W - 30 * hs) / n - 12 * hs), ph = 74 * hs, total = n * (pw + 12 * hs) - 12 * hs;
    const y = H - ph - 12 * hs;
    m.fighters.forEach((f, i) => {
      const x = (W - total) / 2 + i * (pw + 12 * hs), slot = BB.SLOTS[f.slot], v = R.visOf(f);
      const shake = v.flash > 0 ? (Math.random() - 0.5) * 8 * hs : 0;
      g.save(); g.translate(x + shake, y);
      const sk = 10 * hs;
      const path = (dx, dy) => { g.beginPath(); g.moveTo(sk + dx, dy); g.lineTo(pw + dx, dy); g.lineTo(pw - sk + dx, ph + dy); g.lineTo(dx, ph + dy); g.closePath(); };
      g.fillStyle = INK; path(5 * hs, 5 * hs); g.fill();
      g.fillStyle = f.out ? '#777' : slot.color; path(0, 0); g.fill();
      g.fillStyle = R.dots(g, 'rgba(255,255,255,.2)', 9); path(0, 0); g.fill();
      g.strokeStyle = INK; g.lineWidth = 4 * hs; path(0, 0); g.stroke();
      // portrait
      g.save(); g.beginPath(); g.rect(4 * hs, 2 * hs, 66 * hs, ph - 4 * hs); g.clip();
      R.drawFighter(g, f.out ? Object.assign({}, f, { stun: 1 }) : Object.assign({}, f, { stun: 0, atk: null, vx: 0, vy: 0, ground: true }), 40 * hs, ph + 24 * hs, 62 * hs, { vis: { sx: 1, sy: 1, blink: 0, flash: 0 }, noRing: true });
      g.restore();
      txt(g, (f.bot ? 'CPU' : slot.name) + ' · ' + f.c.name.toUpperCase(), 76 * hs, 15 * hs, 13 * hs, '#fff', 'left', DISPLAY, 400);
      if (f.out) shout(g, 'OUT!', 120 * hs, 46 * hs, 34 * hs, '#ccc', 'center', -0.08);
      else {
        const pop = 1 + v.flash * 3;
        g.save(); g.translate(pw - 62 * hs, 40 * hs); g.scale(pop, pop);
        shout(g, Math.round(f.dmg) + '%', 0, 0, 36 * hs, dmgColor(f.dmg), 'center', -0.05);
        g.restore();
        for (let k = 0; k < f.stocks; k++) {
          const sx = 82 * hs + k * 15 * hs, sy = ph - 12 * hs;
          g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, sy, 6.5 * hs, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 2.5 * hs; g.stroke();
          g.fillStyle = f.c.color; g.beginPath(); g.arc(sx, sy, 3.5 * hs, 0, TAU); g.fill();
        }
      }
      g.restore();
    });
    // pause button top-right
    const bx = W - 34 * hs, by = 32 * hs, r = 18 * hs;
    g.fillStyle = INK; g.beginPath(); g.arc(bx + 3, by + 3, r, 0, TAU); g.fill();
    g.fillStyle = YEL; g.beginPath(); g.arc(bx, by, r, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
    g.fillStyle = INK; g.fillRect(bx - 6 * hs, by - 7 * hs, 4 * hs, 14 * hs); g.fillRect(bx + 2 * hs, by - 7 * hs, 4 * hs, 14 * hs);
    const p1 = UI.toDesign(bx - r * 1.3, by - r * 1.3), p2 = UI.toDesign(bx + r * 1.3, by + r * 1.3);
    G.buttons.push({ x: p1.x, y: p1.y, w: p2.x - p1.x, h: p2.y - p1.y, action: () => G.pause() });
    // stage name and announcer
    const cx = W / 2, cy = R.viewH * 0.42;
    if (m.phase === 'countdown') {
      const n2 = 3 - Math.floor(m.phaseT / BB.Sim.COUNT_STEP), f = (m.phaseT % BB.Sim.COUNT_STEP) / BB.Sim.COUNT_STEP;
      if (m.phaseT < 0.9) { g.globalAlpha = 1 - clamp((m.phaseT - 0.6) / 0.3, 0, 1); shout(g, m.stage.name.toUpperCase(), cx, cy - 110 * hs, 40 * hs, YEL, 'center', -0.03); g.globalAlpha = 1; }
      if (n2 > 0) { const sc = back(f * 3); g.save(); g.translate(cx, cy); g.scale(sc, sc); burst(g, 0, 0, 90 * hs, ['#2f6bff', '#ffb000', RED][3 - n2] || RED, 12, f); shout(g, String(n2), 0, 4 * hs, 110 * hs, '#fff', 'center', -0.06); g.restore(); }
      // who is who
      m.fighters.forEach((ff) => {
        if (ff.bot) return;
        const d = I.byId[m.seatInfo[ff.i].dev]; if (!d) return;
        const x = R.X(ff.x), y = R.Y(ff.y) + 20 * hs;
        const lab = d.kind === 'kb' ? d.label + ' · ' + d.caps.a + ' bonk' : d.kind === 'pad' ? 'Gamepad · A bonk' : 'Touch';
        g.font = '700 ' + Math.round(12 * hs) + 'px ' + BODY;
        const tw = g.measureText(lab).width + 14 * hs;
        g.fillStyle = '#fff'; R.rr(g, x - tw / 2, y - 10 * hs, tw, 20 * hs, 4 * hs); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
        txt(g, lab, x, y + 0.5, 12 * hs, INK, 'center', BODY, 700);
      });
    } else if (m.phase === 'fight' && m.phaseT < 0.8) {
      const k = m.phaseT / 0.8; g.save(); g.globalAlpha = 1 - k * k; g.translate(cx, cy); const sc = 0.7 + back(k * 3) * 0.6; g.scale(sc, sc);
      burst(g, 0, 0, 150 * hs, YEL, 16, k); shout(g, 'BRAWL!', 0, 4 * hs, 90 * hs, RED, 'center', -0.08); g.restore();
    } else if (m.phase === 'game' || m.phase === 'over') {
      const k = back(m.phaseT / 0.4); g.save(); g.translate(cx, cy - 40 * hs); g.scale(k, k); g.rotate(-0.06);
      shout(g, 'GAME!', 0, 0, 130 * hs, '#fff', 'center', 0); g.restore();
    }
  }

  // ---------- results ----------
  function results(g, G) {
    const m = G.match;
    R.draw(m, { noTags: true });
    dim(g, 0.35);
    begin(g);
    const order = G.results.order, w = m.fighters[order[0]], slot = BB.SLOTS[w.slot];
    // winner splash panel
    const k = back(G.t / 0.5);
    g.save(); g.translate(330, 290); g.scale(k, k); g.translate(-330, -290);
    panel(g, 40, 40, 560, 470, {
      fill: slot.color, dots: 'rgba(255,255,255,.22)', skew: 22,
      fn: () => {
        g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 5; g.beginPath();
        for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU + G.time * 0.2; g.moveTo(320 + Math.cos(a) * 60, 300 + Math.sin(a) * 60); g.lineTo(320 + Math.cos(a) * 500, 300 + Math.sin(a) * 500); }
        g.stroke();
      },
    });
    const hop = Math.abs(Math.sin(G.time * 3.5)) * 26;
    fighterPose(g, BB.FIGHTERS.indexOf(w.c), 320, 488 - hop, 150, G.time, { punch: Math.floor(G.time) % 3 === 2, air: hop > 8, vis: { sx: 1 - hop * 0.004, sy: 1 + hop * 0.006, blink: 0, flash: 0 } });
    shout(g, (w.bot ? 'CPU' : slot.name) + ' ' + w.c.name.toUpperCase(), 320, 92, 58, YEL, 'center', -0.05);
    shout(g, 'WINS!', 320, 152, 70, '#fff', 'center', -0.05);
    g.restore();
    // everyone's stats as small panels
    order.forEach((idx, r) => {
      const f = m.fighters[idx], sl = BB.SLOTS[f.slot], kk = back((G.t - 0.4 - r * 0.1) / 0.4);
      const x = 640 + (1 - clamp(kk, 0, 1)) * 400, y = 40 + r * 112;
      panel(g, x, y, 320, 96, { fill: r === 0 ? YEL : '#fff', skew: 10 });
      shout(g, ['1ST', '2ND', '3RD', '4TH'][r], x + 44, y + 30, 30, r === 0 ? RED : '#fff', 'center', -0.08);
      txt(g, (f.bot ? 'CPU' : sl.name) + ' · ' + f.c.name, x + 82, y + 26, 16, INK, 'left', DISPLAY, 400);
      g.fillStyle = sl.color; g.fillRect(x + 14, y + 52, 6, 30);
      txt(g, f.stats.kos + ' KOs  ·  ' + f.stats.falls + ' falls', x + 30, y + 58, 13, INK, 'left', BODY, 700);
      txt(g, f.stats.dealt + '% dealt  ·  ' + f.stats.taken + '% taken', x + 30, y + 78, 13, INK, 'left', BODY, 700);
    });
    // buttons
    const items = G.menu(), bw = 200, bx0 = 70;
    items.forEach((it, i) => {
      const f = G.focus === i, x = bx0 + i * (bw + 14), y = 538 - (f ? 6 : 0);
      panel(g, x, y, bw, 52, { fill: f ? RED : '#fff', skew: 10 });
      if (f) shout(g, it.label.toUpperCase(), x + bw / 2, y + 28, 24, '#fff'); else txt(g, it.label.toUpperCase(), x + bw / 2, y + 28, 20, INK, 'center', DISPLAY, 400);
      G.buttons.push({ x, y, w: bw, h: 52, focus: i, action: () => G.activate(it) });
    });
    prompts(g, [['←→', '✚', 'Choose'], ['Enter', 'A', 'OK']], 980, 600, 'right');
  }

  function toast(g, G) {
    const t = G.toastMsg; if (!t) return;
    begin(g);
    g.save(); g.globalAlpha = clamp(t.life / 0.3, 0, 1);
    const w = width(g, t.str, 17, BODY, 700) + 50, y = G.screen === 'play' ? 70 : 104;
    panel(g, DW / 2 - w / 2, y - 20, w, 40, { fill: '#fff', skew: 8, line: 4 });
    txt(g, t.str, DW / 2, y + 1, 17, INK, 'center', BODY, 700);
    g.restore();
  }
  // Page-turn wipe between screens: a slanted ink panel sweeps across.
  function wipe(g, G) {
    if (G.fade <= 0.01) return;
    g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    const k = ease(1 - G.fade), W = R.W, H = R.H, x = k * (W + H * 0.4);
    g.fillStyle = YEL; g.beginPath(); g.moveTo(x, 0); g.lineTo(W + H * 0.4, 0); g.lineTo(W, H); g.lineTo(x - H * 0.4, H); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 10; g.beginPath(); g.moveTo(x, 0); g.lineTo(x - H * 0.4, H); g.stroke();
  }

  const UI = {
    toDesign(x, y) { layout(); return { x: (x - ox) / s, y: (y - oy) / s }; },
    hover(G, mo) { const p = this.toDesign(mo.x, mo.y); return G.buttons.some((b) => p.x >= b.x && p.y >= b.y && p.x <= b.x + b.w && p.y <= b.y + b.h); },
    draw(G) {
      const g = R.ctx;
      layout();
      const mo = I.mouse;
      if (mo) {
        const key = mo.x + ',' + mo.y;
        if (key !== lastMouse) {
          lastMouse = key;
          const p = this.toDesign(mo.x, mo.y);
          for (const b of G.buttons) if (b.focus !== undefined && p.x >= b.x && p.y >= b.y && p.x <= b.x + b.w && p.y <= b.y + b.h) G.focus = b.focus;
        }
      }
      G.buttons = [];
      g.setTransform(1, 0, 0, 1, 0, 0);
      const scr = G.screen;
      if (scr === 'title') title(g, G);
      else if (scr === 'lobby') lobby(g, G);
      else if (scr === 'settings') settings(g, G);
      else if (scr === 'how') how(g, G);
      else if (scr === 'play') { R.draw(G.match, { labels: G.labels() }); hud(g, G); }
      else if (scr === 'pause') pause(g, G);
      else if (scr === 'results') results(g, G);
      toast(g, G);
      wipe(g, G);
    },
  };
  BB.UI = UI;
})();
