// Drawing helpers: rounded "cloud cards", pill buttons, soft text.
(function () {
  const SS = window.SS;
  const DISPLAY = "'Baloo 2', 'Trebuchet MS', 'Segoe UI', sans-serif";
  const BODY = "'Nunito', 'Trebuchet MS', 'Segoe UI', sans-serif";
  const D = {
    DISPLAY, BODY,
    font(size, weight, display) { return `${weight || 700} ${Math.round(size * 10) / 10}px ${display ? DISPLAY : BODY}`; },
    // opts: display, shadow (soft drop shadow), maxWidth
    text(ctx, str, x, y, size, color, align, weight, opts) {
      opts = opts || {};
      ctx.font = D.font(size, weight, opts.display);
      ctx.textAlign = align || 'left';
      ctx.textBaseline = 'middle';
      if (opts.shadow) { ctx.shadowColor = 'rgba(30,60,120,0.35)'; ctx.shadowBlur = Math.min(14, size * 0.4); ctx.shadowOffsetY = Math.max(1, size * 0.06); }
      ctx.fillStyle = color;
      if (opts.maxWidth) ctx.fillText(str, x, y, opts.maxWidth); else ctx.fillText(str, x, y);
      if (opts.shadow) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
    },
    measure(ctx, str, size, weight, opts) { ctx.font = D.font(size, weight, opts && opts.display); return ctx.measureText(str).width; },
    rr(ctx, x, y, w, h, r) {
      r = Math.min(r, h / 2, w / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    },
    // a frosted card with a soft layered shadow (no blur filter: cheap)
    card(ctx, x, y, w, h, r) {
      r = r || 24;
      for (let i = 3; i >= 1; i--) { D.rr(ctx, x - i, y + i * 3, w + i * 2, h + i * 2, r + i); ctx.fillStyle = `rgba(40,80,150,${0.05})`; ctx.fill(); }
      D.rr(ctx, x, y, w, h, r);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.lineWidth = 1.5; ctx.stroke();
      // a faint sky tint at the top
      const g = ctx.createLinearGradient(0, y, 0, y + 60);
      g.addColorStop(0, 'rgba(190,222,255,0.35)'); g.addColorStop(1, 'rgba(190,222,255,0)');
      D.rr(ctx, x, y, w, Math.min(h, 60), r); ctx.fillStyle = g; ctx.fill();
    },
    keycap(ctx, label, x, y, align, measureOnly) {
      if (!label) return 0;
      const h = 20, w = Math.max(h, D.measure(ctx, label, 10.5, 800) + 14);
      if (measureOnly) return w;
      const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      D.rr(ctx, x0, y - h / 2, w, h, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
      ctx.strokeStyle = 'rgba(29,53,87,0.25)'; ctx.lineWidth = 1; ctx.stroke();
      D.text(ctx, label, x0 + w / 2, y + 0.5, 10.5, '#1d3557', 'center', 800);
      return w;
    },
    prompt(ctx, glyph, label, x, y, align, color) {
      if (!glyph) return 0;
      const kw = D.keycap(ctx, glyph, 0, 0, 'left', true), lw = D.measure(ctx, label, 12.5, 700), total = kw + 7 + lw;
      const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
      D.keycap(ctx, glyph, x0, y);
      D.text(ctx, label, x0 + kw + 7, y, 12.5, color || '#ffffff', 'left', 700, { shadow: !color });
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
  SS.Draw = D;
})();
