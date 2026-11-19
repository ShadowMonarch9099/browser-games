// Tide Pool Pop sound: water and wood. Every pop is a droplet "bloop" that
// climbs the scale as a cascade goes on; waves whoosh; bubbles thump and fizz;
// pearls shimmer like a wind chime; stones crack; sand hisses away. The music
// is a slow kalimba pattern in a pentatonic scale over a soft sea-swell pad.
(function () {
  const PENT = [0, 2, 4, 7, 9];
  const A = {
    ctx: null, sfx: null, music: null, sfxVol: 0.8, musicVol: 0.5, next: 0, step: 0, bar: 0,
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
      // a soft echo for the kalimba
      const dl = c.createDelay(); dl.delayTime.value = 0.33; const fb = c.createGain(); fb.gain.value = 0.3;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      this.echo = c.createGain(); this.echo.gain.value = 0.35;
      this.echo.connect(dl); dl.connect(lp).connect(fb).connect(dl); lp.connect(this.music);
      this.apply(); this.next = c.currentTime + 0.1;
    },
    setVolumes(s, m) { this.sfxVol = s / 10; this.musicVol = m / 10; this.apply(); },
    apply() { if (!this.ctx) return; const t = this.ctx.currentTime; this.sfx.gain.setTargetAtTime(this.sfxVol, t, 0.02); this.music.gain.setTargetAtTime(this.musicVol * 0.5, t, 0.05); },
    mtof: (m) => 440 * Math.pow(2, (m - 69) / 12),
    tone(type, f, t, dur, vol, bus, o = {}) {
      const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let out = g;
      if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; g.connect(fl); out = fl; }
      osc.connect(g); out.connect(bus || this.sfx); if (o.echo && this.echo) out.connect(this.echo);
      osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(t, dur, vol, bus, type, freq, q, to) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    // a water droplet: a sine that jumps up in pitch very fast
    drop(t, f, vol) { this.tone('sine', f, t, 0.12, vol, null, { to: f * 2.2, glide: 0.06 }); },
    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      switch (name) {
        case 'pop': { const n = Math.min(10, arg), m = 72 + PENT[n % 5] + 12 * Math.floor(n / 5); this.drop(t, this.mtof(m), 0.14); this.drop(t + 0.04, this.mtof(m + 7), 0.06); break; }
        case 'select': this.drop(t, 900, 0.06); break;
        case 'swap': this.noise(t, 0.12, 0.05, null, 'bandpass', 1200, 1.5, 2400); break;
        case 'nope': this.tone('sine', 300, t, 0.12, 0.08, null, { to: 180 }); this.tone('sine', 280, t + 0.1, 0.14, 0.06, null, { to: 160 }); break;
        case 'wave': this.noise(t, 0.6, 0.18, null, 'bandpass', 400, 0.8, 3000); this.noise(t + 0.15, 0.6, 0.1, null, 'highpass', 3000); break;
        case 'bubble': this.tone('sine', 110, t, 0.35, 0.3, null, { to: 50 }); for (let i = 0; i < 8; i++) this.drop(t + 0.05 + i * 0.03, 600 + Math.random() * 1400, 0.04); break;
        case 'pearl': [84, 88, 91, 96, 100].forEach((m, i) => this.tone('sine', this.mtof(m), t + i * 0.05, 0.9, 0.06, null, { echo: true })); break;
        case 'made': [79, 86].forEach((m, i) => this.tone('triangle', this.mtof(m), t + i * 0.06, 0.3, 0.07, null, { echo: true })); break;
        case 'crack': this.noise(t, 0.06, 0.25, null, 'bandpass', 2200, 4); this.noise(t + 0.03, 0.1, 0.12, null, 'bandpass', 900, 3); break;
        case 'sand': this.noise(t, 0.25, 0.05, null, 'highpass', 4000); break;
        case 'shuffle': for (let i = 0; i < 10; i++) this.drop(t + i * 0.04, 500 + i * 90, 0.05); break;
        case 'win': [72, 76, 79, 84, 88, 91].forEach((m, i) => this.tone('triangle', this.mtof(m), t + i * 0.09, 0.6, 0.09, null, { echo: true })); break;
        case 'star': this.tone('sine', this.mtof(88 + arg * 4), t, 0.5, 0.1, null, { echo: true }); this.tone('triangle', this.mtof(95 + arg * 4), t + 0.03, 0.3, 0.04); break;
        case 'lose': [67, 64, 60, 55].forEach((m, i) => this.tone('sine', this.mtof(m), t + i * 0.16, 0.5, 0.08)); this.noise(t, 1.2, 0.08, null, 'lowpass', 600, 0.5, 200); break;
        case 'low': this.tone('sine', 520, t, 0.1, 0.06); this.tone('sine', 520, t + 0.15, 0.1, 0.06); break;
        case 'move': this.drop(t, 1400, 0.03); break;
        case 'confirm': this.drop(t, 700, 0.08); this.drop(t + 0.05, 1050, 0.07); break;
        case 'back': this.tone('sine', 600, t, 0.12, 0.07, null, { to: 380 }); break;
      }
    },
    // kalimba over a sea swell
    CH: [[57, 64], [53, 60], [55, 62], [52, 59]],
    update(on) {
      const c = this.ctx; if (!c || this.musicVol <= 0) return;
      const eighth = 60 / (on ? 92 : 80) / 2, M = this.music;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.3) {
        const t = this.next, s = this.step % 16, ch = this.CH[Math.floor(this.step / 16) % 4];
        if (s === 0) {
          ch.forEach((m) => this.tone('sine', this.mtof(m - 12), t, eighth * 15, 0.05, M, { a: 0.8, lp: 700 }));
          this.noise(t, eighth * 12, 0.03, M, 'lowpass', 500, 0.7, 300);
        }
        // the kalimba: a fixed pentatonic pattern that shifts with the chord
        const pat = [0, -1, 2, -1, 1, 3, -1, 2, 0, -1, 4, 2, -1, 1, -1, 3][s];
        if (pat >= 0) {
          const root = ch[0] + 12, m = root + PENT[pat];
          this.tone('sine', this.mtof(m), t, 0.6, 0.05, M, { echo: true });
          this.tone('sine', this.mtof(m) * 3.01, t, 0.08, 0.008, M);
        }
        if (on && s % 4 === 2) this.noise(t, 0.05, 0.015, M, 'highpass', 6000);
        this.step++; this.next += eighth;
      }
    },
  };
  TP.Audio = A;
})();
