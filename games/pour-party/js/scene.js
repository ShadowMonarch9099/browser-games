// Pour Party art: the soda-fountain backdrop (pre-rendered on resize), the
// glasses with their liquid, and the colour-blind symbols. All drawing is in
// CSS pixels; the canvases carry a devicePixelRatio transform.
(function () {
  // Nine flavours. The order matches the level data (colour index 0..8) and
  // each keeps the symbol it had in the first version of the game.
  const FLAVOURS = [
    { hex: '#f0384f', name: 'cherry', sym: 'circle' },
    { hex: '#ffab1a', name: 'mango', sym: 'triangle' },
    { hex: '#3fd68c', name: 'lime', sym: 'square' },
    { hex: '#3a8dff', name: 'blueberry', sym: 'diamond' },
    { hex: '#a070ff', name: 'grape', sym: 'plus' },
    { hex: '#ff84d0', name: 'bubblegum', sym: 'star' },
    { hex: '#f5eedb', name: 'cream soda', sym: 'cross' },
    { hex: '#10c6c9', name: 'curacao', sym: 'half' },
    { hex: '#a2602f', name: 'cola', sym: 'heart' },
  ];
  const MURK = '#4b3c5e';

  function mix(hex, to, k) {
    const a = parseInt(hex.slice(1), 16);
    const b = parseInt(to.slice(1), 16);
    const ch = (s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }
  FLAVOURS.forEach((f) => { f.light = mix(f.hex, '#ffffff', 0.38); f.dark = mix(f.hex, '#000000', 0.28); });

  // ---------- geometry helpers ----------
  function areaBelow(pts, Y) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const ain = a.y >= Y;
      if (ain) out.push(a);
      if (ain !== (b.y >= Y)) {
        const t = (Y - a.y) / (b.y - a.y);
        out.push({ x: a.x + (b.x - a.x) * t, y: Y });
      }
    }
    let s = 0;
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s) / 2;
  }
  // The world y of the surface when `area` of liquid sits in the polygon.
  function levelY(pts, area, minY, maxY) {
    if (area <= 0) return maxY;
    let lo = minY;
    let hi = maxY;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (areaBelow(pts, mid) > area) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function roundBottom(ctx, x, y, w, h, r) {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h - r);
    ctx.quadraticCurveTo(x, y + h, x + r, y + h);
    ctx.lineTo(x + w - r, y + h);
    ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    ctx.lineTo(x + w, y);
  }

  // ---------- symbols ----------
  function symbolPath(ctx, kind, x, y, s) {
    ctx.beginPath();
    switch (kind) {
      case 'circle': ctx.arc(x, y, s * 0.42, 0, Math.PI * 2); break;
      case 'triangle': ctx.moveTo(x, y - s * 0.48); ctx.lineTo(x + s * 0.46, y + s * 0.36); ctx.lineTo(x - s * 0.46, y + s * 0.36); ctx.closePath(); break;
      case 'square': ctx.rect(x - s * 0.36, y - s * 0.36, s * 0.72, s * 0.72); break;
      case 'diamond': ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x + s * 0.4, y); ctx.lineTo(x, y + s * 0.5); ctx.lineTo(x - s * 0.4, y); ctx.closePath(); break;
      case 'plus': {
        const a = s * 0.16, b = s * 0.46;
        ctx.moveTo(x - a, y - b); ctx.lineTo(x + a, y - b); ctx.lineTo(x + a, y - a); ctx.lineTo(x + b, y - a); ctx.lineTo(x + b, y + a); ctx.lineTo(x + a, y + a);
        ctx.lineTo(x + a, y + b); ctx.lineTo(x - a, y + b); ctx.lineTo(x - a, y + a); ctx.lineTo(x - b, y + a); ctx.lineTo(x - b, y - a); ctx.lineTo(x - a, y - a); ctx.closePath();
        break;
      }
      case 'star':
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? s * 0.22 : s * 0.5;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.closePath();
        break;
      case 'cross': {
        const a = s * 0.13, b = s * 0.4;
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
        ctx.rect(-a, -b, a * 2, b * 2); ctx.rect(-b, -a, b * 2, a * 2);
        ctx.restore();
        break;
      }
      case 'half': ctx.arc(x, y, s * 0.42, Math.PI * 0.5, Math.PI * 1.5); ctx.closePath(); ctx.moveTo(x + s * 0.42, y); ctx.arc(x, y, s * 0.42, 0, Math.PI * 2); break;
      case 'heart':
        ctx.moveTo(x, y + s * 0.42);
        ctx.bezierCurveTo(x - s * 0.62, y - s * 0.02, x - s * 0.3, y - s * 0.56, x, y - s * 0.2);
        ctx.bezierCurveTo(x + s * 0.3, y - s * 0.56, x + s * 0.62, y - s * 0.02, x, y + s * 0.42);
        break;
    }
  }
  function drawSymbol(ctx, c, x, y, s, alpha = 1) {
    const kind = FLAVOURS[c].sym;
    ctx.save();
    ctx.globalAlpha *= alpha;
    symbolPath(ctx, kind, x, y, s);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, s * 0.14);
    ctx.strokeStyle = 'rgba(30,10,20,0.45)';
    if (kind === 'half') {
      ctx.stroke();
      symbolPath(ctx, 'half', x, y, s);
      ctx.beginPath(); ctx.arc(x, y, s * 0.42, Math.PI * 0.5, Math.PI * 1.5); ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, s * 0.42, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = Math.max(1.2, s * 0.09);
      ctx.stroke();
    } else {
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fill(kind === 'half' ? 'evenodd' : 'nonzero');
    }
    ctx.restore();
  }

  // ---------- the backdrop ----------
  const Scene = {
    FLAVOURS, MURK, mix,
    W: 0, H: 0, dpr: 1, counterY: 0, surfaceTop: 0,
    ox: 0, oy: 0, // screen-shake offset applied to everything drawn on the play canvas
    air: [],

    base(ctx) {
      const d = this.dpr;
      ctx.setTransform(d, 0, 0, d, this.ox * d, this.oy * d);
    },

    resize(bgCanvas, W, H, dpr) {
      this.W = W;
      this.H = H;
      this.dpr = dpr;
      this.counterY = Math.round(H - Math.max(96, H * 0.17));
      this.surfaceTop = this.counterY - Math.max(24, Math.min(54, H * 0.055));
      bgCanvas.width = Math.round(W * dpr);
      bgCanvas.height = Math.round(H * dpr);
      const ctx = bgCanvas.getContext('2d', { alpha: false });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.paintBackdrop(ctx);
      if (!this.air.length) {
        for (let i = 0; i < 22; i++) this.air.push({ x: Math.random(), y: Math.random(), r: 1.5 + Math.random() * 4, s: 0.3 + Math.random() * 0.8, p: Math.random() * 6 });
      }
    },

    paintBackdrop(ctx) {
      const { W, H } = this;
      const top = this.surfaceTop;
      // wall
      const wall = ctx.createLinearGradient(0, 0, 0, top);
      wall.addColorStop(0, '#0d2c31');
      wall.addColorStop(1, '#1b4f53');
      ctx.fillStyle = wall;
      ctx.fillRect(0, 0, W, top + 2);
      // subway tiles
      const th = Math.max(16, Math.min(30, H / 26));
      const tw = th * 2;
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let r = 0, y = top - th; y > -th; r++, y -= th) {
        const off = r % 2 ? tw / 2 : 0;
        for (let x = -off; x < W; x += tw) {
          const v = rnd();
          ctx.fillStyle = `rgba(160,235,215,${0.035 + v * 0.035})`;
          ctx.fillRect(x + 1.5, y + 1.5, tw - 3, th - 3);
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(x + 2, y + 2, tw - 4, 1.5);
          ctx.fillStyle = 'rgba(0,0,0,0.16)';
          ctx.fillRect(x + 2, y + th - 3, tw - 4, 1.5);
        }
      }
      // a chrome rail along the wall
      const railY = top - Math.max(18, H * 0.03);
      this.chrome(ctx, 0, railY, W, 5);

      // back-bar shelves with bottles, left and right of the play area
      if (W > H * 1.15) {
        const sy = Math.max(120, H * 0.3);
        const sw = Math.min(W * 0.17, 230);
        this.shelf(ctx, 14, sy, sw, rnd);
        this.shelf(ctx, W - 14 - sw, sy, sw, rnd);
        this.shelf(ctx, 14, sy + Math.min(150, H * 0.24), sw * 0.85, rnd);
        this.shelf(ctx, W - 14 - sw * 0.85, sy + Math.min(150, H * 0.24), sw * 0.85, rnd);
      }

      // pendant lamps and their pools of light
      const lamps = W > 900 ? [0.2, 0.5, 0.8] : W > 520 ? [0.27, 0.73] : [0.5];
      for (const f of lamps) {
        const lx = W * f;
        const g = ctx.createRadialGradient(lx, H * 0.08, 10, lx, top * 0.7, Math.max(W, H) * 0.42);
        g.addColorStop(0, 'rgba(255,214,150,0.22)');
        g.addColorStop(0.5, 'rgba(255,190,120,0.07)');
        g.addColorStop(1, 'rgba(255,190,120,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, top);
      }
      for (const f of lamps) this.lamp(ctx, W * f, Math.max(26, H * 0.045));

      // counter surface: speckled cream formica seen from just above
      const cy = this.counterY;
      const surf = ctx.createLinearGradient(0, top, 0, cy + 14);
      surf.addColorStop(0, '#c9b693');
      surf.addColorStop(0.35, '#efe1c4');
      surf.addColorStop(1, '#fbf1dc');
      ctx.fillStyle = surf;
      ctx.fillRect(0, top, W, cy + 14 - top);
      for (let i = 0; i < W * 0.6; i++) {
        const x = rnd() * W;
        const y = top + rnd() * (cy + 14 - top);
        ctx.fillStyle = rnd() < 0.5 ? 'rgba(120,90,60,0.18)' : 'rgba(232,52,78,0.14)';
        ctx.fillRect(x, y, 1.6, 1.2);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, top, W, 2);
      // lamp reflections on the counter
      for (const f of lamps) {
        const g = ctx.createRadialGradient(W * f, cy - 4, 2, W * f, cy - 4, W * 0.16);
        g.addColorStop(0, 'rgba(255,255,255,0.35)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save();
        ctx.translate(W * f, cy - 4);
        ctx.scale(1, 0.16);
        ctx.translate(-W * f, -(cy - 4));
        ctx.fillStyle = g;
        ctx.fillRect(W * f - W * 0.16, cy - 4 - W * 0.16, W * 0.32, W * 0.32);
        ctx.restore();
      }
      // chrome edge
      this.chrome(ctx, 0, cy + 14, W, 12);
      // cherry vinyl front with tucks
      const fy = cy + 26;
      const vin = ctx.createLinearGradient(0, fy, 0, H);
      vin.addColorStop(0, '#c62a44');
      vin.addColorStop(0.5, '#a51d35');
      vin.addColorStop(1, '#6e1023');
      ctx.fillStyle = vin;
      ctx.fillRect(0, fy, W, H - fy);
      const tuck = Math.max(46, W / 22);
      for (let x = tuck / 2; x < W; x += tuck) {
        const tg = ctx.createLinearGradient(x - tuck / 2, 0, x + tuck / 2, 0);
        tg.addColorStop(0, 'rgba(0,0,0,0.22)');
        tg.addColorStop(0.45, 'rgba(255,255,255,0.08)');
        tg.addColorStop(1, 'rgba(0,0,0,0.22)');
        ctx.fillStyle = tg;
        ctx.fillRect(x - tuck / 2, fy, tuck, H - fy);
      }
      this.chrome(ctx, 0, fy + (H - fy) * 0.55, W, 6);

      // soda taps at either end of the counter
      if (W > 640) {
        this.tap(ctx, Math.max(46, W * 0.055), cy, Math.min(1.2, H / 700));
        this.tap(ctx, W - Math.max(46, W * 0.055), cy, Math.min(1.2, H / 700), true);
      }
      // a wall sign
      if (W > H * 1.15 && H > 760) this.neonSign(ctx, 14 + Math.min(W * 0.17, 230) / 2, Math.max(70, H * 0.3) - Math.min(130, H * 0.2), Math.min(0.9, W / 1100));

      // vignette
      const v = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.45, Math.max(W, H) * 0.8);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    },

    chrome(ctx, x, y, w, h) {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#f7fbfc');
      g.addColorStop(0.45, '#9aa6ab');
      g.addColorStop(0.55, '#6f7b80');
      g.addColorStop(1, '#dfe7ea');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    },

    shelf(ctx, x, y, w, rnd) {
      // bottles first, then the plank in front of their feet
      let bx = x + 10;
      const cols = ['#2f7f5f', '#7b2f3f', '#b07a2a', '#2c5f8f', '#5f3f7f', '#3f8f8f'];
      while (bx < x + w - 16) {
        const bw = 14 + rnd() * 14;
        const bh = 40 + rnd() * 46;
        const c = cols[Math.floor(rnd() * cols.length)];
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = c;
        ctx.beginPath();
        const neck = bw * 0.34;
        ctx.moveTo(bx, y);
        ctx.lineTo(bx, y - bh * 0.62);
        ctx.quadraticCurveTo(bx, y - bh * 0.75, bx + bw / 2 - neck / 2, y - bh * 0.8);
        ctx.lineTo(bx + bw / 2 - neck / 2, y - bh);
        ctx.lineTo(bx + bw / 2 + neck / 2, y - bh);
        ctx.lineTo(bx + bw / 2 + neck / 2, y - bh * 0.8);
        ctx.quadraticCurveTo(bx + bw, y - bh * 0.75, bx + bw, y - bh * 0.62);
        ctx.lineTo(bx + bw, y);
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#fff';
        ctx.fillRect(bx + bw * 0.2, y - bh * 0.58, bw * 0.12, bh * 0.5);
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#e9dcc0';
        ctx.fillRect(bx + 2, y - bh * 0.42, bw - 4, bh * 0.18);
        ctx.globalAlpha = 1;
        bx += bw + 6 + rnd() * 8;
      }
      const g = ctx.createLinearGradient(0, y, 0, y + 12);
      g.addColorStop(0, '#8a5a36');
      g.addColorStop(1, '#4e2f1b');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 4, y + 12, w - 8, 6);
    },

    lamp(ctx, x, y) {
      ctx.strokeStyle = 'rgba(20,20,20,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, y - 10);
      ctx.stroke();
      const g = ctx.createLinearGradient(x - 30, 0, x + 30, 0);
      g.addColorStop(0, '#0f6b63');
      g.addColorStop(0.4, '#3fc9a6');
      g.addColorStop(1, '#0a4a45');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 12);
      ctx.lineTo(x + 8, y - 12);
      ctx.quadraticCurveTo(x + 30, y - 4, x + 32, y + 10);
      ctx.lineTo(x - 32, y + 10);
      ctx.quadraticCurveTo(x - 30, y - 4, x - 8, y - 12);
      ctx.fill();
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath();
      ctx.ellipse(x, y + 10, 26, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    },

    tap(ctx, x, base, s, flip) {
      ctx.save();
      ctx.translate(x, base);
      ctx.scale(flip ? -s : s, s);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createLinearGradient(-14, 0, 14, 0);
      g.addColorStop(0, '#8d999e');
      g.addColorStop(0.35, '#ffffff');
      g.addColorStop(0.6, '#a9b4b8');
      g.addColorStop(1, '#5f6b70');
      ctx.fillStyle = g;
      ctx.fillRect(-12, -120, 24, 120);
      ctx.beginPath();
      ctx.ellipse(0, -120, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // spout
      ctx.strokeStyle = g;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -112);
      ctx.quadraticCurveTo(34, -122, 36, -86);
      ctx.stroke();
      // handle
      ctx.fillStyle = '#e8344e';
      ctx.beginPath();
      ctx.ellipse(0, -150, 7, 22, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(-4, -166, 3, 22);
      ctx.restore();
    },

    neonSign(ctx, x, y, s) {
      // a small neon soda glass with bubbles, unlit tube first then the glow
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(-26, -30);
        ctx.lineTo(-18, 32);
        ctx.lineTo(18, 32);
        ctx.lineTo(26, -30);
        ctx.moveTo(10, -30);
        ctx.lineTo(24, -62);
        ctx.lineTo(36, -66);
        ctx.moveTo(-19, -8);
        ctx.lineTo(19, -8);
      };
      for (const [w, a] of [[16, 0.08], [9, 0.16], [4, 0.9]]) {
        path();
        ctx.strokeStyle = `rgba(255,95,168,${a})`;
        ctx.lineWidth = w;
        ctx.stroke();
      }
      path();
      ctx.strokeStyle = '#ffe3f1';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      for (const [bx, by, r] of [[-6, 10, 4], [6, 20, 3], [2, 0, 2.5]]) {
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(63,240,200,0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    },

    // Per-frame touches over the backdrop: drifting fizz in the air.
    ambient(ctx, time, still) {
      const { W, H } = this;
      ctx.fillStyle = 'rgba(200,255,240,0.07)';
      for (const b of this.air) {
        const y = (((b.y * H - (still ? 0 : time * 18 * b.s)) % H) + H) % H;
        const x = b.x * W + Math.sin(time * b.s + b.p) * 12;
        ctx.beginPath();
        ctx.arc(x, y * (this.surfaceTop / H), b.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    // ---------- a glass ----------
    // g: { u, px, py, lx, ly, angle, bands[{c,amt,hidden,reveal}], wob, sel,
    //      glow, straw, symbols, bubbles[], time }
    geom(u) {
      const k = u * 0.075;
      const iw = u - 2 * k;
      const uh = u * 0.9;
      const ih = uh * 4 + u * 0.45;
      const base = u * 0.3;
      return { k, iw, uh, ih, base, gh: ih + base, rimRy: u * 0.13, botR: u * 0.2 };
    },

    drawGlass(ctx, g) {
      const d = this.dpr;
      const G = this.geom(g.u);
      const { k, iw, uh, ih, base, gh, rimRy, botR } = G;
      const u = g.u;
      const cos = Math.cos(g.angle);
      const sin = Math.sin(g.angle);
      const local = () => {
        Scene.base(ctx);
        ctx.translate(g.px, g.py);
        if (g.angle) ctx.rotate(g.angle);
        ctx.translate(-g.lx, -g.ly);
      };
      const world = () => Scene.base(ctx);
      const toW = (x, y) => {
        const X = x - g.lx;
        const Y = y - g.ly;
        return { x: g.px + X * cos - Y * sin, y: g.py + X * sin + Y * cos };
      };
      const upright = Math.abs(g.angle) < 0.05;

      ctx.save();
      // back of the glass
      local();
      ctx.beginPath();
      roundBottom(ctx, k, 0, iw, ih, botR);
      ctx.closePath();
      ctx.fillStyle = 'rgba(190,240,255,0.07)';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(u / 2, 0, u / 2, rimRy, 0, Math.PI, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = Math.max(1, u * 0.03);
      ctx.stroke();

      // liquid, with horizontal surfaces whatever the tilt
      const pts = [toW(k, 0), toW(k + iw, 0), toW(k + iw, ih), toW(k, ih)];
      let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
      for (const p of pts) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); }
      const unitArea = uh * iw;
      const total = g.bands.reduce((s, b) => s + b.amt, 0);
      let ys = null;
      if (total > 0.001) {
        ctx.save();
        local();
        ctx.beginPath();
        roundBottom(ctx, k, 0, iw, ih, botR);
        ctx.closePath();
        ctx.clip();
        world();
        ys = [];
        let acc = 0;
        ys.push(levelY(pts, 0, minY, maxY));
        for (const b of g.bands) { acc += b.amt; ys.push(levelY(pts, acc * unitArea, minY, maxY)); }
        const x0 = minX - 4;
        const x1 = maxX + 4;
        const cx = (minX + maxX) / 2;
        const topY = ys[ys.length - 1];
        const slope = upright ? g.wob : 0;
        g.bands.forEach((b, i) => {
          const yb = ys[i] + 0.5;
          const yt = ys[i + 1];
          const f = FLAVOURS[b.c];
          ctx.beginPath();
          if (i === g.bands.length - 1 && slope) {
            ctx.moveTo(x0, yt + slope * (cx - x0));
            ctx.lineTo(x1, yt - slope * (x1 - cx));
          } else {
            ctx.moveTo(x0, yt);
            ctx.lineTo(x1, yt);
          }
          ctx.lineTo(x1, yb + (i === 0 ? 40 : 0));
          ctx.lineTo(x0, yb + (i === 0 ? 40 : 0));
          ctx.closePath();
          ctx.fillStyle = f.hex;
          ctx.fill();
          if (b.hidden || b.reveal < 1) {
            ctx.globalAlpha = b.hidden ? 1 : 1 - b.reveal;
            ctx.fillStyle = MURK;
            ctx.fill();
            ctx.globalAlpha *= 0.5;
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            const my = (yb + yt) / 2;
            ctx.moveTo(x0, my + Math.sin(g.time * 1.5 + i) * 3);
            ctx.bezierCurveTo(cx - iw * 0.2, my - 6, cx + iw * 0.1, my + 7, x1, my + Math.cos(g.time * 1.3 + i) * 3);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          if (i > 0) {
            ctx.fillStyle = 'rgba(40,10,30,0.18)';
            ctx.fillRect(x0, ys[i] - 1, x1 - x0, 2);
          }
        });
        // cylinder shading across the liquid, in the glass's own frame
        ctx.beginPath();
        ctx.rect(x0, topY - 2, x1 - x0, maxY - topY + 50);
        local();
        const sh = ctx.createLinearGradient(k, 0, k + iw, 0);
        sh.addColorStop(0, 'rgba(0,0,0,0.32)');
        sh.addColorStop(0.22, 'rgba(255,255,255,0.14)');
        sh.addColorStop(0.42, 'rgba(255,255,255,0)');
        sh.addColorStop(0.8, 'rgba(0,0,0,0.08)');
        sh.addColorStop(1, 'rgba(0,0,0,0.36)');
        ctx.fillStyle = sh;
        ctx.fill();
        // rising fizz
        if (upright && g.bubbles) {
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          for (const b of g.bubbles) {
            const by = ih - b.h * uh;
            if (b.h > total - 0.08) continue;
            ctx.beginPath();
            ctx.arc(k + b.x * iw, by, b.r * u, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // the surface, seen from slightly above
        world();
        if (upright) {
          const top = g.bands[g.bands.length - 1];
          const f = FLAVOURS[top.c];
          ctx.save();
          ctx.translate(cx, topY);
          ctx.rotate(Math.atan(-slope));
          ctx.beginPath();
          ctx.ellipse(0, 0, iw / 2 + 1, u * 0.1, 0, 0, Math.PI * 2);
          ctx.fillStyle = top.hidden ? '#6a5a80' : f.light;
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.45)';
          ctx.lineWidth = Math.max(1, u * 0.025);
          ctx.beginPath();
          ctx.ellipse(0, 0, iw / 2 - 1, u * 0.1 - 1, 0, Math.PI * 1.05, Math.PI * 1.95);
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      }

      // symbols for colour-blind players ("?" on a mystery layer is always shown)
      if (upright && ys) {
        world();
        const cx = (minX + maxX) / 2;
        g.bands.forEach((b, i) => {
          if (b.amt < 0.55) return;
          const y = (ys[i] + ys[i + 1]) / 2;
          if (b.hidden || b.reveal < 0.5) {
            ctx.font = `700 ${Math.round(u * 0.42)}px Fredoka, 'Trebuchet MS', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(230,215,255,0.7)';
            ctx.fillText('?', cx, y + 1);
          } else if (g.symbols) drawSymbol(ctx, b.c, cx, y, u * 0.34, b.reveal < 1 ? (b.reveal - 0.5) * 2 : 1);
        });
      }

      // straw for a finished glass
      local();
      if (g.straw > 0) {
        const drop = (1 - g.straw) * u * 3.2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(-u, -u * 6, u * 3, ih - u * 0.1 + u * 6);
        ctx.clip();
        ctx.lineCap = 'round';
        ctx.lineWidth = u * 0.11;
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(u * 0.42, ih * 0.55 - drop);
        ctx.lineTo(u * 0.88, -u * 0.9 - drop);
        ctx.lineTo(u * 1.18, -u * 1.08 - drop);
        ctx.stroke();
        ctx.setLineDash([u * 0.14, u * 0.14]);
        ctx.strokeStyle = '#e8344e';
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // the glass itself: thick base, walls, highlights, rim
      ctx.beginPath();
      roundBottom(ctx, 0, ih, u, base, botR * 1.4);
      ctx.closePath();
      const bg = ctx.createLinearGradient(0, ih, 0, gh);
      bg.addColorStop(0, 'rgba(255,255,255,0.32)');
      bg.addColorStop(1, 'rgba(200,235,245,0.14)');
      ctx.fillStyle = bg;
      ctx.fill();
      if (g.bands.length && !g.bands[0].hidden) {
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = FLAVOURS[g.bands[0].c].hex;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, gh - botR * 1.4);
      ctx.quadraticCurveTo(0, gh, botR * 1.4, gh);
      ctx.lineTo(u - botR * 1.4, gh);
      ctx.quadraticCurveTo(u, gh, u, gh - botR * 1.4);
      ctx.lineTo(u, 0);
      ctx.strokeStyle = g.glow > 0 ? `rgba(255,214,110,${0.6 + 0.4 * g.glow})` : 'rgba(255,255,255,0.62)';
      ctx.lineWidth = Math.max(1.6, u * 0.05);
      ctx.lineJoin = 'round';
      ctx.stroke();
      const hl = ctx.createLinearGradient(0, u * 0.2, 0, ih);
      hl.addColorStop(0, 'rgba(255,255,255,0)');
      hl.addColorStop(0.25, 'rgba(255,255,255,0.5)');
      hl.addColorStop(1, 'rgba(255,255,255,0.08)');
      ctx.fillStyle = hl;
      ctx.fillRect(u * 0.15, u * 0.22, u * 0.09, ih - u * 0.3);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(u * 0.79, u * 0.4, u * 0.035, ih * 0.6);
      // rim
      ctx.beginPath();
      ctx.ellipse(u / 2, 0, u / 2, rimRy, 0, 0, Math.PI);
      ctx.lineWidth = Math.max(1.6, u * 0.055);
      ctx.strokeStyle = g.sel > 0.02 ? `rgba(160,255,230,${0.7 + g.sel * 0.3})` : 'rgba(255,255,255,0.8)';
      ctx.stroke();
      if (g.glow > 0) {
        ctx.beginPath();
        ctx.ellipse(u / 2, 0, u / 2 + 3, rimRy + 2, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,201,74,${0.35 * g.glow})`;
        ctx.lineWidth = u * 0.12;
        ctx.stroke();
      }
      ctx.restore();
      return { minX, maxX, minY, maxY, ys };
    },
  };

  Scene.drawSymbol = drawSymbol;
  (window.PP = window.PP || {}).Scene = Scene;
})();
