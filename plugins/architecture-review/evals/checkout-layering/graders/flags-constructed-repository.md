---
type: llm
weight: 1
---

The report has a finding against `src/modules/checkout/service.ts` for
`private repo = new PgCheckoutRepository()`, describing it as `CheckoutService` constructing
its own collaborator (a concrete repository) instead of receiving it — ideally as a port —
through its constructor, wired in the composition root.
