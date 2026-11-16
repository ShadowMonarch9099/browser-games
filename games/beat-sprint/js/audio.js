// Beat Sprint audio: every sound is synthesized with WebAudio. The track
// player schedules the composed song a little ahead of the audio clock; the
// game reads the same clock to judge presses, so timing never depends on
// frame rate. Effects and music have separate volume buses.
(function () {
  const BS = window.BS;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const A = {
    ctx: null, master: null, sfxBus: null, musicBus: null, filter: null, analyser: null, delay: null, delayIn: null,
    sfxVol: 0.7, musicVol: 0.8,
    clock: { src: null, off: 0, last: 0 },
    song: null, songStart: 0, cursor: 0, held: false, heldAt: 0,
    songOut: null, songSend: null, padBus: null,
    menuOn: false, menuOut: null, menuNext: 0, menuStep: 0,
    bins: null,

    // Called on the first key, tap or button: browsers only allow sound after input.
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { this.ctx = new AC(); } catch (e2) { return; } }
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = 0.85;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -10; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.18;
      this.master.connect(comp); comp.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.musicBus = c.createGain();
      this.filter = c.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 20000; this.filter.Q.value = 0.7;
      this.musicBus.connect(this.filter); this.filter.connect(this.master);
      this.analyser = c.createAnalyser(); this.analyser.fftSize = 256; this.analyser.smoothingTimeConstant = 0.72;
      this.filter.connect(this.analyser);
      this.bins = new Uint8Array(this.analyser.frequencyBinCount);
      // one tempo-synced echo shared by leads, arpeggios and menu bells
      this.delayIn = c.createGain();
      this.delay = c.createDelay(1.5); this.delay.delayTime.value = 0.36;
      const fb = c.createGain(); fb.gain.value = 0.36;
      const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600;
      this.delayIn.connect(this.delay); this.delay.connect(tone); tone.connect(fb); fb.connect(this.delay); tone.connect(this.musicBus);
      this.applyVolumes();
      if (c.state === 'suspended') c.resume().catch(() => {});
    },

    applyVolumes() {
      if (!this.ctx) return;
      this.sfxBus.gain.value = this.sfxVol * 0.9;
      this.musicBus.gain.value = this.musicVol * 0.75;
    },
    setVolumes(sfx, music) { this.sfxVol = sfx / 10; this.musicVol = music / 10; this.applyVolumes(); },

    // ---------- the clock ----------
    // Song time comes from the audio clock while audio is running, and from the
    // system clock otherwise (no WebAudio, or the context not started yet). The
    // value stays continuous when the source switches.
    running() { return !!this.ctx && this.ctx.state === 'running'; },
    now() {
      const c = this.clock, run = this.running();
      const raw = run ? this.ctx.currentTime : performance.now() / 1000;
      const src = run ? 'a' : 'p';
      if (src !== c.src) { c.off = c.last - raw; c.src = src; }
      c.last = Math.max(c.last, raw + c.off);
      return c.last;
    },
    // Clock time of an input event: events are handled a little after they happen.
    eventTime(e) {
      const lag = e && e.timeStamp ? (performance.now() - e.timeStamp) / 1000 : 0;
      return this.now() - BS.clamp(lag, 0, 0.05);
    },
    toCtx(t) { return t - this.clock.off; },

    // ---------- voices ----------
    osc(at, type, freq, dur, vol, dest, o) {
      const c = this.ctx, osc = c.createOscillator(), g = c.createGain();
      o = o || {};
      osc.type = type; osc.frequency.setValueAtTime(freq, at);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, at + (o.slideT || dur));
      if (o.det) osc.detune.value = o.det;
      const a = o.attack || 0.004;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + a);
      if (o.sustain) { g.gain.setValueAtTime(vol, at + Math.max(a, dur - (o.release || 0.05))); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); }
      else g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(g); g.connect(dest);
      if (o.send) { const s = c.createGain(); s.gain.value = o.sendAmt || 0.3; g.connect(s); s.connect(o.send); }
      osc.start(at); osc.stop(at + dur + 0.03);
      return g;
    },
    noiseBuf: null,
    noise(at, dur, vol, dest, type, freq, q) {
      const c = this.ctx;
      if (!this.noiseBuf) {
        this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; f.type = type || 'highpass'; f.frequency.value = freq || 6000; if (q) f.Q.value = q;
      g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      s.connect(f); f.connect(g); g.connect(dest);
      s.start(at, Math.random() * 0.6, dur + 0.03);
    },

    // ---------- effects ----------
    sfx(name, arg) {
      if (!this.running() || this.sfxVol <= 0) return;
      const t = this.ctx.currentTime, b = this.sfxBus;
      switch (name) {
        case 'nav': this.osc(t, 'sine', 1180, 0.05, 0.1, b, { slide: 1560 }); break;
        case 'ok':
          this.osc(t, 'square', 660, 0.1, 0.05, b); this.osc(t, 'square', 990, 0.12, 0.04, b, { det: 8 });
          this.osc(t + 0.05, 'sine', 1980, 0.14, 0.05, b); break;
        case 'back': this.osc(t, 'triangle', 620, 0.1, 0.11, b, { slide: 310 }); break;
        case 'tick': this.osc(t, 'square', 900 + (arg || 0) * 60, 0.03, 0.05, b); break;
        case 'toggle': this.osc(t, 'triangle', arg ? 880 : 520, 0.07, 0.1, b, { slide: arg ? 1320 : 390 }); break;
        case 'hit': {
          // The press "plays" the pad's own note, so hits stay in key with the track.
          const f = hz(arg.n) * 2;
          this.osc(t, 'triangle', f, 0.1, 0.13, b);
          this.noise(t, 0.03, 0.09, b, 'highpass', 7000);
          if (arg.perfect) { this.osc(t, 'sine', f * 2, 0.16, 0.07, b); this.osc(t + 0.03, 'sine', f * 3, 0.12, 0.035, b); }
          break;
        }
        case 'miss':
          this.osc(t, 'sawtooth', 118, 0.2, 0.12, b, { slide: 62 }); this.osc(t, 'sawtooth', 124, 0.2, 0.09, b, { slide: 66 });
          this.noise(t, 0.12, 0.12, b, 'lowpass', 900); break;
        case 'combo': [0, 1, 2].forEach((i) => this.osc(t + i * 0.045, 'square', 880 * Math.pow(1.26, i + (arg || 0) * 0.5), 0.08, 0.045, b)); break;
        case 'fail':
          this.osc(t, 'sawtooth', 420, 1.1, 0.14, b, { slide: 38 }); this.osc(t, 'square', 210, 1.1, 0.06, b, { slide: 30 });
          this.noise(t, 0.7, 0.1, b, 'lowpass', 1400); break;
        case 'clear': [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.osc(t + i * 0.075, 'square', 392 * Math.pow(2, s / 12), 0.2, 0.05, b, { det: 6 })); break;
        case 'count': this.osc(t, 'sine', 880, 0.07, 0.16, b); this.noise(t, 0.015, 0.05, b, 'highpass', 5000); break;
        case 'go': this.osc(t, 'sine', 1320, 0.2, 0.16, b); this.osc(t, 'triangle', 1980, 0.25, 0.06, b); break;
        case 'whoosh': this.noise(t, 0.35, 0.12, b, 'bandpass', 900, 1.2); this.osc(t, 'sine', 200, 0.3, 0.05, b, { slide: 900 }); break;
        case 'grade': this.osc(t, 'sawtooth', 220, 0.35, 0.07, b, { slide: 880 }); this.osc(t + 0.12, 'square', 1320, 0.25, 0.05, b); break;
      }
    },
    // Calibration metronome, scheduled on the audio clock.
    clickAt(clockTime, accent) {
      if (!this.running()) return;
      const at = Math.max(this.ctx.currentTime, this.toCtx(clockTime));
      this.osc(at, 'square', accent ? 1500 : 1000, 0.05, 0.22, this.sfxBus);
    },
    // The run failed: sweep the music down into a muffled thud and fade it.
    powerDown() {
      if (!this.running() || !this.songOut) { this.holdSong(); return; }
      const t = this.ctx.currentTime, f = this.filter.frequency;
      f.cancelScheduledValues(t); f.setValueAtTime(Math.min(f.value, 9000), t); f.exponentialRampToValueAtTime(90, t + 1.1);
      this.heldAt = this.now() - this.songStart; this.held = true;
      this._kill(1.2);
    },
    // Dull the music for a moment when a pad is missed.
    duck() {
      if (!this.running()) return;
      const t = this.ctx.currentTime, f = this.filter.frequency;
      f.cancelScheduledValues(t); f.setValueAtTime(500, t); f.exponentialRampToValueAtTime(18000, t + 0.45);
    },

    // ---------- the track player ----------
    _nodes() {
      const c = this.ctx;
      this.songOut = c.createGain(); this.songOut.gain.value = 1; this.songOut.connect(this.musicBus);
      this.songSend = c.createGain(); this.songSend.gain.value = 1; this.songSend.connect(this.delayIn);
      this.padBus = c.createGain(); this.padBus.connect(this.songOut);
      if (this.song) this.delay.delayTime.value = this.song.beat * 0.75;
    },
    _kill(fade) {
      const out = this.songOut, send = this.songSend, pad = this.padBus;
      this.songOut = this.songSend = this.padBus = null;
      if (!out) return;
      try {
        const t = this.ctx.currentTime;
        out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0.0001, t + Math.max(0.03, fade || 0));
        send.gain.setValueAtTime(0, t);
      } catch (e) { /* context closed */ }
      setTimeout(() => { try { out.disconnect(); send.disconnect(); pad.disconnect(); } catch (e) { /* gone */ } }, (fade || 0) * 1000 + 120);
    },
    // Start `song` so that song time `from` happens `delay` seconds from now.
    startSong(song, from, delay) {
      this._kill(0.05);
      this.song = song; this.held = false;
      this.songStart = this.now() + delay - from;
      this.cursor = 0;
      while (this.cursor < song.events.length && song.events[this.cursor].t < from) this.cursor++;
      if (this.ctx) { this._nodes(); this.filter.frequency.cancelScheduledValues(0); this.filter.frequency.value = 20000; }
    },
    songTime() { return this.held ? this.heldAt : this.now() - this.songStart; },
    holdSong() {
      if (!this.song || this.held) return;
      this.heldAt = this.now() - this.songStart; this.held = true;
      this._kill(0.06);
    },
    // Pick the track up again a little before where it stopped.
    resumeSong(rewind, delay) {
      if (!this.song) return;
      const from = Math.max(0, this.heldAt - rewind);
      const song = this.song;
      this.startSong(song, from, delay || 0);
    },
    stopSong(fade) { this._kill(fade || 0.05); this.song = null; this.held = false; },

    // Schedule everything that starts within `ahead` seconds. Called every frame.
    pump(ahead) {
      const now = this.now();
      if (this.song && !this.held) {
        const ev = this.song.events, until = now + ahead, live = this.clock.src === 'a';
        if (live && !this.songOut) this._nodes();
        while (this.cursor < ev.length && this.songStart + ev[this.cursor].t < until) {
          const e = ev[this.cursor++], at = this.songStart + e.t;
          if (live && at > now - 0.03) this._play(e, Math.max(this.ctx.currentTime, this.toCtx(at)));
        }
      }
      if (this.menuOn && this.running()) this._menu(ahead);
    },
    _play(e, at) {
      const out = this.songOut, st = this.song.style, v = e.v === undefined ? 1 : e.v;
      switch (e.k) {
        case 'kick': {
          this.osc(at, 'sine', 165, 0.24, 0.95 * v, out, { slide: 42, slideT: 0.13 });
          this.osc(at, 'triangle', 900, 0.025, 0.25 * v, out, { slide: 200 });
          // sidechain pump: pads dip on every kick
          const g = this.padBus.gain;
          g.cancelScheduledValues(at); g.setValueAtTime(0.3, at); g.linearRampToValueAtTime(1, at + this.song.beat * 0.85);
          break;
        }
        case 'snare': this.noise(at, 0.17, 0.42 * v, out, 'bandpass', 1900, 0.7); this.osc(at, 'triangle', 196, 0.09, 0.22 * v, out, { slide: 140 }); break;
        case 'hat': this.noise(at, 0.035, 0.13 * v, out, 'highpass', 8200); break;
        case 'ohat': this.noise(at, 0.2, 0.12 * v, out, 'highpass', 7400); break;
        case 'clap': for (let i = 0; i < 3; i++) this.noise(at + i * 0.011, i === 2 ? 0.14 : 0.03, 0.24 * v, out, 'bandpass', 1250, 1.1); break;
        case 'bass': {
          const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
          o.type = st.bass; o.frequency.value = hz(e.n);
          f.type = 'lowpass'; f.Q.value = 7; f.frequency.setValueAtTime(1100, at); f.frequency.exponentialRampToValueAtTime(170, at + Math.min(e.d, 0.4));
          const vol = st.bass === 'square' ? 0.2 : 0.3;
          g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.008);
          g.gain.setValueAtTime(vol, at + e.d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, at + e.d);
          o.connect(f); f.connect(g); g.connect(out); o.start(at); o.stop(at + e.d + 0.03);
          this.osc(at, 'sine', hz(e.n), e.d, 0.2, out);   // clean sub under the buzz
          break;
        }
        case 'lead': {
          const vol = st.lead === 'triangle' ? 0.16 : 0.062;
          const o = { det: -7, sustain: true, release: 0.07, attack: 0.008, send: this.songSend, sendAmt: 0.32 };
          this.osc(at, st.lead, hz(e.n), e.d, vol, out, o);
          this.osc(at, st.lead, hz(e.n), e.d, vol, out, { det: 7, sustain: true, release: 0.07, attack: 0.008 });
          break;
        }
        case 'arp': this.osc(at, 'square', hz(e.n), e.d, 0.022, out, { send: this.songSend, sendAmt: 0.5 }); break;
        case 'pad': {
          const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
          f.type = 'lowpass'; f.frequency.value = 1150; f.Q.value = 0.8;
          g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(1, at + 0.22);
          g.gain.setValueAtTime(1, at + e.d - 0.1); g.gain.linearRampToValueAtTime(0.0001, at + e.d + 0.3);
          f.connect(g); g.connect(this.padBus);
          for (const n of e.notes) for (const det of [-9, 9]) {
            const o = c.createOscillator(), og = c.createGain();
            o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = det; og.gain.value = 0.02;
            o.connect(og); og.connect(f); o.start(at); o.stop(at + e.d + 0.35);
          }
          break;
        }
      }
    },

    // ---------- menu music: slow chords and stray bells ----------
    menuBeat0: 0,
    MENU_BEAT: 0.75,
    startMenu() {
      if (this.menuOn) return;
      this.menuOn = true; this.menuNext = 0; this.menuStep = 0;
      if (this.filter) { this.filter.frequency.cancelScheduledValues(0); this.filter.frequency.value = 20000; }
    },
    stopMenu() {
      this.menuOn = false;
      const out = this.menuOut; this.menuOut = null;
      if (!out) return;
      try { const t = this.ctx.currentTime; out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0.0001, t + 0.5); } catch (e) { /* closed */ }
      setTimeout(() => { try { out.disconnect(); } catch (e) { /* gone */ } }, 700);
    },
    _menu(ahead) {
      const c = this.ctx;
      if (!this.menuOut) {
        this.menuOut = c.createGain(); this.menuOut.gain.value = 0.0001;
        this.menuOut.gain.linearRampToValueAtTime(1, c.currentTime + 1.2);
        this.menuOut.connect(this.musicBus);
        this.delay.delayTime.value = 0.375;
      }
      const CH = [[45, 52, 57, 60, 64], [41, 48, 57, 60, 65], [43, 50, 59, 62, 67], [40, 52, 55, 59, 64]];
      const step = 0.375;     // eighth notes at 80 bpm
      if (this.menuNext < c.currentTime) {
        this.menuNext = c.currentTime + 0.08;
        // keep the title-screen demo locked to the music's beat grid
        this.menuBeat0 = this.menuNext - this.menuStep * step + this.clock.off;
      }
      while (this.menuNext < c.currentTime + Math.max(0.3, ahead)) {
        const t = this.menuNext, i = this.menuStep, ch = CH[Math.floor(i / 16) % 4], pos = i % 16;
        if (pos === 0) {
          const f = c.createBiquadFilter(), g = c.createGain();
          f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1300, t + 3); f.frequency.linearRampToValueAtTime(500, t + 6);
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 1.5); g.gain.setValueAtTime(1, t + 4.8); g.gain.linearRampToValueAtTime(0.0001, t + 6.6);
          f.connect(g); g.connect(this.menuOut);
          for (const n of ch.slice(0, 4)) for (const det of [-8, 8]) {
            const o = c.createOscillator(), og = c.createGain();
            o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = det; og.gain.value = 0.028;
            o.connect(og); og.connect(f); o.start(t); o.stop(t + 6.7);
          }
        }
        if (pos % 4 === 0) this.osc(t, 'sine', hz(ch[0] - 12), step * 3.5, 0.16, this.menuOut, { attack: 0.03 });
        if (Math.random() < 0.34 || pos === 6) {
          const n = ch[1 + Math.floor(Math.random() * 4)] + (Math.random() < 0.5 ? 12 : 24);
          this.osc(t, 'sine', hz(n), 0.5, 0.05, this.menuOut, { send: this.delayIn, sendAmt: 0.6 });
          this.osc(t, 'triangle', hz(n) * 2, 0.12, 0.012, this.menuOut);
        }
        this.menuStep++; this.menuNext += step;
      }
    },

    // ---------- spectrum for the skyline ----------
    // Fills `out` (Float32Array) with 0..1 levels, low notes first. Returns false when there is no signal.
    levels(out) {
      if (!this.running() || !this.analyser) return false;
      this.analyser.getByteFrequencyData(this.bins);
      const n = out.length, used = 96;
      let sum = 0;
      for (let i = 0; i < n; i++) {
        // wider bands as pitch rises
        const a = Math.floor(Math.pow(i / n, 1.7) * used), b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / n, 1.7) * used));
        let m = 0;
        for (let k = a; k < b; k++) m += this.bins[k];
        out[i] = m / (b - a) / 255; sum += out[i];
      }
      return sum > 0.05;
    },
  };

  BS.Audio = A;
})();
