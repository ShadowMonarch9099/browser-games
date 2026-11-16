// A counter of glasses: the live puzzle state (via PourParty.Rules), the pour
// animation (lift, carry, tilt, stream, settle with a wobble), particles, and
// hit-testing. Used both for play and for the title-screen demo.
(function () {
  const R = window.PourParty.Rules;
  const S = PP.Scene;
  const CAP = R.CAP;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
  const lerp = (a, b, t) => a + (b - a) * t;

  // Timeline of one pour, as fractions of its duration.
  const MOVE = 0.27;
  const FLOW_END = 0.76;

  class Board {
    constructor(tubes, opts = {}) {
      this.start = R.copy(tubes);
      this.events = opts.events || {};
      this.settings = opts.settings || { symbols: true, guides: true, reduced: false };
      this.reset();
    }

    reset() {
      this.tubes = R.copy(this.start);
      this.history = [];
      this.moves = 0;
      this.sel = null;
      this.cursor = this.cursor && this.cursor < this.tubes.length ? this.cursor : 0;
      this.anim = null;
      this.hint = null;
      this.hover = -1;
      this.solved = false;
      this.party = 0;
      this.particles = [];
      this.vis = this.tubes.map(() => ({ lift: 0, wob: 0, wobV: 0, glow: 0, straw: 0, reveal: 1, revealIdx: -1, bubbles: [], bob: Math.random() * 6 }));
      this.vis.forEach((v) => {
        for (let i = 0; i < 3; i++) v.bubbles.push({ x: 0.15 + Math.random() * 0.7, h: Math.random() * 3, r: 0.025 + Math.random() * 0.03, v: 0.5 + Math.random() * 0.6, ambient: true });
      });
    }

    get busy() { return !!this.anim; }

    // ---------- layout ----------
    layout(W, H, top, bottom, xl = 0, xr = W) {
      const T = this.tubes.length;
      const GH = 4.35; // glass height in units of u (see Scene.geom)
      const fit = (rows) => {
        const per = Math.ceil(T / rows);
        const u = Math.min(((xr - xl) * 0.94) / (per * 1.72), (bottom - top) / (rows * GH + (rows - 1) * 1.15 + 1.25), 76);
        return { rows, per, u };
      };
      const one = fit(1);
      const two = fit(2);
      const L = two.u > one.u * 1.08 ? two : one;
      this.L = L;
      const { rows, per, u } = L;
      const pitch = u * 1.72;
      this.rects = this.tubes.map((_, i) => {
        const r = Math.floor(i / per);
        const inRow = r === rows - 1 ? T - per * (rows - 1) : per;
        const x0 = xl + (xr - xl - inRow * pitch) / 2 + (pitch - u) / 2;
        const base = bottom - (rows - 1 - r) * (GH * u + 1.15 * u);
        const x = x0 + (i % per) * pitch;
        return { x, y: base - GH * u, u, base, cx: x + u / 2, row: r, front: r === rows - 1 };
      });
      this.shelves = [];
      for (let r = 0; r < rows - 1; r++) {
        const rs = this.rects.filter((q) => q.row === r);
        this.shelves.push({ x0: rs[0].x - u * 0.6, x1: rs[rs.length - 1].x + u * 1.6, y: rs[0].base });
      }
    }

    hit(x, y) {
      if (!this.rects) return -1;
      let best = -1;
      let bd = Infinity;
      this.rects.forEach((r, i) => {
        const lift = this.vis[i].lift * r.u * 0.6;
        const padX = r.u * 0.36;
        if (x < r.x - padX || x > r.x + r.u + padX || y < r.y - lift - r.u * 0.9 || y > r.base + r.u * 0.35) return;
        const d = Math.abs(x - r.cx);
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    }

    // ---------- moves ----------
    selectable(i) { const t = this.tubes[i]; return t.length > 0 && !R.complete(t); }

    // A tap / select press on glass i. Returns what happened.
    tap(i) {
      if (this.solved || i < 0 || i >= this.tubes.length) return 'none';
      if (this.sel === null) {
        if (this.selectable(i)) { this.sel = i; this.fire('lift', i); return 'lift'; }
        this.fire('deny', i);
        return 'deny';
      }
      if (i === this.sel) { this.sel = null; this.fire('drop', i); return 'drop'; }
      if (this.pour(this.sel, i)) return 'pour';
      if (this.selectable(i)) { this.sel = i; this.fire('lift', i); return 'lift'; }
      this.fire('deny', i);
      return 'deny';
    }

    pour(i, j) {
      if (this.anim) this.finishAnim();
      if (!R.canPour(this.tubes[i], this.tubes[j])) return false;
      this.history.push(R.copy(this.tubes));
      const res = R.pour(this.tubes, i, j);
      this.moves++;
      this.sel = null;
      this.hint = null;
      const reduced = this.settings.reduced;
      this.anim = { from: i, to: j, n: res.n, c: res.c, revealed: res.revealed, t: 0, dur: reduced ? 0.42 : 1.05 + res.n * 0.06, reduced, flowed: false };
      this.fire('pour', j, this.tubes[j].length);
      return true;
    }

    undo() {
      if (this.solved) return false;
      if (this.anim) this.finishAnim();
      if (!this.history.length) return false;
      this.tubes = this.history.pop();
      this.moves--;
      this.sel = null;
      this.hint = null;
      this.vis.forEach((v, i) => {
        if (!R.complete(this.tubes[i])) { v.straw = 0; v.glow = 0; }
        v.wobV += (Math.random() - 0.5) * 0.4;
        v.reveal = 1;
        v.revealIdx = -1;
      });
      return true;
    }

    finishAnim() {
      const a = this.anim;
      if (!a) return;
      a.t = a.dur;
      this.endPour(a);
      this.anim = null;
    }

    endPour(a) {
      const vt = this.vis[a.to];
      const vf = this.vis[a.from];
      const dir = this.rects ? Math.sign(this.rects[a.to].cx - this.rects[a.from].cx) || 1 : 1;
      if (!this.settings.reduced) {
        vt.wobV += 0.55 * dir;
        vf.wobV -= 0.35 * dir;
      }
      this.fire('settle', a.to, this.tubes[a.to].length);
      if (a.revealed) {
        vf.reveal = 0;
        vf.revealIdx = this.tubes[a.from].length - 1;
        this.fire('reveal', a.from);
      }
      if (R.complete(this.tubes[a.to])) {
        vt.glow = 1;
        this.fire('complete', a.to);
        this.sparkle(a.to);
      }
      if (R.solved(this.tubes)) {
        this.solved = true;
        this.party = 0;
        this.fire('solved');
      }
    }

    fire(name, ...args) { if (this.events[name]) this.events[name](...args); }

    // ---------- update ----------
    update(dt, time) {
      const a = this.anim;
      if (a) {
        a.t += dt;
        const p = a.t / a.dur;
        if (!a.flowed && p >= FLOW_END) a.flowed = true;
        if (!a.reduced && p > MOVE && p < FLOW_END && this.rects) this.splash(a, dt);
        if (a.t >= a.dur) { this.anim = null; this.endPour(a); }
      }
      if (this.hint) { this.hint.t += dt; if (this.hint.t > 6) this.hint = null; }
      if (this.solved) this.party += dt;
      this.vis.forEach((v, i) => {
        const target = i === this.sel ? 1 : 0;
        v.lift += (target - v.lift) * Math.min(1, dt * 14);
        v.wobV += (-70 * v.wob - 4.5 * v.wobV) * dt;
        v.wob = clamp(v.wob + v.wobV * dt, -0.3, 0.3);
        if (v.glow > 0 && R.complete(this.tubes[i])) v.straw = Math.min(1, v.straw + dt * 2.2);
        if (v.reveal < 1) v.reveal = Math.min(1, v.reveal + dt * 2.2);
        const fill = this.tubes[i].length;
        for (let k = v.bubbles.length - 1; k >= 0; k--) {
          const b = v.bubbles[k];
          b.h += b.v * dt;
          if (b.h > fill) {
            if (b.ambient) { b.h = 0; b.x = 0.15 + Math.random() * 0.7; }
            else v.bubbles.splice(k, 1);
          }
        }
      });
      for (let k = this.particles.length - 1; k >= 0; k--) {
        const q = this.particles[k];
        q.life -= dt;
        if (q.life <= 0) { this.particles.splice(k, 1); continue; }
        q.vy += (q.g || 900) * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        if (q.spin !== undefined) q.spin += q.vs * dt;
      }
    }

    // ---------- effects ----------
    splash(a, dt) {
      const r = this.rects[a.to];
      if (Math.random() > dt * 40) return;
      const G = S.geom(r.u);
      const fill = this.tubes[a.to].length - a.n + a.n * this.flow(a);
      const y = r.y + G.ih - fill * G.uh;
      const f = S.FLAVOURS[a.c];
      this.particles.push({ x: r.cx + (Math.random() - 0.5) * r.u * 0.3, y, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 120, life: 0.35, max: 0.35, r: r.u * (0.03 + Math.random() * 0.04), color: f.light });
      const v = this.vis[a.to];
      if (v.bubbles.length < 14) v.bubbles.push({ x: 0.2 + Math.random() * 0.6, h: Math.max(0, fill - 1.2 - Math.random()), r: 0.02 + Math.random() * 0.03, v: 1.2 + Math.random(), ambient: false });
    }

    sparkle(i) {
      if (!this.rects) return;
      const r = this.rects[i];
      for (let k = 0; k < 18; k++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 80 + Math.random() * 160;
        this.particles.push({ x: r.cx, y: r.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 120, g: 300, life: 0.8, max: 0.8, r: r.u * 0.05, color: k % 2 ? '#ffe28a' : '#ffffff', star: true, spin: 0, vs: 6 });
      }
    }

    confetti(W) {
      const cols = S.FLAVOURS.map((f) => f.hex);
      for (let k = 0; k < 90; k++) {
        this.particles.push({ x: Math.random() * W, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 80, vy: 60 + Math.random() * 120, g: 60, life: 3.5, max: 3.5, r: 4 + Math.random() * 4, color: cols[k % cols.length], confetti: true, spin: Math.random() * 6, vs: (Math.random() - 0.5) * 12 });
      }
    }

    flow(a) {
      const p = a.t / a.dur;
      if (a.reduced) return ease(clamp(p, 0, 1));
      return ease(clamp((p - MOVE) / (FLOW_END - MOVE), 0, 1));
    }

    // Where the moving glass is: pivot (world), lip (local) and angle.
    pose(i) {
      const r = this.rects[i];
      const v = this.vis[i];
      const u = r.u;
      const restY = r.y - v.lift * u * 0.6 + (v.lift > 0.5 ? Math.sin(performance.now() / 260) * u * 0.04 : 0);
      const a = this.anim;
      if (!a || a.from !== i || a.reduced) return { px: r.x, py: restY, lx: 0, ly: 0, angle: 0 };
      const t = this.rects[a.to];
      const dir = r.cx <= t.cx ? 1 : -1;
      const lx = dir > 0 ? u : 0;
      const remaining = this.tubes[i].length; // after the pour
      const before = remaining + a.n;
      const tiltStart = dir * (0.7 + (CAP - before) * 0.15);
      const tiltEnd = dir * (1.12 + (CAP - remaining) * 0.11);
      const rest = { x: r.x + lx, y: r.y - u * 0.6 };
      const aim = { x: t.cx - dir * u * 0.16, y: t.y - u * 0.62 };
      const p = a.t / a.dur;
      let px, py, ang;
      if (p < MOVE) {
        const k = ease(p / MOVE);
        px = lerp(rest.x, aim.x, k);
        py = lerp(rest.y, aim.y, k) - Math.sin(k * Math.PI) * u * 0.8;
        ang = tiltStart * 0.75 * k;
      } else if (p < FLOW_END) {
        const k = ease((p - MOVE) / (FLOW_END - MOVE));
        px = aim.x;
        py = aim.y;
        ang = lerp(tiltStart * 0.75, tiltEnd, Math.min(1, k * 1.3));
      } else {
        const k = ease((p - FLOW_END) / (1 - FLOW_END));
        px = lerp(aim.x, r.x + lx, k);
        py = lerp(aim.y, r.y, k) - Math.sin(k * Math.PI) * u * 0.5;
        ang = lerp(tiltEnd, 0, easeOut(k));
      }
      return { px, py, lx, ly: 0, angle: ang };
    }

    // The layers to draw in glass i right now.
    bands(i) {
      const v = this.vis[i];
      const out = this.tubes[i].map((q, k) => ({ c: q.c, amt: 1, hidden: q.hidden, reveal: k === v.revealIdx ? v.reveal : 1 }));
      const a = this.anim;
      if (!a) return out;
      const f = this.flow(a);
      const push = (arr, amount) => {
        for (let k = 0; amount > 0.0005; k++) { arr.push({ c: a.c, amt: Math.min(1, amount), hidden: false, reveal: 1 }); amount -= 1; }
      };
      if (i === a.from) {
        if (a.revealed && out.length) { out[out.length - 1].hidden = true; }
        push(out, a.n * (1 - f));
      } else if (i === a.to) {
        out.splice(out.length - a.n, a.n);
        push(out, a.n * f);
      }
      return out;
    }

    // ---------- drawing ----------
    draw(ctx, time, opts = {}) {
      if (!this.rects) return;
      const d = S.dpr;
      S.base(ctx);
      const u = this.L.u;
      for (const sh of this.shelves) this.drawShelf(ctx, sh, u);

      const a = this.anim;
      const moving = a && !a.reduced ? a.from : -1;
      // halos under glasses (cursor, hover, valid targets)
      this.rects.forEach((r, i) => {
        const cursor = opts.cursor && i === this.cursor;
        const hover = i === this.hover && !opts.cursor;
        const valid = this.settings.guides && this.sel !== null && i !== this.sel && R.canPour(this.tubes[this.sel], this.tubes[i]) > 0;
        if (cursor || hover || valid) {
          ctx.save();
          ctx.translate(r.cx, r.base + 2);
          ctx.scale(1, 0.24);
          const g = ctx.createRadialGradient(0, 0, 2, 0, 0, u * 1.05);
          const col = cursor ? '255,214,110' : valid ? '120,255,210' : '255,255,255';
          g.addColorStop(0, `rgba(${col},${cursor ? 0.75 : 0.5})`);
          g.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(-u * 1.1, -u * 1.1, u * 2.2, u * 2.2);
          ctx.restore();
        }
      });

      this.rects.forEach((r, i) => {
        if (i === moving) return;
        this.drawOne(ctx, i, time, opts);
      });
      // the stream
      if (a && !a.reduced) this.drawStream(ctx, a, time);
      if (moving >= 0) this.drawOne(ctx, moving, time, opts);

      // cursor chevrons and hint markers
      S.base(ctx);
      if (opts.cursor && this.rects[this.cursor]) {
        const r = this.rects[this.cursor];
        const y = r.base + u * 0.42 + Math.sin(time * 5) * 2;
        ctx.fillStyle = '#ffd56e';
        ctx.beginPath();
        ctx.moveTo(r.cx, y - u * 0.16);
        ctx.lineTo(r.cx + u * 0.2, y + u * 0.1);
        ctx.lineTo(r.cx - u * 0.2, y + u * 0.1);
        ctx.closePath();
        ctx.fill();
      }
      if (this.hint) this.drawHint(ctx, time);
      this.drawParticles(ctx);
    }

    drawOne(ctx, i, time, opts) {
      const r = this.rects[i];
      const v = this.vis[i];
      const pose = this.pose(i);
      const u = r.u;
      const d = S.dpr;
      const party = this.solved ? Math.max(0, Math.sin(this.party * 7 + i * 0.7)) * u * 0.18 * Math.min(1, this.party * 2) : 0;
      if (party) pose.py -= party;
      const moving = pose.angle !== 0 || (this.anim && this.anim.from === i && !this.anim.reduced);
      // shadow and counter reflection
      S.base(ctx);
      const air = clamp((r.y - pose.py) / (u * 2), 0, 1);
      ctx.fillStyle = `rgba(30,10,10,${0.32 * (1 - air * 0.7)})`;
      ctx.beginPath();
      const scx = moving ? pose.px + (pose.lx ? -u / 2 : u / 2) : r.cx;
      ctx.ellipse(scx + u * 0.08, r.base + 1, u * (0.62 - air * 0.15), u * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
      const bands = this.bands(i);
      if (r.front && !moving && bands.length && !bands[0].hidden) {
        const G = S.geom(u);
        const g = ctx.createLinearGradient(0, r.base, 0, r.base + u * 0.5);
        g.addColorStop(0, S.mix(S.FLAVOURS[bands[0].c].hex, '#fff4e0', 0.55));
        g.addColorStop(1, 'rgba(255,244,224,0)');
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = g;
        ctx.fillRect(r.x + G.k, r.base + 2, G.iw, u * 0.5);
        ctx.globalAlpha = 1;
      }
      S.drawGlass(ctx, {
        u, px: pose.px, py: pose.py, lx: pose.lx, ly: pose.ly, angle: pose.angle,
        bands, wob: v.wob, sel: v.lift, glow: v.glow ? 0.75 + 0.25 * Math.sin(time * 3 + i) : 0, straw: easeBack(v.straw) * (v.straw > 0 ? 1 : 0),
        symbols: this.settings.symbols, bubbles: v.bubbles, time,
      });
    }

    drawShelf(ctx, sh, u) {
      const h = Math.max(6, u * 0.16);
      const g = ctx.createLinearGradient(0, sh.y, 0, sh.y + h);
      g.addColorStop(0, 'rgba(220,250,255,0.55)');
      g.addColorStop(1, 'rgba(140,200,210,0.25)');
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(sh.x0 + 6, sh.y + h, sh.x1 - sh.x0 - 12, h * 1.4);
      ctx.fillStyle = g;
      ctx.fillRect(sh.x0, sh.y, sh.x1 - sh.x0, h);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(sh.x0, sh.y, sh.x1 - sh.x0, 1.5);
      for (const x of [sh.x0 + u * 0.4, sh.x1 - u * 0.4]) {
        S.chrome(ctx, x - 3, sh.y + h, 6, u * 0.5);
      }
    }

    drawStream(ctx, a, time) {
      const p = a.t / a.dur;
      if (p < MOVE + 0.03 || p > FLOW_END + 0.02) return;
      const k = clamp((p - MOVE) / (FLOW_END - MOVE), 0, 1);
      const width = Math.sin(Math.min(1, k * 1.15) * Math.PI);
      if (width < 0.05) return;
      const pose = this.pose(a.from);
      const r = this.rects[a.from];
      const t = this.rects[a.to];
      const G = S.geom(t.u);
      // lip in world space
      const lip = { x: pose.px, y: pose.py };
      const fill = this.tubes[a.to].length - a.n + a.n * this.flow(a);
      const surf = t.y + G.ih - fill * G.uh;
      const dir = r.cx <= t.cx ? 1 : -1;
      const f = S.FLAVOURS[a.c];
      const wob = Math.sin(time * 40) * 0.8;
      S.base(ctx);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lip.x, lip.y);
      ctx.quadraticCurveTo(lip.x + dir * t.u * 0.22, lip.y + t.u * 0.1, t.cx + wob, Math.max(surf, lip.y + 4));
      ctx.strokeStyle = f.hex;
      ctx.lineWidth = t.u * 0.15 * width;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = t.u * 0.04 * width;
      ctx.stroke();
    }

    drawHint(ctx, time) {
      const h = this.hint;
      const a = this.rects[h.from];
      const b = this.rects[h.to];
      if (!a || !b) return;
      const fade = Math.min(1, h.t * 3) * Math.min(1, (6 - h.t) * 2);
      const u = a.u;
      ctx.save();
      ctx.globalAlpha = fade;
      const ya = a.y - u * 0.55;
      const yb = b.y - u * 0.55;
      const mx = (a.cx + b.cx) / 2;
      const my = Math.min(ya, yb) - u * (0.9 + Math.abs(a.cx - b.cx) / (u * 12));
      ctx.setLineDash([u * 0.16, u * 0.14]);
      ctx.lineDashOffset = -time * 30;
      ctx.strokeStyle = '#ffd56e';
      ctx.lineWidth = Math.max(2, u * 0.07);
      ctx.beginPath();
      ctx.moveTo(a.cx, ya);
      ctx.quadraticCurveTo(mx, my, b.cx, yb - u * 0.1);
      ctx.stroke();
      ctx.setLineDash([]);
      const bounce = Math.sin(time * 6) * u * 0.06;
      [[a, '1', ya], [b, '2', yb]].forEach(([r, label, y]) => {
        ctx.beginPath();
        ctx.arc(r.cx, y - u * 0.05 + bounce, u * 0.24, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd56e';
        ctx.fill();
        ctx.fillStyle = '#3b1d2a';
        ctx.font = `700 ${Math.round(u * 0.32)}px Fredoka, 'Trebuchet MS', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, r.cx, y - u * 0.03 + bounce);
      });
      ctx.restore();
    }

    drawParticles(ctx) {
      for (const q of this.particles) {
        const a = clamp(q.life / q.max, 0, 1);
        ctx.globalAlpha = q.confetti ? Math.min(1, a * 3) : a;
        ctx.fillStyle = q.color;
        if (q.confetti) {
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.spin);
          ctx.scale(1, Math.abs(Math.cos(q.spin * 0.7)) + 0.2);
          ctx.beginPath();
          ctx.arc(0, 0, q.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (q.star) {
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.spin);
          ctx.fillRect(-q.r * 2, -q.r * 0.35, q.r * 4, q.r * 0.7);
          ctx.fillRect(-q.r * 0.35, -q.r * 2, q.r * 0.7, q.r * 4);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  PP.Board = Board;
})();
