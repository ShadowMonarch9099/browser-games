// Puck Scuffle sound: a 70s arcade parlour. A clavinet-and-organ funk groove,
// the hiss of the table's air, hard plastic clacks for hits, rail thunks, a
// goal buzzer, a crowd swell and LED beeps for the scoreboard.
(function () {
  const A = {
    ctx: null, sfx: null, music: null, sfxVol: 0.8, musicVol: 0.5, next: 0, step: 0, air: null, hype: 0,
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = (this.ctx = new AC()), master = c.createGain(); master.gain.value = 0.7;
      master.connect(c.createDynamicsCompressor()).connect(c.destination);
      this.sfx = c.createGain(); this.sfx.connect(master);
      this.music = c.createGain(); this.music.connect(master);
      const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = n;
      // the table's air: a soft, steady hiss while a match is on
      const s = c.createBufferSource(); s.buffer = n; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 0.6;
      this.air = c.createGain(); this.air.gain.value = 0;
      s.connect(f).connect(this.air).connect(this.sfx); s.start();
      this.apply(); this.next = c.currentTime + 0.1;
    },
    setVolumes(s, m) { this.sfxVol = s / 10; this.musicVol = m / 10; this.apply(); },
    apply() { if (!this.ctx) return; const t = this.ctx.currentTime; this.sfx.gain.setTargetAtTime(this.sfxVol, t, 0.02); this.music.gain.setTargetAtTime(this.musicVol * 0.4, t, 0.05); },
    setAir(on) { if (this.air) this.air.gain.setTargetAtTime(on ? 0.035 : 0, this.ctx.currentTime, 0.3); },
    mtof: (m) => 440 * Math.pow(2, (m - 69) / 12),
    tone(type, f, t, dur, vol, bus, o = {}) {
      const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let out = g;
      if (o.lp || o.bp) { const fl = c.createBiquadFilter(); fl.type = o.bp ? 'bandpass' : 'lowpass'; fl.frequency.value = o.bp || o.lp; if (o.q) fl.Q.value = o.q; g.connect(fl); out = fl; }
      osc.connect(g); out.connect(bus || this.sfx); osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(t, dur, vol, bus, type, freq, q) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      switch (name) {
        case 'hit': { const p = Math.min(1, arg / 3); this.noise(t, 0.04, 0.25 + p * 0.3, null, 'bandpass', 2400 + p * 2000, 3); this.tone('square', 900 + p * 500, t, 0.03, 0.05 + p * 0.06, null, { lp: 3000 }); break; }
        case 'wall': this.noise(t, 0.05, 0.18, null, 'lowpass', 700); this.tone('sine', 140, t, 0.08, 0.15, null, { to: 90 }); break;
        case 'goal': this.tone('sawtooth', 220, t, 0.9, 0.12, null, { lp: 1200 }); this.tone('sawtooth', 223, t, 0.9, 0.12, null, { lp: 1200 }); this.noise(t + 0.1, 1.4, 0.12, null, 'bandpass', 900, 0.5); break;
        case 'token': [76, 81, 88].forEach((m, i) => this.tone('triangle', this.mtof(m), t + i * 0.05, 0.2, 0.12)); break;
        case 'tokenAppear': this.tone('sine', 1320, t, 0.12, 0.06); this.tone('sine', 1760, t + 0.08, 0.12, 0.05); break;
        case 'led': this.tone('square', 1800, t, 0.05, 0.05, null, { lp: 4000 }); break;
        case 'win': [60, 64, 67, 72, 67, 72, 76].forEach((m, i) => this.tone('sawtooth', this.mtof(m), t + i * 0.1, 0.32, 0.06, null, { lp: 2400 })); this.noise(t, 2, 0.14, null, 'bandpass', 1100, 0.4); break;
        case 'serve': this.tone('sine', 660, t, 0.08, 0.08); break;
        case 'move': this.tone('square', 1500, t, 0.03, 0.03, null, { lp: 3000 }); break;
        case 'confirm': this.noise(t, 0.05, 0.2, null, 'bandpass', 2000, 2); this.tone('square', 660, t, 0.06, 0.05, null, { lp: 2400 }); break;
        case 'back': this.tone('square', 440, t, 0.06, 0.05, null, { lp: 2000 }); break;
        case 'deny': this.tone('sawtooth', 120, t, 0.15, 0.06, null, { lp: 700 }); break;
      }
    },
    // A funky parlour groove: clav stabs, organ pads, bass and a tight kit.
    CH: [[48, 55, 58, 63], [53, 57, 60, 63], [48, 55, 58, 63], [55, 59, 62, 65]],
    BASS: [36, 36, 48, 36, 0, 39, 41, 0, 36, 0, 48, 46, 43, 0, 41, 39],
    update(playing) {
      const c = this.ctx; if (!c || this.musicVol <= 0) return;
      const six = 60 / (playing ? 108 : 96) / 4, M = this.music;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.25) {
        const t = this.next, s = this.step % 16, bar = Math.floor(this.step / 16) % 4, ch = this.CH[bar];
        const b = this.BASS[s]; if (b) this.tone('sawtooth', this.mtof(b + (bar === 3 ? 7 : bar === 1 ? 5 : 0)), t, six * 1.4, 0.13, M, { lp: 500 });
        if (s === 0 || s === 8) this.tone('sine', 100, t, 0.2, 0.32, M, { to: 45, glide: 0.12 });
        if (s === 4 || s === 12) this.noise(t, 0.14, 0.13, M, 'bandpass', 1800, 0.8);
        if (s % 2 === 1) this.noise(t, 0.03, 0.04, M, 'highpass', 8000);
        if ([2, 6, 7, 10, 14].includes(s)) ch.forEach((m) => this.tone('square', this.mtof(m + 12), t, six * 0.6, 0.012, M, { bp: 1400, q: 2 }));
        if (s === 0) ch.forEach((m) => this.tone('triangle', this.mtof(m), t, six * 15, 0.018, M, { a: 0.1, lp: 1200 }));
        if (playing && this.hype > 0.5 && s % 4 === 3) this.tone('square', this.mtof(ch[3] + 24), t, six, 0.02, M, { lp: 3000 });
        this.step++; this.next += six;
      }
    },
  };
  PS.Audio = A;
})();
