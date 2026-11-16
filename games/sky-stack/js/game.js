// Sky Stack: states, menus, the camera and the run.
// States: title, settings, howto, play, paused, over (the fall), results.
(function () {
  const SS = window.SS;
  const A = SS.Audio, I = SS.Input, Wd = SS.World, R = SS.Rules;
  const BH = R.BLOCK_H, STEP = 1 / 60;
  const MENU = new Set(['title', 'settings', 'howto', 'paused', 'results']);

  const G = {
    state: 'title', stateT: 0, focus: 0, backStack: [], fade: 1, time: 0, buttons: [], toastMsg: null, confirmReset: false,
    save: null, s: null, mode: 'classic', tower: null, acc: 0, hitstop: 0, overT: 0, result: null, started: false,
    cam: 0, zoom: 1, yaw: 0, punch: 0, stageBanner: null,
    demo: null,

    init() {
      this.save = SS.Save.load();
      this.s = this.save.settings;
      A.setVolumes(this.s.sfx, this.s.music);
      this.newDemo();
      this.setState('title', true);
    },

    // ---------- flow ----------
    setState(st, fade) {
      this.state = st; this.stateT = 0; this.focus = 0; this.confirmReset = false;
      if (fade) this.fade = 1;
    },
    get back() { return this.backStack[this.backStack.length - 1] || null; },
    openSub(st) { this.backStack.push({ state: this.state, focus: this.focus }); this.setState(st); A.sfx('ok'); },
    closeSub() { const b = this.backStack.pop() || { state: 'title', focus: 0 }; this.setState(b.state); this.focus = b.focus; A.sfx('back'); },
    goTitle() { this.backStack = []; this.tower = null; this.newDemo(); this.setState('title', true); A.sfx('back'); },
    persist() { A.setVolumes(this.s.sfx, this.s.music); SS.Save.store(); },
    toast(str) { this.toastMsg = { str, life: 1.8 }; },

    start(mode) {
      A.unlock(); A.startMusic();
      this.mode = mode;
      const seed = mode === 'daily' ? SS.dailySeed() : (SS.hash(String(Math.random()) + Date.now()) >>> 0);
      this.tower = new SS.Tower(seed);
      this.acc = 0; this.hitstop = 0; this.overT = 0; this.result = null; this.started = false;
      this.cam = 0; this.zoom = 1; this.yaw = 0; this.punch = 0; this.stageBanner = null;
      Wd.debris.length = 0; Wd.fx.length = 0; Wd.pops.length = 0;
      this.backStack = [];
      this.setState('play', true);
      A.sfx('ok');
    },
    pause() {
      if (this.state !== 'play') return;
      this.setState('paused'); A.sfx('back');
    },
    resume() { this.setState('play'); A.sfx('ok'); },

    // ---------- menus (the UI draws them; this drives them) ----------
    menu() {
      const s = this.s;
      const slider = (key, label) => ({ label, slider: () => s[key], adjust: (d) => { s[key] = SS.clamp(s[key] + d, 0, 10); this.persist(); A.sfx('tick', s[key]); } });
      const toggle = (key, label, sub) => ({ label, sub, value: () => (s[key] ? 'On' : 'Off'), adjust: () => { s[key] = !s[key]; this.persist(); A.sfx('toggle', s[key]); } });
      switch (this.state) {
        case 'title': return {
          items: [
            { label: 'Play', sub: 'Classic tower', action: () => this.start('classic') },
            { label: 'Daily Tower', sub: 'Same blocks for everyone today', action: () => this.start('daily') },
            { label: 'Settings', action: () => this.openSub('settings') },
            { label: 'How to Play', action: () => this.openSub('howto') },
          ],
        };
        case 'settings': {
          const P = SS.Platform;
          const items = [slider('sfx', 'Sound effects'), slider('music', 'Music'), toggle('shake', 'Screen shake'), toggle('motion', 'Camera motion', 'Orbit, sway and flashes'), toggle('guide', 'Landing shadow', 'Shows where the block will land')];
          if (P.canFullscreen()) items.push({ label: 'Fullscreen', value: () => (P.isFullscreen() ? 'On' : 'Off'), adjust: () => P.toggleFullscreen() });
          if (this.back && this.back.state === 'title') items.push({
            label: this.confirmReset ? 'Tap again to erase' : 'Reset records', danger: true,
            action: () => {
              if (this.confirmReset) { const d = SS.Save.defaults(); this.save.best = 0; this.save.daily = {}; this.save.stats = d.stats; SS.Save.store(); this.confirmReset = false; this.toast('Records erased'); A.sfx('back'); }
              else { this.confirmReset = true; A.sfx('nav'); }
            },
          });
          items.push({ label: 'Back', action: () => this.closeSub() });
          return { items, back: () => this.closeSub() };
        }
        case 'howto': return { items: [{ label: 'Got it', action: () => this.closeSub() }], back: () => this.closeSub() };
        case 'paused': return {
          items: [
            { label: 'Resume', action: () => this.resume() },
            { label: 'Restart', action: () => this.start(this.mode) },
            { label: 'Settings', action: () => this.openSub('settings') },
            { label: 'How to Play', action: () => this.openSub('howto') },
            { label: 'Quit to Menu', action: () => this.goTitle() },
          ],
          back: () => this.resume(),
        };
        case 'results': return {
          items: [
            { label: 'Build again', action: () => this.start(this.mode) },
            this.mode === 'daily' ? { label: 'Classic tower', action: () => this.start('classic') } : { label: 'Daily tower', action: () => this.start('daily') },
            { label: 'Menu', action: () => this.goTitle() },
          ],
          back: () => this.goTitle(),
        };
      }
      return { items: [] };
    },
    activate(it) { if (!it) return; if (it.action) it.action(); else if (it.adjust) it.adjust(1); },

    hitButton(x, y) {
      const k = SS.UI.k, vx = x / k, vy = y / k;
      for (let i = this.buttons.length - 1; i >= 0; i--) {
        const b = this.buttons[i];
        if (vx >= b.x && vx <= b.x + b.w && vy >= b.y && vy <= b.y + b.h) return b;
      }
      return null;
    },

    handleMenu(events) {
      const m = this.menu(), items = m.items, n = items.length;
      if (!n) return;
      if (this.focus >= n) this.focus = n - 1;
      const defer = (i) => { if (i + 1 < events.length) I.queue.unshift(...events.slice(i + 1)); };
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (e.type === 'tap') {
          const b = this.hitButton(e.x, e.y);
          if (b) { if (b.focus !== undefined) this.focus = b.focus; b.action(); return defer(i); }
          continue;
        }
        const nav = I.NAV[e.code], it = items[this.focus];
        if (!nav) continue;
        if (nav === 'up') { this.focus = (this.focus - 1 + n) % n; A.sfx('nav'); }
        else if (nav === 'down') { this.focus = (this.focus + 1) % n; A.sfx('nav'); }
        else if ((nav === 'left' || nav === 'right') && it && it.adjust && (it.slider || it.value)) it.adjust(nav === 'left' ? -1 : 1);
        else if (nav === 'ok') { this.activate(it); return defer(i); }
        else if (nav === 'back' && m.back) { m.back(); return defer(i); }
        else if (nav === 'restart' && (this.state === 'results' || this.state === 'paused')) { this.start(this.mode); return defer(i); }
        else if (nav === 'mute') this.toggleMute();
      }
    },
    toggleMute() {
      if (this.s.sfx + this.s.music > 0) { this.s._mute = [this.s.sfx, this.s.music]; this.s.sfx = 0; this.s.music = 0; this.toast('Sound off'); }
      else { const m = this.s._mute || [7, 6]; this.s.sfx = m[0]; this.s.music = m[1]; this.toast('Sound on'); }
      this.persist();
    },

    // ---------- the run ----------
    drop() {
      const t = this.tower, res = t.drop();
      if (!res) return;
      this.started = true;
      const y = res.level * BH;
      if (res.type === 'miss') {
        Wd.addDebris(res.piece, y, res.axis, res.dir || 1, t.hueAt(res.level));
        A.sfx('fall');
        Wd.addShake(0.5);
        this.state = 'over'; this.overT = 0; this.stateT = 0;
        return;
      }
      if (res.type === 'perfect') {
        Wd.perfectFx(res.placed, y + BH, res.streak);
        A.sfx('perfect', res.streak);
        this.punch = 1;
        this.hitstop = 0.06;
        if (res.grew) { Wd.growFx(res.placed, y + BH, res.axis); A.sfx('grow'); }
      } else {
        Wd.addDebris(res.piece, y, res.axis, res.dir, t.hueAt(res.level));
        Wd.chipFx(res.placed, y + BH);
        A.sfx('place', res.level); A.sfx('slice', res.lost);
        Wd.addShake(0.12 + res.lost * 0.6);
      }
      if (res.stageUp > 0) {
        this.stageBanner = { text: R.STAGES[res.stageUp], t: 0 };
        A.sfx('stage');
      }
    },

    finish() {
      const t = this.tower, h = t.height(), sv = this.save;
      let best, newBest;
      if (this.mode === 'daily') { const d = SS.today(); best = sv.daily[d] || 0; newBest = h > best; if (newBest) sv.daily[d] = h; }
      else { best = sv.best || 0; newBest = h > best; if (newBest) sv.best = h; }
      sv.stats.towers++; sv.stats.floors += h; sv.stats.perfects += t.perfects;
      sv.stats.bestStreak = Math.max(sv.stats.bestStreak, t.bestStreak);
      SS.Save.store();
      this.result = { height: h, best: Math.max(best, h), newBest: newBest && h > 0, perfects: t.perfects, streak: t.bestStreak, stage: t.stage(), mode: this.mode };
      this.setState('results');
      if (this.result.newBest) A.sfx('best');
    },

    // ---------- the attract tower behind the title ----------
    newDemo() { this.demo = { tower: new SS.Tower(SS.hash('demo' + Math.floor(Math.random() * 9))), wait: 0.6, acc: 0 }; },
    stepDemo(dt) {
      const d = this.demo, t = d.tower;
      d.acc += dt;
      while (d.acc >= STEP) { t.step(STEP); d.acc -= STEP; }
      d.wait -= dt;
      const m = t.mover;
      if (t.over || t.height() > 34) { if (d.wait < -2.5) this.newDemo(); return; }
      if (!m || d.wait > 0) return;
      const delta = m[m.axis] - t.top()[m.axis];
      const sloppy = SS.hash('d' + t.height()) % 4 === 0;
      if ((!sloppy && Math.abs(delta) < 0.03) || (sloppy && Math.abs(delta) > 0.12 && Math.abs(delta) < 0.25)) {
        const res = t.drop();
        d.wait = 0.35;
        if (res && res.type === 'cut') Wd.addDebris(res.piece, res.level * BH, res.axis, res.dir, t.hueAt(res.level));
        if (res && res.type === 'perfect') Wd.perfectFx(res.placed, (res.level + 1) * BH, Math.min(res.streak, 2));
      }
    },

    // ---------- per frame ----------
    update(dt) {
      this.time += dt; this.stateT += dt;
      this.fade = Math.max(0, this.fade - dt * 2.4);
      if (this.toastMsg) { this.toastMsg.life -= dt; if (this.toastMsg.life <= 0) this.toastMsg = null; }
      if (this.stageBanner) { this.stageBanner.t += dt; if (this.stageBanner.t > 2.4) this.stageBanner = null; }
      const events = I.drain();
      const st = this.state;

      if (st === 'play') {
        for (let i = 0; i < events.length; i++) {
          const e = events[i];
          if (e.type === 'key' && I.PAUSE[e.code]) { this.pause(); break; }
          if (e.type === 'key' && e.code === 'KeyM') { this.toggleMute(); continue; }
          if (e.type === 'tap') { const b = this.hitButton(e.x, e.y); if (b) { b.action(); break; } }
          if ((e.type === 'tap' || I.DROP[e.code]) && this.tower && !this.tower.over) this.drop();
        }
        if (this.state === 'play') {
          if (this.hitstop > 0) this.hitstop -= dt;
          else { this.acc += dt; while (this.acc >= STEP) { this.tower.step(STEP); this.acc -= STEP; } }
        }
      } else if (st === 'over') {
        this.overT += dt;
        for (const e of events) if (e.type === 'key' && I.PAUSE[e.code] && this.overT > 0.5) this.overT = 99;
        if (this.overT > 2.2) this.finish();
      } else if (MENU.has(st)) this.handleMenu(events);

      if (!this.tower) this.stepDemo(dt);
      this.updateCamera(dt);
      A.setWorld(Wd.alt, Wd.night, this.tower ? this.tower.stage() : 0, this.state === 'play', this.time);
    },

    updateCamera(dt) {
      const t = this.tower || this.demo.tower;
      const top = t.stack.length * BH;
      const showcase = !this.tower || this.state === 'over' || this.state === 'results' || ((this.state === 'settings' || this.state === 'howto') && this.backStack.some((b) => b.state === 'results'));
      let camT, zoomT;
      this.punch = Math.max(0, this.punch - dt * 4);
      if (showcase) {
        // pull back to show the whole tower and circle it
        const base = Wd.base();
        zoomT = Math.min(1, (Wd.H * 0.52) / ((top + 2.2) * base));
        const S = base * this.zoom;
        camT = (top - 1.2) / 2 - (Wd.H * 0.64 - Wd.H * 0.5) / S;
        if (this.s.motion) this.yaw += dt * (this.tower ? 0.32 : 0.18);
      } else {
        camT = Math.max(0, t.stack.length - 5) * BH;
        zoomT = 1 + this.punch * 0.025 * (this.s.motion ? 1 : 0);
        // ease the orbit back to the playing angle (whole turns are fine)
        const k = Math.round(this.yaw / (Math.PI * 2)) * Math.PI * 2;
        this.yaw += (k - this.yaw) * Math.min(1, dt * 4);
      }
      this.cam += (camT - this.cam) * Math.min(1, dt * (showcase ? 2 : 5));
      this.zoom += (zoomT - this.zoom) * Math.min(1, dt * (showcase ? 2 : 8));
      // the sky follows the tower's height (not the camera), so it holds while the camera pulls back
      const altT = this.tower ? Math.max(0, this.tower.height() - 4) : 8 + Math.sin(this.time * 0.05) * 6;
      this.alt = this.alt === undefined ? altT : this.alt + (altT - this.alt) * Math.min(1, dt * 2);
      const alt = this.alt;
      Wd.step(dt, {
        alt, cam: this.cam, zoom: this.zoom, yaw: this.yaw, motion: this.s.motion,
        windy: !!this.tower && this.tower.windy() && this.state === 'play',
        foggy: !!this.tower && this.tower.foggy(),
        storm: !!this.tower && this.tower.stage() === 3,
        onThunder: () => A.sfx('thunder'),
      });
    },
  };

  SS.Game = G;
})();
