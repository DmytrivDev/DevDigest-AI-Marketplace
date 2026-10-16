# Ports, adapters and the composition root

Ring 2 and ring 4, and the one file allowed to see both. Read [SKILL.md](SKILL.md) §2 first
for *when* a port is justified — this file is about *how* to write one once it is. Paths use
the reference layout from SKILL.md.

## Driving vs driven

Cockburn's distinction, and it decides where the adapter lives:

| Side | Who starts the conversation | Typical examples | Home |
|---|---|---|---|
| **Driving** (primary) | The outside world calls us | HTTP routes, the job runner, a CLI, MCP tools | `modules/*/routes.ts`, `platform/jobs.ts` |
| **Driven** (secondary) | We call the outside world | payment provider, email, object storage, an LLM, the database, the secrets store | `adapters/**`, `db/**` |

The asymmetry matters: **a driven port is an interface we define and the vendor obeys; a
driving adapter has no port at all** — it just calls the service. Do not invent an
`OrderController` interface because `PaymentGateway` has one. Nothing substitutes a route.

## Writing a driven port

Ports live in `src/ports/` (or the project's shared contracts package). A one-line header
states the contract: "All external calls go behind these interfaces. Real implementations
live in `adapters/*`; services depend on the interface, not the implementation."

Rules:

1. **Describe the conversation, not the library.** `PaymentGateway.charge(order, amount)` —
   not `stripe.paymentIntents.create(params)`. If a vendor type appears in a signature,
   ring 3 has learned which SDK is underneath and the port bought you nothing.
2. **Own your own types.** The port's inputs and outputs are your types (`Money`,
   `ChargeResult`, `StoredFile`), defined next to the port.
3. **Keep it narrow.** A port is the subset *we* use. An `LLMProvider` port might be four
   methods over SDKs with hundreds. Adding a method because one adapter happens to support it
   widens the contract every other adapter must now satisfy.
4. **Every copy changes together.** If the contracts package is shared or copied between
   apps, a port edited in one place and not the other is a typecheck failure somewhere else,
   usually noticed much later.
5. **A runtime schema where it crosses the wire, plain TS where it does not.** A type parsed
   from an HTTP response deserves a Zod schema; an in-process message type that never crosses
   a boundary unvalidated can be a plain interface. Follow what the neighbours do.

## Writing the adapter

One folder per technology under `adapters/<tech>/`, implementing the port and nothing else:

```
adapters/
  payments/stripe.ts    → PaymentGateway ('stripe')
  payments/paypal.ts    → PaymentGateway ('paypal')
  email/smtp.ts         → Mailer
  storage/s3.ts         → FileStore
  llm/openai.ts         → LLMProvider
  secrets/env.ts        → SecretsProvider
  mocks.ts              → in-memory fakes for tests and local dev
```

An adapter's job is **translation, not decision-making**. It converts our types to the
vendor's and back, and maps vendor failures into our error taxonomy
(`ExternalServiceError` from `src/core/errors.ts`). The moment an adapter contains a
business rule — a retry policy tied to product behaviour, a threshold, a fallback that
changes what the user sees — that rule belongs in ring 1 or 3, and the adapter should be
handed the decision, not make it.

**An adapter may depend on another port.** A search-index adapter that takes a `FileStore`
is ring 4 → ring 2, which is inward and fine.

## The composition root

`platform/container.ts` (or whatever the project calls it) is the only file that knows every
ring. A good header says why: "Tests construct a container with `overrides` to inject mock
adapters; services depend on these interfaces, not the concrete classes."

Three properties worth preserving when you extend it:

**Lazy, cached construction.** `this._mailer ??= new SmtpMailer(...)` — an adapter that is
never used is never built. This is load-bearing for adapters gated behind a secret: if the
payment API key is absent, `payments()` throws a `ConfigError` *before* constructing the
client, so the app makes zero requests. Same for optional features switched off in config.

**Overrides win first.** Every getter checks `this.overrides.X` before building anything.
That check is what makes the whole container substitutable in tests.

**Sync getters for local adapters, async methods for secret-gated ones.** Adapters that need
nothing external can be getters; ones that must resolve a secret first are `async` methods.
Follow the split the container already uses — a new secret-gated adapter is an async method.

### Adding an adapter

1. Port in `src/ports/` — only if §2 of SKILL.md justifies one (and in every copy of the
   contracts package, if there are several).
2. Implementation in `adapters/<tech>/<lib>.ts`.
3. Field in `ContainerOverrides` so tests can substitute it.
4. Lazy getter (or async method, if secret-gated) on `Container`.
5. If a cached client depends on a secret that can change at runtime, clear the cache when
   the secret changes — that is what makes "paste a new API key and it takes effect" work.

## Testing across the boundary

This is the payoff, and the reason the bans in SKILL.md are worth obeying.

```ts
const container = new Container(config, db, {
  payments: fakePayments,
  mailer: recordingMailer,
});
```

Because every service depends on interfaces, a test substitutes the outside world at the
composition root with no mocking framework. Keep the fakes in one place (for example
`adapters/mocks.ts`) so every test reuses them.

The rings give you three test grades, cheapest first — **reach for the cheapest one that
can express the assertion**:

| Grade | Tests | Needs | Example suffix |
|---|---|---|---|
| Pure | ring 1 rules | nothing | `*.test.ts` |
| Container | ring 3 services with fake adapters | nothing, or an in-memory db | `*.test.ts` |
| Integration | ring 4 wiring, real SQL | Docker (e.g. testcontainers) | `*.it.test.ts` |

If the project splits a fast unit lane from a slow integration lane by file suffix, the
suffix is **mandatory** for anything DB-backed — a DB test in the unit lane fails in CI for
reasons unrelated to the change. A rule that forces you into the integration lane is a
ring-1 rule stuck in ring 4 — see SKILL.md §1.

## Look before you add

Read the existing ports before inventing a new one; extending a port is often faster and
keeps the contract count down. A typical set looks like:

| Port | Contract | Implementations |
|---|---|---|
| `PaymentGateway` | `charge` · `refund` | stripe · paypal · fake |
| `Mailer` | `send` | smtp · fake |
| `FileStore` | `put` · `get` · `remove` | s3 · local disk |
| `SecretsProvider` | `get` · `set` | env · vault |
| `AuthProvider` | `currentUser` · `currentTenant` | session · no-auth (dev) |

**An internal facade can be a port too — as the exception, not a template.** When a whole
internal subsystem (a search indexer, a recommendation engine) is substituted wholesale in
tests and must only be reached through one entry point, a port protecting that module
boundary is justified. It protects a module boundary rather than a process boundary, so it
needs the same §2 test-substitution argument written next to it.
