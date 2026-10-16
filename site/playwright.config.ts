import { defineConfig } from '@playwright/test';
import { browserChannel } from './tests/e2e/channel';

// Browser smoke tests (spec 14) on built output, served under the Pages base path by tests/e2e/serve.mjs.
//   real:    dist/      — the site that gets deployed (`npm run build`)
//   fixture: dist-e2e/  — the same code on the prototype fixture with artifacts and releases (`npm run build:e2e`)
const CI = !!process.env.CI;
const BASE = '/DevDigest-AI-Marketplace/';
const servers = { real: { dir: 'dist', port: 4401 }, fixture: { dir: 'dist-e2e', port: 4402 } };
const origin = (port: number) => `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // Each worker runs a full browser; more than a few starve each other on an ordinary laptop.
  workers: CI ? 2 : 3,
  timeout: 60_000,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { channel: browserChannel(), trace: 'retain-on-failure' },
  projects: [
    { name: 'real', testMatch: 'pages.spec.ts', use: { baseURL: origin(servers.real.port) + BASE } },
    { name: 'fixture', testMatch: ['pages.spec.ts', 'smoke.spec.ts'], use: { baseURL: origin(servers.fixture.port) + BASE } },
  ],
  webServer: Object.values(servers).map(({ dir, port }) => ({
    command: `node tests/e2e/serve.mjs ${dir} ${port}`,
    url: origin(port) + BASE,
    reuseExistingServer: !CI,
    stdout: 'ignore',
  })),
});
