import AxeBuilder from '@axe-core/playwright';
import { expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Collects console errors, uncaught exceptions and CSP violations from the moment the page is
 * created. Init scripts run outside the page's CSP, so the listener sees every violation.
 */
export async function watchErrors(page: Page): Promise<() => Promise<string[]>> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__csp.push(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'} (${e.sourceFile}:${e.lineNumber})`);
    });
  });
  return async () => {
    const csp = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []).catch(() => []);
    return [...errors, ...csp.map((c) => `csp: ${c}`)];
  };
}

/** axe-core with the WCAG 2.2 A/AA rules (spec 7.8). */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const report = res.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join('\n    ')}`);
  expect(report, 'axe violations').toEqual([]);
}

/** Waits until the React island on the home page has hydrated. */
export async function hydrated(page: Page): Promise<void> {
  await page.waitForSelector('astro-island:not([ssr])', { state: 'attached' });
}

interface CatalogArtifact {
  id: string;
  type: string;
  plugin: string;
  slug: string;
  name: string;
}

/** Paths (relative to the base URL) of one page of each kind that exists in this build. */
export async function pageKinds(request: APIRequestContext): Promise<Record<string, string | null>> {
  const catalog = (await (await request.get('api/catalog.json')).json()) as { artifacts: CatalogArtifact[] };
  const plugin = catalog.artifacts.find((a) => a.type === 'plugin');
  const artifact = catalog.artifacts.find((a) => a.type !== 'plugin');
  return {
    home: '',
    plugin: plugin ? `plugins/${plugin.plugin}/` : null,
    artifact: artifact ? `plugins/${artifact.plugin}/${artifact.type}/${artifact.slug}/` : null,
    'whats-new': 'whats-new/',
    stats: 'stats/',
    'settings-builder': 'settings-builder/',
    guide: 'guide/',
    '404': '404.html',
  };
}
