// Screens, HUD, menus and on-screen prompts. Everything is drawn on the canvas
// in logical 960x540 px. Interactive elements are registered on game.buttons
// each frame (with `focus` for list rows) so mouse, touch and keyboard/gamepad
// all drive the same menus.
(function () {
  const C = SCE.CFG;
  const T = C.TILE;
  const I = SCE.Input;
  const { COL, text, measure, roundRect, star, shardIcon, keyIcon, lockIcon } = SCE.Gfx;
  const ROW = 44;
  const pad2 = (n) => String(n).padStart(2, '0');
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeOutBack = (v) => 1 + 2.2 * Math.pow(v - 1, 3) + 1.2 * Math.pow(v - 1, 2);

  // Input glyphs follow whichever device was used last.
  const GLYPHS = {
    clone: { keyboard: 'SPACE', gamepad: 'A', touch: 'SHADOW' },
    confirm: { keyboard: 'ENTER', gamepad: 'A', touch: null },
    back: { keyboard: 'ESC', gamepad: 'B', touch: null },
    restart: { keyboard: 'R', gamepad: 'Y', touch: null },
    move: { keyboard: 'WASD', gamepad: 'L-STICK', touch: null },
    nav: { keyboard: '↑ ↓', gamepad: 'D-PAD', touch: null },
  };
  const glyph = (action) => GLYPHS[action][I.device];

  function keycap(ctx, label, x, y, size = 11, draw = true) {
    const round = I.device === 'gamepad' && label.length === 1;
    const h = size + 11;
    const w = round ? h : Math.max(h, measure(ctx, label, size, 700, { spacing: 0.5 }) + 14);
    if (!draw) return w;
    ctx.save();
    if (round) {
      ctx.beginPath();
      ctx.arc(x + w / 2, y, h / 2, 0, Math.PI * 2);
    } else roundRect(ctx, x, y - h / 2, w, h, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (!round) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 3, y + h / 2 - 2, w - 6, 1);
    }
    ctx.restore();
    text(ctx, label, x + w / 2, y + 0.5, size, COL.ink, 'center', 700, { spacing: 0.5 });
    return w;
  }

  // A keycap followed by a label. Returns the width used (0 if the current
  // device has no glyph for the action).
  function prompt(ctx, action, label, x, y, align = 'left', size = 11, color = COL.mute) {
    const g = glyph(action);
    if (!g) return 0;
    const kw = keycap(ctx, g, 0, 0, size, false);
    const lw = measure(ctx, label, size + 2, 600);
    const total = kw + 8 + lw;
    const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    keycap(ctx, g, x0, y, size);
    text(ctx, label, x0 + kw + 8, y, size + 2, color, 'left', 600);
    return total;
  }

  function wrap(ctx, str, maxW, size, weight = 500) {
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (measure(ctx, test, size, weight) > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function panel(ctx, x, y, w, h) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 30;
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = COL.panel;
    ctx.fill();
    ctx.restore();
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 8);
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function heading(ctx, str, x, y, size = 22, color = COL.ink, align = 'left') {
    text(ctx, str, x, y, size, color, align, 800, { spacing: 3 });
  }

  function kicker(ctx, str, x, y, color = COL.shadow, align = 'left') {
    text(ctx, str, x, y, 11, color, align, 700, { spacing: 3 });
  }

  // Vertical menu list. Sliders get ◀ ▶ hit zones of their own.
  function list(ctx, g, items, x, y, w) {
    items.forEach((it, i) => {
      const ry = y + i * ROW;
      const h = ROW - 6;
      const focused = g.focus === i;
      if (focused) {
        roundRect(ctx, x, ry, w, h, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fill();
        ctx.fillStyle = it.danger ? COL.danger : COL.shadow;
        ctx.fillRect(x, ry + 8, 3, h - 16);
      }
      const color = it.danger ? (focused ? '#f87171' : '#a35656') : focused ? COL.ink : COL.mute;
      text(ctx, it.label, x + 18, ry + h / 2, 16, color, 'left', focused ? 700 : 600);
      if (it.sub) {
        const lw = measure(ctx, it.label, 16, focused ? 700 : 600);
        text(ctx, it.sub, x + 18 + lw + 12, ry + h / 2 + 1, 12, COL.faint, 'left', 600, { maxWidth: w - lw - 50 });
      }
      if (it.value) {
        const v = it.value();
        text(ctx, v, x + w - 16, ry + h / 2, 14, v === 'On' ? COL.ink : COL.mute, 'right', 700, { spacing: 1 });
      }
      if (it.slider) {
        const v = it.slider();
        const segW = 9;
        const gap = 3;
        const bw = 10 * (segW + gap) - gap;
        const sx = x + w - 52 - bw;
        for (let s = 0; s < 10; s++) {
          ctx.fillStyle = s < v ? (focused ? COL.shadow : '#6a5fb3') : 'rgba(255,255,255,0.08)';
          ctx.fillRect(sx + s * (segW + gap), ry + h / 2 - 6, segW, 12);
        }
        text(ctx, String(v), x + w - 16, ry + h / 2, 13, COL.mute, 'right', 700, { mono: true });
        if (focused) {
          text(ctx, '◀', sx - 14, ry + h / 2, 10, COL.mute);
          text(ctx, '▶', sx + bw + 10, ry + h / 2, 10, COL.mute);
        }
        g.buttons.push({ x: sx - 30, y: ry, w: 30, h, focus: i, action: () => it.adjust(-1) });
        g.buttons.push({ x: sx + bw - 10, y: ry, w: 70, h, focus: i, action: () => it.adjust(1) });
      }
      g.buttons.push({ x, y: ry, w, h, focus: i, action: () => g.activate(it) });
    });
  }

  function navFooter(ctx, x, y, extra) {
    let dx = prompt(ctx, 'nav', 'Select', x, y);
    if (dx) dx += 20;
    dx += prompt(ctx, 'confirm', 'Confirm', x + dx, y);
    if (extra) prompt(ctx, 'back', extra, x + dx + 20, y);
  }

  const UI = {
    dim(ctx, a) {
      ctx.fillStyle = `rgba(5,6,9,${a})`;
      ctx.fillRect(0, 0, C.W, C.H);
    },

    menuBackdrop(ctx) {
      this.dim(ctx, 0.5);
      const grad = ctx.createLinearGradient(0, 0, 620, 0);
      grad.addColorStop(0, 'rgba(8,9,13,0.95)');
      grad.addColorStop(1, 'rgba(8,9,13,0.25)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, C.W, C.H);
    },

    // ---------------- title ----------------

    title(ctx, g) {
      const x = 72;
      kicker(ctx, 'A STEALTH PUZZLE', x, 104, COL.mute);
      text(ctx, 'SHADOW CLONE', x - 2, 148, 52, COL.ink, 'left', 900, { spacing: 2 });
      text(ctx, 'ESCAPE', x - 2, 200, 52, COL.shadow, 'left', 900, { spacing: 2 });
      ctx.fillStyle = COL.shadow;
      ctx.fillRect(x, 236, 48, 2);
      text(ctx, 'One shadow. Five seconds. Sixty to get out.', x, 260, 15, COL.mute, 'left', 500);

      list(ctx, g, g.menu().items, x - 18, 294, 380);

      if (I.device !== 'touch') navFooter(ctx, x, 506);
      const total = Object.values(g.save.levels).reduce((s, l) => s + (l.stars || 0), 0);
      star(ctx, C.W - 118, 506, 7, true);
      text(ctx, `${total} / ${SCE.LEVELS.length * 3}`, C.W - 104, 507, 13, COL.ink, 'left', 700, { mono: true });
      text(ctx, 'v1.1', C.W - 24, 507, 11, COL.faint, 'right', 600);
    },

    // ---------------- level select ----------------

    select(ctx, g) {
      heading(ctx, 'SELECT LEVEL', 76, 62, 24);
      const total = Object.values(g.save.levels).reduce((s, l) => s + (l.stars || 0), 0);
      star(ctx, C.W - 150, 62, 8, true);
      text(ctx, `${total} / ${SCE.LEVELS.length * 3}`, C.W - 136, 63, 14, COL.ink, 'left', 700, { mono: true });

      const cols = 4;
      const cw = 190;
      const ch = 94;
      const gap = 16;
      const ox = (C.W - (cols * cw + (cols - 1) * gap)) / 2;
      const oy = 100;
      SCE.LEVELS.forEach((def, i) => {
        const x = ox + (i % cols) * (cw + gap);
        const y = oy + Math.floor(i / cols) * (ch + gap);
        const unlocked = i < g.save.unlocked;
        const rec = g.save.levels[i];
        const selected = g.sel === i;
        roundRect(ctx, x, y, cw, ch, 6);
        ctx.fillStyle = !unlocked ? 'rgba(12,13,18,0.85)' : selected ? 'rgba(30,31,44,0.95)' : 'rgba(17,18,25,0.92)';
        ctx.fill();
        ctx.strokeStyle = selected ? COL.shadow : COL.line;
        ctx.lineWidth = selected ? 1.5 : 1;
        ctx.stroke();
        text(ctx, pad2(i + 1), x + 16, y + 20, 12, selected ? COL.shadow : COL.faint, 'left', 700, { mono: true });
        if (unlocked) {
          text(ctx, def.name, x + 16, y + 44, 16, COL.ink, 'left', 700, { maxWidth: cw - 32 });
          for (let s = 0; s < 3; s++) star(ctx, x + 24 + s * 20, y + 72, 7, rec && rec.stars > s);
          if (rec && rec.best !== undefined) text(ctx, `${rec.best.toFixed(1)}s`, x + cw - 16, y + 72, 12, COL.mute, 'right', 600, { mono: true });
          else if (!rec) {
            roundRect(ctx, x + cw - 50, y + 12, 36, 16, 8);
            ctx.fillStyle = 'rgba(157,140,255,0.16)';
            ctx.fill();
            text(ctx, 'NEW', x + cw - 32, y + 20.5, 9, COL.shadow, 'center', 800, { spacing: 1 });
          }
        } else {
          lockIcon(ctx, x + cw / 2, y + ch / 2 - 6, 9, COL.faint);
          text(ctx, 'LOCKED', x + cw / 2, y + ch / 2 + 18, 10, COL.faint, 'center', 700, { spacing: 2 });
        }
        g.buttons.push({
          x,
          y,
          w: cw,
          h: ch,
          sel: i,
          action: () => (unlocked ? g.startLevel(i) : SCE.Audio.play('denied')),
        });
      });

      const def = SCE.LEVELS[g.sel];
      const open = g.sel < g.save.unlocked;
      const fy = oy + 3 * (ch + gap) + 6;
      text(ctx, open ? def.hint : 'Clear the previous level to unlock this one.', C.W / 2, fy + 8, 13, COL.mute, 'center', 500, { maxWidth: 800 });

      // back button + prompts
      const by = 508;
      const bw = I.device === 'keyboard' || I.device === 'gamepad' ? prompt(ctx, 'back', 'Back', 76, by) : 0;
      if (!bw) {
        text(ctx, '‹  Back', 76, by, 14, COL.mute, 'left', 700);
      }
      g.buttons.push({ x: 60, y: by - 18, w: 120, h: 36, action: () => g.goTitle() });
      if (I.device !== 'touch') prompt(ctx, 'confirm', 'Play', C.W - 76, by, 'right');
    },

    // ---------------- settings / controls ----------------

    settings(ctx, g) {
      const items = g.menu().items;
      const w = 480;
      const h = 96 + items.length * ROW;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2;
      panel(ctx, x, y, w, h);
      heading(ctx, 'SETTINGS', x + 28, y + 40);
      list(ctx, g, items, x + 12, y + 72, w - 24);
    },

    controls(ctx, g) {
      const w = 760;
      const h = 452;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2;
      panel(ctx, x, y, w, h);
      heading(ctx, 'HOW TO PLAY', x + 28, y + 40);

      const cols = [x + 28, x + 220, x + 400, x + 560];
      const hy = y + 78;
      ['ACTION', 'KEYBOARD', 'GAMEPAD', 'TOUCH'].forEach((s, i) => kicker(ctx, s, cols[i], hy, COL.faint));
      const rows = [
        ['Move', 'WASD / Arrows', 'Left stick / D-pad', 'Drag anywhere'],
        ['Cast shadow / swap', 'Space or C', 'A', 'SHADOW button'],
        ['Pause', 'Esc or P', 'Start', 'Pause button'],
        ['Restart level', 'R', 'Y', 'Pause menu'],
        ['Mute', 'M', '—', 'Settings'],
      ];
      rows.forEach((r, i) => {
        const ry = hy + 28 + i * 26;
        r.forEach((s, j) => text(ctx, s, cols[j], ry, 13, j === 0 ? COL.ink : COL.mute, 'left', j === 0 ? 700 : 500));
      });
      ctx.fillStyle = COL.line;
      ctx.fillRect(x + 28, hy + 160, w - 56, 1);

      kicker(ctx, 'RULES', x + 28, hy + 184, COL.faint);
      const rules = [
        'Cast one shadow at a time. It lasts 5 seconds and can never stray more than 100px from where you cast it.',
        'Casting hands you control of the shadow; press the clone key again to swap back. The one you leave stands still.',
        'Your shadow presses plates, levers and bells, but it cannot pick up keys or shards.',
        'Guards ignore your shadow completely. They will see you — and bells your shadow rings will draw them away.',
        'Twin-lock doors open only while you and your shadow stand on both plates at the same moment.',
        'Escape within 60 seconds. Stars: escape · collect all 3 shards · finish with 20s or more left.',
      ];
      rules.forEach((s, i) => {
        const ry = hy + 208 + i * 21;
        ctx.fillStyle = COL.shadow;
        ctx.fillRect(x + 30, ry - 2, 4, 4);
        text(ctx, s, x + 44, ry, 13, COL.mute, 'left', 500, { maxWidth: w - 76 });
      });
      const items = g.menu().items;
      list(ctx, g, items, x + w - 160, y + 18, 140);
    },

    // ---------------- in-level ----------------

    hud(ctx, g) {
      const def = SCE.LEVELS[g.levelIndex];
      // top bar
      ctx.fillStyle = 'rgba(8,9,13,0.97)';
      ctx.fillRect(0, 0, C.W, 30);
      text(ctx, pad2(g.levelIndex + 1), 16, 15, 13, COL.shadow, 'left', 700, { mono: true });
      text(ctx, def.name.toUpperCase(), 44, 15, 12, COL.ink, 'left', 700, { spacing: 1.5 });

      // timer + draining bar; the ticks mark the 20s-left star threshold
      const low = g.timeLeft <= 10;
      const frac = g.timeLeft / C.LEVEL_TIME;
      const tColor = low ? (Math.sin(g.time * 10) > 0 ? '#f87171' : '#fecaca') : COL.ink;
      text(ctx, g.timeLeft.toFixed(1), C.W / 2, 14, 18, tColor, 'center', 800, { mono: true });
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, 28, C.W, 2);
      ctx.fillStyle = low ? COL.danger : g.timeLeft < C.STAR_TIME_LEFT ? COL.amber : 'rgba(235,233,243,0.35)';
      ctx.fillRect(C.W / 2 - (C.W / 2) * frac, 28, C.W * frac, 2);
      const tick = (C.W / 2) * (C.STAR_TIME_LEFT / C.LEVEL_TIME);
      ctx.fillStyle = COL.gold;
      ctx.fillRect(C.W / 2 - tick, 26, 1, 4);
      ctx.fillRect(C.W / 2 + tick, 26, 1, 4);

      // collectibles
      let rx = 890;
      for (let i = g.shardTotal - 1; i >= 0; i--) {
        shardIcon(ctx, rx, 15, 7, i < g.shards);
        rx -= 18;
      }
      if (g.keyTotal > 0) {
        rx -= 24;
        keyIcon(ctx, rx, 15, 7, g.keys > 0 ? COL.gold : COL.faint);
        text(ctx, `×${g.keys}`, rx + 12, 15.5, 12, g.keys > 0 ? COL.gold : COL.faint, 'left', 700, { mono: true });
      }
      // pause button
      if (g.state === 'play') {
        ctx.fillStyle = COL.mute;
        ctx.fillRect(926, 9, 3, 12);
        ctx.fillRect(933, 9, 3, 12);
        g.buttons.push({ x: 904, y: 0, w: 56, h: 40, action: () => g.pause() });
      }

      // bottom bar: shadow status + level hint
      const by = C.H - 15;
      ctx.fillStyle = 'rgba(8,9,13,0.97)';
      ctx.fillRect(0, C.H - 30, C.W, 30);
      let frac2 = 1;
      let status = 'READY';
      let sColor = COL.shadow;
      if (g.clone) {
        frac2 = g.clone.life / C.CLONE_LIFETIME;
        status = `${g.clone.life.toFixed(1)}s`;
        sColor = g.clone.life < 1 ? '#f472b6' : COL.shadow;
      } else if (g.cloneCooldown > 0) {
        frac2 = 1 - g.cloneCooldown / C.CLONE_COOLDOWN;
        status = 'RECHARGING';
        sColor = COL.mute;
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(26, by, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = sColor;
      ctx.beginPath();
      ctx.arc(26, by, 8, -Math.PI / 2, -Math.PI / 2 + frac2 * Math.PI * 2);
      ctx.stroke();
      text(ctx, 'SHADOW', 42, by, 11, COL.mute, 'left', 700, { spacing: 1.5 });
      text(ctx, status, 106, by, 12, sColor, 'left', 700, { mono: true });
      if (I.device !== 'touch') {
        const label = g.clone ? (g.steering ? 'Swap to you' : 'Swap to shadow') : 'Cast';
        prompt(ctx, 'clone', label, 196, by, 'left', 10);
      }
      text(ctx, def.hint, C.W - 16, by, 12, COL.faint, 'right', 500, { maxWidth: I.device === 'touch' ? 740 : 560 });
    },

    // "Move to begin" card shown until the first input; the clock is frozen.
    intro(ctx, g) {
      const def = SCE.LEVELS[g.levelIndex];
      ctx.fillStyle = 'rgba(5,6,9,0.55)';
      ctx.fillRect(0, 30, C.W, C.H - 60);
      const w = 540;
      const lines = wrap(ctx, def.hint, w - 80, 14);
      const h = 186 + lines.length * 20;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2;
      panel(ctx, x, y, w, h);
      kicker(ctx, `LEVEL ${pad2(g.levelIndex + 1)}`, C.W / 2, y + 34, COL.shadow, 'center');
      text(ctx, def.name, C.W / 2, y + 68, 30, COL.ink, 'center', 800, { spacing: 1 });
      lines.forEach((l, i) => text(ctx, l, C.W / 2, y + 104 + i * 20, 14, COL.mute, 'center', 500));

      // objectives
      const oy = y + 112 + lines.length * 20;
      const parts = [`${g.shardTotal} shards`, 'Reach the exit', `${C.LEVEL_TIME}s limit`];
      const pw = parts.map((s) => measure(ctx, s, 12, 600) + 26);
      let ox = C.W / 2 - (pw.reduce((a, b) => a + b, 0) + 24 * 2) / 2;
      parts.forEach((s, i) => {
        if (i === 0) shardIcon(ctx, ox + 6, oy, 6, true);
        else if (i === 1) {
          ctx.strokeStyle = `rgba(${COL.exit},0.9)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(ox + 6, oy, 5, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.strokeStyle = COL.mute;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(ox + 6, oy, 5, 0, Math.PI * 2);
          ctx.moveTo(ox + 6, oy - 3);
          ctx.lineTo(ox + 6, oy);
          ctx.lineTo(ox + 8.5, oy);
          ctx.stroke();
        }
        text(ctx, s, ox + 18, oy, 12, COL.ink, 'left', 600);
        ox += pw[i] + 24;
      });

      const rec = g.save.levels[g.levelIndex];
      if (rec) {
        for (let s = 0; s < 3; s++) star(ctx, x + w - 64 + s * 18, y + 34, 6, rec.stars > s);
      }

      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(g.time * 4) ** 2;
      if (I.device === 'touch') text(ctx, 'Drag to begin', C.W / 2, y + h - 30, 13, COL.ink, 'center', 700, { spacing: 1 });
      else prompt(ctx, 'move', 'Move to begin — the clock starts on your first step', C.W / 2, y + h - 30, 'center', 11, COL.ink);
      ctx.globalAlpha = 1;
    },

    // Contextual prompts above whoever you're controlling.
    prompts(ctx, g) {
      if (!g.settings.hints || g.state !== 'play') return;
      const p = g.player;
      let target = null;
      let label = null;
      if (g.steering) {
        target = g.clone;
        label = 'Swap to you';
      } else if (!g.clone && g.cloneCooldown <= 0) {
        const pc = Math.floor(p.x / T);
        const pr = Math.floor(p.y / T);
        const near = g.level.plates.some(
          (pl) => (pl.c === pc && pl.r === pr) || (!pl.active && Math.hypot(pl.x - p.x, pl.y - p.y) < C.CLONE_LEASH + 15)
        );
        if (near) {
          target = p;
          label = 'Cast shadow';
        }
      } else if (g.clone && g.levelIndex <= 2) {
        target = p;
        label = 'Swap to shadow';
      }
      if (!target) return;
      const gl = glyph('clone');
      const kw = keycap(ctx, gl, 0, 0, 10, false);
      const lw = measure(ctx, label, 12, 600);
      const w = kw + lw + 22;
      const x = Math.max(36, Math.min(C.W - 36 - w, target.x - w / 2));
      const y = Math.max(46, target.y - 40);
      roundRect(ctx, x, y - 13, w, 26, 13);
      ctx.fillStyle = 'rgba(8,9,13,0.85)';
      ctx.fill();
      keycap(ctx, gl, x + 6, y, 10);
      text(ctx, label, x + kw + 14, y, 12, COL.ink, 'left', 600);
    },

    touch(ctx, g) {
      if (!I.touchEnabled || !g.started) return;
      ctx.save();
      const st = I.stick;
      const sx = st ? st.ox : 130;
      const sy = st ? st.oy : C.H - 120;
      ctx.globalAlpha = st ? 1 : 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      let kx = sx;
      let ky = sy;
      if (st) {
        const dx = st.x - st.ox;
        const dy = st.y - st.oy;
        const d = Math.hypot(dx, dy) || 1;
        const m = Math.min(d, 40);
        kx += (dx / d) * m;
        ky += (dy / d) * m;
      }
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(kx, ky, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // clone button with lifetime / recharge ring
      const b = C.TOUCH_CLONE;
      const down = I.cloneTouch !== null;
      ctx.fillStyle = down ? 'rgba(91,71,214,0.6)' : 'rgba(91,71,214,0.32)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      let frac = 1;
      let label = 'CAST';
      if (g.clone) {
        frac = g.clone.life / C.CLONE_LIFETIME;
        label = 'SWAP';
      } else if (g.cloneCooldown > 0) {
        frac = 1 - g.cloneCooldown / C.CLONE_COOLDOWN;
        label = '···';
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = COL.shadow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 4, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
      text(ctx, 'SHADOW', b.x, b.y - 9, 9, 'rgba(255,255,255,0.7)', 'center', 700, { spacing: 1.5 });
      text(ctx, label, b.x, b.y + 8, 15, '#fff', 'center', 800, { spacing: 1 });
      ctx.restore();
    },

    // ---------------- overlays ----------------

    paused(ctx, g) {
      this.dim(ctx, 0.72);
      const items = g.menu().items;
      const w = 400;
      const h = 132 + items.length * ROW;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2;
      panel(ctx, x, y, w, h);
      kicker(ctx, `LEVEL ${pad2(g.levelIndex + 1)} · ${SCE.LEVELS[g.levelIndex].name.toUpperCase()}`, x + 28, y + 30, COL.mute);
      heading(ctx, 'PAUSED', x + 28, y + 60, 26);
      list(ctx, g, items, x + 12, y + 88, w - 24);
      text(ctx, `${g.timeLeft.toFixed(1)}s left  ·  Sound ${SCE.Audio.muted ? 'off' : 'on'} (M)`, C.W / 2, y + h - 20, 12, COL.faint, 'center', 500);
    },

    won(ctx, g) {
      const r = g.result;
      const a = clamp01(r.t / 0.3);
      this.dim(ctx, 0.72 * a);
      ctx.globalAlpha = a;
      const items = g.menu().items;
      const last = g.levelIndex + 1 >= SCE.LEVELS.length;
      const w = 460;
      const h = 270 + items.length * ROW;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2 + (1 - a) * 12;
      panel(ctx, x, y, w, h);
      kicker(ctx, last ? 'FORTRESS ESCAPED' : 'LEVEL CLEAR', C.W / 2, y + 32, `rgb(${COL.exit})`, 'center');
      text(ctx, SCE.LEVELS[g.levelIndex].name, C.W / 2, y + 62, 26, COL.ink, 'center', 800, { spacing: 1 });

      for (let i = 0; i < 3; i++) {
        const t0 = 0.45 + i * 0.28;
        const k = clamp01((r.t - t0) / 0.3);
        const lit = r.stars[i] && k > 0;
        star(ctx, C.W / 2 - 56 + i * 56, y + 110, 20, lit, lit ? easeOutBack(k) : 1);
      }

      const crit = [
        ['Escape the level', r.stars[0]],
        [`Collect every shard  ${g.shards}/${g.shardTotal}`, r.stars[1]],
        [`${C.STAR_TIME_LEFT}s or more left  ${g.timeLeft.toFixed(1)}s`, r.stars[2]],
      ];
      crit.forEach(([s, ok], i) => {
        const cy = y + 152 + i * 22;
        ctx.fillStyle = ok ? COL.gold : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(x + 112, cy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        text(ctx, s, x + 124, cy, 13, ok ? COL.ink : COL.faint, 'left', 500);
      });
      const ty = y + 230;
      text(ctx, `TIME  ${r.used.toFixed(1)}s`, C.W / 2 - (r.newBest ? 40 : 0), ty, 14, COL.ink, 'center', 700, { mono: true });
      if (r.newBest) {
        roundRect(ctx, C.W / 2 + 34, ty - 9, 74, 18, 9);
        ctx.fillStyle = 'rgba(245,196,81,0.16)';
        ctx.fill();
        text(ctx, 'NEW BEST', C.W / 2 + 71, ty + 0.5, 9, COL.gold, 'center', 800, { spacing: 1 });
      }
      list(ctx, g, items, x + 40, y + 252, w - 80);
      ctx.globalAlpha = 1;
    },

    failed(ctx, g) {
      const r = g.result;
      const a = clamp01(r.t / 0.35);
      ctx.fillStyle = `rgba(40,4,8,${0.35 * a})`;
      ctx.fillRect(0, 0, C.W, C.H);
      this.dim(ctx, 0.55 * a);
      ctx.globalAlpha = a;
      const items = g.menu().items;
      const w = 500;
      const lines = wrap(ctx, r.text, w - 60, 14);
      const ly = 112 + lines.length * 19;
      const h = ly + 54 + items.length * ROW;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2 + (1 - a) * 12;
      panel(ctx, x, y, w, h);
      ctx.fillStyle = COL.danger;
      ctx.fillRect(x, y + 1, w, 2);
      text(ctx, r.title, C.W / 2, y + 50, 32, '#f87171', 'center', 900, { spacing: 4 });
      lines.forEach((l, i) => text(ctx, l, C.W / 2, y + 90 + i * 19, 14, COL.mute, 'center', 500));
      list(ctx, g, items, x + 50, y + ly, w - 100);
      if (I.device !== 'touch') prompt(ctx, 'restart', 'Instant retry', C.W / 2, y + h - 22, 'center', 10, COL.faint);
      ctx.globalAlpha = 1;
    },

    toast(ctx, g) {
      const m = g.toastMsg;
      if (!m) return;
      ctx.globalAlpha = clamp01(m.life / 0.3);
      const w = measure(ctx, m.str, 13, 600) + 32;
      roundRect(ctx, (C.W - w) / 2, 42, w, 28, 14);
      ctx.fillStyle = 'rgba(20,21,30,0.95)';
      ctx.fill();
      ctx.strokeStyle = COL.line;
      ctx.stroke();
      text(ctx, m.str, C.W / 2, 56.5, 13, COL.ink, 'center', 600);
      ctx.globalAlpha = 1;
    },
  };

  SCE.UI = UI;
})();
