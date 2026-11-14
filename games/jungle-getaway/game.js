// Jungle Getaway: an endless side-scrolling runner. Jump logs and pits, slide
// under branches. Each stumble lets the boulder catch up; two and it has you.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  input.touchPad(['down', 'a']);
  const save = Arcade.save('jungle-getaway');

  const DISPLAY = '"Luckiest Guy", "Arial Black", sans-serif';
  const BODY = '"Nunito", "Trebuchet MS", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Jungle Getaway',
    tagline: 'You took the idol. The boulder noticed.',
    how: [['Space / A', 'Jump (twice for a double jump)'], ['Down / ▼', 'Slide under branches'], ['Stumble twice', 'and the boulder gets you']],
    // Jungle Getaway's own look: carved wood and sunset orange.
    theme: {
      fonts: 'family=Luckiest+Guy&family=Nunito:wght@600;800',
      display: DISPLAY, body: BODY,
      overlay: 'rgba(30, 14, 40, .72)',
      panel: '#7a4a21', panel2: '#5e3716', edge: '#2e1a08',
      text: '#ffeccb', muted: '#e0b98a',
      accent: '#ff8c42', accentInk: '#2e1a08',
      radius: '14px', border: '5px',
      shadow: 'inset 0 0 0 3px #9a6431, 0 12px 0 rgba(0,0,0,.35)', buttonShadow: '0 4px 0 #2e1a08',
    },
  });

  // Everything is laid out for a 540-tall screen and scaled to fit.
  const GROUND = 410, PX = 190, GRAV = 2300;
  const MISSIONS = [
    ['Run 300 m', (r) => r.m >= 300], ['Collect 15 coins in one run', (r) => r.coins >= 15], ['Slide under 5 branches', (r) => r.slides >= 5],
    ['Run 600 m', (r) => r.m >= 600], ['Jump 12 logs in one run', (r) => r.logs >= 12], ['Collect 40 coins in one run', (r) => r.coins >= 40],
    ['Run 500 m without a stumble', (r) => r.cleanM >= 500], ['Run 1000 m', (r) => r.m >= 1000], ['Slide under 15 branches', (r) => r.slides >= 15],
    ['Run 1500 m', (r) => r.m >= 1500],
  ];
  const HATS = ['#8a5a2b', '#3fa34d', '#3a86ff', '#ffd23f'];

  // Hand-made stretches of jungle, easy to hard. [type, x, height above ground]
  const CHUNKS = [
    [[['log', 200]], [['coin', 120, 40], ['coin', 170, 40], ['coin', 220, 40]], [['branch', 220]], [['log', 160], ['coin', 160, 120]],
      [['coin', 100, 40], ['coin', 150, 90], ['coin', 200, 120], ['coin', 250, 90], ['coin', 300, 40]]],
    [[['log', 150], ['branch', 480]], [['pit', 200]], [['branch', 150], ['coin', 150, 20], ['log', 470]], [['log', 150], ['log', 420]],
      [['pit', 180], ['coin', 235, 130], ['coin', 285, 130]], [['branch', 160], ['branch', 400]]],
    [[['log', 140], ['pit', 400], ['branch', 720]], [['pit', 150], ['log', 470], ['coin', 470, 130]], [['branch', 140], ['log', 380], ['branch', 640]],
      [['log', 140], ['log', 330], ['pit', 560]], [['pit', 140], ['pit', 440]], [['branch', 130], ['pit', 400], ['coin', 455, 140], ['log', 700]]],
  ];
  const LEN = { log: 44, branch: 120, pit: 110 };

  let state = 'menu';
  let p, cam, speed, things, nextX, run, stumbles, calm, gap, time = 0, rand, overT;

  function start() {
    rand = Arcade.rng();
    p = { y: GROUND, vy: 0, jumps: 0, slide: 0, hurt: 0, fell: false };
    cam = 0; speed = 330; things = []; nextX = 700; stumbles = 0; calm = 0; gap = 1; overT = 0;
    run = { m: 0, coins: 0, slides: 0, logs: 0, cleanM: 0, lastHitM: 0 };
    ui.hide(); input.flush();
    state = 'playing';
  }

  function spawn() {
    const tier = Math.min(2, Math.floor(run.m / 350));
    const pool = CHUNKS[rand.int(Math.max(0, tier - 1), tier)];
    const chunk = rand.pick(pool);
    let end = 0;
    for (const [type, x, up] of chunk) {
      things.push({ type, x: nextX + x, up: up || 0, done: false });
      end = Math.max(end, x + (LEN[type] || 0));
    }
    nextX += end + Math.max(250, 420 - run.m * 0.08);
  }

  function stumble() {
    if (p.hurt > 0) return;
    stumbles++; calm = 0; p.hurt = 1.1; run.lastHitM = run.m;
    Arcade.audio.sfx('hit');
    if (stumbles >= 2) caught();
  }
  function caught() {
    state = 'over'; overT = 0;
    Arcade.audio.sfx('lose');
  }

  function update(dt) {
    input.poll();
    time += dt;
    if (state === 'menu' || ui.visible) return;
    if (state === 'over') {
      overT += dt; gap = Math.max(0, gap - dt * 2);
      if (p.fell) { p.vy += GRAV * dt; p.y += p.vy * dt; }
      if (overT > 1.3) results();
      return;
    }
    const k = input.solo;
    speed = Math.min(640, 330 + Math.floor(time / 30) * 24 + run.m * 0.06);
    cam += speed * (p.hurt > 0.6 ? 0.55 : 1) * dt;
    run.m = Math.floor(cam / 10);
    run.cleanM = Math.max(run.cleanM, run.m - run.lastHitM);
    while (nextX < cam + 1400) spawn();

    const onGround = p.y >= GROUND && !p.fell;
    if (k.pressed('a') || k.pressed('up')) {
      if (onGround || p.jumps < 2) { p.vy = p.jumps === 0 ? -760 : -660; p.jumps++; p.slide = 0; Arcade.audio.sfx('jump', { freq: 300 + p.jumps * 120 }); }
    }
    if (k.held('down') && onGround) p.slide = 0.25; else p.slide = Math.max(0, p.slide - dt);
    if (k.held('down') && !onGround) p.vy += 2600 * dt;        // drop faster
    p.vy += GRAV * dt; p.y += p.vy * dt;
    const px = cam + PX;
    const overPit = things.some((t) => t.type === 'pit' && px > t.x + 6 && px < t.x + LEN.pit - 6);
    if (p.y >= GROUND && !overPit && !p.fell) { p.y = GROUND; p.vy = 0; p.jumps = 0; }
    if (p.y > GROUND + 30 && overPit) { p.fell = true; return caught(); }
    p.hurt = Math.max(0, p.hurt - dt);
    calm += dt;
    if (calm > 10 && stumbles) { stumbles = 0; }
    gap += ((stumbles ? 0.35 : 1) - gap) * Math.min(1, dt * 2);

    const tall = p.slide > 0 ? 32 : 70;
    for (const t of things) {
      const dx = px - t.x;
      if (t.type === 'coin') {
        if (!t.done && Math.abs(dx) < 26 && Math.abs((p.y - tall / 2) - (GROUND - t.up - 16)) < 46) { t.done = true; run.coins++; Arcade.audio.sfx('coin', { vol: 0.15 }); }
      } else if (t.type === 'log') {
        if (dx > -14 && dx < LEN.log + 14 && p.y > GROUND - 38) stumble();
        if (!t.done && dx > LEN.log + 14) { t.done = true; if (p.hurt <= 0) run.logs++; }
      } else if (t.type === 'branch') {
        if (dx > -10 && dx < LEN.branch + 10 && p.y - tall < GROUND - 44 && p.y > GROUND - 150) stumble();
        if (!t.done && dx > LEN.branch + 10) { t.done = true; if (p.hurt <= 0) run.slides++; }
      }
    }
    things = things.filter((t) => t.x > cam - 300);
  }

  function results() {
    if (ui.visible) return;
    const best = Math.max(run.m, save.get('best', 0));
    save.set('best', best);
    save.set('bank', save.get('bank', 0) + run.coins);
    let at = save.get('mission', 0), note = '';
    if (at < MISSIONS.length && MISSIONS[at][1](run)) {
      note = 'Mission done: ' + MISSIONS[at][0] + '!';
      at++; save.set('mission', at);
      if (at % 3 === 0) note += ' New hat unlocked.';
    }
    ui.results({
      heading: p.fell ? 'Down the pit!' : 'Flattened!',
      rows: [['Distance', run.m + ' m'], ['Coins', run.coins], ['Best', best + ' m']],
      note: note || (at < MISSIONS.length ? 'Mission: ' + MISSIONS[at][0] : 'All missions done!'),
      buttons: [{ label: 'Run again', onClick: start }],
    });
  }

  // ---------- drawing ----------
  function hills(u, depth, base, color, amp) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, H);
    const off = cam * depth;
    for (let x = 0; x <= W + 20; x += 20) {
      const wx = (x / u + off) * 0.01;
      ctx.lineTo(x, (base - amp * (Math.sin(wx) * 0.6 + Math.sin(wx * 2.3 + 1) * 0.4)) * u);
    }
    ctx.lineTo(W, H); ctx.fill();
  }

  function render() {
    const u = H / 540;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#3b1d5c'); sky.addColorStop(0.5, '#d94f5c'); sky.addColorStop(0.8, '#ffb347');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffe2a8'; ctx.beginPath(); ctx.arc(W * 0.72, 250 * u, 70 * u, 0, 6.3); ctx.fill();
    if (state === 'menu') { cam = time * 60; }
    hills(u, 0.08, 330, '#6b2d5c', 60);
    hills(u, 0.2, 370, '#45214f', 45);
    hills(u, 0.45, 400, '#2a1638', 26);
    const sx = (wx) => (wx - cam) * u;

    // ground, with gaps where the pits are
    ctx.fillStyle = '#1c2b1e'; ctx.fillRect(0, GROUND * u, W, H);
    ctx.fillStyle = '#3d7a3a'; ctx.fillRect(0, GROUND * u, W, 10 * u);
    if (state === 'menu') return;
    for (const t of things) {
      const x = sx(t.x);
      if (t.type === 'pit') {
        ctx.fillStyle = '#0c0714'; ctx.fillRect(x, GROUND * u, LEN.pit * u, H);
      } else if (t.type === 'log') {
        ctx.fillStyle = '#6b3f1d'; ctx.beginPath(); ctx.roundRect(x, (GROUND - 40) * u, LEN.log * u, 40 * u, 8 * u); ctx.fill();
        ctx.fillStyle = '#c99a5b'; ctx.beginPath(); ctx.ellipse(x + 8 * u, (GROUND - 20) * u, 8 * u, 18 * u, 0, 0, 6.3); ctx.fill();
      } else if (t.type === 'branch') {
        ctx.fillStyle = '#3a2412'; ctx.fillRect(x, (GROUND - 150) * u, LEN.branch * u, 16 * u);
        ctx.fillStyle = '#2f6b33';
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(x + (12 + k * 24) * u, (GROUND - 92 + (k % 2) * 10) * u, 18 * u, 44 * u, 0, 0, 6.3); ctx.fill(); }
      } else if (!t.done) {
        const y = (GROUND - t.up - 16) * u + Math.sin(time * 5 + t.x) * 3;
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x, y, 11 * u, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#b8860b'; ctx.fillRect(x - 2 * u, y - 6 * u, 4 * u, 12 * u);
      }
    }

    // the boulder: it sits further back the safer you are
    const bx = (PX - 150 - gap * 330) * u, br = 95 * u;
    ctx.save(); ctx.translate(bx, (GROUND) * u - br); ctx.rotate(cam / 95);
    ctx.fillStyle = '#6f6a75'; ctx.beginPath(); ctx.arc(0, 0, br, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#56515c';
    for (const [ox, oy, r] of [[-30, -20, 22], [28, 30, 16], [20, -40, 12], [-36, 36, 10]]) { ctx.beginPath(); ctx.arc(ox * u, oy * u, r * u, 0, 6.3); ctx.fill(); }
    ctx.restore();

    // the explorer
    const hat = HATS[Math.min(3, Math.floor(save.get('mission', 0) / 3))];
    const x = PX * u, y = p.y * u, sl = p.slide > 0;
    if (!(p.hurt > 0 && Math.floor(time * 16) % 2)) {
      const step = Math.sin(cam / 14) * 10 * u;
      ctx.fillStyle = '#2e1a08';
      if (!sl && p.y >= GROUND) { ctx.fillRect(x - 10 * u + step, y - 18 * u, 8 * u, 18 * u); ctx.fillRect(x + 2 * u - step, y - 18 * u, 8 * u, 18 * u); }
      ctx.fillStyle = '#e7d3a8';
      ctx.beginPath(); ctx.roundRect(x - 15 * u, y - (sl ? 26 : 52) * u, (sl ? 46 : 30) * u, (sl ? 22 : 36) * u, 8 * u); ctx.fill();
      const hx = x + (sl ? 34 : 2) * u, hy = y - (sl ? 22 : 62) * u;
      ctx.fillStyle = '#f2b98b'; ctx.beginPath(); ctx.arc(hx, hy, 12 * u, 0, 6.3); ctx.fill();
      ctx.fillStyle = hat; ctx.fillRect(hx - 17 * u, hy - 9 * u, 34 * u, 5 * u); ctx.fillRect(hx - 10 * u, hy - 19 * u, 20 * u, 11 * u);
    }

    // HUD: a wooden signboard
    const mission = save.get('mission', 0);
    ctx.fillStyle = '#7a4a21'; ctx.strokeStyle = '#2e1a08'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(14, 14, 210, 74, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffeccb'; ctx.textAlign = 'left';
    ctx.font = `30px ${DISPLAY}`; ctx.fillText(run.m + ' m', 28, 50);
    ctx.font = `18px ${DISPLAY}`; ctx.fillStyle = '#ffd23f'; ctx.fillText('● ' + run.coins, 150, 46);
    ctx.font = `800 13px ${BODY}`; ctx.fillStyle = '#e0b98a';
    ctx.fillText(mission < MISSIONS.length ? MISSIONS[mission][0] : 'All missions done', 28, 74);
    if (stumbles) {
      ctx.textAlign = 'center'; ctx.font = `22px ${DISPLAY}`; ctx.fillStyle = '#fff';
      ctx.fillText('Careful! One more stumble...', W / 2, 120 * u);
    }
  }

  ui.onPause(() => { if (state === 'playing') ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart: start }); });
  const best = save.get('best', 0);
  ui.title({ note: best ? 'Best run: ' + best + ' m' : '', buttons: [{ label: 'Run!', onClick: start }] });
  Arcade.loop({ update, render }).start();
})();
