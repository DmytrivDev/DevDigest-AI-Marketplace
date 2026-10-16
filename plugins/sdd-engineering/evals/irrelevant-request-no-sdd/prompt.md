---
description: An everyday coding question unrelated to specs or plans must not start the SDD pipeline.
tags: [sdd, negative, activation, smoke]
plugins: ["../..", "../../../research-tools", "../../../architecture-review", "../../../engineering-paved-path"]
runs: 1
max_turns: 6
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Write, Edit, Agent, Skill]
---

In JavaScript, what is the difference between `Array.prototype.map` and
`Array.prototype.forEach`? Show a two-line example of each.
