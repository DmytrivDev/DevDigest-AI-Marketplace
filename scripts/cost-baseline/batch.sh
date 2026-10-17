#!/usr/bin/env bash
# One measured eval batch through the local proxy.
#   scripts/cost-baseline/batch.sh <label> <eval dir under plugins/> [claude plugin eval args...]
# Example (the cost-baseline scenario, 3 runs):
#   scripts/cost-baseline/batch.sh baseline sdd-engineering/evals \
#     --case baseline-spec-and-plan --runs 3 --scaffold --allow-tools Write Edit
# Writes runs/<label>.json (eval result) and runs/<label>.meta.json (OpenRouter cost delta,
# token totals from the proxy log, commit, model). Needs the proxy running and OPENROUTER_API_KEY.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
source "$HERE/env.sh"
label="$1"; evaldir="$2"; shift 2
mkdir -p "$HERE/runs"; touch "$HERE/usage.jsonl"
cd "$ROOT"
u0=$(node "$HERE/usage.mjs"); l0=$(wc -l < "$HERE/usage.jsonl"); t0=$(date +%s); sha=$(git rev-parse --short HEAD)
# Plugins load from ./plugins so cases can use their sibling dependencies.
claude plugin eval ./plugins --eval-dir "$evaldir" --model "$EVAL_MODEL" --judge-model "$EVAL_MODEL" \
  --ablation none --no-publish --trust-plugin --json "$HERE/runs/$label.json" --output-dir "$HERE/runs/$label" "$@" 2>&1 | tail -4
rc=${PIPESTATUS[0]}
t1=$(date +%s)
sleep 20   # OpenRouter usage lags a few seconds behind the last response
u1=$(node "$HERE/usage.mjs"); l1=$(wc -l < "$HERE/usage.jsonl")
node -e '
const [label, sha, u0, u1, l0, l1, t0, t1, rc, log, out] = process.argv.slice(1);
const rows = require("fs").readFileSync(log, "utf8").trim().split("\n").filter(Boolean).slice(+l0, +l1).map(JSON.parse);
const sum = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
const meta = { label, commit: sha, model: process.env.EVAL_MODEL, openrouterUsd: +(u1 - u0).toFixed(6), wallSeconds: t1 - t0,
  exitCode: +rc, calls: rows.length, input: sum("input"), output: sum("output"), cached: sum("cached"), logFrom: +l0, logTo: +l1 };
require("fs").writeFileSync(out, JSON.stringify(meta, null, 2)); console.log(JSON.stringify(meta));
' "$label" "$sha" "$u0" "$u1" "$l0" "$l1" "$t0" "$t1" "$rc" "$HERE/usage.jsonl" "$HERE/runs/$label.meta.json"
