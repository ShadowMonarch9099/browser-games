// Gate Stampede sound: a toy-box marching band made in WebAudio. Xylophone
// melody, glockenspiel sparkle, toy snare and bass drum, a tuba-ish bass,
// slide whistles for bad gates and a kazoo fanfare for the castle.
(function () {
  const A = {
    ctx: null, sfx: null, music: null, sfxVol: 0.8, musicVol: 0.6, on: false, next: 0, step: 0, tempo: 112,
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = (this.ctx = new AC());
      const master = c.createGain(); master.gain.value = 0.7;
      master.connect(c.createDynamicsCompressor()).connect(c.destination);
      this.master = master;
      this.sfx = c.createGain(); this.sfx.connect(master);
      this.music = c.createGain(); this.music.connect(master);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = n;
      this.apply(); this.next = c.currentTime + 0.1;
    },
    setVolumes(s, m) { this.sfxVol = s / 10; this.musicVol = m / 10; this.apply(); },
    apply() { if (!this.ctx) return; const t = this.ctx.currentTime; this.sfx.gain.setTargetAtTime(this.sfxVol, t, 0.02); this.music.gain.setTargetAtTime(this.musicVol * 0.45, t, 0.05); },
    mtof: (m) => 440 * Math.pow(2, (m - 69) / 12),
    tone(type, f, t, dur, vol, bus, o = {}) {
      const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
      if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib; lg.gain.value = f * 0.03; l.connect(lg).connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let out = g;
      if (o.lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.lp; g.connect(f2); out = f2; }
      osc.connect(g); out.connect(bus || this.sfx); osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(t, dur, vol, bus, type, freq) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus || this.sfx); s.start(t); s.stop(t + dur + 0.05);
    },
    // xylophone: a sine with a quick bright overtone
    xylo(m, t, vol, bus) { const f = this.mtof(m); this.tone('sine', f, t, 0.35, vol, bus); this.tone('sine', f * 4, t, 0.06, vol * 0.4, bus); },
    play(name, arg) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      switch (name) {
        case 'good': [72, 76, 79, 84].slice(0, 2 + Math.min(2, arg || 0)).forEach((m, i) => this.xylo(m, t + i * 0.06, 0.18)); break;
        case 'bad': this.tone('sine', 1200, t, 0.5, 0.12, null, { to: 300, glide: 0.45 }); break;          // slide whistle down
        case 'saw': this.tone('sawtooth', 120, t, 0.35, 0.08, null, { lp: 1600, vib: 30 }); this.noise(t, 0.25, 0.12, null, 'highpass', 3000); break;
        case 'clash': for (let i = 0; i < 6; i++) { this.noise(t + i * 0.05, 0.06, 0.18, null, 'bandpass', 1800 + i * 200); this.tone('triangle', 200 + i * 30, t + i * 0.05, 0.08, 0.1); } break;
        case 'step': this.noise(t, 0.03, 0.05, null, 'bandpass', 900); break;
        case 'move': this.xylo(84, t, 0.06); break;
        case 'confirm': this.xylo(79, t, 0.12); this.xylo(86, t + 0.06, 0.1); break;
        case 'back': this.xylo(76, t, 0.1); this.xylo(72, t + 0.06, 0.08); break;
        case 'deny': this.tone('square', 160, t, 0.15, 0.06, null, { lp: 800 }); break;
        case 'star': this.xylo(84 + (arg || 0) * 4, t, 0.2); this.tone('triangle', this.mtof(96 + (arg || 0) * 4), t, 0.4, 0.05); break;
        case 'win': [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => this.tone('square', this.mtof(m), t + i * 0.09, 0.3, 0.05, null, { lp: 2200, vib: 6 })); this.noise(t + 0.62, 0.4, 0.2, null, 'lowpass', 400); break;
        case 'lose': [67, 66, 65, 64].forEach((m, i) => this.tone('square', this.mtof(m - 12), t + i * 0.32, 0.4, 0.06, null, { lp: 900, vib: 5 })); break;
        case 'go': this.tone('triangle', 660, t, 0.12, 0.12); this.tone('triangle', 990, t + 0.14, 0.3, 0.14); this.noise(t, 0.4, 0.08, null, 'bandpass', 600); break;
      }
    },
    // A cheerful toy march: I-IV-V-I in C, xylophone tune, snare and bass drum.
    TUNE: [72, 0, 76, 0, 79, 79, 76, 0, 77, 0, 74, 0, 72, 74, 76, 0, 79, 0, 81, 79, 77, 76, 74, 0, 72, 76, 74, 71, 72, 0, 0, 0],
    BASS: [48, 53, 55, 48],
    update(playing) {
      const c = this.ctx;
      if (!c || this.musicVol <= 0) return;
      const eighth = 60 / this.tempo / 2, M = this.music;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.25) {
        const t = this.next, s = this.step % 32, bar = Math.floor(s / 8) % 4;
        if (s % 2 === 0) this.tone('triangle', this.mtof(this.BASS[bar] - (s % 4 === 2 ? -7 : 0)), t, eighth * 1.6, 0.16, M, { lp: 700 });
        if (s % 4 === 0) this.tone('sine', 110, t, 0.18, 0.3, M, { to: 50, glide: 0.12 });
        if (s % 4 === 2) this.noise(t, 0.08, playing ? 0.1 : 0.05, M, 'bandpass', 2500);
        if (playing && s % 8 === 7) { this.noise(t, 0.04, 0.06, M, 'bandpass', 3000); this.noise(t + eighth / 2, 0.04, 0.06, M, 'bandpass', 3000); }
        const n = this.TUNE[s];
        if (n) this.xylo(n, t, playing ? 0.12 : 0.08, M);
        if (!playing && s % 8 === 0) this.tone('sine', this.mtof(96), t, 0.6, 0.03, M);
        this.step++; this.next += eighth;
      }
    },
  };
  GS.Audio = A;
})();
