// Synthesized sound effects and a small generative soundtrack via WebAudio —
// no audio files needed. Effects and music run through separate gain buses so
// each has its own volume setting.
SCE.Audio = {
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  muted: false,
  sfxVol: 0.8,
  musicVol: 0.5,
  tension: 0, // 0 calm .. 1 tense; raised by the game when time is low or a guard is suspicious
  mNext: 0,
  mStep: 0,

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.applyVolumes();
  },

  applyVolumes() {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.sfxBus.gain.value = this.sfxVol;
    this.musicBus.gain.value = this.musicVol * 0.6;
  },

  setMuted(m) {
    this.muted = m;
    this.applyVolumes();
  },

  // Levels are 0-10 as shown in the settings menu.
  setVolumes(sfx, music) {
    this.sfxVol = sfx / 10;
    this.musicVol = music / 10;
    this.applyVolumes();
  },

  tone(freq, dur, opts = {}) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const { type = 'square', vol = 0.15, slide = null, delay = 0, at = null, bus = this.sfxBus } = opts;
    const t = at !== null ? at : ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  noise(dur, vol = 0.2, delay = 0) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime + delay;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf;
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
  },

  play(name) {
    switch (name) {
      case 'clone':
        this.tone(220, 0.25, { type: 'sawtooth', vol: 0.08, slide: 660 });
        this.tone(440, 0.2, { type: 'sine', vol: 0.12, slide: 880, delay: 0.05 });
        break;
      case 'expire':
        this.tone(500, 0.25, { type: 'sine', vol: 0.1, slide: 150 });
        break;
      case 'denied':
        this.tone(120, 0.08, { vol: 0.08 });
        break;
      case 'plate':
        this.tone(330, 0.06, { vol: 0.08 });
        break;
      case 'lever':
        this.tone(260, 0.05, { vol: 0.1 });
        this.tone(390, 0.05, { vol: 0.1, delay: 0.06 });
        break;
      case 'doorOpen':
        this.tone(180, 0.18, { type: 'triangle', vol: 0.15, slide: 360 });
        break;
      case 'doorClose':
        this.tone(300, 0.15, { type: 'triangle', vol: 0.12, slide: 140 });
        break;
      case 'unlock':
        [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', vol: 0.14, delay: i * 0.07 }));
        break;
      case 'pickup':
        this.tone(880, 0.08, { type: 'sine', vol: 0.15 });
        this.tone(1320, 0.12, { type: 'sine', vol: 0.12, delay: 0.06 });
        break;
      case 'key':
        this.tone(660, 0.1, { type: 'triangle', vol: 0.15 });
        this.tone(990, 0.15, { type: 'triangle', vol: 0.15, delay: 0.08 });
        break;
      case 'wisp':
        this.tone(700, 0.15, { type: 'sine', vol: 0.05, slide: 350 });
        break;
      case 'bell':
        [0, 0.35].forEach((d) => {
          this.tone(1046, 0.9, { type: 'sine', vol: 0.18, delay: d });
          this.tone(1568, 0.6, { type: 'sine', vol: 0.06, delay: d });
        });
        break;
      case 'alert':
        this.tone(880, 0.1, { vol: 0.1 });
        this.tone(1175, 0.15, { vol: 0.1, delay: 0.1 });
        break;
      case 'bark':
        this.noise(0.12, 0.25);
        this.tone(160, 0.12, { type: 'sawtooth', vol: 0.15, slide: 90 });
        this.noise(0.12, 0.25, 0.18);
        break;
      case 'caught':
        this.tone(400, 0.5, { type: 'sawtooth', vol: 0.15, slide: 80 });
        this.noise(0.3, 0.15);
        break;
      case 'timeout':
        [440, 370, 311, 262].forEach((f, i) => this.tone(f, 0.18, { type: 'square', vol: 0.1, delay: i * 0.16 }));
        break;
      case 'tick':
        this.tone(1000, 0.04, { type: 'square', vol: 0.05 });
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.15, delay: i * 0.1 }));
        break;
      case 'click':
        this.tone(600, 0.04, { type: 'square', vol: 0.06 });
        break;
      case 'move':
        this.tone(900, 0.025, { type: 'sine', vol: 0.05 });
        break;
      case 'swap':
        this.tone(520, 0.08, { type: 'sine', vol: 0.09, slide: 780 });
        break;
      case 'swapBack':
        this.tone(780, 0.08, { type: 'sine', vol: 0.09, slide: 520 });
        break;
      case 'suspect':
        this.tone(660, 0.12, { type: 'triangle', vol: 0.08, slide: 990 });
        break;
      case 'star':
        this.tone(1175, 0.12, { type: 'triangle', vol: 0.12 });
        this.tone(1568, 0.18, { type: 'sine', vol: 0.08, delay: 0.05 });
        break;
      case 'start':
        this.tone(392, 0.1, { type: 'triangle', vol: 0.1 });
        this.tone(587, 0.16, { type: 'triangle', vol: 0.1, delay: 0.08 });
        break;
    }
  },

  // Generative soundtrack: a low drone plus sparse plucks from D minor
  // pentatonic, scheduled a little ahead of the audio clock. Call every frame.
  // Tension adds a pulse on every beat and pushes the plucks higher.
  updateMusic() {
    const ctx = this.ctx;
    if (!ctx || this.muted || this.musicVol <= 0) {
      if (ctx) this.mNext = ctx.currentTime + 0.1;
      return;
    }
    const STEP = 0.32;
    const SCALE = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0];
    const bus = this.musicBus;
    if (this.mNext < ctx.currentTime) this.mNext = ctx.currentTime + 0.05;
    while (this.mNext < ctx.currentTime + 0.25) {
      const t = this.mNext;
      const i = this.mStep;
      if (i % 32 === 0) {
        this.tone(73.42, STEP * 34, { type: 'sine', vol: 0.12, at: t, bus });
        this.tone(110.0, STEP * 34, { type: 'triangle', vol: 0.03, at: t, bus });
      }
      // deterministic but irregular pluck pattern
      const h = (i * 2654435761) >>> 0;
      if (h % 7 < 2) {
        const n = SCALE[(h >>> 8) % SCALE.length] * (this.tension > 0.5 && h % 3 === 0 ? 2 : 1);
        this.tone(n, 1.4, { type: 'triangle', vol: 0.035, at: t, bus });
      }
      if (this.tension > 0 && i % 2 === 0) {
        this.tone(55, 0.18, { type: 'sine', vol: 0.12 * this.tension, at: t, bus });
      }
      this.mStep++;
      this.mNext += this.tension > 0.5 ? STEP * 0.75 : STEP;
    }
  },
};
