// Lot Jam input: keyboard, gamepad, mouse and touch folded into one stream of
// named actions (up/down/left/right/confirm/back/pause/undo/hint/restart).
// The device used last is kept on <body data-device> for the prompts.
(function () {
  const KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm',
    Escape: 'back', KeyP: 'pause',
    KeyU: 'undo', KeyZ: 'undo', Backspace: 'undo',
    KeyH: 'hint', KeyR: 'restart', KeyM: 'mute',
  };
  const REPEATABLE = new Set(['up', 'down', 'left', 'right', 'undo']);
  // Standard gamepad layout.
  const PAD = { 0: 'confirm', 1: 'back', 2: 'undo', 3: 'hint', 8: 'restart', 9: 'pause', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };

  // Glyphs shown next to actions, per device.
  const GLYPHS = {
    keyboard: { confirm: 'Space', back: 'Esc', pause: 'Esc', undo: 'U', hint: 'H', restart: 'R', nav: 'Arrows' },
    gamepad: { confirm: 'A', back: 'B', pause: 'Start', undo: 'X', hint: 'Y', restart: 'Select', nav: 'D-pad' },
    mouse: {}, touch: {},
  };

  const Input = {
    device: 'mouse',
    handler: null,
    pad: { prev: {}, dir: null, repeatT: 0 },

    init(handler) {
      this.handler = handler;
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        LJ.Audio.unlock();
        this.setDevice('keyboard');
        let a = KEYS[e.code];
        const arg = undefined;
        if (!a) return;
        e.preventDefault();
        if (e.repeat && !REPEATABLE.has(a)) return;
        this.handler(a, arg);
      });
      addEventListener('pointerdown', (e) => {
        LJ.Audio.unlock();
        this.setDevice(e.pointerType === 'touch' || e.pointerType === 'pen' ? 'touch' : 'mouse');
      }, true);
      addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse' && (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) && this.device !== 'mouse') this.setDevice('mouse');
      });
      addEventListener('gamepadconnected', () => this.setDevice('gamepad'));
      this.setDevice(matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');
    },

    setDevice(d) {
      if (d === this.device) return;
      this.device = d;
      document.body.dataset.device = d;
      const g = GLYPHS[d];
      document.querySelectorAll('[data-glyph]').forEach((el) => { el.textContent = g[el.dataset.glyph] || ''; });
      if (this.onDevice) this.onDevice(d);
    },
    glyph(action) { return GLYPHS[this.device][action] || ''; },
    refreshGlyphs() { const d = this.device; this.device = null; this.setDevice(d); },

    poll(dt) {
      const list = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(list || []).find((g) => g && g.connected);
      if (!gp) return;
      const p = this.pad;
      for (const [i, a] of Object.entries(PAD)) {
        const b = gp.buttons[i];
        const on = !!(b && b.pressed);
        if (on && !p.prev[i]) { LJ.Audio.unlock(); this.setDevice('gamepad'); this.handler(a); }
        p.prev[i] = on;
      }
      const ax = gp.axes[0] || 0;
      const ay = gp.axes[1] || 0;
      let dir = null;
      if (Math.max(Math.abs(ax), Math.abs(ay)) > 0.55) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
      if (dir && dir !== p.dir) { this.setDevice('gamepad'); this.handler(dir); p.repeatT = 0.4; }
      else if (dir) { p.repeatT -= dt; if (p.repeatT <= 0) { this.handler(dir); p.repeatT = 0.12; } }
      p.dir = dir;
    },
  };

  (window.LJ = window.LJ || {}).Input = Input;
})();
