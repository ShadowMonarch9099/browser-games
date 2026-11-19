// Flick Parlour sound: the sharp clack of wooden coins, the deeper knock of
// the striker, a soft thump into a net pocket, and café chatter far off.
// The music is late-night lounge jazz: walking bass, brushed snare and a
// shimmering vibraphone.
(function () {
  const A = {
    ctx: null, sfx: null, music: null, sfxVol: 0.8, musicVol: 0.5, next: 0, step: 0, clackT: 0,
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
      if (o.trem) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5; lg.gain.value = vol * 0.5; l.connect(lg).connect(g.gain); l.start(t); l.stop(t + dur + 0.05); }
      if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; g.connect(fl); out = fl; }
      osc.connect(g); out.connect(bus || this.sfx); osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(t, dur, vol, bus, type, freq, q, to) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.005, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005, v = Math.min(1, arg);
      switch (name) {
        case 'clack': if (this.ctx.currentTime - this.clackT < 0.03) return; this.clackT = this.ctx.currentTime; this.noise(t, 0.03, 0.08 + v * 0.3, null, 'bandpass', 2600 + Math.random() * 1500, 5); this.tone('sine', 1800 + Math.random() * 400, t, 0.04, 0.03 + v * 0.06); break;
        case 'knock': this.noise(t, 0.05, 0.1 + v * 0.3, null, 'bandpass', 1100, 3); this.tone('sine', 600, t, 0.06, 0.06 + v * 0.1, null, { to: 380 }); break;
        case 'cushion': if (this.ctx.currentTime - this.clackT < 0.03) return; this.clackT = this.ctx.currentTime; this.tone('sine', 140, t, 0.1, 0.05 + v * 0.15, null, { to: 90 }); break;
        case 'flick': this.noise(t, 0.04, 0.3, null, 'bandpass', 1500, 2); this.tone('triangle', 300, t, 0.05, 0.1, null, { to: 150 }); break;
        case 'pocket': this.tone('sine', 160, t, 0.18, 0.25, null, { to: 70 }); this.noise(t + 0.03, 0.2, 0.06, null, 'bandpass', 700, 1.5); break;
        case 'own': [76, 79, 83].forEach((m, i) => this.tone('sine', this.mtof(m), t + i * 0.07, 0.6, 0.05, null, { trem: true })); break;
        case 'queen': [72, 76, 79, 84, 88].forEach((m, i) => this.tone('sine', this.mtof(m), t + i * 0.08, 0.8, 0.06, null, { trem: true })); break;
        case 'foul': this.tone('sawtooth', 110, t, 0.35, 0.08, null, { lp: 600 }); this.tone('sawtooth', 104, t, 0.35, 0.08, null, { lp: 600 }); break;
        case 'win': [60, 64, 67, 71, 74, 79, 83].forEach((m, i) => this.tone('sine', this.mtof(m), t + i * 0.09, 1, 0.06, null, { trem: true })); break;
        case 'lose': [67, 65, 62, 58].forEach((m, i) => this.tone('sine', this.mtof(m), t + i * 0.2, 0.7, 0.06, null, { trem: true })); break;
        case 'slide': this.noise(t, 0.04, 0.03, null, 'highpass', 4000); break;
        case 'move': this.tone('sine', 1200, t, 0.04, 0.03); break;
        case 'confirm': this.tone('sine', this.mtof(79), t, 0.3, 0.06, null, { trem: true }); this.tone('sine', this.mtof(84), t + 0.06, 0.3, 0.05); break;
        case 'back': this.tone('sine', this.mtof(72), t, 0.25, 0.05); break;
      }
    },
    // lounge jazz: ii-V-I in F with a walking bass and vibes comping
    CH: [[55, 58, 62, 65], [60, 64, 67, 70], [53, 57, 60, 64], [53, 57, 60, 64], [62, 65, 69, 72], [55, 58, 62, 65], [60, 64, 67, 70], [53, 57, 60, 64]],
    WALK: [[43, 45, 46, 47], [48, 50, 52, 46], [41, 43, 45, 46], [41, 45, 48, 49], [50, 52, 53, 51], [43, 45, 46, 47], [48, 50, 52, 46], [41, 43, 44, 45]],
    update(on) {
      const c = this.ctx; if (!c || this.musicVol <= 0) return;
      const beat = 60 / 92, M = this.music;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.3) {
        const t = this.next, b = this.step % 4, bar = Math.floor(this.step / 4) % 8;
        this.tone('triangle', this.mtof(this.WALK[bar][b]), t, beat * 0.9, 0.12, M, { lp: 500 });
        if (b === 1 || b === 3) { this.noise(t, 0.12, 0.025, M, 'highpass', 3500); this.noise(t + beat * 0.66, 0.06, 0.012, M, 'highpass', 5000); }
        if (b === 0 || (b === 2 && bar % 2)) this.CH[bar].forEach((m) => this.tone('sine', this.mtof(m + 12), t + (b === 2 ? beat * 0.33 : 0), beat * 1.6, 0.018, M, { trem: true }));
        this.step++; this.next += beat;
      }
    },
  };
  FP.Audio = A;
})();
