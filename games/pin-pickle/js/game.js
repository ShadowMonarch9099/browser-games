// Pin Pickle game flow: camp (title), the treasure map, digging a cave,
// hints and skips, and the result. The cave itself is painted by cave.js;
// this file draws the pins, the cart and the explorer on top.
(function () {
  const Sim = window.PinSim, LEVELS = window.PinLevels, C = PP.Cave, A = PP.Audio, I = PP.Input, M = PP.Menus;
  const $ = (id) => document.getElementById(id);
  const STEP = 1 / 120; // two simulation steps per 60 Hz frame, as the first version ran

  const G = {
    state: 'title', from: 'title', data: null, n: 1, sim: null, cv: null, v: null, acc: 0, time: 0, endT: 0, pulls: 0, hints: 0, sel: 0,
    hintPin: 0, hintT: 0, parts: [], lastGold: 0, coinT: 0, steamT: 0, cheer: 0, gasp: 0, shake: 0, muted: false, resetArm: false,

    init(canvas) {
      this.canvas = canvas;
      this.data = PP.Save.load();
      M.init((a, arg) => this.act(a, arg));
      this.buildSettings(); this.apply();
      this.demo();
      this.showTitle();
    },
    save() { PP.Save.store(this.data); },
    get settings() { return this.data.settings; },
    apply() {
      const s = this.settings;
      A.setVolumes(this.muted ? 0 : s.sfx, this.muted ? 0 : s.music);
      document.body.classList.toggle('reduced', !s.motion);
      this.save();
    },
    buildSettings() {
      const s = this.settings, ch = (k) => (v) => { s[k] = v; this.apply(); };
      const fs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
      M.renderSettings([
        { key: 'sfx', label: 'Sound effects', type: 'slider', get: () => s.sfx, set: ch('sfx') },
        { key: 'music', label: 'Cave music', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'shake', label: 'Screen shake', type: 'toggle', get: () => s.shake, set: ch('shake') },
        { key: 'motion', label: 'Motion and sparkle', note: 'Turn off for calmer animation', type: 'toggle', get: () => s.motion, set: ch('motion') },
        { key: 'hints', label: 'Offer hints', note: 'After a couple of tries', type: 'toggle', get: () => s.hints, set: ch('hints') },
        { key: 'fs', label: 'Fullscreen', type: 'action', text: () => (fs() ? 'On' : 'Off'), run: () => { this.fullscreen(); setTimeout(() => M.paintSettings(), 300); } },
        { key: 'reset', label: 'Reset progress', type: 'action', labelFn: () => (this.resetArm ? 'Press again to burn the map' : 'Reset progress'), text: () => '', run: () => {
          if (!this.resetArm) { this.resetArm = true; A.play('deny'); return; }
          this.resetArm = false; const keep = this.data.settings; this.data = PP.Save.defaults(); this.data.settings = keep; this.save(); A.play('burn'); M.toast('A fresh map');
        } },
      ]);
    },
    fullscreen() {
      const d = document, el = d.documentElement;
      try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { M.toast('No fullscreen here'); }
    },
    resize(W, H) { this.W = W; this.H = H; PP.W = W; PP.H = H; if (this.sim) this.fit(); },
    fit() {
      const top = this.state === 'title' ? 20 : this.W < 600 ? 92 : 80, bottom = this.state === 'title' ? 20 : 64;
      const px = Math.min((this.W - 20) / this.sim.w, (this.H - top - bottom) / this.sim.h);
      this.v = { px, x: (this.W - this.sim.w * px) / 2, y: top + (this.H - top - bottom - this.sim.h * px) / 2 };
    },
    total() { return Object.values(this.data.done).reduce((a, d) => a + (d && !d.skipped ? d.stars || 1 : 0), 0); },

    // ---------- caves ----------
    open(n) {
      this.n = n;
      const def = LEVELS[n - 1];
      this.sim = Sim.create(def);
      this.cv = C.setup(this.sim);
      this.acc = 0; this.endT = 0; this.pulls = 0; this.hints = 0; this.hintPin = 0; this.hintT = 0; this.sel = 0; this.parts = []; this.lastGold = 0; this.cheer = 0; this.gasp = 0;
      this.fit();
    },
    // behind the title, cave 1 lit by torches, its pin still in
    demo() { this.state = 'title'; this.open(Math.min(this.data.unlocked, LEVELS.length)); A.setMode('map', 1); },
    showTitle() {
      const n = Math.min(this.data.unlocked, LEVELS.length), fresh = n === 1 && !Object.keys(this.data.done).length;
      $('t-go').textContent = fresh ? 'Start digging' : 'Keep digging';
      $('t-go-note').textContent = `Cave ${n}: ${LEVELS[n - 1].name}`;
      $('t-nuggets').textContent = `${this.total()} of ${LEVELS.length * 3} nuggets`;
      M.show('title');
    },
    start(n) {
      A.play('select');
      M.fade(true);
      setTimeout(() => {
        this.state = 'play';
        this.open(n);
        const def = LEVELS[n - 1];
        $('h-num').textContent = n; $('h-name').textContent = def.name; $('h-tip').textContent = def.tip || '';
        $('hud').classList.remove('off');
        this.paintMeter();
        A.setMode('cave', n);
        M.show(null); M.fade(false);
      }, this.settings.motion ? 300 : 0);
    },
    quit() { M.fade(true); setTimeout(() => { $('hud').classList.add('off'); this.demo(); this.fit(); this.showTitle(); M.fade(false); }, this.settings.motion ? 300 : 0); },
    pause() { if (this.state !== 'play') return; this.state = 'paused'; A.play('back'); $('hud').classList.add('off'); M.show('pause', true); },
    resume() { if (this.state !== 'paused') return; this.state = 'play'; A.play('select'); $('hud').classList.remove('off'); M.show(null); },
    openMap() {
      this.from = this.state === 'paused' ? 'pause' : this.state === 'result' ? 'result' : 'title';
      M.renderLevels({ levels: LEVELS.length, unlocked: Math.min(this.data.unlocked, LEVELS.length), done: this.data.done, total: this.total(), current: this.state === 'title' ? this.data.unlocked : this.n, names: LEVELS.map((l) => l.name) });
      A.play('page');
      M.show('levels', true);
    },
    act(a, arg) {
      switch (a) {
        case 'continue': return this.start(Math.min(this.data.unlocked, LEVELS.length));
        case 'levels': return this.openMap();
        case 'play-level': return this.start(arg);
        case 'how': this.from = this.state === 'paused' ? 'pause' : 'title'; A.play('page'); return M.show('how', true);
        case 'settings': this.from = this.state === 'paused' ? 'pause' : 'title'; this.resetArm = false; this.buildSettings(); A.play('page'); return M.show('settings', true);
        case 'back': A.play('back'); if (this.from === 'title') return this.showTitle(); return M.show(this.from, true);
        case 'pause': return this.pause();
        case 'resume': return this.resume();
        case 'restart': if (this.state === 'play' && this.pulls === 0) return; return this.start(this.n);
        case 'next': return this.start(Math.min(LEVELS.length, this.n + 1));
        case 'skip': return this.skip();
        case 'hint-retry': this.wantHint = true; return this.start(this.n);
        case 'hint': return this.hint();
        case 'quit': A.play('back'); return this.quit();
      }
    },
    pull(p) {
      if (this.state !== 'play' || p.state !== 'in') return;
      Sim.pull(this.sim, p.id);
      p.state = 'out'; p.t = 0;
      this.pulls++;
      if (this.hintPin === p.id) { this.hintPin = 0; this.hintT = 0; }
      A.play('pull');
    },
    hint() {
      if (this.state !== 'play') return;
      const def = LEVELS[this.n - 1], next = [...String(def.solution || '')].map(Number).find((id) => this.sim.pins.includes(id));
      this.hints++;
      A.play('hint');
      if (!next) { M.toast('No pins left to pull. Watch it settle'); return; }
      const order = [...String(def.solution)].map(Number), done = order.slice(0, order.indexOf(next));
      if (done.some((id) => this.sim.pins.includes(id)) || this.cv.pins.some((p) => p.state !== 'in' && !order.includes(p.id))) M.toast('This dig has gone astray. Start over?');
      else M.toast(`Try pin ${next}`);
      this.hintPin = next; this.hintT = 5;
    },
    skip() {
      const n = this.n;
      this.data.done[n] = this.data.done[n] || { skipped: true, pct: 0, pulls: 0, stars: 0 };
      this.data.unlocked = Math.max(this.data.unlocked, Math.min(LEVELS.length, n + 1));
      this.save();
      A.play('page');
      this.start(Math.min(LEVELS.length, n + 1));
    },
    finish(won) {
      const n = this.n, s = this.sim, pct = Math.round((s.collected / s.gold) * 100), fails = this.data.fails[n] || 0;
      this.state = 'result';
      $('hud').classList.add('off');
      const btns = [];
      if (won) {
        const stars = this.hints ? 1 : fails ? 2 : 3, prev = this.data.done[n];
        this.data.done[n] = { pct: Math.max(pct, prev && !prev.skipped ? prev.pct : 0), pulls: prev && prev.pulls && !prev.skipped ? Math.min(prev.pulls, this.pulls) : this.pulls, stars: Math.max(stars, prev && prev.stars ? prev.stars : 0) };
        this.data.unlocked = Math.max(this.data.unlocked, Math.min(LEVELS.length, n + 1));
        delete this.data.fails[n];
        const last = n === LEVELS.length;
        $('r-kicker').textContent = `Cave ${n} · ${LEVELS[n - 1].name}`;
        $('r-title').textContent = last ? 'Every vault emptied!' : pct >= 97 ? 'Not a flake wasted!' : 'Struck gold!';
        [...$('r-nuggets').children].forEach((el, i) => el.classList.toggle('on', i < stars));
        $('r-note').textContent = `${pct}% of the gold in the cart · ${this.pulls} pin${this.pulls === 1 ? '' : 's'} pulled${this.hints ? ' · with a hint' : fails ? '' : ' · first try'}`;
        if (!last) btns.push(['ruby', 'next', 'Next cave']);
        btns.push(['', 'restart', 'Dig it again'], ['', 'levels', 'The map']);
      } else {
        this.data.fails[n] = fails + 1;
        $('r-kicker').textContent = `Cave ${n} · try ${fails + 1}`;
        $('r-title').textContent = s.dead ? 'Lava in the cart!' : 'The gold melted';
        [...$('r-nuggets').children].forEach((el) => el.classList.remove('on'));
        $('r-note').textContent = s.dead ? 'The explorer jumped clear, but the cart is toast.' : `Only ${Math.max(0, Math.round(((s.gold - s.lost) / s.gold) * 100))}% of the gold is left. You need 80%.`;
        btns.push(['ruby', 'restart', 'Try again']);
        if (this.settings.hints && fails + 1 >= 2) btns.push(['', 'hint-retry', 'Try again, with a hint']);
        if (fails + 1 >= 3 && n < LEVELS.length) btns.push(['', 'skip', 'Skip this cave']);
        btns.push(['', 'levels', 'The map']);
      }
      this.save();
      $('r-buttons').innerHTML = btns.map(([c, a, l]) => `<button class="btn slim ${c}" data-nav data-act="${a}"><b>${l}</b></button>`).join('');
      M.show('result', true);
    },

    // ---------- input ----------
    pinAt(x, y) {
      const v = this.v; if (!v) return null;
      const cx = (x - v.x) / v.px, cy = (y - v.y) / v.px, pad = 4;
      return this.cv.pins.filter((p) => p.state === 'in' && cx > p.x0 - pad && cx < p.x1 + pad && cy > p.y0 - pad && cy < p.y1 + pad)
        .sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - cx, (a.y0 + a.y1) / 2 - cy) - Math.hypot((b.x0 + b.x1) / 2 - cx, (b.y0 + b.y1) / 2 - cy))[0] || null;
    },
    input() {
      I.poll();
      document.body.dataset.device = I.device;
      if (I.key('KeyM')) { this.muted = !this.muted; this.apply(); M.toast(this.muted ? 'Sound off' : 'Sound on'); }
      if (this.state === 'play') {
        if (I.nav('pause') || I.nav('back')) return this.pause();
        for (const c of I.clicks) { const p = this.pinAt(c.x, c.y); if (p) this.pull(p); }
        const d = I.digit(); if (d) { const p = this.cv.pins.find((q) => q.id === d && q.state === 'in'); if (p) this.pull(p); else A.play('deny'); }
        if (I.nav('restart')) this.act('restart');
        if (I.key('KeyH') || I.key('Pad2')) this.hint();
        const live = this.cv.pins.filter((p) => p.state === 'in');
        if (live.length && (I.nav('left') || I.nav('right') || I.nav('up') || I.nav('down'))) { this.sel = (this.sel + (I.nav('left') || I.nav('up') ? -1 : 1) + live.length) % live.length; A.play('tug'); this.selShow = 3; }
        if (live.length && this.selShow > 0 && (I.key('Enter') || I.key('Space') || I.key('Pad0'))) this.pull(live[this.sel % live.length]);
        return;
      }
      if (this.state === 'won' || this.state === 'lost') return;
      const cur = M.current && M.current.id;
      if (I.nav('back') || I.key('KeyP') || I.key('Pad9')) {
        if (cur === 's-pause') this.resume();
        else if (['s-settings', 's-how', 's-levels'].includes(cur)) this.act('back');
        return;
      }
      if (I.nav('confirm')) M.confirm();
      else for (const dir of ['up', 'down', 'left', 'right']) if (I.nav(dir)) M.nav(dir);
    },

    // ---------- time ----------
    update(dt) {
      this.input();
      I.endTick();
      this.time += dt;
      this.hintT = Math.max(0, this.hintT - dt); this.selShow = Math.max(0, (this.selShow || 0) - dt);
      this.cheer = Math.max(0, this.cheer - dt); this.gasp = Math.max(0, this.gasp - dt); this.shake = Math.max(0, this.shake - dt * 2.5);
      this.coinT -= dt; this.steamT -= dt;
      if (this.wantHint && this.state === 'play') { this.wantHint = false; this.hint(); }
      for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; }
      this.parts = this.parts.filter((p) => p.life > 0);
      A.update();
      if (!this.sim) return;
      for (const p of this.cv.pins) if (p.state === 'out') {
        p.t += dt;
        if (p.t < 0.22) p.off = (p.t / 0.22) * 10;
        else { p.off += dt * 30; p.vy += dt * 120; p.fall += p.vy * dt; p.rot += dt * 5 * (p.side || 1); if (p.fall > 200) p.state = 'gone'; }
      }
      if (this.state !== 'play' && this.state !== 'won' && this.state !== 'lost') return;
      this.acc = Math.min(this.acc + dt, 0.1);
      while (this.acc >= STEP) {
        this.acc -= STEP;
        if (!this.sim.dead) Sim.step(this.sim);
        if (this.state === 'play') {
          if (Sim.won(this.sim)) { this.state = 'won'; this.endT = 0; A.play('win'); this.cheer = 3; this.confetti(); }
          else if (Sim.failed(this.sim)) { this.state = 'lost'; this.endT = 0; A.play(this.sim.dead ? 'burn' : 'lose'); this.gasp = 3; if (this.settings.shake) this.shake = 0.8; }
        }
      }
      const out = C.diff(this.cv, this.sim);
      A.danger = this.cv.danger;
      if (this.cv.danger > 0.6 && this.gasp <= 0 && this.state === 'play') this.gasp = 0.6;
      if (out.steam.length && this.steamT <= 0) { this.steamT = 0.25; A.play('hiss', { vol: Math.min(1, out.steam.length / 20 + 0.3) }); this.puff(out.steam, '#e8eef5', 6); }
      if (out.melt.length && this.steamT <= 0) { this.steamT = 0.2; A.play('sizzle'); this.puff(out.melt, '#5a5560', 4); }
      const got = this.sim.collected;
      if (got > this.lastGold) { if (this.coinT <= 0) { this.coinT = 0.06; A.play('coin', { vol: 0.7 }); } this.cheer = Math.max(this.cheer, 0.4); this.paintMeter(); }
      this.lastGold = got;
      if (this.state === 'won' || this.state === 'lost') { this.endT += dt; if (this.endT > 1.6) this.finish(this.state === 'won'); }
    },
    paintMeter() {
      const s = this.sim, f = Math.min(1, s.collected / s.gold);
      $('h-gold').style.width = f * 100 + '%';
      $('h-pct').textContent = Math.round(f * 100) + '%';
    },
    puff(cells, col, n) {
      if (!this.settings.motion) n = 1;
      const v = this.v, w = this.sim.w;
      for (let k = 0; k < Math.min(n, cells.length); k++) {
        const i = cells[Math.floor(Math.random() * cells.length)];
        this.parts.push({ x: v.x + ((i % w) + 0.5) * v.px, y: v.y + (((i / w) | 0) + 0.5) * v.px, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 40, life: 0.8 + Math.random() * 0.6, r: v.px * (1.5 + Math.random() * 2), col, fade: true });
      }
    },
    confetti() {
      const v = this.v, c = this.cv.cart, x = v.x + ((c.x0 + c.x1) / 2) * v.px, y = v.y + c.y0 * v.px, n = this.settings.motion ? 50 : 10;
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2, s = 150 + Math.random() * 300; this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 500, life: 1.2 + Math.random(), r: 3 + Math.random() * 3, col: Math.random() < 0.7 ? '#ffcf3f' : '#fff2a8', coin: true }); }
    },

    // ---------- drawing ----------
    render(ctx) {
      const W = this.W, H = this.H;
      const bg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, Math.max(W, H) * 0.7);
      bg.addColorStop(0, '#2c1d3a'); bg.addColorStop(1, '#0d0814');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      if (!this.sim) return;
      const v = this.v, t = this.time;
      ctx.save();
      if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake * 14, (Math.random() - 0.5) * this.shake * 14);
      const c = this.cv.cart, lamp = { x: c.x1 + 2, y: c.y0 - 3 };
      C.draw(ctx, this.cv, this.sim, v, t, { lamp, under: () => this.cart(ctx) });
      this.explorer(ctx);
      for (const p of this.cv.pins) this.pin(ctx, p);
      for (const p of this.parts) {
        ctx.globalAlpha = Math.min(1, p.life) * (p.fade ? 0.5 : 1); ctx.fillStyle = p.col;
        if (p.coin) { ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * Math.abs(Math.cos(t * 10 + p.x)), 0, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - Math.min(1, p.life) * 0.6), 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },
    // the mine cart: planks, iron bands, wheels on a rail, and a heap of gold that grows
    cart(ctx) {
      const v = this.v, c = this.cv.cart, s = this.sim, px = v.px;
      const x0 = v.x + c.x0 * px, x1 = v.x + c.x1 * px, y0 = v.y + c.y0 * px, y1 = v.y + c.y1 * px, w = x1 - x0, h = y1 - y0;
      ctx.fillStyle = '#3a2a20'; ctx.fillRect(x0 - px * 2, y1 + px * 0.2, w + px * 4, px * 0.6);
      const f = Math.min(1, s.collected / s.need);
      // the heap inside, drawn first so the front planks overlap it
      if (f > 0.02) {
        const heapTop = y0 + h * 0.15 - f * h * 0.25;
        ctx.fillStyle = '#e0a800';
        ctx.beginPath(); ctx.moveTo(x0 + px, y0 + h * 0.35); ctx.quadraticCurveTo(x0 + w / 2, heapTop - h * 0.15 * f, x1 - px, y0 + h * 0.35); ctx.closePath(); ctx.fill();
        for (const n of this.cv.nuggets.slice(0, Math.round(f * 40))) {
          const nx = x0 + px + n.u * (w - px * 2), ny = y0 + h * 0.35 - n.v * (y0 + h * 0.35 - heapTop) * (1 - Math.abs(n.u - 0.5) * 1.4);
          ctx.fillStyle = n.s > 0.7 ? '#fff2a8' : '#ffcf3f'; ctx.beginPath(); ctx.arc(nx, ny, px * n.r * 0.9, 0, Math.PI * 2); ctx.fill();
        }
      }
      const body = ctx.createLinearGradient(0, y0, 0, y1);
      body.addColorStop(0, this.sim.dead ? '#2a1d14' : '#9a6a3a'); body.addColorStop(1, this.sim.dead ? '#140c08' : '#6a4424');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.moveTo(x0 - px * 0.6, y0 + h * 0.3); ctx.lineTo(x1 + px * 0.6, y0 + h * 0.3); ctx.lineTo(x1 - px * 0.4, y1); ctx.lineTo(x0 + px * 0.4, y1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = Math.max(1.5, px * 0.35); ctx.stroke();
      ctx.strokeStyle = '#7d7f88'; ctx.lineWidth = Math.max(2, px * 0.5);
      for (const k of [0.15, 0.85]) { ctx.beginPath(); ctx.moveTo(x0 + w * k, y0 + h * 0.32); ctx.lineTo(x0 + w * k + (k < 0.5 ? px * 0.3 : -px * 0.3), y1 - px * 0.2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(x0, y0 + h * 0.62); ctx.lineTo(x1, y0 + h * 0.62); ctx.stroke();
      ctx.fillStyle = '#2b2b30';
      for (const k of [0.22, 0.78]) { ctx.beginPath(); ctx.arc(x0 + w * k, y1 + px * 0.1, px * 1.1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#8b8d96'; ctx.beginPath(); ctx.arc(x0 + w * k, y1 + px * 0.1, px * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#2b2b30'; }
    },
    // the explorer beside the cart: cheers when gold lands, flinches when lava nears
    explorer(ctx) {
      const v = this.v, c = this.cv.cart, px = v.px, t = this.time;
      let x = v.x + (c.x1 + 2.2) * px, y = v.y + c.y1 * px;
      if (x > v.x + (this.sim.w - 1) * px) x = v.x + (c.x0 - 2.2) * px;
      const s = px * 1.15, jump = this.cheer > 0 && this.settings.motion ? Math.abs(Math.sin(t * 12)) * s * 0.8 : 0, lean = this.gasp > 0 ? -0.25 : 0;
      ctx.save(); ctx.translate(x, y - jump); ctx.rotate(lean);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, jump, s * 1.6, s * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = s * 0.55; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 2); ctx.lineTo(-s * 0.5, 0); ctx.moveTo(s * 0.4, -s * 2); ctx.lineTo(s * 0.5, 0); ctx.stroke();
      ctx.fillStyle = '#c47a34'; ctx.beginPath(); ctx.roundRect(-s * 0.9, -s * 4.2, s * 1.8, s * 2.4, s * 0.5); ctx.fill();
      ctx.strokeStyle = '#c47a34'; ctx.lineWidth = s * 0.5;
      const arm = this.cheer > 0.3 || this.gasp > 0 ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(-s * 0.8, -s * 3.8); ctx.lineTo(-s * 1.5, -s * (3.8 + arm * 1.1)); ctx.moveTo(s * 0.8, -s * 3.8); ctx.lineTo(s * 1.5, -s * (3.8 + arm * 1.1)); ctx.stroke();
      ctx.fillStyle = '#f1c79a'; ctx.beginPath(); ctx.arc(0, -s * 5, s * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a2412';
      if (this.gasp > 0) { ctx.beginPath(); ctx.arc(s * 0.15, -s * 4.7, s * 0.22, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.ellipse(0, -s * 5.6, s * 1.5, s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -s * 5.9, s * 0.85, s * 0.6, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(0, -s * 6, s * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
    // a steel pin: a rod through the rock with a numbered ring; pulled pins slide out and drop
    pin(ctx, p) {
      if (p.state === 'gone') return;
      const v = this.v, px = v.px, horiz = p.horiz;
      const bw = (p.x1 - p.x0) * px, bh = (p.y1 - p.y0) * px, thick = Math.min(bw, bh);
      let bx = v.x + p.x0 * px, by = v.y + p.y0 * px;
      if (p.state === 'out') { if (horiz) bx += p.side * p.off * px; else by -= p.off * px; by += p.fall; }
      ctx.save();
      if (p.state === 'out') { ctx.globalAlpha = Math.max(0, 1 - p.fall / 200); ctx.translate(bx + bw / 2, by + bh / 2); ctx.rotate(p.rot * 0.3); ctx.translate(-bx - bw / 2, -by - bh / 2); }
      const hint = this.hintPin === p.id && this.hintT > 0, sel = this.selShow > 0 && this.cv.pins.filter((q) => q.state === 'in')[this.sel % Math.max(1, this.cv.pins.filter((q) => q.state === 'in').length)] === p;
      if ((hint || sel) && p.state === 'in') { ctx.shadowColor = '#ffcf3f'; ctx.shadowBlur = 14 + Math.sin(this.time * 8) * 6; }
      const rod = horiz ? ctx.createLinearGradient(0, by, 0, by + thick) : ctx.createLinearGradient(bx, 0, bx + thick, 0);
      rod.addColorStop(0, '#f2f5fa'); rod.addColorStop(0.45, '#aab3c2'); rod.addColorStop(1, '#5d6676');
      ctx.fillStyle = rod; ctx.strokeStyle = '#1e1628'; ctx.lineWidth = Math.max(1.5, px * 0.35);
      ctx.beginPath();
      if (horiz) ctx.roundRect(bx, by + thick * 0.18, bw, thick * 0.64, thick * 0.32);
      else ctx.roundRect(bx + thick * 0.18, by, thick * 0.64, bh, thick * 0.32);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      const rx = horiz ? (p.side > 0 ? bx + bw : bx) : bx + thick / 2, ry = horiz ? by + thick / 2 : by;
      const ring = ctx.createRadialGradient(rx - thick * 0.3, ry - thick * 0.3, 0, rx, ry, thick);
      ring.addColorStop(0, '#e0483d'); ring.addColorStop(1, '#7a1410');
      ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(rx, ry, thick * 0.9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fdf3dc'; ctx.font = `${Math.round(thick * 1.2)}px 'Pirata One', Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.id, rx, ry + thick * 0.06);
      ctx.restore();
    },
  };
  PP.Game = G;
})();
