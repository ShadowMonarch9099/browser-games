// Sky Stack core: namespace, maths, seeded random numbers, save file.
// Nothing here touches the page, so rules.js can run under Node too.
(function (root) {
  const SS = (root.SS = root.SS || {});

  SS.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  SS.clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  SS.lerp = (a, b, t) => a + (b - a) * t;
  SS.easeOut = (v) => 1 - Math.pow(1 - SS.clamp01(v), 3);
  SS.easeInOut = (v) => { v = SS.clamp01(v); return v * v * (3 - 2 * v); };
  SS.easeBack = (v) => { v = SS.clamp01(v); return 1 + 2.4 * Math.pow(v - 1, 3) + 1.4 * Math.pow(v - 1, 2); };
  SS.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  SS.rgb = (c, a) => (a === undefined ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
  // Pick a colour from a list of [stop, rgb] by position.
  SS.ramp = (stops, t) => {
    if (t <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [a, ca] = stops[i - 1], [b, cb] = stops[i];
        return SS.mix(ca, cb, SS.easeInOut((t - a) / (b - a)));
      }
    }
    return stops[stops.length - 1][1];
  };

  // mulberry32, identical to the old shared kit so the daily tower is unchanged.
  SS.rng = function (seed) {
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
  SS.hash = (text) => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  SS.today = () => new Date().toISOString().slice(0, 10);
  // Same as the old Arcade.rng.daily('sky-stack'): today's date, then the salt.
  SS.dailySeed = (day) => SS.hash((day || SS.today()) + 'sky-stack');

  // ---------- save: one blob under "sky-stack/v2" ----------
  const KEY = 'sky-stack/v2';
  SS.Save = {
    data: null,
    defaults() {
      return {
        settings: { sfx: 7, music: 6, shake: true, motion: true, guide: true },
        best: 0,              // classic best height
        daily: {},            // date -> best height that day
        stats: { towers: 0, floors: 0, perfects: 0, bestStreak: 0 },
      };
    },
    load() {
      const out = this.defaults();
      try {
        const raw = JSON.parse(localStorage.getItem(KEY));
        if (raw && typeof raw === 'object') {
          Object.assign(out.settings, raw.settings || {});
          out.best = raw.best || 0;
          out.daily = raw.daily || {};
          Object.assign(out.stats, raw.stats || {});
        } else {
          // first run after the rework: bring over the old kit's records
          const best = JSON.parse(localStorage.getItem('sky-stack:best'));
          if (typeof best === 'number') out.best = best;
          const d = JSON.parse(localStorage.getItem('sky-stack:daily:' + SS.today()));
          if (typeof d === 'number') out.daily[SS.today()] = d;
        }
      } catch (e) { /* defaults */ }
      for (const k of Object.keys(out.daily)) if (k !== SS.today()) delete out.daily[k];
      this.data = out;
      return out;
    },
    store() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* not saved */ }
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SS;
})(typeof window !== 'undefined' ? window : globalThis);
