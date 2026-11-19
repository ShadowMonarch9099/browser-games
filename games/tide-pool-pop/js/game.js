// Tide Pool Pop game flow: the beach (title, with a pool playing itself
// behind it), the shoreline map of forty pools, a pool, and the result.
(function () {
  const R = TP.Rules, L = TP.Levels, V = TP.View, M = TP.Menus, A = TP.Audio;
  const $ = (id) => document.getElementById(id);
  const P = 'tide-pool-pop:', mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(P + k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : d; };
  const set = (k, v) => { mem[k] = v; try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* not saved */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NICE = { star: 'starfish', shell: 'scallops', urchin: 'urchins', crab: 'crabs', clam: 'clams', fish: 'fish' };
  const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };

  const G = {
    state: 'title', from: 'title', s: null, n: 1, queue: [], idle: 0, demoT: 0, muted: false, events: [], padPrev: {}, padDir: null, drag: null, cur: [3, 4], picked: false, bonus: false, ended: false, resetArm: false,
    settings: Object.assign({ sfx: 8, music: 5, pace: 1, hints: true, reduced: reduce }, get('settings', {})),
    prog: Object.assign({ stars: {}, best: {} }, get('progress', {})),

    init(canvas) {
      this.canvas = canvas;
      M.init((a, n) => this.act(a, n));
      this.buildSettings(); this.apply();
      this.bind(canvas);
      this.icons = {};
      for (const k of [...R.KINDS, 'sand', 'rocks', 'pearl']) this.icons[k] = V.icon(k, 40);
      document.querySelectorAll('[data-icon]').forEach((el) => { el.src = this.icons[el.dataset.icon]; });
      this.demo();
      this.showTitle();
    },
    apply() {
      const s = this.settings;
      A.setVolumes(this.muted ? 0 : s.sfx, this.muted ? 0 : s.music);
      document.body.classList.toggle('reduced', !!s.reduced);
      V.reduced = !!s.reduced; V.speed = s.pace;
      set('settings', s);
    },
    buildSettings() {
      const s = this.settings, ch = (k) => (v) => { s[k] = v; this.apply(); };
      const fs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
      M.renderSettings([
        { key: 'sfx', label: 'Splashes', type: 'slider', get: () => s.sfx, set: ch('sfx') },
        { key: 'music', label: 'Kalimba', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'pace', label: 'Ripple speed', note: 'How quickly pops and falls play', type: 'action', text: () => (s.pace < 1 ? 'Gentle' : s.pace > 1 ? 'Brisk' : 'Normal'), run: () => { s.pace = s.pace < 1 ? 1 : s.pace > 1 ? 0.75 : 1.5; this.apply(); } },
        { key: 'hints', label: 'Hints', note: 'Show a move after a little while', type: 'toggle', get: () => s.hints, set: ch('hints') },
        { key: 'reduced', label: 'Reduced motion', type: 'toggle', get: () => s.reduced, set: ch('reduced') },
        { key: 'fs', label: 'Fullscreen', type: 'action', text: () => (fs() ? 'On' : 'Off'), run: () => { this.fullscreen(); setTimeout(() => M.paintSettings(), 300); } },
        { key: 'reset', label: 'Reset the shoreline', note: 'Forget every pool and star', type: 'action', text: () => (this.resetArm ? 'Press again' : 'Reset'), run: () => {
          if (!this.resetArm) { this.resetArm = true; return; }
          this.resetArm = false; this.prog = { stars: {}, best: {} }; set('progress', this.prog); M.toast('The shoreline is fresh again');
        } },
      ]);
    },
    fullscreen() {
      const d = document, el = d.documentElement;
      try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { M.toast('No fullscreen here'); }
    },
    resize(W, H) { this.W = W; this.H = H; this.layout(); },
    layout() {
      if (!this.W) return;
      const play = this.state !== 'title' && this.state !== 'map';
      const portrait = this.H > this.W;
      V.layout(this.W, this.H, play ? (portrait ? 128 : 88) : 24, play ? 34 : 24);
    },
    unlocked() { const done = Object.keys(this.prog.stars).map(Number); return Math.min(L.LEVELS.length, Math.max(0, ...done) + 1); },
    totalStars() { return Object.values(this.prog.stars).reduce((a, b) => a + b, 0); },

    // ---------- screens ----------
    demo() {
      const lv = L.LEVELS[(Math.random() * 12) | 0];
      this.s = R.create(Object.assign({}, lv, { seed: (Math.random() * 1e9) | 0, moves: 999 }));
      this.queue = []; V.sprites.clear(); V.sync(this.s); this.demoT = 1.5;
    },
    showTitle() {
      this.state = 'title'; this.layout();
      const n = this.unlocked();
      $('b-continue').textContent = this.totalStars() ? `Pool ${n} · ${L.zoneOf(n).name}` : 'Start at the shallows';
      $('t-stars').textContent = `${this.totalStars()} / ${L.LEVELS.length * 3}`;
      $('hud').classList.add('off');
      M.show('title');
    },
    showMap() {
      const open = this.unlocked();
      $('map').innerHTML = L.ZONES.map((z, i) => {
        const end = (L.ZONES[i + 1] || { from: L.LEVELS.length + 1 }).from;
        const lv = L.LEVELS.filter((l) => l.n >= z.from && l.n < end);
        return `<section class="zone" style="--z:${z.tint}"><h3>${z.name}</h3><div class="pools">${lv.map((l) => {
          const st = this.prog.stars[l.n] || 0, locked = l.n > open;
          return `<button class="pool ${locked ? 'locked' : ''} ${st ? 'done' : ''}" ${locked ? 'disabled' : ''} data-nav data-lv="${l.n}" aria-label="Pool ${l.n}${st ? `, ${st} stars` : ''}"><b>${l.n}</b><i>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</i></button>`;
        }).join('')}</div></section>`;
      }).join('');
      this.state = 'map';
      M.show('map', true);
      const target = document.querySelector(`#map [data-lv="${open}"]`);
      if (target) { M.setFocus(target, true); try { target.scrollIntoView({ block: 'center' }); } catch (e) { /* old */ } }
    },
    goalText(lv) {
      const g = lv.goals, bits = [];
      if (g.collect) bits.push('pop ' + Object.entries(g.collect).map(([k, n]) => `${n} ${NICE[k]}`).join(' and '));
      if (g.sand) bits.push('wash away all the sand');
      if (g.rocks) bits.push('crack every barnacle stone');
      if (g.score) bits.push(`score ${g.score.toLocaleString()}`);
      const t = bits.join(', then ').replace(/, then ([^,]*)$/, ' and $1');
      return t.charAt(0).toUpperCase() + t.slice(1) + ` in ${lv.moves} moves.`;
    },
    start(n) {
      A.unlock(); A.play('confirm');
      this.n = n;
      M.fade(true);
      setTimeout(() => {
        const lv = L.LEVELS[n - 1];
        this.s = R.create(lv);
        this.queue = []; this.bonus = false; this.ended = false; this.idle = 0; this.drag = null; this.picked = false; V.sel = null; V.hint = null;
        this.state = 'play'; this.layout(); V.speed = this.settings.pace;
        V.sprites.clear(); V.sync(this.s);
        $('h-level').textContent = `Pool ${n} · ${L.zoneOf(n).name}`;
        $('hud').classList.remove('off');
        document.body.style.setProperty('--zone', L.zoneOf(n).tint);
        this.hud(true);
        M.show(null); M.fade(false);
        $('banner-goal').textContent = this.goalText(lv);
        $('banner-n').textContent = `Pool ${n}`;
        $('banner').classList.add('on');
        clearTimeout(this.bt); this.bt = setTimeout(() => $('banner').classList.remove('on'), 2200);
      }, this.settings.reduced ? 0 : 300);
    },
    quit() { M.fade(true); setTimeout(() => { this.demo(); this.showMap(); $('hud').classList.add('off'); this.layout(); M.fade(false); }, this.settings.reduced ? 0 : 300); },
    pause() { if (this.state !== 'play') return; this.state = 'paused'; A.play('back'); $('hud').classList.add('off'); M.show('pause', true); },
    resume() { if (this.state !== 'paused') return; this.state = 'play'; A.play('confirm'); $('hud').classList.remove('off'); M.show(null); },
    act(a, n) {
      if (a === 'play-level') return this.start(n);
      switch (a) {
        case 'continue': return this.start(this.unlocked());
        case 'map': A.play('confirm'); this.from = 'title'; return this.showMap();
        case 'how': this.from = this.state === 'paused' ? 'pause' : 'title'; A.play('confirm'); return M.show('how', true);
        case 'settings': this.from = this.state === 'paused' ? 'pause' : 'title'; this.resetArm = false; this.buildSettings(); A.play('confirm'); return M.show('settings', true);
        case 'back': A.play('back'); if (this.from === 'title' || this.state === 'map') return this.showTitle(); return M.show(this.from, true);
        case 'pause': return this.pause();
        case 'resume': return this.resume();
        case 'restart': return this.start(this.n);
        case 'next': return this.start(Math.min(L.LEVELS.length, this.n + 1));
        case 'quit': A.play('back'); return this.quit();
      }
    },

    // ---------- a pool ----------
    canMove() { return this.state === 'play' && !this.queue.length && !V.busy() && !this.s.over; },
    trySwap(x1, y1, x2, y2) {
      if (!this.canMove()) return;
      const a = R.at(this.s, x1, y1), b = R.at(this.s, x2, y2);
      V.sel = null; this.picked = false; V.hint = null; this.idle = 0;
      if (!a || !b || a.rock || b.rock) { A.play('nope'); return; }
      if (!R.swap(this.s, x1, y1, x2, y2)) { V.phase({ type: 'bounce', a: a.id, b: b.id, from: [x1, y1], to: [x2, y2] }); A.play('nope'); return; }
      this.queue = this.s.phases.slice();
      this.hudMoves();
    },
    playPhase(ph, quiet) {
      V.phase(ph, this.s);
      if (quiet) return;
      if (ph.type === 'swap') A.play('swap');
      else if (ph.type === 'pop') {
        if (ph.cleared.length) A.play('pop', ph.cascade - 1);
        const kinds = new Set(ph.fired.map((f) => f.sp));
        if (kinds.has('h') || kinds.has('v')) A.play('wave');
        if (kinds.has('bomb')) A.play('bubble');
        if (kinds.has('pearl')) A.play('pearl');
        if (ph.made.length) A.play('made');
        if (ph.cracked.length) A.play('crack');
        if (ph.washed && ph.washed.length) A.play('sand');
        if (ph.cascade === 3) M.toast('Splendid!'); else if (ph.cascade === 5) M.toast('Tidal!'); else if (ph.cascade === 7) M.toast('Oceanic!');
        $('h-score').textContent = ph.score.toLocaleString();
      } else if (ph.type === 'shuffle') { A.play('shuffle'); M.toast('No moves left. The tide stirs the pool.'); }
    },
    settle() {
      const s = this.s;
      V.sync(s);
      if (this.state === 'title') return;
      this.hud();
      if (s.over === 'won' && !this.bonus) {
        this.bonus = true; this.stars = R.stars(s);
        if (s.moves > 0) { M.toast(`Tide bonus! ${s.moves} moves left`); this.queue = R.tideBonus(s).slice(); V.speed = this.settings.pace * 2.2; A.play('win'); return; }
      }
      if (s.over && !this.ended) { this.ended = true; setTimeout(() => this.finish(), 600); }
    },
    finish() {
      const s = this.s, n = this.n, won = s.over === 'won';
      this.state = 'result';
      $('hud').classList.add('off');
      const best = this.prog.best[n] || 0;
      if (won) {
        const st = this.stars || R.stars(s);
        this.prog.stars[n] = Math.max(this.prog.stars[n] || 0, st);
        this.prog.best[n] = Math.max(best, s.score);
        set('progress', this.prog);
        $('r-kicker').textContent = `Pool ${n} · ${L.zoneOf(n).name}`;
        $('r-title').textContent = st === 3 ? 'A perfect pool!' : 'Pool cleared!';
        $('r-stars').innerHTML = [1, 2, 3].map((i) => `<i class="${i <= st ? 'on' : ''}" style="--d:${i * 0.25}s"></i>`).join('');
        $('r-stars').hidden = false;
        $('r-note').textContent = s.score > best ? 'A new best for this pool!' : `Best: ${best.toLocaleString()}`;
        $('r-next').hidden = n >= L.LEVELS.length;
        $('r-retry').querySelector('b').textContent = 'Play again';
        A.play('win');
        if (!this.settings.reduced) [1, 2, 3].forEach((i) => i <= st && setTimeout(() => A.play('star', i), 400 + i * 250));
      } else {
        const left = R.progress(s).filter((p) => p.have < p.need).map((p) => p.kind === 'score' ? `${(p.need - p.have).toLocaleString()} points` : p.kind === 'collect' ? `${p.need - p.have} ${NICE[p.what]}` : p.kind === 'sand' ? `${p.need - p.have} patches of sand` : `${p.need - p.have} stones`);
        $('r-kicker').textContent = `Pool ${n} · out of moves`;
        $('r-title').textContent = 'The tide came in';
        $('r-stars').hidden = true;
        $('r-note').textContent = 'Still to go: ' + left.join(', ') + '.';
        $('r-next').hidden = true;
        $('r-retry').querySelector('b').textContent = 'Try again';
        A.play('lose');
      }
      $('r-stats').innerHTML = [[s.score.toLocaleString(), 'score'], [s.movesUsed, 'moves used']].map(([b, l]) => `<div><b>${b}</b><small>${l}</small></div>`).join('');
      M.show('result', true);
    },
    hudMoves() {
      const s = this.s, lv = s.level;
      $('h-moves').textContent = s.moves;
      $('h-tide').style.setProperty('--fill', (s.moves / lv.moves).toFixed(3));
      const low = s.moves <= 5 && !s.over;
      if (low && !$('h-gauge').classList.contains('low')) A.play('low');
      $('h-gauge').classList.toggle('low', low);
    },
    hud(first) {
      const s = this.s;
      this.hudMoves();
      $('h-score').textContent = s.score.toLocaleString();
      const parts = R.progress(s);
      const html = parts.filter((p) => p.kind !== 'score').map((p) => {
        const icon = p.kind === 'collect' ? p.what : p.kind, left = Math.max(0, p.need - p.have);
        return `<span class="goal ${left ? '' : 'met'}"><img src="${this.icons[icon]}" alt="" /><b>${left || '✓'}</b></span>`;
      }).join('');
      const sc = parts.find((p) => p.kind === 'score');
      $('h-goals').innerHTML = html + (sc ? `<span class="goal score ${sc.have >= sc.need ? 'met' : ''}"><small>score</small><b>${sc.have >= sc.need ? '✓' : sc.need.toLocaleString()}</b></span>` : '');
      if (first) $('h-goals').classList.add('fresh'); else $('h-goals').classList.remove('fresh');
    },

    // ---------- input ----------
    bind(canvas) {
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        A.unlock();
        document.body.dataset.device = 'keyboard';
        const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down', Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', KeyP: 'pause', KeyM: 'mute', KeyH: 'hint' }[e.code];
        if (!k) return;
        e.preventDefault();
        this.events.push(k);
      });
      canvas.addEventListener('pointerdown', (e) => {
        A.unlock();
        document.body.dataset.device = e.pointerType === 'mouse' ? 'mouse' : 'touch';
        if (this.state !== 'play') return;
        const c = V.cellAt(e.clientX, e.clientY);
        if (!c || !V.isOpen(c[0], c[1])) { V.sel = null; return; }
        this.idle = 0; V.hint = null;
        if (V.sel && Math.abs(V.sel[0] - c[0]) + Math.abs(V.sel[1] - c[1]) === 1) { this.trySwap(V.sel[0], V.sel[1], c[0], c[1]); return; }
        const p = R.at(this.s, c[0], c[1]);
        if (!p || p.rock) { V.sel = null; return; }
        V.sel = c; this.cur = c.slice(); A.play('select');
        this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cell: c };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
      });
      canvas.addEventListener('pointermove', (e) => {
        const d = this.drag; if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y, need = V.S * 0.35;
        if (Math.hypot(dx, dy) < need) return;
        const [ox, oy] = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
        this.drag = null;
        this.trySwap(d.cell[0], d.cell[1], d.cell[0] + ox, d.cell[1] + oy);
      });
      const end = () => { this.drag = null; };
      canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
      addEventListener('gamepadconnected', () => { document.body.dataset.device = 'gamepad'; });
    },
    pollPad() {
      const gp = Array.from((navigator.getGamepads && navigator.getGamepads()) || []).find((p) => p && p.connected);
      if (!gp) return;
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      for (const [i, a] of Object.entries({ 0: 'confirm', 1: 'back', 9: 'pause', 3: 'hint' })) { const on = b(i); if (on && !this.padPrev[i]) { this.events.push(a); A.unlock(); document.body.dataset.device = 'gamepad'; } this.padPrev[i] = on; }
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      let dir = b(12) ? 'up' : b(13) ? 'down' : b(14) ? 'left' : b(15) ? 'right' : null;
      if (!dir && (Math.abs(ax) > 0.55 || Math.abs(ay) > 0.55)) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
      if (dir && dir !== this.padDir) { this.events.push(dir); document.body.dataset.device = 'gamepad'; }
      this.padDir = dir;
    },
    handle(e) {
      if (e === 'mute') { this.muted = !this.muted; this.apply(); M.toast(this.muted ? 'Sound off' : 'Sound on'); return; }
      if (this.state === 'play') {
        if (e === 'back' || e === 'pause') { if (this.picked) { this.picked = false; V.sel = null; } else this.pause(); return; }
        if (e === 'hint') { const m = R.findMoves(this.s); if (m.length) V.hint = m[(Math.random() * m.length) | 0]; return; }
        this.idle = 0; V.hint = null;
        if (DIRS[e]) {
          const [dx, dy] = DIRS[e];
          if (this.picked) { this.trySwap(this.cur[0], this.cur[1], this.cur[0] + dx, this.cur[1] + dy); this.cur = [this.cur[0] + dx, this.cur[1] + dy].map((v, i) => Math.max(0, Math.min(i ? R.H - 1 : R.W - 1, v))); return; }
          this.cur = [Math.max(0, Math.min(R.W - 1, this.cur[0] + dx)), Math.max(0, Math.min(R.H - 1, this.cur[1] + dy))];
          A.play('move');
        } else if (e === 'confirm') {
          const p = R.at(this.s, this.cur[0], this.cur[1]);
          if (!p || p.rock) { A.play('nope'); return; }
          this.picked = !this.picked; V.sel = this.picked ? this.cur.slice() : null; A.play('select');
        }
        return;
      }
      const cur = M.current && M.current.id;
      if (e === 'back' || e === 'pause') { if (cur === 's-pause') this.resume(); else if (cur === 's-settings' || cur === 's-how' || cur === 's-map') this.act('back'); else if (cur === 's-result') this.act('quit'); return; }
      if (e === 'confirm') M.confirm();
      else if (DIRS[e]) M.nav(e);
    },

    // ---------- time ----------
    update(dt) {
      this.pollPad();
      for (const e of this.events.splice(0)) this.handle(e);
      V.tick(dt);
      A.update(this.state === 'play');
      if (this.state === 'paused') return;
      const quiet = this.state === 'title' || this.state === 'map';
      let played = false;
      while (this.queue.length && !V.busy()) { const ph = this.queue.shift(); this.playPhase(ph, quiet); played = true; if (ph.type === 'pop') break; }
      if (played && !this.queue.length) this.settleSoon = true;
      if (this.settleSoon && !this.queue.length && !V.busy()) { this.settleSoon = false; this.settle(); }
      if (quiet) {
        // the pool behind the title plays itself, slowly
        if (!this.queue.length && !V.busy()) {
          this.demoT -= dt;
          if (this.demoT <= 0) {
            const m = R.findMoves(this.s), pick = m[(Math.random() * m.length) | 0];
            if (!pick || this.s.movesUsed > 60) this.demo();
            else { R.swap(this.s, ...pick); this.queue = this.s.phases.slice(); this.demoT = 1.4; }
          }
        }
        return;
      }
      if (this.state === 'play' && this.canMove()) {
        this.idle += dt;
        if (this.settings.hints && this.idle > 7 && !V.hint) { const m = R.findMoves(this.s); if (m.length) V.hint = m[(Math.random() * m.length) | 0]; }
      }
      V.cursor = this.state === 'play' && (document.body.dataset.device === 'keyboard' || document.body.dataset.device === 'gamepad') ? this.cur : null;
    },
    render(ctx) { V.draw(ctx, this.s); },
  };
  TP.Game = G;
})();
