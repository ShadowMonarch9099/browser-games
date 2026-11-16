// Last Lantern sound, all synthesized. Effects: the hiss and roar of the
// flame, glass and brass, wet stone, and the gloom's whispers. Music: a cave
// drone with a plucked harp, a warm choir that swells near lit beacons, and a
// heartbeat with tremolo strings when the gloom closes in. Everything runs
// through a long echo so it sounds like a cavern.
LL.Audio = {
  ctx: null,
  muted: false,
  sfxVol: 0.8,
  musicVol: 0.6,
  danger: 0, // 0..1, set by the game from nearby creatures
  warmth: 0, // 0..1, near a lit beacon
  mode: 'title',

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    // cavern echo shared by both buses
    this.echoIn = ctx.createGain();
    const d1 = ctx.createDelay(2);
    d1.delayTime.value = 0.37;
    const fb = ctx.createGain();
    fb.gain.value = 0.42;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    this.echoIn.connect(d1);
    d1.connect(lp);
    lp.connect(fb);
    fb.connect(d1);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    lp.connect(wet);
    wet.connect(this.master);
    this.sfx.connect(this.echoIn);
    this.music.connect(this.echoIn);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    this.startDrone();
    this.apply();
  },

  apply() {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.sfx.gain.value = this.sfxVol;
    this.music.gain.value = this.musicVol * 0.6;
  },
  setVolumes(s, m) {
    this.sfxVol = s / 10;
    this.musicVol = m / 10;
    this.apply();
  },

  osc(f, dur, o = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = o.at != null ? o.at : ctx.currentTime + (o.delay || 0);
    const v = ctx.createOscillator();
    const g = ctx.createGain();
    v.type = o.type || 'sine';
    v.frequency.setValueAtTime(f, t);
    if (o.slide) v.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    if (o.detune) v.detune.value = o.detune;
    const a = o.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.1, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = g;
    if (o.lp) {
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = o.lp;
      g.connect(fl);
      out = fl;
    }
    if (o.trem) {
      const l = ctx.createOscillator();
      const lg = ctx.createGain();
      l.frequency.value = o.trem;
      lg.gain.value = (o.vol || 0.1) * 0.6;
      l.connect(lg);
      lg.connect(g.gain);
      l.start(t);
      l.stop(t + dur);
    }
    v.connect(g);
    out.connect(o.bus || this.sfx);
    v.start(t);
    v.stop(t + dur + 0.05);
  },

  noise(dur, o = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = o.at != null ? o.at : ctx.currentTime + (o.delay || 0);
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(o.bus || this.sfx);
    s.start(t, Math.random(), dur + 0.1);
  },

  play(name, arg) {
    if (!this.ctx) return;
    const N = this.ctx.currentTime;
    switch (name) {
      case 'swing':
        this.noise(0.18, { filter: 'bandpass', freq: 600, sweep: 2600, q: 1.5, vol: 0.18, attack: 0.03 });
        this.osc(1900, 0.12, { type: 'sine', vol: 0.03, delay: 0.05 });
        break;
      case 'hit':
        this.osc(140, 0.16, { type: 'triangle', vol: 0.25, slide: 60 });
        this.noise(0.12, { filter: 'lowpass', freq: 1400, vol: 0.25 });
        break;
      case 'banish':
        // the gloom bursts into motes: a soft rising shimmer
        this.noise(0.5, { filter: 'highpass', freq: 3000, sweep: 8000, vol: 0.08, attack: 0.02 });
        [784, 1046, 1318].forEach((f, i) => this.osc(f, 0.4, { type: 'sine', vol: 0.05, at: N + i * 0.05 }));
        break;
      case 'hurt':
        // oil knocked out of the lamp: glass clink, low thump, sizzle
        this.osc(2600, 0.25, { type: 'sine', vol: 0.06 });
        this.osc(3900, 0.18, { type: 'sine', vol: 0.03, delay: 0.02 });
        this.osc(90, 0.3, { type: 'sine', vol: 0.3, slide: 45 });
        this.noise(0.45, { filter: 'highpass', freq: 4000, vol: 0.1, delay: 0.05 });
        break;
      case 'oil':
        for (let i = 0; i < 4; i++) this.osc(300 + i * 90 + Math.random() * 40, 0.08, { type: 'sine', vol: 0.09, at: N + i * 0.06, slide: 600 + i * 120 });
        break;
      case 'flame': {
        const lv = arg || 0;
        this.osc(2200, 0.03, { type: 'square', vol: 0.03, lp: 3000 }); // wick click
        this.noise(0.3 + lv * 0.15, { filter: 'bandpass', freq: 300 + lv * 400, sweep: 600 + lv * 900, q: 0.8, vol: 0.06 + lv * 0.05, attack: 0.04 });
        break;
      }
      case 'beacon':
        this.noise(1.6, { filter: 'lowpass', freq: 200, sweep: 3000, q: 0.7, vol: 0.4, attack: 0.25 });
        this.osc(55, 1.5, { type: 'sawtooth', vol: 0.12, lp: 300, attack: 0.2 });
        [523, 659, 784, 1046].forEach((f, i) => this.osc(f, 2.2, { type: 'triangle', vol: 0.08, at: N + 0.5 + i * 0.12 }));
        break;
      case 'shrine':
        [880, 1109, 1319, 1760].forEach((f, i) => this.osc(f, 1.4, { type: 'sine', vol: 0.07, at: N + i * 0.07 }));
        this.osc(220, 1.2, { type: 'triangle', vol: 0.08 });
        break;
      case 'denied':
        this.osc(110, 0.22, { type: 'triangle', vol: 0.2 });
        this.noise(0.08, { filter: 'lowpass', freq: 500, vol: 0.15 });
        break;
      case 'step':
        this.noise(0.04, { filter: 'bandpass', freq: 900 + Math.random() * 500, q: 4, vol: 0.035 });
        break;
      case 'drip':
        this.osc(1400 + Math.random() * 900, 0.12, { type: 'sine', vol: 0.05, slide: 2600 });
        break;
      case 'whisper':
        this.noise(0.6, { filter: 'bandpass', freq: 2200 + Math.random() * 1200, q: 8, vol: 0.04, attack: 0.2 });
        break;
      case 'spawn':
        this.osc(70, 0.5, { type: 'sawtooth', vol: 0.05, lp: 250, slide: 50 });
        break;
      case 'move':
        this.osc(1200, 0.03, { type: 'triangle', vol: 0.04 });
        this.noise(0.03, { filter: 'highpass', freq: 5000, vol: 0.03 });
        break;
      case 'click':
        this.osc(330, 0.5, { type: 'sine', vol: 0.09 });
        this.osc(660, 0.35, { type: 'sine', vol: 0.04 });
        break;
      case 'page':
        this.noise(0.25, { filter: 'bandpass', freq: 2000, sweep: 5000, q: 0.6, vol: 0.06 });
        break;
      case 'win':
        [262, 330, 392, 523, 659, 784].forEach((f, i) => this.osc(f, 3, { type: 'triangle', vol: 0.07, at: N + i * 0.18, attack: 0.1 }));
        break;
      case 'lose':
        this.noise(1.2, { filter: 'lowpass', freq: 2000, sweep: 80, vol: 0.25 });
        [392, 349, 311, 262].forEach((f, i) => this.osc(f, 0.9, { type: 'sine', vol: 0.07, at: N + 0.3 + i * 0.3 }));
        break;
    }
  },

  // ---------- music ----------
  startDrone() {
    const ctx = this.ctx;
    const g = (this.droneGain = ctx.createGain());
    g.gain.value = 0;
    const lp = (this.droneLP = ctx.createBiquadFilter());
    lp.type = 'lowpass';
    lp.frequency.value = 300;
    for (const [f, d] of [[55, 0], [55, 7], [82.4, -5]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(lp);
      o.start();
    }
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 0.07;
    lg.gain.value = 120;
    lfo.connect(lg);
    lg.connect(lp.frequency);
    lfo.start();
    lp.connect(g);
    g.connect(this.music);
    this.nextT = 0;
    this.stepN = 0;
  },

  // Phrygian harp lines; a choir chord near warmth; a heartbeat in danger.
  SCALE: [0, 1, 3, 5, 7, 8, 10],
  update(dt) {
    const ctx = this.ctx;
    if (!ctx || !this.droneGain) return;
    const target = this.muted || this.musicVol <= 0 ? 0 : this.mode === 'title' ? 0.05 : 0.07 + this.danger * 0.05;
    this.droneGain.gain.setTargetAtTime(target, ctx.currentTime, 0.5);
    this.droneLP.frequency.setTargetAtTime(260 + this.danger * 500, ctx.currentTime, 0.4);
    if (this.muted || this.musicVol <= 0) {
      this.nextT = ctx.currentTime + 0.1;
      return;
    }
    const beat = this.danger > 0.5 ? 0.36 : 0.5;
    if (this.nextT < ctx.currentTime) this.nextT = ctx.currentTime + 0.05;
    while (this.nextT < ctx.currentTime + 0.25) {
      const t = this.nextT;
      const i = this.stepN;
      const root = 110;
      const note = (deg, oct) => root * Math.pow(2, oct + Math.floor(deg / 7) + this.SCALE[((deg % 7) + 7) % 7] / 12);
      const bar = Math.floor(i / 8);
      const chord = [0, 5, 3, 6][bar % 4];
      // harp: a falling arpeggio every bar, sparser when calm
      const h = LL.U.hash(i, bar, 3);
      if (i % 8 < 4 && h < (this.mode === 'title' ? 0.5 : 0.65)) this.osc(note(chord + [0, 2, 4, 7][i % 4], 1), 1.6, { type: 'triangle', vol: 0.035, at: t, bus: this.music, lp: 2400 });
      if (i % 8 === 6 && h < 0.4) this.osc(note(chord + 9, 1), 2.2, { type: 'sine', vol: 0.025, at: t, bus: this.music });
      // choir near a lit beacon: a major chord with slow swell
      if (this.warmth > 0.05 && i % 16 === 0) for (const s of [0, 4, 7, 12]) this.osc(220 * Math.pow(2, s / 12), beat * 15, { type: 'sine', vol: 0.03 * this.warmth, at: t, bus: this.music, attack: 1.5 });
      // danger: heartbeat and a tremolo minor second
      if (this.danger > 0.1) {
        if (i % 4 === 0) this.osc(60, 0.18, { type: 'sine', vol: 0.18 * this.danger, at: t, bus: this.music, slide: 40 });
        if (i % 4 === 1) this.osc(55, 0.15, { type: 'sine', vol: 0.12 * this.danger, at: t, bus: this.music, slide: 38 });
        if (i % 16 === 0) {
          this.osc(note(chord, 0), beat * 15, { type: 'sawtooth', vol: 0.02 * this.danger, at: t, bus: this.music, lp: 900, trem: 9, attack: 0.5 });
          this.osc(note(chord + 1, 0), beat * 15, { type: 'sawtooth', vol: 0.015 * this.danger, at: t, bus: this.music, lp: 900, trem: 7, attack: 0.5 });
        }
      }
      this.stepN++;
      this.nextT += beat;
    }
  },
};
