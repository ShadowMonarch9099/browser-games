// The world: a neon highway rushing toward the camera in perspective, with
// three lanes, a gate arch on every beat, a skyline, and a spectrum portal at
// the vanishing point that the road runs into. Everything is drawn on a 2D
// canvas with a hand-rolled projection; static layers (stars, skyline,
// vignette, scanlines, glow sprites) are pre-rendered on resize.
(function () {
  const BS = window.BS;
  const { clamp, clamp01, lerp, mixRgb, rgb } = BS;

  // Lane colours never change, so the notes stay readable in every section.
  const LANE = [[255, 61, 154], [255, 210, 63], [61, 242, 255]];
  const WIDE = [205, 170, 255];
  const MISS = [255, 60, 70];
  BS.LANE_RGB = LANE;

  // One palette per kind of section (song.js KINDS[].pal). The scene blends
  // between them over a bar when the song moves on.
  const PALS = [
    { name: 'Dusk', top: [9, 2, 30], mid: [40, 8, 70], hor: [255, 80, 140], ring: [255, 120, 200], ring2: [255, 220, 110], grid: [180, 75, 255], road: [10, 4, 22], rail: [255, 61, 200] },
    { name: 'Violet', top: [5, 2, 24], mid: [28, 10, 78], hor: [140, 60, 255], ring: [255, 140, 230], ring2: [140, 90, 255], grid: [255, 61, 240], road: [8, 4, 26], rail: [190, 90, 255] },
    { name: 'Ember', top: [18, 2, 20], mid: [62, 6, 40], hor: [255, 110, 60], ring: [255, 190, 90], ring2: [255, 60, 80], grid: [255, 120, 60], road: [16, 4, 16], rail: [255, 120, 70] },
    { name: 'Hyper', top: [0, 14, 32], mid: [0, 40, 76], hor: [0, 230, 255], ring: [200, 250, 255], ring2: [60, 120, 255], grid: [61, 242, 255], road: [2, 8, 24], rail: [61, 242, 255] },
    { name: 'Deep', top: [2, 1, 12], mid: [10, 12, 44], hor: [70, 80, 255], ring: [180, 190, 255], ring2: [90, 60, 255], grid: [110, 95, 255], road: [4, 4, 16], rail: [120, 110, 255] },
    { name: 'Overdrive', top: [22, 0, 28], mid: [64, 0, 66], hor: [255, 46, 200], ring: [255, 245, 120], ring2: [255, 46, 200], grid: [255, 224, 61], road: [16, 0, 20], rail: [255, 224, 61] },
  ];
  BS.PALS = PALS;

  const Z_FAR = 46;
  const HALF = 1.6;          // road half-width (lanes at x = -1, 0, 1)
  const CAM_BACK = 2.2;
  const POD_Z = -0.6;

  const S = {
    W: 0, H: 0, dpr: 1, F: 300, camH: 1.25, cx: 0, hy: 0, hitY: 0,
    camX: 0, curve: 0, t: 0,
    layers: {}, glowCache: {},
    parts: [], beams: [], rings: [], pops: [], banner: null,
    press: [0, 0, 0], podX: 0, podTarget: 0, bank: 0, strike: null,
    spec: new Float32Array(48), specSmooth: new Float32Array(48),
    pal: PALS[0], palFrom: 0, palTo: 0, palK: 1,
    power: 1,
    shakeX: 0, shakeY: 0, shake: 0,

    resize(W, H, dpr) {
      this.W = W; this.H = H; this.dpr = dpr;
      const wr = Math.min(W, H * 1.25);
      this.F = 0.43 * wr;
      this.camH = 1.25 * clamp((H / W) * 1.35, 1, 2.4);
      this.cx = W / 2;
      this.hitY = H * (H > W ? 0.79 : 0.78);
      this.hy = Math.max(H * 0.2, this.hitY - (this.camH * this.F) / CAM_BACK);
      this.buildLayers();
    },

    // ---------- projection ----------
    bend(z) { return z > 0 ? this.curve * z * z : 0; },
    sx(x, z) { return this.cx + (x + this.bend(z) - this.camX) * this.F / (z + CAM_BACK); },
    sy(z, y) { return this.hy + (this.camH - (y || 0)) * this.F / (z + CAM_BACK); },
    sc(z) { return this.F / (z + CAM_BACK); },
    // z where the road meets the bottom of the screen
    zNear() { return (this.camH * this.F) / (this.H - this.hy) - CAM_BACK; },

    // ---------- pre-rendered layers ----------
    canvas(w, h) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * this.dpr)); c.height = Math.max(1, Math.round(h * this.dpr));
      const x = c.getContext('2d');
      x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      return [c, x];
    },
    buildLayers() {
      const { W, H, hy } = this;
      const L = (this.layers = {});
      const rand = BS.rng(90210);
      // stars
      let [c, x] = this.canvas(W, hy);
      for (let i = 0; i < 260; i++) {
        const px = rand() * W, py = Math.pow(rand(), 1.5) * hy * 0.95, r = rand() < 0.08 ? 1.4 : 0.4 + rand() * 0.7;
        x.fillStyle = `rgba(${rand() < 0.3 ? '255,190,240' : '220,230,255'},${0.25 + rand() * 0.6})`;
        x.fillRect(px, py, r, r);
      }
      L.stars = c;
      // skyline, two depths, with a gap where the road meets the horizon
      const sky = (h, color, rim, win, gap, seed) => {
        const r = BS.rng(seed), w = W * 1.3;
        const [cc, xx] = this.canvas(w, h);
        let px = 0;
        while (px < w) {
          const bw = 14 + r() * 46, bh = h * (0.25 + Math.pow(r(), 1.6) * 0.75);
          const mid = Math.abs(px + bw / 2 - w / 2) / (w / 2);
          if (mid < gap) { px += bw; continue; }
          const k = clamp01((mid - gap) / 0.35);
          const top = h - bh * (0.35 + 0.65 * k);
          xx.fillStyle = color; xx.fillRect(px, top, bw + 1, h - top);
          xx.fillStyle = rim; xx.fillRect(px, top, bw, 1.5);
          if (r() < 0.25) { xx.fillRect(px + bw / 2, top - 10 - r() * 14, 1.5, 14 + r() * 10); }
          for (let wy = top + 6; wy < h - 4; wy += 6) for (let wx = px + 4; wx < px + bw - 4; wx += 5) {
            if (r() < 0.16) { xx.fillStyle = r() < 0.5 ? win[0] : win[1]; xx.fillRect(wx, wy, 2, 2); }
          }
          px += bw + r() * 4;
        }
        return cc;
      };
      const skyH = Math.min(H * 0.24, hy * 0.7);
      L.skyFar = sky(skyH * 0.8, '#1c0b3a', 'rgba(255,120,220,0.35)', ['rgba(255,150,230,0.45)', 'rgba(120,220,255,0.4)'], 0.14, 11);
      L.skyNear = sky(skyH, '#080214', 'rgba(255,80,200,0.55)', ['rgba(255,210,120,0.6)', 'rgba(90,240,255,0.55)'], 0.22, 23);
      L.skyH = skyH;
      // vignette
      [c, x] = this.canvas(W, H);
      const g = x.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.78);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(4,0,12,0.72)');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      L.vignette = c;
      // scanlines (a full-screen pattern, drawn once per frame at low alpha)
      [c, x] = this.canvas(W, H);
      x.fillStyle = 'rgba(0,0,0,0.5)';
      for (let y = 0; y < H; y += 3) x.fillRect(0, y, W, 1);
      L.scan = c;
      this.glowCache = {};
    },
    // A soft round glow sprite in one colour, cached.
    glow(c) {
      const key = c.join(',');
      let s = this.glowCache[key];
      if (s) return s;
      s = document.createElement('canvas'); s.width = s.height = 64;
      const x = s.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, rgb(c, 0.9)); g.addColorStop(0.35, rgb(c, 0.35)); g.addColorStop(1, rgb(c, 0));
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
      return (this.glowCache[key] = s);
    },

    // ---------- effects the game triggers ----------
    setPalette(i, instant) {
      if (i === this.palTo) return;
      this.palFrom = instant ? i : this.palTo; this.palTo = i; this.palK = instant ? 1 : 0;
    },
    pressLane(lane) {
      this.press[lane] = 1;
      this.podTarget = lane - 1;
      this.strike = { lane, t: 0 };
    },
    hit(lane, grade, wide, quiet) {
      const z = 0, x = lane - 1;
      const px = this.sx(x, z), py = this.sy(z, 0.1), s = this.sc(z);
      const col = wide ? WIDE : LANE[lane];
      const perfect = grade === 'perfect';
      const n = perfect ? 26 : 14;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * (0.05 + Math.random() * 0.9), sp = (perfect ? 260 : 170) * (0.4 + Math.random());
        this.part(px + (wide ? (Math.random() - 0.5) * s * 2.6 : 0), py, Math.cos(a) * sp, Math.sin(a) * sp, perfect && i % 3 === 0 ? [255, 255, 255] : col, 0.5 + Math.random() * 0.4, 2 + Math.random() * 3);
      }
      this.rings.push({ x, z, t: 0, col: perfect ? [255, 250, 220] : col, wide });
      this.beams.push({ lane: wide ? -1 : lane, t: 0, col });
      if (!quiet) this.pops.push({ x, text: perfect ? 'PERFECT' : 'GOOD', col: perfect ? [255, 236, 140] : col, t: 0 });
    },
    missFx(lane) {
      const x = lane === -1 ? 0 : lane - 1;
      this.pops.push({ x, text: 'MISS', col: MISS, t: 0 });
      const px = this.sx(x, 0), py = this.sy(0, 0);
      for (let i = 0; i < 8; i++) this.part(px, py, (Math.random() - 0.5) * 120, -Math.random() * 90, MISS, 0.4, 2);
    },
    comboFx(n) {
      this.banner = { text: n + ' COMBO', t: 0, col: [255, 236, 140], small: true };
      for (let lane = 0; lane < 3; lane++) this.rings.push({ x: lane - 1, z: 0, t: -lane * 0.05, col: LANE[lane] });
    },
    sectionFx(name) { this.banner = { text: name, t: 0, col: this.pal.ring }; },
    part(x, y, vx, vy, col, life, size) {
      if (this.parts.length > 420) this.parts.shift();
      this.parts.push({ x, y, vx, vy, col, life, max: life, size });
    },
    addShake(a) { this.shake = Math.max(this.shake, a); },

    // ---------- per-frame update of effects (dt in seconds) ----------
    step(dt, o) {
      this.palK = Math.min(1, this.palK + dt / 1.4);
      const a = PALS[this.palFrom], b = PALS[this.palTo], k = BS.easeInOut(this.palK);
      const P = this.pal = {};
      for (const key of Object.keys(a)) P[key] = key === 'name' ? b.name : mixRgb(a[key], b[key], k);
      for (let i = 0; i < 3; i++) this.press[i] = Math.max(0, this.press[i] - dt * 4);
      this.podX += (this.podTarget - this.podX) * Math.min(1, dt * 22);
      this.bank = lerp(this.bank, BS.clamp((this.podTarget - this.podX) * 0.5, -0.35, 0.35), Math.min(1, dt * 14));
      this.camX = this.podX * 0.22;
      if (this.strike) { this.strike.t += dt; if (this.strike.t > 0.12) this.strike = null; }
      for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.vx *= 1 - dt * 1.5; }
      this.parts = this.parts.filter((p) => p.life > 0);
      for (const r of this.rings) r.t += dt;
      this.rings = this.rings.filter((r) => r.t < 0.5);
      for (const r of this.beams) r.t += dt;
      this.beams = this.beams.filter((r) => r.t < 0.35);
      for (const r of this.pops) r.t += dt;
      this.pops = this.pops.filter((r) => r.t < 0.6);
      if (this.banner) { this.banner.t += dt; if (this.banner.t > 1.8) this.banner = null; }
      this.shake = Math.max(0, this.shake - dt * 2.4);
      const sh = o.shakeOn ? this.shake * this.shake * 22 : 0;
      this.shakeX = (Math.random() - 0.5) * sh; this.shakeY = (Math.random() - 0.5) * sh;
      this.curve = 0.0028 * Math.sin(o.t * 0.19) + 0.0012 * Math.sin(o.t * 0.47 + 1);
      // the spectrum: from the analyser when music plays, otherwise faked from the beat
      const sp = this.spec;
      if (!BS.Audio.levels(sp)) for (let i = 0; i < sp.length; i++) sp[i] = o.pulse * Math.max(0, 0.7 - i / 70) * (0.6 + 0.4 * Math.sin(i * 1.7 + o.t * 3)) + 0.05;
      for (let i = 0; i < sp.length; i++) this.specSmooth[i] = Math.max(sp[i], this.specSmooth[i] - dt * 1.6);
      this.power = lerp(this.power, o.failing ? 0.15 : 1, Math.min(1, dt * (o.failing ? 2 : 4)));
    },

    // ---------- the frame ----------
    // o: { t, beat, t0, notes, speed, pulse, bar, flashOn, hints, glyphs, laneLook, failing }
    draw(ctx, o) {
      const { W, H } = this;
      const P = this.pal, pw = this.power;
      ctx.save();
      ctx.translate(this.shakeX, this.shakeY);
      const zoom = o.flashOn ? 1 + o.pulse * 0.008 + o.bar * 0.006 : 1;
      if (zoom !== 1) { ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2); }

      this.drawSky(ctx, o, P, pw);
      this.drawGround(ctx, o, P, pw);
      this.drawRoad(ctx, o, P, pw);
      this.drawArches(ctx, o, P, pw);
      this.drawReceptors(ctx, o, pw);
      this.drawNotes(ctx, o);
      this.drawFx(ctx, o);
      this.drawPod(ctx, o, P, pw);
      this.drawHints(ctx, o);
      this.drawPops(ctx, o);
      ctx.restore();

      ctx.drawImage(this.layers.vignette, 0, 0, W, H);
      ctx.globalAlpha = 0.16;
      ctx.drawImage(this.layers.scan, 0, 0, W, H);
      ctx.globalAlpha = 1;
      if (o.flashOn && o.bar > 0.05 && o.intense) {
        ctx.fillStyle = rgb(P.hor, 0.05 * o.bar);
        ctx.fillRect(0, 0, W, H);
      }
    },

    drawSky(ctx, o, P, pw) {
      const { W, hy } = this;
      const g = ctx.createLinearGradient(0, 0, 0, hy);
      g.addColorStop(0, rgb(P.top));
      g.addColorStop(0.62, rgb(P.mid));
      g.addColorStop(1, rgb(mixRgb(P.mid, P.hor, 0.55 * pw)));
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, W + 40, hy + 22);
      ctx.drawImage(this.layers.stars, 0, 0, W, hy);

      // the portal: concentric rings and a circular spectrum, pulsing on the beat
      const px = this.sx(0, Z_FAR), py = hy - 2;
      const R = Math.min(W, this.H) * 0.15 * (1 + o.pulse * 0.05);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, hy); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      const halo = this.glow(P.hor);
      ctx.globalAlpha = (0.55 + o.pulse * 0.3) * pw;
      ctx.drawImage(halo, px - R * 2.6, py - R * 2.6, R * 5.2, R * 5.2);
      ctx.globalAlpha = pw;
      const core = ctx.createRadialGradient(px, py, 0, px, py, R);
      core.addColorStop(0, rgb(P.ring2, 0.0)); core.addColorStop(0.7, rgb(P.ring2, 0.18)); core.addColorStop(1, rgb(P.ring, 0.55));
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI * 2); ctx.fill();
      // radial spectrum bars, mirrored left/right
      const n = this.specSmooth.length;
      ctx.lineWidth = Math.max(1.5, R * 0.035);
      for (let i = 0; i < n; i++) {
        const v = this.specSmooth[i];
        const len = R * (0.06 + v * 0.55);
        for (const side of [1, -1]) {
          const a = -Math.PI / 2 + side * ((i + 0.5) / n) * Math.PI;
          const c = Math.cos(a), s = Math.sin(a);
          ctx.strokeStyle = rgb(mixRgb(P.ring, P.ring2, i / n), 0.35 + v * 0.65);
          ctx.beginPath(); ctx.moveTo(px + c * R * 1.04, py + s * R * 1.04); ctx.lineTo(px + c * (R * 1.04 + len), py + s * (R * 1.04 + len)); ctx.stroke();
        }
      }
      // rings expanding outward on each beat
      for (let k = 0; k < 3; k++) {
        const ph = ((o.beatPos || 0) + k / 3) % 1;
        ctx.strokeStyle = rgb(P.ring, (1 - ph) * 0.4);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, R * (0.3 + ph * 0.7), 0, Math.PI * 2); ctx.stroke();
      }
      // horizontal scan bands across the portal
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = rgb(P.mid, 0.85);
      for (let k = 0; k < 5; k++) {
        const yy = py - R * (0.08 + k * 0.17) + ((o.t * 18) % (R * 0.17));
        ctx.fillRect(px - R * 1.1, yy, R * 2.2, 1.5 + k * 0.6);
      }
      ctx.restore();

      // skyline: two parallax layers
      const L = this.layers, sh = L.skyH, wLayer = W * 1.3;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(L.skyFar, -W * 0.15 - this.camX * 6, hy - sh * 0.8 + 1, wLayer, sh * 0.8);
      ctx.globalAlpha = 1;
      ctx.drawImage(L.skyNear, -W * 0.15 - this.camX * 14, hy - sh + 1, wLayer, sh);
      // horizon glow line
      const hg = ctx.createLinearGradient(0, hy - 18, 0, hy + 6);
      hg.addColorStop(0, rgb(P.hor, 0)); hg.addColorStop(0.75, rgb(P.hor, 0.45 * pw)); hg.addColorStop(1, rgb(P.hor, 0));
      ctx.fillStyle = hg; ctx.fillRect(0, hy - 18, W, 24);
    },

    drawGround(ctx, o, P, pw) {
      const { W, H, hy } = this;
      const g = ctx.createLinearGradient(0, hy, 0, H);
      g.addColorStop(0, rgb(mixRgb(P.road, P.hor, 0.25)));
      g.addColorStop(0.25, rgb(P.road));
      g.addColorStop(1, rgb(mixRgb(P.road, [0, 0, 0], 0.4)));
      ctx.fillStyle = g;
      ctx.fillRect(-20, hy, W + 40, H - hy + 20);

      // grid: lines across that rush toward you, and lines that run to the horizon
      const v = o.speedZ, zN = this.zNear();
      const step = 2, off = (o.t * v) % step;
      ctx.lineWidth = 1;
      const gb = 0.25 + o.pulse * 0.35;
      for (let z = Z_FAR - off; z > zN; z -= step) {
        const y = this.sy(z, 0), a = clamp01(1 - z / Z_FAR) * gb * pw;
        if (a <= 0.01) continue;
        ctx.strokeStyle = rgb(P.grid, a);
        const xl = this.sx(-HALF - 0.15, z), xr = this.sx(HALF + 0.15, z);
        ctx.beginPath(); ctx.moveTo(-10, y); ctx.lineTo(xl, y); ctx.moveTo(xr, y); ctx.lineTo(W + 10, y); ctx.stroke();
      }
      for (let i = 1; i <= 16; i++) {
        for (const side of [-1, 1]) {
          const x = side * (HALF + 0.15 + i * 1.6);
          ctx.strokeStyle = rgb(P.grid, (0.32 - i * 0.012) * gb * pw * 1.6);
          ctx.beginPath();
          ctx.moveTo(this.sx(x, zN), this.sy(zN, 0));
          for (let z = 4; z <= Z_FAR; z += 6) ctx.lineTo(this.sx(x, z), this.sy(z, 0));
          ctx.stroke();
        }
      }
    },

    // A strip of road between two lateral positions, following the bend.
    strip(ctx, x0, x1, z0, z1) {
      const N = 14;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) { const z = z0 + ((z1 - z0) * i) / N; ctx.lineTo(this.sx(x0, z), this.sy(z, 0)); }
      for (let i = N; i >= 0; i--) { const z = z0 + ((z1 - z0) * i) / N; ctx.lineTo(this.sx(x1, z), this.sy(z, 0)); }
      ctx.closePath();
    },
    line3(ctx, x, z0, z1, y) {
      const N = 12;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) { const z = z0 + ((z1 - z0) * i) / N; ctx.lineTo(this.sx(x, z), this.sy(z, y || 0)); }
    },

    drawRoad(ctx, o, P, pw) {
      const zN = this.zNear() - 0.05;
      // surface
      const g = ctx.createLinearGradient(0, this.hy, 0, this.H);
      g.addColorStop(0, rgb(mixRgb(P.road, P.hor, 0.18), 0.96));
      g.addColorStop(1, rgb(mixRgb(P.road, [0, 0, 0], 0.2), 0.97));
      ctx.fillStyle = g;
      this.strip(ctx, -HALF, HALF, zN, Z_FAR);
      ctx.fill();
      // lane glow when a lane is struck
      ctx.globalCompositeOperation = 'lighter';
      for (let l = 0; l < 3; l++) {
        const k = this.press[l];
        if (k <= 0.01) continue;
        const lg = ctx.createLinearGradient(0, this.hitY + 30, 0, this.hy);
        lg.addColorStop(0, rgb(LANE[l], 0.28 * k)); lg.addColorStop(1, rgb(LANE[l], 0));
        ctx.fillStyle = lg;
        this.strip(ctx, l - 1.5, l - 0.5, zN, Z_FAR * 0.6);
        ctx.fill();
      }
      // dashed lane dividers sliding toward you
      const v = o.speedZ, dash = 1.1, period = 3, off = (o.t * v) % period;
      ctx.lineCap = 'round';
      for (const x of [-0.5, 0.5]) {
        for (let z = Z_FAR - off; z > zN - period; z -= period) {
          const z0 = Math.max(zN, z), z1 = Math.min(Z_FAR, z + dash);
          if (z1 <= z0) continue;
          const a = clamp01(1 - z0 / Z_FAR) * 0.55 * pw;
          ctx.strokeStyle = `rgba(200,190,255,${a})`;
          ctx.lineWidth = Math.max(1, this.sc(z0) * 0.035);
          ctx.beginPath(); ctx.moveTo(this.sx(x, z0), this.sy(z0)); ctx.lineTo(this.sx(x, z1), this.sy(z1)); ctx.stroke();
        }
      }
      // rails: wide soft stroke under a thin bright one
      for (const side of [-1, 1]) {
        const x = side * HALF;
        ctx.strokeStyle = rgb(P.rail, (0.22 + o.pulse * 0.25) * pw);
        ctx.lineWidth = 9;
        this.line3(ctx, x, zN, Z_FAR); ctx.stroke();
        ctx.strokeStyle = rgb(mixRgb(P.rail, [255, 255, 255], 0.5), 0.9 * pw);
        ctx.lineWidth = 2;
        this.line3(ctx, x, zN, Z_FAR); ctx.stroke();
      }
      // light pulses that run along the rails on every half beat
      const half = o.beat / 2, glowR = this.glow(P.rail);
      const first = Math.ceil((o.t - o.t0 - 0.3) / half);
      for (let i = first; ; i++) {
        const tb = o.t0 + i * half, z = (tb - o.t) * v;
        if (z > Z_FAR) break;
        if (z < zN) continue;
        const s = this.sc(z) * (i % 2 ? 0.35 : 0.6);
        for (const side of [-1, 1]) {
          ctx.globalAlpha = clamp01(1 - z / Z_FAR) * pw;
          ctx.drawImage(glowR, this.sx(side * HALF, z) - s / 2, this.sy(z) - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },

    // A gate arch over the road on every beat; the downbeat ones are bolder.
    drawArches(ctx, o, P, pw) {
      const v = o.speedZ, zN = 0.6;
      const first = Math.ceil((o.t - o.t0) / o.beat);
      const list = [];
      for (let i = first; ; i++) {
        const z = (o.t0 + i * o.beat - o.t) * v;
        if (z > Z_FAR) break;
        if (z >= zN) list.push([i, z]);
      }
      ctx.lineJoin = 'round';
      for (let j = list.length - 1; j >= 0; j--) {
        const [i, z] = list[j];
        const down = i % 4 === 0;
        const fade = clamp01(1 - z / Z_FAR) * clamp01((z - zN) / 2.5) * pw;
        if (fade <= 0.01) continue;
        const w = HALF + 0.55, h = down ? 2.5 : 2.2, s = this.sc(z);
        const xl = this.sx(-w, z), xr = this.sx(w, z), yb = this.sy(z, 0), yt = this.sy(z, h), ys = this.sy(z, h - 0.35);
        const col = down ? P.ring : P.grid;
        ctx.strokeStyle = rgb(col, (down ? 0.32 : 0.16) * fade);
        ctx.lineWidth = Math.max(2, s * (down ? 0.22 : 0.12));
        ctx.beginPath(); ctx.moveTo(xl, yb); ctx.lineTo(xl, ys); ctx.lineTo(xl + (xr - xl) * 0.12, yt); ctx.lineTo(xr - (xr - xl) * 0.12, yt); ctx.lineTo(xr, ys); ctx.lineTo(xr, yb); ctx.stroke();
        ctx.strokeStyle = rgb(mixRgb(col, [255, 255, 255], 0.4), (down ? 0.95 : 0.6) * fade);
        ctx.lineWidth = Math.max(1, s * 0.025);
        ctx.stroke();
      }
    },

    drawReceptors(ctx, o, pw) {
      const z = 0;
      for (let l = 0; l < 3; l++) {
        const x = l - 1, k = this.press[l];
        const x0 = this.sx(x - 0.42, z), x1 = this.sx(x + 0.42, z);
        const y0 = this.sy(z - 0.14, 0), y1 = this.sy(z + 0.14, 0);
        const xf0 = this.sx(x - 0.42, z + 0.14), xf1 = this.sx(x + 0.42, z + 0.14);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(xf1, y1); ctx.lineTo(xf0, y1); ctx.closePath();
        ctx.fillStyle = rgb(LANE[l], (0.08 + k * 0.35) * pw);
        ctx.fill();
        ctx.strokeStyle = rgb(LANE[l], (0.55 + k * 0.45) * pw);
        ctx.lineWidth = 2 + k * 2;
        ctx.stroke();
        // approach ring: closes in on the receptor as the next note in this lane arrives
        const next = o.nextIn ? o.nextIn[l] : null;
        if (next !== null && next < o.beat * 1.5) {
          const q = clamp01(next / (o.beat * 1.5));
          const cx = (x0 + x1 + xf0 + xf1) / 4, cy = (y0 + y1) / 2, rw = (x1 - x0) * (0.55 + q * 0.9);
          ctx.strokeStyle = rgb(LANE[l], (1 - q) * 0.8 * pw);
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.ellipse(cx, cy, rw, rw * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
    },
    // key hints under the receptors, drawn after the ship so it never covers them
    drawHints(ctx, o) {
      if (!o.hints || !o.glyphs) return;
      for (let l = 0; l < 3; l++) {
        const x = l - 1, gx = this.sx(x, 0) + (l - 1) * 6, gy = this.sy(-0.14, 0) + 16;
        ctx.globalAlpha = 0.85;
        BS.Draw.keycap(ctx, o.glyphs[l], gx, gy, 11, rgb(LANE[l], 0.95), 'center');
        ctx.globalAlpha = 1;
      }
    },

    // One note: a glowing extruded tile riding the lane.
    tile(ctx, x0, x1, z, depth, h, col, alpha, shape) {
      const za = z - depth / 2, zb = z + depth / 2;
      const ax = this.sx(x0, za), bx = this.sx(x1, za), cx = this.sx(x1, zb), dx = this.sx(x0, zb);
      const ay = this.sy(za, h), cy = this.sy(zb, h), fy = this.sy(za, 0);
      const s = this.sc(z);
      // glow on the road beneath
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.7;
      const gs = (bx - ax) * 1.5;
      ctx.drawImage(this.glow(col), (ax + bx) / 2 - gs / 2, fy - gs * 0.28, gs, gs * 0.5);
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = 'source-over';
      // front face
      ctx.fillStyle = rgb(mixRgb(col, [20, 0, 40], 0.45));
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, ay); ctx.lineTo(bx, fy); ctx.lineTo(ax, fy); ctx.closePath(); ctx.fill();
      // top face
      const g = ctx.createLinearGradient(0, cy, 0, ay);
      g.addColorStop(0, rgb(col)); g.addColorStop(1, rgb(mixRgb(col, [255, 255, 255], 0.55)));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, ay); ctx.lineTo(cx, cy); ctx.lineTo(dx, cy); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1, s * 0.02);
      ctx.stroke();
      // a lane symbol on top, so lanes read without colour too
      if (shape !== null && s > 30) {
        const mx = (ax + bx + cx + dx) / 4, my = (ay + cy) / 2, r = s * 0.12, q = Math.max(0.25, (ay - cy) / (bx - ax) * 2.2);
        ctx.save(); ctx.translate(mx, my); ctx.scale(1, q);
        ctx.fillStyle = 'rgba(30,0,40,0.55)';
        ctx.beginPath();
        if (shape === 0) { ctx.moveTo(-r, 0); ctx.lineTo(r * 0.7, -r); ctx.lineTo(r * 0.7, r); }
        else if (shape === 1) { ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); }
        else if (shape === 2) { ctx.moveTo(r, 0); ctx.lineTo(-r * 0.7, -r); ctx.lineTo(-r * 0.7, r); }
        else { for (let k = -1; k <= 1; k++) { ctx.moveTo(k * r * 2.2 - r * 0.5, -r * 0.8); ctx.lineTo(k * r * 2.2 + r * 0.5, 0); ctx.lineTo(k * r * 2.2 - r * 0.5, r * 0.8); } }
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },

    drawNotes(ctx, o) {
      const v = o.speedZ, zN = this.zNear();
      const notes = o.notes;
      if (!notes) return;
      // find the visible slice, then draw far to near
      let hiIdx = -1, loIdx = notes.length;
      for (let i = o.firstVisible || 0; i < notes.length; i++) {
        const z = (notes[i].t - o.t) * v;
        if (z > Z_FAR) break;
        if (z < zN - 0.5) continue;
        if (i < loIdx) loIdx = i;
        hiIdx = i;
      }
      for (let i = hiIdx; i >= loIdx; i--) {
        const n = notes[i];
        if (n.res === 'perfect' || n.res === 'good') continue;
        const z = (n.t - o.t) * v;
        if (z < zN - 0.5 || z > Z_FAR) continue;
        const fade = clamp01((Z_FAR - z) / 10);
        const missed = n.res === 'miss';
        if (n.kind === 'wide') {
          this.tile(ctx, -HALF + 0.12, HALF - 0.12, z, 0.26, 0.1, missed ? MISS : WIDE, fade * (missed ? 0.35 : 1) * this.power, 3);
        } else {
          const x = n.lane - 1;
          this.tile(ctx, x - 0.36, x + 0.36, z, 0.34, 0.14, missed ? MISS : LANE[n.lane], fade * (missed ? 0.35 : 1) * this.power, o.laneLook ? n.lane : null);
        }
      }
    },

    drawFx(ctx, o) {
      ctx.globalCompositeOperation = 'lighter';
      // beams shooting up the lane toward the horizon
      for (const b of this.beams) {
        const k = 1 - b.t / 0.35;
        const x0 = b.lane === -1 ? -HALF : b.lane - 1.5, x1 = b.lane === -1 ? HALF : b.lane - 0.5;
        const g = ctx.createLinearGradient(0, this.hitY, 0, this.hy);
        g.addColorStop(0, rgb(b.col, 0.55 * k)); g.addColorStop(1, rgb(b.col, 0));
        ctx.fillStyle = g;
        this.strip(ctx, x0 + 0.08, x1 - 0.08, 0, Z_FAR * (0.3 + 0.7 * (1 - k)));
        ctx.fill();
      }
      // shock rings on the road
      for (const r of this.rings) {
        if (r.t < 0) continue;
        const k = r.t / 0.5, cx = this.sx(r.x, r.z), cy = this.sy(r.z), s = this.sc(r.z);
        const rw = s * (r.wide ? 1.1 : 0.45) * (0.6 + k * 1.2);
        ctx.strokeStyle = rgb(r.col, (1 - k) * 0.9);
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath(); ctx.ellipse(cx, cy, rw, rw * 0.24, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // sparks
      for (const p of this.parts) {
        const a = p.life / p.max;
        ctx.fillStyle = rgb(p.col, a);
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalCompositeOperation = 'source-over';
    },

    // The player's ship: a low neon dart that skates between lanes.
    drawPod(ctx, o, P, pw) {
      const X = this.podX, Z = POD_Z, bank = this.bank;
      const bob = Math.sin((o.beatPos || 0) * Math.PI * 2) * 0.012;
      const pt = (x, y, z) => [this.sx(X + x, Z + z), this.sy(Z + z, 0.07 + bob + y + x * -bank * 0.5)];
      const nose = pt(0, 0.04, 0.34), top = pt(0, 0.15, -0.05);
      const wl = pt(-0.27, 0.0, -0.17), wr = pt(0.27, 0.0, -0.17);
      const tl = pt(-0.1, 0.08, -0.21), tr = pt(0.1, 0.08, -0.21);
      // shadow / underglow on the road
      ctx.globalCompositeOperation = 'lighter';
      const ug = this.glow(LANE[clamp(Math.round(X + 1), 0, 2)]);
      const ux = this.sx(X, Z), uy = this.sy(Z, 0), us = this.sc(Z) * 0.9;
      ctx.globalAlpha = 0.55 * pw;
      ctx.drawImage(ug, ux - us / 2, uy - us * 0.18, us, us * 0.36);
      // engine trail streaming back toward the camera
      ctx.globalAlpha = pw;
      for (const side of [-1, 1]) {
        const e = pt(side * 0.075, 0.07, -0.21), far = pt(side * 0.075, 0.07, -0.9);
        const g = ctx.createLinearGradient(e[0], e[1], far[0], far[1]);
        g.addColorStop(0, rgb(P.rail, 0.8)); g.addColorStop(1, rgb(P.rail, 0));
        ctx.strokeStyle = g; ctx.lineWidth = this.sc(Z) * 0.05 * (1 + (o.pulse || 0) * 0.6);
        ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(far[0], far[1]); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const face = (pts, fill) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
      face([nose, top, tl, wl], '#1a0b33');
      face([nose, wr, tr, top], '#24104a');
      face([tl, top, tr], '#120624');
      // neon edges
      ctx.strokeStyle = rgb(mixRgb(P.rail, [255, 255, 255], 0.45), pw);
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(wl[0], wl[1]); ctx.lineTo(nose[0], nose[1]); ctx.lineTo(wr[0], wr[1]); ctx.lineTo(tr[0], tr[1]); ctx.lineTo(tl[0], tl[1]); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(nose[0], nose[1]); ctx.lineTo(top[0], top[1]); ctx.stroke();
      // canopy light
      ctx.fillStyle = rgb([200, 250, 255], 0.75 * pw);
      ctx.beginPath(); ctx.arc((top[0] * 2 + nose[0]) / 3, (top[1] * 2 + nose[1]) / 3, Math.max(1.5, this.sc(Z) * 0.016), 0, Math.PI * 2); ctx.fill();
      // strike bolt from the nose to the receptor
      if (this.strike) {
        const k = 1 - this.strike.t / 0.12, l = this.strike.lane;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgb(LANE[l], k);
        ctx.lineWidth = 3 * k + 1;
        ctx.beginPath(); ctx.moveTo(nose[0], nose[1]); ctx.lineTo(this.sx(l - 1, 0), this.sy(0, 0.05)); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    },

    drawPops(ctx, o) {
      const D = BS.Draw;
      for (const p of this.pops) {
        const k = p.t / 0.6, x = this.sx(p.x, 0), y = this.sy(0, 0.6) - k * 40;
        const s = 1 + 0.35 * Math.max(0, 1 - p.t * 8);
        ctx.globalAlpha = 1 - Math.pow(k, 2);
        D.text(ctx, p.text, x, y, 17 * s, rgb(p.col), 'center', 700, { glow: rgb(p.col, 0.5), spacing: 2 });
        ctx.globalAlpha = 1;
      }
      const b = this.banner;
      if (b) {
        const t = b.t, inK = BS.easeOut(t / 0.35), outK = clamp01((t - 1.3) / 0.5);
        const y = this.hy - this.layers.skyH * (b.small ? 0.25 : 0.55);
        ctx.globalAlpha = inK * (1 - outK);
        const x = this.W / 2 + (1 - inK) * 60 - outK * 60;
        D.text(ctx, b.text, x, y, b.small ? 20 : 30, rgb(mixRgb(b.col, [255, 255, 255], 0.5)), 'center', 700, { glow: rgb(b.col, 0.7), spacing: b.small ? 4 : 10, display: !b.small });
        ctx.globalAlpha = 1;
      }
    },
  };

  BS.Scene = S;
  BS.Z_FAR = Z_FAR;
})();
