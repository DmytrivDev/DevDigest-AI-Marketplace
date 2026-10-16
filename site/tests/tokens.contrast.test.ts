import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Every text-on-background pair of spec 7.6 must reach 4.5:1 in both themes.
const css = readFileSync(resolve(__dirname, '../src/styles/tokens.css'), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const out: Record<string, string> = {};
  for (const m of css.slice(open, close).matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2];
  return out;
}
const light = block(':root {');
const dark = block(':root[data-theme="dark"]');

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const lum = ([r, g, b]: [number, number, number]) => {
  const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: [number, number, number], b: [number, number, number]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const mix = (fg: string, bg: string, pct: number): [number, number, number] =>
  rgb(fg).map((c, i) => Math.round(c * pct + rgb(bg)[i] * (1 - pct))) as [number, number, number];

describe.each([
  ['light', light],
  ['dark', dark],
])('%s theme contrast', (_name, t) => {
  it('parsed all tokens', () => {
    expect(Object.keys(t).length).toBeGreaterThanOrEqual(17);
  });
  const text = ['text', 'text-muted', 'accent', 'success', 'warning', 'danger', 't-plugin', 't-skill', 't-agent', 't-command', 't-hook', 't-mcp'];
  for (const bg of ['bg', 'surface']) {
    for (const fg of text) {
      it(`${fg} on ${bg} >= 4.5`, () => {
        expect(ratio(rgb(t[fg]), rgb(t[bg]))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  for (const fg of ['t-plugin', 't-skill', 't-agent', 't-command', 't-hook', 't-mcp', 'success', 'warning', 'danger']) {
    for (const bg of ['bg', 'surface']) {
      it(`${fg} badge (12% tint) on ${bg} >= 4.5`, () => {
        expect(ratio(rgb(t[fg]), mix(t[fg], t[bg], 0.12))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it('text stays readable on the highlight', () => {
    expect(ratio(rgb(t.text), rgb(t.highlight))).toBeGreaterThanOrEqual(4.5);
  });
  it('button text on accent >= 4.5', () => {
    expect(ratio(rgb(t.bg), rgb(t.accent))).toBeGreaterThanOrEqual(4.5);
  });
});
