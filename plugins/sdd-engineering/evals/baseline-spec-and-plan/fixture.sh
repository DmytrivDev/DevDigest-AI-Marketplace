#!/usr/bin/env bash
# Fixture for the cost-baseline scenario: a tiny shop project with SDD config, an empty
# spec index and a working test command. No spec or plan exists yet.
# Runs in the empty eval workspace (only with `claude plugin eval --scaffold`).
set -euo pipefail

mkdir -p .claude specs docs/plans src

cat > package.json <<'EOF'
{
  "name": "shop",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test" }
}
EOF

cat > .claude/sdd-engineering.json <<'EOF'
{
  "specsDir": "specs",
  "plansDir": "docs/plans",
  "verify": [
    { "package": "app", "dir": ".", "files": "node --test {files}", "full": "node --test" }
  ]
}
EOF

cat > README.md <<'EOF'
# Shop

A tiny checkout library. `src/cart.js` computes cart totals; `src/shipping.js` computes the
shipping fee. Tests: `npm test` (Node's built-in test runner).
EOF

cat > src/cart.js <<'EOF'
export function cartSubtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}
EOF

cat > src/shipping.js <<'EOF'
export const FLAT_SHIPPING_FEE = 4.99;

export function shippingFee(subtotal) {
  if (subtotal <= 0) return 0;
  return FLAT_SHIPPING_FEE;
}
EOF

cat > src/shipping.test.js <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee } from './shipping.js';

test('charges the flat fee for a non-empty cart', () => {
  assert.equal(shippingFee(20), 4.99);
});

test('charges nothing for an empty cart', () => {
  assert.equal(shippingFee(0), 0);
});
EOF

cat > specs/README.md <<'EOF'
# Specs

Feature specifications for the shop (see the sdd-format template).

## Index

| Spec | Feature | Status | Packages | Supersedes |
|---|---|---|---|---|
EOF
