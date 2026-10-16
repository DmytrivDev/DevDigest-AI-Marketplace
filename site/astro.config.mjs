import { resolve } from 'node:path';
import { defineConfig, passthroughImageService } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import watchRepo from './integrations/watch-repo.mjs';

// The site is served from https://dmytrivdev.github.io/DevDigest-AI-Marketplace/
export default defineConfig({
  site: 'https://dmytrivdev.github.io',
  base: '/DevDigest-AI-Marketplace',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // Astro 7 defaults to 'jsx', which drops the whitespace between inline elements
  // ("from commit31b9f3f", "SkillNew in …"); `true` keeps the Astro 6 output.
  compressHTML: true,
  // No astro:assets here (images are static files in public/), so sharp is never loaded.
  image: { service: passthroughImageService() },
  integrations: [
    react(),
    // sitemap-index.xml + sitemap-0.xml; the 404 page is noindex and stays out.
    sitemap({ filter: (page) => !/\/404\/?$/.test(page) }),
    watchRepo(process.env.DD_REPO_ROOT ?? resolve(process.cwd(), '..')),
  ],
  devToolbar: { enabled: false },
  server: { port: 4321 },
});
