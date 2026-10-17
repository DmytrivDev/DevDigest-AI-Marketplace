# Releases

How plugins in this marketplace are versioned, tagged, shipped to users, updated and rolled
back. The rules come from the Claude Code docs (plugins: host-marketplace, publish, loading,
dependencies, cli-reference — October 2026). Where our process goes beyond the docs, this
file says so.

## 1. Versions — SemVer per plugin

- `version` lives only in `plugins/<name>/.claude-plugin/plugin.json`, never in
  `marketplace.json`. `scripts/validate.mjs` enforces this.
- Every PR that changes a plugin bumps its version and adds a `CHANGELOG.md` section.
  - **Why:** Claude Code installs a new copy only when the version string changes. Without a
    bump, users never receive the change.
- Which part to bump:

  | Change | Bump | Example |
  |---|---|---|
  | Fix in wording, a bug in a script, a better eval | patch | `1.0.0 → 1.0.1` |
  | New skill, agent or eval case; new optional config key; new behaviour that keeps old inputs working | minor | `1.0.0 → 1.1.0` |
  | Removed or renamed component, changed config key or spec/plan format, raised dependency major | major | `1.4.2 → 2.0.0` |

- **Dependency ranges.** Dependencies use `^<major>.0.0`. A dependency's major bump forces every
  dependent to raise its range in the same release train, otherwise the dependent stays
  disabled (see [`PLUGIN-GUIDELINES.md`](PLUGIN-GUIDELINES.md) §13).
- **`COMPATIBILITY.md`.** A change that relies on a newer Claude Code raises the minimum
  version in that plugin's `COMPATIBILITY.md`, and that is at least a minor bump.

## 2. Tags

The tag format is `<plugin>--v<version>`, for example `sdd-engineering--v1.0.0`. Tags go on
this marketplace repository, at the commit on `main` that passed CI.

```bash
cd plugins/engineering-paved-path
claude plugin tag --dry-run     # validates the plugin, checks the version, clean tree, tag not taken
claude plugin tag --push        # creates the annotated tag and pushes it to origin
```

Tags matter for dependency ranges. When `sdd-engineering` asks for
`engineering-paved-path@^1.0.0`, Claude Code looks for the highest
`engineering-paved-path--v1.x.y` tag. We tag every release anyway, because tags are also how
we roll back (§6).

A tag is never moved or deleted after it is pushed. A bad release is fixed by a new version.

## 3. Release order

Dependencies first, then the plugins that use them:

1. `engineering-paved-path`
2. `research-tools`
3. `architecture-review` (needs `engineering-paved-path`)
4. `sdd-engineering` (needs all three)

Release only what changed. A dependent that did not change is not re-released.

## 4. Release checklist

For each plugin, in the order above:

- [ ] `version` bumped, and the `CHANGELOG.md` section `## [x.y.z] — YYYY-MM-DD` written.
- [ ] `COMPATIBILITY.md` still true.
- [ ] The PR is merged to `main`, and both the `Validate plugins` and `Site` workflows are
      green on that commit.
- [ ] Behaviour evals run on that commit and the results recorded in the PR or in
      `docs/COST-BASELINE.md`:
  - `claude plugin eval ./plugins/<name>`;
  - pass `--scaffold` where a case needs it;
  - pin the model with `--model`, as in the cost baseline.
- [ ] `claude plugin tag --dry-run`, then `claude plugin tag --push` from the plugin's
      directory.
- [ ] `git show <plugin>--v<version>` points at the commit that passed CI.
- [ ] After the last plugin: move the `stable` channel (§5), and check the catalog site shows
      the new version.

## 5. Channels — `latest` and `stable`

Claude Code has no built-in channel concept. One marketplace serves one version of each plugin
at a time. Users choose a channel by **which git ref they add the marketplace at**.

| Channel | Ref | Who it is for | Add it with |
|---|---|---|---|
| `latest` | `main` | contributors, early adopters | `claude plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace` |
| `stable` | branch `stable` | teams that want only released, verified versions | `claude plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace#stable` |

**Rules for `stable`:**
- It only ever points at a commit that carries release tags from §4.
- It is moved by a maintainer, never by CI.
- Moving it forward is a release; moving it back is a rollback (§6).

```bash
git push origin <release-commit>:refs/heads/stable              # forward, fast-forward only
git push --force-with-lease origin <older-release-commit>:refs/heads/stable   # rollback
```

Both channels use the same marketplace name `devdigest-marketplace`, so a user is on one
channel at a time. To switch, remove the marketplace and add it again at the other ref.

## 6. Update — catalog vs plugin

These are two separate steps. Check them separately whenever you verify a release.

| Step | Command | What changes |
|---|---|---|
| Update the **catalog** | `claude plugin marketplace update devdigest-marketplace` (in a session: `/plugin marketplace update devdigest-marketplace`) | The local clone of this repo moves to the newest commit of its ref. Installed plugins do **not** change yet |
| Update a **plugin** | `claude plugin update sdd-engineering@devdigest-marketplace` | Refreshes the catalog, then installs the new copy if the plugin's version changed. Dependencies are re-resolved |

**After either step:**

```bash
claude plugin list --json      # expected versions, all enabled, no dependency-unsatisfied / range-conflict / no-matching-tag
```

- A running session keeps the old version until `/reload-plugins` or a restart.
- Auto-update is off by default for third-party marketplaces. A user turns it on in
  `/plugin` → Marketplaces → Enable auto-update. `DISABLE_AUTOUPDATER=1` keeps it off.

## 7. Rollback to a verified version

Users cannot install an older version by number. A rollback is done by the publisher, by
pointing the channel back at the last good release. `claude plugin update` installs whatever
version the channel now serves, a lower one included (verified in the rehearsal log below).

**Scenario: `1.1.0` is bad, `1.0.0` was verified.**

1. **Publisher** — move `stable` back to the release commit of `1.0.0`:

   ```bash
   git fetch --tags origin
   git push --force-with-lease origin sdd-engineering--v1.0.0^{commit}:refs/heads/stable
   ```

2. **User on `stable`:**

   ```bash
   claude plugin marketplace update devdigest-marketplace
   claude plugin update sdd-engineering@devdigest-marketplace
   claude plugin list --json        # sdd-engineering 1.0.0, dependencies satisfied
   ```

3. **Smoke check** — the `smoke`-tagged eval cases of `sdd-engineering` pass on the rolled-back
   version.
4. **`latest` (`main`)** — fix forward. Revert the bad change or fix it, then release `1.1.1`
   or `1.2.0`. Never re-use `1.1.0`.

**What happens on disk.** The cache keeps one directory per version:
`~/.claude/plugins/cache/devdigest-marketplace/<plugin>/<version>/`. On update, the previous
version directory gets an `.orphaned_at` marker and is deleted 14 days later. A rollback within
that window may reuse the cached copy.

**Rehearse it.** Every new channel setup, and every major release, is rehearsed once on a
throwaway config:

```bash
CLAUDE_CONFIG_DIR=$(mktemp -d) claude plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace#stable
```

Then do the full cycle and record the result in the release PR:
1. install;
2. move `stable` forward, then update;
3. move it back, then update;
4. run the smoke evals.

On Windows, keep the throwaway config dir short (for example `%TEMP%\sddr`). A deeply nested
path makes the marketplace clone fail with `Filename too long`.

### Rehearsal log — 2026-10-17 (`sdd-engineering` 1.0.0 → 1.1.0 → 1.0.0)

Throwaway `CLAUDE_CONFIG_DIR`, Claude Code `2.1.301`, Windows 11. The marketplace was added at
`DmytrivDev/DevDigest-AI-Marketplace#stable`.

| Step | `stable` at | Action | Result |
|---|---|---|---|
| 1 | `08bc004` (1.0.0) | `marketplace add …#stable`, `plugin install sdd-engineering@devdigest-marketplace` | 4 plugins `1.0.0`, all enabled. `claude plugin list --json` has no `dependency-unsatisfied`, `range-conflict` or `no-matching-tag` |
| 2a | `2cb898c` (1.1.0) | `git push origin sdd-engineering--v1.1.0^{commit}:refs/heads/stable`, then **`marketplace update` only** | Catalog clone serves `1.1.0`; installed plugins **still `1.0.0`**. Catalog update and plugin update are separate |
| 2b | `2cb898c` | `plugin update sdd-engineering@devdigest-marketplace` | `updated from 1.0.0 to 1.1.0`. Cache gains `sdd-engineering/1.1.0` with the new `sdd-status` skill. No dependency errors |
| 2c | `2cb898c` | eval `sdd-status-reports-state` on the stable copy (Sonnet) | **1/1 passed.** `sdd-status` printed `sdd-engineering 1.1.0 · active copy: …/sdd-engineering/.claude-plugin/plugin.json` |
| 3 | `08bc004` (1.0.0) | `git push --force-with-lease=stable:2cb898c… origin sdd-engineering--v1.0.0^{commit}:refs/heads/stable`, `marketplace update`, `plugin update` | `updated from 1.1.0 to 1.0.0`: **a lower version installs**. All 4 plugins `1.0.0`, no dependency errors. `1.1.0` cache dir marked `.orphaned_at` |
| 4 | `08bc004` | smoke evals (`--tag smoke`, Sonnet) on the stable copy | **3/3 passed**: `irrelevant-request-no-sdd`, `spec-creator-pass1-writes-no-file`, `workflow-retro-not-auto-triggered` |

After the rehearsal, `stable` stays at the verified `1.0.0` release. Releases `1.0.1` and
`1.1.0` are on `latest` (`main`) and tagged.

## 8. Unsafe release

If a release leaks a secret, runs something harmful, or breaks users' sessions, follow
[`SECURITY.md`](SECURITY.md) §4 first. Then roll back as in §7.
