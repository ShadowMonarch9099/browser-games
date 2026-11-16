// Lot Jam saves under "lot-jam:<key>", the keys the first version used:
// "level" (the furthest level reached) and "stars" ({ level: cones kept }).
// Guarded for private mode / blocked storage.
(function () {
  const PREFIX = 'lot-jam:';
  const memory = {};
  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw !== null) return JSON.parse(raw);
    } catch (e) { /* blocked or corrupt */ }
    return key in memory ? memory[key] : fallback;
  }
  function set(key, value) {
    memory[key] = value;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* not persisted */ }
  }
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEFAULTS = { sfx: 8, music: 6, shake: true, tips: true, reduced: reduce, last: 1 };
  const LEVELS = 60;

  const Save = {
    settings() { return Object.assign({}, DEFAULTS, get('settings', {})); },
    storeSettings(s) { set('settings', s); },
    level() { const v = Math.floor(+get('level', 1)) || 1; return Math.max(1, Math.min(LEVELS, v)); },
    stars() { const s = get('stars', {}); return s && typeof s === 'object' ? s : {}; },
    total() { return Object.values(this.stars()).reduce((a, b) => a + (+b || 0), 0); },
    win(lv, stars) {
      const all = this.stars();
      const before = all[lv] || 0;
      all[lv] = Math.max(before, stars);
      set('stars', all);
      if (lv < LEVELS) set('level', Math.max(this.level(), lv + 1));
      return { best: all[lv], improved: stars > before };
    },
    // The level the Continue button opens: the last one played, if still open.
    last() { const s = this.settings(); return Math.min(this.level(), Math.max(1, s.last || 1)); },
    reset() { set('stars', {}); set('level', 1); },
  };
  (window.LJ = window.LJ || {}).Save = Save;
})();
