# Compatibility — research-tools

**Claude Code:** `>=2.1.110`

| | |
|---|---|
| Minimum Claude Code | `2.1.110` — needed for version-constrained plugin `dependencies` |
| Tested with | Claude Code `2.1.301` on Windows 11 |
| Operating systems | Windows, macOS, Linux |
| Other requirements | none — one agent, no scripts, hooks or MCP servers |

## Features this plugin relies on

- Plugin subagents, dispatched as `research-tools:researcher`.
- `WebSearch` and `WebFetch` tools for external research. Where they are disabled, the agent reports external questions as not established.
- No dependencies on other plugins.

If you use a newer Claude Code feature in this plugin, add it here and raise the minimum
version to the release that introduced it, citing the official changelog or docs.

## Checking your setup

```bash
claude --version
claude plugin list --json
```

`claude plugin list --json` must show the plugin `enabled`, with no `dependency-unsatisfied`,
`range-conflict` or `no-matching-tag` errors.
