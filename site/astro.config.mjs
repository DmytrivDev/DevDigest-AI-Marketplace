import { resolve } from 'node:path';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import watchRepo from './integrations/watch-repo.mjs';

// The site is served from https://dmytrivdev.github.io/DevDigest-AI-Marketplace/
export default defineConfig({
  site: 'https://dmytrivdev.github.io',
  base: '/DevDigest-AI-Marketplace',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [react(), watchRepo(process.env.DD_REPO_ROOT ?? resolve(process.cwd(), '..'))],
  devToolbar: { enabled: false },
  server: { port: 4321 },
});
