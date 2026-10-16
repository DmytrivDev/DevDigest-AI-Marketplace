# Onion rings inside an MCP server

The rule from [SKILL.md](SKILL.md) applies unchanged to a Model Context Protocol (MCP)
server written in TypeScript:

> A file may import from its own ring and from rings closer to the core. Never outward.

Only the ring → folder map differs, because an MCP server is usually a single small package
rather than a backend with many modules. The most common shape — and the one used below —
is a **thin MCP client for an existing HTTP API**: tools take arguments from the model, call
the API, and return compact text. The same map works for an MCP server that talks to a
database or a CLI instead; only the driven adapter changes.

## The four rings, in a reference layout

Example: an MCP server exposing an orders API to an agent.

| # | Ring | Path | Contents | May import |
|---|---|---|---|---|
| 1 | Core — pure, no I/O, no clock | `src/core/results.ts` | output schemas (`OrderList`, `OrderSummary`) + inferred types | `zod` |
| 1 | | `src/core/mappers.ts` | sort / cap / clip / `toText` — API DTO → tool output | `core/*`, `zod`, **type-only** contract types |
| 1 | | `src/core/errors.ts` | `ToolError(kind, text)` + builders for the text the model sees | `core/*` |
| 1 | | `src/core/limits.ts` | `MAX_ITEMS`, clip lengths, the prefix marking untrusted content | — |
| 2 | Ports — the conversation, not the tech | `src/ports/orders-api.ts` | `OrdersApi` interface | `core/*`, type-only contract types |
| 2 | | `src/ports/clock.ts` | `Clock { now(): number; sleep(ms, signal): Promise<void> }` | — |
| 3 | Application — use cases | `src/app/resolve.ts` | human references → ids (`#1042` → order id) | rings 1–2 |
| 3 | | `src/app/track-shipment.ts` | resolve → fetch → wait until a state or a deadline → map, as a plain function taking `onProgress` + `AbortSignal` | rings 1–2 |
| 3 | | `src/app/queries.ts` | `listOrders`, `getOrder` | rings 1–2 |
| 4 | Driven adapters | `src/adapters/http-client.ts` | `fetch` implementation of `OrdersApi`; `safeParse`s every response | rings 1–2, contract schemas |
| 4 | | `src/adapters/system-clock.ts`, `config.ts`, `log.ts` | `Date.now`/`setTimeout`, `process.env`, stderr logging | rings 1–2 |
| 4 | Driving adapters (≈ routes) | `src/tools/<tool>.ts` | input schema, annotations, call ONE app function, map `ToolError` → `isError` result | rings 1–3, `@modelcontextprotocol/sdk` |
| 4 | | `src/tools/register.ts` | thin wrapper around `McpServer#registerTool` | rings 1–3, SDK types |
| 4 | | `src/tools/descriptions.ts` | tool and parameter descriptions | — |
| 4 | | `src/tools/result.ts` | `toToolResult` / `toErrorResult` (the MCP envelope) | ring 1, SDK types |
| — | Composition root | `src/server.ts` | `createServer(deps)` — builds adapters, injects ports into app functions, registers tools | everything |
| — | Entry | `src/index.ts` | config → `createServer` → `StdioServerTransport` | `server.ts`, `adapters/*` |

Note what is *not* here: the MCP server never imports the backend's source. It talks to the
API over HTTP through its port, and shares at most the contract types/schemas.

## Six rules worth enforcing

All of them are import rules, so they fit dependency-cruiser
([enforcement.md](enforcement.md)). A new package has no legacy debt, so they can all start
at severity `error`.

1. **`core-is-pure`** — `core/**` may depend only on itself and `zod`, plus TYPE-ONLY imports
   of contract types. No node builtins, no SDK, no adapters/ports/app/tools. A companion rule
   **`core-no-outer-rings`** closes the gap the type-only exemption opens: `core/**` must not
   name `ports/`, `app/`, `adapters/`, `tools/`, `server.ts` or `index.ts` even type-only.
   A type ring 1 needs is defined in ring 1, and `ports/` imports it from there.
2. **`ports-are-types`** — `ports/**` may depend only on `core/**` and type-only imports —
   never a concrete adapter, the SDK, or a value import from outside `core/**`.
3. **`app-no-outward`** — `app/**` must not import `adapters/**`, `tools/**`, `server.ts`,
   `@modelcontextprotocol/sdk`, or any `node:*` builtin. This is what keeps the use cases
   testable with a fake API and a fake `Clock`, and reusable outside an MCP server.
4. **`tools-no-driven-adapters`** — `tools/**` must not import `adapters/**` directly; a
   tool calls the one `app/*` function that does the work (the "thin controller" from
   [transport.md](transport.md)).
5. **`only-root-wires`**, as two concrete rules:
   - `only-root-wires-server` — only `index.ts` may import `server.ts`.
   - `only-root-wires-adapters` — nothing but `server.ts` / `index.ts` may CONSTRUCT a
     driven adapter, i.e. make a VALUE import of `adapters/**`. Use
     `dependencyTypesNot: ['type-only']`: a file naming an adapter's exported TYPE (an
     adapter referencing `Config`'s shape) constructs nothing and is not what this rule
     guards against.
6. **`no-backend-source`** — nothing in the MCP package may import the backend's source tree.
   Shared contracts come through the contracts package or an explicit path alias, never a
   relative path into another app. This makes "thin client, no services" structural.

## Where an MCP server legitimately differs

- **The port can live inside the MCP package.** SKILL.md puts ports in `src/ports/` or a
  shared contracts package. If only the MCP server consumes `OrdersApi`, adding it to a
  shared package would cost edits for consumers that never use it. It still passes the §2
  test: it crosses a process boundary (HTTP to the API) and a test substitutes it with a
  fake. Method names describe the conversation (`getOrder`, `listShipments`), never an HTTP
  verb or path.
- **Ring 1 may `import type` contract DTOs.** The mappers translate API DTOs into tool
  output and must name the DTO types to do so. Type-only imports are erased at build time,
  so ring 1 carries no runtime dependency on the contracts package — value imports stay
  forbidden there (rule 1).
- **`Clock` is a port**, not a pair of loose `now`/`sleep` parameters, when a tool waits for
  a state change with a deadline: the tests must substitute time wholesale to stay fast and
  deterministic — the same §2 "a test must substitute it" justification.

## Tool-specific rules

- **A tool is a driving adapter.** Input schema, annotations, one call into `app/`, map the
  result or `ToolError` into the MCP envelope. No HTTP calls, no retries, no business rules.
- **Everything the API returns is untrusted text** for the model. Mark it (a fixed prefix
  from `core/limits.ts`), clip it, and cap list lengths in ring 1 so every tool behaves the
  same.
- **Errors are results, not exceptions.** Map `ToolError` to an `isError: true` result whose
  text tells the model what to do next; let only programming errors throw.

## SDK generics — a build-time issue, not a ring violation

Some versions of `@modelcontextprotocol/sdk` infer `registerTool`'s generics against a union
spanning several schema-library type surfaces, which can drive `tsc` into
`TS2589: Type instantiation is excessively deep and possibly infinite` even on a single-field
schema. Isolate the workaround in one place: `tools/register.ts` casts only that one SDK
call's arguments, and every caller stays fully typed through its own config type and handler
signature. `register.ts` still imports only SDK types and ring 1–3 code, same as every other
file in `tools/`.
