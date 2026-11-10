// Builds the deployable site into dist/ (this is what Vercel runs).
// Usage: node scripts/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, buildRegistry } from './registry.mjs';

const { games, errors } = buildRegistry();
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error('\nBuild stopped: fix the game.json problems above (see ADDING_GAMES.md).');
  process.exit(1);
}

const DIST = path.join(ROOT, 'dist');
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST);
for (const f of ['index.html', 'play.html', 'site']) {
  fs.cpSync(path.join(ROOT, f), path.join(DIST, f), { recursive: true });
}
// Only the games that passed validation are published.
for (const g of games) {
  fs.cpSync(path.join(ROOT, 'games', g.slug), path.join(DIST, 'games', g.slug), { recursive: true });
}
fs.writeFileSync(path.join(DIST, 'games.json'), JSON.stringify({ games }, null, 2) + '\n');

console.log(`✓ Built dist/ with ${games.length} game${games.length === 1 ? '' : 's'}: ${games.map((g) => g.slug).join(', ')}`);
