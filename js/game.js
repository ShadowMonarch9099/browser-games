// Game state machine and per-tick simulation.
//
// States: title → select → play ↔ paused → won / failed, plus the settings and
// controls screens, which return to whichever screen opened them.
(function () {
  const C = SCE.CFG;
  const T = C.TILE;
  const A = SCE.Audio;
  const I = SCE.Input;

  const FAIL_TEXT = {
    spotted: ['SPOTTED', 'A guard saw you. They never notice your shadow — only you.'],
    caught: ['CAUGHT', 'You walked straight into a guard.'],
    hound: ['THE HOUND GOT YOU', 'Hounds wake when you get close. Seal them in or outrun them.'],
    time: ['OUT OF TIME', 'Every level must be escaped within 60 seconds.'],
  };
  const MENU_STATES = new Set(['title', 'paused', 'settings', 'controls', 'won', 'failed']);
  const DEMO_LEVEL = 10; // attract-mode level drawn behind the title menu

  class Game {
    constructor() {
      this.save = SCE.Save.load();
      this.settings = this.save.settings;
      A.setMuted(this.save.muted);
      A.setVolumes(this.settings.sfx, this.settings.music);
      this.state = 'title';
      this.focus = 0;
      this.back = null;
      this.confirmReset = false;
      this.sel = Math.min(this.save.unlocked, SCE.LEVELS.length) - 1;
      this.time = 0;
      this.fade = 1;
      this.buttons = [];
      this.particles = [];
      this.texts = [];
      this.shake = 0;
      this.levelIndex = 0;
      this.control = 'player';
      this.makeDemo();
    }

    // True while the player is driving the clone (the player stands still).
    get steering() {
      return !!this.clone && this.control === 'clone';
    }

    makeDemo() {
      const def = SCE.LEVELS[DEMO_LEVEL];
      const level = new SCE.Level(def);
      this.demo = {
        level,
        player: { x: -1e4, y: -1e4 },
        guards: (def.guards || []).map((g) => new SCE.Guard(g)),
      };
    }

    // ---------- flow ----------

    setState(state, fade = false) {
      this.state = state;
      this.focus = 0;
      this.confirmReset = false;
      if (fade) this.fade = 1;
    }

    goTitle() {
      this.setState('title', true);
    }

    goSelect() {
      this.setState('select', true);
      this.sel = Math.min(this.sel, SCE.LEVELS.length - 1);
    }

    openSub(state) {
      this.back = { state: this.state, focus: this.focus };
      this.setState(state);
    }

    closeSub() {
      const b = this.back || { state: 'title', focus: 0 };
      this.setState(b.state);
      this.focus = b.focus;
      this.back = null;
    }

    startLevel(i) {
      const def = SCE.LEVELS[i];
      this.levelIndex = i;
      this.sel = i;
      this.level = new SCE.Level(def);
      this.player = new SCE.Player(this.level.start.x, this.level.start.y);
      this.clone = null;
      this.control = 'player';
      this.cloneCooldown = 0;
      this.timeLeft = C.LEVEL_TIME;
      this.playTime = 0;
      this.started = false; // the timer starts on the first move
      this.keys = 0;
      this.shards = 0;
      this.shardTotal = this.level.items.filter((it) => it.type === 'shard').length;
      this.keyTotal = this.level.items.filter((it) => it.type === 'key').length;
      this.guards = (def.guards || []).map((g) => new SCE.Guard(g));
      this.particles = [];
      this.texts = [];
      this.shake = 0;
      this.lastTickSec = null;
      this.lockWarn = 0;
      this.result = null;
      this.setState('play', true);
      this.updateDoors(0, true);
    }

    pause() {
      if (this.state !== 'play') return;
      this.setState('paused');
      I.reset();
    }

    resume() {
      this.setState('play');
    }

    toggleMute() {
      A.setMuted(!A.muted);
      this.save.muted = A.muted;
      SCE.Save.store(this.save);
      this.toast(A.muted ? 'Sound off' : 'Sound on');
    }

    applySettings() {
      A.setVolumes(this.settings.sfx, this.settings.music);
      SCE.Save.store(this.save);
    }

    resetProgress() {
      const fresh = SCE.Save.defaults();
      this.save.unlocked = fresh.unlocked;
      this.save.levels = fresh.levels;
      SCE.Save.store(this.save);
      this.sel = 0;
      this.toast('Progress reset');
    }

    toast(str) {
      this.toastMsg = { str, life: 1.6 };
    }

    win() {
      const used = C.LEVEL_TIME - this.timeLeft;
      const stars = [true, this.shards === this.shardTotal, this.timeLeft >= C.STAR_TIME_LEFT];
      const count = stars.filter(Boolean).length;
      const prev = this.save.levels[this.levelIndex] || {};
      const newBest = prev.best === undefined || used < prev.best;
      this.save.levels[this.levelIndex] = {
        stars: Math.max(prev.stars || 0, count),
        best: newBest ? used : prev.best,
      };
      this.save.unlocked = Math.max(this.save.unlocked, Math.min(this.levelIndex + 2, SCE.LEVELS.length));
      SCE.Save.store(this.save);
      this.result = { stars, used, newBest, t: 0, shown: 0 };
      this.setState('won');
      A.play('win');
      this.burst(this.player.x, this.player.y, '#4ade80', 30, 160);
    }

    fail(reason, by = null) {
      this.result = { reason, by, title: FAIL_TEXT[reason][0], text: FAIL_TEXT[reason][1], t: 0 };
      this.setState('failed');
      if (this.settings.shake) this.shake = 0.35;
      A.play(reason === 'time' ? 'timeout' : 'caught');
    }

    // ---------- menus ----------

    // Every list menu is described here; the UI draws it and handleMenu()
    // drives it from keyboard, gamepad, mouse and touch alike.
    menu() {
      const s = this.settings;
      const slider = (key, label) => ({
        label,
        slider: () => s[key],
        adjust: (d, wrap) => {
          s[key] = wrap ? (s[key] + d + 11) % 11 : Math.max(0, Math.min(10, s[key] + d));
          this.applySettings();
          A.play('click');
        },
      });
      const toggle = (key, label) => ({
        label,
        value: () => (s[key] ? 'On' : 'Off'),
        adjust: () => {
          s[key] = !s[key];
          this.applySettings();
          A.play('click');
        },
      });
      switch (this.state) {
        case 'title': {
          const resume = Math.min(this.save.unlocked, SCE.LEVELS.length) - 1;
          const played = Object.keys(this.save.levels).length > 0;
          return {
            items: [
              {
                label: played ? 'Continue' : 'New Game',
                sub: played ? `Level ${resume + 1} — ${SCE.LEVELS[resume].name}` : null,
                action: () => this.startLevel(resume),
              },
              { label: 'Level Select', action: () => this.goSelect() },
              { label: 'Settings', action: () => this.openSub('settings') },
              { label: 'How to Play', action: () => this.openSub('controls') },
            ],
          };
        }
        case 'paused':
          return {
            items: [
              { label: 'Resume', action: () => this.resume() },
              { label: 'Restart Level', action: () => this.startLevel(this.levelIndex) },
              { label: 'Settings', action: () => this.openSub('settings') },
              { label: 'How to Play', action: () => this.openSub('controls') },
              { label: 'Quit to Level Select', action: () => this.goSelect() },
            ],
            back: () => this.resume(),
          };
        case 'settings': {
          const items = [slider('sfx', 'Sound Effects'), slider('music', 'Music'), toggle('shake', 'Screen Shake'), toggle('hints', 'Tutorial Prompts')];
          const P = SCE.Platform;
          if (P && P.canFullscreen()) {
            items.push({ label: 'Fullscreen', value: () => (P.isFullscreen() ? 'On' : 'Off'), adjust: () => P.toggleFullscreen() });
          }
          if (this.back && this.back.state === 'title') {
            items.push({
              label: this.confirmReset ? 'Press again to confirm' : 'Reset Progress',
              danger: true,
              action: () => {
                if (this.confirmReset) {
                  this.resetProgress();
                  this.confirmReset = false;
                } else this.confirmReset = true;
              },
            });
          }
          items.push({ label: 'Back', action: () => this.closeSub() });
          return { items, back: () => this.closeSub() };
        }
        case 'controls':
          return { items: [{ label: 'Back', action: () => this.closeSub() }], back: () => this.closeSub() };
        case 'won': {
          const last = this.levelIndex + 1 >= SCE.LEVELS.length;
          return {
            items: [
              { label: last ? 'Finish' : 'Next Level', action: () => this.nextLevel() },
              { label: 'Replay', action: () => this.startLevel(this.levelIndex) },
              { label: 'Level Select', action: () => this.goSelect() },
            ],
            back: () => this.goSelect(),
          };
        }
        case 'failed':
          return {
            items: [
              { label: 'Retry', action: () => this.startLevel(this.levelIndex) },
              { label: 'Level Select', action: () => this.goSelect() },
            ],
            back: () => this.goSelect(),
          };
      }
      return { items: [] };
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
      if (it.action) {
        A.play('click');
        it.action();
      } else if (it.adjust) it.adjust(1, true);
    }

    // ---------- main update ----------

    update(dt) {
      this.time += dt;
      if (this.fade > 0) this.fade = Math.max(0, this.fade - dt * 3);
      if (this.toastMsg && (this.toastMsg.life -= dt) <= 0) this.toastMsg = null;
      I.playMode = this.state === 'play';
      if (I.wasPressed('KeyM')) this.toggleMute();

      if (I.mouseMoved && I.mouse) {
        const b = this.hit(I.mouse);
        if (b && b.focus !== undefined && b.focus !== this.focus) {
          this.focus = b.focus;
          A.play('move');
        }
        if (b && b.sel !== undefined) this.sel = b.sel;
      }
      for (const click of I.clicks) {
        const b = this.hit(click);
        if (b) {
          if (b.focus !== undefined) this.focus = b.focus;
          A.play('click');
          b.action();
          return;
        }
      }

      if (this.state !== 'play' || !this.started) A.tension = 0;
      if (this.state === 'title' || (this.back && this.back.state === 'title') || this.state === 'select') this.updateDemo(dt);

      switch (this.state) {
        case 'select':
          this.updateSelect();
          break;
        case 'play':
          this.updatePlay(dt);
          break;
        case 'paused':
          if (I.wasPressed('KeyP', 'PadStart')) this.resume();
          else if (I.wasPressed('KeyR')) this.startLevel(this.levelIndex);
          else if (I.wasPressed('KeyQ')) this.goSelect();
          else this.handleMenu();
          break;
        case 'won':
        case 'failed':
          this.result.t += dt;
          if (I.wasPressed('KeyR', 'PadY')) this.startLevel(this.levelIndex);
          else if (this.result.t > 0.4) this.handleMenu();
          break;
        default:
          if (MENU_STATES.has(this.state)) this.handleMenu();
      }
      if (this.state !== 'paused') this.updateFx(dt);
      A.updateMusic();
    }

    hit(p) {
      return this.buttons.find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h);
    }

    updateDemo(dt) {
      for (const g of this.demo.guards) g.update(dt, this.demo);
    }

    nextLevel() {
      if (this.levelIndex + 1 < SCE.LEVELS.length) this.startLevel(this.levelIndex + 1);
      else this.goSelect();
    }

    updateSelect() {
      const n = SCE.LEVELS.length;
      const cols = 4;
      const prev = this.sel;
      if (I.nav('right')) this.sel = (this.sel + 1) % n;
      if (I.nav('left')) this.sel = (this.sel - 1 + n) % n;
      if (I.nav('down')) this.sel = Math.min(n - 1, this.sel + cols);
      if (I.nav('up')) this.sel = Math.max(0, this.sel - cols);
      if (this.sel !== prev) A.play('move');
      if (I.nav('confirm')) {
        if (this.sel < this.save.unlocked) this.startLevel(this.sel);
        else A.play('denied');
      }
      if (I.nav('back')) this.goTitle();
    }

    updatePlay(dt) {
      if (I.wasPressed('Escape', 'KeyP', 'PadStart')) return this.pause();
      if (I.wasPressed('KeyR', 'PadY')) return this.startLevel(this.levelIndex);

      const L = this.level;
      const p = this.player;

      if (!this.started) {
        const ax0 = I.axis();
        const go = ax0.x || ax0.y || I.clonePressed() || I.wasPressed('Enter');
        if (!go) return;
        this.started = true;
        A.play('start');
        if (!(ax0.x || ax0.y)) return; // a key press only starts the clock
      }

      this.playTime += dt;
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        return this.fail('time');
      }
      const sec = Math.ceil(this.timeLeft);
      if (sec <= 10 && sec !== this.lastTickSec) {
        this.lastTickSec = sec;
        A.play('tick');
      }

      // --- shadow clone ---
      // The clone key casts a clone and hands control to it; pressing it again
      // swaps control between you and your shadow. The one you're not
      // controlling stands still, which is how the clone holds a plate.
      if (this.cloneCooldown > 0) this.cloneCooldown -= dt;
      if (I.clonePressed()) {
        if (!this.clone) {
          if (this.cloneCooldown <= 0) this.spawnClone();
          else A.play('denied');
        } else this.swapControl();
      }
      const ax = I.axis();
      if (this.steering) this.moveClone(ax, dt);
      else this.movePlayer(ax, dt);

      if (this.clone) {
        this.clone.life -= dt;
        if (this.clone.strain > 0) this.clone.strain -= dt;
        if (this.clone.life <= 0) this.expireClone();
      }
      if (this.lockWarn > 0) this.lockWarn -= dt;

      this.updatePlates(dt);
      this.updateDoors(dt);
      this.updateItems(dt);
      for (const g of this.guards) g.update(dt, this);

      // Detection: contact is instant; sight builds suspicion first, faster the
      // closer you are. Guards only ever look for the player, never the clone.
      let sus = 0;
      for (const g of this.guards) {
        const d = Math.hypot(g.x - p.x, g.y - p.y);
        if (d < C.CATCH_DIST) return this.fail(g.type === 'hound' ? 'hound' : 'caught', g);
        if (g.type === 'hound') continue;
        if (g.canSee(p.x, p.y, L)) {
          const k = Math.min(1, d / C.VIEW_RANGE);
          if (g.sus === 0) A.play('suspect');
          g.sus = Math.min(1, g.sus + dt / (C.DETECT_NEAR + (C.DETECT_FAR - C.DETECT_NEAR) * k));
          if (g.sus >= 1) {
            g.alert = 2;
            return this.fail('spotted', g);
          }
        } else g.sus = Math.max(0, g.sus - dt / C.DETECT_DECAY);
        sus = Math.max(sus, g.sus);
      }
      A.tension = Math.max(sus, this.timeLeft <= 10 ? 0.6 : 0);

      for (const e of L.exits) {
        if (Math.hypot(e.x - p.x, e.y - p.y) < 14) return this.win();
      }
    }

    movePlayer(ax, dt) {
      const p = this.player;
      if (ax.x || ax.y) {
        p.face = { x: ax.x, y: ax.y };
        p.walkT += dt;
      }
      const sp = C.PLAYER_SPEED * dt;
      SCE.moveEntity(this.level, p, ax.x * sp, ax.y * sp, 'player', (hit) => this.tryUnlock(hit));
    }

    tryUnlock(hit) {
      const lock = this.level.lockAt[hit.r] && this.level.lockAt[hit.r][hit.c];
      if (!lock || lock.open) return false;
      if (this.keys > 0) {
        lock.open = true;
        this.keys--;
        A.play('unlock');
        this.burst((hit.c + 0.5) * T, (hit.r + 0.5) * T, '#fbbf24', 16, 90);
        return true;
      }
      if (this.lockWarn <= 0) {
        this.lockWarn = 1.5;
        this.text((hit.c + 0.5) * T, hit.r * T, 'Locked — find a key', '#fbbf24');
      }
      return false;
    }

    spawnClone() {
      const p = this.player;
      this.clone = new SCE.Clone(p.x, p.y, p.face);
      this.control = 'clone';
      A.play('clone');
      this.burst(p.x, p.y, '#a78bfa', 18, 80);
    }

    swapControl() {
      this.control = this.control === 'clone' ? 'player' : 'clone';
      A.play(this.control === 'clone' ? 'swap' : 'swapBack');
      const e = this.control === 'clone' ? this.clone : this.player;
      this.burst(e.x, e.y, this.control === 'clone' ? '#a78bfa' : '#e5e7eb', 8, 50);
    }

    moveClone(ax, dt) {
      const cl = this.clone;
      const px = cl.x;
      const py = cl.y;
      if (ax.x || ax.y) cl.face = { x: ax.x, y: ax.y };
      const sp = C.CLONE_SPEED * dt;
      SCE.moveEntity(this.level, cl, ax.x * sp, ax.y * sp, 'clone');

      // Leash: never more than CLONE_LEASH px from the cast point. Projecting
      // onto the circle lets the clone slide along its edge.
      const dx = cl.x - cl.sx;
      const dy = cl.y - cl.sy;
      const d = Math.hypot(dx, dy);
      if (d > C.CLONE_LEASH) {
        const nx = cl.sx + (dx / d) * C.CLONE_LEASH;
        const ny = cl.sy + (dy / d) * C.CLONE_LEASH;
        if (!this.level.collides(nx, ny, C.HALF, 'clone')) {
          cl.x = nx;
          cl.y = ny;
        } else {
          cl.x = px;
          cl.y = py;
        }
        cl.strain = 0.25;
      }
      if ((ax.x || ax.y) && Math.random() < 0.5) {
        this.particles.push({ x: cl.x, y: cl.y, vx: 0, vy: 0, life: 0.4, max: 0.4, size: 5, color: '#7c3aed' });
      }
    }

    expireClone() {
      const cl = this.clone;
      this.burst(cl.x, cl.y, '#7c3aed', 14, 60);
      this.clone = null;
      this.control = 'player';
      this.cloneCooldown = C.CLONE_COOLDOWN;
      A.play('expire');
    }

    // ---------- world systems ----------

    updatePlates(dt) {
      const bodies = [this.player, this.clone].filter(Boolean);
      for (const pl of this.level.plates) {
        const pressed = bodies.some((e) => Math.floor(e.x / T) === pl.c && Math.floor(e.y / T) === pl.r);
        const rising = pressed && !pl.pressed;
        pl.pressed = pressed;
        switch (pl.type) {
          case 'timed':
            pl.timer = pressed ? C.TIMED_PLATE_HOLD : Math.max(0, pl.timer - dt);
            pl.active = pressed || pl.timer > 0;
            if (rising) A.play('plate');
            break;
          case 'lever':
            if (rising) {
              pl.on = !pl.on;
              A.play('lever');
            }
            pl.active = pl.on;
            break;
          case 'bell':
            pl.active = pressed;
            if (rising) this.ringBell(pl);
            break;
          default:
            pl.active = pressed;
            if (rising) A.play('plate');
        }
      }
    }

    ringBell(pl) {
      A.play('bell');
      this.text(pl.x, pl.y - 16, 'DING!', C.BELL_COLOR);
      for (let i = 0; i < 3; i++) {
        this.particles.push({ x: pl.x, y: pl.y, ring: true, life: 0.8 + i * 0.25, max: 0.8 + i * 0.25, size: 120, color: C.BELL_COLOR });
      }
      let heard = false;
      for (const g of this.guards) heard = g.hearBell(pl.c, pl.r, this.level) || heard;
      if (heard) A.play('alert');
    }

    updateDoors(dt, silent = false) {
      for (const d of Object.values(this.level.doors)) {
        const any = d.plates.some((p) => p.active);
        let want;
        if (d.twin) {
          if (!d.latched && d.plates.length && d.plates.every((p) => p.active)) {
            d.latched = true;
            if (!silent) {
              A.play('unlock');
              this.text(d.cx, d.cy - 20, 'Twin lock open!', d.color);
            }
          }
          want = d.latched;
        } else want = d.invert ? !any : any;

        if (want !== d.open && (want || !this.occupied(d.tiles))) {
          d.open = want;
          if (!silent) A.play(want ? 'doorOpen' : 'doorClose');
        }
        const target = d.open ? 1 : 0;
        d.anim = silent ? target : d.anim + Math.sign(target - d.anim) * Math.min(Math.abs(target - d.anim), dt * 7);
      }
    }

    // Doors never close on anyone standing in them.
    occupied(tiles) {
      const h = C.HALF;
      const bodies = [this.player, this.clone, ...this.guards].filter(Boolean);
      return tiles.some((t) =>
        bodies.some((e) => e.x + h > t.c * T && e.x - h < (t.c + 1) * T && e.y + h > t.r * T && e.y - h < (t.r + 1) * T)
      );
    }

    updateItems(dt) {
      const p = this.player;
      const cl = this.clone;
      for (const it of this.level.items) {
        if (it.taken) continue;
        if (it.wisp > 0) it.wisp -= dt;
        if (Math.hypot(it.x - p.x, it.y - p.y) < 18) {
          it.taken = true;
          if (it.type === 'key') {
            this.keys++;
            A.play('key');
            this.text(it.x, it.y - 14, '+ Key', '#fbbf24');
            this.burst(it.x, it.y, '#fbbf24', 14, 90);
          } else {
            this.shards++;
            A.play('pickup');
            this.text(it.x, it.y - 14, `Shard ${this.shards}/${this.shardTotal}`, '#c4b5fd');
            this.burst(it.x, it.y, '#c084fc', 14, 90);
          }
        } else if (cl && Math.hypot(it.x - cl.x, it.y - cl.y) < 18 && it.wisp <= 0) {
          // Brief: the clone cannot collect items.
          it.wisp = 1.5;
          A.play('wisp');
          this.text(it.x, it.y - 14, "Shadows can't grab!", '#a1a1c2');
          this.burst(it.x, it.y, '#64607a', 8, 40);
        }
      }
    }

    // ---------- effects ----------

    burst(x, y, color, n, speed) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.3 + Math.random() * 0.7);
        const life = 0.4 + Math.random() * 0.4;
        this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, size: 2 + Math.random() * 2.5, color });
      }
    }

    text(x, y, str, color) {
      this.texts.push({ x, y, str, color, life: 1.4, max: 1.4 });
    }

    updateFx(dt) {
      if (this.shake > 0) this.shake -= dt;
      // Stars on the results screen pop in one after another.
      if (this.state === 'won') {
        const r = this.result;
        while (r.shown < 3 && r.t > 0.45 + r.shown * 0.28) {
          if (r.stars[r.shown]) A.play('star');
          r.shown++;
        }
      }
      for (const p of this.particles) {
        p.life -= dt;
        if (p.ring) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
      this.particles = this.particles.filter((p) => p.life > 0);
      for (const t of this.texts) {
        t.life -= dt;
        t.y -= 22 * dt;
      }
      this.texts = this.texts.filter((t) => t.life > 0);
    }
  }

  SCE.Game = Game;
})();
