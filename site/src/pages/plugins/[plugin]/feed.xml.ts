import type { APIRoute } from 'astro';
import { loadSiteData } from '../../../data/load';
import { releaseFeed } from '../../../lib/feed';
import { t } from '../../../i18n/en';

// RSS for one plugin's releases (stage 2). Local plugins only: external ones have no history here.
export async function getStaticPaths() {
  const { catalog } = await loadSiteData();
  return catalog.artifacts.filter((a) => a.type === 'plugin' && !a.external).map((a) => ({ params: { plugin: a.plugin } }));
}

export const GET: APIRoute = async ({ site, params }) => {
  const { changelog } = await loadSiteData();
  const name = params.plugin!;
  return releaseFeed({
    site: site!,
    title: t.feed.pluginTitle(name, t.site.name),
    description: t.feed.pluginDescription(name),
    releases: changelog.releases.filter((r) => r.plugin === name),
  });
};
