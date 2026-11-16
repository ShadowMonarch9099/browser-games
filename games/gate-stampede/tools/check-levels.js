// Gate Stampede level checks: node games/gate-stampede/tools/check-levels.js
// 1. Every level still generates exactly as it always has (fingerprints were
//    taken from the original generator before the rework).
// 2. Every level can be won, and the castle rules and star ratings hold.
'use strict';
const path = require('path');
const crypto = require('crypto');
const R = require(path.join(__dirname, '..', 'js', 'rules.js'));

const FINGERPRINTS = ['6ac254ba60b6', 'fb66f34040c9', '4332786a878f', '414d032c2742', '71f98d0f3576', 'ef6832aa4123', 'c5f3179742eb', 'f4eb5c3ac72b', '7dada6ae0710', 'd3d8e54a4d38', 'f02a9f9d5a8c', '8afd2d77b1ba', '2825ecc346a5', '352f23b25b03', '64a734e1f0b6', '2a09867a8c0a', 'e7e35ec4a24c', '4bc2fd3b34e7', 'ef11a06e0ccf', '68e083c3f784', 'e10d755bec88', '48fe3b3695be', '42db90f09eb2', '2250ee573676', '8c5019cc3339', '8d42f17688a3', '0300f73e4f1a', '141d89cf3634', '00e7b709a400', '41fa36222244'];
const CASTLES = [11, 20, 35, 53, 73, 45, 15, 30, 275, 59, 220, 182, 48, 37, 111, 35, 373, 81, 350, 126, 101, 215, 112, 199, 164, 177, 435, 411, 118, 140];

let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('FAIL ' + msg); } };
const DT = 1 / 60;

check(R.LEVELS === 30, 'there should be 30 levels');
for (let lv = 1; lv <= R.LEVELS; lv++) {
  const L = R.makeLevel(lv);
  const fp = crypto.createHash('sha1').update(JSON.stringify(L)).digest('hex').slice(0, 12);
  check(fp === FINGERPRINTS[lv - 1], `level ${lv} changed (fingerprint ${fp})`);
  check(L.castle === CASTLES[lv - 1], `level ${lv} castle ${L.castle}`);
  check(JSON.stringify(R.makeLevel(lv)) === JSON.stringify(L), `level ${lv} not deterministic`);

  // the autopilot takes every good gate and dodges saws: it must win
  const s = R.create(lv);
  for (let i = 0; i < 60 * 60 && s.state === 'playing'; i++) R.step(s, DT, R.autopilot(s));
  check(s.state === 'done' && s.won, `level ${lv} not winnable by the best route (crowd ${s.n} vs ${L.castle})`);
  check(R.stars(s.n, L.castle) >= 2, `level ${lv}: the best route should earn at least 2 stars`);

  // doing nothing in the middle lane: gates take the right side, so it is
  // deterministic; just make sure the run terminates
  const idle = R.create(lv);
  for (let i = 0; i < 60 * 60 && idle.state === 'playing'; i++) R.step(idle, DT, {});
  check(idle.state === 'done', `level ${lv} idle run never ended`);
}

// gate maths
check(R.apply(10, { op: '+', v: 5 }) === 15 && R.apply(10, { op: '-', v: 15 }) === 0 && R.apply(7, { op: 'x', v: 3 }) === 21 && R.apply(7, { op: '/', v: 2 }) === 3, 'gate maths');
check(R.stars(15, 10) === 3 && R.stars(12, 10) === 2 && R.stars(10, 10) === 1, 'star thresholds');

if (fails) { console.log(fails + ' check(s) failed'); process.exit(1); }
console.log('gate-stampede: 30 levels unchanged and winnable');
