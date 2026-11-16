// The hero (Pip) and the four creatures, drawn as inked paper cut-outs.
// Positions are the feet, in px; s is the size of one tile.
(function () {
  const P = BB.POWERS;
  const INK = BB.COL.ink;
  const TAU = Math.PI * 2;

  function ell(ctx, x, y, rx, ry, fill, lw = 2.5, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (lw) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
  }

  function eye(ctx, x, y, r, blink, look = 0) {
    if (blink > 0.5) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.2, r * 0.8, 0.2, Math.PI - 0.2);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 1.15, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(x + look * r * 0.35, y + r * 0.1, r * 0.62, r * 0.72, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + look * r * 0.35 + r * 0.22, y - r * 0.2, r * 0.22, 0, TAU);
    ctx.fill();
  }

  // Blink: closed for ~0.12s every few seconds, offset by a seed.
  BB.blink = (t, seed = 0) => ((t + seed * 1.7) % 3.4 < 0.12 ? 1 : 0);

  // st: { face, power, sq, run, ground, gliding, climbing, vy, t, alpha, scarf }
  BB.drawHero = function (ctx, x, y, s, st) {
    const f = st.face || 1;
    const t = st.t || 0;
    const sq = st.sq || 1;
    const pw = st.power ? P[st.power] : null;
    const run = st.run || 0; // 0..1 how fast we are running
    const ph = st.phase || 0;
    ctx.save();
    if (st.alpha !== undefined) ctx.globalAlpha *= st.alpha;
    ctx.translate(x, y);
    if (st.climbing) ctx.rotate(-f * 0.12);
    else if (st.ground) ctx.rotate(f * run * 0.08);
    const rx = s * 0.33 * sq;
    const ry = (s * 0.37) / sq;
    const by = -s * 0.2 - ry; // body centre
    const lift = st.ground ? Math.abs(Math.sin(ph)) * run * s * 0.07 : 0;

    // owl wings spread behind while gliding, folded cape otherwise
    if (st.power === 'o') {
      const spread = st.gliding ? 1 : 0.25;
      const flap = st.gliding ? Math.sin(t * 9) * 0.12 : 0;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(0, by - lift);
        ctx.rotate(side * (0.4 + spread * 0.9) + flap * side);
        ctx.beginPath();
        ctx.moveTo(0, -ry * 0.3);
        const L = s * (0.4 + spread * 0.55);
        ctx.quadraticCurveTo(side * L * 0.6, -ry * 0.9, side * L, -ry * 0.1);
        for (let k = 0; k < 3; k++) ctx.quadraticCurveTo(side * L * (0.9 - k * 0.25), ry * 0.15, side * L * (0.72 - k * 0.25), ry * 0.05);
        ctx.closePath();
        ctx.fillStyle = pw.color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.restore();
      }
    }
    // the scarf trails behind, flapping with speed
    {
      const sw = st.scarf || 0;
      const wav = Math.sin(t * 14) * s * 0.05 * (0.4 + sw);
      ctx.beginPath();
      const sx = -f * rx * 0.6;
      const sy = by + ry * 0.35 - lift;
      ctx.moveTo(sx, sy - s * 0.05);
      ctx.quadraticCurveTo(sx - f * s * (0.25 + sw * 0.3), sy - s * 0.1 + wav, sx - f * s * (0.45 + sw * 0.35), sy + wav * 1.5 - s * 0.02);
      ctx.lineTo(sx - f * s * (0.42 + sw * 0.35), sy + s * 0.12 + wav);
      ctx.quadraticCurveTo(sx - f * s * 0.2, sy + s * 0.1, sx, sy + s * 0.08);
      ctx.closePath();
      ctx.fillStyle = BB.COL.red;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    // turtle shell backpack
    if (st.power === 't') {
      ctx.save();
      ctx.translate(-f * rx * 0.55, by - lift);
      ell(ctx, 0, 0, s * 0.3, s * 0.34, pw.color, 2.5);
      ctx.strokeStyle = pw.dark;
      ctx.lineWidth = 1.6;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * 0.09, Math.sin(a) * s * 0.1);
        ctx.lineTo(Math.cos(a) * s * 0.27, Math.sin(a) * s * 0.3);
        ctx.stroke();
      }
      ell(ctx, 0, 0, s * 0.1, s * 0.11, pw.belly, 1.6);
      ctx.restore();
    }
    // legs and boots
    const bootC = pw ? pw.color : BB.COL.red;
    const bootD = pw ? pw.dark : BB.COL.redDark;
    for (const side of [-1, 1]) {
      const swing = st.ground ? Math.sin(ph + (side > 0 ? 0 : Math.PI)) * run : st.vy < 0 ? 0.4 * side : -0.3 * side;
      const lx = side * rx * 0.45 + swing * s * 0.12 * f;
      const ly = -s * 0.04 - (st.ground ? Math.max(0, Math.sin(ph + (side > 0 ? 0 : Math.PI))) * run * s * 0.08 : 0);
      if (st.power === 'b') {
        // coil spring under each boot
        ctx.strokeStyle = '#8a6a1a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const comp = st.ground ? 0.6 + 0.4 / sq : 1.2;
        for (let k = 0; k <= 4; k++) ctx.lineTo(lx + (k % 2 ? 4 : -4), ly + s * 0.04 + k * s * 0.025 * comp - s * 0.1);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(lx - s * 0.09, ly - s * 0.16);
      ctx.lineTo(lx - s * 0.09, ly - s * 0.02);
      ctx.quadraticCurveTo(lx - s * 0.1, ly + s * 0.04, lx + f * s * 0.02, ly + s * 0.04);
      ctx.lineTo(lx + f * s * 0.16, ly + s * 0.04);
      ctx.quadraticCurveTo(lx + f * s * 0.18, ly - s * 0.06, lx + s * 0.08 * f, ly - s * 0.07);
      ctx.lineTo(lx + s * 0.09 * (f > 0 ? 1 : -1) * 0.6, ly - s * 0.16);
      ctx.closePath();
      ctx.fillStyle = bootC;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = bootD;
      ctx.fillRect(lx - s * 0.09, ly - s * 0.16, s * 0.15, s * 0.04);
    }
    // body
    ell(ctx, 0, by - lift, rx, ry, '#fff3dd', 2.6);
    // soft belly shading
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, by - lift, rx, ry, 0, 0, TAU);
    ctx.clip();
    ctx.fillStyle = 'rgba(232,170,120,0.35)';
    ctx.beginPath();
    ctx.ellipse(-f * rx * 0.5, by - lift + ry * 0.55, rx * 1.1, ry * 0.7, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    // sprout on the head, swaying
    {
      const hx = f * rx * 0.1;
      const hy = by - lift - ry * 0.95;
      const sway = Math.sin(t * 3) * 0.2 - (st.vy || 0) * 0.01 - run * f * 0.3;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(sway);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -s * 0.14);
      ctx.stroke();
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.13);
        ctx.quadraticCurveTo(side * s * 0.16, -s * 0.28, side * s * 0.2, -s * 0.12);
        ctx.quadraticCurveTo(side * s * 0.08, -s * 0.08, 0, -s * 0.13);
        ctx.fillStyle = side > 0 ? '#7cc35a' : '#5ea844';
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
    // face
    const ex = f * rx * 0.28;
    const ey = by - lift - ry * 0.18;
    const bl = st.blink || 0;
    eye(ctx, ex - s * 0.08, ey, s * 0.07, bl, f);
    eye(ctx, ex + s * 0.09, ey, s * 0.07, bl, f);
    ctx.fillStyle = 'rgba(240,110,100,0.5)';
    ctx.beginPath();
    ctx.ellipse(ex - s * 0.17, ey + s * 0.11, s * 0.055, s * 0.035, 0, 0, TAU);
    ctx.ellipse(ex + s * 0.19, ey + s * 0.11, s * 0.055, s * 0.035, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (st.ouch) ctx.ellipse(ex + s * 0.01, ey + s * 0.14, s * 0.04, s * 0.05, 0, 0, TAU);
    else ctx.arc(ex + s * 0.01, ey + s * 0.1, s * 0.05, 0.3, Math.PI - 0.3);
    ctx.stroke();
    // gecko mittens
    if (st.power === 'g') {
      for (const side of [-1, 1]) {
        const reach = st.climbing ? -0.25 + Math.sin(t * 16 + side) * 0.12 : 0.15;
        const hx = f * rx * (side > 0 ? 0.95 : 0.2);
        const hy = by - lift + ry * reach;
        ell(ctx, hx, hy, s * 0.085, s * 0.075, pw.color, 2);
        ctx.fillStyle = pw.dark;
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath();
          ctx.arc(hx + f * s * 0.08, hy + k * s * 0.045, s * 0.022, 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  };

  // st: { dir, t, seed, gone (0..1 poof), excited }
  BB.drawCreature = function (ctx, type, x, y, s, st) {
    const p = P[type];
    const t = st.t || 0;
    const d = st.dir || 1;
    const bl = BB.blink(t, st.seed || 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(d, 1);
    if (type === 'b') {
      // Hopsy: a round springhare that never stops bouncing
      const hop = Math.abs(Math.sin(t * 5 + (st.seed || 0)));
      const air = hop * s * 0.35;
      const sq = 1 + (1 - Math.min(1, hop * 4)) * 0.25;
      ctx.translate(0, -air);
      // ears
      for (const k of [-1, 1]) {
        ctx.save();
        ctx.translate(k * s * 0.1, -s * 0.62 / sq);
        ctx.rotate(k * 0.25 - hop * 0.3 * k - 0.15);
        ell(ctx, 0, -s * 0.16, s * 0.07, s * 0.2, p.color, 2.2);
        ell(ctx, 0, -s * 0.14, s * 0.03, s * 0.12, '#ffd9a0', 0);
        ctx.restore();
      }
      // spring tail
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 7; k++) ctx.lineTo(-s * 0.32 - Math.sin(k * 1.6) * s * 0.06, -s * 0.12 - k * s * 0.04);
      ctx.stroke();
      ell(ctx, 0, -s * 0.33 / sq, s * 0.36 * sq, s * 0.32 / sq, p.color, 2.6);
      ell(ctx, s * 0.06, -s * 0.24 / sq, s * 0.2 * sq, s * 0.15 / sq, p.belly, 0);
      eye(ctx, s * 0.14, -s * 0.42 / sq, s * 0.065, bl, 1);
      ctx.fillStyle = '#f07a6a';
      ctx.beginPath();
      ctx.arc(s * 0.3, -s * 0.32 / sq, s * 0.035, 0, TAU);
      ctx.fill();
      // feet
      ell(ctx, -s * 0.12, -s * 0.02, s * 0.12, s * 0.05, p.dark, 2);
      ell(ctx, s * 0.16, -s * 0.02, s * 0.12, s * 0.05, p.dark, 2);
    } else if (type === 'g') {
      // Moss: a long gecko with a wagging tail and sticky toes
      const wag = Math.sin(t * 4 + (st.seed || 0)) * 0.35;
      const step = Math.sin(t * 9) * s * 0.03;
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK;
      ctx.lineWidth = s * 0.16 + 5;
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, -s * 0.16);
      ctx.quadraticCurveTo(-s * 0.45, -s * 0.12 + wag * s * 0.2, -s * 0.62, -s * 0.28 + wag * s * 0.3);
      ctx.stroke();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = s * 0.16;
      ctx.stroke();
      ctx.lineCap = 'butt';
      for (const lx of [-s * 0.18, s * 0.2]) {
        for (const k of [-1, 1]) {
          ctx.fillStyle = p.dark;
          ctx.beginPath();
          ctx.arc(lx + k * step, -s * 0.03, s * 0.05, 0, TAU);
          ctx.fill();
        }
      }
      ell(ctx, 0, -s * 0.18, s * 0.34, s * 0.14, p.color, 2.5);
      ctx.fillStyle = p.dark;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(-s * 0.15 + k * s * 0.12, -s * 0.24, s * 0.035, 0, TAU);
        ctx.fill();
      }
      ell(ctx, s * 0.34, -s * 0.24, s * 0.16, s * 0.12, p.color, 2.5);
      eye(ctx, s * 0.38, -s * 0.31, s * 0.065, bl, 1);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(s * 0.38, -s * 0.2, s * 0.08, 0.2, 1.4);
      ctx.stroke();
    } else if (type === 'o') {
      // Hush: a lilac owl that hops in place and tilts its head
      const tilt = Math.sin(t * 1.3 + (st.seed || 0)) * 0.22;
      const hop = Math.max(0, Math.sin(t * 2.2)) ** 6 * s * 0.12;
      const flap = Math.max(0, Math.sin(t * 2.2)) ** 6;
      ctx.translate(0, -hop);
      for (const k of [-1, 1]) {
        ctx.save();
        ctx.translate(k * s * 0.26, -s * 0.38);
        ctx.rotate(k * (0.2 + flap * 0.9));
        ell(ctx, k * s * 0.04, s * 0.06, s * 0.1, s * 0.2, p.dark, 2.2);
        ctx.restore();
      }
      ell(ctx, 0, -s * 0.36, s * 0.3, s * 0.36, p.color, 2.6);
      ell(ctx, 0, -s * 0.28, s * 0.18, s * 0.22, p.belly, 0);
      ctx.strokeStyle = 'rgba(106,85,160,0.55)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(0, -s * 0.36 + k * s * 0.09, s * 0.07, 0.4, Math.PI - 0.4);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(0, -s * 0.6);
      ctx.rotate(tilt);
      // ear tufts
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(k * s * 0.12, -s * 0.1);
        ctx.lineTo(k * s * 0.24, -s * 0.28);
        ctx.lineTo(k * s * 0.24, -s * 0.06);
        ctx.closePath();
        ctx.fillStyle = p.dark;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      ell(ctx, 0, 0, s * 0.26, s * 0.2, p.color, 2.4);
      ell(ctx, -s * 0.1, 0, s * 0.1, s * 0.1, '#fff8e8', 1.5);
      ell(ctx, s * 0.1, 0, s * 0.1, s * 0.1, '#fff8e8', 1.5);
      eye(ctx, -s * 0.1, 0, s * 0.06, bl, 0.5);
      eye(ctx, s * 0.1, 0, s * 0.06, bl, 0.5);
      ctx.fillStyle = BB.COL.gold;
      ctx.beginPath();
      ctx.moveTo(-s * 0.04, s * 0.08);
      ctx.lineTo(s * 0.04, s * 0.08);
      ctx.lineTo(0, s * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = BB.COL.gold;
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(k * s * 0.1, -s * 0.02, s * 0.05, Math.PI, 0);
        ctx.fill();
      }
    } else if (type === 't') {
      // Bramble: a slow old turtle with a bobbing head and a mossy shell
      const bob = Math.sin(t * 2 + (st.seed || 0)) * s * 0.03;
      const step = Math.sin(t * 3) * s * 0.03;
      for (const lx of [-s * 0.22, s * 0.2]) ell(ctx, lx + step, -s * 0.06, s * 0.08, s * 0.07, p.dark, 2);
      ctx.save();
      ctx.translate(s * 0.4, -s * 0.24 + bob);
      ell(ctx, 0, 0, s * 0.13, s * 0.11, '#9dc4a6', 2.3);
      eye(ctx, s * 0.04, -s * 0.03, s * 0.05, bl, 1);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(-s * 0.42, -s * 0.1);
      ctx.quadraticCurveTo(-s * 0.4, -s * 0.62, 0, -s * 0.62);
      ctx.quadraticCurveTo(s * 0.4, -s * 0.62, s * 0.42, -s * 0.1);
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.strokeStyle = p.dark;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-s * 0.14, -s * 0.12);
      ctx.lineTo(-s * 0.2, -s * 0.36);
      ctx.lineTo(0, -s * 0.5);
      ctx.lineTo(s * 0.2, -s * 0.36);
      ctx.lineTo(s * 0.14, -s * 0.12);
      ctx.moveTo(-s * 0.2, -s * 0.36);
      ctx.lineTo(-s * 0.38, -s * 0.3);
      ctx.moveTo(s * 0.2, -s * 0.36);
      ctx.lineTo(s * 0.38, -s * 0.3);
      ctx.stroke();
      // moss and a tiny flower on top
      ctx.fillStyle = '#6aa84f';
      ctx.beginPath();
      ctx.ellipse(-s * 0.08, -s * 0.58, s * 0.14, s * 0.05, -0.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-s * 0.02, -s * 0.66, s * 0.04, 0, TAU);
      ctx.fill();
      ctx.fillStyle = BB.COL.gold;
      ctx.beginPath();
      ctx.arc(-s * 0.02, -s * 0.66, s * 0.015, 0, TAU);
      ctx.fill();
      ctx.fillStyle = p.belly;
      ctx.fillRect(-s * 0.4, -s * 0.13, s * 0.8, s * 0.05);
    }
    ctx.restore();
  };

  // A small round badge with the creature's face, for HUD and map.
  BB.drawBadge = function (ctx, type, x, y, r, t) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = type ? P[type].belly : BB.COL.paper2;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.clip();
    if (type) BB.drawCreature(ctx, type, x, y + r * 0.75, r * 1.25, { dir: 1, t: t || 0, seed: 1 });
    else {
      // no trick: an empty boot outline
      ctx.strokeStyle = BB.COL.faint;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.3, y - r * 0.45);
      ctx.lineTo(x - r * 0.3, y + r * 0.3);
      ctx.lineTo(x + r * 0.45, y + r * 0.3);
      ctx.quadraticCurveTo(x + r * 0.45, y, x + r * 0.1, y - r * 0.05);
      ctx.lineTo(x + r * 0.1, y - r * 0.45);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  };
})();
