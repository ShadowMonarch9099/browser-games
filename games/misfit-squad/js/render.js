// Misfit Squad drawing: a cartoon space station deck seen from above at a
// tilt. The room (back wall with windows, lit floor plates, side rails) is
// painted once per size; scorch marks pile up on a decal layer; heroes,
// robots, lasers and sparks are drawn every frame, sorted by depth.
(function () {
  const TAU = Math.PI * 2, VW = 16, VH = 9;
  const DISPLAY = '"Russo One", "Trebuchet MS", "Segoe UI", sans-serif';
  const BODY = '"Chakra Petch", "Segoe UI", system-ui, sans-serif';
  const LINE = '#0d1530';

  const R = {
    canvas: null, ctx: null, W: 0, H: 0, dpr: 1, u: 40, ox: 0, oy: 0, hs: 1, time: 0,
    room: null, roomKey: '', decals: null, dctx: null, parts: [], nums: [], shake: 0, flash: 0, alarm: 0, bossIntro: 0,
    DISPLAY, BODY, LINE,

    init(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.room = document.createElement('canvas');
      this.decals = document.createElement('canvas'); this.dctx = this.decals.getContext('2d');
      addEventListener('resize', () => this.resize());
      this.resize();
    },
    resize() {
      const c = this.canvas;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.W = c.clientWidth || innerWidth; this.H = c.clientHeight || innerHeight;
      c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr);
      this.roomKey = '';
      this.layout();
    },
    layout() {
      const W = this.W, H = this.H, hs = this.hs = MS.clamp(Math.min(W / 1000, H / 620), 0.5, 1.6);
      const top = 54 * hs, bottom = 92 * hs;
      const u = this.u = Math.min((W - 40 * hs) / (VW + 0.8), (H - top - bottom) / (VH + 1.5));
      this.ox = (W - VW * u) / 2;
      this.oy = top + u * 1.25 + ((H - top - bottom) - (VH + 1.5) * u) / 2;
    },
    X(x) { return this.ox + x * this.u; },
    Y(y) { return this.oy + y * this.u; },

    // ---------- the room, painted once ----------
    paintRoom() {
      const W = this.W, H = this.H, u = this.u, dpr = this.dpr, ox = this.ox, oy = this.oy;
      const c = this.room; c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr);
      const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rand = MS.rng(5);
      // deep space around the station
      const sp = g.createLinearGradient(0, 0, 0, H); sp.addColorStop(0, '#0a0f2c'); sp.addColorStop(1, '#1b1046');
      g.fillStyle = sp; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 220; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.2 + rand() * 0.7) + ')'; const r = rand() < 0.1 ? 1.6 : 0.8; g.fillRect(rand() * W, rand() * H, r, r); }
      // hull outline
      const fx = ox, fy = oy, fw = VW * u, fh = VH * u, wallH = u * 1.15;
      g.fillStyle = '#26315e'; rr(g, fx - u * 0.45, fy - wallH - u * 0.25, fw + u * 0.9, fh + wallH + u * 0.7, u * 0.4); g.fill();
      g.strokeStyle = '#5a6cb8'; g.lineWidth = 3; g.stroke();
      // back wall with windows looking out at a ringed planet
      const wg = g.createLinearGradient(0, fy - wallH, 0, fy); wg.addColorStop(0, '#3e4f97'); wg.addColorStop(1, '#2c3a78');
      g.fillStyle = wg; g.fillRect(fx, fy - wallH, fw, wallH);
      for (let k = 0; k < 3; k++) {
        const wx = fx + fw * (0.14 + k * 0.29), ww = fw * 0.16, wy = fy - wallH * 0.86, wh = wallH * 0.6;
        g.save(); rr(g, wx, wy, ww, wh, wh * 0.35); g.clip();
        g.fillStyle = '#060a20'; g.fillRect(wx, wy, ww, wh);
        for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(255,255,255,' + rand() + ')'; g.fillRect(wx + rand() * ww, wy + rand() * wh, 1.2, 1.2); }
        if (k === 1) {
          const px = wx + ww * 0.55, py = wy + wh * 0.62, pr = wh * 0.45;
          const pg = g.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr); pg.addColorStop(0, '#ffb86b'); pg.addColorStop(1, '#c2457a');
          g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(255,220,180,.7)'; g.lineWidth = 2; g.beginPath(); g.ellipse(px, py, pr * 1.6, pr * 0.35, -0.2, 0, TAU); g.stroke();
        }
        if (k === 2) { g.fillStyle = '#8ab4ff'; g.beginPath(); g.arc(wx + ww * 0.3, wy + wh * 0.35, wh * 0.12, 0, TAU); g.fill(); }
        g.restore();
        g.strokeStyle = '#9fb0ff'; g.lineWidth = 3; rr(g, wx, wy, ww, wh, wh * 0.35); g.stroke();
      }
      // warning stripes along the bottom of the wall
      g.save(); g.beginPath(); g.rect(fx, fy - u * 0.16, fw, u * 0.16); g.clip();
      g.fillStyle = '#ffb000'; g.fillRect(fx, fy - u * 0.16, fw, u * 0.16);
      g.fillStyle = '#1a1a1a'; for (let x = fx - u; x < fx + fw; x += u * 0.4) { g.beginPath(); g.moveTo(x, fy); g.lineTo(x + u * 0.2, fy - u * 0.16); g.lineTo(x + u * 0.4, fy - u * 0.16); g.lineTo(x + u * 0.2, fy); g.fill(); }
      g.restore();
      // floor plates
      g.fillStyle = '#2b3f6e'; g.fillRect(fx, fy, fw, fh);
      for (let y = 0; y < VH; y += 1.5) for (let x = 0; x < VW; x += 2) {
        const px = fx + x * u, py = fy + y * u, pw = 2 * u, ph = 1.5 * u;
        const tone = ((x / 2 + y / 1.5) | 0) % 2;
        g.fillStyle = tone ? '#33497d' : '#2f4475'; g.fillRect(px + 1.5, py + 1.5, pw - 3, ph - 3);
        g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(px + 1.5, py + 1.5, pw - 3, 2);
        g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(px + 1.5, py + ph - 3.5, pw - 3, 2);
        g.fillStyle = '#5168a8'; for (const [rx, ry] of [[0.12, 0.12], [1.88, 0.12], [0.12, 1.38], [1.88, 1.38]]) { g.beginPath(); g.arc(px + rx * u, py + ry * u, u * 0.035, 0, TAU); g.fill(); }
        if (rand() < 0.18) { g.strokeStyle = 'rgba(120,150,230,.25)'; g.lineWidth = 1; g.beginPath(); for (let k2 = 0; k2 < 4; k2++) { g.moveTo(px + pw * 0.3, py + ph * (0.3 + k2 * 0.12)); g.lineTo(px + pw * 0.7, py + ph * (0.3 + k2 * 0.12)); } g.stroke(); }
      }
      // floor light strips along the sides
      for (const sx of [fx + u * 0.08, fx + fw - u * 0.18]) { g.fillStyle = 'rgba(100,240,255,.35)'; g.fillRect(sx, fy + u * 0.3, u * 0.1, fh - u * 0.6); }
      // front rail
      g.fillStyle = '#1d2750'; g.fillRect(fx - u * 0.2, fy + fh, fw + u * 0.4, u * 0.22);
      g.fillStyle = '#5a6cb8'; g.fillRect(fx - u * 0.2, fy + fh, fw + u * 0.4, 3);
      // a soft spotlight on the middle of the deck
      const lg = g.createRadialGradient(W / 2, fy + fh * 0.45, u, W / 2, fy + fh * 0.45, fw * 0.6);
      lg.addColorStop(0, 'rgba(160,220,255,.12)'); lg.addColorStop(1, 'rgba(0,0,0,.25)');
      g.fillStyle = lg; g.fillRect(fx, fy, fw, fh);
      // decal layer sized to the floor
      this.decals.width = Math.ceil(fw * dpr); this.decals.height = Math.ceil(fh * dpr);
      this.dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    scorch(x, y, r) {
      const d = this.dctx, u = this.u, px = x * u, py = y * u;
      const gr = d.createRadialGradient(px, py, 0, px, py, r * u);
      gr.addColorStop(0, 'rgba(10,12,25,.45)'); gr.addColorStop(1, 'rgba(10,12,25,0)');
      d.fillStyle = gr; d.beginPath(); d.arc(px, py, r * u, 0, TAU); d.fill();
    },

    // ---------- effects ----------
    spawn(p) { if (this.parts.length < 500) this.parts.push(Object.assign({ t: 0, vx: 0, vy: 0, z: 0, vz: 0, g: 0, rot: 0, vr: 0 }, p)); },
    num(x, y, str, color) { if (this.nums.length < 40) this.nums.push({ x, y, str, color, t: 0 }); },
    onEvent(e, m) {
      const rnd = Math.random, st = MS.Save.data.settings;
      if (e.t === 'shot') {
        const h = m.heroes[e.i];
        this.spawn({ type: 'flash', x: e.x + Math.cos(e.a) * 0.45, y: e.y + Math.sin(e.a) * 0.45 - 0.35, life: 0.06, size: 0.18, color: h.c.color, a: e.a });
      } else if (e.t === 'hit') {
        for (let i = 0; i < (e.big ? 6 : 3); i++) { const a = rnd() * TAU; this.spawn({ type: 'spark', x: e.x, y: e.y - 0.3, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 0.2, size: 0.04, color: rnd() < 0.5 ? '#fff' : e.color }); }
      } else if (e.t === 'scrap') {
        const big = e.type === 'brute' || e.type === 'boss';
        const n = big ? 26 : 10;
        for (let i = 0; i < n; i++) { const a = rnd() * TAU, sp = 1 + rnd() * (big ? 5 : 3); this.spawn({ type: rnd() < 0.5 ? 'bolt' : 'gear', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 2 + rnd() * 3, g: 9, life: 0.9 + rnd() * 0.5, size: 0.06 + rnd() * 0.06, vr: (rnd() - 0.5) * 20, color: rnd() < 0.5 ? '#9aa6c8' : MS.BOTS[e.type].color }); }
        for (let i = 0; i < (big ? 10 : 4); i++) this.spawn({ type: 'smoke', x: e.x + (rnd() - 0.5) * 0.4, y: e.y, vz: 0.6, life: 0.9, size: 0.2 + rnd() * 0.2 });
        this.spawn({ type: 'boom', x: e.x, y: e.y, life: big ? 0.5 : 0.3, size: big ? 1.6 : 0.7 });
        this.scorch(e.x, e.y, big ? 1.1 : 0.45);
        this.shake = Math.max(this.shake, big ? 16 : 3);
        if (big && st.flashes) this.flash = 0.4;
        if (e.type === 'boss') this.alarm = 0;
      } else if (e.t === 'spawn' || e.t === 'boss') {
        this.spawn({ type: 'beam', x: MS.clamp(e.x, 0.3, VW - 0.3), y: MS.clamp(e.y, 0.3, VH - 0.3), life: 0.5, size: e.t === 'boss' ? 1.3 : 0.5 });
        if (e.t === 'boss') { this.bossIntro = 3; this.alarm = 1; this.shake = 12; }
      } else if (e.t === 'special') {
        if (e.role === 'Tank') this.shake = Math.max(this.shake, 9);
        if (e.role === 'Medic') for (let i = 0; i < 10; i++) this.spawn({ type: 'cross', x: e.x + (rnd() - 0.5) * 3, y: e.y + (rnd() - 0.5) * 2, vz: 0.8, life: 0.9, size: 0.12, color: '#62d26f' });
        if (e.role === 'Sharpshooter') { this.shake = Math.max(this.shake, 6); this.spawn({ type: 'flash', x: e.x + Math.cos(e.a) * 0.5, y: e.y + Math.sin(e.a) * 0.5 - 0.35, life: 0.12, size: 0.45, color: '#bff4ff', a: e.a }); }
      } else if (e.t === 'mine') {
        this.spawn({ type: 'boom', x: e.x, y: e.y, life: 0.45, size: 1.6 });
        for (let i = 0; i < 8; i++) this.spawn({ type: 'smoke', x: e.x + (rnd() - 0.5), y: e.y + (rnd() - 0.5) * 0.6, vz: 0.6, life: 0.8, size: 0.25 });
        this.scorch(e.x, e.y, 1.2); this.shake = Math.max(this.shake, 10);
      } else if (e.t === 'down') {
        this.shake = Math.max(this.shake, 8);
        for (let i = 0; i < 8; i++) { const a = rnd() * TAU; this.spawn({ type: 'spark', x: e.x, y: e.y - 0.3, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, life: 0.4, size: 0.05, color: '#ff6b6b' }); }
      } else if (e.t === 'revive' || e.t === 'secondWind') {
        for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; this.spawn({ type: 'spark', x: e.x, y: e.y - 0.3, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 0.5, size: 0.06, color: '#bfffc8' }); }
      } else if (e.t === 'healed' && st.numbers) this.num(e.x, e.y - 1, '+40', '#7dff8e');
      else if (e.t === 'won') { for (let i = 0; i < 80; i++) { const a = rnd() * TAU, sp = 1 + rnd() * 4; this.spawn({ type: 'confetti', x: 8, y: 4.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 3 + rnd() * 3, g: 5, life: 2 + rnd(), size: 0.08, vr: 10, color: ['#ffd23f', '#3ec6f0', '#62d26f', '#ff9f1c', '#b57bff'][i % 5] }); } }
    },
    update(dt) {
      this.time += dt;
      this.shake = Math.max(0, this.shake - dt * 40);
      this.flash = Math.max(0, this.flash - dt * 2.5);
      this.bossIntro = Math.max(0, this.bossIntro - dt);
      const ps = this.parts;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]; p.t += dt;
        if (p.t >= p.life) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.g * dt; p.rot += p.vr * dt;
        if (p.z < 0 && p.g) { p.z = 0; p.vz *= -0.4; p.vx *= 0.6; p.vy *= 0.6; p.vr *= 0.5; }
        if (p.type === 'smoke') { p.vx *= 0.95; p.vy *= 0.95; }
      }
      for (let i = this.nums.length - 1; i >= 0; i--) { const n = this.nums[i]; n.t += dt; n.y -= dt * 0.8; if (n.t > 0.8) this.nums.splice(i, 1); }
    },

    // ---------- heroes ----------
    drawHero(g, h, x, y, u, o) {
      o = o || {};
      const c = h.c, t = this.time, role = c.role, slot = MS.SLOTS[h.slot === undefined ? 0 : h.slot];
      const moving = Math.hypot(h.vx || 0, h.vy || 0) > 0.2;
      const bob = moving ? Math.abs(Math.sin((h.walk || 0) * 5)) * u * 0.06 : Math.sin(t * 3 + (h.i || 0)) * u * 0.015;
      const flip = Math.cos(h.face || 0) < 0 ? -1 : 1;
      g.save(); g.translate(x, y);
      if (!o.noRing) {
        g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(0, 0, u * 0.36, u * 0.13, 0, 0, TAU); g.fill();
        g.strokeStyle = slot.color; g.lineWidth = Math.max(2, u * 0.05); g.beginPath(); g.ellipse(0, 0, u * 0.42, u * 0.16, 0, 0, TAU); g.stroke();
      }
      if (h.down) {
        g.rotate(Math.PI / 2 * flip * 0.9); g.translate(0, -u * 0.1);
      }
      g.translate(0, -bob);
      const S = role === 'Tank' ? 1.15 : role === 'Sharpshooter' ? 0.95 : 1;
      g.scale(S, S);
      const suit = h.hurt > 0 && Math.sin(t * 60) > 0 ? '#fff' : c.color;
      // backpack / role gear behind
      g.save(); g.scale(flip, 1);
      if (role === 'Medic') { g.fillStyle = '#e8f6ea'; ol(g, () => rr(g, -u * 0.36, -u * 0.62, u * 0.2, u * 0.34, u * 0.05)); g.fillStyle = '#e84d4d'; g.fillRect(-u * 0.3, -u * 0.5, u * 0.08, u * 0.04); g.fillRect(-u * 0.28, -u * 0.52, u * 0.04, u * 0.08); }
      else if (role === 'Trapper') { g.fillStyle = '#4a3a6b'; ol(g, () => rr(g, -u * 0.36, -u * 0.55, u * 0.18, u * 0.28, u * 0.05)); g.fillStyle = Math.sin(t * 8) > 0 ? '#ff5d5d' : '#5d2a2a'; g.beginPath(); g.arc(-u * 0.27, -u * 0.5, u * 0.03, 0, TAU); g.fill(); }
      else if (role === 'Tank') { g.fillStyle = '#6b7a99'; ol(g, () => rr(g, -u * 0.38, -u * 0.6, u * 0.18, u * 0.36, u * 0.04)); }
      g.restore();
      // legs
      const step = moving ? Math.sin((h.walk || 0) * 5) : 0;
      g.fillStyle = c.dark;
      for (const s of [-1, 1]) { ol(g, () => rr(g, s * u * 0.1 - u * 0.07 + step * s * u * 0.05, -u * 0.25, u * 0.14, u * 0.25 - Math.max(0, step * s) * u * 0.06, u * 0.05)); }
      // body
      g.fillStyle = suit; ol(g, () => rr(g, -u * 0.25, -u * 0.62, u * 0.5, u * 0.44, u * 0.16));
      g.fillStyle = 'rgba(255,255,255,.25)'; rr(g, -u * 0.18, -u * 0.58, u * 0.12, u * 0.3, u * 0.06); g.fill();
      g.fillStyle = slot.color; g.beginPath(); badge(g, slot.shape, u * 0.1 * flip, -u * 0.42, u * 0.06); g.fill();
      // helmet
      const hy = -u * 0.82;
      if (role === 'Tank') { g.fillStyle = '#c9d2e8'; ol(g, () => rr(g, -u * 0.26, hy - u * 0.24, u * 0.52, u * 0.44, u * 0.08)); }
      else { g.fillStyle = '#dfe9ff'; ol(g, () => { g.beginPath(); g.arc(0, hy, u * 0.25, 0, TAU); }); }
      // visor with a face
      g.save(); g.scale(flip, 1);
      g.fillStyle = role === 'Sharpshooter' ? '#123a5a' : '#173a5e';
      ol(g, () => rr(g, -u * 0.08, hy - u * 0.12, u * 0.3, u * 0.22, u * 0.09));
      if (h.down) { g.strokeStyle = '#ff6b6b'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, hy - u * 0.06); g.lineTo(u * 0.06, hy); g.moveTo(u * 0.06, hy - u * 0.06); g.lineTo(0, hy); g.stroke(); }
      else { g.fillStyle = '#9ff3ff'; const blink = Math.sin(t * 1.7 + (h.i || 0) * 3) > 0.97; g.fillRect(u * 0.02, hy - u * 0.05, u * 0.05, blink ? u * 0.01 : u * 0.06); g.fillRect(u * 0.12, hy - u * 0.05, u * 0.05, blink ? u * 0.01 : u * 0.06); }
      g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(u * 0.12, hy - u * 0.1, u * 0.06, u * 0.02);
      // role headgear
      if (role === 'Medic') { g.strokeStyle = LINE; g.lineWidth = 2; g.beginPath(); g.moveTo(-u * 0.05, hy - u * 0.24); g.lineTo(-u * 0.05, hy - u * 0.36); g.stroke(); g.fillStyle = '#7dff8e'; g.beginPath(); g.arc(-u * 0.05, hy - u * 0.38, u * 0.04, 0, TAU); g.fill(); }
      if (role === 'Trapper') { g.strokeStyle = LINE; g.lineWidth = 2; g.beginPath(); g.moveTo(-u * 0.12, hy - u * 0.2); g.quadraticCurveTo(-u * 0.25, hy - u * 0.4, -u * 0.1, hy - u * 0.45); g.stroke(); g.fillStyle = '#d6b3ff'; g.beginPath(); g.arc(-u * 0.1, hy - u * 0.45, u * 0.045, 0, TAU); g.fill(); }
      if (role === 'Sharpshooter') { g.fillStyle = c.dark; ol(g, () => rr(g, -u * 0.26, hy - u * 0.26, u * 0.44, u * 0.1, u * 0.04)); }
      g.restore();
      // weapon / shield pointing at the target
      if (!h.down) {
        g.save(); g.translate(0, -u * 0.42); g.rotate(h.face || 0);
        const rec = (h.recoil || 0) * u * 0.06;
        if (role === 'Tank') {
          g.fillStyle = '#5c6a8a'; ol(g, () => rr(g, u * 0.1 - rec, -u * 0.07, u * 0.34, u * 0.14, u * 0.04));
          g.fillStyle = '#8fa0c4'; ol(g, () => rr(g, u * 0.2, -u * 0.32 + (Math.cos(h.face) < 0 ? 0 : 0), u * 0.1, u * 0.24, u * 0.03));
        } else if (role === 'Sharpshooter') {
          g.fillStyle = '#334466'; ol(g, () => rr(g, u * 0.05 - rec, -u * 0.05, u * 0.62, u * 0.1, u * 0.03));
          g.fillStyle = c.color; g.fillRect(u * 0.2 - rec, -u * 0.09, u * 0.14, u * 0.05);
        } else {
          g.fillStyle = role === 'Medic' ? '#e8f6ea' : '#5a4a80'; ol(g, () => rr(g, u * 0.08 - rec, -u * 0.06, u * 0.32, u * 0.12, u * 0.04));
          g.fillStyle = c.color; g.fillRect(u * 0.32 - rec, -u * 0.04, u * 0.06, u * 0.08);
        }
        g.restore();
        // arm holding it
        g.fillStyle = suit; ol(g, () => { g.beginPath(); g.arc(Math.cos(h.face || 0) * u * 0.14, -u * 0.42 + Math.sin(h.face || 0) * u * 0.1, u * 0.08, 0, TAU); });
      }
      g.restore();
    },

    // ---------- robots ----------
    drawFoe(g, f, x, y, u) {
      const t = this.time, b = f.b, white = f.hit > 0;
      const col = white ? '#ffffff' : b.color;
      g.save(); g.translate(x, y);
      const r = b.r * u;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(0, 0, r * 1.1, r * 0.4, 0, 0, TAU); g.fill();
      const face = Math.cos(f.face || 0) < 0 ? -1 : 1;
      if (f.type === 'zip') {
        const hover = r * 1.4 + Math.sin(t * 9 + f.id) * r * 0.15;
        g.translate(0, -hover);
        g.fillStyle = col; ol(g, () => { g.beginPath(); g.arc(0, 0, r, 0, TAU); });
        g.fillStyle = '#2a2a3a'; ol(g, () => { g.beginPath(); g.arc(face * r * 0.3, 0, r * 0.45, 0, TAU); });
        g.fillStyle = '#ff4040'; g.beginPath(); g.arc(face * r * 0.38, 0, r * 0.18, 0, TAU); g.fill();
        // propeller
        g.strokeStyle = LINE; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -r); g.lineTo(0, -r * 1.4); g.stroke();
        const pa = t * 40; g.fillStyle = 'rgba(220,230,255,.75)'; g.beginPath(); g.ellipse(0, -r * 1.45, r * 1.1 * Math.abs(Math.cos(pa)), r * 0.15, 0, 0, TAU); g.fill();
      } else if (f.type === 'grunt') {
        const step = Math.sin(f.walk * 6) * r * 0.08;
        g.fillStyle = '#3a3f55'; ol(g, () => rr(g, -r * 0.95, -r * 0.45, r * 1.9, r * 0.45, r * 0.2));
        g.strokeStyle = '#80869e'; g.lineWidth = 1.5; g.beginPath(); for (let k = -0.8; k < 0.9; k += 0.3) { g.moveTo(r * (k + step / r * 0.3), -r * 0.4); g.lineTo(r * (k + step / r * 0.3), -r * 0.05); } g.stroke();
        g.fillStyle = col; ol(g, () => rr(g, -r * 0.8, -r * 1.75 + step, r * 1.6, r * 1.35, r * 0.25));
        g.fillStyle = '#20243a'; ol(g, () => rr(g, -r * 0.55 + face * r * 0.1, -r * 1.5 + step, r * 1.1, r * 0.5, r * 0.2));
        g.fillStyle = f.atk > 0 ? '#fff36b' : '#ff4040'; g.beginPath(); g.arc(face * r * 0.25, -r * 1.25 + step, r * 0.16, 0, TAU); g.fill();
        g.strokeStyle = LINE; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -r * 1.75 + step); g.lineTo(0, -r * 2.1 + step); g.stroke();
        g.fillStyle = Math.sin(t * 5 + f.id) > 0 ? '#ffd23f' : '#7a5c00'; g.beginPath(); g.arc(0, -r * 2.15 + step, r * 0.1, 0, TAU); g.fill();
      } else if (f.type === 'brute') {
        const stomp = Math.abs(Math.sin(f.walk * 3)) * r * 0.1;
        g.fillStyle = '#4a3550'; for (const s of [-1, 1]) ol(g, () => rr(g, s * r * 0.5 - r * 0.25, -r * 0.55, r * 0.5, r * 0.55, r * 0.1));
        g.fillStyle = col; ol(g, () => rr(g, -r * 0.95, -r * 1.75 - stomp, r * 1.9, r * 1.3, r * 0.3));
        g.fillStyle = '#2a1d30'; ol(g, () => rr(g, -r * 0.5 + face * r * 0.15, -r * 1.2 - stomp, r * 1.0, r * 0.35, r * 0.1));
        g.strokeStyle = '#8a6a90'; g.lineWidth = 2; g.beginPath(); for (let k = 0; k < 4; k++) { g.moveTo(-r * 0.35 + face * r * 0.15 + k * r * 0.22, -r * 1.16 - stomp); g.lineTo(-r * 0.35 + face * r * 0.15 + k * r * 0.22, -r * 0.9 - stomp); } g.stroke();
        g.fillStyle = '#ffb000'; for (const ex of [-0.3, 0.3]) { g.beginPath(); g.arc(ex * r + face * r * 0.15, -r * 1.45 - stomp, r * 0.12, 0, TAU); g.fill(); }
        // claws
        const swing = f.atk > 0 ? Math.sin(t * 30) * 0.5 : Math.sin(f.walk * 3) * 0.2;
        for (const s of [-1, 1]) { g.save(); g.translate(s * r * 1.05, -r * 1.2 - stomp); g.rotate(swing * s); g.fillStyle = '#8a8fa8'; ol(g, () => { g.beginPath(); g.moveTo(0, 0); g.lineTo(s * r * 0.45, r * 0.25); g.lineTo(s * r * 0.15, r * 0.5); g.lineTo(s * r * 0.35, r * 0.65); g.lineTo(-s * r * 0.05, r * 0.45); g.closePath(); }); g.restore(); }
      } else {
        // the Warden: a walking security tower with a screen face
        const sway = Math.sin(f.walk * 2) * r * 0.05;
        g.fillStyle = '#3d2f6b'; for (const s of [-1, 1]) ol(g, () => rr(g, s * r * 0.45 - r * 0.2, -r * 0.6, r * 0.4, r * 0.6, r * 0.08));
        g.fillStyle = col; ol(g, () => rr(g, -r * 0.8, -r * 2.0 + sway, r * 1.6, r * 1.5, r * 0.25));
        g.fillStyle = '#5a4699'; for (const s of [-1, 1]) ol(g, () => { g.beginPath(); g.arc(s * r * 0.85, -r * 1.75 + sway, r * 0.28, 0, TAU); });
        g.fillStyle = Math.sin(t * 6) > 0 ? '#ff3b3b' : '#ffd23f'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * r * 0.85, -r * 1.75 + sway, r * 0.11, 0, TAU); g.fill(); }
        g.fillStyle = '#0b0f24'; ol(g, () => rr(g, -r * 0.55, -r * 1.85 + sway, r * 1.1, r * 0.7, r * 0.12));
        // angry screen eyes
        g.fillStyle = f.atk > 0 ? '#fff36b' : '#ff4f6d';
        g.save(); g.translate(0, -r * 1.5 + sway);
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r * 0.4, -r * 0.12); g.lineTo(s * r * 0.08, -r * 0.02); g.lineTo(s * r * 0.08, r * 0.12); g.lineTo(s * r * 0.4, r * 0.08); g.closePath(); g.fill(); }
        g.restore();
        g.fillStyle = '#ffd23f'; g.font = Math.round(r * 0.28) + 'px ' + DISPLAY; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('W-' + Math.max(5, Math.round(f.max / 100)), 0, -r * 0.8 + sway);
      }
      g.restore();
      if (f.hp < f.max && f.type !== 'boss') {
        const bw = b.r * u * 2, by = y - b.r * u * (f.type === 'zip' ? 3.4 : 2.4) - 8;
        g.fillStyle = '#0b0f24'; g.fillRect(x - bw / 2, by, bw, 5);
        g.fillStyle = '#ff6b6b'; g.fillRect(x - bw / 2, by, bw * MS.clamp(f.hp / f.max, 0, 1), 5);
      }
    },

    drawParts(g, under) {
      const u = this.u;
      for (const p of this.parts) {
        const isUnder = p.type === 'beam' || p.type === 'boom';
        if (isUnder !== under) continue;
        const k = p.t / p.life, x = this.X(p.x), y = this.Y(p.y) - p.z * u;
        if (p.type === 'spark') { g.fillStyle = p.color; g.globalAlpha = 1 - k; g.fillRect(x - u * p.size, y - u * p.size, u * p.size * 2, u * p.size * 2); g.globalAlpha = 1; }
        else if (p.type === 'flash') {
          g.save(); g.translate(x, y); g.rotate(p.a || 0); g.globalAlpha = 1 - k; g.fillStyle = p.color;
          g.beginPath(); g.moveTo(0, -u * p.size * 0.5); g.lineTo(u * p.size * 1.8, 0); g.lineTo(0, u * p.size * 0.5); g.lineTo(-u * p.size * 0.3, 0); g.closePath(); g.fill();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, u * p.size * 0.45, 0, TAU); g.fill();
          g.restore();
        } else if (p.type === 'smoke') { g.fillStyle = 'rgba(160,170,200,' + 0.4 * (1 - k) + ')'; g.beginPath(); g.arc(x, y, u * p.size * (0.6 + k), 0, TAU); g.fill(); }
        else if (p.type === 'bolt' || p.type === 'gear' || p.type === 'confetti') {
          g.save(); g.translate(x, y); g.rotate(p.rot); g.globalAlpha = Math.min(1, (1 - k) * 3); g.fillStyle = p.color;
          if (p.type === 'gear') { g.beginPath(); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, q = u * p.size * (i % 2 ? 0.7 : 1); g.lineTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); g.fill(); g.fillStyle = LINE; g.beginPath(); g.arc(0, 0, u * p.size * 0.3, 0, TAU); g.fill(); }
          else g.fillRect(-u * p.size, -u * p.size * 0.35, u * p.size * 2, u * p.size * 0.7);
          g.restore(); g.globalAlpha = 1;
        } else if (p.type === 'cross') { g.globalAlpha = 1 - k; g.fillStyle = p.color; const s2 = u * p.size; g.fillRect(x - s2, y - s2 * 0.35, s2 * 2, s2 * 0.7); g.fillRect(x - s2 * 0.35, y - s2, s2 * 0.7, s2 * 2); g.globalAlpha = 1; }
        else if (p.type === 'beam') {
          g.globalAlpha = 1 - k; const w = u * p.size * (1 - k * 0.5);
          const gr = g.createLinearGradient(x - w, 0, x + w, 0); gr.addColorStop(0, 'rgba(120,240,255,0)'); gr.addColorStop(0.5, 'rgba(200,250,255,.9)'); gr.addColorStop(1, 'rgba(120,240,255,0)');
          g.fillStyle = gr; g.fillRect(x - w, y - u * 3, w * 2, u * 3); g.globalAlpha = 1;
        } else if (p.type === 'boom') {
          const r = u * p.size * MS.easeOut(k * 2);
          g.globalAlpha = 1 - k; g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x, y - u * 0.2, r, 0, TAU); g.fill();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y - u * 0.2, r * 0.55, 0, TAU); g.fill(); g.globalAlpha = 1;
        }
      }
    },

    // ---------- frame ----------
    draw(m, opts) {
      opts = opts || {};
      const g = this.ctx, dpr = this.dpr, u = this.u, st = MS.Save.data.settings;
      const key = [this.canvas.width, this.canvas.height].join(':');
      if (key !== this.roomKey) { this.roomKey = key; this.paintRoom(); }
      let sx = 0, sy = 0;
      if (st.shake && this.shake > 0.3) { sx = (Math.random() - 0.5) * this.shake * this.hs; sy = (Math.random() - 0.5) * this.shake * this.hs; }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(this.room, Math.round(sx * dpr), Math.round(sy * dpr));
      g.drawImage(this.decals, Math.round((this.ox + sx) * dpr), Math.round((this.oy + sy) * dpr));
      g.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
      // pulsing floor lights
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 2);
      g.fillStyle = 'rgba(100,240,255,' + (0.1 + 0.15 * pulse) + ')';
      for (let i = 0; i < 8; i++) { const ly = this.Y(0.5 + i * 1.1); g.fillRect(this.X(0.06), ly, u * 0.14, u * 0.3); g.fillRect(this.X(VW - 0.2), ly, u * 0.14, u * 0.3); }
      this.drawParts(g, true);
      // mines
      for (const mi of m.mines) {
        const x = this.X(mi.x), y = this.Y(mi.y), armed = mi.t > 0.6;
        g.fillStyle = 'rgba(181,123,255,.18)'; g.beginPath(); g.ellipse(x, y, u * 0.8, u * 0.3, 0, 0, TAU); g.fill();
        g.fillStyle = '#4a3a6b'; ol(g, () => { g.beginPath(); g.ellipse(x, y, u * 0.2, u * 0.1, 0, 0, TAU); });
        g.fillStyle = armed && Math.sin(this.time * 12) > 0 ? '#ff5d5d' : '#b57bff'; g.beginPath(); g.arc(x, y - u * 0.04, u * 0.06, 0, TAU); g.fill();
      }
      // rings
      for (const r of m.rings) {
        const k = r.t / 0.4; g.strokeStyle = r.color; g.globalAlpha = 1 - k; g.lineWidth = u * 0.12 * (1 - k) + 2;
        g.beginPath(); g.ellipse(this.X(r.x), this.Y(r.y), r.r * u * MS.easeOut(k), r.r * u * MS.easeOut(k) * 0.55, 0, 0, TAU); g.stroke(); g.globalAlpha = 1;
      }
      // depth-sorted bodies
      const items = [];
      for (const h of m.heroes) items.push({ k: h.y, h });
      for (const f of m.foes) items.push({ k: f.y, f });
      items.sort((a, b) => a.k - b.k);
      for (const it of items) {
        if (it.h) {
          const h = it.h, x = this.X(h.x), y = this.Y(h.y);
          this.drawHero(g, h, x, y, u);
          if (h.down) {
            const bb = 0.5 + 0.5 * Math.sin(this.time * 6);
            g.fillStyle = 'rgba(255,255,255,.95)'; rr(g, x - u * 0.38, y - u * 1.25, u * 0.76, u * 0.32, u * 0.1); g.fill();
            g.fillStyle = '#e84d4d'; g.font = Math.round(u * 0.2) + 'px ' + DISPLAY; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HELP!', x, y - u * 1.09);
            g.strokeStyle = 'rgba(125,255,142,' + (0.3 + bb * 0.3) + ')'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.ellipse(x, y, u * 1.2, u * 0.5, 0, 0, TAU); g.stroke(); g.setLineDash([]);
            if (h.revive > 0) { g.strokeStyle = '#7dff8e'; g.lineWidth = 5; g.beginPath(); g.arc(x, y - u * 0.5, u * 0.55, -Math.PI / 2, -Math.PI / 2 + (h.revive / MS.Sim.REVIVE) * TAU); g.stroke(); }
          }
          if (!h.down && opts.tags) {
            const slot = MS.SLOTS[h.slot];
            g.fillStyle = slot.color; g.font = Math.round(u * 0.22) + 'px ' + DISPLAY; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(opts.tags[h.i], x, y - u * 1.3);
            if (h.cool <= 0) { g.strokeStyle = 'rgba(255,255,255,' + (0.4 + 0.4 * Math.sin(this.time * 8)) + ')'; g.lineWidth = 2; g.beginPath(); g.arc(x, y - u * 1.3, u * 0.22, 0, TAU); g.stroke(); }
          }
        } else this.drawFoe(g, it.f, this.X(it.f.x), this.Y(it.f.y), u);
      }
      // lasers
      for (const s of m.shots) {
        const x = this.X(s.x), y = this.Y(s.y) - u * 0.42, len = s.big ? 0.9 : 0.45, sp = Math.hypot(s.vx, s.vy);
        const tx = x - (s.vx / sp) * u * len, ty = y - (s.vy / sp) * u * len;
        g.lineCap = 'round';
        g.strokeStyle = s.color; g.globalAlpha = 0.5; g.lineWidth = u * (s.big ? 0.32 : 0.12); g.beginPath(); g.moveTo(tx, ty); g.lineTo(x, y); g.stroke();
        g.globalAlpha = 1; g.strokeStyle = '#fff'; g.lineWidth = u * (s.big ? 0.12 : 0.045); g.beginPath(); g.moveTo(tx, ty); g.lineTo(x, y); g.stroke();
      }
      this.drawParts(g, false);
      for (const n of this.nums) {
        g.globalAlpha = 1 - n.t / 0.8; g.fillStyle = n.color; g.font = Math.round(u * 0.3) + 'px ' + DISPLAY; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(n.str, this.X(n.x), this.Y(n.y)); g.globalAlpha = 1;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // red alarm light while a boss is loose
      const bossAlive = m.foes.some((f) => f.type === 'boss');
      if (bossAlive) {
        const a = 0.08 + 0.08 * Math.sin(this.time * 5);
        const gr = g.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.3, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.7);
        gr.addColorStop(0, 'rgba(255,40,60,0)'); gr.addColorStop(1, 'rgba(255,40,60,' + a * 2.5 + ')');
        g.fillStyle = gr; g.fillRect(0, 0, this.W, this.H);
      }
      if (this.flash > 0) { g.fillStyle = 'rgba(255,255,240,' + this.flash * 0.5 + ')'; g.fillRect(0, 0, this.W, this.H); }
    },
  };

  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // fill the current path and give it a dark cartoon outline
  function ol(g, path) { path(); g.fill(); g.strokeStyle = LINE; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke(); }
  function badge(g, shape, x, y, r) {
    if (shape === 'circle') g.arc(x, y, r, 0, TAU);
    else if (shape === 'square') g.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
    else if (shape === 'triangle') { g.moveTo(x, y - r * 1.1); g.lineTo(x + r, y + r * 0.8); g.lineTo(x - r, y + r * 0.8); g.closePath(); }
    else { g.moveTo(x, y - r * 1.15); g.lineTo(x + r * 1.15, y); g.lineTo(x, y + r * 1.15); g.lineTo(x - r * 1.15, y); g.closePath(); }
  }
  R.rr = rr; R.ol = ol; R.badge = badge;
  MS.Render = R;
})();
