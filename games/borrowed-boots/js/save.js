// Settings and three storybook save slots, in localStorage under
// "borrowed-boots:save". Every access is guarded: in private mode the game
// still runs, it just forgets on reload. Older saves ("borrowed-boots:level"
// and "borrowed-boots:stars" from the first version) are moved into book 1.
BB.Save = {
  KEY: 'borrowed-boots:save',
  SLOTS: 3,

  defaults() {
    return {
      settings: { sfx: 8, music: 6, shake: true, motion: true, tips: true },
      slots: [null, null, null],
      last: 0,
    };
  },

  blankSlot() {
    return { unlocked: 1, levels: {}, playTime: 0, made: Date.now() };
  },

  read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  load() {
    const out = this.defaults();
    const d = this.read(this.KEY);
    if (d && typeof d === 'object') {
      Object.assign(out.settings, d.settings || {});
      if (Array.isArray(d.slots)) for (let i = 0; i < this.SLOTS; i++) out.slots[i] = this.clean(d.slots[i]);
      out.last = d.last >= 0 && d.last < this.SLOTS ? d.last : 0;
    } else {
      // first run of this version: carry over the old progress, if any
      const lvl = this.read('borrowed-boots:level');
      const stars = this.read('borrowed-boots:stars');
      if (lvl || stars) {
        const s = this.blankSlot();
        s.unlocked = Math.max(1, Math.min(12, Number(lvl) || 1));
        for (const [k, v] of Object.entries(stars || {})) s.levels[Number(k) - 1] = { stars: Math.min(3, Number(v) || 0) };
        out.slots[0] = s;
      }
    }
    return out;
  },

  clean(s) {
    if (!s || typeof s !== 'object' || typeof s.unlocked !== 'number') return null;
    return { unlocked: Math.max(1, Math.min(12, s.unlocked)), levels: s.levels || {}, playTime: s.playTime || 0, made: s.made || 0 };
  },

  store(data) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) {
      /* progress just won't persist */
    }
  },
};
