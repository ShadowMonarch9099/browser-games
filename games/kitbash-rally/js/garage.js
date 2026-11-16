// The garage: a workshop scene with the kart on a turntable, built live from
// its six parts. Pick a slot (the tags on either side of the kart), then a
// part from the rack; the part drops in with a burst of welding sparks and the
// spec sheet's gauges swing to the new numbers.
(function () {
  const KR = window.KR;
  const U = KR.UI, C = U.C, FONT = U.FONT, BODY = U.BODY;
  const W = 960, H = 540;
  const CX = 300, CY = 352;
  const SLOT_SHORT = ['FRONT L', 'FRONT R', 'MIDDLE L', 'MIDDLE R', 'BACK L', 'BACK R'];
  const TAG = (i) => ({ x: i % 2 ? 462 : 16, y: 132 + Math.floor(i / 2) * 104, w: 124, h: 62 });
  const STATS = [['TOP SPEED', (s) => s.topSpeed, 26, 1], ['PICK-UP', (s) => s.accel, 14, 1], ['GRIP', (s) => s.grip * 10, 11.5, 1], ['WEIGHT', (s) => s.mass, 26, 0]];

  const G = {
    sel: 0, yaw: 0, drag: 0, anim: [0, 0, 0, 0, 0, 0], disp: null, sparks: [], faces: null, facesKey: '', icons: null, bg: null, hoverPart: null,
    enterT: 0,
  };

  function icons() {
    if (G.icons) return G.icons;
    G.icons = {};
    for (const id of KR.PALETTE) G.icons[id] = KR.Model.icon(id, 84, 64);
    return G.icons;
  }

  // ---------- static workshop backdrop ----------
  function backdrop() {
    if (G.bg) return G.bg;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const r = KR.util.rng(42);
    // corrugated wall
    for (let x = 0; x < W; x += 16) {
      const gr = g.createLinearGradient(x, 0, x + 16, 0);
      gr.addColorStop(0, '#2b2f36'); gr.addColorStop(0.5, '#3a3f48'); gr.addColorStop(1, '#22262c');
      g.fillStyle = gr; g.fillRect(x, 0, 16, 380);
    }
    // rust streaks and grime
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${120 + r() * 60},${50 + r() * 30},20,${0.05 + r() * 0.08})`; g.fillRect(r() * W, 20 + r() * 200, 3 + r() * 6, 40 + r() * 140); }
    // painted sign on the wall
    g.save(); g.translate(300, 60); g.rotate(-0.02);
    g.fillStyle = 'rgba(255,194,26,0.12)'; g.font = '64px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('KITBASH WORKS', 0, 0);
    g.restore();
    // pegboard with tool silhouettes
    g.fillStyle = '#6b4f34'; g.fillRect(170, 96, 260, 120);
    g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 104; y < 212; y += 12) for (let x = 178; x < 426; x += 12) { g.beginPath(); g.arc(x, y, 1.6, 0, 6.283); g.fill(); }
    g.fillStyle = '#1a1c20';
    // spanner
    g.save(); g.translate(205, 156); g.rotate(0.3); g.fillRect(-4, -40, 8, 70); g.beginPath(); g.arc(0, -44, 12, 0, 6.283); g.fill(); g.fillStyle = '#6b4f34'; g.fillRect(-5, -60, 10, 14); g.restore();
    g.fillStyle = '#1a1c20';
    // hammer
    g.fillRect(250, 118, 7, 80); g.fillRect(236, 112, 36, 16);
    // saw
    g.beginPath(); g.moveTo(290, 120); g.lineTo(370, 120); g.lineTo(370, 150); g.lineTo(300, 170); g.closePath(); g.fill();
    // screwdrivers
    for (let k = 0; k < 4; k++) { g.fillRect(388 + k * 9, 120, 5, 34); g.fillRect(389 + k * 9, 154, 3, 30); }
    // shelf with tins on the right of the kart area
    g.fillStyle = '#4a3a2a'; g.fillRect(470, 230, 120, 8);
    [['#d7263d', 480], ['#2a6fdb', 506], ['#ffc21a', 532], ['#16c79a', 558]].forEach(([col, x]) => { g.fillStyle = col; g.fillRect(x, 202, 20, 28); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 3, 206, 4, 20); });
    // hazard band along the base of the wall
    U.hazard(g, 0, 372, 600, 12, 0);
    // concrete floor with perspective seams
    const fg = g.createLinearGradient(0, 384, 0, H); fg.addColorStop(0, '#4c4a46'); fg.addColorStop(1, '#2c2a27');
    g.fillStyle = fg; g.fillRect(0, 384, W, H - 384);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5;
    for (let k = -10; k <= 10; k++) { g.beginPath(); g.moveTo(CX + k * 40, 384); g.lineTo(CX + k * 160, H); g.stroke(); }
    for (let k = 0; k < 5; k++) { const y = 384 + Math.pow(k / 5, 1.8) * 160 + 10; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(10,8,6,${0.15 + r() * 0.2})`; g.beginPath(); g.ellipse(r() * 600, 410 + r() * 120, 20 + r() * 50, 6 + r() * 12, 0, 0, 6.283); g.fill(); }
    // tyre stack in the corner
    for (let k = 0; k < 4; k++) { g.fillStyle = '#141418'; g.beginPath(); g.ellipse(560, 470 - k * 22, 46, 16, 0, 0, 6.283); g.fill(); g.fillStyle = '#2a2a30'; g.beginPath(); g.ellipse(560, 466 - k * 22, 20, 6, 0, 0, 6.283); g.fill(); }
    // the lamp cord
    g.fillStyle = '#111'; g.fillRect(CX - 1, 0, 2, 70);
    G.bg = c;
    return c;
  }

  function faces(build, color) {
    const key = build.join(',') + color;
    if (key !== G.facesKey) { G.faces = KR.Model.buildKart(build, color); G.facesKey = key; }
    return G.faces;
  }

  function enter() { G.enterT = 0; G.disp = null; G.sparks.length = 0; }

  function fit(g, id) {
    const b = g.builds[g.editing];
    const slot = G.sel;
    if (b[slot] === id) { KR.Audio.play('select'); return; }
    const was = b[slot];
    b[slot] = id;
    g.storeBuilds();
    G.anim[slot] = id === 'empty' ? 0 : 1;
    KR.Audio.play(id === 'empty' ? 'remove' : 'fit');
    if (id === 'engine' || id === 'turbo') KR.Audio.play('rev', { delay: 0.3 });
    if (id === 'spring') KR.Audio.play('hop', { delay: 0.3, vol: 0.6 });
    if (id === 'empty' && was !== 'empty') spark(g, slot, 8);
    g.shake(id === 'turbo' || id === 'plate' ? 0.25 : 0.12);
  }
  function view() {
    return { cx: CX, cy: CY + 6, F: 760, D: 8.5, yaw: G.yaw, pitch: 0.56 };
  }
  function spark(g, slot, n) {
    const a = KR.Model.slotAnchor(slot), p = KR.Model.project(a.x, a.y + 0.3, a.z, view());
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = 120 + Math.random() * 260;
      G.sparks.push({ x: p.x, y: p.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 0.4 + Math.random() * 0.5, col: Math.random() < 0.5 ? '#fff2b0' : '#ffb347' });
    }
  }

  function update(g, dt) {
    G.enterT += dt;
    const I = KR.Input;
    if (I.drag && I.drag.x0 < 600 && I.drag.y0 > 110 && I.drag.y0 < 480) { G.drag += I.drag.dx * 0.012; I.drag.dx = 0; }
    G.yaw = Math.sin(g.time * 0.35) * 0.42 + G.drag;
    for (let i = 0; i < 6; i++) if (G.anim[i] > 0) { G.anim[i] = Math.max(0, G.anim[i] - dt * 3.2); if (G.anim[i] === 0) spark(g, i, 26); }
    for (let i = G.sparks.length - 1; i >= 0; i--) { const s = G.sparks[i]; s.life -= dt; s.vy += 900 * dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.life <= 0) G.sparks.splice(i, 1); }
    // focusing a slot selects it
    const f = g.focusId;
    if (f && f.indexOf('slot') === 0) G.sel = +f.slice(4);
    G.hoverPart = f && f.indexOf('part:') === 0 ? f.slice(5) : null;
    const s = KR.stats(g.builds[g.editing]);
    const target = STATS.map((st) => st[1](s));
    if (!G.disp) G.disp = target.map(() => 0);
    G.disp = G.disp.map((v, i) => v + (target[i] - v) * Math.min(1, dt * 5));
  }

  function draw(ctx, g) {
    const b = g.builds[g.editing], color = KR.HUMANS[g.editing].color, s = KR.stats(b);
    if (!G.disp) G.disp = [0, 0, 0, 0];
    const t = g.time, e = U.easeOut(G.enterT / 0.5);
    ctx.drawImage(backdrop(), 0, 0);
    // lamp + light cone
    ctx.fillStyle = '#2a2e36'; ctx.beginPath(); ctx.moveTo(CX - 34, 92); ctx.lineTo(CX - 14, 66); ctx.lineTo(CX + 14, 66); ctx.lineTo(CX + 34, 92); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff4cc'; ctx.beginPath(); ctx.ellipse(CX, 92, 30, 5, 0, 0, 6.283); ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flick = 0.92 + Math.sin(t * 23) * 0.02 + Math.sin(t * 7.1) * 0.03;
    const cone = ctx.createLinearGradient(0, 92, 0, 440);
    cone.addColorStop(0, `rgba(255,236,180,${0.22 * flick})`); cone.addColorStop(1, 'rgba(255,236,180,0.02)');
    ctx.fillStyle = cone;
    ctx.beginPath(); ctx.moveTo(CX - 30, 92); ctx.lineTo(CX + 30, 92); ctx.lineTo(CX + 250, 430); ctx.lineTo(CX - 250, 430); ctx.closePath(); ctx.fill();
    const pool = ctx.createRadialGradient(CX, CY + 40, 20, CX, CY + 40, 260);
    pool.addColorStop(0, `rgba(255,230,170,${0.16 * flick})`); pool.addColorStop(1, 'rgba(255,230,170,0)');
    ctx.fillStyle = pool; ctx.fillRect(CX - 280, CY - 120, 560, 300);
    ctx.restore();

    // turntable
    ctx.fillStyle = '#1c1d21'; ctx.beginPath(); ctx.ellipse(CX, CY + 36, 228, 66, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#3a3e46'; ctx.beginPath(); ctx.ellipse(CX, CY + 28, 222, 62, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(255,194,26,0.55)'; ctx.lineWidth = 2;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2 + G.yaw;
      const x1 = CX + Math.cos(a) * 200, y1 = CY + 28 + Math.sin(a) * 55, x2 = CX + Math.cos(a) * 214, y2 = CY + 28 + Math.sin(a) * 59;
      if (Math.sin(a) > -0.2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(CX, CY + 26, 150, 40, 0, 0, 6.283); ctx.fill();

    // the kart
    const v = view();
    const offs = G.anim.map((a) => a * a * 3.2);
    const pop = g.pressPulse > 0 ? 1 : 0;
    KR.Model.draw(ctx, faces(b, color), Object.assign({}, v, { offsets: offs, outline: 1.4, cy: v.cy - pop }));

    // slot tags with leader lines
    const ic = icons();
    for (let i = 0; i < 6; i++) {
      const r = TAG(i), id = 'slot' + i, f = g.isFocus(id), selected = G.sel === i;
      const a = KR.Model.slotAnchor(i), p = KR.Model.project(a.x, a.y + 0.35, a.z, v);
      const k = U.easeOut((G.enterT - 0.1 - i * 0.05) / 0.35);
      const rx = r.x + (1 - k) * (i % 2 ? 80 : -80);
      ctx.globalAlpha = k;
      ctx.strokeStyle = selected ? C.yellow : 'rgba(242,234,216,0.35)'; ctx.lineWidth = selected ? 2 : 1;
      ctx.setLineDash(selected ? [] : [4, 4]);
      ctx.beginPath(); ctx.moveTo(i % 2 ? rx : rx + r.w, r.y + r.h / 2); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = selected ? C.yellow : C.ink; ctx.beginPath(); ctx.arc(p.x, p.y, selected ? 5 + Math.sin(t * 6) * 1.5 : 3, 0, 6.283); ctx.fill();
      g.reg({ id, x: rx, y: r.y, w: r.w, h: r.h, action: () => { G.sel = i; KR.Audio.play('select'); if (KR.Input.device !== 'touch' && !g.lastWasClick) g.setFocus('part:' + b[i]); } });
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(rx + 4, r.y + 5, r.w, r.h);
      ctx.fillStyle = f ? C.yellow : selected ? '#4d4220' : 'rgba(30,32,38,0.92)'; ctx.fillRect(rx, r.y, r.w, r.h);
      ctx.strokeStyle = selected ? C.yellow : 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(rx + 1, r.y + 1, r.w - 2, r.h - 2);
      U.text(ctx, SLOT_SHORT[i], rx + 8, r.y + 11, 10, f ? C.black : C.yellow, 'left', FONT);
      ctx.drawImage(ic[b[i]], rx + r.w - 62, r.y + 10, 58, 44);
      U.text(ctx, KR.PARTS[b[i]].short, rx + 8, r.y + 36, 18, f ? C.black : C.ink, 'left', FONT);
      U.text(ctx, KR.PARTS[b[i]].name, rx + 8, r.y + 52, 12, f ? 'rgba(22,19,15,0.75)' : C.mute, 'left', BODY, { weight: 600, max: r.w - 60 });
      ctx.globalAlpha = 1;
    }
    for (const sp of G.sparks) { ctx.globalAlpha = Math.min(1, sp.life * 2); ctx.strokeStyle = sp.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(sp.x - sp.vx * 0.025, sp.y - sp.vy * 0.025); ctx.stroke(); }
    ctx.globalAlpha = 1;

    // header
    U.text(ctx, 'GARAGE', 20, 34, 34, C.yellow, 'left', FONT, { shadow: 'rgba(0,0,0,0.6)' });
    U.text(ctx, g.garageSub(), 22, 66, 15, C.mute, 'left', BODY, { weight: 600 });
    if (g.humans === 2) {
      for (let i = 0; i < 2; i++) U.button(ctx, g, 'tab' + i, 210 + i * 130, 18, 120, 34, 'P' + (i + 1) + ' KART', { size: 14, color: KR.HUMANS[i].color, primary: g.editing === i, action: () => g.editKart(i) });
    }

    // parts rack
    const px = 606, py = 14, pw = 340;
    ctx.save(); ctx.translate((1 - e) * 120, 0); ctx.globalAlpha = e;
    U.panel(ctx, px, py, pw, 300, 'PARTS RACK', { size: 18, t });
    U.text(ctx, 'FIT TO ' + SLOT_SHORT[G.sel], px + pw - 20, py + 34, 12, C.ink, 'right', FONT);
    KR.PALETTE.forEach((id, n) => {
      const cx = px + 16 + (n % 3) * 104, cy = py + 54 + Math.floor(n / 3) * 80, fid = 'part:' + id, f = g.isFocus(fid), cur = b[G.sel] === id;
      g.reg({ id: fid, x: cx, y: cy, w: 100, h: 74, action: () => { fit(g, id); if (KR.Input.device !== 'touch' && !g.lastWasClick) g.setFocus('slot' + G.sel); } });
      ctx.fillStyle = f ? C.yellow : cur ? 'rgba(255,194,26,0.18)' : 'rgba(10,10,12,0.45)'; ctx.fillRect(cx, cy, 100, 74);
      if (cur) { ctx.strokeStyle = C.yellow; ctx.lineWidth = 2; ctx.strokeRect(cx + 1, cy + 1, 98, 72); }
      ctx.drawImage(ic[id], cx + 8, cy + 2 + (f ? Math.sin(t * 6) * 2 : 0), 84, 50);
      U.text(ctx, KR.PARTS[id].name.toUpperCase(), cx + 50, cy + 62, 10, f ? C.black : C.ink, 'center', FONT, { max: 94 });
      if (KR.PARTS[id].mass) U.text(ctx, KR.PARTS[id].mass + 'kg', cx + 96, cy + 10, 11, f ? 'rgba(22,19,15,0.7)' : C.faint, 'right', BODY, { weight: 700 });
    });
    ctx.restore();

    // spec sheet
    const sy = 324;
    ctx.save(); ctx.translate((1 - U.easeOut((G.enterT - 0.12) / 0.5)) * 140, 0);
    U.panel(ctx, px, sy, pw, 156, null);
    const hover = G.hoverPart ? (() => { const nb = b.slice(); nb[G.sel] = G.hoverPart; return KR.stats(nb); })() : null;
    STATS.forEach(([label, fn, max, good], i) => {
      const y = sy + 22 + i * 24, bx = px + 104, bw = 150;
      U.text(ctx, label, px + 18, y, 11, C.mute, 'left', FONT);
      ctx.fillStyle = '#121418'; ctx.fillRect(bx, y - 6, bw, 12);
      const cur = clamp01(G.disp[i] / max);
      // segmented LED bar
      for (let k = 0; k < 20; k++) {
        const on = k / 20 < cur;
        ctx.fillStyle = on ? (good ? (k > 15 ? '#16c79a' : C.yellow) : k > 14 ? C.red : '#c9a26a') : 'rgba(255,255,255,0.06)';
        ctx.fillRect(bx + 1 + k * 7.45, y - 5, 6, 10);
      }
      if (hover) {
        const nv = clamp01(fn(hover) / max), d = nv - clamp01(fn(s) / max);
        if (Math.abs(d) > 0.004) {
          const better = good ? d > 0 : d < 0;
          ctx.fillStyle = better ? 'rgba(22,199,154,0.75)' : 'rgba(215,38,61,0.75)';
          ctx.fillRect(bx + Math.min(nv, cur) * bw, y - 7, Math.abs(d) * bw, 3);
          U.text(ctx, (d > 0 ? '+' : '') + (fn(hover) - fn(s)).toFixed(1), px + pw - 20, y, 12, better ? C.green : '#ff7a7a', 'right', FONT);
        } else U.text(ctx, G.disp[i].toFixed(1), px + pw - 20, y, 12, C.ink, 'right', FONT);
      } else U.text(ctx, G.disp[i].toFixed(1), px + pw - 20, y, 12, C.ink, 'right', FONT);
    });
    // spirit level: the bubble drifts to the light side
    const ly = sy + 120, lx = px + 18, lw = 150;
    ctx.fillStyle = '#121418'; ctx.fillRect(lx, ly - 11, lw, 22);
    ctx.fillStyle = '#9ed36a'; ctx.fillRect(lx + 3, ly - 8, lw - 6, 16);
    ctx.fillStyle = '#121418'; ctx.fillRect(lx + lw / 2 - 14, ly - 8, 2, 16); ctx.fillRect(lx + lw / 2 + 12, ly - 8, 2, 16);
    const pull = s.pull, bxp = lx + lw / 2 - Math.max(-60, Math.min(60, pull * 9)) + Math.sin(t * 2) * 0.8;
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(bxp, ly, 11, 6, 0, 0, 6.283); ctx.fill();
    U.text(ctx, Math.abs(pull) < 1 ? 'BALANCED' : 'PULLS ' + (pull > 0 ? 'RIGHT' : 'LEFT'), lx, ly + 22, 11, Math.abs(pull) < 1 ? C.green : '#ff9a5a', 'left', FONT);
    // power lamps
    [['BOOSTS', s.rocket, '#ff8a1f'], ['HOP', s.spring, '#16c79a'], ['MAGNET', s.magnet, '#9d4edd'], ['ARMOUR', s.armor, '#8d99ae']].forEach(([l, on, col], i) => {
      const x = px + 196 + (i % 2) * 74, y = sy + 116 + Math.floor(i / 2) * 22;
      ctx.fillStyle = on ? col : '#2a1818'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.283); ctx.fill();
      if (on) { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(x - 2, y - 2, 2, 0, 6.283); ctx.fill(); }
      U.text(ctx, l, x + 11, y, 10, on ? C.ink : C.faint, 'left', FONT);
    });
    ctx.restore();

    // blurb for the focused part
    const show = G.hoverPart || b[G.sel];
    U.text(ctx, KR.PARTS[show].blurb, 606, 498 - 0, 15, C.ink, 'left', BODY, { weight: 600, max: 340 });

    // bottom bar
    U.button(ctx, g, 'back', 20, 486, 120, 40, 'BACK', { size: 15, action: () => g.backFromGarage() });
    U.button(ctx, g, 'reset', 152, 486, 140, 40, 'RESET KART', { size: 14, action: () => { g.builds[g.editing] = KR.DEFAULT.slice(); g.storeBuilds(); KR.Audio.play('fit'); for (let i = 0; i < 6; i++) G.anim[i] = 0.5 + i * 0.1; } });
    U.button(ctx, g, 'start', 312, 480, 270, 50, g.startLabel(), { size: 20, primary: true, action: () => g.startFromGarage() });
    U.prompts(ctx, g.humans === 2 ? [['confirm', 'Fit'], ['tabs', 'Switch kart'], ['back', 'Back']] : [['confirm', 'Fit'], ['back', 'Back']], 946, 524, 'right');
  }
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  KR.Garage = { G, enter, update, draw, fit };
})();
