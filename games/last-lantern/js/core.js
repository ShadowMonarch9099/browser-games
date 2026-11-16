// Last Lantern: constants and drawing helpers. Logical canvas is 960x540.
window.LL = window.LL || {};
(function () {
  LL.CFG = {
    W: 960,
    H: 540,
    T: 36, // one cave cell, in logical px
    WALL: 14, // how tall walls stand (the 3/4 view)
    STEP: 1 / 60,
    DISPLAY: '"Cinzel Decorative", "Cinzel", Georgia, serif',
    BODY: '"Cormorant Garamond", Georgia, "Times New Roman", serif',
  };

  // Candlelight on ink: amber flame, old brass, cold cave blue, glowcap teal.
  LL.COL = {
    ink: '#07080d',
    night: '#0d0f18',
    flame: '#ffb347',
    flameHot: '#ffe08a',
    ember: '#ff6a2b',
    brass: '#c79a4f',
    brassDark: '#7a5a2a',
    parch: '#f3e3c0',
    parchDim: '#bfa67a',
    text: '#f6e7c8',
    mute: '#a8957a',
    faint: '#6b5d4c',
    blood: '#ff4d4d',
    glow: '#5ff2d8',
    violet: '#9d8df1',
  };

  const U = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    clamp01: (v) => Math.max(0, Math.min(1, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    easeOut: (t) => 1 - Math.pow(1 - t, 3),
    easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    easeBack: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
    hash(x, y, s = 0) {
      let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    },
    angDiff(a, b) {
      const d = a - b;
      return Math.atan2(Math.sin(d), Math.cos(d));
    },
  };
  LL.U = U;

  const cache = {};
  const font = (size, weight, display) => {
    const k = size + '|' + weight + '|' + display;
    return cache[k] || (cache[k] = `${weight} ${size}px ${display ? LL.CFG.DISPLAY : LL.CFG.BODY}`);
  };
  LL.G = {
    text(ctx, s, x, y, size, color, align = 'left', weight = 600, o = {}) {
      ctx.font = font(size, weight, o.display);
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      if (o.glow) {
        ctx.shadowColor = o.glow;
        ctx.shadowBlur = o.blur || 12;
      }
      if (o.spacing && ctx.letterSpacing !== undefined) ctx.letterSpacing = o.spacing + 'px';
      ctx.fillStyle = color;
      ctx.fillText(s, x, y, o.maxWidth);
      if (o.spacing && ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
      if (o.glow) {
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
      }
    },
    measure(ctx, s, size, weight = 600, display = false) {
      ctx.font = font(size, weight, display);
      return ctx.measureText(s).width;
    },
    wrap(ctx, s, w, size, weight = 600) {
      const out = [];
      let line = '';
      for (const word of String(s).split(' ')) {
        const t = line ? line + ' ' + word : word;
        if (LL.G.measure(ctx, t, size, weight) > w && line) {
          out.push(line);
          line = word;
        } else line = t;
      }
      if (line) out.push(line);
      return out;
    },
    // A brass-framed slate panel with corner rivets.
    frame(ctx, x, y, w, h, o = {}) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x + 4, y + 6, w, h);
      const gr = ctx.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, o.top || '#1d1912');
      gr.addColorStop(1, o.bottom || '#120f0b');
      ctx.fillStyle = gr;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = LL.COL.brassDark;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      ctx.strokeStyle = 'rgba(199,154,79,0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 6.5, y + 6.5, w - 13, h - 13);
      ctx.fillStyle = LL.COL.brass;
      for (const [cx, cy] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) {
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
    // a small four-point sparkle, used for beacons and highlights
    sigil(ctx, x, y, r, color) {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        const rr = i % 2 ? r * 0.32 : r;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    },
  };
})();
