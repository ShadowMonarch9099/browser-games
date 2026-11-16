// Courier Sprint screens and HUD: a bold courier brand. Tall condensed
// headlines, hard-edged orange slabs, shipping labels with barcodes, a
// dispatch-board main menu down the left edge, a side-sliding break panel and
// a thermal-printed delivery receipt for results.
(function (root) {
  'use strict';
  const I = root.CS.Input;
  const HEAD = '"Anton", "Impact", "Arial Narrow Bold", sans-serif';
  const BODY = '"Space Grotesk", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
  const C = { orange: '#ff6a1a', ink: '#101828', paper: '#f4efe6', yellow: '#ffd23f', mute: '#6b7280', blue: '#2f8bff', red: '#e5383b' };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeOut = (v) => 1 - Math.pow(1 - v, 3);
  const easeBack = (v) => 1 + 2.5 * Math.pow(v - 1, 3) + 1.5 * Math.pow(v - 1, 2);
  const enter = (g, d, dur) => easeOut(clamp01((g.stateT - (d || 0)) / (dur || 0.3)));

  function txt(ctx, s, x, y, size, color, align, font, weight, spacing) {
    ctx.font = `${weight || ''} ${size}px ${font || BODY}`;
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    if (spacing && 'letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
    ctx.fillStyle = color; ctx.fillText(s, x, y);
    if (spacing && 'letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  const width = (ctx, s, size, font, weight) => { ctx.font = `${weight || ''} ${size}px ${font || BODY}`; return ctx.measureText(s).width; };

  function barcode(ctx, x, y, w, h, seed) {
    ctx.fillStyle = C.ink;
    let cx = x, n = seed;
    while (cx < x + w) {
      n = (Math.imul(n, 1103515245) + 12345) >>> 0;
      const bw = 1 + (n >>> 28) % 3;
      if ((n >>> 20) & 1) ctx.fillRect(cx, y, Math.min(bw, x + w - cx), h);
      cx += bw + 1;
    }
  }
  // a shipping label card with a hard offset shadow
  function label(ctx, x, y, w, h, u, accent) {
    ctx.fillStyle = accent || C.orange; ctx.fillRect(x + 8 * u, y + 8 * u, w, h);
    ctx.fillStyle = C.paper; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3 * u; ctx.strokeRect(x, y, w, h);
  }

  const GLYPH = {
    jump: { keyboard: '↑', gamepad: 'A', touch: 'SWIPE ↑' },
    roll: { keyboard: '↓', gamepad: 'B', touch: 'SWIPE ↓' },
    lanes: { keyboard: '← →', gamepad: 'D-PAD', touch: 'SWIPE ← →' },
    confirm: { keyboard: 'ENTER', gamepad: 'A', touch: null },
    back: { keyboard: 'ESC', gamepad: 'B', touch: null },
    pause: { keyboard: 'ESC', gamepad: 'START', touch: null },
    restart: { keyboard: 'R', gamepad: 'Y', touch: null },
  };
  const glyph = (a) => GLYPH[a][I.device];
  function chip(ctx, gl, x, y, u, dark) {
    const size = 12 * u, h = size + 12 * u;
    const w = Math.max(h, width(ctx, gl, size, BODY, 700) + 14 * u);
    ctx.fillStyle = dark ? C.ink : C.paper; ctx.fillRect(x, y - h / 2, w, h);
    ctx.strokeStyle = dark ? C.paper : C.ink; ctx.lineWidth = 1.5 * u; ctx.strokeRect(x, y - h / 2, w, h);
    txt(ctx, gl, x + w / 2, y + 1 * u, size, dark ? C.paper : C.ink, 'center', BODY, 700);
    return w;
  }
  function prompt(ctx, action, text, x, y, u, align, dark) {
    const gl = glyph(action);
    if (!gl) return 0;
    ctx.save(); ctx.globalAlpha *= 0; const cw = chip(ctx, gl, 0, 0, u); ctx.restore();
    const tw = width(ctx, text, 14 * u, BODY, 600), total = cw + 8 * u + tw;
    const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    chip(ctx, gl, x0, y, u, dark);
    txt(ctx, text, x0 + cw + 8 * u, y, 14 * u, dark ? C.ink : C.paper, 'left', BODY, 600);
    return total;
  }

  // rows on a paper label: checkbox toggles, segmented sliders
  function rows(ctx, g, items, x, y, w, u, rh) {
    items.forEach((it, i) => {
      const ry = y + i * rh, focused = g.focus === i;
      const k = enter(g, 0.1 + i * 0.03, 0.25);
      ctx.save(); ctx.globalAlpha *= k; ctx.translate((1 - k) * 40 * u, 0);
      if (focused) { ctx.fillStyle = C.ink; ctx.fillRect(x - 6 * u, ry, w + 12 * u, rh - 4 * u); }
      const col = focused ? C.paper : C.ink;
      txt(ctx, it.label.toUpperCase(), x + 8 * u, ry + rh / 2 - 1 * u, 19 * u, col, 'left', HEAD, '', 0.5);
      if (it.value) {
        const v = it.value();
        if (v === 'On' || v === 'Off') {
          const bx = x + w - 30 * u, by = ry + rh / 2 - 10 * u;
          ctx.strokeStyle = col; ctx.lineWidth = 2 * u; ctx.strokeRect(bx, by, 20 * u, 18 * u);
          if (v === 'On') { ctx.strokeStyle = C.orange; ctx.lineWidth = 3.5 * u; ctx.beginPath(); ctx.moveTo(bx + 4 * u, by + 9 * u); ctx.lineTo(bx + 9 * u, by + 14 * u); ctx.lineTo(bx + 18 * u, by + 2 * u); ctx.stroke(); }
        } else txt(ctx, v.toUpperCase(), x + w - 8 * u, ry + rh / 2, 15 * u, focused ? C.yellow : C.orange, 'right', BODY, 700);
      }
      if (it.slider) {
        const v = it.slider(), sw = 9 * u, gap = 3 * u, bw = 10 * (sw + gap);
        const bx = x + w - 44 * u - bw;
        for (let s = 0; s < 10; s++) {
          ctx.fillStyle = s < v ? C.orange : focused ? 'rgba(244,239,230,0.25)' : 'rgba(16,24,40,0.15)';
          ctx.fillRect(bx + s * (sw + gap), ry + rh / 2 - 8 * u - s * 0.6 * u, sw, 16 * u + s * 0.6 * u);
        }
        txt(ctx, String(v), x + w - 8 * u, ry + rh / 2, 16 * u, col, 'right', HEAD);
        g.buttons.push({ x: bx - 30 * u, y: ry, w: 36 * u, h: rh, focus: i, act: () => it.adjust(-1) });
        g.buttons.push({ x: bx + bw * 0.5, y: ry, w: bw * 0.5 + 40 * u, h: rh, focus: i, act: () => it.adjust(1) });
      }
      ctx.restore();
      g.buttons.push({ x: x - 6 * u, y: ry, w: w + 12 * u, h: rh - 4 * u, focus: i, act: () => g.activate(it) });
    });
  }

  function backButton(ctx, g, u, label) {
    if (I.device === 'touch') {
      const w = 110 * u, h = 44 * u, x = 14 * u, y = g.H - h - 14 * u;
      ctx.fillStyle = C.ink; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = C.orange; ctx.fillRect(x, y, 6 * u, h);
      txt(ctx, '‹ ' + label.toUpperCase(), x + w / 2 + 3 * u, y + h / 2, 18 * u, C.paper, 'center', HEAD);
      g.buttons.push({ x, y, w, h, act: () => g.back() });
    } else {
      let x = 18 * u;
      const y = g.H - 24 * u;
      x += prompt(ctx, 'confirm', 'Select', x, y, u) + 20 * u;
      prompt(ctx, 'back', label, x, y, u);
    }
  }

  const UI = {
    HEAD, BODY, C,
    scale(g) { return Math.max(0.62, Math.min(1.6, Math.min(g.W / 640, g.H / 640))); },

    // slide-in wipe used by every panel: from the left edge
    wipe(ctx, g, fn) {
      const k = enter(g, 0, 0.32);
      ctx.save(); ctx.translate(-(1 - k) * g.W * 0.25, 0); ctx.globalAlpha *= k; fn(); ctx.restore();
    },

    // ---------------- title: dispatch board on the left ----------------
    title(ctx, g) {
      const u = this.scale(g), W = g.W, H = g.H, narrow = W < 620 * u + 120 * u;
      const k = enter(g, 0, 0.5);
      // diagonal ink band with an orange edge (down the left, or across the top on a phone)
      const bw = narrow ? W : Math.min(W * 0.52, 520 * u);
      const big0 = Math.min(76 * u, (bw - 60 * u) / 4.2);
      const nItems = g.menu().length;
      const yMenu0 = Math.max(46 * u, H * 0.1) + 50 * u + big0 * 1.8 + 10 * u;
      const bandH = Math.min(H, yMenu0 + nItems * 58 * u + 60 * u);
      ctx.save();
      ctx.globalAlpha = 0.94;
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      if (narrow) { ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, (bandH - 50 * u) * k); ctx.lineTo(0, bandH * k); }
      else { ctx.moveTo(0, 0); ctx.lineTo(bw * k, 0); ctx.lineTo(bw * k - 90 * u, H); ctx.lineTo(0, H); }
      ctx.fill();
      ctx.fillStyle = C.orange;
      ctx.beginPath();
      if (narrow) { ctx.moveTo(0, bandH * k); ctx.lineTo(W, (bandH - 50 * u) * k); ctx.lineTo(W, (bandH - 36 * u) * k); ctx.lineTo(0, bandH * k + 14 * u); }
      else { ctx.moveTo(bw * k, 0); ctx.lineTo(bw * k + 16 * u, 0); ctx.lineTo(bw * k + 16 * u - 90 * u, H); ctx.lineTo(bw * k - 90 * u, H); }
      ctx.fill();
      ctx.restore();
      const x = 30 * u;
      let y = Math.max(46 * u, H * 0.1);
      ctx.save(); ctx.globalAlpha = k;
      txt(ctx, 'NEXT-DAY DELIVERY. ON FOOT.', x, y, 12 * u, C.yellow, 'left', BODY, 700, 2);
      y += 50 * u;
      const big = Math.min(76 * u, (bw - 60 * u) / 4.2);
      ctx.fillStyle = C.orange; ctx.fillRect(x - 8 * u, y - big * 0.55, width(ctx, 'COURIER', big, HEAD) + 16 * u, big * 1.05);
      txt(ctx, 'COURIER', x, y, big, C.ink, 'left', HEAD);
      y += big * 1.05;
      txt(ctx, 'SPRINT', x, y, big, C.paper, 'left', HEAD);
      // motion streaks behind SPRINT
      ctx.fillStyle = C.orange;
      for (let i = 0; i < 3; i++) ctx.fillRect(x + width(ctx, 'SPRINT', big, HEAD) + 10 * u + Math.sin(g.time * 6 + i) * 4 * u, y - big * 0.25 + i * big * 0.2, (40 - i * 10) * u, 4 * u);
      ctx.restore();
      y += big * 0.75 + 10 * u;
      // menu entries: big stacked words with manifest numbers
      const items = g.menu(), rh = Math.min(58 * u, (H - y - 70 * u) / items.length);
      items.forEach((it, i) => {
        const ry = y + i * rh, f = g.focus === i;
        const kk = enter(g, 0.15 + i * 0.06, 0.3);
        ctx.save(); ctx.globalAlpha = kk; ctx.translate(-(1 - kk) * 60 * u, 0);
        const pop = f ? g.focusPop : 0;
        if (f) {
          const tw = width(ctx, it.label.toUpperCase(), 30 * u, HEAD) + 70 * u;
          ctx.fillStyle = C.paper; ctx.fillRect(x - 8 * u, ry + 4 * u, tw + pop * 10 * u, rh - 8 * u);
          ctx.fillStyle = C.orange; ctx.fillRect(x - 8 * u, ry + 4 * u, 6 * u, rh - 8 * u);
        }
        txt(ctx, '0' + (i + 1), x + 6 * u, ry + rh / 2, 13 * u, f ? C.orange : '#8b93a6', 'left', BODY, 700);
        txt(ctx, it.label.toUpperCase(), x + 36 * u + pop * 8 * u, ry + rh / 2 + 1 * u, 30 * u, f ? C.ink : C.paper, 'left', HEAD, '', 1);
        if (f) txt(ctx, '→', x + 46 * u + width(ctx, it.label.toUpperCase(), 30 * u, HEAD) + Math.sin(g.time * 8) * 3 * u, ry + rh / 2, 22 * u, C.orange, 'left', HEAD);
        ctx.restore();
        g.buttons.push({ x: x - 8 * u, y: ry, w: Math.max(240 * u, bw - 120 * u), h: rh, focus: i, act: () => g.activate(it) });
      });
      // manifest line
      ctx.globalAlpha = enter(g, 0.4, 0.4);
      const ly = Math.min(H - 56 * u, y + items.length * rh + 18 * u);
      txt(ctx, 'BEST  ' + g.save.best + '   ·   RUNS  ' + g.save.runs, x, ly, 13 * u, '#c5cad6', 'left', BODY, 600, 1);
      ctx.globalAlpha = 1;
      if (I.device !== 'touch') prompt(ctx, 'confirm', 'Select', x, H - 24 * u, u);
    },

    // ---------------- settings: a paper label ----------------
    settings(ctx, g) {
      const u = this.scale(g), W = g.W, H = g.H;
      ctx.fillStyle = `rgba(16,24,40,${0.55 * enter(g, 0, 0.2)})`; ctx.fillRect(0, 0, W, H);
      const items = g.menu();
      const rh = Math.min(46 * u, (H - 170 * u) / items.length);
      const w = Math.min(520 * u, W - 40 * u), h = 110 * u + items.length * rh;
      const x = (W - w) / 2, y = Math.max(16 * u, (H - h) / 2 - 10 * u);
      this.wipe(ctx, g, () => {
        label(ctx, x, y, w, h, u);
        ctx.fillStyle = C.ink; ctx.fillRect(x, y, w, 56 * u);
        txt(ctx, 'SETTINGS', x + 20 * u, y + 29 * u, 30 * u, C.paper, 'left', HEAD, '', 1);
        barcode(ctx, x + w - 130 * u, y + 14 * u, 110 * u, 28 * u, 77);
        ctx.fillStyle = C.paper; ctx.fillRect(x + w - 130 * u, y + 14 * u, 110 * u, 28 * u);
        barcode(ctx, x + w - 128 * u, y + 16 * u, 106 * u, 24 * u, 77);
        rows(ctx, g, items, x + 20 * u, y + 72 * u, w - 40 * u, u, rh);
      });
      backButton(ctx, g, u, 'Back');
    },

    // ---------------- how to play: route card ----------------
    how(ctx, g) {
      const u = this.scale(g), W = g.W, H = g.H;
      ctx.fillStyle = `rgba(16,24,40,${0.6 * enter(g, 0, 0.2)})`; ctx.fillRect(0, 0, W, H);
      const w = Math.min(660 * u, W - 30 * u), h = Math.min(500 * u, H - 90 * u);
      const x = (W - w) / 2, y = (H - h) / 2 - 14 * u;
      this.wipe(ctx, g, () => {
        label(ctx, x, y, w, h, u);
        ctx.fillStyle = C.orange; ctx.fillRect(x, y, w, 54 * u);
        txt(ctx, 'THE ROUTE', x + 20 * u, y + 28 * u, 30 * u, C.ink, 'left', HEAD, '', 1);
        const two = w > 520 * u;
        const cards = [
          ['BARRIER', 'Jump it', 'jump', '#ff6a1a'], ['LOW SIGN', 'Roll under it', 'roll', '#ffd23f'], ['VAN', 'Change lane', 'lanes', '#f4f1e8'],
          ['MAGNET', 'Pulls parcels in for 8s', null, '#ff3d5a'], ['SCOOTER', 'Takes one crash for you', null, '#2f8bff'], ['DRONE', 'Flies you over everything 5s', null, '#a35cff'],
        ];
        const cols = two ? 3 : 2, cw = (w - 40 * u) / cols, ch = Math.min(70 * u, (h - 200 * u) / Math.ceil(cards.length / cols));
        cards.forEach((c, i) => {
          const cx = x + 20 * u + (i % cols) * cw, cy = y + 70 * u + Math.floor(i / cols) * (ch + 8 * u);
          const kk = enter(g, 0.1 + i * 0.05, 0.25);
          ctx.save(); ctx.globalAlpha *= kk;
          ctx.fillStyle = C.ink; ctx.fillRect(cx, cy, cw - 10 * u, ch);
          ctx.fillStyle = c[3]; ctx.fillRect(cx, cy, 8 * u, ch);
          txt(ctx, c[0], cx + 18 * u, cy + ch * 0.32, 18 * u, C.paper, 'left', HEAD, '', 0.5);
          const gl = c[2] && glyph(c[2]);
          txt(ctx, c[1] + (gl ? '  ·  ' + gl : ''), cx + 18 * u, cy + ch * 0.7, 12 * u, '#c5cad6', 'left', BODY, 600);
          ctx.restore();
        });
        let ry = y + 70 * u + Math.ceil(cards.length / cols) * (ch + 8 * u) + 14 * u;
        const lines = [
          'Swipe or use the arrow keys / D-pad to switch lanes, jump (↑, A) and roll (↓, B).',
          'Tap anywhere also jumps. Rolling in mid-air slams you back down.',
          'Every metre scores 1, every parcel 10. You run faster the further you get.',
          'Esc / Start pauses. R / Y restarts. Day theme can be set in Settings.',
        ];
        for (const l of lines) {
          if (ry < y + h - 18 * u) { ctx.fillStyle = C.orange; ctx.fillRect(x + 18 * u, ry - 3 * u, 6 * u, 6 * u); }
          for (const part of wrap(ctx, l, w - 60 * u, 14 * u)) { if (ry < y + h - 18 * u) txt(ctx, part, x + 30 * u, ry, 14 * u, C.ink, 'left', BODY, 500); ry += 20 * u; }
          ry += 4 * u;
        }
      });
      backButton(ctx, g, u, 'Back');
    },

    // ---------------- HUD ----------------
    hud(ctx, g) {
      const u = this.scale(g), W = g.W, sim = g.sim, R = root.CS.Rules;
      const k = enter(g, 0, 0.35);
      ctx.save(); ctx.globalAlpha = k; ctx.translate(-(1 - k) * 80 * u, 0);
      const x = 14 * u, y = 14 * u, w = 196 * u, h = 76 * u;
      label(ctx, x, y, w, h, u * 0.6);
      ctx.fillStyle = C.orange; ctx.fillRect(x, y, 10 * u, h);
      const sp = g.sPulse > 0 ? 1 + g.sPulse * 0.12 : 1;
      ctx.save(); ctx.translate(x + 22 * u, y + 28 * u); ctx.scale(sp, sp);
      txt(ctx, String(R.score(sim)), 0, 0, 34 * u, C.ink, 'left', HEAD);
      ctx.restore();
      txt(ctx, Math.floor(sim.dist) + ' M', x + 22 * u, y + 58 * u, 14 * u, C.mute, 'left', BODY, 700, 1);
      // parcel counter with a mini box
      const pp = g.pPulse > 0 ? 1 + g.pPulse * 0.4 : 1;
      ctx.save(); ctx.translate(x + w - 64 * u, y + 56 * u); ctx.scale(pp, pp);
      ctx.fillStyle = '#c9965c'; ctx.fillRect(-8 * u, -8 * u, 16 * u, 14 * u); ctx.fillStyle = '#f4efe6'; ctx.fillRect(-1.5 * u, -8 * u, 3 * u, 14 * u);
      ctx.restore();
      txt(ctx, '×' + sim.parcels, x + w - 50 * u, y + 56 * u, 16 * u, C.ink, 'left', BODY, 700);
      barcode(ctx, x + w - 72 * u, y + 12 * u, 60 * u, 22 * u, 1234 + Math.floor(sim.dist / 100));
      ctx.restore();
      // power-up chips
      let py = y + h + 22 * u;
      const pw = sim.power;
      for (const [on, name, left, max, col] of [[pw.magnet > 0, 'MAGNET', pw.magnet, 8, '#ff3d5a'], [pw.drone > 0, 'DRONE', pw.drone, 5, '#a35cff'], [pw.scooter, 'SCOOTER', 1, 1, '#2f8bff']]) {
        if (!on) continue;
        const cw = 150 * u, ch = 28 * u;
        ctx.fillStyle = C.ink; ctx.fillRect(x, py, cw, ch);
        ctx.fillStyle = col; ctx.fillRect(x, py, cw * (left / max), 4 * u);
        ctx.fillRect(x, py, 6 * u, ch);
        const flash = left < 1.5 && max > 1 && Math.sin(g.time * 20) > 0;
        txt(ctx, name + (max > 1 ? '  ' + left.toFixed(1) + 's' : '  1 HIT'), x + 14 * u, py + ch / 2 + 2 * u, 15 * u, flash ? col : C.paper, 'left', HEAD, '', 1);
        py += ch + 6 * u;
      }
      // pause button: square
      const bs = 46 * u, bx = W - bs - 14 * u, by = 14 * u;
      ctx.fillStyle = C.ink; ctx.fillRect(bx, by, bs, bs);
      ctx.fillStyle = C.paper; ctx.fillRect(bx + bs * 0.32, by + bs * 0.28, bs * 0.12, bs * 0.44); ctx.fillRect(bx + bs * 0.56, by + bs * 0.28, bs * 0.12, bs * 0.44);
      ctx.fillStyle = C.orange; ctx.fillRect(bx, by + bs - 4 * u, bs, 4 * u);
      g.buttons.push({ x: bx - 8 * u, y: by - 8 * u, w: bs + 16 * u, h: bs + 16 * u, act: () => g.pause() });
      // control hints at the start of a shift
      if (g.settings.hints && g.playT < 6 && sim.state === 'playing') {
        const a = clamp01(Math.min((g.playT - 0.8) * 2, 6 - g.playT));
        ctx.save(); ctx.globalAlpha = a;
        const hy = g.H * 0.17;
        [['lanes', 'Switch lane'], ['jump', 'Jump barriers'], ['roll', 'Roll under signs']].forEach(([act, t], i) => prompt(ctx, act, t, W / 2, hy + i * 32 * u, u, 'center'));
        ctx.restore();
      }
    },

    // big 3-2-1-GO
    countdown(ctx, g) {
      const u = this.scale(g), W = g.W, H = g.H;
      const t = g.cdT - 0.6;
      if (t < 0) return;
      const n = Math.floor(t / 0.6), f = (t % 0.6) / 0.6;
      const s = n < 3 ? String(3 - n) : 'GO!';
      if (n > 3) return;
      const sc = 0.6 + easeBack(clamp01(f * 2.5)) * 0.5;
      ctx.save();
      ctx.globalAlpha = 1 - clamp01((f - 0.6) / 0.4);
      ctx.translate(W / 2, H * 0.36); ctx.scale(sc, sc); ctx.rotate(-0.06);
      const size = 110 * u;
      ctx.fillStyle = n < 3 ? C.ink : C.orange;
      const tw = width(ctx, s, size, HEAD) + 40 * u;
      ctx.fillRect(-tw / 2, -size * 0.6, tw, size * 1.2);
      txt(ctx, s, 0, 4 * u, size, n < 3 ? C.paper : C.ink, 'center', HEAD);
      ctx.restore();
    },

    // ---------------- pause: side panel ----------------
    paused(ctx, g) {
      const u = this.scale(g), W = g.W, H = g.H;
      ctx.fillStyle = `rgba(16,24,40,${0.45 * enter(g, 0, 0.2)})`; ctx.fillRect(0, 0, W, H);
      const k = enter(g, 0, 0.3);
      const pw = Math.min(W, 380 * u);
      ctx.save(); ctx.translate(-(1 - k) * pw, 0);
      ctx.fillStyle = C.orange; ctx.fillRect(0, 0, pw, H);
      ctx.fillStyle = C.ink; ctx.fillRect(pw - 8 * u, 0, 8 * u, H);
      txt(ctx, 'ON BREAK', 28 * u, 70 * u, 54 * u, C.ink, 'left', HEAD);
      txt(ctx, Math.floor(g.sim.dist) + ' M  ·  ' + g.sim.parcels + ' PARCELS', 30 * u, 112 * u, 14 * u, C.ink, 'left', BODY, 700, 1);
      const items = g.menu(), rh = 56 * u;
      rows(ctx, g, items, 30 * u, 140 * u, pw - 70 * u, u, rh);
      ctx.restore();
      backButton(ctx, g, u, 'Resume');
    },

    // ---------------- results: printed receipt ----------------
    results(ctx, g) {
      const u = this.scale(g), W = g.W, H = g.H, r = g.result;
      ctx.fillStyle = `rgba(16,24,40,${0.6 * clamp01(g.stateT / 0.3)})`; ctx.fillRect(0, 0, W, H);
      const items = g.menu();
      const rh = 46 * u;
      const w = Math.min(380 * u, W - 30 * u), h = 300 * u + items.length * rh;
      const x = (W - w) / 2;
      const yEnd = Math.max(10 * u, (H - h) / 2);
      // the receipt prints upward from the bottom edge
      const k = easeOut(clamp01(g.stateT / 0.7));
      const y = H + 10 - (H + 10 - yEnd) * k;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 6 * u, y + 6 * u, w, h);
      ctx.fillStyle = '#fbf8f1';
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let zx = 0; zx <= w; zx += 12 * u) ctx.lineTo(x + zx, y + (zx / (12 * u)) % 2 * 6 * u);
      ctx.lineTo(x + w, y + h);
      for (let zx = w; zx >= 0; zx -= 12 * u) ctx.lineTo(x + zx, y + h - (zx / (12 * u)) % 2 * 6 * u);
      ctx.closePath(); ctx.fill();
      let ry = y + 40 * u;
      txt(ctx, 'COURIER SPRINT', W / 2, ry, 26 * u, C.ink, 'center', HEAD, '', 2);
      ry += 26 * u;
      txt(ctx, r.title, W / 2, ry, 13 * u, C.mute, 'center', BODY, 700, 2);
      ry += 18 * u;
      dashed(ctx, x + 18 * u, ry, w - 36 * u, u);
      ry += 22 * u;
      const t = clamp01((g.stateT - 0.7) / 0.8);
      const lines = [['DISTANCE', Math.round(r.dist * easeOut(t)) + ' m'], ['PARCELS', Math.round(r.parcels * easeOut(t)) + ' × 10'], ['SCORE', String(Math.round(r.score * easeOut(t)))], ['BEST', String(r.best)]];
      lines.forEach(([a, b], i) => {
        txt(ctx, a, x + 24 * u, ry, 14 * u, C.ink, 'left', BODY, 700, 1);
        txt(ctx, b, x + w - 24 * u, ry, i === 2 ? 22 * u : 15 * u, i === 2 ? C.orange : C.ink, 'right', i === 2 ? HEAD : BODY, 700);
        ry += 28 * u;
      });
      dashed(ctx, x + 18 * u, ry - 6 * u, w - 36 * u, u);
      barcode(ctx, x + 40 * u, ry + 6 * u, w - 80 * u, 30 * u, r.score + 7);
      ry += 52 * u;
      rows(ctx, g, items, x + 24 * u, ry, w - 48 * u, u, rh);
      // NEW BEST stamp
      if (r.newBest && g.stateT > 1.6) {
        const s = 2.2 - 1.2 * easeOut(clamp01((g.stateT - 1.6) / 0.25));
        ctx.save(); ctx.translate(x + w * 0.68, y + 238 * u); ctx.rotate(-0.18); ctx.scale(s, s);
        ctx.globalAlpha = clamp01((g.stateT - 1.6) / 0.15) * 0.9;
        ctx.fillStyle = 'rgba(251,248,241,0.9)'; ctx.fillRect(-56 * u, -22 * u, 112 * u, 44 * u);
        ctx.strokeStyle = C.red; ctx.lineWidth = 3 * u; ctx.strokeRect(-56 * u, -22 * u, 112 * u, 44 * u);
        txt(ctx, 'NEW BEST', 0, 2 * u, 26 * u, C.red, 'center', HEAD, '', 1);
        ctx.restore();
      }
      ctx.restore();
      if (I.device !== 'touch') prompt(ctx, 'restart', 'Run again', W / 2, H - 22 * u, u, 'center');
    },

    toast(ctx, g) {
      const m = g.toastMsg;
      if (!m) return;
      const u = this.scale(g);
      const a = clamp01(m.life / 0.25) * clamp01((m.max - m.life) / 0.15);
      const tw = width(ctx, m.s.toUpperCase(), 22 * u, HEAD) + 36 * u, th = 40 * u;
      const x = (g.W - tw) / 2 + (1 - a) * 30 * u, y = g.H * 0.27;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(x + tw / 2, y + th / 2); ctx.rotate(-0.03);
      ctx.fillStyle = m.color || C.orange; ctx.fillRect(-tw / 2 + 5 * u, -th / 2 + 5 * u, tw, th);
      ctx.fillStyle = C.ink; ctx.fillRect(-tw / 2, -th / 2, tw, th);
      txt(ctx, m.s.toUpperCase(), 0, 2 * u, 22 * u, C.paper, 'center', HEAD, '', 1);
      ctx.restore();
    },
  };

  function dashed(ctx, x, y, w, u) {
    ctx.fillStyle = '#9aa0ad';
    for (let i = 0; i < w; i += 8 * u) ctx.fillRect(x + i, y, 4 * u, 1.5 * u);
  }
  function wrap(ctx, s, maxW, size) {
    const out = []; let line = '';
    for (const w of s.split(' ')) { const t = line ? line + ' ' + w : w; if (width(ctx, t, size, BODY, 500) > maxW && line) { out.push(line); line = w; } else line = t; }
    if (line) out.push(line);
    return out;
  }

  root.CS.UI = UI;
})(window);
