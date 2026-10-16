import type { APIRoute } from 'astro';
import { loadSiteData } from '../data/load';
import { releaseFeed } from '../lib/feed';
import { t } from '../i18n/en';

// Release RSS (spec 8.5): the last 50 releases, one item per release, linking to its anchor on /whats-new/.
export const GET: APIRoute = async ({ site }) => {
  const { changelog } = await loadSiteData();
  return releaseFeed({ site: site!, title: t.feed.title(t.site.name), description: t.whatsNew.description, releases: changelog.releases });
};
