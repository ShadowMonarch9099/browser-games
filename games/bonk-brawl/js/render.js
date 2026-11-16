// Bonk Brawl drawing: a loud comic book. Each stage is a layered parallax
// scene (far layers pre-rendered once per size), the camera pans and zooms to
// keep everyone in shot, fighters are rubber-hose cartoons with squash and
// stretch, and hits pop comic words, impact frames and KO blasts.
(function () {
  const TAU = Math.PI * 2, VW = 16, VH = 9;
  const DISPLAY = '"Bangers", "Impact", "Arial Black", sans-serif';
  const BODY = '"Fredoka", "Trebuchet MS", "Segoe UI", sans-serif';
  const INK = '#151018';
  const WORDS_L = ['BONK!', 'POP!', 'BIFF!', 'BOP!', 'THWAP!'];
  const WORDS_H = ['WHAM!', 'KAPOW!', 'SMASH!', 'KA-BLAM!', 'WALLOP!'];

  const R = {
    canvas: null, ctx: null, W: 0, H: 0, dpr: 1, u0: 40, u: 40, cam: { x: 8, y: 4.6, z: 1 },
    layers: {}, layerKey: '', parts: [], words: [], shake: 0, flash: 0, impact: null, time: 0, vis: new Map(), DISPLAY, BODY, INK,
    hudTop: 0,

    init(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      addEventListener('resize', () => this.resize());
      this.resize();
    },
    resize() {
      const c = this.canvas;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.W = c.clientWidth || innerWidth; this.H = c.clientHeight || innerHeight;
      c.width = Math.round(this.W * this.dpr); c.height = Math.round(this.H * this.dpr);
      this.layerKey = '';
      this.viewH = this.viewH || this.H; this.u = this.u || 40;
      this.hs = BB.clamp(Math.min(this.W / 1000, this.H / 620), 0.5, 1.6);
    },
    resetCam() { this.cam = { x: 8, y: 4.6, z: 1 }; },

    // ---------- camera ----------
    updateCam(m, dt, hud) {
      const W = this.W, H = this.H - (hud ? 96 * this.hs : 0);
      this.u0 = Math.min(W / 17.5, H / 10.6);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
      for (const f of m.fighters) {
        if (f.out) continue;
        const fx = BB.clamp(f.x, -1, VW + 1), fy = BB.clamp(f.y, -1, VH + 1);
        x0 = Math.min(x0, fx); x1 = Math.max(x1, fx); y0 = Math.min(y0, fy - 1.2); y1 = Math.max(y1, fy); n++;
      }
      let tx = 8, ty = 4.6, tz = 1;
      if (n) {
        x0 = Math.min(x0, m.stage.plats[0][0] + 1); x1 = Math.max(x1, m.stage.plats[0][0] + m.stage.plats[0][2] - 1);
        tx = (x0 + x1) / 2; ty = BB.clamp((y0 + y1) / 2, 3.2, 6);
        tz = BB.clamp(Math.min(W / ((x1 - x0 + 6) * this.u0), H / ((y1 - y0 + 5) * this.u0)), 1, 1.45);
        if (m.phase === 'game' && m.winner >= 0) { const w = m.fighters[m.winner]; tx = w.x; ty = w.y - 1; tz = 1.7; }
      }
      const k = Math.min(1, dt * 3);
      this.cam.x += (BB.clamp(tx, 6, 10) - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
      this.cam.z += (tz - this.cam.z) * k;
      this.u = this.u0 * this.cam.z;
      this.viewH = H;
    },
    X(wx) { return this.W / 2 + (wx - this.cam.x) * this.u; },
    Y(wy) { return this.viewH * 0.55 + (wy - this.cam.y) * this.u; },

    // ---------- stage art ----------
    // Far layers are painted once per size into canvases 1.5x the screen
    // width, then slid for parallax.
    paintLayers(si) {
      const W = this.W, H = this.H, dpr = this.dpr, LW = Math.ceil(W * 1.5);
      const mk = () => { const c = document.createElement('canvas'); c.width = Math.ceil(LW * dpr); c.height = Math.ceil(H * dpr); const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, g]; };
      const rand = BB.rng(91 + si);
      const [sky, gs] = mk(), [far, gf] = mk(), [mid, gm] = mk();
      const hz = H * 0.62;
      if (si === 0) {
        let gr = gs.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1d0b4a'); gr.addColorStop(0.6, '#6a1b7a'); gr.addColorStop(1, '#ff4f8b');
        gs.fillStyle = gr; gs.fillRect(0, 0, LW, H);
        halftone(gs, LW, H, 'rgba(255,214,102,.13)', 14, (x, y) => 1 - y / H);
        // moon
        gs.fillStyle = '#ffe066'; ink(gs, () => { gs.beginPath(); gs.arc(LW * 0.66, H * 0.24, H * 0.11, 0, TAU); }, 4);
        gs.fillStyle = 'rgba(255,170,40,.45)'; for (const [dx, dy, r] of [[-0.03, -0.02, 0.022], [0.035, 0.03, 0.016], [0.0, 0.05, 0.012]]) { gs.beginPath(); gs.arc(LW * 0.66 + dx * H, H * 0.24 + dy * H, r * H, 0, TAU); gs.fill(); }
        for (let i = 0; i < 60; i++) { gs.fillStyle = 'rgba(255,255,255,' + (0.4 + rand() * 0.6) + ')'; star(gs, rand() * LW, rand() * H * 0.45, 1 + rand() * 2.5, 4); }
        // far skyline
        for (let x = -20; x < LW; ) {
          const w = 30 + rand() * 60, h = H * (0.18 + rand() * 0.25);
          gf.fillStyle = '#3b1460'; gf.fillRect(x, hz - h, w, H - hz + h);
          gf.fillStyle = 'rgba(255,224,102,.55)';
          for (let wy = hz - h + 8; wy < H; wy += 12) for (let wx = x + 5; wx < x + w - 6; wx += 10) if (rand() < 0.3) gf.fillRect(wx, wy, 4, 6);
          x += w + 4;
        }
        // mid buildings with neon signs
        for (let x = -40; x < LW; ) {
          const w = 70 + rand() * 90, h = H * (0.1 + rand() * 0.2);
          gm.fillStyle = '#26093f'; gm.strokeStyle = INK; gm.lineWidth = 4;
          gm.fillRect(x, hz + 30 - h, w, H); gm.strokeRect(x, hz + 30 - h, w, H);
          if (rand() < 0.45) {
            const sx = x + 10, sy = hz + 30 - h - 34, word = rand.pick(['POW', 'ZAP', 'BAM', 'DINER', 'HOTEL']);
            gm.font = '26px ' + DISPLAY; gm.lineWidth = 6; gm.strokeStyle = INK; gm.strokeText(word, sx, sy + 24);
            gm.fillStyle = rand.pick(['#ff4fd8', '#4ff0ff', '#ffe14f']); gm.fillText(word, sx, sy + 24);
          }
          x += w + 10 + rand() * 30;
        }
      } else if (si === 1) {
        let gr = gs.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#ff7b54'); gr.addColorStop(0.55, '#ffb26b'); gr.addColorStop(1, '#ffd56b');
        gs.fillStyle = gr; gs.fillRect(0, 0, LW, H);
        // striped sun
        gs.save(); gs.beginPath(); gs.arc(LW * 0.4, hz - H * 0.04, H * 0.2, 0, TAU); gs.clip();
        gs.fillStyle = '#ff4f6d'; gs.fillRect(0, 0, LW, H);
        gs.fillStyle = '#ffd56b'; for (let i = 0; i < 6; i++) gs.fillRect(0, hz - H * 0.04 + i * H * 0.035, LW, H * 0.012 + i * 1.5);
        gs.restore();
        halftone(gs, LW, H, 'rgba(255,79,109,.16)', 12, (x, y) => y / H);
        // roller coaster silhouette
        gf.strokeStyle = '#a63d5a'; gf.lineWidth = 5; gf.beginPath();
        for (let x = 0; x <= LW; x += 8) { const y = hz - 40 - Math.abs(Math.sin(x * 0.008)) * H * 0.22 - Math.sin(x * 0.021) * 18; x === 0 ? gf.moveTo(x, y) : gf.lineTo(x, y); }
        gf.stroke();
        gf.lineWidth = 2; gf.beginPath();
        for (let x = 0; x <= LW; x += 24) { const y = hz - 40 - Math.abs(Math.sin(x * 0.008)) * H * 0.22 - Math.sin(x * 0.021) * 18; gf.moveTo(x, y); gf.lineTo(x, hz); }
        gf.stroke();
        // sea
        let sea = gm.createLinearGradient(0, hz, 0, H); sea.addColorStop(0, '#3fa7d6'); sea.addColorStop(1, '#1d5f8a');
        gm.fillStyle = sea; gm.fillRect(0, hz, LW, H - hz);
        gm.strokeStyle = INK; gm.lineWidth = 4; gm.beginPath(); gm.moveTo(0, hz); gm.lineTo(LW, hz); gm.stroke();
        gm.strokeStyle = 'rgba(255,255,255,.6)'; gm.lineWidth = 3;
        for (let i = 0; i < 50; i++) { const x = rand() * LW, y = hz + 10 + rand() * (H - hz); gm.beginPath(); gm.moveTo(x, y); gm.quadraticCurveTo(x + 8, y - 5, x + 16, y); gm.stroke(); }
        // tents
        for (let x = 30; x < LW; x += 260 + rand() * 160) {
          const w = 90, h = 70;
          gm.fillStyle = '#fff'; gm.beginPath(); gm.moveTo(x, hz); gm.lineTo(x + w / 2, hz - h); gm.lineTo(x + w, hz); gm.closePath(); gm.fill(); gm.stroke();
          gm.fillStyle = '#ef233c'; for (let k = 0; k < 4; k += 2) { gm.beginPath(); gm.moveTo(x + w / 2, hz - h); gm.lineTo(x + (k / 4) * w, hz); gm.lineTo(x + ((k + 1) / 4) * w, hz); gm.closePath(); gm.fill(); }
          gm.beginPath(); gm.moveTo(x, hz); gm.lineTo(x + w / 2, hz - h); gm.lineTo(x + w, hz); gm.stroke();
        }
      } else {
        let gr = gs.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#36c2f5'); gr.addColorStop(1, '#bff1ff');
        gs.fillStyle = gr; gs.fillRect(0, 0, LW, H);
        halftone(gs, LW, H, 'rgba(255,255,255,.22)', 16, (x, y) => y / H);
        // volcano
        const vx = LW * 0.55;
        gf.fillStyle = '#7a4a3a'; ink(gf, () => { gf.beginPath(); gf.moveTo(vx - H * 0.5, hz + 10); gf.lineTo(vx - H * 0.09, hz - H * 0.36); gf.lineTo(vx + H * 0.09, hz - H * 0.36); gf.lineTo(vx + H * 0.5, hz + 10); gf.closePath(); }, 5);
        gf.fillStyle = '#ff6b1a'; gf.beginPath(); gf.moveTo(vx - H * 0.09, hz - H * 0.36); gf.lineTo(vx + H * 0.09, hz - H * 0.36); gf.lineTo(vx + H * 0.04, hz - H * 0.28); gf.lineTo(vx, hz - H * 0.32); gf.lineTo(vx - H * 0.05, hz - H * 0.25); gf.closePath(); gf.fill();
        gf.strokeStyle = INK; gf.lineWidth = 4; gf.stroke();
        // sea and palm islands
        let sea = gm.createLinearGradient(0, hz, 0, H); sea.addColorStop(0, '#16c0c9'); sea.addColorStop(1, '#0b6e99');
        gm.fillStyle = sea; gm.fillRect(0, hz, LW, H - hz);
        gm.strokeStyle = INK; gm.lineWidth = 4; gm.beginPath(); gm.moveTo(0, hz); gm.lineTo(LW, hz); gm.stroke();
        halftone(gm, LW, H, 'rgba(255,255,255,.12)', 10, (x, y) => (y > hz ? 1 - (y - hz) / (H - hz) : 0));
        for (let x = 60; x < LW; x += 300 + rand() * 200) palm(gm, x, hz + 6, 0.8 + rand() * 0.4);
      }
      // flatten the far layer into the sky (one parallax rate) and keep only
      // the painted strip of the mid layer, so a frame costs two blits
      gs.setTransform(1, 0, 0, 1, 0, 0); gs.drawImage(far, 0, 0);
      const midTop = Math.max(0, si === 0 ? H * 0.25 : si === 1 ? hz - 80 : hz - 200);
      this.layers = { sky, mid, LW, midTop };
    },

    drawBackdrop(g, m) {
      const si = m.stageIndex, key = [this.W, this.H, si, this.dpr].join(':');
      if (key !== this.layerKey) { this.layerKey = key; this.paintLayers(si); }
      const L = this.layers, W = this.W, dpr = this.dpr, off = (this.cam.x - 8) * this.u;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const vy = (this.cam.y - 4.6) * this.u;
      // unscaled, pixel-aligned blits are much cheaper than scaled ones
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(L.sky, Math.round((-(L.LW - W) / 2 - off * 0.1) * dpr), Math.round(Math.min(0, -vy * 0.1) * dpr));
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // animated far details
      if (si === 1) this.ferris(g, W * 0.72 - off * 0.15, this.H * 0.62 - vy * 0.15 - this.H * 0.2, this.H * 0.18);
      if (si === 2) this.smoke(g, W / 2 + (L.LW * 0.05) - off * 0.1, this.H * 0.62 - this.H * 0.36 - vy * 0.1);
      if (si === 2) this.clouds(g, off * 0.1);
      const sy0 = Math.floor(L.midTop * dpr);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(L.mid, 0, sy0, L.mid.width, L.mid.height - sy0, Math.round((-(L.LW - W) / 2 - off * 0.35) * dpr), Math.round((L.midTop - vy * 0.35) * dpr), L.mid.width, L.mid.height - sy0);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (vy > 0) { g.fillStyle = si === 0 ? '#26093f' : si === 1 ? '#1d5f8a' : '#0b6e99'; g.fillRect(0, this.H - vy * 0.35 - 2, W, vy * 0.35 + 4); }
      if (si === 0) this.searchlights(g, off * 0.25);
    },
    ferris(g, x, y, r) {
      g.save(); g.translate(x, y);
      g.strokeStyle = '#a63d5a'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(-r * 0.6, r * 1.15); g.lineTo(0, 0); g.lineTo(r * 0.6, r * 1.15); g.stroke();
      g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
      const a0 = this.time * 0.25;
      for (let i = 0; i < 10; i++) {
        const a = a0 + (i / 10) * TAU, cx = Math.cos(a) * r, cy = Math.sin(a) * r;
        g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(cx, cy); g.stroke();
        g.fillStyle = ['#ef233c', '#ffd23f', '#4cc9f0'][i % 3]; g.fillRect(cx - 6, cy, 12, 10);
      }
      g.restore();
    },
    smoke(g, x, y) {
      for (let i = 0; i < 5; i++) {
        const k = ((this.time * 0.15 + i / 5) % 1), r = 14 + k * 40;
        g.fillStyle = 'rgba(90,80,80,' + (0.5 * (1 - k)) + ')';
        g.beginPath(); g.arc(x + Math.sin(k * 6 + i) * 18 + k * 50, y - k * 140, r, 0, TAU); g.fill();
      }
    },
    clouds(g, off) {
      g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const x = ((i * 380 + this.time * (10 + i * 4) - off) % (this.W + 300)) - 150, y = 50 + i * 38;
        g.beginPath(); g.arc(x, y, 26, Math.PI, 0); g.arc(x + 34, y - 10, 30, Math.PI, 0); g.arc(x + 70, y, 24, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
      }
    },
    searchlights(g, off) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2; i++) {
        const bx = this.W * (0.25 + i * 0.5) - off, by = this.H * 0.7, a = -Math.PI / 2 + Math.sin(this.time * 0.5 + i * 2) * 0.5;
        g.fillStyle = 'rgba(255,240,180,.07)'; g.beginPath(); g.moveTo(bx, by);
        g.lineTo(bx + Math.cos(a - 0.08) * this.H, by + Math.sin(a - 0.08) * this.H); g.lineTo(bx + Math.cos(a + 0.08) * this.H, by + Math.sin(a + 0.08) * this.H); g.closePath(); g.fill();
      }
      g.restore();
    },

    drawPlatforms(g, m) {
      const u = this.u, si = m.stageIndex;
      for (const p of m.stage.plats) {
        const x = this.X(p[0]), y = this.Y(p[1]), w = p[2] * u;
        if (p[3]) {
          const depth = u * 2.2;
          if (si === 0) { // rooftop
            g.fillStyle = '#5c2a6e'; ink(g, () => { g.beginPath(); g.rect(x + u * 0.2, y, w - u * 0.4, depth * 1.6); }, 4);
            g.fillStyle = 'rgba(255,224,102,.75)';
            for (let wy = y + u * 0.55; wy < y + depth * 1.6; wy += u * 0.55) for (let wx = x + u * 0.5; wx < x + w - u * 0.6; wx += u * 0.7) if (((wx * 7 + wy * 3) | 0) % 5 < 3) g.fillRect(wx, wy, u * 0.22, u * 0.3);
            g.fillStyle = '#c0533a'; ink(g, () => { g.beginPath(); g.rect(x, y - u * 0.05, w, u * 0.38); }, 4);
            g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.5; g.beginPath();
            for (let bx = x + u * 0.3; bx < x + w; bx += u * 0.45) { g.moveTo(bx, y - u * 0.05); g.lineTo(bx, y + u * 0.33); }
            g.stroke();
            // AC unit and antenna props
            g.fillStyle = '#b8c4d6'; ink(g, () => { g.beginPath(); g.rect(x + w * 0.78, y - u * 0.5, u * 0.7, u * 0.45); }, 3);
            g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(x + w * 0.12, y - u * 0.05); g.lineTo(x + w * 0.12, y - u * 1.1); g.moveTo(x + w * 0.12 - u * 0.3, y - u * 0.8); g.lineTo(x + w * 0.12 + u * 0.3, y - u * 0.8); g.stroke();
            g.fillStyle = Math.sin(this.time * 4) > 0 ? '#ff3b3b' : '#6b1414'; g.beginPath(); g.arc(x + w * 0.12, y - u * 1.12, u * 0.08, 0, TAU); g.fill();
          } else if (si === 1) { // pier
            g.fillStyle = '#6b4226';
            for (let px = x + u * 0.4; px < x + w; px += u * 1.3) ink(g, () => { g.beginPath(); g.rect(px, y, u * 0.28, depth * 2); }, 3);
            g.fillStyle = '#c98b52'; ink(g, () => { g.beginPath(); g.rect(x, y - u * 0.05, w, u * 0.42); }, 4);
            g.strokeStyle = 'rgba(80,40,10,.45)'; g.lineWidth = 2; g.beginPath();
            for (let bx = x + u * 0.6; bx < x + w; bx += u * 0.6) { g.moveTo(bx, y - u * 0.05); g.lineTo(bx, y + u * 0.37); }
            g.stroke();
            // bunting
            g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - u * 1.4); g.quadraticCurveTo(x + w / 2, y - u * 0.9, x + w, y - u * 1.4); g.stroke();
            for (let k = 1; k < 12; k++) {
              const t = k / 12, bx = x + w * t, by = y - u * 1.4 + Math.sin(t * Math.PI) * u * 0.25 * 2 * 0.5 * 2 * 0.5 * 2;
              g.fillStyle = ['#ef233c', '#ffd23f', '#4cc9f0', '#70e000'][k % 4];
              g.beginPath(); g.moveTo(bx - u * 0.12, by); g.lineTo(bx + u * 0.12, by); g.lineTo(bx, by + u * 0.28); g.closePath(); g.fill();
            }
          } else { // island
            g.fillStyle = '#8b5a3c'; ink(g, () => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w - u * 0.6, y + depth); g.quadraticCurveTo(x + w / 2, y + depth * 1.6, x + u * 0.6, y + depth); g.closePath(); }, 4);
            g.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + w * (0.2 + k * 0.12), y + depth * (0.4 + (k % 3) * 0.18), u * 0.12, 0, TAU); g.fill(); }
            g.fillStyle = '#5bd13b'; ink(g, () => { g.beginPath(); g.moveTo(x - u * 0.1, y + u * 0.25); for (let k = 0; k <= 10; k++) g.lineTo(x + (w * k) / 10, y - u * 0.08 + ((k % 2) ? u * 0.32 : 0)); g.lineTo(x + w + u * 0.1, y + u * 0.25); g.lineTo(x + w + u * 0.1, y - u * 0.08); g.lineTo(x - u * 0.1, y - u * 0.08); g.closePath(); }, 3);
          }
        } else {
          const th = u * 0.24;
          const col = si === 0 ? '#ffd23f' : si === 1 ? '#fff' : '#d8a35d';
          g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + u * 0.1, y + th, w - u * 0.2, u * 0.12);
          g.fillStyle = col; ink(g, () => { rr(g, x, y - u * 0.04, w, th, th * 0.4); }, 3.5);
          if (si === 1) { g.fillStyle = '#ef233c'; for (let k = 0; k < w; k += u * 0.4) g.fillRect(x + k, y - u * 0.02, u * 0.2, th - u * 0.04); g.strokeStyle = INK; g.lineWidth = 3.5; rr(g, x, y - u * 0.04, w, th, th * 0.4); g.stroke(); }
          if (si === 2) { g.strokeStyle = 'rgba(80,40,10,.5)'; g.lineWidth = 2; g.beginPath(); for (let k = u * 0.35; k < w; k += u * 0.35) { g.moveTo(x + k, y - u * 0.04); g.lineTo(x + k, y + th - u * 0.04); } g.stroke(); }
          if (si === 0) { g.fillStyle = INK; g.font = Math.round(th * 0.8) + 'px ' + DISPLAY; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★ BONK ★', x + w / 2, y + th / 2 - u * 0.03); }
        }
      }
    },

    // ---------- fighters ----------
    visOf(f) {
      let v = this.vis.get(f);
      if (!v) { v = { sx: 1, sy: 1, blink: 0, flash: 0, trail: [] }; this.vis.set(f, v); }
      return v;
    },
    drawFighter(g, f, x, y, u, opts) {
      opts = opts || {};
      const c = f.c, v = opts.vis || this.visOf(f), t = this.time;
      const hurt = f.stun > 0, atk = f.atk, air = !f.ground;
      const ink2 = Math.max(2, u * 0.055);
      g.save(); g.translate(x, y);
      // shadow / player ring
      if (!opts.noRing) {
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, 0, u * 0.45, u * 0.1, 0, 0, TAU); g.fill();
      }
      g.scale(f.face || 1, 1);
      // squash and stretch, anchored at the feet
      g.scale(v.sx, v.sy);
      let lean = 0;
      if (hurt) lean = f.tumble ? f.hurtT * 14 : -0.3;
      else if (atk) lean = atk.t < atk.at ? (atk.heavy ? -0.35 : -0.1) * (atk.t / atk.at) : (atk.heavy ? 0.35 : 0.15) * (1 - (atk.t - atk.at) / (atk.end - atk.at));
      else if (Math.abs(f.vx) > 1 && !air) lean = 0.1;
      const bodyH = c.id === 'clank' ? 1.25 : c.id === 'sumo' ? 1.05 : c.id === 'zephyr' ? 1.05 : 1.15;
      const cy = -u * bodyH * 0.5;
      g.translate(0, cy); g.rotate(lean); g.translate(0, -cy);
      const breathe = !air && !hurt && !atk && Math.abs(f.vx) < 0.5 ? Math.sin(t * 3 + f.i) * u * 0.02 : 0;
      // limbs: rubber hose
      const run = f.runT * 5;
      const legSwing = air ? 0 : Math.abs(f.vx) > 0.5 ? Math.sin(run) : 0;
      const hipY = -u * 0.32, hipX = u * 0.16;
      const leg = (side, sw) => {
        const fx = side * hipX + sw * u * 0.22, fy = air ? (f.vy < 0 ? -u * 0.12 : -u * 0.02) : -Math.max(0, -Math.cos(run) * side) * u * 0.08 * Math.abs(legSwing);
        hose(g, side * hipX * 0.7, hipY, fx, fy, ink2 * 1.8, c.dark, (side * hipX * 0.7 + fx) / 2 + u * 0.08, (hipY + fy) / 2);
        g.fillStyle = c.id === 'clank' ? '#566' : INK; g.beginPath(); g.ellipse(fx + u * 0.07, fy, u * 0.13, u * 0.07, 0, 0, TAU); g.fill();
      };
      if (hurt) { leg(-1, Math.sin(t * 20)); leg(1, -Math.sin(t * 20)); } else { leg(-1, legSwing); leg(1, -legSwing); }
      // back arm
      const shoulderY = -u * bodyH * 0.62 + breathe;
      const armBack = () => {
        let hx = -u * 0.32, hy = shoulderY + u * 0.3;
        if (air && !hurt) { hx = -u * 0.3; hy = shoulderY - u * 0.25; }
        if (hurt) { hx = -u * 0.4 + Math.sin(t * 18) * u * 0.1; hy = shoulderY - u * 0.4; }
        if (Math.abs(f.vx) > 0.5 && !air && !atk) { hx = -u * 0.3 - legSwing * u * 0.15; hy = shoulderY + u * 0.28; }
        hose(g, -u * 0.12, shoulderY, hx, hy, ink2 * 1.6, c.dark, (hx - u * 0.12) / 2, (shoulderY + hy) / 2 + u * 0.08);
        glove(g, hx, hy, u * 0.11, c);
      };
      armBack();
      // tail / kite / key behind the body
      if (c.id === 'rascal') {
        const sw = Math.sin(t * 4 + f.i) * 0.3 + (air ? -0.5 : 0);
        g.save(); g.translate(-u * 0.28, -u * 0.38); g.rotate(-2.3 + sw);
        for (let k = 0; k < 5; k++) { g.fillStyle = k % 2 ? INK : c.color; ink(g, () => { g.beginPath(); g.ellipse(u * 0.12 * k + u * 0.12, 0, u * 0.11, u * 0.1 - k * u * 0.005, 0, 0, TAU); }, ink2 * 0.7); }
        g.restore();
      } else if (c.id === 'clank') {
        g.save(); g.translate(-u * 0.44, -u * 0.7); g.rotate(t * (atk ? 14 : 3));
        g.fillStyle = c.accent; ink(g, () => { g.beginPath(); g.ellipse(0, -u * 0.13, u * 0.07, u * 0.14, 0, 0, TAU); g.ellipse(0, u * 0.13, u * 0.07, u * 0.14, 0, 0, TAU); }, ink2 * 0.7);
        g.restore();
        g.strokeStyle = INK; g.lineWidth = ink2 * 1.4; g.beginPath(); g.moveTo(-u * 0.38, -u * 0.7); g.lineTo(-u * 0.46, -u * 0.7); g.stroke();
      } else if (c.id === 'zephyr') {
        g.save(); g.translate(-u * 0.3, -u * 0.95); g.rotate(-0.35 + Math.sin(t * 3) * 0.08);
        g.fillStyle = c.accent; ink(g, () => { g.beginPath(); g.moveTo(0, -u * 0.42); g.lineTo(u * 0.24, -u * 0.1); g.lineTo(0, u * 0.3); g.lineTo(-u * 0.24, -u * 0.1); g.closePath(); }, ink2 * 0.8);
        g.strokeStyle = INK; g.lineWidth = ink2 * 0.6; g.beginPath(); g.moveTo(0, -u * 0.42); g.lineTo(0, u * 0.3); g.moveTo(-u * 0.24, -u * 0.1); g.lineTo(u * 0.24, -u * 0.1); g.stroke();
        g.restore();
        // scarf
        g.strokeStyle = '#ef233c'; g.lineWidth = u * 0.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(-u * 0.05, -u * 0.72);
        for (let k = 1; k <= 4; k++) g.lineTo(-u * 0.05 - k * u * 0.16, -u * 0.7 + Math.sin(t * 9 - k) * u * 0.06 * k * 0.6 + (air ? -k * u * 0.03 : 0));
        g.stroke();
      }
      // body
      g.translate(0, breathe);
      this.body(g, f, u, ink2, hurt, v);
      // front arm
      let hx = u * 0.3, hy = shoulderY + u * 0.32, big = false;
      if (air && !hurt && !atk) { hx = u * 0.34; hy = shoulderY - u * 0.28; }
      if (Math.abs(f.vx) > 0.5 && !air && !atk) { hx = u * 0.28 + legSwing * u * 0.15; hy = shoulderY + u * 0.3; }
      if (hurt) { hx = u * 0.4 - Math.sin(t * 18) * u * 0.1; hy = shoulderY - u * 0.45; }
      if (atk) {
        if (atk.t < atk.at) { const k = atk.t / atk.at; hx = u * (0.3 - (atk.heavy ? 0.7 : 0.35) * k); hy = shoulderY + (atk.heavy ? -u * 0.35 * k : u * 0.1); }
        else {
          const k = BB.clamp((atk.t - atk.at) / 0.08, 0, 1), rec = BB.clamp((atk.t - atk.at - 0.08) / (atk.end - atk.at), 0, 1);
          const reach = atk.heavy ? 1.05 : 0.8;
          hx = u * (0.3 + (reach - 0.3) * k * (1 - rec * 0.7)); hy = shoulderY + u * (atk.heavy ? 0.05 : 0) ; big = true;
          // smear arc
          if (rec < 0.6) {
            g.strokeStyle = atk.heavy ? 'rgba(255,214,51,.9)' : 'rgba(255,255,255,.85)'; g.lineWidth = u * (atk.heavy ? 0.22 : 0.12) * (1 - rec);
            g.beginPath(); g.arc(0, shoulderY + u * 0.1, u * reach, atk.heavy ? -1.4 : -0.5, atk.heavy ? 0.6 : 0.25); g.stroke();
          }
        }
      }
      hose(g, u * 0.12, shoulderY, hx, hy, ink2 * 1.6, c.dark, (hx + u * 0.12) / 2, (shoulderY + hy) / 2 + u * 0.1);
      glove(g, hx, hy, u * (big ? (atk && atk.heavy ? 0.2 : 0.15) : 0.12), c);
      g.restore();
      // dizzy stars
      if (hurt && f.stun > 0.25) {
        for (let k = 0; k < 3; k++) {
          const a = t * 6 + (k / 3) * TAU;
          g.fillStyle = '#ffe14f'; g.strokeStyle = INK; g.lineWidth = 1.5;
          const sx = x + Math.cos(a) * u * 0.4, sy = y - u * 1.45 + Math.sin(a) * u * 0.12;
          g.beginPath(); starPath(g, sx, sy, u * 0.09, 5); g.fill(); g.stroke();
        }
      }
    },
    body(g, f, u, w, hurt, v) {
      const c = f.c, t = this.time;
      const blink = (Math.sin(t * 1.3 + f.i * 2) > 0.985) || v.blink > 0;
      const eye = (ex, ey, r, look) => {
        g.fillStyle = '#fff'; ink(g, () => { g.beginPath(); g.ellipse(ex, ey, r * 0.85, r, 0, 0, TAU); }, w * 0.6);
        if (hurt) { g.strokeStyle = INK; g.lineWidth = w * 0.7; g.beginPath(); g.moveTo(ex - r * 0.5, ey - r * 0.5); g.lineTo(ex + r * 0.5, ey + r * 0.5); g.moveTo(ex + r * 0.5, ey - r * 0.5); g.lineTo(ex - r * 0.5, ey + r * 0.5); g.stroke(); }
        else if (blink) { g.fillStyle = INK; g.fillRect(ex - r * 0.8, ey - w * 0.3, r * 1.6, w * 0.6); }
        else { g.fillStyle = INK; g.beginPath(); g.arc(ex + r * 0.3 + (look || 0), ey, r * 0.45, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + r * 0.4, ey - r * 0.25, r * 0.15, 0, TAU); g.fill(); }
      };
      const mouth = (mx, my, s) => {
        g.strokeStyle = INK; g.lineWidth = w * 0.7; g.beginPath();
        if (hurt) { g.ellipse(mx, my, s * 0.3, s * 0.4, 0, 0, TAU); g.fillStyle = '#7a1630'; g.fill(); g.stroke(); return; }
        if (f.atk) { g.moveTo(mx - s * 0.4, my); g.lineTo(mx + s * 0.4, my - s * 0.1); g.stroke(); return; }
        g.arc(mx, my - s * 0.2, s * 0.4, 0.3, Math.PI - 0.3); g.stroke();
      };
      if (c.id === 'rascal') {
        g.fillStyle = c.color; ink(g, () => { rr(g, -u * 0.34, -u * 1.15, u * 0.68, u * 0.85, u * 0.32); }, w);
        // ears
        for (const s of [-1, 1]) { g.fillStyle = c.color; ink(g, () => { g.beginPath(); g.moveTo(s * u * 0.12, -u * 1.08); g.lineTo(s * u * 0.3, -u * 1.36); g.lineTo(s * u * 0.33, -u * 1.0); g.closePath(); }, w * 0.8); }
        g.fillStyle = c.belly; ink(g, () => { g.beginPath(); g.ellipse(u * 0.04, -u * 0.55, u * 0.22, u * 0.22, 0, 0, TAU); }, w * 0.6);
        // bandit mask
        g.fillStyle = c.accent; g.beginPath(); g.ellipse(u * 0.08, -u * 0.88, u * 0.3, u * 0.12, 0, 0, TAU); g.fill();
        eye(u * 0.0, -u * 0.88, u * 0.085); eye(u * 0.2, -u * 0.88, u * 0.085);
        g.fillStyle = INK; g.beginPath(); g.arc(u * 0.33, -u * 0.74, u * 0.05, 0, TAU); g.fill();
        mouth(u * 0.2, -u * 0.62, u * 0.18);
      } else if (c.id === 'clank') {
        g.fillStyle = c.color; ink(g, () => { rr(g, -u * 0.38, -u * 1.25, u * 0.76, u * 0.95, u * 0.08); }, w);
        g.fillStyle = c.belly; ink(g, () => { rr(g, -u * 0.22, -u * 0.72, u * 0.44, u * 0.32, u * 0.05); }, w * 0.6);
        g.fillStyle = '#ef233c'; g.beginPath(); g.arc(-u * 0.08, -u * 0.56, u * 0.05, 0, TAU); g.fill();
        g.fillStyle = '#70e000'; g.beginPath(); g.arc(u * 0.08, -u * 0.56, u * 0.05, 0, TAU); g.fill();
        g.fillStyle = INK; for (const [rx, ry] of [[-0.31, -1.18], [0.31, -1.18], [-0.31, -0.37], [0.31, -0.37]]) { g.beginPath(); g.arc(rx * u, ry * u, u * 0.025, 0, TAU); g.fill(); }
        // antenna
        g.strokeStyle = INK; g.lineWidth = w; g.beginPath(); g.moveTo(0, -u * 1.25); g.lineTo(0, -u * 1.45); g.stroke();
        g.fillStyle = Math.sin(t * 6) > 0 || hurt ? '#ef233c' : c.accent; ink(g, () => { g.beginPath(); g.arc(0, -u * 1.5, u * 0.07, 0, TAU); }, w * 0.6);
        // visor eyes
        g.fillStyle = INK; rr(g, -u * 0.26, -u * 1.08, u * 0.6, u * 0.22, u * 0.08); g.fill();
        if (hurt) { g.fillStyle = '#ff5050'; g.font = Math.round(u * 0.2) + 'px ' + DISPLAY; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('x  x', u * 0.04, -u * 0.97); }
        else if (!blink) { g.fillStyle = c.accent; g.fillRect(-u * 0.15, -u * 1.02, u * 0.13, u * 0.1); g.fillRect(u * 0.1, -u * 1.02, u * 0.13, u * 0.1); }
        g.fillStyle = INK; for (let k = 0; k < 4; k++) g.fillRect(-u * 0.08 + k * u * 0.07, -u * 0.8, u * 0.04, u * 0.05);
      } else if (c.id === 'sumo') {
        g.fillStyle = c.color; ink(g, () => { g.beginPath(); g.ellipse(0, -u * 0.55, u * 0.5, u * 0.47, 0, 0, TAU); }, w);
        // eye bumps on top
        for (const ex of [-0.18, 0.18]) { g.fillStyle = c.color; ink(g, () => { g.beginPath(); g.arc(ex * u, -u * 0.98, u * 0.15, 0, TAU); }, w * 0.8); }
        eye(-u * 0.16, -u * 0.98, u * 0.1); eye(u * 0.2, -u * 0.98, u * 0.1);
        g.fillStyle = c.belly; ink(g, () => { g.beginPath(); g.ellipse(u * 0.06, -u * 0.45, u * 0.3, u * 0.28, 0, 0, TAU); }, w * 0.6);
        // belt (mawashi)
        g.fillStyle = c.accent; ink(g, () => { g.beginPath(); g.rect(-u * 0.47, -u * 0.3, u * 0.94, u * 0.14); }, w * 0.7);
        g.strokeStyle = INK; g.lineWidth = w * 0.8; g.beginPath();
        if (hurt) g.ellipse(u * 0.2, -u * 0.72, u * 0.12, u * 0.08, 0, 0, TAU);
        else g.arc(u * 0.1, -u * 0.82, u * 0.3, 0.35, Math.PI * 0.75);
        g.stroke();
        g.fillStyle = 'rgba(255,120,150,.55)'; g.beginPath(); g.arc(u * 0.36, -u * 0.72, u * 0.06, 0, TAU); g.fill();
      } else {
        g.fillStyle = c.color; ink(g, () => { rr(g, -u * 0.28, -u * 0.78, u * 0.56, u * 0.5, u * 0.18); }, w);
        g.fillStyle = c.belly; g.fillRect(-u * 0.02, -u * 0.74, u * 0.06, u * 0.42);
        // head
        g.fillStyle = '#ffd9b8'; ink(g, () => { g.beginPath(); g.arc(u * 0.02, -u * 0.98, u * 0.25, 0, TAU); }, w);
        // leather cap and goggles
        g.fillStyle = '#8a4b2a'; ink(g, () => { g.beginPath(); g.arc(u * 0.02, -u * 1.0, u * 0.26, Math.PI, 0); g.closePath(); }, w);
        g.fillStyle = '#9fe2ff'; ink(g, () => { g.beginPath(); g.arc(-u * 0.05, -u * 1.12, u * 0.08, 0, TAU); g.arc(u * 0.13, -u * 1.12, u * 0.08, 0, TAU); }, w * 0.6);
        eye(u * 0.0, -u * 0.95, u * 0.065); eye(u * 0.15, -u * 0.95, u * 0.065);
        mouth(u * 0.12, -u * 0.83, u * 0.14);
      }
    },

    // ---------- effects ----------
    spawn(p) { if (this.parts.length < 400) this.parts.push(Object.assign({ t: 0, vx: 0, vy: 0, g: 0, rot: 0, vr: 0 }, p)); },
    word(str, x, y, size, color, rot) { this.words.push({ str, x, y, size, color, rot, t: 0, life: 0.75 }); if (this.words.length > 10) this.words.shift(); },
    onEvent(e, m, loud) {
      const rnd = Math.random, st = BB.Save.data.settings;
      if (e.t === 'jump') {
        const f = m.fighters[e.i], v = this.visOf(f); v.sx = 0.75; v.sy = 1.3;
        for (let i = 0; i < (e.double ? 8 : 5); i++) this.spawn({ type: e.double ? 'ring' : 'puff', x: e.x + (rnd() - 0.5) * 0.5, y: e.y, vx: (rnd() - 0.5) * 2, vy: -rnd() * 0.5, life: 0.4, size: 0.18 + rnd() * 0.12 });
      } else if (e.t === 'land') {
        const f = m.fighters[e.i], v = this.visOf(f); v.sx = e.hard ? 1.45 : 1.25; v.sy = e.hard ? 0.65 : 0.8;
        for (let i = 0; i < 6; i++) this.spawn({ type: 'puff', x: e.x + (i - 2.5) * 0.15, y: e.y, vx: (i - 2.5) * 0.9, vy: -0.4, life: 0.45, size: 0.15 + rnd() * 0.1 });
        if (e.hard) this.shake = Math.max(this.shake, 5);
      } else if (e.t === 'swing') {
        const f = m.fighters[e.i], v = this.visOf(f); if (e.heavy) { v.sx = 1.15; v.sy = 0.9; }
      } else if (e.t === 'hit') {
        const to = m.fighters[e.to], v = this.visOf(to); v.flash = 0.12; v.sx = 1.35; v.sy = 0.7;
        const big = e.heavy, power = BB.clamp(e.kb / 14, 0, 1.5);
        const words = big ? WORDS_H : WORDS_L;
        this.word(words[(rnd() * words.length) | 0], e.x, e.y - 0.6, (big ? 1.2 : 0.75) + power * 0.4, big ? '#ffd233' : '#fff', (rnd() - 0.5) * 0.5);
        this.spawn({ type: 'burst', x: e.x, y: e.y, life: big ? 0.28 : 0.18, size: big ? 1.2 : 0.7, color: big ? '#ff3d3d' : '#fff' });
        for (let i = 0; i < (big ? 12 : 6); i++) { const a = rnd() * TAU, sp = 3 + rnd() * 6; this.spawn({ type: 'spark', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.3, size: 0.06 + rnd() * 0.05, color: rnd() < 0.5 ? '#ffd233' : '#fff' }); }
        this.shake = Math.max(this.shake, big ? 10 + power * 8 : 4);
        if (big && st.impact) this.impact = { x: e.x, y: e.y, t: 0, life: 0.12 + Math.min(0.1, e.kb * 0.006) };
        if (e.kb > 9) v.launch = 1;
      } else if (e.t === 'ko') {
        const f = m.fighters[e.i];
        this.spawn({ type: 'ko', x: e.x, y: e.y, side: e.side, life: 1.1, color: BB.SLOTS[f.slot].color });
        for (let i = 0; i < 30; i++) { const a = rnd() * TAU, sp = 4 + rnd() * 10; this.spawn({ type: 'spark', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6, size: 0.1 + rnd() * 0.08, color: ['#ffd233', '#ff3d3d', '#fff', BB.SLOTS[f.slot].color][i % 4] }); }
        this.shake = 22; if (st.impact) this.flash = 0.6;
      } else if (e.t === 'respawn') {
        const f = m.fighters[e.i];
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; this.spawn({ type: 'spark', x: f.x + Math.cos(a) * 0.5, y: f.y - 0.6 + Math.sin(a) * 0.5, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, life: 0.5, size: 0.08, color: '#fff7b0' }); }
      } else if (e.t === 'game') {
        this.flash = 0.8; this.shake = 14;
      }
    },
    update(dt, m) {
      this.time += dt;
      this.shake = Math.max(0, this.shake - dt * 45);
      this.flash = Math.max(0, this.flash - dt * 2.5);
      if (this.impact) { this.impact.t += dt; if (this.impact.t > this.impact.life) this.impact = null; }
      for (const [f, v] of this.vis) {
        v.sx += (1 - v.sx) * Math.min(1, dt * 12); v.sy += (1 - v.sy) * Math.min(1, dt * 12);
        v.flash = Math.max(0, v.flash - dt); v.blink = Math.max(0, v.blink - dt);
        // speed lines while flying from a big hit
        if (m && !f.out && f.stun > 0 && Math.hypot(f.vx, f.vy) > 8 && Math.random() < 0.6) this.spawn({ type: 'puff', x: f.x, y: f.y - 0.6, vx: 0, vy: 0, life: 0.5, size: 0.25 });
      }
      const ps = this.parts;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]; p.t += dt;
        if (p.t >= p.life) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 0.94; p.vy *= 0.94; p.rot += p.vr * dt;
      }
      for (let i = this.words.length - 1; i >= 0; i--) { const w = this.words[i]; w.t += dt; w.y -= dt * 0.6; if (w.t > w.life) this.words.splice(i, 1); }
    },
    drawParts(g) {
      const u = this.u;
      for (const p of this.parts) {
        const k = p.t / p.life, x = this.X(p.x), y = this.Y(p.y);
        if (p.type === 'puff') { g.fillStyle = 'rgba(255,255,255,' + (0.85 * (1 - k)) + ')'; g.strokeStyle = 'rgba(21,16,24,' + (0.6 * (1 - k)) + ')'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, u * p.size * (0.6 + k), 0, TAU); g.fill(); g.stroke(); }
        else if (p.type === 'ring') { g.strokeStyle = 'rgba(255,255,255,' + (1 - k) + ')'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, u * (0.2 + k * 0.6), u * (0.06 + k * 0.15), 0, 0, TAU); g.stroke(); }
        else if (p.type === 'spark') { g.fillStyle = p.color; g.globalAlpha = 1 - k; g.beginPath(); starPath(g, x, y, u * p.size * (1.4 - k), 4); g.fill(); g.globalAlpha = 1; }
        else if (p.type === 'burst') {
          g.save(); g.translate(x, y); g.rotate(p.t * 3); const r = u * p.size * (0.5 + BB.easeOut(k * 2) * 0.7);
          g.globalAlpha = 1 - k * k; g.fillStyle = p.color; g.strokeStyle = INK; g.lineWidth = 4;
          g.beginPath(); for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU, rr2 = r * (i % 2 ? 0.5 : 1); g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } g.closePath(); g.fill(); g.stroke();
          g.restore(); g.globalAlpha = 1;
        } else if (p.type === 'ko') this.koBlast(g, p, k);
      }
    },
    // A comic explosion where the fighter left the screen, aimed back inwards.
    koBlast(g, p, k) {
      const W = this.W, H = this.viewH;
      const sx = p.side === 'left' ? 0 : p.side === 'right' ? W : BB.clamp(this.X(p.x), 40, W - 40);
      const sy = p.side === 'bottom' ? H : p.side === 'top' ? 0 : BB.clamp(this.Y(p.y), 40, H - 40);
      const ang = Math.atan2(H / 2 - sy, W / 2 - sx);
      g.save(); g.translate(sx, sy); g.rotate(ang);
      const len = Math.min(W, H) * 0.75 * BB.easeOut(k * 3), wid = Math.min(W, H) * 0.32 * (1 - k);
      g.globalAlpha = 1 - k;
      g.fillStyle = p.color; g.strokeStyle = INK; g.lineWidth = 6;
      g.beginPath(); g.moveTo(0, -wid * 0.3); g.lineTo(len, -wid * 0.08); g.lineTo(len * 1.05, 0); g.lineTo(len, wid * 0.08); g.lineTo(0, wid * 0.3); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -wid * 0.12); g.lineTo(len * 0.9, 0); g.lineTo(0, wid * 0.12); g.closePath(); g.fill();
      g.fillStyle = '#ffd233';
      g.beginPath(); const r = Math.min(W, H) * 0.16 * (0.6 + BB.easeOut(k * 4) * 0.6);
      for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU, q = r * (i % 2 ? 0.55 : 1); g.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
      g.closePath(); g.fill(); g.stroke();
      g.restore();
      g.save(); g.globalAlpha = 1 - k;
      const tx = BB.clamp(sx + Math.cos(ang) * 110, 90, W - 90), ty = BB.clamp(sy + Math.sin(ang) * 110, 70, H - 70);
      comicText(g, 'K.O.!', tx, ty, 64 * this.hs * (0.6 + BB.easeBack(k * 4) * 0.5), '#ff3d3d', -0.12);
      g.restore();
    },
    drawWords(g) {
      for (const w of this.words) {
        const k = w.t / w.life, s = BB.easeBack(Math.min(1, w.t / 0.15)) * (1 + k * 0.1);
        g.save(); g.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        comicText(g, w.str, this.X(w.x), this.Y(w.y), this.u * 0.55 * w.size * s, w.color, w.rot);
        g.restore();
      }
    },

    // ---------- frame ----------
    draw(m, opts) {
      opts = opts || {};
      const g = this.ctx, W = this.W, H = this.H, dpr = this.dpr, u = this.u;
      this.drawBackdrop(g, m);
      const st = BB.Save.data.settings;
      let sx = 0, sy = 0;
      if (st.shake && this.shake > 0.3) { sx = (Math.random() - 0.5) * this.shake * this.hs; sy = (Math.random() - 0.5) * this.shake * this.hs; }
      g.setTransform(dpr, 0, 0, dpr, sx * dpr, sy * dpr);
      this.drawPlatforms(g, m);
      // fighters, back to front by id with the attacker on top
      const list = m.fighters.filter((f) => !f.out).sort((a, b) => (a.atk ? 1 : 0) - (b.atk ? 1 : 0));
      for (const f of list) {
        const x = this.X(f.x), y = this.Y(f.y), v = this.visOf(f);
        if (f.safe > 0 && m.phase !== 'countdown') {
          g.strokeStyle = 'rgba(255,247,176,' + (0.5 + 0.4 * Math.sin(this.time * 12)) + ')'; g.lineWidth = 4;
          g.beginPath(); g.arc(x, y - u * 0.6, u * 0.85, 0, TAU); g.stroke();
        }
        // player marker above the head
        const slot = BB.SLOTS[f.slot];
        this.drawFighter(g, f, x, y, u, { vis: v });
        if (v.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + Math.min(0.8, v.flash * 7) + ')'; g.beginPath(); g.ellipse(x, y - u * 0.6, u * 0.6, u * 0.75, 0, 0, TAU); g.fill(); }
        if (!opts.noTags) {
          const ty = y - u * 1.75 - Math.abs(Math.sin(this.time * 3 + f.i)) * u * 0.05;
          g.fillStyle = slot.color; g.strokeStyle = INK; g.lineWidth = 2.5;
          g.beginPath(); g.moveTo(x - u * 0.1, ty + u * 0.12); g.lineTo(x + u * 0.1, ty + u * 0.12); g.lineTo(x, ty + u * 0.26); g.closePath(); g.fill(); g.stroke();
          const label = opts.labels ? opts.labels[f.i] : slot.name;
          g.font = Math.round(u * 0.3) + 'px ' + DISPLAY; g.textAlign = 'center'; g.textBaseline = 'middle';
          const tw = g.measureText(label).width + u * 0.25;
          rr(g, x - tw / 2, ty - u * 0.15, tw, u * 0.3, u * 0.08); g.fill(); g.stroke();
          g.fillStyle = '#fff'; g.fillText(label, x, ty + u * 0.01);
        }
        // off-screen pointer bubble
        if (x < 0 || x > W || y < 0 || y > this.viewH) {
          const bx = BB.clamp(x, 34, W - 34), by = BB.clamp(y, 34, this.viewH - 34);
          g.fillStyle = '#fff'; g.strokeStyle = slot.color; g.lineWidth = 4;
          g.beginPath(); g.arc(bx, by, 26, 0, TAU); g.fill(); g.stroke();
          this.drawFighter(g, f, bx, by + 14, 22, { vis: v, noRing: true });
        }
      }
      this.drawParts(g);
      this.drawWords(g);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // impact frame: inverted ink burst with speed lines from the hit
      if (this.impact) {
        const ix = this.X(this.impact.x), iy = this.Y(this.impact.y), k = this.impact.t / this.impact.life;
        g.save();
        g.globalAlpha = 0.55 * (1 - k);
        g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
        g.globalAlpha = 0.8 * (1 - k);
        g.strokeStyle = INK; g.lineWidth = 3;
        g.beginPath();
        for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU + i * 0.37, r0 = 60 + (i % 5) * 30, r1 = Math.max(W, H); g.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0); g.lineTo(ix + Math.cos(a) * r1, iy + Math.sin(a) * r1); }
        g.stroke();
        g.restore();
      }
      if (this.flash > 0) { g.fillStyle = 'rgba(255,250,220,' + this.flash * 0.5 + ')'; g.fillRect(0, 0, W, H); }
      // comic page frame
      g.strokeStyle = INK; g.lineWidth = 8 * this.hs; g.strokeRect(0, 0, W, H);
    },
  };

  // ---------- helpers ----------
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function ink(g, path, w) { path(); g.fill(); g.strokeStyle = INK; g.lineWidth = w; g.lineJoin = 'round'; g.stroke(); }
  function hose(g, x0, y0, x1, y1, w, color, cx, cy) {
    g.lineCap = 'round';
    g.strokeStyle = INK; g.lineWidth = w + 3.5; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke();
    g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke();
  }
  function glove(g, x, y, r, c) {
    g.fillStyle = c.id === 'clank' ? '#b8c4d6' : '#fff';
    ink(g, () => { g.beginPath(); g.arc(x, y, r, 0, TAU); }, Math.max(2, r * 0.35));
    g.strokeStyle = INK; g.lineWidth = Math.max(1, r * 0.2); g.beginPath(); g.arc(x - r * 0.1, y, r * 0.5, -1, 0.6); g.stroke();
  }
  function starPath(g, x, y, r, n) {
    for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU - Math.PI / 2, q = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
    g.closePath();
  }
  function star(g, x, y, r, n) { g.beginPath(); starPath(g, x, y, r, n); g.fill(); }
  function halftone(g, w, h, color, step, amt) {
    g.fillStyle = color;
    for (let y = 0; y < h; y += step) for (let x = ((y / step) % 2) * step / 2; x < w; x += step) {
      const r = step * 0.42 * BB.clamp(amt(x, y), 0, 1);
      if (r > 0.4) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    }
  }
  function palm(g, x, y, s) {
    g.strokeStyle = INK; g.lineWidth = 12 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 20 * s, y - 60 * s, x + 10 * s, y - 120 * s); g.stroke();
    g.strokeStyle = '#a0703a'; g.lineWidth = 7 * s; g.stroke();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.55, tx = x + 10 * s, ty = y - 120 * s;
      g.fillStyle = '#2fae4a'; g.beginPath(); g.moveTo(tx, ty);
      g.quadraticCurveTo(tx + Math.cos(a - 0.4) * 50 * s, ty + Math.sin(a - 0.4) * 50 * s - 10 * s, tx + Math.cos(a) * 75 * s, ty + Math.sin(a) * 60 * s + 25 * s);
      g.quadraticCurveTo(tx + Math.cos(a + 0.2) * 40 * s, ty + Math.sin(a + 0.2) * 40 * s, tx, ty);
      g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
    }
  }
  // Chunky comic lettering with a black outline and an offset drop shadow.
  function comicText(g, str, x, y, size, color, rot) {
    g.save(); g.translate(x, y); g.rotate(rot || 0);
    g.font = Math.round(size) + 'px ' + DISPLAY; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.fillStyle = INK; g.fillText(str, size * 0.06, size * 0.08);
    g.strokeStyle = INK; g.lineWidth = Math.max(3, size * 0.14); g.strokeText(str, 0, 0);
    g.fillStyle = color; g.fillText(str, 0, 0);
    g.restore();
  }
  // Halftone dots as a cached repeating pattern (cheap to fill any shape).
  const patCache = {};
  R.dots = function (g, color, step) {
    step = Math.max(4, Math.round(step));
    const key = color + '|' + step;
    if (!patCache[key]) {
      const c = document.createElement('canvas'); c.width = step * 2; c.height = step * 2;
      const q = c.getContext('2d'); q.fillStyle = color;
      for (const [x, y] of [[step / 2, step / 2], [step * 1.5, step * 1.5]]) { q.beginPath(); q.arc(x, y, step * 0.3, 0, TAU); q.fill(); }
      patCache[key] = g.createPattern(c, 'repeat');
    }
    return patCache[key];
  };
  R.rr = rr; R.ink = ink; R.comicText = comicText; R.starPath = starPath; R.halftone = halftone;
  BB.Render = R;
})();
