// Jungle Getaway screens and HUD, drawn on the canvas in a carved-stone style:
// weathered tablets with gold inlay, moss, and chiselled lettering. Every
// interactive element registers a hit box on g.buttons each frame so mouse,
// touch, keyboard and gamepad drive the same menus.
(function (root) {
  'use strict';
  const I = root.JG.Input, R = root.JG.Rules;
  const DISPLAY = '"Metamorphous", "Palatino Linotype", "Book Antiqua", Georgia, serif';
  const BODY = '"Signika", "Trebuchet MS", "Segoe UI", sans-serif';
  const C = {
    gold: '#f1c24b', goldDeep: '#b8862a', ink: '#241d12', light: '#fff3d6', mute: '#e6d7b0',
    stone: '#8f8b74', stoneD: '#6b6855', moss: '#6f9a3a', danger: '#e2583e',
  };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeOut = (v) => 1 - Math.pow(1 - v, 3);
  const easeBack = (v) => 1 + 2.4 * Math.pow(v - 1, 3) + 1.4 * Math.pow(v - 1, 2);
  const enter = (g, d, dur) => easeOut(clamp01((g.stateT - (d || 0)) / (dur || 0.3)));
  const hash = (n) => { n = Math.imul(n ^ 0x5bd1e995, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; };

  function txt(ctx, s, x, y, size, color, align, font, weight) {
    ctx.font = `${weight || ''} ${size}px ${font || BODY}`;
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  function width(ctx, s, size, font, weight) { ctx.font = `${weight || ''} ${size}px ${font || BODY}`; return ctx.measureText(s).width; }

  // chiselled lettering: dark cut, gold face, light lip
  function carved(ctx, s, x, y, size, align, face) {
    ctx.font = `${size}px ${DISPLAY}`; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(20,14,6,0.85)'; ctx.fillText(s, x + size * 0.04, y + size * 0.07);
    ctx.fillStyle = '#fff1c0'; ctx.fillText(s, x - size * 0.02, y - size * 0.03);
    const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
    g.addColorStop(0, face || '#ffd970'); g.addColorStop(0.55, C.gold); g.addColorStop(1, '#a8701c');
    ctx.fillStyle = g; ctx.fillText(s, x, y);
  }

  // a weathered stone tablet
  function tablet(ctx, x, y, w, h, u, seed) {
    ctx.fillStyle = 'rgba(8,12,4,0.45)';
    ctx.beginPath(); ctx.roundRect(x + 6 * u, y + 10 * u, w, h, 10 * u); ctx.fill();
    const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
    g.addColorStop(0, '#a5a189'); g.addColorStop(1, '#75725f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10 * u); ctx.fill();
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = 'rgba(255,250,225,0.35)';
    ctx.beginPath(); ctx.moveTo(x + 8 * u, y + h - 4 * u); ctx.lineTo(x + 3 * u, y + 8 * u); ctx.lineTo(x + w - 8 * u, y + 3 * u); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,26,16,0.5)';
    ctx.beginPath(); ctx.moveTo(x + w - 3 * u, y + 10 * u); ctx.lineTo(x + w - 3 * u, y + h - 3 * u); ctx.lineTo(x + 10 * u, y + h - 3 * u); ctx.stroke();
    // carved inner border with gold inlay
    ctx.lineWidth = 2 * u; ctx.strokeStyle = '#55523f';
    ctx.strokeRect(x + 10 * u, y + 10 * u, w - 20 * u, h - 20 * u);
    ctx.lineWidth = 1 * u; ctx.strokeStyle = 'rgba(241,194,75,0.75)';
    ctx.strokeRect(x + 13 * u, y + 13 * u, w - 26 * u, h - 26 * u);
    ctx.fillStyle = C.gold;
    for (const [cx, cy] of [[x + 13 * u, y + 13 * u], [x + w - 13 * u, y + 13 * u], [x + 13 * u, y + h - 13 * u], [x + w - 13 * u, y + h - 13 * u]]) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(0.785); ctx.fillRect(-4 * u, -4 * u, 8 * u, 8 * u); ctx.restore();
    }
    // pits and specks in the stone
    ctx.fillStyle = 'rgba(50,46,34,0.35)';
    for (let i = 0; i < 26; i++) { const a = hash(seed * 97 + i), b = hash(seed * 31 + i * 7); ctx.fillRect(x + 16 * u + a * (w - 32 * u), y + 16 * u + b * (h - 32 * u), 2 * u, 2 * u); }
    // moss draped over the top edge
    ctx.fillStyle = '#5d8a2e';
    for (let i = 0; i < 6; i++) {
      const a = hash(seed * 13 + i);
      if (a > 0.6) continue;
      const mx = x + 20 * u + a * (w - 40 * u) * 1.6 % (w - 40 * u);
      ctx.beginPath(); ctx.ellipse(mx, y + 2 * u, (18 + a * 20) * u, 6 * u, 0, 0, 6.283); ctx.fill();
      ctx.fillRect(mx - 2 * u, y, 3 * u, (10 + a * 18) * u);
    }
  }

  function idolEye(ctx, x, y, r, lit) {
    ctx.fillStyle = lit ? C.gold : '#4f4b3b';
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x, y - r * 0.9, x + r, y); ctx.quadraticCurveTo(x, y + r * 0.9, x - r, y); ctx.fill();
    ctx.fillStyle = lit ? '#3b2410' : '#2c291f';
    ctx.beginPath(); ctx.arc(x, y, r * 0.32, 0, 6.283); ctx.fill();
  }
  function coinIcon(ctx, x, y, r) {
    ctx.fillStyle = '#a8761c'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(x - r * 0.08, y - r * 0.06, r * 0.82, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#b8862a'; ctx.fillRect(x - r * 0.22, y - r * 0.38, r * 0.44, r * 0.76);
  }

  // device-aware prompt glyphs
  const GLYPH = {
    jump: { keyboard: 'SPACE', gamepad: 'A', touch: 'SWIPE UP' },
    slide: { keyboard: '↓', gamepad: 'B', touch: 'SWIPE DOWN' },
    lanes: { keyboard: '← →', gamepad: 'D-PAD', touch: 'SWIPE ← →' },
    confirm: { keyboard: 'ENTER', gamepad: 'A', touch: 'TAP' },
    back: { keyboard: 'ESC', gamepad: 'B', touch: null },
    pause: { keyboard: 'ESC', gamepad: 'START', touch: null },
    restart: { keyboard: 'R', gamepad: 'Y', touch: null },
  };
  const glyph = (a) => GLYPH[a][I.device];
  function keycap(ctx, label, x, y, u, draw) {
    const size = 13 * u, h = size + 12 * u;
    const w = Math.max(h, width(ctx, label, size, BODY, 700) + 14 * u);
    if (draw === false) return w;
    ctx.fillStyle = '#3d3a2c'; ctx.beginPath(); ctx.roundRect(x, y - h / 2 + 2 * u, w, h, 5 * u); ctx.fill();
    ctx.fillStyle = '#a8a48b'; ctx.beginPath(); ctx.roundRect(x, y - h / 2, w, h - 2 * u, 5 * u); ctx.fill();
    txt(ctx, label, x + w / 2, y - 1 * u, size, C.ink, 'center', BODY, 700);
    return w;
  }
  function prompt(ctx, action, label, x, y, u, align) {
    const gl = glyph(action);
    if (!gl) return 0;
    const kw = keycap(ctx, gl, 0, 0, u, false), lw = width(ctx, label, 15 * u, BODY, 600);
    const total = kw + 8 * u + lw;
    const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    keycap(ctx, gl, x0, y, u);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4 * u;
    txt(ctx, label, x0 + kw + 8 * u, y, 15 * u, C.light, 'left', BODY, 600);
    ctx.restore();
    return total;
  }

  // a vertical list of carved slabs
  function list(ctx, g, items, x, y, w, u, rowH) {
    rowH = rowH || 54 * u;
    const h = rowH - 10 * u;
    items.forEach((it, i) => {
      const k = enter(g, 0.08 + i * 0.05, 0.3);
      const focused = g.focus === i;
      const ry = y + i * rowH;
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.translate((1 - k) * -30 * u, 0);
      const push = focused ? g.focusPop : 0;
      const sx = x + push * 6 * u;
      ctx.fillStyle = 'rgba(20,16,8,0.4)';
      ctx.beginPath(); ctx.roundRect(sx + 3 * u, ry + 5 * u, w, h, 6 * u); ctx.fill();
      const gr = ctx.createLinearGradient(0, ry, 0, ry + h);
      gr.addColorStop(0, focused ? '#6b5a32' : '#5d5a49'); gr.addColorStop(1, focused ? '#3f3218' : '#45432f');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(sx, ry, w, h, 6 * u); ctx.fill();
      ctx.lineWidth = (focused ? 2.5 : 1.2) * u;
      ctx.strokeStyle = focused ? C.gold : 'rgba(255,240,200,0.18)';
      ctx.stroke();
      if (focused) {
        idolEye(ctx, sx + 22 * u, ry + h / 2, 11 * u, true);
        ctx.fillStyle = 'rgba(241,194,75,0.12)'; ctx.fillRect(sx + 2 * u, ry + 2 * u, w - 4 * u, h - 4 * u);
      }
      const color = it.danger ? (focused ? '#ffb4a0' : '#d89a88') : focused ? C.light : C.mute;
      txt(ctx, it.label, sx + 44 * u, ry + h / 2 + 1 * u, 19 * u, color, 'left', DISPLAY);
      if (it.value) {
        const v = it.value();
        txt(ctx, v, sx + w - 18 * u, ry + h / 2, 16 * u, v === 'On' ? C.gold : C.mute, 'right', BODY, 700);
      }
      if (it.slider) {
        const v = it.slider(), nw = 11 * u, gap = 4 * u, bw = 10 * (nw + gap) - gap;
        const bx = sx + w - 50 * u - bw;
        for (let s = 0; s < 10; s++) {
          ctx.fillStyle = s < v ? (focused ? C.gold : '#a8843a') : 'rgba(0,0,0,0.35)';
          ctx.beginPath(); ctx.roundRect(bx + s * (nw + gap), ry + h / 2 - 7 * u, nw, 14 * u, 2 * u); ctx.fill();
        }
        txt(ctx, String(v), sx + w - 18 * u, ry + h / 2, 16 * u, C.light, 'right', BODY, 700);
        g.buttons.push({ x: bx - 34 * u, y: ry, w: 40 * u, h, focus: i, act: () => it.adjust(-1) });
        g.buttons.push({ x: bx + bw - 60 * u, y: ry, w: 100 * u, h, focus: i, act: () => it.adjust(1) });
      }
      ctx.restore();
      g.buttons.push({ x, y: ry, w, h, focus: i, act: () => g.activate(it) });
    });
  }

  function footer(ctx, g, u, backLabel) {
    if (I.device === 'touch') {
      if (!backLabel) return;
      // touch: a carved back button
      const bw = 120 * u, bh = 44 * u, bx = 16 * u, by = g.H - bh - 16 * u;
      ctx.fillStyle = '#4c4936'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8 * u); ctx.fill();
      ctx.strokeStyle = C.gold; ctx.lineWidth = 1.5 * u; ctx.stroke();
      txt(ctx, '‹ ' + backLabel, bx + bw / 2, by + bh / 2, 17 * u, C.light, 'center', DISPLAY);
      g.buttons.push({ x: bx, y: by, w: bw, h: bh, act: () => g.back() });
      return;
    }
    const y = g.H - 26 * u;
    let x = 22 * u;
    x += prompt(ctx, 'confirm', 'Choose', x, y, u) + 22 * u;
    if (backLabel) prompt(ctx, 'back', backLabel, x, y, u);
  }

  const UI = {
    DISPLAY, BODY, C, txt, carved, tablet, coinIcon, idolEye,
    scale(g) { return Math.max(0.6, Math.min(1.6, Math.min(g.W / 640, g.H / 660))); },

    // ---------------- title ----------------
    title(ctx, g) {
      const u = this.scale(g), W = g.W, H = g.H;
      const k = enter(g, 0, 0.6);
      // dark wash so the menu reads over the demo run
      const wash = ctx.createLinearGradient(0, 0, 0, H);
      wash.addColorStop(0, 'rgba(10,22,10,0.72)'); wash.addColorStop(0.5, 'rgba(10,22,10,0.25)'); wash.addColorStop(1, 'rgba(10,22,10,0.75)');
      ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H);
      const ty = Math.max(70 * u, H * 0.14);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(W / 2, ty + (1 - k) * -30 * u);
      const big = Math.min(76 * u, W * 0.12);
      ctx.rotate(-0.02);
      carved(ctx, 'JUNGLE', 0, 0, big, 'center');
      carved(ctx, 'GETAWAY', 0, big * 0.95, big * 0.82, 'center', '#ffe79a');
      ctx.rotate(0.02);
      // the idol between the words
      const bob = Math.sin(g.time * 2) * 4 * u;
      ctx.fillStyle = 'rgba(255,214,90,0.25)'; ctx.beginPath(); ctx.arc(0, big * 0.48 + bob, 22 * u, 0, 6.283); ctx.fill();
      coinIcon(ctx, 0, big * 0.48 + bob, 12 * u);
      txt(ctx, 'You took the idol. The boulder noticed.', 0, big * 1.65, 16 * u, C.mute, 'center', BODY, 600);
      ctx.restore();

      const items = g.menu();
      const w = Math.min(380 * u, W - 40 * u), rowH = 56 * u;
      const ly = Math.min(H - items.length * rowH - 90 * u, ty + Math.min(76 * u, W * 0.12) * 2.2 + 20 * u);
      list(ctx, g, items, (W - w) / 2, ly, w, u, rowH);

      // records
      const best = g.save.best, bank = g.save.bank, m = g.save.mission;
      const ry = Math.min(H - 64 * u, ly + items.length * rowH + 14 * u);
      ctx.globalAlpha = enter(g, 0.35, 0.4);
      const line = `Best ${best} m   ·   ${bank} coins banked`;
      txt(ctx, line, W / 2, ry, 15 * u, C.mute, 'center', BODY, 600);
      txt(ctx, m < R.MISSIONS.length ? 'Mission ' + (m + 1) + ': ' + R.MISSIONS[m][0] : 'Every mission complete', W / 2, ry + 22 * u, 14 * u, C.gold, 'center', BODY, 600);
      ctx.globalAlpha = 1;
      footer(ctx, g, u, null);
    },

    // ---------------- wardrobe ----------------
    wardrobe(ctx, g) {
      const u = this.scale(g), W = g.W, H = g.H;
      this.dim(ctx, g, 0.55);
      const w = Math.min(600 * u, W - 24 * u), h = Math.min(420 * u, H - 120 * u);
      const x = (W - w) / 2, y = (H - h) / 2 - 10 * u;
      this.pop(ctx, g, W / 2, H / 2, () => {
        tablet(ctx, x, y, w, h, u, 3);
        carved(ctx, 'WARDROBE', W / 2, y + 46 * u, 30 * u);
        const unlocked = R.hatsUnlocked(g.save.mission);
        const n = R.HATS.length, cw = (w - 60 * u) / n;
        R.HATS.forEach((hat, i) => {
          const cx = x + 30 * u + cw * i + cw / 2, cy = y + h * 0.5;
          const open = i < unlocked, sel = g.focus === i, worn = g.save.hat === i;
          const kk = enter(g, 0.1 + i * 0.06, 0.35);
          ctx.save(); ctx.globalAlpha = kk;
          ctx.fillStyle = sel ? 'rgba(241,194,75,0.22)' : 'rgba(0,0,0,0.2)';
          ctx.beginPath(); ctx.roundRect(cx - cw / 2 + 6 * u, cy - 80 * u, cw - 12 * u, 170 * u, 8 * u); ctx.fill();
          if (sel) { ctx.strokeStyle = C.gold; ctx.lineWidth = 2.5 * u; ctx.stroke(); }
          // a head wearing the hat
          const s = Math.min(cw / 50, 2.4 * u) * (sel ? 1 + g.focusPop * 0.08 : 1);
          ctx.save(); ctx.translate(cx, cy - 10 * u); ctx.scale(s, s);
          ctx.fillStyle = open ? '#e0a477' : '#3d3a2c'; ctx.beginPath(); ctx.arc(0, 4, 11, 0, 6.283); ctx.fill();
          ctx.fillStyle = open ? hat.color : '#2c291f';
          ctx.beginPath(); ctx.ellipse(0, -2, 20, 6, 0, 0, 6.283); ctx.fill();
          ctx.beginPath(); ctx.roundRect(-11, -16, 22, 14, [7, 7, 1, 1]); ctx.fill();
          ctx.fillStyle = open ? hat.band : '#24221a'; ctx.fillRect(-11, -7, 22, 3.5);
          ctx.restore();
          txt(ctx, open ? hat.name : 'Locked', cx, cy + 50 * u, Math.min(15 * u, cw * 0.13), open ? C.light : C.mute, 'center', DISPLAY);
          txt(ctx, open ? (worn ? 'Wearing' : 'Tap to wear') : `${i * 3} missions`, cx, cy + 72 * u, 12 * u, worn ? C.gold : C.mute, 'center', BODY, 600);
          ctx.restore();
          g.buttons.push({ x: cx - cw / 2, y: cy - 80 * u, w: cw, h: 170 * u, focus: i, act: () => g.wear(i) });
        });
        txt(ctx, 'Every third mission unlocks a new hat.', W / 2, y + h - 34 * u, 14 * u, C.ink, 'center', BODY, 600);
      });
      footer(ctx, g, u, 'Back');
    },

    // ---------------- how to play ----------------
    how(ctx, g) {
      const u = this.scale(g), W = g.W, H = g.H;
      this.dim(ctx, g, 0.6);
      const w = Math.min(640 * u, W - 20 * u), h = Math.min(520 * u, H - 90 * u);
      const x = (W - w) / 2, y = (H - h) / 2 - 12 * u;
      this.pop(ctx, g, W / 2, H / 2, () => {
        tablet(ctx, x, y, w, h, u, 7);
        carved(ctx, 'HOW TO RUN', W / 2, y + 44 * u, 28 * u);
        const rows = [
          ['Change lane', '← → / A D', 'D-pad / stick', 'Swipe left / right'],
          ['Jump (twice in the air)', '↑ / W / Space', 'A', 'Swipe up or tap'],
          ['Slide / drop fast', '↓ / S', 'B or X', 'Swipe down'],
          ['Pause', 'Esc / P', 'Start', 'Pause stone'],
          ['Quick restart', 'R', 'Y', 'Pause menu'],
        ];
        const narrow = w < 520 * u;
        const col = I.device === 'gamepad' ? 2 : I.device === 'touch' ? 3 : 1;
        let ry = y + 86 * u;
        const fs = 14.5 * u;
        rows.forEach((r, i) => {
          ctx.globalAlpha = enter(g, 0.1 + i * 0.04);
          txt(ctx, r[0], x + 30 * u, ry, fs, C.ink, 'left', BODY, 700);
          if (narrow) txt(ctx, r[col], x + w - 30 * u, ry, fs, '#3d2b10', 'right', BODY, 600);
          else {
            txt(ctx, r[1], x + w * 0.46, ry, fs, col === 1 ? '#3d2b10' : '#55513f', 'left', BODY, col === 1 ? 700 : 500);
            txt(ctx, r[col === 1 ? 3 : col], x + w - 30 * u, ry, fs, '#3d2b10', 'right', BODY, 700);
          }
          ry += 27 * u;
        });
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(40,34,20,0.5)'; ctx.fillRect(x + 30 * u, ry, w - 60 * u, 2 * u);
        ry += 22 * u;
        const rules = [
          'Jump logs, slide under branches, and leap the pits. Dodge into another lane when only part of the path is blocked.',
          'Each stumble lets the boulder roll closer. Stumble twice and it catches you. Ten clean seconds and it falls back.',
          'Watch for its shadow creeping up the path and the rumble getting louder.',
          'One mission at a time. Every third mission unlocks a hat in the Wardrobe. Coins are banked after every run.',
        ];
        for (const r of rules) {
          const lines = wrap(ctx, r, w - 80 * u, 14 * u);
          ctx.fillStyle = C.goldDeep; ctx.fillRect(x + 32 * u, ry - 3 * u, 6 * u, 6 * u);
          for (const l of lines) { if (ry < y + h - 24 * u) txt(ctx, l, x + 48 * u, ry, 14 * u, C.ink, 'left', BODY, 500); ry += 19 * u; }
          ry += 6 * u;
        }
      });
      footer(ctx, g, u, 'Back');
    },

    // ---------------- settings ----------------
    settings(ctx, g) {
      const u = this.scale(g), W = g.W, H = g.H;
      this.dim(ctx, g, 0.6);
      const items = g.menu();
      const rowH = Math.min(52 * u, (H - 150 * u) / items.length);
      const w = Math.min(520 * u, W - 20 * u), h = 100 * u + items.length * rowH;
      const x = (W - w) / 2, y = Math.max(10 * u, (H - h) / 2 - 10 * u);
      this.pop(ctx, g, W / 2, H / 2, () => {
        tablet(ctx, x, y, w, h, u, 11);
        carved(ctx, 'SETTINGS', W / 2, y + 44 * u, 28 * u);
        list(ctx, g, items, x + 24 * u, y + 76 * u, w - 48 * u, u, rowH);
      });
      footer(ctx, g, u, 'Back');
    },

    // ---------------- in play ----------------
    hud(ctx, g) {
      const u = this.scale(g), W = g.W, sim = g.sim;
      const k = enter(g, 0, 0.4);
      ctx.save();
      ctx.globalAlpha = k;
      // distance tablet
      const tw = 170 * u, th = 78 * u, tx = 14 * u, ty = 20 * u;
      tablet(ctx, tx, ty, tw, th, u * 0.7, 1);
      ctx.save(); ctx.translate(tx + 24 * u, ty + 30 * u);
      const pulse = g.mPulse > 0 ? 1 + g.mPulse * 0.25 : 1;
      ctx.scale(pulse, pulse);
      txt(ctx, sim.run.m + ' m', 0, 0, 28 * u, C.ink, 'left', BODY, 700);
      ctx.restore();
      coinIcon(ctx, tx + 32 * u, ty + 57 * u, 9 * u);
      const cs = g.cPulse > 0 ? 1 + g.cPulse * 0.4 : 1;
      txt(ctx, String(sim.run.coins), tx + 48 * u, ty + 58 * u, 18 * u * cs, '#5a3d0c', 'left', BODY, 700);
      // mission under it
      if (g.settings.hints && g.save.mission < R.MISSIONS.length) {
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 5 * u;
        txt(ctx, R.MISSIONS[g.save.mission][0], tx + 4 * u, ty + th + 18 * u, 13.5 * u, C.mute, 'left', BODY, 600);
        ctx.restore();
      }
      // pause stone
      const pr = 26 * u, px = W - pr - 16 * u, py = ty + pr + 4 * u;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(px + 3 * u, py + 4 * u, pr, 0, 6.283); ctx.fill();
      ctx.fillStyle = C.stone; ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.283); ctx.fill();
      ctx.strokeStyle = C.gold; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.arc(px, py, pr - 5 * u, 0, 6.283); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.fillRect(px - 8 * u, py - 10 * u, 6 * u, 20 * u); ctx.fillRect(px + 2 * u, py - 10 * u, 6 * u, 20 * u);
      g.buttons.push({ x: px - pr - 10 * u, y: py - pr - 10 * u, w: pr * 2 + 20 * u, h: pr * 2 + 20 * u, act: () => g.pause() });
      if (I.device !== 'touch') prompt(ctx, 'pause', '', px - pr - 6 * u, py + pr + 18 * u, u * 0.8, 'right');

      // chase meter: the boulder's carved token and yours
      const mw = Math.min(300 * u, W * 0.6), mh = 26 * u, mx = (W - mw) / 2, my = g.H - mh - 22 * u;
      ctx.fillStyle = 'rgba(20,16,8,0.6)'; ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, mh / 2); ctx.fill();
      ctx.strokeStyle = 'rgba(241,194,75,0.6)'; ctx.lineWidth = 1.5 * u; ctx.stroke();
      const gap = sim.gap;
      const danger = clamp01((1 - gap) / 0.65);
      const fill = ctx.createLinearGradient(mx, 0, mx + mw, 0);
      fill.addColorStop(0, '#e2583e'); fill.addColorStop(1, 'rgba(226,88,62,0)');
      ctx.fillStyle = fill; ctx.globalAlpha = k * (0.3 + danger * 0.7);
      ctx.beginPath(); ctx.roundRect(mx + 2 * u, my + 2 * u, (mw - 4 * u) * (0.25 + danger * 0.6), mh - 4 * u, mh / 2); ctx.fill();
      ctx.globalAlpha = k;
      // boulder token (rolls)
      ctx.save(); ctx.translate(mx + mh / 2, my + mh / 2); ctx.rotate(g.time * 6);
      ctx.fillStyle = '#7d766a'; ctx.beginPath(); ctx.arc(0, 0, mh * 0.62, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#3a342b'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(-mh * 0.4, 0); ctx.lineTo(mh * 0.4, 0); ctx.stroke();
      ctx.restore();
      const rx = mx + mh + (mw - mh * 2) * (0.25 + 0.75 * clamp01((gap - 0.3) / 0.7));
      ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(rx, my + mh / 2, mh * 0.42, 0, 6.283); ctx.fill();
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(rx, my + mh / 2 - 2 * u, mh * 0.18, 0, 6.283); ctx.fill();
      // stumble eyes: lit = safe
      for (let i = 0; i < 2; i++) idolEye(ctx, mx + mw - 26 * u - i * 26 * u, my - 14 * u, 9 * u, sim.stumbles <= i ? true : false);
      if (sim.stumbles > 0) {
        // recovering: ring fills over ten clean seconds
        const fr = clamp01(sim.calm / 10);
        ctx.strokeStyle = C.gold; ctx.lineWidth = 2.5 * u;
        ctx.beginPath(); ctx.arc(mx + mw - 26 * u, my - 14 * u, 13 * u, -1.57, -1.57 + fr * 6.283); ctx.stroke();
      }
      ctx.restore();

      // warning banner
      if (sim.stumbles > 0 && sim.state === 'playing') {
        const a = 0.6 + Math.sin(g.time * 8) * 0.4;
        ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8 * u;
        txt(ctx, 'IT\'S GAINING!  One more stumble…', W / 2, my - 40 * u, 17 * u, '#ffcf9a', 'center', DISPLAY);
        ctx.restore();
      }

      // first-run hints
      if (g.settings.hints && g.playT < 7 && sim.state === 'playing' && g.rearT <= 0) {
        const a = clamp01(Math.min(g.playT - 0.5, 7 - g.playT));
        ctx.save(); ctx.globalAlpha = a;
        const y = g.H * 0.2;
        const lines = [['lanes', 'Change lane'], ['jump', 'Jump'], ['slide', 'Slide']];
        lines.forEach(([act, label], i) => prompt(ctx, act, label, W / 2, y + i * 34 * u, u, 'center'));
        ctx.restore();
      }
    },

    ready(ctx, g) {
      const u = this.scale(g), W = g.W, H = g.H;
      const k = enter(g, 0.9, 0.4);
      if (k <= 0) return;
      ctx.save(); ctx.globalAlpha = k;
      const pulse = 0.75 + 0.25 * Math.sin(g.time * 5);
      ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 10 * u;
      carved(ctx, 'RUN!', W / 2, H * 0.36, 64 * u * (0.95 + pulse * 0.05));
      ctx.shadowBlur = 0;
      const y = H * 0.36 + 58 * u;
      if (I.device === 'touch') txt(ctx, 'Swipe up or tap to start', W / 2, y, 18 * u, C.light, 'center', BODY, 700);
      else prompt(ctx, 'jump', 'to start running', W / 2, y, u, 'center');
      if (g.save.mission < R.MISSIONS.length) {
        ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 6 * u;
        txt(ctx, 'Mission: ' + R.MISSIONS[g.save.mission][0], W / 2, y + 36 * u, 15 * u, C.gold, 'center', BODY, 700);
      }
      ctx.restore();
    },

    rearLabel(ctx, g, k) {
      const u = this.scale(g);
      ctx.save(); ctx.globalAlpha = k; ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6 * u;
      txt(ctx, 'BEHIND YOU', g.W / 2, Math.max(60, g.H * 0.1) - 18 * u - (1 - k) * 90, 14 * u, '#ffcf9a', 'center', DISPLAY);
      ctx.restore();
    },

    // ---------------- overlays ----------------
    paused(ctx, g) {
      const u = this.scale(g), W = g.W, H = g.H;
      this.dim(ctx, g, 0.6);
      const items = g.menu();
      const rowH = 54 * u;
      const w = Math.min(420 * u, W - 24 * u), h = 120 * u + items.length * rowH;
      const x = (W - w) / 2, y = (H - h) / 2;
      this.pop(ctx, g, W / 2, H / 2, () => {
        tablet(ctx, x, y, w, h, u, 5);
        carved(ctx, 'PAUSED', W / 2, y + 44 * u, 30 * u);
        txt(ctx, g.sim.run.m + ' m  ·  ' + g.sim.run.coins + ' coins', W / 2, y + 76 * u, 14 * u, C.ink, 'center', BODY, 700);
        list(ctx, g, items, x + 26 * u, y + 96 * u, w - 52 * u, u, rowH);
      });
      footer(ctx, g, u, 'Resume');
    },

    results(ctx, g) {
      const u = this.scale(g), W = g.W, H = g.H, r = g.result;
      const a = clamp01(g.stateT / 0.35);
      ctx.fillStyle = `rgba(14,10,4,${0.55 * a})`; ctx.fillRect(0, 0, W, H);
      const items = g.menu();
      const rowH = 52 * u;
      const w = Math.min(480 * u, W - 20 * u), h = 290 * u + items.length * rowH;
      const x = (W - w) / 2, y = Math.max(8 * u, (H - h) / 2);
      this.pop(ctx, g, W / 2, H / 2, () => {
        tablet(ctx, x, y, w, h, u, 9);
        carved(ctx, r.fell ? 'SWALLOWED BY THE PIT' : 'FLATTENED!', W / 2, y + 46 * u, Math.min(30 * u, w / 14), 'center');
        // stats count up
        const t = clamp01((g.stateT - 0.3) / 0.9);
        const rows = [['Distance', Math.round(r.m * easeOut(t)) + ' m'], ['Coins', String(Math.round(r.coins * easeOut(t)))], ['Best', r.best + ' m']];
        rows.forEach(([l, v], i) => {
          const ry = y + 90 * u + i * 30 * u;
          txt(ctx, l, x + 44 * u, ry, 16 * u, '#3d3622', 'left', BODY, 600);
          txt(ctx, v, x + w - 44 * u, ry, 20 * u, C.ink, 'right', BODY, 700);
        });
        if (r.newBest && g.stateT > 1.2) {
          const s = easeBack(clamp01((g.stateT - 1.2) / 0.35));
          ctx.save(); ctx.translate(x + w - 70 * u, y + 66 * u); ctx.rotate(0.12); ctx.scale(s, s);
          ctx.fillStyle = '#b8402a'; ctx.beginPath(); ctx.roundRect(-46 * u, -13 * u, 92 * u, 26 * u, 4 * u); ctx.fill();
          txt(ctx, 'NEW BEST', 0, 0, 14 * u, '#fff3d6', 'center', DISPLAY);
          ctx.restore();
        }
        // mission banner
        const my = y + 196 * u;
        const done = r.missionDone;
        ctx.fillStyle = done ? 'rgba(241,194,75,0.35)' : 'rgba(0,0,0,0.18)';
        ctx.beginPath(); ctx.roundRect(x + 30 * u, my - 26 * u, w - 60 * u, 64 * u, 6 * u); ctx.fill();
        if (done) {
          const s = easeBack(clamp01((g.stateT - 1.4) / 0.4));
          ctx.save(); ctx.translate(W / 2, my - 6 * u); ctx.scale(s, s);
          txt(ctx, 'Mission complete: ' + done, 0, 0, 15 * u, '#3b2a08', 'center', BODY, 700);
          ctx.restore();
          txt(ctx, r.hat ? 'New hat unlocked: ' + R.HATS[R.hatsUnlocked(r.mission) - 1].name + '!' : r.next, W / 2, my + 20 * u, 14 * u, r.hat ? '#7a2a10' : '#3d3622', 'center', BODY, 700);
        } else {
          txt(ctx, 'Mission', W / 2, my - 8 * u, 13 * u, '#4f4733', 'center', BODY, 600);
          txt(ctx, r.next, W / 2, my + 16 * u, 15 * u, C.ink, 'center', BODY, 700);
        }
        list(ctx, g, items, x + 30 * u, y + 262 * u, w - 60 * u, u, rowH);
      });
      if (I.device !== 'touch') prompt(ctx, 'restart', 'Run again', W / 2, H - 26 * u, u, 'center');
    },

    toast(ctx, g) {
      const m = g.toastMsg;
      if (!m) return;
      const u = this.scale(g);
      const a = clamp01(m.life / 0.3) * clamp01((m.max - m.life) / 0.2);
      ctx.save(); ctx.globalAlpha = a;
      const w = width(ctx, m.s, 16 * u, DISPLAY) + 40 * u, h = 38 * u;
      const x = (g.W - w) / 2, y = g.H * 0.2 + (1 - a) * -12 * u;
      ctx.fillStyle = '#3d3a2c'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 6 * u); ctx.fill();
      ctx.strokeStyle = C.gold; ctx.lineWidth = 1.5 * u; ctx.stroke();
      txt(ctx, m.s, g.W / 2, y + h / 2 + 1 * u, 16 * u, C.gold, 'center', DISPLAY);
      ctx.restore();
    },

    dim(ctx, g, a) {
      ctx.fillStyle = `rgba(8,14,6,${a * enter(g, 0, 0.2)})`;
      ctx.fillRect(0, 0, g.W, g.H);
    },
    pop(ctx, g, cx, cy, fn) {
      const k = clamp01(g.stateT / 0.32);
      const s = 0.86 + 0.14 * easeBack(k);
      ctx.save();
      ctx.globalAlpha *= easeOut(k);
      ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
      fn();
      ctx.restore();
    },
  };

  function wrap(ctx, s, maxW, size) {
    const words = s.split(' '), out = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (width(ctx, t, size, BODY, 500) > maxW && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out;
  }

  root.JG.UI = UI;
})(window);
