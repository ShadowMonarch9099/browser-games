// Riverboat Dice game flow: the gangway (title), choosing a table, seating
// the players, the game itself, and the purser's tally at the end.
// One timeline (G.after) sequences rolls, landings and computer turns.
(function () {
  const R = RD.Rules, V = RD.View, M = RD.Menus, A = RD.Audio;
  const $ = (id) => document.getElementById(id);
  const P = 'riverboat-dice:', mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(P + k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : d; };
  const set = (k, v) => { mem[k] = v; try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* not saved */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GAMES = {
    hot: { name: 'Hot Dice', blurb: 'Six dice. Keep scoring dice and roll on, or bank before you bust.' },
    yacht: { name: 'Yacht', blurb: 'Five dice, three rolls, twelve boxes to fill on your card.' },
    box: { name: 'Shut the Box', blurb: 'Flip down tiles that add up to your roll. Lowest total wins.' },
    bluff: { name: 'Bluff', blurb: 'Hidden dice under cups. Raise the bid, or call it a lie.' },
  };
  const BOTS = [{ name: "Cap'n Juniper", col: '#8b2f2f', nerve: 0.6 }, { name: 'Miss Marigold', col: '#2f5d8b', nerve: 0.45 }, { name: 'Old Tobias', col: '#5d7a2a', nerve: 0.3 }, { name: 'Lucky Fen', col: '#8b5a2f', nerve: 0.75 }];
  const HUMAN_COLS = ['#b8862b', '#7a3f8b', '#2f8b7a', '#8b2f5d'];
  const FACE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'].map((c) => c && `<span class="pip">${c}</span>`);
  const BOX_NAMES = { ones: 'Ones', twos: 'Twos', threes: 'Threes', fours: 'Fours', fives: 'Fives', sixes: 'Sixes', full: 'Full house', four: 'Four of a kind', little: 'Little straight', big: 'Big straight', choice: 'Choice', yacht: 'Yacht' };

  const G = {
    state: 'title', from: 'title', mode: 'hot', s: null, timers: [], busy: false, muted: false, events: [], padPrev: {}, padDir: null, sel: new Set(),
    seatKinds: get('seats', ['human', 'bot', 'bot', null]),
    opts: Object.assign({ target: 5000, rounds: 3, dice: 5 }, get('opts', {})),
    settings: Object.assign({ sfx: 8, music: 5, pace: 1, reduced: reduce }, get('settings', {})),
    record: get('record', {}),

    init(canvas) {
      this.canvas = canvas;
      M.init((a) => this.act(a));
      this.buildSettings(); this.apply();
      this.bind(canvas);
      V.onLand = () => { if (!this.landT || V.time - this.landT > 0.08) { this.landT = V.time; A.play('land'); } };
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
        { key: 'sfx', label: 'Dice and tokens', type: 'slider', get: () => s.sfx, set: ch('sfx') },
        { key: 'music', label: 'Banjo band', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'pace', label: 'Opponents', note: 'How long the computer players think', type: 'action', text: () => (s.pace > 1 ? 'Unhurried' : s.pace < 1 ? 'Brisk' : 'Easy-going'), run: () => { s.pace = s.pace > 1 ? 1 : s.pace < 1 ? 1.5 : 0.6; this.apply(); } },
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
      const wide = this.W > 900 && this.mode === 'yacht' && play;
      const portrait = this.H > this.W;
      // the yacht card sits beside the table on wide screens, below on narrow ones
      V.layout(this.W, this.H, play ? 70 : 40, play ? (this.mode === 'yacht' && !wide ? Math.min(this.H * 0.38, 330) + 100 : portrait ? 190 : 150) : 40, wide ? 300 : 0);
      if (play) this.place();
    },

    // ---------- timeline ----------
    after(sec, fn) { this.timers.push({ t: sec * (this.settings.reduced ? 0.4 : 1), fn }); },
    botWait(sec) { return sec * this.settings.pace; },

    // ---------- screens ----------
    showTitle() {
      this.state = 'title'; this.clear();
      const wins = Object.values(this.record).reduce((a, b) => a + b, 0);
      $('t-wins').textContent = wins ? `${wins} game${wins === 1 ? '' : 's'} won aboard` : 'All aboard for a game of dice';
      $('hud').classList.add('off');
      // a few dice tumbling on the empty table behind the menu
      V.cups = []; V.box = null;
      V.throw([6, 5, 1], [[5, 5], [8, 6.2], [11, 4.8]], [8, 10]);
      this.layout();
      M.show('title');
    },
    showPick() {
      this.state = 'pick';
      $('games').innerHTML = Object.entries(GAMES).map(([k, g]) => `<button class="plate" data-nav data-act="game-${k}"><b>${g.name}</b><small>${g.blurb}</small>${this.record[k] ? `<i>${this.record[k]} won</i>` : ''}</button>`).join('');
      M.show('pick', true);
    },
    showSetup(mode) {
      this.mode = mode; this.state = 'setup';
      $('setup-title').textContent = GAMES[mode].name;
      this.paintSetup();
      M.show('setup', true);
    },
    paintSetup() {
      const mode = this.mode, k = this.seatKinds;
      if (mode === 'bluff') for (let i = 1; i < 4; i++) if (k[i] === 'human') k[i] = 'bot';
      if (k.filter(Boolean).length < 2) k[1] = 'bot';
      $('seats').innerHTML = [0, 1, 2, 3].map((i) => {
        const kind = i === 0 ? 'human' : k[i];
        const label = i === 0 ? 'You' : kind === 'bot' ? BOTS[i].name : kind === 'human' ? `Player ${i + 1}` : 'Empty seat';
        const sub = i === 0 ? 'Seat by the window' : kind === 'bot' ? 'Computer player' : kind === 'human' ? 'Pass the dice' : 'Tap to fill';
        return `<button class="seat ${kind ? '' : 'empty'}" data-nav data-act="seat-${i}" ${i === 0 ? 'disabled' : ''} style="--c:${kind === 'bot' ? BOTS[i].col : HUMAN_COLS[i]}"><i></i><span><b>${label}</b><small>${sub}</small></span></button>`;
      }).join('');
      const o = this.opts;
      const opt = mode === 'hot' ? ['target', `Play to ${o.target.toLocaleString()}`, 'First past the line, then one last turn each']
        : mode === 'box' ? ['rounds', `${o.rounds} round${o.rounds > 1 ? 's' : ''}`, 'Lowest total after the last round wins']
        : mode === 'bluff' ? ['dice', `${o.dice} dice a cup`, 'Lose them all and you leave the table']
        : null;
      $('setup-opt').innerHTML = opt ? `<button class="seat opt" data-nav data-act="opt-${opt[0]}"><span><b>${opt[1]}</b><small>${opt[2]}</small></span></button>` : '<p class="note">Twelve rounds. Highest card total wins.</p>';
      set('seats', k); set('opts', o);
    },
    cycleSeat(i) {
      const order = this.mode === 'bluff' ? ['bot', null] : ['bot', 'human', null];
      const k = this.seatKinds, cur = order.indexOf(k[i]);
      k[i] = order[(cur + 1) % order.length];
      if (k.filter(Boolean).length + 1 < 2) k[i] = 'bot';
      A.play('move'); this.paintSetup();
      const el = document.querySelector(`[data-act="seat-${i}"]`); if (el) M.setFocus(el, true);
    },
    cycleOpt(key) {
      const o = this.opts, list = { target: [3000, 5000, 10000], rounds: [1, 3, 5], dice: [3, 4, 5] }[key];
      o[key] = list[(list.indexOf(o[key]) + 1) % list.length];
      A.play('move'); this.paintSetup();
      const el = document.querySelector(`[data-act="opt-${key}"]`); if (el) M.setFocus(el, true);
    },
    act(a) {
      if (a.startsWith('game-')) { A.unlock(); A.play('confirm'); return this.showSetup(a.slice(5)); }
      if (a.startsWith('seat-')) return this.cycleSeat(+a.slice(5));
      if (a.startsWith('opt-')) return this.cycleOpt(a.slice(4));
      if (a.startsWith('do-')) return this.doAction(a.slice(3));
      if (a.startsWith('box-')) return this.yachtChoose(a.slice(4));
      switch (a) {
        case 'play': A.unlock(); A.play('confirm'); return this.showPick();
        case 'start': return this.start();
        case 'how': this.from = this.state === 'paused' ? 'pause' : M.current ? M.current.id.slice(2) : 'title'; A.play('confirm'); return M.show('how', true);
        case 'settings': this.from = this.state === 'paused' ? 'pause' : 'title'; this.buildSettings(); A.play('confirm'); return M.show('settings', true);
        case 'back': A.play('back');
          if (this.state === 'setup') return this.showPick();
          if (this.state === 'pick' || this.from === 'title') return this.showTitle();
          return M.show(this.from, true);
        case 'pause': return this.pause();
        case 'resume': return this.resume();
        case 'restart': return this.start();
        case 'quit': A.play('back'); return this.quit();
      }
    },
    quit() { M.fade(true); setTimeout(() => { this.clear(); this.showPick(); this.layout(); M.fade(false); }, this.settings.reduced ? 0 : 300); },
    pause() { if (this.state !== 'play') return; this.state = 'paused'; A.play('back'); $('hud').classList.add('off'); M.show('pause', true); },
    resume() { if (this.state !== 'paused') return; this.state = 'play'; A.play('confirm'); $('hud').classList.remove('off'); M.show(null); M.current = $('hud'); },
    clear() { this.timers = []; V.dice = []; V.cups = []; V.box = null; this.sel.clear(); $('bubbles').innerHTML = ''; $('ycard').innerHTML = ''; },

    // ---------- starting a game ----------
    start() {
      A.unlock(); A.play('whistle');
      M.fade(true);
      setTimeout(() => {
        this.clear();
        const seats = [];
        [0, 1, 2, 3].forEach((i) => {
          const kind = i === 0 ? 'human' : this.seatKinds[i];
          if (!kind) return;
          seats.push(kind === 'bot' ? { kind, name: BOTS[i].name, col: BOTS[i].col, nerve: BOTS[i].nerve, bold: i % 2 === 1 } : { kind, name: i === 0 ? 'You' : `Player ${i + 1}`, col: HUMAN_COLS[i] });
        });
        this.seats = seats;
        this.hotseat = seats.filter((p) => p.kind === 'human').length > 1;
        const o = { players: seats.map((p) => p.name) };
        const m = this.mode;
        this.s = m === 'hot' ? R.hotCreate(Object.assign(o, { target: this.opts.target })) : m === 'yacht' ? R.yachtCreate(o) : m === 'box' ? R.boxCreate(Object.assign(o, { rounds: this.opts.rounds })) : R.bluffCreate(Object.assign(o, { dice: this.opts.dice }));
        this.state = 'play';
        document.body.dataset.mode = m;
        $('hud').classList.remove('off');
        $('h-game').textContent = GAMES[m].name;
        M.show(null); M.current = $('hud'); M.fade(false);
        this.layout();
        if (m === 'box') V.box = { open: 511, sel: 0, flip: Array(9).fill(0) };
        if (m === 'bluff') this.bluffSetupCups();
        this.board();
        this.turnStart();
      }, this.settings.reduced ? 0 : 300);
    },
    me() { return this.seats[this.s.turn]; },
    mine() { return this.me().kind === 'human'; },
    say(text) { $('say').innerHTML = text; },
    buttons(list) {
      $('acts').innerHTML = list.map((b) => `<button class="plate ${b.hot ? 'hot' : ''}" data-nav data-act="do-${b.act}" ${b.off ? 'disabled' : ''}><b>${b.text}</b>${b.sub ? `<small>${b.sub}</small>` : ''}</button>`).join('');
      const first = $('acts').querySelector('[data-nav]:not([disabled])');
      if (first && (document.body.dataset.device === 'keyboard' || document.body.dataset.device === 'gamepad')) M.setFocus(first, true);
    },
    // where the dice rest on the felt
    spots(n, cu, cv, spread) { const out = []; for (let i = 0; i < n; i++) out.push([cu + (i - (n - 1) / 2) * (spread || 1.5) + (Math.random() - 0.5) * 0.3, cv + (Math.random() - 0.5) * 0.8]); return out; },
    place() {
      // keep HTML speech bubbles over their seats
      if (this.mode === 'bluff' && this.s) this.seats.forEach((_, i) => { const el = document.getElementById('bub-' + i); if (!el) return; const [u, v] = V.seatPos(i, this.seats.length), p = V.P(u, v, 2.4); el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px'; });
    },
    turnStart() {
      if (this.s.over) return this.finish();
      const p = this.me();
      this.board();
      if (this.hotseat && this.mine()) M.toast(`${p.name}'s turn`);
      ({ hot: () => this.hotTurn(), yacht: () => this.yachtTurn(), box: () => this.boxTurn(), bluff: () => this.bluffTurn() })[this.mode]();
    },
    doAction(a) {
      if (this.state !== 'play') return;
      const m = this.mode;
      if (m === 'hot') this.hotAct(a); else if (m === 'yacht') this.yachtAct(a); else if (m === 'box') this.boxAct(a); else this.bluffAct(a);
    },

    // ---------- HOT DICE ----------
    hotTurn() {
      const s = this.s, p = this.me();
      V.dice = []; this.sel.clear();
      this.say(`<b>${p.name}</b> · ${s.scores[s.turn].toLocaleString()} banked${s.lastRound >= 0 ? ' · <em>last round!</em>' : ''}`);
      if (this.mine()) this.buttons([{ act: 'roll', text: 'Roll six dice', hot: true }]);
      else { this.buttons([]); this.after(this.botWait(0.8), () => this.hotRoll()); }
    },
    hotRoll() {
      const s = this.s;
      this.buttons([]); this.sel.clear();
      A.play('shake');
      const r = R.hotRoll(s);
      const seat = this.mine() ? [8, 10.5] : [8, -0.5];
      V.throw(s.dice, this.spots(s.dice.length, 8, 5.2, 1.6), seat, { keep: (d) => d.kept, ids: s.dice.map((_, i) => i) });
      this.after(1.0, () => {
        if (r.bust) {
          A.play('bust'); V.shake = 0.6;
          this.say(`<b>Bust!</b> ${s.turnScore ? `${s.turnScore.toLocaleString()} lost` : 'Nothing scores'}`);
          for (const d of V.dice) if (!d.kept) d.dim = true;
          this.after(1.6, () => { R.hotEndTurn(s, false); this.turnStart(); });
          return;
        }
        if (this.mine()) { this.say(`Turn: <b>${s.turnScore.toLocaleString()}</b> · tap the scoring dice to keep`); this.hotButtons(); }
        else this.after(this.botWait(0.7), () => this.hotBot());
      });
    },
    hotSelScore() { return R.hotScore([...this.sel].map((i) => this.s.dice[i])); },
    hotButtons() {
      const s = this.s, sc = this.hotSelScore(), n = this.sel.size, left = s.left - n === 0 ? 6 : s.left - n;
      for (const d of V.dice) if (!d.kept) d.sel = this.sel.has(d.id);
      this.buttons([
        { act: 'keep-roll', text: n ? `Keep ${n} · roll ${left}` : 'Pick scoring dice', sub: sc ? `+${sc}` : n ? 'Not all of those score' : '', off: !sc, hot: true },
        { act: 'keep-bank', text: 'Keep and bank', sub: sc ? `${(s.turnScore + sc).toLocaleString()} this turn` : '', off: !sc },
      ]);
    },
    hotAct(a) {
      const s = this.s;
      if (a === 'roll' && s.phase === 'roll' && this.mine()) return this.hotRoll();
      if ((a === 'keep-roll' || a === 'keep-bank') && s.phase === 'choose' && this.mine()) {
        const idx = [...this.sel]; if (!this.hotSelScore()) return A.play('deny');
        this.hotKeep(idx, a === 'keep-bank');
      }
    },
    hotKeep(idx, bank) {
      const s = this.s, before = s.kept.reduce((n, k) => n + k.length, 0);
      const res = R.hotKeep(s, idx);
      // kept dice line up along the near rail
      let n = before;
      for (const d of V.dice) if (!d.kept && idx.includes(d.id)) { d.kept = true; d.sel = false; V.move(d, 2.2 + (n % 12) * 1.05, this.mine() ? 8.6 : 1.3); n++; }
      for (const d of V.dice) if (!d.kept) d.dim = true;
      A.play('chip', Math.round(res.score / 100));
      this.sel.clear();
      if (res.hot) { A.play('hot'); M.toast('Hot dice! All six again'); this.after(0.5, () => { V.dice = []; }); }
      this.say(`Turn: <b>${s.turnScore.toLocaleString()}</b> · ${s.left} dice to roll`);
      if (bank) { this.after(0.5, () => this.hotBank()); return; }
      if (this.mine()) this.after(0.35, () => this.hotRoll());
    },
    hotBank() {
      const s = this.s, p = s.turn, got = s.turnScore;
      R.hotEndTurn(s, true);
      A.play('chip', Math.round(got / 100));
      M.toast(`${this.seats[p].name} bank${this.seats[p].kind === 'human' && p === 0 ? '' : 's'} ${got.toLocaleString()}`);
      this.after(0.9, () => this.turnStart());
    },
    hotBot() {
      const s = this.s, bot = this.me();
      const idx = R.hotBotKeep(s, bot.bold);
      for (const d of V.dice) if (idx.includes(d.id)) d.sel = true;
      A.play('pick');
      this.after(this.botWait(0.6), () => {
        const res = R.hotKeep(s, idx);
        let n = s.kept.reduce((a, k) => a + k.length, 0) - idx.length;
        for (const d of V.dice) if (!d.kept && idx.includes(d.id)) { d.kept = true; d.sel = false; V.move(d, 2.2 + (n % 12) * 1.05, 1.3); n++; }
        for (const d of V.dice) if (!d.kept) d.dim = true;
        A.play('chip', Math.round(res.score / 100));
        if (res.hot) { A.play('hot'); M.toast(`Hot dice for ${bot.name}!`); this.after(0.5, () => { V.dice = []; }); }
        this.say(`<b>${bot.name}</b> · turn: <b>${s.turnScore.toLocaleString()}</b> · ${s.left} dice left`);
        this.after(this.botWait(0.7), () => { if (R.hotBotBank(s, bot.bold)) this.hotBank(); else this.hotRoll(); });
      });
    },

    // ---------- YACHT ----------
    yachtTurn() {
      const p = this.me();
      V.dice = []; this.yachtCard();
      this.say(`<b>${p.name}</b> · round ${this.s.round} of 12`);
      if (this.mine()) this.buttons([{ act: 'roll', text: 'Roll five dice', hot: true }]);
      else { this.buttons([]); this.after(this.botWait(0.8), () => this.yachtRoll()); }
    },
    yachtRoll() {
      const s = this.s;
      if (!R.yachtRoll(s)) return;
      A.play('shake');
      const free = [0, 1, 2, 3, 4].filter((i) => !s.held[i]);
      const seat = this.mine() ? [8, 10.5] : [8, -0.5];
      const spots = this.spots(free.length, 8, 4.6, 1.7);
      V.throw(free.map((i) => s.dice[i]), spots, seat, { keep: (d) => s.held[d.id], ids: free });
      this.buttons([]);
      this.after(1.0, () => {
        this.yachtCard();
        if (this.mine()) this.yachtButtons();
        else this.after(this.botWait(0.8), () => this.yachtBot());
      });
    },
    yachtButtons() {
      const s = this.s;
      for (const d of V.dice) d.held = s.held[d.id];
      this.say(s.rolls < 3 ? `Roll ${s.rolls} of 3 · tap dice to hold them, or score a box on your card` : 'Pick a box on your card to score');
      this.buttons(s.rolls < 3 ? [{ act: 'roll', text: `Roll again`, sub: `${3 - s.rolls} left`, hot: true }] : []);
    },
    yachtHoldToggle(i) {
      const s = this.s; if (!this.mine() || s.rolls === 0 || s.rolls >= 3 || V.rolling()) return;
      s.held[i] = !s.held[i];
      this.yachtArrange(); A.play('hold');
      this.yachtButtons();
    },
    // held dice slide to the near rail; the rest wait in the middle
    yachtArrange() {
      const s = this.s, near = this.mine() ? 8.4 : 1.6;
      let h = 0;
      const nh = s.held.filter(Boolean).length;
      for (const d of V.dice.slice().sort((a, b) => a.id - b.id)) {
        d.held = s.held[d.id];
        if (d.held) { V.move(d, 8 + (h - (nh - 1) / 2) * 1.3, near); h++; }
        else if (Math.abs(d.v - near) < 0.5) V.move(d, 8 + (d.id - 2) * 1.6, 4.6);
      }
    },
    yachtAct(a) { if (a === 'roll' && this.mine() && this.s.rolls < 3 && !V.rolling()) this.yachtRoll(); },
    yachtChoose(box) {
      const s = this.s;
      if (this.state !== 'play' || !this.mine() || s.rolls === 0 || V.rolling() || box in s.cards[s.turn]) return;
      this.yachtScore(box);
    },
    yachtScore(box) {
      const s = this.s, p = this.me(), v = R.yachtPick(s, box);
      A.play(v ? 'chip' : 'deny', Math.round(v / 6));
      M.toast(`${p.name}: ${BOX_NAMES[box]} for ${v}`);
      this.yachtCard(box);
      this.buttons([]);
      this.after(1.1, () => this.turnStart());
    },
    yachtBot() {
      const s = this.s;
      if (s.rolls < 3) {
        const hold = R.yachtBotHold(s);
        // stop early if the best box is already great
        const box = R.yachtBotBox(s), now = R.yachtScore(box, s.dice);
        if ((box === 'yacht' && now) || ((box === 'big' || box === 'little') && now) || (box === 'full' && now)) return this.after(this.botWait(0.6), () => this.yachtScore(box));
        s.held = hold; this.yachtArrange(); A.play('hold');
        this.after(this.botWait(0.7), () => this.yachtRoll());
      } else this.after(this.botWait(0.5), () => this.yachtScore(R.yachtBotBox(s)));
    },
    yachtCard(just) {
      const s = this.s, cur = s.turn, mine = this.mine() && s.rolls > 0;
      const head = `<tr><th></th>${this.seats.map((p, i) => `<th class="${i === cur ? 'cur' : ''}" style="--c:${p.col}">${p.name === 'You' ? 'You' : p.name.split(' ').pop()}</th>`).join('')}</tr>`;
      const rows = R.BOXES.map((b, bi) => `<tr class="${bi === 6 ? 'gap' : ''}"><td>${BOX_NAMES[b]}</td>${this.seats.map((_, i) => {
        const card = s.cards[i];
        if (b in card) return `<td class="${just === b && i === (cur + this.seats.length - 1) % this.seats.length ? 'just' : ''}">${card[b]}</td>`;
        if (i === cur && s.rolls > 0) { const v = R.yachtScore(b, s.dice); return mine ? `<td><button class="cell" data-nav data-act="box-${b}">${v}</button></td>` : `<td class="maybe">${v}</td>`; }
        return '<td></td>';
      }).join('')}</tr>`).join('');
      const tot = `<tr class="tot"><td>Total</td>${s.cards.map((c) => `<td>${R.yachtTotal(c)}</td>`).join('')}</tr>`;
      $('ycard').innerHTML = `<table>${head}${rows}${tot}</table>`;
    },

    // ---------- SHUT THE BOX ----------
    boxTurn() {
      const s = this.s, p = this.me();
      V.dice = []; V.box.open = s.open; V.box.sel = 0;
      this.say(`<b>${p.name}</b> · round ${s.round} of ${s.rounds} · shut every tile you can`);
      if (this.mine()) this.boxButtons();
      else { this.buttons([]); this.after(this.botWait(0.8), () => this.boxRoll(R.boxBotOneDie(s))); }
    },
    boxButtons() {
      const s = this.s, one = R.oneDieAllowed(s.open);
      this.buttons([{ act: 'roll2', text: 'Roll two dice', hot: true }].concat(one ? [{ act: 'roll1', text: 'Roll one die', sub: 'Allowed below seven' }] : []));
    },
    boxRoll(one) {
      const s = this.s;
      const r = R.boxRoll(s, one);
      if (r === false) return;
      A.play('shake'); this.buttons([]);
      const seat = this.mine() ? [8, 10.5] : [8, -0.5];
      V.throw(s.roll, this.spots(s.roll.length, 8, 7.4, 1.8), seat);
      const n = R.sum(s.roll);
      this.after(1.0, () => {
        if (r.stuck) {
          A.play('bust');
          this.say(`No way to make <b>${n}</b>. ${this.me().name} score${this.s.turn === 0 && !this.hotseat ? '' : 's'} <b>${R.tilesSum(s.open)}</b>`);
          this.after(1.8, () => this.boxEnd());
          return;
        }
        if (this.mine()) this.say(`Rolled <b>${n}</b> · tap tiles that add up to ${n}`);
        else this.after(this.botWait(0.6), () => this.boxBot());
      });
    },
    boxTap(i) {
      const s = this.s;
      if (!this.mine() || s.phase !== 'flip' || !(s.open & (1 << i)) || V.rolling()) return;
      V.box.sel ^= 1 << i; A.play('pick');
      const n = R.sum(s.roll), got = R.tilesSum(V.box.sel);
      if (got === n) this.boxFlip(V.box.sel);
      else if (got > n) { A.play('deny'); M.toast(`That's ${got}, more than ${n}`); V.box.sel = 0; }
      else this.say(`Rolled <b>${n}</b> · ${got} so far`);
    },
    boxFlip(mask) {
      const s = this.s, r = R.boxFlip(s, mask);
      if (!r) return;
      V.box.sel = 0; V.box.open = s.open;
      A.play('flip');
      if (r.shut) {
        A.play('win'); M.toast('Shut the box!');
        const p = V.P(8, 2.5, 1.5); V.sparkle(p[0], p[1], '#ffd76a', 40);
        this.after(1.6, () => this.boxEnd());
        return;
      }
      this.after(0.5, () => { if (this.mine()) { this.say(`Open tiles add up to <b>${R.tilesSum(s.open)}</b> · roll again`); this.boxButtons(); } else this.after(this.botWait(0.5), () => this.boxRoll(R.boxBotOneDie(s))); });
    },
    boxBot() {
      const s = this.s, mask = R.boxBotFlip(s, this.me().bold);
      V.box.sel = mask; A.play('pick');
      this.after(this.botWait(0.6), () => this.boxFlip(mask));
    },
    boxAct(a) { if (this.mine() && this.s.phase === 'roll' && !V.rolling()) { if (a === 'roll2') this.boxRoll(false); if (a === 'roll1') this.boxRoll(true); } },
    boxEnd() {
      R.boxEndTurn(this.s);
      V.box.open = 511; V.box.sel = 0;
      this.turnStart();
    },

    // ---------- BLUFF ----------
    bluffSetupCups() {
      const n = this.seats.length;
      V.cups = this.seats.map((p, i) => { const [u, v] = V.seatPos(i, n); return { u, v: i === 0 ? v - 1.2 : v, lift: 0, up: false, col: p.col, seat: i }; });
      $('bubbles').innerHTML = this.seats.map((p, i) => `<div class="bubble" id="bub-${i}" style="--c:${p.col}"><b>${p.name === 'You' ? 'You' : p.name}</b><span id="bubt-${i}"></span></div>`).join('');
      this.place();
      this.bluffDeal();
    },
    // show your own dice in front of you; everyone else's stay under their cups
    bluffDeal() {
      const s = this.s, n = this.seats.length;
      V.dice = [];
      for (const c of V.cups) c.up = false;
      A.play('shake');
      const mine = s.cups[0];
      if (s.counts[0] > 0) V.throw(mine, mine.map((_, i) => [8 + (i - (mine.length - 1) / 2) * 1.25, 8.9]), [8, 10.5]);
      V.cups.forEach((c) => { c.out = s.counts[c.seat] === 0; });
      V.cups = V.cups.filter((c) => !c.out);
      this.seats.forEach((_, i) => { const t = $('bubt-' + i); if (t) t.textContent = s.counts[i] ? `${s.counts[i]} dice` : 'out'; });
      this.qBid = null;
    },
    bluffTurn() {
      const s = this.s, p = this.me();
      this.seats.forEach((_, i) => { const el = $('bub-' + i); if (el) el.classList.toggle('cur', i === s.turn); });
      if (this.mine()) {
        const b = s.bid;
        this.qBid = this.qBid || (b ? { q: b.f < 6 ? b.q : b.q + 1, f: b.f < 6 ? b.f + 1 : 2 } : { q: Math.max(1, Math.round(R.bluffDiceTotal(s) / 4)), f: 2 });
        this.bluffButtons();
      } else { this.buttons([]); this.say(`<b>${p.name}</b> is thinking…`); this.after(this.botWait(0.9 + Math.random() * 0.8), () => this.bluffBotMove()); }
    },
    bluffButtons() {
      const s = this.s, b = this.qBid, ok = R.bluffValid(s, b.q, b.f);
      this.say(s.bid ? `Bid on the table: <b>${s.bid.q} × ${FACE[s.bid.f]}</b> by ${this.seats[s.bidder].name} · ones are wild` : 'You open the bidding · ones are wild');
      $('acts').innerHTML = `<div class="bidder"><button class="plate small" data-nav data-act="do-q-">−</button><b class="q">${b.q} ×</b><button class="plate small" data-nav data-act="do-q+">+</button>
        <span class="faces">${[2, 3, 4, 5, 6].map((f) => `<button class="face ${f === b.f ? 'on' : ''}" data-nav data-act="do-f${f}">${FACE[f]}</button>`).join('')}</span></div>
        <div class="row"><button class="plate hot" data-nav data-act="do-bid" ${ok ? '' : 'disabled'}><b>Raise to ${b.q} × ${FACE[b.f]}</b></button>${s.bid ? '<button class="plate liar" data-nav data-act="do-liar"><b>Liar!</b></button>' : ''}</div>`;
    },
    bluffAct(a) {
      const s = this.s; if (!this.mine() || s.phase !== 'bid') return;
      const b = this.qBid;
      if (a === 'q-') b.q = Math.max(1, b.q - 1);
      else if (a === 'q+') b.q = Math.min(R.bluffDiceTotal(s), b.q + 1);
      else if (a[0] === 'f' && a.length === 2) b.f = +a[1];
      else if (a === 'bid') { if (!R.bluffValid(s, b.q, b.f)) return A.play('deny'); return this.bluffBid(b.q, b.f); }
      else if (a === 'liar') return this.bluffCall();
      A.play('move'); this.bluffButtons();
      const el = document.querySelector(`[data-act="do-${a}"]`); if (el) M.setFocus(el, true);
    },
    bluffBid(q, f) {
      const s = this.s, who = s.turn;
      R.bluffBid(s, q, f); A.play('bid');
      const t = $('bubt-' + who); if (t) t.innerHTML = `<em>${q} × ${FACE[f]}</em>`;
      this.qBid = null;
      this.after(0.4, () => this.turnStart());
    },
    bluffBotMove() {
      const s = this.s, m = R.bluffBot(s, this.me().nerve);
      if (m.call) this.bluffCall(); else this.bluffBid(m.q, m.f);
    },
    bluffCall() {
      const s = this.s, caller = s.turn;
      const t = $('bubt-' + caller); if (t) t.innerHTML = '<em class="liar">Liar!</em>';
      A.play('call'); this.buttons([]);
      const bid = s.bid, res = R.bluffCall(s);
      // lift every cup and lay out the dice in front of it
      this.after(0.6, () => {
        A.play('cup');
        for (const c of V.cups) c.up = true;
        const n = this.seats.length, dice = [];
        this.seats.forEach((_, i) => {
          if (i === 0) return;
          const cup = s.cups[i], [u, v] = V.seatPos(i, n);
          cup.forEach((val, k) => dice.push({ val, u: u + (k - (cup.length - 1) / 2) * 0.95, v: v + 1.3 }));
        });
        V.throw(dice.map((d) => d.val), dice.map((d) => [d.u, d.v]), [8, 5], { keep: (d) => true });
        this.after(0.9, () => {
          for (const d of V.dice) d.glow = d.value === bid.f || d.value === 1;
          const loser = this.seats[res.loser].name;
          this.say(`There ${res.actual === 1 ? 'was' : 'were'} <b>${res.actual} × ${FACE[bid.f]}</b> against a bid of ${bid.q}. <b>${loser}</b> lose${res.loser === 0 ? '' : 's'} a die${res.out ? ' and leaves the table' : ''}.`);
          A.play('lose-die');
          this.after(2.8, () => {
            if (s.over) return this.finish();
            R.bluffNextRound(s);
            this.seats.forEach((_, i) => { const el = $('bubt-' + i); if (el) el.textContent = ''; });
            this.bluffDeal();
            this.after(1.0, () => this.turnStart());
          });
        });
      });
    },

    // ---------- scoreboard and the end ----------
    board() {
      const s = this.s, m = this.mode;
      const val = (i) => m === 'hot' ? s.scores[i].toLocaleString() : m === 'yacht' ? R.yachtTotal(s.cards[i]) : m === 'box' ? s.totals[i] : `${s.counts[i]} ${s.counts[i] === 1 ? 'die' : 'dice'}`;
      const note = m === 'hot' ? `to ${s.target.toLocaleString()}` : m === 'yacht' ? `round ${Math.min(12, s.round)}/12` : m === 'box' ? `round ${Math.min(s.round, s.rounds)}/${s.rounds} · low wins` : 'last cup standing';
      $('chalk').innerHTML = `<small>${note}</small>` + this.seats.map((p, i) => `<div class="${i === s.turn && !s.over ? 'cur' : ''} ${m === 'bluff' && !s.counts[i] ? 'out' : ''}"><i style="--c:${p.col}"></i><span>${p.name}</span><b>${val(i)}</b></div>`).join('');
    },
    finish() {
      if (this.state !== 'play') return;
      const s = this.s, m = this.mode;
      this.state = 'result';
      this.board();
      $('hud').classList.add('off');
      const w = s.winner, you = w === 0 && !this.hotseat;
      if (w === 0) { this.record[m] = (this.record[m] || 0) + 1; set('record', this.record); }
      $('r-kicker').textContent = GAMES[m].name;
      $('r-title').textContent = you ? 'You win the table!' : `${this.seats[w].name} wins!`;
      const val = (i) => m === 'hot' ? s.scores[i].toLocaleString() : m === 'yacht' ? R.yachtTotal(s.cards[i]) : m === 'box' ? s.totals[i] : s.counts[i] ? 'last cup' : 'out';
      const order = this.seats.map((p, i) => i).sort((a, b) => m === 'box' ? s.totals[a] - s.totals[b] : m === 'hot' ? s.scores[b] - s.scores[a] : m === 'yacht' ? R.yachtTotal(s.cards[b]) - R.yachtTotal(s.cards[a]) : (a === w ? -1 : b === w ? 1 : 0));
      $('r-list').innerHTML = order.map((i, k) => `<li style="--c:${this.seats[i].col}"><span>${['1st', '2nd', '3rd', '4th'][k]}</span><b>${this.seats[i].name}</b><em>${val(i)}</em></li>`).join('');
      $('r-note').textContent = this.record[m] ? `Games of ${GAMES[m].name} you've won: ${this.record[m]}` : '';
      A.play(w === 0 || this.hotseat ? 'win' : 'lose');
      M.show('result', true);
    },

    // ---------- input ----------
    bind(canvas) {
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        A.unlock();
        document.body.dataset.device = 'keyboard';
        if (this.state === 'play' && /^Digit[1-9]$/.test(e.code)) { e.preventDefault(); return this.numberKey(+e.code.slice(5)); }
        const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', KeyP: 'pause', KeyM: 'mute' }[e.code];
        if (!k) return;
        e.preventDefault();
        this.events.push(k);
      });
      canvas.addEventListener('pointerdown', (e) => {
        A.unlock();
        document.body.dataset.device = e.pointerType === 'mouse' ? 'mouse' : 'touch';
        if (this.state !== 'play') return;
        if (this.mode === 'box') { const i = V.tileAt(e.clientX, e.clientY); if (i >= 0) return this.boxTap(i); }
        const d = V.dieAt(e.clientX, e.clientY);
        if (d) this.tapDie(d);
      });
      addEventListener('gamepadconnected', () => { document.body.dataset.device = 'gamepad'; });
    },
    tapDie(d) {
      const s = this.s;
      if (this.mode === 'hot' && this.mine() && s.phase === 'choose' && !d.kept && !V.rolling()) {
        if (this.sel.has(d.id)) this.sel.delete(d.id); else this.sel.add(d.id);
        A.play('pick'); this.hotButtons();
      } else if (this.mode === 'yacht') this.yachtHoldToggle(d.id);
    },
    // number keys: pick dice by position (hot, yacht) or tiles by number (box)
    numberKey(n) {
      if (this.mode === 'box') return this.boxTap(n - 1);
      const list = V.dice.filter((d) => !d.kept).sort((a, b) => a.id - b.id);
      if (this.mode === 'yacht') { const d = V.dice.find((x) => x.id === n - 1); if (d) this.tapDie(d); return; }
      if (list[n - 1]) this.tapDie(list[n - 1]);
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
        // in play, the arrow keys move around the action buttons and the card
        if (!M.current) { M.current = document.getElementById('hud'); }
        if (e === 'confirm') M.confirm(); else M.nav(e);
        return;
      }
      const cur = M.current && M.current.id;
      if (e === 'back' || e === 'pause') { if (cur === 's-pause') this.resume(); else if (cur === 's-settings' || cur === 's-how' || cur === 's-pick' || cur === 's-setup') this.act('back'); else if (cur === 's-result') this.act('quit'); return; }
      if (e === 'confirm') M.confirm();
      else if (['left', 'right', 'up', 'down'].includes(e)) M.nav(e);
    },

    // ---------- time ----------
    update(dt) {
      this.pollPad();
      for (const e of this.events.splice(0)) this.handle(e);
      V.tick(dt);
      A.update(this.state === 'play');
      if (this.state === 'paused') return;
      if (this.state === 'title' && !V.rolling() && Math.random() < dt * 0.25) {
        const n = 2 + ((Math.random() * 3) | 0);
        A.play('land');
        V.throw(Array.from({ length: n }, () => R.d6(Math.random)), this.spots(n, 8, 5 + Math.random(), 2.2), [Math.random() * 16, 10.5]);
      }
      const due = [];
      for (const t of this.timers) { t.t -= dt; if (t.t <= 0) due.push(t); }
      if (due.length) { this.timers = this.timers.filter((t) => t.t > 0); for (const t of due) t.fn(); }
    },
    render(ctx) {
      const labels = this.state === 'play' && this.mode === 'hot' ? [{ u: 8, v: this.mine() ? 9.6 : 0.4, text: 'kept' }] : null;
      V.draw(ctx, { labels });
    },
  };
  RD.Game = G;
})();
