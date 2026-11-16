// Jungle Getaway renderer: a behind-the-runner camera over a winding temple
// causeway, drawn with hand-rolled perspective on a 2D canvas.
//
// World units are the rules' "paces": x across the path (lanes at -70/0/70),
// y up, z forward from the runner. The camera sits CAM_BACK behind and CAM_H
// above the runner. The path bends and rolls (purely visual) by integrating a
// curvature profile along the absolute distance, and everything is drawn far
// to near, strip by strip, so scenery and obstacles overlap correctly.
(function (root) {
  'use strict';
  const R = root.JG.Rules;
  const LANE = 70, ROADW = 122, SEG = 40, NSEG = 82, CAM_BACK = 260, CAM_H = 235;
  const ZFAR = NSEG * SEG;

  // ---------- colour helpers ----------
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => `rgb(${(a[0] + (b[0] - a[0]) * t) | 0},${(a[1] + (b[1] - a[1]) * t) | 0},${(a[2] + (b[2] - a[2]) * t) | 0})`;
  const PAL = {
    fog: hex('#b9b98c'), ground: hex('#24361f'), ground2: hex('#2c4224'), verge: hex('#3e5a2a'),
    stoneA: hex('#8d8a76'), stoneB: hex('#7d7a68'), stoneC: hex('#96927b'), seam: hex('#4f4c40'),
    wallTop: hex('#a39f86'), wallFace: hex('#6a6756'), moss: hex('#5f7f35'),
  };
  // deterministic hash for scenery
  const hash = (n) => { n = (n ^ 61) ^ (n >>> 16); n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; };
  const hash2 = (a, b) => hash(Math.imul(a, 73856093) ^ Math.imul(b + 7, 19349663));

  // visual path shape: lateral and vertical curvature by absolute distance
  const curveX = (D) => 0.000105 * (Math.sin(D * 0.00041) * 0.8 + Math.sin(D * 0.00113 + 1.3) * 0.55);
  const curveY = (D) => 0.000032 * Math.sin(D * 0.00071 + 0.4);

  const Rd = {
    W: 0, H: 0, v: null, sky: null, canopy: null, vignette: null, rays: null,
    parts: [], heading: 0, rearT: 0, flash: 0,

    resize(W, H) {
      this.W = W; this.H = H;
      const portrait = W < H;
      // the camera sits high so the track ahead shows above the runner's head
      const s0 = Math.min((portrait ? 0.8 : 0.56) * Math.min(W, H * 1.25) / (LANE * 3), 0.62 * H / CAM_H);
      let hy = 0.81 * H - CAM_H * s0;
      hy = Math.max(0.17 * H, Math.min(0.5 * H, hy));
      this.v = { cx: W / 2, hy, f: s0 * CAM_BACK, s0 };
      this.prerender();
    },

    // ---------- static layers ----------
    prerender() {
      const { W, H } = this, hy = this.v.hy;
      const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
      // sky panorama: twice the screen wide so it can wrap as the path turns
      const pw = Math.ceil(W * 2), ph = Math.ceil(hy + 40);
      const sky = mk(pw, ph), g = sky.getContext('2d');
      const grd = g.createLinearGradient(0, 0, 0, ph);
      grd.addColorStop(0, '#1f5560'); grd.addColorStop(0.45, '#5f9a86'); grd.addColorStop(0.8, '#e6cf8a'); grd.addColorStop(1, '#f4dc98');
      g.fillStyle = grd; g.fillRect(0, 0, pw, ph);
      // low sun with a halo
      const sx = pw * 0.3, sy = hy * 0.62;
      const halo = g.createRadialGradient(sx, sy, 0, sx, sy, hy * 0.9);
      halo.addColorStop(0, 'rgba(255,240,190,0.95)'); halo.addColorStop(0.12, 'rgba(255,226,150,0.7)'); halo.addColorStop(1, 'rgba(255,220,150,0)');
      g.fillStyle = halo; g.fillRect(0, 0, pw, ph);
      g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(sx, sy, Math.max(10, hy * 0.08), 0, 6.283); g.fill();
      // soft cloud bands
      g.fillStyle = 'rgba(255,240,210,0.22)';
      for (let i = 0; i < 14; i++) {
        const cx = hash(i * 7 + 1) * pw, cy = hy * (0.15 + hash(i * 7 + 2) * 0.45), r = hy * (0.06 + hash(i * 7 + 3) * 0.08);
        for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx + k * r * 0.9, cy + Math.sin(k) * r * 0.2, r * 1.2, r * 0.38, 0, 0, 6.283); g.fill(); }
      }
      // two mountain ridges and the distant temple
      const ridge = (base, amp, color, seed, step) => {
        g.fillStyle = color; g.beginPath(); g.moveTo(0, ph);
        for (let x = 0; x <= pw; x += step) {
          const u = (x / pw) * 6.283;
          const y = base - amp * (0.55 + 0.3 * Math.sin(u * 3 + seed) + 0.18 * Math.sin(u * 7 + seed * 2) + 0.08 * Math.sin(u * 17 + seed));
          g.lineTo(x, y);
        }
        g.lineTo(pw, ph); g.fill();
      };
      ridge(hy + 2, hy * 0.42, '#7fa39a', 1.1, 8);
      // stepped pyramid temples on the far ridge
      for (const [tx, ts] of [[0.62, 1], [0.12, 0.7], [1.62, 0.85], [1.12, 0.6]]) {
        const bx = tx * W, bw = hy * 0.5 * ts, by = hy + 2;
        g.fillStyle = '#6c8f88';
        for (let k = 0; k < 5; k++) {
          const w = bw * (1 - k * 0.17), h = bw * 0.12;
          g.fillRect(bx - w / 2, by - (k + 1) * h - bw * 0.05, w, h + 1);
        }
        g.fillRect(bx - bw * 0.09, by - bw * 0.72, bw * 0.18, bw * 0.14);
      }
      ridge(hy + 4, hy * 0.24, '#5c816f', 4.2, 6);
      this.sky = sky;

      // canopy treeline right at the horizon (separate for parallax)
      const cw = Math.ceil(W * 2), chh = Math.ceil(hy * 0.4 + 30);
      const can = mk(cw, chh), c2 = can.getContext('2d');
      for (let layer = 0; layer < 2; layer++) {
        c2.fillStyle = layer ? '#3f5f3c' : '#567a55';
        for (let i = 0; i < 90; i++) {
          const x = hash(i * 13 + layer * 999) * cw, r = chh * (0.18 + hash(i * 13 + 5 + layer) * 0.3) * (layer ? 0.8 : 1);
          c2.beginPath(); c2.arc(x, chh - r * 0.35 - layer * 4, r, 0, 6.283); c2.fill();
          if (x < r) { c2.beginPath(); c2.arc(x + cw, chh - r * 0.35 - layer * 4, r, 0, 6.283); c2.fill(); }
          if (x > cw - r) { c2.beginPath(); c2.arc(x - cw, chh - r * 0.35 - layer * 4, r, 0, 6.283); c2.fill(); }
        }
        c2.fillRect(0, chh - 6, cw, 6);
      }
      this.canopy = can;

      // vignette and light shafts
      const vg = mk(W, H), v2 = vg.getContext('2d');
      const rg = v2.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.hypot(W, H) * 0.62);
      rg.addColorStop(0, 'rgba(10,20,8,0)'); rg.addColorStop(1, 'rgba(6,14,6,0.62)');
      v2.fillStyle = rg; v2.fillRect(0, 0, W, H);
      this.vignette = vg;
      const rays = mk(W, H), r2 = rays.getContext('2d');
      for (let i = 0; i < 7; i++) {
        const x = W * (0.05 + i * 0.15 + hash(i + 40) * 0.08), w = W * (0.03 + hash(i + 50) * 0.05);
        const lg = r2.createLinearGradient(0, 0, 0, H);
        lg.addColorStop(0, 'rgba(255,236,170,0.16)'); lg.addColorStop(0.7, 'rgba(255,236,170,0.04)'); lg.addColorStop(1, 'rgba(255,236,170,0)');
        r2.fillStyle = lg;
        r2.beginPath(); r2.moveTo(x, 0); r2.lineTo(x + w, 0); r2.lineTo(x + w * 3 + W * 0.25, H); r2.lineTo(x + W * 0.25, H); r2.fill();
      }
      this.rays = rays;
    },

    // ---------- particles (world space, absolute distance) ----------
    burst(kind, D, x, y, n, opt) {
      if (this.parts.length > 400) return;
      opt = opt || {};
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, sp = (opt.speed || 120) * (0.4 + Math.random());
        this.parts.push({
          kind, D: D + (Math.random() - 0.5) * (opt.spreadZ || 10), x: x + (Math.random() - 0.5) * (opt.spreadX || 10), y: y + Math.random() * (opt.spreadY || 4),
          vx: Math.cos(a) * sp, vy: (opt.up || 80) * (0.5 + Math.random()), vz: Math.sin(a) * sp * 0.6 + (opt.vz || 0),
          life: (opt.life || 0.7) * (0.6 + Math.random() * 0.6), max: 0, size: (opt.size || 3) * (0.6 + Math.random() * 0.8),
          color: opt.color || '#d9c79a', grav: opt.grav === undefined ? 420 : opt.grav, rot: Math.random() * 6,
        });
        this.parts[this.parts.length - 1].max = this.parts[this.parts.length - 1].life;
      }
    },
    stepParticles(dt, D, motion) {
      // ambient leaves drift down through the canopy
      if (motion && Math.random() < dt * 5 && this.parts.length < 300) {
        this.parts.push({ kind: 'leaf', D: D + 200 + Math.random() * 1400, x: (Math.random() - 0.5) * 900, y: 260 + Math.random() * 120, vx: (Math.random() - 0.5) * 30, vy: -30, vz: 0, life: 6, max: 6, size: 6 + Math.random() * 5, color: Math.random() < 0.5 ? '#9bbf4a' : '#d9a441', grav: 0, rot: Math.random() * 6 });
      }
      for (const p of this.parts) {
        p.life -= dt; p.vy -= p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.D += p.vz * dt; p.rot += dt * 3;
        if (p.kind === 'leaf') p.vx = Math.sin(p.life * 2 + p.rot) * 40;
        if (p.y < 0 && p.kind !== 'leaf') { p.y = 0; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      }
      this.parts = this.parts.filter((p) => p.life > 0 && p.D > D - CAM_BACK);
    },

    // ---------- main draw ----------
    // view: { sim, time, hat, settings, intro (0..1 camera swoop), over (0..), pitch }
    draw(ctx, view) {
      const { W, H } = this, v = this.v, sim = view.sim, p = sim.p, set = view.settings;
      const motion = set.motion;
      const D = sim.d;
      const t = view.time;
      // camera: follows the runner sideways a little, bobs with the stride
      const lift = view.intro ? (1 - view.intro) : 0;
      const camX = p.x * LANE * 0.72;
      const bob = motion && sim.state === 'playing' ? Math.sin(D * 0.06) * 2.2 : 0;
      const camY = CAM_H + lift * 260 + bob + Math.max(0, p.h) * 0.35;
      const camBack = CAM_BACK + lift * 380;
      const f = v.f * (1 + lift * 0.4);
      const hy = v.hy + lift * v.hy * 0.25;
      const cx = v.cx;

      ctx.save();
      // shake + lean into lane changes
      let sh = view.shake || 0;
      if (sh > 0 && set.shake) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
      if (motion) {
        const lean = (p.lane - p.x) * -0.035;
        ctx.translate(cx, H * 0.8); ctx.rotate(lean); ctx.translate(-cx, -H * 0.8);
      }

      // ---- sky and far layers (scroll with the turning heading) ----
      const skyW = this.sky.width;
      let off = ((this.heading * W * 0.9) % skyW + skyW) % skyW;
      const skyY = hy - v.hy; // follows intro lift
      ctx.drawImage(this.sky, -off, skyY); ctx.drawImage(this.sky, skyW - off, skyY);
      if (skyY > 0) { ctx.fillStyle = '#1f5560'; ctx.fillRect(0, 0, W, skyY + 1); }
      const cw = this.canopy.width;
      off = ((this.heading * W * 1.6) % cw + cw) % cw;
      const cy = hy - this.canopy.height + 4;
      ctx.drawImage(this.canopy, -off, cy); ctx.drawImage(this.canopy, cw - off, cy);
      ctx.fillStyle = mix(PAL.fog, PAL.ground, 0.15); ctx.fillRect(0, hy, W, H - hy + 40);

      // ---- path geometry for this frame ----
      const phase = ((D % SEG) + SEG) % SEG;
      const K0 = Math.ceil((camBack - 6) / SEG); // segments behind the runner
      const nb = NSEG + K0 + 1;
      const Z = new Float32Array(nb), OX = new Float32Array(nb), OY = new Float32Array(nb);
      let sx = 0, sy = 0, ox = 0, oy = 0;
      for (let i = 0; i < nb; i++) {
        const z = (i - K0) * SEG - phase;
        Z[i] = Math.max(z, -camBack + 6);
        if (z > 0) { sx += curveX(D + z) * SEG; sy += curveY(D + z) * SEG; ox += sx * SEG; oy += sy * SEG; }
        OX[i] = ox; OY[i] = oy;
      }
      const offAt = (z) => {
        const fi = (z + phase) / SEG + K0;
        const i = Math.max(0, Math.min(nb - 2, Math.floor(fi))), k = Math.max(0, Math.min(1, fi - i));
        return [OX[i] + (OX[i + 1] - OX[i]) * k, OY[i] + (OY[i + 1] - OY[i]) * k];
      };
      // project with a given path offset
      const P = (x, y, z, o) => {
        const dz = z + camBack;
        const s = f / dz;
        return [cx + (x + o[0] - camX) * s, hy - (y + o[1] - camY) * s, s];
      };
      const fogAt = (z) => Math.max(0, Math.min(1, (z - 500) / (ZFAR - 700)));
      this._P = P;
      this._near = -camBack + 14;

      // drawables binned by strip; each has the z it sorts at
      const bins = new Array(nb);
      const binOf = (z) => Math.max(0, Math.min(nb - 2, Math.floor((z + phase) / SEG) + K0));
      const add = (z, item) => { const i = binOf(z); item.z = z; (bins[i] || (bins[i] = [])).push(item); };
      for (const th of sim.things) {
        const z = th.x - D;
        if (z > ZFAR || z < -camBack - 140) continue;
        if (th.type === 'coin') { if (!th.done && z > -camBack + 10) add(z, { th, part: 0 }); }
        else if (th.type === 'log') add(z + R.LEN.log / 2, { th, part: 0 });
        else if (th.type === 'branch') { add(z + 100, { th, part: 2 }); add(z + 18, { th, part: 1 }); }
      }
      for (const p of this.parts) { const z = p.D - D; if (z > -camBack + 10 && z < ZFAR) add(z, { part: -1, p }); }
      add(0.01, { part: -2 });
      const pits = sim.things.filter((th) => th.type === 'pit' && th.x - D < ZFAR && th.x + R.LEN.pit - D > -camBack);
      const jBase = Math.floor(D / SEG);

      // ---- strips, far to near ----
      for (let i = nb - 2; i >= 0; i--) {
        const zn = Z[i], zf = Z[i + 1];
        if (zf <= zn) continue;
        const on = [OX[i], OY[i]], of = [OX[i + 1], OY[i + 1]];
        const fog = fogAt(zn);
        const j = jBase + i - K0;
        // ground band
        const gl1 = P(-3000, 0, zn, on), gr1 = P(3000, 0, zn, on), gl2 = P(-3000, 0, zf, of), gr2 = P(3000, 0, zf, of);
        ctx.fillStyle = mix(j & 1 ? PAL.ground : PAL.ground2, PAL.fog, fog);
        quad(ctx, gl1, gr1, gr2, gl2);
        // verges with moss
        for (const side of [-1, 1]) {
          const a1 = P(side * ROADW, 0, zn, on), a2 = P(side * (ROADW + 170), 0, zn, on), b2 = P(side * (ROADW + 170), 0, zf, of), b1 = P(side * ROADW, 0, zf, of);
          ctx.fillStyle = mix(PAL.verge, PAL.fog, fog * 0.9 + (hash2(j, side) * 0.12));
          quad(ctx, a1, a2, b2, b1);
        }
        // road: lane-wide flagstones, each its own shade
        const cols = [-ROADW, -105, -35, 35, 105, ROADW];
        for (let c = 0; c < 5; c++) {
          const h = hash2(j, c);
          const base = c === 0 || c === 4 ? PAL.stoneB : h < 0.33 ? PAL.stoneA : h < 0.66 ? PAL.stoneB : PAL.stoneC;
          ctx.fillStyle = mix(base, PAL.fog, fog);
          const a = P(cols[c], 0, zn, on), b = P(cols[c + 1], 0, zn, on), cc = P(cols[c + 1], 0, zf, of), d = P(cols[c], 0, zf, of);
          quad(ctx, a, b, cc, d);
          if (h > 0.86 && fog < 0.7) {
            // creeping moss on this flagstone
            ctx.fillStyle = mix(PAL.moss, PAL.fog, fog);
            const m1 = P(cols[c] + 6, 0, zn + 6, on), m2 = P(cols[c + 1] - 10, 0, zn + 10, on), m3 = P(cols[c + 1] - 20, 0, zf - 8, of);
            ctx.beginPath(); ctx.moveTo(m1[0], m1[1]); ctx.lineTo(m2[0], m2[1]); ctx.lineTo(m3[0], m3[1]); ctx.fill();
          }
        }
        // seams and lane grooves
        if (fog < 0.85) {
          ctx.strokeStyle = mix(PAL.seam, PAL.fog, fog);
          const s1 = P(-ROADW, 0, zn, on), s2 = P(ROADW, 0, zn, on);
          ctx.lineWidth = Math.max(0.5, s1[2] * 1.6);
          ctx.beginPath(); ctx.moveTo(s1[0], s1[1]); ctx.lineTo(s2[0], s2[1]);
          for (const lx of [-105, -35, 35, 105]) { const u1 = P(lx, 0, zn, on), u2 = P(lx, 0, zf, of); ctx.moveTo(u1[0], u1[1]); ctx.lineTo(u2[0], u2[1]); }
          ctx.stroke();
        }
        // pit holes clipped to this strip
        for (const pt of pits) {
          const a0 = pt.x - D, a1 = a0 + R.LEN.pit;
          const z0 = Math.max(a0, zn), z1 = Math.min(a1, zf);
          if (z1 <= z0) continue;
          const o0 = offAt(z0), o1 = offAt(z1);
          for (let l = 0; l < 3; l++) {
            if (!pt.lanes[l]) continue;
            let xl = (l - 1) * LANE - 35, xr = (l - 1) * LANE + 35;
            if (l === 0 || !pt.lanes[l - 1]) xl += 4; else xl -= 1;
            if (l === 2 || !pt.lanes[l + 1]) xr -= 4; else xr += 1;
            if (l === 0) xl = -ROADW + 4; if (l === 2) xr = ROADW - 4;
            ctx.fillStyle = '#0b0805';
            quad(ctx, P(xl, 0, z0, o0), P(xr, 0, z0, o0), P(xr, 0, z1, o1), P(xl, 0, z1, o1));
            if (a1 <= zf && a1 > zn) {
              // the far wall of the pit, lit from above
              const w1 = P(xl, 0, a1, o1), w2 = P(xr, 0, a1, o1), w3 = P(xr, -70, a1, o1), w4 = P(xl, -70, a1, o1);
              const gg = ctx.createLinearGradient(0, w1[1], 0, w4[1]);
              gg.addColorStop(0, '#5a4630'); gg.addColorStop(1, '#0b0805');
              ctx.fillStyle = gg; quad(ctx, w1, w2, w3, w4);
            }
          }
        }
        // low carved walls along both edges
        for (const side of [-1, 1]) {
          const xi = side * ROADW, xo = side * (ROADW + 22);
          const a = P(xi, 0, zn, on), b = P(xi, 28, zn, on), c = P(xi, 28, zf, of), d = P(xi, 0, zf, of);
          ctx.fillStyle = mix(j % 3 === 0 ? PAL.seam : PAL.wallFace, PAL.fog, fog);
          quad(ctx, a, b, c, d);
          const e = P(xo, 28, zn, on), g2 = P(xo, 28, zf, of);
          ctx.fillStyle = mix(PAL.wallTop, PAL.fog, fog);
          quad(ctx, b, e, g2, c);
          if ((j & 3) === 0 && fog < 0.7) {
            // a carved glyph block
            ctx.fillStyle = mix(hex('#4a473a'), PAL.fog, fog);
            const m = P(xi, 14, (zn + zf) / 2, [(on[0] + of[0]) / 2, (on[1] + of[1]) / 2]);
            const r = Math.max(1, m[2] * 6);
            ctx.fillRect(m[0] - r * 0.15, m[1] - r, r * 0.3, r * 2);
          }
        }
        // scenery + things standing on this strip
        if (i < nb - 1) this.scenery(ctx, j, (zn + zf) / 2, offAt((zn + zf) / 2), P, fog, t);
        const list = bins[i];
        if (list) {
          list.sort((a, b) => b.z - a.z);
          for (const it of list) {
            if (it.part === -2) this.runner(ctx, view, P);
            else if (it.part === -1) this.particle(ctx, it.p, it.z, offAt, P);
            else this.thing(ctx, it.th, it.th.x - D, it.part, offAt, fogAt(it.z), t, Math.max(0, Math.min(1, (it.z + 150) / 130)));
          }
        }
      }

      // boulder shadow creeping along the path from behind
      this.boulderShadow(ctx, view, P, offAt, camBack);
      ctx.restore();

      // foreground: hanging vines, light, vignette
      this.foreground(ctx, view);
    },

    // ---------- scenery ----------
    scenery(ctx, j, z, o, P, fog, t) {
      if (fog > 0.97) return;
      const alpha = 1 - fog * 0.85;
      ctx.globalAlpha = alpha;
      const h1 = hash(j * 3 + 1), h2 = hash(j * 3 + 2), h3 = hash(j * 3 + 3);
      // trees on both sides (outermost first)
      for (const side of [-1, 1]) {
        const hs = side < 0 ? h1 : h2;
        if (hs < 0.55) this.tree(ctx, side * (ROADW + 170 + hs * 420), z + hs * 20, o, P, 0.7 + hs * 0.8, j * side);
        if (hash(j * 11 + side) < 0.65) this.fern(ctx, side * (ROADW + 40 + hash(j * 17 + side) * 40), z, o, P, j + side);
      }
      // gateway arch every 48 segments, pillars every 6
      if (j % 48 === 24) this.arch(ctx, z, o, P, t);
      else if (j % 6 === 0) {
        for (const side of [-1, 1]) this.pillar(ctx, side * (ROADW + 50), z, o, P, hash(j * 5 + side) < 0.3 ? 90 + h3 * 40 : 220 + h3 * 60, side);
      }
      if (j % 37 === 11) this.statue(ctx, (h3 < 0.5 ? -1 : 1) * (ROADW + 110), z, o, P);
      ctx.globalAlpha = 1;
    },

    tree(ctx, x, z, o, P, size, seed) {
      const b = P(x, 0, z, o);
      if (b[0] < -600 * b[2] || b[0] > this.W + 600 * b[2]) return;
      const s = b[2] * size;
      const th = 300 * s;
      if (th < 2) return;
      // buttress trunk
      ctx.fillStyle = '#3b2c1c';
      ctx.beginPath();
      ctx.moveTo(b[0] - 26 * s, b[1]); ctx.lineTo(b[0] - 9 * s, b[1] - th); ctx.lineTo(b[0] + 9 * s, b[1] - th); ctx.lineTo(b[0] + 26 * s, b[1]);
      ctx.fill();
      ctx.fillStyle = '#4d3a25';
      ctx.fillRect(b[0] - 3 * s, b[1] - th, 6 * s, th);
      // canopy clusters
      const cols = ['#1f3d1c', '#2b5226', '#3a6a2e'];
      for (let k = 0; k < 6; k++) {
        const a = hash(seed * 31 + k), r = (60 + a * 50) * s;
        ctx.fillStyle = cols[k % 3];
        ctx.beginPath(); ctx.arc(b[0] + (a - 0.5) * 150 * s, b[1] - th - (hash(seed + k * 7) - 0.3) * 60 * s, r, 0, 6.283); ctx.fill();
      }
      // vines hanging from the canopy
      if (s > 0.4) {
        ctx.strokeStyle = '#3f6a2a'; ctx.lineWidth = Math.max(1, 2.5 * s);
        ctx.beginPath();
        for (let k = 0; k < 3; k++) { const vx = b[0] + (k - 1) * 40 * s; ctx.moveTo(vx, b[1] - th); ctx.quadraticCurveTo(vx + 8 * s, b[1] - th * 0.6, vx, b[1] - th * (0.35 + hash(seed + k) * 0.3)); }
        ctx.stroke();
      }
    },

    fern(ctx, x, z, o, P, seed) {
      const b = P(x, 0, z, o), s = b[2];
      if (s < 0.05) return;
      ctx.fillStyle = hash(seed) < 0.5 ? '#3d6b2b' : '#4f7d31';
      for (let k = 0; k < 5; k++) {
        const a = -2.6 + k * 0.32;
        ctx.beginPath();
        ctx.ellipse(b[0] + Math.cos(a) * 18 * s, b[1] + Math.sin(a) * 16 * s, 26 * s, 6 * s, a, 0, 6.283);
        ctx.fill();
      }
    },

    // extruded stone box: draws front, inner side and (if visible) top
    box(ctx, x0, x1, y0, y1, z0, z1, o, P, front, side, top) {
      const a = P(x0, y0, z0, o), b = P(x1, y0, z0, o), c = P(x1, y1, z0, o), d = P(x0, y1, z0, o);
      const camSideRight = a[0] > this.v.cx; // box is right of centre: its left face shows
      const e = P(camSideRight ? x0 : x1, y0, z1, o), g = P(camSideRight ? x0 : x1, y1, z1, o);
      ctx.fillStyle = side;
      if (camSideRight) quad(ctx, a, e, g, d); else quad(ctx, b, e, g, c);
      if (top && d[1] > this.v.hy) {
        const t1 = P(x0, y1, z1, o), t2 = P(x1, y1, z1, o);
        ctx.fillStyle = top; quad(ctx, d, c, t2, t1);
      }
      ctx.fillStyle = front;
      ctx.fillRect(a[0], c[1], b[0] - a[0], a[1] - c[1]);
      return [a, b, c, d];
    },

    pillar(ctx, x, z, o, P, h, side) {
      const f = this.box(ctx, x - 20, x + 20, 0, h, z, z + 40, o, P, '#8a8670', '#6b6855', '#a8a48b');
      const s = f[0][2];
      if (s < 0.08) return;
      // carved bands and moss drips
      ctx.fillStyle = '#5e5b4a';
      for (let k = 1; k < 5; k++) ctx.fillRect(f[0][0], f[0][1] - h * s * (k / 5), (f[1][0] - f[0][0]), Math.max(1, 3 * s));
      ctx.fillStyle = '#5f7f35';
      ctx.fillRect(f[0][0], f[2][1], (f[1][0] - f[0][0]) * 0.4, h * s * 0.25);
      if (h > 150) {
        // capital
        this.box(ctx, x - 28, x + 28, h, h + 16, z - 4, z + 44, o, P, '#9a967e', '#75725e', '#b2ae95');
      }
    },

    arch(ctx, z, o, P, t) {
      for (const side of [-1, 1]) this.pillar(ctx, side * (ROADW + 30), z, o, P, 300, side);
      const f = this.box(ctx, -ROADW - 60, ROADW + 60, 300, 350, z - 6, z + 46, o, P, '#8f8b74', '#6b6855', '#a8a48b');
      const s = f[0][2];
      if (s < 0.05) return;
      // carved sun disc and two torches
      const c = P(0, 325, z - 6, o);
      ctx.fillStyle = '#c7a14a'; ctx.beginPath(); ctx.arc(c[0], c[1], 17 * s, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#6b5524'; ctx.beginPath(); ctx.arc(c[0], c[1], 9 * s, 0, 6.283); ctx.fill();
      for (const side of [-1, 1]) {
        const fl = P(side * (ROADW + 30), 315 + Math.sin(t * 13 + side) * 3, z - 8, o);
        const r = (14 + Math.sin(t * 17 + side * 2) * 3) * s;
        const gl = ctx.createRadialGradient(fl[0], fl[1], 0, fl[0], fl[1], r * 4);
        gl.addColorStop(0, 'rgba(255,200,90,0.6)'); gl.addColorStop(1, 'rgba(255,160,60,0)');
        ctx.fillStyle = gl; ctx.fillRect(fl[0] - r * 4, fl[1] - r * 4, r * 8, r * 8);
        ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.ellipse(fl[0], fl[1], r * 0.5, r, 0, 0, 6.283); ctx.fill();
      }
    },

    statue(ctx, x, z, o, P) {
      const f = this.box(ctx, x - 45, x + 45, 0, 110, z, z + 70, o, P, '#7f7b66', '#5f5c4b', '#97937b');
      const s = f[0][2];
      if (s < 0.06) return;
      const L = f[0][0], wd = f[1][0] - f[0][0], top = f[2][1], hgt = f[0][1] - f[2][1];
      ctx.fillStyle = '#3e3c31';
      ctx.fillRect(L + wd * 0.18, top + hgt * 0.3, wd * 0.22, hgt * 0.12);
      ctx.fillRect(L + wd * 0.6, top + hgt * 0.3, wd * 0.22, hgt * 0.12);
      ctx.fillRect(L + wd * 0.42, top + hgt * 0.45, wd * 0.16, hgt * 0.2);
      ctx.fillRect(L + wd * 0.25, top + hgt * 0.75, wd * 0.5, hgt * 0.08);
      ctx.fillStyle = '#5f7f35';
      ctx.fillRect(L, top, wd, hgt * 0.1);
    },

    // ---------- gameplay things ----------
    thing(ctx, th, z, part, offAt, fog, t, near) {
      if (near <= 0) return;
      ctx.globalAlpha = (1 - fog * 0.85) * near;
      if (th.type === 'log') this.log(ctx, th, z, offAt);
      else if (th.type === 'branch') this.branch(ctx, th, z, offAt, t, part);
      else if (th.type === 'coin') this.coin(ctx, th, z, offAt, t);
      ctx.globalAlpha = 1;
    },

    // contiguous runs of covered lanes -> [xl, xr]
    spans(lanes, pad) {
      const out = [];
      let s = -1;
      for (let l = 0; l <= 3; l++) {
        if (l < 3 && lanes[l]) { if (s < 0) s = l; }
        else if (s >= 0) { out.push([(s - 1) * LANE - 35 - pad, (l - 2) * LANE + 35 + pad]); s = -1; }
      }
      return out;
    },

    log(ctx, th, z, offAt) {
      const P = this._P;
      for (const [xl, xr] of this.spans(th.lanes, 4)) {
        const z0 = Math.max(z + 4, this._near), z1 = z + R.LEN.log - 4;
        if (z1 <= z0 + 2) continue;
        const o0 = offAt(z0), o1 = offAt(z1);
        const a = P(xl, 0, z0, o0), b = P(xr, 0, z0, o0), c = P(xr, 38, z0, o0), d = P(xl, 38, z0, o0);
        const e = P(xl, 38, z1, o1), g = P(xr, 38, z1, o1);
        const s = a[2];
        // top of the log
        ctx.fillStyle = '#8a5a30'; quad(ctx, d, c, g, e);
        // front: bark with a rounded profile
        const gr = ctx.createLinearGradient(0, c[1], 0, a[1]);
        gr.addColorStop(0, '#9c6a3a'); gr.addColorStop(0.45, '#6b4423'); gr.addColorStop(1, '#2e1d0f');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.roundRect(a[0], c[1], Math.max(0, b[0] - a[0]), Math.max(0, a[1] - c[1]), Math.max(0, Math.min(b[0] - a[0], a[1] - c[1]) * 0.45)); ctx.fill();
        // bark grooves and moss
        ctx.strokeStyle = 'rgba(30,18,8,0.55)'; ctx.lineWidth = Math.max(1, s * 1.5);
        ctx.beginPath();
        for (let k = 1; k < 9; k++) { const x = a[0] + (b[0] - a[0]) * (k / 9) + Math.sin(k * 3.1) * s * 4; ctx.moveTo(x, c[1] + s * 5); ctx.lineTo(x + s * 3, a[1] - s * 4); }
        ctx.stroke();
        ctx.fillStyle = '#6f8f38';
        ctx.beginPath(); ctx.ellipse(a[0] + (b[0] - a[0]) * 0.3, c[1] + s * 3, (b[0] - a[0]) * 0.16, s * 5, 0, 0, 6.283); ctx.fill();
        // the visible cut end with rings
        const endX = a[0] > this.v.cx ? a[0] : b[0];
        const r = (a[1] - c[1]) / 2;
        ctx.fillStyle = '#d8b077'; ctx.beginPath(); ctx.ellipse(endX, (a[1] + c[1]) / 2, r * 0.55, r, 0, 0, 6.283); ctx.fill();
        ctx.strokeStyle = '#a07443'; ctx.lineWidth = Math.max(1, s);
        for (const k of [0.65, 0.35]) { ctx.beginPath(); ctx.ellipse(endX, (a[1] + c[1]) / 2, r * 0.55 * k, r * k, 0, 0, 6.283); ctx.stroke(); }
      }
    },

    branch(ctx, th, z, offAt, t, part) {
      const P = this._P;
      const spans = this.spans(th.lanes, 6);
      const zz = part === 2 ? z + 100 : z + 18;
      if (zz < this._near) return;
      {
        const o = offAt(zz);
        for (let [xl, xr] of spans) {
          if (xl < -100) xl = -ROADW - 60;
          if (xr > 100) xr = ROADW + 60;
          const a = P(xl, 60, zz, o), b = P(xr, 60, zz, o), s = a[2];
          const thick = (part === 1 ? 26 : 18) * s;
          // the bough
          ctx.fillStyle = '#4a3220';
          ctx.beginPath();
          ctx.moveTo(a[0], a[1] - thick * 0.2);
          ctx.quadraticCurveTo((a[0] + b[0]) / 2, a[1] - thick * 1.3, b[0], b[1] - thick * 0.1);
          ctx.lineTo(b[0], b[1] + thick * 0.7);
          ctx.quadraticCurveTo((a[0] + b[0]) / 2, a[1] - thick * 0.1, a[0], a[1] + thick * 0.8);
          ctx.fill();
          ctx.strokeStyle = '#6b4a2c'; ctx.lineWidth = Math.max(1, s * 2);
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo((a[0] + b[0]) / 2, a[1] - thick * 1.1, b[0], b[1]); ctx.stroke();
          // hanging leaves, swaying
          const n = Math.max(3, Math.round((xr - xl) / 22));
          for (let k = 0; k <= n; k++) {
            const u = k / n, lx = a[0] + (b[0] - a[0]) * u;
            const sag = Math.sin(u * Math.PI) * thick * 0.9;
            const len = (14 + hash(k + th.x) * 14) * s, sw = Math.sin(t * 2.5 + k) * 3 * s;
            ctx.fillStyle = k % 2 ? '#3e7a2e' : '#5a9a38';
            ctx.beginPath(); ctx.ellipse(lx + sw, a[1] - sag + thick * 0.4 + len * 0.6, 5 * s, len * 0.6, sw * 0.02, 0, 6.283); ctx.fill();
          }
        }
      }
    },

    coin(ctx, th, z, offAt, t) {
      const P = this._P;
      const o = offAt(z);
      const x = (th.lane || 0) * LANE;
      const c = P(x, th.up + 18 + Math.sin(t * 4 + th.x) * 3, z, o), s = c[2];
      const r = 11 * s;
      if (r < 0.6) return;
      const spin = Math.cos(t * 5 + th.x * 0.01);
      // glow
      ctx.fillStyle = 'rgba(255,214,90,0.22)'; ctx.beginPath(); ctx.arc(c[0], c[1], r * 1.8, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#a8761c'; ctx.beginPath(); ctx.ellipse(c[0], c[1], Math.max(r * 0.12, Math.abs(spin) * r), r, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.ellipse(c[0] - spin * r * 0.08, c[1], Math.max(r * 0.08, Math.abs(spin) * r * 0.82), r * 0.82, 0, 0, 6.283); ctx.fill();
      if (Math.abs(spin) > 0.4) { ctx.fillStyle = '#b8862a'; ctx.fillRect(c[0] - r * 0.25 * Math.abs(spin), c[1] - r * 0.35, r * 0.5 * Math.abs(spin), r * 0.7); }
      // shadow on the path
      const g = P(x, 0, z, o);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(g[0], g[1], r * 0.9, r * 0.25, 0, 0, 6.283); ctx.fill();
    },

    particle(ctx, p, z, offAt, P) {
      const q = P(p.x, p.y, z, offAt(z));
      const s = q[2] * p.size;
      if (s < 0.3) return;
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
      ctx.fillStyle = p.color;
      if (p.kind === 'leaf') { ctx.beginPath(); ctx.ellipse(q[0], q[1], s, s * 0.4, p.rot, 0, 6.283); ctx.fill(); }
      else if (p.kind === 'spark') ctx.fillRect(q[0] - s / 2, q[1] - s / 2, s, s);
      else { ctx.beginPath(); ctx.arc(q[0], q[1], s, 0, 6.283); ctx.fill(); }
      ctx.globalAlpha = 1;
    },

    // ---------- the explorer, seen from behind ----------
    runner(ctx, view, P) {
      const sim = view.sim, p = sim.p;
      const x = p.x * LANE;
      const o = [0, 0];
      const g = P(x, 0, 0, o), b = P(x, Math.max(p.h, sim.state === 'over' && p.fell ? p.h : 0), 0, o);
      const s = g[2];
      // shadow (none over the void)
      if (!p.fell && p.h > -5) {
        const k = Math.max(0.3, 1 - p.h / 260);
        ctx.fillStyle = `rgba(20,14,6,${0.35 * k})`;
        ctx.beginPath(); ctx.ellipse(g[0], g[1], 22 * s * k, 6 * s * k, 0, 0, 6.283); ctx.fill();
      }
      if (p.hurt > 0 && Math.floor(view.time * 18) % 2 && sim.state === 'playing') return;
      const hat = R.HATS[view.hat] || R.HATS[0];
      const ph = sim.d * 0.045;
      const slide = p.slide > 0 && p.h <= 0;
      const air = p.h > 1;
      ctx.save();
      ctx.translate(b[0], b[1]);
      ctx.scale(s * 0.85, s * 0.85);
      if (p.fell) ctx.rotate(Math.sin(view.time * 9) * 0.3);
      const lean = (p.lane - p.x) * 0.5;
      ctx.rotate(lean * 0.35);
      if (slide) {
        // knee slide: low, leaning back, dust spraying
        ctx.fillStyle = '#4a3220'; ctx.fillRect(-13, -9, 9, 9); ctx.fillRect(4, -9, 9, 9);
        ctx.fillStyle = '#b59a63'; ctx.beginPath(); ctx.roundRect(-13, -20, 26, 12, 4); ctx.fill();
        ctx.fillStyle = '#d6c79a'; ctx.beginPath(); ctx.roundRect(-14, -38, 28, 20, 6); ctx.fill();
        this.pack(ctx, -32);
        ctx.fillStyle = '#e0a477'; ctx.fillRect(-20, -36, 6, 14); ctx.fillRect(14, -36, 6, 14);
        this.head(ctx, -44, hat);
      } else {
        const swing = air ? 0 : Math.sin(ph);
        const lA = air ? 6 : Math.max(0, swing) * 12, lB = air ? 9 : Math.max(0, -swing) * 12;
        // legs and boots
        ctx.fillStyle = '#a58b58';
        ctx.fillRect(-11, -32, 9, 22 - lA); ctx.fillRect(2, -32, 9, 22 - lB);
        ctx.fillStyle = '#3b2716';
        ctx.beginPath(); ctx.roundRect(-12, -12 - lA, 11, 12, 3); ctx.fill();
        ctx.beginPath(); ctx.roundRect(1, -12 - lB, 11, 12, 3); ctx.fill();
        // shorts
        ctx.fillStyle = '#b59a63'; ctx.beginPath(); ctx.roundRect(-13, -40, 26, 12, 4); ctx.fill();
        // shirt
        ctx.fillStyle = '#d6c79a'; ctx.beginPath(); ctx.roundRect(-14, -64, 28, 27, 7); ctx.fill();
        // arms swinging opposite to the legs
        const aA = air ? -14 : swing * 8, aB = air ? -14 : -swing * 8;
        ctx.fillStyle = '#e0a477';
        ctx.save(); ctx.translate(-15, -60); ctx.rotate(0.15 + aA * 0.03); ctx.fillRect(-3, 0, 6, 22); ctx.restore();
        ctx.save(); ctx.translate(15, -60); ctx.rotate(-0.15 + aB * 0.03); ctx.fillRect(-3, 0, 6, 22); ctx.restore();
        this.pack(ctx, -58);
        this.head(ctx, -72, hat);
      }
      ctx.restore();
    },
    pack(ctx, y) {
      ctx.fillStyle = '#6b4526'; ctx.beginPath(); ctx.roundRect(-10, y, 20, 22, 5); ctx.fill();
      ctx.fillStyle = '#563619'; ctx.fillRect(-10, y + 7, 20, 3);
      // the stolen idol peeking out
      ctx.fillStyle = '#ffcf3f'; ctx.beginPath(); ctx.arc(0, y - 1, 5, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#b8862a'; ctx.fillRect(-2, y - 3, 1.5, 2); ctx.fillRect(1, y - 3, 1.5, 2);
    },
    head(ctx, y, hat) {
      ctx.fillStyle = '#e0a477'; ctx.fillRect(-4, y + 5, 8, 6);
      ctx.fillStyle = '#5b3a22'; ctx.beginPath(); ctx.arc(0, y, 9, 0, 6.283); ctx.fill();
      ctx.fillStyle = hat.color;
      ctx.beginPath(); ctx.ellipse(0, y - 4, 17, 5, 0, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-9, y - 16, 18, 12, [6, 6, 1, 1]); ctx.fill();
      ctx.fillStyle = hat.band; ctx.fillRect(-9, y - 8, 18, 3);
    },

    // ---------- the boulder ----------
    boulderShadow(ctx, view, P, offAt, camBack) {
      const sim = view.sim;
      if (!view.boulder) return;
      const gap = sim.gap;
      const front = -(80 + gap * 500) + 470 + (view.over || 0) * 400;
      const back = -camBack + 8;
      if (front <= back) return;
      const pts = [];
      const W2 = 150;
      const steps = 8;
      for (let k = 0; k <= steps; k++) { const z = back + (front - back - 60) * (k / steps); const q = P(-W2, 0, z, offAt(z)); pts.push(q); }
      for (let k = 0; k <= 10; k++) {
        const a = Math.PI + (k / 10) * Math.PI;
        const z = front - 60 - Math.sin(a) * 60, x = Math.cos(a) * W2;
        pts.push(P(x, 0, z, offAt(z)));
      }
      for (let k = steps; k >= 0; k--) { const z = back + (front - back - 60) * (k / steps); pts.push(P(W2, 0, z, offAt(z))); }
      const dark = 0.18 + (1 - gap) * 0.35;
      ctx.fillStyle = `rgba(14,8,2,${dark})`;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (const q of pts) ctx.lineTo(q[0], q[1]);
      ctx.fill();
    },

    // the edge of the boulder looming at the bottom of the screen
    boulderPeek(ctx, view) {
      const { W, H } = this;
      const sim = view.sim;
      if (sim.p.fell) return;
      let show = Math.max(0, (0.75 - sim.gap) / 0.4);
      if (view.over && !sim.p.fell) show = 1 + view.over * 3.5;
      if (show <= 0 || !view.boulder) return;
      const r = Math.max(W, H) * 0.75;
      const cy = H + r - show * H * 0.12;
      const rot = sim.d * 0.004;
      ctx.save();
      ctx.translate(W / 2, cy);
      const gr = ctx.createRadialGradient(-r * 0.2, -r * 0.5, r * 0.1, 0, 0, r);
      gr.addColorStop(0, '#9a917f'); gr.addColorStop(0.6, '#6a6253'); gr.addColorStop(1, '#3a342b');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
      ctx.rotate(rot);
      ctx.strokeStyle = 'rgba(40,34,26,0.7)'; ctx.lineWidth = r * 0.012;
      for (let k = 0; k < 9; k++) {
        const a = k * 0.7;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); ctx.lineTo(Math.cos(a + 0.2) * r * 0.97, Math.sin(a + 0.2) * r * 0.97); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(90,120,50,0.55)';
      for (let k = 0; k < 6; k++) { const a = k * 1.1 + 0.4; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85, r * 0.08, r * 0.04, a, 0, 6.283); ctx.fill(); }
      ctx.restore();
      if (view.over && !sim.p.fell) { ctx.fillStyle = `rgba(10,6,2,${Math.min(0.9, view.over * 0.8)})`; ctx.fillRect(0, 0, W, H); }
    },

    // rear-view cut: a carved stone frame showing the boulder behind you
    rearView(ctx, view, k) {
      const { W, H } = this;
      const sim = view.sim;
      const w = Math.min(W * 0.4, H * 0.5, 340), h = w * 0.56;
      const x = (W - w) / 2, y = Math.max(60, H * 0.1) - (1 - k) * (h + 90);
      ctx.save();
      // frame
      ctx.fillStyle = '#3d3a2f'; ctx.beginPath(); ctx.roundRect(x - 10, y - 10, w + 20, h + 20, 14); ctx.fill();
      ctx.fillStyle = '#8a8670'; ctx.beginPath(); ctx.roundRect(x - 6, y - 6, w + 12, h + 12, 11); ctx.fill();
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.clip();
      const sky = ctx.createLinearGradient(0, y, 0, y + h);
      sky.addColorStop(0, '#2d6466'); sky.addColorStop(0.5, '#e8d08c'); sky.addColorStop(1, '#3a4a2a');
      ctx.fillStyle = sky; ctx.fillRect(x, y, w, h);
      const hy = y + h * 0.42, cx = x + w / 2;
      // the path we came along, receding
      ctx.fillStyle = '#26381f'; ctx.fillRect(x, hy, w, h);
      ctx.fillStyle = '#867f6a';
      ctx.beginPath(); ctx.moveTo(cx - w * 0.04, hy); ctx.lineTo(cx + w * 0.04, hy); ctx.lineTo(cx + w * 0.62, y + h); ctx.lineTo(cx - w * 0.62, y + h); ctx.fill();
      ctx.strokeStyle = 'rgba(60,56,44,0.6)'; ctx.lineWidth = 1.5;
      const scroll = (sim.d * 0.02) % 1;
      for (let k2 = 0; k2 < 8; k2++) { const u = Math.pow((k2 + scroll) / 8, 2); const yy = hy + (y + h - hy) * u; const hw = w * 0.04 + w * 0.58 * u; ctx.beginPath(); ctx.moveTo(cx - hw, yy); ctx.lineTo(cx + hw, yy); ctx.stroke(); }
      // the boulder: closer when the gap is small
      const near = 1 - sim.gap;
      const br = h * (0.28 + near * 0.35);
      const by = hy + h * 0.1 + near * h * 0.12;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx, by + br * 0.95, br * 1.1, br * 0.2, 0, 0, 6.283); ctx.fill();
      const gr = ctx.createRadialGradient(cx - br * 0.3, by - br * 0.4, br * 0.1, cx, by, br);
      gr.addColorStop(0, '#a59b86'); gr.addColorStop(1, '#4a443a');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, by, br, 0, 6.283); ctx.fill();
      ctx.save(); ctx.translate(cx, by); ctx.rotate(-sim.d * 0.01);
      ctx.strokeStyle = 'rgba(40,34,26,0.6)'; ctx.lineWidth = 2;
      for (let k2 = 0; k2 < 5; k2++) { const a = k2 * 1.26; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * br, Math.sin(a) * br); ctx.stroke(); }
      ctx.restore();
      // dust kicked up
      ctx.fillStyle = 'rgba(220,200,150,0.35)';
      for (let k2 = 0; k2 < 6; k2++) { const a = view.time * 3 + k2; ctx.beginPath(); ctx.arc(cx + Math.sin(a * 1.3) * br * 1.2, by + br * 0.8 - (a % 1) * br * 0.3, br * 0.18, 0, 6.283); ctx.fill(); }
      // you, small, seen from the front
      const ry = y + h * 0.95;
      ctx.fillStyle = '#d6c79a'; ctx.fillRect(cx + (sim.p.x * w * 0.18) - 7, ry - 30, 14, 18);
      ctx.fillStyle = '#e0a477'; ctx.beginPath(); ctx.arc(cx + sim.p.x * w * 0.18, ry - 36, 6, 0, 6.283); ctx.fill();
      ctx.restore();
    },

    foreground(ctx, view) {
      const { W, H } = this;
      const set = view.settings, t = view.time;
      // light shafts and hanging vines from the canopy
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.7 + Math.sin(t * 0.7) * 0.15;
      ctx.drawImage(this.rays, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const off = this.heading * W * 2.5;
      ctx.strokeStyle = '#1c3416'; ctx.fillStyle = '#2a4a1f';
      for (let k = 0; k < 9; k++) {
        const bx = ((hash(k + 90) * W * 1.4 - off) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
        const len = H * (0.06 + hash(k + 91) * 0.16);
        const sway = set.motion ? Math.sin(t * 1.2 + k) * 6 : 0;
        ctx.lineWidth = 3 + hash(k + 92) * 3;
        ctx.beginPath(); ctx.moveTo(bx, -4); ctx.quadraticCurveTo(bx + sway, len * 0.5, bx + sway * 1.6, len); ctx.stroke();
        for (let l = 1; l < 5; l++) { const u = l / 5; ctx.beginPath(); ctx.ellipse(bx + sway * 1.6 * u + (l % 2 ? 7 : -7), len * u, 7, 3, l % 2 ? 0.5 : -0.5, 0, 6.283); ctx.fill(); }
      }
      // canopy edge across the top
      ctx.fillStyle = '#142a12';
      ctx.beginPath(); ctx.moveTo(0, 0);
      for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, 14 + Math.abs(Math.sin((x + off * 0.3) * 0.02)) * 18);
      ctx.lineTo(W, 0); ctx.fill();
      ctx.drawImage(this.vignette, 0, 0);
    },
  };

  function quad(ctx, a, b, c, d) {
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
  }

  Rd.LANE = LANE; Rd.SEG = SEG; Rd.curveX = curveX;
  root.JG.Render = Rd;
})(window);
