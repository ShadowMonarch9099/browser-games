// Caboose Loop view: a toy railway layout on a wooden table, seen at a slant.
// The ground is green felt on a painted plinth, fenced with little pickets;
// trees and cottages are wooden toys; passengers are peg dolls; trains are
// painted blocks that glide smoothly between squares and puff smoke.
(function () {
  const R = CL.Rules;
  const TRAIN = [
    { body: '#c0392b', dark: '#7d1f16', roof: '#f1c40f' },   // scarlet engine (you / player 1)
    { body: '#2e6fd8', dark: '#173f86', roof: '#f4ead2' },   // cobalt (player 2)
    { body: '#2f9e5a', dark: '#1b6037', roof: '#f4ead2' },
    { body: '#8e44ad', dark: '#5b2671', roof: '#f4ead2' },
  ];
  const PAX = { scarlet: '#e74c3c', cobalt: '#3d7fe6', mustard: '#f1b72a', null: '#e8d9b5' };
  const V = {
    W: 1, H: 1, S: 1, cx: 0, cy: 0, w: 20, h: 13, t: 0.03, c: 0.74, hk: 0.95, time: 0, reduced: false, parts: [], shake: 0,
    layout(W, H, w, h, top, bottom) {
      this.W = W; this.H = H; this.w = w; this.h = h; this.t = 0.4 / h;
      this.S = 1; this.cx = 0; this.cy = 0;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [u, v] of [[-0.8, -0.8], [w + 0.8, -0.8], [-0.8, h + 0.8], [w + 0.8, h + 0.8]]) for (const hh of [0, 1, -0.7]) {
        const p = this.P(u, v, hh); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
      const aw = W * 0.97, ah = H - top - bottom;
      this.S = Math.min(aw / (x1 - x0), ah / (y1 - y0));
      this.cx = W / 2 - ((x0 + x1) / 2) * this.S;
      this.cy = top + ah / 2 - ((y0 + y1) / 2) * this.S;
    },
    k(v) { return 1 / (1 + (this.h - v) * this.t); },
    P(u, v, hh = 0) { const k = this.k(v); return [this.cx + (u - this.w / 2) * this.S * k, this.cy + ((v - this.h / 2) * this.c - hh * this.hk) * this.S * k, this.S * k]; },
    unproject(sx, sy) {
      const a = (sx - this.cx) / this.S, b = (sy - this.cy) / this.S, D = this.h, t = this.t, c = this.c;
      const v = (b + b * D * t + (D * c) / 2) / (c + b * t);
      return [a * (1 + (D - v) * t) + this.w / 2, v];
    },
    poly(g, pts, fill, stroke, lw) {
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
    },
    quad(x0, y0, x1, y1, hh = 0) { return [this.P(x0, y0, hh), this.P(x1, y0, hh), this.P(x1, y1, hh), this.P(x0, y1, hh)]; },
    shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = (c) => Math.max(0, Math.min(255, Math.round(c * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; },
    // A box resting on the ground, centred at (u, v), long along `ang`, with
    // only the faces the camera can see drawn.
    box(g, u, v, len, wid, h0, h1, ang, col, topCol) {
      const ca = Math.cos(ang), sa = Math.sin(ang), hl = len / 2, hw = wid / 2;
      const c = [[hl, hw], [hl, -hw], [-hl, -hw], [-hl, hw]].map(([a, b]) => [u + a * ca - b * sa, v + a * sa + b * ca]);
      const camU = this.w / 2, camV = this.h + 1 / this.t;
      for (let i = 0; i < 4; i++) {
        const a = c[i], b = c[(i + 1) % 4], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const nx = mx - u, ny = my - v;
        if (nx * (camU - mx) + ny * (camV - my) <= 0) continue;
        const lit = 0.72 + 0.28 * (ny > 0 ? 1 : 0.4) * Math.abs(ny / (Math.hypot(nx, ny) || 1)) + (nx < 0 ? 0.08 : 0);
        this.poly(g, [this.P(a[0], a[1], h0), this.P(b[0], b[1], h0), this.P(b[0], b[1], h1), this.P(a[0], a[1], h1)], this.shade(col, lit));
      }
      this.poly(g, c.map(([x, y]) => this.P(x, y, h1)), topCol || this.shade(col, 1.12));
      return c;
    },

    // ---------- the table and the layout ----------
    table(g) {
      const W = this.W, H = this.H;
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#3b2414'); bg.addColorStop(1, '#2a180c');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
      for (let y = 0; y < H; y += 46) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      const lg = g.createRadialGradient(W / 2, H * 0.4, 30, W / 2, H * 0.5, Math.max(W, H) * 0.75);
      lg.addColorStop(0, 'rgba(255,214,150,0.25)'); lg.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = lg; g.fillRect(0, 0, W, H);
    },
    ground(g, s) {
      const w = this.w, h = this.h;
      // the painted plinth
      this.poly(g, [this.P(-0.8, h + 0.8, 0), this.P(w + 0.8, h + 0.8, 0), this.P(w + 0.8, h + 0.8, -0.7), this.P(-0.8, h + 0.8, -0.7)], '#1f4d3a');
      this.poly(g, [this.P(-0.8, h + 0.8, -0.05), this.P(w + 0.8, h + 0.8, -0.05), this.P(w + 0.8, h + 0.8, -0.12), this.P(-0.8, h + 0.8, -0.12)], '#c9a227');
      this.poly(g, this.quad(-0.8, -0.8, w + 0.8, h + 0.8), '#5c8f3c');
      // felt squares, gently chequered
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const d = ((x * 7 + y * 11) % 5) * 3;
        this.poly(g, this.quad(x, y, x + 1, y + 1), (x + y) % 2 ? `rgb(${104 + d},${160 + d},${72 + d})` : `rgb(${96 + d},${152 + d},${66 + d})`);
      }
      // flowers
      for (let i = 0; i < w * h * 0.08; i++) {
        const x = ((i * 7.31) % w), y = ((i * 3.77) % h), p = this.P(x, y, 0.01);
        g.fillStyle = ['#fff3b0', '#ffb3c6', '#ffffff'][i % 3]; g.beginPath(); g.arc(p[0], p[1], Math.max(1, p[2] * 0.035), 0, Math.PI * 2); g.fill();
      }
      // stations: a stone platform under a coloured canopy
      for (const st of s.stations) {
        const xs = st.cells.map((c) => c[0]), ys = st.cells.map((c) => c[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, y0 = Math.min(...ys), y1 = Math.max(...ys) + 1;
        this.poly(g, this.quad(x0 + 0.05, y0 + 0.05, x1 - 0.05, y1 - 0.05, 0.01), PAX[st.color], '#f4ead2', 2);
      }
    },
    fence(g) {
      const w = this.w, h = this.h;
      const post = (u, v) => { const a = this.P(u, v, 0), b = this.P(u, v, 0.35), s = a[2]; g.fillStyle = '#f4ead2'; g.fillRect(a[0] - s * 0.04, b[1], s * 0.08, a[1] - b[1]); };
      const rail = (u0, v0, u1, v1) => { const a = this.P(u0, v0, 0.24), b = this.P(u1, v1, 0.24); g.strokeStyle = '#e8dcc0'; g.lineWidth = Math.max(1.5, a[2] * 0.04); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
      // the far side and the two ends first, the near side later (over everything)
      rail(-0.4, -0.4, w + 0.4, -0.4);
      for (let u = -0.4; u <= w + 0.4; u += 1) post(u, -0.4);
      rail(-0.4, -0.4, -0.4, h + 0.4); rail(w + 0.4, -0.4, w + 0.4, h + 0.4);
      for (let v = 0.6; v <= h + 0.4; v += 1) { post(-0.4, v); post(w + 0.4, v); }
    },
    fenceNear(g) {
      const w = this.w, h = this.h, a = this.P(-0.4, h + 0.4, 0.24), b = this.P(w + 0.4, h + 0.4, 0.24);
      g.strokeStyle = '#e8dcc0'; g.lineWidth = Math.max(1.5, a[2] * 0.04); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      for (let u = -0.4; u <= w + 0.4; u += 1) { const p = this.P(u, h + 0.4, 0), q = this.P(u, h + 0.4, 0.35), s = p[2]; g.fillStyle = '#f4ead2'; g.fillRect(p[0] - s * 0.04, q[1], s * 0.08, p[1] - q[1]); }
    },
    // scenery: a tree or a cottage, chosen by the square
    prop(g, x, y) {
      const u = x + 0.5, v = y + 0.5;
      if ((x * 7 + y * 13) % 3) {
        const p = this.P(u, v, 0), s = p[2];
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(p[0] + s * 0.08, p[1], s * 0.35, s * 0.12, 0, 0, Math.PI * 2); g.fill();
        this.box(g, u, v, 0.14, 0.14, 0, 0.3, 0, '#7a4a26');
        for (let i = 0; i < 3; i++) {
          const base = this.P(u, v, 0.25 + i * 0.22), r = s * (0.38 - i * 0.09), tip = this.P(u, v, 0.55 + i * 0.22);
          g.fillStyle = ['#2f7d3a', '#3a9446', '#47a852'][i];
          g.beginPath(); g.moveTo(base[0] - r, base[1]); g.lineTo(base[0] + r, base[1]); g.lineTo(tip[0], tip[1]); g.closePath(); g.fill();
        }
      } else {
        const wall = ['#f4ead2', '#f7d9a8', '#e8c9c9'][(x + y) % 3];
        this.box(g, u, v, 0.78, 0.66, 0, 0.42, 0, wall);
        const a = this.P(u - 0.42, v, 0.42), b = this.P(u + 0.42, v, 0.42), r1 = this.P(u - 0.42, v, 0.72), r2 = this.P(u + 0.42, v, 0.72);
        const f1 = this.P(u - 0.42, v + 0.36, 0.42), f2 = this.P(u + 0.42, v + 0.36, 0.42);
        this.poly(g, [f1, f2, r2, r1], '#b5452c');
        this.poly(g, [a, f1, r1], '#8e3420'); void b;
        const d = this.P(u, v + 0.33, 0.12), s = d[2];
        g.fillStyle = '#6b3d1f'; g.fillRect(d[0] - s * 0.07, d[1] - s * 0.13, s * 0.14, s * 0.13);
      }
    },
    canopy(g, st) {
      const xs = st.cells.map((c) => c[0]), ys = st.cells.map((c) => c[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1, y0 = Math.min(...ys), y1 = Math.max(...ys) + 1;
      for (const [u, v] of [[x0 + 0.15, y0 + 0.15], [x1 - 0.15, y0 + 0.15]]) { const a = this.P(u, v, 0), b = this.P(u, v, 0.75), s = a[2]; g.fillStyle = '#4a3324'; g.fillRect(a[0] - s * 0.03, b[1], s * 0.06, a[1] - b[1]); }
      this.poly(g, this.quad(x0, y0 - 0.1, x1, y1 - 0.4, 0.78), this.shade(PAX[st.color], 0.85));
      this.poly(g, [this.P(x0, y1 - 0.4, 0.78), this.P(x1, y1 - 0.4, 0.78), this.P(x1, y1 - 0.4, 0.68), this.P(x0, y1 - 0.4, 0.68)], PAX[st.color]);
      const sign = this.P((x0 + x1) / 2, y1 - 0.4, 0.73), s = sign[2];
      g.fillStyle = '#fff'; g.font = `700 ${Math.round(s * 0.18)}px 'Josefin Sans', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(st.color.toUpperCase(), sign[0], sign[1]);
    },
    // a wooden peg doll waiting for the train
    passenger(g, p) {
      const u = p.x + 0.5, v = p.y + 0.5, bob = this.reduced ? 0 : Math.abs(Math.sin(this.time * 4 + p.x)) * 0.06, col = p.golden ? '#ffd23f' : PAX[p.color];
      const base = this.P(u, v, 0), s = base[2];
      if (p.golden) { const gr = g.createRadialGradient(base[0], base[1] - s * 0.3, 0, base[0], base[1] - s * 0.3, s * 0.8); gr.addColorStop(0, 'rgba(255,220,90,0.6)'); gr.addColorStop(1, 'rgba(255,220,90,0)'); g.fillStyle = gr; g.fillRect(base[0] - s, base[1] - s * 1.2, s * 2, s * 2); }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(base[0], base[1], s * 0.16, s * 0.06, 0, 0, Math.PI * 2); g.fill();
      const b0 = this.P(u, v, bob), b1 = this.P(u, v, bob + 0.32), hd = this.P(u, v, bob + 0.45);
      g.fillStyle = col; g.beginPath(); g.moveTo(b0[0] - s * 0.11, b0[1]); g.lineTo(b0[0] + s * 0.11, b0[1]); g.lineTo(b1[0] + s * 0.07, b1[1]); g.lineTo(b1[0] - s * 0.07, b1[1]); g.closePath(); g.fill();
      g.fillStyle = '#f2d2a9'; g.beginPath(); g.arc(hd[0], hd[1], s * 0.1, 0, Math.PI * 2); g.fill();
      // a little wave
      const arm = Math.sin(this.time * 8 + p.y) * 0.3;
      g.strokeStyle = col; g.lineWidth = Math.max(1.5, s * 0.04); g.beginPath(); g.moveTo(b1[0] + s * 0.06, b1[1] + s * 0.03); g.lineTo(b1[0] + s * 0.18, b1[1] - s * (0.12 + arm * 0.1)); g.stroke();
    },
    // one carriage (or the engine) of a train at (u, v), facing `ang`
    car(g, t, i, u, v, ang, color) {
      const C = TRAIN[t.id % 4];
      const P = this.P(u, v, 0), s = P[2];
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(P[0] + s * 0.06, P[1] + s * 0.04, s * 0.42, s * 0.2, 0, 0, Math.PI * 2); g.fill();
      // wheels peeking out
      const ca = Math.cos(ang), sa = Math.sin(ang);
      g.fillStyle = '#222';
      for (const a of [-0.25, 0.25]) for (const b of [-0.3, 0.3]) { const w = this.P(u + a * ca - b * sa, v + a * sa + b * ca, 0.07); g.beginPath(); g.arc(w[0], w[1], s * 0.07, 0, Math.PI * 2); g.fill(); }
      if (i === 0) {
        // the engine: chassis, boiler, cab and chimney
        this.box(g, u, v, 0.86, 0.6, 0.06, 0.2, ang, C.dark);
        this.box(g, u + ca * 0.12, v + sa * 0.12, 0.5, 0.42, 0.2, 0.48, ang, C.body);
        this.box(g, u - ca * 0.24, v - sa * 0.24, 0.32, 0.56, 0.2, 0.66, ang, C.body, C.roof);
        const ch = this.P(u + ca * 0.3, v + sa * 0.3, 0.48), ct = this.P(u + ca * 0.3, v + sa * 0.3, 0.75);
        g.fillStyle = '#2b2b2b'; g.fillRect(ch[0] - s * 0.06, ct[1], s * 0.12, ch[1] - ct[1]);
        g.fillStyle = '#ffd23f'; const lamp = this.P(u + ca * 0.43, v + sa * 0.43, 0.3); g.beginPath(); g.arc(lamp[0], lamp[1], s * 0.05, 0, Math.PI * 2); g.fill();
      } else {
        const roof = color ? PAX[color] : C.roof;
        this.box(g, u, v, 0.78, 0.56, 0.06, 0.18, ang, C.dark);
        this.box(g, u, v, 0.72, 0.5, 0.18, 0.46, ang, C.body, roof);
        // windows along the near side
        const side = -sa * 0.26 > 0 || ca * 0.26 !== 0 ? 1 : 1;
        for (const a of [-0.18, 0.18]) { const wx = u + a * ca - side * 0.255 * sa, wy = v + a * sa + side * 0.255 * ca; const p = this.P(wx, wy, 0.34); g.fillStyle = 'rgba(255,240,200,0.85)'; g.fillRect(p[0] - s * 0.06, p[1] - s * 0.05, s * 0.12, s * 0.08); }
        if (color) { const p = this.P(u, v, 0.5); g.fillStyle = '#f2d2a9'; g.beginPath(); g.arc(p[0], p[1] - s * 0.04, s * 0.06, 0, Math.PI * 2); g.fill(); }
      }
    },

    // ---------- effects ----------
    puff(u, v, hh, col, n, up) {
      if (this.reduced) n = Math.ceil(n / 3);
      const p = this.P(u, v, hh);
      for (let i = 0; i < n; i++) this.parts.push({ x: p[0], y: p[1], vx: (Math.random() - 0.5) * 30, vy: -(up || 20) - Math.random() * 30, life: 0.8 + Math.random() * 0.6, r: p[2] * (0.08 + Math.random() * 0.08), col, grow: true });
    },
    burst(u, v, col, n) {
      if (this.reduced) n = Math.ceil(n / 3);
      const p = this.P(u, v, 0.3);
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 160; this.parts.push({ x: p[0], y: p[1], vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 0.6 + Math.random() * 0.5, r: p[2] * 0.06, col, g: 400, square: true }); }
    },
    tick(dt) {
      this.time += dt; this.shake = Math.max(0, this.shake - dt * 2.5);
      for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += p.g * dt; if (p.grow) p.r += dt * 6; }
      this.parts = this.parts.filter((p) => p.life > 0);
    },
    effects(g) {
      for (const p of this.parts) {
        g.globalAlpha = Math.min(1, p.life) * (p.grow ? 0.55 : 1); g.fillStyle = p.col;
        if (p.square) g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); else { g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
      }
      g.globalAlpha = 1;
    },

    // the whole scene. f: how far (0..1) the trains are between squares
    draw(g, s, f) {
      g.save();
      if (this.shake > 0 && !this.reduced) g.translate((Math.random() - 0.5) * this.shake * 12, (Math.random() - 0.5) * this.shake * 12);
      this.table(g);
      if (s) {
        this.ground(g, s);
        this.fence(g);
        const items = [];
        s.blocks.forEach((k) => { const [x, y] = k.split(',').map(Number); items.push({ v: y + 0.5, d: () => this.prop(g, x, y) }); });
        for (const p of s.passengers) items.push({ v: p.y + 0.5, d: () => this.passenger(g, p) });
        for (const st of s.stations) items.push({ v: Math.max(...st.cells.map((c) => c[1])) + 0.2, d: () => this.canopy(g, st) });
        for (const t of s.trains) {
          if (!t.alive) continue;
          const prev = t.prev || t.body;
          t.body.forEach((c, i) => {
            const a = prev[i] || prev[prev.length - 1] || c, u = a[0] + (c[0] - a[0]) * f + 0.5, v = a[1] + (c[1] - a[1]) * f + 0.5;
            const ahead = i === 0 ? null : t.body[i - 1], aheadPrev = i === 0 ? null : prev[i - 1] || ahead;
            let ang;
            if (i === 0) { const [dx, dy] = R.DIRS[t.dir]; ang = Math.atan2(dy, dx); }
            else { const au = aheadPrev[0] + (ahead[0] - aheadPrev[0]) * f + 0.5, av = aheadPrev[1] + (ahead[1] - aheadPrev[1]) * f + 0.5; ang = Math.atan2(av - v, au - u); }
            items.push({ v, d: () => this.car(g, t, i, u, v, ang, i ? t.cars[i - 1] : null) });
          });
        }
        items.sort((a, b) => a.v - b.v).forEach((it) => it.d());
        this.fenceNear(g);
      }
      this.effects(g);
      g.restore();
    },
  };
  V.TRAIN = TRAIN; V.PAX = PAX;
  CL.View = V;
})();
