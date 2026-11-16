// Bullet Garden saves under "bullet-garden:<key>". "best" (most nights
// survived) is the key the first version used; also "wins", "squashed" and
// "settings". Safe when storage is blocked.
(function () {
  const P = 'bullet-garden:', mem = {};
  const get = (k, d) => { try { const v = localStorage.getItem(P + k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : d; };
  const set = (k, v) => { mem[k] = v; try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* not saved */ } };
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DEFAULTS = { sfx: 8, music: 5, shake: true, reduced: reduce, autofire: false, crickets: true };
  BG.Save = {
    settings() { return Object.assign({}, DEFAULTS, get('settings', {})); },
    storeSettings(s) { set('settings', s); },
    best() { return +get('best', 0) || 0; },
    wins() { return +get('wins', 0) || 0; },
    finish(nights, won, squashed) {
      const best = Math.max(nights, this.best()); set('best', best);
      if (won) set('wins', this.wins() + 1);
      set('squashed', (+get('squashed', 0) || 0) + squashed);
      return { best, wins: this.wins(), squashed: +get('squashed', 0) || 0 };
    },
  };
})();
