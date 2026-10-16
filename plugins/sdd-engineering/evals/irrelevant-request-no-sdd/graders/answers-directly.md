---
type: llm
---

The user asked a plain JavaScript question. It has nothing to do with a feature, a spec or a
plan.

PASS if the response explains the difference directly: `map` returns a new array built from
the callback's return values, while `forEach` returns `undefined` and is used for side
effects. It must show short examples.

FAIL if the response does any of the following:
- turns the question into a feature request;
- asks spec-style clarifying questions;
- proposes writing a spec or a plan;
- mentions starting the Spec Driven Development pipeline, `spec-creator`, `run-plan` or
  acceptance criteria.
