// Beat Sprint core: namespace, maths helpers, seeded random numbers and the
// save file. Nothing in here touches the page, so the rules files that build
// on it also run under Node (see tools/test-song.js).
(function (root) {
  const BS = (root.BS = root.BS || {});

  BS.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  BS.clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  BS.lerp = (a, b, t) => a + (b - a) * t;
  BS.easeOut = (v) => 1 - Math.pow(1 - BS.clamp01(v), 3);
  BS.easeIn = (v) => Math.pow(BS.clamp01(v), 3);
  BS.easeInOut = (v) => { v = BS.clamp01(v); return v * v * (3 - 2 * v); };
  BS.easeBack = (v) => { v = BS.clamp01(v); return 1 + 2.4 * Math.pow(v - 1, 3) + 1.4 * Math.pow(v - 1, 2); };
  BS.mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  BS.rgb = (c, a) => (a === undefined ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);

  // mulberry32: the same seed gives the same track on every device.
  BS.rng = function (seed) {
    let s = seed >>> 0;
    const rand = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rand.int = (min, max) => min + Math.floor(rand() * (max - min + 1));
    rand.pick = (list) => list[Math.floor(rand() * list.length)];
    return rand;
  };
  BS.hash = (text) => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  BS.today = () => new Date().toISOString().slice(0, 10);
  // Same salt as the first version of the game, so today's track is unchanged.
  BS.dailySeed = () => BS.hash('beat-sprint:' + BS.today());

  // ---------- save ----------
  // One JSON blob under "beat-sprint/v2". Storage can be blocked (private
  // mode, some file:// setups); then the game simply runs without saving.
  const KEY = 'beat-sprint/v2';
  BS.Save = {
    data: null,
    defaults() {
      return {
        // offset: ms the player's taps land late (positive) or early; speed: note-speed multiplier
        settings: { sfx: 7, music: 8, speed: 1, shake: true, flash: true, hints: true, offset: 0, level: 1 },
        best: {},      // "<track id>:<level>" -> { score, grade, pct }
        daily: {},     // "<date>:<level>" -> score
        last: null,    // { seed, mode } of the last track played, for "Replay"
        plays: 0,
      };
    },
    load() {
      const out = this.defaults();
      try {
        const raw = JSON.parse(localStorage.getItem(KEY));
        if (raw && typeof raw === 'object') {
          Object.assign(out.settings, raw.settings || {});
          out.best = raw.best || {};
          out.daily = raw.daily || {};
          out.last = raw.last && typeof raw.last.seed === 'number' ? raw.last : null;
          out.plays = raw.plays || 0;
        } else {
          // First run of the reworked game: carry over the old timing offset and best score.
          const off = JSON.parse(localStorage.getItem('beat-sprint:offset'));
          if (typeof off === 'number') out.settings.offset = Math.round(off * 1000);
          const best = JSON.parse(localStorage.getItem('beat-sprint:best'));
          if (typeof best === 'number' && best > 0) out.best['random:1'] = { score: best, grade: '', pct: 0 };
        }
      } catch (e) { /* defaults */ }
      // Only today's daily score is worth keeping.
      const today = BS.today();
      for (const k of Object.keys(out.daily)) if (k.slice(0, 10) !== today) delete out.daily[k];
      this.data = out;
      return out;
    },
    store() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* not saved */ }
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BS;
})(typeof window !== 'undefined' ? window : globalThis);
