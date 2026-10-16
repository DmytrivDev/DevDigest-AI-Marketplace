import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/data/build-catalog';
import { buildChangelog, changelogSection } from '../src/data/build-changelog';
import { applyFreshness } from '../src/data/freshness';
import { renderMarkdown } from '../src/data/markdown';
import type { Changelog } from '../src/lib/types';
import { createPrototypeRepo, gitIn, writeFileIn, type PrototypeRepo } from './helpers/repo';

const tmp = mkdtempSync(join(tmpdir(), 'dd-changelog-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

let repo: PrototypeRepo;
let ids: Set<string>;
const opts = () => ({
  root: repo.root,
  commit: repo.shas.pending,
  generatedAt: '2026-10-16T12:00:00Z',
  currentIds: ids,
  renderNotes: (md: string) => renderMarkdown(md, { headingOffset: 2 }),
});

beforeAll(() => {
  repo = createPrototypeRepo(join(tmp, 'repo'));
  ids = new Set(buildCatalog({ root: repo.root, commit: 'x', generatedAt: 'x', repo: 'o/r', updatedAt: () => null }).catalog.artifacts.map((a) => a.id));
});

const names = (refs: { name: string }[]) => refs.map((r) => r.name).sort();

describe('changelog from git history (8.1-8.2)', () => {
  let cl: Changelog;
  beforeAll(async () => {
    cl = await buildChangelog(opts());
  });

  it('emits plugin-added and two releases, newest first', () => {
    expect(cl.releases.map((r) => [r.id, r.kind, r.version])).toEqual([
      ['devdigest@0.3.0', 'release', '0.3.0'],
      ['devdigest@0.2.0', 'release', '0.2.0'],
      ['devdigest@added', 'plugin-added', '0.1.0'],
    ]);
    expect(cl.releases[0].previousVersion).toBe('0.2.0');
    expect(cl.releases[0].commit).toBe(repo.shas.v3);
    expect(cl.truncated).toBe(false);
  });
  it('lists added, updated and removed artifacts', () => {
    const [r3, r2, r1] = cl.releases;
    expect(names(r1.changes.added)).toEqual(['devdigest', 'pre-tool-use-bash', 'security-reviewer', 'summarize']);
    expect(names(r2.changes.added)).toEqual(['dependency-checker', 'export-ci', 'performance-reviewer', 'test-quality-reviewer']);
    expect(names(r3.changes.added)).toEqual(['pr-brief', 'review']);
    expect(names(r3.changes.updated)).toEqual(['security-reviewer']);
    expect(names(r3.changes.removed)).toEqual(['summarize']);
  });
  it('marks refs that no longer exist in the catalog', () => {
    const removed = cl.releases[0].changes.removed[0];
    expect(removed.exists).toBe(false);
    expect(cl.releases[0].changes.added.every((a) => a.exists)).toBe(true);
  });
  it('puts unreleased changes into pending, not into a release', () => {
    expect(cl.pending).toHaveLength(1);
    expect(cl.pending[0]).toMatchObject({ plugin: 'devdigest', since: '0.3.0' });
    expect(names(cl.pending[0].changes.updated)).toEqual(['review']);
    expect(cl.releases.some((r) => r.commit === repo.shas.pending)).toBe(false);
  });
  it('takes notes from CHANGELOG.md when present and from commit subjects otherwise', () => {
    const [r3, r2] = cl.releases;
    expect(r3.notes?.source).toBe('changelog');
    expect(r3.notes?.source === 'changelog' && r3.notes.html).toContain('<li>');
    expect(r2.notes).toEqual({ source: 'commits', items: ['feat: review agents for tests and performance, export-ci command'], more: 0 });
  });
  it('counts artifacts per type after each release (growth)', () => {
    expect(cl.releases.map((r) => [r.counts.skill, r.counts.agent, r.counts.command, r.counts.hook, r.counts.mcp])).toEqual([
      [3, 3, 1, 1, 1],
      [1, 3, 2, 1, 1],
      [0, 1, 1, 1, 1],
    ]);
  });
  it('is deterministic', async () => {
    expect(JSON.stringify(await buildChangelog(opts()))).toBe(JSON.stringify(cl));
  });
  it('derives freshness badges within 14 days of generatedAt', () => {
    const catalog = buildCatalog({ root: repo.root, commit: 'x', generatedAt: '2026-10-16T12:00:00Z', repo: 'o/r', updatedAt: () => null }).catalog;
    const f = Object.fromEntries(applyFreshness(catalog, cl).artifacts.map((a) => [a.id, a.freshness]));
    expect(f['devdigest:skill:review']).toBe('new');
    expect(f['devdigest:agent:security-reviewer']).toBe('updated');
    expect(f['devdigest:skill:dependency-checker']).toBeUndefined();
  });
});

describe('truncated history', () => {
  it('treats the oldest commit in the window as a baseline (limit 3 of 4 commits)', async () => {
    const cl = await buildChangelog({ ...opts(), limit: 3 });
    expect(cl.truncated).toBe(true);
    // 0.2.0 is only the baseline of the cut window, so it is not reported as a release.
    expect(cl.releases.map((r) => r.id)).toEqual(['devdigest@0.3.0']);
    expect(cl.releases[0].changes.added.map((a) => a.name).sort()).toEqual(['pr-brief', 'review']);
    expect(cl.releases.some((r) => r.kind === 'plugin-added')).toBe(false);
    expect(cl.historyStart).toBe('2026-10-02T09:00:00Z');
  });
});

describe('history edge cases', () => {
  it('skips a snapshot with a broken plugin.json and warns', async () => {
    const root = join(tmp, 'broken');
    const r = createPrototypeRepo(root);
    writeFileIn(root, 'plugins/devdigest/.claude-plugin/plugin.json', '{ broken');
    gitIn(root, '2026-10-16T09:00:00Z', 'add', '-A');
    gitIn(root, '2026-10-16T09:00:00Z', 'commit', '-q', '-m', 'oops');
    const warnings: string[] = [];
    const cl = await buildChangelog({ root, commit: 'x', generatedAt: '2026-10-16T12:00:00Z', currentIds: new Set(), warn: (m) => warnings.push(m) });
    expect(warnings.some((w) => /plugin\.json.*invalid JSON/.test(w))).toBe(true);
    expect(cl.releases).toHaveLength(3);
    expect(r.shas.v3).toBeTruthy();
  });
  it('emits plugin-removed when a plugin leaves marketplace.json', async () => {
    const root = join(tmp, 'removed');
    createPrototypeRepo(root);
    writeFileIn(root, '.claude-plugin/marketplace.json', JSON.stringify({ name: 'm', plugins: [] }));
    gitIn(root, '2026-10-16T09:00:00Z', 'add', '-A');
    gitIn(root, '2026-10-16T09:00:00Z', 'commit', '-q', '-m', 'drop plugin');
    const cl = await buildChangelog({ root, commit: 'x', generatedAt: '2026-10-16T12:00:00Z', currentIds: new Set() });
    expect(cl.releases[0]).toMatchObject({ id: 'devdigest@removed', kind: 'plugin-removed', version: null });
    expect(cl.releases[0].changes.removed.length).toBeGreaterThan(5);
    expect(cl.pending).toEqual([]);
  });
  it('handles a repository where the plugin has no components (the real repository today)', async () => {
    const root = join(tmp, 'empty');
    createPrototypeRepo(root);
    const cl = await buildChangelog({ root, commit: 'x', generatedAt: '2026-10-16T12:00:00Z', currentIds: new Set(), limit: 300 });
    expect(cl.releases.length).toBeGreaterThan(0);
  });
});

describe('CHANGELOG.md sections', () => {
  const md = '# Changelog\n\n## [0.3.0] - 2026-10-14\n\n- a\n\n## 0.2.0\n\n- b\n';
  it('extracts a section by version in both heading styles', () => {
    expect(changelogSection(md, '0.3.0')).toBe('- a');
    expect(changelogSection(md, '0.2.0')).toBe('- b');
    expect(changelogSection(md, '9.9.9')).toBeNull();
  });
});
