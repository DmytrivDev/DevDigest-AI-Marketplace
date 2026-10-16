import { describe, expect, it } from 'vitest';
import { buildSettings, settingsText } from '../src/lib/settings-snippet';
import { releaseFeed } from '../src/lib/feed';
import { emptyCounts, type Release } from '../src/lib/types';

describe('settings.json snippet', () => {
  it('registers the marketplace by GitHub repo and enables plugins as <plugin>@<marketplace>', () => {
    expect(buildSettings('devdigest-marketplace', 'DmytrivDev/DevDigest-AI-Marketplace', ['a', 'b'])).toEqual({
      extraKnownMarketplaces: { 'devdigest-marketplace': { source: { source: 'github', repo: 'DmytrivDev/DevDigest-AI-Marketplace' } } },
      enabledPlugins: { 'a@devdigest-marketplace': true, 'b@devdigest-marketplace': true },
    });
  });

  it('keeps the marketplace entry when no plugin is picked', () => {
    const s = JSON.parse(settingsText('m', 'o/r', [])) as ReturnType<typeof buildSettings>;
    expect(s.enabledPlugins).toEqual({});
    expect(Object.keys(s.extraKnownMarketplaces)).toEqual(['m']);
  });

  it('prints key order and two-space indent', () => {
    const text = settingsText('m', 'o/r', ['a']);
    expect(text.indexOf('extraKnownMarketplaces')).toBeLessThan(text.indexOf('enabledPlugins'));
    expect(text).toContain('\n  "enabledPlugins": {\n    "a@m": true\n  }');
  });
});

const release = (over: Partial<Release>): Release => ({
  id: 'p@1.0.0',
  kind: 'release',
  plugin: 'p',
  version: '1.0.0',
  previousVersion: null,
  date: '2026-10-14T10:00:00Z',
  commit: 'a1b2c3d4e5f6',
  changes: { added: [], updated: [], removed: [] },
  notes: null,
  counts: emptyCounts(),
  ...over,
});

describe('release feed', () => {
  it('builds a per-plugin feed with one item per release and an anchor link', async () => {
    const res = await releaseFeed({
      site: 'https://example.github.io/DevDigest-AI-Marketplace/',
      title: 'p releases',
      description: 'desc',
      releases: [release({}), release({ id: 'p@0.9.0', version: '0.9.0', date: '2026-10-01T10:00:00Z' })],
    });
    const xml = await res.text();
    expect(xml).toContain('<title>p releases</title>');
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml).toContain('whats-new/#p@1.0.0');
    expect(xml).toContain('<guid isPermaLink="false">p@0.9.0</guid>');
  });
});
