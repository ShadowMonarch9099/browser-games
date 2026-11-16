// Tick Talk rules: the bomb's serial and the answer to every module. These
// are the rules written in manual.html; tools/check-manual.js reads the
// manual and fails if the two ever disagree. Change both together.
(function (root) {
  const COLORS = { red: '#e5383b', blue: '#3a86ff', yellow: '#ffd23f', green: '#52b788', white: '#f1f1e6' };
  const GLYPHS = ['◆', '☾', '▲', '♥', '✚', '★', '■', '♪', '●', '☂', '⚑', '✿']; // "the Great Order" in the manual
  const GLYPH_NAMES = ['diamond', 'moon', 'triangle', 'heart', 'cross', 'star', 'square', 'note', 'circle', 'umbrella', 'flag', 'flower'];
  const WORDS = { ECHO: '1010', NOVA: '0011', ZINC: '1101', FERN: '0110', MOSS: '1000', OPAL: '0101' }; // 1 = up
  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const MAP_AM = { red: 'blue', blue: 'yellow', yellow: 'green', green: 'red' };
  const MAP_NZ = { red: 'green', green: 'yellow', yellow: 'blue', blue: 'red' };
  const TYPES = ['fuses', 'glyphs', 'dial', 'switches', 'code', 'flash'];
  const TITLES = { fuses: 'Fuse rack', glyphs: 'Glyph pad', dial: 'Compass dial', switches: 'Switchboard', code: 'Code lock', flash: 'Signal lamp' };
  const MODULES = [3, 4, 6]; // easy, medium, hard

  function rng(seed) {
    let s = (seed === undefined ? Math.random() * 4294967296 : seed) >>> 0;
    const r = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
    r.pick = (l) => l[Math.floor(r() * l.length)];
    r.shuffle = (l) => { for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
    return r;
  }
  function makeSerial(rand, letters, digits) {
    letters = letters || Array.from({ length: 2 }, () => rand.pick([...'ABCDEFGHJKLMNPQRSTUVWXYZ'])).join('');
    digits = digits || String(rand.int(100, 999));
    return { letters, digits, text: letters + '-' + digits, vowel: /[AEU]/.test(letters), last: +digits[2], num: +digits };
  }

  // ---------- the answers ----------
  const answers = {
    // 1-based fuse to pull
    fuses(serial, colors) { const k = colors.filter((c) => c === colors[0]).length; return serial.vowel ? k : 6 - k; },
    // the order to press the four glyphs in
    glyphs(serial, picks) { const order = [...picks].sort((a, b) => GLYPHS.indexOf(a) - GLYPHS.indexOf(b)); return serial.last % 2 === 0 ? order.reverse() : order; },
    // index into DIRS
    dial(serial, lamps) { return (lamps[0] * 4 + lamps[1] * 2 + lamps[2] * 1 + serial.last) % 8; },
    // switch pattern, '1' = up
    switches(serial, word) { const w = WORDS[word]; return serial.vowel ? [...w].map((c) => (c === '1' ? '0' : '1')).join('') : w; },
    code(serial, shown) { return String((shown + serial.num) % 1000).padStart(3, '0'); },
    flash(serial, seq) { const map = serial.letters[0] <= 'M' ? MAP_AM : MAP_NZ; return seq.map((c) => map[c]); },
  };

  // what each module shows, chosen at random
  const makers = {
    fuses: (r) => ({ colors: Array.from({ length: 5 }, () => r.pick(Object.keys(COLORS))) }),
    glyphs: (r) => ({ picks: r.shuffle([...GLYPHS]).slice(0, 4) }),
    dial: (r) => ({ lamps: [r() < 0.5, r() < 0.5, r() < 0.5], pos: r.int(0, 7) }),
    switches: (r, serial) => {
      const word = r.pick(Object.keys(WORDS)), want = answers.switches(serial, word);
      let cur;
      do { cur = Array.from({ length: 4 }, () => (r() < 0.5 ? '1' : '0')).join(''); } while (cur === want);
      return { word, cur };
    },
    code: (r) => ({ shown: r.int(100, 899) }),
    flash: (r) => ({ seq: Array.from({ length: 3 }, () => r.pick(['red', 'blue', 'yellow', 'green'])) }),
  };
  function makeBomb(level, rand) {
    rand = rand || rng();
    const serial = makeSerial(rand);
    const types = rand.shuffle([...TYPES]).slice(0, MODULES[level]);
    return { serial, mods: types.map((type) => Object.assign({ type, solved: false }, makers[type](rand, serial))) };
  }

  const api = { COLORS, GLYPHS, GLYPH_NAMES, WORDS, DIRS, MAP_AM, MAP_NZ, TYPES, TITLES, MODULES, rng, makeSerial, answers, makeBomb };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.TT = root.TT || {}).Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
