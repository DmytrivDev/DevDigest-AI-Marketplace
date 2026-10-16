# engineering-paved-path

Stack skills for React, Next.js and Fastify apps: architecture, component placement,
testing and security.

## What it is

Coding agents write code that compiles but drifts: a SQL query lands in a route handler, a
one-off component ends up in the shared folder, a test checks implementation details, and an
endpoint ships without an authorization check. This plugin gives Claude a **paved path**: a
set of skills that load automatically when it works on a matching file, so the same rules
apply to every change, including one-line ones.

It covers six areas: React, Next.js, Fastify, architecture (backend layering and frontend
structure), testing, and security. The skills contain instructions only. They run no
scripts, add no hooks and start no servers.

## Install

Add the marketplace once:

```
/plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace
```

Then install the plugin, either inside Claude Code:

```
/plugin install engineering-paved-path@devdigest-marketplace
```

or from your shell:

```bash
claude plugin install engineering-paved-path@devdigest-marketplace
```

The plugin has no dependencies of its own. If you install `architecture-review` or
`sdd-engineering`, Claude Code installs this plugin for you, because both depend on it.

## What's inside

Seven skills. Claude loads a skill when its description matches the task. Every skill
except `next-best-practices` can also be run by hand as `/engineering-paved-path:<skill>`.

| Skill | Namespaced name | What it does | When it triggers |
|---|---|---|---|
| `react-best-practices` | `engineering-paved-path:react-best-practices` | A catalog of modern React practices and anti-patterns: component design, hooks misuse, state, keys, conditional rendering, accessibility, performance, data fetching | Auto, when writing, reviewing or refactoring React components and hooks. Also manual |
| `next-best-practices` | `engineering-paved-path:next-best-practices` | Next.js rules: file conventions, RSC boundaries, async APIs, data patterns, metadata, error handling, route handlers, image and font optimization, bundling, self-hosting | Auto only (`user-invocable: false`), when working on Next.js App Router code |
| `fastify-best-practices` | `engineering-paved-path:fastify-best-practices` | How to build Fastify servers: routes, plugins, JSON Schema validation, hooks, errors, logging, auth, CORS, databases, WebSockets, testing, deployment | Auto, when building, configuring or debugging a Fastify app. Also manual |
| `react-testing-library` | `engineering-paved-path:react-testing-library` | React Testing Library with Vitest: setup, query priority, `userEvent`, async patterns, MSW mocking, and a few long user-flow tests instead of many tiny ones | Auto, when writing, reviewing or setting up component and hook tests. Also manual |
| `security` | `engineering-paved-path:security` | Web app security based on the OWASP Top 10:2025, with severity levels, checklists and safe/unsafe code pairs | Auto, when reviewing code for vulnerabilities, adding auth, handling input or uploads, managing secrets, or building API endpoints. Also manual |
| `onion-architecture` | `engineering-paved-path:onion-architecture` | Onion Architecture for Node/TypeScript backends and MCP servers: four rings, the inward-only import rule, when a port is justified, where business rules, repositories and DTO mapping go, DI through a composition root, and an example dependency-cruiser config | Auto, when adding or moving a backend file, writing a route, service, repository or MCP tool, or reviewing a backend PR. Also manual |
| `frontend-ui-architecture` | `engineering-paved-path:frontend-ui-architecture` | Where frontend code belongs: component homes (route-local, shared, design system), file roles, barrels, when to split, where logic and state live, and the App Router server/client boundary | Auto, when creating, moving or renaming a React or Next.js file, extracting a helper or constant, or reviewing a PR that adds UI files. Also manual |

Each skill keeps its detail in reference files next to its `SKILL.md`, and Claude reads
them only when it needs them. The two architecture skills also ship a `README.md` that
lists their sources and explains where those sources disagree.

## How to use it

You don't need to do anything special. Work as usual, and the matching skills load when
they apply. A few examples:

**1. Edit a `.tsx` file: the skills trigger on their own.**

```
Add a "Remove" button to src/app/(shop)/cart/_components/CartRow/CartRow.tsx
that asks for confirmation first.
```

Claude loads `react-best-practices` and `frontend-ui-architecture`. The confirmation dialog
stays route-local under `_components/` rather than going to `src/components/`. Its
open/closed state stays in the smallest component that needs it. If a label needs a price
calculation, that goes in `helpers.ts`, not in the JSX. If the route is a Server Component,
`next-best-practices` keeps `'use client'` on the interactive leaf only.

**2. Run the architecture skill explicitly before a backend change.**

```
/engineering-paved-path:onion-architecture
Where should the discount calculation for orders live? Right now it is inline in
src/modules/orders/routes.ts.
```

The answer will be ring 1: a pure function in `src/modules/orders/pricing.ts`, called from
`OrderService`. The route keeps four jobs: parse, resolve the tenant, call the service, map
the status code. The pure function can be unit-tested without a database.

**3. Review a diff against the rules.**

```
Review my staged changes for layering and component-placement problems.
```

Both architecture skills come with a review checklist, and `onion-architecture` lists what
an import graph cannot catch. Pre-existing violations are not reported unless the change
adds to them.

**4. Write tests the way the testing skill recommends.**

```
Write tests for src/app/(shop)/checkout/_components/AddressForm.
```

`react-testing-library` writes one or two user-flow tests: fill in the form, submit, and
check the result or the error. API calls are mocked with MSW instead of `vi.mock`.

## Configuration

None. The skills read nothing and need no keys.

The examples use a neutral layout (`src/modules/orders/`, `src/app/(shop)/cart/`,
`src/components/`, `src/ui/`). The architecture skills ask Claude to map these onto your
project's real folders. If you use the `sdd-engineering` pipeline, its `routing` setting in
`.claude/sdd-engineering.json` sends files to these skills by glob. For example, `**/*.tsx`
can go to `engineering-paved-path:frontend-ui-architecture` and `src/modules/**` to
`engineering-paved-path:onion-architecture`. Without the pipeline, the skills trigger from
their descriptions alone.

The architecture skills don't track your project's known violations. Record those in your
own docs, or in the knowledge files listed under `knowledgeFiles` in
`.claude/sdd-engineering.json`. Reviewers then report only violations that a change adds.

## Dependencies

- **Needs:** nothing.
- **Used by:**
  - `architecture-review`: its `architecture-reviewer` agent applies `onion-architecture`,
    `frontend-ui-architecture` and any stack skill routed to the changed files.
  - `sdd-engineering`: the planner and the implementer load the routed stack skills for
    every file they touch.

## Limits and safety

- **Instructions only.** No scripts, hooks, MCP servers or bundled executables. No skill
  sets `allowed-tools`, so a skill grants no extra permissions. Claude keeps the
  permissions of your session.
- **Nothing runs automatically except loading.** A skill changes how Claude writes and
  reviews code. It never edits, commits or runs commands by itself.
- **Advice, not enforcement.** The architecture rules hold only through review unless your
  project adds a boundary check. `onion-architecture` includes an example dependency-cruiser
  config you can adopt. It doesn't assume you already have one.
- **Opinionated defaults.** Where the literature disagrees, the architecture skills pick one
  side and label it **[choice]**. If your project has settled the question another way, the
  skills tell Claude to follow the project.
- **Stack scope.** The skills target React, Next.js (App Router), Fastify and TypeScript.
  `react-testing-library` assumes Vitest. `security` uses examples from React, Express,
  MongoDB and JWT. Other stacks get only the general principles.

## Credits

- **`next-best-practices`**: from
  [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills), path
  `skills/next-best-practices`. Content hash at import:
  `f4678aef4ffc10a5ea64a91e57abe5a5081af813b06d58d565caf3e8ef56e26c`. Licensed under the
  upstream repository's license.
- **`fastify-best-practices`**: from
  [mcollina/skills](https://github.com/mcollina/skills), path `skills/fastify`. Content hash
  at import: `269924684709b8c6f50a569ef988e66031efb822ef92cba6c8dfa160e54ed4d4`. Licensed
  under the upstream repository's license. The upstream registry metadata file
  (`tile.json`) is not included.
- **`react-best-practices`, `react-testing-library`, `security`**: origin to be confirmed
  (open question OQ-3). Attribution will be added here once the upstream sources are
  confirmed.
- **`onion-architecture`, `frontend-ui-architecture`**: written for this marketplace. Each
  skill's `README.md` lists the articles and documentation it is based on.
