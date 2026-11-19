// Updraft Avenue sound: a festival day. Kites hop with a papery flutter,
// updrafts whoosh upward, drainpipes are a descending slide-whistle with a
// gurgle, ribbons ring a little bell. The music is a light waltz: plucked
// ukulele chords, a glockenspiel tune and an oom-pah-pah bass.
(function () {
  const A = {
    ctx: null, sfx: null, music: null, sfxVol: 0.8, musicVol: 0.5, next: 0, step: 0,
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = (this.ctx = new AC()), master = c.createGain(); master.gain.value = 0.75;
      master.connect(c.createDynamicsCompressor()).connect(c.destination);
      this.sfx = c.createGain(); this.sfx.connect(master);
      this.music = c.createGain(); this.music.connect(master);
      const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0);
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
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let out = g;
      if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; g.connect(fl); out = fl; }
      osc.connect(g); out.connect(bus || this.sfx); osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(t, dur, vol, bus, type, freq, q, to) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.05, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      switch (name) {
        case 'hop': this.noise(t, 0.06, 0.06, null, 'bandpass', 1800 + arg * 60, 2); this.tone('triangle', 500 + arg * 25, t, 0.06, 0.04); break;
        case 'rattle': for (let i = 0; i < 7; i++) this.noise(t + i * 0.05 + Math.random() * 0.02, 0.03, 0.12, null, 'bandpass', 2500 + Math.random() * 2000, 5); break;
        case 'land': this.noise(t, 0.04, 0.2, null, 'bandpass', 2000, 4); this.tone('sine', 220, t, 0.08, 0.1, null, { to: 140 }); break;
        case 'whoosh': this.noise(t, 1.0, 0.16, null, 'bandpass', 300, 1.2, 3500); [72, 76, 79, 84].forEach((m, i) => this.tone('sine', this.mtof(m), t + 0.15 + i * 0.12, 0.3, 0.05)); break;
        case 'slide': this.tone('sine', 1400, t, 0.9, 0.09, null, { to: 220, glide: 0.85 }); this.noise(t + 0.6, 0.5, 0.06, null, 'lowpass', 500, 1, 150); break;
        case 'ribbon': [88, 93].forEach((m, i) => this.tone('sine', this.mtof(m), t + i * 0.08, 0.5, 0.06)); break;
        case 'bump': this.tone('triangle', 330, t, 0.12, 0.08, null, { to: 220 }); this.noise(t, 0.08, 0.1, null, 'lowpass', 800); break;
        case 'six': [79, 83, 86].forEach((m, i) => this.tone('square', this.mtof(m), t + i * 0.06, 0.12, 0.04, null, { lp: 3000 })); break;
        case 'win': [72, 76, 79, 84, 79, 84, 88, 91].forEach((m, i) => this.tone('triangle', this.mtof(m), t + i * 0.1, 0.35, 0.09)); for (let i = 0; i < 6; i++) this.noise(t + 0.4 + i * 0.12, 0.2, 0.06, null, 'highpass', 4000); break;
        case 'move': this.tone('triangle', 1100, t, 0.04, 0.03); break;
        case 'confirm': this.tone('triangle', 660, t, 0.08, 0.07); this.tone('triangle', 990, t + 0.05, 0.1, 0.06); break;
        case 'back': this.tone('triangle', 520, t, 0.1, 0.06, null, { to: 390 }); break;
        case 'deny': this.tone('sawtooth', 160, t, 0.15, 0.05, null, { lp: 700 }); break;
      }
    },
    // a festival waltz in three
    CH: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67], [57, 60, 64], [62, 65, 69], [67, 71, 74], [60, 64, 67]],
    MEL: [76, 0, 79, 81, 0, 79, 77, 0, 76, 74, 0, 0, 72, 0, 74, 76, 0, 79, 74, 0, 0, 72, 0, 0],
    update(on) {
      const c = this.ctx; if (!c || this.musicVol <= 0) return;
      const beat = 60 / (on ? 152 : 138), M = this.music;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.3) {
        const t = this.next, s = this.step % 3, ch = this.CH[Math.floor(this.step / 3) % 8];
        if (s === 0) this.tone('triangle', this.mtof(ch[0] - 24), t, beat * 0.9, 0.13, M, { lp: 600 });
        else ch.forEach((m) => this.tone('triangle', this.mtof(m), t, beat * 0.5, 0.025, M, { lp: 2400 }));
        const mel = this.MEL[this.step % 24];
        if (mel) { this.tone('sine', this.mtof(mel + 12), t, 0.5, 0.035, M); this.tone('sine', this.mtof(mel + 24) * 1.002, t, 0.2, 0.01, M); }
        this.step++; this.next += beat;
      }
    },
  };
  UA.Audio = A;
})();
