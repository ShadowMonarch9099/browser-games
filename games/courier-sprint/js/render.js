// Courier Sprint renderer: a behind-the-courier camera down a city street,
// projected by hand onto a 2D canvas. Units are metres: x across the street
// (lanes at -2.4/0/2.4), y up, z ahead of the courier. The street is laid out
// in 64 m blocks: 50 m of buildings, then a crossing with zebra stripes,
// traffic lights and a side street. Ground is drawn first (it is flat), then
// every standing thing — buildings, street furniture, obstacles, the courier —
// sorted far to near.
(function (root) {
  'use strict';
  const LANE = 2.4, ROADW = 4.3, WALK = 8.2, CAM_BACK = 6.2, CAM_H = 4.4, ZFAR = 170, SEG = 4;
  const BLOCK = 64, BUILT = 50;

  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, k) => { k = k === undefined ? 1 : k; return `rgb(${(c[0] * k) | 0},${(c[1] * k) | 0},${(c[2] * k) | 0})`; };
  const hash = (n) => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
  const hash2 = (a, b) => hash(Math.imul(a, 374761393) + Math.imul(b, 668265263));

  // day themes: sky, fog/haze, light level, window glow, street lamps
  const THEMES = [
    { name: 'Morning', top: '#7fb4e6', bot: '#ffe0c2', fog: '#e9dccb', sun: '#fff1d6', light: 1.0, glow: 0.08, lamps: false, asphalt: '#4c5260', walk: '#b9b4ab' },
    { name: 'Noon', top: '#2f8ae0', bot: '#bfe3ff', fog: '#cfe2f0', sun: '#ffffff', light: 1.08, glow: 0.04, lamps: false, asphalt: '#474d5a', walk: '#c4c0b8' },
    { name: 'Sunset', top: '#3b2f6b', bot: '#ff9a62', fog: '#e7a684', sun: '#ffd27a', light: 0.82, glow: 0.35, lamps: true, asphalt: '#3e3d4f', walk: '#9d8e88' },
    { name: 'Night', top: '#070b1f', bot: '#1d2a55', fog: '#1b2244', sun: '#e8eeff', light: 0.42, glow: 0.62, lamps: true, asphalt: '#23263a', walk: '#4d4f61' },
  ].map((t) => Object.assign({}, t, { cTop: hex(t.top), cBot: hex(t.bot), cFog: hex(t.fog), cAsph: hex(t.asphalt), cWalk: hex(t.walk) }));
  const FACADES = ['#c4583f', '#d9c3a0', '#5f8f8b', '#e8e0cf', '#8f97a3', '#b98a5e', '#6c6f8f', '#d27f4f'].map(hex);

  const Rd = {
    W: 0, H: 0, v: null, sky: [], skyline: [], vignette: null, parts: [], themeA: 0, themeB: 0, themeT: 0,
    blocks: new Map(),

    resize(W, H) {
      this.W = W; this.H = H;
      const portrait = W < H;
      // high camera: the street ahead stays visible above the courier's head
      const s0 = Math.min((portrait ? 0.86 : 0.6) * Math.min(W, H * 1.3) / (LANE * 3), 0.6 * H / CAM_H);
      let hy = 0.82 * H - CAM_H * s0;
      hy = Math.max(0.18 * H, Math.min(0.5 * H, hy));
      this.v = { cx: W / 2, hy, f: s0 * CAM_BACK, s0 };
      this.sky = []; this.skyline = [];
      const vg = document.createElement('canvas'); vg.width = W; vg.height = H;
      const g = vg.getContext('2d');
      const rg = g.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.hypot(W, H) * 0.6);
      rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(5,8,20,0.45)');
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
      this.vignette = vg;
    },

    // sky + skyline per theme, rendered lazily and cached until resize
    skyFor(i) {
      if (this.sky[i]) return this.sky[i];
      const th = THEMES[i], W = this.W, hy = Math.ceil(this.v.hy) + 2;
      const c = document.createElement('canvas'); c.width = W; c.height = hy;
      const g = c.getContext('2d');
      const grd = g.createLinearGradient(0, 0, 0, hy);
      grd.addColorStop(0, th.top); grd.addColorStop(1, th.bot);
      g.fillStyle = grd; g.fillRect(0, 0, W, hy);
      if (i === 3) {
        g.fillStyle = 'rgba(255,255,255,0.8)';
        for (let k = 0; k < 90; k++) g.fillRect(hash(k) * W, hash(k + 300) * hy * 0.75, 1.5, 1.5);
      }
      const sx = W * (i === 0 ? 0.22 : i === 1 ? 0.7 : i === 2 ? 0.5 : 0.8), sy = hy * (i === 1 ? 0.18 : i === 2 ? 0.78 : 0.3);
      const halo = g.createRadialGradient(sx, sy, 0, sx, sy, hy * 0.6);
      halo.addColorStop(0, th.sun); halo.addColorStop(1, 'rgba(255,255,255,0)');
      g.globalAlpha = i === 3 ? 0.25 : 0.6; g.fillStyle = halo; g.fillRect(0, 0, W, hy); g.globalAlpha = 1;
      g.fillStyle = th.sun; g.beginPath(); g.arc(sx, sy, Math.max(8, hy * 0.06), 0, 6.283); g.fill();
      if (i !== 3) {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        for (let k = 0; k < 8; k++) { const cx = hash(k + 50) * W, cy = hy * (0.1 + hash(k + 60) * 0.4), r = hy * 0.05; for (let j = 0; j < 4; j++) { g.beginPath(); g.ellipse(cx + j * r * 1.4, cy, r * 1.6, r * 0.5, 0, 0, 6.283); g.fill(); } }
      }
      this.sky[i] = c;
      // distant skyline: towers with a few lit windows
      const sk = document.createElement('canvas'); sk.width = W * 2; sk.height = hy;
      const k2 = sk.getContext('2d');
      for (let layer = 0; layer < 2; layer++) {
        const base = lerp3(th.cFog, [30, 36, 60], layer ? 0.45 : 0.25);
        k2.fillStyle = css(base);
        let x = 0, n = layer * 500;
        while (x < W * 2) {
          const w = 30 + hash(n) * 70, h = hy * (0.12 + hash(n + 1) * (layer ? 0.32 : 0.5));
          k2.fillRect(x, hy - h, w - 3, h);
          if (hash(n + 2) < 0.3) k2.fillRect(x + w * 0.4, hy - h - hy * 0.06, w * 0.12, hy * 0.06);
          if (th.glow > 0.3) {
            k2.fillStyle = 'rgba(255,214,140,0.6)';
            for (let r = 0; r < h / 10; r++) for (let q = 0; q < w / 10; q++) if (hash(n * 31 + r * 7 + q) < 0.18) k2.fillRect(x + 4 + q * 9, hy - h + 5 + r * 9, 3, 4);
            k2.fillStyle = css(base);
          }
          x += w; n += 3;
        }
      }
      this.skyline[i] = sk;
      return c;
    },

    // which theme shows now (auto cycles every 500 m from the day's start)
    setTheme(pref, dist) {
      if (pref !== 'auto') {
        const i = ['morning', 'noon', 'sunset', 'night'].indexOf(pref);
        this.themeA = this.themeB = Math.max(0, i); this.themeT = 0; return;
      }
      const start = new Date().getDate();
      const seg = dist / 500;
      this.themeA = (Math.floor(seg) + start) % 4;
      this.themeB = (this.themeA + 1) % 4;
      const f = seg - Math.floor(seg);
      this.themeT = f > 0.88 ? (f - 0.88) / 0.12 : 0;
    },
    pal() {
      const a = THEMES[this.themeA], b = THEMES[this.themeB], t = this.themeT;
      return {
        fog: lerp3(a.cFog, b.cFog, t), asph: lerp3(a.cAsph, b.cAsph, t), walk: lerp3(a.cWalk, b.cWalk, t),
        light: a.light + (b.light - a.light) * t, glow: a.glow + (b.glow - a.glow) * t, lamps: t < 0.5 ? a.lamps : b.lamps,
      };
    },

    // ---------- buildings per block, cached ----------
    block(b) {
      let bl = this.blocks.get(b);
      if (bl) return bl;
      bl = [];
      for (const side of [-1, 1]) {
        let z = 0, n = 0;
        while (z < BUILT - 4) {
          const k = hash2(b * 2 + (side > 0 ? 1 : 0), n);
          const len = Math.min(BUILT - z, 9 + Math.floor(k * 12));
          const tall = 9 + Math.floor(hash2(b, n * 3 + side) * hash2(n, b) * 36);
          const set = hash2(b + 7, n * 5 + side) < 0.25 ? 1.5 : 0;
          bl.push({ side, z0: b * BLOCK + z + 0.4, z1: b * BLOCK + z + len - 0.4, h: tall, set, col: FACADES[Math.floor(hash2(b * 13, n + side * 9) * FACADES.length)], seed: b * 97 + n * 7 + side, shop: hash2(b, n + 40) });
          z += len; n++;
        }
      }
      this.blocks.set(b, bl);
      if (this.blocks.size > 40) this.blocks.delete(this.blocks.keys().next().value);
      return bl;
    },

    // ---------- particles ----------
    burst(D, x, y, n, o) {
      for (let i = 0; i < n && this.parts.length < 350; i++) {
        const a = Math.random() * 6.283, sp = (o.speed || 3) * (0.4 + Math.random());
        this.parts.push({ D: D + (Math.random() - 0.5) * (o.sz || 0.4), x: x + (Math.random() - 0.5) * (o.sx || 0.4), y: y + Math.random() * (o.sy || 0.2), vx: Math.cos(a) * sp, vy: (o.up || 2) * (0.4 + Math.random()), vz: Math.sin(a) * sp * 0.5 + (o.vz || 0), life: (o.life || 0.6) * (0.6 + Math.random() * 0.6), max: o.life || 0.6, size: (o.size || 0.08) * (0.6 + Math.random() * 0.8), color: o.color || '#fff', grav: o.grav === undefined ? 9 : o.grav, box: !!o.box, rot: Math.random() * 6 });
      }
    },
    stepParticles(dt) {
      for (const p of this.parts) {
        p.life -= dt; p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.D += p.vz * dt; p.rot += dt * 6;
        if (p.y < 0) { p.y = 0; p.vy *= -0.35; p.vx *= 0.7; p.vz *= 0.7; }
      }
      this.parts = this.parts.filter((p) => p.life > 0);
    },

    // ---------- main draw ----------
    draw(ctx, view) {
      const { W, H } = this, v = this.v, sim = view.sim, p = sim.p, set = view.settings;
      const D = sim.dist, t = view.time;
      const pal = this.pal();
      const intro = view.intro === undefined ? 1 : view.intro;
      const lift = 1 - intro;
      const speedK = set.motion ? Math.max(0, (sim.speed - 18) / 16) : 0;
      const flying = sim.power.drone > 0;
      const camX = p.x * LANE * 0.7;
      const camY = CAM_H + lift * 9 + (set.motion && sim.state === 'playing' && p.y === 0 && !flying ? Math.abs(Math.sin(D * 1.3)) * 0.06 : 0) + (flying ? 1.2 : p.y * 0.3);
      const camBack = CAM_BACK + lift * 14 - speedK * 0.6;
      const f = v.f * (1 + lift * 0.7) * (1 - speedK * 0.06);
      const hy = v.hy + lift * v.hy * 0.3;
      const cx = v.cx;
      const near = -camBack + 0.5;
      const P = (x, y, z) => { const dz = Math.max(0.3, z + camBack); const s = f / dz; return [cx + (x - camX) * s, hy - (y - camY) * s, s]; };
      this._P = P; this._near = near; this._D = D; this._pal = pal;

      ctx.save();
      if (view.shake > 0 && set.shake) ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
      if (set.motion) { const lean = (p.lane - p.x) * -0.03; ctx.translate(cx, H * 0.8); ctx.rotate(lean); ctx.translate(-cx, -H * 0.8); }

      // sky (cross-fading between day themes) and skyline
      for (const [i, a] of [[this.themeA, 1], [this.themeB, this.themeT]]) {
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        const sk = this.skyFor(i);
        ctx.drawImage(sk, 0, hy - sk.height + 2, W, sk.height);
        if (hy - sk.height + 2 > 0) { ctx.fillStyle = THEMES[i].top; ctx.fillRect(0, 0, W, hy - sk.height + 3); }
        const line = this.skyline[i];
        const off = ((camX * 4 + D * 0.08) % W + W) % W;
        ctx.drawImage(line, -off, hy - line.height + 2); ctx.drawImage(line, W * 2 - off, hy - line.height + 2);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = css(pal.fog); ctx.fillRect(0, hy, W, H - hy);

      // ---------- ground strips ----------
      const z0 = Math.ceil(near / SEG) * SEG - (D % SEG);
      const fogAt = (z) => Math.max(0, Math.min(1, (z - 40) / (ZFAR - 50)));
      for (let z = ZFAR; z >= near - SEG; z -= SEG) {
        const za = Math.max(near, z - (D % SEG)), zb = Math.max(near, za + SEG);
        if (zb <= near + 0.01) continue;
        const fog = fogAt(za);
        const abs = Math.floor((D + za) / SEG + 0.001);
        const inBlock = ((D + za) % BLOCK + BLOCK) % BLOCK;
        const crossing = inBlock >= BUILT;
        const k = pal.light;
        // asphalt (wide at crossings, the side street opens up)
        const halfW = crossing ? 80 : ROADW;
        ctx.fillStyle = css(lerp3(lerp3(pal.asph, [0, 0, 0], abs & 1 ? 0.04 : 0), pal.fog, fog));
        quad(ctx, P(-halfW, 0, za), P(halfW, 0, za), P(halfW, 0, zb), P(-halfW, 0, zb));
        if (!crossing) {
          for (const side of [-1, 1]) {
            // curb face, then the pavement with slab joints
            const c1 = P(side * ROADW, 0, za), c2 = P(side * ROADW, 0.16, za), c3 = P(side * ROADW, 0.16, zb), c4 = P(side * ROADW, 0, zb);
            ctx.fillStyle = css(lerp3(lerp3(pal.walk, [255, 255, 255], 0.15), pal.fog, fog));
            quad(ctx, c1, c2, c3, c4);
            ctx.fillStyle = css(lerp3(lerp3(pal.walk, [0, 0, 0], abs & 1 ? 0.06 : 0), pal.fog, fog));
            quad(ctx, c2, P(side * 60, 0.16, za), P(side * 60, 0.16, zb), c3);
          }
        } else {
          // zebra crossings at both ends of the junction
          if (inBlock < BUILT + 4 || inBlock >= BLOCK - 4) {
            ctx.fillStyle = css(lerp3([236, 236, 230], pal.fog, fog), k);
            for (let sx = -ROADW + 0.3; sx < ROADW; sx += 1.0) quad(ctx, P(sx, 0.01, za + 0.3), P(sx + 0.55, 0.01, za + 0.3), P(sx + 0.55, 0.01, zb - 0.3), P(sx, 0.01, zb - 0.3));
          }
        }
        // lane dashes
        if (!crossing && (abs % 3) === 0 && fog < 0.9) {
          ctx.fillStyle = css(lerp3([240, 236, 220], pal.fog, fog));
          for (const lx of [-LANE / 2, LANE / 2]) quad(ctx, P(lx - 0.08, 0.005, za), P(lx + 0.08, 0.005, za), P(lx + 0.08, 0.005, za + SEG * 0.6), P(lx - 0.08, 0.005, za + SEG * 0.6));
        }
        if (!crossing && fog < 0.9) {
          // gutter lines
          ctx.fillStyle = css(lerp3([205, 180, 70], pal.fog, fog));
          for (const s of [-1, 1]) quad(ctx, P(s * (ROADW - 0.35), 0.005, za), P(s * (ROADW - 0.25), 0.005, za), P(s * (ROADW - 0.25), 0.005, zb), P(s * (ROADW - 0.35), 0.005, zb));
        }
      }

      // ---------- standing things ----------
      const items = [];
      const b0 = Math.floor((D + near) / BLOCK), b1 = Math.floor((D + ZFAR) / BLOCK);
      for (let b = b0; b <= b1; b++) {
        for (const bd of this.block(b)) {
          const za = bd.z0 - D, zb = bd.z1 - D;
          if (zb < near || za > ZFAR) continue;
          items.push({ k: Math.max(za, near), kind: 'bld', bd, za, zb });
        }
        // street furniture: lamps, trees, hydrants, benches, traffic lights
        const base = b * BLOCK - D;
        for (let i = 0; i < 6; i++) {
          const z = base + 4 + i * 8.5;
          if (z < near || z > ZFAR) continue;
          for (const side of [-1, 1]) {
            const h = hash2(b * 11 + i, side + 5);
            const kind = i % 2 === 0 ? 'lamp' : h < 0.45 ? 'tree' : h < 0.6 ? 'hydrant' : h < 0.75 ? 'bench' : h < 0.85 ? 'mailbox' : null;
            if (kind) items.push({ k: z, kind, x: side * (kind === 'lamp' ? ROADW + 0.5 : kind === 'tree' ? ROADW + 1.6 : ROADW + 1.0), z, side, seed: b * 31 + i });
          }
        }
        for (const side of [-1, 1]) {
          const z = base + BUILT + 0.6;
          if (z > near && z < ZFAR) items.push({ k: z, kind: 'signal', x: side * (ROADW + 0.6), z, side, seed: b });
        }
      }
      for (const th of sim.things) {
        const z = th.z - D;
        if (z < near || z > ZFAR || th.gone) continue;
        items.push({ k: z, kind: 'thing', th, z });
      }
      for (const pt of this.parts) { const z = pt.D - D; if (z > near && z < ZFAR) items.push({ k: z, kind: 'part', pt, z }); }
      items.push({ k: 0.02, kind: 'runner' });
      items.sort((a, b) => b.k - a.k);
      for (const it of items) {
        const fog = fogAt(it.k);
        const nearFade = Math.max(0, Math.min(1, (it.k - near) / 2.2));
        if (nearFade <= 0 && it.kind !== 'bld' && it.kind !== 'runner') continue;
        ctx.globalAlpha = it.kind === 'bld' ? 1 : nearFade;
        switch (it.kind) {
          case 'bld': this.building(ctx, it, fog, pal); break;
          case 'lamp': case 'tree': case 'hydrant': case 'bench': case 'mailbox': case 'signal': this.furniture(ctx, it, fog, pal, t); break;
          case 'thing': this.thing(ctx, it.th, it.z, fog, pal, t); break;
          case 'part': this.particle(ctx, it.pt, it.z); break;
          case 'runner': this.runner(ctx, view); break;
        }
      }
      ctx.globalAlpha = 1;
      // speed lines at the screen edges
      if (speedK > 0.25 && sim.state === 'playing') {
        ctx.strokeStyle = `rgba(255,255,255,${(speedK - 0.25) * 0.35})`; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 14; i++) {
          const a = hash(i * 13 + Math.floor(t * 20)) * 6.283, r0 = Math.max(W, H) * (0.42 + hash(i + Math.floor(t * 20)) * 0.2);
          ctx.moveTo(cx + Math.cos(a) * r0, hy + Math.sin(a) * r0 * 0.7); ctx.lineTo(cx + Math.cos(a) * r0 * 1.3, hy + Math.sin(a) * r0 * 0.9);
        }
        ctx.stroke();
      }
      ctx.restore();
      if (pal.glow > 0.3) { ctx.fillStyle = `rgba(10,14,40,${(pal.glow - 0.3) * 0.25})`; ctx.fillRect(0, 0, W, H); }
      ctx.drawImage(this.vignette, 0, 0);
    },

    // ---------- buildings ----------
    building(ctx, it, fog, pal) {
      const P = this._P, bd = it.bd, s = bd.side;
      const xi = s * (WALK + bd.set), xo = s * (WALK + bd.set + 12);
      const za = Math.max(it.za, this._near), zb = it.zb, h = bd.h;
      const lit = pal.light;
      const face = lerp3(lerp3(bd.col, [0, 0, 0], 0.12), pal.fog, fog);
      const front = lerp3(lerp3(bd.col, [0, 0, 0], 0.3), pal.fog, fog);
      // side facade along the street
      const a = P(xi, 0, za), b = P(xi, h, za), c = P(xi, h, zb), d = P(xi, 0, zb);
      ctx.fillStyle = css(face, lit); quad(ctx, a, b, c, d);
      // front (end) face toward the camera if it's in front of us
      if (it.za > this._near) {
        const e = P(xo, 0, za), g = P(xo, h, za);
        ctx.fillStyle = css(front, lit);
        quad(ctx, a, e, g, b);
        // cornice
        ctx.fillStyle = css(lerp3(front, [255, 255, 255], 0.15), lit);
        quad(ctx, b, g, P(xo, h + 0.4, za), P(xi, h + 0.4, za));
      }
      // cornice along the facade top
      ctx.fillStyle = css(lerp3(face, [255, 255, 255], 0.18), lit);
      quad(ctx, b, P(xi, h + 0.5, za), P(xi, h + 0.5, zb), c);
      if (fog > 0.75) return;
      // windows, batched into two paths: dark panes and lit ones
      const floors = Math.floor((h - 4) / 3.2), cols = Math.max(1, Math.floor((zb - za) / 2.6));
      if (a[2] * 1.2 < 0.6 && a[2] * 1.2 < 0.6) { /* tiny: still draw a hint */ }
      const glass = lerp3([40, 52, 70], pal.fog, fog), glow = lerp3([255, 210, 130], pal.fog, fog * 0.6);
      const dark = new Path2D(), on = new Path2D();
      const span = (zb - za) / cols;
      for (let r = 0; r < floors; r++) {
        const y0 = 4 + r * 3.2 + 0.7, y1 = y0 + 1.7;
        for (let q = 0; q < cols; q++) {
          const w0 = za + q * span + span * 0.22, w1 = za + (q + 1) * span - span * 0.22;
          const p1 = P(xi, y0, w0), p2 = P(xi, y1, w0), p3 = P(xi, y1, w1), p4 = P(xi, y0, w1);
          if (Math.abs(p1[0] - p4[0]) < 0.7) continue;
          const path = hash2(bd.seed + r * 17, q) < pal.glow ? on : dark;
          path.moveTo(p1[0], p1[1]); path.lineTo(p2[0], p2[1]); path.lineTo(p3[0], p3[1]); path.lineTo(p4[0], p4[1]); path.closePath();
        }
      }
      ctx.fillStyle = css(glass, Math.max(0.5, lit)); ctx.fill(dark);
      ctx.fillStyle = css(glow); ctx.fill(on);
      // ground floor shopfront: glass band, awning and a sign
      if (bd.shop < 0.7) {
        const sz0 = za + 0.6, sz1 = zb - 0.6;
        if (sz1 > sz0) {
          ctx.fillStyle = css(lerp3(pal.glow > 0.3 ? [255, 214, 150] : [70, 92, 110], pal.fog, fog));
          quad(ctx, P(xi, 0.4, sz0), P(xi, 2.6, sz0), P(xi, 2.6, sz1), P(xi, 0.4, sz1));
          const aw = lerp3(bd.shop < 0.25 ? [214, 64, 52] : bd.shop < 0.5 ? [40, 130, 110] : [235, 170, 40], pal.fog, fog);
          ctx.fillStyle = css(aw, lit);
          quad(ctx, P(xi, 3.2, sz0), P(xi - s * 1.3, 2.7, sz0), P(xi - s * 1.3, 2.7, sz1), P(xi, 3.2, sz1));
          // awning stripes
          ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - fog)})`;
          for (let zz = sz0; zz < sz1 - 0.5; zz += 1.4) quad(ctx, P(xi, 3.2, zz), P(xi - s * 1.3, 2.7, zz), P(xi - s * 1.3, 2.7, zz + 0.6), P(xi, 3.2, zz + 0.6));
          // neon sign blade at night
          if (pal.lamps && bd.shop < 0.3) {
            const n1 = P(xi - s * 0.1, 5.5, sz0 + 1), n2 = P(xi - s * 1.6, 3.6, sz0 + 1);
            ctx.fillStyle = bd.shop < 0.15 ? '#ff4fa3' : '#4ff0ff';
            ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
            ctx.fillRect(Math.min(n1[0], n2[0]), n1[1], Math.abs(n2[0] - n1[0]), n2[1] - n1[1]);
            ctx.shadowBlur = 0;
          }
        }
      }
      // rooftop kit
      if (hash(bd.seed) < 0.4 && it.za > this._near) {
        const rz = za + 2, rx = s * (WALK + bd.set + 3);
        const r1 = P(rx, h, rz), r2 = P(rx + s * 2.5, h + 2.4, rz);
        ctx.fillStyle = css(lerp3([90, 70, 60], pal.fog, fog), lit);
        ctx.fillRect(Math.min(r1[0], r2[0]), r2[1], Math.abs(r2[0] - r1[0]), r1[1] - r2[1]);
      }
    },

    // ---------- street furniture ----------
    furniture(ctx, it, fog, pal, t) {
      const P = this._P, z = it.z, x = it.x;
      const g = P(x, 0.16, z), s = g[2];
      if (s < 0.4) return;
      const k = pal.light;
      ctx.globalAlpha *= 1 - fog * 0.8;
      switch (it.kind) {
        case 'lamp': {
          const top = P(x, 6, z), arm = P(x - it.side * 1.6, 6, z);
          ctx.strokeStyle = css([45, 52, 64], k); ctx.lineWidth = Math.max(1, s * 0.14);
          ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(top[0], top[1]); ctx.lineTo(arm[0], arm[1]); ctx.stroke();
          ctx.fillStyle = pal.lamps ? '#ffe9b0' : '#cfd6de';
          ctx.fillRect(arm[0] - s * 0.35, arm[1], s * 0.7, s * 0.18);
          if (pal.lamps) {
            const gl = ctx.createRadialGradient(arm[0], arm[1], 0, arm[0], arm[1], s * 3);
            gl.addColorStop(0, 'rgba(255,220,150,0.45)'); gl.addColorStop(1, 'rgba(255,220,150,0)');
            ctx.fillStyle = gl; ctx.fillRect(arm[0] - s * 3, arm[1] - s * 3, s * 6, s * 6);
            // pool of light on the road
            const pool = P(x - it.side * 1.6, 0, z);
            ctx.fillStyle = 'rgba(255,220,150,0.12)'; ctx.beginPath(); ctx.ellipse(pool[0], pool[1], s * 2.2, s * 0.5, 0, 0, 6.283); ctx.fill();
          }
          break;
        }
        case 'tree': {
          const top = P(x, 2.4, z);
          ctx.fillStyle = css([70, 74, 80], k); ctx.fillRect(g[0] - s * 0.5, g[1] - s * 0.35, s, s * 0.35);
          ctx.fillStyle = css([92, 64, 40], k); ctx.fillRect(g[0] - s * 0.09, top[1], s * 0.18, g[1] - top[1]);
          const cols = [[46, 110, 60], [64, 140, 70], [38, 92, 52]];
          for (let i = 0; i < 4; i++) {
            ctx.fillStyle = css(lerp3(cols[i % 3], pal.fog, fog * 0.7), k);
            ctx.beginPath(); ctx.arc(top[0] + (hash(it.seed + i) - 0.5) * s * 1.4, top[1] - s * (0.4 + hash(it.seed + i * 3) * 0.8), s * (0.8 + hash(it.seed * 2 + i) * 0.4), 0, 6.283); ctx.fill();
          }
          break;
        }
        case 'hydrant':
          ctx.fillStyle = css([210, 50, 40], k);
          ctx.beginPath(); ctx.roundRect(g[0] - s * 0.14, g[1] - s * 0.7, s * 0.28, s * 0.7, s * 0.08); ctx.fill();
          ctx.fillRect(g[0] - s * 0.22, g[1] - s * 0.5, s * 0.44, s * 0.1);
          break;
        case 'bench': {
          const b1 = P(x - 0.2, 0.6, z - 0.8), b2 = P(x + 0.2, 0.6, z + 0.8);
          ctx.fillStyle = css([120, 80, 50], k);
          ctx.fillRect(Math.min(b1[0], b2[0]), b1[1] - s * 0.12, Math.abs(b2[0] - b1[0]) + s * 0.3, s * 0.12);
          ctx.fillRect(Math.min(b1[0], b2[0]), b1[1] - s * 0.6, Math.abs(b2[0] - b1[0]) + s * 0.3, s * 0.1);
          ctx.fillStyle = css([40, 40, 46], k); ctx.fillRect(g[0] - s * 0.05, b1[1], s * 0.1, g[1] - b1[1]);
          break;
        }
        case 'mailbox':
          ctx.fillStyle = css([40, 80, 170], k);
          ctx.beginPath(); ctx.roundRect(g[0] - s * 0.3, g[1] - s * 1.2, s * 0.6, s * 0.9, [s * 0.3, s * 0.3, 0, 0]); ctx.fill();
          ctx.fillStyle = css([30, 30, 34], k); ctx.fillRect(g[0] - s * 0.05, g[1] - s * 0.3, s * 0.1, s * 0.3);
          break;
        case 'signal': {
          const top = P(x, 4.2, z);
          ctx.strokeStyle = css([40, 44, 50], k); ctx.lineWidth = Math.max(1, s * 0.12);
          ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
          ctx.fillStyle = '#1d2026'; ctx.beginPath(); ctx.roundRect(top[0] - s * 0.22, top[1], s * 0.44, s * 1.2, s * 0.08); ctx.fill();
          const phase = Math.floor((t + it.seed * 0.7) / 3) % 3;
          ['#ff3b30', '#ffcc00', '#34c759'].forEach((c, i) => {
            ctx.fillStyle = i === phase ? c : '#3a3d44';
            ctx.beginPath(); ctx.arc(top[0], top[1] + s * (0.2 + i * 0.38), s * 0.13, 0, 6.283); ctx.fill();
          });
          break;
        }
      }
    },

    // ---------- obstacles & pickups ----------
    thing(ctx, th, z, fog, pal, t) {
      const P = this._P, x = th.lane * LANE;
      const k = Math.max(0.6, pal.light);
      ctx.globalAlpha *= 1 - fog * 0.85;
      const g = P(x, 0, z), s = g[2];
      if (s < 0.5) return;
      // contact shadow
      if (th.type !== 'parcel') { ctx.fillStyle = 'rgba(10,12,20,0.3)'; ctx.beginPath(); ctx.ellipse(g[0], g[1], s * 1.1, s * 0.22, 0, 0, 6.283); ctx.fill(); }
      if (th.type === 'barrier') {
        const l = P(x - 1.0, 0.85, z), r = P(x + 1.0, 0.55, z);
        // legs
        ctx.fillStyle = css([60, 60, 66], k);
        for (const lx of [-0.85, 0.85]) { const a = P(x + lx, 0, z), b = P(x + lx, 0.85, z); ctx.fillRect(a[0] - s * 0.05, b[1], s * 0.1, a[1] - b[1]); }
        // striped board
        ctx.save();
        ctx.beginPath(); ctx.rect(l[0], l[1], r[0] - l[0], r[1] - l[1]); ctx.clip();
        ctx.fillStyle = '#ff6a1a'; ctx.fillRect(l[0], l[1], r[0] - l[0], r[1] - l[1]);
        ctx.fillStyle = '#ffffff';
        const bw = (r[0] - l[0]) / 8;
        for (let i = -1; i < 9; i += 2) { ctx.beginPath(); ctx.moveTo(l[0] + i * bw, r[1]); ctx.lineTo(l[0] + (i + 1) * bw, l[1]); ctx.lineTo(l[0] + (i + 2) * bw, l[1]); ctx.lineTo(l[0] + (i + 1) * bw, r[1]); ctx.fill(); }
        ctx.restore();
        ctx.strokeStyle = '#7a2c06'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.strokeRect(l[0], l[1], r[0] - l[0], r[1] - l[1]);
        // blinking amber lamp
        const on = Math.sin(t * 8 + th.z) > 0;
        const lamp = P(x - 0.7, 0.98, z);
        ctx.fillStyle = on ? '#ffd23f' : '#8a6a12';
        if (on) { ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = s * 0.6; }
        ctx.beginPath(); ctx.arc(lamp[0], lamp[1], s * 0.1, 0, 6.283); ctx.fill();
        ctx.shadowBlur = 0;
      } else if (th.type === 'sign') {
        const tl = P(x - 1.05, 2.05, z), br = P(x + 1.05, 1.25, z);
        ctx.fillStyle = css([70, 74, 82], k);
        for (const lx of [-0.95, 0.95]) { const a = P(x + lx, 0, z), b = P(x + lx, 2.05, z); ctx.fillRect(a[0] - s * 0.05, b[1], s * 0.1, a[1] - b[1]); }
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);
        ctx.fillStyle = '#111'; ctx.fillRect(tl[0] + s * 0.05, tl[1] + s * 0.05, br[0] - tl[0] - s * 0.1, s * 0.05);
        ctx.fillRect(tl[0] + s * 0.05, br[1] - s * 0.1, br[0] - tl[0] - s * 0.1, s * 0.05);
        if (s > 4) {
          ctx.font = `${Math.round(s * 0.34)}px "Anton", "Arial Narrow", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#111'; ctx.fillText('▼ LOW SIGN ▼', (tl[0] + br[0]) / 2, (tl[1] + br[1]) / 2 + s * 0.02);
        }
      } else if (th.type === 'van') {
        this.van(ctx, x, z, t, th, k);
      } else if (th.type === 'parcel') {
        this.parcel(ctx, x, 0.75 + Math.sin(t * 4 + th.z) * 0.08, z, t * 2 + th.z, k);
        const sh = P(x, 0, z);
        ctx.fillStyle = 'rgba(10,12,20,0.22)'; ctx.beginPath(); ctx.ellipse(sh[0], sh[1], s * 0.3, s * 0.08, 0, 0, 6.283); ctx.fill();
      } else {
        // power-up badge with a light column
        const c = P(x, 1.1 + Math.sin(t * 3 + th.z) * 0.12, z);
        const col = { magnet: '#ff3d5a', scooter: '#2f8bff', drone: '#a35cff' }[th.type];
        const beam = ctx.createLinearGradient(0, c[1] - s * 2, 0, g[1]);
        beam.addColorStop(0, 'rgba(255,255,255,0)'); beam.addColorStop(1, col + '66');
        ctx.fillStyle = beam; ctx.fillRect(c[0] - s * 0.35, c[1] - s * 2, s * 0.7, g[1] - c[1] + s * 2);
        ctx.save(); ctx.translate(c[0], c[1]); ctx.scale(Math.cos(t * 2.5 + th.z), 1);
        ctx.fillStyle = '#fff'; hexagon(ctx, 0, 0, s * 0.42); ctx.fill();
        ctx.fillStyle = col; hexagon(ctx, 0, 0, s * 0.35); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(c[0], c[1]);
        this.powerIcon(ctx, th.type, s * 0.22);
        ctx.restore();
      }
    },

    powerIcon(ctx, type, r) {
      ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = Math.max(1.2, r * 0.32); ctx.lineCap = 'round';
      if (type === 'magnet') {
        ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.7, Math.PI, 0); ctx.moveTo(-r * 0.7, -r * 0.1); ctx.lineTo(-r * 0.7, r * 0.7); ctx.moveTo(r * 0.7, -r * 0.1); ctx.lineTo(r * 0.7, r * 0.7); ctx.stroke();
      } else if (type === 'scooter') {
        ctx.beginPath(); ctx.arc(-r * 0.7, r * 0.6, r * 0.3, 0, 6.283); ctx.arc(r * 0.7, r * 0.6, r * 0.3, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.6); ctx.lineTo(r * 0.5, r * 0.6); ctx.lineTo(r * 0.3, -r * 0.9); ctx.lineTo(-r * 0.1, -r * 0.9); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(-r, -r * 0.3); ctx.lineTo(r, -r * 0.3); ctx.moveTo(0, -r * 0.3); ctx.lineTo(0, r * 0.4); ctx.stroke();
        for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * r, -r * 0.55, r * 0.45, r * 0.12, 0, 0, 6.283); ctx.fill(); }
        ctx.fillRect(-r * 0.35, r * 0.3, r * 0.7, r * 0.5);
      }
    },

    van(ctx, x, z, t, th, k) {
      const P = this._P;
      const w = 1.0, h = 2.3, len = 5.0, z0 = Math.max(z, this._near), z1 = z + len;
      const body = [244, 241, 232];
      const a = P(x - w, 0.35, z0), b = P(x + w, 0.35, z0), c = P(x + w, h, z0), d = P(x - w, h, z0);
      const e = P(x - w, h, z1), f = P(x + w, h, z1);
      // the side face we can see
      const sideX = a[0] > this.v.cx ? x - w : x + w;
      const s1 = P(sideX, 0.35, z0), s2 = P(sideX, h, z0), s3 = P(sideX, h, z1), s4 = P(sideX, 0.35, z1);
      ctx.fillStyle = css(body, k * 0.82); quad(ctx, s1, s2, s3, s4);
      // brand stripe on the side
      ctx.fillStyle = css([255, 106, 26], k * 0.9);
      quad(ctx, P(sideX, 1.0, z0), P(sideX, 1.3, z0), P(sideX, 1.3, z1), P(sideX, 1.0, z1));
      // roof
      ctx.fillStyle = css(body, k * 0.95); quad(ctx, d, c, f, e);
      // rear doors
      ctx.fillStyle = css(body, k); ctx.fillRect(a[0], c[1], b[0] - a[0], a[1] - c[1]);
      const s = a[2];
      ctx.strokeStyle = css([150, 150, 150], k); ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath(); ctx.moveTo((a[0] + b[0]) / 2, c[1] + s * 0.1); ctx.lineTo((a[0] + b[0]) / 2, a[1]); ctx.stroke();
      ctx.fillStyle = css([40, 60, 80], k); ctx.fillRect(a[0] + s * 0.15, c[1] + s * 0.25, (b[0] - a[0]) / 2 - s * 0.25, s * 0.5); ctx.fillRect((a[0] + b[0]) / 2 + s * 0.1, c[1] + s * 0.25, (b[0] - a[0]) / 2 - s * 0.25, s * 0.5);
      ctx.fillStyle = css([255, 106, 26], k); ctx.fillRect(a[0], c[1] + (a[1] - c[1]) * 0.55, b[0] - a[0], s * 0.18);
      // tail lights, hazards blinking
      const blink = Math.sin(t * 7 + th.z) > 0;
      for (const lx of [a[0] + s * 0.06, b[0] - s * 0.2]) {
        ctx.fillStyle = blink ? '#ffb020' : '#c21d1d';
        if (blink) { ctx.shadowColor = '#ffb020'; ctx.shadowBlur = s * 0.5; }
        ctx.fillRect(lx, a[1] - s * 0.75, s * 0.14, s * 0.3);
        ctx.shadowBlur = 0;
      }
      // bumper and wheels
      ctx.fillStyle = '#26282e'; ctx.fillRect(a[0] - s * 0.04, a[1] - s * 0.1, b[0] - a[0] + s * 0.08, s * 0.16);
      for (const wx of [x - w + 0.15, x + w - 0.45]) { const q = P(wx, 0, z0 + 0.2); ctx.fillRect(q[0], a[1], s * 0.3, q[1] - a[1]); }
    },

    // a spinning cardboard box: three visible faces from 8 rotated corners
    parcel(ctx, x, y, z, ang, k) {
      const P = this._P, r = 0.26;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const pt = (dx, dy, dz) => P(x + dx * ca - dz * sa, y + dy, z + dx * sa + dz * ca);
      const v = [];
      for (const dy of [-r, r]) for (const [dx, dz] of [[-r, -r], [r, -r], [r, r], [-r, r]]) v.push(pt(dx, dy, dz));
      const faces = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
      const cam = [this.v.cx, 0];
      const vis = faces.map((fc, i) => ({ fc, i, d: (v[fc[0]][2] + v[fc[1]][2]) })).sort((a, b) => a.d - b.d);
      for (const { fc, i } of vis.slice(2)) {
        ctx.fillStyle = css([201, 150, 92], k * (i % 2 ? 0.85 : 0.72));
        quad(ctx, v[fc[0]], v[fc[1]], v[fc[2]], v[fc[3]]);
      }
      ctx.fillStyle = css([222, 175, 112], k); quad(ctx, v[4], v[5], v[6], v[7]);
      // tape
      ctx.strokeStyle = 'rgba(250,240,220,0.9)'; ctx.lineWidth = Math.max(1, v[4][2] * 0.07);
      ctx.beginPath(); ctx.moveTo((v[4][0] + v[5][0]) / 2, (v[4][1] + v[5][1]) / 2); ctx.lineTo((v[6][0] + v[7][0]) / 2, (v[6][1] + v[7][1]) / 2); ctx.stroke();
      void cam;
    },

    particle(ctx, p, z) {
      const q = this._P(p.x, p.y, z), s = q[2] * p.size;
      if (s < 0.4) return;
      ctx.globalAlpha *= Math.min(1, p.life / p.max * 1.6);
      ctx.fillStyle = p.color;
      if (p.box) { ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(p.rot); ctx.fillRect(-s, -s, s * 2, s * 2); ctx.restore(); }
      else ctx.fillRect(q[0] - s / 2, q[1] - s / 2, s, s);
    },

    // ---------- the courier, from behind ----------
    runner(ctx, view) {
      const sim = view.sim, p = sim.p, pw = sim.power;
      const flying = pw.drone > 0;
      const P = this._P;
      const x = p.x * LANE;
      const y = flying ? 1.6 + Math.sin(view.time * 3) * 0.1 : p.y;
      const g = P(x, 0, 0), b = P(x, y, 0), s = g[2];
      ctx.globalAlpha = 1;
      // shadow
      const sk = Math.max(0.35, 1 - y / 3);
      ctx.fillStyle = `rgba(10,12,22,${0.35 * sk})`; ctx.beginPath(); ctx.ellipse(g[0], g[1], s * 0.5 * sk, s * 0.13 * sk, 0, 0, 6.283); ctx.fill();
      ctx.save();
      ctx.translate(b[0], b[1]);
      ctx.scale(s / 47, s / 47); // draw in 1/47 m units: courier ~1.85 m tall
      if (sim.state === 'over') { const k = Math.min(1, sim.overT * 2); ctx.translate(0, -k * 20); ctx.rotate(k * 2.4); }
      const roll = p.roll > 0 && !flying && p.y < 0.4;
      const ph = sim.dist * 1.25;
      const scooter = pw.scooter;
      if (scooter && !flying) {
        // kick scooter under the feet
        ctx.fillStyle = '#2f8bff'; ctx.fillRect(-5, -6, 10, 4);
        ctx.fillStyle = '#1b1d24'; ctx.beginPath(); ctx.arc(0, -2, 4, 0, 6.283); ctx.fill();
        ctx.strokeStyle = '#2f8bff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, -46); ctx.moveTo(-10, -46); ctx.lineTo(10, -46); ctx.stroke();
      }
      if (roll) {
        // tucked roll
        ctx.save(); ctx.translate(0, -16); ctx.rotate(view.time * 14);
        ctx.fillStyle = '#ff6a1a'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#c9965c'; ctx.fillRect(-9, -9, 18, 14);
        ctx.fillStyle = '#1f3a8a'; ctx.beginPath(); ctx.arc(0, -12, 7, 0, 6.283); ctx.fill();
        ctx.restore();
      } else {
        const air = p.y > 0.05 || flying;
        const sw = air || scooter ? 0 : Math.sin(ph);
        const lA = air ? 8 : Math.max(0, sw) * 12, lB = air ? 4 : Math.max(0, -sw) * 12;
        // legs: dark joggers, white sneakers
        ctx.fillStyle = '#1e2333';
        ctx.fillRect(-11, -34 - (scooter ? 4 : 0), 9, 24 - lA); ctx.fillRect(2, -34 - (scooter ? 4 : 0), 9, 24 - lB);
        ctx.fillStyle = '#f4f4f4';
        ctx.beginPath(); ctx.roundRect(-12, -12 - lA - (scooter ? 4 : 0), 11, 9, 3); ctx.fill();
        ctx.beginPath(); ctx.roundRect(1, -12 - lB - (scooter ? 4 : 0), 11, 9, 3); ctx.fill();
        ctx.fillStyle = '#ff6a1a'; ctx.fillRect(-12, -6 - lA - (scooter ? 4 : 0), 11, 2); ctx.fillRect(1, -6 - lB - (scooter ? 4 : 0), 11, 2);
        const lift = scooter ? 4 : 0;
        // jacket
        ctx.fillStyle = '#ff6a1a'; ctx.beginPath(); ctx.roundRect(-15, -66 - lift, 30, 34, 8); ctx.fill();
        ctx.fillStyle = '#e04f0c'; ctx.fillRect(-15, -40 - lift, 30, 5);
        // arms
        const aA = air ? -1.2 : sw * 0.5, aB = air ? 1.2 : -sw * 0.5;
        ctx.fillStyle = '#ff6a1a';
        ctx.save(); ctx.translate(-15, -62 - lift); ctx.rotate(0.2 + aA * 0.4); ctx.fillRect(-3.5, 0, 7, 24); ctx.fillStyle = '#d99a6c'; ctx.fillRect(-3, 22, 6, 5); ctx.restore();
        ctx.save(); ctx.translate(15, -62 - lift); ctx.rotate(-0.2 + aB * 0.4); ctx.fillRect(-3.5, 0, 7, 24); ctx.fillStyle = '#d99a6c'; ctx.fillRect(-3, 22, 6, 5); ctx.restore();
        // the parcel backpack
        ctx.fillStyle = '#c9965c'; ctx.beginPath(); ctx.roundRect(-13, -70 - lift, 26, 28, 3); ctx.fill();
        ctx.fillStyle = '#b07d45'; ctx.fillRect(-13, -70 - lift, 26, 4);
        ctx.fillStyle = 'rgba(255,250,235,0.85)'; ctx.fillRect(-2, -70 - lift, 4, 28);
        ctx.fillStyle = '#fff'; ctx.fillRect(-10, -54 - lift, 9, 6);
        ctx.fillStyle = '#111'; for (let i = 0; i < 4; i++) ctx.fillRect(-9 + i * 2, -53 - lift, 1, 4);
        // head and cap (backwards cap with a logo)
        ctx.fillStyle = '#d99a6c'; ctx.fillRect(-4, -76 - lift, 8, 6);
        ctx.fillStyle = '#2a1d16'; ctx.beginPath(); ctx.arc(0, -82 - lift, 9, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#1f3a8a'; ctx.beginPath(); ctx.arc(0, -84 - lift, 9.5, Math.PI, 0); ctx.fill();
        ctx.fillRect(-6, -86 - lift, 12, 4);
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, -89 - lift, 2.2, 0, 6.283); ctx.fill();
      }
      if (flying) {
        // the drone carrying us
        const bob = Math.sin(view.time * 20);
        ctx.strokeStyle = '#2b2f3a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-10, -66); ctx.lineTo(-6, -104); ctx.moveTo(10, -66); ctx.lineTo(6, -104); ctx.stroke();
        ctx.fillStyle = '#a35cff'; ctx.beginPath(); ctx.roundRect(-16, -112, 32, 10, 4); ctx.fill();
        ctx.fillStyle = '#2b2f3a'; ctx.fillRect(-34, -110, 68, 3);
        ctx.fillStyle = 'rgba(220,220,240,0.55)';
        for (const rx of [-34, 34]) { ctx.beginPath(); ctx.ellipse(rx, -112, 16, 3 + bob, 0, 0, 6.283); ctx.fill(); }
      }
      if (scooter) {
        // shield shimmer
        ctx.strokeStyle = `rgba(47,139,255,${0.45 + Math.sin(view.time * 6) * 0.2})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, -44, 30, 52, 0, 0, 6.283); ctx.stroke();
      }
      ctx.restore();
    },
  };

  function quad(ctx, a, b, c, d) {
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
  }
  function hexagon(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath();
  }

  Rd.LANE = LANE; Rd.THEMES = THEMES;
  root.CS = root.CS || {};
  root.CS.Render = Rd;
})(window);
