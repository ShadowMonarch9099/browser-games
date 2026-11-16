// Gate Stampede input. Keys, gamepads, mouse and touch become:
//   steer (held axis -1..1), drag (a pointer dragging the crowd), nudges
//   (quick lane hops), and one-shot actions for menus and pause.
(function () {
  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', Backspace: 'back', KeyP: 'pause', KeyR: 'restart', KeyM: 'mute',
  };
  const PAD = { 0: 'confirm', 1: 'back', 9: 'pause', 3: 'restart', 12: 'up', 13: 'down', 14: 'left', 15: 'right', 4: 'hopL', 5: 'hopR' };
  const I = {
    down: new Set(), events: [], drag: null, padPrev: {}, padDir: null, padAxis: 0, device: 'mouse',
    init(canvas, getCrowdX) {
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        GS.Audio.unlock();
        const a = KEYS[e.code]; if (!a) return;
        e.preventDefault(); this.setDevice('keyboard');
        this.down.add(a);
        if (!e.repeat || a === 'up' || a === 'down') this.events.push(a);
      });
      addEventListener('keyup', (e) => { const a = KEYS[e.code]; if (a) this.down.delete(a); });
      addEventListener('blur', () => { this.down.clear(); this.drag = null; });
      canvas.addEventListener('pointerdown', (e) => {
        GS.Audio.unlock();
        this.setDevice(e.pointerType === 'mouse' ? 'mouse' : 'touch');
        this.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, cx0: getCrowdX(), x: e.clientX, t0: performance.now() };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
      });
      canvas.addEventListener('pointermove', (e) => { if (this.drag && e.pointerId === this.drag.id) this.drag.x = e.clientX; });
      const end = (e) => {
        const d = this.drag; if (!d || e.pointerId !== d.id) return;
        const dx = e.clientX - d.x0, quick = performance.now() - d.t0 < 220;
        if (quick && Math.abs(dx) > 40) this.events.push(dx > 0 ? 'hopR' : 'hopL');
        this.drag = null;
      };
      canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
      addEventListener('gamepadconnected', () => this.setDevice('gamepad'));
    },
    setDevice(d) { if (d !== this.device) { this.device = d; document.body.dataset.device = d; } },
    poll() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(pads || []).find((p) => p && p.connected);
      this.padAxis = 0;
      if (!gp) return;
      for (const [i, a] of Object.entries(PAD)) {
        const on = !!(gp.buttons[i] && gp.buttons[i].pressed);
        if (on && !this.padPrev[i]) { this.events.push(a); this.setDevice('gamepad'); GS.Audio.unlock(); }
        this.padPrev[i] = on;
      }
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      this.padAxis = Math.abs(ax) > 0.2 ? ax : (gp.buttons[14] && gp.buttons[14].pressed ? -1 : gp.buttons[15] && gp.buttons[15].pressed ? 1 : 0);
      let dir = null;
      if (Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
      if (dir && dir !== this.padDir) { this.events.push(dir); this.setDevice('gamepad'); }
      this.padDir = dir;
    },
    steer() { return (this.down.has('right') ? 1 : 0) - (this.down.has('left') ? 1 : 0) || this.padAxis; },
    take() { const e = this.events; this.events = []; return e; },
  };
  GS.Input = I;
})();
