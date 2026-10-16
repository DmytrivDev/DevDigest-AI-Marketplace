## What it does

Blocks `git commit` when staged files contain secrets or private keys.

## Install

```
/plugin install devdigest@devdigest-marketplace
```

Runs before every Bash tool call and stops a `git commit` that would include a secret. It runs automatically once the plugin is installed.
