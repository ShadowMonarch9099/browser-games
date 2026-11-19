// Flick Parlour game flow: the neon sign (title), choosing a table, the
// match, and the final tally. Physics runs live from rules.js every frame.
(function () {
  const R = FP.Rules, V = FP.View, M = FP.Menus, A = FP.Audio;
  const $ = (id) => document.getElementById(id);
  const P = 'flick-parlour:', mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(P + k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : d; };
  const set = (k, v) => { mem[k] = v; try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* not saved */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FOES = [{ name: 'Rook', note: 'Easy: flicks with gusto, aims with hope' }, { name: 'Marlowe', note: 'Fair: a regular at the corner table' }, { name: 'The Duchess', note: 'Sharp: rarely misses a cut' }];

  const G = {
    state: 'title', from: 'title', mode: 'cpu', foe: 1, s: null, muted: false, events: [], padPrev: {}, padDir: null, drag: null, aim: { angle: -Math.PI / 2, power: 0.45 }, think: null, demoT: 0,
    settings: Object.assign({ sfx: 8, music: 5, guide: true, reduced: reduce }, get('settings', {})),
    record: Object.assign({ wins: 0, solo: 0 }, get('record', {})),

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
        { key: 'sfx', label: 'Clacks and thumps', type: 'slider', get: () => s.sfx, set: ch('sfx') },
        { key: 'music', label: 'Lounge trio', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'guide', label: 'Aim guide', note: 'Show where the striker will touch first', type: 'toggle', get: () => s.guide, set: ch('guide') },
        { key: 'reduced', label: 'Reduced motion', type: 'toggle', get: () => s.reduced, set: ch('reduced') },
        { key: 'fs', label: 'Fullscreen', type: 'action', text: () => (fs() ? 'On' : 'Off'), run: () => { this.fullscreen(); setTimeout(() => M.paintSettings(), 300); } },
      ]);
    },
    fullscreen() {
      const d = document, el = d.documentElement;
      try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { M.toast('No fullscreen here'); }
    },
    resize(W, H) { this.W = W; this.H = H; this.layout(); },
    layout() {
      if (!this.W) return;
      const play = this.state === 'play' || this.state === 'paused' || this.state === 'result';
      V.layout(this.W, this.H, play ? 84 : 70, play ? 60 : 30);
    },
    nameOf(p) { return this.mode === 'solo' ? 'You' : this.mode === 'duo' ? (p ? 'Black' : 'White') : p ? FOES[this.foe].name : 'You'; },

    // ---------- screens ----------
    demo() { this.s = R.create(); this.demoT = 1; V.flip = false; },
    showTitle() {
      this.state = 'title'; this.layout();
      $('t-rec').textContent = this.record.wins ? `${this.record.wins} match${this.record.wins === 1 ? '' : 'es'} won${this.record.solo ? ` · best clear: ${this.record.solo} flicks` : ''}` : 'Pull up a chair';
      $('hud').classList.add('off');
      M.show('title');
    },
    act(a) {
      if (a.startsWith('foe-')) { this.mode = 'cpu'; this.foe = +a.slice(4); return this.start(); }
      switch (a) {
        case 'play': A.unlock(); A.play('confirm'); this.state = 'pick'; $('foes').innerHTML = FOES.map((f, i) => `<button class="neon-btn" data-nav data-act="foe-${i}"><b>${f.name}</b><small>${f.note}</small></button>`).join(''); return M.show('pick', true);
        case 'duo': this.mode = 'duo'; return this.start();
        case 'solo': this.mode = 'solo'; return this.start();
        case 'how': this.from = this.state === 'paused' ? 'pause' : this.state === 'pick' ? 'pick' : 'title'; A.play('confirm'); return M.show('how', true);
        case 'settings': this.from = this.state === 'paused' ? 'pause' : 'title'; this.buildSettings(); A.play('confirm'); return M.show('settings', true);
        case 'back': A.play('back');
          if (this.state === 'pick' && this.from !== 'pick') return this.showTitle();
          if (this.from === 'pick') { this.from = 'title'; return M.show('pick', true); }
          if (this.from === 'title') return this.showTitle();
          return M.show(this.from, true);
        case 'pause': return this.pause();
        case 'resume': return this.resume();
        case 'restart': return this.start();
        case 'quit': A.play('back'); return this.quit();
      }
    },
    quit() { M.fade(true); setTimeout(() => { this.demo(); this.showTitle(); M.fade(false); }, this.settings.reduced ? 0 : 300); },
    pause() { if (this.state !== 'play') return; this.state = 'paused'; this.drag = null; A.play('back'); $('hud').classList.add('off'); M.show('pause', true); },
    resume() { if (this.state !== 'paused') return; this.state = 'play'; A.play('confirm'); $('hud').classList.remove('off'); M.show(null); },

    // ---------- a match ----------
    start() {
      A.unlock(); A.play('confirm');
      M.fade(true);
      setTimeout(() => {
        this.s = R.create({ solo: this.mode === 'solo' });
        this.state = 'play'; this.think = null; this.drag = null; this.ended = false;
        this.layout();
        document.body.dataset.mode = this.mode;
        $('n0').textContent = this.nameOf(0); $('n1').textContent = this.nameOf(1);
        $('hud').classList.remove('off');
        M.show(null); M.fade(false);
        this.turnStart();
      }, this.settings.reduced ? 0 : 300);
    },
    human() { return this.mode !== 'cpu' || this.s.turn === 0; },
    turnStart() {
      const s = this.s;
      V.flip = this.mode === 'duo' && s.turn === 1;
      this.aim = { angle: R.BASE[s.turn].dir < 0 ? -Math.PI / 2 : Math.PI / 2, power: this.aim.power };
      this.hud();
      if (this.human()) { $('say').textContent = this.mode === 'duo' ? `${this.nameOf(s.turn)}: slide the striker, then pull back and let go` : 'Slide the striker along your line, then pull back and let go'; }
      else { $('say').textContent = `${this.nameOf(1)} lines up a shot…`; const m = R.plan(s, this.foe); this.think = { m, t: 0, x0: s.striker.x }; }
    },
    hud() {
      const s = this.s;
      const dots = (p) => { const n = this.mode === 'solo' ? s.sunk[0].length : s.sunk[p].length, max = this.mode === 'solo' ? 18 : 9; return Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join(''); };
      $('d0').innerHTML = dots(0); $('d1').innerHTML = this.mode === 'solo' ? '' : dots(1);
      $('q0').classList.toggle('on', s.queenBy === 0); $('q1').classList.toggle('on', s.queenBy === 1);
      $('p0').classList.toggle('cur', s.turn === 0 && !s.over); $('p1').classList.toggle('cur', s.turn === 1 && !s.over);
      $('h-flicks').textContent = this.mode === 'solo' ? `${s.flicks[0]} flick${s.flicks[0] === 1 ? '' : 's'}${this.record.solo ? ` · best ${this.record.solo}` : ''}` : '';
    },
    shoot(angle, power) {
      const s = this.s;
      if (this.state !== 'play' || s.phase !== 'aim') return;
      if (!R.strikerClear(s)) { M.toast('The striker is touching a coin'); return; }
      if (R.flick(s, angle, power)) { A.play('flick'); V.aim = null; this.drag = null; }
    },
    // what happened when everything stopped
    settled() {
      const s = this.s, res = s.result || [], p = this.lastTurn;
      for (const e of res) {
        if (e.type === 'foul') { A.play('foul'); M.toast(e.returned ? 'Striker pocketed! One coin comes back' : 'Striker pocketed! Foul'); V.shake = 0.5; }
        else if (e.type === 'queen-sunk') { A.play('queen'); M.toast('The queen! Now cover her'); }
        else if (e.type === 'queen-covered') { A.play('queen'); M.toast(`Queen covered by ${this.nameOf(e.by)}!`); }
        else if (e.type === 'queen-back') M.toast('The queen goes back to the middle');
        else if (e.type === 'last-back') M.toast('Your last coin waits for the queen');
        else if (e.type === 'again' && !s.over && this.mode !== 'solo') { if (this.sankOwn) A.play('own'); }
      }
      this.hud();
      if (s.over) return this.finishSoon();
      this.turnStart();
    },
    finishSoon() { if (this.ended) return; this.ended = true; setTimeout(() => this.finish(), 900); },
    finish() {
      const s = this.s;
      this.state = 'result';
      $('hud').classList.add('off');
      let title, note = '';
      if (this.mode === 'solo') {
        const n = s.flicks[0], best = this.record.solo;
        if (!best || n < best) { this.record.solo = n; set('record', this.record); note = 'A new house record!'; } else note = `House record: ${best} flicks`;
        title = `Board cleared in ${n} flicks`;
      } else {
        const w = s.winner;
        if (this.mode === 'cpu' && w === 0) { this.record.wins++; set('record', this.record); }
        title = this.mode === 'duo' ? `${this.nameOf(w)} wins!` : w === 0 ? 'You clear the board!' : `${this.nameOf(1)} takes the match`;
        note = `Fouls: ${s.fouls[0]} – ${s.fouls[1]} · Queen: ${s.queenBy < 0 ? 'nobody' : this.nameOf(s.queenBy)}`;
      }
      $('r-title').textContent = title; $('r-note').textContent = note;
      $('r-kicker').textContent = this.mode === 'solo' ? 'Practice table' : this.mode === 'duo' ? 'Two players' : `Against ${FOES[this.foe].name}`;
      A.play(this.mode === 'cpu' && s.winner === 1 ? 'lose' : 'win');
      M.show('result', true);
    },

    // ---------- input ----------
    // board position under the pointer
    at(e) { return V.unproject(e.clientX, e.clientY); },
    bind(canvas) {
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        A.unlock();
        document.body.dataset.device = 'keyboard';
        const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', KeyP: 'pause', KeyM: 'mute', KeyZ: 'rotl', KeyX: 'rotr', KeyA: 'rotl', KeyD: 'rotr' }[e.code];
        if (!k) return;
        e.preventDefault();
        this.events.push(k);
      });
      canvas.addEventListener('pointerdown', (e) => {
        A.unlock();
        document.body.dataset.device = e.pointerType === 'mouse' ? 'mouse' : 'touch';
        const s = this.s;
        if (this.state !== 'play' || s.phase !== 'aim' || !this.human()) return;
        const [x, y] = this.at(e), b = R.BASE[s.turn], st = s.striker;
        const onLine = Math.abs(y - b.y) < 0.07 && x > b.x0 - 0.08 && x < b.x1 + 0.08;
        const onStriker = Math.hypot(x - st.x, y - st.y) < 0.05;
        this.drag = { id: e.pointerId, kind: onLine && !onStriker ? 'place' : onStriker ? 'place-or-aim' : 'aim', x0: x, y0: y };
        if (this.drag.kind === 'place') { R.placeStriker(s, x); V.placing = true; }
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
      });
      canvas.addEventListener('pointermove', (e) => {
        const d = this.drag, s = this.s; if (!d || d.id !== e.pointerId || s.phase !== 'aim') return;
        const [x, y] = this.at(e), st = s.striker, b = R.BASE[s.turn];
        // starting on the striker: sliding along the line places it, pulling away aims
        if (d.kind === 'place-or-aim') { if (Math.abs(y - d.y0) > 0.035) d.kind = 'aim'; else if (Math.abs(x - d.x0) > 0.01) d.kind = 'place'; }
        if (d.kind === 'place') { R.placeStriker(s, x); V.placing = true; if (Math.random() < 0.2) A.play('slide'); return; }
        if (d.kind === 'aim') {
          // pull back like a slingshot: the flick goes the other way
          const dx = st.x - x, dy = st.y - y, len = Math.hypot(dx, dy);
          if (len < 0.02) { V.aim = null; return; }
          this.aim = { angle: Math.atan2(dy, dx), power: Math.min(1, len / 0.38) };
          V.aim = this.settings.guide ? this.aim : { angle: this.aim.angle, power: this.aim.power, bare: true };
          this.powerBar(this.aim.power);
        }
      });
      const up = (e) => {
        const d = this.drag; if (!d || d.id !== e.pointerId) return;
        this.drag = null; V.placing = false;
        if (d.kind === 'aim' && V.aim) this.shoot(this.aim.angle, this.aim.power);
        V.aim = null; this.powerBar(0);
      };
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      addEventListener('gamepadconnected', () => { document.body.dataset.device = 'gamepad'; });
    },
    powerBar(p) { $('power').style.setProperty('--p', p.toFixed(3)); $('power').classList.toggle('on', p > 0); },
    pollPad() {
      const gp = Array.from((navigator.getGamepads && navigator.getGamepads()) || []).find((p) => p && p.connected);
      if (!gp) return;
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      for (const [i, a] of Object.entries({ 0: 'confirm', 1: 'back', 9: 'pause', 4: 'rotl', 5: 'rotr' })) { const on = b(i); if (on && !this.padPrev[i]) { this.events.push(a); A.unlock(); document.body.dataset.device = 'gamepad'; } this.padPrev[i] = on; }
      // the right stick aims directly
      const rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
      if (this.state === 'play' && Math.hypot(rx, ry) > 0.5) { this.aim.angle = Math.atan2(ry, rx); document.body.dataset.device = 'gamepad'; }
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      let dir = b(12) ? 'up' : b(13) ? 'down' : b(14) ? 'left' : b(15) ? 'right' : null;
      if (!dir && (Math.abs(ax) > 0.55 || Math.abs(ay) > 0.55)) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
      if (dir && dir !== this.padDir) { this.events.push(dir); document.body.dataset.device = 'gamepad'; }
      this.padDir = dir;
    },
    handle(e) {
      if (e === 'mute') { this.muted = !this.muted; this.apply(); M.toast(this.muted ? 'Sound off' : 'Sound on'); return; }
      if (this.state === 'play') {
        if (e === 'back' || e === 'pause') return this.pause();
        const s = this.s; if (s.phase !== 'aim' || !this.human()) return;
        const flipX = V.flip ? -1 : 1;
        if (e === 'left' || e === 'right') { R.placeStriker(s, s.striker.x + (e === 'left' ? -0.02 : 0.02) * flipX); A.play('slide'); }
        else if (e === 'up' || e === 'down') { this.aim.power = Math.max(0.05, Math.min(1, this.aim.power + (e === 'up' ? 0.05 : -0.05))); this.powerBar(this.aim.power); }
        else if (e === 'rotl' || e === 'rotr') this.aim.angle += (e === 'rotl' ? -0.035 : 0.035) * flipX;
        else if (e === 'confirm') this.shoot(this.aim.angle, this.aim.power);
        return;
      }
      if (e === 'rotl' || e === 'rotr') return;
      const cur = M.current && M.current.id;
      if (e === 'back' || e === 'pause') { if (cur === 's-pause') this.resume(); else if (cur === 's-settings' || cur === 's-how' || cur === 's-pick') this.act('back'); else if (cur === 's-result') this.act('quit'); return; }
      if (e === 'confirm') M.confirm();
      else if (['left', 'right', 'up', 'down'].includes(e)) M.nav(e);
    },

    // ---------- time ----------
    physics(dt, quiet) {
      const s = this.s;
      if (s.phase !== 'moving') return;
      this.lastTurn = s.turn;
      R.step(s, dt);
      for (const ev of s.events.splice(0)) {
        if (quiet) { if (ev.type === 'pocket') V.sink(ev.id === 'S' ? s.striker : s.coins[ev.id]); continue; }
        if (ev.type === 'hit') A.play(ev.striker ? 'knock' : 'clack', ev.speed);
        else if (ev.type === 'wall') A.play('cushion', ev.speed);
        else if (ev.type === 'pocket') { A.play('pocket'); V.sink(ev.id === 'S' ? s.striker : s.coins[ev.id]); }
      }
      if (s.phase !== 'moving' && !quiet) { this.sankOwn = (s.result || []).some((e) => e.type === 'again'); this.settled(); }
    },
    update(dt) {
      this.pollPad();
      for (const e of this.events.splice(0)) this.handle(e);
      V.tick(dt);
      A.update(this.state === 'play');
      if (this.state === 'paused') return;
      const s = this.s;
      if (this.state !== 'play') {
        // the table behind the menus: someone idly practising
        this.physics(dt, true);
        if (s.phase === 'aim') { this.demoT -= dt; if (this.demoT <= 0) { if (s.over || s.flicks[0] + s.flicks[1] > 60) return this.demo(); const m = R.plan(s, 1); R.placeStriker(s, m.x); R.flick(s, m.angle, m.power); this.demoT = 1.2; } }
        return;
      }
      this.physics(dt, false);
      // keyboard and pad players see the aim all the time
      if (s.phase === 'aim' && this.human() && !this.drag) V.aim = document.body.dataset.device === 'keyboard' || document.body.dataset.device === 'gamepad' ? this.aim : null;
      // the computer slides the striker over, shows its aim, then flicks
      if (this.think && s.phase === 'aim') {
        const t = this.think; t.t += dt;
        const f = Math.min(1, t.t / 0.6);
        R.placeStriker(s, t.x0 + (t.m.x - t.x0) * (1 - Math.pow(1 - f, 3)));
        if (t.t > 0.6) V.aim = { angle: t.m.angle, power: t.m.power };
        if (t.t > 1.3) { this.think = null; V.aim = null; if (!R.strikerClear(s)) R.placeStriker(s, 0.5); this.shoot(t.m.angle, t.m.power); if (s.phase === 'aim') { R.placeStriker(s, 0.3 + Math.random() * 0.4); this.shoot(t.m.angle, t.m.power); } if (s.phase === 'aim') { s.turn = 1 - s.turn; this.turnStart(); } }
      }
    },
    render(ctx) { V.draw(ctx, this.s); },
  };
  FP.Game = G;
})();
