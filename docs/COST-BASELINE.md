# Cost baseline

Status: **measured on 2026-10-17** with DeepSeek through OpenRouter, run by Claude Code
`2.1.301` via `claude plugin eval`. Raw data: `scripts/cost-baseline/runs/` on the measuring
machine (gitignored). How to repeat it: [§7](#7-how-to-repeat-the-measurement).

## Summary

| | Baseline | After the optimization |
|---|---|---|
| Plugin version / commit | `sdd-engineering` 1.0.0 · `cc79dab` | `sdd-engineering` 1.0.0 · `9eb63bb` |
| Model (every agent and the judge) | `deepseek/deepseek-v4-pro` | `deepseek/deepseek-v4-pro` |
| Scenario runs | 3 | 3 |
| Scenario pass rate | 1/3 | 1/3 |
| SDD guard-rail evals (incl. 2 negative) | 6/6 | 6/6 |
| Critical errors (plan not written) | 1 of 3 runs | 1 of 3 runs |
| Median cost per scenario run | $0.105 | $0.076 |
| Cost of the 3-run batch (measured) | $0.274 | $0.234 |
| Median latency per run | 925 s | 498 s |
| Median model calls per run | 38 | 30 |
| Median tokens per run (input / output / cache-read) | 963k / 58k / 475k | 533k / 33k / 272k |

**Verdict.**
- **The optimization passes its own rule.** Quality did not drop: the pass rate, the failure
  classes and the guard rails are all unchanged. Cost and latency went down in this sample.
- **The saving is not statistically established.** Three runs vary more than the difference
  between the variants. Baseline runs alone ranged from $0.051 to $0.118 and from 477k to
  1.06M input tokens.
- **What is certain is the static saving.** `spec-creator` now loads about 2.6k fewer tokens
  on each of its model calls, and `implementation-planner` about 0.9k fewer. The rest of the
  observed drop is most likely run-to-run variance.

**The quality gate is red on this model, for both variants.** The scenario passes only 1/3
and `architecture-review` 0/4. The main cause is the model, not the plugins: DeepSeek often
answers on its own instead of dispatching the agent it is told to dispatch (§5).

**Total spent on all measurements, smoke tests included:** $1.20 of OpenRouter credit.

## 1. Scenario

The fixed scenario is the eval case
[`baseline-spec-and-plan`](../plugins/sdd-engineering/evals/baseline-spec-and-plan/case.yaml),
committed in `cc79dab`.

- **Fixture.** A tiny shop project:
  - `src/cart.js`, `src/shipping.js` with a flat 4.99 fee, and `src/shipping.test.js`;
  - test command `node --test`;
  - `.claude/sdd-engineering.json` with `specsDir`, `plansDir` and `verify`;
  - an empty spec index.
- **Request.** "Free shipping above a threshold". All six product decisions are given in the
  prompt, so `spec-creator` can go straight to Pass 2:
  - threshold 50.00, inclusive;
  - a constant, not a setting;
  - 4.99 below the threshold, 0 for an empty cart;
  - `invalid_subtotal` for bad input;
  - library code only;
  - single-agent execution.
- **Flow.**
  1. The main session dispatches `sdd-engineering:spec-creator`, which writes `specs/SPEC-01-*.md`.
  2. It then dispatches `sdd-engineering:implementation-planner`, which writes
     `docs/plans/*.plan.md`.
  3. It prints both files.

  No implementation.
- **Graders (9).**
  - Both agents dispatched.
  - Both files exist, and no code file was created.
  - All 12 spec sections are present, in order (regex).
  - No `[NEEDS CLARIFICATION:` marker (regex).
  - Spec quality (LLM judge): EARS acceptance criteria with `Verify:` lines, all four decisions
    covered, no implementation detail.
  - Plan quality (LLM judge): Route A, traceability to every AC, checkable `Done means`, the
    configured verify command, no invented scope.
- **Judge.** The judge model is the same as the eval model, 3 votes per LLM grader. A run
  passes only when all 9 graders pass.

## 2. Quality gate

The gate from the method: the behaviour evals pass, including the negative ones, the spec and
plan meet the format, and there are no critical errors.

| Eval set | Baseline (`cc79dab`) | Optimized (`9eb63bb`) |
|---|---|---|
| `baseline-spec-and-plan` ×3 | 1/3 | 1/3 |
| `spec-creator-pass1-writes-no-file` | ✅ | ✅ |
| `planner-refuses-spec-with-marker` | ✅ | ✅ |
| `plan-verifier-one-row-per-item` | ✅ | ✅ |
| `run-plan-preflight-stops-on-marker` | ✅ | ✅ |
| `workflow-retro-not-auto-triggered` (negative) | ✅ | ✅ |
| `irrelevant-request-no-sdd` (negative) | ✅ | ✅ |
| `architecture-review` cases ×4 | 0/4 | not re-run (plugin unchanged) |
| `research-tools` case | 0/1 (score 0.82) | not re-run (plugin unchanged) |

Guard-rail batches cost $0.249 for the baseline and $0.099 for the optimized version. They are
single runs, so treat these two numbers as indicative only.

## 3. Per-run results

The cost per run is the measured batch cost from OpenRouter, split across the runs in
proportion to each run's token cost. Tokens and model calls come from the proxy log. Latency
is the eval's own duration.

**Baseline — `cc79dab`, `deepseek/deepseek-v4-pro`, batch $0.274, 38.5 min wall clock**

| Run | Result | Seconds | Calls | Input | Output | Cache-read | Cost | Failed graders |
|---|---|---|---|---|---|---|---|---|
| 1 | ✅ 1.00 | 925 | 40 | 1,064,518 | 72,570 | 474,926 | $0.118 | — |
| 2 | ❌ 0.67 | 450 | 28 | 476,835 | 22,814 | 424,783 | $0.051 | sections, spec-quality, plan-quality |
| 3 | ❌ 0.56 | 934 | 38 | 962,883 | 58,464 | 517,297 | $0.105 | **plan-written**, sections, spec-quality, plan-quality |

**Optimized — `9eb63bb`, `deepseek/deepseek-v4-pro`, batch $0.234, 24.5 min wall clock**

| Run | Result | Seconds | Calls | Input | Output | Cache-read | Cost | Failed graders |
|---|---|---|---|---|---|---|---|---|
| 1 | ❌ 0.67 | 426 | 27 | 533,002 | 30,927 | 183,808 | $0.076 | sections, spec-quality, plan-quality |
| 2 | ❌ 0.89 | 545 | 30 | 511,317 | 32,565 | 448,301 | $0.073 | **plan-written** |
| 3 | ✅ 1.00 | 498 | 31 | 586,003 | 42,014 | 271,616 | $0.085 | — |

## 4. The optimization

**Change (commit `9eb63bb`):** remove instructions duplicated between agent prompts and the
`sdd-format` skill, and load a skill only when it is needed. Nothing else changed: same
model, same routing, same scenario, same eval set.

- **`spec-creator`** — dropped its restatement of:
  - the marker rules (`sdd-format` §3);
  - the AC/EARS shape, edge-case pointers, provenance, untrusted-input and traceability rules
    (§2);
  - the marker self-check list.

  It also no longer preloads `mermaid-diagram`, an 8 KB skill. It loads it with the `Skill`
  tool only when a spec needs a diagram. Prompt plus preload: about 10 KB less, about 2.6k
  tokens per model call.
- **`implementation-planner`** — dropped its field-by-field restatement of the plan template
  (§4) and of the routing resolution (§5). It keeps only what the template does not say.
  About 3.6 KB less, about 0.9k tokens per model call.

| Rule from the method | Result |
|---|---|
| Quality gate stays green | Unchanged rather than green: the same 1/3 and the same 6/6 as the baseline. The red parts are model-driven (§5) |
| No new critical false negatives | ✅ The same critical failure class (plan not written), once in each variant |
| Cost or latency really drops | Lower in this sample: median cost −28 %, batch −14 %, median latency −46 %. **Within run-to-run noise** — not proven with 3 runs |

**Honest reading.** About 2.6k tokens are saved on every `spec-creator` call and about 0.9k on
every `planner` call. That is roughly 5–8 % of a run's input tokens. The measured drop of
more than 40 % in median input tokens is mostly variance in how much each run reads and
retries. Proving the saving would take roughly 10+ runs per variant, or a cheaper and more
deterministic scenario.

## 5. Failures and what causes them

| Class | Where | Cause | Critical? |
|---|---|---|---|
| **Agent not dispatched** | flash scenario run 3; `architecture-review` 3/4 on flash and 4/4 on v4-pro | The main session answers by itself instead of calling the `Agent` tool it was told to call. This is model behaviour: the same prompts dispatch reliably in the 6 SDD guard-rail cases | Yes — the pipeline step is skipped |
| **Plan not written** | baseline run 3, optimized run 2 | `implementation-planner` did not finish writing the plan, and the main session started writing it itself | Yes |
| **Summary instead of file contents** | baseline run 2, optimized run 1 | Spec and plan were written correctly, but the main session printed a summary table instead of the files. The quality graders judge the printed text, so they fail | No — an eval-design weakness |
| **Judge disagreement** | flash runs | A 2:1 or 1:2 split on "no implementation detail". The criterion was clarified before the v4-pro runs | No |
| **Shell refused on Windows** | `research-tools` (flash) | `claude plugin eval` refuses to grant `Bash` without an OS sandbox on Windows. The case was re-run without `Bash` | No — environment |

## 6. Model selection

The owner chose DeepSeek on OpenRouter; Anthropic models were not used.

- **`deepseek/deepseek-v4.1-flash`** ($0.15 / $0.60 per 1M) was tried first. The scenario
  passed 1/3 (batch $0.170, median 259 s). In 4 of the 6 failed `architecture-review` and
  scenario runs, the main session never dispatched the agent.
- **`deepseek/deepseek-v4-pro`** ($0.209 / $0.418 per 1M) dispatched the agent in both probe
  cases, so the measured baseline and the optimization both use it. It is slower: one call
  took 333 s.
- **Cost estimates.** Claude Code's own `total_cost_usd` assumes Claude prices and
  overestimated DeepSeek about 57×. All costs in this report come from the OpenRouter key's
  usage counter, read before and after each batch. Token × list-price estimates are also off
  by about 2×, because they ignore the cached-input discount.

## 7. How to repeat the measurement

Tools are in [`scripts/cost-baseline/`](../scripts/cost-baseline/):
- a LiteLLM proxy, because Claude Code speaks the Anthropic API and the proxy translates it to
  any OpenRouter model;
- a per-call usage logger;
- a batch runner that records the OpenRouter cost delta;
- a per-run summary.

```bash
pip install "litellm[proxy]"
export OPENROUTER_API_KEY=...            # your key; never commit it
node scripts/cost-baseline/start-proxy.mjs &   # :4000

# baseline (3 runs) and the SDD guard rails, on the commit under test
scripts/cost-baseline/batch.sh baseline sdd-engineering/evals \
  --case baseline-spec-and-plan --runs 3 --scaffold --allow-tools Write Edit
scripts/cost-baseline/batch.sh guards sdd-engineering/evals \
  --tag smoke --tag markers --tag plan-verifier --runs 1 --scaffold --allow-tools Write Edit

node scripts/cost-baseline/summarize.mjs scripts/cost-baseline/runs/baseline.json \
  scripts/cost-baseline/runs/baseline.meta.json scripts/cost-baseline/usage.jsonl 0.209 0.418
```

- `env.sh` points Claude Code at the proxy, with an isolated config dir, so nothing falls back
  to a Claude subscription.
- Evals load `./plugins` as one root, because each case loads its sibling dependency plugins.

## 8. Findings for `1.1.0`

1. **Routing gap.** The default routing table in `sdd-format` §5 matches only `.ts` / `.tsx`.
   In the JavaScript fixture the planner correctly reported every file as a coverage gap. Add
   `.js`, `.jsx` and `.mjs` globs.
2. **Grade files, not the transcript.** The quality graders should read the written spec and
   plan, not the main session's final message.
3. **Agent-centred eval cases.** The `architecture-review` and `research-tools` cases depend on
   the main session dispatching the agent. They should start the agent directly, or carry a
   stronger instruction, so they measure the agent rather than the router model.
4. **Repeat on a Claude model** for the release gate. The agents are written for Claude
   (`opus` / `sonnet`), and these DeepSeek numbers say more about the model than about the
   plugins.
