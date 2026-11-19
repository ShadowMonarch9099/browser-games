// Paper Boat Parade sound: a riverside festival. A tanpura drone and a
// plucked raga line over a soft tabla pattern; dice rattling in a brass cup,
// wooden taps as boats hop, splashes, a gong when a boat is sunk, temple bells
// when one reaches the ghat, and fireworks at the end.
(function () {
  const SCALE = [0, 2, 4, 6, 7, 9, 11];         // a bright, Yaman-like scale
  const A = {
    ctx: null, sfx: null, music: null, sfxVol: 0.8, musicVol: 0.5, next: 0, step: 0, drone: null,
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
      // tanpura: Sa and Pa, softly beating, breathing through a slow filter
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 2;
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 500; lfo.connect(lg).connect(f.frequency); lfo.start();
      this.drone = c.createGain(); this.drone.gain.value = 0;
      [[50, -4], [50, 5], [57, 0], [62, 3]].forEach(([m, det]) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this.mtof(m); o.detune.value = det; const og = c.createGain(); og.gain.value = 0.02; o.connect(og).connect(f); o.start(); });
      f.connect(this.drone).connect(this.music);
      this.apply(); this.next = c.currentTime + 0.1;
    },
    setVolumes(s, m) { this.sfxVol = s / 10; this.musicVol = m / 10; this.apply(); },
    apply() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.sfx.gain.setTargetAtTime(this.sfxVol, t, 0.02);
      this.music.gain.setTargetAtTime(this.musicVol * 0.5, t, 0.05);
      this.drone.gain.setTargetAtTime(this.musicVol > 0 ? 1 : 0, t, 0.5);
    },
    mtof: (m) => 440 * Math.pow(2, (m - 69) / 12),
    tone(type, f, t, dur, vol, bus, o = {}) {
      const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
      if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 6; lg.gain.value = f * 0.015; l.connect(lg).connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let out = g;
      if (o.lp || o.bp) { const fl = c.createBiquadFilter(); fl.type = o.bp ? 'bandpass' : 'lowpass'; fl.frequency.value = o.bp || o.lp; if (o.q) fl.Q.value = o.q; g.connect(fl); out = fl; }
      osc.connect(g); out.connect(bus || this.sfx); osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(t, dur, vol, bus, type, freq, q, to) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.006, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    // a plucked string with the little pitch drop of a sitar
    pluck(m, t, vol, bus) { const f = this.mtof(m); this.tone('sawtooth', f * 1.01, t, 0.9, vol, bus, { to: f, glide: 0.06, bp: f * 2.5, q: 2 }); this.tone('triangle', f, t, 0.6, vol * 0.6, bus); },
    tabla(t, high, vol, bus) {
      if (high) { this.tone('sine', 520, t, 0.12, vol * 0.5, bus, { to: 440 }); this.noise(t, 0.03, vol * 0.4, bus, 'bandpass', 3000, 3); }
      else this.tone('sine', 140, t, 0.3, vol, bus, { to: 70, glide: 0.2 });
    },
    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      switch (name) {
        case 'rattle': for (let i = 0; i < 7; i++) this.noise(t + i * 0.07 + Math.random() * 0.03, 0.04, 0.2, null, 'bandpass', 2500 + Math.random() * 2500, 5); break;
        case 'land': this.tone('triangle', 900 + arg * 90, t, 0.08, 0.12); this.noise(t, 0.05, 0.15, null, 'bandpass', 1500, 4); break;
        case 'hop': this.tone('sine', 600 + (arg % 7) * 60, t, 0.06, 0.07); this.noise(t, 0.03, 0.06, null, 'lowpass', 1200); break;
        case 'launch': this.noise(t, 0.35, 0.18, null, 'bandpass', 800, 1, 300); this.pluck(67, t + 0.05, 0.08); break;
        case 'current': this.noise(t, 0.5, 0.15, null, 'bandpass', 600, 1, 2400); break;
        case 'capture': this.tone('sine', 110, t, 1.6, 0.25, null, { to: 98 }); this.tone('sine', 277, t, 1.2, 0.08); this.noise(t + 0.05, 0.6, 0.15, null, 'lowpass', 600); break;
        case 'home': [84, 91, 96].forEach((m, i) => { this.tone('sine', this.mtof(m), t + i * 0.12, 1.6, 0.07); this.tone('sine', this.mtof(m) * 2.76, t + i * 0.12, 0.6, 0.02); }); break;
        case 'six': this.pluck(74, t, 0.09); this.pluck(79, t + 0.08, 0.08); break;
        case 'stuck': this.tone('triangle', 220, t, 0.25, 0.08, null, { to: 160 }); break;
        case 'win': [62, 66, 69, 74, 78, 81, 86].forEach((m, i) => this.tone('square', this.mtof(m), t + i * 0.1, i === 6 ? 1 : 0.25, 0.05, null, { lp: 2400, vib: i === 6 })); break;
        case 'pop': this.noise(t, 0.3, 0.2, null, 'bandpass', 900 + Math.random() * 800, 1); break;
        case 'turn': this.tone('sine', 1320, t, 0.15, 0.05); break;
        case 'move': this.tone('sine', 1100, t, 0.04, 0.04); break;
        case 'confirm': this.pluck(69, t, 0.08); this.pluck(76, t + 0.06, 0.07); break;
        case 'back': this.pluck(64, t, 0.07); break;
        case 'deny': this.tone('triangle', 150, t, 0.15, 0.08); break;
      }
    },
    update(on) {
      const c = this.ctx; if (!c || this.musicVol <= 0) return;
      const eighth = 60 / 92 / 2, M = this.music;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.3) {
        const t = this.next, s = this.step % 16;
        // a keherwa-like tabla cycle
        if ([0, 6, 8].includes(s)) this.tabla(t, false, 0.18, M);
        if ([2, 3, 4, 10, 11, 12, 14].includes(s)) this.tabla(t, true, 0.12, M);
        // a wandering raga line, more of it during play
        if (s % (on ? 2 : 4) === 0 && Math.sin(this.step * 1.7) > -0.2) {
          const deg = Math.floor((Math.sin(this.step * 0.37) + 1) * 4.5);
          this.pluck(62 + SCALE[deg % 7] + 12 * Math.floor(deg / 7), t, 0.04, M);
        }
        this.step++; this.next += eighth;
      }
    },
  };
  PB.Audio = A;
})();
