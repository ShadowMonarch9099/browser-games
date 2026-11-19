// Tide Pool Pop levels: forty pools along one shoreline, from the warm
// shallows out to the kelp edge. Each pool has a shape (some squares are
// rock ledge), a number of creature kinds, a move budget and a goal:
//   score   reach a number of points
//   collect pop so many of particular creatures
//   sand    wash away every patch of sand (some patches take two washes)
//   rocks   crack every barnacle stone (some take two or three hits)
(function (root) {
  const F = '########';
  const SHAPES = {
    full: [F, F, F, F, F, F, F, F, F],
    cove: ['.######.', F, F, F, F, F, F, F, '.######.'],
    hourglass: [F, F, '.######.', '..####..', '..####..', '..####..', '.######.', F, F],
    ring: [F, F, F, '###..###', '###..###', '###..###', F, F, F],
    arch: ['..####..', '.######.', F, F, F, F, '###..###', '###..###', '###..###'],
    twin: ['###..###', '###..###', '###..###', F, F, F, '###..###', '###..###', '###..###'],
    shell: ['...##...', '..####..', '.######.', F, F, F, F, '.######.', '..####..'],
    steps: ['####....', '#####...', '######..', '#######.', F, '.#######', '..######', '...#####', '....####'],
    reef: ['##.##.##', F, F, '#.####.#', F, F, '#.####.#', F, F],
    lagoon: [F, '#.####.#', F, F, '##....##', F, F, '#.####.#', F],
  };
  const D = (rows) => rows; // patterns are written as rows of digits
  const SAND = {
    middle: D(['00000000', '00000000', '00111100', '00111100', '00111100', '00111100', '00111100', '00000000', '00000000']),
    floor: D(['00000000', '00000000', '00000000', '00000000', '00000000', '11111111', '11111111', '11111111', '11111111']),
    cross: D(['00011000', '00011000', '00011000', '11111111', '11111111', '00011000', '00011000', '00011000', '00011000']),
    deep: D(['00000000', '00000000', '00222200', '00222200', '02222220', '02222220', '00222200', '00222200', '00000000']),
    all: D(['11111111', '11111111', '11111111', '11111111', '11111111', '11111111', '11111111', '11111111', '11111111']),
    deepall: D(['11111111', '12222221', '12222221', '12222221', '12222221', '12222221', '12222221', '12222221', '11111111']),
  };
  const ROCKS = {
    row: D(['00000000', '00000000', '00000000', '00000000', '11111111', '00000000', '00000000', '00000000', '00000000']),
    dots: D(['00000000', '01000010', '00000000', '00100100', '00000000', '00100100', '00000000', '01000010', '00000000']),
    wall: D(['00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '22222222', '00000000', '00000000']),
    box: D(['00000000', '00000000', '00222200', '00200200', '00200200', '00222200', '00000000', '00000000', '00000000']),
    stack: D(['00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '01111110', '11222211', '12233221']),
    pillars: D(['00000000', '00000000', '01100110', '01100110', '00000000', '01100110', '01100110', '00000000', '00000000']),
  };

  // [shape, colours, moves, goals, sand, rocks]
  const L = [
    ['full', 5, 20, { score: 7000 }],
    ['full', 5, 20, { collect: { star: 25, shell: 25 } }],
    ['cove', 5, 20, { score: 8000 }],
    ['full', 5, 22, { sand: true }, 'middle'],
    ['hourglass', 5, 22, { collect: { urchin: 24 } }],
    ['full', 5, 24, { rocks: true }, null, 'row'],
    ['ring', 5, 26, { sand: true }, 'floor'],
    ['shell', 5, 24, { score: 9000 }],
    ['full', 5, 24, { collect: { crab: 30, clam: 30 } }],
    ['arch', 5, 24, { rocks: true }, null, 'dots'],
    ['cove', 5, 26, { sand: true }, 'cross'],
    ['twin', 5, 24, { collect: { star: 26 } }],
    ['full', 5, 26, { rocks: true, score: 6000 }, null, 'wall'],
    ['reef', 5, 26, { sand: true }, 'deep'],
    ['hourglass', 5, 28, { score: 9000 }],
    ['full', 5, 26, { rocks: true }, null, 'box'],
    ['steps', 5, 26, { collect: { shell: 32, crab: 32 } }],
    ['lagoon', 5, 36, { sand: true }, 'all'],
    ['shell', 5, 28, { rocks: true }, null, 'pillars'],
    ['full', 5, 30, { sand: true, rocks: true }, 'floor', 'row'],
    ['ring', 5, 28, { collect: { urchin: 30, clam: 30, star: 30 } }],
    ['cove', 5, 30, { rocks: true }, null, 'stack'],
    ['arch', 5, 40, { sand: true }, 'deepall'],
    ['twin', 5, 30, { score: 9000 }],
    ['full', 6, 34, { collect: { fish: 26, crab: 26 } }],
    ['reef', 5, 30, { rocks: true, sand: true }, 'middle', 'dots'],
    ['steps', 5, 30, { sand: true }, 'all'],
    ['hourglass', 5, 30, { rocks: true }, null, 'box'],
    ['lagoon', 5, 32, { collect: { star: 34, shell: 34 } }],
    ['full', 6, 36, { sand: true }, 'deep'],
    ['shell', 5, 32, { score: 10500 }],
    ['cove', 5, 32, { rocks: true, sand: true }, 'cross', 'wall'],
    ['ring', 5, 38, { sand: true }, 'deepall'],
    ['full', 6, 40, { rocks: true }, null, 'wall'],
    ['arch', 5, 32, { collect: { urchin: 36, crab: 36, clam: 30 } }],
    ['reef', 6, 36, { score: 8000 }],
    ['twin', 5, 34, { rocks: true }, null, 'pillars'],
    ['steps', 6, 38, { sand: true, rocks: true }, 'deep', 'dots'],
    ['lagoon', 6, 40, { rocks: true }, null, 'pillars'],
    ['full', 6, 44, { sand: true, rocks: true, score: 9000 }, 'deepall', 'wall'],
  ];
  const ZONES = [
    { name: 'The Shallows', from: 1, tint: '#38c6c0' },
    { name: 'Anemone Garden', from: 11, tint: '#ff7a8a' },
    { name: 'Coral Shelf', from: 21, tint: '#ff9f43' },
    { name: 'Kelp Edge', from: 31, tint: '#5fbf6a' },
  ];

  const LEVELS = L.map(([shape, colors, moves, goals, sand, rocks], i) => {
    const mask = SHAPES[shape];
    const g = Object.assign({}, goals);
    if (g.collect) g.collect = Object.fromEntries(Object.entries(g.collect).filter(([, n]) => n > 0));
    // sand and rocks only where there's a square
    const clip = (pat) => pat && pat.map((row, y) => row.split('').map((c, x) => (mask[y][x] === '#' ? c : '0')).join(''));
    return { n: i + 1, shape, mask, colors, moves, goals: g, sand: clip(SAND[sand]), rocks: clip(ROCKS[rocks]), seed: 1000 + i * 77 };
  });
  const zoneOf = (n) => ZONES.filter((z) => z.from <= n).pop();

  const api = { LEVELS, ZONES, zoneOf, SHAPES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.TP = root.TP || {}).Levels = api;
})(typeof window !== 'undefined' ? window : globalThis);
