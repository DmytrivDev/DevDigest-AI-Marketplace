# Implementation plan: catalog site, phase 1

Implements the Claude Design prototype as a real static site on GitHub Pages.

## Sources

| What | Where | Authority |
|---|---|---|
| Visual design and interactions | `docs/temp/design-source/DevDigest Marketplace.dc.html`, `CopyCommand.dc.html` | How it looks and behaves on screen |
| Behavior, data model, rules | `docs/temp/catalog-site.md` (spec) | Everything the design doesn't show |
| Design brief | `docs/temp/catalog-site.design-brief.md` | Context only |

`support.js` is the Claude Design runtime (React + Babel from unpkg). It is **not** shipped;
the site is rebuilt from the prototype's markup, styles and logic.

The prototype is a single-page React app with a "Prototype controls" panel (page, width,
theme, state switches). The panel is a design tool and is **not** shipped. Each of its pages
becomes a real route; each of its state switches becomes a real condition (spec 7.7).

## Decisions

1. **Directory.** Everything lives in `site/` at the repository root, a standalone Node
   project. Nothing in `plugins/` or `.claude-plugin/` changes. `site/` must not be referenced
   by any plugin.
2. **Stack** per spec section 3, with React instead of Preact (user's choice): Astro static
   output, a React 18 island (`@astrojs/react`) for home search and filters, MiniSearch,
   TypeScript strict, plain CSS with custom properties, Vitest.
   Small vanilla inline scripts for theme, copy buttons, onboarding banner and the What's new
   counter — no island for those.
3. **Data: real only.** The site renders only what exists in the repository
   (`../.claude-plugin`, `../plugins/**`, git history). Today that is one plugin with no
   components, and the site must look right in that state (see "Real data today" below).
   The prototype's data is kept only as a unit-test fixture in `site/tests/fixtures/`; it is
   never imported by pages, and a check fails the build if fixture-only names reach `dist/`.
4. **Base path.** `astro.config.mjs` uses `base: '/DevDigest-AI-Marketplace'`. Every
   internal link and asset goes through `import.meta.env.BASE_URL`. No absolute `/...` paths.
   Pages must work when opened from `site/dist` via `astro preview` with the same base.
5. **Theme** per spec 7.6: tokens on `:root`, dark via `prefers-color-scheme` under
   `:root:not([data-theme="light"])` and via `:root[data-theme="dark"]`; three-way switch
   System / Light / Dark saved through a try/catch storage wrapper; the inline `<head>` script
   applies it before paint. Token values are exactly the ones in the prototype's `<helmet>`
   style block (they match the spec).
6. **Styles.** Port the prototype's inline styles into `src/styles/tokens.css`, `base.css`
   and per-component CSS. Keep the exact sizes, spacing, radii, colors, icon paths and
   breakpoints. Where the prototype computes layout from its simulated width (`asidePos`,
   `tileCols`, `tap` and similar), turn that into media queries at the spec's breakpoints
   (640 / 960 / 1280 px).

## Scope of phase 1

| Area | In phase 1 | Spec |
|---|---|---|
| Routes | `/`, `/plugins/<plugin>/`, `/plugins/<plugin>/<type>/<slug>/`, `/whats-new/`, `/stats/`, `/guide/`, `404` | 7.1, 7.4 |
| Header, footer, breadcrumbs, mobile menu on `<details>` | yes | 7.1 |
| Home: hero, onboarding banner, stats strip, search, example chips, "New" block, faceted filters, active chips, sort, URL sync, results count | yes | 7.2, 10.1 |
| Card, badges, copy button with Copied / fallback states | yes (match `CopyCommand.dc.html`) | 7.3, 7.5 |
| UI states from table 7.7 | all that apply to phase 1 | 7.7 |
| Indexer `build-catalog.ts` with slugs, rules and errors | yes | 5 |
| `claude plugin validate` in CI | try it; on failure status `unknown`, build continues | 5.4 |
| Search pipeline (normalize, stop words EN+UK, type intent, UK→EN synonyms, light stemming, zero-result fallback) | yes; seed dictionaries from the prototype's `STOP`, `TYPEWORDS`, `SYN` | 6 |
| Changelog from git (releases, pending, notes from CHANGELOG.md or commits) | yes | 8.1–8.4 |
| Stats from catalog + changelog, optional GitHub block | yes | 9 |
| Guide page content | yes, from the prototype's guide page and spec 10.2 | 10.2 |
| Markdown rendering with sanitizing and Shiki | yes | 3, 12 |
| `/api/*.json` endpoints | yes | 7.1 |
| GitHub Pages workflow | yes (below) | 11 |
| Unit tests | indexer, slugs, search golden queries (on the test fixture), changelog on a temp git repo, formatting, storage wrapper, token contrast | 14 |
| **Deferred to phase 2** | RSS `feed.xml`, Playwright smoke and axe, CSP `<meta>` with script hashes, size budget script, sitemap and OG image, Lighthouse checks | 7.9, 8.5, 12, 13, 14 |

### Real data today

The real catalog has the `devdigest` plugin and zero components. Required behavior:

- Home shows the plugin card in the results and a quiet note under the count: "This
  marketplace's plugins don't have any skills, agents or hooks yet." Filters show only the
  plugin type. The stats strip reads "1 plugin · no components yet".
- Plugin page renders its README and an empty contents section with the same note.
- What's new shows the `plugin-added` event from git history (or "No releases yet" if the
  history yields none).
- Stats page renders with zeros where they are true and hides the growth chart when there
  are fewer than two points (spec 9.4).
- No page may throw or render "undefined", "NaN" or empty boxes.

## GitHub Pages

`.github/workflows/pages.yml`:

- Triggers: `push` to `main` on `plugins/**`, `.claude-plugin/**`, `site/**`, the workflow
  file; `pull_request` on the same paths; `workflow_dispatch`; daily `schedule` (05:17 UTC).
- `build` job: checkout with `fetch-depth: 0`, Node 22 with npm cache keyed on
  `site/package-lock.json`, `npm ci`, `npm test`, build, `actions/upload-pages-artifact`
  with `site/dist`. Permissions `contents: read`.
- `deploy` job: only on `main` for push, schedule and dispatch; `actions/deploy-pages`;
  permissions `pages: write`, `id-token: write`; `concurrency: pages`; environment
  `github-pages`.
- Pin actions to full commit SHAs with the version in a trailing comment. Resolve SHAs with
  `gh api repos/<owner>/<action>/git/ref/tags/<tag>` (dereference annotated tags).
- Add `.nojekyll` to the output (Astro writes `_astro/`, which Jekyll would drop).
- One manual step for the repository owner, to document in `site/README.md`: Settings →
  Pages → Source = GitHub Actions.

## Repository housekeeping

- Add a root `.gitignore` with `site/node_modules/`, `site/dist/`, `site/.astro/`.
- `site/README.md`: local dev server first (`npm run dev`, port 4321, watches `plugins/**`
  and `.claude-plugin/**`), then test, build, preview; how data is produced; how deploy works.
- In the spec (`docs/temp/catalog-site.md`) add a note to section 11 that the site renders
  only real repository data and fixtures are test-only, and
  list in section 15 which criteria are deferred to phase 2. Don't rewrite other sections.

## Done when

1. `cd site && npm ci && npm test && npm run build` succeed on a clean checkout.
2. `npm run dev` serves the site locally on port 4321 under the base path, reading the real
   repository; `npm run preview` serves the build the same way; every page and link works,
   with no console errors.
3. Layout, components and styles match the prototype at 1280 and 360 px in both themes,
   page by page, apart from the removed prototype panel (checked on real data, and with the
   test fixture rendered through the same components in unit tests).
4. The real build renders the "Real data today" behavior above.
5. No file outside `site/`, `.github/workflows/pages.yml`, `.gitignore` and the spec note
   changes.
6. Nothing is committed or pushed; the result is left in the working tree for review.
