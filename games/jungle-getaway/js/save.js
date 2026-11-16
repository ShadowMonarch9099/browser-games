// Jungle Getaway persistence. Keys keep the format the game has always used
// ("jungle-getaway:<key>" holding JSON) so old bests, banked coins and mission
// progress carry over. Every access is guarded: private mode just means the
// game forgets on reload.
(function (root) {
  'use strict';
  const PREFIX = 'jungle-getaway:';
  const memory = {};

  const Save = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        if (raw !== null) return JSON.parse(raw);
      } catch (e) { /* storage blocked */ }
      return key in memory ? memory[key] : fallback;
    },
    set(key, value) {
      memory[key] = value;
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* storage blocked */ }
    },
    defaults() {
      return { sfx: 8, music: 6, shake: true, motion: true, rearview: true, hints: true };
    },
    settings() {
      const s = this.defaults();
      const got = this.get('settings', null);
      if (got && typeof got === 'object') for (const k in s) if (typeof got[k] === typeof s[k]) s[k] = got[k];
      return s;
    },
  };

  root.JG = root.JG || {};
  root.JG.Save = Save;
})(window);
