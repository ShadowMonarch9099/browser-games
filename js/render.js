// World drawing (tiles, props, torches, plates, doors, actors, effects) plus
// the shared drawing helpers in SCE.Gfx. Screens, HUD and menus live in
// js/ui.js; draw() decides which world to show (the level, or the
// attract-mode demo behind menus) and hands the rest to SCE.UI.
(function () {
  const C = SCE.CFG;
  const T = C.TILE;

  const COL = {
    bg: '#0b0d10',
    ink: '#ece8df',
    mute: '#9a958a',
    faint: '#5f5b55',
    accent: '#e0a83e', // brass: UI focus and highlights
    shadow: '#4fd1c5', // teal: everything about the clone
    shadowDeep: '#1f8a80',
    danger: '#e5484d',
    amber: '#f2a93b',
    exit: '74,201,120',
    gold: '#f2c14e',
    shard: '#6fc3ff',
    panel: 'rgba(15,17,21,0.97)',
    line: 'rgba(255,255,255,0.08)',
  };
  const FONT = '"Segoe UI", "SF Pro Text", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';
  const MONO = 'ui-monospace, "SF Mono", "Cascadia Mono", Consolas, Menlo, monospace';

  // One look per act: cold stone ramparts, timber barracks, the carpeted keep.
  const THEMES = [
    { kind: 'stone', floorA: '#1b2027', floorB: '#1e232b', wall: '#2c333d', wallTop: '#4b5563', wallFace: '#12161b', torch: '255,170,80' },
    { kind: 'wood', floorA: '#2b2119', floorB: '#2f241b', wall: '#3b3029', wallTop: '#5e4c3e', wallFace: '#19130e', torch: '255,160,70' },
    { kind: 'keep', floorA: '#201f22', floorB: '#242326', wall: '#35302d', wallTop: '#5a524b', wallFace: '#161312', torch: '255,190,110' },
  ];

  // Stable per-tile randomness so decoration never flickers between frames.
  function hash(c, r, k = 0) {
    let h = (c * 374761393 + r * 668265263 + k * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

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
    ctx.strokeStyle = filled ? '#fbe2a0' : 'rgba(255,255,255,0.2)';
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
      ctx.fillStyle = COL.shard;
      ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(111,195,255,0.4)';
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

  function ellipse(ctx, x, y, rx, ry, fill, stroke, lw = 1.5) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

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
          if (!g.started) UI.ready(ctx, g);
          else UI.prompts(ctx, g);
          UI.hint(ctx, g);
          UI.touch(ctx, g);
        } else if (s === 'paused') UI.paused(ctx, g);
        else if (s === 'settings' || s === 'controls') {
          UI.dim(ctx, 0.8);
          UI[s](ctx, g);
        } else if (s === 'won') UI.won(ctx, g);
        else if (s === 'failed') UI.failed(ctx, g);
      }
      UI.toast(ctx, g);
      if (g.fade > 0) {
        ctx.fillStyle = `rgba(11,13,16,${g.fade})`;
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
      this.background(ctx, L);
      this.torchGlow(ctx, L, t);
      this.links(ctx, L);
      this.plates(ctx, L, t);
      this.doors(ctx, L);
      this.locks(ctx, L);
      this.exits(ctx, L, t);
      this.items(ctx, L, t);
      this.torches(ctx, L, t);
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

    // ---------- static layer (floors, walls, props), cached per level ----------

    background(ctx, L) {
      const scale = ctx.getTransform ? ctx.getTransform().a : 1;
      if (!L.bg || L.bgScale !== scale) {
        const cv = document.createElement('canvas');
        cv.width = Math.ceil(C.W * scale);
        cv.height = Math.ceil(C.H * scale);
        const c = cv.getContext('2d');
        c.scale(scale, scale);
        this.drawStatic(c, L);
        L.bg = cv;
        L.bgScale = scale;
      }
      ctx.drawImage(L.bg, 0, 0, C.W, C.H);
    },

    drawStatic(c, L) {
      const th = THEMES[L.act || 0];
      const isWall = (cc, r) => !L.inBounds(cc, r) || L.base[r][cc] === '#';
      const isSolid = (cc, r) => !L.inBounds(cc, r) || '#XBO'.includes(L.base[r][cc]);
      for (let r = 0; r < C.ROWS; r++) {
        for (let cc = 0; cc < C.COLS; cc++) if (L.base[r][cc] !== '#') this.floorTile(c, L, th, cc, r);
      }
      // ambient occlusion where floor meets walls and props
      for (let r = 0; r < C.ROWS; r++) {
        for (let cc = 0; cc < C.COLS; cc++) {
          if (isSolid(cc, r)) continue;
          const x = cc * T;
          const y = r * T;
          if (isWall(cc, r - 1)) this.shade(c, x, y, T, 10, 'down');
          if (isSolid(cc - 1, r)) this.shade(c, x, y, 7, T, 'right');
          if (isSolid(cc + 1, r)) this.shade(c, x + T - 5, y, 5, T, 'left');
        }
      }
      for (let r = 0; r < C.ROWS; r++) {
        for (let cc = 0; cc < C.COLS; cc++) {
          const b = L.base[r][cc];
          if (b === '#') this.wallTile(c, L, th, cc, r);
          else if (b === 'X') this.crate(c, cc * T, r * T, hash(cc, r, 4));
          else if (b === 'B') this.barrel(c, cc * T + T / 2, r * T + T / 2);
          else if (b === 'O') this.pillar(c, cc * T, r * T, th);
        }
      }
      // torches sit on wall faces that look onto floor
      L.torchList = [];
      for (let r = 0; r < C.ROWS - 1; r++) {
        let last = -9;
        for (let cc = 1; cc < C.COLS - 1; cc++) {
          if (L.base[r][cc] !== '#' || isSolid(cc, r + 1) || cc - last < 5) continue;
          if (hash(cc, r, 7) < 0.22) {
            L.torchList.push({ x: (cc + 0.5) * T, y: (r + 1) * T - 7, seed: hash(cc, r, 8) * 10 });
            last = cc;
          }
        }
      }
    },

    shade(c, x, y, w, h, dir) {
      const g =
        dir === 'down' ? c.createLinearGradient(0, y, 0, y + h) : dir === 'right' ? c.createLinearGradient(x, 0, x + w, 0) : c.createLinearGradient(x + w, 0, x, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.38)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x, y, w, h);
    },

    floorTile(c, L, th, cc, r) {
      const x = cc * T;
      const y = r * T;
      const b = L.base[r][cc];
      const v = hash(cc, r);
      if (th.kind === 'stone') {
        c.fillStyle = (cc + r) % 2 ? th.floorA : th.floorB;
        c.fillRect(x, y, T, T);
        c.fillStyle = `rgba(255,255,255,${0.012 + v * 0.025})`;
        c.fillRect(x, y, T, T);
        c.fillStyle = 'rgba(0,0,0,0.38)';
        c.fillRect(x, y, T, 1);
        c.fillRect(x, y, 1, T);
        if (v < 0.35) c.fillRect(x + 1, y + 14 + Math.round(v * 6), T - 1, 1);
        else if (v > 0.78) c.fillRect(x + 12 + Math.round(v * 6), y + 1, 1, T - 1);
        if (hash(cc, r, 1) < 0.12) {
          c.strokeStyle = 'rgba(0,0,0,0.45)';
          c.lineWidth = 1;
          c.beginPath();
          let px = x + 6 + hash(cc, r, 2) * 18;
          let py = y + 6;
          c.moveTo(px, py);
          for (let i = 0; i < 3; i++) {
            px += (hash(cc, r, 10 + i) - 0.5) * 10;
            py += 5 + hash(cc, r, 20 + i) * 4;
            c.lineTo(px, py);
          }
          c.stroke();
        }
        if (hash(cc, r, 3) < 0.07) {
          c.fillStyle = 'rgba(70,120,80,0.35)';
          for (let i = 0; i < 4; i++) {
            c.beginPath();
            c.arc(x + 4 + hash(cc, r, 30 + i) * 22, y + 4 + hash(cc, r, 40 + i) * 22, 1.5 + hash(cc, r, 50 + i) * 2.5, 0, Math.PI * 2);
            c.fill();
          }
        }
      } else if (th.kind === 'wood') {
        for (let i = 0; i < 3; i++) {
          const pr = r * 3 + i;
          const y0 = y + i * 10;
          const off = hash(pr, 0, 3) * 90;
          const seg = Math.floor((x - off + 900) / 90);
          const tone = hash(seg, pr, 5);
          c.fillStyle = tone > 0.5 ? th.floorA : th.floorB;
          c.fillRect(x, y0, T, 10);
          c.fillStyle = `rgba(255,220,170,${tone * 0.03})`;
          c.fillRect(x, y0, T, 10);
          c.fillStyle = 'rgba(0,0,0,0.45)';
          c.fillRect(x, y0, T, 1);
          for (let jx = off - 900; jx < x + T; jx += 90) if (jx >= x && jx < x + T) c.fillRect(jx, y0, 1, 10);
          // grain
          c.fillStyle = 'rgba(0,0,0,0.12)';
          c.fillRect(x, y0 + 4 + Math.round(hash(cc, pr, 6) * 3), T, 1);
        }
        if (hash(cc, r, 1) < 0.08) {
          c.fillStyle = 'rgba(30,20,12,0.6)';
          c.beginPath();
          c.ellipse(x + 8 + v * 14, y + 5 + hash(cc, r, 2) * 20, 2.5, 1.5, 0, 0, Math.PI * 2);
          c.fill();
        }
        if (hash(cc, r, 3) < 0.1) {
          c.strokeStyle = 'rgba(190,160,80,0.35)';
          c.lineWidth = 1;
          c.beginPath();
          for (let i = 0; i < 5; i++) {
            const sx = x + hash(cc, r, 60 + i) * 26 + 2;
            const sy = y + hash(cc, r, 70 + i) * 26 + 2;
            const a = hash(cc, r, 80 + i) * Math.PI;
            c.moveTo(sx, sy);
            c.lineTo(sx + Math.cos(a) * 5, sy + Math.sin(a) * 5);
          }
          c.stroke();
        }
      } else {
        c.fillStyle = (cc + r) % 2 ? th.floorA : th.floorB;
        c.fillRect(x, y, T, T);
        c.fillStyle = 'rgba(255,255,255,0.045)';
        c.fillRect(x + 1, y + 1, T - 2, 1);
        c.fillRect(x + 1, y + 1, 1, T - 2);
        c.fillStyle = 'rgba(0,0,0,0.4)';
        c.fillRect(x, y + T - 1, T, 1);
        c.fillRect(x + T - 1, y, 1, T);
        if ((cc + r) % 2 === 0) {
          c.fillStyle = 'rgba(255,255,255,0.025)';
          c.beginPath();
          c.moveTo(x + T / 2, y + 6);
          c.lineTo(x + T - 6, y + T / 2);
          c.lineTo(x + T / 2, y + T - 6);
          c.lineTo(x + 6, y + T / 2);
          c.closePath();
          c.fill();
        }
      }
      if (b === ',') this.carpet(c, L, cc, r);
      if (b === '=') {
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(x, y, T, T);
        c.fillStyle = '#5d636e';
        for (let i = 0; i < 4; i++) c.fillRect(x + 3 + i * 7.5, y + 1, 2, T - 2);
        c.fillRect(x, y + T / 2 - 1, T, 2);
        c.fillStyle = 'rgba(255,255,255,0.15)';
        for (let i = 0; i < 4; i++) c.fillRect(x + 3 + i * 7.5, y + 1, 1, T - 2);
      }
    },

    carpet(c, L, cc, r) {
      const x = cc * T;
      const y = r * T;
      const is = (a, b) => L.inBounds(a, b) && L.base[b][a] === ',';
      c.fillStyle = '#5a1c22';
      c.fillRect(x, y, T, T);
      c.fillStyle = 'rgba(0,0,0,0.18)';
      if ((cc + r) % 2) c.fillRect(x, y, T, T);
      c.strokeStyle = 'rgba(214,166,72,0.35)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + T / 2, y + 8);
      c.lineTo(x + T - 8, y + T / 2);
      c.lineTo(x + T / 2, y + T - 8);
      c.lineTo(x + 8, y + T / 2);
      c.closePath();
      c.stroke();
      c.fillStyle = '#c3923f';
      if (!is(cc, r - 1)) c.fillRect(x, y + 2, T, 2);
      if (!is(cc, r + 1)) c.fillRect(x, y + T - 4, T, 2);
      if (!is(cc - 1, r)) c.fillRect(x + 2, y, 2, T);
      if (!is(cc + 1, r)) c.fillRect(x + T - 4, y, 2, T);
    },

    wallTile(c, L, th, cc, r) {
      const x = cc * T;
      const y = r * T;
      const open = (a, b) => L.inBounds(a, b) && L.base[b][a] !== '#';
      c.fillStyle = th.wall;
      c.fillRect(x, y, T, T);
      // dressed stone blocks on the wall top
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.fillRect(x, y + 15, T, 1);
      c.fillRect(x + (r % 2 ? 10 : 20), y, 1, 15);
      c.fillRect(x + (r % 2 ? 22 : 6), y + 15, 1, 15);
      c.fillStyle = `rgba(255,255,255,${hash(cc, r, 9) * 0.035})`;
      c.fillRect(x, y, T, T);
      if (open(cc, r - 1)) {
        c.fillStyle = th.wallTop;
        c.fillRect(x, y, T, 2);
      }
      if (open(cc - 1, r)) {
        c.fillStyle = 'rgba(255,255,255,0.06)';
        c.fillRect(x, y, 1, T);
      }
      if (open(cc + 1, r)) {
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.fillRect(x + T - 1, y, 1, T);
      }
      if (open(cc, r + 1)) {
        // the visible face, with brick courses
        c.fillStyle = th.wallFace;
        c.fillRect(x, y + T - 10, T, 10);
        c.fillStyle = 'rgba(255,255,255,0.05)';
        c.fillRect(x, y + T - 10, T, 1);
        c.fillStyle = 'rgba(0,0,0,0.45)';
        c.fillRect(x, y + T - 5, T, 1);
        for (let bx = (cc % 2) * 5; bx < T; bx += 10) c.fillRect(x + bx, y + T - 10, 1, 5);
        for (let bx = 5 - (cc % 2) * 5; bx < T; bx += 10) c.fillRect(x + bx, y + T - 5, 1, 5);
      }
    },

    crate(c, x, y, v) {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(x + 5, y + 6, T - 6, T - 6);
      c.fillStyle = v > 0.5 ? '#6e5130' : '#6a4b2b';
      c.fillRect(x + 3, y + 3, T - 6, T - 6);
      c.strokeStyle = '#3a2814';
      c.lineWidth = 1.5;
      c.strokeRect(x + 3.5, y + 3.5, T - 7, T - 7);
      c.strokeRect(x + 7, y + 7, T - 14, T - 14);
      c.beginPath();
      if (v > 0.5) {
        c.moveTo(x + 7, y + 7);
        c.lineTo(x + T - 7, y + T - 7);
      } else {
        c.moveTo(x + T - 7, y + 7);
        c.lineTo(x + 7, y + T - 7);
      }
      c.stroke();
      c.fillStyle = 'rgba(255,230,180,0.12)';
      c.fillRect(x + 3, y + 3, T - 6, 2);
      c.fillStyle = '#a8a29a';
      for (const [nx, ny] of [[6, 6], [T - 6, 6], [6, T - 6], [T - 6, T - 6]]) c.fillRect(x + nx - 1, y + ny - 1, 2, 2);
    },

    barrel(c, x, y) {
      ellipse(c, x + 2, y + 3, 12, 11, 'rgba(0,0,0,0.35)');
      ellipse(c, x, y, 12, 12, '#5e3e22', '#2f1e10');
      ellipse(c, x, y, 12, 12, null, '#8f949b', 2);
      ellipse(c, x, y, 7.5, 7.5, '#6f4a29', '#8f949b', 1.5);
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x - 6, y);
      c.lineTo(x + 6, y);
      c.stroke();
      c.strokeStyle = 'rgba(255,230,190,0.18)';
      c.beginPath();
      c.arc(x, y, 10, Math.PI * 1.1, Math.PI * 1.6);
      c.stroke();
    },

    pillar(c, x, y, th) {
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(x + 4, y + 5, T - 4, T - 4);
      c.fillStyle = th.wallFace;
      c.fillRect(x + 2, y + 2, T - 4, T - 4);
      c.fillStyle = th.wall;
      c.fillRect(x + 3, y + 3, T - 6, T - 6);
      ellipse(c, x + T / 2, y + T / 2, 10, 10, th.wallTop, 'rgba(0,0,0,0.5)');
      ellipse(c, x + T / 2, y + T / 2, 6, 6, 'rgba(255,255,255,0.06)');
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(x + T / 2, y + T / 2, 9, Math.PI * 1.05, Math.PI * 1.55);
      c.stroke();
    },

    // ---------- torches ----------

    torchGlow(ctx, L, t) {
      if (!L.torchList) return;
      const th = THEMES[L.act || 0];
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const tc of L.torchList) {
        const f = 0.85 + 0.15 * Math.sin(t * 9 + tc.seed) * Math.sin(t * 5.3 + tc.seed * 2);
        const rad = 78 * f;
        const g = ctx.createRadialGradient(tc.x, tc.y + 10, 2, tc.x, tc.y + 10, rad);
        g.addColorStop(0, `rgba(${th.torch},${0.2 * f})`);
        g.addColorStop(1, `rgba(${th.torch},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(tc.x - rad, tc.y + 10 - rad, rad * 2, rad * 2);
      }
      ctx.restore();
    },

    torches(ctx, L, t) {
      if (!L.torchList) return;
      for (const tc of L.torchList) {
        const fl = Math.sin(t * 14 + tc.seed) * 1.2;
        ctx.fillStyle = '#2a2622';
        ctx.fillRect(tc.x - 2, tc.y - 1, 4, 7);
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(tc.x - 3, tc.y - 3, 6, 3);
        ellipse(ctx, tc.x, tc.y - 7, 3.6, 6 + fl, 'rgba(255,140,40,0.9)');
        ellipse(ctx, tc.x, tc.y - 6, 2, 3.5 + fl * 0.5, '#ffe08a');
      }
    },

    // ---------- interactive pieces ----------

    links(ctx, L) {
      ctx.save();
      ctx.setLineDash([3, 6]);
      ctx.lineWidth = 1;
      for (const p of L.plates) {
        if (!p.group) continue;
        const d = L.doors[p.group];
        ctx.strokeStyle = d.color;
        ctx.globalAlpha = p.active ? 0.55 : 0.15;
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
        const cx = p.x;
        const cy = p.y;
        if (p.type === 'bell') {
          // bell on a timber frame
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(x + 4, y + 6, T - 6, T - 6);
          ctx.fillStyle = '#4a3624';
          ctx.fillRect(x + 3, y + 4, 3, T - 8);
          ctx.fillRect(x + T - 6, y + 4, 3, T - 8);
          ctx.fillRect(x + 3, y + 4, T - 6, 3);
          const swing = p.active ? Math.sin(t * 18) * 0.4 : 0;
          ctx.save();
          ctx.translate(cx, y + 7);
          ctx.rotate(swing);
          if (p.active) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 14;
          }
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(-7, 15);
          ctx.quadraticCurveTo(-7, 2, 0, 2);
          ctx.quadraticCurveTo(7, 2, 7, 15);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(-4, 5, 2, 8);
          ctx.fillStyle = '#6b4e1f';
          ctx.beginPath();
          ctx.arc(0, 16.5, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }
        ctx.save();
        // stone slab with a coloured rim; pressed plates sink and glow
        roundRect(ctx, x + 3, y + 3, T - 6, T - 6, 3);
        ctx.fillStyle = '#2a2f36';
        ctx.fill();
        if (p.active) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 12;
        }
        roundRect(ctx, x + 5, y + 5, T - 10, T - 10, 2);
        ctx.fillStyle = p.active ? color : '#1a1e24';
        ctx.globalAlpha = p.active ? 0.8 : 1;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        const ink = p.active ? '#101317' : color;
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
        } else if (door && door.twin) {
          ctx.beginPath();
          ctx.arc(cx - 3.5, cy, 2.5, 0, Math.PI * 2);
          ctx.arc(cx + 3.5, cy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(cx - 4, cy - 1, 8, 2);
        }
      }
    },

    // Portcullis-style doors: iron bars drop from the top, with a band in the
    // door's group colour.
    doors(ctx, L) {
      for (const d of Object.values(L.doors)) {
        const shut = 1 - d.anim;
        for (const tile of d.tiles) {
          const x = tile.c * T;
          const y = tile.r * T;
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(x, y, T, 3);
          ctx.strokeStyle = d.color;
          ctx.globalAlpha = 0.28;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
          ctx.globalAlpha = 1;
          if (shut <= 0.01) continue;
          const h = (T - 2) * shut;
          ctx.fillStyle = 'rgba(10,12,15,0.55)';
          ctx.fillRect(x + 1, y + 1, T - 2, h);
          ctx.fillStyle = '#3b4048';
          for (let i = 0; i < 5; i++) ctx.fillRect(x + 3 + i * 6, y + 1, 2.5, h);
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          for (let i = 0; i < 5; i++) ctx.fillRect(x + 3 + i * 6, y + 1, 1, h);
          ctx.fillStyle = d.color;
          ctx.fillRect(x + 1, y + 1 + h - 5, T - 2, 4);
          ctx.fillRect(x + 1, y + 1 + h * 0.4, T - 2, 2);
          if (d.twin && shut > 0.5) {
            ctx.strokeStyle = '#101317';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x + T / 2 - 2.5, y + h - 3, 2.5, 0, Math.PI * 2);
            ctx.moveTo(x + T / 2 + 5, y + h - 3);
            ctx.arc(x + T / 2 + 2.5, y + h - 3, 2.5, 0, Math.PI * 2);
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
        ctx.fillStyle = '#5f4329';
        ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let i = 1; i < 4; i++) ctx.fillRect(x + i * 7.5, y + 1, 1, T - 2);
        ctx.fillStyle = '#3d4249';
        ctx.fillRect(x + 1, y + 6, T - 2, 3);
        ctx.fillRect(x + 1, y + T - 9, T - 2, 3);
        lockIcon(ctx, x + T / 2, y + T / 2, 7, COL.gold);
      }
    },

    // Exits are stairwells with a green beacon.
    exits(ctx, L, t) {
      for (const e of L.exits) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3);
        const grad = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, 26 + pulse * 6);
        grad.addColorStop(0, `rgba(${COL.exit},0.55)`);
        grad.addColorStop(1, `rgba(${COL.exit},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(e.x - 34, e.y - 34, 68, 68);
        const x = e.c * T;
        const y = e.r * T;
        ctx.fillStyle = '#0c1410';
        ctx.fillRect(x + 3, y + 3, T - 6, T - 6);
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = `rgba(${COL.exit},${0.5 - i * 0.11})`;
          ctx.fillRect(x + 5, y + 6 + i * 5, T - 10, 2);
        }
        ctx.strokeStyle = `rgba(${COL.exit},0.9)`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 3.5, y + 3.5, T - 7, T - 7);
        ctx.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
          const a = t * 2 + i * Math.PI;
          ctx.beginPath();
          ctx.arc(e.x, e.y, 18, a, a + 1.1);
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
        ellipse(ctx, it.x, it.y + 9, 5, 2, 'rgba(0,0,0,0.35)');
        ctx.save();
        if (it.type === 'key') {
          ctx.shadowColor = COL.gold;
          ctx.shadowBlur = 10;
          keyIcon(ctx, x - 1, y, 8, COL.gold);
        } else {
          ctx.shadowColor = COL.shard;
          ctx.shadowBlur = 12;
          ctx.fillStyle = COL.shard;
          ctx.beginPath();
          ctx.moveTo(x, y - 8);
          ctx.lineTo(x + 6, y);
          ctx.lineTo(x, y + 8);
          ctx.lineTo(x - 6, y);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#e6f6ff';
          ctx.globalAlpha = 0.8;
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
        // warm lantern light at rest, orange while investigating, red as suspicion builds
        const alarmed = guard.state === 'investigate' || guard.state === 'wait';
        const s = guard.sus || 0;
        const base = alarmed ? [247, 130, 50] : [242, 190, 90];
        const rgb = base.map((v, i) => Math.round(v + ([229, 72, 77][i] - v) * s)).join(',');
        const grad = ctx.createRadialGradient(guard.x, guard.y, 0, guard.x, guard.y, C.VIEW_RANGE);
        grad.addColorStop(0, `rgba(${rgb},${0.26 + s * 0.2})`);
        grad.addColorStop(1, `rgba(${rgb},0.04)`);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = `rgba(${rgb},${0.28 + s * 0.4})`;
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
      ctx.strokeStyle = cl.strain > 0 ? 'rgba(229,72,77,0.9)' : active ? 'rgba(79,209,197,0.75)' : 'rgba(79,209,197,0.3)';
      ctx.beginPath();
      ctx.arc(cl.sx, cl.sy, C.CLONE_LEASH, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = active ? 'rgba(79,209,197,0.06)' : 'rgba(79,209,197,0.03)';
      ctx.fill();
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(79,209,197,0.35)';
      ctx.beginPath();
      ctx.moveTo(cl.sx, cl.sy);
      ctx.lineTo(cl.x, cl.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(79,209,197,0.7)';
      ctx.beginPath();
      ctx.arc(cl.sx, cl.sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    // ---------- characters (top-down; +x is the facing direction) ----------

    // The hooded ninja. The clone is the same figure rendered as teal smoke.
    ninja(ctx, e, isClone, t, g) {
      const ang = Math.atan2(e.face.y, e.face.x);
      const controlled = g.clone ? (isClone ? g.steering : !g.steering) : !isClone;
      if (controlled && g.clone) {
        ctx.save();
        ctx.strokeStyle = isClone ? 'rgba(79,209,197,0.9)' : 'rgba(236,232,223,0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + 9, 14 + Math.sin(t * 6) * 1.5, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = ctx.strokeStyle;
        const cy = e.y - 25 + Math.sin(t * 5) * 1.5;
        ctx.beginPath();
        ctx.moveTo(e.x - 5, cy - 3);
        ctx.lineTo(e.x + 5, cy - 3);
        ctx.lineTo(e.x, cy + 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      const P = isClone
        ? { body: '#1d6b65', edge: '#8ff3e8', dark: '#134a46', scarf: '#4fd1c5', skin: '#c9fbf5', blade: '#8ff3e8' }
        : { body: '#2a2f39', edge: '#0d1015', dark: '#1a1e25', scarf: '#d33a3f', skin: '#d8c3a5', blade: '#9aa1ab' };
      const swing = e.moving ? Math.sin((e.walkT || 0) * 14) : 0;
      ctx.save();
      ellipse(ctx, e.x + 2, e.y + 4, 11, 8, 'rgba(0,0,0,0.35)');
      ctx.translate(e.x, e.y);
      if (isClone) {
        let a = 0.72 + 0.08 * Math.sin(t * 8);
        if (e.life < 1 && Math.sin(t * 40) < 0) a *= 0.35;
        ctx.globalAlpha = a;
        ctx.shadowColor = COL.shadow;
        ctx.shadowBlur = 10;
      }
      ctx.rotate(ang);
      // feet
      ellipse(ctx, swing * 5, -4.5, 3.2, 2.3, P.dark);
      ellipse(ctx, -swing * 5, 4.5, 3.2, 2.3, P.dark);
      // scarf tails stream behind
      const sway = Math.sin(t * 9 + (isClone ? 1.5 : 0)) * 3;
      ctx.strokeStyle = P.scarf;
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-3, -1);
      ctx.quadraticCurveTo(-10, -2 + sway * 0.5, -16, -4 + sway);
      ctx.moveTo(-3, 1);
      ctx.quadraticCurveTo(-9, 2 + sway * 0.3, -13, 4 + sway * 0.8);
      ctx.stroke();
      // shoulders and arms
      ellipse(ctx, -1, 0, 7.5, 9.5, P.body, P.edge, 1.5);
      ellipse(ctx, -swing * 3 + 1, -9, 3, 3, P.dark, P.edge, 1);
      ellipse(ctx, swing * 3 + 1, 9, 3, 3, P.dark, P.edge, 1);
      // katana slung across the back
      ctx.strokeStyle = P.blade;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 7);
      ctx.lineTo(1, -6);
      ctx.stroke();
      ctx.strokeStyle = isClone ? P.edge : '#c9a227';
      ctx.beginPath();
      ctx.moveTo(-0.5, -7.5);
      ctx.lineTo(3, -4.5);
      ctx.stroke();
      ctx.strokeStyle = P.dark;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(1, -6);
      ctx.lineTo(4, -10);
      ctx.stroke();
      // hooded head, mask slit, eyes
      ellipse(ctx, 1.5, 0, 6, 6, P.dark, P.edge, 1.5);
      ctx.fillStyle = P.skin;
      ctx.fillRect(4.5, -3.2, 2, 6.4);
      ctx.fillStyle = isClone ? '#ffffff' : '#101317';
      ctx.fillRect(5, -2.4, 1.5, 1.4);
      ctx.fillRect(5, 1, 1.5, 1.4);
      ctx.strokeStyle = P.scarf;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(1.5, 0, 5.2, -2.1, 2.1, true);
      ctx.stroke();
      ctx.restore();

      if (isClone) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = e.life < 1 ? COL.danger : COL.shadow;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 16, -Math.PI / 2, -Math.PI / 2 + (e.life / C.CLONE_LIFETIME) * Math.PI * 2);
        ctx.stroke();
      }
    },

    guard(ctx, gd, t) {
      ctx.save();
      ctx.translate(gd.x, gd.y);
      if (gd.type === 'hound') this.hound(ctx, gd, t);
      else this.soldier(ctx, gd);
      ctx.restore();

      // Status above the head: detection meter while suspicious, otherwise
      // the usual ! / ? / z marks.
      const sus = gd.sus || 0;
      if (sus > 0 && !(gd.alert > 0)) {
        const x = gd.x;
        const y = gd.y - 27;
        ellipse(ctx, x, y, 9, 9, 'rgba(11,13,16,0.85)');
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
        text(ctx, mark, gd.x + (mark === 'z' ? 12 : 0), gd.y - 24 + bob, mark === 'z' ? 13 : 18, color, 'center', 800);
      }
    },

    // Armoured soldier: patrols carry a spear and a red plume, sentries a
    // halberd and bronze plate.
    soldier(ctx, gd) {
      const sentry = gd.type === 'sentry';
      const P = sentry
        ? { armor: '#7a6644', dark: '#3f3423', tabard: '#24406b', helm: '#b59d63', trim: '#e2c27a' }
        : { armor: '#66717f', dark: '#353c46', tabard: '#8f2d2d', helm: '#a2acb8', trim: '#d9dee5' };
      const swing = gd.moving ? Math.sin(gd.walkT * 11) : 0;
      ellipse(ctx, 2, 4, 13, 9, 'rgba(0,0,0,0.38)');
      ctx.rotate(gd.angle);
      ellipse(ctx, swing * 6, -5, 3.6, 2.6, '#1a1d22');
      ellipse(ctx, -swing * 6, 5, 3.6, 2.6, '#1a1d22');
      // weapon in the right hand
      ctx.strokeStyle = '#6b4a2b';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-11, 11);
      ctx.lineTo(sentry ? 19 : 22, 11);
      ctx.stroke();
      ctx.fillStyle = '#d4dae1';
      ctx.beginPath();
      if (sentry) {
        ctx.moveTo(14, 11);
        ctx.quadraticCurveTo(17, 3, 21, 5);
        ctx.lineTo(21, 11);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(19, 9.5);
        ctx.lineTo(26, 11);
        ctx.lineTo(19, 12.5);
      } else {
        ctx.moveTo(21, 8.5);
        ctx.lineTo(29, 11);
        ctx.lineTo(21, 13.5);
      }
      ctx.closePath();
      ctx.fill();
      // body: tabard over plate
      ellipse(ctx, -1, 0, 8.5, 11.5, P.tabard, '#0d1015', 1.5);
      ellipse(ctx, 1, 0, 5.5, 8, P.armor, P.dark, 1);
      ctx.fillStyle = P.trim;
      ctx.fillRect(-1, -0.75, 6, 1.5);
      // pauldrons, hands
      ellipse(ctx, 0, -10.5, 4.6, 4.2, P.helm, P.dark, 1.2);
      ellipse(ctx, 0, 10.5, 4.6, 4.2, P.helm, P.dark, 1.2);
      ellipse(ctx, 5 - swing * 2, 11, 2.3, 2.3, '#c9a98a');
      // lantern in the left hand
      ctx.save();
      ctx.shadowColor = '#ffcf70';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffd27a';
      ctx.fillRect(7, -15, 5, 5);
      ctx.restore();
      ctx.strokeStyle = '#2a2622';
      ctx.lineWidth = 1;
      ctx.strokeRect(7, -15, 5, 5);
      // helmet with ridge (and plume for patrols), visor slit
      ellipse(ctx, 1, 0, 6.6, 6.4, P.helm, P.dark, 1.4);
      ctx.strokeStyle = P.dark;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(7, 0);
      ctx.stroke();
      if (!sentry) ellipse(ctx, -4, 0, 5, 1.8, '#c0392b');
      ctx.fillStyle = '#101317';
      ctx.fillRect(5.6, -3, 1.4, 6);
    },

    hound(ctx, gd, t) {
      const awake = gd.state !== 'sleep';
      const gait = gd.moving ? Math.sin(gd.walkT * 18) : 0;
      ellipse(ctx, 2, 4, 16, 8, 'rgba(0,0,0,0.38)');
      ctx.rotate(gd.angle);
      for (const [lx, ly, ph] of [[7, -6, 1], [7, 6, -1], [-8, -6, -1], [-8, 6, 1]]) ellipse(ctx, lx + gait * 4 * ph, ly, 3.2, 2.2, '#3a2615');
      // tail
      ctx.strokeStyle = '#5a3d26';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.quadraticCurveTo(-17, 0, -21, Math.sin(t * (awake ? 14 : 2)) * (awake ? 5 : 1.5));
      ctx.stroke();
      ellipse(ctx, -1, 0, 13, 7.5, '#6a4a2e', '#24170c', 1.5);
      ellipse(ctx, -2, 0, 10, 2.4, '#4c331e');
      // spiked collar
      ctx.strokeStyle = '#26282c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, -5.5);
      ctx.lineTo(8, 5.5);
      ctx.stroke();
      ctx.fillStyle = '#c9ced6';
      for (const sy of [-4, 0, 4]) ctx.fillRect(7, sy - 0.75, 2, 1.5);
      // head, snout, ears
      ellipse(ctx, 12.5, 0, 6.5, 5.5, '#6a4a2e', '#24170c', 1.2);
      ellipse(ctx, 18, 0, 3.6, 3, '#4a3220');
      ellipse(ctx, 21, 0, 1.4, 1.4, '#0d0d0d');
      ctx.fillStyle = '#3a2615';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(10, s * 3);
        ctx.lineTo(6.5, s * 7.5);
        ctx.lineTo(12, s * 5.5);
        ctx.closePath();
        ctx.fill();
      }
      if (awake) {
        ctx.save();
        ctx.shadowColor = '#ff4d4d';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#ff5a4d';
        ctx.fillRect(14.5, -3, 1.8, 1.6);
        ctx.fillRect(14.5, 1.4, 1.8, 1.6);
        ctx.restore();
      } else {
        ctx.fillStyle = '#24170c';
        ctx.fillRect(14, -2.6, 2.2, 0.8);
        ctx.fillRect(14, 1.8, 2.2, 0.8);
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
      grad.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, C.W, C.H);
    },
  };

  SCE.Gfx = { COL, FONT, MONO, text, measure, roundRect, star, shardIcon, keyIcon, lockIcon };
  SCE.Render = R;
})();
