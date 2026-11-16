// Misfit Squad: shared helpers, heroes, robots, upgrades and saved settings.
// Plain script (also loads under Node for tools/run-test.js).
var MS = {};
if (typeof window !== 'undefined') window.MS = MS;
if (typeof module !== 'undefined') module.exports = MS;

(function () {
  MS.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  MS.easeOut = (t) => 1 - Math.pow(1 - MS.clamp(t, 0, 1), 3);
  MS.easeBack = (t) => { t = MS.clamp(t, 0, 1); return 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2); };
  MS.TAU = Math.PI * 2;
  MS.rng = function (seed) {
    let s = (seed === undefined ? Math.floor(Math.random() * 4294967296) : seed) >>> 0;
    const rand = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rand.int = (a, b) => a + Math.floor(rand() * (b - a + 1));
    rand.pick = (l) => l[Math.floor(rand() * l.length)];
    rand.shuffle = (l) => { for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = l[i]; l[i] = l[j]; l[j] = t; } return l; };
    return rand;
  };

  // The four misfits (numbers kept from the original game).
  MS.HEROES = [
    { name: 'Brick', role: 'Tank', color: '#ff9f1c', dark: '#b8650a', hp: 170, speed: 3.2, rate: 0.5, dmg: 9, special: 'Shove', desc: 'Shoves every robot nearby away and dents them.' },
    { name: 'Patch', role: 'Medic', color: '#62d26f', dark: '#2e8a3b', hp: 95, speed: 4, rate: 0.4, dmg: 7, special: 'Heal', desc: 'Heals every hero close by for 40.' },
    { name: 'Snare', role: 'Trapper', color: '#b57bff', dark: '#6d3bc2', hp: 105, speed: 4, rate: 0.45, dmg: 8, special: 'Mine', desc: 'Drops a mine that blasts the robots that step near it.' },
    { name: 'Dot', role: 'Sharpshooter', color: '#3ec6f0', dark: '#1679a3', hp: 85, speed: 4.3, rate: 0.75, dmg: 20, special: 'Big shot', desc: 'Fires a huge round that punches through everything.' },
  ];
  // Player slots: a colour and a badge shape each.
  MS.SLOTS = [
    { name: 'P1', color: '#ffd23f', shape: 'circle' },
    { name: 'P2', color: '#ff6b9a', shape: 'square' },
    { name: 'P3', color: '#7cf0d0', shape: 'triangle' },
    { name: 'P4', color: '#ffffff', shape: 'diamond' },
  ];
  MS.BOTS = {
    grunt: { name: 'Clanker', hp: 22, speed: 1.7, dmg: 9, r: 0.3, color: '#e85d5d' },
    zip: { name: 'Zipper', hp: 10, speed: 3.4, dmg: 6, r: 0.22, color: '#ffd23f' },
    brute: { name: 'Crusher', hp: 90, speed: 1.1, dmg: 20, r: 0.48, color: '#b5577b' },
    boss: { name: 'Warden', hp: 520, speed: 0.9, dmg: 30, r: 0.9, color: '#7a5cc7' },
  };
  // Upgrades for the whole squad, one picked after each wave.
  MS.UPGRADES = [
    { name: 'Sharper shots', text: 'Damage +20%', icon: 'dmg', apply: (m) => { m.mods.dmg *= 1.2; } },
    { name: 'Quick triggers', text: 'Fire rate +15%', icon: 'rate', apply: (m) => { m.mods.rate *= 0.87; } },
    { name: 'Thicker suits', text: 'Max health +25, and heal that much', icon: 'hp', apply: (m) => { m.mods.hp += 25; m.heroes.forEach((h) => { h.max += 25; h.hp = Math.min(h.max, h.hp + 25); }); } },
    { name: 'Fast boots', text: 'Move speed +10%', icon: 'speed', apply: (m) => { m.mods.speed *= 1.1; } },
    { name: 'Field medic', text: 'Everyone healed to full, fallen revived', icon: 'heal', apply: (m) => { m.heroes.forEach((h) => { h.down = false; h.hp = h.max; h.revive = 0; }); } },
    { name: 'Short fuse', text: 'Specials recharge 20% faster', icon: 'cool', apply: (m) => { m.mods.cool *= 0.8; } },
    { name: 'Piercing rounds', text: 'Shots pass through one more robot', icon: 'pierce', apply: (m) => { m.mods.pierce += 1; } },
    { name: 'Long barrels', text: 'Range +20%', icon: 'range', apply: (m) => { m.mods.range *= 1.2; } },
  ];

  const KEY = 'misfit-squad/v1';
  MS.Save = {
    data: null,
    defaults() {
      return {
        settings: { sfx: 8, music: 6, shake: true, flashes: true, numbers: true },
        best: 0, wins: 0, runs: 0,
      };
    },
    load() {
      const out = this.defaults();
      try {
        const d = JSON.parse(localStorage.getItem(KEY));
        if (d && typeof d === 'object') {
          Object.assign(out.settings, d.settings || {});
          out.best = d.best | 0; out.wins = d.wins | 0; out.runs = d.runs | 0;
        }
        // carry over the best wave saved by the original version of the game
        const old = JSON.parse(localStorage.getItem('misfit-squad:best'));
        if (old) out.best = Math.max(out.best, old | 0);
      } catch (e) { /* defaults */ }
      this.data = out;
      return out;
    },
    store() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* not saved */ } },
  };
})();
