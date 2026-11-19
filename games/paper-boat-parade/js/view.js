// Paper Boat Parade view: the river board on a carved wooden platform, seen
// at a slant under a night of lanterns. Water squares shimmer, lamp buoys
// float on the safe squares, fast water runs round the bends, and the boats
// are folded paper with a little flame aboard. The die is a real 3D cube.
(function () {
  const R = PB.Rules;
  const SEAT = [
    { c: '#f5a524', d: '#b86e05', l: '#ffd27a' },   // marigold
    { c: '#2bb673', d: '#137a48', l: '#8ff0be' },   // jade
    { c: '#ef476f', d: '#a5193f', l: '#ffa6bd' },   // rose
    { c: '#5c6cff', d: '#2b37b8', l: '#aab3ff' },   // indigo
  ];
  const V = {
    W: 1, H: 1, S: 1, cx: 0, cy: 0, t: 0.022, c: 0.82, hk: 0.9, time: 0, reduced: false, parts: [], shake: 0, sparks: [],
    resize(W, H, top, bottom) {
      this.W = W; this.H = H;
      this.S = 1; this.cx = 0; this.cy = 0;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [u, v] of [[-0.6, -0.6], [15.6, -0.6], [-0.6, 15.6], [15.6, 15.6]]) for (const h of [0, -0.8]) {
        const p = this.P(u, v, h); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
      const aw = W * 0.96, ah = H - top - bottom;
      this.S = Math.min(aw / (x1 - x0), ah / (y1 - y0));
      this.cx = W / 2 - ((x0 + x1) / 2) * this.S;
      this.cy = top + ah / 2 - ((y0 + y1) / 2) * this.S;
    },
    k(v) { return 1 / (1 + (15 - v) * this.t); },
    P(u, v, h = 0) { const k = this.k(v); return [this.cx + (u - 7.5) * this.S * k, this.cy + ((v - 7.5) * this.c - h * this.hk) * this.S * k, this.S * k]; },
    poly(g, pts, fill, stroke, lw) {
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
    },
    quad(x0, y0, x1, y1, h = 0) { return [this.P(x0, y0, h), this.P(x1, y0, h), this.P(x1, y1, h), this.P(x0, y1, h)]; },
    rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, a)})`; },

    // ---------- the night ----------
    sky(g) {
      const W = this.W, H = this.H;
      const s = g.createLinearGradient(0, 0, 0, H);
      s.addColorStop(0, '#120a2e'); s.addColorStop(0.6, '#2a1340'); s.addColorStop(1, '#3d1a3a');
      g.fillStyle = s; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,240,210,0.8)';
      for (let i = 0; i < 70; i++) { const x = (i * 139.7) % W, y = (i * 71.3) % (H * 0.5), a = 0.4 + 0.6 * Math.abs(Math.sin(this.time * 0.8 + i)); g.globalAlpha = a * 0.7; g.fillRect(x, y, 1.5, 1.5); }
      g.globalAlpha = 1;
      // a skyline of domes and towers along the far bank
      const by = this.P(7.5, -0.6, 0)[1] - 4;
      g.fillStyle = '#1b0f2c';
      g.beginPath(); g.moveTo(0, by + 20);
      for (let x = 0; x <= W; x += 30) {
        const k = (x * 7) % 5;
        if (k === 0) { g.lineTo(x, by - 40); g.arc(x + 15, by - 40, 15, Math.PI, 0); }
        else if (k === 2) { g.lineTo(x, by - 60); g.lineTo(x + 6, by - 72); g.lineTo(x + 12, by - 60); g.lineTo(x + 30, by - 30); }
        else g.lineTo(x + 30, by - 18 - k * 6);
      }
      g.lineTo(W, by + 20); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
      // sky lanterns drifting up
      for (let i = 0; i < 14; i++) {
        const x = ((i * 97 + this.time * (6 + (i % 4))) % (W + 60)) - 30, y = H * 0.55 - ((this.time * (10 + (i % 5) * 3) + i * 53) % (H * 0.6));
        const f = 0.7 + 0.3 * Math.sin(this.time * 5 + i);
        const gr = g.createRadialGradient(x, y, 0, x, y, 16);
        gr.addColorStop(0, `rgba(255,190,90,${0.5 * f})`); gr.addColorStop(1, 'rgba(255,150,60,0)');
        g.fillStyle = gr; g.fillRect(x - 16, y - 16, 32, 32);
        g.fillStyle = `rgba(255,${180 + 40 * f},120,0.9)`; g.fillRect(x - 3, y - 4, 6, 8);
      }
    },

    // ---------- the board ----------
    board(g, game, o) {
      // the carved platform underneath
      this.poly(g, [this.P(-0.6, 15.6, 0), this.P(15.6, 15.6, 0), this.P(15.6, 15.6, -0.8), this.P(-0.6, 15.6, -0.8)], '#5a2f1a');
      for (let i = 0; i < 16; i++) { const a = this.P(-0.6 + i * 1.0125, 15.6, -0.12), b = this.P(-0.6 + i * 1.0125, 15.6, -0.68); g.strokeStyle = 'rgba(255,200,140,0.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      this.poly(g, this.quad(-0.6, -0.6, 15.6, 15.6), '#7a4424');
      this.poly(g, this.quad(-0.25, -0.25, 15.25, 15.25), '#e9d3a8');
      // harbours
      R.YARD.forEach(([x, y], s) => {
        if (!game || !game.seats[s]) { this.poly(g, this.quad(x + 0.15, y + 0.15, x + 5.85, y + 5.85), 'rgba(90,60,40,0.35)'); return; }
        const C = SEAT[s];
        this.poly(g, this.quad(x + 0.15, y + 0.15, x + 5.85, y + 5.85), C.c);
        this.poly(g, this.quad(x + 0.9, y + 0.9, x + 5.1, y + 5.1), this.water(x + 3, y + 3));
        for (let b = 0; b < 4; b++) {
          const cx = x + 1.5 + (b % 2) * 3, cy = y + 1.5 + Math.floor(b / 2) * 3, pts = [];
          for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; pts.push(this.P(cx + Math.cos(a) * 0.95, cy + Math.sin(a) * 0.95)); }
          this.poly(g, pts, this.rgba(C.l, 0.35), C.d, 2);
        }
        if (game.turn === s && game.phase !== 'over') {
          const a = 0.35 + 0.25 * Math.sin(this.time * 5);
          this.poly(g, this.quad(x + 0.15, y + 0.15, x + 5.85, y + 5.85), null, `rgba(255,255,255,${a})`, 4);
        }
      });
      // the river
      R.PATH.forEach(([c, r], i) => {
        const pts = this.quad(c + 0.05, r + 0.05, c + 0.95, r + 0.95);
        let fill = this.water(c, r);
        const startOf = R.START.indexOf(i);
        if (startOf >= 0 && game && game.seats[startOf]) fill = SEAT[startOf].c;
        this.poly(g, pts, fill, 'rgba(255,255,255,0.18)', 1);
        if (R.SAFE.has(i) && startOf < 0) this.diya(g, c + 0.5, r + 0.5, 0.32);
        if (game && game.rules.currents && R.CURRENTS.indexOf(i) >= 0) this.chevrons(g, i);
      });
      // lantern channels
      R.CHANNEL.forEach((ch, s) => ch.forEach(([c, r]) => this.poly(g, this.quad(c + 0.05, r + 0.05, c + 0.95, r + 0.95), game && game.seats[s] ? SEAT[s].l : '#d8c7a3', 'rgba(255,255,255,0.25)', 1)));
      // the central ghat: four petals, one per harbour
      const tri = [[[6, 6], [9, 6], [7.5, 7.5]], [[9, 6], [9, 9], [7.5, 7.5]], [[9, 9], [6, 9], [7.5, 7.5]], [[6, 9], [6, 6], [7.5, 7.5]]];
      const petalSeat = [1, 2, 3, 0];
      tri.forEach((t, i) => this.poly(g, t.map(([u, v]) => this.P(u, v, 0.02)), game && game.seats[petalSeat[i]] ? SEAT[petalSeat[i]].c : '#bfa77f', '#7a4424', 1.5));
      const c0 = this.P(7.5, 7.5, 0.05), r0 = c0[2] * 0.55;
      const gr = g.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], r0 * 2);
      gr.addColorStop(0, 'rgba(255,220,140,0.9)'); gr.addColorStop(1, 'rgba(255,180,90,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(c0[0], c0[1], r0 * 2, r0 * 2 * this.c, 0, 0, Math.PI * 2); g.fill();
      // highlights for squares a selected boat could reach
      if (o && o.preview) { const [u, v] = o.preview; const p = this.quad(u - 0.45, v - 0.45, u + 0.45, v + 0.45, 0.02); this.poly(g, p, 'rgba(255,255,255,0.25)', '#fff', 2); }
    },
    water(c, r) {
      const w = 0.5 + 0.5 * Math.sin(this.time * 1.6 + c * 0.7 + r * 0.9);
      return `rgb(${Math.round(40 + w * 20)},${Math.round(110 + w * 30)},${Math.round(150 + w * 30)})`;
    },
    diya(g, u, v, s) {
      const p = this.P(u, v, 0.05), r = p[2] * s;
      g.fillStyle = '#b5652b'; g.beginPath(); g.ellipse(p[0], p[1], r, r * 0.45, 0, 0, Math.PI); g.fill();
      const f = 1 + 0.15 * Math.sin(this.time * 12 + u);
      const gr = g.createRadialGradient(p[0], p[1] - r * 0.5, 0, p[0], p[1] - r * 0.5, r * 2.2);
      gr.addColorStop(0, 'rgba(255,220,120,0.7)'); gr.addColorStop(1, 'rgba(255,170,60,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(p[0], p[1] - r * 0.5, r * 2.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffd25a'; g.beginPath(); g.moveTo(p[0] - r * 0.18, p[1] - r * 0.1); g.quadraticCurveTo(p[0], p[1] - r * 1.1 * f, p[0] + r * 0.18, p[1] - r * 0.1); g.fill();
    },
    // fast water: little arrows racing along the bend
    chevrons(g, i) {
      const [c, r] = R.PATH[i], [nc, nr] = R.PATH[(i + 1) % 52], dx = nc - c, dy = nr - r;
      g.strokeStyle = 'rgba(220,250,255,0.85)'; g.lineWidth = 2;
      for (let k = 0; k < 2; k++) {
        const f = ((this.time * 1.4 + k * 0.5) % 1) - 0.5, u = c + 0.5 + dx * f * 0.7, v = r + 0.5 + dy * f * 0.7;
        const a = this.P(u - dx * 0.12 - dy * 0.15, v - dy * 0.12 - dx * 0.15), b = this.P(u + dx * 0.1, v + dy * 0.1), d = this.P(u - dx * 0.12 + dy * 0.15, v - dy * 0.12 + dx * 0.15);
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(d[0], d[1]); g.stroke();
      }
    },
    // a folded paper boat with a lamp aboard
    boat(g, seat, u, v, o = {}) {
      const C = SEAT[seat], bob = this.reduced ? 0 : Math.sin(this.time * 3 + u + v) * 0.03, h = (o.lift || 0) + 0.05 + bob;
      const sh = this.P(u + 0.05, v + 0.08, 0), s = sh[2] * (o.scale || 1);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(sh[0], sh[1], s * 0.4, s * 0.14, 0, 0, Math.PI * 2); g.fill();
      const p = this.P(u, v, h);
      const x = p[0], y = p[1];
      if (o.ring) {
        g.strokeStyle = o.ring; g.lineWidth = 3;
        g.beginPath(); g.ellipse(x, y + s * 0.05, s * 0.5, s * 0.2, 0, 0, Math.PI * 2); g.stroke();
      }
      // hull
      g.fillStyle = C.d;
      g.beginPath(); g.moveTo(x - s * 0.45, y - s * 0.12); g.lineTo(x + s * 0.45, y - s * 0.12); g.lineTo(x + s * 0.3, y + s * 0.08); g.lineTo(x - s * 0.3, y + s * 0.08); g.closePath(); g.fill();
      g.fillStyle = C.c;
      g.beginPath(); g.moveTo(x - s * 0.45, y - s * 0.12); g.lineTo(x + s * 0.45, y - s * 0.12); g.lineTo(x + s * 0.32, y - s * 0.02); g.lineTo(x - s * 0.32, y - s * 0.02); g.closePath(); g.fill();
      // the folded sail
      g.fillStyle = C.l;
      g.beginPath(); g.moveTo(x - s * 0.2, y - s * 0.12); g.lineTo(x, y - s * 0.55); g.lineTo(x + s * 0.2, y - s * 0.12); g.closePath(); g.fill();
      g.fillStyle = C.c;
      g.beginPath(); g.moveTo(x, y - s * 0.55); g.lineTo(x + s * 0.2, y - s * 0.12); g.lineTo(x + s * 0.05, y - s * 0.12); g.closePath(); g.fill();
      // the lamp
      const f = 0.8 + 0.2 * Math.sin(this.time * 10 + u * 3);
      const gr = g.createRadialGradient(x - s * 0.28, y - s * 0.2, 0, x - s * 0.28, y - s * 0.2, s * 0.35);
      gr.addColorStop(0, `rgba(255,220,120,${0.8 * f})`); gr.addColorStop(1, 'rgba(255,180,80,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x - s * 0.28, y - s * 0.2, s * 0.35, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(x - s * 0.28, y - s * 0.2, s * 0.05, 0, Math.PI * 2); g.fill();
      if (o.label) { g.fillStyle = '#fff'; g.font = `700 ${Math.round(s * 0.28)}px 'Hind', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.label, x + s * 0.18, y - s * 0.28); }
    },

    // ---------- the die: a cube with pips, tumbling ----------
    die(g, x, y, size, d) {
      // d: { value, rx, ry, rz } current rotation
      const R3 = (v) => {
        let [a, b, c] = v;
        const cx = Math.cos(d.rx), sx = Math.sin(d.rx), cy = Math.cos(d.ry), sy = Math.sin(d.ry), cz = Math.cos(d.rz), sz = Math.sin(d.rz);
        [b, c] = [b * cx - c * sx, b * sx + c * cx];
        [a, c] = [a * cy + c * sy, -a * sy + c * cy];
        [a, b] = [a * cz - b * sz, a * sz + b * cz];
        return [a, b, c];
      };
      const proj = ([a, b, c]) => { const k = 3 / (3 - c * 0.6); return [x + a * size * k, y - b * size * k, c]; };
      // faces: normal, the pips value, and the face's two in-plane axes
      const faces = [
        { n: [0, 0, 1], v: 1, u: [1, 0, 0], w: [0, 1, 0] }, { n: [0, 0, -1], v: 6, u: [-1, 0, 0], w: [0, 1, 0] },
        { n: [0, 1, 0], v: 2, u: [1, 0, 0], w: [0, 0, -1] }, { n: [0, -1, 0], v: 5, u: [1, 0, 0], w: [0, 0, 1] },
        { n: [1, 0, 0], v: 3, u: [0, 0, -1], w: [0, 1, 0] }, { n: [-1, 0, 0], v: 4, u: [0, 0, 1], w: [0, 1, 0] },
      ];
      const PIPS = { 1: [[0, 0]], 2: [[-1, 1], [1, -1]], 3: [[-1, 1], [0, 0], [1, -1]], 4: [[-1, 1], [1, 1], [-1, -1], [1, -1]], 5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]], 6: [[-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]] };
      const shown = faces.map((f) => ({ f, n: R3(f.n) })).filter((x) => x.n[2] > 0.01).sort((a, b) => a.n[2] - b.n[2]);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x + size * 0.15, y + size * 1.25, size * 1.1, size * 0.3, 0, 0, Math.PI * 2); g.fill();
      for (const { f, n } of shown) {
        const corner = (a, b) => proj(R3([f.n[0] + f.u[0] * a + f.w[0] * b, f.n[1] + f.u[1] * a + f.w[1] * b, f.n[2] + f.u[2] * a + f.w[2] * b]));
        const lit = 0.72 + 0.28 * n[2];
        this.poly(g, [corner(-1, 1), corner(1, 1), corner(1, -1), corner(-1, -1)], `rgb(${Math.round(250 * lit)},${Math.round(240 * lit)},${Math.round(222 * lit)})`, '#7a4424', 2);
        g.fillStyle = f.v === 1 ? '#c8102e' : '#2a1a10';
        for (const [a, b] of PIPS[f.v]) { const c = corner(a * 0.5, b * 0.5), r = size * (f.v === 1 ? 0.24 : 0.15) * Math.sqrt(n[2]); g.beginPath(); g.ellipse(c[0], c[1], r, r, 0, 0, Math.PI * 2); g.fill(); }
      }
    },
    // the rotation that shows `value` to the viewer, tipped a little so three faces show
    faceUp(value) {
      const base = { 1: [0, 0], 6: [0, Math.PI], 2: [Math.PI / 2, 0], 5: [-Math.PI / 2, 0], 3: [0, -Math.PI / 2], 4: [0, Math.PI / 2] }[value];
      return { rx: base[0] - 0.42, ry: base[1] + 0.5, rz: 0 };
    },

    // ---------- effects ----------
    splash(u, v, col, n) {
      if (this.reduced) n = Math.ceil(n / 3);
      const p = this.P(u, v, 0.1);
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = (40 + Math.random() * 120) * (p[2] / 40); this.parts.push({ x: p[0], y: p[1], vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.5 + Math.random() * 0.4, col, r: 1.5 + Math.random() * 2.5 }); }
    },
    firework(x, y, col) {
      const n = this.reduced ? 20 : 60;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, s = 140 + Math.random() * 120; this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 + Math.random() * 0.6, col }); }
    },
    tick(dt) {
      this.time += dt; this.shake = Math.max(0, this.shake - dt * 3);
      for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
      this.parts = this.parts.filter((p) => p.life > 0);
      for (const p of this.sparks) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy = p.vy * 0.97 + 60 * dt; }
      this.sparks = this.sparks.filter((p) => p.life > 0);
    },
    effects(g) {
      for (const p of this.parts) { g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
      g.globalCompositeOperation = 'lighter';
      for (const p of this.sparks) { g.globalAlpha = Math.min(1, p.life); g.fillStyle = p.col; g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    },
  };
  V.SEAT = SEAT;
  PB.View = V;
})();
