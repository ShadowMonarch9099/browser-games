// Borrowed Boots levels, built from pieces so every row lines up and every
// gap is sized to the jump physics in game.js:
//   normal jump: clears walls 2 high, pits 4 wide
//   spring:      clears walls 5 high, spike runs 6 wide
//   claws:       climbs any wall
//   glider:      crosses pits up to ~10 wide
//   shell:       smashes cracked lids (C) when landing on them
// Heights count blocks from the bottom. The normal ground is 4 high, so a
// vault has room for a 2-high chamber under its lid.
// Map key: # rock, C cracked, ^ spikes, * star, S start, F flag, k checkpoint,
//          b bouncer (spring), g gecko (claws), o owl (glider), t turtle (shell)
(function (root) {
  const ROWS = 17, BASE = 4;

  function build(pieces) {
    const cols = [];
    const col = (h, extra = {}) => {
      const c = Array(ROWS).fill('.');
      for (let i = 0; i < h; i++) c[i] = '#';
      for (const [at, ch] of Object.entries(extra)) c[+at] = ch;
      cols.push(c);
      return c;
    };
    let h = BASE;
    for (const p of pieces) {
      const [kind, a = 0, b = 0] = p;
      if (kind === 'run') for (let i = 0; i < a; i++) col(h);
      else if (kind === 'up') { h += a; for (let i = 0; i < (b || 3); i++) col(h); }     // step up a blocks, b wide
      else if (kind === 'down') { h -= a; for (let i = 0; i < (b || 3); i++) col(h); }
      else if (kind === 'pit') for (let i = 0; i < a; i++) col(0);
      else if (kind === 'spikes') for (let i = 0; i < a; i++) col(h, { [h]: '^' });
      else if (kind === 'wall') { for (let i = 0; i < (b || 1); i++) col(h + a); }       // a block wall a high, then back down
      else if (kind === 'vault') {                                                        // a chamber under a cracked lid, flag inside
        col(h); col(h);
        for (let i = 0; i < a; i++) col(1, { [h - 1]: 'C', 1: i === Math.floor(a / 2) ? 'F' : '.' });
        col(h); col(h);
      } else {
        // things placed on the last column: creatures, stars (b blocks above ground), start, flag, checkpoint
        const c = cols[cols.length - 1], top = c.lastIndexOf('#') + 1;
        c[top + (kind === '*' ? b || 1 : 0)] = kind;
      }
    }
    for (let i = 0; i < 3; i++) col(h);
    // rows: top first
    return Array.from({ length: ROWS }, (_, r) => cols.map((c) => c[ROWS - 1 - r]).join(''));
  }

  const LEVELS = [
    { name: 'Morning walk', tip: 'Jump with Space. Bounce on the springy critter to borrow its legs.', map: build([
      ['run', 3], ['S'], ['run', 4], ['*', 0, 2], ['run', 2], ['wall', 1, 2], ['run', 3], ['wall', 2, 2], ['run', 2], ['*', 0, 3],
      ['pit', 3], ['run', 4], ['b'], ['run', 4], ['spikes', 3], ['run', 3], ['up', 1, 4], ['*', 0, 1], ['down', 1, 3], ['run', 2], ['F']]) },
    { name: 'Spring loaded', tip: 'That wall is too tall for you. Not for spring legs.', map: build([
      ['run', 3], ['S'], ['run', 3], ['b'], ['run', 4], ['*', 0, 3], ['run', 2], ['wall', 4, 2], ['run', 4], ['k'], ['run', 2],
      ['b'], ['run', 4], ['up', 4, 3], ['*', 0, 2], ['run', 2], ['down', 4, 3], ['run', 3], ['*', 0, 1], ['pit', 4], ['run', 3], ['F']]) },
    { name: 'Sticky fingers', tip: 'Borrow the gecko\'s claws and walk into a wall to climb it.', map: build([
      ['run', 3], ['S'], ['run', 3], ['g'], ['run', 5], ['up', 8, 4], ['*', 0, 1], ['run', 2], ['down', 4, 4], ['k'], ['run', 3],
      ['g'], ['run', 4], ['up', 6, 3], ['*', 0, 2], ['run', 2], ['down', 6, 3], ['run', 2], ['*', 0, 1], ['run', 3], ['F']]) },
    { name: 'Gliding lesson', tip: 'With the owl\'s tail, hold Jump in the air to glide.', map: build([
      ['run', 3], ['S'], ['run', 3], ['o'], ['run', 5], ['pit', 8], ['run', 3], ['*', 0, 2], ['run', 2], ['k'], ['o'], ['run', 4],
      ['up', 2, 3], ['pit', 10], ['run', 3], ['*', 0, 1], ['run', 2], ['spikes', 4], ['run', 3], ['*', 0, 2], ['run', 3], ['F']]) },
    { name: 'Hard shell', tip: 'The flag is under that cracked lid. Land on it with something heavy.', map: build([
      ['run', 3], ['S'], ['run', 4], ['*', 0, 2], ['run', 3], ['t'], ['run', 5], ['wall', 1, 2], ['run', 3], ['*', 0, 3], ['run', 3], ['vault', 4]]) },
    { name: 'Spike garden', tip: 'Six spikes is too far to jump. Too far for normal legs, anyway.', map: build([
      ['run', 3], ['S'], ['run', 3], ['b'], ['run', 4], ['spikes', 6], ['run', 3], ['*', 0, 3], ['run', 2], ['k'], ['b'], ['run', 4],
      ['spikes', 6], ['run', 2], ['wall', 4, 2], ['run', 3], ['*', 0, 1], ['spikes', 5], ['run', 3], ['*', 0, 2], ['run', 2], ['F']]) },
    { name: 'Up and over', tip: 'Climb up, then swap your claws for a tail at the top.', map: build([
      ['run', 3], ['S'], ['run', 3], ['g'], ['run', 5], ['up', 8, 6], ['o'], ['*', 0, 2], ['run', 1], ['pit', 9], ['down', 8, 4], ['k'], ['run', 2],
      ['*', 0, 1], ['run', 3], ['F']]) },
    { name: 'Two keys', tip: 'Springs to cross, a shell to open. One at a time.', map: build([
      ['run', 3], ['S'], ['run', 3], ['b'], ['run', 4], ['spikes', 6], ['run', 3], ['k'], ['*', 0, 3], ['run', 2], ['t'], ['run', 5], ['*', 0, 2], ['run', 2], ['vault', 5]]) },
    { name: 'Gecko towers', tip: 'Three towers. Keep your claws, and don\'t touch the spikes.', map: build([
      ['run', 3], ['S'], ['run', 2], ['g'], ['run', 4], ['up', 7, 3], ['*', 0, 1], ['down', 7, 2], ['spikes', 2], ['up', 9, 3], ['k'], ['down', 9, 2],
      ['spikes', 2], ['up', 10, 3], ['*', 0, 2], ['down', 10, 3], ['run', 2], ['*', 0, 1], ['run', 3], ['F']]) },
    { name: 'Long way down', tip: 'From the top of the cliff, a glider can go a long way.', map: build([
      ['run', 3], ['S'], ['run', 2], ['g'], ['run', 4], ['up', 9, 4], ['*', 0, 1], ['run', 1], ['o'], ['run', 3], ['k'], ['pit', 12], ['down', 7, 4],
      ['*', 0, 2], ['run', 2], ['spikes', 3], ['run', 3], ['*', 0, 1], ['run', 2], ['F']]) },
    { name: 'Everything once', tip: 'Spring, glide, then smash. Grab each one when you need it.', map: build([
      ['run', 3], ['S'], ['run', 3], ['b'], ['run', 4], ['wall', 4, 2], ['run', 3], ['*', 0, 1], ['run', 2], ['k'], ['o'], ['run', 4], ['up', 2, 3],
      ['pit', 9], ['down', 2, 3], ['*', 0, 2], ['run', 2], ['t'], ['run', 5], ['*', 0, 3], ['run', 2], ['vault', 5]]) },
    { name: 'The summit', tip: 'Claws, tail, shell. The whole mountain.', map: build([
      ['run', 3], ['S'], ['run', 2], ['g'], ['run', 4], ['up', 9, 5], ['*', 0, 1], ['o'], ['run', 3], ['k'], ['pit', 10], ['down', 6, 4],
      ['*', 0, 2], ['spikes', 3], ['run', 3], ['down', 3, 3], ['t'], ['run', 5], ['*', 0, 3], ['run', 2], ['vault', 6]]) },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.BootsLevels = LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);
