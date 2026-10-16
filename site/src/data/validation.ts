import { spawnSync } from 'node:child_process';
import type { PluginValidation } from './build-catalog';

// `claude plugin validate <dir> --strict` per local plugin (spec 5.4). Any problem running the CLI
// (not installed, needs a login, timeout) gives `unknown` and never fails the build.

const NOT_RUN = /not found|not recognized|no such file|cannot find|ENOENT|log ?in|authenticat|api key|unauthor/i;

export function runClaudeValidate(root: string, plugins: { name: string; dir: string }[]): Record<string, PluginValidation> {
  const out: Record<string, PluginValidation> = {};
  if (process.env.DD_VALIDATE === '0') return out;
  for (const p of plugins) {
    // `claude` is a .cmd shim on Windows, which only a shell can start.
    const res = spawnSync(`claude plugin validate "./${p.dir}" --strict`, { cwd: root, shell: true, encoding: 'utf8', timeout: 90_000 });
    const text = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
    const lines = text
      .split('\n')
      .map((l) => l.replace(/^[✘✖✔⚠\s]+/u, '').trim())
      .filter((l) => l && !/^Validating plugin manifest/i.test(l));
    if (res.error || res.status === null || res.status === 127 || res.status === 126 || (res.status !== 0 && NOT_RUN.test(text) && !/validation failed/i.test(text))) {
      out[p.name] = { status: 'unknown', messages: [] };
    } else if (res.status === 0) {
      out[p.name] = { status: 'pass', messages: [] };
    } else {
      out[p.name] = { status: 'fail', messages: lines.slice(0, 12) };
    }
  }
  return out;
}
