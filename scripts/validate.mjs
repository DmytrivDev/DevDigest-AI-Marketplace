#!/usr/bin/env node
// Validates the marketplace and every plugin in it.
//
//   node scripts/validate.mjs            manifest checks + `claude plugin validate --strict`
//   node scripts/validate.mjs --install  also add the marketplace and install every plugin
//                                        in a throwaway Claude config dir
//
// Covers what `claude plugin validate` misses: a relative `source` that does not exist,
// an entry name that differs from plugin.json, `version` set in the marketplace entry,
// and external sources not pinned to a commit sha.
// Exit code: 0 when everything passes, 1 otherwise.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MARKETPLACE_FILE = join(ROOT, '.claude-plugin', 'marketplace.json');
const SHA_RE = /^[0-9a-f]{40}$/;
const PINNED_SOURCES = new Set(['github', 'url', 'git-subdir']);

const failures = [];
const fail = (msg) => failures.push(msg);
const ok = (msg) => console.log(`  ✔ ${msg}`);

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    fail(`${file}: ${err.message}`);
    return null;
  }
}

// `claude` is an npm shim (claude.cmd) on Windows, which only a shell can start.
function claude(args, env = process.env) {
  const cmd = ['claude', ...args.map((a) => (/[\s"]/.test(a) ? `"${a}"` : a))].join(' ');
  const res = spawnSync(cmd, { cwd: ROOT, env, shell: true, encoding: 'utf8' });
  return { status: res.status, output: `${res.stdout ?? ''}${res.stderr ?? ''}`.trim() };
}

function checkEntry(entry) {
  const label = `plugin "${entry.name}"`;
  const failuresBefore = failures.length;

  if (typeof entry.source !== 'string') {
    const { source, sha } = entry.source ?? {};
    if (PINNED_SOURCES.has(source) && !SHA_RE.test(sha ?? '')) {
      fail(`${label}: external "${source}" source must pin a full 40-char "sha"`);
    } else {
      ok(`${label}: external "${source}" source`);
    }
    return null;
  }

  if (!entry.source.startsWith('./') || entry.source.includes('..')) {
    fail(`${label}: relative source must start with "./" and must not contain ".."`);
    return null;
  }
  const dir = join(ROOT, entry.source);
  if (!existsSync(dir)) {
    fail(`${label}: source directory ${entry.source} does not exist`);
    return null;
  }
  if ('version' in entry) {
    fail(`${label}: remove "version" from marketplace.json — it belongs in plugin.json only`);
  }

  const manifestFile = join(dir, '.claude-plugin', 'plugin.json');
  if (existsSync(manifestFile)) {
    const manifest = readJson(manifestFile);
    if (manifest && manifest.name !== entry.name) {
      fail(`${label}: entry name differs from plugin.json name "${manifest.name}"`);
    }
    if (manifest && !manifest.version) {
      fail(`${label}: plugin.json has no "version"`);
    }
  }
  if (failures.length === failuresBefore) ok(`${label}: ${entry.source}`);
  return entry.source;
}

function runValidate(target) {
  const { status, output } = claude(['plugin', 'validate', target, '--strict']);
  if (status === 0) ok(`claude plugin validate ${target} --strict`);
  else fail(`claude plugin validate ${target} --strict\n${output}`);
}

function runInstallLoop(marketplaceName, pluginNames) {
  const configDir = mkdtempSync(join(tmpdir(), 'devdigest-marketplace-'));
  const env = { ...process.env, CLAUDE_CONFIG_DIR: configDir };
  try {
    const add = claude(['plugin', 'marketplace', 'add', './'], env);
    if (add.status !== 0) {
      fail(`claude plugin marketplace add ./\n${add.output}`);
      return;
    }
    ok('claude plugin marketplace add ./');
    for (const name of pluginNames) {
      const id = `${name}@${marketplaceName}`;
      const res = claude(['plugin', 'install', id], env);
      if (res.status === 0) ok(`claude plugin install ${id}`);
      else fail(`claude plugin install ${id}\n${res.output}`);
    }
  } finally {
    rmSync(configDir, { recursive: true, force: true });
  }
}

const marketplace = readJson(MARKETPLACE_FILE);
if (marketplace) {
  console.log(`Marketplace "${marketplace.name}"`);
  const plugins = marketplace.plugins ?? [];
  const localSources = plugins.map(checkEntry).filter(Boolean);

  console.log('claude plugin validate');
  runValidate('.');
  for (const source of localSources) runValidate(source);

  if (process.argv.includes('--install')) {
    console.log('Install loop (isolated config)');
    runInstallLoop(marketplace.name, plugins.map((p) => p.name));
  }
}

if (failures.length) {
  console.error(`\n✘ ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\n✔ All checks passed');
