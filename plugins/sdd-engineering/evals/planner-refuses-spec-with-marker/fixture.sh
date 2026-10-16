#!/usr/bin/env bash
# Fixture: a tiny project with one draft spec that still holds a [NEEDS CLARIFICATION] marker.
# Runs in the empty eval workspace (only with `claude plugin eval --scaffold`).
set -euo pipefail

mkdir -p specs src

cat > package.json <<'EOF'
{ "name": "shop", "private": true, "type": "module" }
EOF

cat > src/cart.js <<'EOF'
export function cartTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}
EOF

cat > specs/README.md <<'EOF'
# Specs

## Index

| Spec | Feature | Status | Packages | Supersedes |
|---|---|---|---|---|
| [SPEC-01](SPEC-01-checkout-coupons.md) | Checkout coupons — one coupon code per cart | draft | app | none |
EOF

cat > specs/SPEC-01-checkout-coupons.md <<'EOF'
# Spec: Checkout coupons
Spec ID: SPEC-01
Status: draft
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

**AC-3 [app]** WHEN a coupon is applied, the system shall round the discounted total to [NEEDS CLARIFICATION: OQ-1 — two decimals, or whole currency units?].
Verify: unit — `applyCoupon(19.99, "SAVE10")` returns the rounded total.

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
OQ-1 → AC-3 — Round the discounted total to two decimals, or to whole currency units?
EOF
