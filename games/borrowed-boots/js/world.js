// The storybook world: three painted chapters, each with its own sky and
// paper-cut parallax layers, and the level terrain drawn as extruded paper
// (a front face plus a lit top face and side, so the ground has depth).
// Static things are painted once into offscreen canvases; only grass, water,
// creatures and effects are drawn every frame.
(function () {
  const C = BB.CFG;
  const T = C.T;
  const U = BB.U;
  const INK = BB.COL.ink;
  const TAU = Math.PI * 2;
  const DX = 6; // extrusion offset: "into the page" is up and to the right
  const DY = C.DEPTH;
  const LOOP = 1920; // parallax strips repeat every LOOP px

  const THEMES = [
    {
      id: 'meadow',
      sky: ['#86c9f0', '#cbe9f7', '#fdf1cf'],
      sun: { x: 760, y: 110, r: 46, color: '#fff3b0', glow: 'rgba(255,240,170,0.5)' },
      layers: [
        { f: 0.08, base: 300, amp: 40, color: '#b9d8d2', trees: 0, snow: false, waves: [2, 5, 9] },
        { f: 0.22, base: 360, amp: 34, color: '#a3cf86', trees: 14, tree: 'round', treeColor: '#7fb563', waves: [3, 7] },
        { f: 0.45, base: 430, amp: 26, color: '#86bd62', trees: 9, tree: 'bush', treeColor: '#6aa84f', flowers: true, waves: [4, 11] },
      ],
      earth: '#b27448', earthDark: '#8c5534', grass: '#7cc35a', grassTop: '#b5e27d', grassDark: '#4f8f3a',
      stone: '#cdbca3', stoneTop: '#e6d9c2', water: ['#5fb6e0', '#3d8fc2'],
      ambient: 'petals', music: 'meadow',
    },
    {
      id: 'woods',
      sky: ['#f2b77a', '#f8d7a3', '#fcefd2'],
      sun: { x: 230, y: 150, r: 60, color: '#ffe2a6', glow: 'rgba(255,200,120,0.45)' },
      layers: [
        { f: 0.08, base: 270, amp: 24, color: '#d3b9c9', trees: 26, tree: 'pine', treeColor: '#c3a6bd', waves: [3, 8] },
        { f: 0.22, base: 340, amp: 20, color: '#9bb58b', trees: 20, tree: 'pine', treeColor: '#7f9f74', waves: [4, 9] },
        { f: 0.45, base: 420, amp: 18, color: '#6f9563', trees: 7, tree: 'trunk', treeColor: '#5a4636', flowers: false, ferns: true, waves: [5, 12] },
      ],
      earth: '#8a5a3a', earthDark: '#6a422a', grass: '#5d9e4c', grassTop: '#93c56b', grassDark: '#3d7034',
      stone: '#bfae98', stoneTop: '#d8cab4', water: ['#6fa9b8', '#4b7f90'],
      ambient: 'leaves', music: 'woods',
    },
    {
      id: 'peaks',
      sky: ['#4f5fa6', '#9a86b8', '#f3b18e'],
      sun: { x: 690, y: 300, r: 70, color: '#ffd1a1', glow: 'rgba(255,170,130,0.45)' },
      stars: true,
      layers: [
        { f: 0.06, base: 250, amp: 90, color: '#8b8fc0', trees: 0, snow: true, peaks: true, waves: [2, 3, 7] },
        { f: 0.2, base: 330, amp: 60, color: '#6e78a9', trees: 0, snow: true, peaks: true, waves: [3, 5, 11] },
        { f: 0.42, base: 420, amp: 22, color: '#56628f', trees: 16, tree: 'pine', treeColor: '#3f4a74', waves: [4, 10] },
      ],
      earth: '#8f8191', earthDark: '#6c6070', grass: '#88b27c', grassTop: '#eef3f7', grassDark: '#5e8a58',
      stone: '#c4bccb', stoneTop: '#e2dce6', water: ['#8fb9d8', '#6890b8'],
      ambient: 'snow', music: 'peaks',
    },
  ];
  BB.THEMES = THEMES;

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // A periodic hill line (exactly repeats every LOOP px).
  function ridge(L, x, seed) {
    let y = 0;
    L.waves.forEach((k, i) => {
      y += Math.sin((x / LOOP) * TAU * k + seed * (i + 1) * 1.7) / (i + 1);
    });
    if (L.peaks) y = -Math.abs(y) * 1.3 + 0.4;
    return L.base - y * L.amp;
  }

  function paperGrain(g, w, h, seed, alpha = 0.06) {
    const r = U.rng(seed);
    for (let i = 0; i < (w * h) / 900; i++) {
      g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(60,40,20,${alpha * 0.7})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
  }

  function drawTree(g, kind, x, y, s, color, r) {
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(59,42,30,0.55)';
    if (kind === 'round') {
      g.fillStyle = '#8a6a4a';
      g.fillRect(x - s * 0.06, y - s * 0.5, s * 0.12, s * 0.5);
      g.beginPath();
      g.arc(x, y - s * 0.7, s * 0.34, 0, TAU);
      g.arc(x - s * 0.22, y - s * 0.55, s * 0.24, 0, TAU);
      g.arc(x + s * 0.22, y - s * 0.55, s * 0.24, 0, TAU);
      g.fillStyle = color;
      g.fill();
      g.stroke();
    } else if (kind === 'bush') {
      g.beginPath();
      for (let k = -2; k <= 2; k++) g.arc(x + k * s * 0.18, y - s * 0.18 - (2 - Math.abs(k)) * s * 0.06, s * 0.2, 0, TAU);
      g.fillStyle = color;
      g.fill();
      g.stroke();
      if (r() < 0.7) {
        g.fillStyle = r() < 0.5 ? '#f7a8b8' : '#fff2a8';
        for (let k = 0; k < 4; k++) {
          g.beginPath();
          g.arc(x + (r() - 0.5) * s * 0.7, y - s * (0.15 + r() * 0.25), s * 0.04, 0, TAU);
          g.fill();
        }
      }
    } else if (kind === 'pine') {
      g.fillStyle = color;
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        const yy = y - s * (0.25 + k * 0.28);
        const w = s * (0.38 - k * 0.09);
        g.moveTo(x - w, yy + s * 0.1);
        g.lineTo(x, yy - s * 0.32);
        g.lineTo(x + w, yy + s * 0.1);
      }
      g.fill();
      g.fillRect(x - s * 0.04, y - s * 0.2, s * 0.08, s * 0.2);
    } else if (kind === 'trunk') {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(x - s * 0.16, y);
      g.lineTo(x - s * 0.11, y - s * 3);
      g.lineTo(x + s * 0.11, y - s * 3);
      g.lineTo(x + s * 0.18, y);
      g.closePath();
      g.fill();
      g.stroke();
      g.strokeStyle = 'rgba(30,20,10,0.25)';
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.moveTo(x - s * 0.08 + k * s * 0.03, y - r() * s * 2.5);
        g.lineTo(x - s * 0.08 + k * s * 0.03, y - r() * s * 2.5 - s * 0.3);
        g.stroke();
      }
    }
  }

  // Sky plus three parallax strips for a theme. Painted once per chapter.
  const backdropCache = {};
  BB.World = {
    backdrop(themeIndex) {
      if (backdropCache[themeIndex]) return backdropCache[themeIndex];
      const th = THEMES[themeIndex];
      const sky = canvas(C.W, C.H);
      const g = sky.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, C.H);
      gr.addColorStop(0, th.sky[0]);
      gr.addColorStop(0.55, th.sky[1]);
      gr.addColorStop(1, th.sky[2]);
      g.fillStyle = gr;
      g.fillRect(0, 0, C.W, C.H);
      if (th.stars) {
        const r = U.rng(9);
        for (let i = 0; i < 90; i++) {
          g.fillStyle = `rgba(255,255,240,${0.3 + r() * 0.6})`;
          const sx = r() * C.W;
          const sy = r() * C.H * 0.45;
          g.beginPath();
          g.arc(sx, sy, 0.6 + r() * 1.3, 0, TAU);
          g.fill();
        }
      }
      const sn = th.sun;
      const glow = g.createRadialGradient(sn.x, sn.y, sn.r * 0.5, sn.x, sn.y, sn.r * 3.2);
      glow.addColorStop(0, sn.glow);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, C.W, C.H);
      g.beginPath();
      g.arc(sn.x, sn.y, sn.r, 0, TAU);
      g.fillStyle = sn.color;
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(59,42,30,0.25)';
      g.stroke();
      paperGrain(g, C.W, C.H, 3, 0.05);

      const layers = th.layers.map((L, li) => {
        const c = canvas(LOOP, C.H);
        const x = c.getContext('2d');
        const r = U.rng(100 + li * 31 + themeIndex * 7);
        const path = () => {
          x.beginPath();
          x.moveTo(0, C.H);
          for (let px = 0; px <= LOOP; px += 8) x.lineTo(px, ridge(L, px, li + themeIndex));
          x.lineTo(LOOP, C.H);
          x.closePath();
        };
        // the cut-out casts a soft shadow onto the layer behind
        x.save();
        x.translate(5, -7);
        path();
        x.fillStyle = 'rgba(40,30,50,0.13)';
        x.fill();
        x.restore();
        path();
        x.fillStyle = L.color;
        x.fill();
        x.lineWidth = 2.5;
        x.strokeStyle = 'rgba(59,42,30,0.35)';
        x.stroke();
        if (L.snow) {
          x.save();
          path();
          x.clip();
          x.fillStyle = 'rgba(255,255,255,0.85)';
          x.beginPath();
          for (let px = 0; px <= LOOP; px += 8) {
            const yy = ridge(L, px, li + themeIndex);
            x.lineTo(px, yy);
          }
          for (let px = LOOP; px >= 0; px -= 8) {
            const yy = ridge(L, px, li + themeIndex);
            const depth = Math.max(0, (L.base - L.amp * 0.6 - yy) * 0.5) + 4 + Math.sin(px * 0.05) * 4;
            x.lineTo(px, yy + depth);
          }
          x.fill();
          x.restore();
        }
        // trees and bushes stand on the ridge (placed so the strip still tiles)
        for (let i = 0; i < L.trees; i++) {
          const px = ((i + r() * 0.8) / L.trees) * LOOP;
          const s = (L.tree === 'trunk' ? 60 : 30) + r() * 26 + li * 10;
          const yy = ridge(L, px, li + themeIndex) + 6;
          for (const off of [0, LOOP, -LOOP]) drawTree(x, L.tree, px + off, yy, s, L.treeColor, r);
        }
        if (L.flowers || L.ferns) {
          for (let i = 0; i < 160; i++) {
            const px = r() * LOOP;
            const yy = ridge(L, px, li + themeIndex) + 8 + r() * 60;
            if (L.flowers) {
              x.fillStyle = ['#ffffff', '#ffe27a', '#f7a8b8', '#c5b3f0'][Math.floor(r() * 4)];
              x.beginPath();
              x.arc(px, yy, 2 + r() * 2, 0, TAU);
              x.fill();
            } else {
              x.strokeStyle = 'rgba(40,70,40,0.6)';
              x.lineWidth = 2;
              x.beginPath();
              x.moveTo(px, yy + 8);
              x.quadraticCurveTo(px + 6, yy - 6, px + 14, yy - 4);
              x.stroke();
            }
          }
        }
        paperGrain(x, LOOP, C.H, 50 + li, 0.05);
        return { img: c, f: L.f };
      });
      return (backdropCache[themeIndex] = { sky, layers, theme: th });
    },

    drawBackdrop(ctx, bd, camX, camY, t, clouds) {
      ctx.drawImage(bd.sky, 0, 0, C.W, C.H);
      // drifting paper clouds between the sky and the far hills
      if (clouds) for (const cl of clouds) BB.World.cloud(ctx, ((cl.x - camX * 0.04 + t * cl.v) % 1300 + 1300) % 1300 - 170, cl.y, cl.s);
      bd.layers.forEach((L, i) => {
        const ox = -((camX * L.f) % LOOP);
        const oy = Math.round(-camY * L.f * 0.6 + (2 - i) * 10);
        ctx.drawImage(L.img, ox, oy, LOOP, C.H);
        ctx.drawImage(L.img, ox + LOOP, oy, LOOP, C.H);
        if (oy < 0) {
          ctx.fillStyle = bd.theme.layers[i].color;
          ctx.fillRect(0, C.H + oy - 1, C.W, -oy + 2);
        }
      });
    },

    cloud(ctx, x, y, s) {
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.arc(0, 0, 22 * s, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(26 * s, -16 * s, 26 * s, Math.PI, Math.PI * 1.9);
      ctx.arc(62 * s, -10 * s, 22 * s, Math.PI * 1.2, Math.PI * 1.95);
      ctx.arc(84 * s, 0, 22 * s, Math.PI * 1.5, Math.PI * 0.5);
      ctx.closePath();
      ctx.fillStyle = 'rgba(40,40,70,0.08)';
      ctx.save();
      ctx.translate(4, 6);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fffaf0';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(59,42,30,0.3)';
      ctx.stroke();
      ctx.restore();
    },

    // ---------- terrain ----------
    makeTerrain(sim, themeIndex) {
      const th = THEMES[themeIndex];
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = Math.max(1, Math.min(dpr, 6400 / (sim.cols * T)));
      const c = canvas((sim.cols * T + DX) * scale, (sim.rows * T + DY) * scale);
      const cache = { c, scale, th, sim };
      BB.World.paintTerrain(cache, 0, 0, sim.cols, sim.rows);
      return cache;
    },

    // Repaint a block of tiles (all of it at load; a patch after a smash).
    paintTerrain(cache, x0, y0, x1, y1) {
      const { c, scale, th, sim } = cache;
      const g = c.getContext('2d');
      g.setTransform(scale, 0, 0, scale, 0, DY * scale);
      const solid = (x, y) => BB.BootsSimSolid(sim, x, y);
      g.save();
      if (x0 > 0 || y0 > 0 || x1 < sim.cols || y1 < sim.rows) {
        g.beginPath();
        g.rect(x0 * T, y0 * T - DY, (x1 - x0) * T + DX, (y1 - y0) * T + DY);
        g.clip();
        g.clearRect(x0 * T, y0 * T - DY, (x1 - x0) * T + DX, (y1 - y0) * T + DY);
      }
      const ax = Math.max(0, x0 - 2);
      const ay = Math.max(0, y0 - 2);
      const bx = Math.min(sim.cols, x1 + 2);
      const by = Math.min(sim.rows, y1 + 2);
      // pass 1: lit top faces and shaded right faces (the depth)
      for (let y = by - 1; y >= ay; y--) {
        for (let x = ax; x < bx; x++) {
          const ch = sim.map[y][x];
          if (ch !== '#' && ch !== 'C') continue;
          const px = x * T;
          const py = y * T;
          const stone = ch === 'C';
          if (!solid(x, y - 1)) {
            g.beginPath();
            g.moveTo(px, py);
            g.lineTo(px + DX, py - DY);
            g.lineTo(px + T + DX, py - DY);
            g.lineTo(px + T, py);
            g.closePath();
            g.fillStyle = stone ? th.stoneTop : th.grassTop;
            g.fill();
            g.lineWidth = 2;
            g.strokeStyle = INK;
            g.stroke();
          }
          if (!solid(x + 1, y)) {
            g.beginPath();
            g.moveTo(px + T, py);
            g.lineTo(px + T + DX, py - DY);
            g.lineTo(px + T + DX, py + T - DY);
            g.lineTo(px + T, py + T);
            g.closePath();
            g.fillStyle = stone ? '#9d8f7d' : th.earthDark;
            g.fill();
            g.lineWidth = 2;
            g.strokeStyle = INK;
            g.stroke();
          }
        }
      }
      // pass 2: front faces
      for (let y = ay; y < by; y++) {
        for (let x = ax; x < bx; x++) {
          const ch = sim.map[y][x];
          const px = x * T;
          const py = y * T;
          if (ch === '#') {
            g.fillStyle = th.earth;
            g.fillRect(px, py, T + 0.5, T + 0.5);
            // strata and pebbles
            const deep = y / sim.rows;
            g.fillStyle = `rgba(60,30,15,${0.08 + deep * 0.18})`;
            g.fillRect(px, py, T + 0.5, T + 0.5);
            const h1 = U.hash(x, y, 1);
            if (h1 < 0.55) {
              g.fillStyle = 'rgba(255,230,200,0.16)';
              g.beginPath();
              g.ellipse(px + 8 + h1 * 24, py + 10 + U.hash(x, y, 2) * 20, 4 + h1 * 3, 2.5, 0, 0, TAU);
              g.fill();
            }
            if (U.hash(x, y, 3) < 0.3) {
              g.fillStyle = 'rgba(40,20,10,0.22)';
              g.beginPath();
              g.arc(px + U.hash(x, y, 4) * T, py + U.hash(x, y, 5) * T, 2.5, 0, TAU);
              g.fill();
            }
            if (!solid(x, y - 1)) {
              // grass cap with a scalloped edge
              g.fillStyle = th.grass;
              g.beginPath();
              g.moveTo(px, py);
              g.lineTo(px + T, py);
              g.lineTo(px + T, py + 9);
              for (let k = 4; k >= 0; k--) g.quadraticCurveTo(px + k * 8 + 4, py + 16 + (U.hash(x, k, 6) * 5), px + k * 8, py + 9);
              g.closePath();
              g.fill();
              g.strokeStyle = th.grassDark;
              g.lineWidth = 1.5;
              g.stroke();
              if (th.id === 'peaks') {
                g.fillStyle = 'rgba(255,255,255,0.9)';
                g.fillRect(px, py, T + 0.5, 4);
              }
            }
          } else if (ch === 'C') {
            g.fillStyle = th.stone;
            g.fillRect(px, py, T + 0.5, T + 0.5);
            g.strokeStyle = 'rgba(80,60,40,0.4)';
            g.lineWidth = 1.5;
            g.strokeRect(px + 3, py + 3, T - 6, T / 2 - 4);
            g.strokeRect(px + 3, py + T / 2 + 1, T - 6, T / 2 - 4);
            // the crack
            g.strokeStyle = INK;
            g.lineWidth = 2.2;
            g.beginPath();
            g.moveTo(px + T * 0.25, py);
            g.lineTo(px + T * 0.45, py + T * 0.4);
            g.lineTo(px + T * 0.35, py + T * 0.62);
            g.lineTo(px + T * 0.55, py + T);
            g.moveTo(px + T * 0.45, py + T * 0.4);
            g.lineTo(px + T * 0.8, py + T * 0.32);
            g.stroke();
          } else if (ch === '^') {
            // a thistle patch: sharp purple thorns with leaves
            for (let k = 0; k < 3; k++) {
              const bx0 = px + 2 + k * 12.5;
              g.beginPath();
              g.moveTo(bx0, py + T);
              g.lineTo(bx0 + 6.5, py + T * 0.28 + U.hash(x, k, 7) * 6);
              g.lineTo(bx0 + 13, py + T);
              g.closePath();
              g.fillStyle = k === 1 ? '#9b5fb5' : '#b57acb';
              g.fill();
              g.lineWidth = 2;
              g.strokeStyle = INK;
              g.stroke();
              g.fillStyle = '#e8d2f2';
              g.beginPath();
              g.arc(bx0 + 6.5, py + T * 0.36 + U.hash(x, k, 7) * 6, 2, 0, TAU);
              g.fill();
            }
            g.fillStyle = '#5d9e4c';
            g.beginPath();
            g.ellipse(px + 8, py + T - 4, 9, 4, -0.4, 0, TAU);
            g.ellipse(px + T - 8, py + T - 4, 9, 4, 0.4, 0, TAU);
            g.fill();
          }
          // ink outline on every exposed edge of solid ground
          if (ch === '#' || ch === 'C') {
            g.strokeStyle = INK;
            g.lineWidth = 2.5;
            g.beginPath();
            if (!solid(x, y - 1)) {
              g.moveTo(px, py);
              g.lineTo(px + T, py);
            }
            if (!solid(x - 1, y)) {
              g.moveTo(px, py);
              g.lineTo(px, py + T);
            }
            if (!solid(x + 1, y)) {
              g.moveTo(px + T, py);
              g.lineTo(px + T, py + T);
            }
            if (y + 1 < sim.rows && !solid(x, y + 1)) {
              g.moveTo(px, py + T);
              g.lineTo(px + T, py + T);
            }
            g.stroke();
          }
        }
      }
      g.restore();
    },

    drawTerrain(ctx, cache, camX, camY) {
      const s = cache.scale;
      const sx = Math.max(0, camX * s);
      const sy = Math.max(0, (camY + DY - DY) * s);
      const sw = Math.min(cache.c.width - sx, C.W * s + DX * s);
      const sh = Math.min(cache.c.height - sy, C.H * s + DY * s);
      if (sw <= 0 || sh <= 0) return;
      // cache y=0 is world y=-DY
      ctx.drawImage(cache.c, sx, sy, sw, sh, sx / s - camX, sy / s - camY - DY, sw / s, sh / s);
    },

    // Animated grass blades along exposed tops (visible tiles only).
    drawGrass(ctx, sim, th, camX, camY, t, wind) {
      const x0 = Math.max(0, Math.floor(camX / T));
      const x1 = Math.min(sim.cols, Math.ceil((camX + C.W) / T) + 1);
      const y0 = Math.max(0, Math.floor(camY / T));
      const y1 = Math.min(sim.rows, Math.ceil((camY + C.H) / T) + 1);
      ctx.lineCap = 'round';
      for (let x = x0; x < x1; x++) {
        for (let y = y0; y < y1; y++) {
          if (sim.map[y][x] !== '#') continue;
          if (y > 0 && BB.BootsSimSolid(sim, x, y - 1)) continue;
          if (y > 0 && sim.map[y - 1][x] === '^') continue;
          const px = x * T - camX;
          const py = y * T - camY;
          for (let k = 0; k < 4; k++) {
            const h = U.hash(x, y, 20 + k);
            const bx = px + 4 + k * 10 + h * 4;
            const len = 6 + h * 8;
            const sway = Math.sin(t * 2.2 + x * 0.7 + k) * 2.5 + wind * 3;
            ctx.strokeStyle = k % 2 ? th.grassDark : th.grass;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(bx, py + 1);
            ctx.quadraticCurveTo(bx + sway * 0.4, py - len * 0.5, bx + sway, py - len);
            ctx.stroke();
          }
          const fh = U.hash(x, y, 30);
          if (fh < 0.22 && th.id !== 'peaks') {
            const fx = px + 8 + fh * 100;
            const sway = Math.sin(t * 2 + x) * 2;
            ctx.strokeStyle = th.grassDark;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(fx, py);
            ctx.lineTo(fx + sway, py - 13);
            ctx.stroke();
            ctx.fillStyle = th.id === 'woods' ? '#f0c060' : ['#ffffff', '#ffd84d', '#f59ab0'][Math.floor(fh * 13) % 3];
            for (let k = 0; k < 5; k++) {
              ctx.beginPath();
              ctx.arc(fx + sway + Math.cos((k / 5) * TAU) * 3, py - 14 + Math.sin((k / 5) * TAU) * 3, 2.2, 0, TAU);
              ctx.fill();
            }
            ctx.fillStyle = '#e2853c';
            ctx.beginPath();
            ctx.arc(fx + sway, py - 14, 1.8, 0, TAU);
            ctx.fill();
          }
        }
      }
      ctx.lineCap = 'butt';
    },

    // A stream runs along the bottom of the page; pits open onto it.
    drawWater(ctx, sim, th, camX, camY, t) {
      const top = sim.rows * T - 24 - camY;
      if (top > C.H) return;
      ctx.fillStyle = th.water[1];
      ctx.fillRect(0, top + 6, C.W, C.H - top);
      ctx.beginPath();
      ctx.moveTo(0, C.H + 10);
      for (let x = 0; x <= C.W; x += 12) ctx.lineTo(x, top + Math.sin((x + camX) * 0.05 + t * 2.4) * 3);
      ctx.lineTo(C.W, C.H + 10);
      ctx.closePath();
      ctx.fillStyle = th.water[0];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= C.W; x += 12) ctx.lineTo(x, top + Math.sin((x + camX) * 0.05 + t * 2.4) * 3);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 8; i++) {
        const wx = (((i * 173 - camX * 0.9 + t * 30) % C.W) + C.W) % C.W;
        ctx.beginPath();
        ctx.moveTo(wx, top + 12 + (i % 3) * 5);
        ctx.lineTo(wx + 18, top + 12 + (i % 3) * 5);
        ctx.stroke();
      }
    },
  };

  // Solid test that works on the live sim map (the cache uses it too).
  BB.BootsSimSolid = (sim, x, y) => {
    if (x < 0 || x >= sim.cols) return true;
    if (y < 0 || y >= sim.rows) return false;
    const ch = sim.map[y][x];
    return ch === '#' || ch === 'C';
  };
})();
