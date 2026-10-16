#!/usr/bin/env bash
# Fixture: an approved spec, a 3-item plan and a partial change. W1 and W2 are built and
# tested; W3 (case-insensitive codes) is not. The spec, plan and config are committed; the
# change is left uncommitted, as after an implementer run.
# Runs in the empty eval workspace (only with `claude plugin eval --scaffold`).
set -euo pipefail

mkdir -p specs src docs/plans .claude

cat > package.json <<'EOF'
{ "name": "shop", "private": true, "type": "module" }
EOF

cat > .claude/sdd-engineering.json <<'EOF'
{
  "verify": [
    { "package": "app", "dir": ".", "files": "node --test {files}", "full": "node --test" }
  ]
}
EOF

cat > specs/SPEC-01-checkout-coupons.md <<'EOF'
# Spec: Checkout coupons
Spec ID: SPEC-01
Status: approved
Supersedes: none

## Problem and user
Shoppers who receive a promo code cannot use it at checkout.

## Goals / Non-goals
Goals: apply one coupon code to the cart total.
Non-goals: stacking several coupons on one cart.

## User stories
US-1 As a shopper, I enter a coupon code at checkout and see the discounted total.

## Acceptance criteria (EARS)
**AC-1 [app]** WHEN the shopper applies the code `SAVE10`, the system shall reduce the cart total by 10%.
Verify: unit — `applyCoupon(100, "SAVE10")` returns 90.

**AC-2 [app]** IF the shopper applies an unknown code, THEN the system shall reject it with the error code `invalid_coupon`.
Verify: unit — `applyCoupon(100, "NOPE")` throws an error whose `code` is `invalid_coupon`.

**AC-3 [app]** WHEN the shopper applies a known code in any letter case, the system shall accept it as that code.
Verify: unit — `applyCoupon(100, "save10")` returns 90.

## Edge cases
EC-1 An empty code → AC-2.

## Non-functional requirements
None: the feature is a pure calculation with no I/O.

## Module interactions
None: the calculation runs inside the app package.

## Inputs and provenance
| Input | Source | Producer | Freshness | Trusted |
|---|---|---|---|---|
| Coupon code | checkout form | shopper | per request | no |

## Untrusted inputs
The coupon code is validated against the known codes before use (AC-2).

## Design review
None: no design was provided.

## Traceability
| AC / NFR | From (US / EC / design review) | Packages | Verify |
|---|---|---|---|
| AC-1 | US-1 | app | unit |
| AC-2 | US-1, EC-1 | app | unit |
| AC-3 | US-1 | app | unit |

## Open questions
None.
EOF

cat > docs/plans/checkout-coupons.plan.md <<'EOF'
# Implementation plan: Checkout coupons

**Route** — A (spec-driven).
**Requirements source** — `specs/SPEC-01-checkout-coupons.md` (Status: approved).
This plan implements those requirements; it does not define or change them.
**Execution mode** — single-agent — chosen by the user.
**Out of scope** — stacking coupons; architecture and security review are performed by separate agents.

## Requirements traceability
| Req | Requirement (quoted or cited) | Source | Work items | Checked by |
|---|---|---|---|---|
| AC-1 | "WHEN the shopper applies the code `SAVE10`, the system shall reduce the cart total by 10%." | `specs/SPEC-01-checkout-coupons.md:17` | W1 | W1 `Done means` |
| AC-2 | "IF the shopper applies an unknown code, THEN the system shall reject it with the error code `invalid_coupon`." | `specs/SPEC-01-checkout-coupons.md:20` | W2 | W2 `Done means` |
| AC-3 | "WHEN the shopper applies a known code in any letter case, the system shall accept it as that code." | `specs/SPEC-01-checkout-coupons.md:23` | W3 | W3 `Done means` |

## Affected surface
| File | New/Mod | Package | Home (ring / radius) | Skills that will govern it | Constraint to respect |
|---|---|---|---|---|---|
| `src/coupons.js` | New | app | domain function | — | pure, no I/O |
| `src/coupons.test.js` | New | app | test | — | node:test |

**Coverage gaps:** `src/coupons.js`, `src/coupons.test.js` — no routing row matches.

## Contract changes
- **Shared contracts / schemas:** no
- **Migration:** no
- **Seed / fixture data:** no
- **Build-only failures:** no

## Work items
### W1 — Apply the SAVE10 coupon
- **Serves:** AC-1
- **Do:** add `applyCoupon(total, code)` to `src/coupons.js`; `SAVE10` returns `total * 0.9`.
- **Files:** `src/coupons.js`, `src/coupons.test.js`
- **Done means:** `applyCoupon(100, "SAVE10")` returns `90`, proven by a test in `src/coupons.test.js`.
- **Verify:** `node --test src/coupons.test.js`
- **Rules that apply:** —
- **Risk:** low

### W2 — Reject unknown codes
- **Serves:** AC-2
- **Do:** `applyCoupon` throws an `Error` with `code = "invalid_coupon"` for any other code.
- **Files:** `src/coupons.js`, `src/coupons.test.js`
- **Done means:** `applyCoupon(100, "NOPE")` throws an error whose `code` is `invalid_coupon`, proven by a test.
- **Verify:** `node --test src/coupons.test.js`
- **Rules that apply:** —
- **Risk:** low

### W3 — Accept codes in any letter case
- **Serves:** AC-3
- **Do:** normalise the code to upper case before the lookup.
- **Files:** `src/coupons.js`, `src/coupons.test.js`
- **Done means:** `applyCoupon(100, "save10")` returns `90`, proven by a test in `src/coupons.test.js`.
- **Verify:** `node --test src/coupons.test.js`
- **Rules that apply:** —
- **Risk:** low

## Execution
One `sdd-engineering:implementer`, dispatched with this plan's path, executes W1…W3 in order.

## Verification plan
| Command | Directory | Passing means |
|---|---|---|
| `node --test` | repo root | all tests pass |

## Assumptions
None.

## Open questions
None.

## Research used
None.

## Rollback / blast radius
Revert the two new files.
EOF

git init -q
git add -A
git -c user.name=eval -c user.email=eval@example.invalid commit -q -m "spec and plan"

# The partial change: W1 and W2 only. The lookup is case-sensitive, so W3 is not done.
cat > src/coupons.js <<'EOF'
const COUPONS = { SAVE10: 0.1 };

export function applyCoupon(total, code) {
  const rate = COUPONS[code];
  if (rate === undefined) {
    const error = new Error(`unknown coupon: ${code}`);
    error.code = 'invalid_coupon';
    throw error;
  }
  return total * (1 - rate);
}
EOF

cat > src/coupons.test.js <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCoupon } from './coupons.js';

test('SAVE10 takes 10% off', () => {
  assert.equal(applyCoupon(100, 'SAVE10'), 90);
});

test('an unknown code is rejected with invalid_coupon', () => {
  assert.throws(() => applyCoupon(100, 'NOPE'), { code: 'invalid_coupon' });
});
EOF
