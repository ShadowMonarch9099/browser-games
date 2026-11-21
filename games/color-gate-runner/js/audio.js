// Procedural audio: all music and SFX are synthesized with WebAudio. No files.
const Audio = (() => {
  let ac, master, musicBus, sfxBus, muted = false;
  let world = null, layer = 0, step = 0, nextTime = 0, timer = null, playing = false;
  const m2f = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = muted ? 0 : .85; master.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = .45;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6;
    musicBus.connect(comp).connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = .8; sfxBus.connect(master);
  }
  function resume() { init(); if (ac.state === 'suspended') ac.resume(); }
  function tone({ f, f2, d, type = 'sine', g = .1, t, dest, a = .005, detune = 0 }) {
    t = t ?? ac.currentTime; dest = dest ?? sfxBus;
    const o = ac.createOscillator(), v = ac.createGain();
    o.type = type; o.detune.value = detune; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + a); v.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(v).connect(dest); o.start(t); o.stop(t + d + .05);
  }
  let noiseBuf;
  function noise(d, g, t, dest, hp = 6000) {
    t = t ?? ac.currentTime; dest = dest ?? sfxBus;
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
    const s = ac.createBufferSource(); s.buffer = noiseBuf; const v = ac.createGain(); const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.0001, t + d);
    s.connect(f).connect(v).connect(dest); s.start(t); s.stop(t + d + .02);
  }

  const sfx = {
    move()      { resume(); tone({ f: 380, f2: 540, d: .06, type: 'triangle', g: .05 }); },
    switch(i)   { resume(); const f = 520 + i * 140; tone({ f, f2: f * 1.5, d: .14, type: 'triangle', g: .12 }); tone({ f: f * 2, d: .08, type: 'sine', g: .04, t: ac.currentTime + .03 }); },
    deny()      { resume(); tone({ f: 160, f2: 90, d: .12, type: 'square', g: .06 }); },
    pass(combo) { resume(); const t = ac.currentTime, k = Math.pow(1.059, Math.min(combo, 12)); tone({ f: 660 * k, d: .18, g: .12, t }); tone({ f: 990 * k, d: .26, g: .06, t: t + .05 }); noise(.08, .07, t); },
    hit()       { resume(); const t = ac.currentTime; tone({ f: 150, f2: 40, d: .35, type: 'sawtooth', g: .25, t }); noise(.22, .25, t, sfxBus, 1200); },
    speedup()   { resume(); const t = ac.currentTime; for (let i = 0; i < 4; i++) tone({ f: 300 * Math.pow(1.26, i), d: .18, type: 'square', g: .06, t: t + i * .07 }); },
    warp()      { resume(); const t = ac.currentTime; tone({ f: 120, f2: 1800, d: 1.1, type: 'sawtooth', g: .12, t }); noise(1.0, .12, t, sfxBus, 2000); },
    over()      { resume(); const t = ac.currentTime; [0, 1, 2, 3].forEach(i => tone({ f: 440 * Math.pow(.84, i), d: .5, type: 'triangle', g: .12, t: t + i * .22 })); },
    coin(v)     { resume(); const t = ac.currentTime; tone({ f: v === 3 ? 1320 : 990, d: .09, type: 'sine', g: v === 3 ? .09 : .05, t }); if (v === 3) tone({ f: 1760, d: .12, type: 'sine', g: .05, t: t + .05 }); },
    ui()        { resume(); tone({ f: 900, d: .05, type: 'sine', g: .05 }); },
    milestone() { resume(); const t = ac.currentTime; [0, 4, 7, 12].forEach((s, i) => tone({ f: m2f(72 + s), d: .4, type: 'triangle', g: .08, t: t + i * .08 })); },
  };

  // ---- music sequencer (16th-note steps, 64-step loop) ----
  const BASS = [0,0,7,0, 0,0,5,7, 0,0,7,0, 3,3,5,7];          // scale degrees-ish (indexes into scale, mod)
  const ARP  = [0,2,4,6, 2,4,6,4];
  const KICK = [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0];
  const SNARE= [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0];
  function playStep(s, t) {
    const spb = 60 / world.bpm / 4, sc = world.scale, root = world.root;
    const deg = i => root + sc[((i % sc.length) + sc.length) % sc.length] + 12 * Math.floor(i / sc.length);
    if (KICK[s % 16]) tone({ f: 160, f2: 42, d: .22, type: 'sine', g: .6, t, dest: musicBus, a: .002 });
    if (SNARE[s % 16] && layer >= 1) noise(.12, .18, t, musicBus, 1800);
    if (s % 2 === 1) noise(.03, layer >= 3 ? .08 : .05, t, musicBus);
    const b = BASS[s % 16]; if (b !== null) tone({ f: m2f(deg(b)), d: spb * .85, type: world.bassWave, g: .16, t, dest: musicBus, a: .01 });
    if (layer >= 1 && s % 2 === 0) tone({ f: m2f(deg(ARP[Math.floor(s / 2) % 8] + 7)), d: spb * 1.6, type: world.arpWave, g: .07, t, dest: musicBus });
    if (layer >= 2 && s % 16 === 0) { const ch = s % 32 === 0 ? [0, 2, 4] : [3, 5, 7]; ch.forEach(i => tone({ f: m2f(deg(i) + 12), d: spb * 15, type: 'sine', g: .05, t, dest: musicBus, a: .3, detune: (i - 2) * 6 })); }
    if (layer >= 3 && s % 4 === 2) tone({ f: m2f(deg(ARP[Math.floor(s / 4) % 8] + 14)), d: spb * .9, type: 'square', g: .04, t, dest: musicBus });
  }
  function tick() {
    if (!playing) return;
    const spb = 60 / world.bpm / 4;
    while (nextTime < ac.currentTime + .18) { playStep(step, nextTime); nextTime += spb; step = (step + 1) % 64; }
  }
  const music = {
    start(w) { resume(); world = w; playing = true; step = 0; nextTime = ac.currentTime + .05; if (!timer) timer = setInterval(tick, 60); },
    setWorld(w) { world = w; step = 0; },
    setLayer(n) { layer = clamp(n, 0, 3); },
    stop() { playing = false; },
    pause() { playing = false; }, resumeMusic() { if (world) { playing = true; nextTime = ac.currentTime + .05; } },
  };
  function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : .85; return muted; }
  function setMuted(m) { muted = m; if (master) master.gain.value = muted ? 0 : .85; }
  return { init, resume, sfx, music, toggleMute, setMuted, get muted() { return muted; } };
})();

// Generated beat (assets/music/neon_theme.m4a) as the background track. Tempo nudges up with each speed step.
const Music = (() => {
  const el = new window.Audio('assets/music/neon_theme.m4a'); el.loop = true; el.volume = .55; el.preservesPitch = true;
  let muted = false;
  return {
    start() { el.currentTime = 0; el.playbackRate = 1; el.muted = muted; el.play().catch(() => {}); },
    setStep(n) { el.playbackRate = Math.min(1.25, 1 + n * .03); },
    pause() { el.pause(); }, resume() { el.play().catch(() => {}); }, stop() { el.pause(); },
    setMuted(m) { muted = m; el.muted = m; },
  };
})();
