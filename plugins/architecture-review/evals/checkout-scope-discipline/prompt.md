---
description: Checkout change, report discipline. Non-architecture observations stay out of the findings table, and Not checked is never empty.
tags: [architecture-review, report-shape]
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
are not checked out in this workspace. The project keeps the onion layout: `src/modules/<name>/`
holds the module, `domain/` is its pure core, and `src/platform/container.ts` is the
composition root.

```diff
diff --git a/src/modules/checkout/domain/checkout.ts b/src/modules/checkout/domain/checkout.ts
index 1111111..2222222 100644
--- a/src/modules/checkout/domain/checkout.ts
+++ b/src/modules/checkout/domain/checkout.ts
@@ -1,8 +1,9 @@
+import type { FastifyReply } from "fastify";
 export interface CheckoutOrder {
   id: string;
   total: number;
 }
 
-export function priceOrder(order: CheckoutOrder): number {
+export function priceOrder(order: CheckoutOrder, reply?: FastifyReply): number {
   return order.total;
 }
diff --git a/src/modules/checkout/service.ts b/src/modules/checkout/service.ts
index 3333333..4444444 100644
--- a/src/modules/checkout/service.ts
+++ b/src/modules/checkout/service.ts
@@ -1,8 +1,12 @@
 import { priceOrder } from "./domain/checkout.js";
+import { PgCheckoutRepository } from "./repository.js";
 
 export class CheckoutService {
+  private repo = new PgCheckoutRepository();
+
   async checkout(order: { id: string; total: number }) {
     const price = priceOrder(order);
+    await this.repo.save(order.id, price);
     return { price };
   }
 }
```
