// Borrowed Boots: the state machine and everything that happens on a page.
// The platformer rules themselves live in sim.js (shared with the level
// checker in tools/); this file feeds them input, listens to their events
// and turns those into effects, sound and progress.
//
// States: title, slots, map, play, paused, won, plus the settings, help and
// codex screens, which return to whichever screen opened them.
(function () {
  const C = BB.CFG;
  const T = C.T;
  const A = BB.Audio;
  const I = BB.Input;
  const S = window.BootsSim;
  const LEVELS = window.BootsLevels;
  const U = BB.U;
  BB.LEVELS = LEVELS;

  // the first page each creature appears on (the codex unlocks from this)
  const FIRST = {};
  LEVELS.forEach((l, i) => {
    for (const ch of 'bgot') if (FIRST[ch] === undefined && l.map.join('').includes(ch)) FIRST[ch] = i;
  });
  BB.FIRST = FIRST;

  const MENU_STATES = new Set(['title', 'paused', 'settings', 'help', 'won']);

  class Game {
    constructor() {
      this.save = BB.Save.load();
      this.settings = this.save.settings;
      A.setVolumes(this.settings.sfx, this.settings.music);
      this.state = 'title';
      this.stateT = 0;
      this.focus = 0;
      this.back = null;
      this.time = 0;
      this.buttons = [];
      this.fx = [];
      this.floaters = [];
      this.shake = 0;
      this.hitstop = 0;
      this.iris = null; // { t, phase: 'close'|'open', then }
      this.slotSel = this.save.last;
      this.slot = null;
      this.mapSel = 0;
      this.token = 0;
      this.codexPage = 0;
      this.codexFrom = 0;
      this.confirmErase = -1;
      this.levelIndex = 0;
      this.ambient = [];
      this.clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 230 + U.hash(i, 1) * 120, y: 50 + U.hash(i, 2) * 120, s: 0.6 + U.hash(i, 3) * 0.6, v: 6 + U.hash(i, 4) * 8 }));
      this.makeDemo();
      this.seedAmbient(0);
    }

    get book() {
      return this.slot === null ? null : this.save.slots[this.slot];
    }

    // ---------- flow ----------

    setState(s) {
      this.state = s;
      this.stateT = 0;
      this.focus = 0;
      this.confirmErase = -1;
    }

    // Iris wipe: close, swap screens, open.
    go(fn) {
      if (this.iris && this.iris.phase === 'close') return;
      A.play('page');
      this.iris = { t: 0, phase: 'close', then: fn };
    }

    openSub(s) {
      this.back = { state: this.state, focus: this.focus };
      this.setState(s);
      A.play('page');
    }

    closeSub() {
      const b = this.back || { state: 'title', focus: 0 };
      this.setState(b.state);
      this.focus = b.focus;
      this.back = null;
    }

    store() {
      BB.Save.store(this.save);
    }

    applySettings() {
      A.setVolumes(this.settings.sfx, this.settings.music);
      this.store();
    }

    toast(str, life = 2) {
      this.toastMsg = { str, life, max: life };
    }

    // ---------- books (save slots) ----------

    openBook(i) {
      if (!this.save.slots[i]) {
        this.save.slots[i] = BB.Save.blankSlot();
        this.toast('A new story begins');
      }
      this.slot = i;
      this.save.last = i;
      this.store();
      this.go(() => this.goMap(Math.min(this.book.unlocked, LEVELS.length) - 1));
    }

    eraseBook(i) {
      if (!this.save.slots[i]) return;
      if (this.confirmErase !== i) {
        this.confirmErase = i;
        A.play('denied');
        return;
      }
      this.save.slots[i] = null;
      this.confirmErase = -1;
      this.store();
      A.play('drop');
      this.toast('Book ' + (i + 1) + ' erased');
    }

    goMap(sel) {
      this.setState('map');
      this.mapSel = sel !== undefined ? sel : this.mapSel;
      this.token = this.mapSel;
      this.seedAmbient(LEVELS[this.mapSel].chapter);
    }

    goTitle() {
      this.setState('title');
      this.seedAmbient(0);
    }

    // ---------- pages (levels) ----------

    startLevel(i) {
      this.levelIndex = i;
      this.mapSel = i;
      const def = LEVELS[i];
      this.chapter = def.chapter;
      this.sim = S.create(def);
      this.terrain = BB.World.makeTerrain(this.sim, this.chapter);
      this.backdrop = BB.World.backdrop(this.chapter);
      this.fx = [];
      this.floaters = [];
      this.shake = 0;
      this.hitstop = 0;
      this.started = false;
      this.result = null;
      this.introT = 0;
      this.hero = this.newHeroAnim();
      this.cam = { x: 0, y: 0 };
      this.snapCamera();
      this.seedAmbient(this.chapter);
      this.setState('play');
      I.reset();
    }

    newHeroAnim() {
      return { sq: 1, phase: 0, stepT: 0, glideT: 0, climbT: 0, popT: 1, ouch: 0, lastPower: null };
    }

    snapCamera() {
      const p = this.sim.p;
      this.cam.x = U.clamp(p.x * T - C.W / 2, 0, this.sim.cols * T - C.W);
      this.cam.y = U.clamp(p.y * T - C.H * 0.6, 0, this.sim.rows * T - C.H);
    }

    pause() {
      if (this.state !== 'play') return;
      this.setState('paused');
      I.reset();
    }

    resume() {
      this.setState('play');
      I.reset();
    }

    restart() {
      this.go(() => this.startLevel(this.levelIndex));
    }

    win() {
      const s = this.sim;
      const i = this.levelIndex;
      const b = this.book;
      const prev = b.levels[i] || {};
      const newBest = prev.best === undefined || s.time < prev.best;
      b.levels[i] = { stars: Math.max(prev.stars || 0, s.got), best: newBest ? s.time : prev.best };
      const wasNew = b.unlocked < i + 2 && i + 1 < LEVELS.length;
      b.unlocked = Math.max(b.unlocked, Math.min(i + 2, LEVELS.length));
      this.store();
      this.result = { stars: s.got, total: s.stars.length, time: s.time, deaths: s.deaths, newBest, t: 0, unlockedNew: wasNew, popped: 0 };
      this.setState('won');
      A.play('win');
      const p = s.p;
      for (let k = 0; k < 40; k++) this.confetti(p.x * T, p.y * T - 30);
    }

    nextLevel() {
      if (this.levelIndex + 1 < LEVELS.length) this.go(() => this.startLevel(this.levelIndex + 1));
      else this.go(() => this.goMap(this.levelIndex));
    }

    // ---------- menus ----------

    menu() {
      const s = this.settings;
      const slider = (key, label) => ({
        label,
        slider: () => s[key],
        adjust: (d, wrap) => {
          s[key] = wrap ? (s[key] + d + 11) % 11 : U.clamp(s[key] + d, 0, 10);
          this.applySettings();
          A.play('click');
        },
      });
      const toggle = (key, label, sub) => ({
        label,
        sub,
        toggle: () => s[key],
        adjust: () => {
          s[key] = !s[key];
          this.applySettings();
          A.play('click');
        },
      });
      switch (this.state) {
        case 'title': {
          const last = this.save.slots[this.save.last];
          const items = [];
          if (last) {
            const stars = this.bookStars(last);
            items.push({ label: 'Continue', sub: 'Book ' + (this.save.last + 1) + ' · page ' + Math.min(last.unlocked, 12) + ' · ' + stars + '★', action: () => this.openBook(this.save.last) });
          }
          items.push({ label: last ? 'Storybooks' : 'Start a story', action: () => this.go(() => this.setState('slots')) });
          items.push({ label: 'Creature Book', action: () => this.openCodex(0) });
          items.push({ label: 'How to Play', action: () => this.openSub('help') });
          items.push({ label: 'Settings', action: () => this.openSub('settings') });
          return { items };
        }
        case 'paused':
          return {
            items: [
              { label: 'Keep going', action: () => this.resume() },
              { label: 'Start the page again', action: () => this.restart() },
              { label: 'Creature Book', action: () => this.openCodex(this.sim.p.power ? BB.ORDER.indexOf(this.sim.p.power) + 1 : 0) },
              { label: 'How to Play', action: () => this.openSub('help') },
              { label: 'Settings', action: () => this.openSub('settings') },
              { label: 'Back to the map', action: () => this.go(() => this.goMap(this.levelIndex)) },
            ],
            back: () => this.resume(),
          };
        case 'settings': {
          const items = [slider('sfx', 'Sound effects'), slider('music', 'Music'), toggle('shake', 'Screen shake'), toggle('motion', 'Wobbly motion', 'Off calms animations'), toggle('tips', 'Page tips')];
          const P = BB.Platform;
          if (P && P.canFullscreen()) items.push({ label: 'Fullscreen', toggle: () => P.isFullscreen(), adjust: () => P.toggleFullscreen() });
          items.push({ label: 'Back', action: () => this.closeSub() });
          return { items, back: () => this.closeSub() };
        }
        case 'help':
          return { items: [{ label: 'Got it', action: () => this.closeSub() }], back: () => this.closeSub() };
        case 'won': {
          const last = this.levelIndex + 1 >= LEVELS.length;
          return {
            items: [
              { label: last ? 'The end. Back to the map' : 'Turn the page', action: () => this.nextLevel() },
              { label: 'Play it again', action: () => this.restart() },
              { label: 'Story map', action: () => this.go(() => this.goMap(this.levelIndex)) },
            ],
            back: () => this.go(() => this.goMap(this.levelIndex)),
          };
        }
      }
      return { items: [] };
    }

    bookStars(b) {
      return Object.values(b.levels).reduce((n, l) => n + (l.stars || 0), 0);
    }

    handleMenu() {
      const m = this.menu();
      const n = m.items.length;
      if (!n) return;
      this.focus = Math.min(this.focus, n - 1);
      if (I.nav('up')) {
        this.focus = (this.focus - 1 + n) % n;
        A.play('move');
      }
      if (I.nav('down')) {
        this.focus = (this.focus + 1) % n;
        A.play('move');
      }
      const it = m.items[this.focus];
      if (it.adjust) {
        if (I.nav('left')) it.adjust(-1);
        if (I.nav('right')) it.adjust(1);
      }
      if (I.nav('confirm')) this.activate(it);
      else if (I.nav('back') && m.back) {
        A.play('click');
        m.back();
      }
    }

    activate(it) {
      this.pulse = 0.25;
      if (it.action) {
        A.play('click');
        it.action();
      } else if (it.adjust) it.adjust(1, true);
    }

    openCodex(page) {
      this.codexPage = page;
      this.codexFrom = page;
      this.openSub('codex');
    }

    codexUnlocked(page) {
      if (page === 0 || page === 5) return true;
      const ch = BB.ORDER[page - 1];
      // met once its page is open in any book
      return this.save.slots.some((b) => b && b.unlocked > FIRST[ch]);
    }

    // ---------- update ----------

    hit(p) {
      for (let i = this.buttons.length - 1; i >= 0; i--) {
        const b = this.buttons[i];
        if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b;
      }
      return null;
    }

    update(dt) {
      this.time += dt;
      this.stateT += dt;
      if (this.pulse > 0) this.pulse -= dt;
      if (this.toastMsg && (this.toastMsg.life -= dt) <= 0) this.toastMsg = null;
      I.playMode = this.state === 'play';
      this.updateAmbient(dt);

      if (this.iris) {
        const ir = this.iris;
        ir.t += dt;
        if (ir.phase === 'close' && ir.t >= 0.3) {
          ir.then();
          ir.phase = 'open';
          ir.t = 0;
        } else if (ir.phase === 'open' && ir.t >= 0.4) this.iris = null;
        if (this.iris && this.iris.phase === 'close') {
          this.tickMusic();
          return; // no input while the page turns
        }
      }

      if (I.mouseMoved && I.mouse) {
        const b = this.hit(I.mouse);
        if (b && b.focus !== undefined && b.focus !== this.focus) {
          this.focus = b.focus;
          A.play('move');
        }
        if (b && b.hover) b.hover();
      }
      for (const c of I.clicks) {
        const b = this.hit(c);
        if (b) {
          if (b.focus !== undefined) this.focus = b.focus;
          b.action();
          this.tickMusic();
          return;
        }
      }

      if (this.state === 'title' || this.state === 'slots' || (this.back && this.back.state === 'title')) this.updateDemo(dt);

      switch (this.state) {
        case 'play':
          this.updatePlay(dt);
          break;
        case 'paused':
          if (I.hit('KeyP', 'PadStart')) this.resume();
          else if (I.hit('KeyR', 'PadY')) this.restart();
          else this.handleMenu();
          break;
        case 'won':
          this.result.t += dt;
          this.updateFx(dt);
          this.updateHero(dt);
          if (I.hit('KeyR', 'PadY')) this.restart();
          else if (this.result.t > 1.2) this.handleMenu();
          break;
        case 'slots':
          this.updateSlots();
          break;
        case 'map':
          this.updateMap(dt);
          break;
        case 'codex':
          this.updateCodex();
          break;
        default:
          if (MENU_STATES.has(this.state)) this.handleMenu();
      }
      this.tickMusic();
    }

    tickMusic() {
      let style = 'title';
      const s = this.state;
      const under = this.back ? this.back.state : null;
      if (s === 'map' || under === 'map') style = 'map';
      if (s === 'play' || s === 'paused' || s === 'won' || under === 'paused') style = BB.THEMES[this.chapter || 0].music;
      if (s === 'won' && this.levelIndex === LEVELS.length - 1) style = 'end';
      A.setSong(style, style === 'title' || style === 'map' ? 0 : this.levelIndex + 1);
      A.layer = s === 'play' && this.sim ? this.sim.p.power : null;
      A.update();
    }

    updateSlots() {
      const n = BB.Save.SLOTS;
      const prev = this.slotSel;
      if (I.nav('left') || I.nav('up')) this.slotSel = (this.slotSel - 1 + n) % n;
      if (I.nav('right') || I.nav('down')) this.slotSel = (this.slotSel + 1) % n;
      if (prev !== this.slotSel) {
        this.confirmErase = -1;
        A.play('move');
      }
      if (I.nav('confirm')) {
        A.play('click');
        this.openBook(this.slotSel);
      } else if (I.nav('alt')) this.eraseBook(this.slotSel);
      else if (I.nav('back')) {
        A.play('click');
        this.go(() => this.goTitle());
      }
    }

    updateMap(dt) {
      const max = Math.min(this.book.unlocked, LEVELS.length) - 1;
      const prev = this.mapSel;
      if (I.nav('right') || I.nav('down')) this.mapSel = Math.min(max, this.mapSel + 1);
      if (I.nav('left') || I.nav('up')) this.mapSel = Math.max(0, this.mapSel - 1);
      if (I.nav('right') && prev === max && max < LEVELS.length - 1) A.play('denied');
      if (prev !== this.mapSel) A.play('move');
      // the token walks along the path to the chosen page
      const d = this.mapSel - this.token;
      if (Math.abs(d) > 0.001) {
        const step = Math.sign(d) * Math.min(Math.abs(d), dt * 3.2);
        const before = Math.floor(this.token * 4);
        this.token += step;
        if (Math.floor(this.token * 4) !== before) A.play('walk');
      }
      if (I.nav('confirm')) this.playSelected();
      else if (I.hit('KeyC', 'PadY')) this.openCodex(0);
      else if (I.nav('back')) {
        A.play('click');
        this.go(() => this.setState('slots'));
      }
    }

    playSelected() {
      A.play('click');
      const i = this.mapSel;
      this.go(() => this.startLevel(i));
    }

    updateCodex() {
      const prev = this.codexPage;
      if (I.nav('right') || I.nav('down')) this.codexPage = Math.min(5, this.codexPage + 1);
      if (I.nav('left') || I.nav('up')) this.codexPage = Math.max(0, this.codexPage - 1);
      if (prev !== this.codexPage) this.flipPage(prev);
      if (I.nav('back') || I.nav('confirm')) {
        A.play('click');
        this.closeSub();
      }
    }

    flipPage(prev) {
      this.codexFrom = prev;
      this.codexFlip = 0;
      A.play('page');
    }

    // ---------- the title-screen demo: Pip strolls through page one ----------

    makeDemo() {
      const sim = S.create(LEVELS[0]);
      this.demo = { sim, terrain: null, cam: { x: 0, y: 0 }, hero: this.newHeroAnim(), t: 0, jumpHeld: 0 };
    }

    updateDemo(dt) {
      const d = this.demo;
      if (!d.terrain) {
        d.terrain = BB.World.makeTerrain(d.sim, 0);
        d.backdrop = BB.World.backdrop(0);
      }
      const s = d.sim;
      const p = s.p;
      d.t += dt;
      // a tiny bot: run right, hop over anything in the way
      const fx = Math.floor(p.x + 0.9);
      const fy = Math.floor(p.y - 0.5);
      const wallAhead = S.solid(S.tile(s, fx, fy)) || S.solid(S.tile(s, fx, fy - 1));
      const pitAhead = !S.solid(S.tile(s, Math.floor(p.x + 1.2), Math.floor(p.y + 0.2)));
      const spikeAhead = S.tile(s, Math.floor(p.x + 1.4), Math.floor(p.y - 0.1)) === '^' || S.tile(s, Math.floor(p.x + 2), Math.floor(p.y - 0.1)) === '^';
      let press = false;
      if (p.ground && (wallAhead || pitAhead || spikeAhead) && d.jumpHeld <= 0) {
        press = true;
        d.jumpHeld = 0.3;
      }
      d.jumpHeld -= dt;
      S.step(s, { x: 1, hold: d.jumpHeld > 0, press, up: false }, dt);
      this.animHero(d.hero, s, dt, true);
      s.ev.length = 0;
      if (s.won || s.time > 40 || s.deaths > 0) this.makeDemo();
      const tx = U.clamp(p.x * T - C.W * 0.62, 0, s.cols * T - C.W);
      d.cam.x += (tx - d.cam.x) * Math.min(1, dt * 3);
      d.cam.y = s.rows * T - C.H;
    }

    // ---------- play ----------

    updatePlay(dt) {
      if (I.hit('Escape', 'KeyP', 'PadStart')) return this.pause();
      if (I.hit('KeyR', 'PadY')) return this.restart();
      this.introT += dt;
      const s = this.sim;
      const inp = I.play();
      if (!this.started && (inp.x || inp.press)) this.started = true;
      if (this.hitstop > 0) {
        this.hitstop -= dt;
      } else {
        S.step(s, inp, dt);
        if (this.book) this.book.playTime += dt;
      }
      for (const e of s.ev) this.onEvent(e);
      s.ev.length = 0;
      this.animHero(this.hero, s, dt, false, inp);
      this.updateFx(dt);
      if (this.state !== 'play') return;
      // camera: look a little ahead, ease toward the hero
      const p = s.p;
      const tx = U.clamp(p.x * T - C.W / 2 + p.face * 70, 0, s.cols * T - C.W);
      const ty = U.clamp(p.y * T - C.H * 0.58, 0, s.rows * T - C.H);
      this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5);
      this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 4);
      if (s.won && this.state === 'play') this.win();
    }

    onEvent(e) {
      const s = this.sim;
      const p = s.p;
      const H = this.hero;
      const px = p.x * T;
      const py = p.y * T;
      switch (e.t) {
        case 'jump':
          A.play(e.spring ? 'spring' : 'jump');
          H.sq = 0.72;
          this.dust(px, py, 5, 1);
          break;
        case 'land':
          A.play('land', e.v);
          H.sq = 1 + Math.min(0.45, e.v / 40);
          this.dust(px, py, e.v > 15 ? 9 : 5, e.v / 12);
          if (e.v > 18) this.addShake(0.12);
          break;
        case 'bonk':
          A.play('bonk');
          H.sq = 1.25;
          break;
        case 'smash': {
          A.play('smash');
          this.addShake(0.35);
          this.hitstop = 0.08;
          let x0 = 1e9;
          let y0 = 1e9;
          let x1 = -1;
          let y1 = -1;
          for (const [cx, cy] of e.cells) {
            x0 = Math.min(x0, cx);
            y0 = Math.min(y0, cy);
            x1 = Math.max(x1, cx + 1);
            y1 = Math.max(y1, cy + 1);
            for (let k = 0; k < 7; k++) this.debris(cx * T + Math.random() * T, cy * T + Math.random() * T, this.terrain.th.stone);
          }
          BB.World.paintTerrain(this.terrain, Math.max(0, x0 - 1), Math.max(0, y0 - 1), Math.min(s.cols, x1 + 1), Math.min(s.rows, y1 + 1));
          this.floater('Smash!', px, py - 50, BB.COL.ink);
          break;
        }
        case 'borrow': {
          const pw = BB.POWERS[e.type];
          A.play('borrow', e.type);
          this.hitstop = 0.07;
          H.sq = 0.7;
          H.popT = 0;
          this.ring(e.x * T, e.y * T - 20, pw.color);
          for (let k = 0; k < 16; k++) this.spark(e.x * T, e.y * T - 20, pw.color);
          this.floater(pw.name + '!', e.x * T, e.y * T - 70, pw.dark);
          if (this.settings.tips) this.toast(pw.name + ': ' + pw.hint.toLowerCase(), 2.4);
          break;
        }
        case 'hurt': {
          const pw = BB.POWERS[e.power];
          A.play('drop');
          this.addShake(0.25);
          this.hitstop = 0.1;
          H.ouch = 0.5;
          for (let k = 0; k < 12; k++) this.debris(px, py - 20, pw.color, true);
          this.floater('Dropped the ' + pw.name.toLowerCase(), px, py - 60, BB.COL.redDark);
          break;
        }
        case 'die':
          A.play('oops');
          this.addShake(0.3);
          this.hitstop = 0.25;
          this.ring(e.x * T, e.y * T - 20, BB.COL.red);
          for (let k = 0; k < 14; k++) this.spark(e.x * T, Math.min(e.y * T, s.rows * T) - 20, '#fff');
          this.floater('Oops!', e.x * T, Math.min(e.y * T, s.rows * T - 30) - 40, BB.COL.red);
          H.popT = 0;
          break;
        case 'star':
          A.play('star');
          for (let k = 0; k < 10; k++) this.spark(e.x * T, e.y * T, BB.COL.gold);
          this.fx.push({ k: 'flystar', x: e.x * T - this.cam.x, y: e.y * T - this.cam.y, t: 0, slot: s.got - 1 });
          break;
        case 'check':
          A.play('check');
          for (let k = 0; k < 18; k++) this.confetti(e.x * T + T / 2, e.y * T);
          this.floater('Bookmarked!', e.x * T + T / 2, e.y * T - 30, BB.COL.redDark);
          break;
        case 'back':
          A.play('back');
          this.ring(e.x * T, e.y * T - 16, '#ffffff');
          break;
        case 'win':
          break;
      }
    }

    // squash, stretch, run cycle, blinking, little sounds
    animHero(H, s, dt, quiet, inp) {
      const p = s.p;
      H.sq += (1 - H.sq) * Math.min(1, dt * 12);
      const run = Math.min(1, Math.abs(p.vx) / 7);
      H.phase += dt * (6 + run * 12) * (run > 0.05 ? 1 : 0);
      H.popT = Math.min(1, H.popT + dt * 3);
      H.ouch = Math.max(0, H.ouch - dt);
      if (quiet) return;
      if (p.ground && run > 0.4) {
        H.stepT -= dt;
        if (H.stepT <= 0) {
          H.stepT = 0.22;
          A.play('step');
          if (Math.random() < 0.6) this.dust(p.x * T - p.face * 10, p.y * T, 1, 0.4);
        }
      }
      if (p.gliding) {
        H.glideT -= dt;
        if (H.glideT <= 0) {
          H.glideT = 0.45;
          A.play('glide');
        }
        if (Math.random() < 0.3) this.fx.push({ k: 'wind', x: p.x * T + (Math.random() - 0.5) * 50, y: p.y * T - 20 + (Math.random() - 0.5) * 30, t: 0 });
      } else H.glideT = 0;
      if (p.climbing) {
        H.climbT -= dt;
        if (H.climbT <= 0) {
          H.climbT = 0.14;
          A.play('climb');
        }
      }
      if (H.lastPower !== p.power) H.lastPower = p.power;
    }

    // ---------- effects ----------

    addShake(v) {
      if (this.settings.shake) this.shake = Math.max(this.shake, v);
    }
    dust(x, y, n, power) {
      for (let k = 0; k < n; k++) this.fx.push({ k: 'dust', x: x + (Math.random() - 0.5) * 16, y: y - 2, vx: (Math.random() - 0.5) * 60 * (1 + power), vy: -Math.random() * 30, r: 4 + Math.random() * 4, t: 0, life: 0.45 + Math.random() * 0.2 });
    }
    spark(x, y, color) {
      const a = Math.random() * Math.PI * 2;
      const v = 80 + Math.random() * 160;
      this.fx.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.5 + Math.random() * 0.3, color, rot: Math.random() * 6 });
    }
    debris(x, y, color, light) {
      this.fx.push({ k: 'chip', x, y, vx: (Math.random() - 0.5) * 260, vy: -120 - Math.random() * 220, t: 0, life: 0.9, color, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, g: light ? 500 : 900, s: light ? 5 : 7 });
    }
    confetti(x, y) {
      this.fx.push({ k: 'chip', x, y, vx: (Math.random() - 0.5) * 360, vy: -200 - Math.random() * 260, t: 0, life: 1.6, color: ['#e2533c', '#f5b82e', '#5fb86a', '#a48fd0', '#5fb6e0'][Math.floor(Math.random() * 5)], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, g: 420, s: 6, paper: true });
    }
    ring(x, y, color) {
      this.fx.push({ k: 'ring', x, y, t: 0, life: 0.45, color });
    }
    floater(str, x, y, color) {
      this.floaters.push({ str, x, y, t: 0, color });
    }

    updateFx(dt) {
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
      for (const f of this.fx) {
        f.t += dt;
        if (f.k === 'dust') {
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.vx *= 0.9;
          f.vy *= 0.9;
        } else if (f.k === 'spark') {
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.vx *= 0.92;
          f.vy = f.vy * 0.92 + 60 * dt;
        } else if (f.k === 'chip') {
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.vy += f.g * dt;
          f.rot += f.vr * dt;
          if (f.paper) {
            f.vx *= 0.98;
            f.vy = Math.min(f.vy, 90);
          }
        } else if (f.k === 'wind') f.x -= 120 * dt;
      }
      this.fx = this.fx.filter((f) => f.t < (f.life || (f.k === 'flystar' ? 0.7 : 0.4)));
      for (const f of this.floaters) f.t += dt;
      this.floaters = this.floaters.filter((f) => f.t < 1.2);
    }

    updateHero(dt) {
      if (this.sim) this.animHero(this.hero, this.sim, dt, true);
    }

    // ---------- ambient: petals, leaves or snow drifting across the page ----------

    seedAmbient(chapter) {
      this.ambientKind = BB.THEMES[chapter].ambient;
      this.ambient = Array.from({ length: 26 }, () => this.newMote(true));
    }
    newMote(anywhere) {
      return {
        x: anywhere ? Math.random() * C.W : C.W + 20 + Math.random() * 100,
        y: Math.random() * C.H * (anywhere ? 1 : 0.8) - (anywhere ? 0 : 20),
        z: 0.4 + Math.random() * 0.9,
        rot: Math.random() * 6,
        ph: Math.random() * 6,
      };
    }
    updateAmbient(dt) {
      const k = this.ambientKind;
      const calm = !this.settings.motion;
      for (const m of this.ambient) {
        const sp = calm ? 0.35 : 1;
        if (k === 'snow') {
          m.x -= (50 + 60 * m.z) * dt * sp;
          m.y += (24 + 20 * m.z) * dt * sp;
        } else {
          m.x -= (26 + 30 * m.z) * dt * sp;
          m.y += (14 + Math.sin(this.time * 1.5 + m.ph) * 22) * dt * sp;
        }
        m.rot += dt * 2 * sp;
        if (m.x < -30 || m.y > C.H + 30) Object.assign(m, this.newMote(false));
      }
    }
  }

  BB.Game = Game;
})();
