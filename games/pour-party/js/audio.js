// Pour Party sound: glass clinks, glugs and fizz, plus a slow bossa-lounge
// band (electric piano, upright bass, shaker and rim, a vibraphone that joins
// in as the counter gets sorted). Everything is synthesized with WebAudio.
// Effects and music have separate buses; nothing starts before the first input.
(function () {
  const A = {
    ctx: null, master: null, sfx: null, music: null, verb: null,
    sfxVol: 0.8, musicVol: 0.6,
    mood: 'menu', // menu | play
    progress: 0,  // 0..1 share of glasses sorted: brings in the vibraphone
    next: 0, step: 0, bar: 0, prog: 0,

    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      this.master = c.createGain();
      this.master.gain.value = 0.7;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 3;
      this.master.connect(comp).connect(c.destination);
      this.sfx = c.createGain();
      this.music = c.createGain();
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      // A short "room" made from a decaying noise impulse.
      this.verb = c.createConvolver();
      const len = Math.floor(c.sampleRate * 1.6);
      const ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      this.verb.buffer = ir;
      const wet = c.createGain();
      wet.gain.value = 0.28;
      this.verb.connect(wet).connect(this.master);
      this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const nd = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.apply();
      this.next = c.currentTime + 0.1;
    },

    setVolumes(sfx, music) {
      this.sfxVol = sfx / 10;
      this.musicVol = music / 10;
      this.apply();
    },
    apply() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.sfx.gain.setTargetAtTime(this.sfxVol, t, 0.02);
      this.music.gain.setTargetAtTime(this.musicVol * 0.55, t, 0.05);
    },

    // ---------- building blocks ----------
    osc(type, f, t, dur, vol, bus, opts = {}) {
      const c = this.ctx;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t + (opts.slideT || dur));
      if (opts.detune) o.detune.value = opts.detune;
      const a = opts.attack || 0.005;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      let out = g;
      if (opts.lp) {
        const f2 = c.createBiquadFilter();
        f2.type = 'lowpass';
        f2.frequency.value = opts.lp;
        g.connect(f2);
        out = f2;
      }
      out.connect(bus);
      if (opts.verb) out.connect(this.verb);
      o.start(t);
      o.stop(t + dur + 0.05);
      return o;
    },
    noise(t, dur, vol, bus, type, freq, q = 1, opts = {}) {
      const c = this.ctx;
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(freq, t);
      if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, t + dur);
      f.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus);
      if (opts.verb) g.connect(this.verb);
      s.start(t, Math.random() * 0.6, dur + 0.05);
    },
    // A struck glass: a few inharmonic partials ringing out.
    clink(t, base, vol = 0.12) {
      [[1, 1], [2.32, 0.5], [4.25, 0.25], [6.1, 0.12]].forEach(([m, v]) => this.osc('sine', base * m, t, 0.5 + 0.4 / m, vol * v, this.sfx, { verb: true }));
    },

    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      const S = this.sfx;
      switch (name) {
        case 'lift':
          this.clink(t, 1850 + arg * 60, 0.07);
          break;
        case 'drop':
          this.osc('sine', 520, t, 0.08, 0.06, S, { slide: 380 });
          break;
        case 'pour': {
          // arg = target fill after the pour (1..4): the glug climbs as the glass fills
          const n = 4 + Math.floor(Math.random() * 2);
          for (let i = 0; i < n; i++) {
            const tt = t + 0.12 + i * 0.085 + Math.random() * 0.02;
            const f = 210 + (arg - 1) * 70 + i * 22;
            this.osc('sine', f, tt, 0.07, 0.11, S, { slide: f * 1.9, slideT: 0.05, lp: 1400 });
          }
          this.noise(t + 0.08, 0.55, 0.035, S, 'bandpass', 2400, 0.7, { attack: 0.06 });
          break;
        }
        case 'settle':
          this.osc('sine', 300 + arg * 40, t, 0.12, 0.05, S, { slide: 180 });
          break;
        case 'fizz':
          for (let i = 0; i < 22; i++) this.noise(t + Math.random() * 0.6, 0.02, 0.05 * Math.random() + 0.01, S, 'highpass', 6000 + Math.random() * 3000, 1);
          break;
        case 'complete':
          this.play('fizz');
          [0, 0.09].forEach((d, i) => this.clink(t + d, [2093, 2637][i], 0.08));
          this.osc('triangle', 1046.5, t + 0.18, 0.5, 0.05, S, { verb: true });
          break;
        case 'reveal':
          [1318, 1760, 2349].forEach((f, i) => this.osc('sine', f, t + i * 0.05, 0.35, 0.035, S, { verb: true }));
          break;
        case 'deny':
          this.osc('sine', 330, t, 0.12, 0.09, S, { slide: 250 });
          this.noise(t, 0.05, 0.04, S, 'lowpass', 700);
          break;
        case 'undo':
          this.osc('sine', 760, t, 0.22, 0.07, S, { slide: 260 });
          this.noise(t, 0.2, 0.02, S, 'bandpass', 1800, 1, { sweep: 500 });
          break;
        case 'hint':
          [1568, 2093, 2637, 3136].forEach((f, i) => this.osc('sine', f, t + i * 0.06, 0.3, 0.03, S, { verb: true }));
          break;
        case 'restart':
          this.noise(t, 0.35, 0.05, S, 'bandpass', 900, 0.8, { sweep: 3000 });
          this.osc('triangle', 392, t + 0.05, 0.15, 0.05, S);
          break;
        case 'win': {
          const notes = [587.3, 740, 880, 1108.7, 1174.7];
          notes.forEach((f, i) => this.osc('sine', f, t + i * 0.09, 0.9, 0.06, S, { verb: true, attack: 0.004 }));
          [0.55, 0.62, 0.7].forEach((d, i) => this.clink(t + d, 1900 + i * 230, 0.07));
          break;
        }
        case 'star':
          this.osc('sine', 1567 + arg * 220, t, 0.4, 0.06, S, { verb: true });
          this.osc('sine', 3135 + arg * 440, t, 0.2, 0.02, S);
          break;
        case 'move':
          this.osc('sine', 1100, t, 0.035, 0.03, S);
          break;
        case 'confirm':
          this.osc('sine', 600, t, 0.09, 0.07, S, { slide: 1200, slideT: 0.06 });
          break;
        case 'back':
          this.osc('sine', 700, t, 0.09, 0.06, S, { slide: 420 });
          break;
        case 'tick':
          this.osc('triangle', 1400, t, 0.03, 0.03, S);
          break;
        case 'page':
          this.noise(t, 0.12, 0.05, S, 'bandpass', 3000, 0.6, { sweep: 1200 });
          break;
      }
    },

    // ---------- the lounge band ----------
    // Chords as semitones from D3 (146.83 Hz); four bars per progression.
    PROGS: [
      [[0, 4, 7, 11], [9, 12, 16, 19], [2, 5, 9, 12], [7, 11, 14, 17]], // Dmaj7 Bm7 Em7 A7
      [[5, 9, 12, 16], [4, 7, 11, 14], [2, 5, 9, 12], [7, 11, 14, 17]], // Gmaj7 F#m7 Em7 A7
      [[0, 4, 7, 11], [5, 9, 12, 16], [4, 7, 11, 14], [9, 12, 16, 19]], // Dmaj7 Gmaj7 F#m7 Bm7
    ],
    ROOT: 146.83,
    hz(semi) { return this.ROOT * Math.pow(2, semi / 12); },

    // FM electric piano: soft bell attack that mellows.
    epiano(f, t, dur, vol) {
      const c = this.ctx;
      const car = c.createOscillator();
      const mod = c.createOscillator();
      const mg = c.createGain();
      const g = c.createGain();
      car.frequency.value = f;
      mod.frequency.value = f * 1.0;
      mg.gain.setValueAtTime(f * 1.6, t);
      mg.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.6);
      mod.connect(mg).connect(car.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      car.connect(g);
      g.connect(this.music);
      g.connect(this.verb);
      car.start(t); mod.start(t);
      car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
    },
    vibes(f, t, vol) {
      const c = this.ctx;
      const o = c.createOscillator();
      const g = c.createGain();
      const trem = c.createOscillator();
      const tg = c.createGain();
      o.frequency.value = f;
      trem.frequency.value = 5.5;
      tg.gain.value = vol * 0.35;
      trem.connect(tg).connect(g.gain);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g);
      g.connect(this.music);
      g.connect(this.verb);
      o.start(t); trem.start(t);
      o.stop(t + 1.7); trem.stop(t + 1.7);
    },

    updateMusic() {
      const c = this.ctx;
      if (!c || this.musicVol <= 0) { if (c) this.next = c.currentTime + 0.1; return; }
      const bpm = this.mood === 'menu' ? 84 : 92;
      const six = 60 / bpm / 4; // a sixteenth
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.3) {
        const t = this.next;
        const s = this.step % 16;
        const swing = s % 2 ? six * 0.12 : 0;
        const at = t + swing;
        const prog = this.PROGS[this.prog];
        const chord = prog[this.bar % 4];
        // electric piano: bossa comping
        if ([0, 3, 6, 10, 12].includes(s)) {
          const v = s === 0 ? 0.035 : 0.026;
          chord.forEach((n, i) => this.epiano(this.hz(n + 12), at + i * 0.012, s === 0 ? 1.4 : 0.6, v));
        }
        // upright bass: root and fifth, a walk-up into the next bar
        const root = chord[0] - 12;
        if (s === 0) this.osc('triangle', this.hz(root), at, 0.5, 0.16, this.music, { lp: 600 });
        if (s === 6) this.osc('triangle', this.hz(root + 7), at, 0.3, 0.12, this.music, { lp: 600 });
        if (s === 8) this.osc('triangle', this.hz(root), at, 0.4, 0.13, this.music, { lp: 600 });
        if (s === 14) {
          const nextRoot = prog[(this.bar + 1) % 4][0] - 12;
          this.osc('triangle', this.hz(nextRoot - 1), at, 0.2, 0.1, this.music, { lp: 600 });
        }
        // shaker and rim
        if (this.mood === 'play' || s % 4 === 0) this.noise(at, 0.05, s % 4 === 2 ? 0.03 : 0.014, this.music, 'highpass', 7000, 0.8);
        if (this.mood === 'play' && [3, 6, 10, 12].includes(s) && this.bar % 2 === (s === 3 ? 0 : 1)) this.noise(at, 0.04, 0.05, this.music, 'bandpass', 1900, 4);
        // vibraphone: joins in as the counter gets sorted (and noodles on the menu)
        const dens = this.mood === 'menu' ? 0.16 : this.progress * 0.42;
        if (s % 2 === 0 && Math.random() < dens) {
          const pool = chord.concat(chord.map((n) => n + 12));
          this.vibes(this.hz(pool[Math.floor(Math.random() * pool.length)] + 12), at, 0.03);
        }
        this.step++;
        if (this.step % 16 === 0) {
          this.bar++;
          if (this.bar % 8 === 0) this.prog = Math.floor(Math.random() * this.PROGS.length);
        }
        this.next += six;
      }
    },
  };

  (window.PP = window.PP || {}).Audio = A;
})();
