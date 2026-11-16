// Paper Trail game flow: the notebook cover, the page index, drawing a page,
// folding, hints, the stamp, and turning to the next page. Behind the cover
// the notebook solves its own pages, slowly, as a demonstration.
(function () {
  const R = PT.Rules, V = PT.View, M = PT.Menus, A = PT.Audio, S = PT.Save;
  const $ = (id) => document.getElementById(id);
  const INK_NAMES = ['Navy ink', 'Red ink', 'Pencil'];
  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', KeyP: 'pause', Digit1: 'foldx', Digit2: 'foldy', Numpad1: 'foldx', Numpad2: 'foldy',
    KeyZ: 'undo', Backspace: 'undo', KeyR: 'erase', KeyH: 'hint', KeyM: 'mute',
  };
  const PAD = { 0: 'confirm', 1: 'b', 2: 'hint', 3: 'undo', 4: 'foldx', 5: 'foldy', 9: 'pause', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
  const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
  const levelCache = {};
  const level = (n) => levelCache[n] || (levelCache[n] = R.makeLevel(n));

  const G = {
    state: 'title', from: 'title', settings: null, cur: null, old: null, turnT: 0, muted: false, events: [], padPrev: {}, padDir: null,
    demo: null, wonT: 0, hints: 0, drag: null, resetArm: false,

    init(canvas) {
      this.canvas = canvas;
      this.settings = S.settings();
      M.init((a, arg) => this.act(a, arg));
      this.buildSettings(); this.apply();
      this.bindInput(canvas);
      this.startDemo(false);
      this.showTitle();
    },
    apply() {
      const s = this.settings;
      A.setVolumes(this.muted ? 0 : s.sfx, this.muted ? 0 : s.music);
      document.body.classList.toggle('reduced', !!s.reduced);
      V.reduced = !!s.reduced;
      if (this.cur) this.cur.ink = s.ink;
      $('h-count').style.display = s.count ? '' : 'none';
      S.storeSettings(s);
    },
    buildSettings() {
      const s = this.settings, ch = (k) => (v) => { s[k] = v; this.apply(); };
      const fs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
      M.renderSettings([
        { key: 'sfx', label: 'Sound effects', type: 'slider', get: () => s.sfx, set: ch('sfx') },
        { key: 'music', label: 'Music box', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'ink', label: 'Writing with', type: 'action', text: () => INK_NAMES[s.ink], run: () => { s.ink = (s.ink + 1) % 3; this.apply(); } },
        { key: 'count', label: 'Square counter', type: 'toggle', get: () => s.count, set: ch('count') },
        { key: 'reduced', label: 'Reduced motion', type: 'toggle', get: () => s.reduced, set: ch('reduced') },
        { key: 'fs', label: 'Fullscreen', type: 'action', text: () => (fs() ? 'On' : 'Off'), run: () => { this.fullscreen(); setTimeout(() => M.paintSettings(), 300); } },
        { key: 'reset', label: 'Reset progress', type: 'action', labelFn: () => (this.resetArm ? 'Press again to erase all stamps' : 'Reset progress'), text: () => '', run: () => {
          if (!this.resetArm) { this.resetArm = true; A.play('deny'); return; }
          this.resetArm = false; S.reset(); A.play('erase'); M.toast('A fresh notebook');
        } },
      ]);
    },
    fullscreen() {
      const d = document, el = d.documentElement;
      try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { M.toast('No fullscreen here'); }
    },
    resize(W, H) { V.resize(W, H, W < 560 ? 92 : 84, W < 560 ? 92 : 86); },

    // ---------- scenes ----------
    scene(n, title) {
      const lv = level(n);
      return { lv, path: [lv.start], folds: { x: false, y: false }, fx: 0, fy: 0, hint: null, hintT: 0, grow: 1, pen: [(lv.start % lv.w) + 0.5, ((lv.start / lv.w) | 0) + 0.5], stampT: -1, ink: this.settings.ink, title };
    },
    turnTo(next) {
      if (this.cur) { this.old = this.cur; this.old.pen = null; this.turnT = this.settings.reduced ? 1 : 0; if (!this.settings.reduced) A.play('turn'); }
      this.cur = next;
    },
    startDemo(turn) {
      const n = 1 + Math.floor(Math.random() * 14);
      const sc = this.scene(n, 'Practice');
      const sol = R.solveFrom(sc.lv, sc.lv.folds, [sc.lv.start]);
      this.demo = { sol: sol || [sc.lv.start], t: -1.2, i: 1, done: -1 };
      if (turn) this.turnTo(sc); else this.cur = sc;
    },
    showTitle() {
      const lvl = S.level(), total = S.total(), fresh = lvl === 1 && !total;
      $('t-continue').textContent = fresh ? 'Start writing' : 'Continue';
      $('t-continue-note').textContent = `Page ${lvl} of ${R.LEVELS}`;
      $('t-stamps').textContent = `${total} of ${R.LEVELS * 3} stamps`;
      M.show('title');
    },
    start(n) {
      A.play('confirm');
      this.n = n; this.hints = 0; this.wonT = 0;
      this.turnTo(this.scene(n));
      this.state = 'play';
      M.show(null);
      $('hud').classList.remove('off');
      this.hud();
    },
    quit() {
      this.state = 'title';
      $('hud').classList.add('off');
      this.startDemo(true);
      this.showTitle();
    },
    pause() {
      if (this.state !== 'play') return;
      this.state = 'paused'; A.play('back');
      $('hud').classList.add('off');
      M.show('pause', true);
    },
    resume() {
      if (this.state !== 'paused') return;
      this.state = 'play'; A.play('confirm');
      M.show(null); $('hud').classList.remove('off');
    },
    openLevels() {
      this.from = this.state === 'paused' ? 'pause' : this.state === 'result' ? 'result' : 'title';
      M.renderLevels({ levels: R.LEVELS, unlocked: S.level(), stars: S.stamps(), total: S.total(), current: this.n || S.level() });
      A.play('confirm');
      M.show('levels', true);
    },
    act(a, arg) {
      switch (a) {
        case 'continue': return this.start(S.level());
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
        case 'hint': return this.hint();
        case 'undo': return this.undo();
        case 'erase': return this.erase();
        case 'fold-x': return this.fold('x');
        case 'fold-y': return this.fold('y');
      }
    },

    // ---------- drawing the line ----------
    total() { return this.cur.lv.open.filter(Boolean).length; },
    end() { return this.cur.path[this.cur.path.length - 1]; },
    canStep(k) { const c = this.cur, e = this.end(); return c.lv.open[k] && !c.path.includes(k) && R.neighbours(c.lv, c.folds, e % c.lv.w, (e / c.lv.w) | 0).includes(k); },
    stepTo(k, quiet) {
      const c = this.cur;
      if (this.state !== 'play' || !this.canStep(k)) { if (!quiet) { A.play('deny'); c.wiggle = 0.25; } return false; }
      c.path.push(k); c.grow = this.settings.reduced ? 1 : 0;
      if (c.hint === k) c.hintT = 0;
      A.play('step', c.path.length);
      this.hud();
      if (c.path.length === this.total()) this.win();
      return true;
    },
    undo() {
      const c = this.cur; if (this.state !== 'play' || c.path.length < 2) return;
      c.path.pop(); A.play('erase'); this.hud();
    },
    cutTo(k) {
      const c = this.cur, at = c.path.indexOf(k);
      if (at < 0 || at === c.path.length - 1) return;
      c.path.length = at + 1; A.play('erase'); this.hud();
    },
    erase() {
      const c = this.cur; if (this.state !== 'play') return;
      if (c.path.length > 1) { c.path.length = 1; A.play('erase'); } else A.play('deny');
      this.hud();
    },
    fold(axis) {
      const c = this.cur; if (this.state !== 'play') return;
      c.folds[axis] = !c.folds[axis];
      A.play(c.folds[axis] ? 'fold' : 'unfold');
      // opening a fold the line used cuts the line back to before that step
      for (let i = 1; i < c.path.length; i++) {
        const a = c.path[i - 1], b = c.path[i];
        if (!R.neighbours(c.lv, c.folds, a % c.lv.w, (a / c.lv.w) | 0).includes(b)) { c.path.length = i; M.toast('The line over that fold is erased'); break; }
      }
      this.hud();
    },
    hint() {
      const c = this.cur; if (this.state !== 'play') return;
      const lv = c.lv, all = { x: true, y: true };
      const F = { x: lv.folds.x || c.folds.x, y: lv.folds.y || c.folds.y };
      let sol = R.solveFrom(lv, F, c.path);
      if (!Array.isArray(sol)) sol = R.solveFrom(lv, all, c.path);
      this.hints++;
      A.play('hint');
      if (Array.isArray(sol)) {
        const next = sol[c.path.length], axis = R.wraps(lv, this.end(), next);
        if (axis && !c.folds[axis]) {
          M.toast(axis === 'x' ? 'Try folding the sides' : 'Try folding the top and bottom');
          const b = $(axis === 'x' ? 'fold-x' : 'fold-y'); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
        } else { c.hint = next; c.hintT = 4; M.toast('Next square: highlighted'); }
        return;
      }
      for (let i = c.path.length - 1; i >= 1; i--) {
        if (Array.isArray(R.solveFrom(lv, all, c.path.slice(0, i), 40000))) { c.hint = c.path[i - 1]; c.hintT = 4; M.toast('This line can’t finish. Erase back to the highlight'); return; }
      }
      M.toast('Erase the line and try a new way');
    },
    win() {
      const c = this.cur;
      this.state = 'won'; this.wonT = 0; c.stampT = -0.35; c.pen = null;
      A.play('win');
      $('hud').classList.add('off');
    },
    showResult() {
      const stamps = this.hints === 0 ? 3 : this.hints <= 2 ? 2 : 1, res = S.win(this.n, stamps);
      this.state = 'result';
      $('r-kicker').textContent = `Page ${this.n} of ${R.LEVELS}`;
      $('r-title').textContent = ['Every square, one line', 'Neatly done', 'Not a square missed', 'Folded and finished'][this.n % 4];
      [...$('r-stamps').children].forEach((el, i) => el.classList.toggle('on', i < stamps));
      const folds = (this.cur.folds.x ? 1 : 0) + (this.cur.folds.y ? 1 : 0);
      const bits = [`${this.total()} squares`, `${folds} fold${folds === 1 ? '' : 's'}`, this.hints ? `${this.hints} hint${this.hints === 1 ? '' : 's'}` : 'no hints'];
      if (res.improved && res.best === 3 && stamps === 3) bits.push('a perfect page');
      $('r-note').textContent = bits.join(' · ');
      const last = this.n >= R.LEVELS;
      $('r-next').style.display = last ? 'none' : '';
      if (last) M.toast('That was the last page. Well folded!');
      M.show('result', true);
    },
    hud() {
      const c = this.cur; if (!c || this.state === 'title') return;
      const n = c.path.length, t = this.total();
      $('h-page').textContent = `Page ${this.n}`;
      $('h-count').textContent = `${n} / ${t} squares`;
      $('h-bar').style.width = (n / t) * 100 + '%';
      $('fold-x').classList.toggle('on', c.folds.x);
      $('fold-y').classList.toggle('on', c.folds.y);
    },

    // ---------- input ----------
    bindInput(canvas) {
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        A.unlock();
        const a = KEYS[e.code]; if (!a) return;
        e.preventDefault(); this.setDevice('keyboard');
        if (!e.repeat || DIRS[a]) this.events.push(a);
      });
      canvas.addEventListener('pointerdown', (e) => {
        A.unlock(); this.setDevice(e.pointerType === 'mouse' ? 'mouse' : 'touch');
        if (this.state !== 'play') return;
        const k = this.cellAt(e.clientX, e.clientY, false); if (k < 0) return;
        const c = this.cur;
        if (c.path.includes(k)) this.cutTo(k);
        else if (!this.stepTo(k, true)) { if (c.lv.open[k]) { A.play('deny'); c.wiggle = 0.25; } }
        this.drag = { id: e.pointerId, last: k };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
      });
      canvas.addEventListener('pointermove', (e) => {
        const d = this.drag; if (!d || d.id !== e.pointerId || this.state !== 'play') return;
        const k = this.cellAt(e.clientX, e.clientY, true);
        if (k < 0 || k === d.last) return;
        d.last = k;
        const c = this.cur;
        if (c.path.length > 1 && c.path[c.path.length - 2] === k) { this.undo(); return; }
        if (c.path.includes(k)) return;
        if (!this.stepTo(k, true)) this.slide(k);
      });
      const up = (e) => { if (this.drag && this.drag.id === e.pointerId) this.drag = null; };
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      addEventListener('gamepadconnected', () => this.setDevice('gamepad'));
    },
    setDevice(d) { if (document.body.dataset.device !== d) document.body.dataset.device = d; },
    // a fast drag can skip squares: walk along the row or column toward the finger
    slide(k) {
      const c = this.cur, w = c.lv.w;
      for (let guard = 0; guard < 8; guard++) {
        const e = this.end(), ex = e % w, ey = (e / w) | 0, kx = k % w, ky = (k / w) | 0;
        if (e === k) return;
        let nx = ex, ny = ey;
        if (ey === ky && ex !== kx) nx += Math.sign(kx - ex); else if (ex === kx && ey !== ky) ny += Math.sign(ky - ey); else return;
        if (!this.stepTo(ny * w + nx, true)) return;
      }
    },
    // screen point -> square; while dragging, leaving the page over a folded edge comes back on the other side
    cellAt(sx, sy, wrap) {
      const c = this.cur; V.use(c.lv, c.fx, c.fy, 0);
      const [u, v] = V.unproject(sx, sy), w = c.lv.w, h = c.lv.h;
      let x = Math.floor(u), y = Math.floor(v);
      if (wrap) {
        if ((x < 0 || x >= w) && c.folds.x && u > -0.9 && u < w + 0.9) x = (x + w) % w;
        if ((y < 0 || y >= h) && c.folds.y && v > -0.9 && v < h + 0.9) y = (y + h) % h;
      }
      return x >= 0 && y >= 0 && x < w && y < h ? y * w + x : -1;
    },
    pollPad() {
      const gp = Array.from((navigator.getGamepads && navigator.getGamepads()) || []).find((p) => p && p.connected);
      if (!gp) return;
      for (const [i, a] of Object.entries(PAD)) {
        const on = !!(gp.buttons[i] && gp.buttons[i].pressed);
        if (on && !this.padPrev[i]) { this.events.push(a); this.setDevice('gamepad'); A.unlock(); }
        this.padPrev[i] = on;
      }
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      let dir = null;
      if (Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
      if (dir && dir !== this.padDir) this.events.push(dir);
      this.padDir = dir;
    },
    handle(e) {
      if (e === 'mute') { this.muted = !this.muted; this.apply(); M.toast(this.muted ? 'Sound off' : 'Sound on'); return; }
      if (this.state === 'play') {
        if (DIRS[e]) {
          const c = this.cur, w = c.lv.w, h = c.lv.h, end = this.end();
          let nx = (end % w) + DIRS[e][0], ny = ((end / w) | 0) + DIRS[e][1];
          if (c.folds.x) nx = (nx + w) % w;
          if (c.folds.y) ny = (ny + h) % h;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) { A.play('deny'); c.wiggle = 0.25; return; }
          const k = ny * w + nx;
          if (c.path.length > 1 && c.path[c.path.length - 2] === k) this.undo(); else this.stepTo(k);
        } else if (e === 'foldx' || e === 'foldy') this.fold(e === 'foldx' ? 'x' : 'y');
        else if (e === 'undo' || e === 'b') this.undo();
        else if (e === 'erase') this.erase();
        else if (e === 'hint') this.hint();
        else if (e === 'back' || e === 'pause') this.pause();
        return;
      }
      if (this.state === 'won') return;
      const cur = M.current && M.current.id;
      if (e === 'back' || e === 'b' || e === 'pause') {
        if (cur === 's-pause') this.resume();
        else if (cur === 's-settings' || cur === 's-how' || cur === 's-levels') this.act('back');
        return;
      }
      if (e === 'confirm') M.confirm();
      else if (DIRS[e]) M.nav(e);
    },

    // ---------- time ----------
    update(dt) {
      this.pollPad();
      for (const e of this.events.splice(0)) this.handle(e);
      V.tick(dt);
      A.update(this.state === 'play');
      if (this.old) { this.turnT += dt / 0.9; if (this.turnT >= 1) this.old = null; }
      const c = this.cur; if (!c) return;
      const ease = Math.min(1, dt * 9);
      c.fx += ((c.folds.x ? 1 : 0) - c.fx) * ease; c.fy += ((c.folds.y ? 1 : 0) - c.fy) * ease;
      c.grow = Math.min(1, c.grow + dt * 9);
      c.hintT = Math.max(0, c.hintT - dt);
      c.wiggle = (c.wiggle || 0) * Math.max(0, 1 - dt * 6);
      c.lift = Math.max(0, (c.lift || 0) - dt * 3);
      if (c.pen) {
        const e = c.path[c.path.length - 1], tx = (e % c.lv.w) + 0.5, ty = ((e / c.lv.w) | 0) + 0.5;
        if (Math.hypot(tx - c.pen[0], ty - c.pen[1]) > 1.5) { c.pen = [tx, ty]; c.lift = 1; }
        else { c.pen[0] += (tx - c.pen[0]) * Math.min(1, dt * 16); c.pen[1] += (ty - c.pen[1]) * Math.min(1, dt * 16); }
        if (c.wiggle > 0.01) c.wiggle = c.wiggle * Math.cos(V.time * 40);
      }
      if (c.stampT > -1) {
        const before = c.stampT; c.stampT += dt;
        if (before < 0 && c.stampT >= 0) {
          A.play('stamp');
          V.use(c.lv, c.fx, c.fy, 0); const p = V.pt(c.lv.w / 2, c.lv.h / 2); V.confetti(p[0], p[1], 50);
        }
      }
      if (this.state === 'won') { this.wonT += dt; if (this.wonT > 1.7) this.showResult(); }
      if (this.state === 'title' || (M.current && M.current.id === 's-title')) this.runDemo(dt);
    },
    runDemo(dt) {
      const d = this.demo, c = this.cur; if (!d || !c || this.old) return;
      d.t += dt;
      if (d.done >= 0) { d.done += dt; if (d.done > 2.4) this.startDemo(true); return; }
      if (d.t > -0.6 && !c.folds.x && c.lv.folds.x) { c.folds.x = true; }
      if (d.t > -0.3 && !c.folds.y && c.lv.folds.y) { c.folds.y = true; }
      if (d.t > 0.32 && d.i < d.sol.length) { d.t = 0; c.path.push(d.sol[d.i++]); c.grow = 0; }
      if (d.i >= d.sol.length && d.sol.length > 1) { d.done = 0; c.stampT = -0.3; }
    },
    render(g) { V.draw(g, this.cur, this.old, this.old ? Math.min(1, this.turnT) * Math.PI * 0.96 : 0); },
  };
  PT.Game = G;
})();
