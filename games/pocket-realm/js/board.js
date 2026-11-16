// The tabletop: an oak table, a linen map, and the realm laid on it as an
// isometric board. Every land is a little raised block with a diorama on top
// (trees, huts, peaks, ruins), lit from the upper left. Also the painted
// miniatures: the hero token and the foes met in fights.
(function () {
  const U = PR.U;
  const G = PR.G;
  const COL = PR.COL;
  const R = window.Realm;
  const TAU = Math.PI * 2;
  const SIZE = R.SIZE;

  const LAND = {
    meadow: { top: '#bcd472', side: '#8f7a4a' },
    forest: { top: '#6b9a44', side: '#6d5534' },
    ruins: { top: '#bfb08f', side: '#7d6f58' },
    village: { top: '#d8bd76', side: '#8c6c40' },
    swamp: { top: '#7f8a5f', side: '#5a5038' },
    mountain: { top: '#a3a8b4', side: '#6c6f7a' },
    lake: { top: '#6cb9dc', side: '#5a7a8c' },
    keep: { top: '#6b3a35', side: '#3f2220' },
  };
  PR.LANDCOL = LAND;

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  // ---- small diorama pieces (local coords, s = tile half-width) ----
  function cone(ctx, x, y, s, col) {
    ctx.fillStyle = 'rgba(20,30,10,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + s * 0.12, y, s * 0.22, s * 0.08, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5a3d22';
    ctx.fillRect(x - s * 0.025, y - s * 0.12, s * 0.05, s * 0.12);
    for (let k = 0; k < 3; k++) {
      const by = y - s * (0.1 + k * 0.17);
      const w = s * (0.2 - k * 0.045);
      ctx.fillStyle = shade(col, 0.85 + k * 0.08);
      ctx.beginPath();
      ctx.moveTo(x - w, by);
      ctx.lineTo(x, by - s * 0.3);
      ctx.lineTo(x + w, by);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(col, 1.25);
      ctx.beginPath();
      ctx.moveTo(x - w, by);
      ctx.lineTo(x, by - s * 0.3);
      ctx.lineTo(x - w * 0.15, by);
      ctx.closePath();
      ctx.fill();
    }
  }
  function puff(ctx, x, y, s, col) {
    ctx.fillStyle = 'rgba(20,30,10,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + s * 0.1, y, s * 0.2, s * 0.07, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5a3d22';
    ctx.fillRect(x - s * 0.025, y - s * 0.16, s * 0.05, s * 0.16);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y - s * 0.3, s * 0.17, 0, TAU);
    ctx.fill();
    ctx.fillStyle = shade(col, 1.25);
    ctx.beginPath();
    ctx.arc(x - s * 0.05, y - s * 0.34, s * 0.09, 0, TAU);
    ctx.fill();
  }
  function hut(ctx, x, y, s, wall, roof, t, smoke) {
    const w = s * 0.2;
    const d = s * 0.1;
    const h = s * 0.18;
    ctx.fillStyle = 'rgba(30,20,10,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + s * 0.06, y + d * 0.2, w * 1.3, d * 1.2, 0, 0, TAU);
    ctx.fill();
    // left face, right face
    ctx.fillStyle = wall;
    ctx.beginPath();
    ctx.moveTo(x - w, y - d);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x - w, y - d - h);
    ctx.fill();
    ctx.fillStyle = shade(wall, 0.75);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y - d);
    ctx.lineTo(x + w, y - d - h);
    ctx.lineTo(x, y - h);
    ctx.fill();
    // door
    ctx.fillStyle = '#4a2e18';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.55, y - d * 0.55);
    ctx.lineTo(x - w * 0.3, y - d * 0.3);
    ctx.lineTo(x - w * 0.3, y - d * 0.3 - h * 0.55);
    ctx.lineTo(x - w * 0.55, y - d * 0.55 - h * 0.55);
    ctx.fill();
    // roof
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - w * 1.1, y - d - h);
    ctx.lineTo(x - w * 0.05, y - d - h - s * 0.17);
    ctx.lineTo(x + w * 0.05, y - h - s * 0.17 + d * 0.1);
    ctx.lineTo(x, y - h + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(roof, 0.72);
    ctx.beginPath();
    ctx.moveTo(x, y - h + 2);
    ctx.lineTo(x + w * 0.05, y - h - s * 0.17 + d * 0.1);
    ctx.lineTo(x + w * 1.1, y - d - h);
    ctx.lineTo(x + w * 1.05, y - d - h + 2);
    ctx.closePath();
    ctx.fill();
    if (smoke) {
      for (let k = 0; k < 3; k++) {
        const p = (t * 0.6 + k / 3) % 1;
        ctx.fillStyle = `rgba(240,235,225,${0.5 * (1 - p)})`;
        ctx.beginPath();
        ctx.arc(x + w * 0.5 + Math.sin(p * 6 + k) * 3, y - h - s * 0.2 - p * s * 0.4, s * 0.04 + p * s * 0.05, 0, TAU);
        ctx.fill();
      }
    }
  }
  function peak(ctx, x, y, s, k, snow) {
    const w = s * 0.32 * k;
    const h = s * 0.62 * k;
    ctx.fillStyle = 'rgba(20,20,30,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.3, y, w * 1.1, w * 0.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#b9bdc8';
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x + w * 0.1, y + w * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7c808e';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, y + w * 0.12);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fill();
    if (snow) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.35, y - h * 0.62);
      ctx.lineTo(x, y - h);
      ctx.lineTo(x + w * 0.35, y - h * 0.6);
      ctx.lineTo(x + w * 0.1, y - h * 0.68);
      ctx.lineTo(x - w * 0.1, y - h * 0.58);
      ctx.closePath();
      ctx.fill();
    }
  }
  function column(ctx, x, y, s, h, broken) {
    const w = s * 0.06;
    ctx.fillStyle = 'rgba(30,20,10,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + w, y, w * 1.8, w * 0.7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e4dccb';
    ctx.fillRect(x - w, y - h, w, h);
    ctx.fillStyle = '#b3a990';
    ctx.fillRect(x, y - h, w, h);
    ctx.fillStyle = '#efe8d8';
    ctx.beginPath();
    ctx.ellipse(x, y - h, w, w * 0.45, 0, 0, TAU);
    ctx.fill();
    if (broken) {
      ctx.fillStyle = '#cfc6b0';
      ctx.beginPath();
      ctx.moveTo(x - w, y - h);
      ctx.lineTo(x - w * 0.2, y - h - w * 1.4);
      ctx.lineTo(x + w, y - h);
      ctx.fill();
    }
  }

  // Everything that stands on a land, sorted back to front.
  function diorama(ctx, land, special, tx, ty, s, t, k = 1) {
    const r = (n) => U.hash(tx, ty, n);
    ctx.save();
    if (k < 1) {
      ctx.globalAlpha *= U.clamp01(k * 1.5);
      ctx.scale(U.easeBack(U.clamp01(k)), U.easeBack(U.clamp01(k)));
    }
    const spots = [[-0.42, -0.08], [0.05, -0.25], [0.4, -0.02], [-0.1, 0.18], [0.25, 0.22], [-0.48, 0.2]];
    const at = (i) => [spots[i][0] * s + (r(i) - 0.5) * s * 0.12, spots[i][1] * s * 0.5 + (r(i + 9) - 0.5) * s * 0.06];
    if (land === 'meadow') {
      for (let i = 0; i < 9; i++) {
        const x = (r(i) - 0.5) * s * 1.1;
        const y = (r(i + 20) - 0.5) * s * 0.5;
        ctx.fillStyle = ['#fff6d8', '#f6d24c', '#e9879a'][i % 3];
        ctx.beginPath();
        ctx.arc(x, y, s * 0.035, 0, TAU);
        ctx.fill();
      }
      if (special === 'farm') {
        for (let row = 0; row < 3; row++) {
          ctx.strokeStyle = '#7a5a2e';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-s * 0.5 + row * s * 0.12, -s * 0.02 + row * s * 0.06);
          ctx.lineTo(-s * 0.1 + row * s * 0.12, s * 0.18 + row * s * 0.06);
          ctx.stroke();
          for (let c = 0; c < 4; c++) {
            ctx.fillStyle = '#e8892d';
            ctx.beginPath();
            ctx.arc(-s * 0.46 + row * s * 0.12 + c * s * 0.1, row * s * 0.06 + c * s * 0.05, s * 0.03, 0, TAU);
            ctx.fill();
          }
        }
        hut(ctx, s * 0.28, -s * 0.05, s, '#b5482e', '#6b3a22', t, false);
      } else if (special !== 'home') {
        // a sheep or two
        for (const [x, y] of [at(1), at(4)]) {
          ctx.fillStyle = '#fbf7ee';
          ctx.beginPath();
          ctx.ellipse(x, y - s * 0.06, s * 0.08, s * 0.055, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#2a1d14';
          ctx.beginPath();
          ctx.arc(x + s * 0.07, y - s * 0.08 + Math.sin(t * 2 + x) * 0.8, s * 0.028, 0, TAU);
          ctx.fill();
        }
      } else {
        hut(ctx, s * 0.05, -s * 0.02, s, '#f0e2c0', '#a8322d', t, true);
        ctx.fillStyle = '#5a3d22';
        ctx.fillRect(-s * 0.4, -s * 0.5, 2, s * 0.42);
        ctx.fillStyle = PR.COL.seal;
        ctx.beginPath();
        ctx.moveTo(-s * 0.4 + 2, -s * 0.5);
        ctx.lineTo(-s * 0.2, -s * 0.45 + Math.sin(t * 4) * 2);
        ctx.lineTo(-s * 0.4 + 2, -s * 0.38);
        ctx.fill();
      }
    } else if (land === 'forest') {
      const pts = [at(0), at(1), at(2), at(3), at(4), at(5)].sort((a, b) => a[1] - b[1]);
      const ghost = special === 'grove';
      for (const [x, y] of pts) {
        if (ghost) {
          ctx.globalAlpha *= 0.9;
          cone(ctx, x, y, s * 1.1, '#9fb7ad');
          ctx.globalAlpha /= 0.9;
        } else if (U.hash(Math.round(x), Math.round(y)) < 0.5) cone(ctx, x, y, s * 1.1, '#3f6e2c');
        else puff(ctx, x, y, s, '#4f8a34');
      }
      if (ghost) {
        for (let i = 0; i < 3; i++) {
          const a = t * 0.9 + i * 2.1;
          ctx.fillStyle = 'rgba(220,255,245,0.7)';
          ctx.beginPath();
          ctx.arc(Math.cos(a) * s * 0.35, -s * 0.35 + Math.sin(a * 1.4) * s * 0.1, s * 0.04, 0, TAU);
          ctx.fill();
        }
      }
    } else if (land === 'ruins') {
      ctx.fillStyle = '#d6cdb6';
      ctx.fillRect(-s * 0.32, -s * 0.03, s * 0.5, s * 0.05);
      column(ctx, -s * 0.3, -s * 0.05, s, s * 0.36, false);
      column(ctx, s * 0.1, -s * 0.15, s, s * 0.22, true);
      column(ctx, s * 0.35, s * 0.08, s, s * 0.14, true);
      ctx.fillStyle = '#efe8d8';
      ctx.fillRect(-s * 0.34, -s * 0.44, s * 0.32, s * 0.06);
      ctx.fillStyle = '#b3a990';
      ctx.fillRect(-s * 0.1, s * 0.12, s * 0.12, s * 0.05);
    } else if (land === 'village') {
      if (special === 'witch') {
        hut(ctx, -s * 0.12, -s * 0.05, s * 1.1, '#5a4a6e', '#2e2340', t, true);
        // cauldron bubbling
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.ellipse(s * 0.32, s * 0.12, s * 0.1, s * 0.07, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#7fe36a';
        ctx.beginPath();
        ctx.ellipse(s * 0.32, s * 0.08, s * 0.08, s * 0.03, 0, 0, TAU);
        ctx.fill();
        const b = (t * 1.5) % 1;
        ctx.fillStyle = `rgba(160,255,140,${1 - b})`;
        ctx.beginPath();
        ctx.arc(s * 0.32 + Math.sin(t * 3) * 3, s * 0.05 - b * s * 0.2, s * 0.025, 0, TAU);
        ctx.fill();
      } else {
        hut(ctx, -s * 0.28, -s * 0.06, s, '#f0e2c0', '#a8322d', t, true);
        hut(ctx, s * 0.25, -s * 0.12, s * 0.85, '#e8d7b0', '#6b4a2e', t, false);
        hut(ctx, s * 0.02, s * 0.14, s * 0.8, '#f3e6c6', '#8a3a2a', t, false);
      }
    } else if (land === 'swamp') {
      for (let i = 0; i < 3; i++) {
        const [x, y] = at(i * 2);
        ctx.fillStyle = 'rgba(60,80,50,0.85)';
        ctx.beginPath();
        ctx.ellipse(x, y, s * 0.16, s * 0.07, 0, 0, TAU);
        ctx.fill();
        const b = (t * 0.7 + i * 0.37) % 1;
        ctx.strokeStyle = `rgba(200,220,170,${0.6 * (1 - b)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, y, s * 0.05 + b * s * 0.1, s * 0.02 + b * s * 0.04, 0, 0, TAU);
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const x = (r(i + 40) - 0.5) * s;
        const y = (r(i + 50) - 0.5) * s * 0.5;
        ctx.strokeStyle = '#4d5a2c';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.sin(t + i) * 2, y - s * 0.22);
        ctx.stroke();
        ctx.fillStyle = '#6b4a2a';
        ctx.fillRect(x - 1.5 + Math.sin(t + i) * 2, y - s * 0.24, 3, s * 0.07);
      }
    } else if (land === 'mountain') {
      peak(ctx, -s * 0.2, s * 0.02, s, 1.1, true);
      peak(ctx, s * 0.28, s * 0.12, s, 0.8, true);
      if (special === 'falls') {
        const x = s * 0.02;
        ctx.fillStyle = 'rgba(190,230,255,0.9)';
        ctx.fillRect(x - 3, -s * 0.38, 6, s * 0.46);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const p = (t * 2 + i / 3) % 1;
          ctx.beginPath();
          ctx.moveTo(x - 2, -s * 0.38 + p * s * 0.46);
          ctx.lineTo(x - 2, -s * 0.34 + p * s * 0.46);
          ctx.stroke();
        }
        ctx.fillStyle = '#7ec8ea';
        ctx.beginPath();
        ctx.ellipse(x, s * 0.12, s * 0.18, s * 0.07, 0, 0, TAU);
        ctx.fill();
      }
    } else if (land === 'lake') {
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.4 + i / 3) % 1;
        ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - p)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * (0.1 + p * 0.5), s * (0.05 + p * 0.25), 0, 0, TAU);
        ctx.stroke();
      }
      const bx = Math.sin(t * 0.5) * s * 0.25;
      ctx.fillStyle = '#7a4a2a';
      ctx.beginPath();
      ctx.moveTo(bx - s * 0.12, -s * 0.02);
      ctx.lineTo(bx + s * 0.12, -s * 0.02);
      ctx.lineTo(bx + s * 0.08, s * 0.03);
      ctx.lineTo(bx - s * 0.08, s * 0.03);
      ctx.fill();
      ctx.fillStyle = '#fff6e0';
      ctx.beginPath();
      ctx.moveTo(bx, -s * 0.03);
      ctx.lineTo(bx, -s * 0.25);
      ctx.lineTo(bx + s * 0.1, -s * 0.05);
      ctx.fill();
    } else if (land === 'keep') {
      const tw = (x, y, h) => {
        ctx.fillStyle = '#4a3a3a';
        ctx.fillRect(x - s * 0.08, y - h, s * 0.08, h);
        ctx.fillStyle = '#2e2222';
        ctx.fillRect(x, y - h, s * 0.08, h);
        ctx.fillStyle = '#6a2020';
        ctx.beginPath();
        ctx.moveTo(x - s * 0.1, y - h);
        ctx.lineTo(x, y - h - s * 0.16);
        ctx.lineTo(x + s * 0.1, y - h);
        ctx.fill();
      };
      ctx.fillStyle = '#3d2e2e';
      ctx.fillRect(-s * 0.3, -s * 0.22, s * 0.6, s * 0.22);
      tw(-s * 0.3, 0, s * 0.42);
      tw(s * 0.3, 0, s * 0.42);
      tw(0, -s * 0.1, s * 0.6);
      ctx.fillStyle = '#ff9c3a';
      ctx.fillRect(-s * 0.03, -s * 0.12, s * 0.06, s * 0.1);
      const a = t * 1.2;
      const dx = Math.cos(a) * s * 0.5;
      const dy = -s * 0.9 + Math.sin(a) * s * 0.1;
      ctx.fillStyle = '#8a1a14';
      ctx.beginPath();
      ctx.moveTo(dx - s * 0.12, dy + Math.sin(t * 8) * 3);
      ctx.lineTo(dx, dy + s * 0.03);
      ctx.lineTo(dx + s * 0.12, dy + Math.sin(t * 8) * 3);
      ctx.lineTo(dx, dy - s * 0.02);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- miniatures ----
  function token(ctx, cls, x, y, s, t, o = {}) {
    const hop = o.hop || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(20,10,5,0.4)';
    ctx.beginPath();
    ctx.ellipse(2, 2, s * 0.32 * (1 - hop * 0.3), s * 0.12, 0, 0, TAU);
    ctx.fill();
    ctx.translate(0, -hop * s * 0.4);
    // gold-rimmed base
    ctx.fillStyle = COL.goldDark;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.3, s * 0.12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COL.gold;
    ctx.beginPath();
    ctx.ellipse(0, -2, s * 0.3, s * 0.12, 0, 0, TAU);
    ctx.fill();
    const body = { knight: '#7e93ad', ranger: '#4f7a3a', mage: '#6a3d8f' }[cls] || '#888';
    const sway = Math.sin(t * 2) * 0.03;
    ctx.rotate(sway);
    // robe / body
    ctx.fillStyle = shade(body, 0.8);
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, -2);
    ctx.lineTo(-s * 0.11, -s * 0.5);
    ctx.lineTo(s * 0.11, -s * 0.5);
    ctx.lineTo(s * 0.16, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, -2);
    ctx.lineTo(-s * 0.11, -s * 0.5);
    ctx.lineTo(s * 0.01, -s * 0.5);
    ctx.lineTo(-s * 0.02, -2);
    ctx.closePath();
    ctx.fill();
    // head
    ctx.fillStyle = '#e9c39a';
    ctx.beginPath();
    ctx.arc(0, -s * 0.6, s * 0.1, 0, TAU);
    ctx.fill();
    if (cls === 'knight') {
      ctx.fillStyle = '#b8c3d1';
      ctx.beginPath();
      ctx.arc(0, -s * 0.62, s * 0.11, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-s * 0.012, -s * 0.78, s * 0.024, s * 0.06);
      ctx.fillStyle = PR.COL.seal;
      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.42);
      ctx.lineTo(s * 0.26, -s * 0.42);
      ctx.lineTo(s * 0.26, -s * 0.22);
      ctx.lineTo(s * 0.18, -s * 0.14);
      ctx.lineTo(s * 0.1, -s * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = COL.gold;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (cls === 'ranger') {
      ctx.fillStyle = '#3d5e2c';
      ctx.beginPath();
      ctx.moveTo(-s * 0.13, -s * 0.56);
      ctx.lineTo(0, -s * 0.8);
      ctx.lineTo(s * 0.13, -s * 0.56);
      ctx.fill();
      ctx.strokeStyle = '#7a5230';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s * 0.12, -s * 0.36, s * 0.2, -1.2, 1.2);
      ctx.stroke();
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(s * 0.19, -s * 0.55);
      ctx.lineTo(s * 0.19, -s * 0.17);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#4b2a68';
      ctx.beginPath();
      ctx.moveTo(-s * 0.17, -s * 0.64);
      ctx.lineTo(s * 0.05, -s * 0.98);
      ctx.lineTo(s * 0.17, -s * 0.64);
      ctx.fill();
      ctx.fillStyle = COL.gold;
      ctx.beginPath();
      ctx.arc(s * 0.02, -s * 0.8, s * 0.025, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#7a5230';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.22, -2);
      ctx.lineTo(-s * 0.22, -s * 0.7);
      ctx.stroke();
      ctx.fillStyle = `rgba(150,220,255,${0.6 + Math.sin(t * 4) * 0.3})`;
      ctx.beginPath();
      ctx.arc(-s * 0.22, -s * 0.74, s * 0.05, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Foes, painted large for the duel stage. s ≈ figure height.
  function foe(ctx, type, x, y, s, t, o = {}) {
    ctx.save();
    ctx.translate(x, y);
    if (o.flip) ctx.scale(-1, 1);
    if (o.hurt) ctx.translate(Math.sin(t * 60) * 3, 0);
    ctx.fillStyle = 'rgba(20,10,5,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.4, s * 0.08, 0, 0, TAU);
    ctx.fill();
    const br = Math.sin(t * 2.5) * s * 0.01;
    if (type === 'wolf') {
      ctx.fillStyle = '#6f6f78';
      ctx.beginPath();
      ctx.ellipse(-s * 0.05, -s * 0.3 + br, s * 0.3, s * 0.14, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(-s * 0.3, -s * 0.3, s * 0.06, s * 0.3);
      ctx.fillRect(-s * 0.18, -s * 0.3, s * 0.06, s * 0.3);
      ctx.fillRect(s * 0.08, -s * 0.3, s * 0.06, s * 0.3);
      ctx.fillRect(s * 0.18, -s * 0.3, s * 0.06, s * 0.3);
      ctx.beginPath();
      ctx.moveTo(-s * 0.32, -s * 0.36);
      ctx.quadraticCurveTo(-s * 0.55, -s * 0.5 + Math.sin(t * 5) * s * 0.04, -s * 0.5, -s * 0.28);
      ctx.lineTo(-s * 0.3, -s * 0.28);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * 0.18, -s * 0.42);
      ctx.lineTo(s * 0.48, -s * 0.36);
      ctx.lineTo(s * 0.42, -s * 0.28);
      ctx.lineTo(s * 0.18, -s * 0.26);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s * 0.22, -s * 0.44);
      ctx.lineTo(s * 0.28, -s * 0.58);
      ctx.lineTo(s * 0.32, -s * 0.42);
      ctx.fill();
      ctx.fillStyle = '#ffd34a';
      ctx.beginPath();
      ctx.arc(s * 0.33, -s * 0.38, s * 0.02, 0, TAU);
      ctx.fill();
    } else if (type === 'bandit') {
      ctx.fillStyle = '#5a4030';
      ctx.beginPath();
      ctx.moveTo(-s * 0.18, 0);
      ctx.lineTo(-s * 0.12, -s * 0.6 + br);
      ctx.lineTo(s * 0.12, -s * 0.6 + br);
      ctx.lineTo(s * 0.18, 0);
      ctx.fill();
      ctx.fillStyle = '#3a2a20';
      ctx.beginPath();
      ctx.arc(0, -s * 0.7 + br, s * 0.13, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e9c39a';
      ctx.fillRect(s * 0.0, -s * 0.73 + br, s * 0.1, s * 0.05);
      ctx.fillStyle = '#c9ced8';
      ctx.beginPath();
      ctx.moveTo(s * 0.2, -s * 0.35);
      ctx.lineTo(s * 0.42, -s * 0.5);
      ctx.lineTo(s * 0.24, -s * 0.3);
      ctx.fill();
    } else if (type === 'ghost') {
      const fl = Math.sin(t * 2) * s * 0.05;
      ctx.fillStyle = 'rgba(230,245,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(-s * 0.22, -s * 0.15 + fl);
      ctx.quadraticCurveTo(-s * 0.25, -s * 0.85 + fl, 0, -s * 0.85 + fl);
      ctx.quadraticCurveTo(s * 0.25, -s * 0.85 + fl, s * 0.22, -s * 0.15 + fl);
      for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(s * (0.16 - i * 0.12), -s * (0.05 + (i % 2) * 0.1) + fl + Math.sin(t * 6 + i) * 3, s * (0.11 - i * 0.12), -s * 0.15 + fl);
      ctx.fill();
      ctx.fillStyle = '#2a1d14';
      ctx.beginPath();
      ctx.ellipse(-s * 0.07, -s * 0.6 + fl, s * 0.03, s * 0.05, 0, 0, TAU);
      ctx.ellipse(s * 0.07, -s * 0.6 + fl, s * 0.03, s * 0.05, 0, 0, TAU);
      ctx.fill();
    } else if (type === 'troll') {
      ctx.fillStyle = '#6f8a52';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.42 + br, s * 0.3, s * 0.4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#5a7442';
      ctx.beginPath();
      ctx.arc(s * 0.05, -s * 0.84 + br, s * 0.13, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(s * 0.06, -s * 0.8 + br, s * 0.03, s * 0.04);
      ctx.fillStyle = '#6b4a2a';
      ctx.save();
      ctx.translate(s * 0.28, -s * 0.45);
      ctx.rotate(-0.6 + Math.sin(t * 2) * 0.1);
      ctx.fillRect(-s * 0.04, -s * 0.4, s * 0.09, s * 0.45);
      ctx.beginPath();
      ctx.arc(0, -s * 0.4, s * 0.09, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (type === 'bog') {
      ctx.fillStyle = '#56603a';
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, 0);
      ctx.quadraticCurveTo(-s * 0.3, -s * 0.5 + br, 0, -s * 0.48 + br);
      ctx.quadraticCurveTo(s * 0.3, -s * 0.5 + br, s * 0.35, 0);
      ctx.fill();
      for (const d of [-1, 1]) {
        ctx.strokeStyle = '#56603a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(d * s * 0.1, -s * 0.44);
        ctx.quadraticCurveTo(d * s * 0.16, -s * 0.66, d * s * 0.12 + Math.sin(t * 3 + d) * 4, -s * 0.74);
        ctx.stroke();
        ctx.fillStyle = '#f2f0a0';
        ctx.beginPath();
        ctx.arc(d * s * 0.12 + Math.sin(t * 3 + d) * 4, -s * 0.76, s * 0.05, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#2a1d14';
        ctx.beginPath();
        ctx.arc(d * s * 0.12 + Math.sin(t * 3 + d) * 4 + 1, -s * 0.76, s * 0.022, 0, TAU);
        ctx.fill();
      }
    } else if (type === 'dragon') {
      const flap = Math.sin(t * 3);
      ctx.fillStyle = '#7a1a14';
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(d * s * 0.05, -s * 0.6);
        ctx.lineTo(d * s * 0.55, -s * (0.95 + flap * 0.15));
        ctx.lineTo(d * s * 0.45, -s * 0.55);
        ctx.lineTo(d * s * 0.3, -s * 0.6);
        ctx.lineTo(d * s * 0.22, -s * 0.45);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#a8261c';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.38 + br, s * 0.24, s * 0.3, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e8a35a';
      ctx.beginPath();
      ctx.ellipse(s * 0.02, -s * 0.34 + br, s * 0.12, s * 0.22, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#a8261c';
      ctx.beginPath();
      ctx.moveTo(-s * 0.04, -s * 0.6);
      ctx.quadraticCurveTo(s * 0.0, -s * 0.85, s * 0.18, -s * 0.9);
      ctx.lineTo(s * 0.36, -s * 0.84);
      ctx.lineTo(s * 0.18, -s * 0.78);
      ctx.quadraticCurveTo(s * 0.1, -s * 0.72, s * 0.1, -s * 0.6);
      ctx.fill();
      ctx.fillStyle = '#ffd34a';
      ctx.beginPath();
      ctx.arc(s * 0.2, -s * 0.86, s * 0.022, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e8d7b0';
      ctx.beginPath();
      ctx.moveTo(s * 0.12, -s * 0.9);
      ctx.lineTo(s * 0.06, -s * 1.02);
      ctx.lineTo(s * 0.16, -s * 0.92);
      ctx.fill();
      if (o.breath) {
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = `rgba(255,${120 + i * 20},40,${0.8 - i * 0.12})`;
          ctx.beginPath();
          ctx.arc(s * (0.42 + i * 0.12), -s * 0.84 + Math.sin(t * 20 + i) * 4, s * (0.04 + i * 0.02), 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // ---- the table and the board ----
  let tableCache = null;
  function table(L) {
    const key = L.W + 'x' + L.H;
    if (tableCache && tableCache.key === key) return tableCache.c;
    const c = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = L.W * dpr;
    c.height = L.H * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    // oak planks
    g.fillStyle = '#4a2f1b';
    g.fillRect(0, 0, L.W, L.H);
    for (let i = 0; i < 14; i++) {
      const y = i * 80 - 20;
      g.fillStyle = i % 2 ? '#53351f' : '#4d311c';
      g.fillRect(0, y, L.W, 78);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.moveTo(0, y + 78.5);
      g.lineTo(L.W, y + 78.5);
      g.stroke();
      g.strokeStyle = 'rgba(255,220,170,0.04)';
      for (let k = 0; k < 9; k++) {
        g.beginPath();
        const yy = y + 6 + k * 8 + U.hash(i, k) * 4;
        g.moveTo(0, yy);
        g.bezierCurveTo(L.W * 0.3, yy + 3, L.W * 0.6, yy - 3, L.W, yy + 2);
        g.stroke();
      }
    }
    // linen map cloth under the board
    const b = L.board;
    const cx = b.cx;
    const cy = b.top + b.hh * SIZE;
    const rw = b.hw * SIZE + 46;
    const rh = b.hh * SIZE + 34;
    g.save();
    g.translate(cx, cy);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.moveTo(0 + 6, -rh + 10);
    g.lineTo(rw + 6, 10);
    g.lineTo(6, rh + 10);
    g.lineTo(-rw + 6, 10);
    g.fill();
    const gr = g.createLinearGradient(-rw, -rh, rw, rh);
    gr.addColorStop(0, '#efe0bd');
    gr.addColorStop(1, '#d8c08e');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(0, -rh);
    g.lineTo(rw, 0);
    g.lineTo(0, rh);
    g.lineTo(-rw, 0);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(90,60,30,0.6)';
    g.lineWidth = 2;
    g.stroke();
    g.restore();
    // grid of empty plots
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const [sx, sy] = pos(L, x, y);
        g.strokeStyle = 'rgba(90,60,30,0.28)';
        g.lineWidth = 1;
        diamond(g, sx, sy, b.hw - 2, b.hh - 1);
        g.stroke();
      }
    }
    // a compass in the corner of the cloth
    g.save();
    g.translate(cx + rw * 0.62, cy + rh * 0.55);
    g.fillStyle = 'rgba(90,60,30,0.55)';
    for (let k = 0; k < 4; k++) {
      g.rotate(Math.PI / 2);
      g.beginPath();
      g.moveTo(0, -18);
      g.lineTo(4, 0);
      g.lineTo(-4, 0);
      g.fill();
    }
    g.restore();
    // warm candle light from the upper left, and a vignette
    const lg = g.createRadialGradient(L.W * 0.2, L.H * 0.1, 30, L.W * 0.35, L.H * 0.35, Math.max(L.W, L.H) * 0.9);
    lg.addColorStop(0, 'rgba(255,200,120,0.18)');
    lg.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = lg;
    g.fillRect(0, 0, L.W, L.H);
    tableCache = { key, c };
    return c;
  }

  function pos(L, x, y) {
    const b = L.board;
    return [b.cx + (x - y) * b.hw, b.top + (x + y) * b.hh + b.hh];
  }
  function diamond(g, x, y, hw, hh) {
    g.beginPath();
    g.moveTo(x, y - hh);
    g.lineTo(x + hw, y);
    g.lineTo(x, y + hh);
    g.lineTo(x - hw, y);
    g.closePath();
  }

  // A land block: sides, top, then its diorama. rise 0..1 animates placing.
  function block(ctx, L, tile, x, y, t, rise = 1) {
    const b = L.board;
    const [sx, sy0] = pos(L, x, y);
    const k = U.easeBack(U.clamp01(rise));
    const H = 10 * U.clamp01(rise * 1.3);
    const drop = (1 - U.easeOut(U.clamp01(rise * 1.4))) * -60;
    const sy = sy0 - H + drop;
    const c = LAND[tile.land];
    const hw = b.hw - 1;
    const hh = b.hh - 0.5;
    ctx.save();
    ctx.globalAlpha *= U.clamp01(rise * 3);
    // left and right faces
    ctx.fillStyle = shade(c.side, 1.05);
    ctx.beginPath();
    ctx.moveTo(sx - hw, sy);
    ctx.lineTo(sx, sy + hh);
    ctx.lineTo(sx, sy + hh + H);
    ctx.lineTo(sx - hw, sy + H);
    ctx.fill();
    ctx.fillStyle = shade(c.side, 0.75);
    ctx.beginPath();
    ctx.moveTo(sx + hw, sy);
    ctx.lineTo(sx, sy + hh);
    ctx.lineTo(sx, sy + hh + H);
    ctx.lineTo(sx + hw, sy + H);
    ctx.fill();
    // top
    diamond(ctx, sx, sy, hw, hh);
    const gr = ctx.createLinearGradient(sx - hw, sy - hh, sx + hw, sy + hh);
    gr.addColorStop(0, shade(c.top, 1.12));
    gr.addColorStop(1, shade(c.top, 0.9));
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.strokeStyle = 'rgba(42,29,20,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.translate(sx, sy);
    diorama(ctx, tile.land, tile.special || (tile.name === 'Home' ? 'home' : null), x, y, b.hw, t, k);
    ctx.restore();
  }

  PR.Board = {
    pos,
    diamond,
    table,
    block,
    diorama,
    token,
    foe,
    shade,
    // board cell under a point, or null
    cellAt(L, px, py) {
      const b = L.board;
      const a = (px - b.cx) / b.hw;
      const c = (py + 6 - b.top - b.hh) / b.hh;
      const x = Math.round((a + c) / 2);
      const y = Math.round((c - a) / 2);
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
      // check it is really inside that diamond
      const [sx, sy] = pos(L, x, y);
      if (Math.abs(px - sx) / b.hw + Math.abs(py + 6 - sy) / b.hh > 1.05) return null;
      return [x, y];
    },
  };
})();
