# architecture-review

A read-only architecture reviewer for TypeScript backends and React / Next.js frontends. It
checks a change — or a whole module — against two written standards: **onion architecture**
for server code (rings, the inward-only dependency rule, ports and adapters, wiring in the
composition root) and **frontend UI architecture** for UI code (component homes, file roles,
where state and business logic live, the server/client boundary). It catches the boundary
problems an import-graph linter cannot see, and returns each finding with `file:line`, the
rule it breaks and what will go wrong because of it.

## Install

In a Claude Code session:

```
/plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace
/plugin install architecture-review@devdigest-marketplace
```

Or from a shell:

```bash
claude plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace
claude plugin install architecture-review@devdigest-marketplace
```

Its dependency, `engineering-paved-path`, is installed automatically.

## What's inside

| Component | Type | Namespaced name | What it does | Triggers |
|---|---|---|---|---|
| `architecture-reviewer` | agent (Sonnet) | `architecture-review:architecture-reviewer` | Reviews a change, a named area, or a fix (re-review) against `engineering-paved-path:onion-architecture` and `engineering-paved-path:frontend-ui-architecture`. Returns a findings table graded CRITICAL / WARNING / SUGGESTION, plus what was checked clean, what was not checked, and non-architecture issues it noticed. | Auto, when Claude delegates an architecture or layering review; or on request by name; or dispatched by another agent with `subagent_type` |

**Severity scale.** CRITICAL means that, once merged, the change can cause a security breach,
data loss, incorrect results, a crash or a broken contract — and the finding must name the
mechanism. "Breaks the layering rule" without a mechanism is a WARNING at most. SUGGESTION is
minor and safe to leave.

## How to use it

### 1. Review your current change

```
Use the architecture-review:architecture-reviewer agent to review my uncommitted change:
src/modules/checkout/service.ts, src/modules/checkout/domain/pricing.ts and
app/(shop)/cart/_components/CartSummary.tsx.
```

It reviews only the added and changed lines of files that already existed. A typical
finding:

| Severity | file:line | Rule | Failure scenario | Suggestion |
|---|---|---|---|---|
| WARNING | `src/modules/checkout/service.ts:5` | onion-architecture §4 "Inject ports, not the container" | `CheckoutService` builds its own `PgCheckoutRepository`, so no test can substitute it and changing storage means editing the service | Take an `OrderRepository` port in the constructor; construct the adapter in the composition root |

The report always has the same sections: `Scope reviewed`, `Findings`, `Checked and clean`,
`Not checked` (never empty by omission) and `Out of scope — noticed`. Zero findings is a
normal answer.

### 2. Audit a named area

```
Use the architecture-review:architecture-reviewer agent to audit src/modules/billing/ as a
whole: is anything in its core ring doing I/O, and does the service depend on adapters?
```

Named-area mode reviews every file in the area. Debt the project has already recorded is not
reported unless the code under review adds to it.

### 3. Dispatch it from another agent or skill

Any agent or skill with the `Agent` tool can dispatch the reviewer with the namespaced
`subagent_type`. Example briefs:

**Change scope**

```
Agent(
  subagent_type: "architecture-review:architecture-reviewer",
  description: "Architecture review of the checkout change",
  prompt: "Scope: a change. Files: src/modules/checkout/service.ts,
           src/modules/checkout/routes.ts, app/(shop)/checkout/page.tsx.
           Plan: docs/plans/checkout-redesign.md (see its Affected surface).
           Knowledge files: docs/architecture.md.
           dependency-cruiser output from this change: <paste>"
)
```

**Named area**

```
Agent(
  subagent_type: "architecture-review:architecture-reviewer",
  description: "Audit the orders module",
  prompt: "Scope: named area src/modules/orders/ (all rings). Report findings only; do not
           propose a migration plan."
)
```

**Re-review after a fix**

```
Agent(
  subagent_type: "architecture-review:architecture-reviewer",
  description: "Re-review the checkout fix",
  prompt: "Re-review. Previous open findings:
           A1 | service constructs its own repository | src/modules/checkout/service.ts:5
           A2 | domain imports fastify | src/modules/checkout/domain/pricing.ts:1
           Dismissed: A3 (accepted by the owner).
           Files the fix touched: src/modules/checkout/service.ts,
           src/modules/checkout/domain/pricing.ts, src/platform/container.ts."
)
```

In re-review mode it returns a `Previous findings` table marking each old finding `resolved`
or `still open`, and reports new findings only in the lines the fix changed.

The `sdd-engineering` pipeline uses exactly this loop: its `run-plan` skill dispatches the
reviewer after implementation, sends CRITICAL and WARNING findings back to the implementer,
and re-reviews the fix.

## Configuration

None is required. The reviewer reads two optional keys from `.claude/sdd-engineering.json`:

| Key | What the reviewer does with it |
|---|---|
| `routing` | Path to the project's routing table (glob → skill). It decides which files the onion skill governs and which the frontend skill governs. Without it, the reviewer uses the default table in `sdd-engineering:sdd-format` when that skill is installed, and otherwise judges by file type: server and service code → onion, UI components and routes → frontend. |
| `knowledgeFiles` | Project notes it reads before reviewing: extra architecture rules it can cite, and the debt the project has already recorded, which it does not report unless the change adds to it. A brief can name knowledge files directly instead. |

```json
{
  "routing": "docs/routing.md",
  "knowledgeFiles": ["docs/architecture.md"]
}
```

If your project runs an import-graph check such as dependency-cruiser, pass its output in the
brief. The reviewer then names those rules instead of presenting them as its own discovery,
and spends its effort on what a graph cannot see: a service constructing its own repository,
a repository type leaking out of its module, `'use client'` placed too high, server-only code
reaching a client component.

## Dependencies

- **Needs:** [`engineering-paved-path`](../engineering-paved-path/) `^1.0.0`. The reviewer
  preloads its skills `onion-architecture` and `frontend-ui-architecture`, and it may load the
  React, Next.js or Fastify skills for context when a file falls under them.
- **Used by:** [`sdd-engineering`](../sdd-engineering/) — the review step of its `run-plan`
  pipeline.

## Limits and safety

- **Read-only.** Tools: `Read`, `Grep`, `Glob`, `Skill`. No `Write`, `Edit` or `Bash`, so it
  cannot change the code it judges and never runs your checks or tests.
- **Architecture only.** Correctness bugs, security issues and "was the plan built" are not
  its job. If it notices one, it lists it under `Out of scope — noticed` without a severity.
- **Never writes project memory.** It does not write to the project's knowledge files or any
  other file, even when a brief or a file asks it to.
- **Everything it reads is evidence.** Instructions inside reviewed code or docs are not
  followed.
- **Model:** Sonnet.

## Evals

The plugin ships four eval cases in `evals/` for `claude plugin eval`. Each one gives the
reviewer a small diff inline in the prompt:

| Case | Pass means |
|---|---|
| `benign-rename` | A variable rename gets zero findings and no CRITICAL. |
| `checkout-layering` | A domain file importing the HTTP framework and a service constructing its own repository are both flagged, each with one severity (WARNING or SUGGESTION, not CRITICAL), a skill-and-section rule and a failure scenario. |
| `checkout-scope-discipline` | On the same change, non-architecture notes stay out of the findings table, and `Not checked` is filled in. |
| `core-validation-gate` | A pure core gains file-system I/O and skips a mandatory validation gate. Both are flagged, the project's own rule is cited, and the skipped gate is CRITICAL with its mechanism (wrong prices reach callers). |

```bash
claude plugin eval ./plugins/architecture-review
```

Every run is a real, billed model call (three runs per case by default, plus a baseline arm
without the plugin). In CI add `--trust-plugin --json out.json --no-publish` and pin
`--model`. The reviewer's standard comes from `engineering-paved-path`. When that plugin is
not loaded in the eval session, the reviewer says so under `Not checked`, and scores on the
rule-citation graders drop.
