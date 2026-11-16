// Draws a page of the story: sky and parallax, the stream, the paper terrain,
// grass, bookmarks, the flag, stars, creatures, Pip, and the effects. Used
// both for real play and for the little stroll behind the title screen.
(function () {
  const C = BB.CFG;
  const T = C.T;
  const U = BB.U;
  const G = BB.G;
  const INK = BB.COL.ink;
  const TAU = Math.PI * 2;
  const S = window.BootsSim;

  let vignette = null;
  function getVignette() {
    if (vignette) return vignette;
    vignette = document.createElement('canvas');
    vignette.width = C.W / 2;
    vignette.height = C.H / 2;
    const g = vignette.getContext('2d');
    const gr = g.createRadialGradient(C.W / 4, C.H / 4, C.H * 0.2, C.W / 4, C.H / 4, C.W * 0.32);
    gr.addColorStop(0, 'rgba(90,60,30,0)');
    gr.addColorStop(1, 'rgba(90,60,30,0.32)');
    g.fillStyle = gr;
    g.fillRect(0, 0, C.W / 2, C.H / 2);
    return vignette;
  }

  function groundBelow(sim, x, y) {
    const tx = Math.floor(x);
    for (let ty = Math.floor(y - 0.05); ty < sim.rows; ty++) if (BB.BootsSimSolid(sim, tx, ty)) return ty;
    return null;
  }

  function shadow(ctx, sim, x, y, w, camX, camY) {
    const gy = groundBelow(sim, x, y);
    if (gy === null) return;
    const d = gy - y;
    const k = U.clamp01(1 - d / 7);
    if (k <= 0) return;
    ctx.fillStyle = `rgba(40,25,15,${0.28 * k})`;
    ctx.beginPath();
    ctx.ellipse(x * T - camX + 3, gy * T - camY - 2, w * (0.5 + 0.5 * k), 5 * k + 1, 0, 0, TAU);
    ctx.fill();
  }

  function bookmark(ctx, px, py, lit, t) {
    // a wooden post with a ribbon bookmark tied on
    ctx.fillStyle = '#9a6a42';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.fillRect(px + T * 0.44, py - T * 0.2, T * 0.12, T * 1.2);
    ctx.strokeRect(px + T * 0.44, py - T * 0.2, T * 0.12, T * 1.2);
    ctx.beginPath();
    ctx.arc(px + T * 0.5, py - T * 0.24, T * 0.12, 0, TAU);
    ctx.fillStyle = lit ? BB.COL.gold : '#c8b79a';
    ctx.fill();
    ctx.stroke();
    const wave = lit ? Math.sin(t * 5) * 4 : Math.sin(t * 1.5) * 1.5;
    ctx.beginPath();
    ctx.moveTo(px + T * 0.56, py - T * 0.1);
    ctx.lineTo(px + T * 1.05 + wave, py - T * 0.06);
    ctx.lineTo(px + T * 1.05 + wave * 1.3, py + T * 0.5);
    ctx.lineTo(px + T * 0.85 + wave, py + T * 0.36);
    ctx.lineTo(px + T * 0.66 + wave * 0.5, py + T * 0.5);
    ctx.lineTo(px + T * 0.56, py + T * 0.2);
    ctx.closePath();
    ctx.fillStyle = lit ? BB.COL.red : '#d8ccb8';
    ctx.fill();
    ctx.stroke();
    if (lit) G.star(ctx, px + T * 0.82 + wave * 0.6, py + T * 0.12, 5, '#fff3c4');
  }

  function flag(ctx, px, py, t) {
    const top = py - T * 1.6;
    ctx.fillStyle = '#7a5236';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.fillRect(px + T * 0.42, top, T * 0.1, T * 2.6);
    ctx.strokeRect(px + T * 0.42, top, T * 0.1, T * 2.6);
    ctx.beginPath();
    ctx.arc(px + T * 0.47, top - 4, 6, 0, TAU);
    ctx.fillStyle = BB.COL.gold;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + T * 0.52, top + 4);
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      ctx.lineTo(px + T * 0.52 + u * T * 1.3, top + 4 + Math.sin(t * 6 - u * 4) * 5 * u + u * 6);
    }
    for (let i = n; i >= 0; i--) {
      const u = i / n;
      ctx.lineTo(px + T * 0.52 + u * T * 1.3, top + T * 0.85 + Math.sin(t * 6 - u * 4) * 5 * u - u * 6);
    }
    ctx.closePath();
    ctx.fillStyle = BB.COL.red;
    ctx.fill();
    ctx.stroke();
    G.star(ctx, px + T * 1.12, top + T * 0.45 + Math.sin(t * 6 - 2) * 3, 9, BB.COL.gold, INK, 1.6);
  }

  // A star that turns like a coin, so it reads as a little 3D charm.
  function charm(ctx, x, y, t, scale = 1) {
    const turn = Math.cos(t * 2.4);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(Math.max(0.12, Math.abs(turn)) * scale, scale);
    G.star(ctx, 2, 3, 15, 'rgba(120,80,10,0.35)');
    G.star(ctx, 0, 0, 15, turn > 0 ? BB.COL.gold : '#f8d36a', INK, 2.4);
    G.star(ctx, -3, -3, 6, 'rgba(255,255,255,0.7)');
    ctx.restore();
  }
  BB.charm = charm;

  BB.Render = {
    vignette: getVignette,

    scene(ctx, w, g, t, opts = {}) {
      const sim = w.sim;
      const sh = opts.shake || 0;
      const camX = Math.round(w.cam.x + (sh ? (Math.random() - 0.5) * sh * 26 : 0));
      const camY = Math.round(w.cam.y + (sh ? (Math.random() - 0.5) * sh * 20 : 0));
      const th = w.terrain.th;
      BB.World.drawBackdrop(ctx, w.backdrop, camX, camY, t, g.clouds);
      BB.World.drawWater(ctx, sim, th, camX, camY, t);
      BB.World.drawTerrain(ctx, w.terrain, camX, camY);
      BB.World.drawGrass(ctx, sim, th, camX, camY, g.settings.motion ? t : 0, th.id === 'peaks' ? Math.sin(t * 0.7) * 0.8 + 0.6 : 0);

      // bookmarks and the flag (scan only what's on screen)
      const x0 = Math.max(0, Math.floor(camX / T) - 2);
      const x1 = Math.min(sim.cols, Math.ceil((camX + C.W) / T) + 2);
      for (let y = 0; y < sim.rows; y++) {
        for (let x = x0; x < x1; x++) {
          const ch = sim.map[y][x];
          if (ch === 'k' || ch === 'K') bookmark(ctx, x * T - camX, y * T - camY, ch === 'K', t);
          else if (ch === 'F') flag(ctx, x * T - camX, y * T - camY, t);
        }
      }
      // stars still to find
      for (const st of sim.stars) {
        if (st.taken) continue;
        const sx = st.x * T - camX;
        const sy = st.y * T - camY + Math.sin(t * 3 + st.x) * 4;
        if (sx < -30 || sx > C.W + 30) continue;
        ctx.fillStyle = 'rgba(255,230,140,0.25)';
        ctx.beginPath();
        ctx.arc(sx, sy, 22 + Math.sin(t * 4 + st.x) * 3, 0, TAU);
        ctx.fill();
        charm(ctx, sx, sy, t + st.x);
      }
      // creatures
      for (const c of sim.critters) {
        const cx = c.x * T - camX;
        if (cx < -60 || cx > C.W + 60) continue;
        const cy = c.y * T - camY;
        if (c.gone > 0) {
          // where it will pop back: a dotted ring that fills as it returns
          ctx.strokeStyle = 'rgba(59,42,30,0.35)';
          ctx.setLineDash([3, 5]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy - 16, 14, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - c.gone / 4));
          ctx.stroke();
          ctx.setLineDash([]);
          continue;
        }
        shadow(ctx, sim, c.x, c.y, 16, camX, camY);
        BB.drawCreature(ctx, c.type, cx, cy, T, { dir: c.dir, t: g.settings.motion ? t : 0, seed: c.home });
      }
      // Pip
      const p = sim.p;
      const H = w.hero;
      shadow(ctx, sim, p.x, p.y, 15, camX, camY);
      const flick = p.hurt > 0 && Math.floor(t * 16) % 2;
      if (!flick || opts.demo) {
        let sq = H.sq;
        if (!p.ground && !p.climbing) sq *= p.vy < -4 ? 0.86 : p.vy > 10 ? 0.9 : 1;
        const pop = U.easeBack(U.clamp01(H.popT));
        ctx.save();
        ctx.translate(p.x * T - camX, p.y * T - camY);
        ctx.scale(pop, pop);
        BB.drawHero(ctx, 0, 0, T, {
          face: p.face,
          power: p.power,
          sq,
          run: p.ground ? Math.min(1, Math.abs(p.vx) / 7) : 0,
          phase: H.phase,
          ground: p.ground,
          gliding: p.gliding,
          climbing: p.climbing,
          vy: p.vy,
          t,
          blink: BB.blink(t),
          scarf: Math.min(1, Math.abs(p.vx) / 7 + (p.ground ? 0 : 0.5)),
          ouch: H.ouch > 0,
        });
        ctx.restore();
      }
      // effects
      for (const f of g.fx) {
        if (f.k === 'flystar') continue;
        const k = f.t / (f.life || 0.4);
        const fx = f.x - camX;
        const fy = f.y - camY;
        if (f.k === 'dust') {
          ctx.fillStyle = `rgba(250,240,220,${0.8 * (1 - k)})`;
          ctx.strokeStyle = `rgba(59,42,30,${0.4 * (1 - k)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(fx, fy, f.r * (0.6 + k), 0, TAU);
          ctx.fill();
          ctx.stroke();
        } else if (f.k === 'spark') {
          ctx.globalAlpha = 1 - k;
          G.star(ctx, fx, fy, 5 * (1 - k * 0.5), f.color, INK, 1, f.rot + f.t * 6);
          ctx.globalAlpha = 1;
        } else if (f.k === 'chip') {
          ctx.save();
          ctx.globalAlpha = U.clamp01((1 - k) * 2);
          ctx.translate(fx, fy);
          ctx.rotate(f.rot);
          if (f.paper) ctx.scale(Math.cos(f.rot * 2), 1);
          ctx.fillStyle = f.color;
          ctx.fillRect(-f.s / 2, -f.s / 2, f.s, f.s * (f.paper ? 0.6 : 1));
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(-f.s / 2, -f.s / 2, f.s, f.s * (f.paper ? 0.6 : 1));
          ctx.restore();
        } else if (f.k === 'ring') {
          ctx.strokeStyle = f.color;
          ctx.globalAlpha = 1 - k;
          ctx.lineWidth = 4 * (1 - k) + 1;
          ctx.beginPath();
          ctx.arc(fx, fy, 10 + k * 46, 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (f.k === 'wind') {
          ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - k)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.quadraticCurveTo(fx + 12, fy - 4, fx + 26, fy);
          ctx.stroke();
        }
      }
      for (const f of g.floaters) {
        const k = f.t / 1.2;
        const y = f.y - camY - U.easeOut(Math.min(1, f.t * 2)) * 24;
        ctx.globalAlpha = U.clamp01((1 - k) * 3);
        const s = U.easeBack(U.clamp01(f.t * 4));
        ctx.save();
        ctx.translate(f.x - camX, y);
        ctx.scale(s, s);
        G.text(ctx, f.str, 0, 0, 20, f.color, 'center', 700, { outline: 5, outlineColor: '#fff8e8' });
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    },

    // drifting petals / leaves / snow in front of everything
    ambient(ctx, g) {
      const k = g.ambientKind;
      for (const m of g.ambient) {
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.rot);
        const s = m.z;
        if (k === 'petals') {
          ctx.fillStyle = m.z > 0.9 ? 'rgba(255,190,205,0.85)' : 'rgba(255,255,255,0.8)';
          ctx.scale(Math.cos(m.rot * 1.3), 1);
          ctx.beginPath();
          ctx.ellipse(0, 0, 5 * s, 3 * s, 0, 0, TAU);
          ctx.fill();
        } else if (k === 'leaves') {
          ctx.fillStyle = m.z > 0.9 ? 'rgba(226,120,50,0.85)' : 'rgba(240,180,70,0.8)';
          ctx.scale(Math.cos(m.rot * 1.1), 1);
          ctx.beginPath();
          ctx.moveTo(-7 * s, 0);
          ctx.quadraticCurveTo(0, -6 * s, 7 * s, 0);
          ctx.quadraticCurveTo(0, 6 * s, -7 * s, 0);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(255,255,255,${0.5 + s * 0.4})`;
          ctx.beginPath();
          ctx.arc(0, 0, 2.2 * s + 0.6, 0, TAU);
          ctx.fill();
          if (s > 1.1) {
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(6, -3);
            ctx.lineTo(28, -12);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    },
  };
})();
