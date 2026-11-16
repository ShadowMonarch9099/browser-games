// Draws the cave in a 3/4 view (walls stand up off the floor), then the
// darkness: a layer that the lantern cuts holes in along its line of sight,
// so walls cast real shadows. Things that glow (eyes, embers, glowcaps, the
// flame itself) are drawn after the darkness so they shine through it.
(function () {
  const C = LL.CFG;
  const T = C.T;
  const WH = C.WALL;
  const U = LL.U;
  const G = LL.G;
  const W = window.LLWorld;
  const { MW, MH, LIGHT } = W;
  const TAU = Math.PI * 2;

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w);
    c.height = Math.ceil(h);
    return c;
  }

  const dark = canvas(C.W / 2, C.H / 2);
  const dctx = dark.getContext('2d');

  function paintTerrain(r) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const s = dpr;
    const c = canvas(MW * T * s, (MH * T + WH) * s);
    const g = c.getContext('2d');
    g.scale(s, s);
    g.translate(0, WH);
    const map = r.w.map;
    const wall = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH || map[y][x] === 1;
    // floor
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        if (map[y][x]) continue;
        const h = U.hash(x, y);
        g.fillStyle = h < 0.5 ? '#2c251c' : '#30281f';
        g.fillRect(x * T, y * T, T + 0.5, T + 0.5);
        // flagstone seams
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.lineWidth = 1;
        g.strokeRect(x * T + 1.5 + h * 3, y * T + 1.5, T - 4, T / 2 - 1);
        g.strokeRect(x * T + 0.5, y * T + T / 2 + 0.5, T / 2 + h * 6, T / 2 - 1);
        g.fillStyle = 'rgba(255,230,190,0.04)';
        g.fillRect(x * T + 2, y * T + 2, T - 6, 2);
        const h2 = U.hash(x, y, 2);
        if (h2 < 0.025) {
          // a puddle that will catch the light
          g.fillStyle = 'rgba(26,34,44,0.85)';
          g.beginPath();
          g.ellipse(x * T + T / 2, y * T + T / 2, T * 0.42, T * 0.22, h * 2, 0, TAU);
          g.fill();
          g.strokeStyle = 'rgba(140,180,220,0.18)';
          g.beginPath();
          g.ellipse(x * T + T / 2 - 3, y * T + T / 2 - 2, T * 0.25, T * 0.08, h * 2, 0, Math.PI);
          g.stroke();
        } else if (h2 < 0.2) {
          g.fillStyle = 'rgba(20,14,8,0.6)';
          for (let k = 0; k < 3; k++) {
            g.beginPath();
            g.arc(x * T + U.hash(x, y, 10 + k) * T, y * T + U.hash(x, y, 20 + k) * T, 1.5 + U.hash(x, y, k) * 2, 0, TAU);
            g.fill();
          }
        } else if (h2 < 0.3 && (wall(x - 1, y) || wall(x + 1, y) || wall(x, y - 1))) {
          g.fillStyle = 'rgba(70,100,50,0.35)';
          g.beginPath();
          g.ellipse(x * T + h * T, y * T + T * 0.3, T * 0.4, T * 0.2, 0, 0, TAU);
          g.fill();
        }
        // soft ambient occlusion where floor meets wall
        if (wall(x, y - 1)) {
          const gr = g.createLinearGradient(0, y * T, 0, y * T + 12);
          gr.addColorStop(0, 'rgba(0,0,0,0.6)');
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr;
          g.fillRect(x * T, y * T, T, 12);
        }
        if (wall(x - 1, y)) {
          g.fillStyle = 'rgba(0,0,0,0.3)';
          g.fillRect(x * T, y * T, 6, T);
        }
      }
    }
    // walls, top row first so nearer walls overlap
    for (let y = 0; y < MH; y++) {
      for (let x = 0; x < MW; x++) {
        if (!map[y][x]) continue;
        const h = U.hash(x, y, 5);
        const open = !wall(x, y + 1);
        if (open) {
          const gr = g.createLinearGradient(0, y * T + T - WH, 0, y * T + T);
          gr.addColorStop(0, '#54412f');
          gr.addColorStop(1, '#221a12');
          g.fillStyle = gr;
          g.fillRect(x * T, y * T + T - WH, T + 0.5, WH);
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.lineWidth = 1;
          for (let k = 1; k < 4; k++) {
            g.beginPath();
            g.moveTo(x * T + k * 9 + h * 4, y * T + T - WH);
            g.lineTo(x * T + k * 9 + h * 4 - 2, y * T + T);
            g.stroke();
          }
        }
        // top face
        g.fillStyle = h < 0.3 ? '#6e5640' : h < 0.6 ? '#665039' : '#735a42';
        g.fillRect(x * T, y * T - WH, T + 0.5, T + 0.5);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        for (let k = 0; k < 4; k++) {
          g.beginPath();
          g.arc(x * T + U.hash(x, y, 30 + k) * T, y * T - WH + U.hash(x, y, 40 + k) * T, 2 + U.hash(x, y, 50 + k) * 4, 0, TAU);
          g.fill();
        }
        if (!wall(x, y - 1)) {
          g.fillStyle = 'rgba(255,220,170,0.12)';
          g.fillRect(x * T, y * T - WH, T, 3);
        }
        if (!wall(x - 1, y)) {
          g.fillStyle = 'rgba(255,220,170,0.06)';
          g.fillRect(x * T, y * T - WH, 2, T);
        }
        if (!wall(x + 1, y)) {
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fillRect(x * T + T - 3, y * T - WH, 3, T);
        }
      }
    }
    // violet crystals on the wall faces
    for (const cr of r.w.crystals) {
      const cx = cr.x * T + T / 2;
      const cy = cr.y * T + T - WH / 2;
      for (let k = -1; k <= 1; k++) {
        g.beginPath();
        g.moveTo(cx + k * 7 - 3, cy + 6);
        g.lineTo(cx + k * 7, cy - 8 - (k ? 0 : 6));
        g.lineTo(cx + k * 7 + 3, cy + 6);
        g.closePath();
        g.fillStyle = k ? '#6d5bc4' : '#9d8df1';
        g.fill();
      }
    }
    return { c, s };
  }

  const Render = {
    prepare(r) {
      r.terrain = paintTerrain(r);
      r.mini = canvas(MW, MH);
      r.mctx = r.mini.getContext('2d');
      r.mctx.fillStyle = 'rgba(0,0,0,0)';
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (r.explored[y * MW + x]) Render.reveal(r, x, y);
    },
    newWorld(r) {
      Render.prepare(r);
    },
    reveal(r, x, y) {
      if (!r.mctx) return;
      r.mctx.fillStyle = r.w.map[y][x] ? '#4a3c2c' : '#c9ad7d';
      r.mctx.fillRect(x, y, 1, 1);
    },

    keeper(ctx, sx, sy, p, t, light) {
      // a hooded keeper in a travelling cloak; the lantern hangs on the facing side
      const walk = Math.sin(p.walk || 0);
      const bob = Math.abs(walk) * 2 * (p.moving || 0);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 13, 5, 0, 0, TAU);
      ctx.fill();
      // feet
      ctx.fillStyle = '#1a140e';
      ctx.beginPath();
      ctx.ellipse(-5 + walk * 3, 9, 4, 3, 0, 0, TAU);
      ctx.ellipse(5 - walk * 3, 9, 4, 3, 0, 0, TAU);
      ctx.fill();
      // cloak
      const fx = Math.cos(p.face);
      ctx.beginPath();
      ctx.moveTo(-12, 8 - bob);
      ctx.quadraticCurveTo(-13, -10 - bob, 0, -16 - bob);
      ctx.quadraticCurveTo(13, -10 - bob, 12, 8 - bob);
      ctx.quadraticCurveTo(0, 12 - bob, -12, 8 - bob);
      ctx.fillStyle = '#3b2a3d';
      ctx.fill();
      ctx.strokeStyle = '#1a1220';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,180,90,0.18)';
      ctx.beginPath();
      ctx.ellipse(fx * 5, -4 - bob, 6, 10, 0, 0, TAU);
      ctx.fill();
      // hood
      ctx.beginPath();
      ctx.arc(0, -17 - bob, 8.5, 0, TAU);
      ctx.fillStyle = '#4a3550';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#120c10';
      ctx.beginPath();
      ctx.ellipse(fx * 3.5, -16 - bob + Math.sin(p.face) * 2, 4.5, 4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffd38a';
      ctx.fillRect(fx * 3.5 - 2.5, -17 - bob + Math.sin(p.face) * 2, 1.5, 1.5);
      ctx.fillRect(fx * 3.5 + 1, -17 - bob + Math.sin(p.face) * 2, 1.5, 1.5);
      ctx.restore();
    },

    // the lantern itself, drawn over the darkness so the flame glows
    lantern(ctx, sx, sy, p, t, light, flick) {
      const side = Math.cos(p.face) >= 0 ? 1 : -1;
      const sw = Math.sin(t * 3 + (p.walk || 0)) * 0.25 * (p.moving || 0.3);
      const lx = sx + side * 13 + Math.sin(sw) * 4;
      const ly = sy - 6;
      ctx.save();
      ctx.strokeStyle = '#7a5a2a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx + side * 8, sy - 8);
      ctx.lineTo(lx, ly - 7);
      ctx.stroke();
      const glow = ctx.createRadialGradient(lx, ly, 1, lx, ly, 26 + light * 8);
      glow.addColorStop(0, 'rgba(255,200,110,0.55)');
      glow.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = glow;
      ctx.fillRect(lx - 40, ly - 40, 80, 80);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#c79a4f';
      ctx.fillRect(lx - 5, ly - 7, 10, 2);
      ctx.fillRect(lx - 4, ly + 5, 8, 2);
      ctx.fillStyle = 'rgba(255,220,150,0.35)';
      ctx.fillRect(lx - 4, ly - 5, 8, 10);
      const fh = 4 + light * 1.5 + (flick ? Math.sin(t * 23) * 1 + Math.sin(t * 37) * 0.6 : 0);
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.moveTo(lx, ly - fh);
      ctx.quadraticCurveTo(lx + 3, ly, lx, ly + 3);
      ctx.quadraticCurveTo(lx - 3, ly, lx, ly - fh);
      ctx.fill();
      ctx.strokeStyle = '#7a5a2a';
      ctx.lineWidth = 1;
      ctx.strokeRect(lx - 4, ly - 5, 8, 10);
      ctx.restore();
    },

    gloom(ctx, sx, sy, f, t) {
      const s = f.big ? 1.5 : 1;
      const wob = Math.sin(t * 6 + f.ph);
      const sq = 1 - f.flinch * 0.25;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(s * (1 + f.flinch * 0.15), s * sq);
      ctx.fillStyle = f.flash > 0 ? '#e8e0ff' : f.big ? '#1c1430' : '#241a3c';
      ctx.beginPath();
      ctx.moveTo(-11, 6);
      for (let k = 0; k <= 6; k++) {
        const a = Math.PI + (k / 6) * Math.PI;
        ctx.lineTo(Math.cos(a) * 11, -4 + Math.sin(a) * 13);
      }
      for (let k = 0; k <= 4; k++) ctx.lineTo(11 - k * 5.5, 6 + Math.sin(t * 9 + k + f.ph) * 3 + (k % 2 ? 4 : 0));
      ctx.closePath();
      ctx.fill();
      if (f.big) {
        ctx.fillStyle = '#120c20';
        for (const d of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(d * 5, -14);
          ctx.quadraticCurveTo(d * 14, -22 + wob, d * 12, -28);
          ctx.quadraticCurveTo(d * 9, -20, d * 2, -15);
          ctx.fill();
        }
      }
      ctx.restore();
    },

    eyes(ctx, sx, sy, f, t, dist) {
      const s = f.big ? 1.5 : 1;
      const a = U.clamp01(1.2 - dist / 11);
      if (a <= 0) return;
      const squint = 1 - f.flinch * 0.7;
      const blink = (t * 0.7 + f.ph) % 4 < 0.12 ? 0.15 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'lighter';
      const col = f.big ? '255,90,60' : '255,220,110';
      for (const d of [-1, 1]) {
        const ex = sx + d * 4.5 * s;
        const ey = sy - 6 * s;
        const gr = ctx.createRadialGradient(ex, ey, 0, ex, ey, 8 * s);
        gr.addColorStop(0, `rgba(${col},0.5)`);
        gr.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = gr;
        ctx.fillRect(ex - 9 * s, ey - 9 * s, 18 * s, 18 * s);
        ctx.fillStyle = `rgb(${col})`;
        ctx.beginPath();
        ctx.ellipse(ex, ey, 2.2 * s, 2.2 * s * squint * blink, d * 0.2, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    },

    // One frame of the cave. cam is in cells; the keeper sits at its centre.
    scene(ctx, r, cam, g, opts = {}) {
      const t = g.time;
      const sh = opts.shake || 0;
      const ox = Math.round(C.W / 2 - cam.x * T + (sh ? (Math.random() - 0.5) * sh * 20 : 0));
      const oy = Math.round(C.H / 2 - cam.y * T + (sh ? (Math.random() - 0.5) * sh * 20 : 0));
      const X = (v) => ox + v * T;
      const Y = (v) => oy + v * T;
      ctx.fillStyle = '#05050a';
      ctx.fillRect(0, 0, C.W, C.H);
      const tr = r.terrain;
      // visible part of the terrain cache
      const sx0 = Math.max(0, -ox);
      const sy0 = Math.max(0, -oy + WH);
      const sw = Math.min(MW * T - sx0, C.W);
      const shh = Math.min(MH * T + WH - sy0, C.H + WH);
      if (sw > 0 && shh > 0) ctx.drawImage(tr.c, sx0 * tr.s, sy0 * tr.s, sw * tr.s, shh * tr.s, ox + sx0, oy - WH + sy0, sw, shh);
      const inView = (x, y, m = 2) => X(x) > -T * m && X(x) < C.W + T * m && Y(y) > -T * m && Y(y) < C.H + T * m;

      // glowcaps (their glow is added after the dark)
      for (const m of r.w.glowcaps) {
        if (!inView(m.x, m.y)) continue;
        for (let k = 0; k < m.n; k++) {
          const mx = X(m.x) + (k - m.n / 2) * 6;
          const my = Y(m.y) + (k % 2) * 4;
          ctx.fillStyle = '#d9fff6';
          ctx.fillRect(mx - 1, my - 4, 2, 5);
          ctx.fillStyle = '#5ff2d8';
          ctx.beginPath();
          ctx.ellipse(mx, my - 5, 4 - (k % 2), 2.5, 0, Math.PI, 0);
          ctx.fill();
        }
      }
      // oil jars
      for (const j of r.w.jars) {
        if (j.taken > 0 || !inView(j.x, j.y)) continue;
        const jx = X(j.x);
        const jy = Y(j.y);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(jx, jy + 7, 8, 3, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#a8673a';
        ctx.beginPath();
        ctx.ellipse(jx, jy, 7, 8, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#7a4524';
        ctx.fillRect(jx - 3, jy - 11, 6, 4);
        ctx.fillStyle = 'rgba(255,220,160,0.35)';
        ctx.fillRect(jx - 4, jy - 4, 2, 6);
      }
      // shrines: standing stones with a rune
      for (const s of r.w.shrines) {
        if (!inView(s.x, s.y)) continue;
        const sx = X(s.x);
        const sy = Y(s.y);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 10, 16, 6, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#5b5560';
        ctx.beginPath();
        ctx.moveTo(sx - 11, sy + 10);
        ctx.lineTo(sx - 8, sy - 26);
        ctx.lineTo(sx, sy - 32);
        ctx.lineTo(sx + 8, sy - 26);
        ctx.lineTo(sx + 11, sy + 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#6e6874';
        ctx.fillRect(sx - 8, sy - 26, 4, 34);
      }
      // beacons: a brazier on a stepped plinth
      for (const b of r.w.beacons) {
        if (!inView(b.x, b.y, 3)) continue;
        const bx = X(b.x);
        const by = Y(b.y);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(bx, by + 12, 24, 8, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#4f4636';
        ctx.fillRect(bx - 20, by, 40, 12);
        ctx.fillStyle = '#625843';
        ctx.fillRect(bx - 20, by - 4, 40, 5);
        ctx.fillStyle = '#5a503e';
        ctx.fillRect(bx - 13, by - 18, 26, 18);
        ctx.fillStyle = '#6f6450';
        ctx.fillRect(bx - 13, by - 22, 26, 5);
        ctx.fillStyle = '#2b2419';
        ctx.beginPath();
        ctx.ellipse(bx, by - 26, 18, 7, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#8a7a5c';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // gloom bodies
      for (const f of r.foes) if (inView(f.x, f.y)) this.gloom(ctx, X(f.x), Y(f.y), f, t);
      // the keeper
      const p = r.p;
      if (!(p.hurt > 0 && Math.floor(t * 16) % 2)) this.keeper(ctx, X(p.x), Y(p.y), p, t, r.light);
      if (p.swing > 0) {
        const k = (0.18 - p.swing) / 0.18;
        ctx.strokeStyle = 'rgba(246,231,200,0.9)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(X(p.x), Y(p.y) - 6, T * 1.1, p.face - 1 + k * 1.4, p.face - 0.5 + k * 1.4);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }

      // ---- the darkness ----
      const flick = g.settings.flicker;
      const L = LIGHT[r.light];
      const fuel = Math.min(1, 0.4 + p.oil / 60);
      const lr = L.r * (flick ? 0.97 + Math.sin(t * 9) * 0.02 + Math.sin(t * 23) * 0.012 : 1) * fuel;
      dctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
      dctx.globalCompositeOperation = 'source-over';
      dctx.clearRect(0, 0, C.W, C.H);
      dctx.fillStyle = 'rgba(3,3,8,0.965)';
      dctx.fillRect(0, 0, C.W, C.H);
      dctx.globalCompositeOperation = 'destination-out';
      const hole = (cx, cy, rad, poly, core = 0.3) => {
        const px = X(cx);
        const py = Y(cy);
        const R = rad * T;
        const gr = dctx.createRadialGradient(px, py, R * core, px, py, R);
        gr.addColorStop(0, 'rgba(0,0,0,1)');
        gr.addColorStop(0.6, 'rgba(0,0,0,0.75)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        dctx.fillStyle = gr;
        if (poly) {
          dctx.beginPath();
          for (let i = 0; i < poly.length; i += 2) dctx.lineTo(X(poly[i]), Y(poly[i + 1]));
          dctx.closePath();
          dctx.fill();
        } else dctx.fillRect(px - R, py - R, R * 2, R * 2);
      };
      const poly = r.demo || !r.poly ? W.visibility(r.w, p.x, p.y, lr, 160) : W.visibility(r.w, p.x, p.y, lr, 160);
      hole(p.x, p.y, lr, poly);
      hole(p.x, p.y, 1.1, null, 0.2); // you can always see yourself
      for (const b of r.w.beacons) if (b.lit && b.poly && inView(b.x, b.y, 10)) hole(b.x, b.y, 8.5 * (flick ? 0.98 + Math.sin(t * 5 + b.x) * 0.02 : 1), b.poly, 0.4);
      for (const m of r.w.glowcaps) if (inView(m.x, m.y)) hole(m.x, m.y, 1.1 + Math.sin(t * 1.5 + m.ph) * 0.1, null, 0);
      for (const j of r.w.jars) if (j.taken <= 0 && inView(j.x, j.y)) hole(j.x, j.y, 0.55, null, 0);
      ctx.drawImage(dark, 0, 0, C.W, C.H);

      // warm light added on top: the flame's colour, and lit beacons'
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const tint = (cx, cy, rad, poly2, a, col) => {
        const px = X(cx);
        const py = Y(cy);
        const R = rad * T;
        const gr = ctx.createRadialGradient(px, py, 0, px, py, R);
        gr.addColorStop(0, `rgba(${col},${a})`);
        gr.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = gr;
        ctx.beginPath();
        for (let i = 0; i < poly2.length; i += 2) ctx.lineTo(X(poly2[i]), Y(poly2[i + 1]));
        ctx.closePath();
        ctx.fill();
      };
      tint(p.x, p.y, lr, poly, 0.16 + r.light * 0.04, '255,150,60');
      for (const b of r.w.beacons) if (b.lit && b.poly && inView(b.x, b.y, 10)) tint(b.x, b.y, 8.5, b.poly, 0.2, '255,170,80');
      // glowcap and crystal glints
      for (const m of r.w.glowcaps) {
        if (!inView(m.x, m.y)) continue;
        const gx = X(m.x);
        const gy = Y(m.y) - 4;
        const a = 0.25 + Math.sin(t * 1.5 + m.ph) * 0.08;
        const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, 22);
        gr.addColorStop(0, `rgba(95,242,216,${a})`);
        gr.addColorStop(1, 'rgba(95,242,216,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(gx - 22, gy - 22, 44, 44);
      }
      for (const cr of r.w.crystals) {
        const d = Math.hypot(cr.x + 0.5 - p.x, cr.y + 1 - p.y);
        if (d > lr * 1.3 || !inView(cr.x, cr.y)) continue;
        const a = U.clamp01(1 - d / (lr * 1.3)) * (0.5 + Math.sin(t * 3 + cr.ph) * 0.3);
        G.sigil(ctx, X(cr.x + 0.5) + Math.sin(cr.ph) * 6, Y(cr.y + 1) - WH / 2 - 8, 5, `rgba(200,180,255,${a})`);
      }
      // drifting dust in the light
      for (const m of r.motes) {
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        if (d > lr) continue;
        const a = (1 - d / lr) * (0.25 + m.z * 0.4) * (0.6 + Math.sin(t * 2 + m.ph) * 0.4);
        ctx.fillStyle = `rgba(255,220,170,${a})`;
        ctx.fillRect(X(m.x), Y(m.y), 1 + m.z * 1.5, 1 + m.z * 1.5);
      }
      ctx.restore();

      // things that shine in the dark
      for (const b of r.w.beacons) {
        if (!b.lit || !inView(b.x, b.y, 3)) continue;
        const bx = X(b.x);
        const by = Y(b.y) - 28;
        const k = b.igniteT !== undefined ? U.easeBack(U.clamp01(b.igniteT / 0.6)) : 1;
        for (let i = 0; i < 4; i++) {
          const h = (16 + i * 4 + Math.sin(t * 11 + i * 2) * 4) * k;
          ctx.fillStyle = ['#ff6a2b', '#ffb347', '#ffe08a', '#fff6d0'][i];
          ctx.beginPath();
          ctx.moveTo(bx - 14 + i * 3, by);
          ctx.quadraticCurveTo(bx - 8 + i * 2, by - h * 0.6, bx + Math.sin(t * 7 + i) * 3, by - h);
          ctx.quadraticCurveTo(bx + 8 - i * 2, by - h * 0.6, bx + 14 - i * 3, by);
          ctx.fill();
        }
      }
      for (const s of r.w.shrines) {
        if (!inView(s.x, s.y)) continue;
        const owned = r.owned && r.owned.has(s.up.id);
        const a = owned ? 0.25 : 0.6 + Math.sin(t * 2.5 + s.x) * 0.3;
        G.sigil(ctx, X(s.x), Y(s.y) - 14, 6, `rgba(95,242,216,${a})`);
      }
      for (const f of r.foes) if (inView(f.x, f.y)) this.eyes(ctx, X(f.x), Y(f.y), f, t, Math.hypot(f.x - p.x, f.y - p.y));
      this.lantern(ctx, X(p.x), Y(p.y), p, t, r.light, flick);
      // moths circling the flame
      for (let k = 0; k < 3; k++) {
        const a = t * (1.6 + k * 0.4) + k * 2.1;
        const rr = 18 + k * 7 + Math.sin(t * 3 + k) * 5;
        const mx = X(p.x) + Math.cos(p.face) * 10 + Math.cos(a) * rr;
        const my = Y(p.y) - 10 + Math.sin(a * 1.3) * rr * 0.6;
        const fl = Math.abs(Math.sin(t * 30 + k));
        ctx.fillStyle = 'rgba(240,225,200,0.75)';
        ctx.beginPath();
        ctx.ellipse(mx - 2, my, 2.5, 1.2 + fl * 1.5, -0.5, 0, TAU);
        ctx.ellipse(mx + 2, my, 2.5, 1.2 + fl * 1.5, 0.5, 0, TAU);
        ctx.fill();
      }
      // effects
      ctx.save();
      for (const f of r.fx) {
        const k = f.t / f.life;
        const fx = X(f.x);
        const fy = Y(f.y);
        if (f.k === 'ember') {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(255,${150 + Math.floor(80 * (1 - k))},60,${1 - k})`;
          ctx.fillRect(fx, fy, 2, 2);
        } else if (f.k === 'spark') {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = f.color;
          ctx.globalAlpha = 1 - k;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx - f.vx * 3, fy - f.vy * 3);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (f.k === 'drop') {
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = `rgba(255,170,60,${1 - k})`;
          ctx.beginPath();
          ctx.arc(fx, fy, 2.5, 0, TAU);
          ctx.fill();
        } else if (f.k === 'wisp') {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(157,141,241,${0.7 * (1 - k)})`;
          ctx.beginPath();
          ctx.arc(fx, fy, 3 * (1 - k) + 1, 0, TAU);
          ctx.fill();
        } else if (f.k === 'ring') {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = f.color;
          ctx.globalAlpha = 1 - k;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(fx, fy, f.rad * T * U.easeOut(k), 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (f.k === 'text') {
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = U.clamp01((1 - k) * 2);
          G.text(ctx, f.s, fx, fy - 24 - k * 26, 20, f.color, 'center', 700);
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    },

    // the explored map, drawn with beacons and shrines that have been seen
    map(ctx, r, x, y, scale, t, full) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(r.mini, x, y, MW * scale, MH * scale);
      ctx.imageSmoothingEnabled = true;
      const seen = (o) => r.explored[Math.floor(o.y) * MW + Math.floor(o.x)];
      for (const b of r.w.beacons) {
        if (!seen(b) && !b.lit) continue;
        G.sigil(ctx, x + b.x * scale, y + b.y * scale, full ? 9 : 5, b.lit ? '#ffb347' : '#8a7a5c');
        if (full) G.text(ctx, b.name, x + b.x * scale, y + b.y * scale + 16, 14, b.lit ? '#ffb347' : '#a8957a', 'center', 700);
      }
      for (const s of r.w.shrines) {
        if (!seen(s)) continue;
        ctx.fillStyle = r.owned && r.owned.has(s.up.id) ? '#3b6b62' : '#5ff2d8';
        ctx.fillRect(x + s.x * scale - (full ? 4 : 2), y + s.y * scale - (full ? 4 : 2), full ? 8 : 4, full ? 8 : 4);
        if (full) G.text(ctx, s.up.name, x + s.x * scale, y + s.y * scale + 14, 12, '#7fd8c6', 'center', 600);
      }
      const p = r.p;
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(x + p.x * scale, y + p.y * scale, (full ? 5 : 2.5) + Math.sin(t * 6) * 0.8, 0, TAU);
      ctx.fill();
      ctx.restore();
    },
  };
  LL.Render = Render;
})();
