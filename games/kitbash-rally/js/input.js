// Keyboard, mouse, touch and gamepads in one place. Presses are latched until
// the end of the next simulation step, so a quick tap is never lost. Menus read
// nav('up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'prev' | 'next')
// from every device at once; races read player(i) for one driver's controls.
(function () {
  const KR = window.KR;
  const W = 960, H = 540;

  const SOLO = {
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], gas: ['KeyW', 'ArrowUp'], brake: ['KeyS', 'ArrowDown'],
    hop: ['Space', 'KeyF', 'KeyJ'], boost: ['ShiftLeft', 'ShiftRight', 'KeyG', 'KeyK'],
  };
  const DUO = [
    { left: ['KeyA'], right: ['KeyD'], gas: ['KeyW'], brake: ['KeyS'], hop: ['KeyF'], boost: ['KeyG'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], gas: ['ArrowUp'], brake: ['ArrowDown'], hop: ['Enter', 'Slash', 'Numpad0'], boost: ['ShiftRight', 'Period', 'NumpadDecimal'] },
  ];
  const NAV = {
    up: ['ArrowUp', 'KeyW', 'Pad12'], down: ['ArrowDown', 'KeyS', 'Pad13'], left: ['ArrowLeft', 'KeyA', 'Pad14'], right: ['ArrowRight', 'KeyD', 'Pad15'],
    confirm: ['Enter', 'Space', 'Pad0'], back: ['Escape', 'Backspace', 'Pad1'], prev: ['KeyQ', 'Pad4'], next: ['KeyE', 'Pad5'],
  };
  const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace']);
  const DEAD = 0.22;

  const I = {
    down: new Set(),
    pressed: new Set(),
    clicks: [],
    mouse: null,
    mouseMoved: false,
    drag: null, // { x0, y0, x, y, dx } while a pointer is held
    wheel: 0,
    device: 'keyboard',
    touches: new Map(), // id -> {x, y} in game coordinates
    touchUsed: false,
    pads: [], // per gamepad slot: { down:Set, pressed:Set, ax, ay, lt, rt, navDir }
    canvas: null,
    lastTouch: 0,

    init(canvas) {
      this.canvas = canvas;
      addEventListener('keydown', (e) => {
        KR.Audio.unlock();
        this.device = 'keyboard';
        if (PREVENT.has(e.code)) e.preventDefault();
        if (!e.repeat) this.pressed.add(e.code);
        this.down.add(e.code);
      });
      addEventListener('keyup', (e) => this.down.delete(e.code));
      addEventListener('blur', () => this.reset());

      const isTouchEcho = () => performance.now() - this.lastTouch < 700;
      canvas.addEventListener('mousedown', (e) => {
        KR.Audio.unlock();
        if (isTouchEcho()) return;
        this.device = this.device === 'gamepad' || this.device === 'touch' ? 'keyboard' : this.device;
        const p = this.toGame(e.clientX, e.clientY);
        this.clicks.push(p);
        this.drag = { x0: p.x, y0: p.y, x: p.x, y: p.y, dx: 0 };
      });
      addEventListener('mousemove', (e) => {
        if (isTouchEcho()) return;
        const p = this.toGame(e.clientX, e.clientY);
        if (this.drag) { this.drag.dx += p.x - this.drag.x; this.drag.x = p.x; this.drag.y = p.y; }
        this.mouse = p;
        this.mouseMoved = true;
      });
      addEventListener('mouseup', () => { this.drag = null; });
      canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      const opts = { passive: false };
      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        KR.Audio.unlock();
        this.device = 'touch';
        this.touchUsed = true;
        this.lastTouch = performance.now();
        for (const t of e.changedTouches) {
          const p = this.toGame(t.clientX, t.clientY);
          this.touches.set(t.identifier, { x: p.x, y: p.y, x0: p.x, y0: p.y, fresh: true });
          this.clicks.push(p);
          if (!this.drag) this.drag = { id: t.identifier, x0: p.x, y0: p.y, x: p.x, y: p.y, dx: 0 };
        }
      }, opts);
      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          const p = this.toGame(t.clientX, t.clientY), q = this.touches.get(t.identifier);
          if (q) { q.x = p.x; q.y = p.y; }
          if (this.drag && this.drag.id === t.identifier) { this.drag.dx += p.x - this.drag.x; this.drag.x = p.x; this.drag.y = p.y; }
        }
      }, opts);
      const end = (e) => {
        e.preventDefault();
        this.lastTouch = performance.now();
        for (const t of e.changedTouches) {
          this.touches.delete(t.identifier);
          if (this.drag && this.drag.id === t.identifier) this.drag = null;
        }
      };
      canvas.addEventListener('touchend', end, opts);
      canvas.addEventListener('touchcancel', end, opts);
      addEventListener('gamepadconnected', () => { this.device = 'gamepad'; });
    },

    reset() {
      this.down.clear();
      this.pressed.clear();
      this.touches.clear();
      this.drag = null;
      for (const p of this.pads) if (p) { p.down.clear(); p.pressed.clear(); }
    },

    toGame(cx, cy) {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((cx - r.left) * W) / r.width, y: ((cy - r.top) * H) / r.height };
    },

    poll() {
      const list = navigator.getGamepads ? Array.from(navigator.getGamepads() || []) : [];
      const live = list.filter((g) => g && g.connected);
      live.forEach((gp, slot) => {
        const p = this.pads[slot] || (this.pads[slot] = { down: new Set(), pressed: new Set(), ax: 0, ay: 0, lt: 0, rt: 0, navDir: null });
        gp.buttons.forEach((b, i) => {
          const on = !!(b && (b.pressed || b.value > 0.5));
          const code = 'Pad' + i;
          if (on && !p.down.has(code)) { p.pressed.add(code); this.pressed.add(code); this.device = 'gamepad'; }
          if (on) p.down.add(code); else p.down.delete(code);
        });
        p.lt = gp.buttons[6] ? gp.buttons[6].value || 0 : 0;
        p.rt = gp.buttons[7] ? gp.buttons[7].value || 0 : 0;
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        p.ax = Math.abs(ax) > DEAD ? ax : 0;
        p.ay = Math.abs(ay) > DEAD ? ay : 0;
        if (p.ax || p.ay) this.device = 'gamepad';
        let dir = null;
        if (Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'Pad15' : 'Pad14') : ay > 0 ? 'Pad13' : 'Pad12';
        if (dir && dir !== p.navDir) this.pressed.add(dir);
        p.navDir = dir;
      });
      this.pads.length = live.length;
    },

    endTick() {
      this.pressed.clear();
      for (const p of this.pads) if (p) p.pressed.clear();
      this.clicks.length = 0;
      this.mouseMoved = false;
      this.wheel = 0;
      for (const t of this.touches.values()) t.fresh = false;
    },

    any(codes) { return codes.some((c) => this.down.has(c)); },
    hit(codes) { return codes.some((c) => this.pressed.has(c)); },
    key(code) { return this.pressed.has(code); },
    nav(name) { return this.hit(NAV[name]); },
    pausePressed() { return this.hit(['Escape', 'KeyP', 'Pad9']); },

    // Is a finger resting inside this rectangle? (touch race buttons)
    touchIn(r) {
      for (const t of this.touches.values()) if (t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h) return true;
      return false;
    },
    touchTapIn(r) {
      for (const t of this.touches.values()) if (t.fresh && t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h) return true;
      return false;
    },

    // One driver's controls. humans = 1 lets every key and pad drive.
    player(i, humans, touchRects, autoGas) {
      const map = humans === 1 ? SOLO : DUO[i];
      let steer = (this.any(map.right) ? 1 : 0) - (this.any(map.left) ? 1 : 0);
      let gas = this.any(map.gas) ? 1 : 0;
      let brake = this.any(map.brake);
      let hop = this.hit(map.hop);
      let boost = this.hit(map.boost);
      const pads = humans === 1 ? this.pads : [this.pads[i]];
      for (const p of pads) {
        if (!p) continue;
        if (p.ax) steer = p.ax;
        if (p.down.has('Pad14')) steer = -1;
        if (p.down.has('Pad15')) steer = 1;
        if (p.down.has('Pad0') || p.rt > 0.1) gas = Math.max(gas, p.down.has('Pad0') ? 1 : p.rt);
        if (p.down.has('Pad2') || p.lt > 0.3) brake = true;
        if (p.pressed.has('Pad1') || p.pressed.has('Pad4')) hop = true;
        if (p.pressed.has('Pad3') || p.pressed.has('Pad5')) boost = true;
      }
      if (touchRects && i === 0) {
        if (this.touchIn(touchRects.left)) steer = -1;
        if (this.touchIn(touchRects.right)) steer = 1;
        if (this.touchIn(touchRects.brake)) brake = true;
        if (this.touchTapIn(touchRects.hop)) hop = true;
        if (this.touchTapIn(touchRects.boost)) boost = true;
        if (autoGas && this.touchUsed && !brake) gas = 1;
      }
      return { steer, gas: brake ? 0 : gas, brake, hop, boost };
    },
  };

  KR.Input = I;
})();
