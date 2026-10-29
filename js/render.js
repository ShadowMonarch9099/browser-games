// World drawing (tiles, plates, doors, actors, effects) plus the shared drawing
// helpers in SCE.Gfx. Screens, HUD and menus live in js/ui.js; draw() decides
// which world to show (the level, or the attract-mode demo behind menus) and
// hands the rest to SCE.UI.
(function () {
  const C = SCE.CFG;
  const T = C.TILE;

  const COL = {
    bg: '#08090d',
    floorA: '#121319',
    floorB: '#14151c',
    wall: '#20222c',
    wallAlt: '#1d1f28',
    wallTop: '#3a3d4c',
    wallFace: '#0c0d12',
    grate: '#5b5f74',
    ink: '#ebe9f3',
    mute: '#8d8b9e',
    faint: '#55546a',
    shadow: '#9d8cff',
    shadowDeep: '#5b47d6',
    danger: '#ef4444',
    amber: '#f2b84b',
    exit: '94,224,143',
    gold: '#f5c451',
    panel: 'rgba(13,14,20,0.96)',
    line: 'rgba(255,255,255,0.09)',
  };
  const FONT = '"Segoe UI", "SF Pro Text", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';
  const MONO = 'ui-monospace, "SF Mono", "Cascadia Mono", Consolas, Menlo, monospace';

  // ---------- shared helpers ----------

  function text(ctx, str, x, y, size, color, align = 'center', weight = 600, opts = {}) {
    ctx.font = `${weight} ${size}px ${opts.mono ? MONO : FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const spaced = opts.spacing && 'letterSpacing' in ctx;
    if (spaced) ctx.letterSpacing = `${opts.spacing}px`;
    if (opts.maxWidth) ctx.fillText(str, x, y, opts.maxWidth);
    else ctx.fillText(str, x, y);
    if (spaced) ctx.letterSpacing = '0px';
  }

  function measure(ctx, str, size, weight = 600, opts = {}) {
    ctx.font = `${weight} ${size}px ${opts.mono ? MONO : FONT}`;
    const spaced = opts.spacing && 'letterSpacing' in ctx;
    if (spaced) ctx.letterSpacing = `${opts.spacing}px`;
    const w = ctx.measureText(str).width;
    if (spaced) ctx.letterSpacing = '0px';
    return w;
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

  function star(ctx, x, y, r, filled, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.46 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = filled ? COL.gold : 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = filled ? '#fde3a1' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.25 / scale;
    ctx.stroke();
    ctx.restore();
  }

  function shardIcon(ctx, x, y, s, filled) {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.7, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.7, y);
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = '#c4b5fd';
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(196,181,253,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function keyIcon(ctx, x, y, s, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, s * 0.32);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x - s * 0.5, y, s * 0.45, 0, Math.PI * 2);
    ctx.moveTo(x - s * 0.05, y);
    ctx.lineTo(x + s, y);
    ctx.moveTo(x + s * 0.65, y);
    ctx.lineTo(x + s * 0.65, y + s * 0.45);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function lockIcon(ctx, x, y, s, color) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = s * 0.22;
    ctx.beginPath();
    ctx.arc(x, y - s * 0.25, s * 0.42, Math.PI, 0);
    ctx.stroke();
    roundRect(ctx, x - s * 0.65, y - s * 0.25, s * 1.3, s * 1.05, s * 0.18);
    ctx.fill();
  }

  // ---------- world ----------

  const R = {
    draw(ctx, g) {
      const UI = SCE.UI;
      g.buttons = [];
      ctx.fillStyle = COL.bg;
      ctx.fillRect(0, 0, C.W, C.H);
      const s = g.state;
      const fromTitle = (s === 'settings' || s === 'controls') && g.back && g.back.state === 'title';
      if (s === 'title' || s === 'select' || fromTitle) {
        this.world(ctx, this.demoView(g));
        UI.menuBackdrop(ctx, g);
        UI[s](ctx, g);
      } else {
        this.world(ctx, g);
        UI.hud(ctx, g);
        if (s === 'play') {
          if (!g.started) UI.intro(ctx, g);
          else UI.prompts(ctx, g);
          UI.touch(ctx, g);
        } else if (s === 'paused') UI.paused(ctx, g);
        else if (s === 'settings' || s === 'controls') {
          UI.dim(ctx, 0.78);
          UI[s](ctx, g);
        } else if (s === 'won') UI.won(ctx, g);
        else if (s === 'failed') UI.failed(ctx, g);
      }
      UI.toast(ctx, g);
      if (g.fade > 0) {
        ctx.fillStyle = `rgba(8,9,13,${g.fade})`;
        ctx.fillRect(0, 0, C.W, C.H);
      }
    },

    demoView(g) {
      const d = g.demo;
      return { isDemo: true, level: d.level, guards: d.guards, player: d.player, clone: null, particles: [], texts: [], time: g.time, shake: 0 };
    },

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
      if (!g.isDemo) {
        if (g.clone) this.ninja(ctx, g.clone, true, t, g);
        this.ninja(ctx, g.player, false, t, g);
      }
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
            ctx.fillStyle = (c * 7 + r * 13) % 5 === 0 ? COL.wallAlt : COL.wall;
            ctx.fillRect(x, y, T, T);
            const open = r + 1 < C.ROWS && L.base[r + 1][c] !== '#';
            if (open) {
              ctx.fillStyle = COL.wallFace;
              ctx.fillRect(x, y + T - 8, T, 8);
            }
            if (r > 0 && L.base[r - 1][c] !== '#') {
              ctx.fillStyle = COL.wallTop;
              ctx.fillRect(x, y, T, 2);
            }
          } else {
            ctx.fillStyle = (c + r) % 2 ? COL.floorA : COL.floorB;
            ctx.fillRect(x, y, T, T);
            if (b === '=') {
              ctx.fillStyle = 'rgba(0,0,0,0.45)';
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
      ctx.setLineDash([3, 6]);
      ctx.lineWidth = 1;
      for (const p of L.plates) {
        if (!p.group) continue;
        const d = L.doors[p.group];
        ctx.strokeStyle = d.color;
        ctx.globalAlpha = p.active ? 0.55 : 0.16;
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
          ctx.shadowBlur = 12;
        }
        roundRect(ctx, x + 4, y + 4, T - 8, T - 8, 3);
        ctx.fillStyle = p.active ? color : '#0d0e14';
        ctx.globalAlpha = p.active ? 0.85 : 1;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
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
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
          ctx.globalAlpha = 1;
          if (shut <= 0.01) continue;
          const inset = (1 - shut) * (T / 2);
          ctx.fillStyle = d.color;
          ctx.globalAlpha = 0.85;
          ctx.fillRect(x + inset, y + 1, T - inset * 2, T - 2);
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#000';
          for (let i = 0; i < 3; i++) ctx.fillRect(x + inset, y + 5 + i * 9, T - inset * 2, 3);
          ctx.globalAlpha = 1;
          if (d.twin && shut > 0.5) {
            // twin-lock glyph: two linked rings
            ctx.strokeStyle = '#0b0a12';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x + T / 2 - 3, y + T / 2, 4, 0, Math.PI * 2);
            ctx.moveTo(x + T / 2 + 7, y + T / 2);
            ctx.arc(x + T / 2 + 3, y + T / 2, 4, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    },

    locks(ctx, L) {
      for (const l of L.locks) {
        if (l.open) continue;
        const x = l.c * T;
        const y = l.r * T;
        ctx.fillStyle = '#6b4e33';
        ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
        ctx.fillStyle = '#4f3824';
        ctx.fillRect(x + 1, y + 9, T - 2, 3);
        ctx.fillRect(x + 1, y + 19, T - 2, 3);
        lockIcon(ctx, x + T / 2, y + T / 2, 8, COL.gold);
      }
    },

    exits(ctx, L, t) {
      for (const e of L.exits) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3);
        const grad = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, 24 + pulse * 6);
        grad.addColorStop(0, `rgba(${COL.exit},0.9)`);
        grad.addColorStop(0.4, `rgba(${COL.exit},0.3)`);
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
          ctx.shadowColor = COL.gold;
          ctx.shadowBlur = 10;
          keyIcon(ctx, x - 1, y, 8, COL.gold);
        } else {
          ctx.shadowColor = '#a78bfa';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#b9a6ff';
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
        // amber at rest, orange while investigating, red as suspicion builds
        const alarmed = guard.state === 'investigate' || guard.state === 'wait';
        const s = guard.sus || 0;
        const base = alarmed ? [249, 146, 60] : [242, 184, 75];
        const rgb = base.map((v, i) => Math.round(v + ([239, 68, 68][i] - v) * s)).join(',');
        const grad = ctx.createRadialGradient(guard.x, guard.y, 0, guard.x, guard.y, C.VIEW_RANGE);
        grad.addColorStop(0, `rgba(${rgb},${0.28 + s * 0.2})`);
        grad.addColorStop(1, `rgba(${rgb},0.05)`);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = `rgba(${rgb},${0.3 + s * 0.4})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    },

    leash(ctx, g, t) {
      const cl = g.clone;
      const active = g.steering;
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -t * 20;
      ctx.lineWidth = cl.strain > 0 ? 2.5 : 1.25;
      ctx.strokeStyle = cl.strain > 0 ? 'rgba(244,114,182,0.9)' : active ? 'rgba(157,140,255,0.7)' : 'rgba(157,140,255,0.28)';
      ctx.beginPath();
      ctx.arc(cl.sx, cl.sy, C.CLONE_LEASH, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = active ? 'rgba(91,71,214,0.08)' : 'rgba(91,71,214,0.04)';
      ctx.fill();
      // tether from the cast point
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(157,140,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(cl.sx, cl.sy);
      ctx.lineTo(cl.x, cl.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(157,140,255,0.6)';
      ctx.beginPath();
      ctx.arc(cl.sx, cl.sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    ninja(ctx, e, isClone, t, g) {
      const ang = Math.atan2(e.face.y, e.face.x);
      // Whoever you're controlling gets a ground ring; with a clone out the
      // ring also marks which body your input moves.
      const controlled = g.clone ? (isClone ? g.steering : !g.steering) : !isClone;
      if (controlled && g.clone) {
        ctx.save();
        ctx.strokeStyle = isClone ? 'rgba(157,140,255,0.9)' : 'rgba(235,233,243,0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + 9, 14 + Math.sin(t * 6) * 1.5, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        // chevron
        ctx.fillStyle = ctx.strokeStyle;
        const cy = e.y - 24 + Math.sin(t * 5) * 1.5;
        ctx.beginPath();
        ctx.moveTo(e.x - 5, cy - 3);
        ctx.lineTo(e.x + 5, cy - 3);
        ctx.lineTo(e.x, cy + 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(e.x, e.y);
      if (isClone) {
        let a = 0.65 + 0.1 * Math.sin(t * 8);
        if (e.life < 1 && Math.sin(t * 40) < 0) a *= 0.35;
        ctx.globalAlpha = a;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 9, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // scarf tail
      const sway = Math.sin(t * 9 + (isClone ? 1 : 0)) * 0.35;
      ctx.strokeStyle = isClone ? '#b9a6ff' : '#e5484d';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const bx = -Math.cos(ang) * 8;
      const by = -Math.sin(ang) * 8;
      ctx.moveTo(bx * 0.6, by * 0.6 - 3);
      ctx.quadraticCurveTo(bx * 1.5, by * 1.5 - 3, bx * 2 + Math.cos(ang + Math.PI / 2 + sway) * 6, by * 2 - 3 + Math.sin(ang + Math.PI / 2 + sway) * 6);
      ctx.stroke();

      // body
      ctx.fillStyle = isClone ? COL.shadowDeep : '#1c2030';
      ctx.strokeStyle = isClone ? '#c9bdff' : '#7d88b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // headband
      ctx.strokeStyle = isClone ? '#b9a6ff' : '#e5484d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 8.5, ang - 1.2, ang + 1.2);
      ctx.stroke();
      // eyes
      const px = Math.cos(ang + Math.PI / 2);
      const py = Math.sin(ang + Math.PI / 2);
      ctx.fillStyle = isClone ? '#ede9fe' : '#ffffff';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * 5 + px * 3.2 * s, Math.sin(ang) * 5 + py * 3.2 * s, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (isClone) {
        // lifetime ring
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = e.life < 1 ? '#f472b6' : COL.shadow;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 15, -Math.PI / 2, -Math.PI / 2 + (e.life / C.CLONE_LIFETIME) * Math.PI * 2);
        ctx.stroke();
      }
    },

    guard(ctx, gd, t) {
      ctx.save();
      ctx.translate(gd.x, gd.y);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(gd.angle);
      if (gd.type === 'hound') {
        ctx.fillStyle = '#6e4322';
        ctx.strokeStyle = '#c99566';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(-2, 0, 13, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(11, 0, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#432612';
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
        ctx.fillStyle = gd.type === 'sentry' ? '#6d1d1d' : '#8a3214';
        ctx.strokeStyle = '#f0b07a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#34343c';
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

      // Status above the head: detection meter while suspicious, otherwise
      // the usual ! / ? / z marks.
      const sus = gd.sus || 0;
      if (sus > 0 && !(gd.alert > 0)) {
        const x = gd.x;
        const y = gd.y - 25;
        ctx.fillStyle = 'rgba(8,9,13,0.85)';
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = sus > 0.6 ? COL.danger : COL.amber;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + sus * Math.PI * 2);
        ctx.stroke();
        text(ctx, '!', x, y + 1, 12, sus > 0.6 ? COL.danger : COL.amber, 'center', 800);
        return;
      }
      let mark = null;
      let color = COL.amber;
      if (gd.alert > 0) {
        mark = '!';
        color = COL.danger;
      } else if (gd.state === 'investigate' || gd.state === 'wait') mark = '?';
      else if (gd.state === 'sleep') {
        mark = 'z';
        color = COL.mute;
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
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(tx.str, tx.x, tx.y);
        ctx.fillStyle = tx.color;
        ctx.fillText(tx.str, tx.x, tx.y);
      }
      ctx.globalAlpha = 1;
    },

    vignette(ctx) {
      const grad = ctx.createRadialGradient(C.W / 2, C.H / 2, C.H * 0.4, C.W / 2, C.H / 2, C.W * 0.68);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, C.W, C.H);
    },
  };

  SCE.Gfx = { COL, FONT, MONO, text, measure, roundRect, star, shardIcon, keyIcon, lockIcon };
  SCE.Render = R;
})();
