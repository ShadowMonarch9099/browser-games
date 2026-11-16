// Jungle Getaway: boot, the screen state machine and the fixed-step loop.
//   title -> ready -> play -> over -> results
//   title -> wardrobe / how / settings;  play -> paused -> settings
(function (root) {
  'use strict';
  const { Rules: R, Save, Audio: A, Input: I, Render: Rd, UI } = root.JG;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const STEP = 1 / 60;
  const MENU_STATES = { title: 1, wardrobe: 1, how: 1 };

  const g = {
    W: 0, H: 0, state: 'title', stateT: 0, focus: 0, focusPop: 0, buttons: [], time: 0, fade: 1,
    save: { best: Save.get('best', 0) || 0, bank: Save.get('bank', 0) || 0, mission: Save.get('mission', 0) || 0, hat: Save.get('hat', 0) || 0 },
    settings: Save.settings(),
    sim: null, demo: null, demoOver: 0, result: null, toastMsg: null,
    shake: 0, hitstop: 0, rearT: 0, overT: 0, playT: 0, mPulse: 0, cPulse: 0, lastM: 0,
    settingsFrom: 'title', infoFrom: 'title', lastD: 0, lastSim: null, dustT: 0,
  };
  g.save.hat = Math.min(g.save.hat, R.hatsUnlocked(g.save.mission) - 1);
  A.setVolumes(g.settings.sfx, g.settings.music);

  // ---------- platform ----------
  const doc = document.documentElement;
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function toggleFullscreen() {
    try {
      if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (doc.requestFullscreen || doc.webkitRequestFullscreen).call(doc);
    } catch (e) { toast('Fullscreen is not available here'); }
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

  // ---------- helpers ----------
  function toast(s, t) { g.toastMsg = { s, life: t || 1.8, max: t || 1.8 }; }
  function persistSettings() { Save.set('settings', g.settings); A.setVolumes(g.settings.sfx, g.settings.music); }
  function setState(s, focus) {
    g.state = s; g.stateT = 0; g.focus = focus || 0; g.focusPop = 1; g.fade = 0.6;
    g.buttons.length = 0;
  }

  g.menu = function () {
    const S = g.settings;
    switch (g.state) {
      case 'title': return [
        { label: 'Run!', act: () => startRun() },
        { label: 'Wardrobe', act: () => { g.infoFrom = 'title'; setState('wardrobe', g.save.hat); } },
        { label: 'How to Run', act: () => { g.infoFrom = 'title'; setState('how'); } },
        { label: 'Settings', act: () => { g.settingsFrom = 'title'; setState('settings'); } },
      ];
      case 'settings': {
        const tog = (label, key, after) => ({ label, value: () => (S[key] ? 'On' : 'Off'), act: () => { S[key] = !S[key]; persistSettings(); if (after) after(); } });
        return [
          { label: 'Effects', slider: () => S.sfx, adjust: (d) => { S.sfx = Math.max(0, Math.min(10, S.sfx + d)); persistSettings(); A.play('coin'); }, act: () => { S.sfx = (S.sfx + 1) % 11; persistSettings(); A.play('coin'); } },
          { label: 'Music', slider: () => S.music, adjust: (d) => { S.music = Math.max(0, Math.min(10, S.music + d)); persistSettings(); }, act: () => { S.music = (S.music + 1) % 11; persistSettings(); } },
          tog('Screen shake', 'shake'),
          tog('Motion effects', 'motion'),
          tog('Rear-view cut', 'rearview'),
          tog('Hints', 'hints'),
          { label: 'Fullscreen', value: () => (isFull() ? 'On' : 'Off'), act: () => toggleFullscreen() },
          { label: 'Back', act: () => g.back() },
        ];
      }
      case 'paused': return [
        { label: 'Resume', act: () => resume() },
        { label: 'Restart run', act: () => startRun() },
        { label: 'Settings', act: () => { g.settingsFrom = 'paused'; setState('settings'); } },
        { label: 'Quit to title', danger: true, act: () => goTitle() },
      ];
      case 'results': return [
        { label: 'Run again', act: () => startRun() },
        { label: 'Wardrobe', act: () => { g.infoFrom = 'results'; setState('wardrobe', g.save.hat); } },
        { label: 'Title', act: () => goTitle() },
      ];
      default: return [];
    }
  };
  g.activate = function (it) { A.play('confirm'); it.act(); };
  g.back = function () {
    A.play('back');
    if (g.state === 'settings') { if (g.settingsFrom === 'paused') setState('paused', 2); else setState('title', 3); }
    else if (g.state === 'wardrobe' || g.state === 'how') { if (g.infoFrom === 'results') setState('results', 1); else setState('title', g.state === 'how' ? 2 : 1); }
    else if (g.state === 'paused') resume();
    else if (g.state === 'results') goTitle();
    else if (g.state === 'ready') goTitle();
  };
  g.wear = function (i) {
    if (i >= R.hatsUnlocked(g.save.mission)) { A.play('denied'); toast(`Complete ${i * 3} missions to unlock`); return; }
    g.save.hat = i; Save.set('hat', i); g.focus = i; g.focusPop = 1;
    A.play('confirm'); toast(R.HATS[i].name + ' on!', 1.2);
  };
  g.pause = function () {
    if (g.state !== 'play' && g.state !== 'ready') return;
    g.pausedFrom = g.state;
    A.play('pause'); setState('paused');
  };
  function resume() { setState(g.pausedFrom === 'ready' ? 'ready' : 'play'); if (g.state === 'ready') g.stateT = 1.2; I.flush(); }
  function goTitle() { setState('title'); g.sim = null; }

  function newDemo() { g.demo = R.create(); g.demoOver = 0; Rd.parts.length = 0; }
  function startRun() {
    g.sim = R.create();
    Rd.parts.length = 0; g.rearT = 0; g.shake = 0; g.lastM = 0; g.playT = 0;
    setState('ready');
    I.flush();
  }
  function beginPlay() { setState('play'); A.play('start'); g.playT = 0; I.flush(); }

  function finishRun() {
    const sim = g.sim;
    const res = R.finish(sim.run, g.save);
    g.save.best = res.best; g.save.bank = res.bank; g.save.mission = res.mission;
    Save.set('best', res.best); Save.set('bank', res.bank); Save.set('mission', res.mission);
    g.result = {
      m: sim.run.m, coins: sim.run.coins, best: res.best, newBest: res.newBest, fell: sim.p.fell,
      missionDone: res.done, hat: res.hat, mission: res.mission,
      next: res.mission < R.MISSIONS.length ? 'Next: ' + R.MISSIONS[res.mission][0] : 'All missions complete. Legendary!',
    };
    setState('results');
    setTimeout(() => { if (res.done) A.play('mission'); else if (res.newBest) A.play('best'); }, 900);
  }

  // ---------- effects from simulation events ----------
  function effects(sim, ev, live) {
    const p = sim.p, x = p.x * Rd.LANE, D = sim.d;
    for (const e of ev) {
      if (live) {
        switch (e) {
          case 'jump': A.play('jump'); Rd.burst('dust', D + 6, x, 2, 6, { up: 40, speed: 60, grav: 120, life: 0.5, size: 4, color: '#c9b98a' }); break;
          case 'jump2': A.play('jump2'); Rd.burst('spark', D + 4, x, p.h + 20, 8, { up: 60, speed: 120, grav: 100, life: 0.4, size: 2.5, color: '#fff1b8', vz: sim.speed * 0.9 }); break;
          case 'land': A.play('land'); Rd.burst('dust', D + 4, x, 2, 8, { up: 50, speed: 90, grav: 150, life: 0.5, size: 4, color: '#bfae80' }); g.shake = Math.max(g.shake, 2); break;
          case 'slide': A.play('slide'); Rd.burst('dust', D + 8, x, 2, 10, { up: 60, speed: 110, grav: 160, life: 0.6, size: 4, color: '#c9b98a' }); break;
          case 'lane': A.play('lane'); break;
          case 'coin': A.play('coin'); g.cPulse = 1; Rd.burst('spark', D + 20, x, p.h + 40, 10, { up: 150, speed: 130, grav: 300, life: 0.55, size: 3, color: '#ffd54a', vz: sim.speed * 0.85 }); break;
          case 'cleared': A.play('cleared'); break;
          case 'stumble':
            A.play('stumble'); g.shake = 16; g.hitstop = 0.09;
            Rd.burst('chip', D + 30, x, 20, 16, { up: 220, speed: 170, grav: 700, life: 0.8, size: 3.5, color: '#7a5532', vz: sim.speed * 0.4 });
            if (g.settings.rearview) g.rearT = 1.9;
            break;
          case 'safe': A.play('safe'); toast('The boulder falls back', 1.6); break;
          case 'caught': A.play('caught'); g.shake = 26; break;
          case 'fell': A.play('fell'); break;
        }
      }
    }
  }

  function trackHeading(sim) {
    if (sim !== g.lastSim) { g.lastSim = sim; g.lastD = sim.d; }
    const dd = sim.d - g.lastD;
    if (dd > 0) Rd.heading += Rd.curveX(sim.d) * dd * 1.3;
    g.lastD = sim.d;
  }

  // ---------- update ----------
  function update(dt) {
    I.poll();
    g.time += dt; g.stateT += dt;
    g.fade = Math.max(0, g.fade - dt * 3);
    g.focusPop = Math.max(0, g.focusPop - dt * 5);
    g.shake = Math.max(0, g.shake - dt * 40);
    g.rearT = Math.max(0, g.rearT - dt);
    g.mPulse = Math.max(0, g.mPulse - dt * 3);
    g.cPulse = Math.max(0, g.cPulse - dt * 5);
    if (g.toastMsg) { g.toastMsg.life -= dt; if (g.toastMsg.life <= 0) g.toastMsg = null; }

    if (I.has('mute')) { A.muted = !A.muted; A.apply(); toast(A.muted ? 'Sound off' : 'Sound on', 1); }
    if (I.has('fullscreen')) toggleFullscreen();

    // hover focuses menu rows
    if (I.hover && I.hover.moved) {
      for (let i = g.buttons.length - 1; i >= 0; i--) {
        const b = g.buttons[i];
        if (inside(b, I.hover)) { if (b.focus !== undefined && b.focus !== g.focus) { g.focus = b.focus; g.focusPop = 1; A.play('move'); } break; }
      }
    }
    // taps / clicks on buttons
    let tapFree = false;
    for (const t of I.taps) {
      let hit = null;
      for (let i = g.buttons.length - 1; i >= 0; i--) if (inside(g.buttons[i], t)) { hit = g.buttons[i]; break; }
      if (hit) { if (hit.focus !== undefined) g.focus = hit.focus; hit.act(); return; }
      tapFree = true;
    }

    const st = g.state;
    if (st === 'play') return updatePlay(dt, tapFree);
    if (st === 'over') {
      g.overT += dt;
      const ev = R.step(g.sim, dt, {});
      effects(g.sim, ev, true);
      Rd.stepParticles(dt, g.sim.d, g.settings.motion);
      if (g.overT > 1.7) finishRun();
      return;
    }
    if (st === 'ready') {
      Rd.stepParticles(dt, g.sim.d, g.settings.motion);
      A.tension = 0.25;
      if (I.has('pause')) return g.pause();
      if (I.has('back') && !I.has('pause')) return g.back();
      if (g.stateT > 0.5 && (I.has('jump') || I.has('up') || I.has('confirm') || I.has('swipe') || tapFree)) beginPlay();
      return;
    }

    // demo run behind the menus
    if (MENU_STATES[st] || (st === 'settings' && g.settingsFrom === 'title')) {
      if (!g.demo) newDemo();
      const d = g.demo;
      const ev = R.step(d, dt, R.autopilot(d, 0.985));
      if (ev.indexOf('stumble') >= 0 && g.settings.motion) g.shake = Math.max(g.shake, 5);
      trackHeading(d);
      Rd.stepParticles(dt, d.d, g.settings.motion);
      if (d.state === 'over') { g.demoOver += dt; if (g.demoOver > 1.2) newDemo(); }
      if (d.run.m > 1800) newDemo();
    }

    // menu navigation
    const items = g.menu();
    if (st === 'wardrobe') {
      const n = R.HATS.length;
      if (I.has('left') || I.has('up')) { g.focus = (g.focus + n - 1) % n; g.focusPop = 1; A.play('move'); }
      if (I.has('right') || I.has('down')) { g.focus = (g.focus + 1) % n; g.focusPop = 1; A.play('move'); }
      if (I.has('confirm')) g.wear(g.focus);
      if (I.has('back')) g.back();
      return;
    }
    if (st === 'how') { if (I.has('back') || I.has('confirm')) g.back(); return; }
    if (items.length) {
      if (I.has('up')) { g.focus = (g.focus + items.length - 1) % items.length; g.focusPop = 1; A.play('move'); }
      if (I.has('down')) { g.focus = (g.focus + 1) % items.length; g.focusPop = 1; A.play('move'); }
      const it = items[g.focus];
      if (it && it.adjust && (I.has('left') || I.has('right'))) it.adjust(I.has('left') ? -1 : 1);
      if (I.has('confirm') && it) g.activate(it);
      else if (st === 'results' && I.has('restart')) startRun();
      else if (st === 'paused' && I.has('restart')) startRun();
      else if (st === 'paused' && I.has('pause') && !I.has('back')) resume();
      else if (I.has('back') && st !== 'title') g.back();
    }
  }

  function updatePlay(dt, tapFree) {
    const sim = g.sim;
    if (I.has('pause')) return g.pause();
    if (I.has('restart')) return startRun();
    g.playT += dt;
    const inp = {
      left: I.has('left'), right: I.has('right'),
      jump: I.has('jump') || I.has('up') || tapFree,
      slide: I.has('down') || I.has('slide'),
      slideHeld: I.held.down,
    };
    if (g.hitstop > 0) { g.hitstop -= dt; if (inp.left || inp.right || inp.jump || inp.slide) g.queued = inp; return; }
    if (g.queued) { for (const k in g.queued) inp[k] = inp[k] || g.queued[k]; g.queued = null; }
    const ev = R.step(sim, dt, inp);
    effects(sim, ev, true);
    trackHeading(sim);
    // running dust
    g.dustT -= dt;
    if (g.dustT <= 0 && sim.p.h <= 0 && g.settings.motion) { g.dustT = 0.09; Rd.burst('dust', sim.d + 4, sim.p.x * Rd.LANE + (Math.random() - 0.5) * 16, 1, 1, { up: 25, speed: 30, grav: 60, life: 0.45, size: 3, color: '#c4b383' }); }
    Rd.stepParticles(dt, sim.d, g.settings.motion);
    if (Math.floor(sim.run.m / 100) > Math.floor(g.lastM / 100)) { g.mPulse = 1; A.play('tick'); }
    g.lastM = sim.run.m;
    A.tension = Math.max(0, Math.min(1, (1 - sim.gap) / 0.65));
    if (sim.state === 'over') { g.state = 'over'; g.stateT = 0; g.overT = 0; }
  }

  const inside = (b, p) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;

  // ---------- render ----------
  function render() {
    const st = g.state;
    g.buttons.length = 0;
    const inRun = st === 'ready' || st === 'play' || st === 'paused' || st === 'over' || st === 'results' || (st === 'settings' && g.settingsFrom === 'paused') || ((st === 'wardrobe') && g.infoFrom === 'results');
    const sim = inRun && g.sim ? g.sim : g.demo || (g.demo = R.create());
    const intro = st === 'ready' ? Math.min(1, g.stateT / 1.1) : 1;
    const view = {
      sim, time: g.time, hat: inRun ? g.save.hat : (Math.floor(g.time / 6) % R.hatsUnlocked(g.save.mission)),
      settings: g.settings, shake: g.shake, intro: intro < 1 ? 1 - Math.pow(1 - intro, 3) : 1,
      over: st === 'over' ? g.overT : st === 'results' ? 2 : 0, boulder: true,
    };
    Rd.draw(ctx, view);
    if (st !== 'results' || !sim.p.fell) Rd.boulderPeek(ctx, view);
    if (sim.p.fell && (st === 'over' || st === 'results')) { ctx.fillStyle = `rgba(6,4,2,${Math.min(0.85, (st === 'results' ? 2 : g.overT) * 0.6)})`; ctx.fillRect(0, 0, g.W, g.H); }
    if (g.rearT > 0 && (st === 'play' || st === 'over')) {
      const k = Math.min(1, g.rearT / 0.3, (1.9 - g.rearT) / 0.25);
      const e = 1 - Math.pow(1 - Math.max(0, k), 3);
      Rd.rearView(ctx, view, e);
      UI.rearLabel(ctx, g, e);
    }

    if (st === 'title') UI.title(ctx, g);
    else if (st === 'wardrobe') UI.wardrobe(ctx, g);
    else if (st === 'how') UI.how(ctx, g);
    else if (st === 'settings') UI.settings(ctx, g);
    else if (st === 'ready') { UI.hud(ctx, g); UI.ready(ctx, g); }
    else if (st === 'play' || st === 'over') UI.hud(ctx, g);
    else if (st === 'paused') UI.paused(ctx, g);
    else if (st === 'results') UI.results(ctx, g);
    UI.toast(ctx, g);
    if (g.fade > 0) { ctx.fillStyle = `rgba(8,14,6,${g.fade * 0.6})`; ctx.fillRect(0, 0, g.W, g.H); }
    const hovering = I.hover && g.buttons.some((b) => inside(b, I.hover));
    canvas.style.cursor = hovering ? 'pointer' : 'default';
  }

  // ---------- boot ----------
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
    while (acc >= STEP) {
      update(STEP);
      const st = g.state;
      A.setMode(st === 'play' || st === 'ready' || st === 'over' ? 'run' : 'menu');
      if (st !== 'play' && st !== 'ready') A.tension = 0;
      A.update(STEP);
      I.endTick();
      acc -= STEP;
    }
    render();
  }
  requestAnimationFrame(frame);
  root.JG.game = g; // for debugging and browser checks
  // advance n fixed ticks synchronously (used by headless browser checks)
  root.JG.advance = function (n) {
    for (let i = 0; i < n; i++) { update(STEP); A.update(STEP); I.endTick(); }
    render();
    return g.state;
  };
})(window);
