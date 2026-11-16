// Paper Trail sound: a quiet desk at midnight. Pencil scratches that climb a
// scale as the line grows, a rubber squeak for erasing, paper crinkles for
// folds, a swoosh for turning the page, a rubber-stamp thump, and a slow
// music-box lullaby over soft vinyl crackle.
(function () {
  const PENTA = [0, 2, 4, 7, 9];
  const A = {
    ctx: null, sfx: null, music: null, sfxVol: 0.7, musicVol: 0.5, next: 0, step: 0,
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = (this.ctx = new AC()), master = c.createGain(); master.gain.value = 0.75;
      master.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.connect(master);
      this.music = c.createGain(); this.music.connect(master);
      const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = n;
      this.apply(); this.next = c.currentTime + 0.1;
    },
    setVolumes(s, m) { this.sfxVol = s / 10; this.musicVol = m / 10; this.apply(); },
    apply() { if (!this.ctx) return; const t = this.ctx.currentTime; this.sfx.gain.setTargetAtTime(this.sfxVol, t, 0.02); this.music.gain.setTargetAtTime(this.musicVol * 0.5, t, 0.05); },
    mtof: (m) => 440 * Math.pow(2, (m - 69) / 12),
    tone(type, f, t, dur, vol, bus, o = {}) {
      const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let out = g;
      if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; g.connect(fl); out = fl; }
      osc.connect(g); out.connect(bus || this.sfx); osc.start(t); osc.stop(t + dur + 0.05);
    },
    // a music-box tine: a sine with a bright, quickly fading overtone
    tine(m, t, vol, bus, dur = 1.4) { this.tone('sine', this.mtof(m), t, dur, vol, bus); this.tone('sine', this.mtof(m) * 4.02, t, dur * 0.15, vol * 0.25, bus); },
    noise(t, dur, vol, bus, type, freq, q, to) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      switch (name) {
        case 'step': { // pencil scratch + a soft note that climbs with the line
          this.noise(t, 0.08, 0.16, null, 'bandpass', 3800 + Math.random() * 1200, 1.4);
          const m = 72 + PENTA[arg % 5] + 12 * Math.floor(arg / 5) % 24;
          this.tine(Math.min(100, m), t, 0.07, null, 0.5);
          break;
        }
        case 'erase': this.noise(t, 0.14, 0.14, null, 'bandpass', 900, 3, 600); this.tone('sine', 330, t, 0.12, 0.05, null, { to: 240 }); break;
        case 'fold': for (let i = 0; i < 7; i++) this.noise(t + Math.random() * 0.22, 0.04, 0.12, null, 'highpass', 2200 + Math.random() * 3000); this.tone('sine', 140, t, 0.25, 0.12, null, { to: 80 }); break;
        case 'unfold': for (let i = 0; i < 5; i++) this.noise(t + Math.random() * 0.18, 0.035, 0.09, null, 'highpass', 3000 + Math.random() * 2000); this.tone('sine', 90, t, 0.2, 0.08, null, { to: 150 }); break;
        case 'turn': this.noise(t, 0.5, 0.16, null, 'bandpass', 500, 0.8, 3200); break;
        case 'stamp': this.tone('sine', 110, t, 0.25, 0.4, null, { to: 45 }); this.noise(t, 0.08, 0.2, null, 'lowpass', 800); break;
        case 'win': [72, 76, 79, 84, 88, 91].forEach((m, i) => this.tine(m, t + i * 0.09, 0.12, null, 1.6)); break;
        case 'hint': this.tine(84, t, 0.1); this.tine(91, t + 0.12, 0.08); break;
        case 'deny': this.tone('triangle', 150, t, 0.16, 0.12, null, { to: 110, lp: 600 }); break;
        case 'move': this.noise(t, 0.03, 0.08, null, 'bandpass', 4200, 2); break;
        case 'confirm': this.noise(t, 0.12, 0.12, null, 'bandpass', 1200, 1, 3000); this.tine(79, t, 0.06, null, 0.4); break;
        case 'back': this.noise(t, 0.1, 0.1, null, 'bandpass', 2600, 1, 900); break;
      }
    },
    // Lullaby: four slow chords, arpeggiated on a music box, a felt bass and crackle.
    CH: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
    update(on) {
      const c = this.ctx; if (!c || this.musicVol <= 0) return;
      const eighth = 60 / 72 / 2, M = this.music;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.3) {
        const t = this.next, s = this.step % 8, ch = this.CH[Math.floor(this.step / 8) % 4];
        if (s === 0) { this.tone('triangle', this.mtof(ch[0] - 12), t, eighth * 7, 0.06, M, { a: 0.08, lp: 500 }); }
        const order = [0, 2, 1, 3, 2, 1, 3, 2];
        if (on || s % 2 === 0) this.tine(ch[order[s]] + 12 + (s === 3 && this.step % 16 > 8 ? 12 : 0), t, s === 0 ? 0.05 : 0.035, M, 1.8);
        if (Math.random() < 0.6) this.noise(t + Math.random() * eighth, 0.012, 0.015, M, 'highpass', 5000);
        this.step++; this.next += eighth;
      }
    },
  };
  PT.Audio = A;
})();
