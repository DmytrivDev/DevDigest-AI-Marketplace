# Component Anatomy

Detail behind §1–§3 of [SKILL.md](SKILL.md): file roles, barrels, naming, and the mechanics
of moving a component between homes.

## Contents

- [The five file roles](#the-five-file-roles)
- [Choosing the home](#choosing-the-home)
- [Promotion: moving a component up](#promotion-moving-a-component-up)
- [Barrels in practice](#barrels-in-practice)
- [Nesting `_components`](#nesting-_components)
- [Worked example: splitting an overgrown component](#worked-example-splitting-an-overgrown-component)
- [Naming reference](#naming-reference)

## The five file roles

Add a file only when it has content. A component with no magic values needs no
`constants.ts`, and creating empty scaffolding is noise.

### `<Name>.tsx` — the component

Holds JSX, composition, hook calls and event wiring. It should read top-to-bottom as a
description of the UI, not as a pile of computation. If you are scrolling past logic to
find the markup, the logic wants to move to `helpers.ts`.

Order inside the file: imports → module-level constants → the component → any small
internal subcomponent. Helper functions go in `helpers.ts`, not at the bottom of this file,
so they can be tested without importing React.

### `<Name>.test.tsx` — the test

Colocated so it moves with the component and gets updated in the same edit. Tests the
rendered output and the user-visible behaviour, not internals.

One recurring trap: when an app uses a **shared empty marker** (say `—` for "no value"),
adding a new empty-capable cell to a row breaks *existing sibling tests* that assert
`getByText("—")` — Testing Library throws "found multiple elements", which reads like an
unrelated failure. Give the shared fixture a non-empty default for the new field and
override it only in the tests that exercise emptiness.

### `constants.ts` — named values

Lookup maps, thresholds, column configuration, anything where a bare literal would hide
meaning:

```ts
/** Order status → CSS colour token. */
export const STATUS_COLOR: Record<string, string> = {
  PENDING: "var(--warn)",
  PAID: "var(--ok)",
  SHIPPED: "var(--info)",
  CANCELLED: "var(--danger)",
};

/** Fallback colour for an unknown status. */
export const STATUS_COLOR_FALLBACK = "var(--text-muted)";
```

When two constants are coupled, say so in a comment and keep them adjacent. `COLUMN_KEYS`
and `GRID` in `src/app/(shop)/orders/constants.ts` must stay length-aligned; nothing
enforces it, and the failure is a silent visual misalignment rather than an error.

### `helpers.ts` — pure functions

Same input, same output, no side effects, no mutation of anything it did not create:

```ts
/** Line total in cents (unit price × quantity). */
export function lineTotal(item: Pick<OrderItem, "unit_price_cents" | "quantity">): number {
  return item.unit_price_cents * item.quantity;
}
```

Note the `Pick<>` parameter type — accept the narrowest shape the function actually needs.
It makes the function reusable and the test fixture one line instead of a whole record.

### `styles.ts` — the `s` object (if the project uses style objects)

Projects that style with Tailwind classes or CSS Modules skip this file (or use
`<Name>.module.css` instead). Projects that keep inline style objects out of the JSX export a
single `s`. Static styles are plain objects; state-dependent ones are functions:

```ts
export const s = {
  header: { display: "flex", alignItems: "flex-start", gap: 12 } satisfies CSSProperties,
  card: (focused: boolean, statusColor: string): CSSProperties => ({
    borderStyle: "solid",
    borderColor: focused ? statusColor : "var(--border)",
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: statusColor,
  }),
};
```

All-longhand, always. Mixing `border` with `borderLeftWidth` makes React warn about updating
shorthand and non-shorthand properties in the same render, and the border visibly flickers.

### `index.ts` — the public API

One line of re-export plus a comment naming the component's purpose and surface. This is the
only file other folders should import from.

## Choosing the home

Ask **who imports this**, not what it looks like:

- **One route segment** → `src/app/<route>/_components/<Name>/`, for example
  `src/app/(shop)/cart/_components/CartRow/`. The `_` prefix opts the folder
  and everything under it out of routing. Colocation would be safe even without it (a folder
  without `page.tsx`/`route.ts` is not routable), but the prefix also guards against a future
  Next.js file convention claiming the name.
- **Two or more routes** → `src/components/<Name>/`, imported as `@/components/<Name>`.
- **A design-system primitive** → `src/ui/` (or the project's design-system package),
  imported as `@/ui` or by package name. Check whether the primitive already exists before
  adding one. If the design system is vendored or published from another repository, change
  it there, not in a local copy.

**Promote on the second consumer, not the first.** One consumer means you are guessing at
the abstraction; two means you have evidence. Some sources argue for waiting until the
third — the disagreement is real, and either threshold beats promoting on zero.

## Promotion: moving a component up

Mechanical, and worth doing as its own commit so the diff stays readable:

1. Move the folder from `src/app/<route>/_components/<Name>/` to `src/components/<Name>/`.
2. Update the import in the original route to `@/components/<Name>`.
3. Add the import in the new consumer.
4. Check the barrel comment in `index.ts` still describes the component truthfully — its
   audience just changed, and a stale "used by the cart" comment is worse than none.
5. Run the project's typecheck and tests.

If the component turns out to need route-specific props to be shared (a `cartId`, a route
callback), that is a sign it is not ready to move. Either parameterize it properly or leave
it where it is.

## Barrels in practice

**Write:**

```ts
// src/components/PriceTag/index.ts
/* PriceTag — formatted price with currency and optional strike-through
   discount, for the cart and the product page. Public surface: the component itself. */
export { PriceTag } from "./PriceTag";
```

**Never write:**

```ts
// src/components/index.ts — a wide aggregator
export * from "./PriceTag";
export * from "./AppShell";
export * from "./ProductGallery";
// ...
```

The wide aggregator is what the benchmarks indict: importing one symbol forces the bundler
to fetch and transform every re-exported module, because it cannot know which file holds the
export until it has parsed them all. It also makes `export *` leak internals you never meant
to expose.

**Never import your own folder's barrel from inside it.** `OrderCard.tsx` importing from
`./index` creates `OrderCard.tsx → index.ts → OrderCard.tsx`. JavaScript tolerates the
cycle; bundlers fail on it with errors that point nowhere near the cause.

## Nesting `_components`

A component that owns children used nowhere else nests them:

```
OrderDetailsDrawer/
  OrderDetailsDrawer.tsx
  constants.ts
  helpers.ts
  styles.ts
  index.ts
  _components/
    ItemList/
    ShippingSection/
    PaymentSummary/
    StatusTimeline/
```

Keep this shallow. Three or four levels is the widely-quoted ceiling, and the reason is
practical: deeper trees produce import paths nobody can read and moves nobody wants to make.
If you are nesting a fifth level, the middle layer is probably a feature that deserves to be
promoted rather than buried.

Import direction inside a folder goes **downward only** — a parent imports its
`_components`, siblings do not import each other. Two siblings needing the same thing is the
signal to lift that thing to the parent. This rule is what makes circular dependencies
structurally impossible rather than merely discouraged.

## Worked example: splitting an overgrown component

**Before** — one file doing three jobs:

```tsx
export function OrdersPanel({ orders }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");

  const visible = orders.filter((o) => filter === "all" || o.status === filter);
  const counts = orders.reduce(/* ...15 lines of tallying... */);

  return (
    <div style={{ borderRadius: 8, border: "1px solid var(--border)" /* ... */ }}>
      {/* 40 lines of filter chips */}
      {/* 60 lines of per-order rows with inline expansion logic */}
    </div>
  );
}
```

Three problems, each pointing at a different fix:

- `counts` is a pure tally → `helpers.ts`
- the inline style objects are recreated every render and bury the markup → `styles.ts`
- the per-order row has its own expansion state → its own component
- `filter` belongs in the URL, not local state, if a user would want to share the view

**After:**

```
OrdersPanel/
  OrdersPanel.tsx        renders chips + maps rows; owns nothing but layout
  OrdersPanel.test.tsx
  constants.ts           STATUS_ORDER, filter options
  helpers.ts             countByStatus(orders)
  styles.ts              s.panel, s.chipRow
  index.ts
  _components/
    OrderRow/            owns its own `expanded` state
```

`countByStatus` is now testable with a plain array and no renderer. `OrderRow`'s state
change no longer re-renders the filter chips. And the panel component reads as what it is:
a list with a filter above it.

## Naming reference

| Thing | Convention | Example |
|---|---|---|
| Component folder | PascalCase, matches component | `OrderCard/` |
| Component file | PascalCase, matches folder | `OrderCard.tsx` |
| Test | `<Name>.test.tsx` beside source | `OrderCard.test.tsx` |
| Role files | lowercase | `constants.ts`, `helpers.ts`, `styles.ts` |
| Route-private folder | `_` prefix | `_components/` |
| Anything returning JSX | PascalCase — no exceptions | `<StatusBadge />` |
| Constants | `CONSTANT_CASE` | `STATUS_COLOR_FALLBACK` |
| Style object (if used) | always `s` | `export const s = { ... }` |
| Hooks | `use` + capital, only if it calls hooks | `useOrderItems` |
| Wire fields | whatever the API contract uses — often snake_case | `unit_price_cents` |
| DB/ORM fields | whatever the ORM uses — often camelCase | `unitPriceCents` |

A camelCase function returning JSX (`renderRow()`) is not a component. React cannot give it
a stable identity, so it loses state on every parent render, cannot hold hooks, and does not
appear in DevTools. Rename it to PascalCase and call it as `<Row />`.
