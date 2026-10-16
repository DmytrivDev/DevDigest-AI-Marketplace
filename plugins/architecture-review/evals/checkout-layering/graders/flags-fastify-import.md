---
type: llm
weight: 1
---

The report has a finding against `src/modules/checkout/domain/checkout.ts` for the added
`import type { FastifyReply } from "fastify"` (and the `reply?: FastifyReply` parameter that
uses it), describing it as the pure domain / core ring depending on an outer ring — the HTTP
transport framework — which breaks the inward-only dependency rule.
