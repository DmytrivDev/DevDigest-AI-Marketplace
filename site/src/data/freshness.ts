import type { Catalog, Changelog, Freshness } from '../lib/types';

export const FRESH_DAYS = 14;

/** "New"/"Updated" badges from the latest release that touched an artifact (spec 8.3). `new` wins. */
export function applyFreshness(catalog: Catalog, changelog: Changelog): Catalog {
  const now = new Date(catalog.generatedAt).getTime();
  const windowMs = FRESH_DAYS * 86_400_000;
  const fresh = new Map<string, Freshness>();
  for (const r of changelog.releases) {
    if (now - new Date(r.date).getTime() > windowMs) continue;
    for (const a of r.changes.added) fresh.set(a.id, 'new');
    for (const a of r.changes.updated) if (!fresh.has(a.id)) fresh.set(a.id, 'updated');
  }
  return {
    ...catalog,
    artifacts: catalog.artifacts.map((a) => {
      const f = a.type === 'plugin' ? undefined : fresh.get(a.id);
      const { freshness: _drop, ...rest } = a;
      return f ? { ...rest, freshness: f } : rest;
    }),
  };
}
