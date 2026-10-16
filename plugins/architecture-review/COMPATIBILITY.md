# Compatibility — architecture-review

**Claude Code:** `>=2.1.110`

| | |
|---|---|
| Minimum Claude Code | `2.1.110` — needed for version-constrained plugin `dependencies` |
| Tested with | Claude Code `2.1.301` on Windows 11 |
| Operating systems | Windows, macOS, Linux |
| Other requirements | none — one agent, no scripts, hooks or MCP servers |

## Features this plugin relies on

- Plugin subagents, dispatched as `architecture-review:architecture-reviewer`.
- Dependency `engineering-paved-path` `^1.0.0` (version-constrained `dependencies`, Claude Code `>=2.1.110`).
- Preloading another plugin's skills through the agent's `skills:` field with namespaced names. This is not described in the docs. If it does not resolve, the agent loads the skills through the `Skill` tool instead.

If you use a newer Claude Code feature in this plugin, add it here and raise the minimum
version to the release that introduced it, citing the official changelog or docs.

## Checking your setup

```bash
claude --version
claude plugin list --json
```

`claude plugin list --json` must show the plugin `enabled`, with no `dependency-unsatisfied`,
`range-conflict` or `no-matching-tag` errors.
