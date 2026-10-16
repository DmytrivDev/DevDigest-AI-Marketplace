---
max_turns: 15
timeout_seconds: 600
allowed_tools: [Agent, Read, Glob, Grep]
---

Dispatch the `research-tools:researcher` agent with the Agent tool
(`subagent_type: "research-tools:researcher"`) and give it the question below. Return its
report verbatim as your final message — do not summarize, shorten or rewrite it. If that
agent is not available, research the question yourself and return your report.

Question, about the repository in the current directory:

How many times does the payment client retry a failed charge before it gives up, where is
that limit set, and what happens to the order when the retries run out? And what retry limit
does production actually run with?
