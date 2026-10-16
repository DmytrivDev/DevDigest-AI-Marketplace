import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { loadSiteData } from '../data/load';
import { releaseText, releaseTitle } from '../lib/site';
import { url } from '../lib/url';
import { t } from '../i18n/en';

const FEED_SIZE = 50;
const escapeXml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Release RSS (spec 8.5): the last 50 releases, one item per release, linking to its anchor on /whats-new/.
export const GET: APIRoute = async ({ site }) => {
  const { changelog } = await loadSiteData();
  const home = new URL(url(), site);
  const whatsNew = new URL(url('whats-new/'), site).href;
  return rss({
    title: t.feed.title(t.site.name),
    description: t.whatsNew.description,
    site: home.href,
    trailingSlash: true,
    customData: '<language>en</language>',
    items: changelog.releases.slice(0, FEED_SIZE).map((r) => ({
      title: releaseTitle(r),
      // An absolute link is used as is, so the #fragment doesn't get a trailing slash.
      link: `${whatsNew}#${r.id}`,
      description: releaseText(r),
      pubDate: new Date(r.date),
      // Replaces the permalink guid that @astrojs/rss derives from `link`.
      customData: `<guid isPermaLink="false">${escapeXml(r.id)}</guid>`,
    })),
  });
};
