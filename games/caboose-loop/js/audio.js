// Caboose Loop sound: a toy railway in full steam. Every square the engine
// moves is a chuff; passengers are greeted with a two-note whistle; stations
// ring a bell; a wreck clatters like a tipped box of blocks. The music is a
// jaunty stride-piano tune with a brushed "clickety-clack" underneath.
(function () {
  const A = {
    ctx: null, sfx: null, music: null, sfxVol: 0.8, musicVol: 0.5, next: 0, step: 0, chuff: 0, tempo: 1,
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
      if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 7; lg.gain.value = f * 0.01; l.connect(lg).connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let out = g;
      if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; g.connect(fl); out = fl; }
      osc.connect(g); out.connect(bus || this.sfx); osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(t, dur, vol, bus, type, freq, q, to) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.006, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      switch (name) {
        case 'chuff': this.chuff = (this.chuff + 1) % 4; this.noise(t, 0.09, this.chuff === 0 ? 0.09 : 0.05, null, 'bandpass', this.chuff % 2 ? 900 : 650, 1.2, 300); break;
        case 'whistle': [880, 1108].forEach((f) => this.tone('sine', f, t, 0.35, 0.06, null, { a: 0.03, vib: true })); this.noise(t, 0.3, 0.03, null, 'bandpass', 2500, 2); break;
        case 'golden': [1318, 1568, 2093].forEach((f, i) => this.tone('triangle', f, t + i * 0.06, 0.3, 0.07)); break;
        case 'bell': for (let i = 0; i < Math.min(5, arg + 1); i++) { this.tone('sine', 1760, t + i * 0.13, 0.5, 0.08); this.tone('sine', 4400, t + i * 0.13, 0.12, 0.02); } break;
        case 'crash': for (let i = 0; i < 9; i++) this.noise(t + i * 0.04 + Math.random() * 0.03, 0.05, 0.25, null, 'bandpass', 600 + Math.random() * 1600, 3); this.tone('sine', 110, t, 0.4, 0.3, null, { to: 45 }); break;
        case 'turn': this.tone('square', 1500, t, 0.02, 0.015, null, { lp: 3000 }); break;
        case 'count': this.tone('sine', arg ? 1046 : 784, t, arg ? 0.5 : 0.18, 0.1); break;
        case 'win': [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => this.tone('triangle', this.mtof(m), t + i * 0.1, 0.3, 0.09)); break;
        case 'move': this.tone('square', 1200, t, 0.03, 0.03, null, { lp: 2400 }); break;
        case 'confirm': this.tone('triangle', 660, t, 0.08, 0.08); this.tone('triangle', 990, t + 0.05, 0.1, 0.07); break;
        case 'back': this.tone('triangle', 520, t, 0.1, 0.07, null, { to: 390 }); break;
        case 'deny': this.tone('sawtooth', 150, t, 0.15, 0.06, null, { lp: 600 }); break;
      }
    },
    // stride piano: bass on the beat, chords on the off-beat, a little tune on top
    CH: [[48, 60, 64, 67], [53, 60, 65, 69], [55, 59, 62, 67], [48, 60, 64, 67]],
    MEL: [76, 0, 79, 76, 74, 0, 72, 0, 77, 0, 76, 74, 72, 0, 0, 0, 74, 0, 76, 77, 79, 0, 74, 0, 76, 0, 72, 0, 72, 0, 0, 0],
    update(on) {
      const c = this.ctx; if (!c || this.musicVol <= 0) return;
      const eighth = 60 / (on ? 132 * this.tempo : 116) / 2, M = this.music;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.3) {
        const t = this.next, s = this.step % 8, ch = this.CH[Math.floor(this.step / 8) % 4];
        if (s === 0 || s === 4) this.tone('triangle', this.mtof(ch[0] - (s === 4 ? 5 : 0)), t, eighth * 1.6, 0.12, M, { lp: 900 });
        if (s === 2 || s === 6) ch.slice(1).forEach((m) => this.tone('triangle', this.mtof(m), t, eighth * 1.2, 0.035, M, { lp: 2500 }));
        if (on) this.noise(t, 0.04, s % 2 ? 0.02 : 0.035, M, 'highpass', 5000);
        const mel = this.MEL[this.step % 32];
        if (mel) this.tone('square', this.mtof(mel), t, eighth * 0.9, 0.025, M, { lp: 2800 });
        this.step++; this.next += eighth;
      }
    },
  };
  CL.Audio = A;
})();
