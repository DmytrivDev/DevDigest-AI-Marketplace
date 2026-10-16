import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import GithubSlugger from 'github-slugger';
import { createHighlighter, type Highlighter } from 'shiki';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import type { Element, Root } from 'hast';
import { t } from '../i18n/en';

// Markdown -> sanitized HTML (spec 3, 12). Raw HTML in markdown is dropped by remark-rehype
// (no allowDangerousHtml), then everything goes through rehype-sanitize (GitHub's schema),
// and only after that Shiki adds its token spans.

const LANGS = ['bash', 'sh', 'shell', 'json', 'jsonc', 'yaml', 'typescript', 'ts', 'javascript', 'js', 'markdown', 'md', 'diff', 'toml', 'python', 'tsx', 'jsx', 'html', 'css'];
let highlighter: Promise<Highlighter> | null = null;
const getHighlighter = (): Promise<Highlighter> =>
  (highlighter ??= createHighlighter({ themes: ['github-light', 'github-dark'], langs: LANGS }));

export interface RenderOptions {
  /** Added to every heading level (README headings sit under an h2). */
  headingOffset?: number;
  /** Drop a leading h1 (the page already has one). */
  dropFirstH1?: boolean;
  /** Where relative links point: https://github.com/<repo>/blob/<ref>/<dir>/ */
  linkBase?: string;
}

/** Prefix for heading ids, so markdown headings never collide with the page's own ids. */
export const HEADING_ID_PREFIX = 'md-';

const textOf = (node: Element | Root): string =>
  node.children.map((c) => (c.type === 'text' ? c.value : c.type === 'element' ? textOf(c) : '')).join('');

/** GitHub-style heading ids (`## Evals` -> `md-evals`), added after sanitizing. */
function headingIds() {
  return (tree: Root) => {
    const slugger = new GithubSlugger();
    visit(tree, 'element', (node: Element) => {
      if (!/^h[1-6]$/.test(node.tagName)) return;
      node.properties = { ...node.properties, id: HEADING_ID_PREFIX + slugger.slug(textOf(node)) };
    });
  };
}

function rewriteLinks(linkBase?: string) {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return;
      const href = String(node.properties?.href ?? '');
      // In-document anchors follow the prefixed heading ids; footnote links are already prefixed.
      if (href.startsWith('#') && href.length > 1 && !href.startsWith('#user-content-')) {
        node.properties = { ...node.properties, href: `#${HEADING_ID_PREFIX}${decodeURIComponent(href.slice(1)).toLowerCase()}` };
        return;
      }
      if (/^(https?:|mailto:)/i.test(href)) {
        node.properties = { ...node.properties, rel: ['noopener', 'noreferrer'], target: '_blank' };
      } else if (href && !href.startsWith('#')) {
        if (linkBase) node.properties = { ...node.properties, href: new URL(href, linkBase).href, rel: ['noopener', 'noreferrer'], target: '_blank' };
        else delete node.properties!.href;
      }
    });
  };
}

/** Wide tables scroll inside a focusable region, so keyboard users can scroll them too (axe: scrollable-region-focusable). */
function scrollableTables() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'table' || !parent || typeof index !== 'number') return;
      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['md-scroll'], role: 'region', tabIndex: 0, ariaLabel: t.markdown.scrollTable },
        children: [node],
      };
      return index + 1;
    });
  };
}

function shiftHeadings(offset: number, dropFirstH1: boolean) {
  return (tree: Root) => {
    let first = true;
    const drop = new Set<Element>();
    visit(tree, 'element', (node: Element) => {
      const m = /^h([1-6])$/.exec(node.tagName);
      if (!m) return;
      if (first && dropFirstH1 && m[1] === '1') drop.add(node);
      first = false;
      node.tagName = `h${Math.min(6, Math.max(2, Number(m[1]) + offset))}`;
    });
    if (drop.size) {
      visit(tree, 'element', (node: Element, index, parent) => {
        if (drop.has(node) && parent && typeof index === 'number') {
          parent.children.splice(index, 1);
          return index;
        }
        return undefined;
      });
    }
  };
}

function highlight() {
  return async (tree: Root) => {
    const hl = await getHighlighter();
    const loaded = new Set(hl.getLoadedLanguages());
    const jobs: (() => void)[] = [];
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'pre' || !parent || typeof index !== 'number') return;
      const code = node.children[0];
      if (!code || code.type !== 'element' || code.tagName !== 'code') return;
      const cls = (code.properties?.className as string[] | undefined) ?? [];
      const lang = cls.find((c) => c.startsWith('language-'))?.slice(9);
      if (!lang || !loaded.has(lang)) return;
      const text = code.children.map((c) => (c.type === 'text' ? c.value : '')).join('');
      jobs.push(() => {
        const hast = hl.codeToHast(text.replace(/\n$/, ''), {
          lang,
          themes: { light: 'github-light', dark: 'github-dark' },
          defaultColor: false,
        });
        const pre = hast.children[0] as Element;
        pre.properties = { ...pre.properties, tabindex: undefined };
        parent.children[index] = pre;
      });
    });
    jobs.forEach((j) => j());
  };
}

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel'],
  },
};

export async function renderMarkdown(md: string, opts: RenderOptions = {}): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize, schema)
    .use(() => shiftHeadings(opts.headingOffset ?? 0, opts.dropFirstH1 ?? false))
    .use(headingIds)
    .use(scrollableTables)
    .use(() => rewriteLinks(opts.linkBase))
    .use(highlight)
    .use(rehypeStringify)
    .process(md);
  return String(file);
}
