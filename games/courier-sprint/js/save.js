// Courier Sprint persistence. Keys stay in the "courier-sprint:<key>" JSON
// format the game always used, so an existing best score carries over.
// Every access is guarded; without storage the game simply forgets.
(function (root) {
  'use strict';
  const PREFIX = 'courier-sprint:';
  const memory = {};
  const Save = {
    get(key, fallback) {
      try { const raw = localStorage.getItem(PREFIX + key); if (raw !== null) return JSON.parse(raw); } catch (e) { /* blocked */ }
      return key in memory ? memory[key] : fallback;
    },
    set(key, value) {
      memory[key] = value;
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* blocked */ }
    },
    settings() {
      const s = { sfx: 8, music: 6, shake: true, motion: true, hints: true, theme: 'auto' };
      const got = this.get('settings', null);
      if (got && typeof got === 'object') for (const k in s) if (typeof got[k] === typeof s[k]) s[k] = got[k];
      return s;
    },
  };
  root.CS = root.CS || {};
  root.CS.Save = Save;
})(window);
