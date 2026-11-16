// Bonk Brawl input: four keyboard clusters, four gamepads and one touch
// pad, each a separate "device" a player can claim. Menus listen to all of
// them at once through a small event queue.
(function () {
  const ACTIONS = ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y'];
  // Clusters sit far apart so several people fit on one keyboard.
  const KEYBOARDS = [
    { id: 'kb1', label: 'W A S D', keys: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'KeyF', b: 'KeyG' }, caps: { up: 'W', down: 'S', left: 'A', right: 'D', a: 'F', b: 'G' } },
    { id: 'kb2', label: 'Arrow keys', keys: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'Enter', b: 'ShiftRight' }, caps: { up: '↑', down: '↓', left: '←', right: '→', a: 'Enter', b: 'R-Shift' } },
    { id: 'kb3', label: 'I J K L', keys: { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', a: 'KeyO', b: 'KeyP' }, caps: { up: 'I', down: 'K', left: 'J', right: 'L', a: 'O', b: 'P' } },
    { id: 'kb4', label: 'Number pad', keys: { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', a: 'Numpad0', b: 'NumpadAdd' }, caps: { up: '8', down: '5', left: '4', right: '6', a: '0', b: '+' } },
  ];
  const PAD_CAPS = { up: '▲', down: '▼', left: '◀', right: '▶', a: 'A', b: 'B' };
  const NAV = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyI: [0, -1], KeyK: [0, 1], KeyJ: [-1, 0], KeyL: [1, 0], Numpad8: [0, -1], Numpad5: [0, 1], Numpad2: [0, 1], Numpad4: [-1, 0], Numpad6: [1, 0] };
  const OK = new Set(['Enter', 'NumpadEnter', 'Space', 'KeyF', 'KeyO', 'Numpad0']);
  const BACK = new Set(['Escape', 'Backspace']);
  const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Backspace', 'Tab']);

  const down = new Set(), latched = new Set();
  const devices = [];
  const byId = {};
  let events = [];

  function makeDevice(id, kind, label, caps) {
    const d = { id, kind, label, caps, x: 0, y: 0, held: {}, pressed: {}, prev: {}, connected: kind !== 'pad' };
    for (const a of ACTIONS) { d.held[a] = false; d.pressed[a] = false; d.prev[a] = false; }
    devices.push(d); byId[id] = d;
    return d;
  }
  for (const k of KEYBOARDS) makeDevice(k.id, 'kb', k.label, k.caps).keys = k.keys;
  for (let i = 0; i < 4; i++) makeDevice('pad' + i, 'pad', 'Gamepad ' + (i + 1), PAD_CAPS).index = i;
  const touchDev = makeDevice('touch', 'touch', 'Touch screen', { up: '', down: '', left: '', right: '', a: 'BONK', b: 'BIG' });
  const touch = { x: 0, y: 0, a: false, b: false, aLatch: false, bLatch: false };

  const pads = () => { try { return navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { return []; } };
  const btn = (p, i) => !!(p.buttons[i] && p.buttons[i].pressed);

  const Input = {
    devices, byId, KEYBOARDS, last: 'keyboard', onDevice: null, mouse: null,

    // Pointer clicks and hover, in CSS pixels of the canvas.
    bindPointer(canvas) {
      const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      canvas.addEventListener('pointerdown', (e) => {
        const p = pos(e);
        this.mouse = p;
        events.push({ type: 'click', x: p.x, y: p.y, touch: e.pointerType === 'touch' });
      });
      canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') this.mouse = pos(e); });
      canvas.addEventListener('pointerleave', () => { this.mouse = null; });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },

    init() {
      addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (BLOCK.has(e.code) || NAV[e.code] || OK.has(e.code)) e.preventDefault();
        this.setLast('keyboard');
        if (NAV[e.code]) events.push({ type: 'nav', dx: NAV[e.code][0], dy: NAV[e.code][1], code: e.code });
        if (e.repeat) return;
        down.add(e.code); latched.add(e.code);
        if (OK.has(e.code)) events.push({ type: 'ok', code: e.code });
        if (BACK.has(e.code)) events.push({ type: 'back', code: e.code });
        events.push({ type: 'key', code: e.code });
      });
      addEventListener('keyup', (e) => down.delete(e.code));
      addEventListener('blur', () => { down.clear(); touch.x = touch.y = 0; touch.a = touch.b = false; });
      addEventListener('pointerdown', (e) => this.setLast(e.pointerType === 'touch' ? 'touch' : 'mouse'), true);
      addEventListener('gamepadconnected', () => events.push({ type: 'pads' }));
      addEventListener('gamepaddisconnected', () => events.push({ type: 'pads' }));
    },
    setLast(kind) {
      if (kind === this.last) return;
      this.last = kind;
      if (this.onDevice) this.onDevice(kind);
    },

    // Once per simulation step: refresh every device's held / pressed state.
    poll() {
      const gp = pads();
      for (const d of devices) {
        let x = 0, y = 0;
        const cur = d.held, prev = d.prev;
        for (const a of ACTIONS) prev[a] = cur[a];
        if (d.kind === 'kb') {
          for (const a of ACTIONS) cur[a] = down.has(d.keys[a]) || latched.has(d.keys[a]);
        } else if (d.kind === 'pad') {
          const p = gp[d.index];
          d.connected = !!p;
          if (p) {
            let ax = p.axes[0] || 0, ay = p.axes[1] || 0;
            if (Math.hypot(ax, ay) < 0.28) { ax = 0; ay = 0; }
            cur.left = btn(p, 14) || ax < -0.5; cur.right = btn(p, 15) || ax > 0.5;
            cur.up = btn(p, 12) || ay < -0.5; cur.down = btn(p, 13) || ay > 0.5;
            cur.a = btn(p, 0) || btn(p, 7); cur.b = btn(p, 1); cur.x = btn(p, 2) || btn(p, 6); cur.y = btn(p, 3);
            if (ax || ay) { x = ax; y = ay; }
          } else for (const a of ACTIONS) cur[a] = false;
        } else {
          x = touch.x; y = touch.y;
          cur.left = x < -0.4; cur.right = x > 0.4; cur.up = y < -0.4; cur.down = y > 0.4;
          cur.a = touch.a || touch.aLatch; cur.b = touch.b || touch.bLatch;
        }
        d.x = x || (cur.right ? 1 : 0) - (cur.left ? 1 : 0);
        d.y = y || (cur.down ? 1 : 0) - (cur.up ? 1 : 0);
        for (const a of ACTIONS) d.pressed[a] = cur[a] && !prev[a];
      }
      latched.clear(); touch.aLatch = touch.bLatch = false;
    },
    // Buttons already held when play starts don't count as fresh presses.
    flush() { this.poll(); this.poll(); },

    // Once per frame: turn gamepad buttons into menu events (with key repeat).
    padMenu: [{}, {}, {}, {}],
    frame(dt) {
      const gp = pads();
      for (let i = 0; i < 4; i++) {
        const p = gp[i], st = this.padMenu[i];
        if (!p) { this.padMenu[i] = {}; continue; }
        const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
        const now = {
          left: btn(p, 14) || ax < -0.6, right: btn(p, 15) || ax > 0.6, up: btn(p, 12) || ay < -0.6, down: btn(p, 13) || ay > 0.6,
          ok: btn(p, 0), back: btn(p, 1), x: btn(p, 2), y: btn(p, 3), lb: btn(p, 4), rb: btn(p, 5), start: btn(p, 9), sel: btn(p, 8),
        };
        const dir = now.left ? 'left' : now.right ? 'right' : now.up ? 'up' : now.down ? 'down' : '';
        if (dir !== st.dir) { st.dir = dir; st.rep = 0.38; if (dir) this.pushNav(dir, i); }
        else if (dir) { st.rep -= dt; if (st.rep <= 0) { st.rep = 0.13; this.pushNav(dir, i); } }
        for (const k of ['ok', 'back', 'x', 'y', 'lb', 'rb', 'start', 'sel']) {
          if (now[k] && !st[k]) {
            this.setLast('gamepad');
            if (k === 'ok') events.push({ type: 'ok', pad: i });
            else if (k === 'back') events.push({ type: 'back', pad: i });
            else if (k === 'start') events.push({ type: 'pause', pad: i });
            else events.push({ type: 'key', code: 'Pad' + k.toUpperCase(), pad: i });
          }
          st[k] = now[k];
        }
      }
    },
    pushNav(dir, pad) {
      this.setLast('gamepad');
      events.push({ type: 'nav', dx: dir === 'left' ? -1 : dir === 'right' ? 1 : 0, dy: dir === 'up' ? -1 : dir === 'down' ? 1 : 0, pad });
    },
    take() { const e = events; events = []; return e; },

    // On-screen stick and fire button for phones (one touch player).
    touch,
    buildTouch(root) {
      const stick = root.querySelector('[data-stick]'), nub = stick.querySelector('i');
      let id = null, ox = 0, oy = 0;
      const move = (e) => {
        const r = stick.getBoundingClientRect(), lim = r.width * 0.36;
        let dx = e.clientX - ox, dy = e.clientY - oy;
        const d = Math.hypot(dx, dy);
        if (d > lim) { dx *= lim / d; dy *= lim / d; }
        touch.x = Math.abs(dx / lim) < 0.2 ? 0 : dx / lim; touch.y = Math.abs(dy / lim) < 0.2 ? 0 : dy / lim;
        nub.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      };
      const end = (e) => { if (e.pointerId !== id) return; id = null; touch.x = touch.y = 0; nub.style.transform = ''; };
      stick.addEventListener('pointerdown', (e) => {
        e.preventDefault(); id = e.pointerId;
        const r = stick.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; move(e);
      });
      addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
      addEventListener('pointerup', end); addEventListener('pointercancel', end);
      for (const b of root.querySelectorAll('[data-tbtn]')) {
        const k = b.dataset.tbtn;
        const on = (e) => { e.preventDefault(); touch[k] = true; touch[k + 'Latch'] = true; b.classList.add('held'); };
        const off = () => { touch[k] = false; b.classList.remove('held'); };
        b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
        b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
      }
    },
    hasTouch: () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches,
  };
  void touchDev;
  BB.Input = Input;
})();
