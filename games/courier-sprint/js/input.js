// Courier Sprint input. Keyboard, mouse, touch swipes and gamepads all turn
// into the same small set of actions, collected per tick:
//   left right up down     lane / jump / roll in play, navigation in menus
//   confirm back pause restart mute
// plus `held.down` (slide held) and taps with a screen position for buttons.
(function (root) {
  'use strict';
  const KEYS = {
    ArrowLeft: ['left'], KeyA: ['left'], ArrowRight: ['right'], KeyD: ['right'],
    ArrowUp: ['up'], KeyW: ['up'], ArrowDown: ['down'], KeyS: ['down'],
    Space: ['jump', 'confirm'], Enter: ['confirm'], NumpadEnter: ['confirm'],
    Escape: ['back', 'pause'], Backspace: ['back'], KeyP: ['pause'],
    KeyR: ['restart'], KeyM: ['mute'], KeyF: ['fullscreen'],
  };
  // standard mapping: A jump/confirm, B roll/back, X roll, Y restart, Start pause
  const PAD = { 0: ['jump', 'confirm'], 1: ['slide', 'back'], 2: ['slide'], 3: ['restart'], 9: ['pause'], 8: ['back'], 12: ['up'], 13: ['down'], 14: ['left'], 15: ['right'] };
  const SWIPE = 26; // px of travel before a touch counts as a swipe

  const I = {
    pressed: new Set(), held: { down: false }, taps: [], hover: null,
    device: 'keyboard', keysDown: new Set(), padPrev: {}, padDir: null, padDown: false,
    touches: new Map(), canvas: null, lastTouch: 0, swipeDown: false,

    init(canvas) {
      this.canvas = canvas;
      const unlock = () => root.CS.Audio.unlock();
      root.addEventListener('keydown', (e) => {
        unlock();
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const acts = KEYS[e.code];
        if (!acts) return;
        e.preventDefault();
        this.device = 'keyboard';
        this.keysDown.add(e.code);
        if (!e.repeat) acts.forEach((a) => this.pressed.add(a));
      });
      root.addEventListener('keyup', (e) => this.keysDown.delete(e.code));
      root.addEventListener('blur', () => { this.keysDown.clear(); this.touches.clear(); this.swipeDown = false; });

      canvas.addEventListener('mousedown', (e) => {
        unlock();
        if (performance.now() - this.lastTouch < 700) return;
        this.device = 'keyboard';
        this.taps.push({ x: e.clientX, y: e.clientY, mouse: true });
      });
      canvas.addEventListener('mousemove', (e) => {
        if (performance.now() - this.lastTouch < 700) return;
        this.hover = { x: e.clientX, y: e.clientY, moved: true };
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      const opt = { passive: false };
      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault(); unlock();
        this.device = 'touch'; this.lastTouch = performance.now();
        for (const t of e.changedTouches) this.touches.set(t.identifier, { x0: t.clientX, y0: t.clientY, used: false, t0: performance.now() });
      }, opt);
      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          const s = this.touches.get(t.identifier);
          if (!s || s.used) continue;
          const dx = t.clientX - s.x0, dy = t.clientY - s.y0;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) continue;
          s.used = true;
          const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
          this.pressed.add(dir);
          this.pressed.add('swipe');
          if (dir === 'down') { this.swipeDown = true; s.downHold = true; }
        }
      }, opt);
      const end = (e) => {
        e.preventDefault(); this.lastTouch = performance.now();
        for (const t of e.changedTouches) {
          const s = this.touches.get(t.identifier);
          if (s && !s.used) this.taps.push({ x: t.clientX, y: t.clientY, touch: true });
          if (s && s.downHold) this.swipeDown = false;
          this.touches.delete(t.identifier);
        }
      };
      canvas.addEventListener('touchend', end, opt);
      canvas.addEventListener('touchcancel', end, opt);
      root.addEventListener('gamepadconnected', () => { this.device = 'gamepad'; });
    },

    poll() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let gp = null;
      for (const p of pads || []) if (p && p.connected) { gp = p; break; }
      this.padDown = false;
      if (gp) {
        for (const i in PAD) {
          const b = gp.buttons[i], on = !!(b && b.pressed);
          if (on && !this.padPrev[i]) { PAD[i].forEach((a) => this.pressed.add(a)); this.device = 'gamepad'; root.CS.Audio.unlock(); }
          if (on && (i === '1' || i === '2' || i === '13')) this.padDown = true;
          this.padPrev[i] = on;
        }
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        let dir = null;
        if (Math.abs(ax) > 0.55 || Math.abs(ay) > 0.55) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
        if (dir && dir !== this.padDir) { this.pressed.add(dir); this.device = 'gamepad'; }
        if (dir === 'down') this.padDown = true;
        this.padDir = dir;
      }
      this.held.down = this.keysDown.has('ArrowDown') || this.keysDown.has('KeyS') || this.padDown || this.swipeDown;
    },

    has(a) { return this.pressed.has(a); },
    endTick() { this.pressed.clear(); this.taps.length = 0; if (this.hover) this.hover.moved = false; },
    flush() { this.pressed.clear(); this.taps.length = 0; },
  };

  root.CS = root.CS || {};
  root.CS.Input = I;
})(window);
