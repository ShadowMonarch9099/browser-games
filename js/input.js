// Keyboard, mouse, touch and gamepad input. Edge-triggered presses are kept
// until the next simulation tick consumes them (see endTick). Gamepad buttons
// and touch gestures are folded into the same `pressed`/`down` sets as
// virtual codes ('PadA', 'TouchClone', ...), so game code never cares where a
// press came from.
(function () {
  const C = SCE.CFG;
  const UP = ['KeyW', 'ArrowUp'];
  const DOWN = ['KeyS', 'ArrowDown'];
  const LEFT = ['KeyA', 'ArrowLeft'];
  const RIGHT = ['KeyD', 'ArrowRight'];
  const CLONE = ['Space', 'KeyC', 'TouchClone', 'PadA'];
  const PREVENT = new Set([...UP, ...DOWN, ...LEFT, ...RIGHT, 'Space']);
  const NAV = {
    up: [...UP, 'PadUp'],
    down: [...DOWN, 'PadDown'],
    left: [...LEFT, 'PadLeft'],
    right: [...RIGHT, 'PadRight'],
    confirm: ['Enter', 'Space', 'PadA'],
    back: ['Escape', 'Backspace', 'PadB'],
  };
  // Standard gamepad mapping.
  const PAD_BUTTONS = { 0: 'PadA', 1: 'PadB', 3: 'PadY', 9: 'PadStart', 12: 'PadUp', 13: 'PadDown', 14: 'PadLeft', 15: 'PadRight' };
  const STICK_RADIUS = 40;
  const DEADZONE = 0.25;

  const Input = {
    down: new Set(),
    pressed: new Set(),
    clicks: [],
    mouse: null, // last pointer position in game coords
    mouseMoved: false,
    device: 'keyboard', // 'keyboard' | 'touch' | 'gamepad' — drives on-screen prompts
    touchEnabled: false,
    playMode: false, // set by the game: touches drive the stick/clone button only while playing
    stick: null, // { id, ox, oy, x, y }
    cloneTouch: null,
    pad: { x: 0, y: 0, prev: {}, navDir: null },
    canvas: null,

    init(canvas) {
      this.canvas = canvas;

      window.addEventListener('keydown', (e) => {
        SCE.Audio.unlock();
        this.device = 'keyboard';
        if (PREVENT.has(e.code)) e.preventDefault();
        if (!e.repeat) this.pressed.add(e.code);
        this.down.add(e.code);
      });
      window.addEventListener('keyup', (e) => this.down.delete(e.code));
      window.addEventListener('blur', () => this.reset());

      canvas.addEventListener('mousedown', (e) => {
        SCE.Audio.unlock();
        if (this.touchEnabled && performance.now() - this.lastTouch < 800) return; // emulated mouse after a tap
        this.device = 'keyboard';
        this.clicks.push(this.toGame(e.clientX, e.clientY));
      });
      canvas.addEventListener('mousemove', (e) => {
        if (this.touchEnabled && performance.now() - this.lastTouch < 800) return;
        this.mouse = this.toGame(e.clientX, e.clientY);
        this.mouseMoved = true;
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      const opts = { passive: false };
      canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), opts);
      canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), opts);
      canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), opts);
      canvas.addEventListener('touchcancel', (e) => this.onTouchEnd(e), opts);
      window.addEventListener('gamepadconnected', () => (this.device = 'gamepad'));
    },

    lastTouch: 0,

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
      this.device = 'touch';
      this.lastTouch = performance.now();
      const btn = C.TOUCH_CLONE;
      for (const t of e.changedTouches) {
        const p = this.toGame(t.clientX, t.clientY);
        this.clicks.push(p);
        if (!this.playMode || p.y < 44) continue; // top bar holds the pause button
        if (Math.hypot(p.x - btn.x, p.y - btn.y) < btn.hit) {
          if (this.cloneTouch === null) {
            this.cloneTouch = t.identifier;
            this.pressed.add('TouchClone');
          }
        } else if (!this.stick) {
          this.stick = { id: t.identifier, ox: p.x, oy: p.y, x: p.x, y: p.y };
        }
      }
    },

    onTouchMove(e) {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) {
          const p = this.toGame(t.clientX, t.clientY);
          // Floating stick: the base follows the thumb if it drags too far.
          const dx = p.x - this.stick.ox;
          const dy = p.y - this.stick.oy;
          const d = Math.hypot(dx, dy);
          if (d > STICK_RADIUS * 1.6) {
            this.stick.ox = p.x - (dx / d) * STICK_RADIUS * 1.6;
            this.stick.oy = p.y - (dy / d) * STICK_RADIUS * 1.6;
          }
          this.stick.x = p.x;
          this.stick.y = p.y;
        }
      }
    },

    onTouchEnd(e) {
      e.preventDefault();
      this.lastTouch = performance.now();
      for (const t of e.changedTouches) {
        if (this.stick && t.identifier === this.stick.id) this.stick = null;
        if (t.identifier === this.cloneTouch) this.cloneTouch = null;
      }
    },

    // Called once per tick before the game updates.
    poll() {
      const nav = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(nav || []).find((g) => g && g.connected);
      const pad = this.pad;
      pad.x = 0;
      pad.y = 0;
      if (!gp) return;
      for (const [i, code] of Object.entries(PAD_BUTTONS)) {
        const b = gp.buttons[i];
        const on = !!(b && b.pressed);
        if (on && !pad.prev[i]) {
          this.pressed.add(code);
          this.device = 'gamepad';
        }
        if (on) this.down.add(code);
        else this.down.delete(code);
        pad.prev[i] = on;
      }
      const ax = gp.axes[0] || 0;
      const ay = gp.axes[1] || 0;
      if (Math.hypot(ax, ay) > DEADZONE) {
        pad.x = ax;
        pad.y = ay;
        this.device = 'gamepad';
      }
      // Stick flicks navigate menus too.
      let dir = null;
      if (Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) {
        dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'PadRight' : 'PadLeft') : ay > 0 ? 'PadDown' : 'PadUp';
      }
      if (dir && dir !== pad.navDir) this.pressed.add(dir);
      pad.navDir = dir;
    },

    isDown(codes) {
      return codes.some((c) => this.down.has(c));
    },

    wasPressed(...codes) {
      return codes.some((c) => this.pressed.has(c));
    },

    nav(name) {
      return this.wasPressed(...NAV[name]);
    },

    axis() {
      const dpad = (codes, pad) => this.isDown(codes) || this.down.has(pad);
      let x = (dpad(RIGHT, 'PadRight') ? 1 : 0) - (dpad(LEFT, 'PadLeft') ? 1 : 0);
      let y = (dpad(DOWN, 'PadDown') ? 1 : 0) - (dpad(UP, 'PadUp') ? 1 : 0);
      if (this.pad.x || this.pad.y) {
        x = this.pad.x;
        y = this.pad.y;
      }
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

    clonePressed() {
      return this.wasPressed(...CLONE);
    },

    endTick() {
      this.pressed.clear();
      this.clicks.length = 0;
      this.mouseMoved = false;
    },
  };

  SCE.Input = Input;
})();
