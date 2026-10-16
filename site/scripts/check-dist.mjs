// Fails the build when test-fixture data leaked into dist/ (the site must show real repository data only).
// A name from tests/fixtures/prototype counts as fixture-only when the real catalog has no artifact of that name.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const fixture = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/prototype/catalog.json'), 'utf8'));
const real = JSON.parse(readFileSync(join(dist, 'api/catalog.json'), 'utf8'));
const realNames = new Set(real.artifacts.map((a) => a.name));

// Distinctive names only: hyphenated ones such as pr-brief or dependency-checker.
const banned = [...new Set(fixture.artifacts.map((a) => a.name))].filter((n) => n.includes('-') && !realNames.has(n));
banned.push('45adf15e3b1c9d27a05f6b84c21d90e7f3a6b5c8', 'Demo data');

const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(html|json|js|css|xml|txt|svg)$/.test(name)) {
      const text = readFileSync(p, 'utf8');
      for (const b of banned) if (text.includes(b)) hits.push(`${p.slice(dist.length + 1)}: ${b}`);
    }
  }
}
walk(dist);
if (hits.length) {
  console.error(`check-dist: fixture-only data found in dist/:\n  ${hits.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-dist: ok (${banned.length} fixture-only names not found in dist/)`);
