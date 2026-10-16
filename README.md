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
.github/workflows/validate.yml    # plugins: manifests, content rules, validate, install (every PR)
.github/workflows/pages.yml       # catalog site: test, build, deploy to GitHub Pages
plugins/<name>/                   # one self-contained directory per plugin (+ README, CHANGELOG, COMPATIBILITY)
docs/                             # PLUGIN-GUIDELINES, SECURITY, RELEASES, SITE-SPEC, COST-BASELINE
scripts/validate.mjs              # repo maintenance tooling — not shipped with any plugin
site/                             # the catalog site (Astro); builds its index from plugins/ at build time
```

The catalog is published at <https://dmytrivdev.github.io/DevDigest-AI-Marketplace/>: search
plugins, skills and agents, read their READMEs, see versions and dependencies, and copy the
install command.

| Document | What it covers |
|---|---|
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Plugin layout, manifest fields, dependency rules, checks, PR checklist |
| [`docs/PLUGIN-GUIDELINES.md`](docs/PLUGIN-GUIDELINES.md) | The reasons behind the rules: anatomy, boundaries and owners, dependencies, porting |
| [`docs/SECURITY.md`](docs/SECURITY.md) | No secrets, no absolute paths, least privilege, what to do after an unsafe release |
| [`docs/RELEASES.md`](docs/RELEASES.md) | SemVer, tags, release order, `latest` / `stable` channels, update, rollback |
| [`docs/SITE-SPEC.md`](docs/SITE-SPEC.md) | The catalog site |
| [`docs/COST-BASELINE.md`](docs/COST-BASELINE.md) | Cost and quality baseline of the SDD workflow |

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
