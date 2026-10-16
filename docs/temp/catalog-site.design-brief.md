# Design brief: DevDigest Marketplace catalog

A short brief for Claude Design. The full spec is [catalog-site.md](catalog-site.md)
(sections 7–10). Where the brief and the spec disagree, the spec wins.

## 1. Context

DevDigest Marketplace is a static catalog site for Claude Code plugins, hosted on GitHub
Pages. A plugin is made of artifacts of six types: skills, agents, commands, hooks, MCP
servers (and the plugin itself). A developer searches for an artifact in natural language
("I need a skill for PR review"), sees what it does, and copies the install or invoke command.

- Audience: developers who use Claude Code.
- UI language: English. Search also accepts Ukrainian queries.
- Character: a reference tool in the spirit of documentation — dense, calm, fast. Not a
  landing page and not marketing.

## 2. What to design

One interactive prototype with every page and working navigation between them:

| # | Page | Main content |
|---|---|---|
| 1 | Home `/` | Hero with the add-marketplace command, onboarding banner, stats strip, search, example chips, "New" block, filters, card grid |
| 2 | Plugin `/plugins/devdigest/` | Description, version, validation badge, install commands, contents by type, README, artifacts by type, "Version history" |
| 3 | Artifact `/plugins/devdigest/skill/review/` | Breadcrumbs, type badge, command, rendered markdown, frontmatter fields, skill files, "More from this plugin" |
| 4 | What's new `/whats-new/` | Releases by month, plugin filter, release item with added/updated/removed, collapsed notes, "Unreleased" block |
| 5 | Stats `/stats/` | Summary tiles, freshness, growth chart, contents by type, plugins table, tags, quality, GitHub, "What's not here and why" |
| 6 | Guide `/guide/` | Sticky table of contents, anchored sections, artifact types table, common problems table, command blocks with copy |
| 7 | 404 | Message, search field, link to the guide |

Every page at two widths (1280 px and 360 px) and in two themes (light and dark).

Shared elements:

- **Header:** marketplace name, navigation "Catalog · What's new · Stats · Guide", an unseen
  releases counter next to "What's new" ("●2"), GitHub link, a three-way theme switch
  (System / Light / Dark). At 360 px the navigation collapses into a "Menu" button.
- **Footer:** "Built Oct 16, 2026 from commit 45adf15", links to the repository, RSS and
  `catalog.json`, the note "This site collects no visitor data."

## 3. States

The prototype needs a utility panel (outside the page design) to switch states:

| State | Page | Appearance |
|---|---|---|
| Preparing search | Home | "Preparing search…" with a spinner under the field, static list in place |
| No results | Home | Message, popular tags, "Suggest an artifact", "Clear filters" |
| Catalog error | Home | Warning banner under the field: "Couldn't load search. The list below is current as of the last build." + "Try again" |
| Offline | Home | The same banner: "You're offline." |
| Page is stale | Home | Unobtrusive "Catalog updated" notice + "Reload page" |
| Empty catalog | Home | "No artifacts in this marketplace yet" + a link for authors |
| No JS | Home | Static list only, no search field and no onboarding banner |
| External plugin | Plugin | "External" badge, "Contents unavailable: this plugin is hosted outside this repository" |
| Validation fail | Plugin | Red badge and an expanded block with the error text |
| Validation unknown | Plugin | Grey "Not verified" badge with a tooltip |
| Copied | Any | Copy button with a check mark and "Copied" |
| Copy failed | Any | Command text selected + hint "Press Ctrl+C" |
| No releases | What's new | "No releases yet" |
| No GitHub data | Stats | GitHub block absent |

Interactions that must work in the prototype: search over the sample data, filters, active
filter chips, dismissing the onboarding banner, expanding release notes, the 360 px menu,
the theme switch.

## 4. Visual system

Color carries meaning (type, state, links), not decoration. No gradients, illustrations or
shadows. Every badge has text; color is never the only carrier of information.

**Colors**

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#ffffff` | `#0f1216` | background |
| `--surface` | `#f6f7f9` | `#171b21` | cards, search field, code |
| `--surface-hover` | `#eef0f3` | `#1f242c` | hover |
| `--border` | `#d9dde3` | `#2b313a` | borders |
| `--text` | `#1b1f24` | `#e6e8eb` | text |
| `--text-muted` | `#57606a` | `#9aa4b0` | meta, captions |
| `--accent` | `#0b5cad` | `#6cb2ff` | links, focus, primary button |
| `--highlight` | `#fff3b0` | `#5c4a00` | search match highlight |
| `--success` | `#1a7f37` | `#4ac26b` | pass, "Copied" |
| `--warning` | `#9a6700` | `#d29922` | warnings, "Updated" |
| `--danger` | `#b42318` | `#ff7b72` | fail, errors |

**Artifact types.** Badge text in the type color, background in the same color at 12%,
16 px icon.

| Type | Light | Dark | Icon | Label |
|---|---|---|---|---|
| plugin | `#6639ba` | `#b392f0` | box | Plugin |
| skill | `#0b6e4f` | `#56d4a4` | lightning bolt | Skill |
| agent | `#8a4b00` | `#f0b72f` | person silhouette | Agent |
| command | `#0a6877` | `#5cc8d6` | `/` in a frame | Command |
| hook | `#a40e26` | `#ff8182` | hook | Hook |
| mcp | `#3d4b5c` | `#a8b3c1` | plug | MCP |

**Typography.** System fonts only, no web fonts:
`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; monospace —
`ui-monospace, "Cascadia Code", "JetBrains Mono", Consolas, monospace`. Scale 13 / 14 / 16 /
20 / 24 / 32 px; line height 1.5 for text, 1.25 for headings. Artifact names and commands in
monospace.

**Space and shape.** 4 px step (4, 8, 12, 16, 24, 32, 48). Radii: 6 px for buttons, badges,
chips; 10 px for cards and banners. 1 px borders.

**Grid.** Max width 1200 px, side gutters 16 px (below 640 px) and 24 px.

| Width | Card columns | Filters |
|---|---|---|
| < 640 px | 1 | collapsed "Filters (N)" panel above results |
| 640–959 px | 2 | same |
| 960–1279 px | 2 | 240 px sidebar, sticky |
| ≥ 1280 px | 3 | 240 px sidebar, sticky |

**Key components**

- **Artifact card:** type badge, "New" / "Updated" badge (when set), monospace name,
  description up to 3 lines, meta (plugin · up to 4 tags · date), copy command button at the
  bottom.
- **Copy button:** the command in monospace inside a `--surface` frame + icon; a long command
  is truncated with "…".
- **Onboarding banner:** three steps in a row (stacked at 360 px): "Add the marketplace",
  "Install a plugin", "Find and invoke"; buttons "Got it", "Learn more →", "×".
- **Release item:** title "devdigest 0.3.0", date and commit on the right, "+ Added",
  "~ Updated", "− Removed" rows with badges, collapsed "Release notes".
- **Stat tile:** a 32 px number and a label; type tiles in the type color.
- **Growth chart:** stepped lines per type in the type colors, direct labels at the line ends
  instead of a legend, "Show as table" below the chart.

**Accessibility.** WCAG 2.2 AA contrast in both themes. Visible focus:
`2px solid var(--accent)` with a 2 px offset. A "Skip to results" link as the first element.
Animations up to 150 ms, color and opacity only.

**Don't:** gradients, shadows, illustrations, emoji in the UI, web fonts, carousels, modals
for primary actions, horizontal page scroll at 360 px.

## 5. Prototype data

The examples are illustrative but realistic in length.

**Marketplace:** `devdigest-marketplace`, repository `DmytrivDev/DevDigest-AI-Marketplace`,
description "Claude Code plugins from DevDigest, the local-first AI PR reviewer."

**Plugin:** `devdigest` 0.3.0, category code-review, tags `code-review`, `pull-requests`,
`devdigest`, validation pass. Description: "DevDigest review workflow for Claude Code: skills,
agents, hooks and MCP server".

| Type | Name | Description | Tags | Updated | Freshness |
|---|---|---|---|---|---|
| skill | `review` | Reviews a pull request diff and reports findings grouped by severity, with file and line references. | review, pr | Oct 14, 2026 | New |
| skill | `pr-brief` | Summarizes a pull request into a short brief: intent, risky areas and the files to read first. | pr, summary | Oct 14, 2026 | New |
| skill | `dependency-checker` | Checks new or updated dependencies for license issues, known vulnerabilities and bundle size impact. | dependencies, security | Oct 2, 2026 | — |
| agent | `security-reviewer` | Audits a diff for injection, broken auth, unsafe deserialization and leaked secrets. | security, review | Oct 14, 2026 | Updated |
| agent | `test-quality-reviewer` | Flags weak assertions, missing edge cases and flaky test patterns in changed tests. | tests, review | Oct 2, 2026 | — |
| agent | `performance-reviewer` | Finds N+1 queries, unbounded loops and needless re-renders introduced by a change. | performance, review | Oct 2, 2026 | — |
| command | `export-ci` | Exports a review agent as a ready-to-commit GitHub Actions workflow. Argument: `<agent-name>` | ci, github-actions | Oct 2, 2026 | — |
| hook | `pre-tool-use-bash` | Blocks `git commit` when staged files contain secrets or private keys. | git, security | Sep 16, 2026 | — |
| mcp | `devdigest` | Exposes reviews, findings and agents to Claude through an MCP server. Env vars: `DEVDIGEST_URL` | mcp | Sep 16, 2026 | — |

**Card commands:** skill — `/devdigest:review`; command — `/devdigest:export-ci <agent-name>`;
agent, hook, MCP and plugin — `/plugin install devdigest@devdigest-marketplace`.
Adding the marketplace — `/plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace`.

**Releases**

| Release | Date | Commit | Changes |
|---|---|---|---|
| devdigest 0.3.0 | Oct 14, 2026 | `a1b2c3d` | + skill `review`, + skill `pr-brief`; ~ agent `security-reviewer`; − command `summarize` |
| devdigest 0.2.0 | Oct 2, 2026 | `9f8e7d6` | + skill `dependency-checker`, + agents `test-quality-reviewer`, `performance-reviewer`, + command `export-ci` |
| devdigest added (0.1.0) | Sep 16, 2026 | `3c4d5e6` | plugin added: agent `security-reviewer`, hook `pre-tool-use-bash`, MCP `devdigest`, command `summarize` |

Unreleased: "Changes in the repository not yet released in a new version: ~ skill `review`".

**Stats:** 1 plugin, 9 artifacts (3 skills, 3 agents, 1 command, 1 hook, 1 MCP server),
14 tags, 1 author. Last release Oct 14, 2026; releases in 30 days — 2, in 90 days — 3.
Growth: Sep 16 — 4, Oct 2 — 8, Oct 14 — 9. Validation: 1 pass. Description present in 9 of 9.
GitHub: 12 stars, 2 forks, 3 open issues, 2 contributors.

**Example query chips:** "skill for PR review", "security agent", "pre-commit hooks".
For the search "I need a skill for PR review", `review` comes first, a
"Type: skill (from query) ×" chip appears, and matches in the name and description are
highlighted. The Ukrainian query «Мені треба скіл для рев'ю PR» gives the same result.

## 6. Prompt for Claude Design

Paste it together with this file (or sections 1–5) attached:

```text
Build an interactive prototype of the DevDigest Marketplace catalog site from the attached
design brief.

I need all 7 pages from section 2 of the brief in one prototype with working navigation
between them: home, plugin, artifact, What's new, stats, guide, 404.
Every page at 1280 and 360 px widths, in light and dark themes.
Add a utility panel outside the page design to switch width, theme and the states from
section 3.

The visual system is fixed (section 4): use these color tokens, artifact type colors,
system fonts, spacing scale, radii and grid; don't invent your own.
The style is a dense reference tool in the spirit of documentation: no gradients, shadows,
illustrations or emoji. Contrast is WCAG AA in both themes, with visible focus on every
interactive element.

The UI is in English. Use the data from section 5: it is realistic in length, don't replace
it with lorem ipsum.

These must work: search over this data with match highlighting and the automatic type chip,
filters with counts, dismissing the onboarding banner, copy with confirmation, expanding
release notes, the 360 px menu, the theme switch.

First show a short plan of the pages and shared components, then build everything together.
```

## 7. After Claude Design

- The standalone claude.ai/design site closes on December 14, 2026, and chats and comments
  there don't carry over. Export the finished result (PDF, link, or hand-off to Claude Code),
  and migrate the design system through the Artifacts page.
- If the design changed tokens, components or states, update section 7 of the spec so
  implementation follows a single source of truth.
