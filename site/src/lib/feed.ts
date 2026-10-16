import rss from '@astrojs/rss';
import { releaseText, releaseTitle } from './site';
import { url } from './url';
import type { Release } from './types';

export const FEED_SIZE = 50;
const escapeXml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One RSS item per release, linking to its anchor on /whats-new/ (spec 8.5). Used by /feed.xml and each plugin's feed. */
export async function releaseFeed(opts: { site: URL | string; title: string; description: string; releases: Release[] }): Promise<Response> {
  const home = new URL(url(), opts.site);
  const whatsNew = new URL(url('whats-new/'), opts.site).href;
  return rss({
    title: opts.title,
    description: opts.description,
    site: home.href,
    trailingSlash: true,
    customData: '<language>en</language>',
    items: opts.releases.slice(0, FEED_SIZE).map((r) => ({
      title: releaseTitle(r),
      // An absolute link is used as is, so the #fragment doesn't get a trailing slash.
      link: `${whatsNew}#${r.id}`,
      description: releaseText(r),
      pubDate: new Date(r.date),
      // Replaces the permalink guid that @astrojs/rss derives from `link`.
      customData: `<guid isPermaLink="false">${escapeXml(r.id)}</guid>`,
    })),
  });
}
