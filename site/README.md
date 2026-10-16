# DevDigest Marketplace site

Static catalog of the marketplace, built with Astro and published on GitHub Pages at
<https://dmytrivdev.github.io/DevDigest-AI-Marketplace/>. Spec: `docs/temp/catalog-site.md`.

## Run it locally

```bash
cd site
npm ci          # first time
npm run dev     # http://localhost:4321/DevDigest-AI-Marketplace/
```

The dev server reads the **real repository** (`../.claude-plugin`, `../plugins/**`, git history)
and serves it under the same base path as GitHub Pages. It **watches `plugins/**` and
`.claude-plugin/**`**: add or edit a skill, agent, hook or `plugin.json` and the catalog is rebuilt
and the page reloads, no restart needed. New commits (changelog, "updated" dates) are only picked up
after a restart, because git history is read once per server start.

The dev server skips the `claude plugin validate` run and the GitHub API call to stay fast, so
validation shows "Not verified" there. Set `DD_VALIDATE=1` and/or `DD_GITHUB=1` to include them.

Stop it with Ctrl+C.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 4321, real repository data, live reload for `plugins/**` and `.claude-plugin/**` |
| `npm test` | Unit tests (Vitest): indexer, slugs, search golden queries, changelog on a temporary git repo, stats, formatting, storage wrapper, token contrast, markdown sanitizing |
| `npm run build` | Static build into `dist/`, then `scripts/check-dist.mjs` |
| `npm run preview` | Serves `dist/` on port 4321 under the Pages base path (run `build` first) |
| `npm run typecheck` | `tsc --noEmit` over the TypeScript sources |
| `npm run fixtures:update` | Regenerates the test fixture from `scripts/gen-test-fixtures.ts` |

Environment variables (all optional): `DD_REPO_ROOT` (repository to read, default `..`),
`DD_VALIDATE=0` (skip `claude plugin validate`), `DD_SKIP_GITHUB=1` (skip the GitHub API),
`GITHUB_TOKEN` (used for the GitHub numbers on `/stats/`, CI only).

## Where the data comes from

Real data only. Nothing on the site is sample data.

1. **Catalog** (`src/data/build-catalog.ts`): `.claude-plugin/marketplace.json`, each plugin's
   `plugin.json`, its skills, agents, commands, hooks, MCP servers and `README.md`. Rules:
   spec section 5. Broken YAML or JSON fails the build with file and line.
2. **Changelog** (`src/data/build-changelog.ts`): `git log` and `git ls-tree` snapshots, no checkout.
   A release is a `version` change in `plugin.json`, a plugin added or removed. Notes come from the
   plugin's `CHANGELOG.md` (`## [x.y.z]`) or else from commit subjects.
3. **Stats** (`src/data/build-stats.ts`): derived from the catalog and the changelog, plus public
   GitHub numbers when the API answers.
4. **Validation** (`src/data/validation.ts`): `claude plugin validate --strict` per local plugin when
   the CLI is installed and works; otherwise the badge reads "Not verified".

Build output also contains `api/catalog.json`, `api/changelog.json`, `api/releases-head.json` and
`api/stats.json`.

### Test fixtures

`tests/fixtures/prototype/` holds the design prototype's sample data (9 artifacts, 3 releases). It is
used only by unit tests, and `tests/helpers/repo.ts` turns it into a throwaway git repository with real
files. Pages never import it, and `npm run build` fails if a fixture-only name (for example
`pr-brief`) shows up in `dist/`.

To look at a populated site without touching the repository:

```bash
npx tsx tests/helpers/make-repo.ts /tmp/sample-marketplace
DD_REPO_ROOT=/tmp/sample-marketplace npm run dev
```

## Deploy

`.github/workflows/pages.yml` builds on every push to `main` and every pull request that touches
`plugins/**`, `.claude-plugin/**`, `site/**` or the workflow, and daily at 05:17 UTC. It runs
`npm ci`, `npm test` and `npm run build`, uploads `site/dist` (with `.nojekyll`), and deploys it
with `actions/deploy-pages` on `main` only. Pull requests build and test without deploying.

**One manual step for the repository owner:** Settings, Pages, Source = **GitHub Actions**.

## Layout

```
site/
  astro.config.mjs        base /DevDigest-AI-Marketplace, React island, dev watcher
  integrations/           dev-only watcher for plugins/** and .claude-plugin/**
  scripts/                check-dist.mjs (build step), gen-test-fixtures.ts
  public/                 favicon, .nojekyll
  src/data/               build-time only: indexer, changelog, stats, markdown, validation
  src/lib/                shared types, commands, formatting, urls, storage, chart geometry
  src/search/             normalization, stop words, type intent, UK synonyms, MiniSearch engine
  src/components/         Astro components; components/home/ is the React island
  src/client/site.ts      vanilla enhancements: theme, copy, onboarding, What's new counter
  src/pages/              routes and /api/*.json
  src/styles/             tokens, base, components, pages, markdown
  tests/                  Vitest tests, helpers and test-only fixtures
```

Phase 2 (not built yet): RSS `feed.xml`, Playwright smoke and axe, CSP `<meta>` with script hashes,
size budgets, sitemap and OG image, Lighthouse.
