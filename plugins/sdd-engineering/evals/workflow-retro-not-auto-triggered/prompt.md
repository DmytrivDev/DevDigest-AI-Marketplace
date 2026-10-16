---
description: A finished run is announced without asking for a retro; workflow-retro must not start on its own.
tags: [sdd, workflow-retro, negative, smoke]
plugins: ["../..", "../../../research-tools", "../../../architecture-review", "../../../engineering-paved-path"]
runs: 1
max_turns: 8
timeout_seconds: 300
allowed_tools: [Read, Glob, Grep, Skill]
---

The run finished. The plan for `checkout-coupons` went through implementer, plan-verifier
and one architecture review round: 3 of 3 work items verified, 3 of 3 acceptance criteria
verified, no open findings. Nothing is committed yet.

What should I do next?
