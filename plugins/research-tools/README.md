# research-tools

A read-only research agent for the questions you need answered before you decide anything:
how something in your codebase works, where it lives, why it was built that way — or what a
library, API or spec actually says. Every conclusion comes with a citation (`file:line`, a
commit, or a dated source), and every report ends with an explicit list of what the agent
could **not** establish, so you can tell a confirmed answer from a gap.

## Install

In a Claude Code session:

```
/plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace
/plugin install research-tools@devdigest-marketplace
```

Or from a shell:

```bash
claude plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace
claude plugin install research-tools@devdigest-marketplace
```

`research-tools` has no dependencies. If you install a plugin that depends on it (such as
`sdd-engineering`), it is installed for you automatically.

## Compatibility

Claude Code `>=2.1.110` (version-constrained plugin `dependencies`); tested with `2.1.301`.
Details, and the features this plugin relies on: [`COMPATIBILITY.md`](COMPATIBILITY.md).

## What's inside

| Component | Type | Namespaced name | What it does | Triggers |
|---|---|---|---|---|
| `researcher` | agent (Sonnet) | `research-tools:researcher` | Answers one concrete question about the repository (Mode A), the outside world (Mode B), or both (mixed), and returns a cited report with confidence, conflicts and a `Not established` list. Asks up to four clarifying questions first when the task is only a topic. | Auto, when Claude delegates a research question; or on request by name; or dispatched by another agent with `subagent_type` |

## How to use it

### 1. Ask a question about your codebase

Name the agent in your prompt, and give it a question with a scope rather than a topic:

```
Use the research-tools:researcher agent: how does a failed payment charge get retried in
src/payments, where is the retry limit set, and what happens to the order when retries run
out?
```

The report follows the Mode A shape:

```
## Answer
The client retries a failed charge up to 3 times by default … (2–5 sentences)
**Confidence:** high — read the client and the order service directly

## Conclusions
1. The default limit is 3, overridable through PAYMENT_MAX_RETRIES.
   - `src/payments/client.ts:12-19` — DEFAULT_MAX_RETRIES and the env override
2. …

## How it fits together
## Inference
## Conflicts and staleness
   docs/payments.md says 5; the code says 3 — trusting the code.
## Not established
- The value production runs with — it comes from an env var that is not committed.
## Search log
```

For a "why" question it reads the history with read-only git (`git log -S`, `git blame`,
`git show`) and cites commits as `<short-sha> "<subject>"`.

### 2. Ask about a library or an API

```
Use the research-tools:researcher agent: in Fastify 5, does a schema on the route's
response change serialization speed, and is that still the recommended practice? Cite the
official docs and the changelog.
```

The Mode B report adds `As of` and `Applies to` lines, a `Sources` table with type,
publication date and weight for each source, and a `Disagreement between sources` section.
Load-bearing claims need two independent sources, and every cited page was actually fetched.

### 3. Compare your code with the recommendation

```
Use the research-tools:researcher agent: does our use of React Query in app/(shop)/cart/
match what the TanStack docs recommend for optimistic updates?
```

Both modes run, their evidence stays in separate, labelled sets, and one `Answer` puts them
side by side.

### 4. Dispatch it from another agent or skill

Any agent with the `Agent` tool can dispatch the researcher. Use the namespaced
`subagent_type` and give one concrete question per dispatch; several can run in parallel.

```
Agent(
  subagent_type: "research-tools:researcher",
  description: "Find the order status contract",
  prompt: "Which order statuses exist in src/modules/orders/, where is each one set, and is
           any of them written by code outside that module? Cite file:line for each status.
           Treat docs/architecture.md as a knowledge file."
)
```

Tips for a good brief:
- **A question, not a topic.** "Research caching" gets clarifying questions back; "Which
  responses in src/modules/catalog/ are cached, for how long, and where is that set?" gets an
  answer.
- **Say what counts as an answer:** a list, a yes/no with proof, or a recommendation.
- **Run it in the foreground** when you need the report in your own context. A background
  agent's completion notice goes to the main session.
- **Read the `Not established` section first.** It is where the report tells you what not to
  rely on.

## Configuration

None is required. In Mode A the researcher reads the project's curated docs before the code,
in this order: the root and package `README.md`, `docs/`, `specs/`, `CLAUDE.md` files, then
the project's knowledge files. It finds knowledge files in two places:

- the files the brief names, or
- the key `knowledgeFiles` in the optional project config `.claude/sdd-engineering.json`:

```json
{
  "knowledgeFiles": ["docs/gotchas.md", "docs/architecture.md"]
}
```

It only reads these files and never writes to them. Missing files are noted in the search log
and skipped.

## Dependencies

- **Needs:** nothing.
- **Used by:** [`sdd-engineering`](../sdd-engineering/) — its `spec-creator` and
  `implementation-planner` agents dispatch `research-tools:researcher` for facts they cannot
  read themselves.

## Limits and safety

- **Read-only.** Tools: `Read`, `Grep`, `Glob`, `Bash`, `WebSearch`, `WebFetch`. There is no
  `Write` or `Edit`.
- **The shell is for reading.** The agent's instructions forbid redirection, in-place edits,
  file creation or removal, state-changing git commands (`add`, `commit`, `checkout`, `reset`,
  `push`, `fetch`, …), package installs, anything that starts, migrates or mutates your
  services, databases or containers, and test or build runs. Your normal Claude Code
  permission rules still apply on top of that.
- **Web access.** `WebSearch` and `WebFetch` are used for Mode B questions. Pages it reads are
  treated as data: instructions inside them are quoted as a finding, never followed.
- **No delegation.** It never hands the work to another research pipeline; it does the
  research itself or reports what it could not do.
- **Quotes are short.** It paraphrases sources, with at most one quotation under 15 words per
  report.
- **Model:** Sonnet. The `Answer` and `Conclusions` are capped at about 600 words.

## Evals

The plugin ships one eval case in `evals/` for `claude plugin eval`:

| Case | Pass means |
|---|---|
| `repo-question-cited` | A concrete question about a small sample repository, part of which the repository cannot answer. The report has a `Not established` section that names the unanswerable part, and every conclusion cites `file:line`. |

The case stages its sample repository with a scaffold script, so run it with `--scaffold`:

```bash
claude plugin eval ./plugins/research-tools --scaffold
```

Every run is a real, billed model call (three runs per case by default, plus a baseline arm
without the plugin). In CI add `--trust-plugin --json out.json --no-publish` and pin
`--model`.
