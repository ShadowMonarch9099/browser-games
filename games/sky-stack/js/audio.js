// Sky Stack audio, all synthesized: soft marimba thocks for each floor, glass
// bells that climb a scale with your perfect streak, airy whooshes for sliced
// pieces, a wind bed that rises with altitude, and a slow ambient score
// (pads and a music box) that drifts higher and dreamier as the tower grows.
(function () {
  const SS = window.SS;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // C lydian-ish pentatonic, used by bells and the music box
  const SCALE = [0, 2, 4, 6, 7, 9, 11];

  const A = {
    ctx: null, master: null, sfxBus: null, musicBus: null, verb: null, verbIn: null,
    sfxVol: 0.7, musicVol: 0.6,
    windGain: null, windFilter: null,
    altitude: 0, night: 0, stage: 0,
    mOn: false, mNext: 0, mStep: 0, mChord: 0,

    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = 0.8;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.musicBus = c.createGain(); this.musicBus.connect(this.master);
      // a long, bright reverb made from decaying noise: the "open sky"
      this.verb = c.createConvolver();
      const len = Math.floor(c.sampleRate * 3.2), ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      this.verb.buffer = ir;
      this.verbIn = c.createGain(); this.verbIn.gain.value = 0.6;
      this.verbIn.connect(this.verb); this.verb.connect(this.master);
      this.applyVolumes();
      this.startWind();
    },
    running() { return !!this.ctx && this.ctx.state === 'running'; },
    applyVolumes() {
      if (!this.ctx) return;
      this.sfxBus.gain.value = this.sfxVol;
      this.musicBus.gain.value = this.musicVol * 0.8;
    },
    setVolumes(sfx, music) { this.sfxVol = sfx / 10; this.musicVol = music / 10; this.applyVolumes(); },

    // ---------- voices ----------
    tone(at, freq, dur, vol, dest, o) {
      o = o || {};
      const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, at);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, at + dur);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + (o.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(g); g.connect(dest);
      if (o.verb) { const s = c.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(this.verbIn); }
      osc.start(at); osc.stop(at + dur + 0.05);
    },
    noiseBuf: null,
    noise(at, dur, vol, dest, type, f0, f1, q, verb) {
      const c = this.ctx;
      if (!this.noiseBuf) {
        this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf;
      f.type = type; f.Q.value = q || 1;
      f.frequency.setValueAtTime(f0, at);
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, at + dur);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.05, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      s.connect(f); f.connect(g); g.connect(dest);
      if (verb) { const v = c.createGain(); v.gain.value = verb; g.connect(v); v.connect(this.verbIn); }
      s.start(at, Math.random(), dur + 0.05);
    },
    // a struck bar: fundamental plus the bright 4x partial that marimbas have
    mallet(at, midi, vol, dest, verb) {
      const f = hz(midi);
      this.tone(at, f, 0.5, vol, dest, { verb });
      this.tone(at, f * 4, 0.09, vol * 0.35, dest, { verb });
      this.tone(at, f * 10, 0.02, vol * 0.12, dest);
    },
    // a glass bell: inharmonic partials ringing out
    bell(at, midi, vol, dest, verb) {
      const f = hz(midi);
      this.tone(at, f, 1.6, vol, dest, { verb });
      this.tone(at, f * 2.76, 0.9, vol * 0.4, dest, { verb });
      this.tone(at, f * 5.4, 0.4, vol * 0.18, dest, { verb });
    },
    note(i, base) { const o = Math.floor(i / SCALE.length); return base + SCALE[((i % SCALE.length) + SCALE.length) % SCALE.length] + 12 * o; },

    // ---------- effects ----------
    sfx(name, arg) {
      if (!this.running() || this.sfxVol <= 0) return;
      const t = this.ctx.currentTime, b = this.sfxBus;
      switch (name) {
        case 'nav': this.tone(t, 1320, 0.08, 0.06, b, { verb: 0.3 }); break;
        case 'ok': this.mallet(t, 76, 0.16, b, 0.4); this.mallet(t + 0.07, 83, 0.12, b, 0.4); break;
        case 'back': this.mallet(t, 79, 0.12, b, 0.3); this.mallet(t + 0.06, 72, 0.1, b, 0.3); break;
        case 'toggle': this.mallet(t, arg ? 84 : 77, 0.12, b, 0.3); break;
        case 'tick': this.tone(t, 900 + (arg || 0) * 70, 0.05, 0.05, b); break;
        case 'place': {
          // a soft wooden thock that rises gently with the floor number
          const m = 55 + ((arg || 0) % 14);
          this.mallet(t, m, 0.26, b, 0.15);
          this.noise(t, 0.06, 0.12, b, 'lowpass', 900, 300, 0.7);
          break;
        }
        case 'perfect': {
          const n = Math.min(arg || 1, 14);
          this.bell(t, this.note(n + 2, 72), 0.16, b, 0.7);
          this.tone(t, hz(this.note(n + 4, 72)), 0.5, 0.05, b, { verb: 0.8, attack: 0.02 });
          this.mallet(t, 55 + n, 0.18, b, 0.1);
          break;
        }
        case 'grow': [0, 2, 4, 7].forEach((k, i) => this.bell(t + 0.06 + i * 0.06, this.note(k + 7, 72), 0.07, b, 0.9)); break;
        case 'slice':
          this.mallet(t, 50, 0.2, b, 0.1);
          this.noise(t + 0.02, 0.45, 0.14 * Math.min(1, 0.4 + (arg || 0) * 2), b, 'bandpass', 2400, 500, 1.4, 0.4);
          break;
        case 'fall':
          this.tone(t, 900, 1.2, 0.08, b, { slide: 180, type: 'triangle', verb: 0.5 });
          this.noise(t, 1.2, 0.12, b, 'bandpass', 1800, 300, 0.8, 0.6);
          this.tone(t + 1.0, 70, 0.6, 0.25, b, { slide: 40 });
          break;
        case 'stage': [0, 4, 7, 11, 14].forEach((k, i) => this.bell(t + i * 0.09, 64 + k, 0.08, b, 1)); break;
        case 'thunder':
          this.noise(t, 2.6, 0.32, b, 'lowpass', 400, 60, 0.5, 0.5);
          this.tone(t, 48, 1.8, 0.18, b, { slide: 30 });
          break;
        case 'best': [0, 2, 4, 6, 7].forEach((k, i) => this.bell(t + i * 0.08, this.note(k, 79), 0.07, b, 0.9)); break;
      }
    },

    // ---------- wind bed: rises with altitude and in windy stages ----------
    startWind() {
      const c = this.ctx;
      const src = c.createBufferSource();
      const len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
      src.buffer = buf; src.loop = true;
      this.windFilter = c.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 500; this.windFilter.Q.value = 0.6;
      this.windGain = c.createGain(); this.windGain.gain.value = 0;
      src.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.musicBus);
      src.start();
    },
    // called every frame with the game's view of the world
    setWorld(altitude, night, stage, playing, time) {
      this.altitude = altitude; this.night = night; this.stage = stage;
      if (!this.running() || !this.windGain) return;
      const windy = stage === 1 || stage === 3;
      const target = (0.04 + Math.min(1, altitude / 120) * 0.08 + (windy && playing ? 0.18 * (0.6 + 0.4 * Math.sin(time * 1.7)) : 0)) * (playing ? 1 : 0.5);
      const t = this.ctx.currentTime;
      this.windGain.gain.setTargetAtTime(target, t, 0.4);
      this.windFilter.frequency.setTargetAtTime(380 + (windy ? 500 + 300 * Math.sin(time * 0.9) : 120 * Math.sin(time * 0.3)), t, 0.5);
    },

    // ---------- music: pads and a music box, about 66 bpm ----------
    startMusic() { this.mOn = true; },
    stopMusic() { this.mOn = false; },
    pump() {
      if (!this.mOn || !this.running() || this.musicVol <= 0) return;
      const c = this.ctx, step = 0.45;
      if (this.mNext < c.currentTime) this.mNext = c.currentTime + 0.1;
      // chords move up through the sky: higher, more open, more shimmer
      const lift = Math.min(7, Math.floor(this.altitude / 20));
      const PROG = [[0, 4, 7, 11], [5, 9, 12, 16], [2, 6, 9, 14], [7, 11, 14, 18]];
      while (this.mNext < c.currentTime + 0.3) {
        const t = this.mNext, i = this.mStep, pos = i % 16, base = 48 + [0, 2, 4, 5, 7, 9, 7, 4][lift];
        if (pos === 0) {
          const ch = PROG[this.mChord % 4];
          this.mChord++;
          const f = c.createBiquadFilter(), g = c.createGain();
          f.type = 'lowpass'; f.frequency.value = 900 + this.night * -300 + lift * 120;
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 2.2);
          g.gain.setValueAtTime(0.5, t + step * 14); g.gain.linearRampToValueAtTime(0.0001, t + step * 18);
          f.connect(g); g.connect(this.musicBus);
          const send = c.createGain(); send.gain.value = 0.5; g.connect(send); send.connect(this.verbIn);
          for (const k of ch) for (const det of [-6, 6]) {
            const o = c.createOscillator(), og = c.createGain();
            o.type = 'triangle'; o.frequency.value = hz(base + k); o.detune.value = det; og.gain.value = 0.05;
            o.connect(og); og.connect(f); o.start(t); o.stop(t + step * 18 + 0.1);
          }
          this.tone(t, hz(base - 12 + ch[0]), step * 15, 0.09, this.musicBus, { attack: 0.8 });
        }
        // music box: sparse notes, more of them higher up
        const chance = 0.22 + Math.min(0.25, this.altitude / 300);
        if (Math.random() < chance || pos === 8) {
          const ch = PROG[(this.mChord + 3) % 4];
          const m = base + 24 + ch[Math.floor(Math.random() * 4)] + (Math.random() < 0.3 ? 12 : 0);
          this.tone(t, hz(m), 1.2, 0.035, this.musicBus, { verb: 0.9 });
          this.tone(t, hz(m) * 3, 0.25, 0.008, this.musicBus, { verb: 0.9 });
        }
        this.mStep++; this.mNext += step;
      }
    },
  };

  SS.Audio = A;
})();
