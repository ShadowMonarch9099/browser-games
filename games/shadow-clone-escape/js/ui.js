// Screens, HUD, menus and on-screen prompts. Everything is drawn on the canvas
// in logical 960x540 px. Interactive elements are registered on game.buttons
// each frame (with `focus` for list rows) so mouse, touch and keyboard/gamepad
// all drive the same menus. Entrance animations run off game.stateT.
(function () {
  const C = SCE.CFG;
  const T = C.TILE;
  const I = SCE.Input;
  const { COL, text, measure, roundRect, star, shardIcon, keyIcon, lockIcon } = SCE.Gfx;
  const ROW = 36;
  const ROMAN = ['I', 'II', 'III'];
  const pad2 = (n) => String(n).padStart(2, '0');
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeOut = (v) => 1 - Math.pow(1 - v, 3);
  const easeOutBack = (v) => 1 + 2.2 * Math.pow(v - 1, 3) + 1.2 * Math.pow(v - 1, 2);
  const enter = (g, delay = 0, dur = 0.22) => easeOut(clamp01(((g.stateT || 0) - delay) / dur));

  // Input glyphs follow whichever device was used last.
  const GLYPHS = {
    clone: { keyboard: 'SPACE', gamepad: 'A', touch: 'SHADOW' },
    confirm: { keyboard: 'ENTER', gamepad: 'A', touch: null },
    back: { keyboard: 'ESC', gamepad: 'B', touch: null },
    restart: { keyboard: 'R', gamepad: 'Y', touch: null },
    pause: { keyboard: 'ESC', gamepad: 'START', touch: null },
    hint: { keyboard: 'H', gamepad: 'B', touch: null },
    move: { keyboard: 'WASD', gamepad: 'L-STICK', touch: null },
    nav: { keyboard: '↑ ↓', gamepad: 'D-PAD', touch: null },
  };
  const glyph = (action) => GLYPHS[action][I.device];

  function keycap(ctx, label, x, y, size = 10, draw = true) {
    const round = I.device === 'gamepad' && label.length === 1;
    const h = size + 10;
    const w = round ? h : Math.max(h, measure(ctx, label, size, 700, { spacing: 0.5 }) + 12);
    if (!draw) return w;
    ctx.save();
    if (round) {
      ctx.beginPath();
      ctx.arc(x + w / 2, y, h / 2, 0, Math.PI * 2);
    } else roundRect(ctx, x, y - h / 2, w, h, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (!round) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(x + 3, y + h / 2 - 2, w - 6, 1);
    }
    ctx.restore();
    text(ctx, label, x + w / 2, y + 0.5, size, COL.ink, 'center', 700, { spacing: 0.5 });
    return w;
  }

  // A keycap followed by a label. Returns the width used (0 if the current
  // device has no glyph for the action).
  function prompt(ctx, action, label, x, y, align = 'left', size = 10, color = COL.mute) {
    const gl = glyph(action);
    if (!gl) return 0;
    const kw = keycap(ctx, gl, 0, 0, size, false);
    const lw = measure(ctx, label, size + 2, 600);
    const total = kw + 7 + lw;
    const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    keycap(ctx, gl, x0, y, size);
    text(ctx, label, x0 + kw + 7, y, size + 2, color, 'left', 600);
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
    // layered offset shadow (cheap; a blurred shadow this size costs a frame)
    roundRect(ctx, x - 6, y + 2, w + 12, h + 14, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();
    roundRect(ctx, x - 2, y + 2, w + 4, h + 6, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = COL.panel;
    ctx.fill();
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 8);
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(224,168,62,0.5)';
    ctx.fillRect(x + 20, y, 28, 2);
  }

  // Scale-and-fade a block in when its screen opens.
  function popIn(ctx, g, cx, cy, fn) {
    const k = enter(g, 0, 0.2);
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.translate(cx, cy);
    const s = 0.96 + 0.04 * k;
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
    fn();
    ctx.restore();
  }

  function heading(ctx, str, x, y, size = 20, color = COL.ink, align = 'left') {
    text(ctx, str, x, y, size, color, align, 800, { spacing: 2.5 });
  }

  function kicker(ctx, str, x, y, color = COL.accent, align = 'left') {
    text(ctx, str, x, y, 10, color, align, 700, { spacing: 2.5 });
  }

  // Vertical menu list with a sliding highlight, staggered entrance and
  // ◀ ▶ hit zones for sliders.
  const hl = { key: null, y: 0 };
  function list(ctx, g, items, x, y, w) {
    const h = ROW - 6;
    const key = `${g.state}:${items.length}:${x}`;
    const target = y + g.focus * ROW;
    if (hl.key !== key) {
      hl.key = key;
      hl.y = target;
    } else hl.y += (target - hl.y) * 0.32;
    const focusedItem = items[g.focus];
    if (focusedItem) {
      roundRect(ctx, x, hl.y, w, h, 4);
      ctx.fillStyle = g.pulse > 0 ? `rgba(224,168,62,${0.12 + g.pulse})` : 'rgba(255,255,255,0.055)';
      ctx.fill();
      ctx.fillStyle = focusedItem.danger ? COL.danger : COL.accent;
      ctx.fillRect(x, hl.y + 7, 2.5, h - 14);
    }
    items.forEach((it, i) => {
      const k = enter(g, 0.04 + i * 0.035);
      const ry = y + i * ROW;
      const focused = g.focus === i;
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.translate((1 - k) * 14, 0);
      const color = it.danger ? (focused ? '#f07a7d' : '#9b5355') : focused ? COL.ink : COL.mute;
      text(ctx, it.label, x + 16, ry + h / 2, 14, color, 'left', focused ? 700 : 600);
      if (it.sub) {
        const lw = measure(ctx, it.label, 14, focused ? 700 : 600);
        text(ctx, it.sub, x + 16 + lw + 10, ry + h / 2 + 1, 11, COL.faint, 'left', 600, { maxWidth: w - lw - 46 });
      }
      if (it.value) {
        const v = it.value();
        text(ctx, v, x + w - 14, ry + h / 2, 12, v === 'On' ? COL.accent : COL.mute, 'right', 700, { spacing: 1 });
      }
      if (it.slider) {
        const v = it.slider();
        const segW = 7;
        const gap = 3;
        const bw = 10 * (segW + gap) - gap;
        const sx = x + w - 48 - bw;
        for (let s = 0; s < 10; s++) {
          ctx.fillStyle = s < v ? (focused ? COL.accent : '#8c6e33') : 'rgba(255,255,255,0.08)';
          ctx.fillRect(sx + s * (segW + gap), ry + h / 2 - 5, segW, 10);
        }
        text(ctx, String(v), x + w - 14, ry + h / 2, 12, COL.mute, 'right', 700, { mono: true });
        if (focused) {
          text(ctx, '◀', sx - 12, ry + h / 2, 9, COL.mute);
          text(ctx, '▶', sx + bw + 10, ry + h / 2, 9, COL.mute);
        }
        g.buttons.push({ x: sx - 26, y: ry, w: 26, h, focus: i, action: () => it.adjust(-1) });
        g.buttons.push({ x: sx + bw - 10, y: ry, w: 60, h, focus: i, action: () => it.adjust(1) });
      } else if (focused && !it.value) {
        text(ctx, '›', x + w - 14 - (1 - Math.min(1, (g.stateT || 0) * 6)) * 6, ry + h / 2 - 1, 16, COL.accent, 'right', 700);
      }
      ctx.restore();
      g.buttons.push({ x, y: ry, w, h, focus: i, action: () => g.activate(it) });
    });
  }

  function navFooter(ctx, x, y, extra) {
    let dx = prompt(ctx, 'nav', 'Select', x, y);
    if (dx) dx += 18;
    dx += prompt(ctx, 'confirm', 'Confirm', x + dx, y);
    if (extra) prompt(ctx, 'back', extra, x + dx + 18, y);
  }

  const UI = {
    dim(ctx, a) {
      ctx.fillStyle = `rgba(6,7,9,${a})`;
      ctx.fillRect(0, 0, C.W, C.H);
    },

    // ---------------- title ----------------

    title(ctx, g) {
      const x = 72;
      const k = enter(g, 0, 0.5);
      ctx.save();
      ctx.globalAlpha = k;
      kicker(ctx, 'A STEALTH PUZZLE', x, 118, COL.mute);
      text(ctx, 'SHADOW CLONE', x - 2, 156, 44, COL.ink, 'left', 900, { spacing: 2 });
      text(ctx, 'ESCAPE', x - 2, 200, 44, COL.shadow, 'left', 900, { spacing: 2 });
      // the clone's afterimage behind the word
      ctx.globalAlpha = k * (0.18 + 0.06 * Math.sin(g.time * 2));
      text(ctx, 'ESCAPE', x + 2 + Math.sin(g.time * 1.3) * 3, 203, 44, COL.shadow, 'left', 900, { spacing: 2 });
      ctx.globalAlpha = k;
      ctx.fillStyle = COL.accent;
      ctx.fillRect(x, 232, 40 * k, 2);
      text(ctx, 'One shadow. Five seconds. Sixty to get out.', x, 254, 13, COL.mute, 'left', 500);
      ctx.restore();

      list(ctx, g, g.menu().items, x - 16, 286, 300);

      if (I.device !== 'touch') navFooter(ctx, x, 508);
      const total = Object.values(g.save.levels).reduce((s, l) => s + (l.stars || 0), 0);
      star(ctx, C.W - 112, 508, 6.5, true);
      text(ctx, `${total} / ${SCE.LEVELS.length * 3}`, C.W - 100, 509, 12, COL.ink, 'left', 700, { mono: true });
      text(ctx, 'v1.2', C.W - 24, 509, 10, COL.faint, 'right', 600);
    },

    // ---------------- level select (one row per act) ----------------

    select(ctx, g) {
      heading(ctx, 'SELECT LEVEL', 76, 52, 20);
      const total = Object.values(g.save.levels).reduce((s, l) => s + (l.stars || 0), 0);
      star(ctx, C.W - 140, 52, 7, true);
      text(ctx, `${total} / ${SCE.LEVELS.length * 3}`, C.W - 127, 53, 13, COL.ink, 'left', 700, { mono: true });

      const cols = 4;
      const cw = 190;
      const ch = 78;
      const gap = 14;
      const rowH = ch + 34;
      const ox = (C.W - (cols * cw + (cols - 1) * gap)) / 2;
      const oy = 102;
      for (let a = 0; a < 3; a++) {
        const ka = enter(g, a * 0.06);
        ctx.globalAlpha = ka;
        kicker(ctx, `ACT ${ROMAN[a]} — ${C.ACTS[a].toUpperCase()}`, ox, oy + a * rowH - 12, a === Math.floor(g.sel / 4) ? COL.accent : COL.faint);
        ctx.globalAlpha = 1;
      }
      SCE.LEVELS.forEach((def, i) => {
        const k = enter(g, 0.05 + i * 0.025);
        const sel = g.sel === i;
        const x = ox + (i % cols) * (cw + gap);
        const y = oy + Math.floor(i / cols) * rowH + (1 - k) * 10 - (sel ? 2 : 0);
        const unlocked = i < g.save.unlocked;
        const rec = g.save.levels[i];
        ctx.save();
        ctx.globalAlpha = k;
        roundRect(ctx, x, y, cw, ch, 6);
        ctx.fillStyle = !unlocked ? 'rgba(14,15,18,0.85)' : sel ? 'rgba(34,32,28,0.96)' : 'rgba(20,22,26,0.92)';
        ctx.fill();
        ctx.strokeStyle = sel ? COL.accent : COL.line;
        ctx.lineWidth = sel ? 1.5 : 1;
        ctx.stroke();
        text(ctx, pad2(i + 1), x + 14, y + 17, 11, sel ? COL.accent : COL.faint, 'left', 700, { mono: true });
        if (unlocked) {
          text(ctx, def.name, x + 14, y + 38, 14, COL.ink, 'left', 700, { maxWidth: cw - 28 });
          for (let s = 0; s < 3; s++) star(ctx, x + 21 + s * 18, y + 60, 6, rec && rec.stars > s);
          if (rec && rec.best !== undefined) text(ctx, `${rec.best.toFixed(1)}s`, x + cw - 14, y + 60, 11, COL.mute, 'right', 600, { mono: true });
          else if (!rec) {
            roundRect(ctx, x + cw - 46, y + 9, 32, 15, 7.5);
            ctx.fillStyle = 'rgba(224,168,62,0.16)';
            ctx.fill();
            text(ctx, 'NEW', x + cw - 30, y + 17, 8, COL.accent, 'center', 800, { spacing: 1 });
          }
        } else {
          lockIcon(ctx, x + cw / 2, y + ch / 2 - 4, 8, COL.faint);
          text(ctx, 'LOCKED', x + cw / 2, y + ch / 2 + 16, 9, COL.faint, 'center', 700, { spacing: 2 });
        }
        ctx.restore();
        g.buttons.push({ x, y, w: cw, h: ch, sel: i, action: () => (unlocked ? g.startLevel(i) : SCE.Audio.play('denied')) });
      });

      const by = 512;
      const bw = I.device === 'keyboard' || I.device === 'gamepad' ? prompt(ctx, 'back', 'Back', 76, by) : 0;
      if (!bw) text(ctx, '‹  Back', 76, by, 13, COL.mute, 'left', 700);
      g.buttons.push({ x: 60, y: by - 18, w: 120, h: 36, action: () => g.goTitle() });
      if (I.device !== 'touch') prompt(ctx, 'confirm', 'Play', C.W - 76, by, 'right');
    },

    // ---------------- settings / controls ----------------

    settings(ctx, g) {
      const items = g.menu().items;
      const w = 420;
      const h = 82 + items.length * ROW;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2;
      popIn(ctx, g, C.W / 2, C.H / 2, () => {
        panel(ctx, x, y, w, h);
        heading(ctx, 'SETTINGS', x + 26, y + 36);
        list(ctx, g, items, x + 10, y + 60, w - 20);
      });
    },

    controls(ctx, g) {
      const w = 720;
      const h = 430;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2;
      popIn(ctx, g, C.W / 2, C.H / 2, () => {
        panel(ctx, x, y, w, h);
        heading(ctx, 'HOW TO PLAY', x + 26, y + 36);
        const cols = [x + 26, x + 210, x + 380, x + 540];
        const hy = y + 70;
        ['ACTION', 'KEYBOARD', 'GAMEPAD', 'TOUCH'].forEach((s, i) => kicker(ctx, s, cols[i], hy, COL.faint));
        const rows = [
          ['Move', 'WASD / Arrows', 'Left stick / D-pad', 'Drag anywhere'],
          ['Cast shadow / swap', 'Space or C', 'A', 'SHADOW button'],
          ['Show hint', 'H', 'B', 'HINT button'],
          ['Pause', 'Esc or P', 'Start', 'Pause button'],
          ['Restart level', 'R', 'Y', 'Pause menu'],
          ['Mute', 'M', '—', 'Settings'],
        ];
        rows.forEach((r, i) => {
          const ry = hy + 24 + i * 22;
          r.forEach((s, j) => text(ctx, s, cols[j], ry, 12, j === 0 ? COL.ink : COL.mute, 'left', j === 0 ? 700 : 500));
        });
        ctx.fillStyle = COL.line;
        ctx.fillRect(x + 26, hy + 162, w - 52, 1);
        kicker(ctx, 'RULES', x + 26, hy + 182, COL.faint);
        const rules = [
          'Cast one shadow at a time. It lasts 5 seconds and can never stray more than 100px from where you cast it.',
          'Casting hands you control of the shadow; press the clone key again to swap back. The one you leave stands still.',
          'Your shadow presses plates, levers and bells, but it cannot pick up keys or shards.',
          'Guards ignore your shadow completely — but a bell it rings will draw them away from their post.',
          'Twin-lock doors open only while you and your shadow stand on both plates at the same moment.',
          'The 60-second clock starts on your first move. Stars: escape · all 3 shards · 20s or more left.',
        ];
        rules.forEach((s, i) => {
          const ry = hy + 204 + i * 20;
          ctx.fillStyle = COL.accent;
          ctx.fillRect(x + 28, ry - 2, 4, 4);
          text(ctx, s, x + 40, ry, 12, COL.mute, 'left', 500, { maxWidth: w - 70 });
        });
        list(ctx, g, g.menu().items, x + w - 140, y + 18, 120);
      });
    },

    // ---------------- in-level ----------------

    hud(ctx, g) {
      const def = SCE.LEVELS[g.levelIndex];
      ctx.fillStyle = 'rgba(11,13,16,0.97)';
      ctx.fillRect(0, 0, C.W, 30);
      text(ctx, pad2(g.levelIndex + 1), 16, 15, 12, COL.accent, 'left', 700, { mono: true });
      text(ctx, def.name.toUpperCase(), 40, 15, 11, COL.ink, 'left', 700, { spacing: 1.5 });

      // timer + draining bar; the ticks mark the 20s-left star threshold
      const low = g.timeLeft <= 10;
      const frac = g.timeLeft / C.LEVEL_TIME;
      const tColor = !g.started ? COL.mute : low ? (Math.sin(g.time * 10) > 0 ? '#f07a7d' : '#fbd0d1') : COL.ink;
      text(ctx, g.timeLeft.toFixed(1), C.W / 2, 14, 17, tColor, 'center', 800, { mono: true });
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, 28, C.W, 2);
      ctx.fillStyle = low ? COL.danger : g.timeLeft < C.STAR_TIME_LEFT ? COL.amber : 'rgba(236,232,223,0.35)';
      ctx.fillRect(C.W / 2 - (C.W / 2) * frac, 28, C.W * frac, 2);
      const tick = (C.W / 2) * (C.STAR_TIME_LEFT / C.LEVEL_TIME);
      ctx.fillStyle = COL.gold;
      ctx.fillRect(C.W / 2 - tick, 26, 1, 4);
      ctx.fillRect(C.W / 2 + tick, 26, 1, 4);

      // right cluster: hint button, key, shards, pause
      let rx = 888;
      for (let i = g.shardTotal - 1; i >= 0; i--) {
        shardIcon(ctx, rx, 15, 6.5, i < g.shards);
        rx -= 17;
      }
      if (g.keyTotal > 0) {
        rx -= 22;
        keyIcon(ctx, rx, 15, 6.5, g.keys > 0 ? COL.gold : COL.faint);
        text(ctx, `×${g.keys}`, rx + 10, 15.5, 11, g.keys > 0 ? COL.gold : COL.faint, 'left', 700, { mono: true });
        rx -= 14;
      }
      if (g.state === 'play') {
        const hw = 58;
        const hx = rx - hw - 18;
        roundRect(ctx, hx, 6, hw, 18, 9);
        ctx.fillStyle = g.hintOpen ? 'rgba(224,168,62,0.22)' : 'rgba(255,255,255,0.06)';
        ctx.fill();
        ctx.strokeStyle = g.hintOpen ? COL.accent : 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
        text(ctx, '?', hx + 12, 15.5, 11, COL.accent, 'center', 800);
        text(ctx, 'HINT', hx + 36, 15.5, 9.5, g.hintOpen ? COL.ink : COL.mute, 'center', 700, { spacing: 1.2 });
        g.buttons.push({ x: hx - 4, y: 0, w: hw + 8, h: 34, action: () => g.toggleHint() });

        ctx.fillStyle = COL.mute;
        ctx.fillRect(926, 9, 3, 12);
        ctx.fillRect(933, 9, 3, 12);
        g.buttons.push({ x: 904, y: 0, w: 56, h: 40, action: () => g.pause() });
      }

      // bottom bar: shadow status + control reminders
      const by = C.H - 15;
      ctx.fillStyle = 'rgba(11,13,16,0.97)';
      ctx.fillRect(0, C.H - 30, C.W, 30);
      let frac2 = 1;
      let status = 'READY';
      let sColor = COL.shadow;
      if (g.clone) {
        frac2 = g.clone.life / C.CLONE_LIFETIME;
        status = `${g.clone.life.toFixed(1)}s`;
        sColor = g.clone.life < 1 ? COL.danger : COL.shadow;
      } else if (g.cloneCooldown > 0) {
        frac2 = 1 - g.cloneCooldown / C.CLONE_COOLDOWN;
        status = 'RECHARGING';
        sColor = COL.mute;
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(24, by, 7.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = sColor;
      ctx.beginPath();
      ctx.arc(24, by, 7.5, -Math.PI / 2, -Math.PI / 2 + frac2 * Math.PI * 2);
      ctx.stroke();
      text(ctx, 'SHADOW', 40, by, 10, COL.mute, 'left', 700, { spacing: 1.5 });
      text(ctx, status, 98, by, 11, sColor, 'left', 700, { mono: true });
      if (I.device !== 'touch') {
        const label = g.clone ? (g.steering ? 'Swap to you' : 'Swap to shadow') : 'Cast';
        prompt(ctx, 'clone', label, 186, by);
        let rx2 = C.W - 16;
        rx2 -= prompt(ctx, 'pause', 'Pause', rx2, by, 'right') + 16;
        rx2 -= prompt(ctx, 'restart', 'Restart', rx2, by, 'right') + 16;
        prompt(ctx, 'hint', 'Hint', rx2, by, 'right');
      } else text(ctx, `ACT ${ROMAN[g.level.act]} — ${C.ACTS[g.level.act].toUpperCase()}`, C.W - 16, by, 9.5, COL.faint, 'right', 700, { spacing: 2 });
    },

    // Shown until the first WASD/arrow or clone-key press; the clock is frozen.
    ready(ctx, g) {
      const k = enter(g, 0.1, 0.35);
      ctx.save();
      ctx.globalAlpha = k;
      // level banner under the top bar
      const label = `LEVEL ${pad2(g.levelIndex + 1)}  ·  ${SCE.LEVELS[g.levelIndex].name.toUpperCase()}`;
      const bw = measure(ctx, label, 11, 700, { spacing: 2.5 }) + 40;
      roundRect(ctx, (C.W - bw) / 2, 40 + (1 - k) * -8, bw, 26, 13);
      ctx.fillStyle = 'rgba(11,13,16,0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(224,168,62,0.4)';
      ctx.stroke();
      text(ctx, label, C.W / 2, 53.5 + (1 - k) * -8, 11, COL.accent, 'center', 700, { spacing: 2.5 });

      // start prompt
      const y = C.H - 62;
      const pulse = 0.65 + 0.35 * Math.sin(g.time * 4) ** 2;
      let str;
      let w;
      if (I.device === 'touch') {
        str = 'Drag to move or tap SHADOW to start';
        w = measure(ctx, str, 13, 600) + 36;
      } else {
        const a = keycap(ctx, glyph('move'), 0, 0, 10, false);
        const b = keycap(ctx, glyph('clone'), 0, 0, 10, false);
        w = 36 + measure(ctx, 'Press', 13, 600) + a + measure(ctx, 'or', 13, 600) + b + measure(ctx, 'to start the clock', 13, 600) + 40;
      }
      roundRect(ctx, (C.W - w) / 2, y - 17, w, 34, 17);
      ctx.fillStyle = 'rgba(11,13,16,0.88)';
      ctx.fill();
      ctx.globalAlpha = k * pulse;
      if (str) text(ctx, str, C.W / 2, y, 13, COL.ink, 'center', 600);
      else {
        let x = (C.W - w) / 2 + 18;
        const seg = (s) => {
          text(ctx, s, x, y, 13, COL.ink, 'left', 600);
          x += measure(ctx, s, 13, 600) + 8;
        };
        seg('Press');
        x += keycap(ctx, glyph('move'), x, y) + 8;
        seg('or');
        x += keycap(ctx, glyph('clone'), x, y) + 8;
        seg('to start the clock');
      }
      ctx.restore();
    },

    // The hint card opened from the HUD button (H / B).
    hint(ctx, g) {
      if (!g.hintOpen) return;
      const def = SCE.LEVELS[g.levelIndex];
      const w = 520;
      const lines = wrap(ctx, def.hint, w - 48, 13);
      const h = 58 + lines.length * 19;
      const x = (C.W - w) / 2;
      const y = g.started ? 40 : 76;
      roundRect(ctx, x, y, w, h, 8);
      ctx.fillStyle = 'rgba(15,17,21,0.95)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(224,168,62,0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
      kicker(ctx, 'HINT', x + 24, y + 22);
      const close = glyph('hint');
      if (close) prompt(ctx, 'hint', 'Close', x + w - 20, y + 22, 'right', 9);
      else text(ctx, 'Tap to close', x + w - 20, y + 22, 11, COL.faint, 'right', 600);
      lines.forEach((l, i) => text(ctx, l, x + 24, y + 46 + i * 19, 13, COL.ink, 'left', 500));
      g.buttons.push({ x, y, w, h, action: () => g.toggleHint() });
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
      const kw = keycap(ctx, gl, 0, 0, 9, false);
      const lw = measure(ctx, label, 11, 600);
      const w = kw + lw + 20;
      const x = Math.max(36, Math.min(C.W - 36 - w, target.x - w / 2));
      const y = Math.max(46, target.y - 42);
      roundRect(ctx, x, y - 12, w, 24, 12);
      ctx.fillStyle = 'rgba(11,13,16,0.85)';
      ctx.fill();
      keycap(ctx, gl, x + 6, y, 9);
      text(ctx, label, x + kw + 13, y, 11, COL.ink, 'left', 600);
    },

    touch(ctx, g) {
      if (!I.touchEnabled) return;
      ctx.save();
      const st = I.stick;
      const sx = st ? st.ox : 130;
      const sy = st ? st.oy : C.H - 120;
      ctx.globalAlpha = st ? 1 : 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
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
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.arc(kx, ky, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      const b = C.TOUCH_CLONE;
      const down = I.cloneTouch !== null;
      ctx.fillStyle = down ? 'rgba(31,138,128,0.65)' : 'rgba(31,138,128,0.35)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * (down ? 0.94 : 1), 0, Math.PI * 2);
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
      text(ctx, 'SHADOW', b.x, b.y - 9, 8.5, 'rgba(255,255,255,0.7)', 'center', 700, { spacing: 1.5 });
      text(ctx, label, b.x, b.y + 8, 14, '#fff', 'center', 800, { spacing: 1 });
      ctx.restore();
    },

    // ---------------- overlays ----------------

    paused(ctx, g) {
      this.dim(ctx, 0.7 * enter(g, 0, 0.15));
      const items = g.menu().items;
      const w = 340;
      const h = 112 + items.length * ROW;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2;
      popIn(ctx, g, C.W / 2, C.H / 2, () => {
        panel(ctx, x, y, w, h);
        kicker(ctx, `LEVEL ${pad2(g.levelIndex + 1)} · ${SCE.LEVELS[g.levelIndex].name.toUpperCase()}`, x + 24, y + 28, COL.mute);
        heading(ctx, 'PAUSED', x + 24, y + 54, 22);
        list(ctx, g, items, x + 10, y + 76, w - 20);
        text(ctx, `${g.timeLeft.toFixed(1)}s left  ·  Sound ${SCE.Audio.muted ? 'off' : 'on'} (M)`, C.W / 2, y + h - 18, 11, COL.faint, 'center', 500);
      });
    },

    won(ctx, g) {
      const r = g.result;
      const a = clamp01(r.t / 0.3);
      this.dim(ctx, 0.7 * a);
      ctx.save();
      ctx.globalAlpha = a;
      const items = g.menu().items;
      const last = g.levelIndex + 1 >= SCE.LEVELS.length;
      const w = 400;
      const h = 236 + items.length * ROW;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2 + (1 - a) * 12;
      panel(ctx, x, y, w, h);
      kicker(ctx, last ? 'FORTRESS ESCAPED' : 'LEVEL CLEAR', C.W / 2, y + 28, `rgb(${COL.exit})`, 'center');
      text(ctx, SCE.LEVELS[g.levelIndex].name, C.W / 2, y + 54, 22, COL.ink, 'center', 800, { spacing: 1 });
      for (let i = 0; i < 3; i++) {
        const k = clamp01((r.t - (0.45 + i * 0.28)) / 0.3);
        const lit = r.stars[i] && k > 0;
        star(ctx, C.W / 2 - 46 + i * 46, y + 96, 16, lit, lit ? easeOutBack(k) : 1);
      }
      const crit = [
        ['Escape the level', r.stars[0]],
        [`Collect every shard  ${g.shards}/${g.shardTotal}`, r.stars[1]],
        [`${C.STAR_TIME_LEFT}s or more left  ${g.timeLeft.toFixed(1)}s`, r.stars[2]],
      ];
      crit.forEach(([s, ok], i) => {
        const cy = y + 132 + i * 20;
        ctx.fillStyle = ok ? COL.gold : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(x + 100, cy, 3, 0, Math.PI * 2);
        ctx.fill();
        text(ctx, s, x + 112, cy, 12, ok ? COL.ink : COL.faint, 'left', 500);
      });
      const ty = y + 202;
      text(ctx, `TIME  ${r.used.toFixed(1)}s`, C.W / 2 - (r.newBest ? 38 : 0), ty, 13, COL.ink, 'center', 700, { mono: true });
      if (r.newBest) {
        roundRect(ctx, C.W / 2 + 30, ty - 8, 68, 16, 8);
        ctx.fillStyle = 'rgba(242,193,78,0.16)';
        ctx.fill();
        text(ctx, 'NEW BEST', C.W / 2 + 64, ty + 0.5, 8.5, COL.gold, 'center', 800, { spacing: 1 });
      }
      list(ctx, g, items, x + 36, y + 222, w - 72);
      ctx.restore();
    },

    failed(ctx, g) {
      const r = g.result;
      const a = clamp01(r.t / 0.35);
      ctx.fillStyle = `rgba(50,6,8,${0.35 * a})`;
      ctx.fillRect(0, 0, C.W, C.H);
      this.dim(ctx, 0.5 * a);
      ctx.save();
      ctx.globalAlpha = a;
      const items = g.menu().items;
      const w = 440;
      const lines = wrap(ctx, r.text, w - 60, 13);
      const ly = 98 + lines.length * 18;
      const h = ly + 46 + items.length * ROW;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2 + (1 - a) * 12;
      panel(ctx, x, y, w, h);
      ctx.fillStyle = COL.danger;
      ctx.fillRect(x, y + 1, w, 2);
      text(ctx, r.title, C.W / 2, y + 44, 28, '#f07a7d', 'center', 900, { spacing: 4 });
      lines.forEach((l, i) => text(ctx, l, C.W / 2, y + 80 + i * 18, 13, COL.mute, 'center', 500));
      list(ctx, g, items, x + 50, y + ly, w - 100);
      if (I.device !== 'touch') prompt(ctx, 'restart', 'Instant retry', C.W / 2, y + h - 20, 'center', 9, COL.faint);
      ctx.restore();
    },

    toast(ctx, g) {
      const m = g.toastMsg;
      if (!m) return;
      ctx.globalAlpha = clamp01(m.life / 0.3);
      const w = measure(ctx, m.str, 12, 600) + 30;
      roundRect(ctx, (C.W - w) / 2, 76, w, 26, 13);
      ctx.fillStyle = 'rgba(20,22,26,0.95)';
      ctx.fill();
      ctx.strokeStyle = COL.line;
      ctx.stroke();
      text(ctx, m.str, C.W / 2, 89.5, 12, COL.ink, 'center', 600);
      ctx.globalAlpha = 1;
    },
  };

  SCE.UI = UI;
})();
