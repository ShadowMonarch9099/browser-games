// Borrowed Boots sound: everything is synthesized with WebAudio. The effect
// set is a toy box (slide whistles, wood blocks, a music box, a kazoo); the
// music is a small generative band (music box, pizzicato bass, marimba,
// flute) that adds a voice for whichever creature's trick you are borrowing.
BB.Audio = {
  ctx: null,
  muted: false,
  sfxVol: 0.8,
  musicVol: 0.6,

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    // a gentle compressor keeps stacked toy sounds from clipping
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.connect(this.master);
    // a little room for the music: a feedback delay as a cheap reverb
    const dl = ctx.createDelay(1);
    dl.delayTime.value = 0.23;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    this.music.connect(dl);
    dl.connect(lp);
    lp.connect(fb);
    fb.connect(dl);
    lp.connect(wet);
    wet.connect(this.master);
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.apply();
  },

  apply() {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.sfx.gain.value = this.sfxVol;
    this.music.gain.value = this.musicVol * 0.55;
  },

  setVolumes(sfx, music) {
    this.sfxVol = sfx / 10;
    this.musicVol = music / 10;
    this.apply();
  },

  // One oscillator voice with an envelope. opts: type, vol, at, attack, slide, bus, detune, vib
  osc(freq, dur, o = {}) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = o.at != null ? o.at : ctx.currentTime + (o.delay || 0);
    const v = ctx.createOscillator();
    const g = ctx.createGain();
    v.type = o.type || 'sine';
    v.frequency.setValueAtTime(freq, t);
    if (o.slide) v.frequency.exponentialRampToValueAtTime(o.slide, t + (o.slideT || dur));
    if (o.detune) v.detune.value = o.detune;
    if (o.vib) {
      const l = ctx.createOscillator();
      const lg = ctx.createGain();
      l.frequency.value = o.vib;
      lg.gain.value = freq * 0.012;
      l.connect(lg);
      lg.connect(v.frequency);
      l.start(t);
      l.stop(t + dur + 0.1);
    }
    const a = o.attack || 0.005;
    const vol = o.vol || 0.1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = g;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      g.connect(f);
      out = f;
    }
    v.connect(g);
    out.connect(o.bus || this.sfx);
    v.start(t);
    v.stop(t + dur + 0.05);
  },

  noise(dur, o = {}) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = o.at != null ? o.at : ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.bus || this.sfx);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  },

  // music-box tine: sine plus a bright, quickly fading overtone
  tine(f, at, vol, bus) {
    this.osc(f, 1.1, { type: 'sine', vol, at, bus });
    this.osc(f * 4.02, 0.25, { type: 'sine', vol: vol * 0.35, at, bus });
  },

  play(name, arg) {
    if (!this.ctx) return;
    const N = this.ctx.currentTime;
    switch (name) {
      case 'jump':
        this.osc(330, 0.16, { type: 'triangle', vol: 0.11, slide: 720 });
        break;
      case 'spring':
        // a boing: wobbling pitch on a triangle
        this.osc(180, 0.42, { type: 'triangle', vol: 0.16, slide: 760, vib: 18 });
        this.osc(90, 0.25, { type: 'sine', vol: 0.12, slide: 300 });
        break;
      case 'land':
        this.noise(0.09, { filter: 'lowpass', freq: 500, vol: 0.1 + Math.min(0.2, (arg || 0) / 100) });
        this.osc(120, 0.08, { type: 'sine', vol: 0.08, slide: 70 });
        break;
      case 'step':
        this.noise(0.03, { filter: 'bandpass', freq: 2200 + Math.random() * 800, q: 3, vol: 0.025 });
        break;
      case 'bonk':
        this.osc(520, 0.07, { type: 'square', vol: 0.05, slide: 260, lp: 1800 });
        break;
      case 'borrow': {
        // a rising music-box run in the creature's key
        const base = { b: 523, g: 587, o: 659, t: 392 }[arg] || 523;
        [0, 4, 7, 12, 16].forEach((s, i) => this.tine(base * Math.pow(2, s / 12), N + i * 0.055, 0.09));
        this.noise(0.35, { filter: 'highpass', freq: 5000, vol: 0.05 });
        break;
      }
      case 'drop':
        // the trick falls off: a sad kazoo slide
        this.osc(520, 0.35, { type: 'sawtooth', vol: 0.06, slide: 200, lp: 1400, vib: 9 });
        break;
      case 'oops':
        [392, 330, 262].forEach((f, i) => this.osc(f, 0.18, { type: 'square', vol: 0.05, at: N + i * 0.11, lp: 1500 }));
        this.osc(140, 0.3, { type: 'sine', vol: 0.1, slide: 60, at: N + 0.3 });
        break;
      case 'star':
        this.tine(1318, N, 0.1);
        this.tine(1760, N + 0.07, 0.09);
        this.tine(2637, N + 0.14, 0.05);
        break;
      case 'check':
        [784, 988, 1175, 1568].forEach((f, i) => this.osc(f, 0.5, { type: 'triangle', vol: 0.07, at: N + i * 0.08 }));
        break;
      case 'smash':
        this.noise(0.5, { filter: 'lowpass', freq: 900, sweep: 120, vol: 0.4 });
        this.osc(90, 0.35, { type: 'sine', vol: 0.25, slide: 40 });
        for (let i = 0; i < 5; i++) this.noise(0.05, { filter: 'bandpass', freq: 1500 + i * 400, q: 4, vol: 0.1, delay: 0.08 + i * 0.05 });
        break;
      case 'climb':
        this.noise(0.04, { filter: 'bandpass', freq: 3200, q: 6, vol: 0.05 });
        break;
      case 'glide':
        this.noise(0.5, { filter: 'bandpass', freq: 700, sweep: 1400, q: 0.8, vol: 0.06, attack: 0.15 });
        break;
      case 'back':
        this.osc(880, 0.1, { type: 'sine', vol: 0.05, slide: 1320 });
        break;
      case 'win': {
        const seq = [523, 659, 784, 1046, 784, 1046, 1318];
        seq.forEach((f, i) => this.tine(f, N + i * 0.1, 0.1));
        this.osc(262, 0.8, { type: 'triangle', vol: 0.1, at: N + 0.6 });
        this.osc(392, 0.8, { type: 'triangle', vol: 0.08, at: N + 0.6 });
        break;
      }
      case 'starPop':
        this.tine(1046 * Math.pow(2, (arg || 0) * 4 / 12), N, 0.12);
        this.noise(0.2, { filter: 'highpass', freq: 6000, vol: 0.05 });
        break;
      case 'page':
        this.noise(0.22, { filter: 'bandpass', freq: 1800, sweep: 4000, q: 0.7, vol: 0.08, attack: 0.03 });
        break;
      case 'move':
        // wood block
        this.osc(1100, 0.04, { type: 'sine', vol: 0.06 });
        this.osc(1650, 0.025, { type: 'square', vol: 0.012, lp: 3000 });
        break;
      case 'click':
        this.osc(660, 0.09, { type: 'triangle', vol: 0.08 });
        this.osc(990, 0.09, { type: 'triangle', vol: 0.05, delay: 0.04 });
        break;
      case 'denied':
        this.osc(200, 0.12, { type: 'square', vol: 0.04, lp: 900 });
        this.osc(150, 0.14, { type: 'square', vol: 0.04, lp: 900, delay: 0.08 });
        break;
      case 'walk':
        this.osc(440 + Math.random() * 60, 0.05, { type: 'triangle', vol: 0.03 });
        break;
    }
  },

  // ---------- music ----------
  // Each style is a key, a scale, a tempo, a feel and an instrument set.
  STYLES: {
    title: { bpm: 84, root: 349.23, scale: [0, 2, 4, 5, 7, 9, 11], beats: 3, lead: 'box', bass: 'pizz', perc: 0, prog: [0, 3, 4, 0, 5, 3, 4, 4] },
    map: { bpm: 100, root: 392.0, scale: [0, 2, 4, 5, 7, 9, 11], beats: 4, lead: 'marimba', bass: 'pizz', perc: 1, prog: [0, 4, 5, 3] },
    meadow: { bpm: 112, root: 392.0, scale: [0, 2, 4, 5, 7, 9, 11], beats: 4, lead: 'box', bass: 'pizz', perc: 1, prog: [0, 3, 4, 0, 0, 5, 3, 4] },
    woods: { bpm: 96, root: 293.66, scale: [0, 2, 3, 5, 7, 9, 10], beats: 4, lead: 'marimba', bass: 'pizz', perc: 2, prog: [0, 6, 3, 4] },
    peaks: { bpm: 104, root: 329.63, scale: [0, 2, 4, 6, 7, 9, 11], beats: 4, lead: 'flute', bass: 'pizz', perc: 2, prog: [0, 1, 4, 0, 5, 1, 4, 4] },
    end: { bpm: 76, root: 349.23, scale: [0, 2, 4, 5, 7, 9, 11], beats: 3, lead: 'box', bass: 'pizz', perc: 0, prog: [0, 5, 3, 4] },
  },
  song: null,
  songKey: null,
  layer: null, // the borrowed power adds a voice: 'b' | 'g' | 'o' | 't'
  nextT: 0,
  stepN: 0,

  setSong(style, seed = 0) {
    const key = style + ':' + seed;
    if (key === this.songKey) return;
    this.songKey = key;
    const st = this.STYLES[style];
    const r = BB.U.rng(seed * 7919 + style.length * 131);
    // a phrase of 2 bars x beats x 2 eighths, built from the scale
    const len = st.beats * 4;
    const motif = [];
    let deg = 2;
    for (let i = 0; i < len; i++) {
      if (i % 2 === 0 || r() < 0.35) {
        deg = Math.max(0, Math.min(9, deg + Math.floor(r() * 5) - 2));
        motif.push(r() < 0.82 ? deg : null);
      } else motif.push(null);
    }
    this.song = { st, motif, r, fade: 0 };
    this.stepN = 0;
  },

  freq(st, deg, oct = 0) {
    const n = st.scale.length;
    const d = ((deg % n) + n) % n;
    return st.root * Math.pow(2, oct + Math.floor(deg / n) + st.scale[d] / 12);
  },

  voice(kind, f, at, len, vol) {
    const bus = this.music;
    if (kind === 'box') this.tine(f, at, vol * 0.8, bus);
    else if (kind === 'marimba') {
      this.osc(f, 0.45, { type: 'sine', vol, at, bus });
      this.osc(f * 3.98, 0.08, { type: 'sine', vol: vol * 0.25, at, bus });
    } else if (kind === 'flute') this.osc(f, len * 1.1, { type: 'sine', vol: vol * 0.7, at, bus, attack: 0.06, vib: 5.5 });
    else if (kind === 'pizz') this.osc(f, 0.32, { type: 'triangle', vol, at, bus, lp: 900 });
  },

  update() {
    const ctx = this.ctx;
    if (!ctx || !this.song || this.muted || this.musicVol <= 0) {
      if (ctx) this.nextT = ctx.currentTime + 0.1;
      return;
    }
    const { st, motif } = this.song;
    const bus = this.music;
    const e = 30 / st.bpm; // one eighth note
    if (this.nextT < ctx.currentTime) this.nextT = ctx.currentTime + 0.05;
    while (this.nextT < ctx.currentTime + 0.2) {
      const t = this.nextT;
      const i = this.stepN;
      const perBar = st.beats * 2;
      const bar = Math.floor(i / perBar);
      const pos = i % perBar;
      const chord = st.prog[bar % st.prog.length];
      // bass: root on the one, fifth on the others (oom-pah in 3/4)
      if (pos === 0) this.voice(st.bass, this.freq(st, chord, -2), t, e * 2, 0.14);
      else if (pos % 2 === 0) this.voice(st.bass, this.freq(st, chord + (st.beats === 3 ? 2 : 4), -1), t, e, 0.07);
      // soft chord on the downbeat
      if (pos === 0) for (const d of [0, 2, 4]) this.osc(this.freq(st, chord + d, -1), e * perBar * 0.9, { type: 'sine', vol: 0.016, at: t, bus, attack: 0.15 });
      // melody, answered an octave up every other phrase
      const m = motif[i % motif.length];
      if (m !== null && m !== undefined) this.voice(st.lead, this.freq(st, chord + m, Math.floor(i / motif.length) % 4 === 3 ? 1 : 0), t, e * 2, st.lead === 'box' ? 0.07 : 0.08);
      // light percussion: shaker and a wood block
      if (st.perc >= 1 && pos % 2 === 1) this.noise(0.03, { filter: 'highpass', freq: 7000, vol: 0.018, at: t, bus });
      if (st.perc >= 2 && pos === st.beats) this.osc(900, 0.04, { type: 'sine', vol: 0.03, at: t, bus });
      // the borrowed trick's voice
      const L = this.layer;
      if (L === 'b' && pos % 2 === 1) this.osc(this.freq(st, chord, 0), 0.14, { type: 'triangle', vol: 0.035, at: t, bus, slide: this.freq(st, chord, 1), slideT: 0.06 });
      if (L === 'g') this.noise(0.02, { filter: 'bandpass', freq: pos % 2 ? 2600 : 1800, q: 5, vol: 0.03, at: t, bus });
      if (L === 'o' && pos === 0) this.osc(this.freq(st, chord + 4, 1), e * perBar, { type: 'sine', vol: 0.03, at: t, bus, attack: 0.3, vib: 4 });
      if (L === 't' && pos % 2 === 0) this.osc(this.freq(st, chord, -2), e * 1.6, { type: 'sawtooth', vol: 0.03, at: t, bus, lp: 400 });
      this.stepN++;
      this.nextT += e;
    }
  },
};
