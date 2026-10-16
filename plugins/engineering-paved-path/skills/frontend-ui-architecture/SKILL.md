---
name: frontend-ui-architecture
description: "Decides where frontend UI code belongs and how far to split it: component homes, file roles (constants, helpers, styles, barrels), business-logic and state placement, and the App Router server/client boundary. Use when creating, moving or renaming any React/Next.js file, extracting a helper or constant, choosing route-local vs shared vs design system, placing data fetching or business rules, or reviewing a PR that adds UI files. Applies even to one-file changes — that is how structure erodes."
metadata:
  version: 1.0.0
---

# Frontend UI Architecture

Answers one question: **where does this code belong, and how far do I split it?**

This is deliberately separate from `engineering-paved-path:react-best-practices`
(anti-patterns, hooks misuse, memoization) and `engineering-paved-path:next-best-practices`
(which file does what, async APIs, runtime). Those tell you how to write a component
correctly. This tells you where to put it.

Every rule below carries its reasoning, because the reasoning is what lets you handle the
case this file did not anticipate. Where respected sources genuinely disagree, that is
marked as **[choice]** — it means this skill picked a side for consistency, not that the
other side is wrong. When the project has already settled one of these choices differently
and consistently, follow the project. Sources for every claim are in [README.md](README.md).

Examples use a shop app: `src/app/(shop)/cart/`, `src/components/`, `src/ui/`. Map them onto
the project's real folders.

## Order of decisions

Work outside-in. Each answer constrains the next:

1. **Radius** — who uses this? → picks the folder (§1)
2. **Anatomy** — what files does it need? → picks the file roles (§2)
3. **Split** — is it one component or several? → §3
4. **Logic** — where do the rules and the data live? → §4, §5
5. **Boundary** — server or client? → §6

## 1. Where a component lives

Three homes, chosen by **radius of use** — not by what the component looks like:

| Radius | Home | Import as |
|---|---|---|
| One route segment | `src/app/<route>/_components/<Name>/` | `./_components/<Name>` |
| Several routes | `src/components/<Name>/` | `@/components/<Name>` |
| Design system primitive | `src/ui/` (or the project's design-system package) | `@/ui` (or the package name) |

**Start in the narrowest home that fits and promote later.** A component invented for one
route belongs beside that route (`src/app/(shop)/cart/_components/CartRow/`); moving it up
when a second route needs it is a cheap, mechanical refactor, while guessing wrong upfront
produces a shared folder full of single-consumer components that nobody dares touch.

Next.js guarantees this is safe: a route is not publicly reachable until it contains
`page.tsx` or `route.ts`, so any file may sit inside `app/`. The `_` prefix additionally
opts a folder out of routing — and protects against collisions with future Next.js file
conventions.

**Before creating a primitive, search the design system first.** It usually already ships
the tokens, `Button`, `Badge`, `Chip`, `Tooltip` and animation keyframes you are about to
write. Most "new" UI is composition of existing primitives, not new CSS.

**[choice] Features live inside route segments, not in a parallel `src/features/`.**
Feature-Sliced Design argues `app/` should be routing-only with domain code in `src/`;
Next.js explicitly declines to arbitrate and calls itself unopinionated. Colocate when
routes map roughly 1:1 onto features, because a parallel tree would mean every change
touches two places. If a feature outgrows its route or gets used by three or more routes,
promote it to `src/components/` rather than inventing a third tree.

## 2. Anatomy of a component folder

One folder per component. Each file has a single role, and you add a file only when there
is something to put in it:

```
OrderCard/
  OrderCard.tsx          component: JSX + composition only
  OrderCard.test.tsx     colocated test
  constants.ts           magic values, lookup maps, column config
  helpers.ts             pure functions extracted from the component body
  styles.ts              styles, if the project keeps them out of JSX (see §7)
  index.ts               barrel: the folder's public API
  _components/           children used only by this component
```

**Why split by role rather than keeping one long file:** each of these has a different
reason to change and a different audience. A designer edits the styles, a test reads
`helpers.ts` without mounting React, and `constants.ts` is where you look when a value
appears wrong. Pure functions in `helpers.ts` are testable without a renderer — this is the
"humble object" idea: shrink the part that is hard to test until what remains is trivial.

**`index.ts` is the folder's public API — and the only barrel you may write.**
It re-exports the component and carries a one-line comment saying what the folder is for:

```ts
/* PriceTag — formatted price with currency and optional strike-through
   discount, for the cart and the product page. Public surface: the component itself. */
export { PriceTag } from "./PriceTag";
```

**[choice] Narrow barrels only.** This is the sharpest conflict in the whole field. Every
measurement runs against barrels — one real project went from ~11k modules per page to
~3.5k by deleting internal ones, and at 25k modules a test runner burns minutes before
running a single assertion. Every encapsulation argument runs for them, because a barrel is
the only way TypeScript can express "this folder has a public face". Keep the one-component
barrel (small, cohesive) and forbid the thing that actually causes the damage: **never write
a barrel that aggregates many modules**, e.g. a `src/components/index.ts` re-exporting
everything. Import siblings by their real path.

Also avoid same-directory barrel imports (`OrderCard.tsx` importing from `./index`) —
that is a cycle that JavaScript tolerates and bundlers fail on with unhelpful errors.

## 3. When to split a component

There is no line count. Sources that publish one ("fits on a laptop screen", "more than
five props") disagree with sources that refuse to, and the refusers have the better
argument: length is a symptom, not the disease. **Long JSX is fine. Split when you hit an
actual problem:**

- **Two jobs.** A component either *implements* something or *composes* other components.
  Doing both is the most reliable signal to split.
- **Unrelated state.** State that has nothing to do with the component's purpose (a modal's
  open/closed flag) drags the whole subtree into re-rendering. Push it into its own
  component so React can skip the rest.
- **Reuse actually happened.** Not "might be reused" — a second caller exists.
- **The test is awkward.** If you cannot test a rule without mounting the component, the
  rule wants to be a function in `helpers.ts`.
- **Merge conflicts.** Two people editing one file every sprint is a structural signal.

Do **not** split for hypothetical reuse. A wrong abstraction is more expensive than
duplication, because every later case gets bent to fit it. Ask "haven't I written this
before?" twice; act on the third.

**Never define a component inside another component's render** — it gets a new identity
every render, so React unmounts and remounts the whole subtree, losing state and DOM focus.

**Naming:** folders and component files are PascalCase and match the component name. Only
PascalCase functions may return JSX; a camelCase `renderThing()` helper is not a component
and breaks reconciliation and hooks. Non-component files are lowercase
(`constants.ts`, `helpers.ts`). **[choice]** — there is no industry consensus here (Google
says `snake_case`, most React tooling says kebab-case); match what the project already does,
and default to the convention above in a new project.

## 4. Constants, helpers, types

**Constants** live in the `constants.ts` next to the component that owns them, and move up
only when a second consumer appears. A value earns a name when it carries meaning that the
literal does not: a magic number is one that "occurs multiple times without an explicit
meaning". `0`, `1` and `-1` in an obvious context do not need naming; `SKELETON_ROWS = 6`
does.

Prefer `as const` objects over TypeScript `enum`. Numeric enums emit a reverse mapping and
silently accept any raw number, and enums are nominal in a structurally-typed language, so
two identical enums are incompatible. The TypeScript handbook itself says you "may not need
an enum when an object with `as const` could suffice". If you inherit an enum, initialize
every member explicitly — implicit members renumber themselves when reordered, which
corrupts anything already persisted. Never use `const enum`; it breaks under
`isolatedModules`, which is the one point all sources agree on.

**Constants that must stay in step belong in the same file, with the coupling written down.**
A table's `COLUMN_KEYS` and its `GRID` template (e.g. in
`src/app/(shop)/orders/constants.ts`) must stay length-aligned or header and cells misalign
silently — the comment saying so is doing real work.

**Helpers** are pure functions lifted out of the component body. Pure means same input,
same output, no mutation of anything it did not create. React assumes purity and
double-invokes components in StrictMode specifically to expose violations.

**Do not create a `utils.ts`.** A module named `utils` is where code goes to be forgotten:
it has no owner, no cohesion, and nothing tells you whether a function inside is still used.
Name modules after the domain concept instead — `lib/money.ts`, `lib/product-urls.ts`,
`lib/shipping-rates.ts`. If you cannot name the module after a concept, you have not found
the concept yet, and the function probably belongs beside its single caller.

**Types** that describe something crossing the wire come from the project's shared contracts
(for example Zod schemas in a contracts package or `src/contracts/`) — never hand-duplicate
them. Component-local types stay in the component file. If the wire format and the database
layer use different casing (`unit_price` vs `unitPrice`), the UI uses the wire shape only.

Import types with `import type`. Single-file transpilers have no type information and
cannot tell a type import from a value import, and a stray value import of a type-only
module can change runtime behaviour by pulling in side effects.

## 5. Where business logic lives

The decision that matters most, and the one with the most confused advice. Use this ladder:

1. **Pure rules → a plain function** in `helpers.ts` or a domain module in `lib/`.
   Formatting, calculation, validation, mapping. React's own rule is explicit: if a function
   calls no hooks, it must **not** be named `use*`. Pure logic needs no React at all, and
   keeping it out means you can test it without a renderer.
2. **Stateful or effectful logic → a custom hook** (for example in `lib/hooks/`). A hook is
   the thin adapter that holds state, subscribes, or fetches — and then calls the pure
   functions. Hooks share *logic*, never *state*: two components calling the same hook get
   independent state. To share state, lift it.
3. **Server data → a query hook**, never component bodies. All HTTP goes through one client
   module (for example `lib/api.ts`); every data hook lives in one place (`lib/hooks/*`).
   Never copy query results into `useState` — the copy silently stops receiving background
   updates.
4. **Components → render and trigger events.** A component reads props, renders, and calls
   handlers. Squeezing everything into components *or* into hooks is the failure mode at
   both extremes.

**[choice]** No clean/hexagonal layer in the frontend (domain classes, ports, adapters). It
buys testability already bought by pure helpers, and the cost of carry — every future change
paying for indirection nobody reads — is real. Layering pays off at a larger granularity;
for backends, see `engineering-paved-path:onion-architecture`.

### Where state lives

Four buckets, in order of preference. Reach for the first that fits:

- **Server data** → a server-state library such as TanStack Query, via the data hooks. It is
  not a fetching library, it is an async state manager; the cache *is* the state.
- **URL** → filters, sorting, pagination, the selected tab. If a user should be able to
  share or reload the page and see the same thing, it belongs in search params.
- **Local** → `useState` / `useReducer` in the component that uses it. Colocate it: state
  pushed down means React never visits the siblings.
- **Shared** → props first, then Context. Context is dependency injection (theme, current
  store, toasts), not a state manager; every consumer re-renders on every change, so split
  contexts by concern and render providers as deep as they can go.

Never store what you can derive. If a value is computable from props or state, compute it
during render — storing it creates two sources of truth that drift.

## 6. The Next.js boundary

**Read [nextjs-architecture.md](nextjs-architecture.md)** before adding a route, a layout,
a Server Action, or any server-side data access. The essentials:

Two rules organize everything: **code crosses the boundary through imports, data crosses
through props.** And **ownership, not nesting, decides where a component renders** — a
Client Component can be the *parent* of a Server Component but never its *owner*.

`'use client'` marks an entry point, not a file-by-file annotation: the directive makes that
module and **all of its transitive imports** client modules. So put it at the top of the
client subtree and let the rest inherit — adding it everywhere is noise, and adding it too
high drags the whole tree into the bundle.

**Find out which rendering model the project uses before you change anything.** Some
App Router apps render on the server and read data in Server Components; others mark most
pages `'use client'` and fetch from a separate API with a client-side query library, using
the App Router mainly for routing and layouts. Both are legitimate. Do not "fix" the second
into the first in passing — converting a page to a Server Component changes its data
fetching, its hooks and its tests. Follow the existing pattern unless a change is explicitly
about the rendering model.

## 7. Styles, tests, i18n

**Styles** follow the project's chosen approach — Tailwind utility classes in JSX, CSS
Modules (`OrderCard.module.css`), or a `styles.ts` beside the component exporting a single
`s` object of `CSSProperties` (state-dependent values as functions:
`s.card(focused, statusColor)`). Whatever the approach, colours and spacing come from the
design tokens (CSS custom properties such as `var(--border)`, or the Tailwind theme) —
never a hardcoded hex. Do not mix approaches inside one component.

One real trap with inline style objects: **never mix a CSS shorthand with its longhand**
(`border` together with `borderLeftWidth`). React warns and the result flickers between
renders. Use all-longhand.

**Tests** are colocated: `OrderCard.test.tsx` beside `OrderCard.tsx`. No tool forces
this — Vitest's default glob matches tests anywhere and Testing Library has no opinion — so
it is a project decision, chosen because a test that lives next to its subject gets updated
with it. If the project splits fast and slow test lanes by file suffix, follow the suffix.

**i18n**: if the project uses message catalogs (next-intl, i18next), keep one namespace per
feature area with dot-path keys (`orders.columns.total`). Check how a missing key behaves —
many libraries **render the raw key rather than throwing**, so a typo ships silently. Add
the key in the same change that adds the string.

## Anti-patterns

- A `utils/` folder, or any module named for what it *is* rather than what it is *about*.
- A wide barrel re-exporting many modules; or importing from `./index` inside the folder.
- Storing derived values in state, or copying server data into `useState`.
- A "reusable" component or hook with exactly one caller, created for a future that has not
  arrived.
- `renderThing()` returning JSX, or a component defined inside another component.
- Promoting to `src/components/` on the first use rather than the second.
- Adding a column to a table without updating every coupled constant (`COLUMN_KEYS` and
  `GRID`).

## Further reading

- [component-anatomy.md](component-anatomy.md) — file roles, barrels, naming, promotion
  mechanics, worked before/after examples.
- [logic-and-data.md](logic-and-data.md) — the logic ladder in depth, state buckets, query
  hook conventions, validation placement.
- [nextjs-architecture.md](nextjs-architecture.md) — server/client boundary, layouts vs
  templates, route groups, parallel routes, Server Actions, the Data Access Layer pattern.
- [README.md](README.md) — every source behind these rules, with the conflicts spelled out.

Unless the project adds a boundary linter (eslint-plugin-boundaries, dependency-cruiser),
these structure rules hold only by review and habit. That is precisely why the reasoning is
written down: a rule you understand survives, a rule you merely obey does not.
