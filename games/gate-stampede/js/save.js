// Gate Stampede saves under "gate-stampede:<key>", the keys the first version
// used: "level" (furthest level open) and "stars" ({ level: stars }), plus
// "settings". Guarded so a blocked or private storage never breaks the game.
(function () {
  const PREFIX = 'gate-stampede:';
  const mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(PREFIX + k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : d; };
  const set = (k, v) => { mem[k] = v; try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* not saved */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEFAULTS = { sfx: 8, music: 6, shake: true, reduced: reduce, sense: 5 };
  GS.Save = {
    settings() { return Object.assign({}, DEFAULTS, get('settings', {})); },
    storeSettings(s) { set('settings', s); },
    level() { return Math.max(1, Math.min(GS.Rules.LEVELS, Math.floor(+get('level', 1)) || 1)); },
    stars() { const s = get('stars', {}); return s && typeof s === 'object' ? s : {}; },
    total() { return Object.values(this.stars()).reduce((a, b) => a + (+b || 0), 0); },
    win(lv, stars) {
      const all = this.stars(), before = all[lv] || 0;
      all[lv] = Math.max(before, stars); set('stars', all);
      if (lv < GS.Rules.LEVELS) set('level', Math.max(this.level(), lv + 1));
      return { best: all[lv], improved: stars > before };
    },
    reset() { set('stars', {}); set('level', 1); },
  };
})();
