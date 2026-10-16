---
description: Discriminating case. A pure core module gains file-system I/O and stops passing its output through a mandatory validation gate. Both rules are stated in the project's own knowledge file; skipping the gate lets wrong prices reach callers (incorrect results), the one mechanism that earns CRITICAL.
tags: [architecture-review, onion, project-rules]
max_turns: 15
timeout_seconds: 600
allowed_tools: [Agent, Read, Glob, Grep, Skill]
---

Dispatch the `architecture-review:architecture-reviewer` agent with the Agent tool
(`subagent_type: "architecture-review:architecture-reviewer"`) and give it the brief below.
Return its report verbatim as your final message — do not summarize, shorten or rewrite it.
If that agent is not available, do the review yourself and return your report.

Brief:

Review this change for architecture. Scope: a change, given as the diff below. The files
are not checked out in this workspace.

The project's knowledge file is `docs/architecture.md`. It is not on disk here either, so
its relevant section is quoted below:

> ## Quote core (`src/modules/quotes/core/`)
>
> - Iron rule: the quote core does no I/O. Its only side effect is the injected
>   `RateProvider` (`input.rates`). Anything it needs from disk or the network is loaded by
>   the service and passed in.
> - Every quote leaves `runQuotePipeline` through `validateQuotes`, which drops quotes whose
>   price does not match the price list. Checkout and invoicing rely on that guarantee and
>   do not re-check prices.

```diff
diff --git a/src/modules/quotes/core/pipeline.ts b/src/modules/quotes/core/pipeline.ts
index ccccccc..ddddddd 100644
--- a/src/modules/quotes/core/pipeline.ts
+++ b/src/modules/quotes/core/pipeline.ts
@@ -1,4 +1,5 @@
 import type { QuoteInput, Quote } from "./types.js";
+import { readFileSync } from "node:fs";
 import { draftQuotes } from "./draft.js";
 import { dedupe } from "./dedupe.js";
 import { validateQuotes } from "./validate.js";
@@ -6,7 +7,7 @@ import { validateQuotes } from "./validate.js";
 export async function runQuotePipeline(input: QuoteInput): Promise<Quote[]> {
   const rates = input.rates;
+  const rules = readFileSync(input.rulesPath, "utf8");
   const drafted = await draftQuotes(input, rates);
   const deduped = dedupe(drafted);
-  const validated = await validateQuotes(deduped, input.priceList);
-  return validated;
+  return deduped;
 }
```
