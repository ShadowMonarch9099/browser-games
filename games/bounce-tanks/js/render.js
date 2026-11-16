// Bounce Tanks drawing: a toy battlefield on a wooden table. The table, felt
// mat and wall shadows are painted once per maze onto a background canvas;
// tread marks and scorch marks build up on a decal canvas; walls, tanks and
// shells are drawn every frame back-to-front as raised (extruded) shapes.
(function () {
  const S = BT.Sim, COLS = S.COLS, ROWS = S.ROWS, TAU = Math.PI * 2;
  const DISPLAY = '"Bungee", "Impact", "Arial Black", sans-serif';
  const BODY = '"Rubik", "Segoe UI", system-ui, sans-serif';
  const WALL_H = 0.2; // how far a wall's top is lifted, in cells

  const R = {
    canvas: null, ctx: null, W: 0, H: 0, dpr: 1, u: 40, ox: 0, oy: 0, hs: 1,
    bg: null, bgKey: '', decals: null, dctx: null, decalKey: '',
    parts: [], shake: 0, flash: 0, time: 0, banner: null, marks: new Map(),
    DISPLAY, BODY,

    init(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.bg = document.createElement('canvas');
      this.decals = document.createElement('canvas'); this.dctx = this.decals.getContext('2d');
      addEventListener('resize', () => this.resize());
      this.resize();
    },
    resize() {
      const c = this.canvas;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.W = c.clientWidth || innerWidth; this.H = c.clientHeight || innerHeight;
      c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr);
      this.bgKey = '';
    },
    layout(hud) {
      const W = this.W, H = this.H;
      const hs = this.hs = BT.clamp(Math.min(W / 1000, H / 620), 0.5, 1.5);
      const top = hud ? 62 * hs : 10 * hs;
      const u = this.u = Math.min((W - 30 * hs) / (COLS + 0.7), (H - top - 22 * hs) / (ROWS + 0.85));
      this.ox = (W - COLS * u) / 2;
      this.oy = top + (H - top - ROWS * u) / 2 + u * 0.1;
    },

    // ---------- static layers ----------
    paintBackground(m) {
      const W = this.W, H = this.H, u = this.u, ox = this.ox, oy = this.oy, dpr = this.dpr;
      const bg = this.bg; bg.width = this.canvas.width; bg.height = this.canvas.height;
      const g = bg.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rand = BT.rng(77);
      // table planks
      const ph = Math.max(46, H / 9);
      for (let y = 0, i = 0; y < H; y += ph, i++) {
        g.fillStyle = ['#7a5536', '#6f4c30', '#80593a', '#74502f'][i % 4];
        g.fillRect(0, y, W, ph);
        g.strokeStyle = 'rgba(40,22,10,.35)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
        for (let k = 0; k < 9; k++) {
          const gy = y + rand() * ph, gx = rand() * W, len = 60 + rand() * 220;
          g.strokeStyle = 'rgba(' + (rand() < 0.5 ? '40,22,10' : '255,220,170') + ',' + (0.05 + rand() * 0.08) + ')'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(gx, gy); g.bezierCurveTo(gx + len * 0.3, gy - 3, gx + len * 0.6, gy + 3, gx + len, gy); g.stroke();
        }
        const bx = ((i * 277) % W + W * 0.2) % W;
        g.fillStyle = 'rgba(40,22,10,.4)'; g.fillRect(bx, y, 2, ph);
      }
      // props scattered round the mat
      const mx = ox - u * 0.42, my = oy - u * 0.5, mw = COLS * u + u * 0.84, mh = ROWS * u + u * 0.92;
      this.prop(g, 'pencil', mx - u * 0.5, my + mh * 0.3, u);
      this.prop(g, 'die', mx + mw + u * 0.45, my + mh * 0.2, u);
      this.prop(g, 'die2', mx + mw + u * 0.7, my + mh * 0.33, u);
      this.prop(g, 'tokens', mx - u * 0.6, my + mh * 0.82, u);
      this.prop(g, 'ruler', mx + mw + u * 0.55, my + mh * 0.75, u);
      // mat shadow + felt
      g.fillStyle = 'rgba(20,10,4,.38)'; round(g, mx + u * 0.08, my + u * 0.12, mw, mh, u * 0.16); g.fill();
      const felt = g.createLinearGradient(0, my, 0, my + mh);
      felt.addColorStop(0, '#4b8f58'); felt.addColorStop(1, '#3a7447');
      g.fillStyle = felt; round(g, mx, my, mw, mh, u * 0.16); g.fill();
      g.save(); round(g, mx, my, mw, mh, u * 0.16); g.clip();
      for (let k = 0; k < 2600; k++) {
        g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.05)';
        g.fillRect(mx + rand() * mw, my + rand() * mh, 1.5, 1.5);
      }
      // chalk grid: a nod to the battle plan this game started as
      g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 1.2; g.setLineDash([u * 0.08, u * 0.08]);
      g.beginPath();
      for (let c = 1; c < COLS; c++) { g.moveTo(ox + c * u, oy); g.lineTo(ox + c * u, oy + ROWS * u); }
      for (let r = 1; r < ROWS; r++) { g.moveTo(ox, oy + r * u); g.lineTo(ox + COLS * u, oy + r * u); }
      g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(255,255,255,.16)'; g.font = '600 ' + Math.round(u * 0.14) + 'px ' + BODY; g.textAlign = 'left'; g.textBaseline = 'top';
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if ((c + r) % 3 === 0) g.fillText('ABCDEFGHI'[c] + (r + 1), ox + c * u + u * 0.08, oy + r * u + u * 0.08);
      // wall shadows fall to the south-east
      if (m) {
        g.fillStyle = 'rgba(12,30,16,.34)';
        for (const w of m.walls) {
          const x = ox + w[0] * u, y = oy + w[1] * u, ww = w[2] * u, hh = w[3] * u, sx = u * 0.11, sy = u * 0.15;
          g.beginPath(); g.moveTo(x, y + hh); g.lineTo(x + ww, y); g.lineTo(x + ww + sx, y + sy); g.lineTo(x + ww + sx, y + hh + sy); g.lineTo(x + sx, y + hh + sy); g.closePath(); g.fill();
        }
      }
      g.restore();
      // stitched edge
      g.strokeStyle = 'rgba(255,240,200,.55)'; g.lineWidth = Math.max(1.5, u * 0.022); g.setLineDash([u * 0.09, u * 0.07]);
      round(g, mx + u * 0.09, my + u * 0.09, mw - u * 0.18, mh - u * 0.18, u * 0.1); g.stroke(); g.setLineDash([]);
      // lamp light and vignette
      const v = g.createRadialGradient(W * 0.46, H * 0.4, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.72);
      v.addColorStop(0, 'rgba(255,236,190,.10)'); v.addColorStop(0.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(18,8,2,.62)');
      g.fillStyle = v; g.fillRect(0, 0, W, H);
    },
    prop(g, kind, x, y, u) {
      g.save(); g.translate(x, y);
      const shadow = (fn) => { g.save(); g.translate(u * 0.05, u * 0.07); g.fillStyle = 'rgba(20,10,4,.35)'; fn(); g.fill(); g.restore(); };
      if (kind === 'pencil') {
        g.rotate(1.35);
        shadow(() => { g.beginPath(); g.rect(-u * 0.9, -u * 0.05, u * 1.8, u * 0.1); });
        g.fillStyle = '#f2c230'; g.fillRect(-u * 0.9, -u * 0.05, u * 1.6, u * 0.1);
        g.fillStyle = '#d9a514'; g.fillRect(-u * 0.9, 0, u * 1.6, u * 0.05);
        g.fillStyle = '#e8c9a0'; g.beginPath(); g.moveTo(u * 0.7, -u * 0.05); g.lineTo(u * 0.9, 0); g.lineTo(u * 0.7, u * 0.05); g.fill();
        g.fillStyle = '#333'; g.beginPath(); g.moveTo(u * 0.84, -u * 0.016); g.lineTo(u * 0.9, 0); g.lineTo(u * 0.84, u * 0.016); g.fill();
        g.fillStyle = '#e88'; g.fillRect(-u * 1.0, -u * 0.05, u * 0.1, u * 0.1); g.fillStyle = '#bbb'; g.fillRect(-u * 0.92, -u * 0.05, u * 0.05, u * 0.1);
      } else if (kind === 'die' || kind === 'die2') {
        g.rotate(kind === 'die' ? 0.3 : -0.5); const s = u * 0.3;
        shadow(() => round(g, -s / 2, -s / 2, s, s, s * 0.2));
        g.fillStyle = '#c9b89a'; round(g, -s / 2, -s / 2 + s * 0.14, s, s, s * 0.2); g.fill();
        g.fillStyle = '#fbf3df'; round(g, -s / 2, -s / 2, s, s, s * 0.2); g.fill();
        g.fillStyle = '#b3261e';
        for (const p of kind === 'die' ? [[-1, -1], [0, 0], [1, 1], [-1, 1], [1, -1]] : [[-1, -1], [1, 1]]) { g.beginPath(); g.arc(p[0] * s * 0.25, p[1] * s * 0.25, s * 0.08, 0, TAU); g.fill(); }
      } else if (kind === 'tokens') {
        BT.TEAMS.forEach((t, i) => {
          const px = (i % 2) * u * 0.34 - u * 0.1, py = Math.floor(i / 2) * u * 0.3 - (i % 2) * u * 0.08, r = u * 0.15;
          g.fillStyle = 'rgba(20,10,4,.35)'; g.beginPath(); g.arc(px + u * 0.04, py + u * 0.07, r, 0, TAU); g.fill();
          g.fillStyle = t.dark; g.beginPath(); g.arc(px, py + r * 0.3, r, 0, TAU); g.fill();
          g.fillStyle = t.color; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
          g.strokeStyle = t.light; g.lineWidth = 1.5; g.beginPath(); g.arc(px, py, r * 0.62, 0, TAU); g.stroke();
        });
      } else if (kind === 'ruler') {
        g.rotate(-1.42);
        shadow(() => { g.beginPath(); g.rect(-u * 1.1, -u * 0.12, u * 2.2, u * 0.24); });
        g.fillStyle = '#e2c48a'; g.fillRect(-u * 1.1, -u * 0.12, u * 2.2, u * 0.24);
        g.strokeStyle = 'rgba(70,40,10,.7)'; g.lineWidth = 1; g.beginPath();
        for (let k = 0; k <= 22; k++) { const px = -u * 1.05 + k * u * 0.095; g.moveTo(px, -u * 0.12); g.lineTo(px, -u * (k % 5 ? 0.06 : 0.01)); }
        g.stroke();
      }
      g.restore();
    },
    resetDecals() {
      const u = this.u, pad = Math.ceil(u * 0.5);
      this.decals.width = Math.ceil((COLS * u + pad * 2) * this.dpr); this.decals.height = Math.ceil((ROWS * u + pad * 2) * this.dpr);
      this.dctx.setTransform(this.dpr, 0, 0, this.dpr, pad * this.dpr, pad * this.dpr);
      this.decalPad = pad; this.marks.clear();
    },

    // ---------- effects ----------
    spawn(p) { if (this.parts.length < 520) this.parts.push(Object.assign({ t: 0, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, vr: 0, g: 0 }, p)); },
    onEvent(e, m) {
      const rnd = Math.random, st = BT.Save.data.settings;
      if (e.t === 'fire') {
        const bx = e.x + Math.cos(e.a) * 0.36, by = e.y + Math.sin(e.a) * 0.36;
        this.spawn({ type: 'flash', x: bx, y: by, z: 0.12, life: 0.09, size: e.fast ? 0.3 : 0.22, color: e.fast ? '#fff9b0' : '#ffe6a0' });
        for (let i = 0; i < 4; i++) this.spawn({ type: 'smoke', x: bx, y: by, z: 0.12, vx: Math.cos(e.a) * 0.6 + (rnd() - 0.5) * 0.6, vy: Math.sin(e.a) * 0.6 + (rnd() - 0.5) * 0.6, vz: 0.25, life: 0.45, size: 0.07 });
        this.shake = Math.max(this.shake, e.fast || e.triple ? 3 : 1.6);
      } else if (e.t === 'bounce') {
        for (let i = 0; i < 4; i++) this.spawn({ type: 'spark', x: e.x, y: e.y, z: 0.1, vx: (rnd() - 0.5) * 3, vy: (rnd() - 0.5) * 3, vz: 0.6 + rnd(), g: 5, life: 0.25, size: 0.03, color: e.fast ? '#fff27a' : '#fff' });
        this.spawn({ type: 'ring', x: e.x, y: e.y, z: 0.1, life: 0.18, size: 0.14, color: '#fff' });
        for (let i = 0; i < 2; i++) this.spawn({ type: 'debris', x: e.x, y: e.y, z: 0.15, vx: (rnd() - 0.5) * 1.6, vy: (rnd() - 0.5) * 1.6, vz: 1.2, g: 7, life: 0.45, size: 0.025, color: '#d9b47a', vr: 9 });
      } else if (e.t === 'boom') {
        const t = BT.TEAMS[m.tanks[e.i].team];
        this.spawn({ type: 'flash', x: e.x, y: e.y, z: 0.1, life: 0.16, size: 0.75, color: '#fff' });
        this.spawn({ type: 'ring', x: e.x, y: e.y, z: 0.02, life: 0.45, size: 1.1, color: '#ffe6a0' });
        this.spawn({ type: 'ring', x: e.x, y: e.y, z: 0.02, life: 0.3, size: 0.6, color: t.light });
        for (let i = 0; i < 16; i++) { const a = rnd() * TAU, sp = 0.8 + rnd() * 2.6; this.spawn({ type: 'debris', x: e.x, y: e.y, z: 0.1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 1.5 + rnd() * 2.5, g: 8, life: 0.7 + rnd() * 0.5, size: 0.03 + rnd() * 0.04, color: [t.color, t.dark, '#2b2420', t.light][i % 4], vr: (rnd() - 0.5) * 20 }); }
        for (let i = 0; i < 10; i++) { const a = rnd() * TAU, sp = rnd() * 0.7; this.spawn({ type: 'smoke', x: e.x, y: e.y, z: 0.1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 0.4 + rnd() * 0.5, life: 0.8 + rnd() * 0.7, size: 0.13 + rnd() * 0.1, dark: i % 2 }); }
        for (let i = 0; i < 8; i++) { const a = rnd() * TAU; this.spawn({ type: 'spark', x: e.x, y: e.y, z: 0.1, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, vz: 1 + rnd(), g: 4, life: 0.3, size: 0.035, color: '#ffd166' }); }
        this.shake = 13; if (st.flashes) this.flash = 0.5;
        // scorch mark
        const d = this.dctx, u = this.u, px = e.x * u, py = e.y * u;
        const sc = d.createRadialGradient(px, py, 0, px, py, u * 0.5);
        sc.addColorStop(0, 'rgba(15,12,8,.55)'); sc.addColorStop(0.6, 'rgba(15,12,8,.25)'); sc.addColorStop(1, 'rgba(15,12,8,0)');
        d.fillStyle = sc; d.beginPath(); d.arc(px, py, u * 0.5, 0, TAU); d.fill();
        d.strokeStyle = 'rgba(15,12,8,.3)'; d.lineWidth = u * 0.02;
        for (let i = 0; i < 9; i++) { const a = rnd() * TAU, r1 = u * (0.2 + rnd() * 0.15), r2 = u * (0.4 + rnd() * 0.25); d.beginPath(); d.moveTo(px + Math.cos(a) * r1, py + Math.sin(a) * r1); d.lineTo(px + Math.cos(a) * r2, py + Math.sin(a) * r2); d.stroke(); }
      } else if (e.t === 'fizzle') {
        for (let i = 0; i < 3; i++) this.spawn({ type: 'smoke', x: e.x, y: e.y, z: 0.1, vx: (rnd() - 0.5) * 0.4, vy: (rnd() - 0.5) * 0.4, vz: 0.4, life: 0.4, size: 0.05 });
      } else if (e.t === 'crate') {
        this.spawn({ type: 'ring', x: e.x, y: e.y, z: 0.02, life: 0.5, size: 0.6, color: '#ffe08a' });
      } else if (e.t === 'pickup') {
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; this.spawn({ type: 'star', x: e.x, y: e.y, z: 0.2, vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 1.4, vz: 1.2, g: 3, life: 0.55, size: 0.06, color: i % 2 ? '#ffe08a' : '#fff', vr: 8 }); }
        this.spawn({ type: 'ring', x: e.x, y: e.y, z: 0.02, life: 0.3, size: 0.5, color: '#fff' });
      } else if (e.t === 'roundEnd') {
        if (e.winner >= 0) { const w = m.tanks[e.winner]; this.confetti(w.x, w.y, 30); }
      } else if (e.t === 'over') {
        const w = m.tanks[e.champ]; if (w) this.confetti(w.x, w.y, 70);
      }
    },
    confetti(x, y, n) {
      const cols = ['#ff9a1f', '#7cc93a', '#ff6fa3', '#39b8e8', '#fff3c4'];
      for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = 0.5 + Math.random() * 2.2; this.spawn({ type: 'confetti', x, y, z: 0.2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 2.5 + Math.random() * 3, g: 4.5, life: 1.4 + Math.random() * 1.2, size: 0.05 + Math.random() * 0.04, color: cols[i % 5], vr: (Math.random() - 0.5) * 16 }); }
    },
    update(dt) {
      this.time += dt;
      this.shake = Math.max(0, this.shake - dt * 40);
      this.flash = Math.max(0, this.flash - dt * 2.4);
      const ps = this.parts;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.t += dt;
        if (p.t >= p.life) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.g * dt; p.rot += p.vr * dt;
        if (p.z < 0) { p.z = 0; p.vz *= -0.35; p.vx *= 0.5; p.vy *= 0.5; p.vr *= 0.4; }
        if (p.type === 'smoke') { p.vx *= 0.96; p.vy *= 0.96; }
      }
    },

    // ---------- pieces ----------
    drawTank(g, x, y, u, a, team, o) {
      o = o || {};
      const T = BT.TEAMS[team], L = u * 0.0135, wreck = !!o.wreck;
      const body = wreck ? '#4a433d' : T.color, dark = wreck ? '#2b2622' : T.dark, light = wreck ? '#6b625a' : T.light;
      if (!o.noShadow) { g.fillStyle = 'rgba(12,30,16,.34)'; g.beginPath(); g.ellipse(x + u * 0.06, y + u * 0.08, u * 0.27, u * 0.24, a, 0, TAU); g.fill(); }
      if (o.glow) { g.strokeStyle = 'rgba(255,224,138,' + (0.5 + 0.3 * Math.sin(this.time * 9)) + ')'; g.lineWidth = u * 0.035; g.beginPath(); g.arc(x, y, u * 0.31, 0, TAU); g.stroke(); }
      const layer = (k, fn) => { g.save(); g.translate(x, y - k * L); g.rotate(a); fn(); g.restore(); };
      // treads
      for (let k = 0; k < 4; k++) layer(k, () => {
        g.fillStyle = k === 3 ? '#3d342d' : '#221c18';
        round(g, -u * 0.22, -u * 0.2, u * 0.44, u * 0.11, u * 0.04); g.fill();
        round(g, -u * 0.22, u * 0.09, u * 0.44, u * 0.11, u * 0.04); g.fill();
      });
      layer(3, () => {
        g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = u * 0.016; g.beginPath();
        const off = ((o.tread || 0) % 0.07 + 0.07) % 0.07;
        for (let k = -0.2 + off; k < 0.21; k += 0.07) { g.moveTo(u * k, -u * 0.2); g.lineTo(u * k, -u * 0.09); g.moveTo(u * k, u * 0.09); g.lineTo(u * k, u * 0.2); }
        g.stroke();
      });
      // hull
      for (let k = 3; k < 8; k++) layer(k, () => { g.fillStyle = dark; round(g, -u * 0.18, -u * 0.135, u * 0.36, u * 0.27, u * 0.05); g.fill(); });
      layer(8, () => {
        g.fillStyle = body; round(g, -u * 0.18, -u * 0.135, u * 0.36, u * 0.27, u * 0.05); g.fill();
        g.fillStyle = light; round(g, u * 0.1, -u * 0.11, u * 0.05, u * 0.22, u * 0.02); g.fill();
        g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(-u * 0.16, -u * 0.11, u * 0.05, u * 0.22);
        g.fillStyle = 'rgba(255,255,255,.5)';
        for (const p of [[-0.14, -0.1], [-0.14, 0.1], [0.06, -0.1], [0.06, 0.1]]) { g.beginPath(); g.arc(u * p[0], u * p[1], u * 0.012, 0, TAU); g.fill(); }
      });
      // turret and barrel
      const rec = (o.recoil || 0) * u * 0.06, tw = wreck ? 0.5 : 0;
      for (let k = 9; k < 13; k++) layer(k, () => {
        g.rotate(tw); g.fillStyle = dark;
        g.beginPath(); g.arc(-u * 0.02, 0, u * 0.105, 0, TAU); g.fill();
        if (k > 9) g.fillRect(u * 0.02 - rec, -u * 0.036, u * (wreck ? 0.18 : 0.3), u * 0.072);
      });
      layer(13, () => {
        g.rotate(tw);
        g.fillStyle = body; g.fillRect(u * 0.02 - rec, -u * 0.036, u * (wreck ? 0.18 : 0.3), u * 0.072);
        g.fillStyle = dark; g.fillRect(u * (wreck ? 0.16 : 0.27) - rec, -u * 0.044, u * 0.05, u * 0.088);
        g.fillStyle = body; g.beginPath(); g.arc(-u * 0.02, 0, u * 0.105, 0, TAU); g.fill();
        g.strokeStyle = light; g.lineWidth = u * 0.018; g.beginPath(); g.arc(-u * 0.02, 0, u * 0.08, -2.4, -0.6); g.stroke();
        if (!wreck) { g.fillStyle = '#fffbe8'; badge(g, T.shape, -u * 0.02, 0, u * 0.05); }
      });
    },
    drawWall(g, w, i) {
      const u = this.u, x = this.ox + w[0] * u, y = this.oy + w[1] * u, ww = w[2] * u, hh = w[3] * u, e = WALL_H * u;
      const tone = w[4] ? 3 : i % 3;
      g.fillStyle = ['#a97c46', '#a07240', '#b1854e', '#8c5f36'][tone];
      g.fillRect(x, y + hh - e, ww, e);
      g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x, y + hh - e * 0.3, ww, e * 0.3);
      g.fillStyle = ['#ecd3a0', '#e4c68e', '#f2ddb4', '#d6ad78'][tone];
      g.fillRect(x, y - e, ww, hh);
      g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x, y - e, ww, Math.max(1, u * 0.014));
      g.fillStyle = 'rgba(120,80,30,.22)';
      if (ww > hh) g.fillRect(x + ww * 0.08, y - e + hh * 0.5, ww * 0.84, Math.max(1, u * 0.01));
      else g.fillRect(x + ww * 0.5, y - e + hh * 0.06, Math.max(1, u * 0.01), hh * 0.88);
      g.strokeStyle = 'rgba(70,40,14,.55)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y - e + 0.5, ww - 1, hh + e - 1);
    },
    drawCrate(g, p) {
      const u = this.u, x = this.ox + p.x * u, y = this.oy + p.y * u, age = this.time - (p._born || (p._born = this.time));
      const k = Math.max(0.02, BT.easeBack(age / 0.4)), bob = Math.sin(this.time * 3.2) * u * 0.03, s = u * 0.28 * k;
      g.strokeStyle = 'rgba(255,224,138,' + (0.35 + 0.25 * Math.sin(this.time * 5)) + ')'; g.lineWidth = u * 0.03; g.setLineDash([u * 0.07, u * 0.05]);
      g.save(); g.translate(x, y); g.rotate(this.time * 0.8); g.beginPath(); g.arc(0, 0, u * 0.3, 0, TAU); g.stroke(); g.restore(); g.setLineDash([]);
      g.fillStyle = 'rgba(12,30,16,.3)'; g.beginPath(); g.ellipse(x + u * 0.04, y + u * 0.08, s * 0.6, s * 0.4, 0, 0, TAU); g.fill();
      const cy = y - u * 0.12 - bob;
      g.fillStyle = '#8a5a2b'; round(g, x - s / 2, cy - s / 2 + s * 0.22, s, s, s * 0.12); g.fill();
      g.fillStyle = '#d99a4e'; round(g, x - s / 2, cy - s / 2, s, s, s * 0.12); g.fill();
      g.strokeStyle = '#8a5a2b'; g.lineWidth = Math.max(1.5, s * 0.08); round(g, x - s / 2 + s * 0.08, cy - s / 2 + s * 0.08, s * 0.84, s * 0.84, s * 0.08); g.stroke();
      g.fillStyle = '#fff6d8';
      if (p.type === 'triple') { for (const dx of [-0.24, 0, 0.24]) { g.beginPath(); g.arc(x + dx * s, cy + (dx ? s * 0.06 : -s * 0.08), s * 0.1, 0, TAU); g.fill(); } }
      else { g.beginPath(); g.moveTo(x + s * 0.1, cy - s * 0.3); g.lineTo(x - s * 0.18, cy + s * 0.04); g.lineTo(x, cy + s * 0.04); g.lineTo(x - s * 0.1, cy + s * 0.3); g.lineTo(x + s * 0.18, cy - s * 0.04); g.lineTo(x, cy - s * 0.04); g.closePath(); g.fill(); }
    },
    drawShell(g, s) {
      const u = this.u, x = this.ox + s.x * u, y = this.oy + s.y * u, zy = y - u * 0.13;
      const tr = s._tr || (s._tr = []);
      tr.push(s.x, s.y); if (tr.length > (s.fast ? 20 : 16)) tr.splice(0, 2);
      g.fillStyle = 'rgba(12,30,16,.3)'; g.beginPath(); g.ellipse(x + u * 0.03, y + u * 0.04, u * 0.05, u * 0.035, 0, 0, TAU); g.fill();
      const n = tr.length / 2;
      for (let i = 0; i < n - 1; i++) {
        const k = i / n;
        g.fillStyle = s.fast ? 'rgba(255,242,122,' + k * 0.7 + ')' : 'rgba(255,255,255,' + k * 0.35 + ')';
        g.beginPath(); g.arc(this.ox + tr[i * 2] * u, this.oy + tr[i * 2 + 1] * u - u * 0.13, u * (s.fast ? 0.045 : 0.035) * (0.3 + k * 0.7), 0, TAU); g.fill();
      }
      if (s.fast) {
        g.fillStyle = 'rgba(255,170,40,.45)'; g.beginPath(); g.arc(x, zy, u * 0.1, 0, TAU); g.fill();
        g.fillStyle = '#fffbd0'; g.beginPath(); g.arc(x, zy, u * 0.055, 0, TAU); g.fill();
      } else {
        const fade = s.life < 1 ? 0.5 + 0.5 * Math.abs(Math.sin(s.life * 16)) : 1;
        g.globalAlpha = fade;
        g.fillStyle = '#3a2c18'; g.beginPath(); g.arc(x, zy, u * 0.058, 0, TAU); g.fill();
        g.fillStyle = '#f6d98a'; g.beginPath(); g.arc(x, zy, u * 0.045, 0, TAU); g.fill();
        g.fillStyle = '#fffbe8'; g.beginPath(); g.arc(x - u * 0.014, zy - u * 0.016, u * 0.016, 0, TAU); g.fill();
        g.globalAlpha = 1;
      }
    },
    drawParts(g) {
      const u = this.u, ox = this.ox, oy = this.oy;
      for (const p of this.parts) {
        const k = p.t / p.life, x = ox + p.x * u, y = oy + (p.y - p.z) * u;
        if (p.type === 'smoke') {
          g.fillStyle = (p.dark ? 'rgba(60,55,50,' : 'rgba(235,230,220,') + (1 - k) * 0.5 + ')';
          g.beginPath(); g.arc(x, y, u * p.size * (0.6 + k * 1.4), 0, TAU); g.fill();
        } else if (p.type === 'flash') {
          g.fillStyle = p.color; g.globalAlpha = 1 - k;
          g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + p.x * 9, r = u * p.size * (i % 2 ? 0.45 : 1) * (0.5 + k * 0.7); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
          g.closePath(); g.fill(); g.globalAlpha = 1;
        } else if (p.type === 'ring') {
          g.strokeStyle = p.color; g.globalAlpha = (1 - k) * 0.9; g.lineWidth = u * 0.045 * (1 - k) + 1;
          g.beginPath(); g.ellipse(x, y, u * p.size * BT.easeOut(k), u * p.size * BT.easeOut(k) * 0.86, 0, 0, TAU); g.stroke(); g.globalAlpha = 1;
        } else if (p.type === 'spark') {
          g.fillStyle = p.color; g.globalAlpha = 1 - k; g.beginPath(); g.arc(x, y, u * p.size, 0, TAU); g.fill(); g.globalAlpha = 1;
        } else {
          if (p.z > 0.02) { g.fillStyle = 'rgba(12,30,16,.2)'; g.fillRect(ox + p.x * u, oy + p.y * u, u * p.size, u * p.size * 0.6); }
          g.save(); g.translate(x, y); g.rotate(p.rot); g.globalAlpha = Math.min(1, (1 - k) * 3); g.fillStyle = p.color;
          if (p.type === 'star') { g.beginPath(); for (let i = 0; i < 8; i++) { const r = u * p.size * (i % 2 ? 0.4 : 1); g.lineTo(Math.cos((i / 8) * TAU) * r, Math.sin((i / 8) * TAU) * r); } g.fill(); }
          else if (p.type === 'confetti') g.fillRect(-u * p.size / 2, -u * p.size * 0.3 * Math.cos(p.rot * 1.7), u * p.size, u * p.size * 0.6 * Math.cos(p.rot * 1.7));
          else g.fillRect(-u * p.size / 2, -u * p.size / 2, u * p.size, u * p.size);
          g.restore(); g.globalAlpha = 1;
        }
      }
    },
    treadMarks(m) {
      const d = this.dctx, u = this.u;
      for (const t of m.tanks) {
        if (!t.alive) continue;
        let k = this.marks.get(t);
        if (!k) { k = { x: t.x, y: t.y, d: 0 }; this.marks.set(t, k); }
        const dist = Math.hypot(t.x - k.x, t.y - k.y);
        k.d += dist * Math.sign(t.speed || 1);
        if (dist < 0.06) continue;
        k.x = t.x; k.y = t.y;
        d.save(); d.translate(t.x * u, t.y * u); d.rotate(t.a);
        d.fillStyle = 'rgba(22,48,28,.2)';
        d.fillRect(-u * 0.03, -u * 0.19, u * 0.035, u * 0.09); d.fillRect(-u * 0.03, u * 0.1, u * 0.035, u * 0.09);
        d.restore();
      }
    },

    // ---------- frame ----------
    draw(m, opts) {
      const g = this.ctx, W = this.W, H = this.H, dpr = this.dpr;
      opts = opts || {};
      this.layout(!!opts.hud);
      const key = [this.canvas.width, this.canvas.height, m.mazeId, m.uid, opts.hud ? 1 : 0, this.u.toFixed(2)].join(':');
      if (key !== this.bgKey) { this.bgKey = key; this.paintBackground(m); this.resetDecals(); }
      const u = this.u, ox = this.ox, oy = this.oy, st = BT.Save.data.settings;
      if (st.treads && m.phase === 'play') this.treadMarks(m);
      let sx = 0, sy = 0;
      if (st.shake && this.shake > 0.2) { sx = (Math.random() - 0.5) * this.shake * this.hs; sy = (Math.random() - 0.5) * this.shake * this.hs; }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(this.bg, Math.round(sx * dpr), Math.round(sy * dpr));
      g.drawImage(this.decals, Math.round((ox - this.decalPad + sx) * dpr), Math.round((oy - this.decalPad + sy) * dpr));
      g.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);

      const items = [];
      m.walls.forEach((w, i) => items.push({ k: w[1] + w[3], w, i }));
      for (const t of m.tanks) items.push({ k: t.y + 0.05, t });
      if (m.pickup) items.push({ k: m.pickup.y + 0.05, p: m.pickup });
      for (const s of m.shells) items.push({ k: s.y + 0.02, s });
      items.sort((a, b) => a.k - b.k);
      for (const it of items) {
        if (it.w) this.drawWall(g, it.w, it.i);
        else if (it.t) {
          const t = it.t, x = ox + t.x * u, y = oy + t.y * u, mk = this.marks.get(t);
          if (!t.alive && t.boom > 0.1 && Math.random() < 0.12) this.spawn({ type: 'smoke', x: t.x, y: t.y, z: 0.15, vx: (Math.random() - 0.5) * 0.2, vy: -0.1, vz: 0.5, life: 1.1, size: 0.07, dark: 1 });
          this.drawTank(g, x, y, u, t.a, t.team, { recoil: t.recoil, wreck: !t.alive, tread: mk ? mk.d : 0, glow: t.alive && !!t.power });
          if (t.alive && t.power) {
            const py = y - u * 0.5 - Math.sin(this.time * 6) * u * 0.03;
            g.fillStyle = '#2b2420'; round(g, x - u * 0.15, py - u * 0.1, u * 0.3, u * 0.2, u * 0.06); g.fill();
            g.fillStyle = '#ffe08a'; g.font = Math.round(u * 0.14) + 'px ' + DISPLAY; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(t.power === 'triple' ? 'x3' : 'ZAP', x, py + u * 0.01);
          }
          if (m.phase === 'countdown' && opts.hud) this.spawnTag(g, t, x, y, m, opts);
        } else if (it.p) this.drawCrate(g, it.p);
        else this.drawShell(g, it.s);
      }
      this.drawParts(g);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.flash > 0) { g.fillStyle = 'rgba(255,250,230,' + this.flash * 0.5 + ')'; g.fillRect(0, 0, W, H); }
      if (opts.hud) { this.drawHud(g, m, opts); this.drawCall(g, m); }
    },
    // "P1 / CPU" tag with an arrow over each tank while the countdown runs.
    spawnTag(g, t, x, y, m, opts) {
      const u = this.u, T = BT.TEAMS[t.team], k = BT.easeBack(m.phaseT / 0.35), by = y - u * 0.62 - Math.abs(Math.sin(this.time * 5)) * u * 0.07;
      const label = opts.labels ? opts.labels[t.i] : T.name;
      g.save(); g.translate(x, by); g.scale(k, k);
      g.font = Math.round(u * 0.17) + 'px ' + DISPLAY; g.textAlign = 'center'; g.textBaseline = 'middle';
      const w = g.measureText(label).width + u * 0.2;
      g.fillStyle = '#2b2420'; round(g, -w / 2, -u * 0.14, w, u * 0.28, u * 0.07); g.fill();
      g.beginPath(); g.moveTo(-u * 0.07, u * 0.13); g.lineTo(0, u * 0.24); g.lineTo(u * 0.07, u * 0.13); g.fill();
      g.fillStyle = T.color; g.fillText(label, 0, u * 0.01);
      g.restore();
    },
    drawHud(g, m, opts) {
      const W = this.W, hs = this.hs, n = m.seats.length;
      const pw = Math.min(230 * hs, (W - 20 * hs) / n - 8 * hs), ph = 44 * hs, total = n * (pw + 8 * hs) - 8 * hs, y0 = 9 * hs;
      for (let i = 0; i < n; i++) {
        const T = BT.TEAMS[m.seats[i].team], t = m.tanks[i], x = (W - total) / 2 + i * (pw + 8 * hs);
        const out = t && !t.alive && m.phase !== 'countdown';
        g.fillStyle = 'rgba(20,10,4,.4)'; round(g, x + 2 * hs, y0 + 4 * hs, pw, ph, 9 * hs); g.fill();
        g.fillStyle = out ? '#cbbd9c' : '#f6e8c6'; round(g, x, y0, pw, ph, 9 * hs); g.fill();
        g.fillStyle = out ? '#8d8474' : T.color; round(g, x, y0, 38 * hs, ph, 9 * hs); g.fill(); g.fillRect(x + 24 * hs, y0, 14 * hs, ph);
        g.fillStyle = '#fffbe8'; badge(g, T.shape, x + 19 * hs, y0 + ph / 2, 9 * hs);
        g.fillStyle = '#3a2a18'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        g.font = Math.round(13 * hs) + 'px ' + DISPLAY;
        g.fillText(T.name.toUpperCase(), x + 46 * hs, y0 + 18 * hs);
        g.font = '700 ' + Math.round(10 * hs) + 'px ' + BODY; g.fillStyle = '#8a6a3c'; g.textAlign = 'right';
        g.fillText(opts.labels ? opts.labels[i] : '', x + pw - 8 * hs, y0 + 17 * hs);
        const pr = Math.min(6 * hs, (pw - 60 * hs) / m.target / 2.5);
        for (let k = 0; k < m.target; k++) {
          const px = x + 52 * hs + k * pr * 2.6, py = y0 + 31 * hs, pop = k === m.score[i] - 1 && m.phase === 'score' && m.lastWinner === i ? 1 + 0.6 * Math.max(0, 1 - m.phaseT * 2) : 1;
          g.beginPath(); g.arc(px, py, pr * pop, 0, TAU);
          if (k < m.score[i]) { g.fillStyle = T.dark; g.fill(); g.fillStyle = T.color; g.beginPath(); g.arc(px, py - 1 * hs, pr * 0.82 * pop, 0, TAU); g.fill(); }
          else { g.strokeStyle = 'rgba(90,60,25,.45)'; g.lineWidth = 1.5 * hs; g.stroke(); }
        }
      }
      g.font = '700 ' + Math.round(11 * hs) + 'px ' + BODY; g.fillStyle = 'rgba(255,240,205,.75)'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      g.fillText('ROUND ' + m.round + '   ·   FIRST TO ' + m.target, W / 2, this.H - 8 * hs);
    },
    // Big stamped calls: the countdown, GO! and who took the round.
    drawCall(g, m) {
      const W = this.W, H = this.H, hs = this.hs, cx = W / 2, cy = this.oy + ROWS * this.u / 2;
      const stamp = (txt, size, color, k, rot) => {
        g.save(); g.translate(cx, cy); g.rotate(rot || 0); g.scale(k, k);
        g.font = Math.round(size) + 'px ' + DISPLAY; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        g.strokeStyle = '#2b1a0c'; g.lineWidth = size * 0.16; g.strokeText(txt, 0, size * 0.05);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillText(txt, size * 0.04, size * 0.1);
        g.fillStyle = color; g.fillText(txt, 0, 0);
        g.restore();
      };
      if (m.phase === 'countdown') {
        const f = (m.phaseT % S.COUNT_STEP) / S.COUNT_STEP, n = 3 - Math.floor(m.phaseT / S.COUNT_STEP);
        if (m.phaseT < 0.9) { g.globalAlpha = 1 - BT.clamp((m.phaseT - 0.6) / 0.3, 0, 1); stamp('ROUND ' + m.round, 30 * hs, '#fff3c4', 1, 0); g.globalAlpha = 1; cyShift(); }
        if (n > 0) { g.globalAlpha = 1 - Math.pow(f, 3); stamp(String(n), 150 * hs, '#fff3c4', 1.5 - 0.5 * BT.easeOut(f * 2.5), -0.05); g.globalAlpha = 1; }
      } else if (m.phase === 'play' && m.phaseT < 0.7) {
        g.globalAlpha = 1 - Math.pow(m.phaseT / 0.7, 2); stamp('FIRE!', 120 * hs, '#ffb347', 0.8 + m.phaseT * 0.7, -0.05); g.globalAlpha = 1;
      } else if (m.phase === 'score' || m.phase === 'over') {
        const k = m.phase === 'over' ? 1 : BT.easeBack(m.phaseT / 0.35), w = m.lastWinner;
        const T = w >= 0 ? BT.TEAMS[m.seats[w].team] : null, bw = Math.min(W * 0.9, 620 * hs), bh = 74 * hs;
        g.save(); g.translate(cx, cy); g.rotate(-0.035); g.scale(k, k);
        g.fillStyle = 'rgba(20,10,4,.4)'; g.fillRect(-bw / 2 + 5 * hs, -bh / 2 + 7 * hs, bw, bh);
        g.fillStyle = '#f6e8c6'; g.fillRect(-bw / 2, -bh / 2, bw, bh);
        g.fillStyle = T ? T.color : '#9a8f7c'; g.fillRect(-bw / 2, -bh / 2, bw, 9 * hs); g.fillRect(-bw / 2, bh / 2 - 9 * hs, bw, 9 * hs);
        g.fillStyle = '#3a2a18'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const txt = m.champ >= 0 ? T.name.toUpperCase() + ' WINS THE WAR!' : T ? T.name.toUpperCase() + ' TAKES THE ROUND' : 'NOBODY SCORES';
        let fs = 30 * hs; g.font = Math.round(fs) + 'px ' + DISPLAY;
        const tw = g.measureText(txt).width; if (tw > bw * 0.92) { fs *= (bw * 0.92) / tw; g.font = Math.round(fs) + 'px ' + DISPLAY; }
        g.fillText(txt, 0, -4 * hs);
        g.font = '700 ' + Math.round(12 * hs) + 'px ' + BODY; g.fillStyle = '#8a6a3c';
        const lead = Math.max.apply(null, m.score);
        g.fillText(m.champ >= 0 ? 'Parade time.' : lead === m.target - 1 ? 'MATCH POINT next round' : m.score.map((s, i) => BT.TEAMS[m.seats[i].team].name + ' ' + s).join('   ·   '), 0, 21 * hs);
        g.restore();
      }
      function cyShift() { /* the round label and the digit share the centre; the label fades first */ }
      void H;
    },
  };

  function round(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r);
    g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function badge(g, shape, x, y, r) {
    g.beginPath();
    if (shape === 'circle') g.arc(x, y, r, 0, TAU);
    else if (shape === 'square') g.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
    else if (shape === 'triangle') { g.moveTo(x + r * 1.1, y); g.lineTo(x - r * 0.8, y - r); g.lineTo(x - r * 0.8, y + r); g.closePath(); }
    else { g.moveTo(x + r * 1.15, y); g.lineTo(x, y - r * 1.15); g.lineTo(x - r * 1.15, y); g.lineTo(x, y + r * 1.15); g.closePath(); }
    g.fill();
  }
  R.badge = badge;
  BT.Render = R;
})();
