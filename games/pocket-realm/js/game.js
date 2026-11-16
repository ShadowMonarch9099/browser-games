// Pocket Realm game flow: choosing a hero, laying lands on the table, walking,
// shops, duels and the end of the tale. The canvas uses a fixed logical size
// (landscape 960x540 or portrait 540x960) scaled to fit the screen.
(function () {
  const R = window.Realm, B = PR.Board, P = PR.Panel, M = PR.Menus, A = PR.Audio, S = PR.Save, U = PR.U, G2 = PR.G, COL = PR.COL;
  const $ = (id) => document.getElementById(id);
  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', KeyP: 'pause', KeyM: 'mute',
    Digit1: 'n1', Digit2: 'n2', Digit3: 'n3', Digit4: 'n4', Numpad1: 'n1', Numpad2: 'n2', Numpad3: 'n3', Numpad4: 'n4', KeyQ: 'prev', KeyE: 'next',
  };
  const PAD = { 0: 'confirm', 1: 'back', 2: 'n2', 3: 'n3', 4: 'prev', 5: 'next', 9: 'pause', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

  const G = {
    state: 'title', from: 'title', settings: null, run: null, mode: 'calm', pick: 0, daily: false, time: 0, events: [], padPrev: {}, padDir: null,
    W: 1, H: 1, L: PR.layout(false), scale: 1, ox: 0, oy: 0, mouse: null, hover: null, cursor: null, spots: [], walks: [],
    hero: { fx: 0, fy: 0, t: 1 }, pops: [], stage: null, busy: false, slain: 0, hpFlash: 0, goldFlash: 0, muted: false, device: 'mouse', demoT: 0,

    init(canvas) {
      this.canvas = canvas;
      this.settings = S.settings();
      M.init((a) => this.act(a));
      this.buildSettings(); this.apply();
      this.bind(canvas);
      this.startDemo();
      this.showTitle();
    },
    apply() {
      const s = this.settings;
      A.setVolumes(this.muted ? 0 : s.sfx, this.muted ? 0 : s.music);
      document.body.classList.toggle('reduced', !!s.reduced);
      S.storeSettings(s);
    },
    buildSettings() {
      const s = this.settings, ch = (k) => (v) => { s[k] = v; this.apply(); };
      const fs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
      M.renderSettings([
        { key: 'sfx', label: 'Sound effects', type: 'slider', get: () => s.sfx, set: ch('sfx') },
        { key: 'music', label: 'Lute and drum', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'speed', label: 'Pace', note: 'How quickly lands rise and heroes walk', type: 'action', text: () => (s.speed > 1 ? 'Brisk' : 'Stately'), run: () => { s.speed = s.speed > 1 ? 1 : 2; this.apply(); } },
        { key: 'hints', label: 'Land notes', note: 'Show what each land holds', type: 'toggle', get: () => s.hints, set: ch('hints') },
        { key: 'reduced', label: 'Reduced motion', type: 'toggle', get: () => s.reduced, set: ch('reduced') },
        { key: 'fs', label: 'Fullscreen', type: 'action', text: () => (fs() ? 'On' : 'Off'), run: () => { this.fullscreen(); setTimeout(() => M.paintSettings(), 300); } },
      ]);
    },
    fullscreen() {
      const d = document, el = d.documentElement;
      try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { M.toast('No fullscreen here'); }
    },
    resize(W, H) {
      this.W = W; this.H = H;
      this.L = PR.layout(H > W * 1.1);
      PR.L = this.L;
      this.scale = Math.min(W / this.L.W, H / this.L.H);
      this.ox = (W - this.L.W * this.scale) / 2; this.oy = (H - this.L.H * this.scale) / 2;
    },
    toLogical(cx, cy) { return [(cx - this.ox) / this.scale, (cy - this.oy) / this.scale]; },

    // ---------- runs ----------
    showTitle() {
      const r = S.record();
      $('t-record').textContent = r.wins ? `Dragons slain: ${r.wins} · realms walked: ${r.runs} · foes defeated: ${r.slain}` : r.runs ? `Realms walked: ${r.runs}. The dragon still lives.` : 'No dragons slain yet.';
      $('t-daily').querySelector('b').textContent = `Today's realm: ${this.daily ? 'on' : 'off'}`;
      M.show('title');
    },
    startDemo() {
      this.run = R.newRun(U.strHash(String(Math.random())), 'knight');
      this.mode = 'demo'; this.demoT = 0; this.stage = null;
      this.hero = { fx: this.run.x, fy: this.run.y, t: 1 };
    },
    start(cls) {
      A.play('confirm');
      M.fade(true);
      setTimeout(() => {
        const seed = this.daily ? U.strHash('pocket-realm:' + U.today()) : U.strHash(String(Math.random()) + Date.now());
        this.run = R.newRun(seed, cls);
        this.run.board[this.run.y][this.run.x].born = this.time;
        this.mode = 'calm'; this.pick = 0; this.slain = 0; this.keepWarned = false; this.stage = null; this.pops = []; this.busy = false;
        this.hero = { fx: this.run.x, fy: this.run.y, t: 1 };
        this.state = 'play';
        this.refresh();
        M.show(null); M.fade(false);
        $('pause-btn').classList.remove('off');
        M.toast(this.daily ? "Today's realm: the same lands for everyone" : 'Your tale begins');
      }, this.settings.reduced ? 0 : 320);
    },
    quit() {
      M.fade(true);
      setTimeout(() => { this.state = 'title'; $('pause-btn').classList.add('off'); this.startDemo(); this.showTitle(); M.fade(false); }, this.settings.reduced ? 0 : 320);
    },
    pause() { if (this.state !== 'play') return; this.state = 'paused'; A.play('back'); $('pause-btn').classList.add('off'); M.show('pause', true); },
    resume() { if (this.state !== 'paused') return; this.state = 'play'; A.play('confirm'); $('pause-btn').classList.remove('off'); M.show(null); },
    act(a) {
      if (a && a.startsWith('hero-')) return this.start(a.slice(5));
      switch (a) {
        case 'daily': this.daily = !this.daily; A.play('move'); $('t-daily').querySelector('b').textContent = `Today's realm: ${this.daily ? 'on' : 'off'}`; return;
        case 'how': this.from = this.state === 'paused' ? 'pause' : 'title'; A.play('confirm'); return M.show('how', true);
        case 'settings': this.from = this.state === 'paused' ? 'pause' : 'title'; this.buildSettings(); A.play('confirm'); return M.show('settings', true);
        case 'back': A.play('back'); if (this.from === 'title') return this.showTitle(); return M.show(this.from, true);
        case 'pause': return this.pause();
        case 'resume': return this.resume();
        case 'quit': A.play('back'); return this.quit();
        case 'again': A.play('confirm'); this.state = 'title'; this.startDemo(); return this.showTitle();
      }
    },

    // ---------- moves ----------
    refresh() {
      const run = this.run;
      this.spots = this.mode === 'fight' || this.mode === 'shop' ? [] : R.freeSpots(run);
      this.walks = this.mode === 'fight' || this.mode === 'shop' || this.spots.length ? [] : R.walkSpots(run);
      const targets = this.spots.length ? this.spots : this.walks;
      if (!this.cursor || !targets.some(([x, y]) => x === this.cursor[0] && y === this.cursor[1])) this.cursor = targets[0] ? targets[0].slice() : null;
      A.fight = this.mode === 'fight';
      if (this.state === 'play' && run.offer.length === 1 && !this.keepWarned) { this.keepWarned = true; M.toast("The Dragon's Keep has appeared"); A.play('roar'); }
    },
    snapshot() { const h = this.run.hero; return { hp: h.hp, gold: h.gold, lvl: h.lvl, potions: h.potions, herbs: h.herbs, fhp: this.run.fight ? this.run.fight.hp : 0, log: this.run.log.length }; },
    boardPos(x, y) { return B.pos(this.L, x, y); },
    pop(x, y, text, col) { this.pops.push({ x, y, text, col, t: 0 }); },
    // show what changed: health, gold, levels, finds
    feedback(before, where) {
      const h = this.run.hero, [px, py] = where;
      const dh = h.hp - before.hp, dg = h.gold - before.gold;
      if (dh > 0) { this.pop(px, py - 30, '+' + dh, '#2f8f3a'); A.play('heal'); }
      if (dh < 0) { this.pop(px, py - 30, String(dh), COL.seal); this.hpFlash = 0.4; }
      if (dg > 0) { this.pop(px + 20, py - 50, '+' + dg + ' gold', COL.goldDark); this.goldFlash = 0.6; A.play('coin'); }
      if (h.lvl > before.lvl) { M.toast(`Level ${h.lvl}! Stronger and tougher`); A.play('level'); }
      if (h.herbs > before.herbs) this.pop(px - 20, py - 60, '+1 herb', '#3f7a2a');
      const news = this.run.log.slice(before.log);
      for (const l of news) if (/: /.test(l) && R.COMBOS.some((c) => l.startsWith(c[3]))) { M.toast(l); A.play('combo'); }
    },
    after(result, before) {
      const run = this.run;
      const [hx, hy] = this.boardPos(run.x, run.y);
      if (result === 'fight') {
        const f = run.fight, t = run.board[run.y][run.x];
        this.stage = { type: f.type, name: f.name, hp: f.hp, max: f.max, land: t.land, inT: 0, outT: 0, shake: 0, hurt: 0, heroHop: 0, result: '' };
        A.play(f.type === 'dragon' ? 'roar' : 'foe');
      }
      this.mode = result === 'won' || result === 'lost' ? this.mode : result === 'walk' ? 'calm' : result;
      this.feedback(before, this.stage && this.mode === 'fight' ? this.stagePos('hero') : [hx, hy]);
      this.refresh();
      if (result === 'won' || result === 'lost') this.finish(result);
    },
    stagePos(who) { const r = this.L.stage; return who === 'hero' ? [r.x + r.w * 0.25, r.y + r.h * 0.5] : [r.x + r.w * 0.68, r.y + r.h * 0.35]; },
    place(x, y) {
      if (this.busy || this.mode === 'fight' || this.mode === 'shop') return;
      const run = this.run, land = run.offer[Math.min(this.pick, run.offer.length - 1)];
      const before = this.snapshot();
      this.hero = { fx: run.x, fy: run.y, t: 0 };
      const result = R.place(run, land, x, y);
      run.board[y][x].born = this.time;
      A.play('place', run.placed);
      this.pick = 0;
      this.after(result, before);
    },
    walk(x, y) {
      if (this.busy || this.mode === 'fight' || this.mode === 'shop') return;
      const run = this.run, before = this.snapshot();
      this.hero = { fx: run.x, fy: run.y, t: 0 };
      A.play('walk');
      this.after(R.walk(run, x, y), before);
    },
    fight(action) {
      const run = this.run, f = run.fight; if (!f || this.busy) return;
      const before = this.snapshot(), st = this.stage;
      const result = R.round(run, action);
      const dealt = before.fhp - (run.fight ? run.fight.hp : result === 'fled' || result === 'lost' ? before.fhp : 0);
      if (st) {
        st.hp = run.fight ? run.fight.hp : result === 'fled' ? before.fhp : 0;
        if (dealt > 0) { const [fx, fy] = this.stagePos('foe'); this.pop(fx, fy, '-' + dealt, '#6a040f'); st.hurt = 0.3; A.play('clash'); }
        if (run.hero.hp < before.hp) { st.shake = 0.35; A.play('hurt'); }
        st.heroHop = 1;
      }
      if (action === 'potion') A.play('potion');
      if (result === 'fled') { A.play('flee'); if (st) { st.result = 'Escaped'; st.outT = 0.001; } }
      else if (!run.fight && result !== 'lost') { this.slain++; A.play('slay'); if (st) { st.result = 'Victory'; st.outT = 0.001; } }
      else if (result === 'lost' && st) { st.result = 'Defeat'; st.outT = 0.001; }
      this.after(result, before);
    },
    buy(item) {
      if (R.buy(this.run, item)) { A.play('buy'); const [x, y] = this.boardPos(this.run.x, this.run.y); this.pop(x, y - 40, item === 'potion' ? '+1 potion' : item === 'blade' ? '+2 attack' : '+1 armour', COL.ink); this.goldFlash = 0.4; }
      else { A.play('deny'); M.toast('Not enough gold'); }
    },
    finish(result) {
      this.busy = true;
      const won = result === 'won';
      const rec = S.finish(won, this.run.placed, this.slain, this.daily);
      setTimeout(() => {
        A.play(won ? 'win' : 'lose');
        this.state = 'over'; A.fight = false;
        $('pause-btn').classList.add('off');
        const h = this.run.hero;
        $('r-kicker').textContent = won ? 'And so it ended' : 'Here the tale ends';
        $('r-title').textContent = won ? 'The realm is saved' : 'Your story ends here';
        $('r-line').textContent = won ? `The dragon fell to a level ${h.lvl} ${R.CLASSES[this.run.cls].name.toLowerCase()}.` : `Fallen after ${this.run.placed} lands.`;
        $('r-stats').innerHTML = [[R.CLASSES[this.run.cls].name, `level ${h.lvl}`], [this.run.placed, 'lands placed'], [this.slain, 'foes defeated'], [rec.wins, 'dragons slain in all']].map(([b, s]) => `<div><b>${b}</b><small>${s}</small></div>`).join('');
        if (this.daily) $('r-line').textContent += " That was today's realm.";
        M.show('result', true);
        this.busy = false;
      }, won ? 1600 : 1300);
    },

    // ---------- input ----------
    bind(canvas) {
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        A.unlock();
        const a = KEYS[e.code]; if (!a) return;
        e.preventDefault(); this.setDevice('keyboard');
        if (!e.repeat || ['up', 'down', 'left', 'right'].includes(a)) this.events.push(a);
      });
      canvas.addEventListener('pointermove', (e) => { this.mouse = this.toLogical(e.clientX, e.clientY); if (e.pointerType === 'mouse') this.setDevice('mouse'); });
      canvas.addEventListener('pointerleave', () => { this.mouse = null; });
      canvas.addEventListener('pointerdown', (e) => {
        A.unlock(); this.setDevice(e.pointerType === 'mouse' ? 'mouse' : 'touch');
        this.mouse = this.toLogical(e.clientX, e.clientY);
        if (this.state !== 'play') return;
        const [x, y] = this.mouse;
        const b = P.buttons.find((q) => x > q.x && x < q.x + q.w && y > q.y && y < q.y + q.h);
        if (b) { this.press(b); return; }
        const c = B.cellAt(this.L, x, y);
        if (c) this.target(c[0], c[1]);
      });
      addEventListener('gamepadconnected', () => this.setDevice('gamepad'));
    },
    setDevice(d) { if (d !== this.device) { this.device = d; document.body.dataset.device = d; } },
    press(b) {
      if (!b.enabled) { A.play('deny'); return; }
      if (b.act === 'pick') { if (this.pick !== b.arg) { this.pick = b.arg; A.play('pick', b.arg); } return; }
      if (b.act === 'fight') return this.fight(b.arg);
      if (b.act === 'buy') return this.buy(b.arg);
      if (b.act === 'leave') { A.play('back'); this.mode = 'calm'; return this.refresh(); }
    },
    target(x, y) {
      if (this.spots.some((s) => s[0] === x && s[1] === y)) return this.place(x, y);
      if (this.walks.some((s) => s[0] === x && s[1] === y)) return this.walk(x, y);
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
    // arrows move the cursor to the nearest target in that direction on screen
    moveCursor(dir) {
      const targets = this.spots.length ? this.spots : this.walks;
      if (!targets.length) return;
      if (!this.cursor) { this.cursor = targets[0].slice(); return; }
      const [cx, cy] = this.boardPos(this.cursor[0], this.cursor[1]), v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
      let best = null, bs = Infinity;
      for (const t of targets) {
        const [x, y] = this.boardPos(t[0], t[1]), dx = x - cx, dy = y - cy, along = dx * v[0] + dy * v[1];
        if (along <= 1) continue;
        const s = along + Math.abs(dx * v[1] - dy * v[0]) * 1.5;
        if (s < bs) { bs = s; best = t; }
      }
      if (best) { this.cursor = best.slice(); A.play('move'); }
    },
    handle(e) {
      if (e === 'mute') { this.muted = !this.muted; this.apply(); M.toast(this.muted ? 'Sound off' : 'Sound on'); return; }
      if (this.state === 'play') {
        if (e === 'back' || e === 'pause') return this.pause();
        if (this.busy) return;
        const num = { n1: 0, n2: 1, n3: 2, n4: 3 }[e];
        if (this.mode === 'fight') {
          const acts = ['attack', 'potion', 'herb', this.run.cls === 'mage' ? 'mend' : 'flee'];
          if (num !== undefined) { const b = P.buttons.find((q) => q.act === 'fight' && q.arg === acts[num]); if (b) this.press(b); }
          else if (e === 'confirm') this.fight('attack');
          return;
        }
        if (this.mode === 'shop') {
          if (num !== undefined && num < 3) this.buy(['potion', 'blade', 'armor'][num]);
          else if (e === 'confirm') { A.play('back'); this.mode = 'calm'; this.refresh(); }
          return;
        }
        if (num !== undefined && num < this.run.offer.length) { this.pick = num; A.play('pick', num); return; }
        if (e === 'prev' || e === 'next') { if (this.run.offer.length > 1) { this.pick = 1 - this.pick; A.play('pick', this.pick); } return; }
        if (['up', 'down', 'left', 'right'].includes(e)) return this.moveCursor(e);
        if (e === 'confirm' && this.cursor) return this.target(this.cursor[0], this.cursor[1]);
        return;
      }
      const cur = M.current && M.current.id;
      if (e === 'back' || e === 'pause') {
        if (cur === 's-pause') this.resume();
        else if (cur === 's-settings' || cur === 's-how') this.act('back');
        return;
      }
      if (e === 'confirm') M.confirm();
      else if (['up', 'down', 'left', 'right'].includes(e)) M.nav(e);
    },

    // ---------- time ----------
    update(dt) {
      this.pollPad();
      for (const e of this.events.splice(0)) this.handle(e);
      this.time += dt;
      const sp = this.settings.reduced ? 6 : this.settings.speed;
      this.hero.t = Math.min(1, this.hero.t + dt * 3.2 * sp);
      this.hpFlash = Math.max(0, this.hpFlash - dt); this.goldFlash = Math.max(0, this.goldFlash - dt);
      for (const p of this.pops) p.t += dt;
      this.pops = this.pops.filter((p) => p.t < 1.4);
      const st = this.stage;
      if (st) {
        st.inT += dt; st.shake = Math.max(0, st.shake - dt * 2); st.hurt = Math.max(0, st.hurt - dt); st.heroHop = Math.max(0, st.heroHop - dt * 4);
        if (st.outT > 0) { st.outT += dt * 0.6 * sp; if (st.outT > 0.55) this.stage = null; }
      }
      A.update(this.state === 'play');
      if (this.state === 'title' && this.mode === 'demo') this.demo(dt);
    },
    // behind the title, an unseen hand lays a realm out on the table
    demo(dt) {
      this.demoT += dt;
      if (this.demoT < 1.1) return;
      this.demoT = 0;
      const run = this.run, spots = R.freeSpots(run);
      if (run.placed > 22 || (!spots.length && !R.walkSpots(run).length)) { this.startDemo(); return; }
      if (spots.length) {
        const [x, y] = spots[Math.floor(Math.random() * spots.length)];
        this.hero = { fx: run.x, fy: run.y, t: 0 };
        R.place(run, run.offer[0], x, y); run.board[y][x].born = this.time;
      } else { const w = R.walkSpots(run), [x, y] = w[Math.floor(Math.random() * w.length)]; this.hero = { fx: run.x, fy: run.y, t: 0 }; R.walk(run, x, y); }
      run.fight = null; run.hero.hp = run.hero.max;
    },

    render(ctx, dpr) {
      const L = this.L, run = this.run;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#2f1e11'; ctx.fillRect(0, 0, this.W, this.H);
      ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, dpr * this.ox, dpr * this.oy);
      ctx.drawImage(B.table(L), 0, 0, L.W, L.H);
      if (!run) return;
      const t = this.time, sp = this.settings.reduced ? 6 : this.settings.speed;
      const playing = this.state === 'play' || this.state === 'paused' || this.state === 'over';
      // hover: which plot is under the pointer
      this.hover = this.mouse && playing ? B.cellAt(L, this.mouse[0], this.mouse[1]) : null;
      const isSpot = (x, y) => this.spots.some((s) => s[0] === x && s[1] === y);
      const isWalk = (x, y) => this.walks.some((s) => s[0] === x && s[1] === y);
      const hv = this.hover, cur = this.device !== 'mouse' && this.device !== 'touch' ? this.cursor : null;
      const focus = hv && (isSpot(hv[0], hv[1]) || isWalk(hv[0], hv[1])) ? hv : cur;
      // empty plots that can be built on glow gold
      if (playing && this.mode !== 'fight') for (const [x, y] of this.spots) {
        const [sx, sy] = B.pos(L, x, y), pulse = 0.5 + 0.5 * Math.sin(t * 4 + x + y);
        B.diamond(ctx, sx, sy, L.board.hw - 3, L.board.hh - 1.5);
        ctx.fillStyle = `rgba(212,165,49,${0.18 + pulse * 0.2})`; ctx.fill();
        ctx.strokeStyle = COL.goldDark; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
      }
      // the lands, back to front
      const SIZE = R.SIZE;
      for (let sum = 0; sum <= (SIZE - 1) * 2; sum++) for (let x = Math.max(0, sum - SIZE + 1); x <= Math.min(SIZE - 1, sum); x++) {
        const y = sum - x, tile = run.board[y][x];
        if (tile) {
          const rise = tile.born === undefined ? 1 : U.clamp01((t - tile.born) * 1.6 * sp);
          B.block(ctx, L, tile, x, y, t, rise);
        } else if (focus && focus[0] === x && focus[1] === y && playing && this.mode !== 'fight' && isSpot(x, y)) {
          // a ghost of the chosen land, showing where it will go
          const land = run.offer[Math.min(this.pick, run.offer.length - 1)];
          ctx.save(); ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 6);
          B.block(ctx, L, { land, name: '' }, x, y, t, 1);
          ctx.restore();
        }
      }
      // lands the hero can walk back to
      if (playing && this.mode !== 'fight') for (const [x, y] of this.walks) {
        const [sx, sy] = B.pos(L, x, y);
        B.diamond(ctx, sx, sy - 10, L.board.hw - 4, L.board.hh - 2);
        ctx.strokeStyle = `rgba(110,29,26,${0.6 + 0.3 * Math.sin(t * 4)})`; ctx.lineWidth = 3; ctx.stroke();
      }
      if (focus && playing && this.mode !== 'fight') {
        const [sx, sy] = B.pos(L, focus[0], focus[1]);
        B.diamond(ctx, sx, sy - (isWalk(focus[0], focus[1]) ? 10 : 0), L.board.hw, L.board.hh);
        ctx.strokeStyle = COL.seal; ctx.lineWidth = 3; ctx.stroke();
        // a note when this spot would change the land
        if (isSpot(focus[0], focus[1]) && this.settings.hints) {
          const land = run.offer[Math.min(this.pick, run.offer.length - 1)];
          const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (run.board[focus[1] + dy] || [])[focus[0] + dx]).filter(Boolean).map((q) => q.land);
          const combo = R.COMBOS.find((c) => c[0] === land && nb.includes(c[1]));
          if (combo) G2.text(ctx, `Becomes: ${combo[3]}`, sx, sy - 54, 16, COL.seal, 'center', { display: true, stroke: 4 });
        }
      }
      // the hero's miniature, hopping from land to land
      if (this.state !== 'title') {
        const k = U.easeInOut(this.hero.t), [ax, ay] = B.pos(L, this.hero.fx, this.hero.fy), [bx, by] = B.pos(L, run.x, run.y);
        const hop = Math.sin(this.hero.t * Math.PI);
        B.token(ctx, run.cls, ax + (bx - ax) * k, ay + (by - ay) * k - 10, L.board.hw, t, { hop });
      }
      if (playing) { P.draw(ctx, L, this); P.stage(ctx, L, this); }
      for (const p of this.pops) {
        ctx.globalAlpha = U.clamp01(1.4 - p.t);
        G2.text(ctx, p.text, p.x, p.y - p.t * 40, 22, p.col, 'center', { display: true, stroke: 4 });
      }
      ctx.globalAlpha = 1;
    },
  };
  PR.Game = G;
})();
