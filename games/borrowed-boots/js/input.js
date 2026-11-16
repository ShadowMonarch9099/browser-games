// Keyboard, mouse, touch and gamepad, folded into one set of "down" and
// "pressed" codes. Touch buttons and pad buttons become virtual codes
// ('TLeft', 'PadA', ...), so the game never cares where a press came from.
// `device` tracks what was used last so prompts can show the right glyphs.
(function () {
  const C = BB.CFG;
  const LEFT = ['KeyA', 'ArrowLeft', 'PadLeft', 'TLeft'];
  const RIGHT = ['KeyD', 'ArrowRight', 'PadRight', 'TRight'];
  const UP = ['KeyW', 'ArrowUp', 'PadUp'];
  const DOWN = ['KeyS', 'ArrowDown', 'PadDown'];
  const JUMP = ['Space', 'KeyW', 'ArrowUp', 'KeyZ', 'KeyK', 'PadA', 'TJump'];
  const NAV = {
    up: ['KeyW', 'ArrowUp', 'PadUp'],
    down: ['KeyS', 'ArrowDown', 'PadDown'],
    left: ['KeyA', 'ArrowLeft', 'PadLeft'],
    right: ['KeyD', 'ArrowRight', 'PadRight'],
    confirm: ['Enter', 'Space', 'PadA'],
    back: ['Escape', 'Backspace', 'PadB'],
    alt: ['KeyX', 'Delete', 'PadX'],
  };
  const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace']);
  const PAD = { 0: 'PadA', 1: 'PadB', 2: 'PadX', 3: 'PadY', 8: 'PadSelect', 9: 'PadStart', 12: 'PadUp', 13: 'PadDown', 14: 'PadLeft', 15: 'PadRight' };

  // Touch buttons while playing (logical px).
  const TOUCH = {
    left: { x: 78, y: 466, r: 46, code: 'TLeft' },
    right: { x: 190, y: 466, r: 46, code: 'TRight' },
    jump: { x: 872, y: 452, r: 58, code: 'TJump' },
  };

  const Input = {
    down: new Set(),
    pressed: new Set(),
    clicks: [],
    mouse: null,
    mouseMoved: false,
    device: 'keyboard',
    touchOn: false,
    playMode: false,
    touches: new Map(), // id -> code of the touch button it holds
    pad: { prev: {}, ax: 0, ay: 0, nav: null },
    TOUCH,
    lastTouch: 0,

    init(canvas) {
      this.canvas = canvas;
      window.addEventListener('keydown', (e) => {
        BB.Audio.unlock();
        this.device = 'keyboard';
        if (PREVENT.has(e.code)) e.preventDefault();
        if (!e.repeat) this.pressed.add(e.code);
        this.down.add(e.code);
      });
      window.addEventListener('keyup', (e) => this.down.delete(e.code));
      window.addEventListener('blur', () => this.reset());
      canvas.addEventListener('mousedown', (e) => {
        BB.Audio.unlock();
        if (performance.now() - this.lastTouch < 800) return;
        this.device = 'keyboard';
        this.clicks.push(this.toGame(e.clientX, e.clientY));
      });
      canvas.addEventListener('mousemove', (e) => {
        if (performance.now() - this.lastTouch < 800) return;
        this.mouse = this.toGame(e.clientX, e.clientY);
        this.mouseMoved = true;
      });
      canvas.addEventListener('wheel', (e) => {
        this.pressed.add(e.deltaY > 0 ? 'WheelDown' : 'WheelUp');
      }, { passive: true });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      const o = { passive: false };
      canvas.addEventListener('touchstart', (e) => this.touch(e, 'start'), o);
      canvas.addEventListener('touchmove', (e) => this.touch(e, 'move'), o);
      canvas.addEventListener('touchend', (e) => this.touch(e, 'end'), o);
      canvas.addEventListener('touchcancel', (e) => this.touch(e, 'end'), o);
      window.addEventListener('gamepadconnected', () => (this.device = 'gamepad'));
    },

    reset() {
      this.down.clear();
      this.pressed.clear();
      this.touches.clear();
    },

    toGame(cx, cy) {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((cx - r.left) * C.W) / r.width, y: ((cy - r.top) * C.H) / r.height };
    },

    buttonAt(p) {
      for (const b of Object.values(TOUCH)) if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 18) return b.code;
      // the whole left third steers, the right half jumps: forgiving thumbs
      if (p.y > 300 && p.x < 135) return 'TLeft';
      if (p.y > 300 && p.x < 300) return 'TRight';
      if (p.y > 230 && p.x > 600) return 'TJump';
      return null;
    },

    touch(e, kind) {
      e.preventDefault();
      BB.Audio.unlock();
      this.touchOn = true;
      this.device = 'touch';
      this.lastTouch = performance.now();
      for (const t of e.changedTouches) {
        const p = this.toGame(t.clientX, t.clientY);
        const had = this.touches.get(t.identifier);
        if (kind === 'start') this.clicks.push(p);
        if (kind === 'end') {
          if (had) this.down.delete(had);
          this.touches.delete(t.identifier);
          continue;
        }
        if (!this.playMode) continue;
        const code = p.y < 70 ? null : this.buttonAt(p);
        if (code === had) continue;
        if (had) this.down.delete(had);
        if (code) {
          this.down.add(code);
          this.pressed.add(code);
          this.touches.set(t.identifier, code);
        } else this.touches.delete(t.identifier);
      }
    },

    poll() {
      const list = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(list || []).find((g) => g && g.connected);
      const pad = this.pad;
      pad.ax = 0;
      pad.ay = 0;
      if (!gp) return;
      for (const [i, code] of Object.entries(PAD)) {
        const b = gp.buttons[i];
        const on = !!(b && b.pressed);
        if (on && !pad.prev[i]) {
          this.pressed.add(code);
          this.device = 'gamepad';
          BB.Audio.unlock();
        }
        if (on) this.down.add(code);
        else if (pad.prev[i]) this.down.delete(code);
        pad.prev[i] = on;
      }
      const ax = gp.axes[0] || 0;
      const ay = gp.axes[1] || 0;
      if (Math.abs(ax) > 0.3) pad.ax = ax;
      if (Math.abs(ay) > 0.5) pad.ay = ay;
      if (pad.ax || pad.ay) this.device = 'gamepad';
      let dir = null;
      if (Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'PadRight' : 'PadLeft') : ay > 0 ? 'PadDown' : 'PadUp';
      if (dir && dir !== pad.nav) this.pressed.add(dir);
      pad.nav = dir;
    },

    any(codes) {
      return codes.some((c) => this.down.has(c));
    },
    hit(...codes) {
      return codes.some((c) => this.pressed.has(c));
    },
    nav(name) {
      if (name === 'up' && this.pressed.has('WheelUp')) return true;
      if (name === 'down' && this.pressed.has('WheelDown')) return true;
      return this.hit(...NAV[name]);
    },

    // What the hero should do this tick (the shape sim.js expects).
    play() {
      let x = (this.any(RIGHT) ? 1 : 0) - (this.any(LEFT) ? 1 : 0);
      if (this.pad.ax) x = this.pad.ax > 0 ? 1 : -1;
      const hold = this.any(JUMP);
      return {
        x,
        hold,
        press: JUMP.some((c) => this.pressed.has(c)),
        up: this.any(UP) || this.pad.ay < -0.5,
        down: this.any(DOWN) || this.pad.ay > 0.5,
      };
    },

    endTick() {
      this.pressed.clear();
      this.clicks.length = 0;
      this.mouseMoved = false;
    },
  };

  BB.Input = Input;
})();
