// The six circuits' worlds: palettes, parallax backdrops and roadside props.
// Everything is painted once into offscreen canvases (backdrops tile
// sideways so they can scroll with the road's heading), then the road view
// only scales and blits them.
(function () {
  const KR = window.KR;
  const PX = 22; // prop canvases: pixels per world unit
  const TILE = 2048; // backdrop tile width

  const THEMES = {
    yard: {
      label: 'Sunny scrapyard', sky: ['#4aa8f0', '#bfe6ff'], fog: '#cfe9f7', sun: { x: 0.7, y: 0.35, r: 40, c: '#fff6cf' },
      far: '#93b9a6', far2: '#7ea592', near: '#5b6170',
      grass: ['#7fae4c', '#73a243'], rumble: ['#f2ead8', '#d7263d'], road: ['#6c6e75', '#66686f'], lane: '#f2ead8', verge: 'grass',
      props: [['tyres', 3], ['drum', 3], ['scrap', 3], ['fence', 2], ['board', 2], ['flag', 1], ['bush', 3]],
      clouds: true,
    },
    dusk: {
      label: 'Crusher yard at sunset', sky: ['#2a1745', '#ff9a4a'], fog: '#f09060', sun: { x: 0.35, y: 0.7, r: 70, c: '#ffd27a' },
      far: '#5a2c4c', far2: '#47223e', near: '#2a1830',
      grass: ['#8c6b3e', '#806135'], rumble: ['#ffc21a', '#1d1a1e'], road: ['#4f4a54', '#4a454f'], lane: '#ffc21a', verge: 'dirt',
      props: [['crusher', 1], ['scrap', 4], ['flood', 2], ['drum', 3], ['tyres', 2], ['board', 1]],
    },
    docks: {
      label: 'Harbour docks', sky: ['#6f909c', '#d3e0dc'], fog: '#c3d1cf', sun: null,
      far: '#7d929a', far2: '#66808a', near: '#3f5560',
      grass: ['#9d9d94', '#93938a'], rumble: ['#f2ead8', '#2a6fdb'], road: ['#585a60', '#53555b'], lane: '#ffc21a', verge: 'concrete',
      props: [['container', 4], ['bollard', 3], ['lamp', 2], ['crate', 3], ['craneleg', 1]],
      clouds: true, sea: true,
    },
    gorge: {
      label: 'Red rock gorge', sky: ['#2f86d4', '#f4dcae'], fog: '#efd3a2', sun: { x: 0.2, y: 0.25, r: 34, c: '#fffbe8' },
      far: '#c8774a', far2: '#b3623a', near: '#8a3f22',
      grass: ['#e2b670', '#d8aa63'], rumble: ['#f2ead8', '#c4311f'], road: ['#7b6758', '#756152'], lane: '#f2ead8', verge: 'sand',
      props: [['rock', 4], ['gear', 2], ['cactus', 3], ['boulder', 3], ['board', 1]],
    },
    night: {
      label: 'Neon city at night', sky: ['#05071a', '#2c1a52'], fog: '#1d1538', sun: { x: 0.8, y: 0.25, r: 22, c: '#f4f1ff', moon: true },
      far: '#141032', far2: '#1b1640', near: '#221a46',
      grass: ['#20293a', '#1c2433'], rumble: ['#ff2e88', '#1de9b6'], road: ['#2d2f3c', '#292b37'], lane: '#ffe66d', verge: 'tarmac',
      props: [['lamp', 4], ['neon', 3], ['tower', 3], ['tyres', 2]],
      stars: true, windows: true,
    },
    peak: {
      label: 'Snowy pass', sky: ['#6aa8e6', '#f0f7ff'], fog: '#f1f6fb', sun: { x: 0.6, y: 0.3, r: 30, c: '#ffffff' },
      far: '#c9d9ea', far2: '#9fb7cf', near: '#2f5a48',
      grass: ['#eef3f8', '#e3eaf1'], rumble: ['#d7263d', '#f2ead8'], road: ['#5f6670', '#5a616b'], lane: '#f2ead8', verge: 'snow',
      props: [['pine', 6], ['snowrock', 2], ['piston', 1], ['flag', 1], ['hut', 1]],
      snowcaps: true,
    },
  };

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }
  function rng(seed) { return KR.util.rng(seed); }
  const M = () => KR.Model;

  // ---------- backdrops ----------
  function ridge(g, rnd, base, amp, rough, color, w, h, opts = {}) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, h);
    const pts = [];
    const n = 64;
    const seeds = [];
    for (let k = 0; k < 6; k++) seeds.push([rnd() * 6.28, 1 + Math.floor(rnd() * (3 + k * 3)), rnd()]);
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * w;
      let y = 0;
      seeds.forEach(([ph, f, a], k) => { y += Math.sin((x / w) * Math.PI * 2 * f + ph) * a / (1 + k * rough); });
      y = base - y * amp;
      pts.push([x, y]);
      g.lineTo(x, y);
    }
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    if (opts.caps) {
      g.fillStyle = 'rgba(255,255,255,0.92)';
      for (let i = 1; i < pts.length - 1; i++) {
        const [x, y] = pts[i];
        if (y < base - amp * 0.35 && pts[i - 1][1] > y && pts[i + 1][1] > y) {
          g.beginPath(); g.moveTo(x - 40, y + 26); g.lineTo(x, y); g.lineTo(x + 40, y + 26); g.lineTo(x + 18, y + 20); g.lineTo(x, y + 30); g.lineTo(x - 16, y + 18); g.closePath(); g.fill();
        }
      }
    }
    return pts;
  }

  function backdrop(themeName) {
    const T = THEMES[themeName];
    const rnd = rng(KR.util.hash(themeName));
    // sky (not tiled): fills the top of the view
    const sky = canvas(16, 256), sg = sky.getContext('2d');
    const grd = sg.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, T.sky[0]); grd.addColorStop(1, T.sky[1]);
    sg.fillStyle = grd; sg.fillRect(0, 0, 16, 256);

    // far layer: sun / moon, clouds, stars, far ridge
    const far = canvas(TILE, 260), fg = far.getContext('2d');
    if (T.stars) for (let i = 0; i < 260; i++) { fg.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`; fg.fillRect(rnd() * TILE, rnd() * 170, rnd() < 0.1 ? 2 : 1, rnd() < 0.1 ? 2 : 1); }
    if (T.sun) {
      const sx = T.sun.x * TILE, sy = T.sun.y * 260, r = T.sun.r;
      const hg = fg.createRadialGradient(sx, sy, r * 0.5, sx, sy, r * 3.2);
      hg.addColorStop(0, T.sun.c); hg.addColorStop(0.3, 'rgba(255,255,255,0.18)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
      fg.fillStyle = hg; fg.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8);
      fg.fillStyle = T.sun.c; fg.beginPath(); fg.arc(sx, sy, r, 0, 6.283); fg.fill();
      if (T.sun.moon) { fg.fillStyle = 'rgba(180,170,220,0.5)'; [[-6, -4, 5], [7, 6, 4], [2, -10, 3]].forEach(([dx, dy, rr]) => { fg.beginPath(); fg.arc(sx + dx, sy + dy, rr, 0, 6.283); fg.fill(); }); }
      if (themeName === 'dusk') { fg.fillStyle = T.sky[0]; for (let k = 0; k < 4; k++) fg.fillRect(sx - r, sy + r * (0.2 + k * 0.2), r * 2, 3 + k); }
    }
    if (T.clouds) {
      for (let i = 0; i < 14; i++) {
        const cx = rnd() * TILE, cy = 30 + rnd() * 90, s = 0.6 + rnd();
        for (const dx of [0, TILE, -TILE]) {
          fg.fillStyle = 'rgba(255,255,255,0.75)';
          for (let k = 0; k < 5; k++) { fg.beginPath(); fg.ellipse(cx + dx + (k - 2) * 26 * s, cy - Math.sin((k / 4) * 3.14) * 12 * s, 30 * s, 16 * s, 0, 0, 6.283); fg.fill(); }
          fg.fillStyle = 'rgba(160,190,210,0.25)'; fg.fillRect(cx + dx - 60 * s, cy + 6 * s, 120 * s, 4);
        }
      }
    }
    ridge(fg, rnd, 215, 70, 0.6, T.far, TILE, 260, { caps: T.snowcaps });
    if (themeName === 'docks') {
      // gantry cranes on the far quay
      for (let i = 0; i < 5; i++) {
        const x = 200 + i * 400 + rnd() * 120;
        fg.fillStyle = '#5a707a';
        fg.fillRect(x, 120, 8, 110); fg.fillRect(x + 70, 120, 8, 110); fg.fillRect(x - 40, 112, 190, 10); fg.fillRect(x + 120, 70, 6, 50);
        fg.beginPath(); fg.moveTo(x + 123, 70); fg.lineTo(x + 40, 112); fg.lineTo(x + 123, 112); fg.closePath(); fg.globalAlpha = 0.5; fg.fill(); fg.globalAlpha = 1;
      }
    }
    if (themeName === 'dusk') {
      for (let i = 0; i < 6; i++) {
        const x = rnd() * TILE; fg.fillStyle = '#3a1d38';
        fg.fillRect(x, 90, 6, 140); fg.fillRect(x - 90, 90, 160, 7); fg.fillRect(x - 90, 97, 3, 40); fg.fillRect(x - 100, 137, 22, 14);
      }
    }
    ridge(fg, rnd, 240, 40, 1, T.far2, TILE, 260);

    // near layer: the theme's skyline closest to the track
    const near = canvas(TILE, 200), ng = near.getContext('2d');
    if (themeName === 'night' || themeName === 'docks') {
      let x = 0;
      while (x < TILE) {
        const bw = 50 + rnd() * 110, bh = themeName === 'night' ? 60 + rnd() * 140 : 30 + rnd() * 50;
        ng.fillStyle = themeName === 'night' ? (rnd() < 0.5 ? T.near : '#1a143a') : ['#b8432f', '#2d6c8f', '#d19a2a', '#4f7a3a', '#7d3c8a'][Math.floor(rnd() * 5)];
        if (themeName === 'docks') {
          // container stacks on the quay
          const rows = 1 + Math.floor(rnd() * 3);
          for (let r = 0; r < rows; r++) {
            ng.fillStyle = ['#b8432f', '#2d6c8f', '#d19a2a', '#4f7a3a', '#7d3c8a', '#9aa3a8'][Math.floor(rnd() * 6)];
            ng.fillRect(x, 200 - 34 * (r + 1), bw, 32);
            ng.fillStyle = 'rgba(0,0,0,0.18)'; for (let k = 6; k < bw; k += 9) ng.fillRect(x + k, 200 - 34 * (r + 1) + 3, 2, 26);
          }
        } else {
          ng.fillRect(x, 200 - bh, bw, bh);
          if (T.windows) for (let wy = 200 - bh + 8; wy < 196; wy += 12) for (let wx = x + 6; wx < x + bw - 8; wx += 10) if (rnd() < 0.45) { ng.fillStyle = rnd() < 0.8 ? 'rgba(255,214,120,0.85)' : 'rgba(120,220,255,0.8)'; ng.fillRect(wx, wy, 5, 6); }
          if (rnd() < 0.3) { ng.fillStyle = ['#ff2e88', '#1de9b6', '#ffe66d'][Math.floor(rnd() * 3)]; ng.fillRect(x + 8, 200 - bh - 12, Math.min(60, bw - 16), 6); }
        }
        x += bw + (themeName === 'docks' ? 6 + rnd() * 40 : 2);
      }
      if (T.sea) { ng.fillStyle = 'rgba(70,110,130,0.6)'; ng.fillRect(0, 192, TILE, 8); }
    } else if (themeName === 'peak') {
      for (let i = 0; i < 130; i++) {
        const x = rnd() * TILE, hgt = 40 + rnd() * 70, y = 200 - rnd() * 18;
        for (const dx of [0, TILE, -TILE]) {
          ng.fillStyle = i % 3 ? T.near : '#24483a';
          ng.beginPath(); ng.moveTo(x + dx, y - hgt); ng.lineTo(x + dx + hgt * 0.28, y); ng.lineTo(x + dx - hgt * 0.28, y); ng.closePath(); ng.fill();
          ng.fillStyle = 'rgba(255,255,255,0.7)'; ng.beginPath(); ng.moveTo(x + dx, y - hgt); ng.lineTo(x + dx + hgt * 0.08, y - hgt * 0.72); ng.lineTo(x + dx - hgt * 0.08, y - hgt * 0.72); ng.closePath(); ng.fill();
        }
      }
    } else {
      const pts = ridge(ng, rnd, 165, 34, 1.4, T.near, TILE, 200);
      if (themeName === 'yard' || themeName === 'dusk') {
        // junk sticking out of the heaps: bent beams, a wheel, a car roof
        for (let i = 0; i < 40; i++) {
          const k = Math.floor(rnd() * pts.length), [x, y] = pts[k];
          ng.save(); ng.translate(x, y + 6); ng.rotate((rnd() - 0.5) * 1.6);
          ng.fillStyle = rnd() < 0.5 ? '#3d4049' : themeName === 'dusk' ? '#4a2a3a' : '#8a5a3c';
          if (rnd() < 0.3) { ng.beginPath(); ng.arc(0, 0, 8 + rnd() * 8, 0, 6.283); ng.fill(); }
          else ng.fillRect(-2, -20 - rnd() * 20, 5 + rnd() * 4, 30);
          ng.restore();
        }
      }
      if (themeName === 'gorge') {
        ng.fillStyle = 'rgba(0,0,0,0.12)';
        for (let i = 0; i < 70; i++) ng.fillRect(rnd() * TILE, 120 + rnd() * 80, 30 + rnd() * 80, 2);
      }
    }
    return { sky, far, near };
  }

  // ---------- props ----------
  // each painter draws into a canvas sized w x h world units (bottom centre = ground)
  function prop(w, h, fn) {
    const c = canvas(w * PX, h * PX), g = c.getContext('2d');
    g.translate(c.width / 2, c.height);
    g.scale(PX, PX);
    fn(g, w, h);
    return { c, w, h };
  }
  function rect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  function shadowFoot(g, w) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, -0.05, w / 2, 0.25, 0, 0, 6.283); g.fill(); }

  const PAINT = {
    tyres: () => prop(3.2, 3.2, (g) => {
      shadowFoot(g, 3);
      const cols = ['#1b1b1f', '#d7263d', '#1b1b1f', '#f2ead8', '#1b1b1f'];
      for (let r = 0; r < 4; r++) for (let k = 0; k < 2; k++) {
        const x = (k - 0.5) * 1.35 + (r % 2 ? 0.2 : 0), y = -0.38 - r * 0.72;
        g.fillStyle = '#18181c'; g.beginPath(); g.ellipse(x, y, 0.68, 0.38, 0, 0, 6.283); g.fill();
        g.fillStyle = cols[(r + k) % 5]; g.fillRect(x - 0.68, y - 0.1, 1.36, 0.2);
        g.fillStyle = '#333'; g.beginPath(); g.ellipse(x, y - 0.2, 0.3, 0.12, 0, 0, 6.283); g.fill();
      }
    }),
    drum: () => prop(1.6, 2.2, (g) => {
      shadowFoot(g, 1.6);
      const gr = g.createLinearGradient(-0.7, 0, 0.7, 0); gr.addColorStop(0, '#1d5f8a'); gr.addColorStop(0.4, '#3b9ad0'); gr.addColorStop(1, '#14425f');
      g.fillStyle = gr; g.fillRect(-0.7, -2, 1.4, 2);
      rect(g, -0.7, -1.4, 1.4, 0.08, '#0d2f45'); rect(g, -0.7, -0.6, 1.4, 0.08, '#0d2f45');
      g.fillStyle = '#5bb3e4'; g.beginPath(); g.ellipse(0, -2, 0.7, 0.18, 0, 0, 6.283); g.fill();
      rect(g, -0.25, -1.25, 0.5, 0.5, '#ffc21a'); g.fillStyle = '#1d1a1e'; g.beginPath(); g.moveTo(0, -1.2); g.lineTo(0.18, -0.82); g.lineTo(-0.18, -0.82); g.fill();
    }),
    scrap: () => prop(8, 4.5, (g) => {
      shadowFoot(g, 8);
      const rnd = rng(77);
      g.fillStyle = '#4a4d55'; g.beginPath(); g.moveTo(-4, 0); g.lineTo(-2.6, -2.8); g.lineTo(-0.6, -4); g.lineTo(1.8, -3.1); g.lineTo(4, 0); g.fill();
      for (let i = 0; i < 26; i++) {
        g.save(); g.translate((rnd() - 0.5) * 6, -0.5 - rnd() * 3); g.rotate((rnd() - 0.5) * 2);
        g.fillStyle = ['#8a5a3c', '#6c727d', '#b8432f', '#3d4049', '#9aa3a8', '#c79a3a'][Math.floor(rnd() * 6)];
        if (rnd() < 0.25) { g.beginPath(); g.arc(0, 0, 0.3 + rnd() * 0.4, 0, 6.283); g.fill(); g.fillStyle = '#222'; g.beginPath(); g.arc(0, 0, 0.12, 0, 6.283); g.fill(); }
        else g.fillRect(-0.6, -0.15, 0.6 + rnd() * 1.4, 0.18 + rnd() * 0.5);
        g.restore();
      }
      // a car shell on top
      g.fillStyle = '#7b8f3a'; g.beginPath(); g.moveTo(-1.6, -3.3); g.lineTo(-1, -4.1); g.lineTo(0.8, -4.1); g.lineTo(1.4, -3.3); g.closePath(); g.fill();
      rect(g, -0.8, -3.95, 0.7, 0.45, '#2c3a44'); rect(g, 0, -3.95, 0.6, 0.45, '#2c3a44');
    }),
    fence: () => prop(7, 3, (g) => {
      for (const x of [-3.4, 0, 3.4]) rect(g, x - 0.06, -3, 0.12, 3, '#8a8f98');
      g.strokeStyle = 'rgba(190,196,204,0.7)'; g.lineWidth = 0.04;
      for (let k = -14; k < 14; k++) { g.beginPath(); g.moveTo(k * 0.25 - 0.4, -2.9); g.lineTo(k * 0.25 + 0.4, -0.1); g.stroke(); g.beginPath(); g.moveTo(k * 0.25 + 0.4, -2.9); g.lineTo(k * 0.25 - 0.4, -0.1); g.stroke(); }
      rect(g, -3.5, -3, 7, 0.08, '#9aa0a8');
    }),
    board: () => prop(8, 6, (g) => {
      for (const x of [-2.6, 2.6]) rect(g, x - 0.12, -3.5, 0.24, 3.5, '#3d4049');
      rect(g, -4, -6, 8, 3, '#1d1a1e');
      rect(g, -3.8, -5.8, 7.6, 2.6, '#ffc21a');
      g.fillStyle = '#1d1a1e'; g.font = 'bold 1.5px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(['GRIT-O', 'BOLTS', 'NUTZ', 'TORQ'][Math.floor(Math.random() * 4)], 0, -4.45);
      for (let k = 0; k < 8; k++) rect(g, -3.8 + k * 0.95, -3.35, 0.48, 0.15, '#d7263d');
    }),
    flag: () => prop(3, 6, (g) => {
      rect(g, -0.06, -6, 0.12, 6, '#c9ccd1');
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) rect(g, 0.06 + c * 0.38, -5.9 + r * 0.38 + Math.sin(c) * 0.08, 0.38, 0.38, (r + c) % 2 ? '#111' : '#f4f4f4');
    }),
    bush: () => prop(3, 2, (g) => {
      shadowFoot(g, 3);
      [['#4f7f2f', 0, -0.8, 1.1], ['#5e9238', -0.7, -0.6, 0.8], ['#5e9238', 0.8, -0.6, 0.75], ['#6ea544', 0.1, -1.2, 0.7]].forEach(([c, x, y, r]) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); });
    }),
    crusher: () => prop(12, 9, (g) => {
      shadowFoot(g, 12);
      rect(g, -6, -4, 12, 4, '#3a3540'); rect(g, -5.5, -9, 1.2, 5, '#4a4450'); rect(g, 4.3, -9, 1.2, 5, '#4a4450');
      rect(g, -5.6, -9, 11.2, 1.2, '#ffc21a');
      for (let k = 0; k < 11; k++) rect(g, -5.6 + k * 1.02, -9, 0.5, 1.2, '#1d1a1e');
      rect(g, -3.5, -7.6, 7, 2.2, '#5c5560');
      [['#b8432f', -2.4], ['#2d6c8f', 0], ['#7b8f3a', 2.4]].forEach(([c, x]) => { rect(g, x - 1.1, -3.6, 2.2, 1.1, c); rect(g, x - 1.1, -2.4, 2.2, 1, c); });
      g.fillStyle = 'rgba(255,200,90,0.85)'; g.beginPath(); g.arc(4.9, -9.6, 0.4, 0, 6.283); g.fill();
    }),
    flood: () => prop(3, 12, (g) => {
      rect(g, -0.15, -11, 0.3, 11, '#3d3a44');
      rect(g, -1.4, -12, 2.8, 1.3, '#2a2730');
      for (let k = 0; k < 3; k++) { g.fillStyle = '#fff1c4'; g.beginPath(); g.arc(-0.9 + k * 0.9, -11.35, 0.35, 0, 6.283); g.fill(); }
      const gr = g.createRadialGradient(0, -11.3, 0, 0, -11.3, 3); gr.addColorStop(0, 'rgba(255,230,160,0.5)'); gr.addColorStop(1, 'rgba(255,230,160,0)');
      g.fillStyle = gr; g.fillRect(-3, -12, 6, 3.2);
    }),
    container: () => prop(13, 6, (g) => {
      shadowFoot(g, 13);
      const rnd = rng(Math.floor(Math.random() * 1e6));
      for (let r = 0; r < 2; r++) {
        const col = ['#b8432f', '#2d6c8f', '#d19a2a', '#4f7a3a', '#7d3c8a'][Math.floor(rnd() * 5)];
        const x0 = r ? -5.4 + rnd() : -6.2;
        rect(g, x0, -2.9 * (r + 1), 12, 2.8, col);
        g.fillStyle = 'rgba(0,0,0,0.22)'; for (let k = 0.3; k < 12; k += 0.45) g.fillRect(x0 + k, -2.9 * (r + 1) + 0.15, 0.12, 2.5);
        rect(g, x0, -2.9 * (r + 1), 12, 0.15, 'rgba(255,255,255,0.25)');
      }
    }),
    bollard: () => prop(1.2, 1.4, (g) => {
      shadowFoot(g, 1.2);
      rect(g, -0.4, -1, 0.8, 1, '#2a2c33'); g.fillStyle = '#3d4049'; g.beginPath(); g.ellipse(0, -1.05, 0.55, 0.3, 0, 0, 6.283); g.fill();
      rect(g, -0.4, -0.6, 0.8, 0.15, '#ffc21a');
    }),
    lamp: () => prop(3, 10, (g) => {
      rect(g, -0.12, -9.6, 0.24, 9.6, '#4a4f5c');
      rect(g, -0.12, -9.6, 1.6, 0.22, '#4a4f5c');
      rect(g, 1, -9.5, 0.8, 0.3, '#fff3c4');
      const gr = g.createRadialGradient(1.4, -9.2, 0, 1.4, -9.2, 2.2); gr.addColorStop(0, 'rgba(255,240,180,0.6)'); gr.addColorStop(1, 'rgba(255,240,180,0)');
      g.fillStyle = gr; g.fillRect(-1, -11.5, 5, 4.6);
    }),
    crate: () => prop(2.2, 2.2, (g) => {
      shadowFoot(g, 2.2);
      rect(g, -1, -2, 2, 2, '#b98b4e'); g.strokeStyle = '#7a5a2e'; g.lineWidth = 0.14; g.strokeRect(-0.93, -1.93, 1.86, 1.86);
      g.beginPath(); g.moveTo(-0.93, -0.07); g.lineTo(0.93, -1.93); g.stroke();
    }),
    craneleg: () => prop(6, 16, (g) => {
      rect(g, -2.6, -16, 0.7, 16, '#d14b2a'); rect(g, 1.9, -16, 0.7, 16, '#d14b2a');
      g.strokeStyle = '#a53a20'; g.lineWidth = 0.25;
      for (let y = -16; y < 0; y += 2.5) { g.beginPath(); g.moveTo(-2.2, y); g.lineTo(2.2, y + 2.5); g.moveTo(2.2, y); g.lineTo(-2.2, y + 2.5); g.stroke(); }
      rect(g, -3, -16.3, 6, 0.8, '#ffc21a');
    }),
    rock: () => prop(7, 12, (g) => {
      shadowFoot(g, 7);
      const gr = g.createLinearGradient(-3, 0, 3, 0); gr.addColorStop(0, '#b15a30'); gr.addColorStop(0.5, '#d0784a'); gr.addColorStop(1, '#7a3a1e');
      g.fillStyle = gr; g.beginPath(); g.moveTo(-3.2, 0); g.lineTo(-2.6, -6); g.lineTo(-2.9, -9); g.lineTo(-1.5, -11.6); g.lineTo(1.2, -12); g.lineTo(2.4, -9.5); g.lineTo(2.1, -6); g.lineTo(3.3, 0); g.fill();
      g.fillStyle = 'rgba(80,30,10,0.35)'; for (let y = -11; y < 0; y += 1.4) g.fillRect(-2.8, y, 5.6, 0.25);
      g.fillStyle = 'rgba(255,220,170,0.25)'; g.beginPath(); g.moveTo(-1.5, -11.6); g.lineTo(1.2, -12); g.lineTo(0.6, -11.2); g.lineTo(-1.2, -11); g.fill();
    }),
    gear: () => prop(8, 8, (g) => {
      g.save(); g.translate(0, -3.6);
      g.fillStyle = '#6b4a34';
      g.beginPath(); for (let k = 0; k < 24; k++) { const a = (k / 24) * 6.283, r = k % 2 ? 3.9 : 3.3; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
      g.fillStyle = '#8a5f42'; g.beginPath(); g.arc(0, 0, 2.9, 0, 6.283); g.fill();
      g.fillStyle = '#5a3c28'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(Math.cos(k * 1.047) * 1.7, Math.sin(k * 1.047) * 1.7, 0.55, 0, 6.283); g.fill(); }
      g.fillStyle = '#3a2618'; g.beginPath(); g.arc(0, 0, 0.7, 0, 6.283); g.fill();
      g.restore();
      g.fillStyle = '#c88a52'; g.beginPath(); g.ellipse(0, 0, 4, 0.9, 0, 0, 6.283); g.fill();
    }),
    cactus: () => prop(2.5, 5, (g) => {
      shadowFoot(g, 1.5);
      g.fillStyle = '#3f7a3a'; g.fillRect(-0.35, -4.6, 0.7, 4.6); g.beginPath(); g.arc(0, -4.6, 0.35, 0, 6.283); g.fill();
      g.fillRect(-1.1, -3.2, 0.5, 1.6); g.fillRect(-1.1, -1.8, 0.9, 0.45); g.fillRect(0.6, -3.8, 0.5, 1.8); g.fillRect(0.2, -2.2, 0.9, 0.45);
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(-0.2, -4.5, 0.12, 4.4);
    }),
    boulder: () => prop(4, 2.6, (g) => {
      shadowFoot(g, 4);
      g.fillStyle = '#a8603a'; g.beginPath(); g.ellipse(0, -1.1, 1.9, 1.2, 0, 0, 6.283); g.fill();
      g.fillStyle = 'rgba(255,220,180,0.3)'; g.beginPath(); g.ellipse(-0.5, -1.6, 0.9, 0.5, -0.3, 0, 6.283); g.fill();
    }),
    neon: () => prop(7, 9, (g) => {
      for (const x of [-2.5, 2.5]) rect(g, x - 0.1, -5, 0.2, 5, '#3d3a50');
      rect(g, -3.4, -9, 6.8, 4, '#120e26');
      const c = ['#ff2e88', '#1de9b6', '#ffe66d', '#57a0ff'][Math.floor(Math.random() * 4)];
      g.strokeStyle = c; g.lineWidth = 0.22; g.strokeRect(-3.1, -8.7, 6.2, 3.4);
      g.fillStyle = c; g.font = 'bold 1.6px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(['PITS', 'GARAGE', 'TYRES', 'FUEL', 'DINER'][Math.floor(Math.random() * 5)], 0, -7);
      const gr = g.createRadialGradient(0, -7, 0, 0, -7, 4); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-3.5, -9, 7, 4);
    }),
    tower: () => prop(9, 20, (g) => {
      rect(g, -4.5, -20, 9, 20, '#1a1638');
      const rnd = rng(Math.floor(Math.random() * 1e6));
      for (let y = -19; y < -1; y += 1.2) for (let x = -4; x < 4; x += 1.1) if (rnd() < 0.5) rect(g, x, y, 0.6, 0.7, rnd() < 0.85 ? 'rgba(255,210,120,0.9)' : 'rgba(120,220,255,0.9)');
      rect(g, -4.5, -20, 9, 0.3, '#ff2e88');
    }),
    pine: () => prop(5, 11, (g) => {
      g.fillStyle = 'rgba(40,60,80,0.18)'; g.beginPath(); g.ellipse(0, -0.1, 2.4, 0.4, 0, 0, 6.283); g.fill();
      rect(g, -0.25, -1.6, 0.5, 1.6, '#5a3a24');
      for (let k = 0; k < 4; k++) {
        const y = -1.2 - k * 2.3, w = 2.4 - k * 0.5;
        g.fillStyle = k % 2 ? '#2c5a44' : '#244c3a'; g.beginPath(); g.moveTo(-w, y); g.lineTo(0, y - 3.4); g.lineTo(w, y); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.moveTo(-w * 0.9, y - 0.1); g.lineTo(-w * 0.3, y - 0.6); g.lineTo(w * 0.2, y - 0.2); g.lineTo(w * 0.9, y - 0.1); g.lineTo(w * 0.5, y - 0.45); g.lineTo(0, y - 3.3); g.lineTo(-w * 0.2, y - 1.2); g.closePath(); g.globalAlpha = 0.55; g.fill(); g.globalAlpha = 1;
      }
    }),
    snowrock: () => prop(5, 3, (g) => {
      g.fillStyle = '#6d7a88'; g.beginPath(); g.moveTo(-2.4, 0); g.lineTo(-1.6, -2); g.lineTo(0.2, -2.8); g.lineTo(1.9, -1.8); g.lineTo(2.4, 0); g.fill();
      g.fillStyle = '#f4f8fb'; g.beginPath(); g.moveTo(-1.7, -1.9); g.lineTo(0.2, -2.8); g.lineTo(1.9, -1.8); g.lineTo(0.9, -1.5); g.lineTo(0, -1.9); g.lineTo(-0.9, -1.4); g.fill();
    }),
    piston: () => prop(5, 13, (g) => {
      shadowFoot(g, 5);
      rect(g, -2.2, -2, 4.4, 2, '#4a4f5c');
      const gr = g.createLinearGradient(-1.4, 0, 1.4, 0); gr.addColorStop(0, '#8a929e'); gr.addColorStop(0.45, '#e8ecf0'); gr.addColorStop(1, '#6a727e');
      g.fillStyle = gr; g.fillRect(-0.5, -9, 1, 7);
      g.fillRect(-1.6, -12.6, 3.2, 3.6);
      for (let k = 0; k < 3; k++) rect(g, -1.6, -12.2 + k * 0.5, 3.2, 0.14, '#5a626e');
      rect(g, -2.2, -2.4, 4.4, 0.4, '#ffc21a');
    }),
    hut: () => prop(7, 6, (g) => {
      shadowFoot(g, 7);
      rect(g, -3, -3.4, 6, 3.4, '#8a5232'); g.fillStyle = 'rgba(0,0,0,0.2)'; for (let y = -3.2; y < 0; y += 0.5) g.fillRect(-3, y, 6, 0.08);
      g.fillStyle = '#f4f8fb'; g.beginPath(); g.moveTo(-3.6, -3.2); g.lineTo(0, -6); g.lineTo(3.6, -3.2); g.closePath(); g.fill();
      rect(g, -0.6, -2, 1.2, 2, '#4a2a18'); rect(g, 1.4, -2.6, 1, 0.9, '#ffd27a'); rect(g, -2.4, -2.6, 1, 0.9, '#ffd27a');
    }),
    // track furniture
    armco: () => prop(6, 1.4, (g) => {
      for (const x of [-2.8, 0, 2.8]) rect(g, x - 0.08, -1.2, 0.16, 1.2, '#7a808a');
      const gr = g.createLinearGradient(0, -1.2, 0, -0.5); gr.addColorStop(0, '#e8ecf0'); gr.addColorStop(1, '#8a929e');
      g.fillStyle = gr; g.fillRect(-3, -1.2, 6, 0.6);
    }),
    tyrewall: () => prop(6, 1.6, (g) => {
      for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) {
        const x = -2.5 + k * 1 + (r ? 0.5 : 0), y = -0.4 - r * 0.62;
        if (r && k === 5) continue;
        g.fillStyle = '#18181c'; g.beginPath(); g.ellipse(x, y, 0.52, 0.34, 0, 0, 6.283); g.fill();
        g.fillStyle = (k + r) % 2 ? '#f2ead8' : '#d7263d'; g.fillRect(x - 0.52, y - 0.06, 1.04, 0.12);
      }
    }),
    chevL: () => prop(3, 3, (g) => chevron(g, -1)),
    chevR: () => prop(3, 3, (g) => chevron(g, 1)),
    stand: () => prop(16, 7, (g) => {
      const rnd = rng(9);
      for (let r = 0; r < 5; r++) {
        rect(g, -8 + r * 0.3, -1.3 - r * 1.1, 16 - r * 0.6, 1.1, r % 2 ? '#3d4049' : '#4a4f5c');
        for (let k = 0; k < 26; k++) {
          const x = -7.5 + r * 0.3 + k * 0.58;
          g.fillStyle = ['#d7263d', '#ffc21a', '#2a6fdb', '#f2ead8', '#16c79a', '#ff8a1f'][Math.floor(rnd() * 6)];
          g.fillRect(x, -1.95 - r * 1.1, 0.4, 0.5);
          g.fillStyle = ['#f1c9a5', '#c68b59', '#8d5524', '#e0ac69'][Math.floor(rnd() * 4)];
          g.beginPath(); g.arc(x + 0.2, -2.15 - r * 1.1, 0.17, 0, 6.283); g.fill();
        }
      }
      rect(g, -8.4, -7, 16.8, 0.5, '#d7263d');
      for (let k = 0; k < 12; k++) rect(g, -8.4 + k * 1.4, -7, 0.7, 0.5, '#f2ead8');
    }),
  };
  function chevron(g, dir) {
    rect(g, -0.08, -1.4, 0.16, 1.4, '#3d4049');
    rect(g, -1.4, -3, 2.8, 1.6, '#f2ead8');
    rect(g, -1.4, -3, 2.8, 1.6, '#d7263d');
    g.fillStyle = '#f2ead8';
    for (let k = -1; k <= 1; k++) {
      const x = k * 0.75;
      g.beginPath();
      g.moveTo(x - dir * 0.3, -2.85); g.lineTo(x + dir * 0.15, -2.2); g.lineTo(x - dir * 0.3, -1.55); g.lineTo(x - dir * 0.05, -1.55); g.lineTo(x + dir * 0.4, -2.2); g.lineTo(x - dir * 0.05, -2.85); g.closePath(); g.fill();
    }
  }

  // the start/finish gantry: spans the road, holds the start lights
  function gantry() {
    const RW = KR.RW, w = RW * 2 + 4;
    return prop(w, 10, (g) => {
      for (const x of [-w / 2 + 0.8, w / 2 - 0.8]) { rect(g, x - 0.35, -10, 0.7, 10, '#3d4049'); rect(g, x - 0.35, -10, 0.7, 0.4, '#ffc21a'); }
      rect(g, -w / 2 + 0.4, -10, w - 0.8, 2.6, '#1d1a1e');
      for (let c = 0; c < 44; c++) for (let r = 0; r < 2; r++) rect(g, -w / 2 + 0.6 + c * ((w - 1.2) / 44), -9.85 + r * 0.45, (w - 1.2) / 44, 0.45, (c + r) % 2 ? '#111' : '#f4f4f4');
      g.fillStyle = '#ffc21a'; g.font = 'bold 1.2px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('KITBASH RALLY', 0, -8.2);
    });
  }

  const cache = {};
  function props() {
    if (cache.props) return cache.props;
    const out = {};
    for (const k of Object.keys(PAINT)) {
      // a few variants of the painters that use randomness
      const n = ['board', 'container', 'neon', 'tower'].includes(k) ? 3 : 1;
      out[k] = [];
      for (let i = 0; i < n; i++) out[k].push(PAINT[k]());
    }
    out.gantry = [gantry()];
    cache.props = out;
    return out;
  }
  function backdrops(theme) {
    return cache['bg:' + theme] || (cache['bg:' + theme] = backdrop(theme));
  }

  // Place props along a track: theme props on both sides at varied depth,
  // chevrons on the outside of sharp bends, barriers where the road bends,
  // a grandstand and gantry at the line.
  function dress(track) {
    if (track.dressed) return track.dressed;
    const T = THEMES[track.theme], N = track.N, rnd = rng(KR.util.hash(track.name + ':props'));
    const list = [];
    const bag = [];
    T.props.forEach(([k, w]) => { for (let i = 0; i < w; i++) bag.push(k); });
    const add = (seg, kind, x, v, s) => list.push({ seg: ((seg % N) + N) % N, kind, v: v || 0, x, s: s || 1 });
    add(0, 'gantry', 0);
    add(18, 'stand', -4.2); add(40, 'stand', -4.2); add(62, 'stand', 4.2);
    for (let z = 4; z < N; z += 3 + Math.floor(rnd() * 6)) {
      for (const side of [-1, 1]) {
        if (rnd() < 0.35) continue;
        const kind = bag[Math.floor(rnd() * bag.length)];
        const big = ['crusher', 'container', 'tower', 'rock', 'craneleg', 'scrap', 'stand', 'hut'].includes(kind);
        const x = side * (big ? 3.6 + rnd() * 3.5 : 2.8 + rnd() * 2.6);
        add(z, kind, x, Math.floor(rnd() * 3), 0.85 + rnd() * 0.35);
      }
    }
    // barriers and chevrons follow the bends
    for (let z = 0; z < N; z += 4) {
      const c = track.segs[z].curve;
      if (Math.abs(c) > 0.012) {
        const outside = c > 0 ? -1 : 1; // the road bends right: the outside is on the left
        add(z, track.theme === 'night' || track.theme === 'docks' ? 'armco' : 'tyrewall', outside * 2.55);
        if (Math.abs(c) > 0.024 && z % 12 === 0) add(z + 1, c > 0 ? 'chevR' : 'chevL', outside * 2.6);
      }
    }
    const bySeg = Array.from({ length: N }, () => []);
    for (const p of list) bySeg[p.seg].push(p);
    // cumulative heading (for parallax) and a minimap outline
    const heading = new Float32Array(N + 1);
    for (let i = 0; i < N; i++) heading[i + 1] = heading[i] + track.segs[i].curve;
    track.dressed = { bySeg, heading };
    return track.dressed;
  }

  function minimap(track, size) {
    const key = 'mini:' + track.index + ':' + size;
    if (cache[key]) return cache[key];
    const pts = track.pts;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const s = (size - 16) / Math.max(x1 - x0, y1 - y0);
    const ox = (size - (x1 - x0) * s) / 2, oy = (size - (y1 - y0) * s) / 2;
    const map = (p) => [ox + (p[0] - x0) * s, oy + (p[1] - y0) * s];
    const c = canvas(size, size), g = c.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    const path = () => { g.beginPath(); pts.forEach((p, i) => { const [x, y] = map(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); };
    path(); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 7; g.stroke();
    path(); g.strokeStyle = '#f2ead8'; g.lineWidth = 3.5; g.stroke();
    const [sx, sy] = map(pts[0]);
    g.fillStyle = '#ffc21a'; g.fillRect(sx - 4, sy - 4, 8, 8);
    const out = { c, map };
    cache[key] = out;
    return out;
  }

  // pre-mixed fog colours so the road never builds colour strings per frame
  function fogTable(theme) {
    const key = 'fog:' + theme;
    if (cache[key]) return cache[key];
    const T = THEMES[theme], mix = KR.Model.mix, L = 24;
    const lerpList = (cols) => cols.map((c) => { const out = []; for (let i = 0; i < L; i++) out.push(mix(c, T.fog, Math.pow(i / (L - 1), 1.6) * 0.92)); return out; });
    const t = { L, grass: lerpList(T.grass), rumble: lerpList(T.rumble), road: lerpList(T.road), lane: lerpList([T.lane])[0] };
    cache[key] = t;
    return t;
  }

  KR.Scenery = { THEMES, PX, TILE, props, backdrops, dress, minimap, fogTable };
})();
