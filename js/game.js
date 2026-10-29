// Game state machine and per-tick simulation.
(function () {
  const C = SCE.CFG;
  const T = C.TILE;
  const A = SCE.Audio;
  const I = SCE.Input;

  const FAIL_TEXT = {
    spotted: ['SPOTTED!', 'A guard saw you. Your shadow is invisible to them — you are not.'],
    caught: ['CAUGHT!', 'You walked right into a guard.'],
    hound: ['THE HOUND GOT YOU', 'Hounds wake when you get close. Seal them in or outrun them.'],
    time: ['OUT OF TIME', 'Every level must be escaped within 60 seconds.'],
  };

  class Game {
    constructor() {
      this.save = SCE.Save.load();
      A.setMuted(this.save.muted);
      this.state = 'title';
      this.sel = Math.min(this.save.unlocked, SCE.LEVELS.length) - 1;
      this.time = 0;
      this.buttons = [];
      this.particles = [];
      this.texts = [];
      this.shake = 0;
      this.levelIndex = 0;
    }

    // ---------- flow ----------

    goTitle() {
      this.state = 'title';
    }

    goSelect() {
      this.state = 'select';
      this.sel = Math.min(this.sel, SCE.LEVELS.length - 1);
    }

    startLevel(i) {
      const def = SCE.LEVELS[i];
      this.levelIndex = i;
      this.sel = i;
      this.level = new SCE.Level(def);
      this.player = new SCE.Player(this.level.start.x, this.level.start.y);
      this.clone = null;
      this.cloneCooldown = 0;
      this.steering = false;
      this.timeLeft = C.LEVEL_TIME;
      this.keys = 0;
      this.shards = 0;
      this.shardTotal = this.level.items.filter((it) => it.type === 'shard').length;
      this.guards = (def.guards || []).map((g) => new SCE.Guard(g));
      this.particles = [];
      this.texts = [];
      this.shake = 0;
      this.lastTickSec = null;
      this.lockWarn = 0;
      this.result = null;
      this.state = 'play';
      this.updateDoors(0, true);
    }

    pause() {
      if (this.state !== 'play') return;
      this.state = 'paused';
      I.reset();
    }

    resume() {
      this.state = 'play';
    }

    toggleMute() {
      A.setMuted(!A.muted);
      this.save.muted = A.muted;
      SCE.Save.store(this.save);
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
      this.result = { stars, used, newBest };
      this.state = 'won';
      A.play('win');
      this.burst(this.player.x, this.player.y, '#4ade80', 30, 160);
    }

    fail(reason) {
      this.state = 'failed';
      this.result = { reason, title: FAIL_TEXT[reason][0], text: FAIL_TEXT[reason][1] };
      this.shake = 0.35;
      A.play(reason === 'time' ? 'timeout' : 'caught');
    }

    // ---------- main update ----------

    update(dt) {
      this.time += dt;
      if (I.wasPressed('KeyM')) this.toggleMute();

      for (const click of I.clicks) {
        const b = this.buttons.find((b) => click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h);
        if (b) {
          A.play('click');
          b.action();
          return;
        }
      }

      switch (this.state) {
        case 'title':
          if (I.wasPressed('Space', 'Enter')) this.goSelect();
          break;
        case 'select':
          this.updateSelect();
          break;
        case 'play':
          this.updatePlay(dt);
          break;
        case 'paused':
          if (I.wasPressed('Escape', 'KeyP')) this.resume();
          else if (I.wasPressed('KeyR')) this.startLevel(this.levelIndex);
          else if (I.wasPressed('KeyQ')) this.goSelect();
          break;
        case 'won':
          if (I.wasPressed('Enter', 'Space')) this.nextLevel();
          else if (I.wasPressed('KeyR')) this.startLevel(this.levelIndex);
          else if (I.wasPressed('Escape')) this.goSelect();
          break;
        case 'failed':
          if (I.wasPressed('KeyR', 'Space', 'Enter')) this.startLevel(this.levelIndex);
          else if (I.wasPressed('Escape')) this.goSelect();
          break;
      }
      if (this.state !== 'paused') this.updateFx(dt);
    }

    nextLevel() {
      if (this.levelIndex + 1 < SCE.LEVELS.length) this.startLevel(this.levelIndex + 1);
      else this.goSelect();
    }

    updateSelect() {
      const n = SCE.LEVELS.length;
      const cols = 4;
      if (I.wasPressed('ArrowRight', 'KeyD')) this.sel = (this.sel + 1) % n;
      if (I.wasPressed('ArrowLeft', 'KeyA')) this.sel = (this.sel - 1 + n) % n;
      if (I.wasPressed('ArrowDown', 'KeyS')) this.sel = Math.min(n - 1, this.sel + cols);
      if (I.wasPressed('ArrowUp', 'KeyW')) this.sel = Math.max(0, this.sel - cols);
      if (I.wasPressed('Enter', 'Space') && this.sel < this.save.unlocked) this.startLevel(this.sel);
      if (I.wasPressed('Escape')) this.goTitle();
    }

    updatePlay(dt) {
      if (I.wasPressed('Escape', 'KeyP')) return this.pause();
      if (I.wasPressed('KeyR')) return this.startLevel(this.levelIndex);

      const L = this.level;
      const p = this.player;

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
      if (this.cloneCooldown > 0) this.cloneCooldown -= dt;
      if (I.clonePressed() && !this.clone) {
        if (this.cloneCooldown <= 0) this.spawnClone();
        else A.play('denied');
      }
      const ax = I.axis();
      this.steering = !!this.clone && I.cloneDown();
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

      for (const g of this.guards) {
        if (Math.hypot(g.x - p.x, g.y - p.y) < C.CATCH_DIST) return this.fail(g.type === 'hound' ? 'hound' : 'caught');
        if (g.type !== 'hound' && g.canSee(p.x, p.y, L)) {
          g.alert = 2;
          return this.fail('spotted');
        }
      }
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
      A.play('clone');
      this.burst(p.x, p.y, '#a78bfa', 18, 80);
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
      this.steering = false;
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
