# Contributing

This repo is a Claude Code plugin marketplace. Plugins installed from it run
code and hooks on users' machines, so every change is reviewed by the owners in
[`CODEOWNERS`](CODEOWNERS).

## Add a plugin

1. Create a self-contained directory `plugins/<name>/`:

   ```
   plugins/<name>/
   ├── .claude-plugin/plugin.json   # manifest only — nothing else goes in .claude-plugin/
   ├── skills/<skill>/SKILL.md
   ├── agents/*.md
   ├── hooks/hooks.json             # events wrapped in a top-level "hooks" key
   ├── scripts/
   ├── .mcp.json
   └── README.md                    # what it does, its components, usage examples
   ```

2. Write `plugin.json` with at least `name`, `version`, `description` and `author`.
3. Add an entry to `.claude-plugin/marketplace.json`:

   ```json
   {
     "name": "<name>",
     "source": "./plugins/<name>",
     "description": "One line on what the plugin does"
   }
   ```

4. Add the plugin to the table in [`README.md`](README.md) and an owner line to
   [`CODEOWNERS`](CODEOWNERS).

## Rules

**Names**
- The entry `name` in `marketplace.json` equals `name` in the plugin's `plugin.json`.
- Plugin names are kebab-case and never start with `claude-`, `anthropic-` or `cc-plugin-`.
- Treat a published name as permanent. To change how it is shown, set `displayName`;
  to rename or remove a plugin, add it to the `renames` map in `marketplace.json`.

**Versions**
- `version` lives only in `plugin.json` — never in the marketplace entry.
- Bump it in every PR that changes a plugin. Users do not receive new commits
  until the version string changes.

**Self-contained plugins**
- A plugin is copied into the Claude Code cache on install. Never reference files
  outside its directory (`../`, repo-root `docs/`, shared scripts).
- Reference bundled files as `${CLAUDE_PLUGIN_ROOT}/...`; keep state that must survive
  updates in `${CLAUDE_PLUGIN_DATA}`.
- `CLAUDE.md` inside a plugin is not loaded — put instructions in a skill.
- Use forward slashes in every path.

**Hooks and scripts**
- Use exec form so hooks work on Windows, macOS and Linux:
  `"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/x.mjs"]`.
- Don't call `.cmd` / `.bat` shims from exec form.
- Keep hooks small and readable — reviewers must be able to see everything they do.

**Dependencies and secrets**
- Node dependencies install only from `package-lock.json`, `npm-shrinkwrap.json`
  or `bun.lock`; `pnpm-lock.yaml` and `yarn.lock` are ignored.
- No secrets in the repo. Ask for keys through `userConfig` with `"sensitive": true`
  and reference them as `${user_config.KEY}`.
- External plugin sources (`github`, `git-subdir`, `url`) pin both `ref` and a
  full 40-character `sha`.

## Before opening a PR

```bash
claude plugin validate . --strict
claude plugin validate ./plugins/<name> --strict
```

`validate` does not catch a missing `source` directory, so also run the install loop
from your checkout:

```bash
claude plugin marketplace add ./
claude plugin install <name>@devdigest-marketplace
```

During development, load a plugin for one session without installing it:

```bash
claude --plugin-dir ./plugins/<name>
```

## Pull requests

- One plugin or one concern per PR.
- Describe what changed, which version you bumped to, and paste the `validate` output.
- Changes to `.claude-plugin/marketplace.json` and `CODEOWNERS` always need the
  repo owner's review.
