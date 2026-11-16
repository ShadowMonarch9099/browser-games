// Pin Pickle levels, drawn as text. Every row of a level must be the same length.
//   #  rock        g  gold        w  water       l  lava
//   .  air         E  the explorer's cart (gold landing here is collected)
//   1-9  a pin; all cells with the same digit are one pin
// Each level can give a `solution`: an order of pins that wins, which the
// checker confirms. After editing, run:
//   node games/pin-pickle/tools/verify-levels.js
(function (root) {
  const mirror = (map) => map.map((row) => [...row].reverse().join(''));
  const wall = (n) => '#'.repeat(n);

  // ---------- builders for the common cave shapes ----------

  // One vertical shaft. layers run top to bottom, e.g. [['g', 1], ['w', 2]]:
  // each is a block of gold / water / lava that many rows tall, resting on its own pin.
  function shaft(layers) {
    const rows = [wall(20)];
    layers.forEach(([t, h], i) => {
      for (let k = 0; k < h; k++) rows.push(wall(7) + t.repeat(6) + wall(7));
      rows.push(wall(7) + String(i + 1).repeat(6) + wall(7));
    });
    rows.push('#######......#######', '#######......#######', '#######EEEEEE#######', wall(20));
    return rows;
  }

  // A row of chambers side by side, each on its own pin. chambers: [['l', 2], ['g', 2], ...]
  function chamberRows(chambers, cw) {
    const tall = Math.max(...chambers.map((c) => c[1]));
    const W = 1 + chambers.length * (cw + 1);
    const rows = [wall(W)];
    for (let r = 0; r < tall; r++) rows.push('#' + chambers.map(([t, h]) => (r >= tall - h ? t : '#').repeat(cw)).join('#') + '#');
    rows.push('#' + chambers.map((_, i) => String(i + 1).repeat(cw)).join('#') + '#');
    return { rows, W };
  }
  const open = (W) => '#' + '.'.repeat(W - 2) + '#';
  const cart = (W) => '#' + 'E'.repeat(W - 2) + '#';

  // Doors: everything drops straight into a wide cart.
  function doors(chambers, cw) {
    const { rows, W } = chamberRows(chambers, cw);
    return [...rows, open(W), open(W), open(W), cart(W), wall(W)];
  }
  // Bowl: everything drops into a basin first, held by one last pin above the cart.
  function bowl(chambers, cw) {
    const { rows, W } = chamberRows(chambers, cw);
    const last = String(chambers.length + 1);
    return [...rows, open(W), open(W), open(W), open(W), '#' + last.repeat(W - 2) + '#', open(W), cart(W), wall(W)];
  }
  // Two shafts over one wide cart. Pins are numbered down the left shaft, then the right.
  function twoShafts(left, right) {
    const column = (layers, first) => {
      const out = [];
      layers.forEach(([t, h], i) => {
        for (let k = 0; k < h; k++) out.push(t.repeat(6));
        out.push(String(first + i).repeat(6));
      });
      return out;
    };
    const L = column(left, 1), R = column(right, left.length + 1);
    const tall = Math.max(L.length, R.length);
    const pad = (col) => [...Array(tall - col.length).fill(wall(6)), ...col];
    const l = pad(L), r = pad(R);
    const rows = [wall(21)];
    for (let k = 0; k < tall; k++) rows.push('##' + l[k] + '#####' + r[k] + '##');
    return [...rows, open(21), open(21), cart(21), wall(21)];
  }

  // ---------- hand-drawn caves ----------
  const drain = [
    '####################',
    '#######gggggg#######',
    '#######gggggg#######',
    '#######111111#######',
    '#######......#######',
    '#######......#######',
    '#.....3llllll#######',
    '#.....3llllll#######',
    '#.#####222222#######',
    '#.#####......#######',
    '#.#####......#######',
    '#.#####......#######',
    '#.#####EEEEEE#######',
    '#.....##############',
    '#.....##############',
    '####################',
  ];
  const cool = [
    '####################',
    '####gggggg##wwwwwww#',
    '####gggggg##wwwwwww#',
    '####111111##wwwwwww#',
    '####......##2222222#',
    '####......#........#',
    '####...............#',
    '####llllll##########',
    '####llllll##########',
    '####333333##########',
    '####......##########',
    '####EEEEEE##########',
    '####################',
  ];
  const doubleTrouble = [
    '####################',
    '#######gggggg#######',
    '#######gggggg#######',
    '#######111111#######',
    '#######......#######',
    '#.....2llllll#wwwww#',
    '#.....2llllll#wwwww#',
    '#.#####333333#wwwww#',
    '#.#####......#44444#',
    '#.#####......#.....#',
    '#.#####............#',
    '#.#####llllll#######',
    '#.#####llllll#######',
    '#.#####555555#######',
    '#.#####......#######',
    '#.#####EEEEEE#######',
    '#.....##############',
    '#.....##############',
    '####################',
  ];

  const G = 'g', Wt = 'w', La = 'l';
  const LEVELS = [
    // ----- learning the ropes -----
    { name: 'First pull', tip: 'Tap the pin to pull it out.', solution: '1', map: [
      '####################',
      '#......gggggg......#',
      '#......gggggg......#',
      '#......gggggg......#',
      '#######111111#######',
      '#######......#######',
      '#######......#######',
      '#######......#######',
      '#######EEEEEE#######',
      '####################',
    ] },
    { name: 'Not that one', tip: 'Lava must never reach the cart.', solution: '1', map: [
      '####################',
      '#..gggggg#.llllll..#',
      '#..gggggg#.llllll..#',
      '#..gggggg#.llllll..#',
      '###111111###222222##',
      '#..................#',
      '##................##',
      '###..............###',
      '####............####',
      '#####..........#####',
      '######EEEEEEEE######',
      '####################',
    ] },
    { name: 'Pick a door', tip: 'Only one of these is worth opening.', solution: '2', map: [
      '####################',
      '#lllll##gggg##lllll#',
      '#lllll##gggg##lllll#',
      '#11111##2222##33333#',
      '#..................#',
      '##................##',
      '###..............###',
      '####............####',
      '#####EEEEEEEEEE#####',
      '####################',
    ] },
    { name: 'Needle', tip: 'Three wrong answers, one right.', solution: '3', map: doors([[La, 2], [La, 2], [G, 2], [La, 2]], 4) },
    { name: 'Every other', tip: 'You need most of the gold, so one door is not enough.', solution: '13', map: doors([[G, 2], [La, 2], [G, 2], [La, 2]], 4) },
    { name: 'Don\'t look up', tip: 'Not every pin needs pulling.', solution: '2', map: shaft([[La, 1], [G, 1]]) },
    { name: 'Bottom drawer', tip: 'Start where the gold is.', solution: '3', map: shaft([[Wt, 2], [La, 1], [G, 1]]) },
    { name: 'Two for one', tip: 'Gold behind two doors, trouble behind the third.', solution: '12', map: doors([[G, 2], [G, 2], [La, 2]], 5) },
    { name: 'Bookends', tip: 'The gold is at both ends.', solution: '15', map: doors([[G, 2], [La, 2], [Wt, 2], [La, 2], [G, 2]], 3) },
    { name: 'Middle path', tip: 'Stay away from the edges.', solution: '23', map: doors([[La, 3], [G, 2], [G, 2], [La, 3]], 4) },

    // ----- lava in the way -----
    { name: 'Drain it', tip: 'Gold melts in lava. Send the lava somewhere else first.', solution: '312', map: drain },
    { name: 'Cool it', tip: 'Water turns lava into harmless rubble.', solution: '213', map: cool },
    { name: 'Layer cake', tip: 'Gold sinks through water. Think about what lands first.', solution: '213', map: shaft([[G, 1], [Wt, 3], [La, 2]]) },
    { name: 'Quench', tip: 'Lava can fall into water, too.', solution: '213', map: shaft([[G, 1], [La, 1], [Wt, 2]]) },
    { name: 'Five doors', tip: 'Water is harmless. Lava is not.', solution: '24', map: doors([[La, 2], [G, 3], [Wt, 2], [G, 3], [La, 2]], 3) },
    { name: 'Side by side', tip: 'Half the gold is easy. The other half is not.', solution: '2134', map: twoShafts([[G, 1], [Wt, 2], [La, 1]], [[G, 1]]) },
    { name: 'Other side', tip: 'Same trouble, other way round.', solution: '312', map: mirror(drain) },
    { name: 'Flood gate', tip: 'The water has a long way to go. Give it time.', solution: '213', map: mirror(cool) },
    { name: 'Deep end', tip: 'More lava needs more water.', solution: '213', map: shaft([[G, 2], [Wt, 3], [La, 2]]) },
    { name: 'Wet blanket', tip: 'The water on top is no help. Look lower.', solution: '324', map: shaft([[Wt, 2], [G, 1], [La, 1], [Wt, 2]]) },
    { name: 'Leave it be', tip: 'One pin here should stay exactly where it is.', solution: '324', map: shaft([[La, 1], [G, 1], [Wt, 2], [La, 1]]) },
    { name: 'Top and bottom', tip: 'Bank the easy gold first.', solution: '4213', map: shaft([[G, 1], [Wt, 2], [La, 1], [G, 1]]) },

    // ----- mixing things -----
    { name: 'Mixing bowl', tip: 'Everything lands in the bowl. Decide what goes in first.', solution: '2314', map: bowl([[G, 2], [La, 2], [Wt, 3]], 5) },
    { name: 'Stir it', tip: 'Let the water finish its work before the gold goes in.', solution: '3124', map: bowl([[Wt, 3], [G, 2], [La, 2]], 5) },
    { name: 'Odd one out', tip: 'One shaft is simpler than it looks.', solution: '2435', map: twoShafts([[La, 1], [G, 1]], [[G, 1], [Wt, 2], [La, 1]]) },
    { name: 'Split the loot', tip: 'Two piles of gold, one bowl.', solution: '23145', map: bowl([[G, 2], [La, 2], [Wt, 5], [G, 2]], 4) },
    { name: 'Red herring', tip: 'The left shaft has a shortcut.', solution: '3546', map: twoShafts([[Wt, 2], [La, 1], [G, 1]], [[G, 1], [La, 1], [Wt, 2]]) },
    { name: 'In order', tip: 'Sometimes left to right really is the answer.', solution: '1234', map: bowl([[La, 2], [Wt, 3], [G, 2]], 5) },
    { name: 'Easy half', tip: 'One shaft gives up its gold at once.', solution: '6213', map: twoShafts([[G, 1], [La, 1], [Wt, 2]], [[Wt, 2], [La, 1], [G, 1]]) },
    { name: 'Big spill', tip: 'That is a lot of lava. Is there enough water?', solution: '3214', map: bowl([[G, 2], [Wt, 4], [La, 3]], 5) },
    { name: 'Late arrivals', tip: 'Both piles of gold wait until the bowl is safe.', solution: '24135', map: bowl([[G, 3], [La, 2], [G, 3], [Wt, 4]], 4) },

    // ----- long chains -----
    { name: 'Double decker', tip: 'Cool one pool, then carry the water down to the next.', solution: '23415', map: shaft([[G, 1], [Wt, 2], [La, 1], [Wt, 2], [La, 1]]) },
    { name: 'Fire and rain', tip: 'Work from the top. Each pull sets up the next.', solution: '23415', map: shaft([[G, 1], [La, 1], [Wt, 3], [La, 1], [Wt, 2]]) },
    { name: 'Two helpings', tip: 'One lot of water has to do two jobs.', solution: '2314', map: shaft([[G, 1], [Wt, 3], [La, 1], [La, 1]]) },
    { name: 'Tall and small', tip: 'The tall shaft hides a pin you never need.', solution: '5324', map: twoShafts([[La, 1], [G, 1], [Wt, 2], [La, 1]], [[G, 1]]) },
    { name: 'Double shot', tip: 'Two lots of lava need a lot of water.', solution: '14325', map: bowl([[La, 2], [G, 2], [Wt, 5], [La, 2]], 4) },
    { name: 'Mirror minds', tip: 'Two shafts, two different recipes.', solution: '213546', map: twoShafts([[G, 1], [La, 1], [Wt, 2]], [[G, 1], [Wt, 2], [La, 1]]) },
    { name: 'Pincer', tip: 'Lava from both sides, water from both sides.', solution: '241536', map: bowl([[Wt, 3], [La, 2], [G, 2], [La, 2], [Wt, 3]], 3) },
    { name: 'Double trouble', tip: 'Two pools of lava, two different fixes.', solution: '21435', map: doubleTrouble },
    { name: 'Full house', tip: 'Five doors and a bowl. Take your time.', solution: '125436', map: bowl([[La, 2], [Wt, 3], [G, 3], [Wt, 3], [La, 2]], 3) },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  else root.PinLevels = LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);
