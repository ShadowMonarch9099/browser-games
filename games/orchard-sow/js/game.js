// Orchard Sow game flow: the orchard gate (title), laying out the picnic
// (opponent, rules, seeds), the game, and the harvest count.
(function () {
  const R = OS.Rules, V = OS.View, M = OS.Menus, A = OS.Audio;
  const $ = (id) => document.getElementById(id);
  const P = 'orchard-sow:', mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(P + k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : d; };
  const set = (k, v) => { mem[k] = v; try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* not saved */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FOES = [{ name: 'Pip', note: 'Easy: still learning to count' }, { name: 'Hazel', note: 'Fair: thinks a few moves ahead' }, { name: 'Old Bramble', note: 'Sharp: has played since boyhood' }];
  const VARIANTS = { orchard: { name: 'Orchard rules', note: 'Sow into your store; land there to go again; capture from empty pits' }, harvest: { name: 'Harvest rules', note: 'Capture pits of two or three on their side; first past half wins' } };

  const G = {
    state: 'title', from: 'title', s: null, muted: false, events: [], padPrev: {}, padDir: null, thinkT: 0, cur: 0,
    opts: Object.assign({ foe: 1, variant: 'orchard', seeds: 4, first: 'you' }, get('opts', {})),
    settings: Object.assign({ sfx: 8, music: 5, pace: 1, counts: true, reduced: reduce }, get('settings', {})),
    record: get('record', {}),

    init(canvas) {
      this.canvas = canvas;
      M.init((a) => this.act(a));
      this.buildSettings(); this.apply();
      this.bind(canvas);
      V.onDrop = (slot, n) => { if (slot === 6 || slot === 13) A.play('store'); };
      V.onLand = (s) => { if (s.slot !== 6 && s.slot !== 13 && !this.landT) { this.landT = 0.04; A.play('drop', V.inSlot(s.slot).length); } };
      V.onCapture = (e) => { A.play('capture'); M.toast(`${this.nameOf(R.owner(e.to))} ${this.nameOf(R.owner(e.to)) === 'You' ? 'take' : 'takes'} ${e.n}!`); };
      V.onEvent = (e) => { if (e.type === 'again') { A.play('again'); if (this.state === 'play') M.toast(`${this.nameOf(this.s.turn)} ${this.s.turn === 0 && !this.friend ? 'go' : 'goes'} again`); } };
      this.demo();
      this.showTitle();
    },
    apply() {
      const s = this.settings;
      A.setVolumes(this.muted ? 0 : s.sfx, this.muted ? 0 : s.music);
      document.body.classList.toggle('reduced', !!s.reduced);
      V.reduced = !!s.reduced; V.speed = 1 / s.pace; V.showCounts = !!s.counts;
      set('settings', s);
    },
    buildSettings() {
      const s = this.settings, ch = (k) => (v) => { s[k] = v; this.apply(); };
      const fs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
      M.renderSettings([
        { key: 'sfx', label: 'Seeds and bowls', type: 'slider', get: () => s.sfx, set: ch('sfx') },
        { key: 'music', label: 'Dulcimer', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'counts', label: 'Seed counts', note: 'Show how many seeds are in each bowl', type: 'toggle', get: () => s.counts, set: ch('counts') },
        { key: 'pace', label: 'Sowing speed', type: 'action', text: () => (s.pace > 1 ? 'Unhurried' : s.pace < 1 ? 'Nimble' : 'Steady'), run: () => { s.pace = s.pace > 1 ? 1 : s.pace < 1 ? 1.5 : 0.6; this.apply(); } },
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
      V.layout(this.W, this.H, play ? 92 : 40, play ? 70 : 40);
    },
    nameOf(p) { return p === 0 ? (this.friend ? 'Player 1' : 'You') : this.friend ? 'Player 2' : FOES[this.opts.foe].name; },

    // ---------- screens ----------
    demo() {
      this.s = R.create({ variant: Math.random() < 0.5 ? 'orchard' : 'harvest' });
      V.reset(this.s.board); V.hint = []; V.last = null; this.demoT = 1.2;
    },
    showTitle() {
      this.state = 'title'; this.layout();
      const w = Object.values(this.record).reduce((a, b) => a + b, 0);
      $('t-rec').textContent = w ? `${w} harvest${w === 1 ? '' : 's'} won` : 'A game of seeds and bowls';
      $('hud').classList.add('off');
      M.show('title');
    },
    showSetup() { this.state = 'setup'; this.paintSetup(); M.show('setup', true); },
    paintSetup() {
      const o = this.opts;
      $('foes').innerHTML = FOES.map((f, i) => `<button class="leaf ${o.foe === i ? 'on' : ''}" data-nav data-act="foe-${i}"><b>${f.name}</b><small>${f.note}</small></button>`).join('') + `<button class="leaf ${o.foe === 3 ? 'on' : ''}" data-nav data-act="foe-3"><b>A friend</b><small>Two players, one board</small></button>`;
      $('variants').innerHTML = Object.entries(VARIANTS).map(([k, v]) => `<button class="leaf wide ${o.variant === k ? 'on' : ''}" data-nav data-act="var-${k}"><b>${v.name}</b><small>${v.note}</small></button>`).join('');
      $('extras').innerHTML = `<button class="leaf" data-nav data-act="seeds"><b>${o.seeds} seeds a bowl</b><small>More seeds, longer game</small></button><button class="leaf" data-nav data-act="first"><b>${o.first === 'you' ? 'You start' : o.first === 'them' ? 'They start' : 'Take turns starting'}</b><small>Who sows first</small></button>`;
      set('opts', o);
    },
    act(a) {
      const refocus = () => { const el = document.querySelector(`[data-act="${a}"]`); if (el) M.setFocus(el, true); };
      if (a.startsWith('foe-')) { this.opts.foe = +a.slice(4); A.play('move'); this.paintSetup(); return refocus(); }
      if (a.startsWith('var-')) { this.opts.variant = a.slice(4); A.play('move'); this.paintSetup(); return refocus(); }
      switch (a) {
        case 'seeds': this.opts.seeds = this.opts.seeds >= 6 ? 3 : this.opts.seeds + 1; A.play('move'); this.paintSetup(); return refocus();
        case 'first': this.opts.first = { you: 'them', them: 'alternate', alternate: 'you' }[this.opts.first]; A.play('move'); this.paintSetup(); return refocus();
        case 'play': A.unlock(); A.play('confirm'); return this.showSetup();
        case 'start': return this.start();
        case 'how': this.from = this.state === 'paused' ? 'pause' : this.state; A.play('confirm'); return M.show('how', true);
        case 'settings': this.from = this.state === 'paused' ? 'pause' : 'title'; this.buildSettings(); A.play('confirm'); return M.show('settings', true);
        case 'back': A.play('back');
          if (this.from === 'setup') { this.from = 'title'; return M.show('setup', true); }
          if (this.state === 'setup' || this.from === 'title') return this.showTitle();
          return M.show(this.from, true);
        case 'pause': return this.pause();
        case 'resume': return this.resume();
        case 'restart': return this.start();
        case 'quit': A.play('back'); return this.quit();
      }
    },
    quit() { M.fade(true); setTimeout(() => { this.demo(); this.showSetup(); $('hud').classList.add('off'); this.layout(); M.fade(false); }, this.settings.reduced ? 0 : 300); },
    pause() { if (this.state !== 'play') return; this.state = 'paused'; A.play('back'); $('hud').classList.add('off'); M.show('pause', true); },
    resume() { if (this.state !== 'paused') return; this.state = 'play'; A.play('confirm'); $('hud').classList.remove('off'); M.show(null); },

    // ---------- a game ----------
    start() {
      A.unlock(); A.play('confirm');
      M.fade(true);
      setTimeout(() => {
        const o = this.opts;
        this.friend = o.foe === 3;
        this.games = (this.games || 0) + 1;
        const first = o.first === 'you' ? 0 : o.first === 'them' ? 1 : this.games % 2 ? 0 : 1;
        this.s = R.create({ variant: o.variant, seeds: o.seeds, first });
        V.reset(this.s.board); V.last = null;
        this.state = 'play'; this.layout(); this.thinkT = 0; this.cur = R.legal(this.s)[0] || 0;
        $('n-you').textContent = this.nameOf(0); $('n-foe').textContent = this.nameOf(1);
        $('h-rules').textContent = VARIANTS[o.variant].name;
        $('hud').classList.remove('off');
        M.show(null); M.fade(false);
        this.hud();
      }, this.settings.reduced ? 0 : 300);
    },
    human() { return this.s.turn === 0 || this.friend; },
    hud() {
      const s = this.s;
      $('s-you').textContent = s.board[6]; $('s-foe').textContent = s.board[13];
      $('p-you').classList.toggle('cur', s.turn === 0 && !s.over); $('p-foe').classList.toggle('cur', s.turn === 1 && !s.over);
      const legal = R.legal(s);
      V.hint = this.human() && !V.busy() && this.state === 'play' ? legal : [];
      if (!s.over) $('say').textContent = this.human() ? (this.friend ? `${this.nameOf(s.turn)}: choose a bowl on your side` : 'Choose a bowl on your side to sow') : `${this.nameOf(1)} is choosing…`;
    },
    sow(pit) {
      const s = this.s;
      if (this.state !== 'play' || V.busy() || !R.legal(s).includes(pit)) { A.play('nope'); return; }
      const ev = R.move(s, pit);
      A.play('scoop');
      V.hint = []; V.play(ev);
      this.waiting = true;
    },
    finish() {
      const s = this.s, w = s.winner;
      this.state = 'result';
      $('hud').classList.add('off');
      const you = w === 0 && !this.friend;
      if (you) { const k = this.opts.variant + this.opts.foe; this.record[k] = (this.record[k] || 0) + 1; set('record', this.record); }
      $('r-kicker').textContent = VARIANTS[s.variant].name;
      $('r-title').textContent = w === -1 ? 'An even harvest!' : this.friend ? `${this.nameOf(w)} wins!` : you ? 'A fine harvest! You win.' : `${this.nameOf(1)} wins this time`;
      $('r-stats').innerHTML = [[s.board[6], this.nameOf(0)], [s.board[13], this.nameOf(1)]].map(([b, l]) => `<div><b>${b}</b><small>${l}</small></div>`).join('');
      $('r-note').textContent = !this.friend && this.record[this.opts.variant + this.opts.foe] ? `Wins against ${this.nameOf(1)} with ${VARIANTS[s.variant].name.toLowerCase()}: ${this.record[this.opts.variant + this.opts.foe]}` : '';
      A.play(you || this.friend || w === -1 ? 'win' : 'lose');
      M.show('result', true);
    },

    // ---------- input ----------
    bind(canvas) {
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        A.unlock();
        document.body.dataset.device = 'keyboard';
        if (this.state === 'play' && /^Digit[1-6]$/.test(e.code)) { e.preventDefault(); const n = +e.code.slice(5) - 1; return this.sow(this.s.turn === 0 ? n : 12 - n); }
        const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', KeyP: 'pause', KeyM: 'mute' }[e.code];
        if (!k) return;
        e.preventDefault();
        this.events.push(k);
      });
      canvas.addEventListener('pointerdown', (e) => {
        A.unlock();
        document.body.dataset.device = e.pointerType === 'mouse' ? 'mouse' : 'touch';
        if (this.state !== 'play' || !this.human()) return;
        const i = V.slotAt(e.clientX, e.clientY);
        if (i >= 0) this.sow(i);
      });
      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse' || this.state !== 'play') return;
        const i = V.slotAt(e.clientX, e.clientY);
        V.hover = V.hint.includes(i) ? i : -1;
        canvas.style.cursor = V.hover >= 0 ? 'pointer' : '';
      });
      addEventListener('gamepadconnected', () => { document.body.dataset.device = 'gamepad'; });
    },
    pollPad() {
      const gp = Array.from((navigator.getGamepads && navigator.getGamepads()) || []).find((p) => p && p.connected);
      if (!gp) return;
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      for (const [i, a] of Object.entries({ 0: 'confirm', 1: 'back', 9: 'pause' })) { const on = b(i); if (on && !this.padPrev[i]) { this.events.push(a); A.unlock(); document.body.dataset.device = 'gamepad'; } this.padPrev[i] = on; }
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
        if (!this.human() || V.busy()) return;
        const legal = R.legal(this.s);
        if (!legal.length) return;
        // the cursor walks along the mover's row in screen order
        const row = R.pitsOf(this.s.turn).slice().sort((a, b) => V.slotPos(a)[0] - V.slotPos(b)[0]);
        if (!row.includes(this.cur)) this.cur = legal[0];
        if (e === 'left' || e === 'right') { const i = row.indexOf(this.cur); this.cur = row[Math.max(0, Math.min(5, i + (e === 'left' ? -1 : 1)))]; A.play('move'); }
        else if (e === 'confirm') this.sow(this.cur);
        V.hover = this.cur;
        return;
      }
      const cur = M.current && M.current.id;
      if (e === 'back' || e === 'pause') { if (cur === 's-pause') this.resume(); else if (cur === 's-settings' || cur === 's-how' || cur === 's-setup') this.act('back'); else if (cur === 's-result') this.act('quit'); return; }
      if (e === 'confirm') M.confirm();
      else if (['left', 'right', 'up', 'down'].includes(e)) M.nav(e);
    },

    // ---------- time ----------
    update(dt) {
      this.pollPad();
      for (const e of this.events.splice(0)) this.handle(e);
      if (this.landT) this.landT = Math.max(0, this.landT - dt);
      if (this.state === 'paused') { A.update(false); return; }
      V.tick(dt);
      A.update(this.state === 'play');
      const s = this.s;
      if (this.state === 'title' || this.state === 'setup') {
        // the board behind the menus plays itself
        if (!V.busy()) {
          this.demoT -= dt;
          if (this.demoT <= 0) { if (s.over) this.demo(); else { V.play(R.move(s, R.bot(s, 0))); this.demoT = 0.8; } }
        }
        return;
      }
      if (this.state !== 'play') return;
      if (this.waiting && !V.busy()) {
        this.waiting = false;
        this.hud();
        if (s.over) { setTimeout(() => this.finish(), 700); this.state = 'ending'; return; }
      }
      if (!this.waiting && !s.over && !this.human()) {
        this.thinkT += dt;
        if (this.thinkT > 0.7 * this.settings.pace) {
          this.thinkT = 0;
          const m = R.bot(s, this.opts.foe);
          if (m !== null) { A.play('scoop'); V.play(R.move(s, m)); this.waiting = true; $('say').textContent = `${this.nameOf(1)} sows`; }
        }
      }
      if (this.human()) V.hint = !this.waiting ? R.legal(s) : [];
    },
    render(ctx) { V.draw(ctx, this.s); },
  };
  OS.Game = G;
})();
