// Every sound is made here with WebAudio: no files. Three buses (effects,
// engines, music) under one master. The engines are live oscillators whose
// pitch follows each human kart's speed through five gears; the soundtrack is
// a small generative garage-rock band whose riff is seeded by the track and
// which shifts key and doubles its hats on the final lap.
(function () {
  const KR = window.KR;

  const A = {
    ctx: null, master: null, sfxBus: null, musicBus: null, engineBus: null,
    sfxVol: 0.8, musicVol: 0.6, muted: false,
    engines: [], noiseBuf: null, shaper: null,
    style: null, styleKey: null, song: null, step: 0, next: 0, finalLap: false,

    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      this.master = c.createGain();
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.engineBus = c.createGain(); this.engineBus.connect(this.master);
      this.musicBus = c.createGain(); this.musicBus.connect(this.master);
      this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // a soft clipper gives the bass and engines their grit
      this.shaper = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = (i / 1023) * 2 - 1; this.shaper[i] = Math.tanh(x * 3.2); }
      this.applyVolumes();
    },

    setVolumes(sfx, music) { this.sfxVol = sfx / 10; this.musicVol = music / 10; this.applyVolumes(); },
    applyVolumes() {
      if (!this.ctx) return;
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.sfxBus.gain.value = this.sfxVol;
      this.engineBus.gain.value = this.sfxVol * 0.8;
      this.musicBus.gain.value = this.musicVol * 0.5;
    },
    get now() { return this.ctx ? this.ctx.currentTime : 0; },

    // ---------- building blocks ----------
    osc(type, f, t, dur, vol, bus, o = {}) {
      const c = this.ctx;
      const s = c.createOscillator(), g = c.createGain();
      s.type = type;
      s.frequency.setValueAtTime(f, t);
      if (o.slide) s.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + (o.slideT || dur));
      if (o.detune) s.detune.value = o.detune;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = s;
      if (o.filter) {
        const f2 = c.createBiquadFilter();
        f2.type = o.filter; f2.frequency.value = o.cut || 1200; f2.Q.value = o.q || 1;
        if (o.cutTo) f2.frequency.exponentialRampToValueAtTime(o.cutTo, t + dur);
        s.connect(f2); node = f2;
      }
      if (o.drive) { const w = c.createWaveShaper(); w.curve = this.shaper; node.connect(w); node = w; }
      node.connect(g); g.connect(bus || this.sfxBus);
      s.start(t); s.stop(t + dur + 0.05);
      return s;
    },
    noise(t, dur, vol, type, freq, bus, o = {}) {
      const c = this.ctx;
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf;
      f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq || 2000, t); f.Q.value = o.q || 0.8;
      if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(bus || this.sfxBus);
      s.start(t, Math.random() * 1.5, dur + 0.05);
    },
    // a struck piece of steel: inharmonic partials that ring and fade
    clank(t, f, vol, bus, len = 0.35) {
      [1, 2.76, 5.4, 8.93].forEach((m, i) => this.osc('sine', f * m, t, len / (1 + i * 0.6), vol / (1 + i), bus));
      this.noise(t, 0.03, vol * 0.8, 'highpass', 3000, bus);
    },

    play(name, o = {}) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime + (o.delay || 0);
      const v = o.vol === undefined ? 1 : o.vol;
      switch (name) {
        case 'move': // ratchet tick
          this.noise(t, 0.025, 0.18 * v, 'bandpass', 4200, null, { q: 4 });
          this.osc('square', 1900, t, 0.02, 0.03 * v);
          break;
        case 'select': // spanner on steel
          this.clank(t, 620, 0.09 * v);
          break;
        case 'back':
          this.clank(t, 410, 0.07 * v, null, 0.2);
          break;
        case 'deny':
          this.osc('square', 140, t, 0.12, 0.08 * v, null, { filter: 'lowpass', cut: 900 });
          this.osc('square', 110, t + 0.09, 0.14, 0.08 * v, null, { filter: 'lowpass', cut: 900 });
          break;
        case 'fit': // impact wrench: a buzzing burst then a clunk
          for (let i = 0; i < 7; i++) this.noise(t + i * 0.022, 0.02, 0.14 * v, 'bandpass', 1500 + i * 80, null, { q: 3 });
          this.osc('sawtooth', 180, t, 0.16, 0.05 * v, null, { slide: 260, filter: 'lowpass', cut: 1400 });
          this.clank(t + 0.17, 300, 0.1 * v);
          this.osc('sine', 80, t + 0.17, 0.18, 0.25 * v, null, { slide: 45 });
          break;
        case 'remove':
          this.osc('sawtooth', 260, t, 0.14, 0.05 * v, null, { slide: 150, filter: 'lowpass', cut: 1200 });
          this.clank(t + 0.1, 520, 0.05 * v, null, 0.2);
          break;
        case 'rev': // engine blip when an engine part goes in
          this.osc('sawtooth', 55, t, 0.6, 0.12 * v, null, { slide: 140, slideT: 0.25, filter: 'lowpass', cut: 600, cutTo: 300, drive: true });
          this.osc('square', 27, t, 0.6, 0.08 * v, null, { slide: 70, slideT: 0.25, filter: 'lowpass', cut: 400 });
          break;
        case 'light':
          this.osc('square', 440, t, 0.22, 0.08 * v, null, { filter: 'lowpass', cut: 2000 });
          break;
        case 'go':
          this.osc('square', 880, t, 0.6, 0.09 * v, null, { filter: 'lowpass', cut: 3000 });
          this.osc('square', 885, t, 0.6, 0.06 * v);
          break;
        case 'boost':
          this.noise(t, 1.1, 0.35 * v, 'lowpass', 500, null, { to: 2500, attack: 0.05 });
          this.osc('sawtooth', 90, t, 0.9, 0.08 * v, null, { slide: 220, filter: 'lowpass', cut: 900, drive: true });
          this.noise(t, 0.12, 0.3 * v, 'highpass', 2500);
          break;
        case 'hop': // spring boing
          { const s = this.osc('triangle', 180, t, 0.45, 0.16 * v, null, { slide: 520, slideT: 0.12 });
            const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
            lfo.frequency.value = 26; lg.gain.value = 40; lfo.connect(lg); lg.connect(s.frequency); lfo.start(t); lfo.stop(t + 0.5); }
          break;
        case 'land':
          this.osc('sine', 120, t, 0.12, 0.2 * v, null, { slide: 60 });
          this.noise(t, 0.08, 0.1 * v, 'lowpass', 600);
          break;
        case 'oil': // tyre squeal and a skid
          { const s = this.osc('sawtooth', 1300, t, 0.6, 0.035 * v, null, { slide: 900, filter: 'bandpass', cut: 1600, q: 6 });
            const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
            lfo.frequency.value = 9; lg.gain.value = 80; lfo.connect(lg); lg.connect(s.frequency); lfo.start(t); lfo.stop(t + 0.6); }
          this.noise(t, 0.5, 0.12 * v, 'bandpass', 900, null, { to: 400 });
          break;
        case 'bump':
          this.osc('sine', 90, t, 0.18, 0.3 * v, null, { slide: 50 });
          this.clank(t, 240, 0.06 * v, null, 0.25);
          this.noise(t, 0.08, 0.15 * v, 'lowpass', 1200);
          break;
        case 'wall':
          this.noise(t, 0.35, 0.18 * v, 'bandpass', 2400, null, { to: 700 });
          this.clank(t, 180, 0.05 * v, null, 0.3);
          break;
        case 'grass':
          this.noise(t, 0.3, 0.08 * v, 'lowpass', 500);
          break;
        case 'bolt': // a nut dropping into a tin
          this.clank(t, 1500, 0.05 * v, null, 0.25);
          this.osc('sine', 2400, t + 0.04, 0.1, 0.04 * v);
          break;
        case 'canister':
          this.osc('square', 330, t, 0.1, 0.06 * v, null, { filter: 'lowpass', cut: 2000 });
          this.osc('square', 495, t + 0.07, 0.1, 0.06 * v, null, { filter: 'lowpass', cut: 2000 });
          this.osc('square', 660, t + 0.14, 0.18, 0.06 * v, null, { filter: 'lowpass', cut: 2500 });
          break;
        case 'lap':
          this.clank(t, 880, 0.1 * v, null, 0.8);
          break;
        case 'final': // two-tone horn
          [0, 0.28].forEach((d, i) => { this.osc('sawtooth', i ? 466 : 554, t + d, 0.26, 0.05 * v, null, { filter: 'lowpass', cut: 1800 }); this.osc('sawtooth', i ? 349 : 415, t + d, 0.26, 0.05 * v, null, { filter: 'lowpass', cut: 1800 }); });
          break;
        case 'pass':
          this.osc('square', 660, t, 0.06, 0.04 * v); this.osc('square', 990, t + 0.06, 0.08, 0.04 * v);
          break;
        case 'lost':
          this.osc('square', 500, t, 0.06, 0.03 * v); this.osc('square', 340, t + 0.06, 0.08, 0.03 * v);
          break;
        case 'finish': // air horn chord + crowd
          [311, 392, 466].forEach((f) => this.osc('sawtooth', f, t, 1.0, 0.04 * v, null, { filter: 'lowpass', cut: 2200 }));
          this.noise(t, 2.2, 0.08 * v, 'bandpass', 1400, null, { attack: 0.3, q: 0.4 });
          break;
        case 'fanfare':
          [0, 4, 7, 12, 7, 12].forEach((s, i) => this.osc('square', 392 * Math.pow(2, s / 12), t + i * 0.12, i === 5 ? 0.6 : 0.14, 0.05 * v, null, { filter: 'lowpass', cut: 3000 }));
          break;
        case 'point':
          this.osc('triangle', 1200 + (o.n || 0) * 60, t, 0.05, 0.06 * v);
          break;
        case 'toggle':
          this.noise(t, 0.015, 0.25 * v, 'highpass', 2000);
          this.osc('square', 220, t, 0.03, 0.06 * v);
          break;
      }
    },

    // ---------- engines (one per human kart) ----------
    engineStart(n) {
      this.engineStop();
      if (!this.ctx) return;
      const c = this.ctx;
      for (let i = 0; i < n; i++) {
        const out = c.createGain(); out.gain.value = 0;
        const pan = c.createStereoPanner ? c.createStereoPanner() : null;
        if (pan) { pan.pan.value = n === 2 ? (i ? 0.45 : -0.45) : 0; out.connect(pan); pan.connect(this.engineBus); } else out.connect(this.engineBus);
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 2;
        const sh = c.createWaveShaper(); sh.curve = this.shaper;
        const a = c.createOscillator(); a.type = 'sawtooth';
        const b = c.createOscillator(); b.type = 'square';
        const chug = c.createOscillator(); chug.type = 'sine';
        const chugG = c.createGain(); chugG.gain.value = 0.35;
        const body = c.createGain(); body.gain.value = 0.6;
        chug.connect(chugG); chugG.connect(body.gain);
        a.connect(sh); b.connect(sh); sh.connect(lp); lp.connect(body); body.connect(out);
        // boost roar: filtered noise that opens up while a canister burns
        const ns = c.createBufferSource(); ns.buffer = this.noiseBuf; ns.loop = true;
        const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 800; nf.Q.value = 0.7;
        const ng = c.createGain(); ng.gain.value = 0;
        ns.connect(nf); nf.connect(ng); ng.connect(out);
        [a, b, chug, ns].forEach((s) => s.start());
        this.engines.push({ out, lp, a, b, chug, ng, nf, gear: 1, rpm: 0 });
      }
    },
    engineStop() {
      for (const e of this.engines) {
        try { e.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); [e.a, e.b, e.chug].forEach((s) => s.stop(this.ctx.currentTime + 0.3)); } catch (err) { /* already stopped */ }
      }
      this.engines = [];
    },
    // speed 0..~32, gas 0..1, boosting bool; returns the gear (for the HUD)
    engineSet(i, speed, gas, boosting, paused) {
      const e = this.engines[i];
      if (!e || !this.ctx) return 1;
      const t = this.ctx.currentTime;
      const GEARS = [0, 6, 11, 16, 21, 99];
      let g = 1;
      while (g < 5 && speed > GEARS[g]) g++;
      const lo = GEARS[g - 1], hi = Math.min(GEARS[g], 30);
      const rpm = Math.max(0, Math.min(1, (speed - lo) / (hi - lo)));
      e.gear = g; e.rpm = rpm;
      const f = 34 + rpm * 70 + g * 9 + gas * 6;
      e.a.frequency.setTargetAtTime(f, t, 0.04);
      e.b.frequency.setTargetAtTime(f * 0.5, t, 0.04);
      e.chug.frequency.setTargetAtTime(f * 0.25, t, 0.04);
      e.lp.frequency.setTargetAtTime(320 + gas * 900 + rpm * 700, t, 0.05);
      e.out.gain.setTargetAtTime(paused ? 0 : 0.09 + gas * 0.07, t, 0.06);
      e.ng.gain.setTargetAtTime(paused ? 0 : boosting ? 0.22 : 0, t, 0.08);
      e.nf.frequency.setTargetAtTime(boosting ? 1400 : 700, t, 0.1);
      return g;
    },

    // ---------- music ----------
    // garage: a laid-back clav groove with anvil percussion
    // race: driving garage rock, the riff seeded by the track
    // podium: a brassy loop
    STYLES: {
      garage: { bpm: 104, root: 98, scale: [0, 3, 5, 7, 10], kit: 'shop' },
      race: { bpm: 152, root: 82.4, scale: [0, 3, 5, 6, 7, 10], kit: 'rock' },
      podium: { bpm: 120, root: 130.8, scale: [0, 2, 4, 7, 9], kit: 'march' },
    },
    setStyle(name, seed) {
      const key = name + ':' + (seed || 0);
      if (key === this.styleKey) return;
      this.styleKey = key;
      this.style = name ? this.STYLES[name] : null;
      if (!this.style) return;
      let s = (seed + 7) * 2654435761 >>> 0;
      const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let x = Math.imul(s ^ (s >>> 15), s | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
      const riff = [], lead = [];
      for (let i = 0; i < 16; i++) riff.push(i % 4 === 0 ? 0 : rnd() < 0.55 ? Math.floor(rnd() * 4) : -1);
      for (let i = 0; i < 32; i++) lead.push(rnd() < 0.3 ? Math.floor(rnd() * 7) : -1);
      const prog = [[0, 0, 3, 2], [0, 3, 4, 3], [0, 4, 3, 0], [0, 2, 3, 4]][Math.floor(rnd() * 4)];
      this.song = { riff, lead, prog };
      this.step = 0;
      this.next = this.ctx ? this.ctx.currentTime + 0.1 : 0;
    },
    freq(st, deg, oct) {
      const n = st.scale.length, d = ((deg % n) + n) % n, o = oct + Math.floor(deg / n);
      return st.root * Math.pow(2, st.scale[d] / 12 + o) * (this.finalLap && st.kit === 'rock' ? Math.pow(2, 2 / 12) : 1);
    },
    updateMusic() {
      const c = this.ctx;
      if (!c || !this.style || this.muted || this.musicVol <= 0) { if (c) this.next = c.currentTime + 0.1; return; }
      const st = this.style, sg = this.song, bus = this.musicBus;
      const six = 15 / st.bpm;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      while (this.next < c.currentTime + 0.2) {
        const t = this.next, i = this.step, pos = i % 16, bar = Math.floor(i / 16) % 4, chord = sg.prog[bar];
        if (st.kit === 'rock') {
          const r = sg.riff[pos];
          if (r >= 0) {
            const f = this.freq(st, chord + r, 0);
            this.osc('sawtooth', f, t, six * 1.6, 0.06, bus, { filter: 'lowpass', cut: 900, drive: true });
            this.osc('sawtooth', f * 1.5, t, six * 1.6, 0.035, bus, { filter: 'lowpass', cut: 1100, drive: true });
          }
          if (pos === 0 || pos === 8 || pos === 10) this.osc('sine', 120, t, 0.16, 0.5, bus, { slide: 42 });
          if (pos === 4 || pos === 12) { this.noise(t, 0.16, 0.22, 'bandpass', 1900, bus, { q: 0.6 }); this.osc('triangle', 190, t, 0.08, 0.12, bus, { slide: 140 }); }
          if (pos % 2 === 0 || this.finalLap) this.noise(t, 0.03, this.finalLap ? 0.07 : 0.05, 'highpass', 8000, bus);
          if (pos === 0 && bar === 0) this.noise(t, 0.9, 0.08, 'highpass', 5000, bus);
          const L = sg.lead[(i % 32)];
          if (L >= 0 && bar >= 2) this.osc('square', this.freq(st, chord + L, 2), t, six * 2.2, 0.022, bus, { filter: 'lowpass', cut: 2600 });
        } else if (st.kit === 'shop') {
          const r = sg.riff[pos];
          if (r >= 0 && pos % 2 === 0) this.osc('sine', this.freq(st, chord + (r % 3), -1), t, six * 2, 0.22, bus, { slide: this.freq(st, chord, -1) * 0.94, slideT: 0.08 });
          if (pos % 4 === 2 || (r > 1 && pos % 2)) {
            [0, 2, 4].forEach((d) => this.osc('square', this.freq(st, chord + d, 1), t, six * 0.7, 0.018, bus, { filter: 'bandpass', cut: 1400, q: 2.5 }));
          }
          if (pos === 0 || pos === 10) this.osc('sine', 100, t, 0.18, 0.35, bus, { slide: 45 });
          if (pos === 4 || pos === 12) this.clank(t, 760, 0.05, bus, 0.4);
          if (pos % 2 === 1) this.noise(t, 0.04, 0.045, 'bandpass', 5200, bus, { q: 3 });
          const L = sg.lead[i % 32];
          if (L >= 0 && bar % 2 === 1) this.osc('triangle', this.freq(st, chord + L, 1), t, six * 2, 0.035, bus);
        } else {
          if (pos % 4 === 0) this.osc('sine', 110, t, 0.2, 0.3, bus, { slide: 50 });
          if (pos === 4 || pos === 12) this.noise(t, 0.12, 0.12, 'bandpass', 1500, bus);
          if (pos % 2 === 0) [0, 2, 4].forEach((d) => this.osc('sawtooth', this.freq(st, chord + d, 0), t, six * 1.4, 0.016, bus, { filter: 'lowpass', cut: 1800 }));
          const L = sg.lead[i % 32];
          if (L >= 0) this.osc('square', this.freq(st, chord + L, 1), t, six * 1.8, 0.03, bus, { filter: 'lowpass', cut: 2500 });
        }
        this.step++;
        this.next += six;
      }
    },
  };

  KR.Audio = A;
})();
