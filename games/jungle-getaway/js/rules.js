// Jungle Getaway rules. Pure simulation: no DOM, no drawing, no sound. The
// browser game and tools/test-rules.js (Node) both run this exact file.
//
// Distances along the path are in "paces" (10 paces = 1 m on the score board),
// heights in the same unit. The renderer converts them to 3D units.
(function (root) {
  'use strict';

  const GRAV = 2300;
  const LEN = { log: 44, branch: 120, pit: 110 };
  const LANES = [-1, 0, 1];

  // One mission at a time, in order. Every third one unlocks a hat.
  const MISSIONS = [
    ['Run 300 m', (r) => r.m >= 300],
    ['Collect 15 coins in one run', (r) => r.coins >= 15],
    ['Slide under 5 branches', (r) => r.slides >= 5],
    ['Run 600 m', (r) => r.m >= 600],
    ['Jump 12 logs in one run', (r) => r.logs >= 12],
    ['Collect 40 coins in one run', (r) => r.coins >= 40],
    ['Run 500 m without a stumble', (r) => r.cleanM >= 500],
    ['Run 1000 m', (r) => r.m >= 1000],
    ['Slide under 15 branches', (r) => r.slides >= 15],
    ['Run 1500 m', (r) => r.m >= 1500],
  ];
  const HATS = [
    { name: 'Trail Fedora', color: '#8a5a2b', band: '#3b2410' },
    { name: 'Canopy Cap', color: '#3fa34d', band: '#1f5a2a' },
    { name: 'River Slouch', color: '#3a86c8', band: '#1d456b' },
    { name: 'Sun Idol Crown', color: '#ffd23f', band: '#b8860b' },
  ];

  // Hand-made stretches of jungle, easy to hard. [type, offset, height]
  const CHUNKS = [
    [[['log', 200]], [['coin', 120, 40], ['coin', 170, 40], ['coin', 220, 40]], [['branch', 220]], [['log', 160], ['coin', 160, 120]],
      [['coin', 100, 40], ['coin', 150, 90], ['coin', 200, 120], ['coin', 250, 90], ['coin', 300, 40]]],
    [[['log', 150], ['branch', 480]], [['pit', 200]], [['branch', 150], ['coin', 150, 20], ['log', 470]], [['log', 150], ['log', 420]],
      [['pit', 180], ['coin', 235, 130], ['coin', 285, 130]], [['branch', 160], ['branch', 400]]],
    [[['log', 140], ['pit', 400], ['branch', 720]], [['pit', 150], ['log', 470], ['coin', 470, 130]], [['branch', 140], ['log', 380], ['branch', 640]],
      [['log', 140], ['log', 330], ['pit', 560]], [['pit', 140], ['pit', 440]], [['branch', 130], ['pit', 400], ['coin', 455, 140], ['log', 700]]],
  ];

  // mulberry32: same seed, same jungle.
  function rng(seed) {
    let s = seed >>> 0;
    const rand = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rand.int = (min, max) => min + Math.floor(rand() * (max - min + 1));
    rand.pick = (list) => list[Math.floor(rand() * list.length)];
    return rand;
  }

  function create(seed) {
    if (seed === undefined) seed = (Math.random() * 4294967296) >>> 0;
    return {
      seed, rand: rng(seed), state: 'playing', t: 0, d: 0, speed: 330,
      things: [], nextX: 700, stumbles: 0, calm: 0, gap: 1, overT: 0,
      p: { h: 0, vy: 0, jumps: 0, slide: 0, hurt: 0, fell: false, lane: 0, x: 0, buf: 0, drop: false },
      run: { m: 0, coins: 0, slides: 0, logs: 0, cleanM: 0, lastHitM: 0 },
      events: [],
    };
  }

  // Which of the three lanes an obstacle covers. Something is always
  // passable: a full-width log can be jumped, a full-width branch slid under.
  function lanesFor(type, rand) {
    const r = rand();
    const full = type === 'log' ? 0.4 : type === 'branch' ? 0.45 : 0.35;
    if (r < full) return [true, true, true];
    const mask = [true, true, true];
    mask[rand.int(0, 2)] = false;
    if (type === 'pit' && rand() < 0.45) {
      // a single-lane hole
      const keep = mask.indexOf(false) === 0 ? rand.int(1, 2) : mask.indexOf(false) === 2 ? rand.int(0, 1) : rand.pick([0, 2]);
      return [keep === 0, keep === 1, keep === 2];
    }
    return mask;
  }

  function spawn(s) {
    const rand = s.rand;
    const m = s.nextX / 10;
    const tier = Math.min(2, Math.floor(m / 350));
    const pool = CHUNKS[rand.int(Math.max(0, tier - 1), tier)];
    const chunk = rand.pick(pool);
    let end = 0;
    let coinLane = null;
    const made = [];
    for (const [type, x, up] of chunk) {
      const t = { type, x: s.nextX + x, up: up || 0, done: false };
      if (type !== 'coin') {
        t.lanes = lanesFor(type, rand);
        if (coinLane === null) {
          // coins sit over the first obstacle, so they reward the jump or slide
          const covered = LANES.filter((l) => t.lanes[l + 1]);
          coinLane = rand.pick(covered);
        }
      }
      made.push(t);
      end = Math.max(end, x + (LEN[type] || 0));
    }
    if (coinLane === null) coinLane = rand.int(-1, 1);
    for (const t of made) { if (t.type === 'coin') t.lane = coinLane; s.things.push(t); }
    s.nextX += end + Math.max(250, 420 - m * 0.08);
  }

  function stumble(s) {
    const p = s.p;
    if (p.hurt > 0) return;
    s.stumbles++; s.calm = 0; p.hurt = 1.1; s.run.lastHitM = s.run.m;
    s.events.push('stumble');
    if (s.stumbles >= 2) caught(s);
  }
  function caught(s) {
    s.state = 'over'; s.overT = 0;
    s.events.push(s.p.fell ? 'fell' : 'caught');
  }

  // inp: { left, right, jump, slide } are one-shot presses, slideHeld is a level.
  function step(s, dt, inp) {
    const ev = s.events; ev.length = 0;
    const p = s.p, run = s.run;
    inp = inp || {};
    s.t += dt;
    if (s.state === 'over') {
      s.overT += dt; s.gap = Math.max(0, s.gap - dt * 2);
      if (p.fell) { p.vy -= GRAV * dt; p.h += p.vy * dt; }
      return ev;
    }
    s.speed = Math.min(640, 330 + Math.floor(s.t / 30) * 24 + run.m * 0.06);
    s.d += s.speed * (p.hurt > 0.6 ? 0.55 : 1) * dt;
    run.m = Math.floor(s.d / 10);
    run.cleanM = Math.max(run.cleanM, run.m - run.lastHitM);
    while (s.nextX < s.d + 4600) spawn(s);

    if (inp.left && p.lane > -1) { p.lane--; ev.push('lane'); }
    if (inp.right && p.lane < 1) { p.lane++; ev.push('lane'); }
    p.x += (p.lane - p.x) * Math.min(1, dt * 15);

    const onGround = p.h <= 0 && !p.fell;
    if (inp.jump) p.buf = 0.13; else p.buf = Math.max(0, p.buf - dt);
    if (p.buf > 0 && (onGround || p.jumps < 2)) {
      p.vy = p.jumps === 0 ? 760 : 660; p.jumps++; p.slide = 0; p.buf = 0; p.drop = false;
      if (p.h < 0) p.h = 0;
      ev.push(p.jumps === 1 ? 'jump' : 'jump2');
    }
    p.slide = Math.max(0, p.slide - dt);
    if (inp.slide) {
      if (onGround && p.vy <= 0) { p.slide = 0.7; ev.push('slide'); } else p.drop = true;
    }
    if (inp.slideHeld && onGround && p.vy <= 0) { if (p.slide <= 0) ev.push('slide'); p.slide = Math.max(p.slide, 0.25); }
    if ((inp.slideHeld || p.drop) && p.h > 0) p.vy -= 2600 * dt;          // drop faster
    const wasAir = p.h > 0;
    p.vy -= GRAV * dt; p.h += p.vy * dt;

    const lane = Math.round(p.x);
    let overPit = false;
    for (const t of s.things) {
      if (t.type === 'pit' && t.lanes[lane + 1] && s.d > t.x + 6 && s.d < t.x + LEN.pit - 6) { overPit = true; break; }
    }
    if (p.h <= 0 && !overPit && !p.fell) {
      p.h = 0; p.vy = 0; p.jumps = 0;
      if (wasAir) { ev.push('land'); if (p.drop) { p.slide = 0.55; p.drop = false; ev.push('slide'); } }
    }
    if (p.h < -30 && overPit) { p.fell = true; caught(s); return ev; }
    p.hurt = Math.max(0, p.hurt - dt);
    s.calm += dt;
    if (s.calm > 10 && s.stumbles) { s.stumbles = 0; ev.push('safe'); }
    s.gap += ((s.stumbles ? 0.35 : 1) - s.gap) * Math.min(1, dt * 2);

    const tall = p.slide > 0 ? 32 : 70;
    for (const t of s.things) {
      const dx = s.d - t.x;
      if (dx < -60) break;                       // things are stored nearest first
      if (t.type === 'coin') {
        if (!t.done && Math.abs(dx) < 26 && Math.abs(p.x - t.lane) < 0.6 && Math.abs((p.h + tall / 2) - (t.up + 16)) < 46) {
          t.done = true; run.coins++; ev.push('coin');
        }
        continue;
      }
      if (t.type === 'pit') continue;
      const inLane = LANES.some((l) => t.lanes[l + 1] && Math.abs(p.x - l) < 0.5);
      if (t.type === 'log') {
        if (inLane && dx > -14 && dx < LEN.log + 14 && p.h < 38) stumble(s);
        if (!t.done && dx > LEN.log + 14) { t.done = true; if (p.hurt <= 0 && t.lanes[lane + 1]) { run.logs++; ev.push('cleared'); } }
      } else {
        if (inLane && dx > -10 && dx < LEN.branch + 10 && p.h + tall > 44 && p.h < 150) stumble(s);
        if (!t.done && dx > LEN.branch + 10) { t.done = true; if (p.hurt <= 0 && t.lanes[lane + 1]) { run.slides++; ev.push('cleared'); } }
      }
      if (s.state === 'over') return ev;
    }
    while (s.things.length && s.things[0].x < s.d - 400) s.things.shift();
    return ev;
  }

  // A simple runner used for the title-screen demo and the headless tests.
  // `skill` 0..1: how often it bothers to react (1 = always).
  function autopilot(s, skill) {
    const inp = {};
    const p = s.p;
    if (s.state !== 'playing') return inp;
    const v = s.speed;
    let nextAt = 1e9;
    for (const t of s.things) {
      if (t.type === 'coin') continue;
      const ahead = t.x - s.d;
      if (ahead + LEN[t.type] + 24 < 0) continue;
      if (!t.lanes[p.lane + 1]) { nextAt = Math.min(nextAt, ahead); continue; }
      if (skill !== undefined && t.botSkip === undefined) t.botSkip = s.rand() > skill;
      if (t.botSkip) break;
      if (t.type === 'log') { if (ahead < v * 0.16 && p.h <= 0) inp.jump = true; }
      else if (t.type === 'pit') { if (ahead < v * 0.05 && ahead > -40 && p.h <= 0) inp.jump = true; }
      else if (ahead < v * 0.24) inp.slideHeld = true;
      nextAt = Math.min(nextAt, ahead);
      break;
    }
    // wander towards coins when the path is clear
    if (nextAt > 320 && p.h <= 0) {
      for (const t of s.things) {
        if (t.type !== 'coin' || t.done || t.x < s.d + 60) continue;
        if (t.x > s.d + 500) break;
        if (t.lane < p.lane) inp.left = true; else if (t.lane > p.lane) inp.right = true;
        break;
      }
    }
    return inp;
  }

  // What the results screen needs, and what gets saved.
  function finish(run, saved) {
    const best = Math.max(run.m, saved.best || 0);
    const bank = (saved.bank || 0) + run.coins;
    let mission = saved.mission || 0;
    let done = null, hat = false;
    if (mission < MISSIONS.length && MISSIONS[mission][1](run)) {
      done = MISSIONS[mission][0];
      mission++;
      hat = mission % 3 === 0;
    }
    return { best, bank, mission, done, hat, newBest: run.m > (saved.best || 0) && run.m > 0 };
  }

  const hatsUnlocked = (mission) => Math.min(HATS.length - 1, Math.floor((mission || 0) / 3)) + 1;

  const api = { GRAV, LEN, LANES, MISSIONS, HATS, CHUNKS, rng, create, step, autopilot, finish, hatsUnlocked };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.JG = root.JG || {}; root.JG.Rules = api; }
})(typeof window !== 'undefined' ? window : globalThis);
