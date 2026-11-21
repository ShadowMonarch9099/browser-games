// Core game. Rules from the brief are enforced here exactly:
// 3 colors, 1 s switch cooldown, no switching inside a gate, speed rises every 20 s, wrong color costs a life, 3 lives never regained.
const Game = (() => {
  const LH = 900;                       // fixed logical playfield height: every screen gets the same reaction time
  let cv, ctx, W = 0, H = LH, k = 1, dpr = 1, fx, S, state = 'title', last = 0, uid = 0, settings = { muted: false };
  const world = () => WORLDS[S.worldIdx % WORLDS.length];
  const geo = () => { const tw = Math.min(W * .62, 480), tx = (W - tw) / 2; return { tw, tx, lw: tw / 3, py: H * .74 }; };
  const col = i => SLOTS[i].color;
  const DEMO = location.search.includes('demo');
  const seen = {};
  function emit(type, once = true) { if (!DEMO || window.parent === window) return; if (once && seen[type]) return; seen[type] = 1; window.parent.postMessage({ cgr: type, t: S ? S.time : 0, world: S ? world().name : '' }, '*'); }

  function newRun() {
    S = { time: 0, speedClock: 0, scroll: 0, lane: 1, x: 1, lean: 0, color: 0, lastSwitch: -9, manualSwitch: false,
      inGate: null, jammed: false, lives: CFG.LIVES, score: 0, combo: 0, bestCombo: 0, clutches: 0,
      speed: CFG.SPEED0, speedStep: 0, nextSpeed: CFG.SPEED_EVERY, worldIdx: 0, worldsVisited: 1,
      nextPortal: 30, portalPending: false, worldHits: 0, worldGates: 0,
      gates: [], obs: [], rows: [], genY: -140, buffer: null, deny: 0, denyMsg: '', warpT: 0, deadT: 0,
      milestone: 1000, switchAnim: 0, hitAnim: 0, tag: null, coins: [], shards: 0, spent: 0, shieldOn: false, shieldBuys: 0, headUsed: false, dashT: 0 };
    fx = new FX(); uid = 0;
    addRow(S.genY, [{ lane: 0, span: 3, c: 0 }], 'full');   // first gate always matches the starting color
  }
  function addRow(y, gs, kind) {
    const row = { id: uid++, y, kind, touched: false, done: false, full: gs.some(g => g.span === 3) };
    for (const g of gs) S.gates.push(Object.assign({ y, done: false, wrong: false, row: row.id }, g));
    S.rows.push(row); S.genY = y; return row;
  }

  // ---------- prism shards (currency) ----------
  // A short trail in one lane, sometimes weaving, placed in the clear gap between two gates.
  function coinsInGap(fromY, toY) {
    if (Math.random() < .3) return;
    const n = 5, c = rndi(3), weave = Math.random() < .35, l0 = rndi(3), top = toY + 40, bot = fromY - CFG.GATE_H - 40;
    if (bot - top < 120) return;
    for (let i = 0; i < n; i++) { const y = bot - (bot - top) * i / (n - 1); const lane = weave ? clamp(l0 + (i % 3) - 1, 0, 2) : l0; S.coins.push({ y, lane, c, got: false }); }
  }
  // ---------- fair pattern generator ----------
  // Every gap between two rows that may need different colors is at least 1.35 s at the speed the row
  // will be met at, so one switch per gap is always possible. Jammer zones add their own length on top.
  function spawn() {
    const lvl = S.worldIdx + Math.floor(S.speedStep / 2), sp = S.speed * CFG.SPEED_STEP;
    const safe = sp * 1.35 + 70, rnd3 = rndi(3), r = Math.random(), t = S.time;
    if (S.time >= S.nextPortal) { const y = S.genY - safe - CFG.GATE_H; S.gates.push({ y, lane: 0, span: 3, c: -1, portal: true, done: false, row: -1 }); S.genY = y; S.portalPending = true; return; }
    let y = S.genY - safe - CFG.GATE_H;
    const forcePad = DEMO && !D.padForced && t > 12;
    if ((t > 8 && r < .16) || forcePad) {                       // SPLASH PAD at the start of the gap, one lane: recolors you
      const lastC = (S.gates.filter(x => !x.portal).slice(-1)[0] || { c: 0 }).c;
      const pl = rndi(3), pc = forcePad ? (lastC + 1) % 3 : rndi(3); if (forcePad) D.padForced = 1;
      S.obs.push({ type: 'pad', y: S.genY - CFG.GATE_H - 70, h: 46, lane: pl, span: 1, c: pc, used: false, forced: forcePad });
      addRow(y, [{ lane: 0, span: 3, c: forcePad || Math.random() < .5 ? pc : rndi(3) }], 'full'); return;
    }
    if (t > 14 && r < .32) {                                  // JAMMER zone right before a full gate: no switching inside it
      const jl = Math.min(260, sp * .45); y -= jl;
      const lanes = { lane: 0, span: 3 };
      S.obs.push(Object.assign({ type: 'jam', y: y + CFG.GATE_H + 6, h: jl - 12 }, lanes));
      addRow(y, [{ lane: 0, span: 3, c: rnd3 }], 'full'); return;
    }
    // every gate is one full-width, single-color gate: match it or lose a life
    coinsInGap(S.genY, y); addRow(y, [{ lane: 0, span: 3, c: rnd3 }], 'full');
  }

  // ---------- demo autopilot (showcase only, ?demo) ----------
  let D = {};
  function demoReset() { D = { lastMove: -9, shield: 0, head: 0, failSet: 0, failUntil: -1, headAt: 1e9 }; Wallet.set(Math.max(Wallet.get(), 120)); }
  function demoTick() {
    const g = geo(), py = g.py, pTop = py - 24;
    const ahead = S.gates.filter(x => !x.done && !x.portal && x.y + CFG.GATE_H < pTop).sort((a, b) => b.y - a.y)[0];
    const need = ahead ? ahead.c : S.color, failing = D.failUntil > S.time, target = failing ? (need + 1) % 3 : need;
    const tt = ahead ? (pTop - (ahead.y + CFG.GATE_H)) / S.speed : 9;
    const jamAhead = ahead && S.obs.some(o => o.type === 'jam' && o.y > ahead.y && o.y < pTop);
    const clutch = S.time > 11 && S.time < 19 && !jamAhead;                       // show the clutch bonus in world 1
    const fpad = S.obs.find(o => o.type === 'pad' && o.forced && !o.used && o.y < py);
    let want = target !== S.color; if (want && clutch && tt > .28) want = false; if (fpad && fpad.c === need) want = false;   // let the splash pad do the recolor
    if (want && !S.inGate && !S.jammed && S.time - S.lastSwitch >= CFG.COOLDOWN) trySwitch(target);
    if (S.jammed && Math.random() < .03) trySwitch((S.color + 1) % 3);           // poke the jammer once to show the block
    if (!D.pokedCd && S.time > 3 && S.time - S.lastSwitch > .1 && S.time - S.lastSwitch < .5) { D.pokedCd = 1; trySwitch((S.color + 1) % 3); S.buffer = null; }   // show the cooldown refusal
    if (!D.pokedLock && S.time > 5 && S.inGate && S.time - S.lastSwitch > 1.2) { D.pokedLock = 1; trySwitch((S.color + 1) % 3); S.buffer = null; }        // show the gate lock refusal
    let lane = S.lane;
    const coin = S.coins.filter(o => !o.got && o.y < py && o.y > py - 420).sort((a, b) => b.y - a.y)[0]; if (coin) lane = coin.lane;
    const pad = S.obs.find(o => o.type === 'pad' && !o.used && o.y < py && o.y > py - 520);
    if (pad) { if (pad.c === need && !failing) lane = pad.lane; else if (lane === pad.lane) lane = (pad.lane + 1) % 3; }
    if (lane !== S.lane && S.time - D.lastMove > .16) { move(Math.sign(lane - S.lane)); D.lastMove = S.time; }
    if (!D.shield && S.time > 8) { buy('shield'); D.shield = 1; }
    if (S.worldsVisited >= 2 && D.headAt > 1e8) D.headAt = S.time + 5;
    if (!D.head && S.time > D.headAt && !S.inGate) { buy('head'); D.head = 1; }
    if (S.worldsVisited >= 3 && !D.failSet && S.time > D.failAt) { D.failSet = 1; D.failUntil = S.time + 999; emit('failStart'); }
    if (S.worldsVisited >= 3 && !D.failAt) D.failAt = S.time + 6;
  }
  function demoAfterRun() {
    setTimeout(() => { const n = document.getElementById('name'); if (n) n.value = 'DEMO'; const b = document.getElementById('save'); if (b && b.offsetParent) b.click(); emit('saved', false); }, 2200);
    setTimeout(() => { UI.showLeaderboard(); emit('leaderboard', false); }, 4600);
    setTimeout(() => { for (const kk in seen) delete seen[kk]; start(); }, 9000);
  }

  // ---------- shop ----------
  const funds = () => Wallet.get() + S.shards - S.spent;
  function shopState() {
    const head = S.headUsed ? 'USED' : S.dashT > 0 ? 'ACTIVE' : funds() < CFG.HEADSTART_COST ? 'NEED' : 'OK';
    const shield = S.shieldOn ? 'ACTIVE' : S.shieldBuys >= CFG.SHIELD_MAX_PER_RUN ? 'LIMIT' : funds() < CFG.SHIELD_COST ? 'NEED' : 'OK';
    return { head, shield };
  }
  function buy(item) {
    if (state !== 'playing' || S.warpT > 0) return;
    const st = shopState()[item];
    if (st !== 'OK') { deny(item === 'head' ? ({ USED: 'HEADSTART: ONCE PER RUN', ACTIVE: 'DASHING', NEED: 'NOT ENOUGH SHARDS' })[st] : ({ ACTIVE: 'SHIELD ALREADY ON', LIMIT: 'SHIELD LIMIT: 2 PER RUN', NEED: 'NOT ENOUGH SHARDS' })[st]); return; }
    if (item === 'head') { if (S.inGate) { deny('LOCKED · IN GATE'); return; } S.spent += CFG.HEADSTART_COST; S.headUsed = true; S.dashT = CFG.HEADSTART_SECS; S.gates = []; S.portalPending = false; S.obs = []; S.rows = []; S.inGate = null; S.jammed = false; fx.showBanner('HEADSTART · JETPACK DASH', '#ffffff', 1.4); emit('headstart'); Audio.sfx.warp(); }
    else { S.spent += CFG.SHIELD_COST; S.shieldBuys++; S.shieldOn = true; fx.showBanner('SHIELD ON', '#bfe6ff', 1.2); emit('shield'); }
    Audio.sfx.milestone();
  }
  function shopPos() { const bw = 150, bh = 46, x = W - bw - 16, y0 = (W < 760 ? 150 : 200); return { head: [x, y0, bw, bh], shield: [x, y0 + bh + 10, bw, bh] }; }
  function shopHit(px, py) { const p = shopPos(); for (const kk of ['head', 'shield']) { const [x, y, w, h] = p[kk]; if (px >= x && px <= x + w && py >= y && py <= y + h) return kk; } return null; }

  // ---------- input ----------
  function move(d) { if (state !== 'playing' || S.warpT > 0) return; const nl = clamp(S.lane + d, 0, 2); if (nl !== S.lane) { S.lane = nl; S.lean = d; Audio.sfx.move(); } }
  function trySwitch(i) {
    if (state !== 'playing') return;
    if (i === S.color) { S.buffer = null; return; }                       // same color press cancels a buffered switch
    const left = CFG.COOLDOWN - (S.time - S.lastSwitch);
    if (S.inGate) { if (left <= CFG.BUFFER) S.buffer = i; deny('LOCKED · IN GATE'); emit('lock'); return; }   // rule: locked while passing through a gate
    if (S.jammed) { deny('JAMMED · ' + world().hazard.toUpperCase()); emit('jamDeny'); return; }
    if (left > 0) { if (left <= CFG.BUFFER) { S.buffer = i; S.bufferAt = S.time; } else { deny('COOLDOWN'); emit('cooldown'); } return; } // rule: 1 s cooldown
    doSwitch(i, true);
  }
  function deny(msg) { S.deny = .3; S.denyMsg = msg; Audio.sfx.deny(); }
  function doSwitch(i, manual) { if (manual) emit('switch'); S.color = i; S.lastSwitch = S.time; S.manualSwitch = manual; S.buffer = null; S.switchAnim = 1; const g = geo(); fx.ring(g.tx + g.lw * (S.x + .5), g.py, col(i)); Audio.sfx.switch(i); }
  function onKey(e) {
    const kk = e.key.toLowerCase();
    if (state === 'playing') {
      if (kk === 'arrowleft') move(-1); else if (kk === 'arrowright') move(1);
      else if (kk === 'a' || kk === '1') trySwitch(0); else if (kk === 's' || kk === '2') trySwitch(1); else if (kk === 'd' || kk === '3') trySwitch(2);
      else if (kk === 'q') buy('head'); else if (kk === 'e') buy('shield');
      else if (kk === 'escape' || kk === 'p') pause();
      if (['arrowleft', 'arrowright', ' '].includes(kk)) e.preventDefault();
    } else if (state === 'paused') { if (kk === 'escape' || kk === 'p' || kk === ' ' || kk === 'enter') resume(); }
    if (kk === 'm') { UI.setMute(toggleMute()); }
  }
  let px0 = null;
  const lx = e => e.clientX / k, ly = e => e.clientY / k;
  function onPointerDown(e) { if (state !== 'playing') return; Audio.resume(); const sh = shopHit(lx(e), ly(e)); if (sh) { buy(sh); px0 = null; return; } const b = chipHit(lx(e), ly(e)); if (b >= 0) { trySwitch(b); px0 = null; } else px0 = lx(e); }
  function onPointerUp(e) { if (px0 === null) return; const dx = lx(e) - px0; if (Math.abs(dx) > 24) move(dx > 0 ? 1 : -1); px0 = null; }
  function chipPos() { const s = 92, gap = 18, x0 = W / 2 - (s * 3 + gap * 2) / 2; return [0, 1, 2].map(i => [x0 + i * (s + gap) + s / 2, H - 70]); }
  function chipHit(x, y) { const p = chipPos(); for (let i = 0; i < 3; i++) if (Math.abs(x - p[i][0]) < 50 && Math.abs(y - p[i][1]) < 50) return i; return -1; }
  let padPrev = {};
  function pollGamepad() {
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null; if (!gp || state !== 'playing') return;
    const b = i => gp.buttons[i] && gp.buttons[i].pressed, ax = gp.axes[0] || 0;
    const now = { l: b(14) || ax < -.5, r: b(15) || ax > .5, c0: b(2), c1: b(3), c2: b(1), p: b(9) };
    if (now.l && !padPrev.l) move(-1); if (now.r && !padPrev.r) move(1);
    if (now.c0 && !padPrev.c0) trySwitch(0); if (now.c1 && !padPrev.c1) trySwitch(1); if (now.c2 && !padPrev.c2) trySwitch(2);
    if (now.p && !padPrev.p) pause(); padPrev = now;
  }

  // ---------- update ----------
  function update(dt) {
    if (state === 'dying') { S.deadT += dt; stepWorld(dt * .2, true); if (S.deadT > .9) { state = 'gameover'; emit('gameover', false); if (DEMO) demoAfterRun(); Music.stop(); Audio.sfx.over(); Wallet.set(Wallet.get() + S.shards - S.spent); UI.showGameOver({ score: S.score, world: world().name, worlds: S.worldsVisited, combo: S.bestCombo, time: S.time, shards: S.shards, spent: S.spent, wallet: Wallet.get() }); } return; }
    if (state !== 'playing') return;
    if (fx.hitstop > 0) { fx.hitstop -= dt; return; }
    if (S.warpT > 0) { warpStep(dt); return; }
    if (S.dashT > 0) { dashStep(dt); return; }
    S.time += dt; S.speedClock += dt;
    if (DEMO) demoTick();
    // buffered switch fires the moment it becomes legal, and expires shortly after
    if (S.buffer !== null) { const ok = !S.inGate && !S.jammed && S.time - S.lastSwitch >= CFG.COOLDOWN; if (ok) doSwitch(S.buffer, true); else if (S.time - S.lastSwitch > CFG.COOLDOWN + .25) S.buffer = null; }
    stepWorld(dt, false);
    if (S.speedClock >= S.nextSpeed) { S.nextSpeed += CFG.SPEED_EVERY; S.speed *= CFG.SPEED_STEP; S.speedStep++; fx.showBanner(`SPEED UP  ×${(S.speed / CFG.SPEED0).toFixed(2)}`, '#ffffff'); Audio.sfx.speedup(); Music.setStep(S.speedStep); emit('speed', false); }
    if (S.score >= S.milestone) { fx.showBanner(`${S.milestone} POINTS`, '#fff', 1.2); Audio.sfx.milestone(); S.milestone += 1000; }
  }
  function stepWorld(dt, dying) {
    const g = geo();
    S.x += (S.lane - S.x) * (1 - Math.exp(-15 * dt)); S.lean *= Math.exp(-6 * dt);
    S.switchAnim = Math.max(0, S.switchAnim - dt * 4); S.hitAnim = Math.max(0, S.hitAnim - dt * 3); S.deny = Math.max(0, S.deny - dt);
    if (S.tag) { S.tag.t -= dt; if (S.tag.t <= 0) S.tag = null; }
    const d = S.speed * dt; S.scroll += d; S.genY += d;
    for (const o of S.gates) o.y += d; for (const o of S.obs) o.y += d; for (const r of S.rows) r.y += d; for (const o of S.coins) o.y += d;
    if (!dying) while (S.genY > -80 && !S.portalPending) spawn();
    S.gates = S.gates.filter(o => o.y < H + 100); S.obs = S.obs.filter(o => o.y < H + 300); S.rows = S.rows.filter(r => r.y < H + 100); S.coins = S.coins.filter(o => o.y < H + 60 && !o.got);
    if (dying) { fx.update(dt); return; }
    const pTop = g.py - 24, pBot = g.py + 22, cx = S.x + .5;
    const covers = o => cx > o.lane + .04 && cx < o.lane + o.span - .04;
    // jammers and splash pads
    S.jammed = false;
    for (const o of S.obs) {
      if (!(covers(o) && o.y + o.h > pTop && o.y < pBot)) continue;
      if (o.type === 'jam') { S.jammed = true; emit('jam'); }
      else if (o.type === 'pad' && !o.used) { o.used = true; if (S.color !== o.c && S.shieldOn) { S.shieldOn = false; S.tag = { txt: 'SHIELD BLOCKED SPLASH', t: 1, c: '#bfe6ff' }; emit('splashBlocked'); fx.ring(g.tx + g.lw * (S.x + .5), g.py, '#bfe6ff'); } else if (S.color !== o.c) { doSwitch(o.c, false); fx.burst(g.tx + g.lw * (o.lane + .5), o.y + o.h / 2, g.lw, 20, col(o.c), 30); S.tag = { txt: 'SPLASH! RECOLORED', t: 1, c: col(o.c) }; emit('splash'); } }
    }
    for (const o of S.coins) { if (o.got || Math.abs(o.lane + .5 - cx) > .45 || o.y < pTop - 14 || o.y > pBot + 14) continue;
      o.got = true; const v = (o.c === S.color ? 3 : 1) * 1; S.shards += v; emit(v === 3 ? 'coin3' : 'coin'); const ox = g.tx + g.lw * (o.lane + .5);
      fx.sparks(ox, o.y, col(o.c), v === 3 ? 12 : 5); if (v >= 3) fx.pop(ox, o.y - 18, '+' + v, col(o.c)); Audio.sfx.coin(v >= 3 ? 3 : 1); }
    // gates
    let inside = null;
    for (const gt of S.gates) {
      if (!(covers(gt) && gt.y + CFG.GATE_H > pTop && gt.y < pBot)) continue;
      if (!gt.portal) inside = gt;                                    // portals never lock switching
      if (gt.done) continue; gt.done = true;
      const row = S.rows.find(r => r.id === gt.row); if (row) row.touched = true;
      const gx = g.tx + g.lw * (gt.lane + gt.span / 2);
      if (gt.portal) { emit('portal', false); S.score += 50; fx.pop(gx, gt.y, '+50 PORTAL', '#fff', true); startWarp(); continue; }
      if (gt.c === S.color) {
        S.combo++; S.bestCombo = Math.max(S.bestCombo, S.combo); S.worldGates++;
        let pts = CFG.SCORE_PER_GATE * S.combo, label = `+${pts}`;
        if (S.manualSwitch && S.time - S.lastSwitch < CFG.CLUTCH_WINDOW) { pts += CFG.CLUTCH_BONUS; S.clutches++; label = `CLUTCH +${pts}`; S.manualSwitch = false; emit('clutch'); }
        emit('pass'); S.score += pts; fx.burst(gx, gt.y + CFG.GATE_H / 2, g.lw * gt.span, 20, col(gt.c)); fx.pop(gx, gt.y - 10, label + (S.combo > 1 ? `  ×${S.combo}` : ''), '#fff', S.combo >= 5 || label.startsWith('CLUTCH')); Audio.sfx.pass(S.combo);
      } else {
        if (S.shieldOn) { S.shieldOn = false; fx.ring(g.tx + g.lw * (S.x + .5), g.py, '#bfe6ff'); fx.shake = .5;
          if (CFG.SHIELD_SAVES_LIFE) { gt.wrong = true; S.tag = { txt: 'SHIELD ABSORBED HIT', t: 1.1, c: '#bfe6ff' }; Audio.sfx.deny(); continue; }
          S.tag = { txt: 'SHIELD KEPT YOUR COMBO', t: 1.1, c: '#bfe6ff' }; emit('shieldHit'); S.lives--; S.worldHits++; S.hitAnim = 1; gt.wrong = true; fx.hit(); Audio.sfx.hit(); if (S.lives <= 0) { state = 'dying'; S.deadT = 0; } continue; }
        emit('hit', false); S.combo = 0; S.lives--; S.worldHits++; S.hitAnim = 1; gt.wrong = true; fx.hit(); fx.sparks(g.tx + g.lw * (S.x + .5), g.py - 10, '#fff'); Audio.sfx.hit(); try { if (navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(60); } catch (e) {}
        if (S.lives <= 0) { state = 'dying'; S.deadT = 0; }
      }
    }
    S.inGate = inside;
    // a row that passes without being touched counts as a dodge: the combo breaks (dodging is never free)
    for (const r of S.rows) if (!r.done && r.y > pBot + 4) { r.done = true; if (!r.touched && !r.full && S.combo > 0) { S.combo = 0; S.tag = { txt: 'DODGED · COMBO LOST', t: .9, c: '#ffffff' }; emit('dodge'); } }
    fx.update(dt);
  }
  // Headstart dash: the runner flies forward over everything. Nothing is collided with, so no life or color rule applies.
  function dashStep(dt) {
    S.dashT -= dt; S.time += dt; S.speedClock += dt; const d = S.speed * CFG.HEADSTART_BOOST * dt; S.scroll += d;
    S.score += Math.round(CFG.HEADSTART_PTS_PER_SEC * dt * 10) / 10; S.x += (S.lane - S.x) * (1 - Math.exp(-15 * dt));
    for (const o of S.coins) { o.y += d; if (!o.got && o.y > H * .5) { o.got = true; S.shards += 1; Audio.sfx.coin(1); } }   // magnet: shards on the way are collected
    S.coins = S.coins.filter(o => !o.got && o.y < H + 60); S.switchAnim = Math.max(0, S.switchAnim - dt * 4); fx.update(dt);
    if (S.speedClock >= S.nextSpeed) { S.nextSpeed += CFG.SPEED_EVERY; S.speed *= CFG.SPEED_STEP; S.speedStep++; Music.setStep(S.speedStep); }
    if (S.dashT <= 0) { S.dashT = 0; S.score = Math.round(S.score); S.genY = -320; addRow(S.genY, [{ lane: 0, span: 3, c: S.color }], 'full'); S.tag = { txt: 'LANDED', t: .8, c: '#fff' }; }
    if (!S.portalPending && S.time >= S.nextPortal) S.nextPortal = S.time + 4;   // never land straight into a portal
  }
  function startWarp() { S.warpT = 1.3; S.warpSwitched = false; Audio.sfx.warp(); S.gates = S.gates.filter(x => x.portal); S.obs = []; }
  function warpStep(dt) {
    S.warpT -= dt; S.time += dt; S.scroll += S.speed * 3 * dt; fx.update(dt);        // speed clock is frozen during warp
    if (!S.warpSwitched && S.warpT < .65) { S.warpSwitched = true;
      if (S.worldHits === 0 && S.worldGates > 0) { S.score += CFG.PERFECT_WORLD_BONUS; fx.pop(W / 2, H * .5, `PERFECT WORLD +${CFG.PERFECT_WORLD_BONUS}`, '#fff', true); }
      S.worldIdx++; S.worldsVisited++; S.worldHits = 0; S.worldGates = 0; fx.showBanner(`WORLD ${S.worldsVisited} · ${world().name.toUpperCase()}`, world().tint, 2.2); UI.setWorld(world()); emit('world', false);
    }
    if (S.warpT <= 0) { S.warpT = 0; S.gates = []; S.rows = []; S.portalPending = false; S.nextPortal = S.time + (DEMO ? 24 : 40); S.genY = -200; addRow(S.genY, [{ lane: 0, span: 3, c: S.color }], 'full'); }
  }

  // ---------- draw ----------
  function draw(t) {
    const g = geo(), w = world(); ctx.save();
    if (fx.shake > .01) ctx.translate(rnd(-1, 1) * 10 * fx.shake, rnd(-1, 1) * 10 * fx.shake);
    Art.drawPlate(ctx, W, H, w.id, S.scroll, g);
    // subtle lane guides
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 2; ctx.setLineDash([16, 26]); ctx.lineDashOffset = -S.scroll;
    for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(g.tx + g.lw * i, 0); ctx.lineTo(g.tx + g.lw * i, H); ctx.stroke(); } ctx.setLineDash([]);
    for (const o of S.obs) drawObstacle(o, g, w, t);
    if (S.dashT > 0) { const q = Math.min(1, S.dashT / .4, (CFG.HEADSTART_SECS - S.dashT) / .3 + .2); ctx.save(); ctx.globalAlpha = .55 * q; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      for (let i = 0; i < 46; i++) { const x = (i * 137.5) % W, y = ((i * 263 + S.scroll * 1.3) % (H + 300)) - 150; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 90 + (i % 5) * 30); ctx.stroke(); } ctx.restore(); }
    for (const o of S.coins) drawCoin(o, g, t);
    for (const gt of S.gates) drawGate(gt, g, t);
    fx.drawWorld(ctx);
    drawRunner(g, w, t);
    ctx.restore();
    if (S.warpT > 0) { const q = clamp(1 - Math.abs(S.warpT - .65) / .65, 0, 1); ctx.fillStyle = `rgba(255,255,255,${q * .92})`; ctx.fillRect(0, 0, W, H); }
    fx.drawScreen(ctx, W, H);
    if (state === 'dying') { ctx.fillStyle = `rgba(0,0,0,${clamp(S.deadT, 0, .6)})`; ctx.fillRect(0, 0, W, H); }
    drawHUD(g, w, t);
  }
  function drawObstacle(o, g, w, t) {
    const x = g.tx + g.lw * o.lane + 6, wd = g.lw * o.span - 12;
    if (o.type === 'jam') {
      ctx.save(); ctx.globalAlpha = .88; ctx.fillStyle = 'rgba(20,24,32,.55)'; rr(ctx, x, o.y, wd, o.h, 14); ctx.fill();
      ctx.save(); rr(ctx, x, o.y, wd, o.h, 14); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 10;
      for (let i = -o.h; i < wd + o.h; i += 34) { ctx.beginPath(); ctx.moveTo(x + i, o.y + o.h + ((t * 40) % 34)); ctx.lineTo(x + i + o.h, o.y + ((t * 40) % 34)); ctx.stroke(); } ctx.restore();
      ctx.strokeStyle = w.tint; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); rr(ctx, x, o.y, wd, o.h, 14); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; ctx.font = '700 15px "Barlow Condensed",system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⊘  NO SWITCH ZONE  ⊘', x + wd / 2, o.y + o.h / 2); ctx.restore();
    } else if (!o.used) {
      const cx = x + wd / 2, cy = o.y + o.h / 2, c = col(o.c), pulse = 1 + Math.sin(t * 6) * .05;
      ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 24; ctx.fillStyle = hexa(c, .55); ctx.beginPath(); ctx.ellipse(cx, cy, wd * .42 * pulse, o.h * .62 * pulse, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = hexa(c, .9); ctx.beginPath(); ctx.ellipse(cx, cy, wd * .3, o.h * .42, 0, 0, TAU); ctx.fill();
      drawShape(ctx, SLOTS[o.c].shape, cx, cy, 11, '#fff', 3.5);
      ctx.fillStyle = '#fff'; ctx.font = '700 12px "Barlow Condensed",system-ui'; ctx.textAlign = 'center'; ctx.fillText('SPLASH', cx, o.y - 8);
    }
  }
  function drawCoin(o, g, t) {
    const x = g.tx + g.lw * (o.lane + .5), y = o.y + Math.sin(t * 5 + o.y * .02) * 3, c = col(o.c), m = o.c === S.color, r = m ? 20 : 15, sx = Math.abs(Math.cos(t * 3 + o.y * .01));
    ctx.save(); ctx.translate(x, y); ctx.scale(.45 + .55 * sx, 1);
    if (m) { ctx.shadowColor = c; ctx.shadowBlur = 16; }
    ctx.fillStyle = hexa(c, m ? 1 : .7); ctx.beginPath(); ctx.moveTo(0, -r * 1.3); ctx.lineTo(r, 0); ctx.lineTo(0, r * 1.3); ctx.lineTo(-r, 0); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(0, -r * 1.3); ctx.lineTo(r * .5, -r * .2); ctx.lineTo(0, 0); ctx.lineTo(-r * .5, -r * .2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function drawGate(gt, g, t) {
    const x = g.tx + g.lw * gt.lane, wd = g.lw * gt.span, h = CFG.GATE_H;
    if (gt.done && !gt.wrong && !gt.portal) return;
    // steel posts
    ctx.fillStyle = '#0d1117'; rr(ctx, x - 2, gt.y - 6, 12, h + 12, 3); ctx.fill(); rr(ctx, x + wd - 10, gt.y - 6, 12, h + 12, 3); ctx.fill();
    if (gt.portal) {
      const pg = ctx.createLinearGradient(x, 0, x + wd, 0); SLOTS.forEach((s, i) => pg.addColorStop(((i / 3 + t * .25) % 1), s.color));
      ctx.save(); ctx.globalAlpha = .9; ctx.fillStyle = pg; rr(ctx, x + 10, gt.y, wd - 20, h, 6); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#fff'; ctx.font = '800 20px "Barlow Condensed",system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PORTAL · NEXT WORLD', x + wd / 2, gt.y + h / 2); return;
    }
    const c = col(gt.c), gr = ctx.createLinearGradient(0, gt.y, 0, gt.y + h);
    gr.addColorStop(0, hexa(c, .95)); gr.addColorStop(.5, hexa(c, .75)); gr.addColorStop(1, hexa(c, .95));
    ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = gt.wrong ? 34 : 18; ctx.fillStyle = gr; rr(ctx, x + 10, gt.y, wd - 20, h, 6); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.28)'; rr(ctx, x + 14, gt.y + 4, wd - 28, h * .32, 4); ctx.fill();
    ctx.strokeStyle = gt.wrong ? '#fff' : 'rgba(0,0,0,.35)'; ctx.lineWidth = gt.wrong ? 4 : 2; rr(ctx, x + 10, gt.y, wd - 20, h, 6); ctx.stroke();
    const n = gt.span === 3 ? 3 : 1; for (let i = 0; i < n; i++) drawShape(ctx, SLOTS[gt.c].shape, x + wd * (i + .5) / n, gt.y + h / 2, 14, '#fff', 4.5);
  }
  function drawRunner(g, w, t) {
    const lift = S.dashT > 0 ? Math.min(1, (CFG.HEADSTART_SECS - S.dashT) / .3, S.dashT / .3) : 0, px = g.tx + g.lw * (S.x + .5), py = g.py - lift * 40, c = col(S.color), bob = Math.sin(S.time * 14) * 3, sz = 120 + lift * 26;
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(px, py + 38, 34, 10, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const tg = ctx.createLinearGradient(0, py, 0, py + 90); tg.addColorStop(0, hexa(c, .7)); tg.addColorStop(1, hexa(c, 0)); ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(px, py + 50 + lift * 30, 14 + lift * 10, 46 + lift * 70, 0, 0, TAU); ctx.fill(); ctx.restore();
    const sp = Art.sprite(w.id, S.color);
    ctx.save(); ctx.translate(px, py + bob - 10); ctx.rotate(S.lean * .25);
    if (sp && sp.complete && sp.naturalWidth) ctx.drawImage(sp, -sz / 2, -sz / 2, sz, sz); else { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill(); }
    if (S.hitAnim > 0) { ctx.globalAlpha = S.hitAnim * .7; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 44, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (S.shieldOn) { ctx.save(); ctx.strokeStyle = 'rgba(191,230,255,.9)'; ctx.lineWidth = 3; ctx.shadowColor = '#bfe6ff'; ctx.shadowBlur = 18; ctx.beginPath(); ctx.arc(px, py - 6, 66 + Math.sin(t * 4) * 2, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(191,230,255,.08)'; ctx.fill(); ctx.restore(); }
    // cooldown / lock / jam ring
    const cd = clamp((S.time - S.lastSwitch) / CFG.COOLDOWN, 0, 1), blocked = S.inGate || S.jammed;
    if (cd < 1 || blocked) { ctx.strokeStyle = blocked ? 'rgba(255,90,90,.95)' : 'rgba(255,255,255,.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(px, py, 58, -Math.PI / 2, -Math.PI / 2 + TAU * (blocked ? 1 : cd)); ctx.stroke(); }
    const msg = S.deny > 0 ? S.denyMsg : S.inGate ? 'LOCKED · IN GATE' : S.jammed ? 'NO SWITCH ZONE' : S.tag ? S.tag.txt : '';
    if (msg) { ctx.font = '700 15px "Barlow Condensed",system-ui'; const tw = ctx.measureText(msg).width + 20; ctx.fillStyle = 'rgba(8,12,18,.8)'; rr(ctx, px - tw / 2, py - 96, tw, 26, 5); ctx.fill(); ctx.fillStyle = S.deny > 0 || blocked ? '#ffb4b4' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(msg, px, py - 83); }
  }
  function panel(x, y, w, h) { ctx.fillStyle = 'rgba(8,14,22,.68)'; rr(ctx, x, y, w, h, 10); ctx.fill(); ctx.strokeStyle = 'rgba(220,238,255,.2)'; ctx.lineWidth = 1; rr(ctx, x, y, w, h, 10); ctx.stroke(); }
  function drawHUD(g, w, t) {
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const narrow = W < 760;
    // timing tower
    const tw = narrow ? 170 : 230; panel(16, 16, tw, narrow ? 150 : 214);
    ctx.fillStyle = '#9db4c8'; ctx.font = '600 13px "Barlow Condensed",system-ui'; ctx.fillText('SCORE', 32, 40);
    ctx.fillStyle = '#fff'; ctx.font = `700 ${narrow ? 38 : 50}px "Barlow Condensed",system-ui`; ctx.fillText(String(S.score).padStart(6, '0').replace(/(\d{3})(\d{3})/, '$1 $2'), 30, narrow ? 76 : 88);
    ctx.fillStyle = '#9db4c8'; ctx.font = '600 13px "Barlow Condensed",system-ui'; ctx.fillText('COMBO', 32, narrow ? 100 : 120);
    ctx.fillStyle = S.combo > 1 ? '#fff' : '#6f8296'; ctx.font = '700 28px "Barlow Condensed",system-ui'; ctx.fillText('×' + S.combo, 32, narrow ? 128 : 150);
    if (!narrow) { ctx.fillStyle = '#dfeaf5'; ctx.font = '600 14px "Barlow Condensed",system-ui'; ctx.fillText(`WORLD ${S.worldsVisited} · ${w.name.toUpperCase()}`, 32, 178); }
    for (let i = 0; i < CFG.LIVES; i++) { const x = (narrow ? 110 : 40) + i * (narrow ? 20 : 30), y = narrow ? 120 : 204, alive = i < S.lives, r = narrow ? 8 : 11;
      ctx.fillStyle = alive ? '#eef4fa' : 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(x, y - r, r, 0, TAU); ctx.fill();
      ctx.fillStyle = alive ? col(S.color) : 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y - r, r * .72, r * .38, 0, 0, TAU); ctx.fill(); }
    // shards
    { const y0 = narrow ? 176 : 240; panel(16, y0, tw, 40); ctx.save(); ctx.translate(36, y0 + 20); ctx.fillStyle = '#bfe6ff'; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 0); ctx.lineTo(0, 11); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '700 24px "Barlow Condensed",system-ui'; ctx.fillText(String(S.shards), 54, y0 + 29);
      ctx.fillStyle = '#9db4c8'; ctx.font = '600 12px "Barlow Condensed",system-ui'; ctx.textAlign = 'right'; ctx.fillText('SHARDS · MATCH = ×3', 16 + tw - 12, y0 + 26); }
    // speed gauge
    const R = narrow ? 52 : 74, gx = W - R - 22, gy = R + 22;
    ctx.fillStyle = 'rgba(8,14,22,.78)'; ctx.beginPath(); ctx.arc(gx, gy, R, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(200,220,240,.4)'; ctx.lineWidth = 2; ctx.stroke();
    const a0 = Math.PI * .75, span = Math.PI * 1.5, step = ((S.speedClock % CFG.SPEED_EVERY) / CFG.SPEED_EVERY);
    ctx.strokeStyle = '#5aa8ff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(gx, gy, R - 7, a0, a0 + span * step); ctx.stroke();
    S.needle = (S.needle ?? 1) + ((S.speed / CFG.SPEED0) - (S.needle ?? 1)) * .06;
    const na = a0 + span * clamp((S.needle - 1) / 2, 0, 1); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(na) * (R - 16), gy + Math.sin(na) * (R - 16)); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `700 ${narrow ? 18 : 24}px "Barlow Condensed",system-ui`; ctx.fillText('×' + (S.speed / CFG.SPEED0).toFixed(2), gx, gy + R * .45);
    ctx.fillStyle = '#9db4c8'; ctx.font = '600 11px "Barlow Condensed",system-ui'; ctx.fillText(`NEXT ${Math.max(0, Math.ceil(S.nextSpeed - S.speedClock))}s`, gx, gy + R * .72);
    // shop buttons
    { const p = shopPos(), st = shopState(), items = [['head', 'HEADSTART', CFG.HEADSTART_COST, 'Q'], ['shield', 'SHIELD', CFG.SHIELD_COST, 'E']];
      for (const [id, label, cost, key] of items) { const [x, y, w, h] = p[id], ok = st[id] === 'OK', on = st[id] === 'ACTIVE';
        ctx.save(); ctx.globalAlpha = ok || on ? 1 : .45; panel(x, y, w, h); if (on) { ctx.strokeStyle = '#bfe6ff'; ctx.lineWidth = 2; rr(ctx, x, y, w, h, 10); ctx.stroke(); }
        ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '700 17px "Barlow Condensed",system-ui'; ctx.fillText(label, x + 12, y + 20);
        ctx.fillStyle = '#9db4c8'; ctx.font = '600 12px "Barlow Condensed",system-ui';
        const sub = ok ? `◆ ${cost}` : ({ USED: 'USED THIS RUN', NEED: `◆ ${cost} · NEED MORE`, ACTIVE: id === 'head' ? 'DASHING' : 'ACTIVE', LIMIT: 'LIMIT REACHED' })[st[id]];
        ctx.fillText(sub, x + 12, y + 37); ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = '700 14px "Barlow Condensed",system-ui'; ctx.fillText(key, x + w - 12, y + 28); ctx.restore(); }
      ctx.textAlign = 'right'; ctx.fillStyle = '#9db4c8'; ctx.font = '600 12px "Barlow Condensed",system-ui'; ctx.fillText(`FUNDS ◆ ${funds()}`, p.shield[0] + p.shield[2], p.shield[1] + p.shield[3] + 18); }
    // color keys
    const cp = chipPos(), cd = clamp((S.time - S.lastSwitch) / CFG.COOLDOWN, 0, 1), blocked = S.inGate || S.jammed;
    cp.forEach(([x, y], i) => { const act = i === S.color, s = 86, c = col(i), dx = S.deny > 0 && !act ? Math.sin(S.deny * 80) * 4 : 0;
      ctx.save(); ctx.globalAlpha = act ? 1 : (blocked || cd < 1 ? .45 : .75); if (act) { ctx.shadowColor = c; ctx.shadowBlur = 24; }
      const kg = ctx.createLinearGradient(0, y - s / 2, 0, y + s / 2); kg.addColorStop(0, hexa(c, .95)); kg.addColorStop(1, hexa(c, .6)); ctx.fillStyle = kg; rr(ctx, x - s / 2 + dx, y - s / 2, s, s, 14); ctx.fill(); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1; rr(ctx, x - s / 2 + dx, y - s / 2, s, s, 14); ctx.stroke();
      drawShape(ctx, SLOTS[i].shape, x + dx, y + 6, 15, '#fff', 4.5);
      ctx.fillStyle = '#fff'; ctx.font = '700 14px "Barlow Condensed",system-ui'; ctx.textAlign = 'center'; ctx.fillText(KEYS.colors[i], x + dx, y - s / 2 + 18);
      if (act && (cd < 1 || blocked)) { ctx.strokeStyle = blocked ? '#ff6a6a' : '#fff'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(x, y, s * .62, -Math.PI / 2, -Math.PI / 2 + TAU * (blocked ? 1 : cd)); ctx.stroke(); }
    });
  }

  // ---------- lifecycle ----------
  function resize() { dpr = Math.min(devicePixelRatio || 1, 2); k = innerHeight / LH; W = innerWidth / k; H = LH; cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0); }
  const TEST = location.search.includes('nopause');
  function loop(now) { const dt = clamp((now - last) / 1000, 0, .05); last = now; try { pollGamepad(); if (S) { update(dt); draw(now / 1000); } } catch (e) { console.error(e); } if (TEST) setTimeout(() => loop(performance.now()), 16); else requestAnimationFrame(loop); }
  function start() { newRun(); if (DEMO) { demoReset(); S.nextPortal = 22; Music.setMuted(true); } emit('start', false); state = 'playing'; Audio.resume(); Music.start(); Music.setStep(0); UI.hideAll(); UI.setWorld(world()); fx.showBanner(`WORLD 1 · ${world().name.toUpperCase()}`, world().tint, 2); }
  function pause() { if (state !== 'playing') return; state = 'paused'; Music.pause(); UI.showPause(); }
  function resume() { if (state !== 'paused') return; state = 'playing'; Audio.resume(); Music.resume(); UI.hideAll(); last = performance.now(); }
  function toTitle() { state = 'title'; Music.stop(); newRun(); UI.showTitle(); }
  function loadSettings() { try { settings = Object.assign(settings, JSON.parse(localStorage.getItem(CFG.SETTINGS_KEY) || '{}')); } catch (e) {} Audio.setMuted(!!settings.muted); Music.setMuted(!!settings.muted); UI.setMute(!!settings.muted); }
  function saveSettings() { try { localStorage.setItem(CFG.SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} }
  function toggleMute() { settings.muted = Audio.toggleMute(); Music.setMuted(settings.muted); saveSettings(); return settings.muted; }
  function init() {
    cv = document.getElementById('game'); ctx = cv.getContext('2d'); resize(); addEventListener('resize', resize);
    addEventListener('keydown', onKey); cv.addEventListener('pointerdown', onPointerDown); cv.addEventListener('pointerup', onPointerUp);
    if (!TEST) document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    loadSettings(); newRun(); UI.showTitle(); if (DEMO) setTimeout(start, 1800); last = performance.now(); if (TEST) loop(performance.now()); else requestAnimationFrame(loop);
  }
  return { init, start, pause, resume, toTitle, toggleMute, get state() { return state; }, get S() { return S; } };
})();
