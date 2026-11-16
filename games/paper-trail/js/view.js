// Paper Trail view: a spiral notebook lying on a walnut desk under a lamp,
// seen in gentle perspective. Folding curls the page's margins under, the way
// paper rolls into a tube so its far edges meet. Finishing a page turns it
// over on its spiral, in 3D, to show the next one. Units are grid squares.
(function () {
  const INKS = ['#24324f', '#b8323f', '#55524c'];
  const PAPER = '#fbf6ea';
  const V = {
    W: 1, H: 1, top: 70, bottom: 80, time: 0, reduced: false, parts: [], geo: {},
    t: 0.1, c: 0.9, hk: 0.85, mL: 1.1, mR: 0.75, mT: 1.0, mB: 0.8,
    w: 4, h: 4, fx: 0, fy: 0, turn: 0, S: 1, cx: 0, cy: 0, Uc: 0, Vc: 0, Vn: 0,

    resize(W, H, top, bottom) { this.W = W; this.H = H; this.top = top; this.bottom = bottom; this.geo = {}; },
    use(lv, fx = 0, fy = 0, turn = 0) {
      const key = lv.w + 'x' + lv.h;
      if (!this.geo[key]) this.geo[key] = this.fit(lv.w, lv.h);
      Object.assign(this, this.geo[key]);
      this.fx = fx; this.fy = fy; this.turn = turn;
    },
    fit(w, h) {
      Object.assign(this, { w, h, Uc: (w + this.mR - this.mL) / 2, Vc: (h + this.mB - this.mT) / 2, Vn: h + this.mB, S: 1, cx: 0, cy: 0 });
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const [u, v] of [[-this.mL - 0.2, -this.mT - 0.45], [w + this.mR + 0.3, -this.mT - 0.45], [-this.mL - 0.2, h + this.mB + 0.35], [w + this.mR + 0.3, h + this.mB + 0.35]]) {
        const p = this.proj(u, v, 0); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
      const availW = this.W * 0.97, availH = this.H - this.top - this.bottom;
      const S = Math.max(10, Math.min(availW / (x1 - x0), availH / (y1 - y0), 115));
      return { w, h, Uc: this.Uc, Vc: this.Vc, Vn: this.Vn, S, cx: this.W / 2 - ((x0 + x1) / 2) * S, cy: this.top + availH / 2 - ((y0 + y1) / 2) * S };
    },
    proj(u, v, hh) {
      const k = 1 / (1 + (this.Vn - v) * this.t);
      return [this.cx + (u - this.Uc) * this.S * k, this.cy + ((v - this.Vc) * this.c - hh * this.hk) * this.S * k, this.S * k];
    },
    unproject(sx, sy) {
      const a = (sx - this.cx) / this.S, b = (sy - this.cy) / this.S, t = this.t, c = this.c;
      const v = (b + b * this.Vn * t + this.Vc * c) / (c + b * t);
      return [a * (1 + (this.Vn - v) * t) + this.Uc, v];
    },
    // the page bends: margins curl under when folded, and the whole sheet
    // swings over its spiral (the top edge) while turning
    curl(d, f, m) { if (f < 0.002) return [d, 0]; const kap = (f * 2.3) / m; return [Math.sin(kap * d) / kap, -(1 - Math.cos(kap * d)) / kap]; },
    pt(u, v, hh = 0) {
      let U = u, Vv = v, H = hh;
      if (u < 0) { const r = this.curl(-u, this.fx, this.mL); U = -r[0]; H += r[1]; }
      else if (u > this.w) { const r = this.curl(u - this.w, this.fx, this.mR); U = this.w + r[0]; H += r[1]; }
      if (v < 0) { const r = this.curl(-v, this.fy, this.mT); Vv = -r[0]; H += r[1]; }
      else if (v > this.h) { const r = this.curl(v - this.h, this.fy, this.mB); Vv = this.h + r[0]; H += r[1]; }
      if (this.turn) { const rel = Vv + this.mT, ca = Math.cos(this.turn), sa = Math.sin(this.turn); Vv = -this.mT + rel * ca - H * sa; H = rel * sa + H * ca; }
      return this.proj(U, Vv, H);
    },
    poly(g, pts, fill, stroke, lw) {
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
    },
    line(g, pts) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); },

    // ---------- the desk ----------
    desk(g) {
      const W = this.W, H = this.H;
      const bg = g.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#4a3322'); bg.addColorStop(1, '#22180f');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      // planks and grain
      const ph = Math.max(90, H / 6);
      for (let y = 0, i = 0; y < H; y += ph, i++) {
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, W, 2);
        g.strokeStyle = 'rgba(255,220,170,0.05)'; g.lineWidth = 1;
        for (let j = 0; j < 7; j++) {
          const yy = y + ((j * 37 + i * 13) % ph);
          g.beginPath(); g.moveTo(0, yy);
          for (let x = 0; x <= W; x += 60) g.lineTo(x, yy + Math.sin(x * 0.01 + i * 2 + j) * 4);
          g.stroke();
        }
      }
      // a coffee ring from a long night
      g.strokeStyle = 'rgba(30,15,5,0.35)'; g.lineWidth = 5;
      g.beginPath(); g.ellipse(W * 0.1, H * 0.86, 46, 40, 0.3, 0.3, Math.PI * 1.9); g.stroke();
      // the lamp's warm pool of light
      const lg = g.createRadialGradient(W * 0.42, H * 0.3, 20, W * 0.5, H * 0.45, Math.max(W, H) * 0.75);
      lg.addColorStop(0, 'rgba(255,214,150,0.45)'); lg.addColorStop(0.5, 'rgba(255,190,120,0.12)'); lg.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = lg; g.fillRect(0, 0, W, H);
      if (W > 760) this.crane(g, W - 110, H - 120, 1);
    },
    // an origami crane sitting on the desk, lit from the lamp side
    crane(g, x, y, s) {
      const bob = this.reduced ? 0 : Math.sin(this.time * 1.2) * 2;
      g.save(); g.translate(x, y + bob); g.scale(s, s);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(4, 46, 58, 9, 0, 0, Math.PI * 2); g.fill();
      const F = [['#f3d9a4', [[-50, 22], [-8, 10], [0, 36]]], ['#e8c27e', [[-8, 10], [0, 36], [10, 8]]], ['#f6e2b8', [[10, 8], [0, 36], [52, 0]]],
        ['#d9a85c', [[-8, 10], [10, 8], [-2, -26]]], ['#c99247', [[10, 8], [-2, -26], [22, -6]]], ['#e8c27e', [[-50, 22], [-58, -2], [-38, 18]]], ['#b98540', [[0, 36], [-8, 10], [-12, 40]]]];
      for (const [c, p] of F) this.poly(g, p, c);
      g.restore();
    },

    // ---------- the page ----------
    flap(g, side, dark) {
      const N = 6, w = this.w, h = this.h, mL = this.mL, mR = this.mR, mT = this.mT, mB = this.mB;
      const m = side === 'L' ? mL : side === 'R' ? mR : side === 'T' ? mT : mB, f = side === 'L' || side === 'R' ? this.fx : this.fy;
      const kap = f > 0.002 ? (f * 2.3) / m : 0;
      for (let i = 0; i < N; i++) {
        const d0 = (i / N) * m, d1 = ((i + 1) / N) * m, pts = [];
        if (side === 'L' || side === 'R') {
          const at = (d) => (side === 'L' ? -d : w + d), vs = [-mT, -mT / 2, 0, h, h + mB / 2, h + mB];
          vs.forEach((v) => pts.push(this.pt(at(d0), v))); vs.slice().reverse().forEach((v) => pts.push(this.pt(at(d1), v)));
        } else {
          const at = (d) => (side === 'T' ? -d : h + d);
          pts.push(this.pt(0, at(d0)), this.pt(w, at(d0)), this.pt(w, at(d1)), this.pt(0, at(d1)));
        }
        this.poly(g, pts, dark ? '#e9dec6' : PAPER);
        const shade = (1 - Math.cos(kap * (d0 + d1) / 2)) * 0.45;
        if (shade > 0.01) this.poly(g, pts, `rgba(70,45,20,${shade})`);
      }
    },
    drawPage(g, sc, turn = 0) {
      const lv = sc.lv;
      this.use(lv, sc.fx, sc.fy, turn);
      const w = this.w, h = this.h, mL = this.mL, mR = this.mR, mT = this.mT, mB = this.mB;
      const back = Math.cos(turn) < 0;
      if (!turn) {
        // the stack of pages underneath and the notebook's shadow
        const sh = [this.proj(-mL + 0.25, -mT + 0.3, -0.2), this.proj(w + mR + 0.35, -mT + 0.3, -0.2), this.proj(w + mR + 0.35, h + mB + 0.3, -0.2), this.proj(-mL + 0.25, h + mB + 0.3, -0.2)];
        g.save(); g.filter = this.reduced ? 'none' : 'blur(8px)'; this.poly(g, sh, 'rgba(10,5,0,0.45)'); g.restore();
        for (const [o, hh, col] of [[0.16, -0.08, '#d9ccae'], [0.08, -0.04, '#e8dcc2']]) {
          this.poly(g, [this.proj(-mL + o, -mT + o * 0.6, hh), this.proj(w + mR + o, -mT + o * 0.6, hh), this.proj(w + mR + o, h + mB + o, hh), this.proj(-mL + o, h + mB + o, hh)], col, 'rgba(120,100,70,0.35)', 1);
        }
      }
      // margins first (they curl under the page), then the page itself
      for (const s of ['T', 'L', 'R', 'B']) this.flap(g, s, back);
      const body = [this.pt(0, 0), this.pt(w, 0), this.pt(w, h), this.pt(0, h)];
      if (back) {
        this.poly(g, body, '#e9dec6');
        this.poly(g, body, `rgba(60,40,20,${-Math.cos(turn) * 0.15})`);
        this.rings(g);
        return;
      }
      this.poly(g, body, PAPER);
      // ruled lines across the whole sheet and the red margin line
      const sc0 = this.pt(w / 2, h / 2)[2];
      g.lineWidth = Math.max(1, sc0 * 0.012);
      g.strokeStyle = 'rgba(80,140,200,0.32)';
      for (let j = 0; j <= h; j++) { const pts = []; for (let i = 0; i <= 12; i++) pts.push(this.pt(-mL + ((w + mL + mR) * i) / 12, j)); this.line(g, pts); }
      for (let i = 0; i <= w; i++) this.line(g, [this.pt(i, 0), this.pt(i, h)]);
      g.strokeStyle = 'rgba(80,140,200,0.12)';
      for (let q = 1; q < w * 4; q++) if (q % 4) this.line(g, [this.pt(q / 4, 0), this.pt(q / 4, h)]);
      for (let q = 1; q < h * 4; q++) if (q % 4) this.line(g, [this.pt(0, q / 4), this.pt(w, q / 4)]);
      g.strokeStyle = 'rgba(209,73,91,0.55)'; g.lineWidth = Math.max(1.2, sc0 * 0.018);
      { const pts = []; for (let j = 0; j <= 10; j++) pts.push(this.pt(-mL * 0.45, -mT + ((h + mT + mB) * j) / 10)); this.line(g, pts); }
      // handwriting in the top margin: the page number
      if (this.fy < 0.3) {
        const p = this.pt(-mL * 0.3, -mT * 0.45);
        g.save(); g.globalAlpha = 1 - this.fy * 3; g.fillStyle = '#4a587a'; g.font = `400 ${Math.round(p[2] * 0.42)}px 'Gochi Hand', cursive`; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText(sc.title || `No. ${lv.n}`, p[0], p[1]); g.restore();
      }
      this.rings(g);
      // lamp light falling across the page
      const lp = this.pt(w * 0.3, h * 0.2), lg = g.createRadialGradient(lp[0], lp[1], 0, lp[0], lp[1], lp[2] * (w + h));
      lg.addColorStop(0, 'rgba(255,230,180,0.18)'); lg.addColorStop(1, 'rgba(80,50,20,0.12)');
      this.poly(g, body, lg);

      const cell = (k) => [k % w, (k / w) | 0];
      const quad = (x0, y0, x1, y1) => [this.pt(x0, y0), this.pt(x1, y0), this.pt(x1, y1), this.pt(x0, y1)];
      const inPath = new Set(sc.path);
      for (let k = 0; k < w * h; k++) {
        const [x, y] = cell(k);
        if (!lv.open[k]) { this.hole(g, x, y, k + lv.n * 31); continue; }
        if (inPath.has(k)) this.poly(g, quad(x + 0.06, y + 0.06, x + 0.94, y + 0.94), this.alpha(INKS[sc.ink || 0], 0.08));
      }
      // the hint: a stripe of yellow highlighter
      if (sc.hint !== null && sc.hint !== undefined && sc.hintT > 0) {
        const [x, y] = cell(sc.hint), a = Math.min(1, sc.hintT) * (0.45 + 0.2 * Math.sin(this.time * 6));
        this.poly(g, quad(x + 0.08, y + 0.14, x + 0.92, y + 0.86), `rgba(255,226,60,${a})`);
      }
      // folded edges are marked with a dashed seam
      g.setLineDash([6, 6]); g.lineWidth = Math.max(1.5, sc0 * 0.03);
      if (this.fx > 0.05) { g.strokeStyle = `rgba(209,73,91,${this.fx * 0.8})`; this.line(g, [this.pt(0.02, 0), this.pt(0.02, h)]); this.line(g, [this.pt(w - 0.02, 0), this.pt(w - 0.02, h)]); }
      if (this.fy > 0.05) { g.strokeStyle = `rgba(209,73,91,${this.fy * 0.8})`; this.line(g, [this.pt(0, 0.02), this.pt(w, 0.02)]); this.line(g, [this.pt(0, h - 0.02), this.pt(w, h - 0.02)]); }
      g.setLineDash([]);
      this.ink(g, sc);
      // the start: an ink blot
      const [sx, sy] = cell(lv.start), sp = this.pt(sx + 0.5, sy + 0.5);
      g.fillStyle = INKS[sc.ink || 0];
      g.beginPath(); g.ellipse(sp[0], sp[1], sp[2] * 0.17, sp[2] * 0.15, 0.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(sp[0] + sp[2] * 0.16, sp[1] - sp[2] * 0.1, sp[2] * 0.04, 0, Math.PI * 2); g.fill();
      if (sc.stampT >= 0) this.stamp(g, sc.stampT);
    },
    rings(g) {
      const w = this.w, mL = this.mL, mR = this.mR, mT = this.mT;
      const s = this.pt(w / 2, -mT)[2];
      for (let u = -mL + 0.35; u < w + mR - 0.2; u += 0.5) {
        const hp = this.pt(u, -mT + 0.28);
        g.fillStyle = '#2b2118'; g.beginPath(); g.ellipse(hp[0], hp[1], s * 0.07, s * 0.05, 0, 0, Math.PI * 2); g.fill();
        const pts = [];
        for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI; pts.push(this.pt(u + 0.03, -mT + 0.28 - 0.5 * (1 - Math.cos(a)) / 2 * 1.05, Math.sin(a) * 0.3)); }
        g.lineCap = 'round';
        g.strokeStyle = '#3a3a40'; g.lineWidth = Math.max(2, s * 0.06); this.line(g, pts);
        g.strokeStyle = '#c9ccd4'; g.lineWidth = Math.max(1, s * 0.03); this.line(g, pts);
      }
    },
    hole(g, x, y, seed) {
      const pts = [], n = 14;
      let s = seed * 9301 + 49297;
      const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, rad = 0.36 + r() * 0.08 - (i % 2) * 0.05;
        pts.push([x + 0.5 + Math.cos(a) * rad, y + 0.5 + Math.sin(a) * rad]);
      }
      const P = pts.map((p) => this.pt(p[0], p[1]));
      this.poly(g, P, '#2b2118');
      // the desk below, and the torn paper's fibrous edge
      this.poly(g, pts.map((p) => this.pt(p[0], p[1] + 0.05, -0.12)), 'rgba(80,55,35,0.6)');
      g.lineJoin = 'round';
      this.poly(g, P, null, '#e6dabf', Math.max(1.5, P[0][2] * 0.035));
    },
    // the inked line, stepping over folded edges where it wraps
    ink(g, sc) {
      const lv = sc.lv, w = this.w, h = this.h, path = sc.path;
      if (path.length < 1) return;
      const c = (k) => [(k % w) + 0.5, ((k / w) | 0) + 0.5];
      const wob = (k, i) => (((k * 7919 + i * 104729) % 17) / 17 - 0.5) * 0.05;
      g.strokeStyle = INKS[sc.ink || 0]; g.lineCap = 'round'; g.lineJoin = 'round';
      g.lineWidth = Math.max(3, this.pt(w / 2, h / 2)[2] * 0.13);
      g.beginPath();
      let pen = false;
      const to = (u, v, move) => { const p = this.pt(u, v, 0.005); if (move || !pen) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); pen = true; };
      const [s0x, s0y] = c(path[0]); to(s0x, s0y, true);
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i], [ax, ay] = c(a), [bx, by] = c(b);
        const last = i === path.length - 1, grow = last ? sc.grow : 1;
        const axis = PT.Rules.wraps(lv, a, b);
        if (axis === 'x') {
          const s = bx < ax ? 1 : -1, ex = s > 0 ? w : 0, bxEdge = s > 0 ? 0 : w;
          to(ex, ay); to(ex + s * 0.5, ay);
          to(bxEdge - s * 0.5, by, true); to(bxEdge, by); to(bx, by);
        } else if (axis === 'y') {
          const s = by < ay ? 1 : -1, ey = s > 0 ? h : 0, byEdge = s > 0 ? 0 : h;
          to(ax, ey); to(ax, ey + s * 0.5);
          to(bx, byEdge - s * 0.5, true); to(bx, byEdge); to(bx, by);
        } else to(ax + (bx - ax) * grow + wob(b, i), ay + (by - ay) * grow + wob(b, i + 1));
      }
      g.stroke();
    },
    stamp(g, t) {
      const c = this.pt(this.w / 2, this.h / 2), k = Math.min(1, t / 0.35), sc = this.reduced ? 1 : 1 + (1 - k) * 1.2, r = Math.min(this.w, this.h) * 0.36 * c[2];
      g.save(); g.translate(c[0], c[1]); g.rotate(-0.22); g.scale(sc, sc * this.c); g.globalAlpha = 0.25 + 0.65 * k;
      g.strokeStyle = '#c0392b'; g.fillStyle = '#c0392b';
      g.lineWidth = r * 0.07; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
      g.lineWidth = r * 0.025; g.beginPath(); g.arc(0, 0, r * 0.84, 0, Math.PI * 2); g.stroke();
      g.font = `400 ${Math.round(r * 0.5)}px 'Gochi Hand', cursive`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('DONE', 0, r * 0.08);
      g.font = `400 ${Math.round(r * 0.3)}px serif`; g.fillText('★', 0, -r * 0.52); g.fillText('★', 0, r * 0.6);
      g.restore();
    },
    // a yellow pencil hovering over the end of the line, with its shadow on the page
    pencil(g, sc) {
      if (!sc.pen) return;
      const p = this.pt(sc.pen[0], sc.pen[1]), s = p[2], lift = (sc.lift || 0) * s * 0.4 + (this.reduced ? 0 : Math.sin(this.time * 3) * s * 0.03);
      const L = s * 3.2, Wd = s * 0.3, ang = -0.95 + (sc.wiggle || 0);
      g.save();
      g.translate(p[0] + s * 0.25 + lift * 0.6, p[1] + s * 0.12); g.rotate(ang + 0.15);
      g.fillStyle = 'rgba(30,20,10,0.22)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(L * 0.2, -Wd / 2); g.lineTo(L, -Wd / 2); g.lineTo(L, Wd / 2); g.lineTo(L * 0.2, Wd / 2); g.closePath(); g.fill();
      g.restore();
      g.save(); g.translate(p[0], p[1] - lift); g.rotate(ang);
      g.fillStyle = '#e9c79a'; g.beginPath(); g.moveTo(L * 0.05, 0); g.lineTo(L * 0.2, -Wd / 2); g.lineTo(L * 0.2, Wd / 2); g.closePath(); g.fill();
      g.fillStyle = '#3a3a3a'; g.beginPath(); g.moveTo(0, 0); g.lineTo(L * 0.07, -Wd * 0.17); g.lineTo(L * 0.07, Wd * 0.17); g.closePath(); g.fill();
      const bands = [['#f2b632', -Wd / 2, -Wd / 6], ['#ffd25a', -Wd / 6, Wd / 6], ['#d89a1a', Wd / 6, Wd / 2]];
      for (const [col, a, b] of bands) { g.fillStyle = col; g.fillRect(L * 0.2, a, L * 0.62, b - a); }
      g.fillStyle = '#b9bcc4'; g.fillRect(L * 0.82, -Wd / 2, L * 0.08, Wd);
      g.fillStyle = '#8d9099'; g.fillRect(L * 0.84, -Wd / 2, L * 0.012, Wd); g.fillRect(L * 0.87, -Wd / 2, L * 0.012, Wd);
      g.fillStyle = '#e88a9a'; g.beginPath(); g.moveTo(L * 0.9, -Wd / 2); g.lineTo(L * 0.97, -Wd / 2); g.quadraticCurveTo(L, -Wd / 2, L, 0); g.quadraticCurveTo(L, Wd / 2, L * 0.97, Wd / 2); g.lineTo(L * 0.9, Wd / 2); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(L * 0.2, -Wd * 0.12, L * 0.62, Wd * 0.08);
      g.restore();
    },

    // ---------- effects ----------
    alpha(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; },
    confetti(x, y, n) {
      if (this.reduced) n = Math.ceil(n / 4);
      const cols = ['#fbf6ea', '#d1495b', '#e9b44c', '#5fb3a8', '#24324f'];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, s = 150 + Math.random() * 380;
        this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.4 + Math.random(), col: cols[i % cols.length], size: 5 + Math.random() * 6, spin: Math.random() * 6, vs: (Math.random() - 0.5) * 12 });
      }
    },
    tick(dt) {
      this.time += dt;
      for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.vx *= 0.985; p.vy *= 0.985; p.spin += p.vs * dt; }
      this.parts = this.parts.filter((p) => p.life > 0 && p.y < this.H + 40);
    },
    particles(g) {
      for (const p of this.parts) {
        g.save(); g.translate(p.x, p.y); g.rotate(p.spin); g.globalAlpha = Math.min(1, p.life);
        g.fillStyle = p.col; g.fillRect(-p.size / 2, -p.size / 3, p.size, (p.size * 2) / 3 * Math.abs(Math.cos(p.spin * 1.7)) + 1);
        g.restore();
      }
    },
    // the whole frame: desk, the page (and the one turning over it), pencil, confetti
    draw(g, cur, old, turn) {
      this.desk(g);
      if (cur) this.drawPage(g, cur, 0);
      if (cur && cur.pen && !(old && turn > 0)) { this.use(cur.lv, cur.fx, cur.fy, 0); this.pencil(g, cur); }
      if (old && turn > 0) this.drawPage(g, old, turn);
      this.particles(g);
    },
  };
  V.INKS = INKS;
  PT.View = V;
})();
