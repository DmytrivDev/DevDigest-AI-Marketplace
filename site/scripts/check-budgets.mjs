// Size budgets (spec 13), gzip sizes of the built output. Fails the build when a budget is exceeded.
// Page JS = inline scripts + every script, island component and renderer the page loads, plus all
// chunks they import (static and dynamic), each file counted once.
// Usage: node scripts/check-budgets.mjs [distDir]   (default: dist). Writes a table to the GitHub job summary in CI.
import { appendFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const BASE = '/DevDigest-AI-Marketplace';
const KB = 1024;
const dist = resolve(process.cwd(), process.argv[2] ?? 'dist');
const BUDGETS = {
  homeJs: 80 * KB,
  pageJs: 5 * KB,
  json: {
    'api/catalog.json': { max: 200 * KB, warn: 150 * KB },
    'api/changelog.json': { max: 100 * KB },
    'api/stats.json': { max: 30 * KB },
  },
};

const gz = (buf) => gzipSync(buf, { level: 9 }).length;
const kb = (n) => `${(n / KB).toFixed(1)} KB`;
const fileOf = (href) => (href.startsWith(`${BASE}/`) ? join(dist, href.slice(BASE.length + 1)) : null);

/** All JS files reachable from a module, following `import "./x.js"`, `from "./x.js"` and `import("./x.js")`. */
function closure(file, seen) {
  if (seen.has(file) || !existsSync(file)) return;
  seen.add(file);
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["'](\.{1,2}\/[^"']+\.js)["']/g)) closure(resolve(dirname(file), m[1]), seen);
}

function pageJs(htmlFile) {
  const html = readFileSync(htmlFile, 'utf8');
  let inline = 0;
  const files = new Set();
  for (const m of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    const src = /\ssrc="([^"]+)"/.exec(m[1] ?? '')?.[1];
    if (src) {
      const f = fileOf(src);
      if (f) closure(f, files);
    } else if (!/\stype="(?!module)[^"]*"/.test(m[1] ?? '')) inline += gz(Buffer.from(m[2]));
  }
  for (const m of html.matchAll(/\s(?:component-url|renderer-url|href)="([^"]+\.js)"/g)) {
    const f = fileOf(m[1]);
    if (f) closure(f, files);
  }
  return { total: inline + [...files].reduce((n, f) => n + gz(readFileSync(f)), 0) };
}

const pages = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith('.html')) pages.push(p);
  }
})(dist);

const rows = [];
const failures = [];
const warnings = [];
const check = (what, size, max, warn) => {
  const status = size > max ? 'over' : warn && size > warn ? 'warn' : 'ok';
  rows.push({ what, size, max, status });
  if (status === 'over') failures.push(`${what}: ${kb(size)} > ${kb(max)}`);
  if (status === 'warn') warnings.push(`${what}: ${kb(size)} is above the ${kb(warn)} warning level`);
};

const home = join(dist, 'index.html');
let worstOther = { page: '', total: 0 };
for (const p of pages) {
  const { total } = pageJs(p);
  const rel = relative(dist, p).split('\\').join('/');
  if (p === home) check('Home page JS', total, BUDGETS.homeJs);
  else {
    if (total > BUDGETS.pageJs) failures.push(`${rel} JS: ${kb(total)} > ${kb(BUDGETS.pageJs)}`);
    if (total > worstOther.total) worstOther = { page: rel, total };
  }
}
check(`Other pages JS (largest: ${worstOther.page || 'none'})`, worstOther.total, BUDGETS.pageJs);
for (const [file, b] of Object.entries(BUDGETS.json)) {
  const p = join(dist, file);
  if (!existsSync(p)) {
    failures.push(`${file}: missing`);
    continue;
  }
  check(file, gz(readFileSync(p)), b.max, b.warn);
}

const table = [
  '| Asset | gzip | Budget | |',
  '|---|---:|---:|---|',
  ...rows.map((r) => `| ${r.what} | ${kb(r.size)} | ${kb(r.max)} | ${r.status === 'ok' ? 'ok' : r.status === 'warn' ? 'warning' : '**over**'} |`),
].join('\n');
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Size budgets\n\n${table}\n\n`);
warnings.forEach((w) => console.warn(`check-budgets: warning: ${w}`));
if (failures.length) {
  console.error(`check-budgets: over budget:\n  ${[...new Set(failures)].join('\n  ')}`);
  process.exit(1);
}
console.log('check-budgets: ok');
