// Trio Teahouse view: a low cedar tea table in afternoon light, with bamboo
// shadows drifting across it and a teapot steaming in the corner. Tiles are
// thick porcelain blocks stacked in layers; each shows a teahouse thing drawn
// in coloured glaze. Every tile springs toward where the rules say it is
// (table, tray, counter), so picks, undos and servings all animate the same way.
(function () {
  const R = TT.Rules;
  const INK = {
    teapot: '#2f55a4', cup: '#e4572e', leaf: '#3c9a4b', dumpling: '#c9a227', mooncake: '#a5622a', lotus: '#9b5de5', fan: '#d1345b', lantern: '#e63946',
    bamboo: '#5b8c2a', blossom: '#f06292', koi: '#f08a24', whisk: '#b08850', kettle: '#37474f', citrus: '#f5a623', honey: '#d4880f', bun: '#8d6e63',
  };
  const V = {
    W: 1, H: 1, T: 60, ox: 0, oy: 0, dz: 6, time: 0, reduced: false, disp: new Map(), parts: [], hover: null, shake: 0, cursor: null,
    trayY: 0, trayX: 0, slotW: 0, asideY: 0,
    // fit the table above the tray
    layout(W, H, s, top) {
      this.W = W; this.H = H;
      const portrait = H > W;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const t of s.tiles) { x0 = Math.min(x0, t.x); x1 = Math.max(x1, t.x + 2); y0 = Math.min(y0, t.y); y1 = Math.max(y1, t.y + 2); }
      this.bx0 = x0; this.by0 = y0;
      const trayH = Math.min(118, H * 0.17), toolsH = 64;
      // the tray: seven saucers in a row, the counter for set-aside tiles above it
      this.slotW = Math.min((W - 40) / R.TRAY, 74, portrait ? 60 : 74);
      this.trayX = W / 2 - (this.slotW * R.TRAY) / 2;
      this.trayY = H - toolsH - trayH / 2 - 10;
      this.trayH = trayH;
      this.asideY = this.trayY - trayH / 2 - this.slotW * 0.55;
      this.tableBottom = this.asideY - this.slotW * 0.55 - 22;
      const aw = W - 24, ah = this.tableBottom - top - 14;
      const wU = x1 - x0, hU = y1 - y0;
      // a unit is half a tile wide; tiles are a bit taller than wide
      this.u = Math.min(aw / (wU + 0.6), ah / (hU * 1.18 + 0.9), 46);
      this.T = this.u * 2; this.dz = this.u * 0.28;
      this.ox = W / 2 - (wU * this.u) / 2;
      this.oy = top + 10 + (ah - hU * this.u * 1.18) / 2 + this.dz * 2;
      this.leaves = null;
    },
    tablePos(t) { return { x: this.ox + (t.x - this.bx0) * this.u - t.z * this.dz, y: this.oy + (t.y - this.by0) * this.u * 1.18 - t.z * this.dz * 1.2, w: this.T, h: this.T * 1.18 }; },
    slotPos(i) { const w = this.slotW * 0.86; return { x: this.trayX + i * this.slotW + (this.slotW - w) / 2, y: this.trayY - w * 0.6, w, h: w * 1.18 }; },
    asidePos(i) { const w = this.slotW * 0.8; return { x: this.W / 2 + (i - 1) * w * 1.1 - w / 2, y: this.asideY - w * 0.5, w, h: w * 1.18 }; },
    // the tile at a screen point, topmost first
    tileAt(s, px, py) {
      const list = s.tiles.filter((t) => !t.gone).map((t) => ({ t, d: this.disp.get(t.id) })).filter((o) => o.d);
      list.sort((a, b) => this.order(b.t) - this.order(a.t));
      for (const { t, d } of list) if (px >= d.x && px <= d.x + d.w && py >= d.y && py <= d.y + d.h) return t;
      return null;
    },
    order(t) { return t.inTray ? 1e6 : t.aside ? 2e6 : t.z * 1e4 + t.y * 50 + t.x; },
    // springs every tile toward its home; tiles being served gather and pop
    sync(s, dt, snap) {
      const traySlot = new Map(s.tray.map((id, i) => [id, i])), asideSlot = new Map(s.aside.map((id, i) => [id, i]));
      const k = snap || this.reduced ? 1 : 1 - Math.pow(0.0005, dt);
      const spring = (d, target) => { for (const key of ['x', 'y', 'w', 'h']) d[key] += (target[key] - d[key]) * k; };
      for (const t of s.tiles) {
        let d = this.disp.get(t.id);
        if (t.gone) {
          if (!d || d.serve === undefined || snap) { this.disp.delete(t.id); continue; }
          d.serve += dt;
          if (d.serve < 0) { spring(d, d.home); continue; }
          if (!d.puffed) { d.puffed = true; this.steam(d.x + d.w / 2, d.y, 2); this.burst(d.x + d.w / 2, d.y + d.h / 2, this.INK[t.k], 5); }
          d.y -= dt * 90; d.a = Math.max(0, 1 - d.serve / 0.4);
          if (d.serve > 0.4) this.disp.delete(t.id);
          continue;
        }
        const target = t.inTray ? this.slotPos(traySlot.get(t.id)) : t.aside ? this.asidePos(asideSlot.get(t.id)) : this.tablePos(t);
        if (!d) { d = Object.assign({ a: 1 }, target); this.disp.set(t.id, d); }
        d.a = 1; delete d.serve; delete d.puffed;
        spring(d, target);
        d.home = target;
      }
    },
    // three alike gather on their saucers, then lift off in a puff of steam
    serve(ids, slot) {
      ids.forEach((id, i) => { const d = this.disp.get(id); if (d) { d.serve = -0.24 - i * 0.03; d.home = this.slotPos(Math.max(0, slot - 2 + i)); } });
    },
    burst(x, y, col, n, kind) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 120;
        this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, max: 0.6 + Math.random() * 0.5, col, kind: kind || 'petal', r: 3 + Math.random() * 4, rot: Math.random() * 6 });
      }
    },
    steam(x, y, n) { for (let i = 0; i < n; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 20, vy: -50 - Math.random() * 40, life: 0, max: 1 + Math.random() * 0.6, col: '#ffffff', kind: 'steam', r: 8 + Math.random() * 8, rot: 0 }); },
    tick(dt) {
      this.time += dt;
      for (const p of this.parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'petal') { p.vy += 160 * dt; p.vx *= 0.98; p.rot += dt * 4; } else { p.r += dt * 14; p.vx *= 0.97; } }
      this.parts = this.parts.filter((p) => p.life < p.max);
      this.shake = Math.max(0, this.shake - dt * 3);
    },

    // ---------- the table ----------
    room(g) {
      const { W, H } = this;
      // cedar planks
      const wood = g.createLinearGradient(0, 0, 0, H);
      wood.addColorStop(0, '#b9834f'); wood.addColorStop(1, '#8a5a32');
      g.fillStyle = wood; g.fillRect(0, 0, W, H);
      const plank = Math.max(60, W / 9);
      for (let x = 0; x < W + plank; x += plank) {
        g.fillStyle = (x / plank) % 2 ? 'rgba(255,220,170,0.05)' : 'rgba(60,30,10,0.05)'; g.fillRect(x, 0, plank, H);
        g.strokeStyle = 'rgba(50,25,8,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
        g.strokeStyle = 'rgba(70,35,10,0.12)'; g.lineWidth = 1.2;
        for (let i = 0; i < 5; i++) { const gx = x + plank * (0.15 + i * 0.17); g.beginPath(); for (let y = 0; y <= H; y += 40) g.lineTo(gx + Math.sin(y * 0.01 + i + x) * 6, y); g.stroke(); }
      }
      // a woven runner under the tiles
      const rx = this.ox - this.u * 1.2, ry = this.oy - this.dz * 6 - this.u * 0.8;
      const rw = this.W - rx * 2, rh = this.tableBottom + 8 - ry;
      if (rh > 40) {
        g.fillStyle = '#d9c7a0'; g.fillRect(rx, ry, rw, rh);
        g.strokeStyle = 'rgba(140,110,60,0.25)'; g.lineWidth = 1;
        for (let y = ry + 4; y < ry + rh; y += 6) { g.beginPath(); g.moveTo(rx, y); g.lineTo(rx + rw, y); g.stroke(); }
        g.fillStyle = '#5e7d4f'; g.fillRect(rx, ry, 8, rh); g.fillRect(rx + rw - 8, ry, 8, rh);
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(rx, ry, rw, rh);
      }
      // the teapot in the corner, steaming
      if (W > 640) this.cornerPot(g, W - 70, H * 0.3);
    },
    cornerPot(g, x, y) {
      g.save(); g.translate(x, y);
      g.fillStyle = 'rgba(40,20,5,0.3)'; g.beginPath(); g.ellipse(4, 40, 52, 14, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4a5d7a'; g.beginPath(); g.ellipse(0, 10, 44, 34, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5e7698'; g.beginPath(); g.ellipse(-8, 0, 26, 18, -0.3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#3a4a62'; g.lineWidth = 8; g.beginPath(); g.moveTo(40, 6); g.quadraticCurveTo(66, -2, 70, -20); g.stroke();
      g.lineWidth = 6; g.beginPath(); g.arc(-44, 6, 16, Math.PI * 0.6, Math.PI * 1.45); g.stroke();
      g.fillStyle = '#3a4a62'; g.beginPath(); g.ellipse(0, -22, 18, 6, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(0, -28, 5, 0, Math.PI * 2); g.fill();
      g.restore();
      if (!this.reduced && Math.random() < 0.08) this.parts.push({ x: x + 70, y: y - 22, vx: 6, vy: -30, life: 0, max: 2, col: '#fff', kind: 'steam', r: 5, rot: 0 });
    },
    // drifting bamboo-leaf shadows over everything
    shadows(g) {
      if (this.reduced) return;
      if (!this.leaves) { const r = R.rng(9); this.leaves = Array.from({ length: 14 }, () => ({ x: r() * this.W, y: r() * this.H * 0.8, a: r() * 6, s: 0.6 + r() * 0.8 })); }
      g.save(); g.fillStyle = 'rgba(30,40,10,0.09)';
      for (const l of this.leaves) {
        g.save(); g.translate(l.x + Math.sin(this.time * 0.4 + l.a) * 14, l.y + Math.cos(this.time * 0.3 + l.a) * 6); g.rotate(l.a + Math.sin(this.time * 0.5 + l.a) * 0.1);
        g.beginPath(); g.ellipse(0, 0, 60 * l.s, 9 * l.s, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      g.restore();
    },
    tray(g, s) {
      const x = this.trayX - 18, w = this.slotW * R.TRAY + 36, y = this.trayY - this.trayH / 2, h = this.trayH;
      g.save();
      g.fillStyle = 'rgba(40,20,5,0.35)'; this.round(g, x + 4, y + 8, w, h, 18); g.fill();
      const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#3b2416'); gr.addColorStop(1, '#22140b');
      g.fillStyle = gr; this.round(g, x, y, w, h, 18); g.fill();
      g.strokeStyle = '#c99a5b'; g.lineWidth = 3; this.round(g, x + 6, y + 6, w - 12, h - 12, 13); g.stroke();
      // saucers
      const full = s.tray.length;
      for (let i = 0; i < R.TRAY; i++) {
        const cx = this.trayX + (i + 0.5) * this.slotW, cy = this.trayY + this.slotW * 0.12;
        g.fillStyle = i >= R.TRAY - 2 && full >= R.TRAY - 2 ? `rgba(230,80,60,${0.35 + 0.2 * Math.sin(this.time * 6)})` : '#f1ead8';
        g.beginPath(); g.ellipse(cx, cy, this.slotW * 0.42, this.slotW * 0.2, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#9fb8c8'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, this.slotW * 0.3, this.slotW * 0.13, 0, 0, Math.PI * 2); g.stroke();
      }
      g.restore();
      // the counter for set-aside tiles
      if (s.aside.length) {
        const w2 = this.slotW * 0.8 * 3.6, x2 = this.W / 2 - w2 / 2, y2 = this.asideY + this.slotW * 0.45;
        g.fillStyle = '#6b4226'; this.round(g, x2, y2, w2, 12, 6); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x2 + 6, y2 + 12, w2 - 12, 4);
      }
    },
    round(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); },

    // ---------- a porcelain tile ----------
    tile(g, t, d, free, hint) {
      const { x, y, w, h } = d, th = w * 0.16, r = w * 0.14;
      g.save(); g.globalAlpha = d.a === undefined ? 1 : d.a;
      // thickness (the side you see below and to the right)
      g.fillStyle = 'rgba(30,15,5,0.28)'; this.round(g, x + th * 0.9, y + th * 1.4, w, h, r); g.fill();
      g.fillStyle = '#b9c7b4'; this.round(g, x + th * 0.45, y + th * 0.75, w, h, r); g.fill();
      g.fillStyle = '#d5dfcf'; this.round(g, x + th * 0.2, y + th * 0.35, w, h, r); g.fill();
      // glazed top
      const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#fbfdf6'); gr.addColorStop(1, '#e3ecd9');
      g.fillStyle = gr; this.round(g, x, y, w, h, r); g.fill();
      g.strokeStyle = 'rgba(120,140,110,0.6)'; g.lineWidth = 1.2; this.round(g, x + w * 0.07, y + w * 0.07, w * 0.86, h - w * 0.14, r * 0.7); g.stroke();
      this.symbol(g, t.k, x + w / 2, y + h / 2, w * 0.36);
      if (!free) { g.fillStyle = 'rgba(70,45,20,0.42)'; this.round(g, x, y, w, h, r); g.fill(); }
      if (hint) { g.strokeStyle = `rgba(255,214,90,${0.6 + 0.4 * Math.sin(this.time * 8)})`; g.lineWidth = 3; this.round(g, x - 2, y - 2, w + 4, h + 4, r + 2); g.stroke(); }
      g.restore();
    },
    // the glazed pictures
    symbol(g, k, cx, cy, r) {
      const c = INK[k];
      g.save(); g.translate(cx, cy);
      g.fillStyle = c; g.strokeStyle = c; g.lineWidth = r * 0.14; g.lineCap = 'round'; g.lineJoin = 'round';
      const P = (pts, fill = true) => { g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a * r, b * r) : g.moveTo(a * r, b * r))); g.closePath(); fill ? g.fill() : g.stroke(); };
      const circ = (a, b, rr, fill = true) => { g.beginPath(); g.arc(a * r, b * r, rr * r, 0, Math.PI * 2); fill ? g.fill() : g.stroke(); };
      const ell = (a, b, rx, ry, rot = 0, fill = true) => { g.beginPath(); g.ellipse(a * r, b * r, rx * r, ry * r, rot, 0, Math.PI * 2); fill ? g.fill() : g.stroke(); };
      const light = 'rgba(255,255,255,0.55)';
      switch (k) {
        case 'teapot':
          ell(0, 0.15, 0.62, 0.5); ell(0, -0.42, 0.3, 0.1); circ(0, -0.55, 0.1);
          g.beginPath(); g.moveTo(0.55, 0.05); g.quadraticCurveTo(0.95, -0.05, 0.95, -0.45); g.stroke();
          g.beginPath(); g.arc(-0.66 * r, 0.12 * r, 0.24 * r, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
          g.fillStyle = light; ell(-0.2, 0, 0.18, 0.1, -0.4); break;
        case 'cup':
          P([[-0.55, -0.3], [0.55, -0.3], [0.42, 0.45], [-0.42, 0.45]]);
          g.fillStyle = '#f7d6c9'; ell(0, -0.3, 0.55, 0.12);
          g.lineWidth = r * 0.08; g.strokeStyle = c;
          for (const sx of [-0.2, 0.15]) { g.beginPath(); g.moveTo(sx * r, -0.5 * r); g.bezierCurveTo((sx - 0.15) * r, -0.7 * r, (sx + 0.15) * r, -0.8 * r, sx * r, -1 * r); g.stroke(); }
          g.fillStyle = c; ell(0, 0.6, 0.62, 0.1); break;
        case 'leaf':
          g.beginPath(); g.moveTo(-0.7 * r, 0.6 * r); g.quadraticCurveTo(-0.7 * r, -0.6 * r, 0.75 * r, -0.7 * r); g.quadraticCurveTo(0.6 * r, 0.6 * r, -0.7 * r, 0.6 * r); g.fill();
          g.strokeStyle = '#d7f0cf'; g.lineWidth = r * 0.07; g.beginPath(); g.moveTo(-0.6 * r, 0.5 * r); g.lineTo(0.55 * r, -0.55 * r); g.stroke();
          for (const f of [-0.25, 0.05, 0.3]) { g.beginPath(); g.moveTo(f * r, -f * r); g.lineTo((f - 0.25) * r, (-f - 0.25) * r); g.moveTo(f * r, -f * r); g.lineTo((f + 0.22) * r, (-f + 0.22) * r); g.stroke(); }
          break;
        case 'dumpling':
          g.beginPath(); g.moveTo(-0.8 * r, 0.35 * r); g.quadraticCurveTo(-0.6 * r, -0.65 * r, 0, -0.55 * r); g.quadraticCurveTo(0.6 * r, -0.65 * r, 0.8 * r, 0.35 * r); g.quadraticCurveTo(0, 0.6 * r, -0.8 * r, 0.35 * r); g.fill();
          g.strokeStyle = '#fff4cc'; g.lineWidth = r * 0.07;
          for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 0.18 * r, -0.5 * r); g.lineTo(i * 0.22 * r, -0.15 * r); g.stroke(); }
          break;
        case 'mooncake':
          circ(0, 0, 0.75); g.fillStyle = '#c98a4e'; circ(0, 0, 0.55);
          g.strokeStyle = c; g.lineWidth = r * 0.07; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * 0.62 * r, Math.sin(a) * 0.62 * r, 0.1 * r, 0, Math.PI * 2); g.stroke(); }
          g.strokeStyle = '#7b4419'; g.beginPath(); g.moveTo(-0.25 * r, -0.2 * r); g.lineTo(0.25 * r, -0.2 * r); g.moveTo(0, -0.35 * r); g.lineTo(0, 0.35 * r); g.moveTo(-0.25 * r, 0.2 * r); g.lineTo(0.25 * r, 0.2 * r); g.stroke(); break;
        case 'lotus':
          for (const [a, s] of [[-0.9, 0.8], [0.9, 0.8], [-0.45, 0.95], [0.45, 0.95], [0, 1]]) { g.save(); g.rotate(a * 0.6); ell(0, -0.3 * s, 0.22, 0.5 * s); g.restore(); }
          g.fillStyle = '#e0c3ff'; ell(0, -0.25, 0.12, 0.35); g.fillStyle = '#6a3fb0'; ell(0, 0.5, 0.7, 0.12); break;
        case 'fan':
          g.beginPath(); g.moveTo(0, 0.55 * r); g.arc(0, 0.55 * r, 1.05 * r, Math.PI * 1.15, Math.PI * 1.85); g.closePath(); g.fill();
          g.fillStyle = '#ffe0a3'; g.beginPath(); g.moveTo(0, 0.55 * r); g.arc(0, 0.55 * r, 0.5 * r, Math.PI * 1.15, Math.PI * 1.85); g.closePath(); g.fill();
          g.strokeStyle = '#8f1d3a'; g.lineWidth = r * 0.05; for (let i = 0; i <= 6; i++) { const a = Math.PI * (1.15 + (0.7 * i) / 6); g.beginPath(); g.moveTo(0, 0.55 * r); g.lineTo(Math.cos(a) * 1.05 * r, 0.55 * r + Math.sin(a) * 1.05 * r); g.stroke(); }
          break;
        case 'lantern':
          g.fillRect(-0.08 * r, -0.95 * r, 0.16 * r, 0.25 * r); ell(0, 0, 0.55, 0.7);
          g.fillStyle = '#3a1d10'; g.fillRect(-0.35 * r, -0.72 * r, 0.7 * r, 0.12 * r); g.fillRect(-0.35 * r, 0.62 * r, 0.7 * r, 0.12 * r);
          g.strokeStyle = '#ffb3a7'; g.lineWidth = r * 0.05; for (const f of [-0.3, 0, 0.3]) { g.beginPath(); g.ellipse(0, 0, Math.abs(f) * r + 0.05 * r, 0.65 * r, 0, 0, Math.PI * 2); g.stroke(); }
          g.strokeStyle = '#f5c542'; g.lineWidth = r * 0.06; g.beginPath(); g.moveTo(0, 0.75 * r); g.lineTo(0, 1.0 * r); g.stroke(); break;
        case 'bamboo':
          for (const [sx, h] of [[-0.3, 1], [0.3, 0.8]]) {
            g.fillStyle = c; g.fillRect((sx - 0.15) * r, -0.9 * h * r, 0.3 * r, 1.8 * h * r);
            g.fillStyle = '#2f5a14'; for (let i = -1; i <= 1; i++) g.fillRect((sx - 0.18) * r, i * 0.5 * h * r - 0.04 * r, 0.36 * r, 0.08 * r);
          }
          g.fillStyle = '#7fb84a'; g.save(); g.translate(0.45 * r, -0.4 * r); g.rotate(-0.6); ell(0, 0, 0.35, 0.1); g.restore(); break;
        case 'blossom':
          for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; circ(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.33); }
          g.fillStyle = '#fff0f5'; circ(0, 0, 0.2); g.fillStyle = '#c2185b'; for (let i = 0; i < 5; i++) { const a = (i * 2 * Math.PI) / 5; circ(Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.05); } break;
        case 'koi':
          g.beginPath(); g.moveTo(-0.75 * r, 0); g.quadraticCurveTo(-0.2 * r, -0.55 * r, 0.45 * r, -0.05 * r); g.lineTo(0.85 * r, -0.4 * r); g.lineTo(0.75 * r, 0.05 * r); g.lineTo(0.85 * r, 0.4 * r); g.lineTo(0.45 * r, 0.1 * r); g.quadraticCurveTo(-0.2 * r, 0.5 * r, -0.75 * r, 0); g.fill();
          g.fillStyle = '#ffffff'; ell(-0.15, -0.05, 0.2, 0.14); ell(0.2, 0.08, 0.12, 0.09);
          g.fillStyle = '#222'; circ(-0.52, -0.08, 0.06); break;
        case 'whisk':
          g.fillRect(-0.12 * r, 0.1 * r, 0.24 * r, 0.85 * r);
          g.lineWidth = r * 0.05; for (let i = -4; i <= 4; i++) { g.beginPath(); g.moveTo(i * 0.03 * r, 0.12 * r); g.quadraticCurveTo(i * 0.2 * r, -0.4 * r, i * 0.09 * r, -0.85 * r); g.stroke(); }
          break;
        case 'kettle':
          ell(0, 0.2, 0.7, 0.5); g.lineWidth = r * 0.12; g.beginPath(); g.arc(0, -0.15 * r, 0.55 * r, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
          g.beginPath(); g.moveTo(0.6 * r, 0.1 * r); g.lineTo(0.95 * r, -0.2 * r); g.stroke();
          g.fillStyle = '#607d8b'; for (let i = -2; i <= 2; i++) for (let j = 0; j < 2; j++) circ(i * 0.22, 0.1 + j * 0.22, 0.05); break;
        case 'citrus':
          circ(0, 0, 0.75); g.fillStyle = '#ffe9a8'; circ(0, 0, 0.6);
          g.fillStyle = c; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 0.52 * r, a + 0.08, a + Math.PI / 4 - 0.08); g.closePath(); g.fill(); }
          g.fillStyle = '#fff6d8'; circ(0, 0, 0.08); break;
        case 'honey':
          P([[-0.5, -0.35], [0.5, -0.35], [0.6, 0.6], [-0.6, 0.6]]);
          g.fillStyle = '#6b3d10'; g.fillRect(-0.55 * r, -0.62 * r, 1.1 * r, 0.24 * r);
          g.fillStyle = '#ffd36a'; ell(-0.1, 0.15, 0.22, 0.28);
          g.strokeStyle = '#6b3d10'; g.lineWidth = r * 0.06; g.beginPath(); g.moveTo(0.5 * r, -0.7 * r); g.lineTo(0.85 * r, -1 * r); g.stroke(); break;
        case 'bun':
          g.fillStyle = '#f7efe3'; ell(0, 0.1, 0.78, 0.6); g.strokeStyle = c; g.lineWidth = r * 0.06; ell(0, 0.1, 0.78, 0.6, 0, false);
          g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.moveTo(0, -0.1 * r); g.lineTo(Math.cos(a) * 0.3 * r, -0.1 * r + Math.sin(a) * 0.18 * r); } g.stroke();
          g.fillStyle = '#e63946'; circ(0, -0.1, 0.09); break;
      }
      g.restore();
    },

    draw(g, s, info) {
      g.save();
      if (this.shake && !this.reduced) g.translate((Math.random() - 0.5) * this.shake * 8, 0);
      this.room(g);
      if (s) {
        this.tray(g, s);
        const list = s.tiles.filter((t) => this.disp.has(t.id)).sort((a, b) => this.order(a) - this.order(b));
        const hint = info && info.hint;
        for (const t of list) {
          const d = this.disp.get(t.id);
          const free = t.gone || t.inTray || R.isFree(s, t);
          let dd = d;
          if (this.hover === t.id && free && !t.inTray && !t.gone) dd = Object.assign({}, d, { y: d.y - 4 });
          this.tile(g, t, dd, free, hint && hint.includes(t.id));
        }
        if (this.cursor !== null) { const d = this.disp.get(this.cursor); if (d) { g.save(); g.setLineDash([6, 4]); g.lineDashOffset = -this.time * 20; g.strokeStyle = '#fff'; g.lineWidth = 3; this.round(g, d.x - 4, d.y - 4, d.w + 8, d.h + 8, 10); g.stroke(); g.restore(); } }
      }
      this.shadows(g);
      for (const p of this.parts) {
        const a = 1 - p.life / p.max;
        if (p.kind === 'steam') { g.fillStyle = `rgba(255,255,255,${0.25 * a})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
        else { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = a; g.fillStyle = p.col; g.beginPath(); g.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      }
      g.restore();
    },
    // a symbol on a little tile image, for menus and HUD
    icon(k, size) {
      const c = document.createElement('canvas'); c.width = c.height = size * 2;
      const g = c.getContext('2d'); g.scale(2, 2);
      this.tile(g, { k }, { x: size * 0.08, y: size * 0.02, w: size * 0.78, h: size * 0.86 }, true, false);
      return c.toDataURL();
    },
    INK,
  };
  TT.View = V;
})();
