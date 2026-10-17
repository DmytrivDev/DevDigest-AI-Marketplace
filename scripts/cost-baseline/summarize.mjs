#!/usr/bin/env node
// Per-run metrics for one batch: eval JSON + proxy usage log, split by run time windows.
//   node scripts/cost-baseline/summarize.mjs runs/<label>.json runs/<label>.meta.json usage.jsonl <usd per 1M in> <usd per 1M out>
// estUsd ignores the cached-input discount; the batch's real cost is openrouterUsd in the meta file.
import { readFileSync } from 'node:fs';
const [evalFile, metaFile, logFile, priceIn, priceOut] = process.argv.slice(2);
const ev = JSON.parse(readFileSync(evalFile, 'utf8'));
const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
const rows = readFileSync(logFile, 'utf8').trim().split('\n').slice(meta.logFrom, meta.logTo).map(JSON.parse);
const pin = +priceIn / 1e6, pout = +priceOut / 1e6;
const med = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const out = [];
const allRuns = ev.cases.flatMap((c) => c.arms.with.map((r) => ({ c, r, t0: Date.parse(r.startedAt) / 1000 }))).sort((a, b) => a.t0 - b.t0);
const batchEnd = Math.max(...rows.map((x) => x.ts), 0) + 1;
allRuns.forEach((x, i) => { x.t1 = i + 1 < allRuns.length ? allRuns[i + 1].t0 - 0.5 : batchEnd; });
for (const { c, r, t0, t1 } of allRuns) { // a run owns every call until the next run starts (its judge calls included)
  const mine = rows.filter((x) => x.ts >= t0 - 1 && x.ts <= t1);
  const sum = (k) => mine.reduce((a, x) => a + (x[k] || 0), 0);
  const inT = sum('input'), outT = sum('output'), cached = sum('cached');
  out.push({ case: c.name, passed: r.passed, score: +r.score.toFixed(3), turns: r.turns, seconds: r.durationSeconds,
    calls: mine.length, input: inT, output: outT, cached, estUsd: +(inT * pin + outT * pout).toFixed(4),
    failed: r.graders.filter((g) => g.scored && !g.passed).map((g) => `${g.name} (${g.explanation})`) });
}
console.table(out.map(({ failed, ...o }) => o));
for (const o of out) if (o.failed.length) console.log(o.case, 'failed:', o.failed.join('; '));
const pass = out.filter((o) => o.passed).length;
console.log(JSON.stringify({ runs: out.length, passRate: `${pass}/${out.length}`,
  medianSeconds: med(out.map((o) => o.seconds)), medianCalls: med(out.map((o) => o.calls)),
  medianInput: med(out.map((o) => o.input)), medianOutput: med(out.map((o) => o.output)), medianCached: med(out.map((o) => o.cached)),
  medianEstUsd: med(out.map((o) => o.estUsd)), batchOpenRouterUsd: meta.openrouterUsd, batchCalls: meta.calls, commit: meta.commit, model: meta.model }));
