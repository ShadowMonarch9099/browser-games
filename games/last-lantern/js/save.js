// Saved data, under "last-lantern:" keys. "run" (the cave in progress, saved
// at every beacon and shrine) and "wins" keep the meaning they had in the
// first version, so an old run can still be continued. Storage can be
// blocked (private mode): every access is guarded and the game still plays.
LL.Save = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem('last-lantern:' + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('last-lantern:' + key, JSON.stringify(value));
    } catch (e) {
      /* not saved, but play goes on */
    }
  },
  settings() {
    return Object.assign({ sfx: 8, music: 6, shake: true, flicker: true, hints: true, minimap: true }, this.get('settings', {}));
  },
  stats() {
    return Object.assign({ runs: 0, banished: 0, beacons: 0, jars: 0, outs: 0 }, this.get('stats', {}));
  },
};
