// Snap Grid flow: title (an autopilot plays the cabinet behind the menu),
// high scores, settings, how to play, a run (classic or daily), pause and
// game over. Rules live in rules.js; drawing in view.js.
(function () {
  const R = window.SnapGrid.Rules;
  const { Save, Audio: A, Input, UI, View } = SG;
  const $ = (s) => document.querySelector(s);
  const N = R.N;
  const HINTS = 3;

  const newFx = () => ({ cells: {}, clearing: [], parts: [], pops: [], deal: [1, 1, 1], ret: null, overT: -1 });

  const Game = {
    state: 'title',
    stack: [],
    settings: Save.settings(),
    mode: 'classic',
    date: R.today(),
    g: null,
    fx: newFx(),
    demo: null,
    demoFx: newFx(),
    demoT: 1,
    time: 0,
    shake: 0,
    drag: null,
    kb: { on: false, piece: 0, x: 3, y: 3 },
    hint: null,
    hintsLeft: HINTS,
    restartArm: 0,
    confirmReset: false,

    init() {
      A.setVolumes(this.settings.sfx, this.settings.music);
      this.applyLook();
      UI.init((a, arg) => this.action(a, arg));
      UI.renderKeys();
      Input.init((a, arg) => this.input(a, arg));
      Input.refreshGlyphs();
      Input.onDevice = () => this.paintPress();
      this.buildSettings();
      this.newDemo();
      this.bindPointer();
      document.querySelectorAll('.how-art').forEach((c) => View.howArt(c));
      this.goTitle(true);
    },

    applyLook() {
      document.body.classList.toggle('reduced', this.settings.reduced);
      $('#crt').classList.toggle('off', !this.settings.crt);
    },

    // ---------- screens ----------
    playWorld() {
      if (this.state === 'play' || this.state === 'pause' || this.state === 'over') return true;
      return this.stack.length > 0 && (this.stack[0] === 'pause' || this.stack[0] === 'over');
    },
    show(state, focus) {
      this.state = state;
      $('#hud').classList.toggle('off', state !== 'play');
      UI.show(state === 'play' ? null : state === 'title' ? 'title' : state, { focus });
      this.relayout();
    },
    open(state) { this.stack.push(this.state); this.show(state); },
    close() {
      const prev = this.stack.pop() || 'title';
      this.show(prev, prev === 'pause' ? '[data-action="resume"]' : null);
      if (prev === 'title') this.paintTitle();
    },
    transition(fn) {
      if (this.settings.reduced) { fn(); return; }
      UI.fade(true);
      setTimeout(() => { fn(); UI.fade(false); }, 260);
    },
    goTitle(first) {
      this.stack = [];
      this.g = null;
      this.paintTitle();
      const go = () => this.show('title');
      if (first) go();
      else this.transition(go);
    },
    paintTitle() {
      this.date = R.today();
      $('#t-best').textContent = `HI ${Save.best()}`;
      $('#t-daily').textContent = `TODAY ${Save.daily(this.date)}`;
      this.paintPress();
    },
    paintPress() {
      const d = Input.device;
      $('#press').textContent = d === 'keyboard' ? 'PRESS ENTER' : d === 'gamepad' ? 'PRESS START' : 'CHOOSE A MODE';
      this.paintHelp();
    },

    // ---------- settings ----------
    buildSettings() {
      const s = this.settings;
      const store = () => { Save.storeSettings(s); UI.paintSettings(s); };
      const slider = (key, label) => ({ key, label, type: 'slider', get: () => s[key], set: (v) => { s[key] = v; A.setVolumes(s.sfx, s.music); store(); A.play('tick'); } });
      const toggle = (key, label, note) => ({ key, label, note, type: 'toggle', get: () => s[key], set: (v) => { s[key] = v; store(); this.applyLook(); A.play('tick'); } });
      const defs = [
        slider('sfx', 'SOUND FX'),
        slider('music', 'MUSIC'),
        toggle('shake', 'SCREEN SHAKE'),
        toggle('crt', 'CRT SCANLINES', 'the glass over the screen'),
        toggle('preview', 'DROP PREVIEW', 'ghost shape and lines to clear'),
        toggle('reduced', 'REDUCED MOTION', 'no wipes, flicker or flying blocks'),
      ];
      const doc = document.documentElement;
      if (doc.requestFullscreen || doc.webkitRequestFullscreen) {
        defs.push({ key: 'fullscreen', label: 'FULLSCREEN', type: 'toggle', get: () => !!(document.fullscreenElement || document.webkitFullscreenElement), set: () => this.toggleFullscreen() });
      }
      defs.push({
        key: 'reset', label: 'RESET HIGH SCORES', type: 'action', danger: true,
        labelFn: () => (this.confirmReset ? 'PRESS AGAIN TO ERASE' : 'RESET HIGH SCORES'),
        run: () => {
          if (!this.confirmReset) { this.confirmReset = true; UI.paintSettings(s); A.play('deny'); return; }
          Save.reset();
          this.confirmReset = false;
          UI.paintSettings(s);
          UI.toast('SCORES ERASED');
          this.paintTitle();
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

    // ---------- button actions ----------
    action(a) {
      switch (a) {
        case 'classic': A.play('start'); this.start('classic'); break;
        case 'daily': A.play('start'); this.start('daily'); break;
        case 'scores': A.play('confirm'); UI.renderScores(Save.table(), Save.daily(R.today())); this.open('scores'); break;
        case 'settings': A.play('confirm'); this.confirmReset = false; this.buildSettings(); this.open('settings'); break;
        case 'how': A.play('confirm'); this.open('how'); break;
        case 'back': A.play('back'); this.close(); break;
        case 'pause': this.pause(); break;
        case 'resume': A.play('back'); this.resume(); break;
        case 'hint': this.useHint(); break;
        case 'restart-menu': A.play('start'); this.start(this.mode, true); break;
        case 'quit': A.play('back'); this.goTitle(); break;
        case 'again': A.play('start'); this.start(this.mode); break;
        case 'switch': A.play('start'); this.start(this.mode === 'daily' ? 'classic' : 'daily'); break;
      }
    },

    // ---------- input ----------
    input(a, arg) {
      if (a === 'mute') {
        const on = this.settings.sfx + this.settings.music > 0;
        if (on) { this.memo = [this.settings.sfx, this.settings.music]; this.settings.sfx = 0; this.settings.music = 0; }
        else [this.settings.sfx, this.settings.music] = this.memo || [8, 6];
        A.setVolumes(this.settings.sfx, this.settings.music);
        Save.storeSettings(this.settings);
        UI.paintSettings(this.settings);
        UI.toast(on ? 'SOUND OFF' : 'SOUND ON');
        return;
      }
      if (this.state !== 'play') {
        if (this.state === 'pause' && a === 'pause') { this.resume(); return; }
        if (this.state === 'over' && this.fx.overT >= 0) return;
        if (a === 'up' || a === 'down' || a === 'left' || a === 'right') UI.nav(a);
        else if (a === 'confirm') UI.confirm();
        else if (a === 'back' || a === 'pause') { if (UI.back()) A.play('back'); }
        return;
      }
      const g = this.g;
      if (!g || g.over) return;
      const kb = this.kb;
      switch (a) {
        case 'up': case 'down': case 'left': case 'right': {
          if (!kb.on) { this.kbOn(); break; }
          kb.x += a === 'left' ? -1 : a === 'right' ? 1 : 0;
          kb.y += a === 'up' ? -1 : a === 'down' ? 1 : 0;
          this.clampKb();
          A.play('nudge');
          break;
        }
        case 'confirm':
          if (!kb.on) { this.kbOn(); break; }
          this.place(kb.piece, kb.x, kb.y);
          break;
        case 'next': case 'prev':
          if (!kb.on) this.kbOn();
          else this.cycle(a === 'next' ? 1 : -1);
          break;
        case 'piece':
          if (g.tray[arg] && !g.tray[arg].used) { if (!kb.on) this.kbOn(); kb.piece = arg; this.clampKb(); A.play('switch'); }
          break;
        case 'hint': this.useHint(); break;
        case 'back': case 'pause': this.pause(); break;
        case 'restart':
          if (this.restartArm > 0) { this.restartArm = 0; A.play('start'); this.start(this.mode, true); }
          else { this.restartArm = 1.6; UI.toast('PRESS AGAIN TO RESTART'); A.play('tick'); }
          break;
      }
    },
    kbOn() {
      this.kb.on = true;
      if (this.g.tray[this.kb.piece].used) this.cycle(1, true);
      this.clampKb();
      A.play('switch');
    },
    cycle(dir, quiet) {
      const kb = this.kb;
      for (let k = 1; k <= 3; k++) {
        const i = (kb.piece + dir * k + 6) % 3;
        if (!this.g.tray[i].used) { kb.piece = i; break; }
      }
      this.clampKb();
      if (!quiet) A.play('switch');
    },
    clampKb() {
      const p = this.g.tray[this.kb.piece];
      if (!p) return;
      const s = R.size(p);
      this.kb.x = Math.max(0, Math.min(N - s.w, this.kb.x));
      this.kb.y = Math.max(0, Math.min(N - s.h, this.kb.y));
    },

    bindPointer() {
      const cv = $('#game');
      const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      cv.addEventListener('pointerdown', (e) => {
        if (this.state !== 'play' || !this.g || this.g.over) return;
        const L = View.L;
        const p = pos(e);
        const i = L.slots.findIndex(([sx, sy]) => Math.abs(p.x - sx) < L.slotR && Math.abs(p.y - sy) < L.slotR);
        if (i === -1 || this.g.tray[i].used) return;
        this.kb.on = false;
        this.drag = { i, x: p.x, y: p.y, lift: e.pointerType === 'touch' ? L.cell * 1.7 : 0, t: 0 };
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
        A.play('grab');
      });
      cv.addEventListener('pointermove', (e) => {
        if (!this.drag) return;
        const p = pos(e);
        this.drag.x = p.x;
        this.drag.y = p.y;
      });
      cv.addEventListener('pointerup', () => {
        const d = this.drag;
        if (!d) return;
        this.drag = null;
        const [gx, gy] = this.snap(d);
        if (!this.place(d.i, gx, gy, true)) {
          this.fx.ret = { i: d.i, x: d.x, y: d.y - d.lift, t: 0 };
          A.play('bounce');
        }
      });
      cv.addEventListener('pointercancel', () => { this.drag = null; });
    },
    snap(d) {
      const L = View.L;
      const s = R.size(this.g.tray[d.i]);
      return [Math.round((d.x - (s.w * L.cell) / 2 - L.gx) / L.cell), Math.round((d.y - d.lift - (s.h * L.cell) / 2 - L.gy) / L.cell)];
    },

    // ---------- a run ----------
    start(mode, quick) {
      const go = () => {
        this.mode = mode;
        this.date = R.today();
        this.g = R.create(mode === 'daily' ? R.dailyRng(this.date) : R.freshRng());
        this.fx = newFx();
        this.fx.deal = [-0.1, -0.2, -0.3];
        this.drag = null;
        this.hint = null;
        this.hintsLeft = HINTS;
        this.kb = { on: Input.device === 'keyboard' || Input.device === 'gamepad', piece: 0, x: 3, y: 3 };
        this.stack = [];
        this.show('play');
        this.paintHud(true);
        A.play('deal');
      };
      if (quick) go();
      else this.transition(go);
    },
    pause() {
      if (this.state !== 'play') return;
      this.drag = null;
      A.play('back');
      this.show('pause', '[data-action="resume"]');
    },
    resume() {
      if (this.state !== 'pause') return;
      this.stack = [];
      this.show('play');
    },
    useHint() {
      if (this.state !== 'play' || !this.g || this.g.over) return;
      if (this.hintsLeft <= 0) { UI.toast('NO HINTS LEFT THIS RUN'); A.play('deny'); return; }
      const s = R.suggest(this.g);
      if (!s) return;
      this.hintsLeft--;
      this.hint = { i: s.i, x: s.x, y: s.y, t: 0 };
      if (this.kb.on || Input.device === 'keyboard' || Input.device === 'gamepad') this.kb = { on: true, piece: s.i, x: s.x, y: s.y };
      A.play('hint');
      this.paintHud();
    },

    // Place tray piece i at (x, y) in the live run, with all the effects.
    place(i, x, y, fromDrag) {
      const ev = this.applyPlace(this.g, this.fx, i, x, y, true);
      if (!ev) {
        if (!fromDrag) { A.play('deny'); this.nudge = 0.2; }
        return false;
      }
      this.hint = null;
      if (this.kb.on) {
        if (this.g.tray[this.kb.piece].used) this.cycle(1, true);
        this.clampKb();
      }
      if (ev.over) {
        this.fx.overT = 0;
        this.kb.on = false;
        A.play('over');
        if (this.settings.shake) this.shake = 0.4;
      }
      this.paintHud();
      return true;
    },

    // Shared by the run and the title autopilot.
    applyPlace(g, fx, i, x, y, live) {
      const ev = R.place(g, i, x, y);
      if (!ev) return null;
      const L = View.L;
      ev.cells.forEach(([cx, cy], k) => { fx.cells[cy * N + cx] = { t: -k * 0.025 }; });
      if (live) A.play('drop', ev.cells.length);
      const lines = ev.rows.length + ev.cols.length;
      if (lines) {
        const mx = ev.cells.reduce((s, c) => s + c[0], 0) / ev.cells.length;
        const my = ev.cells.reduce((s, c) => s + c[1], 0) / ev.cells.length;
        for (const c of ev.cleared) {
          const delay = 0.12 + Math.hypot(c.x - mx, c.y - my) * 0.04;
          fx.clearing.push({ x: c.x, y: c.y, color: c.color, gold: c.gold, t: -delay, delay0: delay, burst: false });
        }
        if (L) {
          const cx = L.gx + (mx + 0.5) * L.cell;
          const cy = L.gy + (my + 0.5) * L.cell;
          fx.pops.push({ text: `+${ev.points}`, x: cx, y: cy, t: 0, color: ev.gold ? '#ffe66d' : '#ffffff', big: lines > 1 });
          if (ev.gold) fx.pops.push({ text: 'GOLD x2', x: cx, y: cy - L.cell * 0.8, t: -0.15, color: '#ffe66d' });
          if (ev.streak > 1) fx.pops.push({ text: `STREAK ${ev.streak}`, x: L.gx + L.g / 2, y: L.gy + L.g * 0.15, t: -0.3, color: '#ff3864' });
          if (lines > 1) fx.pops.push({ text: lines === 2 ? 'DOUBLE!' : lines === 3 ? 'TRIPLE!' : 'MEGA!', x: L.gx + L.g / 2, y: L.gy + L.g / 2, t: -0.1, color: '#2de2e6', big: true });
        }
        if (live) {
          A.streak = ev.streak;
          setTimeout(() => A.play('clear', lines), 110);
          if (ev.gold) A.play('gold');
          if (this.settings.shake) this.shake = Math.max(this.shake, 0.1 + lines * 0.07);
        }
      } else if (live) A.streak = 0;
      if (ev.dealt) {
        fx.deal = [-0.15, -0.25, -0.35];
        if (live) setTimeout(() => A.play('deal'), 200);
      }
      return ev;
    },

    finish() {
      const g = this.g;
      const rec = Save.record(this.mode, this.date, g.score, { lines: g.lines });
      $('#over-title').textContent = 'GAME OVER';
      $('#over-mode').textContent = this.mode === 'daily' ? `DAILY BOARD ${this.date}` : 'CLASSIC';
      $('#over-hi').classList.toggle('on', rec.newBest);
      $('#over-lines').textContent = g.lines;
      $('#over-streak').textContent = g.bestStreak;
      $('#over-golds').textContent = g.golds;
      $('#over-best').textContent = rec.best;
      $('#over-switch').textContent = this.mode === 'daily' ? 'CLASSIC' : 'DAILY BOARD';
      this.countUp = { t: 0, to: g.score };
      $('#over-score').textContent = '0';
      this.show('over', '[data-action="again"]');
      if (rec.newBest) setTimeout(() => A.play('hiscore'), 500);
    },

    paintHud(reset) {
      const g = this.g;
      if (!g) return;
      $('#hud-mode').textContent = this.mode === 'daily' ? 'DAILY' : 'SCORE';
      $('#hud-score').textContent = g.score;
      $('#hud-best').textContent = Math.max(g.score, this.mode === 'daily' ? Save.daily(this.date) : Save.best());
      $('#hud-hints').textContent = this.hintsLeft;
      $('[data-action="hint"]').classList.toggle('spent', this.hintsLeft <= 0);
      const st = $('#hud-streak');
      const was = +st.querySelector('b').textContent;
      st.querySelector('b').textContent = `x${g.streak}`;
      st.classList.toggle('on', g.streak > 1);
      if (!reset && g.streak > 1 && g.streak !== was) { st.classList.remove('bump'); void st.offsetWidth; st.classList.add('bump'); }
      this.paintHelp();
    },
    paintHelp() {
      const el = $('#hud-help');
      let msg = '';
      if (this.g && this.state === 'play' && this.g.placed < 2 && !this.g.over) {
        const d = Input.device;
        msg = d === 'keyboard' ? 'ARROWS MOVE  ·  SPACE DROPS  ·  Q/E SWAPS SHAPE'
          : d === 'gamepad' ? 'D-PAD MOVES  ·  A DROPS  ·  LB/RB SWAPS SHAPE'
            : 'DRAG A SHAPE ONTO THE BOARD';
      }
      el.textContent = msg;
      el.classList.toggle('on', !!msg);
    },

    // Puts the DOM HUD around the board wherever the layout put it.
    placeHud() {
      const L = View.L;
      if (!L || L.mode !== 'play') return;
      const W = View.W;
      const left = $('#hud-left').style;
      const right = $('#hud-right').style;
      const btns = $('.hud-btns').style;
      const st = $('#hud-streak').style;
      const help = $('#hud-help').style;
      const top = Math.max(8, L.gy - L.bez - 60);
      left.left = `${L.gx - L.bez}px`;
      left.top = `${top}px`;
      right.right = `${W - (L.gx + L.g + L.bez)}px`;
      right.left = 'auto';
      right.top = `${top}px`;
      st.left = `${L.gx + L.g / 2}px`;
      st.top = `${top + 14}px`;
      st.transform = 'translateX(-50%)';
      if (L.wide) {
        const [sx, sy] = L.slots[2];
        btns.left = `${sx - 60}px`;
        btns.top = `${Math.min(View.H - 80, sy + L.slotR + 14)}px`;
        btns.transform = '';
        help.top = `${L.gy + L.g + L.bez + 8}px`;
        help.bottom = 'auto';
        help.left = `${L.gx + L.g / 2}px`;
      } else {
        btns.left = '50%';
        btns.top = `${top}px`;
        btns.transform = 'translateX(-50%)';
        st.top = `${L.gy - L.bez - 30}px`;
        help.top = 'auto';
        help.bottom = '10px';
        help.left = '50%';
      }
    },

    // ---------- title autopilot ----------
    newDemo() {
      this.demo = R.create(R.freshRng());
      this.demoFx = newFx();
      this.demoT = 0.8;
    },
    updateDemo(dt) {
      this.tickFx(this.demoFx, dt);
      this.demoT -= dt;
      if (this.demoT > 0) return;
      if (this.demo.over) { this.newDemo(); return; }
      const s = R.suggest(this.demo);
      if (!s) { this.newDemo(); return; }
      this.applyPlace(this.demo, this.demoFx, s.i, s.x, s.y, false);
      this.demoT = 0.75;
      if (this.demo.over) this.demoT = 2.5;
    },

    // ---------- loop ----------
    relayout() {
      const play = this.playWorld();
      View.layout(play ? 'play' : 'title');
      this.placeHud();
    },
    tickFx(fx, dt) {
      for (const k in fx.cells) { fx.cells[k].t += dt; if (fx.cells[k].t > 0.4) delete fx.cells[k]; }
      const L = View.L;
      for (let i = fx.clearing.length - 1; i >= 0; i--) {
        const c = fx.clearing[i];
        c.t += dt;
        if (c.t >= 0 && !c.burst && L) {
          c.burst = true;
          const n = this.settings.reduced ? 0 : 5;
          for (let k = 0; k < n; k++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 60 + Math.random() * 220;
            fx.parts.push({ x: L.gx + (c.x + 0.5) * L.cell, y: L.gy + (c.y + 0.5) * L.cell, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, s: L.cell * (0.15 + Math.random() * 0.2), color: c.gold ? '#ffe66d' : c.color, life: 0.7, max: 0.7, rot: 0, vr: (Math.random() - 0.5) * 12 });
          }
        }
        if (c.t > 0.25) fx.clearing.splice(i, 1);
      }
      for (let i = fx.parts.length - 1; i >= 0; i--) {
        const q = fx.parts[i];
        q.life -= dt;
        if (q.life <= 0) { fx.parts.splice(i, 1); continue; }
        q.vy += 700 * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.rot += q.vr * dt;
      }
      for (let i = fx.pops.length - 1; i >= 0; i--) { fx.pops[i].t += dt; if (fx.pops[i].t > 1.2) fx.pops.splice(i, 1); }
      for (let i = 0; i < 3; i++) if (fx.deal[i] < 1) fx.deal[i] += dt * 3.2;
      if (fx.ret) { fx.ret.t += dt; if (fx.ret.t > 0.25) fx.ret = null; }
      if (fx.overT >= 0) fx.overT += dt;
    },

    update(dt) {
      this.time += dt;
      Input.poll(dt);
      A.mood = this.playWorld() ? 'play' : 'menu';
      A.updateMusic();
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
      if (this.nudge > 0) this.nudge -= dt;
      if (this.restartArm > 0) this.restartArm -= dt;
      if (!this.playWorld()) { this.updateDemo(dt); return; }
      if (this.state === 'pause') return;
      this.tickFx(this.fx, dt);
      if (this.drag) this.drag.t += dt;
      if (this.hint) this.hint.t += dt;
      const g = this.g;
      if (g) {
        let filled = 0;
        for (const row of g.grid) for (const c of row) if (c) filled++;
        A.fill = filled / (N * N);
      }
      if (this.fx.overT > 1.7 && this.state === 'play') { this.fx.overT = -1; this.finish(); }
      if (this.countUp) {
        const c = this.countUp;
        c.t += dt;
        const v = Math.round(c.to * Math.min(1, c.t / 1.1));
        $('#over-score').textContent = v;
        if (c.t > 1.1) this.countUp = null;
        else if (Math.floor(c.t * 20) !== Math.floor((c.t - dt) * 20)) A.play('tick');
      }
    },

    render(ctx) {
      const d = View.dpr;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, View.W, View.H);
      View.floor(ctx, this.time, this.settings.reduced);
      const play = this.playWorld();
      const g = play ? this.g : this.demo;
      if (!g) return;
      if (this.shake > 0 && this.settings.shake) {
        View.ox = (Math.random() - 0.5) * this.shake * 22;
        View.oy = (Math.random() - 0.5) * this.shake * 16;
      }
      if (this.nudge > 0 && this.settings.shake) View.ox += Math.sin(this.nudge * 70) * 3;
      let ghost = null;
      if (play && this.state === 'play' && !g.over) {
        if (this.drag) { const [x, y] = this.snap(this.drag); ghost = { p: g.tray[this.drag.i], x, y }; }
        else if (this.kb.on && g.tray[this.kb.piece] && !g.tray[this.kb.piece].used) ghost = { p: g.tray[this.kb.piece], x: this.kb.x, y: this.kb.y };
        if (ghost) {
          ghost.ok = R.fits(g.grid, ghost.p, ghost.x, ghost.y);
          if (ghost.ok) ghost.lines = R.wouldClear(g.grid, ghost.p, ghost.x, ghost.y);
          if (!ghost.ok && this.drag) {
            const s = R.size(ghost.p);
            if (ghost.x < -1 || ghost.y < -1 || ghost.x + s.w > N + 1 || ghost.y + s.h > N + 1) ghost = null;
          }
        }
      }
      View.draw(ctx, g, play ? this.fx : this.demoFx, {
        drag: play ? this.drag : null, ghost, kb: play && this.state === 'play' ? this.kb : null,
        hint: play ? this.hint : null, time: this.time, settings: this.settings,
      });
      View.ox = 0;
      View.oy = 0;
    },
  };

  SG.Game = Game;
})();
