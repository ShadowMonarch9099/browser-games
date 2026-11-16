// Tick Talk sound: a bunker. A mechanical tick-tock that hurries in the last
// thirty seconds, relay clicks and keypad beeps, the snip of a fuse, a green
// "chunk" for a solved module, a harsh buzzer for a mistake, a low tension
// drone, the boom, and a long breath out when it is defused.
(function () {
  const A = {
    ctx: null, sfx: null, music: null, sfxVol: 0.8, musicVol: 0.5, drone: null, ticking: true, tock: false,
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = (this.ctx = new AC()), master = c.createGain(); master.gain.value = 0.8;
      master.connect(c.createDynamicsCompressor()).connect(c.destination);
      this.sfx = c.createGain(); this.sfx.connect(master);
      this.music = c.createGain(); this.music.connect(master);
      const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = n;
      this.apply();
    },
    setVolumes(s, m) { this.sfxVol = s / 10; this.musicVol = m / 10; this.apply(); },
    apply() { if (!this.ctx) return; const t = this.ctx.currentTime; this.sfx.gain.setTargetAtTime(this.sfxVol, t, 0.02); this.music.gain.setTargetAtTime(this.musicVol * 0.5, t, 0.05); },
    tone(type, f, t, dur, vol, bus, o = {}) {
      const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
      osc.type = type; osc.frequency.setValueAtTime(f, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide || dur));
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.a || 0.003)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let out = g;
      if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; g.connect(fl); out = fl; }
      osc.connect(g); out.connect(bus || this.sfx); osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(t, dur, vol, bus, type, freq, q, to) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); if (q) f.Q.value = q;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.005, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(bus || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    play(name, arg = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.005;
      switch (name) {
        case 'tick': if (!this.ticking) break; this.tock = !this.tock; this.noise(t, 0.025, arg ? 0.22 : 0.14, null, 'bandpass', this.tock ? 3200 : 2400, 6); if (arg) this.tone('square', 1100, t, 0.04, 0.03, null, { lp: 3000 }); break;
        case 'key': this.tone('square', 1500 + arg * 90, t, 0.05, 0.04, null, { lp: 4000 }); this.noise(t, 0.015, 0.1, null, 'highpass', 4000); break;
        case 'click': this.noise(t, 0.02, 0.2, null, 'bandpass', 1800, 4); this.tone('sine', 220, t, 0.04, 0.08); break;
        case 'snip': this.noise(t, 0.05, 0.35, null, 'highpass', 5000); this.noise(t + 0.03, 0.08, 0.2, null, 'bandpass', 2500, 3); break;
        case 'solve': this.noise(t, 0.03, 0.25, null, 'lowpass', 900); [880, 1320].forEach((f, i) => this.tone('sine', f, t + 0.05 + i * 0.08, 0.3, 0.08)); break;
        case 'strike': this.tone('sawtooth', 110, t, 0.45, 0.16, null, { lp: 900 }); this.tone('sawtooth', 116, t, 0.45, 0.16, null, { lp: 900 }); this.noise(t, 0.2, 0.12, null, 'bandpass', 600, 2); break;
        case 'boom': this.tone('sine', 90, t, 1.8, 0.6, null, { to: 25, glide: 1.2 }); this.noise(t, 2.2, 0.6, null, 'lowpass', 1800, 0.5, 80); this.noise(t, 0.3, 0.4, null, 'highpass', 2000); break;
        case 'defused': this.noise(t, 1.2, 0.08, null, 'bandpass', 700, 0.7, 300); [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, t + 0.2 + i * 0.12, 0.8, 0.07)); break;
        case 'boot': for (let i = 0; i < 6; i++) this.tone('square', 600 + Math.random() * 1200, t + i * 0.06, 0.03, 0.03, null, { lp: 3000 }); break;
        case 'move': this.tone('square', 1200, t, 0.03, 0.03, null, { lp: 3000 }); break;
        case 'confirm': this.noise(t, 0.02, 0.15, null, 'bandpass', 1800, 4); this.tone('square', 880, t, 0.06, 0.04, null, { lp: 3000 }); break;
        case 'back': this.tone('square', 440, t, 0.06, 0.04, null, { lp: 2000 }); break;
        case 'deny': this.tone('sawtooth', 140, t, 0.15, 0.06, null, { lp: 700 }); break;
      }
    },
    // a low drone that tightens as the clock runs down (urgency 0..1)
    setDrone(on, urgency = 0) {
      if (!this.ctx) return;
      const c = this.ctx;
      if (on && !this.drone) {
        const g = c.createGain(); g.gain.value = 0; g.connect(this.music);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200; f.connect(g);
        const oscs = [55, 55.4, 82.4].map((fr, i) => { const o = c.createOscillator(); o.type = i === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(); return o; });
        this.drone = { g, f, oscs };
      }
      if (this.drone) {
        const t = c.currentTime;
        this.drone.g.gain.setTargetAtTime(on ? 0.06 + urgency * 0.06 : 0, t, 0.5);
        this.drone.f.frequency.setTargetAtTime(180 + urgency * 700, t, 0.5);
        this.drone.oscs[1].frequency.setTargetAtTime(55.4 + urgency * 3, t, 0.5);
      }
    },
  };
  TT.Audio = A;
})();
