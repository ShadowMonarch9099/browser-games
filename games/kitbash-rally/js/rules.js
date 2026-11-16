// Kitbash Rally rules: parts, stats, tracks and the race simulation.
// No DOM and no audio in here, so the same file runs under Node
// (tools/test-race.js). The race reports what happened through race.events;
// the game turns those into sound, sparks and camera shake.
(function (root) {
  'use strict';
  const KR = root.KR || {};

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  KR.util = { clamp, lerp, rng, hash };

  // ---------- parts ----------
  // Parts are stats and powers at once. Six slots: front, middle, back on the
  // left (even index) and right (odd index).
  const PARTS = {
    empty: { name: 'Empty', short: '--', color: '#4a4f5c', mass: 0, blurb: 'Bare bolts. Light, and that is all.' },
    engine: { name: 'Engine', short: 'ENG', color: '#e4572e', mass: 2, power: 3, blurb: 'Steady power. The bread and butter.' },
    turbo: { name: 'Big engine', short: 'V8', color: '#b3202a', mass: 4, power: 6, blurb: 'Twice the shove, twice the weight.' },
    wheels: { name: 'Grippy wheels', short: 'GRP', color: '#1c8fc4', mass: 1, grip: 0.18, blurb: 'Hold the line through fast corners.' },
    plate: { name: 'Armour plate', short: 'ARM', color: '#8d99ae', mass: 3, armor: 1, blurb: 'Shrug off bumps and oil. Heavy.' },
    rocket: { name: 'Rocket pod', short: 'RKT', color: '#ff8a1f', mass: 1, rocket: 1, blurb: 'No pod, no boosts. Fit one to fire canisters.' },
    magnet: { name: 'Magnet', short: 'MAG', color: '#9d4edd', mass: 1, magnet: 1, blurb: 'Drags pickups across the road to you.' },
    spring: { name: 'Spring', short: 'SPR', color: '#16c79a', mass: 1, spring: 1, blurb: 'Hop clean over oil and grass.' },
    spoiler: { name: 'Spoiler', short: 'SPL', color: '#ffc21a', mass: 1, grip: 0.1, top: 1, blurb: 'A bit of grip and a bit of top speed.' },
  };
  const PALETTE = ['empty', 'engine', 'turbo', 'wheels', 'plate', 'rocket', 'magnet', 'spring', 'spoiler'];
  const SLOT_NAMES = ['Front left', 'Front right', 'Middle left', 'Middle right', 'Back left', 'Back right'];
  const DEFAULT = ['wheels', 'wheels', 'engine', 'rocket', 'spring', 'engine'];

  function stats(build) {
    const s = { mass: 5, power: 6, grip: 0.55, armor: 0, rocket: 0, magnet: 0, spring: 0, top: 0, pull: 0 };
    build.forEach((id, i) => {
      const p = PARTS[id] || PARTS.empty;
      s.mass += p.mass; s.power += p.power || 0; s.grip += p.grip || 0; s.armor += p.armor || 0;
      s.rocket += p.rocket || 0; s.magnet += p.magnet || 0; s.spring += p.spring || 0; s.top += p.top || 0;
      s.pull += (i % 2 ? 1 : -1) * p.mass;                  // right minus left: the heavy side drags
    });
    s.accel = (s.power / s.mass) * 9;
    s.topSpeed = 15 + s.power * 0.7 - s.mass * 0.35 + s.top * 1.2;
    s.grip = Math.min(1.15, s.grip);
    return s;
  }
  function validBuild(b) {
    return Array.isArray(b) && b.length === 6 && b.every((id) => typeof id === 'string' && PARTS[id]);
  }

  // ---------- tracks ----------
  // Each circuit is a loop through control points (the same six layouts the
  // game has always had). The loop is smoothed, cut into equal road segments,
  // and each segment remembers how hard the road bends there and how high it
  // sits, which is all the behind-the-kart view needs.
  const TRACKS = [
    { name: 'Tin Can Oval', cup: 0, theme: 'yard', pts: [[12, 30], [20, 10], [50, 6], [80, 10], [88, 30], [80, 50], [50, 54], [20, 50]], oil: 2, hills: [[2, 5, 0.4], [3, 2.5, 2]] },
    { name: 'Scrapyard Esses', cup: 0, theme: 'dusk', pts: [[10, 12], [40, 8], [55, 22], [70, 8], [90, 14], [88, 46], [62, 52], [50, 36], [36, 52], [10, 48]], oil: 3, hills: [[3, 9, 1], [5, 4, 0.2]] },
    { name: 'Bolt Bend', cup: 0, theme: 'docks', pts: [[14, 8], [86, 8], [90, 28], [60, 30], [60, 40], [88, 44], [84, 54], [16, 54], [10, 30]], oil: 4, hills: [[2, 7, 2.2], [4, 5, 0.9]] },
    { name: 'Gearbox Gorge', cup: 1, theme: 'gorge', pts: [[10, 10], [30, 6], [44, 26], [58, 6], [90, 10], [90, 52], [70, 52], [56, 34], [42, 52], [10, 52]], oil: 4, hills: [[2, 20, 0.3], [5, 8, 1.7]] },
    { name: 'Sprocket Spiral', cup: 1, theme: 'night', pts: [[50, 30], [62, 18], [80, 14], [90, 30], [80, 50], [50, 54], [18, 50], [10, 30], [22, 10], [40, 14]], oil: 5, hills: [[3, 12, 2.6], [4, 7, 0.5]] },
    { name: 'Piston Peak', cup: 1, theme: 'peak', pts: [[8, 50], [14, 12], [30, 22], [46, 6], [62, 22], [78, 6], [92, 14], [90, 50], [60, 44], [36, 54]], oil: 6, hills: [[1, 26, 4.2], [4, 13, 1.1], [7, 5, 0.3]] },
  ];
  const CUPS = [{ name: 'Nut Cup', tracks: [0, 1, 2] }, { name: 'Cog Cup', tracks: [3, 4, 5] }];
  const LAPS = 3;
  const SEG_PER_UNIT = 7;     // road segments per unit of the layout
  const ZS = 3;               // segments travelled per second for each unit of speed
  const RW = 9;               // half the road width, in segments
  const POINTS = [10, 8, 6, 5, 4, 3, 2];

  function smooth(pts) {
    const out = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (let t = 0; t < 1; t += 1 / 16) {
        const t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      }
    }
    return out;
  }

  const trackCache = {};
  function buildTrack(index) {
    if (trackCache[index]) return trackCache[index];
    const def = TRACKS[index], raw = smooth(def.pts), n = raw.length;
    const cum = [0];
    for (let i = 0; i < n; i++) { const a = raw[i], b = raw[(i + 1) % n]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const per = cum[n], N = Math.round((per * SEG_PER_UNIT) / 6) * 6;
    const pts = [];
    let j = 0;
    for (let i = 0; i < N; i++) {
      const d = (per * i) / N;
      while (cum[j + 1] < d) j++;
      const t = (d - cum[j]) / (cum[j + 1] - cum[j] || 1), a = raw[j], b = raw[(j + 1) % n];
      pts.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
    }
    let curve = [];
    const head = pts.map((p, i) => { const q = pts[(i + 1) % N]; return Math.atan2(q[1] - p[1], q[0] - p[0]); });
    for (let i = 0; i < N; i++) { const d = head[(i + 1) % N] - head[i]; curve.push(Math.atan2(Math.sin(d), Math.cos(d))); }
    for (let pass = 0; pass < 3; pass++) {
      const next = [];
      for (let i = 0; i < N; i++) { let s = 0; for (let k = -6; k <= 6; k++) s += curve[(i + k + N) % N]; next.push(s / 13); }
      curve = next;
    }
    const height = (i) => def.hills.reduce((s, h) => s + h[1] * Math.sin((Math.PI * 2 * h[0] * i) / N + h[2]), 0);
    const segs = [];
    for (let i = 0; i < N; i++) segs.push({ i, curve: curve[i], y1: height(i), y2: height(i + 1), sprites: [] });
    const t = { index, def, name: def.name, theme: def.theme, N, segs, pts, RW };
    trackCache[index] = t;
    return t;
  }
  const wrapIdx = (z, N) => ((Math.floor(z) % N) + N) % N;
  function roadY(track, z) {
    const seg = track.segs[wrapIdx(z, track.N)], f = z - Math.floor(z);
    return lerp(seg.y1, seg.y2, f);
  }
  // signed distance from a to b along the loop, in (-N/2, N/2]
  function ahead(track, from, to) {
    const N = track.N;
    let d = (to - from) % N;
    if (d > N / 2) d -= N; else if (d <= -N / 2) d += N;
    return d;
  }

  // ---------- drivers ----------
  const CPU = [
    { name: 'Rusty', color: '#f4a261', build: ['wheels', 'wheels', 'engine', 'engine', 'plate', 'plate'], skill: 0.86 },
    { name: 'Volt', color: '#4cc9f0', build: ['spoiler', 'wheels', 'turbo', 'rocket', 'empty', 'engine'], skill: 0.9 },
    { name: 'Gizmo', color: '#c04bd0', build: ['magnet', 'rocket', 'engine', 'engine', 'wheels', 'spring'], skill: 0.88 },
    { name: 'Clunk', color: '#7d8597', build: ['plate', 'plate', 'turbo', 'turbo', 'wheels', 'wheels'], skill: 0.84 },
    { name: 'Zip', color: '#80ed99', build: ['wheels', 'spoiler', 'engine', 'empty', 'rocket', 'engine'], skill: 0.92 },
  ];
  const HUMANS = [{ name: 'Red', color: '#ef233c' }, { name: 'Blue', color: '#3a86ff' }];
  const DIFFICULTY = [{ name: 'Sunday drive', pace: 0.93 }, { name: 'Club race', pace: 1 }, { name: 'Works team', pace: 1.06 }];

  // ---------- race ----------
  // opts: { track, builds: [build, build?], difficulty: 0..2, demo: bool }
  function createRace(opts) {
    const track = buildTrack(opts.track), N = track.N;
    const rand = rng(hash(track.name));
    const humans = opts.demo ? 0 : opts.builds.length;
    const cpus = CPU.slice(0, 6 - humans).map((c) => Object.assign({}, c, { human: -1 }));
    const people = [];
    for (let i = 0; i < humans; i++) people.push(Object.assign({}, HUMANS[i], { human: i, build: opts.builds[i].slice(), skill: 1 }));
    const list = cpus.concat(people);       // people start at the back of the grid
    const karts = list.map((k, i) => {
      const row = Math.floor(i / 2), side = i % 2 ? 1 : -1;
      return Object.assign(k, {
        id: i, s: stats(k.build), z: -(row * 7 + 4) - (i % 2) * 3, x: side * 0.42, vx: 0, speed: 0,
        lap: 0, lapStart: 0, bestLap: 0, done: false, time: 0, place: i + 1,
        boosts: 0, boostT: 0, hop: 0, hopCool: 0, spin: 0, spinAng: 0, bolts: 0,
        steer: 0, slip: 0, grass: false, bumpT: 0,
        ai: { lane: (rand() - 0.5) * 0.7, think: rand() * 2, seed: rand() },
      });
    });
    const items = [], oils = [];
    for (let k = 0; k < 12; k++) {
      const z = Math.floor(((k + 0.5) / 12) * N), x = (rand() - 0.5) * 1.2;
      if (k % 2) items.push({ z, x, x0: x, type: 'boost', gone: 0 });
      else for (let b = 0; b < 3; b++) items.push({ z: (z + b * 7) % N, x, x0: x, type: 'bolt', gone: 0 });
    }
    for (let k = 0; k < track.def.oil + 2; k++) oils.push({ z: Math.floor(70 + rand() * (N - 140)), x: (rand() - 0.5) * 1.5 });
    return {
      track, karts, items, oils, humans, laps: LAPS, time: 0, startT: 3.6, endT: 0, over: false,
      finishOrder: [], events: [], pace: DIFFICULTY[opts.difficulty === undefined ? 1 : opts.difficulty].pace, demo: !!opts.demo,
    };
  }

  // What a computer driver wants to do this step.
  function think(race, k, dt) {
    const T = race.track, N = T.N, s = k.s, ai = k.ai;
    ai.think -= dt;
    if (ai.think <= 0) { ai.think = 1.5 + ai.seed * 2; ai.seed = (ai.seed * 7.13 + 0.31) % 1; ai.lane = (ai.seed - 0.5) * 0.9; }
    let cAhead = 0;
    for (let n = 4; n < 40; n += 4) cAhead += T.segs[wrapIdx(k.z + n, N)].curve;
    cAhead /= 9;
    let target = clamp(ai.lane * 0.6 + clamp(cAhead * 70, -0.62, 0.62), -0.85, 0.85);
    let hop = false;
    for (const o of race.oils) {
      const d = ahead(T, k.z, o.z);
      if (d < -1 || d > 30 || Math.abs(o.x - k.x) > 0.34) continue;
      if (s.spring && k.hopCool <= 0) { if (d < 5) hop = true; } else target = o.x + (k.x >= o.x ? 0.5 : -0.5);
    }
    if (s.rocket && k.boosts < 2) for (const it of race.items) {
      if (it.gone > 0 || it.type !== 'boost') continue;
      const d = ahead(T, k.z, it.z);
      if (d > 3 && d < 45 && Math.abs(it.x - k.x) < 0.8) target = it.x;
    }
    for (const o of race.karts) {
      if (o === k) continue;
      const d = o.z - k.z;
      if (d > 0 && d < 10 && Math.abs(o.x - k.x) < 0.3 && o.speed < k.speed) target = o.x + (k.x >= o.x ? 0.4 : -0.4);
    }
    target = clamp(target, -0.9, 0.9);
    const steer = clamp((target - k.x) * 5 - k.vx * 0.6, -1, 1);
    // lift when the corner ahead is more than the tyres can hold
    const hold = (1.5 + s.grip * 0.6), push = Math.abs(cAhead) * 110 * Math.pow(k.speed / 20, 2) * (1.35 - s.grip * 0.55);
    const gas = push > hold * 1.25 ? 0.15 : k.skill;
    const boost = k.boosts > 0 && Math.abs(cAhead) < 0.004 && k.speed > s.topSpeed * 0.5;
    if (k.grass && s.spring && k.hopCool <= 0) hop = true;
    return { steer, gas, brake: 0, hop, boost };
  }

  function stepKart(race, k, inp, dt) {
    const T = race.track, N = T.N, s = k.s, started = race.time >= race.startT, ev = race.events;
    let steer = clamp(inp.steer || 0, -1, 1), gas = clamp(inp.gas || 0, 0, 1), brake = inp.brake ? 1 : 0, hop = !!inp.hop, boost = !!inp.boost;
    if (!started) { gas = 0; brake = 0; hop = false; boost = false; }
    if (k.done) { gas = Math.min(gas, 0.5); hop = false; boost = false; }
    k.hop = Math.max(0, k.hop - dt); k.hopCool = Math.max(0, k.hopCool - dt); k.boostT = Math.max(0, k.boostT - dt);
    k.spin = Math.max(0, k.spin - dt); k.bumpT = Math.max(0, k.bumpT - dt);
    if (hop && s.spring && k.hopCool <= 0) { k.hop = 0.55; k.hopCool = 2.2; ev.push({ type: 'hop', k }); }
    if (boost && k.boosts > 0 && k.boostT <= 0) { k.boosts--; k.boostT = 1.4; ev.push({ type: 'boost', k }); }

    const seg = T.segs[wrapIdx(k.z, N)], curve = seg.curve;
    const wasGrass = k.grass;
    k.grass = Math.abs(k.x) > 1.06 && k.hop <= 0;
    if (k.grass && !wasGrass) ev.push({ type: 'grass', k });
    let top = s.topSpeed * (k.grass ? 0.45 : 1) * (k.boostT > 0 ? 1.45 : 1);
    if (k.human < 0) {
      top *= (0.87 + k.skill * 0.13) * race.pace;
      // on the friendlier settings the pack closes up a little instead of stringing out
      if (race.pace <= 1 && race.humans) {
        const lead = Math.max.apply(null, race.karts.filter((o) => o.human >= 0).map((o) => o.z));
        top *= k.z - lead > 140 ? 0.95 : k.z - lead < -140 ? 1.04 : 1;
      }
    }
    if (k.done) top *= 0.6;
    if (k.spin > 0) { k.spinAng += 11 * dt; gas = 0; steer = 0; k.speed -= k.speed * 0.9 * dt; } else k.spinAng = 0;
    k.speed += gas * s.accel * (k.boostT > 0 ? 2 : 1) * dt;
    k.speed -= k.speed * (gas > 0 ? 0.12 : 0.48) * dt;
    if (brake) k.speed -= 26 * dt;
    if (k.speed > top) k.speed -= (k.speed - top) * Math.min(1, 4 * dt);
    if (k.speed < 0) k.speed = 0;

    // sideways: steering fights the corner pushing you outwards; grip decides who wins
    const sf = Math.min(1, k.speed / 6), hold = 1.5 + s.grip * 0.6;
    const want = steer * hold * sf;
    k.vx += (want - k.vx) * Math.min(1, s.grip * 7 * dt);
    const push = curve * 110 * Math.pow(k.speed / 20, 2) * (1.35 - s.grip * 0.55);
    k.x += (k.vx - push + s.pull * 0.03 * Math.min(1, k.speed / 10)) * dt;
    k.steer += (steer - k.steer) * Math.min(1, 10 * dt);
    const over = Math.abs(push) / hold;
    k.slip = k.speed > 8 && k.hop <= 0 && !k.grass ? clamp(Math.max(over - 0.55, Math.abs(steer) > 0.8 && Math.abs(curve) > 0.003 ? 0.3 : 0), 0, 1) : 0;
    if (Math.abs(k.x) > 2.3) { k.x = clamp(k.x, -2.3, 2.3); k.vx = 0; if (k.speed > 6) { k.speed *= 0.9; if (k.bumpT <= 0) { k.bumpT = 0.4; ev.push({ type: 'wall', k }); } } }

    const lapBefore = Math.floor(k.z / N);
    k.z += k.speed * ZS * dt;
    const lapNow = Math.floor(k.z / N);
    if (started && lapNow > lapBefore && lapNow >= 1 && !k.done) {
      const lt = race.time - race.startT - k.lapStart;
      k.lapStart = race.time - race.startT;
      if (!k.bestLap || lt < k.bestLap) k.bestLap = lt;
      k.lap = lapNow;
      if (lapNow >= race.laps) { k.done = true; k.time = race.time - race.startT; race.finishOrder.push(k); ev.push({ type: 'finish', k }); }
      else ev.push({ type: 'lap', k, lap: lapNow, time: lt });
    }

    // pickups and oil
    for (const it of race.items) {
      if (it.gone > 0) continue;
      const d = ahead(T, k.z, it.z), dx = it.x - k.x;
      if (s.magnet && d > -2 && d < 34 && Math.abs(dx) < 1.3 && Math.abs(dx) > 0.02) it.x -= Math.sign(dx) * Math.min(Math.abs(dx), 1.5 * dt);
      if (Math.abs(d) < 2.6 && Math.abs(dx) < 0.3) {
        if (it.type === 'boost') { if (!s.rocket) continue; k.boosts = Math.min(2, k.boosts + 1); }
        else { k.bolts++; k.speed += 0.8; }
        it.gone = 6;
        ev.push({ type: 'pickup', k, item: it.type });
      }
    }
    if (k.hop <= 0 && k.spin <= 0) for (const o of race.oils) {
      if (Math.abs(ahead(T, k.z, o.z)) < 2.4 && Math.abs(o.x - k.x) < 0.24) {
        k.spin = s.armor ? 0.25 : 0.7; k.speed *= 0.6;
        ev.push({ type: 'oil', k });
        break;
      }
    }
  }

  function bump(race) {
    const ks = race.karts;
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      const a = ks[i], b = ks[j], dz = b.z - a.z, dx = (b.x - a.x) * RW, adx = Math.abs(dx);
      if (Math.abs(dz) > 4.2 || adx > 2.9 || a.hop > 0 || b.hop > 0) continue;
      const ma = a.s.mass + a.s.armor * 3, mb = b.s.mass + b.s.armor * 3, wa = mb / (ma + mb), wb = ma / (ma + mb);
      const push = ((2.9 - adx) / RW) * 0.6, dir = dx >= 0 ? 1 : -1;
      a.x -= dir * push * wa; b.x += dir * push * wb;
      const back = dz >= 0 ? a : b, front = dz >= 0 ? b : a, wBack = dz >= 0 ? wa : wb;
      if (back.speed > front.speed) {
        const diff = back.speed - front.speed;
        back.speed -= diff * wBack * 0.9; front.speed += diff * (1 - wBack) * 0.6;
        if (diff > 1.5 && back.bumpT <= 0 && front.bumpT <= 0) { back.bumpT = front.bumpT = 0.35; race.events.push({ type: 'bump', k: back, other: front, hard: diff }); }
      }
    }
  }

  function order(race) {
    return race.karts.slice().sort((a, b) => (b.done - a.done) || (a.done && b.done ? a.time - b.time : b.z - a.z));
  }

  // inputs[humanIndex] = { steer, gas, brake, hop, boost }
  function stepRace(race, dt, inputs) {
    race.time += dt;
    for (const it of race.items) { if (it.gone > 0) { it.gone = Math.max(0, it.gone - dt); if (it.gone === 0) it.x = it.x0; } }
    for (const k of race.karts) {
      const mine = k.human >= 0 && !k.done ? (inputs && inputs[k.human]) || {} : think(race, k, dt);
      stepKart(race, k, mine, dt);
    }
    bump(race);
    order(race).forEach((k, i) => { k.place = i + 1; });
    const people = race.karts.filter((k) => k.human >= 0);
    const waiting = people.length ? people.every((k) => k.done) : race.finishOrder.length >= 3;
    // nobody has to sit and watch a straggler: half a minute after the winner, the flag drops
    const first = race.finishOrder[0];
    if (waiting || (first && race.time - race.startT - first.time > 30)) { race.endT += dt; if (race.endT > 2.6) race.over = true; }
  }

  function results(race) {
    return order(race).map((k, i) => ({ kart: k, name: k.name, place: i + 1, points: POINTS[i], time: k.done ? k.time : 0, human: k.human }));
  }

  Object.assign(KR, {
    PARTS, PALETTE, SLOT_NAMES, DEFAULT, stats, validBuild, TRACKS, CUPS, LAPS, ZS, RW, POINTS, CPU, HUMANS, DIFFICULTY,
    buildTrack, roadY, ahead, wrapIdx, createRace, stepRace, think, order, results,
  });
  root.KR = KR;
  if (typeof module !== 'undefined' && module.exports) module.exports = KR;
})(typeof window !== 'undefined' ? window : globalThis);
