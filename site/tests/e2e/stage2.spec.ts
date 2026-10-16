import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, watchErrors } from './helpers';

// Stage 2 on the fixture build: the devdigest plugin has one exec-form hook, one MCP server (npx, one env name),
// agents with Read/Grep/Glob, a command with Write, and no network calls.

test.describe('plugin security panel', () => {
  test('summarises hooks, MCP servers, tools and network use', async ({ page }) => {
    await page.goto('plugins/devdigest/');
    const panel = page.locator('section[aria-labelledby="p-security"]');
    await expect(panel.getByRole('heading', { level: 2, name: 'Security' })).toBeVisible();
    await expect(panel.locator('.sec-summary')).toHaveText(
      'Runs 1 hook · starts 1 MCP server · agents or skills can write files · no network calls found · self-contained',
    );
    await expect(panel.locator('.sec-flag').first()).toHaveText('agents or skills can write files');
    await expect(panel).toContainText('PreToolUse');
    await expect(panel).toContainText('node ${CLAUDE_PLUGIN_ROOT}/scripts/pre-tool-use-bash.js');
    await expect(panel).toContainText('Exec form');
    await expect(panel).toContainText('npx devdigest-mcp');
    await expect(panel.locator('code', { hasText: 'DEVDIGEST_URL' })).toBeVisible();
    await expect(panel).not.toContainText('localhost:7777'); // environment values are never shown
    await expect(panel).toContainText('not a guarantee');
  });

  test('has a per-plugin RSS feed link and the alternate link', async ({ page, request }) => {
    await page.goto('plugins/devdigest/');
    const link = page.getByRole('link', { name: 'RSS for this plugin' });
    await expect(link).toHaveAttribute('href', /\/plugins\/devdigest\/feed\.xml$/);
    await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveCount(2);
    const xml = await (await request.get('plugins/devdigest/feed.xml')).text();
    expect(xml).toContain('<rss');
    expect(xml.match(/<item>/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

test.describe('settings builder', () => {
  test('updates the snippet when a checkbox changes and copies it', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = await watchErrors(page);
    await page.goto('settings-builder/');
    const out = page.getByLabel('settings.json snippet');
    await expect(out).toContainText('"devdigest@devdigest-marketplace": true');
    await expect(out).toContainText('"repo": "DmytrivDev/DevDigest-AI-Marketplace"');

    await page.getByRole('checkbox', { name: 'devdigest' }).uncheck();
    await expect(out).not.toContainText('devdigest@devdigest-marketplace');
    await expect(page.getByText('No plugin is selected')).toBeVisible();

    await page.getByRole('checkbox', { name: 'devdigest' }).check();
    await page.getByRole('button', { name: 'Copy settings.json to the clipboard' }).click();
    const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText())) as {
      extraKnownMarketplaces: Record<string, unknown>;
      enabledPlugins: Record<string, boolean>;
    };
    expect(copied.enabledPlugins).toEqual({ 'devdigest@devdigest-marketplace': true });
    expect(Object.keys(copied.extraKnownMarketplaces)).toEqual(['devdigest-marketplace']);
    expect(await errors()).toEqual([]);
  });

  test('preselects the plugin from the link on its page', async ({ page }) => {
    await page.goto('plugins/devdigest/');
    await page.getByRole('link', { name: /Add to team settings/ }).click();
    await expect(page).toHaveURL(/settings-builder\/\?plugin=devdigest$/);
    await expect(page.getByRole('checkbox', { name: 'devdigest' })).toBeChecked();
  });

  test('works without JavaScript: the snippet lists every plugin', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('settings-builder/');
    await expect(page.locator('[data-sb-out]')).toContainText('devdigest@devdigest-marketplace');
    await expect(page.getByText('The snippet below lists every plugin')).toBeVisible();
    await ctx.close();
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${colorScheme}: accessible with a plugin unchecked`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('settings-builder/');
      await page.getByRole('checkbox', { name: 'devdigest' }).uncheck();
      await expectNoAxeViolations(page);
    });
  }
});
