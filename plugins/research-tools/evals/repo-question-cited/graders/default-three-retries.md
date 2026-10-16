---
type: llm
weight: 1
---

The answer states that the client retries a failed charge up to 3 times by default
(`DEFAULT_MAX_RETRIES = 3`, so up to 4 attempts in total), that `PAYMENT_MAX_RETRIES`
overrides the default, and that a declined payment is not retried.
