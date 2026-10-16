# Compatibility — engineering-paved-path

**Claude Code:** `>=2.1.110`

| | |
|---|---|
| Minimum Claude Code | `2.1.110` — needed for version-constrained plugin `dependencies` |
| Tested with | Claude Code `2.1.301` on Windows 11 |
| Operating systems | Windows, macOS, Linux |
| Other requirements | none — skills only, no scripts, hooks or MCP servers |

## Features this plugin relies on

- Plugin skills, invoked as `/engineering-paved-path:<skill>` or loaded automatically from their description.
- No dependencies on other plugins. `architecture-review` and `sdd-engineering` depend on this plugin with the range `^1.0.0`.

If you use a newer Claude Code feature in this plugin, add it here and raise the minimum
version to the release that introduced it, citing the official changelog or docs.

## Checking your setup

```bash
claude --version
claude plugin list --json
```

`claude plugin list --json` must show the plugin `enabled`, with no `dependency-unsatisfied`,
`range-conflict` or `no-matching-tag` errors.
