// Bullet Garden sound: a garden at midnight. Crickets, a seed blaster's
// "thwip", a soft pop as seeds sprout, spitters going "pt", crunchy bug
// squishes, bomb pods bursting, glass tinks when bugs reach the greenhouse,
// and birdsong at dawn. The music is a kalimba lullaby that quickens as the
// night fills with bugs.
(function () {
  const A = {
    ctx: null, sfx: null, music: null, amb: null, sfxVol: 0.8, musicVol: 0.5, next: 0, step: 0, heat: 0, crickets: true, chirpT: 0,
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
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.008, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    // a kalimba tine: sine plus a short metallic overtone
    tine(m, t, vol, bus, dur = 0.9) { this.tone('sine', this.mtof(m), t, dur, vol, bus); this.tone('sine', this.mtof(m) * 5.4, t, 0.06, vol * 0.3, bus); },
    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      switch (name) {
        case 'fire': this.noise(t, 0.06, 0.15, null, 'bandpass', 1800, 2, 700); this.tone('square', 700, t, 0.05, 0.03, null, { to: 350, lp: 2000 }); break;
        case 'sprout': this.tone('sine', 300 + arg * 60, t, 0.18, 0.12, null, { to: 700 + arg * 80 }); this.tone('sine', 1200, t + 0.08, 0.1, 0.03); break;
        case 'fizzle': this.noise(t, 0.12, 0.08, null, 'lowpass', 600); break;
        case 'hit': this.noise(t, 0.05, 0.14, null, 'bandpass', 2500, 3); break;
        case 'spit': this.tone('triangle', 900, t, 0.05, 0.04, null, { to: 500 }); this.noise(t, 0.03, 0.05, null, 'highpass', 3000); break;
        case 'squish': this.noise(t, 0.12, 0.22, null, 'bandpass', 900 + Math.random() * 600, 1.5, 300); this.tone('sine', 180, t, 0.1, 0.12, null, { to: 80 }); break;
        case 'boom': this.tone('sine', 110, t, 0.5, 0.45, null, { to: 35 }); this.noise(t, 0.45, 0.35, null, 'lowpass', 1500, 0.7, 200); break;
        case 'bite': this.tone('sine', 2600 + Math.random() * 800, t, 0.12, 0.05); this.noise(t, 0.04, 0.06, null, 'highpass', 5000); break;
        case 'wilt': this.tone('triangle', 500, t, 0.4, 0.06, null, { to: 220 }); break;
        case 'eaten': this.noise(t, 0.25, 0.18, null, 'bandpass', 700, 1, 300); break;
        case 'thirsty': this.tine(88, t, 0.04, null, 0.2); this.tine(84, t + 0.1, 0.04, null, 0.2); break;
        case 'seed': this.tine(79 + arg * 2, t, 0.06, null, 0.3); break;
        case 'night': [57, 60, 64].forEach((m, i) => this.tone('sine', this.mtof(m), t + i * 0.2, 1.4, 0.06)); this.noise(t, 1.2, 0.04, null, 'bandpass', 400, 0.6); break;
        case 'dawn': {
          for (let i = 0; i < 6; i++) { const s = t + i * 0.18 + Math.random() * 0.05, f = 2200 + Math.random() * 1400; this.tone('sine', f, s, 0.12, 0.05, null, { to: f * 1.4 }); }
          [64, 68, 71, 76].forEach((m, i) => this.tine(m, t + 0.6 + i * 0.12, 0.08, null, 1.4));
          break;
        }
        case 'lose': [64, 62, 59, 57].forEach((m, i) => this.tine(m - 12, t + i * 0.35, 0.1, null, 1.4)); break;
        case 'win': [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => this.tine(m, t + i * 0.12, 0.1, null, 1.4)); break;
        case 'move': this.tine(84, t, 0.04, null, 0.2); break;
        case 'confirm': this.tine(76, t, 0.07, null, 0.4); this.tine(83, t + 0.06, 0.06, null, 0.4); break;
        case 'back': this.tine(71, t, 0.06, null, 0.3); break;
        case 'deny': this.tone('triangle', 150, t, 0.15, 0.08, null, { lp: 600 }); break;
      }
    },
    // A minor kalimba ostinato; the busier the night, the more notes and the faster pulse
    CH: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 56, 59, 64]],
    update(on, dt) {
      const c = this.ctx; if (!c) return;
      if (on && this.crickets) {
        this.chirpT -= dt || 0;
        if (this.chirpT <= 0) { this.chirpT = 0.4 + Math.random() * 1.2; const t = c.currentTime, f = 4200 + Math.random() * 600; for (let i = 0; i < 3; i++) this.tone('sine', f, t + i * 0.045, 0.03, 0.012 * this.sfxVol * 2); }
      }
      if (this.musicVol <= 0) return;
      const eighth = 60 / (84 + this.heat * 30) / 2, M = this.music;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.3) {
        const t = this.next, s = this.step % 8, ch = this.CH[Math.floor(this.step / 16) % 4];
        const order = [0, 2, 1, 3, 2, 1, 3, 2];
        if (s % 2 === 0 || this.heat > 0.4) this.tine(ch[order[s]] + 12, t, 0.045, M, 0.8);
        if (s === 0) this.tone('sine', this.mtof(ch[0] - 12), t, eighth * 7, 0.07, M, { a: 0.1 });
        if (on && this.heat > 0.25 && s % 4 === 2) this.noise(t, 0.05, 0.03 + this.heat * 0.04, M, 'bandpass', 3000, 2);
        if (on && this.heat > 0.55 && (s === 0 || s === 4)) this.tone('sine', 90, t, 0.18, 0.12, M, { to: 50 });
        this.step++; this.next += eighth;
      }
    },
  };
  BG.Audio = A;
})();
