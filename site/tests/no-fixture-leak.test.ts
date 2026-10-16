import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The site renders real repository data only: nothing under src/ may import test fixtures or helpers.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('fixtures are test-only', () => {
  it('no source file references tests/ or the prototype fixture', () => {
    const src = resolve(__dirname, '../src');
    for (const f of files(src).filter((p) => /\.(ts|tsx|astro|mjs|js|json)$/.test(p))) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toMatch(/tests\/(fixtures|helpers)|fixtures\/prototype|DD_DATA/);
    }
  });
});
