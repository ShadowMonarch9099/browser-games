// Sky Stack input: keyboard, mouse, touch and gamepad feed one event queue.
// Gamepad buttons arrive as key-like codes ('PadA', 'PadUp', ...).
(function () {
  const SS = window.SS;
  const PAD = { 0: 'PadA', 1: 'PadB', 2: 'PadX', 3: 'PadY', 9: 'PadStart', 12: 'PadUp', 13: 'PadDown', 14: 'PadLeft', 15: 'PadRight' };
  const SCROLL = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace']);

  const Input = {
    queue: [], device: 'keyboard', mouse: null, mouseMoved: false, padPrev: {}, padDir: null, lastTouch: 0,

    init(canvas) {
      const A = SS.Audio;
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        A.unlock();
        if (SCROLL.has(e.code)) e.preventDefault();
        this.device = 'keyboard';
        if (!e.repeat) this.queue.push({ type: 'key', code: e.code });
      });
      canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        A.unlock();
        const touch = e.pointerType !== 'mouse';
        if (touch) { this.device = 'touch'; this.lastTouch = performance.now(); }
        else if (performance.now() - this.lastTouch > 800) this.device = 'mouse';
        const r = canvas.getBoundingClientRect();
        this.queue.push({ type: 'tap', x: e.clientX - r.left, y: e.clientY - r.top, touch });
      });
      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const r = canvas.getBoundingClientRect();
        this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
        this.mouseMoved = true;
        if (performance.now() - this.lastTouch > 800 && this.device === 'gamepad') this.device = 'mouse';
      });
      canvas.addEventListener('pointerleave', () => { this.mouse = null; });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },

    poll() {
      const list = navigator.getGamepads ? navigator.getGamepads() : [];
      let gp = null;
      for (const p of list || []) if (p && p.connected) { gp = p; break; }
      if (!gp) return;
      for (const i in PAD) {
        const b = gp.buttons[i], on = !!(b && b.pressed);
        if (on && !this.padPrev[i]) { this.queue.push({ type: 'key', code: PAD[i] }); this.device = 'gamepad'; SS.Audio.unlock(); }
        this.padPrev[i] = on;
      }
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      let dir = null;
      if (Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'PadRight' : 'PadLeft') : ay > 0 ? 'PadDown' : 'PadUp';
      if (dir && dir !== this.padDir) { this.queue.push({ type: 'key', code: dir }); this.device = 'gamepad'; }
      this.padDir = dir;
    },
    drain() { const q = this.queue; this.queue = []; return q; },
  };

  Input.NAV = {
    ArrowUp: 'up', KeyW: 'up', PadUp: 'up', ArrowDown: 'down', KeyS: 'down', PadDown: 'down',
    ArrowLeft: 'left', KeyA: 'left', PadLeft: 'left', ArrowRight: 'right', KeyD: 'right', PadRight: 'right',
    Enter: 'ok', Space: 'ok', NumpadEnter: 'ok', PadA: 'ok',
    Escape: 'back', Backspace: 'back', PadB: 'back',
    KeyR: 'restart', PadY: 'restart', KeyM: 'mute',
  };
  Input.DROP = { Space: 1, Enter: 1, ArrowDown: 1, KeyS: 1, NumpadEnter: 1, PadA: 1, PadX: 1, PadDown: 1 };
  Input.PAUSE = { Escape: 1, KeyP: 1, Backspace: 1, PadStart: 1, PadB: 1 };
  Input.GLYPH = {
    drop: { keyboard: 'SPACE', mouse: 'CLICK', gamepad: 'A', touch: 'TAP' },
    ok: { keyboard: 'ENTER', mouse: null, gamepad: 'A', touch: null },
    back: { keyboard: 'ESC', mouse: 'ESC', gamepad: 'B', touch: null },
    nav: { keyboard: '↑ ↓', mouse: null, gamepad: 'D-PAD', touch: null },
    restart: { keyboard: 'R', mouse: 'R', gamepad: 'Y', touch: null },
    pause: { keyboard: 'ESC', mouse: 'ESC', gamepad: 'START', touch: null },
  };
  Input.glyph = (n) => Input.GLYPH[n][Input.device];
  SS.Input = Input;
})();
