// Trio Teahouse game flow: the door (title, with a table being cleared by
// itself behind the menu board), choosing a table, a table, and the bill.
(function () {
  const R = TT.Rules, V = TT.View, M = TT.Menus, A = TT.Audio;
  const $ = (id) => document.getElementById(id);
  const P = 'trio-teahouse:', mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(P + k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : d; };
  const set = (k, v) => { mem[k] = v; try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* not saved */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TABLES = 30;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const daySeed = () => today().split('-').reduce((a, b) => a * 37 + +b, 7);
  const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

  const G = {
    state: 'title', from: 'title', s: null, n: 1, daily: false, clockT: 0, demoT: 0, muted: false, events: [], padPrev: {}, padDir: null, cur: null, hint: null, idle: 0, ended: false,
    settings: Object.assign({ sfx: 8, music: 5, hints: true, reduced: reduce }, get('settings', {})),
    prog: Object.assign({ stars: {}, best: {}, daily: {} }, get('progress', {})),

    init(canvas) {
      this.canvas = canvas;
      M.init((a, n) => this.act(a, n));
      this.buildSettings(); this.apply();
      this.bind(canvas);
      document.querySelectorAll('[data-icon]').forEach((el) => { el.src = V.icon(el.dataset.icon, 48); });
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
        { key: 'sfx', label: 'Clinks and pours', type: 'slider', get: () => s.sfx, set: ch('sfx') },
        { key: 'music', label: 'Zither and flute', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'hints', label: 'Hints', note: 'Glow a pair after a quiet moment', type: 'toggle', get: () => s.hints, set: ch('hints') },
        { key: 'reduced', label: 'Reduced motion', type: 'toggle', get: () => s.reduced, set: ch('reduced') },
        { key: 'fs', label: 'Fullscreen', type: 'action', text: () => (fs() ? 'On' : 'Off'), run: () => { this.fullscreen(); setTimeout(() => M.paintSettings(), 300); } },
      ]);
    },
    fullscreen() {
      const d = document, el = d.documentElement;
      try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { M.toast('No fullscreen here'); }
    },
    resize(W, H) { this.W = W; this.H = H; this.layout(); },
    layout() { if (this.W && this.s) { V.layout(this.W, this.H, this.s, this.state === 'play' || this.state === 'paused' || this.state === 'result' ? 70 : 20); V.sync(this.s, 0, true); } },
    unlocked() { const done = Object.keys(this.prog.stars).map(Number); return Math.min(TABLES, Math.max(0, ...done) + 1); },

    // ---------- screens ----------
    demo() { this.s = R.create(R.level(4 + ((Math.random() * 6) | 0), (Math.random() * 1e9) | 0)); V.disp.clear(); this.layout(); this.demoT = 1.2; },
    showTitle() {
      this.state = 'title';
      const n = this.unlocked(), stars = Object.values(this.prog.stars).reduce((a, b) => a + b, 0);
      $('b-continue').textContent = stars ? `Table ${n}` : 'Your first table';
      $('b-daily').textContent = this.prog.daily[today()] ? `Today's: ${clock(this.prog.daily[today()])}` : 'A new table every day';
      $('b-tables').textContent = `${stars} of ${TABLES * 3} stars`;
      $('hud').classList.add('off');
      M.show('title');
    },
    showTables() {
      const open = this.unlocked();
      $('tables').innerHTML = Array.from({ length: TABLES }, (_, i) => {
        const n = i + 1, st = this.prog.stars[n] || 0, locked = n > open, best = this.prog.best[n];
        return `<button class="bowl ${locked ? 'locked' : ''} ${st ? 'done' : ''}" ${locked ? 'disabled' : ''} data-nav data-lv="${n}" aria-label="Table ${n}"><b>${n}</b><i>${'●'.repeat(st)}${'○'.repeat(3 - st)}</i>${best ? `<small>${clock(best)}</small>` : ''}</button>`;
      }).join('');
      this.state = 'tables';
      M.show('tables', true);
      const el = document.querySelector(`#tables [data-lv="${open}"]`);
      if (el) { M.setFocus(el, true); try { el.scrollIntoView({ block: 'center' }); } catch (e) { /* old */ } }
    },
    start(n, daily) {
      A.unlock(); A.play('confirm');
      this.n = n; this.daily = !!daily;
      M.fade(true);
      setTimeout(() => {
        this.s = R.create(daily ? R.level(18, daySeed()) : R.level(n));
        this.state = 'play'; this.clockT = 0; this.cur = null; this.hint = null; this.idle = 0; this.ended = false;
        V.disp.clear(); V.parts = []; this.layout();
        // tiles drop onto the table one layer at a time
        if (!this.settings.reduced) for (const t of this.s.tiles) { const d = V.disp.get(t.id); d.y -= 220 + t.z * 80 + Math.random() * 60; d.a = 1; }
        $('h-table').textContent = daily ? 'Daily blend' : `Table ${n}`;
        $('hud').classList.remove('off');
        M.show(null); M.fade(false);
        this.hud();
      }, this.settings.reduced ? 0 : 300);
    },
    quit() { M.fade(true); setTimeout(() => { this.demo(); this.showTables(); $('hud').classList.add('off'); M.fade(false); }, this.settings.reduced ? 0 : 300); },
    pause() { if (this.state !== 'play') return; this.state = 'paused'; A.play('back'); $('hud').classList.add('off'); M.show('pause', true); },
    resume() { if (this.state !== 'paused') return; this.state = 'play'; A.play('confirm'); $('hud').classList.remove('off'); M.show(null); },
    act(a, n) {
      if (a === 'play-level') return this.start(n);
      switch (a) {
        case 'continue': return this.start(this.unlocked());
        case 'daily': return this.start(0, true);
        case 'tables': A.play('confirm'); this.from = 'title'; return this.showTables();
        case 'how': this.from = this.state === 'paused' ? 'pause' : 'title'; A.play('confirm'); return M.show('how', true);
        case 'settings': this.from = this.state === 'paused' ? 'pause' : 'title'; this.buildSettings(); A.play('confirm'); return M.show('settings', true);
        case 'back': A.play('back'); if (this.from === 'title' || this.state === 'tables') return this.showTitle(); return M.show(this.from, true);
        case 'pause': return this.pause();
        case 'resume': return this.resume();
        case 'restart': return this.start(this.n, this.daily);
        case 'next': return this.start(Math.min(TABLES, this.n + 1));
        case 'quit': A.play('back'); return this.quit();
        case 'undo': return this.tool('undo');
        case 'aside': return this.tool('aside');
        case 'stir': return this.tool('stir');
        case 'rescue': if (this.s.tools.aside > 0) { this.state = 'play'; $('hud').classList.remove('off'); M.show(null); this.ended = false; this.tool('aside'); } return;
      }
    },

    // ---------- a table ----------
    pickTile(t) {
      if (this.state !== 'play' || !t) return;
      if (!R.isFree(this.s, t)) { A.play('blocked'); V.shake = 0.3; return; }
      const ev = R.pick(this.s, t.id);
      if (!ev) return;
      this.idle = 0; this.hint = null;
      A.play('pick'); setTimeout(() => A.play('place'), 160);
      for (const e of ev) {
        if (e.type === 'serve') {
          const slot = ev[0].slot;
          setTimeout(() => A.play('serve', e.combo - 1), 200);
          V.serve(e.ids, slot);
          if (e.combo >= 3) M.toast(['', '', '', 'A fine pot!', 'Splendid service!', 'The house is impressed!'][Math.min(5, e.combo)] || 'Masterful!');
        }
      }
      if (!this.s.over && this.s.tray.length >= R.TRAY - 2) A.play('warn');
      if (this.s.over) this.end();
      this.hud();
      this.fixCursor();
    },
    tool(kind) {
      if (this.state !== 'play') return;
      const s = this.s;
      if (kind === 'undo') { if (R.undo(s)) A.play('undo'); else { A.play('blocked'); M.toast(s.tools.undo ? 'Nothing to take back' : 'No undos left'); } }
      else if (kind === 'aside') { if (R.setAside(s)) { A.play('aside'); M.toast('Three set aside on the counter'); } else { A.play('blocked'); M.toast(s.tools.aside ? 'The tray is empty' : 'The counter is full'); } }
      else if (kind === 'stir') { if (R.stir(s)) { A.play('stir'); V.shake = 0.5; } else { A.play('blocked'); M.toast('No stirs left'); } }
      this.hint = null; this.idle = 0;
      this.hud();
    },
    end() {
      if (this.ended) return;
      this.ended = true;
      setTimeout(() => this.finish(), this.s.over === 'won' ? 900 : 700);
    },
    finish() {
      const s = this.s, n = this.n, won = s.over === 'won';
      this.state = 'result';
      $('hud').classList.add('off');
      const t = Math.round(this.clockT);
      $('r-rescue').hidden = true;
      if (won) {
        const st = R.stars(s);
        let note;
        if (this.daily) { const prev = this.prog.daily[today()]; this.prog.daily[today()] = prev ? Math.min(prev, t) : t; note = prev && prev <= t ? `Today's best: ${clock(prev)}` : 'Your best for today!'; }
        else {
          const prev = this.prog.best[n];
          this.prog.stars[n] = Math.max(this.prog.stars[n] || 0, st);
          this.prog.best[n] = prev ? Math.min(prev, t) : t;
          note = prev && prev <= t ? `Best: ${clock(prev)}` : 'Your quickest yet!';
        }
        set('progress', this.prog);
        $('r-kicker').textContent = this.daily ? `Daily blend · ${today()}` : `Table ${n}`;
        $('r-title').textContent = st === 3 ? 'Flawless service!' : 'Table cleared!';
        $('r-stars').innerHTML = [1, 2, 3].map((i) => `<i class="${i <= st ? 'on' : ''}" style="--d:${i * 0.25}s"></i>`).join('');
        $('r-stars').hidden = false;
        $('r-note').textContent = note + (st < 3 ? ' · Clear it without helpers for three cups.' : '');
        $('r-next').hidden = this.daily || n >= TABLES;
        A.play('win');
        if (!this.settings.reduced) for (let i = 1; i <= st; i++) setTimeout(() => A.play('star', i), 500 + i * 260);
        for (let i = 0; i < 30; i++) V.burst(Math.random() * this.W, -10, ['#f8bbd0', '#ffffff', '#f48fb1'][i % 3], 1);
      } else {
        $('r-kicker').textContent = this.daily ? 'Daily blend' : `Table ${n}`;
        $('r-title').textContent = 'The tray is full';
        $('r-stars').hidden = true;
        $('r-note').textContent = `${R.onTable(s).length} tiles were still on the table.` + (s.tools.aside ? ' You can still set three aside and carry on.' : '');
        $('r-next').hidden = true;
        $('r-rescue').hidden = !s.tools.aside;
        A.play('lose');
      }
      $('r-stats').innerHTML = [[clock(t), 'time'], [s.served, 'trios served']].map(([b, l]) => `<div><b>${b}</b><small>${l}</small></div>`).join('');
      M.show('result', true);
    },
    hud() {
      const s = this.s;
      $('h-left').textContent = s.tiles.filter((t) => !t.gone).length;
      for (const k of ['undo', 'aside', 'stir']) { $('n-' + k).textContent = s.tools[k]; $('t-' + k).classList.toggle('empty', !s.tools[k]); }
      $('h-tray').classList.toggle('danger', s.tray.length >= R.TRAY - 2);
      $('h-tray').style.visibility = s.aside.length ? 'hidden' : '';
      $('h-tray').textContent = s.tray.length >= R.TRAY - 2 ? `Careful: ${R.TRAY - s.tray.length} saucer${R.TRAY - s.tray.length === 1 ? '' : 's'} left` : 'Serving tray · three alike are served';
    },
    freeTiles() { return this.s.tiles.filter((t) => R.isFree(this.s, t) && !t.inTray); },
    fixCursor() {
      if (this.cur === null) return;
      const t = this.s.tiles[this.cur];
      if (!t || !R.isFree(this.s, t) || t.inTray) { const f = this.freeTiles(); this.cur = f.length ? f[0].id : null; }
    },
    findHint() {
      const free = this.freeTiles(), s = this.s;
      for (const t of free) { const n = s.tray.filter((x) => s.tiles[x].k === t.k).length; if (n === 2) return [t.id]; }
      const by = {};
      for (const t of free) (by[t.k] = by[t.k] || []).push(t.id);
      for (const t of s.tray.map((x) => s.tiles[x])) if (by[t.k]) return by[t.k].slice(0, 2);
      for (const ids of Object.values(by)) if (ids.length >= 3) return ids.slice(0, 3);
      return null;
    },

    // ---------- input ----------
    bind(canvas) {
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        A.unlock();
        document.body.dataset.device = 'keyboard';
        const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', KeyP: 'pause', KeyM: 'mute', KeyZ: 'undo', KeyX: 'aside', KeyC: 'stir', KeyH: 'hint' }[e.code];
        if (!k) return;
        e.preventDefault();
        this.events.push(k);
      });
      canvas.addEventListener('pointerdown', (e) => {
        A.unlock();
        document.body.dataset.device = e.pointerType === 'mouse' ? 'mouse' : 'touch';
        if (this.state !== 'play') return;
        this.cur = null;
        this.pickTile(V.tileAt(this.s, e.clientX, e.clientY));
      });
      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse' || this.state !== 'play') { V.hover = null; return; }
        const t = V.tileAt(this.s, e.clientX, e.clientY);
        V.hover = t ? t.id : null;
        canvas.style.cursor = t && R.isFree(this.s, t) && !t.inTray ? 'pointer' : '';
      });
      addEventListener('gamepadconnected', () => { document.body.dataset.device = 'gamepad'; });
    },
    pollPad() {
      const gp = Array.from((navigator.getGamepads && navigator.getGamepads()) || []).find((p) => p && p.connected);
      if (!gp) return;
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      for (const [i, a] of Object.entries({ 0: 'confirm', 1: 'back', 2: 'undo', 3: 'aside', 4: 'stir', 5: 'stir', 9: 'pause' })) { const on = b(i); if (on && !this.padPrev[i]) { this.events.push(a); A.unlock(); document.body.dataset.device = 'gamepad'; } this.padPrev[i] = on; }
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      let dir = b(12) ? 'up' : b(13) ? 'down' : b(14) ? 'left' : b(15) ? 'right' : null;
      if (!dir && (Math.abs(ax) > 0.55 || Math.abs(ay) > 0.55)) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
      if (dir && dir !== this.padDir) { this.events.push(dir); document.body.dataset.device = 'gamepad'; }
      this.padDir = dir;
    },
    // move the keyboard cursor to the nearest free tile in a direction
    moveCursor(dir) {
      const free = this.freeTiles();
      if (!free.length) return;
      const cur = this.cur !== null && this.s.tiles[this.cur];
      if (!cur || !free.includes(cur)) { this.cur = free[0].id; return; }
      const d0 = V.disp.get(cur.id), [vx, vy] = DIRS[dir];
      let best = null, bs = Infinity;
      for (const t of free) {
        if (t === cur) continue;
        const d = V.disp.get(t.id); if (!d) continue;
        const dx = d.x - d0.x, dy = d.y - d0.y, along = dx * vx + dy * vy;
        if (along <= 4) continue;
        const sc = along + Math.abs(dx * vy - dy * vx) * 2;
        if (sc < bs) { bs = sc; best = t; }
      }
      if (best) { this.cur = best.id; A.play('move'); }
    },
    handle(e) {
      if (e === 'mute') { this.muted = !this.muted; this.apply(); M.toast(this.muted ? 'Sound off' : 'Sound on'); return; }
      if (this.state === 'play') {
        if (e === 'back' || e === 'pause') return this.pause();
        if (e === 'undo' || e === 'aside' || e === 'stir') return this.tool(e);
        if (e === 'hint') { this.hint = this.findHint(); return; }
        if (DIRS[e]) return this.moveCursor(e);
        if (e === 'confirm') { if (this.cur === null) this.moveCursor('right'); else this.pickTile(this.s.tiles[this.cur]); }
        return;
      }
      const cur = M.current && M.current.id;
      if (e === 'back' || e === 'pause') { if (cur === 's-pause') this.resume(); else if (cur === 's-settings' || cur === 's-how' || cur === 's-tables') this.act('back'); else if (cur === 's-result') this.act('quit'); return; }
      if (e === 'confirm') M.confirm();
      else if (DIRS[e]) M.nav(e);
    },

    // ---------- time ----------
    update(dt) {
      this.pollPad();
      for (const e of this.events.splice(0)) this.handle(e);
      V.tick(dt);
      A.update(this.state === 'play');
      if (this.s) V.sync(this.s, dt);
      if (this.state === 'title' || this.state === 'tables') {
        // the table behind the menu clears itself, slowly
        this.demoT -= dt;
        if (this.demoT <= 0) {
          this.demoT = 0.9;
          if (this.s.over) this.demo();
          else { const id = R.bot(this.s); if (id === null) this.demo(); else { const ev = R.pick(this.s, id); const sv = ev && ev.find((x) => x.type === 'serve'); if (sv) V.serve(sv.ids, ev[0].slot); } }
        }
        return;
      }
      if (this.state === 'play' && !this.s.over) {
        this.clockT += dt;
        $('h-clock').textContent = clock(this.clockT);
        this.idle += dt;
        if (this.settings.hints && this.idle > 9 && !this.hint) this.hint = this.findHint();
      }
      V.cursor = this.state === 'play' && (document.body.dataset.device === 'keyboard' || document.body.dataset.device === 'gamepad') ? this.cur : null;
    },
    render(ctx) { V.draw(ctx, this.s, { hint: this.state === 'play' ? this.hint : null }); },
  };
  TT.Game = G;
})();
