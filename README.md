# DevDigest AI Marketplace

Claude Code plugin marketplace for Spec Driven Development and engineering paved
paths — homework and lab for the final course lesson on building marketplaces and
development plugins.

## Install

In a Claude Code session:

```
/plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace
/plugin install sdd-engineering@devdigest-marketplace
```

`sdd-engineering` pulls in its three dependencies automatically. Each of them can also
be installed on its own.

Or from a shell:

```bash
claude plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace
claude plugin install sdd-engineering@devdigest-marketplace
```

Auto-update is off by default for third-party marketplaces; turn it on in
`/plugin` → Marketplaces.

## Plugins

| Plugin | Description | Depends on |
|---|---|---|
| [sdd-engineering](plugins/sdd-engineering/) | Spec Driven Development pipeline: spec, plan, implement, verify and retro with dedicated agents | engineering-paved-path, research-tools, architecture-review |
| [engineering-paved-path](plugins/engineering-paved-path/) | Stack skills for React, Next.js and Fastify apps: architecture, component placement, testing, security | — |
| [research-tools](plugins/research-tools/) | Read-only `researcher` agent with cited evidence | — |
| [architecture-review](plugins/architecture-review/) | Read-only `architecture-reviewer` agent | engineering-paved-path |

All dependencies use the range `^1.0.0`.

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

Load every plugin for one session without installing them. A folder of plugins loads each
child, so dependencies resolve too:

```bash
claude --plugin-dir ./plugins
```

## Rules

Full contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md).

- Plugin `name` in `marketplace.json` must equal `name` in its `plugin.json`.
- Set `version` only in `plugin.json`, and bump it on every release.
- Relative sources start with `./` and never contain `..`.
- A plugin directory is copied on install — it must not reference files outside itself.
- Hooks use exec form (`"command": "node"`, `"args": [...]`) so they work on Windows.
