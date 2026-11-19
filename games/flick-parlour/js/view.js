// Flick Parlour view: a corner table in a late-night café, string lights
// overhead. The board is polished plywood in a thick dark frame with net
// pockets; coins are short turned-wood cylinders and the striker is a heavy
// ivory disc. The aim guide shows where the striker will first touch.
(function () {
  const R = FP.Rules;
  const V = {
    W: 1, H: 1, S: 1, cx: 0, cy: 0, w: 1, h: 1, t: 0.25, c: 0.82, hk: 0.95, time: 0, reduced: false,
    aim: null, ghost: null, parts: [], sinking: [], lights: null, flip: false, shake: 0,
    layout(W, H, top, bottom) {
      this.W = W; this.H = H; this.S = 1; this.cx = 0; this.cy = 0;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [u, v] of [[-0.1, -0.1], [1.1, -0.1], [-0.1, 1.1], [1.1, 1.1]]) for (const hh of [0, -0.06]) {
        const p = this.P(u, v, hh); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
      const aw = W - 20, ah = H - top - bottom;
      this.S = Math.min(aw / (x1 - x0), ah / (y1 - y0));
      this.cx = W / 2 - ((x0 + x1) / 2) * this.S;
      this.cy = top + ah / 2 - ((y0 + y1) / 2) * this.S;
      this.lights = null;
    },
    k(v) { return 1 / (1 + (this.h - v) * this.t); },
    // the board can be shown from the far side when it's the top player's turn in a two-player game
    P(u, v, hh = 0) { if (this.flip) { u = 1 - u; v = 1 - v; } const k = this.k(v); return [this.cx + (u - this.w / 2) * this.S * k, this.cy + ((v - this.h / 2) * this.c - hh * this.hk) * this.S * k, this.S * k]; },
    unproject(sx, sy) {
      const a = (sx - this.cx) / this.S, b = (sy - this.cy) / this.S, D = this.h, t = this.t, c = this.c;
      const v = (b + b * D * t + (D * c) / 2) / (c + b * t);
      const u = a * (1 + (D - v) * t) + this.w / 2;
      return this.flip ? [1 - u, 1 - v] : [u, v];
    },
    poly(g, pts, fill, stroke, lw) {
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
    },
    quad(x0, y0, x1, y1, hh = 0) { return [this.P(x0, y0, hh), this.P(x1, y0, hh), this.P(x1, y1, hh), this.P(x0, y1, hh)]; },
    ellipse(u, v, r, hh) { const pts = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; pts.push(this.P(u + Math.cos(a) * r, v + Math.sin(a) * r, hh)); } return pts; },

    // ---------- the café ----------
    room(g) {
      const { W, H } = this;
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#13262b'); gr.addColorStop(1, '#0a1416');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // tiled floor fading into the dark
      g.strokeStyle = 'rgba(120,200,190,0.05)'; g.lineWidth = 1;
      for (let x = -W; x < W * 2; x += 60) { g.beginPath(); g.moveTo(W / 2 + (x - W / 2) * 0.3, H * 0.35); g.lineTo(x, H); g.stroke(); }
      // string lights swagging across the top
      if (!this.lights) { this.lights = []; for (let s = 0; s < 2; s++) for (let i = 0; i <= 14; i++) { const f = i / 14; this.lights.push({ x: f * W, y: 18 + s * 30 + Math.sin(f * Math.PI) * (40 + s * 20), c: ['#ffd27a', '#ff8fa3', '#9fe6d6', '#ffd27a'][(i + s) % 4], ph: i * 1.7 + s }); } }
      g.strokeStyle = 'rgba(30,20,10,0.8)'; g.lineWidth = 1.5;
      for (let s = 0; s < 2; s++) { g.beginPath(); this.lights.slice(s * 15, s * 15 + 15).forEach((l, i) => (i ? g.lineTo(l.x, l.y - 4) : g.moveTo(l.x, l.y - 4))); g.stroke(); }
      for (const l of this.lights) {
        const f = this.reduced ? 1 : 0.75 + 0.25 * Math.sin(this.time * 2 + l.ph);
        const glow = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, 26);
        glow.addColorStop(0, l.c); glow.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = 0.35 * f; g.fillStyle = glow; g.fillRect(l.x - 26, l.y - 26, 52, 52);
        g.globalAlpha = 1; g.fillStyle = l.c; g.beginPath(); g.ellipse(l.x, l.y, 4, 6, 0, 0, Math.PI * 2); g.fill();
      }
      // a warm pool of lamplight on the table
      const c = this.P(0.5, 0.5, 0);
      const lamp = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], this.S * 0.95);
      lamp.addColorStop(0, 'rgba(255,200,130,0.22)'); lamp.addColorStop(1, 'rgba(255,200,130,0)');
      g.fillStyle = lamp; g.fillRect(0, 0, W, H);
    },
    board(g) {
      const F = 0.085; // frame width
      // table shadow and the frame's front edge
      this.poly(g, this.quad(-F - 0.03, -F - 0.03, 1 + F + 0.03, 1 + F + 0.03, -0.06).map(([x, y]) => [x + 10, y + 16]), 'rgba(0,0,0,0.45)');
      const near = this.flip ? -F : 1 + F;
      this.poly(g, [this.P(-F, near, 0), this.P(1 + F, near, 0), this.P(1 + F, near, -0.05), this.P(-F, near, -0.05)], '#1d0f08');
      this.poly(g, this.quad(-F, -F, 1 + F, 1 + F, 0), '#3b1f10');
      this.poly(g, this.quad(-F + 0.012, -F + 0.012, 1 + F - 0.012, 1 + F - 0.012, 0.001), null, 'rgba(255,190,120,0.25)', 1.5);
      // the playing surface
      const c = this.P(0.5, 0.5, 0);
      const ply = g.createRadialGradient(c[0], c[1], 0, c[0], c[1], this.S * 0.8);
      ply.addColorStop(0, '#f2d7a2'); ply.addColorStop(1, '#d9b277');
      this.poly(g, this.quad(0, 0, 1, 1, 0.002), ply);
      g.strokeStyle = 'rgba(150,100,40,0.12)'; g.lineWidth = 1;
      for (let i = 1; i < 26; i++) { const a = this.P(i / 26, 0, 0.002), b = this.P(i / 26 + 0.01, 1, 0.002); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      // markings: four double baselines with red end circles
      const ink = '#2a1608';
      for (const side of [0, 1, 2, 3]) {
        const line = (t) => { const pts = side === 0 ? [[0.24, 0.855 + t], [0.76, 0.855 + t]] : side === 1 ? [[0.24, 0.145 - t], [0.76, 0.145 - t]] : side === 2 ? [[0.145 - t, 0.24], [0.145 - t, 0.76]] : [[0.855 + t, 0.24], [0.855 + t, 0.76]]; return pts.map(([u, v]) => this.P(u, v, 0.003)); };
        for (const t of [-0.018, 0.018]) { const [a, b] = line(t); g.strokeStyle = ink; g.lineWidth = 1.4; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
        const ends = side < 2 ? [[0.24, side === 0 ? 0.855 : 0.145], [0.76, side === 0 ? 0.855 : 0.145]] : [[side === 2 ? 0.145 : 0.855, 0.24], [side === 2 ? 0.145 : 0.855, 0.76]];
        for (const [u, v] of ends) { this.poly(g, this.ellipse(u, v, 0.019, 0.003), '#c0392b', ink, 1.2); }
      }
      // corner arrows pointing at the pockets
      for (const [u, v] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
        const du = u < 0.5 ? -1 : 1, dv = v < 0.5 ? -1 : 1;
        const a = this.P(u, v, 0.003), b = this.P(u + du * 0.11, v + dv * 0.11, 0.003);
        g.strokeStyle = ink; g.lineWidth = 1.4; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        this.poly(g, this.ellipse(u, v, 0.012, 0.003), null, ink, 1.2);
      }
      // the centre rose
      this.poly(g, this.ellipse(0.5, 0.5, 0.115, 0.003), null, ink, 1.4);
      this.poly(g, this.ellipse(0.5, 0.5, 0.025, 0.003), '#c0392b', ink, 1);
      g.fillStyle = 'rgba(42,22,8,0.18)';
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, b = a + 0.25, c2 = a - 0.25; this.poly(g, [this.P(0.5, 0.5, 0.003), this.P(0.5 + Math.cos(b) * 0.06, 0.5 + Math.sin(b) * 0.06, 0.003), this.P(0.5 + Math.cos(a) * 0.11, 0.5 + Math.sin(a) * 0.11, 0.003), this.P(0.5 + Math.cos(c2) * 0.06, 0.5 + Math.sin(c2) * 0.06, 0.003)], 'rgba(42,22,8,0.16)'); }
      // pockets with a hint of net
      for (const [u, v] of R.POCKETS) {
        this.poly(g, this.ellipse(u, v, R.POCKET * 1.05, 0.004), '#120804');
        this.poly(g, this.ellipse(u, v, R.POCKET * 0.7, 0.004), null, 'rgba(255,255,255,0.08)', 1);
      }
    },
    disc(g, b, hh = 0) {
      const top = this.P(b.x, b.y, 0.012 + hh), base = this.P(b.x, b.y, hh), rx = b.r * this.S * this.k(b.y), ry = rx * this.c;
      const col = b.kind === 'white' ? ['#f3ead6', '#c9b896', '#b39b6f'] : b.kind === 'black' ? ['#3a2a22', '#1a110c', '#5a463a'] : b.kind === 'queen' ? ['#d63a3a', '#8e1d1d', '#ff8a7a'] : ['#fbf8ef', '#c8c2b0', '#9fd3e6'];
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(base[0] + rx * 0.2, base[1] + ry * 0.35, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2); g.fill();
      // side band
      g.fillStyle = col[1]; g.beginPath(); g.ellipse(base[0], base[1], rx, ry, 0, 0, Math.PI); g.lineTo(top[0] - rx, top[1]); g.ellipse(top[0], top[1], rx, ry, 0, Math.PI, 0, true); g.closePath(); g.fill();
      // face with turned rings
      const gr = g.createRadialGradient(top[0] - rx * 0.3, top[1] - ry * 0.4, 0, top[0], top[1], rx);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, col[0]); gr.addColorStop(1, col[1]);
      g.fillStyle = gr; g.beginPath(); g.ellipse(top[0], top[1], rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = col[2]; g.lineWidth = Math.max(1, rx * 0.12);
      g.beginPath(); g.ellipse(top[0], top[1], rx * 0.62, ry * 0.62, 0, 0, Math.PI * 2); g.stroke();
      if (b.kind === 'striker') { g.beginPath(); g.ellipse(top[0], top[1], rx * 0.3, ry * 0.3, 0, 0, Math.PI * 2); g.stroke(); }
    },
    // the aim guide: a dotted path to the first thing the striker would touch
    drawAim(g, s) {
      if (!this.aim) return;
      const st = s.striker, { angle, power } = this.aim;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      let best = 1.6, hit = null;
      for (const c of s.coins) {
        if (c.in) continue;
        const fx = c.x - st.x, fy = c.y - st.y, along = fx * dx + fy * dy; if (along <= 0) continue;
        const perp = Math.abs(fx * dy - fy * dx), rr = c.r + st.r; if (perp > rr) continue;
        const t = along - Math.sqrt(rr * rr - perp * perp); if (t < best) { best = t; hit = c; }
      }
      // stop at the cushion if nothing is in the way
      for (const [lim, d, p] of [[st.r, dx, st.x], [1 - st.r, dx, st.x], [st.r, dy, st.y], [1 - st.r, dy, st.y]]) { if (d !== 0) { const t = (lim - p) / d; if (t > 0.001 && t < best && !hit) best = t; } }
      if (this.aim.bare) { best = Math.min(best, 0.15); hit = null; }
      const ex = st.x + dx * best, ey = st.y + dy * best;
      g.save(); g.setLineDash([6, 6]); g.lineDashOffset = -this.time * 30;
      const a = this.P(st.x, st.y, 0.012), b = this.P(ex, ey, 0.012);
      g.strokeStyle = `rgba(255,255,255,${0.5 + power * 0.4})`; g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      g.restore();
      if (hit) {
        this.poly(g, this.ellipse(ex, ey, st.r, 0.01), null, 'rgba(255,255,255,0.6)', 1.5);
        // where the struck coin heads
        const nx = hit.x - ex, ny = hit.y - ey, nl = Math.hypot(nx, ny), c0 = this.P(hit.x, hit.y, 0.012), c1 = this.P(hit.x + (nx / nl) * 0.18, hit.y + (ny / nl) * 0.18, 0.012);
        g.strokeStyle = 'rgba(159,230,214,0.85)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(c0[0], c0[1]); g.lineTo(c1[0], c1[1]); g.stroke();
      }
    },
    burst(x, y, col, n) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 120; this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, max: 0.5 + Math.random() * 0.4, col, r: 1.5 + Math.random() * 2.5 }); } },
    sink(b) { this.sinking.push({ b: { ...b }, t: 0 }); const p = this.P(b.px, b.py, 0); this.burst(p[0], p[1], b.kind === 'queen' ? '#ff8a7a' : '#ffd27a', this.reduced ? 4 : 12); },
    tick(dt) {
      this.time += dt;
      for (const p of this.parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 250 * dt; }
      this.parts = this.parts.filter((p) => p.life < p.max);
      for (const s of this.sinking) s.t += dt;
      this.sinking = this.sinking.filter((s) => s.t < 0.35);
      this.shake = Math.max(0, this.shake - dt * 3);
    },
    draw(g, s) {
      g.save();
      if (this.shake && !this.reduced) g.translate((Math.random() - 0.5) * this.shake * 6, (Math.random() - 0.5) * this.shake * 3);
      this.room(g);
      this.board(g);
      if (s) {
        // coins dropping into pockets shrink away
        for (const k of this.sinking) { const f = 1 - k.t / 0.35; this.disc(g, Object.assign({}, k.b, { x: k.b.px + (k.b.x - k.b.px) * f, y: k.b.py + (k.b.y - k.b.py) * f, r: k.b.r * f }), -0.03 * (1 - f)); }
        const list = s.coins.filter((c) => !c.in).concat(s.striker.in ? [] : [s.striker]);
        list.sort((a, b) => (this.flip ? b.y - a.y : a.y - b.y));
        if (s.phase === 'aim') this.drawAim(g, s);
        for (const b of list) this.disc(g, b);
        if (s.phase === 'aim' && this.placing) { const p = this.P(s.striker.x, s.striker.y, 0.013); g.strokeStyle = `rgba(159,230,214,${0.5 + 0.4 * Math.sin(this.time * 6)})`; g.lineWidth = 2; g.beginPath(); g.ellipse(p[0], p[1], s.striker.r * this.S * 1.6, s.striker.r * this.S * 1.6 * this.c, 0, 0, Math.PI * 2); g.stroke(); }
      }
      for (const p of this.parts) { g.globalAlpha = 1 - p.life / p.max; g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
      g.restore();
    },
  };
  FP.View = V;
})();
