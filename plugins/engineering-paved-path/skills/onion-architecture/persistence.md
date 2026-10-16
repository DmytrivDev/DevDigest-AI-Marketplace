# Persistence: repositories, DTOs, transactions

Ring 3's data-access half and its boundary with ring 4. Read [SKILL.md](SKILL.md) §3 ban 3
first. Examples use Drizzle ORM; the rules apply to any typed query builder or ORM. For
*how* to write a query, use the project's ORM guidance — this file is only about where the
query may live and what may come back out.

## Why keep repositories at all

Honestly: **not** to swap the database. Jay Freestone's critique lands — with a typed query
builder, a repository that grows `findActiveById`, `getWithProduct`, `listByFilter(opts)`
becomes a worse interface over the database than the database's own. And swapping Postgres
for something else would change the problem, not just the driver.

Repositories earn their keep for two different reasons, and **a repository that serves
neither is dead weight**:

1. **Tenancy chokepoint.** In a multi-tenant app every domain table carries a tenant key
   (`tenant_id`, `workspace_id`, `account_id`). Concentrating queries in one class per table
   makes "is this scoped?" a property you can verify by reading one file, instead of an
   invariant re-checked at every call site.
2. **Test grade.** With persistence behind a class, ring-1 rules take rows as arguments and
   test with no Docker. That is how `orders/pricing.ts` gets unit coverage while the same
   logic inline in the route would need an integration test.

So: a repository is a **table-scoped, tenancy-guarding query chokepoint**, not a domain
abstraction. Name it after the table, not a fantasy aggregate.

## Shape

```ts
export class OrderRepository {
  constructor(private db: Db) {}

  async getById(tenantId: string, id: string): Promise<OrderRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.orders)
      .where(and(eq(t.orders.tenantId, tenantId), eq(t.orders.id, id)));
    return row;
  }
}
```

Rules:

- **The tenant key is the first parameter of every read and write.** Not optional, not
  defaulted, not pulled from ambient state. A method that cannot be scoped needs a comment
  saying why.
- **One table per repository** — the header can say so: "The only place that touches the
  `orders` table." Cross-table reads used by several modules go in shared repositories
  built by the composition root (`container.customersRepo`), not by reaching into another
  module's folder.
- **No business rules.** A repository filters, sorts, paginates and writes. It does not
  decide what a discount means or which order counts as late. Those are ring 1.
- **Inject `Db`, not `Container`.** `constructor(private db: Db)`, always.

## The DTO boundary (ban 3)

`type OrderRow = typeof t.orders.$inferSelect` is a *persistence* shape. Two things make it
unfit to cross a module boundary:

- it is coupled to the column layout — adding a column changes every consumer's type
- its casing follows the ORM (**camelCase**), while the wire contract is often
  **snake_case** (`total_cents`, `created_at`)

So the mapper is not ceremony, it is the place where that translation happens exactly once:

```ts
export function toOrderDto(row: typeof t.orders.$inferSelect): Order {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    total_cents: row.totalCents,
    placed_at: row.placedAt?.toISOString() ?? null,
    // …
  };
}
```

Note what else it does: `Date → ISO string`. Dates are the other thing that must not escape
— a `Date` serialises differently depending on who calls `JSON.stringify`, and the contract
says string.

**Where mappers live:** `modules/<name>/helpers.ts`, as pure ring-1 functions. They are
trivially unit-testable and they keep `service.ts` free of field-by-field copying.

**What we deliberately do not do:** maintain a separate domain entity alongside the ORM
row. Rentea's warning is the reason — a parallel persistence model quadruples CRUD code and
teams regret it within two years. One shape inside the module, one DTO at its edge. That is
the whole mapping budget.

## Transactions

**The service owns the boundary; the repository does not know it is in one.** The service
is the only layer that knows the scope of a business operation, so it decides what is
atomic. The repository must work identically inside and outside a transaction, or it stops
being reusable.

Drizzle's transaction handle is the same shape as the db handle, which makes this cheap —
pass it in:

```ts
// ring 3 — the service decides what is atomic
await this.db.transaction(async (tx) => {
  const order = await this.orders.insert(tx, tenantId, values);
  await this.orderItems.insertMany(tx, order.id, items);
});
```

```ts
// ring 3 — the repository accepts either handle and never opens its own
async insert(db: Db | Tx, tenantId: string, values: InsertOrder) { … }
```

Two failure modes to avoid:

- **A repository opening its own transaction.** Two repositories in one use case then commit
  independently and a half-finished write survives a failure.
- **A transaction held open across a port call.** Never `await this.payments.charge(...)`,
  an LLM call or any network request inside `db.transaction`. A thirty-second external call
  inside an open transaction holds a connection and its locks for thirty seconds. Do the I/O
  first, then open the transaction around the writes.

Drizzle has no ambient/implicit transaction context (it is a long-standing open request),
so the handle is passed explicitly. That is not a workaround to fix — it is what makes the
boundary visible in the signature.

## The transitive-tenancy invariant

A genuine trap, and it is invisible in the schema.

**A child table often has no tenant column of its own.** `order_items` has `order_id` but no
`tenant_id`; tenancy is inherited *transitively* through `orders.tenant_id`. Consequences:

- an `order_items` query is safe **only** when its `order_id IN (…)` list came from an
  already-tenant-scoped read
- you cannot query items by any other key (product, date) without first going through the
  scoped parent
- never add an `order_items` query scoped by `product_id` alone

This is an architectural invariant living in a layer, not in a constraint — precisely the
kind of rule that erodes silently when a route starts querying tables directly (ban 1). It
is also the clearest argument for keeping the repository chokepoint: the guard has to live
*somewhere*, and the schema has declined to hold it. When you find one of these tables,
write the invariant in the repository's header comment.

## Schema changes

Ring 4, and mechanical:

1. edit the schema files (`db/schema/*.ts`)
2. generate the migration with the project's migration tool (for Drizzle, `drizzle-kit
   generate`)
3. apply it with the project's migrate command

Prefer generated migrations over hand-written SQL, never rename or edit a migration that has
already been applied anywhere, and do not assume migrations run on boot — check how the
project applies them. Two branches that each generate a migration for the same column will
collide on merge; regenerate on top of the merged schema instead of keeping both files.
