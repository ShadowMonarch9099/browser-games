// Paper Trail saves under "paper-trail:<key>". "level" (furthest page open)
// is the key the first version used, so old progress carries over. Also
// "stamps" ({ page: 1-3 }) and "settings". Safe when storage is blocked.
(function () {
  const P = 'paper-trail:', mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(P + k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : d; };
  const set = (k, v) => { mem[k] = v; try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* not saved */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEFAULTS = { sfx: 7, music: 5, ink: 0, count: true, reduced: reduce };
  PT.Save = {
    settings() { return Object.assign({}, DEFAULTS, get('settings', {})); },
    storeSettings(s) { set('settings', s); },
    level() { return Math.max(1, Math.min(PT.Rules.LEVELS, Math.floor(+get('level', 1)) || 1)); },
    stamps() { const s = get('stamps', {}); return s && typeof s === 'object' ? s : {}; },
    total() { return Object.values(this.stamps()).reduce((a, b) => a + (+b || 0), 0); },
    win(n, stamps) {
      const all = this.stamps(), before = all[n] || 0;
      all[n] = Math.max(before, stamps); set('stamps', all);
      if (n < PT.Rules.LEVELS) set('level', Math.max(this.level(), n + 1));
      return { best: all[n], improved: stamps > before };
    },
    reset() { set('stamps', {}); set('level', 1); },
  };
})();
