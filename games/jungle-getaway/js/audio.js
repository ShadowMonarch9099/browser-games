// Jungle Getaway sound: everything is synthesised with WebAudio. Wooden log
// drums, marimba, a breathy flute and shakers for the music; knocks, swishes
// and stone crunches for effects; a filtered-noise rumble for the boulder that
// swells as it closes in. Effects and music have their own volume buses.
(function (root) {
  'use strict';
  const A = {
    ctx: null, master: null, sfxBus: null, musicBus: null, noiseBuf: null,
    sfxVol: 0.8, musicVol: 0.6, muted: false,
    tension: 0, mode: 'menu', step: 0, next: 0,
    rumbleGain: null, rumbleFilter: null,
    combo: 0, comboT: 0,

    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      this.master = c.createGain(); this.master.connect(c.destination);
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      comp.connect(this.master);
      this.sfxBus = c.createGain(); this.sfxBus.connect(comp);
      this.musicBus = c.createGain(); this.musicBus.connect(comp);
      // a short jungle "room": two damped echoes on the music
      const d = c.createDelay(1); d.delayTime.value = 0.27;
      const fb = c.createGain(); fb.gain.value = 0.22;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      this.musicBus.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(comp);
      this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const nd = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      // the boulder: looping brown-ish noise through a low filter
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      this.rumbleFilter = c.createBiquadFilter(); this.rumbleFilter.type = 'lowpass'; this.rumbleFilter.frequency.value = 90; this.rumbleFilter.Q.value = 6;
      this.rumbleGain = c.createGain(); this.rumbleGain.gain.value = 0;
      src.connect(this.rumbleFilter); this.rumbleFilter.connect(this.rumbleGain); this.rumbleGain.connect(this.sfxBus);
      src.start();
      this.apply();
      this.next = c.currentTime + 0.1;
    },

    apply() {
      if (!this.master) return;
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.sfxBus.gain.value = this.sfxVol;
      this.musicBus.gain.value = this.musicVol * 0.55;
    },
    setVolumes(sfx, music) { this.sfxVol = sfx / 10; this.musicVol = music / 10; this.apply(); },

    // ---------- building blocks ----------
    osc(type, f0, f1, dur, vol, at, bus, attack) {
      const c = this.ctx; if (!c) return;
      const t = at || c.currentTime;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus || this.sfxBus);
      o.start(t); o.stop(t + dur + 0.05);
    },
    noise(dur, vol, type, freq, at, bus, q, freq1) {
      const c = this.ctx; if (!c) return;
      const t = at || c.currentTime;
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq || 1000, t);
      if (freq1) f.frequency.exponentialRampToValueAtTime(freq1, t + dur);
      f.Q.value = q || 1;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(bus || this.sfxBus);
      s.start(t, Math.random() * 1.5, dur + 0.05);
    },
    // a struck wooden bar: fundamental plus a bright, fast-dying overtone
    marimba(freq, at, vol, bus) {
      this.osc('sine', freq, freq, 0.5, vol, at, bus, 0.003);
      this.osc('sine', freq * 4, freq * 4, 0.08, vol * 0.35, at, bus, 0.002);
      this.osc('triangle', freq * 2, freq * 2, 0.18, vol * 0.25, at, bus, 0.002);
    },
    logDrum(freq, at, vol, bus) {
      this.osc('sine', freq * 1.6, freq, 0.22, vol, at, bus, 0.002);
      this.noise(0.03, vol * 0.4, 'bandpass', freq * 6, at, bus, 2);
    },
    flute(freq, dur, at, vol, bus) {
      const c = this.ctx; if (!c) return;
      const t = at || c.currentTime;
      const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(freq * 0.985, t); o.frequency.linearRampToValueAtTime(freq, t + 0.06);
      lfo.frequency.value = 5.2; lg.gain.value = freq * 0.012;
      lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.07);
      g.gain.setValueAtTime(vol, t + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus || this.musicBus);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
      this.noise(dur * 0.7, vol * 0.18, 'bandpass', freq * 2, t, bus || this.musicBus, 3);
    },

    // ---------- effects ----------
    play(name, arg) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      switch (name) {
        case 'jump':
          this.logDrum(330, t, 0.22);
          this.noise(0.16, 0.08, 'bandpass', 900, t, null, 1.4, 2600);
          break;
        case 'jump2':
          this.logDrum(495, t, 0.2);
          this.flute(990, 0.16, t + 0.02, 0.05, this.sfxBus);
          break;
        case 'land':
          this.osc('sine', 140, 60, 0.12, 0.18, t);
          this.noise(0.06, 0.07, 'lowpass', 600, t);
          break;
        case 'slide':
          this.noise(0.36, 0.14, 'bandpass', 2400, t, null, 0.9, 500);
          break;
        case 'lane':
          this.noise(0.1, 0.06, 'highpass', 2500, t, null, 0.7);
          break;
        case 'coin': {
          // kalimba ping that climbs while you keep collecting
          this.combo = this.comboT > 0 ? Math.min(this.combo + 1, 9) : 0;
          this.comboT = 0.6;
          const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
          const f = 784 * Math.pow(2, scale[this.combo] / 12);
          this.osc('sine', f, f, 0.32, 0.14, t, null, 0.002);
          this.osc('sine', f * 5.4, f * 5.4, 0.05, 0.04, t, null, 0.001);
          break;
        }
        case 'cleared':
          this.marimba(1175, t, 0.05);
          break;
        case 'stumble':
          this.osc('sine', 110, 45, 0.3, 0.35, t);
          this.noise(0.25, 0.3, 'lowpass', 1400, t, null, 0.7, 200);
          this.osc('sawtooth', 220, 150, 0.22, 0.05, t + 0.04);
          break;
        case 'safe':
          [587, 784, 988].forEach((f, i) => this.marimba(f, t + i * 0.07, 0.09));
          break;
        case 'caught':
          this.osc('sine', 80, 30, 1.1, 0.5, t);
          this.noise(1.2, 0.45, 'lowpass', 900, t, null, 0.8, 80);
          this.noise(0.4, 0.25, 'bandpass', 2400, t + 0.05, null, 1, 600);
          break;
        case 'fell':
          this.osc('sine', 900, 140, 0.9, 0.12, t, null, 0.02);
          this.osc('sine', 70, 40, 0.4, 0.35, t + 0.85);
          this.noise(0.4, 0.2, 'lowpass', 700, t + 0.85);
          break;
        case 'move':
          this.osc('sine', 1300, 1300, 0.05, 0.08, t, null, 0.001);
          this.noise(0.02, 0.05, 'bandpass', 3000, t, null, 3);
          break;
        case 'confirm':
          this.marimba(587, t, 0.12); this.marimba(880, t + 0.07, 0.12);
          break;
        case 'back':
          this.marimba(659, t, 0.1); this.marimba(440, t + 0.07, 0.1);
          break;
        case 'denied':
          this.logDrum(150, t, 0.2);
          break;
        case 'start':
          this.logDrum(196, t, 0.25); this.logDrum(196, t + 0.14, 0.2); this.logDrum(294, t + 0.28, 0.28);
          this.flute(587, 0.5, t + 0.28, 0.08, this.sfxBus);
          break;
        case 'mission':
          [587, 698, 880, 1175].forEach((f, i) => this.marimba(f, t + i * 0.1, 0.12));
          this.flute(1175, 0.7, t + 0.4, 0.07, this.sfxBus);
          break;
        case 'best':
          [440, 587, 740, 880].forEach((f, i) => this.marimba(f, t + i * 0.08, 0.1));
          break;
        case 'tick':
          this.osc('sine', 2000, 2000, 0.03, 0.05, t, null, 0.001);
          break;
        case 'pause':
          this.logDrum(240, t, 0.15);
          break;
      }
    },

    // ---------- music ----------
    // D minor pentatonic. Each bar picks a degree path from a seeded motif.
    SCALE: [0, 3, 5, 7, 10],
    note(deg, oct) {
      const s = this.SCALE, n = s.length;
      const d = ((deg % n) + n) % n, o = oct + Math.floor(deg / n);
      return 146.83 * Math.pow(2, s[d] / 12 + o);
    },
    MOTIFS: [
      [0, null, 2, null, 4, 3, null, 2, 0, null, 1, 2, null, null, 4, null],
      [4, null, 3, 2, null, 0, null, 2, 3, null, 4, null, 5, 4, null, null],
      [2, null, null, 4, null, 2, 1, null, 0, null, 2, null, 1, null, 0, null],
    ],
    BASS: [0, 0, 3, 2],

    update(dt) {
      const c = this.ctx; if (!c) return;
      this.comboT = Math.max(0, this.comboT - dt);
      // boulder rumble follows tension (only while running)
      const want = this.mode === 'run' ? 0.05 + this.tension * 0.4 : 0;
      this.rumbleGain.gain.setTargetAtTime(this.muted ? 0 : want, c.currentTime, 0.2);
      this.rumbleFilter.frequency.setTargetAtTime(70 + this.tension * 90, c.currentTime, 0.3);
      if (this.muted || this.musicVol <= 0) { this.next = c.currentTime + 0.1; return; }
      const run = this.mode === 'run';
      const bpm = run ? 112 + this.tension * 16 : 84;
      const s16 = 15 / bpm;
      if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
      const bus = this.musicBus;
      while (this.next < c.currentTime + 0.2) {
        const t = this.next, i = this.step, pos = i % 16, bar = Math.floor(i / 16) % 4;
        const motif = this.MOTIFS[Math.floor(i / 64) % this.MOTIFS.length];
        const root = this.BASS[bar];
        if (run) {
          // log drums: a driving pattern; toms roll when the boulder is close
          if (pos === 0 || pos === 6 || pos === 10) this.logDrum(98, t, 0.2, bus);
          if (pos === 4 || pos === 12) this.logDrum(165, t, 0.14, bus);
          if (pos % 2 === 1) this.noise(0.04, 0.025 + this.tension * 0.02, 'highpass', 6500, t, bus, 0.8);
          if (this.tension > 0.45 && pos >= 12) this.logDrum(130 + (pos - 12) * 22, t, 0.12 * this.tension, bus);
          if (pos % 4 === 0) this.osc('sine', this.note(root, -1), this.note(root, -1), s16 * 3, 0.13, t, bus);
          const m = motif[pos];
          if (m !== null) this.marimba(this.note(root + m, 1), t, 0.07, bus);
          if (bar === 3 && pos === 0) this.flute(this.note(root + 4, 1), s16 * 7, t, 0.05, bus);
        } else {
          // menu: slow marimba arpeggios and a long flute line
          if (pos % 2 === 0) {
            const arp = [0, 2, 4, 2, 5, 4, 2, 1];
            this.marimba(this.note(root + arp[(pos / 2) % 8], 0), t, 0.055, bus);
          }
          if (pos === 0) this.osc('sine', this.note(root, -1), this.note(root, -1), s16 * 14, 0.1, t, bus, 0.05);
          if (pos === 0 && bar % 2 === 0) this.flute(this.note(root + (bar === 0 ? 4 : 3), 1), s16 * 12, t, 0.045, bus);
          if (pos === 8) this.noise(0.12, 0.02, 'highpass', 5000, t, bus, 0.5);
        }
        this.step++;
        this.next += s16;
      }
    },
    setMode(m) { if (m !== this.mode) { this.mode = m; this.step = 0; } },
  };
  root.JG = root.JG || {};
  root.JG.Audio = A;
})(window);
