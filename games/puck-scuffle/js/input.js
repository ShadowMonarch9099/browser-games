// Puck Scuffle input. Two players can share everything at once:
//   keyboard: W A S D moves red, the arrow keys move blue
//   gamepads: pad 1 moves red, pad 2 moves blue
//   touch:    every finger drives the mallet on the half it landed on
//   mouse:    against the house the red mallet follows the mouse; with two
//             players, press and drag on a half
// Axes are in screen directions; game.js turns them into table directions.
(function () {
  const MENU = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', Backspace: 'back', KeyP: 'pause', KeyM: 'mute',
  };
  const P1 = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
  const P2 = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  const PAD = { 0: 'confirm', 1: 'back', 9: 'pause', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
  const I = {
    keys: new Set(), events: [], pointers: new Map(), mouse: null, padPrev: [{}, {}], padDir: [null, null], padAxis: [[0, 0], [0, 0]], device: 'mouse',
    init(canvas) {
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        PS.Audio.unlock();
        const a = MENU[e.code];
        if (!a && !P1[e.code] && !P2[e.code]) return;
        e.preventDefault(); this.setDevice('keyboard');
        this.keys.add(e.code);
        if (a && (!e.repeat || a === 'up' || a === 'down' || a === 'left' || a === 'right')) this.events.push(a);
      });
      addEventListener('keyup', (e) => this.keys.delete(e.code));
      addEventListener('blur', () => { this.keys.clear(); this.pointers.clear(); });
      canvas.addEventListener('pointerdown', (e) => {
        PS.Audio.unlock();
        this.setDevice(e.pointerType === 'mouse' ? 'mouse' : 'touch');
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, owner: null, mouse: e.pointerType === 'mouse' });
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
      });
      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse') this.mouse = { x: e.clientX, y: e.clientY };
        const p = this.pointers.get(e.pointerId); if (p) { p.x = e.clientX; p.y = e.clientY; }
      });
      canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.mouse = null; });
      const end = (e) => this.pointers.delete(e.pointerId);
      canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
      addEventListener('gamepadconnected', () => this.setDevice('gamepad'));
    },
    setDevice(d) { if (d !== this.device) { this.device = d; document.body.dataset.device = d; } },
    poll() {
      const pads = Array.from((navigator.getGamepads && navigator.getGamepads()) || []).filter((p) => p && p.connected);
      for (let n = 0; n < 2; n++) {
        const gp = pads[n]; this.padAxis[n] = [0, 0];
        if (!gp) continue;
        for (const [i, a] of Object.entries(PAD)) {
          const on = !!(gp.buttons[i] && gp.buttons[i].pressed);
          if (on && !this.padPrev[n][i]) { this.events.push(a); this.setDevice('gamepad'); PS.Audio.unlock(); }
          this.padPrev[n][i] = on;
        }
        const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
        let ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        if (Math.hypot(ax, ay) < 0.18) { ax = (b(15) ? 1 : 0) - (b(14) ? 1 : 0); ay = (b(13) ? 1 : 0) - (b(12) ? 1 : 0); }
        this.padAxis[n] = [ax, ay];
        let dir = null;
        if (Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
        if (dir && dir !== this.padDir[n] && n === 0) this.events.push(dir);
        this.padDir[n] = dir;
      }
    },
    keyAxis(map) {
      let x = 0, y = 0;
      for (const [k, v] of Object.entries(map)) if (this.keys.has(k)) { x += v[0]; y += v[1]; }
      return [x, y];
    },
    // Held movement for player p as a screen-direction axis. solo: one human
    // against the house, so every key set and pad 1 drive red.
    axis(p, solo) {
      const a = p === 0 ? this.keyAxis(P1) : this.keyAxis(P2);
      if (solo && p === 0) { const b = this.keyAxis(P2); a[0] += b[0]; a[1] += b[1]; }
      const g = this.padAxis[p];
      if (Math.hypot(g[0], g[1]) > 0.18) { a[0] += g[0]; a[1] += g[1]; }
      return a;
    },
    take() { const e = this.events; this.events = []; return e; },
  };
  PS.Input = I;
})();
