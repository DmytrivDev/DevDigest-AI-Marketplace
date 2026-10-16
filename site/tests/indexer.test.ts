import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/data/build-catalog';
import { parseCompatibility } from '../src/data/dependencies';
import { hookName, toSlug } from '../src/data/discover';
import { parseFrontmatter } from '../src/data/frontmatter';
import { BuildError } from '../src/lib/types';
import { createPrototypeRepo } from './helpers/repo';

const tmp = mkdtempSync(join(tmpdir(), 'dd-indexer-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const base = { commit: 'abc', generatedAt: '2026-10-16T12:00:00Z', repo: 'o/r', updatedAt: () => null };

/** Writes a minimal marketplace tree and returns its root. */
function tree(name: string, files: Record<string, string>): string {
  const root = join(tmp, name);
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
  return root;
}
const mp = (plugins: unknown[]) => JSON.stringify({ name: 'm', description: 'd', owner: { name: 'o' }, plugins });
const plugin = (extra: object = {}) => JSON.stringify({ name: 'p', version: '1.0.0', description: 'A plugin', keywords: ['kw'], ...extra });
const local = { name: 'p', source: './plugins/p', category: 'cat', tags: ['t1'] };

describe('slugs and names (5.1.1)', () => {
  it('slugs reduce to [a-z0-9-]', () => {
    expect(toSlug('My Skill_v2!')).toBe('my-skill-v2');
  });
  it('hook names are kebab-case from event and matcher', () => {
    expect(hookName('PreToolUse', 'Bash')).toBe('pre-tool-use-bash');
    expect(hookName('SessionStart', '')).toBe('session-start');
    expect(hookName('PostToolUse', '*')).toBe('post-tool-use-any');
  });
});

describe('frontmatter', () => {
  it('reports the file and line of invalid YAML', () => {
    expect(() => parseFrontmatter('---\nname: a\ndescription: [oops\n---\nbody', 'x/SKILL.md')).toThrow(/x\/SKILL\.md:\d+: invalid YAML/);
  });
  it('returns the body without frontmatter', () => {
    expect(parseFrontmatter('---\nname: a\n---\nhello', 'f')).toEqual({ data: { name: 'a' }, body: 'hello' });
  });
});

describe('indexer on the prototype repository (real files)', () => {
  let r: ReturnType<typeof buildCatalog>;
  beforeAll(() => {
    const repo = createPrototypeRepo(join(tmp, 'proto'));
    r = buildCatalog({ ...base, root: repo.root });
  });

  it('finds the plugin and every component type', () => {
    const byType = (t: string) => r.catalog.artifacts.filter((a) => a.type === t).map((a) => a.name).sort();
    expect(byType('plugin')).toEqual(['devdigest']);
    expect(byType('skill')).toEqual(['dependency-checker', 'pr-brief', 'review']);
    expect(byType('agent')).toEqual(['performance-reviewer', 'security-reviewer', 'test-quality-reviewer']);
    expect(byType('command')).toEqual(['export-ci']);
    expect(byType('hook')).toEqual(['pre-tool-use-bash']);
    expect(byType('mcp')).toEqual(['devdigest']);
  });
  it('builds ids, invoke commands and tags per spec', () => {
    const review = r.catalog.artifacts.find((a) => a.id === 'devdigest:skill:review')!;
    expect(review.invoke).toBe('/devdigest:review');
    expect(review.tags).toEqual(['code-review', 'pull-requests', 'devdigest']);
    expect(review.sourcePath).toBe('plugins/devdigest/skills/review');
    expect(review.details.files?.map((f) => f.path).sort()).toEqual(['SKILL.md', 'references/severity.md', 'scripts/collect-diff.sh']);
    expect(r.catalog.artifacts.find((a) => a.id === 'devdigest:command:export-ci')!.invoke).toBe('/devdigest:export-ci <agent-name>');
  });
  it('keeps MCP env names but never their values (12)', () => {
    const json = JSON.stringify(r.catalog);
    expect(json).toContain('DEVDIGEST_URL');
    expect(json).not.toContain('localhost:7777');
  });
  it('keeps markdown bodies out of catalog.json', () => {
    expect(JSON.stringify(r.catalog)).not.toContain('```');
    expect(JSON.stringify(r.catalog)).not.toContain('"body"');
    expect(r.bodies['devdigest:skill:review']).toContain('merge base');
    expect(r.catalog.artifacts.find((a) => a.id === 'devdigest:skill:review')!.searchText.length).toBeLessThanOrEqual(4000);
  });
  it('reads the plugin README and version', () => {
    expect(r.readmes.devdigest).toContain('# devdigest');
    expect(r.catalog.artifacts.find((a) => a.type === 'plugin')!.version).toBe('0.3.0');
  });
  it('is deterministic and sorted by id', () => {
    const again = buildCatalog({ ...base, root: join(tmp, 'proto') });
    expect(JSON.stringify(again.catalog)).toBe(JSON.stringify(r.catalog));
    const ids = r.catalog.artifacts.map((a) => a.id);
    expect(ids).toEqual([...ids].sort());
  });
});

describe('indexer rules (5.3)', () => {
  it('warns about a missing description and still indexes the artifact', () => {
    const root = tree('nodesc', {
      '.claude-plugin/marketplace.json': mp([local]),
      'plugins/p/.claude-plugin/plugin.json': plugin(),
      'plugins/p/agents/a.md': '---\nname: a\n---\nBody',
    });
    const r = buildCatalog({ ...base, root });
    expect(r.catalog.artifacts.some((a) => a.id === 'p:agent:a')).toBe(true);
    expect(r.warnings.join('\n')).toMatch(/agents\/a\.md.*description/);
  });
  it('fails the build on invalid YAML with the path', () => {
    const root = tree('badyaml', {
      '.claude-plugin/marketplace.json': mp([local]),
      'plugins/p/.claude-plugin/plugin.json': plugin(),
      'plugins/p/skills/s/SKILL.md': '---\nname: s\ndescription: [oops\n---\nx',
    });
    expect(() => buildCatalog({ ...base, root })).toThrow(/skills\/s\/SKILL\.md:\d+/);
  });
  it('fails the build on invalid JSON with the path', () => {
    const root = tree('badjson', {
      '.claude-plugin/marketplace.json': mp([local]),
      'plugins/p/.claude-plugin/plugin.json': '{ "name": ',
    });
    expect(() => buildCatalog({ ...base, root })).toThrow(BuildError);
    expect(() => buildCatalog({ ...base, root })).toThrow(/plugin\.json/);
  });
  it('fails on a slug collision for skills but suffixes hooks', () => {
    const skills = tree('dupskill', {
      '.claude-plugin/marketplace.json': mp([local]),
      'plugins/p/.claude-plugin/plugin.json': plugin(),
      'plugins/p/skills/one/SKILL.md': '---\nname: Same Name\ndescription: d\n---\n',
      'plugins/p/skills/two/SKILL.md': '---\nname: same-name\ndescription: d\n---\n',
    });
    expect(() => buildCatalog({ ...base, root: skills })).toThrow(/duplicate skill slug/);
    const hooks = tree('duphook', {
      '.claude-plugin/marketplace.json': mp([local]),
      'plugins/p/.claude-plugin/plugin.json': plugin(),
      'plugins/p/hooks/hooks.json': JSON.stringify({
        hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'a' }] }, { matcher: 'Bash', hooks: [{ type: 'command', command: 'b' }] }] },
      }),
    });
    const names = buildCatalog({ ...base, root: hooks }).catalog.artifacts.filter((a) => a.type === 'hook').map((a) => a.slug);
    expect(names).toEqual(['pre-tool-use-bash', 'pre-tool-use-bash-2']);
  });
  it('marks a name mismatch as a failed validation and continues', () => {
    const root = tree('mismatch', {
      '.claude-plugin/marketplace.json': mp([local]),
      'plugins/p/.claude-plugin/plugin.json': plugin({ name: 'other' }),
    });
    const p = buildCatalog({ ...base, root }).catalog.artifacts.find((a) => a.type === 'plugin')!;
    expect(p.validation?.status).toBe('fail');
    expect(p.validation?.messages.join(' ')).toMatch(/"other".*"p"/);
  });
  it('indexes an external plugin without components', () => {
    const root = tree('external', {
      '.claude-plugin/marketplace.json': mp([{ name: 'ext', source: { source: 'github', repo: 'a/b', sha: 'x' }, description: 'Ext', tags: ['x'] }]),
    });
    const a = buildCatalog({ ...base, root }).catalog.artifacts;
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ type: 'plugin', external: true, sourcePath: 'a/b' });
  });
  it('honors custom component paths from plugin.json and ignores paths that escape the plugin', () => {
    const root = tree('custom', {
      '.claude-plugin/marketplace.json': mp([local]),
      'plugins/p/.claude-plugin/plugin.json': plugin({ skills: ['./my-skills', '../outside'], agents: './team/agents' }),
      'plugins/p/my-skills/x/SKILL.md': '---\nname: x\ndescription: d\n---\n',
      'plugins/p/skills/ignored/SKILL.md': '---\nname: ignored\ndescription: d\n---\n',
      'plugins/p/team/agents/boss.md': '---\ndescription: d\n---\n',
    });
    const ids = buildCatalog({ ...base, root }).catalog.artifacts.map((a) => a.id);
    expect(ids).toContain('p:skill:x');
    expect(ids).toContain('p:agent:boss');
    expect(ids).not.toContain('p:skill:ignored');
  });
  it('reads MCP servers inline from plugin.json', () => {
    const root = tree('inline', {
      '.claude-plugin/marketplace.json': mp([local]),
      'plugins/p/.claude-plugin/plugin.json': plugin({ mcpServers: { srv: { command: 'node', args: ['s.js'], env: { TOKEN: 'secret' } } } }),
    });
    const r = buildCatalog({ ...base, root });
    const srv = r.catalog.artifacts.find((a) => a.id === 'p:mcp:srv')!;
    expect(srv.details.fields).toContainEqual(['env', 'TOKEN']);
    expect(JSON.stringify(r.catalog)).not.toContain('secret');
  });
  it('a real repository state with no components yields only the plugin', () => {
    const root = tree('empty', {
      '.claude-plugin/marketplace.json': mp([local]),
      'plugins/p/.claude-plugin/plugin.json': plugin(),
      'plugins/p/README.md': '# p\n',
    });
    const r = buildCatalog({ ...base, root });
    expect(r.catalog.artifacts.map((a) => a.type)).toEqual(['plugin']);
  });
});

describe('plugin dependencies and compatibility', () => {
  const two = (pName: string, extra: object = {}) => JSON.stringify({ name: pName, version: '1.0.0', description: `${pName} plugin`, ...extra });
  const entry = (n: string) => ({ name: n, source: `./plugins/${n}` });
  const byName = (r: ReturnType<typeof buildCatalog>, n: string) => r.catalog.artifacts.find((a) => a.type === 'plugin' && a.name === n)!;

  it('normalizes string and object entries, flags cross-marketplace ones and fills usedBy', () => {
    const root = tree('deps', {
      '.claude-plugin/marketplace.json': mp([entry('app'), entry('base'), entry('tools'), entry('lone')]),
      'plugins/app/.claude-plugin/plugin.json': two('app', {
        dependencies: [
          'base',
          { name: 'tools', version: '^1.0.0' },
          'helper@other-market',
          { name: 'linter', version: '>=2.0.0 <3', marketplace: 'other-market' },
          { name: 'base', marketplace: 'm' },
        ],
      }),
      'plugins/base/.claude-plugin/plugin.json': two('base'),
      'plugins/tools/.claude-plugin/plugin.json': two('tools', { dependencies: ['base@m'] }),
      'plugins/lone/.claude-plugin/plugin.json': two('lone'),
    });
    const r = buildCatalog({ ...base, root });
    expect(byName(r, 'app').dependencies).toEqual([
      { name: 'base', version: null, marketplace: null, internal: true },
      { name: 'tools', version: '^1.0.0', marketplace: null, internal: true },
      { name: 'helper', version: null, marketplace: 'other-market', internal: false },
      { name: 'linter', version: '>=2.0.0 <3', marketplace: 'other-market', internal: false },
    ]);
    expect(byName(r, 'tools').dependencies).toEqual([{ name: 'base', version: null, marketplace: 'm', internal: true }]);
    expect(byName(r, 'base').usedBy).toEqual(['app', 'tools']);
    expect(byName(r, 'tools').usedBy).toEqual(['app']);
    expect(byName(r, 'app').usedBy).toEqual([]);
    expect(byName(r, 'lone')).toMatchObject({ dependencies: [], usedBy: [] });
    // The listed-twice "base" (bare and with this marketplace's name) is reported, not kept.
    expect(r.warnings.join('\n')).toMatch(/app\/\.claude-plugin\/plugin\.json: dependencies\[4\].*listed twice/);
    // Components never carry dependency fields.
    expect(r.catalog.artifacts.filter((a) => a.type !== 'plugin').every((a) => a.dependencies === undefined)).toBe(true);
  });

  it('skips invalid entries with a warning and never fails the build', () => {
    const root = tree('baddeps', {
      '.claude-plugin/marketplace.json': mp([entry('app'), entry('ok')]),
      'plugins/app/.claude-plugin/plugin.json': two('app', {
        dependencies: [42, '', 'two words', 'a@b@c', { version: '^1' }, { name: 'ok', version: 3 }, { name: 'ok', marketplace: '' }, null, ['ok'], { name: 'ok', version: '~1.2' }],
      }),
      'plugins/ok/.claude-plugin/plugin.json': two('ok', { dependencies: 'not-an-array' }),
    });
    const r = buildCatalog({ ...base, root });
    expect(byName(r, 'app').dependencies).toEqual([{ name: 'ok', version: '~1.2', marketplace: null, internal: true }]);
    expect(byName(r, 'ok').dependencies).toEqual([]);
    expect(byName(r, 'ok').usedBy).toEqual(['app']);
    const w = r.warnings.join('\n');
    for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8]) expect(w).toContain(`dependencies[${i}]`);
    expect(w).toMatch(/plugins\/ok\/\.claude-plugin\/plugin\.json: "dependencies" must be an array/);
  });

  it('warns about an internal dependency that is not in the marketplace', () => {
    const root = tree('missingdep', {
      '.claude-plugin/marketplace.json': mp([entry('app')]),
      'plugins/app/.claude-plugin/plugin.json': two('app', { dependencies: ['ghost'] }),
    });
    const r = buildCatalog({ ...base, root });
    expect(byName(r, 'app').dependencies).toEqual([{ name: 'ghost', version: null, marketplace: null, internal: true }]);
    expect(r.warnings.join('\n')).toMatch(/dependency "ghost" is not a plugin of this marketplace/);
  });

  it('reads the Claude Code range from COMPATIBILITY.md and keeps its markdown out of catalog.json', () => {
    const doc = '# Compatibility — app\n\n**Claude Code:** `>=2.1.110`\n\n| | |\n|---|---|\n| Tested with | Claude Code `2.1.301` |\n';
    const root = tree('compat', {
      '.claude-plugin/marketplace.json': mp([entry('app'), entry('bare'), entry('loose')]),
      'plugins/app/.claude-plugin/plugin.json': two('app'),
      'plugins/app/COMPATIBILITY.md': doc,
      'plugins/bare/.claude-plugin/plugin.json': two('bare'),
      'plugins/loose/.claude-plugin/plugin.json': two('loose'),
      'plugins/loose/COMPATIBILITY.md': '# Compatibility\n\nWorks with any recent release.\n',
    });
    const r = buildCatalog({ ...base, root });
    expect(byName(r, 'app').compatibility).toEqual({ claudeCode: '>=2.1.110', doc: true });
    expect(byName(r, 'bare').compatibility).toEqual({ claudeCode: null, doc: false });
    expect(byName(r, 'loose').compatibility).toEqual({ claudeCode: null, doc: true });
    expect(r.compatDocs.app).toBe(doc);
    expect(r.compatDocs.bare).toBeUndefined();
    expect(JSON.stringify(r.catalog)).not.toContain('Tested with');
  });

  it('parses tolerant forms of the Claude Code line', () => {
    expect(parseCompatibility('**Claude Code**: `^2.1.0`').claudeCode).toBe('^2.1.0');
    expect(parseCompatibility('- Claude Code: ` >=2.0.0 `').claudeCode).toBe('>=2.0.0');
    expect(parseCompatibility('Intro\n\n**claude code:** `>=2.1.110`\n').claudeCode).toBe('>=2.1.110');
    expect(parseCompatibility('| Tested with | Claude Code `2.1.301` |').claudeCode).toBeNull();
    expect(parseCompatibility(null)).toEqual({ claudeCode: null, doc: false });
  });

  it('gives external plugins empty dependency data', () => {
    const root = tree('extdeps', {
      '.claude-plugin/marketplace.json': mp([{ name: 'ext', source: { source: 'github', repo: 'a/b' } }]),
    });
    expect(buildCatalog({ ...base, root }).catalog.artifacts[0]).toMatchObject({ dependencies: [], usedBy: [], compatibility: { claudeCode: null, doc: false } });
  });
});
