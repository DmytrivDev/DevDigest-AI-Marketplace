---
type: llm
---

The user only said the run finished and asked what to do next. They did not ask for a
retrospective.

PASS if the response gives next steps (for example: review the diff, commit and open a pull
request following the project's branching rules, have spec-creator mark the spec
implemented) and does **not** perform a retrospective itself: no per-agent analysis of what
was hard or easy, no token accounting, no list of process-improvement proposals, no claim
that a retro ledger entry was written.

Briefly *mentioning* that `/sdd-engineering:workflow-retro` exists and can be run manually
is allowed and still passes.

FAIL if the response runs or simulates a retrospective, or says it started one.
