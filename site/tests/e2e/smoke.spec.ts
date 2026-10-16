import { expect, test } from '@playwright/test';
import { hydrated } from './helpers';

// Smoke scenarios from spec 14, on the fixture build (dist-e2e/): 9 components in the devdigest
// plugin and three releases (Sep 16, Oct 2, Oct 14, 2026).
const cards = '.cards > li';

test.describe('home', () => {
  test('search, copy the command, open the artifact page', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('');
    await hydrated(page);
    await page.getByRole('textbox', { name: 'Search artifacts' }).fill('review pull request');
    const card = page.locator(cards).filter({ has: page.getByRole('link', { name: 'review', exact: true }) });
    await expect(card).toBeVisible();
    await expect(page.locator(cards).first()).toContainText('review');
    await expect(page).toHaveURL(/\?q=review\+pull\+request/);

    const copy = card.locator('.copy__btn');
    const cmd = await copy.getAttribute('data-cmd');
    expect(cmd).toBe('/devdigest:review');
    await copy.click();
    await expect(card.locator('.copy__label')).toHaveText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(cmd);

    await card.getByRole('link', { name: 'review', exact: true }).click();
    await expect(page).toHaveURL(/\/plugins\/devdigest\/skill\/review\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('review');
  });

  test('restores the query and filters from the URL', async ({ page }) => {
    await page.goto('?q=security&type=agent');
    await hydrated(page);
    await expect(page.getByRole('textbox', { name: 'Search artifacts' })).toHaveValue('security');
    await expect(page.getByRole('checkbox', { name: /Agents/ })).toBeChecked();
    await expect(page.locator(cards).first().getByRole('heading')).toHaveText('security-reviewer');
    await expect(page.locator(cards).locator('.card__badges')).toContainText(Array(await page.locator(cards).count()).fill('Agent'));
  });

  test('the onboarding banner shows once and stays closed after "Got it"', async ({ page }) => {
    await page.goto('');
    const banner = page.locator('.onboarding');
    await expect(banner).toBeVisible();
    await banner.getByRole('button', { name: 'Got it' }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(banner).toBeHidden();
  });

  test('catalog.json failing: error banner, static list and type filter still work', async ({ page }) => {
    await page.route('**/api/catalog.json', (r) => r.fulfill({ status: 500, body: 'error' }));
    await page.goto('');
    await hydrated(page);
    await expect(page.getByRole('alert')).toContainText("Couldn't load search");
    // 1 plugin card + 9 components.
    await expect(page.locator(cards)).toHaveCount(10);
    await page.getByRole('checkbox', { name: /Agents/ }).check();
    await expect(page.locator(cards)).toHaveCount(3);
    await expect(page.locator(cards).locator('.card__badges')).toContainText(['Agent', 'Agent', 'Agent']);
    await page.getByRole('checkbox', { name: /Agents/ }).uncheck();
    await page.getByRole('checkbox', { name: /Plugins/ }).check();
    await expect(page.locator(cards)).toHaveCount(1);
    await expect(page.locator(cards).locator('.card__badges')).toContainText(['Plugin']);
  });
});

test('without JavaScript the home page lists every artifact', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('');
  // 1 plugin card + 9 components, the plugin first.
  await expect(page.locator(cards)).toHaveCount(10);
  await expect(page.locator(cards).first().locator('.card__badges')).toContainText('Plugin');
  await expect(page.getByRole('heading', { name: /All 10 artifacts/ })).toBeVisible();
  await context.close();
});

test("What's new counter: appears for newer releases, clears after visiting /whats-new/", async ({ page }) => {
  await page.goto('');
  const badge = page.locator('.nav [data-unseen]');
  // First visit stores the newest release without showing a counter.
  await page.waitForFunction(() => localStorage.getItem('dd:lastSeenRelease') !== null);
  await expect(badge).toBeHidden();

  // Pretend the last visit was before the Oct 2 and Oct 14 releases.
  await page.evaluate(() => localStorage.setItem('dd:lastSeenRelease', '2026-09-20T00:00:00Z'));
  await page.reload();
  await expect(badge).toHaveText('●2');
  await expect(badge).toHaveAttribute('aria-label', '2 unseen releases');

  await page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name: /What's new/ }).click();
  await expect(page).toHaveURL(/\/whats-new\/$/);
  await expect(page.locator('[data-new-for-you]:visible')).toHaveCount(2);

  await page.goto('');
  await page.waitForLoadState('networkidle');
  await expect(badge).toBeHidden();
});

test.describe('feeds and metadata', () => {
  test('RSS lists releases with links to their anchors on /whats-new/', async ({ page, request }) => {
    await page.goto('');
    const href = await page.locator('link[rel="alternate"][type="application/rss+xml"]').getAttribute('href');
    expect(href).toBe('/DevDigest-AI-Marketplace/feed.xml');
    await expect(page.locator('footer').getByRole('link', { name: 'RSS' })).toHaveAttribute('href', href!);

    const res = await request.get('feed.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
    expect(items).toHaveLength(3);
    expect(items[0]).toContain('<title>devdigest 0.3.0</title>');
    expect(items[0]).toContain('<guid isPermaLink="false">devdigest@0.3.0</guid>');
    expect(items[0]).toMatch(/<pubDate>Wed, 14 Oct 2026 10:00:00 GMT<\/pubDate>/);
    const link = /<link>([^<]+)<\/link>/.exec(items[0])![1];
    expect(link).toBe('https://dmytrivdev.github.io/DevDigest-AI-Marketplace/whats-new/#devdigest@0.3.0');

    await page.goto('whats-new/');
    await expect(page.locator('[id="devdigest@0.3.0"]')).toBeVisible();
  });

  test('sitemap and robots.txt', async ({ request }) => {
    const robots = await (await request.get('robots.txt')).text();
    expect(robots).toContain('Sitemap: https://dmytrivdev.github.io/DevDigest-AI-Marketplace/sitemap-index.xml');
    const index = await request.get('sitemap-index.xml');
    expect(index.status()).toBe(200);
    const urls = await (await request.get('sitemap-0.xml')).text();
    expect(urls).toContain('<loc>https://dmytrivdev.github.io/DevDigest-AI-Marketplace/plugins/devdigest/skill/review/</loc>');
    expect(urls).not.toContain('404');
  });

  test('Open Graph image and tags', async ({ page, request }) => {
    await page.goto('plugins/devdigest/skill/review/');
    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(og).toBe('https://dmytrivdev.github.io/DevDigest-AI-Marketplace/og.png');
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://dmytrivdev.github.io/DevDigest-AI-Marketplace/plugins/devdigest/skill/review/');
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    const img = await request.get('og.png');
    expect(img.status()).toBe(200);
    expect(img.headers()['content-type']).toBe('image/png');
  });
});
