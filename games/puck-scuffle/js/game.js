// Puck Scuffle game flow: the title (with the house playing itself on the
// table behind it), match setup, countdown, play, pause and results.
(function () {
  const R = PS.Rules, V = PS.View, M = PS.Menus, A = PS.Audio, I = PS.Input, S = PS.Save, LEN = R.LEN;
  const LEVELS = ['Easy', 'Medium', 'Hard'];
  const NAMES = ['Red', 'Blue'];

  const G = {
    state: 'title', prev: null, from: 'title', match: null, mode: null, settings: null, banner: null, count: 0, overT: 0, stats: null, muted: false, w: 1, h: 1,

    init() {
      this.settings = S.settings();
      M.init((a) => this.act(a));
      this.buildSettings();
      this.apply();
      this.startDemo();
      M.show('title');
    },
    apply() {
      const s = this.settings;
      A.setVolumes(this.muted ? 0 : s.sfx, this.muted ? 0 : s.music);
      document.body.classList.toggle('reduced', !!s.reduced);
      V.reduced = !!s.reduced;
      S.storeSettings(s);
    },
    buildSettings() {
      const s = this.settings, ch = (k) => (v) => { s[k] = v; this.apply(); };
      const fs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
      M.renderSettings([
        { key: 'sfx', label: 'Sound effects', type: 'slider', get: () => s.sfx, set: ch('sfx') },
        { key: 'music', label: 'Parlour groove', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'win', label: 'Match length', note: 'Goals needed to win', type: 'action', text: () => `First to ${s.win}`, run: () => { s.win = s.win === 5 ? 7 : s.win === 7 ? 11 : 5; this.apply(); } },
        { key: 'tokens', label: 'Tokens', note: 'Split, giant and shrink', type: 'toggle', get: () => s.tokens, set: ch('tokens') },
        { key: 'shake', label: 'Screen shake', type: 'toggle', get: () => s.shake, set: ch('shake') },
        { key: 'reduced', label: 'Reduced motion', type: 'toggle', get: () => s.reduced, set: ch('reduced') },
        { key: 'fs', label: 'Fullscreen', type: 'action', text: () => (fs() ? 'On' : 'Off'), run: () => { this.fullscreen(); setTimeout(() => M.paintSettings(), 300); } },
      ]);
    },
    fullscreen() {
      const d = document, el = d.documentElement;
      try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { M.toast('No fullscreen here'); }
    },
    resize(w, h) { this.w = w; this.h = h; this.layout(); },
    layout() { V.layout(this.w, this.h, !this.mode || this.mode.solo || this.state === 'title'); },

    startDemo() {
      this.mode = null;
      this.match = R.create({ ai: [1, 2], win: 99, tokens: true, seed: (Math.random() * 1e9) | 0 });
      this.layout();
    },
    start(mode) {
      A.play('confirm');
      M.fade(true);
      setTimeout(() => {
        this.mode = mode;
        this.match = R.create({ ai: mode.ai, win: this.settings.win, tokens: this.settings.tokens, seed: (Math.random() * 1e9) | 0 });
        this.stats = { hits: 0, best: 0 };
        this.banner = null; this.overT = 0; this.count = 3.2;
        this.state = 'countdown';
        this.layout();
        M.show(null); M.fade(false);
        document.getElementById('pause-btn').classList.remove('off');
        A.setAir(true);
      }, this.settings.reduced ? 0 : 260);
    },
    quit() {
      M.fade(true);
      setTimeout(() => {
        this.state = 'title'; this.startDemo(); A.setAir(false);
        document.getElementById('pause-btn').classList.add('off');
        M.show('title'); M.fade(false);
      }, this.settings.reduced ? 0 : 260);
    },
    pause() {
      if (this.state !== 'play' && this.state !== 'countdown') return;
      this.prev = this.state; this.state = 'paused';
      A.setAir(false); A.play('back');
      M.show('pause');
    },
    resume() { if (this.state !== 'paused') return; this.state = this.prev; A.setAir(true); A.play('confirm'); M.show(null); },

    act(a) {
      if (a === 'mode-2p') return this.start({ ai: [null, null], solo: false });
      if (a && a.startsWith('mode-cpu-')) { const lv = +a.slice(9); return this.start({ ai: [null, lv], solo: true, level: lv }); }
      switch (a) {
        case 'how': A.play('confirm'); this.from = 'title'; M.show('how', true); break;
        case 'settings': A.play('confirm'); this.from = this.state === 'paused' ? 'pause' : 'title'; this.buildSettings(); M.show('settings', true); break;
        case 'back': A.play('back'); M.show(this.from, this.from !== 'title'); break;
        case 'pause': this.pause(); break;
        case 'resume': this.resume(); break;
        case 'restart': this.start(this.mode); break;
        case 'quit': A.play('back'); this.quit(); break;
      }
    },
    // which screen is up decides what the back key does
    onBack() {
      const cur = M.current && M.current.id;
      if (this.state === 'play' || this.state === 'countdown') this.pause();
      else if (cur === 's-pause') this.resume();
      else if (cur === 's-settings' || cur === 's-how') this.act('back');
      else if (cur === 's-result') this.act('quit');
    },

    control(p) {
      const m = this.match, solo = this.mode.solo;
      if (m.ai[p] !== null) return null;
      for (const [, ptr] of I.pointers) {
        const t = V.unproject(ptr.x, ptr.y);
        if (ptr.owner === null) ptr.owner = solo ? 0 : t[1] > LEN / 2 ? 0 : 1;
        if (ptr.owner === p) return { target: t };
      }
      const a = I.axis(p, solo);
      if (Math.hypot(a[0], a[1]) > 0.1) return { axis: V.axis(a) };
      if (solo && p === 0 && I.device === 'mouse' && I.mouse) return { target: V.unproject(I.mouse.x, I.mouse.y) };
      return null;
    },
    onEvents(evs, quiet) {
      const s = this.settings;
      for (const e of evs) {
        if (e.type === 'hit') {
          if (!quiet) A.play('hit', e.power);
          V.burst(e.x, e.y, V.COL[e.p], 4 + Math.round(e.power * 2), 0.25 + e.power * 0.12);
          if (e.power > 1.6) V.ring(e.x, e.y, V.COL[e.p], 0.12);
          if (e.power > 2.6 && s.shake) V.shake = Math.max(V.shake, 0.15);
          if (this.stats) this.stats.hits++;
        } else if (e.type === 'wall') { if (!quiet) A.play('wall'); V.burst(e.x, e.y, '#fbf0d9', 3, 0.25); }
        else if (e.type === 'token') {
          if (!quiet) { A.play('token'); M.toast(R.TOKENS[e.kind]); }
          V.ring(e.x, e.y, '#ffd27a', 0.25); V.burst(e.x, e.y, '#ffd27a', 12, 0.5);
        } else if (e.type === 'tokenAppear') { if (!quiet) A.play('tokenAppear'); }
        else if (e.type === 'goal') {
          V.flash[e.scorer] = 1; V.confetti(e.scorer);
          if (quiet) continue;
          A.play('goal'); if (s.shake) V.shake = 0.6;
          if (this.stats) this.stats.best = Math.max(this.stats.best, e.rally);
          const who = this.mode.solo ? (e.scorer === 0 ? 'You score' : 'The house scores') : `${NAMES[e.scorer]} scores`;
          const left = this.match.win - this.match.score[e.scorer];
          this.banner = { text: e.over ? 'GAME!' : 'GOAL!', color: V.COL[e.scorer], p: e.scorer, age: 0, sub: e.over ? `${this.match.score[0]} : ${this.match.score[1]}` : left === 1 ? 'Match point' : e.rally > 6 ? `${e.rally}-hit rally` : who };
        } else if (e.type === 'serve' && !quiet) A.play('serve');
      }
    },

    update(dt) {
      I.poll();
      for (const e of I.take()) {
        if (e === 'mute') { this.muted = !this.muted; this.apply(); M.toast(this.muted ? 'Sound off' : 'Sound on'); continue; }
        if (e === 'pause') { if (this.state === 'paused') this.resume(); else this.pause(); continue; }
        if (e === 'back') { this.onBack(); continue; }
        if (this.state === 'play' || this.state === 'countdown') continue;
        if (e === 'confirm') M.confirm();
        else if (['up', 'down', 'left', 'right'].includes(e)) M.nav(e);
      }
      V.tick(dt);
      const m = this.match;
      A.hype = m && this.mode ? Math.max(m.score[0], m.score[1]) / m.win : 0;
      A.update(this.state === 'play' || this.state === 'countdown');
      if (this.banner) this.banner.age += dt;
      if (this.state === 'title') {
        this.onEvents(R.step(m, dt, null), true);
        if (m.score[0] + m.score[1] >= 9) this.startDemo();
      } else if (this.state === 'countdown') {
        const before = Math.ceil(this.count);
        this.count -= dt;
        if (Math.ceil(this.count) !== before && this.count > 0) A.play('led');
        if (this.count <= 0) { this.state = 'play'; A.play('serve'); this.banner = { text: 'FACE OFF', color: '#ffd27a', p: null, age: 0.4 }; }
      } else if (this.state === 'play') {
        this.onEvents(R.step(m, dt, [this.control(0), this.control(1)]));
        if (m.state === 'over') { this.overT += dt; if (this.overT > 1.9) this.showResult(); }
      }
    },
    showResult() {
      const m = this.match, mode = this.mode, winner = m.score[0] > m.score[1] ? 0 : 1, won = winner === 0;
      this.state = 'result';
      A.setAir(false);
      document.getElementById('pause-btn').classList.add('off');
      const rec = S.note(mode.solo ? mode.level : null, mode.solo && won);
      const $ = (id) => document.getElementById(id);
      $('r-kicker').textContent = mode.solo ? `The house · ${LEVELS[mode.level]}` : `Final · first to ${m.win}`;
      $('r-title').textContent = mode.solo ? (won ? 'You beat the house!' : 'The house wins') : `${NAMES[winner]} wins!`;
      $('r-score').textContent = `${m.score[0]} : ${m.score[1]}`;
      $('r-score').style.color = winner === 0 ? '#ff3b2f' : '#4f9bff';
      const bits = [`Longest rally: ${this.stats.best} hits`, `${this.stats.hits} hits in all`];
      if (mode.solo && won) bits.push(`Wins against ${LEVELS[mode.level].toLowerCase()}: ${rec.beat[mode.level]}`);
      $('r-note').textContent = bits.join(' · ');
      A.play(mode.solo && !won ? 'deny' : 'win');
      M.show('result', true);
    },

    render(g) {
      const m = this.match, solo = this.mode && this.mode.solo;
      const labels = !this.mode ? ['HOUSE', 'HOUSE'] : solo ? ['YOU', `HOUSE · ${LEVELS[this.mode.level].toUpperCase()}`] : ['RED', 'BLUE'];
      V.draw(g, m, { labels });
      if (this.state === 'countdown') {
        const n = Math.ceil(this.count), age = 1 - (this.count - Math.floor(this.count));
        if (n > 0 && n <= 3) {
          if (solo) V.banner(g, String(n), '#ffd27a', null, age);
          else { V.banner(g, String(n), '#ffd27a', 0, age); V.banner(g, String(n), '#ffd27a', 1, age); }
        }
      }
      const b = this.banner;
      if (b && b.age < 1.5 && (this.state === 'play' || this.state === 'countdown')) {
        g.globalAlpha = Math.min(1, (1.5 - b.age) * 3);
        if (!this.mode || solo || b.p === null) V.banner(g, b.text, b.color, null, b.age, b.sub);
        else { V.banner(g, b.text, b.color, 0, b.age, b.sub); V.banner(g, b.text, b.color, 1, b.age, b.sub); }
        g.globalAlpha = 1;
      }
    },
  };
  PS.Game = G;
})();
