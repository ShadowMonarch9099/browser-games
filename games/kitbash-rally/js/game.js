// Game flow: title (with a live demo race behind it), cup select, garage,
// race, pause, results, podium, settings and how-to-play. Menus are made of
// widgets that register hit boxes each frame (see ui.js); this file moves the
// focus between them with keyboard / gamepad (spatially), mouse and touch.
(function () {
  const KR = window.KR;
  const U = KR.UI, C = U.C, FONT = U.FONT, BODY = U.BODY, A = KR.Audio, I = KR.Input;
  const W = 960, H = 540;
  const clamp = U.clamp;

  const Game = {
    state: 'title', stateT: 0, time: 0, back: null,
    btns: [], buttons: [], focusId: null, lastWasClick: false, pressId: null, pressT: 0, pressPulse: 0,
    trans: null, toastMsg: null, shakeAmt: 0, hitStop: 0,
    humans: 1, editing: 0, mode: 'cup', cup: 0, round: 0, trackIndex: 0, table: null,
    race: null, cams: [], demo: null, demoCam: null, demoFocus: 0, demoT: 0, demoTrack: 0,
    results: null, resultsT: 0, podium: null, confirmReset: false, lightsShown: 0,

    init() {
      this.save = KR.Save.load();
      this.settings = this.save.settings;
      this.builds = this.save.builds;
      A.setVolumes(this.settings.sfx, this.settings.music);
      this.newDemo();
    },
    persist() { KR.Save.store(this.save); },
    storeBuilds() { this.save.builds = this.builds; this.persist(); },
    shake(a) { if (this.settings.shake) this.shakeAmt = Math.max(this.shakeAmt, a); },
    toast(s) { this.toastMsg = { s, t: 2 }; },

    // ---------- focus + widgets ----------
    reg(b) { this.buttons.push(b); },
    isFocus(id) { return this.focusId === id; },
    setFocus(id) { this.focusId = id; },
    pressFx(id) { return this.pressId === id && this.pressT > 0 ? this.pressT / 0.12 : 0; },
    find(id) { return this.btns.find((b) => b.id === id); },
    press(b) {
      this.pressId = b.id; this.pressT = 0.12; this.pressPulse = 0.12;
      if (b.action) b.action();
    },
    moveFocus(dx, dy) {
      const cur = this.find(this.focusId);
      if (!cur) { if (this.btns[0]) this.focusId = this.btns[0].id; return; }
      const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
      let best = null, bs = 1e9;
      for (const b of this.btns) {
        if (b === cur || b.noFocus) continue;
        const bx = b.x + b.w / 2, by = b.y + b.h / 2, ddx = bx - cx, ddy = by - cy;
        const along = ddx * dx + ddy * dy, perp = Math.abs(ddx * dy - ddy * dx);
        if (along <= 4) continue;
        const sc = along + perp * 2.2;
        if (sc < bs) { bs = sc; best = b; }
      }
      if (best) { this.focusId = best.id; A.play('move'); }
    },
    menuInput() {
      const list = this.btns;
      if (!list.length) return;
      if (!this.find(this.focusId)) this.focusId = (this.defaultFocus && this.find(this.defaultFocus) ? this.defaultFocus : list[0].id);
      const cur = this.find(this.focusId);
      if (I.mouseMoved && I.mouse) {
        const h = this.hitAt(I.mouse);
        if (h && h.id !== this.focusId) { this.focusId = h.id; A.play('move'); }
      }
      for (const c of I.clicks) {
        const h = this.hitAt(c);
        if (h) {
          this.focusId = h.id; this.lastWasClick = true;
          if (h.slider && c.x >= h.slider.x - 10) { h.slider.set(Math.round(clamp((c.x - h.slider.x) / h.slider.w, 0, 1) * 10)); }
          else this.press(h);
          return true;
        }
      }
      if (I.nav('up')) { this.lastWasClick = false; this.moveFocus(0, -1); }
      if (I.nav('down')) { this.lastWasClick = false; this.moveFocus(0, 1); }
      if (I.nav('left')) { this.lastWasClick = false; if (cur && cur.adjust) cur.adjust(-1); else this.moveFocus(-1, 0); }
      if (I.nav('right')) { this.lastWasClick = false; if (cur && cur.adjust) cur.adjust(1); else this.moveFocus(1, 0); }
      if (I.nav('confirm') && cur) { this.lastWasClick = false; this.press(cur); return true; }
      return false;
    },
    hitAt(p) {
      for (let i = this.btns.length - 1; i >= 0; i--) { const b = this.btns[i]; if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b; }
      return null;
    },

    // ---------- flow ----------
    setState(s, focus) {
      this.state = s; this.stateT = 0; this.focusId = focus || null; this.defaultFocus = focus || null; this.confirmReset = false;
      this.btns = []; this.buttons = [];
    },
    go(s, fn, focus) {
      if (this.trans) return;
      this.trans = { t: 0, done: false, fn: () => { if (fn) fn(); this.setState(s, focus); } };
    },
    openSub(s) { this.back = { state: this.state, focus: this.focusId }; this.setState(s); },
    closeSub() { const b = this.back || { state: 'title' }; this.back = null; this.setState(b.state, b.focus); A.play('back'); },
    goTitle() { A.engineStop(); this.race = null; this.go('title', () => { if (!this.demo) this.newDemo(); }, 'm0'); },

    newDemo() {
      this.demoTrack = (this.demoTrack + 1 + Math.floor(Math.random() * 4)) % 6;
      this.demo = KR.createRace({ track: this.demoTrack, builds: [], difficulty: 1, demo: true });
      this.demo.time = this.demo.startT - 0.5;
      KR.Road.setup(this.demo);
      this.demoCam = KR.Road.newCam();
      this.demoFocus = Math.floor(Math.random() * 6);
      this.demoT = 0;
    },

    chooseCups(humans) {
      this.humans = humans; this.editing = 0;
      this.go('cups', null, 'cup0');
    },
    pickCup(c) {
      if (c > this.save.cups) { A.play('deny'); this.toast('Win the ' + KR.CUPS[c - 1].name + ' to unlock this cup'); return; }
      this.mode = 'cup'; this.cup = c; this.round = 0; this.table = {}; this.trackIndex = KR.CUPS[c].tracks[0];
      this.editing = 0; KR.Garage.enter(); this.go('garage', null, 'start');
    },
    pickTrack(t) {
      if (KR.TRACKS[t].cup > this.save.cups) { A.play('deny'); this.toast('Win the ' + KR.CUPS[KR.TRACKS[t].cup - 1].name + ' to race here'); return; }
      this.mode = 'single'; this.trackIndex = t; this.editing = 0; KR.Garage.enter(); this.go('garage', null, 'start');
    },
    editKart(i) { if (this.editing !== i) { this.editing = i; A.play('select'); KR.Garage.G.disp = null; } },
    garageSub() {
      const tr = KR.TRACKS[this.trackIndex].name.toUpperCase();
      return this.mode === 'cup' ? KR.CUPS[this.cup].name.toUpperCase() + '  ·  RACE ' + (this.round + 1) + ' OF 3  ·  ' + tr : 'SINGLE RACE  ·  ' + tr;
    },
    startLabel() { return this.mode === 'cup' ? (this.round === 0 ? 'START CUP ▶' : 'NEXT RACE ▶') : 'RACE ▶'; },
    startFromGarage() { this.go('race', () => this.startRace()); },
    backFromGarage() {
      A.play('back');
      if (this.mode === 'cup' && this.round > 0) {
        if (!(this.quitArmed > this.time)) { this.quitArmed = this.time + 2.5; this.toast('Back again to quit the ' + KR.CUPS[this.cup].name); return; }
      }
      this.go('cups', null, 'cup0');
    },

    startRace() {
      const builds = [];
      for (let i = 0; i < this.humans; i++) builds.push(this.builds[i].slice());
      this.race = KR.createRace({ track: this.trackIndex, builds, difficulty: this.settings.difficulty });
      KR.Road.setup(this.race);
      this.cams = [];
      for (let i = 0; i < this.humans; i++) this.cams.push(KR.Road.newCam());
      this.lightsShown = 0;
      this.hitStop = 0;
      A.finalLap = false;
      A.engineStart(this.humans);
      I.reset();
    },
    restartRace() { this.go('race', () => this.startRace()); },
    pause() {
      if (this.state !== 'race' || this.trans) return;
      this.setState('paused', 'p0');
      A.play('back');
      I.reset();
    },
    resume() { this.setState('race'); I.reset(); },

    views() {
      if (this.humans === 1) return [{ x: 0, y: 0, w: W, h: H }];
      return [{ x: 0, y: 0, w: W, h: 267 }, { x: 0, y: 273, w: W, h: 267 }];
    },
    me(i) { return this.race.karts.find((k) => k.human === i); },

    updateRace(dt) {
      const race = this.race, views = this.views();
      if (I.pausePressed()) { this.pause(); return; }
      if (I.touchUsed && this.humans === 1) for (const c of I.clicks) if (c.y < 44 && Math.abs(c.x - W / 2) < 30) { this.pause(); return; }
      const touch = this.touchUI() ? KR.Road.touchRects(views[0]) : null;
      const inputs = [];
      for (let i = 0; i < this.humans; i++) inputs.push(I.player(i, this.humans, touch, this.settings.autoGas));
      if (this.hitStop > 0) this.hitStop -= dt;
      else KR.stepRace(race, dt, inputs);
      // start lights
      const lit = Math.min(5, Math.floor(race.time / 0.6));
      if (race.time < race.startT && lit > this.lightsShown) { this.lightsShown = lit; A.play('light'); }
      if (race.time >= race.startT && this.lightsShown < 6) { this.lightsShown = 6; A.play('go'); }
      for (const e of race.events) this.onEvent(e, views);
      race.events.length = 0;
      for (let i = 0; i < this.humans; i++) {
        const me = this.me(i), cam = this.cams[i];
        KR.Road.feel(cam, me, views[i], dt, race, this.settings.motion);
        cam.gear = A.engineSet(i, me.speed, inputs[i].gas, me.boostT > 0, false);
        if (race.time > race.startT + 1 && cam.lastPlace && me.place !== cam.lastPlace && !me.done) {
          cam.popT = 0.5; cam.popDir = me.place < cam.lastPlace ? 1 : -1;
          A.play(cam.popDir > 0 ? 'pass' : 'lost', { vol: 0.7 });
        }
        cam.lastPlace = me.place;
      }
      A.finalLap = race.karts.some((k) => k.human >= 0 && !k.done && Math.floor(k.z / race.track.N) >= race.laps - 1);
      if (race.over) this.finishRace();
    },
    onEvent(e, views) {
      const k = e.k, i = k.human, mine = i >= 0, cam = mine ? this.cams[i] : null, v = mine ? views[i] : null;
      const vol = this.humans === 2 ? 0.7 : 1;
      switch (e.type) {
        case 'hop': if (mine) { A.play('hop', { vol }); KR.Road.burst(cam, v, k, 'hop'); } break;
        case 'boost': if (mine) { A.play('boost', { vol }); KR.Road.burst(cam, v, k, 'boost'); this.shakeCam(cam, 0.25); } break;
        case 'grass': if (mine) A.play('grass', { vol }); break;
        case 'wall': if (mine) { A.play('wall', { vol }); KR.Road.burst(cam, v, k, 'wall'); this.shakeCam(cam, 0.5); this.hitStop = 0.05; } break;
        case 'oil': if (mine) { A.play('oil', { vol }); KR.Road.burst(cam, v, k, 'oil'); this.shakeCam(cam, k.s.armor ? 0.2 : 0.45); } break;
        case 'pickup':
          if (mine) { A.play(e.item === 'bolt' ? 'bolt' : 'canister', { vol }); KR.Road.burst(cam, v, k, e.item === 'bolt' ? 'bolt' : 'canister'); }
          break;
        case 'bump': {
          const o = e.other, hard = Math.min(1, e.hard / 8);
          for (const kk of [k, o]) if (kk.human >= 0) {
            const c = this.cams[kk.human];
            A.play('bump', { vol: (0.4 + hard * 0.6) * vol });
            KR.Road.burst(c, views[kk.human], kk, 'bump');
            this.shakeCam(c, (kk.s.armor ? 0.2 : 0.4) * (0.5 + hard));
            if (hard > 0.5) this.hitStop = 0.06;
          }
          break;
        }
        case 'lap':
          if (mine) {
            const final = e.lap === this.race.laps - 1;
            A.play('lap', { vol });
            if (final) A.play('final', { delay: 0.25, vol });
            cam.banner = { text: final ? 'FINAL LAP' : 'LAP ' + (e.lap + 1), sub: 'LAST LAP ' + KR.Road.fmt(e.time), t: 2.2, max: 2.2, col: final ? '#ff5a1f' : '#ffc21a' };
            this.bestLap(k);
          }
          break;
        case 'finish':
          if (mine) {
            A.play('finish', { vol });
            this.bestLap(k);
            cam.banner = { text: 'FINISHED ' + k.place + KR.Road.ordinal(k.place), sub: 'TIME ' + KR.Road.fmt(k.time), t: 4, max: 4, col: k.place === 1 ? '#16c79a' : '#ffc21a' };
          }
          break;
      }
    },
    shakeCam(cam, a) { if (this.settings.shake && cam) cam.shake = Math.max(cam.shake, a); },
    bestLap(k) {
      if (!k.bestLap) return;
      const b = this.save.best[this.trackIndex];
      if (!b || k.bestLap < b) { this.save.best[this.trackIndex] = +k.bestLap.toFixed(2); this.persist(); }
    },

    finishRace() {
      const rows = KR.results(this.race);
      A.engineStop();
      if (this.mode === 'cup') rows.forEach((r) => { this.table[r.name] = (this.table[r.name] || 0) + r.points; });
      this.results = { rows, track: this.trackIndex };
      this.resultsT = 0;
      const best = rows.find((r) => r.human >= 0);
      A.play(best && best.place <= 3 ? 'fanfare' : 'lap');
      this.setState('results', 'r0');
    },
    nextRace() { this.round++; this.trackIndex = KR.CUPS[this.cup].tracks[this.round]; this.go('race', () => this.startRace()); },
    rebuild() { this.round++; this.trackIndex = KR.CUPS[this.cup].tracks[this.round]; KR.Garage.enter(); this.go('garage', null, 'start'); },
    toPodium() {
      const standings = Object.entries(this.table).sort((a, b) => b[1] - a[1]);
      const humanNames = KR.HUMANS.slice(0, this.humans).map((h) => h.name);
      const bestHuman = standings.findIndex(([n]) => humanNames.includes(n));
      const won = bestHuman === 0;
      const unlocked = won && this.save.cups < this.cup + 1 && this.cup + 1 < KR.CUPS.length;
      if (won) this.save.cups = Math.max(this.save.cups, this.cup + 1);
      const prev = this.save.trophies[this.cup];
      if (!prev || bestHuman + 1 < prev) this.save.trophies[this.cup] = bestHuman + 1;
      this.persist();
      const kartOf = (name) => {
        const h = KR.HUMANS.findIndex((x) => x.name === name);
        if (h >= 0 && h < this.humans) return { build: this.builds[h], color: KR.HUMANS[h].color };
        const c = KR.CPU.find((x) => x.name === name);
        return { build: c.build, color: c.color };
      };
      this.podium = { standings, won, unlocked, place: bestHuman + 1, karts: standings.slice(0, 3).map(([n]) => { const k = kartOf(n); return KR.Model.buildKart(k.build, k.color); }), confetti: [] };
      A.play(won ? 'fanfare' : 'finish');
      this.go('podium', null, 'pd0');
    },
    touchUI() { return I.touchUsed && I.device === 'touch' && this.humans === 1; },

    // ---------- settings ----------
    applySettings() { A.setVolumes(this.settings.sfx, this.settings.music); this.persist(); },
    resetProgress() {
      const d = KR.Save.defaults();
      this.save.cups = 0; this.save.best = {}; this.save.trophies = {};
      this.save.builds = d.builds; this.builds = this.save.builds;
      this.persist();
      this.toast('Progress and karts reset');
    },

    // ---------- main update ----------
    update(dt) {
      this.time += dt;
      this.stateT += dt;
      if (this.pressT > 0) this.pressT -= dt;
      if (this.pressPulse > 0) this.pressPulse -= dt;
      if (this.toastMsg && (this.toastMsg.t -= dt) <= 0) this.toastMsg = null;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2);
      if (I.key('KeyM')) { A.muted = !A.muted; A.applyVolumes(); this.toast(A.muted ? 'Sound off (M)' : 'Sound on'); }
      if (this.trans) {
        const tr = this.trans;
        tr.t += dt;
        if (!tr.done && tr.t >= 0.3) { tr.done = true; tr.fn(); }
        if (tr.t >= 0.66) this.trans = null;
        this.music();
        return;
      }
      const s = this.state;
      if (s === 'title' || s === 'cups' || s === 'tracks' || ((s === 'settings' || s === 'howto') && this.back && this.back.state !== 'paused')) this.updateDemo(dt);
      switch (s) {
        case 'race': this.updateRace(dt); break;
        case 'paused':
          for (let i = 0; i < this.humans; i++) A.engineSet(i, 0, 0, false, true);
          if (I.pausePressed() && this.stateT > 0.1) { this.resume(); break; }
          if (I.key('KeyR')) { this.restartRace(); break; }
          if (!this.menuInput() && I.nav('back')) this.resume();
          break;
        case 'garage':
          KR.Garage.update(this, dt);
          if (this.humans === 2 && I.nav('prev')) this.editKart(0);
          if (this.humans === 2 && I.nav('next')) this.editKart(1);
          if (!this.menuInput() && I.nav('back')) this.backFromGarage();
          break;
        case 'results':
          this.resultsT += dt;
          if (this.resultsT > 0.5) {
            if (I.key('KeyR') && this.mode === 'single') { this.restartRace(); break; }
            this.menuInput();
          }
          break;
        case 'podium':
          this.updatePodium(dt);
          if (this.stateT > 0.6 && !this.menuInput() && I.nav('back')) this.go('cups', null, 'cup0');
          break;
        default:
          if (!this.menuInput() && I.nav('back')) this.onBack();
      }
      this.music();
    },
    onBack() {
      const s = this.state;
      if (s === 'settings' || s === 'howto') this.closeSub();
      else if (s === 'cups') { A.play('back'); this.go('title', null, 'm0'); }
      else if (s === 'tracks') { A.play('back'); this.go('cups', null, 'cup2'); }
    },
    updateDemo(dt) {
      const d = this.demo;
      if (!d) return;
      KR.stepRace(d, dt, []);
      d.events.length = 0;
      this.demoT += dt;
      if (this.demoT > 11) { this.demoT = 0; this.demoFocus = (this.demoFocus + 1) % d.karts.length; }
      const me = d.karts[this.demoFocus];
      KR.Road.feel(this.demoCam, me, { x: 0, y: 0, w: W, h: H }, dt, d, false);
      if (d.over || d.time > 160) this.newDemo();
    },
    updatePodium(dt) {
      const p = this.podium;
      if (!p) return;
      if (p.won && this.settings.motion && p.confetti.length < 160 && Math.random() < 0.8) {
        for (let i = 0; i < 3; i++) p.confetti.push({ x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 80, r: Math.random() * 6, vr: (Math.random() - 0.5) * 8, c: ['#ffc21a', '#d7263d', '#16c79a', '#2a6fdb', '#f2ead8'][Math.floor(Math.random() * 5)] });
      }
      for (let i = p.confetti.length - 1; i >= 0; i--) { const c = p.confetti[i]; c.x += c.vx * dt + Math.sin(this.time * 3 + i) * 0.5; c.y += c.vy * dt; c.r += c.vr * dt; if (c.y > H + 10) p.confetti.splice(i, 1); }
    },
    music() {
      const s = this.state;
      if (s === 'race' || s === 'paused') A.setStyle('race', this.trackIndex + 1);
      else if (s === 'podium') A.setStyle('podium', 1);
      else A.setStyle('garage', 0);
      A.updateMusic();
    },

    // ---------- drawing ----------
    draw(ctx) {
      this.buttons = [];
      const s = this.state;
      ctx.save();
      if (this.shakeAmt > 0) ctx.translate((Math.random() - 0.5) * this.shakeAmt * 12, (Math.random() - 0.5) * this.shakeAmt * 8);
      const opts = { time: this.time, dt: 1 / 60, motion: this.settings.motion, units: this.settings.units };
      if (s === 'race' || s === 'paused' || s === 'results') {
        if (this.race) {
          const views = this.views();
          views.forEach((v, i) => KR.Road.view(ctx, this.race, this.me(i), this.cams[i], v, Object.assign({}, opts, { draw: this.humans === 2 ? 130 : 200, touch: this.touchUI() && s === 'race', gear: this.cams[i].gear, dt: s === 'race' ? 1 / 60 : 0 })));
          if (this.humans === 2) { U.hazard(ctx, 0, 267, W, 6, this.time * 20); }
        }
        if (s === 'paused') KR.Screens.paused(ctx, this);
        if (s === 'results') KR.Screens.results(ctx, this);
      } else if (s === 'garage') KR.Garage.draw(ctx, this);
      else if (s === 'podium') KR.Screens.podium(ctx, this);
      else {
        // menus over the attract-mode race
        if (this.demo) KR.Road.view(ctx, this.demo, this.demo.karts[this.demoFocus], this.demoCam, { x: 0, y: 0, w: W, h: H }, Object.assign({}, opts, { draw: 170, noHud: true }));
        KR.Screens[s](ctx, this);
      }
      ctx.restore();
      if (this.toastMsg) KR.Screens.toast(ctx, this);
      if (this.trans) {
        const t = this.trans.t;
        U.shutter(ctx, t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.36, this.time);
      }
      this.btns = this.buttons;
    },
  };

  KR.Game = Game;
})();
