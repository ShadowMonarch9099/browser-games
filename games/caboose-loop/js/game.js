// Caboose Loop game flow: the depot (title, with computer trains running the
// layout behind it), the countdown, the run, and the end of the line.
(function () {
  const R = CL.Rules, V = CL.View, M = CL.Menus, A = CL.Audio;
  const $ = (id) => document.getElementById(id);
  const P = 'caboose-loop:', mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(P + k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : d; };
  const set = (k, v) => { mem[k] = v; try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* not saved */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NAMES = { classic: 'Classic', delivery: 'Delivery', duel: 'Duel', rivals: 'Rivals' };
  const TRAIN_NAMES = ['Scarlet', 'Cobalt', 'Fern', 'Plum'];
  const KEYS1 = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' }, KEYS2 = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

  const G = {
    state: 'title', from: 'title', s: null, mode: 'classic', acc: 0, count: 0, overT: 0, muted: false, events: [], padPrev: [{}, {}], padDir: [null, null], swipes: new Map(),
    settings: Object.assign({ sfx: 8, music: 5, pace: 1, reduced: reduce }, get('settings', {})),

    init(canvas) {
      this.canvas = canvas;
      M.init((a) => this.act(a));
      this.buildSettings(); this.apply();
      this.bind(canvas);
      this.demo();
      this.showTitle();
    },
    apply() {
      const s = this.settings;
      A.setVolumes(this.muted ? 0 : s.sfx, this.muted ? 0 : s.music);
      document.body.classList.toggle('reduced', !!s.reduced);
      V.reduced = !!s.reduced;
      set('settings', s);
    },
    buildSettings() {
      const s = this.settings, ch = (k) => (v) => { s[k] = v; this.apply(); };
      const fs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
      M.renderSettings([
        { key: 'sfx', label: 'Sound effects', type: 'slider', get: () => s.sfx, set: ch('sfx') },
        { key: 'music', label: 'Stride piano', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'pace', label: 'Timetable', note: 'How fast the trains run', type: 'action', text: () => (s.pace < 1 ? 'Sunday service' : s.pace > 1 ? 'Express' : 'Regular'), run: () => { s.pace = s.pace < 1 ? 1 : s.pace > 1 ? 0.8 : 1.2; this.apply(); } },
        { key: 'reduced', label: 'Reduced motion', type: 'toggle', get: () => s.reduced, set: ch('reduced') },
        { key: 'fs', label: 'Fullscreen', type: 'action', text: () => (fs() ? 'On' : 'Off'), run: () => { this.fullscreen(); setTimeout(() => M.paintSettings(), 300); } },
      ]);
    },
    fullscreen() {
      const d = document, el = d.documentElement;
      try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { M.toast('No fullscreen here'); }
    },
    resize(W, H) { this.W = W; this.H = H; if (this.s) this.layout(); },
    layout() { V.layout(this.W, this.H, this.s.w, this.s.h, this.state === 'title' ? 20 : 64, this.state === 'title' ? 20 : 24); },
    portrait() { return this.H > this.W * 1.1; },

    // ---------- screens ----------
    demo() {
      this.s = R.create({ mode: 'rivals', seed: (Math.random() * 1e9) | 0, portrait: this.portrait() });
      this.s.trains[0].kind = 'bot';
      this.layout();
    },
    showTitle() {
      const best = get('best', {}), duel = get('duel', [0, 0]);
      for (const m of ['classic', 'delivery', 'rivals']) if (best[m]) $('b-' + m).textContent = `Best: ${best[m]}`;
      if (duel[0] + duel[1]) $('b-duel').textContent = `Scarlet ${duel[0]} · Cobalt ${duel[1]}`;
      this.state = 'title';
      document.body.classList.remove('duel', 'delivery', 'rivals');
      $('hud').classList.add('off');
      M.show('title');
    },
    start(mode) {
      A.unlock(); A.play('confirm');
      this.mode = mode;
      M.fade(true);
      setTimeout(() => {
        this.s = R.create({ mode, seed: (Math.random() * 1e9) | 0, portrait: this.portrait() });
        this.state = 'count'; this.count = 3; this.acc = 0; this.overT = 0;
        this.layout();
        document.body.classList.toggle('duel', mode === 'duel');
        document.body.classList.toggle('delivery', mode === 'delivery');
        document.body.classList.toggle('rivals', mode === 'rivals');
        $('h-mode').textContent = mode === 'duel' ? 'Scarlet' : NAMES[mode];
        $('hud').classList.remove('off');
        M.show(null); M.fade(false);
        this.hud();
        A.play('count', 0);
      }, this.settings.reduced ? 0 : 300);
    },
    quit() { M.fade(true); setTimeout(() => { this.state = 'title'; this.demo(); this.showTitle(); M.fade(false); }, this.settings.reduced ? 0 : 300); },
    pause() { if (this.state !== 'play' && this.state !== 'count') return; this.prev = this.state; this.state = 'paused'; A.play('back'); $('hud').classList.add('off'); M.show('pause', true); },
    resume() { if (this.state !== 'paused') return; this.state = this.prev === 'count' ? 'count' : 'play'; if (this.state === 'play') { this.state = 'count'; this.count = 1.5; } A.play('confirm'); $('hud').classList.remove('off'); M.show(null); },
    act(a) {
      if (a && a.startsWith('mode-')) return this.start(a.slice(5));
      switch (a) {
        case 'how': this.from = this.state === 'paused' ? 'pause' : 'title'; A.play('confirm'); return M.show('how', true);
        case 'settings': this.from = this.state === 'paused' ? 'pause' : 'title'; this.buildSettings(); A.play('confirm'); return M.show('settings', true);
        case 'back': A.play('back'); if (this.from === 'title') return this.showTitle(); return M.show(this.from, true);
        case 'pause': return this.pause();
        case 'resume': return this.resume();
        case 'restart': return this.start(this.mode);
        case 'quit': A.play('back'); return this.quit();
      }
    },

    // ---------- the run ----------
    onEvents(ev, quiet) {
      const s = this.s;
      for (const e of ev) {
        const t = s.trains[e.train];
        if (e.type === 'pickup') {
          V.burst(e.x + 0.5, e.y + 0.5, e.golden ? '#ffd23f' : V.PAX[e.color], e.golden ? 16 : 7);
          if (!quiet && t.kind === 'human') { A.play(e.golden ? 'golden' : 'whistle'); if (e.golden) M.toast('Golden passenger! +50'); }
        } else if (e.type === 'deliver') {
          V.burst(e.x + 0.5, e.y + 0.5, V.PAX[e.color], 12 + e.n * 3);
          if (!quiet) { A.play('bell', e.n); M.toast(`${e.n} delivered · +${e.points}`); }
        } else if (e.type === 'golden') { if (!quiet) M.toast('A golden passenger is waiting!'); }
        else if (e.type === 'crash') {
          const [x, y] = e.at;
          V.burst(Math.max(0, Math.min(s.w - 1, x)) + 0.5, Math.max(0, Math.min(s.h - 1, y)) + 0.5, V.TRAIN[e.train % 4].body, 14 + Math.min(20, e.length));
          if (!quiet) { A.play('crash'); if (t.kind === 'human') V.shake = 0.8; else M.toast(`${TRAIN_NAMES[e.train]} is off the rails!`); }
        }
      }
    },
    step(dt, quiet) {
      const s = this.s;
      this.acc += dt;
      const interval = 1 / (R.speed(s) * (quiet ? 1 : this.settings.pace));
      while (this.acc >= interval && !s.over) {
        this.acc -= interval;
        for (const t of s.trains) t.prev = t.body.map((c) => c.slice());
        const ev = R.tick(s);
        this.onEvents(ev, quiet);
        if (!quiet) {
          A.play('chuff');
          // smoke from every engine's chimney
          for (const t of s.trains) if (t.alive && !this.settings.reduced && s.ticks % 2 === 0) { const [x, y] = t.body[0], [dx, dy] = R.DIRS[t.dir]; V.puff(x + 0.5 + dx * 0.3, y + 0.5 + dy * 0.3, 0.8, 'rgba(240,240,235,0.9)', 1, 25); }
          this.hud();
        }
      }
      return Math.min(1, this.acc / interval);
    },
    finish() {
      const s = this.s, mode = this.mode, me = s.trains[0];
      this.state = 'result';
      $('hud').classList.add('off');
      const best = get('best', {});
      if (mode === 'duel') {
        const ev = s.events.find((e) => e.type === 'over'), w = ev ? ev.winner : -1, duel = get('duel', [0, 0]);
        if (w >= 0) duel[w]++;
        set('duel', duel);
        $('r-kicker').textContent = `Duel · Scarlet ${duel[0]} – ${duel[1]} Cobalt`;
        $('r-title').textContent = w < 0 ? 'A head-on draw!' : `${TRAIN_NAMES[w]} wins!`;
        $('r-stats').innerHTML = s.trains.map((t) => `<div><b>${t.body.length}</b><small>${TRAIN_NAMES[t.id]}'s carriages</small></div>`).join('');
        A.play(w < 0 ? 'deny' : 'win');
      } else {
        const score = me.score, prev = best[mode] || 0;
        if (score > prev) { best[mode] = score; set('best', best); }
        $('r-kicker').textContent = `${NAMES[mode]} · end of the line`;
        $('r-title').textContent = score > prev && score > 0 ? 'A new record!' : 'Off the rails!';
        const extra = mode === 'rivals' ? [s.trains.filter((t) => t.kind === 'bot').reduce((a, t) => a + (t.alive ? 0 : 1), 0), 'rivals derailed at the end'] : [me.body.length, 'train length'];
        $('r-stats').innerHTML = [[score, 'score'], [Math.max(score, prev), 'best'], [me.carried, 'passengers carried'], extra].map(([b, l]) => `<div><b>${b}</b><small>${l}</small></div>`).join('');
        A.play(score > prev ? 'win' : 'back');
      }
      M.show('result', true);
    },
    hud() {
      const s = this.s, me = s.trains[0];
      $('h-score').textContent = me.score;
      $('h-sub').textContent = `${me.body.length - 1} carriage${me.body.length === 2 ? '' : 's'}`;
      if (this.mode === 'duel') { const t = s.trains[1]; $('h-score2').textContent = t.score; $('h-sub2').textContent = `${t.body.length - 1} carriages`; }
      if (this.mode === 'delivery') $('h-cargo').innerHTML = R.COLORS.map((c) => `<span style="--c:${V.PAX[c]}"><i></i>${me.cars.filter((x) => x === c).length}</span>`).join('');
      if (this.mode === 'rivals') $('h-board').innerHTML = s.trains.slice().sort((a, b) => b.body.length - a.body.length).map((t) => `<div class="${t.alive ? '' : 'dead'}"><span><i style="--c:${V.TRAIN[t.id].body}"></i>${t.id === 0 ? 'You' : TRAIN_NAMES[t.id]}</span><b>${t.alive ? t.body.length : '—'}</b></div>`).join('');
    },

    // ---------- input ----------
    bind(canvas) {
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        A.unlock();
        document.body.dataset.device = 'keyboard';
        const playing = this.state === 'play' || this.state === 'count';
        const d1 = KEYS1[e.code], d2 = KEYS2[e.code];
        if (playing && (d1 || d2)) {
          e.preventDefault();
          if (this.mode === 'duel') { if (d1) this.steer(0, d1); else this.steer(1, d2); } else this.steer(0, d1 || d2);
          return;
        }
        const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', KeyP: 'pause', KeyM: 'mute' }[e.code];
        if (!k) return;
        e.preventDefault();
        this.events.push(k);
      });
      // swipes: each finger steers by the direction it moves
      canvas.addEventListener('pointerdown', (e) => {
        A.unlock();
        document.body.dataset.device = e.pointerType === 'mouse' ? 'mouse' : 'touch';
        let who = 0;
        if (this.mode === 'duel') who = this.portrait() ? (e.clientY < this.H / 2 ? 1 : 0) : (e.clientX < this.W / 2 ? 0 : 1);
        this.swipes.set(e.pointerId, { x: e.clientX, y: e.clientY, who });
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
      });
      canvas.addEventListener('pointermove', (e) => {
        const sw = this.swipes.get(e.pointerId); if (!sw) return;
        const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
        if (Math.hypot(dx, dy) < 24) return;
        this.steer(sw.who, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
        sw.x = e.clientX; sw.y = e.clientY;
      });
      const end = (e) => this.swipes.delete(e.pointerId);
      canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
      addEventListener('gamepadconnected', () => { document.body.dataset.device = 'gamepad'; });
    },
    steer(i, dir) { if ((this.state === 'play' || this.state === 'count') && this.s.trains[i] && this.s.trains[i].kind === 'human') { R.turn(this.s, i, dir); A.play('turn'); } },
    pollPad() {
      const pads = Array.from((navigator.getGamepads && navigator.getGamepads()) || []).filter((p) => p && p.connected);
      pads.slice(0, 2).forEach((gp, n) => {
        const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
        for (const [i, a] of Object.entries({ 0: 'confirm', 1: 'back', 9: 'pause' })) { const on = b(i); if (on && !this.padPrev[n][i] && n === 0) { this.events.push(a); A.unlock(); } this.padPrev[n][i] = on; }
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        let dir = b(12) ? 'up' : b(13) ? 'down' : b(14) ? 'left' : b(15) ? 'right' : null;
        if (!dir && (Math.abs(ax) > 0.55 || Math.abs(ay) > 0.55)) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
        if (dir && dir !== this.padDir[n]) {
          document.body.dataset.device = 'gamepad';
          if (this.state === 'play' || this.state === 'count') this.steer(this.mode === 'duel' ? n : 0, dir);
          else if (n === 0) this.events.push(dir);
        }
        this.padDir[n] = dir;
      });
    },
    handle(e) {
      if (e === 'mute') { this.muted = !this.muted; this.apply(); M.toast(this.muted ? 'Sound off' : 'Sound on'); return; }
      if (this.state === 'play' || this.state === 'count') { if (e === 'back' || e === 'pause') this.pause(); return; }
      const cur = M.current && M.current.id;
      if (e === 'back' || e === 'pause') { if (cur === 's-pause') this.resume(); else if (cur === 's-settings' || cur === 's-how') this.act('back'); return; }
      if (e === 'confirm') M.confirm();
      else if (['left', 'right', 'up', 'down'].includes(e)) M.nav(e);
    },

    // ---------- time ----------
    f: 0,
    update(dt) {
      this.pollPad();
      for (const e of this.events.splice(0)) this.handle(e);
      V.tick(dt);
      A.tempo = this.s ? Math.min(1.3, R.speed(this.s) / 7) : 1;
      A.update(this.state === 'play');
      if (this.state === 'title') { this.f = this.step(dt, true); if (this.s.over) this.demo(); return; }
      if (this.state === 'count') {
        const before = Math.ceil(this.count);
        this.count -= dt;
        $('h-count').textContent = this.count > 0 ? String(Math.ceil(this.count)) : '';
        if (Math.ceil(this.count) !== before && this.count > 0) A.play('count', 0);
        if (this.count <= 0) { this.state = 'play'; A.play('count', 1); }
        return;
      }
      if (this.state === 'play') {
        this.f = this.step(dt, false);
        if (this.s.over) { this.overT += dt; if (this.overT > 1.3) this.finish(); }
      }
    },
    render(ctx) { V.draw(ctx, this.s, this.state === 'count' || this.state === 'paused' || this.state === 'result' ? (this.state === 'result' ? 1 : 0) : this.f); },
  };
  CL.Game = G;
})();
