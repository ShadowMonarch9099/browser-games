// Orchard Sow view: an autumn picnic under the apple trees. A carved
// honey-wood board sits on a gingham blanket; the pits are polished bowls and
// the seeds are glossy beans, each one tracked so it can be scooped up and
// dropped pit by pit. Leaves drift down across everything.
(function () {
  const R = OS.Rules;
  const BEANS = ['#8e2b2b', '#c4572a', '#d9a03c', '#6b8e3a', '#e8dcc0', '#5a3a2a', '#b33a5e', '#3f6e5e'];
  const V = {
    W: 1, H: 1, S: 1, cx: 0, cy: 0, w: 8, h: 2, t: 0.08, c: 0.72, hk: 0.95, time: 0, reduced: false,
    seeds: new Map(), queue: [], parts: [], leaves: [], hint: [], last: null, hover: -1, flip: false, speed: 1, showCounts: true,
    layout(W, H, top, bottom) {
      this.W = W; this.H = H; this.S = 1; this.cx = 0; this.cy = 0;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [u, v] of [[-0.3, -0.3], [8.3, -0.3], [-0.3, 2.3], [8.3, 2.3]]) for (const hh of [0, -0.5, 0.8]) {
        const p = this.P(u, v, hh); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
      const aw = W - 24, ah = H - top - bottom;
      this.S = Math.min(aw / (x1 - x0), ah / (y1 - y0));
      this.cx = W / 2 - ((x0 + x1) / 2) * this.S;
      this.cy = top + ah / 2 - ((y0 + y1) / 2) * this.S;
      for (const s of this.seeds.values()) this.home(s);
    },
    k(v) { return 1 / (1 + (this.h - v) * this.t); },
    P(u, v, hh = 0) { const k = this.k(v); return [this.cx + (u - this.w / 2) * this.S * k, this.cy + ((v - this.h / 2) * this.c - hh * this.hk) * this.S * k, this.S * k]; },
    // where each slot sits on the board
    slotPos(i) {
      if (i === 6) return [7.5, 1.0]; if (i === 13) return [0.5, 1.0];
      return i < 6 ? [1.5 + i, 1.5] : [1.5 + (12 - i), 0.5];
    },
    slotAt(px, py) {
      let best = -1, bd = 1e9;
      for (let i = 0; i < 14; i++) { if (i === 6 || i === 13) continue; const [u, v] = this.slotPos(i), p = this.P(u, v, 0), d = Math.hypot(px - p[0], (py - p[1]) / this.c); if (d < p[2] * 0.5 && d < bd) { bd = d; best = i; } }
      return best;
    },
    // a seed's resting place: the k-th seed spirals out from the middle and stacks up
    rest(slot, k) {
      const [u, v] = this.slotPos(slot), store = slot === 6 || slot === 13;
      const ring = Math.floor(Math.sqrt(k)), a = k * 2.4 + slot;
      const rad = store ? Math.min(0.32, 0.07 * Math.sqrt(k % 14)) : Math.min(0.28, 0.08 * Math.sqrt(k % 9));
      const layer = store ? Math.floor(k / 14) : Math.floor(k / 9);
      return [u + Math.cos(a) * rad, v + Math.sin(a) * rad * (store ? 2.2 : 1), -0.12 + layer * 0.09 + (ring ? 0.02 : 0)];
    },
    // build seeds from a board (no animation)
    reset(board) {
      this.seeds.clear(); this.queue = []; let id = 0;
      board.forEach((n, slot) => { for (let k = 0; k < n; k++) { const s = { id, slot, k, col: BEANS[(id * 5 + (id >> 2)) % BEANS.length], rot: (id * 1.7) % 3 }; this.home(s, true); this.seeds.set(id++, s); } });
    },
    home(s, snap) { const [u, v, h] = this.rest(s.slot, s.k); if (snap || !s.a) { s.u = u; s.v = v; s.h = h; } s.tu = u; s.tv = v; s.th = h; },
    inSlot(slot) { return [...this.seeds.values()].filter((s) => s.slot === slot).sort((a, b) => a.k - b.k); },
    renumber(slot) { this.inSlot(slot).forEach((s, k) => { s.k = k; }); },
    // fly a seed to a slot along an arc
    fly(s, slot, dur, lift) {
      const from = [s.u, s.v, s.h];
      s.slot = slot; s.k = this.inSlot(slot).length - 1;
      const [u, v, h] = this.rest(slot, s.k);
      s.a = { from, to: [u, v, h], t: 0, d: this.reduced ? 0.01 : dur / this.speed, lift };
    },
    // the animation queue: steps run one after another
    play(ev) { for (const e of ev) this.queue.push(e); },
    busy() { return this.queue.length > 0 || this.wait > 0 || [...this.seeds.values()].some((s) => s.a); },
    wait: 0,
    step() {
      const e = this.queue.shift(); if (!e) return;
      if (e.type === 'sow') {
        // scoop: every seed in the pit, then drop them one by one
        const hand = this.inSlot(e.from);
        this.last = e.from;
        hand.forEach((s, j) => { s.slot = -1; s.a = { from: [s.u, s.v, s.h], to: [s.u, s.v, 0.9 + j * 0.03], t: 0, d: this.reduced ? 0.01 : 0.22 / this.speed, lift: 0.3 }; });
        e.path.forEach((slot, j) => this.queue.splice(j, 0, { type: 'drop', seed: hand[j], slot, n: j }));
        this.wait = 0.25 / this.speed;
      } else if (e.type === 'drop') {
        this.fly(e.seed, e.slot, 0.2, 0.5);
        if (this.onDrop) this.onDrop(e.slot, e.n);
        this.wait = (this.reduced ? 0.02 : 0.13) / this.speed;
      } else if (e.type === 'capture') {
        this.wait = 0.25 / this.speed;
        const list = []; for (const p of e.pits) list.push(...this.inSlot(p));
        list.forEach((s, j) => this.fly(s, e.to, 0.45 + j * 0.03, 1.4));
        for (const p of e.pits) this.renumber(p);
        if (this.onCapture) this.onCapture(e);
        const c = this.P(...this.slotPos(e.pits[0]), 0.3); this.burst(c[0], c[1], 14);
      } else if (e.type === 'sweep') {
        for (const m of e.moves) for (const s of this.inSlot(m.from)) this.fly(s, m.to, 0.6, 1.0);
        if (this.onSweep) this.onSweep(e);
        this.wait = 0.4 / this.speed;
      } else if (e.type === 'again' || e.type === 'over') { if (this.onEvent) this.onEvent(e); }
    },
    burst(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 140; this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100, life: 0, max: 0.6 + Math.random() * 0.4, col: ['#ffd166', '#f4a259', '#ffffff'][i % 3], r: 2 + Math.random() * 2 }); } },
    tick(dt) {
      this.time += dt;
      this.wait = Math.max(0, this.wait - dt);
      for (const s of this.seeds.values()) {
        if (!s.a) continue;
        s.a.t += dt;
        const q = Math.min(1, s.a.t / s.a.d), e = q * q * (3 - 2 * q), [u0, v0, h0] = s.a.from, [u1, v1, h1] = s.a.to;
        s.u = u0 + (u1 - u0) * e; s.v = v0 + (v1 - v0) * e; s.h = h0 + (h1 - h0) * e + Math.sin(q * Math.PI) * s.a.lift;
        if (q >= 1) { s.a = null; s.u = u1; s.v = v1; s.h = h1; if (s.slot >= 0 && this.onLand) this.onLand(s); }
      }
      while (this.queue.length && this.wait <= 0 && !(this.queue[0].type !== 'drop' && [...this.seeds.values()].some((s) => s.a && s.slot >= 0 && s.a.lift > 1))) this.step();
      for (const p of this.parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
      this.parts = this.parts.filter((p) => p.life < p.max);
      // falling leaves
      if (!this.reduced && this.leaves.length < 14 && Math.random() < dt * 1.2) this.leaves.push({ x: Math.random() * this.W, y: -20, r: 6 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 3, vx: 10 + Math.random() * 20, ph: Math.random() * 6, col: ['#d9732e', '#e8a33c', '#b5452a', '#c9b03a'][(Math.random() * 4) | 0] });
      for (const l of this.leaves) { l.y += dt * 28; l.x += Math.sin(this.time * 1.5 + l.ph) * dt * 30 + l.vx * dt * 0.3; l.rot += l.vr * dt; }
      this.leaves = this.leaves.filter((l) => l.y < this.H + 20);
    },

    // ---------- drawing ----------
    poly(g, pts, fill, stroke, lw) {
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
    },
    // an ellipse lying on the board at (u, v) with radii in board units
    ring(u, v, ru, rv, h, n = 28) { const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push(this.P(u + Math.cos(a) * ru, v + Math.sin(a) * rv, h)); } return pts; },
    scene(g) {
      const { W, H } = this;
      // grass
      g.fillStyle = '#7a9a4a'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 60; i++) { const x = (i * 97) % W, y = (i * 53) % H; g.fillRect(x, y, 2, 7); }
      // gingham blanket under the board
      const q = [this.P(-0.9, -0.7, -0.6), this.P(8.9, -0.7, -0.6), this.P(8.9, 2.9, -0.6), this.P(-0.9, 2.9, -0.6)];
      this.poly(g, q, '#f4ede0');
      g.save(); g.beginPath(); q.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.clip();
      g.fillStyle = 'rgba(196,58,58,0.45)';
      for (let i = -1; i < 20; i++) { const a = this.P(-0.9 + i * 0.55, -0.7, -0.6), b = this.P(-0.9 + i * 0.55 + 0.27, -0.7, -0.6), c = this.P(-0.9 + i * 0.55 + 0.27, 2.9, -0.6), d = this.P(-0.9 + i * 0.55, 2.9, -0.6); this.poly(g, [a, b, c, d], 'rgba(196,58,58,0.45)'); }
      for (let j = 0; j < 8; j++) { const a = this.P(-0.9, -0.7 + j * 0.5, -0.6), b = this.P(8.9, -0.7 + j * 0.5, -0.6), c = this.P(8.9, -0.7 + j * 0.5 + 0.25, -0.6), d = this.P(-0.9, -0.7 + j * 0.5 + 0.25, -0.6); this.poly(g, [a, b, c, d], 'rgba(196,58,58,0.45)'); }
      g.restore();
      // apple trees leaning in at the top corners
      for (const [x, s] of [[W * 0.06, 1], [W * 0.94, -1]]) {
        g.fillStyle = '#5a3a24'; g.fillRect(x - 10, 0, 20, Math.min(160, H * 0.22));
        g.fillStyle = '#4f7a2e';
        for (const [dx, dy, r] of [[0, 0, 90], [60 * s, 30, 70], [-50 * s, 40, 65], [20 * s, -30, 70]]) { g.beginPath(); g.arc(x + dx, dy, r, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#c0392b';
        for (const [dx, dy] of [[20, 40], [-30, 60], [70, 70], [-60, 20], [40, -10]]) { g.beginPath(); g.arc(x + dx * s, dy + 20, 8, 0, Math.PI * 2); g.fill(); }
      }
    },
    board(g, s) {
      // a rounded slab of wood with a visible front edge
      const outline = (h) => { const pts = []; for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + (i / 16) * Math.PI; pts.push(this.P(7.6 + Math.cos(a) * 0.55, 1 + Math.sin(a) * 1.15, h)); } for (let i = 0; i <= 16; i++) { const a = Math.PI / 2 + (i / 16) * Math.PI; pts.push(this.P(0.4 + Math.cos(a) * 0.55, 1 + Math.sin(a) * 1.15, h)); } return pts; };
      const bottom = outline(-0.45), top = outline(0);
      this.poly(g, bottom.map(([x, y]) => [x + 6, y + 10]), 'rgba(40,20,5,0.35)');
      this.poly(g, bottom, '#8a5a2a');
      // front face: connect the near halves of top and bottom
      g.fillStyle = '#9a6530';
      g.beginPath(); top.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
      const gr = g.createLinearGradient(0, top[0][1], 0, top[16][1]);
      const tp = this.P(4, 1, 0);
      const wood = g.createRadialGradient(tp[0], tp[1], 0, tp[0], tp[1], this.S * 5);
      wood.addColorStop(0, '#e2b06a'); wood.addColorStop(1, '#c48a44');
      this.poly(g, top.map(([x, y]) => [x, y - 3]), wood);
      // wood grain
      g.strokeStyle = 'rgba(120,70,20,0.18)'; g.lineWidth = 1.2;
      for (let j = 0; j < 7; j++) { g.beginPath(); for (let i = 0; i <= 20; i++) { const u = 0.1 + i * 0.39, v = 0.1 + j * 0.3 + Math.sin(i * 0.7 + j) * 0.05, p = this.P(u, v, 0.005); i ? g.lineTo(p[0], p[1] - 3) : g.moveTo(p[0], p[1] - 3); } g.stroke(); }
      // a carved leaf on the dividing line
      const lp = this.P(4, 1, 0.01);
      g.strokeStyle = 'rgba(110,60,20,0.35)'; g.lineWidth = 2; g.beginPath(); g.ellipse(lp[0], lp[1] - 3, lp[2] * 0.3, lp[2] * 0.09, 0, 0, Math.PI * 2); g.stroke();
      // pits and stores
      for (let i = 0; i < 14; i++) {
        const [u, v] = this.slotPos(i), store = i === 6 || i === 13, ru = store ? 0.4 : 0.38, rv = store ? 0.88 : 0.38;
        const rim = this.ring(u, v, ru, rv, 0).map(([x, y]) => [x, y - 3]);
        this.poly(g, rim, '#a8702e');
        const inner = this.ring(u, v + 0.03, ru * 0.9, rv * 0.9, -0.02).map(([x, y]) => [x, y - 3]);
        const c = this.P(u, v, 0);
        const bowl = g.createRadialGradient(c[0], c[1] - c[2] * 0.15, 0, c[0], c[1], c[2] * (store ? 0.9 : 0.45));
        bowl.addColorStop(0, '#7a4a1e'); bowl.addColorStop(1, '#4a2a10');
        this.poly(g, inner, bowl);
        const legal = this.hint.includes(i), hov = this.hover === i;
        if (legal) { const a = hov ? 1 : 0.55 + 0.35 * Math.sin(this.time * 5); this.poly(g, rim, null, `rgba(255,140,20,${a})`, hov ? 5 : 3.5); }
        if (this.last === i) this.poly(g, rim, null, 'rgba(255,255,255,0.5)', 2);
      }
    },
    seed(g, s) {
      const p = this.P(s.u, s.v, s.h + 0.12), r = p[2] * 0.088;
      const sh = this.P(s.u, s.v, Math.min(s.h, 0) - 0.02);
      g.fillStyle = 'rgba(30,10,0,0.3)'; g.beginPath(); g.ellipse(sh[0], sh[1] - 2, r * 1.1, r * 0.5, 0, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(p[0], p[1] - 3); g.rotate(s.rot);
      const gr = g.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r * 1.3);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, s.col); gr.addColorStop(1, this.shade(s.col, 0.55));
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, r * 1.25, r * 0.95, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    },
    shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = (c) => Math.max(0, Math.min(255, Math.round(c * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; },
    counts(g) {
      if (!this.showCounts || !this.seeds.size) return;
      const board = Array(14).fill(0);
      for (const s of this.seeds.values()) if (s.slot >= 0) board[s.slot]++;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < 14; i++) {
        const [u, v] = this.slotPos(i), store = i === 6 || i === 13;
        const p = store ? this.P(u, v + 1.05, 0) : this.P(u, i < 6 ? v + 0.55 : v - 0.55, 0);
        const n = board[i];
        g.font = `${Math.round(p[2] * (store ? 0.32 : 0.24))}px 'Caveat Brush', cursive`;
        g.fillStyle = store ? '#fff6dc' : 'rgba(255,246,220,0.9)'; g.strokeStyle = 'rgba(70,35,10,0.8)'; g.lineWidth = 3;
        g.strokeText(String(n), p[0], p[1] - 3); g.fillText(String(n), p[0], p[1] - 3);
      }
    },
    draw(g, s) {
      this.scene(g);
      this.board(g, s);
      const list = [...this.seeds.values()].sort((a, b) => a.v + a.h * 0.01 - (b.v + b.h * 0.01));
      // seeds in the hand float above everything
      for (const sd of list) if (sd.slot >= 0 || !sd.a) this.seed(g, sd);
      for (const sd of list) if (sd.slot < 0 || (sd.a && sd.a.lift > 1)) this.seed(g, sd);
      this.counts(g);
      for (const p of this.parts) { g.globalAlpha = 1 - p.life / p.max; g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1;
      for (const l of this.leaves) { g.save(); g.translate(l.x, l.y); g.rotate(l.rot); g.fillStyle = l.col; g.beginPath(); g.ellipse(0, 0, l.r, l.r * 0.5, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(90,40,10,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-l.r, 0); g.lineTo(l.r, 0); g.stroke(); g.restore(); }
    },
  };
  OS.View = V;
})();
