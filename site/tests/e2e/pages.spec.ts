import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, pageKinds, watchErrors } from './helpers';

// Every page type, in both builds (spec 14): axe-core in light and dark, no console errors,
// no CSP violations, no horizontal scroll at 360 px.
const KINDS = ['home', 'plugin', 'artifact', 'whats-new', 'stats', 'settings-builder', 'guide', '404'] as const;

for (const kind of KINDS) {
  test.describe(`${kind} page`, () => {
    let path: string | null = null;
    test.beforeEach(async ({ request }) => {
      path = (await pageKinds(request))[kind];
      test.skip(path === null, `this build has no ${kind} page`);
    });

    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${colorScheme}: accessible, no console errors or CSP violations`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        const errors = await watchErrors(page);
        await page.goto(path!);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('html')).toHaveCSS('color-scheme', colorScheme);
        await expectNoAxeViolations(page);
        expect(await errors()).toEqual([]);
      });
    }

    test('360 px: no horizontal scroll', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(path!);
      await page.waitForLoadState('networkidle');
      const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(scroll).toBeLessThanOrEqual(client);
    });
  });
}

test('every page carries a CSP with hashed inline scripts only', async ({ page }) => {
  await page.goto('');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("default-src 'self'");
  expect(csp).toMatch(/script-src 'self'( 'sha256-[A-Za-z0-9+/=]+')+/);
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
});

test('an unknown address gets the 404 page with status 404', async ({ page }) => {
  const res = await page.goto('no/such/page/');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
