// Gate Stampede's playroom in perspective. The camera rides behind the crowd;
// everything ahead is projected so it grows as it comes closer: a wooden
// plank road, alphabet blocks and lollipop trees along the felt, archway
// gates, spinning saws, rival squads and the block castle at the end.
(function () {
  const R = GS.Rules;
  const HW = 2.2, SC = 110, CB = 4.6, CH = 3.1;        // half track width, track px per unit, camera back / height
  const TAU = Math.PI * 2;
  const V = {
    W: 0, H: 0, F: 1, HOR: 0, camX: 0, t: 0, parts: [], pops: [],

    resize(W, H) {
      this.W = W; this.H = H;
      this.F = Math.min(0.62 * H, (0.86 * W * CB) / (2 * HW));
      this.HOR = H * 0.74 - (CH * this.F) / CB;
    },
    // world: x across (metres), y up, z ahead of the crowd
    p(x, y, z) {
      const Z = Math.max(0.35, z + CB);
      return [this.W / 2 + ((x - this.camX) * this.F) / Z, this.HOR + ((CH - y) * this.F) / Z, this.F / Z];
    },
    zOf(d, dist) { return (d - dist) / SC; },

    // ---------- pieces ----------
    poly(c, pts, fill) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = fill; c.fill(); },
    box(c, x0, x1, y0, y1, z0, z1, col) {
      const P = (x, y, z) => this.p(x, y, z);
      const mid = (x0 + x1) / 2 - this.camX;
      if (mid > 0.05) this.poly(c, [P(x0, y1, z1), P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1)], col.side);
      else if (mid < -0.05) this.poly(c, [P(x1, y1, z1), P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1)], col.side);
      this.poly(c, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0)], col.front);
      if (y1 < CH) this.poly(c, [P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], col.top);
    },
    fog(z) { return Math.max(0, Math.min(0.75, (z - 18) / 40)); },

    sky(c) {
      const W = this.W, H = this.H, hor = this.HOR;
      const g = c.createLinearGradient(0, 0, 0, hor);
      g.addColorStop(0, '#6ec3ff'); g.addColorStop(1, '#fff1d0');
      c.fillStyle = g; c.fillRect(0, 0, W, hor + 2);
      // puffy clouds drifting
      for (let i = 0; i < 6; i++) {
        const x = ((i * 237 + this.t * (8 + i * 3)) % (W + 300)) - 150, y = hor * (0.15 + (i % 3) * 0.17);
        c.fillStyle = 'rgba(255,255,255,0.9)';
        for (const [ox, oy, r] of [[0, 0, 26], [28, -10, 32], [60, 0, 24], [30, 8, 26]]) { c.beginPath(); c.arc(x + ox, y + oy, r, 0, TAU); c.fill(); }
      }
      // giant toys on the horizon: alphabet blocks and a rocket, painted flat
      const toys = [[0.08, 70, '#e63946', 'A'], [0.2, 50, '#2f6fdb', 'B'], [0.78, 64, '#2a9d5c', 'C'], [0.9, 46, '#f7c548', 'D']];
      for (const [fx, s, col, ch] of toys) {
        const x = fx * W - this.camX * 6;
        c.fillStyle = col; c.fillRect(x - s / 2, hor - s, s, s);
        c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = `400 ${s * 0.6}px 'Bowlby One SC', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, x, hor - s / 2 + 2);
      }
      const rx = W * 0.62 - this.camX * 5;
      c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(rx, hor - 120); c.lineTo(rx + 18, hor - 80); c.lineTo(rx + 18, hor - 10); c.lineTo(rx - 18, hor - 10); c.lineTo(rx - 18, hor - 80); c.closePath(); c.fill();
      c.fillStyle = '#e63946'; c.beginPath(); c.moveTo(rx, hor - 120); c.lineTo(rx + 18, hor - 80); c.lineTo(rx - 18, hor - 80); c.fill();
      c.fillRect(rx - 30, hor - 34, 12, 24); c.fillRect(rx + 18, hor - 34, 12, 24);
      c.fillStyle = '#2f6fdb'; c.beginPath(); c.arc(rx, hor - 62, 7, 0, TAU); c.fill();
      // felt floor
      const f = c.createLinearGradient(0, hor, 0, H);
      f.addColorStop(0, '#9ccf7a'); f.addColorStop(1, '#4f9a4a');
      c.fillStyle = f; c.fillRect(0, hor, W, H - hor);
    },
    road(c, dist) {
      const zFar = 70, zNear = -CB + 0.5;
      // planks: alternating stripes that slide toward the camera
      const plank = 1.2, off = (dist / SC) % (plank * 2);
      this.poly(c, [this.p(-HW - 0.2, 0, zFar), this.p(HW + 0.2, 0, zFar), this.p(HW + 0.2, 0, zNear), this.p(-HW - 0.2, 0, zNear)], '#d9a066');
      for (let z = zFar - ((zFar - off) % (plank * 2)); z > zNear; z -= plank * 2) {
        const z0 = Math.max(zNear, z - plank);
        const fogA = this.fog(z);
        this.poly(c, [this.p(-HW, 0, z), this.p(HW, 0, z), this.p(HW, 0, z0), this.p(-HW, 0, z0)], `rgba(${Math.round(196 + fogA * 40)},${Math.round(136 + fogA * 80)},${Math.round(82 + fogA * 110)},1)`);
      }
      // plank seams down the road
      c.strokeStyle = 'rgba(120, 72, 30, 0.35)'; c.lineWidth = 1.5;
      for (const x of [-HW / 2, 0, HW / 2]) { const [ax, ay] = this.p(x, 0, zFar), [bx, by] = this.p(x, 0, zNear); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); }
      // candy-striped rails
      for (const side of [-1, 1]) {
        const x = side * (HW + 0.1);
        for (let z = zFar - ((zFar - off) % 1.2); z > zNear; z -= 1.2) {
          const z0 = Math.max(zNear, z - 0.6);
          this.box(c, x - 0.1, x + 0.1, 0, 0.22, z0, z, { top: '#ffffff', front: '#e8e0d0', side: '#d8d0c0' });
          if (z - 0.6 > zNear) this.box(c, x - 0.1, x + 0.1, 0, 0.22, Math.max(zNear, z - 1.2), z - 0.6, { top: '#e63946', front: '#c1121f', side: '#9b0f19' });
        }
      }
    },
    // scenery beside the road, fixed in the world so it scrolls by
    scenery(dist) {
      const out = [], first = Math.floor((dist - CB * SC) / (2.6 * SC)), last = first + 28;
      for (let k = first; k < last; k++) {
        const d = k * 2.6 * SC, z = this.zOf(d, dist);
        if (z < -2.2 || z > 65) continue;
        for (const side of [-1, 1]) {
          const h = (k * 7919 + (side > 0 ? 13 : 0)) >>> 0, kind = h % 4;
          out.push({ z, draw: (c) => this.prop(c, kind, side * (HW + 1.4 + (h % 3) * 0.5), z, h) });
        }
      }
      return out;
    },
    prop(c, kind, x, z, h) {
      const cols = [['#e63946', '#c1121f', '#9b0f19'], ['#2f6fdb', '#2459b8', '#1b4590'], ['#2a9d5c', '#1f7d48', '#185f37'], ['#f7c548', '#d9a92d', '#b88a1d']];
      const col = cols[h % 4];
      if (kind < 2) {
        const s = 0.6 + (h % 5) * 0.08;
        this.box(c, x - s, x + s, 0, s * 2, z - s, z + s, { top: col[0], front: col[1], side: col[2] });
        const [lx, ly, sc] = this.p(x, s, z - s);
        c.fillStyle = 'rgba(255,255,255,0.9)'; c.font = `400 ${Math.max(6, sc * s * 1.3)}px 'Bowlby One SC', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('ABCDEFGHKMPRSTWZ'[h % 16], lx, ly);
      } else if (kind === 2) {
        const [bx, by, s] = this.p(x, 0, z), [tx, ty] = this.p(x, 1.8, z);
        c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, s * 0.12); c.beginPath(); c.moveTo(bx, by); c.lineTo(tx, ty); c.stroke();
        c.fillStyle = col[0]; c.beginPath(); c.arc(tx, ty, s * 0.7, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = Math.max(1, s * 0.12); c.beginPath(); c.arc(tx, ty, s * 0.4, 0, TAU * 0.75); c.stroke();
      } else {
        // a little toy drum
        const [bx, by, s] = this.p(x, 0, z);
        c.fillStyle = col[1]; c.fillRect(bx - s * 0.5, by - s * 0.8, s, s * 0.8);
        c.fillStyle = '#fff6e3'; c.beginPath(); c.ellipse(bx, by - s * 0.8, s * 0.5, s * 0.16, 0, 0, TAU); c.fill();
        c.strokeStyle = '#fff6e3'; c.lineWidth = Math.max(1, s * 0.06); c.beginPath(); c.moveTo(bx - s * 0.5, by - s * 0.7); c.lineTo(bx, by - s * 0.1); c.lineTo(bx + s * 0.5, by - s * 0.7); c.stroke();
      }
    },
    gate(c, r, z) {
      const sign = (g, x0, x1, took) => {
        const good = R.kind(g) === 'good';
        const col = good ? ['#3f86ff', '#2f6fdb', '#1d4fa8'] : ['#ff5a66', '#e63946', '#a51d29'];
        const lit = took ? 1 : 0;
        // the curtain between the pillars
        c.globalAlpha = 0.22 + lit * 0.3;
        this.poly(c, [this.p(x0, 2.5, z), this.p(x1, 2.5, z), this.p(x1, 0, z), this.p(x0, 0, z)], col[0]);
        c.globalAlpha = 1;
        this.box(c, x0, x0 + 0.22, 0, 2.5, z, z + 0.22, { top: col[0], front: col[1], side: col[2] });
        this.box(c, x1 - 0.22, x1, 0, 2.5, z, z + 0.22, { top: col[0], front: col[1], side: col[2] });
        this.box(c, x0, x1, 2.5, 3.2, z, z + 0.22, { top: col[0], front: col[1], side: col[2] });
        const [sx, sy, s] = this.p((x0 + x1) / 2, 2.85, z);
        c.fillStyle = '#fff'; c.font = `400 ${Math.max(8, s * 0.62)}px 'Bowlby One SC', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(R.label(g), sx, sy + s * 0.04);
      };
      sign(r.left, -HW, 0, r.took === 'left');
      sign(r.right, 0, HW, r.took === 'right');
    },
    saw(c, r, z) {
      const x = r.x * HW, [cx, cy, s] = this.p(x, 0.85, z), rad = s * 0.75, rot = this.t * 9;
      this.box(c, x - 0.5, x + 0.5, 0, 0.18, z - 0.25, z + 0.25, { top: '#f7c548', front: '#2b1d14', side: '#1a110b' });
      c.save(); c.translate(cx, cy); c.rotate(rot);
      c.fillStyle = r.hit ? '#c1121f' : '#9aa5b4';
      c.beginPath();
      for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU, rr = k % 2 ? rad * 0.82 : rad; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.closePath(); c.fill();
      c.fillStyle = '#d6dde6'; c.beginPath(); c.arc(0, 0, rad * 0.55, 0, TAU); c.fill();
      c.fillStyle = '#e63946'; c.beginPath(); c.arc(0, 0, rad * 0.18, 0, TAU); c.fill();
      c.restore();
    },
    soldier(c, x, z, coat, s, phase, hat) {
      const [bx, by, k] = this.p(x, 0, z);
      const u = k * s, bob = Math.abs(Math.sin(phase)) * u * 0.08;
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(bx, by, u * 0.22, u * 0.07, 0, 0, TAU); c.fill();
      const step = Math.sin(phase) * u * 0.06;
      c.fillStyle = '#2b1d14'; c.fillRect(bx - u * 0.1 + step, by - u * 0.32, u * 0.08, u * 0.32); c.fillRect(bx + u * 0.02 - step, by - u * 0.32, u * 0.08, u * 0.32);
      c.fillStyle = coat; c.fillRect(bx - u * 0.14, by - u * 0.66 - bob, u * 0.28, u * 0.36);
      c.fillStyle = '#fff'; c.fillRect(bx - u * 0.14, by - u * 0.5 - bob, u * 0.28, u * 0.05);
      c.fillStyle = '#ffd8b0'; c.beginPath(); c.arc(bx, by - u * 0.76 - bob, u * 0.1, 0, TAU); c.fill();
      c.fillStyle = hat; c.fillRect(bx - u * 0.1, by - u * 1.02 - bob, u * 0.2, u * 0.2);
    },
    // cluster positions for a crowd of n: a sunflower spiral, tightest in the middle
    cluster(n, spread) {
      const pts = [], shown = Math.min(n, 150);
      for (let i = 0; i < shown; i++) { const a = i * 2.39996, r = Math.sqrt(i) * spread; pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.7, i]); }
      return pts;
    },
    rivals(c, r, z) {
      for (const [ox, oz, i] of this.cluster(r.n, 0.2).sort((a, b) => b[1] - a[1])) this.soldier(c, ox, z + oz, '#c1121f', 0.9, this.t * 8 + i, '#2b1d14');
      const [tx, ty, s] = this.p(0, 2.1, z);
      this.tag(c, tx, ty, String(r.n), '#c1121f', s);
    },
    castle(c, z, guards) {
      const wall = { top: '#e0b07a', front: '#c98b4b', side: '#a86f37' };
      this.box(c, -HW - 1.2, HW + 1.2, 0, 2.6, z, z + 1.4, wall);
      for (const tx of [-HW - 1.2, HW + 0.2]) {
        this.box(c, tx, tx + 1, 0, 4.2, z - 0.2, z + 1.2, { top: '#f7c548', front: '#e63946', side: '#b0222d' });
        this.poly(c, [this.p(tx - 0.1, 4.2, z - 0.2), this.p(tx + 0.5, 5.4, z + 0.5), this.p(tx + 1.1, 4.2, z - 0.2)], '#2f6fdb');
      }
      for (let i = 0; i < 6; i++) { const x = -HW + 0.2 + i * 0.8; this.box(c, x, x + 0.45, 2.6, 3.1, z, z + 0.4, wall); }
      this.poly(c, [this.p(-0.9, 1.8, z - 0.01), this.p(0.9, 1.8, z - 0.01), this.p(0.9, 0, z - 0.01), this.p(-0.9, 0, z - 0.01)], '#5a3a1e');
      const [fx, fy, s] = this.p(0, 4.4, z + 0.5);
      c.strokeStyle = '#2b1d14'; c.lineWidth = Math.max(1, s * 0.05); c.beginPath(); c.moveTo(fx, fy + s * 1.2); c.lineTo(fx, fy - s * 0.4); c.stroke();
      c.fillStyle = '#e63946'; c.beginPath(); c.moveTo(fx, fy - s * 0.4); c.lineTo(fx + s * (0.6 + Math.sin(this.t * 6) * 0.06), fy - s * 0.25); c.lineTo(fx, fy - s * 0.1); c.fill();
      const [gx, gy, gs] = this.p(0, 3.5, z);
      this.tag(c, gx, gy, 'Guards ' + guards, '#2b1d14', gs);
    },
    tag(c, x, y, text, bg, s) {
      const size = Math.max(11, Math.min(30, s * 0.45));
      c.font = `400 ${size}px 'Bowlby One SC', sans-serif`;
      const w = c.measureText(text).width + size * 0.9, h = size * 1.45;
      c.fillStyle = 'rgba(43,29,20,0.9)'; c.beginPath(); c.roundRect(x - w / 2, y - h / 2 + 3, w, h, h / 2); c.fill();
      c.fillStyle = bg; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, h / 2); c.fill();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + 1);
    },

    // ---------- the frame ----------
    draw(c, s, opts) {
      const dist = s.dist, L = s.L;
      this.camX += (s.x * HW * 0.55 - this.camX) * 0.12;
      this.sky(c);
      this.road(c, dist);
      const items = this.scenery(dist);
      for (const r of L.rows) {
        const z = this.zOf(r.d, dist);
        // once a row is behind the crowd it would fill the screen; drop it
        if (z < -0.4 || z > 70) continue;
        if (r.kind === 'gates') items.push({ z, draw: (cx) => this.gate(cx, r, z) });
        else if (r.kind === 'saw') items.push({ z, draw: (cx) => this.saw(cx, r, z) });
        else if (!r.done) items.push({ z, draw: (cx) => this.rivals(cx, r, z) });
      }
      const cz = this.zOf(L.end + 120, dist);
      if (cz < 70) items.push({ z: cz, draw: (cx) => this.castle(cx, cz, L.castle) });
      // the crowd
      const crowdX = s.x * HW, pts = this.cluster(s.n, 0.17);
      for (const [ox, oz, i] of pts) items.push({ z: oz + 0.6, draw: (cx) => this.soldier(cx, crowdX + ox, oz + 0.6, '#2f6fdb', 1, this.t * 10 + i * 0.7, '#2b1d14') });
      items.sort((a, b) => b.z - a.z);
      for (const it of items) {
        // far things fade into the haze; things just behind the crowd fade out
        c.globalAlpha = Math.max(0, Math.min(1, 1 - this.fog(it.z) * 0.8, it.z < 0 ? 1 + it.z / 2.2 : 1));
        it.draw(c);
      }
      c.globalAlpha = 1;
      // count over the crowd
      if (s.n > 0) { const [tx, ty, k] = this.p(crowdX, 1.5 + Math.sqrt(Math.min(s.n, 150)) * 0.05, 0.6); this.tag(c, tx, ty, String(s.n), '#2f6fdb', k * 1.3); }
      // floating gate results and confetti
      for (const p of this.pops) {
        c.globalAlpha = Math.max(0, 1 - p.t / 1.1);
        c.font = `400 ${Math.round(Math.min(this.W, this.H) * 0.07)}px 'Bowlby One SC', sans-serif`; c.textAlign = 'center';
        c.fillStyle = '#2b1d14'; c.fillText(p.text, this.W / 2 + p.x + 3, this.H * 0.5 - p.t * 70 + 4);
        c.fillStyle = p.good ? '#f7c548' : '#e63946'; c.fillText(p.text, this.W / 2 + p.x, this.H * 0.5 - p.t * 70);
      }
      c.globalAlpha = 1;
      for (const q of this.parts) { c.globalAlpha = Math.max(0, q.life); c.fillStyle = q.color; c.save(); c.translate(q.x, q.y); c.rotate(q.r); c.fillRect(-q.s / 2, -q.s / 4, q.s, q.s / 2); c.restore(); }
      c.globalAlpha = 1;
    },
    pop(text, good) { this.pops.push({ text, good, t: 0, x: (Math.random() - 0.5) * 60 }); },
    confetti(n, colors) {
      for (let i = 0; i < n; i++) this.parts.push({ x: this.W / 2 + (Math.random() - 0.5) * this.W * 0.4, y: this.H * 0.55, vx: (Math.random() - 0.5) * 500, vy: -300 - Math.random() * 400, r: Math.random() * 6, vr: (Math.random() - 0.5) * 12, s: 8 + Math.random() * 8, life: 1.4, color: colors[i % colors.length] });
    },
    update(dt) {
      this.t += dt;
      for (const p of this.pops) p.t += dt;
      this.pops = this.pops.filter((p) => p.t < 1.1);
      for (const q of this.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 900 * dt; q.r += q.vr * dt; q.life -= dt * 0.8; }
      this.parts = this.parts.filter((q) => q.life > 0 && q.y < this.H + 40);
    },
  };
  GS.View = V;
})();
