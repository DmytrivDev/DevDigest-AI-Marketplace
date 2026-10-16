# Transport: routes as driving adapters

Ring 4's inbound half. Read [SKILL.md](SKILL.md) §3 ban 1 first. For *how* to write a
Fastify route, hook or plugin, use the `engineering-paved-path:fastify-best-practices`
skill. This file is only about what a route is allowed to contain. Examples use Fastify with
`fastify-type-provider-zod`; the rules apply to any HTTP framework.

## A route does four things

A good route module states its contract in its header — "Transport layer only: parses
requests, maps status codes, and delegates all business logic to OrderService." Expanded,
a handler may:

1. **Declare** its `params` / `body` / `querystring` schema
2. **Resolve tenancy** via a request-context helper (`getContext(container, req)`)
3. **Delegate** to exactly one service method
4. **Map** the result to a status code

Anything else is a smell. Concretely, a handler must not contain: a SQL query, a loop over
rows computing a total, an `if` on a business condition, a `try/catch` that decides product
behaviour, or a call to an adapter.

```ts
app.post('/orders', { schema: { body: OrderInput } }, async (req, reply) => {
  const { tenantId, userId } = await getContext(app.container, req);
  const { order, created } = await service.place(tenantId, userId, req.body);
  reply.status(created ? 201 : 200);
  return order;
});
```

Four lines: context, delegate, status, return. `created ? 201 : 200` is the *right* kind of
route logic — it is an HTTP concern, and the service returning `{ order, created }` instead
of throwing on an idempotent retry is what keeps it one.

## Wiring

`routes.ts` is ring 4, so it is the legitimate place to read the container and construct
the module's service — see [SKILL.md](SKILL.md) §4:

```ts
export default async function orderRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new OrderService(app.container.ordersRepo, await app.container.payments(), /* … */);
  service.registerFulfilmentJobHandler();
  // routes…
}
```

**`withTypeProvider<ZodTypeProvider>()` is per-module.** The compilers are set once at app
setup (`setValidatorCompiler` / `setSerializerCompiler`), but each module opts into the
*types* itself. Skip it and your `req.params` is `unknown`.

**Register modules in one static list** (for example `modules/index.ts`: one import, one
entry per module). Static registration works the same under a TS runner, a bundler and the
test runner; dynamic `import()` of `.ts` files is not portable across them.

## Zod at the boundary

**Parse once, at the edge, declaratively.** Validation is schema-first: routes declare
`params`/`body` schemas and the framework parses before the handler runs. Never
`Schema.parse(req.body)` inside a handler — it duplicates what the type provider already did
and it produces a raw `ZodError` instead of the structured envelope the error handler
builds.

The consequence for the inner rings is the point: **ring 3 receives parsed, typed values and
may assume they are valid.** A service re-validating its own arguments is a sign the parse
did not happen at the boundary.

Response schemas are also worth declaring — the serializer will strip unknown fields,
which is the cheapest guard against accidentally returning an ORM row (ban 3) where a DTO
was meant.

## Errors

Keep the taxonomy in ring 1 (for example `src/core/errors.ts`), importable from anywhere:

| Class | Code | Status |
|---|---|---|
| `AppError` | (given) | 400 |
| `NotFoundError` | `not_found` | 404 |
| `ValidationError` | `validation_error` | 422 |
| `ExternalServiceError` | `external_service_error` | 502 |
| `ConfigError` | `config_error` | 500 |

**Services throw these; the route does not catch them.** One app-level error handler turns
an `AppError` into the response envelope (e.g. `{ error: { code, message, details } }`) and
handles schema validation/serialization failures. A `try/catch` in a handler that converts
an error into a different status is business logic in ring 4.

**Adapters translate vendor failures into this taxonomy.** A vendor 404 becomes
`NotFoundError`, a network failure becomes `ExternalServiceError`. A vendor SDK's own error
class reaching ring 3 means the adapter did half its job.

## Degrade, don't throw — when it is a product decision

Some failures are not errors. "Recommendations are best-effort: on failure, omit the
section, don't fail the page." "If the payment provider is unreachable, show the persisted
order status instead of an error."

That choice is a **product rule, not a transport concern**. The pattern to follow: the
service decides to degrade and returns a partial result; the route just returns it. A route
deciding on its own to swallow an error is ring 4 making a ring-3 decision.

## Jobs — the second driving adapter

A job runner (in-process queue, BullMQ, pg-boss) is a driving adapter with no HTTP. A handler
is registered by kind and a payload is enqueued:

```ts
this.jobs.register(FULFILMENT_JOB_KIND, async (payload) => {
  await this.runFulfilment(payload as FulfilmentJobPayload);
});
```

Rules:

- **Register once**, at module setup (`service.registerFulfilmentJobHandler()` from
  `routes.ts`).
- **Payloads are plain serialisable data** — ids and primitives, never a row, a class
  instance or a port. The payload may cross a process boundary; typed handles do not.
- **Job kinds are constants**, in `modules/<name>/constants.ts`. A runner that throws when no
  handler is registered for a kind turns a typo into a runtime failure rather than a silent
  no-op — prefer that.
- **The handler body belongs in the service**, not in the closure — that is what makes
  `runFulfilment` directly testable without the runner.
- **Handle the failure of every enqueued job.** If `enqueue` returns a promise that rejects
  when the job fails and no call site awaits or catches it, Node treats it as an unhandled
  rejection — which terminates the process by default. The symptom is misleading (a separate
  frontend keeps rendering, with empty data), so check the API's health endpoint before
  suspecting the database.

## SSE and other push channels

Same rule as everything else: **services publish domain events to a bus; the route
subscribes and serialises.** The bus carries your own contract types, so ring 3 emits
meaning ("order shipped") and ring 4 decides it becomes an SSE frame or a WebSocket message.
A service formatting an SSE frame has reached outward.
