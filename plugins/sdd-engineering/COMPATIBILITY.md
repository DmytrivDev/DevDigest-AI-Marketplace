# Compatibility — sdd-engineering

**Claude Code:** `>=2.1.110`

| | |
|---|---|
| Minimum Claude Code | `2.1.110` — needed for version-constrained plugin `dependencies` |
| Tested with | Claude Code `2.1.301` on Windows 11 |
| Operating systems | Windows, macOS, Linux |
| Other requirements | Node.js `>=18` on `PATH` for the bundled scripts (`check-specs.mjs`, `collect-run.mjs`, `append-ledger.mjs`, `engineering-insights` scripts) |

## Features this plugin relies on

- Dependencies `engineering-paved-path`, `research-tools` and `architecture-review`, each `^1.0.0` (version-constrained `dependencies`, Claude Code `>=2.1.110`).
- Plugin subagents with `model`, `maxTurns`, `tools` and `skills` frontmatter.
- Skills with `disable-model-invocation: true` (`run-plan`, `workflow-retro`, `sdd-status`), which only run when you invoke them.
- The `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PLUGIN_ROOT}` substitutions for bundled scripts.
- The same namespaced `skills:` preload and `Skill`-tool fallback as `architecture-review`.
- `claude plugin eval` for the cases in `evals/`.

If you use a newer Claude Code feature in this plugin, add it here and raise the minimum
version to the release that introduced it, citing the official changelog or docs.

## Checking your setup

```bash
claude --version
claude plugin list --json
```

`claude plugin list --json` must show the plugin `enabled`, with no `dependency-unsatisfied`,
`range-conflict` or `no-matching-tag` errors.
