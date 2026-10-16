import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../src/data/markdown';

describe('markdown pipeline (spec 12)', () => {
  it('drops raw HTML, scripts and event handlers', async () => {
    const html = await renderMarkdown('hi <script>alert(1)</script> <img src=x onerror=alert(1)>\n\n<div onclick="x()">raw</div>');
    expect(html).not.toMatch(/<script|onerror|onclick|<div/i);
  });
  it('strips javascript: links and marks external ones', async () => {
    const html = await renderMarkdown('[bad](javascript:alert(1)) [ok](https://example.com)');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it('points relative links at GitHub', async () => {
    const html = await renderMarkdown('[file](./docs/a.md)', { linkBase: 'https://github.com/o/r/blob/abc/plugins/p/' });
    expect(html).toContain('https://github.com/o/r/blob/abc/plugins/p/docs/a.md');
  });
  it('shifts headings and drops a leading h1', async () => {
    const html = await renderMarkdown('# Title\n\n## Section\n\ntext', { headingOffset: 1, dropFirstH1: true });
    expect(html).not.toContain('Title');
    expect(html).toContain('<h3 id="md-section">Section</h3>');
  });
  it('highlights fenced code with a known language and leaves plain blocks alone', async () => {
    const hl = await renderMarkdown('```json\n{"a": 1}\n```');
    expect(hl).toContain('class="shiki');
    expect(hl).toContain('--shiki-dark');
    const plain = await renderMarkdown('```\n/plugin install x\n```');
    expect(plain).not.toContain('shiki');
    expect(plain).toContain('<pre><code>');
  });
  it('gives headings prefixed ids and points in-document anchors at them', async () => {
    const html = await renderMarkdown('- [Evals](#evals)\n\n## Evals\n\n## Evals');
    expect(html).toContain('<h2 id="md-evals">Evals</h2>');
    expect(html).toContain('<h2 id="md-evals-1">Evals</h2>');
    expect(html).toContain('href="#md-evals"');
  });
  it('renders GFM tables', async () => {
    expect(await renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |')).toContain('<table>');
  });
});
