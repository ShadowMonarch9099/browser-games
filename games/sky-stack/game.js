// Sky Stack: drop sliding blocks onto a tower. Whatever hangs over is sliced
// off. Every 25 floors the weather changes (wind, then fog, then both).
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas });
  const save = Arcade.save('sky-stack');
  const ui = Arcade.ui.create({
    title: 'Sky Stack',
    tagline: 'How high can you build before you miss?',
    how: [['Space / Tap', 'Drop the block'], ['Line it up', 'Perfect drops grow it back'], ['Esc', 'Pause']],
    // Sky Stack's own look: soft, rounded and bright, like the sky it's set in.
    theme: {
      fonts: 'family=Baloo+2:wght@600;800&family=Nunito:wght@600;800',
      display: '"Baloo 2", "Trebuchet MS", sans-serif',
      body: '"Nunito", "Trebuchet MS", sans-serif',
      overlay: 'rgba(60, 120, 200, .35)',
      panel: '#ffffff', panel2: '#eaf3ff', edge: '#cfe0f5',
      text: '#1d3557', muted: '#5d7699',
      accent: '#ff8a5c', accentInk: '#ffffff',
      radius: '26px', border: '0px',
      shadow: '0 24px 60px rgba(20, 60, 120, .35)', buttonShadow: '0 6px 0 rgba(20, 60, 120, .12)',
    },
  });

  const BLOCK_H = 0.24;     // height of one floor, in block widths
  const RANGE = 1.45;       // how far the sliding block travels from the tower
  const PERFECT = 0.045;    // how close counts as a perfect drop
  const STAGE_LEN = 25;     // floors per weather stage
  const STAGES = ['Clear skies', 'Wind picks up!', 'Fog rolls in!', 'Storm! Wind and fog'];

  let state = 'menu';       // menu | playing | paused | over
  let mode = 'classic';     // classic | daily
  let rand, stack, mover, debris, streak, cam, zoom, overT, flash, hue0, time = 0;

  const height = () => stack.length - 1;
  const stage = () => Math.min(3, Math.floor(height() / STAGE_LEN));
  const windy = () => stage() === 1 || stage() === 3;
  const foggy = () => stage() === 2 || stage() === 3;
  const bestKey = () => (mode === 'daily' ? 'daily:' + Arcade.rng.today() : 'best');

  function start(newMode) {
    mode = newMode;
    rand = mode === 'daily' ? Arcade.rng.daily('sky-stack') : Arcade.rng();
    hue0 = rand.int(0, 359);
    stack = [{ x: 0, z: 0, w: 1, d: 1 }];
    debris = [];
    streak = 0; cam = 0; zoom = 1; overT = 0; flash = 0;
    nextMover();
    ui.hide();
    input.flush();
    state = 'playing';
  }

  function nextMover() {
    const top = stack[stack.length - 1];
    const axis = stack.length % 2 ? 'x' : 'z';
    const side = rand() < 0.5 ? -1 : 1;
    mover = {
      x: top.x, z: top.z, w: top.w, d: top.d, axis, dir: -side, t: 0, vel: 0,
      speed: Math.min(1.5 + stack.length * 0.022, 3.4),
      gust: 2.5 + rand() * 1.5, phase: rand() * 6.28,
    };
    mover[axis] = top[axis] + side * RANGE;
  }

  function drop() {
    const top = stack[stack.length - 1];
    const a = mover.axis, s = a === 'x' ? 'w' : 'd';
    const delta = mover[a] - top[a];
    const overlap = top[s] - Math.abs(delta);
    const y = stack.length * BLOCK_H;

    if (overlap <= 0) {
      debris.push({ x: mover.x, z: mover.z, w: mover.w, d: mover.d, y, vy: 0, age: 0, level: stack.length });
      return gameOver();
    }

    const placed = { x: top.x, z: top.z, w: top.w, d: top.d };
    if (Math.abs(delta) <= PERFECT) {
      streak++;
      flash = 1;
      // Three perfect drops in a row start growing the block back.
      if (streak >= 3) placed[s] = Math.min(1, placed[s] + 0.05);
      Arcade.audio.beep({ freq: 440 * Math.pow(1.06, Math.min(streak, 14)), dur: 0.16, type: 'triangle', vol: 0.4 });
    } else {
      streak = 0;
      placed[s] = overlap;
      placed[a] = top[a] + delta / 2;
      const cut = { x: placed.x, z: placed.z, w: placed.w, d: placed.d, y, vy: 0, age: 0, level: stack.length };
      cut[s] = Math.abs(delta);
      cut[a] = placed[a] + Math.sign(delta) * (overlap / 2 + Math.abs(delta) / 2);
      debris.push(cut);
      Arcade.audio.sfx('thud');
    }
    const before = stage();
    stack.push(placed);
    if (stage() !== before) { ui.toast(STAGES[stage()]); Arcade.audio.sfx('win'); }
    nextMover();
  }

  function gameOver() {
    state = 'over';
    overT = 0;
    mover = null;
    Arcade.audio.sfx('lose');
  }

  function showResults() {
    const score = height();
    const best = Math.max(score, save.get(bestKey(), 0));
    save.set(bestKey(), best);
    ui.results({
      heading: score >= best && score > 0 ? 'New best!' : 'Tower fell',
      rows: [['Height', score], [mode === 'daily' ? "Today's best" : 'Best', best]],
      note: mode === 'daily' ? 'Daily tower: the same blocks for everyone today.' : '',
      buttons: [
        { label: 'Play again', onClick: () => start(mode) },
        mode === 'daily'
          ? { label: 'Classic mode', onClick: () => start('classic') }
          : { label: 'Daily tower', onClick: () => start('daily') },
      ],
    });
  }

  function update(dt) {
    input.poll();
    time += dt;
    if (state === 'menu' || state === 'paused') return;

    for (const p of debris) { p.vy -= 9 * dt; p.y += p.vy * dt; p.age += dt; }
    debris = debris.filter((p) => p.age < 1.6);
    flash = Math.max(0, flash - dt * 3);

    if (state === 'playing') {
      const top = stack[stack.length - 1];
      const a = mover.axis;
      mover.t += dt;
      // Wind: the block speeds up and slows down in gusts.
      const gust = windy() ? 1 + 0.55 * Math.sin(mover.t * mover.gust + mover.phase) : 1;
      mover.vel = mover.dir * mover.speed * gust;
      mover[a] += mover.vel * dt;
      if (mover[a] > top[a] + RANGE) { mover[a] = top[a] + RANGE; mover.dir = -1; }
      if (mover[a] < top[a] - RANGE) { mover[a] = top[a] - RANGE; mover.dir = 1; }
      if (input.solo.pressed('a')) drop();
      const target = Math.max(0, stack.length - 5) * BLOCK_H;
      cam += (target - cam) * Math.min(1, dt * 5);
    } else if (state === 'over') {
      // Pull back to show the whole tower, then the results.
      overT += dt;
      const fit = Math.min(1, (H * 0.5) / ((stack.length * BLOCK_H + 0.5) * baseScale()));
      zoom += (fit - zoom) * Math.min(1, dt * 3);
      cam += (0 - cam) * Math.min(1, dt * 3);
      if (overT > 1.3 && !ui.visible) showResults();
    }
  }

  // ---------- drawing ----------
  // Sized so the sliding block stays on screen at both ends, even on a narrow phone.
  const baseScale = () => Math.min(W, H * 0.8) * 0.22;
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (c1, c2, t) => `rgb(${c1.map((v, i) => Math.round(lerp(v, c2[i], t))).join(',')})`;
  const stars = (() => { const r = Arcade.rng(7); return Array.from({ length: 70 }, () => [r(), r(), 0.5 + r() * 1.5]); })();
  const clouds = (() => { const r = Arcade.rng(11); return Array.from({ length: 6 }, () => [r(), r(), 0.6 + r() * 0.8]); })();

  function project(x, y, z) {
    const S = baseScale() * zoom;
    return [W / 2 + (x - z) * S * 0.866, H * 0.64 + (x + z) * S * 0.5 - (y - cam) * S];
  }
  function poly(points, fill) {
    ctx.beginPath();
    points.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function topFace(b, y) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
    return [project(x0, y, z0), project(x1, y, z0), project(x1, y, z1), project(x0, y, z1)];
  }
  function drawBox(b, y, h, hue, alpha = 1) {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
    ctx.globalAlpha = alpha;
    poly([project(x0, y + h, z1), project(x1, y + h, z1), project(x1, y, z1), project(x0, y, z1)], `hsl(${hue} 55% 44%)`);
    poly([project(x1, y + h, z0), project(x1, y + h, z1), project(x1, y, z1), project(x1, y, z0)], `hsl(${hue} 55% 33%)`);
    poly(topFace(b, y + h), `hsl(${hue} 72% 62%)`);
    ctx.globalAlpha = 1;
  }
  const hueAt = (level) => (hue0 + level * 6) % 360;

  function drawSky() {
    const t = state === 'menu' ? 0 : Math.min(1, height() / 80);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mix([108, 180, 255], [8, 10, 34], t));
    g.addColorStop(1, mix([255, 214, 160], [52, 38, 96], t));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const starAlpha = Math.max(0, Math.min(1, (t - 0.3) / 0.4));
    if (starAlpha > 0) {
      ctx.fillStyle = '#fff';
      for (const [sx, sy, r] of stars) {
        ctx.globalAlpha = starAlpha * (0.5 + 0.5 * Math.sin(time * 2 + sx * 40));
        ctx.fillRect(sx * W, sy * H * 0.8, r, r);
      }
      ctx.globalAlpha = 1;
    }
    if (t < 0.6) {
      ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - t / 0.6)})`;
      for (const [cx, cy, s] of clouds) {
        const x = ((cx * W + time * 6 * s) % (W + 240)) - 120;
        const y = cy * H * 0.7 + cam * baseScale() * 0.25 * s;
        ctx.beginPath();
        ctx.ellipse(x, y % H, 70 * s, 20 * s, 0, 0, 6.3);
        ctx.ellipse(x + 40 * s, (y % H) - 12 * s, 45 * s, 18 * s, 0, 0, 6.3);
        ctx.fill();
      }
    }
  }

  function drawHud() {
    // Soft white numerals with a drop shadow, no outlines.
    const big = Math.round(Math.min(W, H) * 0.15);
    const y = Math.max(big + 6, H * 0.17);
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(20, 50, 110, .35)';
    ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${big}px "Baloo 2", "Trebuchet MS", sans-serif`;
    ctx.fillText(height(), W / 2, y);
    const sub = streak >= 2 ? `Perfect ×${streak}` : mode === 'daily' ? 'Daily tower' : '';
    if (sub) {
      ctx.font = '800 17px "Nunito", "Trebuchet MS", sans-serif';
      ctx.fillStyle = streak >= 2 ? '#fff3b0' : '#fff';
      ctx.fillText(sub, W / 2, y + 26);
    }
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }

  function render(alpha) {
    drawSky();
    if (state === 'menu') return;

    // The pedestal under the tower, then every floor on screen.
    drawBox(stack[0], -6, 6, hueAt(0));
    const first = state === 'over' ? 0 : Math.max(0, stack.length - 40);
    for (let i = first; i < stack.length; i++) drawBox(stack[i], i * BLOCK_H, BLOCK_H, hueAt(i));

    for (const p of debris) drawBox(p, p.y, BLOCK_H, hueAt(p.level), Math.max(0, 1 - p.age / 1.4));

    const topY = stack.length * BLOCK_H;
    if (flash > 0) {
      const pts = topFace(stack[stack.length - 1], topY);
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.strokeStyle = `rgba(255,255,255,${flash})`;
      ctx.lineWidth = 3 + (1 - flash) * 10;
      ctx.stroke();
    }

    if (state !== 'over' && foggy()) {
      // Fog hides the edges of the top floors, so you judge by memory and rhythm.
      const [, fy] = project(0, topY, 0);
      const band = baseScale() * 1.1;
      const g = ctx.createLinearGradient(0, fy - band * 0.2, 0, fy + band);
      g.addColorStop(0, 'rgba(225,230,240,0)');
      g.addColorStop(0.25, 'rgba(225,230,240,0.93)');
      g.addColorStop(0.8, 'rgba(225,230,240,0.93)');
      g.addColorStop(1, 'rgba(225,230,240,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, fy - band * 0.2, W, band * 1.2);
    }

    if (mover) {
      const shown = { ...mover };
      if (state === 'playing') shown[mover.axis] += mover.vel * alpha / 60;
      drawBox(shown, topY, BLOCK_H, hueAt(stack.length));
    }

    if (state !== 'over' && windy()) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const x = ((i * 173 + time * 420) % (W + 200)) - 100;
        const y = (i * 97) % H;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 46, y - 6); ctx.stroke();
      }
    }
    drawHud();
  }

  ui.onPause(() => {
    if (state !== 'playing') return;
    state = 'paused';
    ui.pause({ onResume() { ui.hide(); input.flush(); state = 'playing'; }, onRestart: () => start(mode) });
  });
  // Pause by itself when the player switches tab or app.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') {
      state = 'paused';
      ui.pause({ onResume() { ui.hide(); input.flush(); state = 'playing'; }, onRestart: () => start(mode) });
    }
  });

  const best = save.get('best', 0);
  ui.title({
    note: best ? `Your best: ${best} floors` : '',
    buttons: [{ label: 'Play', onClick: () => start('classic') }, { label: 'Daily tower', onClick: () => start('daily') }],
  });
  Arcade.loop({ update, render }).start();
})();
