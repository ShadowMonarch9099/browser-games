// Knot Alone view: a granite cliff at dawn, drawn in 2.5D. Ledges are slabs
// that stick out of the rock face toward you; a vanishing point in the middle
// of the screen shows their snowy tops below eye level and their undersides
// above it, and the side pillars frame the route like a chimney. The sun rises
// as the pair gains height.
(function () {
  const R = KA.Rules, COLS = R.COLS;
  const TEAM = [{ c: '#e4572e', d: '#9c3017', l: '#ff8a65' }, { c: '#17a398', d: '#0d6b63', l: '#5fd3c7' }];
  const V = {
    W: 1, H: 1, u: 40, camX: COLS / 2, camY: 0, vx: 0, vy: 0, time: 0, reduced: false, parts: [], snow: [], shake: 0,
    resize(W, H) {
      this.W = W; this.H = H;
      this.u = Math.min(H / 10.5, Math.max(W / (COLS + 1.2), Math.min(W / 11, H / 16)));
      this.vx = W / 2; this.vy = H * 0.42;
      this.snow = Array.from({ length: Math.round((W * H) / 9000) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 0.8 + Math.random() * 2.2, s: 18 + Math.random() * 40, ph: Math.random() * 6 }));
    },
    X(x) { return this.W / 2 + (x - this.camX) * this.u; },
    Y(y) { return this.H * 0.6 - (y - this.camY) * this.u; },
    k(d) { return 1 / (1 + d * 0.3); },
    P(x, y, d) { const k = this.k(d); return [this.vx + (this.X(x) - this.vx) * k, this.vy + (this.Y(y) - this.vy) * k, this.u * k]; },
    poly(g, pts, fill, stroke, lw) {
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
    },
    // follow a point, keeping the cliff on screen sideways when it fits
    follow(x, y, dt) {
      const span = (this.W / this.u) / 2;
      const tx = COLS + 0.4 <= span * 2 ? COLS / 2 : Math.max(span - 0.2, Math.min(COLS - span + 0.2, x));
      const e = Math.min(1, dt * 4);
      this.camX += (tx - this.camX) * e; this.camY += (y - this.camY) * e;
    },
    snap(x, y) { this.camX = x; this.camY = y; this.follow(x, y, 1); },

    // ---------- scenery ----------
    sky(g, prog) {
      const W = this.W, H = this.H;
      const sky = g.createLinearGradient(0, 0, 0, H);
      const top = this.mix('#2b3f73', '#4f8fd6', prog), mid = this.mix('#f48c6c', '#9fd0f2', prog), low = this.mix('#ffd29d', '#e8f4fd', prog);
      sky.addColorStop(0, top); sky.addColorStop(0.55, mid); sky.addColorStop(1, low);
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      // the sun climbs with you
      const sy = H * (0.75 - prog * 0.6), sx = W * 0.78;
      const sg = g.createRadialGradient(sx, sy, 0, sx, sy, H * 0.35);
      sg.addColorStop(0, 'rgba(255,240,200,0.95)'); sg.addColorStop(0.08, 'rgba(255,220,150,0.8)'); sg.addColorStop(1, 'rgba(255,200,140,0)');
      g.fillStyle = sg; g.fillRect(0, 0, W, H);
      // three ranges of far peaks, each drifting at its own pace
      const ranges = [[0.08, '#8fa9cf', 0.62, 0.32, 0.007], [0.16, '#6f89b3', 0.72, 0.26, 0.011], [0.3, '#4e6690', 0.84, 0.2, 0.016]];
      for (const [par, col, base, amp, fr] of ranges) {
        const off = this.camY * this.u * par, shift = this.camX * this.u * par * 0.5;
        g.fillStyle = this.mix(col, '#c9dcef', prog * 0.3);
        g.beginPath(); g.moveTo(0, H);
        for (let x = -20; x <= W + 20; x += 18) {
          const t = (x + shift) * fr;
          g.lineTo(x, H * base + off - (Math.abs(Math.sin(t)) * 0.7 + Math.abs(Math.sin(t * 2.3 + 1)) * 0.3) * H * amp);
        }
        g.lineTo(W, H); g.closePath(); g.fill();
      }
    },
    mix(a, b, t) {
      t = Math.max(0, Math.min(1, t));
      const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const A = p(a), B = p(b);
      return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
    },
    wall(g, s) {
      const top = this.camY + (this.H * 0.6) / this.u + 4, bot = this.camY - (this.H * 0.4) / this.u - 4;
      const y0 = Math.max(-3, Math.floor(bot)), y1 = Math.ceil(top);
      // the rock face: banded strata, darker toward the top of each band
      for (let y = y0; y < y1; y++) {
        const shade = ((y * 7919) % 5) / 5;
        this.poly(g, [this.P(1, y + 1, 1), this.P(COLS - 1, y + 1, 1), this.P(COLS - 1, y, 1), this.P(1, y, 1)], this.mix('#6b7680', '#828d96', shade));
      }
      g.strokeStyle = 'rgba(30,35,45,0.35)'; g.lineWidth = 1.5;
      for (let y = y0; y < y1; y++) for (let i = 0; i < 3; i++) {
        const r = (y * 131 + i * 977) % 97;
        if (r > 40) continue;
        const x = 2 + (r % 16), a = this.P(x, y + 0.9, 1), b = this.P(x + 0.4, y + 0.4, 1), c = this.P(x + 0.1, y, 1);
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke();
      }
      // painted altitude marks every 5 m
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let y = Math.ceil(y0 / 5) * 5; y < y1; y += 5) {
        if (y <= 0) continue;
        const p = this.P(COLS / 2, y + 0.5, 1);
        g.font = `400 ${Math.round(p[2] * 0.55)}px 'Alfa Slab One', serif`; g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillText(`${y} m`, p[0], p[1]);
      }
      // the floor of the gully
      this.poly(g, [this.P(1, 0, 0), this.P(COLS - 1, 0, 0), this.P(COLS - 1, 0, 1), this.P(1, 0, 1)], '#e8eef5');
    },
    pillars(g) {
      const top = this.camY + (this.H * 0.6) / this.u + 6, bot = Math.max(-3, this.camY - (this.H * 0.4) / this.u - 6);
      for (const [x0, x1, face] of [[-1, 1, 1], [COLS - 1, COLS + 1, 0]]) {
        const fx = face ? x1 : x0;
        // the inner face, receding toward the wall
        this.poly(g, [this.P(fx, top, 0), this.P(fx, top, 1), this.P(fx, bot, 1), this.P(fx, bot, 0)], '#4b545e');
        const gr = g.createLinearGradient(this.P(x0, 0, 0)[0], 0, this.P(x1, 0, 0)[0], 0);
        gr.addColorStop(0, face ? '#59636e' : '#6f7a85'); gr.addColorStop(1, face ? '#6f7a85' : '#59636e');
        this.poly(g, [this.P(x0, top, 0), this.P(x1, top, 0), this.P(x1, bot, 0), this.P(x0, bot, 0)], gr);
        g.strokeStyle = 'rgba(20,25,30,0.25)'; g.lineWidth = 2;
        for (let y = Math.floor(bot); y < top; y += 2) { const a = this.P(x0, y + ((y * 13) % 3) * 0.3, 0), b = this.P(x1, y + 0.4, 0); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      }
    },
    ledge(g, l, n) {
      const x0 = l.x, x1 = l.x + l.w, y = l.y, yb = l.y - (l.y ? 0.7 : 3);
      const fy = this.Y(y), fby = this.Y(yb), lx = this.X(x0), rx = this.X(x1);
      const icy = n >= 4;
      if (fby < this.vy) this.poly(g, [this.P(x0, yb, 0), this.P(x1, yb, 0), this.P(x1, yb, 1), this.P(x0, yb, 1)], '#3d454e');
      if (lx > this.vx) this.poly(g, [this.P(x0, y, 0), this.P(x0, y, 1), this.P(x0, yb, 1), this.P(x0, yb, 0)], '#4f5963');
      if (rx < this.vx) this.poly(g, [this.P(x1, y, 0), this.P(x1, y, 1), this.P(x1, yb, 1), this.P(x1, yb, 0)], '#4f5963');
      if (fy > this.vy) {
        const a = this.P(x0, y, 0), b = this.P(x0, y, 1), sg = g.createLinearGradient(0, a[1], 0, b[1]);
        sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, icy ? '#b9d6ee' : '#d5e2ee');
        this.poly(g, [this.P(x0, y, 0), this.P(x1, y, 0), this.P(x1, y, 1), this.P(x0, y, 1)], sg);
      }
      // the front face: granite with strata
      const f = [this.P(x0, y, 0), this.P(x1, y, 0), this.P(x1, yb, 0), this.P(x0, yb, 0)];
      const fg = g.createLinearGradient(0, f[0][1], 0, f[2][1]);
      fg.addColorStop(0, '#7d8892'); fg.addColorStop(1, '#58626c');
      this.poly(g, f, fg);
      g.strokeStyle = 'rgba(30,35,45,0.25)'; g.lineWidth = 1;
      for (let s = 1; s < 3 && l.y; s++) { const p = this.P(x0, y - s * 0.23, 0), q = this.P(x1, y - s * 0.23, 0); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); }
      // a lip of snow along the front edge, and icicles on the icy climbs
      const lip = [];
      for (let i = 0; i <= l.w * 3; i++) { const xx = x0 + i / 3, p = this.P(xx, y + 0.06, 0); lip.push(p); }
      for (let i = l.w * 3; i >= 0; i--) { const xx = x0 + i / 3, p = this.P(xx, y - 0.1 - ((i * 7) % 3) * 0.04, 0); lip.push(p); }
      this.poly(g, lip, '#ffffff');
      if (icy && l.y) {
        g.fillStyle = 'rgba(200,230,255,0.85)';
        for (let i = 0; i < l.w * 2; i++) {
          if ((i * 37 + l.y * 11) % 5 > 2) continue;
          const xx = x0 + 0.25 + i / 2, len = 0.15 + ((i * 13 + l.y) % 4) * 0.08, p = this.P(xx, yb, 0), q = this.P(xx, yb - len, 0), s = p[2];
          g.beginPath(); g.moveTo(p[0] - s * 0.06, p[1]); g.lineTo(p[0] + s * 0.06, p[1]); g.lineTo(q[0], q[1]); g.closePath(); g.fill();
        }
      }
      // a few hardy pines and tufts on the lower climbs
      if (!icy && l.y && (l.y * 7 + l.x) % 3 === 0) this.pine(g, x0 + 0.6, y, 0.75);
    },
    pine(g, x, y, d) {
      const p = this.P(x, y, d), s = p[2];
      g.fillStyle = '#5b3a24'; g.fillRect(p[0] - s * 0.04, p[1] - s * 0.25, s * 0.08, s * 0.25);
      for (let i = 0; i < 3; i++) {
        const w = s * (0.32 - i * 0.08), yy = p[1] - s * (0.18 + i * 0.22);
        g.fillStyle = i % 2 ? '#2f6b4a' : '#3b7f58';
        g.beginPath(); g.moveTo(p[0] - w, yy); g.lineTo(p[0] + w, yy); g.lineTo(p[0], yy - s * 0.38); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.moveTo(p[0] - w * 0.4, yy - s * 0.22); g.lineTo(p[0] + w * 0.35, yy - s * 0.22); g.lineTo(p[0], yy - s * 0.38); g.closePath(); g.fill();
      }
    },
    flag(g, l, win) {
      const x = l.x + l.w / 2, y = l.y, base = this.P(x, y, 0.5), topP = this.P(x, y + 2.3, 0.5), s = base[2];
      // a cairn of stones
      for (let i = 0; i < 4; i++) { const r = s * (0.22 - i * 0.04); g.fillStyle = i % 2 ? '#8a939c' : '#a1aab2'; g.beginPath(); g.ellipse(base[0] + s * 0.5, base[1] - r - i * s * 0.12, r * 1.3, r, 0, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = '#2a2f36'; g.lineWidth = Math.max(2, s * 0.06);
      g.beginPath(); g.moveTo(base[0], base[1]); g.lineTo(topP[0], topP[1]); g.stroke();
      const amp = win ? 0.25 : 0.1, pts = [];
      for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([topP[0] + t * s * 1.3, topP[1] + Math.sin(this.time * 6 - t * 4) * s * amp * t]); }
      for (let i = 8; i >= 0; i--) { const t = i / 8; pts.push([topP[0] + t * s * 1.3, topP[1] + s * 0.75 + Math.sin(this.time * 6 - t * 4) * s * amp * t]); }
      this.poly(g, pts, '#f2c14e');
      g.fillStyle = '#c2410c'; g.font = `400 ${Math.round(s * 0.42)}px 'Alfa Slab One', serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('▲', topP[0] + s * 0.6, topP[1] + s * 0.38 + Math.sin(this.time * 6 - 2) * s * amp * 0.5);
    },

    // ---------- the climbers and the rope ----------
    rope(g, s) {
      const D = 0.3, pts = s.rope.map((q) => this.P(q.x, q.y, D));
      const w = Math.max(2.5, pts[0][2] * 0.1);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = s.taut ? '#d62828' : '#ff7a1a'; g.lineWidth = w * (s.taut ? 1.1 : 1);
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = w * 0.35; g.setLineDash([w * 0.8, w * 1.2]);
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      g.setLineDash([]);
    },
    climber(g, c, active, cheer) {
      const T = TEAM[c.i], p = this.P(c.x, c.y, 0.3), s = p[2], x = p[0], y = p[1], f = c.face || 1;
      const walk = c.ground && Math.abs(c.vx) > 0.3 ? Math.sin(this.time * 14 + c.i) : 0;
      const air = !c.ground && !c.pinned;
      // shadow on the ledge
      if (c.ground || c.pinned) { g.fillStyle = 'rgba(20,30,50,0.25)'; g.beginPath(); g.ellipse(x, y, s * 0.36, s * 0.08, 0, 0, Math.PI * 2); g.fill(); }
      if (active) { g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, s * 0.45, s * 0.12, 0, 0, Math.PI * 2); g.stroke(); }
      g.lineCap = 'round';
      // legs
      g.strokeStyle = '#2b3445'; g.lineWidth = s * 0.13;
      const hip = y - s * 0.38;
      g.beginPath(); g.moveTo(x - s * 0.08, hip); g.lineTo(x - s * 0.1 + walk * s * 0.12 + (air ? -s * 0.08 : 0), y - (air ? s * 0.08 : 0)); g.stroke();
      g.beginPath(); g.moveTo(x + s * 0.08, hip); g.lineTo(x + s * 0.1 - walk * s * 0.12 + (air ? s * 0.1 : 0), y - (air ? s * 0.14 : 0)); g.stroke();
      // backpack, then the jacket
      g.fillStyle = T.d; g.beginPath(); g.roundRect(x - f * s * 0.36, hip - s * 0.42, s * 0.22, s * 0.4, s * 0.06); g.fill();
      g.fillStyle = T.c; g.beginPath(); g.roundRect(x - s * 0.22, hip - s * 0.44, s * 0.44, s * 0.48, s * 0.12); g.fill();
      g.fillStyle = T.l; g.fillRect(x - s * 0.22, hip - s * 0.12, s * 0.44, s * 0.06);
      // arms: up when cheering or jumping, one reaching to the rope when anchored
      g.strokeStyle = T.c; g.lineWidth = s * 0.11;
      const sh = hip - s * 0.36, up = cheer || air;
      const wave = cheer ? Math.sin(this.time * 10 + c.i * 2) * s * 0.08 : 0;
      g.beginPath(); g.moveTo(x - s * 0.18, sh); g.lineTo(x - s * 0.3, up ? sh - s * 0.3 + wave : sh + s * 0.25); g.stroke();
      g.beginPath(); g.moveTo(x + s * 0.18, sh); g.lineTo(x + s * 0.3 * (c.pinned ? 0.6 : 1), up ? sh - s * 0.3 - wave : c.pinned ? sh + s * 0.38 : sh + s * 0.25); g.stroke();
      // head, helmet, goggles
      const hy = sh - s * 0.2;
      g.fillStyle = '#ffd9b8'; g.beginPath(); g.arc(x, hy, s * 0.16, 0, Math.PI * 2); g.fill();
      g.fillStyle = T.d; g.beginPath(); g.arc(x, hy - s * 0.03, s * 0.18, Math.PI, 0); g.fill();
      g.fillStyle = '#1d2533'; g.fillRect(x + f * s * 0.02 - s * 0.08, hy - s * 0.02, s * 0.16, s * 0.06);
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + f * s * 0.04 - s * 0.05, hy - s * 0.01, s * 0.04, s * 0.02);
      if (c.pinned) {
        // the anchor: a piton in the rock and a clipped carabiner
        g.strokeStyle = '#c7ccd3'; g.lineWidth = Math.max(1.5, s * 0.05);
        g.beginPath(); g.ellipse(x + s * 0.3, y - s * 0.1, s * 0.07, s * 0.11, 0.3, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#9aa1ab'; g.fillRect(x + s * 0.27, y - s * 0.02, s * 0.08, s * 0.08);
        g.fillStyle = '#ffffff'; g.font = `700 ${Math.round(s * 0.34)}px Rubik, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('⚓', x, hy - s * 0.48);
      }
    },
    // little arrows at the screen edge for a climber who is out of view
    offscreen(g, c) {
      const p = this.P(c.x, c.y + 0.5, 0.3), m = 26;
      if (p[0] > m && p[0] < this.W - m && p[1] > m && p[1] < this.H - m) return;
      const x = Math.max(m, Math.min(this.W - m, p[0])), y = Math.max(m + 50, Math.min(this.H - m - 60, p[1])), a = Math.atan2(p[1] - y, p[0] - x);
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = TEAM[c.i].c; g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(14, 0); g.lineTo(-8, -10); g.lineTo(-8, 10); g.closePath(); g.fill(); g.stroke();
      g.restore();
    },

    // ---------- effects ----------
    puff(x, y, n, col) {
      if (this.reduced) n = Math.ceil(n / 3);
      const p = this.P(x, y, 0.3);
      for (let i = 0; i < n; i++) this.parts.push({ x: p[0], y: p[1], vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 70, life: 0.5 + Math.random() * 0.3, r: 2 + Math.random() * 4, col: col || '#ffffff', g: 120 });
    },
    confetti(x, y) {
      const p = this.P(x, y, 0.3), cols = ['#f2c14e', '#e4572e', '#17a398', '#ffffff', '#4f8fd6'], n = this.reduced ? 20 : 90;
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, s = 200 + Math.random() * 400; this.parts.push({ x: p[0], y: p[1], vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.6 + Math.random(), r: 3 + Math.random() * 3, col: cols[i % 5], g: 380, conf: true, spin: Math.random() * 6 }); }
    },
    tick(dt) {
      this.time += dt;
      this.shake = Math.max(0, this.shake - dt * 3);
      for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.97; if (p.conf) p.spin += dt * 9; }
      this.parts = this.parts.filter((p) => p.life > 0);
      if (!this.reduced && this.snowOn !== false) for (const f of this.snow) { f.y += f.s * dt; f.x += Math.sin(this.time + f.ph) * 12 * dt; if (f.y > this.H + 4) { f.y = -4; f.x = Math.random() * this.W; } }
    },

    draw(g, s, o) {
      const W = this.W, H = this.H, lv = s.lv;
      g.save();
      if (this.shake > 0 && !this.reduced) g.translate((Math.random() - 0.5) * this.shake * 10, (Math.random() - 0.5) * this.shake * 10);
      const prog = Math.max(0, Math.min(1, this.camY / Math.max(1, lv.flag.y)));
      this.sky(g, prog);
      this.wall(g, s);
      // ledges: furthest from eye level first, so nearer faces overlap correctly
      const vis = lv.ledges.filter((l) => { const y = this.Y(l.y); return y > -H * 0.6 && y < H * 1.6; });
      vis.sort((a, b) => Math.abs(this.Y(b.y) - this.vy) - Math.abs(this.Y(a.y) - this.vy));
      vis.forEach((l) => this.ledge(g, l, lv.n));
      this.pillars(g);
      // dawn light washes the rock: rose at the bottom of the climb, clear gold near the top
      const wash = g.createLinearGradient(0, 0, W, H);
      wash.addColorStop(0, `rgba(255,${Math.round(150 + prog * 70)},${Math.round(110 + prog * 60)},${0.2 - prog * 0.08})`);
      wash.addColorStop(1, 'rgba(60,80,140,0.12)');
      g.fillStyle = wash; g.fillRect(0, 0, W, H);
      // the snowfield at the foot of the cliff
      const gy = this.P(0, -3, 0)[1];
      if (gy < H) {
        const sg = g.createLinearGradient(0, gy, 0, H);
        sg.addColorStop(0, '#f4f8fc'); sg.addColorStop(1, '#c9d9ea');
        g.fillStyle = sg; g.fillRect(0, gy, W, H - gy + 20);
        g.fillStyle = 'rgba(120,150,190,0.25)';
        for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(((i * 211 + 80) % W), gy + 20 + ((i * 53) % 60), 60 + i * 10, 8, 0, 0, Math.PI * 2); g.fill(); }
      }
      this.flag(g, lv.flag, s.won);
      this.rope(g, s);
      const order = s.climbers.slice().sort((a, b) => b.y - a.y);
      for (const c of order) this.climber(g, c, o && o.solo && o.active === c.i, s.won);
      // a band of mist drifting across the middle of the climb
      const my = this.Y(lv.flag.y * 0.55);
      if (my > -100 && my < H + 100) {
        const mg = g.createLinearGradient(0, my - this.u * 1.6, 0, my + this.u * 1.6);
        mg.addColorStop(0, 'rgba(255,255,255,0)'); mg.addColorStop(0.5, 'rgba(255,255,255,0.38)'); mg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = mg; g.fillRect(0, my - this.u * 1.6, W, this.u * 3.2);
      }
      for (const p of this.parts) {
        g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.col;
        if (p.conf) { g.save(); g.translate(p.x, p.y); g.rotate(p.spin); g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); }
        else { g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
      }
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,255,255,0.8)';
      if (this.snowOn !== false) for (const f of this.snow) { g.beginPath(); g.arc(f.x, f.y, f.r, 0, Math.PI * 2); g.fill(); }
      g.restore();
      if (o && o.arrows) s.climbers.forEach((c) => this.offscreen(g, c));
    },
  };
  V.TEAM = TEAM;
  KA.View = V;
})();
