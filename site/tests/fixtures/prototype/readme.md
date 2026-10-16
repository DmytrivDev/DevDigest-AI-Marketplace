DevDigest review workflow for Claude Code. It connects Claude to a local DevDigest instance and adds skills, agents and hooks for reviewing pull requests.

## What's inside

- 3 skills: `review`, `pr-brief`, `dependency-checker`
- 3 review agents: security, test quality and performance
- `export-ci` command that turns an agent into a GitHub Actions workflow
- `pre-tool-use-bash` hook that blocks commits containing secrets
- MCP server that exposes reviews and findings to Claude

## Requirements

- Claude Code with plugin support
- DevDigest running locally, with `DEVDIGEST_URL` pointing to it

## Quick start

```
/plugin install devdigest@devdigest-marketplace
/devdigest:review
```
