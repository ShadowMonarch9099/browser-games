// Puck Scuffle rule checks: node games/puck-scuffle/tools/test-rules.js
// Plays computer-vs-computer matches and checks the rules hold.
'use strict';
const path = require('path');
const R = require(path.join(__dirname, '..', 'js', 'rules.js'));
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('FAIL ' + msg); } };
const DT = 1 / 60;
for (const [a, b, tokens] of [[0, 2, true], [1, 1, true], [2, 0, false], [2, 2, true]]) {
  const m = R.create({ ai: [a, b], win: 7, tokens, seed: 7 + a * 10 + b });
  let tokenSeen = 0, hits = 0;
  for (let i = 0; i < 60 * 60 * 12 && m.state !== 'over'; i++) {
    for (const e of R.step(m, DT, [null, null])) { if (e.type === 'token') tokenSeen++; if (e.type === 'hit') hits++; }
    for (const q of m.pucks) check(q.x >= -0.2 && q.x <= 1.2 && Math.hypot(q.vx, q.vy) <= 3.41, 'puck stays sane');
    for (const [p, k] of m.mallets.entries()) check(p === 0 ? k.y >= R.LEN / 2 : k.y <= R.LEN / 2, 'mallets stay on their half');
    if (fails > 5) break;
  }
  check(m.state === 'over', `match ai ${a} v ${b} finished`);
  check(Math.max(...m.score) === 7, `winner reached 7 (${m.score})`);
  check(hits > 10, 'mallets hit the puck');
  if (tokens) check(tokenSeen > 0, 'tokens appear and get hit'); else check(tokenSeen === 0, 'tokens off means none');
  console.log(`ai ${a} v ${b}: ${m.score.join('-')}, ${hits} hits, ${tokenSeen} tokens, ${Math.round(m.time)}s`);
}
// a human mallet following a target moves toward it and stays on its half
const m = R.create({ ai: [null, 1], win: 7, seed: 3 });
for (let i = 0; i < 60; i++) R.step(m, DT, [{ target: [0.2, 0.2] }, null]);
check(m.mallets[0].y >= R.LEN / 2 + R.MR - 1e-9 && Math.abs(m.mallets[0].x - 0.2) < 0.05, 'red follows a finger but cannot cross the line');
if (fails) { console.log(fails + ' check(s) failed'); process.exit(1); }
console.log('puck-scuffle: rules hold');
