// Bullet Garden view: a walled kitchen garden at midnight, seen from a low
// angle in perspective. Seeds arc through the air and sprout where they
// land; plants glow faintly, the greenhouse is lit from within, and the
// gardener carries a lantern. On tall screens the garden turns lengthways.
(function () {
  const R = BG.Rules, GW = R.GW, GH = R.GH, CORE = R.CORE;
  const V = {
    W: 1, H: 1, side: false, U: GW, D: GH, S: 1, cx: 0, cy: 0, t: 0.03, c: 0.72, hk: 0.95, time: 0, reduced: false, parts: [], decals: [], shake: 0,
    flies: Array.from({ length: 26 }, (_, i) => ({ x: Math.random() * GW, y: Math.random() * GH, h: 0.4 + Math.random(), ph: i * 1.7 })),
    resize(W, H, top, bottom) {
      this.W = W; this.H = H; this.side = H > W * 1.1;
      this.U = this.side ? GH : GW; this.D = this.side ? GW : GH; this.t = 0.42 / this.D; this.c = this.side ? 0.98 : 0.72;
      this.S = 1; this.cx = 0; this.cy = 0;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [u, v] of [[-0.7, -0.9], [this.U + 0.7, -0.9], [-0.7, this.D + 0.5], [this.U + 0.7, this.D + 0.5]]) {
        for (const h of [0, 1.2]) { const p = this.uv(u, v, h); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      }
      const aw = W * 0.98, ah = H - top - bottom;
      this.S = Math.min(aw / (x1 - x0), ah / (y1 - y0));
      this.cx = W / 2 - ((x0 + x1) / 2) * this.S;
      this.cy = top + ah / 2 - ((y0 + y1) / 2) * this.S;
    },
    k(v) { return 1 / (1 + (this.D - v) * this.t); },
    uv(u, v, h) { const k = this.k(v); return [this.cx + (u - this.U / 2) * this.S * k, this.cy + ((v - this.D / 2) * this.c - h * this.hk) * this.S * k, this.S * k]; },
    map(x, y) { return this.side ? [GH - y, x] : [x, y]; },
    P(x, y, h = 0) { const [u, v] = this.map(x, y); return this.uv(u, v, h); },
    depth(x, y) { return this.map(x, y)[1]; },
    unproject(sx, sy) {
      const a = (sx - this.cx) / this.S, b = (sy - this.cy) / this.S, D = this.D, t = this.t, c = this.c;
      const v = (b + b * D * t + (D * c) / 2) / (c + b * t), u = a / this.k(v) + this.U / 2;
      return this.side ? [v, GH - u] : [u, v];
    },
    axis(a) { return this.side ? [a[1], -a[0]] : a; },
    poly(g, pts, fill, stroke, lw) {
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
    },
    quad(x0, y0, x1, y1, h = 0) { return [this.P(x0, y0, h), this.P(x1, y0, h), this.P(x1, y1, h), this.P(x0, y1, h)]; },
    ell(g, x, y, h, r, fill, sq = 1) { const p = this.P(x, y, h); g.fillStyle = fill; g.beginPath(); g.ellipse(p[0], p[1], r * p[2], r * p[2] * this.c * sq, 0, 0, Math.PI * 2); g.fill(); return p; },
    glow(g, x, y, h, r, col, a) {
      const p = this.P(x, y, h), rr = r * p[2], gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], rr);
      gr.addColorStop(0, this.rgba(col, a)); gr.addColorStop(1, this.rgba(col, 0));
      g.fillStyle = gr; g.beginPath(); g.ellipse(p[0], p[1], rr, rr * this.c, 0, 0, Math.PI * 2); g.fill();
    },
    rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, a)})`; },

    // ---------- effects ----------
    burst(x, y, col, n, h = 0.2) {
      if (this.reduced) n = Math.ceil(n / 3);
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2.5; this.parts.push({ x, y, h, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vh: 1.5 + Math.random() * 2.5, life: 0.5 + Math.random() * 0.4, col, r: 0.04 + Math.random() * 0.05 }); }
    },
    splat(x, y, col) { this.decals.push({ x, y, col, life: 6, r: 0.25 + Math.random() * 0.15, rot: Math.random() * 6 }); if (this.decals.length > 60) this.decals.shift(); },
    ring(x, y, col, max) { this.parts.push({ ring: true, x, y, col, r: 0.1, max, life: 0.45 }); },
    tick(dt) {
      this.time += dt; this.shake = Math.max(0, this.shake - dt * 2.5);
      for (const p of this.parts) {
        p.life -= dt;
        if (p.ring) { p.r += (p.max - p.r) * Math.min(1, dt * 10); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.h += p.vh * dt; p.vh -= 9 * dt;
        if (p.h < 0) { p.h = 0; p.vh *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
      }
      this.parts = this.parts.filter((p) => p.life > 0);
      for (const d of this.decals) d.life -= dt;
      this.decals = this.decals.filter((d) => d.life > 0);
      for (const f of this.flies) { f.x += Math.sin(this.time * 0.7 + f.ph) * dt * 0.6; f.y += Math.cos(this.time * 0.5 + f.ph * 1.3) * dt * 0.6; f.x = (f.x + GW) % GW; f.y = (f.y + GH) % GH; }
    },

    // ---------- the scene ----------
    sky(g) {
      const W = this.W, H = this.H, far = this.uv(0, -0.9, 0)[1];
      const sky = g.createLinearGradient(0, 0, 0, Math.max(60, far));
      sky.addColorStop(0, '#060b1f'); sky.addColorStop(1, '#16304a');
      g.fillStyle = '#0b1424'; g.fillRect(0, 0, W, H);
      g.fillStyle = sky; g.fillRect(0, 0, W, Math.max(60, far) + 2);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 60; i++) { const x = (i * 157.3) % W, y = (i * 73.1) % Math.max(40, far - 10), tw = 0.5 + 0.5 * Math.sin(this.time * 2 + i); g.globalAlpha = 0.3 + tw * 0.6; g.fillRect(x, y, 1.6, 1.6); }
      g.globalAlpha = 1;
      // the moon, and a treeline beyond the garden wall
      const mx = W * 0.82, my = Math.min(far * 0.45, 70);
      const mg = g.createRadialGradient(mx, my, 0, mx, my, 90); mg.addColorStop(0, 'rgba(230,240,255,0.35)'); mg.addColorStop(1, 'rgba(230,240,255,0)');
      g.fillStyle = mg; g.fillRect(mx - 90, my - 90, 180, 180);
      g.fillStyle = '#eef3ff'; g.beginPath(); g.arc(mx, my, 18, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#16304a'; g.beginPath(); g.arc(mx + 7, my - 4, 15, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0a1a14';
      g.beginPath(); g.moveTo(0, far + 4);
      for (let x = 0; x <= W; x += 22) g.lineTo(x, far - 10 - Math.abs(Math.sin(x * 0.031)) * 26 - Math.abs(Math.sin(x * 0.11)) * 10);
      g.lineTo(W, far + 4); g.closePath(); g.fill();
    },
    ground(g) {
      // lawn round the beds, then the tilled soil in rows
      this.poly(g, [this.uv(-0.7, -0.9, 0), this.uv(this.U + 0.7, -0.9, 0), this.uv(this.U + 0.7, this.D + 0.6, 0), this.uv(-0.7, this.D + 0.6, 0)], '#183a2a');
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        const d = (x * 7 + y * 13) % 5;
        this.poly(g, this.quad(x, y, x + 1, y + 1), (x + y) % 2 ? `rgb(${58 + d},${40 + d},${28})` : `rgb(${52 + d},${36 + d},${25})`);
      }
      // furrow lines
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
      for (let y = 0; y <= GH; y++) { const a = this.P(0, y), b = this.P(GW, y); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      for (const d of this.decals) {
        const p = this.P(d.x, d.y, 0.01);
        g.globalAlpha = Math.min(0.7, d.life / 3); g.fillStyle = d.col;
        g.beginPath(); g.ellipse(p[0], p[1], d.r * p[2], d.r * p[2] * this.c * 0.7, d.rot, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    },
    wallFence(g) {
      // a picket fence round the far edge (in view space, so it works rotated too)
      for (let u = -0.6; u <= this.U + 0.6; u += 0.7) {
        const a = this.uv(u, -0.7, 0), b = this.uv(u, -0.7, 0.7), s = a[2];
        g.fillStyle = '#8a7a63'; g.fillRect(a[0] - s * 0.07, b[1], s * 0.14, a[1] - b[1]);
        g.beginPath(); g.moveTo(a[0] - s * 0.07, b[1]); g.lineTo(a[0], b[1] - s * 0.1); g.lineTo(a[0] + s * 0.07, b[1]); g.fill();
      }
      const r1 = [this.uv(-0.7, -0.7, 0.45), this.uv(this.U + 0.7, -0.7, 0.45)], r2 = [this.uv(-0.7, -0.7, 0.2), this.uv(this.U + 0.7, -0.7, 0.2)];
      g.strokeStyle = '#6f624f'; g.lineWidth = Math.max(2, r1[0][2] * 0.05);
      for (const r of [r1, r2]) { g.beginPath(); g.moveTo(r[0][0], r[0][1]); g.lineTo(r[1][0], r[1][1]); g.stroke(); }
    },
    greenhouse(g, gh) {
      const x0 = CORE.x - 1, x1 = CORE.x + 1, y0 = CORE.y - 1, y1 = CORE.y + 1, hW = 1.0, hR = 1.6;
      const [u0, v0] = this.map(x0, y0), [u1, v1] = this.map(x1, y1);
      const U0 = Math.min(u0, u1), U1 = Math.max(u0, u1), V0 = Math.min(v0, v1), V1 = Math.max(v0, v1), Um = (U0 + U1) / 2;
      const q = (u, v, h) => this.uv(u, v, h);
      const hurt = 1 - gh / 100, flick = gh < 30 ? 0.6 + 0.4 * Math.sin(this.time * 20) : 1;
      // inside glow and seedlings
      this.poly(g, [q(U0, V0, 0), q(U1, V0, 0), q(U1, V1, 0), q(U0, V1, 0)], `rgba(255,214,120,${0.35 * flick})`);
      for (let i = 0; i < 6; i++) { const p = q(U0 + 0.35 + (i % 3) * 0.65, V0 + 0.5 + Math.floor(i / 3) * 0.9, 0.2), s = p[2]; g.fillStyle = '#7fd36a'; g.beginPath(); g.ellipse(p[0], p[1], s * 0.12, s * 0.2, 0, 0, Math.PI * 2); g.fill(); }
      // back wall and gable, then glass sides, then the front
      const glass = `rgba(190,230,255,${0.16 + hurt * 0.1})`, frame = '#e9f0f5';
      this.poly(g, [q(U0, V0, 0), q(U1, V0, 0), q(U1, V0, hW), q(Um, V0, hR), q(U0, V0, hW)], glass, frame, 2);
      this.poly(g, [q(U0, V0, hW), q(Um, V0, hR), q(Um, V1, hR), q(U0, V1, hW)], `rgba(190,230,255,0.22)`, frame, 2);
      this.poly(g, [q(U1, V0, hW), q(Um, V0, hR), q(Um, V1, hR), q(U1, V1, hW)], `rgba(160,210,240,0.28)`, frame, 2);
      this.poly(g, [q(U0, V1, 0), q(U1, V1, 0), q(U1, V1, hW), q(Um, V1, hR), q(U0, V1, hW)], glass, frame, 2.5);
      const m1 = q(Um, V1, 0), m2 = q(Um, V1, hR); g.strokeStyle = frame; g.lineWidth = 2; g.beginPath(); g.moveTo(m1[0], m1[1]); g.lineTo(m2[0], m2[1]); g.stroke();
      // cracks as it takes damage
      if (hurt > 0.3) {
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1;
        for (let i = 0; i < Math.floor(hurt * 6); i++) { const a = q(U0 + 0.3 + i * 0.25, V1, 0.3 + (i % 3) * 0.2), s = a[2]; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[0] + s * 0.15, a[1] - s * 0.12); g.lineTo(a[0] + s * 0.05, a[1] - s * 0.25); g.stroke(); }
      }
    },
    plant(g, pl) {
      const col = R.SEEDS[pl.type].color, grow = pl.grow < 1 ? 1 - Math.pow(1 - pl.grow, 3) + Math.sin(pl.grow * Math.PI) * 0.15 : 1;
      const wilt = Math.max(0, Math.min(1, (0.45 - pl.water) / 0.45)), droop = wilt * 0.35, a = 0.45 + 0.55 * Math.max(0, Math.min(1, pl.water * 2));
      this.ell(g, pl.x + 0.06, pl.y + 0.06, 0, 0.32 * grow, 'rgba(0,0,0,0.35)');
      g.save(); g.globalAlpha = a;
      if (pl.type === 'wall') {
        const r = 0.42 * grow, h = 0.75 * grow;
        const [u, v] = this.map(pl.x, pl.y), q = (du, dv, hh) => this.uv(u + du, v + dv, hh);
        this.poly(g, [q(-r, r, 0), q(r, r, 0), q(r, r, h), q(-r, r, h)], '#5e3b22');
        this.poly(g, [q(-r, -r, h), q(r, -r, h), q(r, r, h), q(-r, r, h)], '#86552f');
        g.fillStyle = '#e8d2b0';
        for (let i = 0; i < 5; i++) { const p = q(-r + 0.1 + i * r * 0.45, r, h * (0.3 + (i % 2) * 0.4)), s = p[2]; g.beginPath(); g.moveTo(p[0] - s * 0.04, p[1]); g.lineTo(p[0], p[1] - s * 0.12); g.lineTo(p[0] + s * 0.04, p[1]); g.fill(); }
      } else if (pl.type === 'vine') {
        g.strokeStyle = col; g.lineWidth = Math.max(1.5, this.P(pl.x, pl.y)[2] * 0.05); g.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          for (let s = 0; s <= 8; s++) { const t = s / 8, ang = i * 1.6 + t * 3 + Math.sin(this.time + i) * 0.2, rr = t * 0.45 * grow, p = this.P(pl.x + Math.cos(ang) * rr, pl.y + Math.sin(ang) * rr, 0.03 + Math.sin(t * Math.PI) * 0.1); if (s) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
          g.stroke();
        }
        for (let i = 0; i < 3; i++) this.ell(g, pl.x + Math.cos(i * 2.1) * 0.25 * grow, pl.y + Math.sin(i * 2.1) * 0.25 * grow, 0.12, 0.06, '#f1c0ff');
      } else {
        const stemH = (pl.type === 'bomb' ? 0.35 : 0.5) * grow, base = this.P(pl.x, pl.y, 0), top = this.P(pl.x + droop * 0.4, pl.y, stemH - droop * 0.2), s = base[2];
        g.strokeStyle = '#3f7d2c'; g.lineWidth = Math.max(2, s * 0.06);
        g.beginPath(); g.moveTo(base[0], base[1]); g.quadraticCurveTo(base[0], (base[1] + top[1]) / 2, top[0], top[1]); g.stroke();
        g.fillStyle = '#4f9a36';
        for (const d of [-1, 1]) { g.beginPath(); g.ellipse(base[0] + d * s * 0.14, base[1] - s * 0.12 * grow, s * 0.16 * grow, s * 0.06 * grow, d * 0.5, 0, Math.PI * 2); g.fill(); }
        if (pl.type === 'spitter') {
          const r = 0.2 * grow * (1 + pl.shot * 1.5);
          g.fillStyle = col; g.beginPath(); g.arc(top[0], top[1] - r * s * 0.6, r * s, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#1b3a0c'; g.beginPath(); g.arc(top[0] + r * s * 0.35, top[1] - r * s * 0.6, r * s * 0.35, 0, Math.PI * 2); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(top[0] - r * s * 0.35, top[1] - r * s, r * s * 0.25, 0, Math.PI * 2); g.fill();
        } else {
          const r = 0.24 * grow * (1 + 0.06 * Math.sin(this.time * 8)), cy = top[1] - r * s * 0.7;
          g.fillStyle = col; g.beginPath(); g.arc(top[0], cy, r * s, 0, Math.PI * 2); g.fill();
          g.strokeStyle = '#8f1d32'; g.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { g.beginPath(); g.ellipse(top[0] + i * r * s * 0.4, cy, r * s * 0.15, r * s * 0.9, 0, 0, Math.PI * 2); g.stroke(); }
          if (Math.sin(this.time * 12 + pl.x) > 0) { g.fillStyle = '#ffd166'; g.beginPath(); g.arc(top[0], cy - r * s, 2.5, 0, Math.PI * 2); g.fill(); }
        }
      }
      g.restore();
      if (pl.water < 0.35) {
        const p = this.P(pl.x, pl.y, 1.0 + Math.sin(this.time * 4) * 0.05), s = p[2];
        g.fillStyle = pl.water < 0.15 ? '#ff6b6b' : '#64c8ff';
        g.beginPath(); g.moveTo(p[0], p[1] - s * 0.16); g.quadraticCurveTo(p[0] + s * 0.1, p[1], p[0], p[1] + s * 0.04); g.quadraticCurveTo(p[0] - s * 0.1, p[1], p[0], p[1] - s * 0.16); g.fill();
      }
      if (pl.hp < R.SEEDS[pl.type].hp * 0.99 && pl.type === 'wall') {
        const p = this.P(pl.x, pl.y, 0.95), s = p[2], f = pl.hp / R.SEEDS[pl.type].hp;
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(p[0] - s * 0.3, p[1], s * 0.6, 4);
        g.fillStyle = '#c08552'; g.fillRect(p[0] - s * 0.3, p[1], s * 0.6 * f, 4);
      }
    },
    bug(g, b) {
      const fly = b.t.flies, h = fly ? 0.55 + Math.sin(this.time * 6 + b.x) * 0.06 : 0.08, r = b.t.r;
      this.ell(g, b.x, b.y, 0, r * 0.9, 'rgba(0,0,0,0.35)');
      const p = this.P(b.x, b.y, h), ahead = this.P(b.x + Math.cos(b.dir) * 0.3, b.y + Math.sin(b.dir) * 0.3, h), ang = Math.atan2(ahead[1] - p[1], ahead[0] - p[0]), s = p[2];
      g.save(); g.translate(p[0], p[1]); g.rotate(ang); g.scale(1, 0.8);
      const col = b.flash > 0 ? '#ffffff' : b.t.color, R0 = r * s * 1.35;
      if (!fly) {
        g.strokeStyle = '#1a1a1a'; g.lineWidth = Math.max(1, s * 0.02);
        const step = Math.sin(this.time * 18 + b.x * 3) * R0 * 0.3;
        for (const sd of [-1, 1]) for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * R0 * 0.4, 0); g.lineTo(i * R0 * 0.5 + (i % 2 ? step : -step), sd * R0 * 1.1); g.stroke(); }
      }
      if (b.type === 'beetle') {
        g.fillStyle = '#123'; g.beginPath(); g.ellipse(R0 * 0.75, 0, R0 * 0.35, R0 * 0.32, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = col; g.beginPath(); g.ellipse(-R0 * 0.1, 0, R0, R0 * 0.8, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-R0 * 1.1, 0); g.lineTo(R0 * 0.85, 0); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(-R0 * 0.2, -R0 * 0.35, R0 * 0.45, R0 * 0.15, 0, 0, Math.PI * 2); g.fill();
      } else if (b.type === 'ant') {
        g.fillStyle = col;
        for (const [dx, rr] of [[-0.75, 0.55], [0, 0.4], [0.65, 0.42]]) { g.beginPath(); g.arc(dx * R0, 0, rr * R0, 0, Math.PI * 2); g.fill(); }
        g.strokeStyle = col; g.lineWidth = 1.2; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(R0, 0); g.lineTo(R0 * 1.5, sd * R0 * 0.5); g.stroke(); }
      } else {
        g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, R0 * 1.1, R0 * 0.6, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1a1a1a'; for (let i = -1; i <= 1; i++) g.fillRect(i * R0 * 0.45 - R0 * 0.1, -R0 * 0.6, R0 * 0.2, R0 * 1.2);
        g.fillStyle = 'rgba(230,245,255,0.55)';
        const flap = Math.sin(this.time * 50) * 0.5;
        for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(-R0 * 0.1, sd * R0 * 0.9, R0 * 0.8, R0 * 0.35, sd * (0.4 + flap), 0, Math.PI * 2); g.fill(); }
      }
      g.restore();
      if (b.hp < b.max) {
        const q = this.P(b.x, b.y, h + r + 0.25), w = s * 0.45;
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(q[0] - w / 2, q[1], w, 3);
        g.fillStyle = '#ff6b6b'; g.fillRect(q[0] - w / 2, q[1], w * Math.max(0, b.hp / b.max), 3);
      }
    },
    gardener(g, p, aim) {
      this.ell(g, p.x, p.y, 0, 0.32, 'rgba(0,0,0,0.4)');
      const base = this.P(p.x, p.y, 0), s = base[2] * 1.3, body = this.P(p.x, p.y, 0.7), head = this.P(p.x, p.y, 1.1);
      // the seed blaster, pointing at the aim
      if (aim) {
        const d = Math.hypot(aim[0] - p.x, aim[1] - p.y) || 1, tip = this.P(p.x + ((aim[0] - p.x) / d) * 0.45, p.y + ((aim[1] - p.y) / d) * 0.45, 0.5);
        g.strokeStyle = '#4a5560'; g.lineWidth = Math.max(3, s * 0.1); g.lineCap = 'round';
        g.beginPath(); g.moveTo(body[0], body[1]); g.lineTo(tip[0], tip[1]); g.stroke();
        g.fillStyle = aim[2] || '#9ef01a'; g.beginPath(); g.arc(tip[0], tip[1], s * 0.06, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#3c6e71'; g.beginPath(); g.roundRect(body[0] - s * 0.2, body[1] - s * 0.15, s * 0.4, base[1] - body[1] + s * 0.12, s * 0.12); g.fill();
      g.fillStyle = '#f2d0a9'; g.beginPath(); g.arc(head[0], head[1], s * 0.14, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e9c46a'; g.beginPath(); g.ellipse(head[0], head[1] - s * 0.1, s * 0.3, s * 0.08, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(head[0], head[1] - s * 0.16, s * 0.14, s * 0.1, 0, Math.PI, 0); g.fill();
      // the lantern on a pole at the hip
      const lan = this.P(p.x + 0.25, p.y + 0.1, 0.45), fl = 0.85 + 0.15 * Math.sin(this.time * 9);
      g.fillStyle = `rgba(255,200,90,${fl})`; g.beginPath(); g.arc(lan[0], lan[1], s * 0.07, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2b2b2b'; g.lineWidth = 1.5; g.strokeRect(lan[0] - s * 0.06, lan[1] - s * 0.08, s * 0.12, s * 0.16);
    },
    // the aim: a dotted arc to where the seed will land, and a ring there
    aim(g, p, a, col, ok) {
      const d = Math.hypot(a[0] - p.x, a[1] - p.y) || 1, r = Math.min(R.REACH, d), tx = p.x + ((a[0] - p.x) / d) * r, ty = p.y + ((a[1] - p.y) / d) * r;
      g.fillStyle = this.rgba('#ffffff', 0.55);
      for (let i = 1; i < 12; i++) { const t = i / 12, q = this.P(p.x + (tx - p.x) * t, p.y + (ty - p.y) * t, 0.5 + Math.sin(t * Math.PI) * r * 0.16 - t * 0.45); g.beginPath(); g.arc(q[0], q[1], Math.max(1.2, q[2] * 0.025), 0, Math.PI * 2); g.fill(); }
      const c = this.P(tx, ty, 0.01);
      g.strokeStyle = ok ? col : 'rgba(255,107,107,0.8)'; g.lineWidth = 2.5;
      g.beginPath(); g.ellipse(c[0], c[1], c[2] * 0.32, c[2] * 0.32 * this.c, 0, 0, Math.PI * 2); g.stroke();
      return [tx, ty];
    },

    draw(g, gm, o) {
      const W = this.W, H = this.H;
      g.save();
      if (this.shake > 0 && !this.reduced) g.translate((Math.random() - 0.5) * this.shake * 12, (Math.random() - 0.5) * this.shake * 12);
      this.sky(g);
      this.ground(g);
      this.wallFence(g);
      // light pools on the soil: the lantern, the greenhouse, glowing plants
      g.globalCompositeOperation = 'lighter';
      if (gm) {
        this.glow(g, gm.p.x, gm.p.y, 0, 3.2, '#ffc46b', 0.28);
        this.glow(g, CORE.x, CORE.y, 0, 3, '#ffd27a', 0.22);
        for (const pl of gm.plants.values()) if (pl.type !== 'wall') this.glow(g, pl.x, pl.y, 0, 1.3, R.SEEDS[pl.type].color, 0.12 * pl.grow * Math.max(0.2, pl.water));
      }
      g.globalCompositeOperation = 'source-over';
      if (gm) {
        // everything that stands up, far to near
        const items = [];
        for (const pl of gm.plants.values()) items.push([this.depth(pl.x, pl.y), () => this.plant(g, pl)]);
        for (const b of gm.bugs) items.push([this.depth(b.x, b.y) + (b.t.flies ? 0.3 : 0), () => this.bug(g, b)]);
        items.push([this.depth(CORE.x, CORE.y) + (this.side ? 0.9 : 0.9), () => this.greenhouse(g, gm.greenhouse)]);
        if (o.showGardener) items.push([this.depth(gm.p.x, gm.p.y), () => this.gardener(g, gm.p, o.aimPt)]);
        items.sort((a, b) => a[0] - b[0]).forEach((it) => it[1]());
        // seeds arcing through the air, with their shadows
        for (const s of gm.seeds) {
          const t = 1 - s.left / s.flight, h = 0.5 + Math.sin(t * Math.PI) * s.flight * 11 * 0.16 - t * 0.45;
          this.ell(g, s.x, s.y, 0, 0.07, 'rgba(0,0,0,0.35)');
          const p = this.P(s.x, s.y, h); g.fillStyle = R.SEEDS[s.type].color;
          g.beginPath(); g.ellipse(p[0], p[1], p[2] * 0.08, p[2] * 0.11, t * 6, 0, Math.PI * 2); g.fill();
        }
        for (const s of gm.spits) { const p = this.P(s.x, s.y, 0.5); g.fillStyle = '#d9ff8a'; g.beginPath(); g.arc(p[0], p[1], p[2] * 0.07, 0, Math.PI * 2); g.fill(); }
        if (o.aim) this.aim(g, gm.p, o.aim, R.SEEDS[gm.current].color, o.aimOk);
      }
      for (const p of this.parts) {
        if (p.ring) { const pts = []; for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; pts.push(this.P(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r, 0.05)); } this.poly(g, pts, null, this.rgba(p.col, p.life * 2), 3); continue; }
        const q = this.P(p.x, p.y, p.h); g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.col;
        g.beginPath(); g.arc(q[0], q[1], Math.max(1, p.r * q[2]), 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      // fireflies
      g.globalCompositeOperation = 'lighter';
      for (const f of this.flies) { const p = this.P(f.x, f.y, f.h + Math.sin(this.time * 2 + f.ph) * 0.2), a = 0.5 + 0.5 * Math.sin(this.time * 3 + f.ph * 2); g.fillStyle = `rgba(220,255,140,${a * 0.8})`; g.beginPath(); g.arc(p[0], p[1], 2 + a * 1.5, 0, Math.PI * 2); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      // moonlight vignette
      const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.8);
      vg.addColorStop(0, 'rgba(5,10,25,0)'); vg.addColorStop(1, 'rgba(5,10,25,0.55)');
      g.fillStyle = vg; g.fillRect(-20, -20, W + 40, H + 40);
      g.restore();
    },
  };
  BG.View = V;
})();
