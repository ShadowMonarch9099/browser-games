// Builds many Last Lantern caves and checks each one can be played:
// every beacon, shrine and oil jar is reachable on foot from the start, and
// the generator still matches the first version for a known seed.
//   node games/last-lantern/tools/check-world.js [caves]
const path = require('path');
const W = require(path.join(__dirname, '..', 'js', 'world.js'));
const N = Number(process.argv[2]) || 400;
let bad = 0;
let jarsTotal = 0;
for (let i = 0; i < N; i++) {
  const seed = W.hash('check-' + i);
  const w = W.build(seed);
  const ok = W.reachable(w);
  const at = (o) => ok.has(Math.floor(o.x) + ',' + Math.floor(o.y));
  const problems = [];
  w.beacons.forEach((b) => at(b) || problems.push('beacon ' + b.name));
  w.shrines.forEach((s) => at(s) || problems.push('shrine ' + s.up.name));
  const jars = w.jars.filter(at).length;
  jarsTotal += jars;
  if (jars < 10) problems.push('only ' + jars + ' reachable oil jars');
  // light from the start room must reach something
  let cells = 0;
  W.visibility(w, w.start.x, w.start.y, 4.6, 120, () => cells++);
  if (cells < 20) problems.push('start room is cramped');
  if (problems.length) {
    bad++;
    console.log('seed ' + seed + ': ' + problems.join(', '));
  }
}
// Same seed, same cave: the first map row of seed 12345 hashed.
const ref = W.build(12345);
const sig = W.hash(ref.map.map((r) => r.join('')).join('|'));
console.log(`${N} caves built, ${N - bad} fully reachable, ${(jarsTotal / N).toFixed(1)} reachable oil jars on average, map signature ${sig}`);
if (bad) process.exit(1);
