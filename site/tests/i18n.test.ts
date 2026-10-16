import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { t } from '../src/i18n/en';

// Guard: UI text lives in src/i18n/en.ts, never in components, pages or scripts.
//  1. Text nodes and aria-label/title/placeholder/alt values in .astro and .tsx templates must have no letters
//     (everything comes from `{t.…}` expressions).
//  2. String literals in code (page frontmatter, .tsx, client scripts, lib helpers) must not read like prose.
//  3. Every `t.a.b` path used in a source file exists in the dictionary (tsc does not check .astro files).

const SRC = join(__dirname, '..', 'src');

/** Non-language glyphs that may stay in markup (they contain no letters anyway; listed on purpose). */
const GLYPHS = ['×', '→', '/', '▾', '▴', '·', '●', '—', '−', '+', '~'];

/** Files whose strings are commands, storage keys, identifiers or machine formats, not UI text. */
const NOT_UI = new Set(['lib/commands.ts', 'lib/url.ts', 'lib/storage.ts', 'lib/types.ts', 'pages/robots.txt.ts']);
const SKIP_DIRS = new Set(['i18n', 'search', 'data', 'styles']);
const SKIP_PREFIXES = ['pages/api/'];

const ATTRS = new Set(['aria-label', 'title', 'placeholder', 'alt', 'aria-description', 'aria-roledescription']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out);
    } else out.push(full);
  }
  return out;
}

const rel = (f: string): string => relative(SRC, f).split(sep).join('/');
const files = walk(SRC).filter((f) => {
  const r = rel(f);
  return /\.(astro|tsx|ts)$/.test(r) && !r.endsWith('.d.ts') && !NOT_UI.has(r) && !SKIP_PREFIXES.some((p) => r.startsWith(p));
});

const hasLetter = (s: string): boolean => {
  let x = s.replace(/&#?\w+;/g, '');
  for (const g of GLYPHS) x = x.split(g).join('');
  return /\p{L}/u.test(x);
};

/** Text that reads like a sentence or a label: two or more plain words, or one Capitalised word. */
function isProse(s: string): boolean {
  const text = s.trim();
  if (/^[A-Z][a-z]{2,}$/.test(text)) return true;
  if (/(^|\s)[A-Z][a-z]{2,}:(\s|$)/.test(text)) return true; // "Copied: ${x}", "Type: ${x}"
  const words = text.split(/\s+/).filter((w) => /^[\p{L}][\p{L}'’.,:;!?()—]*$/u.test(w));
  return words.length >= 2;
}

interface Template {
  frontmatter: string;
  jsx: string | null;
}

function splitAstro(src: string): Template {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  const frontmatter = m ? m[1] : '';
  const body = m ? src.slice(m[0].length) : src;
  const template = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
  return { frontmatter, jsx: template };
}

function parse(code: string, name: string, tsx: boolean): ts.SourceFile {
  const sf = ts.createSourceFile(name, code, ts.ScriptTarget.Latest, true, tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const diags = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics;
  if (diags.length) {
    const d = diags[0];
    const { line } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
    throw new Error(`${name}:${line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
  }
  return sf;
}

/** Literal pieces an expression can produce directly (through ?:, &&, ||, ??, parentheses and templates). */
function literalPieces(e: ts.Expression): string[] {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
  if (ts.isTemplateExpression(e)) return [e.head.text, ...e.templateSpans.map((s) => s.literal.text)];
  if (ts.isParenthesizedExpression(e)) return literalPieces(e.expression);
  if (ts.isConditionalExpression(e)) return [...literalPieces(e.whenTrue), ...literalPieces(e.whenFalse)];
  if (ts.isBinaryExpression(e)) {
    const k = e.operatorToken.kind;
    if (k === ts.SyntaxKind.AmpersandAmpersandToken || k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken) {
      return [...literalPieces(e.left), ...literalPieces(e.right)];
    }
  }
  return [];
}

/** Rule 1: JSX text and text-bearing attributes. Returns "file:line  text" findings. */
function findJsxText(sf: ts.SourceFile, name: string): string[] {
  const found: string[] = [];
  const at = (n: ts.Node, text: string) =>
    found.push(`${name}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}  ${JSON.stringify(text.trim().slice(0, 60))}`);
  const visit = (n: ts.Node): void => {
    if (ts.isJsxText(n) && hasLetter(n.text)) at(n, n.text);
    if (ts.isJsxAttribute(n) && ATTRS.has(n.name.getText()) && n.initializer) {
      const init = n.initializer;
      const pieces = ts.isStringLiteral(init) ? [init.text] : ts.isJsxExpression(init) && init.expression ? literalPieces(init.expression) : [];
      if (pieces.some(hasLetter)) at(n, `${n.name.getText()}=${pieces.join('|')}`);
    }
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) {
      const pieces = literalPieces(n.expression);
      if (pieces.some(hasLetter)) at(n, pieces.join('|'));
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

/** Rule 2: prose-like string literals in code. */
function findCodeStrings(sf: ts.SourceFile, name: string): string[] {
  const found: string[] = [];
  const skip = (n: ts.Node): boolean => {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isJsxAttribute(p)) return true;
      if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
        const callee = p.expression.getText();
        if (/^(console\.\w+|Error|TypeError|RangeError|Intl\.\w+|document\.\w+|[\w.]+\.(querySelector\w*|getElementById|addEventListener|closest|setAttribute|getAttribute|removeAttribute|matches|includes|startsWith|endsWith|replace|split|test|has|get|set|delete|append|toLocaleString))$/.test(callee)) return true;
      }
      if (ts.isCaseClause(p)) return true;
    }
    const parent = n.parent;
    if (ts.isBinaryExpression(parent) && /^[!=]==?$/.test(parent.operatorToken.getText())) return true;
    if (ts.isPropertyAssignment(parent) && parent.name === n) return true;
    if (ts.isElementAccessExpression(parent)) return true;
    return false;
  };
  const check = (n: ts.Node, text: string): void => {
    if (isProse(text) && !skip(n)) {
      found.push(`${name}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}  ${JSON.stringify(text.slice(0, 60))}`);
    }
  };
  const visit = (n: ts.Node): void => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) check(n, n.text);
    else if (ts.isTemplateExpression(n)) {
      // The fixed words of a template, with placeholders blanked, e.g. "Type: ${x}" -> "Type: ".
      check(n, [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(' '));
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

function scan(file: string): string[] {
  const r = rel(file);
  const src = readFileSync(file, 'utf8');
  if (r.endsWith('.astro')) {
    const { frontmatter, jsx } = splitAstro(src);
    const out: string[] = [];
    if (frontmatter) out.push(...findCodeStrings(parse(frontmatter, r + '#frontmatter', false), r + '#frontmatter'));
    if (jsx !== null) {
      const sf = parse(`const __page = (<>${jsx}</>);`, r + '#template', true);
      out.push(...findJsxText(sf, r + '#template'));
    }
    return out;
  }
  const sf = parse(src, r, r.endsWith('.tsx'));
  return [...findCodeStrings(sf, r), ...(r.endsWith('.tsx') ? findJsxText(sf, r) : [])];
}

describe('i18n: no hardcoded UI text', () => {
  it('scans a sensible set of files', () => {
    const names = files.map(rel);
    for (const f of ['layouts/Base.astro', 'pages/index.astro', 'components/home/HomeCatalog.tsx', 'client/site.ts', 'lib/icons.ts']) {
      expect(names).toContain(f);
    }
    expect(names).not.toContain('i18n/en.ts');
  });

  it('has no hardcoded text in markup, attributes or code', () => {
    const findings = files.flatMap(scan);
    expect(findings, `Move these into src/i18n/en.ts and read them as t.…:\n${findings.join('\n')}`).toEqual([]);
  });

  it('detects hardcoded text (self-test of the heuristic)', () => {
    const bad = parse('const x = (<><p>Hello</p><input aria-label="Search" placeholder={`Find ${a}`} /><b>{ok ? "Yes" : t.a}</b></>);', 'x.tsx', true);
    expect(findJsxText(bad, 'x')).toHaveLength(4);
    const good = parse('const x = (<><p>{t.a}</p><span aria-hidden="true">×</span><i>→ /</i></>);', 'y.tsx', true);
    expect(findJsxText(good, 'y')).toEqual([]);
    expect(findCodeStrings(parse("const l = `Copied: ${x}`; const k = 'new'; const m = 'Plugin';", 'z.ts', false), 'z')).toHaveLength(2);
  });
});

describe('i18n: dictionary paths', () => {
  const resolve = (path: string): boolean => {
    let cur: unknown = t;
    for (const key of path.split('.')) {
      if (cur === null || (typeof cur !== 'object' && typeof cur !== 'function') || !(key in (cur as object))) return false;
      cur = (cur as Record<string, unknown>)[key];
    }
    return true;
  };

  it('every t.… path used in the sources exists in en.ts', () => {
    const missing: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      // `const g = t.guide;` style aliases
      const aliases = new Map<string, string>();
      for (const m of src.matchAll(/\bconst (\w+) = t\.([A-Za-z_][\w.]*)\s*;/g)) aliases.set(m[1], m[2].replace(/\.$/, ''));
      for (const m of src.matchAll(/(?<![\w.$])t\.([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)/g)) {
        if (!resolve(m[1])) missing.push(`${rel(file)}: t.${m[1]}`);
      }
      for (const [alias, base] of aliases) {
        for (const m of src.matchAll(new RegExp(`(?<![\\w.$])${alias}\\.([A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*)*)`, 'g'))) {
          if (!resolve(`${base}.${m[1]}`)) missing.push(`${rel(file)}: ${alias}.${m[1]} (t.${base}.${m[1]})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
