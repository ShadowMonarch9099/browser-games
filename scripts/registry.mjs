// Scans games/<slug>/game.json and builds the list the landing page reads.
// Usage:
//   node scripts/registry.mjs          write games.json (fails on any invalid game)
//   node scripts/registry.mjs --check  validate only, write nothing
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = path.join(ROOT, 'games');
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CONTROLS = ['keyboard', 'mouse', 'gamepad', 'touch'];
const ORIENTATIONS = ['any', 'landscape', 'portrait'];

function validate(slug, dir) {
  const errors = [];
  const err = (m) => errors.push(`games/${slug}: ${m}`);

  if (!SLUG.test(slug)) err('folder name must be lowercase-with-dashes (it becomes the URL)');
  if (!fs.existsSync(path.join(dir, 'index.html'))) err('missing index.html');

  const manifestPath = path.join(dir, 'game.json');
  if (!fs.existsSync(manifestPath)) return { errors: [...errors, `games/${slug}: missing game.json`] };

  let m;
  try {
    m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    return { errors: [...errors, `games/${slug}/game.json: invalid JSON (${e.message})`] };
  }

  const str = (k, required) => {
    if (m[k] === undefined) { if (required) err(`game.json needs "${k}"`); return; }
    if (typeof m[k] !== 'string' || !m[k].trim()) err(`"${k}" must be a non-empty string`);
  };
  const list = (k, allowed) => {
    if (m[k] === undefined) return;
    if (!Array.isArray(m[k]) || m[k].some((v) => typeof v !== 'string')) return err(`"${k}" must be a list of strings`);
    if (allowed) for (const v of m[k]) if (!allowed.includes(v)) err(`"${k}" has unknown value "${v}" (use ${allowed.join(', ')})`);
  };

  str('title', true);
  str('description', true);
  str('thumbnail');
  str('accent');
  str('added');
  str('players');
  list('authors');
  list('tags');
  list('controls', CONTROLS);
  if (m.orientation !== undefined && !ORIENTATIONS.includes(m.orientation)) err(`"orientation" must be one of ${ORIENTATIONS.join(', ')}`);
  if (m.accent && !/^#[0-9a-f]{6}$/i.test(m.accent)) err('"accent" must be a hex colour like #7c5cff');
  if (m.added && !/^\d{4}-\d{2}-\d{2}$/.test(m.added)) err('"added" must be a date like 2026-11-10');
  if (typeof m.players === 'string' && !/^[1-8](-[1-8])?$/.test(m.players)) err('"players" must look like "1", "2" or "1-4"');
  if (typeof m.thumbnail === 'string' && !fs.existsSync(path.join(dir, m.thumbnail))) err(`thumbnail "${m.thumbnail}" not found`);

  const game = {
    slug,
    title: m.title,
    description: m.description,
    authors: m.authors || [],
    tags: (m.tags || []).map((t) => t.toLowerCase()),
    controls: m.controls || [],
    orientation: m.orientation || 'any',
    players: m.players || '1',
    accent: m.accent || null,
    added: m.added || null,
    url: `games/${slug}/`,
    thumbnail: m.thumbnail ? `games/${slug}/${m.thumbnail}` : null,
  };
  return { game, errors };
}

// Folders starting with "_" or "." (like games/_template) are ignored.
export function buildRegistry() {
  const games = [];
  const errors = [];
  const slugs = fs.existsSync(GAMES_DIR)
    ? fs.readdirSync(GAMES_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !/^[_.]/.test(d.name))
        .map((d) => d.name)
    : [];
  for (const slug of slugs) {
    const r = validate(slug, path.join(GAMES_DIR, slug));
    errors.push(...r.errors);
    if (r.game && !r.errors.length) games.push(r.game);
  }
  // Newest first, then alphabetical.
  games.sort((a, b) => (b.added || '').localeCompare(a.added || '') || a.title.localeCompare(b.title));
  return { games, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { games, errors } = buildRegistry();
  for (const e of errors) console.error(`✗ ${e}`);
  if (errors.length) process.exit(1);
  if (!process.argv.includes('--check')) {
    fs.writeFileSync(path.join(ROOT, 'games.json'), JSON.stringify({ games }, null, 2) + '\n');
  }
  console.log(`✓ ${games.length} game${games.length === 1 ? '' : 's'}: ${games.map((g) => g.slug).join(', ')}`);
}
