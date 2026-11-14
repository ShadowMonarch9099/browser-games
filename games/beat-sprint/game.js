// Beat Sprint: a song is generated from a seed, and the obstacles are made
// from the same notes. Jump on the low notes, slide on the high ones. Timing
// is judged against the audio clock, not the screen, so it stays fair even
// when frames drop. Miss three in a row and the music fades out.
(function () {
  const canvas = document.getElementById('game');
  let W = 0, H = 0;
  const ctx = Arcade.fitCanvas(canvas, (w, h) => { W = w; H = h; });
  const input = Arcade.input.create({ target: canvas, tapIsA: false });
  const save = Arcade.save('beat-sprint');

  const DISPLAY = '"Monoton", "Impact", sans-serif';
  const BODY = '"Outfit", "Segoe UI", sans-serif';
  const ui = Arcade.ui.create({
    title: 'Beat Sprint',
    tagline: 'Run to the beat. The beat is the level.',
    how: [['Space / ↑ / tap top', 'Jump: the pink blocks'], ['↓ / tap bottom', 'Slide: the cyan bars'], ['Three misses in a row', 'and the music fades'], ['Sound', 'On! The game is the song']],
    // Beat Sprint's own look: a synthwave night. Deep purple, hot pink, cyan glow.
    theme: {
      fonts: 'family=Monoton&family=Outfit:wght@500;700',
      display: DISPLAY, body: BODY,
      overlay: 'rgba(20, 0, 46, .82)',
      panel: '#22004d', panel2: '#2f0a63', edge: '#ff2e88',
      text: '#fbe9ff', muted: '#c9a3e6',
      accent: '#00f0ff', accentInk: '#14002e',
      radius: '12px', border: '2px',
      shadow: '0 0 0 1px #00f0ff, 0 0 40px rgba(255, 46, 136, .5)', buttonShadow: '0 0 18px rgba(0, 240, 255, .35)',
      caps: 'uppercase', titleSize: 'clamp(2rem, 9vw, 2.8rem)',
    },
  });

  const STYLES = [
    { name: 'Neon Drive', bpm: 112, scale: [0, 3, 5, 7, 10], root: 45, wave: 'sawtooth' },
    { name: 'Arcade Bounce', bpm: 128, scale: [0, 2, 4, 7, 9], root: 48, wave: 'square' },
    { name: 'Midnight Run', bpm: 100, scale: [0, 2, 3, 7, 8], root: 43, wave: 'triangle' },
    { name: 'Turbo Funk', bpm: 118, scale: [0, 3, 5, 6, 7, 10], root: 41, wave: 'square' },
    { name: 'Sky Rush', bpm: 136, scale: [0, 2, 4, 5, 7, 9, 11], root: 50, wave: 'sawtooth' },
  ];
  const LENGTH = 90, LEAD = 2.0, WINDOW = 0.13, PERFECT = 0.05;

  let state = 'menu', song, actx, out, startAt, notes, cursor, nextSched, score, combo, best, misses, missRow, judged, flash, mode, time = 0;
  let offset = save.get('offset', 0);   // seconds; from the calibration screen

  // ---------- the song ----------
  function compose(seed, style) {
    const rand = Arcade.rng(seed);
    const beat = 60 / style.bpm, bars = Math.floor(LENGTH / (beat * 4));
    const drums = [], bass = [], lead = [], obstacles = [];
    for (let bar = 0; bar < bars; bar++) {
      const intro = bar < 2, busy = Math.min(1, 0.35 + bar / bars);
      for (let s = 0; s < 8; s++) {                  // eighth notes
        const t = 1.5 + (bar * 8 + s) * beat / 2;
        if (s % 4 === 0) drums.push({ t, k: 'kick' });
        if (s % 4 === 2) drums.push({ t, k: 'snare' });
        drums.push({ t, k: 'hat' });
        if (s % 2 === 0) bass.push({ t, n: style.root + (s === 4 && bar % 2 ? 5 : 0), d: beat * 0.9 });
        if (!intro && rand() < 0.28 * busy + (s % 2 === 0 ? 0.12 : 0)) {
          const deg = rand.int(0, style.scale.length - 1), oct = rand() < 0.5 ? 12 : 24;
          lead.push({ t, n: style.root + oct + style.scale[deg], d: beat * 0.45, high: deg >= style.scale.length / 2 });
        }
      }
    }
    // Obstacles come from the lead notes, with at least half a beat between them.
    let last = -9;
    for (const n of lead) if (n.t - last >= beat * 0.75) { obstacles.push({ t: n.t, kind: n.high ? 'slide' : 'jump', res: null }); last = n.t; }
    return { style, beat, drums, bass, lead, obstacles, end: 1.5 + bars * beat * 4 + 1 };
  }

  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function voice(t, freq, dur, type, vol, slide) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  let noiseBuf;
  function noise(t, dur, vol, hp) {
    if (!noiseBuf) { noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.3, actx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + dur);
  }
  // Schedule notes a little ahead of the audio clock, a slice at a time.
  function schedule() {
    const until = actx.currentTime + 0.25;
    while (cursor < notes.length && startAt + notes[cursor].t < until) {
      const n = notes[cursor++], t = startAt + n.t;
      if (n.k === 'kick') voice(t, 150, 0.18, 'sine', 0.9, 45);
      else if (n.k === 'snare') noise(t, 0.14, 0.45, 1200);
      else if (n.k === 'hat') noise(t, 0.04, 0.12, 7000);
      else if (n.bass) voice(t, hz(n.n), n.d, 'triangle', 0.35);
      else voice(t, hz(n.n), n.d, song.style.wave, 0.12);
    }
  }

  function begin(seed, label) {
    actx = Arcade.audio.context;
    if (!actx) { ui.toast('Tap again to start the sound', 1500); return; }
    const style = STYLES[seed % STYLES.length];
    song = compose(seed, style);
    mode = label;
    notes = [...song.drums, ...song.bass.map((b) => ({ ...b, bass: true })), ...song.lead].sort((a, b) => a.t - b.t);
    out = actx.createGain(); out.gain.value = Arcade.audio.muted ? 0 : 0.6; out.connect(actx.destination);
    startAt = actx.currentTime + 0.2; cursor = 0;
    score = 0; combo = 0; best = 0; misses = 0; missRow = 0; judged = 0; flash = null;
    ui.hide(); input.flush(); state = 'playing';
  }
  const songTime = () => actx.currentTime - startAt - offset;

  function judge(kind) {
    const now = songTime();
    const o = song.obstacles.find((x) => !x.res && Math.abs(x.t - now) < WINDOW);
    if (!o) return;
    if (o.kind !== kind) { o.res = 'miss'; return miss(o); }
    const err = Math.abs(o.t - now);
    o.res = err < PERFECT ? 'perfect' : 'good';
    combo++; best = Math.max(best, combo); missRow = 0; judged++;
    score += (o.res === 'perfect' ? 100 : 60) * (1 + Math.floor(combo / 10));
    flash = { text: o.res === 'perfect' ? 'PERFECT' : 'GOOD', t: 0 };
  }
  function miss(o) {
    combo = 0; misses++; missRow++; judged++;
    flash = { text: 'MISS', t: 0 };
    if (missRow >= 3) fail();
  }
  function fail() {
    state = 'over';
    out.gain.setTargetAtTime(0, actx.currentTime, 0.4);
    setTimeout(() => results(false), 1300);
  }
  function results(cleared) {
    if (ui.visible) return;
    const hits = song.obstacles.filter((o) => o.res === 'perfect' || o.res === 'good').length;
    const pct = Math.round((hits / song.obstacles.length) * 100);
    const key = mode === 'daily' ? 'daily:' + Arcade.rng.today() : 'best';
    const top = Math.max(score, save.get(key, 0)); save.set(key, top);
    ui.results({
      heading: cleared ? 'Track complete' : 'The music stopped',
      rows: [['Track', song.style.name], ['Score', score], ['Hits', pct + '%'], ['Best combo', best], [mode === 'daily' ? "Today's best" : 'Best', top]],
      buttons: [{ label: 'New track', onClick: () => begin(Arcade.rng.hash(String(Math.random())), 'free') }, { label: 'Daily track', onClick: () => begin(Arcade.rng.hash('beat-sprint:' + Arcade.rng.today()), 'daily') }, { label: 'Calibrate timing', onClick: calibrate }],
    });
  }

  // Tap along to clicks; the average lateness becomes the offset.
  let cal = null;
  function calibrate() {
    actx = Arcade.audio.context;
    if (!actx) return;
    out = actx.createGain(); out.gain.value = 0.6; out.connect(actx.destination);
    cal = { start: actx.currentTime + 0.5, taps: [], beat: 0.5 };
    for (let i = 0; i < 12; i++) voice(cal.start + i * cal.beat, 1000, 0.05, 'square', 0.3);
    ui.hide(); input.flush(); state = 'calibrate';
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (state === 'calibrate') return calTap();
    if (state === 'playing') judge(e.offsetY < H / 2 ? 'jump' : 'slide');
  });
  function calTap() {
    const now = actx.currentTime - cal.start, k = Math.round(now / cal.beat);
    if (k >= 2 && k < 12) cal.taps.push(now - k * cal.beat);
    if (cal.taps.length >= 8) {
      const sorted = [...cal.taps].sort((a, b) => a - b), mid = sorted[Math.floor(sorted.length / 2)];
      offset = Math.max(-0.2, Math.min(0.3, mid)); save.set('offset', offset);
      state = 'menu';
      ui.results({ heading: 'Timing set', rows: [['Your delay', Math.round(offset * 1000) + ' ms']], buttons: [{ label: 'Back', onClick: menu }] });
    }
  }

  function update(dt) {
    input.poll();
    time += dt;
    if (flash) flash.t += dt;
    if (state === 'calibrate') { if (input.solo.pressed('a') || input.solo.pressed('up')) calTap(); return; }
    if (state !== 'playing' || ui.visible) return;
    out.gain.value = Arcade.audio.muted ? 0 : 0.6;
    schedule();
    const p = input.solo;
    if (p.pressed('a') || p.pressed('up')) judge('jump');
    if (p.pressed('down') || p.pressed('b')) judge('slide');
    const now = songTime();
    for (const o of song.obstacles) if (!o.res && now - o.t > WINDOW) { o.res = 'miss'; miss(o); if (state !== 'playing') return; }
    if (now > song.end) { state = 'over'; setTimeout(() => results(true), 400); }
  }

  // ---------- drawing ----------
  function render() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#14002e'); g.addColorStop(0.55, '#3d0a5c'); g.addColorStop(1, '#14002e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const horizon = H * 0.55;
    // sun with stripes
    const beatPulse = state === 'playing' ? Math.max(0, 1 - ((songTime() % song.beat) / song.beat) * 3) : 0;
    ctx.save(); ctx.beginPath(); ctx.arc(W / 2, horizon, Math.min(W, H) * (0.22 + beatPulse * 0.01), Math.PI, 0); ctx.clip();
    const sun = ctx.createLinearGradient(0, horizon - H * 0.25, 0, horizon); sun.addColorStop(0, '#ffd319'); sun.addColorStop(1, '#ff2e88');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, horizon);
    ctx.fillStyle = '#3d0a5c'; for (let k = 0; k < 6; k++) ctx.fillRect(0, horizon - 10 - k * 14, W, 3 + k);
    ctx.restore();
    // grid floor scrolling toward you
    ctx.strokeStyle = 'rgba(0, 240, 255, .5)'; ctx.lineWidth = 1.5;
    const off = state === 'playing' ? (songTime() * 2) % 1 : (time * 2) % 1;
    for (let i = 0; i < 14; i++) { const k = (i + off) / 14, y = horizon + Math.pow(k, 2.2) * (H - horizon); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 20, horizon); ctx.lineTo(W / 2 + i * W * 0.18, H); ctx.stroke(); }
    if (state === 'calibrate') {
      ctx.fillStyle = '#fbe9ff'; ctx.textAlign = 'center'; ctx.font = `700 26px ${BODY}`;
      ctx.fillText('Tap or press Space on every click', W / 2, H * 0.3);
      ctx.font = `500 18px ${BODY}`; ctx.fillText((cal ? cal.taps.length : 0) + ' / 8 taps', W / 2, H * 0.3 + 34);
      return;
    }
    if (state === 'menu' || !song) return;

    // the lane: obstacles slide in from the right and meet the runner on their beat
    const now = songTime(), runX = W * 0.22, ground = H * 0.78, speed = (W * 0.78) / LEAD;
    ctx.strokeStyle = '#fbe9ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(runX, ground - 140); ctx.lineTo(runX, ground + 10); ctx.stroke();
    for (const o of song.obstacles) {
      const x = runX + (o.t - now) * speed;
      if (x < -60 || x > W + 60) continue;
      ctx.globalAlpha = o.res === 'miss' ? 0.3 : o.res ? 0.15 : 1;
      ctx.shadowBlur = 16;
      if (o.kind === 'jump') { ctx.shadowColor = ctx.fillStyle = '#ff2e88'; ctx.fillRect(x - 16, ground - 38, 32, 38); }
      else { ctx.shadowColor = ctx.fillStyle = '#00f0ff'; ctx.fillRect(x - 26, ground - 112, 52, 18); ctx.fillRect(x - 2, ground - 160, 4, 48); }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
    // the runner reacts to the most recent judged obstacle
    const recent = song.obstacles.filter((o) => o.res && o.res !== 'miss' && now - o.t < 0.32 && now - o.t > -0.1).pop();
    const air = recent && recent.kind === 'jump' ? Math.sin(Math.min(1, (now - recent.t + 0.1) / 0.42) * Math.PI) * 70 : 0;
    const low = recent && recent.kind === 'slide';
    ctx.fillStyle = '#fbe9ff'; ctx.shadowColor = '#ff2e88'; ctx.shadowBlur = 20;
    if (low) ctx.fillRect(runX - 22, ground - 22, 44, 22);
    else { ctx.fillRect(runX - 12, ground - 58 - air, 24, 44); ctx.beginPath(); ctx.arc(runX, ground - 68 - air, 11, 0, 6.3); ctx.fill(); }
    ctx.shadowBlur = 0;

    // HUD: neon readout
    ctx.textAlign = 'left'; ctx.fillStyle = '#00f0ff'; ctx.font = `28px ${DISPLAY}`; ctx.fillText(String(score), 18, 46);
    ctx.font = `700 15px ${BODY}`; ctx.fillStyle = '#c9a3e6'; ctx.fillText(song.style.name.toUpperCase() + (mode === 'daily' ? ' · DAILY' : ''), 18, 70);
    if (combo > 1) { ctx.fillStyle = '#ffd319'; ctx.fillText('COMBO ×' + combo, 18, 92); }
    const prog = Math.min(1, now / song.end);
    ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(18, H - 18, W - 36, 4); ctx.fillStyle = '#ff2e88'; ctx.fillRect(18, H - 18, (W - 36) * prog, 4);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i < missRow ? '#ff2e88' : 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(W - 120 - i * 18, 32, 6, 0, 6.3); ctx.fill(); }
    if (flash && flash.t < 0.5) {
      ctx.globalAlpha = 1 - flash.t * 2; ctx.textAlign = 'center'; ctx.font = `30px ${DISPLAY}`;
      ctx.fillStyle = flash.text === 'MISS' ? '#ff2e88' : flash.text === 'PERFECT' ? '#ffd319' : '#00f0ff';
      ctx.fillText(flash.text, runX + 60, ground - 190 - flash.t * 40); ctx.globalAlpha = 1;
    }
  }

  ui.onPause(() => {
    if (state !== 'playing') return;
    actx.suspend();
    ui.pause({ onResume() { ui.hide(); input.flush(); actx.resume(); }, onRestart() { actx.resume(); out.gain.value = 0; begin(Arcade.rng.hash(String(Math.random())), 'free'); } });
  });
  function menu() {
    state = 'menu';
    ui.title({
      note: 'Timing offset: ' + Math.round(offset * 1000) + ' ms. Calibrate if hits feel late or early.',
      buttons: [{ label: 'Play a new track', onClick: () => begin(Arcade.rng.hash(String(Math.random())), 'free') }, { label: 'Daily track', onClick: () => begin(Arcade.rng.hash('beat-sprint:' + Arcade.rng.today()), 'daily') }, { label: 'Calibrate timing', onClick: calibrate }],
    });
  }
  menu();
  Arcade.loop({ update, render }).start();
})();
