# Cost baseline

Status: **method defined, not measured yet.** Measurements are billed model calls. They run
before the `1.0.0` release and again for the one optimization below.

## Scenario

The user asks for a spec and a plan for one small feature in a sample project:

1. `sdd-engineering:spec-creator` Pass 1 (questions).
2. Pass 2 after fixed answers (the spec).
3. `sdd-engineering:implementation-planner` with the execution mode already chosen (the
   plan).

No implementation step. The feature request, the answers and the sample project are fixed and
committed with the eval set, so every run sees the same input.

## Quality gate

The run passes when all of these hold:

- The `sdd-engineering` behaviour evals pass. That includes the negative cases
  `irrelevant-request-no-sdd` and `workflow-retro-not-auto-triggered`.
- The spec is in the `sdd-format` template.
  - Every AC has exactly one **shall** and a `Verify:` line.
  - It has no implementation details.
  - It has at most 3 `[NEEDS CLARIFICATION]` markers, each mirrored.
  - `check-specs.mjs` passes.
- The plan traces every AC to a work item, invents no requirement, and has a checkable
  `Done means` for every item.
- No critical error. A critical error is any of these:
  - a file written outside `specs/` or `docs/plans/`;
  - a spec approved without the user;
  - a plan written for a spec that holds a marker.

## What to record per run

| Field | Source |
|---|---|
| Plugin versions and marketplace commit SHA | `claude plugin list --json`, `git rev-parse HEAD` |
| Model | the pinned `--model` |
| Input / output / cache-read / cache-write tokens | eval JSON (`--json`) or the session transcripts |
| API calls and tool calls | eval JSON / `/sdd-engineering:workflow-retro deep` |
| Cost (USD) and latency (wall clock) | eval JSON |
| Pass rate | quality gate above |
| Critical errors | quality gate above |

At least 3 runs per variant on the same model. Report the **median** and the spread.

## Results

| Variant | Commit | Model | Runs | Median cost | Median latency | Median tokens (in / out / cache) | Tool calls | Pass rate | Critical errors |
|---|---|---|---|---|---|---|---|---|---|
| Baseline `1.0.0` | — | — | — | — | — | — | — | — | — |
| Optimization | — | — | — | — | — | — | — | — | — |

## Optimization under test

**Remove duplicated instructions from agent prompts.** Keep the details in skill references
that load only when needed. For example, process rules that both `spec-creator` and
`implementation-planner` restate next to `sdd-format`. Change nothing else: same model, same
routing, same scenario.

**It counts only if** the quality gate stays green, no new critical false negatives appear,
and cost or latency really drops. If the difference is within run-to-run noise, write that
down. No savings are claimed without numbers.
