// Checks that Tick Talk's rules (js/rules.js) and the readers' manual
// (manual.html) say the same thing: the Great Order, the switchboard words,
// the lamp colour tables, the dial directions, and the manual's worked examples.
// Usage: node games/tick-talk/tools/check-manual.js
const fs = require('fs');
const path = require('path');
const R = require('../js/rules.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'manual.html'), 'utf8');
let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.log('FAIL ' + msg); } else console.log('ok   ' + msg); };
const section = (id) => { const m = html.match(new RegExp(`<section id="${id}">([\\s\\S]*?)</section>`)); return m ? m[1] : ''; };
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// the Great Order and its spoken names
const glyphs = section('glyphs');
const big = (glyphs.match(/<p class="big">([^<]+)<\/p>/) || [])[1] || '';
ok(big.split(/\s+/).filter(Boolean).join('') === R.GLYPHS.join(''), 'the Great Order matches');
ok(R.GLYPH_NAMES.every((n) => strip(glyphs).includes(n)), 'every glyph has its spoken name in the manual');

// the switchboard table
const sw = section('switches'), rows = [...sw.matchAll(/<tr><td>([A-Z]+)<\/td><td class="big">([▲▼]+)<\/td><\/tr>/g)];
ok(rows.length === Object.keys(R.WORDS).length, 'the switchboard lists every word');
ok(rows.every(([, w, s]) => R.WORDS[w] === [...s].map((c) => (c === '▲' ? '1' : '0')).join('')), 'every switch pattern matches');

// the signal lamp table
const lamp = section('lamp'), lrows = [...lamp.matchAll(/<tr><td>(\w+)<\/td><td>(\w+)<\/td><td>(\w+)<\/td><\/tr>/g)];
ok(lrows.length === 4 && lrows.every(([, a, b, c]) => R.MAP_AM[a.toLowerCase()] === b.toLowerCase() && R.MAP_NZ[a.toLowerCase()] === c.toLowerCase()), 'the lamp colour tables match');

// the dial directions
const dial = section('dial'), dirs = [...dial.matchAll(/<td>([NSEW]{1,2})<\/td>/g)].map((m) => m[1]);
ok(dirs.join(',') === R.DIRS.join(','), 'the dial directions match');
ok(/left <b>4<\/b>, middle <b>2<\/b>, right <b>1<\/b>/.test(dial), 'the dial lamp values match');

// the manual's worked examples
const s = R.makeSerial(null, 'KE', '472');
ok(R.answers.fuses(s, ['red', 'blue', 'red', 'white', 'green']) === 2, 'fuse example: pull fuse 2');
ok(R.answers.code(s, 615) === '087', 'code example: 087');
// rule spot checks against the written rules
const noVowel = R.makeSerial(null, 'KT', '471');
ok(R.answers.fuses(noVowel, ['red', 'blue', 'red', 'white', 'green']) === 4, 'no A/E/U: pull fuse 6 - K');
ok(R.answers.glyphs(s, ['★', '◆', '✿', '♥']).join('') === '✿★♥◆', 'even last digit: glyphs right to left');
ok(R.answers.glyphs(noVowel, ['★', '◆', '✿', '♥']).join('') === '◆♥★✿', 'odd last digit: glyphs left to right');
ok(R.DIRS[R.answers.dial(s, [true, false, true])] === 'NW', 'dial: left and right lit, last digit 2: 4 + 1 + 2 = 7, NW');
// generated bombs are always solvable shapes
for (let lv = 0; lv < 3; lv++) {
  const b = R.makeBomb(lv, R.rng(lv + 1));
  ok(b.mods.length === R.MODULES[lv] && new Set(b.mods.map((m) => m.type)).size === b.mods.length, `level ${lv}: ${b.mods.length} different modules`);
}
if (fails) { console.error(`\n${fails} check(s) failed: game and manual disagree.`); process.exit(1); }
console.log('\ntick-talk: the game and the manual agree.');
