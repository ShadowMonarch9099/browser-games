// Bounce Tanks sound: everything is synthesized. The effects are toy-box
// noises (cork pops, tin pings, wooden knocks) and the music is a little
// parade march: fife, tuba and a snare drum. Effects and music have their
// own volume buses.
(function () {
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const A = {
    ctx: null, master: null, sfxBus: null, musBus: null,
    sfxVol: 0.8, musVol: 0.6, mood: 0, playing: false, nextT: 0, stepN: 0, noiseBuf: null,

    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0.55;
      const comp = c.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.musBus = c.createGain(); this.musBus.connect(this.master);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.apply();
    },
    apply() {
      if (!this.ctx) return;
      this.sfxBus.gain.value = this.sfxVol;
      this.musBus.gain.value = this.musVol * 0.5;
    },
    setVolumes(sfx, music) { this.sfxVol = sfx / 10; this.musVol = music / 10; this.apply(); },
    suspend(on) { if (this.ctx) { if (on) this.ctx.suspend(); else this.ctx.resume(); } },

    tone(freq, dur, o) {
      const c = this.ctx; if (!c) return;
      o = o || {};
      const t = o.at !== undefined ? o.at : c.currentTime + (o.delay || 0);
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
      const v = o.vol === undefined ? 0.2 : o.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = osc;
      if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
      node.connect(g); g.connect(o.bus || this.sfxBus);
      osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(dur, o) {
      const c = this.ctx; if (!c) return;
      o = o || {};
      const t = o.at !== undefined ? o.at : c.currentTime + (o.delay || 0);
      const src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
      src.buffer = this.noiseBuf; src.loop = true;
      f.type = o.filter || 'lowpass'; f.frequency.setValueAtTime(o.freq || 1200, t);
      if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
      f.Q.value = o.q || 0.8;
      g.gain.setValueAtTime(o.vol === undefined ? 0.2 : o.vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(o.bus || this.sfxBus);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    },

    play(name, p) {
      if (!this.ctx) return;
      p = p || 0;
      switch (name) {
        case 'fire': // cork pop
          this.tone(520, 0.09, { type: 'sine', slide: 130, vol: 0.32 });
          this.noise(0.05, { freq: 2600, filter: 'bandpass', vol: 0.22 });
          break;
        case 'triple':
          for (let i = 0; i < 3; i++) { this.tone(600 + i * 90, 0.07, { type: 'sine', slide: 160, vol: 0.24, delay: i * 0.035 }); }
          this.noise(0.08, { freq: 3000, filter: 'bandpass', vol: 0.2 });
          break;
        case 'laser': // slide whistle
          this.tone(1500, 0.22, { type: 'triangle', slide: 380, vol: 0.2 });
          this.tone(2250, 0.16, { type: 'sine', slide: 600, vol: 0.08 });
          break;
        case 'bounce': // tin ping, pitch climbs a little with each call
          this.tone(1250 + (p % 6) * 110, 0.12, { type: 'triangle', vol: 0.1 });
          this.tone(2500 + (p % 6) * 220, 0.05, { type: 'sine', vol: 0.05 });
          break;
        case 'boom':
          this.noise(0.55, { freq: 900, sweep: 90, vol: 0.55 });
          this.tone(110, 0.4, { type: 'sine', slide: 38, vol: 0.5 });
          this.noise(0.12, { freq: 4000, filter: 'highpass', vol: 0.14 });
          for (let i = 0; i < 4; i++) this.tone(300 + Math.random() * 500, 0.05, { type: 'square', vol: 0.05, delay: 0.12 + i * 0.07, lp: 1800 });
          break;
        case 'crate':
          this.tone(392, 0.09, { type: 'triangle', vol: 0.16 });
          this.tone(587, 0.14, { type: 'triangle', vol: 0.16, delay: 0.09 });
          break;
        case 'pickup': // wind-up ratchet then a ding
          for (let i = 0; i < 5; i++) this.noise(0.02, { freq: 1800 + i * 300, filter: 'bandpass', q: 4, vol: 0.2, delay: i * 0.03 });
          this.tone(1318, 0.3, { type: 'sine', vol: 0.2, delay: 0.16 });
          this.tone(1976, 0.3, { type: 'sine', vol: 0.08, delay: 0.16 });
          break;
        case 'count': // wood block
          this.tone(820, 0.07, { type: 'sine', slide: 600, vol: 0.3 });
          this.noise(0.02, { freq: 2200, filter: 'bandpass', vol: 0.15 });
          break;
        case 'go': // toy whistle
          this.tone(1760, 0.35, { type: 'square', vol: 0.09, lp: 3500 });
          this.tone(1790, 0.35, { type: 'square', vol: 0.07, lp: 3500 });
          this.noise(0.3, { freq: 3200, filter: 'bandpass', q: 3, vol: 0.06 });
          break;
        case 'point': // bugle call
          [67, 72, 76].forEach((n, i) => this.tone(midi(n), 0.16, { type: 'sawtooth', vol: 0.13, delay: i * 0.11, lp: 2200 }));
          this.tone(midi(79), 0.4, { type: 'sawtooth', vol: 0.14, delay: 0.33, lp: 2400 });
          break;
        case 'draw':
          this.tone(midi(60), 0.2, { type: 'sawtooth', vol: 0.1, lp: 1400 });
          this.tone(midi(55), 0.4, { type: 'sawtooth', vol: 0.1, delay: 0.2, lp: 1200 });
          break;
        case 'win': // fanfare
          [[65, 0], [69, 0.13], [72, 0.26], [77, 0.39], [72, 0.6], [77, 0.73]].forEach(([n, d], i) => {
            this.tone(midi(n), i === 5 ? 0.9 : 0.16, { type: 'sawtooth', vol: 0.14, delay: d, lp: 2600 });
            this.tone(midi(n - 12), i === 5 ? 0.9 : 0.16, { type: 'triangle', vol: 0.14, delay: d });
          });
          for (let i = 0; i < 8; i++) this.noise(0.05, { freq: 2400, filter: 'bandpass', vol: 0.16, delay: i * 0.045 });
          break;
        case 'join':
          this.tone(660, 0.07, { type: 'triangle', vol: 0.2 });
          this.tone(990, 0.12, { type: 'triangle', vol: 0.2, delay: 0.07 });
          this.noise(0.03, { freq: 1500, filter: 'bandpass', vol: 0.15 });
          break;
        case 'leave':
          this.tone(600, 0.12, { type: 'triangle', slide: 300, vol: 0.16 });
          break;
        case 'ready':
          this.noise(0.05, { freq: 500, vol: 0.4 });
          this.tone(180, 0.1, { type: 'sine', slide: 90, vol: 0.4 });
          break;
        case 'move': // wooden tick
          this.tone(1100, 0.03, { type: 'sine', slide: 800, vol: 0.14 });
          break;
        case 'ok': // knock-knock
          this.tone(700, 0.05, { type: 'sine', slide: 480, vol: 0.24 });
          this.tone(940, 0.07, { type: 'sine', slide: 640, vol: 0.24, delay: 0.07 });
          break;
        case 'back':
          this.tone(620, 0.08, { type: 'sine', slide: 360, vol: 0.2 });
          break;
        case 'pause':
          this.tone(520, 0.1, { type: 'triangle', vol: 0.16 });
          this.tone(390, 0.14, { type: 'triangle', vol: 0.16, delay: 0.1 });
          break;
      }
    },

    // ---- music: an eight-bar march in F, scheduled a little ahead of time ----
    startMusic() { if (!this.ctx || this.playing) return; this.playing = true; this.nextT = this.ctx.currentTime + 0.08; this.stepN = 0; },
    stopMusic() { this.playing = false; },
    tick() {
      if (!this.ctx || !this.playing || this.ctx.state !== 'running') return;
      const spb = 60 / (this.mood >= 2 ? 126 : 112) / 2; // eighth notes
      if (this.nextT < this.ctx.currentTime - 0.3) this.nextT = this.ctx.currentTime + 0.05;
      while (this.nextT < this.ctx.currentTime + 0.14) { this.musicStep(this.stepN++, this.nextT, spb); this.nextT += spb; }
    },
    musicStep(n, t, spb) {
      const bus = this.musBus, s = n % 64, bar = Math.floor(s / 8), e = s % 8, mood = this.mood;
      const MEL = [
        [77, 0, 81, 0, 84, 0, 81, 0], [82, 0, 79, 0, 76, 0, 72, 0], [77, 79, 81, 82, 84, 0, 81, 0], [79, 0, 0, 0, 72, 0, 0, 0],
        [81, 0, 84, 0, 89, 0, 84, 0], [86, 0, 82, 0, 79, 0, 82, 0], [84, 82, 81, 79, 77, 0, 76, 0], [77, 0, 0, 0, 77, 0, 0, 0],
      ];
      const ROOT = [41, 36, 41, 36, 41, 34, 36, 41], THIRD = [4, 4, 4, 4, 4, 4, 4, 4], SEV = [0, 1, 0, 1, 0, 0, 1, 0];
      const root = ROOT[bar];
      // tuba: oom on beats 1 and 3
      if (e === 0) this.tone(midi(root), spb * 1.6, { type: 'triangle', vol: 0.34, at: t, bus, lp: 500 });
      if (e === 4) this.tone(midi(root + 7 - (root > 38 ? 12 : 0)), spb * 1.6, { type: 'triangle', vol: 0.3, at: t, bus, lp: 500 });
      // pah: off-beat chord stabs (not in the quiet menu mood)
      if (mood >= 1 && (e === 2 || e === 6)) {
        for (const iv of [12, 12 + THIRD[bar], 19, SEV[bar] ? 22 : 24]) this.tone(midi(root + iv), spb * 0.5, { type: 'square', vol: 0.035, at: t, bus, lp: 1500 });
      }
      // snare: steady taps, a roll into every fourth bar
      const roll = bar % 4 === 3 && e >= 6;
      if (e % 2 === 0 || mood >= 1) this.noise(0.05, { freq: 2100, filter: 'bandpass', q: 1.2, vol: e % 4 === 2 ? 0.15 : 0.07, at: t, bus });
      if (roll || (mood >= 2 && e % 2 === 1)) for (let k = 1; k < 4; k++) this.noise(0.03, { freq: 2300, filter: 'bandpass', q: 1.2, vol: 0.06, at: t + (spb * k) / 4, bus });
      if (e === 0) this.tone(95, 0.16, { type: 'sine', slide: 45, vol: 0.4, at: t, bus });
      // fife melody; the menu only gets every other phrase
      const note = MEL[bar][e];
      if (note && (mood >= 1 || Math.floor(n / 64) % 2 === 1 || bar < 4)) {
        const f = midi(note + (mood >= 2 && bar >= 4 ? 0 : 0));
        this.tone(f, spb * (MEL[bar][(e + 1) % 8] ? 0.85 : 1.7), { type: 'square', vol: mood === 0 ? 0.05 : 0.075, at: t, bus, lp: 3000, attack: 0.02 });
        if (mood >= 2) this.tone(f * 2, spb * 0.5, { type: 'sine', vol: 0.03, at: t, bus });
      }
      // glockenspiel sparkle on the last lap
      if (mood >= 2 && e % 2 === 1 && bar % 2 === 0) this.tone(midi(root + 36 + (e === 1 ? 7 : e === 3 ? 4 : e === 5 ? 7 : 12)), 0.25, { type: 'sine', vol: 0.05, at: t, bus });
    },
  };
  BT.Audio = A;
})();
