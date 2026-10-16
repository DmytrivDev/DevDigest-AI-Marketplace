import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Builds a throwaway git repository that mirrors the design prototype's data as REAL files
// (plugin.json, SKILL.md, agents, hooks.json, .mcp.json) with a scripted history.
// Test-only: used by the indexer/changelog tests and for manual visual checks (DD_REPO_ROOT=<dir> npm run dev).

const HERE = dirname(fileURLToPath(import.meta.url));
export const PROTOTYPE = resolve(HERE, '../fixtures/prototype');

export interface Dates {
  v1: string;
  v2: string;
  v3: string;
  pending: string;
}
export const FIXED_DATES: Dates = {
  v1: '2026-09-16T08:00:00Z',
  v2: '2026-10-02T09:00:00Z',
  v3: '2026-10-14T10:00:00Z',
  pending: '2026-10-15T10:00:00Z',
};

const body = (type: string, name: string): string => readFileSync(join(PROTOTYPE, 'bodies', type, `${name}.md`), 'utf8');
interface Fx {
  artifacts: { type: string; name: string; description: string; tags: string[]; details: { fields?: [string, string][] } }[];
}
const fx = (): Fx => JSON.parse(readFileSync(join(PROTOTYPE, 'catalog.json'), 'utf8')) as Fx;

function write(root: string, rel: string, text: string): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, text);
}
function remove(root: string, rel: string): void {
  rmSync(join(root, rel), { force: true });
}

function git(root: string, date: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  });
}

function fmFile(name: string, desc: string, extra: Record<string, string>, text: string): string {
  const lines = ['---', `name: ${name}`, `description: ${JSON.stringify(desc.replace(/`/g, ''))}`];
  for (const [k, v] of Object.entries(extra)) lines.push(`${k}: ${JSON.stringify(v)}`);
  return `${lines.join('\n')}\n---\n\n${text}`;
}

const SKILL_EXTRA = (name: string): Record<string, string> =>
  name === 'review' ? { 'allowed-tools': 'Read, Grep, Glob, Bash(git diff:*)', 'argument-hint': '[--base <branch>] [--focus <area>]' } : { 'allowed-tools': 'Read, Grep, Glob' };

function writeComponent(root: string, type: string, name: string, extraBody = ''): void {
  const a = fx().artifacts.find((x) => x.type === type && x.name === name)!;
  const text = body(type, name) + extraBody;
  if (type === 'skill') {
    write(root, `plugins/devdigest/skills/${name}/SKILL.md`, fmFile(name, a.description, SKILL_EXTRA(name), text));
    if (name === 'review') {
      write(root, 'plugins/devdigest/skills/review/references/severity.md', '# Severity\n\nblocker, major, minor, nit\n');
      write(root, 'plugins/devdigest/skills/review/scripts/collect-diff.sh', '#!/bin/sh\ngit diff\n');
    }
  } else if (type === 'agent') {
    write(root, `plugins/devdigest/agents/${name}.md`, fmFile(name, a.description, { tools: 'Read, Grep, Glob', model: 'inherit' }, text));
  } else if (type === 'command') {
    write(root, `plugins/devdigest/commands/${name}.md`, fmFile(name, a.description, { 'argument-hint': '<agent-name>', 'allowed-tools': 'Read, Write' }, text));
  }
}

const manifest = (version: string): string =>
  `${JSON.stringify(
    {
      name: 'devdigest',
      version,
      description: 'DevDigest review workflow for Claude Code: skills, agents, hooks and MCP server',
      author: { name: 'DevDigest' },
      homepage: 'https://github.com/DmytrivDev/DevDigest-AI-Marketplace',
      keywords: ['code-review', 'pull-requests', 'devdigest'],
    },
    null,
    2,
  )}\n`;

export interface PrototypeRepo {
  root: string;
  shas: { v1: string; v2: string; v3: string; pending: string };
}

export function createPrototypeRepo(root: string, dates: Dates = FIXED_DATES): PrototypeRepo {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  git(root, dates.v1, 'init', '-q', '-b', 'main');
  write(
    root,
    '.claude-plugin/marketplace.json',
    `${JSON.stringify(
      {
        name: 'devdigest-marketplace',
        description: 'Claude Code plugins for DevDigest, the local-first AI PR reviewer',
        owner: { name: 'DmytrivDev' },
        plugins: [
          {
            name: 'devdigest',
            source: './plugins/devdigest',
            description: 'DevDigest review workflow for Claude Code: skills, agents, hooks and MCP server',
            category: 'code-review',
            tags: ['code-review', 'pull-requests', 'devdigest'],
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  const readme = readFileSync(join(PROTOTYPE, 'readme.md'), 'utf8');
  write(root, 'plugins/devdigest/README.md', `# devdigest\n\n${readme}`);

  // v1: plugin added with an agent, a hook, an MCP server and a command.
  write(root, 'plugins/devdigest/.claude-plugin/plugin.json', manifest('0.1.0'));
  writeComponent(root, 'agent', 'security-reviewer');
  write(root, 'plugins/devdigest/commands/summarize.md', fmFile('summarize', 'Summarizes a pull request.', {}, 'Summarize the diff.\n'));
  write(
    root,
    'plugins/devdigest/hooks/hooks.json',
    `${JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/scripts/pre-tool-use-bash.js'] }] }] } }, null, 2)}\n`,
  );
  write(root, 'plugins/devdigest/scripts/pre-tool-use-bash.js', '// blocks commits with secrets\n');
  write(root, 'plugins/devdigest/.mcp.json', `${JSON.stringify({ mcpServers: { devdigest: { command: 'npx', args: ['devdigest-mcp'], env: { DEVDIGEST_URL: 'http://localhost:7777' } } } }, null, 2)}\n`);
  git(root, dates.v1, 'add', '-A');
  git(root, dates.v1, 'commit', '-q', '-m', 'feat: add devdigest plugin');
  const v1 = git(root, dates.v1, 'rev-parse', 'HEAD').trim();

  // v2: version bump with more components.
  write(root, 'plugins/devdigest/.claude-plugin/plugin.json', manifest('0.2.0'));
  writeComponent(root, 'skill', 'dependency-checker');
  writeComponent(root, 'agent', 'test-quality-reviewer');
  writeComponent(root, 'agent', 'performance-reviewer');
  writeComponent(root, 'command', 'export-ci');
  git(root, dates.v2, 'add', '-A');
  git(root, dates.v2, 'commit', '-q', '-m', 'feat: review agents for tests and performance, export-ci command');
  const v2 = git(root, dates.v2, 'rev-parse', 'HEAD').trim();

  // v3: version bump, skills added, an agent changed, a command removed, release notes in CHANGELOG.md.
  write(root, 'plugins/devdigest/.claude-plugin/plugin.json', manifest('0.3.0'));
  writeComponent(root, 'skill', 'review');
  writeComponent(root, 'skill', 'pr-brief');
  writeComponent(root, 'agent', 'security-reviewer', '\nAlso checks config files for leaked secrets.\n');
  remove(root, 'plugins/devdigest/commands/summarize.md');
  write(
    root,
    'plugins/devdigest/CHANGELOG.md',
    '# Changelog\n\n## [0.3.0] - 2026-10-14\n\n- New `review` skill reports findings grouped by severity.\n- `summarize` is removed. Use `pr-brief` instead.\n\n## [0.2.0] - 2026-10-02\n\n- Two new review agents.\n',
  );
  git(root, dates.v3, 'add', '-A');
  git(root, dates.v3, 'commit', '-q', '-m', 'feat: review and pr-brief skills (0.3.0)');
  const v3 = git(root, dates.v3, 'rev-parse', 'HEAD').trim();

  // Unreleased: the review skill changed without a version bump.
  writeComponent(root, 'skill', 'review', '\nTune severity in references/severity.md.\n');
  git(root, dates.pending, 'add', '-A');
  git(root, dates.pending, 'commit', '-q', '-m', 'fix: clarify review skill');
  const pending = git(root, dates.pending, 'rev-parse', 'HEAD').trim();

  return { root, shas: { v1, v2, v3, pending } };
}

export { git as gitIn, write as writeFileIn };
