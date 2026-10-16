---
type: llm
weight: 2
---

The `Not established` section lists the retry limit production actually runs with as not
established, and says why: the limit comes from the `PAYMENT_MAX_RETRIES` environment
variable, whose value is not committed (it is empty in `.env.example`), so the repository
cannot tell what production sets.
