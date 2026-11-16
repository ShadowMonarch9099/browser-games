// The tower rules, unchanged from the original game: a block slides over the
// tower, you drop it, whatever hangs over is sliced off. Three perfect drops in
// a row start growing the block back. Every 25 floors the weather changes:
// wind (the block surges in gusts), fog (the top is hidden), then both.
// Pure logic: runs in the page and under Node (tools/test-rules.js).
(function (root) {
  const SS = root.SS;
  const BLOCK_H = 0.24;     // height of one floor, in block widths
  const RANGE = 1.45;       // how far the sliding block travels from the tower
  const PERFECT = 0.045;    // how close counts as a perfect drop
  const STAGE_LEN = 25;     // floors per weather stage
  const STAGES = ['Clear skies', 'Wind picks up', 'Fog rolls in', 'Storm: wind and fog'];

  function Tower(seed) {
    this.rand = SS.rng(seed);
    this.hue0 = this.rand.int(0, 359);
    this.stack = [{ x: 0, z: 0, w: 1, d: 1 }];
    this.streak = 0; this.bestStreak = 0; this.perfects = 0;
    this.over = false;
    this.nextMover();
  }
  Tower.prototype.height = function () { return this.stack.length - 1; };
  Tower.prototype.stage = function () { return Math.min(3, Math.floor(this.height() / STAGE_LEN)); };
  Tower.prototype.windy = function () { const s = this.stage(); return s === 1 || s === 3; };
  Tower.prototype.foggy = function () { const s = this.stage(); return s === 2 || s === 3; };
  Tower.prototype.top = function () { return this.stack[this.stack.length - 1]; };
  Tower.prototype.hueAt = function (level) { return (this.hue0 + level * 6) % 360; };

  Tower.prototype.nextMover = function () {
    const top = this.top();
    const axis = this.stack.length % 2 ? 'x' : 'z';
    const side = this.rand() < 0.5 ? -1 : 1;
    const m = {
      x: top.x, z: top.z, w: top.w, d: top.d, axis, dir: -side, t: 0, vel: 0,
      speed: Math.min(1.5 + this.stack.length * 0.022, 3.4),
      gust: 2.5 + this.rand() * 1.5, phase: this.rand() * 6.28,
    };
    m[axis] = top[axis] + side * RANGE;
    this.mover = m;
  };

  // Slide the block. Wind makes it speed up and slow down in gusts.
  Tower.prototype.step = function (dt) {
    const m = this.mover;
    if (!m || this.over) return;
    const top = this.top(), a = m.axis;
    m.t += dt;
    const gust = this.windy() ? 1 + 0.55 * Math.sin(m.t * m.gust + m.phase) : 1;
    m.vel = m.dir * m.speed * gust;
    m[a] += m.vel * dt;
    if (m[a] > top[a] + RANGE) { m[a] = top[a] + RANGE; m.dir = -1; }
    if (m[a] < top[a] - RANGE) { m[a] = top[a] - RANGE; m.dir = 1; }
  };

  // Drop the block. Returns what happened, for effects and sound.
  Tower.prototype.drop = function () {
    const m = this.mover, top = this.top();
    if (!m || this.over) return null;
    const a = m.axis, s = a === 'x' ? 'w' : 'd';
    const delta = m[a] - top[a];
    const overlap = top[s] - Math.abs(delta);
    const level = this.stack.length;
    if (overlap <= 0) {
      this.over = true; this.mover = null;
      return { type: 'miss', piece: { x: m.x, z: m.z, w: m.w, d: m.d, level }, axis: a, dir: Math.sign(delta) };
    }
    const placed = { x: top.x, z: top.z, w: top.w, d: top.d };
    const stageBefore = this.stage();
    let res;
    if (Math.abs(delta) <= PERFECT) {
      this.streak++; this.perfects++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const grew = this.streak >= 3 && placed[s] < 1;
      if (this.streak >= 3) placed[s] = Math.min(1, placed[s] + 0.05);
      res = { type: 'perfect', streak: this.streak, grew, axis: a, level };
    } else {
      this.streak = 0;
      placed[s] = overlap;
      placed[a] = top[a] + delta / 2;
      const cut = { x: placed.x, z: placed.z, w: placed.w, d: placed.d, level };
      cut[s] = Math.abs(delta);
      cut[a] = placed[a] + Math.sign(delta) * (overlap / 2 + Math.abs(delta) / 2);
      res = { type: 'cut', piece: cut, axis: a, dir: Math.sign(delta), level, lost: Math.abs(delta) };
    }
    this.stack.push(placed);
    res.placed = placed;
    res.stageUp = this.stage() !== stageBefore ? this.stage() : -1;
    this.nextMover();
    return res;
  };

  SS.Tower = Tower;
  SS.Rules = { BLOCK_H, RANGE, PERFECT, STAGE_LEN, STAGES };
})(typeof window !== 'undefined' ? window : globalThis);
