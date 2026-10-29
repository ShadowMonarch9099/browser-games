// All canvas drawing: world, HUD, menus and overlays. Buttons drawn here are
// registered on game.buttons so clicks/taps can hit-test them next tick.
(function () {
  const C = SCE.CFG;
  const T = C.TILE;
  const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
  const COL = {
    bg: '#0b0a12',
    floorA: '#1b1828',
    floorB: '#1e1b2d',
    wall: '#2d2742',
    wallTop: '#3e3560',
    wallFace: '#17131f',
    grate: '#7a72a0',
    text: '#ece9ff',
    dim: '#9b94bf',
    panel: '#171427',
    panelEdge: '#4c3f7a',
    accent: '#a78bfa',
    exit: '74,222,128',
  };

  function text(ctx, str, x, y, size, color, align = 'center', weight = 600) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function star(ctx, x, y, r, filled) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = filled ? '#facc15' : 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = filled ? '#fde68a' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const fmtTime = (s) => s.toFixed(1) + 's';

  const R = {
    draw(ctx, game) {
      game.buttons = [];
      ctx.fillStyle = COL.bg;
      ctx.fillRect(0, 0, C.W, C.H);
      switch (game.state) {
        case 'title':
          this.title(ctx, game);
          break;
        case 'select':
          this.select(ctx, game);
          break;
        default:
          this.world(ctx, game);
          this.hud(ctx, game);
          if (game.state === 'play') this.touchUI(ctx, game);
          if (game.state === 'paused') this.pausedOverlay(ctx, game);
          if (game.state === 'won') this.wonOverlay(ctx, game);
          if (game.state === 'failed') this.failedOverlay(ctx, game);
      }
    },

    button(ctx, game, label, x, y, w, h, action, primary = false) {
      roundRect(ctx, x, y, w, h, 10);
      ctx.fillStyle = primary ? '#7c3aed' : '#262140';
      ctx.fill();
      ctx.strokeStyle = primary ? '#c4b5fd' : COL.panelEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      text(ctx, label, x + w / 2, y + h / 2 + 1, 16, COL.text);
      game.buttons.push({ x, y, w, h, action });
    },

    // ---------------- world ----------------

    world(ctx, g) {
      const L = g.level;
      const t = g.time;
      ctx.save();
      if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake * 18, (Math.random() - 0.5) * g.shake * 18);
      this.tiles(ctx, L);
      this.links(ctx, L);
      this.plates(ctx, L, t);
      this.doors(ctx, L);
      this.locks(ctx, L);
      this.exits(ctx, L, t);
      this.items(ctx, L, t);
      this.cones(ctx, g);
      if (g.clone) this.leash(ctx, g, t);
      for (const guard of g.guards) this.guard(ctx, guard, t);
      if (g.clone) this.ninja(ctx, g.clone, true, t, g);
      this.ninja(ctx, g.player, false, t, g);
      this.fx(ctx, g);
      this.vignette(ctx);
      ctx.restore();
    },

    tiles(ctx, L) {
      for (let r = 0; r < C.ROWS; r++) {
        for (let c = 0; c < C.COLS; c++) {
          const x = c * T;
          const y = r * T;
          const b = L.base[r][c];
          if (b === '#') {
            ctx.fillStyle = (c * 7 + r * 13) % 5 === 0 ? '#2a2440' : COL.wall;
            ctx.fillRect(x, y, T, T);
            const open = r + 1 < C.ROWS && L.base[r + 1][c] !== '#';
            if (open) {
              ctx.fillStyle = COL.wallFace;
              ctx.fillRect(x, y + T - 9, T, 9);
              ctx.fillStyle = 'rgba(255,255,255,0.04)';
              ctx.fillRect(x, y + T - 9, T, 1);
            }
            if (r === 0 || L.base[r - 1][c] !== '#') {
              ctx.fillStyle = COL.wallTop;
              ctx.fillRect(x, y, T, 2);
            }
          } else {
            ctx.fillStyle = (c + r) % 2 ? COL.floorA : COL.floorB;
            ctx.fillRect(x, y, T, T);
            if (b === '=') {
              ctx.fillStyle = 'rgba(0,0,0,0.35)';
              ctx.fillRect(x, y, T, T);
              ctx.fillStyle = COL.grate;
              for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 + i * 7.5, y + 1, 2, T - 2);
              ctx.fillRect(x, y + T / 2 - 1, T, 2);
            }
          }
        }
      }
    },

    links(ctx, L) {
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1.5;
      for (const p of L.plates) {
        if (!p.group) continue;
        const d = L.doors[p.group];
        ctx.strokeStyle = d.color;
        ctx.globalAlpha = p.active ? 0.6 : 0.22;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(d.cx, d.cy);
        ctx.stroke();
      }
      ctx.restore();
    },

    plates(ctx, L, t) {
      for (const p of L.plates) {
        const x = p.c * T;
        const y = p.r * T;
        const door = p.group ? L.doors[p.group] : null;
        const color = p.type === 'bell' ? C.BELL_COLOR : door ? door.color : '#cbd5e1';
        ctx.save();
        if (p.active) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 14;
        }
        roundRect(ctx, x + 4, y + 4, T - 8, T - 8, 4);
        ctx.fillStyle = p.active ? color : '#120f1c';
        ctx.globalAlpha = p.active ? 0.85 : 1;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        const cx = p.x;
        const cy = p.y;
        const ink = p.active ? '#0b0a12' : color;
        ctx.strokeStyle = ink;
        ctx.fillStyle = ink;
        ctx.lineWidth = 2;
        if (p.type === 'lever') {
          const a = p.on ? 0.6 : -0.6;
          ctx.beginPath();
          ctx.moveTo(cx, cy + 5);
          ctx.lineTo(cx + Math.sin(a) * 9, cy + 5 - Math.cos(a) * 9);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx + Math.sin(a) * 9, cy + 5 - Math.cos(a) * 9, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'timed') {
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.stroke();
          if (p.timer > 0) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, 6, -Math.PI / 2, -Math.PI / 2 + (p.timer / C.TIMED_PLATE_HOLD) * Math.PI * 2);
            ctx.fill();
          }
        } else if (p.type === 'bell') {
          const swing = p.active ? Math.sin(t * 18) * 0.35 : 0;
          ctx.save();
          ctx.translate(cx, cy - 6);
          ctx.rotate(swing);
          ctx.beginPath();
          ctx.moveTo(-6, 9);
          ctx.quadraticCurveTo(-6, 0, 0, 0);
          ctx.quadraticCurveTo(6, 0, 6, 9);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, 11, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (door && door.twin) {
          ctx.beginPath();
          ctx.arc(cx - 3.5, cy, 2.5, 0, Math.PI * 2);
          ctx.arc(cx + 3.5, cy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },

    doors(ctx, L) {
      for (const d of Object.values(L.doors)) {
        const shut = 1 - d.anim;
        for (const tile of d.tiles) {
          const x = tile.c * T;
          const y = tile.r * T;
          ctx.strokeStyle = d.color;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
          ctx.globalAlpha = 1;
          if (shut <= 0.01) continue;
          const inset = (1 - shut) * (T / 2);
          ctx.fillStyle = d.color;
          ctx.globalAlpha = 0.9;
          ctx.fillRect(x + inset, y + 1, T - inset * 2, T - 2);
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = '#000';
          for (let i = 0; i < 3; i++) ctx.fillRect(x + inset, y + 5 + i * 9, T - inset * 2, 3);
          ctx.globalAlpha = 1;
          if (d.twin && shut > 0.5) text(ctx, '⧉', x + T / 2, y + T / 2, 14, '#0b0a12', 'center', 800);
        }
      }
    },

    locks(ctx, L) {
      for (const l of L.locks) {
        if (l.open) continue;
        const x = l.c * T;
        const y = l.r * T;
        ctx.fillStyle = '#7c5a3a';
        ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
        ctx.fillStyle = '#5b3f26';
        ctx.fillRect(x + 1, y + 9, T - 2, 3);
        ctx.fillRect(x + 1, y + 19, T - 2, 3);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(x + T / 2, y + T / 2 - 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + T / 2 - 1.5, y + T / 2, 3, 7);
      }
    },

    exits(ctx, L, t) {
      for (const e of L.exits) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3);
        const grad = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, 24 + pulse * 6);
        grad.addColorStop(0, `rgba(${COL.exit},0.95)`);
        grad.addColorStop(0.4, `rgba(${COL.exit},0.35)`);
        grad.addColorStop(1, `rgba(${COL.exit},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(e.x - 34, e.y - 34, 68, 68);
        ctx.strokeStyle = `rgba(${COL.exit},0.9)`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const a = t * 2 + (i * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(e.x, e.y, 11, a, a + 1.2);
          ctx.stroke();
        }
      }
    },

    items(ctx, L, t) {
      for (const it of L.items) {
        if (it.taken) continue;
        const bob = Math.sin(t * 3 + it.c) * 2.5;
        const x = it.x;
        const y = it.y + bob;
        ctx.save();
        if (it.type === 'key') {
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 10;
          ctx.strokeStyle = '#fbbf24';
          ctx.fillStyle = '#fbbf24';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x - 4, y, 4.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 9, y);
          ctx.moveTo(x + 6, y);
          ctx.lineTo(x + 6, y + 4);
          ctx.moveTo(x + 9, y);
          ctx.lineTo(x + 9, y + 4);
          ctx.stroke();
        } else {
          ctx.shadowColor = '#c084fc';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#c084fc';
          ctx.beginPath();
          ctx.moveTo(x, y - 8);
          ctx.lineTo(x + 6, y);
          ctx.lineTo(x, y + 8);
          ctx.lineTo(x - 6, y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#f5f3ff';
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.moveTo(x, y - 8);
          ctx.lineTo(x + 2, y);
          ctx.lineTo(x, y + 2);
          ctx.lineTo(x - 2, y);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    },

    cones(ctx, g) {
      const L = g.level;
      for (const guard of g.guards) {
        if (guard.type === 'hound') continue;
        const n = 28;
        ctx.beginPath();
        ctx.moveTo(guard.x, guard.y);
        for (let i = 0; i <= n; i++) {
          const a = guard.angle - C.VIEW_HALF + (2 * C.VIEW_HALF * i) / n;
          const d = L.rayLength(guard.x, guard.y, a, C.VIEW_RANGE);
          ctx.lineTo(guard.x + Math.cos(a) * d, guard.y + Math.sin(a) * d);
        }
        ctx.closePath();
        const alarmed = guard.state === 'investigate' || guard.state === 'wait';
        const rgb = alarmed ? '251,146,60' : '250,204,21';
        const grad = ctx.createRadialGradient(guard.x, guard.y, 0, guard.x, guard.y, C.VIEW_RANGE);
        grad.addColorStop(0, `rgba(${rgb},0.32)`);
        grad.addColorStop(1, `rgba(${rgb},0.06)`);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = `rgba(${rgb},0.35)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    },

    leash(ctx, g, t) {
      const cl = g.clone;
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -t * 20;
      ctx.lineWidth = cl.strain > 0 ? 2.5 : 1.5;
      ctx.strokeStyle = cl.strain > 0 ? 'rgba(244,114,182,0.9)' : g.steering ? 'rgba(167,139,250,0.75)' : 'rgba(167,139,250,0.35)';
      ctx.beginPath();
      ctx.arc(cl.sx, cl.sy, C.CLONE_LEASH, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(124,58,237,0.06)';
      ctx.fill();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(167,139,250,0.6)';
      ctx.beginPath();
      ctx.arc(cl.sx, cl.sy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    ninja(ctx, e, isClone, t, g) {
      const ang = Math.atan2(e.face.y, e.face.x);
      ctx.save();
      ctx.translate(e.x, e.y);
      if (isClone) {
        let a = 0.6 + 0.1 * Math.sin(t * 8);
        if (e.life < 1.2 && Math.sin(t * 40) < 0) a *= 0.35;
        ctx.globalAlpha = a;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 9, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // scarf tail
      const sway = Math.sin(t * 9 + (isClone ? 1 : 0)) * 0.35;
      ctx.strokeStyle = isClone ? '#c084fc' : '#ef4444';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const bx = -Math.cos(ang) * 8;
      const by = -Math.sin(ang) * 8;
      ctx.moveTo(bx * 0.6, by * 0.6 - 3);
      ctx.quadraticCurveTo(bx * 1.5, by * 1.5 - 3, bx * 2 + Math.cos(ang + Math.PI / 2 + sway) * 6, by * 2 - 3 + Math.sin(ang + Math.PI / 2 + sway) * 6);
      ctx.stroke();

      // body
      ctx.fillStyle = isClone ? '#5b21b6' : '#1f2437';
      ctx.strokeStyle = isClone ? '#c4b5fd' : '#8f9bd6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // headband
      ctx.strokeStyle = isClone ? '#c084fc' : '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 8.5, ang - 1.2, ang + 1.2);
      ctx.stroke();
      // eyes
      const px = Math.cos(ang + Math.PI / 2);
      const py = Math.sin(ang + Math.PI / 2);
      ctx.fillStyle = isClone ? '#f5d0fe' : '#ffffff';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * 5 + px * 3.2 * s, Math.sin(ang) * 5 + py * 3.2 * s, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (isClone) {
        // lifetime ring
        ctx.strokeStyle = e.life < 1.2 ? '#f472b6' : '#a78bfa';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 15, -Math.PI / 2, -Math.PI / 2 + (e.life / C.CLONE_LIFETIME) * Math.PI * 2);
        ctx.stroke();
      } else if (g.steering) {
        text(ctx, '…', e.x, e.y - 18, 14, COL.accent);
      }
    },

    guard(ctx, gd, t) {
      ctx.save();
      ctx.translate(gd.x, gd.y);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(gd.angle);
      if (gd.type === 'hound') {
        ctx.fillStyle = '#7c4a24';
        ctx.strokeStyle = '#d6a36b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(-2, 0, 13, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(11, 0, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#4a2b14';
        ctx.beginPath();
        ctx.ellipse(9, -6, 3, 2, -0.5, 0, Math.PI * 2);
        ctx.ellipse(9, 6, 3, 2, 0.5, 0, Math.PI * 2);
        ctx.fill();
        if (gd.state !== 'sleep') {
          ctx.fillStyle = '#fde047';
          ctx.fillRect(13, -3, 2, 2);
          ctx.fillRect(13, 1, 2, 2);
        }
      } else {
        ctx.fillStyle = gd.type === 'sentry' ? '#7f1d1d' : '#9a3412';
        ctx.strokeStyle = '#fdba74';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#3f3f46';
        ctx.beginPath();
        ctx.arc(-2, 0, 7, Math.PI / 2, (Math.PI * 3) / 2);
        ctx.fill();
        // lantern
        ctx.fillStyle = '#fde047';
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(10, 7, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.fillRect(6, -4, 2.5, 2.5);
        ctx.fillRect(6, 1.5, 2.5, 2.5);
      }
      ctx.restore();

      let mark = null;
      let color = '#fde047';
      if (gd.alert > 0) {
        mark = '!';
        color = '#ef4444';
      } else if (gd.state === 'investigate' || gd.state === 'wait') mark = '?';
      else if (gd.state === 'sleep') {
        mark = 'z';
        color = '#9b94bf';
      }
      if (mark) {
        const bob = mark === 'z' ? Math.sin(t * 2) * 3 : 0;
        text(ctx, mark, gd.x + (mark === 'z' ? 10 : 0), gd.y - 22 + bob, mark === 'z' ? 13 : 18, color, 'center', 800);
      }
    },

    fx(ctx, g) {
      for (const p of g.particles) {
        const a = Math.max(0, p.life / p.max);
        if (p.ring) {
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = a * 0.7;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (1 - a) * p.size, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      for (const tx of g.texts) {
        ctx.globalAlpha = Math.min(1, tx.life / 0.4);
        ctx.font = `700 13px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.strokeText(tx.str, tx.x, tx.y);
        ctx.fillStyle = tx.color;
        ctx.fillText(tx.str, tx.x, tx.y);
      }
      ctx.globalAlpha = 1;
    },

    vignette(ctx) {
      const grad = ctx.createRadialGradient(C.W / 2, C.H / 2, C.H * 0.35, C.W / 2, C.H / 2, C.W * 0.65);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, C.W, C.H);
    },

    // ---------------- HUD ----------------

    hud(ctx, g) {
      const def = SCE.LEVELS[g.levelIndex];
      ctx.fillStyle = 'rgba(9,7,16,0.92)';
      ctx.fillRect(0, 0, C.W, 30);
      text(ctx, `${g.levelIndex + 1}. ${def.name}`, 12, 15, 14, COL.text, 'left', 700);

      const low = g.timeLeft <= 10;
      const tColor = low ? (Math.sin(g.time * 10) > 0 ? '#f87171' : '#fecaca') : COL.text;
      text(ctx, g.timeLeft.toFixed(1), C.W / 2, 15, 20, tColor, 'center', 800);

      // keys + shards
      text(ctx, `🗝 ${g.keys}`, 560, 15, 14, '#fbbf24', 'left', 700);
      text(ctx, `◆ ${g.shards}/${g.shardTotal}`, 610, 15, 14, '#c4b5fd', 'left', 700);

      // clone status widget
      const bx = 690;
      const bw = 210;
      roundRect(ctx, bx, 6, bw, 18, 9);
      ctx.fillStyle = '#1d1830';
      ctx.fill();
      let frac = 1;
      let label = 'CLONE READY · SPACE';
      let fill = '#7c3aed';
      if (g.clone) {
        frac = g.clone.life / C.CLONE_LIFETIME;
        label = `${g.steering ? 'STEERING' : 'CLONE'} ${g.clone.life.toFixed(1)}s`;
        fill = g.clone.life < 1.2 ? '#db2777' : '#8b5cf6';
      } else if (g.cloneCooldown > 0) {
        frac = 1 - g.cloneCooldown / C.CLONE_COOLDOWN;
        label = 'RECHARGING';
        fill = '#4b4566';
      }
      ctx.save();
      roundRect(ctx, bx, 6, bw, 18, 9);
      ctx.clip();
      ctx.fillStyle = fill;
      ctx.fillRect(bx, 6, bw * Math.max(0, frac), 18);
      ctx.restore();
      text(ctx, label, bx + bw / 2, 15.5, 11, '#f5f3ff', 'center', 700);

      // pause button
      if (g.state === 'play') {
        ctx.fillStyle = COL.dim;
        ctx.fillRect(924, 8, 4, 14);
        ctx.fillRect(932, 8, 4, 14);
        g.buttons.push({ x: 912, y: 0, w: 48, h: 30, action: () => g.pause() });
      }

      ctx.fillStyle = 'rgba(9,7,16,0.92)';
      ctx.fillRect(0, C.H - 30, C.W, 30);
      text(ctx, def.hint, C.W / 2, C.H - 15, 13, '#c9c3e6', 'center', 500);
    },

    touchUI(ctx, g) {
      const I = SCE.Input;
      if (!I.touchEnabled) return;
      ctx.save();
      if (I.stick) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(I.stick.ox, I.stick.oy, 45, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.6;
        const dx = I.stick.x - I.stick.ox;
        const dy = I.stick.y - I.stick.oy;
        const d = Math.hypot(dx, dy) || 1;
        const m = Math.min(d, 40);
        ctx.beginPath();
        ctx.arc(I.stick.ox + (dx / d) * m, I.stick.oy + (dy / d) * m, 20, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.5;
        text(ctx, 'drag here to move', 160, C.H - 60, 13, '#ffffff');
      }
      ctx.globalAlpha = I.cloneTouch !== null ? 0.75 : 0.4;
      ctx.fillStyle = '#7c3aed';
      ctx.beginPath();
      ctx.arc(C.W - 90, C.H - 90, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      text(ctx, 'CLONE', C.W - 90, C.H - 96, 14, '#fff', 'center', 800);
      text(ctx, 'hold+drag', C.W - 90, C.H - 80, 10, '#fff', 'center', 500);
      ctx.restore();
    },

    // ---------------- overlays ----------------

    panel(ctx, w, h) {
      ctx.fillStyle = 'rgba(5,4,10,0.62)';
      ctx.fillRect(0, 0, C.W, C.H);
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2;
      roundRect(ctx, x, y, w, h, 16);
      ctx.fillStyle = COL.panel;
      ctx.fill();
      ctx.strokeStyle = COL.panelEdge;
      ctx.lineWidth = 2;
      ctx.stroke();
      return { x, y };
    },

    pausedOverlay(ctx, g) {
      const { x, y } = this.panel(ctx, 360, 290);
      text(ctx, 'PAUSED', C.W / 2, y + 45, 30, COL.text, 'center', 800);
      this.button(ctx, g, 'Resume  (Esc)', x + 60, y + 85, 240, 42, () => g.resume(), true);
      this.button(ctx, g, 'Restart  (R)', x + 60, y + 137, 240, 42, () => g.startLevel(g.levelIndex));
      this.button(ctx, g, 'Level select  (Q)', x + 60, y + 189, 240, 42, () => g.goSelect());
      text(ctx, `Sound: ${SCE.Audio.muted ? 'off' : 'on'}  ·  M to toggle`, C.W / 2, y + 260, 13, COL.dim, 'center', 500);
    },

    wonOverlay(ctx, g) {
      const res = g.result;
      const { x, y } = this.panel(ctx, 440, 330);
      text(ctx, 'ESCAPED!', C.W / 2, y + 42, 32, '#4ade80', 'center', 800);
      for (let i = 0; i < 3; i++) star(ctx, C.W / 2 - 50 + i * 50, y + 92, 18, res.stars[i]);
      const lines = [
        ['Escaped the level', true],
        [`All shards  (${g.shards}/${g.shardTotal})`, res.stars[1]],
        [`${C.STAR_TIME_LEFT}s+ remaining  (${g.timeLeft.toFixed(1)}s left)`, res.stars[2]],
      ];
      lines.forEach(([s, ok], i) => text(ctx, `${ok ? '★' : '☆'}  ${s}`, C.W / 2, y + 135 + i * 22, 14, ok ? COL.text : COL.dim, 'center', 500));
      text(ctx, `Time ${fmtTime(res.used)}${res.newBest ? '  ·  new best!' : ''}`, C.W / 2, y + 210, 14, COL.accent, 'center', 700);
      const last = g.levelIndex + 1 >= SCE.LEVELS.length;
      this.button(ctx, g, last ? 'Finish  (Enter)' : 'Next  (Enter)', x + 30, y + 250, 120, 42, () => g.nextLevel(), true);
      this.button(ctx, g, 'Replay  (R)', x + 160, y + 250, 120, 42, () => g.startLevel(g.levelIndex));
      this.button(ctx, g, 'Levels  (Esc)', x + 290, y + 250, 120, 42, () => g.goSelect());
      if (last) text(ctx, 'You escaped the fortress! Thanks for playing.', C.W / 2, y + 232, 13, '#4ade80', 'center', 600);
    },

    failedOverlay(ctx, g) {
      const res = g.result;
      const { x, y } = this.panel(ctx, 460, 220);
      text(ctx, res.title, C.W / 2, y + 48, 30, '#f87171', 'center', 800);
      text(ctx, res.text, C.W / 2, y + 95, 14, COL.text, 'center', 500);
      this.button(ctx, g, 'Retry  (R / Space)', x + 40, y + 140, 200, 44, () => g.startLevel(g.levelIndex), true);
      this.button(ctx, g, 'Levels  (Esc)', x + 260, y + 140, 160, 44, () => g.goSelect());
    },

    // ---------------- menus ----------------

    menuBackdrop(ctx, t) {
      for (let r = 0; r < C.ROWS; r++) {
        for (let c = 0; c < C.COLS; c++) {
          ctx.fillStyle = (c + r) % 2 ? '#100e19' : '#12101c';
          ctx.fillRect(c * T, r * T, T, T);
        }
      }
      for (let i = 0; i < 40; i++) {
        const x = (i * 197 + t * (8 + (i % 5) * 4)) % C.W;
        const y = (i * 89 + Math.sin(t + i) * 20 + C.H) % C.H;
        ctx.fillStyle = `rgba(167,139,250,${0.08 + (i % 4) * 0.04})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      this.vignette(ctx);
    },

    title(ctx, g) {
      const t = g.time;
      this.menuBackdrop(ctx, t);
      ctx.save();
      ctx.shadowColor = '#7c3aed';
      ctx.shadowBlur = 30;
      text(ctx, 'SHADOW CLONE', C.W / 2 + 6, 112 + 4, 64, 'rgba(124,58,237,0.5)', 'center', 900);
      text(ctx, 'SHADOW CLONE', C.W / 2, 112, 64, '#f5f3ff', 'center', 900);
      ctx.restore();
      text(ctx, 'ESCAPE', C.W / 2, 172, 46, '#a78bfa', 'center', 900);
      text(ctx, 'One shadow. Five seconds. Sixty to get out.', C.W / 2, 218, 16, COL.dim, 'center', 500);

      // little demo: ninja and its circling clone
      const demoX = C.W / 2;
      const demoY = 280;
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(167,139,250,0.35)';
      ctx.beginPath();
      ctx.arc(demoX, demoY, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      const a = t * 1.4;
      const clone = { x: demoX + Math.cos(a) * 34, y: demoY + Math.sin(a) * 34, face: { x: -Math.sin(a), y: Math.cos(a) }, life: 5 };
      this.ninja(ctx, clone, true, t, g);
      this.ninja(ctx, { x: demoX, y: demoY, face: { x: 1, y: 0 } }, false, t, { steering: false });

      this.button(ctx, g, 'Play  (Enter)', C.W / 2 - 100, 330, 200, 48, () => g.goSelect(), true);

      const rules = [
        'Move: WASD / Arrows     Clone: tap SPACE to cast, hold SPACE + move to steer',
        'Your clone lasts 5s, stays within 100px of where you cast it, presses switches,',
        "can't pick anything up — and guards ignore it completely.",
        'R restart  ·  Esc pause  ·  M sound',
      ];
      rules.forEach((s, i) => text(ctx, s, C.W / 2, 418 + i * 24, 14, i === 3 ? COL.dim : '#d4cff0', 'center', 500));
    },

    select(ctx, g) {
      this.menuBackdrop(ctx, g.time);
      text(ctx, 'Choose a Level', C.W / 2, 56, 32, COL.text, 'center', 800);
      const total = Object.values(g.save.levels).reduce((s, l) => s + (l.stars || 0), 0);
      text(ctx, `★ ${total} / ${SCE.LEVELS.length * 3}`, C.W / 2, 92, 15, '#facc15', 'center', 700);

      const cols = 4;
      const cw = 190;
      const ch = 104;
      const gap = 18;
      const ox = (C.W - (cols * cw + (cols - 1) * gap)) / 2;
      const oy = 120;
      SCE.LEVELS.forEach((def, i) => {
        const x = ox + (i % cols) * (cw + gap);
        const y = oy + Math.floor(i / cols) * (ch + gap);
        const unlocked = i < g.save.unlocked;
        const rec = g.save.levels[i];
        const selected = g.sel === i;
        roundRect(ctx, x, y, cw, ch, 12);
        ctx.fillStyle = unlocked ? (selected ? '#2a2150' : '#1a1630') : '#131120';
        ctx.fill();
        ctx.strokeStyle = selected ? '#c4b5fd' : unlocked ? COL.panelEdge : '#262236';
        ctx.lineWidth = selected ? 2.5 : 1.5;
        ctx.stroke();
        if (unlocked) {
          text(ctx, `${i + 1}`, x + 18, y + 22, 18, COL.accent, 'left', 800);
          text(ctx, def.name, x + 18, y + 48, 15, COL.text, 'left', 700);
          for (let s = 0; s < 3; s++) star(ctx, x + 26 + s * 26, y + 78, 9, rec && rec.stars > s);
          if (rec && rec.best !== undefined) text(ctx, fmtTime(rec.best), x + cw - 16, y + 78, 12, COL.dim, 'right', 600);
          g.buttons.push({ x, y, w: cw, h: ch, action: () => g.startLevel(i) });
        } else {
          text(ctx, '🔒', x + cw / 2, y + ch / 2 - 6, 22, COL.dim);
          text(ctx, `Level ${i + 1}`, x + cw / 2, y + ch / 2 + 22, 13, '#5c5679');
        }
      });
      text(ctx, 'Arrows to choose · Enter to play · Esc back', C.W / 2, C.H - 30, 13, COL.dim, 'center', 500);
    },
  };

  SCE.Render = R;
})();
