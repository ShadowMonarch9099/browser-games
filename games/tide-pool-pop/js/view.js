// Tide Pool Pop view: looking down into a rock pool at low tide, tilted a
// little so the basin has depth. Sunlight ripples across the water, weed
// sways at the rim, and the creatures sit on the bottom: starfish, scallops,
// urchins, crabs, clams and little fish. Every sprite is drawn by hand here.
(function () {
  const R = TP.Rules;
  const COL = {
    star: ['#ff8c2a', '#c25410', '#ffd2a1'],
    shell: ['#ff7eb6', '#c23f7c', '#ffd6ea'],
    urchin: ['#8b6cff', '#4d33b8', '#d6cbff'],
    crab: ['#e63946', '#9b1d27', '#ffb3b8'],
    clam: ['#22c3a6', '#0f7d6a', '#b8f5e8'],
    fish: ['#3fa9f5', '#1565a8', '#c7e8ff'],
  };
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const V = {
    W: 1, H: 1, S: 1, cx: 0, cy: 0, w: R.W, h: R.H, t: 0.025, c: 0.9, hk: 0.85, time: 0, reduced: false,
    sprites: new Map(), parts: [], beams: [], texts: [], sel: null, hint: null, shake: 0, sand: null, open: null, speed: 1,
    layout(W, H, top, bottom) {
      this.W = W; this.H = H; this.S = 1; this.cx = 0; this.cy = 0;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [u, v] of [[-0.45, -0.45], [this.w + 0.45, -0.45], [-0.45, this.h + 0.6], [this.w + 0.45, this.h + 0.6]]) for (const hh of [0, -0.4]) {
        const p = this.P(u, v, hh); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
      const aw = W - 16, ah = H - top - bottom;
      this.S = Math.min(aw / (x1 - x0), ah / (y1 - y0), 92);
      this.cx = W / 2 - ((x0 + x1) / 2) * this.S;
      this.cy = top + ah / 2 - ((y0 + y1) / 2) * this.S;
      this.rocks = null;
    },
    k(v) { return 1 / (1 + (this.h - v) * this.t); },
    P(u, v, hh = 0) { const k = this.k(v); return [this.cx + (u - this.w / 2) * this.S * k, this.cy + ((v - this.h / 2) * this.c - hh * this.hk) * this.S * k, this.S * k]; },
    unproject(sx, sy) {
      const a = (sx - this.cx) / this.S, b = (sy - this.cy) / this.S, D = this.h, t = this.t, c = this.c;
      const v = (b + b * D * t + (D * c) / 2) / (c + b * t);
      return [a * (1 + (D - v) * t) + this.w / 2, v];
    },
    cellAt(sx, sy) { const [u, v] = this.unproject(sx, sy); const x = Math.floor(u), y = Math.floor(v); return x >= 0 && y >= 0 && x < this.w && y < this.h ? [x, y] : null; },
    poly(g, pts, fill, stroke, lw) {
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
    },
    quad(x0, y0, x1, y1, hh = 0) { return [this.P(x0, y0, hh), this.P(x1, y0, hh), this.P(x1, y1, hh), this.P(x0, y1, hh)]; },
    isOpen(x, y) { return !!(this.open && x >= 0 && y >= 0 && x < this.w && y < this.h && this.open[y][x]); },

    // ---------- the pool's sprites ----------
    // Build sprites from the board, sliding any that moved (a reshuffle).
    sync(s, slide) {
      this.open = s.open; this.sand = s.sand.map((r) => r.slice());
      const seen = new Set();
      for (let y = 0; y < R.H; y++) for (let x = 0; x < R.W; x++) {
        const p = s.grid[y][x]; if (!p) continue;
        seen.add(p.id);
        let sp = this.sprites.get(p.id);
        if (!sp) { sp = { id: p.id, x, y, t: p.t, sp: p.sp, rock: p.rock, scale: slide ? 0 : 1, alpha: 1, wob: Math.random() * 6 }; this.sprites.set(p.id, sp); if (slide) sp.grow = 0; }
        sp.t = p.t; sp.sp = p.sp; sp.rock = p.rock;
        if (sp.x !== x || sp.y !== y) { if (slide) this.tween(sp, x, y, 0.35); else { sp.x = x; sp.y = y; sp.a = null; } }
      }
      for (const id of [...this.sprites.keys()]) if (!seen.has(id)) this.sprites.delete(id);
    },
    tween(sp, x, y, d, fall) { sp.a = { fx: sp.x, fy: sp.y, tx: x, ty: y, t: 0, d: d / this.speed, fall }; },
    busy() {
      for (const sp of this.sprites.values()) if (sp.a || sp.popping || sp.grow !== undefined) return true;
      return this.wait > 0;
    },
    wait: 0,
    // play one recorded phase from the rules
    phase(ph, s) {
      if (ph.type === 'swap') {
        const a = this.sprites.get(ph.a), b = this.sprites.get(ph.b);
        if (a) this.tween(a, ph.to[0], ph.to[1], 0.16); if (b) this.tween(b, ph.from[0], ph.from[1], 0.16);
      } else if (ph.type === 'bounce') {
        const a = this.sprites.get(ph.a), b = this.sprites.get(ph.b);
        if (a) { a.bounce = { tx: ph.to[0], ty: ph.to[1], fx: ph.from[0], fy: ph.from[1], t: 0 }; }
        if (b) { b.bounce = { tx: ph.from[0], ty: ph.from[1], fx: ph.to[0], fy: ph.to[1], t: 0 }; }
        this.wait = 0.3;
      } else if (ph.type === 'pop') {
        for (const c of ph.cleared) {
          const sp = this.sprites.get(c.id); if (!sp) continue;
          sp.popping = 0; sp.x = c.x; sp.y = c.y; sp.a = null;
          this.burst(c.x + 0.5, c.y + 0.5, c.t >= 0 ? COL[R.KINDS[c.t]][0] : '#fff', this.reduced ? 3 : 7);
        }
        for (const r of ph.cracked) {
          const sp = this.sprites.get(r.id);
          this.burst(r.x + 0.5, r.y + 0.5, '#9aa3a8', 6, 'chip');
          if (sp) { sp.rock = Math.max(1, r.left); sp.hit = 0.25; if (r.left <= 0) sp.popping = 0; }
        }
        for (const [x, y, left] of ph.washed || []) { this.sand[y][x] = left; this.burst(x + 0.5, y + 0.5, '#e9cf95', 5, 'sand'); }
        for (const f of ph.fired) {
          if (f.sp === 'h') this.beams.push({ kind: 'h', y: f.y, x: f.x, t: 0 });
          else if (f.sp === 'v') this.beams.push({ kind: 'v', x: f.x, y: f.y, t: 0 });
          else if (f.sp === 'bomb') this.beams.push({ kind: 'ring', x: f.x, y: f.y, t: 0 });
          else if (f.sp === 'pearl') this.beams.push({ kind: 'pearl', x: f.x, y: f.y, t: 0, to: ph.cleared.filter((c) => c.t >= 0).slice(0, 24).map((c) => [c.x, c.y]) });
        }
        for (const m of ph.made) { const sp = this.sprites.get(m.id); if (sp) { sp.sp = m.kind; sp.flash = 0.5; if (m.kind === 'pearl') sp.t = -1; } }
        if (ph.cleared.length) {
          const c = ph.cleared[Math.floor(ph.cleared.length / 2)];
          this.text(c.x + 0.5, c.y + 0.5, '+' + ph.cleared.length * 30 * Math.min(6, ph.cascade || 1), ph.cascade > 1 ? '#fff4a8' : '#ffffff');
        }
        if (ph.fired.length || ph.combo) this.shake = Math.min(1, this.shake + 0.35);
        this.wait = 0.2;
      } else if (ph.type === 'fall') {
        for (const m of ph.moves) { const sp = this.sprites.get(m.id); if (sp) { sp.x = m.x; this.tween(sp, m.x, m.to, 0.12 + 0.05 * (m.to - m.from), true); } }
        for (const n of ph.spawns) {
          const sp = { id: n.id, x: n.x, y: n.from, t: n.t, sp: null, scale: 1, alpha: 1, wob: Math.random() * 6 };
          this.sprites.set(n.id, sp); this.tween(sp, n.x, n.to, 0.12 + 0.05 * (n.to - n.from), true);
        }
      } else if (ph.type === 'shuffle') { this.sync(s, true); this.wait = 0.4; }
      else if (ph.type === 'charge') { const sp = this.sprites.get(ph.id); if (sp) { sp.sp = ph.sp; sp.flash = 0.4; } this.wait = 0.12; }
    },

    // ---------- effects ----------
    burst(u, v, col, n, kind) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 2;
        this.parts.push({ u, v, h: 0.3, du: Math.cos(a) * sp, dv: Math.sin(a) * sp, dh: 1 + Math.random() * 2, life: 0, max: 0.5 + Math.random() * 0.4, col, kind: kind || (i % 3 ? 'drop' : 'bubble'), r: 0.05 + Math.random() * 0.07 });
      }
    },
    text(u, v, s, col) { this.texts.push({ u, v, s, col, t: 0 }); },
    tick(dt) {
      this.time += dt;
      const sdt = dt * this.speed;
      this.wait = Math.max(0, this.wait - sdt);
      for (const sp of this.sprites.values()) {
        if (sp.a) {
          sp.a.t += dt;
          const q = Math.min(1, sp.a.t / sp.a.d), e = sp.a.fall ? q * q : ease(q);
          sp.x = sp.a.fx + (sp.a.tx - sp.a.fx) * e; sp.y = sp.a.fy + (sp.a.ty - sp.a.fy) * e;
          if (q >= 1) { sp.x = sp.a.tx; sp.y = sp.a.ty; if (sp.a.fall) sp.land = 0.18; sp.a = null; }
        }
        if (sp.bounce) { sp.bounce.t += sdt; if (sp.bounce.t > 0.3) sp.bounce = null; }
        if (sp.popping !== undefined) { sp.popping += sdt; if (sp.popping > 0.22) this.sprites.delete(sp.id); }
        if (sp.grow !== undefined) { sp.grow += sdt; sp.scale = Math.min(1, sp.grow / 0.3); if (sp.grow > 0.3) { delete sp.grow; sp.scale = 1; } }
        if (sp.land) sp.land = Math.max(0, sp.land - dt);
        if (sp.flash) sp.flash = Math.max(0, sp.flash - dt);
        if (sp.hit) sp.hit = Math.max(0, sp.hit - dt);
      }
      for (const p of this.parts) { p.life += dt; p.u += p.du * dt; p.v += p.dv * dt; p.h += p.dh * dt; p.dh -= (p.kind === 'bubble' ? -1.5 : 6) * dt; p.du *= 0.95; p.dv *= 0.95; }
      this.parts = this.parts.filter((p) => p.life < p.max);
      for (const b of this.beams) b.t += dt;
      this.beams = this.beams.filter((b) => b.t < 0.45);
      for (const t of this.texts) t.t += dt;
      this.texts = this.texts.filter((t) => t.t < 0.9);
      this.shake = Math.max(0, this.shake - dt * 2.5);
    },

    // ---------- the shore around the pool ----------
    shore(g) {
      const { W, H } = this;
      const bg = g.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#f3d9a4'); bg.addColorStop(0.22, '#dcb57a'); bg.addColorStop(1, '#8a6a43');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      // wet sand ripples
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2;
      for (let y = 20; y < H; y += 34) { g.beginPath(); for (let x = 0; x <= W; x += 20) g.lineTo(x, y + Math.sin(x * 0.02 + y) * 6); g.stroke(); }
      // the boulders that hold the pool, made once per layout
      if (!this.rocks) {
        const rnd = R.rng(31), rocks = [];
        const [l, t] = this.P(-0.6, -0.6), [r] = this.P(this.w + 0.6, -0.6), [, b] = this.P(0, this.h + 0.8);
        for (let i = 0; i < 26; i++) {
          const side = i % 4, f = rnd();
          let x, y;
          if (side === 0) { x = l + (r - l) * f; y = t - 10 - rnd() * 30; } else if (side === 1) { x = r + 10 + rnd() * 50; y = t + (b - t) * f; }
          else if (side === 2) { x = l + (r - l) * f; y = b + rnd() * 30; } else { x = l - 10 - rnd() * 50; y = t + (b - t) * f; }
          const rad = this.S * (0.7 + rnd() * 0.9), pts = [];
          for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, rr = rad * (0.75 + rnd() * 0.35); pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.7]); }
          rocks.push({ x, y, pts, shade: 0.75 + rnd() * 0.3, weed: rnd() < 0.5, ph: rnd() * 6 });
        }
        rocks.sort((a, b2) => a.y - b2.y);
        this.rocks = rocks;
      }
      for (const rk of this.rocks) {
        g.save(); g.translate(rk.x, rk.y);
        this.poly(g, rk.pts.map(([x, y]) => [x + 4, y + 8]), 'rgba(40,28,15,0.3)');
        const gr = g.createLinearGradient(0, -40, 0, 40);
        gr.addColorStop(0, `hsl(30, 8%, ${48 * rk.shade}%)`); gr.addColorStop(1, `hsl(25, 12%, ${26 * rk.shade}%)`);
        this.poly(g, rk.pts, gr);
        this.poly(g, rk.pts.slice(5, 9).map(([x, y]) => [x * 0.7, y * 0.7 - 4]), 'rgba(255,255,255,0.08)');
        if (rk.weed && !this.reduced) {
          g.strokeStyle = '#5a8f3c'; g.lineWidth = 3; g.lineCap = 'round';
          for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(k * 6 - 6, 0); g.quadraticCurveTo(k * 6 - 6 + Math.sin(this.time * 1.5 + rk.ph + k) * 8, -18, k * 6 - 4 + Math.sin(this.time * 1.2 + rk.ph + k) * 12, -32); g.stroke(); }
        }
        g.restore();
      }
    },
    // the basin: a stone lip, deep walls and sunlit water on every open square
    basin(g) {
      const o = (x, y) => this.isOpen(x, y);
      // lip and walls
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (o(x, y)) this.poly(g, this.quad(x - 0.18, y - 0.18, x + 1.18, y + 1.18, 0.02), '#5d5047');
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (o(x, y)) this.poly(g, this.quad(x - 0.08, y - 0.08, x + 1.08, y + 1.08, 0.03), '#7c6b5e');
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (!o(x, y)) continue;
        const shallow = (x + y) % 2 ? '#3fb8c4' : '#36acb9';
        this.poly(g, this.quad(x, y, x + 1, y + 1), shallow);
        // the far wall of the basin shows where the square above is rock
        if (!o(x, y - 1)) this.poly(g, [this.P(x, y, 0), this.P(x + 1, y, 0), this.P(x + 1, y + 0.22, 0), this.P(x, y + 0.22, 0)], 'rgba(20,60,70,0.35)');
        if (!o(x - 1, y)) this.poly(g, [this.P(x, y), this.P(x + 0.12, y), this.P(x + 0.12, y + 1), this.P(x, y + 1)], 'rgba(20,60,70,0.25)');
        const sd = this.sand && this.sand[y][x];
        if (sd) this.sandPatch(g, x, y, sd);
      }
      // sunlight caustics, clipped to the water
      if (!this.reduced) {
        g.save(); g.beginPath();
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (o(x, y)) { const q = this.quad(x, y, x + 1, y + 1); g.moveTo(q[0][0], q[0][1]); q.slice(1).forEach((p) => g.lineTo(p[0], p[1])); g.closePath(); }
        g.clip();
        g.strokeStyle = 'rgba(230,255,250,0.16)'; g.lineWidth = Math.max(1.5, this.S * 0.05);
        const tm = this.time;
        for (let i = -2; i < this.h + 2; i += 0.7) {
          g.beginPath();
          for (let u = -0.5; u <= this.w + 0.5; u += 0.25) { const v = i + Math.sin(u * 1.7 + tm * 0.9 + i) * 0.22 + Math.sin(u * 0.6 - tm * 0.5) * 0.18; const p = this.P(u, v); u === -0.5 ? g.moveTo(p[0], p[1]) : g.lineTo(p[0], p[1]); }
          g.stroke();
        }
        g.restore();
      }
    },
    sandPatch(g, x, y, n) {
      const q = this.quad(x + 0.06, y + 0.06, x + 0.94, y + 0.94, 0.01);
      this.poly(g, q, n > 1 ? '#c9a46a' : '#e6cf9a');
      const r = R.rng(x * 31 + y * 7 + 1);
      g.fillStyle = n > 1 ? 'rgba(90,60,30,0.35)' : 'rgba(150,110,60,0.3)';
      for (let i = 0; i < 7; i++) { const p = this.P(x + 0.15 + r() * 0.7, y + 0.15 + r() * 0.7, 0.01); g.fillRect(p[0], p[1], Math.max(1, p[2] * 0.03), Math.max(1, p[2] * 0.03)); }
      if (n > 1) {
        g.strokeStyle = 'rgba(110,75,40,0.45)'; g.lineWidth = Math.max(1, this.S * 0.025);
        for (const f of [0.35, 0.6]) { const a = this.P(x + 0.15, y + f, 0.01), b = this.P(x + 0.5, y + f + 0.06, 0.01), c = this.P(x + 0.85, y + f, 0.01); g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(b[0], b[1], c[0], c[1]); g.stroke(); }
      }
    },

    // ---------- creatures ----------
    // draw one creature centred at (px, py) with radius r
    creature(g, kind, px, py, r, wob) {
      const [c, d, l] = COL[kind];
      g.save(); g.translate(px, py);
      const tm = this.reduced ? 0 : this.time;
      g.fillStyle = 'rgba(0,40,50,0.28)'; g.beginPath(); g.ellipse(r * 0.08, r * 0.62, r * 0.85, r * 0.3, 0, 0, Math.PI * 2); g.fill();
      if (kind === 'star') {
        g.rotate(Math.sin(tm * 0.8 + wob) * 0.06);
        g.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.42 : r * 0.98; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        g.closePath(); g.lineJoin = 'round'; g.lineWidth = r * 0.22; g.strokeStyle = d; g.stroke(); g.fillStyle = c; g.fill();
        g.lineWidth = r * 0.12; g.strokeStyle = c; g.stroke();
        g.fillStyle = l;
        for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; for (const f of [0.3, 0.55]) { g.beginPath(); g.arc(Math.cos(a) * r * f, Math.sin(a) * r * f, r * 0.07, 0, Math.PI * 2); g.fill(); } }
      } else if (kind === 'shell') {
        g.beginPath(); g.moveTo(0, r * 0.75);
        for (let i = 0; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI, rr = r * (i % 2 ? 0.92 : 0.98); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.95 + r * 0.05); }
        g.closePath();
        const gr = g.createLinearGradient(0, -r, 0, r); gr.addColorStop(0, l); gr.addColorStop(0.45, c); gr.addColorStop(1, d);
        g.fillStyle = gr; g.fill(); g.lineWidth = r * 0.08; g.strokeStyle = d; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = r * 0.06;
        for (let i = 1; i < 8; i++) { const a = Math.PI + (i / 8) * Math.PI; g.beginPath(); g.moveTo(0, r * 0.7); g.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.82 + r * 0.05); g.stroke(); }
        g.fillStyle = d; g.beginPath(); g.moveTo(-r * 0.3, r * 0.62); g.lineTo(r * 0.3, r * 0.62); g.lineTo(r * 0.2, r * 0.85); g.lineTo(-r * 0.2, r * 0.85); g.fill();
      } else if (kind === 'urchin') {
        g.strokeStyle = d; g.lineWidth = r * 0.09; g.lineCap = 'round';
        for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + Math.sin(tm * 2 + wob + i) * 0.05; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4); g.lineTo(Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02); g.stroke(); }
        const gr = g.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.05, 0, 0, r * 0.62); gr.addColorStop(0, l); gr.addColorStop(0.5, c); gr.addColorStop(1, d);
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 0.6, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32, r * 0.05, 0, Math.PI * 2); g.fill(); }
      } else if (kind === 'crab') {
        const claw = Math.sin(tm * 3 + wob) * 0.15;
        g.strokeStyle = d; g.lineWidth = r * 0.1; g.lineCap = 'round';
        for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(sx * r * 0.45, r * (0.05 + i * 0.15)); g.lineTo(sx * r * 0.85, r * (0.15 + i * 0.2)); g.lineTo(sx * r * 0.95, r * (0.4 + i * 0.15)); g.stroke(); }
        for (const sx of [-1, 1]) {
          g.save(); g.translate(sx * r * 0.62, -r * 0.42); g.rotate(sx * (0.4 + claw));
          g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, r * 0.28, r * 0.2, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = d; g.beginPath(); g.moveTo(0, -r * 0.05); g.lineTo(sx * r * 0.32, -r * 0.18); g.lineTo(sx * r * 0.3, 0); g.fill();
          g.restore();
        }
        const gr = g.createLinearGradient(0, -r * 0.5, 0, r * 0.5); gr.addColorStop(0, l); gr.addColorStop(0.35, c); gr.addColorStop(1, d);
        g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0.05 * r, r * 0.62, r * 0.45, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = d; g.lineWidth = r * 0.07; g.beginPath(); g.moveTo(-r * 0.18, -r * 0.35); g.lineTo(-r * 0.2, -r * 0.6); g.moveTo(r * 0.18, -r * 0.35); g.lineTo(r * 0.2, -r * 0.6); g.stroke();
        for (const sx of [-1, 1]) { g.fillStyle = '#fff'; g.beginPath(); g.arc(sx * r * 0.2, -r * 0.64, r * 0.12, 0, Math.PI * 2); g.fill(); g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(sx * r * 0.2, -r * 0.62, r * 0.06, 0, Math.PI * 2); g.fill(); }
        g.strokeStyle = d; g.lineWidth = r * 0.06; g.beginPath(); g.arc(0, r * 0.02, r * 0.16, 0.3, Math.PI - 0.3); g.stroke();
      } else if (kind === 'clam') {
        const gr = g.createLinearGradient(0, -r, 0, r); gr.addColorStop(0, l); gr.addColorStop(0.5, c); gr.addColorStop(1, d);
        g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, r * 0.95, r * 0.68, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = d; g.lineWidth = r * 0.07; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = r * 0.05;
        for (const f of [0.35, 0.6]) { g.beginPath(); g.ellipse(0, -r * 0.05, r * 0.95 * f + r * 0.2, r * 0.68 * f + r * 0.1, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
        g.strokeStyle = d; g.lineWidth = r * 0.1; g.beginPath();
        for (let i = 0; i <= 10; i++) { const x = -r * 0.9 + (i / 10) * r * 1.8, y = r * 0.12 + (i % 2 ? r * 0.08 : -r * 0.04); i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      } else if (kind === 'fish') {
        const sw = Math.sin(tm * 4 + wob) * 0.2;
        g.fillStyle = d; g.beginPath(); g.moveTo(r * 0.45, 0); g.lineTo(r * 1.0, -r * (0.45 + sw * 0.5)); g.lineTo(r * 0.85, 0); g.lineTo(r * 1.0, r * (0.45 - sw * 0.5)); g.closePath(); g.fill();
        const gr = g.createLinearGradient(0, -r * 0.5, 0, r * 0.5); gr.addColorStop(0, l); gr.addColorStop(0.4, c); gr.addColorStop(1, d);
        g.fillStyle = gr; g.beginPath(); g.ellipse(-r * 0.08, 0, r * 0.68, r * 0.5, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = d; g.beginPath(); g.moveTo(-r * 0.2, -r * 0.45); g.quadraticCurveTo(r * 0.1, -r * 0.85, r * 0.35, -r * 0.35); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = r * 0.07; g.beginPath(); g.moveTo(r * 0.05, -r * 0.4); g.quadraticCurveTo(-r * 0.12, 0, r * 0.05, r * 0.4); g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(-r * 0.42, -r * 0.08, r * 0.15, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#10202a'; g.beginPath(); g.arc(-r * 0.45, -r * 0.08, r * 0.08, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    },
    pearl(g, px, py, r) {
      g.save(); g.translate(px, py);
      g.fillStyle = 'rgba(0,40,50,0.28)'; g.beginPath(); g.ellipse(0, r * 0.62, r * 0.85, r * 0.3, 0, 0, Math.PI * 2); g.fill();
      // an open shell cradling the pearl
      g.fillStyle = '#f6e6d8'; g.beginPath(); g.ellipse(0, r * 0.3, r * 0.95, r * 0.45, 0, 0, Math.PI); g.fill();
      g.strokeStyle = '#c9a98f'; g.lineWidth = r * 0.06; g.stroke();
      const hue = (this.time * 80) % 360;
      const gr = g.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.05, 0, 0, r * 0.62);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, `hsl(${hue}, 70%, 88%)`); gr.addColorStop(1, `hsl(${(hue + 120) % 360}, 45%, 70%)`);
      g.shadowColor = '#ffffff'; g.shadowBlur = r * 0.6;
      g.fillStyle = gr; g.beginPath(); g.arc(0, -r * 0.05, r * 0.58, 0, Math.PI * 2); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(-r * 0.2, -r * 0.28, r * 0.15, r * 0.09, -0.6, 0, Math.PI * 2); g.fill();
      g.restore();
    },
    stone(g, px, py, r, hits, hit) {
      g.save(); g.translate(px + (hit ? Math.sin(this.time * 80) * r * 0.06 : 0), py);
      g.fillStyle = 'rgba(0,30,40,0.3)'; g.beginPath(); g.ellipse(0, r * 0.6, r * 0.95, r * 0.32, 0, 0, Math.PI * 2); g.fill();
      const pts = [[-0.95, 0.3], [-0.85, -0.45], [-0.35, -0.85], [0.35, -0.9], [0.9, -0.4], [0.95, 0.35], [0.4, 0.7], [-0.45, 0.72]];
      const gr = g.createLinearGradient(0, -r, 0, r); gr.addColorStop(0, hits > 2 ? '#7d7f84' : hits > 1 ? '#9a9ca0' : '#b7b8b3'); gr.addColorStop(1, hits > 2 ? '#3e4044' : '#5e6064');
      this.poly(g, pts.map(([x, y]) => [x * r, y * r]), gr, 'rgba(30,30,30,0.5)', r * 0.06);
      // barnacles: one ring per hit left
      const spots = [[-0.4, -0.25], [0.35, -0.35], [0.05, 0.2], [-0.5, 0.35], [0.55, 0.25], [0, -0.6]];
      for (let i = 0; i < Math.min(spots.length, hits * 2); i++) {
        const [x, y] = spots[i];
        g.fillStyle = '#e8e2d0'; g.beginPath(); g.arc(x * r, y * r, r * 0.17, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#6d675a'; g.beginPath(); g.arc(x * r, y * r, r * 0.07, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    },
    piece(g, sp, cx, cy, r) {
      if (sp.rock) return this.stone(g, cx, cy, r, sp.rock, sp.hit);
      if (sp.sp === 'pearl') return this.pearl(g, cx, cy, r);
      const kind = R.KINDS[sp.t];
      if (!kind) return sp.t === -1 ? this.pearl(g, cx, cy, r) : undefined;
      if (sp.sp === 'bomb') {
        // the bubble: a wobbling soap-bubble around the creature
        this.creature(g, kind, cx, cy, r * 0.8, sp.wob);
        const wob = this.reduced ? 0 : Math.sin(this.time * 5 + sp.wob) * r * 0.05;
        g.save();
        const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 1.05);
        gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.75, 'rgba(180,240,255,0.12)'); gr.addColorStop(1, 'rgba(220,255,255,0.75)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, r * 1.02 + wob, r * 1.02 - wob, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = `hsla(${(this.time * 90) % 360}, 80%, 85%, 0.8)`; g.lineWidth = r * 0.06; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(cx - r * 0.42, cy - r * 0.48, r * 0.18, r * 0.1, -0.7, 0, Math.PI * 2); g.fill();
        g.restore();
        return;
      }
      this.creature(g, kind, cx, cy, r, sp.wob);
      if (sp.sp === 'h' || sp.sp === 'v') {
        // the wave: a curl of white water through the creature, along its line
        g.save(); g.translate(cx, cy); if (sp.sp === 'v') g.rotate(Math.PI / 2);
        const s = this.reduced ? 0 : (this.time * 2 + sp.wob) % 1;
        g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = r * 0.16; g.lineCap = 'round';
        g.beginPath(); for (let i = 0; i <= 16; i++) { const x = -r * 1.05 + (i / 16) * r * 2.1, y = Math.sin(i * 0.9 - s * 6.28) * r * 0.12; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
        g.fillStyle = '#ffffff';
        for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * r * 1.18, 0); g.lineTo(sx * r * 0.9, -r * 0.2); g.lineTo(sx * r * 0.9, r * 0.2); g.fill(); }
        g.restore();
      }
    },

    draw(g, s, st) {
      const { W, H } = this;
      g.save();
      if (this.shake && !this.reduced) g.translate((Math.random() - 0.5) * this.shake * 10, (Math.random() - 0.5) * this.shake * 10);
      this.shore(g);
      if (!this.open) { g.restore(); return; }
      this.basin(g);
      // selection and hint glows under the pieces
      const glow = (x, y, col, a) => { this.poly(g, this.quad(x + 0.04, y + 0.04, x + 0.96, y + 0.96, 0.01), null, col, Math.max(2, this.S * 0.07)); g.globalAlpha = a; this.poly(g, this.quad(x + 0.04, y + 0.04, x + 0.96, y + 0.96, 0.01), col); g.globalAlpha = 1; };
      if (this.sel) glow(this.sel[0], this.sel[1], '#fff6c2', 0.25);
      if (this.cursor) { g.save(); g.setLineDash([6, 5]); g.lineDashOffset = -this.time * 20; this.poly(g, this.quad(this.cursor[0] + 0.02, this.cursor[1] + 0.02, this.cursor[0] + 0.98, this.cursor[1] + 0.98, 0.01), null, '#ffffff', Math.max(2, this.S * 0.05)); g.restore(); }
      if (this.hint) { const a = 0.15 + 0.15 * Math.sin(this.time * 6); glow(this.hint[0], this.hint[1], '#ffffff', a); glow(this.hint[2], this.hint[3], '#ffffff', a); }
      // pieces, back rows first
      const list = [...this.sprites.values()].sort((a, b) => a.y - b.y);
      g.save();
      // pieces falling in from above the pool are hidden until they enter it
      const top = this.P(0, -0.05)[1];
      g.beginPath(); g.rect(0, top - this.S * 0.6, W, H); g.clip();
      for (const sp of list) {
        let x = sp.x, y = sp.y;
        if (sp.bounce) { const b = sp.bounce, q = Math.sin((b.t / 0.3) * Math.PI) * 0.35; x = b.fx + (b.tx - b.fx) * q; y = b.fy + (b.ty - b.fy) * q; }
        const lift = 0.18 + (sp.land ? Math.sin((sp.land / 0.18) * Math.PI) * 0.08 : 0) + (this.reduced ? 0 : Math.sin(this.time * 1.6 + sp.wob) * 0.02);
        const p = this.P(x + 0.5, y + 0.5, lift);
        let r = p[2] * 0.4 * (sp.scale === undefined ? 1 : sp.scale);
        if (sp.land) r *= 1 + Math.sin((sp.land / 0.18) * Math.PI) * 0.06;
        if (sp.popping !== undefined) { const q = sp.popping / 0.22; r *= 1 + q * 0.4; g.globalAlpha = Math.max(0, 1 - q); }
        if (this.sel && Math.round(sp.x) === this.sel[0] && Math.round(sp.y) === this.sel[1] && !sp.a) r *= 1.08 + Math.sin(this.time * 8) * 0.03;
        this.piece(g, sp, p[0], p[1], r);
        if (sp.flash) { g.globalAlpha = sp.flash * 1.6; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(p[0], p[1], r * 1.2, 0, Math.PI * 2); g.fill(); }
        g.globalAlpha = 1;
      }
      g.restore();
      // special effects on top
      for (const b of this.beams) {
        const q = b.t / 0.45, a = 1 - q;
        g.save(); g.globalAlpha = a;
        if (b.kind === 'h' || b.kind === 'v') {
          const pts = b.kind === 'h' ? this.quad(-0.3, b.y + 0.2, this.w + 0.3, b.y + 0.8, 0.2) : this.quad(b.x + 0.2, -0.3, b.x + 0.8, this.h + 0.3, 0.2);
          g.shadowColor = '#bff8ff'; g.shadowBlur = 20;
          this.poly(g, pts, 'rgba(235,255,255,0.75)');
        } else if (b.kind === 'ring') {
          const p = this.P(b.x + 0.5, b.y + 0.5, 0.2);
          g.strokeStyle = '#e6fdff'; g.lineWidth = p[2] * 0.25 * a; g.beginPath(); g.ellipse(p[0], p[1], p[2] * (0.4 + q * 1.4), p[2] * (0.4 + q * 1.4) * this.c, 0, 0, Math.PI * 2); g.stroke();
        } else if (b.kind === 'pearl') {
          const p = this.P(b.x + 0.5, b.y + 0.5, 0.25);
          g.strokeStyle = '#fffbe6'; g.lineWidth = Math.max(1.5, this.S * 0.04); g.shadowColor = '#fff'; g.shadowBlur = 12;
          for (const [x, y] of b.to) { const e = this.P(x + 0.5, y + 0.5, 0.25); g.beginPath(); g.moveTo(p[0], p[1]); g.quadraticCurveTo((p[0] + e[0]) / 2 + Math.sin(x * 3 + y) * 20, (p[1] + e[1]) / 2 - 20, e[0], e[1]); g.stroke(); }
        }
        g.restore();
      }
      for (const p of this.parts) {
        const pp = this.P(p.u, p.v, p.h), a = 1 - p.life / p.max, r = Math.max(1, pp[2] * p.r);
        g.globalAlpha = a;
        if (p.kind === 'bubble') { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5; g.beginPath(); g.arc(pp[0], pp[1], r * 1.3, 0, Math.PI * 2); g.stroke(); }
        else if (p.kind === 'chip') { g.fillStyle = p.col; g.fillRect(pp[0] - r, pp[1] - r, r * 2, r * 1.4); }
        else { g.fillStyle = p.col; g.beginPath(); g.arc(pp[0], pp[1], r, 0, Math.PI * 2); g.fill(); }
      }
      g.globalAlpha = 1;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const t of this.texts) {
        const p = this.P(t.u, t.v, 0.6 + t.t * 1.2), a = Math.min(1, 2.2 - t.t * 2.4);
        g.globalAlpha = Math.max(0, a);
        g.font = `${Math.round(this.S * 0.42)}px 'Lilita One', sans-serif`;
        g.lineWidth = 4; g.strokeStyle = 'rgba(10,60,70,0.8)'; g.strokeText(t.s, p[0], p[1]);
        g.fillStyle = t.col; g.fillText(t.s, p[0], p[1]);
      }
      g.globalAlpha = 1;
      g.restore();
    },
    // a creature drawn on its own little canvas, for the HUD and menus
    icon(kind, size) {
      const c = document.createElement('canvas'); c.width = c.height = size * 2;
      const g = c.getContext('2d'); g.scale(2, 2);
      const keep = this.time; this.time = 0;
      if (kind === 'sand') { g.fillStyle = '#e6cf9a'; g.beginPath(); g.ellipse(size / 2, size / 2, size * 0.42, size * 0.34, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#b48a52'; for (let i = 0; i < 6; i++) g.fillRect(size * (0.3 + (i * 37 % 40) / 100), size * (0.35 + (i * 23 % 30) / 100), 2, 2); }
      else if (kind === 'rocks') this.stone(g, size / 2, size / 2, size * 0.4, 2, 0);
      else if (kind === 'pearl') this.pearl(g, size / 2, size / 2, size * 0.42);
      else this.creature(g, kind, size / 2, size / 2, size * 0.4, 0);
      this.time = keep;
      return c.toDataURL();
    },
    COL,
  };
  TP.View = V;
})();
