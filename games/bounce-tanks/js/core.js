// Bounce Tanks: shared helpers, repeatable random numbers and saved settings.
// Plain script (also loads under Node for the headless match test in tools/).
var BT = {};
if (typeof window !== 'undefined') window.BT = BT;
if (typeof module !== 'undefined') module.exports = BT;

(function () {
  BT.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  BT.lerp = (a, b, t) => a + (b - a) * t;
  BT.easeOut = (t) => 1 - Math.pow(1 - BT.clamp(t, 0, 1), 3);
  BT.easeBack = (t) => { t = BT.clamp(t, 0, 1); return 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2); };
  BT.TAU = Math.PI * 2;

  // mulberry32
  BT.rng = function (seed) {
    let s = (seed === undefined ? Math.floor(Math.random() * 4294967296) : seed) >>> 0;
    const rand = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rand.int = (min, max) => min + Math.floor(rand() * (max - min + 1));
    rand.pick = (list) => list[Math.floor(rand() * list.length)];
    rand.range = (a, b) => a + rand() * (b - a);
    rand.shuffle = (list) => {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const t = list[i]; list[i] = list[j]; list[j] = t;
      }
      return list;
    };
    return rand;
  };

  // The four crews. Colour is never the only cue: each also has a badge shape.
  BT.TEAMS = [
    { name: 'Orange', color: '#ff9a1f', dark: '#b85f00', light: '#ffd08a', shape: 'circle' },
    { name: 'Green', color: '#7cc93a', dark: '#3f7f12', light: '#c9f09a', shape: 'square' },
    { name: 'Pink', color: '#ff6fa3', dark: '#b8325f', light: '#ffc3d9', shape: 'triangle' },
    { name: 'Blue', color: '#39b8e8', dark: '#12719a', light: '#a9e6fb', shape: 'diamond' },
  ];

  // Settings and records. Storage can be blocked (private mode, file://), so
  // every access is guarded and the game simply forgets in that case.
  const KEY = 'bounce-tanks/v1';
  BT.Save = {
    data: null,
    defaults() {
      return { settings: { sfx: 8, music: 6, shake: true, flashes: true, treads: true, target: 5, skill: 1 }, stats: { matches: 0, wins: [0, 0, 0, 0] } };
    },
    load() {
      const out = this.defaults();
      try {
        const d = JSON.parse(localStorage.getItem(KEY));
        if (d && typeof d === 'object') {
          Object.assign(out.settings, d.settings || {});
          if (d.stats) { out.stats.matches = d.stats.matches | 0; if (Array.isArray(d.stats.wins)) out.stats.wins = d.stats.wins.slice(0, 4); }
        }
      } catch (e) { /* defaults */ }
      this.data = out;
      return out;
    },
    store() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* not saved */ }
    },
  };
})();
