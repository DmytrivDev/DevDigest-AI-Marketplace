---
name: engineering-insights
description: "Captures durable, non-obvious engineering insights into the project's knowledge file for the area the work touched (config knowledgeFiles in .claude/sdd-engineering.json): gotchas, approaches that worked, dead ends and antipatterns, codebase conventions, tool or library quirks, recurring errors with their fix, open questions. Use in the main session when something was learned that a future session would otherwise relearn, at the end of substantial work, on \"wrap up\", \"retro\", \"save this learning\", \"remember this gotcha\", or when /sdd-engineering:engineering-insights is invoked. Reads the file first, never duplicates, writes only specific file-grounded entries, appends through a script that cannot overwrite prior content, and rebuilds the file's index. Never runs inside a subagent."
argument-hint: "[area, package or knowledge file]"
---

# Engineering insights

Capture durable engineering insights into the **knowledge file of the area the work
touched**, so the next session does not relearn them. Read what is already there, add only
what is new and substantial, never overwrite.

## Who may run it

- **The main session only**, when the user asks or when that session decides the work taught
  something worth keeping. It is never part of an automatic loop and no hook starts it.
- **Never a subagent.** If you are running as a subagent (for example
  `sdd-engineering:implementer` or `sdd-engineering:plan-verifier`), stop here: put each
  candidate insight in your report (the implementer's `Observations`, or a short list with
  `file:line` evidence) and let the owning session decide. The pipeline agents already
  never write to the project's knowledge files.
- **Not inside a `/sdd-engineering:run-plan` run.** Its final report may suggest this skill;
  the user or the session runs it after the run.

## Where to write

The project config **`.claude/sdd-engineering.json`**, key **`knowledgeFiles`** (array of
paths, see `sdd-engineering:sdd-format` §1). Agents only read these files; this skill is
their only writer.

1. **One file configured** → that file.
2. **Several** (for example one per package or module) → for each touched file, pick the
   knowledge file whose directory most specifically contains it; a file inside a `docs/`
   folder covers that folder's parent. If the scope is still unclear, read the first lines of
   each candidate (they usually state what they cover), or ask the user. Work that spans
   several areas → write the part relevant to each, to each file.
3. **None configured** → propose a default, `docs/knowledge.md` (or one file per package if
   the project has several), and **ask the user before creating it**. Offer to add the path
   to `knowledgeFiles` in `.claude/sdd-engineering.json`; edit that key only on a yes and
   leave every other key as it is.
4. **Root config or CI only** → usually not an area insight; skip it unless the user asks.

Never write insights into this skill, into an agent, into `CLAUDE.md` or into a spec or plan.

## The seven sections

Every knowledge file written by this skill has these fixed `##` sections, and every entry
goes under exactly one:

- **What Works** — approaches and solutions that proved effective here.
- **What Doesn't Work** — failed approaches, dead ends, antipatterns. **The highest-value
  section and the one most often skipped: prioritize it.**
- **Codebase Patterns** — project conventions, architecture decisions, naming patterns.
- **Tool & Library Notes** — quirks and gotchas of dependencies.
- **Recurring Errors & Fixes** — an error you would hit again, plus its fix.
- **Session Notes** — brief dated summaries of what a session accomplished.
- **Open Questions** — what needs more investigation or was left unresolved.

A new file gets them from the script's `--create`. A configured file that predates this
format and lacks a section is extended only after the user agrees (`--add-section` appends
the heading at the end; nothing above it moves).

## Concrete, not banal

The bar: **an agent reading the entry cold knows exactly what to do or avoid, without
re-investigating.** If it would be obvious to anyone reading the code, do not write it.

| Noise | Useful cold |
|---|---|
| "Promises can be tricky" | "`Promise.all()` over the import batch times out past ~30 items; use `Promise.allSettled()` in chunks of 10. Evidence: `src/modules/orders/import.ts:88`" |
| "Be careful with the cache" | "Price lookups are best-effort: on a cache miss, omit the discount line, never throw. Evidence: `src/modules/pricing/quote.ts:42`" |

Ground every entry in evidence: `path/file.ext:NN`. Write in the language the file already
uses.

## Workflow

Copy this checklist and work through it:

```
- [ ] 1. Gate check: was the work substantial?
- [ ] 2. Resolve the knowledge file(s) and read each in full
- [ ] 3. Draft at most 5 candidates, ranked by signal
- [ ] 4. Dedup against what is already there
- [ ] 5. Append each survivor through the script, then rebuild the index
- [ ] 6. One-line summary
```

1. **Gate check.** Did the work produce something substantial: a problem solved, a decision
   made, a non-obvious discovery? Trivial edits do not qualify. If nothing qualifies, **write
   nothing** and say so. Skipping the *check* is never allowed; writing nothing is a valid
   outcome of it.
2. **Read first.** Resolve the file(s) as in *Where to write*, then read each in full before
   drafting, even if it was read earlier in the session: entries may have been appended
   since. A large file with an index next to it (`<name>.index.md`): scan the index, then read
   the entries on the same subjects as your candidates.
3. **Draft at most 5 candidates**, ranked by signal: user corrections and gotchas highest,
   nice-to-know patterns lowest. Each candidate is the proposed text, its target section and
   its `file:line` evidence.
4. **Dedup.** Do not duplicate an entry already in the file: the same fact in other words
   is still covered. Never restate a recorded insight to "refresh" it. If reality now
   contradicts an entry, append a new dated entry that says what it supersedes and leave the
   old one in place; **the newest entry on a subject wins**.
5. **Append through the script** (below), once per entry, then rebuild the index.
6. **Summary.** One line: what was written, to which file, what was skipped and why.

## Appending (run exactly this)

Never edit a knowledge file by hand and **never use the `Write` tool on one**: `Write`
replaces the whole file and would destroy prior content. Append through the script, which
inserts one line under one heading and rewrites nothing else:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/append-insight.mjs" \
  --file docs/knowledge.md \
  --section "What Doesn't Work" \
  --text 'Concrete, actionable insight. Evidence: `src/modules/orders/import.ts:88`.'
```

- `--file` is the resolved knowledge file, relative to the project root. Required.
- `--date YYYY-MM-DD` is optional and defaults to today.
- `--create` creates a missing file with the header and the seven sections. Pass it only
  after the user agreed to that path.
- `--add-section` appends a missing section heading at the end of an existing file. Pass it
  only after the user agreed.

What the script guarantees, so it cannot be forgotten:

- **Append-only**: it splices one line under one heading; the header, preamble, headings
  and every existing entry stay byte for byte.
- **Verified before writing**: if the result would drop or change any existing line, it
  refuses and leaves the file untouched.
- **Idempotent**: a candidate that duplicates an entry anywhere in the file exits as
  `SKIPPED (duplicate)` and writes nothing.
- **Validated**: an unknown section, a missing file without `--create`, or a missing heading
  without `--add-section` is rejected with the reason.

Read its output: `APPENDED` means written, `SKIPPED` means the insight was already there (not
a failure), `ERROR` means nothing was written and the file is unchanged.

## Rebuilding the index (after every append)

```bash
node "${CLAUDE_SKILL_DIR}/scripts/build-index.mjs" --file docs/knowledge.md
```

It writes `<name>.index.md` next to the file (`docs/knowledge.index.md` here): one line per
entry with its section, date, a short hook and its **source line numbers**. Without
`--file` it indexes every `knowledgeFiles` entry of `.claude/sdd-engineering.json`;
`--check` exits non-zero when an index is stale.

The index is a derived file. The script never opens a knowledge file for writing, so
append-only holds; if the two ever disagree, the source wins (delete the index and rebuild).
It exists because a file that grows every session soon costs every agent that touches its
area thousands of tokens before any useful work. With the index, a reader decides what is
relevant and reads just those lines.

It is a **finding aid, not a substitute**: an entry's value is in its detail, and the hook
is deliberately too short to act on. Where it pays off most is one step out: a session that
briefs a subagent can scan the index, read the three relevant entries and quote them into
the brief, instead of making the subagent load the whole file.

## Common mistakes

1. Generic entries that lack the context to act on them cold.
2. Skipping **What Doesn't Work**: the negative learnings are the most valuable ones.
3. Conflicting entries left unresolved, which leaves the next agent guessing.
4. File bloat: past ~200 entries the signal-to-noise ratio drops.
5. Writing from a subagent, or writing without the gate check.

## Maintenance (not per session)

Append-only keeps files growing, so prune out of band, with the user, for example once a
quarter: drop entries about code that was deleted or refactored away, update entries whose
approach has evolved, and merge near-duplicates into one clearer entry. Resolve
contradictions explicitly rather than keeping both. Split a file by area before it becomes
unreadable, and update `knowledgeFiles` to match. Treat a knowledge file as a reviewed draft:
an incorrect entry propagates into every future session until someone corrects it.
