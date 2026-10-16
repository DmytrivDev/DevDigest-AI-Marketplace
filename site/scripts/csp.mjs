// Post-build: writes a Content-Security-Policy <meta> into every page of dist/ (spec 12).
// Inline scripts (the theme script in <head>, the island bootstrap Astro inlines) are allowed by
// their sha256 hash only. Astro's own `security.csp` is not used: it also hashes styles, which turns
// off 'unsafe-inline' for the style="" attributes the pages and Shiki output rely on.
// Usage: node scripts/csp.mjs [distDir]   (default: dist)
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dist = resolve(process.cwd(), process.argv[2] ?? 'dist');
const EXECUTABLE = new Set(['', 'module', 'text/javascript', 'application/javascript']);
const BASE_POLICY = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const pages = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith('.html')) pages.push(p);
  }
})(dist);

const problems = [];
let hashed = 0;
for (const page of pages) {
  let html = readFileSync(page, 'utf8').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
  const hashes = new Set();
  for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] ?? '';
    if (/\ssrc\s*=/i.test(attrs)) continue;
    const type = /\stype\s*=\s*"([^"]*)"/i.exec(attrs)?.[1].trim().toLowerCase() ?? '';
    if (!EXECUTABLE.has(type)) continue;
    hashes.add(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`);
  }
  if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(html)) problems.push(`${page}: inline event handler attribute (blocked by the CSP)`);
  const policy = [...BASE_POLICY, ["script-src 'self'", ...hashes].join(' ')].join('; ');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  // The policy only covers what comes after it, so it goes right after <meta charset>.
  const charset = /<meta charset="utf-8"\s*\/?>/i;
  if (!charset.test(html)) {
    problems.push(`${page}: no <meta charset="utf-8"> to anchor the CSP after`);
    continue;
  }
  html = html.replace(charset, (s) => `${s}${meta}`);
  writeFileSync(page, html);
  hashed += hashes.size;
}

if (problems.length) {
  console.error(`csp: ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`csp: ${pages.length} pages, ${hashed} inline script hashes`);
