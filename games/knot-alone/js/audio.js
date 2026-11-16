// Knot Alone sound: mountain air. Wind that rises as you climb, snow crunching
// under boots, a carabiner's clink when you anchor, a ratchet for reeling, a
// rope creak when it pulls tight, and an alphorn and bell at the summit.
// The music is a slow folk tune: plucked strings and a breathy flute.
(function () {
  const A = {
    ctx: null, sfx: null, music: null, sfxVol: 0.8, musicVol: 0.5, next: 0, step: 0, wind: null, windF: null,
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
      const s = c.createBufferSource(); s.buffer = n; s.loop = true;
      this.windF = c.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 500; this.windF.Q.value = 0.7;
      this.wind = c.createGain(); this.wind.gain.value = 0;
      s.connect(this.windF).connect(this.wind).connect(this.sfx); s.start();
      this.apply(); this.next = c.currentTime + 0.1;
    },
    setVolumes(s, m) { this.sfxVol = s / 10; this.musicVol = m / 10; this.apply(); },
    apply() { if (!this.ctx) return; const t = this.ctx.currentTime; this.sfx.gain.setTargetAtTime(this.sfxVol, t, 0.02); this.music.gain.setTargetAtTime(this.musicVol * 0.45, t, 0.05); },
    // wind grows with altitude (0..1) and gusts on its own
    setWind(level, on) {
      if (!this.wind) return;
      const t = this.ctx.currentTime, gust = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.83);
      this.wind.gain.setTargetAtTime(on ? 0.015 + level * 0.04 * (0.5 + gust) : 0.008, t, 0.4);
      this.windF.frequency.setTargetAtTime(350 + level * 500 + gust * 300, t, 0.4);
    },
    mtof: (m) => 440 * Math.pow(2, (m - 69) / 12),
    tone(type, f, t, dur, vol, bus, o = {}) {
      const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
      if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5; lg.gain.value = f * 0.012; l.connect(lg).connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.006)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let out = g;
      if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; g.connect(fl); out = fl; }
      osc.connect(g); out.connect(bus || this.sfx); osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(t, dur, vol, bus, type, freq, q, to) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      switch (name) {
        case 'jump': this.noise(t, 0.08, 0.12, null, 'bandpass', 1400, 1.5); this.tone('triangle', arg ? 330 : 280, t, 0.12, 0.08, null, { to: arg ? 440 : 380 }); break;
        case 'land': this.noise(t, 0.12, 0.08 + Math.min(0.2, arg * 0.05), null, 'lowpass', 1200); this.noise(t + 0.02, 0.06, 0.06, null, 'highpass', 4000); break;
        case 'thud': this.tone('sine', 120, t, 0.35, 0.35, null, { to: 45 }); this.noise(t, 0.3, 0.25, null, 'lowpass', 600); break;
        case 'head': this.tone('square', 520, t, 0.08, 0.05, null, { lp: 1500 }); this.tone('square', 780, t + 0.06, 0.08, 0.05, null, { lp: 1500 }); break;
        case 'anchor': this.tone('sine', 2400, t, 0.12, 0.08); this.tone('sine', 3150, t + 0.03, 0.15, 0.06); this.noise(t, 0.03, 0.12, null, 'highpass', 6000); break;
        case 'release': this.tone('sine', 1900, t, 0.08, 0.05); break;
        case 'reel': this.noise(t, 0.025, 0.1, null, 'bandpass', arg < 0 ? 3200 : 2200, 4); break;
        case 'taut': this.tone('sawtooth', 95, t, 0.18, 0.06, null, { to: 70, lp: 600 }); this.noise(t, 0.15, 0.06, null, 'bandpass', 700, 3); break;
        case 'win': {
          this.tone('sawtooth', this.mtof(53), t, 1.6, 0.08, null, { lp: 900, a: 0.15, vib: true });
          this.tone('sawtooth', this.mtof(60), t + 0.5, 1.4, 0.07, null, { lp: 900, a: 0.12, vib: true });
          [84, 88, 91, 96].forEach((m, i) => { this.tone('sine', this.mtof(m), t + 0.9 + i * 0.16, 1.4, 0.06); this.tone('sine', this.mtof(m) * 2.76, t + 0.9 + i * 0.16, 0.5, 0.015); });
          break;
        }
        case 'swap': this.tone('triangle', 660, t, 0.08, 0.07); this.tone('triangle', 990, t + 0.06, 0.1, 0.06); break;
        case 'move': this.tone('triangle', 900, t, 0.04, 0.04); break;
        case 'confirm': this.tone('sine', 2400, t, 0.1, 0.06); this.tone('triangle', 660, t, 0.12, 0.08); break;
        case 'back': this.tone('triangle', 440, t, 0.1, 0.06, null, { to: 330 }); break;
        case 'deny': this.tone('triangle', 160, t, 0.15, 0.08); break;
      }
    },
    // A slow alpine folk tune in D: plucked arpeggios, a felt drone, a flute line
    CH: [[50, 57, 62, 66], [55, 59, 62, 67], [47, 54, 59, 62], [57, 61, 64, 69]],
    MEL: [74, 0, 76, 78, 0, 76, 74, 0, 71, 0, 74, 0, 76, 0, 0, 0],
    update(on) {
      const c = this.ctx; if (!c || this.musicVol <= 0) return;
      const eighth = 60 / 84 / 2, M = this.music;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.3) {
        const t = this.next, s = this.step % 8, bar = Math.floor(this.step / 8) % 4, ch = this.CH[bar];
        const order = [0, 1, 2, 3, 2, 1, 2, 3];
        this.tone('triangle', this.mtof(ch[order[s]]), t, eighth * 2.2, 0.05, M, { lp: 2200 });
        if (s === 0) this.tone('sine', this.mtof(ch[0] - 12), t, eighth * 7.5, 0.07, M, { a: 0.1 });
        const mel = this.MEL[this.step % 16];
        if (on && mel && Math.floor(this.step / 16) % 2 === 1) this.tone('sine', this.mtof(mel), t, eighth * 1.8, 0.04, M, { a: 0.05, vib: true });
        this.step++; this.next += eighth;
      }
    },
  };
  KA.Audio = A;
})();
