// Synthesized sound effects and a small generative soundtrack via WebAudio —
// no audio files needed. Effects and music run through separate gain buses so
// each has its own volume setting.
SCE.Audio = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  muted: false,
  sfxVol: 0.8,
  musicVol: 0.5,
  tension: 0, // 0 calm .. 1 tense; raised by the game when time is low or a guard is suspicious
  mNext: 0,
  mStep: 0,

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.applyVolumes();
  },

  applyVolumes() {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.sfxBus.gain.value = this.sfxVol;
    this.musicBus.gain.value = this.musicVol * 0.6;
  },

  setMuted(m) {
    this.muted = m;
    this.applyVolumes();
  },

  // Levels are 0-10 as shown in the settings menu.
  setVolumes(sfx, music) {
    this.sfxVol = sfx / 10;
    this.musicVol = music / 10;
    this.applyVolumes();
  },

  tone(freq, dur, opts = {}) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const { type = 'square', vol = 0.15, slide = null, delay = 0, at = null, bus = this.sfxBus } = opts;
    const t = at !== null ? at : ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  noise(dur, vol = 0.2, delay = 0) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime + delay;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf;
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
  },

  play(name) {
    switch (name) {
      case 'clone':
        this.tone(220, 0.25, { type: 'sawtooth', vol: 0.08, slide: 660 });
        this.tone(440, 0.2, { type: 'sine', vol: 0.12, slide: 880, delay: 0.05 });
        break;
      case 'expire':
        this.tone(500, 0.25, { type: 'sine', vol: 0.1, slide: 150 });
        break;
      case 'denied':
        this.tone(120, 0.08, { vol: 0.08 });
        break;
      case 'plate':
        this.tone(330, 0.06, { vol: 0.08 });
        break;
      case 'lever':
        this.tone(260, 0.05, { vol: 0.1 });
        this.tone(390, 0.05, { vol: 0.1, delay: 0.06 });
        break;
      case 'doorOpen':
        this.tone(180, 0.18, { type: 'triangle', vol: 0.15, slide: 360 });
        break;
      case 'doorClose':
        this.tone(300, 0.15, { type: 'triangle', vol: 0.12, slide: 140 });
        break;
      case 'unlock':
        [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', vol: 0.14, delay: i * 0.07 }));
        break;
      case 'pickup':
        this.tone(880, 0.08, { type: 'sine', vol: 0.15 });
        this.tone(1320, 0.12, { type: 'sine', vol: 0.12, delay: 0.06 });
        break;
      case 'key':
        this.tone(660, 0.1, { type: 'triangle', vol: 0.15 });
        this.tone(990, 0.15, { type: 'triangle', vol: 0.15, delay: 0.08 });
        break;
      case 'wisp':
        this.tone(700, 0.15, { type: 'sine', vol: 0.05, slide: 350 });
        break;
      case 'bell':
        [0, 0.35].forEach((d) => {
          this.tone(1046, 0.9, { type: 'sine', vol: 0.18, delay: d });
          this.tone(1568, 0.6, { type: 'sine', vol: 0.06, delay: d });
        });
        break;
      case 'alert':
        this.tone(880, 0.1, { vol: 0.1 });
        this.tone(1175, 0.15, { vol: 0.1, delay: 0.1 });
        break;
      case 'bark':
        this.noise(0.12, 0.25);
        this.tone(160, 0.12, { type: 'sawtooth', vol: 0.15, slide: 90 });
        this.noise(0.12, 0.25, 0.18);
        break;
      case 'caught':
        this.tone(400, 0.5, { type: 'sawtooth', vol: 0.15, slide: 80 });
        this.noise(0.3, 0.15);
        break;
      case 'timeout':
        [440, 370, 311, 262].forEach((f, i) => this.tone(f, 0.18, { type: 'square', vol: 0.1, delay: i * 0.16 }));
        break;
      case 'tick':
        this.tone(1000, 0.04, { type: 'square', vol: 0.05 });
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.15, delay: i * 0.1 }));
        break;
      case 'click':
        this.tone(600, 0.04, { type: 'square', vol: 0.06 });
        break;
      case 'move':
        this.tone(900, 0.025, { type: 'sine', vol: 0.05 });
        break;
      case 'swap':
        this.tone(520, 0.08, { type: 'sine', vol: 0.09, slide: 780 });
        break;
      case 'swapBack':
        this.tone(780, 0.08, { type: 'sine', vol: 0.09, slide: 520 });
        break;
      case 'suspect':
        this.tone(660, 0.12, { type: 'triangle', vol: 0.08, slide: 990 });
        break;
      case 'star':
        this.tone(1175, 0.12, { type: 'triangle', vol: 0.12 });
        this.tone(1568, 0.18, { type: 'sine', vol: 0.08, delay: 0.05 });
        break;
      case 'start':
        this.tone(392, 0.1, { type: 'triangle', vol: 0.1 });
        this.tone(587, 0.16, { type: 'triangle', vol: 0.1, delay: 0.08 });
        break;
    }
  },

  // ---------- music ----------
  //
  // A tiny step sequencer. Each style sets tempo, key, mode and
  // instrumentation; the seed (the level number) generates that level's own
  // chord progression, melody and bassline, so every level sounds different
  // while each act keeps its character. Tension (low time, a suspicious
  // guard) adds a heartbeat and quick hats.
  STYLES: {
    menu: { bpm: 72, root: 146.83, mode: [0, 3, 5, 7, 10], lead: 'sine', leadVol: 0.05, bass: 'sine', drums: 0, density: 0.22, pad: 0.035 },
    act0: { bpm: 88, root: 146.83, mode: [0, 2, 3, 5, 7, 9, 10], lead: 'triangle', leadVol: 0.05, bass: 'triangle', drums: 1, density: 0.34, pad: 0.025 },
    act1: { bpm: 98, root: 164.81, mode: [0, 1, 3, 5, 7, 8, 10], lead: 'square', leadVol: 0.022, bass: 'triangle', drums: 2, density: 0.38, pad: 0.015 },
    act2: { bpm: 110, root: 130.81, mode: [0, 2, 3, 5, 7, 8, 11], lead: 'sawtooth', leadVol: 0.018, bass: 'sawtooth', drums: 3, density: 0.44, pad: 0.012 },
  },
  trackKey: null,
  song: null,

  setTrack(track) {
    const key = `${track.style}:${track.seed}`;
    if (key === this.trackKey) return;
    this.trackKey = key;
    const st = this.STYLES[track.style];
    let seed = (track.seed + 1) * 2654435761;
    const rnd = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const PROGS = [[0, 5, 3, 4], [0, 3, 4, 0], [0, 6, 5, 4], [0, 2, 5, 4], [0, 4, 5, 3]];
    const prog = PROGS[Math.floor(rnd() * PROGS.length)];
    // two-bar motif (16 eighths), varied on repeat
    const motif = [];
    for (let i = 0; i < 16; i++) motif.push(rnd() < st.density ? Math.floor(rnd() * 8) : null);
    const bassAlt = rnd() < 0.5;
    this.song = { st, prog, motif, bassAlt, rnd };
    this.mStep = 0;
  },

  note(st, degree, octave) {
    const m = st.mode;
    const d = ((degree % m.length) + m.length) % m.length;
    const o = octave + Math.floor(degree / m.length);
    return st.root * Math.pow(2, m[d] / 12 + o);
  },

  hit(kind, at, vol) {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (kind === 'kick') this.tone(110, 0.18, { type: 'sine', vol, slide: 40, at, bus });
    else {
      if (!this.noiseBuf) {
        this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = this.noiseBuf;
      f.type = kind === 'hat' ? 'highpass' : 'bandpass';
      f.frequency.value = kind === 'hat' ? 7000 : 1800;
      const dur = kind === 'hat' ? 0.04 : 0.12;
      g.gain.setValueAtTime(vol, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(f);
      f.connect(g);
      g.connect(bus);
      src.start(at, Math.random() * 0.5, dur + 0.02);
    }
  },

  // Call every tick; schedules a little ahead of the audio clock.
  updateMusic() {
    const ctx = this.ctx;
    if (!ctx || !this.song || this.muted || this.musicVol <= 0) {
      if (ctx) this.mNext = ctx.currentTime + 0.1;
      return;
    }
    const { st, prog, motif, bassAlt } = this.song;
    const bus = this.musicBus;
    const eighth = 30 / st.bpm / (this.tension > 0.5 ? 1.12 : 1);
    if (this.mNext < ctx.currentTime) this.mNext = ctx.currentTime + 0.05;
    while (this.mNext < ctx.currentTime + 0.25) {
      const t = this.mNext;
      const i = this.mStep;
      const bar = Math.floor(i / 8) % 4;
      const pos = i % 8;
      const chord = prog[bar];
      if (pos === 0 && st.pad) {
        for (const d of [0, 2, 4]) this.tone(this.note(st, chord + d, 0), eighth * 8.5, { type: 'sine', vol: st.pad, at: t, bus });
      }
      if (pos === 0 || (pos === 4 && st.drums >= 1) || (bassAlt && pos === 6)) {
        const deg = pos === 6 ? chord + 4 : chord;
        this.tone(this.note(st, deg, -1), eighth * (pos === 0 ? 3 : 1.6), { type: st.bass, vol: st.bass === 'sawtooth' ? 0.035 : 0.09, at: t, bus });
      }
      const m = motif[i % 16];
      // the motif answers itself an octave up every fourth bar
      if (m !== null) this.tone(this.note(st, chord + m, bar === 3 ? 1 : 0), eighth * 1.8, { type: st.lead, vol: st.leadVol, at: t, bus });
      if (st.drums >= 1 && pos === 0) this.hit('kick', t, 0.12);
      if (st.drums >= 2 && pos % 2 === 1) this.hit('hat', t, 0.03);
      if (st.drums >= 3 && pos === 4) this.hit('snare', t, 0.05);
      if (st.drums >= 3 && pos === 7 && bar === 3) this.hit('kick', t, 0.08);
      if (this.tension > 0) {
        if (pos % 4 === 0) this.hit('kick', t, 0.1 * this.tension);
        this.hit('hat', t, 0.02 * this.tension);
      }
      this.mStep++;
      this.mNext += eighth;
    }
  },
};
