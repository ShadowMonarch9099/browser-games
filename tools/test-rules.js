// Headless checks of the brief's rules against the real game code.
// Usage: node tools/test-rules.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { Math, console, localStorage: undefined };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['config', 'save', 'audio', 'input', 'levels', 'level', 'entities', 'game']) {
  vm.runInContext(fs.readFileSync(path.join(root, `js/${f}.js`), 'utf8'), ctx, { filename: f });
}
const { CFG: C, Game, Input: I } = ctx.SCE;
const T = C.TILE;

let failed = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? '  — ' + extra : ''}`);
};

function tick(game, n = 1, onTick) {
  for (let i = 0; i < n; i++) {
    game.update(C.STEP);
    I.endTick();
    if (onTick) onTick(game);
    if (game.state !== 'play') return;
  }
}
const hold = (...codes) => {
  I.down.clear();
  codes.forEach((c) => I.down.add(c));
};
const press = (code) => I.pressed.add(code);
const tileCenter = (i, r) => ({ x: (i + 1.5) * T, y: (r + 0.5) * T }); // interior coords

// Walk the player (or steer the clone) to an interior tile, tapping the clone
// key to swap control first if needed.
function walkTo(game, i, r, steer = false, maxTicks = 900) {
  const target = tileCenter(i, r);
  for (let k = 0; k < maxTicks && game.state === 'play'; k++) {
    if (steer && !game.clone) return false;
    if (game.clone && game.steering !== steer) {
      hold();
      press('Space');
      tick(game);
      continue;
    }
    const e = steer ? game.clone : game.player;
    const dx = target.x - e.x;
    const dy = target.y - e.y;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
      hold();
      return true;
    }
    const keys = [];
    if (dx > 1.5) keys.push('ArrowRight');
    if (dx < -1.5) keys.push('ArrowLeft');
    if (dy > 1.5) keys.push('ArrowDown');
    if (dy < -1.5) keys.push('ArrowUp');
    hold(...keys);
    tick(game);
  }
  return false;
}

function fresh(levelIndex) {
  const g = new Game();
  I.reset();
  g.startLevel(levelIndex);
  g.started = true; // skip the "move to start" intro
  return g;
}

// ---- one clone at a time + 5 second lifetime ----
{
  const g = fresh(1);
  press('Space');
  tick(g);
  const first = g.clone;
  check('clone key casts a clone', !!first);
  let ticks = 1;
  let replaced = false;
  hold();
  while (g.clone) {
    if (ticks % 20 === 0) press('Space'); // hammer the key
    tick(g);
    if (g.clone && g.clone !== first) replaced = true;
    ticks++;
  }
  check('only one clone exists at a time', !replaced);
  check('clone lasts 5 seconds', Math.abs(ticks * C.STEP - 5) < 0.05, `${(ticks * C.STEP).toFixed(2)}s`);
  press('Space');
  tick(g);
  check('cooldown blocks an instant recast', !g.clone);
  tick(g, 60);
  press('Space');
  tick(g);
  check('clone can be recast after cooldown', !!g.clone);
}

// ---- 100px leash, in open space and while dragging along walls ----
{
  const g = fresh(0);
  press('Space');
  tick(g);
  let maxD = 0;
  const track = (gm) => gm.clone && (maxD = Math.max(maxD, Math.hypot(gm.clone.x - gm.clone.sx, gm.clone.y - gm.clone.sy)));
  for (const dir of [['ArrowRight'], ['ArrowDown', 'ArrowRight'], ['ArrowUp'], ['ArrowLeft', 'ArrowUp']]) {
    hold(...dir);
    tick(g, 70, track);
  }
  check('clone never strays beyond 100px', maxD <= C.CLONE_LEASH + 1e-6, `max ${maxD.toFixed(2)}px`);
  check('player stays put while steering', Math.hypot(g.player.x - g.level.start.x, g.player.y - g.level.start.y) < 0.01);
}

// ---- clone cannot collect items (Level 4: key sits on the clone's route) ----
{
  const g = fresh(3);
  walkTo(g, 13, 7);
  press('Space');
  tick(g);
  walkTo(g, 13, 4, true);
  const key = g.level.items.find((it) => it.type === 'key');
  check('clone walks over the key without taking it', !key.taken && g.keys === 0 && g.clone);
  check('clone holds the vault plate', g.level.doors[1].open);
}

// ---- enemies ignore the clone (Level 6: park the clone in the guard's view) ----
{
  const g = fresh(5);
  press('Space');
  tick(g);
  const gd = g.guards[0];
  let inView = 0;
  hold();
  tick(g, 200, (gm) => {
    if (!gm.clone) return;
    // keep the clone right in front of the guard's lantern
    gm.clone.x = gd.x + Math.cos(gd.angle) * 40;
    gm.clone.y = gd.y + Math.sin(gd.angle) * 40;
    gm.clone.sx = gm.clone.x;
    gm.clone.sy = gm.clone.y;
    if (gd.canSee(gm.clone.x, gm.clone.y, gm.level)) inView++;
  });
  check('guards ignore a clone standing in their view', g.state === 'play' && gd.state === 'patrol' && inView > 100, `${inView} ticks in view`);
}

// ---- ...but they do see the player ----
{
  const g = fresh(5);
  const gd = g.guards[0];
  g.player.x = gd.x + Math.cos(gd.angle) * 60;
  g.player.y = gd.y + Math.sin(gd.angle) * 60;
  tick(g, 2);
  check('detection builds up instead of failing on the first frame', g.state === 'play' && gd.sus > 0);
  tick(g, 60);
  check('guards catch the player in their view', g.state === 'failed' && g.result.reason === 'spotted');
}

// ---- clone key casts, then swaps control between player and clone ----
{
  const g = fresh(0);
  press('Space');
  tick(g);
  check('casting hands control to the clone', g.steering);
  hold('ArrowRight');
  tick(g, 20);
  const moved = Math.hypot(g.clone.x - g.clone.sx, g.clone.y - g.clone.sy);
  check('movement keys steer the clone after casting', moved > 20 && Math.abs(g.player.x - g.level.start.x) < 0.01);
  hold();
  press('Space');
  tick(g);
  const cx = g.clone.x;
  hold('ArrowDown');
  tick(g, 20);
  check('clone key swaps back; the clone stays put', !g.steering && g.clone.x === cx && g.player.y > g.level.start.y + 20);
}

// ---- the 60s clock waits for the first move ----
{
  const g = new Game();
  I.reset();
  g.startLevel(0);
  hold();
  tick(g, 120);
  const waited = g.timeLeft === C.LEVEL_TIME;
  hold('ArrowRight');
  tick(g, 30);
  check('timer starts on the first move, not on load', waited && g.timeLeft < C.LEVEL_TIME);
}

// ---- twin lock needs player + clone simultaneously, then stays open ----
{
  const g = fresh(4);
  walkTo(g, 6, 12);
  tick(g, 5);
  check('player alone on a twin plate does not open it', !g.level.doors[1].open);
  press('Space');
  tick(g);
  walkTo(g, 9, 12, true);
  tick(g, 2);
  check('player + clone on both plates opens twin lock', g.level.doors[1].open);
  hold();
  tick(g, 330);
  check('twin lock stays open after the clone fades', g.level.doors[1].open && !g.clone);
}

// ---- 60 second limit ----
{
  const g = fresh(0);
  hold();
  tick(g, 60 * 60 + 5);
  check('level fails when 60 seconds run out', g.state === 'failed' && g.result.reason === 'time');
}

// ---- scripted playthroughs of the trickier levels ----
// Each step is [x, y] to walk, ['steer', x, y], 'cast', ['wait', seconds] or
// ['until', predicate]. Coordinates are interior tiles.
function play(levelIndex, steps) {
  const g = fresh(levelIndex);
  for (const s of steps) {
    if (g.state !== 'play') break;
    if (s === 'cast') {
      hold();
      press('Space');
      tick(g);
    } else if (s[0] === 'steer') walkTo(g, s[1], s[2], true);
    else if (s[0] === 'wait') {
      hold();
      tick(g, Math.round(s[1] / C.STEP));
    } else if (s[0] === 'until') {
      hold();
      for (let k = 0; k < 1200 && g.state === 'play' && !s[1](g); k++) tick(g);
    } else walkTo(g, s[0], s[1]);
  }
  const why = g.state === 'failed' ? g.result.reason : g.state;
  return { won: g.state === 'won', why, left: g.timeLeft };
}

const ready = ['until', (g) => !g.clone && g.cloneCooldown <= 0];
const solutions = {
  0: [[4, 9], [4, 14], [14, 14], [10, 14], [10, 2], [20, 2], [24, 3], [25, 12]],
  1: [[9, 8], 'cast', [16, 8], ['until', (g) => g.guards[0].r <= 4 && g.guards[0].next && g.guards[0].next.r < g.guards[0].r], [26, 8]],
  2: [[9, 10], 'cast', ['steer', 9, 7], [9, 13], [27, 13]],
  3: [[13, 7], 'cast', ['steer', 13, 4], [17, 7], [17, 5], [13, 5], [17, 5], [17, 7], [21, 12], [27, 12]],
  4: [[6, 12], 'cast', ['steer', 9, 12], [6, 8], [16, 8], [17, 4], ready, 'cast', ['steer', 20, 4], [21, 4], [21, 14], [27, 14]],
  5: [[15, 11], 'cast', ['steer', 15, 8], [15, 13], [21, 13], [27, 14]],
  10: [
    [3, 4], 'cast', ['steer', 6, 4], [3, 13], [15, 13], ready, 'cast', ['steer', 17, 13],
    [10, 13], [10, 2], [12, 2], [19, 3], [21, 3], [25, 3], ready,
    ['until', (g) => g.guards[1].c <= 25 && g.guards[1].next && g.guards[1].next.c < g.guards[1].c],
    'cast', ['steer', 25, 4], [25, 11], [27, 15],
  ],
  6: [[25, 10], 'cast', ['steer', 25, 7], [14, 10], [14, 7], [2, 7], [2, 3]],
  7: [[3, 5], 'cast', ['steer', 3, 2], [3, 12], [11, 12], ready, 'cast', ['steer', 11, 9], [27, 12]],
  8: [
    [3, 10], 'cast', ['steer', 3, 13], [8, 3], [12, 2], ready, 'cast', ['steer', 12, 5], [10, 5],
    ['until', (g) => g.guards[0].c >= 17 && g.guards[0].next && g.guards[0].next.c > g.guards[0].c],
    [10, 15], [14, 15],
    ['until', (g) => g.guards[0].c <= 14 && g.guards[0].next && g.guards[0].next.c < g.guards[0].c],
    [19, 15], [19, 3], [25, 3], [25, 9], [26, 14],
  ],
  9: [[7, 10], 'cast', ['steer', 7, 7], [23, 10], [28, 11]],
  11: [
    [2, 11], 'cast', ['steer', 5, 11], [8, 14], [8, 16], [14, 16],
    ['until', (g) => g.guards[0].c <= 11 && g.guards[0].next && g.guards[0].next.c < g.guards[0].c],
    [21, 16], [21, 9], [11, 9], ready, 'cast', [14, 9], [14, 7], [9, 5], ready, 'cast', ['steer', 9, 2],
    [9, 7], [21, 7], [21, 4], [22, 4], [26, 4], [26, 14],
  ],
};
if (process.env.TRACE) {
  // TRACE=11 node tools/test-rules.js — log player/guards every half second
  const li = +process.env.TRACE;
  const g0 = fresh(li);
  const origTick = tick;
  tick = (g, n = 1, cb) => origTick(g, n, (gm) => {
    if (Math.round(gm.timeLeft * 60) % 30 === 0) {
      const p = gm.player;
      console.log(gm.timeLeft.toFixed(1), 'P', (p.x / T - 1).toFixed(1), (p.y / T).toFixed(1),
        gm.guards.map((gd) => `${gd.type}:${gd.c - 1},${gd.r} ${gd.state} ${(gd.angle * 57.3).toFixed(0)}°`).join(' | '));
    }
    if (cb) cb(gm);
  });
  void g0;
  const r = play(li, solutions[li]);
  console.log(r);
  process.exit(0);
}
for (const [li, steps] of Object.entries(solutions)) {
  const r = play(+li, steps);
  check(`Level ${+li + 1} playthrough`, r.won, r.won ? `${r.left.toFixed(1)}s left` : `ended: ${r.why}`);
}

console.log(failed ?`\n${failed} check(s) failed.` : '\nAll rule checks passed.');
process.exit(failed ? 1 : 0);
