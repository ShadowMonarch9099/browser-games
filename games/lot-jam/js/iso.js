// Lot Jam's car park in 3D: a camera above and in front of the lot looks down
// at it in true perspective, so far rows shrink and every car is a lit,
// extruded box with a cabin, headlights and a shadow. Grid axes stay lined up
// with the screen, so arrow keys move the way they look.
// The static scenery (sky, skyline, road, lot, lamps, trees) is painted once
// per level onto #bg; cars, beams and effects are drawn every frame on #game.
(function () {
  const V = {
    n: 6, f: 1, cx: 0, hy: 0, camH: 6, camZ: 3,
    W: 0, H: 0, dpr: 1,

    // ---------- projection ----------
    // World: x across (0..n), y from far (0) to near (n), z up. Camera sits
    // above the near edge, back from it.
    raw(x, y, z) {
      const X = x - this.n / 2;
      // Cars driving off the near edge come toward the camera; keep them in front of it.
      const Z = Math.max(0.6, this.camZ + (this.n - y));
      return [X / Z, (this.camH - z) / Z, Z];
    },
    p(x, y, z = 0) {
      const [u, v, Z] = this.raw(x, y, z);
      return [this.cx + u * this.f, this.hy + v * this.f, Z];
    },
    scale(y) { return this.f / Math.max(0.6, this.camZ + (this.n - y)); },

    // Fit the lot (plus a ring of road) into the space between the HUD bars.
    layout(W, H, n) {
      this.W = W; this.H = H; this.n = n;
      this.camH = n * 1.05 + 1.5;
      this.camZ = n * 0.5 + 2.2;
      const pts = [[-0.9, -0.9, 0], [n + 0.9, -0.9, 0], [-0.9, n + 0.9, 0], [n + 0.9, n + 0.9, 0], [-0.9, -0.9, 0.9]];
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [x, y, z] of pts) { const [u, v] = this.raw(x, y, z); x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v); }
      const top = H < 520 ? 64 : 84, bottom = H < 520 ? 70 : 96;
      const availW = W * 0.96, availH = H - top - bottom;
      this.f = Math.min(availW / (x1 - x0), availH / (y1 - y0));
      this.cx = W / 2 - ((x0 + x1) / 2) * this.f;
      this.hy = top + availH / 2 - ((y0 + y1) / 2) * this.f;
    },

    // ---------- the static scene ----------
    paintBackground(bg, W, H, dpr, lot, rand) {
      const c = bg.getContext('2d');
      bg.width = Math.round(W * dpr); bg.height = Math.round(H * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = this.n;
      const horizon = this.hy; // where the ground meets the sky (Z -> infinity)
      // dusk sky
      const sky = c.createLinearGradient(0, 0, 0, Math.max(60, horizon));
      sky.addColorStop(0, '#1d1f45'); sky.addColorStop(0.55, '#5b3a6e'); sky.addColorStop(1, '#f08a5d');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);
      // a few early stars
      for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.5})`; c.fillRect(rand() * W, rand() * horizon * 0.6, 1.4, 1.4); }
      // city skyline with lit windows on the horizon
      let x = -20;
      while (x < W + 20) {
        const bw = 30 + rand() * 60, bh = 30 + rand() * 120;
        c.fillStyle = rand() < 0.5 ? '#2a2347' : '#231d3d';
        c.fillRect(x, horizon - bh, bw, bh + 4);
        for (let wy = horizon - bh + 8; wy < horizon - 6; wy += 9) for (let wx = x + 5; wx < x + bw - 6; wx += 8) if (rand() < 0.28) { c.fillStyle = rand() < 0.8 ? '#ffd27a' : '#9be7ff'; c.fillRect(wx, wy, 3, 4); }
        x += bw + 2;
      }
      // ground: grass verge, then the road ring, then the lot
      c.fillStyle = '#1f3b2c'; c.fillRect(0, horizon, W, H);
      const quad = (pts, fill) => { c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); c.fillStyle = fill; c.fill(); };
      const ring = (m) => [this.p(-m, -m), this.p(n + m, -m), this.p(n + m, n + m + 3), this.p(-m, n + m + 3)];
      quad(ring(1.3), '#2b2f3a');                    // road around the lot
      // grass texture specks
      for (let i = 0; i < 500; i++) { const gx = rand() * W, gy = horizon + rand() * (H - horizon); c.fillStyle = `rgba(${rand() < 0.5 ? '80,140,90' : '20,40,30'},0.35)`; c.fillRect(gx, gy, 2, 1); }
      quad(ring(1.3), '#2b2f3a');
      // dashed centre line on the road ring
      c.strokeStyle = 'rgba(255, 210, 90, 0.55)';
      c.setLineDash([10, 12]); c.lineWidth = 2;
      c.beginPath(); [[-0.65, -0.65], [n + 0.65, -0.65], [n + 0.65, n + 3], [-0.65, n + 3]].forEach(([a, b], i) => { const [px, py] = this.p(a, b); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.stroke();
      c.setLineDash([]);
      // kerb: a low raised edge round the lot, with its near face visible
      const k = 0.12;
      quad([this.p(-0.15, -0.15, k), this.p(n + 0.15, -0.15, k), this.p(n + 0.15, n + 0.15, k), this.p(-0.15, n + 0.15, k)], '#b9b6ad');
      quad([this.p(-0.15, n + 0.15, k), this.p(n + 0.15, n + 0.15, k), this.p(n + 0.15, n + 0.15, 0), this.p(-0.15, n + 0.15, 0)], '#7c7a73');
      // the lot surface with a little grain
      quad([this.p(0, 0, k), this.p(n, 0, k), this.p(n, n, k), this.p(0, n, k)], '#3a404d');
      for (let i = 0; i < 900; i++) {
        const [px, py] = this.p(rand() * n, rand() * n, k);
        c.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.1)'; c.fillRect(px, py, 2, 2);
      }
      // bay lines
      c.strokeStyle = 'rgba(245, 240, 220, 0.55)'; c.lineWidth = Math.max(1, this.scale(n / 2) * 0.03);
      for (let i = 1; i < n; i++) {
        for (const [a, b, e, f] of [[i, 0.08, i, n - 0.08], [0.08, i, n - 0.08, i]]) {
          for (let s = 0; s < 1; s += 0.125) {
            const t0 = s, t1 = s + 0.07;
            const [x0, y0] = this.p(a + (e - a) * t0, b + (f - b) * t0, k), [x1, y1] = this.p(a + (e - a) * t1, b + (f - b) * t1, k);
            c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
          }
        }
      }
      // "EXIT" arrows painted on the road ring, one per side
      c.fillStyle = 'rgba(255, 255, 255, 0.5)';
      for (const [ax, ay, dx, dy] of [[n / 2, -0.7, 0, -1], [n + 0.7, n / 2, 1, 0], [n / 2, n + 0.7, 0, 1], [-0.7, n / 2, -1, 0]]) {
        const px = -dy, py = dx;
        quad([this.p(ax + dx * 0.35, ay + dy * 0.35), this.p(ax + px * 0.25, ay + py * 0.25), this.p(ax - px * 0.25, ay - py * 0.25)], 'rgba(255,255,255,0.45)');
      }
      // lamp pools on the ground (warm light), then posts on the far side
      c.globalCompositeOperation = 'lighter';
      const lamps = [[-0.9, -0.9], [n + 0.9, -0.9], [-0.9, n / 2], [n + 0.9, n / 2], [-0.9, n + 0.9], [n + 0.9, n + 0.9]];
      for (const [lx, ly] of lamps) {
        const [px, py] = this.p(lx, ly);
        const r = this.scale(ly) * 3.2;
        const g = c.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, 'rgba(255, 190, 110, 0.32)'); g.addColorStop(1, 'rgba(255, 190, 110, 0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(px, py, r, r * 0.55, 0, 0, Math.PI * 2); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
      for (const [lx, ly] of lamps.filter(([, ly]) => ly < n / 2 + 1)) this.lampPost(c, lx, ly);
      // trees behind the lot
      for (let i = 0; i < 14; i++) {
        const tx = -2 + (i / 13) * (n + 4) + (rand() - 0.5) * 0.6, ty = -2.2 - rand() * 1.2;
        this.tree(c, tx, ty, 0.7 + rand() * 0.5);
      }
    },
    lampPost(c, x, y) {
      const [bx, by] = this.p(x, y), [tx, ty] = this.p(x, y, 2.2), s = this.scale(y);
      c.strokeStyle = '#4a4e5c'; c.lineWidth = Math.max(2, s * 0.07);
      c.beginPath(); c.moveTo(bx, by); c.lineTo(tx, ty); c.stroke();
      const g = c.createRadialGradient(tx, ty, 0, tx, ty, s * 0.7);
      g.addColorStop(0, 'rgba(255, 220, 160, 0.95)'); g.addColorStop(0.2, 'rgba(255, 200, 130, 0.5)'); g.addColorStop(1, 'rgba(255, 190, 110, 0)');
      c.fillStyle = g; c.beginPath(); c.arc(tx, ty, s * 0.7, 0, Math.PI * 2); c.fill();
    },
    tree(c, x, y, size) {
      const [bx, by] = this.p(x, y), s = this.scale(y) * size;
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(bx, by, s * 0.5, s * 0.18, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3b2a20'; c.fillRect(bx - s * 0.05, by - s * 0.5, s * 0.1, s * 0.5);
      for (const [oy, r, col] of [[0.65, 0.45, '#1d4a33'], [0.95, 0.36, '#235a3d'], [1.2, 0.26, '#2b6b47']]) {
        c.fillStyle = col; c.beginPath(); c.arc(bx, by - s * oy, s * r, 0, Math.PI * 2); c.fill();
      }
    },

    // ---------- cars ----------
    // Box from (x0,y0,z0) to (x1,y1,z1). Only the faces the camera can see are drawn.
    box(c, x0, y0, x1, y1, z0, z1, col, alpha = 1) {
      const P = (x, y, z) => this.p(x, y, z);
      const poly = (pts, fill) => { c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); c.fillStyle = fill; c.fill(); };
      c.globalAlpha = alpha;
      const midX = (x0 + x1) / 2 - this.n / 2;
      if (midX > 0.02) poly([P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), P(x0, y0, z0)], col.side);
      else if (midX < -0.02) poly([P(x1, y0, z1), P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z0)], col.side);
      poly([P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], col.front);
      poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], col.top);
      c.globalAlpha = 1;
    },
    shade(hex, k) {
      const v = parseInt(hex.slice(1), 16);
      const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
      const f = (x) => Math.max(0, Math.min(255, Math.round(k > 0 ? x + (255 - x) * k : x * (1 + k))));
      return `rgb(${f(r)},${f(g)},${f(b)})`;
    },
    // Footprint of a car in cells (with its animation offset), slightly inset.
    footprint(car, off) {
      const horiz = car.dir === 'E' || car.dir === 'W';
      const w = horiz ? car.len : 1, d = horiz ? 1 : car.len;
      const ix = horiz ? 0.08 : 0.16, iy = horiz ? 0.16 : 0.08;
      return { x0: car.x + off[0] + ix, y0: car.y + off[1] + iy, x1: car.x + w + off[0] - ix, y1: car.y + d + off[1] - iy, horiz };
    },
    // Ground layer for one car: soft shadow and (if awake) its headlight beam.
    carGround(c, car, off, alpha, lightsOn) {
      const f = this.footprint(car, off);
      const P = (x, y) => this.p(x, y, 0.12);
      c.globalAlpha = alpha * 0.45;
      c.fillStyle = '#05070b';
      c.beginPath(); [P(f.x0 - 0.06, f.y0 + 0.04), P(f.x1 + 0.1, f.y0 + 0.04), P(f.x1 + 0.1, f.y1 + 0.12), P(f.x0 - 0.06, f.y1 + 0.12)].forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill();
      c.globalAlpha = 1;
      if (!lightsOn) return;
      const d = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[car.dir];
      const fx = d[0] > 0 ? f.x1 : d[0] < 0 ? f.x0 : (f.x0 + f.x1) / 2, fy = d[1] > 0 ? f.y1 : d[1] < 0 ? f.y0 : (f.y0 + f.y1) / 2;
      const px = -d[1], py = d[0], L = 2.2;
      const pts = [P(fx + px * 0.32, fy + py * 0.32), P(fx + d[0] * L + px * 0.85, fy + d[1] * L + py * 0.85), P(fx + d[0] * L - px * 0.85, fy + d[1] * L - py * 0.85), P(fx - px * 0.32, fy - py * 0.32)];
      const [ax, ay] = P(fx, fy), [bx, by] = P(fx + d[0] * L, fy + d[1] * L);
      const g = c.createLinearGradient(ax, ay, bx, by);
      g.addColorStop(0, `rgba(255, 240, 190, ${0.28 * alpha})`); g.addColorStop(1, 'rgba(255, 240, 190, 0)');
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = g; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill();
      c.globalCompositeOperation = 'source-over';
    },
    // The car body: chassis, body, glass cabin, roof, lights, decals.
    car(c, car, off, alpha, t, lightsOn) {
      const f = this.footprint(car, off);
      const amb = car.kind === 'ambulance';
      const base = amb ? '#f4f4f0' : car.color;
      const col = { top: this.shade(base, 0.12), front: this.shade(base, -0.18), side: this.shade(base, -0.34) };
      const zb = 0.12;
      this.box(c, f.x0 + 0.04, f.y0 + 0.04, f.x1 - 0.04, f.y1 - 0.04, zb, zb + 0.1, { top: '#111', front: '#0b0b0d', side: '#0b0b0d' }, alpha);
      this.box(c, f.x0, f.y0, f.x1, f.y1, zb + 0.08, zb + (amb ? 0.52 : 0.38), col, alpha);
      // cabin sits in the rear half of the car (rear = opposite the driving direction)
      const d = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[car.dir];
      let cx0 = f.x0 + 0.1, cx1 = f.x1 - 0.1, cy0 = f.y0 + 0.1, cy1 = f.y1 - 0.1;
      const len = f.horiz ? f.x1 - f.x0 : f.y1 - f.y0;
      const cab = Math.min(len * 0.5, 1.1);
      if (!amb) {
        if (d[0] > 0) { cx1 = f.x1 - len * 0.38; cx0 = cx1 - cab; }
        if (d[0] < 0) { cx0 = f.x0 + len * 0.38; cx1 = cx0 + cab; }
        if (d[1] > 0) { cy1 = f.y1 - len * 0.38; cy0 = cy1 - cab; }
        if (d[1] < 0) { cy0 = f.y0 + len * 0.38; cy1 = cy0 + cab; }
        const ztop = zb + 0.38;
        this.box(c, cx0, cy0, cx1, cy1, ztop, ztop + 0.2, { top: this.shade(base, 0.2), front: lightsOn ? '#3d5a80' : '#2a3448', side: lightsOn ? '#2c4363' : '#1e2636' }, alpha);
      } else {
        // ambulance: a red stripe round the visible sides, and a flashing light bar
        const band = (pts) => { c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); c.fill(); };
        const za = zb + 0.3, zc = zb + 0.38;
        c.globalAlpha = alpha; c.fillStyle = '#d62839';
        band([this.p(f.x0, f.y1, zc), this.p(f.x1, f.y1, zc), this.p(f.x1, f.y1, za), this.p(f.x0, f.y1, za)]);
        const sx = (f.x0 + f.x1) / 2 - this.n / 2 > 0.02 ? f.x0 : (f.x0 + f.x1) / 2 - this.n / 2 < -0.02 ? f.x1 : null;
        if (sx !== null) band([this.p(sx, f.y0, zc), this.p(sx, f.y1, zc), this.p(sx, f.y1, za), this.p(sx, f.y0, za)]);
        c.globalAlpha = 1;
        const mx = (f.x0 + f.x1) / 2, my = (f.y0 + f.y1) / 2, on = Math.sin(t * 14) > 0;
        this.box(c, mx - 0.18, my - 0.12, mx + 0.18, my + 0.12, zb + 0.52, zb + 0.62, { top: on ? '#4cc9f0' : '#ff4d4d', front: on ? '#1b8fb8' : '#c1121f', side: '#333' }, alpha);
        const [lx, ly] = this.p(mx, my, zb + 0.66), s = this.scale(my);
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(lx, ly, 0, lx, ly, s * 1.4);
        g.addColorStop(0, on ? 'rgba(76,201,240,0.55)' : 'rgba(255,77,77,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(lx, ly, s * 1.4, 0, Math.PI * 2); c.fill();
        c.globalCompositeOperation = 'source-over';
        // a cross on the roof
        const [rx, ry] = this.p(mx - d[0] * 0.5, my - d[1] * 0.5, zb + 0.53);
        c.fillStyle = '#e63946'; c.fillRect(rx - s * 0.16, ry - s * 0.05, s * 0.32, s * 0.1); c.fillRect(rx - s * 0.05, ry - s * 0.13, s * 0.1, s * 0.26);
      }
      // a chevron on the bonnet showing which way it will drive
      const hood = amb ? 0.5 : 0.38, ztop = zb + hood;
      const fx = d[0] > 0 ? f.x1 - 0.32 : d[0] < 0 ? f.x0 + 0.32 : (f.x0 + f.x1) / 2;
      const fy = d[1] > 0 ? f.y1 - 0.32 : d[1] < 0 ? f.y0 + 0.32 : (f.y0 + f.y1) / 2;
      const px = -d[1], py = d[0];
      c.globalAlpha = alpha;
      c.strokeStyle = amb ? 'rgba(193,18,31,0.8)' : 'rgba(255,255,255,0.75)'; c.lineWidth = Math.max(2, this.scale(fy) * 0.07); c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      const q = (a, b) => this.p(fx + d[0] * a + px * b, fy + d[1] * a + py * b, ztop);
      const [x0, y0] = q(-0.12, 0.16), [x1, y1] = q(0.06, 0), [x2, y2] = q(-0.12, -0.16);
      c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      // headlights at the front, tail lights at the back
      const lamp = (along, color, glow) => {
        for (const side of [-0.3, 0.3]) {
          const [lx, ly] = this.p((f.x0 + f.x1) / 2 + d[0] * along + px * side, (f.y0 + f.y1) / 2 + d[1] * along + py * side, zb + 0.24);
          const s = Math.max(0.5, this.scale((f.y0 + f.y1) / 2));
          c.fillStyle = color; c.beginPath(); c.arc(lx, ly, s * 0.06, 0, Math.PI * 2); c.fill();
          if (glow) {
            c.globalCompositeOperation = 'lighter';
            const g = c.createRadialGradient(lx, ly, 0, lx, ly, s * 0.3);
            g.addColorStop(0, glow); g.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = g; c.beginPath(); c.arc(lx, ly, s * 0.3, 0, Math.PI * 2); c.fill();
            c.globalCompositeOperation = 'source-over';
          }
        }
      };
      const half = len / 2 + 0.01;
      lamp(half, lightsOn ? '#fff6d0' : '#5c5a4f', lightsOn ? 'rgba(255,240,180,0.6)' : null);
      lamp(-half, lightsOn ? '#ff4d4d' : '#5a1e1e', lightsOn ? 'rgba(255,60,60,0.45)' : null);
      c.globalAlpha = 1;
    },
    // The screen outline of a car, for tapping it.
    hull(car, off) {
      const f = this.footprint(car, off), z1 = 0.7;
      const pts = [];
      for (const x of [f.x0, f.x1]) for (const y of [f.y0, f.y1]) for (const z of [0, z1]) pts.push(this.p(x, y, z));
      pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lower = [], upper = [];
      for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
      for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
      return lower.slice(0, -1).concat(upper.slice(0, -1));
    },
    inside(poly, x, y) {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    },
    // A glowing ring on the ground round a cell or a car.
    ring(c, x0, y0, x1, y1, color, t) {
      const pts = [this.p(x0, y0, 0.13), this.p(x1, y0, 0.13), this.p(x1, y1, 0.13), this.p(x0, y1, 0.13)];
      c.save();
      c.strokeStyle = color; c.lineWidth = 3 + Math.sin(t * 6) * 1; c.shadowColor = color; c.shadowBlur = 12;
      c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
      c.restore();
    },
  };
  (window.LJ = window.LJ || {}).View = V;
})();
