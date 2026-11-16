// Pocket Realm saves under "pocket-realm:<key>". "wins" (dragons slain) is the
// key the first version used. Also "runs", "slain" (foes), "deepest" (most
// lands placed in one run), "daily" (date of today's last win) and "settings".
(function () {
  const P = 'pocket-realm:', mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(P + k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : d; };
  const set = (k, v) => { mem[k] = v; try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* not saved */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEFAULTS = { sfx: 8, music: 5, speed: 1, reduced: reduce, hints: true };
  PR.Save = {
    settings() { return Object.assign({}, DEFAULTS, get('settings', {})); },
    storeSettings(s) { set('settings', s); },
    record() { return { wins: +get('wins', 0) || 0, runs: +get('runs', 0) || 0, slain: +get('slain', 0) || 0, deepest: +get('deepest', 0) || 0, daily: get('daily', null) }; },
    finish(won, placed, slain, daily) {
      const r = this.record();
      set('runs', r.runs + 1); set('slain', r.slain + slain); set('deepest', Math.max(r.deepest, placed));
      if (won) { set('wins', r.wins + 1); if (daily) set('daily', PR.U.today()); }
      return this.record();
    },
  };
})();
