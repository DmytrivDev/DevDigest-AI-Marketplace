---
type: llm
weight: 1
---

Each of the two checkout findings states a concrete failure scenario — what goes wrong
because of it. For example: `CheckoutService` cannot be unit-tested with a substituted
(fake) repository, or swapping the storage means editing the service; the domain pricing
rule can no longer be reused or tested without the HTTP framework, or a framework upgrade
now ripples into the core.
