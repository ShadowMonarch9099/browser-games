// Misfit Squad screens in a 1000x620 design space, styled as the station's
// holographic consoles: cut-corner glass panels, glowing edges, scanlines
// and readouts. Buttons go on G.buttons each frame so mouse, touch, keyboard
// and gamepads all drive the same menus.
(function () {
  const R = MS.Render, I = MS.Input, TAU = Math.PI * 2;
  const DISPLAY = R.DISPLAY, BODY = R.BODY;
  const DW = 1000, DH = 620;
  const CYAN = '#5ff2ff', ORANGE = '#ff9f1c', INKB = '#081028', TEXT = '#e6f6ff', DIM = '#8fb3d9', RED = '#ff5d6d';
  const clamp = MS.clamp, ease = MS.easeOut, back = MS.easeBack;
  let s = 1, ox = 0, oy = 0, lastMouse = '';

  function layout() { s = Math.min(R.W / DW, R.H / DH); ox = (R.W - DW * s) / 2; oy = (R.H - DH * s) / 2; }
  function begin(g) { g.setTransform(R.dpr * s, 0, 0, R.dpr * s, R.dpr * ox, R.dpr * oy); }
  const enter = (G, d, dur) => ease(((G.t || 0) - (d || 0)) / (dur || 0.3));
  function txt(g, str, x, y, size, color, align, font, weight) {
    g.font = (weight || 600) + ' ' + Math.round(size) + 'px ' + (font || BODY);
    g.textAlign = align || 'left'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(str, x, y);
  }
  function width(g, str, size, font, weight) { g.font = (weight || 600) + ' ' + Math.round(size) + 'px ' + (font || BODY); return g.measureText(str).width; }
  function cutPath(g, x, y, w, h, c) {
    g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + w, y); g.lineTo(x + w, y + h - c); g.lineTo(x + w - c, y + h); g.lineTo(x, y + h); g.lineTo(x, y + c); g.closePath();
  }
  // Holographic glass panel with a glowing edge and scanlines.
  function holo(g, x, y, w, h, o) {
    o = o || {};
    const c = o.cut === undefined ? 14 : o.cut, acc = o.accent || CYAN;
    cutPath(g, x, y, w, h, c);
    g.fillStyle = o.fill || 'rgba(10,22,58,.86)'; g.fill();
    g.save(); cutPath(g, x, y, w, h, c); g.clip();
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(95,242,255,.10)'); gr.addColorStop(1, 'rgba(95,242,255,0)');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,.035)'; for (let ly = y; ly < y + h; ly += 4) g.fillRect(x, ly, w, 1);
    g.restore();
    g.strokeStyle = acc; g.globalAlpha *= 0.35; g.lineWidth = 6; cutPath(g, x, y, w, h, c); g.stroke(); g.globalAlpha /= 0.35;
    g.lineWidth = 1.5; g.stroke();
    // corner ticks
    g.fillStyle = acc; g.fillRect(x + w - 26, y - 2, 26, 3); g.fillRect(x, y + h - 1, 26, 3);
  }
  function key(g, label, x, y, size, o) {
    o = o || {};
    if (o.pad) {
      const col = { A: '#4ade80', B: '#ff5d6d', X: '#60a5fa', Y: '#facc15' }[label] || '#8fb3d9';
      g.strokeStyle = col; g.lineWidth = 2; g.fillStyle = 'rgba(8,16,40,.9)'; g.beginPath(); g.arc(x + size / 2, y, size / 2, 0, TAU); g.fill(); g.stroke();
      txt(g, label, x + size / 2, y + 1, size * 0.55, col, 'center', DISPLAY, 400);
      return size;
    }
    const fs = label.length > 2 ? size * 0.42 : size * 0.58;
    const w = Math.max(size, width(g, label, fs, DISPLAY, 400) + size * 0.5);
    cutPath(g, x, y - size / 2, w, size, size * 0.25);
    g.fillStyle = o.fill || 'rgba(8,16,40,.9)'; g.fill(); g.strokeStyle = o.edge || CYAN; g.lineWidth = 1.5; g.stroke();
    txt(g, label, x + w / 2, y + 1, fs, o.ink || TEXT, 'center', DISPLAY, 400);
    return w;
  }
  const dev = () => I.last;
  function keyW(g, label, size) { if (dev() === 'gamepad' && label.length === 1) return size; const fs = label.length > 2 ? size * 0.42 : size * 0.58; return Math.max(size, width(g, label, fs, DISPLAY, 400) + size * 0.5); }
  function prompts(g, list, x, y, align) {
    const d = dev();
    if (d === 'touch') return;
    const items = list.map(([k, p, t]) => ({ k: d === 'gamepad' ? p : k, t })).filter((it) => it.k);
    let total = 0;
    for (const it of items) total += keyW(g, it.k, 22) + 8 + width(g, it.t, 14) + 20;
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    for (const it of items) { cx += key(g, it.k, cx, y, 22, { pad: d === 'gamepad' && it.k.length === 1 }) + 8; txt(g, it.t, cx, y + 1, 14, DIM); cx += width(g, it.t, 14) + 20; }
  }
  const NAV = [['↑↓', '✚', 'Select'], ['Enter', 'A', 'Confirm'], ['Esc', 'B', 'Back']];

  function list(g, G, items, x, y, w, rowH, o) {
    o = o || {};
    items.forEach((it, i) => {
      const k = enter(G, 0.05 + i * 0.05, 0.3), f = G.focus === i;
      const cx = x + (1 - k) * 40, cy = y + i * rowH, h = rowH - 8;
      g.save(); g.globalAlpha *= clamp(k, 0, 1);
      cutPath(g, cx, cy, w, h, 9);
      g.fillStyle = f ? (it.danger ? 'rgba(255,93,109,.25)' : 'rgba(95,242,255,.18)') : 'rgba(10,22,58,.6)'; g.fill();
      g.strokeStyle = f ? (it.danger ? RED : CYAN) : 'rgba(95,242,255,.25)'; g.lineWidth = f ? 2 : 1; g.stroke();
      if (f) { g.fillStyle = it.danger ? RED : CYAN; g.fillRect(cx + 4, cy + 6, 4, h - 12); }
      txt(g, (f ? '> ' : '') + it.label.toUpperCase(), cx + 18, cy + h / 2 + 1, o.size || 17, f ? TEXT : DIM, 'left', DISPLAY, 400);
      if (it.sub) txt(g, it.sub, cx + 26 + width(g, (f ? '> ' : '') + it.label.toUpperCase(), o.size || 17, DISPLAY, 400), cy + h / 2 + 2, 12, DIM);
      if (it.value) { const v = it.value(); txt(g, (f ? '◂ ' : '') + v + (f ? ' ▸' : ''), cx + w - 16, cy + h / 2 + 1, 15, v === 'On' ? '#7dff8e' : v === 'Off' ? '#7a8aa8' : TEXT, 'right', DISPLAY, 400); }
      if (it.slider) {
        const v = it.slider();
        for (let j = 0; j < 10; j++) { g.fillStyle = j < v ? (f ? CYAN : '#3b8fa8') : 'rgba(95,242,255,.12)'; g.fillRect(cx + w - 230 + j * 18, cy + h / 2 - 7 + (j < v ? 0 : 3), 12, j < v ? 14 : 8); }
        txt(g, String(v), cx + w - 16, cy + h / 2 + 1, 15, TEXT, 'right', DISPLAY, 400);
      }
      g.restore();
      if (it.slider) {
        G.buttons.push({ x: cx + w - 240, y: cy, w: 95, h, focus: i, action: () => { it.adjust(-1); G.saveNow(); } });
        G.buttons.push({ x: cx + w - 145, y: cy, w: 145, h, focus: i, action: () => { it.adjust(1); G.saveNow(); } });
        G.buttons.push({ x: cx, y: cy, w: w - 240, h, focus: i, action: () => {} });
      } else G.buttons.push({ x: cx, y: cy, w, h, focus: i, action: () => G.activate(it) });
    });
  }
  function dim(g, a) { g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); g.fillStyle = 'rgba(4,8,24,' + a + ')'; g.fillRect(0, 0, R.W, R.H); }
  function heroIcon(g, hero, x, y, u, t, slot, o) {
    const fake = Object.assign({ i: hero, c: MS.HEROES[hero], hero, slot: slot === undefined ? 0 : slot, face: -0.3, walk: t * 2, vx: 0, vy: 0, hp: 1, max: 1, recoil: 0, hurt: 0, down: false }, o || {});
    R.drawHero(g, fake, x, y, u, { noRing: !(o && o.ring) });
  }

  // ---------- title ----------
  function title(g, G) {
    R.draw(G.demo, {});
    dim(g, 0.45);
    begin(g);
    const k = back(G.t / 0.6);
    g.save(); g.translate(300, 150); g.scale(k, k);
    txt(g, 'MISFIT', -2, -36, 92, INKB, 'center', DISPLAY, 400);
    txt(g, 'MISFIT', 0, -40, 92, ORANGE, 'center', DISPLAY, 400);
    txt(g, 'SQUAD', 4, 46, 92, INKB, 'center', DISPLAY, 400);
    txt(g, 'SQUAD', 0, 42, 92, CYAN, 'center', DISPLAY, 400);
    g.restore();
    g.save(); g.globalAlpha = enter(G, 0.3, 0.5);
    txt(g, 'Four odd heroes. Fifteen waves of robots. One space station.', 300, 240, 16, TEXT, 'center');
    // the squad lined up
    for (let i = 0; i < 4; i++) heroIcon(g, i, 150 + i * 100, 420 + Math.sin(G.time * 2 + i) * 3, 120, G.time + i, i, { face: Math.PI / 2 - 0.4 + i * 0.25 });
    g.restore();
    holo(g, 600, 200, 340, 250, {});
    txt(g, 'STATION TERMINAL', 622, 226, 13, CYAN, 'left', DISPLAY, 400);
    txt(g, 'BEST WAVE ' + G.save.best + ' / 15', 920, 226, 13, ORANGE, 'right', DISPLAY, 400);
    list(g, G, G.menu(), 616, 252, 308, 56, {});
    txt(g, G.save.wins + ' station' + (G.save.wins === 1 ? '' : 's') + ' secured · ' + G.save.runs + ' runs', 770, 470, 13, DIM, 'center');
    prompts(g, NAV.slice(0, 2), 600, 600, 'left');
  }

  // ---------- crew select: four airlock pods ----------
  function deviceKeys(g, d, x, y) {
    if (!d) return;
    if (d.kind === 'pad') { key(g, 'A', x, y, 24, { pad: true }); txt(g, 'special · stick moves', x + 30, y, 13, TEXT); return; }
    if (d.kind === 'touch') { txt(g, 'stick + SPECIAL button', x, y, 13, TEXT); return; }
    let cx = x;
    for (const k of ['up', 'left', 'down', 'right']) cx += key(g, d.caps[k], cx, y, 22) + 3;
    cx += 8; cx += key(g, d.caps.a, cx, y, 22, { edge: ORANGE, ink: ORANGE }) + 5;
    txt(g, 'special', cx, y, 12, DIM);
  }
  function statBar(g, label, v, x, y, w, col) {
    txt(g, label, x, y, 11, DIM, 'left', DISPLAY, 400);
    for (let j = 0; j < 8; j++) { g.fillStyle = j < Math.round(v * 8) ? col : 'rgba(95,242,255,.12)'; g.fillRect(x + 66 + j * ((w - 66) / 8), y - 4, (w - 66) / 8 - 3, 8); }
  }
  function lobby(g, G) {
    R.draw(G.demo, {});
    dim(g, 0.6);
    begin(g);
    txt(g, 'ASSEMBLE THE SQUAD', DW / 2, 40, 38, CYAN, 'center', DISPLAY, 400);
    txt(g, 'Press your action key to step into a pod.  ◂ ▸ swaps hero.  Action again to suit up.', DW / 2, 76, 15, TEXT, 'center');
    const pw = 228, gap = 16, x0 = (DW - (4 * pw + 3 * gap)) / 2, y0 = 100, ph = 360;
    G.seats.forEach((seat, i) => {
      const k = back((G.t - 0.05 - i * 0.07) / 0.4);
      pod(g, G, seat, i, x0 + i * (pw + gap), y0 + (1 - clamp(k, 0, 1)) * 60, pw, ph, clamp(k, 0, 1));
    });
    const by = 480, bar = [
      { label: '◂ BACK', w: 130, act: () => { G.go('title'); G.sfx('back'); } },
      { label: '+ CREWBOT', w: 170, act: () => G.addCpu() },
      { label: 'LAUNCH ▸', w: 200, act: () => G.startFromLobby(), go: true },
    ];
    let bx = (DW - bar.reduce((a, b) => a + b.w, 0) - 14 * (bar.length - 1)) / 2;
    for (const b of bar) {
      const ok = !b.go || G.canStart();
      holo(g, bx, by, b.w, 44, { accent: b.go ? (ok ? ORANGE : '#55607a') : CYAN, cut: 10, fill: b.go && ok ? 'rgba(255,159,28,.22)' : undefined });
      txt(g, b.label, bx + b.w / 2, by + 23, b.go ? 20 : 16, b.go ? (ok ? ORANGE : '#55607a') : TEXT, 'center', DISPLAY, 400);
      G.buttons.push({ x: bx, y: by, w: b.w, h: 44, action: b.act });
      bx += b.w + 14;
    }
    const help = dev() === 'gamepad' ? [['', 'Y', 'Add crewbot'], ['', 'X', 'Remove'], ['', 'START', 'Launch'], ['', 'B', 'Back']] : [['C', '', 'Add crewbot'], ['X', '', 'Remove'], ['Space', '', 'Launch'], ['Esc', '', 'Back']];
    prompts(g, help, DW / 2, 556, 'center');
    if (G.lobbyGo > 0) {
      holo(g, DW / 2 - 200, 250, 400, 80, { accent: ORANGE });
      txt(g, 'LAUNCHING IN ' + Math.ceil(G.lobbyGo), DW / 2, 290, 30, ORANGE, 'center', DISPLAY, 400);
    }
  }
  function pod(g, G, seat, i, x, y, w, h, a) {
    const slot = MS.SLOTS[i];
    g.save(); g.globalAlpha *= a;
    holo(g, x, y, w, h, { accent: seat.kind === 'empty' ? 'rgba(95,242,255,.5)' : slot.color });
    // the pod capsule
    const cx = x + w / 2, cy = y + 112;
    g.fillStyle = 'rgba(4,8,24,.8)'; g.beginPath(); g.ellipse(cx, cy, 72, 92, 0, 0, TAU); g.fill();
    g.strokeStyle = seat.kind === 'empty' ? 'rgba(95,242,255,.35)' : slot.color; g.lineWidth = 3; g.stroke();
    txt(g, slot.name, x + 16, y + 20, 18, slot.color, 'left', DISPLAY, 400);
    g.fillStyle = slot.color; g.beginPath(); R.badge(g, slot.shape, x + w - 22, y + 20, 7); g.fill();
    if (seat.kind === 'empty') {
      const p = 0.5 + 0.5 * Math.sin(G.time * 3 + i);
      txt(g, 'POD EMPTY', cx, cy - 10, 16, 'rgba(230,246,255,' + (0.4 + 0.4 * p) + ')', 'center', DISPLAY, 400);
      txt(g, 'press action to board', cx, cy + 14, 12, DIM, 'center');
      [['F', 'W A S D'], ['Enter', 'Arrows'], ['O', 'I J K L'], ['0', 'Numpad']].forEach(([k2, lab], r) => {
        const ry = y + 230 + r * 26;
        key(g, k2, x + 26, ry, 22, { edge: ORANGE, ink: ORANGE }); txt(g, lab, x + 92, ry + 1, 13, TEXT);
      });
      key(g, 'A', x + 26, y + 334, 22, { pad: true }); txt(g, 'gamepad', x + 58, y + 335, 13, TEXT);
      g.restore();
      const bx = x + w - 104, by = y + 322;
      holo(g, bx, by, 90, 26, { cut: 6 }); txt(g, '+ CREWBOT', bx + 45, by + 14, 11, CYAN, 'center', DISPLAY, 400);
      G.buttons.push({ x: bx, y: by, w: 90, h: 26, action: () => G.addCpu(seat) });
      if (I.hasTouch() || dev() === 'touch') {
        holo(g, x + 14, y + h - 30, w - 28, 24, { cut: 6, accent: ORANGE }); txt(g, 'TAP TO BOARD', cx, y + h - 17, 12, ORANGE, 'center', DISPLAY, 400);
        G.buttons.push({ x: x + 14, y: y + h - 30, w: w - 28, h: 24, action: () => G.joinTouch() });
      }
      return;
    }
    const H = MS.HEROES[seat.hero], human = seat.kind === 'human', d = human ? I.byId[seat.dev] : null;
    // pod glass with the hero inside, a light column when suited up
    if (seat.ready) { g.fillStyle = 'rgba(95,242,255,.12)'; g.beginPath(); g.ellipse(cx, cy, 70, 90, 0, 0, TAU); g.fill(); }
    const pop = back((G.time - (seat.pickT || seat.joinT || 0)) / 0.35);
    g.save(); g.translate(cx, cy + 66); g.scale(clamp(pop, 0, 1.3), clamp(pop, 0, 1.3));
    heroIcon(g, seat.hero, 0, 0, 120, G.time + i, i, { face: seat.ready ? 0 : Math.sin(G.time) * 0.6 + Math.PI / 2 - 0.3, walk: seat.ready ? G.time * 3 : 0, vx: seat.ready ? 1 : 0 });
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.ellipse(cx - 30, cy - 40, 14, 40, 0.3, 0, TAU); g.fill();
    if (human && !seat.ready && d && d.kind !== 'touch') { txt(g, '◂', x + 18, cy, 26, CYAN, 'center', DISPLAY, 400); txt(g, '▸', x + w - 18, cy, 26, CYAN, 'center', DISPLAY, 400); }
    txt(g, H.name.toUpperCase(), cx, y + 222, 22, H.color, 'center', DISPLAY, 400);
    txt(g, H.role + ' · ' + H.special, cx, y + 244, 12, DIM, 'center');
    statBar(g, 'HEALTH', H.hp / 170, x + 16, y + 266, w - 32, '#7dff8e');
    statBar(g, 'SPEED', (H.speed - 2.5) / 2, x + 16, y + 282, w - 32, CYAN);
    statBar(g, 'FIREPOWER', (H.dmg / H.rate) / 27, x + 16, y + 298, w - 32, ORANGE);
    if (human) {
      deviceKeys(g, d, x + 16, y + 326);
      txt(g, seat.ready ? 'SUITED UP ✓' : 'press ' + (d && d.kind === 'kb' ? d.caps.a : 'A') + ' to suit up', cx, y + 350, 13, seat.ready ? '#7dff8e' : ORANGE, 'center', DISPLAY, 400);
    } else {
      txt(g, 'CREWBOT (computer)', cx, y + 326, 13, TEXT, 'center', DISPLAY, 400);
      g.restore();
      holo(g, x + 40, y + h - 32, w - 80, 24, { cut: 6, accent: RED }); txt(g, '× DISMISS', cx, y + h - 19, 12, RED, 'center', DISPLAY, 400);
      G.buttons.push({ x: x + 40, y: y + h - 32, w: w - 80, h: 24, action: () => G.removeCpu(seat) });
      G.buttons.push({ x, y: y + 30, w, h: 170, action: () => G.cycleHero(seat, 1) });
      return;
    }
    g.restore();
    if (seat.dev === 'touch') { G.buttons.push({ x, y: y + 30, w: w / 2, h: 170, action: () => G.cycleHero(seat, -1) }); G.buttons.push({ x: x + w / 2, y: y + 30, w: w / 2, h: 170, action: () => G.cycleHero(seat, 1) }); }
  }

  // ---------- settings / how / pause ----------
  function backdrop(g, G) { R.draw(G.run || G.demo, {}); dim(g, 0.62); begin(g); }
  function settings(g, G) {
    backdrop(g, G);
    const items = G.menu(), w = 560, h = 90 + items.length * 50, x = (DW - w) / 2, y = (DH - h) / 2;
    const k = back(G.t / 0.3);
    g.save(); g.translate(DW / 2, DH / 2); g.scale(1, k); g.translate(-DW / 2, -DH / 2);
    holo(g, x, y, w, h, {});
    txt(g, 'SETTINGS', x + 24, y + 34, 26, CYAN, 'left', DISPLAY, 400);
    list(g, G, items, x + 20, y + 64, w - 40, 50, {});
    g.restore();
    prompts(g, [['↑↓', '✚', 'Select'], ['◂▸', '✚', 'Adjust'], ['Esc', 'B', 'Back']], DW / 2, DH - 18, 'center');
  }
  function how(g, G) {
    backdrop(g, G);
    const x = 40, y = 30, w = 920, h = 540;
    holo(g, x, y, w, h, {});
    txt(g, 'MISSION BRIEFING', x + 26, y + 36, 28, CYAN, 'left', DISPLAY, 400);
    const lines = [
      'Robots pour onto the deck in 15 waves. Bosses arrive on waves 5, 10 and 15.',
      'Heroes aim and fire at the nearest robot by themselves. You steer, and press your action key for a special.',
      'If a hero goes down, stand next to them for two seconds to get them back up. If everyone is down, the run ends.',
      'Flying solo? Once per wave you get a second wind instead of going down.',
      'After every wave the squad picks one upgrade. Empty pods can be filled with computer crewbots.',
    ];
    lines.forEach((l, i) => { g.fillStyle = ORANGE; g.fillRect(x + 30, y + 78 + i * 26 - 3, 6, 6); txt(g, l, x + 46, y + 78 + i * 26, 14, TEXT); });
    MS.HEROES.forEach((H, i) => {
      const cx = x + 30 + i * 222, cy = y + 230;
      holo(g, cx, cy, 206, 170, { accent: H.color, cut: 10 });
      heroIcon(g, i, cx + 48, cy + 110, 90, G.time + i, i, { face: Math.PI / 2 - 0.3 });
      txt(g, H.name.toUpperCase(), cx + 96, cy + 24, 18, H.color, 'left', DISPLAY, 400);
      txt(g, H.role, cx + 96, cy + 44, 12, DIM);
      txt(g, H.special.toUpperCase(), cx + 96, cy + 70, 13, ORANGE, 'left', DISPLAY, 400);
      const words = H.desc.split(' '); let line = '', ly = cy + 92;
      for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (width(g, t, 12) > 100 && line) { txt(g, line, cx + 96, ly, 12, TEXT); line = wd; ly += 15; } else line = t; }
      txt(g, line, cx + 96, ly, 12, TEXT);
    });
    txt(g, 'CONTROLS', x + 30, y + 432, 16, CYAN, 'left', DISPLAY, 400);
    I.KEYBOARDS.forEach((kb, i) => {
      const cx = x + 30 + i * 222, cy = y + 466;
      g.fillStyle = MS.SLOTS[i].color; g.beginPath(); R.badge(g, MS.SLOTS[i].shape, cx + 6, cy, 6); g.fill();
      deviceKeys(g, I.byId[kb.id], cx + 20, cy);
    });
    txt(g, 'Gamepads: stick to move, A (or X, RB) for the special, Start to pause.', x + 30, y + 500, 13, DIM);
    list(g, G, G.menu(), x + w - 220, y + h - 64, 196, 52, {});
  }
  function pause(g, G) {
    R.draw(G.run, { tags: G.tags() });
    dim(g, 0.55);
    begin(g);
    const items = G.menu(), w = 400, h = 100 + items.length * 50, x = 70, y = (DH - h) / 2;
    holo(g, x, y, w, h, { accent: ORANGE });
    txt(g, 'PAUSED', x + 24, y + 36, 30, ORANGE, 'left', DISPLAY, 400);
    txt(g, 'WAVE ' + G.run.wave + ' / 15', x + w - 24, y + 36, 14, TEXT, 'right', DISPLAY, 400);
    list(g, G, items, x + 20, y + 70, w - 40, 50, {});
    const m = G.run, hx = 520;
    holo(g, hx, 100, 420, 60 + m.heroes.length * 74, {});
    txt(g, 'SQUAD STATUS', hx + 20, 126, 15, CYAN, 'left', DISPLAY, 400);
    m.heroes.forEach((h, k) => {
      const yy = 170 + k * 74;
      heroIcon(g, h.hero, hx + 44, yy + 30, 62, G.time, h.slot);
      txt(g, (h.bot ? 'BOT' : MS.SLOTS[h.slot].name) + ' · ' + h.c.name.toUpperCase(), hx + 84, yy, 15, h.c.color, 'left', DISPLAY, 400);
      txt(g, h.down ? 'DOWN' : Math.ceil(h.hp) + ' / ' + h.max + ' HP', hx + 400, yy, 13, h.down ? RED : TEXT, 'right');
      if (!h.bot) deviceKeys(g, I.byId[m.seatInfo[k].dev], hx + 84, yy + 26);
    });
    prompts(g, NAV, 270, DH - 18, 'center');
  }

  // ---------- upgrade pick ----------
  function upIcon(g, icon, x, y, t) {
    g.save(); g.translate(x, y); g.strokeStyle = CYAN; g.fillStyle = CYAN; g.lineWidth = 4; g.lineCap = 'round';
    const p = 1 + Math.sin(t * 4) * 0.05; g.scale(p, p);
    if (icon === 'dmg') { g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r = i % 2 ? 12 : 28; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.stroke(); }
    else if (icon === 'rate') { for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-26 + i * 16, -16); g.lineTo(-10 + i * 16, 0); g.lineTo(-26 + i * 16, 16); g.stroke(); } }
    else if (icon === 'hp' || icon === 'heal') { g.fillStyle = icon === 'heal' ? '#7dff8e' : CYAN; g.fillRect(-26, -8, 52, 16); g.fillRect(-8, -26, 16, 52); }
    else if (icon === 'speed') { g.beginPath(); g.moveTo(-24, 14); g.lineTo(24, 14); g.lineTo(24, -4); g.lineTo(4, -4); g.lineTo(-4, -18); g.lineTo(-24, -18); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-34, 0); g.lineTo(-44, 0); g.moveTo(-34, 8); g.lineTo(-48, 8); g.stroke(); }
    else if (icon === 'cool') { g.beginPath(); g.arc(0, 0, 24, -Math.PI / 2, Math.PI); g.stroke(); g.beginPath(); g.moveTo(-24, 0); g.lineTo(-32, -10); g.moveTo(-24, 0); g.lineTo(-14, -8); g.stroke(); }
    else if (icon === 'pierce') { g.beginPath(); g.moveTo(-32, 0); g.lineTo(32, 0); g.stroke(); g.strokeRect(-14, -16, 10, 32); g.strokeRect(6, -16, 10, 32); }
    else { g.beginPath(); g.moveTo(-36, 0); g.lineTo(36, 0); g.stroke(); g.beginPath(); g.arc(0, 0, 14, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(-36, -8); g.lineTo(-36, 8); g.moveTo(36, -8); g.lineTo(36, 8); g.stroke(); }
    g.restore();
  }
  function pick(g, G) {
    const m = G.run;
    R.draw(m, { tags: G.tags() });
    dim(g, 0.55);
    begin(g);
    txt(g, 'WAVE ' + m.wave + ' CLEARED', DW / 2, 70, 40, '#7dff8e', 'center', DISPLAY, 400);
    txt(g, 'Pick one upgrade for the whole squad. Anyone can choose.', DW / 2, 108, 16, TEXT, 'center');
    const items = G.menu(), cw = 260, gap = 30, x0 = (DW - (3 * cw + 2 * gap)) / 2;
    items.forEach((it, i) => {
      const up = MS.UPGRADES[m.picks[i]], f = G.focus === i, k = back((G.t - i * 0.08) / 0.4);
      const x = x0 + i * (cw + gap), y = 160 + (1 - clamp(k, 0, 1)) * 80 - (f ? 12 : 0);
      g.save(); g.globalAlpha = clamp(k, 0, 1);
      holo(g, x, y, cw, 300, { accent: f ? ORANGE : CYAN, fill: f ? 'rgba(40,30,20,.9)' : undefined });
      upIcon(g, up.icon, x + cw / 2, y + 96, G.time + i);
      txt(g, up.name.toUpperCase(), x + cw / 2, y + 180, 20, f ? ORANGE : TEXT, 'center', DISPLAY, 400);
      const words = up.text.split(' '); let line = '', ly = y + 214;
      for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (width(g, t, 15) > cw - 40 && line) { txt(g, line, x + cw / 2, ly, 15, DIM, 'center'); line = wd; ly += 20; } else line = t; }
      txt(g, line, x + cw / 2, ly, 15, DIM, 'center');
      if (f) txt(g, '[ INSTALL ]', x + cw / 2, y + 272, 14, ORANGE, 'center', DISPLAY, 400);
      g.restore();
      G.buttons.push({ x, y, w: cw, h: 300, focus: i, action: () => G.activate(it) });
    });
    prompts(g, [['←→', '✚', 'Choose'], ['Enter', 'A', 'Install']], DW / 2, 520, 'center');
  }

  // ---------- in-run HUD ----------
  function hud(g, G) {
    const m = G.run, hs = R.hs, W = R.W, H = R.H;
    g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    // wave meter, top centre
    const mw = Math.min(460 * hs, W * 0.6), mx = (W - mw) / 2, my = 10 * hs;
    holo(g, mx, my, mw, 36 * hs, { cut: 10 * hs });
    txt(g, 'WAVE ' + m.wave + '/' + S.WAVES, mx + 14 * hs, my + 18 * hs, 15 * hs, ORANGE, 'left', DISPLAY, 400);
    const segX = mx + 130 * hs, segW = mw - 250 * hs;
    for (let i = 0; i < S.WAVES; i++) {
      const done = i < m.wave - 1, cur = i === m.wave - 1, boss = (i + 1) % 5 === 0;
      g.fillStyle = done ? CYAN : cur ? 'rgba(255,159,28,' + (0.6 + 0.4 * Math.sin(G.time * 6)) + ')' : 'rgba(95,242,255,.15)';
      g.fillRect(segX + i * (segW / S.WAVES), my + (boss ? 9 : 13) * hs, segW / S.WAVES - 3 * hs, (boss ? 18 : 10) * hs);
    }
    const left = m.foes.length + m.queue.length;
    txt(g, left + ' BOTS', mx + mw - 14 * hs, my + 18 * hs, 14 * hs, TEXT, 'right', DISPLAY, 400);
    // boss health bar
    const boss = m.foes.find((f) => f.type === 'boss');
    if (boss) {
      const bw = Math.min(520 * hs, W * 0.7), bx = (W - bw) / 2, by = my + 44 * hs;
      txt(g, 'WARDEN · STATION SECURITY CHIEF', W / 2, by + 6 * hs, 12 * hs, RED, 'center', DISPLAY, 400);
      g.fillStyle = 'rgba(8,16,40,.9)'; g.fillRect(bx, by + 14 * hs, bw, 10 * hs);
      g.fillStyle = RED; g.fillRect(bx, by + 14 * hs, bw * clamp(boss.hp / boss.max, 0, 1), 10 * hs);
      g.strokeStyle = RED; g.lineWidth = 1; g.strokeRect(bx, by + 14 * hs, bw, 10 * hs);
    }
    // hero cards along the bottom
    const n = m.heroes.length, cw = Math.min(230 * hs, (W - 30 * hs) / n - 10 * hs), ch = 74 * hs, total = n * (cw + 10 * hs) - 10 * hs, cy = H - ch - 10 * hs;
    m.heroes.forEach((h, i) => {
      const cx = (W - total) / 2 + i * (cw + 10 * hs), slot = MS.SLOTS[h.slot];
      holo(g, cx, cy, cw, ch, { accent: h.down ? RED : h.c.color, cut: 10 * hs });
      g.save(); g.beginPath(); g.rect(cx + 2, cy + 2, 60 * hs, ch - 4); g.clip();
      heroIcon(g, h.hero, cx + 32 * hs, cy + ch + 8 * hs, 64 * hs, G.time + i, h.slot, { down: false, face: 0.4 });
      g.restore();
      txt(g, (h.bot ? 'BOT' : slot.name) + ' ' + h.c.name.toUpperCase(), cx + 68 * hs, cy + 16 * hs, 13 * hs, h.c.color, 'left', DISPLAY, 400);
      // health
      const bx = cx + 68 * hs, bw = cw - 80 * hs, frac = clamp(h.hp / h.max, 0, 1);
      g.fillStyle = 'rgba(8,16,40,.9)'; g.fillRect(bx, cy + 30 * hs, bw, 10 * hs);
      g.fillStyle = h.down ? RED : frac > 0.35 ? '#7dff8e' : RED; g.fillRect(bx, cy + 30 * hs, bw * frac, 10 * hs);
      if (h.down) txt(g, 'DOWN · REVIVE ME', bx, cy + 56 * hs, 12 * hs, RED, 'left', DISPLAY, 400);
      else {
        // special charge
        const ready = h.cool <= 0, cf = ready ? 1 : 1 - h.cool / (7 * m.mods.cool);
        g.fillStyle = 'rgba(8,16,40,.9)'; g.fillRect(bx, cy + 48 * hs, bw, 14 * hs);
        g.fillStyle = ready ? ORANGE : 'rgba(255,159,28,.45)'; g.fillRect(bx, cy + 48 * hs, bw * cf, 14 * hs);
        const d = h.bot ? null : I.byId[m.seatInfo[i].dev];
        const kl = d ? (d.kind === 'kb' ? '[' + d.caps.a + '] ' : d.kind === 'pad' ? '[A] ' : '') : '';
        txt(g, kl + h.c.special.toUpperCase() + (ready ? ' READY' : ''), bx + 4 * hs, cy + 55.5 * hs, 11 * hs, ready ? INKB : TEXT, 'left', DISPLAY, 400);
      }
    });
    // pause button
    const pbx = W - 30 * hs, pby = 28 * hs, r = 16 * hs;
    g.fillStyle = 'rgba(8,16,40,.85)'; g.beginPath(); g.arc(pbx, pby, r, 0, TAU); g.fill(); g.strokeStyle = CYAN; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = CYAN; g.fillRect(pbx - 6 * hs, pby - 7 * hs, 4 * hs, 14 * hs); g.fillRect(pbx + 2 * hs, pby - 7 * hs, 4 * hs, 14 * hs);
    const p1 = UI.toDesign(pbx - r * 1.4, pby - r * 1.4), p2 = UI.toDesign(pbx + r * 1.4, pby + r * 1.4);
    G.buttons.push({ x: p1.x, y: p1.y, w: p2.x - p1.x, h: p2.y - p1.y, action: () => G.pause() });
    // wave banner
    const b = G.banner;
    if (b) {
      const k = b.t < 0.4 ? back(b.t / 0.4) : b.t > 2.2 ? 1 - ease((b.t - 2.2) / 0.4) : 1;
      const bw = 520 * hs, bh = 86 * hs, bx = W / 2 - bw / 2, by = R.Y(4.5) - bh / 2;
      g.save(); g.translate(W / 2, by + bh / 2); g.scale(1, clamp(k, 0, 1.2)); g.translate(-W / 2, -(by + bh / 2));
      holo(g, bx, by, bw, bh, { accent: b.boss ? RED : ORANGE });
      txt(g, b.title, W / 2, by + 34 * hs, 34 * hs, b.boss ? RED : ORANGE, 'center', DISPLAY, 400);
      txt(g, b.sub, W / 2, by + 64 * hs, 15 * hs, TEXT, 'center');
      g.restore();
    }
    // boss intro: letterbox and a name card
    if (R.bossIntro > 0) {
      const k = R.bossIntro > 2.6 ? ease((3 - R.bossIntro) / 0.4) : R.bossIntro < 0.4 ? R.bossIntro / 0.4 : 1;
      g.fillStyle = 'rgba(0,0,0,.85)'; g.fillRect(0, 0, W, 50 * hs * k); g.fillRect(0, H - 50 * hs * k, W, 50 * hs * k);
      const cx = W - 40 * hs - (1 - k) * -300 * hs;
      g.save(); g.globalAlpha = k;
      holo(g, cx - 360 * hs, H * 0.3, 360 * hs, 90 * hs, { accent: RED });
      txt(g, '⚠ BOSS', cx - 340 * hs, H * 0.3 + 24 * hs, 14 * hs, RED, 'left', DISPLAY, 400);
      txt(g, 'THE WARDEN', cx - 340 * hs, H * 0.3 + 52 * hs, 30 * hs, TEXT, 'left', DISPLAY, 400);
      txt(g, 'Station security chief. Calls in reinforcements.', cx - 340 * hs, H * 0.3 + 76 * hs, 12 * hs, DIM, 'left');
      g.restore();
    }
    // who is who, at the start of a run
    if (m.wave === 1 && m.time < 4) {
      m.heroes.forEach((h, i) => {
        if (h.bot) return;
        const d = I.byId[m.seatInfo[i].dev]; if (!d) return;
        const lab = d.kind === 'kb' ? d.label + ' · special ' + d.caps.a : d.kind === 'pad' ? 'Gamepad · special A' : 'Touch';
        const x = R.X(h.x), y = R.Y(h.y) + 18 * hs;
        g.font = '600 ' + Math.round(12 * hs) + 'px ' + BODY; const tw = g.measureText(lab).width + 14 * hs;
        g.fillStyle = 'rgba(8,16,40,.9)'; g.fillRect(x - tw / 2, y - 10 * hs, tw, 20 * hs); g.strokeStyle = MS.SLOTS[h.slot].color; g.lineWidth = 1; g.strokeRect(x - tw / 2, y - 10 * hs, tw, 20 * hs);
        txt(g, lab, x, y + 1, 12 * hs, TEXT, 'center');
      });
    }
  }

  // ---------- results ----------
  function results(g, G) {
    const m = G.run, won = G.results.won;
    R.draw(m, {});
    dim(g, 0.6);
    begin(g);
    const k = back(G.t / 0.5);
    g.save(); g.translate(DW / 2, 70); g.scale(k, k);
    txt(g, won ? 'STATION SECURED' : 'SQUAD DOWN', 0, 0, 52, won ? '#7dff8e' : RED, 'center', DISPLAY, 400);
    g.restore();
    txt(g, won ? 'All 15 waves held. The robots are scrap.' : 'Overrun on wave ' + m.wave + '. Best so far: wave ' + G.save.best + '.', DW / 2, 116, 17, TEXT, 'center');
    const n = m.heroes.length, cw = 210, gap = 16, x0 = (DW - (n * cw + (n - 1) * gap)) / 2;
    m.heroes.forEach((h, i) => {
      const kk = back((G.t - 0.3 - i * 0.1) / 0.4), x = x0 + i * (cw + gap), y = 150 + (1 - clamp(kk, 0, 1)) * 60;
      g.save(); g.globalAlpha = clamp(kk, 0, 1);
      holo(g, x, y, cw, 300, { accent: h.c.color });
      heroIcon(g, h.hero, x + cw / 2, y + 140 - (won ? Math.abs(Math.sin(G.time * 4 + i)) * 12 : 0), 120, G.time + i, h.slot, { face: won ? -Math.PI / 2 : 0.3, down: !won && h.down });
      txt(g, (h.bot ? 'BOT' : MS.SLOTS[h.slot].name) + ' · ' + h.c.name.toUpperCase(), x + cw / 2, y + 170, 16, h.c.color, 'center', DISPLAY, 400);
      const rows = [['Robots scrapped', h.stats.kills], ['Damage dealt', Math.round(h.stats.dealt)], ['Revives', h.stats.revives], ['Specials used', h.stats.specials], ['Times downed', h.stats.downs]];
      rows.forEach(([l, v], r) => { txt(g, l, x + 16, y + 200 + r * 20, 12, DIM); txt(g, String(v), x + cw - 16, y + 200 + r * 20, 13, TEXT, 'right', DISPLAY, 400); });
      g.restore();
    });
    const items = G.menu(), bw = 200, bx0 = (DW - (items.length * bw + (items.length - 1) * 16)) / 2;
    items.forEach((it, i) => {
      const f = G.focus === i, x = bx0 + i * (bw + 16), y = 486;
      holo(g, x, y, bw, 48, { accent: f ? ORANGE : CYAN, cut: 10, fill: f ? 'rgba(255,159,28,.2)' : undefined });
      txt(g, it.label.toUpperCase(), x + bw / 2, y + 25, 17, f ? ORANGE : TEXT, 'center', DISPLAY, 400);
      G.buttons.push({ x, y, w: bw, h: 48, focus: i, action: () => G.activate(it) });
    });
    prompts(g, [['←→', '✚', 'Choose'], ['Enter', 'A', 'Confirm']], DW / 2, 572, 'center');
  }

  function toast(g, G) {
    const t = G.toastMsg; if (!t) return;
    begin(g);
    g.save(); g.globalAlpha = clamp(t.life / 0.3, 0, 1);
    const w = width(g, t.str, 15) + 44, y = G.screen === 'play' ? 110 : 96;
    holo(g, DW / 2 - w / 2, y - 18, w, 36, { cut: 8, accent: ORANGE });
    txt(g, t.str, DW / 2, y + 1, 15, TEXT, 'center');
    g.restore();
  }
  // Airlock wipe: two doors slide shut and open between screens.
  function wipe(g, G) {
    if (G.fade <= 0.01) return;
    g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    const k = G.fade > 0.5 ? 1 : G.fade * 2, W = R.W, H = R.H, half = (W / 2) * ease(k);
    g.fillStyle = '#1a2450'; g.fillRect(0, 0, half, H); g.fillRect(W - half, 0, half, H);
    g.fillStyle = ORANGE; g.fillRect(half - 6, 0, 6, H); g.fillRect(W - half, 0, 6, H);
  }

  const S = MS.Sim;
  const UI = {
    toDesign(x, y) { layout(); return { x: (x - ox) / s, y: (y - oy) / s }; },
    hover(G, mo) { const p = this.toDesign(mo.x, mo.y); return G.buttons.some((b) => p.x >= b.x && p.y >= b.y && p.x <= b.x + b.w && p.y <= b.y + b.h); },
    draw(G) {
      const g = R.ctx;
      layout();
      const mo = I.mouse;
      if (mo) {
        const k = mo.x + ',' + mo.y;
        if (k !== lastMouse) {
          lastMouse = k;
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
      else if (scr === 'play') { R.draw(G.run, { tags: G.tags() }); hud(g, G); }
      else if (scr === 'pause') pause(g, G);
      else if (scr === 'pick') pick(g, G);
      else if (scr === 'results') results(g, G);
      toast(g, G);
      wipe(g, G);
    },
  };
  MS.UI = UI;
})();
