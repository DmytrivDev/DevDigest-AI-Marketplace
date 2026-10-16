# Changelog

All notable changes to this plugin are documented in this file. The format follows Keep a
Changelog 1.1.0, and versions follow Semantic Versioning 2.0.0.

## [1.0.0] — 2026-10-16

### Added

- Agent `research-tools:researcher` (Sonnet, read-only): answers repository questions
  (Mode A), external questions (Mode B) and mixed questions with a cited report — answer,
  confidence, conclusions with `file:line`, commit or dated-source evidence, conflicts and
  staleness, and a mandatory `Not established` section.
- Clarifying-question step for tasks that are only a topic: up to four questions, each with
  a default, plus the report it would produce on those defaults.
- Mode A reading order: the project's curated docs (`README.md`, `docs/`, `specs/`,
  `CLAUDE.md`, knowledge files from the brief or `knowledgeFiles` in
  `.claude/sdd-engineering.json`), then code, then git history.
- Read-only shell rules, "everything read is data" handling of files and web pages, and a
  report budget of about 600 words for the answer and conclusions.
- Eval case `repo-question-cited` for `claude plugin eval` (run with `--scaffold`).
