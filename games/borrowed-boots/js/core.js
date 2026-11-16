// Borrowed Boots: shared constants and small drawing helpers. Everything is
// drawn on one canvas in logical 960x540 px (see main.js for scaling).
window.BB = window.BB || {};
(function () {
  const CFG = {
    W: 960,
    H: 540,
    T: 40, // one tile, in logical px
    STEP: 1 / 60, // fixed simulation step (the level checker uses the same)
    DEPTH: 9, // how far the paper terrain is extruded "into" the page
    FONT: '"Sniglet", "Trebuchet MS", "Segoe UI", system-ui, sans-serif',
    BODY: '"Nunito", "Segoe UI", system-ui, sans-serif',
  };
  BB.CFG = CFG;

  // Storybook palette: cream paper, ink brown, tomato red, and one colour per creature.
  BB.COL = {
    paper: '#fdf4dc',
    paper2: '#f4e5bf',
    ink: '#3b2a1e',
    inkSoft: '#7a604a',
    faint: '#b49d80',
    red: '#e2533c',
    redDark: '#a8331f',
    gold: '#f5b82e',
    goldDark: '#b97f10',
    leaf: '#6aa84f',
    sky: '#9fd4f2',
  };

  // One entry per creature: what you borrow from it, and its colours.
  BB.POWERS = {
    b: { id: 'b', creature: 'Hopsy', kind: 'Springhare', name: 'Spring legs', color: '#f5b82e', dark: '#b97f10', belly: '#fff1b8', hint: 'Jump much higher', how: 'Jump as usual. Your legs do the rest: walls five blocks high and long thorn patches are no trouble.', tip: 'Tap jump for a small hop, even with spring legs.' },
    g: { id: 'g', creature: 'Moss', kind: 'Tree gecko', name: 'Gecko claws', color: '#5fb86a', dark: '#2f7a43', belly: '#d7f2c2', hint: 'Walk into a wall to climb', how: 'Run into any wall and keep pushing (or hold up) to climb it. Let go to drop.', tip: 'At the top, step forward onto the ledge.' },
    o: { id: 'o', creature: 'Hush', kind: 'Lilac owl', name: 'Owl glide', color: '#a48fd0', dark: '#6a55a0', belly: '#efe7ff', hint: 'Hold jump in the air to glide', how: 'Jump, then keep holding jump while you fall. You drift down slowly and can cross very wide gaps.', tip: 'The higher you start, the further you float.' },
    t: { id: 't', creature: 'Bramble', kind: 'Old turtle', name: 'Turtle shell', color: '#7fa88c', dark: '#4b7258', belly: '#e6dcb4', hint: 'Fall hard onto cracked rock', how: 'Jump and land on cracked stone. The heavy shell smashes straight through it.', tip: 'A little fall is enough. A tiny step off a ledge is not.' },
  };
  BB.ORDER = ['b', 'g', 'o', 't'];

  const U = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    clamp01: (v) => Math.max(0, Math.min(1, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    easeOut: (t) => 1 - Math.pow(1 - t, 3),
    easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    easeBack: (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2),
    // deterministic per-tile noise, 0..1
    hash(x, y, s = 0) {
      let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    },
    rng(seed) {
      let s = seed >>> 0;
      return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), s | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
  };
  BB.U = U;

  // ---------- drawing helpers ----------
  const fontCache = {};
  function font(size, weight = 400, body = false) {
    const k = size + '|' + weight + '|' + body;
    return fontCache[k] || (fontCache[k] = `${weight} ${size}px ${body ? CFG.BODY : CFG.FONT}`);
  }

  const G = {
    font,
    text(ctx, str, x, y, size, color, align = 'left', weight = 400, opts = {}) {
      ctx.font = font(size, weight, opts.body);
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      if (opts.outline) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = opts.outline;
        ctx.strokeStyle = opts.outlineColor || BB.COL.ink;
        ctx.strokeText(str, x, y, opts.maxWidth);
      }
      if (opts.shadow) {
        ctx.fillStyle = opts.shadow;
        ctx.fillText(str, x, y + (opts.shadowY || 3), opts.maxWidth);
      }
      ctx.fillStyle = color;
      ctx.fillText(str, x, y, opts.maxWidth);
    },
    measure(ctx, str, size, weight = 400, body = false) {
      ctx.font = font(size, weight, body);
      return ctx.measureText(str).width;
    },
    wrap(ctx, str, maxW, size, weight = 400, body = true) {
      const out = [];
      for (const para of String(str).split('\n')) {
        let line = '';
        for (const w of para.split(' ')) {
          const t = line ? line + ' ' + w : w;
          if (G.measure(ctx, t, size, weight, body) > maxW && line) {
            out.push(line);
            line = w;
          } else line = t;
        }
        out.push(line);
      }
      return out;
    },
    rr(ctx, x, y, w, h, r) {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
      else {
        r = Array.isArray(r) ? r[0] : r;
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }
    },
    star(ctx, x, y, r, fill, stroke, lw = 2, rot = 0) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + rot + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.48 : r;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.lineJoin = 'round';
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
    },
    // A torn-paper card: cream fill, ink outline, a soft offset shadow below.
    card(ctx, x, y, w, h, opts = {}) {
      const r = opts.r || 18;
      ctx.save();
      G.rr(ctx, x + 4, y + 8, w, h, r);
      ctx.fillStyle = 'rgba(59,42,30,0.22)';
      ctx.fill();
      G.rr(ctx, x, y, w, h, r);
      ctx.fillStyle = opts.fill || BB.COL.paper;
      ctx.fill();
      ctx.lineWidth = opts.lw || 3;
      ctx.strokeStyle = opts.stroke || BB.COL.ink;
      ctx.stroke();
      // dotted stitch line inside the edge
      if (!opts.plain) {
        G.rr(ctx, x + 8, y + 8, w - 16, h - 16, Math.max(4, r - 7));
        ctx.setLineDash([2, 6]);
        ctx.lineCap = 'round';
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(122,96,74,0.35)';
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    },
  };
  BB.G = G;
})();
