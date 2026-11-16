// Bounce Tanks screens, drawn on the canvas in a 1000x620 design space that
// is scaled to fit. The look is a toy-box tabletop: index cards held on with
// masking tape, painted wooden letters, wooden key blocks and a clipboard.
// Buttons are registered on G.buttons every frame so mouse, touch, keys and
// gamepads all drive the same menus.
(function () {
  const R = BT.Render, I = BT.Input, TAU = Math.PI * 2;
  const DISPLAY = R.DISPLAY, BODY = R.BODY;
  const DW = 1000, DH = 620;
  const INK = '#3a2a18', PAPER = '#fbf3df', PAPER2 = '#f1e4c2', RED = '#d6452f', BLUE = '#6c9bd2';
  let s = 1, ox = 0, oy = 0, lastMouse = '';
  const ease = BT.easeOut, back = BT.easeBack, clamp = BT.clamp;

  function layout() {
    s = Math.min(R.W / DW, R.H / DH);
    ox = (R.W - DW * s) / 2; oy = (R.H - DH * s) / 2;
  }
  function begin(g) { g.setTransform(R.dpr * s, 0, 0, R.dpr * s, R.dpr * ox, R.dpr * oy); }
  const enter = (G, delay, dur) => ease(((G.t || 0) - (delay || 0)) / (dur || 0.3));

  // ---------- drawing helpers ----------
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function txt(g, str, x, y, size, color, align, font, weight) {
    g.font = (weight || 700) + ' ' + Math.round(size) + 'px ' + (font || BODY);
    g.textAlign = align || 'left'; g.textBaseline = 'middle'; g.fillStyle = color;
    g.fillText(str, x, y);
  }
  function width(g, str, size, font, weight) { g.font = (weight || 700) + ' ' + Math.round(size) + 'px ' + (font || BODY); return g.measureText(str).width; }
  // Painted wooden letters with an extruded side, each letter bobbing a little.
  function woodText(g, str, x, y, size, face, side, opts) {
    opts = opts || {};
    g.font = Math.round(size) + 'px ' + DISPLAY; g.textBaseline = 'middle'; g.textAlign = 'left';
    const total = g.measureText(str).width + (str.length - 1) * size * 0.04;
    let cx = opts.align === 'center' ? x - total / 2 : x;
    const depth = Math.max(3, size * 0.11);
    for (let i = 0; i < str.length; i++) {
      const ch = str[i], w = g.measureText(ch).width;
      const bob = opts.bob ? Math.sin(opts.time * 2.2 + i * 0.7) * size * 0.04 : 0;
      const rot = opts.bob ? Math.sin(opts.time * 1.7 + i * 1.3) * 0.03 : 0;
      g.save(); g.translate(cx + w / 2, y + bob); g.rotate(rot);
      g.fillStyle = 'rgba(20,10,4,.35)'; g.fillText(ch, -w / 2 + depth * 0.8, depth * 1.6);
      for (let k = depth; k > 0; k -= 1) { g.fillStyle = side; g.fillText(ch, -w / 2, k); }
      g.fillStyle = face; g.fillText(ch, -w / 2, 0);
      g.fillStyle = 'rgba(255,255,255,.22)'; g.fillText(ch, -w / 2, -size * 0.02);
      g.fillStyle = face; g.fillText(ch, -w / 2, size * 0.01);
      g.restore();
      cx += w + size * 0.04;
    }
    return total;
  }
  function tape(g, x, y, w, rot) {
    g.save(); g.translate(x, y); g.rotate(rot || 0);
    g.fillStyle = 'rgba(240,226,170,.82)'; g.fillRect(-w / 2, -9, w, 18);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-w / 2, -9, w, 4);
    g.strokeStyle = 'rgba(150,120,60,.25)'; g.lineWidth = 1;
    g.beginPath(); for (let i = 0; i <= w; i += 4) { g.moveTo(-w / 2 + i, -9); g.lineTo(-w / 2 + i + 2, -11); } g.stroke();
    g.restore();
  }
  // An index card: drop shadow, paper, ruled lines, optional tape.
  function card(g, x, y, w, h, opts) {
    opts = opts || {};
    g.save();
    g.translate(x + w / 2, y + h / 2); g.rotate(opts.rot || 0); g.translate(-w / 2, -h / 2);
    g.fillStyle = 'rgba(20,10,4,.32)'; rr(g, 4, 7, w, h, 4); g.fill();
    g.fillStyle = opts.color || PAPER; rr(g, 0, 0, w, h, 4); g.fill();
    if (opts.lines !== false) {
      g.strokeStyle = 'rgba(108,155,210,.28)'; g.lineWidth = 1; g.beginPath();
      for (let ly = opts.head || 22; ly < h - 6; ly += 16) { g.moveTo(6, ly); g.lineTo(w - 6, ly); }
      g.stroke();
      g.strokeStyle = 'rgba(214,69,47,.35)'; g.beginPath(); g.moveTo(opts.margin || 26, 4); g.lineTo(opts.margin || 26, h - 4); g.stroke();
    }
    if (opts.band) { g.fillStyle = opts.band; rr(g, 0, 0, w, opts.bandH || 10, 4); g.fill(); g.fillRect(0, (opts.bandH || 10) - 4, w, 4); }
    if (opts.dashed) { g.setLineDash([6, 5]); g.strokeStyle = 'rgba(58,42,24,.35)'; g.lineWidth = 2; rr(g, 6, 6, w - 12, h - 12, 3); g.stroke(); g.setLineDash([]); }
    if (opts.fn) opts.fn(w, h);
    g.restore();
    if (opts.tape) tape(g, x + w / 2 + (opts.tapeX || 0), y + 2, opts.tapeW || 60, (opts.rot || 0) * 2 + 0.03);
  }
  // A wooden key block (keyboard keys) or a round pad button.
  function block(g, label, x, y, size, opts) {
    opts = opts || {};
    const pad = opts.pad;
    const fs = label.length > 2 ? size * 0.36 : size * 0.48;
    const w = pad ? size : Math.max(size, width(g, label, fs, DISPLAY, 400) + size * 0.45);
    const d = size * 0.16, h = size;
    if (pad) {
      const col = { A: '#4caf50', B: '#e0473b', X: '#3f7fd6', Y: '#f2b632' }[label] || '#5b5149';
      g.fillStyle = 'rgba(20,10,4,.35)'; g.beginPath(); g.arc(x + w / 2 + 2, y + 3 + d, h / 2, 0, TAU); g.fill();
      g.fillStyle = shade(col, -0.35); g.beginPath(); g.arc(x + w / 2, y + d, h / 2, 0, TAU); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(x + w / 2, y, h / 2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(x + w / 2 - h * 0.12, y - h * 0.14, h * 0.18, 0, TAU); g.fill();
      txt(g, label, x + w / 2, y + 1, fs, '#fff', 'center', DISPLAY, 400);
      return w;
    }
    const tint = opts.color || '#e9c48a';
    g.fillStyle = 'rgba(20,10,4,.3)'; rr(g, x + 2, y - h / 2 + 3, w, h + d, h * 0.16); g.fill();
    g.fillStyle = shade(tint, -0.35); rr(g, x, y - h / 2 + d, w, h, h * 0.16); g.fill();
    g.fillStyle = tint; rr(g, x, y - h / 2, w, h, h * 0.16); g.fill();
    g.strokeStyle = 'rgba(120,70,20,.25)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x + w * 0.15, y - h * 0.3); g.quadraticCurveTo(x + w * 0.5, y - h * 0.38, x + w * 0.85, y - h * 0.26); g.stroke();
    txt(g, label, x + w / 2, y + 1, fs, opts.ink || INK, 'center', DISPLAY, 400);
    return w;
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, gr = (n >> 8) & 255, b = n & 255;
    const f = (c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
    r = f(r); gr = f(gr); b = f(b);
    return 'rgb(' + r + ',' + gr + ',' + b + ')';
  }
  function badge(g, shape, x, y, r, color) { g.fillStyle = color; R.badge(g, shape, x, y, r); }
  function shellIcon(g, x, y, r, on) {
    g.fillStyle = on ? '#3a2c18' : 'rgba(58,42,24,.18)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    if (on) { g.fillStyle = '#f6d98a'; g.beginPath(); g.arc(x, y, r * 0.75, 0, TAU); g.fill(); g.fillStyle = '#fffbe8'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.3, r * 0.25, 0, TAU); g.fill(); }
  }
  function stamp(g, str, x, y, size, color, rot) {
    g.save(); g.translate(x, y); g.rotate(rot || -0.12);
    const w = width(g, str, size, DISPLAY, 400) + size * 0.7;
    g.globalAlpha *= 0.88;
    g.strokeStyle = color; g.lineWidth = size * 0.12; rr(g, -w / 2, -size * 0.75, w, size * 1.5, size * 0.2); g.stroke();
    txt(g, str, 0, size * 0.05, size, color, 'center', DISPLAY, 400);
    g.restore();
  }

  // ---------- prompts that follow the device used last ----------
  const dev = () => I.last;
  function prompts(g, list, x, y, align) {
    // list: [[keyLabel, padLabel, text], ...]
    const d = dev();
    if (d === 'touch') return;
    const items = list.map(([k, p, t]) => ({ key: d === 'gamepad' ? p : k, t })).filter((it) => it.key);
    const size = 22;
    let total = 0;
    for (const it of items) total += blockW(g, it.key, size) + 8 + width(g, it.t, 14) + 22;
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    for (const it of items) {
      cx += block(g, it.key, cx, y, size, { pad: d === 'gamepad' && it.key.length === 1 }) + 8;
      txt(g, it.t, cx, y + 1, 14, '#fff3d6', 'left');
      cx += width(g, it.t, 14) + 22;
    }
  }
  function blockW(g, label, size) {
    if (dev() === 'gamepad' && label.length === 1) return size;
    const fs = label.length > 2 ? size * 0.36 : size * 0.48;
    return Math.max(size, width(g, label, fs, DISPLAY, 400) + size * 0.45);
  }
  const NAV_HELP = [['↑↓', '✚', 'Choose'], ['Enter', 'A', 'Select'], ['Esc', 'B', 'Back']];

  // ---------- vertical list of cards ----------
  function list(g, G, items, x, y, w, rowH, opts) {
    opts = opts || {};
    items.forEach((it, i) => {
      const k = enter(G, 0.05 + i * 0.05, 0.35);
      const f = G.focus === i;
      const slide = f ? 18 : 0;
      it._slide = (it._slide || 0);
      const cx = x + (1 - k) * -260 + slide, cy = y + i * rowH;
      const h = rowH - 12;
      const rot = opts.flat ? 0 : (i % 2 ? 0.012 : -0.012) + (f ? -0.01 : 0);
      g.save(); g.globalAlpha *= clamp(k * 1.5, 0, 1);
      card(g, cx, cy, w, h, {
        rot, lines: false, color: f ? '#fffaf0' : PAPER2,
        fn: (cw, ch) => {
          if (f) { g.fillStyle = it.danger ? RED : RED; g.fillRect(0, 0, 8, ch); }
          const lc = it.danger ? (f ? RED : '#9b4a3c') : f ? INK : '#6e5a40';
          txt(g, it.label, 22, ch / 2 + 1, opts.size || 22, lc, 'left', DISPLAY, 400);
          if (it.sub) txt(g, it.sub, 24 + width(g, it.label, opts.size || 22, DISPLAY, 400) + 12, ch / 2 + 2, 13, '#8a6a3c', 'left', BODY, 600);
          if (it.value) {
            const v = it.value();
            txt(g, v, cw - 22, ch / 2 + 1, 17, v === 'On' ? '#2f8a3c' : v === 'Off' ? '#9a8f7c' : INK, 'right', DISPLAY, 400);
            if (f) { txt(g, '◀', cw - 34 - width(g, v, 17, DISPLAY, 400), ch / 2, 12, '#8a6a3c', 'right'); txt(g, '▶', cw - 12, ch / 2, 12, '#8a6a3c', 'right'); }
          }
          if (it.slider) {
            const v = it.slider();
            for (let k2 = 0; k2 < 10; k2++) shellIcon(g, cw - 236 + k2 * 21, ch / 2, 7, k2 < v);
            txt(g, String(v), cw - 18, ch / 2 + 1, 16, INK, 'right', DISPLAY, 400);
          }
          if (f && !it.value && !it.slider) {
            const bob = Math.sin(G.time * 8) * 3;
            txt(g, '➜', cw - 22 + bob, ch / 2 + 1, 20, RED, 'right', BODY, 700);
          }
        },
      });
      g.restore();
      if (it.slider) {
        G.buttons.push({ x: cx + w - 250, y: cy, w: 115, h, focus: i, action: () => { it.adjust(-1); G.saveNow(); } });
        G.buttons.push({ x: cx + w - 135, y: cy, w: 135, h, focus: i, action: () => { it.adjust(1); G.saveNow(); } });
        G.buttons.push({ x: cx, y: cy, w: w - 250, h, focus: i, action: () => {} });
      } else G.buttons.push({ x: cx, y: cy, w, h, focus: i, action: () => G.activate(it) });
    });
  }

  // ---------- screens ----------
  function dimLeft(g, a) {
    g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    const gr = g.createLinearGradient(0, 0, R.W, 0);
    gr.addColorStop(0, 'rgba(26,14,6,' + 0.82 * a + ')'); gr.addColorStop(0.55, 'rgba(26,14,6,' + 0.35 * a + ')'); gr.addColorStop(1, 'rgba(26,14,6,' + 0.1 * a + ')');
    g.fillStyle = gr; g.fillRect(0, 0, R.W, R.H);
  }
  function dim(g, a) { g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); g.fillStyle = 'rgba(26,14,6,' + a + ')'; g.fillRect(0, 0, R.W, R.H); }

  function title(g, G) {
    R.draw(G.demo, { hud: false });
    dimLeft(g, 1);
    begin(g);
    const k = enter(G, 0, 0.6);
    g.save(); g.globalAlpha = k;
    woodText(g, 'BOUNCE', 54, 96 + (1 - k) * -30, 84, '#ff9a1f', '#a85a0c', { bob: true, time: G.time });
    woodText(g, 'TANKS', 74, 186 + (1 - k) * -30, 84, '#7cc93a', '#3f7f12', { bob: true, time: G.time + 2 });
    g.restore();
    // tagline on a strip of tape
    g.save(); g.globalAlpha = enter(G, 0.2, 0.4);
    g.translate(80, 252); g.rotate(-0.02);
    g.fillStyle = 'rgba(240,226,170,.9)'; g.fillRect(0, -15, 330, 30);
    txt(g, 'Shells bounce. Mind your own.', 14, 1, 17, INK, 'left', BODY, 800);
    g.restore();
    list(g, G, G.menu(), 60, 296, 330, 74);
    // a sticky note with the table's records
    const sv = G.save.stats;
    card(g, 790, 470, 180, 110, {
      rot: 0.05, color: '#fff2a8', lines: false, tape: true, tapeW: 50,
      fn: (w) => {
        txt(g, 'TABLE RECORD', w / 2, 22, 14, INK, 'center', DISPLAY, 400);
        txt(g, sv.matches + ' match' + (sv.matches === 1 ? '' : 'es') + ' played', w / 2, 44, 13, '#6e5a40', 'center');
        BT.TEAMS.forEach((t, i) => {
          const bx = 22 + i * 38;
          badge(g, t.shape, bx + 8, 72, 8, t.color);
          txt(g, String(sv.wins[i] || 0), bx + 8, 92, 14, INK, 'center', DISPLAY, 400);
        });
      },
    });
    g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    begin(g);
    prompts(g, NAV_HELP, 62, 598, 'left');
  }

  // Keys a device uses, drawn as an inverted T of blocks plus fire / leave.
  function deviceKeys(g, d, x, y, size) {
    if (d.kind === 'pad') {
      // a little gamepad
      g.fillStyle = 'rgba(20,10,4,.25)'; rr(g, x + 3, y - 22, 140, 52, 24); g.fill();
      g.fillStyle = '#4a433d'; rr(g, x, y - 25, 140, 52, 24); g.fill();
      g.fillStyle = '#2b2622'; g.fillRect(x + 22, y - 6, 26, 8); g.fillRect(x + 31, y - 15, 8, 26);
      g.fillStyle = '#6b625a'; g.beginPath(); g.arc(x + 70, y + 10, 8, 0, TAU); g.fill();
      block(g, 'A', x + 98, y + 6, 18, { pad: true }); block(g, 'B', x + 116, y - 8, 18, { pad: true });
      txt(g, 'stick / d-pad to drive', x, y + 44, 12, '#6e5a40');
      txt(g, 'A fire  ·  B leave', x, y + 60, 12, '#6e5a40');
      return;
    }
    if (d.kind === 'touch') {
      txt(g, 'On-screen stick to drive', x, y, 13, '#6e5a40');
      txt(g, 'FIRE button to shoot', x, y + 18, 13, '#6e5a40');
      return;
    }
    const c = d.caps, sz = size, gap = 4;
    block(g, c.up, x + sz + gap, y - sz * 0.62, sz);
    block(g, c.left, x, y + sz * 0.52, sz);
    block(g, c.down, x + sz + gap, y + sz * 0.52, sz);
    block(g, c.right, x + (sz + gap) * 2, y + sz * 0.52, sz);
    const fx = x + (sz + gap) * 3 + 14;
    const fw = block(g, c.a, fx, y - sz * 0.62, sz, { color: '#f6b04a' });
    txt(g, 'fire', fx + fw + 6, y - sz * 0.6, 12, '#6e5a40');
    const lw = block(g, c.b, fx, y + sz * 0.52, sz, { color: '#d9cdb4' });
    txt(g, 'leave', fx + lw + 6, y + sz * 0.54, 12, '#6e5a40');
  }

  function lobby(g, G) {
    R.draw(G.demo, { hud: false });
    dim(g, 0.62);
    begin(g);
    woodText(g, 'PICK YOUR CREWS', DW / 2, 52, 46, '#fff3c4', '#a8814a', { align: 'center' });
    txt(g, 'Each player presses their own FIRE key to join. Press it again when ready.', DW / 2, 92, 15, '#f6e8c6', 'center', BODY, 600);
    const cw = 222, chh = 318, gap = 14, x0 = (DW - (cw * 4 + gap * 3)) / 2, y0 = 112;
    G.seats.forEach((seat, i) => {
      const x = x0 + i * (cw + gap), k = enter(G, 0.05 + i * 0.07, 0.4);
      const yy = y0 + (1 - k) * 60;
      g.save(); g.globalAlpha = clamp(k * 1.4, 0, 1);
      seatCard(g, G, seat, i, x, yy, cw, chh);
      g.restore();
    });
    // bottom bar
    const by = 468;
    const bar = [
      { label: '‹ BACK', w: 110, act: () => { G.go('title'); G.sfx('back'); } },
      { label: 'FIRST TO ' + G.st.target, w: 170, act: () => G.cycleTarget(1), arrows: true },
      { label: 'CPU: ' + G.SKILLS[G.st.skill === undefined ? 1 : G.st.skill].toUpperCase(), w: 180, act: () => G.cycleSkill(1) },
      { label: '+ COMPUTER', w: 160, act: () => G.addCpu() },
      { label: 'START ▶', w: 170, act: () => G.startFromLobby(), go: true },
    ];
    let bx = (DW - bar.reduce((a, b) => a + b.w, 0) - 12 * (bar.length - 1)) / 2;
    for (const b of bar) {
      const ready = b.go && G.canStart();
      card(g, bx, by, b.w, 46, {
        lines: false, rot: 0, color: b.go ? (ready ? '#ffcf5a' : '#d9cdb4') : PAPER2,
        fn: (w, h) => txt(g, b.label, w / 2, h / 2 + 1, b.go ? 20 : 16, ready || !b.go ? INK : '#8d8474', 'center', DISPLAY, 400),
      });
      G.buttons.push({ x: bx, y: by, w: b.w, h: 46, action: b.act });
      bx += b.w + 12;
    }
    const d = dev();
    const help = d === 'gamepad'
      ? [['', 'Y', 'Add computer'], ['', 'X', 'Remove'], ['', 'RB', 'Rounds'], ['', 'START', 'Start'], ['', 'B', 'Back']]
      : [['C', '', 'Add computer'], ['X', '', 'Remove'], ['R', '', 'Rounds'], ['V', '', 'Skill'], ['Space', '', 'Start'], ['Esc', '', 'Back']];
    prompts(g, help, DW / 2, 548, 'center');
    if (G.lobbyGo > 0) {
      const n = Math.ceil(G.lobbyGo / 0.55);
      g.save(); g.translate(DW / 2, 300); g.scale(1 + (G.lobbyGo % 0.55) * 0.4, 1 + (G.lobbyGo % 0.55) * 0.4);
      stamp(g, 'ROLLING OUT ' + n, 0, 0, 44, '#fff3c4', -0.08);
      g.restore();
    }
  }

  function seatCard(g, G, seat, i, x, y, w, h) {
    const T = BT.TEAMS[seat.team];
    if (seat.kind === 'empty') {
      card(g, x, y, w, h, {
        rot: (i % 2 ? 0.015 : -0.012), color: 'rgba(251,243,223,.88)', lines: false, dashed: true,
        fn: (cw) => {
          txt(g, 'OPEN SEAT', cw / 2, 34, 24, '#8a6a3c', 'center', DISPLAY, 400);
          txt(g, 'press FIRE to join', cw / 2, 60, 13, '#8a6a3c', 'center', BODY, 600);
          const rows = [['F', 'W A S D'], ['Enter', 'Arrow keys'], ['O', 'I J K L'], ['0', 'Number pad']];
          rows.forEach(([key, lab], r) => {
            const ry = 92 + r * 34;
            block(g, key, 22, ry, 24, { color: '#f6b04a' });
            txt(g, lab, 82, ry + 1, 14, INK, 'left', BODY, 700);
          });
          const anyPad = I.devices.some((d) => d.kind === 'pad' && d.connected);
          block(g, 'A', 22, 228, 24, { pad: true });
          txt(g, anyPad ? 'any gamepad' : 'gamepad (plug in)', 56, 229, 14, anyPad ? INK : '#9a8f7c', 'left', BODY, 700);
        },
      });
      // + computer / touch join buttons
      const bw = w - 36, bx = x + 18;
      const by = y + h - 66;
      card(g, bx, by, bw, 26, { lines: false, color: '#e8dcc0', fn: (cw, ch) => txt(g, '+ COMPUTER TANK', cw / 2, ch / 2 + 1, 13, INK, 'center', DISPLAY, 400) });
      G.buttons.push({ x: bx, y: by, w: bw, h: 26, action: () => G.addCpu(seat) });
      if (I.hasTouch() || dev() === 'touch') {
        card(g, bx, by + 32, bw, 26, { lines: false, color: '#ffcf5a', fn: (cw, ch) => txt(g, 'TAP TO JOIN HERE', cw / 2, ch / 2 + 1, 13, INK, 'center', DISPLAY, 400) });
        G.buttons.push({ x: bx, y: by + 32, w: bw, h: 26, action: () => G.joinTouch() });
      }
      return;
    }
    const human = seat.kind === 'human';
    const d = human ? I.byId[seat.dev] : null;
    const pop = back((G.time - (seat.joinT || 0)) / 0.4);
    card(g, x, y, w, h, {
      rot: (i % 2 ? 0.015 : -0.012), band: T.color, bandH: 46, lines: false, tape: true, tapeW: 54,
      fn: (cw, ch) => {
        badge(g, T.shape, 28, 25, 11, '#fffbe8');
        const pn = human ? 'P' + (G.seats.slice(0, i + 1).filter((q) => q.kind === 'human').length) : 'CPU';
        txt(g, pn, 48, 25, 22, '#fffbe8', 'left', DISPLAY, 400);
        txt(g, T.name.toUpperCase(), cw - 14, 25, 16, '#fffbe8', 'right', DISPLAY, 400);
        // the tank on a little turntable
        g.fillStyle = 'rgba(58,42,24,.12)'; g.beginPath(); g.ellipse(cw / 2, 118, 70, 24, 0, 0, TAU); g.fill();
        g.save(); g.translate(cw / 2, 102); g.scale(pop, pop);
        R.drawTank(g, 0, 0, 150, G.time * 0.8 + i, seat.team, { tread: G.time * 3 });
        g.restore();
        if (human) {
          if (d) txt(g, d.label.toUpperCase(), cw / 2, 168, 13, '#8a6a3c', 'center', DISPLAY, 400);
          if (d) deviceKeys(g, d, 22, 210, 26);
          if (!seat.ready) {
            if (d && d.kind !== 'touch') txt(g, '◀ ▶  change colour', cw / 2, 272, 12, '#8a6a3c', 'center', BODY, 700);
            const pulse = 0.6 + 0.4 * Math.sin(G.time * 5);
            g.globalAlpha *= pulse;
            txt(g, d && d.kind !== 'touch' ? 'press ' + (d.kind === 'pad' ? 'A' : d.caps.a) + ' when ready' : 'ready', cw / 2, 296, 15, RED, 'center', DISPLAY, 400);
            g.globalAlpha /= pulse;
          } else stamp(g, 'READY!', cw / 2, 290, 26, '#2f8a3c', -0.1);
        } else {
          txt(g, 'COMPUTER', cw / 2, 168, 15, '#8a6a3c', 'center', DISPLAY, 400);
          txt(g, G.SKILLS[G.st.skill === undefined ? 1 : G.st.skill] + ' driver', cw / 2, 190, 13, '#6e5a40', 'center');
          stamp(g, 'READY!', cw / 2, 240, 24, '#2f8a3c', -0.1);
        }
      },
    });
    if (!human) {
      card(g, x + 18, y + h - 40, w - 36, 26, { lines: false, color: '#e8dcc0', fn: (cw, ch) => txt(g, '× REMOVE', cw / 2, ch / 2 + 1, 13, INK, 'center', DISPLAY, 400) });
      G.buttons.push({ x: x + 18, y: y + h - 40, w: w - 36, h: 26, action: () => G.removeCpu(seat) });
    } else if (seat.dev === 'touch') {
      card(g, x + 18, y + h - 40, w - 36, 26, { lines: false, color: '#e8dcc0', fn: (cw, ch) => txt(g, '× LEAVE', cw / 2, ch / 2 + 1, 13, INK, 'center', DISPLAY, 400) });
      G.buttons.push({ x: x + 18, y: y + h - 40, w: w - 36, h: 26, action: () => G.leave(seat) });
    }
  }

  // A clipboard holding a sheet of paper; content drawn by fn(x, y, w, h).
  function clipboard(g, G, x, y, w, h, heading, fn) {
    const k = back(G.t / 0.35);
    g.save(); g.translate(x + w / 2, y + h / 2); g.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k); g.rotate((1 - k) * 0.05); g.translate(-(x + w / 2), -(y + h / 2));
    g.globalAlpha = clamp(G.t / 0.15, 0, 1);
    g.fillStyle = 'rgba(20,10,4,.4)'; rr(g, x + 6, y + 10, w, h, 14); g.fill();
    g.fillStyle = '#9b6a3a'; rr(g, x, y, w, h, 14); g.fill();
    g.fillStyle = '#b07a46'; rr(g, x, y, w, h - 6, 14); g.fill();
    g.fillStyle = PAPER; g.fillRect(x + 16, y + 26, w - 32, h - 44);
    g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(x + 16, y + h - 22, w - 32, 4);
    // the clip
    g.fillStyle = '#8f949a'; rr(g, x + w / 2 - 70, y - 8, 140, 34, 8); g.fill();
    g.fillStyle = '#c9ced4'; rr(g, x + w / 2 - 64, y - 6, 128, 24, 6); g.fill();
    g.fillStyle = '#6d7277'; g.beginPath(); g.arc(x + w / 2, y + 6, 6, 0, TAU); g.fill();
    if (heading) txt(g, heading, x + 40, y + 56, 30, INK, 'left', DISPLAY, 400);
    fn(x + 16, y + 26, w - 32, h - 44);
    g.restore();
  }

  function backdrop(g, G) {
    if (G.match) { R.draw(G.match, { hud: true, labels: G.labels() }); dim(g, 0.55); }
    else { R.draw(G.demo, { hud: false }); dim(g, 0.5); }
    begin(g);
  }

  function settings(g, G) {
    backdrop(g, G);
    const items = G.menu();
    const w = 560, h = 120 + items.length * 46, x = (DW - w) / 2, y = (DH - h) / 2;
    clipboard(g, G, x, y, w, h, 'SETTINGS', () => {
      list(g, G, items, x + 30, y + 84, w - 84, 46, { flat: true, size: 17 });
    });
    prompts(g, [['↑↓', '✚', 'Choose'], ['◀▶', '✚', 'Change'], ['Esc', 'B', 'Back']], DW / 2, DH - 16, 'center');
  }

  function how(g, G) {
    backdrop(g, G);
    const w = 900, h = 540, x = (DW - w) / 2, y = 30;
    clipboard(g, G, x, y, w, h, 'HOW TO PLAY', (px, py, pw) => {
      // left column: crews and keys
      txt(g, 'FOUR CREWS, ONE KEYBOARD', px + 24, py + 72, 16, RED, 'left', DISPLAY, 400);
      I.KEYBOARDS.forEach((kb, i) => {
        const ry = py + 112 + i * 64, T = BT.TEAMS[i];
        badge(g, T.shape, px + 36, ry, 10, T.color);
        deviceKeys(g, I.byId[kb.id], px + 58, ry, 24);
        txt(g, kb.label, px + 300, ry, 13, '#6e5a40', 'left', BODY, 700);
      });
      txt(g, 'Gamepads work too: one per tank (stick drives, A fires).', px + 24, py + 372, 13, INK, 'left', BODY, 600);
      txt(g, 'Phone or tablet: tap a seat to join with the on-screen stick.', px + 24, py + 392, 13, INK, 'left', BODY, 600);
      txt(g, 'Up drives forward, down reverses, left and right turn.', px + 24, py + 412, 13, INK, 'left', BODY, 600);
      // right column: rules
      const rx = px + 470;
      txt(g, 'THE RULES', rx, py + 72, 16, RED, 'left', DISPLAY, 400);
      const rules = [
        ['bounce', 'Shells bounce off every wall, up to 6 seconds.'],
        ['one', 'One hit knocks a tank out. Your own shells count!'],
        ['five', 'Five shells in the air per tank, at most.'],
        ['triple', 'Crate with three dots: your next shot is a triple.'],
        ['laser', 'Crate with a bolt: your next shot is a fast laser.'],
        ['crown', 'Last tank rolling wins the round. First to ' + G.st.target + ' wins.'],
      ];
      rules.forEach(([icon, str], i) => {
        const ry = py + 112 + i * 50;
        ruleIcon(g, icon, rx + 18, ry, G);
        wrapText(g, str, rx + 46, ry, pw - (rx - px) - 60, 14, 17);
      });
      txt(g, 'A new maze is built for every round.', rx, py + 420, 13, '#6e5a40', 'left', BODY, 700);
    });
    list(g, G, G.menu(), DW - 260, DH - 92, 190, 60, { flat: true, size: 18 });
  }
  function wrapText(g, str, x, y, maxW, size, lh) {
    const words = str.split(' '), lines = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (width(g, t, size, BODY, 600) > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line);
    const y0 = y - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => txt(g, l, x, y0 + i * lh, size, INK, 'left', BODY, 600));
  }
  function ruleIcon(g, kind, x, y, G) {
    g.save(); g.translate(x, y);
    if (kind === 'bounce') {
      g.strokeStyle = '#a97c46'; g.lineWidth = 5; g.beginPath(); g.moveTo(-14, -14); g.lineTo(14, -14); g.stroke();
      g.strokeStyle = BLUE; g.lineWidth = 2; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(-14, 12); g.lineTo(0, -11); g.lineTo(14, 12); g.stroke(); g.setLineDash([]);
      shellIcon(g, 14, 12, 5, true);
    } else if (kind === 'one') { R.drawTank(g, 0, 0, 44, -0.6, 0, { noShadow: true }); g.strokeStyle = RED; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.stroke(); }
    else if (kind === 'five') { for (let i = 0; i < 5; i++) shellIcon(g, -14 + i * 7, 0, 4, true); }
    else if (kind === 'triple' || kind === 'laser') {
      const sz = 26, cy = Math.sin(G.time * 3) * 2;
      g.fillStyle = '#8a5a2b'; rr(g, -sz / 2, -sz / 2 + 5 + cy, sz, sz, 4); g.fill();
      g.fillStyle = '#d99a4e'; rr(g, -sz / 2, -sz / 2 + cy, sz, sz, 4); g.fill();
      g.strokeStyle = '#8a5a2b'; g.lineWidth = 2; rr(g, -sz / 2 + 3, -sz / 2 + 3 + cy, sz - 6, sz - 6, 3); g.stroke();
      g.fillStyle = '#fff6d8';
      if (kind === 'triple') for (const dx of [-6, 0, 6]) { g.beginPath(); g.arc(dx, cy + (dx ? 2 : -2), 2.6, 0, TAU); g.fill(); }
      else { g.beginPath(); g.moveTo(3, cy - 8); g.lineTo(-5, cy + 1); g.lineTo(0, cy + 1); g.lineTo(-3, cy + 8); g.lineTo(5, cy - 1); g.lineTo(0, cy - 1); g.closePath(); g.fill(); }
    }
    else { g.fillStyle = '#f2b632'; g.beginPath(); g.moveTo(-14, 8); g.lineTo(-14, -8); g.lineTo(-7, 0); g.lineTo(0, -12); g.lineTo(7, 0); g.lineTo(14, -8); g.lineTo(14, 8); g.closePath(); g.fill(); }
    g.restore();
  }

  function pause(g, G) {
    R.draw(G.match, { hud: true, labels: G.labels() });
    dim(g, 0.6);
    begin(g);
    const items = G.menu();
    const w = 380, h = 110 + items.length * 56, x = 80, y = (DH - h) / 2;
    card(g, x, y, w, h, {
      rot: -0.01, tape: true, tapeW: 90, head: 70,
      fn: () => {
        txt(g, 'PAUSED', 40, 44, 40, INK, 'left', DISPLAY, 400);
        txt(g, 'Round ' + G.match.round + '  ·  first to ' + G.match.target, 42, 76, 13, '#8a6a3c', 'left', BODY, 700);
      },
    });
    list(g, G, items, x + 26, y + 98, w - 52, 56, { flat: true, size: 19 });
    // everyone's controls as a reminder
    const humans = G.match.seats.map((s, i) => ({ s, i })).filter((o) => !o.s.bot);
    card(g, 520, 90, 420, 70 + humans.length * 88, {
      rot: 0.012, lines: false, color: '#fff2a8',
      fn: () => {
        txt(g, 'WHO DRIVES WHAT', 24, 30, 16, INK, 'left', DISPLAY, 400);
        humans.forEach((o, k) => {
          const T = BT.TEAMS[o.s.team], ry = 82 + k * 88, d = I.byId[o.s.dev];
          badge(g, T.shape, 30, ry, 10, T.color);
          if (d) deviceKeys(g, d, 54, ry, 22);
        });
      },
    });
    prompts(g, NAV_HELP, DW / 2, DH - 16, 'center');
  }

  function results(g, G) {
    const m = G.match;
    R.draw(m, { hud: false });
    dim(g, 0.5);
    begin(g);
    const champ = m.seats[m.champ], T = BT.TEAMS[champ.team];
    const k = back(G.t / 0.5);
    g.save(); g.translate(DW / 2, 70); g.scale(k, k);
    woodText(g, T.name.toUpperCase() + ' WINS!', 0, 0, 62, T.color, T.dark, { align: 'center', bob: true, time: G.time });
    g.restore();
    txt(g, (champ.bot ? 'The computer' : G.labels()[m.champ]) + ' takes the war ' + m.score[m.champ] + ' rounds to ' + Math.max.apply(null, m.score.filter((_, i) => i !== m.champ)), DW / 2, 122, 16, '#fff3d6', 'center', BODY, 700);
    // podium of wooden blocks
    const order = G.results.order, n = order.length;
    const pw = 190, gap = 18, x0 = (DW - (n * pw + (n - 1) * gap)) / 2, base = 470;
    const heights = [150, 110, 80, 56];
    // arrange 2nd, 1st, 3rd, 4th like a real podium
    const slots = n === 2 ? [1, 0] : n === 3 ? [1, 0, 2] : [1, 0, 2, 3];
    slots.forEach((rank, col) => {
      if (rank >= n) return;
      const idx = order[rank], seat = m.seats[idx], Tm = BT.TEAMS[seat.team], st = m.stats[idx];
      const kk = back((G.t - 0.3 - rank * 0.15) / 0.45);
      const x = x0 + col * (pw + gap), hgt = heights[rank] * clamp(kk, 0, 1.2), top = base - hgt;
      // block
      g.fillStyle = 'rgba(20,10,4,.35)'; g.fillRect(x + 8, top + 10, pw, hgt);
      g.fillStyle = shade(Tm.color, -0.3); g.fillRect(x, top + 12, pw, hgt);
      g.fillStyle = Tm.color; g.fillRect(x, top, pw, 14);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x, top, pw, 3);
      if (kk > 0.2) txt(g, String(rank + 1), x + pw / 2, top + 14 + hgt / 2, 54, 'rgba(255,255,255,.55)', 'center', DISPLAY, 400);
      // tank on top
      if (kk > 0.1) {
        const hop = rank === 0 ? Math.abs(Math.sin(G.time * 4)) * 10 : 0;
        R.drawTank(g, x + pw / 2, top - 30 - hop, 120, -Math.PI / 2 + Math.sin(G.time * 2 + col) * 0.3, seat.team, { tread: G.time * 2 });
        if (rank === 0) { g.save(); g.translate(x + pw / 2, top - 86 - hop); ruleIcon(g, 'crown', 0, 0, G); g.restore(); }
      }
      // stats under the podium
      const sy = base + 22;
      txt(g, (seat.bot ? 'CPU' : G.labels()[idx]) + ' · ' + Tm.name, x + pw / 2, sy, 15, '#fff3d6', 'center', DISPLAY, 400);
      txt(g, m.score[idx] + ' rounds  ·  ' + st.hits + ' hits', x + pw / 2, sy + 20, 13, '#f6e8c6', 'center', BODY, 600);
      txt(g, st.shots + ' shots · ' + st.bounces + ' bounces · ' + st.own + ' own', x + pw / 2, sy + 38, 12, 'rgba(246,232,198,.75)', 'center', BODY, 600);
    });
    // buttons in a row
    const items = G.menu();
    const bw = 200, bx0 = (DW - (items.length * bw + (items.length - 1) * 16)) / 2;
    items.forEach((it, i) => {
      const f = G.focus === i, x = bx0 + i * (bw + 16), y = 560 - (f ? 4 : 0);
      card(g, x, y, bw, 46, {
        lines: false, rot: f ? -0.02 : 0, color: f ? '#ffcf5a' : PAPER2,
        fn: (w, h) => txt(g, it.label.toUpperCase(), w / 2, h / 2 + 1, 18, INK, 'center', DISPLAY, 400),
      });
      G.buttons.push({ x, y, w: bw, h: 46, focus: i, action: () => G.activate(it) });
    });
  }

  function play(g, G) {
    R.draw(G.match, { hud: true, labels: G.labels() });
    // pause button, bottom right
    g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    const hs = R.hs, bx = R.W - 44 * hs, by = R.H - 22 * hs, r = 15 * hs;
    g.fillStyle = 'rgba(43,36,32,.75)'; g.beginPath(); g.arc(bx, by - 4 * hs, r, 0, TAU); g.fill();
    g.fillStyle = '#f6e8c6'; g.fillRect(bx - 6 * hs, by - 12 * hs, 4 * hs, 16 * hs); g.fillRect(bx + 2 * hs, by - 12 * hs, 4 * hs, 16 * hs);
    const p = UI.toDesign(bx - r * 1.4, by - r * 1.6), p2 = UI.toDesign(bx + r * 1.4, by + r);
    G.buttons.push({ x: p.x, y: p.y, w: p2.x - p.x, h: p2.y - p.y, action: () => G.pause() });
    // first seconds of a match: show each player's fire key above their tank
    const m = G.match;
    if (m.round === 1 && m.phase === 'countdown') {
      m.tanks.forEach((t) => {
        const seat = m.seats[t.i];
        if (seat.bot) return;
        const d = I.byId[seat.dev];
        if (!d) return;
        const x = R.ox + t.x * R.u, y = R.oy + t.y * R.u + R.u * 0.55;
        const label = d.kind === 'kb' ? d.label + ' · fire ' + d.caps.a : d.kind === 'pad' ? 'stick · fire A' : 'stick · FIRE';
        g.font = '700 ' + Math.round(12 * hs) + 'px ' + BODY;
        const w = g.measureText(label).width + 14 * hs;
        g.fillStyle = 'rgba(43,36,32,.85)'; rr(g, x - w / 2, y - 10 * hs, w, 20 * hs, 6 * hs); g.fill();
        txt(g, label, x, y + 0.5, 12 * hs, '#fff3d6', 'center', BODY, 700);
      });
    }
  }

  function toast(g, G) {
    const t = G.toastMsg;
    if (!t) return;
    begin(g);
    g.save(); g.globalAlpha = clamp(t.life / 0.3, 0, 1) * clamp((2.2 - t.life) / 0.15, 0, 1);
    const w = width(g, t.str, 16, BODY, 800) + 40;
    g.translate(DW / 2, G.screen === 'play' ? 96 : 26); g.rotate(-0.01);
    g.fillStyle = 'rgba(240,226,170,.95)'; g.fillRect(-w / 2, -16, w, 32);
    txt(g, t.str, 0, 1, 16, INK, 'center', BODY, 800);
    g.restore();
  }

  // Iris wipe between screens.
  function wipe(g, G) {
    if (G.fade <= 0.01) return;
    g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    const r = Math.hypot(R.W, R.H) * 0.6 * ease(1 - G.fade);
    g.fillStyle = '#1a0e06';
    g.beginPath(); g.rect(0, 0, R.W, R.H); g.arc(R.W / 2, R.H / 2, Math.max(1, r), 0, TAU, true); g.fill();
  }

  const UI = {
    toDesign(x, y) { layout(); return { x: (x - ox) / s, y: (y - oy) / s }; },
    hover(G, mo) {
      const p = this.toDesign(mo.x, mo.y);
      return G.buttons.some((b) => p.x >= b.x && p.y >= b.y && p.x <= b.x + b.w && p.y <= b.y + b.h);
    },
    draw(G) {
      const g = R.ctx;
      layout();
      // hovering a list row focuses it
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
      else if (scr === 'play') play(g, G);
      else if (scr === 'pause') pause(g, G);
      else if (scr === 'results') results(g, G);
      toast(g, G);
      wipe(g, G);
    },
  };
  BT.UI = UI;
})();
