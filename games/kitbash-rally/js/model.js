// A tiny software 3D renderer for the karts. A kart is built out of boxes and
// prisms from its six parts, then drawn with perspective, flat shading and
// painter's sorting on a 2D canvas. The garage draws it live on a turntable;
// the race pre-renders each kart from behind at a few angles into sprites, so
// every kart on the road looks like the parts it is built from.
(function () {
  const KR = window.KR;

  function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(rgb, k) {
    return 'rgb(' + Math.min(255, rgb[0] * k | 0) + ',' + Math.min(255, rgb[1] * k | 0) + ',' + Math.min(255, rgb[2] * k | 0) + ')';
  }
  function mix(a, b, t) {
    const A = hex(a), B = hex(b);
    return '#' + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join('');
  }

  // ---------- primitives ----------
  function box(out, slot, cx, cy, cz, hx, hy, hz, col, extra) {
    const rgb = hex(col);
    const v = (sx, sy, sz) => [cx + sx * hx, cy + sy * hy, cz + sz * hz];
    const quads = [
      [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1], [1, 0, 0]],
      [[-1, -1, 1], [-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, 0, 0]],
      [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1], [0, 1, 0]],
      [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1], [0, -1, 0]],
      [[-1, -1, 1], [-1, 1, 1], [1, 1, 1], [1, -1, 1], [0, 0, 1]],
      [[1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, -1], [0, 0, -1]],
    ];
    for (const q of quads) out.push({ p: q.slice(0, 4).map((s) => v(s[0], s[1], s[2])), n: q[4], rgb, slot, glow: extra && extra.glow });
  }
  // a prism (cylinder) along an axis: 'x', 'y' or 'z'
  function prism(out, slot, cx, cy, cz, r, half, axis, col, sides, capCol) {
    sides = sides || 10;
    const rgb = hex(col), cap = hex(capCol || col);
    const P = (a, s) => {
      const u = Math.cos(a) * r, w = Math.sin(a) * r;
      if (axis === 'x') return [cx + s * half, cy + u, cz + w];
      if (axis === 'y') return [cx + u, cy + s * half, cz + w];
      return [cx + u, cy + w, cz + s * half];
    };
    const N = (a) => {
      const u = Math.cos(a), w = Math.sin(a);
      if (axis === 'x') return [0, u, w];
      if (axis === 'y') return [u, 0, w];
      return [u, w, 0];
    };
    const step = (Math.PI * 2) / sides;
    const capA = [], capB = [];
    for (let i = 0; i < sides; i++) {
      const a0 = i * step, a1 = a0 + step, am = a0 + step / 2;
      out.push({ p: [P(a0, -1), P(a1, -1), P(a1, 1), P(a0, 1)], n: N(am), rgb, slot });
      capA.push(P(a0, 1)); capB.unshift(P(a0, -1));
    }
    const ax = axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1];
    out.push({ p: capA, n: ax, rgb: cap, slot });
    out.push({ p: capB, n: ax.map((x) => -x), rgb: cap, slot });
  }

  // ---------- the kart ----------
  const ROW_Z = [0.88, 0, -0.88];
  function slotAnchor(i) {
    const row = Math.floor(i / 2), side = i % 2 ? 1 : -1;
    return { x: side * 0.6, y: 0.5, z: ROW_Z[row], side, row };
  }

  function wheel(out, slot, x, z, fat) {
    const r = fat ? 0.42 : 0.34, hw = fat ? 0.22 : 0.13;
    prism(out, slot, x, r, z, r, hw, 'x', '#1b1b1f', 12, fat ? '#1c8fc4' : '#9aa0a8');
    if (fat) {
      // chunky tread blocks so grippy tyres read from behind
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        box(out, slot, x, r + Math.cos(a) * (r + 0.02), z + Math.sin(a) * (r + 0.02), hw * 0.9, 0.03, 0.06, '#26262b');
      }
    }
  }

  function part(out, i, id) {
    const a = slotAnchor(i), x = a.x, z = a.z, s = a.side;
    switch (id) {
      case 'empty':
        box(out, i, x, 0.47, z, 0.2, 0.02, 0.2, '#4a4f5c');
        for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(out, i, x + dx * 0.13, 0.5, z + dz * 0.13, 0.03, 0.02, 0.03, '#c9ccd1');
        break;
      case 'engine':
        box(out, i, x, 0.7, z, 0.2, 0.2, 0.25, '#e4572e');
        box(out, i, x, 0.93, z, 0.17, 0.04, 0.22, '#b8bcc4');
        for (let k = -2; k <= 2; k++) box(out, i, x + s * 0.21, 0.72, z + k * 0.09, 0.02, 0.15, 0.025, '#9b3a1f');
        prism(out, i, x, 0.62, z - 0.42, 0.065, 0.18, 'z', '#d9dde3', 8, '#333');
        break;
      case 'turbo':
        box(out, i, x, 0.82, z, 0.26, 0.3, 0.32, '#b3202a');
        box(out, i, x, 1.17, z, 0.17, 0.07, 0.2, '#d9dde3');
        box(out, i, x, 1.3, z + 0.06, 0.12, 0.07, 0.1, '#2b2b30');
        for (const dx of [-0.1, 0.1]) prism(out, i, x + dx, 1.3, z - 0.22, 0.05, 0.15, 'y', '#e8ecf0', 8, '#222');
        for (let k = -2; k <= 2; k++) box(out, i, x + s * 0.27, 0.85, z + k * 0.11, 0.02, 0.24, 0.03, '#7d1820');
        break;
      case 'wheels':
        if (a.row === 1) { wheel(out, i, s * 1.02, 0, true); box(out, i, s * 0.8, 0.62, 0, 0.14, 0.05, 0.12, '#1c8fc4'); }
        else box(out, i, s * 0.98, 0.92, z + (a.row === 0 ? 0.25 : -0.25), 0.26, 0.04, 0.34, '#1c8fc4');
        break;
      case 'plate':
        box(out, i, s * 0.86, 0.78, z, 0.06, 0.32, 0.42, '#8d99ae');
        box(out, i, s * 0.86, 1.1, z, 0.07, 0.03, 0.43, '#ffc21a');
        for (const dz of [-0.3, 0, 0.3]) for (const dy of [0.6, 0.95]) box(out, i, s * 0.93, dy, z + dz, 0.02, 0.03, 0.03, '#5a6275');
        break;
      case 'rocket':
        prism(out, i, x, 0.86, z, 0.14, 0.38, 'z', '#ff8a1f', 10, '#ffd166');
        prism(out, i, x, 0.86, z + 0.46, 0.08, 0.08, 'z', '#ffd166', 10);
        prism(out, i, x, 0.86, z - 0.42, 0.1, 0.05, 'z', '#2a2a2e', 10, '#111');
        box(out, i, x, 1.04, z - 0.3, 0.015, 0.08, 0.1, '#c9ccd1');
        box(out, i, x + s * 0.18, 0.86, z - 0.3, 0.08, 0.015, 0.1, '#c9ccd1');
        box(out, i, x, 0.62, z, 0.05, 0.12, 0.08, '#555a63');
        break;
      case 'magnet':
        box(out, i, x, 0.75, z, 0.04, 0.25, 0.04, '#555a63');
        box(out, i, x, 1.0, z, 0.2, 0.05, 0.06, '#d62828');
        for (const dx of [-0.15, 0.15]) {
          box(out, i, x + dx, 1.17, z, 0.05, 0.14, 0.06, '#d62828');
          box(out, i, x + dx, 1.36, z, 0.05, 0.05, 0.065, '#e8ecf0', { glow: true });
        }
        break;
      case 'spring':
        for (let k = 0; k < 5; k++) {
          const y = 0.55 + k * 0.11, o = k % 2 ? 0.02 : -0.02;
          box(out, i, x + o, y, z - 0.15, 0.17, 0.025, 0.025, '#16c79a');
          box(out, i, x + o, y, z + 0.15, 0.17, 0.025, 0.025, '#16c79a');
          box(out, i, x - 0.15 + o, y, z, 0.025, 0.025, 0.17, '#16c79a');
          box(out, i, x + 0.15 + o, y, z, 0.025, 0.025, 0.17, '#16c79a');
        }
        box(out, i, x, 1.13, z, 0.2, 0.04, 0.2, '#2b2b30');
        break;
      case 'spoiler':
        if (a.row === 0) {
          box(out, i, x, 0.32, z + 0.85, 0.32, 0.03, 0.14, '#ffc21a');
          box(out, i, x + s * 0.32, 0.38, z + 0.85, 0.02, 0.08, 0.16, '#2b2b30');
        } else {
          for (const dx of [-0.12, 0.12]) box(out, i, x + dx, 0.95, z - 0.1, 0.025, 0.35, 0.04, '#2b2b30');
          box(out, i, x, 1.33, z - 0.15, 0.36, 0.035, 0.2, '#ffc21a');
          box(out, i, x + s * 0.36, 1.33, z - 0.15, 0.02, 0.12, 0.22, '#2b2b30');
        }
        break;
    }
  }

  // Build the face list for a kart. Faces carry `slot` (-1 for the chassis)
  // so the garage can drop a freshly fitted part in on its own.
  function buildKart(build, color) {
    const out = [];
    const dark = mix(color, '#000000', 0.45);
    const lift = build.includes('spring') ? 0.08 : 0;
    // chassis
    box(out, -1, 0, 0.36, 0.05, 0.86, 0.09, 1.5, '#2a2c33');
    box(out, -1, 0, 0.6, 0.15, 0.36, 0.2, 1.05, color);
    box(out, -1, 0, 0.5, 1.45, 0.52, 0.14, 0.22, color);
    box(out, -1, 0, 0.36, 1.78, 0.84, 0.05, 0.05, '#c9ccd1');
    box(out, -1, 0, 0.42, -1.6, 0.8, 0.07, 0.05, '#c9ccd1');
    box(out, -1, 0, 0.8, 0.62, 0.3, 0.04, 0.12, dark);
    // number board on the nose
    box(out, -1, 0, 0.66, 1.25, 0.2, 0.04, 0.14, '#f2ead8');
    // seat, driver, helmet
    box(out, -1, 0, 0.98, -0.38, 0.3, 0.3, 0.07, '#1d1d22');
    box(out, -1, 0, 1.05, -0.15, 0.24, 0.24, 0.17, dark);
    box(out, -1, 0, 1.06, 0.33, 0.16, 0.03, 0.02, '#111');
    box(out, -1, 0, 1.48, -0.1, 0.21, 0.2, 0.22, '#f4f1ea');
    box(out, -1, 0, 1.49, -0.1, 0.215, 0.05, 0.225, color);
    box(out, -1, 0, 1.5, 0.11, 0.17, 0.07, 0.03, '#203448');
    // four corner wheels; grippy wheels in a corner slot fatten that tyre
    const corner = { 0: [-0.98, 1.1], 1: [0.98, 1.1], 4: [-0.98, -1.1], 5: [0.98, -1.1] };
    for (const k of [0, 1, 4, 5]) wheel(out, -1, corner[k][0] * (build[k] === 'wheels' ? 1.04 : 1), corner[k][1], build[k] === 'wheels');
    build.forEach((id, i) => part(out, i, id));
    if (lift) for (const f of out) for (const p of f.p) p[1] += lift;
    return out;
  }

  // ---------- drawing ----------
  // opts: cx, cy (screen centre of the kart origin), F (focal px), D (camera
  // distance), yaw, pitch, outline, offsets (per-slot y lift), highlight slot
  function draw(ctx, faces, o) {
    const cy0 = Math.cos(o.yaw), sy0 = Math.sin(o.yaw), cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
    const D = o.D, F = o.F, off = o.offsets;
    const L = [-0.45, 0.75, -0.48];
    const list = [];
    for (const f of faces) {
      const lift = off && f.slot >= 0 ? off[f.slot] || 0 : 0;
      // normal
      let nx = f.n[0] * cy0 + f.n[2] * sy0, nz = -f.n[0] * sy0 + f.n[2] * cy0, ny = f.n[1];
      const ny2 = ny * cp + nz * sp, nz2 = -ny * sp + nz * cp;
      const pts = [];
      let zs = 0, cxs = 0, cys = 0, czs = 0;
      for (const p of f.p) {
        const x = p[0] * cy0 + p[2] * sy0, z = -p[0] * sy0 + p[2] * cy0, y = p[1] + lift - 0.6;
        const y2 = y * cp + z * sp, z2 = -y * sp + z * cp;
        const dz = D + z2;
        pts.push(o.cx + (x * F) / dz, o.cy - ((y2 + 0.6) * F) / dz);
        zs += z2; cxs += x; cys += y2; czs += z2;
      }
      const n = f.p.length;
      // back-face test against the ray from the camera
      if (nx * (cxs / n) + ny2 * (cys / n) + nz2 * (czs / n + D) >= 0) continue;
      const lum = 0.42 + 0.62 * Math.max(0, nx * L[0] + ny2 * L[1] + nz2 * L[2]);
      list.push({ pts, z: zs / n, col: shade(f.rgb, f.glow ? 1.3 : lum), slot: f.slot });
    }
    list.sort((a, b) => b.z - a.z);
    ctx.lineJoin = 'round';
    ctx.lineWidth = o.outline || 1;
    ctx.strokeStyle = 'rgba(10,8,6,0.55)';
    for (const f of list) {
      ctx.beginPath();
      ctx.moveTo(f.pts[0], f.pts[1]);
      for (let k = 2; k < f.pts.length; k += 2) ctx.lineTo(f.pts[k], f.pts[k + 1]);
      ctx.closePath();
      ctx.fillStyle = f.col;
      ctx.fill();
      if (o.outline) ctx.stroke();
    }
  }

  // screen position of a point in kart space (for the garage slot markers)
  function project(px, py, pz, o) {
    const cy0 = Math.cos(o.yaw), sy0 = Math.sin(o.yaw), cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
    const x = px * cy0 + pz * sy0, z = -px * sy0 + pz * cy0, y = py - 0.6;
    const y2 = y * cp + z * sp, z2 = -y * sp + z * cp, dz = o.D + z2;
    return { x: o.cx + (x * o.F) / dz, y: o.cy - ((y2 + 0.6) * o.F) / dz, z: z2 };
  }

  // Pre-rendered race sprites: five angles from behind. Each frame is
  // SW x SH px with the kart's ground point at (SW/2, GY). `unit` is pixels
  // per kart unit at that point, so the road can scale it to the world.
  const YAWS = [-0.5, -0.25, 0, 0.25, 0.5];
  function sprites(build, color, res) {
    res = res || 1;
    const SW = Math.round(230 * res), SH = Math.round(170 * res), GY = Math.round(150 * res);
    const faces = buildKart(build, color);
    const F = 470 * res, D = 9, pitch = 0.24;
    const frames = YAWS.map((yaw) => {
      const c = document.createElement('canvas');
      c.width = SW; c.height = SH;
      const g = c.getContext('2d');
      draw(g, faces, { cx: SW / 2, cy: GY, F, D, yaw, pitch, outline: 1.1 * res });
      return c;
    });
    return { frames, w: SW, h: SH, gy: GY, unit: F / D };
  }

  // one part on its own, centred, for the parts rack icons
  function partFaces(id) {
    const out = [];
    if (id === 'wheels') wheel(out, 1, 0, 0, true);
    else part(out, 1, id);
    const a = slotAnchor(1);
    if (id !== 'wheels') for (const f of out) for (const p of f.p) { p[0] -= a.x; p[2] -= a.z; p[1] -= 0.35; }
    return out;
  }
  function icon(id, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const faces = partFaces(id);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const f of faces) for (const p of f.p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
    const size = Math.max(x1 - x0, y1 - y0, z1 - z0, 0.3);
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (z0 + z1) / 2;
    for (const f of faces) for (const p of f.p) { p[0] -= mx; p[1] -= my; p[2] -= mz; }
    draw(c.getContext('2d'), faces, { cx: w / 2, cy: h / 2, F: (Math.min(w, h * 1.3) * 0.62 * 5) / size, D: 5, yaw: 0.7, pitch: 0.45, outline: 1 });
    return c;
  }

  KR.Model = { buildKart, partFaces, icon, draw, project, sprites, slotAnchor, hex, mix, shade, YAWS };
})();
