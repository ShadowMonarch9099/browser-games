// Puck Scuffle settings and a small record of wins against the house,
// stored under "puck-scuffle:<key>". Safe when storage is blocked.
(function () {
  const P = 'puck-scuffle:', mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(P + k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : d; };
  const set = (k, v) => { mem[k] = v; try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* not saved */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEFAULTS = { sfx: 8, music: 5, shake: true, reduced: reduce, win: 7, tokens: true };
  PS.Save = {
    settings() { return Object.assign({}, DEFAULTS, get('settings', {})); },
    storeSettings(s) { set('settings', s); },
    record() { return Object.assign({ beat: [0, 0, 0], played: 0 }, get('record', {})); },
    note(level, won) { const r = this.record(); r.played++; if (won && level !== null) r.beat[level]++; set('record', r); return r; },
  };
})();
