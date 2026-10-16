// Regenerates tests/fixtures/prototype/* (TEST-ONLY data, never imported by pages) from the Claude Design prototype's data (9 artifacts, 3 releases).
// Run with: npm run fixtures:update
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStats } from '../src/data/build-stats';
import { stripMarkdown } from '../src/data/frontmatter';
import { emptyCounts, type Artifact, type ArtifactRef, type ArtifactType, type Catalog, type Changelog, type Release } from '../src/lib/types';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../tests/fixtures/prototype');
const REPO = 'DmytrivDev/DevDigest-AI-Marketplace';
const MP = 'devdigest-marketplace';
const INSTALL = `/plugin install devdigest@${MP}`;
const GENERATED = '2026-10-16T12:00:00Z';
const COMMIT = '45adf15e3b1c9d27a05f6b84c21d90e7f3a6b5c8';
const D14 = '2026-10-14T10:00:00Z';
const D02 = '2026-10-02T09:00:00Z';
const D16 = '2026-09-16T08:00:00Z';
const kb = (n: number) => Math.round(n * 1024);

type Spec = { type: Exclude<ArtifactType, 'plugin'>; name: string; desc: string; tags: string[]; updated: string; cmd: string };
const ARTS: Spec[] = [
  { type: 'skill', name: 'review', desc: 'Reviews a pull request diff and reports findings grouped by severity, with file and line references.', tags: ['review', 'pr'], updated: D14, cmd: '/devdigest:review' },
  { type: 'skill', name: 'pr-brief', desc: 'Summarizes a pull request into a short brief: intent, risky areas and the files to read first.', tags: ['pr', 'summary'], updated: D14, cmd: '/devdigest:pr-brief' },
  { type: 'skill', name: 'dependency-checker', desc: 'Checks new or updated dependencies for license issues, known vulnerabilities and bundle size impact.', tags: ['dependencies', 'security'], updated: D02, cmd: '/devdigest:dependency-checker' },
  { type: 'agent', name: 'security-reviewer', desc: 'Audits a diff for injection, broken auth, unsafe deserialization and leaked secrets.', tags: ['security', 'review'], updated: D14, cmd: INSTALL },
  { type: 'agent', name: 'test-quality-reviewer', desc: 'Flags weak assertions, missing edge cases and flaky test patterns in changed tests.', tags: ['tests', 'review'], updated: D02, cmd: INSTALL },
  { type: 'agent', name: 'performance-reviewer', desc: 'Finds N+1 queries, unbounded loops and needless re-renders introduced by a change.', tags: ['performance', 'review'], updated: D02, cmd: INSTALL },
  { type: 'command', name: 'export-ci', desc: 'Exports a review agent as a ready-to-commit GitHub Actions workflow. Argument: `<agent-name>`', tags: ['ci', 'github-actions'], updated: D02, cmd: '/devdigest:export-ci <agent-name>' },
  { type: 'hook', name: 'pre-tool-use-bash', desc: 'Blocks `git commit` when staged files contain secrets or private keys.', tags: ['git', 'security'], updated: D16, cmd: INSTALL },
  { type: 'mcp', name: 'devdigest', desc: 'Exposes reviews, findings and agents to Claude through an MCP server. Env vars: `DEVDIGEST_URL`', tags: ['mcp'], updated: D16, cmd: INSTALL },
];
const PLUGIN_TAGS = ['code-review', 'pull-requests', 'devdigest'];
const PLUGIN_DESC = 'DevDigest review workflow for Claude Code: skills, agents, hooks and MCP server';

const REVIEW_BODY = `## What it does

Reads the diff of the current branch against its base and reports findings grouped by severity: blocker, major, minor and nit. Every finding points to a file and line, so you can jump straight to it.

## When to use

- Before you request a review on a pull request.
- After a large refactor, to catch regressions the tests miss.
- When you inherit a pull request and need to know where the risk is.

## Usage

\`\`\`
/devdigest:review
/devdigest:review --base main --focus security
\`\`\`

Without arguments the skill compares \`HEAD\` with the merge base of the default branch.

## Output

\`\`\`
Blockers (1)
  src/auth/session.ts:42   Token compared with == instead of a constant-time check

Major (2)
  src/api/orders.ts:118    Query runs inside a loop over order items
  src/api/orders.ts:131    Error from the payment client is swallowed
\`\`\`

Severity rules live in \`references/severity.md\`. Edit that file to tune what counts as a blocker for your team.
`;

const README = `DevDigest review workflow for Claude Code. It connects Claude to a local DevDigest instance and adds skills, agents and hooks for reviewing pull requests.

## What's inside

- 3 skills: \`review\`, \`pr-brief\`, \`dependency-checker\`
- 3 review agents: security, test quality and performance
- \`export-ci\` command that turns an agent into a GitHub Actions workflow
- \`pre-tool-use-bash\` hook that blocks commits containing secrets
- MCP server that exposes reviews and findings to Claude

## Requirements

- Claude Code with plugin support
- DevDigest running locally, with \`DEVDIGEST_URL\` pointing to it

## Quick start

\`\`\`
${INSTALL}
/devdigest:review
\`\`\`
`;

function detail(a: Spec): { fieldsTitle: 'Frontmatter' | 'Configuration'; fields: [string, string][]; files: { path: string; size: number; description: string }[]; sourcePath: string; body: string } {
  const plain = a.desc.replace(/`/g, '');
  if (a.type === 'skill' && a.name === 'review') {
    return {
      fieldsTitle: 'Frontmatter',
      fields: [['name', 'review'], ['description', plain], ['allowed-tools', 'Read, Grep, Glob, Bash(git diff:*)'], ['argument-hint', '[--base <branch>] [--focus <area>]']],
      files: [
        { path: 'SKILL.md', size: kb(3.2), description: 'Instructions and frontmatter' },
        { path: 'references/severity.md', size: kb(1.4), description: 'Severity rules' },
        { path: 'scripts/collect-diff.sh', size: kb(0.6), description: 'Collects the diff and file list' },
      ],
      sourcePath: 'plugins/devdigest/skills/review',
      body: REVIEW_BODY,
    };
  }
  const inv = a.type === 'skill' || a.type === 'command';
  const head = `## What it does\n\n${a.desc}\n\n## ${inv ? 'Usage' : 'Install'}\n\n\`\`\`\n${a.cmd}\n\`\`\`\n\n`;
  switch (a.type) {
    case 'skill':
      return { fieldsTitle: 'Frontmatter', fields: [['name', a.name], ['description', plain], ['allowed-tools', 'Read, Grep, Glob']], files: [{ path: 'SKILL.md', size: kb(2.4), description: 'Instructions and frontmatter' }], sourcePath: `plugins/devdigest/skills/${a.name}`, body: head + 'Claude can also load this skill on its own when your request matches its description.\n' };
    case 'agent':
      return { fieldsTitle: 'Frontmatter', fields: [['name', a.name], ['description', plain], ['tools', 'Read, Grep, Glob'], ['model', 'inherit']], files: [{ path: `agents/${a.name}.md`, size: kb(1.9), description: 'Agent prompt and frontmatter' }], sourcePath: `plugins/devdigest/agents/${a.name}.md`, body: head + `Claude delegates to this agent when a task matches its description. You can also ask for it by name: “Use the ${a.name} agent on this diff.”\n` };
    case 'command':
      return { fieldsTitle: 'Frontmatter', fields: [['name', a.name], ['description', plain], ['argument-hint', '<agent-name>'], ['allowed-tools', 'Read, Write']], files: [{ path: `commands/${a.name}.md`, size: kb(1.2), description: 'Command prompt' }], sourcePath: `plugins/devdigest/commands/${a.name}.md`, body: head + "Replace `<agent-name>` with one of the plugin's agents, for example `security-reviewer`.\n" };
    case 'hook':
      return { fieldsTitle: 'Configuration', fields: [['event', 'PreToolUse'], ['matcher', 'Bash'], ['command', 'scripts/pre-tool-use-bash.sh']], files: [{ path: 'hooks/hooks.json', size: kb(0.3), description: 'Hook registration' }, { path: 'scripts/pre-tool-use-bash.sh', size: kb(1.1), description: 'Secret scanner' }], sourcePath: 'plugins/devdigest/hooks/hooks.json', body: head + 'Runs before every Bash tool call and stops a `git commit` that would include a secret. It runs automatically once the plugin is installed.\n' };
    case 'mcp':
      return { fieldsTitle: 'Configuration', fields: [['server', 'devdigest'], ['command', 'npx devdigest-mcp'], ['env', 'DEVDIGEST_URL']], files: [{ path: '.mcp.json', size: kb(0.2), description: 'Server definition' }], sourcePath: 'plugins/devdigest/.mcp.json', body: head + 'Set `DEVDIGEST_URL` to the address of your local DevDigest instance before starting Claude Code.\n' };
  }
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(resolve(OUT, 'bodies'), { recursive: true });

const artifacts: Artifact[] = [];
artifacts.push({
  id: 'devdigest:plugin:devdigest',
  type: 'plugin',
  name: 'devdigest',
  slug: 'devdigest',
  plugin: 'devdigest',
  description: PLUGIN_DESC,
  tags: PLUGIN_TAGS,
  category: 'code-review',
  version: '0.3.0',
  searchText: stripMarkdown(README),
  sourcePath: 'plugins/devdigest',
  updatedAt: D14,
  details: { author: 'DevDigest', homepage: `https://github.com/${REPO}`, repository: `https://github.com/${REPO}`, hasReadme: true },
  validation: { status: 'pass', messages: [] },
});
for (const a of ARTS) {
  const d = detail(a);
  const art: Artifact = {
    id: `devdigest:${a.type}:${a.name}`,
    type: a.type,
    name: a.name,
    slug: a.name,
    plugin: 'devdigest',
    description: a.desc,
    tags: a.tags,
    category: 'code-review',
    searchText: stripMarkdown(d.body),
    sourcePath: d.sourcePath,
    updatedAt: a.updated,
    details: { fieldsTitle: d.fieldsTitle, fields: d.fields, files: d.files },
  };
  if (a.type === 'skill' || a.type === 'command') art.invoke = a.cmd;
  artifacts.push(art);
  mkdirSync(resolve(OUT, 'bodies', a.type), { recursive: true });
  writeFileSync(resolve(OUT, 'bodies', a.type, `${a.name}.md`), d.body);
}
artifacts.sort((x, y) => (x.id < y.id ? -1 : 1));

const catalog: Catalog = {
  schemaVersion: 1,
  generatedAt: GENERATED,
  commit: COMMIT,
  marketplace: { name: MP, description: 'Claude Code plugins for DevDigest, the local-first AI PR reviewer', repo: REPO },
  artifacts,
};

const ref = (type: ArtifactType, name: string): ArtifactRef => ({ id: `devdigest:${type}:${name}`, type, name, exists: ARTS.some((a) => a.type === type && a.name === name) });
const li = (xs: string[]) => `<ul>${xs.map((x) => `<li>${x.replace(/`([^`]+)`/g, '<code>$1</code>')}</li>`).join('')}</ul>`;
const counts = (o: Partial<Record<ArtifactType, number>>) => ({ ...emptyCounts(), ...o });

const releases: Release[] = [
  {
    id: 'devdigest@0.3.0', kind: 'release', plugin: 'devdigest', version: '0.3.0', previousVersion: '0.2.0', date: D14, commit: 'a1b2c3d',
    changes: { added: [ref('skill', 'review'), ref('skill', 'pr-brief')], updated: [ref('agent', 'security-reviewer')], removed: [ref('command', 'summarize')] },
    notes: { source: 'changelog', html: li(['New `review` skill reports findings grouped by severity, with file and line references.', '`pr-brief` gives late reviewers a short brief of the change.', '`security-reviewer` now also checks config files for leaked secrets.', '`summarize` is removed. Use `pr-brief` instead.']) },
    counts: counts({ skill: 3, agent: 3, command: 1, hook: 1, mcp: 1 }),
  },
  {
    id: 'devdigest@0.2.0', kind: 'release', plugin: 'devdigest', version: '0.2.0', previousVersion: '0.1.0', date: D02, commit: '9f8e7d6',
    changes: { added: [ref('skill', 'dependency-checker'), ref('agent', 'test-quality-reviewer'), ref('agent', 'performance-reviewer'), ref('command', 'export-ci')], updated: [], removed: [] },
    notes: { source: 'changelog', html: li(['Two new review agents for tests and performance.', '`export-ci` writes a GitHub Actions workflow for any review agent.', '`dependency-checker` flags license and vulnerability issues in new dependencies.']) },
    counts: counts({ skill: 1, agent: 3, command: 2, hook: 1, mcp: 1 }),
  },
  {
    id: 'devdigest@added', kind: 'plugin-added', plugin: 'devdigest', version: '0.1.0', previousVersion: null, date: D16, commit: '3c4d5e6',
    changes: { added: [ref('agent', 'security-reviewer'), ref('hook', 'pre-tool-use-bash'), ref('mcp', 'devdigest'), ref('command', 'summarize')], updated: [], removed: [] },
    notes: { source: 'changelog', html: li(['First release: the security review agent, a hook that blocks commits with secrets, and the MCP server.']) },
    counts: counts({ skill: 0, agent: 1, command: 1, hook: 1, mcp: 1 }),
  },
];
const changelog: Changelog = {
  schemaVersion: 1,
  generatedAt: GENERATED,
  commit: COMMIT,
  historyStart: D16,
  truncated: false,
  releases,
  pending: [{ plugin: 'devdigest', since: '0.3.0', changes: { added: [], updated: [ref('skill', 'review')], removed: [] } }],
};

const stats = buildStats(catalog, changelog, { stars: 12, forks: 2, openIssues: 3, contributors: 2, fetchedAt: '2026-10-16T05:17:00Z' });

const w = (f: string, v: unknown) => writeFileSync(resolve(OUT, f), typeof v === 'string' ? v : `${JSON.stringify(v, null, 2)}\n`);
w('catalog.json', catalog);
w('changelog.json', changelog);
w('stats.json', stats);
w('readme.md', README);
console.log(`test fixtures written to ${OUT}`);
