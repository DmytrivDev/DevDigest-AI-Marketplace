# Contributing

This repo is a Claude Code plugin marketplace. Plugins installed from it run code on users'
machines, so every change is reviewed by the owners in [`CODEOWNERS`](CODEOWNERS).

This page holds the short rules and the PR checklist. The longer explanations are in
`docs/`:

| Document | What it covers |
|---|---|
| [`docs/PLUGIN-GUIDELINES.md`](docs/PLUGIN-GUIDELINES.md) | Plugin anatomy, skills, agents, hooks, paths, boundaries and owners, dependencies, porting |
| [`docs/SECURITY.md`](docs/SECURITY.md) | What may never ship, least privilege, what to do after an unsafe release |
| [`docs/RELEASES.md`](docs/RELEASES.md) | SemVer, tags, release order, `latest` / `stable` channels, update, rollback |
| [`docs/SITE-SPEC.md`](docs/SITE-SPEC.md) | The catalog site on GitHub Pages and what it reads from each plugin |
| [`docs/COST-BASELINE.md`](docs/COST-BASELINE.md) | Cost and quality baseline of the SDD workflow (added once measured) |

## Add a plugin

1. Create a self-contained directory `plugins/<name>/`:

   ```
   plugins/<name>/
   ├── .claude-plugin/plugin.json   # manifest only — nothing else goes in .claude-plugin/
   ├── skills/<skill>/SKILL.md      # + scripts/ and references/ inside the skill
   ├── agents/*.md
   ├── hooks/hooks.json             # events wrapped in a top-level "hooks" key
   ├── evals/<case>/                # claude plugin eval cases: prompt.md + graders/*.md
   ├── .mcp.json
   ├── README.md                    # what it does, components, usage, dependencies, credits
   ├── CHANGELOG.md                 # Keep a Changelog: ## [x.y.z] — YYYY-MM-DD
   └── COMPATIBILITY.md             # **Claude Code:** `>=x.y.z`, plus what the plugin relies on
   ```

2. Write `plugin.json` with `name`, `version`, `description`, `author` and, if the plugin
   uses another plugin's components, `dependencies`.
3. Add an entry to `.claude-plugin/marketplace.json`:

   ```json
   {
     "name": "<name>",
     "source": "./plugins/<name>",
     "description": "One line on what the plugin does",
     "category": "<category>",
     "tags": ["..."]
   }
   ```

4. Add the plugin to the table in [`README.md`](README.md) and an owner line to
   [`CODEOWNERS`](CODEOWNERS).
5. Check that the plugin's job fits one of the boundaries in
   [`docs/PLUGIN-GUIDELINES.md`](docs/PLUGIN-GUIDELINES.md) §12, or describe its new
   boundary in the PR.

## Rules

**Names**
- The entry `name` in `marketplace.json` equals `name` in the plugin's `plugin.json`.
- Plugin names are kebab-case and never start with `claude-`, `anthropic-` or `cc-plugin-`.
- Treat a published name as permanent. To change how it is shown, set `displayName`. To
  rename or remove a plugin, add it to the `renames` map in `marketplace.json`.

**Versions and releases**
- `version` lives only in `plugin.json`, never in the marketplace entry.
- Bump it in every PR that changes a plugin, following SemVer
  ([`docs/RELEASES.md`](docs/RELEASES.md) §1), and add the `CHANGELOG.md` section. Users
  do not receive new commits until the version string changes.
- Tags (`<plugin>--v<version>`) are created by maintainers after merge, never in a PR.

**Dependencies between plugins**
- Every other plugin whose agent or skill you use is declared in `dependencies`, in object
  form with a caret range: `{ "name": "engineering-paved-path", "version": "^1.0.0" }`.
- Refer to those components only by their namespaced names
  (`research-tools:researcher`, `engineering-paved-path:security`). Never read another
  plugin's files by path.
- No cycles. A dependency's major bump raises the range in every dependent in the same
  release train, and dependencies are released first.
- Details: [`docs/PLUGIN-GUIDELINES.md`](docs/PLUGIN-GUIDELINES.md) §13.

**Self-contained plugins**
- A plugin is copied into the Claude Code cache on install. Never reference files outside
  its directory (`../`, repo-root `docs/`, shared scripts).
- Reference bundled files as `${CLAUDE_PLUGIN_ROOT}/...` and a skill's own scripts as
  `${CLAUDE_SKILL_DIR}/scripts/...`. Keep state that must survive updates in
  `${CLAUDE_PLUGIN_DATA}`.
- Paths and commands that depend on the user's project are explicit inputs (config file,
  brief, a question to the user), never assumptions about one repository's layout.
- `CLAUDE.md` inside a plugin is not loaded — put instructions in a skill.
- Use forward slashes in every path.

**Hooks and scripts**
- Use exec form so hooks work on Windows, macOS and Linux:
  `"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/x.mjs"]`.
- Don't call `.cmd` / `.bat` shims from exec form.
- Write scripts in Node with zero dependencies where possible. Keep hooks small and
  readable: reviewers must be able to see everything they do.

**Security** — full policy in [`docs/SECURITY.md`](docs/SECURITY.md)
- No secrets and no absolute paths. Ask for keys through `userConfig` with
  `"sensitive": true` and reference them as `${user_config.KEY}`.
- Agents get the minimum tools they need. Read-only agents don't get `Edit`, `Write` or a
  writable `Bash`.
- External plugin sources (`github`, `git-subdir`, `url`) pin both `ref` and a full
  40-character `sha`.
- Node dependencies install only from `package-lock.json`, `npm-shrinkwrap.json` or
  `bun.lock`. `pnpm-lock.yaml` and `yarn.lock` are ignored.
- Third-party files keep their license and are credited in the plugin README.

## Before opening a PR

```bash
node scripts/validate.mjs --install
```

It runs `claude plugin validate --strict` on the marketplace and on every plugin, plus the
checks `validate` misses:
- a `source` directory that does not exist;
- an entry name that differs from `plugin.json`;
- `version` in the marketplace entry;
- external sources without a pinned `sha`;
- absolute paths and secret-looking strings in plugin files;
- bundled scripts that fail `node --check`.

`--install` then adds the marketplace and installs every plugin, with its dependencies, into
a throwaway Claude config dir, so your own `~/.claude` is not touched. CI runs the same
command on every PR (`.github/workflows/validate.yml`).

During development, load every plugin for one session without installing them:

```bash
claude --plugin-dir ./plugins
```

Behaviour evals are real, billed model calls, so they run by hand:

```bash
claude plugin eval ./plugins/<name>
```

## Pull request checklist

- [ ] One plugin or one concern per PR.
- [ ] `version` bumped and a `CHANGELOG.md` section added for every plugin the PR changes.
- [ ] `dependencies` list every other plugin you use, with a `^` range.
- [ ] `COMPATIBILITY.md` still true; raised if you rely on a newer Claude Code feature.
- [ ] README updated: components table, usage examples, dependencies, credits.
- [ ] No secrets, no absolute paths, no references outside the plugin directory.
- [ ] Eval cases added or updated for new behaviour. Say whether you ran them, and paste the
      summary if you did.
- [ ] `node scripts/validate.mjs --install` output pasted in the PR description.
- [ ] Changes to `.claude-plugin/marketplace.json` and `CODEOWNERS` are reviewed by the repo
      owner.
