// Bonk Brawl sound, all synthesized: cartoon slapstick effects (bonks,
// springs, slide whistles, cowbells, a crowd that gasps) and a loud ska
// soundtrack with walking bass, off-beat guitar chops and a horn section.
// Effects and music have their own volume buses.
(function () {
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const A = {
    ctx: null, master: null, sfxBus: null, musBus: null, noiseBuf: null,
    sfxVol: 0.8, musVol: 0.6, mood: 0, playing: false, nextT: 0, stepN: 0,

    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0.6;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.musBus = c.createGain(); this.musBus.connect(this.master);
      this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.apply();
    },
    apply() { if (this.ctx) { this.sfxBus.gain.value = this.sfxVol; this.musBus.gain.value = this.musVol * 0.45; } },
    setVolumes(sfx, music) { this.sfxVol = sfx / 10; this.musVol = music / 10; this.apply(); },

    tone(freq, dur, o) {
      const c = this.ctx; if (!c) return;
      o = o || {};
      const t = o.at !== undefined ? o.at : c.currentTime + (o.delay || 0);
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + (o.slideT || dur));
      if (o.vib) {
        const l = c.createOscillator(), lg = c.createGain();
        l.frequency.value = o.vib; lg.gain.value = freq * (o.vibAmt || 0.05);
        l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05);
      }
      const v = o.vol === undefined ? 0.2 : o.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.004));
      if (o.hold) g.gain.setValueAtTime(v, t + o.hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = osc;
      if (o.lp || o.sweep) {
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.q || 1;
        f.frequency.setValueAtTime(o.lp || 400, t);
        if (o.sweep) { f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur * 0.3); f.frequency.exponentialRampToValueAtTime(o.lp || 400, t + dur); }
        osc.connect(f); node = f;
      }
      node.connect(g); g.connect(o.bus || this.sfxBus);
      osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(dur, o) {
      const c = this.ctx; if (!c) return;
      o = o || {};
      const t = o.at !== undefined ? o.at : c.currentTime + (o.delay || 0);
      const src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
      src.buffer = this.noiseBuf; src.loop = true;
      f.type = o.filter || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1500, t);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      f.Q.value = o.q || 1;
      const v = o.vol === undefined ? 0.2 : o.vol;
      if (o.swell) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + o.swell); }
      else g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(o.bus || this.sfxBus);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    },
    brass(notes, dur, o) {
      o = o || {};
      for (const n of notes) {
        this.tone(midi(n), dur, { type: 'sawtooth', vol: o.vol || 0.06, lp: 500, sweep: o.bright || 2600, attack: 0.02, at: o.at, delay: o.delay, bus: o.bus, q: 2 });
        this.tone(midi(n) * 1.004, dur, { type: 'sawtooth', vol: (o.vol || 0.06) * 0.6, lp: 500, sweep: o.bright || 2600, attack: 0.02, at: o.at, delay: o.delay, bus: o.bus });
      }
    },

    play(name, p) {
      if (!this.ctx) return;
      p = p || 0;
      switch (name) {
        case 'light': // bonk on the head
          this.tone(420 + Math.random() * 60, 0.12, { type: 'sine', slide: 140, vol: 0.45 });
          this.tone(1200, 0.03, { type: 'square', vol: 0.06, lp: 2400 });
          this.noise(0.05, { freq: 2600, q: 0.8, vol: 0.25 });
          break;
        case 'heavy': // WHAM
          this.tone(150, 0.32, { type: 'sine', slide: 42, vol: 0.6 });
          this.noise(0.22, { freq: 900, to: 200, filter: 'lowpass', vol: 0.5 });
          this.noise(0.06, { freq: 3500, q: 0.6, vol: 0.3 });
          this.brass([58 + (p % 3), 62 + (p % 3)], 0.18, { vol: 0.05, bright: 3200 });
          break;
        case 'swing':
          this.noise(0.1, { freq: 900, to: 2600, q: 2.5, vol: 0.12, swell: 0.04 });
          break;
        case 'swingHeavy':
          this.noise(0.28, { freq: 400, to: 1800, q: 3, vol: 0.16, swell: 0.18 });
          break;
        case 'jump': // spring
          this.tone(210, 0.2, { type: 'sine', slide: 520, vol: 0.18, vib: 28, vibAmt: 0.08 });
          break;
        case 'jump2':
          this.tone(330, 0.2, { type: 'sine', slide: 780, vol: 0.16, vib: 32, vibAmt: 0.08 });
          this.tone(1560, 0.08, { type: 'triangle', vol: 0.05, delay: 0.05 });
          break;
        case 'land':
          this.tone(110, 0.08, { type: 'sine', slide: 60, vol: 0.25 });
          this.noise(0.05, { freq: 300, filter: 'lowpass', vol: 0.18 });
          break;
        case 'launch': // slide whistle up
          this.tone(500, 0.5, { type: 'sine', slide: 1900, vol: 0.12, vib: 7, vibAmt: 0.02 });
          break;
        case 'ko':
          this.tone(1800, 0.15, { type: 'sine', slide: 2600, vol: 0.12 });
          this.noise(0.9, { freq: 1500, to: 120, filter: 'lowpass', vol: 0.55 });
          this.tone(90, 0.7, { type: 'sine', slide: 30, vol: 0.6 });
          this.noise(1.3, { freq: 550, q: 1.4, vol: 0.12, swell: 0.3, delay: 0.15 }); // crowd "ooh"
          this.noise(1.1, { freq: 900, q: 2, vol: 0.07, swell: 0.3, delay: 0.2 });
          break;
        case 'out':
          this.tone(392, 0.3, { type: 'sawtooth', vol: 0.06, lp: 900, slide: 370, delay: 0.5 });
          this.tone(370, 0.3, { type: 'sawtooth', vol: 0.06, lp: 900, slide: 349, delay: 0.8 });
          this.tone(349, 0.7, { type: 'sawtooth', vol: 0.06, lp: 900, slide: 300, delay: 1.1 });
          break;
        case 'respawn':
          [72, 76, 79, 84].forEach((n, i) => this.tone(midi(n), 0.2, { type: 'triangle', vol: 0.08, delay: i * 0.05 }));
          break;
        case 'count': // cowbell
          this.tone(540, 0.25, { type: 'square', vol: 0.07, lp: 2400 });
          this.tone(800, 0.25, { type: 'square', vol: 0.06, lp: 2400 });
          break;
        case 'go':
          this.brass([58, 62, 65, 70], 0.5, { vol: 0.06, bright: 3600 });
          this.noise(0.8, { freq: 7000, filter: 'highpass', vol: 0.12 });
          this.tone(120, 0.3, { type: 'sine', slide: 50, vol: 0.4 });
          break;
        case 'game':
          this.noise(1.6, { freq: 700, q: 0.7, vol: 0.18, swell: 0.4 }); // crowd roar
          this.noise(1.4, { freq: 1600, q: 1.2, vol: 0.08, swell: 0.5 });
          this.brass([53, 57, 60], 0.9, { vol: 0.07, delay: 0.05 });
          break;
        case 'win':
          for (let i = 0; i < 14; i++) this.noise(0.05, { freq: 1800, q: 1, vol: 0.06 + i * 0.006, delay: i * 0.05 });
          [[60, 0.75], [64, 0.9], [67, 1.05], [72, 1.2]].forEach(([n, d]) => this.brass([n, n + 4], 0.18, { vol: 0.06, delay: d }));
          this.brass([65, 69, 72, 77], 0.9, { vol: 0.07, delay: 1.4 });
          this.noise(1.2, { freq: 8000, filter: 'highpass', vol: 0.14, delay: 1.4 });
          break;
        case 'join': // bike horn
          this.tone(392, 0.12, { type: 'sawtooth', vol: 0.1, lp: 1400, vib: 30, vibAmt: 0.01 });
          this.tone(523, 0.16, { type: 'sawtooth', vol: 0.1, lp: 1600, delay: 0.1 });
          break;
        case 'leave':
          this.tone(500, 0.35, { type: 'sawtooth', slide: 140, vol: 0.07, lp: 1200 });
          break;
        case 'pick':
          this.tone(880, 0.05, { type: 'square', vol: 0.06, lp: 2000 });
          this.tone(1320, 0.06, { type: 'square', vol: 0.05, lp: 2400, delay: 0.04 });
          break;
        case 'ready':
          this.noise(0.08, { freq: 3000, q: 0.5, vol: 0.3 });
          this.brass([65, 69], 0.2, { vol: 0.06 });
          break;
        case 'move': // kazoo blip
          this.tone(700, 0.05, { type: 'square', vol: 0.045, lp: 1800, vib: 40, vibAmt: 0.02 });
          break;
        case 'ok': // slapstick crack
          this.noise(0.05, { freq: 2400, q: 0.6, vol: 0.32 });
          this.tone(260, 0.06, { type: 'sine', slide: 120, vol: 0.2 });
          break;
        case 'back':
          this.tone(600, 0.14, { type: 'square', slide: 300, vol: 0.05, lp: 1600 });
          break;
        case 'pause':
          this.brass([62, 58], 0.2, { vol: 0.05 });
          break;
      }
    },

    // ---- music: a ska shuffle in F, scheduled a little ahead ----
    startMusic() { if (!this.ctx || this.playing) return; this.playing = true; this.nextT = this.ctx.currentTime + 0.08; this.stepN = 0; },
    tick() {
      if (!this.ctx || !this.playing || this.ctx.state !== 'running') return;
      const bpm = this.mood >= 2 ? 172 : this.mood === 1 ? 156 : 132;
      const spb = 60 / bpm / 2;
      if (this.nextT < this.ctx.currentTime - 0.3) this.nextT = this.ctx.currentTime + 0.05;
      while (this.nextT < this.ctx.currentTime + 0.14) { this.step(this.stepN++, this.nextT, spb); this.nextT += spb; }
    },
    step(n, t, spb) {
      const bus = this.musBus, mood = this.mood, s = n % 64, bar = Math.floor(s / 8), e = s % 8;
      const ROOTS = [41, 41, 46, 46, 48, 46, 41, 48];
      const root = ROOTS[bar];
      // walking bass: root, 3rd, 5th, 6th
      const WALK = [0, 4, 7, 9];
      if (e % 2 === 0) this.tone(midi(root + WALK[e / 2]), spb * 1.7, { type: 'triangle', vol: 0.3, at: t, bus, lp: 700 });
      // off-beat guitar chops
      if (e % 2 === 1) for (const iv of [12, 16, 19, 24]) this.tone(midi(root + iv), 0.07, { type: 'square', vol: mood ? 0.025 : 0.018, at: t, bus, lp: 3200 });
      // drums
      if (mood >= 1 || e % 4 === 0) {
        if (e === 0 || (e === 4 && mood >= 1)) this.tone(110, 0.14, { type: 'sine', slide: 40, vol: 0.45, at: t, bus });
        if (e === 2 || e === 6) this.noise(0.12, { freq: 1900, q: 0.8, vol: mood ? 0.16 : 0.08, at: t, bus });
      }
      this.noise(0.03, { freq: 8000, filter: 'highpass', vol: e % 2 ? 0.035 : 0.05, at: t, bus });
      if (mood >= 2 && e % 2 === 1) this.noise(0.02, { freq: 6000, filter: 'highpass', vol: 0.03, at: t + spb / 2, bus });
      // horn riff on the second half of each phrase
      if (mood >= 1 && Math.floor(n / 64) % 2 === 1) {
        const RIFF = [
          [0, null, 3, null, 5, 7, null, 5], [null, null, 3, null, 0, null, null, null],
          [5, null, 7, null, 10, null, 7, 5], [3, null, null, null, null, null, null, null],
          [7, null, 10, null, 12, null, 10, 7], [5, null, 3, null, 5, null, null, null],
          [0, null, 3, null, 5, 7, 10, 12], [7, null, null, null, 12, null, null, null],
        ];
        const nt = RIFF[bar][e];
        if (nt !== null) this.brass([65 + nt, 65 + nt + (nt % 2 ? 3 : 4)], spb * 1.6, { at: t, bus, vol: 0.035, bright: 2400 });
      } else if (mood === 0 && bar % 2 === 1 && e === 0) this.brass([65, 69, 72], spb * 3, { at: t, bus, vol: 0.02, bright: 1400 });
    },
  };
  BB.Audio = A;
})();
