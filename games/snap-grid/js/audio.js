// Snap Grid sound: chunky arcade synth effects (square/saw bleeps, a punchy
// drop thump, rising chip arpeggios for clears) and a night-drive synthwave
// loop: pulsing saw bass, a delayed square arpeggio, gated pads and a drum
// machine. The filter opens as the board fills. WebAudio only, no files.
(function () {
  const A = {
    ctx: null, sfx: null, music: null, delay: null,
    sfxVol: 0.8, musicVol: 0.6,
    mood: 'menu', fill: 0, streak: 0,
    next: 0, step: 0,

    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      const master = c.createGain();
      master.gain.value = 0.6;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp).connect(c.destination);
      this.sfx = c.createGain();
      this.music = c.createGain();
      this.sfx.connect(master);
      // music: through a master lowpass that opens with tension
      this.musicFilter = c.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 1800;
      this.musicFilter.Q.value = 0.8;
      this.music.connect(this.musicFilter).connect(master);
      // feedback echo for the arpeggio
      this.delay = c.createDelay(1);
      this.delay.delayTime.value = (60 / 104) * 0.75;
      const fb = c.createGain();
      fb.gain.value = 0.38;
      const dl = c.createBiquadFilter();
      dl.type = 'lowpass';
      dl.frequency.value = 2400;
      this.delay.connect(dl).connect(fb).connect(this.delay);
      dl.connect(this.music);
      this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.apply();
      this.next = c.currentTime + 0.1;
    },
    setVolumes(sfx, music) { this.sfxVol = sfx / 10; this.musicVol = music / 10; this.apply(); },
    apply() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.sfx.gain.setTargetAtTime(this.sfxVol, t, 0.02);
      this.music.gain.setTargetAtTime(this.musicVol * 0.5, t, 0.05);
    },

    tone(type, f, t, dur, vol, bus, o = {}) {
      const c = this.ctx;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
      if (o.detune) osc.detune.value = o.detune;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.003));
      if (o.hold) g.gain.setValueAtTime(vol, t + o.hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = g;
      osc.connect(g);
      if (o.lp) {
        const f2 = this.ctx.createBiquadFilter();
        f2.type = 'lowpass';
        f2.frequency.setValueAtTime(o.lp, t);
        if (o.lpTo) f2.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur);
        f2.Q.value = o.q || 1;
        g.connect(f2);
        node = f2;
      }
      node.connect(bus);
      if (o.echo) node.connect(this.delay);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },
    noise(t, dur, vol, bus, type, freq, q = 1) {
      const c = this.ctx;
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus);
      s.start(t, Math.random() * 0.5, dur + 0.05);
    },

    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      const S = this.sfx;
      switch (name) {
        case 'grab':
          this.tone('square', 440, t, 0.07, 0.05, S, { to: 880, glide: 0.05 });
          break;
        case 'drop':
          // punchy thump + a hard click
          this.tone('sine', 150, t, 0.16, 0.35, S, { to: 48, glide: 0.12 });
          this.noise(t, 0.04, 0.12, S, 'highpass', 3000);
          this.tone('square', 220 + arg * 30, t, 0.05, 0.04, S);
          break;
        case 'bounce':
          this.tone('square', 180, t, 0.12, 0.06, S, { to: 90 });
          this.tone('square', 190, t + 0.05, 0.12, 0.05, S, { to: 95 });
          break;
        case 'clear': {
          // arg = lines; climbs higher with the streak
          const base = 523.25 * Math.pow(2, Math.min(this.streak, 6) / 12);
          const n = 3 + arg * 2;
          for (let i = 0; i < n; i++) this.tone('square', base * Math.pow(2, [0, 4, 7, 12, 16, 19, 24, 28, 31][i % 9] / 12), t + i * 0.045, 0.12, 0.05, S, { echo: true });
          this.noise(t, 0.35, 0.08, S, 'bandpass', 5000, 0.7);
          this.tone('sawtooth', 110, t, 0.4, 0.08, S, { lp: 200, lpTo: 3000, q: 8 });
          break;
        }
        case 'gold':
          [1318.5, 1760, 2637].forEach((f, i) => this.tone('triangle', f, t + 0.12 + i * 0.06, 0.4, 0.06, S, { echo: true }));
          this.tone('square', 2093, t + 0.1, 0.08, 0.04, S);
          break;
        case 'deal':
          [0, 1, 2].forEach((i) => this.tone('square', 660 + i * 110, t + i * 0.05, 0.04, 0.03, S));
          break;
        case 'over':
          this.tone('sawtooth', 440, t, 1.4, 0.12, S, { to: 55, glide: 1.3, lp: 3000, lpTo: 200 });
          this.tone('square', 220, t + 0.1, 1.2, 0.05, S, { to: 40, glide: 1.1 });
          break;
        case 'hiscore':
          [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone('square', f, t + i * 0.09, 0.22, 0.05, S, { echo: true }));
          break;
        case 'hint':
          this.tone('triangle', 988, t, 0.15, 0.06, S, { echo: true });
          this.tone('triangle', 1319, t + 0.08, 0.2, 0.05, S, { echo: true });
          break;
        case 'switch':
          this.tone('square', 600, t, 0.04, 0.035, S, { to: 760 });
          break;
        case 'nudge':
          this.tone('square', 1200, t, 0.015, 0.02, S);
          break;
        case 'move':
          this.tone('square', 980, t, 0.03, 0.03, S);
          break;
        case 'confirm':
          this.tone('square', 523, t, 0.06, 0.05, S);
          this.tone('square', 1046, t + 0.06, 0.1, 0.05, S);
          break;
        case 'back':
          this.tone('square', 660, t, 0.06, 0.045, S, { to: 330 });
          break;
        case 'start':
          [392, 523, 659, 784].forEach((f, i) => this.tone('square', f, t + i * 0.07, 0.12, 0.05, S));
          break;
        case 'deny':
          this.tone('sawtooth', 110, t, 0.18, 0.08, S, { lp: 600 });
          break;
        case 'tick':
          this.tone('square', 1400, t, 0.02, 0.03, S);
          break;
      }
    },

    // A minor synthwave loop: Am F C G, sixteenth-note scheduler.
    CHORDS: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); },
    updateMusic() {
      const c = this.ctx;
      if (!c || this.musicVol <= 0) { if (c) this.next = c.currentTime + 0.1; return; }
      const play = this.mood === 'play';
      const bpm = play ? 104 : 92;
      const six = 60 / bpm / 4;
      // the filter opens with how full the board is
      const cut = play ? 900 + this.fill * 5200 : 1100;
      this.musicFilter.frequency.setTargetAtTime(cut, c.currentTime, 0.4);
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      const M = this.music;
      while (this.next < c.currentTime + 0.25) {
        const t = this.next;
        const s = this.step % 16;
        const bar = Math.floor(this.step / 16) % 4;
        const ch = this.CHORDS[bar];
        // pulsing octave bass
        if (s % 2 === 0) this.tone('sawtooth', this.mtof(ch[0] - 24 + (s % 4 === 2 ? 12 : 0)), t, six * 1.6, 0.11, M, { lp: 420, q: 4 });
        // gated pad on the beat
        if (s % 4 === 0) ch.forEach((n, i) => this.tone('sawtooth', this.mtof(n), t, six * 3, 0.018, M, { detune: (i - 1) * 9, a: 0.02, lp: 1600 }));
        // arpeggio
        if (play || s % 2 === 0) {
          const arp = [0, 1, 2, 1, 2, 0, 2, 1];
          const n = ch[arp[s % 8]] + 12 + (s >= 8 && bar % 2 ? 12 : 0);
          this.tone('square', this.mtof(n), t, six * 0.9, play ? 0.025 : 0.018, M, { echo: true, lp: 3500 });
        }
        if (play) {
          if (s === 0 || s === 8 || (s === 10 && bar === 3)) this.tone('sine', 120, t, 0.22, 0.32, M, { to: 40, glide: 0.18 });
          if (s === 4 || s === 12) { this.noise(t, 0.18, 0.13, M, 'bandpass', 1700, 0.8); this.tone('triangle', 200, t, 0.08, 0.06, M, { to: 140 }); }
          if (s % 2 === 1 || this.fill > 0.55) this.noise(t, 0.035, 0.04, M, 'highpass', 8000);
          if (this.streak >= 2 && s % 4 === 2) this.tone('triangle', this.mtof(ch[2] + 24), t, 0.2, 0.025, M, { echo: true });
        }
        this.step++;
        this.next += six;
      }
    },
  };
  (window.SG = window.SG || {}).Audio = A;
})();
