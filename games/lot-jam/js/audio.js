// Lot Jam sound: engines, horns, tyre squeaks, cones and a siren, plus an
// evening lo-fi loop: warbly tape chords, a round sub bass, dusty boom-bap
// drums and vinyl crackle. Turn-signal ticks for the menus. WebAudio only.
(function () {
  const A = {
    ctx: null, sfx: null, music: null,
    sfxVol: 0.8, musicVol: 0.6, mood: 'menu', urgency: 0,
    next: 0, step: 0,

    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      const master = c.createGain();
      master.gain.value = 0.65;
      const comp = c.createDynamicsCompressor();
      master.connect(comp).connect(c.destination);
      this.sfx = c.createGain();
      this.sfx.connect(master);
      this.music = c.createGain();
      // the "tape": a warm lowpass and a slow wobble on everything musical
      this.tape = c.createBiquadFilter();
      this.tape.type = 'lowpass';
      this.tape.frequency.value = 2600;
      this.music.connect(this.tape).connect(master);
      this.wow = c.createOscillator();
      this.wow.frequency.value = 0.6;
      this.wowDepth = c.createGain();
      this.wowDepth.gain.value = 9; // cents
      this.wow.connect(this.wowDepth);
      this.wow.start();
      this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // vinyl crackle: sparse clicks in a looping buffer
      this.crackleBuf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
      const cr = this.crackleBuf.getChannelData(0);
      for (let i = 0; i < cr.length; i++) cr[i] = Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.9 : (Math.random() * 2 - 1) * 0.012;
      this.apply();
      this.next = c.currentTime + 0.1;
    },
    setVolumes(sfx, music) { this.sfxVol = sfx / 10; this.musicVol = music / 10; this.apply(); },
    apply() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.sfx.gain.setTargetAtTime(this.sfxVol, t, 0.02);
      this.music.gain.setTargetAtTime(this.musicVol * 0.5, t, 0.05);
      if (this.musicVol > 0 && !this.crackle) {
        const s = this.ctx.createBufferSource();
        s.buffer = this.crackleBuf;
        s.loop = true;
        const g = this.ctx.createGain();
        g.gain.value = 0.35;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1500;
        s.connect(hp).connect(g).connect(this.music);
        s.start();
        this.crackle = s;
      }
    },

    osc(type, f, t, dur, vol, bus, o = {}) {
      const c = this.ctx;
      const n = c.createOscillator();
      const g = c.createGain();
      n.type = type;
      n.frequency.setValueAtTime(f, t);
      if (o.to) n.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
      if (o.detune) n.detune.value = o.detune;
      if (o.wow) this.wowDepth.connect(n.detune);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.005));
      if (o.hold) g.gain.setValueAtTime(vol, t + o.hold);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(g);
      let out = g;
      if (o.lp) {
        const f2 = c.createBiquadFilter();
        f2.type = 'lowpass';
        f2.frequency.setValueAtTime(o.lp, t);
        if (o.lpTo) f2.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur);
        f2.Q.value = o.q || 0.7;
        g.connect(f2);
        out = f2;
      }
      out.connect(bus);
      n.start(t);
      n.stop(t + dur + 0.05);
      return n;
    },
    noise(t, dur, vol, bus, type, freq, q = 1, o = {}) {
      const c = this.ctx;
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(freq, t);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      f.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus);
      s.start(t, Math.random(), dur + 0.05);
    },
    // A small engine: a rumbling sawtooth whose pitch climbs as it pulls away.
    engine(t, dur, from, to, vol) {
      const c = this.ctx;
      const o = c.createOscillator();
      const lfo = c.createOscillator();
      const lg = c.createGain();
      const g = c.createGain();
      const f = c.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(from, t);
      o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
      lfo.frequency.setValueAtTime(from * 0.5, t);
      lfo.frequency.exponentialRampToValueAtTime(to * 0.5, t + dur * 0.8);
      lg.gain.value = vol * 0.6;
      lfo.connect(lg).connect(g.gain);
      f.type = 'lowpass';
      f.frequency.setValueAtTime(500, t);
      f.frequency.exponentialRampToValueAtTime(1600, t + dur * 0.6);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
      g.gain.setValueAtTime(vol, t + dur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f).connect(g).connect(this.sfx);
      o.start(t); lfo.start(t);
      o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    },

    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      const S = this.sfx;
      switch (name) {
        case 'start': // key turn + ignition
          this.noise(t, 0.05, 0.08, S, 'bandpass', 3000, 2);
          this.engine(t + 0.05, 0.5, 45, 70, 0.08);
          break;
        case 'drive':
          this.engine(t, 1.1, 55, 150 + arg * 10, 0.11);
          this.noise(t + 0.02, 0.18, 0.05, S, 'bandpass', 2600, 6); // tyre chirp
          break;
        case 'siren':
          for (let i = 0; i < 4; i++) this.osc('triangle', i % 2 ? 660 : 880, t + i * 0.28, 0.27, 0.06, S, { hold: 0.22 });
          this.engine(t, 1.1, 60, 170, 0.08);
          break;
        case 'horn':
          this.osc('square', 392, t, 0.32, 0.05, S, { hold: 0.25, lp: 1600 });
          this.osc('square', 494, t, 0.32, 0.05, S, { hold: 0.25, lp: 1600 });
          break;
        case 'bump':
          this.noise(t + 0.12, 0.12, 0.22, S, 'lowpass', 900);
          this.osc('sine', 120, t + 0.12, 0.15, 0.25, S, { to: 50 });
          this.noise(t, 0.12, 0.05, S, 'bandpass', 2800, 5); // brake squeal
          break;
        case 'cone':
          this.osc('triangle', 520, t + 0.25, 0.08, 0.07, S, { to: 300 });
          this.osc('triangle', 380, t + 0.42, 0.08, 0.05, S, { to: 250 });
          break;
        case 'wake':
          this.osc('sine', 220, t, 0.45, 0.07, S, { to: 520, glide: 0.35 });
          this.noise(t + 0.3, 0.06, 0.06, S, 'bandpass', 2000, 2);
          this.engine(t + 0.35, 0.5, 45, 60, 0.06);
          break;
        case 'undo':
          this.engine(t, 0.5, 120, 50, 0.07);
          this.osc('sine', 900, t, 0.08, 0.04, S);
          this.osc('sine', 900, t + 0.18, 0.08, 0.04, S); // reversing beep
          break;
        case 'hint':
          [784, 988, 1175].forEach((f, i) => this.osc('triangle', f, t + i * 0.07, 0.25, 0.05, S));
          break;
        case 'won':
          [0, 0.18, 0.36].forEach((d, i) => { this.osc('square', [392, 494, 587][i], t + d, 0.16, 0.04, S, { lp: 1800 }); });
          [523, 659, 784, 1046].forEach((f, i) => this.osc('triangle', f, t + 0.6 + i * 0.09, 0.5, 0.06, S));
          break;
        case 'lost':
          this.osc('sawtooth', 300, t, 0.9, 0.06, S, { to: 70, lp: 900 });
          this.osc('square', 220, t + 0.1, 0.5, 0.03, S, { to: 110, lp: 900 });
          break;
        case 'star':
          this.osc('triangle', 880 + arg * 220, t, 0.25, 0.06, S);
          this.noise(t, 0.06, 0.05, S, 'bandpass', 1800, 3);
          break;
        case 'move': // a turn signal tick
          this.noise(t, 0.02, 0.09, S, 'bandpass', 1500, 6);
          break;
        case 'confirm':
          this.noise(t, 0.02, 0.09, S, 'bandpass', 1500, 6);
          this.noise(t + 0.12, 0.02, 0.07, S, 'bandpass', 1100, 6);
          break;
        case 'back':
          this.noise(t, 0.03, 0.08, S, 'bandpass', 900, 6);
          break;
        case 'tick':
          this.noise(t, 0.015, 0.06, S, 'bandpass', 2500, 6);
          break;
        case 'deny':
          this.osc('square', 180, t, 0.12, 0.04, S, { lp: 900 });
          break;
      }
    },

    // ---------- the lo-fi loop ----------
    // Fmaj9 - Em7 - Dm9 - Cmaj7 as MIDI notes, played on a warbly "tape keys".
    CHORDS: [[53, 57, 60, 64, 67], [52, 55, 59, 62], [50, 53, 57, 60, 64], [48, 52, 55, 59]],
    mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); },
    updateMusic() {
      const c = this.ctx;
      if (!c || this.musicVol <= 0) { if (c) this.next = c.currentTime + 0.1; return; }
      const bpm = 78;
      const six = 60 / bpm / 4;
      const M = this.music;
      const play = this.mood === 'play';
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.3) {
        const t = this.next;
        const s = this.step % 16;
        const bar = Math.floor(this.step / 16) % 4;
        const ch = this.CHORDS[bar];
        const swing = s % 2 ? six * 0.18 : 0;
        const at = t + swing;
        // keys: a lazy strum on 1 and a stab on the "and" of 3
        if (s === 0 || s === 10) ch.forEach((n, i) => this.osc('triangle', this.mtof(n), at + i * 0.018, s === 0 ? six * 14 : six * 4, s === 0 ? 0.03 : 0.018, M, { a: 0.02, lp: 1800, wow: true }));
        if (s === 0) ch.slice(0, 3).forEach((n) => this.osc('sawtooth', this.mtof(n), at, six * 15, 0.008, M, { a: 0.3, lp: 900, wow: true, detune: 7 }));
        // sub bass
        if (s === 0 || s === 7 || (s === 10 && bar % 2)) this.osc('sine', this.mtof(ch[0] - 12), at, six * (s === 0 ? 6 : 3), 0.2, M, { a: 0.01 });
        // drums (lighter on the menus)
        if (s === 0 || s === 9 || (play && s === 11 && bar === 3)) { this.osc('sine', 95, at, 0.25, play ? 0.35 : 0.2, M, { to: 42, glide: 0.2 }); }
        if (s === 4 || s === 12) this.noise(at, 0.2, play ? 0.12 : 0.06, M, 'bandpass', 1400, 0.7, { to: 900 });
        if (play && s % 2 === 0) this.noise(at, 0.03, s % 4 === 2 ? 0.05 : 0.025, M, 'highpass', 7000);
        // a little melody that gets busier as the ambulance runs out of exits
        if (play && s % 4 === 2 && Math.random() < 0.25 + this.urgency * 0.5) {
          const n = ch[1 + Math.floor(Math.random() * (ch.length - 1))] + 12;
          this.osc('sine', this.mtof(n), at, six * 3, 0.03, M, { wow: true });
        }
        this.step++;
        this.next += six;
      }
    },
  };
  (window.LJ = window.LJ || {}).Audio = A;
})();
