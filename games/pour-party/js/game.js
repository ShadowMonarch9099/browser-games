// Pour Party flow: title (with a demo counter pouring itself behind it),
// level select, settings, how to play, play, pause and results.
(function () {
  const R = window.PourParty.Rules;
  const { Save, Audio: A, Input, UI, Board, Scene } = PP;
  const $ = (s) => document.querySelector(s);

  const DEMO_LEVELS = [5, 7, 4, 9, 6, 8];

  const Game = {
    state: 'title',
    stack: [],
    settings: Save.settings(),
    level: Save.level(),
    board: null,
    demo: null,
    demoIdx: 0,
    demoWait: 1.2,
    time: 0,
    shake: 0,
    hints: 0,
    par: 0,
    wonT: -1,
    page: 0,
    confirmReset: false,
    drag: null,

    init() {
      A.setVolumes(this.settings.sfx, this.settings.music);
      document.body.classList.toggle('reduced', this.settings.reduced);
      UI.init((a, arg, el) => this.action(a, arg, el));
      UI.renderKeys();
      Input.init((a, arg) => this.input(a, arg));
      Input.refreshGlyphs();
      Input.onDevice = () => this.paintHud();
      this.buildSettings();
      this.makeDemo();
      this.bindPointer();
      this.goTitle(true);
    },

    // ---------- screens ----------
    show(state, opts = {}) {
      this.state = state;
      const playing = state === 'play';
      $('#hud').classList.toggle('off', !playing);
      A.mood = this.board && this.inPlayWorld() ? 'play' : 'menu';
      const id = { title: 'title', levels: 'levels', settings: 'settings', how: 'how', pause: 'pause', won: 'won' }[state];
      UI.show(id || null, { dim: this.inPlayWorld() && state !== 'play', focus: opts.focus });
    },
    // Screens drawn over the live counter rather than the demo.
    inPlayWorld() {
      if (this.state === 'play' || this.state === 'pause' || this.state === 'won') return true;
      const base = this.stack.length ? this.stack[0] : null;
      return base === 'pause' || base === 'won';
    },
    open(state) { this.stack.push(this.state); this.show(state); },
    close() {
      const prev = this.stack.pop() || 'title';
      this.show(prev, { focus: prev === 'pause' ? '[data-action="resume"]' : null });
      if (prev === 'title') this.paintTitle();
    },

    goTitle(first) {
      this.stack = [];
      this.board = null;
      this.paintTitle();
      if (first) { this.show('title'); this.layout(); }
      else this.transition(() => { this.show('title'); this.layout(); });
    },
    paintTitle() {
      const lv = Save.level();
      $('#continue-sub').textContent = lv > 1 ? `Level ${lv}` : 'Level 1';
      $('#btn-continue span').textContent = lv > 1 ? 'Continue' : 'Play';
      $('#stars-sub').textContent = `${Save.totalStars()} ★`;
    },

    transition(fn) {
      if (this.settings.reduced) { fn(); return; }
      UI.fade(true);
      setTimeout(() => { fn(); UI.fade(false); }, 300);
    },

    openLevels() {
      this.page = Math.floor((Math.max(1, Math.min(Save.unlocked(), this.level)) - 1) / 20);
      this.paintLevels();
      this.open('levels');
    },
    paintLevels() {
      UI.renderLevels(this.page, { best: Save.best(), unlocked: Save.unlocked(), total: Save.totalStars(), current: Save.level() });
    },

    // ---------- settings ----------
    buildSettings() {
      const s = this.settings;
      const store = () => { Save.storeSettings(s); UI.paintSettings(s); };
      const slider = (key, label) => ({ key, label, type: 'slider', get: () => s[key], set: (v) => { s[key] = v; A.setVolumes(s.sfx, s.music); store(); A.play('tick'); } });
      const toggle = (key, label, note, after) => ({ key, label, note, type: 'toggle', get: () => s[key], set: (v) => { s[key] = v; store(); A.play('tick'); if (after) after(v); } });
      const defs = [
        slider('sfx', 'Sound effects'),
        slider('music', 'Music'),
        toggle('symbols', 'Flavour symbols', 'a shape on every colour'),
        toggle('guides', 'Pour guides & tips', 'glow where a pour fits'),
        toggle('shake', 'Screen shake'),
        toggle('reduced', 'Reduced motion', 'quick pours, no swinging', (v) => document.body.classList.toggle('reduced', v)),
      ];
      const doc = document.documentElement;
      if (doc.requestFullscreen || doc.webkitRequestFullscreen) {
        defs.push({ key: 'fullscreen', label: 'Fullscreen', type: 'toggle', get: () => !!(document.fullscreenElement || document.webkitFullscreenElement), set: () => this.toggleFullscreen() });
      }
      defs.push({
        key: 'reset', label: 'Reset progress', type: 'action', danger: true,
        labelFn: () => (this.confirmReset ? 'Press again to wipe all stars' : 'Reset progress'),
        text: () => '',
        run: () => {
          if (!this.confirmReset) { this.confirmReset = true; UI.paintSettings(s); A.play('deny'); return; }
          Save.reset();
          this.level = 1;
          this.confirmReset = false;
          UI.paintSettings(s);
          UI.toast('Progress wiped. Fresh start!');
          A.play('restart');
        },
      });
      UI.renderSettings(defs, s);
    },
    toggleFullscreen() {
      const doc = document.documentElement;
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else (doc.requestFullscreen || doc.webkitRequestFullscreen).call(doc);
      } catch (e) { /* refused */ }
      setTimeout(() => UI.paintSettings(this.settings), 300);
    },
    applyBoardSettings() {
      const s = this.settings;
      for (const b of [this.board, this.demo]) if (b) b.settings = { symbols: s.symbols, guides: s.guides, reduced: s.reduced };
    },

    // ---------- actions from buttons ----------
    action(a, arg) {
      switch (a) {
        case 'continue': A.play('confirm'); this.startLevel(Save.level()); break;
        case 'levels': A.play('confirm'); this.openLevels(); break;
        case 'settings': A.play('confirm'); this.confirmReset = false; this.buildSettings(); this.open('settings'); break;
        case 'how': A.play('confirm'); this.open('how'); break;
        case 'back': A.play('back'); this.close(); break;
        case 'page-prev': if (this.page > 0) { this.page--; A.play('page'); this.paintLevels(); UI.show('levels'); } break;
        case 'page-next': this.page++; A.play('page'); this.paintLevels(); UI.show('levels'); break;
        case 'play-level': A.play('confirm'); this.startLevel(arg); break;
        case 'pause': this.pause(); break;
        case 'resume': A.play('back'); this.resume(); break;
        case 'restart-menu': this.stack = []; this.startLevel(this.level, true); break;
        case 'quit': A.play('back'); this.goTitle(); break;
        case 'undo': this.undo(); break;
        case 'hint': this.hint(); break;
        case 'restart': this.restart(); break;
        case 'next': A.play('confirm'); this.startLevel(this.level + 1); break;
        case 'replay': A.play('confirm'); this.startLevel(this.level); break;
      }
    },

    // ---------- input ----------
    input(a, arg) {
      if (a === 'mute') {
        const off = this.settings.music + this.settings.sfx > 0;
        if (off) { this.muteMemo = [this.settings.sfx, this.settings.music]; this.settings.sfx = 0; this.settings.music = 0; }
        else [this.settings.sfx, this.settings.music] = this.muteMemo || [8, 6];
        A.setVolumes(this.settings.sfx, this.settings.music);
        Save.storeSettings(this.settings);
        UI.paintSettings(this.settings);
        UI.toast(off ? 'Sound off' : 'Sound on');
        return;
      }
      if (this.state !== 'play') {
        if (this.state === 'pause' && a === 'pause') { this.resume(); return; }
        if (this.state === 'won' && this.wonT >= 0) return; // results not shown yet
        if (a === 'up' || a === 'down' || a === 'left' || a === 'right') UI.nav(a);
        else if (a === 'confirm') UI.confirm();
        else if (a === 'back' || a === 'pause') { if (UI.back()) A.play('back'); }
        return;
      }
      const b = this.board;
      if (!b || b.solved) return;
      switch (a) {
        case 'left': case 'right': case 'up': case 'down': this.moveCursor(a); break;
        case 'confirm':
          if (!this.cursorOn) { this.cursorOn = true; A.play('move'); break; }
          b.tap(b.cursor);
          break;
        case 'glass': if (arg < b.tubes.length) { b.cursor = arg; b.tap(arg); } break;
        case 'back': if (b.sel !== null) { b.sel = null; A.play('drop'); } else this.pause(); break;
        case 'pause': this.pause(); break;
        case 'undo': this.undo(); break;
        case 'hint': this.hint(); break;
        case 'restart': this.restart(); break;
      }
    },
    moveCursor(dir) {
      const b = this.board;
      this.cursorOn = true;
      const n = b.tubes.length;
      if (dir === 'left') b.cursor = (b.cursor + n - 1) % n;
      else if (dir === 'right') b.cursor = (b.cursor + 1) % n;
      else if (b.L.rows > 1) {
        const r = b.rects[b.cursor];
        const want = dir === 'up' ? r.row - 1 : r.row + 1;
        let best = -1;
        let bd = Infinity;
        b.rects.forEach((q, i) => { if (q.row === want && Math.abs(q.cx - r.cx) < bd) { bd = Math.abs(q.cx - r.cx); best = i; } });
        if (best >= 0) b.cursor = best;
      }
      A.play('move');
    },

    bindPointer() {
      const cv = $('#game');
      const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      cv.addEventListener('pointerdown', (e) => {
        if (this.state !== 'play' || !this.board || this.board.solved) return;
        this.cursorOn = false;
        const p = pos(e);
        const b = this.board;
        const i = b.hit(p.x, p.y);
        if (i < 0) { if (b.sel !== null) { b.sel = null; A.play('drop'); } return; }
        b.cursor = i;
        const before = b.sel;
        const res = b.tap(i);
        this.drag = before === null && res === 'lift' ? { from: i, id: e.pointerId } : null;
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
      });
      cv.addEventListener('pointermove', (e) => {
        if (!this.board || this.state !== 'play') return;
        const p = pos(e);
        this.board.hover = e.pointerType === 'mouse' || this.drag ? this.board.hit(p.x, p.y) : -1;
      });
      const up = (e) => {
        const d = this.drag;
        this.drag = null;
        if (!d || !this.board || this.state !== 'play') return;
        const p = pos(e);
        const i = this.board.hit(p.x, p.y);
        if (i >= 0 && i !== d.from && this.board.sel === d.from) this.board.tap(i);
        if (e.pointerType !== 'mouse') this.board.hover = -1;
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', () => { this.drag = null; });
      cv.addEventListener('pointerleave', () => { if (this.board) this.board.hover = -1; });
    },

    // ---------- play ----------
    boardEvents(live) {
      if (!live) return {};
      return {
        lift: (i) => A.play('lift', i),
        drop: () => A.play('drop'),
        deny: () => { A.play('deny'); this.nudge(); },
        pour: (j, fill) => { A.play('pour', fill); this.paintHud(); this.tutorial(); },
        settle: (j, fill) => A.play('settle', fill),
        reveal: () => A.play('reveal'),
        complete: () => { A.play('complete'); if (this.settings.shake) this.shake = Math.max(this.shake, 0.12); },
        solved: () => this.solved(),
      };
    },

    startLevel(lv, quick) {
      lv = Math.max(1, Math.floor(lv));
      const go = () => {
        this.level = lv;
        Save.setLevel(Math.max(lv, 1));
        const tubes = R.makeLevel(lv);
        this.board = new Board(tubes, { events: this.boardEvents(true) });
        this.applyBoardSettings();
        this.par = R.par(tubes, lv);
        this.hints = 0;
        this.wonT = -1;
        this.cursorOn = Input.device === 'keyboard' || Input.device === 'gamepad';
        this.stack = [];
        this.layout();
        this.show('play');
        this.paintHud();
        this.tutorial();
        A.play('restart');
      };
      if (quick) go();
      else this.transition(go);
    },
    restart() {
      if (this.state !== 'play' || !this.board) return;
      if (!this.board.moves && !this.board.busy) return;
      this.board.reset();
      this.hints = 0;
      this.paintHud();
      this.tutorial();
      A.play('restart');
    },
    undo() {
      if (this.state !== 'play' || !this.board) return;
      if (this.board.undo()) { A.play('undo'); this.paintHud(); }
      else { A.play('deny'); }
    },
    hint() {
      if (this.state !== 'play' || !this.board || this.board.solved) return;
      const b = this.board;
      if (b.busy) b.finishAnim();
      const path = R.solve(b.tubes);
      if (path && path.length) {
        b.hint = { from: path[0][0], to: path[0][1], t: 0 };
        b.sel = null;
        if (!this.hints) UI.toast('Hint used: this level now tops out at 2 stars');
        this.hints++;
        A.play('hint');
        this.paintHud();
        const btn = $('[data-action="hint"]');
        btn.classList.remove('busy'); void btn.offsetWidth; btn.classList.add('busy');
      } else {
        UI.toast('No way out from here: try Undo or Restart');
        A.play('deny');
      }
    },
    pause() {
      if (this.state !== 'play') return;
      $('#pause-level').textContent = `Level ${this.level}`;
      if (this.board) this.board.sel = null;
      A.play('back');
      this.show('pause', { focus: '[data-action="resume"]' });
    },
    resume() {
      if (this.state !== 'pause') return;
      this.stack = [];
      this.show('play');
    },
    nudge() { this.nudgeT = 0.25; },

    solved() {
      this.wonT = 0;
      this.state = 'won';
      $('#hud').classList.add('off');
      A.play('win');
      this.board.confetti(Scene.W);
      if (this.settings.shake) this.shake = 0.3;
      const stars = R.stars(this.board.moves, this.par, this.hints);
      const { rec, newBest } = Save.record(this.level, stars, this.board.moves);
      Save.setLevel(this.level + 1);
      this.result = { stars, rec, newBest };
    },
    showResults() {
      const r = this.result;
      const b = this.board;
      $('#won-title').textContent = `Level ${this.level} sorted!`;
      $('#won-moves').textContent = b.moves;
      $('#won-par').textContent = this.par;
      $('#won-hints').textContent = this.hints;
      $('#won-best').textContent = r.rec.moves + (r.newBest ? '  new!' : '');
      const notes = [
        'Tidy work. Try it again in fewer pours?',
        'So close to par. One shortcut away from three stars.',
        this.hints ? 'Nice! Solve it without a hint for the third star.' : 'Matched par. A perfect pour!',
      ];
      $('#won-note').textContent = r.stars === 3 ? 'Matched par. A perfect pour!' : notes[r.stars - 1];
      const stamps = document.querySelectorAll('#won-stars i');
      stamps.forEach((s) => s.classList.remove('on'));
      this.show('won', { focus: '[data-action="next"]' });
      stamps.forEach((s, i) => {
        if (i < r.stars) setTimeout(() => { s.classList.add('on'); A.play('star', i); }, 350 + i * 320);
      });
    },

    paintHud() {
      const b = this.board;
      if (!b) return;
      $('#hud-level').textContent = this.level;
      $('#hud-moves').textContent = b.moves;
      $('#hud-par').textContent = this.par;
      const s = R.stars(Math.max(b.moves, 0), this.par, this.hints);
      document.querySelectorAll('#hud-stars i').forEach((el, i) => el.classList.toggle('on', i < s));
    },
    tutorial() {
      const el = $('#hud-help');
      let msg = '';
      const b = this.board;
      if (this.settings.guides && b && !b.solved) {
        const touch = Input.device === 'touch' || Input.device === 'mouse';
        if (this.level === 1 && b.moves === 0) msg = touch ? 'Tap a glass to pick it up, then tap where to pour' : 'Move along the counter and press select to pick a glass up';
        else if (this.level === 1 && b.moves === 1) msg = 'Drinks only pour onto the same flavour, or into an empty glass';
        else if (this.level === 2 && b.moves === 0) msg = 'Stuck? Undo is free, and hints show the next pour';
        else if (this.level === 10 && b.moves < 2) msg = 'New: the layers underneath are a mystery until uncovered';
      }
      el.textContent = msg;
      el.classList.toggle('on', !!msg);
    },

    // ---------- demo behind the title ----------
    makeDemo() {
      const lv = DEMO_LEVELS[this.demoIdx++ % DEMO_LEVELS.length];
      this.demo = new Board(R.makeLevel(lv), { events: {} });
      this.applyBoardSettings();
      this.demo.settings = Object.assign({}, this.demo.settings, { reduced: false });
      this.demoPath = R.solve(this.demo.tubes) || [];
      this.demoWait = 1.2;
      this.layout();
    },
    updateDemo(dt) {
      const d = this.demo;
      d.update(dt, this.time);
      if (d.busy) return;
      this.demoWait -= dt;
      if (this.demoWait > 0) return;
      if (d.solved || !this.demoPath.length) { this.makeDemo(); return; }
      const [i, j] = this.demoPath.shift();
      d.sel = i;
      this.demoLift = { i, j, t: 0.45 };
      this.demoWait = 99;
    },

    // ---------- loop ----------
    layout() {
      const top = Math.max(84, Scene.H * 0.12);
      const bottom = Scene.counterY;
      if (this.board) this.board.layout(Scene.W, Scene.H, top, bottom);
      if (this.demo) {
        // The title menu sits bottom-left on wide screens (demo on the right
        // of the counter) and at the bottom on tall ones (demo above it).
        const W = Scene.W;
        const H = Scene.H;
        if (W > H * 1.15) this.demo.layout(W, H, H * 0.3, bottom, W * 0.46, W * 0.97);
        else {
          // offsetTop ignores the entrance animation's transform
          const card = document.querySelector('#s-title .menu-card');
          const sub = document.querySelector('#s-title .neon-sub');
          const b2 = card.offsetHeight ? card.offsetTop - 16 : bottom;
          const t2 = sub.offsetHeight ? sub.offsetTop + sub.offsetHeight + 14 : H * 0.25;
          this.demo.layout(W, H, t2, Math.min(bottom, b2));
        }
      }
    },

    update(dt) {
      this.time += dt;
      Input.poll(dt);
      A.updateMusic();
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
      if (this.nudgeT > 0) this.nudgeT -= dt;
      const live = this.inPlayWorld();
      if (!live) {
        this.updateDemo(dt);
        if (this.demoLift) {
          this.demoLift.t -= dt;
          if (this.demoLift.t <= 0) { this.demo.pour(this.demoLift.i, this.demoLift.j); this.demoLift = null; this.demoWait = 0.9 + Math.random() * 0.5; }
        }
      } else if (this.board) {
        if (this.state !== 'pause') this.board.update(dt, this.time);
        const done = this.board.tubes.filter((t) => R.complete(t)).length;
        A.progress = done / Math.max(1, this.board.tubes.length - 2);
        if (this.wonT >= 0) {
          this.wonT += dt;
          if (this.wonT > 1.6) { this.wonT = -1; this.showResults(); }
        }
      }
      A.mood = live ? 'play' : 'menu';
    },

    render(ctx) {
      const d = Scene.dpr;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, Scene.W, Scene.H);
      Scene.ambient(ctx, this.time, this.settings.reduced);
      let sx = 0;
      let sy = 0;
      if (this.shake > 0 && this.settings.shake) {
        sx = (Math.random() - 0.5) * this.shake * 18;
        sy = (Math.random() - 0.5) * this.shake * 12;
      }
      if (this.nudgeT > 0 && this.settings.shake) sx += Math.sin(this.nudgeT * 60) * 3;
      const live = this.inPlayWorld();
      const b = live ? this.board : this.demo;
      if (!b) return;
      Scene.ox = sx;
      Scene.oy = sy;
      b.draw(ctx, this.time, { cursor: live && this.state === 'play' && this.cursorOn });
      Scene.ox = 0;
      Scene.oy = 0;
    },
  };

  PP.Game = Game;
})();
