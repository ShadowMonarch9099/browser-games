// Misfit Squad: screens, crew select, the run (waves, upgrade picks, boss
// intros) and the fixed-step loop.
(function () {
  const S = MS.Sim, R = MS.Render, A = MS.Audio, I = MS.Input;
  const save = MS.Save.load();
  const st = save.settings;
  const canvas = document.getElementById('game');
  const STEP = 1 / 60;

  const G = {
    screen: 'title', t: 0, focus: 0, buttons: [], back: 'title', fade: 0, time: 0,
    demo: null, run: null, seats: [], lobbyGo: -1, banner: null, results: null, toastMsg: null,
    padSeatsAtFrame: new Set(), save, st,
  };
  MS.Game = G;
  for (let i = 0; i < 4; i++) G.seats.push({ kind: 'empty', dev: null, ready: false, hero: i, slot: i });

  G.toast = (str) => { G.toastMsg = { str, life: 2.4 }; };
  G.saveNow = () => MS.Save.store();
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
  G.tags = () => G.run.heroes.map((h) => (h.bot ? 'BOT' : MS.SLOTS[h.slot].name));

  // ---------- demo ----------
  function newDemo() {
    G.demo = S.create({ seats: [0, 1, 2, 3].map((i) => ({ hero: i, bot: true, slot: i })), seed: (Math.random() * 1e9) | 0 });
    for (let i = 0; i < 2; i++) S.choose(Object.assign(G.demo, { phase: 'pick', picks: [i * 2, 1, 3] }), 0); // start a few waves in
    G.demo.events.length = 0;
  }

  // ---------- crew select ----------
  G.seatOf = (devId) => G.seats.find((s) => s.kind === 'human' && s.dev === devId);
  G.filled = () => G.seats.filter((s) => s.kind !== 'empty');
  G.humans = () => G.seats.filter((s) => s.kind === 'human');
  const heroTaken = (h, except) => G.seats.some((s) => s !== except && s.kind !== 'empty' && s.hero === h);
  const freeHero = (from, dir, seat) => { for (let k = 0; k < 4; k++) { const h = (from + dir * k + 8) % 4; if (!heroTaken(h, seat)) return h; } return from; };
  G.join = (devId) => {
    const seat = G.seats.find((s) => s.kind === 'empty') || G.seats.find((s) => s.kind === 'cpu');
    if (!seat) { G.sfx('back'); G.toast('The squad is full'); return; }
    seat.kind = 'human'; seat.dev = devId; seat.ready = false; seat.joinT = G.time;
    seat.hero = freeHero(seat.hero, 1, seat);
    G.lobbyGo = -1; G.sfx('join');
  };
  G.leave = (seat) => { seat.kind = 'empty'; seat.dev = null; seat.ready = false; G.lobbyGo = -1; G.sfx('leave'); };
  G.addCpu = (seat) => {
    seat = seat || G.seats.find((s) => s.kind === 'empty');
    if (!seat || seat.kind !== 'empty') { G.sfx('back'); return; }
    seat.kind = 'cpu'; seat.ready = true; seat.joinT = G.time; seat.hero = freeHero(seat.hero, 1, seat);
    G.sfx('join');
  };
  G.removeCpu = (seat) => {
    seat = seat || G.seats.slice().reverse().find((s) => s.kind === 'cpu');
    if (!seat || seat.kind !== 'cpu') { G.sfx('back'); return; }
    seat.kind = 'empty'; G.lobbyGo = -1; G.sfx('leave');
  };
  G.cycleHero = (seat, d) => { const h = freeHero((seat.hero + d + 4) % 4, d, seat); if (h !== seat.hero) { seat.hero = h; seat.pickT = G.time; G.sfx('pick'); } };
  G.canStart = () => G.filled().length >= 1;
  G.startFromLobby = () => { if (!G.canStart()) { G.sfx('back'); G.toast('Somebody has to join first: press your action key'); return; } startRun(); };
  function lobbyStep(dt) {
    for (const d of I.devices) {
      if (d.kind === 'touch' || !d.connected) continue;
      const seat = G.seatOf(d.id);
      if (!seat) { if (d.pressed.a) G.join(d.id); continue; }
      if (d.pressed.b) { if (seat.ready) { seat.ready = false; G.sfx('back'); G.lobbyGo = -1; } else G.leave(seat); continue; }
      if (d.pressed.a && !seat.ready) { seat.ready = true; G.sfx('ready'); }
      if (!seat.ready && (d.pressed.left || d.pressed.right)) G.cycleHero(seat, d.pressed.left ? -1 : 1);
    }
    const hs = G.humans();
    if (hs.length && hs.every((s) => s.ready)) {
      if (G.lobbyGo < 0) { G.lobbyGo = 1.8; G.sfx('wave'); }
      G.lobbyGo -= dt;
      if (G.lobbyGo <= 0) { G.lobbyGo = -1; startRun(); }
    } else G.lobbyGo = -1;
  }

  // ---------- the run ----------
  function startRun(seatsIn) {
    const seats = seatsIn || G.filled().map((s) => ({ hero: s.hero, bot: s.kind === 'cpu', dev: s.dev, slot: s.slot }));
    G.run = S.create({ seats });
    G.run.seatInfo = seats;
    G.results = null; R.parts.length = 0; R.nums.length = 0; R.roomKey = '';
    save.runs++; G.saveNow();
    G.go('play'); G.sfx('ok');
    handleRunEvents(G.run, true);
  }
  G.restart = () => { if (G.run) startRun(G.run.seatInfo); };
  G.pause = () => { if (G.screen === 'play') { G.go('pause'); G.sfx('pause'); } };
  G.resume = () => { G.go(G.run && G.run.phase === 'pick' ? 'pick' : 'play'); G.sfx('ok'); };
  G.choose = (k) => { const m = G.run; if (m.phase !== 'pick') return; S.choose(m, k); G.sfx('upgrade'); G.go('play'); handleRunEvents(m, true); };

  function intents(m) {
    return m.seatInfo.map((s) => {
      if (s.bot) return null;
      const d = I.byId[s.dev];
      return d ? { x: d.x, y: d.y, special: d.pressed.a } : null;
    });
  }
  function handleRunEvents(m, loud) {
    for (const e of m.events) {
      R.onEvent(e, m);
      if (e.t === 'wave') G.banner = { title: e.boss ? 'WAVE ' + e.n + ' · BOSS' : 'WAVE ' + e.n, sub: e.n === 1 ? 'Hold the deck!' : e.n === S.WAVES ? 'Last wave. Everything they have.' : e.boss ? 'Something big is coming' : (S.WAVES - e.n + 1) + ' waves to go', t: 0, boss: e.boss };
      if (!loud) continue;
      if (e.t === 'shot') { if (Math.random() < 0.6) G.sfx('shot', m.heroes[e.i].hero); }
      else if (e.t === 'hit') { if (Math.random() < 0.3) G.sfx('hit'); }
      else if (e.t === 'scrap') G.sfx(e.type === 'boss' || e.type === 'brute' ? 'bigScrap' : 'scrap');
      else if (e.t === 'spawn') { if (Math.random() < 0.3) G.sfx('spawn'); }
      else if (e.t === 'boss') G.sfx('klaxon');
      else if (e.t === 'special') G.sfx(e.role === 'Tank' ? 'shove' : e.role === 'Medic' ? 'heal' : e.role === 'Trapper' ? 'mineDrop' : 'bigShot');
      else if (e.t === 'mine') G.sfx('mine');
      else if (e.t === 'down') G.sfx('down');
      else if (e.t === 'revive') G.sfx('revive');
      else if (e.t === 'secondWind') { G.sfx('secondWind'); G.toast('Second wind!'); }
      else if (e.t === 'wave') G.sfx(e.boss ? 'klaxon' : 'wave');
      else if (e.t === 'clear') G.sfx('clear');
      else if (e.t === 'won') G.sfx('won');
      else if (e.t === 'lost') G.sfx('lost');
    }
    m.events.length = 0;
  }
  function runStep(dt) {
    const m = G.run;
    S.step(m, dt, intents(m));
    let hurt = false;
    for (const h of m.heroes) if (!h.bot && h.hurt > 0.14) hurt = true;
    if (hurt && Math.random() < 0.1) G.sfx('hurt');
    handleRunEvents(m, true);
    if (m.phase === 'pick' && G.screen === 'play') {
      if (m.heroes.every((h) => h.bot)) { G.autoPick = (G.autoPick || 0) + dt; if (G.autoPick > 2) { G.autoPick = 0; G.choose((Math.random() * 3) | 0); } }
      else if (m.phaseT > 1.2) G.go('pick', { focus: 1 });
    }
    if ((m.phase === 'won' || m.phase === 'lost') && m.phaseT > 2.6 && !G.results) {
      G.results = m.result;
      save.best = Math.max(save.best, m.wave - (m.phase === 'lost' ? 1 : 0));
      if (m.phase === 'won') save.wins++;
      G.saveNow();
      G.go('results');
    }
  }

  // ---------- menus ----------
  const onOff = (v) => (v ? 'On' : 'Off');
  G.menu = () => {
    if (G.screen === 'title') return [
      { label: 'Assemble the squad', action: () => G.go('lobby') },
      { label: 'Briefing', sub: 'how to play', action: () => G.go('how') },
      { label: 'Settings', action: () => G.go('settings') },
    ];
    if (G.screen === 'settings') return [
      { label: 'Effects volume', slider: () => st.sfx, adjust: (d) => { st.sfx = MS.clamp(st.sfx + d, 0, 10); G.applyVolumes(); G.sfx('pick'); } },
      { label: 'Music volume', slider: () => st.music, adjust: (d) => { st.music = MS.clamp(st.music + d, 0, 10); G.applyVolumes(); } },
      { label: 'Screen shake', value: () => onOff(st.shake), adjust: () => { st.shake = !st.shake; } },
      { label: 'Explosion flashes', value: () => onOff(st.flashes), adjust: () => { st.flashes = !st.flashes; } },
      { label: 'Heal numbers', value: () => onOff(st.numbers), adjust: () => { st.numbers = !st.numbers; } },
      { label: 'Full screen', value: () => onOff(G.isFullscreen()), adjust: () => G.toggleFullscreen() },
      { label: 'Back', action: () => G.goBack() },
    ];
    if (G.screen === 'how') return [{ label: 'Understood', action: () => G.goBack() }];
    if (G.screen === 'pause') return [
      { label: 'Resume', action: G.resume },
      { label: 'Restart from wave 1', action: G.restart },
      { label: 'Settings', action: () => G.go('settings') },
      { label: 'Briefing', action: () => G.go('how') },
      { label: 'Change squad', action: () => { G.run = null; G.go('lobby'); } },
      { label: 'Abandon station', danger: true, action: () => { G.run = null; G.go('title'); } },
    ];
    if (G.screen === 'results') return [
      { label: 'Go again', action: G.restart },
      { label: 'Change squad', action: () => { G.run = null; G.go('lobby'); } },
      { label: 'Title', action: () => { G.run = null; G.go('title'); } },
    ];
    if (G.screen === 'pick') return G.run.picks.map((p, k) => ({ label: MS.UPGRADES[p].name, action: () => G.choose(k) }));
    return [];
  };
  G.goBack = () => { G.saveNow(); G.go(G.back === 'pause' && G.run ? 'pause' : G.back || 'title'); G.sfx('back'); };
  G.activate = (it) => {
    if (!it) return;
    if (it.action) { if (G.screen !== 'pick') G.sfx('ok'); it.action(); } else if (it.adjust) { it.adjust(1); G.saveNow(); if (!it.slider) G.sfx('ok'); }
  };
  function menuEvent(e, items) {
    const horiz = G.screen === 'pick' || G.screen === 'results';
    if (e.type === 'nav') {
      const dv = horiz ? e.dx : e.dy;
      if (dv) { G.focus = (G.focus + dv + items.length) % items.length; G.sfx('move'); }
      const it = items[G.focus];
      if (!horiz && e.dx && it && it.adjust) { it.adjust(e.dx); G.saveNow(); if (!it.slider) G.sfx('move'); }
    } else if (e.type === 'ok') G.activate(items[G.focus]);
    else if (e.type === 'back') {
      if (G.screen === 'pause') G.resume();
      else if (G.screen === 'settings' || G.screen === 'how') G.goBack();
      else if (G.screen === 'results') { G.run = null; G.go('title'); G.sfx('back'); }
    } else if (e.type === 'pause' && G.screen === 'pause') G.resume();
    else if (e.type === 'pause' && G.screen === 'pick') { G.go('pause'); G.sfx('pause'); }
  }
  function clickAt(x, y) {
    for (let i = G.buttons.length - 1; i >= 0; i--) {
      const b = G.buttons[i];
      if (x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h) { if (b.focus !== undefined) G.focus = b.focus; b.action(); return; }
    }
  }
  function handleEvents() {
    for (const e of I.take()) {
      if (e.type === 'click') { const p = MS.UI.toDesign(e.x, e.y); clickAt(p.x, p.y); continue; }
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
          else if (c === 'Space') G.startFromLobby();
        }
        continue;
      }
      if (scr === 'title' && e.type === 'back') continue;
      if (scr === 'pick' && e.type === 'back') continue;
      menuEvent(e, G.menu());
    }
  }

  // ---------- touch ----------
  const touchRoot = document.getElementById('touch');
  I.buildTouch(touchRoot);
  touchRoot.querySelector('[data-pause]').addEventListener('pointerdown', (e) => { e.preventDefault(); G.pause(); });
  function updateTouch() { touchRoot.hidden = !(G.screen === 'play' && G.run && G.run.seatInfo.some((s) => s.dev === 'touch')); }
  G.joinTouch = () => { if (!G.seatOf('touch')) { G.join('touch'); const s = G.seatOf('touch'); if (s) s.ready = true; } };

  // ---------- boot ----------
  R.init(canvas);
  I.init();
  I.bindPointer(canvas);
  newDemo();
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
      if (G.banner) { G.banner.t += STEP; if (G.banner.t > 2.6) G.banner = null; }
      if (G.toastMsg) { G.toastMsg.life -= STEP; if (G.toastMsg.life <= 0) G.toastMsg = null; }
      const showDemo = !G.run && G.screen !== 'play';
      if (showDemo) {
        S.step(G.demo, STEP, []);
        handleRunEvents(G.demo, false);
        if (G.demo.phase === 'pick') S.choose(G.demo, 0);
        if (G.demo.phase === 'won' || G.demo.phase === 'lost') newDemo();
        G.banner = null;
      }
      if (G.screen === 'lobby') lobbyStep(STEP);
      if (G.screen === 'play') runStep(STEP);
      if (G.screen === 'results' && G.run) S.step(G.run, STEP, []);
      R.update(G.screen === 'pause' || G.screen === 'pick' ? STEP * 0.2 : STEP);
    }
    handleEvents();
    const m = G.run;
    A.calm = !m || G.screen === 'results' || G.screen === 'title';
    A.wave = m ? m.wave : 0;
    A.boss = !!m && m.foes.some((f) => f.type === 'boss');
    A.tick();
    MS.UI.draw(G);
    const mo = I.mouse;
    canvas.style.cursor = mo && MS.UI.hover(G, mo) ? 'pointer' : 'default';
  }
  requestAnimationFrame(frame);
})();
