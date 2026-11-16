// Knot Alone input. Each climber has a keyboard side, a gamepad and a touch
// pad in their corner of the screen:
//   red:  A D move, W jump / reel in, S let out, hold F or left Shift to anchor
//   teal: arrows, hold Enter, / or right Shift to anchor
//   pads: stick or d-pad, A jump, B or RB anchor (pad 1 red, pad 2 teal)
//   touch: the anchor button is a toggle, since holding two buttons is fiddly
// In solo play every one of these drives whichever climber is active.
(function () {
  const SIDES = [
    { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], anchor: ['KeyF', 'ShiftLeft'] },
    { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], anchor: ['Enter', 'NumpadEnter', 'Slash', 'ShiftRight'] },
  ];
  const MENU = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Enter: 'confirm', Space: 'confirm', NumpadEnter: 'confirm', Escape: 'back', KeyP: 'pause', Tab: 'swap', KeyQ: 'swap', KeyM: 'mute',
  };
  const PADEV = { 0: 'confirm', 1: 'back', 3: 'swap', 9: 'pause', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
  const I = {
    keys: new Set(), fresh: new Set(), events: [], pads: [null, null], padPrev: [{}, {}], padFresh: [false, false], padDir: null,
    touch: [new Set(), new Set()], touchFresh: [false, false], touchAnchor: [false, false], device: 'keyboard',
    init() {
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        KA.Audio.unlock();
        const known = MENU[e.code] || SIDES.some((s) => Object.values(s).some((l) => l.includes(e.code)));
        if (!known) return;
        e.preventDefault(); this.setDevice('keyboard');
        if (!e.repeat) this.fresh.add(e.code);
        this.keys.add(e.code);
        const a = MENU[e.code];
        if (a && (!e.repeat || ['up', 'down', 'left', 'right'].includes(a))) this.events.push(a);
      });
      addEventListener('keyup', (e) => this.keys.delete(e.code));
      addEventListener('blur', () => { this.keys.clear(); this.touch.forEach((t) => t.clear()); });
      for (const el of document.querySelectorAll('#touch [data-t]')) {
        const p = +el.closest('.pad').dataset.p, t = el.dataset.t;
        const down = (e) => {
          e.preventDefault(); KA.Audio.unlock(); this.setDevice('touch');
          el.classList.add('down');
          if (t === 'anchor') { this.touchAnchor[p] = !this.touchAnchor[p]; return; }
          if (t === 'swap') { this.events.push('swap'); return; }
          this.touch[p].add(t);
          if (t === 'up') this.touchFresh[p] = true;
          try { el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
        };
        const up = () => { el.classList.remove('down'); this.touch[p].delete(t); };
        el.addEventListener('pointerdown', down);
        el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
      }
      addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !e.target.closest('#touch')) this.setDevice('touch'); });
      addEventListener('gamepadconnected', () => this.setDevice('gamepad'));
    },
    setDevice(d) { if (d !== this.device) { this.device = d; document.body.dataset.device = d; } },
    poll() {
      const pads = Array.from((navigator.getGamepads && navigator.getGamepads()) || []).filter((p) => p && p.connected);
      for (let n = 0; n < 2; n++) {
        const gp = pads[n] || null; this.pads[n] = gp; this.padFresh[n] = false;
        if (!gp) continue;
        for (const i of [0, 1, 3, 5, 9, 12, 13, 14, 15]) {
          const on = !!(gp.buttons[i] && gp.buttons[i].pressed);
          if (on && !this.padPrev[n][i]) {
            this.setDevice('gamepad'); KA.Audio.unlock();
            if (i === 0 || i === 12) this.padFresh[n] = true;
            if (PADEV[i] && (n === 0 || i === 3 || i === 9)) this.events.push(PADEV[i]);
          }
          this.padPrev[n][i] = on;
        }
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        let dir = null;
        if (Math.abs(ax) > 0.6 || Math.abs(ay) > 0.6) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
        if (n === 0) { if (dir && dir !== this.padDir) this.events.push(dir); this.padDir = dir; }
      }
    },
    sideOf(p) {
      const S = SIDES[p], has = (l) => l.some((k) => this.keys.has(k)), fresh = (l) => l.some((k) => this.fresh.has(k));
      const gp = this.pads[p], b = (i) => !!(gp && gp.buttons[i] && gp.buttons[i].pressed);
      const ax = gp ? gp.axes[0] || 0 : 0, ay = gp ? gp.axes[1] || 0 : 0, T = this.touch[p];
      const x = (has(S.right) || b(15) || T.has('right') ? 1 : 0) - (has(S.left) || b(14) || T.has('left') ? 1 : 0) || (Math.abs(ax) > 0.25 ? ax : 0);
      return {
        x: Math.max(-1, Math.min(1, x)),
        jump: fresh(S.up) || this.padFresh[p] || this.touchFresh[p],
        up: has(S.up) || b(0) || b(12) || ay < -0.6 || T.has('up'),
        down: has(S.down) || b(13) || ay > 0.6 || T.has('down'),
        anchor: has(S.anchor) || b(1) || b(5) || this.touchAnchor[p],
      };
    },
    // the controls for climber p; solo merges every device onto the active climber
    control(p, solo) {
      if (!solo) return this.sideOf(p);
      const a = this.sideOf(0), b = this.sideOf(1);
      return { x: Math.max(-1, Math.min(1, a.x + b.x)), jump: a.jump || b.jump || this.fresh.has('Space'), up: a.up || b.up, down: a.down || b.down, anchor: a.anchor || b.anchor };
    },
    anchorFlags() { return this.touchAnchor; },
    clearAnchors() { this.touchAnchor = [false, false]; document.querySelectorAll('#touch .anc').forEach((el) => el.classList.remove('on')); },
    endFrame() { this.fresh.clear(); this.touchFresh = [false, false]; this.padFresh = [false, false]; },
    take() { const e = this.events; this.events = []; return e; },
  };
  KA.Input = I;
})();
