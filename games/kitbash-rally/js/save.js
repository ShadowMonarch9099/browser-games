// Settings and progress. Everything lives under one localStorage key that
// starts with the game's folder name. Storage can be missing (private mode,
// some file:// setups), so every access is guarded and the game simply
// forgets between visits when it is.
(function () {
  const KR = window.KR;
  const KEY = 'kitbash-rally/v2';

  function defaults() {
    return {
      builds: [KR.DEFAULT.slice(), KR.DEFAULT.slice()],
      cups: 0, // how many cups have been won, in order (unlocks the next)
      best: {}, // track index -> best lap in seconds
      trophies: {}, // cup index -> best finishing place (1..6)
      settings: { sfx: 8, music: 6, shake: true, motion: true, units: 'kmh', difficulty: 1, autoGas: true },
    };
  }

  function readOld(key) {
    try {
      const raw = localStorage.getItem('kitbash-rally:' + key);
      return raw === null ? null : JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function load() {
    const out = defaults();
    let d = null;
    try {
      d = JSON.parse(localStorage.getItem(KEY));
    } catch (e) {
      d = null;
    }
    if (d && typeof d === 'object') {
      if (Array.isArray(d.builds)) d.builds.forEach((b, i) => { if (i < 2 && KR.validBuild(b)) out.builds[i] = b.slice(); });
      if (typeof d.cups === 'number') out.cups = Math.max(0, Math.min(KR.CUPS.length, d.cups | 0));
      if (d.best && typeof d.best === 'object') out.best = d.best;
      if (d.trophies && typeof d.trophies === 'object') out.trophies = d.trophies;
      Object.assign(out.settings, d.settings || {});
    } else {
      // carry over what the first version of the game saved
      [0, 1].forEach((i) => { const b = readOld('build' + i); if (KR.validBuild(b)) out.builds[i] = b.slice(); });
      const c = readOld('cups');
      if (typeof c === 'number') out.cups = Math.max(0, Math.min(KR.CUPS.length, c | 0));
    }
    return out;
  }

  function store(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      /* progress just won't persist */
    }
  }

  KR.Save = { KEY, defaults, load, store };
})();
