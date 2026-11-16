// Keyboard, mouse, touch and gamepad folded into one set of codes. Touch in
// play: a floating stick on the left side, round buttons on the right.
(function () {
  const C = LL.CFG;
  const NAV = {
    up: ['KeyW', 'ArrowUp', 'PadUp'],
    down: ['KeyS', 'ArrowDown', 'PadDown'],
    left: ['KeyA', 'ArrowLeft', 'PadLeft'],
    right: ['KeyD', 'ArrowRight', 'PadRight'],
    confirm: ['Enter', 'Space', 'PadA'],
    back: ['Escape', 'Backspace', 'PadB'],
  };
  const ACT = {
    swing: ['Space', 'KeyF', 'KeyJ', 'PadA', 'TSwing'],
    flame: ['KeyG', 'ShiftLeft', 'ShiftRight', 'KeyK', 'PadB', 'TFlame'],
    map: ['KeyM', 'Tab', 'PadY', 'TMap'],
    satchel: ['KeyI', 'PadX'],
    pause: ['Escape', 'KeyP', 'PadStart'],
  };
  const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace']);
  const PAD = { 0: 'PadA', 1: 'PadB', 2: 'PadX', 3: 'PadY', 9: 'PadStart', 12: 'PadUp', 13: 'PadDown', 14: 'PadLeft', 15: 'PadRight' };
  const TOUCH = {
    swing: { x: 868, y: 436, r: 54, code: 'TSwing', label: 'SWING' },
    flame: { x: 760, y: 476, r: 36, code: 'TFlame', label: 'FLAME' },
    map: { x: 892, y: 326, r: 28, code: 'TMap', label: 'MAP' },
  };
  const R = 46;

  const I = {
    down: new Set(),
    pressed: new Set(),
    clicks: [],
    mouse: null,
    mouseMoved: false,
    device: 'keyboard',
    touchOn: false,
    playMode: false,
    stick: null,
    held: new Map(),
    pad: { prev: {}, x: 0, y: 0, nav: null },
    TOUCH,
    R,
    lastTouch: 0,

    init(canvas) {
      this.canvas = canvas;
      addEventListener('keydown', (e) => {
        LL.Audio.unlock();
        this.device = 'keyboard';
        if (PREVENT.has(e.code)) e.preventDefault();
        if (!e.repeat) this.pressed.add(e.code);
        this.down.add(e.code);
      });
      addEventListener('keyup', (e) => this.down.delete(e.code));
      addEventListener('blur', () => this.reset());
      canvas.addEventListener('mousedown', (e) => {
        LL.Audio.unlock();
        if (performance.now() - this.lastTouch < 800) return;
        this.device = 'keyboard';
        this.clicks.push(this.toGame(e.clientX, e.clientY));
      });
      canvas.addEventListener('mousemove', (e) => {
        if (performance.now() - this.lastTouch < 800) return;
        this.mouse = this.toGame(e.clientX, e.clientY);
        this.mouseMoved = true;
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      const o = { passive: false };
      canvas.addEventListener('touchstart', (e) => this.touch(e, 0), o);
      canvas.addEventListener('touchmove', (e) => this.touch(e, 1), o);
      canvas.addEventListener('touchend', (e) => this.touch(e, 2), o);
      canvas.addEventListener('touchcancel', (e) => this.touch(e, 2), o);
      addEventListener('gamepadconnected', () => (this.device = 'gamepad'));
    },
    reset() {
      this.down.clear();
      this.pressed.clear();
      this.stick = null;
      this.held.clear();
    },
    toGame(cx, cy) {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((cx - r.left) * C.W) / r.width, y: ((cy - r.top) * C.H) / r.height };
    },
    touch(e, kind) {
      e.preventDefault();
      LL.Audio.unlock();
      this.touchOn = true;
      this.device = 'touch';
      this.lastTouch = performance.now();
      for (const t of e.changedTouches) {
        const p = this.toGame(t.clientX, t.clientY);
        if (kind === 0) this.clicks.push(p);
        if (kind === 2) {
          const c = this.held.get(t.identifier);
          if (c) this.down.delete(c);
          this.held.delete(t.identifier);
          if (this.stick && this.stick.id === t.identifier) this.stick = null;
          continue;
        }
        if (!this.playMode) continue;
        if (kind === 0) {
          if (p.y < 70 && p.x > C.W - 90) continue; // the pause button
          const b = Object.values(TOUCH).find((q) => Math.hypot(p.x - q.x, p.y - q.y) < q.r + 14);
          if (b) {
            this.down.add(b.code);
            this.pressed.add(b.code);
            this.held.set(t.identifier, b.code);
          } else if (p.x < C.W * 0.6 && !this.stick) this.stick = { id: t.identifier, ox: p.x, oy: p.y, x: p.x, y: p.y };
        } else if (this.stick && this.stick.id === t.identifier) {
          const dx = p.x - this.stick.ox;
          const dy = p.y - this.stick.oy;
          const d = Math.hypot(dx, dy);
          if (d > R * 1.5) {
            this.stick.ox = p.x - (dx / d) * R * 1.5;
            this.stick.oy = p.y - (dy / d) * R * 1.5;
          }
          this.stick.x = p.x;
          this.stick.y = p.y;
        }
      }
    },
    poll() {
      const list = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(list || []).find((g) => g && g.connected);
      const pad = this.pad;
      pad.x = 0;
      pad.y = 0;
      if (!gp) return;
      for (const [i, code] of Object.entries(PAD)) {
        const on = !!(gp.buttons[i] && gp.buttons[i].pressed);
        if (on && !pad.prev[i]) {
          this.pressed.add(code);
          this.device = 'gamepad';
          LL.Audio.unlock();
        }
        if (on) this.down.add(code);
        else if (pad.prev[i]) this.down.delete(code);
        pad.prev[i] = on;
      }
      const ax = gp.axes[0] || 0;
      const ay = gp.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.25) {
        pad.x = ax;
        pad.y = ay;
        this.device = 'gamepad';
      }
      let dir = null;
      if (Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'PadRight' : 'PadLeft') : ay > 0 ? 'PadDown' : 'PadUp';
      if (dir && dir !== pad.nav) this.pressed.add(dir);
      pad.nav = dir;
    },
    hit(...codes) {
      return codes.some((c) => this.pressed.has(c));
    },
    nav(n) {
      return this.hit(...NAV[n]);
    },
    act(n) {
      return this.hit(...ACT[n]);
    },
    move() {
      const d = (a) => a.some((c) => this.down.has(c));
      let x = (d(['KeyD', 'ArrowRight', 'PadRight']) ? 1 : 0) - (d(['KeyA', 'ArrowLeft', 'PadLeft']) ? 1 : 0);
      let y = (d(['KeyS', 'ArrowDown', 'PadDown']) ? 1 : 0) - (d(['KeyW', 'ArrowUp', 'PadUp']) ? 1 : 0);
      if (this.pad.x || this.pad.y) {
        x = this.pad.x;
        y = this.pad.y;
      }
      if (this.stick) {
        const dx = this.stick.x - this.stick.ox;
        const dy = this.stick.y - this.stick.oy;
        const l = Math.hypot(dx, dy);
        if (l > 8) {
          const m = Math.min(1, l / R);
          x = (dx / l) * m;
          y = (dy / l) * m;
        }
      }
      const l = Math.hypot(x, y);
      if (l > 1) {
        x /= l;
        y /= l;
      }
      return { x, y };
    },
    endTick() {
      this.pressed.clear();
      this.clicks.length = 0;
      this.mouseMoved = false;
    },
  };
  LL.Input = I;
})();
