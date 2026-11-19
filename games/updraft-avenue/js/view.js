// Updraft Avenue view: a hill town's rooftops from above on festival day,
// tilted so the far rows climb toward the clocktower. Each square is a roof
// with painted number; updrafts are spiralling ribbons of warm air; drainpipes
// are copper with a funnel at the top. Players are paper kites on strings.
(function () {
  const R = UA.Rules;
  const ROOFS = ['#d9734e', '#5f8fb4', '#e3b04b', '#7fb685', '#c96f8f', '#8d7bc1', '#e08f5f', '#6fa8a0'];
  const KITES = [{ a: '#e63946', b: '#ffd166' }, { a: '#118ab2', b: '#ffffff' }, { a: '#06d6a0', b: '#073b4c' }, { a: '#9b5de5', b: '#f15bb5' }];
  const V = {
    W: 1, H: 1, S: 1, cx: 0, cy: 0, w: 10, h: 10, t: 0.03, c: 0.8, hk: 0.95, time: 0, reduced: false,
    kites: [], parts: [], clouds: null, board: null, glow: null, shake: 0,
    layout(W, H, top, bottom) {
      this.W = W; this.H = H; this.S = 1; this.cx = 0; this.cy = 0;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [u, v] of [[-0.5, -0.5], [10.5, -0.5], [-0.5, 10.6], [10.5, 10.6]]) for (const hh of [0, 2]) {
        const p = this.P(u, v, hh); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
      const aw = W - 20, ah = H - top - bottom;
      this.S = Math.min(aw / (x1 - x0), ah / (y1 - y0));
      this.cx = W / 2 - ((x0 + x1) / 2) * this.S;
      this.cy = top + ah / 2 - ((y0 + y1) / 2) * this.S;
      this.clouds = null;
    },
    k(v) { return 1 / (1 + (this.h - v) * this.t); },
    P(u, v, hh = 0) { const k = this.k(v); return [this.cx + (u - this.w / 2) * this.S * k, this.cy + ((v - this.h / 2) * this.c - hh * this.hk) * this.S * k, this.S * k]; },
    poly(g, pts, fill, stroke, lw) {
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
    },
    quad(x0, y0, x1, y1, hh = 0) { return [this.P(x0, y0, hh), this.P(x1, y0, hh), this.P(x1, y1, hh), this.P(x0, y1, hh)]; },
    shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = (c) => Math.max(0, Math.min(255, Math.round(c * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; },
    // board coords: square n's centre. Row 0 (squares 1-10) is nearest.
    sq(n) { const [c, r] = R.cell(Math.max(1, n)); return [c + 0.5, 9 - r + 0.5]; },
    roofH(n) { return 0.12 + ((n * 37) % 5) * 0.06; },
    squareAt(px, py) {
      // test squares nearest first so raised roofs win
      for (let n = 1; n <= 100; n++) {
        const [u, v] = this.sq(n), h = this.roofH(n);
        const q = this.quad(u - 0.5, v - 0.5, u + 0.5, v + 0.5, h);
        if (this.inside(px, py, q)) return n;
      }
      return 0;
    },
    inside(x, y, q) { let c = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const [xi, yi] = q[i], [xj, yj] = q[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; },

    // ---------- the sky and the hill ----------
    sky(g) {
      const { W, H } = this;
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#5fb8f0'); gr.addColorStop(0.6, '#a8dcf5'); gr.addColorStop(1, '#d9f0d0');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      if (!this.clouds) { const r = R.rng(5); this.clouds = Array.from({ length: 7 }, () => ({ x: r() * W, y: r() * H * 0.35, s: 0.6 + r() * 0.9, v: 6 + r() * 10 })); this.far = Array.from({ length: 6 }, () => ({ x: r() * W, y: 30 + r() * H * 0.25, c: KITES[(r() * 4) | 0].a, ph: r() * 6 })); }
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (const c of this.clouds) {
        const x = ((c.x + this.time * c.v) % (W + 200)) - 100;
        for (const [dx, dy, r] of [[0, 0, 26], [24, -10, 22], [48, 0, 24], [22, 8, 20]]) { g.beginPath(); g.arc(x + dx * c.s, c.y + dy * c.s, r * c.s, 0, Math.PI * 2); g.fill(); }
      }
      // far-off festival kites
      for (const k of this.far) {
        const x = k.x + Math.sin(this.time * 0.5 + k.ph) * 12, y = k.y + Math.cos(this.time * 0.7 + k.ph) * 6;
        g.fillStyle = k.c; g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 5, y); g.lineTo(x, y + 9); g.lineTo(x - 5, y); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(80,80,80,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y + 9); g.quadraticCurveTo(x + 10, y + 30, x - 4, y + 50); g.stroke();
      }
      // green hill under the town
      const base = this.P(5, 10.6, 0), top = this.P(5, -0.6, 0);
      g.fillStyle = '#7cb36a';
      g.beginPath(); g.moveTo(0, top[1] + 20); g.quadraticCurveTo(this.W / 2, top[1] - 60, this.W, top[1] + 20); g.lineTo(this.W, H); g.lineTo(0, H); g.closePath(); g.fill();
      g.fillStyle = '#6aa35a'; g.beginPath(); g.moveTo(0, base[1] - 10); g.quadraticCurveTo(this.W / 2, base[1] + 30, this.W, base[1] - 10); g.lineTo(this.W, H); g.lineTo(0, H); g.closePath(); g.fill();
    },
    // ---------- the rooftops ----------
    roofs(g) {
      // streets between the houses
      this.poly(g, this.quad(-0.3, -0.3, 10.3, 10.3, 0), '#c9bfa8');
      const order = [];
      for (let n = 1; n <= 100; n++) order.push(n);
      order.sort((a, b) => this.sq(a)[1] - this.sq(b)[1]);
      for (const n of order) {
        const [u, v] = this.sq(n), h = this.roofH(n), col = n === 100 ? '#f2c14e' : ROOFS[(n * 7 + Math.floor(n / 10)) % ROOFS.length];
        const x0 = u - 0.46, x1 = u + 0.46, y0 = v - 0.46, y1 = v + 0.46;
        // walls (front face only is visible)
        this.poly(g, [this.P(x0, y1, 0), this.P(x1, y1, 0), this.P(x1, y1, h), this.P(x0, y1, h)], '#efe6d2');
        // a little window
        const w0 = this.P(u - 0.1, y1, h * 0.25), w1 = this.P(u + 0.1, y1, h * 0.8);
        if (h > 0.15) { g.fillStyle = '#6b8fb0'; g.fillRect(w0[0], w1[1], w1[0] - w0[0], w0[1] - w1[1]); }
        // roof: two slopes meeting at a ridge
        const ridge = h + 0.14;
        this.poly(g, [this.P(x0, y0, h), this.P(x1, y0, h), this.P(x1, v, ridge), this.P(x0, v, ridge)], this.shade(col, 0.82));
        this.poly(g, [this.P(x0, v, ridge), this.P(x1, v, ridge), this.P(x1, y1, h), this.P(x0, y1, h)], col);
        // roof tiles
        g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
        for (let i = 1; i < 4; i++) { const a = this.P(x0, v + (y1 - v) * (i / 4), ridge - (ridge - h) * (i / 4)), b = this.P(x1, v + (y1 - v) * (i / 4), ridge - (ridge - h) * (i / 4)); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
        // the number, painted on the front slope
        const c = this.P(u, v + 0.25, (h + ridge) / 2 + 0.02);
        g.fillStyle = n === 100 ? '#7a3b00' : 'rgba(255,255,255,0.92)';
        g.font = `${Math.round(c[2] * 0.3)}px 'Grandstander', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(n), c[0], c[1]);
        if (this.glow && this.glow.includes(n)) { this.poly(g, [this.P(x0, y0, h + 0.01), this.P(x1, y0, h + 0.01), this.P(x1, y1, h + 0.01), this.P(x0, y1, h + 0.01)], `rgba(255,240,150,${0.35 + 0.2 * Math.sin(this.time * 8)})`); }
        // ribbons waiting on a chimney
        if (this.board && this.board.ribbons.includes(n) && !(this.taken && this.taken[n])) {
          const p = this.P(u + 0.25, v - 0.2, ridge + 0.35), r = p[2];
          g.fillStyle = '#8a5a3a'; g.fillRect(p[0] - r * 0.05, p[1], r * 0.1, r * 0.3);
          g.fillStyle = '#ff5d8f'; g.beginPath(); g.moveTo(p[0], p[1]); g.quadraticCurveTo(p[0] + r * 0.25, p[1] - r * 0.1 + Math.sin(this.time * 6 + n) * r * 0.05, p[0] + r * 0.4, p[1] + r * 0.05); g.lineTo(p[0] + r * 0.32, p[1] + r * 0.12); g.quadraticCurveTo(p[0] + r * 0.2, p[1] + r * 0.03, p[0], p[1] + r * 0.1); g.fill();
        }
      }
      // the clocktower behind square 100
      const [u, v] = this.sq(100), b = this.P(u, v - 0.6, 0), tp = this.P(u, v - 0.6, 2.4), r = b[2] * 0.36;
      g.fillStyle = '#b7a58a'; g.fillRect(b[0] - r, tp[1], r * 2, b[1] - tp[1]);
      g.fillStyle = '#8a3b2a'; g.beginPath(); g.moveTo(b[0] - r * 1.25, tp[1]); g.lineTo(b[0], tp[1] - r * 1.6); g.lineTo(b[0] + r * 1.25, tp[1]); g.fill();
      g.fillStyle = '#fff8e6'; g.beginPath(); g.arc(b[0], tp[1] + r * 0.9, r * 0.6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#333'; g.lineWidth = 2; const a = this.time * 0.5;
      g.beginPath(); g.moveTo(b[0], tp[1] + r * 0.9); g.lineTo(b[0] + Math.cos(a) * r * 0.45, tp[1] + r * 0.9 + Math.sin(a) * r * 0.45); g.moveTo(b[0], tp[1] + r * 0.9); g.lineTo(b[0], tp[1] + r * 0.5); g.stroke();
      g.fillStyle = '#ffd166'; g.beginPath(); g.moveTo(b[0], tp[1] - r * 1.6); g.lineTo(b[0] + r * 0.6, tp[1] - r * 1.75); g.lineTo(b[0], tp[1] - r * 1.9); g.fill();
    },
    // a path from square a to square b, arcing up by `lift`
    path(a, b, lift, n = 30) {
      const [u0, v0] = this.sq(a), [u1, v1] = this.sq(b), pts = [];
      const mu = (u0 + u1) / 2 + (v1 - v0) * 0.15, mv = (v0 + v1) / 2 - (u1 - u0) * 0.15;
      for (let i = 0; i <= n; i++) { const t = i / n, u = (1 - t) * (1 - t) * u0 + 2 * (1 - t) * t * mu + t * t * u1, v = (1 - t) * (1 - t) * v0 + 2 * (1 - t) * t * mv + t * t * v1; pts.push([u, v, 0.5 + Math.sin(t * Math.PI) * lift]); }
      return pts;
    },
    updraft(g, a, b) {
      const pts = this.path(a, b, 1.2, 40);
      // a swirl of warm air: a few strands twisting around the path
      for (let s = 0; s < 2; s++) {
        g.strokeStyle = s === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,214,102,0.55)';
        g.lineWidth = Math.max(1.5, this.S * 0.035); g.lineCap = 'round';
        g.beginPath();
        pts.forEach(([u, v, h], i) => { const ph = i * 0.6 + s * 2.1 + (this.reduced ? 0 : this.time * 3); const p = this.P(u + Math.cos(ph) * 0.12, v, h + Math.sin(ph) * 0.12); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
        g.stroke();
      }
      // little arrows climbing along it
      for (let k = 0; k < 3; k++) {
        const t = ((this.reduced ? 0 : this.time * 0.25) + k / 3) % 1, i = Math.floor(t * (pts.length - 1)), [u, v, h] = pts[i], [u2, v2, h2] = pts[Math.min(pts.length - 1, i + 1)];
        const p = this.P(u, v, h), q = this.P(u2, v2, h2), ang = Math.atan2(q[1] - p[1], q[0] - p[0]), r = p[2] * 0.14;
        g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(p[0] + Math.cos(ang) * r, p[1] + Math.sin(ang) * r); g.lineTo(p[0] + Math.cos(ang + 2.5) * r, p[1] + Math.sin(ang + 2.5) * r); g.lineTo(p[0] + Math.cos(ang - 2.5) * r, p[1] + Math.sin(ang - 2.5) * r); g.fill();
      }
    },
    pipe(g, a, b) {
      const pts = this.path(a, b, 0.25, 30).map(([u, v, h], i, arr) => [u + Math.sin((i / arr.length) * Math.PI * 3) * 0.25, v, h - 0.2]);
      const sp = pts.map(([u, v, h]) => this.P(u, v, h));
      g.lineCap = 'round'; g.lineJoin = 'round';
      const w = Math.max(5, this.S * 0.16);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = w + 3; g.beginPath(); sp.forEach((p, i) => (i ? g.lineTo(p[0] + 2, p[1] + 4) : g.moveTo(p[0] + 2, p[1] + 4))); g.stroke();
      g.strokeStyle = '#8c4a24'; g.lineWidth = w; g.beginPath(); sp.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      g.strokeStyle = '#d98a4e'; g.lineWidth = w * 0.45; g.beginPath(); sp.forEach((p, i) => (i ? g.lineTo(p[0] - w * 0.15, p[1] - w * 0.15) : g.moveTo(p[0] - w * 0.15, p[1] - w * 0.15))); g.stroke();
      // brackets along the pipe
      g.fillStyle = '#5a2e14';
      for (let i = 5; i < sp.length - 3; i += 7) { const p = sp[i]; g.fillRect(p[0] - w * 0.6, p[1] - w * 0.18, w * 1.2, w * 0.36); }
      // the funnel at the top, the spout at the bottom
      const top = sp[0], r = top[2] * 0.22;
      g.fillStyle = '#b06a36'; g.beginPath(); g.ellipse(top[0], top[1] - r * 0.3, r, r * 0.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3a1e0c'; g.beginPath(); g.ellipse(top[0], top[1] - r * 0.35, r * 0.7, r * 0.32, 0, 0, Math.PI * 2); g.fill();
      const end = sp[sp.length - 1];
      g.fillStyle = '#b06a36'; g.beginPath(); g.ellipse(end[0], end[1], r * 0.6, r * 0.35, 0, 0, Math.PI * 2); g.fill();
    },
    kite(g, k, i) {
      const col = KITES[(this.kiteCol ? this.kiteCol[i] : i) % 4];
      const base = this.P(k.u, k.v, k.h), r = base[2] * 0.3 * (k.scale || 1);
      const sw = this.reduced ? 0 : Math.sin(this.time * 3 + i) * 0.15;
      // shadow on the roofs
      const sh = this.P(k.u, k.v, 0.35);
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(sh[0], sh[1], r * 0.8, r * 0.3, 0, 0, Math.PI * 2); g.fill();
      // string down to the roof
      g.strokeStyle = 'rgba(60,60,60,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(base[0], base[1] + r); g.quadraticCurveTo(base[0] + r, (base[1] + sh[1]) / 2, sh[0], sh[1]); g.stroke();
      g.save(); g.translate(base[0], base[1]); g.rotate(sw);
      // tail of bows
      g.strokeStyle = col.b; g.lineWidth = 2; g.beginPath(); g.moveTo(0, r * 1.3);
      for (let j = 1; j <= 4; j++) g.lineTo(Math.sin(this.time * 4 + j + i) * r * 0.3, r * 1.3 + j * r * 0.35);
      g.stroke();
      for (let j = 1; j <= 3; j++) { const x = Math.sin(this.time * 4 + j + i) * r * 0.3, y = r * 1.3 + j * r * 0.35; g.fillStyle = j % 2 ? col.a : col.b; g.beginPath(); g.moveTo(x - r * 0.15, y - r * 0.08); g.lineTo(x + r * 0.15, y + r * 0.08); g.lineTo(x + r * 0.15, y - r * 0.08); g.lineTo(x - r * 0.15, y + r * 0.08); g.fill(); }
      // the diamond, in two colours, with a cross spar
      g.fillStyle = col.a; g.beginPath(); g.moveTo(0, -r * 1.2); g.lineTo(r * 0.85, -r * 0.15); g.lineTo(0, r * 1.3); g.closePath(); g.fill();
      g.fillStyle = col.b; g.beginPath(); g.moveTo(0, -r * 1.2); g.lineTo(-r * 0.85, -r * 0.15); g.lineTo(0, r * 1.3); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -r * 1.2); g.lineTo(0, r * 1.3); g.moveTo(-r * 0.85, -r * 0.15); g.lineTo(r * 0.85, -r * 0.15); g.stroke();
      g.strokeStyle = '#222'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -r * 1.2); g.lineTo(r * 0.85, -r * 0.15); g.lineTo(0, r * 1.3); g.lineTo(-r * 0.85, -r * 0.15); g.closePath(); g.stroke();
      if (k.turn) { g.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.sin(this.time * 6)})`; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r * 1.6, 0, Math.PI * 2); g.stroke(); }
      g.restore();
    },
    // ---------- motion ----------
    // a queue of hops for each kite: [{ path: [[u,v,h]...], dur }]
    go(i, path, dur) { const k = this.kites[i]; k.queue.push({ path, dur: this.reduced ? 0.01 : dur, t: 0 }); },
    hop(i, from, to) { const [u0, v0] = this.sq(from || 1), [u1, v1] = this.sq(to), path = []; for (let s = 0; s <= 10; s++) { const t = s / 10; path.push([u0 + (u1 - u0) * t, v0 + (v1 - v0) * t, 0.9 + Math.sin(t * Math.PI) * 0.6]); } this.go(i, path, 0.2); },
    moving() { return this.kites.some((k) => k.queue.length); },
    tick(dt) {
      this.time += dt;
      this.kites.forEach((k, i) => {
        const q = k.queue[0];
        if (!q) { k.h = 0.9 + (this.reduced ? 0 : Math.sin(this.time * 2 + i) * 0.08); return; }
        q.t += dt;
        const f = Math.min(1, q.t / q.dur), n = q.path.length - 1, x = f * n, j = Math.min(n - 1, Math.floor(x)), r = x - j;
        const a = q.path[j], b = q.path[j + 1] || a;
        k.u = a[0] + (b[0] - a[0]) * r; k.v = a[1] + (b[1] - a[1]) * r; k.h = a[2] + (b[2] - a[2]) * r;
        if (f >= 1) { k.queue.shift(); if (this.onHop) this.onHop(i, q); }
      });
      for (const p of this.parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; }
      this.parts = this.parts.filter((p) => p.life < p.max);
      this.shake = Math.max(0, this.shake - dt * 3);
    },
    confetti(x, y, n) { const cols = ['#e63946', '#ffd166', '#06d6a0', '#118ab2', '#f15bb5']; for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 220; this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 200, life: 0, max: 1 + Math.random(), col: cols[i % 5], r: 3 + Math.random() * 3 }); } },
    // place kites on their squares, spread out when sharing
    settle(pos, turn) {
      pos.forEach((p, i) => {
        const k = this.kites[i] || (this.kites[i] = { u: 0, v: 0, h: 0.9, queue: [] });
        if (k.queue.length) return;
        const [u, v] = this.sq(p || 1), same = pos.filter((x, j) => x === p && j < i).length, many = pos.filter((x) => x === p).length;
        k.u = p ? u + (many > 1 ? (same - (many - 1) / 2) * 0.3 : 0) : -0.4 + i * 0.3; k.v = p ? v : 10.4; k.turn = i === turn;
      });
    },
    draw(g, s) {
      g.save();
      if (this.shake && !this.reduced) g.translate((Math.random() - 0.5) * this.shake * 8, 0);
      this.sky(g);
      this.roofs(g);
      if (this.board) {
        for (const [a, b] of this.board.down) this.pipe(g, a, b);
        for (const [a, b] of this.board.up) this.updraft(g, a, b);
      }
      const order = this.kites.map((k, i) => i).sort((a, b) => this.kites[a].v - this.kites[b].v);
      for (const i of order) this.kite(g, this.kites[i], i);
      for (const p of this.parts) { g.globalAlpha = Math.max(0, 1 - p.life / p.max); g.fillStyle = p.col; g.fillRect(p.x, p.y, p.r, p.r * 1.6); }
      g.globalAlpha = 1;
      g.restore();
    },
    KITES,
  };
  UA.View = V;
})();
