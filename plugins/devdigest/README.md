# devdigest

Claude Code plugin for DevDigest, the local-first AI PR reviewer.

## Install

```
/plugin marketplace add DmytrivDev/DevDigest-AI-Marketplace
/plugin install devdigest@devdigest-marketplace
```

## Components

Skills, agents, hooks and the MCP server are added here as the lesson progresses.
Each is invoked under the plugin namespace, e.g. `/devdigest:<skill>`.

## Layout

```
plugins/devdigest/
├── .claude-plugin/plugin.json   # manifest only — nothing else goes in .claude-plugin/
├── skills/<name>/SKILL.md
├── agents/*.md
├── hooks/hooks.json
├── scripts/                     # referenced as ${CLAUDE_PLUGIN_ROOT}/scripts/...
└── .mcp.json
```

The plugin is copied into the Claude Code cache on install, so it must be
self-contained: never reference files outside this directory.

## Versioning

`version` lives only in `.claude-plugin/plugin.json`. Bump it on every release —
users with the plugin installed do not receive new commits until it changes.
