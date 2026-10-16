---
name: onion-architecture
description: "Enforces Onion Architecture in Node.js/TypeScript backends and MCP servers: which ring a file belongs to, the inward-only dependency rule, when a port/interface is justified, where business rules live vs. routes vs. repositories, and how Fastify, an ORM such as Drizzle, Zod, a DI container / composition root and the MCP SDK map onto the rings. Use when adding or moving any backend file, creating a module, writing a route, service, repository or MCP tool, introducing an adapter for an external system, placing a business rule, or reviewing a backend PR for layering. Applies to one-file changes — that is how layering erodes."
metadata:
  version: 1.0.0
---

# Onion Architecture (backend)

Answers one question: **which ring does this code belong to, and what is it allowed to
import?**

Most backends already have the shape of an Onion without the name: a package of pure rules
that never touches I/O, a set of interfaces that "all external calls go behind", a folder of
adapters, and one file that wires everything together. This skill names those rings, states
the rule that binds them, and makes it checkable.

Related skills, deliberately not repeated here: `engineering-paved-path:fastify-best-practices`
(how to write a route), plus whatever ORM, schema and database-design guidance the project
uses. Those tell you how to write the thing. This tells you where it goes and what it may
touch. Sources for every claim are in [README.md](README.md).

## The rule

> All code can depend on layers more central, but code cannot depend on layers further out
> from the core. — Jeffrey Palermo, 2008

Stated as an import rule, which is how you actually check it:

**A file may import from its own ring and from rings closer to the core. Never outward.
An inner ring must not name an outer ring's type, class, file or package.**

There is exactly one place where this is broken on purpose: the **composition root**
(for example `src/platform/container.ts`), which knows every ring because its whole job is
wiring them together. Nothing else gets that privilege.

## The four rings

The paths below are a reference layout used in every example of this skill. Map them onto
the project's real folders before applying the rules — the rings matter, the folder names
do not.

```
src/
  core/                        ring 1  shared pure rules, the error taxonomy
  ports/                       ring 2  interfaces + the types they speak
  modules/<name>/
    <rule>.ts  (pricing.ts)    ring 1  pure rules owned by one module
    helpers.ts                 ring 1  pure mappers (row → DTO)
    service.ts                 ring 3  use cases
    repository.ts              ring 3  data access chokepoint
    routes.ts                  ring 4  driving adapter (HTTP)
  adapters/<tech>/             ring 4  driven adapters (SDKs, network, fs)
  db/                          ring 4  schema, client, migrations
  platform/container.ts        composition root
```

| # | Ring | Where it lives (reference layout) | May import |
|---|---|---|---|
| 1 | **Core** — pure rules, no I/O | `src/core/**`, `modules/*/`{`<rule>`,`helpers`}`.ts`, a separate pure package if the project has one | ring 1 only (+ a schema library such as `zod`) |
| 2 | **Ports** — technology-neutral interfaces | `src/ports/**`, or a shared contracts package | rings 1–2 |
| 3 | **Application** — use cases, orchestration, tenancy | `modules/*/service.ts`, `modules/*/repository.ts`, request-context helpers | rings 1–3 |
| 4 | **Adapters** — everything technology-specific | `modules/*/routes.ts`, `adapters/**`, `db/**`, job runner, SSE bus, config loading, the container | rings 1–4 |

Two things to internalise about this table:

- **A folder is not a ring.** A `platform/` or `lib/` folder is usually a grab-bag: the
  domain error taxonomy is core (services import it), the container is the composition root,
  the job runner and SSE bus are infrastructure. Check the file, not the folder.
- **Ring 4 is the widest and cheapest to change; ring 1 is the narrowest and most stable.**
  If you find yourself widening ring 1's imports to make something compile, you are
  putting the rule in the wrong place.

## Order of decisions

Work outside-in. Each answer constrains the next:

1. **Ring** — does this touch I/O? → §1
2. **Port** — does it cross a process boundary? → §2
3. **Direction** — what may it import? → §3 (the four bans)
4. **Dependencies** — what gets injected? → §4
5. **Shape** — what crosses the module boundary? → [persistence.md](persistence.md)

## 1. Which ring

Ask one question, in this order, and stop at the first yes:

| Question | Ring | Home |
|---|---|---|
| Is it a pure function of its inputs — no db, no fetch, no fs, no clock, no random? | 1 Core | `modules/<name>/<rule>.ts`, or `src/core/` if several modules (or another package) need it |
| Is it an interface describing a conversation with something outside the process? | 2 Port | `src/ports/<concept>.ts` |
| Does it orchestrate a use case — several ports, tenancy, a transaction? | 3 Application | `modules/<name>/service.ts` |
| Does it speak a specific technology — HTTP, SQL, an SDK, git, the filesystem? | 4 Adapter | `modules/<name>/routes.ts` or `adapters/<tech>/` |

**Default to ring 1 and move outward only when forced.** A rule that starts in a route is
almost never moved later; a rule that starts as a pure function is trivially promoted.

A typical example: an order-total calculation written inline in `orders/routes.ts` can only
be tested by booting the server against a database. Pulled out to
`modules/orders/pricing.ts` as `orderTotal(items, discounts)`, it is tested with a plain
array, in milliseconds, with no container and no Docker. Every rule that moves this way
makes the slow integration suite smaller.

> **Ring 1 is the test-speed ring.** If a rule needs a database to test, it is in the wrong
> ring. That is the cheapest signal you have that the layering slipped, and it shows up
> before review does.

## 2. When a port is justified

A port is an interface in ring 2 that an adapter implements and a service depends on. Ports
are not free — each one is a second definition to keep in sync, and if ports live in a
shared contracts package (or one copied into several apps), every new port is an edit in
every consumer.

Write a port when **at least one** holds:

- it crosses a **process boundary** — network, disk, subprocess, another machine
  (`PaymentGateway`, `Mailer`, `FileStore`, `SecretsProvider`, `LLMProvider`)
- a **test must substitute it** to stay fast or deterministic (that is what container
  overrides exist for — see [ports-and-adapters.md](ports-and-adapters.md))
- there are genuinely **two implementations** (`PaymentGateway` → stripe / paypal)

Do **not** write a port for an internal helper, a single-implementation class with no test
substitution need, or "in case we swap it later". Victor Rentea's rule applies: question
any interface with a single implementation in the same module. An unjustified port is pure
indirection — the Middle Man smell, not an abstraction.

**Naming and shape:** a port describes the *conversation*, not the library.
`PaymentGateway.charge(order)` charges an order; it does not expose the SDK's request
object. If the port's method signatures mention a vendor type, the abstraction has already
failed — the whole point is that ring 3 never learns which SDK is underneath.

See [ports-and-adapters.md](ports-and-adapters.md) for the adapter side and the container.

## 3. The four bans

Each is an inward-only violation and each is mechanically checkable
([enforcement.md](enforcement.md)).

**Ban 1 — a route must not import the ORM or the db schema.**
A route is a driving adapter: parse, delegate, map the status code. SQL in a route skips
rings 3 and 2 entirely, which means the rule cannot be unit-tested and tenancy scoping is
re-implemented per endpoint. A good route file can state its contract in one header line:
"Transport layer only: parses requests, maps status codes, and delegates all business logic
to OrderService."

**Ban 2 — a service must not import a concrete adapter.**
`service.ts` imports the *type* from `src/ports/`, never `../../adapters/payments/stripe.js`.
Instances arrive through the constructor. This is the Dependency Inversion half of Onion;
without it the ring-3 → ring-4 arrow points outward and nothing above the adapter is
testable.

**Ban 3 — an ORM row type must not leave its module.**
`typeof orders.$inferSelect` (or any ORM entity) is a persistence shape. It may be the
repository's internal currency and may be passed to a mapper, but what crosses the module
boundary is the DTO (`toOrderDto` in `modules/orders/helpers.ts`). Leak it and every
consumer is coupled to the column layout — and to the ORM's casing when the wire contract
uses another. Details in [persistence.md](persistence.md).

**Ban 4 — a pure core package must not import from the app that hosts it.**
If the project has a separate package of pure rules (for example `packages/core`, reused by
a CLI, a worker or CI), that package has no I/O and no dependency on the server
(`apps/api`), because the same code runs in more than one host. Making this structural
usually means running the boundary check from the repository root across both packages.

## 4. Inject ports, not the container

A service's constructor is its dependency declaration. Make it name what it actually needs:

```ts
// ring 3 — depends on ring 2 types only
export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly payments: PaymentGateway, // port, from src/ports
    private readonly mailer: Mailer,           // port
    private readonly jobs: JobRunner,
  ) {}
}
```

not:

```ts
// ring 3 depending on the composition root — the arrow points outward
constructor(private container: Container) {
  this.orders = new OrderRepository(container.db); // and constructs its own collaborator
}
```

Taking the whole `Container` looks convenient and costs three things: the service now
depends on the composition root (ring 4), its real dependencies are invisible in the
signature, and a unit test must build a container instead of passing two fakes. The
`new OrderRepository(...)` inside the constructor compounds it — the collaborator can no
longer be substituted at all. It also produces import cycles: the container imports the
service to build it, and the service imports the container to reach its dependencies.

**Where the wiring goes:** the composition root. Repositories shared by several modules are
constructed there too ("constructed in the composition root, so consuming modules use
`container.customersRepo` instead of reaching into another module's folder"). Extend the
project's existing wiring pattern; do not invent a second one.

**Routes stay the assembly point for their module.** `routes.ts` is ring 4, so it is
allowed to read the container (e.g. `app.container` decorated on a Fastify instance) and
hand the pieces to the service constructor. That is the one place the container is
legitimately touched outside itself.

## 5. Pre-existing violations

**Do not learn this architecture by reading neighbouring code.** In most codebases parts of
the backend predate the rules and violate them. Copying the file next to yours is the single
most likely way to add a new violation — check the file you copy against §3 and §4 first.

Known violations belong to the project, not to this skill. Projects record them in their own
docs, in the `comment` of a `warn`-level boundary rule, or in the knowledge files named in
`.claude/sdd-engineering.json` under `knowledgeFiles`. The rule for everyone:

- **New code does not add to them; existing code migrates when you are already touching it.**
- **Reviewers do not report a pre-existing violation** unless the change under review adds
  to it — a new call site, a new import of the same kind, or a copy of the pattern into a new
  file.

## 6. Checking

If the project has an import-boundary check (dependency-cruiser, eslint-plugin-boundaries,
Nx module boundaries), run it before committing backend changes, alongside the typecheck and
tests. If it does not, [enforcement.md](enforcement.md) has an example dependency-cruiser
config that encodes the four bans, which the project may adopt.

Review checklist, in the order violations actually appear:

1. Does any new `routes.ts` import the ORM or the db schema? → ban 1
2. Does any new `service.ts` import from `adapters/`? → ban 2
3. Does a new constructor take `Container`, or `new` its own collaborator? → §4
4. Does a repository method's return type escape the module? → ban 3
5. Does a new rule need a database to test? → §1, it is in the wrong ring
6. Does a new interface have one implementation and no test substituting it? → §2, delete it

Items 3 (the `new` half), 4 and 5 cannot be seen in an import graph — they are always on
the reviewer.

## Where the sources disagree

Marked **[choice]** — this skill picked a side for consistency, not because the other is
wrong. Full discussion in [README.md](README.md).

- **[choice] Four rings, not three or five.** Allegro Tech calls a five-layer split with
  separate Repository and Service layers over-engineering and recommends three. We keep
  four because ports are worth a ring of their own — collapsing them into "application"
  hides the one boundary that is hardest to get right and easiest to violate silently.
- **[choice] Repositories stay, for tenancy and test speed — not for swapping the
  database.** Jay Freestone argues a typed query builder makes repositories "a worse
  interface over your database", and that database-swapping is a myth. Largely true.
  Repositories earn their keep for two other reasons: they are the chokepoint where tenant
  scoping is guaranteed, and they let ring-1 rules be tested without Docker. A repository
  that serves neither purpose is dead weight.
- **[choice] No separate persistence model.** Rentea: maintaining domain entities *and* ORM
  entities quadruples CRUD code and teams regret it within two years. Map at the module
  boundary (DTO) and nowhere else. ORM rows are the in-module currency.
- **[choice] Thin controllers are accepted.** Rentea calls one-line controllers
  boilerplate. Routes with a schema-first framework are rarely one-liners — they own schema
  declaration, tenancy resolution and status-code mapping — so the layer pays for itself.

## Reference files

- [ports-and-adapters.md](ports-and-adapters.md) — ports, adapters, the composition root, testing with container overrides
- [persistence.md](persistence.md) — repositories, DTO mapping, transaction boundaries, the transitive-tenancy invariant
- [transport.md](transport.md) — routes as driving adapters, Zod at the boundary, errors, jobs and SSE
- [enforcement.md](enforcement.md) — an example dependency-cruiser config, severity policy, what an import graph cannot see
- [mcp.md](mcp.md) — the same rings inside an MCP server: tools as driving adapters, the API client as a driven port
- [README.md](README.md) — every source, and where they contradict each other
