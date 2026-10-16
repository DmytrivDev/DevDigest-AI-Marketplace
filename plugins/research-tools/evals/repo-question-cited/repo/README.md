# orders-service

Takes orders, charges them through the payment provider and tracks their status.

- `src/orders/` — order use cases.
- `src/payments/` — the payment provider client. Retry behaviour is described in
  [docs/payments.md](docs/payments.md).

Configuration comes from environment variables; `.env.example` lists them.
