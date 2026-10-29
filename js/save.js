// Progress persistence. localStorage can be unavailable (private mode, file://
// in some browsers), so every access is guarded and the game works without it.
SCE.Save = {
  KEY: 'shadow-clone-escape/v1',

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(this.KEY));
      if (d && typeof d.unlocked === 'number') {
        return { unlocked: d.unlocked, levels: d.levels || {}, muted: !!d.muted };
      }
    } catch (e) {
      /* fall through to defaults */
    }
    return { unlocked: 1, levels: {}, muted: false };
  },

  store(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) {
      /* progress just won't persist */
    }
  },
};
