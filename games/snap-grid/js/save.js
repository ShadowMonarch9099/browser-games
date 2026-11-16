// Snap Grid saves under "snap-grid:<key>", the same keys the first version
// used for scores ("best" and "daily:<date>"), so old high scores carry over.
// Guarded for private mode / blocked storage.
(function () {
  const PREFIX = 'snap-grid:';
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
  const DEFAULTS = { sfx: 8, music: 6, shake: true, crt: true, preview: true, reduced: reduce };

  const Save = {
    settings() { return Object.assign({}, DEFAULTS, get('settings', {})); },
    storeSettings(s) { set('settings', s); },
    best() { return +get('best', 0) || 0; },
    daily(date) { return +get('daily:' + date, 0) || 0; },
    // Top five runs: [{ score, mode, date }]
    table() { const t = get('table', []); return Array.isArray(t) ? t : []; },
    // Records a finished run; returns { best, newBest, rank } (rank 0-4 or -1).
    record(mode, date, score, stats) {
      let newBest = false;
      let best;
      if (mode === 'daily') {
        best = Math.max(score, this.daily(date));
        newBest = score > this.daily(date) && score > 0;
        set('daily:' + date, best);
      } else {
        best = Math.max(score, this.best());
        newBest = score > this.best() && score > 0;
        set('best', best);
      }
      const t = this.table();
      let rank = -1;
      if (score > 0) {
        t.push({ score, mode, date, lines: stats.lines });
        t.sort((a, b) => b.score - a.score);
        rank = t.findIndex((r) => r.score === score && r.date === date && r.mode === mode);
        t.length = Math.min(t.length, 5);
        if (rank > 4) rank = -1;
        set('table', t);
      }
      return { best, newBest, rank };
    },
    seenHelp() { return !!get('helped', false); },
    markHelp() { set('helped', true); },
    reset() { set('best', 0); set('table', []); },
  };
  (window.SG = window.SG || {}).Save = Save;
})();
