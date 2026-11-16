// Tick Talk game flow: the terminal (title), arming a bomb, the bomb itself
// (built as buttons, so the bomb player can tap, click or Tab through it),
// pause (which hides the bomb), and the after-action report. The answers come
// from rules.js, which tools/check-manual.js keeps in step with manual.html.
(function () {
  const R = TT.Rules, A = TT.Audio, M = TT.Menus;
  const $ = (id) => document.getElementById(id);
  const P = 'tick-talk:', mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(P + k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : d; };
  const set = (k, v) => { mem[k] = v; try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* not saved */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MANUAL = new URL('manual.html', location.href).href;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  const G = {
    state: 'title', from: 'title', level: 0, bomb: null, timeLeft: 300, strikes: 0, flashT: 0, tickAt: 0, muted: false, time: 0, swing: 0, dust: [],
    settings: Object.assign({ sfx: 8, music: 5, ticking: true, minutes: 5, letters: false, reduced: reduce }, get('settings', {})),

    init(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.dust = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), s: 0.3 + Math.random(), ph: Math.random() * 6 }));
      M.init((a) => this.act(a));
      this.buildSettings(); this.apply();
      $('b-url').textContent = MANUAL.replace(/^https?:\/\//, '');
      $('m-url').textContent = MANUAL.replace(/^https?:\/\//, '');
      if (!navigator.share) $('m-share').textContent = 'Open the manual here';
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        A.unlock();
        const k = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'confirm', Escape: 'back', KeyP: 'pause', KeyM: 'mute' }[e.code];
        if (!k) return;
        if (this.state === 'play') {
          if (k === 'back' || k === 'pause') { e.preventDefault(); this.pause(); }
          if (k === 'mute') this.mute();
          return;
        }
        e.preventDefault();
        if (k === 'mute') return this.mute();
        const cur = M.current && M.current.id;
        if (k === 'back' || k === 'pause') {
          if (cur === 's-pause') this.resume();
          else if (['s-setup', 's-manual', 's-settings', 's-how'].includes(cur)) this.act('back');
          return;
        }
        if (k === 'confirm') M.confirm(); else M.nav(k);
      });
      addEventListener('pointerdown', () => A.unlock());
      this.showTitle(true);
    },
    mute() { this.muted = !this.muted; this.apply(); M.toast(this.muted ? 'Sound off' : 'Sound on'); },
    apply() {
      const s = this.settings;
      A.setVolumes(this.muted ? 0 : s.sfx, this.muted ? 0 : s.music);
      A.ticking = !!s.ticking;
      document.body.classList.toggle('reduced', !!s.reduced);
      document.body.classList.toggle('letters', !!s.letters);
      set('settings', s);
    },
    buildSettings() {
      const s = this.settings, ch = (k) => (v) => { s[k] = v; this.apply(); };
      const fs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
      M.renderSettings([
        { key: 'sfx', label: 'Sound effects', type: 'slider', get: () => s.sfx, set: ch('sfx') },
        { key: 'music', label: 'Tension drone', type: 'slider', get: () => s.music, set: ch('music') },
        { key: 'ticking', label: 'Ticking clock', type: 'toggle', get: () => s.ticking, set: ch('ticking') },
        { key: 'minutes', label: 'Clock', note: 'The manual assumes five minutes', type: 'action', text: () => `${s.minutes}:00`, run: () => { s.minutes = s.minutes === 3 ? 5 : s.minutes === 5 ? 8 : 3; this.apply(); } },
        { key: 'letters', label: 'Colour letters', note: 'Print R, B, Y, G, W on coloured parts', type: 'toggle', get: () => s.letters, set: ch('letters') },
        { key: 'reduced', label: 'Reduced motion', type: 'toggle', get: () => s.reduced, set: ch('reduced') },
        { key: 'fs', label: 'Fullscreen', type: 'action', text: () => (fs() ? 'On' : 'Off'), run: () => { this.fullscreen(); setTimeout(() => M.paintSettings(), 300); } },
      ]);
    },
    fullscreen() {
      const d = document, el2 = d.documentElement;
      try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el2.requestFullscreen || el2.webkitRequestFullscreen).call(el2); } catch (e) { M.toast('No fullscreen here'); }
    },

    // ---------- screens ----------
    showTitle(boot) {
      this.state = 'title';
      M.show('title');
      const lines = ['FIELD TERMINAL v3.1', 'CHECKING WIRES........OK', 'CHECKING NERVES.......??', 'LOADING MANUAL LINK...OK', '> READY'];
      const box = $('boot');
      if (!boot || this.settings.reduced) { box.textContent = lines.join('\n'); return; }
      box.textContent = '';
      lines.forEach((l, i) => setTimeout(() => { box.textContent += (i ? '\n' : '') + l; A.play('key', i); }, 160 + i * 220));
    },
    showSetup() {
      for (let i = 0; i < 3; i++) { const b = get('best' + i, null); $('best-' + i).textContent = typeof b === 'number' && b < 999 ? `Best ${fmt(b)}` : 'No record'; }
      this.from = 'title'; A.play('confirm'); M.show('setup', true);
    },
    act(a) {
      if (a && a.startsWith('arm-')) return this.arm(+a.slice(4));
      switch (a) {
        case 'setup': return this.showSetup();
        case 'manual': this.from = 'title'; A.play('confirm'); return M.show('manual', true);
        case 'share':
          if (navigator.share) navigator.share({ title: 'Tick Talk manual', text: 'The defusal manual. Do not show the bomb player!', url: MANUAL }).catch(() => {});
          else window.open(MANUAL, '_blank', 'noopener');
          return;
        case 'copy':
          try { navigator.clipboard.writeText(MANUAL).then(() => M.toast('Link copied'), () => M.toast('Copy failed: select the link above')); } catch (e) { M.toast('Select the link above to copy it'); }
          return;
        case 'how': this.from = this.state === 'paused' ? 'pause' : 'title'; A.play('confirm'); return M.show('how', true);
        case 'settings': this.from = this.state === 'paused' ? 'pause' : 'title'; this.buildSettings(); A.play('confirm'); return M.show('settings', true);
        case 'back': A.play('back'); if (this.from === 'title') return this.showTitle(false); return M.show(this.from, true);
        case 'pause': return this.pause();
        case 'resume': return this.resume();
        case 'restart': return this.arm(this.level);
        case 'quit': A.play('back'); A.setDrone(false); $('bomb').classList.add('off'); $('pause-btn').classList.add('off'); return this.showTitle(false);
      }
    },
    pause() {
      if (this.state !== 'play') return;
      this.state = 'paused'; A.play('back'); A.setDrone(false);
      $('bomb').classList.add('off'); $('pause-btn').classList.add('off');   // no free thinking time
      M.show('pause', true);
    },
    resume() {
      if (this.state !== 'paused') return;
      this.state = 'play'; A.play('confirm');
      $('bomb').classList.remove('off'); $('pause-btn').classList.remove('off');
      M.show(null);
    },

    // ---------- the bomb ----------
    arm(level) {
      A.play('confirm');
      M.fade(true);
      setTimeout(() => {
        this.level = level;
        this.bomb = R.makeBomb(level);
        this.timeLeft = this.settings.minutes * 60; this.total = this.timeLeft; this.strikes = 0; this.flashT = 0; this.tickAt = 0;
        $('b-serial').textContent = this.bomb.serial.text;
        const grid = $('b-grid'); grid.innerHTML = '';
        for (const mod of this.bomb.mods) {
          const box = el('section', 'mod');
          box.append(el('h3', '', R.TITLES[mod.type]), el('i', 'done-lamp'));
          const body = el('div'); box.appendChild(body);
          mod.box = box; mod.body = body;
          this.build[mod.type].call(this, mod);
          grid.appendChild(box);
        }
        $('bomb').classList.remove('off', 'boom'); $('pause-btn').classList.remove('off');
        this.paint();
        this.state = 'play';
        M.show(null); M.fade(false);
        A.play('boot');
        M.toast(`Serial ${this.bomb.serial.text}`);
      }, this.settings.reduced ? 0 : 280);
    },
    strike(mod) {
      if (this.state !== 'play') return;
      this.strikes++;
      mod.box.classList.remove('shake'); void mod.box.offsetWidth; mod.box.classList.add('shake');
      A.play('strike');
      this.paint();
      if (this.strikes >= 3) this.end(false);
    },
    solve(mod) {
      mod.solved = true; mod.box.classList.add('solved');
      A.play('solve');
      if (this.bomb.mods.every((m) => m.solved)) this.end(true);
    },
    build: {
      fuses(mod) {
        const ans = R.answers.fuses(this.bomb.serial, mod.colors), row = el('div', 'row');
        mod.colors.forEach((c, i) => {
          const b = el('button', 'fuse'); b.style.setProperty('--c', R.COLORS[c]); b.setAttribute('aria-label', `Fuse ${i + 1}, ${c}`);
          b.appendChild(el('span', 'tag', c[0].toUpperCase()));
          b.onclick = () => { if (i + 1 === ans) { b.classList.add('gone'); A.play('snip'); this.solve(mod); } else { A.play('snip'); this.strike(mod); } };
          row.appendChild(b);
        });
        mod.body.append(row, el('p', '', 'Pull one fuse.'));
      },
      glyphs(mod) {
        const order = R.answers.glyphs(this.bomb.serial, mod.picks), row = el('div', 'row');
        let at = 0;
        mod.picks.forEach((g) => {
          const b = el('button', 'glyph', g); b.setAttribute('aria-label', R.GLYPH_NAMES[R.GLYPHS.indexOf(g)]);
          b.onclick = () => {
            if (g === order[at]) { b.classList.add('done'); at++; A.play('key', at); if (at === 4) this.solve(mod); }
            else { at = 0; row.querySelectorAll('.done').forEach((d) => d.classList.remove('done')); this.strike(mod); }
          };
          row.appendChild(b);
        });
        mod.body.append(row, el('p', '', 'Press all four, in the right order.'));
      },
      dial(mod) {
        const target = R.answers.dial(this.bomb.serial, mod.lamps);
        let pos = mod.pos;
        const bulbs = el('div', 'row'); mod.lamps.forEach((on) => bulbs.appendChild(el('i', 'bulb' + (on ? ' on' : ''))));
        const dial = el('div', 'dial'), needle = el('i', 'needle'), dir = el('span', 'dir', R.DIRS[pos]);
        dial.append(needle, dir);
        let turns = pos;
        const paint = () => { needle.style.transform = `rotate(${turns * 45}deg)`; dir.textContent = R.DIRS[pos]; };
        paint();
        const turn = (d) => { pos = (pos + d + 8) % 8; turns += d; paint(); A.play('click'); };
        const l = el('button', '', '⟲'), r = el('button', '', '⟳'), go = el('button', 'go', 'Lock');
        l.setAttribute('aria-label', 'Turn left'); r.setAttribute('aria-label', 'Turn right');
        l.onclick = () => turn(-1); r.onclick = () => turn(1);
        go.onclick = () => (pos === target ? this.solve(mod) : this.strike(mod));
        const row = el('div', 'row'); row.append(l, dial, r, go);
        mod.body.append(bulbs, el('p', '', 'Three lamps, then the dial.'), row);
      },
      switches(mod) {
        const want = R.answers.switches(this.bomb.serial, mod.word), row = el('div', 'row');
        let cur = mod.cur;
        [...cur].forEach((c, i) => {
          const b = el('button', 'toggle ' + (c === '1' ? 'up' : 'down')); b.append(el('i'), el('small', '', String(i + 1)));
          b.setAttribute('aria-label', `Switch ${i + 1}`);
          b.onclick = () => { cur = cur.slice(0, i) + (cur[i] === '1' ? '0' : '1') + cur.slice(i + 1); b.classList.toggle('up', cur[i] === '1'); b.classList.toggle('down', cur[i] === '0'); A.play('click'); };
          row.appendChild(b);
        });
        const go = el('button', 'go', 'Set');
        go.onclick = () => (cur === want ? this.solve(mod) : this.strike(mod));
        row.appendChild(go);
        mod.body.append(el('div', 'screenlcd', mod.word), el('p', '', 'Four switches for this word.'), row);
      },
      code(mod) {
        const want = R.answers.code(this.bomb.serial, mod.shown);
        let typed = '';
        const out = el('div', 'screenlcd', '___'), pad = el('div', 'pad'), paint = () => { out.textContent = typed.padEnd(3, '_'); };
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].forEach((k) => {
          const b = el('button', k === 'OK' ? 'go' : '', String(k));
          b.onclick = () => {
            if (k === 'C') typed = '';
            else if (k === 'OK') { if (typed === want) return this.solve(mod); typed = ''; this.strike(mod); }
            else if (typed.length < 3) typed += k;
            A.play('key', typeof k === 'number' ? k : 0); paint();
          };
          pad.appendChild(b);
        });
        const top = el('div', 'row'); top.append(el('div', 'screenlcd', String(mod.shown)), el('span', '', '→'), out);
        mod.body.append(top, el('p', '', 'Enter the three-digit code.'), pad);
      },
      flash(mod) {
        const want = R.answers.flash(this.bomb.serial, mod.seq), lamp = el('div', 'signal');
        let at = 0;
        mod.tick = (t) => { const step = Math.floor(t / 0.6) % 5; lamp.style.background = step < 3 && t % 0.6 < 0.42 ? R.COLORS[mod.seq[step]] : '#191b12'; lamp.style.boxShadow = step < 3 && t % 0.6 < 0.42 ? `0 0 26px ${R.COLORS[mod.seq[step]]}` : 'none'; };
        const row = el('div', 'row');
        ['red', 'blue', 'yellow', 'green'].forEach((c) => {
          const b = el('button', 'col'); b.style.setProperty('--c', R.COLORS[c]); b.setAttribute('aria-label', c); b.appendChild(el('span', '', c[0].toUpperCase()));
          b.onclick = () => { if (c === want[at]) { at++; A.play('key', at * 2); if (at === 3) this.solve(mod); } else { at = 0; this.strike(mod); } };
          row.appendChild(b);
        });
        mod.body.append(lamp, el('p', '', 'Watch the lamp, then answer with three presses.'), row);
      },
    },
    paint() {
      $('b-clock').textContent = fmt(Math.max(0, Math.ceil(this.timeLeft)));
      $('b-clockbox').classList.toggle('bad', this.timeLeft < 30);
      [...$('b-strikes').children].forEach((l, i) => l.classList.toggle('on', i < this.strikes));
    },
    end(won) {
      this.state = 'over';
      A.setDrone(false);
      const used = Math.round(this.total - Math.max(0, this.timeLeft)), solved = this.bomb.mods.filter((m) => m.solved).length;
      let best = get('best' + this.level, null);
      if (won && this.total === 300) { best = Math.min(used, typeof best === 'number' ? best : 999); set('best' + this.level, best); }
      if (won) A.play('defused');
      else { A.play('boom'); if (!this.settings.reduced) { $('flash').classList.remove('on'); void $('flash').offsetWidth; $('flash').classList.add('on'); } $('bomb').classList.add('boom'); this.smoke = 1; }
      setTimeout(() => {
        $('bomb').classList.add('off'); $('pause-btn').classList.add('off');
        $('r-kicker').textContent = `${['Easy', 'Medium', 'Hard'][this.level]} bomb · serial ${this.bomb.serial.text}`;
        $('r-title').textContent = won ? 'Defused!' : this.strikes >= 3 ? 'Boom. Too many mistakes' : 'Boom. Out of time';
        $('r-stats').innerHTML = [[`${solved}/${this.bomb.mods.length}`, 'modules'], [fmt(used), 'time used'], [this.strikes, 'mistakes']].map(([b, s]) => `<div><b>${b}</b><small>${s}</small></div>`).join('') +
          (won && typeof best === 'number' && best < 999 && this.total === 300 ? `<div style="grid-column: 1 / -1"><b>${fmt(best)}</b><small>best at this difficulty</small></div>` : '');
        M.show('result', true);
      }, won ? 900 : 1500);
    },

    // ---------- time and the room ----------
    update(dt) {
      this.time += dt; this.swing += dt;
      this.smoke = Math.max(0, (this.smoke || 0) - dt * 0.4);
      if (this.state !== 'play') return;
      this.timeLeft -= dt; this.flashT += dt;
      for (const m of this.bomb.mods) if (m.tick && !m.solved) m.tick(this.flashT);
      const urgent = this.timeLeft < 30;
      A.setDrone(true, Math.max(0, 1 - this.timeLeft / this.total));
      // tick every second, twice a second when time is short
      const beat = urgent ? Math.ceil(this.timeLeft * 2) : Math.ceil(this.timeLeft);
      if (beat !== this.tickAt) { this.tickAt = beat; this.paint(); A.play('tick', urgent ? 1 : 0); }
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.paint(); this.end(false); }
    },
    render() {
      const c = this.ctx, W = this.W, H = this.H;
      const wall = c.createLinearGradient(0, 0, 0, H);
      wall.addColorStop(0, '#1d1f14'); wall.addColorStop(0.62, '#15160e'); wall.addColorStop(0.62, '#0f100a'); wall.addColorStop(1, '#0a0b06');
      c.fillStyle = wall; c.fillRect(0, 0, W, H);
      // concrete blocks
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2;
      for (let y = 0, r = 0; y < H * 0.62; y += 46, r++) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); for (let x = (r % 2) * 60; x < W; x += 120) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 46); c.stroke(); } }
      // the swinging lamp and its cone of light
      const ang = this.settings.reduced ? 0 : Math.sin(this.swing * 0.9) * 0.08, lx = W / 2 + Math.sin(ang) * H * 0.3, ly = 40;
      c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(lx, ly); c.stroke();
      const cone = c.createRadialGradient(lx, ly, 10, lx + Math.sin(ang) * H, H * 0.75, H * 0.8);
      cone.addColorStop(0, 'rgba(255,207,102,0.22)'); cone.addColorStop(1, 'rgba(255,207,102,0)');
      c.fillStyle = cone; c.beginPath(); c.moveTo(lx - 20, ly); c.lineTo(lx + 20, ly); c.lineTo(lx + Math.sin(ang) * H * 1.2 + W * 0.45, H); c.lineTo(lx + Math.sin(ang) * H * 1.2 - W * 0.45, H); c.closePath(); c.fill();
      c.fillStyle = '#3a3e2c'; c.beginPath(); c.moveTo(lx - 26, ly + 18); c.lineTo(lx + 26, ly + 18); c.lineTo(lx + 12, ly); c.lineTo(lx - 12, ly); c.closePath(); c.fill();
      c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(lx, ly + 18, 8, 0, Math.PI); c.fill();
      // dust in the light
      c.fillStyle = 'rgba(255,230,170,0.35)';
      for (const d of this.dust) { const x = ((d.x + Math.sin(this.time * 0.1 + d.ph) * 0.02) * W), y = ((d.y + this.time * 0.006 * d.s) % 1) * H; c.fillRect(x, y, 1.5 * d.s, 1.5 * d.s); }
      if (this.smoke > 0) { c.fillStyle = `rgba(30,30,25,${this.smoke * 0.7})`; c.fillRect(0, 0, W, H); }
    },
    resize(W, H) { this.W = W; this.H = H; },
  };
  TT.Game = G;
})();
