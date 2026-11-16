// Input: keyboard, mouse, touch and gamepad folded into one set of latched
// presses. Menus read nav(); the cave reads clicks and number keys. Pointer
// positions come back in the game's logical coordinates.
(function () {
  const PP = window.PP;
  const NAV = {
    up: ['ArrowUp', 'KeyW', 'Pad12'], down: ['ArrowDown', 'KeyS', 'Pad13'], left: ['ArrowLeft', 'KeyA', 'Pad14'], right: ['ArrowRight', 'KeyD', 'Pad15'],
    confirm: ['Enter', 'Space', 'Pad0'], back: ['Escape', 'Backspace', 'Pad1'], prev: ['KeyQ', 'Pad4', 'PageUp'], next: ['KeyE', 'Pad5', 'PageDown'],
    pause: ['Escape', 'KeyP', 'Pad9'], restart: ['KeyR', 'Pad3'], hint: ['KeyH', 'Pad2'],
  };
  const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace']);
  const I = {
    down: new Set(), pressed: new Set(), clicks: [], mouse: null, mouseMoved: false, device: 'mouse', canvas: null, lastTouch: 0,
    pad: { prev: {}, navDir: null },
    init(canvas) {
      this.canvas = canvas;
      addEventListener('keydown', (e) => {
        PP.Audio.unlock();
        this.device = 'keyboard';
        if (PREVENT.has(e.code)) e.preventDefault();
        if (!e.repeat) this.pressed.add(e.code);
        this.down.add(e.code);
      });
      addEventListener('keyup', (e) => this.down.delete(e.code));
      addEventListener('blur', () => { this.down.clear(); });
      canvas.addEventListener('pointerdown', (e) => {
        PP.Audio.unlock();
        this.device = e.pointerType === 'touch' ? 'touch' : 'mouse';
        const p = this.toGame(e.clientX, e.clientY);
        this.clicks.push(p);
        if (e.pointerType !== 'touch') this.mouse = p;
      });
      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        this.mouse = this.toGame(e.clientX, e.clientY);
        this.mouseMoved = true;
        if (this.device === 'keyboard' || this.device === 'gamepad') this.device = 'mouse';
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      addEventListener('gamepadconnected', () => { this.device = 'gamepad'; });
    },
    toGame(cx, cy) {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((cx - r.left) * PP.W) / r.width, y: ((cy - r.top) * PP.H) / r.height };
    },
    poll() {
      const list = navigator.getGamepads ? Array.from(navigator.getGamepads() || []) : [];
      const gp = list.find((g) => g && g.connected);
      if (!gp) return;
      gp.buttons.forEach((b, i) => {
        const on = !!(b && b.pressed);
        if (on && !this.pad.prev[i]) { this.pressed.add('Pad' + i); this.device = 'gamepad'; }
        this.pad.prev[i] = on;
      });
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      let dir = null;
      if (Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'Pad15' : 'Pad14') : ay > 0 ? 'Pad13' : 'Pad12';
      if (dir && dir !== this.pad.navDir) { this.pressed.add(dir); this.device = 'gamepad'; }
      this.pad.navDir = dir;
    },
    endTick() { this.pressed.clear(); this.clicks.length = 0; this.mouseMoved = false; },
    nav(n) { return NAV[n].some((c) => this.pressed.has(c)); },
    key(c) { return this.pressed.has(c); },
    digit() {
      for (let d = 1; d <= 9; d++) if (this.pressed.has('Digit' + d) || this.pressed.has('Numpad' + d)) return d;
      return 0;
    },
  };
  PP.Input = I;
})();
