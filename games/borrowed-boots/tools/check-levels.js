// Plays every Borrowed Boots level with the real game rules (js/sim.js) and
// reports whether the flag and each star can be reached.
//
//   node games/borrowed-boots/tools/check-levels.js          all levels
//   node games/borrowed-boots/tools/check-levels.js 7        just level 7
//   node games/borrowed-boots/tools/check-levels.js --stars  also check every star
//
// It is a best-first search over button presses: every 3 frames the bot picks
// left / right / nothing, with jump held or not. States that look alike
// (same place, speed and borrowed trick) are only explored once. Any route it
// finds is a real one: it was produced by stepping the game itself. Dying is
// never part of a route.
const path = require('path');
const Sim = require(path.join(__dirname, '..', 'js', 'sim.js'));
const LEVELS = require(path.join(__dirname, '..', 'js', 'levels.js'));

const DT = 1 / 60, HOLD = 3, MAX_NODES = 1500000;
const ACTIONS = [];
for (const x of [1, 0, -1]) for (const hold of [false, true]) ACTIONS.push({ x, hold });

class Heap {
  constructor() { this.a = []; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { let m = i; const l = i * 2 + 1, r = l + 1; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top;
  }
  get size() { return this.a.length; }
}

function key(s, held) {
  const p = s.p;
  let k = Math.round(p.x * 4) + ',' + Math.round(p.y * 4) + ',' + Math.round(p.vx / 3.5) + ',' + Math.round(p.vy / 3) + ',' + (p.power || '-') + (p.ground ? 'g' : 'a') + (held ? 'h' : 'n') + (s.smashed ? 'S' : '') + (p.hurt > 0 ? 'H' : '') + s.got;
  // where the nearest creature is matters for landing on it
  for (const c of s.critters) if (Math.abs(c.x - p.x) < 4) k += '|' + (c.gone > 0 ? 'x' : Math.round(c.x * 2) + (c.dir > 0 ? '>' : '<'));
  return k;
}

// goal(state) -> true when done; target {x, y} steers the search.
function search(level, goal, target, from) {
  const start = Sim.create(level);
  if (from) { start.spawn = from; start.p.x = from.x; start.p.y = from.y; }
  const heap = new Heap(), seen = new Set();
  const h = (s) => Math.abs(target.x - s.p.x) + Math.abs(target.y - s.p.y) * 0.5;
  heap.push({ s: start, held: false, f: h(start), steps: 0 });
  seen.add(key(start, false));
  let nodes = 0;
  while (heap.size && nodes < MAX_NODES) {
    const n = heap.pop();
    nodes++;
    for (const act of ACTIONS) {
      const s = Sim.clone(n.s);
      let held = n.held, dead = false;
      for (let i = 0; i < HOLD; i++) {
        Sim.step(s, { x: act.x, hold: act.hold, press: act.hold && !held, up: act.hold }, DT);
        held = act.hold;
        if (s.deaths) { dead = true; break; }
        if (goal(s)) return { ok: true, nodes, time: s.time };
      }
      if (dead) continue;
      const k = key(s, held);
      if (seen.has(k)) continue;
      seen.add(k);
      heap.push({ s, held, f: h(s) + (n.steps + 1) * 0.02, steps: n.steps + 1 });
    }
  }
  return { ok: false, nodes };
}

const args = process.argv.slice(2);
const wantStars = args.includes('--stars');
const only = args.find((a) => /^\d+$/.test(a));
let bad = 0;
LEVELS.forEach((level, i) => {
  if (only && +only !== i + 1) return;
  const probe = Sim.create(level);
  const problems = [];
  if (!probe.spawn) problems.push('no start');
  if (!probe.flag) problems.push('no flag');
  if (new Set(level.map.map((r) => r.length)).size !== 1) problems.push('rows differ in length');
  let line = String(i + 1).padStart(2) + '. ' + level.name.padEnd(18);
  if (!problems.length) {
    const t0 = Date.now();
    const r = search(level, (s) => s.won, probe.flag);
    line += r.ok ? 'flag reached in ' + r.time.toFixed(1) + 's of play' : 'FLAG NOT REACHED';
    if (!r.ok) problems.push('flag not reached');
    if (wantStars && r.ok) {
      probe.stars.forEach((st, n) => {
        const rs = search(level, (s) => s.stars[n].taken, st);
        if (!rs.ok) problems.push('star ' + (n + 1) + ' at column ' + Math.floor(st.x) + ' not reached');
      });
      line += ', ' + probe.stars.length + ' stars checked';
    }
    // after a fall you restart at the checkpoint with no trick: that must not be a dead end
    level.map.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== 'k' || !r.ok) return;
      const rc = search(level, (s) => s.won, probe.flag, { x: x + 0.5, y: y + 1 });
      if (!rc.ok) problems.push('flag not reachable from the checkpoint at column ' + x);
    }));
    line += '  (' + r.nodes + ' states, ' + ((Date.now() - t0) / 1000).toFixed(1) + 's)';
  }
  const checks = (level.map.join('').match(/k/g) || []).length;
  line += '  [' + probe.stars.length + ' stars, ' + checks + ' checkpoints, ' + probe.critters.map((c) => c.type).join('') + ']';
  console.log(line + (problems.length ? '\n    PROBLEM: ' + problems.join('; ') : ''));
  if (problems.length) bad++;
});
if (bad) { console.error(bad + ' level(s) have problems'); process.exit(1); }
console.log('All levels can be finished.');
