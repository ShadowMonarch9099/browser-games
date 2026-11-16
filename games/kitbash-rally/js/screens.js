// The menu screens: title, event select, track select, settings, how to play,
// pause, race results, cup podium and toasts. Each draws itself and registers
// its widgets; entrance animations run off g.stateT.
(function () {
  const KR = window.KR;
  const U = KR.UI, C = U.C, FONT = U.FONT, BODY = U.BODY, A = KR.Audio;
  const W = 960, H = 540;
  const ease = (g, d, dur) => U.easeOut((g.stateT - (d || 0)) / (dur || 0.35));
  const slideIn = (ctx, g, d, fn, dx) => { const k = ease(g, d); ctx.save(); ctx.globalAlpha = k; ctx.translate((1 - k) * (dx === undefined ? -60 : dx), 0); fn(); ctx.restore(); };

  let shadeL = null;
  function leftShade(ctx) {
    if (!shadeL) {
      shadeL = document.createElement('canvas'); shadeL.width = 480; shadeL.height = 4;
      const g = shadeL.getContext('2d'), gr = g.createLinearGradient(0, 0, 480, 0);
      gr.addColorStop(0, 'rgba(14,12,9,0.92)'); gr.addColorStop(0.55, 'rgba(14,12,9,0.6)'); gr.addColorStop(1, 'rgba(14,12,9,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 480, 4);
    }
    ctx.drawImage(shadeL, 0, 0, 620, H);
  }
  function dim(ctx, a) { ctx.fillStyle = `rgba(14,12,9,${a})`; ctx.fillRect(0, 0, W, H); }
  function backBtn(ctx, g, fn) { U.button(ctx, g, 'back', 24, 482, 130, 40, '◀ BACK', { size: 15, action: fn }); }

  function trophy(ctx, x, y, s, col, lit) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = lit ? col : 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.moveTo(-14, -20); ctx.lineTo(14, -20); ctx.lineTo(10, 0); ctx.quadraticCurveTo(0, 8, -10, 0); ctx.closePath(); ctx.fill();
    ctx.fillRect(-3, 2, 6, 10); ctx.fillRect(-10, 12, 20, 5);
    ctx.lineWidth = 3; ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath(); ctx.arc(-15, -12, 6, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(15, -12, 6, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
    if (lit) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-9, -17, 4, 12); }
    ctx.restore();
  }

  const S = {
    title(ctx, g) {
      leftShade(ctx);
      const k = ease(g, 0, 0.6);
      ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * -30);
      U.logo(ctx, 44, 54, 1, g.time);
      ctx.restore();
      U.text(ctx, 'Bolt it together. Race it. Rebuild it.', 48, 196, 19, C.ink, 'left', BODY, { weight: 600 });
      const items = [
        ['1 PLAYER', 'Race five rival karts', () => g.chooseCups(1)],
        ['2 PLAYERS', 'Split screen, one keyboard or two pads', () => g.chooseCups(2)],
        ['SETTINGS', null, () => g.openSub('settings')],
        ['HOW TO PLAY', null, () => g.openSub('howto')],
      ];
      items.forEach(([l, sub, fn], i) => slideIn(ctx, g, 0.15 + i * 0.07, () => {
        U.button(ctx, g, 'm' + i, 60, 226 + i * 60, 300, 48, l, { size: 19, primary: i === 0, action: () => { A.play('select'); fn(); } });
        if (sub && g.isFocus('m' + i)) U.text(ctx, sub, 378, 250 + i * 60, 15, C.ink, 'left', BODY, { weight: 600 });
      }));
      // trophy cabinet
      KR.CUPS.forEach((c, i) => {
        const p = g.save.trophies[i];
        trophy(ctx, 70 + i * 60, 492, 0.9, p === 1 ? '#ffc21a' : p === 2 ? '#c9ccd1' : '#cd7f32', !!p);
        U.text(ctx, c.name.toUpperCase().replace(' CUP', ''), 70 + i * 60, 520, 10, p ? C.ink : C.faint, 'center', FONT);
      });
      const tr = KR.TRACKS[g.demo ? g.demo.track.index : 0];
      KR.Road.plate(ctx, W - 300, 20, 280, 34, 'rgba(14,12,9,0.75)', 10);
      U.text(ctx, 'NOW RACING  ·  ' + tr.name.toUpperCase(), W - 160, 38, 12, C.yellow, 'center', FONT);
      U.prompts(ctx, [['nav', 'Choose'], ['confirm', 'Select']], W - 24, 516, 'right');
    },

    cups(ctx, g) {
      dim(ctx, 0.72);
      slideIn(ctx, g, 0, () => {
        U.text(ctx, 'CHOOSE YOUR EVENT', 40, 50, 30, C.yellow, 'left', FONT, { shadow: 'rgba(0,0,0,0.6)' });
        U.text(ctx, (g.humans === 2 ? 'TWO PLAYERS' : 'ONE PLAYER') + '  ·  win a cup to unlock the next', 42, 82, 16, C.mute, 'left', BODY, { weight: 600 });
      });
      const cards = [0, 1, 2];
      cards.forEach((i) => {
        const x = 40 + i * 296, y = 108, w = 280, h = 270, id = 'cup' + i;
        const k = ease(g, 0.08 + i * 0.08);
        ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * 40);
        const f = g.isFocus(id), locked = i < 2 && i > g.save.cups;
        g.reg({ id, x, y, w, h, action: () => { A.play('select'); if (i < 2) g.pickCup(i); else g.go('tracks', null, 'tr0'); } });
        U.panel(ctx, x, y, w, h, null);
        if (f) { ctx.strokeStyle = C.yellow; ctx.lineWidth = 4; ctx.strokeRect(x - 2, y - 2, w + 4, h + 4); U.hazard(ctx, x, y, w, 10, g.time * 30); }
        if (i < 2) {
          const cup = KR.CUPS[i], p = g.save.trophies[i];
          trophy(ctx, x + w / 2, y + 66, 1.6 + (f ? Math.sin(g.time * 4) * 0.06 : 0), i ? '#e8ecf0' : '#ffc21a', !locked);
          U.text(ctx, cup.name.toUpperCase(), x + w / 2, y + 118, 24, locked ? C.faint : C.ink, 'center', FONT);
          cup.tracks.forEach((t, n) => U.text(ctx, (n + 1) + '.  ' + KR.TRACKS[t].name, x + 40, y + 154 + n * 24, 17, locked ? C.faint : C.mute, 'left', BODY, { weight: 600 }));
          const st = locked ? 'LOCKED · WIN THE ' + KR.CUPS[i - 1].name.toUpperCase() : p ? 'BEST: ' + p + KR.Road.ordinal(p) + ' OVERALL' : '3 RACES · POINTS 10-8-6-5-4-3';
          U.text(ctx, st, x + w / 2, y + h - 26, 11, locked ? '#ff7a7a' : p === 1 ? C.green : C.yellow, 'center', FONT);
        } else {
          // a little chequered flag
          for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { ctx.fillStyle = (r + c) % 2 ? '#16130f' : '#f2ead8'; ctx.fillRect(x + w / 2 - 36 + c * 12, y + 40 + r * 12 + Math.sin(g.time * 4 + c) * 2, 12, 12); }
          U.text(ctx, 'SINGLE RACE', x + w / 2, y + 118, 24, C.ink, 'center', FONT);
          U.text(ctx, 'Any unlocked track,', x + w / 2, y + 160, 17, C.mute, 'center', BODY, { weight: 600 });
          U.text(ctx, 'chase your best lap.', x + w / 2, y + 184, 17, C.mute, 'center', BODY, { weight: 600 });
          U.text(ctx, 'R RESTARTS FROM RESULTS', x + w / 2, y + h - 26, 11, C.yellow, 'center', FONT);
        }
        ctx.restore();
      });
      slideIn(ctx, g, 0.3, () => {
        U.text(ctx, 'RIVALS', 40, 412, 14, C.mute, 'left', FONT);
        KR.DIFFICULTY.forEach((d, i) => U.button(ctx, g, 'diff' + i, 140 + i * 200, 392, 186, 40, d.name.toUpperCase(), {
          size: 14, primary: g.settings.difficulty === i, value: g.settings.difficulty === i ? '●' : '',
          action: () => { g.settings.difficulty = i; g.persist(); A.play('toggle'); },
        }));
      }, 0);
      backBtn(ctx, g, () => g.onBack());
      U.prompts(ctx, [['nav', 'Choose'], ['confirm', 'Select'], ['back', 'Back']], W - 24, 502, 'right');
    },

    tracks(ctx, g) {
      dim(ctx, 0.75);
      U.text(ctx, 'SINGLE RACE', 40, 50, 30, C.yellow, 'left', FONT, { shadow: 'rgba(0,0,0,0.6)' });
      U.text(ctx, 'Pick a circuit. Best laps are kept for each one.', 42, 82, 16, C.mute, 'left', BODY, { weight: 600 });
      KR.TRACKS.forEach((t, i) => {
        const x = 40 + (i % 3) * 296, y = 106 + Math.floor(i / 3) * 186, w = 280, h = 172, id = 'tr' + i;
        const k = ease(g, 0.05 + i * 0.05);
        ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * 30);
        const f = g.isFocus(id), locked = t.cup > g.save.cups;
        g.reg({ id, x, y, w, h, action: () => { A.play('select'); g.pickTrack(i); } });
        U.panel(ctx, x, y, w, h, null);
        if (f) { ctx.strokeStyle = C.yellow; ctx.lineWidth = 4; ctx.strokeRect(x - 2, y - 2, w + 4, h + 4); }
        const mm = KR.Scenery.minimap(KR.buildTrack(i), 120);
        ctx.globalAlpha *= locked ? 0.25 : 1;
        ctx.drawImage(mm.c, x + 10, y + 26, 120, 120);
        ctx.globalAlpha = k;
        U.text(ctx, KR.CUPS[t.cup].name.toUpperCase() + ' · ' + (i % 3 + 1), x + 140, y + 34, 10, C.yellow, 'left', FONT);
        const words = t.name.toUpperCase().split(' ');
        words.forEach((wd, n) => U.text(ctx, wd, x + 140, y + 62 + n * 24, 19, locked ? C.faint : C.ink, 'left', FONT, { max: 130 }));
        U.text(ctx, KR.Scenery.THEMES[t.theme].label, x + 140, y + 118, 14, C.mute, 'left', BODY, { weight: 600, max: 130 });
        const best = g.save.best[i];
        U.text(ctx, locked ? 'LOCKED' : best ? 'BEST LAP ' + KR.Road.fmt(best) : 'NO LAP SET', x + 140, y + 146, 11, locked ? '#ff7a7a' : best ? C.green : C.faint, 'left', FONT);
        ctx.restore();
      });
      backBtn(ctx, g, () => g.onBack());
      U.prompts(ctx, [['nav', 'Choose'], ['confirm', 'Race'], ['back', 'Back']], W - 24, 502, 'right');
    },

    settings(ctx, g) {
      dim(ctx, 0.7);
      const s = g.settings, P = KR.Platform;
      const rows = [
        ['slider', 'EFFECTS VOLUME', 'sfx'], ['slider', 'MUSIC VOLUME', 'music'],
        ['toggle', 'SCREEN SHAKE', 'shake'], ['toggle', 'SPARKS & SPEED LINES', 'motion'],
        ['toggle', 'SPEED UNITS', 'units', ['KM/H', 'MPH']], ['toggle', 'TOUCH AUTO-ACCELERATE', 'autoGas'],
      ];
      if (P.canFullscreen()) rows.push(['fs', 'FULLSCREEN']);
      const fromTitle = !g.back || g.back.state !== 'paused';
      const h = 76 + rows.length * 42 + (fromTitle ? 52 : 0) + 58;
      const x = 200, y = Math.max(14, (H - h) / 2), w = 560;
      const k = ease(g, 0, 0.3);
      ctx.save(); ctx.globalAlpha = k; ctx.translate(W / 2, H / 2); ctx.scale(0.94 + 0.06 * U.back(g.stateT / 0.35), 0.94 + 0.06 * U.back(g.stateT / 0.35)); ctx.translate(-W / 2, -H / 2);
      U.panel(ctx, x, y, w, h, 'SETTINGS', { t: g.time });
      rows.forEach((r, i) => {
        const ry = y + 56 + i * 42, id = 'set' + i;
        if (r[0] === 'slider') U.slider(ctx, g, id, x + 20, ry, w - 40, r[1], s[r[2]], (d, wrapAround) => { s[r[2]] = wrapAround ? (s[r[2]] + d + 11) % 11 : Math.max(0, Math.min(10, s[r[2]] + d)); g.applySettings(); A.play('move'); });
        else if (r[0] === 'toggle') {
          const isUnits = r[2] === 'units';
          const on = isUnits ? s.units === 'mph' : !!s[r[2]];
          U.toggle(ctx, g, id, x + 20, ry, w - 40, r[1], on, () => { if (isUnits) s.units = s.units === 'mph' ? 'kmh' : 'mph'; else s[r[2]] = !s[r[2]]; g.applySettings(); A.play('toggle'); }, { labels: r[3] });
        } else U.toggle(ctx, g, id, x + 20, ry, w - 40, r[1], P.isFullscreen(), () => { P.toggleFullscreen(); A.play('toggle'); });
      });
      let by = y + 64 + rows.length * 42;
      if (fromTitle) {
        U.button(ctx, g, 'reset', x + 40, by, w - 80, 40, g.confirmReset ? 'PRESS AGAIN TO WIPE EVERYTHING' : 'RESET PROGRESS & KARTS', { size: 14, danger: true, action: () => { if (g.confirmReset) { g.resetProgress(); g.confirmReset = false; A.play('remove'); } else { g.confirmReset = true; A.play('deny'); } } });
        by += 52;
      }
      U.button(ctx, g, 'done', x + w / 2 - 110, by, 220, 42, 'DONE', { size: 17, primary: true, action: () => g.closeSub() });
      ctx.restore();
      U.prompts(ctx, [['nav', 'Choose'], ['confirm', 'Change'], ['back', 'Back']], W - 24, 524, 'right');
    },

    howto(ctx, g) {
      dim(ctx, 0.78);
      const x = 30, y = 18, w = 900, h = 456;
      const k = ease(g, 0, 0.3);
      ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * 24);
      U.panel(ctx, x, y, w, h, 'HOW TO PLAY', { t: g.time });
      // controls
      const cx = x + 26;
      U.text(ctx, 'CONTROLS', cx, y + 74, 14, C.yellow, 'left', FONT);
      const rows = [
        ['', 'STEER', 'GAS / BRAKE', 'HOP', 'BOOST'],
        ['1 player', 'A D / ← →', 'W S / ↑ ↓', 'Space / F', 'Shift / G'],
        ['2P red', 'A D', 'W S', 'F', 'G'],
        ['2P blue', '← →', '↑ ↓', 'Enter / /', 'R-Shift / .'],
        ['Gamepad', 'Stick / D-pad', 'A or RT / X or LT', 'B or LB', 'Y or RB'],
        ['Touch', '◀ ▶ buttons', 'auto / BRAKE', 'HOP', 'BOOST'],
      ];
      const cols = [0, 86, 196, 330, 420];
      rows.forEach((r, i) => r.forEach((s, j) => U.text(ctx, s, cx + cols[j], y + 102 + i * 24, i === 0 ? 11 : 15, i === 0 ? C.faint : j === 0 ? C.ink : C.mute, 'left', i === 0 ? FONT : BODY, { weight: 600, max: (cols[j + 1] || 510) - cols[j] - 6 })));
      U.text(ctx, 'Pause: Esc, P or Start  ·  Mute: M  ·  Restart from pause: R', cx, y + 250, 14, C.mute, 'left', BODY, { weight: 600 });
      U.text(ctx, 'RACING', cx, y + 286, 14, C.yellow, 'left', FONT);
      [
        'Three laps. Points 10, 8, 6, 5, 4, 3 for each race; the cup goes to the most points after three races.',
        'Lift or brake for the hairpins: too fast and the corner pushes you wide onto the grass.',
        'Oil spins you, walls scrub speed, bumping pushes the lighter kart aside. Gold nuts give a little shove.',
        'Win the Nut Cup to open the Cog Cup. Rebuild between races if a track needs a different kart.',
      ].forEach((s, i) => U.wrap(ctx, s, 500, 15).forEach((l, n, arr) => { U.text(ctx, l, cx + 14, y + 312 + i * 38 + n * 17, 15, C.ink, 'left', BODY, { weight: 600 }); }));
      for (let i = 0; i < 4; i++) { ctx.fillStyle = C.yellow; ctx.fillRect(cx, y + 308 + i * 38, 6, 6); }
      // parts
      const px = x + 560;
      U.text(ctx, 'PARTS ARE POWERS', px, y + 74, 14, C.yellow, 'left', FONT);
      const icons = KR.Garage.G.icons || (KR.Garage.G.icons = (() => { const o = {}; for (const id of KR.PALETTE) o[id] = KR.Model.icon(id, 84, 64); return o; })());
      const guide = [
        ['engine', 'Engine: more power'], ['turbo', 'Big engine: lots more, but heavy'], ['wheels', 'Grippy wheels: hold faster corners'],
        ['spoiler', 'Spoiler: grip and top speed'], ['rocket', 'Rocket pod: collect + fire boosts'], ['spring', 'Spring: hop oil and grass'],
        ['magnet', 'Magnet: pulls pickups to you'], ['plate', 'Armour: shrug off bumps and oil'],
      ];
      guide.forEach(([id, s], i) => {
        const yy = y + 92 + i * 40;
        ctx.drawImage(icons[id], px - 6, yy - 4, 52, 40);
        U.text(ctx, s, px + 52, yy + 16, 15, C.ink, 'left', BODY, { weight: 600, max: 260 });
      });
      U.text(ctx, 'Six slots, left and right. A heavier side pulls the kart that way.', px, y + 420, 14, '#ff9a5a', 'left', BODY, { weight: 600, max: 320 });
      ctx.restore();
      U.button(ctx, g, 'done', W / 2 - 110, 484, 220, 42, 'GOT IT', { size: 17, primary: true, action: () => g.closeSub() });
      U.prompts(ctx, [['back', 'Back']], W - 24, 504, 'right');
    },

    paused(ctx, g) {
      dim(ctx, 0.6 * ease(g, 0, 0.15));
      const x = W / 2 - 190, y = 86, w = 380, h = 380;
      const sc = 0.92 + 0.08 * U.back(g.stateT / 0.3);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2); ctx.globalAlpha = ease(g, 0, 0.2);
      U.panel(ctx, x, y, w, h, 'PIT STOP', { t: g.time });
      U.text(ctx, KR.TRACKS[g.trackIndex].name.toUpperCase(), x + w - 24, y + 34, 11, C.mute, 'right', FONT);
      const items = [['RESUME', () => g.resume()], ['RESTART RACE', () => g.restartRace()], ['SETTINGS', () => g.openSub('settings')], ['HOW TO PLAY', () => g.openSub('howto')], ['QUIT TO MENU', () => g.goTitle()]];
      items.forEach(([l, fn], i) => U.button(ctx, g, 'p' + i, x + 40, y + 70 + i * 58, w - 80, 46, l, { size: 17, primary: i === 0, danger: i === 4, action: () => { A.play('select'); fn(); } }));
      ctx.restore();
      U.prompts(ctx, [['pause', 'Resume'], ['restart', 'Restart']], W / 2, 500, 'center');
    },

    results(ctx, g) {
      const r = g.results;
      if (!r) return;
      const t = g.resultsT;
      dim(ctx, Math.min(0.78, t * 2));
      const x = 80, y = 24, w = 800, h = 420;
      const k = U.easeOut(t / 0.4);
      ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * 30);
      U.panel(ctx, x, y, w, h, 'RACE RESULTS', { t: g.time });
      U.text(ctx, KR.TRACKS[r.track].name.toUpperCase() + (g.mode === 'cup' ? '  ·  RACE ' + (g.round + 1) + ' OF 3' : ''), x + w - 24, y + 34, 12, C.mute, 'right', FONT);
      const cols = g.mode === 'cup' ? ['POS', 'DRIVER', 'TIME', 'BEST LAP', 'POINTS', 'CUP'] : ['POS', 'DRIVER', 'TIME', 'BEST LAP', 'BUILD'];
      const cx = [x + 30, x + 92, x + 330, x + 450, x + 580, x + 690];
      cols.forEach((c, i) => U.text(ctx, c, cx[i], y + 70, 11, C.faint, 'left', FONT));
      const leader = r.rows[0].time;
      r.rows.forEach((row, i) => {
        const kk = U.easeOut((t - 0.3 - i * 0.12) / 0.3);
        if (kk <= 0) return;
        const ry = y + 96 + i * 46;
        ctx.save(); ctx.globalAlpha = k * kk; ctx.translate((1 - kk) * 60, 0);
        const human = row.human >= 0;
        ctx.fillStyle = human ? 'rgba(255,194,26,0.16)' : i % 2 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.03)';
        ctx.fillRect(x + 20, ry - 20, w - 40, 40);
        if (human) { ctx.fillStyle = C.yellow; ctx.fillRect(x + 20, ry - 20, 4, 40); }
        U.text(ctx, String(row.place), cx[0] + 6, ry, 24, i === 0 ? C.yellow : C.ink, 'left', FONT);
        U.text(ctx, KR.Road.ordinal(row.place), cx[0] + 30, ry - 6, 10, C.mute, 'left', FONT);
        ctx.fillStyle = row.kart.color; ctx.fillRect(cx[1], ry - 10, 20, 20);
        U.text(ctx, row.name.toUpperCase() + (human ? (g.humans === 2 ? '  (P' + (row.human + 1) + ')' : '  (YOU)') : ''), cx[1] + 30, ry, 18, C.ink, 'left', FONT);
        U.text(ctx, row.time ? (i === 0 ? KR.Road.fmt(row.time) : '+' + (row.time - leader).toFixed(2)) : 'ON TRACK', cx[2], ry, 15, row.time ? C.ink : C.faint, 'left', BODY, { weight: 700 });
        U.text(ctx, KR.Road.fmt(row.kart.bestLap), cx[3], ry, 17, C.mute, 'left', BODY, { weight: 700 });
        if (g.mode === 'cup') {
          const shown = Math.min(row.points, Math.floor(Math.max(0, t - 0.8 - i * 0.12) * 20));
          U.text(ctx, '+' + shown, cx[4], ry, 20, C.green, 'left', FONT);
          U.text(ctx, String(g.table[row.name] || 0), cx[5], ry, 20, C.ink, 'left', FONT);
        } else U.text(ctx, row.kart.build.filter((p) => p !== 'empty').map((p) => KR.PARTS[p].short).join(' '), cx[4], ry, 13, C.mute, 'left', BODY, { weight: 700, max: 190 });
        ctx.restore();
      });
      ctx.restore();
      const by = 466;
      let items;
      if (g.mode === 'cup') items = g.round < 2 ? [['NEXT RACE ▶', () => g.nextRace(), true], ['REBUILD FIRST', () => g.rebuild()], ['QUIT CUP', () => g.goTitle()]] : [['CUP STANDINGS ▶', () => g.toPodium(), true]];
      else items = [['RACE AGAIN', () => g.restartRace(), true], ['GARAGE', () => { KR.Garage.enter(); g.go('garage', null, 'start'); }], ['MENU', () => g.goTitle()]];
      const bw = 230, total = items.length * bw + (items.length - 1) * 20;
      items.forEach(([l, fn, pri], i) => U.button(ctx, g, 'r' + i, W / 2 - total / 2 + i * (bw + 20), by, bw, 46, l, { size: 16, primary: pri, action: () => { A.play('select'); fn(); } }));
      if (g.mode === 'single') U.prompts(ctx, [['restart', 'Race again']], W / 2, 528, 'center');
    },

    podium(ctx, g) {
      const p = g.podium;
      // stage
      const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1c1a24'); bg.addColorStop(1, '#0c0b0f');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 3; i++) {
        const x = [200, 340, 480][i];
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createLinearGradient(0, 0, 0, 400); gr.addColorStop(0, 'rgba(255,236,180,0.18)'); gr.addColorStop(1, 'rgba(255,236,180,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x - 10 + Math.sin(g.time + i) * 30, 0); ctx.lineTo(x + 10 + Math.sin(g.time + i) * 30, 0); ctx.lineTo(x + 110, 420); ctx.lineTo(x - 110, 420); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // a chequered backdrop band
      for (let c = 0; c < 48; c++) for (let r = 0; r < 2; r++) { ctx.fillStyle = (c + r) % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.2)'; ctx.fillRect(c * 20, 300 + r * 20, 20, 20); }
      const blocks = [[340, 330, 1, 110], [190, 360, 2, 80], [490, 380, 3, 60]];
      blocks.forEach(([x, y, place, hh], i) => {
        const kart = p.karts[place - 1];
        const k = U.easeOut((g.stateT - 0.2 - (3 - place) * 0.25) / 0.5);
        const yy = y + (1 - k) * 200;
        ctx.fillStyle = '#20242b'; ctx.fillRect(x - 70, yy, 140, H - yy);
        ctx.fillStyle = place === 1 ? '#ffc21a' : place === 2 ? '#c9ccd1' : '#cd7f32'; ctx.fillRect(x - 70, yy, 140, 10);
        U.text(ctx, String(place), x, yy + 50, 40, place === 1 ? '#ffc21a' : C.ink, 'center', FONT);
        if (kart && k > 0.5) KR.Model.draw(ctx, kart, { cx: x, cy: yy - 4, F: 250, D: 8, yaw: g.time * 0.8 + i, pitch: 0.35, outline: 1 });
        const name = p.standings[place - 1];
        if (name) U.text(ctx, name[0].toUpperCase(), x, yy - 72, 14, C.ink, 'center', FONT);
      });
      for (const c of p.confetti) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
      // standings
      const x = 610, y = 20, w = 330, h = 420;
      slideIn(ctx, g, 0.3, () => {
        U.panel(ctx, x, y, w, h, KR.CUPS[g.cup].name.toUpperCase(), { t: g.time, size: 20 });
        U.text(ctx, p.won ? 'CUP WON!' : 'YOU FINISHED ' + p.place + KR.Road.ordinal(p.place), x + 26, y + 74, 24, p.won ? C.green : C.yellow, 'left', FONT);
        p.standings.forEach(([n, pts], i) => {
          const ry = y + 116 + i * 40, human = KR.HUMANS.some((hh) => hh.name === n);
          ctx.fillStyle = human ? 'rgba(255,194,26,0.18)' : 'rgba(0,0,0,0.2)'; ctx.fillRect(x + 20, ry - 16, w - 40, 32);
          U.text(ctx, (i + 1) + '.', x + 30, ry, 16, C.mute, 'left', FONT);
          U.text(ctx, n.toUpperCase(), x + 64, ry, 16, C.ink, 'left', FONT);
          U.text(ctx, pts + ' PTS', x + w - 30, ry, 16, C.yellow, 'right', FONT);
        });
        const note = p.unlocked ? 'The ' + KR.CUPS[g.cup + 1].name + ' is open!' : p.won ? 'Trophy added to the cabinet.' : 'Win the most points to take the cup.';
        U.text(ctx, note, x + 26, y + h - 30, 16, C.ink, 'left', BODY, { weight: 600, max: w - 50 });
      }, 60);
      U.button(ctx, g, 'pd0', 120, 476, 220, 46, 'CONTINUE ▶', { size: 16, primary: true, action: () => { A.play('select'); g.go('cups', null, 'cup0'); } });
      U.button(ctx, g, 'pd1', 360, 476, 160, 46, 'MENU', { size: 16, action: () => g.goTitle() });
    },

    toast(ctx, g) {
      const m = g.toastMsg, a = Math.min(1, m.t * 3);
      ctx.save(); ctx.globalAlpha = a;
      const w = U.measure(ctx, m.s, 16, BODY, 700) + 50;
      KR.Road.plate(ctx, W / 2 - w / 2, 12 - (1 - a) * 20, w, 36, 'rgba(14,12,9,0.92)', 10);
      ctx.fillStyle = C.yellow; ctx.fillRect(W / 2 - w / 2 + 8, 12 - (1 - a) * 20, 4, 36);
      U.text(ctx, m.s, W / 2, 30 - (1 - a) * 20, 16, C.ink, 'center', BODY, { weight: 700 });
      ctx.restore();
    },
  };

  KR.Screens = S;
})();
