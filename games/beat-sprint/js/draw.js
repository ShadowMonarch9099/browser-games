// Drawing helpers: the game's two typefaces, glowing neon text, keycaps and
// the slanted plates every menu is built from.
(function () {
  const BS = window.BS;
  const DISPLAY = "'Monoton', 'Impact', 'Arial Black', sans-serif";
  const UI = "'Chakra Petch', 'Segoe UI', 'Trebuchet MS', sans-serif";
  const hasSpacing = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;

  function font(size, weight, display) {
    return display ? `${Math.round(size)}px ${DISPLAY}` : `${weight || 600} ${Math.round(size * 10) / 10}px ${UI}`;
  }

  const D = {
    DISPLAY, UI,
    font,
    // opts: glow (colour), spacing (px), display (use the neon face), maxWidth, stroke
    text(ctx, str, x, y, size, color, align, weight, opts) {
      opts = opts || {};
      ctx.font = font(size, weight, opts.display);
      ctx.textAlign = align || 'left';
      ctx.textBaseline = 'middle';
      if (hasSpacing) ctx.letterSpacing = (opts.spacing || 0) + 'px';
      if (opts.glow) { ctx.shadowColor = opts.glow; ctx.shadowBlur = opts.blur || Math.min(18, size * 0.6); }
      ctx.fillStyle = color;
      if (opts.maxWidth) ctx.fillText(str, x, y, opts.maxWidth); else ctx.fillText(str, x, y);
      if (opts.glow) { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }
      if (hasSpacing) ctx.letterSpacing = '0px';
    },
    measure(ctx, str, size, weight, opts) {
      opts = opts || {};
      ctx.font = font(size, weight, opts.display);
      if (hasSpacing) ctx.letterSpacing = (opts.spacing || 0) + 'px';
      const w = ctx.measureText(str).width;
      if (hasSpacing) ctx.letterSpacing = '0px';
      return w;
    },
    // A slanted plate (parallelogram): the shape of every button and panel.
    plate(ctx, x, y, w, h, skew) {
      const k = skew === undefined ? h * 0.22 : skew;
      ctx.beginPath();
      ctx.moveTo(x + k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - k, y + h); ctx.lineTo(x, y + h);
      ctx.closePath();
    },
    // Small key glyph. Returns its width.
    keycap(ctx, label, x, y, size, color, align, measureOnly) {
      if (!label) return 0;
      const h = size + 9, w = Math.max(h, D.measure(ctx, label, size, 700, { spacing: 0.5 }) + 12);
      if (measureOnly) return w;
      const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      ctx.save();
      D.plate(ctx, x0, y - h / 2, w, h, 3);
      ctx.fillStyle = 'rgba(10,2,30,0.75)';
      ctx.fill();
      ctx.strokeStyle = color || 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
      D.text(ctx, label, x0 + w / 2, y + 0.5, size, color || '#fff', 'center', 700, { spacing: 0.5 });
      return w;
    },
    // keycap + label; returns the width used, 0 when the device has no glyph for it
    prompt(ctx, glyph, label, x, y, align, color) {
      if (!glyph) return 0;
      const size = 10;
      const kw = D.keycap(ctx, glyph, 0, 0, size, null, 'left', true);
      const lw = D.measure(ctx, label, 12, 600, { spacing: 1 });
      const total = kw + 7 + lw;
      const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
      D.keycap(ctx, glyph, x0, y, size, color || 'rgba(255,255,255,0.7)');
      D.text(ctx, label, x0 + kw + 7, y, 12, color || 'rgba(235,220,255,0.75)', 'left', 600, { spacing: 1 });
      return total;
    },
    wrap(ctx, str, maxW, size, weight) {
      const words = str.split(' '), lines = [];
      let line = '';
      for (const w of words) {
        const t = line ? line + ' ' + w : w;
        if (D.measure(ctx, t, size, weight) > maxW && line) { lines.push(line); line = w; } else line = t;
      }
      if (line) lines.push(line);
      return lines;
    },
  };
  BS.Draw = D;
})();
