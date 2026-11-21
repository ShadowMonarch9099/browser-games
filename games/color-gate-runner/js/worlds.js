// World art: painted top-down plates (assets/worlds/*.jpg) scrolled vertically, plus mascot sprites.
const Art = (() => {
  const plates = {}, sprites = {};
  for (const w of WORLDS) { const im = new Image(); im.src = `assets/worlds/${w.id}.jpg`; plates[w.id] = im;
    for (const s of SLOTS) { const sp = new Image(); sp.src = `assets/mascots9/cut_${w.id}_${s.key}.png`; sprites[w.id + '_' + s.key] = sp; } }
  function drawPlate(ctx, W, H, worldId, scroll, g) {
    const im = plates[worldId]; ctx.fillStyle = '#0b0f14'; ctx.fillRect(0, 0, W, H);
    if (!im.complete || !im.naturalWidth) return;
    const s = Math.max((g.tw * 3) / im.naturalWidth, W / im.naturalWidth), dw = im.naturalWidth * s, dh = im.naturalHeight * s, dx = (W - dw) / 2;
    const off = scroll % (dh * 2);
    for (let k = -1; k < Math.ceil(H / dh) + 2; k++) {
      const y = off - dh * 2 + k * dh, flip = ((k % 2) + 2) % 2 === 1;
      ctx.save(); if (flip) { ctx.translate(0, y + dh); ctx.scale(1, -1); ctx.drawImage(im, dx, 0, dw, dh); } else ctx.drawImage(im, dx, y, dw, dh); ctx.restore();
    }
  }
  const sprite = (worldId, slot) => sprites[worldId + '_' + SLOTS[slot].key];
  return { drawPlate, sprite };
})();
// Shapes for each color slot, drawn centered at (x,y) with radius r.
function drawShape(ctx, shape, x, y, r, stroke, lw) {
  ctx.save(); ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.beginPath();
  if (shape === 'circle') ctx.arc(x, y, r, 0, TAU);
  else if (shape === 'triangle') { ctx.moveTo(x, y - r); ctx.lineTo(x + r * .95, y + r * .75); ctx.lineTo(x - r * .95, y + r * .75); ctx.closePath(); }
  else { ctx.rect(x - r * .8, y - r * .8, r * 1.6, r * 1.6); }
  ctx.stroke(); ctx.restore();
}
