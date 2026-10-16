import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/data/build-catalog';
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
