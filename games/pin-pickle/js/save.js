// Progress and settings under one localStorage key that starts with the
// game's folder name. Every access is guarded: with storage blocked the game
// still plays, it just forgets between visits.
(function () {
  const PP = (window.PP = window.PP || {});
  const KEY = 'pin-pickle:v2';
  function defaults() {
    return {
      unlocked: 1, // highest level you may play
      done: {}, // level number -> { pct: best gold %, pulls: fewest pulls, skipped: bool }
      fails: {}, // level number -> failed attempts (drives the hint and skip offers)
      settings: { sfx: 8, music: 6, shake: true, motion: true, hints: true },
    };
  }
  function load() {
    const out = defaults();
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
    if (d && typeof d === 'object') {
      if (typeof d.unlocked === 'number') out.unlocked = Math.max(1, d.unlocked | 0);
      if (d.done && typeof d.done === 'object') out.done = d.done;
      if (d.fails && typeof d.fails === 'object') out.fails = d.fails;
      Object.assign(out.settings, d.settings || {});
    } else {
      // the first version saved only the furthest level reached
      try {
        const old = JSON.parse(localStorage.getItem('pin-pickle:level'));
        if (typeof old === 'number' && old > 1) {
          out.unlocked = old | 0;
          for (let n = 1; n < old; n++) out.done[n] = { pct: 80, pulls: 0 };
        }
      } catch (e) { /* nothing to carry over */ }
    }
    return out;
  }
  function store(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* not saved */ }
  }
  PP.Save = { KEY, defaults, load, store };
})();
