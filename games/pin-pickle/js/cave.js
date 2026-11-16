// Draws a level's cave. The rock never changes, so it is painted once per
// level (textured strata, lit edges, a drop shadow onto the back wall). Gold,
// water, lava and rubble are painted every frame into a small image at four
// pixels per cell, with depth shading, surface highlights, ripples and
// glitter. A low-resolution light map lets the lava light up the rock around
// it, and the explorer's lamp and two torches keep the rest of the cave dim.
(function () {
  const PP = window.PP;
  const S = window.PinSim;
  const CS = 8; // rock canvas: pixels per cell
  const SUB = 4; // moving stuff: pixels per cell

  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) / 4294967296; };
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const s = (t) => t * t * (3 - 2 * t);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
  }
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  function setup(sim) {
    const w = sim.w, h = sim.h, cells = sim.cells;
    const isWall = (x, y) => x < 0 || y < 0 || x >= w || y >= h || cells[y * w + x] === S.WALL;
    // ---------- rock + back wall ----------
    const rock = canvas(w * CS, h * CS), g = rock.getContext('2d');
    const img = g.createImageData(w * CS, h * CS), d = img.data;
    const seed = (sim.gold * 7 + w * 13 + h) % 97;
    for (let py = 0; py < h * CS; py++) {
      for (let px = 0; px < w * CS; px++) {
        const cx = (px / CS) | 0, cy = (py / CS) | 0, i = (py * w * CS + px) * 4;
        const fx = px / CS, fy = py / CS;
        if (isWall(cx, cy)) {
          // strata: wavy bands of warm rock with grain
          const band = Math.sin(fy * 0.55 + vnoise(fx * 0.15 + seed, fy * 0.15) * 4) * 0.5 + 0.5;
          const n = vnoise(fx * 0.4 + seed, fy * 0.4) * 0.6 + vnoise(fx * 1.7, fy * 1.7) * 0.3 + hash(px, py) * 0.18;
          let r = 70 + band * 34 + n * 40, gg = 46 + band * 22 + n * 30, b = 44 + band * 14 + n * 26;
          // lit rims where the rock meets open cave
          const lx = fx - cx, ly = fy - cy;
          if (!isWall(cx, cy - 1) && ly < 0.28) { const k = 1 - ly / 0.28; r += 70 * k; gg += 52 * k; b += 30 * k; }
          if (!isWall(cx, cy + 1) && ly > 0.6) { const k = (ly - 0.6) / 0.4; r *= 1 - 0.55 * k; gg *= 1 - 0.55 * k; b *= 1 - 0.5 * k; }
          if (!isWall(cx - 1, cy) && lx < 0.22) { const k = 1 - lx / 0.22; r += 26 * k; gg += 18 * k; b += 10 * k; }
          if (!isWall(cx + 1, cy) && lx > 0.72) { const k = (lx - 0.72) / 0.28; r *= 1 - 0.4 * k; gg *= 1 - 0.4 * k; b *= 1 - 0.35 * k; }
          d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
        } else {
          // the recessed back wall, darker and cooler
          const n = vnoise(fx * 0.3 + 40, fy * 0.3) * 0.6 + vnoise(fx * 1.3 + 9, fy * 1.3) * 0.25 + hash(px, py) * 0.08;
          const v = 0.55 + 0.45 * (fy / h);
          d[i] = (28 + n * 22) * v; d[i + 1] = (20 + n * 16) * v; d[i + 2] = (30 + n * 20) * v; d[i + 3] = 255;
        }
      }
    }
    g.putImageData(img, 0, 0);
    // rock casts a soft shadow onto the back wall: draw the wall mask offset, under the rock again
    const mask = canvas(w * CS, h * CS), mg = mask.getContext('2d');
    mg.fillStyle = '#000';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isWall(x, y)) mg.fillRect(x * CS, y * CS, CS, CS);
    const shade = canvas(w * CS, h * CS), sg = shade.getContext('2d');
    sg.globalAlpha = 0.22;
    for (const [ox, oy] of [[3, 4], [6, 8], [9, 12], [12, 16]]) sg.drawImage(mask, ox, oy);
    sg.globalCompositeOperation = 'destination-out'; sg.globalAlpha = 1; sg.drawImage(mask, 0, 0);
    g.drawImage(shade, 0, 0);
    // crystals and cracks in the rock
    const rnd = (k) => hash(k * 31 + seed, k * 17 + 3);
    for (let k = 0; k < (w * h) / 60; k++) {
      const x = Math.floor(rnd(k) * w), y = Math.floor(rnd(k + 999) * h);
      if (!isWall(x, y) || !isWall(x + 1, y) || !isWall(x, y + 1)) continue;
      const px = x * CS + 4, py = y * CS + 4;
      if (rnd(k + 77) < 0.35) {
        const col = rnd(k + 5) < 0.5 ? ['#57e0d0', '#2a8f88'] : ['#c58bff', '#7a4aa8'];
        g.fillStyle = col[1]; g.beginPath(); g.moveTo(px, py - 6); g.lineTo(px + 4, py); g.lineTo(px, py + 5); g.lineTo(px - 4, py); g.fill();
        g.fillStyle = col[0]; g.beginPath(); g.moveTo(px, py - 6); g.lineTo(px + 2, py - 1); g.lineTo(px - 2, py - 1); g.fill();
      } else {
        g.strokeStyle = 'rgba(20,10,8,0.45)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(px, py);
        let cx = px, cy = py;
        for (let s = 0; s < 4; s++) { cx += (rnd(k + s) - 0.5) * 14; cy += rnd(k + s + 50) * 9; g.lineTo(cx, cy); }
        g.stroke();
      }
    }

    // ---------- pins ----------
    const pins = sim.pins.map((id) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let i = 0; i < cells.length; i++) if (sim.pinId[i] === id) {
        const x = i % w, y = (i / w) | 0;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
      }
      const horiz = x1 - x0 >= y1 - y0;
      // the handle sticks out on the side with more rock to rest on
      let side = 1;
      if (horiz) { const r = isWall(x1, y0 + 1) ? 1 : 0, l = isWall(x0 - 1, y0 + 1) ? 1 : 0; side = r >= l ? 1 : -1; }
      return { id, x0, y0, x1, y1, horiz, side, state: 'in', t: 0, off: 0, vy: 0, rot: 0, fall: 0 };
    });

    // ---------- the cart ----------
    let hx0 = 1e9, hx1 = -1, hy0 = 1e9, hy1 = -1;
    for (let i = 0; i < cells.length; i++) if (cells[i] === S.HERO) {
      const x = i % w, y = (i / w) | 0;
      hx0 = Math.min(hx0, x); hx1 = Math.max(hx1, x + 1); hy0 = Math.min(hy0, y); hy1 = Math.max(hy1, y + 1);
    }
    // nugget positions for the heap in the cart
    const nuggets = [];
    for (let k = 0; k < 60; k++) nuggets.push({ u: hash(k, 7), v: hash(k, 11), r: 0.5 + hash(k, 13) * 0.5, s: hash(k, 17) });

    // ---------- torches on rock faces near the top ----------
    const torches = [];
    for (let y = 2; y < h * 0.45 && torches.length < 2; y += 3) {
      for (const x of torches.length ? [w - 3] : [2]) {
        if (isWall(x, y) && !isWall(x + (x < w / 2 ? 1 : -1), y)) { torches.push({ x: x + 0.5, y: y + 0.5 }); break; }
      }
    }
    if (torches.length < 2) { torches.length = 0; torches.push({ x: 1.5, y: 2 }, { x: w - 1.5, y: 2 }); }

    const dyn = canvas(w * SUB, h * SUB);
    const lw = Math.ceil(w / 3), lh = Math.ceil(h / 3);
    const dark = canvas(lw, lh), glow = canvas(lw, lh);
    return {
      w, h, rock, dyn, dctx: dyn.getContext('2d'), dimg: dyn.getContext('2d').createImageData(w * SUB, h * SUB),
      dark, glow, lw, lh, light: new Float32Array(lw * lh), lavaL: new Float32Array(lw * lh), lightT: 0,
      heat: new Float32Array(w * h), prev: new Uint8Array(cells), pins, cart: { x0: hx0, x1: hx1, y0: hy0, y1: hy1 }, nuggets, torches,
      danger: 0, lavaCount: 0, focus: (hx0 + hx1) / 2,
    };
  }

  // Compare this step's cells with the last: steam where water met lava,
  // smoke where gold melted. Returns what happened for sound and particles.
  function diff(cv, sim) {
    const c = sim.cells, p = cv.prev, w = cv.w, out = { steam: [], melt: [] };
    let lava = 0, minD = 1e9, gx = 0, gy = 0, gn = 0;
    const cx = (cv.cart.x0 + cv.cart.x1) / 2, cy = cv.cart.y0;
    for (let i = 0; i < c.length; i++) {
      const t = c[i], was = p[i];
      if (t === S.LAVA) {
        lava++;
        const x = i % w, y = (i / w) | 0, dd = Math.abs(x - cx) * 0.7 + Math.max(0, cy - y);
        if (dd < minD) minD = dd;
      }
      if (t === S.GOLD) { gn++; gx += i % w; gy += (i / w) | 0; }
      if (t !== was) {
        if (was === S.LAVA && t === S.STONE) { cv.heat[i] = 1; out.steam.push(i); }
        else if (was === S.GOLD && t === S.EMPTY) {
          if (c[i - 1] === S.LAVA || c[i + 1] === S.LAVA || c[i - w] === S.LAVA || c[i + w] === S.LAVA) out.melt.push(i);
        }
      }
      p[i] = t;
    }
    cv.lavaCount = lava;
    cv.danger = lava ? Math.max(0, Math.min(1, 1 - (minD - 4) / 22)) : 0;
    cv.goldFocus = gn ? { x: gx / gn, y: gy / gn } : null;
    return out;
  }

  function paintDynamic(cv, sim, t) {
    const { w, h } = cv, cells = sim.cells, d = cv.dimg.data, W4 = w * SUB, heat = cv.heat;
    d.fill(0);
    const depth = new Uint8Array(w); // run length of liquid above, per column
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x, ty = cells[i];
        const above = y > 0 ? cells[i - w] : S.WALL;
        if (ty === S.WATER || ty === S.LAVA) depth[x] = above === ty ? Math.min(depth[x] + 1, 40) : 0; else depth[x] = 0;
        if (heat[i] > 0) heat[i] = Math.max(0, heat[i] - 0.004);
        if (ty < S.GOLD || ty > S.STONE) continue;
        const surf = above !== ty && above !== S.WALL && above !== S.PIN;
        for (let sy = 0; sy < SUB; sy++) {
          for (let sx = 0; sx < SUB; sx++) {
            const X = x * SUB + sx, Y = y * SUB + sy, o = (Y * W4 + X) * 4;
            let r, g, b, a = 255;
            if (ty === S.GOLD) {
              const sh = 1.15 - (sx + sy) * 0.06 + hash(X, Y) * 0.12;
              r = 240 * sh; g = 178 * sh; b = 40 * sh;
              if (hash(i, Math.floor(t * 5 + x * 0.3)) > 0.985 && sx === 1 && sy === 1) { r = 255; g = 255; b = 225; }
            } else if (ty === S.WATER) {
              const dp = depth[x] + sy / SUB;
              r = 48 - dp * 1.4; g = 140 - dp * 3.2; b = 228 - dp * 3; a = 205 + Math.min(40, dp * 3);
              if (surf && sy === 0) { const rip = 0.85 + 0.15 * Math.sin(X * 0.5 + t * 5); r = 200 * rip; g = 236 * rip; b = 255; a = 255; }
              else if (surf && sy === 1) { r += 50; g += 50; b += 20; }
              if (hash(X + Math.floor(t * 3), Y) > 0.992) { r = 200; g = 230; b = 255; }
            } else if (ty === S.LAVA) {
              const n = Math.sin(X * 0.21 + t * 2.1) * Math.sin(Y * 0.27 - t * 1.6) + Math.sin((X + Y) * 0.09 + t) * 0.5;
              const dp = depth[x] + sy / SUB;
              r = 255; g = 120 + n * 50 - dp * 4; b = 30 + n * 15;
              if (n < -0.75) { r = 150; g = 40; b = 24; }
              if (surf && sy < 2) { r = 255; g = 215 + n * 20; b = 110; }
              if (g < 30) g = 30;
            } else {
              const n = hash(X, Y) * 30 + ((sx + sy) % 3 === 0 ? -12 : 0), hh = heat[i];
              r = 104 + n + hh * 150; g = 98 + n + hh * 20 - hh * 60; b = 110 + n - hh * 80;
            }
            d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a;
          }
        }
      }
    }
    cv.dctx.putImageData(cv.dimg, 0, 0);
  }

  function updateLight(cv, sim, lamp) {
    const { lw, lh, w, light, lavaL } = cv, cells = sim.cells;
    const em = new Float32Array(lw * lh);
    for (let i = 0; i < cells.length; i++) if (cells[i] === S.LAVA) { const x = i % w, y = (i / w) | 0; em[((y / 3) | 0) * lw + ((x / 3) | 0)] += 1 / 9; }
    const src = [];
    for (let b = 0; b < em.length; b++) if (em[b] > 0) src.push([b % lw, (b / lw) | 0, em[b]]);
    for (let by = 0; by < lh; by++) for (let bx = 0; bx < lw; bx++) {
      let L = 0;
      for (const [sx, sy, e] of src) { const dd = (sx - bx) * (sx - bx) + (sy - by) * (sy - by); if (dd < 40) L += e * Math.exp(-dd / 7); }
      let amb = 0.3;
      for (const tc of cv.torches) { const dd = (tc.x / 3 - bx) ** 2 + (tc.y / 3 - by) ** 2; amb += 0.5 * Math.exp(-dd / 10); }
      if (lamp) { const dd = (lamp.x / 3 - bx) ** 2 + (lamp.y / 3 - by) ** 2; amb += 0.6 * Math.exp(-dd / 14); }
      lavaL[by * lw + bx] = Math.min(1, L);
      light[by * lw + bx] = Math.min(1, amb + L * 0.9);
    }
    const dg = cv.dark.getContext('2d'), di = dg.createImageData(lw, lh);
    const gg = cv.glow.getContext('2d'), gi = gg.createImageData(lw, lh);
    for (let k = 0; k < lw * lh; k++) {
      di.data[k * 4] = 12; di.data[k * 4 + 1] = 6; di.data[k * 4 + 2] = 22; di.data[k * 4 + 3] = Math.max(0, 1 - light[k]) * 215;
      gi.data[k * 4] = 255; gi.data[k * 4 + 1] = 100; gi.data[k * 4 + 2] = 30; gi.data[k * 4 + 3] = lavaL[k] * 120;
    }
    dg.putImageData(di, 0, 0);
    gg.putImageData(gi, 0, 0);
  }

  // view: { x, y, px } screen position of cell (0,0) and pixels per cell
  function draw(ctx, cv, sim, v, t, o) {
    o = o || {};
    const W = cv.w * v.px, H = cv.h * v.px;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(cv.rock, v.x, v.y, W, H);
    paintDynamic(cv, sim, t);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv.dyn, v.x, v.y, W, H);
    ctx.imageSmoothingEnabled = true;
    if (o.under) o.under();
    if ((cv.lightT -= 1) <= 0) { cv.lightT = 3; updateLight(cv, sim, o.lamp); }
    ctx.drawImage(cv.dark, v.x - v.px * 1.5, v.y - v.px * 1.5, W + v.px * 3 * (cv.lw * 3 / cv.w), H + v.px * 3 * (cv.lh * 3 / cv.h));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(cv.glow, v.x - v.px * 1.5, v.y - v.px * 1.5, W + v.px * 3 * (cv.lw * 3 / cv.w), H + v.px * 3 * (cv.lh * 3 / cv.h));
    // torches: a flame and a warm halo
    for (const tc of cv.torches) {
      const x = v.x + tc.x * v.px, y = v.y + tc.y * v.px, f = 1 + Math.sin(t * 13 + tc.x) * 0.08 + Math.sin(t * 7.3) * 0.06;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, v.px * 9 * f);
      gr.addColorStop(0, 'rgba(255,170,70,0.35)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - v.px * 10, y - v.px * 10, v.px * 20, v.px * 20);
    }
    ctx.restore();
    for (const tc of cv.torches) torch(ctx, v.x + tc.x * v.px, v.y + tc.y * v.px, v.px, t);
  }

  function torch(ctx, x, y, px, t) {
    ctx.fillStyle = '#4a2c18'; ctx.fillRect(x - px * 0.35, y - px * 0.2, px * 0.7, px * 2.4);
    ctx.fillStyle = '#7a7068'; ctx.fillRect(x - px * 0.6, y - px * 0.3, px * 1.2, px * 0.5);
    const f = Math.sin(t * 17 + x) * 0.15;
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath(); ctx.moveTo(x - px * 0.7, y - px * 0.3); ctx.quadraticCurveTo(x + f * px * 4, y - px * (3 + f * 2), x + px * 0.7, y - px * 0.3); ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath(); ctx.moveTo(x - px * 0.35, y - px * 0.3); ctx.quadraticCurveTo(x + f * px * 2, y - px * 1.8, x + px * 0.35, y - px * 0.3); ctx.fill();
  }

  PP.Cave = { setup, diff, draw, CS, SUB, hash, vnoise };
})();
