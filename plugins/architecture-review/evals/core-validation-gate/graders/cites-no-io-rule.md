---
type: llm
weight: 1
---

The report states the rule the file-system read breaks: the quote core may do no I/O and
its only side effect is the injected `RateProvider` — cited as the project's
`docs/architecture.md` "Iron rule" (Quote core section), or as the onion-architecture Core
ring ("pure rules, no I/O").
