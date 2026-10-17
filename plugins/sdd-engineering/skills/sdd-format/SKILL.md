---
name: sdd-format
description: "Shared format of the Spec Driven Development pipeline: the project config file (.claude/sdd-engineering.json), the feature spec template with EARS acceptance criteria and verification hints, the [NEEDS CLARIFICATION] marker grammar and its checker, the implementation plan template, the default glob-to-skill routing table and how verification commands are run. Use when writing, reading, planning from or verifying a spec or a plan, or when a project's SDD paths, routing or verify commands must be resolved."
user-invocable: false
---

# SDD format — the contract between the pipeline agents

`spec-creator` writes specs, `implementation-planner` writes plans, `implementer` builds them,
`plan-verifier` checks the result, and `/sdd-engineering:run-plan` orchestrates the run. All of
them read the same rules from this skill, so that a spec, a plan and a verdict mean the same
thing at every step.

When this skill and an agent's own instructions disagree on a **format**, this skill wins.
When they disagree on a **process** (passes, budgets, write scope), the agent wins.

## 1. Project config

The pipeline reads one optional file: **`.claude/sdd-engineering.json`** in the project root.
Read it once at the start. A missing file or key means the default applies. Never write it,
except `run-plan` when the user agrees to save an answer there.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `specsDir` | string | `"specs"` | Where specs and their `README.md` index live |
| `plansDir` | string | `"docs/plans"` | Where implementation plans live |
| `verify` | array | — **(asked, never guessed)** | How to check a change, per package (below) |
| `routing` | string | none → §5 table | Path to a project routing table in the §5 format |
| `designs` | string[] | none | Design sources: mock files, exported artboards, screenshot folders |
| `knowledgeFiles` | string[] | none | Project knowledge or gotcha files. Read-only for every agent |
| `runLedgerDir` | string | `".claude/sdd/runs"` | `run-plan` ledgers. Should be gitignored |
| `retroLedger` | string | `"docs/retro/ledger.md"` | Append-only ledger of `workflow-retro` |
| `contractChecks` | array | none | Extra items for a plan's `Contract changes` section |

`knowledgeFiles` have one writer: the `sdd-engineering:engineering-insights` skill, run in the
main session when the user or that session decides, and only by appending.

`verify` entries:

```json
{ "package": "api", "dir": "services/api", "files": "npx vitest related --run {files}", "full": "npm run typecheck && npm test" }
```

- `package` is the name used in plans and reports.
- `dir` is where the commands run.
- `files` is the targeted check: `{files}` becomes the touched files, relative to `dir`.
- `full` is the whole check for that package: typecheck, the suite, and any architecture check
  the project has.

`contractChecks` entries look like this:

```json
{ "name": "OpenAPI", "question": "Does this change an endpoint's request or response?", "check": "npm run openapi:diff" }
```

A full example:

```json
{
  "specsDir": "specs",
  "plansDir": "docs/plans",
  "verify": [
    { "package": "web", "dir": "apps/web", "files": "npx vitest related --run {files}", "full": "npm run typecheck && npm test && npm run build" },
    { "package": "api", "dir": "services/api", "files": "npx vitest related --run {files}", "full": "npm run typecheck && npm test" }
  ],
  "routing": "docs/routing.md",
  "designs": ["docs/design/", "docs/screenshots/"],
  "knowledgeFiles": ["docs/gotchas.md"],
  "runLedgerDir": ".claude/sdd/runs",
  "retroLedger": "docs/retro/ledger.md",
  "contractChecks": [
    { "name": "Shared types", "question": "Does a type shared by web and api change?", "check": "npm run check:shared" }
  ]
}
```

Paths are relative to the project root and always use forward slashes.

## 2. Spec format

One spec per **feature**, across every package it touches. A spec answers **what** is built
and **how we know it works**. **How** it is built belongs in the plan (§4).

**Naming.** The file is `<specsDir>/SPEC-NN-<slug>.md`.
- `NN` is the highest existing number plus one, zero-padded to two digits.
- `<slug>` is kebab-case, e.g. `SPEC-03-checkout.md`.
- A number is never changed and never reused.

**Status lifecycle:** `draft` → `approved` → `implemented`.
- A spec is `draft` until the user approves it.
- It becomes `implemented` when `plan-verifier` reports every AC verified and the user
  confirms.
- An `approved` spec is never edited in substance. A changed decision is a new spec with
  `Supersedes: SPEC-NN`. The old spec gains only a `Superseded by: SPEC-MM` header line.
- A spec with any marker (§3) stays `draft`.

**Index.** `<specsDir>/README.md` has a `## Index` table with one row per spec:

```markdown
| Spec | Feature | Status | Packages | Supersedes |
|---|---|---|---|---|
| [SPEC-03](SPEC-03-checkout.md) | Checkout — one-page checkout with saved addresses | draft | web, api | none |
```

If the README does not exist, `spec-creator` creates it with a one-line intro and the index
table.

### Template

Every section is present, in this order. A section with nothing to say gives the reason in one
line ("None: the feature reads no external data."). It is never deleted.

```markdown
# Spec: <feature name>
Spec ID: SPEC-NN
Status: draft | approved | implemented
Supersedes: <SPEC-NN, or none>

## Problem and user
## Goals / Non-goals
## User stories
## Acceptance criteria (EARS)
## Edge cases
## Non-functional requirements
## Module interactions
## Inputs and provenance
## Untrusted inputs
## Design review
## Traceability
## Open questions
```

**Numbering.**
- Prefixes: `US-N` user stories, `AC-N` acceptance criteria, `EC-N` edge cases, `NFR-N`
  non-functional requirements.
- Numbers have no gaps and are never reused.
- Every AC and NFR is tagged with the package(s) it lands in, using the names from config
  `verify`, or the project's own names if there is no config: `AC-4 [web, api]`.

**What goes in a spec, and what goes in the plan:**

| In the spec | In the plan, not here |
|---|---|
| Workflow diagrams: user flow, feature states (Mermaid) | Files and modules to create |
| Service communication diagrams between the project's services and external systems | Function and class names |
| Contracts at a boundary: endpoint / event / tool, wire fields, required vs optional, error cases | DB tables, columns, migrations |
| Acceptance criteria, edge cases, NFRs | Libraries, algorithms, order of work |

A contract says what crosses a boundary and what the caller may rely on. Once it says how the
other side produces it, it belongs in the plan. A contract that does not exist yet is marked
**proposed**.

### Acceptance criteria — EARS

EARS stands for Easy Approach to Requirements Syntax (Mavin et al., IEEE RE'09). Specs are
written in **English**. The keywords **WHEN, WHILE, IF … THEN, WHERE** are in capitals, and
**shall** marks a mandatory requirement.

| Pattern | Shape |
|---|---|
| Ubiquitous | The system shall log every authentication attempt. |
| Event-driven | WHEN the user submits the sign-in form, the system shall validate the credentials. |
| State-driven | WHILE a sync is in progress, the system shall display its progress. |
| Unwanted behaviour | IF validation fails three times within 60 seconds, THEN the system shall temporarily lock the account. |
| Optional feature | WHERE MFA is enabled, the system shall require a TOTP code after the password. |

**Rules for every criterion:**
- One observable behaviour, so exactly one **shall**.
- Numbers instead of adjectives.
- An `IF … THEN` criterion for every failure path.
- It ends with a verification hint on its own line. The hint names the level and the
  observation, never the test file:

```markdown
**AC-3 [api]** IF the payment provider returns a timeout, THEN the system shall mark the order `payment_pending`.
Verify: integration — the order row has status `payment_pending` after a simulated timeout.
```

**Verification levels:**
- `unit`.
- `integration` — needs real infrastructure such as a database.
- `e2e` — a browser or full-stack flow.
- `manual` — only when nothing automated can observe the behaviour. Say why.

NFRs follow the same shape.

**Vague wording is rewritten until it can be checked.** Words like fast, quick, slow,
user-friendly, intuitive, easy, appropriate, reasonable, robust, seamless, properly, "as
needed" and "and/or" never survive into an AC or NFR:

| Vague | Checkable |
|---|---|
| "Should work fine on large catalogs" | WHEN a catalog exceeds 10,000 items, the system shall paginate results at 50 per page. |
| "Should not crash if the provider is down" | IF the provider call fails, THEN the system shall show the cached result together with the reason for the degradation. |
| "Search should be fast" | The system shall return search results within 300 ms at the 95th percentile for 1,000 items. |

**Other sections:**
- **Edge cases.** Every edge case points somewhere: `→ AC-7`, `→ Non-goal`,
  `→ Open question 2` or `→ OQ-N`.
- **Inputs and provenance.** A table: input · source · producer · freshness · trusted or not.
- **Untrusted inputs.** Every untrusted row maps to a handling requirement (AC or NFR):
  - never executed as instructions;
  - delimited in prompts;
  - escaped in UI;
  - size-limited;
  - validated at the boundary;
  - confined to the caller's tenant or workspace.
- **Design review.** Every finding and proposal from the spec's first pass is listed with the
  user's decision: `accepted → AC-N`, `declined → Non-goal`, or `deferred → Open question N`.
- **Traceability.** One matrix with exactly one row per AC and NFR. The `From` column is never
  empty:

```markdown
| AC / NFR | From (US / EC / design review) | Packages | Verify |
|---|---|---|---|
| AC-1 | US-1, EC-3 | api, web | integration |
```

## 3. Unresolved points — `[NEEDS CLARIFICATION]`

A point the user has not decided is marked, never assumed. The marker sits exactly where the
assumption would have gone: an AC, an NFR, a contract field, a provenance row, an edge case.
The grammar is case-sensitive:

```text
[NEEDS CLARIFICATION: OQ-<n> — <specific question>]
```

The id is `OQ-` plus digits, then a separator (`—`, `-` or `:`), then the question.

- **Mirror.** Every marker has a line under `## Open questions`:
  `OQ-<n> → <AC-/NFR-/EC- id(s)> — <question>`. The mirror line never repeats the bracketed
  marker.
- **Cap.** At most 3 marker occurrences per spec. More than 3 means no spec file is written.
- **Status.** Any marker keeps the spec `draft`.
- **Never inside a fenced code block.** The checker skips fences, so a marker there is
  invisible.
- **Deferred questions.** A question the user explicitly deferred, and that blocks no
  criterion, is a plain Open question. It has no marker, does not block approval, and does not
  count toward the cap.

**Who acts on markers:**
- `implementation-planner` refuses any spec that holds a marker.
- `/sdd-engineering:run-plan` stops in its preflight when the plan's spec holds one.

**Checker.** It is bundled with this skill. It has no dependencies and only reads files:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/sdd-format/scripts/check-specs.mjs" --dir <specsDir>
```

- It scans the top-level `SPEC-*.md` files.
- It prints `file:line: message`.
- Exit codes: `0` clean, `1` violations, `2` usage or IO error.
- It flags:
  - a marker in an `approved` or `implemented` spec;
  - a marker without an `OQ-` id;
  - an id not mirrored under `## Open questions`;
  - more than 3 markers;
  - a missing or unknown `Status:`.

An agent without a shell counts markers with `Grep -n "\[NEEDS CLARIFICATION" <spec>`.

## 4. Plan format

An implementation plan is `<plansDir>/<slug>.plan.md`, written only by
`implementation-planner`. It answers **how** the requirements get built. It never defines or
changes them.

```markdown
# Implementation plan: <feature>

**Route** — A (spec-driven) | B (no spec).
**Requirements source** — <`<specsDir>/SPEC-NN-<slug>.md` (Status: <status>), or other path(s) with line ranges, or "user request (quoted below)">.
This plan implements those requirements; it does not define or change them.
**Execution mode** — single-agent | multi-agent (<N> lanes) — chosen by the user on <date>.
**Out of scope** — <what the source excludes, plus recommendations the user declined>; architecture and security review are performed by separate agents.

## Requirements traceability
| Req | Requirement (quoted or cited) | Source | Work items | Checked by |
|---|---|---|---|---|
| AC-1 | "<…>" | `specs/SPEC-03-checkout.md:42` | W1, W3 | W3 `Done means` |

## Clarifications and recommendations   (Route B only)
- **Q1** <question> → **answer:** <user's answer, or "default accepted: <default>">
- **Rec1** <recommendation> → **accepted | declined**

## Spec follow-ups   (Route A only — omit if none)

## Affected surface
| File | New/Mod | Package | Home (ring / radius) | Skills that will govern it | Constraint to respect |
|---|---|---|---|---|---|

**Coverage gaps:** <files no routing row matches, named — or "none">

## Contract changes
- **Shared contracts / schemas:** no | yes → <which, every copy that changes in lock-step>
- **Migration:** no | yes → <which table/column; generated by the project's tool, never hand-written>
- **Seed / fixture data:** no | yes → <what it must produce>
- **Build-only failures:** no | yes → <the change typecheck and tests would miss, and the build that catches it>
- **<each config `contractChecks` item>:** no | yes → <…>

## Work items
### W1 — <short imperative title>
- **Serves:** AC-1 (or "enables AC-1, AC-2 — <why>")
- **Do:** <what changes, concretely>
- **Files:** <paths from Affected surface>
- **Done means:** <a checkably true-or-false statement derived from the requirement — never a new requirement>
- **Verify:** <the config `verify` targeted command for this item's package and files>
- **Rules that apply:** <namespaced skill> → <the specific rule>
- **Risk:** <what this could break, or "low">

## Execution
| Lane / phase | Executor | Work items | Files (disjoint) | Depends on | Parallel with | Isolation |
|---|---|---|---|---|---|---|

## Verification plan
| Command | Directory | Passing means |
|---|---|---|

## Assumptions
## Open questions
## Research used
## Rollback / blast radius
```

**Rules:**
- Every requirement maps to at least one work item, and every work item to at least one
  requirement.
- Items are ordered so the tree still typechecks after each one.
- Work is grouped into runs of one package and 3–5 items.
- `Done means` must be checkable. If you cannot name the command or observation that settles
  it, rewrite it.
- The `Verification plan` lists only commands that exist: the config `verify` entries and the
  checks the plan explicitly adds.
- `Open questions` must be empty, or the plan does not start.

## 5. Skill routing

The routing table decides which skill governs which file. It drives the plan's
`Affected surface`, the skills the implementer loads, and the rules a reviewer judges a file
by.

**Resolving a path:**
- A path is governed by every row whose globs match and whose excludes do not.
- When two skills disagree, the higher priority wins.
- A file no row matches is a **coverage gap**, not a file that passed. Say so.

If config `routing` names a file, that file's table replaces this one. It uses the same
columns. Otherwise this default applies, written for a typical TypeScript or JavaScript web
project. In the globs, `{ts,js}` stands for `.ts`, `.mts`, `.cts`, `.js`, `.mjs` and `.cjs`,
and `{tsx,jsx}` for `.tsx` and `.jsx`:

| Priority | Skill | Globs | Excludes |
|---|---|---|---|
| 10 | `engineering-paved-path:onion-architecture` | `**/src/modules/**/*.{ts,js}`, `**/src/domain/**/*.{ts,js}`, `**/src/application/**/*.{ts,js}`, `**/src/adapters/**/*.{ts,js}`, `**/src/infrastructure/**/*.{ts,js}`, `**/server/**/*.{ts,js}` | `**/*.test.{ts,js}`, `**/migrations/**` |
| 10 | `engineering-paved-path:frontend-ui-architecture` | `**/app/**/*.{ts,js,tsx,jsx}`, `**/components/**/*.{tsx,jsx}`, `**/ui/**/*.{tsx,jsx}`, `**/hooks/**/*.{ts,js}` | `**/*.test.{ts,js,tsx,jsx}` |
| 9 | `engineering-paved-path:security` | `**/routes.{ts,js}`, `**/*route*.{ts,js}`, `**/auth/**`, `**/middleware*.{ts,js}`, `**/config.{ts,js}`, `**/.env*`, `**/package.json`, `.github/workflows/**`, `**/prompts/**` | `**/*.test.{ts,js}` |
| 8 | `engineering-paved-path:fastify-best-practices` | files importing `fastify`: `**/routes.{ts,js}`, `**/app.{ts,js}`, `**/server.{ts,js}`, `**/plugins/**/*.{ts,js}` | — |
| 8 | `engineering-paved-path:next-best-practices` | `**/app/**/{page,layout,loading,error,not-found,template,default}.{tsx,jsx}`, `**/app/**/route.{ts,js}`, `**/next.config.*`, `**/middleware.{ts,js}` | — |
| 7 | `engineering-paved-path:react-best-practices` | `**/*.{tsx,jsx}`, `**/hooks/**/*.{ts,js}` | `**/*.test.{tsx,jsx}` |
| 6 | `engineering-paved-path:react-testing-library` | `**/*.test.{tsx,jsx}`, `**/test/**/*.{ts,js,tsx,jsx}`, `**/vitest.config.*` | — |

Rows that do not apply to the project match nothing and cost nothing. A Fastify row in a
project without Fastify is skipped.

**Always unrouted:** `**/*.md`, `docs/**`, lockfiles and generated files. Name them as
coverage gaps rather than letting them look reviewed.

Load a routed skill with the `Skill` tool under its namespaced name. Never read another
plugin's files by path.

## 6. Verification

Verification cost is calls × context, not test output, so checks are cheap by construction:

- **Targeted, once per work item, after its last edit.** Run the config `verify` entry's
  `files` command for that package, in its `dir`, with the touched files. Never run it after
  every single edit.
- **Full, once.** The `full` command runs once per touched package at integration
  (`run-plan`), and once after the last edit. In lane mode, the integration pass owns it.
- **Red.** Re-run just the failing test file to read the real failure, not the whole package.
- **No `verify` entry for a touched package.** Do not invent commands.
  - Agents report it as `not run — no verify command configured`.
  - `run-plan` asks the user once and offers to save the answer into the config file.
- **Never run commands that:**
  - destroy local data (dropping databases or volumes, resetting containers);
  - collide with a running dev server (a production build writing the dev server's output
    directory);
  - need the whole stack up, unless the plan's `Verification plan` names them.

A command that was not run is reported as **not run**, never as passed.
