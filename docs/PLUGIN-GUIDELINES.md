# Plugin guidelines

How to build a plugin for this marketplace and why the rules are what they are. Distilled
from the official Claude Code docs (Oct 2026, CLI 2.1.28x–2.1.301) plus community reports.
Items marked **(verify)** were not confirmed against the docs — check before relying on them.

Related documents:
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — the short rules and the PR checklist.
- [`SECURITY.md`](SECURITY.md) — what may never ship, and what to do after a bad release.
- [`RELEASES.md`](RELEASES.md) — versions, tags, update, channels and rollback.
- [`SITE-SPEC.md`](SITE-SPEC.md) — how the catalog site reads plugins.

Primary sources:
- Marketplace reference — https://code.claude.com/docs/en/plugins/marketplace-reference
- Plugin manifest reference — https://code.claude.com/docs/en/plugins/manifest-reference
- Loading, versions, cache — https://code.claude.com/docs/en/plugins/loading
- Hosting and releases — https://code.claude.com/docs/en/plugins/host-marketplace
- Hooks — https://code.claude.com/docs/en/hooks
- Plugin evals — https://code.claude.com/docs/en/plugin-evals
- Skill authoring best practices — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

---

## 1. Anatomy of a plugin

```
plugins/<name>/
├── .claude-plugin/plugin.json   # manifest — the ONLY file in .claude-plugin/
├── skills/<skill>/SKILL.md      # preferred for both auto-triggered skills and slash commands
├── skills/<skill>/references/   # extra files the skill loads on demand
├── agents/<agent>.md            # subagents
├── commands/<cmd>.md            # legacy slash commands — prefer skills/
├── hooks/hooks.json             # { "hooks": { "<Event>": [...] } }
├── scripts/                     # code that hooks / MCP / skills run
├── .mcp.json                    # MCP servers
├── package.json + package-lock.json   # only if scripts need npm deps
└── README.md
```

- Every component is namespaced by the plugin name: skill `run-plan` in plugin
  `sdd-engineering` runs as `/sdd-engineering:run-plan`, agent `researcher` in
  `research-tools` appears as `research-tools:researcher`. Reference another plugin's
  components only by that full name.
- A `CLAUDE.md` inside a plugin is **not loaded** — put standing instructions in a skill.
- Default directories are discovered automatically; you only list paths in `plugin.json`
  for non-default locations. `skills`, `hooks`, `mcpServers` **add to** the defaults;
  `commands`, `agents`, `outputStyles` **replace** the default directory.
- Do not add a top-level `bin/` (files go on the Bash PATH, and claude.ai org sync rejects
  it). Use `scripts/` and call them via `${CLAUDE_PLUGIN_ROOT}`.

## 2. `plugin.json`

```json
{
  "name": "architecture-review",
  "version": "1.0.0",
  "description": "What the plugin does, in one line",
  "author": { "name": "DmytrivDev" },
  "homepage": "https://github.com/DmytrivDev/DevDigest-AI-Marketplace",
  "keywords": ["architecture"],
  "dependencies": [
    { "name": "engineering-paved-path", "version": "^1.0.0" }
  ]
}
```

- `name` is the only required key: kebab-case, no spaces, never `claude-*`, `anthropic-*`,
  `cc-plugin-*`. It must equal the entry `name` in `marketplace.json`.
- `version` lives **here only**. Bump it in every change — see §8.
- `userConfig` declares settings/secrets the user is asked for on install — see §6.

## 3. Skills

A skill is `skills/<skill-name>/SKILL.md` with YAML frontmatter and a Markdown body.

```markdown
---
name: review-pr
description: Reviews a pull request diff for correctness bugs and grounds every finding in a file and line. Use when the user asks to review a PR, a diff or a branch.
---

# Review a pull request
1. ...
For the severity rubric, read `references/severity.md`.
```

**The description decides whether the skill triggers.** Rules from the skill best-practices page:
- Third person. Say **what it does AND when to use it**, with the trigger words a user would
  actually type.
- `description` max 1,024 chars; `name` max 64, lowercase letters, digits, hyphens; no
  "anthropic" / "claude" in the name.
- One skill = one job. Two unrelated triggers → two skills.

**Body:**
- Keep `SKILL.md` under ~500 lines. Move detail into `references/*.md` and link it
  **one level deep** (SKILL.md → reference, never reference → reference).
- Write steps Claude can execute, not essays. Concrete examples beat abstract rules.
- Paths use forward slashes. Bundled files are referenced as `${CLAUDE_PLUGIN_ROOT}/...`
  (substituted in skill bodies).
- MCP tools are referenced by their fully qualified name (`Server:tool`).
- Claude Code-specific frontmatter (e.g. `allowed-tools`, `argument-hint`,
  `disable-model-invocation` for user-only commands) **(verify the current list)**.

**Writing order (recommended by Anthropic):** write 3+ eval prompts first, run them
without the skill to see the baseline failure, then write the skill to fix exactly that.

## 4. Agents

`agents/<name>.md` — frontmatter plus a system prompt.

```markdown
---
name: diff-reviewer
description: Read-only reviewer for a PR diff. Use when a review needs an isolated context.
tools: Read, Grep, Glob
---

You review ... Return findings as ...
```

- The `description` is how Claude decides to delegate — same rules as for skills.
- Grant the **minimum tools**. A reviewer does not need `Edit`/`Write`/`Bash`.
- Plugin agents ignore `hooks`, `mcpServers`, `permissionMode` and `initialPrompt` in
  frontmatter (confirmed in the sub-agents docs). Supported: `name`, `description`, `model`,
  `effort`, `maxTurns`, `tools`, `disallowedTools`, `skills`, `memory`, `background`,
  `isolation: worktree`, `color`.
- `skills:` preloads full skill content. Skills with `disable-model-invocation: true` cannot
  be preloaded. Whether another plugin's namespaced skill can be preloaded is **(verify)** —
  our agents also load such skills through the `Skill` tool as a fallback.

## 5. Hooks

`hooks/hooks.json` — events must be wrapped in a top-level `"hooks"` key or nothing loads.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/format.mjs"] }
        ]
      }
    ]
  }
}
```

- **Use exec form** (`command` + `args`). No shell quoting, works the same on Windows,
  macOS and Linux. Write scripts in Node (`.mjs`), not bash.
- If you must use shell form, quote the root: `"\"${CLAUDE_PLUGIN_ROOT}\"/scripts/x.sh"`
  — the install path can contain spaces. On Windows shell form runs in Git Bash (or
  PowerShell if Git Bash is missing).
- Exec form on Windows cannot start `.cmd` / `.bat` shims (`npx`, `pnpm`, `claude`) —
  call `node script.mjs` and spawn from there.
- A timed-out `PreToolUse` hook does **not** block by default. For policy hooks set
  `"onFailure": "block"` (CLI 2.1.295+ — newer than the 2.1.283 installed here).
- Hooks run on every matching event on the user's machine. Keep them fast, small and
  readable — they are the main security surface of a plugin (§10).
- Do not declare hooks as a file path inside the `marketplace.json` entry — it passes
  `validate` and then fails at load. Hooks go in `hooks/hooks.json`.

## 6. MCP servers, config and secrets

`.mcp.json` at the plugin root:

```json
{
  "mcpServers": {
    "example-api": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/mcp-server.mjs"],
      "env": { "EXAMPLE_API_URL": "${user_config.api_url}" }
    }
  }
}
```

- Declare MCP servers in the plugin (`.mcp.json` or `plugin.json`), not in the
  marketplace entry — entry-level `mcpServers` are ignored when `plugin.json` exists.
- Ask for settings and secrets with `userConfig` in `plugin.json`. `"sensitive": true`
  stores the value in the OS credential store. Reference values as `${user_config.KEY}`
  (MCP/LSP config, exec-form hook `args`) or `$CLAUDE_PLUGIN_OPTION_<KEY>` (hook env).
  `${user_config.*}` is rejected in shell-form hooks.
- Never commit keys, tokens or literal `Authorization` headers; `validate` flags them and
  plain `http://` URLs to non-local hosts.
- When a repo enables the plugin at **project** scope, only MCP servers declared inline or
  in `.mcp.json` inside the plugin dir load.

## 7. Paths, environment, dependencies

| Variable | Points to | Use for |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | the installed copy of this plugin version | bundled scripts and files (read-only) |
| `${CLAUDE_PLUGIN_DATA}` | `~/.claude/plugins/data/<id>/` | state, caches, installed deps — survives updates |
| `${CLAUDE_PROJECT_DIR}` | the user's project root | reading the project |

- These are substituted in hook commands/args, MCP/LSP config and skill/agent bodies.
  They are **not** set in the environment of Bash commands Claude runs.
- `${CLAUDE_PLUGIN_ROOT}` changes on every version — never write state there.
- **The plugin is copied into the cache on install.** Anything outside `plugins/<name>/`
  (`../shared`, repo-root `docs/`, this guide) does not exist for the installed plugin.
  Symlinks inside the marketplace are dereferenced; symlinks outside it are dropped.
- Forward slashes everywhere; `..` in component paths is rejected.
- npm deps are installed automatically **only** from `package-lock.json`,
  `npm-shrinkwrap.json` or `bun.lock` (registry packages, install scripts disabled, 60 s
  timeout). `pnpm-lock.yaml` / `yarn.lock` are ignored — ship an npm lockfile or a
  pre-bundled script.
- Do not keep plugin files in Git LFS — clones get pointer files.

## 8. Versions and releases

- Version precedence: `plugin.json` → marketplace entry → commit SHA. We set it only in
  `plugin.json`.
- **If `version` is set and you push without changing it, installed users never get the
  change.** Bump on every PR that touches the plugin (semver: patch = fix, minor = new
  skill/agent/hook, major = removed or renamed component).
- Auto-update is off by default for third-party marketplaces; users refresh with
  `claude plugin marketplace update devdigest-marketplace` and
  `claude plugin update sdd-engineering@devdigest-marketplace`, or enable auto-update in `/plugin`.
- The full release, channel and rollback procedure is in [`RELEASES.md`](RELEASES.md).
- Tag releases with `claude plugin tag --push` → `<plugin>--v<version>`; it checks that
  versions agree and the tree is clean.
- A running session keeps the old version until `/reload-plugins`.
- Renaming a plugin breaks users' `enabledPlugins`. Avoid it; if needed, add the old name to
  `renames` in `marketplace.json` (`null` = removed).

## 9. Develop and test

```bash
claude --plugin-dir ./plugins                # load every plugin for one session; edits apply after /reload-plugins
node scripts/validate.mjs                    # manifests, content rules, claude plugin validate --strict
node scripts/validate.mjs --install          # + real install in a throwaway config dir
claude plugin details sdd-engineering        # what components actually loaded, and their token cost
```

- `/plugin` → **Errors** tab shows load errors (`path escapes plugin directory`,
  `conflicting manifests`, …).
- Behaviour tests: `claude plugin eval ./plugins/sdd-engineering` (cases in `evals/<case>/`
  with `prompt.md` + `graders/*.md`; `claude plugin eval init` scaffolds one). Each case
  runs with and without the plugin; every run is a real, billed model call. In CI add
  `--trust-plugin --json out.json --no-publish` and pin `--model`.
- Test on Windows too — that is where hook paths break first.

## 10. Security

- Plugins run code on install and on every hook event, with the user's permissions.
  Reviewers must be able to read every hook and script in the diff.
- No network calls, telemetry or writes outside the project / `${CLAUDE_PLUGIN_DATA}`
  unless the README says so explicitly.
- Never have a hook edit `settings*.json`, permissions or other plugins' files — that is
  the exact pattern of reported marketplace-plugin hijacks.
- External plugin sources pin `ref` + full 40-char `sha`.
- The full policy — no secrets, no absolute paths, what to do after an unsafe release — is
  [`SECURITY.md`](SECURITY.md). `node scripts/validate.mjs` enforces the mechanical part.

## 11. Porting a project's existing `.claude/` artifacts

First sort everything in the source project's `.claude/` into four groups:

| Group | Examples | What happens |
|---|---|---|
| Reusable | skills, agents, hooks, evals with no product-specific paths | ported into a plugin |
| Project-specific | `CLAUDE.md`, product specs, module names, rules only that product needs | stays in the product repo; the plugin reads it through explicit inputs (config, brief) |
| Optional integrations | MCP servers, anything with network access or credentials | its own plugin, opt-in, credentials via `userConfig` |
| Local leftovers | caches, personal memory, experiments, absolute paths | never ported |

Then, when moving a reusable file into `plugins/<name>/`:
- Copy every file it reads (references, scripts, templates) **into the plugin**; repo
  paths like `docs/…`, `INSIGHTS.md`, `scripts/…` will not exist after install.
- Replace hard-coded paths with `${CLAUDE_PLUGIN_ROOT}/…` (bundled) or
  `${CLAUDE_PROJECT_DIR}/…` (the user's repo — and handle it being absent).
- Instructions that lived in `CLAUDE.md` become a skill.
- Hooks written as `.sh` → rewrite as Node exec-form hooks.
- A server or script that uses pnpm or yarn — ship an npm lockfile or a bundled build.
- Remove every mention of the source project (name, packages, paths, spec numbers, measured
  numbers) — the plugin is public and must read as project-agnostic.
- Record where every third-party file came from (repo, path, commit) and its license in the
  plugin README's Credits. A file without a license that allows redistribution does not ship.
- Re-check the description: inside a plugin it competes with every other installed skill.

## 12. Boundaries and owners

Every plugin owns one job and is released on its own. Before adding a component, check that
it belongs to the plugin's boundary below. If it doesn't, it goes in another plugin or a new
one. Owners are listed in [`CODEOWNERS`](../CODEOWNERS).

| Plugin | Boundary — what belongs here | What does not |
|---|---|---|
| `engineering-paved-path` | Stack knowledge as skills: architecture, React, Next.js, Fastify, testing, security | Agents, workflows, anything that writes files on its own |
| `research-tools` | Read-only research agents | Agents that edit, review or implement |
| `architecture-review` | The read-only architecture reviewer and its evals | The rules themselves — those live in `engineering-paved-path` |
| `sdd-engineering` | The SDD pipeline: its agents, orchestration skills, shared formats, evals | Stack rules (→ `engineering-paved-path`), research (→ `research-tools`), review (→ `architecture-review`) |

A file's owner, consumer scenario and update reason must be explainable. For example,
`sdd-format` is owned by `sdd-engineering` and read by its four agents and `run-plan`. It
changes whenever the spec or plan format changes, and that is why it is released with them.

## 13. Dependencies between plugins

- **Declare everything you use.** A plugin that dispatches another plugin's agent or loads
  its skill lists that plugin in `dependencies`. An undeclared one fails silently: the name
  simply does not resolve on a machine where the other plugin is not installed.
- **Object form with a range:** `{ "name": "engineering-paved-path", "version": "^1.0.0" }`.
  A bare name resolves in this marketplace. A plugin from another marketplace needs
  `allowCrossMarketplaceDependenciesOn` in `marketplace.json` — we have none.
- **Ranges are caret on the major:** `^1.0.0`. A breaking change in a dependency is a new
  major. Every dependent then raises its range in the same release train.
- **Release dependencies first,** then the plugins that depend on them
  ([`RELEASES.md`](RELEASES.md)).
- **No cycles,** and keep the graph shallow. Today it is
  `sdd-engineering → {engineering-paved-path, research-tools, architecture-review}` and
  `architecture-review → engineering-paved-path`.
- **Check it:** after a test install, `claude plugin list --json` must show no
  `dependency-unsatisfied`, `range-conflict` or `no-matching-tag`.
- **Relative-path plugins** resolve to the marketplace's current copy. If that copy does not
  satisfy the range, the dependent plugin stays disabled. Bump ranges and versions together.

## 14. Pre-PR checklist

- [ ] Entry `name` = `plugin.json` `name`; no reserved prefix
- [ ] Every other plugin's component you use is in `dependencies` with a `^` range (§13)
- [ ] `COMPATIBILITY.md` updated if you rely on a newer Claude Code feature
- [ ] Third-party files credited, with a license that allows redistribution
- [ ] `version` bumped in `plugin.json`, absent from `marketplace.json`
- [ ] Nothing referenced outside `plugins/<name>/`
- [ ] Hooks in exec form, scripts in Node, `${CLAUDE_PLUGIN_ROOT}` paths
- [ ] No secrets; config via `userConfig`
- [ ] Every skill/agent description says what + when, with trigger words
- [ ] Plugin `README.md` lists components and usage examples
- [ ] `node scripts/validate.mjs --install` passes
- [ ] Tried it with `claude --plugin-dir` on a real task
