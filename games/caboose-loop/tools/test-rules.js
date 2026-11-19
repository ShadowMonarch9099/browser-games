// Checks Caboose Loop's rules: moving, growing, crashing, stations, and that
// the computer drivers can survive and collect on the rivals layout.
// Usage: node games/caboose-loop/tools/test-rules.js
const R = require('../js/rules.js');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL ' + m); } };

// a train moves, turns, can't reverse, grows on a pickup
{
  const s = R.create({ mode: 'classic', seed: 1 });
  const t = s.trains[0], [hx, hy] = t.body[0];
  s.passengers = [{ x: hx + 1, y: hy, color: null }];
  R.tick(s);
  ok(t.body[0][0] === hx + 1 && t.body.length === 3 && t.grow === 1, 'moving onto a passenger queues a new carriage');
  R.tick(s);
  ok(t.body.length === 4 && t.score === 10, 'the train grows by one and scores');
  R.turn(s, 0, 'left');
  ok(t.queue.length === 0, 'a train cannot turn straight back on itself');
  R.turn(s, 0, 'up'); R.turn(s, 0, 'left');
  ok(t.queue.join() === 'up,left', 'two quick turns queue up');
}
// crashing into the fence and into itself
{
  const s = R.create({ mode: 'classic', seed: 2 });
  s.passengers = [];
  let ev = [], n = 0;
  while (!s.over && n++ < 60) ev = R.tick(s);
  ok(s.over && ev.some((e) => e.type === 'crash'), 'running straight on ends at the fence');
  const t = R.create({ mode: 'classic', seed: 3 }), tr = t.trains[0];
  t.passengers = [];
  tr.body = [[5, 5], [4, 5], [4, 6], [5, 6], [6, 6]]; tr.dir = 'right';
  R.turn(t, 0, 'down'); R.tick(t);
  ok(t.over, 'driving into your own carriages crashes');
}
// delivery: a station unloads every carriage of its colour
{
  const s = R.create({ mode: 'delivery', seed: 4 });
  const t = s.trains[0], st = s.stations[0];
  const [sx, sy] = st.cells[0];
  t.body = [[sx, sy + 1], [sx, sy + 2], [sx, sy + 3], [sx, sy + 4], [sx, sy + 5], [sx, sy + 6]]; t.dir = 'up';
  t.cars = [null, st.color, 'cobalt-ish', st.color, null];
  R.tick(s);
  const d = s.events.find((e) => e.type === 'deliver');
  ok(d && d.n === 2 && t.score === 40, 'two matching carriages unload for 40 points');
  ok(t.body.length === 4 && !t.cars.includes(st.color), 'the train gets shorter by the carriages unloaded');
}
// duel: last train running wins
{
  const s = R.create({ mode: 'duel', seed: 5 });
  s.passengers = [];
  let n = 0;
  while (!s.over && n++ < 200) { R.turn(s, 1, n % 6 < 3 ? 'up' : 'left'); R.tick(s); }
  const over = s.events.find((e) => e.type === 'over');
  ok(s.over && over && over.winner >= -1, 'a duel ends with a winner (or a draw)');
}
// rivals: the computer drivers collect and stay alive for a while
{
  let picked = 0, crashes = 0, ticks = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const s = R.create({ mode: 'rivals', seed });
    s.trains[0].kind = 'bot';                    // let a bot drive our train too
    for (let n = 0; n < 600; n++) {
      const ev = R.tick(s); ticks++;
      picked += ev.filter((e) => e.type === 'pickup').length;
      crashes += ev.filter((e) => e.type === 'crash').length;
      if (s.over) break;
    }
  }
  console.log(`rivals: ${picked} pickups, ${crashes} crashes over ${ticks} ticks`);
  ok(picked > crashes * 3, 'computer drivers mostly collect rather than crash');
}
if (fails) { console.error(`\n${fails} check(s) failed`); process.exit(1); }
console.log('caboose-loop: rules hold');
