// Widgets and screens, all drawn on the canvas in the workshop style: riveted
// steel plates, hazard tape, stencil type, flip switches and faders.
// Widgets register hit boxes on g.buttons every frame; game.js turns mouse,
// touch, keyboard and gamepad input into focus moves and presses on them, so
// every device drives the same menus.
(function () {
  const KR = window.KR;
  const W = 960, H = 540;
  const FONT = '"Bungee", "Impact", "Arial Black", sans-serif';
  const BODY = '"Barlow Condensed", "Arial Narrow", "Segoe UI", sans-serif';
  const C = {
    ink: '#f2ead8', mute: 'rgba(242,234,216,0.62)', faint: 'rgba(242,234,216,0.32)',
    yellow: '#ffc21a', black: '#16130f', steel: '#3c4350', steel2: '#4d5563', steelHi: '#6a7383', rust: '#e8571c', red: '#d7263d', green: '#16c79a',
  };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const back = (t) => { t = clamp(t, 0, 1); return 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2); };

  function text(ctx, s, x, y, size, col, align, font, o) {
    ctx.font = (o && o.weight ? o.weight + ' ' : '') + size + 'px ' + (font || FONT);
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    if (o && o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(s, x + (o.sx || 2), y + (o.sy || 3)); }
    ctx.fillStyle = col;
    ctx.fillText(s, x, y, o && o.max ? o.max : undefined);
  }
  function measure(ctx, s, size, font, weight) {
    ctx.font = (weight ? weight + ' ' : '') + size + 'px ' + (font || FONT);
    return ctx.measureText(s).width;
  }
  function wrap(ctx, s, maxW, size, font) {
    const words = s.split(' '), lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (measure(ctx, t, size, font || BODY, 600) > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }
  function skewRect(ctx, x, y, w, h, k) {
    ctx.beginPath(); ctx.moveTo(x + k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - k, y + h); ctx.lineTo(x, y + h); ctx.closePath();
  }
  function bolt(ctx, x, y, r) {
    ctx.fillStyle = '#20242b'; ctx.beginPath(); ctx.arc(x, y + 0.8, r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#9aa3ae'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#4a515c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.2); ctx.lineTo(x + r * 0.6, y + r * 0.2); ctx.stroke();
  }
  // hazard tape strip
  function hazard(ctx, x, y, w, h, off) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = C.yellow; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.black;
    const st = h * 1.4;
    for (let i = -2; i < w / st + 2; i++) {
      const sx = x + i * st * 2 + ((off || 0) % (st * 2));
      ctx.beginPath(); ctx.moveTo(sx, y + h); ctx.lineTo(sx + st, y + h); ctx.lineTo(sx + st * 2, y); ctx.lineTo(sx + st, y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // a riveted steel plate panel
  let brushed = null;
  function brushedTex() {
    if (brushed) return brushed;
    brushed = document.createElement('canvas'); brushed.width = 256; brushed.height = 256;
    const g = brushed.getContext('2d');
    g.fillStyle = C.steel; g.fillRect(0, 0, 256, 256);
    const r = KR.util.rng(5);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + r() * 0.04})`; g.fillRect(r() * 256, r() * 256, 20 + r() * 80, 1); }
    return brushed;
  }
  function panel(ctx, x, y, w, h, title, o) {
    o = o || {};
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(x + 8, y + 10, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const pat = ctx.createPattern(brushedTex(), 'repeat');
    ctx.fillStyle = pat; ctx.fillRect(x, y, w, h);
    const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.strokeStyle = '#20242b'; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
    for (const [bx, by] of [[x + 12, y + 12], [x + w - 12, y + 12], [x + 12, y + h - 12], [x + w - 12, y + h - 12]]) bolt(ctx, bx, by, 4);
    if (title) {
      hazard(ctx, x, y, w, 8, o.t ? o.t * 20 : 0);
      text(ctx, title, x + 26, y + 34, o.size || 24, C.yellow, 'left', FONT, { shadow: 'rgba(0,0,0,0.5)' });
    }
  }

  // ---------- interactive widgets ----------
  // Every widget: g.reg({ id, x, y, w, h, action, adjust }) then draws itself
  // with g.isFocus(id) for the focus look.
  function button(ctx, g, id, x, y, w, h, label, o) {
    o = o || {};
    const f = g.isFocus(id), dis = o.disabled;
    const pr = g.pressFx(id);
    g.reg({ id, x, y, w, h, action: dis ? () => KR.Audio.play('deny') : o.action, adjust: o.adjust });
    const k = o.skew === undefined ? 12 : o.skew;
    ctx.save();
    const lift = f ? -2 : 0;
    ctx.translate(0, lift + pr * 3);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; skewRect(ctx, x + 4, y + 6 - lift, w, h, k); ctx.fill();
    skewRect(ctx, x, y, w, h, k);
    ctx.fillStyle = dis ? '#2a2e36' : f ? (o.danger ? C.red : o.color || C.yellow) : o.primary ? '#4d4220' : C.steel2;
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = f ? '#fff6d0' : 'rgba(0,0,0,0.5)'; ctx.stroke();
    if (!f && !dis) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; skewRect(ctx, x + 3, y + 3, w - 6, h * 0.38, k * 0.4); ctx.fill(); }
    if (o.primary && !f && !dis) { ctx.save(); skewRect(ctx, x, y, w, h, k); ctx.clip(); hazard(ctx, x, y + h - 6, w, 6, g.time * 30); ctx.restore(); }
    const tc = dis ? C.faint : f ? (o.danger ? '#fff' : C.black) : C.ink;
    const size = o.size || Math.min(20, h * 0.42);
    text(ctx, label, x + w / 2 + (o.icon ? 10 : 0), y + h / 2 + 1, size, tc, 'center', o.font || FONT, { max: w - 24 });
    if (o.sub) text(ctx, o.sub, x + w / 2, y + h - 12, 12, f ? 'rgba(22,19,15,0.7)' : C.mute, 'center', BODY, { weight: 600 });
    if (o.value !== undefined) text(ctx, o.value, x + w - 22, y + h / 2 + 1, size * 0.85, f ? C.black : C.yellow, 'right', FONT);
    if (f) { // focus chevrons
      ctx.fillStyle = o.danger ? C.red : C.yellow;
      const cy = y + h / 2;
      ctx.beginPath(); ctx.moveTo(x - 16 + Math.sin(g.time * 8) * 2, cy - 8); ctx.lineTo(x - 6 + Math.sin(g.time * 8) * 2, cy); ctx.lineTo(x - 16 + Math.sin(g.time * 8) * 2, cy + 8); ctx.fill();
    }
    ctx.restore();
  }

  // a fader: label on the left, a slotted track with a knob and ten notches
  function slider(ctx, g, id, x, y, w, label, value, adjust) {
    const f = g.isFocus(id), h = 44;
    g.reg({ id, x, y, w, h, action: () => adjust(1, true), adjust, slider: { x: x + 190, w: w - 250, set: (v) => adjust(v - value) } });
    if (f) { ctx.fillStyle = 'rgba(255,194,26,0.14)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = C.yellow; ctx.fillRect(x, y, 4, h); }
    text(ctx, label, x + 18, y + h / 2, 16, f ? C.ink : C.mute, 'left', FONT);
    const tx = x + 190, tw = w - 250, ty = y + h / 2;
    ctx.fillStyle = '#121418'; ctx.fillRect(tx, ty - 4, tw, 8);
    ctx.fillStyle = C.yellow; ctx.fillRect(tx, ty - 2, tw * (value / 10), 4);
    for (let i = 0; i <= 10; i++) { ctx.fillStyle = i <= value ? C.yellow : 'rgba(255,255,255,0.2)'; ctx.fillRect(tx + (tw * i) / 10 - 1, ty + 8, 2, i % 5 ? 4 : 8); }
    const kx = tx + (tw * value) / 10;
    ctx.fillStyle = '#20242b'; ctx.fillRect(kx - 9, ty - 15, 18, 30);
    ctx.fillStyle = f ? '#fff1b8' : '#b8bec8'; ctx.fillRect(kx - 7, ty - 13, 14, 26);
    ctx.fillStyle = '#20242b'; ctx.fillRect(kx - 6, ty - 1, 12, 2);
    text(ctx, String(value), x + w - 18, y + h / 2, 18, f ? C.yellow : C.mute, 'right', FONT);
  }

  // a flip switch with a lamp
  function toggle(ctx, g, id, x, y, w, label, on, flip, o) {
    o = o || {};
    const f = g.isFocus(id), h = 44;
    g.reg({ id, x, y, w, h, action: flip, adjust: () => flip() });
    if (f) { ctx.fillStyle = 'rgba(255,194,26,0.14)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = C.yellow; ctx.fillRect(x, y, 4, h); }
    text(ctx, label, x + 18, y + h / 2, 16, f ? C.ink : C.mute, 'left', FONT);
    const sx = x + w - 130, cy = y + h / 2;
    ctx.fillStyle = '#121418'; ctx.fillRect(sx, cy - 13, 56, 26);
    ctx.fillStyle = '#2a2e36'; ctx.fillRect(sx + 2, cy - 11, 52, 22);
    const kx = on ? sx + 30 : sx + 4;
    ctx.fillStyle = '#9aa3ae'; ctx.fillRect(kx, cy - 9, 22, 18);
    ctx.fillStyle = '#c9ccd1'; ctx.fillRect(kx + 2, cy - 7, 18, 5);
    ctx.fillStyle = on ? C.green : '#4a1c1c'; ctx.beginPath(); ctx.arc(sx + 74, cy, 6, 0, 6.283); ctx.fill();
    if (on) { ctx.fillStyle = 'rgba(22,199,154,0.3)'; ctx.beginPath(); ctx.arc(sx + 74, cy, 11, 0, 6.283); ctx.fill(); }
    text(ctx, o.labels ? (on ? o.labels[1] : o.labels[0]) : on ? 'ON' : 'OFF', x + w - 16, cy, 14, on ? C.green : C.mute, 'right', FONT);
  }

  // device-aware prompt glyphs
  const GLYPH = {
    confirm: { keyboard: 'ENTER', gamepad: 'A' }, back: { keyboard: 'ESC', gamepad: 'B' }, nav: { keyboard: '←↑→↓', gamepad: 'D-PAD' },
    tabs: { keyboard: 'Q / E', gamepad: 'LB / RB' }, pause: { keyboard: 'ESC', gamepad: 'START' }, restart: { keyboard: 'R', gamepad: 'Y' },
    rotate: { keyboard: 'DRAG', gamepad: 'R-STICK' },
  };
  function keycap(ctx, s, x, y) {
    const w = Math.max(24, measure(ctx, s, 12, FONT) + 14);
    ctx.fillStyle = '#0e0c0a'; ctx.fillRect(x, y - 11 + 2, w, 22);
    ctx.fillStyle = '#e8e2d0'; ctx.fillRect(x, y - 11, w, 20);
    ctx.fillStyle = '#c9c1aa'; ctx.fillRect(x, y + 6, w, 3);
    text(ctx, s, x + w / 2, y - 1, 12, C.black, 'center', FONT);
    return w;
  }
  function prompts(ctx, list, x, y, align) {
    const dev = KR.Input.device === 'gamepad' ? 'gamepad' : KR.Input.device === 'touch' ? null : 'keyboard';
    if (!dev) return;
    const items = list.map(([a, label]) => [GLYPH[a][dev], label]).filter((p) => p[0]);
    let total = 0;
    for (const [gl, l] of items) total += Math.max(24, measure(ctx, gl, 12, FONT) + 14) + 8 + measure(ctx, l, 15, BODY, 600) + 22;
    let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    for (const [gl, l] of items) {
      cx += keycap(ctx, gl, cx, y) + 8;
      text(ctx, l, cx, y, 15, C.mute, 'left', BODY, { weight: 600 });
      cx += measure(ctx, l, 15, BODY, 600) + 22;
    }
  }

  // ---------- the roller-shutter transition ----------
  let shutterTex = null;
  function shutter(ctx, amount, t) {
    if (amount <= 0) return;
    if (!shutterTex) {
      shutterTex = document.createElement('canvas'); shutterTex.width = 32; shutterTex.height = 36;
      const g = shutterTex.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 36); gr.addColorStop(0, '#6c7482'); gr.addColorStop(0.5, '#8a93a1'); gr.addColorStop(0.85, '#4a515c'); gr.addColorStop(1, '#2a2e36');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 36);
    }
    const h = H * easeOut(amount);
    ctx.save();
    ctx.fillStyle = ctx.createPattern(shutterTex, 'repeat');
    ctx.fillRect(0, 0, W, h);
    hazard(ctx, 0, h - 22, W, 22, t * 40);
    ctx.fillStyle = '#16130f'; ctx.fillRect(0, h - 4, W, 4);
    if (amount > 0.6) { ctx.globalAlpha = (amount - 0.6) / 0.4; text(ctx, 'KITBASH RALLY', W / 2, h / 2, 40, 'rgba(22,19,15,0.55)', 'center', FONT); }
    ctx.restore();
  }

  // ---------- logo ----------
  function logo(ctx, x, y, s, t) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.rotate(-0.06);
    // chequered streamer behind
    for (let c = 0; c < 26; c++) for (let r = 0; r < 2; r++) { ctx.fillStyle = (c + r) % 2 ? '#16130f' : '#f2ead8'; ctx.fillRect(-10 + c * 18 + Math.sin(t * 3 + c * 0.4) * 2, 92 + r * 14 + Math.sin(t * 3 + c * 0.5) * 3, 18, 14); }
    text(ctx, 'KITBASH', 6, 22, 74, C.black, 'left', FONT);
    text(ctx, 'KITBASH', 0, 16, 74, C.yellow, 'left', FONT);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 30, 420, 30); ctx.clip(); text(ctx, 'KITBASH', 0, 16, 74, '#ffdd6e', 'left', FONT); ctx.restore();
    skewRect(ctx, 70, 52, 300, 46, 16); ctx.fillStyle = C.red; ctx.fill();
    text(ctx, 'R A L L Y', 222, 77, 36, '#fff', 'center', FONT);
    ctx.restore();
  }

  KR.UI = { W, H, FONT, BODY, C, text, measure, wrap, skewRect, bolt, hazard, panel, button, slider, toggle, prompts, keycap, shutter, logo, easeOut, back, clamp };
})();
