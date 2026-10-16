# Spec: marketplace catalog on GitHub Pages

| | |
|---|---|
| Status | Ready for review |
| Date | 2026-10-16 |
| Author | DmytrivDev |
| Site URL | `https://dmytrivdev.github.io/DevDigest-AI-Marketplace/` |
| Scope | Stage 1 (MVP) in detail, stages 2–3 as a roadmap |
| Design brief | [catalog-site.design-brief.md](temp/catalog-site.design-brief.md) |

## 1. Goals

Give DevDigest marketplace users one place where they can:

- find the artifact they need (plugin, skill, agent, command, hook, MCP server) with a
  natural-language query in English or Ukrainian: "I need a skill for PR review",
  «Мені треба скіл для рев'ю PR»;
- understand what an artifact does and what a plugin is made of;
- copy the install or invoke command in one click;
- see what was added or updated since their last visit (the What's new feed, section 8);
- get a picture of the marketplace as a whole: how many plugins and artifacts, how fast it
  grows (section 9);
- learn in a few minutes how to add the marketplace and use it (section 10).

All of this works without a backend: the data is computed in CI from the repository files
and its git history.

### Non-goals

- A backend, databases, authentication, install telemetry.
- Editing marketplace content through the site. The repository files are the source of truth.
- Indexing plugins from other marketplaces.

## 2. Environment constraints

| Constraint | Consequence for the design |
|---|---|
| GitHub Pages serves static files only | All data processing happens in CI at build time; the browser only searches a prebuilt JSON |
| No rewrites / SPA fallback | Every artifact gets its own generated HTML page; search state lives in query parameters |
| The site lives under `/DevDigest-AI-Marketplace/` | All links are built from `base`; no absolute `/...` paths |
| No secrets in the client | The GitHub API and any tokens are used in CI only |
| Data updates only on deploy | The site shows `main` as of the last build; the build date is visible in the footer |
| Plugin content is in English, queries may be in Ukrainian | Query language handling is required (section 6) |

## 3. Stack

| Decision | Choice | Rationale | Rejected alternatives |
|---|---|---|---|
| Site generator | **Astro** (static mode, `output: 'static'`) | Generates a separate HTML page per artifact without an SPA fallback, which Pages requires. Static pages ship without JS. Reads repository files natively at build time. Built-in code highlighting (Shiki) | **Vite SPA**: needs hash routing, pages are not indexed. **Jekyll**: Ruby, hard to write a custom indexer, no TS. **Next.js static export**: heavier than needed |
| Interactivity | **React** (`@astrojs/react`, 18.3) as an Astro island for the search block only | User preference, and the design prototype is React too. ~45 KB gzip for the runtime, which is why the home page JS budget is 80 KB (section 13). One card component renders on the server for the static list and in the browser for results | Preact (smaller, ~4 KB), plain TS (duplicated card markup) |
| Search engine | **MiniSearch** | ~7 KB gzip, field boosts, prefix and fuzzy, custom `tokenize`/`processTerm` for Ukrainian stemming and synonyms, returns matched terms for highlighting | **Fuse.js**: linear scan, no index, no tokenizer. **Lunr**: unmaintained, weak fuzzy. **Pagefind**: indexes HTML rather than structured fields; hard to control types and facets |
| Language | **TypeScript** (strict) | Shared data model types for the indexer and the client | — |
| Styles | Plain CSS with custom properties | Minimal weight, light/dark themes via tokens | Tailwind (an extra build step for a small site) |
| Markdown | unified: `remark-parse` → `remark-gfm` → `remark-rehype` → `rehype-sanitize` → Shiki | Sanitizing is mandatory: content arrives via PRs from third-party authors (section 12) | `marked` without sanitizing |
| Tests | **Vitest** (unit) + **Playwright** (smoke) | Fast, work with TS out of the box | Jest |
| Runtime | Node.js 22 LTS | Matches the developer's local environment | — |
| Deploy | GitHub Actions → `actions/deploy-pages` | The official path, no `gh-pages` branch in the repository | Pushing to `gh-pages` |

Dependency versions are locked in `site/package-lock.json`. Actions are pinned by SHA.

## 4. Architecture

```
push to main
   │
   ▼
GitHub Actions ─────────────────────────────────────────────┐
   1. claude plugin validate --strict (marketplace and each plugin) → validation.json
   2. build-catalog: reads .claude-plugin/ and plugins/** → catalog.json
   3. build-changelog: walks git history, diffs snapshots → changelog.json (section 8)
   4. build-stats: catalog.json + changelog.json + GitHub API (optional) → stats.json (section 9)
   5. astro build: pages, /api/*.json, feed.xml, sitemap → dist/
   6. deploy-pages                                            │
   ─────────────────────────────────────────────────────────┘
   │
   ▼
Browser: index.html (static list of cards) → loads catalog.json →
         builds the MiniSearch index → searches locally
```

Steps 3–4 have access to nothing but the repository and the public GitHub API with the
workflow's `GITHUB_TOKEN`. No external services, databases or telemetry.

### 4.1 Repository layout

```
site/                               # a separate Node project, not part of any plugin
├── package.json
├── astro.config.mjs                # base: '/DevDigest-AI-Marketplace'
├── scripts/
│   ├── build-catalog.ts            # indexer (section 5)
│   ├── build-changelog.ts          # release feed (section 8)
│   ├── build-stats.ts              # stats (section 9)
│   └── check-budgets.mjs           # size budgets (section 13)
├── src/
│   ├── lib/types.ts                # data model (shared)
│   ├── lib/catalog.ts              # reads catalog.json at build time
│   ├── lib/commands.ts             # builds install/invoke commands
│   ├── lib/storage.ts              # localStorage wrapper with try/catch
│   ├── lib/format.ts               # dates, plurals (Intl.*, locale en)
│   ├── search/
│   │   ├── engine.ts               # MiniSearch wrapper
│   │   ├── normalize.ts            # normalization, tokenization, stemming
│   │   ├── intent.ts               # detects the artifact type from the query
│   │   ├── stopwords.ts            # EN + UK
│   │   └── synonyms.uk.json        # UK → EN dictionary
│   ├── components/                 # Card, Filters, SearchBox, CopyButton, Badge,
│   │                               # StateBanner, ReleaseItem, StatTile, Chart, Onboarding…
│   ├── icons/sprite.svg            # custom type and UI icons
│   ├── i18n/en.ts                  # all UI strings
│   ├── pages/
│   │   ├── index.astro
│   │   ├── plugins/[plugin]/index.astro
│   │   ├── plugins/[plugin]/[type]/[slug].astro
│   │   ├── whats-new.astro
│   │   ├── stats.astro
│   │   ├── guide.astro
│   │   ├── feed.xml.ts
│   │   ├── api/catalog.json.ts
│   │   ├── api/changelog.json.ts      # also api/releases-head.json.ts (8.4)
│   │   ├── api/stats.json.ts
│   │   └── 404.astro
│   └── styles/
│       ├── tokens.css              # colors, type, spacing (7.6)
│       └── base.css
└── tests/
    ├── fixtures/marketplace/       # minimal marketplace for indexer tests
    ├── fixtures/history/           # script that builds a temporary git repo with releases
    ├── search.golden.test.ts
    ├── changelog.test.ts
    ├── tokens.contrast.test.ts
    └── smoke.spec.ts
.github/workflows/pages.yml
```

`site/` sits outside `plugins/`, so it does not break the self-contained plugin rule.
`site/node_modules` and `site/dist` go into `.gitignore`.

## 5. Indexer (`build-catalog.ts`)

### 5.1 Sources

For every entry in `.claude-plugin/marketplace.json`:

1. If `source` is a relative path (`./plugins/<name>`), read `<source>/.claude-plugin/plugin.json`.
2. Resolve component directories: use the paths from `plugin.json` (fields `commands`,
   `agents`, `skills`, `hooks`, `mcpServers`) when set, otherwise the defaults:

| Type | Default location | What is read |
|---|---|---|
| `skill` | `skills/<name>/SKILL.md` | YAML frontmatter (`name`, `description`, other fields as `meta`), markdown body, list of files in the skill directory |
| `agent` | `agents/*.md` | frontmatter (`name`, `description`, `tools`, `model`), body |
| `command` | `commands/*.md` | frontmatter (`description`, `argument-hint`), body |
| `hook` | `hooks/hooks.json` | one entry per "event + matcher" pair: event, matcher, command and args |
| `mcp` | `.mcp.json` or `mcpServers` in `plugin.json` | one entry per server: name, `command`, `args`, `env` keys (no values) |

3. If `source` is not relative (GitHub, URL), only a `plugin` entry is created from the
   `marketplace.json` fields, marked `external: true`. Components are not indexed.
4. If the plugin directory has a `README.md`, it is rendered on the plugin page (7.4). If it
   has a `CHANGELOG.md`, it is used as the source of release notes (8.2).

### 5.1.1 Artifact name and slug

| Type | `name` |
|---|---|
| plugin | `name` from `plugin.json` |
| skill | `name` from frontmatter, otherwise the directory name |
| agent, command | `name` from frontmatter, otherwise the file name without `.md` |
| hook | `<event>-<matcher>` in kebab-case (`pre-tool-use-bash`); without a matcher — `<event>`; `*` in the matcher → `any` |
| mcp | the server key in `mcpServers` |

`slug` is `name` reduced to `[a-z0-9-]`. It is used in the URL
`/plugins/<plugin>/<type>/<slug>/`. If two hooks of one plugin produce the same slug, the
second and later ones get `-2`, `-3` in the order they appear in `hooks.json`. For other
types a slug collision within one plugin and type fails the build.

### 5.2 Data model

```ts
type ArtifactType = 'plugin' | 'skill' | 'agent' | 'command' | 'hook' | 'mcp';

interface Catalog {
  schemaVersion: 1;
  generatedAt: string;               // ISO, build time
  commit: string;                    // SHA from GITHUB_SHA
  marketplace: { name: string; description: string; repo: string };  // repo = "DmytrivDev/DevDigest-AI-Marketplace"
  artifacts: Artifact[];
}

interface Artifact {
  id: string;                        // "<plugin>:<type>:<name>", for a plugin — "<plugin>:plugin:<plugin>"
  type: ArtifactType;
  name: string;
  slug: string;                      // 5.1.1
  plugin: string;
  description: string;
  tags: string[];                    // plugin tags + keywords + frontmatter tags
  category?: string;                 // from marketplace.json
  version?: string;                  // plugin only
  searchText: string;                // body without markdown, up to 4000 characters
  sourcePath: string;                // repository path for the GitHub link
  updatedAt: string | null;          // git log -1 --format=%cI -- <path>
  invoke?: string;                   // "/devdigest:review" for skill/command
  details: SkillDetails | AgentDetails | HookDetails | McpDetails | PluginDetails | {};
  validation?: { status: 'pass' | 'fail' | 'unknown'; messages: string[] };  // plugin only
  external?: boolean;
  freshness?: 'new' | 'updated';     // from changelog.json, 14-day window from generatedAt (8.3)
}
```

Pages and the client check the `schemaVersion` of every JSON file. An unknown version is an
error state (7.7), not an attempt to render the data.

The full markdown body does **not** go into `catalog.json`. It is rendered into the
artifact's static page at build time, which keeps `catalog.json` compact.

### 5.3 Rules and errors

- Missing `description` in frontmatter — the artifact is indexed and the build report gets a
  warning.
- Invalid YAML / JSON — the build **fails** with the file path and error line.
- Duplicate `id` — the build fails.
- `name` mismatch between `marketplace.json` and `plugin.json` — a plugin validation error
  (`fail` badge); the build continues.
- The indexer is deterministic: the same input gives a byte-identical `catalog.json`
  (sorted by `id`), except `generatedAt` and `commit`.

### 5.4 Validation

CI runs `claude plugin validate . --strict` and `claude plugin validate ./plugins/<name> --strict`
for every local plugin. The exit code and output are saved to `validation.json`, and the
indexer copies them into the `validation` field. If the CLI is unavailable in CI, the status
is `unknown` and the build does not fail.

> **Checked on 2026-10-16:** `claude plugin validate` works without authentication (tested with
> an empty `CLAUDE_CONFIG_DIR`, Claude Code 2.1.301). CI installs that pinned CLI version before
> the build; if the install fails, the badges read "Not verified" and the build continues.

## 6. Search

### 6.1 Indexed fields and boosts

| Field | Boost |
|---|---|
| `name` | 4 |
| `tags` | 3 |
| `description` | 2 |
| `plugin` | 1.5 |
| `searchText` | 1 |

Settings: `prefix: true`, `fuzzy: 0.2` for terms of 4+ characters, `combineWith: 'OR'`.
The index is built in the browser from `catalog.json` on page load. Above 2000 artifacts,
switch to a serialized index built in CI (`MiniSearch.loadJSON`).

### 6.2 Query processing

The pipeline is the same for documents and queries, except steps 4–5 (query only):

1. **Normalization:** lowercase, Unicode NFKC, apostrophes `'` `’` `ʼ` → `'`, `ё` → `е`.
2. **Tokenization:** on word boundaries (Unicode letters/digits); `pull-request` yields
   `pull-request`, `pull` and `request`.
3. **Stop words** EN + UK: "i", "need", "a", "for", "the", "some", «мені», «треба»,
   «потрібен», «для», «який», «щоб»…
4. **Type detection** (`intent.ts`). Words like "skill/skills/скіл/скіла/навичка" → `skill`;
   "agent/агент" → `agent`; "command/команда" → `command`; "hook/хук" → `hook`;
   "mcp/server/сервер" → `mcp`; "plugin/плагін" → `plugin`. The matched word is removed from
   the terms and set as a type filter, shown as a chip "Type: skill (from query) ×" that can
   be removed.
5. **Synonym expansion** (`synonyms.uk.json`): each Ukrainian term is expanded with its
   English equivalents at boost 0.7. For example: `рев'ю`, `ревю`, `огляд` → `review`;
   `тест` → `test`; `безпека` → `security`; `коміт` → `commit`; `пр`, `пулреквест` →
   `pull request`, `pr`.
6. **Light stemming:** for Cyrillic, common endings are stripped (`-ами`, `-ів`, `-ом`,
   `-ою`, `-ах`, `-и`, `-а`, `-у`…) as long as the stem keeps at least 3 characters. Latin
   terms are not stemmed; prefix search covers them.

An empty query shows all artifacts sorted by `updatedAt`.

### 6.3 Zero results

1. If the type filter was set automatically and gave 0 results, rerun without it and show
   "No skills found — showing other artifacts for your query".
2. If there are still 0 results, show popular tags and a "Suggest an artifact" link (a new
   GitHub issue with the query text in its body).

### 6.4 Synonym dictionary

`synonyms.uk.json` is a flat object `{ "term": ["en1", "en2"] }`. Keys are stored already
normalized and stemmed. A test checks the format and that there are no duplicates. Start with
50–100 terms covering code review, git, tests, security and documentation.

## 7. Interface

The UI language is English. All strings live in `src/i18n/en.ts`, so a Ukrainian locale can
be added in stage 3. Search accepts queries in English and Ukrainian (section 6).

### 7.1 Site map and navigation

| Route | Page | JS |
|---|---|---|
| `/` | Catalog with search | yes (search island) |
| `/plugins/<plugin>/` | Plugin | copy only |
| `/plugins/<plugin>/<type>/<slug>/` | Artifact | copy only |
| `/whats-new/` | What's new (section 8) | unseen indicator only |
| `/stats/` | Stats (section 9) | no |
| `/guide/` | Guide (section 10) | copy only |
| `/feed.xml` | Release RSS (8.5) | — |
| `/api/catalog.json`, `/api/changelog.json`, `/api/releases-head.json`, `/api/stats.json` | Data | — |
| `/404.html` | Not found | copy only |

The theme switch on every page is a small inline script (7.6) and does not count as an island.

**Header** (all pages): marketplace name (links to `/`), navigation
"Catalog · What's new · Stats · Guide", GitHub link, theme switch. Next to "What's new" —
a counter of unseen releases (8.4). The current section is marked `aria-current="page"`.
Below 640 px the navigation collapses into a "Menu" button built on `<details>`, so it works
without JS.

**Footer:** "Built Oct 16, 2026 from commit <7-character SHA>" (links to the commit), links to
the repository, RSS and `catalog.json`, and the note "This site collects no visitor data."

**Breadcrumbs** on plugin and artifact pages: "Catalog / devdigest / Skills / review".

### 7.2 Home page `/`

Blocks from top to bottom:

1. **Hero:** marketplace name, description, a "Add the marketplace" block with the command
   `/plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace` and a copy button.
2. **Onboarding banner** for first-time visitors (10.1).
3. **Stats strip** (9.3).
4. **Search.** A field with the placeholder "Describe what you need, e.g. a skill for
   reviewing PRs". The `/` key focuses the field (unless focus is in another input), `Esc`
   clears it. Debounce 150 ms. A `/` key hint on the right of the field hides while typing.
   While the query is empty, 3–5 example query chips show under the field ("skill for PR
   review", "security agent", "pre-commit hooks"). Clicking one fills in the query.
5. **"New" block** — the last 3 releases (8.3), only when the query and filters are empty.
6. **Filters:** type, plugin, tags. Multi-select within a group (OR), AND across groups.
   Counts are faceted: each option shows the number of results given the query and the other
   groups. Options with zero stay visible but disabled, so the list doesn't jump.
   Tags: top 10 by frequency, the rest under "N more". Active filters are repeated as chips
   above the results, next to a "Clear all" button.
7. **Results:** count, sort, card grid.
   - The count uses proper plurals (`Intl.PluralRules('en')`): "1 artifact found",
     "12 artifacts found". It is announced via `aria-live="polite"`.
   - Sort: relevance (default for a non-empty query), updated (default for an empty one),
     name. Artifacts with `updatedAt: null` go last when sorting by "updated".

Search state is synced to the URL: `?q=…&type=skill,agent&plugin=devdigest&tag=…&sort=…`
via `history.replaceState`. Opening such a URL restores the same state. Unknown parameter
values are silently ignored.

Without JS the page shows a static list of all artifacts (progressive enhancement, 7.7).

### 7.3 Artifact card

| Element | Content |
|---|---|
| Type badge | color and icon per type (7.6), tooltip explaining the type (10.3) |
| Freshness badge | "New" or "Updated" when `freshness` is set (8.3) |
| "External" badge | for `external: true` |
| Name | link to the artifact page; matches highlighted |
| Description | up to 3 lines (`line-clamp`), matches highlighted; full text in `title` |
| Meta | plugin, up to 4 tags, updated date |
| Action | copy button for the primary command (table 7.5) |

- Highlighting splits text into nodes, never `innerHTML`. Only exact and prefix matches are
  highlighted. Fuzzy matches are not: the highlighted fragment would not match the query and
  would look like a bug.
- The date renders at build time as `<time datetime="…">Oct 14, 2026</time>`. The search
  island replaces the text with a relative one ("3 days ago", `Intl.RelativeTimeFormat('en')`),
  so static pages don't go stale between builds.
- The whole card is clickable through a pseudo-element on the name link, but the copy button
  and tags stay separate targets. Only links and buttons take focus, not the card itself.

### 7.4 Pages

- **`/plugins/<plugin>/`** — description, version, validation badge, install commands,
  contents (counts by type), the plugin's rendered `README.md` (if any), cards for all its
  artifacts grouped by type, a "Version history" block (last 5 releases, 8.3), GitHub link.
- **`/plugins/<plugin>/<type>/<slug>/`** — title, type badge, plugin, commands, rendered
  markdown body, frontmatter fields table; for a skill — the list of files in its directory;
  for a hook — event/matcher/command; for MCP — command, args and environment variable names;
  an "Open on GitHub" link (`sourcePath` at the build commit), and a "More from this plugin"
  block (up to 4 cards).
- **404** — a message, a search field (submitting goes to `/?q=…`), a link to `/guide/`.

Long code blocks in markdown scroll horizontally inside the block, not the page. Frontmatter
tables turn into a "key — value" list on narrow screens.

### 7.5 Commands by type

| Type | Primary command (card button) | Also on the page |
|---|---|---|
| plugin | `/plugin install <plugin>@devdigest-marketplace` | `marketplace add`, shell variant (`claude plugin …`) |
| skill | `/<plugin>:<name>` | plugin install commands |
| command | `/<plugin>:<name>` with `argument-hint` if present | plugin install commands |
| agent | `/plugin install <plugin>@devdigest-marketplace` | a note that Claude invokes the agent, or it can be mentioned in a prompt |
| hook, mcp | `/plugin install <plugin>@devdigest-marketplace` | a note that the component activates automatically after install |

The marketplace name (`devdigest-marketplace`) and repository come from `catalog.json` and
are not hardcoded. Copying uses `navigator.clipboard.writeText` with a "Copied"
confirmation and a select-the-text fallback (7.7).

### 7.6 Visual system

**Principles.** A reference-style interface in the spirit of documentation: dense, calm, no
decorative gradients, illustrations or shadows. Color carries meaning: artifact type, state,
links. Color is never the only carrier of information: every badge has text.

**Color tokens** (`styles/tokens.css`). Values are set on `:root`; the dark theme comes from
`@media (prefers-color-scheme: dark)` under `:root:not([data-theme="light"])` and separately
from `:root[data-theme="dark"]`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#ffffff` | `#0f1216` | page background |
| `--surface` | `#f6f7f9` | `#171b21` | cards, search field, code blocks |
| `--surface-hover` | `#eef0f3` | `#1f242c` | hover on a card or option |
| `--border` | `#d9dde3` | `#2b313a` | borders, dividers |
| `--text` | `#1b1f24` | `#e6e8eb` | body text |
| `--text-muted` | `#57606a` | `#9aa4b0` | meta, captions |
| `--accent` | `#0b5cad` | `#6cb2ff` | links, focus, primary button |
| `--highlight` | `#fff3b0` | `#5c4a00` | search match highlight (text stays `--text`) |
| `--success` | `#1a7f37` | `#4ac26b` | validation `pass`, "Copied" |
| `--warning` | `#9a6700` | `#d29922` | warnings, "Updated" |
| `--danger` | `#b42318` | `#ff7b72` | validation `fail`, errors |

**Artifact types.** Badge text is the type color, the background is the same color at 12%
(`color-mix(in srgb, var(--type-skill) 12%, var(--bg))`), with a 16 px icon from a custom SVG
sprite (no icon fonts or external icon sets).

| Type | Light | Dark | Icon | Label |
|---|---|---|---|---|
| plugin | `#6639ba` | `#b392f0` | box | Plugin |
| skill | `#0b6e4f` | `#56d4a4` | lightning bolt | Skill |
| agent | `#8a4b00` | `#f0b72f` | person silhouette | Agent |
| command | `#0a6877` | `#5cc8d6` | `/` in a frame | Command |
| hook | `#a40e26` | `#ff8182` | hook | Hook |
| mcp | `#3d4b5c` | `#a8b3c1` | plug | MCP |

Every text-on-background pair (including badges over `--bg` and `--surface`) has a contrast
of at least 4.5:1 in both themes. `tokens.contrast.test.ts` checks this, so a palette change
cannot pass CI unchecked.

**Typography.** System fonts only, no web fonts (weight and CSP):
`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; monospace —
`ui-monospace, "Cascadia Code", "JetBrains Mono", Consolas, monospace`.
Scale: 13 / 14 / 16 (base) / 20 / 24 / 32 px. Line height 1.5 for text, 1.25 for headings.
Artifact names and commands are set in monospace.

**Space and shape.** 4 px spacing step (4, 8, 12, 16, 24, 32, 48). Radii: 6 px (buttons,
badges, chips), 10 px (cards, banners). Borders `1px solid var(--border)`.

**Grid.** Max content width 1200 px, side gutters 16 px (below 640 px) and 24 px.

| Width | Card columns | Filters |
|---|---|---|
| < 640 px | 1 | collapsed "Filters (N)" panel above results (`<details>`) |
| 640–959 px | 2 | same |
| 960–1279 px | 2 | 240 px left sidebar, sticky |
| ≥ 1280 px | 3 | 240 px left sidebar, sticky |

**Copy button.** The command in monospace inside a `--surface` frame plus an icon. On
success the icon becomes a check mark and the label reads "Copied" for 2 s, announced via
`aria-live="polite"`. A long command is truncated with "…", the full one goes into `title`.

**Focus.** `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }` on every
interactive element. Focus looks the same across all components.

**Motion.** Transitions up to 150 ms, for color and opacity only. Under
`prefers-reduced-motion: reduce` all transitions and the spinner animation are off.

**Theme.** A three-way switch: "System", "Light", "Dark". The choice is saved in
`localStorage` (via `lib/storage.ts`). The theme script sits in `<head>` before render to
avoid a flash of the light theme (CSP — section 12).

**Wireframes.** Width ≥ 1280 px:

```
┌────────────────────────────────────────────────────────────────────────┐
│ DevDigest Marketplace   Catalog  What's new ●2  Stats  Guide   GH   ◐  │
├────────────────────────────────────────────────────────────────────────┤
│ Claude Code plugins from DevDigest                                     │
│ [ /plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace     ⧉ ]  │
│ ┌ Welcome ─────────────────────────────────────────────────────── × ┐  │
│ │ ① Add the marketplace  ② Install a plugin  ③ Find and invoke     │  │
│ └───────────────────────────────────────── [Got it] [Learn more →] ┘  │
│ 1 plugin · 3 skills · 3 agents · 1 hook · last release 2 days ago →    │
├────────────────────────────────────────────────────────────────────────┤
│ [ ⌕ Describe what you need, e.g. a skill for reviewing PRs        / ]  │
│ Try: (skill for PR review) (security agent) (pre-commit hooks)         │
├──────────────┬─────────────────────────────────────────────────────────┤
│ Type         │ 9 artifacts found                     Sort [Updated ▾]  │
│ ☐ Skill    3 │ (Type: skill ×)  Clear all                              │
│ ☐ Agent    3 │ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐   │
│ ☐ Hook     1 │ │[Skill] [New]  │ │[Agent]        │ │[Hook]         │   │
│ Plugin       │ │review         │ │security-rev…  │ │pre-tool-use-… │   │
│ ☐ devdigest  │ │Reviews a PR … │ │Audits diff …  │ │Blocks commit… │   │
│ Tags         │ │devdigest · pr │ │devdigest      │ │devdigest      │   │
│ ☐ review   4 │ │[/devdigest:re…⧉]│[/plugin inst…⧉]│ │[/plugin inst…⧉]│  │
│ 4 more ▾     │ └───────────────┘ └───────────────┘ └───────────────┘   │
└──────────────┴─────────────────────────────────────────────────────────┘
```

Width 360 px — filters collapsed, cards in one column:

```
┌──────────────────────────────┐
│ DevDigest Marketplace  ◐ Menu│
│ [ /plugin marketplace a… ⧉ ] │
│ [ ⌕ Describe what you ne… ]  │
│ ▸ Filters (1)    [Updated ▾] │
│ 3 artifacts found            │
│ ┌──────────────────────────┐ │
│ │[Skill] [New]             │ │
│ │review                    │ │
│ │Reviews a pull request…   │ │
│ │devdigest · 2 days ago    │ │
│ │[ /devdigest:review    ⧉ ]│ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

Artifact page:

```
Catalog / devdigest / Skills / review
[Skill]  review                                       Open on GitHub ↗
Plugin devdigest · updated Oct 14, 2026
[ /devdigest:review                                        ⧉ ]
▸ Install the plugin
──────────────────────────────────────────────────────────────
<rendered SKILL.md>
──────────────────────────────────────────────────────────────
Frontmatter │ Skill files │ More from this plugin
```

### 7.7 UI states

| State | When | What the user sees |
|---|---|---|
| No JS | JS disabled or failed to load | A static list of all cards (sorted by "updated"). The search field, example chips, onboarding banner and sort are hidden (`html:not(.js)`). `<noscript>`: "Search needs JavaScript. The full list is below." |
| Preparing search | `catalog.json` is loading or the index is building | The field is usable right away. If the user has typed a query, "Preparing search…" with a spinner appears under the field after 300 ms (nothing before that, to avoid flicker). The query runs as soon as the index is ready. The static list stays in place. |
| Search ready | | Normal operation. |
| No results | 6.3 | Message, popular tags, "Suggest an artifact"; with active filters — a "Clear filters" button. |
| Catalog error | `fetch` failed, 10 s timeout, invalid JSON, unknown `schemaVersion` | A `role="alert"` banner under the field: "Couldn't load search. The list below is current as of the last build." A "Try again" button. Type, plugin and tag filters keep working over the static cards via `data-type`, `data-plugin`, `data-tags`. Only text search is unavailable. |
| Offline | Catalog error while `navigator.onLine === false` | The same banner reading "You're offline." |
| Page is stale | `commit` in `catalog.json` differs from the page's `<meta name="dd-commit">` | An unobtrusive "Catalog updated" notice with a "Reload page" button. Search works on the fresh catalog. |
| Empty catalog | 0 artifacts | "No artifacts in this marketplace yet" and a link to `/guide/#authors`. Search and filters are hidden. |
| External plugin | `external: true` | An "External" badge. Instead of contents — "Contents unavailable: this plugin is hosted outside this repository" and a link to the source. |
| Validation `unknown` | 5.4 | A grey "Not verified" badge with an explanation in a tooltip. |
| Validation `fail` | 5.4 | A red badge and an expanded block with the error text on the plugin page. The card shows the badge only. |
| Copy failed | Clipboard API unavailable or permission denied | The command text is selected and a hint says "Press Ctrl+C" ("⌘C" on macOS). |
| Storage unavailable | `localStorage` throws (private mode, blocked site data) | Nothing breaks. The theme follows the system, the onboarding banner shows again on the next visit, the What's new counter is hidden. |
| No GitHub data | The API was unavailable at build time | The GitHub block on `/stats/` is not rendered (9.2). |
| No releases | `releases` is empty | `/whats-new/` shows "No releases yet". The "New" block on the home page is not rendered. |

No state replaces the list with an empty screen: build-time data always stays visible.

### 7.8 Accessibility

- WCAG 2.2 AA: contrast (7.6), focus states, full keyboard navigation.
- A "Skip to results" link as the first element on the page.
- `lang="en"` on `<html>`.
- Filter groups are `<fieldset>` with `<legend>`; toggle chips are `<button aria-pressed>`.
- Results are a `<ul>`, each card is an `<li>` with an `<h3>`. Heading levels never skip on
  any page.
- The result count and copy confirmations use `aria-live="polite"`, error banners use
  `role="alert"`.
- Stats charts have `<title>` and `<desc>` and a table alternative (9.4).
- Automated axe-core checks in Playwright on every page type in both themes (section 14).

### 7.9 Metadata and SEO

- `<title>`: "review — devdigest plugin skill · DevDigest Marketplace"; for sections —
  "What's new · DevDigest Marketplace" and so on.
- `<meta name="description">` from the artifact description (up to 160 characters), `canonical`.
- Open Graph and Twitter Card with one static OG image (`public/og.png`).
- `sitemap-index.xml` (`@astrojs/sitemap`), `robots.txt`.
- `<link rel="alternate" type="application/rss+xml" href="…/feed.xml">` in `<head>`.
- `<meta name="dd-commit" content="<SHA>">` for the "Page is stale" state (7.7).

## 8. What's new (release feed)

### 8.1 What counts as a release

Users don't receive new commits until the author bumps `version` in `plugin.json` (see the
root README). So the feed is built around version changes, not commits:

| Event (`kind`) | Condition |
|---|---|
| `plugin-added` | The plugin first appears in `marketplace.json` |
| `release` | The `version` field in `plugin.json` changed |
| `plugin-removed` | The plugin disappears from `marketplace.json` |

Each release carries the plugin's artifact changes since the previous release: added,
updated (the artifact's main file changed) and removed. Changes on `main` that haven't made
it into a new version go into `pending` (8.3) and are not a release.

### 8.2 Building (`build-changelog.ts`)

1. `git log --first-parent --format='%H%x09%cI%x09%s' -- plugins .claude-plugin`
   on `main`, at most 300 commits (configurable limit).
2. A lightweight snapshot per commit, without a checkout:
   `git ls-tree -r <sha> -- plugins .claude-plugin` (paths and blob SHAs) and
   `git show <sha>:<path>` for `marketplace.json` and `plugin.json`. Components are resolved
   with the same location rules as the indexer (5.1). Frontmatter is read only for added
   artifacts.
3. Adjacent snapshots are diffed. An artifact is "updated" when the blob SHA of its main file
   (`SKILL.md`, `<agent>.md`, `hooks.json`…) changed. A rename is a removal plus an addition.
4. The oldest snapshot in the window is the baseline. If history was cut by the limit, the
   baseline's contents are not reported as "added", and the data gets `truncated: true`.
5. **Release notes.** If the plugin directory has a `CHANGELOG.md` in Keep a Changelog format
   with a `## [<version>]` or `## <version>` section, its body is used (markdown through the
   same sanitizing pipeline, section 12). Otherwise — the subjects of commits that changed the
   plugin directory between the two releases, excluding merge commits, up to 10 plus "and N
   more".
6. An invalid `plugin.json` in a historical commit doesn't break the build: the snapshot is
   skipped and the report gets a warning. Only the current state breaks the build (5.3).
7. The output is deterministic for the same git history.

```ts
interface Changelog {
  schemaVersion: 1;
  generatedAt: string;
  commit: string;
  historyStart: string;              // date of the oldest commit considered
  truncated: boolean;
  releases: Release[];               // newest first
  pending: { plugin: string; since: string; changes: Changes }[];
}

interface Release {
  id: string;                        // "devdigest@0.3.0", "devdigest@added", "devdigest@removed"
  kind: 'plugin-added' | 'release' | 'plugin-removed';
  plugin: string;
  version: string | null;
  previousVersion: string | null;
  date: string;                      // %cI of the commit
  commit: string;
  changes: Changes;
  notes: { source: 'changelog'; html: string } | { source: 'commits'; items: string[]; more: number } | null;
}

interface Changes {
  added: ArtifactRef[];
  updated: ArtifactRef[];
  removed: ArtifactRef[];
}

interface ArtifactRef { id: string; type: ArtifactType; name: string; exists: boolean }  // exists = present in the current catalog
```

### 8.3 Display

**The `/whats-new/` page.** Releases grouped by month ("October 2026"), filtered by plugin
(chips, state in `?plugin=`). A release item:

```
devdigest 0.3.0                           Oct 14, 2026 · commit a1b2c3d
+ Added (2):     [Skill] review   [Skill] pr-brief
~ Updated (1):   [Agent] security-reviewer
− Removed (1):   [Command] summarize
▸ Release notes
```

- Added and updated artifacts link to their pages; removed ones are plain text.
- Notes are collapsed in `<details>`; for `source: 'commits'` they are a list of commit
  subjects as plain text (commit subjects are third-party text: no markdown or HTML).
- If a release changed no artifacts, it shows "No changes to contents" plus the notes.
- Each release has an `#<id>` anchor that RSS and the "New" block link to.
- If `truncated`, the bottom reads "History shown from <historyStart>".
- An "Unreleased" block, collapsed, above the feed when `pending` is not empty:
  "Changes in the repository not yet released in a new version: …". It is for authors and
  people following development.

**The "New" block on the home page** — the last 3 releases in a compact form (one line per
release: plugin, version, "+2 ~1", date) and a "All changes →" link.

**Plugin page** — a "Version history" block with the plugin's last 5 releases.

**Freshness badges.** The indexer takes from `changelog.json` the date of the latest release
in which the artifact was added or updated. If it is no older than 14 days from `generatedAt`,
it sets `freshness: 'new'` or `'updated'` (`new` wins). The daily build (section 11) keeps the
badges from going stale.

### 8.4 Unseen indicator

- `localStorage['dd:lastSeenRelease']` stores the date of the newest release the user has seen.
- First visit: the key is written without showing the counter (otherwise every release would
  count as unseen).
- After that the header shows the number of releases newer than the stored date: "●2", above
  9 — "9+". `aria-label="What's new, 2 unseen releases"`.
- Opening `/whats-new/` updates the key. Releases newer than the previous value get a
  "New for you" label for that visit.
- The counter reads a compact `/api/releases-head.json` (id and date of the last 10
  releases), so pages don't load the full changelog.

### 8.5 RSS

`/feed.xml` — RSS 2.0 via `@astrojs/rss`, the last 50 releases. Item title — "devdigest 0.3.0",
description — the list of changes as plain text, `link` — `/whats-new/#<id>`, `guid` — the
release `id` (`isPermaLink="false"`), `pubDate` — the commit date.

## 9. Stats

### 9.1 What we show and what we don't

All stats are computed at build time from the repository files, git history and the public
GitHub API. **Not available without a backend**, and therefore deliberately absent: install
counts, active users, invocation frequency, ratings. The page says so directly in a
"What's not here and why" block.

### 9.2 Data (`build-stats.ts` → `stats.json`)

```ts
interface Stats {
  schemaVersion: 1;
  generatedAt: string;
  commit: string;
  totals: {
    plugins: number;
    externalPlugins: number;
    artifacts: number;                     // excluding plugin entries
    byType: Record<ArtifactType, number>;
    tags: number;
    categories: number;
    authors: number;                       // unique author.name from plugin.json
  };
  freshness: {
    lastReleaseAt: string | null;
    releases30d: number;
    releases90d: number;
    artifactsUpdated30d: number;
  };
  quality: {
    validation: { pass: number; fail: number; unknown: number };
    withDescription: number;               // artifacts with a non-empty description
    pluginsWithReadme: number;
  };
  growth: { date: string; byType: Record<ArtifactType, number> }[];  // one point per release
  topTags: { tag: string; count: number }[];                         // up to 15
  plugins: { name: string; version: string | null; components: number;
             byType: Partial<Record<ArtifactType, number>>; updatedAt: string | null }[];
  github?: { stars: number; forks: number; openIssues: number; contributors: number; fetchedAt: string };
}
```

- `growth` comes from the changelog snapshots (8.2), so there is no second pass over history.
- `github` — `GET /repos/{repo}` and `GET /repos/{repo}/contributors?per_page=1` (the count
  comes from the `Link` header) with `GITHUB_TOKEN`. Any error or a 10 s timeout leaves the
  field out; the build does not fail.

### 9.3 Stats strip on the home page

One line under the hero: "1 plugin · 3 skills · 3 agents · 1 command · 1 hook · 1 MCP server ·
last release 2 days ago", plus a "Stats →" link. Types with zero are omitted. Numbers use
proper plurals (7.2). Each number links to the catalog with the matching filter (`/?type=skill`).

### 9.4 The `/stats/` page

A page with no JS: everything, charts included, is rendered at build time.

1. **Summary tiles:** plugins, artifacts, then one tile per type (type color and icon). A tile
   is a 32 px number with a label. Grid: 2 columns below 640 px, 4 below 960 px, 7 above.
2. **Freshness:** last release, releases in 30 and 90 days, artifacts updated in 30 days.
3. **Growth:** a stepped line chart of artifact counts over time, one line per type in the type
   colors, direct labels at the line ends. A static SVG with a `viewBox` that scales to width.
   Below the chart — a `<details>` "Show as table" with the same data. With fewer than two
   points the chart is not drawn; only the table remains.
4. **Contents by type:** horizontal bars sorted descending, with values on the bars.
5. **Plugins:** a "name · version · components · by type · updated" table sorted by component
   count. Cards on narrow screens.
6. **Tags:** top 15 as chips with counts, each linking to `/?tag=…`.
7. **Quality:** validation pass / fail / unknown, share of artifacts with a description,
   plugins with a README.
8. **GitHub:** stars, forks, open issues, contributors, "as of <fetchedAt>". Not rendered when
   `github` is absent.
9. **What's not here and why** (9.1).

Charts use the same tokens as the interface and have `role="img"`, `<title>` and a `<desc>`
with a one-line takeaway ("Artifacts grew from 4 to 9 in one month").

## 10. Onboarding

### 10.1 First-visit banner

On the home page under the hero, only with JS and only while
`localStorage['dd:onboarding']` is not `dismissed`. Three steps (in a row at ≥ 960 px,
stacked below):

| Step | Title | Content |
|---|---|---|
| 1 | Add the marketplace | `/plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace` ⧉ |
| 2 | Install a plugin | `/plugin install devdigest@devdigest-marketplace` ⧉; with several plugins — "Pick a plugin in the catalog below" |
| 3 | Find and invoke | "Describe your task in the search and copy the command from a card" + a "Try a search" button |

- "Try a search" fills in an example query, focuses the field and scrolls to the results.
- "Got it" and "×" write `dismissed`. "Learn more →" goes to `/guide/`.
- Commands are built from `catalog.json` (`lib/commands.ts`), same as on the cards.
- The banner doesn't shift content after render: the inline theme script also reads
  `dd:onboarding` and sets a class on `<html>` that reserves the space (no CLS).
- The guide is always reachable through "Guide" in the header.

### 10.2 The `/guide/` page

A single page with anchors and a sticky table of contents on the left at ≥ 960 px.

| Anchor | Section | Content |
|---|---|---|
| `#what` | What a marketplace is | A marketplace is a catalog of plugins; a plugin is a bundle of skills, agents, commands, hooks and MCP servers |
| `#requirements` | What you need | Claude Code installed, a link to the official docs |
| `#connect` | Adding the marketplace | In-session and shell commands (from the root README) with copy buttons |
| `#install` | Installing a plugin | `/plugin install …`, where to see installed plugins |
| `#types` | Artifact types | Table: badge · what it is · how to use it (data from table 7.5) |
| `#search` | How to search | Natural language in English or Ukrainian, the automatic type filter and how to remove it, filters, the `/` key, sharing a link with `?q=` |
| `#update` | Updates | Auto-update is off by default for third-party marketplaces; how to turn it on in `/plugin` → Marketplaces; the What's new feed and RSS |
| `#remove` | Disabling and removing | How to disable or remove a plugin and the marketplace |
| `#troubleshooting` | Common problems | A "symptom → what to do" table |
| `#authors` | For authors | How to add an artifact through a PR to `plugins/`, the rules from the root README, the `claude plugin validate` commands, when changes appear on the site, how to write `CHANGELOG.md` for release notes |

Initial common problems:

| Symptom | What to do |
|---|---|
| The marketplace won't add | Check the repository name `DmytrivDev/DevDigest-AI-Marketplace` and GitHub access |
| No plugin commands after install | Check the plugin is enabled in `/plugin` and start a new session |
| A new version doesn't arrive | Auto-update is off, or the author didn't bump `version` |
| Hooks don't fire on Windows | Update the plugin: hooks must use exec form (README rule) |

> **Check at kickoff:** the exact syntax of the commands for removing and manually updating
> the marketplace and plugins, against the current Claude Code docs. They are not in the root
> README, so they go on the page only after that check.

### 10.3 Contextual hints

- The type badge on a card has a tooltip with one sentence about the type and a "Learn more"
  link to `/guide/#types`. It works on hover and on focus and closes with `Esc`.
- After the first copy of a command, a one-time hint says "Paste the command into a Claude
  Code session" (`localStorage['dd:copy-hint']`).
- Example query chips under the empty search field (7.2).
- The 404 page and the "Empty catalog" state link to the relevant `/guide/` sections.

## 11. CI/CD

`.github/workflows/pages.yml`:

- Triggers: `push` to `main` touching `plugins/**`, `.claude-plugin/**`, `site/**` or the
  workflow itself; `pull_request` on the same paths; `workflow_dispatch`; `schedule` daily at
  05:17 UTC. The daily build refreshes freshness badges (8.3) and GitHub data (9.2).
- Job `build`: checkout with `fetch-depth: 0` (for `updatedAt` and the changelog), Node 22 with
  npm cache, `npm ci` in `site/`, validation (5.4), `npm test`, `npm run build` (catalog →
  changelog → stats → Astro), budget check (section 13), Playwright smoke with axe-core on the
  built `dist/`. Permissions: `contents: read`.
- Job `deploy`: only for `push`, `schedule` and `workflow_dispatch` on `main`;
  `upload-pages-artifact` → `deploy-pages`; permissions `pages: write`, `id-token: write`;
  `concurrency: pages`.
- On PRs the build runs without deploying, so the author sees indexer and validation errors.
  The build report (indexer warnings, sizes, changelog changes) goes to the job summary.

Manual setup: Settings → Pages → Source = **GitHub Actions**.

**Real data only.** The site renders only what exists in the repository: `.claude-plugin/`, `plugins/**` and git history. There is no demo build or sample data in the output. Sample data (the design prototype's artifacts) lives under `site/tests/fixtures/` and is used by unit tests only; `npm run build` fails if any fixture-only name appears in `dist/`.

**Phase 1 build.** The workflow runs `npm ci`, `npm test` and `npm run build` in `site/`, and publishes `site/dist` with `.nojekyll`. Validation (5.4) runs `claude plugin validate` when the CLI is available and falls back to `unknown`. Playwright, the budget script and Lighthouse are phase 2 (see section 15).

**Phase 2 build.** `npm run build` also writes the CSP `<meta>` (`scripts/csp.mjs`) and checks the size budgets (`scripts/check-budgets.mjs`, table in the job summary). After the link check the workflow builds the test fixture into `dist-e2e/` (`npm run build:e2e`, never deployed), installs Playwright's Chromium and runs the smoke tests on both `dist/` and `dist-e2e/`; on failure the Playwright report is uploaded as an artifact.

## 12. Security

- Markdown from plugins (artifact bodies, `README.md`, `CHANGELOG.md`) is sanitized
  (`rehype-sanitize`, GitHub's default schema). Raw HTML, `<script>`, `on*` attributes and
  `javascript:` links are stripped.
- Commit subjects and frontmatter fields are output as text only, through Astro/Preact escaping.
- Environment variable values from `.mcp.json` never reach the catalog — names only.
- The client has no `dangerouslySetInnerHTML` and no `innerHTML`.
- No external scripts, fonts or trackers in the MVP. Content-Security-Policy via `<meta>`:
  `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'`.
- Inline scripts (the theme script in `<head>`, and island scripts Astro inlines into the
  page) are allowed in the CSP only through `sha256` hashes: via Astro's built-in CSP support
  if the chosen version has it, or a post-build step that computes the hashes and writes
  `script-src`. The smoke test fails on any CSP violation in the console.
- `GITHUB_TOKEN` is used in CI only, to read public data, and never ends up in build output.
- The "Suggest an artifact" link puts only the query the user typed into the issue URL, and
  nothing else.
- `localStorage` holds UI preferences only (`dd:theme`, `dd:onboarding`,
  `dd:lastSeenRelease`, `dd:copy-hint`) and never the user's queries.

## 13. Non-functional requirements

| Metric | Budget |
|---|---|
| Home page JS | ≤ 80 KB gzip (search, filters, onboarding, counter). Raised from 40 KB because the island uses React |
| Other pages' JS | ≤ 5 KB gzip (copy, theme, What's new counter) |
| `catalog.json` | ≤ 200 KB gzip (checked in CI, warning from 150 KB) |
| `changelog.json` | ≤ 100 KB gzip |
| `stats.json` | ≤ 30 KB gzip |
| Search response on 1000 artifacts | ≤ 50 ms on an average laptop |
| `build-changelog` time on 300 commits | ≤ 60 s in CI |
| Lighthouse (mobile) | Performance ≥ 90, Accessibility ≥ 95 on `/`, `/stats/`, `/whats-new/` |
| CLS | ≤ 0.05 (the onboarding banner and counter don't shift content) |
| Artifact pages and `/stats/` | No JS beyond copy, theme and the counter |

## 14. Testing

- **Indexer:** a marketplace fixture with a plugin that has every component type, custom paths
  in `plugin.json`, an external plugin, broken YAML, a missing `description`, two hooks with
  the same slug. Snapshot of `catalog.json`.
- **Changelog:** `fixtures/history/` builds a temporary git repo with a sequence of commits:
  plugin added → skill added without a version bump (`pending`) → version bump (a release with
  the added skill) → agent updated → command removed and a release → a broken `plugin.json` in
  history → `CHANGELOG.md` with notes. Checks events, changes, notes, `truncated` with a limit
  of 3 commits, and determinism.
- **Stats:** totals, `growth`, `topTags` on the same fixtures; the build without `github` when
  the API fails (mocked `fetch`).
- **Normalization and intents:** apostrophes, stop words, stemming, type detection, in both
  languages.
- **Formatting:** plurals (1, 2, 12 artifacts), relative dates.
- **Storage:** `lib/storage.ts` when `localStorage` throws.
- **Contrast:** `tokens.contrast.test.ts` for every pair in 7.6 in both themes.
- **Golden queries** (`search.golden.test.ts`) on the fixture: query → expected `id` in the
  top 3. Minimum set:

| Query | Expected in top 3 |
|---|---|
| `I need a skill for PR review` | the review skill (type filtered to `skill`) |
| `review pull request` | the same skill |
| `Мені треба скіл для рев'ю PR` | the same skill (type filtered to `skill`) |
| `ревю` (no apostrophe) | the same skill |
| `security agent` | the security agent |
| `агент для безпеки` | the security agent |
| `revew` (typo) | the review skill |
| `pre-commit hook` | the PreToolUse/commit hook |

- **Smoke (Playwright)** on the built `dist/`:
  - home: type a query, see the card, copy the command, open the artifact page, restore
    state from the URL;
  - onboarding: the banner shows on the first visit and is gone after "Got it" and a reload;
  - What's new: the counter appears after a newer release and disappears after visiting
    `/whats-new/`;
  - catalog error: an intercepted `catalog.json` returning 500 → the error banner, the static
    list and the type filter still work;
  - no JS: the home page shows the full list;
  - axe-core on `/`, a plugin page, an artifact page, `/whats-new/`, `/stats/`, `/guide/` and
    404 in light and dark themes;
  - no console errors and no CSP violations on any page;
  - width 360 px: no horizontal scroll.

## 15. MVP acceptance criteria

1. A push to `main` publishes the site at the URL in this document's header automatically.
2. A new skill added in `plugins/devdigest/skills/<name>/SKILL.md` appears in search and
   gets its own page after the next deploy, with no changes to the site code.
3. The query "I need a skill for PR review" (and its Ukrainian version) shows the matching
   skill first plus the type filter chip. Until the repository has a review skill, this is
   checked on the golden-test fixture.
4. Every card copies the correct command per table 7.5.
5. A URL with `?q=` and filters reproduces the same result in another browser.
6. A plugin with a validation error shows a `fail` badge and the error text.
7. Broken frontmatter fails the build on a PR with a clear message.
8. Bumping `version` in `plugin.json` produces a new release on `/whats-new/`, in RSS and in
   the "New" block, listing added, updated and removed artifacts.
9. `/stats/` shows totals, growth and contents that match the catalog data; without GitHub
   API access the page builds without the GitHub block.
10. A new visitor sees the onboarding banner; once closed it doesn't come back, and the guide
    is available at `/guide/`.
11. Every state in table 7.7 can be reproduced by hand or by a test and matches its description.
12. All tests from section 14 are green and the budgets from section 13 are met.
13. Pages pass a keyboard check and meet AA contrast in both themes.

### Deferred to phase 2

Phase 2 delivered all of the items below except Lighthouse, which is still open. The smoke tests run on the real build and on a build of the test fixture (`dist-e2e/`), since the real marketplace has no components yet.

Phase 1 (the first implementation, see `temp/implementation-plan.md`) does not cover these criteria or parts of them:

- Criterion 8, RSS part (`/feed.xml`, 8.5): the RSS links are left out of the pages until the feed exists.
- Criterion 12, Playwright smoke and axe checks (section 14), the size budget script and Lighthouse (section 13), and the CSP `<meta>` with script hashes (section 12).
- Sitemap, `robots.txt` and the Open Graph image (7.9).
- Criterion 11 is covered by the UI for every state that applies to the phase 1 pages, but not by automated browser tests.

## 16. Roadmap

### Stage 2 — trust and teamwork

| Feature | What it is | Technical basis |
|---|---|---|
| Plugin security panel (done) | Which hooks run which commands on which events; which processes MCP servers start; whether there are network calls; whether the plugin is self-contained | Indexer extension, static analysis of `hooks.json`, `.mcp.json`, `scripts/` |
| Team settings builder (done) | The user picks plugins and the site generates a `.claude/settings.json` snippet with `extraKnownMarketplaces` and `enabledPlugins` | Plain client code over the catalog data |
| Per-plugin RSS (done; per-tag RSS not built) | Subscribe to just what matters | The same changelog data, separate `feed.xml` files at build time |
| "Suggest an artifact" / "Report a problem" | A form opens a prefilled issue from a template | GitHub issue forms + URL query parameters |
| Favorites and search history | Saved in the browser | `localStorage` |
| `llms.txt` and a stable `/api/catalog.json` | Machine-readable catalog for other tools and agents | Generated at build time, `schemaVersion` for compatibility |
| Plugin composition diagram | A visual map of how components relate | A static SVG at build time |
| Version comparison | "What changed between 0.2.0 and 0.3.0" with description diffs | Changelog snapshot data |

### Stage 3 — smart search and author tools

| Feature | What it is | Technical basis |
|---|---|---|
| Semantic search | Understands the meaning of a query in any language, not just keywords | Artifact embeddings in CI with a multilingual model (e.g. `multilingual-e5-small`); the query is embedded by transformers.js in the browser; the model loads lazily and only with user consent; hybrid ranking (Reciprocal Rank Fusion) with MiniSearch |
| Plugin or skill template generator | Form → zip with `plugin.json`, `SKILL.md`, `hooks.json` in exec form | JSZip in the browser |
| In-browser validator | Paste a `SKILL.md` / `plugin.json` and see the errors | The same rules as the indexer, moved into a shared module |
| Comments and reactions | Discussion and "ratings" of artifacts | giscus on GitHub Discussions |
| Ukrainian UI | An EN/UK language switch | `i18n/` dictionaries, `/uk/…` routes |
| PWA / offline | The catalog works without a network | A service worker caches pages and `catalog.json` |

## 17. Risks and open questions

| Risk / question | Mitigation |
|---|---|
| `claude plugin validate` may require authentication in CI | Fallback — the indexer's own checks (5.4) |
| The synonym dictionary lags behind the content | Golden tests for every new artifact; semantic search in stage 3 |
| Claude Code's component format changes | The indexer tolerates unknown fields (keeps them in `meta`) and fails only on invalid syntax |
| Catalog growth | Size budget in CI; switch to a serialized index (6.1) |
| The stage 3 language model weighs tens of MB | Opt-in, browser caching, full functionality without it |
| Astro inlines scripts that a strict CSP blocks | Hashes in `script-src` (section 12), a smoke test for CSP violations |
| Rewriting history (force-push) changes the release feed | Acceptable: the feed deterministically follows the current `main` history; forbid force-push to `main` with a branch rule |
| Authors don't bump `version` | Changes are visible in the "Unreleased" block (8.3); in stage 2 — a PR warning when a plugin changed without a version bump |
| GitHub API limits | GitHub data is optional and the block hides (9.2) |
| "New" badges go stale without builds | A scheduled daily build (section 11) |
| Claude Code's remove and update commands may change | Check against the docs before publishing `/guide/` (10.2) |
