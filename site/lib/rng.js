// Arcade kit: random numbers you can repeat.
//
//   const rand = Arcade.rng(1234);       // same seed, same sequence, on every device
//   rand()              0..1
//   rand.int(1, 6)      whole number from 1 to 6
//   rand.pick(list)     one item
//   rand.shuffle(list)  shuffles in place
//   Arcade.rng.daily()  a generator seeded by today's date, for daily challenges
//   Arcade.rng.today()  "2026-11-13" (UTC), handy as a save key
window.Arcade = window.Arcade || {};

Arcade.rng = function (seed = (Math.random() * 2 ** 32) >>> 0) {
  let s = seed >>> 0;
  // mulberry32
  const rand = function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rand.seed = seed >>> 0;
  rand.int = (min, max) => min + Math.floor(rand() * (max - min + 1));
  rand.pick = (list) => list[Math.floor(rand() * list.length)];
  rand.shuffle = (list) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  return rand;
};

Arcade.rng.today = () => new Date().toISOString().slice(0, 10);

Arcade.rng.hash = (text) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

// salt: pass your game's name so two games don't share a daily sequence.
Arcade.rng.daily = (salt = '') => Arcade.rng(Arcade.rng.hash(Arcade.rng.today() + salt));
