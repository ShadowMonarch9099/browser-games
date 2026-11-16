// Sky Stack's screens: soft frosted cards and pill buttons over the sky.
// UI units: the screen is scaled so a 420 x 620 box always fits.
(function () {
  const SS = window.SS;
  const D = SS.Draw, I = SS.Input, A = SS.Audio;
  const { clamp01, easeOut, easeBack } = SS;
  const NAVY = '#1d3557', MUTE = '#5d7699', CORAL = '#ff8a5c', SKY = '#4a90e2', GOLD = '#f2a93b';
  const PILL = 44, GAP = 10;
  const enter = (G, delay, dur) => easeOut(((G.stateT || 0) - (delay || 0)) / (dur || 0.3));

  const UI = {
    k: 1, VW: 420, VH: 620, hl: { key: null, y: 0 },
    layout(W, H) { this.k = Math.min(W / 420, H / 620); this.VW = W / this.k; this.VH = H / this.k; },

    // vertical pill menu; the focused pill swells and turns coral
    list(ctx, G, items, x, y, w, opts) {
      opts = opts || {};
      const ph = opts.h || PILL, gap = opts.gap === undefined ? GAP : opts.gap;
      items.forEach((it, i) => {
        const k = enter(G, 0.06 + i * 0.05, 0.35);
        const py = y + i * (ph + gap) + (1 - k) * 18, focused = G.focus === i;
        ctx.save();
        ctx.globalAlpha *= clamp01(k * 1.3);
        const sw = focused ? 1.03 : 1;
        const cx = x + w / 2, cy = py + ph / 2;
        ctx.translate(cx, cy); ctx.scale(sw, sw); ctx.translate(-cx, -cy);
        // soft shadow then the pill
        D.rr(ctx, x, py + 3, w, ph, ph / 2); ctx.fillStyle = 'rgba(30,60,120,0.12)'; ctx.fill();
        D.rr(ctx, x, py, w, ph, ph / 2);
        if (focused) {
          const g = ctx.createLinearGradient(x, py, x, py + ph);
          g.addColorStop(0, it.danger ? '#ff8f8f' : '#ffa47e'); g.addColorStop(1, it.danger ? '#e85d5d' : CORAL);
          ctx.fillStyle = g;
        } else ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fill();
        const tc = focused ? '#ffffff' : it.danger ? '#d04a4a' : NAVY;
        const hasRight = it.slider || it.value;
        D.text(ctx, it.label, hasRight ? x + 22 : x + w / 2, cy - (it.sub && focused && !hasRight ? 6 : 0), 16, tc, hasRight ? 'left' : 'center', 800, { display: true });
        if (it.sub && focused) D.text(ctx, it.sub, hasRight ? x + 22 : x + w / 2, cy + (hasRight ? 13 : 11), 10.5, 'rgba(255,255,255,0.9)', hasRight ? 'left' : 'center', 700, { maxWidth: w - 140 });
        if (it.slider) {
          const v = it.slider(), dots = 10, dx = 11, sx = x + w - 30 - dots * dx;
          for (let d = 0; d < dots; d++) {
            ctx.fillStyle = d < v ? (focused ? '#ffffff' : SKY) : focused ? 'rgba(255,255,255,0.35)' : 'rgba(29,53,87,0.15)';
            ctx.beginPath(); ctx.arc(sx + d * dx, cy, d < v ? 4 : 3, 0, Math.PI * 2); ctx.fill();
          }
          D.text(ctx, String(v), x + w - 16, cy, 13, tc, 'right', 800);
          G.buttons.push({ x, y: py, w: sx - x + (dots * dx) / 2, h: ph, focus: i, action: () => it.adjust(-1) });
          G.buttons.push({ x: sx + (dots * dx) / 2, y: py, w: x + w - sx - (dots * dx) / 2, h: ph, focus: i, action: () => it.adjust(1) });
        } else if (it.value) {
          const on = it.value() === 'On', tw = 46, th = 24, tx = x + w - 18 - tw, ty = cy - th / 2;
          D.rr(ctx, tx, ty, tw, th, th / 2);
          ctx.fillStyle = on ? (focused ? 'rgba(255,255,255,0.95)' : SKY) : focused ? 'rgba(255,255,255,0.35)' : 'rgba(29,53,87,0.15)'; ctx.fill();
          ctx.fillStyle = on ? (focused ? CORAL : '#ffffff') : '#ffffff';
          ctx.beginPath(); ctx.arc(on ? tx + tw - th / 2 : tx + th / 2, cy, th / 2 - 3, 0, Math.PI * 2); ctx.fill();
          G.buttons.push({ x, y: py, w, h: ph, focus: i, action: () => it.adjust() });
        } else G.buttons.push({ x, y: py, w, h: ph, focus: i, action: () => G.activate(it) });
        ctx.restore();
      });
      return items.length * (ph + gap) - gap;
    },

    footer(ctx, G, back) {
      if (I.device === 'touch' || I.device === 'mouse') return;
      const parts = [[I.glyph('nav'), 'Move'], [I.glyph('ok'), 'Choose']];
      if (back) parts.push([I.glyph('back'), 'Back']);
      const ws = parts.map(([g, l]) => D.prompt(ctx, g, l, -9999, -9999) + 18);
      let x = this.VW / 2 - ws.reduce((a, b) => a + b, 0) / 2 + 9;
      parts.forEach(([g, l], i) => { D.prompt(ctx, g, l, x, this.VH - 22); x += ws[i]; });
    },
    backButton(ctx, G) {
      D.rr(ctx, 14, 14, 76, 32, 16); ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fill();
      D.text(ctx, '‹ Back', 52, 30.5, 13, NAVY, 'center', 800);
      const m = G.menu();
      G.buttons.push({ x: 10, y: 10, w: 84, h: 40, action: () => m.back && m.back() });
    },
    popIn(ctx, G, cx, cy, fn) {
      const k = enter(G, 0, 0.35), s = 0.92 + 0.08 * easeBack(k);
      ctx.save(); ctx.globalAlpha *= clamp01(k * 1.4);
      ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy - (1 - k) * 12);
      fn(); ctx.restore();
    },

    draw(ctx, G, dpr) {
      ctx.setTransform(dpr * this.k, 0, 0, dpr * this.k, 0, 0);
      G.buttons.length = 0;
      const st = G.state;
      if (st === 'title') this.title(ctx, G);
      else if (st === 'settings') this.settings(ctx, G);
      else if (st === 'howto') this.howto(ctx, G);
      else if (st === 'play' || st === 'over') this.hud(ctx, G);
      else if (st === 'paused') { this.hud(ctx, G); this.paused(ctx, G); }
      else if (st === 'results') this.results(ctx, G);
      this.toast(ctx, G);
      if (I.mouseMoved && I.mouse && I.device === 'mouse') {
        const b = G.hitButton(I.mouse.x, I.mouse.y);
        if (b && b.focus !== undefined && b.focus !== G.focus) { G.focus = b.focus; A.sfx('nav'); }
        I.mouseMoved = false;
      }
      if (G.fade > 0) { ctx.fillStyle = `rgba(255,255,255,${G.fade * 0.85})`; ctx.fillRect(0, 0, this.VW, this.VH); }
    },

    logo(ctx, G, cx, y) {
      const k = enter(G, 0, 0.6), bob = Math.sin(G.time * 1.4) * 3;
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(0, (1 - k) * -20 + bob);
      // a little cloud behind the words
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (const [dx, dy, r] of [[-70, 18, 26], [-38, 4, 34], [6, -2, 40], [52, 8, 32], [84, 22, 22]]) { ctx.beginPath(); ctx.arc(cx + dx, y + dy, r, 0, Math.PI * 2); ctx.fill(); }
      D.text(ctx, 'Sky', cx - 4, y - 8, 54, '#ffffff', 'center', 800, { display: true, shadow: true });
      D.text(ctx, 'Stack', cx + 10, y + 40, 54, CORAL, 'center', 800, { display: true, shadow: true });
      ctx.restore();
    },

    title(ctx, G) {
      const { VW, VH } = this, wide = VW > 760;
      const cx = wide ? 190 : VW / 2;
      this.logo(ctx, G, cx, wide ? VH * 0.2 : VH * 0.14);
      ctx.globalAlpha = enter(G, 0.3, 0.4);
      D.text(ctx, 'One tap. One block. How high can you go?', cx, (wide ? VH * 0.2 : VH * 0.14) + 86, 13, '#ffffff', 'center', 700, { shadow: true });
      ctx.globalAlpha = 1;
      const items = G.menu().items, w = 260;
      const h = items.length * (PILL + GAP);
      const y = wide ? VH * 0.2 + 120 : Math.max(VH * 0.14 + 120, VH - 70 - h);
      this.list(ctx, G, items, cx - w / 2, y, w);
      const sv = G.save, today = sv.daily[SS.today()];
      ctx.globalAlpha = enter(G, 0.5, 0.4);
      D.text(ctx, `Best ${sv.best || 0} floors   ·   Today ${today || 0}`, cx, y + h + 8, 12.5, '#ffffff', 'center', 800, { shadow: true });
      ctx.globalAlpha = 1;
      this.footer(ctx, G, false);
      if (!A.running() && (I.device === 'touch' || I.device === 'mouse')) D.text(ctx, 'Tap anywhere for sound', VW / 2, VH - 18, 11, '#ffffff', 'center', 700, { shadow: true });
    },

    settings(ctx, G) {
      const { VW, VH } = this, items = G.menu().items;
      const ph = Math.min(PILL, (VH - 130) / items.length - 8), w = Math.min(380, VW - 30);
      const h = 70 + items.length * (ph + 8);
      const x = (VW - w) / 2, y = Math.max(10, (VH - h) / 2);
      this.popIn(ctx, G, VW / 2, VH / 2, () => {
        D.card(ctx, x - 12, y, w + 24, h, 28);
        D.text(ctx, 'Settings', VW / 2, y + 32, 24, NAVY, 'center', 800, { display: true });
        this.list(ctx, G, items, x, y + 58, w, { h: ph, gap: 8 });
      });
      this.footer(ctx, G, true);
    },

    howto(ctx, G) {
      const { VW, VH } = this;
      const w = Math.min(400, VW - 24), x = (VW - w) / 2;
      const rules = [
        ['Drop', `${I.device === 'gamepad' ? 'Press A' : I.device === 'touch' ? 'Tap' : 'Press Space or click'} to drop the sliding block on the tower.`],
        ['Slice', 'Whatever hangs over the edge is sliced off, so the next block is smaller.'],
        ['Perfect', 'Line it up exactly for a perfect drop. Three in a row and the block grows back.'],
        ['Weather', 'Every 25 floors the sky changes: gusts of wind, then fog, then a storm with both.'],
        ['Daily', 'The Daily Tower gives everyone the same blocks today.'],
      ];
      const lines = rules.map(([, s]) => D.wrap(ctx, s, w - 120, 13, 700));
      const h = 150 + lines.reduce((a, l) => a + l.length * 17 + 12, 0) + PILL;
      const y = Math.max(8, (VH - h) / 2);
      this.popIn(ctx, G, VW / 2, VH / 2, () => {
        D.card(ctx, x, y, w, h, 28);
        D.text(ctx, 'How to play', VW / 2, y + 32, 24, NAVY, 'center', 800, { display: true });
        // a tiny diagram: the block overhangs, the overhang falls
        const dx = VW / 2, dy = y + 82, s = 26;
        const iso = (px, py, pz) => [dx + (px - pz) * s * 0.866, dy + (px + pz) * s * 0.5 - py * s];
        const face = (pts, c) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach((p) => ctx.lineTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); };
        const box3 = (x0, x1, y0, y1, c1, c2, c3) => {
          face([iso(x0, y1, 0.5), iso(x1, y1, 0.5), iso(x1, y0, 0.5), iso(x0, y0, 0.5)], c2);
          face([iso(x1, y1, -0.5), iso(x1, y1, 0.5), iso(x1, y0, 0.5), iso(x1, y0, -0.5)], c3);
          face([iso(x0, y1, -0.5), iso(x1, y1, -0.5), iso(x1, y1, 0.5), iso(x0, y1, 0.5)], c1);
        };
        box3(-0.5, 0.5, -0.6, -0.1, '#a7d3f5', '#7fb6e6', '#5f98cf');
        const slide = (Math.sin(G.time * 1.6) + 1) * 0.25;
        box3(-0.5 + slide, 0.5, -0.1, 0.4, '#ffc2a3', '#ff9f7a', '#e8805c');
        box3(0.5, 0.5 + slide, -0.1 - (G.time * 0.7 % 1) * 0.6, 0.4 - (G.time * 0.7 % 1) * 0.6, 'rgba(255,194,163,0.6)', 'rgba(255,159,122,0.6)', 'rgba(232,128,92,0.6)');
        let ry = y + 140;
        rules.forEach(([head], i) => {
          D.rr(ctx, x + 22, ry - 11, 70, 22, 11); ctx.fillStyle = i === 2 ? '#fff1d6' : '#e6f1ff'; ctx.fill();
          D.text(ctx, head, x + 57, ry, 12, i === 2 ? GOLD : SKY, 'center', 800);
          lines[i].forEach((l, j) => D.text(ctx, l, x + 104, ry + j * 17, 13, NAVY, 'left', 700));
          ry += lines[i].length * 17 + 12;
        });
        this.list(ctx, G, G.menu().items, x + w / 2 - 90, y + h - PILL - 16, 180);
      });
      this.footer(ctx, G, true);
    },

    hud(ctx, G) {
      const { VW, VH } = this, t = G.tower;
      if (!t) return;
      const h = t.height();
      // the height, big and soft
      const pulse = G.punch * 0.15;
      D.text(ctx, String(h), VW / 2, 70, 64 * (1 + pulse), '#ffffff', 'center', 800, { display: true, shadow: true });
      const sub = t.streak >= 2 ? `Perfect ×${t.streak}` : G.mode === 'daily' ? 'Daily tower' : 'floors';
      D.text(ctx, sub, VW / 2, 112, 15, t.streak >= 2 ? '#fff1b8' : '#ffffff', 'center', 800, { shadow: true });
      // weather chip and the floors left to the next change
      const st = t.stage(), names = ['Clear', 'Windy', 'Foggy', 'Storm'], icons = ['☀', '≋', '☁', '⚡'];
      const into = h % SS.Rules.STAGE_LEN, frac = st === 3 ? 1 : into / SS.Rules.STAGE_LEN;
      D.rr(ctx, 14, 14, 128, 34, 17); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
      D.text(ctx, icons[st] + '  ' + names[st], 30, 27, 13, NAVY, 'left', 800);
      D.rr(ctx, 30, 37, 96, 4, 2); ctx.fillStyle = 'rgba(29,53,87,0.12)'; ctx.fill();
      D.rr(ctx, 30, 37, 96 * frac, 4, 2); ctx.fillStyle = CORAL; ctx.fill();
      // pause
      const px = VW - 46, py = 31;
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(px, py, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = NAVY; ctx.fillRect(px - 6, py - 7, 4, 14); ctx.fillRect(px + 2, py - 7, 4, 14);
      if (G.state === 'play') G.buttons.push({ x: px - 24, y: 6, w: 48, h: 48, action: () => G.pause() });
      // stage banner
      const b = G.stageBanner;
      if (b) {
        const k = easeBack(clamp01(b.t / 0.4)), out = clamp01((b.t - 1.9) / 0.5);
        const w = D.measure(ctx, b.text, 17, 800, { display: true }) + 50, y = 150 + (1 - k) * -30;
        ctx.globalAlpha = clamp01(b.t / 0.2) * (1 - out);
        D.rr(ctx, VW / 2 - w / 2, y - 20, w, 40, 20); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
        D.text(ctx, b.text, VW / 2, y, 17, CORAL, 'center', 800, { display: true });
        ctx.globalAlpha = 1;
      }
      // first-drop prompt
      if (!G.started && G.state === 'play') {
        const a = 0.65 + 0.35 * Math.sin(G.time * 4);
        ctx.globalAlpha = a;
        const g = I.glyph('drop');
        if (I.device === 'touch') D.text(ctx, 'Tap anywhere to drop', VW / 2, VH - 40, 16, '#ffffff', 'center', 800, { shadow: true });
        else D.prompt(ctx, g, 'to drop the block', VW / 2, VH - 40, 'center');
        ctx.globalAlpha = 1;
      } else if (G.state === 'play' && I.device !== 'touch') D.prompt(ctx, I.glyph('pause'), 'Pause', VW - 16, VH - 18, 'right');
    },

    paused(ctx, G) {
      const { VW, VH } = this, items = G.menu().items;
      ctx.fillStyle = `rgba(120,160,220,${0.35 * enter(G, 0, 0.2)})`; ctx.fillRect(0, 0, VW, VH);
      const w = 280, h = 80 + items.length * (PILL + GAP), x = (VW - w) / 2, y = (VH - h) / 2;
      this.popIn(ctx, G, VW / 2, VH / 2, () => {
        D.card(ctx, x - 14, y, w + 28, h, 28);
        D.text(ctx, 'Paused', VW / 2, y + 34, 26, NAVY, 'center', 800, { display: true });
        this.list(ctx, G, items, x, y + 62, w);
      });
      this.footer(ctx, G, true);
    },

    results(ctx, G) {
      const { VW, VH } = this, r = G.result;
      if (!r) return;
      const items = G.menu().items;
      const w = Math.min(340, VW - 30), h = 300 + items.length * (PILL + GAP);
      // beside the tower on wide screens, under it on tall ones
      const side = VW > 700;
      const x = side ? VW - w - 40 : (VW - w) / 2;
      const y = side ? Math.max(10, (VH - h) / 2) : Math.max(10, VH - h - 16);
      const t = G.stateT;
      this.popIn(ctx, G, VW / 2, y + h / 2, () => {
        D.card(ctx, x, y, w, h, 30);
        D.text(ctx, r.newBest ? 'New best!' : 'The tower fell', VW / 2, y + 34, 18, r.newBest ? CORAL : MUTE, 'center', 800, { display: true });
        const shown = Math.round(r.height * easeOut(clamp01((t - 0.15) / 0.8)));
        D.text(ctx, String(shown), VW / 2, y + 96, 76, NAVY, 'center', 800, { display: true });
        D.text(ctx, 'floors', VW / 2, y + 140, 14, MUTE, 'center', 800);
        const rows = [[r.mode === 'daily' ? "Today's best" : 'Best', r.best], ['Perfect drops', r.perfects], ['Longest streak', r.streak], ['Reached', ['Clear skies', 'The wind', 'The fog', 'The storm'][r.stage]]];
        rows.forEach(([a, b], i) => {
          const ry = y + 172 + i * 26, k = clamp01((t - 0.4 - i * 0.08) / 0.3);
          ctx.globalAlpha = k;
          D.text(ctx, a, x + 30, ry, 13.5, MUTE, 'left', 700);
          D.text(ctx, String(b), x + w - 30, ry, 14, NAVY, 'right', 800);
          ctx.globalAlpha = 1;
        });
        this.list(ctx, G, items, x + 26, y + 290, w - 52);
      });
      if (I.device !== 'touch') D.prompt(ctx, I.glyph('restart'), 'Build again', VW / 2, VH - 4 - 10, 'center');
      // little confetti of clouds for a new best
      if (r.newBest && t < 3) {
        for (let i = 0; i < 18; i++) {
          const px = (SS.hash('c' + i) % 1000) / 1000 * VW, py = ((t * 160 + i * 50) % (VH + 40)) - 20;
          ctx.fillStyle = ['#ffd27a', '#ff9f7a', '#9fd2ff', '#ffffff'][i % 4];
          ctx.save(); ctx.translate(px, py); ctx.rotate(t * 3 + i); ctx.fillRect(-4, -2, 8, 4); ctx.restore();
        }
      }
    },

    toast(ctx, G) {
      const m = G.toastMsg;
      if (!m) return;
      const { VW } = this;
      ctx.globalAlpha = clamp01(m.life / 0.3);
      const w = D.measure(ctx, m.str, 13, 800) + 40;
      D.rr(ctx, (VW - w) / 2, 60, w, 34, 17); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      D.text(ctx, m.str, VW / 2, 77, 13, NAVY, 'center', 800);
      ctx.globalAlpha = 1;
    },
  };
  SS.UI = UI;
})();
