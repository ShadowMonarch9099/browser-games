// Riverboat Dice sound: bone dice rattling in a leather cup and clattering
// on baize, brass tokens clinking, a steam whistle, and the slow chunk of the
// paddle wheel. The music is a lazy riverboat tune: plucked banjo, a walking
// upright bass and a reedy harmonica.
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
      if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = f * 0.015; l.connect(lg).connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
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
    click(t, vol) { this.noise(t, 0.025, vol, null, 'bandpass', 2500 + Math.random() * 2500, 6); },
    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      switch (name) {
        case 'shake': for (let i = 0; i < 10; i++) this.click(t + i * 0.035 + Math.random() * 0.02, 0.12); this.noise(t, 0.35, 0.04, null, 'lowpass', 600); break;
        case 'land': this.click(t, 0.25); this.click(t + 0.05 + Math.random() * 0.04, 0.12); this.click(t + 0.12, 0.06); break;
        case 'pick': this.tone('triangle', 1600, t, 0.05, 0.05); break;
        case 'hold': this.tone('triangle', 900, t, 0.06, 0.06); this.tone('triangle', 1350, t + 0.04, 0.08, 0.05); break;
        case 'chip': for (let i = 0; i < Math.min(8, 2 + arg); i++) { this.tone('triangle', 3200 + Math.random() * 900, t + i * 0.05, 0.07, 0.05); this.click(t + i * 0.05, 0.08); } break;
        case 'bust': this.tone('sawtooth', 220, t, 0.4, 0.08, null, { to: 90, lp: 900 }); this.tone('sawtooth', 165, t + 0.08, 0.45, 0.06, null, { to: 70, lp: 700 }); break;
        case 'hot': [67, 71, 74, 79].forEach((m, i) => this.tone('square', this.mtof(m), t + i * 0.06, 0.18, 0.05, null, { lp: 2500 })); break;
        case 'flip': this.noise(t, 0.05, 0.2, null, 'bandpass', 900, 3); this.tone('sine', 180, t, 0.08, 0.15, null, { to: 90 }); break;
        case 'whistle': [587, 740, 880].forEach((f) => this.tone('sawtooth', f, t, 0.9, 0.025, null, { a: 0.08, lp: 1800, vib: true })); this.noise(t, 0.9, 0.05, null, 'bandpass', 2400, 1.5); break;
        case 'cup': this.noise(t, 0.12, 0.15, null, 'lowpass', 500); this.tone('sine', 120, t, 0.12, 0.2, null, { to: 70 }); break;
        case 'call': this.tone('square', 392, t, 0.12, 0.06, null, { lp: 1500 }); this.tone('square', 311, t + 0.12, 0.25, 0.06, null, { lp: 1500 }); break;
        case 'bid': this.tone('triangle', 660, t, 0.08, 0.05); break;
        case 'lose-die': this.tone('sine', 300, t, 0.3, 0.12, null, { to: 120 }); this.click(t + 0.25, 0.2); break;
        case 'win': [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => this.tone('square', this.mtof(m), t + i * 0.08, 0.3, 0.05, null, { lp: 2400 })); this.play('whistle'); break;
        case 'lose': [67, 63, 60, 55].forEach((m, i) => this.tone('triangle', this.mtof(m), t + i * 0.18, 0.45, 0.08)); break;
        case 'move': this.tone('triangle', 1200, t, 0.03, 0.03); break;
        case 'confirm': this.click(t, 0.15); this.tone('triangle', 784, t, 0.1, 0.06); break;
        case 'back': this.tone('triangle', 523, t, 0.1, 0.06, null, { to: 392 }); break;
        case 'deny': this.tone('sawtooth', 140, t, 0.15, 0.06, null, { lp: 600 }); break;
      }
    },
    // banjo, bass and harmonica, with the paddle wheel turning underneath
    CH: [[55, 59, 62], [55, 59, 62], [60, 64, 67], [55, 59, 62], [62, 66, 69], [60, 64, 67], [55, 59, 62], [62, 66, 69]],
    HARP: [74, 0, 71, 0, 74, 76, 0, 0, 79, 0, 76, 74, 0, 71, 0, 0],
    update(on) {
      const c = this.ctx; if (!c || this.musicVol <= 0) return;
      const eighth = 60 / 104 / 2, M = this.music;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.3) {
        const t = this.next, s = this.step % 8, ch = this.CH[Math.floor(this.step / 8) % 8];
        // walking bass on the beats
        if (s % 2 === 0) this.tone('triangle', this.mtof(ch[[0, 2, 1, 2][s / 2]] - 24), t, eighth * 1.7, 0.13, M, { lp: 500 });
        // banjo roll
        const roll = [0, 1, 2, 1, 0, 2, 1, 2][s];
        this.tone('square', this.mtof(ch[roll] + 12), t, 0.16, 0.025, M, { lp: 3200 });
        this.tone('triangle', this.mtof(ch[roll] + 12), t, 0.25, 0.02, M);
        // harmonica on alternate phrases
        if (on && Math.floor(this.step / 16) % 2) { const h = this.HARP[this.step % 16]; if (h) this.tone('sawtooth', this.mtof(h), t, eighth * 1.8, 0.018, M, { a: 0.04, lp: 1600, vib: true }); }
        // paddle wheel: a soft swish every beat
        if (s % 2 === 0) this.noise(t, 0.3, 0.018, M, 'lowpass', 400, 0.7, 200);
        this.step++; this.next += eighth;
      }
    },
  };
  RD.Audio = A;
})();
