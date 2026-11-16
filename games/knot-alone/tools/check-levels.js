// Builds every Knot Alone climb with the game's own rules (js/rules.js) and
// proves each step can be climbed: a 2-high step with a plain jump, a 3-high
// step with a boost off the partner's head, using the real physics.
// Usage: node games/knot-alone/tools/check-levels.js
const R = require('../js/rules.js');

function tryStep(n, lower, upper) {
  const rise = upper.y - lower.y;
  const cols = [];
  for (let x = Math.max(lower.x, upper.x); x < Math.min(lower.x + lower.w, upper.x + upper.w); x++) cols.push(x);
  for (const col of cols) {
    const s = R.create(n);
    s.ropeLen = R.ROPE_MAX;
    const [a, b] = s.climbers;
    // b holds on below; a climbs (from the ledge, or from b's head for a 3-high step)
    Object.assign(b, { x: col + 0.5, y: lower.y, ground: true, pinned: true, vx: 0, vy: 0 });
    Object.assign(a, { x: col + 0.5, y: rise >= 3 ? lower.y + R.PH : lower.y, ground: true, pinned: false, vx: 0, vy: 0, peak: lower.y });
    if (rise < 3) b.x = Math.max(lower.x + 0.5, Math.min(lower.x + lower.w - 0.5, col - 1.5 + 0.5));
    let landed = false;
    for (let t = 0; t < 90; t++) {
      R.step(s, 1 / 60, [{ x: 0, jump: t === 0, up: false, down: false, anchor: false }, { x: 0, jump: false, up: false, down: false, anchor: true }]);
      if (t > 5 && a.ground && Math.abs(a.y - upper.y) < 1e-6) { landed = true; break; }
    }
    if (landed) return { ok: true, rise, col };
  }
  return { ok: false, rise, cols: cols.length };
}

let bad = 0;
for (let n = 1; n <= R.LEVELS; n++) {
  const lv = R.makeLevel(n), problems = [];
  for (let i = 1; i < lv.ledges.length; i++) {
    const lo = lv.ledges[i - 1], up = lv.ledges[i], rise = up.y - lo.y;
    if (rise !== 2 && rise !== 3) problems.push(`step ${i} rises ${rise}`);
    if (up.x < 1 || up.x + up.w > R.COLS - 1) problems.push(`step ${i} leaves the cliff`);
    const r = tryStep(n, lo, up);
    if (!r.ok) problems.push(`step ${i} (rise ${rise}) could not be climbed`);
  }
  if (problems.length) bad++;
  console.log(`${problems.length ? 'BAD' : 'ok '} ${String(n).padStart(2)} ${lv.name}: ${lv.ledges.length - 1} steps to ${lv.flag.y} m${problems.length ? ' - ' + problems.join('; ') : ''}`);
}
if (bad) { console.error(`\n${bad} climb(s) failed.`); process.exit(1); }
console.log('\nknot-alone: every step of every climb can be made.');
