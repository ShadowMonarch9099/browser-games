// Gate Stampede: screens, the march, results, and the demo behind the title.
// Rules in rules.js, drawing in view.js, HTML menus in menus.js.
(function () {
  const { Rules: R, View: V, Menus: M, Audio: A, Save: S, Input: I } = GS;
  const $ = (s) => document.querySelector(s);
  const G = {
    state: 'title', back: 'title', level: 1, s: null, demo: null, shake: 0, endT: 0, countdown: 0, settings: S.settings(), resetArm: false, lastStep: 0,

    init() {
      this.apply();
      M.init((a, arg) => this.act(a, arg));
      this.settingsUI();
      this.toTitle(true);
    },
    apply() {
      A.setVolumes(this.settings.sfx, this.settings.music);
      document.body.classList.toggle('reduced', !!this.settings.reduced);
      S.storeSettings(this.settings);
    },
    settingsUI() {
      const s = this.settings, ch = (k) => (v) => { s[k] = v; this.apply(); };
      const fs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
      M.renderSettings([
        { key: 'sfx', label: 'Sound effects', type: 'slider', get: () => s.sfx, set: ch('sfx') },
        { key: 'music', label: 'Marching band', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'sense', label: 'Steering speed', note: 'For keys and gamepad', type: 'slider', get: () => s.sense, set: (v) => { s.sense = Math.max(1, v); this.apply(); } },
        { key: 'shake', label: 'Screen shake', type: 'toggle', get: () => s.shake, set: ch('shake') },
        { key: 'reduced', label: 'Reduced motion', type: 'toggle', get: () => s.reduced, set: ch('reduced') },
        { key: 'fs', label: 'Fullscreen', type: 'action', text: () => (fs() ? 'On' : 'Off'), run: () => { this.fullscreen(); setTimeout(() => M.paintSettings(), 300); } },
        { key: 'reset', label: 'Reset progress', type: 'action', labelFn: () => (this.resetArm ? 'Press again to erase stars' : 'Reset progress'), text: () => '', run: () => {
          if (!this.resetArm) { this.resetArm = true; A.play('deny'); return; }
          S.reset(); this.resetArm = false; M.toast('Toy box emptied'); this.refreshTitle();
        } },
      ]);
    },
    fullscreen() {
      const d = document, el = d.documentElement;
      try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { M.toast('No fullscreen here'); }
    },

    // ---------- screens ----------
    show(state, screen, dim) { this.state = state; M.show(screen, dim); $('#hud').classList.toggle('off', state !== 'play'); },
    flash() { M.fade(true); setTimeout(() => M.fade(false), 200); },
    refreshTitle() {
      const lv = S.level();
      $('#t-play').textContent = S.total() ? 'March on!' : 'March!';
      $('#t-level').textContent = 'Level ' + Math.min(lv, R.LEVELS);
      $('#t-stars').textContent = `${S.total()} / ${R.LEVELS * 3} ★`;
    },
    toTitle(first) {
      this.refreshTitle(); this.back = 'title';
      this.demo = R.create(1 + Math.floor(Math.random() * 8));
      if (!first) this.flash();
      this.show('title', 'title');
    },
    open(screen) {
      if (this.state === 'paused') this.back = 'paused';
      else if (this.state === 'title') this.back = 'title';
      else if (this.state === 'result') this.back = 'result';
      if (screen === 'levels') M.renderLevels({ levels: R.LEVELS, unlocked: S.level(), stars: S.stars(), total: S.total(), current: this.level });
      if (screen === 'settings') { this.resetArm = false; M.paintSettings(); }
      this.show(screen, screen, true);
    },
    goBack() {
      if (this.back === 'paused') this.show('paused', 'pause', true);
      else if (this.back === 'result') this.show('result', 'result', true);
      else this.toTitle();
    },

    // ---------- the march ----------
    load(lv) {
      this.level = lv;
      this.s = R.create(lv);
      this.demo = null;
      V.camX = 0; V.pops = []; V.parts = [];
      this.endT = 0; this.countdown = 1.4;
      $('#hud-level').textContent = 'Level ' + lv;
      $('#hud-castle').textContent = this.s.L.castle;
      this.flash();
      this.show('play', null);
      A.play('go');
    },
    events(ev) {
      for (const e of ev) {
        if (e.type === 'gate') {
          V.pop(e.text, e.good);
          if (e.good) { A.play('good', e.after > e.before * 1.8 ? 2 : 1); V.confetti(12, ['#f7c548', '#2f6fdb', '#ffffff']); }
          else { A.play('bad'); if (this.settings.shake) this.shake = 0.25; }
        } else if (e.type === 'saw') { V.pop(e.text, false); A.play('saw'); if (this.settings.shake) this.shake = 0.4; }
        else if (e.type === 'rivals') { V.pop(e.text, false); A.play('clash'); V.confetti(16, ['#c1121f', '#2f6fdb']); if (this.settings.shake) this.shake = 0.3; }
        else if (e.type === 'win') { A.play('win'); V.confetti(80, ['#e63946', '#2f6fdb', '#2a9d5c', '#f7c548']); }
        else if (e.type === 'short' || e.type === 'wiped') A.play('lose');
      }
    },
    result() {
      const s = this.s, L = s.L;
      const stars = s.won ? R.stars(s.n, L.castle) : 0;
      $('#r-kicker').textContent = 'Level ' + this.level;
      if (s.won) {
        const res = S.win(this.level, stars);
        $('#r-title').textContent = 'Castle taken!';
        $('#r-note').textContent = `${s.n} soldiers stormed ${L.castle} guards.` + (res.improved ? ' New best!' : '');
        $('#r-next').style.display = '';
        $('#r-next b').textContent = this.level >= R.LEVELS ? 'Back to level 1' : 'Next level';
      } else {
        $('#r-title').textContent = s.n <= 0 ? 'Nobody left!' : 'Not enough soldiers';
        $('#r-note').textContent = s.n <= 0 ? 'The whole army fell. Look out for red gates and saws.' : `${s.n} soldiers against ${L.castle} guards. Pick bigger gates.`;
        $('#r-next').style.display = 'none';
      }
      const st = document.querySelectorAll('#r-stars i');
      st.forEach((el) => el.classList.remove('on'));
      st.forEach((el, i) => { if (i < stars) setTimeout(() => { el.classList.add('on'); A.play('star', i); }, 350 + i * 250); });
      this.show('result', 'result', true);
    },

    // ---------- actions ----------
    act(a, arg) {
      A.play(a === 'back' ? 'back' : 'confirm');
      switch (a) {
        case 'play': this.load(Math.min(S.level(), R.LEVELS)); break;
        case 'levels': this.open('levels'); break;
        case 'settings': this.open('settings'); break;
        case 'how': this.open('how'); break;
        case 'back': this.goBack(); break;
        case 'play-level': this.load(arg); break;
        case 'pause': this.pause(); break;
        case 'resume': this.show('play', null); break;
        case 'restart': this.load(this.level); break;
        case 'next': this.load(this.level >= R.LEVELS ? 1 : this.level + 1); break;
        case 'quit': this.toTitle(); break;
      }
    },
    pause() { if (this.state === 'play') { this.back = 'paused'; this.show('paused', 'pause', true); } },
    input(list) {
      for (const a of list) {
        if (a === 'mute') { const off = this.settings.sfx + this.settings.music > 0; this.settings.sfx = off ? 0 : 8; this.settings.music = off ? 0 : 6; this.apply(); M.toast(off ? 'Band silenced' : 'Band playing'); continue; }
        if (this.state === 'play') {
          if (a === 'back' || a === 'pause') this.pause();
          else if (a === 'restart') this.load(this.level);
          else if (a === 'hopL' || a === 'hopR') this.nudge = a === 'hopL' ? -1 : 1;
          continue;
        }
        if (['up', 'down', 'left', 'right'].includes(a)) M.nav(a);
        else if (a === 'confirm') M.confirm();
        else if (a === 'back' || a === 'pause') { if (this.state === 'paused') this.show('play', null); else if (this.state !== 'title') this.act('back'); }
      }
    },

    update(dt) {
      I.poll();
      this.input(I.take());
      A.update(this.state === 'play');
      V.update(dt);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
      if (this.state === 'title' || (!this.s && this.demo)) {
        const d = this.demo;
        if (d) { R.step(d, dt, R.autopilot(d)); if (d.state === 'done') this.demo = R.create(1 + Math.floor(Math.random() * 8)); }
        return;
      }
      if (this.state !== 'play' || !this.s) return;
      const s = this.s;
      if (this.countdown > 0) { this.countdown -= dt; return; }
      if (s.state === 'playing') {
        const steer = I.steer();
        let inp;
        if (I.drag) inp = { target: Math.max(-0.85, Math.min(0.85, I.drag.cx0 + (I.drag.x - I.drag.x0) / (V.W * 0.32))) };
        else inp = { steer: steer * (0.5 + this.settings.sense / 10) };
        if (this.nudge) { inp.nudge = this.nudge; this.nudge = 0; }
        this.events(R.step(s, dt, inp));
        $('#hud-prog').style.width = Math.min(100, (s.dist / s.L.end) * 100) + '%';
        if (s.dist - this.lastStep > 90) { this.lastStep = s.dist; A.play('step'); }
      } else {
        this.endT += dt;
        if (this.endT > (s.won ? 1.6 : 1.1)) { this.s.state = 'shown'; this.result(); }
      }
    },
    render(c) {
      c.clearRect(0, 0, V.W, V.H);
      const s = this.state === 'title' || !this.s ? this.demo : this.s;
      if (!s) return;
      c.save();
      if (this.shake > 0 && !this.settings.reduced) c.translate((Math.random() - 0.5) * this.shake * 26, (Math.random() - 0.5) * this.shake * 26);
      V.draw(c, s);
      c.restore();
      if (this.state === 'play' && this.countdown > 0) {
        const n = Math.ceil(this.countdown / 0.47);
        c.font = `400 ${Math.round(Math.min(V.W, V.H) * 0.2)}px 'Bowlby One SC', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = '#2b1d14'; c.fillText(n > 0 ? n : 'GO', V.W / 2 + 5, V.H * 0.4 + 7);
        c.fillStyle = '#f7c548'; c.fillText(n > 0 ? n : 'GO', V.W / 2, V.H * 0.4);
      }
    },
  };
  GS.Game = G;
})();
