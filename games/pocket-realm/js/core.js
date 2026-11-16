// Pocket Realm: layout, palette and drawing helpers. The canvas works in
// logical px and switches between a landscape layout (960x540, board left,
// panel right) and a portrait one (540x960, board on top) to fit the screen.
window.PR = window.PR || {};
(function () {
  PR.CFG = {
    STEP: 1 / 60,
    DISPLAY: '"IM Fell English SC", "IM Fell English", Georgia, serif',
    BODY: '"IM Fell English", Georgia, "Times New Roman", serif',
  };

  // An illustrated tabletop: oak table, linen map, ink, wax-seal red, gold leaf.
  PR.COL = {
    ink: '#2a1d14',
    inkSoft: '#5b4636',
    faint: '#9a8468',
    vellum: '#f2e6c9',
    vellum2: '#e6d4ad',
    gold: '#d4a531',
    goldDark: '#8a6514',
    seal: '#a8322d',
    sealDark: '#6e1d1a',
    hp: '#c0392b',
    xp: '#3f7fbf',
    wood: '#5a3a22',
  };

  PR.layout = function (portrait) {
    if (portrait) {
      return { W: 540, H: 960, portrait: true, board: { cx: 270, top: 150, hw: 35, hh: 17.5 }, panel: { x: 16, y: 470, w: 508, h: 474 }, stage: { x: 20, y: 70, w: 500, h: 380 } };
    }
    return { W: 960, H: 540, portrait: false, board: { cx: 300, top: 150, hw: 38, hh: 19 }, panel: { x: 612, y: 14, w: 334, h: 512 }, stage: { x: 24, y: 70, w: 556, h: 400 } };
  };
  PR.L = PR.layout(false);

  const U = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    clamp01: (v) => Math.max(0, Math.min(1, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    easeOut: (t) => 1 - Math.pow(1 - t, 3),
    easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    easeBack: (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2),
    hash(x, y, s = 0) {
      let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    },
    strHash(text) {
      let h = 2166136261;
      for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
      return h >>> 0;
    },
    today: () => new Date().toISOString().slice(0, 10),
  };
  PR.U = U;

  const fc = {};
  const font = (size, display, italic) => {
    const k = size + '|' + display + '|' + italic;
    return fc[k] || (fc[k] = `${italic ? 'italic ' : ''}${size}px ${display ? PR.CFG.DISPLAY : PR.CFG.BODY}`);
  };
  PR.G = {
    text(ctx, s, x, y, size, color, align = 'left', o = {}) {
      ctx.font = font(size, !!o.display, !!o.italic);
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      if (o.stroke) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = o.stroke;
        ctx.strokeStyle = o.strokeColor || PR.COL.vellum;
        ctx.strokeText(s, x, y, o.maxWidth);
      }
      ctx.fillStyle = color;
      ctx.fillText(s, x, y, o.maxWidth);
    },
    measure(ctx, s, size, display = false) {
      ctx.font = font(size, display, false);
      return ctx.measureText(s).width;
    },
    wrap(ctx, s, w, size, display = false) {
      const out = [];
      let line = '';
      for (const word of String(s).split(' ')) {
        const t = line ? line + ' ' + word : word;
        if (PR.G.measure(ctx, t, size, display) > w && line) {
          out.push(line);
          line = word;
        } else line = t;
      }
      if (line) out.push(line);
      return out;
    },
    // A vellum card with an inked double border and a soft table shadow.
    card(ctx, x, y, w, h, o = {}) {
      ctx.save();
      ctx.fillStyle = 'rgba(30,15,5,0.35)';
      ctx.fillRect(x + 3, y + 6, w, h);
      ctx.fillStyle = o.fill || PR.COL.vellum;
      ctx.fillRect(x, y, w, h);
      if (!o.flat) {
        const gr = ctx.createLinearGradient(x, y, x, y + h);
        gr.addColorStop(0, 'rgba(255,255,255,0.18)');
        gr.addColorStop(1, 'rgba(120,80,30,0.12)');
        ctx.fillStyle = gr;
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeStyle = o.edge || PR.COL.inkSoft;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
      ctx.strokeStyle = o.inner || 'rgba(138,101,20,0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
      ctx.restore();
    },
    bar(ctx, x, y, w, h, frac, color) {
      ctx.fillStyle = 'rgba(42,29,20,0.18)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w * U.clamp01(frac), h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, w * U.clamp01(frac), Math.max(1, h / 3));
      ctx.strokeStyle = PR.COL.inkSoft;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    },
    // wax seal button face
    seal(ctx, x, y, r, color = PR.COL.seal) {
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const rr = r * (1 + (i % 2 ? 0.05 : -0.02));
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.stroke();
    },
  };
})();
