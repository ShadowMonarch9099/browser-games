// Courier Sprint sound, all synthesised: a four-on-the-floor electro-funk
// track (rubbery filtered bass, clap, hats, detuned chord stabs) that speeds up
// with the run, and street-flavoured effects: scanner beeps for menus, a
// till-bell for parcels, van horns, scooter putts and a drone buzz.
(function (root) {
  'use strict';
  const A = {
    ctx: null, master: null, sfxBus: null, musicBus: null, noiseBuf: null,
    sfxVol: 0.8, musicVol: 0.6, muted: false, mode: 'menu', step: 0, next: 0,
    intensity: 0, droneOsc: null, droneGain: null,

    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      this.master = c.createGain(); this.master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.connect(this.master);
      this.sfxBus = c.createGain(); this.sfxBus.connect(comp);
      this.musicBus = c.createGain(); this.musicBus.connect(comp);
      this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // the drone's rotor buzz (gated on while flying)
      this.droneOsc = c.createOscillator(); this.droneOsc.type = 'sawtooth'; this.droneOsc.frequency.value = 118;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2;
      const trem = c.createOscillator(), tg = c.createGain(); trem.frequency.value = 31; tg.gain.value = 0.5;
      this.droneGain = c.createGain(); this.droneGain.gain.value = 0;
      const am = c.createGain(); am.gain.value = 0.5; trem.connect(tg); tg.connect(am.gain);
      this.droneOsc.connect(f); f.connect(am); am.connect(this.droneGain); this.droneGain.connect(this.sfxBus);
      this.droneOsc.start(); trem.start();
      this.apply();
    },
    apply() {
      if (!this.master) return;
      this.master.gain.value = this.muted ? 0 : 0.75;
      this.sfxBus.gain.value = this.sfxVol;
      this.musicBus.gain.value = this.musicVol * 0.5;
    },
    setVolumes(sfx, music) { this.sfxVol = sfx / 10; this.musicVol = music / 10; this.apply(); },

    osc(type, f0, f1, dur, vol, at, bus, attack) {
      const c = this.ctx; if (!c) return;
      const t = at || c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus || this.sfxBus); o.start(t); o.stop(t + dur + 0.05);
    },
    // filtered voice with an envelope on the filter: the funk bass and stabs
    synth(type, freq, dur, vol, at, bus, cutoff, cutEnd, detune) {
      const c = this.ctx; if (!c) return;
      const t = at || c.currentTime;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 7;
      f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(cutEnd, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      for (const dt of detune ? [-detune, detune] : [0]) {
        const o = c.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = dt;
        o.connect(f); o.start(t); o.stop(t + dur + 0.05);
      }
      f.connect(g); g.connect(bus || this.sfxBus);
    },
    noise(dur, vol, type, freq, at, bus, q, freq1) {
      const c = this.ctx; if (!c) return;
      const t = at || c.currentTime;
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
      if (freq1) f.frequency.exponentialRampToValueAtTime(freq1, t + dur);
      f.Q.value = q || 0.8;
      const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(bus || this.sfxBus);
      s.start(t, Math.random() * 0.5, dur + 0.05);
    },

    play(name) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      switch (name) {
        case 'jump': this.osc('square', 300, 900, 0.14, 0.07, t); this.noise(0.12, 0.06, 'highpass', 3000, t, null, 0.5); break;
        case 'land': this.osc('sine', 120, 55, 0.08, 0.2, t); this.noise(0.04, 0.08, 'lowpass', 900, t); break;
        case 'roll': this.noise(0.3, 0.16, 'bandpass', 3200, t, null, 2, 300); this.osc('sine', 240, 90, 0.25, 0.08, t); break;
        case 'lane': this.noise(0.07, 0.07, 'bandpass', 1800, t, null, 3, 4200); break;
        case 'parcel': this.osc('square', 1318, 1318, 0.06, 0.06, t); this.osc('square', 1976, 1976, 0.16, 0.05, t + 0.05); this.osc('sine', 3950, 3950, 0.2, 0.03, t + 0.05); break;
        case 'parcelPull': this.osc('sine', 1500, 2600, 0.1, 0.05, t); break;
        case 'clear': this.osc('triangle', 880, 1320, 0.08, 0.05, t); break;
        case 'magnet': [0, 0.06, 0.12, 0.18].forEach((d, i) => this.osc('sine', 440 * (1 + i * 0.25), 660 * (1 + i * 0.25), 0.12, 0.08, t + d)); break;
        case 'scooter': for (let i = 0; i < 6; i++) this.synth('sawtooth', 70, 0.07, 0.12, t + i * 0.07, null, 900, 200); this.osc('square', 660, 990, 0.2, 0.05, t + 0.42); break;
        case 'drone': this.osc('sawtooth', 200, 600, 0.5, 0.06, t); this.osc('square', 1046, 1568, 0.25, 0.04, t + 0.2); break;
        case 'powerEnd': this.osc('triangle', 990, 440, 0.25, 0.06, t); break;
        case 'save': this.noise(0.25, 0.25, 'lowpass', 2000, t, null, 1, 200); this.osc('square', 520, 180, 0.3, 0.07, t); break;
        case 'horn': this.synth('sawtooth', 311, 0.38, 0.09, t, null, 2400, 1400, 12); this.synth('sawtooth', 392, 0.38, 0.07, t, null, 2400, 1400, 12); break;
        case 'crash':
          this.noise(0.6, 0.45, 'lowpass', 3000, t, null, 0.7, 120);
          this.osc('sine', 140, 40, 0.5, 0.4, t);
          [0.08, 0.16, 0.27].forEach((d) => this.noise(0.08, 0.2, 'bandpass', 4000 + Math.random() * 2000, t + d, null, 4));
          break;
        case 'count': this.osc('square', 880, 880, 0.12, 0.06, t); break;
        case 'go': this.osc('square', 1760, 1760, 0.3, 0.07, t); this.synth('sawtooth', 220, 0.4, 0.1, t, null, 4000, 300, 15); break;
        // menus: a barcode scanner
        case 'move': this.osc('sine', 1850, 1850, 0.035, 0.06, t, null, 0.001); break;
        case 'confirm': this.osc('sine', 1850, 1850, 0.05, 0.07, t, null, 0.001); this.osc('sine', 2470, 2470, 0.07, 0.07, t + 0.07, null, 0.001); break;
        case 'back': this.osc('sine', 1240, 1240, 0.05, 0.06, t, null, 0.001); this.osc('sine', 930, 930, 0.07, 0.06, t + 0.06, null, 0.001); break;
        case 'pause': this.synth('square', 392, 0.2, 0.06, t, null, 2400, 300); break;
        case 'best': [523, 659, 784, 1046, 1318].forEach((f, i) => this.osc('square', f, f, 0.12, 0.05, t + i * 0.07)); break;
        case 'stamp': this.noise(0.12, 0.3, 'lowpass', 1200, t); this.osc('sine', 160, 60, 0.15, 0.25, t); break;
        case 'tick': this.osc('square', 2600, 2600, 0.02, 0.025, t); break;
      }
    },
    flying(on) {
      if (!this.ctx) return;
      this.droneGain.gain.setTargetAtTime(on && !this.muted ? 0.05 : 0, this.ctx.currentTime, 0.08);
    },

    // ---------- music: E minor funk ----------
    BASS: [
      [40, null, 40, 52, null, 40, null, 47, 40, null, 52, null, 50, null, 47, 45],
      [43, null, 43, 55, null, 43, null, 50, 45, null, 57, null, 55, null, 52, 50],
    ],
    CHORDS: [[64, 67, 71, 74], [67, 71, 74, 78], [69, 72, 76, 79], [62, 66, 69, 74]],
    midi: (n) => 440 * Math.pow(2, (n - 69) / 12),
    setMode(m) { if (m !== this.mode) { this.mode = m; this.step = 0; } },
    update() {
      const c = this.ctx; if (!c) return;
      if (this.muted || this.musicVol <= 0) { this.next = c.currentTime + 0.1; return; }
      const run = this.mode === 'run';
      const bpm = run ? 118 + this.intensity * 18 : 100;
      const s16 = 15 / bpm;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      const bus = this.musicBus;
      while (this.next < c.currentTime + 0.2) {
        const t = this.next, i = this.step, pos = i % 16, bar = Math.floor(i / 16) % 4;
        const chord = this.CHORDS[bar];
        const bl = this.BASS[bar >> 1];
        if (run) {
          if (pos % 4 === 0) { this.osc('sine', 150, 42, 0.22, 0.34, t, bus, 0.002); }
          if (pos === 4 || pos === 12) { this.noise(0.13, 0.2, 'bandpass', 1500, t, bus, 0.8); this.noise(0.05, 0.12, 'highpass', 2500, t + 0.012, bus); }
          if (pos % 2 === 1) this.noise(0.035, 0.05, 'highpass', 8000, t, bus);
          if (pos === 14) this.noise(0.12, 0.05, 'highpass', 6000, t, bus);
          const b = bl[pos];
          if (b !== null) this.synth('sawtooth', this.midi(b + (bar === 2 ? 5 : 0) - (bar === 3 ? 2 : 0)), s16 * 1.6, 0.11, t, bus, 1500 + this.intensity * 1400, 140);
          if (pos === 2 || pos === 7 || pos === 10) for (const n of chord) this.synth('sawtooth', this.midi(n - 12), s16 * 0.9, 0.022, t, bus, 3200, 600, 9);
          if (this.intensity > 0.5 && pos % 4 === 2) this.osc('square', this.midi(chord[(i >> 2) % 4] + 12), this.midi(chord[(i >> 2) % 4] + 12), s16, 0.018, t, bus);
        } else {
          // lobby groove: soft bass, rim and lazy chords
          if (pos === 0 || pos === 10) this.synth('triangle', this.midi(bl[0] + (bar === 2 ? 5 : 0)), s16 * 3, 0.13, t, bus, 700, 200);
          if (pos === 4 || pos === 12) this.noise(0.04, 0.06, 'bandpass', 3500, t, bus, 4);
          if (pos % 4 === 2) this.noise(0.03, 0.025, 'highpass', 9000, t, bus);
          if (pos === 0 || pos === 6) for (const n of chord) this.synth('square', this.midi(n - 12), s16 * 3, 0.012, t, bus, 1800, 500, 6);
        }
        this.step++;
        this.next += s16;
      }
    },
  };
  root.CS = root.CS || {};
  root.CS.Audio = A;
})(window);
