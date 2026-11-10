// Local dev server with no dependencies. games.json is rebuilt on every
// request, so a new game folder shows up on the landing page after a refresh.
// Usage: node scripts/dev.mjs [port]   (default 8765)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, buildRegistry } from './registry.mjs';

const PORT = Number(process.argv[2]) || 8765;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.txt': 'text/plain',
};

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);

  if (url === '/games.json') {
    const { games, errors } = buildRegistry();
    for (const e of errors) console.warn(`✗ ${e}`);
    res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ games, errors }));
  }

  let file = path.join(ROOT, url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!url.endsWith('/')) { res.writeHead(301, { location: url + '/' }); return res.end(); }
    file = path.join(file, 'index.html');
  }
  fs.readFile(file, (e, data) => {
    if (e) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Arcade running at http://localhost:${PORT}`));
