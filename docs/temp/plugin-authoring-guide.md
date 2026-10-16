# Plugin authoring guide (temporary reference)

Working notes for building plugins in this marketplace. Distilled from the official
Claude Code docs (Oct 2026, CLI ~2.1.28x) plus community reports. Items marked
**(verify)** were not confirmed against the docs — check before relying on them.
Short rules for PRs live in [`CONTRIBUTING.md`](../../CONTRIBUTING.md); this file is the
"why" and the detail behind them.

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

- Every component is namespaced by the plugin name: skill `review` in plugin `devdigest`
  runs as `/devdigest:review`, agent `x` appears as `devdigest:x`.
- A `CLAUDE.md` inside a plugin is **not loaded** — put standing instructions in a skill.
- Default directories are discovered automatically; you only list paths in `plugin.json`
  for non-default locations. `skills`, `hooks`, `mcpServers` **add to** the defaults;
  `commands`, `agents`, `outputStyles` **replace** the default directory.
- Do not add a top-level `bin/` (files go on the Bash PATH, and claude.ai org sync rejects
  it). Use `scripts/` and call them via `${CLAUDE_PLUGIN_ROOT}`.

## 2. `plugin.json`

```json
{
  "name": "devdigest",
  "version": "0.2.0",
  "description": "What the plugin does, in one line",
  "author": { "name": "DmytrivDev" },
  "homepage": "https://github.com/DmytrivDev/DevDigest-AI-Marketplace",
  "keywords": ["code-review"]
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
description: Reviews a pull request diff for correctness bugs and grounds every finding in a file and line. Use when the user asks to review a PR, a diff or a branch, or mentions DevDigest findings.
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
- Plugin agents may not support every frontmatter key a project agent does (for example
  agent-level hooks, MCP servers, permission mode) **(verify)** — keep plugin agents simple.

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
    "devdigest": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/mcp-server.mjs"],
      "env": { "DEVDIGEST_API_URL": "${user_config.api_url}" }
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
  `claude plugin update devdigest@devdigest-marketplace`, or enable auto-update in `/plugin`.
- Tag releases with `claude plugin tag --push` → `<plugin>--v<version>`; it checks that
  versions agree and the tree is clean.
- A running session keeps the old version until `/reload-plugins`.
- Renaming a plugin breaks users' `enabledPlugins`. Avoid it; if needed, add the old name to
  `renames` in `marketplace.json` (`null` = removed).

## 9. Develop and test

```bash
claude --plugin-dir ./plugins/devdigest      # load for one session, edits apply after /reload-plugins
node scripts/validate.mjs                    # manifests + claude plugin validate --strict
node scripts/validate.mjs --install          # + real install in a throwaway config dir
claude plugin details devdigest              # what components actually loaded
```

- `/plugin` → **Errors** tab shows load errors (`path escapes plugin directory`,
  `conflicting manifests`, …).
- Behaviour tests: `claude plugin eval ./plugins/devdigest` (cases in `evals/<case>/`
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

## 11. Porting DevDigest's existing `.claude/` artifacts

The dev-digest repo already has skills and agents under `.claude/`. When moving one into
`plugins/devdigest/`:
- Copy every file it reads (references, scripts, templates) **into the plugin**; repo
  paths like `docs/…`, `INSIGHTS.md`, `scripts/…` will not exist after install.
- Replace hard-coded paths with `${CLAUDE_PLUGIN_ROOT}/…` (bundled) or
  `${CLAUDE_PROJECT_DIR}/…` (the user's repo — and handle it being absent).
- Instructions that lived in `CLAUDE.md` become a skill.
- Hooks written as `.sh` → rewrite as Node exec-form hooks.
- The `mcp/` server uses pnpm — ship an npm lockfile or a bundled build.
- Re-check the description: inside a plugin it competes with every other installed skill.

## 12. Pre-PR checklist

- [ ] Entry `name` = `plugin.json` `name`; no reserved prefix
- [ ] `version` bumped in `plugin.json`, absent from `marketplace.json`
- [ ] Nothing referenced outside `plugins/<name>/`
- [ ] Hooks in exec form, scripts in Node, `${CLAUDE_PLUGIN_ROOT}` paths
- [ ] No secrets; config via `userConfig`
- [ ] Every skill/agent description says what + when, with trigger words
- [ ] Plugin `README.md` lists components and usage examples
- [ ] `node scripts/validate.mjs --install` passes
- [ ] Tried it with `claude --plugin-dir` on a real task
