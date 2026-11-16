// Pour Party saves. Keys are "pour-party:<name>", the same prefix the old
// version used, so "pour-party:level" (the level you are up to) carries over.
// localStorage can be missing (private mode, some file:// setups): every
// access is guarded and the game keeps working from memory.
(function () {
  const PREFIX = 'pour-party:';
  const memory = {};

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw !== null) return JSON.parse(raw);
    } catch (e) { /* storage blocked or corrupt */ }
    return key in memory ? memory[key] : fallback;
  }
  function set(key, value) {
    memory[key] = value;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* not persisted */ }
  }

  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEFAULTS = { sfx: 8, music: 6, symbols: true, guides: true, shake: true, reduced: reduce };

  const Save = {
    settings() { return Object.assign({}, DEFAULTS, get('settings', {})); },
    storeSettings(s) { set('settings', s); },
    // The level you are up to (old saves stored only this).
    level() { const v = +get('level', 1); return v >= 1 ? Math.floor(v) : 1; },
    setLevel(v) { set('level', v); },
    // { "<level>": { stars, moves } }
    best() { const b = get('best', {}); return b && typeof b === 'object' ? b : {}; },
    record(lv, stars, moves) {
      const b = this.best();
      const prev = b[lv] || {};
      const rec = { stars: Math.max(prev.stars || 0, stars), moves: prev.moves ? Math.min(prev.moves, moves) : moves };
      b[lv] = rec;
      set('best', b);
      return { rec, newBest: !prev.moves || moves < prev.moves };
    },
    // Highest level you may open: where you are up to, or one past the furthest win.
    unlocked() {
      let hi = this.level();
      for (const k of Object.keys(this.best())) hi = Math.max(hi, +k + 1);
      return hi;
    },
    totalStars() { return Object.values(this.best()).reduce((s, r) => s + (r.stars || 0), 0); },
    reset() { set('best', {}); set('level', 1); },
  };

  (window.PP = window.PP || {}).Save = Save;
})();
