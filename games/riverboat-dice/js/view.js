// Riverboat Dice view: the gaming saloon of a paddle steamer at dusk.
// Mahogany walls, portholes with the sunset river sliding past, brass lamps,
// and a green baize table seen at a slant. Dice are real 3D bone cubes that
// tumble out of the cup, bounce and settle on the face the rules rolled.
// Shut the Box gets a hinged wooden box; Bluff gets a leather cup per seat.
(function () {
  const R = RD.Rules;
  const V = {
    W: 1, H: 1, S: 1, cx: 0, cy: 0, w: 16, h: 10, t: 0.035, c: 0.62, hk: 0.95, time: 0, reduced: false,
    dice: [], parts: [], cups: [], box: null, shake: 0, seats: 2, glowSeat: -1,
    layout(W, H, top, bottom, right = 0) {
      this.W = W; this.H = H; this.S = 1; this.cx = 0; this.cy = 0;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [u, v] of [[-0.8, -0.8], [this.w + 0.8, -0.8], [-0.8, this.h + 0.8], [this.w + 0.8, this.h + 0.8]]) for (const hh of [0, -0.5]) {
        const p = this.P(u, v, hh); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
      const aw = W - 16 - right, ah = H - top - bottom;
      this.S = Math.min(aw / (x1 - x0), ah / (y1 - y0));
      this.cx = (W - right) / 2 - ((x0 + x1) / 2) * this.S;
      this.cy = top + ah / 2 - ((y0 + y1) / 2) * this.S;
      this.wall = null;
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

    // ---------- dice ----------
    // Throw dice: each one flies from `from` (felt coords) to a resting spot
    // and lands showing its value. spots: [[u, v], ...]
    throw(values, spots, from, opts = {}) {
      const keep = this.dice.filter((d) => opts.keep && opts.keep(d));
      this.dice = keep;
      values.forEach((v, i) => {
        const [tu, tv] = spots[i], f = this.faceUp(v);
        const d = { value: v, u: from[0], v: from[1], fu: from[0] + (Math.random() - 0.5), fv: from[1] + (Math.random() - 0.5), tu, tv, t: 0, dur: (this.reduced ? 0.01 : 0.75 + Math.random() * 0.35), rx: f.rx, ry: f.ry, rz: f.rz + (Math.random() - 0.5) * 0.6, spin: [6 + Math.random() * 8, 6 + Math.random() * 8, Math.random() * 4], h: 0, id: opts.ids ? opts.ids[i] : i, sel: false, held: false, dim: false };
        d.trz = d.rz;
        this.dice.push(d);
      });
    },
    // slide a die to a new resting spot (when held or kept)
    move(d, tu, tv) { if (Math.hypot(d.tu - tu, d.tv - tv) < 0.05) return; d.fu = d.u; d.fv = d.v; d.tu = tu; d.tv = tv; d.t = 0; d.dur = this.reduced ? 0.01 : 0.3; d.slide = true; },
    rolling() { return this.dice.some((d) => d.t < d.dur && !d.slide); },
    faceUp(value) {
      const base = { 1: [0, 0], 6: [0, Math.PI], 2: [Math.PI / 2, 0], 5: [-Math.PI / 2, 0], 3: [0, -Math.PI / 2], 4: [0, Math.PI / 2] }[value];
      return { rx: base[0] - 0.35, ry: base[1] + 0.32, rz: 0 };
    },
    dieAt(px, py) {
      let best = null, bd = 1e9;
      for (const d of this.dice) { const p = this.P(d.u, d.v, d.h + 0.5), r = p[2] * 0.75, dd = Math.hypot(px - p[0], py - p[1]); if (dd < r && dd < bd) { bd = dd; best = d; } }
      return best;
    },
    die(g, x, y, size, d) {
      const R3 = (v) => {
        let [a, b, c] = v;
        const cx = Math.cos(d.rx), sx = Math.sin(d.rx), cy = Math.cos(d.ry), sy = Math.sin(d.ry), cz = Math.cos(d.rz), sz = Math.sin(d.rz);
        [b, c] = [b * cx - c * sx, b * sx + c * cx];
        [a, c] = [a * cy + c * sy, -a * sy + c * cy];
        [a, b] = [a * cz - b * sz, a * sz + b * cz];
        return [a, b, c];
      };
      const proj = ([a, b, c]) => { const k = 3 / (3 - c * 0.6); return [x + a * size * k, y - b * size * k, c]; };
      const faces = [
        { n: [0, 0, 1], v: 1, u: [1, 0, 0], w: [0, 1, 0] }, { n: [0, 0, -1], v: 6, u: [-1, 0, 0], w: [0, 1, 0] },
        { n: [0, 1, 0], v: 2, u: [1, 0, 0], w: [0, 0, -1] }, { n: [0, -1, 0], v: 5, u: [1, 0, 0], w: [0, 0, 1] },
        { n: [1, 0, 0], v: 3, u: [0, 0, -1], w: [0, 1, 0] }, { n: [-1, 0, 0], v: 4, u: [0, 0, 1], w: [0, 1, 0] },
      ];
      const PIPS = { 1: [[0, 0]], 2: [[-1, 1], [1, -1]], 3: [[-1, 1], [0, 0], [1, -1]], 4: [[-1, 1], [1, 1], [-1, -1], [1, -1]], 5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]], 6: [[-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]] };
      const shown = faces.map((f) => ({ f, n: R3(f.n) })).filter((o) => o.n[2] > 0.01).sort((a, b) => a.n[2] - b.n[2]);
      const body = d.dim ? [190, 180, 160] : [246, 238, 220];
      for (const { f, n } of shown) {
        const corner = (a, b) => proj(R3([f.n[0] + f.u[0] * a + f.w[0] * b, f.n[1] + f.u[1] * a + f.w[1] * b, f.n[2] + f.u[2] * a + f.w[2] * b]));
        const lit = 0.66 + 0.34 * n[2];
        // rounded-looking faces: a bevel of the face drawn slightly inset
        this.poly(g, [corner(-1, 1), corner(1, 1), corner(1, -1), corner(-1, -1)], `rgb(${Math.round(body[0] * lit * 0.86)},${Math.round(body[1] * lit * 0.86)},${Math.round(body[2] * lit * 0.86)})`);
        this.poly(g, [corner(-0.86, 0.86), corner(0.86, 0.86), corner(0.86, -0.86), corner(-0.86, -0.86)], `rgb(${Math.round(body[0] * lit)},${Math.round(body[1] * lit)},${Math.round(body[2] * lit)})`);
        g.fillStyle = f.v === 1 || f.v === 4 ? '#a3182c' : '#1d140d';
        for (const [a, b] of PIPS[f.v]) { const c = corner(a * 0.52, b * 0.52), r = size * (f.v === 1 ? 0.26 : 0.14) * Math.sqrt(n[2]); g.beginPath(); g.ellipse(c[0], c[1], r, r, 0, 0, Math.PI * 2); g.fill(); }
      }
    },

    // ---------- shut the box ----------
    // box: { open: mask, sel: mask, flip: [0..1 per tile] }
    boxGeom() { return { u0: 2.2, u1: 13.8, v0: 1.4, v1: 5.0, th: 2.1 }; },
    tileAt(px, py) {
      if (!this.box) return -1;
      const { u0, u1, v0 } = this.boxGeom(), tw = (u1 - u0) / 9;
      for (let i = 0; i < 9; i++) {
        const f = this.box.flip[i]; if (f > 0.5) continue;
        const th = this.boxGeom().th, q = [this.P(u0 + i * tw + 0.05, v0 + 0.3, th + 0.3), this.P(u0 + (i + 1) * tw - 0.05, v0 + 0.3, th + 0.3), this.P(u0 + (i + 1) * tw - 0.05, v0 + 0.3, 0.3), this.P(u0 + i * tw + 0.05, v0 + 0.3, 0.3)];
        const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
        if (px >= Math.min(...xs) && px <= Math.max(...xs) && py >= Math.min(...ys) && py <= Math.max(...ys)) return i;
      }
      return -1;
    },
    drawBox(g) {
      const b = this.box; if (!b) return;
      const { u0, u1, v0, v1, th } = this.boxGeom(), tw = (u1 - u0) / 9;
      // the box's floor and walls
      this.poly(g, this.quad(u0 - 0.3, v0 - 0.2, u1 + 0.3, v1, 0), '#4a2a14');
      this.poly(g, this.quad(u0, v0, u1, v1 - 0.2, 0.02), '#1f5a3a');
      this.poly(g, [this.P(u0 - 0.3, v1, 0), this.P(u1 + 0.3, v1, 0), this.P(u1 + 0.3, v1, 0.5), this.P(u0 - 0.3, v1, 0.5)], '#7a4a24');
      this.poly(g, [this.P(u0 - 0.3, v1, 0.5), this.P(u1 + 0.3, v1, 0.5), this.P(u1 + 0.3, v1 - 0.2, 0.5), this.P(u0 - 0.3, v1 - 0.2, 0.5)], '#a06a38');
      // back rail where the tiles hinge
      this.poly(g, [this.P(u0 - 0.3, v0 - 0.2, 0), this.P(u1 + 0.3, v0 - 0.2, 0), this.P(u1 + 0.3, v0 - 0.2, 0.4), this.P(u0 - 0.3, v0 - 0.2, 0.4)], '#6b3e1c');
      for (let i = 0; i < 9; i++) {
        const f = b.flip[i], sel = b.sel & (1 << i), a = f * Math.PI / 2 * 0.95;
        // a tile stands up from its hinge at the back and falls toward the player
        const hu0 = u0 + i * tw + 0.06, hu1 = u0 + (i + 1) * tw - 0.06, hv = v0 + 0.3;
        const topV = hv + Math.sin(a) * th, topH = 0.3 + Math.cos(a) * th;
        const lift = sel && f < 0.5 ? 0.12 : 0;
        const q = [this.P(hu0, hv, 0.3 + lift), this.P(hu1, hv, 0.3 + lift), this.P(hu1, topV, topH + lift), this.P(hu0, topV, topH + lift)];
        const col = f > 0.5 ? '#c9a46a' : sel ? '#ffe6a3' : '#f2dfb4';
        this.poly(g, q, col, '#5a3418', 1.5);
        const c = this.P((hu0 + hu1) / 2, hv + Math.sin(a) * th * 0.62, 0.3 + Math.cos(a) * th * 0.62 + lift);
        g.fillStyle = f > 0.5 ? 'rgba(90,52,24,0.6)' : '#3a1e0c';
        g.font = `${Math.round(c[2] * 0.62)}px 'Rye', serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.save(); g.translate(c[0], c[1]); g.scale(1, Math.max(0.15, Math.cos(a))); g.fillText(String(i + 1), 0, 0); g.restore();
      }
    },

    // ---------- bluff cups ----------
    seatPos(i, n) {
      // you sit at the front; the others around the far side
      const spots = n === 2 ? [[8, 9.2], [8, 0.8]] : n === 3 ? [[8, 9.2], [1.6, 2.6], [14.4, 2.6]] : [[8, 9.2], [1.4, 4.6], [8, 0.8], [14.6, 4.6]];
      return spots[i];
    },
    cup(g, u, v, lift, col) {
      const p = this.P(u, v, 0), top = this.P(u, v, 1.6 + lift), r = p[2] * 0.95;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(p[0], p[1] + r * 0.1, r * 1.1, r * 0.4, 0, 0, Math.PI * 2); g.fill();
      const by = this.P(u, v, lift)[1];
      const gr = g.createLinearGradient(p[0] - r, 0, p[0] + r, 0);
      gr.addColorStop(0, this.shade(col, 0.6)); gr.addColorStop(0.4, this.shade(col, 1.1)); gr.addColorStop(1, this.shade(col, 0.55));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(p[0] - r, by); g.lineTo(top[0] - r * 0.75, top[1]); g.lineTo(top[0] + r * 0.75, top[1]); g.lineTo(p[0] + r, by); g.ellipse(p[0], by, r, r * 0.35, 0, 0, Math.PI); g.closePath(); g.fill();
      g.fillStyle = this.shade(col, 0.75); g.beginPath(); g.ellipse(top[0], top[1], r * 0.75, r * 0.26, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d4a84a'; g.lineWidth = Math.max(1.5, r * 0.08);
      g.beginPath(); g.ellipse(p[0], by - (by - top[1]) * 0.18, r * 0.96, r * 0.33, 0, 0, Math.PI); g.stroke();
      g.beginPath(); g.ellipse(top[0], top[1] + (by - top[1]) * 0.12, r * 0.78, r * 0.27, 0, 0, Math.PI); g.stroke();
    },

    // ---------- effects ----------
    tick(dt) {
      this.time += dt;
      for (const d of this.dice) {
        if (d.t >= d.dur) { d.u = d.tu; d.v = d.tv; d.h = 0; d.rz = d.trz; continue; }
        d.t += dt;
        const q = Math.min(1, d.t / d.dur);
        if (d.slide) { const e = 1 - Math.pow(1 - q, 3); d.u = d.fu + (d.tu - d.fu) * e; d.v = d.fv + (d.tv - d.fv) * e; d.h = Math.sin(q * Math.PI) * 0.4; if (q >= 1) d.slide = false; continue; }
        const e = 1 - Math.pow(1 - q, 2.2);
        d.u = d.fu + (d.tu - d.fu) * e; d.v = d.fv + (d.tv - d.fv) * e;
        // bounces that get smaller
        d.h = Math.abs(Math.sin(q * Math.PI * 3)) * 1.6 * Math.pow(1 - q, 1.6);
        const spin = Math.pow(1 - q, 2);
        const f = this.faceUp(d.value);
        d.rx = f.rx + d.spin[0] * spin; d.ry = f.ry + d.spin[1] * spin; d.rz = d.trz + d.spin[2] * spin;
        if (q >= 1) { d.rx = f.rx; d.ry = f.ry; d.rz = d.trz; d.h = 0; if (this.onLand) this.onLand(d); }
      }
      for (const p of this.parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
      this.parts = this.parts.filter((p) => p.life < p.max);
      if (this.box) for (let i = 0; i < 9; i++) { const target = this.box.open & (1 << i) ? 0 : 1; this.box.flip[i] += (target - this.box.flip[i]) * Math.min(1, dt * (this.reduced ? 60 : 9)); }
      for (const c of this.cups) c.lift += ((c.up ? 1.6 : 0) - c.lift) * Math.min(1, dt * 8);
      this.shake = Math.max(0, this.shake - dt * 3);
    },
    sparkle(x, y, col, n) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 160; this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 0, max: 0.6 + Math.random() * 0.5, col, r: 2 + Math.random() * 3 }); } },

    // ---------- the saloon ----------
    room(g) {
      const { W, H } = this;
      // mahogany panelling
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#3b1a10'); gr.addColorStop(0.5, '#2a120a'); gr.addColorStop(1, '#1a0b06');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const pw = Math.max(110, W / 7);
      for (let x = (W % pw) / 2 - pw; x < W; x += pw) {
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; g.strokeRect(x + 10, 14, pw - 20, H * 0.5);
        g.strokeStyle = 'rgba(255,190,120,0.07)'; g.lineWidth = 1; g.strokeRect(x + 14, 18, pw - 28, H * 0.5 - 8);
      }
      // portholes with the river at sunset sliding by
      const n = Math.max(2, Math.floor(W / 280));
      for (let i = 0; i < n; i++) {
        const x = (W / n) * (i + 0.5), y = Math.min(90, H * 0.12), r = Math.min(46, W * 0.05);
        g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip();
        const sky = g.createLinearGradient(0, y - r, 0, y + r);
        sky.addColorStop(0, '#f6a35c'); sky.addColorStop(0.5, '#f7c27a'); sky.addColorStop(0.55, '#5a3a4a'); sky.addColorStop(1, '#2d2238');
        g.fillStyle = sky; g.fillRect(x - r, y - r, r * 2, r * 2);
        g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x + r * 0.3, y - r * 0.05, r * 0.22, 0, Math.PI * 2); g.fill();
        // far shore trees drifting past
        g.fillStyle = '#3a2a33';
        const off = (this.time * 12 + i * 70) % 60;
        for (let k = -2; k < 5; k++) { const tx = x - r + k * 30 - off; g.beginPath(); g.ellipse(tx, y + r * 0.08, 14, 9 + (k % 2) * 5, 0, Math.PI, 0); g.fill(); }
        g.strokeStyle = 'rgba(255,220,160,0.4)'; g.lineWidth = 2;
        for (let k = 0; k < 4; k++) { const wy = y + r * (0.3 + k * 0.15), wx = ((this.time * 30 + k * 40) % (r * 2)) + x - r; g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + 14, wy); g.stroke(); }
        g.restore();
        g.strokeStyle = '#c99a3c'; g.lineWidth = 7; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#e8c46a'; for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 2.5, 0, Math.PI * 2); g.fill(); }
      }
      // lamp glow
      const f = 0.9 + 0.1 * Math.sin(this.time * 7) * Math.sin(this.time * 3.1);
      const lg = g.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.6);
      lg.addColorStop(0, `rgba(255,190,110,${0.22 * f})`); lg.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = lg; g.fillRect(0, 0, W, H);
    },
    table(g) {
      const { w, h } = this;
      // the table's wooden apron and brass rail
      this.poly(g, [this.P(-0.8, h + 0.8, 0), this.P(w + 0.8, h + 0.8, 0), this.P(w + 0.8, h + 0.8, -0.5), this.P(-0.8, h + 0.8, -0.5)], '#4a2412');
      this.poly(g, this.quad(-0.8, -0.8, w + 0.8, h + 0.8, 0), '#6b3a1c');
      this.poly(g, this.quad(-0.45, -0.45, w + 0.45, h + 0.45, 0.01), '#c99a3c');
      this.poly(g, this.quad(-0.3, -0.3, w + 0.3, h + 0.3, 0.015), '#8a5a22');
      // baize
      const q = this.quad(0, 0, w, h, 0.02);
      const p0 = this.P(w / 2, h / 2, 0);
      const gr = g.createRadialGradient(p0[0], p0[1], 0, p0[0], p0[1], this.S * w * 0.6);
      gr.addColorStop(0, '#2f7a4a'); gr.addColorStop(1, '#174a2c');
      this.poly(g, q, gr);
      // a painted border line and a riverboat motif in the middle
      this.poly(g, this.quad(0.4, 0.4, w - 0.4, h - 0.4, 0.021), null, 'rgba(230,200,120,0.35)', 1.5);
      const c = this.P(w / 2, h / 2, 0.021);
      g.save(); g.translate(c[0], c[1]); g.scale(1, this.c); g.strokeStyle = 'rgba(230,200,120,0.18)'; g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, c[2] * 2.2, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, c[2] * 1.9, 0, Math.PI * 2); g.stroke();
      g.restore();
    },

    draw(g, st) {
      g.save();
      if (this.shake && !this.reduced) g.translate((Math.random() - 0.5) * this.shake * 8, (Math.random() - 0.5) * this.shake * 4);
      this.room(g);
      this.table(g);
      if (st && st.labels) for (const l of st.labels) { const p = this.P(l.u, l.v, 0.03); g.fillStyle = 'rgba(240,215,150,0.55)'; g.font = `${Math.round(p[2] * 0.42)}px 'Rye', serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(l.text, p[0], p[1]); }
      this.drawBox(g);
      // cups and dice, back to front
      const items = [];
      for (const c of this.cups) items.push({ v: c.v + 0.3, draw: () => this.cup(g, c.u, c.v, c.lift, c.col) });
      for (const d of this.dice) {
        if (d.hidden) continue;
        items.push({ v: d.v, draw: () => {
          const p = this.P(d.u, d.v, d.h + 0.5), s = p[2] * 0.42;
          const sh = this.P(d.u, d.v, 0);
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(sh[0] + s * 0.2, sh[1], s * 1.25, s * 0.45, 0, 0, Math.PI * 2); g.fill();
          if (d.sel || d.held || d.glow) {
            g.strokeStyle = d.glow ? '#ffd76a' : d.sel ? '#ffe9a8' : '#9fd3ff'; g.lineWidth = 3;
            g.beginPath(); g.ellipse(sh[0], sh[1], s * 1.5, s * 0.6, 0, 0, Math.PI * 2); g.stroke();
          }
          this.die(g, p[0], p[1], s, d);
        } });
      }
      items.sort((a, b) => a.v - b.v).forEach((it) => it.draw());
      for (const p of this.parts) { g.globalAlpha = 1 - p.life / p.max; g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
      g.restore();
    },
  };
  RD.View = V;
})();
