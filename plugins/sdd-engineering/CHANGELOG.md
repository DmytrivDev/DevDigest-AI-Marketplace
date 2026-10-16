# Changelog

All notable changes to `sdd-engineering` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this plugin
uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-10-16

First release: the Spec Driven Development pipeline, spec → plan → run → verify → retro.

### Added

- Agent `sdd-engineering:spec-creator` (Opus): two-pass feature specs with EARS acceptance
  criteria, edge cases, NFRs, provenance and a traceability matrix; `[NEEDS CLARIFICATION]`
  markers for undecided points (at most 3 per spec); status flips only on the user's word.
- Agent `sdd-engineering:implementation-planner` (Opus): one plan per feature with affected
  files, routed stack skills, contract changes, work items with checkable `Done means`,
  single-agent phases or multi-agent lanes, and a verification plan. Refuses a spec that holds
  a marker.
- Agent `sdd-engineering:implementer` (Sonnet): executes a plan, a lane, a phase, or a list of
  findings (fix mode, with `disputed` answers); runs only the configured checks; never commits.
- Agent `sdd-engineering:plan-verifier` (Sonnet): read-only, one verdict row per work item and
  one per requirement, with re-check mode.
- Skill `/sdd-engineering:run-plan` (manual only): orchestrates preflight → implement →
  integrate → verify ⟲ fix → architecture review ⟲ fix → final verify → report, with a
  resumable run ledger.
- Skill `/sdd-engineering:workflow-retro` (manual only): retrospective of a multi-agent run,
  in-context or `deep` from session transcripts, appended to an append-only retro ledger.
- Skill `/sdd-engineering:engineering-insights` (main session only): captures durable,
  non-obvious learnings into the project's knowledge file for the touched area (config
  `knowledgeFiles`) under seven fixed sections; reads first, dedups, appends through a
  script that refuses to change existing lines, and rebuilds a line-numbered index.
- Skill `sdd-engineering:sdd-format`: the shared contract — project config
  `.claude/sdd-engineering.json`, spec and plan templates, marker grammar with a bundled
  checker, default skill-routing table, verification rules.
- Skill `sdd-engineering:mermaid-diagram`: diagram guide and templates, preloaded into
  `spec-creator`.
- Evals: five `claude plugin eval` cases for the pipeline's guard rails (Pass 1 writes no
  file, planner refuses a marker, one verdict row per item, `run-plan` preflight stops on a
  marker, the retro is never auto-triggered).
- `COMPATIBILITY.md`: minimum Claude Code version and the features the plugin relies on.
- Negative eval case `irrelevant-request-no-sdd`: an everyday coding question must not start the pipeline.

### Dependencies

- `engineering-paved-path` `^1.0.0` — stack skills routed to plans, implementers and reviews.
- `research-tools` `^1.0.0` — `research-tools:researcher` for the spec and the plan.
- `architecture-review` `^1.0.0` — `architecture-review:architecture-reviewer` for the review
  step of `run-plan`.

[1.0.0]: https://github.com/DmytrivDev/DevDigest-AI-Marketplace/releases/tag/sdd-engineering--v1.0.0
