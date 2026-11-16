// Lot Jam: the game. Screens and flow, the lot in play, animations and
// effects. Rules live in rules.js; drawing helpers in iso.js; menus in ui.js.
(function () {
  const R = window.LotJam.Rules;
  const { View: V, UI, Audio: A, Save: S, Input: I } = LJ;
  const $ = (s) => document.querySelector(s);
  const DIRS = R.DIRS;

  const G = {
    state: 'title', back: null, level: 1, lot: null, g: null,
    anims: new Map(), parts: [], cursor: [0, 0], showCursor: false, hintCar: null, hintT: 0,
    shake: 0, t: 0, endT: 0, page: 0, settings: S.settings(), demo: null, resetArm: false,

    init() {
      this.applySettings();
      UI.init((a, arg, el) => this.action(a, arg, el));
      UI.renderKeys();
      I.init((a) => this.input(a));
      this.renderSettings();
      this.toTitle(true);
    },

    // ---------- settings ----------
    applySettings() {
      const s = this.settings;
      A.setVolumes(s.sfx, s.music);
      document.body.classList.toggle('reduced', !!s.reduced);
      S.storeSettings(s);
    },
    renderSettings() {
      const s = this.settings;
      const fs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
      const defs = [
        { key: 'sfx', label: 'Sound effects', type: 'slider', get: () => s.sfx, set: (v) => { s.sfx = v; this.applySettings(); A.play('tick'); UI.paintSettings(s); } },
        { key: 'music', label: 'Music', type: 'slider', get: () => s.music, set: (v) => { s.music = v; this.applySettings(); UI.paintSettings(s); } },
        { key: 'shake', label: 'Screen shake', note: 'Bumps rattle the camera', type: 'toggle', get: () => s.shake, set: (v) => { s.shake = v; this.applySettings(); UI.paintSettings(s); } },
        { key: 'tips', label: 'Tips', note: 'Hints the first time you meet something new', type: 'toggle', get: () => s.tips, set: (v) => { s.tips = v; this.applySettings(); UI.paintSettings(s); } },
        { key: 'reduced', label: 'Reduced motion', note: 'Calmer menus and fewer effects', type: 'toggle', get: () => s.reduced, set: (v) => { s.reduced = v; this.applySettings(); UI.paintSettings(s); } },
        { key: 'fullscreen', label: 'Fullscreen', type: 'action', text: () => (fs() ? 'On' : 'Off'), run: () => { this.toggleFullscreen(); setTimeout(() => UI.paintSettings(s), 300); } },
        { key: 'reset', label: 'Reset progress', danger: true, type: 'action', labelFn: () => (this.resetArm ? 'Press again to erase all stars' : 'Reset progress'), text: () => '', run: () => {
          if (!this.resetArm) { this.resetArm = true; UI.paintSettings(s); A.play('deny'); return; }
          S.reset(); this.resetArm = false; UI.paintSettings(s); UI.toast('Progress erased'); this.refreshTitle();
        } },
      ];
      UI.renderSettings(defs, s);
    },
    toggleFullscreen() {
      const d = document, el = d.documentElement;
      try {
        if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
        else (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      } catch (e) { UI.toast('Fullscreen is not available here'); }
    },

    // ---------- screens ----------
    setState(s, screen, opts) {
      this.state = s;
      UI.show(screen === undefined ? s : screen, opts);
      $('#hud').classList.toggle('off', s !== 'play');
      A.mood = s === 'play' ? 'play' : 'menu';
    },
    refreshTitle() {
      const lv = S.last();
      $('#t-continue').textContent = S.total() ? 'Continue' : 'Start';
      $('#t-level').textContent = `Level ${lv}`;
      $('#t-stars').textContent = `${S.total()} / ${R.LEVELS * 3}`;
    },
    toTitle(first) {
      this.refreshTitle();
      this.back = null;
      this.startDemo();
      if (!first) this.flash();
      this.setState('title');
    },
    flash() { UI.fade(true); setTimeout(() => UI.fade(false), 220); },
    openSub(screen) {
      // settings / how / levels from the title or from pause, then back again
      this.back = this.state === 'paused' || this.back === 'paused' ? 'paused' : this.state === 'title' ? 'title' : this.back || 'title';
      if (screen === 'levels') { this.page = Math.floor((this.level - 1) / 20); this.renderLevels(); }
      if (screen === 'settings') { this.resetArm = false; UI.paintSettings(this.settings); }
      this.setState(screen, screen, { dim: this.back === 'paused' || this.back === 'title' });
    },
    goBack() {
      if (this.back === 'paused') this.setState('paused', 'pause', { dim: true });
      else this.toTitle();
    },
    renderLevels() {
      UI.renderLevels(this.page, { levels: R.LEVELS, unlocked: S.level(), stars: S.stars(), total: S.total(), current: this.level });
    },

    // ---------- playing a level ----------
    load(lv) {
      this.level = lv;
      this.settings.last = lv; S.storeSettings(this.settings);
      this.lot = R.makeLevel(lv);
      this.g = R.start(this.lot);
      this.demo = null;
      this.anims.clear(); this.parts = []; this.hintCar = null; this.showCursor = false;
      this.cursor = [Math.floor(this.g.n / 2), Math.floor(this.g.n / 2)];
      this.layout(true);
      this.flash();
      A.play('start');
      this.setState('play', null);
      this.paintHud();
      this.firstTips();
    },
    firstTips() {
      if (!this.settings.tips) return;
      const seen = this.settings.seen || (this.settings.seen = {});
      const tip = (key, text) => { if (seen[key]) return false; seen[key] = true; S.storeSettings(this.settings); this.tip(text); return true; };
      if (this.g.deadline && tip('amb', 'The ambulance must be out before its exit counter hits zero.')) return;
      if (this.g.cars.some((c) => c.asleep) && tip('sleep', 'Dark cars are asleep. Tap once to wake them, again to drive.')) return;
      if (this.level === 1) tip('first', 'Tap a car to send it straight out.');
    },
    tip(text) {
      const el = $('#hud-tip');
      el.textContent = text; el.classList.add('on');
      clearTimeout(this.tipT); this.tipT = setTimeout(() => el.classList.remove('on'), 4200);
    },
    paintHud() {
      const g = this.g;
      $('#hud-level').textContent = this.level;
      document.querySelectorAll('#hud-cones i').forEach((el, i) => el.classList.toggle('lost', i >= g.cones));
      const amb = $('#hud-amb');
      const waiting = R.ambulanceWaiting(g);
      amb.classList.toggle('off', !waiting);
      $('#hud-amb-n').textContent = R.exitsLeft(g);
      amb.classList.toggle('urgent', waiting && R.exitsLeft(g) <= 2);
      A.urgency = waiting ? Math.max(0, 1 - R.exitsLeft(g) / Math.max(1, g.deadline)) : 0;
    },

    tap(car) {
      const g = this.g;
      if (!g || g.over || !car || car.out || this.anims.has(car.id)) return;
      this.hintCar = null;
      const res = R.tap(g, car);
      if (res.type === 'wake') { this.anims.set(car.id, { type: 'wake', t: 0 }); A.play('wake'); this.paintHud(); return; }
      if (res.type === 'bump') {
        this.anims.set(car.id, { type: 'bump', t: 0, free: res.free });
        A.play('bump'); setTimeout(() => A.play('cone'), 120);
        if (res.blocker) A.play('horn');
        if (this.settings.shake) this.shake = 0.3;
        const f = V.footprint(car, [0, 0]), d = DIRS[car.dir];
        this.burst((f.x0 + f.x1) / 2 + d[0] * (res.free + car.len / 2), (f.y0 + f.y1) / 2 + d[1] * (res.free + car.len / 2), 0.4, '#d9d4c7', 10);
        this.paintHud();
        if (res.lost) this.finish(false, 'cones');
        return;
      }
      if (res.type === 'out') {
        this.anims.set(car.id, { type: 'out', t: 0 });
        A.play(car.kind === 'ambulance' ? 'siren' : 'drive', car.len);
        this.paintHud();
        if (res.won) this.finish(true);
        else if (res.lost) this.finish(false, 'ambulance');
      }
    },
    undo() {
      const c = this.g && R.undo(this.g);
      if (!c) { A.play('deny'); return; }
      this.anims.set(c.id, { type: 'back', t: 0 });
      A.play('undo'); this.paintHud();
    },
    hint() {
      if (!this.g || this.g.over) return;
      const c = R.hint(this.g);
      if (!c) { UI.toast('No safe car. Try Undo.'); A.play('deny'); return; }
      this.hintCar = c; this.hintT = 0; A.play('hint');
    },
    restart() { if (this.lot) { this.load(this.level); } },
    finish(won, why) {
      this.endT = 0;
      this.pending = { won, why };
    },
    showResult() {
      const { won, why } = this.pending;
      this.pending = null;
      if (won) {
        const stars = R.starsFor(this.g);
        const res = S.win(this.level, stars);
        $('#won-level').textContent = `LEVEL ${this.level}`;
        const cones = document.querySelectorAll('#won-cones i');
        cones.forEach((el, i) => { el.className = ''; el.classList.toggle('lost', i >= stars); });
        cones.forEach((el, i) => { if (i < stars) setTimeout(() => { el.classList.add('pop'); A.play('star', i); }, 450 + i * 260); });
        $('#won-note').textContent = stars === 3 ? 'Not a single bump. Perfect parking.' : res.improved ? 'New best for this lot!' : `Best: ${res.best} of 3 cones`;
        const last = this.level >= R.LEVELS;
        $('#won-next').textContent = last ? 'Back to level 1' : 'Next level';
        A.play('won');
        for (let i = 0; i < 40; i++) this.burst(Math.random() * this.g.n, Math.random() * this.g.n, 1.5, ['#ffcf1f', '#ff7a1a', '#3bff7a', '#4cc9f0'][i % 4], 1);
        this.setState('won', 'won', { dim: true });
      } else {
        $('#lost-title').textContent = why === 'cones' ? 'OUT OF CONES' : 'ROAD CLOSED';
        $('#lost-why').textContent = why === 'cones' ? 'Three bumps and the attendant closes the lot.' : 'The ambulance got stuck behind the queue.';
        $('#lost-undo').style.display = why === 'ambulance' ? '' : 'none';
        A.play('lost');
        this.setState('lost', 'lost', { dim: true });
      }
    },

    // ---------- actions from menus ----------
    action(a, arg) {
      if (a !== 'move') A.play(a === 'back' ? 'back' : 'confirm');
      switch (a) {
        case 'continue': this.load(S.last()); break;
        case 'levels': this.openSub('levels'); break;
        case 'settings': this.openSub('settings'); break;
        case 'how': this.openSub('how'); break;
        case 'back': this.goBack(); break;
        case 'page-prev': if (this.page > 0) { this.page--; this.renderLevels(); } break;
        case 'page-next': if ((this.page + 1) * 20 < R.LEVELS) { this.page++; this.renderLevels(); } break;
        case 'play-level': this.load(arg); break;
        case 'pause': this.pause(); break;
        case 'resume': this.resume(); break;
        case 'restart': case 'restart-menu': case 'replay': this.restart(); break;
        case 'undo': if (this.state === 'play') this.undo(); break;
        case 'hint': if (this.state === 'play') this.hint(); break;
        case 'undo-loss': if (this.g && this.g.over === 'ambulance') { this.g.over = null; this.undo(); this.setState('play', null); } break;
        case 'next': this.load(this.level >= R.LEVELS ? 1 : this.level + 1); break;
        case 'quit': this.toTitle(); break;
      }
    },
    pause() { if (this.state === 'play') { this.back = 'paused'; this.setState('paused', 'pause', { dim: true }); } },
    resume() { this.back = null; this.setState('play', null); },

    // ---------- input from keys and pads ----------
    input(a) {
      if (a === 'mute') { const off = this.settings.sfx + this.settings.music > 0; this.settings.sfx = off ? 0 : 8; this.settings.music = off ? 0 : 6; this.applySettings(); UI.paintSettings(this.settings); UI.toast(off ? 'Sound off' : 'Sound on'); return; }
      if (this.state === 'play') {
        const n = this.g.n;
        const step = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[a];
        if (step) { this.showCursor = true; this.cursor = [Math.max(0, Math.min(n - 1, this.cursor[0] + step[0])), Math.max(0, Math.min(n - 1, this.cursor[1] + step[1]))]; A.play('move'); return; }
        if (a === 'confirm') { if (!this.showCursor) { this.showCursor = true; return; } this.tap(this.carAt(this.cursor[0], this.cursor[1])); return; }
        if (a === 'back' || a === 'pause') { this.pause(); return; }
        if (a === 'undo') { this.undo(); return; }
        if (a === 'hint') { this.hint(); return; }
        if (a === 'restart') { this.restart(); return; }
        return;
      }
      if (a === 'up' || a === 'down' || a === 'left' || a === 'right') { UI.nav(a); return; }
      if (a === 'confirm') { UI.confirm(); return; }
      if (a === 'back' || a === 'pause') { if (this.state === 'paused') this.resume(); else UI.back(); }
    },
    carAt(x, y) { return this.g.cars.find((c) => !c.out && R.cellsOf(c).some(([cx, cy]) => cx === x && cy === y)); },
    pointer(px, py) {
      if (this.state !== 'play') return;
      this.showCursor = false;
      // nearest cars first, so a tap on an overlapping roof picks the front one
      const cars = this.g.cars.filter((c) => !c.out).sort((a, b) => (b.y + (b.dir === 'N' || b.dir === 'S' ? b.len : 1)) - (a.y + (a.dir === 'N' || a.dir === 'S' ? a.len : 1)));
      const hit = cars.find((c) => V.inside(V.hull(c, this.offset(c)), px, py));
      if (hit) this.tap(hit);
    },

    // ---------- the demo behind the title ----------
    startDemo() {
      const lv = Math.max(3, Math.min(R.LEVELS, S.last()));
      this.lot = R.makeLevel(lv);
      this.g = R.start(this.lot);
      this.g.cars.forEach((c) => { c.asleep = false; });
      this.demo = { t: 1.2 };
      this.anims.clear(); this.parts = []; this.hintCar = null;
      this.layout(true);
    },
    updateDemo(dt) {
      const d = this.demo;
      d.t -= dt;
      if (d.t > 0 || this.anims.size) return;
      const c = this.g.cars.filter((o) => !o.out && !R.lookAhead(o, this.g.cars, this.g.n).blocker)[0];
      if (!c) { this.startDemo(); return; }
      c.out = true;
      this.anims.set(c.id, { type: 'out', t: 0, quiet: true });
      d.t = 1.4;
    },

    // ---------- per frame ----------
    offset(c) {
      const a = this.anims.get(c.id), d = DIRS[c.dir];
      if (!a) return [0, 0];
      let m = 0;
      if (a.type === 'out') m = a.t * a.t * (this.g.n + 4);
      if (a.type === 'back') m = (1 - a.t) * (1 - a.t) * (this.g.n + 4);
      if (a.type === 'bump') m = Math.sin(Math.min(1, a.t) * Math.PI) * (a.free + 0.22);
      return [d[0] * m, d[1] * m];
    },
    burst(x, y, z, color, count) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 1.6;
        this.parts.push({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 1 + Math.random() * 2, life: 0.6 + Math.random() * 0.5, max: 1.1, color, r: 0.06 + Math.random() * 0.05 });
      }
    },
    update(dt) {
      this.t += dt;
      I.poll(dt);
      A.updateMusic();
      if (this.state === 'title' && this.demo) this.updateDemo(dt);
      const speed = this.settings.reduced ? 1.4 : 1;
      for (const [id, a] of this.anims) {
        a.t += dt * (a.type === 'out' ? 1.25 : a.type === 'back' ? 1.6 : a.type === 'wake' ? 2 : 3) * speed;
        if (a.type === 'out' && !this.settings.reduced && Math.random() < dt * 30) {
          const c = this.g.cars[id], o = this.offset(c), f = V.footprint(c, o), d = DIRS[c.dir];
          this.parts.push({ x: (f.x0 + f.x1) / 2 - d[0] * (c.len / 2 + 0.1), y: (f.y0 + f.y1) / 2 - d[1] * (c.len / 2 + 0.1), z: 0.25, vx: -d[0] * 0.4, vy: -d[1] * 0.4, vz: 0.5, life: 0.7, max: 0.7, color: '#9aa0a8', r: 0.08, puff: true });
        }
        if (a.t >= 1) this.anims.delete(id);
      }
      for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= (p.puff ? -0.3 : 5) * dt; if (p.z < 0.12) { p.z = 0.12; p.vz *= -0.4; } p.life -= dt; if (p.puff) p.r += dt * 0.15; }
      this.parts = this.parts.filter((p) => p.life > 0);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
      this.hintT += dt;
      if (this.pending) { this.endT += dt; if (this.endT > (this.pending.won ? 1.2 : 0.9)) this.showResult(); }
    },

    layout(repaint) {
      const W = this.W, H = this.H;
      if (!W || !this.g) return;
      V.layout(W, H, this.g.n);
      if (repaint) V.paintBackground($('#bg'), W, H, this.dpr, this.lot, R.rng(R.hash('scenery:' + this.g.n)));
    },
    resize(W, H, dpr) { this.W = W; this.H = H; this.dpr = dpr; this.layout(true); },

    render(ctx) {
      const W = this.W, H = this.H;
      ctx.clearRect(0, 0, W, H);
      if (!this.g) return;
      ctx.save();
      if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake * 22, (Math.random() - 0.5) * this.shake * 22);
      const g = this.g;
      const live = g.cars.filter((c) => !c.out || this.anims.has(c.id));
      const items = live.map((c) => {
        const o = this.offset(c), f = V.footprint(c, o);
        // cars leaving fade out once they are past the road ring
        const past = Math.max(-f.x1, -f.y1, f.x0 - g.n, f.y0 - g.n);
        const alpha = Math.max(0, Math.min(1, 1 - (past - 1.2) / 1.5));
        if (alpha <= 0) return null;
        const a = this.anims.get(c.id);
        const lights = !c.asleep && !(a && a.type === 'wake' && a.t < 0.5 && Math.floor(a.t * 12) % 2 === 0);
        return { c, o, f, alpha, lights };
      }).filter(Boolean);
      for (const it of items) V.carGround(ctx, it.c, it.o, it.alpha, it.lights);
      if (this.state === 'play' && this.showCursor) V.ring(ctx, this.cursor[0] + 0.06, this.cursor[1] + 0.06, this.cursor[0] + 0.94, this.cursor[1] + 0.94, '#ffcf1f', this.t);
      if (this.hintCar && !this.hintCar.out) { const f = V.footprint(this.hintCar, [0, 0]); V.ring(ctx, f.x0 - 0.06, f.y0 - 0.06, f.x1 + 0.06, f.y1 + 0.06, '#3bff7a', this.t); }
      // far to near; then from the outside in, so nearer boxes overlap farther ones
      items.sort((a, b) => a.f.y1 - b.f.y1 || Math.abs((b.f.x0 + b.f.x1) / 2 - g.n / 2) - Math.abs((a.f.x0 + a.f.x1) / 2 - g.n / 2));
      for (const it of items) {
        V.car(ctx, it.c, it.o, it.alpha, this.t, it.lights);
        if (it.c.asleep && it.alpha > 0.5) {
          const [zx, zy] = V.p((it.f.x0 + it.f.x1) / 2, (it.f.y0 + it.f.y1) / 2, 0.95 + Math.sin(this.t * 2) * 0.08);
          const s = V.scale((it.f.y0 + it.f.y1) / 2);
          ctx.font = `900 ${Math.round(s * 0.34)}px Overpass, sans-serif`; ctx.textAlign = 'center';
          ctx.fillStyle = '#e8f1ff'; ctx.strokeStyle = '#1d2a36'; ctx.lineWidth = 4;
          ctx.strokeText('z z', zx, zy); ctx.fillText('z z', zx, zy);
        }
      }
      // hint arrow bobbing over the suggested car
      if (this.hintCar && !this.hintCar.out) {
        const f = V.footprint(this.hintCar, [0, 0]);
        const [hx, hy] = V.p((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, 1.25 + Math.abs(Math.sin(this.hintT * 5)) * 0.25);
        ctx.fillStyle = '#3bff7a'; ctx.strokeStyle = '#0b3d1f'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(hx, hy + 16); ctx.lineTo(hx - 13, hy); ctx.lineTo(hx - 5, hy); ctx.lineTo(hx - 5, hy - 14); ctx.lineTo(hx + 5, hy - 14); ctx.lineTo(hx + 5, hy); ctx.lineTo(hx + 13, hy); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      for (const p of this.parts) {
        const [x, y] = V.p(p.x, p.y, p.z), s = V.scale(p.y);
        ctx.globalAlpha = Math.max(0, p.life / p.max) * (p.puff ? 0.35 : 1);
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(x, y, Math.max(1, s * p.r), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },
  };
  LJ.Game = G;
})();
