// Progress and settings persistence. localStorage can be unavailable (private
// mode, file:// in some browsers), so every access is guarded and the game
// works without it.
SCE.Save = {
  KEY: 'shadow-clone-escape/v1',

  defaults() {
    return {
      unlocked: 1,
      levels: {},
      muted: false,
      settings: { sfx: 8, music: 5, shake: true, hints: true },
    };
  },

  load() {
    const out = this.defaults();
    try {
      const d = JSON.parse(localStorage.getItem(this.KEY));
      if (d && typeof d.unlocked === 'number') {
        out.unlocked = d.unlocked;
        out.levels = d.levels || {};
        out.muted = !!d.muted;
        Object.assign(out.settings, d.settings || {});
      }
    } catch (e) {
      /* fall through to defaults */
    }
    return out;
  },

  store(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) {
      /* progress just won't persist */
    }
  },
};
