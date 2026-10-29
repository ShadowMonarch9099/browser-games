// Player, shadow clone and enemies.
(function () {
  const C = SCE.CFG;
  const T = C.TILE;

  const wrapAngle = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a <= -Math.PI) a += Math.PI * 2;
    return a;
  };

  class Player {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.face = { x: 1, y: 0 };
      this.walkT = 0;
    }
  }

  // The clone is cast at the player's position. It only moves while the clone
  // key is held (steering), and can never leave the 100px leash circle.
  class Clone {
    constructor(x, y, face) {
      this.x = x;
      this.y = y;
      this.sx = x;
      this.sy = y;
      this.face = { ...face };
      this.life = C.CLONE_LIFETIME;
      this.strain = 0; // flashes the leash when the clone hits its edge
    }
  }

  class Guard {
    constructor(def) {
      this.type = def.type;
      const at = def.type === 'patrol' ? def.path[0] : def.at;
      this.c = at[0] + 1; // level coords are interior (column 0 = first floor column)
      this.r = at[1];
      this.x = (this.c + 0.5) * T;
      this.y = (this.r + 0.5) * T;
      this.next = null;
      this.path = (def.path || []).map(([i, r]) => ({ c: i + 1, r }));
      this.wp = this.path.length > 1 ? 1 : 0;
      this.post = { c: this.c, r: this.r };
      this.baseDir = ((def.dir || 0) * Math.PI) / 180;
      this.sweep = ((def.sweep || 0) * Math.PI) / 180;
      this.period = def.period || 4;
      this.speed = this.type === 'hound' ? C.HOUND_SPEED : C.GUARD_SPEED;
      this.state = { patrol: 'patrol', sentry: 'post', hound: 'sleep' }[this.type];
      this.awake = false;
      this.pause = 0;
      this.t = 0;
      this.alert = 0;
      this.bellGoal = null;
      this.angle = this.baseDir;
      if (this.type === 'patrol' && this.path.length > 1) {
        const n = this.path[1];
        this.angle = Math.atan2(n.r - this.r, n.c - this.c);
      }
    }

    atCenter() {
      return Math.abs(this.x - (this.c + 0.5) * T) < 0.01 && Math.abs(this.y - (this.r + 0.5) * T) < 0.01;
    }

    at(goal) {
      return !this.next && this.c === goal.c && this.r === goal.r && this.atCenter();
    }

    turnTo(target, dt, rate = C.GUARD_TURN) {
      const diff = wrapAngle(target - this.angle);
      const step = rate * dt;
      this.angle = wrapAngle(this.angle + Math.max(-step, Math.min(step, diff)));
    }

    hearBell(c, r, level) {
      if (Math.hypot((c + 0.5) * T - this.x, (r + 0.5) * T - this.y) > C.BELL_RADIUS) return false;
      const res = level.path({ c: this.c, r: this.r }, { c, r }, 'guard');
      if (res.dist > C.BELL_REACH) return false;
      this.bellGoal = res.dest;
      this.state = 'investigate';
      this.alert = 1;
      return true;
    }

    canSee(x, y, level) {
      const dx = x - this.x;
      const dy = y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > C.VIEW_RANGE) return false;
      if (Math.abs(wrapAngle(Math.atan2(dy, dx) - this.angle)) > C.VIEW_HALF) return false;
      return level.los(this.x, this.y, x, y);
    }

    update(dt, game) {
      const L = game.level;
      const p = game.player;
      this.t += dt;
      if (this.alert > 0) this.alert -= dt;
      let goal = null;
      let face = null;

      switch (this.state) {
        case 'patrol': {
          if (this.pause > 0) {
            this.pause -= dt;
            break;
          }
          goal = this.path[this.wp];
          if (this.at(goal)) {
            this.wp = (this.wp + 1) % this.path.length;
            this.pause = 0.6;
            goal = null;
          }
          break;
        }
        case 'post': {
          if (this.at(this.post)) {
            face = this.baseDir + this.sweep * Math.sin((this.t * 2 * Math.PI) / this.period);
          } else goal = this.post;
          break;
        }
        case 'investigate': {
          goal = this.bellGoal;
          if (this.at(goal)) {
            this.state = 'wait';
            this.waitT = C.BELL_WAIT;
            this.lookBase = this.angle;
            goal = null;
          }
          break;
        }
        case 'wait': {
          this.waitT -= dt;
          face = this.lookBase + Math.sin((C.BELL_WAIT - this.waitT) * 2.2) * 1.1;
          if (this.waitT <= 0) {
            if (this.type === 'patrol') this.state = 'patrol';
            else if (this.type === 'sentry') this.state = 'post';
            else this.state = this.awake ? 'chase' : 'sleep';
          }
          break;
        }
        case 'sleep': {
          if (Math.hypot(p.x - this.x, p.y - this.y) < C.HOUND_WAKE && L.los(this.x, this.y, p.x, p.y)) {
            this.state = 'chase';
            this.awake = true;
            this.alert = 1.2;
            SCE.Audio.play('bark');
          }
          break;
        }
        case 'chase':
          goal = { c: Math.floor(p.x / T), r: Math.floor(p.y / T) };
          break;
      }

      const moved = this.move(dt, L, goal);
      if (!moved && face !== null) this.turnTo(face, dt);
    }

    move(dt, L, goal) {
      // A door shut in our face: turn back to the tile we're leaving.
      if (this.next && L.solid(this.next.c, this.next.r, 'guard')) this.next = null;
      if (!this.next && goal && this.atCenter() && !(this.c === goal.c && this.r === goal.r)) {
        const res = L.path({ c: this.c, r: this.r }, goal, 'guard');
        if (res.next) this.next = res.next;
      }
      const tile = this.next || this;
      const tx = (tile.c + 0.5) * T;
      const ty = (tile.r + 0.5) * T;
      const dx = tx - this.x;
      const dy = ty - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.01) {
        if (this.next) {
          this.c = this.next.c;
          this.r = this.next.r;
          this.next = null;
        }
        return false;
      }
      const step = this.speed * dt;
      if (step >= d) {
        this.x = tx;
        this.y = ty;
      } else {
        this.x += (dx / d) * step;
        this.y += (dy / d) * step;
      }
      this.turnTo(Math.atan2(dy, dx), dt, C.GUARD_TURN * 1.5);
      if (this.next && this.x === tx && this.y === ty) {
        this.c = this.next.c;
        this.r = this.next.r;
        this.next = null;
      }
      return true;
    }
  }

  SCE.wrapAngle = wrapAngle;
  SCE.Player = Player;
  SCE.Clone = Clone;
  SCE.Guard = Guard;
})();
