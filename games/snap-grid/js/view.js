// Snap Grid drawing: the synthwave night outside (pre-rendered), the arcade
// cabinet bezel and CRT screen around the board, bevelled glowing blocks
// (cached as sprites), and every animation: drops, line-clear waves,
// particles, score pops, the dragged shape and the tray deal.
(function () {
  const R = window.SnapGrid.Rules;
  const N = R.N;
  const GOLD = '#ffe66d';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function starPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const q = k % 2 ? r * 0.45 : r;
      ctx.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q);
    }
    ctx.closePath();
  }

  const View = {
    W: 0, H: 0, dpr: 1, ox: 0, oy: 0,
    L: null, sprites: new Map(), boardCache: null,
    stars: [],

    base(ctx) { const d = this.dpr; ctx.setTransform(d, 0, 0, d, this.ox * d, this.oy * d); },

    resize(bg, W, H, dpr) {
      this.W = W;
      this.H = H;
      this.dpr = dpr;
      this.sprites.clear();
      bg.width = Math.round(W * dpr);
      bg.height = Math.round(H * dpr);
      const ctx = bg.getContext('2d', { alpha: false });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.paintSky(ctx);
    },

    // ---------- outside: a synthwave night ----------
    horizon() { return Math.round(this.H * 0.6); },
    paintSky(ctx) {
      const { W, H } = this;
      const hy = this.horizon();
      const sky = ctx.createLinearGradient(0, 0, 0, hy);
      sky.addColorStop(0, '#07051a');
      sky.addColorStop(0.55, '#1c0b3f');
      sky.addColorStop(1, '#5a1650');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, hy);
      let seed = 11;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < (W * H) / 3500; i++) {
        const y = rnd() * hy * 0.8;
        ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`;
        const s = rnd() < 0.1 ? 2 : 1;
        ctx.fillRect(rnd() * W, y, s, s);
      }
      // striped sun
      const sr = Math.min(W, H) * 0.24;
      const sx = W * 0.5;
      const sy = hy - sr * 0.35;
      const sun = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
      sun.addColorStop(0, '#ffe66d');
      sun.addColorStop(0.5, '#ff8c42');
      sun.addColorStop(1, '#ff3864');
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = sun;
      ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
      ctx.fillStyle = '#3a0f45';
      for (let i = 0; i < 7; i++) {
        const y = sy + i * sr * 0.14;
        ctx.fillRect(sx - sr, y, sr * 2, 2 + i * 1.6);
      }
      ctx.restore();
      const glow = ctx.createRadialGradient(sx, sy, sr * 0.8, sx, sy, sr * 2.2);
      glow.addColorStop(0, 'rgba(255,90,120,0.35)');
      glow.addColorStop(1, 'rgba(255,90,120,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, hy);
      // two ranges of mountains with neon rims
      const range = (base, amp, col, rim, n, ph) => {
        ctx.beginPath();
        ctx.moveTo(0, hy);
        for (let i = 0; i <= n; i++) {
          const x = (i / n) * W;
          const y = base - Math.abs(Math.sin(i * 1.7 + ph) * amp) - (i % 2) * amp * 0.25;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(W, hy);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        ctx.strokeStyle = rim;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      };
      range(hy, H * 0.12, '#1a0838', 'rgba(157,78,221,0.7)', 14, 0.3);
      range(hy, H * 0.06, '#0d0526', 'rgba(45,226,230,0.6)', 22, 2.1);
      // floor
      const fl = ctx.createLinearGradient(0, hy, 0, H);
      fl.addColorStop(0, '#2a0838');
      fl.addColorStop(1, '#07051a');
      ctx.fillStyle = fl;
      ctx.fillRect(0, hy, W, H - hy);
      ctx.fillStyle = 'rgba(255,56,100,0.8)';
      ctx.fillRect(0, hy, W, 1.5);
    },
    // Perspective grid floor rolling towards you (drawn every frame).
    floor(ctx, time, still) {
      const { W, H } = this;
      const hy = this.horizon();
      ctx.strokeStyle = 'rgba(255,56,100,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const cx = W / 2;
      for (let i = -14; i <= 14; i++) {
        ctx.moveTo(cx + i * W * 0.012, hy);
        ctx.lineTo(cx + i * W * 0.16, H);
      }
      const off = still ? 0 : (time * 0.6) % 1;
      for (let k = 0; k < 12; k++) {
        const z = (k + 1 - off) / 12;
        const y = hy + (H - hy) * Math.pow(z, 2.4);
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
    },

    // ---------- layout ----------
    layout(mode) {
      const { W, H } = this;
      const wide = W > H * 1.15;
      let g, gx, gy, slots, slotR, trayVertical;
      if (mode === 'title') {
        if (wide) {
          g = Math.min(H * 0.6, W * 0.4);
          gx = W * 0.96 - g - g * 0.06;
          gy = (H - g) / 2;
        } else {
          g = Math.min(W * 0.7, H * 0.32);
          gx = (W - g) / 2;
          gy = H * 0.36;
        }
        slots = [];
        slotR = 0;
      } else if (wide) {
        g = Math.min(H * 0.76, W * 0.5);
        const trayW = g * 0.42;
        gx = (W - g - trayW - g * 0.08) / 2;
        gy = (H - g) / 2 + H * 0.04;
        slotR = Math.min(trayW * 0.5, g / 6);
        const tx = gx + g + g * 0.08 + trayW / 2;
        slots = [0, 1, 2].map((k) => [tx, gy + slotR + k * slotR * 2.1 - g * 0.02]);
        trayVertical = true;
      } else {
        g = Math.min(W * 0.9, H * 0.52);
        gx = (W - g) / 2;
        gy = Math.max(88, H * 0.13);
        slotR = Math.min(g / 6, (H - gy - g) * 0.3);
        const ty = gy + g + g * 0.06 + slotR * 1.15;
        slots = [-1, 0, 1].map((k) => [W / 2 + k * slotR * 2.2, ty]);
      }
      const cell = g / N;
      this.L = { mode, wide, g, gx, gy, cell, slots, slotR, mini: Math.min(cell * 0.62, (slotR * 1.6) / 5), trayVertical, bez: Math.max(10, g * 0.06) };
      this.boardCache = null;
      return this.L;
    },

    // ---------- cabinet + board ----------
    paintBoard() {
      const L = this.L;
      const d = this.dpr;
      const b = L.bez;
      const w = L.g + b * 2;
      const c = document.createElement('canvas');
      c.width = Math.ceil((w + 40) * d);
      c.height = Math.ceil((w + 40) * d);
      const ctx = c.getContext('2d');
      ctx.setTransform(d, 0, 0, d, 20 * d, 20 * d);
      // drop shadow onto the floor and the cabinet's outer glow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      rr(ctx, 6, 14, w, w, b);
      ctx.fill();
      // bezel: moulded plastic with a lit edge
      const bz = ctx.createLinearGradient(0, 0, w, w);
      bz.addColorStop(0, '#3a2470');
      bz.addColorStop(0.5, '#1a0f3d');
      bz.addColorStop(1, '#0c0726');
      ctx.fillStyle = bz;
      rr(ctx, 0, 0, w, w, b);
      ctx.fill();
      ctx.strokeStyle = 'rgba(45,226,230,0.9)';
      ctx.lineWidth = 2;
      rr(ctx, 1, 1, w - 2, w - 2, b);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      rr(ctx, b * 0.35, b * 0.35, w - b * 0.7, w - b * 0.7, b * 0.6);
      ctx.stroke();
      // the screen, sunk into the bezel
      const sx = b;
      const sy = b;
      const s = L.g;
      ctx.fillStyle = '#000';
      rr(ctx, sx - 3, sy - 3, s + 6, s + 6, 8);
      ctx.fill();
      const scr = ctx.createRadialGradient(sx + s / 2, sy + s / 2, s * 0.1, sx + s / 2, sy + s / 2, s * 0.75);
      scr.addColorStop(0, '#15123f');
      scr.addColorStop(1, '#07061c');
      ctx.fillStyle = scr;
      rr(ctx, sx, sy, s, s, 6);
      ctx.fill();
      // sockets
      const cell = L.cell;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const px = sx + x * cell;
        const py = sy + y * cell;
        const p = cell * 0.08;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        rr(ctx, px + p, py + p, cell - p * 2, cell - p * 2, cell * 0.12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(45,226,230,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(px + p * 1.5, py + cell - p * 2.4, cell - p * 3, 1);
      }
      // centre guides every 4 cells
      ctx.strokeStyle = 'rgba(255,56,100,0.18)';
      ctx.beginPath();
      ctx.moveTo(sx + s / 2, sy);
      ctx.lineTo(sx + s / 2, sy + s);
      ctx.moveTo(sx, sy + s / 2);
      ctx.lineTo(sx + s, sy + s / 2);
      ctx.stroke();
      // screws
      for (const [x, y] of [[b / 2, b / 2], [w - b / 2, b / 2], [b / 2, w - b / 2], [w - b / 2, w - b / 2]]) {
        ctx.fillStyle = '#0a0620';
        ctx.beginPath();
        ctx.arc(x, y, b * 0.16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x - b * 0.1, y - 0.75, b * 0.2, 1.5);
      }
      this.boardCache = c;
      // glass glare drawn over the top
      const gl = document.createElement('canvas');
      gl.width = Math.ceil(s * d);
      gl.height = Math.ceil(s * d);
      const g2 = gl.getContext('2d');
      g2.setTransform(d, 0, 0, d, 0, 0);
      const glare = g2.createLinearGradient(0, 0, s * 0.7, s * 0.9);
      glare.addColorStop(0, 'rgba(255,255,255,0.09)');
      glare.addColorStop(0.42, 'rgba(255,255,255,0.03)');
      glare.addColorStop(0.43, 'rgba(255,255,255,0)');
      g2.fillStyle = glare;
      rr(g2, 0, 0, s, s, 6);
      g2.fill();
      const vg = g2.createRadialGradient(s / 2, s / 2, s * 0.35, s / 2, s / 2, s * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.35)');
      g2.fillStyle = vg;
      g2.fillRect(0, 0, s, s);
      this.glare = gl;
    },

    // A bevelled, extruded, glowing block, cached per colour and size.
    sprite(color, s, gold, glow) {
      const key = `${color}|${Math.round(s * 4)}|${gold ? 1 : 0}|${glow ? 1 : 0}`;
      let c = this.sprites.get(key);
      if (c) return c;
      const d = this.dpr;
      const pad = Math.ceil(s * 0.4);
      c = document.createElement('canvas');
      c.width = Math.ceil((s + pad * 2) * d);
      c.height = Math.ceil((s + pad * 2) * d);
      c.pad = pad;
      const ctx = c.getContext('2d');
      ctx.setTransform(d, 0, 0, d, pad * d, pad * d);
      const col = gold ? GOLD : color;
      const m = s * 0.07;
      const r = s * 0.16;
      const depth = s * 0.09;
      if (glow) {
        ctx.shadowColor = col;
        ctx.shadowBlur = s * 0.45;
      }
      // extruded side (seen from slightly above)
      ctx.fillStyle = shade(col, -0.55);
      rr(ctx, m, m + depth, s - m * 2, s - m * 2 - depth * 0.4, r);
      ctx.fill();
      ctx.shadowBlur = 0;
      // top face
      const face = ctx.createLinearGradient(0, m, 0, s - m);
      face.addColorStop(0, shade(col, 0.35));
      face.addColorStop(0.5, col);
      face.addColorStop(1, shade(col, -0.2));
      ctx.fillStyle = face;
      rr(ctx, m, m, s - m * 2, s - m * 2 - depth, r);
      ctx.fill();
      // bevels
      const bw = s * 0.11;
      ctx.save();
      rr(ctx, m, m, s - m * 2, s - m * 2 - depth, r);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(m, m, s - m * 2, bw);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(m, m, bw, s);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(s - m - bw, m, bw, s);
      ctx.fillRect(m, s - m - depth - bw, s, bw);
      ctx.restore();
      // inner face and specular
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      rr(ctx, m + bw, m + bw, s - (m + bw) * 2, s - (m + bw) * 2 - depth, r * 0.6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      rr(ctx, m + bw * 1.1, m + bw * 0.5, s * 0.28, s * 0.07, s * 0.035);
      ctx.fill();
      if (gold) {
        starPath(ctx, s / 2, (s - depth) / 2, s * 0.24);
        ctx.fillStyle = '#7a5d00';
        ctx.fill();
        starPath(ctx, s / 2, (s - depth) / 2 - s * 0.02, s * 0.22);
        ctx.fillStyle = '#fff6c9';
        ctx.fill();
      }
      this.sprites.set(key, c);
      return c;
    },
    block(ctx, x, y, s, color, gold, alpha = 1, scale = 1) {
      const sp = this.sprite(color, s, gold, s > 18);
      const p = sp.pad;
      ctx.globalAlpha = alpha;
      if (scale !== 1) {
        const cx = x + s / 2;
        const cy = y + s / 2;
        ctx.drawImage(sp, cx - (s / 2 + p) * scale, cy - (s / 2 + p) * scale, (s + p * 2) * scale, (s + p * 2) * scale);
      } else ctx.drawImage(sp, x - p, y - p, s + p * 2, s + p * 2);
      ctx.globalAlpha = 1;
    },
    piece(ctx, p, x, y, s, alpha = 1) {
      p.cells.forEach(([cx, cy], k) => this.block(ctx, x + cx * s, y + cy * s, s, p.color, k === p.gold, alpha));
    },

    // ---------- the whole frame ----------
    // g: rules game; fx: animation state (see Game); o: { drag, ghost, kb, hint, time, settings, dim }
    draw(ctx, g, fx, o) {
      const L = this.L;
      if (!L) return;
      if (!this.boardCache) this.paintBoard();
      this.base(ctx);
      const { gx, gy, g: size, cell, bez } = L;
      ctx.drawImage(this.boardCache, gx - bez - 20, gy - bez - 20, this.boardCache.width / this.dpr, this.boardCache.height / this.dpr);

      // lines that the held shape would clear
      if (o.ghost && o.ghost.ok && o.ghost.lines) {
        const pulse = 0.18 + 0.1 * Math.sin(o.time * 10);
        ctx.fillStyle = `rgba(255,230,109,${pulse})`;
        o.ghost.lines.rows.forEach((r) => ctx.fillRect(gx, gy + r * cell, size, cell));
        o.ghost.lines.cols.forEach((c) => ctx.fillRect(gx + c * cell, gy, cell, size));
      }

      // settled blocks
      const over = fx.overT >= 0 ? fx.overT : -1;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const c = g.grid[y][x];
        if (!c) continue;
        const a = fx.cells[y * N + x];
        let scale = 1;
        let alpha = 1;
        if (a && a.t < 0.35) {
          const k = clamp(a.t / 0.35, 0, 1);
          scale = a.t < 0 ? 0 : 1.35 - 0.35 * easeBack(k);
          alpha = a.t < 0 ? 0 : clamp(k * 3, 0, 1);
        }
        if (alpha <= 0) continue;
        let color = c.color;
        if (over >= 0 && over * 9 > N - 1 - y + x * 0.25) color = '#3b3f74';
        this.block(ctx, gx + x * cell, gy + y * cell, cell, color, c.gold && color !== '#3b3f74', alpha, scale);
      }

      // ghost of the held shape
      if (o.ghost && o.settings.preview) {
        const gh = o.ghost;
        gh.p.cells.forEach(([cx, cy], k) => {
          const x = gh.x + cx;
          const y = gh.y + cy;
          if (x < 0 || y < 0 || x >= N || y >= N) return;
          if (gh.ok) this.block(ctx, gx + x * cell, gy + y * cell, cell, gh.p.color, k === gh.p.gold, 0.32);
          ctx.strokeStyle = gh.ok ? 'rgba(255,255,255,0.75)' : 'rgba(255,56,100,0.9)';
          ctx.lineWidth = 2;
          rr(ctx, gx + x * cell + cell * 0.1, gy + y * cell + cell * 0.1, cell * 0.8, cell * 0.8, cell * 0.14);
          ctx.stroke();
        });
      }
      // hint: the suggested spot pulses gold
      if (o.hint && o.hint.t < 4.5) {
        const h = o.hint;
        const p = g.tray[h.i];
        if (p && !p.used) {
          ctx.strokeStyle = `rgba(255,230,109,${0.55 + 0.45 * Math.sin(o.time * 8)})`;
          ctx.lineWidth = 3;
          ctx.setLineDash([cell * 0.2, cell * 0.12]);
          ctx.lineDashOffset = -o.time * 40;
          p.cells.forEach(([cx, cy]) => {
            rr(ctx, gx + (h.x + cx) * cell + 3, gy + (h.y + cy) * cell + 3, cell - 6, cell - 6, cell * 0.14);
            ctx.stroke();
          });
          ctx.setLineDash([]);
        }
      }

      // blocks in a line clear: flash, then burst (a wave out from the drop)
      for (const c of fx.clearing) {
        if (c.t < 0) {
          this.block(ctx, gx + c.x * cell, gy + c.y * cell, cell, c.color, c.gold, 1);
          const k = clamp(1 + c.t / c.delay0, 0, 1);
          ctx.fillStyle = `rgba(255,255,255,${0.7 * k})`;
          rr(ctx, gx + c.x * cell + cell * 0.08, gy + c.y * cell + cell * 0.08, cell * 0.84, cell * 0.78, cell * 0.14);
          ctx.fill();
        } else {
          const k = clamp(c.t / 0.25, 0, 1);
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = c.gold ? GOLD : '#ffffff';
          const e = cell * 0.4 * easeOut(k);
          rr(ctx, gx + c.x * cell - e + cell * 0.08, gy + c.y * cell - e + cell * 0.08, cell * 0.84 + e * 2, cell * 0.84 + e * 2, cell * 0.2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // screen glare and particles over the board
      ctx.drawImage(this.glare, gx, gy, size, size);
      this.particles(ctx, fx.parts);

      // tray
      L.slots.forEach(([sx, sy], i) => {
        const p = g.tray[i];
        const sel = o.kb && o.kb.on && o.kb.piece === i;
        const r = L.slotR * 0.92;
        // a pad on the control deck
        ctx.fillStyle = 'rgba(10,6,30,0.75)';
        rr(ctx, sx - r, sy - r, r * 2, r * 2, r * 0.25);
        ctx.fill();
        ctx.strokeStyle = sel ? '#ff3864' : o.hint && o.hint.i === i && o.hint.t < 4.5 ? '#ffe66d' : 'rgba(45,226,230,0.35)';
        ctx.lineWidth = sel ? 3 : 1.5;
        ctx.stroke();
        if (!p || p.used || (o.drag && o.drag.i === i) || (fx.ret && fx.ret.i === i)) return;
        const s = R.size(p);
        const m = L.mini;
        const deal = fx.deal[i] !== undefined ? clamp(fx.deal[i], 0, 1) : 1;
        const fits = R.anyFit(g.grid, p);
        const dx = (1 - easeOut(deal)) * this.W * 0.3 * (L.trayVertical ? 1 : 0);
        const dy = (1 - easeOut(deal)) * this.H * 0.25 * (L.trayVertical ? 0 : 1);
        const bob = sel ? Math.sin(o.time * 6) * 2 : 0;
        this.piece(ctx, p, sx - (s.w * m) / 2 + dx, sy - (s.h * m) / 2 + dy + bob, m, (fits ? 1 : 0.28) * Math.min(1, deal * 2));
      });
      // a shape flying back to its slot after a bad drop
      if (fx.ret) {
        const p = g.tray[fx.ret.i];
        const k = easeOut(clamp(fx.ret.t / 0.25, 0, 1));
        const [sx, sy] = L.slots[fx.ret.i];
        const s = R.size(p);
        const size2 = cell + (L.mini - cell) * k;
        const x = fx.ret.x + (sx - fx.ret.x) * k;
        const y = fx.ret.y + (sy - fx.ret.y) * k;
        this.piece(ctx, p, x - (s.w * size2) / 2, y - (s.h * size2) / 2, size2, 0.9);
      }
      // the shape in your hand
      if (o.drag) {
        const p = g.tray[o.drag.i];
        const s = R.size(p);
        const k = easeOut(clamp(o.drag.t / 0.12, 0, 1));
        const sz = L.mini + (cell - L.mini) * k;
        const lift = o.drag.lift * k;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        p.cells.forEach(([cx, cy]) => rr(ctx, o.drag.x - (s.w * sz) / 2 + cx * sz + sz * 0.25, o.drag.y - lift - (s.h * sz) / 2 + cy * sz + sz * 0.35, sz * 0.84, sz * 0.84, sz * 0.15));
        ctx.fill();
        this.piece(ctx, p, o.drag.x - (s.w * sz) / 2, o.drag.y - lift - (s.h * sz) / 2 - sz * 0.12 * k, sz, 0.95);
      }

      // score pops
      for (const p of fx.pops) {
        const k = p.t / 1.2;
        ctx.globalAlpha = 1 - clamp((k - 0.6) / 0.4, 0, 1);
        const sc = p.t < 0.2 ? easeBack(p.t / 0.2) : 1;
        ctx.save();
        ctx.translate(p.x, p.y - k * cell * 1.4);
        ctx.scale(sc, sc);
        ctx.font = `400 ${Math.round(cell * (p.big ? 0.75 : 0.5))}px Audiowide, 'Arial Black', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#07051a';
        ctx.strokeText(p.text, 0, 0);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    },

    particles(ctx, parts) {
      for (const q of parts) {
        const a = clamp(q.life / q.max, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = q.color;
        const s = q.s * (0.5 + a * 0.5);
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },

    // ---------- little canvases for the how-to-play cards ----------
    howArt(cv) {
      const ctx = cv.getContext('2d');
      const d = Math.min(2, window.devicePixelRatio || 1);
      cv.width = 160 * d;
      cv.height = 110 * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const s = 16;
      const ox = 20;
      const oy = 15;
      ctx.fillStyle = '#0b0926';
      ctx.fillRect(ox - 4, oy - 4, s * 5 + 8, s * 5 + 8);
      ctx.strokeStyle = 'rgba(45,226,230,0.6)';
      ctx.strokeRect(ox - 4, oy - 4, s * 5 + 8, s * 5 + 8);
      const save = this.dpr;
      this.dpr = d;
      const kind = cv.dataset.art;
      const put = (x, y, col, gold, a) => this.block(ctx, ox + x * s, oy + y * s, s, col, gold, a);
      if (kind === 'drop') {
        [[0, 4], [1, 4], [2, 4], [0, 3]].forEach(([x, y]) => put(x, y, '#9d4edd'));
        [[3, 1], [4, 1], [3, 2]].forEach(([x, y]) => put(x, y, '#2de2e6', false, 0.4));
        this.piece(ctx, { cells: [[0, 0], [1, 0], [0, 1]], color: '#2de2e6', gold: -1 }, 118, 30, 14);
        ctx.strokeStyle = '#ffe66d';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(116, 40);
        ctx.quadraticCurveTo(105, 20, 92, 34);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (kind === 'clear') {
        for (let x = 0; x < 5; x++) put(x, 2, x === 2 ? '#ff3864' : '#3ddc97');
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(ox, oy + 2 * s, s * 5, s);
        put(1, 4, '#f9c80e');
        put(3, 3, '#ff8c42');
        ctx.font = '400 15px Audiowide, sans-serif';
        ctx.fillStyle = '#ffe66d';
        ctx.fillText('+10', 118, 60);
      } else {
        for (let x = 0; x < 5; x++) put(x, 1, '#2de2e6', x === 3);
        ctx.font = '400 15px Audiowide, sans-serif';
        ctx.fillStyle = '#ffe66d';
        ctx.fillText('x2', 120, 44);
        put(2, 4, '#ff3864');
        put(3, 4, '#ff3864');
      }
      this.dpr = save;
    },
  };

  (window.SG = window.SG || {}).View = View;
})();
