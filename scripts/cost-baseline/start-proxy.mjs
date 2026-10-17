#!/usr/bin/env node
// Starts the LiteLLM proxy on :4000 for cost-baseline evals.
//   OPENROUTER_API_KEY=... node scripts/cost-baseline/start-proxy.mjs
// Needs `litellm[proxy]` (pip install "litellm[proxy]"); set LITELLM_BIN if it is not on PATH.
// The OpenRouter key goes only into the proxy's environment. Claude Code talks to the proxy
// with a random local token written to .local-token (gitignored).
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
if (!process.env.OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY is not set');
  process.exit(1);
}
const token = 'sk-local-' + randomBytes(16).toString('hex');
writeFileSync(join(here, '.local-token'), token);
const bin = process.env.LITELLM_BIN || 'litellm';
const child = spawn(bin, ['--config', join(here, 'litellm.config.yaml'), '--port', '4000', '--num_workers', '1'], {
  cwd: here,
  stdio: 'inherit',
  env: { ...process.env, LITELLM_MASTER_KEY: token, PYTHONPATH: here, PYTHONIOENCODING: 'utf-8' },
});
child.on('exit', (code) => process.exit(code ?? 0));
