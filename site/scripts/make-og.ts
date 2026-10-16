// Renders scripts/og/og.html into public/og.png (1200x630), the Open Graph image (spec 7.9).
// Usage: npm run og:update   (uses the installed Chrome or Edge, see tests/e2e/channel.ts)
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { browserChannel } from '../tests/e2e/channel';

const src = resolve(process.cwd(), 'scripts/og/og.html');
const out = resolve(process.cwd(), 'public/og.png');
const browser = await chromium.launch({ channel: browserChannel() });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(src).href);
await page.screenshot({ path: out, type: 'png' });
await browser.close();
console.log(`og: wrote ${out}`);
