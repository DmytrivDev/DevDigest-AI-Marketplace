# DevDigest Marketplace site

Static catalog of the marketplace, built with Astro and published on GitHub Pages at
<https://dmytrivdev.github.io/DevDigest-AI-Marketplace/>. Spec: `docs/SITE-SPEC.md`.

## Run it locally

Needs **Node.js 22.22.0 or newer** on the 22.x line (Astro 7 and `@astrojs/react` 7 declare
`engines.node >=22.22.0`; odd-numbered releases are not supported). On older Node `npm ci` warns with
`EBADENGINE` and the build is not supported. CI uses the version pinned as `node-version` in
`.github/workflows/pages.yml`. Check with `node -v`; with nvm, `nvm install 22.23.3` and `nvm use 22.23.3`.

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
| `npm run build` | Static build into `dist/`, then the CSP `<meta>` (`scripts/csp.mjs`), the fixture-leak check (`scripts/check-dist.mjs`) and the size budgets (`scripts/check-budgets.mjs`) |
| `npm run preview` | Serves `dist/` on port 4321 under the Pages base path (run `build` first) |
| `npm run typecheck` | `tsc --noEmit` over the TypeScript sources |
| `npm run fixtures:update` | Regenerates the test fixture from `scripts/gen-test-fixtures.ts` |
| `npm run check:links` | Every internal link and `#fragment` in `dist/` resolves (pass a directory to check another build) |
| `npm run check:budgets` | Size budgets on `dist/` again, without rebuilding |
| `npm run build:e2e` | Builds the test fixture into `dist-e2e/` for the browser tests (never deployed) |
| `npm run test:e2e` | Playwright smoke tests with axe-core on `dist/` and `dist-e2e/` |
| `npm run og:update` | Re-renders `public/og.png` from `scripts/og/og.html` |

Environment variables (all optional): `DD_REPO_ROOT` (repository to read, default `..`),
`DD_VALIDATE=0` (skip `claude plugin validate`), `DD_SKIP_GITHUB=1` (skip the GitHub API),
`GITHUB_TOKEN` (used for the GitHub numbers on `/stats/`, CI only).

## Where the data comes from

Real data only. Nothing on the site is sample data.

1. **Catalog** (`src/data/build-catalog.ts`): `.claude-plugin/marketplace.json`, each plugin's
   `plugin.json` (including `dependencies`, with the reverse "used by" edges computed here),
   its `COMPATIBILITY.md`, skills, agents, commands, hooks, MCP servers and `README.md`.
   Rules: spec section 5. Broken YAML or JSON fails the build with file and line.
2. **Changelog** (`src/data/build-changelog.ts`): `git log` and `git ls-tree` snapshots, no checkout.
   A release is a `version` change in `plugin.json`, a plugin added or removed. Notes come from the
   plugin's `CHANGELOG.md` (`## [x.y.z]`) or else from commit subjects.
3. **Stats** (`src/data/build-stats.ts`): derived from the catalog and the changelog, plus public
   GitHub numbers when the API answers.
4. **Security panel** (`src/data/security.ts`): static analysis of each local plugin's hooks, MCP
   servers, agent/skill tools, network indicators in `scripts/**` and references that leave the
   plugin directory. Stored as `details.security` on the plugin in `catalog.json` and shown in the
   "Security" section of `/plugins/<plugin>/`. It reads files only, it is not a guarantee.
5. **Validation** (`src/data/validation.ts`): `claude plugin validate --strict` per local plugin when
   the CLI is installed and works; otherwise the badge reads "Not verified".

Build output also contains `api/catalog.json`, `api/changelog.json`, `api/releases-head.json`,
`api/stats.json`, the release RSS `feed.xml` (last 50 releases), one `plugins/<plugin>/feed.xml` per local plugin, `sitemap-index.xml`, `robots.txt`
and the Open Graph image `og.png`.

**There is no separate `build:index` step.** The index (catalog, changelog and stats JSON) is
built inside `npm run build`, from the repository as it is on disk. Generated JSON and `dist/`
are never committed. To rebuild and look at it locally:

```bash
cd site
npm ci
npm run build      # indexes plugins/ and .claude-plugin/, then builds the pages
npm run preview    # serves dist/ under the GitHub Pages base path
```

The `/settings-builder/` page builds a `.claude/settings.json` snippet (`extraKnownMarketplaces` +
`enabledPlugins`, `src/lib/settings-snippet.ts`). It renders for all plugins without JavaScript;
a small script updates it live.

## Checks on the build

- **CSP.** `scripts/csp.mjs` writes a `Content-Security-Policy` `<meta>` into every page:
  `default-src 'self'`, styles `'self' 'unsafe-inline'`, and scripts `'self'` plus the `sha256` hash of
  each inline script on that page (the theme script, the island bootstrap). Astro's own
  `security.csp` is not used because it hashes styles too, which would block `style=""` attributes.
- **Size budgets** (spec 13). `scripts/check-budgets.mjs` sums the gzip size of everything a page
  loads, including chunks imported from it: home ≤ 80 KB, other pages ≤ 5 KB, `catalog.json`
  ≤ 200 KB (warning from 150 KB), `changelog.json` ≤ 100 KB, `stats.json` ≤ 30 KB.

## Browser tests

```bash
npm run build && npm run build:e2e
npm run test:e2e
```

Playwright drives the installed Chrome or Edge, so nothing is downloaded locally. Set
`PW_CHANNEL=chrome|msedge` to pick one, or `PW_CHANNEL=chromium` for Playwright's own build
(`npx playwright install chromium`); CI uses that. Two projects run:

- `real` on `dist/`: every page type in light and dark with axe-core (WCAG 2.2 A/AA), no console
  errors, no CSP violations, no horizontal scroll at 360 px.
- `fixture` on `dist-e2e/`: the same, plus search, copy, URL state, onboarding, the What's new
  counter, the catalog error state, no-JS list, RSS, sitemap, robots.txt and Open Graph tags.
  The fixture is needed because the real marketplace has no components yet.

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
`npm ci`, the typecheck, `npm test`, `npm run build` (with CSP and size budgets), the link check and
the browser tests, uploads `site/dist` (with `.nojekyll`), and deploys it
with `actions/deploy-pages` on `main` only. Pull requests build and test without deploying.

**One manual step for the repository owner:** Settings, Pages, Source = **GitHub Actions**.

## Layout

```
site/
  astro.config.mjs        base /DevDigest-AI-Marketplace, React island, dev watcher
  integrations/           dev-only watcher for plugins/** and .claude-plugin/**
  scripts/                build steps (csp, check-dist, check-budgets), check-links, build-e2e, OG image
  public/                 favicon, og.png, .nojekyll
  src/data/               build-time only: indexer, changelog, stats, markdown, validation
  src/lib/                shared types, commands, formatting, urls, storage, chart geometry
  src/search/             normalization, stop words, type intent, UK synonyms, MiniSearch engine
  src/components/         Astro components; components/home/ is the React island
  src/client/site.ts      vanilla enhancements: theme, copy, onboarding, What's new counter
  src/pages/              routes and /api/*.json
  src/styles/             tokens, base, components, pages, markdown
  tests/                  Vitest tests, helpers and test-only fixtures
  tests/e2e/              Playwright smoke tests, static server, browser channel pick
  playwright.config.ts    projects `real` (dist/) and `fixture` (dist-e2e/)
```

Not built yet: Lighthouse runs in CI (spec 13).
