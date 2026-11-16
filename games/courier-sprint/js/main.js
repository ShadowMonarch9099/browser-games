// Courier Sprint: boot, screen state machine and the fixed-step loop.
//   title -> ready (3-2-1) -> play -> over -> results;  title -> settings / how
(function (root) {
  'use strict';
  const { Rules: R, Save, Audio: A, Input: I, Render: Rd, UI } = root.CS;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const STEP = 1 / 60;
  const THEME_OPTS = ['auto', 'morning', 'noon', 'sunset', 'night'];

  const g = {
    W: 0, H: 0, state: 'title', stateT: 0, focus: 0, focusPop: 0, buttons: [], time: 0, fade: 1,
    save: { best: Save.get('best', 0) || 0, runs: Save.get('runs', 0) || 0 },
    settings: Save.settings(), sim: null, demo: null, demoOver: 0, result: null, toastMsg: null,
    shake: 0, flash: 0, hitstop: 0, cdT: 9, overT: 0, playT: 0, sPulse: 0, pPulse: 0, lastHundred: 0, settingsFrom: 'title',
  };
  A.setVolumes(g.settings.sfx, g.settings.music);

  const doc = document.documentElement;
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function toggleFullscreen() {
    try {
      if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (doc.requestFullscreen || doc.webkitRequestFullscreen).call(doc);
    } catch (e) { toast('No fullscreen here'); }
  }
  function resize() {
    const W = root.innerWidth, H = root.innerHeight;
    let dpr = Math.min(root.devicePixelRatio || 1, 2);
    if (W * H * dpr * dpr > 2400000) dpr = Math.sqrt(2400000 / (W * H));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.W = W; g.H = H;
    Rd.resize(W, H);
  }
  root.addEventListener('resize', resize);
  root.addEventListener('orientationchange', () => setTimeout(resize, 120));

  function toast(s, t, color) { g.toastMsg = { s, life: t || 1.4, max: t || 1.4, color }; }
  function persist() { Save.set('settings', g.settings); A.setVolumes(g.settings.sfx, g.settings.music); }
  function setState(s, focus) { g.state = s; g.stateT = 0; g.focus = focus || 0; g.focusPop = 1; g.fade = 0.5; g.buttons.length = 0; }

  g.menu = function () {
    const S = g.settings;
    const tog = (label, key) => ({ label, value: () => (S[key] ? 'On' : 'Off'), act: () => { S[key] = !S[key]; persist(); } });
    switch (g.state) {
      case 'title': return [
        { label: 'Start shift', act: () => startRun() },
        { label: 'The route', act: () => setState('how') },
        { label: 'Settings', act: () => { g.settingsFrom = 'title'; setState('settings'); } },
      ];
      case 'settings': return [
        { label: 'Effects', slider: () => S.sfx, adjust: (d) => { S.sfx = Math.max(0, Math.min(10, S.sfx + d)); persist(); A.play('parcel'); }, act: () => { S.sfx = (S.sfx + 1) % 11; persist(); A.play('parcel'); } },
        { label: 'Music', slider: () => S.music, adjust: (d) => { S.music = Math.max(0, Math.min(10, S.music + d)); persist(); }, act: () => { S.music = (S.music + 1) % 11; persist(); } },
        tog('Screen shake', 'shake'),
        tog('Motion effects', 'motion'),
        tog('Control hints', 'hints'),
        { label: 'Day theme', value: () => S.theme, adjust: (d) => { S.theme = THEME_OPTS[(THEME_OPTS.indexOf(S.theme) + d + THEME_OPTS.length) % THEME_OPTS.length]; persist(); }, act: () => { S.theme = THEME_OPTS[(THEME_OPTS.indexOf(S.theme) + 1) % THEME_OPTS.length]; persist(); } },
        { label: 'Fullscreen', value: () => (isFull() ? 'On' : 'Off'), act: () => toggleFullscreen() },
        { label: 'Back', act: () => g.back() },
      ];
      case 'paused': return [
        { label: 'Back to work', act: () => resume() },
        { label: 'Restart shift', act: () => startRun() },
        { label: 'Settings', act: () => { g.settingsFrom = 'paused'; setState('settings'); } },
        { label: 'Clock off', act: () => goTitle() },
      ];
      case 'results': return [
        { label: 'Run again', act: () => startRun() },
        { label: 'Main menu', act: () => goTitle() },
      ];
      default: return [];
    }
  };
  g.activate = function (it) { A.play('confirm'); it.act(); };
  g.back = function () {
    A.play('back');
    if (g.state === 'settings') { if (g.settingsFrom === 'paused') setState('paused', 2); else setState('title', 2); }
    else if (g.state === 'how') setState('title', 1);
    else if (g.state === 'paused') resume();
    else if (g.state === 'results') goTitle();
  };
  g.pause = function () {
    if (g.state !== 'play' && g.state !== 'ready') return;
    g.pausedFrom = g.state; g.pausedT = g.stateT;
    A.play('pause'); setState('paused');
  };
  function resume() {
    const from = g.pausedFrom;
    setState(from === 'ready' ? 'ready' : 'play');
    if (from === 'ready') g.stateT = 0; // countdown restarts so you are ready
    else g.stateT = 1;
    I.flush();
  }
  function goTitle() { setState('title'); g.sim = null; Rd.parts.length = 0; }
  function newDemo() { g.demo = R.create(); g.demoOver = 0; }
  function startRun() {
    g.sim = R.create();
    Rd.parts.length = 0; g.shake = 0; g.flash = 0; g.playT = 0; g.lastHundred = 0;
    setState('ready'); g.lastCount = -1; I.flush();
  }
  function finishRun() {
    const sim = g.sim, score = R.score(sim);
    const newBest = score > g.save.best;
    g.save.best = Math.max(g.save.best, score); g.save.runs++;
    Save.set('best', g.save.best); Save.set('runs', g.save.runs);
    const by = { barrier: 'TRIPPED ON A BARRIER', sign: 'HEADFIRST INTO A SIGN', van: 'BUMPED A PARKED VAN' }[sim.crashedBy] || 'PARCEL DROPPED';
    g.result = { dist: Math.floor(sim.dist), parcels: sim.parcels, score, best: g.save.best, newBest, title: by };
    setState('results');
    if (newBest) setTimeout(() => { A.play('stamp'); setTimeout(() => A.play('best'), 150); }, 1600);
  }

  function effects(sim, ev) {
    const p = sim.p, x = p.x * Rd.LANE, D = sim.dist;
    for (const e of ev) {
      switch (e) {
        case 'lane': A.play('lane'); break;
        case 'jump': A.play('jump'); Rd.burst(D + 0.3, x, 0.05, 6, { up: 1.5, speed: 1.5, life: 0.4, color: '#d9d4c8', size: 0.07 }); break;
        case 'land': A.play('land'); g.shake = Math.max(g.shake, 2); Rd.burst(D + 0.3, x, 0.05, 6, { up: 1, speed: 2, life: 0.4, color: '#c9c4b8', size: 0.07 }); break;
        case 'roll': A.play('roll'); Rd.burst(D + 0.5, x, 0.05, 8, { up: 1, speed: 2.5, life: 0.5, color: '#d9d4c8', size: 0.07 }); break;
        case 'parcel': case 'parcelPull':
          A.play(e); g.pPulse = 1; g.sPulse = 1;
          Rd.burst(D + 0.8, x, 1.0, 8, { up: 3, speed: 2.5, life: 0.5, color: '#ffd23f', size: 0.06, vz: sim.speed * 0.9 });
          break;
        case 'clearJump': case 'clearRoll': A.play('clear'); break;
        case 'power:magnet': A.play('magnet'); toast('Parcel magnet!', 1.3, '#ff3d5a'); break;
        case 'power:scooter': A.play('scooter'); toast('Scooter: one free crash', 1.5, '#2f8bff'); break;
        case 'power:drone': A.play('drone'); toast('Drone lift!', 1.3, '#a35cff'); break;
        case 'powerEnd': A.play('powerEnd'); break;
        case 'scooterSave':
          A.play('save'); g.shake = 10; g.hitstop = 0.08; toast('Scooter took the hit!', 1.3, '#2f8bff');
          Rd.burst(D + 1, x, 0.5, 14, { up: 4, speed: 4, life: 0.7, color: '#2f8bff', size: 0.1, box: true });
          break;
        case 'crash':
          A.play('crash'); g.shake = 22; g.flash = 1; g.hitstop = 0.12;
          Rd.burst(D + 1, x, 1.2, 12, { up: 5, speed: 5, life: 1.2, color: '#c9965c', size: 0.16, box: true, vz: 3 });
          break;
      }
    }
  }

  function update(dt) {
    I.poll();
    g.time += dt; g.stateT += dt;
    g.fade = Math.max(0, g.fade - dt * 3);
    g.focusPop = Math.max(0, g.focusPop - dt * 5);
    g.shake = Math.max(0, g.shake - dt * 45);
    g.flash = Math.max(0, g.flash - dt * 3);
    g.sPulse = Math.max(0, g.sPulse - dt * 4);
    g.pPulse = Math.max(0, g.pPulse - dt * 5);
    if (g.toastMsg) { g.toastMsg.life -= dt; if (g.toastMsg.life <= 0) g.toastMsg = null; }
    if (I.has('mute')) { A.muted = !A.muted; A.apply(); toast(A.muted ? 'Sound off' : 'Sound on', 1); }
    if (I.has('fullscreen')) toggleFullscreen();

    if (I.hover && I.hover.moved) {
      for (let i = g.buttons.length - 1; i >= 0; i--) {
        const b = g.buttons[i];
        if (inside(b, I.hover)) { if (b.focus !== undefined && b.focus !== g.focus) { g.focus = b.focus; g.focusPop = 1; A.play('move'); } break; }
      }
    }
    let tapFree = false;
    for (const t of I.taps) {
      let hit = null;
      for (let i = g.buttons.length - 1; i >= 0; i--) if (inside(g.buttons[i], t)) { hit = g.buttons[i]; break; }
      if (hit) { if (hit.focus !== undefined) g.focus = hit.focus; hit.act(); return; }
      tapFree = true;
    }
    const st = g.state;
    const live = g.sim || g.demo;
    if (live) Rd.setTheme(g.settings.theme, live.dist);

    if (st === 'play') return play(dt, tapFree);
    if (st === 'over') {
      g.overT += dt;
      R.step(g.sim, dt, {});
      Rd.stepParticles(dt);
      if (g.overT > 1.5) finishRun();
      return;
    }
    if (st === 'ready') {
      if (I.has('pause')) return g.pause();
      g.cdT = g.stateT;
      const n = Math.floor((g.stateT - 0.6) / 0.6);
      if (n !== g.lastCount && g.stateT >= 0.6) { g.lastCount = n; A.play('count'); }
      if (g.stateT >= 0.6 + 1.8) { setState('play'); g.stateT = 1; g.fade = 0; g.playT = 0; g.cdT = 2.4; A.play('go'); }
      return;
    }
    if (st === 'title' || st === 'how' || (st === 'settings' && g.settingsFrom === 'title')) {
      if (!g.demo) newDemo();
      const d = g.demo;
      R.step(d, dt, R.autopilot(d, 0.995));
      Rd.stepParticles(dt);
      if (d.state === 'over') { g.demoOver += dt; if (g.demoOver > 1) newDemo(); }
      if (d.dist > 2500) newDemo();
    }
    if (st === 'how') { if (I.has('back') || I.has('confirm')) g.back(); return; }
    const items = g.menu();
    if (items.length) {
      if (I.has('up')) { g.focus = (g.focus + items.length - 1) % items.length; g.focusPop = 1; A.play('move'); }
      if (I.has('down')) { g.focus = (g.focus + 1) % items.length; g.focusPop = 1; A.play('move'); }
      const it = items[g.focus];
      if (it && it.adjust && (I.has('left') || I.has('right'))) { it.adjust(I.has('left') ? -1 : 1); A.play('move'); }
      if (I.has('confirm') && it) g.activate(it);
      else if ((st === 'results' || st === 'paused') && I.has('restart')) startRun();
      else if (st === 'paused' && I.has('pause') && !I.has('back')) resume();
      else if (I.has('back') && st !== 'title') g.back();
    }
  }

  function play(dt, tapFree) {
    const sim = g.sim;
    if (I.has('pause')) return g.pause();
    if (I.has('restart')) return startRun();
    g.playT += dt; g.cdT += dt;
    const inp = { left: I.has('left'), right: I.has('right'), up: I.has('up') || I.has('jump') || tapFree, down: I.has('down') || I.has('slide') };
    if (g.hitstop > 0) { g.hitstop -= dt; if (inp.left || inp.right || inp.up || inp.down) g.queued = inp; return; }
    if (g.queued) { for (const k in g.queued) inp[k] = inp[k] || g.queued[k]; g.queued = null; }
    const ev = R.step(sim, dt, inp);
    effects(sim, ev);
    Rd.stepParticles(dt);
    A.flying(sim.power.drone > 0);
    A.intensity = Math.min(1, (sim.speed - 16) / 18);
    // a van ahead in your lane honks once
    for (const t of sim.things) {
      if (t.type === 'van' && !t.honked && t.lane === sim.p.lane && t.z - sim.dist < 24 && t.z - sim.dist > 4 && sim.power.drone <= 0) { t.honked = true; A.play('horn'); }
    }
    const hundred = Math.floor(sim.dist / 100);
    if (hundred > g.lastHundred) { g.lastHundred = hundred; A.play('tick'); g.sPulse = 1; }
    if (sim.state === 'over') { A.flying(false); g.state = 'over'; g.overT = 0; }
  }

  const inside = (b, p) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

  function render() {
    const st = g.state;
    g.buttons.length = 0;
    const inRun = g.sim && (st === 'ready' || st === 'play' || st === 'paused' || st === 'over' || st === 'results' || (st === 'settings' && g.settingsFrom === 'paused'));
    const sim = inRun ? g.sim : g.demo || (g.demo = R.create());
    const intro = st === 'ready' ? Math.min(1, g.stateT / 1.2) : 1;
    Rd.draw(ctx, { sim, time: g.time, settings: g.settings, shake: g.shake, intro: 1 - Math.pow(1 - intro, 3) });
    if (g.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${g.flash * 0.6})`; ctx.fillRect(0, 0, g.W, g.H); }
    if (st === 'title') UI.title(ctx, g);
    else if (st === 'how') UI.how(ctx, g);
    else if (st === 'settings') UI.settings(ctx, g);
    else if (st === 'ready') { UI.hud(ctx, g); UI.countdown(ctx, g); }
    else if (st === 'play' || st === 'over') { UI.hud(ctx, g); if (g.cdT < 3.1) UI.countdown(ctx, g); }
    else if (st === 'paused') UI.paused(ctx, g);
    else if (st === 'results') UI.results(ctx, g);
    UI.toast(ctx, g);
    if (g.fade > 0) { ctx.fillStyle = `rgba(16,24,40,${g.fade * 0.5})`; ctx.fillRect(0, 0, g.W, g.H); }
    canvas.style.cursor = I.hover && g.buttons.some((b) => inside(b, I.hover)) ? 'pointer' : 'default';
  }

  resize();
  I.init(canvas);
  document.addEventListener('visibilitychange', () => { if (document.hidden) g.pause(); });
  root.addEventListener('blur', () => g.pause());
  newDemo();
  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= STEP) { tick(); acc -= STEP; }
    render();
  }
  function tick() {
    update(STEP);
    const st = g.state;
    A.setMode(st === 'play' || st === 'ready' || st === 'over' ? 'run' : 'menu');
    if (st !== 'play') A.flying(false);
    A.update(STEP);
    I.endTick();
  }
  requestAnimationFrame(frame);
  root.CS.game = g;
  root.CS.advance = function (n) { for (let i = 0; i < n; i++) tick(); render(); return g.state; };
})(window);
