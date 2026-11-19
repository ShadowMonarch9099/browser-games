// Trio Teahouse sound: porcelain and strings. Picking a tile is a bright
// clink, setting it on a saucer a soft tock; serving three pours tea and rings
// a small bell, and runs of servings climb a plucked zither. The music is a
// slow zither melody with a breathy bamboo flute and a wood block.
(function () {
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
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
      const dl = c.createDelay(); dl.delayTime.value = 0.42; const fb = c.createGain(); fb.gain.value = 0.28;
      this.echo = c.createGain(); this.echo.gain.value = 0.3; this.echo.connect(dl); dl.connect(fb).connect(dl); dl.connect(master);
      this.apply(); this.next = c.currentTime + 0.1;
    },
    setVolumes(s, m) { this.sfxVol = s / 10; this.musicVol = m / 10; this.apply(); },
    apply() { if (!this.ctx) return; const t = this.ctx.currentTime; this.sfx.gain.setTargetAtTime(this.sfxVol, t, 0.02); this.music.gain.setTargetAtTime(this.musicVol * 0.5, t, 0.05); },
    mtof: (m) => 440 * Math.pow(2, (m - 69) / 12),
    tone(type, f, t, dur, vol, bus, o = {}) {
      const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
      if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5; lg.gain.value = f * 0.012; l.connect(lg).connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let out = g;
      if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; g.connect(fl); out = fl; }
      osc.connect(g); out.connect(bus || this.sfx); if (o.echo) out.connect(this.echo);
      osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(t, dur, vol, bus, type, freq, q, to) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    // a plucked zither string: a bright attack that mellows quickly
    pluck(m, t, vol, bus) {
      const f = this.mtof(m);
      this.tone('triangle', f, t, 1.2, vol, bus, { lp: 3000, echo: true });
      this.tone('sawtooth', f, t, 0.15, vol * 0.25, bus, { lp: 2000 });
      this.tone('sine', f * 2, t, 0.5, vol * 0.3, bus);
    },
    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      switch (name) {
        case 'pick': this.tone('triangle', 2600 + Math.random() * 300, t, 0.12, 0.06); this.tone('sine', 4100, t, 0.06, 0.03); break;
        case 'place': this.tone('sine', 520, t, 0.08, 0.1, null, { to: 380 }); this.noise(t, 0.03, 0.05, null, 'bandpass', 1800, 2); break;
        case 'blocked': this.tone('sine', 220, t, 0.1, 0.07, null, { to: 160 }); break;
        case 'serve': {
          this.noise(t, 0.5, 0.06, null, 'bandpass', 900, 1.5, 2400);
          const base = 62 + SCALE[Math.min(SCALE.length - 1, arg)];
          [0, 4, 7].forEach((d, i) => this.pluck(base + d, t + 0.1 + i * 0.06, 0.08));
          this.tone('sine', 2093, t + 0.25, 0.9, 0.04, null, { echo: true }); break;
        }
        case 'warn': this.tone('sine', 90, t, 0.35, 0.25, null, { to: 60 }); this.noise(t, 0.08, 0.1, null, 'lowpass', 300); break;
        case 'aside': [74, 71, 67].forEach((m, i) => this.pluck(m, t + i * 0.07, 0.07)); break;
        case 'undo': this.tone('triangle', 1200, t, 0.1, 0.05, null, { to: 700 }); break;
        case 'stir': for (let i = 0; i < 12; i++) this.tone('triangle', 1800 + Math.random() * 1600, t + i * 0.035, 0.06, 0.03); this.noise(t, 0.5, 0.05, null, 'bandpass', 1200, 1, 3000); break;
        case 'win': [62, 64, 67, 69, 74, 76, 79, 81].forEach((m, i) => this.pluck(m, t + i * 0.08, 0.08)); this.tone('sine', 98, t + 0.7, 2.5, 0.2, null, { lp: 400 }); this.tone('sine', 196.5, t + 0.7, 2, 0.06); break;
        case 'lose': [69, 67, 64, 62, 57].forEach((m, i) => this.pluck(m, t + i * 0.16, 0.08)); break;
        case 'star': this.tone('sine', this.mtof(84 + arg * 3), t, 0.7, 0.08, null, { echo: true }); break;
        case 'move': this.tone('triangle', 1900, t, 0.04, 0.03); break;
        case 'confirm': this.pluck(74, t, 0.07); this.pluck(79, t + 0.05, 0.06); break;
        case 'back': this.pluck(67, t, 0.06); break;
      }
    },
    // a slow pentatonic zither line over a drone, flute answering, wood block
    MEL: [12, 0, 9, 7, 0, 4, 7, 0, 9, 0, 12, 14, 0, 12, 9, 0, 7, 0, 4, 2, 0, 4, 7, 0, 2, 0, 0, 0, 0, 0, 0, 0],
    FLUTE: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 19, 0, 16, 0, 14, 0, 12, 0],
    update(on) {
      const c = this.ctx; if (!c || this.musicVol <= 0) return;
      const eighth = 60 / (on ? 84 : 72) / 2, M = this.music;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.3) {
        const t = this.next, s = this.step % 32, root = [62, 62, 57, 60][Math.floor(this.step / 32) % 4];
        if (s === 0 || s === 16) this.tone('triangle', this.mtof(root - 24), t, eighth * 15, 0.05, M, { a: 0.4, lp: 500 });
        const m = this.MEL[s]; if (m) this.pluck(root + m, t, 0.05, M);
        const f = this.FLUTE[s]; if (f) this.tone('sine', this.mtof(root + f), t, eighth * 1.9, 0.035, M, { a: 0.12, vib: true });
        if (on && s % 8 === 4) this.tone('sine', 800, t, 0.05, 0.03, M);
        this.step++; this.next += eighth;
      }
    },
  };
  TT.Audio = A;
})();
