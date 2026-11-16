// Puts a frame together: sky, things far away, the island, the tower floor by
// floor, falling pieces, the sliding block with its landing shadow, effects,
// near clouds, weather, then the vignette.
(function () {
  const SS = window.SS;
  const Wd = SS.World, BH = SS.Rules.BLOCK_H;
  const STONE = [196, 190, 204];
  const hueCache = {};
  const col = (h) => hueCache[h] || (hueCache[h] = SS.hsl(h, 62, 70));

  function overlap(a, b) {
    const x0 = Math.max(a.x - a.w / 2, b.x - b.w / 2), x1 = Math.min(a.x + a.w / 2, b.x + b.w / 2);
    const z0 = Math.max(a.z - a.d / 2, b.z - b.d / 2), z1 = Math.min(a.z + a.d / 2, b.z + b.d / 2);
    if (x1 <= x0 || z1 <= z0) return null;
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
  }

  SS.Render = {
    draw(ctx, G) {
      const t = G.tower || G.demo.tower;
      const W = Wd.W, H = Wd.H;
      ctx.save();
      ctx.translate(Wd.shakeX, Wd.shakeY);
      Wd.drawSky(ctx);
      Wd.drawBack(ctx);
      Wd.drawIsland(ctx);

      // the tower's shadow on the grass
      const b0 = t.stack[0];
      Wd.footprint(ctx, { x: b0.x + 0.18, z: b0.z - 0.12, w: b0.w * 1.1, d: b0.d * 1.1 }, 0.001, 0.16);

      const showcase = G.state === 'over' || G.state === 'results' || !G.tower;
      const n = t.stack.length;
      // floors below the screen are skipped
      let first = 0;
      for (let i = 0; i < n; i++) { if (Wd.yOf(i * BH) < H + Wd.S * 2) { first = i; break; } }
      if (!showcase) first = Math.max(first, n - 48);
      for (let i = first; i < n; i++) {
        const b = t.stack[i];
        if (i === 0) Wd.box(ctx, b, -0.12, BH + 0.12, STONE, { windows: undefined });
        else Wd.box(ctx, b, i * BH, BH, col(t.hueAt(i)), { windows: i });
      }
      // a ribbon at your best height, until you pass it
      const best = G.mode === 'daily' ? G.save.daily[SS.today()] || 0 : G.save.best || 0;
      if (G.tower && best > t.height() && (G.state === 'play' || G.state === 'paused')) this.bestLine(ctx, best, t);

      for (const d of Wd.debris) {
        const fade = SS.clamp01(1 - (d.t - 1.6) / 1.2);
        Wd.box(ctx, d, d.y, BH, col(d.hue), { alpha: fade, rot: d.rot });
      }

      const topY = n * BH;
      const m = t.mover;
      if (m && !t.over) {
        const shown = { x: m.x, z: m.z, w: m.w, d: m.d };
        if (G.state === 'play' && G.hitstop <= 0) shown[m.axis] += m.vel * G.acc;
        if (G.s.guide && G.tower && !t.foggy()) {
          const o = overlap(shown, t.top());
          if (o) Wd.footprint(ctx, o, topY + 0.001, 0.2);
        }
        Wd.box(ctx, shown, topY, BH, col(t.hueAt(n)), { windows: n, glow: 0.12 + 0.08 * Math.sin(G.time * 5) });
      }
      Wd.drawFx(ctx);
      Wd.drawClouds(ctx, true);
      Wd.drawWeather(ctx, Wd.yOf(topY), G.state === 'play' || G.state === 'paused');
      Wd.drawPops(ctx);
      ctx.restore();
      ctx.drawImage(Wd.layers.vignette, 0, 0, W, H);
    },

    bestLine(ctx, best, t) {
      const y = (best + 1) * BH, sy = Wd.yOf(y);
      if (sy < -20 || sy > Wd.H + 20) return;
      const r = 0.95;
      const pts = [Wd.p(-r, y, -r), Wd.p(r, y, -r), Wd.p(r, y, r), Wd.p(-r, y, r)];
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -Wd.time * 20;
      ctx.strokeStyle = 'rgba(255,138,92,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.stroke();
      ctx.restore();
      const lx = pts[1][0] + 10;
      SS.Draw.text(ctx, 'Best ' + best, lx, pts[1][1], 12, '#ffffff', 'left', 800, { shadow: true });
    },
  };
})();
