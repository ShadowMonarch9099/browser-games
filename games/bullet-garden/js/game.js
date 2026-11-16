// Bullet Garden game flow and input: the garden gate (title), the nights,
// dawn's seed packets, and the end. Twin-stick on every device: keys or the
// left thumb walk; the mouse, the right thumb or the right stick aim and fire.
(function () {
  const R = BG.Rules, V = BG.View, M = BG.Menus, A = BG.Audio, S = BG.Save;
  const $ = (id) => document.getElementById(id);
  const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  const MENU = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', KeyP: 'pause', KeyM: 'mute', Digit1: 's0', Digit2: 's1', Digit3: 's2', Digit4: 's3', KeyQ: 'sprev', KeyE: 'snext' };
  const PAD = { 0: 'confirm', 1: 'back', 4: 'sprev', 5: 'snext', 9: 'pause', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

  const G = {
    state: 'title', from: 'title', settings: null, g: null, muted: false, keys: new Set(), events: [], mouse: null, mouseDown: false,
    sticks: { move: null, aim: null }, padPrev: {}, padDir: null, pad: null, device: 'mouse', endT: 0, tips: [], hud: {}, saidThirsty: false, spitT: 0, biteT: 0,

    init(canvas) {
      this.canvas = canvas;
      this.settings = S.settings();
      M.init((a) => this.act(a));
      this.buildSettings(); this.apply();
      this.bind(canvas);
      this.titleGarden();
      this.showTitle();
    },
    apply() {
      const s = this.settings;
      A.setVolumes(this.muted ? 0 : s.sfx, this.muted ? 0 : s.music);
      A.crickets = !!s.crickets;
      document.body.classList.toggle('reduced', !!s.reduced);
      V.reduced = !!s.reduced;
      S.storeSettings(s);
    },
    buildSettings() {
      const s = this.settings, ch = (k) => (v) => { s[k] = v; this.apply(); };
      const fs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
      M.renderSettings([
        { key: 'sfx', label: 'Sound effects', type: 'slider', get: () => s.sfx, set: ch('sfx') },
        { key: 'music', label: 'Kalimba music', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'crickets', label: 'Crickets', note: 'Night sounds in the garden', type: 'toggle', get: () => s.crickets, set: ch('crickets') },
        { key: 'autofire', label: 'Auto-fire', note: 'Mouse fires without holding the button', type: 'toggle', get: () => s.autofire, set: ch('autofire') },
        { key: 'shake', label: 'Screen shake', type: 'toggle', get: () => s.shake, set: ch('shake') },
        { key: 'reduced', label: 'Reduced motion', type: 'toggle', get: () => s.reduced, set: ch('reduced') },
        { key: 'fs', label: 'Fullscreen', type: 'action', text: () => (fs() ? 'On' : 'Off'), run: () => { this.fullscreen(); setTimeout(() => M.paintSettings(), 300); } },
      ]);
    },
    fullscreen() {
      const d = document, el = d.documentElement;
      try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { M.toast('No fullscreen here'); }
    },
    resize(W, H) { this.W = W; this.H = H; V.resize(W, H, 70, W < 600 ? 20 : 78); },

    // the garden behind the title: a few plants already growing round the greenhouse
    titleGarden() {
      const g = R.create(7);
      g.state = 'title'; g.bugs = []; g.toSpawn = [];
      const put = (type, x, y) => g.plants.set(y * R.GW + x, { type, x: x + 0.5, y: y + 0.5, hp: 50, water: 1, grow: 1, cool: 0, shot: 0 });
      put('spitter', 7, 4); put('spitter', 12, 7); put('wall', 6, 7); put('vine', 13, 3); put('bomb', 4, 3); put('spitter', 10, 9); put('wall', 15, 9); put('vine', 3, 9);
      this.g = g;
    },
    showTitle() {
      const best = S.best(), wins = S.wins();
      $('t-best').textContent = wins ? `Gardens saved: ${wins} · best ${best} nights` : best ? `Best: ${best} of ${R.NIGHTS} nights` : `Ten nights to dawn`;
      M.show('title');
    },
    start() {
      A.play('confirm');
      M.fade(true);
      setTimeout(() => {
        this.g = R.create((Math.random() * 1e9) | 0);
        this.state = 'play'; this.endT = 0; this.saidThirsty = false;
        this.tips = [[1.5, 'Fire seeds at bugs. Misses grow into plants'], [9, 'Walk near your plants to water them'], [20, 'Spitters shoot bugs that come close']];
        $('hud').classList.remove('off'); $('sticks').classList.remove('off');
        M.show(null); M.fade(false);
        A.play('night'); M.toast(`Night 1 of ${R.NIGHTS}`);
        this.paintHud(true);
      }, this.settings.reduced ? 0 : 300);
    },
    quit() {
      M.fade(true);
      setTimeout(() => { this.state = 'title'; $('hud').classList.add('off'); $('sticks').classList.add('off'); this.titleGarden(); this.showTitle(); M.fade(false); }, this.settings.reduced ? 0 : 300);
    },
    pause() { if (this.state !== 'play') return; this.state = 'paused'; A.play('back'); $('hud').classList.add('off'); M.show('pause', true); },
    resume() { if (this.state !== 'paused') return; this.state = 'play'; A.play('confirm'); $('hud').classList.remove('off'); M.show(null); },
    act(a) {
      if (a && a.startsWith('seed-')) return this.choose(R.ORDER[+a.slice(5)]);
      if (a && a.startsWith('unlock-')) return this.dawnPick(a.slice(7));
      switch (a) {
        case 'start': return this.start();
        case 'how': this.from = this.state === 'paused' ? 'pause' : 'title'; A.play('confirm'); return M.show('how', true);
        case 'settings': this.from = this.state === 'paused' ? 'pause' : 'title'; this.buildSettings(); A.play('confirm'); return M.show('settings', true);
        case 'back': A.play('back'); if (this.from === 'title') return this.showTitle(); return M.show(this.from, true);
        case 'pause': return this.pause();
        case 'resume': return this.resume();
        case 'quit': A.play('back'); return this.quit();
        case 'next-night': return this.dawnPick(null);
      }
    },
    choose(type) {
      if (!this.g || this.state !== 'play') return;
      if (R.choose(this.g, type)) { A.play('seed', R.ORDER.indexOf(type)); this.paintHud(true); }
      else { A.play('deny'); M.toast(`${R.SEEDS[type].name} unlocks at dawn`); }
    },
    cycle(d) {
      const g = this.g, list = g.unlocked.slice().sort((a, b) => R.ORDER.indexOf(a) - R.ORDER.indexOf(b));
      const i = list.indexOf(g.current); this.choose(list[(i + d + list.length) % list.length]);
    },

    // ---------- dawn and the end ----------
    showDawn() {
      const g = this.g, locked = R.locked(g);
      this.state = 'dawn';
      $('hud').classList.add('off');
      $('d-kicker').textContent = `Dawn after night ${g.night}`;
      $('d-title').textContent = g.night === R.NIGHTS - 1 ? 'One night left. The swarm is coming' : 'The bugs crawl back to the dark';
      $('d-note').textContent = `Greenhouse ${Math.ceil(g.greenhouse)}% (mended a little) · ${g.plants.size} plants · ${g.kills} bugs squashed so far`;
      $('d-choices').innerHTML = locked.length
        ? locked.map((s) => `<button class="choice" data-nav data-act="unlock-${s}"><i style="--c:${R.SEEDS[s].color}"></i><b>${R.SEEDS[s].name}</b><small>${R.SEEDS[s].desc}</small></button>`).join('')
        : `<button class="choice" data-nav data-act="next-night"><i style="--c:#ffd27a"></i><b>Rest a while</b><small>Every seed is yours. On to the next night</small></button>`;
      M.show('dawn', true);
    },
    dawnPick(type) {
      if (this.state !== 'dawn') return;
      const g = this.g;
      if (type) R.unlock(g, type);
      A.play('confirm');
      R.nextNight(g);
      this.state = 'play';
      $('hud').classList.remove('off');
      M.show(null);
      A.play('night');
      M.toast(g.night === R.NIGHTS ? `Night ${g.night}: the swarm` : `Night ${g.night} of ${R.NIGHTS}`);
      this.paintHud(true);
    },
    showEnd(won) {
      const g = this.g, nights = won ? R.NIGHTS : g.night - 1, rec = S.finish(nights, won, g.kills);
      this.state = 'over';
      $('hud').classList.add('off'); $('sticks').classList.add('off');
      $('r-kicker').textContent = won ? 'Ten nights, and the sun' : `Night ${g.night}`;
      $('r-title').textContent = won ? 'The garden held!' : 'The bugs got in';
      $('r-stats').innerHTML = [[`${nights} / ${R.NIGHTS}`, 'nights survived'], [rec.best, 'best'], [g.kills, 'bugs squashed'], [g.grown, 'plants grown']].map(([b, s]) => `<div><b>${b}</b><small>${s}</small></div>`).join('');
      A.play(won ? 'win' : 'lose');
      M.show('result', true);
    },

    // ---------- input ----------
    bind(canvas) {
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        A.unlock();
        const a = MENU[e.code];
        if (!a && !MOVE[e.code]) return;
        e.preventDefault(); this.setDevice('keyboard');
        this.keys.add(e.code);
        if (a && (!e.repeat || ['up', 'down', 'left', 'right'].includes(a))) this.events.push(a);
      });
      addEventListener('keyup', (e) => this.keys.delete(e.code));
      addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; this.sticks = { move: null, aim: null }; });
      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse') { this.mouse = [e.clientX, e.clientY]; this.setDevice('mouse'); }
        for (const k of ['move', 'aim']) { const s = this.sticks[k]; if (s && s.id === e.pointerId) { s.x = e.clientX; s.y = e.clientY; } }
      });
      canvas.addEventListener('pointerdown', (e) => {
        A.unlock();
        if (e.pointerType === 'mouse') { this.setDevice('mouse'); this.mouse = [e.clientX, e.clientY]; if (e.button === 0) this.mouseDown = true; return; }
        this.setDevice('touch');
        if (this.state !== 'play') return;
        const k = e.clientX < this.W / 2 ? 'move' : 'aim';
        this.sticks[k] = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
      });
      const up = (e) => {
        if (e.pointerType === 'mouse') { this.mouseDown = false; return; }
        for (const k of ['move', 'aim']) if (this.sticks[k] && this.sticks[k].id === e.pointerId) this.sticks[k] = null;
      };
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      addEventListener('gamepadconnected', () => this.setDevice('gamepad'));
    },
    setDevice(d) { if (d !== this.device) { this.device = d; document.body.dataset.device = d; } },
    pollPad() {
      const gp = Array.from((navigator.getGamepads && navigator.getGamepads()) || []).find((p) => p && p.connected);
      this.pad = gp || null;
      if (!gp) return;
      for (const [i, a] of Object.entries(PAD)) {
        const on = !!(gp.buttons[i] && gp.buttons[i].pressed);
        if (on && !this.padPrev[i]) { this.events.push(a); this.setDevice('gamepad'); A.unlock(); }
        this.padPrev[i] = on;
      }
      if (Math.hypot(gp.axes[0] || 0, gp.axes[1] || 0) > 0.3 || Math.hypot(gp.axes[2] || 0, gp.axes[3] || 0) > 0.3) this.setDevice('gamepad');
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      let dir = null;
      if (Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
      if (dir && dir !== this.padDir && this.state !== 'play') this.events.push(dir);
      this.padDir = dir;
    },
    // this frame's movement and aim, in garden tiles
    controls() {
      const g = this.g, p = g.p;
      let mx = 0, my = 0;
      for (const [k, v] of Object.entries(MOVE)) if (this.keys.has(k)) { mx += v[0]; my += v[1]; }
      const ms = this.sticks.move;
      if (ms) { const dx = ms.x - ms.ox, dy = ms.y - ms.oy, l = Math.hypot(dx, dy); if (l > 8) { mx += (dx / l) * Math.min(1, l / 50); my += (dy / l) * Math.min(1, l / 50); } }
      const gp = this.pad;
      if (gp && Math.hypot(gp.axes[0] || 0, gp.axes[1] || 0) > 0.2) { mx += gp.axes[0]; my += gp.axes[1]; }
      const [wx, wy] = V.axis([mx, my]);
      let aim = null, fire = false;
      const as = this.sticks.aim, rx = gp ? gp.axes[2] || 0 : 0, ry = gp ? gp.axes[3] || 0 : 0, rt = gp && gp.buttons[7] && gp.buttons[7].pressed;
      const toward = (sx, sy, mag) => { const [dx, dy] = V.axis([sx, sy]), l = Math.hypot(dx, dy) || 1, r = Math.max(1.2, mag * R.REACH); return [p.x + (dx / l) * r, p.y + (dy / l) * r]; };
      if (as) { const dx = as.x - as.ox, dy = as.y - as.oy, l = Math.hypot(dx, dy); if (l > 10) { aim = toward(dx, dy, Math.min(1, l / 70)); fire = l > 18; } }
      else if (gp && (Math.hypot(rx, ry) > 0.3 || rt)) { if (Math.hypot(rx, ry) > 0.3) { aim = toward(rx, ry, Math.min(1, Math.hypot(rx, ry))); fire = Math.hypot(rx, ry) > 0.5 || rt; } else { aim = [p.x + p.face[0] * 3, p.y + p.face[1] * 3]; fire = true; } }
      else if (this.mouse && this.device === 'mouse') { aim = V.unproject(this.mouse[0], this.mouse[1]); fire = this.mouseDown || this.settings.autofire; }
      else { aim = [p.x + p.face[0] * 3, p.y + p.face[1] * 3]; fire = this.keys.has('Space'); }
      this.paintSticks();
      return { mx: wx, my: wy, ax: aim ? aim[0] : undefined, ay: aim ? aim[1] : undefined, fire, aim };
    },
    paintSticks() {
      for (const k of ['move', 'aim']) {
        const s = this.sticks[k], el = $('st-' + k);
        el.classList.toggle('on', !!s);
        if (!s) continue;
        el.style.left = s.ox + 'px'; el.style.top = s.oy + 'px';
        const dx = s.x - s.ox, dy = s.y - s.oy, l = Math.hypot(dx, dy), m = Math.min(l, 40) / (l || 1);
        el.firstChild.style.transform = `translate(${dx * m}px, ${dy * m}px)`;
      }
    },
    handle(e) {
      if (e === 'mute') { this.muted = !this.muted; this.apply(); M.toast(this.muted ? 'Sound off' : 'Sound on'); return; }
      if (this.state === 'play') {
        if (e === 'back' || e === 'pause') return this.pause();
        if (/^s[0-3]$/.test(e)) return this.choose(R.ORDER[+e[1]]);
        if (e === 'sprev') return this.cycle(-1);
        if (e === 'snext') return this.cycle(1);
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
    onEvents(evs) {
      const sh = this.settings.shake;
      for (const e of evs) {
        switch (e.type) {
          case 'fire': A.play('fire'); break;
          case 'sprout': A.play('sprout', R.ORDER.indexOf(e.seed)); V.burst(e.x, e.y, R.SEEDS[e.seed].color, 8); V.ring(e.x, e.y, R.SEEDS[e.seed].color, 0.6); break;
          case 'fizzle': A.play('fizzle'); V.burst(e.x, e.y, '#7a6650', 4); break;
          case 'hit': A.play('hit'); V.burst(e.x, e.y, '#ffffff', 3, 0.3); break;
          case 'spit': if (this.spitT <= 0) { A.play('spit'); this.spitT = 0.08; } break;
          case 'squish': A.play('squish'); V.splat(e.x, e.y, e.color); V.burst(e.x, e.y, e.color, 10, 0.15); break;
          case 'boom': A.play('boom'); V.ring(e.x, e.y, '#ff4d6d', 2); V.burst(e.x, e.y, '#ffb3c1', 24, 0.3); if (sh) V.shake = 0.6; break;
          case 'bite': if (this.biteT <= 0) { A.play('bite'); this.biteT = 0.25; if (sh) V.shake = Math.max(V.shake, 0.15); } break;
          case 'wilt': A.play('wilt'); V.burst(e.x, e.y, '#8a7a50', 6); break;
          case 'eaten': A.play('eaten'); V.burst(e.x, e.y, '#6b8f3a', 8); break;
          case 'thirsty': A.play('thirsty'); if (!this.saidThirsty) { this.saidThirsty = true; M.toast('A plant is thirsty. Walk near it to water it'); } break;
          case 'dawn': A.play('dawn'); this.endT = 0; this.pending = 'dawn'; break;
          case 'won': this.endT = 0; this.pending = 'won'; break;
          case 'lost': this.endT = 0; this.pending = 'lost'; if (sh) V.shake = 1; break;
        }
      }
    },
    paintHud(force) {
      const g = this.g, h = this.hud;
      const left = g.toSpawn.length + g.bugs.length, house = Math.ceil(g.greenhouse);
      if (force || h.night !== g.night) { $('h-night').textContent = `Night ${g.night} / ${R.NIGHTS}`; $('h-moon').style.setProperty('--ph', String(Math.round(16 - (g.night / R.NIGHTS) * 28))); h.night = g.night; }
      if (force || h.left !== left) { $('h-left').textContent = left ? `${left} bug${left === 1 ? '' : 's'} left tonight` : 'All quiet'; h.left = left; }
      if (force || h.house !== house) { const b = $('h-house'); b.style.width = house + '%'; b.classList.toggle('low', house < 35); h.house = house; }
      if (force || h.cur !== g.current || h.unl !== g.unlocked.length) {
        document.querySelectorAll('#packets .packet').forEach((el, i) => { const s = R.ORDER[i]; el.classList.toggle('sel', s === g.current); el.classList.toggle('locked', !g.unlocked.includes(s)); });
        h.cur = g.current; h.unl = g.unlocked.length;
      }
    },
    update(dt) {
      this.pollPad();
      for (const e of this.events.splice(0)) this.handle(e);
      V.tick(dt);
      this.spitT -= dt; this.biteT -= dt;
      const g = this.g;
      A.heat = this.state === 'play' && g ? Math.min(1, g.bugs.length / 14) : 0;
      A.update(this.state === 'play' || this.state === 'title', dt);
      if (this.state === 'play') {
        if (this.pending) {
          this.endT += dt;
          if (this.endT > (this.pending === 'dawn' ? 1.3 : 1.8)) { const p = this.pending; this.pending = null; if (p === 'dawn') this.showDawn(); else this.showEnd(p === 'won'); }
          return;
        }
        const c = this.controls();
        this.aimPt = c.aim;
        this.onEvents(R.step(g, dt, c));
        if (this.tips.length && g.night === 1 && g.time > this.tips[0][0]) M.toast(this.tips.shift()[1]);
        this.paintHud(false);
      }
    },
    render(ctx) {
      const g = this.g, playing = this.state === 'play' || this.state === 'paused';
      const aim = playing && this.aimPt && !this.pending ? this.aimPt : null;
      V.draw(ctx, g, { showGardener: this.state !== 'title', aim, aimOk: aim ? R.canPlant(g, ...this.landing(aim)) : true, aimPt: aim ? [aim[0], aim[1], R.SEEDS[g.current].color] : null });
    },
    landing(a) { const p = this.g.p, d = Math.hypot(a[0] - p.x, a[1] - p.y) || 1, r = Math.min(R.REACH, d); return [p.x + ((a[0] - p.x) / d) * r, p.y + ((a[1] - p.y) / d) * r]; },
  };
  BG.Game = G;
})();
