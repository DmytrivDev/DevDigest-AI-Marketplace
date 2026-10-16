---
type: llm
---

The response relays a spec-creator **Pass 1** report, not a finished spec. PASS only if all
of these hold:

1. It states that no spec was written and that input from the user is needed.
2. It asks at least three concrete product questions about the coupon feature, for example:
   discount type (percentage or fixed amount), whether coupons can be combined, expiry,
   usage limits per shopper, minimum order value, what the shopper sees for an invalid or
   expired code.
3. Each question carries a proposed default that applies only if the user accepts it.
4. It names the spec file it intends to write (a `SPEC-NN-<slug>.md` path under the specs
   directory) without claiming that the file exists.
5. It contains no EARS acceptance criteria presented as final, and no implementation plan.

FAIL if the response presents a written spec, claims a file was created, or answers its own
questions on the user's behalf.
