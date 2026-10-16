// Crawls dist/: every internal href/src must resolve to a file, and #fragments must exist on the target page.
// Usage: node scripts/check-links.mjs [distDir]   (after `npm run build`; default: dist)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BASE = '/DevDigest-AI-Marketplace';
const dist = resolve(process.cwd(), process.argv[2] ?? 'dist');
const pages = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith('.html')) pages.push(p);
  }
})(dist);

const problems = [];
let checked = 0;
const idsCache = new Map();
const idsOf = (file) => {
  if (!idsCache.has(file)) idsCache.set(file, new Set([...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return idsCache.get(file);
};

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const rel = page.slice(dist.length).split('\\').join('/');
  for (const m of html.matchAll(/\s(?:href|src|action)="([^"]*)"/g)) {
    const raw = m[1].replace(/&amp;/g, '&');
    if (!raw || /^(https?:|mailto:|data:|javascript:)/i.test(raw)) continue;
    checked++;
    const [pathAndQuery, frag] = raw.split('#');
    const path = pathAndQuery.split('?')[0];
    let target;
    if (path === '') target = page;
    else if (path.startsWith(`${BASE}/`) || path === BASE) target = join(dist, path.slice(BASE.length));
    else {
      problems.push(`${rel}: "${raw}" is not under ${BASE}/`);
      continue;
    }
    if (path !== '' && existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
    if (!existsSync(target)) {
      problems.push(`${rel}: "${raw}" -> missing ${target.slice(dist.length)}`);
      continue;
    }
    if (frag && target.endsWith('.html') && !idsOf(target).has(frag)) problems.push(`${rel}: "${raw}" -> no #${frag} in target`);
  }
}
console.log(`check-links: ${pages.length} pages, ${checked} internal references`);
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('check-links: ok');
