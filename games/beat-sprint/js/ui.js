// Screens, HUD and menus, drawn on the canvas over the highway.
// The UI works in its own units: the screen is scaled so a 480 x 520 box
// always fits, which keeps text readable on phones in either orientation.
// Buttons are registered every frame on G.buttons, so mouse, touch, keyboard
// and gamepad all drive the same menus.
(function () {
  const BS = window.BS;
  const D = BS.Draw, I = BS.Input, A = BS.Audio;
  const { clamp01, easeOut, easeBack, rgb } = BS;
  const PINK = '#ff3d9a', CYAN = '#3df2ff', GOLD = '#ffd23f', INK = '#f6ecff', MUTE = 'rgba(226,206,255,0.68)', FAINT = 'rgba(200,170,255,0.38)';
  const ROW = 34;

  const enter = (G, delay, dur) => easeOut(((G.stateT || 0) - (delay || 0)) / (dur || 0.25));

  const UI = {
    k: 1, VW: 480, VH: 520, hl: { key: null, y: 0 },

    layout(W, H) {
      this.k = Math.min(W / 480, H / 520);
      this.VW = W / this.k; this.VH = H / this.k;
    },

    // ---------- building blocks ----------
    panel(ctx, x, y, w, h, accent) {
      D.plate(ctx, x, y, w, h, 18);
      ctx.fillStyle = 'rgba(12,3,32,0.86)';
      ctx.fill();
      ctx.strokeStyle = accent || 'rgba(255,61,154,0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      D.plate(ctx, x + 5, y + 5, w - 10, h - 10, 16);
      ctx.strokeStyle = 'rgba(61,242,255,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // corner ticks
      ctx.fillStyle = accent || PINK;
      ctx.fillRect(x + 26, y - 1, 40, 3);
      ctx.fillRect(x + w - 66, y + h - 2, 40, 3);
    },
    heading(ctx, str, x, y, size, align, color) {
      D.text(ctx, str, x, y, size || 22, color || INK, align || 'left', 700, { spacing: 5, glow: 'rgba(255,61,154,0.7)' });
    },
    popIn(ctx, G, cx, cy, fn) {
      const k = enter(G, 0, 0.28), s = 0.9 + 0.1 * easeBack(k);
      ctx.save();
      ctx.globalAlpha *= clamp01(k * 1.4);
      ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
      fn();
      ctx.restore();
    },

    // A vertical menu. Rows slide in one after another; a highlight bar glides to the focus.
    list(ctx, G, items, x, y, w, opts) {
      opts = opts || {};
      const rowH = opts.rowH || ROW, h = rowH - 6;
      const key = G.state + ':' + items.length + ':' + Math.round(x);
      const rowY = (i) => y + i * rowH + (opts.extra ? opts.extra(i) : 0);
      const target = rowY(G.focus);
      if (this.hl.key !== key) { this.hl.key = key; this.hl.y = target; } else this.hl.y += (target - this.hl.y) * 0.3;
      const fi = items[G.focus];
      if (fi) {
        const hh = fi.card ? h + 16 : h;
        D.plate(ctx, x - 2, this.hl.y - 2, w + 4, hh + 4, 9);
        const g = ctx.createLinearGradient(x, 0, x + w, 0);
        g.addColorStop(0, fi.danger ? 'rgba(255,60,70,0.35)' : 'rgba(255,61,154,0.34)'); g.addColorStop(1, 'rgba(61,242,255,0.1)');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = fi.danger ? '#ff5a64' : PINK; ctx.lineWidth = 1.5; ctx.stroke();
      }
      items.forEach((it, i) => {
        const k = enter(G, 0.05 + i * 0.04, 0.25);
        const ry = rowY(i), focused = G.focus === i, hh = it.card ? h + 16 : h;
        ctx.save();
        ctx.globalAlpha *= k;
        ctx.translate((1 - k) * -24, 0);
        if (!focused) {
          D.plate(ctx, x, ry, w, hh, 8);
          ctx.fillStyle = 'rgba(20,6,46,0.62)'; ctx.fill();
          ctx.strokeStyle = 'rgba(160,110,255,0.25)'; ctx.lineWidth = 1; ctx.stroke();
        }
        const color = it.danger ? (focused ? '#ff8a92' : '#c8616a') : focused ? '#ffffff' : MUTE;
        const cy = it.card ? ry + 15 : ry + h / 2;
        D.text(ctx, it.label, x + 18, cy, 14, color, 'left', 700, { spacing: 2.5, glow: focused ? 'rgba(255,61,154,0.8)' : null });
        if (it.card && it.sub) D.text(ctx, it.sub, x + 18, ry + 33, 10.5, focused ? 'rgba(235,225,255,0.9)' : FAINT, 'left', 500, { maxWidth: w - (it.best ? 120 : 36) });
        if (it.card && it.best) {
          D.text(ctx, 'BEST', x + w - 18, ry + 14, 8.5, FAINT, 'right', 700, { spacing: 2 });
          D.text(ctx, it.best, x + w - 18, ry + 30, 13, focused ? GOLD : MUTE, 'right', 700, { spacing: 1 });
        }
        if (!it.card && it.sub && focused) D.text(ctx, it.sub, x + w - 36, cy + 1, 10, 'rgba(235,225,255,0.65)', 'right', 500, { maxWidth: w * 0.5 });
        if (it.value) {
          const v = it.value(), on = v === 'ON';
          const pw = 40, px = x + w - 16 - pw;
          D.plate(ctx, px, cy - 8, pw, 16, 4);
          ctx.fillStyle = on ? 'rgba(61,242,255,0.25)' : 'rgba(255,255,255,0.05)'; ctx.fill();
          ctx.strokeStyle = on ? CYAN : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke();
          D.text(ctx, v, px + pw / 2, cy + 0.5, 10, on ? CYAN : MUTE, 'center', 700, { spacing: 1.5 });
          G.buttons.push({ x, y: ry, w, h: hh, focus: i, action: () => it.adjust() });
        } else if (it.slider) {
          const v = it.slider(), segW = 9, gap = 3, n = it.max || 10;
          const bw = n * (segW + gap) - gap, sx = x + w - 44 - bw;
          for (let s = 0; s < n; s++) {
            D.plate(ctx, sx + s * (segW + gap), cy - 6, segW, 12, 3);
            ctx.fillStyle = s < v ? (focused ? rgb(BS.mixRgb([255, 61, 154], [61, 242, 255], s / n)) : 'rgba(200,120,230,0.6)') : 'rgba(255,255,255,0.08)';
            ctx.fill();
          }
          D.text(ctx, String(v), x + w - 16, cy, 12, focused ? INK : MUTE, 'right', 700);
          if (focused) { D.text(ctx, '◀', sx - 12, cy, 9, MUTE, 'center'); D.text(ctx, '▶', sx + bw + 10, cy, 9, MUTE, 'center'); }
          G.buttons.push({ x, y: ry, w: sx - x + bw / 2, h: hh, focus: i, action: () => it.adjust(-1) });
          G.buttons.push({ x: sx + bw / 2, y: ry, w: x + w - sx - bw / 2, h: hh, focus: i, action: () => it.adjust(1) });
        } else if (it.choice) {
          const v = it.choice(), cxv = x + w - 70;
          D.text(ctx, v, cxv, cy, 12.5, focused ? GOLD : MUTE, 'center', 700, { spacing: 1.5 });
          D.text(ctx, '◀', cxv - 54, cy, 10, focused ? INK : FAINT, 'center');
          D.text(ctx, '▶', cxv + 54, cy, 10, focused ? INK : FAINT, 'center');
          G.buttons.push({ x, y: ry, w: cxv - x, h: hh, focus: i, action: () => it.adjust(-1) });
          G.buttons.push({ x: cxv, y: ry, w: x + w - cxv, h: hh, focus: i, action: () => it.adjust(1) });
        } else {
          if (focused) {
            const wob = Math.sin(G.time * 8) * 2;
            D.text(ctx, '»', x + w - 14 + wob, cy - 1, 16, PINK, 'right', 700);
          }
          G.buttons.push({ x, y: ry, w, h: hh, focus: i, action: () => G.activate(it) });
        }
        ctx.restore();
      });
    },

    footer(ctx, G, x, y, align, back) {
      if (I.device === 'touch' || I.device === 'mouse') return;
      const parts = [[I.glyph('nav'), 'SELECT'], [I.glyph('ok'), 'CONFIRM']];
      if (back) parts.push([I.glyph('back'), 'BACK']);
      let total = 0;
      const widths = parts.map(([g, l]) => D.prompt(ctx, g, l, -9999, -9999) + 18);
      for (const w of widths) total += w;
      let px = align === 'center' ? x - total / 2 : x;
      parts.forEach(([g, l], i) => { D.prompt(ctx, g, l, px, y); px += widths[i]; });
    },

    backButton(ctx, G, x, y) {
      // always-visible back control for touch and mouse
      D.plate(ctx, x, y, 78, 26, 6);
      ctx.fillStyle = 'rgba(12,3,32,0.8)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,61,154,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      D.text(ctx, '‹ BACK', x + 39, y + 13.5, 11, INK, 'center', 700, { spacing: 2 });
      const m = G.menu();
      G.buttons.push({ x, y, w: 78, h: 26, action: () => m.back && m.back() });
    },

    // ---------- the frame ----------
    draw(ctx, G, dpr) {
      const k = this.k;
      ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
      G.buttons.length = 0;
      const st = G.state;
      if (st === 'title') this.title(ctx, G);
      else if (st === 'setlist') this.setlist(ctx, G);
      else if (st === 'settings') this.settings(ctx, G);
      else if (st === 'howto') this.howto(ctx, G);
      else if (st === 'calibrate') this.calibrate(ctx, G);
      else if (st === 'play') this.hud(ctx, G);
      else if (st === 'paused') { this.hud(ctx, G); this.paused(ctx, G); }
      else if (st === 'results') this.results(ctx, G);
      this.toast(ctx, G);
      // hover focus follows the mouse
      if (I.mouseMoved && I.mouse && I.device === 'mouse') {
        const b = G.hitButton(I.mouse.x, I.mouse.y);
        if (b && b.focus !== undefined && b.focus !== G.focus) { G.focus = b.focus; A.sfx('nav'); }
        I.mouseMoved = false;
      }
      if (G.fade > 0) this.wipe(ctx, G.fade);
    },

    // screen change: a dark fade with glitch slices
    wipe(ctx, f) {
      const { VW, VH } = this;
      ctx.fillStyle = `rgba(6,0,18,${f * 0.92})`;
      ctx.fillRect(0, 0, VW, VH);
      if (f > 0.2) {
        for (let i = 0; i < 6; i++) {
          const y = ((i * 97 + Math.floor(f * 40) * 53) % 100) / 100 * VH;
          ctx.fillStyle = i % 2 ? `rgba(255,61,154,${f * 0.25})` : `rgba(61,242,255,${f * 0.2})`;
          ctx.fillRect(0, y, VW, 2 + (i % 3) * 2);
        }
      }
    },

    logo(ctx, G, cx, y, size, align) {
      const k = enter(G, 0, 0.6);
      // a neon sign: flickers on as the screen opens, then hums
      const flick = G.stateT < 0.9 ? (Math.sin(G.stateT * 90) > -0.2 ? 1 : 0.25) : 0.93 + 0.07 * Math.sin(G.time * 31) * Math.sin(G.time * 7);
      ctx.save();
      ctx.globalAlpha = k * flick;
      D.text(ctx, 'BEAT', cx, y, size, '#ffd7ee', align, 400, { display: true, glow: PINK, blur: 24, spacing: 4 });
      ctx.globalAlpha = k;
      D.text(ctx, 'SPRINT', cx + (align === 'left' ? size * 0.4 : 0), y + size * 1.02, size, '#d8fdff', align, 400, { display: true, glow: CYAN, blur: 24, spacing: 4 });
      ctx.restore();
    },

    title(ctx, G) {
      const { VW, VH } = this, wide = VW > 720;
      const x = wide ? 52 : (VW - 340) / 2, w = 340;
      const top = wide ? Math.max(30, VH * 0.1) : Math.max(30, VH * 0.08);
      this.logo(ctx, G, wide ? x : VW / 2, top + 22, wide ? 46 : 40, wide ? 'left' : 'center');
      const k = enter(G, 0.3, 0.4);
      ctx.globalAlpha = k;
      D.text(ctx, 'THE HIGHWAY IS THE SONG', wide ? x + 4 : VW / 2, top + 112, 11.5, MUTE, wide ? 'left' : 'center', 600, { spacing: 4 });
      ctx.globalAlpha = 1;
      const items = G.menu().items;
      const ly = wide ? Math.max(top + 150, VH - 60 - items.length * ROW - 40) : Math.max(top + 150, VH * 0.52);
      this.list(ctx, G, items, x, ly, w);
      // best scores in the corner
      const sv = G.save, lv = G.s.level, d = sv.daily[BS.today() + ':' + lv], b = sv.best['random:' + lv];
      ctx.globalAlpha = enter(G, 0.5, 0.4);
      const rx = VW - 22;
      D.text(ctx, BS.Song.LEVELS[lv].name.toUpperCase() + ' LEVEL', rx, 26, 9, FAINT, 'right', 700, { spacing: 3 });
      D.text(ctx, 'TODAY  ' + (d ? BS.fmt(d) : '—'), rx, 44, 12, GOLD, 'right', 700, { spacing: 1.5 });
      D.text(ctx, 'BEST  ' + (b ? BS.fmt(b.score) : '—'), rx, 62, 12, CYAN, 'right', 700, { spacing: 1.5 });
      ctx.globalAlpha = 1;
      this.footer(ctx, G, wide ? x : VW / 2, VH - 22, wide ? 'left' : 'center');
      if (I.device === 'touch' || I.device === 'mouse') D.text(ctx, A.running() ? '♪ sound on' : 'tap to wake the sound', wide ? x : VW / 2, VH - 22, 10, FAINT, wide ? 'left' : 'center', 600, { spacing: 2 });
      D.text(ctx, 'v2.0', VW - 18, VH - 18, 9, FAINT, 'right', 600);
    },

    setlist(ctx, G) {
      const { VW, VH } = this;
      const items = G.menu().items;
      const w = Math.min(440, VW - 32), x = (VW - w) / 2;
      const rows = items.length, cards = items.filter((i) => i.card).length;
      const h = rows * ROW + cards * 16 + 34;
      const y0 = Math.max(78, (VH - h) / 2 + 10);
      ctx.globalAlpha = enter(G, 0, 0.3);
      this.heading(ctx, 'SETLIST', x + 6, y0 - 44, 24);
      D.text(ctx, 'Every seed writes a song, and the song writes the road.', x + 8, y0 - 20, 10.5, MUTE, 'left', 500, { maxWidth: w });
      ctx.globalAlpha = 1;
      let acc = 0;
      const offs = items.map((it, i) => { const o = acc; if (it.card) acc += 16; if (i === 0) acc += 18; return o; });
      this.list(ctx, G, items, x, y0, w, { extra: (i) => offs[i] });
      // the level's rule, under the selector
      const lvl = items[0];
      ctx.globalAlpha = enter(G, 0.1, 0.3);
      D.text(ctx, lvl.note(), x + 18, y0 + ROW - 2, 10, FAINT, 'left', 500, { maxWidth: w - 30 });
      ctx.globalAlpha = 1;
      this.footer(ctx, G, VW / 2, VH - 20, 'center', true);
      this.backButton(ctx, G, 16, 16);
    },

    settings(ctx, G) {
      const { VW, VH } = this;
      const items = G.menu().items;
      const rowH = Math.min(ROW, (VH - 110) / items.length);
      const w = Math.min(440, VW - 24), h = 74 + items.length * rowH;
      const x = (VW - w) / 2, y = Math.max(8, (VH - h) / 2);
      this.popIn(ctx, G, VW / 2, VH / 2, () => {
        this.panel(ctx, x, y, w, h);
        this.heading(ctx, 'SETTINGS', x + 28, y + 30, 18);
        const it = items[G.focus];
        if (it && it.label === 'TIMING OFFSET') D.text(ctx, '+ if your hits feel late', x + w - 26, y + 31, 9.5, FAINT, 'right', 600);
        this.list(ctx, G, items, x + 14, y + 54, w - 28, { rowH });
      });
      this.footer(ctx, G, VW / 2, VH - 14, 'center', true);
    },

    howto(ctx, G) {
      const { VW, VH } = this;
      const w = Math.min(560, VW - 24), x = (VW - w) / 2;
      const rules = [
        'Pads ride the highway in three lanes. Strike a lane as its pad crosses the glowing line at your ship.',
        'Wide violet bars span the road: strike any lane.',
        'The track is written from one seed, and every pad is a note of its melody. Hits play that note.',
        'Hits in a row build a combo. Every 10 raises the multiplier, up to x8. Perfects score more.',
        'Miss too many in a row and the signal drops: Chill allows 5, Standard and Intense allow 3.',
        'The Daily Track is the same song for everyone today. Hits feel late? Calibrate in Settings.',
      ];
      const lines = rules.map((r) => D.wrap(ctx, r, w - 70, 11.5, 500));
      const textH = lines.reduce((s, l) => s + l.length * 15 + 7, 0);
      const h = Math.min(VH - 16, 214 + textH);
      const y = Math.max(8, (VH - h) / 2);
      this.popIn(ctx, G, VW / 2, VH / 2, () => {
        this.panel(ctx, x, y, w, h, CYAN);
        this.heading(ctx, 'HOW TO PLAY', x + 28, y + 30, 18);
        // three lanes with their controls on every device
        const lw = Math.min(110, (w - 60) / 3), lx = VW / 2 - lw * 1.5;
        const G3 = I.GLYPH.lanes;
        const names = ['LEFT', 'MIDDLE', 'RIGHT'];
        for (let l = 0; l < 3; l++) {
          const cx = lx + lw * l + lw / 2, col = rgb(BS.LANE_RGB[l]);
          const pulse = 0.5 + 0.5 * Math.sin(G.time * 4 - l);
          D.plate(ctx, cx - lw / 2 + 6, y + 52, lw - 12, 30, 8);
          ctx.fillStyle = rgb(BS.LANE_RGB[l], 0.15 + pulse * 0.2); ctx.fill();
          ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
          D.text(ctx, names[l], cx, y + 67, 11, col, 'center', 700, { spacing: 3 });
          D.text(ctx, 'KEYS  ' + G3.keyboard[l] + ' / ' + ['←', '↓', '→'][l] + ' / ' + ['J', 'K', 'L'][l], cx, y + 96, 9.5, MUTE, 'center', 600);
          D.text(ctx, 'PAD  ' + G3.gamepad[l] + ' / D-pad ' + ['◀', '▼', '▶'][l], cx, y + 112, 9.5, MUTE, 'center', 600);
          D.text(ctx, 'TOUCH  ' + ['left', 'middle', 'right'][l] + ' third', cx, y + 128, 9.5, MUTE, 'center', 600);
        }
        D.text(ctx, 'SPACE strikes the lane you are in  ·  ESC / START pauses', VW / 2, y + 150, 9.5, FAINT, 'center', 600, { spacing: 1 });
        let ry = y + 176;
        lines.forEach((ls) => {
          ctx.fillStyle = PINK;
          ctx.fillRect(x + 30, ry - 2, 5, 5);
          ls.forEach((l, j) => D.text(ctx, l, x + 44, ry + j * 15, 11.5, j === 0 ? INK : 'rgba(246,236,255,0.85)', 'left', 500));
          ry += ls.length * 15 + 7;
        });
        this.list(ctx, G, G.menu().items, x + w - 140, y + 14, 116, { rowH: 30 });
      });
    },

    calibrate(ctx, G) {
      const { VW, VH } = this, c = G.cal;
      const w = Math.min(440, VW - 24), h = 330, x = (VW - w) / 2, y = Math.max(8, (VH - h) / 2);
      this.popIn(ctx, G, VW / 2, VH / 2, () => {
        this.panel(ctx, x, y, w, h, GOLD);
        this.heading(ctx, 'CALIBRATE', x + 28, y + 30, 18);
        const cx = VW / 2, cy = y + 118;
        if (!A.running()) {
          D.text(ctx, 'Sound is needed to calibrate.', cx, cy - 8, 13, INK, 'center', 600);
          D.text(ctx, 'Turn the volume up, then choose Restart.', cx, cy + 14, 11, MUTE, 'center', 500);
        } else if (c) {
          const now = A.now(), ph = (now - c.start) / c.beat;
          const kk = Math.round(ph), frac = ph - Math.floor(ph);
          const on = ph >= 0 && ph < c.count;
          const p = on ? Math.exp(-frac * 6) : 0;
          // the beat ring and the dot that marks where your taps land
          ctx.strokeStyle = rgb([255, 210, 63], 0.25 + p * 0.75);
          ctx.lineWidth = 2 + p * 5;
          ctx.beginPath(); ctx.arc(cx, cy, 38 + p * 10, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = rgb([255, 61, 154], 0.2 + p * 0.5);
          ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2); ctx.fill();
          if (c.lastTap > 0 && G.time - c.lastTap < 0.25) {
            ctx.strokeStyle = CYAN; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, cy, 58, 0, Math.PI * 2); ctx.stroke();
          }
          const taps = c.taps.length;
          for (let i = 0; i < 10; i++) {
            ctx.fillStyle = i < taps ? CYAN : 'rgba(255,255,255,0.15)';
            ctx.fillRect(cx - 75 + i * 15, cy + 66, 9, 9);
          }
          if (!c.done) {
            const label = I.device === 'touch' ? 'Tap the screen on every click' : I.device === 'gamepad' ? 'Press A on every click' : 'Press any key on every click';
            D.text(ctx, label, cx, y + 58, 12.5, INK, 'center', 600);
            if (kk < 2) D.text(ctx, 'listen first...', cx, cy, 10, INK, 'center', 600);
          } else if (c.result === null) {
            D.text(ctx, 'Not enough taps landed near the clicks.', cx, y + 58, 12, INK, 'center', 600);
          } else {
            const r = c.result;
            D.text(ctx, r === 0 ? 'Your taps land right on the beat.' : `Your taps land ${Math.abs(r)} ms ${r > 0 ? 'late' : 'early'}.`, cx, y + 58, 12.5, INK, 'center', 600);
            D.text(ctx, (r > 0 ? '+' : '') + r, cx, cy, 16, GOLD, 'center', 700);
            if (!c.steady) D.text(ctx, 'Taps were uneven: try again for a steadier reading.', cx, cy + 90, 10, FAINT, 'center', 500);
          }
        }
        D.text(ctx, 'Current offset ' + (G.s.offset > 0 ? '+' : '') + G.s.offset + ' ms', cx, y + h - 112, 10, FAINT, 'center', 600, { spacing: 1 });
        this.list(ctx, G, G.menu().items, x + 40, y + h - 98, w - 80, { rowH: 30 });
      });
    },

    // ---------- in play ----------
    hud(ctx, G) {
      const { VW, VH } = this, run = G.run, song = G.song;
      if (!run || !song) return;
      const o = G.look || {};
      // top bar
      const g = ctx.createLinearGradient(0, 0, 0, 60);
      g.addColorStop(0, 'rgba(6,0,18,0.75)'); g.addColorStop(1, 'rgba(6,0,18,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, VW, 60);
      D.text(ctx, BS.fmt(run.score), 18, 22, 22, INK, 'left', 700, { spacing: 2, glow: 'rgba(61,242,255,0.6)' });
      const lv = BS.Song.LEVELS[G.s.level].name.toUpperCase();
      D.text(ctx, song.style.name.toUpperCase() + '  ·  ' + lv + (G.mode === 'daily' ? '  ·  DAILY' : ''), 19, 43, 9, MUTE, 'left', 700, { spacing: 2.5 });
      // combo and multiplier in the middle
      if (run.combo > 1) {
        const pop = run.combo !== G._lastCombo ? 1 : 0;
        if (pop) { G._comboPop = 1; G._lastCombo = run.combo; }
        G._comboPop = Math.max(0, (G._comboPop || 0) - 0.08);
        const s = 1 + G._comboPop * 0.25;
        D.text(ctx, String(run.combo), VW / 2, 22, 22 * s, GOLD, 'center', 700, { glow: 'rgba(255,210,63,0.6)' });
        D.text(ctx, 'COMBO  ×' + run.mult(), VW / 2, 43, 9, 'rgba(255,230,160,0.85)', 'center', 700, { spacing: 3 });
      } else G._lastCombo = run.combo;
      // signal bars: how many misses in a row are left
      const lim = song.missRow, left = lim - run.missRow;
      const bx = VW - 62 - lim * 9;
      D.text(ctx, 'SIGNAL', bx - 8, 22, 8.5, FAINT, 'right', 700, { spacing: 2 });
      for (let i = 0; i < lim; i++) {
        const on = i < left;
        const hh = 6 + i * 3;
        ctx.fillStyle = on ? (left <= 1 ? (Math.sin(G.time * 18) > 0 ? '#ff5a64' : '#ffb0b5') : CYAN) : 'rgba(255,255,255,0.12)';
        ctx.fillRect(bx + i * 9, 28 - hh, 6, hh);
      }
      // pause button
      const px = VW - 44, py = 8;
      D.plate(ctx, px, py, 34, 30, 6);
      ctx.fillStyle = 'rgba(12,3,32,0.7)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,61,154,0.6)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = INK; ctx.fillRect(px + 13, py + 9, 3, 12); ctx.fillRect(px + 20, py + 9, 3, 12);
      if (G.state === 'play') G.buttons.push({ x: px - 6, y: 0, w: 50, h: 46, action: () => G.pause() });
      // progress along the top edge, with section ticks
      const prog = clamp01((o.t || 0) / song.end);
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(0, 0, VW, 3);
      const pg = ctx.createLinearGradient(0, 0, VW, 0);
      pg.addColorStop(0, PINK); pg.addColorStop(1, CYAN);
      ctx.fillStyle = pg; ctx.fillRect(0, 0, VW * prog, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (const s of song.sections) ctx.fillRect(VW * (s.t / song.end), 0, 1, 5);

      // count-in and resume countdown
      const t = o.t || 0;
      if (G.phase === 'live' && t < song.t0 + song.beat * 8) {
        const bi = Math.floor((t - song.t0) / song.beat);
        let str = null;
        if (t < song.t0 + song.beat * 4) str = 'GET READY';
        else if (bi >= 4 && bi <= 7) str = bi === 7 ? 'GO' : String(7 - bi);
        if (str) {
          const f = (((t - song.t0) / song.beat) % 1 + 1) % 1;
          const big = str.length < 3;
          ctx.globalAlpha = big ? 1 - f * 0.7 : 0.9;
          D.text(ctx, str, VW / 2, VH * 0.36, big ? 56 * (1.2 - f * 0.2) : 22, big ? GOLD : INK, 'center', 700, { display: big, glow: PINK, spacing: big ? 2 : 6 });
          ctx.globalAlpha = 1;
          if (!big) {
            D.text(ctx, song.style.name.toUpperCase() + '  ·  ' + song.style.bpm + ' BPM  ·  ' + BS.trackCode(G.seed), VW / 2, VH * 0.36 + 26, 10, MUTE, 'center', 600, { spacing: 3 });
            if (I.device === 'touch') D.text(ctx, 'tap the left, middle or right of the screen', VW / 2, VH * 0.36 + 44, 10, FAINT, 'center', 500, { spacing: 1 });
          }
        }
      }
      if (G.phase === 'resume') {
        const left = Math.ceil((G.heldAt - t) / song.beat);
        if (left > 0) D.text(ctx, String(Math.min(4, left)), VW / 2, VH * 0.36, 52, GOLD, 'center', 400, { display: true, glow: PINK });
      }
      if (G.phase === 'fail') {
        const k = clamp01(G.phaseT / 0.4);
        ctx.globalAlpha = k;
        const jx = (Math.random() - 0.5) * 6 * (1 - k * 0.5);
        D.text(ctx, 'SIGNAL LOST', VW / 2 + jx - 2, VH * 0.38, 34, 'rgba(61,242,255,0.6)', 'center', 400, { display: true });
        D.text(ctx, 'SIGNAL LOST', VW / 2 + jx + 2, VH * 0.38, 34, 'rgba(255,61,154,0.7)', 'center', 400, { display: true });
        D.text(ctx, 'SIGNAL LOST', VW / 2 + jx, VH * 0.38, 34, INK, 'center', 400, { display: true });
        ctx.globalAlpha = 1;
      }
      if (G.phase === 'end') {
        const k = easeBack(clamp01(G.phaseT / 0.5));
        ctx.globalAlpha = clamp01(G.phaseT / 0.3);
        D.text(ctx, 'TRACK CLEAR', VW / 2, VH * 0.36, 30 * k, GOLD, 'center', 400, { display: true, glow: PINK });
        ctx.globalAlpha = 1;
      }
      if (I.device !== 'touch' && G.state === 'play' && G.phase === 'live' && t < song.t0 + song.beat * 8) {
        D.prompt(ctx, I.glyph('pause'), 'PAUSE', VW - 16, VH - 16, 'right');
      }
    },

    paused(ctx, G) {
      const { VW, VH } = this;
      ctx.fillStyle = `rgba(6,0,18,${0.62 * enter(G, 0, 0.2)})`;
      ctx.fillRect(0, 0, VW, VH);
      const items = G.menu().items;
      const w = Math.min(340, VW - 32), h = 96 + items.length * ROW;
      const x = (VW - w) / 2, y = (VH - h) / 2;
      this.popIn(ctx, G, VW / 2, VH / 2, () => {
        this.panel(ctx, x, y, w, h);
        D.text(ctx, (G.song ? G.song.style.name.toUpperCase() : '') + '  ·  ' + BS.Song.LEVELS[G.s.level].name.toUpperCase(), x + 30, y + 24, 9, FAINT, 'left', 700, { spacing: 3 });
        this.heading(ctx, 'PAUSED', x + 28, y + 48, 22);
        this.list(ctx, G, items, x + 16, y + 72, w - 32);
      });
      this.footer(ctx, G, VW / 2, VH - 16, 'center', true);
    },

    results(ctx, G) {
      const { VW, VH } = this, r = G.result;
      if (!r) return;
      const t = G.stateT;
      ctx.fillStyle = `rgba(6,0,18,${0.55 * clamp01(t / 0.3)})`;
      ctx.fillRect(0, 0, VW, VH);
      const items = G.menu().items;
      const wide = VW > 640;
      const w = Math.min(wide ? 600 : 440, VW - 24);
      const h = wide ? 340 : 410;
      const x = (VW - w) / 2, y = Math.max(8, (VH - h) / 2);
      this.popIn(ctx, G, VW / 2, VH / 2, () => {
        this.panel(ctx, x, y, w, h, r.cleared ? CYAN : PINK);
        D.text(ctx, r.cleared ? 'TRACK CLEAR' : 'SIGNAL LOST', x + 28, y + 26, 10, r.cleared ? CYAN : PINK, 'left', 700, { spacing: 4 });
        D.text(ctx, r.style.toUpperCase(), x + 28, y + 50, 20, INK, 'left', 700, { spacing: 3 });
        D.text(ctx, `${r.bpm} BPM  ·  ${BS.Song.LEVELS[r.level].name.toUpperCase()}  ·  ${r.mode === 'daily' ? 'DAILY ' + BS.today() : 'TRACK ' + r.code}`, x + 28, y + 70, 9.5, MUTE, 'left', 600, { spacing: 1.5 });
        // the grade stamps in
        const gk = clamp01((t - 0.9) / 0.35);
        const gx = wide ? x + w - 90 : x + w - 70, gy = y + 66;
        if (gk > 0) {
          const s = 1 + (1 - easeOut(gk)) * 1.6;
          ctx.globalAlpha = gk;
          const gc = { S: GOLD, A: CYAN, B: '#9dffb0', C: '#c9a6ff', D: '#ff9de2', F: '#ff5a64' }[r.grade];
          D.text(ctx, r.grade, gx, gy, 54 * s, gc, 'center', 400, { display: true, glow: gc, blur: 26 });
          ctx.globalAlpha = 1;
        }
        // score counts up
        const sk = easeOut(clamp01((t - 0.2) / 0.8));
        D.text(ctx, BS.fmt(r.score * sk), x + 28, y + 108, 30, INK, 'left', 700, { spacing: 2, glow: 'rgba(61,242,255,0.5)' });
        if (r.newBest && sk >= 1) {
          const bw = 78, bx = x + 28 + D.measure(ctx, BS.fmt(r.score), 30, 700, { spacing: 2 }) + 14;
          D.plate(ctx, bx, y + 99, bw, 18, 4);
          ctx.fillStyle = 'rgba(255,210,63,0.2)'; ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 1; ctx.stroke();
          D.text(ctx, 'NEW BEST', bx + bw / 2, y + 108.5, 9, GOLD, 'center', 700, { spacing: 2 });
        } else D.text(ctx, 'BEST ' + BS.fmt(r.best), x + 28, y + 132, 10, FAINT, 'left', 600, { spacing: 2 });
        const stats = [['PERFECT', r.perfect, GOLD], ['GOOD', r.good, CYAN], ['MISS', r.miss, PINK], ['MAX COMBO', r.combo, INK], ['HIT', r.pct + '%', INK]];
        const sx = x + 28, sy = y + 156, colW = wide ? (w - 56) / 5 : (w - 56) / 3;
        stats.forEach(([label, v, c], i) => {
          const kk = clamp01((t - 0.3 - i * 0.08) / 0.3);
          const cxs = sx + (i % (wide ? 5 : 3)) * colW, cys = sy + Math.floor(i / (wide ? 5 : 3)) * 46;
          ctx.globalAlpha = kk;
          D.text(ctx, label, cxs, cys, 8.5, FAINT, 'left', 700, { spacing: 2 });
          D.text(ctx, String(v), cxs, cys + 18, 16, c, 'left', 700);
          ctx.globalAlpha = 1;
        });
        const ly = wide ? y + 214 : y + 262;
        this.list(ctx, G, items, wide ? x + 120 : x + 22, ly, wide ? w - 240 : w - 44, { rowH: wide ? 28 : ROW });
      });
      if (I.device !== 'touch') D.prompt(ctx, I.glyph('restart'), 'INSTANT RETRY', VW / 2, VH - 16, 'center');
    },

    toast(ctx, G) {
      const m = G.toastMsg;
      if (!m) return;
      const { VW } = this;
      ctx.globalAlpha = clamp01(m.life / 0.3);
      const w = D.measure(ctx, m.str, 12, 600, { spacing: 1.5 }) + 36;
      D.plate(ctx, (VW - w) / 2, 64, w, 26, 6);
      ctx.fillStyle = 'rgba(12,3,32,0.92)'; ctx.fill();
      ctx.strokeStyle = CYAN; ctx.lineWidth = 1; ctx.stroke();
      D.text(ctx, m.str, VW / 2, 77.5, 12, INK, 'center', 600, { spacing: 1.5 });
      ctx.globalAlpha = 1;
    },
  };

  BS.UI = UI;
})();
