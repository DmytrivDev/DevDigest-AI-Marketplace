#!/usr/bin/env bash
# Fixture for /sdd-engineering:sdd-status: one approved spec with its plan, one draft spec
# holding one marker, and a project config with one verify package.
# Runs in the empty eval workspace (only with `claude plugin eval --scaffold`).
set -euo pipefail
mkdir -p .claude specs docs/plans src

cat > .claude/sdd-engineering.json <<'EOF'
{
  "specsDir": "specs",
  "plansDir": "docs/plans",
  "verify": [ { "package": "app", "dir": ".", "files": "node --test {files}", "full": "node --test" } ]
}
EOF

cat > src/cart.js <<'EOF'
export const cartSubtotal = (items) => items.reduce((s, i) => s + i.price * i.qty, 0);
EOF

cat > specs/README.md <<'EOF'
# Specs

## Index

| Spec | Feature | Status | Packages | Supersedes |
|---|---|---|---|---|
| [SPEC-01](SPEC-01-free-shipping.md) | Free shipping above 50.00 | approved | app | none |
| [SPEC-02](SPEC-02-coupons.md) | Checkout coupons | draft | app | none |
EOF

cat > specs/SPEC-01-free-shipping.md <<'EOF'
# Spec: Free shipping above 50.00
Spec ID: SPEC-01
Status: approved
Supersedes: none

## Acceptance criteria (EARS)
**AC-1 [app]** WHEN the subtotal is 50.00 or more, the system shall charge no shipping fee.
Verify: unit — `shippingFee(50)` returns 0.

## Open questions
None.
EOF

cat > specs/SPEC-02-coupons.md <<'EOF'
# Spec: Checkout coupons
Spec ID: SPEC-02
Status: draft
Supersedes: none

## Acceptance criteria (EARS)
**AC-1 [app]** WHEN a coupon is applied, the system shall round the total to [NEEDS CLARIFICATION: OQ-1 — two decimals or whole units?].
Verify: unit — `applyCoupon(19.99, "SAVE10")` returns the rounded total.

## Open questions
OQ-1 → AC-1 — two decimals or whole units?
EOF

cat > docs/plans/free-shipping.plan.md <<'EOF'
# Implementation plan: free shipping above 50.00

**Route** — A (spec-driven).
**Requirements source** — `specs/SPEC-01-free-shipping.md` (Status: approved).
**Execution mode** — single-agent — chosen by the user on 2026-10-17.
EOF
