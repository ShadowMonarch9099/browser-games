// Arcade kit: saved data that can't clash with other games.
//
//   const save = Arcade.save();            // prefix comes from the game's folder name
//   save.get('best', 0);  save.set('best', 42);
//
// Every game on the site shares one localStorage, so keys are stored as
// "<game-folder>:<key>". Works (without saving) when storage is blocked.
window.Arcade = window.Arcade || {};

Arcade.save = function (slug) {
  if (!slug) {
    const m = location.pathname.match(/\/games\/([^/]+)\//);
    slug = m ? m[1] : 'game';
  }
  const memory = {};
  return {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(`${slug}:${key}`);
        return raw === null ? (key in memory ? memory[key] : fallback) : JSON.parse(raw);
      } catch (e) { return key in memory ? memory[key] : fallback; }
    },
    set(key, value) {
      memory[key] = value;
      try { localStorage.setItem(`${slug}:${key}`, JSON.stringify(value)); } catch (e) { /* storage blocked */ }
    },
  };
};
