// Knot Alone saves under "knot-alone:<key>". "level" and "best<n>" are the
// keys the first version used, so old progress carries over. Also "pins"
// ({ climb: 1-3 }), "mode" and "settings". Safe when storage is blocked.
(function () {
  const P = 'knot-alone:', mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(P + k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : d; };
  const set = (k, v) => { mem[k] = v; try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* not saved */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEFAULTS = { sfx: 8, music: 5, shake: true, reduced: reduce, snow: true };
  const L = () => KA.Rules.LEVELS;
  KA.Save = {
    settings() { return Object.assign({}, DEFAULTS, get('settings', {})); },
    storeSettings(s) { set('settings', s); },
    level() { return Math.max(1, Math.min(L(), Math.floor(+get('level', 1)) || 1)); },
    mode() { return get('mode', 2) === 1 ? 1 : 2; },
    setMode(m) { set('mode', m); },
    pins() { const p = get('pins', {}); return p && typeof p === 'object' ? p : {}; },
    best(n) { const b = get('best' + n, null); return typeof b === 'number' && b < 9999 ? b : null; },
    bests() { const o = {}; for (let n = 1; n <= L(); n++) o[n] = this.best(n); return o; },
    total() { return Object.values(this.pins()).reduce((a, b) => a + (+b || 0), 0); },
    win(n, secs, pins) {
      const before = this.best(n), all = this.pins();
      const best = before === null ? secs : Math.min(before, secs);
      set('best' + n, best);
      all[n] = Math.max(all[n] || 0, pins); set('pins', all);
      if (n < L()) set('level', Math.max(this.level(), n + 1));
      return { best, record: before !== null && secs < before };
    },
    reset() { set('pins', {}); set('level', 1); for (let n = 1; n <= L(); n++) set('best' + n, 9999); },
  };
})();
