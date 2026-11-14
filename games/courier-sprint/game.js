// Courier Sprint: a three-lane runner drawn in simple perspective. Switch
// lanes, jump barriers, roll under signs. Power-ups: magnet, scooter (takes
// one crash for you) and drone (flies you over everything).
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  const save = Arcade.save('courier-sprint');

  const DISPLAY = '"Saira Condensed", "Arial Narrow", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Courier Sprint',
    tagline: 'Next-day delivery. On foot.',
    how: [['← → / swipe', 'Switch lane'], ['↑ / swipe up', 'Jump barriers'], ['↓ / swipe down', 'Roll under signs'], ['Vans', 'Just get out of the way']],
    // Courier Sprint's own look: a shipping label. Navy, orange and tall condensed type.
    theme: {
      fonts: 'family=Saira+Condensed:wght@600;800',
      display: DISPLAY, body: DISPLAY,
      overlay: 'rgba(10, 16, 34, .78)',
      panel: '#f7f3ea', panel2: '#e9e2d0', edge: '#1e2a4a',
      text: '#1e2a4a', muted: '#6b7289',
      accent: '#ff7b00', accentInk: '#ffffff',
      radius: '2px', border: '3px',
      shadow: '8px 8px 0 #ff7b00', buttonShadow: 'none',
      caps: 'uppercase',
    },
  });

  const THEMES = [
    { sky: ['#1e2a4a', '#f08a5d'], far: '#33406b', near: '#27304f', road: '#3b4257' },
    { sky: ['#0b132b', '#3a506b'], far: '#1c2541', near: '#141a30', road: '#2a3145' },
    { sky: ['#5bc0eb', '#fde4cf'], far: '#8fb8d8', near: '#6f9ac0', road: '#59607a' },
  ];
  const F = 9; // how quickly things shrink with distance

  let state = 'menu';
  let p, things, nextZ, dist, speed, parcels, power, rand, overT, swipe = null, time = 0;

  function start() {
    rand = Arcade.rng();
    p = { lane: 0, x: 0, y: 0, vy: 0, roll: 0 };
    things = []; nextZ = 30; dist = 0; speed = 16; parcels = 0; overT = 0;
    power = { magnet: 0, drone: 0, scooter: false };
    ui.hide(); input.flush();
    state = 'playing';
  }

  // One row of obstacles, always leaving a way through.
  function spawnRow(z) {
    const lanes = rand.shuffle([-1, 0, 1]);
    const blocked = rand() < Math.min(0.75, 0.3 + dist / 3000) ? 2 : 1;
    for (let i = 0; i < blocked; i++) {
      const r = rand();
      things.push({ lane: lanes[i], z, type: r < 0.4 ? 'barrier' : r < 0.7 ? 'sign' : 'van' });
    }
    const free = lanes[2];
    if (rand() < 0.07) things.push({ lane: free, z, type: rand.pick(['magnet', 'scooter', 'drone']) });
    else for (let k = 0; k < 3; k++) things.push({ lane: free, z: z + k * 2.2, type: 'parcel' });
  }

  function crash() {
    if (power.scooter) { power.scooter = false; Arcade.audio.sfx('hit'); ui.toast('Scooter took the hit!', 900); return; }
    state = 'over'; overT = 0;
    Arcade.audio.sfx('lose');
  }

  // Swipes: a quick drag picks a direction; a tap is a jump.
  canvas.addEventListener('pointerdown', (e) => { swipe = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!swipe || state !== 'playing') return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return act('up');
    act(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  });
  canvas.style.touchAction = 'none';

  function act(dir) {
    if (dir === 'left') p.lane = Math.max(-1, p.lane - 1);
    if (dir === 'right') p.lane = Math.min(1, p.lane + 1);
    if (dir === 'up' && p.y === 0) { p.vy = 9.5; p.roll = 0; Arcade.audio.sfx('jump'); }
    if (dir === 'down') { p.roll = 0.6; if (p.y > 0) p.vy = -14; }
  }

  function update(dt) {
    input.poll();
    time += dt;
    if (state === 'menu' || ui.visible) return;
    if (state === 'over') {
      overT += dt;
      if (overT > 1.1 && !ui.visible) {
        const score = Math.floor(dist) + parcels * 10;
        const best = Math.max(score, save.get('best', 0));
        save.set('best', best);
        ui.results({ heading: 'Parcel dropped', rows: [['Distance', Math.floor(dist) + ' m'], ['Parcels', parcels], ['Score', score], ['Best', best]], buttons: [{ label: 'Run again', onClick: start }] });
      }
      return;
    }
    const k = input.solo;
    for (const d of ['left', 'right', 'up', 'down']) if (k.pressed(d)) act(d);
    if (k.pressed('a')) act('up');

    speed = Math.min(34, 16 + dist / 180);
    dist += speed * dt;
    p.x += (p.lane - p.x) * Math.min(1, dt * 14);
    p.vy -= 26 * dt; p.y = Math.max(0, p.y + p.vy * dt);
    if (p.y === 0) p.vy = 0;
    p.roll = Math.max(0, p.roll - dt);
    power.magnet = Math.max(0, power.magnet - dt);
    power.drone = Math.max(0, power.drone - dt);
    const flying = power.drone > 0;

    while (nextZ < dist + 70) { spawnRow(nextZ); nextZ += Math.max(9, 16 - dist / 400); }
    for (const t of things) {
      const dz = t.z - dist;
      if (t.gone || dz > 0.9 || dz < -0.9) continue;
      const same = Math.abs(p.x - t.lane) < 0.5;
      if (t.type === 'parcel') {
        if (same || power.magnet > 0 || flying) { t.gone = true; parcels++; Arcade.audio.sfx('coin', { vol: 0.14 }); }
      } else if (['magnet', 'scooter', 'drone'].includes(t.type)) {
        if (same || flying) {
          t.gone = true; Arcade.audio.sfx('select');
          if (t.type === 'magnet') { power.magnet = 8; ui.toast('Parcel magnet!', 900); }
          if (t.type === 'drone') { power.drone = 5; ui.toast('Drone lift!', 900); }
          if (t.type === 'scooter') { power.scooter = true; ui.toast('Scooter: one free crash', 900); }
        }
      } else if (same && !flying && !t.hit) {
        const safe = (t.type === 'barrier' && p.y > 0.7) || (t.type === 'sign' && p.roll > 0);
        if (!safe) { t.hit = true; crash(); if (state === 'over') return; }
      }
    }
    things = things.filter((t) => t.z > dist - 3 && !t.gone);
  }

  // ---------- drawing ----------
  let V;
  function project(lane, z, up = 0) {
    const s = F / (z + F);
    return { x: W / 2 + lane * V.laneW * s, y: V.horizon + (V.floor - V.horizon) * s - up * V.unit * s, s };
  }

  function render() {
    const theme = THEMES[Math.floor(((state === 'menu' ? 0 : dist) / 500) + new Date().getDate()) % THEMES.length];
    V = { horizon: H * 0.36, floor: H * 0.9, laneW: Math.min(W * 0.3, 190), unit: Math.min(H * 0.16, 120) };
    const sky = ctx.createLinearGradient(0, 0, 0, V.horizon);
    sky.addColorStop(0, theme.sky[0]); sky.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, V.horizon + 2);
    const d = state === 'menu' ? time * 10 : dist;
    // skyline, two layers
    [[theme.far, 0.3, 0.55, 70], [theme.near, 0.7, 0.8, 95]].forEach(([color, par, tall, bw]) => {
      ctx.fillStyle = color;
      const off = (d * par * 6) % bw;
      for (let i = -1; i < W / bw + 1; i++) {
        const seed = Math.floor((d * par * 6) / bw) + i;
        const h = (0.3 + 0.7 * Math.abs(Math.sin(seed * 12.9898) * 43758.5453 % 1)) * V.horizon * tall;
        ctx.fillRect(i * bw - off, V.horizon - h, bw - 6, h + 2);
      }
    });
    ctx.fillStyle = '#2a3b2e'; ctx.fillRect(0, V.horizon, W, H);
    // road
    const a = project(-1.6, 60), b = project(1.6, 60), c = project(1.6, -1), e = project(-1.6, -1);
    ctx.fillStyle = theme.road;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, H); ctx.lineTo(e.x, H); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    for (const lane of [-0.5, 0.5]) {
      for (let z = -(d % 6); z < 60; z += 6) {
        const n1 = project(lane, Math.max(z, -0.9)), n2 = project(lane, z + 2.4);
        if (z + 2.4 < -0.9) continue;
        ctx.lineWidth = 6 * n1.s; ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke();
      }
    }
    if (state === 'menu') return;

    // obstacles, far to near
    [...things].sort((m, n) => n.z - m.z).forEach((t) => {
      const dz = t.z - dist;
      if (dz > 60 || dz < -0.9) return;
      const g = project(t.lane, dz), u = V.unit * g.s, w = V.laneW * 0.8 * g.s;
      if (t.type === 'barrier') {
        ctx.fillStyle = '#ff7b00'; ctx.fillRect(g.x - w / 2, g.y - u * 0.55, w, u * 0.3);
        ctx.fillStyle = '#fff'; for (let k = 0; k < 3; k++) ctx.fillRect(g.x - w / 2 + (k * 2 + 0.5) * w / 6, g.y - u * 0.55, w / 6, u * 0.3);
        ctx.fillStyle = '#444'; ctx.fillRect(g.x - w / 2, g.y - u * 0.25, w * 0.08, u * 0.25); ctx.fillRect(g.x + w / 2 - w * 0.08, g.y - u * 0.25, w * 0.08, u * 0.25);
      } else if (t.type === 'sign') {
        ctx.fillStyle = '#444'; ctx.fillRect(g.x - w / 2, g.y - u * 1.7, w * 0.07, u * 1.7); ctx.fillRect(g.x + w / 2 - w * 0.07, g.y - u * 1.7, w * 0.07, u * 1.7);
        ctx.fillStyle = '#2a9d8f'; ctx.fillRect(g.x - w / 2, g.y - u * 1.7, w, u * 0.85);
        ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.max(6, u * 0.4)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillText('DUCK', g.x, g.y - u * 1.15);
      } else if (t.type === 'van') {
        ctx.fillStyle = '#f7f3ea'; ctx.beginPath(); ctx.roundRect(g.x - w / 2, g.y - u * 1.5, w, u * 1.4, u * 0.12); ctx.fill();
        ctx.fillStyle = '#ff7b00'; ctx.fillRect(g.x - w / 2, g.y - u * 0.7, w, u * 0.18);
        ctx.fillStyle = '#1e2a4a'; ctx.fillRect(g.x - w * 0.36, g.y - u * 1.35, w * 0.72, u * 0.45);
        ctx.fillStyle = '#111'; ctx.fillRect(g.x - w * 0.42, g.y - u * 0.14, w * 0.2, u * 0.14); ctx.fillRect(g.x + w * 0.22, g.y - u * 0.14, w * 0.2, u * 0.14);
      } else if (t.type === 'parcel') {
        const bob = Math.sin(time * 6 + t.z) * u * 0.05;
        ctx.fillStyle = '#c98b4b'; ctx.fillRect(g.x - u * 0.16, g.y - u * 0.55 + bob, u * 0.32, u * 0.32);
        ctx.fillStyle = '#f7f3ea'; ctx.fillRect(g.x - u * 0.03, g.y - u * 0.55 + bob, u * 0.06, u * 0.32);
      } else {
        ctx.fillStyle = { magnet: '#e63946', scooter: '#3a86ff', drone: '#9d4edd' }[t.type];
        ctx.beginPath(); ctx.arc(g.x, g.y - u * 0.5, u * 0.28, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.max(6, u * 0.34)}px ${DISPLAY}`; ctx.textAlign = 'center';
        ctx.fillText({ magnet: 'M', scooter: 'S', drone: 'D' }[t.type], g.x, g.y - u * 0.38);
      }
    });

    // the courier
    const flying = power.drone > 0;
    const g = project(p.x, 0, flying ? 1.6 : p.y), u = V.unit, roll = p.roll > 0 && !flying;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(g.x, project(p.x, 0).y, u * 0.3, u * 0.08, 0, 0, 6.3); ctx.fill();
    const bodyH = roll ? u * 0.45 : u * 0.8;
    ctx.fillStyle = '#ff7b00'; ctx.beginPath(); ctx.roundRect(g.x - u * 0.22, g.y - bodyH, u * 0.44, bodyH, u * 0.1); ctx.fill();
    ctx.fillStyle = '#c98b4b'; ctx.fillRect(g.x - u * 0.18, g.y - bodyH + u * 0.12, u * 0.36, bodyH * 0.45);
    ctx.fillStyle = '#f2b98b'; ctx.beginPath(); ctx.arc(g.x, g.y - bodyH - u * 0.14, u * 0.16, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#1e2a4a'; ctx.fillRect(g.x - u * 0.18, g.y - bodyH - u * 0.3, u * 0.36, u * 0.1);
    if (power.scooter) { ctx.strokeStyle = '#3a86ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(g.x, g.y - bodyH * 0.5, u * 0.55, 0, 6.3); ctx.stroke(); }
    if (flying) { ctx.fillStyle = '#9d4edd'; ctx.fillRect(g.x - u * 0.5, g.y - bodyH - u * 0.6, u, u * 0.07); ctx.fillRect(g.x - u * 0.03, g.y - bodyH - u * 0.55, u * 0.06, u * 0.25); }

    // HUD: a parcel label
    ctx.fillStyle = '#f7f3ea'; ctx.fillRect(14, 14, 190, 64);
    ctx.strokeStyle = '#1e2a4a'; ctx.lineWidth = 3; ctx.strokeRect(14, 14, 190, 64);
    ctx.fillStyle = '#ff7b00'; ctx.fillRect(14, 14, 10, 64);
    ctx.fillStyle = '#1e2a4a'; ctx.textAlign = 'left';
    ctx.font = `800 30px ${DISPLAY}`; ctx.fillText(Math.floor(dist) + ' M', 36, 46);
    ctx.font = `600 17px ${DISPLAY}`; ctx.fillText('PARCELS  ' + parcels, 36, 68);
    let px = 214;
    for (const [on, text, color] of [[power.magnet > 0, 'MAGNET ' + Math.ceil(power.magnet), '#e63946'], [flying, 'DRONE ' + Math.ceil(power.drone), '#9d4edd'], [power.scooter, 'SCOOTER', '#3a86ff']]) {
      if (!on) continue;
      ctx.font = `800 16px ${DISPLAY}`;
      const w = ctx.measureText(text).width + 16;
      ctx.fillStyle = color; ctx.fillRect(px, 14, w, 26); ctx.fillStyle = '#fff'; ctx.fillText(text, px + 8, 33);
      px += w + 6;
    }
  }

  ui.onPause(() => { if (state === 'playing') ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart: start }); });
  const best = save.get('best', 0);
  ui.title({ note: best ? 'Best score: ' + best : '', buttons: [{ label: 'Start run', onClick: start }] });
  Arcade.loop({ update, render }).start();
})();
