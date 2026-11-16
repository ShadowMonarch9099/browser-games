// Pin Pickle's sounds, all synthesized: steel pins scraping out, coins
// clinking into the cart, lava hissing and blooping, steam bursts, water
// splashes, and a cave soundtrack of kalimba plucks over a low drone with
// dripping echoes. The music grows a heartbeat when lava nears the cart.
(function () {
  const PP = window.PP;
  const A = {
    ctx: null, master: null, sfx: null, music: null, echo: null, noiseBuf: null,
    sfxVol: 0.8, musicVol: 0.6, muted: false, danger: 0, mode: null, style: null, step: 0, next: 0, seed: 1, drone: null,

    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      this.master = c.createGain(); this.master.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.connect(this.master);
      this.music = c.createGain(); this.music.connect(this.master);
      // a cave echo shared by the music and the drips
      const d = c.createDelay(1); d.delayTime.value = 0.33;
      const fb = c.createGain(); fb.gain.value = 0.42;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(this.music);
      this.echo = c.createGain(); this.echo.gain.value = 0.5; this.echo.connect(d);
      this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const nd = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.apply();
      if (this.style) this.setDrone(this.mode && this.mode.indexOf('cave') === 0);
    },
    setVolumes(s, m) { this.sfxVol = s / 10; this.musicVol = m / 10; this.apply(); },
    apply() {
      if (!this.ctx) return;
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.sfx.gain.value = this.sfxVol;
      this.music.gain.value = this.musicVol * 0.55;
    },

    tone(f, t, dur, vol, o) {
      o = o || {};
      const c = this.ctx, s = c.createOscillator(), g = c.createGain();
      s.type = o.type || 'sine';
      s.frequency.setValueAtTime(f, t);
      if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t + (o.toT || dur));
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (o.att || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let n = s;
      if (o.filter) { const f2 = c.createBiquadFilter(); f2.type = o.filter; f2.frequency.value = o.cut || 1000; f2.Q.value = o.q || 1; s.connect(f2); n = f2; }
      n.connect(g); g.connect(o.bus || this.sfx);
      if (o.echo) g.connect(this.echo);
      s.start(t); s.stop(t + dur + 0.05);
    },
    hiss(t, dur, vol, type, f, o) {
      o = o || {};
      const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf;
      fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = o.q || 0.7;
      if (o.to) fl.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (o.att || 0.01));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(o.bus || this.sfx);
      s.start(t, Math.random() * 1.5, dur + 0.05);
    },
    // a plucked kalimba tine
    pluck(f, t, vol, bus, echo) {
      this.tone(f, t, 0.9, vol, { bus, echo });
      this.tone(f * 3.01, t, 0.18, vol * 0.25, { bus });
      this.tone(f * 5.4, t, 0.06, vol * 0.12, { bus });
    },

    play(name, o) {
      o = o || {};
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime + (o.delay || 0), v = o.vol === undefined ? 1 : o.vol;
      switch (name) {
        case 'move': this.hiss(t, 0.06, 0.08 * v, 'bandpass', 2600, { q: 1.5, to: 4000 }); break; // quill scratch
        case 'select': this.pluck(784, t, 0.12 * v); this.pluck(1175, t + 0.06, 0.08 * v); break;
        case 'back': this.pluck(523, t, 0.1 * v); this.pluck(392, t + 0.06, 0.08 * v); break;
        case 'page': this.hiss(t, 0.28, 0.12 * v, 'highpass', 1800, { to: 5000, att: 0.06 }); break;
        case 'deny': this.tone(180, t, 0.18, 0.08 * v, { type: 'triangle', to: 120 }); break;
        case 'tug': this.tone(900, t, 0.05, 0.05 * v, { type: 'square', filter: 'bandpass', cut: 1800, q: 4 }); break;
        case 'pull': // steel scraping out of rock, then a pop
          this.hiss(t, 0.22, 0.18 * v, 'bandpass', 3500, { q: 6, to: 6500 });
          this.tone(1400, t, 0.2, 0.03 * v, { type: 'sawtooth', to: 2400, filter: 'bandpass', cut: 2500, q: 8 });
          this.tone(320, t + 0.2, 0.12, 0.2 * v, { to: 180 });
          break;
        case 'clank': [1, 2.7, 5.1].forEach((m, i) => this.tone(620 * m, t, 0.4 / (1 + i), (0.08 * v) / (1 + i))); break;
        case 'coin': { const f = [1568, 1760, 2093, 2349, 2637][Math.floor(Math.random() * 5)]; this.tone(f, t, 0.18, 0.06 * v, { type: 'triangle' }); this.tone(f * 1.5, t + 0.03, 0.12, 0.03 * v); break; }
        case 'coins': for (let i = 0; i < 5; i++) this.play('coin', { delay: (o.delay || 0) + i * 0.05, vol: v }); break;
        case 'hiss': this.hiss(t, 0.7, 0.16 * v, 'highpass', 2500, { to: 6000, att: 0.02 }); this.hiss(t, 0.4, 0.08 * v, 'bandpass', 900); break;
        case 'sizzle': this.hiss(t, 0.35, 0.12 * v, 'bandpass', 4000, { q: 3 }); this.tone(1200, t, 0.2, 0.02 * v, { to: 400 }); break;
        case 'bloop': { const f = 90 + Math.random() * 60; this.tone(f, t, 0.18, 0.12 * v, { to: f * 2.2, toT: 0.12 }); break; }
        case 'splash': this.hiss(t, 0.35, 0.1 * v, 'bandpass', 1400, { to: 500 }); for (let i = 0; i < 3; i++) this.tone(600 + Math.random() * 900, t + i * 0.04, 0.08, 0.04 * v, { to: 1600 }); break;
        case 'win':
          [0, 4, 7, 12, 16].forEach((s, i) => this.pluck(392 * Math.pow(2, s / 12), t + i * 0.09, 0.14 * v, null, true));
          this.play('coins', { delay: 0.45 });
          break;
        case 'lose': [0, -3, -7, -12].forEach((s, i) => this.tone(220 * Math.pow(2, s / 12), t + i * 0.18, 0.35, 0.09 * v, { type: 'triangle', filter: 'lowpass', cut: 900 })); break;
        case 'burn': this.hiss(t, 0.9, 0.22 * v, 'lowpass', 1200, { to: 300 }); this.tone(140, t, 0.5, 0.15 * v, { type: 'sawtooth', to: 60, filter: 'lowpass', cut: 500 }); break;
        case 'cheer': this.tone(660, t, 0.12, 0.05 * v, { type: 'triangle', to: 990 }); break;
        case 'gasp': this.tone(500, t, 0.25, 0.05 * v, { type: 'triangle', to: 900 }); break;
        case 'hint': this.pluck(988, t, 0.1 * v, null, true); this.pluck(1319, t + 0.1, 0.08 * v, null, true); break;
      }
    },

    // ---------- music ----------
    MODES: {
      cave: { bpm: 84, root: 146.8, scale: [0, 2, 3, 7, 9], drips: true },
      map: { bpm: 100, root: 196, scale: [0, 2, 4, 7, 9], drips: false },
    },
    setMode(m, seed) {
      const key = m + ':' + (seed || 0);
      if (key === this.mode) return;
      this.mode = key; this.style = this.MODES[m]; this.seed = (seed || 1) * 7919; this.step = 0;
      if (this.ctx) this.next = this.ctx.currentTime + 0.1;
      this.setDrone(m === 'cave');
    },
    rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; },
    setDrone(on) {
      if (!this.ctx) return;
      const c = this.ctx;
      if (on && !this.drone) {
        const g = c.createGain(); g.gain.value = 0; g.connect(this.music);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; f.connect(g);
        const oscs = [73.4, 110, 73.6].map((fr, i) => { const o = c.createOscillator(); o.type = i === 1 ? 'triangle' : 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(); return o; });
        g.gain.setTargetAtTime(0.05, c.currentTime, 1.5);
        this.drone = { g, f, oscs };
      } else if (!on && this.drone) {
        const d = this.drone; this.drone = null;
        d.g.gain.setTargetAtTime(0, c.currentTime, 0.4);
        d.oscs.forEach((o) => o.stop(c.currentTime + 2));
      }
    },
    update() {
      const c = this.ctx;
      if (!c || !this.style) return;
      if (this.drone) this.drone.f.frequency.setTargetAtTime(260 + this.danger * 500, c.currentTime, 0.3);
      if (this.muted || this.musicVol <= 0) { this.next = c.currentTime + 0.1; return; }
      const st = this.style, eighth = 30 / st.bpm;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.25) {
        const t = this.next, i = this.step, pos = i % 8, bar = Math.floor(i / 8) % 4;
        const note = (deg, oct) => { const n = st.scale.length, d = ((deg % n) + n) % n; return st.root * Math.pow(2, st.scale[d] / 12 + oct + Math.floor(deg / n)); };
        const chord = [0, 3, 1, 4][bar];
        if (pos === 0) this.pluck(note(chord, -1), t, 0.12, this.music, true);
        if (this.rnd() < (st.drips ? 0.32 : 0.5)) this.pluck(note(chord + Math.floor(this.rnd() * 6), this.rnd() < 0.3 ? 1 : 0), t, 0.07, this.music, true);
        if (st.drips && this.rnd() < 0.05) this.tone(2000 + this.rnd() * 1500, t, 0.1, 0.03, { to: 900, bus: this.music, echo: true });
        if (!st.drips && pos % 4 === 2) this.hiss(t, 0.05, 0.03, 'highpass', 6000, { bus: this.music });
        if (this.danger > 0.2 && pos % 4 === 0) { this.tone(70, t, 0.18, 0.25 * this.danger, { to: 45, bus: this.music }); this.tone(70, t + 0.16, 0.14, 0.18 * this.danger, { to: 45, bus: this.music }); }
        this.step++;
        this.next += eighth;
      }
    },
  };
  PP.Audio = A;
})();
