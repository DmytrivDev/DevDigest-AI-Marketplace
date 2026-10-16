# Security

Plugins from this marketplace run on users' machines, with the users' permissions. Agents get
tools, skills shape what Claude does, and scripts run as the user. This file says what may
never ship, how we check it, and what to do when something unsafe ships anyway.

## 1. What may never be in a plugin

| Never | Instead | Checked by |
|---|---|---|
| Secrets: API keys, tokens, passwords, private keys, literal `Authorization` headers | Ask for them with `userConfig` + `"sensitive": true` in `plugin.json` and reference them as `${user_config.KEY}` | `scripts/validate.mjs` (secret patterns), `claude plugin validate --strict`, review |
| Absolute paths (`C:\…`, `D:/…`, `/Users/<name>/…`, `/home/<name>/…`) | `${CLAUDE_PLUGIN_ROOT}` for files in the plugin, `${CLAUDE_SKILL_DIR}` for files in a skill, paths relative to the user's project, or an explicit input (`.claude/sdd-engineering.json`) | `scripts/validate.mjs` |
| References to files outside the plugin directory (`../`, repo-root `docs/`, another plugin's files) | Copy what the plugin needs into it. Use another plugin's components through `dependencies` and their namespaced names | `claude plugin validate`, `scripts/validate.mjs --install` |
| Names, paths or rules of one specific product | Explicit inputs: the project config, the brief, the project's own docs | review, grep in the PR |
| Unpinned external sources | `ref` plus a full 40-character `sha` | `scripts/validate.mjs` |
| Third-party files without a license that allows redistribution | Credit source, path, commit and license in the plugin README | review |
| Network calls, telemetry, or writes outside the user's project and `${CLAUDE_PLUGIN_DATA}` that the README does not announce | Document them in the README and make them opt-in | review |
| Hooks or scripts that edit `settings*.json`, permissions or other plugins' files | — never | review |

## 2. Least privilege for agents

- Each agent gets the minimum `tools` it needs. Reviewers and researchers are read-only:
  `Read`, `Grep`, `Glob`, plus read-only `Bash` where the prompt lists the allowed commands.
- Only executor agents (`sdd-engineering:implementer`) get `Edit` and `Write`. A writer's
  prompt names its write scope.
- No agent commits, pushes or opens a PR. That decision stays with the user.
- Content an agent reads is data, not instructions: repo files, web pages, PR text, model
  output. This rule is in every agent prompt that reads untrusted content.

## 3. How a change is checked

1. `node scripts/validate.mjs --install` runs on every PR (`.github/workflows/validate.yml`)
   and covers:
   - manifests;
   - secret patterns and absolute paths;
   - bundled scripts parsing;
   - `claude plugin validate --strict`;
   - a real install, with dependencies, into a throwaway config.
2. `CODEOWNERS` review. Reviewers must be able to read every hook, script and agent prompt in
   the diff. Large generated or minified files are not accepted in plugins.
3. Behaviour evals before a release ([`RELEASES.md`](RELEASES.md) §4).

## 4. After an unsafe release

An unsafe release is one that leaked a secret, runs or suggests something harmful, writes
where it shouldn't, or breaks users' sessions.

1. **Stop the spread (minutes).** Roll the `stable` channel back to the last good release
   ([`RELEASES.md`](RELEASES.md) §7). On `main`, revert the change in a PR marked
   `security`.
2. **Secrets.**
   - Rotate or revoke the leaked secret immediately. Removing it from git does not make it
     safe: tags, forks, clones and plugin caches keep it.
   - Then purge it from history only if the owner decides to.
3. **Tell users.** Open a GitHub issue or security advisory with:
   - the affected plugin and versions;
   - what happened;
   - what to run: `claude plugin marketplace update devdigest-marketplace`, then
     `claude plugin update <plugin>@devdigest-marketplace`, or
     `claude plugin uninstall <plugin>@devdigest-marketplace`.
4. **Fix forward.** Release a new patch or minor version with the fix. Never re-use or move
   the bad version's tag.
5. **Learn.**
   - Add a check that would have caught it: a `validate.mjs` rule, an eval case or a review
     checklist item.
   - Record the incident in the release PR.

## 5. Reporting a vulnerability

Do not open a public issue for an unpatched problem. Use GitHub's private vulnerability
reporting on this repository (Security → Report a vulnerability), or contact the owners
listed in [`CODEOWNERS`](../CODEOWNERS).
