# DevDigest AI Marketplace

Claude Code plugin marketplace for DevDigest — homework and lab for the final
course lesson on building marketplaces and development plugins.

## Install

In a Claude Code session:

```
/plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace
/plugin install devdigest@devdigest-marketplace
```

Or from a shell:

```bash
claude plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace
claude plugin install devdigest@devdigest-marketplace
```

Auto-update is off by default for third-party marketplaces; turn it on in
`/plugin` → Marketplaces.

## Plugins

| Plugin | Description |
|---|---|
| [devdigest](plugins/devdigest/) | DevDigest review workflow: skills, agents, hooks and MCP server |

## Layout

```
.claude-plugin/marketplace.json   # catalog: name, owner, plugins[]
plugins/<name>/                   # one self-contained directory per plugin
scripts/                          # repo maintenance tooling — not shipped with any plugin
```

## Development

Validate the marketplace and every plugin, then install each one in a throwaway
Claude config dir:

```bash
node scripts/validate.mjs --install
```

Drop `--install` for the fast manifest-only pass.

Load a plugin for one session without installing it:

```bash
claude --plugin-dir ./plugins/devdigest
```

## Rules

Full contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md).

- Plugin `name` in `marketplace.json` must equal `name` in its `plugin.json`.
- Set `version` only in `plugin.json`, and bump it on every release.
- Relative sources start with `./` and never contain `..`.
- A plugin directory is copied on install — it must not reference files outside itself.
- Hooks use exec form (`"command": "node"`, `"args": [...]`) so they work on Windows.
