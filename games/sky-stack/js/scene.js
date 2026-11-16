// The world of Sky Stack: a floating island in a sky that changes as the
// tower climbs (hazy hills far below, cloud decks, birds and balloons, planes
// with contrails, golden hour, dusk, stars, aurora, then the edge of space),
// and the tower itself, drawn in lit isometric 3D with a camera that can
// orbit. Static art (clouds, stars, hills) is pre-rendered on resize.
(function () {
  const SS = window.SS;
  const { clamp, clamp01, lerp, mix, rgb, ramp } = SS;
  const BH = SS.Rules.BLOCK_H;

  // sky colours by altitude (in floors): [top of screen, horizon]
  const SKY_TOP = [[0, [118, 186, 255]], [30, [92, 166, 248]], [55, [118, 136, 226]], [78, [70, 62, 150]], [98, [22, 22, 66]], [125, [7, 9, 30]], [170, [2, 2, 10]]];
  const SKY_BOT = [[0, [255, 238, 214]], [30, [214, 236, 255]], [55, [255, 202, 168]], [78, [255, 150, 156]], [98, [104, 74, 146]], [125, [26, 34, 86]], [170, [12, 36, 80]]];

  function hsl(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }
  SS.hsl = hsl;

  const W0 = {
    W: 0, H: 0, dpr: 1, layers: {},
    // camera
    cam: 0, zoom: 1, yaw: 0, cx: 0, cy: 0, S: 100,
    alt: 0, night: 0, time: 0, shakeX: 0, shakeY: 0, shake: 0,
    clouds: [], birds: [], planes: [], balloons: [], stars: null,
    fx: [], debris: [], pops: [], rain: [], flash: 0, bolt: null,
    windK: 0, fogK: 0, stormK: 0,

    resize(W, H, dpr) {
      this.W = W; this.H = H; this.dpr = dpr;
      this.build();
      if (!this.clouds.length) this.populate();
    },
    base() { return Math.min(this.W, this.H * 0.8) * 0.22; },

    // ---------- projection (isometric, with an orbiting yaw) ----------
    p(x, y, z) {
      const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      const xr = x * c - z * s, zr = x * s + z * c, S = this.S;
      return [this.cx + (xr - zr) * S * 0.866, this.cy + (xr + zr) * S * 0.5 - (y - this.cam) * S];
    },
    // screen y of a world height (at the tower axis)
    yOf(y) { return this.cy - (y - this.cam) * this.S; },

    // ---------- pre-rendered art ----------
    canvas(w, h) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * this.dpr)); c.height = Math.max(1, Math.round(h * this.dpr));
      const x = c.getContext('2d'); x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      return [c, x];
    },
    build() {
      const { W, H } = this, L = (this.layers = {}), r = SS.rng(4242);
      // cloud sprites: puffs of soft circles, shaded underneath
      L.clouds = [];
      for (let v = 0; v < 5; v++) {
        // every puff stays inside the sprite, so no edge ever gets clipped flat
        const cw = 260, ch = 120, [c, x] = this.canvas(cw, ch);
        const n = 7 + v;
        for (let i = 0; i < n; i++) {
          const pr = 16 + r() * 18, px = 34 + pr + ((i + r() * 0.6) / n) * (cw - 68 - pr * 2);
          const py = Math.min(ch - pr - 4, Math.max(pr + 4, 72 - Math.sin(((i + 0.5) / n) * Math.PI) * 26 + r() * 10));
          const g = x.createRadialGradient(px, py - pr * 0.3, pr * 0.1, px, py, pr);
          g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(250,252,255,0.95)'); g.addColorStop(1, 'rgba(240,246,255,0)');
          x.fillStyle = g; x.beginPath(); x.arc(px, py, pr, 0, Math.PI * 2); x.fill();
        }
        // soft blue-grey belly
        x.globalCompositeOperation = 'source-atop';
        const bg = x.createLinearGradient(0, 40, 0, ch);
        bg.addColorStop(0, 'rgba(180,200,230,0)'); bg.addColorStop(1, 'rgba(160,182,220,0.55)');
        x.fillStyle = bg; x.fillRect(0, 0, cw, ch);
        L.clouds.push(c);
      }
      // tinted copies for sunset and storms (cheaper than tinting every frame)
      const tint = (src, fill) => src.map((s) => {
        const [c, x] = this.canvas(260, 120);
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.drawImage(s, 0, 0);
        x.globalCompositeOperation = 'source-atop';
        x.fillStyle = fill; x.fillRect(0, 0, c.width, c.height);
        return c;
      });
      L.cloudsDusk = tint(L.clouds, 'rgba(255,160,150,0.5)');
      L.cloudsStorm = tint(L.clouds, 'rgba(70,76,110,0.7)');
      // stars
      const [sc, sx] = this.canvas(W, H);
      for (let i = 0; i < 240; i++) {
        const big = r() < 0.07;
        sx.fillStyle = `rgba(255,${240 + r() * 15},${220 + r() * 35},${0.35 + r() * 0.65})`;
        const s = big ? 1.8 : 0.6 + r() * 0.8;
        sx.fillRect(r() * W, r() * H, s, s);
      }
      L.stars = sc;
      // distant hills far below the island
      const [hc, hx] = this.canvas(W, H * 0.5);
      const cols = ['#c9dff2', '#b3d4e6', '#a6cfc8', '#96c4a8'];
      cols.forEach((col, k) => {
        hx.fillStyle = col; hx.beginPath(); hx.moveTo(0, H * 0.5);
        const base = H * (0.12 + k * 0.08), amp = 18 + k * 8, ph = r() * 6;
        for (let px = 0; px <= W; px += 8) hx.lineTo(px, base - amp * (0.6 * Math.sin(px / (90 + k * 30) + ph) + 0.4 * Math.sin(px / (37 + k * 11) + ph * 2)));
        hx.lineTo(W, H * 0.5); hx.closePath(); hx.fill();
      });
      L.hills = hc;
      // vignette
      const [vc, vx] = this.canvas(W, H);
      const vg = vx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(20,30,70,0)'); vg.addColorStop(1, 'rgba(20,30,70,0.28)');
      vx.fillStyle = vg; vx.fillRect(0, 0, W, H);
      L.vignette = vc;
      // the island outline (in world units), fixed
      const rr = SS.rng(77);
      this.island = [];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2, rad = 1.25 + rr() * 0.32;
        this.island.push([Math.cos(a) * rad, Math.sin(a) * rad, 0.4 + rr() * 0.5]);
      }
      this.trees = [[0.95, 0.35, 0.34], [-0.85, 0.75, 0.28], [0.55, -1.0, 0.24], [-1.05, -0.45, 0.3]];
    },
    // the sky's travelling things, placed at altitudes (floors)
    populate() {
      const r = SS.rng(99);
      this.clouds = [];
      for (let i = 0; i < 46; i++) {
        const deck = r() < 0.55;
        this.clouds.push({ x: r(), alt: deck ? 14 + r() * 22 : 2 + r() * 95, depth: 0.35 + r() * 1.0, v: r() * 5 | 0, s: 0.6 + r() * 0.9, sp: 0.6 + r() * 0.8 });
      }
      this.birds = [];
      for (let i = 0; i < 5; i++) this.birds.push({ x: r(), alt: 3 + r() * 40, n: 3 + (r() * 5 | 0), sp: 0.03 + r() * 0.03, dir: r() < 0.5 ? 1 : -1, ph: r() * 6, depth: 0.5 + r() * 0.6 });
      this.planes = [{ x: 0.2, alt: 46, sp: 0.045, dir: 1, depth: 0.6 }, { x: 0.8, alt: 66, sp: 0.035, dir: -1, depth: 0.45 }];
      this.balloons = [{ x: 0.15, alt: 12, depth: 0.7, hue: 8 }, { x: 0.85, alt: 22, depth: 0.5, hue: 200 }];
    },

    // ---------- effects the game triggers ----------
    addShake(a) { this.shake = Math.max(this.shake, a); },
    perfectFx(b, y, streak) {
      this.fx.push({ k: 'ring', b: { x: b.x, z: b.z, w: b.w, d: b.d }, y, t: 0, gold: streak >= 3 });
      const top = this.p(b.x, y, b.z);
      for (let i = 0; i < 14 + Math.min(16, streak * 2); i++) {
        const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 120;
        this.fx.push({ k: 'spark', x: top[0] + Math.cos(a) * b.w * this.S * 0.5, y: top[1] + Math.sin(a) * b.d * this.S * 0.25, vx: Math.cos(a) * sp * 0.4, vy: -30 - Math.random() * 90, t: 0, life: 0.7 + Math.random() * 0.6, gold: streak >= 3 });
      }
      this.pops.push({ text: streak >= 2 ? 'Perfect ×' + streak : 'Perfect!', y, t: 0, gold: streak >= 3 });
    },
    growFx(b, y, axis) { this.fx.push({ k: 'grow', b: { x: b.x, z: b.z, w: b.w, d: b.d }, y, axis, t: 0 }); },
    chipFx(b, y) {
      const q = this.p(b.x, y, b.z);
      for (let i = 0; i < 8; i++) this.fx.push({ k: 'dust', x: q[0], y: q[1], vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 60, t: 0, life: 0.6 });
    },
    // a sliced or missed piece: it tips off the edge and tumbles away
    addDebris(piece, y, axis, dir, hue) {
      const push = 0.6 + Math.random() * 0.4;
      this.debris.push({
        x: piece.x, z: piece.z, w: piece.w, d: piece.d, y, hue,
        vx: axis === 'x' ? dir * push : (Math.random() - 0.5) * 0.2, vz: axis === 'z' ? dir * push : (Math.random() - 0.5) * 0.2, vy: 0.6,
        rot: 0, vr: (dir || 1) * (2.5 + Math.random() * 2.5) * (axis === 'x' ? 1 : -1), t: 0,
      });
    },

    // ---------- per-frame ----------
    // o: { alt, cam, zoom, yaw, stage, windy, foggy, storm, motion, dt }
    step(dt, o) {
      this.time += dt;
      this.alt = o.alt; this.cam = o.cam; this.zoom = o.zoom; this.yaw = o.yaw;
      this.night = clamp01((o.alt - 72) / 45);
      this.S = this.base() * this.zoom;
      this.cx = this.W / 2; this.cy = this.H * 0.64;
      this.windK = lerp(this.windK, o.windy ? 1 : 0, dt * 1.5);
      this.fogK = lerp(this.fogK, o.foggy ? 1 : 0, dt * 1.2);
      this.stormK = lerp(this.stormK, o.storm ? 1 : 0, dt * 1.0);
      for (const c of this.clouds) c.x = (c.x + dt * 0.004 * c.sp * (1 + this.windK * 5) + 1.2) % 1.2;
      for (const b of this.birds) { b.x += dt * b.sp * b.dir * (1 + this.windK); if (b.x > 1.2) b.x = -0.2; if (b.x < -0.2) b.x = 1.2; }
      for (const p of this.planes) { p.x += dt * p.sp * p.dir; if (p.x > 1.4) p.x = -0.4; if (p.x < -0.4) p.x = 1.4; }
      for (const f of this.fx) {
        f.t += dt;
        if (f.k === 'spark' || f.k === 'dust') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.k === 'dust' ? 220 : 40) * dt; }
      }
      this.fx = this.fx.filter((f) => f.t < (f.life || 0.7));
      for (const d of this.debris) {
        d.t += dt; d.vy -= 9 * dt;
        d.x += d.vx * dt; d.z += d.vz * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
      }
      this.debris = this.debris.filter((d) => d.t < 4 && d.y > this.cam - 12);
      for (const p of this.pops) p.t += dt;
      this.pops = this.pops.filter((p) => p.t < 1.1);
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const sh = o.motion ? this.shake * this.shake * 16 : 0;
      this.shakeX = (Math.random() - 0.5) * sh; this.shakeY = (Math.random() - 0.5) * sh;
      // storm: rain and the odd lightning strike
      this.flash = Math.max(0, this.flash - dt * 3);
      if (this.stormK > 0.5 && Math.random() < dt * 0.12) {
        this.bolt = { x: Math.random() * this.W, t: 0, seed: Math.random() };
        if (o.motion) this.flash = 1;
        if (o.onThunder) o.onThunder();
      }
      if (this.bolt) { this.bolt.t += dt; if (this.bolt.t > 0.35) this.bolt = null; }
    },

    // ---------- drawing ----------
    drawSky(ctx) {
      const { W, H, alt } = this;
      const top = ramp(SKY_TOP, alt), bot = ramp(SKY_BOT, alt);
      const stormDark = this.stormK * 0.45;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgb(mix(top, [40, 44, 70], stormDark)));
      g.addColorStop(1, rgb(mix(bot, [70, 74, 100], stormDark)));
      ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
      // stars and the aurora come out at night
      if (this.night > 0.02) {
        ctx.globalAlpha = this.night * (1 - this.stormK * 0.8);
        ctx.drawImage(this.layers.stars, 0, ((alt * 1.5) % H) - H, W, H);
        ctx.drawImage(this.layers.stars, 0, (alt * 1.5) % H, W, H);
        ctx.globalAlpha = 1;
      }
      this.drawSun(ctx);
      if (alt > 92) this.drawAurora(ctx, clamp01((alt - 92) / 25) * (1 - this.stormK));
      if (alt > 135) this.drawSpace(ctx, clamp01((alt - 135) / 30));
    },
    drawSun(ctx) {
      const { W, H, alt } = this;
      // the sun sinks as you climb into the evening; the moon rises after
      const k = clamp01(alt / 100);
      const sx = W * 0.82, sy = H * (0.16 + k * 0.7);
      if (k < 0.98) {
        const r = Math.min(W, H) * 0.06;
        const col = mix([255, 250, 225], [255, 150, 110], clamp01((alt - 40) / 50));
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 5);
        g.addColorStop(0, rgb(col, 0.55)); g.addColorStop(1, rgb(col, 0));
        ctx.fillStyle = g; ctx.fillRect(sx - r * 5, sy - r * 5, r * 10, r * 10);
        ctx.fillStyle = rgb(col, 0.95);
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      }
      if (this.night > 0.2) {
        const mx = W * 0.2, my = H * (0.5 - this.night * 0.32), r = Math.min(W, H) * 0.04;
        ctx.globalAlpha = clamp01((this.night - 0.2) * 2);
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, r * 4);
        g.addColorStop(0, 'rgba(220,230,255,0.35)'); g.addColorStop(1, 'rgba(220,230,255,0)');
        ctx.fillStyle = g; ctx.fillRect(mx - r * 4, my - r * 4, r * 8, r * 8);
        ctx.fillStyle = '#f2f4ff'; ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(200,205,230,0.6)';
        ctx.beginPath(); ctx.arc(mx - r * 0.3, my - r * 0.2, r * 0.22, 0, Math.PI * 2); ctx.arc(mx + r * 0.35, my + r * 0.3, r * 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    },
    drawAurora(ctx, a) {
      if (a <= 0.01) return;
      const { W, H, time } = this;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const bands = [[120, 255, 190], [140, 200, 255], [210, 140, 255]];
      bands.forEach((c, i) => {
        const y0 = H * (0.14 + i * 0.07);
        const g = ctx.createLinearGradient(0, y0 - 60, 0, y0 + 60);
        g.addColorStop(0, rgb(c, 0)); g.addColorStop(0.5, rgb(c, 0.22 * a)); g.addColorStop(1, rgb(c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, y0 + 60);
        for (let x = 0; x <= W; x += 24) ctx.lineTo(x, y0 + Math.sin(x / 140 + time * 0.4 + i) * 26 + Math.sin(x / 60 - time * 0.7) * 8 - 50);
        for (let x = W; x >= 0; x -= 24) ctx.lineTo(x, y0 + Math.sin(x / 140 + time * 0.4 + i) * 26 + 40);
        ctx.closePath(); ctx.fill();
      });
      ctx.restore();
    },
    drawSpace(ctx, a) {
      const { W, H, time } = this;
      // the curve of the world glowing far below, and a satellite drifting by
      ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(W / 2, H * 2.4, H * 1.45, W / 2, H * 2.4, H * 1.6);
      g.addColorStop(0, 'rgba(90,170,255,0.6)'); g.addColorStop(1, 'rgba(90,170,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, H * 0.6, W, H * 0.4);
      const sx = ((time * 0.02) % 1.3 - 0.15) * W, sy = H * 0.22;
      ctx.fillStyle = '#dfe6ff';
      ctx.fillRect(sx - 3, sy - 2, 6, 4);
      ctx.fillStyle = '#6f9cff'; ctx.fillRect(sx - 12, sy - 1.5, 7, 3); ctx.fillRect(sx + 5, sy - 1.5, 7, 3);
      ctx.globalAlpha = 1;
    },

    // things at an altitude: screen y for a sky object at altitude `a` and parallax depth
    skyY(a, depth) { return this.cy - (a * BH - this.cam) * this.S * depth; },

    drawBack(ctx, o) {
      const { W, H } = this;
      // hazy land far below, fading as you leave it behind
      const landA = clamp01(1 - this.alt / 40);
      if (landA > 0) {
        ctx.globalAlpha = landA;
        const hy = this.cy + this.cam * this.S * 0.12 + this.S * 1.2;
        ctx.drawImage(this.layers.hills, 0, hy - H * 0.12, W, H * 0.5);
        ctx.fillStyle = '#96c4a8'; ctx.fillRect(0, hy + H * 0.37, W, H);
        ctx.globalAlpha = 1;
      }
      this.drawClouds(ctx, false);
      this.drawFlyers(ctx);
    },
    drawClouds(ctx, front) {
      const { W, H } = this;
      const dusk = clamp01((this.alt - 55) / 30), nightK = this.night;
      for (const c of this.clouds) {
        if ((c.depth > 1.05) !== front) continue;
        const y = this.skyY(c.alt, c.depth);
        const w = 260 * c.s * c.depth * (W / 900 + 0.4), h = w * 0.46;
        if (y < -h || y > H + h) continue;
        const x = (c.x - 0.1) * W * 1.2 - w / 2;
        const a = (front ? 0.55 : 0.92) * (1 - nightK * 0.55);
        const tint = Math.max(dusk, this.stormK);
        if (tint < 0.98) { ctx.globalAlpha = a; ctx.drawImage(this.layers.clouds[c.v], x, y - h / 2, w, h); }
        if (tint > 0.02) {
          ctx.globalAlpha = a * tint;
          ctx.drawImage((this.stormK > dusk ? this.layers.cloudsStorm : this.layers.cloudsDusk)[c.v], x, y - h / 2, w, h);
        }
      }
      ctx.globalAlpha = 1;
    },
    drawFlyers(ctx) {
      const { W, time } = this;
      // birds: little flapping V's in loose flocks
      ctx.strokeStyle = this.night > 0.5 ? 'rgba(200,210,255,0.5)' : 'rgba(40,60,100,0.7)';
      ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (const b of this.birds) {
        const by = this.skyY(b.alt, b.depth);
        if (by < -40 || by > this.H + 40) continue;
        for (let i = 0; i < b.n; i++) {
          const x = b.x * W + (i - b.n / 2) * 16 * b.dir * -1 + Math.sin(i * 2.1) * 8, y = by + Math.abs(i - b.n / 2) * 7 + Math.sin(time * 2 + i) * 3;
          const f = Math.sin(time * 9 + i * 1.3 + b.ph) * 4, s = 5 * b.depth + 2;
          ctx.beginPath(); ctx.moveTo(x - s, y - f); ctx.quadraticCurveTo(x - s * 0.4, y - 2, x, y); ctx.quadraticCurveTo(x + s * 0.4, y - 2, x + s, y - f); ctx.stroke();
        }
      }
      // hot-air balloons low down
      for (const b of this.balloons) {
        const y = this.skyY(b.alt, b.depth) + Math.sin(time * 0.6 + b.hue) * 6;
        if (y < -80 || y > this.H + 80) continue;
        const x = b.x * W, r = 16 * b.depth + 6;
        const c1 = hsl(b.hue, 80, 68), c2 = hsl(b.hue + 40, 80, 80);
        for (let s = 0; s < 5; s++) {
          ctx.fillStyle = rgb(s % 2 ? c1 : c2);
          ctx.beginPath(); ctx.ellipse(x, y, r * (1 - s * 0.2), r * 1.15, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(80,60,40,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + r); ctx.lineTo(x - r * 0.25, y + r * 1.7); ctx.moveTo(x + r * 0.5, y + r); ctx.lineTo(x + r * 0.25, y + r * 1.7); ctx.stroke();
        ctx.fillStyle = '#a97b4f'; ctx.fillRect(x - r * 0.28, y + r * 1.7, r * 0.56, r * 0.4);
      }
      // planes with fading contrails
      for (const p of this.planes) {
        const y = this.skyY(p.alt, p.depth);
        if (y < -40 || y > this.H + 40) continue;
        const x = p.x * W, s = 9 * p.depth + 3;
        const g = ctx.createLinearGradient(x, 0, x - p.dir * W * 0.4, 0);
        g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(x - p.dir * s, y); ctx.lineTo(x - p.dir * W * 0.4, y + 4); ctx.stroke();
        ctx.fillStyle = this.night > 0.5 ? '#9aa6d6' : '#f6f8ff';
        ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - p.dir * s * 0.1, y); ctx.lineTo(x - p.dir * s * 0.45, y - s * 0.75); ctx.lineTo(x - p.dir * s * 0.25, y); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - p.dir * s * 0.8, y); ctx.lineTo(x - p.dir * s, y - s * 0.45); ctx.lineTo(x - p.dir * s * 0.6, y); ctx.fill();
        if (this.night > 0.3 && Math.sin(this.time * 6) > 0.6) { ctx.fillStyle = '#ff6b6b'; ctx.fillRect(x + p.dir * s * 0.9, y - 1, 2, 2); }
      }
    },

    // ---------- lighting ----------
    // side faces: brighter on the side facing the light (screen-left), dimmer at night
    shade(base, bright) {
      const night = this.night, sky = ramp(SKY_BOT, this.alt);
      let c = [base[0] * bright, base[1] * bright, base[2] * bright];
      c = mix(c, sky, 0.12 + night * 0.18);
      return mix(c, [20, 24, 60], night * 0.5 + this.stormK * 0.2);
    },
    poly(ctx, pts, fill) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    },
    // A lit box. b: {x,z,w,d}; y: bottom; h: height. opts: alpha, glow, windows (level), rot (screen spin)
    box(ctx, b, y, h, base, opts) {
      opts = opts || {};
      const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
      const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      // light comes from the viewer's left
      const LX = 0.35, LZ = 0.94;
      const faces = [
        { n: [1, 0], pts: [[x1, z0], [x1, z1]] },
        { n: [-1, 0], pts: [[x0, z1], [x0, z0]] },
        { n: [0, 1], pts: [[x1, z1], [x0, z1]] },
        { n: [0, -1], pts: [[x0, z0], [x1, z0]] },
      ];
      ctx.save();
      if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
      if (opts.rot) {
        const ctr = this.p(b.x, y + h / 2, b.z);
        ctx.translate(ctr[0], ctr[1]); ctx.rotate(opts.rot); ctx.translate(-ctr[0], -ctr[1]);
      }
      for (const f of faces) {
        const nx = f.n[0] * c - f.n[1] * s, nz = f.n[0] * s + f.n[1] * c;
        if (nx + nz <= 0.001) continue;
        const bright = 0.58 + 0.32 * ((nx * LX + nz * LZ) / Math.hypot(nx, nz));
        const [a, bb] = f.pts;
        const p0 = this.p(a[0], y + h, a[1]), p1 = this.p(bb[0], y + h, bb[1]), p2 = this.p(bb[0], y, bb[1]), p3 = this.p(a[0], y, a[1]);
        this.poly(ctx, [p0, p1, p2, p3], rgb(this.shade(base, bright)));
        // ambient occlusion along the bottom of each floor
        const k = 0.3;
        this.poly(ctx, [[lerp(p3[0], p0[0], k), lerp(p3[1], p0[1], k)], [lerp(p2[0], p1[0], k), lerp(p2[1], p1[1], k)], p2, p3], 'rgba(20,30,70,0.12)');
        // warm windows at night
        if (opts.windows !== undefined && this.night > 0.25 && h > 0.15) {
          ctx.fillStyle = `rgba(255,214,140,${(this.night - 0.25) * 1.2})`;
          for (let wi = 0; wi < 3; wi++) {
            if ((SS.hash('w' + opts.windows + ':' + f.n + ':' + wi) & 3) === 0) continue;
            const u = (wi + 0.5) / 3, q0 = [lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u)], q3 = [lerp(p3[0], p2[0], u), lerp(p3[1], p2[1], u)];
            const wy0 = lerp(q0[1], q3[1], 0.3), wy1 = lerp(q0[1], q3[1], 0.68), ww = Math.max(1.5, Math.abs(p1[0] - p0[0]) * 0.09);
            ctx.fillRect(q0[0] - ww / 2, wy0, ww, wy1 - wy0);
          }
        }
      }
      // top face, with a light rim on the two near edges
      const t0 = this.p(x0, y + h, z0), t1 = this.p(x1, y + h, z0), t2 = this.p(x1, y + h, z1), t3 = this.p(x0, y + h, z1);
      this.poly(ctx, [t0, t1, t2, t3], rgb(this.shade(base, 1.06)));
      if (opts.glow) this.poly(ctx, [t0, t1, t2, t3], `rgba(255,255,240,${opts.glow})`);
      ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - this.night * 0.6)})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]); ctx.lineTo(t2[0], t2[1]); ctx.lineTo(t3[0], t3[1]); ctx.closePath(); ctx.stroke();
      ctx.restore();
    },

    // The floating island the tower is built on.
    drawIsland(ctx) {
      const isl = this.island, n = isl.length;
      if (this.p(0, 0, 0)[1] - this.S * 3 > this.H) return;
      const tip = this.p(0.1, -2.6, -0.1);
      // rocky underside: triangles from the rim to the tip, far ones first
      const tris = [];
      for (let i = 0; i < n; i++) {
        const a = isl[i], b = isl[(i + 1) % n];
        const pa = this.p(a[0], -0.18, a[1]), pb = this.p(b[0], -0.18, b[1]);
        const mid = this.p((a[0] + b[0]) / 2 * 0.6, -1.0, (a[1] + b[1]) / 2 * 0.6);
        const ang = Math.atan2(a[1] + b[1], a[0] + b[0]) + this.yaw;
        tris.push({ pts: [pa, pb, mid, tip], depth: pa[1] + pb[1], light: 0.5 + 0.3 * Math.cos(ang - 2.3) });
      }
      tris.sort((u, v) => u.depth - v.depth);
      for (const t of tris) this.poly(ctx, [t.pts[0], t.pts[1], t.pts[3]], rgb(this.shade([168, 140, 118], t.light)));
      for (const t of tris) this.poly(ctx, [t.pts[0], t.pts[1], t.pts[2]], rgb(this.shade([150, 124, 104], t.light + 0.08)));
      // a little waterfall over one edge
      const w0 = this.p(isl[3][0] * 0.95, -0.12, isl[3][1] * 0.95);
      const g = ctx.createLinearGradient(0, w0[1], 0, w0[1] + this.S * 2.4);
      g.addColorStop(0, 'rgba(225,245,255,0.9)'); g.addColorStop(1, 'rgba(225,245,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(w0[0] - this.S * 0.05, w0[1], this.S * 0.1, this.S * 2.4);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 4; i++) { const yy = w0[1] + ((this.time * 120 + i * 37) % (this.S * 2)); ctx.fillRect(w0[0] - this.S * 0.03, yy, this.S * 0.06, 3); }
      // grass lip and top
      const rim = isl.map((q) => this.p(q[0], -0.12, q[1])), topP = isl.map((q) => this.p(q[0], 0, q[1]));
      this.poly(ctx, rim, rgb(this.shade([96, 160, 96], 0.8)));
      this.poly(ctx, topP, rgb(this.shade([150, 214, 128], 1)));
      // a soft inner highlight and a stone path to the tower
      const inner = isl.map((q) => this.p(q[0] * 0.7, 0, q[1] * 0.7));
      this.poly(ctx, inner, rgb(this.shade([168, 226, 142], 1), 0.6));
      // trees: little cones with trunks, drawn far to near
      const trees = this.trees.map((t) => ({ t, p: this.p(t[0], 0, t[1]) })).sort((a, b) => a.p[1] - b.p[1]);
      for (const { t, p } of trees) {
        const h = t[2] * this.S * 2.2, r = t[2] * this.S * 0.7;
        ctx.fillStyle = 'rgba(40,80,40,0.25)';
        ctx.beginPath(); ctx.ellipse(p[0] + r * 0.4, p[1], r * 1.1, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8a6646'; ctx.fillRect(p[0] - r * 0.12, p[1] - h * 0.3, r * 0.24, h * 0.3);
        ctx.fillStyle = rgb(this.shade([86, 170, 110], 0.85));
        ctx.beginPath(); ctx.moveTo(p[0], p[1] - h); ctx.lineTo(p[0] + r, p[1] - h * 0.22); ctx.lineTo(p[0] - r, p[1] - h * 0.22); ctx.closePath(); ctx.fill();
        ctx.fillStyle = rgb(this.shade([120, 200, 130], 1));
        ctx.beginPath(); ctx.moveTo(p[0], p[1] - h); ctx.lineTo(p[0] - r, p[1] - h * 0.22); ctx.lineTo(p[0] - r * 0.1, p[1] - h * 0.3); ctx.closePath(); ctx.fill();
      }
    },

    // A soft shadow of the tower on the island and of the sliding block on the top floor.
    footprint(ctx, b, y, alpha) {
      const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
      this.poly(ctx, [this.p(x0, y, z0), this.p(x1, y, z0), this.p(x1, y, z1), this.p(x0, y, z1)], `rgba(30,40,90,${alpha})`);
    },

    drawFx(ctx) {
      for (const f of this.fx) {
        if (f.k === 'ring') {
          const k = f.t / 0.7, sc = 1 + SS.easeOut(k) * 0.9;
          const b = { x: f.b.x, z: f.b.z, w: f.b.w * sc, d: f.b.d * sc };
          const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
          const pts = [this.p(x0, f.y, z0), this.p(x1, f.y, z0), this.p(x1, f.y, z1), this.p(x0, f.y, z1)];
          ctx.strokeStyle = f.gold ? `rgba(255,214,120,${1 - k})` : `rgba(255,255,255,${1 - k})`;
          ctx.lineWidth = 3 * (1 - k) + 1;
          ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.stroke();
        } else if (f.k === 'spark') {
          const k = f.t / f.life, s = 3.5 * (1 - k) + 1;
          ctx.fillStyle = f.gold ? `rgba(255,220,130,${1 - k})` : `rgba(255,255,255,${1 - k})`;
          ctx.beginPath();
          ctx.moveTo(f.x, f.y - s * 2); ctx.lineTo(f.x + s * 0.5, f.y - s * 0.5); ctx.lineTo(f.x + s * 2, f.y); ctx.lineTo(f.x + s * 0.5, f.y + s * 0.5);
          ctx.lineTo(f.x, f.y + s * 2); ctx.lineTo(f.x - s * 0.5, f.y + s * 0.5); ctx.lineTo(f.x - s * 2, f.y); ctx.lineTo(f.x - s * 0.5, f.y - s * 0.5);
          ctx.closePath(); ctx.fill();
        } else if (f.k === 'dust') {
          ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - f.t / f.life)})`;
          ctx.beginPath(); ctx.arc(f.x, f.y, 2.5, 0, Math.PI * 2); ctx.fill();
        } else if (f.k === 'grow') {
          const k = f.t / 0.7;
          const b = f.b, x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
          ctx.strokeStyle = `rgba(255,220,120,${1 - k})`;
          ctx.lineWidth = 4 * (1 - k) + 1;
          const e = f.axis === 'x' ? [[x1, z0], [x1, z1], [x0, z1], [x0, z0]] : [[x0, z1], [x1, z1], [x1, z0], [x0, z0]];
          ctx.beginPath();
          let q = this.p(e[0][0], f.y, e[0][1]); ctx.moveTo(q[0], q[1]); q = this.p(e[1][0], f.y, e[1][1]); ctx.lineTo(q[0], q[1]);
          q = this.p(e[2][0], f.y, e[2][1]); ctx.moveTo(q[0], q[1]); q = this.p(e[3][0], f.y, e[3][1]); ctx.lineTo(q[0], q[1]);
          ctx.stroke();
        }
      }
    },

    // weather over everything: wind streaks, fog, rain, lightning
    drawWeather(ctx, topScreenY, playing) {
      const { W, H, time } = this;
      if (this.windK > 0.02) {
        ctx.strokeStyle = `rgba(255,255,255,${0.4 * this.windK})`;
        ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let i = 0; i < 12; i++) {
          const x = ((i * 173 + time * 520) % (W + 300)) - 150, y = (i * 97 + Math.sin(i) * 40) % H;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 30, y - 8, x + 70, y - 4); ctx.stroke();
        }
      }
      if (this.fogK > 0.02 && playing) {
        // fog hides the edges of the top floors, so you judge by memory and rhythm
        const band = this.S * 1.1, fy = topScreenY;
        const g = ctx.createLinearGradient(0, fy - band * 0.2, 0, fy + band);
        const fc = this.night > 0.5 ? '120,128,170' : '232,236,246';
        g.addColorStop(0, `rgba(${fc},0)`); g.addColorStop(0.25, `rgba(${fc},${0.93 * this.fogK})`);
        g.addColorStop(0.8, `rgba(${fc},${0.93 * this.fogK})`); g.addColorStop(1, `rgba(${fc},0)`);
        ctx.fillStyle = g; ctx.fillRect(0, fy - band * 0.2, W, band * 1.2);
        // drifting wisps
        ctx.globalAlpha = 0.35 * this.fogK;
        for (let i = 0; i < 3; i++) {
          const w = W * 0.7, x = ((time * 14 * (i + 1) + i * 300) % (W + w)) - w;
          ctx.drawImage(this.layers.clouds[i], x, fy - band * 0.1 + i * band * 0.2, w, band * 0.6);
        }
        ctx.globalAlpha = 1;
      }
      if (this.stormK > 0.02) {
        ctx.strokeStyle = `rgba(200,215,255,${0.35 * this.stormK})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < 70; i++) {
          const x = ((i * 89 + time * 300) % (W + 100)) - 50, y = ((i * 131 + time * 900) % (H + 60)) - 30;
          ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 16);
        }
        ctx.stroke();
        if (this.bolt) {
          const r = SS.rng(Math.floor(this.bolt.seed * 1e6));
          ctx.strokeStyle = `rgba(255,255,240,${1 - this.bolt.t / 0.35})`; ctx.lineWidth = 2.5;
          ctx.beginPath(); let x = this.bolt.x, y = 0; ctx.moveTo(x, y);
          while (y < H * 0.5) { x += (r() - 0.5) * 40; y += 20 + r() * 25; ctx.lineTo(x, y); }
          ctx.stroke();
        }
        if (this.flash > 0) { ctx.fillStyle = `rgba(235,240,255,${this.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
      }
    },

    drawPops(ctx) {
      for (const p of this.pops) {
        const k = p.t / 1.1, y = this.yOf(p.y) - this.S * 0.9 - SS.easeOut(k) * 40;
        const s = 1 + 0.3 * Math.max(0, 1 - p.t * 6);
        ctx.globalAlpha = 1 - Math.pow(k, 3);
        SS.Draw.text(ctx, p.text, this.W / 2, y, 22 * s, p.gold ? '#fff1b8' : '#ffffff', 'center', 800, { display: true, shadow: true });
        ctx.globalAlpha = 1;
      }
    },
  };

  SS.World = W0;
})();
