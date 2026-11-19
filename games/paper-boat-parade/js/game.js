// Paper Boat Parade game flow: the shore (title), choosing captains, the
// race itself (rolling, hopping boats, computer turns) and the finish.
(function () {
  const R = PB.Rules, V = PB.View, M = PB.Menus, A = PB.Audio;
  const $ = (id) => document.getElementById(id);
  const P = 'paper-boat-parade:', mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(P + k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : d; };
  const set = (k, v) => { mem[k] = v; try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* not saved */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KIND = { human: 'Player', easy: 'Computer · easy', normal: 'Computer' };
  const CYCLE = ['human', 'normal', 'easy', null];

  const G = {
    state: 'title', from: 'title', g: null, anims: [], rolling: null, die: { rx: -0.42, ry: 0.5, rz: 0 }, dieShown: 6, wait: 0, sel: 0, muted: false, events: [], padPrev: {}, padDir: null,
    settings: Object.assign({ sfx: 8, music: 5, speed: 1, auto: true, reduced: reduce, seats: ['human', 'normal', 'normal', 'normal'], rules: { currents: true, needSix: true, threeSixes: true } }, get('settings', {})),

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
        { key: 'music', label: 'Festival music', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'speed', label: 'Boat speed', note: 'How fast boats hop and computers play', type: 'action', text: () => (s.speed > 1 ? 'Brisk' : 'Gentle'), run: () => { s.speed = s.speed > 1 ? 1 : 2; this.apply(); } },
        { key: 'auto', label: 'Auto-move', note: 'Move by itself when only one boat can', type: 'toggle', get: () => s.auto, set: ch('auto') },
        { key: 'reduced', label: 'Reduced motion', type: 'toggle', get: () => s.reduced, set: ch('reduced') },
        { key: 'fs', label: 'Fullscreen', type: 'action', text: () => (fs() ? 'On' : 'Off'), run: () => { this.fullscreen(); setTimeout(() => M.paintSettings(), 300); } },
      ]);
    },
    fullscreen() {
      const d = document, el = d.documentElement;
      try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { M.toast('No fullscreen here'); }
    },
    resize(W, H) { this.W = W; this.H = H; V.resize(W, H, W < 600 ? 64 : 58, W < 600 ? 128 : 84); },
    speed() { return this.settings.reduced ? 3 : this.settings.speed; },

    // ---------- screens ----------
    demo() { this.g = R.create({ seats: ['easy', 'easy', 'easy', 'easy'], seed: (Math.random() * 1e9) | 0 }); this.anims = []; this.rolling = null; },
    showTitle() {
      const rec = get('record', { games: 0, wins: 0 });
      $('t-record').textContent = rec.games ? `Races sailed: ${rec.games} · won: ${rec.wins}` : 'Two to four captains';
      this.state = 'title'; $('hud').classList.add('off');
      M.show('title');
    },
    showSetup() {
      this.from = this.state === 'result' ? 'result' : 'title';
      this.paintSetup();
      A.play('confirm');
      M.show('setup', true);
    },
    paintSetup() {
      const s = this.settings;
      $('seats').innerHTML = s.seats.map((k, i) => `<button class="seat ${k ? '' : 'off'}" data-nav data-act="seat-${i}" style="--c:${V.SEAT[i].c}"><i class="boat"></i><b>${R.NAMES[i]}</b><small>${k ? KIND[k] : 'Empty harbour'}</small></button>`).join('');
      const rule = (key, label, note) => `<button class="set-row" data-nav data-act="rule-${key}"><span>${label}<small>${note}</small></span><span class="val"><span class="switch ${s.rules[key] ? 'on' : ''}"></span></span></button>`;
      $('rules-list').innerHTML = rule('currents', 'Fast water', 'Arrows at the bends carry boats three squares') + rule('needSix', 'Launch on a six', 'A boat leaves its harbour only on a 6') + rule('threeSixes', 'Three sixes', 'Three 6s in a row ends the turn');
      const n = s.seats.filter(Boolean).length;
      $('setup-note').textContent = n < 2 ? 'Choose at least two captains.' : 'Tap a harbour to change its captain.';
    },
    start(seats) {
      A.unlock(); A.play('confirm');
      if (seats) this.settings.seats = seats;
      const s = this.settings;
      if (s.seats.filter(Boolean).length < 2) { M.toast('Choose at least two captains'); A.play('deny'); return; }
      this.apply();
      M.fade(true);
      setTimeout(() => {
        this.g = R.create({ seats: s.seats.slice(), needSix: s.rules.needSix, currents: s.rules.currents, threeSixes: s.rules.threeSixes, seed: (Math.random() * 1e9) | 0 });
        this.anims = []; this.rolling = null; this.wait = 0.6; this.sel = 0;
        this.state = 'play';
        $('hud').classList.remove('off');
        M.show(null); M.fade(false);
        this.hud();
        M.toast(`${this.who(this.g.turn)} sails first`);
      }, this.settings.reduced ? 0 : 300);
    },
    quit() { M.fade(true); setTimeout(() => { this.demo(); this.showTitle(); M.fade(false); }, this.settings.reduced ? 0 : 300); },
    pause() { if (this.state !== 'play') return; this.state = 'paused'; A.play('back'); $('hud').classList.add('off'); M.show('pause', true); },
    resume() { if (this.state !== 'paused') return; this.state = 'play'; A.play('confirm'); $('hud').classList.remove('off'); M.show(null); },
    act(a) {
      if (a && a.startsWith('seat-')) { const i = +a.slice(5), s = this.settings.seats; s[i] = CYCLE[(CYCLE.indexOf(s[i]) + 1) % CYCLE.length]; A.play('move'); this.apply(); return this.paintSetup(); }
      if (a && a.startsWith('rule-')) { const k = a.slice(5); this.settings.rules[k] = !this.settings.rules[k]; A.play('move'); this.apply(); return this.paintSetup(); }
      switch (a) {
        case 'setup': return this.showSetup();
        case 'quick': return this.start(['human', 'normal', 'normal', 'normal']);
        case 'start': return this.start();
        case 'how': this.from = this.state === 'paused' ? 'pause' : 'title'; A.play('confirm'); return M.show('how', true);
        case 'settings': this.from = this.state === 'paused' ? 'pause' : 'title'; this.buildSettings(); A.play('confirm'); return M.show('settings', true);
        case 'back': A.play('back'); if (this.from === 'title') return this.showTitle(); return M.show(this.from, true);
        case 'pause': return this.pause();
        case 'resume': return this.resume();
        case 'restart': return this.start();
        case 'quit': A.play('back'); return this.quit();
        case 'roll': return this.press();
      }
    },

    // ---------- the race ----------
    // the race behind the title screen plays silently
    say(m) { if (this.state === 'play') M.toast(m); },
    sfx(n, a) { if (this.state === 'play') A.play(n, a); },
    humans() { return this.g.seats.filter((k) => k === 'human').length; },
    isHuman(seat) { return this.g.seats[seat] === 'human'; },
    who(seat) { return this.isHuman(seat) && this.humans() === 1 ? 'You' : R.NAMES[seat]; },
    busy() { return this.anims.length > 0 || !!this.rolling; },
    // the one button: roll, or move the chosen boat
    press() {
      const g = this.g;
      if (this.state !== 'play' || this.busy() || !this.isHuman(g.turn)) return;
      if (g.phase === 'roll') this.startRoll();
      else if (g.phase === 'move') { const ms = R.moves(g); if (ms.length) this.doMove(ms[this.sel % ms.length]); }
    },
    startRoll() {
      const sp = this.speed();
      this.rolling = { t: 0, dur: 0.8 / sp, value: 1 + Math.floor(Math.random() * 6), spin: [8 + Math.random() * 6, 6 + Math.random() * 6, 4 + Math.random() * 4] };
      this.sfx('rattle');
    },
    endRoll() {
      const r = this.rolling, g = this.g;
      this.rolling = null; this.dieShown = r.value; Object.assign(this.die, V.faceUp(r.value));
      const ev = R.roll(g, r.value);
      this.sel = 0;
      for (const e of ev) {
        if (e.type === 'roll' && e.value === 6) this.sfx('six');
        if (e.type === 'threeSixes') { this.say('Three sixes! The boats stay put'); this.sfx('stuck'); }
        if (e.type === 'stuck') { this.say(`${this.who(e.seat)} can't move${this.who(e.seat) === 'You' ? '' : ''}`); this.sfx('stuck'); }
        if (e.type === 'turn') this.sfx('turn');
      }
      this.wait = 0.55 / this.speed();
      this.hud();
    },
    // where a boat is drawn: its board cell, nudged apart when boats share a square
    spot(seat, boat) {
      const g = this.g, st = g.boats[seat][boat], [u, v] = R.cell(seat, st, boat);
      if (st < 0 || st === R.HOME) return [u, v];
      const key = (s, b) => R.cell(s, g.boats[s][b], b).map((x) => x.toFixed(2)).join();
      const k = key(seat, boat), same = [];
      for (let s = 0; s < 4; s++) if (g.boats[s]) g.boats[s].forEach((x, b) => { if (x >= 0 && x !== R.HOME && key(s, b) === k) same.push(s * 4 + b); });
      if (same.length < 2) return [u, v];
      const i = same.indexOf(seat * 4 + boat), a = (i / same.length) * Math.PI * 2;
      return [u + Math.cos(a) * 0.2, v + Math.sin(a) * 0.2];
    },
    doMove(boat) {
      const g = this.g, seat = g.turn, from = g.boats[seat][boat];
      const before = g.boats.map((b) => b && b.slice());
      const ev = R.move(g, boat);
      const mv = ev.find((e) => e.type === 'move' || e.type === 'launch');
      if (!mv) return;
      const sp = this.speed(), pts = [];
      if (from < 0) { pts.push(R.cell(seat, -1, boat), R.cell(seat, 0, boat)); this.sfx('launch'); }
      else for (let s = from; s <= mv.to; s++) pts.push(R.cell(seat, s, boat));
      const cur = ev.find((e) => e.type === 'current');
      const after = [];
      if (cur) for (let s = cur.from + 1; s <= cur.to; s++) after.push(R.cell(seat, s, boat));
      const caps = ev.filter((e) => e.type === 'capture');
      this.anims.push({ seat, boat, pts, i: 0, t: 0, step: 0.2 / sp, hop: true, done: () => {
        if (after.length) { this.sfx('current'); this.say('Fast water!'); this.anims.unshift({ seat, boat, pts: [pts[pts.length - 1], ...after], i: 0, t: 0, step: 0.09 / sp, hop: false, done: () => this.landed(seat, boat, ev, caps, before) }); }
        else this.landed(seat, boat, ev, caps, before);
      } });
      this.hud();
    },
    landed(seat, boat, ev, caps, before) {
      const [u, v] = R.cell(seat, this.g.boats[seat][boat], boat);
      this.sfx('land', seat);
      V.splash(u, v, '#cdeffc', 8);
      for (const c of caps) {
        const at = R.cell(c.victim, before[c.victim][c.boat], c.boat), home = R.cell(c.victim, -1, c.boat);
        this.sfx('capture'); V.splash(at[0], at[1], V.SEAT[c.victim].c, 18);
        if (this.settings.shake !== false) V.shake = 0.5;
        this.say(`${this.who(seat)} sank ${R.NAMES[c.victim]}'s boat!`);
        this.anims.push({ seat: c.victim, boat: c.boat, pts: [at, at, home], i: 0, t: 0, step: 0.35 / this.speed(), sink: true, done: () => {} });
      }
      for (const e of ev) {
        if (e.type === 'home') { this.sfx('home'); const c = V.P(7.5, 7.5, 0.3); V.firework(c[0], c[1], V.SEAT[e.seat].l); }
        if (e.type === 'finish') { this.say(e.place === 1 ? `${this.who(e.seat)} ${this.who(e.seat) === 'You' ? 'win' : 'wins'} the parade!` : `${R.NAMES[e.seat]} is home, place ${e.place}`); this.sfx('win'); }
        if (e.type === 'again' && !caps.length && !ev.some((x) => x.type === 'home')) this.say(this.isHuman(e.seat) ? 'Six! Roll again' : `${R.NAMES[e.seat]} rolls again`);
        if (e.type === 'turn') this.sfx('turn');
      }
      this.wait = 0.5 / this.speed();
      this.hud();
    },
    showResult() {
      const g = this.g, order = g.finished.slice();
      const rest = [0, 1, 2, 3].filter((s) => g.seats[s] && order.indexOf(s) < 0).sort((a, b) => g.boats[b].reduce((x, y) => x + Math.max(0, y), 0) - g.boats[a].reduce((x, y) => x + Math.max(0, y), 0));
      const all = order.concat(rest), w = all[0];
      this.state = 'result';
      $('hud').classList.add('off');
      const rec = get('record', { games: 0, wins: 0 });
      rec.games++; if (this.isHuman(w)) rec.wins++;
      set('record', rec);
      $('r-title').textContent = this.who(w) === 'You' ? 'You win the parade!' : `${R.NAMES[w]} wins!`;
      $('r-places').innerHTML = all.map((s, i) => `<li style="--c:${V.SEAT[s].c}"><b>${i + 1}. ${R.NAMES[s]}</b><small>${KIND[g.seats[s]]} · ${g.boats[s].filter((x) => x === R.HOME).length} home · ${g.stats[s].captures} sunk</small></li>`).join('');
      for (let i = 0; i < 4; i++) setTimeout(() => { V.firework(this.W * (0.2 + Math.random() * 0.6), this.H * (0.15 + Math.random() * 0.3), V.SEAT[i].l); this.sfx('pop'); }, i * 350);
      M.show('result', true);
    },
    hud() {
      const g = this.g; if (!g) return;
      for (let s = 0; s < 4; s++) {
        const el = $('pl-' + s), k = g.seats[s];
        el.classList.toggle('out', !k);
        el.classList.toggle('turn', g.turn === s && g.phase !== 'over');
        el.querySelector('small').textContent = k ? (k === 'human' ? (this.humans() === 1 ? 'You' : 'Player') : KIND[k]) : 'Empty';
        el.querySelector('.homes').innerHTML = k ? g.boats[s].map((x) => `<i class="${x === R.HOME ? 'on' : ''}"></i>`).join('') : '';
      }
      const btn = $('act'), human = this.isHuman(g.turn), touch = document.body.dataset.device === 'touch';
      btn.classList.toggle('wait', !human || this.busy());
      if (g.phase === 'over') { $('act-label').textContent = 'The parade is over'; $('act-sub').textContent = ''; }
      else if (!human) { $('act-label').textContent = `${R.NAMES[g.turn]} is sailing…`; $('act-sub').textContent = 'Computer captain'; }
      else if (g.phase === 'roll') { $('act-label').textContent = this.humans() > 1 ? `${R.NAMES[g.turn]}: roll` : 'Roll the die'; $('act-sub').textContent = touch ? '' : 'Space, or tap the die'; }
      else { $('act-label').textContent = 'Move this boat'; $('act-sub').textContent = touch ? 'Or tap a glowing boat' : 'Arrows choose · Enter moves'; }
    },

    // ---------- input ----------
    bind(canvas) {
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        A.unlock();
        const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', Tab: 'next', Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', KeyP: 'pause', KeyM: 'mute' }[e.code];
        if (!k) return;
        e.preventDefault(); document.body.dataset.device = 'keyboard';
        this.events.push(k);
      });
      canvas.addEventListener('pointerdown', (e) => {
        A.unlock();
        document.body.dataset.device = e.pointerType === 'mouse' ? 'mouse' : 'touch';
        if (this.state !== 'play' || this.busy() || !this.isHuman(this.g.turn)) return;
        const g = this.g;
        if (g.phase === 'roll') { const d = this.dieAt(); if (Math.hypot(e.clientX - d[0], e.clientY - d[1]) < d[2] * 2.2) this.startRoll(); return; }
        let best = -1, bd = 1e9;
        for (const b of R.moves(g)) { const [u, v] = this.spot(g.turn, b), p = V.P(u, v, 0.2), dist = Math.hypot(e.clientX - p[0], e.clientY - p[1]); if (dist < bd && dist < p[2] * 0.8) { bd = dist; best = b; } }
        if (best >= 0) this.doMove(best);
      });
      addEventListener('gamepadconnected', () => { document.body.dataset.device = 'gamepad'; });
    },
    pollPad() {
      const gp = Array.from((navigator.getGamepads && navigator.getGamepads()) || []).find((p) => p && p.connected);
      if (!gp) return;
      const map = { 0: 'confirm', 1: 'back', 9: 'pause', 12: 'up', 13: 'down', 14: 'left', 15: 'right', 5: 'next' };
      for (const [i, a] of Object.entries(map)) { const on = !!(gp.buttons[i] && gp.buttons[i].pressed); if (on && !this.padPrev[i]) { this.events.push(a); document.body.dataset.device = 'gamepad'; A.unlock(); } this.padPrev[i] = on; }
    },
    handle(e) {
      if (e === 'mute') { this.muted = !this.muted; this.apply(); M.toast(this.muted ? 'Sound off' : 'Sound on'); return; }
      if (this.state === 'play') {
        if (e === 'back' || e === 'pause') return this.pause();
        if (e === 'confirm') return this.press();
        const g = this.g;
        if (g.phase === 'move' && this.isHuman(g.turn) && ['left', 'right', 'up', 'down', 'next'].includes(e)) { const n = R.moves(g).length; this.sel = (this.sel + (e === 'left' || e === 'up' ? n - 1 : 1)) % n; A.play('move'); }
        return;
      }
      const cur = M.current && M.current.id;
      if (e === 'back' || e === 'pause') { if (cur === 's-pause') this.resume(); else if (['s-settings', 's-how', 's-setup'].includes(cur)) this.act('back'); return; }
      if (e === 'confirm') M.confirm();
      else if (['left', 'right', 'up', 'down'].includes(e)) M.nav(e);
      else if (e === 'next') M.nav('right');
    },

    // ---------- time ----------
    update(dt) {
      this.pollPad();
      for (const e of this.events.splice(0)) this.handle(e);
      V.tick(dt);
      A.update(this.state === 'play');
      const g = this.g; if (!g) return;
      const live = this.state === 'play' || this.state === 'title';
      if (!live) return;
      // boats hopping
      if (this.anims.length) {
        const an = this.anims[0];
        an.t += dt;
        while (an.t >= an.step && an.i < an.pts.length - 1) { an.t -= an.step; an.i++; if (an.hop) A.play('hop', an.i); }
        if (an.i >= an.pts.length - 1) { this.anims.shift(); an.done(); }
        return;
      }
      if (this.rolling) {
        const r = this.rolling; r.t += dt;
        const k = Math.min(1, r.t / r.dur), ease = 1 - Math.pow(1 - k, 3), fin = V.faceUp(r.value);
        this.die.rx = fin.rx + r.spin[0] * (1 - ease); this.die.ry = fin.ry + r.spin[1] * (1 - ease); this.die.rz = fin.rz + r.spin[2] * (1 - ease);
        if (k >= 1) this.endRoll();
        return;
      }
      if (g.phase === 'over') { if (this.state === 'play') { this.wait -= dt; if (this.wait <= -1.2) this.showResult(); } else this.demo(); return; }
      this.wait -= dt;
      if (this.wait > 0) return;
      const human = this.isHuman(g.turn) && this.state === 'play';
      if (g.phase === 'roll' && !human) this.startRoll();
      else if (g.phase === 'move') {
        const ms = R.moves(g);
        if (!human) this.doMove(R.think(g, g.seats[g.turn]));
        else if (this.settings.auto && ms.length === 1) { this.wait = 0.3; this.doMove(ms[0]); }
      }
    },
    dieAt() {
      const c = V.P(7.5, 7.5, 1.1);
      return [c[0], c[1], Math.max(14, c[2] * 0.42)];
    },
    render(ctx) {
      const g = this.g;
      ctx.save();
      if (V.shake > 0 && !V.reduced) ctx.translate((Math.random() - 0.5) * V.shake * 10, (Math.random() - 0.5) * V.shake * 10);
      V.sky(ctx);
      const human = g && this.isHuman(g.turn) && this.state === 'play' && !this.busy();
      const ms = g && g.phase === 'move' && human ? R.moves(g) : [];
      const chosen = ms.length ? ms[this.sel % ms.length] : -1;
      let preview = null;
      if (chosen >= 0) { const to = R.target(g, g.turn, chosen, g.roll); if (to !== null) preview = R.cell(g.turn, to, chosen); }
      V.board(ctx, g, { preview });
      if (g) {
        const items = [];
        for (let s = 0; s < 4; s++) if (g.boats[s]) g.boats[s].forEach((st, b) => {
          const an = this.anims.find((a) => a.seat === s && a.boat === b);
          let u, v, lift = 0, scale = 1;
          if (an) {
            const a = an.pts[an.i], n = an.pts[Math.min(an.i + 1, an.pts.length - 1)], f = Math.min(1, an.t / an.step);
            u = a[0] + (n[0] - a[0]) * f; v = a[1] + (n[1] - a[1]) * f;
            if (an.hop) lift = Math.sin(f * Math.PI) * 0.45;
            if (an.sink) { scale = an.i === 0 ? 1 - f * 0.9 : 0.1 + f * 0.9; if (an.i === 0) { u = a[0]; v = a[1]; } }
          } else [u, v] = this.spot(s, b);
          const can = ms.indexOf(b) >= 0 && s === g.turn;
          const ring = can ? (b === chosen && document.body.dataset.device !== 'touch' && document.body.dataset.device !== 'mouse' ? '#ffffff' : `rgba(255,255,255,${0.45 + 0.4 * Math.sin(V.time * 6)})`) : null;
          items.push({ v, draw: () => V.boat(ctx, s, u, v, { lift, scale, ring }) });
        });
        items.sort((a, b) => a.v - b.v).forEach((it) => it.draw());
        // the die, tumbling on the ghat
        const [dx, dy, ds] = this.dieAt();
        V.die(ctx, dx, dy, ds, this.die);
        if (human && g.phase === 'roll') { ctx.strokeStyle = `rgba(255,220,140,${0.5 + 0.4 * Math.sin(V.time * 5)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(dx, dy, ds * 1.9, 0, Math.PI * 2); ctx.stroke(); }
      }
      V.effects(ctx);
      ctx.restore();
    },
  };
  PB.Game = G;
})();
