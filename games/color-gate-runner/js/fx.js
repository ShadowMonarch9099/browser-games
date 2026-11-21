// Visual effects: particles, score popups, rings, shake, flashes.
class FX {
  constructor() { this.parts = []; this.pops = []; this.rings = []; this.shake = 0; this.flash = 0; this.flashC = '#fff'; this.vign = 0; this.hitstop = 0; this.banner = null; this.slow = 1; }
  burst(x, y, w, h, c, n = 40) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = rnd(120, 560); this.parts.push({ x: x + rnd(-w / 2, w / 2), y: y + rnd(-h / 2, h / 2), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 220, a: 1, c, sz: rnd(3, 8), g: 700 }); } }
  sparks(x, y, c, n = 14) { for (let i = 0; i < n; i++) { const a = rnd(-Math.PI * .9, -Math.PI * .1), s = rnd(80, 300); this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, a: .9, c, sz: rnd(2, 4), g: 300 }); } }
  pop(x, y, txt, c = '#fff', big = false) { this.pops.push({ x, y, txt, c, t: 1, big }); }
  ring(x, y, c) { this.rings.push({ x, y, r: 10, c, a: 1 }); }
  doFlash(c, d = .18) { this.flash = d; this.flashC = c; }
  hit() { this.hitstop = CFG.HITSTOP; this.shake = 1; this.vign = 1; }
  showBanner(txt, c, d = 1.6) { this.banner = { txt, c, t: d, d }; }
  update(dt) {
    this.shake *= Math.pow(.0005, dt); this.vign *= Math.pow(.02, dt); this.flash = Math.max(0, this.flash - dt);
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.a -= dt * 1.6; } this.parts = this.parts.filter(p => p.a > 0);
    for (const p of this.pops) { p.y -= 60 * dt; p.t -= dt * .9; } this.pops = this.pops.filter(p => p.t > 0);
    for (const r of this.rings) { r.r += 640 * dt; r.a -= dt * 2.2; } this.rings = this.rings.filter(r => r.a > 0);
  }
  drawWorld(ctx) {
    for (const p of this.parts) { ctx.globalAlpha = Math.max(0, p.a); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.sz, p.sz); } ctx.globalAlpha = 1;
    for (const r of this.rings) { ctx.strokeStyle = hexa(r.c, Math.max(0, r.a)); ctx.lineWidth = 6 * r.a + 1; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke(); }
    for (const p of this.pops) { ctx.globalAlpha = Math.max(0, p.t); ctx.fillStyle = p.c; ctx.font = `800 ${p.big ? 30 : 22}px "Rubik",system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.strokeText(p.txt, p.x, p.y); ctx.fillText(p.txt, p.x, p.y); } ctx.globalAlpha = 1;
  }
  drawScreen(ctx, W, H) {
    if (this.flash > 0) { ctx.fillStyle = hexa(this.flashC, this.flash * .6); ctx.fillRect(0, 0, W, H); }
    if (this.vign > .02) { const v = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .8); v.addColorStop(0, 'rgba(255,0,40,0)'); v.addColorStop(1, `rgba(255,0,40,${this.vign * .7})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); }
    if (this.banner) { const b = this.banner, k = b.t > b.d - .3 ? easeOut((b.d - b.t) / .3) : b.t < .3 ? b.t / .3 : 1; ctx.globalAlpha = k; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, H * .28, W, 76); ctx.fillStyle = b.c; ctx.font = '900 38px "Rubik",system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.txt, W / 2 + (1 - k) * 160, H * .28 + 38); ctx.globalAlpha = 1; }
  }
}
