// Builds the browser-test site into dist-e2e/ from the prototype fixture (a throwaway git repo with
// skills, agents, hooks and three releases), so the smoke tests can search, open artifact pages and
// read release history even while the real marketplace is nearly empty. Never deployed.
// Usage: npm run build:e2e
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPrototypeRepo } from '../tests/helpers/repo';

const tmp = mkdtempSync(join(tmpdir(), 'dd-e2e-'));
try {
  const { root } = createPrototypeRepo(join(tmp, 'repo'));
  const env: NodeJS.ProcessEnv = { ...process.env, DD_REPO_ROOT: root, DD_VALIDATE: '0', DD_SKIP_GITHUB: '1' };
  delete env.GITHUB_SHA; // CI's SHA belongs to the real repository, not the fixture

  execSync('npx astro build --outDir dist-e2e', { stdio: 'inherit', env });
  execSync('node scripts/csp.mjs dist-e2e', { stdio: 'inherit' });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
