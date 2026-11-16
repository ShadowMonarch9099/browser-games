// Puck Scuffle view: the parlour table drawn in 3D on a 2D canvas.
// Against the house the camera stands behind the red end and looks down the
// table in perspective. With two players it looks straight down (fair to
// both ends), turning the table sideways on wide screens. Rails, cabinet,
// mallets and pucks are extruded; an overhead lamp throws their shadows.
(function () {
  const R = PS.Rules, LEN = R.LEN;
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  const COL = ['#e8412c', '#2c7be5'], LITE = ['#ff8a70', '#79b4ff'], DARK = ['#8f2516', '#163f80'];
  const TOKEN_COL = { split: '#9b4de6', big: '#f0a020', shrink: '#1fae9c' };
  const TOKEN_TXT = { split: '2', big: '+', shrink: '<' };

  const V = {
    w: 1, h: 1, side: false, persp: true, t: 0, c: 1, hk: 0.4, S: 1, cx: 0, cy: 0, U: 1, D: LEN,
    parts: [], rings: [], shake: 0, flash: [0, 0], time: 0, reduced: false,

    layout(w, h, persp) {
      this.w = w; this.h = h; this.persp = persp;
      this.side = !persp && w > h * 1.05;
      this.t = persp ? 0.36 : 0; this.c = persp ? 0.74 : 1; this.hk = persp ? 0.9 : 0.35;
      this.U = this.side ? LEN : 1; this.D = this.side ? 1 : LEN;
      this.S = 1; this.cx = 0; this.cy = 0;
      const m = 0.17; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [u, v] of [[-m, -m], [this.U + m, -m], [-m, this.D + m], [this.U + m, this.D + m]]) {
        for (const hh of [0.06, -0.3]) { const [sx, sy] = this.uv(u, v, hh); x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
      }
      const top = persp ? Math.max(70, h * 0.15) : h * 0.03, bottom = h * 0.03, availH = h - top - bottom, availW = w * (w < 500 ? 0.98 : 0.94);
      this.S = Math.min(availW / (x1 - x0), availH / (y1 - y0));
      this.cx = w / 2 - ((x0 + x1) / 2) * this.S;
      this.cy = top + (availH - (y1 - y0) * this.S) / 2 - y0 * this.S;
      this.boardTop = this.cy + y0 * this.S;
    },
    k(v) { return 1 / (1 + (this.D - v) * this.t); },
    uv(u, v, hh) {
      const k = this.k(v);
      return [this.cx + (u - this.U / 2) * this.S * k, this.cy + ((v - this.D / 2) * this.c - hh * this.hk) * this.S * k, this.S * k,
        this.c * (1 + (v - this.D / 2) * this.t * k)];
    },
    map(x, y) { return this.side ? [LEN - y, x] : [x, y]; },
    P(x, y, hh = 0) { const [u, v] = this.map(x, y); return this.uv(u, v, hh); },
    // screen point -> table point on the surface
    unproject(sx, sy) {
      const a = (sx - this.cx) / this.S, b = (sy - this.cy) / this.S, D = this.D, t = this.t, c = this.c;
      const v = (b + b * D * t + (D * c) / 2) / (c + b * t), u = a / this.k(v) + this.U / 2;
      return this.side ? [v, LEN - u] : [u, v];
    },
    // a held screen-direction axis -> table direction
    axis(a) { return this.side ? [a[1], -a[0]] : a; },

    poly(g, pts, fill, stroke, lw) {
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
    },
    // a box given by two table corners: draws its top and the face toward the camera
    box(g, x0, y0, x1, y1, h0, h1, top, front) {
      const a = this.map(x0, y0), b = this.map(x1, y1);
      const u0 = Math.min(a[0], b[0]), u1 = Math.max(a[0], b[0]), v0 = Math.min(a[1], b[1]), v1 = Math.max(a[1], b[1]);
      if (front) this.poly(g, [this.uv(u0, v1, h1), this.uv(u1, v1, h1), this.uv(u1, v1, h0), this.uv(u0, v1, h0)], front);
      this.poly(g, [this.uv(u0, v0, h1), this.uv(u1, v0, h1), this.uv(u1, v1, h1), this.uv(u0, v1, h1)], top);
    },
    circle(x, y, r, hh = 0, n = 28) { const out = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push(this.P(x + Math.cos(a) * r, y + Math.sin(a) * r, hh)); } return out; },

    // ---------- effects ----------
    burst(x, y, color, n, speed) {
      if (this.reduced) n = Math.ceil(n / 3);
      const p = this.P(x, y, 0.02);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = (0.3 + Math.random()) * speed * p[2];
        this.parts.push({ x: p[0], y: p[1], vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * p[2] * 0.3, life: 0.4 + Math.random() * 0.4, max: 0.8, color, size: 1.5 + Math.random() * 2.5 });
      }
    },
    ring(x, y, color, size) { this.rings.push({ x, y, color, r: 0.02, max: size, life: 0.5 }); },
    confetti(scorer) {
      const y = scorer === 0 ? 0 : LEN, n = this.reduced ? 20 : 70;
      for (let i = 0; i < n; i++) {
        const p = this.P(0.5 + (Math.random() - 0.5) * 0.5, y, 0.05), s = p[2] * (0.6 + Math.random() * 1.2), a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
        this.parts.push({ x: p[0], y: p[1], vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 + Math.random(), max: 2, color: Math.random() < 0.5 ? COL[scorer] : ['#fbf0d9', '#ffd27a'][i % 2], size: 3 + Math.random() * 3, conf: true, spin: Math.random() * 6 });
      }
    },
    tick(dt) {
      this.time += dt;
      this.shake = Math.max(0, this.shake - dt * 2.5);
      this.flash = this.flash.map((f) => Math.max(0, f - dt * 1.2));
      for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.conf ? 260 : 500) * dt; if (p.conf) { p.vx *= 0.98; p.vy *= 0.97; p.spin += dt * 8; } }
      this.parts = this.parts.filter((p) => p.life > 0);
      for (const r of this.rings) { r.life -= dt; r.r += (r.max - r.r) * Math.min(1, dt * 9); }
      this.rings = this.rings.filter((r) => r.life > 0);
    },

    // ---------- drawing ----------
    draw(g, m, o) {
      const w = this.w, h = this.h;
      g.save();
      if (this.shake > 0 && !this.reduced) g.translate((Math.random() - 0.5) * this.shake * 14, (Math.random() - 0.5) * this.shake * 14);
      this.room(g);
      this.table(g, m);
      this.marks(g, m, o);
      this.goals(g, m);
      this.rails(g, m);
      this.things(g, m);
      for (const r of this.rings) this.poly(g, this.circle(r.x, r.y, r.r, 0.005, 24), null, this.alpha(r.color, r.life * 1.6), 2.5);
      for (const p of this.parts) {
        g.globalAlpha = Math.min(1, p.life / (p.max * 0.5)); g.fillStyle = p.color;
        if (p.conf) { g.save(); g.translate(p.x, p.y); g.rotate(p.spin); g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); g.restore(); }
        else g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      g.globalAlpha = 1;
      // lamp vignette
      const vg = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,5,2,0.6)');
      g.fillStyle = vg; g.fillRect(-20, -20, w + 40, h + 40);
      g.restore();
      if (this.persp) this.scoreboard(g, m, o);
    },
    alpha(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`; },
    room(g) {
      const w = this.w, h = this.h;
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#2a170c'); bg.addColorStop(0.55, '#3b2213'); bg.addColorStop(1, '#1a0e07');
      g.fillStyle = bg; g.fillRect(-20, -20, w + 40, h + 40);
      // wood panelling on the back wall
      g.globalAlpha = 0.25;
      const pw = Math.max(50, w / 14);
      for (let x = (this.time * 0) % pw; x < w; x += pw) { g.fillStyle = '#120804'; g.fillRect(x, 0, 2, h * 0.6); g.fillStyle = '#6b4329'; g.fillRect(x + 3, 0, 1, h * 0.6); }
      g.globalAlpha = 1;
      // a chequered parlour floor under the table
      const fy = h * 0.6, fg = g.createLinearGradient(0, fy, 0, h);
      fg.addColorStop(0, '#24140a'); fg.addColorStop(1, '#3a2414');
      g.fillStyle = fg; g.fillRect(-20, fy, w + 40, h - fy + 20);
      // warm lamp glow over the table
      const lx = w / 2, ly = this.boardTop + (this.persp ? 0 : h * 0.3);
      const lg = g.createRadialGradient(lx, ly, 10, lx, ly, Math.max(w, h) * 0.65);
      lg.addColorStop(0, 'rgba(255,196,120,0.35)'); lg.addColorStop(1, 'rgba(255,196,120,0)');
      g.fillStyle = lg; g.fillRect(-20, -20, w + 40, h + 40);
      // the cabinet's shadow on the floor
      const c = this.P(0.5, LEN / 2, -0.32), sc = c[2];
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath(); g.ellipse(c[0], c[1] + sc * 0.12, (this.side ? LEN : 1) * sc * 0.72, (this.side ? 1 : LEN) * sc * 0.42 * c[3], 0, 0, Math.PI * 2); g.fill();
    },
    table(g, m) {
      const E = 0.15;
      // walnut cabinet: top deck and its front face, with a chrome trim
      const a = this.map(-E, -E), b = this.map(1 + E, LEN + E);
      const u0 = Math.min(a[0], b[0]), u1 = Math.max(a[0], b[0]), v1 = Math.max(a[1], b[1]);
      const ft = this.uv(u0, v1, 0), fb = this.uv(u0, v1, -0.3), front = g.createLinearGradient(0, ft[1], 0, fb[1]);
      front.addColorStop(0, '#7a4e2f'); front.addColorStop(0.5, '#5a3820'); front.addColorStop(1, '#2e1b0e');
      this.box(g, -E, -E, 1 + E, LEN + E, -0.3, 0, '#6a4429', front);
      this.poly(g, [this.uv(u0, v1, 0), this.uv(u1, v1, 0), this.uv(u1, v1, -0.03), this.uv(u0, v1, -0.03)], '#c9ced6');
      this.poly(g, [this.uv(u0, v1, -0.24), this.uv(u1, v1, -0.24), this.uv(u1, v1, -0.26), this.uv(u0, v1, -0.26)], '#8b9099');
      // wood grain on the front panel
      g.globalAlpha = 0.18;
      for (let i = 1; i < 9; i++) { const f = u0 + ((u1 - u0) * i) / 9; this.poly(g, [this.uv(f, v1, -0.04), this.uv(f + 0.004, v1, -0.04), this.uv(f + 0.004, v1, -0.23), this.uv(f, v1, -0.23)], '#120804'); }
      g.globalAlpha = 1;
      // the playing surface, lit warm in the middle
      const corners = [this.P(0, 0), this.P(1, 0), this.P(1, LEN), this.P(0, LEN)];
      const mid = this.P(0.5, LEN / 2), far = this.P(0, 0);
      const sg = g.createRadialGradient(mid[0], mid[1], 0, mid[0], mid[1], Math.hypot(far[0] - mid[0], far[1] - mid[1]) * 1.1);
      sg.addColorStop(0, '#f6fbfc'); sg.addColorStop(0.7, '#d7e9ef'); sg.addColorStop(1, '#b6cfd8');
      this.poly(g, corners, sg);
      // a faint red and blue wash for each half
      this.poly(g, [this.P(0, LEN / 2), this.P(1, LEN / 2), this.P(1, LEN), this.P(0, LEN)], 'rgba(232,65,44,0.06)');
      this.poly(g, [this.P(0, 0), this.P(1, 0), this.P(1, LEN / 2), this.P(0, LEN / 2)], 'rgba(44,123,229,0.06)');
      // air holes
      g.fillStyle = 'rgba(40,70,90,0.28)';
      for (let i = 1; i < 14; i++) for (let j = 1; j < 23; j++) {
        const p = this.P(i / 14, (j / 23) * LEN), r = Math.max(0.6, p[2] * 0.0042);
        g.fillRect(p[0] - r, p[1] - r * p[3], r * 2, r * 2 * p[3]);
      }
    },
    marks(g, m, o) {
      const line = (pts, col, lw) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.strokeStyle = col; g.lineWidth = lw; g.stroke(); };
      const s = this.P(0.5, LEN / 2)[2], lw = Math.max(1.5, s * 0.008);
      line([this.P(0, LEN / 2), this.P(1, LEN / 2)], 'rgba(200,40,30,0.7)', lw * 1.4);
      const cc = this.circle(0.5, LEN / 2, 0.16); cc.push(cc[0]); line(cc, 'rgba(200,40,30,0.55)', lw);
      for (const [p, y] of [[0, LEN], [1, 0]]) {
        const pts = [];
        for (let i = 0; i <= 20; i++) { const a = Math.PI * (i / 20); pts.push(this.P(0.5 + Math.cos(a) * 0.24, y + (p === 0 ? -1 : 1) * Math.sin(a) * 0.24)); }
        line(pts, this.alpha(COL[p], 0.55), lw);
        line([this.P(0, y + (p === 0 ? -0.42 : 0.42)), this.P(1, y + (p === 0 ? -0.42 : 0.42))], this.alpha(COL[p], 0.3), lw * 0.8);
      }
      // with two players, each one's score glows under the surface, facing them
      if (!this.persp && m) for (let p = 0; p < 2; p++) {
        const c = this.P(0.5, p === 0 ? LEN * 0.72 : LEN * 0.28), size = c[2] * 0.2;
        let rot = p === 0 ? 0 : Math.PI;
        if (this.side) rot = p === 0 ? Math.PI / 2 : -Math.PI / 2;
        const hot = m.score[p] === m.win - 1;
        g.save(); g.translate(c[0], c[1]); g.rotate(rot);
        g.globalAlpha = 0.22 + (hot ? 0.12 * Math.sin(this.time * 6) + 0.1 : 0) + this.flash[p] * 0.5;
        this.digits(g, String(m.score[p]), 0, 0, size, COL[p], false);
        g.globalAlpha = 0.5;
        g.font = `400 ${Math.round(size * 0.22)}px 'Fugaz One', sans-serif`; g.textAlign = 'center'; g.fillStyle = DARK[p];
        g.fillText(hot ? 'MATCH POINT' : `FIRST TO ${m.win}`, 0, size * 0.85);
        g.restore();
      }
      g.globalAlpha = 1;
    },
    goals(g, m) {
      for (const p of [0, 1]) {
        const y = p === 0 ? LEN : 0, d = p === 0 ? 1 : -1, gw = m ? R.goalW(m, p) : R.GOAL;
        // the slot: a dark mouth with an LED strip glowing in its owner's colour
        this.poly(g, [this.P(0.5 - gw / 2, y), this.P(0.5 + gw / 2, y), this.P(0.5 + gw / 2, y + d * 0.09), this.P(0.5 - gw / 2, y + d * 0.09)], '#0c0604');
        const f = this.flash[1 - p];
        this.poly(g, [this.P(0.5 - gw / 2, y + d * 0.07), this.P(0.5 + gw / 2, y + d * 0.07), this.P(0.5 + gw / 2, y + d * 0.085), this.P(0.5 - gw / 2, y + d * 0.085)], this.alpha(COL[p], 0.5 + f * 0.5 + 0.15 * Math.sin(this.time * 3)));
        if (f > 0) this.poly(g, [this.P(0.5 - gw / 2 - 0.1, y), this.P(0.5 + gw / 2 + 0.1, y), this.P(0.5 + gw / 2, y - d * 0.3), this.P(0.5 - gw / 2, y - d * 0.3)], this.alpha(COL[1 - p], f * 0.35));
      }
    },
    rails(g, m) {
      const T = 0.09, H = 0.045, segs = [];
      segs.push([-T, -T, 0, LEN + T, 'side'], [1, -T, 1 + T, LEN + T, 'side']);
      for (const p of [0, 1]) {
        const y0 = p === 0 ? LEN : -T, y1 = p === 0 ? LEN + T : 0, gw = m ? R.goalW(m, p) : R.GOAL, shut = gw < R.GOAL;
        segs.push([0, y0, 0.5 - R.GOAL / 2, y1, 'end'], [0.5 + R.GOAL / 2, y0, 1, y1, 'end']);
        if (shut) segs.push([0.5 - R.GOAL / 2, y0, 0.5 - gw / 2, y1, 'shut'], [0.5 + gw / 2, y0, 0.5 + R.GOAL / 2, y1, 'shut']);
      }
      // draw far rails first so near ones overlap them
      segs.sort((a, b) => Math.max(this.map(a[0], a[1])[1], this.map(a[2], a[3])[1]) - Math.max(this.map(b[0], b[1])[1], this.map(b[2], b[3])[1]));
      for (const s of segs) {
        const shut = s[4] === 'shut';
        this.box(g, s[0], s[1], s[2], s[3], 0, H, shut ? '#4fd1bf' : '#e3e7ec', shut ? '#1a8a7c' : '#8d939c');
      }
      // walnut cap strip along each side rail
      for (const x of [-T, 1]) this.box(g, x + 0.02, -T + 0.02, x + T - 0.02, LEN + T - 0.02, H, H + 0.004, '#7a4e2f');
    },
    things(g, m) {
      if (!m) return;
      const list = [];
      m.mallets.forEach((k, p) => list.push({ kind: 'mallet', x: k.x, y: k.y, p }));
      m.pucks.forEach((q) => list.push({ kind: 'puck', x: q.x, y: q.y, q }));
      if (m.token) list.push({ kind: 'token', x: m.token.x, y: m.token.y, t: m.token });
      // shadows, thrown away from the lamp over the middle of the table
      for (const it of list) {
        const r = it.kind === 'mallet' ? R.MR : it.kind === 'puck' ? R.puckR(m) : 0.05;
        const sx = it.x + (it.x - 0.5) * 0.06 + 0.012, sy = it.y + (it.y - LEN / 2) * 0.05 + 0.012;
        const p = this.P(sx, sy);
        g.fillStyle = it.kind === 'token' ? 'rgba(0,0,0,0.12)' : 'rgba(20,30,40,0.28)';
        g.beginPath(); g.ellipse(p[0], p[1], r * p[2] * 1.05, r * p[2] * p[3] * 1.05, 0, 0, Math.PI * 2); g.fill();
      }
      // puck trails
      for (const q of m.pucks) {
        const sp = Math.hypot(q.vx, q.vy); if (sp < 0.6 || q.trail.length < 2) continue;
        const col = q.last >= 0 ? LITE[q.last] : '#ffffff';
        for (let i = 1; i < q.trail.length; i++) {
          const a = this.P(q.trail[i - 1][0], q.trail[i - 1][1], 0.008), b = this.P(q.trail[i][0], q.trail[i][1], 0.008);
          g.strokeStyle = this.alpha(col, (i / q.trail.length) * Math.min(0.7, sp / 4));
          g.lineWidth = R.puckR(m) * b[2] * 1.6 * (i / q.trail.length); g.lineCap = 'round';
          g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        }
      }
      list.sort((a, b) => this.map(a.x, a.y)[1] - this.map(b.x, b.y)[1]);
      for (const it of list) {
        if (it.kind === 'mallet') this.mallet(g, it.x, it.y, it.p);
        else if (it.kind === 'puck') this.puck(g, it.q, R.puckR(m));
        else this.token(g, it.t);
      }
    },
    cylinder(g, x, y, r, h0, h1, side, top, edge) {
      const b = this.P(x, y, h0), t = this.P(x, y, h1), rx = r * b[2], ry = rx * b[3];
      const sg = g.createLinearGradient(b[0] - rx, 0, b[0] + rx, 0);
      sg.addColorStop(0, side[0]); sg.addColorStop(0.45, side[1]); sg.addColorStop(1, side[2]);
      g.fillStyle = sg;
      g.beginPath(); g.ellipse(b[0], b[1], rx, ry, 0, 0, Math.PI); g.lineTo(t[0] - rx, t[1]); g.ellipse(t[0], t[1], rx, ry, 0, Math.PI, 0, true); g.closePath(); g.fill();
      g.fillStyle = top; g.beginPath(); g.ellipse(t[0], t[1], rx, ry, 0, 0, Math.PI * 2); g.fill();
      if (edge) { g.strokeStyle = edge; g.lineWidth = Math.max(1, rx * 0.12); g.stroke(); }
      return [t, rx, ry];
    },
    mallet(g, x, y, p) {
      const r = R.MR;
      const [t, rx, ry] = this.cylinder(g, x, y, r, 0, 0.022, [DARK[p], COL[p], DARK[p]], COL[p], LITE[p]);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = Math.max(1, rx * 0.05);
      g.beginPath(); g.ellipse(t[0], t[1], rx * 0.62, ry * 0.62, 0, 0, Math.PI * 2); g.stroke();
      const [kt, krx, kry] = this.cylinder(g, x, y, r * 0.42, 0.022, 0.075, [DARK[p], LITE[p], DARK[p]], COL[p]);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.ellipse(kt[0] - krx * 0.3, kt[1] - kry * 0.3, krx * 0.35, kry * 0.25, -0.5, 0, Math.PI * 2); g.fill();
    },
    puck(g, q, r) {
      const sp = Math.hypot(q.vx, q.vy), edge = q.last >= 0 ? LITE[q.last] : '#ffffff';
      if (sp > 2.2) { const p = this.P(q.x, q.y, 0.01); g.fillStyle = this.alpha(edge, 0.25); g.beginPath(); g.ellipse(p[0], p[1], r * p[2] * 1.9, r * p[2] * p[3] * 1.9, 0, 0, Math.PI * 2); g.fill(); }
      const [t, rx, ry] = this.cylinder(g, q.x, q.y, r, 0, 0.018, ['#1a1a1a', '#3d3d3d', '#111'], '#262626', edge);
      g.fillStyle = '#ffd27a'; g.beginPath(); g.ellipse(t[0], t[1], rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(t[0] - rx * 0.35, t[1] - ry * 0.4, rx * 0.3, ry * 0.18, -0.4, 0, Math.PI * 2); g.fill();
    },
    token(g, tk) {
      const hh = 0.05 + Math.sin(this.time * 3) * 0.012, p = this.P(tk.x, tk.y, hh), r = 0.05 * p[2], spin = Math.cos(this.time * 3.2);
      const col = TOKEN_COL[tk.type];
      g.fillStyle = this.alpha(col, 0.25); g.beginPath(); g.arc(p[0], p[1], r * 1.8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fbf0d9'; g.beginPath(); g.ellipse(p[0], p[1], Math.max(2, r * Math.abs(spin)) + 2, r + 2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = col; g.beginPath(); g.ellipse(p[0], p[1], Math.max(1, r * Math.abs(spin)), r, 0, 0, Math.PI * 2); g.fill();
      if (Math.abs(spin) > 0.35) { g.save(); g.translate(p[0], p[1]); g.scale(Math.abs(spin), 1); g.fillStyle = '#fff'; g.font = `400 ${Math.round(r * 1.2)}px 'Fugaz One', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(TOKEN_TXT[tk.type], 0, 1); g.restore(); }
    },

    // seven-segment LED digits
    digits(g, str, x, y, size, color, glow) {
      const w = size * 0.55, th = size * 0.1, gap = size * 0.18;
      const total = str.length * w + (str.length - 1) * gap;
      let ox = x - total / 2;
      for (const ch of str) {
        const on = SEG[ch] || '';
        const segs = { a: [0, 0, 1, 0], b: [1, 0, 1, 0.5], c: [1, 0.5, 1, 1], d: [0, 1, 1, 1], e: [0, 0.5, 0, 1], f: [0, 0, 0, 0.5], g: [0, 0.5, 1, 0.5] };
        for (const [k, s] of Object.entries(segs)) {
          const lit = on.includes(k);
          if (!lit && !glow) continue;
          const x0 = ox + s[0] * w, y0 = y - size / 2 + s[1] * size, x1 = ox + s[2] * w, y1 = y - size / 2 + s[3] * size;
          g.fillStyle = lit ? color : 'rgba(255,59,47,0.08)';
          if (glow && lit) { g.shadowColor = color; g.shadowBlur = size * 0.25; }
          const horiz = y0 === y1, p = th / 2;
          g.beginPath();
          if (horiz) { g.moveTo(x0 + p, y0); g.lineTo(x0 + p * 2, y0 - p); g.lineTo(x1 - p * 2, y0 - p); g.lineTo(x1 - p, y0); g.lineTo(x1 - p * 2, y0 + p); g.lineTo(x0 + p * 2, y0 + p); }
          else { g.moveTo(x0, y0 + p); g.lineTo(x0 + p, y0 + p * 2); g.lineTo(x0 + p, y1 - p * 2); g.lineTo(x0, y1 - p); g.lineTo(x0 - p, y1 - p * 2); g.lineTo(x0 - p, y0 + p * 2); }
          g.closePath(); g.fill();
          g.shadowBlur = 0;
        }
        ox += w + gap;
      }
    },
    // the scoreboard hanging over the far end of the table
    scoreboard(g, m, o) {
      if (!m) return;
      const w = this.w, bw = Math.min(w * 0.86, 440), bh = Math.min(64, Math.max(48, this.boardTop * 0.6)), x = w / 2, y = Math.max(bh / 2 + 8, this.boardTop - bh * 0.75);
      g.fillStyle = '#d9dde3'; g.fillRect(x - bw * 0.3, y - bh / 2 - 20, 3, 20); g.fillRect(x + bw * 0.3, y - bh / 2 - 20, 3, 20);
      const rr = 10;
      g.fillStyle = '#5a3a24'; this.rrect(g, x - bw / 2 - 5, y - bh / 2 - 5, bw + 10, bh + 10, rr + 4); g.fill();
      g.fillStyle = '#120806'; this.rrect(g, x - bw / 2, y - bh / 2, bw, bh, rr); g.fill();
      const ds = bh * 0.6;
      for (const p of [0, 1]) {
        const px = x + (p === 0 ? -1 : 1) * bw * 0.36;
        this.digits(g, String(m.score[p]).padStart(2, '0'), px, y, ds, p === 1 ? '#4f9bff' : '#ff3b2f', true);
        if (this.flash[p] > 0) { g.fillStyle = this.alpha(COL[p], this.flash[p] * 0.4); g.fillRect(px - ds, y - bh / 2 + 3, ds * 2, bh - 6); }
      }
      g.font = `600 ${Math.round(bh * 0.2)}px 'Barlow Semi Condensed', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#e7b56b';
      g.fillText(o && o.labels ? o.labels[0] : 'YOU', x - bw * 0.36, y + bh * 0.62);
      g.fillText(o && o.labels ? o.labels[1] : 'HOUSE', x + bw * 0.36, y + bh * 0.62);
      g.fillStyle = '#ff3b2f'; g.font = `400 ${Math.round(bh * 0.24)}px 'Fugaz One', sans-serif`;
      const hot = m.score[0] === m.win - 1 || m.score[1] === m.win - 1;
      g.globalAlpha = hot ? 0.6 + 0.4 * Math.sin(this.time * 6) : 0.85;
      g.fillText(m.win > 50 ? 'DEMO' : hot ? 'MATCH PT' : `TO ${m.win}`, x, y);
      g.globalAlpha = 1;
    },
    rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); },

    // big words: in a player's half facing them with two players, centred otherwise
    banner(g, text, color, p, age, sub) {
      const pop = Math.min(1, age * 5), sc = this.reduced ? 1 : 0.6 + 0.4 * (1 - Math.pow(1 - pop, 3)) + (pop >= 1 ? 0 : 0.15 * Math.sin(pop * Math.PI));
      let x = this.w / 2, y = this.h * 0.45, rot = 0;
      if (!this.persp && p !== null && p !== undefined) {
        const c = this.P(0.5, p === 0 ? LEN * 0.75 : LEN * 0.25); x = c[0]; y = c[1];
        rot = this.side ? (p === 0 ? Math.PI / 2 : -Math.PI / 2) : p === 0 ? 0 : Math.PI;
      }
      const size = Math.min(this.w, this.h) * 0.14;
      g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc);
      g.font = `400 ${Math.round(size)}px 'Fugaz One', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = '#1c110a'; g.strokeText(text, 0, 0);
      g.fillStyle = color; g.fillText(text, 0, 0);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillText(text, -size * 0.03, -size * 0.04);
      g.fillStyle = color; g.fillText(text, 0, 0);
      if (sub) { g.font = `700 ${Math.round(size * 0.28)}px 'Barlow Semi Condensed', sans-serif`; g.lineWidth = size * 0.07; g.strokeText(sub, 0, size * 0.62); g.fillStyle = '#fbf0d9'; g.fillText(sub, 0, size * 0.62); }
      g.restore();
    },
  };
  V.COL = COL;
  PS.View = V;
})();
