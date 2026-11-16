// Courier Sprint rules. Pure simulation (no DOM, drawing or sound) so the
// browser and tools/test-rules.js (Node) run the exact same code.
//
// Distances are metres along the street. Three lanes: -1, 0, 1. The rules are
// the ones the game has always used: rows of barriers (jump), signs (roll
// under) and vans (dodge), parcels worth 10 points, and three power-ups:
// magnet (8 s, pulls parcels), scooter (absorbs one crash), drone (5 s, flies
// you over everything).
(function (root) {
  'use strict';
  const POWERS = ['magnet', 'scooter', 'drone'];

  function rng(seed) {
    let s = seed >>> 0;
    const r = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
    r.pick = (l) => l[Math.floor(r() * l.length)];
    r.shuffle = (l) => { for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
    return r;
  }

  function create(seed) {
    if (seed === undefined) seed = (Math.random() * 4294967296) >>> 0;
    return {
      seed, rand: rng(seed), state: 'playing', t: 0,
      p: { lane: 0, x: 0, y: 0, vy: 0, roll: 0, buf: 0 },
      things: [], nextZ: 30, dist: 0, speed: 16, parcels: 0,
      power: { magnet: 0, drone: 0, scooter: false },
      events: [], overT: 0, crashedBy: null,
    };
  }

  // One row of obstacles, always leaving a way through.
  function spawnRow(s, z) {
    const r = s.rand;
    const lanes = r.shuffle([-1, 0, 1]);
    const blocked = r() < Math.min(0.75, 0.3 + s.dist / 3000) ? 2 : 1;
    for (let i = 0; i < blocked; i++) {
      const k = r();
      s.things.push({ lane: lanes[i], z, type: k < 0.4 ? 'barrier' : k < 0.7 ? 'sign' : 'van' });
    }
    const free = lanes[2];
    if (r() < 0.07) s.things.push({ lane: free, z, type: r.pick(POWERS) });
    else for (let k = 0; k < 3; k++) s.things.push({ lane: free, z: z + k * 2.2, type: 'parcel' });
  }

  const score = (s) => Math.floor(s.dist) + s.parcels * 10;

  function crash(s, t) {
    if (s.power.scooter) { s.power.scooter = false; s.events.push('scooterSave'); return; }
    s.state = 'over'; s.overT = 0; s.crashedBy = t.type;
    s.events.push('crash');
  }

  // inp: one-shot { left, right, up, down }
  function step(s, dt, inp) {
    const ev = s.events; ev.length = 0;
    inp = inp || {};
    s.t += dt;
    if (s.state === 'over') { s.overT += dt; return ev; }
    const p = s.p, pw = s.power;
    if (inp.left && p.lane > -1) { p.lane--; ev.push('lane'); }
    if (inp.right && p.lane < 1) { p.lane++; ev.push('lane'); }
    // a jump pressed just before landing still counts
    if (inp.up) p.buf = 0.12; else p.buf = Math.max(0, p.buf - dt);
    if (p.buf > 0 && p.y === 0) { p.vy = 9.5; p.roll = 0; p.buf = 0; ev.push('jump'); }
    if (inp.down) { p.roll = 0.6; if (p.y > 0) p.vy = -14; ev.push('roll'); }

    s.speed = Math.min(34, 16 + s.dist / 180);
    s.dist += s.speed * dt;
    p.x += (p.lane - p.x) * Math.min(1, dt * 14);
    const wasAir = p.y > 0;
    p.vy -= 26 * dt; p.y = Math.max(0, p.y + p.vy * dt);
    if (p.y === 0) { p.vy = 0; if (wasAir) ev.push('land'); }
    p.roll = Math.max(0, p.roll - dt);
    if (pw.magnet > 0) { pw.magnet = Math.max(0, pw.magnet - dt); if (pw.magnet === 0) ev.push('powerEnd'); }
    if (pw.drone > 0) { pw.drone = Math.max(0, pw.drone - dt); if (pw.drone === 0) ev.push('powerEnd'); }
    const flying = pw.drone > 0;

    while (s.nextZ < s.dist + 70) { spawnRow(s, s.nextZ); s.nextZ += Math.max(9, 16 - s.dist / 400); }
    for (const t of s.things) {
      const dz = t.z - s.dist;
      if (t.gone || dz > 0.9 || dz < -0.9) continue;
      const same = Math.abs(p.x - t.lane) < 0.5;
      if (t.type === 'parcel') {
        if (same || pw.magnet > 0 || flying) { t.gone = true; s.parcels++; ev.push(same ? 'parcel' : 'parcelPull'); t.got = s.t; }
      } else if (POWERS.indexOf(t.type) >= 0) {
        if (same || flying) {
          t.gone = true;
          if (t.type === 'magnet') pw.magnet = 8;
          if (t.type === 'drone') pw.drone = 5;
          if (t.type === 'scooter') pw.scooter = true;
          ev.push('power:' + t.type);
        }
      } else if (same && !flying && !t.hit) {
        const safe = (t.type === 'barrier' && p.y > 0.7) || (t.type === 'sign' && p.roll > 0);
        if (safe) { if (!t.cleared) { t.cleared = true; ev.push(t.type === 'barrier' ? 'clearJump' : 'clearRoll'); } }
        else { t.hit = true; crash(s, t); if (s.state === 'over') return ev; }
      }
    }
    s.things = s.things.filter((t) => t.z > s.dist - 3 && !t.gone);
    return ev;
  }

  // Simple driver for the title-screen demo and the headless tests.
  function autopilot(s, skill) {
    const inp = {};
    if (s.state !== 'playing') return inp;
    const p = s.p;
    if (Math.abs(p.x - p.lane) > 0.2) return inp;
    const ahead = (lane, from, to) => s.things.filter((t) => t.lane === lane && !t.gone && t.z - s.dist > from && t.z - s.dist < to && ['barrier', 'sign', 'van'].indexOf(t.type) >= 0);
    const danger = (lane) => ahead(lane, -0.5, 12);
    const here = danger(p.lane);
    if (s.power.drone > 0) return inp;
    if (here.length) {
      const t = here.sort((a, b) => a.z - b.z)[0];
      const dz = t.z - s.dist;
      if (t.botSkip === undefined) t.botSkip = skill !== undefined && s.rand() > skill;
      if (t.botSkip) return inp;
      if (t.type === 'van' || dz > 6) {
        // look for a clear neighbouring lane
        for (const l of [p.lane - 1, p.lane + 1].sort(() => s.rand() - 0.5)) {
          if (l < -1 || l > 1) continue;
          if (!danger(l).some((o) => o.z - s.dist < 7)) { if (l < p.lane) inp.left = true; else inp.right = true; return inp; }
        }
      }
      if (t.type === 'barrier' && dz < s.speed * 0.22 && p.y === 0) inp.up = true;
      if (t.type === 'sign' && dz < s.speed * 0.3 && p.roll <= 0) inp.down = true;
      return inp;
    }
    // drift towards parcels
    const parcel = s.things.find((t) => t.type !== 'barrier' && t.type !== 'sign' && t.type !== 'van' && !t.gone && t.z - s.dist > 4 && t.z - s.dist < 25);
    if (parcel && parcel.lane !== p.lane) {
      const l = p.lane + Math.sign(parcel.lane - p.lane);
      if (!danger(l).length) { if (l < p.lane) inp.left = true; else inp.right = true; }
    }
    return inp;
  }

  const api = { POWERS, rng, create, step, autopilot, score };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.CS = root.CS || {}; root.CS.Rules = api; }
})(typeof window !== 'undefined' ? window : globalThis);
