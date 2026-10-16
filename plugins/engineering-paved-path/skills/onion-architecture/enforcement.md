# Enforcement

The rules in [SKILL.md](SKILL.md) are only real if something can fail on them. Half of them
can be enforced by a command that reads the import graph; the other half need a reviewer.
This file covers both: an **example** dependency-cruiser setup a project may adopt, and the
list of things an import graph cannot see.

Nothing here assumes the project already has such a check. If it does, use its config and
its command; the severity policy and the "cannot check" list below still apply.

## Adopting dependency-cruiser (example)

[dependency-cruiser](https://github.com/sverweij/dependency-cruiser) resolves every import
under a root and checks the resulting graph against `forbidden` rules. Install it as a dev
dependency and add two scripts, for example:

```json
"scripts": {
  "check:architecture": "depcruise src --config .dependency-cruiser.cjs --output-type err",
  "graph:architecture": "depcruise src --config .dependency-cruiser.cjs --output-type dot"
}
```

Run the check before committing backend changes, alongside the typecheck and tests. The
graph script pipes to Graphviz when you want to *see* the rings rather than read violations.

### Example config

Written against the reference layout in SKILL.md (`src/core`, `src/ports`,
`src/modules/<name>/{routes,service,repository}.ts`, `src/adapters`, `src/db`,
`src/platform/container.ts`). Adjust the paths to the project before adopting it.

```js
// .dependency-cruiser.cjs — example, adapt paths to the project
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-not-to-io',
      comment:
        'Ring 1 is pure. Core may not import adapters, db, services, routes or the container. ' +
        'Pass data in as arguments; do the I/O in a service (ring 3).',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: ['^src/(adapters|db|platform|modules)/', 'node_modules/(drizzle-orm|pg|fastify)/'] },
    },
    {
      name: 'core-not-to-node-io',
      comment: 'Ring 1 is pure: no node builtins (fs, net, child_process, …) in core.',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'ports-not-to-implementations',
      comment: 'Ring 2 describes conversations. A port may not import an adapter, the db or a module.',
      severity: 'error',
      from: { path: '^src/ports/' },
      to: { path: '^src/(adapters|db|modules|platform)/' },
    },
    {
      name: 'routes-not-to-orm',
      comment:
        'Ban 1. A route is a driving adapter: parse, delegate, map the status code. ' +
        'Move the query into the module repository and call it through the service.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/routes\\.ts$' },
      to: { path: ['^src/db/', 'node_modules/drizzle-orm/'] },
    },
    {
      name: 'service-not-to-adapters',
      comment:
        'Ban 2. A service depends on the port type from src/ports, never on a concrete adapter. ' +
        'Receive the instance through the constructor.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/service\\.ts$' },
      to: { path: '^src/adapters/' },
    },
    {
      name: 'service-not-to-composition-root',
      comment:
        'Inject ports, not the container (SKILL.md §4). Name the real dependencies in the ' +
        'constructor; the route or the container passes them in.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/(service|repository)\\.ts$' },
      to: { path: '^src/platform/container\\.ts$' },
    },
    {
      name: 'db-not-to-modules',
      comment: 'The schema and db client are ring 4 infrastructure; they must not import module code.',
      severity: 'error',
      from: { path: '^src/db/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'no-circular',
      comment: 'Cycles usually mean a service reaches the container that builds it (SKILL.md §4).',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      comment: 'Nothing imports this file. Delete it or wire it in.',
      severity: 'warn',
      from: { orphan: true, pathNot: ['\\.d\\.ts$', '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$'] },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
```

Ban 4 (a pure core package must not import the app hosting it) needs the cruise to start
from the repository root so both packages are in the graph — for example a second config
with `from: { path: '^packages/core/' }, to: { path: '^apps/api/' }`.

## Severity policy

This is the part to preserve when you add rules:

- **A rule that is clean when adopted is `error`.** It cannot regress.
- **A rule with pre-existing violations is `warn`**, with the known offenders named in the
  rule's own `comment` (or in the project's docs / knowledge files).

`warn` keeps the exit code at 0, so the build stays green while the debt stays visible. It
is not permission — new code must not add to a `warn` rule. **When the last violation of a
`warn` rule is fixed, promote it to `error` in the same commit.** That is the ratchet;
without it the warnings become wallpaper.

## Rule shape

```js
{
  name: 'routes-not-to-orm',
  comment: 'Ban 1. A route is a driving adapter: parse, delegate, map the status code…',
  severity: 'warn',            // error | warn | info | ignore
  from: { path: '^src/modules/[^/]+/routes\\.ts$' },
  to:   { path: ['^src/db/', 'node_modules/drizzle-orm/'] },
}
```

`from` and `to` are regexes over **paths relative to the cruise root**. npm packages resolve
to their real location, so matching one means matching `node_modules/<pkg>` — under pnpm that
is `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/…`, which a substring match like
`node_modules/drizzle-orm/` still catches.

Two filters worth knowing: `dependencyTypes: ['core']` matches node builtins, and
`dependencyTypesNot: ['type-only']` lets a rule ignore `import type` (useful when a ring may
name a type from outside but must not depend on it at runtime).

**Write the `comment` for the person who trips the rule.** It is printed with the violation,
so it is the only documentation they are guaranteed to read. Say which ban it is, why the
arrow points the wrong way, and what to do instead — not just "forbidden".

## Adding a rule

1. Express the ban as *"files matching X must not import files matching Y"*. If you cannot,
   an import graph cannot check it — put it in the SKILL.md §6 review checklist instead.
2. Add it at `severity: 'ignore'` (or `info`) and run the check to see what it catches. A
   rule that fires on dozens of files is describing a different architecture than the one
   the project has.
3. Set the severity by the policy above: clean → `error`, pre-existing → `warn` with the
   offenders named.
4. If it is a new ban, record it in the project's architecture docs so reviewers know it exists.

## What an import graph cannot check

dependency-cruiser sees imports. It does not see the following, so a reviewer (human or
agent) must judge them on every backend change:

- **A service taking the container without importing it** — the rule above catches the
  *import* of `container.ts`. A service typed against a structural `{ db: Db; … }` bag, or
  one that receives the container untyped, slips through. So does a constructor that `new`s
  its own repository: the import is legal, the substitution is gone.
- **An ORM row type escaping a module** (ban 3) — the type flows through a return
  signature, not an import. The typecheck catches it only if the consumer lives in another
  package; otherwise this one is on review.
- **A business rule sitting in the wrong ring** — a `for` loop computing a total inside a
  route is perfectly legal imports-wise. The signal for this one is behavioural: the test
  needs a database. See SKILL.md §1.
- **A port with one implementation and no test substituting it** (SKILL.md §2) — the graph
  shows an interface and a class, not whether the indirection earns its keep.
- **A transaction held open across a port call**, a job payload carrying a row instead of
  ids, or an unawaited job promise — all runtime behaviour, see
  [persistence.md](persistence.md) and [transport.md](transport.md).
- **Pre-existing versus new** — the graph reports every violation; only the diff tells you
  which ones the change added. Report only those (SKILL.md §5).

The command catches the mechanical half; the checklist catches the half that needs
judgement.
