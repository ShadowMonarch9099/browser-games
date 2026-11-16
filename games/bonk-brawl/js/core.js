// Bonk Brawl: shared helpers, the fighter roster, stages and saved settings.
// Plain script (also loads under Node for tools/match-test.js).
var BB = {};
if (typeof window !== 'undefined') window.BB = BB;
if (typeof module !== 'undefined') module.exports = BB;

(function () {
  BB.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  BB.lerp = (a, b, t) => a + (b - a) * t;
  BB.easeOut = (t) => 1 - Math.pow(1 - BB.clamp(t, 0, 1), 3);
  BB.easeBack = (t) => { t = BB.clamp(t, 0, 1); return 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2); };
  BB.easeElastic = (t) => { t = BB.clamp(t, 0, 1); return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1; };
  BB.TAU = Math.PI * 2;

  BB.rng = function (seed) {
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
    rand.shuffle = (list) => {
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = list[i]; list[i] = list[j]; list[j] = t; }
      return list;
    };
    return rand;
  };

  // Four fighters with different feels (stats kept from the original game).
  BB.FIGHTERS = [
    { id: 'rascal', name: 'Rascal', what: 'Raccoon brawler', blurb: 'All-rounder. Quick hands, no weak spots.', speed: 6.5, jump: 15, weight: 1, power: 1, color: '#9aa5b8', dark: '#5d6677', accent: '#2b2d42', belly: '#e9ecf2' },
    { id: 'clank', name: 'Clank', what: 'Wind-up robot', blurb: 'Slow and heavy. Hits hard, hard to launch.', speed: 5, jump: 14, weight: 1.35, power: 1.25, color: '#4cc9f0', dark: '#1f7fa8', accent: '#f9c74f', belly: '#bdeefd' },
    { id: 'sumo', name: 'Sumo', what: 'Pond-champion frog', blurb: 'Huge jumps. Sturdy and springy.', speed: 5.6, jump: 18, weight: 1.2, power: 1.1, color: '#70e000', dark: '#3a8a00', accent: '#ffd23f', belly: '#e7ffb8' },
    { id: 'zephyr', name: 'Zephyr', what: 'Kite pilot', blurb: 'Fast, light and floaty. Flies far when hit.', speed: 7.6, jump: 15, weight: 0.8, power: 0.9, color: '#ff70a6', dark: '#b8336a', accent: '#ffe066', belly: '#ffd6e7' },
  ];
  // Player slots: colour plus a shape, so colour is never the only cue.
  BB.SLOTS = [
    { name: 'P1', color: '#ef233c', shape: 'circle' },
    { name: 'P2', color: '#2f6bff', shape: 'square' },
    { name: 'P3', color: '#ffb000', shape: 'triangle' },
    { name: 'P4', color: '#16b364', shape: 'diamond' },
  ];
  // Platforms: [x, y, width, solid]. Solid ones are thick islands; the rest
  // are thin ledges you can jump up through and drop down through.
  BB.STAGES = [
    { name: 'Rooftop Rumble', sub: 'Bonkopolis, after dark', plats: [[3, 6.6, 10, true], [4.2, 4.4, 2.6], [9.2, 4.4, 2.6]] },
    { name: 'Pier Pressure', sub: 'Funfair at sunset', plats: [[4, 6.6, 8, true], [1.6, 5, 2.2], [12.2, 5, 2.2], [6.7, 3.6, 2.6]] },
    { name: 'Twin Peaks of Pow', sub: 'Volcano island at noon', plats: [[2.5, 6.8, 4.5, true], [9, 6.8, 4.5, true], [6.6, 4.6, 2.8]] },
  ];

  const KEY = 'bonk-brawl/v1';
  BB.Save = {
    data: null,
    defaults() {
      return {
        settings: { sfx: 8, music: 6, shake: true, impact: true, numbers: true, lives: 3, stage: -1, skill: 1 },
        stats: { matches: 0, kos: 0, wins: [0, 0, 0, 0] },
      };
    },
    load() {
      const out = this.defaults();
      try {
        const d = JSON.parse(localStorage.getItem(KEY));
        if (d && typeof d === 'object') {
          Object.assign(out.settings, d.settings || {});
          if (d.stats) {
            out.stats.matches = d.stats.matches | 0; out.stats.kos = d.stats.kos | 0;
            if (Array.isArray(d.stats.wins)) out.stats.wins = d.stats.wins.slice(0, 4).map((n) => n | 0);
          }
        }
      } catch (e) { /* defaults */ }
      this.data = out;
      return out;
    },
    store() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* not saved */ } },
  };
})();
