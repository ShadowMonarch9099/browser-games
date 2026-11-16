// Last Lantern: the run and the screens' state machine.
//
// Oil is everything at once: it lights the way, it is your health (the gloom
// knocks it out of the lamp), and it pays for beacons and shrine upgrades. A
// brighter flame shows more but burns faster and draws more creatures; a dim
// one sneaks. The rules and numbers are the ones from the first version.
//
// States: title, play, over, plus sub-screens that return to their opener:
// paused, map, satchel, journal, settings, help.
(function () {
  const C = LL.CFG;
  const W = window.LLWorld;
  const A = LL.Audio;
  const I = LL.Input;
  const U = LL.U;
  const { LIGHT, UPGRADES, BEACON_COST, MW, MH } = W;

  const SUBS = new Set(['paused', 'map', 'satchel', 'journal', 'settings', 'help']);

  class Game {
    constructor() {
      this.settings = LL.Save.settings();
      this.stats = LL.Save.stats();
      A.setVolumes(this.settings.sfx, this.settings.music);
      this.state = 'title';
      this.stateT = 0;
      this.focus = 0;
      this.stack = [];
      this.time = 0;
      this.buttons = [];
      this.fade = 1;
      this.shake = 0;
      this.hitstop = 0;
      this.journalSel = 0;
      this.run = null;
      this.makeDemo();
    }

    // ---------- flow ----------
    setState(s) {
      this.state = s;
      this.stateT = 0;
      this.focus = 0;
    }
    open(s) {
      this.stack.push({ state: this.state, focus: this.focus });
      this.setState(s);
      A.play('page');
    }
    close() {
      const b = this.stack.pop() || { state: this.run && !this.run.over ? 'play' : 'title', focus: 0 };
      this.setState(b.state);
      this.focus = b.focus;
      I.reset();
    }
    get under() {
      for (let i = this.stack.length - 1; i >= 0; i--) if (!SUBS.has(this.stack[i].state)) return this.stack[i].state;
      return this.state;
    }
    pause() {
      if (this.state !== 'play') return;
      this.open('paused');
      I.reset();
    }
    toast(s, life = 2.4) {
      this.toastMsg = { s, life, max: life };
    }
    storeSettings() {
      A.setVolumes(this.settings.sfx, this.settings.music);
      LL.Save.set('settings', this.settings);
    }

    // ---------- a run ----------
    newGame(fromSave) {
      const s = fromSave || {};
      const seed = s.seed || W.hash(String(Math.random()));
      const w = W.build(seed);
      (s.lit || []).forEach((i) => (w.beacons[i].lit = true));
      const r = {
        w,
        seed,
        owned: new Set(s.owned || []),
        p: { x: w.start.x, y: w.start.y, face: 0, oil: s.oil || 100, swing: 0, cool: 0, hurt: 0, walk: 0, vx: 0, vy: 0 },
        light: 1,
        foes: [],
        fx: [],
        motes: [],
        explored: new Uint8Array(MW * MH),
        exploredN: 0,
        banished: 0,
        jars: 0,
        t: 0,
        over: null,
        winT: -1,
      };
      for (const b of w.beacons) if (b.lit) this.lightBeacon(r, b, true);
      this.run = r;
      LL.Render.newWorld(r);
      this.stats.runs += fromSave ? 0 : 1;
      LL.Save.set('stats', this.stats);
      this.stack = [];
      this.setState('play');
      this.fade = 1;
      this.cam = { x: r.p.x, y: r.p.y };
      I.reset();
      if (!fromSave) this.toast('Four beacons wait in the dark');
      else this.toast('The flame wakes again: ' + w.beacons.filter((b) => b.lit).length + ' of 4 beacons burn');
    }

    maxOil(r = this.run) {
      return 100 + (r.owned.has('tank') ? 50 : 0);
    }
    persist() {
      const r = this.run;
      if (!r || r.over) return;
      LL.Save.set('run', { seed: r.seed, lit: r.w.beacons.map((b, i) => (b.lit ? i : -1)).filter((i) => i >= 0), owned: [...r.owned], oil: Math.round(r.p.oil) });
    }
    litNear(x, y, r = this.run) {
      return r.w.beacons.some((b) => b.lit && Math.hypot(b.x - x, b.y - y) < 8);
    }
    lightBeacon(r, b, quiet) {
      b.lit = true;
      // a lit beacon shows its whole hollow on the map
      b.poly = W.visibility(r.w, b.x, b.y, 8.5, 220, (x, y) => {
        if (x < 0 || y < 0 || x >= MW || y >= MH || r.explored[y * MW + x]) return;
        r.explored[y * MW + x] = 1;
        r.exploredN++;
        LL.Render.reveal(r, x, y);
      });
      if (!quiet) b.igniteT = 0;
    }

    // Swing at a beacon or shrine to use it (as before).
    use() {
      const r = this.run;
      const p = r.p;
      for (const b of r.w.beacons) {
        if (b.lit || Math.hypot(b.x - p.x, b.y - p.y) >= 1.6) continue;
        if (p.oil < BEACON_COST + 5) {
          this.toast('A beacon needs ' + BEACON_COST + ' oil, with some to spare');
          A.play('denied');
          return true;
        }
        p.oil -= BEACON_COST;
        this.lightBeacon(r, b);
        A.play('beacon');
        this.addShake(0.4);
        this.ring(b.x, b.y, 8, '#ffb347');
        for (let k = 0; k < 40; k++) this.ember(b.x, b.y, 1.6);
        this.toast(b.name + ' is lit. The cave remembers.');
        r.foes = r.foes.filter((f) => {
          if (Math.hypot(f.x - b.x, f.y - b.y) > 8) return true;
          this.banishFx(f);
          return false;
        });
        this.stats.beacons++;
        LL.Save.set('stats', this.stats);
        this.persist();
        if (r.w.beacons.every((q) => q.lit)) r.winT = 0;
        return true;
      }
      for (const s of r.w.shrines) {
        if (Math.hypot(s.x - p.x, s.y - p.y) >= 1.4) continue;
        if (r.owned.has(s.up.id)) {
          this.toast('Already yours: ' + s.up.name);
          return true;
        }
        if (p.oil < s.up.cost + 5) {
          this.toast(s.up.name + ' costs ' + s.up.cost + ' oil');
          A.play('denied');
          return true;
        }
        p.oil -= s.up.cost;
        r.owned.add(s.up.id);
        A.play('shrine');
        this.ring(s.x, s.y, 2.5, '#5ff2d8');
        for (let k = 0; k < 20; k++) this.spark(s.x, s.y, '#5ff2d8');
        this.toast(s.up.name + ': ' + s.up.desc);
        this.persist();
        return true;
      }
      return false;
    }

    end(won) {
      const r = this.run;
      if (r.over) return;
      r.over = won ? 'won' : 'lost';
      LL.Save.set('run', null);
      if (won) LL.Save.set('wins', LL.Save.get('wins', 0) + 1);
      else this.stats.outs++;
      LL.Save.set('stats', this.stats);
      A.play(won ? 'win' : 'lose');
      this.result = { won, t: 0, lit: r.w.beacons.filter((b) => b.lit).length, owned: r.owned.size, explored: r.exploredN, banished: r.banished, jars: r.jars, time: r.t };
      this.stack = [];
      this.setState('over');
    }

    // ---------- menus ----------
    menu() {
      const s = this.settings;
      const slider = (k, label) => ({ label, slider: () => s[k], adjust: (d, wrap) => { s[k] = wrap ? (s[k] + d + 11) % 11 : U.clamp(s[k] + d, 0, 10); this.storeSettings(); A.play('move'); } });
      const toggle = (k, label) => ({ label, toggle: () => s[k], adjust: () => { s[k] = !s[k]; this.storeSettings(); A.play('move'); } });
      switch (this.state) {
        case 'title': {
          const run = LL.Save.get('run', null);
          const items = [];
          if (run && run.seed) items.push({ label: 'Continue', sub: run.lit.length + ' of 4 beacons lit · ' + run.oil + ' oil', action: () => this.newGame(run) });
          items.push({ label: run ? 'A new cave' : 'Light the lantern', action: () => this.newGame() });
          items.push({ label: 'Keeper’s Journal', action: () => this.open('journal') });
          items.push({ label: 'How to play', action: () => this.open('help') });
          items.push({ label: 'Settings', action: () => this.open('settings') });
          return { items };
        }
        case 'paused':
          return {
            items: [
              { label: 'Return to the dark', action: () => this.close() },
              { label: 'Cave map', action: () => this.open('map') },
              { label: 'Satchel', action: () => this.open('satchel') },
              { label: 'Keeper’s Journal', action: () => this.open('journal') },
              { label: 'How to play', action: () => this.open('help') },
              { label: 'Settings', action: () => this.open('settings') },
              { label: 'Leave the cave', sub: 'kept from the last beacon', action: () => this.quit() },
            ],
            back: () => this.close(),
          };
        case 'settings': {
          const items = [slider('sfx', 'Sound effects'), slider('music', 'Music'), toggle('shake', 'Screen shake'), toggle('flicker', 'Flame flicker'), toggle('minimap', 'Corner map'), toggle('hints', 'Hints')];
          const P = LL.Platform;
          if (P && P.canFullscreen()) items.push({ label: 'Fullscreen', toggle: () => P.isFullscreen(), adjust: () => P.toggleFullscreen() });
          items.push({ label: 'Back', action: () => this.close() });
          return { items, back: () => this.close() };
        }
        case 'over':
          return {
            items: [
              { label: 'A new cave', action: () => this.newGame() },
              { label: 'Back to the title', action: () => this.quit() },
            ],
            back: () => this.quit(),
          };
      }
      return { items: [] };
    }

    quit() {
      if (this.run && !this.run.over) this.run = null;
      this.stack = [];
      this.setState('title');
      this.fade = 1;
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
      this.pulse = 0.3;
      if (it.action) {
        A.play('click');
        it.action();
      } else if (it.adjust) it.adjust(1, true);
    }

    hit(p) {
      for (let i = this.buttons.length - 1; i >= 0; i--) {
        const b = this.buttons[i];
        if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b;
      }
      return null;
    }

    // ---------- update ----------
    update(dt) {
      this.time += dt;
      this.stateT += dt;
      if (this.pulse > 0) this.pulse -= dt;
      if (this.fade > 0) this.fade = Math.max(0, this.fade - dt * 1.6);
      if (this.toastMsg && (this.toastMsg.life -= dt) <= 0) this.toastMsg = null;
      I.playMode = this.state === 'play';

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
          this.music(dt);
          return;
        }
      }

      if (this.under === 'title' || !this.run) this.updateDemo(dt);
      switch (this.state) {
        case 'play':
          this.updatePlay(dt);
          break;
        case 'over':
          this.result.t += dt;
          this.updateFx(dt);
          if (this.result.t > 1.4) this.handleMenu();
          break;
        case 'map':
        case 'satchel':
        case 'help':
          if (I.nav('back') || I.nav('confirm') || (this.state === 'map' && I.act('map')) || (this.state === 'satchel' && I.act('satchel'))) {
            A.play('click');
            this.close();
          }
          break;
        case 'journal':
          this.updateJournal();
          break;
        default:
          this.handleMenu();
      }
      this.music(dt);
    }

    music(dt) {
      A.mode = this.under === 'title' ? 'title' : 'play';
      const r = this.run;
      if (r && this.under !== 'title') {
        let near = 0;
        for (const f of r.foes) near = Math.max(near, U.clamp01(1 - Math.hypot(f.x - r.p.x, f.y - r.p.y) / 6));
        A.danger += ((r.over ? 0 : near) - A.danger) * Math.min(1, dt * 2);
        const warm = r.w.beacons.reduce((m, b) => (b.lit ? Math.max(m, U.clamp01(1 - Math.hypot(b.x - r.p.x, b.y - r.p.y) / 9)) : m), 0);
        A.warmth += (warm - A.warmth) * Math.min(1, dt);
      } else {
        A.danger *= 0.95;
        A.warmth *= 0.95;
      }
      A.update(dt);
    }

    updateJournal() {
      const n = LL.JOURNAL.length;
      const prev = this.journalSel;
      if (I.nav('down') || I.nav('right')) this.journalSel = (this.journalSel + 1) % n;
      if (I.nav('up') || I.nav('left')) this.journalSel = (this.journalSel - 1 + n) % n;
      if (prev !== this.journalSel) {
        this.journalT = 0;
        A.play('page');
      }
      if (I.nav('back')) {
        A.play('click');
        this.close();
      }
    }

    // ---------- the title-screen keeper wanders a quiet cave ----------
    makeDemo() {
      const w = W.build(W.hash('last-lantern-title'));
      w.beacons[0].lit = true;
      const r = { w, p: { x: w.start.x, y: w.start.y, face: 0, oil: 80, swing: 0, walk: 0, hurt: 0, vx: 0, vy: 0 }, light: 1, foes: [], fx: [], motes: [], explored: new Uint8Array(MW * MH), exploredN: 0, demo: true, target: null, owned: new Set() };
      this.lightBeacon(r, w.beacons[0], true);
      this.demo = r;
      this.demoCam = { x: r.p.x, y: r.p.y };
    }
    updateDemo(dt) {
      const r = this.demo;
      if (!r.built) {
        LL.Render.prepare(r);
        r.built = true;
      }
      const p = r.p;
      if (!r.target || Math.hypot(r.target.x - p.x, r.target.y - p.y) < 0.3 || r.stuck > 1.5) {
        for (let k = 0; k < 30; k++) {
          const a = Math.random() * Math.PI * 2;
          const d = 2 + Math.random() * 5;
          const tx = p.x + Math.cos(a) * d;
          const ty = p.y + Math.sin(a) * d;
          if (!this.blocked(r, tx, ty) && Math.hypot(tx - r.w.start.x, ty - r.w.start.y) < 14) {
            r.target = { x: tx, y: ty };
            break;
          }
        }
        r.stuck = 0;
      }
      if (r.target) {
        const dx = r.target.x - p.x;
        const dy = r.target.y - p.y;
        const l = Math.hypot(dx, dy) || 1;
        const before = [p.x, p.y];
        this.moveKeeper(r, (dx / l) * 0.45, (dy / l) * 0.45, dt);
        if (Math.hypot(p.x - before[0], p.y - before[1]) < 0.002) r.stuck += dt;
      }
      r.light = 1 + Math.round(Math.sin(this.time * 0.15) * 0.6 + 0.4) - 0;
      r.light = U.clamp(r.light, 1, 2);
      this.updateMotes(r, dt);
      this.demoCam.x += (p.x - this.demoCam.x) * Math.min(1, dt * 2);
      this.demoCam.y += (p.y - this.demoCam.y) * Math.min(1, dt * 2);
    }

    blocked(r, x, y, rad = 0.3) {
      return W.isWall(r.w, x - rad, y - rad) || W.isWall(r.w, x + rad, y - rad) || W.isWall(r.w, x - rad, y + rad) || W.isWall(r.w, x + rad, y + rad);
    }
    moveKeeper(r, mx, my, dt) {
      const p = r.p;
      const sp = 3.6 * dt;
      if (mx || my) p.face = Math.atan2(my, mx);
      const nx = p.x + mx * sp;
      const ny = p.y + my * sp;
      if (!this.blocked(r, nx, p.y)) p.x = nx;
      if (!this.blocked(r, p.x, ny)) p.y = ny;
      const moving = Math.hypot(mx, my);
      p.walk += dt * moving * 9;
      p.moving = moving;
    }

    // ---------- play ----------
    updatePlay(dt) {
      const r = this.run;
      if (I.act('pause')) {
        this.open('paused');
        I.reset();
        return;
      }
      if (I.act('map')) return this.open('map');
      if (I.act('satchel')) return this.open('satchel');
      if (this.hitstop > 0) {
        this.hitstop -= dt;
        return;
      }
      r.t += dt;
      const p = r.p;
      const m = I.move();
      const stepBefore = Math.floor(p.walk / Math.PI);
      this.moveKeeper(r, m.x, m.y, dt);
      if (Math.floor(p.walk / Math.PI) !== stepBefore) A.play('step');
      if (I.act('flame')) {
        r.light = (r.light + 1) % 3;
        A.play('flame', r.light);
        for (let k = 0; k < 6 + r.light * 6; k++) this.ember(p.x, p.y, 0.4);
      }
      p.cool -= dt;
      p.swing -= dt;
      p.hurt -= dt;
      if (I.act('swing') && p.cool <= 0 && !this.use()) {
        p.swing = 0.18;
        p.cool = 0.35;
        A.play('swing');
        let landed = false;
        for (const f of r.foes) {
          const d = Math.hypot(f.x - p.x, f.y - p.y);
          const diff = U.angDiff(Math.atan2(f.y - p.y, f.x - p.x), p.face);
          if (d < 1.4 && Math.abs(diff) < 1.1) {
            f.hp -= r.owned.has('blade') ? 2 : 1;
            f.x += Math.cos(p.face) * 0.6;
            f.y += Math.sin(p.face) * 0.6;
            f.flash = 0.12;
            landed = true;
            for (let k = 0; k < 6; k++) this.spark(f.x, f.y, '#f6e7c8');
          }
        }
        if (landed) {
          A.play('hit');
          this.hitstop = 0.05;
          this.addShake(0.12);
        }
      }
      // the lamp burns; lit beacons let you breathe and slowly refill
      const L = LIGHT[r.light];
      const safe = this.litNear(p.x, p.y);
      p.oil -= L.burn * (r.owned.has('wick') ? 0.7 : 1) * dt * (safe ? 0 : 1);
      if (safe) p.oil = Math.min(this.maxOil(), p.oil + dt * 1.5);
      for (const j of r.w.jars) {
        if (j.taken > 0) {
          j.taken -= dt;
          continue;
        }
        if (Math.hypot(j.x - p.x, j.y - p.y) < 0.6) {
          j.taken = 90;
          p.oil = Math.min(this.maxOil(), p.oil + 18);
          r.jars++;
          this.stats.jars++;
          A.play('oil');
          this.float('+18 oil', j.x, j.y, '#ffb347');
          for (let k = 0; k < 10; k++) this.spark(j.x, j.y, '#ffb347');
        }
      }

      // creatures gather at the edge of your light: more of them the brighter it is
      const rand = r.w.rand;
      if (!safe && r.foes.length < 3 + r.light * 3 && rand() < dt * 0.35 * L.lure) {
        const a = rand() * 6.283;
        const d = L.r + 2 + rand() * 3;
        const fx = p.x + Math.cos(a) * d;
        const fy = p.y + Math.sin(a) * d;
        if (!W.isWall(r.w, fx, fy) && !this.litNear(fx, fy)) {
          const big = rand() < 0.25;
          r.foes.push({ x: fx, y: fy, hp: 2 + (big ? 2 : 0), big, flash: 0, wait: 0, ph: Math.random() * 6, flinch: 0 });
          if (big) this.stats.seenMurk = true;
          else this.stats.seenGloom = true;
          if (Math.random() < 0.5) A.play('whisper');
        }
      }
      for (const f of r.foes) {
        f.flash -= dt;
        f.wait -= dt;
        const d = Math.hypot(p.x - f.x, p.y - f.y) || 1;
        // they shy from a bright flame up close, but still come
        const glare = r.light === 2 && d < L.r * 0.55 ? 1 : 0;
        f.flinch += (glare - f.flinch) * Math.min(1, dt * 6);
        const speed = (f.big ? 1.4 : 2.1) * (1 - f.flinch * 0.45) * dt;
        if (d < L.r + 6 && f.wait <= 0) {
          const mx = f.x + ((p.x - f.x) / d) * speed;
          const my = f.y + ((p.y - f.y) / d) * speed;
          if (!W.isWall(r.w, mx, f.y)) f.x = mx;
          if (!W.isWall(r.w, f.x, my)) f.y = my;
        }
        if (d < 0.6 && p.hurt <= 0) {
          p.oil -= 12;
          p.hurt = 0.8;
          f.wait = 0.8;
          A.play('hurt');
          this.addShake(0.3);
          this.hitstop = 0.08;
          for (let k = 0; k < 12; k++) this.drop(p.x, p.y);
          this.float('-12 oil', p.x, p.y - 0.4, '#ff4d4d');
        }
        if (this.litNear(f.x, f.y)) f.hp = 0;
      }
      r.foes = r.foes.filter((f) => {
        if (f.hp > 0) return true;
        p.oil = Math.min(this.maxOil(), p.oil + 5);
        r.banished++;
        this.stats.banished++;
        this.banishFx(f);
        A.play('banish');
        this.float('+5', f.x, f.y, '#9d8df1');
        return false;
      });
      if (Math.random() < dt * 0.25) A.play('drip');
      this.explore(r);
      this.updateMotes(r, dt);
      this.updateFx(dt);
      if (r.winT >= 0 && (r.winT += dt) > 1.2) return this.end(true);
      if (p.oil <= 0) return this.end(false);
      this.cam.x += (p.x - this.cam.x) * Math.min(1, dt * 8);
      this.cam.y += (p.y - this.cam.y) * Math.min(1, dt * 8);
    }

    // mark what the light touches on the map
    explore(r) {
      const p = r.p;
      const rad = Math.max(2.2, LIGHT[r.light].r * 0.9);
      const before = r.exploredN;
      r.poly = W.visibility(r.w, p.x, p.y, rad, 64, (x, y) => {
        if (x < 0 || y < 0 || x >= MW || y >= MH) return;
        const i = y * MW + x;
        if (!r.explored[i]) {
          r.explored[i] = 1;
          r.exploredN++;
          LL.Render.reveal(r, x, y);
        }
      });
      if (r.exploredN !== before) r.mapDirty = true;
    }

    // ---------- effects ----------
    addShake(v) {
      if (this.settings.shake) this.shake = Math.max(this.shake, v);
    }
    spark(x, y, color) {
      const a = Math.random() * 6.283;
      const v = 2 + Math.random() * 4;
      this.run && this.run.fx.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.4 + Math.random() * 0.3, color });
    }
    drop(x, y) {
      const a = Math.random() * 6.283;
      const v = 1.5 + Math.random() * 3;
      this.run.fx.push({ k: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.7 });
    }
    ember(x, y, spread) {
      this.run.fx.push({ k: 'ember', x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread, vx: (Math.random() - 0.5) * 0.8, vy: -1 - Math.random() * 2, t: 0, life: 0.8 + Math.random() * 0.8 });
    }
    ring(x, y, rad, color) {
      this.run.fx.push({ k: 'ring', x, y, rad, t: 0, life: 0.8, color });
    }
    float(s, x, y, color) {
      this.run.fx.push({ k: 'text', s, x, y, t: 0, life: 1.1, color });
    }
    banishFx(f) {
      for (let k = 0; k < 14; k++) {
        const a = Math.random() * 6.283;
        this.run.fx.push({ k: 'wisp', x: f.x, y: f.y, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5 - 1, t: 0, life: 0.9 });
      }
    }
    updateFx(dt) {
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
      const r = this.run;
      if (!r) return;
      for (const b of r.w.beacons) {
        if (b.igniteT !== undefined) b.igniteT += dt;
        if (b.lit && Math.random() < dt * 6) r.fx.push({ k: 'ember', x: b.x + (Math.random() - 0.5) * 0.5, y: b.y - 0.4, vx: (Math.random() - 0.5) * 0.4, vy: -0.8 - Math.random(), t: 0, life: 1.4 });
      }
      for (const f of r.fx) {
        f.t += dt;
        if (f.vx !== undefined) {
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          if (f.k === 'spark' || f.k === 'drop') {
            f.vx *= 0.9;
            f.vy *= 0.9;
          }
        }
      }
      r.fx = r.fx.filter((f) => f.t < f.life);
      if (r.fx.length > 400) r.fx.splice(0, r.fx.length - 400);
    }
    // dust motes that drift through the lantern light, and moths around it
    updateMotes(r, dt) {
      const p = r.p;
      while (r.motes.length < 26) r.motes.push({ x: p.x + (Math.random() - 0.5) * 12, y: p.y + (Math.random() - 0.5) * 8, z: Math.random(), ph: Math.random() * 6 });
      for (const m of r.motes) {
        m.x += Math.sin(this.time * 0.6 + m.ph) * dt * 0.15 + dt * 0.05;
        m.y += Math.cos(this.time * 0.5 + m.ph) * dt * 0.12 - dt * 0.03;
        if (Math.abs(m.x - p.x) > 7 || Math.abs(m.y - p.y) > 5) {
          m.x = p.x + (Math.random() - 0.5) * 12;
          m.y = p.y + (Math.random() - 0.5) * 8;
        }
      }
    }
  }

  // Journal entries (the codex). `seen` gates the two creatures.
  LL.JOURNAL = [
    { id: 'keeper', name: 'The Keeper', text: 'Night came and stayed. You carry the last flame down into the cave to wake the four beacons. Swing your blade at what comes out of the dark, and swing at a beacon or shrine to use it.' },
    { id: 'oil', name: 'Lantern oil', text: 'Oil is your light, your health and your coin all at once. It burns away as you walk, the gloom knocks it out of the lamp, and beacons and shrines are paid in it. Run dry and the flame goes out.' },
    { id: 'flame', name: 'Three flames', text: 'Dim sneaks: little light, slow burn, few visitors. Steady is the middle way. Bright shows far and makes the gloom flinch up close, but it burns fast and calls more of them.' },
    { id: 'gloom', name: 'Gloomling', seen: 'seenGloom', text: 'A wisp of living dark. Quick and fragile: two swings send it back to nothing, and it leaves a little oil behind. It hates being close to a bright flame.' },
    { id: 'murk', name: 'Murk', seen: 'seenMurk', text: 'An older, heavier shadow with horns of smoke. Slow, but it takes twice the swings. Do not let two of them corner you.' },
    { id: 'beacon', name: 'Beacons', text: 'Four great braziers at the corners of the cave. Lighting one costs 30 oil. Near a lit beacon your lamp burns nothing and slowly refills, and no gloom can live there. The game saves at every beacon.' },
    { id: 'shrine', name: 'Shrines', text: 'Three old stones near the centre: a sharper blade (40 oil), a better wick that burns 30% less (55 oil) and a bigger tank for 50 more oil (70 oil). Each can be bought once per cave.' },
    { id: 'jar', name: 'Oil jars', text: 'Clay jars of oil are scattered through the tunnels. Each gives 18 oil, and slowly fills again after you take it.' },
    { id: 'glowcap', name: 'Glowcaps', text: 'Pale mushrooms that glow by the walls. They give no oil, but their light shows where the tunnels bend. Violet crystals in the walls catch your flame.' },
  ];

  LL.Game = Game;
})();
