// Beat Sprint input. Keyboard, mouse, touch and gamepad all become one queue
// of events. Each press is stamped with the audio clock *when it happened*
// (not when the frame got round to it), which is what the judge uses.
//
// Gamepad buttons and stick flicks are given key-like codes ('PadA',
// 'PadLeft', ...), so the game maps everything through one table per screen.
(function () {
  const BS = window.BS;
  const PAD = { 0: 'PadA', 1: 'PadB', 2: 'PadX', 3: 'PadY', 4: 'PadL', 5: 'PadR', 8: 'PadSelect', 9: 'PadStart', 12: 'PadUp', 13: 'PadDown', 14: 'PadLeft', 15: 'PadRight' };
  const SCROLL = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace']);

  const Input = {
    queue: [],
    device: 'keyboard',      // 'keyboard' | 'mouse' | 'touch' | 'gamepad': drives the on-screen prompts
    mouse: null,             // last mouse position in CSS px (hover focus)
    mouseMoved: false,
    held: new Set(),
    padPrev: {},
    padDir: null,
    padSeen: false,
    lastTouch: 0,

    init(canvas) {
      const A = BS.Audio;
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        A.unlock();
        if (SCROLL.has(e.code)) e.preventDefault();
        this.device = 'keyboard';
        if (e.repeat) return;
        this.held.add(e.code);
        this.queue.push({ type: 'key', code: e.code, t: A.eventTime(e) });
      });
      addEventListener('keyup', (e) => this.held.delete(e.code));
      addEventListener('blur', () => this.held.clear());

      canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        A.unlock();
        const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
        if (touch) { this.device = 'touch'; this.lastTouch = performance.now(); }
        else if (performance.now() - this.lastTouch > 800) this.device = 'mouse';
        const r = canvas.getBoundingClientRect();
        this.queue.push({ type: 'tap', x: e.clientX - r.left, y: e.clientY - r.top, touch, t: A.eventTime(e) });
      });
      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = canvas.getBoundingClientRect();
        this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
        this.mouseMoved = true;
        if (performance.now() - this.lastTouch > 800 && this.device !== 'keyboard') this.device = 'mouse';
      });
      canvas.addEventListener('pointerleave', () => { this.mouse = null; });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      addEventListener('gamepadconnected', () => { this.padSeen = true; });
    },

    // Read gamepads once per frame. Presses are stamped with the clock now.
    poll() {
      const list = navigator.getGamepads ? navigator.getGamepads() : [];
      let gp = null;
      for (const p of list || []) if (p && p.connected) { gp = p; break; }
      if (!gp) return;
      const t = BS.Audio.now();
      for (const i in PAD) {
        const b = gp.buttons[i];
        const on = !!(b && (b.pressed || b.value > 0.5));
        if (on && !this.padPrev[i]) { this.queue.push({ type: 'key', code: PAD[i], t }); this.device = 'gamepad'; BS.Audio.unlock(); }
        this.padPrev[i] = on;
      }
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      let dir = null;
      if (Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'PadRight' : 'PadLeft') : ay > 0 ? 'PadDown' : 'PadUp';
      if (dir && dir !== this.padDir) { this.queue.push({ type: 'key', code: dir, t }); this.device = 'gamepad'; }
      this.padDir = dir;
    },

    drain() {
      const q = this.queue;
      this.queue = [];
      return q;
    },
    clear() { this.queue.length = 0; },
  };

  // What each code means on menu screens and in play.
  Input.NAV = {
    ArrowUp: 'up', KeyW: 'up', PadUp: 'up',
    ArrowDown: 'down', KeyS: 'down', PadDown: 'down',
    ArrowLeft: 'left', KeyA: 'left', PadLeft: 'left', PadL: 'left',
    ArrowRight: 'right', KeyD: 'right', PadRight: 'right', PadR: 'right',
    Enter: 'ok', Space: 'ok', NumpadEnter: 'ok', PadA: 'ok',
    Escape: 'back', Backspace: 'back', PadB: 'back',
    KeyR: 'restart', PadY: 'restart', PadSelect: 'restart',
    KeyM: 'mute', KeyF: 'fullscreen',
  };
  // Lanes: 0 left, 1 middle, 2 right; 'cur' strikes the lane the ship is in.
  Input.LANE = {
    KeyA: 0, ArrowLeft: 0, KeyJ: 0, PadLeft: 0, PadX: 0, PadL: 0,
    KeyS: 1, ArrowDown: 1, ArrowUp: 1, KeyW: 1, KeyK: 1, PadDown: 1, PadUp: 1, PadA: 1, PadY: 1,
    KeyD: 2, ArrowRight: 2, KeyL: 2, PadRight: 2, PadB: 2, PadR: 2,
    Space: 'cur', Enter: 'cur',
  };
  Input.PAUSE = { Escape: 1, KeyP: 1, Backspace: 1, PadStart: 1 };

  // Glyphs for prompts, by device.
  Input.GLYPH = {
    lanes: { keyboard: ['A', 'S', 'D'], mouse: ['A', 'S', 'D'], gamepad: ['X', 'A', 'B'], touch: ['TAP', 'TAP', 'TAP'] },
    ok: { keyboard: 'ENTER', mouse: 'CLICK', gamepad: 'A', touch: 'TAP' },
    back: { keyboard: 'ESC', mouse: 'ESC', gamepad: 'B', touch: null },
    pause: { keyboard: 'ESC', mouse: 'ESC', gamepad: 'START', touch: null },
    restart: { keyboard: 'R', mouse: 'R', gamepad: 'Y', touch: null },
    nav: { keyboard: '↑↓', mouse: null, gamepad: 'D-PAD', touch: null },
    adjust: { keyboard: '←→', mouse: null, gamepad: '◀▶', touch: null },
  };
  Input.glyph = (name) => Input.GLYPH[name][Input.device];

  BS.Input = Input;
})();
