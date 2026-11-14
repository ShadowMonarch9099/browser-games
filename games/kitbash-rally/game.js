// Kitbash Rally: build a kart from parts, then race it top-down against five
// computer karts (and a friend, if you like). Parts are stats and powers at
// once: no rocket pod, no boosts; no spring, no hopping; a lopsided build
// pulls to one side. Two cups of three tracks.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  const save = Arcade.save('kitbash-rally');

  const DISPLAY = '"Racing Sans One", "Impact", sans-serif';
  const BODY = '"Archivo", "Segoe UI", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Kitbash Rally',
    tagline: 'Build it. Race it. Rebuild it.',
    how: [['Red kart', 'W A S D · F hop · G boost'], ['Blue kart', 'Arrows · Enter hop · Right Shift boost'], ['Gamepad', 'Stick steers · A gas · d-pad up hop · B boost'], ['Rocket pod', 'Lets you collect and fire boosts'], ['Spring', 'Hop over oil and grass'], ['Magnet', 'Pulls pickups in']],
    // Kitbash Rally's own look: a workshop. Steel grey, safety yellow, chequered flags.
    theme: {
      fonts: 'family=Racing+Sans+One&family=Archivo:wght@500;800',
      display: DISPLAY, body: BODY,
      overlay: 'rgba(20, 22, 34, .82)',
      panel: '#2b2d42', panel2: '#3d405b', edge: '#ffd166',
      text: '#edf2f4', muted: '#a9aec4',
      accent: '#ffd166', accentInk: '#2b2d42',
      radius: '4px', border: '3px',
      shadow: '0 0 0 3px #2b2d42, 0 0 0 6px #ffd166', buttonShadow: 'none',
      caps: 'uppercase',
    },
  });

  // ---------- parts ----------
  const PARTS = {
    empty: { name: 'Empty', short: '', color: 'transparent', mass: 0 },
    engine: { name: 'Engine', short: 'ENG', color: '#ef476f', mass: 2, power: 3 },
    turbo: { name: 'Big engine', short: 'V8', color: '#d62828', mass: 4, power: 6 },
    wheels: { name: 'Grippy wheels', short: 'GRP', color: '#118ab2', mass: 1, grip: 0.18 },
    plate: { name: 'Armour plate', short: 'ARM', color: '#8d99ae', mass: 3, armor: 1 },
    rocket: { name: 'Rocket pod', short: 'RKT', color: '#ff7b00', mass: 1, rocket: 1 },
    magnet: { name: 'Magnet', short: 'MAG', color: '#9d4edd', mass: 1, magnet: 1 },
    spring: { name: 'Spring', short: 'SPR', color: '#06d6a0', mass: 1, spring: 1 },
    spoiler: { name: 'Spoiler', short: 'SPL', color: '#ffd166', mass: 1, grip: 0.1, top: 1 },
  };
  const PALETTE = ['empty', 'engine', 'turbo', 'wheels', 'plate', 'rocket', 'magnet', 'spring', 'spoiler'];
  // Six slots: front, middle, back on the left and right side.
  const SLOT_NAMES = ['Front left', 'Front right', 'Middle left', 'Middle right', 'Back left', 'Back right'];
  const DEFAULT = ['wheels', 'wheels', 'engine', 'rocket', 'spring', 'engine'];

  function stats(build) {
    const s = { mass: 5, power: 6, grip: 0.55, armor: 0, rocket: 0, magnet: 0, spring: 0, top: 0, pull: 0 };
    build.forEach((id, i) => {
      const p = PARTS[id];
      s.mass += p.mass; s.power += p.power || 0; s.grip += p.grip || 0; s.armor += p.armor || 0;
      s.rocket += p.rocket || 0; s.magnet += p.magnet || 0; s.spring += p.spring || 0; s.top += p.top || 0;
      s.pull += (i % 2 ? 1 : -1) * p.mass;                  // left minus right
    });
    s.accel = (s.power / s.mass) * 9;
    s.topSpeed = 15 + s.power * 0.7 - s.mass * 0.35 + s.top * 1.2;
    s.grip = Math.min(1.15, s.grip);
    return s;
  }

  // ---------- tracks: loops through control points, smoothed ----------
  const TRACKS = [
    { name: 'Tin Can Oval', cup: 0, pts: [[12, 30], [20, 10], [50, 6], [80, 10], [88, 30], [80, 50], [50, 54], [20, 50]], oil: 2 },
    { name: 'Scrapyard Esses', cup: 0, pts: [[10, 12], [40, 8], [55, 22], [70, 8], [90, 14], [88, 46], [62, 52], [50, 36], [36, 52], [10, 48]], oil: 3 },
    { name: 'Bolt Bend', cup: 0, pts: [[14, 8], [86, 8], [90, 28], [60, 30], [60, 40], [88, 44], [84, 54], [16, 54], [10, 30]], oil: 4 },
    { name: 'Gearbox Gorge', cup: 1, pts: [[10, 10], [30, 6], [44, 26], [58, 6], [90, 10], [90, 52], [70, 52], [56, 34], [42, 52], [10, 52]], oil: 4 },
    { name: 'Sprocket Spiral', cup: 1, pts: [[50, 30], [62, 18], [80, 14], [90, 30], [80, 50], [50, 54], [18, 50], [10, 30], [22, 10], [40, 14]], oil: 5 },
    { name: 'Piston Peak', cup: 1, pts: [[8, 50], [14, 12], [30, 22], [46, 6], [62, 22], [78, 6], [92, 14], [90, 50], [60, 44], [36, 54]], oil: 6 },
  ];
  const HALF = 4.2, LAPS = 3;

  function smooth(pts) {
    const out = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (let t = 0; t < 1; t += 1 / 16) {
        const t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      }
    }
    return out;
  }
  function nearest(path, x, y, hint) {
    let best = hint || 0, bd = 1e9;
    const n = path.length, from = hint === undefined ? 0 : hint - 20, to = hint === undefined ? n : hint + 40;
    for (let k = from; k < to; k++) {
      const i = ((k % n) + n) % n, d = (path[i][0] - x) ** 2 + (path[i][1] - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return { i: best, d: Math.sqrt(bd) };
  }

  // ---------- race ----------
  const CPU = [
    { name: 'Rusty', color: '#f4a261', build: ['wheels', 'wheels', 'engine', 'engine', 'plate', 'plate'], skill: 0.86 },
    { name: 'Volt', color: '#4cc9f0', build: ['spoiler', 'wheels', 'turbo', 'rocket', 'empty', 'engine'], skill: 0.9 },
    { name: 'Gizmo', color: '#b5179e', build: ['magnet', 'rocket', 'engine', 'engine', 'wheels', 'spring'], skill: 0.88 },
    { name: 'Clunk', color: '#6c757d', build: ['plate', 'plate', 'turbo', 'turbo', 'wheels', 'wheels'], skill: 0.84 },
    { name: 'Zip', color: '#80ed99', build: ['wheels', 'spoiler', 'engine', 'empty', 'rocket', 'engine'], skill: 0.92 },
  ];
  const HUMANS = [{ name: 'Red', color: '#ef233c', kb: 'kb1', pad: 'pad0' }, { name: 'Blue', color: '#3a86ff', kb: 'kb2', pad: 'pad1' }];
  const POINTS = [10, 8, 6, 5, 4, 3, 2];

  let state = 'menu', humans = 1, builds = [save.get('build0', DEFAULT), save.get('build1', DEFAULT)], cup = 0, round = 0, table = null;
  let track, path, karts, items, oils, startT, time = 0, finishOrder, endT, V;

  function startRace() {
    track = TRACKS[cup * 3 + round];
    path = smooth(track.pts);
    const rand = Arcade.rng(Arcade.rng.hash(track.name));
    const list = [...Array(humans)].map((_, i) => ({ ...HUMANS[i], human: i, build: builds[i] })).concat(CPU.slice(0, 6 - humans).map((c) => ({ ...c, human: -1 })));
    const [sx, sy] = path[0], [nx, ny] = path[3], ang = Math.atan2(ny - sy, nx - sx);
    karts = list.map((k, i) => {
      const row = Math.floor(i / 2), side = i % 2 ? 1 : -1;
      const back = row * 3.2 + 2, x = sx - Math.cos(ang) * back + Math.cos(ang + 1.57) * side * 1.8, y = sy - Math.sin(ang) * back + Math.sin(ang + 1.57) * side * 1.8;
      // karts line up just behind the start line, so they start on lap -1 and cross into lap 0
      const idx = nearest(path, x, y).i, lap = idx / path.length > 0.5 ? -1 : 0;
      return { ...k, s: stats(k.build), x, y, a: ang, vx: 0, vy: 0, lap, idx, prog: lap + idx / path.length, boosts: 0, boostT: 0, hop: 0, hopCool: 0, spin: 0, done: false, time: 0 };
    });
    items = []; oils = [];
    for (let k = 0; k < 10; k++) { const i = Math.floor(((k + 0.5) / 10) * path.length); items.push({ x: path[i][0] + (rand() - 0.5) * 4, y: path[i][1] + (rand() - 0.5) * 4, type: k % 2 ? 'boost' : 'bolt', gone: 0 }); }
    for (let k = 0; k < track.oil; k++) { const i = Math.floor(rand() * path.length); if (i > 20) oils.push({ x: path[i][0] + (rand() - 0.5) * 3, y: path[i][1] + (rand() - 0.5) * 3 }); }
    finishOrder = []; startT = time + 3; endT = 0;
    ui.hide(); input.flush(); state = 'racing';
  }

  function drive(k, dt) {
    let steer = 0, gas = 0, hop = false, boost = false;
    if (k.human >= 0) {
      const kb = input.device(HUMANS[k.human].kb), pad = input.device(HUMANS[k.human].pad);
      steer = kb.x || pad.x; gas = -(kb.y || pad.y) || (pad.held('a') ? 1 : 0);
      hop = kb.pressed('a') || pad.pressed('up'); boost = kb.pressed('b') || pad.pressed('b');
    } else {
      // aim at a point further along the road, with a little skill-based wobble
      const ahead = path[(k.idx + 9) % path.length], want = Math.atan2(ahead[1] - k.y, ahead[0] - k.x);
      let diff = want - k.a; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      steer = Math.max(-1, Math.min(1, diff * 2.5)); gas = Math.abs(diff) > 0.9 ? 0.4 : k.skill;
      boost = k.boosts > 0 && Math.abs(diff) < 0.15; hop = k.s.spring && oils.some((o) => Math.hypot(o.x - k.x, o.y - k.y) < 3.5);
    }
    if (time < startT || k.done) { gas = 0; hop = false; boost = false; if (k.done) gas = 0.3; }
    k.hop = Math.max(0, k.hop - dt); k.hopCool = Math.max(0, k.hopCool - dt); k.boostT = Math.max(0, k.boostT - dt); k.spin = Math.max(0, k.spin - dt);
    if (hop && k.s.spring && k.hopCool <= 0) { k.hop = 0.55; k.hopCool = 2.2; if (k.human >= 0) Arcade.audio.sfx('jump', { vol: 0.15 }); }
    if (boost && k.boosts > 0 && k.boostT <= 0) { k.boosts--; k.boostT = 1.4; if (k.human >= 0) Arcade.audio.sfx('win', { dur: 0.25, vol: 0.2 }); }

    const speed = Math.hypot(k.vx, k.vy), off = nearest(path, k.x, k.y, k.idx);
    k.idx = off.i;
    const grass = off.d > HALF && k.hop <= 0;
    // turning, plus the pull of a lopsided build
    if (k.spin > 0) k.a += 9 * dt;
    else k.a += (steer * (2.6 + k.s.grip) * Math.min(1, speed / 6) + k.s.pull * 0.012 * Math.min(1, speed / 10)) * dt;
    const top = k.s.topSpeed * (grass ? 0.45 : 1) * (k.boostT > 0 ? 1.45 : 1);
    const fx = Math.cos(k.a), fy = Math.sin(k.a);
    let ax = fx * gas * k.s.accel * (k.boostT > 0 ? 2 : 1), ay = fy * gas * k.s.accel * (k.boostT > 0 ? 2 : 1);
    k.vx += ax * dt; k.vy += ay * dt;
    // grip pulls the slide back in line with where the kart points
    const along = k.vx * fx + k.vy * fy, sideX = k.vx - fx * along, sideY = k.vy - fy * along;
    const g = Math.min(1, k.s.grip * 6 * dt);
    k.vx -= sideX * g; k.vy -= sideY * g;
    const sp = Math.hypot(k.vx, k.vy), drag = gas ? 0.4 : 1.6;
    if (sp > top) { k.vx *= top / sp; k.vy *= top / sp; } else { k.vx *= 1 - drag * dt * 0.3; k.vy *= 1 - drag * dt * 0.3; }
    k.x += k.vx * dt; k.y += k.vy * dt;

    // lap counting by progress along the path
    const prev = k.prog, frac = k.idx / path.length;
    if (frac < 0.1 && (prev % 1) > 0.9) k.lap++;
    if (frac > 0.9 && (prev % 1) < 0.1 && k.lap > 0) k.lap--;
    k.prog = k.lap + frac;
    if (!k.done && k.lap >= LAPS && time > startT) { k.done = true; k.time = time - startT; finishOrder.push(k); if (k.human >= 0) Arcade.audio.sfx('win'); }

    // pickups and oil
    for (const it of items) {
      if (it.gone > 0) continue;
      const d = Math.hypot(it.x - k.x, it.y - k.y);
      if (k.s.magnet && d < 6 && d > 0.5) { it.x += ((k.x - it.x) / d) * 10 * dt; it.y += ((k.y - it.y) / d) * 10 * dt; }
      if (d < 1.4) {
        if (it.type === 'boost') { if (!k.s.rocket) continue; k.boosts = Math.min(2, k.boosts + 1); }
        it.gone = 6;
        if (k.human >= 0) Arcade.audio.sfx('coin', { vol: 0.15 });
      }
    }
    if (k.hop <= 0) for (const o of oils) if (Math.hypot(o.x - k.x, o.y - k.y) < 1.6 && k.spin <= 0) { k.spin = k.s.armor ? 0.25 : 0.7; k.vx *= 0.6; k.vy *= 0.6; if (k.human >= 0) Arcade.audio.sfx('hit', { vol: 0.2 }); }
  }

  function bump() {
    for (let i = 0; i < karts.length; i++) for (let j = i + 1; j < karts.length; j++) {
      const a = karts[i], b = karts[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 1.6 || d === 0 || a.hop > 0 || b.hop > 0) continue;
      const push = (1.6 - d) / 2, nx = dx / d, ny = dy / d;
      const ma = a.s.mass + a.s.armor * 3, mb = b.s.mass + b.s.armor * 3, wa = mb / (ma + mb), wb = ma / (ma + mb);
      a.x -= nx * push * 2 * wa; a.y -= ny * push * 2 * wa; b.x += nx * push * 2 * wb; b.y += ny * push * 2 * wb;
    }
  }

  function update(dt) {
    input.poll();
    time += dt;
    if (state !== 'racing' || ui.visible) return;
    for (const it of items) it.gone = Math.max(0, it.gone - dt);
    for (const k of karts) drive(k, dt);
    bump();
    const humansDone = karts.filter((k) => k.human >= 0).every((k) => k.done);
    if (humansDone) { endT += dt; if (endT > 2) finishRace(); }
  }

  function finishRace() {
    state = 'results';
    // anyone still racing is placed by how far they got
    const order = [...finishOrder, ...karts.filter((k) => !k.done).sort((a, b) => b.prog - a.prog)];
    order.forEach((k, i) => { table[k.name] = (table[k.name] || 0) + POINTS[i]; });
    const lastRace = round === 2;
    const standings = Object.entries(table).sort((a, b) => b[1] - a[1]);
    if (lastRace) {
      const best = standings.findIndex(([n]) => n === 'Red' || n === 'Blue');
      if (best === 0) save.set('cups', Math.max(save.get('cups', 0), cup + 1));
    }
    ui.results({
      heading: lastRace ? (['Red', 'Blue'].includes(standings[0][0]) ? standings[0][0] + ' wins the cup!' : 'Cup over') : track.name + ' finished',
      rows: order.slice(0, 6).map((k, i) => [(i + 1) + '. ' + k.name + (k.human >= 0 ? ' (you)' : ''), lastRace ? table[k.name] + ' pts' : '+' + POINTS[i]]),
      note: lastRace ? 'Cup points: ' + standings.map(([n, p]) => n + ' ' + p).join(' · ') : 'Race ' + (round + 1) + ' of 3. You can rebuild before the next one.',
      buttons: lastRace ? [{ label: 'Back to the garage', onClick: garage }] : [{ label: 'Next race', onClick() { round++; startRace(); } }, { label: 'Rebuild first', onClick() { round++; garage(true); } }],
    });
  }

  // ---------- the garage (HTML) ----------
  const style = document.createElement('style');
  style.textContent = `
    .kg { position: fixed; inset: 0; z-index: 60; overflow: auto; background: #2b2d42; color: #edf2f4; font-family: ${BODY}; padding: 56px 14px 20px; }
    .kg[hidden] { display: none; }
    .kg h2 { font: 2rem ${DISPLAY}; margin: 0 0 4px; color: #ffd166; }
    .kg-wrap { max-width: 920px; margin: 0 auto; }
    .kg-row { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); margin-top: 14px; }
    .kg-card { background: #3d405b; border: 3px solid #ffd166; padding: 12px; }
    .kg-kart { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; max-width: 220px; margin: 8px auto; padding: 14px 10px; border-radius: 40px 40px 14px 14px; background: #1b1c2b; }
    .kg-slot { height: 54px; border: 2px dashed #a9aec4; background: #2b2d42; color: #fff; font: 800 .85rem ${BODY}; cursor: pointer; }
    .kg-slot.full { border-style: solid; }
    .kg-slot:focus-visible, .kg-part:focus-visible, .kg button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
    .kg-parts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .kg-part { padding: 6px 4px; background: #2b2d42; border: 2px solid #3d405b; color: #edf2f4; font: 600 .8rem ${BODY}; cursor: pointer; }
    .kg-part[aria-pressed="true"] { border-color: #ffd166; background: #474a6b; }
    .kg-part i { display: block; height: 6px; margin-bottom: 4px; }
    .kg-bar { display: grid; grid-template-columns: 90px 1fr 38px; gap: 8px; align-items: center; font-size: .85rem; margin: 5px 0; }
    .kg-bar span:nth-child(2) { height: 10px; background: #2b2d42; position: relative; }
    .kg-bar span:nth-child(2) b { position: absolute; inset: 0 auto 0 0; background: #ffd166; }
    .kg-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .kg-tags span { font-size: .75rem; font-weight: 800; padding: 3px 8px; background: #06d6a0; color: #10302a; }
    .kg-tags span.off { background: #474a6b; color: #a9aec4; }
    .kg-go { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 10px; }
    .kg-go button { font: 1.2rem ${DISPLAY}; padding: 12px 18px; border: 3px solid #ffd166; background: #ffd166; color: #2b2d42; cursor: pointer; }
    .kg-go button.alt { background: transparent; color: #ffd166; }`;
  document.head.appendChild(style);
  const kg = document.createElement('div');
  kg.className = 'kg'; kg.hidden = true;
  document.body.appendChild(kg);
  let editing = 0, chosenPart = 'engine', midCup = false;

  function garage(continuing) {
    midCup = continuing === true;
    state = 'garage'; ui.hide(); kg.hidden = false; paintGarage();
  }
  function paintGarage() {
    const b = builds[editing], s = stats(b);
    const bar = (label, v, max) => `<div class="kg-bar"><span>${label}</span><span><b style="width:${Math.max(4, Math.min(100, (v / max) * 100))}%"></b></span><span>${v.toFixed(1)}</span></div>`;
    const pullText = Math.abs(s.pull) < 1 ? 'Balanced' : 'Pulls ' + (s.pull > 0 ? 'left' : 'right');
    kg.innerHTML = `<div class="kg-wrap"><h2>Garage</h2><p style="margin:0;color:#a9aec4">Pick a part, then click a slot on the kart. ${humans === 2 ? 'Two players: build both karts.' : ''}</p>
      ${humans === 2 ? `<div class="kg-go" style="margin-top:8px">${[0, 1].map((i) => `<button type="button" class="${i === editing ? '' : 'alt'}" data-edit="${i}">${HUMANS[i].name} kart</button>`).join('')}</div>` : ''}
      <div class="kg-row">
        <div class="kg-card"><strong style="color:${HUMANS[editing].color}">${HUMANS[editing].name} kart</strong>
          <div class="kg-kart">${b.map((id, i) => `<button type="button" class="kg-slot ${id !== 'empty' ? 'full' : ''}" data-slot="${i}" style="${id !== 'empty' ? `background:${PARTS[id].color};color:#111` : ''}" aria-label="${SLOT_NAMES[i]}: ${PARTS[id].name}">${PARTS[id].short || '+'}</button>`).join('')}</div>
          <p style="text-align:center;margin:0;color:#a9aec4;font-size:.85rem">front ↑</p></div>
        <div class="kg-card"><strong>Parts</strong><div class="kg-parts" style="margin-top:8px">${PALETTE.map((id) => `<button type="button" class="kg-part" data-part="${id}" aria-pressed="${id === chosenPart}"><i style="background:${PARTS[id].color === 'transparent' ? '#474a6b' : PARTS[id].color}"></i>${PARTS[id].name}</button>`).join('')}</div></div>
        <div class="kg-card"><strong>How it drives</strong>
          ${bar('Top speed', s.topSpeed, 26)}${bar('Pick-up', s.accel, 14)}${bar('Grip', s.grip * 10, 11.5)}${bar('Weight', s.mass, 26)}
          <div class="kg-tags"><span class="${s.rocket ? '' : 'off'}">Boosts</span><span class="${s.spring ? '' : 'off'}">Hop</span><span class="${s.magnet ? '' : 'off'}">Magnet</span><span class="${s.armor ? '' : 'off'}">Armour</span><span class="${Math.abs(s.pull) < 1 ? '' : 'off'}">${pullText}</span></div></div>
      </div>
      <div class="kg-go">${midCup ? `<button type="button" data-go="next">Next race: ${TRACKS[cup * 3 + round].name}</button>` : [0, 1].map((c) => `<button type="button" data-cup="${c}" ${c > save.get('cups', 0) ? 'disabled style="opacity:.4"' : ''}>${c ? 'Cog Cup' : 'Nut Cup'}${c > save.get('cups', 0) ? ' (win the Nut Cup first)' : ''}</button>`).join('')}
        <button type="button" class="alt" data-go="reset">Reset kart</button></div></div>`;
  }
  kg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    Arcade.audio.sfx('blip');
    if (b.dataset.edit) editing = +b.dataset.edit;
    if (b.dataset.part) chosenPart = b.dataset.part;
    if (b.dataset.slot) { builds[editing][+b.dataset.slot] = chosenPart; save.set('build' + editing, builds[editing]); }
    if (b.dataset.go === 'reset') { builds[editing] = [...DEFAULT]; save.set('build' + editing, builds[editing]); }
    if (b.dataset.cup && !b.disabled) { cup = +b.dataset.cup; round = 0; table = {}; kg.hidden = true; return startRace(); }
    if (b.dataset.go === 'next') { kg.hidden = true; return startRace(); }
    paintGarage();
  });

  // ---------- drawing ----------
  function render() {
    ctx.fillStyle = '#3a5a40'; ctx.fillRect(0, 0, W, H);
    if (state !== 'racing' && state !== 'results') return;
    const u = Math.min((W - 20) / 100, (H - 70) / 60), ox = (W - 100 * u) / 2, oy = 60 + (H - 70 - 60 * u) / 2;
    V = { u, ox, oy };
    const X = (v) => ox + v * u, Y = (v) => oy + v * u;
    // grass stripes, kerbs, road
    ctx.fillStyle = '#588157'; for (let k = 0; k < 100; k += 8) ctx.fillRect(X(k), Y(0), 4 * u, 60 * u);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const line = (w, color, dash) => { ctx.strokeStyle = color; ctx.lineWidth = w * u; ctx.setLineDash(dash || []); ctx.beginPath(); path.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]); };
    line(HALF * 2 + 1.2, '#edf2f4', [u * 1.4, u * 1.4]);
    line(HALF * 2 + 1.2, '#ef233c', [0, u * 1.4, u * 1.4, 0]);
    line(HALF * 2, '#4a4e69');
    line(0.25, 'rgba(255,255,255,.35)', [u, u * 1.5]);
    // start line, chequered
    const [sx, sy] = path[0], [tx, ty] = path[1], ang = Math.atan2(ty - sy, tx - sx);
    ctx.save(); ctx.translate(X(sx), Y(sy)); ctx.rotate(ang + Math.PI / 2);
    for (let k = -4; k < 4; k++) for (let r = 0; r < 2; r++) { ctx.fillStyle = (k + r) % 2 ? '#111' : '#fff'; ctx.fillRect(k * u, r * u * 0.5 - u * 0.5, u, u * 0.5); }
    ctx.restore();
    for (const o of oils) { ctx.fillStyle = 'rgba(10,10,20,.75)'; ctx.beginPath(); ctx.ellipse(X(o.x), Y(o.y), u * 1.3, u * 0.9, 0.4, 0, 6.3); ctx.fill(); }
    for (const it of items) if (it.gone <= 0) {
      ctx.fillStyle = it.type === 'boost' ? '#ff7b00' : '#ffd166';
      ctx.save(); ctx.translate(X(it.x), Y(it.y)); ctx.rotate(time * 2);
      if (it.type === 'boost') ctx.fillRect(-u * 0.6, -u * 0.6, u * 1.2, u * 1.2); else { ctx.beginPath(); for (let k = 0; k < 6; k++) ctx.lineTo(Math.cos(k * 1.047) * u * 0.6, Math.sin(k * 1.047) * u * 0.6); ctx.fill(); }
      ctx.restore();
    }
    for (const k of karts) {
      ctx.save(); ctx.translate(X(k.x), Y(k.y) - (k.hop > 0 ? Math.sin((k.hop / 0.55) * Math.PI) * u * 1.2 : 0)); ctx.rotate(k.a);
      if (k.hop > 0) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, u * 1.2, u * 1.1, u * 0.6, 0, 0, 6.3); ctx.fill(); }
      ctx.fillStyle = '#111'; ctx.fillRect(-u * 0.9, -u * 0.75, u * 0.5, u * 1.5); ctx.fillRect(u * 0.4, -u * 0.75, u * 0.5, u * 1.5);
      ctx.fillStyle = k.color; ctx.beginPath(); ctx.roundRect(-u * 1, -u * 0.55, u * 2, u * 1.1, u * 0.3); ctx.fill();
      // its parts, as coloured studs in their slots
      k.build.forEach((id, i) => { if (id === 'empty') return; ctx.fillStyle = PARTS[id].color; ctx.fillRect(u * (0.45 - Math.floor(i / 2) * 0.6), u * (i % 2 ? 0.08 : -0.38), u * 0.4, u * 0.3); });
      if (k.boostT > 0) { ctx.fillStyle = '#ffb703'; ctx.beginPath(); ctx.moveTo(-u, -u * 0.3); ctx.lineTo(-u * (1.6 + Math.random() * 0.5), 0); ctx.lineTo(-u, u * 0.3); ctx.fill(); }
      ctx.restore();
    }
    // HUD: lap, place and boosts for each human, in a pit-board style strip
    const order = [...karts].sort((a, b) => (b.done - a.done) || (a.done && b.done ? a.time - b.time : b.prog - a.prog));
    karts.filter((k) => k.human >= 0).forEach((k, i) => {
      const x = i ? W - 232 : 12;
      ctx.fillStyle = '#2b2d42'; ctx.fillRect(x, 8, 220, 46); ctx.fillStyle = k.color; ctx.fillRect(x, 8, 8, 46);
      ctx.fillStyle = '#ffd166'; ctx.textAlign = 'left'; ctx.font = `24px ${DISPLAY}`;
      ctx.fillText((order.indexOf(k) + 1) + '/' + karts.length, x + 16, 40);
      ctx.fillStyle = '#edf2f4'; ctx.font = `800 13px ${BODY}`;
      ctx.fillText('LAP ' + Math.max(1, Math.min(LAPS, k.lap + 1)) + '/' + LAPS, x + 80, 28);
      ctx.fillText(k.s.rocket ? 'BOOST ' + '▶'.repeat(k.boosts) + '·'.repeat(2 - k.boosts) : 'NO ROCKET', x + 80, 46);
    });
    ctx.textAlign = 'center'; ctx.fillStyle = '#edf2f4'; ctx.font = `16px ${DISPLAY}`; ctx.fillText(track.name.toUpperCase(), W / 2, 30);
    if (time < startT) { ctx.font = `${Math.round(u * 8)}px ${DISPLAY}`; ctx.fillStyle = '#ffd166'; ctx.fillText(String(Math.ceil(startT - time)), W / 2, H / 2); }
    else if (time < startT + 0.8) { ctx.font = `${Math.round(u * 8)}px ${DISPLAY}`; ctx.fillStyle = '#06d6a0'; ctx.fillText('GO!', W / 2, H / 2); }
  }

  ui.onPause(() => { if (state === 'racing') ui.pause({ onResume() { ui.hide(); input.flush(); }, onRestart: startRace }); });
  ui.title({ note: 'Two players share the keyboard; the whole track fits on one screen.', buttons: [{ label: '1 player', onClick() { humans = 1; editing = 0; garage(); } }, { label: '2 players', onClick() { humans = 2; editing = 0; garage(); } }] });
  Arcade.loop({ update, render }).start();
})();
