// Arcade kit: one input API for keyboard, gamepads and touch.
//
//   const input = Arcade.input.create();
//   // once per update step:
//   input.poll();
//   if (input.solo.pressed('a')) jump();          // single-player: any device
//   if (input.device('kb2').held('left')) ...      // one specific device
//
// Actions: up, down, left, right, a (main button), b (second button), start.
// held(action)    true while the button is down
// pressed(action) true only on the step it went down
window.Arcade = window.Arcade || {};

(function () {
  const ACTIONS = ['up', 'down', 'left', 'right', 'a', 'b', 'start'];

  // Keyboard clusters, far apart so several people fit on one keyboard.
  // Few keys each: cheap keyboards drop keys when many are held at once.
  const KEYBOARDS = {
    kb1: { label: 'WASD + F G', up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', a: 'KeyF', b: 'KeyG' },
    kb2: { label: 'Arrows + Enter Shift', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'Enter', b: 'ShiftRight' },
    kb3: { label: 'IJKL + O P', up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', a: 'KeyO', b: 'KeyP' },
    kb4: { label: 'Numpad 8456 + 0 +', up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', a: 'Numpad0', b: 'NumpadAdd' },
  };
  // Single-player: every sensible key works.
  const SOLO_KEYS = {
    up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
    a: ['Space', 'Enter', 'KeyZ', 'KeyF'], b: ['KeyX', 'ShiftLeft', 'ShiftRight', 'KeyG'], start: ['Escape', 'KeyP'],
  };
  // Keys the browser would otherwise use to scroll the page.
  const BLOCKED = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
  // Standard gamepad layout: d-pad 12-15, A = 0, B = 1 (X = 2 also counts as b), Start = 9.
  const PAD = { up: [12], down: [13], left: [14], right: [15], a: [0], b: [1, 2], start: [9] };

  function makeDevice(id, label, read) {
    let cur = {}, prev = {};
    return {
      id, label,
      _poll() { prev = cur; cur = {}; for (const a of ACTIONS) cur[a] = !!read(a); },
      held: (a) => !!cur[a],
      pressed: (a) => !!cur[a] && !prev[a],
      // -1, 0 or 1 on each axis
      get x() { return (cur.right ? 1 : 0) - (cur.left ? 1 : 0); },
      get y() { return (cur.down ? 1 : 0) - (cur.up ? 1 : 0); },
    };
  }

  Arcade.input = {
    ACTIONS,
    KEYBOARDS,

    // target: element that receives taps (usually the game canvas).
    // tapIsA: a tap or click anywhere on target counts as the "a" button.
    create({ target = null, tapIsA = true } = {}) {
      const down = new Set();     // keys held right now
      const latched = new Set();  // keys pressed since the last poll (catches very quick taps)
      const touch = { a: false, latchedA: false, virtual: new Set() };

      addEventListener('keydown', (e) => {
        // Keys aimed at a menu button or text box belong to the page, not the game.
        if (e.target.closest && e.target.closest('button, a, input, select, textarea')) return;
        if (BLOCKED.has(e.code)) e.preventDefault();
        if (e.repeat) return;
        down.add(e.code); latched.add(e.code);
      });
      addEventListener('keyup', (e) => down.delete(e.code));
      addEventListener('blur', () => { down.clear(); touch.a = false; touch.virtual.clear(); });

      if (target && tapIsA) {
        target.addEventListener('pointerdown', (e) => { e.preventDefault(); touch.a = true; touch.latchedA = true; });
        addEventListener('pointerup', () => { touch.a = false; });
        addEventListener('pointercancel', () => { touch.a = false; });
        target.style.touchAction = 'none';
      }

      const key = (code) => down.has(code) || latched.has(code);
      const pads = () => (navigator.getGamepads ? [...navigator.getGamepads()] : []);
      function padRead(index, action) {
        const p = pads()[index];
        if (!p) return false;
        if (PAD[action].some((b) => p.buttons[b] && p.buttons[b].pressed)) return true;
        const [ax = 0, ay = 0] = p.axes;
        return (action === 'left' && ax < -0.5) || (action === 'right' && ax > 0.5) ||
               (action === 'up' && ay < -0.5) || (action === 'down' && ay > 0.5);
      }

      const devices = {};
      for (const [id, map] of Object.entries(KEYBOARDS)) {
        devices[id] = makeDevice(id, map.label, (a) => map[a] && key(map[a]));
      }
      for (let i = 0; i < 4; i++) devices['pad' + i] = makeDevice('pad' + i, 'Gamepad ' + (i + 1), (a) => padRead(i, a));
      devices.touch = makeDevice('touch', 'Touch', (a) => touch.virtual.has(a) || (a === 'a' && (touch.a || touch.latchedA)));

      const solo = makeDevice('solo', 'Any', (a) =>
        SOLO_KEYS[a].some(key) || devices.touch.held(a) || [0, 1, 2, 3].some((i) => padRead(i, a)));

      return {
        solo,
        device: (id) => devices[id],
        // Devices a player could join with, in a stable order.
        joinable: () => ['kb1', 'kb2', 'kb3', 'kb4', 'pad0', 'pad1', 'pad2', 'pad3'].map((id) => devices[id]),
        // Call once at the start of every update step.
        poll() {
          for (const d of Object.values(devices)) d._poll();
          solo._poll();
          latched.clear();
          touch.latchedA = false;
        },
        // Call when play starts or resumes: buttons already held down won't
        // count as "pressed" until they are let go and pressed again.
        flush() { this.poll(); this.poll(); },
        // On-screen buttons for phones. buttons: e.g. ['left', 'right', 'a'].
        // Only shown on touch screens. Returns the element.
        touchPad(buttons, parent = document.body) {
          const LABEL = { up: '▲', down: '▼', left: '◀', right: '▶', a: 'A', b: 'B' };
          const el = document.createElement('div');
          el.className = 'arc-touchpad';
          const side = (names, cls) => {
            const g = document.createElement('div');
            g.className = cls;
            for (const n of names) {
              const b = document.createElement('button');
              b.type = 'button'; b.textContent = LABEL[n] || n; b.dataset.action = n;
              b.setAttribute('aria-label', n);
              const on = (e) => { e.preventDefault(); touch.virtual.add(n); };
              const off = () => touch.virtual.delete(n);
              b.addEventListener('pointerdown', on);
              b.addEventListener('pointerup', off);
              b.addEventListener('pointerleave', off);
              b.addEventListener('pointercancel', off);
              g.appendChild(b);
            }
            el.appendChild(g);
          };
          side(buttons.filter((b) => ['left', 'right', 'up', 'down'].includes(b)), 'arc-touchpad-move');
          side(buttons.filter((b) => ['a', 'b'].includes(b)), 'arc-touchpad-act');
          parent.appendChild(el);
          return el;
        },
      };
    },
  };
})();
