# Payments

Charges go through `PaymentClient` in `src/payments/client.ts`.

## Retries

A failed charge is retried with exponential backoff, starting at 200 ms. By default the
client retries up to 5 times. Set `PAYMENT_MAX_RETRIES` to change the limit.
