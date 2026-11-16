// The behind-the-kart race view: a projected road (curves and hills in the
// classic segment style), parallax backdrops, scaled roadside props, kart
// sprites built from their parts, effects and each driver's HUD. One call
// draws one viewport, so split screen is just two calls.
(function () {
  const KR = window.KR;
  const RW = KR.RW;
  const CAM_H = 4.3, CAM_BACK = 9.5, NEAR = 0.6, KS = 1.15;
  const P = [];
  for (let i = 0; i < 260; i++) P.push({ z: 0, wx: 0, y: 0, s: 0, sx: 0, sy: 0, sw: 0, clip: 0, ok: false });
  const buckets = [];
  for (let i = 0; i < 260; i++) buckets.push([]);
  const SPIN = [2, 3, 4, 3, 2, 1, 0, 1];
  const ORD = ['TH', 'ST', 'ND', 'RD', 'TH', 'TH', 'TH'];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const FONT = '"Bungee", "Impact", "Arial Black", sans-serif';
  const BODY = '"Barlow Condensed", "Arial Narrow", "Segoe UI", sans-serif';

  function ordinal(n) { return ORD[n] || 'TH'; }

  // per-race prep: sprites for every kart
  function setup(race) {
    for (const k of race.karts) k.spr = KR.Model.sprites(k.build, k.color, k.human >= 0 ? 1.5 : 0.85);
    KR.Scenery.dress(race.track);
  }

  function newCam() {
    return { x: 0, shake: 0, kick: 0, parts: [], banner: null, lastPlace: 0, popT: 0, popDir: 0, tilt: 0 };
  }

  function poly(ctx, a) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    for (let i = 2; i < a.length; i += 2) ctx.lineTo(a[i], a[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function drawClipped(ctx, img, x, y, w, h, clipY) {
    if (y >= clipY || w < 1) return;
    if (y + h <= clipY) { ctx.drawImage(img, x, y, w, h); return; }
    const vis = (clipY - y) / h;
    ctx.drawImage(img, 0, 0, img.width, img.height * vis, x, y, w, h * vis);
  }

  // ---------- the view ----------
  // R: { x, y, w, h }, opts: { draw, time, dt, motion, touch, units, single }
  function view(ctx, race, me, cam, R, opts) {
    const T = race.track, N = T.N, th = KR.Scenery.THEMES[T.theme], dress = KR.Scenery.dress(T);
    const fog = KR.Scenery.fogTable(T.theme), bg = KR.Scenery.backdrops(T.theme), props = KR.Scenery.props();
    const DRAW = opts.draw || 200;
    const motion = opts.motion !== false;
    ctx.save();
    ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();

    const shx = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 14 : 0, shy = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 10 : 0;
    const F = Math.min(R.w, R.h * 1.78) * 0.5 * (1 - cam.kick * 0.14);
    const cx = R.x + R.w / 2 + shx, hy = R.y + R.h * 0.44 + shy;
    const camZ = me.z - CAM_BACK;
    const base = Math.floor(camZ), frac = camZ - base;
    const bi = KR.wrapIdx(base, N);
    const camY = KR.roadY(T, camZ) + CAM_H;
    const camX = cam.x;

    // ---------- backdrop ----------
    const heading = dress.heading[bi] + T.segs[bi].curve * frac;
    ctx.drawImage(bg.sky, R.x, R.y, R.w, Math.max(4, hy - R.y + 6));
    const layer = (img, m, hgt, drop) => {
      const s = hgt / img.height, tw = img.width * s;
      let ox = -(((heading / (Math.PI * 2)) * img.width * m) * s) % tw;
      if (ox > 0) ox -= tw;
      const y = hy - hgt + drop;
      for (let x = R.x + ox; x < R.x + R.w; x += tw) ctx.drawImage(img, x, y, tw + 1, hgt);
    };
    layer(bg.far, 1, R.h * 0.42, R.h * 0.02);
    layer(bg.near, 2, R.h * 0.24, R.h * 0.015);
    ctx.fillStyle = fog.grass[0][fog.L - 1];
    ctx.fillRect(R.x, hy + R.h * 0.01, R.w, R.y + R.h - hy);

    // ---------- project the road ----------
    let x = 0, dx = -T.segs[bi].curve * frac * 1.2;
    for (let n = 0; n <= DRAW + 1; n++) {
      const si = (bi + n) % N, seg = T.segs[si], p = P[n];
      p.z = n - frac;
      p.wx = x;
      p.y = seg.y1;
      p.si = si;
      if (p.z > NEAR) {
        p.s = F / p.z;
        p.sx = cx + (p.wx - camX) * p.s;
        p.sy = hy - (p.y - camY) * p.s;
        p.sw = RW * p.s;
        p.ok = true;
      } else p.ok = false;
      x += dx;
      dx = clamp(dx + seg.curve * 1.2, -1.5, 1.5);
    }
    let maxy = R.y + R.h;
    const L = fog.L;
    for (let n = 0; n <= DRAW; n++) {
      const p1 = P[n], p2 = P[n + 1];
      p1.clip = maxy;
      if (!p1.ok || !p2.ok) continue;
      if (p2.sy >= maxy) continue;
      const y1 = Math.min(p1.sy, maxy), y2 = p2.sy;
      if (y1 <= y2) { maxy = Math.min(maxy, y2); continue; }
      const band = Math.floor(p1.si / 3) % 2, fi = Math.min(L - 1, Math.floor((n / DRAW) * L));
      const x1 = p1.sx, w1 = p1.sw, x2 = p2.sx, w2 = p2.sw;
      ctx.fillStyle = fog.grass[band][fi];
      ctx.fillRect(R.x, y2, R.w, y1 - y2 + 1);
      ctx.fillStyle = fog.rumble[band][fi];
      poly(ctx, [x1 - w1 * 1.16, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 * 1.16, y2]);
      poly(ctx, [x1 + w1 * 1.16, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 * 1.16, y2]);
      ctx.fillStyle = fog.road[band][fi];
      poly(ctx, [x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2]);
      if (p1.si < 3) {
        // chequered start / finish line
        const cells = 12;
        for (let c = 0; c < cells; c++) {
          if ((c + p1.si) % 2) continue;
          const a = -1 + (c / cells) * 2, b = a + 2 / cells;
          ctx.fillStyle = '#f4f4f4';
          poly(ctx, [x1 + a * w1, y1, x1 + b * w1, y1, x2 + b * w2, y2, x2 + a * w2, y2]);
        }
      } else if (band === 0) {
        ctx.fillStyle = fog.lane[fi];
        const lw1 = w1 * 0.022, lw2 = w2 * 0.022;
        for (const l of [-0.34, 0.34]) poly(ctx, [x1 + l * w1 - lw1, y1, x1 + l * w1 + lw1, y1, x2 + l * w2 + lw2, y2, x2 + l * w2 - lw2, y2]);
      }
      maxy = y2;
    }

    // ---------- bucket the moving things by segment ----------
    for (let n = 0; n <= DRAW; n++) buckets[n].length = 0;
    const put = (obj, z, kind) => {
      const d = KR.ahead(T, camZ, z);
      if (d < NEAR + 0.2 || d > DRAW - 1) return;
      const n = Math.floor(frac + d);
      buckets[n].push({ obj, kind, f: frac + d - n, d });
    };
    for (const o of race.oils) put(o, o.z + 0.5, 'oil');
    for (const it of race.items) if (it.gone <= 0) put(it, it.z + 0.5, it.type);
    for (const k of race.karts) put(k, k.z, 'kart');

    // ---------- sprites, far to near ----------
    const t = opts.time;
    for (let n = DRAW; n >= 1; n--) {
      const p = P[n];
      if (!p.ok) continue;
      const fade = n > DRAW * 0.55 ? 1 - ((n - DRAW * 0.55) / (DRAW * 0.45)) * 0.85 : 1;
      const list = dress.bySeg[p.si];
      for (let i = 0; i < list.length; i++) {
        const pr = list[i], set = props[pr.kind];
        if (!set) continue;
        const img = set[pr.v % set.length];
        const w = img.w * p.s * pr.s, h = img.h * p.s * pr.s;
        const px = p.sx + pr.x * p.sw;
        if (px + w / 2 < R.x || px - w / 2 > R.x + R.w) continue;
        ctx.globalAlpha = fade;
        drawClipped(ctx, img.c, px - w / 2, p.sy - h, w, h, p.clip);
      }
      ctx.globalAlpha = 1;
      const bk = buckets[n];
      if (bk.length > 1) bk.sort((a, b) => b.d - a.d);
      for (const b of bk) {
        const d = b.d, s = F / d;
        const wx = P[n].wx + (P[n + 1].wx - P[n].wx) * b.f;
        const o = b.obj;
        const ry = b.kind === 'kart' ? KR.roadY(T, o.z) : T.segs[p.si].y1;
        const sx = cx + (wx + o.x * RW - camX) * s, sy = hy - (ry - camY) * s;
        ctx.globalAlpha = fade;
        if (b.kind === 'oil') drawOil(ctx, sx, sy, s, d, p.clip);
        else if (b.kind === 'bolt') drawBolt(ctx, sx, sy, s, t, o, p.clip);
        else if (b.kind === 'boost') drawCanister(ctx, sx, sy, s, t, me.s.rocket > 0, p.clip);
        else drawKart(ctx, race, o, me, sx, sy, s, d, dress, bi, t, p.clip, opts);
        ctx.globalAlpha = 1;
      }
    }

    // ---------- screen effects ----------
    drawParts(ctx, cam);
    const top = me.s.topSpeed;
    if (motion && (me.boostT > 0 || me.speed > top * 0.97)) {
      ctx.strokeStyle = me.boostT > 0 ? 'rgba(255,214,140,0.5)' : 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + t * 3.1 + Math.sin(i * 7.3 + t) * 0.2, r0 = R.w * (0.38 + ((t * 2.3 + i * 0.37) % 1) * 0.2);
        ctx.moveTo(cx + Math.cos(a) * r0, hy + Math.sin(a) * r0 * 0.6);
        ctx.lineTo(cx + Math.cos(a) * (r0 + R.w * 0.12), hy + Math.sin(a) * (r0 + R.w * 0.12) * 0.6);
      }
      ctx.stroke();
    }
    // vignette (pre-rendered)
    ctx.drawImage(vignette(), R.x, R.y, R.w, R.h);
    if (!opts.noHud) hud(ctx, race, me, cam, R, opts);
    ctx.restore();
  }

  let vig = null;
  function vignette() {
    if (vig) return vig;
    vig = document.createElement('canvas');
    vig.width = 480; vig.height = 270;
    const g = vig.getContext('2d'), gr = g.createRadialGradient(240, 135, 90, 240, 135, 290);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,6,2,0.55)');
    g.fillStyle = gr; g.fillRect(0, 0, 480, 270);
    return vig;
  }

  // ---------- things on the road ----------
  function drawOil(ctx, sx, sy, s, d, clip) {
    if (sy > clip + 4) return;
    const rx = 2.3 * s, ry = Math.max(1, rx * Math.min(0.55, (CAM_H / d) * 1.1));
    ctx.fillStyle = 'rgba(12,10,14,0.88)';
    ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx + rx * 0.5, sy + ry * 0.3, rx * 0.5, ry * 0.6, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,220,0.45)'; ctx.lineWidth = Math.max(1, s * 0.12);
    ctx.beginPath(); ctx.ellipse(sx - rx * 0.15, sy - ry * 0.1, rx * 0.55, ry * 0.45, 0, 3.6, 5.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,200,160,0.35)';
    ctx.beginPath(); ctx.ellipse(sx - rx * 0.1, sy, rx * 0.7, ry * 0.6, 0, 3.8, 5.4); ctx.stroke();
  }
  function drawBolt(ctx, sx, sy, s, t, o, clip) {
    const r = 0.55 * s, y = sy - (1.2 + Math.sin(t * 4 + o.z) * 0.25) * s;
    if (y - r > clip || r < 0.6) return;
    const sq = Math.abs(Math.cos(t * 3 + o.z));
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.25, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#c9971f';
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * 1.047 + 0.52; ctx.lineTo(sx + Math.cos(a) * r * (0.3 + sq * 0.7), y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd860';
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * 1.047 + 0.52; ctx.lineTo(sx + Math.cos(a) * r * 0.78 * (0.3 + sq * 0.7), y + Math.sin(a) * r * 0.78); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a5a12'; ctx.beginPath(); ctx.ellipse(sx, y, r * 0.32 * (0.3 + sq * 0.7), r * 0.32, 0, 0, 6.283); ctx.fill();
  }
  function drawCanister(ctx, sx, sy, s, t, usable, clip) {
    const w = 0.8 * s, h = 1.5 * s, y = sy - (1 + Math.sin(t * 3) * 0.2) * s - h;
    if (y > clip || w < 0.8) return;
    ctx.globalAlpha *= usable ? 1 : 0.45;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(sx, sy, w, w * 0.25, 0, 0, 6.283); ctx.fill();
    if (usable) {
      ctx.fillStyle = 'rgba(255,150,40,0.22)'; ctx.beginPath(); ctx.arc(sx, y + h / 2, h * 0.9 * (1 + Math.sin(t * 8) * 0.08), 0, 6.283); ctx.fill();
    }
    ctx.fillStyle = usable ? '#ff6a1f' : '#7d8597';
    ctx.fillRect(sx - w / 2, y, w, h);
    ctx.fillStyle = usable ? '#ffb35c' : '#a0a6b2';
    ctx.fillRect(sx - w / 2, y, w * 0.3, h);
    ctx.fillStyle = '#2a2c33'; ctx.fillRect(sx - w / 2, y - h * 0.1, w, h * 0.12); ctx.fillRect(sx - w * 0.2, y - h * 0.22, w * 0.4, h * 0.12);
    ctx.fillStyle = '#f2ead8';
    ctx.beginPath(); ctx.moveTo(sx, y + h * 0.2); ctx.lineTo(sx + w * 0.32, y + h * 0.5); ctx.lineTo(sx + w * 0.1, y + h * 0.5); ctx.lineTo(sx + w * 0.1, y + h * 0.8); ctx.lineTo(sx - w * 0.1, y + h * 0.8); ctx.lineTo(sx - w * 0.1, y + h * 0.5); ctx.lineTo(sx - w * 0.32, y + h * 0.5); ctx.closePath(); ctx.fill();
    if (!usable) { ctx.strokeStyle = '#d7263d'; ctx.lineWidth = Math.max(1, s * 0.12); ctx.beginPath(); ctx.moveTo(sx - w, y); ctx.lineTo(sx + w, y + h); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  function flame(ctx, x, y, len, wid, t, seed) {
    const f = 0.75 + Math.sin(t * 40 + seed) * 0.15 + Math.random() * 0.2;
    ctx.fillStyle = 'rgba(255,90,20,0.85)';
    ctx.beginPath(); ctx.moveTo(x - wid, y); ctx.quadraticCurveTo(x, y + len * f * 1.1, x + wid, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,60,0.95)';
    ctx.beginPath(); ctx.moveTo(x - wid * 0.6, y); ctx.quadraticCurveTo(x, y + len * f * 0.7, x + wid * 0.6, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath(); ctx.moveTo(x - wid * 0.28, y); ctx.quadraticCurveTo(x, y + len * f * 0.35, x + wid * 0.28, y); ctx.closePath(); ctx.fill();
  }

  function drawKart(ctx, race, k, me, sx, sy, s, d, dress, bi, t, clip, opts) {
    const spr = k.spr;
    if (!spr) return;
    const ki = KR.wrapIdx(k.z, race.track.N);
    let rel = (dress.heading[ki] - dress.heading[bi]);
    if (rel > Math.PI) rel -= Math.PI * 2; else if (rel < -Math.PI) rel += Math.PI * 2;
    rel = rel * 0.9 + k.steer * 0.28 + (k.slip > 0 ? k.steer * 0.15 : 0);
    let fi = Math.round(clamp(rel, -0.55, 0.55) / 0.25) + 2;
    if (k.spin > 0) fi = SPIN[Math.floor(k.spinAng * 1.3) % SPIN.length];
    fi = clamp(fi, 0, 4);
    const ks = (s * KS) / spr.unit;
    const dw = spr.w * ks, dh = spr.h * ks;
    if (dw < 2) return;
    const hopLift = k.hop > 0 ? Math.sin(((0.55 - k.hop) / 0.55) * Math.PI) * 1.7 * s : 0;
    // shadow
    if (sy - 2 < clip + dh) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(sx, sy, 1.35 * KS * s * (hopLift ? 0.8 : 1), 0.32 * KS * s, 0, 0, 6.283); ctx.fill();
    }
    const top = sy - spr.gy * ks - hopLift;
    const bob = k.speed > 2 && !k.hop ? Math.sin(t * 30 + k.id) * 0.03 * s * (k.grass ? 3 : 1) : 0;
    // boost flames come out of the back, under the sprite's rear edge
    if (k.boostT > 0) {
      const fy = sy - 0.75 * KS * s - hopLift;
      flame(ctx, sx - 0.42 * KS * s, fy, 1.6 * KS * s, 0.22 * KS * s, t, k.id);
      flame(ctx, sx + 0.42 * KS * s, fy, 1.6 * KS * s, 0.22 * KS * s, t, k.id + 3);
    }
    drawClipped(ctx, spr.frames[fi], sx - dw / 2, top + bob, dw, dh, clip);
    if (k.boostT > 0) {
      const fy = sy - 0.75 * KS * s - hopLift;
      ctx.globalAlpha = 0.8;
      flame(ctx, sx - 0.42 * KS * s, fy - 0.05 * s, -0.01, 0.3 * KS * s, t, 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,170,60,0.25)'; ctx.beginPath(); ctx.arc(sx, fy, 1.6 * KS * s, 0, 6.283); ctx.fill();
    }
    // drift sparks off the rear wheels
    if (k.slip > 0.15 && opts.motion !== false) {
      ctx.strokeStyle = Math.random() < 0.5 ? '#ffe28a' : '#ff9a3a';
      ctx.lineWidth = Math.max(1, s * 0.06);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const side = i % 2 ? 1 : -1, x0 = sx + side * 1.1 * KS * s, y0 = sy - 0.1 * s;
        const a = -Math.PI / 2 + side * (0.6 + Math.random() * 1.1);
        const L = (0.4 + Math.random() * 0.9) * s;
        ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(a) * L, y0 + Math.sin(a) * L * 0.6);
      }
      ctx.stroke();
    }
    // tags over the other human, and short name plates over nearby rivals
    if (k !== me && d < 60 && dw > 14) {
      const label = k.human >= 0 ? 'P' + (k.human + 1) : k.name.toUpperCase();
      const fs = clamp(s * 0.7, 9, 15);
      ctx.font = `${fs}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const y = top - 2;
      if (y < clip) {
        const w = ctx.measureText(label).width + 8;
        ctx.globalAlpha = clamp((60 - d) / 20, 0, 1) * (k.human >= 0 ? 1 : 0.75);
        ctx.fillStyle = k.human >= 0 ? k.color : 'rgba(20,16,12,0.7)';
        ctx.fillRect(sx - w / 2, y - fs - 2, w, fs + 3);
        ctx.fillStyle = k.human >= 0 ? '#fff' : '#f2ead8';
        ctx.fillText(label, sx, y);
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---------- particles (screen space, per view) ----------
  function emit(cam, x, y, n, o) {
    for (let i = 0; i < n; i++) {
      if (cam.parts.length > 240) cam.parts.shift();
      const a = o.a + (Math.random() - 0.5) * (o.spread || 1);
      const v = o.v * (0.5 + Math.random());
      cam.parts.push({ x: x + (Math.random() - 0.5) * (o.jx || 0), y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.g || 0, life: o.life * (0.6 + Math.random() * 0.6), max: o.life, col: o.col[Math.floor(Math.random() * o.col.length)], size: o.size, kind: o.kind || 'dot' });
    }
  }
  function updateParts(cam, dt) {
    const ps = cam.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  function drawParts(ctx, cam) {
    for (const p of cam.parts) {
      const a = p.life / p.max;
      ctx.globalAlpha = Math.min(1, a * 1.5);
      ctx.fillStyle = p.col;
      if (p.kind === 'spark') {
        ctx.strokeStyle = p.col; ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
      } else if (p.kind === 'puff') {
        const r = p.size * (1.6 - a);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      } else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
  // Where on screen is my own kart? (fixed by the camera)
  function myKartScreen(R, me, cam) {
    const F = Math.min(R.w, R.h * 1.78) * 0.5 * (1 - cam.kick * 0.14);
    const s = F / CAM_BACK, hy = R.y + R.h * 0.44;
    return { x: R.x + R.w / 2 + (me.x * RW - cam.x) * s, y: hy + CAM_H * s, s };
  }
  // continuous effects for my kart, called from the game update
  function feel(cam, me, R, dt, race, motion) {
    // camera follows the kart sideways, a little behind
    cam.x += (me.x * RW * 0.82 - cam.x) * Math.min(1, dt * 6);
    updateParts(cam, dt);
    cam.shake = Math.max(0, cam.shake - dt * 2.2);
    cam.kick += ((me.boostT > 0 ? 1 : 0) - cam.kick) * Math.min(1, dt * 4);
    if (cam.popT > 0) cam.popT -= dt;
    if (cam.banner && (cam.banner.t -= dt) <= 0) cam.banner = null;
    if (!motion) return;
    const p = myKartScreen(R, me, cam), s = p.s * KS;
    if (me.slip > 0.15 && Math.random() < 0.9) {
      for (const side of [-1, 1]) emit(cam, p.x + side * 1.05 * s, p.y - 0.1 * s, 2, { a: -Math.PI / 2 - side * 0.9, spread: 1.4, v: 260, g: 900, life: 0.35, col: ['#ffe28a', '#ff9a3a', '#fff'], size: 2, kind: 'spark' });
      if (Math.random() < 0.4) emit(cam, p.x, p.y - 0.2 * s, 1, { a: -Math.PI / 2, spread: 2, v: 40, life: 0.6, col: ['rgba(220,220,220,0.4)'], size: 0.4 * s, kind: 'puff', jx: 2 * s });
    }
    if (me.grass && me.speed > 4 && Math.random() < 0.8) {
      const col = { grass: ['#6c9a40', '#4f7f2f', '#8a6a3a'], dirt: ['#8c6b3e', '#6a4f2a'], concrete: ['#b0b0a8', '#8a8a82'], sand: ['#e2b670', '#c99a55'], tarmac: ['#555a66', '#3a3f4a'], snow: ['#ffffff', '#dfe8f0'] }[KR.Scenery.THEMES[race.track.theme].verge];
      emit(cam, p.x + (Math.random() - 0.5) * 2 * s, p.y, 2, { a: -Math.PI / 2, spread: 1.6, v: 180, g: 700, life: 0.5, col, size: 0.12 * s });
    }
    if (me.boostT > 0 && Math.random() < 0.7) emit(cam, p.x + (Math.random() - 0.5) * 1.2 * s, p.y - 0.7 * s, 1, { a: Math.PI / 2, spread: 0.8, v: 120, life: 0.35, col: ['rgba(255,170,60,0.7)', 'rgba(255,230,140,0.6)'], size: 0.3 * s, kind: 'puff' });
  }
  function burst(cam, R, me, kind) {
    const p = myKartScreen(R, me, cam), s = p.s * KS;
    if (kind === 'oil') emit(cam, p.x, p.y - 0.3 * s, 16, { a: -Math.PI / 2, spread: 3, v: 120, life: 0.9, col: ['rgba(40,36,44,0.6)', 'rgba(90,90,100,0.4)'], size: 0.5 * s, kind: 'puff', jx: 2 * s });
    if (kind === 'bump' || kind === 'wall') emit(cam, p.x + (me.x > 0 ? 1 : -1) * s, p.y - 0.6 * s, 14, { a: -Math.PI / 2, spread: 3, v: 380, g: 900, life: 0.4, col: ['#fff', '#ffe28a', '#ffc21a'], size: 2.5, kind: 'spark' });
    if (kind === 'bolt') emit(cam, p.x, p.y - 1.4 * s, 10, { a: -Math.PI / 2, spread: 2.4, v: 260, g: 600, life: 0.5, col: ['#ffd860', '#fff2b0'], size: 0.12 * s });
    if (kind === 'canister') emit(cam, p.x, p.y - 1.2 * s, 18, { a: -Math.PI / 2, spread: 3, v: 300, g: 300, life: 0.6, col: ['#ff8a1f', '#ffd166', '#fff'], size: 0.14 * s });
    if (kind === 'land' || kind === 'hop') emit(cam, p.x, p.y, 10, { a: -Math.PI / 2, spread: 3.1, v: 140, g: 300, life: 0.5, col: ['rgba(230,230,230,0.5)'], size: 0.3 * s, kind: 'puff', jx: 2 * s });
    if (kind === 'boost') emit(cam, p.x, p.y - 0.7 * s, 20, { a: Math.PI / 2, spread: 1.6, v: 220, life: 0.5, col: ['rgba(255,170,60,0.8)', 'rgba(255,240,180,0.7)'], size: 0.35 * s, kind: 'puff' });
  }

  // ---------- HUD ----------
  function plate(ctx, x, y, w, h, fill, skew) {
    const k = skew === undefined ? 10 : skew;
    ctx.beginPath(); ctx.moveTo(x + k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - k, y + h); ctx.lineTo(x, y + h); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
  }
  function txt(ctx, s, x, y, size, col, align, font) {
    ctx.font = `${size}px ${font || FONT}`;
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = col; ctx.fillText(s, x, y);
  }
  function fmt(t) {
    if (!(t > 0)) return '-:--.--';
    const m = Math.floor(t / 60), s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }

  function hud(ctx, race, me, cam, R, opts) {
    const u = clamp(Math.min(R.h / 540, R.w / 960), 0.6, 1.2);
    const X = R.x, Y = R.y;
    const started = race.time >= race.startT;
    // position
    const place = me.place;
    ctx.save();
    ctx.translate(X + 14 * u, Y + 12 * u);
    ctx.scale(u, u);
    const popS = cam.popT > 0 ? 1 + Math.sin((cam.popT / 0.5) * Math.PI) * 0.25 : 1;
    plate(ctx, 0, 0, 160, 74, 'rgba(20,16,12,0.82)', 14);
    plate(ctx, 0, 0, 10, 74, me.color, 0);
    ctx.save(); ctx.translate(46, 40); ctx.scale(popS, popS);
    txt(ctx, String(place), 0, 0, 52, cam.popT > 0 ? (cam.popDir > 0 ? '#16c79a' : '#ff5a5a') : '#ffc21a', 'center');
    ctx.restore();
    txt(ctx, ordinal(place), 72, 26, 18, '#f2ead8');
    txt(ctx, '/ ' + race.karts.length, 74, 52, 16, 'rgba(242,234,216,0.6)', 'left', BODY);
    // lap
    const lap = clamp(Math.floor(me.z / race.track.N) + 1, 1, race.laps);
    plate(ctx, 0, 80, 190, 50, 'rgba(20,16,12,0.72)', 12);
    txt(ctx, 'LAP', 14, 96, 13, '#ffc21a', 'left', FONT);
    txt(ctx, (me.done ? race.laps : lap) + '/' + race.laps, 50, 97, 20, '#f2ead8', 'left', FONT);
    const lt = started && !me.done ? race.time - race.startT - me.lapStart : me.done ? me.time : 0;
    txt(ctx, fmt(lt), 112, 97, 17, '#f2ead8', 'left', BODY);
    txt(ctx, 'BEST ' + fmt(me.bestLap), 14, 118, 13, 'rgba(242,234,216,0.65)', 'left', BODY);
    ctx.restore();

    // minimap
    const ms = Math.round(130 * u);
    const mm = KR.Scenery.minimap(race.track, 130);
    ctx.save();
    ctx.translate(X + R.w - ms - 12 * u, Y + 10 * u);
    ctx.scale(u, u);
    ctx.fillStyle = 'rgba(20,16,12,0.55)'; ctx.fillRect(0, 0, 130, 130);
    ctx.drawImage(mm.c, 0, 0);
    const N = race.track.N;
    const sorted = race.karts.slice().sort((a, b) => (a === me) - (b === me));
    for (const k of sorted) {
      const [x, y] = mm.map(race.track.pts[KR.wrapIdx(k.z, N)]);
      ctx.fillStyle = k.color;
      ctx.beginPath(); ctx.arc(x, y, k === me ? 6 : k.human >= 0 ? 5 : 3.6, 0, 6.283); ctx.fill();
      if (k === me || k.human >= 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    ctx.restore();

    // speedometer
    const touchUI = opts.touch;
    const sr = 64;
    ctx.save();
    if (touchUI) ctx.translate(X + R.w - 70 * u, Y + 220 * u);
    else ctx.translate(X + R.w - 88 * u, Y + R.h - 80 * u);
    ctx.scale(u * (touchUI ? 0.8 : 1), u * (touchUI ? 0.8 : 1));
    ctx.fillStyle = 'rgba(20,16,12,0.8)'; ctx.beginPath(); ctx.arc(0, 0, sr + 10, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#ffc21a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, sr + 8, 0, 6.283); ctx.stroke();
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, maxV = 32;
    for (let i = 0; i <= 16; i++) {
      const a = a0 + (a1 - a0) * (i / 16), r1 = i % 2 ? sr - 6 : sr - 12;
      ctx.strokeStyle = i >= 13 ? '#d7263d' : '#f2ead8'; ctx.lineWidth = i % 2 ? 1.5 : 3;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.lineTo(Math.cos(a) * sr, Math.sin(a) * sr); ctx.stroke();
    }
    // the arc of available speed for this build
    ctx.strokeStyle = 'rgba(22,199,154,0.6)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, sr + 2, a0, a0 + (a1 - a0) * Math.min(1, me.s.topSpeed / maxV)); ctx.stroke();
    const va = a0 + (a1 - a0) * Math.min(1, me.speed / maxV);
    ctx.strokeStyle = '#ff5a1f'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-Math.cos(va) * 10, -Math.sin(va) * 10); ctx.lineTo(Math.cos(va) * (sr - 8), Math.sin(va) * (sr - 8)); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#2a2c33'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 6.283); ctx.fill();
    const unit = opts.units === 'mph' ? 4.35 : 7;
    txt(ctx, String(Math.round(me.speed * unit)), 0, 30, 22, '#f2ead8', 'center');
    txt(ctx, opts.units === 'mph' ? 'MPH' : 'KM/H', 0, 48, 11, 'rgba(242,234,216,0.6)', 'center', BODY);
    txt(ctx, 'G' + (opts.gear || 1), 0, -26, 13, '#ffc21a', 'center');
    ctx.restore();

    // parts panel: boosts, hop, magnet, armour, bolts
    ctx.save();
    if (touchUI) ctx.translate(X + 14 * u, Y + 150 * u);
    else ctx.translate(X + 14 * u, Y + R.h - 70 * u);
    ctx.scale(u, u);
    plate(ctx, 0, 0, 250, 56, 'rgba(20,16,12,0.78)', 12);
    if (me.s.rocket) {
      for (let i = 0; i < 2; i++) {
        const on = i < me.boosts, x = 16 + i * 30;
        ctx.fillStyle = on ? '#ff6a1f' : 'rgba(255,255,255,0.12)'; ctx.fillRect(x, 12, 20, 32);
        if (on) { ctx.fillStyle = '#ffb35c'; ctx.fillRect(x, 12, 6, 32); }
        ctx.fillStyle = on ? '#f2ead8' : 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.moveTo(x + 10, 17); ctx.lineTo(x + 17, 28); ctx.lineTo(x + 3, 28); ctx.closePath(); ctx.fill(); ctx.fillRect(x + 7, 28, 6, 10);
      }
      if (me.boostT > 0) { ctx.fillStyle = '#ffc21a'; ctx.fillRect(16, 47, 50 * (me.boostT / 1.4), 3); }
    } else {
      txt(ctx, 'NO POD', 14, 22, 12, 'rgba(242,234,216,0.5)', 'left', FONT);
      txt(ctx, 'no boosts', 14, 40, 12, 'rgba(242,234,216,0.4)', 'left', BODY);
    }
    const icon = (x, label, on, frac, col) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, 24, 14, 0, 6.283); ctx.stroke();
      if (on) { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(x, 24, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke(); }
      txt(ctx, label, x, 24, 10, on ? '#f2ead8' : 'rgba(242,234,216,0.25)', 'center', FONT);
    };
    icon(100, 'HOP', me.s.spring > 0, me.s.spring ? 1 - me.hopCool / 2.2 : 0, me.hopCool <= 0 ? '#16c79a' : '#5a7a70');
    icon(138, 'MAG', me.s.magnet > 0, 1, '#9d4edd');
    icon(176, 'ARM', me.s.armor > 0, 1, '#8d99ae');
    txt(ctx, '⬢ ' + me.bolts, 200, 24, 14, '#ffd860', 'left', FONT);
    ctx.restore();

    // start lights
    if (race.time < race.startT + 1.2) {
      const lit = Math.floor(race.time / 0.6), go = race.time >= race.startT;
      const a = go ? clamp(1 - (race.time - race.startT) / 1.2, 0, 1) : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(X + R.w / 2, Y + R.h * 0.2);
      ctx.scale(u, u);
      ctx.fillStyle = '#16130f'; ctx.fillRect(-150, -36, 300, 72);
      ctx.fillStyle = '#ffc21a'; for (let i = 0; i < 15; i++) if (i % 2 === 0) { ctx.beginPath(); ctx.moveTo(-150 + i * 20, -36); ctx.lineTo(-140 + i * 20, -36); ctx.lineTo(-150 + i * 20 + 4, -30); ctx.lineTo(-156 + i * 20, -30); ctx.fill(); }
      for (let i = 0; i < 5; i++) {
        const on = go || i < lit;
        const x = -112 + i * 56;
        ctx.fillStyle = '#2a2c33'; ctx.beginPath(); ctx.arc(x, 4, 22, 0, 6.283); ctx.fill();
        ctx.fillStyle = on ? (go ? '#22e07a' : '#ff2a2a') : '#3a1414';
        ctx.beginPath(); ctx.arc(x, 4, 17, 0, 6.283); ctx.fill();
        if (on) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(x - 5, -2, 5, 0, 6.283); ctx.fill(); }
      }
      if (go) txt(ctx, 'GO!', 0, 74, 46, '#22e07a', 'center');
      ctx.restore();
    }

    // banners (lap, final lap, finished)
    if (cam.banner) {
      const b = cam.banner, k = clamp((b.max - b.t) / 0.25, 0, 1), out = clamp(b.t / 0.3, 0, 1);
      ctx.save();
      ctx.globalAlpha = out;
      ctx.translate(X + R.w / 2 + (1 - k) * -R.w * 0.6, Y + R.h * 0.34);
      ctx.scale(u, u);
      const w = Math.max(260, b.text.length * 26 + 60);
      plate(ctx, -w / 2, -34, w, 68, b.col || '#ffc21a', 22);
      plate(ctx, -w / 2 + 8, -26, w - 16, 52, '#16130f', 18);
      txt(ctx, b.text, 0, b.sub ? -6 : 1, 30, b.col || '#ffc21a', 'center');
      if (b.sub) txt(ctx, b.sub, 0, 18, 14, '#f2ead8', 'center', BODY);
      ctx.restore();
    }

    // touch controls (single player on a touch screen)
    if (touchUI) {
      const r = touchRects(R);
      const btn = (rc, label, held, col) => {
        ctx.globalAlpha = held ? 0.85 : 0.42;
        ctx.fillStyle = held ? col : 'rgba(20,16,12,0.7)';
        ctx.beginPath(); ctx.arc(rc.x + rc.w / 2, rc.y + rc.h / 2, rc.w / 2, 0, 6.283); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
        ctx.globalAlpha = 1;
        txt(ctx, label, rc.x + rc.w / 2, rc.y + rc.h / 2, label.length > 2 ? 13 : 26, '#f2ead8', 'center');
      };
      const I = KR.Input;
      btn(r.left, '◀', I.touchIn(r.left), '#ffc21a');
      btn(r.right, '▶', I.touchIn(r.right), '#ffc21a');
      btn(r.brake, 'BRAKE', I.touchIn(r.brake), '#d7263d');
      if (me.s.spring) btn(r.hop, 'HOP', I.touchIn(r.hop), '#16c79a');
      if (me.s.rocket) btn(r.boost, 'BOOST', I.touchIn(r.boost), '#ff8a1f');
      // pause button
      ctx.fillStyle = 'rgba(20,16,12,0.7)'; ctx.fillRect(X + R.w / 2 - 22, Y + 6, 44, 34);
      ctx.fillStyle = '#f2ead8'; ctx.fillRect(X + R.w / 2 - 8, Y + 14, 5, 18); ctx.fillRect(X + R.w / 2 + 3, Y + 14, 5, 18);
    }
  }

  function touchRects(R) {
    const s = 92, y = R.y + R.h - s - 14;
    return {
      left: { x: R.x + 14, y, w: s, h: s },
      right: { x: R.x + 24 + s, y, w: s, h: s },
      brake: { x: R.x + R.w - s - 14, y, w: s, h: s },
      hop: { x: R.x + R.w - s * 2 - 24, y: y + 10, w: s * 0.85, h: s * 0.85 },
      boost: { x: R.x + R.w - s - 14, y: y - s - 6, w: s * 0.9, h: s * 0.9 },
    };
  }

  KR.Road = { setup, newCam, view, feel, burst, touchRects, ordinal, fmt, FONT, BODY, plate, txt };
})();
