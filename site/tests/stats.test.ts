import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildStats, fetchGithub } from '../src/data/build-stats';
import { buildChart } from '../src/lib/chart';
import { protoCatalog, protoChangelog, protoStats } from './helpers/fixtures';

describe('stats (9.2) on the prototype fixture', () => {
  const stats = buildStats(protoCatalog(), protoChangelog());

  it('computes totals', () => {
    expect(stats.totals).toMatchObject({ plugins: 1, externalPlugins: 0, artifacts: 9, tags: 14, categories: 1, authors: 1 });
    expect(stats.totals.byType).toMatchObject({ skill: 3, agent: 3, command: 1, hook: 1, mcp: 1 });
  });
  it('computes freshness and quality', () => {
    expect(stats.freshness).toMatchObject({ lastReleaseAt: '2026-10-14T10:00:00Z', releases30d: 2, releases90d: 3, unreleasedChanges: 1 });
    expect(stats.quality).toMatchObject({ withDescription: 9, pluginsWithReadme: 1, validation: { pass: 1, fail: 0, unknown: 0 } });
  });
  it('has one growth point per release, oldest first', () => {
    expect(stats.growth.map((g) => g.byType.skill)).toEqual([0, 1, 3]);
    expect(stats.growth.map((g) => g.byType.agent)).toEqual([1, 3, 3]);
  });
  it('lists top tags with counts, capped at 15', () => {
    expect(stats.topTags.length).toBeLessThanOrEqual(15);
    expect(stats.topTags[0]).toEqual({ tag: 'review', count: 4 });
  });
  it('matches the checked-in fixture', () => {
    const { github, ...rest } = protoStats();
    expect({ ...stats, github: undefined }).toEqual({ ...rest, github: undefined });
    expect(github?.stars).toBe(12);
  });
  it('omits the github block when no data is given', () => {
    expect('github' in stats).toBe(false);
  });
});

describe('github block', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('is left out when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await fetchGithub('o/r')).toBeUndefined();
  });
  it('is left out on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })));
    expect(await fetchGithub('o/r')).toBeUndefined();
  });
  it('reads counts, taking contributors from the Link header', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ stargazers_count: 5, forks_count: 1, open_issues_count: 2 })))
      .mockResolvedValueOnce(new Response('[{}]', { headers: { link: '<https://api.github.com/x?per_page=1&page=7>; rel="last"' } }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchGithub('o/r')).toMatchObject({ stars: 5, forks: 1, openIssues: 2, contributors: 7 });
  });
});

describe('growth chart (9.4)', () => {
  it('is not drawn with fewer than two points', () => {
    const g = protoStats().growth;
    expect(buildChart(g.slice(0, 1), '2026-10-16T12:00:00Z', false)).toBeNull();
    expect(buildChart([], '2026-10-16T12:00:00Z', false)).toBeNull();
  });
  it('draws one stepped line per type with finite coordinates', () => {
    const c = buildChart(protoStats().growth, '2026-10-16T12:00:00Z', false)!;
    expect(c.lines).toHaveLength(5);
    expect(c.lines.every((l) => /^[\d.,\s-]+$/.test(l.points) && Number.isFinite(l.ly))).toBe(true);
    expect(c.aria).toContain('skills 0, 1, 3');
    expect(c.caption).toBe('Artifacts of each type after every release. Total: 4 on Sep 16, 8 on Oct 2, 9 on Oct 14.');
  });
});
