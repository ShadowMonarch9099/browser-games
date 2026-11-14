// Tick Talk: a bomb only one player can see, and a manual (manual.html) only
// the others can read. Each module has a rule in the manual that depends on
// the bomb's serial number. Three mistakes or a spent clock and it goes off.
// If you change a rule here, change manual.html to match.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  const save = Arcade.save('tick-talk');
  const rand = Arcade.rng();

  const DISPLAY = '"VT323", "Consolas", monospace';
  const BODY = '"Chivo Mono", "Consolas", monospace';
  const manualUrl = new URL('manual.html', location.href).href;
  const ui = Arcade.ui.create({
    title: 'Tick Talk',
    tagline: 'You see the bomb. They read the manual.',
    how: [['Bomb player', 'Looks at this screen. Must not see the manual'], ['Manual players', 'Open the manual on a phone. Must not see this screen'], ['Everyone', 'Describe, ask, decide. Out loud'], ['Manual', manualUrl.replace(/^https?:\/\//, '')]],
    // Tick Talk's own look: an old field terminal. Amber on olive drab.
    theme: {
      fonts: 'family=VT323&family=Chivo+Mono:wght@400;700',
      display: DISPLAY, body: BODY,
      overlay: 'rgba(10, 11, 6, .88)',
      panel: '#23261a', panel2: '#191b12', edge: '#ffb000',
      text: '#ffcf66', muted: '#a8935c',
      accent: '#ffb000', accentInk: '#1a1c14',
      radius: '2px', border: '2px',
      shadow: '0 0 0 4px #23261a, 0 0 0 5px #5c5a3c, 0 0 40px rgba(255,176,0,.15)', buttonShadow: 'none',
      caps: 'uppercase', titleSize: 'clamp(2.6rem, 12vw, 3.6rem)',
    },
  });

  const style = document.createElement('style');
  style.textContent = `
    .tt { position: fixed; inset: 0; z-index: 40; overflow: auto; padding: 64px 12px 20px; font-family: ${BODY}; color: #ffcf66; }
    .tt[hidden] { display: none; }
    .tt-head { max-width: 980px; margin: 0 auto 14px; display: flex; flex-wrap: wrap; gap: 10px; align-items: stretch; }
    .tt-lcd { background: #0d0e08; border: 2px solid #5c5a3c; padding: 4px 14px; font: 2.4rem/1 ${DISPLAY}; color: #ffb000; text-shadow: 0 0 8px rgba(255,176,0,.6); }
    .tt-lcd small { display: block; font: 700 .62rem ${BODY}; color: #a8935c; letter-spacing: .12em; text-shadow: none; }
    .tt-lcd.bad { color: #ff5a3c; text-shadow: 0 0 8px rgba(255,90,60,.7); }
    .tt-grid { max-width: 980px; margin: 0 auto; display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
    .tt-mod { background: #2c3021; border: 2px solid #5c5a3c; box-shadow: inset 0 0 0 4px #23261a; padding: 14px 14px 16px; min-height: 190px; position: relative; }
    .tt-mod h3 { margin: 0 0 12px; font: 700 .72rem ${BODY}; letter-spacing: .14em; color: #a8935c; text-transform: uppercase; }
    .tt-mod .lamp { position: absolute; top: 10px; right: 12px; width: 14px; height: 14px; border-radius: 50%; background: #3a2a10; border: 2px solid #1a1c14; }
    .tt-mod.solved .lamp { background: #6dff6d; box-shadow: 0 0 10px #6dff6d; }
    .tt-mod.solved { opacity: .7; pointer-events: none; }
    .tt-mod.shake { animation: tt-shake .3s; }
    @keyframes tt-shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
    .tt-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .tt button { font: 700 1rem ${BODY}; color: #ffcf66; background: #191b12; border: 2px solid #5c5a3c; padding: 8px 12px; cursor: pointer; min-width: 44px; min-height: 44px; }
    .tt button:hover { border-color: #ffb000; }
    .tt button:active { background: #3a3d28; }
    .tt button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    .tt .go { background: #ffb000; color: #1a1c14; border-color: #ffb000; }
    .tt .fuse { width: 40px; height: 84px; padding: 0; border-width: 3px; }
    .tt .fuse.gone { opacity: .15; pointer-events: none; }
    .tt .glyph { width: 60px; height: 60px; font-size: 1.7rem; }
    .tt .glyph.done { background: #3f5a2a; }
    .tt .sw { width: 52px; height: 72px; font-size: 1.5rem; }
    .tt .screen { background: #0d0e08; border: 2px solid #5c5a3c; color: #ffb000; font: 2rem/1.2 ${DISPLAY}; padding: 2px 12px; min-width: 96px; text-align: center; }
    .tt .bulb { width: 26px; height: 26px; border-radius: 50%; border: 2px solid #1a1c14; background: #3a2a10; }
    .tt .bulb.on { background: #ffb000; box-shadow: 0 0 12px #ffb000; }
    .tt .pad { display: grid; grid-template-columns: repeat(3, 48px); gap: 6px; }
    .tt .flash { width: 64px; height: 64px; border-radius: 50%; border: 3px solid #1a1c14; background: #191b12; }
    .tt .col { width: 52px; height: 52px; }
    .tt-foot { max-width: 980px; margin: 16px auto 0; color: #a8935c; font-size: .8rem; }`;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'tt'; root.hidden = true;
  document.body.appendChild(root);

  const COLORS = { red: '#e5383b', blue: '#3a86ff', yellow: '#ffd23f', green: '#52b788', white: '#f1f1e6' };
  const GLYPHS = ['◆', '☾', '▲', '♥', '✚', '★', '■', '♪', '●', '☂', '⚑', '✿'];   // "the Great Order" in the manual
  const WORDS = { ECHO: '1010', NOVA: '0011', ZINC: '1101', FERN: '0110', MOSS: '1000', OPAL: '0101' }; // 1 = up
  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const MAP_AM = { red: 'blue', blue: 'yellow', yellow: 'green', green: 'red' };
  const MAP_NZ = { red: 'green', green: 'yellow', yellow: 'blue', blue: 'red' };

  let state = 'menu', serial, timeLeft, strikes, mods, level, tickAt = 0, flashT = 0;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  function strike(mod) {
    strikes++;
    mod.box.classList.remove('shake'); void mod.box.offsetWidth; mod.box.classList.add('shake');
    Arcade.audio.sfx('hit');
    paintHead();
    if (strikes >= 3) end(false);
  }
  function solve(mod) {
    mod.solved = true; mod.box.classList.add('solved');
    Arcade.audio.sfx('coin');
    if (mods.every((m) => m.solved)) end(true);
  }

  // ---------- the six modules ----------
  const MAKERS = {
    fuses(mod) {
      const colors = Array.from({ length: 5 }, () => rand.pick(Object.keys(COLORS)));
      const same = colors.filter((c) => c === colors[0]).length;
      const answer = serial.vowel ? same : 6 - same;       // 1-based
      const row = el('div', 'tt-row');
      colors.forEach((c, i) => {
        const b = el('button', 'fuse'); b.style.background = COLORS[c]; b.setAttribute('aria-label', `Fuse ${i + 1}, ${c}`);
        b.onclick = () => { if (i + 1 === answer) { b.classList.add('gone'); solve(mod); } else strike(mod); };
        row.appendChild(b);
      });
      mod.body.append(row, el('p', '', 'Pull one fuse.'));
    },
    glyphs(mod) {
      const picks = rand.shuffle([...GLYPHS]).slice(0, 4);
      let order = [...picks].sort((a, b) => GLYPHS.indexOf(a) - GLYPHS.indexOf(b));
      if (serial.last % 2 === 0) order.reverse();
      let at = 0;
      const row = el('div', 'tt-row');
      picks.forEach((g) => {
        const b = el('button', 'glyph', g);
        b.onclick = () => {
          if (g === order[at]) { b.classList.add('done'); at++; Arcade.audio.sfx('blip'); if (at === 4) solve(mod); }
          else { at = 0; row.querySelectorAll('.done').forEach((d) => d.classList.remove('done')); strike(mod); }
        };
        row.appendChild(b);
      });
      mod.body.append(row, el('p', '', 'Press all four, in the right order.'));
    },
    dial(mod) {
      const lamps = [rand() < 0.5, rand() < 0.5, rand() < 0.5];
      const target = (lamps[0] * 4 + lamps[1] * 2 + lamps[2] * 1 + serial.last) % 8;
      let pos = rand.int(0, 7);
      const bulbs = el('div', 'tt-row'); lamps.forEach((on) => bulbs.appendChild(el('div', 'bulb' + (on ? ' on' : ''))));
      const screen = el('div', 'screen', DIRS[pos]);
      const row = el('div', 'tt-row');
      const turn = (d) => { pos = (pos + d + 8) % 8; screen.textContent = DIRS[pos]; Arcade.audio.sfx('blip'); };
      const l = el('button', '', '◀'), r = el('button', '', '▶'), go = el('button', 'go', 'Lock');
      l.onclick = () => turn(-1); r.onclick = () => turn(1);
      go.onclick = () => (pos === target ? solve(mod) : strike(mod));
      row.append(l, screen, r, go);
      mod.body.append(bulbs, el('p', '', 'Three lamps, then the dial.'), row);
    },
    switches(mod) {
      const word = rand.pick(Object.keys(WORDS));
      let want = WORDS[word];
      if (serial.vowel) want = [...want].map((c) => (c === '1' ? '0' : '1')).join('');
      let cur;
      do { cur = Array.from({ length: 4 }, () => (rand() < 0.5 ? '1' : '0')).join(''); } while (cur === want);
      const row = el('div', 'tt-row');
      const btns = [...cur].map((c, i) => {
        const b = el('button', 'sw', c === '1' ? '▲' : '▼');
        b.onclick = () => { cur = cur.slice(0, i) + (cur[i] === '1' ? '0' : '1') + cur.slice(i + 1); b.textContent = cur[i] === '1' ? '▲' : '▼'; Arcade.audio.sfx('blip'); };
        row.appendChild(b); return b;
      });
      const go = el('button', 'go', 'Set');
      go.onclick = () => (cur === want ? solve(mod) : strike(mod));
      row.appendChild(go);
      mod.body.append(el('div', 'screen', word), el('p', '', 'Four switches for this word.'), row);
      void btns;
    },
    code(mod) {
      const shown = rand.int(100, 899);
      const want = String((shown + serial.num) % 1000).padStart(3, '0');
      let typed = '';
      const out = el('div', 'screen', '___');
      const pad = el('div', 'pad');
      const paint = () => { out.textContent = typed.padEnd(3, '_'); };
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].forEach((k) => {
        const b = el('button', k === 'OK' ? 'go' : '', String(k));
        b.onclick = () => {
          if (k === 'C') typed = '';
          else if (k === 'OK') { if (typed === want) return solve(mod); typed = ''; strike(mod); }
          else if (typed.length < 3) typed += k;
          Arcade.audio.sfx('blip'); paint();
        };
        pad.appendChild(b);
      });
      const top = el('div', 'tt-row'); top.append(el('div', 'screen', String(shown)), el('span', '', '→'), out);
      mod.body.append(top, el('p', '', 'Enter the three-digit code.'), pad);
    },
    flash(mod) {
      const names = ['red', 'blue', 'yellow', 'green'];
      const seq = Array.from({ length: 3 }, () => rand.pick(names));
      const map = serial.letters[0] <= 'M' ? MAP_AM : MAP_NZ;
      const want = seq.map((c) => map[c]);
      let at = 0;
      const lamp = el('div', 'flash');
      mod.tick = (t) => {           // flash the three colours, then a gap
        const step = Math.floor(t / 0.6) % 5;
        lamp.style.background = step < 3 && (t % 0.6) < 0.42 ? COLORS[seq[step]] : '#191b12';
      };
      const row = el('div', 'tt-row');
      names.forEach((c) => {
        const b = el('button', 'col'); b.style.background = COLORS[c]; b.setAttribute('aria-label', c);
        b.onclick = () => { if (c === want[at]) { at++; Arcade.audio.sfx('blip'); if (at === 3) solve(mod); } else { at = 0; strike(mod); } };
        row.appendChild(b);
      });
      mod.body.append(lamp, el('p', '', 'Watch the lamp, then answer with three presses.'), row);
    },
  };
  const TITLES = { fuses: 'Fuse rack', glyphs: 'Glyph pad', dial: 'Compass dial', switches: 'Switchboard', code: 'Code lock', flash: 'Signal lamp' };

  let head;
  function paintHead() {
    const m = Math.floor(Math.max(0, timeLeft) / 60), s = Math.floor(Math.max(0, timeLeft) % 60);
    head.clock.firstChild.textContent = m + ':' + String(s).padStart(2, '0');
    head.clock.classList.toggle('bad', timeLeft < 30);
    head.strikes.firstChild.textContent = 'X'.repeat(strikes).padEnd(3, '-');
    head.strikes.classList.toggle('bad', strikes > 0);
  }

  function start(lv) {
    level = lv;
    const letters = Array.from({ length: 2 }, () => rand.pick([...'ABCDEFGHJKLMNPQRSTUVWXYZ'])).join('');
    const digits = String(rand.int(100, 999));
    serial = { letters, digits, vowel: /[AEU]/.test(letters), last: +digits[2], num: +digits };
    timeLeft = 300; strikes = 0;
    root.innerHTML = '';
    const top = el('div', 'tt-head');
    const lcd = (label, text) => { const d = el('div', 'tt-lcd'); d.append(document.createTextNode(text), el('small', '', label)); top.appendChild(d); return d; };
    head = { serial: lcd('SERIAL', letters + '-' + digits), clock: lcd('TIME', '5:00'), strikes: lcd('MISTAKES', '---') };
    const grid = el('div', 'tt-grid');
    const types = rand.shuffle(Object.keys(MAKERS)).slice(0, [3, 4, 6][lv]);
    mods = types.map((type) => {
      const box = el('section', 'tt-mod');
      box.append(el('h3', '', TITLES[type]), el('div', 'lamp'));
      const body = el('div'); box.appendChild(body);
      const mod = { type, box, body, solved: false };
      MAKERS[type](mod);
      grid.appendChild(box);
      return mod;
    });
    const foot = el('p', 'tt-foot', 'Manual for the others: ' + manualUrl);
    root.append(top, grid, foot);
    root.hidden = false;
    ui.hide(); input.flush();
    state = 'playing';
    paintHead();
  }

  function end(won) {
    state = 'over';
    Arcade.audio.sfx(won ? 'win' : 'lose');
    const used = 300 - Math.ceil(timeLeft);
    if (won) { const key = 'best' + level; const best = Math.min(used, save.get(key, 999)); save.set(key, best); }
    setTimeout(() => {
      root.hidden = true;
      ui.results({
        heading: won ? 'Defused!' : strikes >= 3 ? 'Boom. Too many mistakes' : 'Boom. Out of time',
        rows: [['Modules solved', mods.filter((m) => m.solved).length + ' / ' + mods.length], ['Time used', Math.floor(used / 60) + ':' + String(used % 60).padStart(2, '0')], ['Mistakes', strikes]],
        note: 'Swap seats: let someone else read the bomb next time.',
        buttons: [{ label: 'New bomb', onClick: () => start(level) }, { label: 'Change difficulty', onClick: menu }],
      });
    }, won ? 700 : 1100);
  }

  function update(dt) {
    input.poll();
    if (state !== 'playing' || ui.visible) return;
    timeLeft -= dt; flashT += dt;
    for (const m of mods) if (m.tick && !m.solved) m.tick(flashT);
    if (Math.ceil(timeLeft) !== tickAt) {
      tickAt = Math.ceil(timeLeft); paintHead();
      Arcade.audio.beep({ freq: timeLeft < 30 ? 1100 : 780, dur: 0.03, type: 'square', vol: 0.08 });
    }
    if (timeLeft <= 0) end(false);
  }

  function render() {
    // brushed olive metal with scanlines
    ctx.fillStyle = '#1a1c14'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255, 176, 0, .025)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  }

  ui.onPause(() => {
    if (state !== 'playing') return;
    root.hidden = true;     // hide the bomb while paused, so pausing is not free thinking time
    ui.pause({ onResume() { ui.hide(); root.hidden = false; }, onRestart: () => start(level) });
  });
  function menu() {
    state = 'menu'; root.hidden = true;
    ui.title({ buttons: [
      { label: 'Easy: 3 modules', onClick: () => start(0) }, { label: 'Medium: 4 modules', onClick: () => start(1) }, { label: 'Hard: 6 modules', onClick: () => start(2) },
    ] });
  }
  menu();
  Arcade.loop({ update, render }).start();
})();
