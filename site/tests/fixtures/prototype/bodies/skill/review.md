## What it does

Reads the diff of the current branch against its base and reports findings grouped by severity: blocker, major, minor and nit. Every finding points to a file and line, so you can jump straight to it.

## When to use

- Before you request a review on a pull request.
- After a large refactor, to catch regressions the tests miss.
- When you inherit a pull request and need to know where the risk is.

## Usage

```
/devdigest:review
/devdigest:review --base main --focus security
```

Without arguments the skill compares `HEAD` with the merge base of the default branch.

## Output

```
Blockers (1)
  src/auth/session.ts:42   Token compared with == instead of a constant-time check

Major (2)
  src/api/orders.ts:118    Query runs inside a loop over order items
  src/api/orders.ts:131    Error from the payment client is swallowed
```

Severity rules live in `references/severity.md`. Edit that file to tune what counts as a blocker for your team.
