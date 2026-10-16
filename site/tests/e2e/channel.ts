import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Which browser Playwright drives. Locally: the installed Chrome or Edge (no browser download).
// In CI, or with PW_CHANNEL=chromium: Playwright's own Chromium (`npx playwright install chromium`).
// PW_CHANNEL=chrome|msedge forces a channel.
export function browserChannel(): string | undefined {
  const forced = process.env.PW_CHANNEL;
  if (forced) return forced === 'chromium' ? undefined : forced;
  if (process.env.CI) return undefined;
  const env = process.env;
  const candidates: [string, string][] = [];
  if (process.platform === 'win32') {
    for (const root of [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter((x): x is string => !!x)) {
      candidates.push(['chrome', join(root, 'Google/Chrome/Application/chrome.exe')]);
      candidates.push(['msedge', join(root, 'Microsoft/Edge/Application/msedge.exe')]);
    }
  } else if (process.platform === 'darwin') {
    candidates.push(['chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']);
    candidates.push(['msedge', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']);
  } else {
    candidates.push(['chrome', '/opt/google/chrome/chrome'], ['msedge', '/opt/microsoft/msedge/msedge']);
  }
  return candidates.find(([, p]) => existsSync(p))?.[0];
}
