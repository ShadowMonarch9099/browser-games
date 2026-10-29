// Keyboard, mouse and touch input. Edge-triggered presses are kept until the
// next simulation tick consumes them (see endTick).
(function () {
  const C = SCE.CFG;
  const UP = ['KeyW', 'ArrowUp'];
  const DOWN = ['KeyS', 'ArrowDown'];
  const LEFT = ['KeyA', 'ArrowLeft'];
  const RIGHT = ['KeyD', 'ArrowRight'];
  const CLONE = ['Space', 'KeyC'];
  const PREVENT = new Set([...UP, ...DOWN, ...LEFT, ...RIGHT, 'Space']);
  const STICK_RADIUS = 40;

  const Input = {
    down: new Set(),
    pressed: new Set(),
    clicks: [],
    touchEnabled: false,
    stick: null, // { id, ox, oy, x, y }
    cloneTouch: null,
    canvas: null,

    init(canvas) {
      this.canvas = canvas;

      window.addEventListener('keydown', (e) => {
        SCE.Audio.unlock();
        if (PREVENT.has(e.code)) e.preventDefault();
        if (!e.repeat) this.pressed.add(e.code);
        this.down.add(e.code);
      });
      window.addEventListener('keyup', (e) => this.down.delete(e.code));
      window.addEventListener('blur', () => this.reset());

      canvas.addEventListener('mousedown', (e) => {
        SCE.Audio.unlock();
        this.clicks.push(this.toGame(e.clientX, e.clientY));
      });

      const opts = { passive: false };
      canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), opts);
      canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), opts);
      canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), opts);
      canvas.addEventListener('touchcancel', (e) => this.onTouchEnd(e), opts);
    },

    reset() {
      this.down.clear();
      this.pressed.clear();
      this.stick = null;
      this.cloneTouch = null;
    },

    toGame(cx, cy) {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((cx - r.left) * C.W) / r.width, y: ((cy - r.top) * C.H) / r.height };
    },

    onTouchStart(e) {
      e.preventDefault();
      SCE.Audio.unlock();
      this.touchEnabled = true;
      for (const t of e.changedTouches) {
        const p = this.toGame(t.clientX, t.clientY);
        this.clicks.push(p);
        if (p.y < 40) continue; // top bar is for the pause button
        if (p.x < C.W / 2) {
          if (!this.stick) this.stick = { id: t.identifier, ox: p.x, oy: p.y, x: p.x, y: p.y };
        } else if (this.cloneTouch === null) {
          this.cloneTouch = t.identifier;
          this.pressed.add('TouchClone');
        }
      }
    },

    onTouchMove(e) {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) {
          const p = this.toGame(t.clientX, t.clientY);
          this.stick.x = p.x;
          this.stick.y = p.y;
        }
      }
    },

    onTouchEnd(e) {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) this.stick = null;
        if (t.identifier === this.cloneTouch) this.cloneTouch = null;
      }
    },

    isDown(codes) {
      return codes.some((c) => this.down.has(c));
    },

    wasPressed(...codes) {
      return codes.some((c) => this.pressed.has(c));
    },

    axis() {
      let x = (this.isDown(RIGHT) ? 1 : 0) - (this.isDown(LEFT) ? 1 : 0);
      let y = (this.isDown(DOWN) ? 1 : 0) - (this.isDown(UP) ? 1 : 0);
      if (this.stick) {
        const dx = this.stick.x - this.stick.ox;
        const dy = this.stick.y - this.stick.oy;
        const d = Math.hypot(dx, dy);
        if (d > 8) {
          const m = Math.min(1, d / STICK_RADIUS);
          x = (dx / d) * m;
          y = (dy / d) * m;
        }
      }
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      return { x, y };
    },

    cloneDown() {
      return this.isDown(CLONE) || this.cloneTouch !== null;
    },

    clonePressed() {
      return this.wasPressed(...CLONE, 'TouchClone');
    },

    endTick() {
      this.pressed.clear();
      this.clicks.length = 0;
    },
  };

  SCE.Input = Input;
})();
