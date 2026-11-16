// Knot Alone game flow: base camp (the title, with the camera drifting up the
// next route), routes, climbing, pause and the summit card.
(function () {
  const R = KA.Rules, V = KA.View, M = KA.Menus, A = KA.Audio, I = KA.Input, S = KA.Save;
  const $ = (id) => document.getElementById(id);
  const NAMES = ['Red', 'Teal'];
  const IDLE = { x: 0, jump: false, up: false, down: false, anchor: false };
  const HOLD = { x: 0, jump: false, up: false, down: false, anchor: true };
  const meta = Array.from({ length: R.LEVELS }, (_, i) => { const lv = R.makeLevel(i + 1); return { name: lv.name, height: lv.flag.y, steps: lv.ledges.length - 1, par: lv.par }; });
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const G = {
    state: 'title', from: 'title', settings: null, sim: null, n: 1, mode: 2, active: 0, wonT: 0, muted: false, demoT: 0, tips: [], resetArm: false,

    init() {
      this.settings = S.settings();
      this.mode = S.mode();
      M.init((a, arg) => this.act(a, arg));
      this.buildSettings(); this.apply();
      this.sim = R.create(S.level());
      V.snap(R.COLS / 2, 2);
      this.showTitle();
    },
    apply() {
      const s = this.settings;
      A.setVolumes(this.muted ? 0 : s.sfx, this.muted ? 0 : s.music);
      document.body.classList.toggle('reduced', !!s.reduced);
      V.reduced = !!s.reduced; V.snowOn = !!s.snow;
      S.storeSettings(s);
    },
    buildSettings() {
      const s = this.settings, ch = (k) => (v) => { s[k] = v; this.apply(); };
      const fs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
      M.renderSettings([
        { key: 'sfx', label: 'Sound effects', type: 'slider', get: () => s.sfx, set: ch('sfx') },
        { key: 'music', label: 'Folk music', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'shake', label: 'Screen shake', note: 'When someone takes a fall', type: 'toggle', get: () => s.shake, set: ch('shake') },
        { key: 'snow', label: 'Falling snow', type: 'toggle', get: () => s.snow, set: ch('snow') },
        { key: 'reduced', label: 'Reduced motion', type: 'toggle', get: () => s.reduced, set: ch('reduced') },
        { key: 'fs', label: 'Fullscreen', type: 'action', text: () => (fs() ? 'On' : 'Off'), run: () => { this.fullscreen(); setTimeout(() => M.paintSettings(), 300); } },
        { key: 'reset', label: 'Reset progress', type: 'action', labelFn: () => (this.resetArm ? 'Press again to forget every summit' : 'Reset progress'), text: () => '', run: () => {
          if (!this.resetArm) { this.resetArm = true; A.play('deny'); return; }
          this.resetArm = false; S.reset(); A.play('back'); M.toast('Back to base camp');
        } },
      ]);
    },
    fullscreen() {
      const d = document, el = d.documentElement;
      try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { M.toast('No fullscreen here'); }
    },

    showTitle() {
      const n = S.level();
      $('t-two').textContent = `Climb ${n}: ${meta[n - 1].name}`;
      $('t-pins').textContent = `${S.total()} of ${R.LEVELS * 3} summit pins`;
      M.show('title');
    },
    openLevels() {
      this.from = this.state === 'paused' ? 'pause' : this.state === 'result' ? 'result' : 'title';
      M.renderLevels({ levels: R.LEVELS, unlocked: S.level(), pins: S.pins(), best: S.bests(), total: S.total(), current: this.state === 'title' ? S.level() : this.n, meta });
      this.paintSeg();
      A.play('confirm');
      M.show('levels', true);
    },
    paintSeg() { $('seg-2').classList.toggle('sel', this.mode === 2); $('seg-1').classList.toggle('sel', this.mode === 1); },
    start(n, mode) {
      if (mode) { this.mode = mode; S.setMode(mode); }
      A.play('confirm');
      M.fade(true);
      setTimeout(() => {
        this.n = n; this.sim = R.create(n); this.active = 0; this.wonT = 0;
        I.clearAnchors();
        const [a, b] = this.sim.climbers;
        V.snap((a.x + b.x) / 2, 1);
        this.state = 'play';
        document.body.classList.toggle('solo', this.mode === 1);
        $('hud').classList.remove('off'); $('touch').classList.remove('off');
        $('h-climb').textContent = `Climb ${n} of ${R.LEVELS}`; $('h-name').textContent = meta[n - 1].name;
        this.paintWho();
        M.show(null); M.fade(false);
        M.toast(`${meta[n - 1].name} · ${meta[n - 1].height} m`);
        this.tips = n === 1 ? [[3, 'Both climbers must reach the flag'], [9, 'Hold anchor, then up reels your partner in'], [16, 'Too high? Stand on your partner’s head and jump']] : [];
      }, this.settings.reduced ? 0 : 280);
    },
    quit() {
      M.fade(true);
      setTimeout(() => {
        this.state = 'title';
        document.body.classList.remove('solo');
        $('hud').classList.add('off'); $('touch').classList.add('off');
        this.sim = R.create(S.level()); this.demoT = 0;
        this.showTitle(); M.fade(false);
      }, this.settings.reduced ? 0 : 280);
    },
    pause() {
      if (this.state !== 'play') return;
      this.state = 'paused'; A.play('back');
      $('hud').classList.add('off'); $('touch').classList.add('off');
      M.show('pause', true);
    },
    resume() {
      if (this.state !== 'paused') return;
      this.state = 'play'; A.play('confirm');
      $('hud').classList.remove('off'); $('touch').classList.remove('off');
      M.show(null);
    },
    act(a, arg) {
      switch (a) {
        case 'mode-2': return this.start(S.level(), 2);
        case 'mode-1': return this.start(S.level(), 1);
        case 'set-mode-2': this.mode = 2; S.setMode(2); A.play('move'); return this.paintSeg();
        case 'set-mode-1': this.mode = 1; S.setMode(1); A.play('move'); return this.paintSeg();
        case 'levels': return this.openLevels();
        case 'play-level': return this.start(arg);
        case 'how': this.from = 'title'; A.play('confirm'); return M.show('how', true);
        case 'settings': this.from = this.state === 'paused' ? 'pause' : 'title'; this.resetArm = false; this.buildSettings(); A.play('confirm'); return M.show('settings', true);
        case 'back': A.play('back'); if (this.from === 'title') return this.showTitle(); return M.show(this.from, true);
        case 'pause': return this.pause();
        case 'resume': return this.resume();
        case 'restart': return this.start(this.n);
        case 'next': return this.start(Math.min(R.LEVELS, this.n + 1));
        case 'quit': A.play('back'); return this.quit();
      }
    },
    swap() {
      if (this.state !== 'play' || this.mode !== 1) return;
      this.active = 1 - this.active;
      const c = this.sim.climbers[this.active];
      A.play('swap'); V.puff(c.x, c.y + 0.5, 6, V.TEAM[this.active].l);
      this.paintWho();
    },
    paintWho() { $('h-who').textContent = NAMES[this.active]; $('h-who').style.color = V.TEAM[this.active].l; },

    onEvents(evs) {
      const sh = this.settings.shake;
      for (const e of evs) {
        if (e.type === 'jump') { A.play('jump', e.i); V.puff(e.x, e.y, 4); }
        else if (e.type === 'land') { if (e.drop > 0.4) { A.play('land', e.drop); V.puff(e.x, e.y, 3 + Math.min(8, Math.round(e.drop * 2))); } }
        else if (e.type === 'fall') { A.play('thud'); if (sh) V.shake = Math.min(1, e.drop / 6); M.toast(e.drop > 5 ? 'Oof. Long way down' : 'Careful up there'); }
        else if (e.type === 'head') A.play('head');
        else if (e.type === 'anchor') A.play('anchor');
        else if (e.type === 'release') A.play('release');
        else if (e.type === 'reel') A.play('reel', e.dir);
        else if (e.type === 'taut') A.play('taut');
        else if (e.type === 'win') {
          this.state = 'won'; this.wonT = 0;
          A.play('win');
          const f = this.sim.lv.flag; V.confetti(f.x + f.w / 2, f.y + 1);
          $('touch').classList.add('off');
        }
      }
    },
    showResult() {
      const s = this.sim, secs = Math.max(1, Math.round(s.time)), par = s.lv.par;
      const pins = secs <= par ? 3 : secs <= par * 1.6 ? 2 : 1;
      const res = S.win(this.n, secs, pins);
      this.state = 'result';
      $('hud').classList.add('off');
      $('r-kicker').textContent = `Climb ${this.n} · ${meta[this.n - 1].name}`;
      $('r-title').textContent = this.n === R.LEVELS ? 'Summit of summits!' : res.record ? 'Summit, and a record!' : 'Summit!';
      [...$('r-pins').children].forEach((el, i) => el.classList.toggle('on', i < pins));
      $('r-stats').innerHTML = `<div><b>${fmt(secs)}</b><small>time</small></div><div><b>${fmt(res.best)}</b><small>best</small></div><div><b>${s.falls}</b><small>falls</small></div>`;
      $('r-next').style.display = this.n >= R.LEVELS ? 'none' : '';
      M.show('result', true);
    },
    hud() {
      const s = this.sim, f = s.lv.flag;
      $('h-time').textContent = fmt(s.time);
      $('h-falls').textContent = s.falls ? `${s.falls} fall${s.falls === 1 ? '' : 's'}` : '';
      const r = $('h-rope');
      r.style.width = ((s.ropeLen - R.ROPE_MIN) / (R.ROPE_MAX - R.ROPE_MIN)) * 100 + '%';
      r.classList.toggle('taut', s.taut);
      s.climbers.forEach((c, i) => { $('h-a' + i).style.bottom = Math.max(0, Math.min(1, c.y / f.y)) * 100 + '%'; });
      const flags = I.anchorFlags();
      document.querySelectorAll('#touch .pad').forEach((p) => p.querySelector('.anc').classList.toggle('on', !!flags[+p.dataset.p]));
    },

    update(dt) {
      I.poll();
      for (const e of I.take()) {
        if (e === 'mute') { this.muted = !this.muted; this.apply(); M.toast(this.muted ? 'Sound off' : 'Sound on'); continue; }
        if (this.state === 'play') {
          if (e === 'back' || e === 'pause') this.pause();
          else if (e === 'swap') this.swap();
          continue;
        }
        if (this.state === 'won') continue;
        const cur = M.current && M.current.id;
        if (e === 'back' || e === 'pause') {
          if (cur === 's-pause') this.resume();
          else if (['s-settings', 's-how', 's-levels'].includes(cur)) this.act('back');
          continue;
        }
        if (e === 'confirm') M.confirm();
        else if (['up', 'down', 'left', 'right'].includes(e)) M.nav(e);
      }
      V.tick(dt);
      const s = this.sim;
      const prog = s ? Math.max(0, Math.min(1, V.camY / Math.max(1, s.lv.flag.y))) : 0;
      A.setWind(prog, this.state === 'play' || this.state === 'won');
      A.update(this.state === 'play');
      if (this.state === 'play') {
        let ctl;
        if (this.mode === 1) { ctl = [HOLD, HOLD]; ctl[this.active] = I.control(this.active, true); }
        else ctl = [I.control(0, false), I.control(1, false)];
        this.onEvents(R.step(s, dt, ctl));
        const [a, b] = s.climbers, c = s.climbers[this.active];
        if (this.mode === 1) V.follow(c.x, c.y + 1, dt); else V.follow((a.x + b.x) / 2, (a.y + b.y) / 2 + 1, dt);
        if (this.tips.length && s.time > this.tips[0][0]) M.toast(this.tips.shift()[1]);
        this.hud();
      } else if (this.state === 'won') {
        this.wonT += dt;
        R.step(s, dt, [IDLE, IDLE]);
        const f = s.lv.flag; V.follow(f.x + f.w / 2, f.y + 1.5, dt);
        if (this.wonT > 2.4) this.showResult();
      } else if (this.state === 'title' || this.state === 'result') {
        // base camp: the camera drifts slowly up the route and back
        this.demoT += dt;
        const top = s.lv.flag.y + 1;
        V.follow(R.COLS / 2, (0.5 - 0.5 * Math.cos(this.demoT * 0.12)) * top, dt * 0.5);
        if (this.state === 'title') R.step(s, dt, [IDLE, IDLE]);
      }
      I.endFrame();
    },
    render(g) { V.draw(g, this.sim, { solo: this.mode === 1 && this.state === 'play', active: this.active, arrows: this.state === 'play' }); },
  };
  KA.Game = G;
})();
