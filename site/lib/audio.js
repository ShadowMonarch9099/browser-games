// Arcade kit: sound effects made in the browser, so games need few audio files.
//
//   Arcade.audio.sfx('coin');                       // a preset
//   Arcade.audio.beep({ freq: 440, dur: 0.1 });     // your own
//   Arcade.audio.muted / Arcade.audio.toggleMute()  // shared by every game on the site
//
// Browsers block sound until the player clicks or presses a key; this unlocks
// itself on the first input.
window.Arcade = window.Arcade || {};

(function () {
  const MUTE_KEY = 'arcade:muted';
  let ctx = null, master = null, muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* storage blocked */ }

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  addEventListener('pointerdown', unlock);
  addEventListener('keydown', unlock);

  const PRESETS = {
    blip: { freq: 520, dur: 0.06, type: 'square', vol: 0.25 },
    select: { freq: 660, slide: 880, dur: 0.09, type: 'square', vol: 0.25 },
    coin: { freq: 880, slide: 1320, dur: 0.12, type: 'square', vol: 0.25 },
    jump: { freq: 300, slide: 620, dur: 0.14, type: 'square', vol: 0.22 },
    hit: { freq: 180, slide: 60, dur: 0.16, type: 'sawtooth', vol: 0.3 },
    thud: { freq: 110, slide: 50, dur: 0.12, type: 'triangle', vol: 0.5 },
    win: { freq: 523, slide: 1046, dur: 0.4, type: 'triangle', vol: 0.35 },
    lose: { freq: 330, slide: 82, dur: 0.5, type: 'sawtooth', vol: 0.28 },
  };

  Arcade.audio = {
    get muted() { return muted; },
    get context() { return ctx; },
    setMuted(m) {
      muted = !!m;
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* storage blocked */ }
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    toggleMute() { this.setMuted(!muted); return muted; },

    // freq in Hz; slide: glide to this frequency; type: sine | square | sawtooth | triangle
    beep({ freq = 440, slide = 0, dur = 0.1, type = 'square', vol = 0.3, delay = 0 } = {}) {
      if (!ctx || muted) return;
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(slide, 1), t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(master);
      osc.start(t); osc.stop(t + dur + 0.02);
    },
    sfx(name, overrides) { this.beep({ ...PRESETS[name], ...overrides }); },
  };
})();
