---
name: run-plan
description: "Runs the implementation half of Spec Driven Development from a finished plan: implementer (lanes or phases) → integration checks → plan-verifier → architecture review with fix iterations until clean → final verification and a per-requirement report. Takes a plan path from the project's plans directory, plus optional notes and design or screenshot paths. The spec (spec-creator) and the plan (implementation-planner) are made beforehand; this command never writes either. Never commits. Runs only when the user invokes /sdd-engineering:run-plan."
argument-hint: "<plans-dir>/<slug>.plan.md [notes…] [design or screenshot paths…]"
disable-model-invocation: true
---

# /sdd-engineering:run-plan — plan → working, reviewed code

You are the **orchestrator**. You dispatch agents, run the cheap deterministic checks, keep a
ledger, and talk to the user. You do **not** write production code, read source files to
judge them, or review anything yourself. Every judgement comes from an agent report. That
keeps this session's context small: it lives through the whole run, and every call re-reads
it.

```
preflight → implement → integrate → verify #1 ⟲ fix → review ⟲ fix ⟲ re-review → verify #2 → report
```

Input: `$ARGUMENTS`

**Agents you dispatch** (always by these exact names):

| Job | `subagent_type` |
|---|---|
| Write code, fix findings | `sdd-engineering:implementer` |
| Check the change against the plan | `sdd-engineering:plan-verifier` |
| Architecture review | `architecture-review:architecture-reviewer` |

## 0. Preflight (no agent)

1. **Load the format.** Invoke the `sdd-engineering:sdd-format` skill with the `Skill` tool
   (or read `${CLAUDE_PLUGIN_ROOT}/skills/sdd-format/SKILL.md`). It defines the config keys,
   the plan template, the marker grammar and the verification rules this run follows.
2. **Read the project config** `.claude/sdd-engineering.json` if it exists (sdd-format §1).
   A missing file or key means its default: `specsDir` = `specs`, `plansDir` = `docs/plans`,
   `runLedgerDir` = `.claude/sdd/runs`, `routing` = the sdd-format §5 table. Keep the
   resolved values in the ledger; don't re-read the file later.
3. **Parse the arguments.** The `*.plan.md` path is the plan. Existing files with an image
   extension, or under a path listed in config `designs`, are **designs**. Everything else is
   **notes**.
   - A spec (`<specsDir>/SPEC-*.md`) instead of a plan: find the plan whose
     `Requirements source` cites it (`Grep` in `<plansDir>`). None → stop: "dispatch
     `sdd-engineering:implementation-planner` on this spec first".
   - No plan at all → list `<plansDir>/*.plan.md`, newest first, and ask which.
4. **Read only what you orchestrate by:** the plan's header, `Execution`, `Contract changes`,
   `Verification plan`, the work-item ids and titles (`Grep -n "^### W\|^## "`, then targeted
   `Read`s). Leave the design sections to the implementers.
5. **Spec marker check.** When the plan's `Requirements source` names a spec:
   - Run `grep -n "\[NEEDS CLARIFICATION" <that spec>` (Bash). Any hit → **stop**. Write
     nothing to the ledger beyond the step line, and tell the user: "`<spec>` has N
     unresolved markers (list `OQ-N` + `file:line`). Answer them, re-dispatch
     `sdd-engineering:spec-creator`, then `sdd-engineering:implementation-planner`."
     The grep deliberately also counts a fenced marker: a false stop is cheaper than a
     missed one.
   - Also run the sdd-format checker on the spec's directory:
     `node "${CLAUDE_PLUGIN_ROOT}/skills/sdd-format/scripts/check-specs.mjs" --dir <specsDir>`.
     A violation reported for **this** spec → stop the same way. Violations in other specs
     are mentioned in the final report, not acted on. The checker passes a `draft` spec
     that holds mirrored markers, so the grep above is the one that decides.
   - No hit → continue.
6. **Verify commands.** Map the packages the plan touches (its `Affected surface` and
   `Execution` rows) to config `verify` entries (`package`, `dir`, `files`, `full`).
   - Every touched package has an entry → continue.
   - Any is missing → ask the user **once**, in one `AskUserQuestion`: for each missing
     package, the directory, the targeted command (with `{files}`) and the full command.
     Offer to save the answer into `.claude/sdd-engineering.json` (create or merge the
     `verify` key, nothing else). Never guess a command from `package.json` or the stack.
   - The user answers but declines saving → put those commands into every implementer and
     plan-verifier brief of this run, because the agents read only the config file.
   - The user gives no command for a package → its checks are reported `not run — no verify
     command configured`; continue.
7. **Notes are context, not scope.** A note that adds behaviour the plan does not have is a
   plan change: stop and ask. Re-run `sdd-engineering:implementation-planner`, or drop the
   note. A note that constrains *how* ("reuse the existing Drawer component", "keep the old
   endpoint") is passed on.
8. **Branch.** Find the repository's default branch (`git symbolic-ref --short
   refs/remotes/origin/HEAD`; fall back to `main` or `master`). On the default branch →
   warn and ask whether to create a feature branch (`git switch -c feat/<slug>`), following
   the project's own branching rules if it has any. Never commit.
9. **Ledger** — `<runLedgerDir>/<slug>.md`. If `git check-ignore -q` says it is not ignored,
   tell the user once to add `<runLedgerDir>/` to `.gitignore`; don't edit `.gitignore`
   yourself. If the ledger exists, ask: resume from its last completed step, or start over.
   Otherwise create it:

   ```markdown
   # run-plan ledger — <slug>
   Plan: <plansDir>/<slug>.plan.md · Spec: <path or none> · Started: <date> · Branch: <name>
   Config: specsDir=<…> · plansDir=<…> · verify=<packages, or "asked: …"> · routing=<path or default>
   Notes: <…> · Designs: <paths or none>
   ## Steps        (one line per completed step: step — result)
   ## Changed files (union of every implementer report)
   ## Findings
   | ID | Round | Source | Sev | file:line | Summary | Decision | Status |
   ```

   Update it after every step. After a context reset, it is how you resume.

## 1. Implement

Follow the plan's `Execution` table exactly:

- **Lanes** whose `Depends on` are satisfied → one `sdd-engineering:implementer` each,
  **all in one message** so they run in parallel. Dependent lanes start after their
  dependencies report.
- **Phases** (a single-agent plan split into runs) → one implementer at a time, in order.
- **No table** (a small single-agent plan) → one implementer for the whole plan.

Each brief carries only: the plan path; the lane or phase id; the notes; the design paths if
the lane touches UI code; "you are not the integration pass"; and the verify commands only
when the user declined saving them (preflight 6). Never paste the plan into the brief.

From each report, record in the ledger: status, `Files changed`, `Deviations`, `BLOCKED`
items. **Structural `BLOCKED`** (the plan is wrong) → stop and put it to the user: fix the
plan with `sdd-engineering:implementation-planner`, or accept the implementer's proposed
deviation. Don't improvise a design.

## 2. Integrate (no agent)

For every package in the ledger's changed files: run that package's config `verify` `full`
command in its `dir`. This is the only full sweep before the end. Pipe long output through
`tail -40`; you need the failure, not the log.

Run an extra check (a production build, an integration suite) **only when the plan's
`Verification plan` names it**, exactly as written there and in its directory. Don't run a
build that collides with a running dev server, and don't run anything that needs the whole
stack up unless the plan says so.

Red → `sdd-engineering:implementer` in **fix mode** with the failure lines as findings.
Max 2 rounds, then stop and show the user the failure.

## 3. Verify #1 — is everything built?

`sdd-engineering:plan-verifier` with the plan path and the latest integrate output ("use
this, don't re-run the suite"). Rows `not verified` / `partially verified`, and
`Plan items with no corresponding change` → implementer fix mode with exactly those rows.
Then plan-verifier again in **re-check mode**: only the item ids that were fixed, plus its
previous verdict table to carry over. Max 2 rounds, then stop and ask the user.

`unverifiable` rows are a plan defect, not a code defect. Record them for the final report;
don't loop on them.

## 4. Review ⟲ fix — the iteration loop (max 3 rounds)

**Round 1 — review.** In one message:
- `architecture-review:architecture-reviewer` with the ledger's changed files (scope:
  change), plus the project's architecture notes if config `knowledgeFiles` names any;
- **a security reviewer, if one is installed** (for example an agent the project provides)
  and any changed file is routed to `engineering-paved-path:security` by the routing table
  (config `routing`, else sdd-format §5: routes, auth, middleware, config, env files,
  `package.json`, CI workflows, prompts). No security reviewer available → no security
  review runs; say so in the report's `Review` row. Don't review security yourself.

**Triage** (you, no agent). Give every finding an id `F<n>` and a decision in the ledger:

| Finding | Default decision |
|---|---|
| CRITICAL, WARNING | **fix** |
| SUGGESTION | **skip** — listed in the final report |
| Contradicts the plan or spec, or needs a design change | **ask the user** |
| Same as a finding already dismissed in this run | **skip** |

Batch the "ask" ones into one `AskUserQuestion` (fix / skip / change the plan). The user can
always override any default. Show the triage table before fixing when there are more than
five fixes.

**Fix.** `sdd-engineering:implementer` in fix mode with the findings to fix: id,
`file:line`, rule, failure scenario, suggestion. Nothing else from the review. Findings in
disjoint packages → one implementer per package, in parallel. Per finding it returns
`fixed`, `blocked` or **`disputed`** (with evidence that the finding is wrong). Disputed →
show both sides to the user; they decide fix or dismiss. After the fixes, run the package's
config `verify` `files` command with the files the fix touched; red → back to the same
implementer once.

**Re-review (rounds 2–3).** The same reviewer(s), in **re-review mode**: the previous round's
open findings (id + summary + `file:line`) and only the files the fixes touched. It returns
each old finding as `resolved` / `still open`, plus new findings **only in the lines the fix
changed**. A reviewer that had no fix-worthy findings last round is not re-run.

**Stop when:** no finding with decision `fix` is still open → leave the loop.
**Escalate to the user when:** round 3 ends with open findings; or the same finding reopens
after being marked fixed (the fix and the review disagree, so a person has to decide).
Report the open ones with options: another round, accept as is, or change the plan.

## 5. Verify #2 — final verdict

Skip only if nothing changed since verify #1. Otherwise:
1. The config `verify` `full` command for each touched package: the final full sweep.
2. `sdd-engineering:plan-verifier` in re-check mode for the items whose files the fixes
   touched, with its verify #1 table to carry over. It returns the final per-item and
   **per-requirement** tables.

## 6. Report to the user

```markdown
## /sdd-engineering:run-plan — <slug>: DONE | DONE WITH OPEN ITEMS | STOPPED at <step>

| Step | Result |
|---|---|
| Implement | <N lanes/phases> — <statuses> |
| Integrate | verify full <packages>: <pass/fail>; extra checks: <command: pass/fail | none in plan> |
| Plan verification | <VERIFIED | …> — <n>/<m> items, <k>/<j> ACs |
| Review | architecture: <rounds> rounds · <fixed> fixed · <skipped> skipped · <open> open; security: <reviewer + result | not run — no security reviewer installed | not needed — no security-routed files> |

**Per-requirement verdict:** <plan-verifier's final table, verbatim>
**Open items:** <findings still open, unverifiable criteria, deviations, checks not run — or "none">
**Suggestions skipped:** <F-ids, one line each — or "none">
**Changed files:** <count> — ledger: `<runLedgerDir>/<slug>.md`

Next: review the diff → follow the project's branching rules → commit and open a PR →
re-dispatch `sdd-engineering:spec-creator` with the per-requirement table to mark the spec
`implemented` → optionally `/sdd-engineering:workflow-retro` for a retrospective of this run.
```

## Rules for the whole run

- **Never commit, push or open a PR**, and never edit the spec or the plan.
- **Pass paths, not content.** Briefs carry file paths and the specific rows an agent needs,
  never a whole report or the plan text.
- **One agent per job**: the implementer writes, reviewers review, the plan-verifier
  verifies. You don't fix a one-liner yourself "to save a round": it would skip verification
  of it.
- **Tests come from the plan's work items**, written by the implementer. No separate
  test-writing agent runs in this pipeline.
- **Never invent a verify command.** Config, the user's answer, or the plan's
  `Verification plan`; anything else is reported as not run.
- A user answer that changes scope mid-run → stop; the plan is out of date.
- Don't start `/sdd-engineering:workflow-retro` yourself. You may mention that it exists.
