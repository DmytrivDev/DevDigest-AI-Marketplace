import { emptyCounts, type ArtifactType, type Catalog, type Changelog, type Stats } from '../lib/types';

// Stats computed at build time from the catalog and the changelog (spec 9).

export async function fetchGithub(repo: string, token?: string, timeoutMs = 10_000): Promise<Stats['github']> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'devdigest-marketplace-site' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const get = async (path: string) => {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    return res;
  };
  try {
    const repoJson = (await (await get('')).json()) as { stargazers_count: number; forks_count: number; open_issues_count: number };
    const contribRes = await get('/contributors?per_page=1');
    const link = contribRes.headers.get('link') ?? '';
    const last = /[?&]page=(\d+)>; rel="last"/.exec(link);
    const body = (await contribRes.json()) as unknown[];
    return {
      stars: repoJson.stargazers_count,
      forks: repoJson.forks_count,
      openIssues: repoJson.open_issues_count,
      contributors: last ? Number(last[1]) : body.length,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return undefined;
  }
}

export function buildStats(catalog: Catalog, changelog: Changelog, github?: Stats['github']): Stats {
  const plugins = catalog.artifacts.filter((a) => a.type === 'plugin');
  const components = catalog.artifacts.filter((a) => a.type !== 'plugin');
  const byType = emptyCounts();
  components.forEach((a) => byType[a.type]++);
  byType.plugin = plugins.length;

  const tagCount = new Map<string, number>();
  catalog.artifacts.forEach((a) => a.tags.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)));
  const topTags = [...tagCount]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 15);

  const authors = new Set(plugins.map((p) => p.details.author).filter(Boolean));
  const categories = new Set(plugins.map((p) => p.category).filter(Boolean));
  const now = new Date(catalog.generatedAt).getTime();
  const within = (iso: string, days: number) => now - new Date(iso).getTime() <= days * 86_400_000;
  const releases = changelog.releases;

  const updatedIds = new Set<string>();
  for (const r of releases) if (within(r.date, 30)) for (const a of [...r.changes.added, ...r.changes.updated]) updatedIds.add(a.id);

  const validation = { pass: 0, fail: 0, unknown: 0 };
  plugins.forEach((p) => validation[p.validation?.status ?? 'unknown']++);

  const growth = [...releases]
    .reverse()
    .map((r) => ({ date: r.date, byType: { ...r.counts } as Record<ArtifactType, number> }));

  return {
    schemaVersion: 1,
    generatedAt: catalog.generatedAt,
    commit: catalog.commit,
    totals: {
      plugins: plugins.length,
      externalPlugins: plugins.filter((p) => p.external).length,
      artifacts: components.length,
      byType,
      tags: tagCount.size,
      categories: categories.size,
      authors: authors.size,
    },
    freshness: {
      lastReleaseAt: releases[0]?.date ?? null,
      releases30d: releases.filter((r) => within(r.date, 30)).length,
      releases90d: releases.filter((r) => within(r.date, 90)).length,
      artifactsUpdated30d: updatedIds.size,
      unreleasedChanges: changelog.pending.reduce((n, p) => n + p.changes.added.length + p.changes.updated.length + p.changes.removed.length, 0),
    },
    quality: {
      validation,
      withDescription: components.filter((a) => a.description.trim()).length,
      pluginsWithReadme: plugins.filter((p) => p.details.hasReadme).length,
    },
    growth,
    topTags,
    plugins: plugins
      .map((p) => {
        const mine = components.filter((a) => a.plugin === p.plugin);
        const bt: Partial<Record<ArtifactType, number>> = {};
        mine.forEach((a) => (bt[a.type] = (bt[a.type] ?? 0) + 1));
        const latest = releases.find((r) => r.plugin === p.plugin)?.date ?? null;
        return {
          name: p.name,
          category: p.category ?? null,
          version: p.version ?? null,
          components: mine.length,
          byType: bt,
          updatedAt: latest,
          validation: p.validation?.status ?? ('unknown' as const),
        };
      })
      .sort((a, b) => b.components - a.components || a.name.localeCompare(b.name)),
    ...(github ? { github } : {}),
  };
}
