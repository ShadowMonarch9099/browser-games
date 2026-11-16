// Misfit Squad sound, all synthesized: sci-fi blasters (each hero has their
// own), clanky robots, power-up and power-down sweeps, station klaxons, and a
// synthwave soundtrack (arpeggiator through an echo, bass, pads, drum
// machine) that builds with every wave and turns dark for bosses.
(function () {
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const A = {
    ctx: null, master: null, sfxBus: null, musBus: null, echo: null, noiseBuf: null,
    sfxVol: 0.8, musVol: 0.6, wave: 0, boss: false, calm: true, playing: false, nextT: 0, stepN: 0,

    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0.55;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.musBus = c.createGain(); this.musBus.connect(this.master);
      // a dotted-eighth echo for the arpeggio
      this.echo = c.createDelay(1); this.echo.delayTime.value = 0.34;
      const fb = c.createGain(); fb.gain.value = 0.38;
      const ef = c.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 2200;
      this.echoIn = c.createGain(); this.echoIn.gain.value = 1;
      this.echoIn.connect(this.echo); this.echo.connect(ef); ef.connect(fb); fb.connect(this.echo); ef.connect(this.musBus);
      this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.apply();
    },
    apply() { if (this.ctx) { this.sfxBus.gain.value = this.sfxVol; this.musBus.gain.value = this.musVol * 0.5; } },
    setVolumes(sfx, music) { this.sfxVol = sfx / 10; this.musVol = music / 10; this.apply(); },

    tone(freq, dur, o) {
      const c = this.ctx; if (!c) return;
      o = o || {};
      const t = o.at !== undefined ? o.at : c.currentTime + (o.delay || 0);
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine';
      if (o.detune) osc.detune.value = o.detune;
      osc.frequency.setValueAtTime(freq, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
      const v = o.vol === undefined ? 0.2 : o.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = osc;
      if (o.lp || o.hp) {
        const f = c.createBiquadFilter(); f.type = o.hp ? 'highpass' : 'lowpass'; f.frequency.setValueAtTime(o.lp || o.hp, t); f.Q.value = o.q || 0.8;
        if (o.lpTo) f.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur);
        osc.connect(f); node = f;
      }
      node.connect(g); g.connect(o.bus || this.sfxBus);
      if (o.send) g.connect(this.echoIn);
      osc.start(t); osc.stop(t + dur + 0.05);
    },
    noise(dur, o) {
      const c = this.ctx; if (!c) return;
      o = o || {};
      const t = o.at !== undefined ? o.at : c.currentTime + (o.delay || 0);
      const src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
      src.buffer = this.noiseBuf; src.loop = true;
      f.type = o.filter || 'bandpass'; f.frequency.setValueAtTime(o.freq || 1200, t);
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      f.Q.value = o.q || 1;
      g.gain.setValueAtTime(o.vol === undefined ? 0.2 : o.vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(o.bus || this.sfxBus);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    },

    play(name, p) {
      if (!this.ctx) return;
      switch (name) {
        case 'shot': { // each hero's blaster sounds different
          const v = [[260, 120, 'square', 900], [900, 600, 'sine', 0], [700, 220, 'sawtooth', 1600], [1500, 400, 'square', 2200]][p || 0];
          this.tone(v[0], 0.08, { type: v[2], slide: v[1], vol: 0.05, lp: v[3] || undefined });
          break;
        }
        case 'hit': this.tone(1800 + Math.random() * 600, 0.04, { type: 'square', vol: 0.03, hp: 1200 }); break;
        case 'scrap': // metal crunch then bolts tinkling
          this.noise(0.18, { freq: 900, to: 300, q: 2, vol: 0.2 });
          this.tone(140, 0.15, { type: 'square', slide: 60, vol: 0.08, lp: 700 });
          for (let i = 0; i < 3; i++) this.tone(2200 + Math.random() * 1600, 0.06, { type: 'triangle', vol: 0.04, delay: 0.08 + i * 0.06 });
          break;
        case 'bigScrap':
          this.noise(0.8, { freq: 1200, to: 80, filter: 'lowpass', vol: 0.5 });
          this.tone(90, 0.7, { type: 'sine', slide: 30, vol: 0.5 });
          for (let i = 0; i < 8; i++) this.tone(1500 + Math.random() * 2500, 0.08, { type: 'triangle', vol: 0.05, delay: 0.1 + i * 0.07 });
          break;
        case 'hurt': this.tone(110, 0.12, { type: 'sawtooth', vol: 0.06, lp: 500 }); break;
        case 'down':
          this.tone(600, 0.9, { type: 'sawtooth', slide: 60, vol: 0.1, lp: 1500, lpTo: 200 });
          this.noise(0.4, { freq: 400, vol: 0.12 });
          break;
        case 'revive':
          [57, 61, 64, 69, 73].forEach((n, i) => this.tone(midi(n + 12), 0.25, { type: 'triangle', vol: 0.08, delay: i * 0.06, send: true }));
          break;
        case 'shove':
          this.tone(80, 0.35, { type: 'sine', slide: 40, vol: 0.5 });
          this.noise(0.3, { freq: 300, to: 1500, q: 1.5, vol: 0.25 });
          break;
        case 'heal':
          [69, 73, 76, 81].forEach((n, i) => this.tone(midi(n), 0.8, { type: 'sine', vol: 0.05, delay: i * 0.04, send: true }));
          this.noise(0.6, { freq: 6000, filter: 'highpass', vol: 0.04 });
          break;
        case 'mineDrop': this.tone(1200, 0.05, { type: 'square', vol: 0.05 }); this.tone(1200, 0.05, { type: 'square', vol: 0.05, delay: 0.12 }); break;
        case 'mine':
          this.noise(0.6, { freq: 1500, to: 120, filter: 'lowpass', vol: 0.45 });
          this.tone(120, 0.45, { type: 'sine', slide: 35, vol: 0.45 });
          break;
        case 'bigShot':
          this.tone(200, 0.12, { type: 'sawtooth', slide: 1200, vol: 0.08, lp: 3000 });
          this.tone(1600, 0.35, { type: 'sawtooth', slide: 300, vol: 0.12, lp: 4000, delay: 0.1 });
          this.noise(0.2, { freq: 3000, vol: 0.15, delay: 0.1 });
          break;
        case 'spawn': this.tone(300, 0.12, { type: 'square', slide: 500, vol: 0.02, lp: 1200 }); break;
        case 'wave':
          this.tone(midi(69), 0.15, { type: 'square', vol: 0.06, lp: 2000 });
          this.tone(midi(76), 0.3, { type: 'square', vol: 0.06, lp: 2000, delay: 0.15, send: true });
          break;
        case 'klaxon': // boss alarm
          for (let i = 0; i < 3; i++) { this.tone(440, 0.35, { type: 'sawtooth', slide: 330, vol: 0.08, lp: 1800, delay: i * 0.45 }); }
          this.tone(55, 1.5, { type: 'sawtooth', vol: 0.1, lp: 300 });
          break;
        case 'clear':
          [69, 72, 76, 79, 81].forEach((n, i) => this.tone(midi(n), 0.3, { type: 'square', vol: 0.05, lp: 2600, delay: i * 0.08, send: true }));
          break;
        case 'upgrade':
          this.tone(midi(81), 0.4, { type: 'triangle', vol: 0.08, send: true });
          this.tone(midi(88), 0.5, { type: 'triangle', vol: 0.06, delay: 0.08, send: true });
          this.noise(0.4, { freq: 7000, filter: 'highpass', vol: 0.05 });
          break;
        case 'secondWind': this.tone(200, 0.5, { type: 'sawtooth', slide: 900, vol: 0.1, lp: 2500 }); break;
        case 'won':
          [[57, 0], [60, 0.15], [64, 0.3], [69, 0.45], [72, 0.7], [76, 0.85], [81, 1.0]].forEach(([n, d]) => this.tone(midi(n), 0.5, { type: 'square', vol: 0.06, lp: 3000, delay: d, send: true }));
          break;
        case 'lost':
          [69, 65, 62, 57].forEach((n, i) => this.tone(midi(n), 0.5, { type: 'sawtooth', vol: 0.06, lp: 1200, delay: i * 0.3 }));
          break;
        case 'join': this.tone(midi(76), 0.08, { type: 'square', vol: 0.05, lp: 2500 }); this.tone(midi(83), 0.15, { type: 'square', vol: 0.05, lp: 2500, delay: 0.07, send: true }); break;
        case 'leave': this.tone(700, 0.25, { type: 'square', slide: 200, vol: 0.04, lp: 1500 }); break;
        case 'ready': this.tone(midi(69), 0.1, { type: 'triangle', vol: 0.08 }); this.tone(midi(81), 0.2, { type: 'triangle', vol: 0.08, delay: 0.08, send: true }); break;
        case 'pick': this.tone(1300, 0.04, { type: 'sine', vol: 0.06 }); this.tone(1950, 0.05, { type: 'sine', vol: 0.04, delay: 0.03 }); break;
        case 'move': this.tone(1600, 0.03, { type: 'sine', vol: 0.05 }); break;
        case 'ok': this.tone(880, 0.05, { type: 'square', vol: 0.04, lp: 3000 }); this.tone(1320, 0.08, { type: 'square', vol: 0.04, lp: 3000, delay: 0.05 }); break;
        case 'back': this.tone(990, 0.08, { type: 'square', slide: 500, vol: 0.04, lp: 2500 }); break;
        case 'pause': this.tone(660, 0.15, { type: 'triangle', vol: 0.06, send: true }); break;
      }
    },

    // ---- music: synthwave in A minor, scheduled ahead ----
    startMusic() { if (!this.ctx || this.playing) return; this.playing = true; this.nextT = this.ctx.currentTime + 0.08; this.stepN = 0; },
    tick() {
      if (!this.ctx || !this.playing || this.ctx.state !== 'running') return;
      const bpm = this.calm ? 96 : this.boss ? 132 : 112 + Math.min(14, this.wave);
      const spb = 60 / bpm / 4; // sixteenths
      if (this.nextT < this.ctx.currentTime - 0.3) this.nextT = this.ctx.currentTime + 0.05;
      while (this.nextT < this.ctx.currentTime + 0.12) { this.step(this.stepN++, this.nextT, spb); this.nextT += spb; }
    },
    step(n, t, spb) {
      const bus = this.musBus, s = n % 128, bar = Math.floor(s / 16), e = s % 16;
      const calm = this.calm, boss = this.boss, w = this.wave;
      // Am F C G, or a darker Am Bb Am E for bosses
      const PROG = boss ? [[57, 0], [58, 1], [57, 0], [52, 2]] : [[57, 0], [53, 1], [48, 1], [55, 1]];
      const [root, q] = PROG[Math.floor(bar / 2) % 4];
      const third = q === 0 ? 3 : q === 2 ? 4 : 4;
      // pad at the start of each chord
      if (e === 0 && bar % 2 === 0) for (const iv of [0, third, 7]) for (const dt of [-8, 8]) this.tone(midi(root + iv), spb * 32, { type: 'sawtooth', vol: calm ? 0.018 : 0.012, lp: calm ? 900 : 1400, attack: 0.4, detune: dt, at: t, bus });
      // bass
      if (!calm || e % 4 === 0) {
        const bn = root - 24 + (e % 8 === 6 ? 7 : 0);
        if (e % 2 === 0 || boss) this.tone(midi(bn), spb * 1.8, { type: 'sawtooth', vol: 0.09, lp: 500, lpTo: 200, at: t, bus });
      }
      // arpeggio through the echo
      const ARP = [0, 7, 12, third, 7, 12 + third, 12, 7];
      if (!calm || e % 2 === 0) {
        const an = root + 12 + ARP[(e + (bar % 2) * 3) % 8];
        this.tone(midi(an), spb * 0.9, { type: 'square', vol: calm ? 0.018 : 0.022, lp: 2200 + Math.min(2000, w * 120), at: t, bus, send: true });
      }
      // drum machine grows with the waves
      if (!calm) {
        if (e % 4 === 0) this.tone(120, 0.16, { type: 'sine', slide: 42, vol: 0.4, at: t, bus });
        if (e === 4 || e === 12) this.noise(0.14, { freq: 1600, q: 0.7, vol: 0.12, at: t, bus });
        if (w >= 3 && e % 2 === 1) this.noise(0.025, { freq: 9000, filter: 'highpass', vol: 0.04, at: t, bus });
        if ((w >= 6 || boss) && e % 4 === 2) this.noise(0.08, { freq: 8000, filter: 'highpass', vol: 0.05, at: t, bus });
        if (boss && e % 8 === 7) this.tone(midi(root + 24), spb * 2, { type: 'sawtooth', vol: 0.03, lp: 3000, at: t, bus });
      }
    },
  };
  MS.Audio = A;
})();
