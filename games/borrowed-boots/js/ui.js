// Every screen of the storybook: the cover (title), the shelf of books (save
// slots), the story map, the Creature Book, how to play, settings, pause,
// the end-of-page card, the HUD and the touch buttons. All drawn on the
// canvas; interactive bits are registered on g.buttons every frame so mouse,
// touch, keyboard and gamepad drive the same menus.
(function () {
  const C = BB.CFG;
  const G = BB.G;
  const U = BB.U;
  const I = BB.Input;
  const COL = BB.COL;
  const INK = COL.ink;
  const TAU = Math.PI * 2;
  const LEVELS = window.BootsLevels;
  const ROW = 44;

  const enter = (g, delay = 0, dur = 0.3) => U.easeOut(U.clamp01((g.stateT - delay) / dur));
  const pop = (g, delay = 0, dur = 0.35) => U.easeBack(U.clamp01((g.stateT - delay) / dur));

  const GLYPH = {
    jump: { keyboard: 'SPACE', gamepad: 'A', touch: null },
    confirm: { keyboard: 'ENTER', gamepad: 'A', touch: null },
    back: { keyboard: 'ESC', gamepad: 'B', touch: null },
    pause: { keyboard: 'ESC', gamepad: 'START', touch: null },
    restart: { keyboard: 'R', gamepad: 'Y', touch: null },
    erase: { keyboard: 'X', gamepad: 'X', touch: null },
    codex: { keyboard: 'C', gamepad: 'Y', touch: null },
    move: { keyboard: 'A D', gamepad: 'STICK', touch: null },
    pick: { keyboard: '← →', gamepad: 'D-PAD', touch: null },
  };
  const glyph = (a) => GLYPH[a][I.device];
  BB.tipText = (s) => s.replace('{jump}', I.device === 'gamepad' ? 'A' : I.device === 'touch' ? 'the boot button' : 'Space');

  function keycap(ctx, label, x, y, size = 11, draw = true) {
    const round = I.device === 'gamepad' && label.length === 1;
    const h = size + 12;
    const w = round ? h : Math.max(h, G.measure(ctx, label, size, 700) + 14);
    if (!draw) return w;
    ctx.save();
    if (round) {
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 2, h / 2, 0, TAU);
      ctx.fillStyle = 'rgba(59,42,30,0.3)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + w / 2, y, h / 2, 0, TAU);
    } else {
      G.rr(ctx, x, y - h / 2 + 3, w, h, 6);
      ctx.fillStyle = 'rgba(59,42,30,0.3)';
      ctx.fill();
      G.rr(ctx, x, y - h / 2, w, h, 6);
    }
    ctx.fillStyle = '#fffaf0';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
    G.text(ctx, label, x + w / 2, y + 1, size, INK, 'center', 700);
    return w;
  }

  function prompt(ctx, action, label, x, y, align = 'left', color = COL.inkSoft) {
    const gl = glyph(action);
    if (!gl) return 0;
    const kw = keycap(ctx, gl, 0, 0, 11, false);
    const lw = G.measure(ctx, label, 15, 700);
    const total = kw + 8 + lw;
    const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    keycap(ctx, gl, x0, y);
    G.text(ctx, label, x0 + kw + 8, y + 1, 15, color === COL.inkSoft ? INK : color, 'left', 700, { outline: 5, outlineColor: 'rgba(255,248,232,0.92)' });
    return total;
  }

  // A row of prompts laid out from the right.
  function footer(ctx, list, y = C.H - 26, x = C.W - 28) {
    if (I.device === 'touch') return;
    for (const [a, l] of list) {
      const w = prompt(ctx, a, l, x, y, 'right');
      if (w) x -= w + 22;
    }
  }

  // A paper tag button (touch-friendly and clickable).
  function tagButton(ctx, g, label, x, y, w, h, action, opts = {}) {
    const hov = I.mouse && I.mouse.x >= x && I.mouse.x <= x + w && I.mouse.y >= y && I.mouse.y <= y + h;
    G.card(ctx, x, y - (hov ? 2 : 0), w, h, { r: h / 2, fill: opts.fill || (hov ? '#fff' : COL.paper), plain: true, lw: 2.5 });
    G.text(ctx, label, x + w / 2, y + h / 2 + 1 - (hov ? 2 : 0), opts.size || 17, opts.color || INK, 'center', 700);
    g.buttons.push({ x, y, w, h, action });
  }

  // A vertical menu of paper tags. The focused one slides out with a red
  // ribbon bookmark beside it.
  const hl = { key: '', y: 0 };
  function list(ctx, g, items, x, y, w, opts = {}) {
    const h = ROW - 8;
    const key = g.state + ':' + items.length + ':' + x;
    const target = y + g.focus * ROW;
    if (hl.key !== key) {
      hl.key = key;
      hl.y = target;
    } else hl.y += (target - hl.y) * 0.3;
    items.forEach((it, i) => {
      const k = enter(g, 0.05 + i * 0.05, 0.3);
      const ry = y + i * ROW;
      const f = g.focus === i;
      ctx.save();
      ctx.globalAlpha *= k;
      const slide = (1 - k) * -30 + (f ? 10 : 0);
      ctx.translate(slide, 0);
      const wob = f && g.settings.motion ? Math.sin(g.time * 3) * 0.006 : 0;
      ctx.translate(x + w / 2, ry + h / 2);
      ctx.rotate(wob + (f ? -0.008 : 0));
      ctx.translate(-x - w / 2, -ry - h / 2);
      G.rr(ctx, x + 3, ry + 5, w, h, 12);
      ctx.fillStyle = 'rgba(59,42,30,0.2)';
      ctx.fill();
      G.rr(ctx, x, ry, w, h, 12);
      ctx.fillStyle = f ? (g.pulse > 0 ? '#fff6c8' : '#fffaf0') : opts.dim ? 'rgba(253,244,220,0.88)' : COL.paper;
      ctx.fill();
      ctx.lineWidth = f ? 3 : 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      G.text(ctx, it.label, x + 18, ry + h / 2 + 1, 19, f ? INK : COL.inkSoft, 'left', 700);
      if (it.sub) {
        const lw = G.measure(ctx, it.label, 19, 700);
        G.text(ctx, it.sub, x + 26 + lw, ry + h / 2 + 2, 13, COL.faint, 'left', 700, { body: true, maxWidth: w - lw - 50 });
      }
      if (it.slider) {
        const v = it.slider();
        const bx = x + w - 182;
        for (let s = 0; s < 10; s++) {
          ctx.beginPath();
          ctx.arc(bx + s * 15, ry + h / 2, 5.5, 0, TAU);
          ctx.fillStyle = s < v ? (f ? COL.red : '#d98a74') : 'rgba(59,42,30,0.12)';
          ctx.fill();
          if (s < v) {
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = INK;
            ctx.stroke();
          }
        }
        G.text(ctx, String(v), x + w - 18, ry + h / 2 + 1, 16, INK, 'right', 700);
        if (f) {
          G.text(ctx, '◀', bx - 16, ry + h / 2, 12, COL.inkSoft, 'center');
          G.text(ctx, '▶', bx + 150, ry + h / 2, 12, COL.inkSoft, 'center');
        }
        g.buttons.push({ x: bx - 30, y: ry, w: 70, h, focus: i, action: () => it.adjust(-1) });
        g.buttons.push({ x: bx + 75, y: ry, w: 110, h, focus: i, action: () => it.adjust(1) });
      } else if (it.toggle) {
        const on = it.toggle();
        const bx = x + w - 40;
        G.rr(ctx, bx - 8, ry + h / 2 - 11, 24, 22, 6);
        ctx.fillStyle = on ? '#e9f6d8' : '#fff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
        if (on) {
          ctx.strokeStyle = COL.leaf;
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(bx - 2, ry + h / 2);
          ctx.lineTo(bx + 3, ry + h / 2 + 6);
          ctx.lineTo(bx + 14, ry + h / 2 - 9);
          ctx.stroke();
          ctx.lineCap = 'butt';
        }
        G.text(ctx, on ? 'on' : 'off', bx - 16, ry + h / 2 + 1, 14, on ? COL.leaf : COL.faint, 'right', 700);
      }
      ctx.restore();
      g.buttons.push({ x, y: ry, w, h, focus: i, action: () => g.activate(it) });
    });
    // the ribbon bookmark beside the focused tag
    if (items[g.focus]) {
      const ry = hl.y;
      ctx.save();
      ctx.globalAlpha *= enter(g, 0.1);
      ctx.beginPath();
      ctx.moveTo(x - 6, ry + 4);
      ctx.lineTo(x + 8, ry + 4);
      ctx.lineTo(x + 8, ry + h + 10);
      ctx.lineTo(x + 1, ry + h + 3);
      ctx.lineTo(x - 6, ry + h + 10);
      ctx.closePath();
      ctx.fillStyle = COL.red;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Title lettering: each letter bobs a little, ink outline, cream fill.
  function bouncyTitle(ctx, g, str, x, y, size, fill, k) {
    let cx = x;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      const w = G.measure(ctx, ch, size, 700);
      const li = U.clamp01((g.stateT - 0.05 - i * 0.04) / 0.4);
      const by = g.settings.motion ? Math.sin(g.time * 2.4 + i * 0.6) * 3 : 0;
      ctx.save();
      ctx.globalAlpha *= k * li;
      ctx.translate(cx + w / 2, y + by + (1 - U.easeBack(li)) * -40);
      ctx.rotate((g.settings.motion ? Math.sin(g.time * 1.7 + i) * 0.04 : 0) + (i % 2 ? 0.03 : -0.03));
      G.text(ctx, ch, 0, 6, size, 'rgba(59,42,30,0.35)', 'center', 700);
      G.text(ctx, ch, 0, 0, size, fill, 'center', 700, { outline: 8 });
      ctx.restore();
      cx += w - size * 0.02;
    }
  }

  // ---------- the story map page (painted once) ----------
  const NODES = [
    [100, 372], [192, 322], [142, 244], [246, 186],
    [352, 226], [424, 318], [526, 286], [484, 182],
    [594, 132], [694, 204], [792, 152], [874, 86],
  ];
  function catmull(i, u) {
    const p = (k) => NODES[U.clamp(k, 0, NODES.length - 1)];
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const u2 = u * u;
    const u3 = u2 * u;
    const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
    return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
  }
  function pathAt(v) {
    const i = Math.min(NODES.length - 2, Math.floor(v));
    return catmull(i, U.clamp01(v - i));
  }
  let mapCache = null;
  function mapPage() {
    if (mapCache) return mapCache;
    const c = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = C.W * dpr;
    c.height = C.H * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const r = U.rng(77);
    // parchment
    const gr = g.createRadialGradient(C.W / 2, C.H / 2, 100, C.W / 2, C.H / 2, 620);
    gr.addColorStop(0, '#fcf1d4');
    gr.addColorStop(1, '#e8cf9c');
    g.fillStyle = gr;
    g.fillRect(0, 0, C.W, C.H);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(160,110,50,0.05)' : 'rgba(255,255,255,0.08)';
      g.fillRect(r() * C.W, r() * C.H, 2 + r() * 3, 1 + r() * 2);
    }
    // regions
    const blob = (cx, cy, rx, ry, col) => {
      g.beginPath();
      for (let a = 0; a <= TAU + 0.01; a += 0.25) {
        const k = 1 + Math.sin(a * 3 + cx) * 0.08 + Math.sin(a * 5 + cy) * 0.05;
        g.lineTo(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
      }
      g.closePath();
      g.fillStyle = col;
      g.fill();
      g.setLineDash([4, 6]);
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(59,42,30,0.35)';
      g.stroke();
      g.setLineDash([]);
    };
    blob(170, 290, 150, 140, 'rgba(160,210,120,0.45)');
    blob(440, 260, 140, 130, 'rgba(110,150,90,0.4)');
    blob(740, 160, 200, 120, 'rgba(150,150,200,0.38)');
    // river
    g.strokeStyle = 'rgba(95,182,224,0.7)';
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-10, 470);
    g.bezierCurveTo(200, 430, 330, 470, 400, 400);
    g.bezierCurveTo(460, 340, 620, 380, 980, 330);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 2;
    g.stroke();
    // little drawings: flowers, trees, mountains
    for (let i = 0; i < 26; i++) {
      const x = 40 + r() * 260;
      const y = 180 + r() * 220;
      g.fillStyle = ['#f59ab0', '#ffd84d', '#ffffff'][i % 3];
      g.beginPath();
      g.arc(x, y, 3, 0, TAU);
      g.fill();
    }
    for (let i = 0; i < 22; i++) {
      const x = 330 + r() * 230;
      const y = 150 + r() * 220;
      g.fillStyle = '#5b8a4e';
      g.strokeStyle = 'rgba(59,42,30,0.6)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x - 9, y + 8);
      g.lineTo(x, y - 14);
      g.lineTo(x + 9, y + 8);
      g.closePath();
      g.fill();
      g.stroke();
    }
    for (let i = 0; i < 9; i++) {
      const x = 580 + i * 42 + r() * 20;
      const y = 120 + (i % 3) * 40 + r() * 30;
      const s = 24 + r() * 18;
      g.beginPath();
      g.moveTo(x - s, y + s * 0.6);
      g.lineTo(x, y - s * 0.8);
      g.lineTo(x + s, y + s * 0.6);
      g.closePath();
      g.fillStyle = '#9a96c4';
      g.fill();
      g.strokeStyle = 'rgba(59,42,30,0.55)';
      g.lineWidth = 1.5;
      g.stroke();
      g.beginPath();
      g.moveTo(x - s * 0.32, y - s * 0.25);
      g.lineTo(x, y - s * 0.8);
      g.lineTo(x + s * 0.32, y - s * 0.25);
      g.lineTo(x + s * 0.1, y - s * 0.15);
      g.lineTo(x - s * 0.1, y - s * 0.3);
      g.closePath();
      g.fillStyle = '#fff';
      g.fill();
    }
    // Pip's cottage at the start
    g.fillStyle = '#e2533c';
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(26, 400);
    g.lineTo(52, 376);
    g.lineTo(78, 400);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#fdf4dc';
    g.fillRect(32, 400, 40, 26);
    g.strokeRect(32, 400, 40, 26);
    g.fillStyle = '#9a6a42';
    g.fillRect(46, 410, 12, 16);
    // the dotted path
    g.setLineDash([2, 9]);
    g.lineCap = 'round';
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(59,42,30,0.55)';
    g.beginPath();
    g.moveTo(60, 410);
    for (let v = 0; v <= NODES.length - 1; v += 0.05) {
      const [x, y] = pathAt(v);
      g.lineTo(x, y);
    }
    g.stroke();
    g.setLineDash([]);
    // compass rose
    g.save();
    g.translate(905, 340);
    g.fillStyle = 'rgba(59,42,30,0.6)';
    for (let k = 0; k < 4; k++) {
      g.rotate(Math.PI / 2);
      g.beginPath();
      g.moveTo(0, -30);
      g.lineTo(6, 0);
      g.lineTo(-6, 0);
      g.closePath();
      g.fill();
    }
    g.restore();
    G.text(g, 'N', 905, 298, 14, INK, 'center', 700);
    // chapter names
    LEVELS.CHAPTERS.forEach((name, i) => {
      const [x, y] = [[150, 146], [440, 120], [730, 268]][i];
      g.save();
      g.translate(x, y);
      g.rotate([-0.06, 0.04, -0.03][i]);
      G.text(g, name, 0, 0, 20, 'rgba(59,42,30,0.75)', 'center', 700);
      g.restore();
    });
    // torn page edge
    g.strokeStyle = 'rgba(120,80,30,0.45)';
    g.lineWidth = 10;
    g.strokeRect(5, 5, C.W - 10, C.H - 10);
    mapCache = c;
    return c;
  }

  function drawIris(ctx, g) {
    const ir = g.iris;
    if (!ir) return;
    const k = ir.phase === 'close' ? U.easeInOut(U.clamp01(ir.t / 0.3)) : 1 - U.easeInOut(U.clamp01(ir.t / 0.4));
    if (k <= 0) return;
    const R = Math.hypot(C.W, C.H) * 0.6 * (1 - k);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, C.W, C.H);
    ctx.arc(C.W / 2, C.H / 2, Math.max(0, R), 0, TAU, true);
    ctx.fillStyle = '#2b1e15';
    ctx.fill('evenodd');
    if (R > 1) {
      ctx.beginPath();
      ctx.arc(C.W / 2, C.H / 2, R, 0, TAU);
      ctx.lineWidth = 8;
      ctx.strokeStyle = COL.gold;
      ctx.stroke();
    }
    ctx.restore();
  }

  function dim(ctx, a) {
    ctx.fillStyle = `rgba(43,30,21,${a})`;
    ctx.fillRect(0, 0, C.W, C.H);
  }

  function heading(ctx, str, x, y, size = 30, align = 'left', color = INK) {
    G.text(ctx, str, x, y, size, color, align, 700);
  }

  const UI = {
    iris: drawIris,
    mapPage,

    // ---------- cover ----------
    title(ctx, g) {
      const k = enter(g, 0, 0.5);
      // a paper banner behind the title
      ctx.save();
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(253,244,220,0.0)';
      ctx.restore();
      bouncyTitle(ctx, g, 'Borrowed', 60, 92, 64, '#fff3dd', k);
      bouncyTitle(ctx, g, 'Boots', 96, 160, 74, COL.red, k);
      ctx.save();
      ctx.globalAlpha = enter(g, 0.5, 0.4);
      G.text(ctx, 'A storybook platformer. No powers. Lots of friends.', 64, 214, 16, INK, 'left', 800, { body: true, outline: 5, outlineColor: 'rgba(255,248,232,0.9)' });
      ctx.restore();
      list(ctx, g, g.menu().items, 60, 246, 330);
      footer(ctx, [['confirm', 'Choose'], ['pick', 'Move']]);
      G.text(ctx, 'v2', C.W - 18, 18, 12, 'rgba(59,42,30,0.5)', 'right', 700);
    },

    // ---------- the shelf of three storybooks ----------
    slots(ctx, g) {
      dim(ctx, 0.35 * enter(g, 0, 0.25));
      heading(ctx, 'Choose a storybook', C.W / 2, 60, 34, 'center', '#fff3dd');
      const bw = 220;
      const bh = 290;
      const gap = 40;
      const ox = (C.W - (bw * 3 + gap * 2)) / 2;
      const COVERS = [['#e2533c', '#a8331f'], ['#5fb86a', '#2f7a43'], ['#5f8fd0', '#35609c']];
      for (let i = 0; i < 3; i++) {
        const b = g.save.slots[i];
        const sel = g.slotSel === i;
        const kk = pop(g, 0.05 + i * 0.08);
        const x = ox + i * (bw + gap);
        const lift = sel ? -14 - (g.settings.motion ? Math.sin(g.time * 3) * 3 : 0) : 0;
        const y = 110 + lift + (1 - kk) * 80;
        ctx.save();
        ctx.globalAlpha = U.clamp01(kk);
        // shadow
        ctx.fillStyle = 'rgba(30,20,10,0.35)';
        ctx.beginPath();
        ctx.ellipse(x + bw / 2, 420, bw * 0.45 * (sel ? 0.85 : 1), 12, 0, 0, TAU);
        ctx.fill();
        // pages (the 3D thickness of the book)
        G.rr(ctx, x + 10, y + 10, bw, bh, 10);
        ctx.fillStyle = '#efe2c2';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = INK;
        ctx.stroke();
        for (let l = 0; l < 4; l++) {
          ctx.strokeStyle = 'rgba(59,42,30,0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + bw + 2 + l * 2, y + 14);
          ctx.lineTo(x + bw + 2 + l * 2, y + bh + 6);
          ctx.stroke();
        }
        // cover
        G.rr(ctx, x, y, bw, bh, 12);
        ctx.fillStyle = COVERS[i][0];
        ctx.fill();
        ctx.lineWidth = sel ? 4 : 3;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.fillStyle = COVERS[i][1];
        ctx.fillRect(x + 14, y, 10, bh);
        G.rr(ctx, x + 38, y + 24, bw - 60, bh - 48, 10);
        ctx.fillStyle = 'rgba(253,244,220,0.94)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
        const cx = x + 38 + (bw - 60) / 2;
        G.text(ctx, 'Book ' + (i + 1), cx, y + 54, 24, INK, 'center', 700);
        if (b) {
          const stars = g.bookStars(b);
          const page = Math.min(b.unlocked, 12);
          BB.drawHero(ctx, cx, y + 150, 46, { face: 1, t: g.time, blink: BB.blink(g.time, i), ground: true, sq: 1 + Math.sin(g.time * 3 + i) * 0.03 });
          G.text(ctx, 'Page ' + page + ' of 12', cx, y + 180, 15, COL.inkSoft, 'center', 800, { body: true });
          G.star(ctx, cx - 30, y + 206, 9, COL.gold, INK, 1.8);
          G.text(ctx, stars + ' / 36', cx - 16, y + 207, 16, INK, 'left', 700);
          const mins = Math.floor(b.playTime / 60);
          G.text(ctx, mins < 1 ? 'just started' : mins + ' min played', cx, y + 232, 13, COL.faint, 'center', 800, { body: true });
        } else {
          G.text(ctx, '+', cx, y + 135, 60, COL.faint, 'center', 700);
          G.text(ctx, 'A new story', cx, y + 190, 16, COL.inkSoft, 'center', 800, { body: true });
        }
        ctx.restore();
        g.buttons.push({ x, y, w: bw, h: bh, hover: () => (g.slotSel = i), action: () => g.openBook(i) });
        if (b && sel) {
          const label = g.confirmErase === i ? 'Sure? Tap again' : 'Erase';
          tagButton(ctx, g, label, x + 40, y + bh + 22, bw - 80, 34, () => g.eraseBook(i), { size: 14, color: g.confirmErase === i ? COL.red : COL.inkSoft });
        }
      }
      tagButton(ctx, g, '‹ Back', 28, 22, 100, 38, () => g.go(() => g.goTitle()), { size: 16 });
      footer(ctx, g.save.slots[g.slotSel] ? [['confirm', 'Open'], ['erase', g.confirmErase === g.slotSel ? 'Erase: press again' : 'Erase'], ['back', 'Back']] : [['confirm', 'Begin'], ['back', 'Back']]);
    },

    // ---------- story map ----------
    map(ctx, g) {
      ctx.drawImage(mapPage(), 0, 0, C.W, C.H);
      const b = g.book;
      const max = Math.min(b.unlocked, LEVELS.length);
      // nodes
      NODES.forEach(([x, y], i) => {
        const open = i < max;
        const rec = b.levels[i];
        const sel = g.mapSel === i;
        const k = pop(g, 0.05 + i * 0.03);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(k * (sel ? 1.12 : 1), k * (sel ? 1.12 : 1));
        ctx.fillStyle = 'rgba(59,42,30,0.25)';
        ctx.beginPath();
        ctx.ellipse(2, 18, 20, 6, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, 19, 0, TAU);
        ctx.fillStyle = open ? (rec ? '#fffaf0' : '#fff3b0') : '#d8c9a8';
        ctx.fill();
        ctx.lineWidth = sel ? 4 : 2.5;
        ctx.strokeStyle = sel ? COL.red : INK;
        ctx.stroke();
        if (open) G.text(ctx, String(i + 1), 0, 1, 18, INK, 'center', 700);
        else {
          // a little padlock
          ctx.strokeStyle = COL.inkSoft;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, -3, 5, Math.PI, 0);
          ctx.stroke();
          ctx.fillStyle = COL.inkSoft;
          ctx.fillRect(-7, -3, 14, 10);
        }
        if (rec) for (let s = 0; s < 3; s++) G.star(ctx, -14 + s * 14, -26 - (s === 1 ? 4 : 0), 6.5, s < rec.stars ? COL.gold : 'rgba(255,255,255,0.7)', INK, 1.5);
        ctx.restore();
        g.buttons.push({ x: x - 24, y: y - 24, w: 48, h: 48, action: () => (open ? (g.mapSel === i ? g.playSelected() : (g.mapSel = i)) : BB.Audio.play('denied')) });
      });
      // Pip walking the path
      const [tx, ty] = pathAt(g.token);
      const walking = Math.abs(g.mapSel - g.token) > 0.01;
      BB.drawHero(ctx, tx, ty - 14, 34, { face: g.mapSel >= g.token ? 1 : -1, t: g.time, blink: BB.blink(g.time), ground: true, run: walking ? 1 : 0, phase: g.time * 14, scarf: walking ? 1 : 0.2 });

      // title cartouche
      G.card(ctx, 24, 18, 250, 52, { r: 14 });
      G.text(ctx, 'The Story So Far', 149, 45, 22, INK, 'center', 700);
      // info card for the chosen page
      const def = LEVELS[g.mapSel];
      const rec = b.levels[g.mapSel];
      const cw = 560;
      const cx = 24;
      const cy = 428;
      G.card(ctx, cx, cy, cw, 92, { r: 16 });
      G.text(ctx, 'Page ' + (g.mapSel + 1) + ' · ' + LEVELS.CHAPTERS[def.chapter], cx + 22, cy + 24, 13, COL.inkSoft, 'left', 800, { body: true });
      G.text(ctx, def.name, cx + 22, cy + 52, 26, INK, 'left', 700);
      const types = [...new Set(def.map.join('').replace(/[^bgot]/g, ''))];
      types.forEach((ch, i) => BB.drawBadge(ctx, ch, cx + cw - 200 - i * 36, cy + 30, 14, g.time));
      for (let s = 0; s < 3; s++) G.star(ctx, cx + cw - 128 + s * 26, cy + 30, 10, rec && rec.stars > s ? COL.gold : 'rgba(59,42,30,0.12)', INK, 1.8);
      G.text(ctx, rec && rec.best !== undefined ? 'best ' + rec.best.toFixed(1) + 's' : 'not read yet', cx + cw - 22, cy + 62, 14, COL.inkSoft, 'right', 800, { body: true });
      tagButton(ctx, g, 'Read this page', 604, 436, 200, 44, () => g.playSelected(), { fill: '#fff3b0' });
      tagButton(ctx, g, 'Creatures', 816, 436, 120, 44, () => g.openCodex(0), { size: 15 });
      tagButton(ctx, g, '‹ Books', 816, 22, 120, 40, () => g.go(() => g.setState('slots')), { size: 15 });
      if (I.device !== 'touch') {
        ctx.save();
        ctx.globalAlpha = 0.9;
        prompt(ctx, 'pick', 'Walk', 604, 505);
        prompt(ctx, 'codex', 'Creatures', 720, 505);
        ctx.restore();
      }
    },

    // ---------- the Creature Book ----------
    codex(ctx, g) {
      dim(ctx, 0.55 * enter(g, 0, 0.2));
      const k = pop(g, 0, 0.35);
      const x = 40;
      const y = 72;
      const w = 880;
      const h = 420;
      ctx.save();
      ctx.translate(C.W / 2, C.H / 2);
      ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
      ctx.translate(-C.W / 2, -C.H / 2);
      ctx.globalAlpha = U.clamp01(k);
      // tabs
      const TABS = ['Pip', 'Hopsy', 'Moss', 'Hush', 'Bramble', 'Things'];
      TABS.forEach((t, i) => {
        const tx = x + 30 + i * 112;
        const on = g.codexPage === i;
        const col = i === 0 ? COL.red : i === 5 ? '#c8a860' : BB.POWERS[BB.ORDER[i - 1]].color;
        G.rr(ctx, tx, y - (on ? 38 : 30), 104, 48, 12);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = INK;
        ctx.stroke();
        const open = g.codexUnlocked(i);
        G.text(ctx, open ? t : '?', tx + 52, y - (on ? 20 : 14), 16, '#fffaf0', 'center', 700, { outline: 4 });
        g.buttons.push({ x: tx, y: y - 40, w: 104, h: 40, action: () => { if (g.codexPage !== i) { const p = g.codexPage; g.codexPage = i; g.flipPage(p); } } });
      });
      // the open book
      G.rr(ctx, x - 10, y - 6, w + 20, h + 20, 20);
      ctx.fillStyle = '#7a4a2e';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      for (const side of [0, 1]) {
        G.rr(ctx, x + side * (w / 2), y, w / 2, h, side ? [4, 16, 16, 4] : [16, 4, 4, 16]);
        ctx.fillStyle = side ? '#fdf6e2' : '#f8edd2';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      const spine = ctx.createLinearGradient(x + w / 2 - 30, 0, x + w / 2 + 30, 0);
      spine.addColorStop(0, 'rgba(0,0,0,0)');
      spine.addColorStop(0.5, 'rgba(90,60,30,0.25)');
      spine.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = spine;
      ctx.fillRect(x + w / 2 - 30, y, 60, h);

      // page content (slides in on a flip)
      g.codexFlip = Math.min(1, (g.codexFlip === undefined ? 1 : g.codexFlip) + 1 / 20);
      const fk = U.easeOut(g.codexFlip);
      const dir = g.codexPage > g.codexFrom ? 1 : -1;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.globalAlpha *= fk;
      ctx.translate((1 - fk) * 40 * dir, 0);
      this.codexPage(ctx, g, g.codexPage, x, y, w, h);
      ctx.restore();
      ctx.restore();
      tagButton(ctx, g, '‹', x + 6, y + h - 54, 44, 44, () => { if (g.codexPage > 0) { const p = g.codexPage; g.codexPage--; g.flipPage(p); } }, { size: 24 });
      tagButton(ctx, g, '›', x + w - 50, y + h - 54, 44, 44, () => { if (g.codexPage < 5) { const p = g.codexPage; g.codexPage++; g.flipPage(p); } }, { size: 24 });
      tagButton(ctx, g, 'Close', C.W - 140, 18, 110, 38, () => g.closeSub(), { size: 15 });
      footer(ctx, [['back', 'Close'], ['pick', 'Turn page']], C.H - 18);
    },

    codexPage(ctx, g, page, x, y, w, h) {
      const lx = x + w / 4;
      const rx = x + w / 2 + 36;
      const tw = w / 2 - 72;
      const stage = (fill) => {
        // a little paper stage with a spotlight
        ctx.fillStyle = 'rgba(255,240,190,0.55)';
        ctx.beginPath();
        ctx.ellipse(lx, y + 250, 150, 120, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.ellipse(lx, y + 300, 140, 26, 0, 0, TAU);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = INK;
        ctx.stroke();
      };
      const body = (lines, y0) => {
        let yy = y0;
        for (const para of lines) {
          for (const l of G.wrap(ctx, para, tw, 16, 700)) {
            G.text(ctx, l, rx, yy, 16, COL.inkSoft, 'left', 700, { body: true });
            yy += 23;
          }
          yy += 10;
        }
      };
      if (page === 0) {
        stage('#b5e27d');
        const t = g.time;
        BB.drawHero(ctx, lx, y + 300 - Math.abs(Math.sin(t * 2.5)) * 26, 120, { face: 1, t, blink: BB.blink(t), ground: Math.abs(Math.sin(t * 2.5)) < 0.15, sq: 1 + Math.sin(t * 5) * 0.04, run: 0, vy: -Math.cos(t * 2.5) * 6, scarf: 0.4 });
        G.text(ctx, 'Pip', rx, y + 48, 34, INK, 'left', 700);
        G.text(ctx, 'THE HERO · NO POWERS AT ALL', rx, y + 80, 12, COL.red, 'left', 800, { body: true });
        body(['Pip can run and hop, and that is all. Everything else is borrowed.', 'Land on top of a creature to borrow its trick. You can only hold one at a time: a new one replaces the old.', 'Bump into a thistle or a creature from the side and the trick falls off. With no trick, you go back to your last bookmark.'], y + 118);
        return;
      }
      if (page === 5) {
        G.text(ctx, 'Things in the story', x + 36, y + 48, 30, INK, 'left', 700);
        const rows = [
          ['star', 'Star charms', 'Three on every page. Collect them all for a full page.'],
          ['thorn', 'Thistles', 'Sharp! They knock off your trick, or send you back.'],
          ['crack', 'Cracked stone', 'Only something heavy can break it.'],
          ['mark', 'Bookmarks', 'Touch one and you start again from here.'],
          ['flag', 'The red pennant', 'The end of the page.'],
        ];
        rows.forEach(([icon, name, txt], i) => {
          const col = i < 3 ? 0 : 1;
          const ry = y + 104 + (i % 3) * 96;
          const ix = col ? rx - 6 : x + 56;
          const ic = ix + 22;
          if (icon === 'star') BB.charm(ctx, ic, ry + 4, g.time + i);
          else if (icon === 'thorn') {
            for (let k = 0; k < 3; k++) {
              ctx.beginPath();
              ctx.moveTo(ic - 18 + k * 12, ry + 18);
              ctx.lineTo(ic - 12 + k * 12, ry - 10);
              ctx.lineTo(ic - 6 + k * 12, ry + 18);
              ctx.closePath();
              ctx.fillStyle = '#b57acb';
              ctx.fill();
              ctx.lineWidth = 2;
              ctx.strokeStyle = INK;
              ctx.stroke();
            }
          } else if (icon === 'crack') {
            ctx.fillStyle = '#cdbca3';
            ctx.fillRect(ic - 18, ry - 14, 36, 32);
            ctx.lineWidth = 2;
            ctx.strokeStyle = INK;
            ctx.strokeRect(ic - 18, ry - 14, 36, 32);
            ctx.beginPath();
            ctx.moveTo(ic - 6, ry - 14);
            ctx.lineTo(ic + 2, ry);
            ctx.lineTo(ic - 4, ry + 18);
            ctx.stroke();
          } else if (icon === 'mark') {
            ctx.fillStyle = COL.red;
            ctx.beginPath();
            ctx.moveTo(ic - 10, ry - 18);
            ctx.lineTo(ic + 10, ry - 18);
            ctx.lineTo(ic + 10, ry + 18);
            ctx.lineTo(ic, ry + 10);
            ctx.lineTo(ic - 10, ry + 18);
            ctx.closePath();
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = INK;
            ctx.stroke();
          } else {
            ctx.fillStyle = '#7a5236';
            ctx.fillRect(ic - 14, ry - 22, 5, 44);
            ctx.fillStyle = COL.red;
            ctx.beginPath();
            ctx.moveTo(ic - 9, ry - 22);
            ctx.lineTo(ic + 20, ry - 12 + Math.sin(g.time * 5) * 3);
            ctx.lineTo(ic - 9, ry - 2);
            ctx.closePath();
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = INK;
            ctx.stroke();
          }
          G.text(ctx, name, ix + 56, ry - 10, 19, INK, 'left', 700);
          const ls = G.wrap(ctx, txt, 300, 14, 700);
          ls.forEach((l, j) => G.text(ctx, l, ix + 56, ry + 14 + j * 19, 14, COL.inkSoft, 'left', 700, { body: true }));
        });
        return;
      }
      const ch = BB.ORDER[page - 1];
      const pw = BB.POWERS[ch];
      const open = g.codexUnlocked(page);
      stage(open ? pw.belly : '#e8dcc0');
      if (open) {
        BB.drawCreature(ctx, ch, lx + Math.sin(g.time * 0.8) * 30, y + 300, 150, { dir: Math.cos(g.time * 0.8) > 0 ? 1 : -1, t: g.time, seed: page });
        G.text(ctx, pw.creature, rx, y + 48, 34, INK, 'left', 700);
        G.text(ctx, pw.kind.toUpperCase() + ' · LENDS ' + pw.name.toUpperCase(), rx, y + 80, 12, pw.dark, 'left', 800, { body: true });
        BB.drawBadge(ctx, ch, rx + tw - 20, y + 46, 24, g.time);
        body([pw.how, 'Tip: ' + pw.tip, 'First met on page ' + (BB.FIRST[ch] + 1) + ', ' + LEVELS[BB.FIRST[ch]].name + '.'], y + 118);
      } else {
        ctx.save();
        ctx.globalAlpha *= 0.85;
        ctx.filter = 'none';
        BB.drawCreature(ctx, ch, lx, y + 300, 150, { dir: 1, t: 0, seed: page });
        ctx.globalCompositeOperation = 'source-atop';
        ctx.restore();
        // cover it with a paper silhouette
        ctx.fillStyle = 'rgba(232,220,192,0.92)';
        ctx.fillRect(lx - 140, y + 120, 280, 170);
        G.text(ctx, '?', lx, y + 210, 90, 'rgba(59,42,30,0.25)', 'center', 700);
        G.text(ctx, 'Not met yet', rx, y + 48, 30, INK, 'left', 700);
        body(['Someone lives on page ' + (BB.FIRST[ch] + 1) + '. Keep reading to meet them.'], y + 100);
      }
    },

    // ---------- how to play ----------
    help(ctx, g) {
      dim(ctx, 0.55 * enter(g, 0, 0.2));
      const w = 760;
      const h = 430;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2;
      const k = pop(g);
      ctx.save();
      ctx.translate(C.W / 2, C.H / 2);
      ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k);
      ctx.translate(-C.W / 2, -C.H / 2);
      ctx.globalAlpha = U.clamp01(k);
      G.card(ctx, x, y, w, h, { r: 22 });
      heading(ctx, 'How to play', x + 32, y + 42, 30);
      const cols = [x + 32, x + 230, x + 400, x + 560];
      ['', 'KEYBOARD', 'GAMEPAD', 'TOUCH'].forEach((s, i) => G.text(ctx, s, cols[i], y + 84, 12, COL.red, 'left', 800, { body: true }));
      const rows = [
        ['Run', 'A D or ← →', 'Stick / D-pad', 'Left two buttons'],
        ['Hop', 'Space, W or ↑', 'A', 'Boot button'],
        ['Glide (owl)', 'Hold hop in the air', 'Hold A', 'Hold boot'],
        ['Climb (gecko)', 'Push into a wall', 'Push into a wall', 'Push into a wall'],
        ['Pause', 'Esc or P', 'Start', 'Top-right button'],
        ['Start page again', 'R', 'Y', 'Pause menu'],
      ];
      rows.forEach((r, i) => {
        const ry = y + 112 + i * 27;
        r.forEach((s, j) => G.text(ctx, s, cols[j], ry, 15, j ? COL.inkSoft : INK, 'left', j ? 700 : 700, { body: j > 0 }));
      });
      ctx.fillStyle = 'rgba(59,42,30,0.2)';
      ctx.fillRect(x + 32, y + 280, w - 64, 2);
      const tips = [
        'Land on top of a creature to borrow its trick. One at a time.',
        'Get bumped and the trick falls off. With no trick, back to the bookmark.',
        'Every page has three star charms. Find them all for a full page.',
      ];
      tips.forEach((s, i) => {
        G.star(ctx, x + 44, y + 306 + i * 28, 7, COL.gold, INK, 1.5);
        G.text(ctx, s, x + 60, y + 307 + i * 28, 15, INK, 'left', 700, { body: true });
      });
      ctx.restore();
      list(ctx, g, g.menu().items, x + w - 200, y + 22, 170);
    },

    // ---------- settings ----------
    settings(ctx, g) {
      dim(ctx, 0.5 * enter(g, 0, 0.2));
      const items = g.menu().items;
      const w = 520;
      const h = 96 + items.length * ROW;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2;
      const k = pop(g);
      ctx.save();
      ctx.translate(C.W / 2, C.H / 2);
      ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k);
      ctx.translate(-C.W / 2, -C.H / 2);
      ctx.globalAlpha = U.clamp01(k);
      G.card(ctx, x, y, w, h, { r: 22 });
      heading(ctx, 'Settings', x + 34, y + 44, 30);
      ctx.restore();
      list(ctx, g, items, x + 30, y + 76, w - 60);
      footer(ctx, [['back', 'Back'], ['pick', 'Change']]);
    },

    // ---------- pause ----------
    paused(ctx, g) {
      dim(ctx, 0.5 * enter(g, 0, 0.15));
      const items = g.menu().items;
      const w = 400;
      const h = 110 + items.length * ROW;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2;
      const k = pop(g);
      ctx.save();
      ctx.globalAlpha = U.clamp01(k);
      ctx.translate(C.W / 2, C.H / 2);
      ctx.rotate((1 - k) * -0.05);
      ctx.translate(-C.W / 2, -C.H / 2);
      G.card(ctx, x, y, w, h, { r: 22 });
      G.text(ctx, 'Page ' + (g.levelIndex + 1) + ' · ' + LEVELS[g.levelIndex].name, x + 34, y + 30, 14, COL.inkSoft, 'left', 800, { body: true });
      heading(ctx, 'Taking a breather', x + 34, y + 62, 28);
      ctx.restore();
      list(ctx, g, items, x + 30, y + 90, w - 60);
      footer(ctx, [['back', 'Keep going'], ['restart', 'Restart']]);
    },

    // ---------- end of the page ----------
    won(ctx, g) {
      const r = g.result;
      const a = U.clamp01(r.t / 0.4);
      dim(ctx, 0.45 * a);
      const items = g.menu().items;
      const w = 460;
      const h = 250 + items.length * ROW;
      const x = (C.W - w) / 2;
      const y = (C.H - h) / 2 + (1 - U.easeOut(a)) * 40;
      ctx.save();
      ctx.globalAlpha = a;
      G.card(ctx, x, y, w, h, { r: 24 });
      const last = g.levelIndex + 1 >= LEVELS.length;
      G.text(ctx, last ? 'THE END' : 'PAGE ' + (g.levelIndex + 1) + ' COMPLETE', C.W / 2, y + 34, 14, COL.red, 'center', 800, { body: true });
      G.text(ctx, LEVELS[g.levelIndex].name, C.W / 2, y + 68, 32, INK, 'center', 700);
      for (let i = 0; i < 3; i++) {
        const kk = U.clamp01((r.t - (0.5 + i * 0.3)) / 0.35);
        const lit = i < r.stars;
        if (lit && kk > 0 && r.popped <= i) {
          r.popped = i + 1;
          BB.Audio.play('starPop', i);
        }
        const s = lit ? U.easeBack(kk) : 1;
        ctx.save();
        ctx.translate(C.W / 2 - 70 + i * 70, y + 128 - (i === 1 ? 10 : 0));
        ctx.rotate((1 - kk) * (lit ? 1.5 : 0));
        G.star(ctx, 0, 0, 26, 'rgba(59,42,30,0.12)', 'rgba(59,42,30,0.3)', 2);
        if (lit && kk > 0) {
          ctx.scale(s, s);
          G.star(ctx, 0, 0, 26, COL.gold, INK, 3);
          G.star(ctx, -5, -6, 9, 'rgba(255,255,255,0.6)');
        }
        ctx.restore();
      }
      G.text(ctx, r.stars + ' of ' + r.total + ' star charms', C.W / 2, y + 178, 16, INK, 'center', 800, { body: true });
      const oops = r.deaths === 0 ? 'no oopsies' : r.deaths + (r.deaths === 1 ? ' oopsie' : ' oopsies');
      G.text(ctx, r.time.toFixed(1) + 's  ·  ' + oops + (r.newBest ? '  ·  new best!' : ''), C.W / 2, y + 204, 15, r.newBest ? COL.redDark : COL.inkSoft, 'center', 800, { body: true });
      if (r.unlockedNew) G.text(ctx, 'A new page is open on the map', C.W / 2, y + 228, 13, COL.leaf, 'center', 800, { body: true });
      ctx.restore();
      if (r.t > 1.2) list(ctx, g, items, x + 50, y + 244, w - 100);
    },

    // ---------- HUD ----------
    hud(ctx, g) {
      const s = g.sim;
      const def = LEVELS[g.levelIndex];
      // page tag, top left
      G.card(ctx, 14, 12, 270, 44, { r: 14, plain: true, lw: 2.5 });
      G.rr(ctx, 14, 12, 50, 44, [14, 0, 0, 14]);
      ctx.fillStyle = COL.red;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      G.text(ctx, String(g.levelIndex + 1), 39, 35, 22, '#fffaf0', 'center', 700, { outline: 4 });
      G.text(ctx, def.name, 76, 35, 19, INK, 'left', 700, { maxWidth: 200 });
      // star slots, top centre
      for (let i = 0; i < s.stars.length; i++) {
        const sx = C.W / 2 - 38 + i * 38;
        const got = i < s.got;
        G.star(ctx, sx, 34, 15, got ? COL.gold : 'rgba(253,244,220,0.8)', INK, 2.5);
        if (got) G.star(ctx, sx - 3, 30, 5, 'rgba(255,255,255,0.7)');
      }
      // stars flying up to their slot
      for (const f of g.fx) {
        if (f.k !== 'flystar') continue;
        const k = U.easeInOut(U.clamp01(f.t / 0.7));
        const tx = C.W / 2 - 38 + f.slot * 38;
        const x = U.lerp(f.x, tx, k);
        const y = U.lerp(f.y, 34, k) - Math.sin(k * Math.PI) * 60;
        BB.charm(ctx, x, y, g.time * 3, 1 - k * 0.3);
      }
      // pause button, top right
      const px = C.W - 40;
      ctx.beginPath();
      ctx.arc(px, 34, 22, 0, TAU);
      ctx.fillStyle = COL.paper;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.fillRect(px - 8, 25, 5, 18);
      ctx.fillRect(px + 3, 25, 5, 18);
      g.buttons.push({ x: px - 30, y: 4, w: 60, h: 60, action: () => g.pause() });
      // borrowed trick, bottom left (moved up on touch so thumbs don't hide it)
      const p = s.p;
      const bx = I.touchOn ? 300 : 44;
      const by = I.touchOn ? C.H - 50 : C.H - 46;
      BB.drawBadge(ctx, p.power, bx, by, 28, g.time);
      const pw = p.power ? BB.POWERS[p.power] : null;
      G.text(ctx, pw ? pw.name : 'No trick', bx + 40, by - 9, 19, INK, 'left', 700, { outline: 5, outlineColor: 'rgba(255,248,232,0.9)' });
      G.text(ctx, pw ? pw.hint : 'Land on a creature to borrow one', bx + 40, by + 13, 13, COL.inkSoft, 'left', 800, { body: true, outline: 4, outlineColor: 'rgba(255,248,232,0.9)' });
      if (I.device !== 'touch') footer(ctx, [['pause', 'Pause'], ['restart', 'Restart']], C.H - 26);
      // the page banner and tip, at the start
      const it = g.introT;
      if (it < 4.2) {
        const k = U.easeOut(U.clamp01(it / 0.4)) * U.clamp01((4.2 - it) / 0.5);
        ctx.save();
        ctx.globalAlpha = k;
        const label = LEVELS.CHAPTERS[def.chapter] + ' · page ' + (g.levelIndex + 1);
        const tw = Math.max(G.measure(ctx, def.name, 30, 700), 260) + 70;
        const yy = 90 + (1 - k) * -20;
        G.card(ctx, (C.W - tw) / 2, yy, tw, 74, { r: 18 });
        G.text(ctx, label, C.W / 2, yy + 22, 13, COL.inkSoft, 'center', 800, { body: true });
        G.text(ctx, def.name, C.W / 2, yy + 50, 30, INK, 'center', 700);
        if (g.settings.tips) {
          const tip = BB.tipText(def.tip);
          const ww = G.measure(ctx, tip, 16, 800, true) + 40;
          G.rr(ctx, (C.W - ww) / 2, yy + 88, ww, 34, 17);
          ctx.fillStyle = 'rgba(59,42,30,0.82)';
          ctx.fill();
          G.text(ctx, tip, C.W / 2, yy + 106, 16, '#fff3dd', 'center', 800, { body: true });
        }
        ctx.restore();
      }
    },

    touch(ctx, g) {
      if (!I.touchOn) return;
      const B = I.TOUCH;
      for (const [name, b] of Object.entries(B)) {
        const down = I.down.has(b.code);
        ctx.save();
        ctx.globalAlpha = down ? 0.95 : 0.6;
        ctx.beginPath();
        ctx.arc(b.x + 2, b.y + 5, b.r, 0, TAU);
        ctx.fillStyle = 'rgba(59,42,30,0.35)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x, b.y + (down ? 3 : 0), b.r * (down ? 0.95 : 1), 0, TAU);
        ctx.fillStyle = name === 'jump' ? (g.sim && g.sim.p.power ? BB.POWERS[g.sim.p.power].color : COL.red) : COL.paper;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = INK;
        ctx.stroke();
        const cy = b.y + (down ? 3 : 0);
        ctx.fillStyle = INK;
        if (name === 'jump') {
          // a boot
          ctx.fillStyle = '#fffaf0';
          ctx.beginPath();
          ctx.moveTo(b.x - 12, cy - 18);
          ctx.lineTo(b.x - 12, cy + 10);
          ctx.lineTo(b.x + 18, cy + 10);
          ctx.quadraticCurveTo(b.x + 18, cy - 2, b.x + 4, cy - 4);
          ctx.lineTo(b.x + 4, cy - 18);
          ctx.closePath();
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.stroke();
        } else {
          const d = name === 'left' ? -1 : 1;
          ctx.beginPath();
          ctx.moveTo(b.x + d * 14, cy);
          ctx.lineTo(b.x - d * 8, cy - 14);
          ctx.lineTo(b.x - d * 8, cy + 14);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    },

    toast(ctx, g) {
      const m = g.toastMsg;
      if (!m) return;
      const k = U.clamp01(m.life / 0.3) * U.clamp01((m.max - m.life) / 0.2);
      ctx.save();
      ctx.globalAlpha = k;
      const w = G.measure(ctx, m.str, 16, 800, true) + 44;
      const y = g.state === 'play' ? C.H - 120 : 70;
      G.rr(ctx, (C.W - w) / 2, y - 18, w, 36, 18);
      ctx.fillStyle = 'rgba(59,42,30,0.88)';
      ctx.fill();
      G.text(ctx, m.str, C.W / 2, y + 1, 16, '#fff3dd', 'center', 800, { body: true });
      ctx.restore();
    },
  };

  BB.UI = UI;
})();
