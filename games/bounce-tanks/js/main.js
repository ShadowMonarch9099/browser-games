// Bounce Tanks: screens, lobby, match flow and the fixed-step loop.
// Screens: title (live demo behind) -> lobby (press fire to join) -> play ->
// results, plus settings, how-to-play and pause. Every device can drive the
// menus; each seated player's own keys or pad drive their tank.
(function () {
  const S = BT.Sim, R = BT.Render, A = BT.Audio, I = BT.Input;
  const save = BT.Save.load();
  const st = save.settings;
  const canvas = document.getElementById('game');
  const STEP = 1 / 60;
  const TARGETS = [3, 5, 7, 10];
  const SKILLS = ['Rookie', 'Regular', 'Ace'];

  const G = {
    screen: 'title', t: 0, focus: 0, buttons: [], back: 'title', fade: 0,
    demo: null, match: null, seats: [], lobbyGo: -1, hitPause: 0, slow: 0, slowT: 0,
    results: null, toastMsg: null, padSeatsAtFrame: new Set(), TARGETS, SKILLS, save, st,
  };
  BT.Game = G;
  for (let i = 0; i < 4; i++) G.seats.push({ kind: 'empty', dev: null, ready: false, team: i });

  // ---------- helpers ----------
  G.toast = (str) => { G.toastMsg = { str, life: 2.2 }; };
  G.saveNow = () => BT.Save.store();
  G.applyVolumes = () => A.setVolumes(st.sfx, st.music);
  G.isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  G.toggleFullscreen = () => {
    const d = document.documentElement;
    try {
      if (G.isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else {
        const p = (d.requestFullscreen || d.webkitRequestFullscreen).call(d);
        if (p && p.then && screen.orientation && screen.orientation.lock) p.then(() => screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
      }
    } catch (e) { G.toast('Full screen is not available here'); }
  };
  G.sfx = (name, p) => A.play(name, p);

  G.go = (screen, opts) => {
    if (screen === 'settings' || screen === 'how') G.back = G.screen === 'pause' ? 'pause' : G.screen;
    G.screen = screen; G.t = 0; G.focus = (opts && opts.focus) || 0; G.fade = 1;
    I.flush();
    updateTouch();
  };

  G.labels = () => G.match.seats.map((s, i) => (s.bot ? 'CPU' : 'P' + (G.match.seats.slice(0, i + 1).filter((q) => !q.bot).length)));

  // ---------- demo behind the title ----------
  function newDemo() {
    G.demo = S.create({ seats: [0, 1, 2, 3].map((i) => ({ team: i, bot: true })), target: 99, skill: 2, timeLimit: 30 });
  }
  newDemo();

  // ---------- lobby ----------
  G.seatOf = (devId) => G.seats.find((s) => s.kind === 'human' && s.dev === devId);
  G.filled = () => G.seats.filter((s) => s.kind !== 'empty');
  G.humans = () => G.seats.filter((s) => s.kind === 'human');
  const freeTeam = (from, dir) => {
    for (let k = 1; k <= 4; k++) {
      const t = (from + dir * k + 8) % 4;
      if (!G.seats.some((s) => s.kind !== 'empty' && s.team === t)) return t;
    }
    return from;
  };
  function settleTeam(seat) {
    // keep colours unique: if this seat's colour is taken, move to a free one
    if (G.seats.some((s) => s !== seat && s.kind !== 'empty' && s.team === seat.team)) seat.team = freeTeam(seat.team, 1);
  }
  G.join = (devId) => {
    let seat = G.seats.find((s) => s.kind === 'empty') || G.seats.find((s) => s.kind === 'cpu');
    if (!seat) { G.sfx('back'); G.toast('All four tanks are taken'); return; }
    seat.kind = 'human'; seat.dev = devId; seat.ready = false; seat.joinT = G.time;
    settleTeam(seat);
    G.lobbyGo = -1;
    G.sfx('join');
  };
  G.leave = (seat) => { seat.kind = 'empty'; seat.dev = null; seat.ready = false; G.lobbyGo = -1; G.sfx('leave'); };
  G.addCpu = (seat) => {
    seat = seat || G.seats.find((s) => s.kind === 'empty');
    if (!seat || seat.kind !== 'empty') { G.sfx('back'); return; }
    seat.kind = 'cpu'; seat.ready = true; seat.dev = null; seat.joinT = G.time;
    settleTeam(seat);
    G.sfx('join');
  };
  G.removeCpu = (seat) => {
    seat = seat || G.seats.slice().reverse().find((s) => s.kind === 'cpu');
    if (!seat || seat.kind !== 'cpu') { G.sfx('back'); return; }
    seat.kind = 'empty'; G.lobbyGo = -1; G.sfx('leave');
  };
  G.cycleTarget = (d) => {
    const i = TARGETS.indexOf(st.target);
    st.target = TARGETS[(Math.max(0, i) + d + TARGETS.length) % TARGETS.length];
    G.saveNow(); G.sfx('move');
  };
  G.cycleSkill = (d) => { st.skill = ((st.skill === undefined ? 1 : st.skill) + d + 3) % 3; G.saveNow(); G.sfx('move'); };
  G.canStart = () => G.filled().length >= 2;
  G.startFromLobby = () => {
    if (G.humans().length && G.filled().length < 2) G.addCpu();
    if (!G.canStart()) { G.sfx('back'); G.toast('Two tanks needed: join a friend or add a computer (C)'); return; }
    startMatch();
  };

  function lobbyStep(dt) {
    for (const d of I.devices) {
      if (d.kind === 'touch' || !d.connected) continue;
      const seat = G.seatOf(d.id);
      if (!seat) { if (d.pressed.a) G.join(d.id); continue; }
      if (d.pressed.b) { G.leave(seat); continue; }
      if (d.pressed.a) { seat.ready = !seat.ready; G.sfx(seat.ready ? 'ready' : 'back'); G.lobbyGo = -1; }
      if (!seat.ready && (d.pressed.left || d.pressed.right)) { seat.team = freeTeam(seat.team, d.pressed.left ? -1 : 1); G.sfx('move'); }
    }
    const hs = G.humans();
    if (hs.length && hs.every((s) => s.ready)) {
      if (G.lobbyGo < 0) {
        if (G.filled().length < 2) { G.addCpu(); G.toast('A computer tank rolls in to play you'); }
        G.lobbyGo = 1.6; G.sfx('crate');
      }
      G.lobbyGo -= dt;
      if (G.lobbyGo <= 0) { G.lobbyGo = -1; startMatch(); }
    } else G.lobbyGo = -1;
  }

  // ---------- match ----------
  function startMatch() {
    const seats = G.filled().map((s) => ({ team: s.team, bot: s.kind === 'cpu', dev: s.dev }));
    G.match = S.create({ seats, target: st.target, skill: st.skill === undefined ? 1 : st.skill });
    G.results = null; G.hitPause = 0; G.slow = 0;
    R.parts.length = 0;
    G.go('play');
    G.sfx('ok');
  }
  G.rematch = () => { if (G.match) { const seats = G.match.seats; G.match = S.create({ seats, target: st.target, skill: st.skill === undefined ? 1 : st.skill }); G.results = null; R.parts.length = 0; G.go('play'); } };
  G.pause = () => { if (G.screen === 'play') { G.go('pause'); G.sfx('pause'); } };
  G.resume = () => { G.go('play'); G.sfx('ok'); };

  function intents(m) {
    return m.seats.map((s) => {
      if (s.bot) return null;
      const d = I.byId[s.dev];
      if (!d) return null;
      return { turn: d.x, go: -d.y, fire: d.pressed.a };
    });
  }

  function handleMatchEvents(m, loud) {
    for (const e of m.events) {
      R.onEvent(e, m);
      if (!loud) continue;
      if (e.t === 'fire') G.sfx(e.fast ? 'laser' : e.triple ? 'triple' : 'fire');
      else if (e.t === 'bounce') { G.bounceN = (G.bounceN || 0) + 1; if (G.time - (G.lastBounce || 0) > 0.035) { G.lastBounce = G.time; G.sfx('bounce', G.bounceN); } }
      else if (e.t === 'boom') {
        G.sfx('boom'); G.hitPause = 0.09;
        const alive = m.tanks.filter((t) => t.alive).length;
        if (alive <= 1) { G.slow = 0.35; G.slowT = 0.9; }
        if (e.own) G.toast(BT.TEAMS[m.tanks[e.i].team].name + ' got bounced by their own shell!');
      } else if (e.t === 'crate') G.sfx('crate');
      else if (e.t === 'pickup') G.sfx('pickup');
      else if (e.t === 'count') G.sfx('count');
      else if (e.t === 'go') G.sfx('go');
      else if (e.t === 'roundEnd') G.sfx(e.winner >= 0 ? 'point' : 'draw');
      else if (e.t === 'over') { G.sfx('win'); recordWin(m); }
    }
    m.events.length = 0;
  }
  function recordWin(m) {
    const human = m.seats.some((s) => !s.bot);
    if (!human) return;
    save.stats.matches++;
    const team = m.seats[m.champ].team;
    save.stats.wins[team] = (save.stats.wins[team] || 0) + 1;
    G.saveNow();
  }

  function playStep(dt) {
    const m = G.match;
    if (G.hitPause > 0) { G.hitPause -= dt; return; }
    let k = dt;
    if (G.slowT > 0) { G.slowT -= dt; k = dt * (1 - G.slow * Math.min(1, G.slowT * 2)); }
    S.step(m, k, intents(m));
    handleMatchEvents(m, true);
    if (m.phase === 'over' && m.phaseT > 2.4 && !G.results) {
      const order = m.seats.map((s, i) => i).sort((a, b) => m.score[b] - m.score[a] || m.stats[b].hits - m.stats[a].hits);
      G.results = { order, champ: m.champ };
      G.go('results');
    }
  }

  // ---------- menus ----------
  // Each item: { label, action } or a value row { label, value(), adjust(d) }.
  const onOff = (v) => (v ? 'On' : 'Off');
  G.menu = () => {
    if (G.screen === 'title') return [
      { label: 'Play', sub: '2 to 4 tanks', action: () => G.go('lobby') },
      { label: 'How to play', action: () => G.go('how') },
      { label: 'Settings', action: () => G.go('settings') },
    ];
    if (G.screen === 'settings') return [
      { label: 'Effects volume', slider: () => st.sfx, adjust: (d) => { st.sfx = BT.clamp(st.sfx + d, 0, 10); G.applyVolumes(); G.sfx('bounce', st.sfx); } },
      { label: 'Music volume', slider: () => st.music, adjust: (d) => { st.music = BT.clamp(st.music + d, 0, 10); G.applyVolumes(); } },
      { label: 'Screen shake', value: () => onOff(st.shake), adjust: () => { st.shake = !st.shake; } },
      { label: 'Explosion flashes', value: () => onOff(st.flashes), adjust: () => { st.flashes = !st.flashes; } },
      { label: 'Tread marks', value: () => onOff(st.treads), adjust: () => { st.treads = !st.treads; } },
      { label: 'Computer skill', value: () => SKILLS[st.skill === undefined ? 1 : st.skill], adjust: (d) => G.cycleSkill(d || 1) },
      { label: 'Rounds to win', value: () => String(st.target), adjust: (d) => G.cycleTarget(d || 1) },
      { label: 'Full screen', value: () => onOff(G.isFullscreen()), adjust: () => G.toggleFullscreen() },
      { label: 'Back', action: () => G.goBack() },
    ];
    if (G.screen === 'how') return [{ label: 'Got it', action: () => G.goBack() }];
    if (G.screen === 'pause') return [
      { label: 'Resume', action: G.resume },
      { label: 'Restart match', action: G.rematch },
      { label: 'Settings', action: () => G.go('settings') },
      { label: 'How to play', action: () => G.go('how') },
      { label: 'Change crews', action: () => { G.match = null; G.go('lobby'); } },
      { label: 'Main menu', danger: true, action: () => { G.match = null; G.go('title'); } },
    ];
    if (G.screen === 'results') return [
      { label: 'Rematch', action: G.rematch },
      { label: 'Change crews', action: () => { G.match = null; G.go('lobby'); } },
      { label: 'Main menu', action: () => { G.match = null; G.go('title'); } },
    ];
    return [];
  };
  G.goBack = () => { G.saveNow(); G.go(G.back === 'pause' && G.match ? 'pause' : G.back || 'title'); G.sfx('back'); };
  G.activate = (it) => {
    if (!it) return;
    if (it.action) { G.sfx('ok'); it.action(); } else if (it.adjust) { it.adjust(1); G.saveNow(); if (!it.slider) G.sfx('ok'); }
  };

  function menuEvent(e, items) {
    if (e.type === 'nav') {
      const horiz = G.screen === 'results';
      const dv = horiz ? e.dx : e.dy;
      if (dv) { G.focus = (G.focus + dv + items.length) % items.length; G.sfx('move'); }
      const it = items[G.focus];
      const side = horiz ? 0 : e.dx;
      if (side && it && it.adjust) { it.adjust(side); G.saveNow(); if (!it.slider) G.sfx('move'); }
    } else if (e.type === 'ok') G.activate(items[G.focus]);
    else if (e.type === 'back') {
      if (G.screen === 'pause') G.resume();
      else if (G.screen === 'settings' || G.screen === 'how') G.goBack();
      else if (G.screen === 'results') { G.match = null; G.go('title'); G.sfx('back'); }
    } else if (e.type === 'pause' && G.screen === 'pause') G.resume();
  }

  function clickAt(x, y) {
    for (let i = G.buttons.length - 1; i >= 0; i--) {
      const b = G.buttons[i];
      if (x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h) {
        if (b.focus !== undefined) G.focus = b.focus;
        b.action();
        return true;
      }
    }
    return false;
  }

  function handleEvents() {
    const evs = I.take();
    for (const e of evs) {
      if (e.type === 'click') { const p = BT.UI.toDesign(e.x, e.y); clickAt(p.x, p.y); continue; }
      if (e.type === 'pads') { G.toast('Gamepad change: ' + I.devices.filter((d) => d.kind === 'pad' && d.connected).length + ' connected'); continue; }
      const scr = G.screen;
      if (scr === 'play') {
        if ((e.type === 'back' && e.pad === undefined) || e.type === 'pause' || (e.type === 'key' && e.code === 'KeyP')) G.pause();
        continue;
      }
      if (scr === 'lobby') {
        if (e.type === 'back') {
          if (e.pad !== undefined && G.padSeatsAtFrame.has('pad' + e.pad)) continue;
          if (e.pad === undefined && e.code !== 'Escape') continue; // Backspace etc.
          G.go('title'); G.sfx('back');
        } else if (e.type === 'pause') G.startFromLobby();
        else if (e.type === 'key') {
          if (e.code === 'KeyC' || e.code === 'PadY') G.addCpu();
          else if (e.code === 'KeyX' || e.code === 'PadX') G.removeCpu();
          else if (e.code === 'KeyR' || e.code === 'PadRB') G.cycleTarget(1);
          else if (e.code === 'PadLB') G.cycleTarget(-1);
          else if (e.code === 'KeyV') G.cycleSkill(1);
          else if (e.code === 'Space') G.startFromLobby();
        }
        continue;
      }
      if (scr === 'title' && e.type === 'back') continue;
      menuEvent(e, G.menu());
    }
  }

  // ---------- touch controls ----------
  const touchRoot = document.getElementById('touch');
  I.buildTouch(touchRoot);
  touchRoot.querySelector('[data-pause]').addEventListener('pointerdown', (e) => { e.preventDefault(); G.pause(); });
  function updateTouch() {
    const on = G.screen === 'play' && G.match && G.match.seats.some((s) => s.dev === 'touch');
    touchRoot.hidden = !on;
  }
  G.joinTouch = () => { if (!G.seatOf('touch')) { G.join('touch'); const s = G.seatOf('touch'); if (s) s.ready = true; } };

  // ---------- boot ----------
  R.init(canvas);
  I.init();
  I.bindPointer(canvas);
  G.applyVolumes();
  const unlock = () => {
    A.unlock(); G.applyVolumes();
    if (!A.playing) A.startMusic();
  };
  addEventListener('keydown', unlock);
  addEventListener('pointerdown', unlock);
  I.onDevice = () => {};
  const pauseOnHide = () => { if (G.screen === 'play') G.pause(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnHide(); });
  addEventListener('blur', pauseOnHide);
  const rotate = document.getElementById('rotate');
  const checkRotate = () => {
    const p = matchMedia('(pointer: coarse)').matches && innerHeight > innerWidth * 1.1;
    rotate.hidden = !p;
  };
  addEventListener('resize', checkRotate);
  checkRotate();

  G.time = 0;
  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    runFrame(now);
  }
  // Test hook: advance the game by `secs` of simulated frames (used when the
  // page runs in a background tab where animation frames are paused).
  G.advance = (secs) => { let t = last; for (let i = 0; i < Math.round(secs * 60); i++) { t += 1000 / 60; runFrame(t); } };
  function runFrame(now) {
    const dtf = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now; acc += dtf;
    I.frame(dtf);
    G.padSeatsAtFrame = new Set(G.seats.filter((s) => s.kind === 'human').map((s) => s.dev));
    while (acc >= STEP) {
      acc -= STEP;
      I.poll();
      G.time += STEP; G.t += STEP;
      G.fade = Math.max(0, G.fade - STEP * 5);
      if (G.toastMsg) { G.toastMsg.life -= STEP; if (G.toastMsg.life <= 0) G.toastMsg = null; }
      if (G.screen === 'title' || G.screen === 'lobby' || ((G.screen === 'settings' || G.screen === 'how') && !G.match)) {
        S.step(G.demo, STEP, []);
        handleMatchEvents(G.demo, false);
        if (G.demo.phase === 'over' || G.demo.round > 12) newDemo();
      }
      if (G.screen === 'lobby') lobbyStep(STEP);
      if (G.screen === 'play') playStep(STEP);
      if (G.screen === 'results' && G.match) { S.step(G.match, STEP, []); handleMatchEvents(G.match, false); }
      R.update(G.screen === 'pause' ? 0 : STEP);
    }
    handleEvents();
    const m = G.match;
    if (m) {
      const lead = Math.max.apply(null, m.score);
      A.mood = G.screen === 'play' || G.screen === 'pause' ? (lead >= m.target - 1 ? 2 : 1) : G.screen === 'results' ? 1 : 0;
    } else A.mood = 0;
    A.tick();
    BT.UI.draw(G);
    const mo = I.mouse;
    canvas.style.cursor = mo && BT.UI.hover(G, mo) ? 'pointer' : 'default';
  }
  requestAnimationFrame(frame);
})();
