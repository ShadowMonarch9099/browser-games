// Bonk Brawl: screens, character select, match flow and the fixed-step loop.
// title (a computer brawl behind) -> character select (press your hit key to
// join, left/right to pick a fighter) -> fight -> results, plus settings,
// how-to-play and pause.
(function () {
  const S = BB.Sim, R = BB.Render, A = BB.Audio, I = BB.Input;
  const save = BB.Save.load();
  const st = save.settings;
  const canvas = document.getElementById('game');
  const STEP = 1 / 60;
  const SKILLS = ['Sleepy', 'Scrappy', 'Savage'];

  const G = {
    screen: 'title', t: 0, focus: 0, buttons: [], back: 'title', fade: 0, time: 0,
    demo: null, match: null, seats: [], lobbyGo: -1, results: null, toastMsg: null, buffers: [],
    padSeatsAtFrame: new Set(), SKILLS, save, st,
  };
  BB.Game = G;
  for (let i = 0; i < 4; i++) G.seats.push({ kind: 'empty', dev: null, ready: false, fighter: i, slot: i });

  G.toast = (str) => { G.toastMsg = { str, life: 2.4 }; };
  G.saveNow = () => BB.Save.store();
  G.applyVolumes = () => A.setVolumes(st.sfx, st.music);
  G.sfx = (n, p) => A.play(n, p);
  G.isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  G.toggleFullscreen = () => {
    const d = document.documentElement;
    try {
      if (G.isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { const p = (d.requestFullscreen || d.webkitRequestFullscreen).call(d); if (p && p.catch) p.catch(() => {}); }
    } catch (e) { G.toast('Full screen is not available here'); }
  };
  G.go = (screen, opts) => {
    if (screen === 'settings' || screen === 'how') G.back = G.screen === 'pause' ? 'pause' : G.screen;
    G.screen = screen; G.t = 0; G.focus = (opts && opts.focus) || 0; G.fade = 1;
    I.flush(); updateTouch();
  };
  G.skill = () => (st.skill === undefined ? 1 : st.skill);
  G.labels = () => G.match.fighters.map((f) => (f.bot ? 'CPU' : BB.SLOTS[f.slot].name));

  // ---------- demo ----------
  function newDemo() {
    const r = Math.random;
    G.demo = S.create({ seats: [0, 1, 2, 3].map((i) => ({ fighter: (i + ((r() * 4) | 0)) % 4, bot: true, slot: i })), stage: (r() * 3) | 0, lives: 2, skill: 2, timeLimit: 90 });
    R.parts.length = 0; R.resetCam(); R.vis.clear();
  }
  newDemo();

  // ---------- lobby ----------
  G.seatOf = (devId) => G.seats.find((s) => s.kind === 'human' && s.dev === devId);
  G.filled = () => G.seats.filter((s) => s.kind !== 'empty');
  G.humans = () => G.seats.filter((s) => s.kind === 'human');
  G.join = (devId) => {
    const seat = G.seats.find((s) => s.kind === 'empty') || G.seats.find((s) => s.kind === 'cpu');
    if (!seat) { G.sfx('back'); G.toast('All four corners are taken!'); return; }
    seat.kind = 'human'; seat.dev = devId; seat.ready = false; seat.joinT = G.time;
    G.lobbyGo = -1; G.sfx('join');
  };
  G.leave = (seat) => { seat.kind = 'empty'; seat.dev = null; seat.ready = false; G.lobbyGo = -1; G.sfx('leave'); };
  G.addCpu = (seat) => {
    seat = seat || G.seats.find((s) => s.kind === 'empty');
    if (!seat || seat.kind !== 'empty') { G.sfx('back'); return; }
    seat.kind = 'cpu'; seat.ready = true; seat.fighter = (Math.random() * 4) | 0; seat.joinT = G.time;
    G.sfx('join');
  };
  G.removeCpu = (seat) => {
    seat = seat || G.seats.slice().reverse().find((s) => s.kind === 'cpu');
    if (!seat || seat.kind !== 'cpu') { G.sfx('back'); return; }
    seat.kind = 'empty'; G.lobbyGo = -1; G.sfx('leave');
  };
  G.cycleFighter = (seat, d) => { seat.fighter = (seat.fighter + d + 4) % 4; seat.pickT = G.time; G.sfx('pick'); };
  G.cycleLives = (d) => { st.lives = ((st.lives || 3) - 1 + d + 5) % 5 + 1; G.saveNow(); G.sfx('move'); };
  G.cycleStage = (d) => { st.stage = ((st.stage === undefined ? -1 : st.stage) + 1 + d + 4) % 4 - 1; G.saveNow(); G.sfx('move'); };
  G.cycleSkill = (d) => { st.skill = (G.skill() + d + 3) % 3; G.saveNow(); G.sfx('move'); };
  G.stageName = () => (st.stage >= 0 ? BB.STAGES[st.stage].name : 'Random stage');
  G.canStart = () => G.filled().length >= 2;
  G.startFromLobby = () => {
    if (G.humans().length && G.filled().length < 2) G.addCpu();
    if (!G.canStart()) { G.sfx('back'); G.toast('Two brawlers needed: grab a friend or add a computer (C)'); return; }
    startMatch();
  };
  function lobbyStep(dt) {
    for (const d of I.devices) {
      if (d.kind === 'touch' || !d.connected) continue;
      const seat = G.seatOf(d.id);
      if (!seat) { if (d.pressed.a) G.join(d.id); continue; }
      if (d.pressed.b) { if (seat.ready) { seat.ready = false; G.sfx('back'); G.lobbyGo = -1; } else G.leave(seat); continue; }
      if (d.pressed.a && !seat.ready) { seat.ready = true; seat.readyT = G.time; G.sfx('ready'); }
      if (!seat.ready && (d.pressed.left || d.pressed.right)) G.cycleFighter(seat, d.pressed.left ? -1 : 1);
    }
    const hs = G.humans();
    if (hs.length && hs.every((s) => s.ready)) {
      if (G.lobbyGo < 0) {
        if (G.filled().length < 2) { G.addCpu(); G.toast('A computer brawler steps up!'); }
        G.lobbyGo = 1.8; G.sfx('count');
      }
      G.lobbyGo -= dt;
      if (G.lobbyGo <= 0) { G.lobbyGo = -1; startMatch(); }
    } else G.lobbyGo = -1;
  }

  // ---------- match ----------
  function startMatch(sameSeats) {
    const seats = sameSeats || G.filled().map((s) => ({ fighter: s.fighter, bot: s.kind === 'cpu', dev: s.dev, slot: s.slot }));
    const stage = st.stage >= 0 ? st.stage : (Math.random() * 3) | 0;
    G.match = S.create({ seats, stage, lives: st.lives || 3, skill: G.skill() });
    G.match.seatInfo = seats;
    G.buffers = seats.map(() => ({ jump: false, light: false, heavy: false }));
    G.results = null; R.parts.length = 0; R.words.length = 0; R.resetCam(); R.vis.clear();
    G.go('play'); G.sfx('ok');
  }
  G.rematch = () => { if (G.match) startMatch(G.match.seatInfo); };
  G.pause = () => { if (G.screen === 'play') { G.go('pause'); G.sfx('pause'); } };
  G.resume = () => { G.go('play'); G.sfx('ok'); };

  function intents(m) {
    return m.seatInfo.map((s, i) => {
      if (s.bot) return null;
      const d = I.byId[s.dev];
      if (!d) return null;
      const b = G.buffers[i];
      // presses are buffered through hit-pause so none are dropped
      b.jump = b.jump || d.pressed.up || d.pressed.y;
      b.light = b.light || d.pressed.a;
      b.heavy = b.heavy || d.pressed.b || d.pressed.x;
      return { x: d.x, jump: b.jump, down: d.held.down, light: b.light, heavy: b.heavy };
    });
  }
  function handleMatchEvents(m, loud) {
    for (const e of m.events) {
      R.onEvent(e, m, loud);
      if (!loud) continue;
      if (e.t === 'hit') { G.sfx(e.heavy ? 'heavy' : 'light', e.to); if (e.kb > 10) G.sfx('launch'); }
      else if (e.t === 'swing') G.sfx(e.heavy ? 'swingHeavy' : 'swing');
      else if (e.t === 'jump') G.sfx(e.double ? 'jump2' : 'jump');
      else if (e.t === 'land') G.sfx('land');
      else if (e.t === 'ko') { G.sfx('ko'); save.stats.kos += e.by >= 0 && !m.fighters[e.by].bot ? 1 : 0; }
      else if (e.t === 'out') G.sfx('out');
      else if (e.t === 'respawn') G.sfx('respawn');
      else if (e.t === 'count') G.sfx('count');
      else if (e.t === 'go') G.sfx('go');
      else if (e.t === 'game') G.sfx('game');
      else if (e.t === 'over') { G.sfx('win'); recordWin(m); }
    }
    m.events.length = 0;
  }
  function recordWin(m) {
    if (!m.fighters.some((f) => !f.bot) || m.winner < 0) return;
    save.stats.matches++;
    const fid = m.fighters[m.winner].c;
    save.stats.wins[BB.FIGHTERS.indexOf(fid)]++;
    G.saveNow();
  }
  function playStep(dt) {
    const m = G.match;
    const frozen = m.freeze > 0;
    const k = m.phase === 'game' ? dt * 0.6 : dt;
    S.step(m, k, intents(m));
    if (!frozen) for (const b of G.buffers) { b.jump = b.light = b.heavy = false; }
    handleMatchEvents(m, true);
    if (m.phase === 'over' && !G.results) {
      const order = m.fighters.slice().sort((a, b) => a.place - b.place).map((f) => f.i);
      G.results = { order };
      G.go('results');
    }
  }

  // ---------- menus ----------
  const yes = (v) => (v ? 'YES!' : 'NOPE');
  G.menu = () => {
    if (G.screen === 'title') return [
      { label: 'Brawl!', action: () => G.go('lobby') },
      { label: 'How to play', action: () => G.go('how') },
      { label: 'Settings', action: () => G.go('settings') },
    ];
    if (G.screen === 'settings') return [
      { label: 'Effects volume', slider: () => st.sfx, adjust: (d) => { st.sfx = BB.clamp(st.sfx + d, 0, 10); G.applyVolumes(); G.sfx('light'); } },
      { label: 'Music volume', slider: () => st.music, adjust: (d) => { st.music = BB.clamp(st.music + d, 0, 10); G.applyVolumes(); } },
      { label: 'Screen shake', value: () => yes(st.shake), adjust: () => { st.shake = !st.shake; } },
      { label: 'Impact frames and flashes', value: () => yes(st.impact), adjust: () => { st.impact = !st.impact; } },
      { label: 'Lives', value: () => String(st.lives || 3), adjust: (d) => G.cycleLives(d || 1) },
      { label: 'Stage', value: () => G.stageName(), adjust: (d) => G.cycleStage(d || 1) },
      { label: 'Computer brawlers', value: () => SKILLS[G.skill()], adjust: (d) => G.cycleSkill(d || 1) },
      { label: 'Full screen', value: () => yes(G.isFullscreen()), adjust: () => G.toggleFullscreen() },
      { label: 'Back', action: () => G.goBack() },
    ];
    if (G.screen === 'how') return [{ label: 'Let me at em!', action: () => G.goBack() }];
    if (G.screen === 'pause') return [
      { label: 'Resume', action: G.resume },
      { label: 'Restart fight', action: G.rematch },
      { label: 'Settings', action: () => G.go('settings') },
      { label: 'How to play', action: () => G.go('how') },
      { label: 'Character select', action: () => { G.match = null; G.go('lobby'); } },
      { label: 'Quit to title', danger: true, action: () => { G.match = null; newDemo(); G.go('title'); } },
    ];
    if (G.screen === 'results') return [
      { label: 'Rematch', action: G.rematch },
      { label: 'Character select', action: () => { G.match = null; G.go('lobby'); } },
      { label: 'Title', action: () => { G.match = null; newDemo(); G.go('title'); } },
    ];
    return [];
  };
  G.goBack = () => { G.saveNow(); G.go(G.back === 'pause' && G.match ? 'pause' : G.back || 'title'); G.sfx('back'); };
  G.activate = (it) => {
    if (!it) return;
    if (it.action) { G.sfx('ok'); it.action(); } else if (it.adjust) { it.adjust(1); G.saveNow(); if (!it.slider) G.sfx('ok'); }
  };
  function menuEvent(e, items) {
    const horiz = G.screen === 'results' || G.screen === 'title';
    if (e.type === 'nav') {
      const dv = horiz ? e.dx || e.dy : e.dy;
      if (dv) { G.focus = (G.focus + dv + items.length) % items.length; G.sfx('move'); }
      const it = items[G.focus];
      if (!horiz && e.dx && it && it.adjust) { it.adjust(e.dx); G.saveNow(); if (!it.slider) G.sfx('move'); }
    } else if (e.type === 'ok') G.activate(items[G.focus]);
    else if (e.type === 'back') {
      if (G.screen === 'pause') G.resume();
      else if (G.screen === 'settings' || G.screen === 'how') G.goBack();
      else if (G.screen === 'results') { G.match = null; newDemo(); G.go('title'); G.sfx('back'); }
    } else if (e.type === 'pause' && G.screen === 'pause') G.resume();
  }
  function clickAt(x, y) {
    for (let i = G.buttons.length - 1; i >= 0; i--) {
      const b = G.buttons[i];
      if (x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h) { if (b.focus !== undefined) G.focus = b.focus; b.action(); return; }
    }
  }
  function handleEvents() {
    for (const e of I.take()) {
      if (e.type === 'click') { const p = BB.UI.toDesign(e.x, e.y); clickAt(p.x, p.y); continue; }
      if (e.type === 'pads') { G.toast('Gamepads connected: ' + I.devices.filter((d) => d.kind === 'pad' && d.connected).length); continue; }
      const scr = G.screen;
      if (scr === 'play') { if ((e.type === 'back' && e.pad === undefined) || e.type === 'pause' || (e.type === 'key' && e.code === 'KeyP')) G.pause(); continue; }
      if (scr === 'lobby') {
        if (e.type === 'back') {
          if (e.pad !== undefined && G.padSeatsAtFrame.has('pad' + e.pad)) continue;
          if (e.pad === undefined && e.code !== 'Escape') continue;
          G.go('title'); G.sfx('back');
        } else if (e.type === 'pause') G.startFromLobby();
        else if (e.type === 'key') {
          const c = e.code;
          if (c === 'KeyC' || c === 'PadY') G.addCpu();
          else if (c === 'KeyX' || c === 'PadX') G.removeCpu();
          else if (c === 'KeyL' || c === 'PadRB') G.cycleLives(1);
          else if (c === 'PadLB') G.cycleLives(-1);
          else if (c === 'KeyT' || c === 'PadSEL') G.cycleStage(1);
          else if (c === 'KeyV') G.cycleSkill(1);
          else if (c === 'Space') G.startFromLobby();
        }
        continue;
      }
      if (scr === 'title' && e.type === 'back') continue;
      menuEvent(e, G.menu());
    }
  }

  // ---------- touch ----------
  const touchRoot = document.getElementById('touch');
  I.buildTouch(touchRoot);
  touchRoot.querySelector('[data-pause]').addEventListener('pointerdown', (e) => { e.preventDefault(); G.pause(); });
  function updateTouch() { touchRoot.hidden = !(G.screen === 'play' && G.match && G.match.seatInfo.some((s) => s.dev === 'touch')); }
  G.joinTouch = () => { if (!G.seatOf('touch')) { G.join('touch'); const s = G.seatOf('touch'); if (s) { s.ready = true; s.readyT = G.time; } } };

  // ---------- boot ----------
  R.init(canvas);
  I.init();
  I.bindPointer(canvas);
  G.applyVolumes();
  const unlock = () => { A.unlock(); G.applyVolumes(); if (!A.playing) A.startMusic(); };
  addEventListener('keydown', unlock);
  addEventListener('pointerdown', unlock);
  const pauseOnHide = () => { if (G.screen === 'play') G.pause(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseOnHide(); });
  addEventListener('blur', pauseOnHide);
  const rotate = document.getElementById('rotate');
  const checkRotate = () => { rotate.hidden = !(matchMedia('(pointer: coarse)').matches && innerHeight > innerWidth * 1.1); };
  addEventListener('resize', checkRotate); checkRotate();

  let last = performance.now(), acc = 0;
  function frame(now) { requestAnimationFrame(frame); runFrame(now); }
  // Test hook: advance by `secs` of simulated frames (background tabs pause animation frames).
  G.advance = (secs) => { let t = last; for (let i = 0; i < Math.round(secs * 60); i++) { t += 1000 / 60; runFrame(t); } };
  function runFrame(now) {
    const dtf = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now; acc += dtf;
    I.frame(dtf);
    G.padSeatsAtFrame = new Set(G.humans().map((s) => s.dev));
    while (acc >= STEP) {
      acc -= STEP;
      I.poll();
      G.time += STEP; G.t += STEP;
      G.fade = Math.max(0, G.fade - STEP * 4);
      if (G.toastMsg) { G.toastMsg.life -= STEP; if (G.toastMsg.life <= 0) G.toastMsg = null; }
      const showDemo = G.screen === 'title' || G.screen === 'lobby' || ((G.screen === 'settings' || G.screen === 'how') && !G.match);
      if (showDemo) {
        S.step(G.demo, STEP, []);
        handleMatchEvents(G.demo, false);
        R.updateCam(G.demo, STEP, false);
        if (G.demo.phase === 'over') newDemo();
      }
      if (G.screen === 'lobby') lobbyStep(STEP);
      if (G.screen === 'play') { playStep(STEP); R.updateCam(G.match, STEP, true); }
      if (G.screen === 'results' && G.match) R.updateCam(G.match, STEP, false);
      R.update(G.screen === 'pause' ? 0 : STEP, G.screen === 'play' ? G.match : null);
    }
    handleEvents();
    const m = G.match;
    if (m && (G.screen === 'play' || G.screen === 'pause')) A.mood = m.fighters.some((f) => !f.out && f.stocks === 1) ? 2 : 1;
    else A.mood = G.screen === 'results' ? 1 : 0;
    A.tick();
    BB.UI.draw(G);
    const mo = I.mouse;
    canvas.style.cursor = mo && BB.UI.hover(G, mo) ? 'pointer' : 'default';
  }
  requestAnimationFrame(frame);
})();
