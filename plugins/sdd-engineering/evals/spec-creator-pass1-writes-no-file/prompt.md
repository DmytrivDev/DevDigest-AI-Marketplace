---
description: spec-creator gets a feature request with gaps and must answer with Pass 1 questions, writing no file.
tags: [sdd, spec-creator, smoke]
plugins: ["../..", "../../../research-tools", "../../../architecture-review", "../../../engineering-paved-path"]
runs: 1
max_turns: 20
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Agent, Skill]
---

Dispatch the `sdd-engineering:spec-creator` agent with this feature request and relay its
report to me verbatim:

"Shoppers should be able to apply a discount coupon at checkout. Marketing wants to run
promos next month."

There is no design and no earlier spec. I have not answered any questions yet.
