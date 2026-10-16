# Changelog

All notable changes to this plugin are documented in this file. The format follows Keep a
Changelog 1.1.0, and versions follow Semantic Versioning 2.0.0.

## [1.0.0] — 2026-10-16

### Added

- Agent `architecture-review:architecture-reviewer` (Sonnet, read-only): reviews a change,
  a named area or a fix (re-review mode) against `engineering-paved-path:onion-architecture`
  and `engineering-paved-path:frontend-ui-architecture`, preloaded and loaded through the
  `Skill` tool when missing.
- Severity scale CRITICAL / WARNING / SUGGESTION, where CRITICAL must name its mechanism,
  and a fixed report shape: `Scope reviewed`, `Findings`, `Checked and clean`,
  `Not checked`, `Out of scope — noticed`.
- Project inputs from `.claude/sdd-engineering.json`: `routing` decides which skill governs
  which file, and `knowledgeFiles` supplies project rules and recorded debt, which is not
  reported unless the change adds to it.
- Four eval cases for `claude plugin eval`: `benign-rename`, `checkout-layering`,
  `checkout-scope-discipline` and `core-validation-gate`.
- Dependency on `engineering-paved-path` `^1.0.0`.
