// Orchard Sow sound: wood and seed. Each seed drops into its bowl with a
// hollow tock that rises along the row; stores catch seeds with a deeper
// knock; a capture rustles like a handful of beans poured into a basket.
// Birds chirp now and then. The music is a gentle hammered dulcimer with a
// soft frame drum.
(function () {
  const A = {
    ctx: null, sfx: null, music: null, sfxVol: 0.8, musicVol: 0.5, next: 0, step: 0, birdT: 3,
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
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.003)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let out = g;
      if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; g.connect(fl); out = fl; }
      osc.connect(g); out.connect(bus || this.sfx); osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(t, dur, vol, bus, type, freq, q, to) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    // a hollow wooden tock
    tock(t, f, vol) { this.tone('sine', f, t, 0.09, vol, null, { to: f * 0.7 }); this.noise(t, 0.02, vol * 0.5, null, 'bandpass', f * 3, 4); },
    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      switch (name) {
        case 'drop': this.tock(t, 520 + (arg % 8) * 45, 0.18); break;
        case 'store': this.tock(t, 220, 0.22); this.noise(t, 0.08, 0.06, null, 'lowpass', 900); break;
        case 'scoop': this.noise(t, 0.25, 0.1, null, 'bandpass', 1400, 1.2, 600); break;
        case 'capture': for (let i = 0; i < 12; i++) this.noise(t + i * 0.025 + Math.random() * 0.02, 0.04, 0.12, null, 'bandpass', 1200 + Math.random() * 1600, 4); [72, 76, 79].forEach((m, i) => this.tone('triangle', this.mtof(m), t + 0.2 + i * 0.07, 0.3, 0.06)); break;
        case 'again': [79, 84].forEach((m, i) => this.tone('triangle', this.mtof(m), t + i * 0.08, 0.25, 0.07)); break;
        case 'win': [67, 71, 74, 79, 83, 86].forEach((m, i) => this.tone('triangle', this.mtof(m), t + i * 0.1, 0.5, 0.08)); break;
        case 'lose': [72, 69, 65, 62].forEach((m, i) => this.tone('triangle', this.mtof(m), t + i * 0.18, 0.5, 0.07)); break;
        case 'nope': this.tone('sine', 200, t, 0.12, 0.08, null, { to: 150 }); break;
        case 'move': this.tock(t, 900, 0.05); break;
        case 'confirm': this.tock(t, 660, 0.12); this.tock(t + 0.06, 880, 0.1); break;
        case 'back': this.tock(t, 440, 0.1); break;
      }
    },
    bird(t) { const f = 2600 + Math.random() * 1200; for (let i = 0; i < 3; i++) this.tone('sine', f, t + i * 0.09, 0.07, 0.02, this.music, { to: f * 1.3, glide: 0.05 }); },
    // hammered dulcimer: two slightly detuned strings struck together
    MEL: [67, 71, 74, 71, 72, 0, 69, 72, 71, 67, 69, 71, 72, 0, 74, 0, 76, 74, 72, 71, 69, 0, 67, 69, 71, 69, 67, 0, 62, 0, 67, 0],
    CH: [55, 55, 60, 60, 57, 57, 62, 55],
    update(on) {
      const c = this.ctx; if (!c || this.musicVol <= 0) return;
      const eighth = 60 / 96 / 2, M = this.music;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.3) {
        const t = this.next, s = this.step % 32, root = this.CH[Math.floor(this.step / 8) % 8];
        const m = this.MEL[s];
        if (m) { const f = this.mtof(m); this.tone('triangle', f, t, 0.7, 0.035, M); this.tone('triangle', f * 1.004, t, 0.6, 0.03, M); this.tone('sine', f * 2, t, 0.2, 0.01, M); }
        if (s % 4 === 0) { this.tone('triangle', this.mtof(root - 12), t, eighth * 3.5, 0.06, M, { lp: 900 }); this.tone('triangle', this.mtof(root - 5), t, eighth * 3, 0.025, M, { lp: 900 }); }
        if (on && s % 8 === 0) this.tone('sine', 90, t, 0.25, 0.12, M, { to: 60 });
        if (on && s % 8 === 6) this.noise(t, 0.08, 0.02, M, 'bandpass', 1800, 2);
        this.step++; this.next += eighth;
      }
      this.birdT -= 0.016;
      if (this.birdT <= 0) { this.birdT = 6 + Math.random() * 9; this.bird(c.currentTime + 0.1); }
    },
  };
  OS.Audio = A;
})();
