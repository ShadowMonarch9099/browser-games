// Pocket Realm sound: a candlelit tavern table. Wooden clacks as lands are
// set down, a lute and recorder playing a Dorian tune, a frame drum that takes
// over in fights, sword clashes, coins, bubbling potions, a brass fanfare for
// a new level and a dragon's roar at the keep.
(function () {
  const A = {
    ctx: null, sfx: null, music: null, sfxVol: 0.8, musicVol: 0.5, next: 0, step: 0, fight: false,
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
      if (o.detune) osc.detune.value = o.detune;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let out = g;
      if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; if (o.q) fl.Q.value = o.q; g.connect(fl); out = fl; }
      osc.connect(g); out.connect(bus || this.sfx); osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(t, dur, vol, bus, type, freq, q, to) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    // a plucked lute string: two slightly detuned triangles through a closing filter
    pluck(m, t, vol, bus, dur = 0.9) { this.tone('triangle', this.mtof(m), t, dur, vol, bus, { lp: 2400 }); this.tone('sawtooth', this.mtof(m), t, dur * 0.4, vol * 0.25, bus, { lp: 1600, detune: 7 }); },
    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      switch (name) {
        case 'place': this.noise(t, 0.06, 0.25, null, 'bandpass', 900, 2); this.tone('sine', 150, t, 0.18, 0.25, null, { to: 70 }); this.pluck(62 + (arg % 5) * 2, t + 0.05, 0.06); break;
        case 'walk': this.noise(t, 0.05, 0.12, null, 'lowpass', 700); this.noise(t + 0.12, 0.05, 0.1, null, 'lowpass', 600); break;
        case 'pick': this.pluck(69 + arg * 5, t, 0.08, null, 0.4); break;
        case 'combo': [62, 66, 69, 74].forEach((m, i) => this.pluck(m + 12, t + i * 0.06, 0.08)); break;
        case 'foe': this.tone('sine', 90, t, 0.4, 0.3, null, { to: 55 }); this.noise(t, 0.3, 0.12, null, 'lowpass', 500); break;
        case 'roar': this.noise(t, 1.4, 0.4, null, 'bandpass', 300, 1, 120); this.tone('sawtooth', 70, t, 1.3, 0.18, null, { to: 45, lp: 500 }); break;
        case 'clash': this.noise(t, 0.12, 0.3, null, 'highpass', 3000); this.tone('square', 1900 + Math.random() * 300, t, 0.25, 0.05, null, { lp: 6000 }); this.tone('sine', 2800, t, 0.4, 0.03); break;
        case 'hurt': this.tone('sine', 160, t, 0.2, 0.3, null, { to: 70 }); this.noise(t, 0.12, 0.15, null, 'lowpass', 800); break;
        case 'slay': this.noise(t, 0.25, 0.2, null, 'bandpass', 1500, 1, 400); [67, 71, 74].forEach((m, i) => this.pluck(m, t + 0.12 + i * 0.08, 0.08)); break;
        case 'coin': this.tone('sine', 1975, t, 0.25, 0.07); this.tone('sine', 2637, t + 0.06, 0.3, 0.06); break;
        case 'potion': for (let i = 0; i < 5; i++) this.tone('sine', 300 + Math.random() * 400, t + i * 0.05, 0.08, 0.07, null, { to: 700 + Math.random() * 300 }); break;
        case 'heal': [74, 78, 81].forEach((m, i) => this.tone('sine', this.mtof(m + 12), t + i * 0.07, 0.5, 0.04)); break;
        case 'level': [60, 64, 67, 72].forEach((m, i) => this.tone('sawtooth', this.mtof(m), t + i * 0.11, i === 3 ? 0.7 : 0.2, 0.08, null, { lp: 1800 })); break;
        case 'flee': this.noise(t, 0.3, 0.15, null, 'bandpass', 2000, 1, 600); break;
        case 'buy': this.play('coin'); this.noise(t + 0.05, 0.05, 0.1, null, 'bandpass', 1200, 3); break;
        case 'win': [62, 66, 69, 74, 69, 74, 78].forEach((m, i) => this.tone('sawtooth', this.mtof(m), t + i * 0.14, i === 6 ? 1.4 : 0.3, 0.08, null, { lp: 2000 })); break;
        case 'lose': [69, 67, 65, 62].forEach((m, i) => this.pluck(m - 12, t + i * 0.32, 0.1, null, 1.4)); break;
        case 'move': this.pluck(74, t, 0.04, null, 0.25); break;
        case 'confirm': this.pluck(69, t, 0.07, null, 0.5); this.pluck(74, t + 0.06, 0.06, null, 0.5); break;
        case 'back': this.pluck(66, t, 0.06, null, 0.4); break;
        case 'deny': this.tone('triangle', 150, t, 0.18, 0.1, null, { lp: 600 }); break;
      }
    },
    // D Dorian: lute arpeggios with a recorder line; in fights a frame drum and low drone
    CH: [[50, 57, 62, 65], [48, 55, 60, 64], [50, 57, 62, 65], [45, 52, 57, 60]],
    MEL: [74, 0, 72, 74, 76, 0, 74, 72, 69, 0, 72, 0, 74, 0, 0, 0, 77, 0, 76, 74, 72, 0, 74, 0, 69, 0, 67, 69, 62, 0, 0, 0],
    update(on) {
      const c = this.ctx; if (!c || this.musicVol <= 0) return;
      const eighth = 60 / (this.fight ? 104 : 88) / 2, M = this.music;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.3) {
        const t = this.next, s = this.step % 8, ch = this.CH[Math.floor(this.step / 8) % 4];
        if (this.fight) {
          if (s === 0 || s === 3 || s === 6) this.tone('sine', s === 0 ? 95 : 120, t, 0.25, s === 0 ? 0.3 : 0.18, M, { to: 50 });
          if (s % 2 === 1) this.noise(t, 0.06, 0.05, M, 'bandpass', 2500, 2);
          if (s === 0) this.tone('sawtooth', this.mtof(ch[0] - 12), t, eighth * 8, 0.035, M, { lp: 400, a: 0.2 });
          if (s === 4) this.pluck(ch[2], t, 0.05, M, 0.3);
        } else {
          const order = [0, 2, 1, 3, 2, 1, 3, 2];
          this.pluck(ch[order[s]], t, s === 0 ? 0.06 : 0.04, M, 1.1);
          const mel = this.MEL[this.step % 32];
          if (on && mel) this.tone('sine', this.mtof(mel), t, eighth * 1.6, 0.035, M, { a: 0.04 });
        }
        this.step++; this.next += eighth;
      }
    },
  };
  PR.Audio = A;
})();
