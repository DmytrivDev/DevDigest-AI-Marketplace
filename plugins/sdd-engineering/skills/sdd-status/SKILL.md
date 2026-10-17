---
name: sdd-status
description: "Shows the state of the Spec Driven Development pipeline in this project: the ACTIVE sdd-engineering version (read from the installed plugin's own manifest, so it proves which copy is running), whether the project config exists, specs by status with open [NEEDS CLARIFICATION] markers, plans, configured verify commands, the plugin's dependencies, and the one next step. Read-only. Manual only: runs when the user invokes /sdd-engineering:sdd-status."
argument-hint: ""
disable-model-invocation: true
allowed-tools: Read, Glob, Grep
---

# /sdd-engineering:sdd-status — where the pipeline stands, and which plugin version is running

**Read-only.** You only read files: never write, never run a shell, never dispatch an agent.
Answer in the format below and nothing else, then stop.

## 1. Active plugin version

Read `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`. This is the manifest of the copy of
`sdd-engineering` that is running right now, so its `version` is the active version. From it,
take `name`, `version` and `dependencies`.

- **Path.** Show the path you read, with forward slashes. It contains the cache directory and
  the version, which is the trace a reviewer can check.
- **Unreadable manifest.** If the file cannot be read, write `version unknown` and say why.
  Never guess a version.

## 2. Project state

Use the rules of the `sdd-engineering:sdd-format` skill, §1–§3. Load it with the Skill tool if
it is not already in your context.

1. **Config.** Read `.claude/sdd-engineering.json` in the project root. Missing file → every
   key takes its default (`specsDir` = `specs`, `plansDir` = `docs/plans`, no `verify`).
2. **Specs.** `Glob` `<specsDir>/SPEC-*.md` (top level only).
   - For each file, read its `Status:` line. Count the specs per status: `draft`, `approved`,
     `implemented`.
   - A spec with a `Superseded by:` line counts as `superseded` instead.
3. **Markers.** Run `Grep -c "\[NEEDS CLARIFICATION:"` on each spec. Report the total, and in
   how many specs it occurs.
4. **Plans.** `Glob` `<plansDir>/*.plan.md` and count them.
5. **Verify.** List the `package` names from the config's `verify` entries, or write
   `not configured`.

## 3. Output — exactly this shape

```
sdd-engineering <version> · active copy: <path you read in step 1>
Config: .claude/sdd-engineering.json (found) | .claude/sdd-engineering.json (not found — defaults)
Specs (<specsDir>): <total> — draft <n> · approved <n> · implemented <n> · superseded <n>
Open markers: <total> in <k> spec(s)
Plans (<plansDir>): <count>
Verify: <package, package> | not configured — /sdd-engineering:run-plan will ask
Dependencies: <name> <range> · <name> <range> · …
Next: <one step>
```

Pick the `Next:` step by the first rule that applies:

1. Open markers > 0 → `answer OQ-… in <spec file>, then re-run sdd-engineering:spec-creator`.
2. An `approved` spec with no plan that cites it → `sdd-engineering:implementation-planner`
   on that spec.
3. A plan whose spec is not `implemented` → `/sdd-engineering:run-plan <plan path>`.
4. No specs → `sdd-engineering:spec-creator` with your first feature.
5. Otherwise → `nothing pending`.

Use numbers, not adjectives. A count that is 0 is written as `0`, never left out.
