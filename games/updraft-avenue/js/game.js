// Updraft Avenue game flow: the festival poster (title), choosing kites,
// the board and the house rules, the race, and the prize-giving.
(function () {
  const R = UA.Rules, V = UA.View, M = UA.Menus, A = UA.Audio;
  const $ = (id) => document.getElementById(id);
  const P = 'updraft-avenue:', mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(P + k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : d; };
  const set = (k, v) => { mem[k] = v; try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* not saved */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NAMES = ['Poppy', 'Skipper', 'Juniper', 'Wren'];
  const BOARD_KEYS = Object.keys(R.BOARDS);

  const G = {
    state: 'title', from: 'title', s: null, timers: [], waitFor: null, muted: false, events: [], padPrev: {}, padDir: null, rollT: 0, shown: null,
    seatKinds: get('seats', ['human', 'bot', 'bot', null]),
    opts: Object.assign({ board: 'oldtown', pick: false, sixes: true, ribbons: true }, get('opts', {})),
    settings: Object.assign({ sfx: 8, music: 5, pace: 1, reduced: reduce }, get('settings', {})),
    wins: get('wins', 0),

    init(canvas) {
      this.canvas = canvas;
      M.init((a) => this.act(a));
      this.buildSettings(); this.apply();
      this.bind(canvas);
      V.onHop = (i, q) => { if (q.kind === 'step') A.play('hop', q.n || 0); if (q.kind === 'land') A.play('land'); };
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
        { key: 'sfx', label: 'Flutters and whooshes', type: 'slider', get: () => s.sfx, set: ch('sfx') },
        { key: 'music', label: 'Festival waltz', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'pace', label: 'Kite speed', type: 'action', text: () => (s.pace > 1 ? 'Leisurely' : s.pace < 1 ? 'Breezy' : 'Steady'), run: () => { s.pace = s.pace > 1 ? 1 : s.pace < 1 ? 1.4 : 0.6; this.apply(); } },
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
      const play = this.state !== 'title' && this.state !== 'setup';
      const portrait = this.H > this.W;
      V.layout(this.W, this.H, play ? (portrait ? 96 : 70) : 30, play ? (portrait ? 150 : 96) : 30);
      if (this.s) V.settle(this.s.pos, this.state === 'play' ? this.s.turn : -1);
    },
    after(sec, fn) { this.timers.push({ t: sec * (this.settings.reduced ? 0.3 : this.settings.pace), fn }); },
    whenStill(fn) { this.waitFor = fn; },

    // ---------- screens ----------
    demo() {
      this.s = R.create({ players: NAMES, board: BOARD_KEYS[(Math.random() * 3) | 0], rules: { pick: true } });
      V.board = this.s.board; V.taken = this.s.taken; V.kites = []; V.kiteCol = null; this.layout();
      this.demoT = 1;
    },
    showTitle() {
      this.state = 'title';
      $('t-wins').textContent = this.wins ? `${this.wins} festival${this.wins === 1 ? '' : 's'} won` : 'Kites at the ready!';
      $('hud').classList.add('off');
      M.show('title');
    },
    showSetup() {
      this.state = 'setup';
      this.paintSetup();
      M.show('setup', true);
    },
    paintSetup() {
      const k = this.seatKinds, o = this.opts;
      if (k.filter(Boolean).length < 1) k[1] = 'bot';
      $('kites').innerHTML = [0, 1, 2, 3].map((i) => {
        const kind = i === 0 ? 'human' : k[i], c = V.KITES[i];
        const label = i === 0 ? 'You' : kind === 'bot' ? NAMES[i] : kind === 'human' ? `Player ${i + 1}` : 'No kite';
        return `<button class="kite-tag ${kind ? '' : 'empty'}" data-nav data-act="seat-${i}" ${i === 0 ? 'disabled' : ''} style="--a:${c.a};--b:${c.b}"><i></i><b>${label}</b><small>${i === 0 ? 'Your kite' : kind === 'bot' ? 'Computer' : kind === 'human' ? 'Pass and play' : 'Tap to add'}</small></button>`;
      }).join('');
      $('boards').innerHTML = BOARD_KEYS.map((b) => `<button class="chip ${o.board === b ? 'on' : ''}" data-nav data-act="board-${b}">${R.BOARDS[b].name}</button>`).join('');
      $('house').innerHTML = [['pick', 'Pick a die', 'Roll two, fly either'], ['sixes', 'Sixes again', 'A six rolls once more'], ['ribbons', 'Ribbons', 'Collect them for re-rolls']]
        .map(([key, l, n]) => `<button class="chip toggle ${o[key] ? 'on' : ''}" data-nav data-act="rule-${key}"><b>${l}</b><small>${n}</small></button>`).join('');
      set('seats', k); set('opts', o);
    },
    act(a) {
      const refocus = (sel) => { const el = document.querySelector(`[data-act="${sel}"]`); if (el) M.setFocus(el, true); };
      if (a.startsWith('seat-')) { const i = +a.slice(5), order = ['bot', 'human', null], k = this.seatKinds; k[i] = order[(order.indexOf(k[i]) + 1) % 3]; if (!k.slice(1).some(Boolean)) k[i] = 'bot'; A.play('move'); this.paintSetup(); return refocus(a); }
      if (a.startsWith('board-')) { this.opts.board = a.slice(6); A.play('move'); this.paintSetup(); return refocus(a); }
      if (a.startsWith('rule-')) { const k = a.slice(5); this.opts[k] = !this.opts[k]; A.play('move'); this.paintSetup(); return refocus(a); }
      if (a.startsWith('fly-')) return this.fly(+a.slice(4));
      switch (a) {
        case 'play': A.unlock(); A.play('confirm'); return this.showSetup();
        case 'start': return this.start();
        case 'roll': return this.roll();
        case 'reroll': return this.reroll();
        case 'how': this.from = this.state === 'paused' ? 'pause' : this.state === 'setup' ? 'setup' : 'title'; A.play('confirm'); return M.show('how', true);
        case 'settings': this.from = this.state === 'paused' ? 'pause' : 'title'; this.buildSettings(); A.play('confirm'); return M.show('settings', true);
        case 'back': A.play('back'); if (this.state === 'setup' && this.from !== 'setup') { return this.showTitle(); } if (this.from === 'title') return this.showTitle(); if (this.from === 'setup') { this.from = 'title'; return M.show('setup', true); } return M.show(this.from, true);
        case 'pause': return this.pause();
        case 'resume': return this.resume();
        case 'restart': return this.start();
        case 'quit': A.play('back'); return this.quit();
      }
    },
    quit() { M.fade(true); setTimeout(() => { this.timers = []; this.waitFor = null; this.demo(); this.showSetup(); $('hud').classList.add('off'); this.layout(); M.fade(false); }, this.settings.reduced ? 0 : 300); },
    pause() { if (this.state !== 'play') return; this.state = 'paused'; A.play('back'); $('hud').classList.add('off'); M.show('pause', true); },
    resume() { if (this.state !== 'paused') return; this.state = 'play'; A.play('confirm'); $('hud').classList.remove('off'); M.show(null); M.current = $('hud'); },

    // ---------- the race ----------
    start() {
      A.unlock(); A.play('confirm');
      M.fade(true);
      setTimeout(() => {
        this.seats = [];
        [0, 1, 2, 3].forEach((i) => { const kind = i === 0 ? 'human' : this.seatKinds[i]; if (kind) this.seats.push({ kind, name: i === 0 ? 'You' : kind === 'bot' ? NAMES[i] : `Player ${i + 1}`, col: i }); });
        this.hotseat = this.seats.filter((p) => p.kind === 'human').length > 1;
        const o = this.opts;
        this.s = R.create({ players: this.seats.map((p) => p.name), board: o.board, rules: { pick: o.pick, sixes: o.sixes, ribbons: o.ribbons } });
        this.timers = []; this.waitFor = null; this.shown = null;
        V.board = this.s.board; V.taken = this.s.taken; V.glow = null;
        // kites are numbered by seat colour
        V.kites = []; V.kiteCol = this.seats.map((p) => p.col);
        this.state = 'play'; this.layout();
        $('hud').classList.remove('off');
        $('h-board').textContent = this.s.board.name;
        M.show(null); M.current = $('hud'); M.fade(false);
        this.tags();
        this.turnStart();
      }, this.settings.reduced ? 0 : 300);
    },
    me() { return this.seats[this.s.turn]; },
    mine() { return this.me().kind === 'human'; },
    say(t) { $('say').innerHTML = t; },
    buttons(list) {
      $('acts').innerHTML = list.map((b) => `<button class="btn ${b.hot ? 'hot' : ''}" data-nav data-act="${b.act}" ${b.off ? 'disabled' : ''}><b>${b.text}</b>${b.sub ? `<small>${b.sub}</small>` : ''}</button>`).join('');
      const first = $('acts').querySelector('[data-nav]:not([disabled])');
      if (first && (document.body.dataset.device === 'keyboard' || document.body.dataset.device === 'gamepad')) M.setFocus(first, true);
    },
    tags() {
      const s = this.s;
      $('tags').innerHTML = this.seats.map((p, i) => { const c = V.KITES[p.col]; return `<div class="tag ${i === s.turn && !s.over ? 'cur' : ''}" style="--a:${c.a};--b:${c.b}"><i></i><span>${p.name}</span><b>${s.pos[i] || 'start'}</b>${s.ribbons[i] ? `<em>${'🎀'.repeat(Math.min(3, s.ribbons[i]))}</em>` : ''}</div>`; }).join('');
    },
    turnStart() {
      const s = this.s, p = this.me();
      V.settle(s.pos, s.turn); this.tags();
      V.glow = null;
      if (this.mine()) {
        if (this.hotseat) M.toast(`${p.name}'s turn`);
        this.say(`<b>${p.name === 'You' ? 'Your' : p.name + "'s"}</b> turn · square ${s.pos[s.turn] || 'start'}`);
        this.buttons([{ act: 'roll', text: s.rules.pick ? 'Roll two dice' : 'Roll the die', hot: true }]);
      } else {
        this.say(`<b>${p.name}</b> is rolling…`); this.buttons([]);
        this.after(0.7, () => this.roll());
      }
    },
    roll() {
      const s = this.s;
      if (this.state !== 'play' || (s.phase !== 'roll' && s.phase !== 'reroll')) return;
      const d = R.roll(s);
      if (!d) return;
      A.play('rattle'); this.buttons([]);
      this.rollT = this.settings.reduced ? 0.01 : 0.7; this.shown = d.slice();
      this.after(0.75, () => this.rolled());
    },
    reroll() {
      const s = this.s;
      if (!this.mine() || !R.reroll(s)) return A.play('deny');
      A.play('ribbon'); A.play('rattle'); this.tags();
      this.rollT = this.settings.reduced ? 0.01 : 0.7; this.shown = s.dice.slice();
      this.after(0.75, () => this.rolled());
    },
    rolled() {
      const s = this.s, p = this.me(), here = s.pos[s.turn];
      const lands = s.dice.map((k) => R.plan(s, here, k).to);
      if (this.mine()) {
        if (s.dice.length > 1 || s.ribbons[s.turn]) {
          V.glow = lands;
          this.say(s.dice.length > 1 ? 'Pick a die to fly' : `You rolled <b>${s.dice[0]}</b>`);
          this.buttons(s.dice.map((k, i) => ({ act: `fly-${i}`, text: `Fly ${k}`, sub: `to ${lands[i]}${lands[i] > here + k ? ' ↑' : lands[i] < here + k && here + k <= 100 ? ' ↓' : ''}`, hot: i === 0 })).concat(s.ribbons[s.turn] ? [{ act: 'reroll', text: 'Re-roll', sub: 'spend a ribbon' }] : []));
        } else this.after(0.35, () => this.fly(0));
      } else {
        const m = R.bot(s);
        if (m.reroll) { R.reroll(s); A.play('ribbon'); A.play('rattle'); M.toast(`${p.name} spends a ribbon`); this.tags(); this.shown = s.dice.slice(); this.rollT = 0.7; return this.after(0.75, () => this.rolled()); }
        V.glow = [lands[m.die]];
        this.after(0.5, () => this.fly(m.die));
      }
    },
    fly(i) {
      const s = this.s;
      if (this.state !== 'play' || s.phase !== 'move') return;
      const who = s.turn, from = s.pos[who];
      const ev = R.move(s, i);
      if (!ev) return;
      this.buttons([]); V.glow = null;
      const k = V.kites[who]; k.turn = false;
      const fx = (fn) => fn();
      let last = from;
      for (const e of ev) {
        if (e.type === 'fly') {
          e.steps.forEach((q, n) => { const [u0, v0] = V.sq(last || 1), [u1, v1] = V.sq(q), path = []; const a = last ? [u0, v0] : [k.u, k.v]; for (let t = 0; t <= 8; t++) { const f = t / 8; path.push([a[0] + (u1 - a[0]) * f, a[1] + (v1 - a[1]) * f, 0.9 + Math.sin(f * Math.PI) * 0.55]); } k.queue.push({ path, dur: this.settings.reduced ? 0.01 : 0.18 * this.settings.pace, t: 0, kind: 'step', n }); last = q; });
          if (e.bounce) this.after(0.2 * e.steps.length, () => M.toast('Bounced off the clocktower!'));
        } else if (e.type === 'up') {
          const path = V.path(e.from, e.to, 2.4, 30).map(([u, v, h]) => [u, v, h + 0.4]);
          k.queue.push({ path, dur: this.settings.reduced ? 0.01 : 1.1 * this.settings.pace, t: 0, kind: 'up' });
          this.afterSteps(who, 'up', () => { A.play('whoosh'); M.toast(`Updraft! Up to ${e.to}`); });
        } else if (e.type === 'down') {
          const path = V.path(e.from, e.to, 0.25, 30).map(([u, v, h], j, arr) => [u + Math.sin((j / arr.length) * Math.PI * 3) * 0.25, v, h]);
          k.queue.push({ path, dur: this.settings.reduced ? 0.01 : 1.0 * this.settings.pace, t: 0, kind: 'down' });
          this.afterSteps(who, 'down', () => { A.play('slide'); V.shake = 0.4; M.toast(`Down the drainpipe to ${e.to}`); });
        }
      }
      const rest = ev.filter((e) => e.type !== 'fly' && e.type !== 'up' && e.type !== 'down');
      this.whenStill(() => {
        A.play('land');
        for (const e of rest) {
          if (e.type === 'ribbon') { A.play('ribbon'); M.toast('A festival ribbon! Spend it on a re-roll'); }
          else if (e.type === 'bump') { A.play('bump'); M.toast(`${this.seats[e.who].name} is blown back to ${e.to}`); const kk = V.kites[e.who], [u1, v1] = V.sq(e.to || 1); kk.queue.push({ path: [[kk.u, kk.v, 0.9], [(kk.u + u1) / 2, (kk.v + v1) / 2, 1.8], [u1, v1, 0.9]], dur: 0.5, t: 0 }); }
          else if (e.type === 'win') return this.win(e.who);
          else if (e.type === 'again') { A.play('six'); M.toast('A six! Roll again'); }
        }
        this.tags();
        this.whenStill(() => this.after(0.35, () => this.turnStart()));
      });
    },
    // play a sound when a kite reaches the updraft or drainpipe part of its trip
    afterSteps(who, kind, fn) { this.pending = this.pending || []; this.pending.push({ who, kind, fn }); },
    win(who) {
      const p = this.seats[who];
      A.play('win');
      const [u, v] = V.sq(100), q = V.P(u, v, 2);
      V.confetti(q[0], q[1], this.settings.reduced ? 30 : 120);
      this.after(1.6, () => this.finish(who));
    },
    finish(who) {
      const s = this.s;
      this.state = 'result';
      $('hud').classList.add('off');
      const you = who === 0 && !this.hotseat;
      if (who === 0) { this.wins++; set('wins', this.wins); }
      $('r-title').textContent = you ? 'You reached the clocktower!' : `${this.seats[who].name} wins the festival!`;
      $('r-kicker').textContent = s.board.name;
      const order = this.seats.map((_, i) => i).sort((a, b) => (a === who ? -1 : b === who ? 1 : s.pos[b] - s.pos[a]));
      $('r-list').innerHTML = order.map((i, n) => { const c = V.KITES[this.seats[i].col]; return `<li style="--a:${c.a};--b:${c.b}"><i></i><b>${this.seats[i].name}</b><span>${n === 0 ? 'Winner' : `square ${s.pos[i]}`}</span><small>${s.stats[i].ups} updrafts · ${s.stats[i].downs} drainpipes</small></li>`; }).join('');
      M.show('result', true);
    },

    // ---------- input ----------
    bind(canvas) {
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        A.unlock();
        document.body.dataset.device = 'keyboard';
        const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', KeyP: 'pause', KeyM: 'mute', KeyR: 'roll' }[e.code];
        if (!k) return;
        e.preventDefault();
        this.events.push(k);
      });
      canvas.addEventListener('pointerdown', (e) => {
        A.unlock();
        document.body.dataset.device = e.pointerType === 'mouse' ? 'mouse' : 'touch';
        if (this.state !== 'play' || !this.mine()) return;
        // tap the dice tray to roll, or tap a highlighted square to fly there
        const s = this.s;
        if (s.phase === 'roll') { const b = this.diceBox(); if (e.clientX > b.x - 20 && e.clientY > b.y - 20) return this.roll(); }
        if (s.phase === 'move' && V.glow) { const n = V.squareAt(e.clientX, e.clientY), i = V.glow.indexOf(n); if (i >= 0) this.fly(i); }
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
        if (e === 'roll') return this.mine() && this.roll();
        if (!M.current) M.current = $('hud');
        if (e === 'confirm') { if (!M.focusEl || !$('acts').contains(M.focusEl)) { const f = $('acts').querySelector('[data-nav]:not([disabled])'); if (f) return f.click(); } return M.confirm(); }
        return M.nav(e);
      }
      if (e === 'roll') return;
      const cur = M.current && M.current.id;
      if (e === 'back' || e === 'pause') { if (cur === 's-pause') this.resume(); else if (cur === 's-settings' || cur === 's-how' || cur === 's-setup') this.act('back'); else if (cur === 's-result') this.act('quit'); return; }
      if (e === 'confirm') M.confirm();
      else if (['left', 'right', 'up', 'down'].includes(e)) M.nav(e);
    },
    // where the dice tumble on screen
    diceBox() { const s = Math.min(70, this.W * 0.14); return { x: this.W - s * 2.6 - 14, y: this.H - s * 1.5 - 14, s }; },

    // ---------- time ----------
    update(dt) {
      this.pollPad();
      for (const e of this.events.splice(0)) this.handle(e);
      V.tick(dt);
      A.update(this.state === 'play');
      if (this.rollT > 0) this.rollT -= dt;
      if (this.state === 'paused') return;
      // fire sounds as kites start the updraft or drainpipe leg of a trip
      if (this.pending && this.pending.length) for (const p of this.pending.slice()) { const k = V.kites[p.who]; if (k && k.queue[0] && k.queue[0].kind === p.kind) { p.fn(); this.pending.splice(this.pending.indexOf(p), 1); } else if (k && !k.queue.length) this.pending.splice(this.pending.indexOf(p), 1); }
      const due = [];
      for (const t of this.timers) { t.t -= dt; if (t.t <= 0) due.push(t); }
      if (due.length) { this.timers = this.timers.filter((t) => t.t > 0); for (const t of due) t.fn(); }
      if (this.waitFor && !V.moving()) { const f = this.waitFor; this.waitFor = null; f(); }
      if (this.state === 'title' || this.state === 'setup') {
        // the race behind the menus plays itself
        this.demoT -= dt;
        if (this.demoT <= 0 && !V.moving()) {
          const s = this.s;
          if (s.over) return this.demo();
          R.roll(s); const m = R.bot(s); if (m.reroll) R.reroll(s);
          const who = s.turn, ev = R.move(s, m.die || 0), k = V.kites[who];
          let last = ev[0].from;
          for (const e of ev) {
            if (e.type === 'fly') e.steps.forEach((q) => { V.hop(who, last, q); last = q; });
            else if (e.type === 'up') k.queue.push({ path: V.path(e.from, e.to, 2.4, 30), dur: 1.1, t: 0 });
            else if (e.type === 'down') k.queue.push({ path: V.path(e.from, e.to, 0.25, 30), dur: 1.0, t: 0 });
          }
          this.demoT = 0.9;
          this.whenStill(() => V.settle(s.pos, -1));
        }
      }
    },
    render(ctx) {
      V.draw(ctx, this.s);
      if (this.state === 'play' || this.state === 'paused') this.drawDice(ctx);
    },
    // the dice, tumbling in a little round tray in the corner
    drawDice(g) {
      const { x, y, s } = this.diceBox();
      g.save();
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.strokeStyle = '#3d2c1e'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(x + s * 1.3, y + s * 0.75, s * 1.45, s * 0.95, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      const vals = this.shown || [];
      const rolling = this.rollT > 0;
      vals.forEach((v, i) => {
        const cx = x + s * (vals.length > 1 ? 0.75 + i * 1.1 : 1.3), cy = y + s * 0.7;
        const shown = rolling ? 1 + Math.floor((this.rollT * 30 + i * 3) % 6) : v;
        const wob = rolling ? Math.sin(this.rollT * 40 + i) * 0.5 : 0;
        this.die2d(g, cx, cy - (rolling ? Math.abs(Math.sin(this.rollT * 12 + i)) * s * 0.3 : 0), s * 0.42, shown, wob, this.s && this.s.dice && this.s.phase === 'move');
      });
      if (!vals.length) { g.fillStyle = '#3d2c1e'; g.font = `${Math.round(s * 0.28)}px 'Grandstander', sans-serif`; g.textAlign = 'center'; g.fillText(this.mine && this.s && this.mine() ? 'tap to roll' : '', x + s * 1.3, y + s * 0.85); }
      g.restore();
    },
    die2d(g, x, y, r, v, rot, live) {
      g.save(); g.translate(x, y); g.rotate(rot);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(r * 0.15, r * 1.1, r * 0.9, r * 0.25, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d9cbb0'; this.rrect(g, -r, -r + r * 0.18, r * 2, r * 2, r * 0.35); g.fill();
      g.fillStyle = live ? '#fffdf6' : '#f1ead8'; this.rrect(g, -r, -r, r * 2, r * 2, r * 0.35); g.fill();
      g.strokeStyle = '#3d2c1e'; g.lineWidth = 2; g.stroke();
      const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v];
      g.fillStyle = v === 6 ? '#e63946' : '#2b2118';
      for (const [a, b] of P) { g.beginPath(); g.arc(a * r * 0.5, b * r * 0.5, r * 0.17, 0, Math.PI * 2); g.fill(); }
      g.restore();
    },
    rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); },
  };
  UA.Game = G;
})();
