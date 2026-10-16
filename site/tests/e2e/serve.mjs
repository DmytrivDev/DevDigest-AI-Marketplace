// Minimal static server for the browser tests: serves a build directory under the Pages base path,
// like GitHub Pages (directory -> index.html, unknown path -> 404.html with status 404).
// Usage: node tests/e2e/serve.mjs <dir> <port>
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const BASE = '/DevDigest-AI-Marketplace';
const dir = resolve(process.cwd(), process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 4400);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

if (!existsSync(join(dir, 'index.html'))) {
  console.error(`serve: ${dir} has no index.html; run \`npm run build\` and \`npm run build:e2e\` first`);
  process.exit(1);
}

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = null;
  if (path === BASE || path.startsWith(`${BASE}/`)) {
    const f = normalize(join(dir, path.slice(BASE.length)));
    if (f === dir || f.startsWith(dir + sep)) file = existsSync(f) && statSync(f).isDirectory() ? join(f, 'index.html') : f;
  }
  const found = file && existsSync(file);
  const out = found ? file : join(dir, '404.html');
  res.writeHead(found ? 200 : 404, { 'Content-Type': TYPES[extname(out)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(out));
}).listen(port, '127.0.0.1', () => console.log(`serve: ${dir} on http://127.0.0.1:${port}${BASE}/`));
