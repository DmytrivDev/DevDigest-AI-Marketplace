import { parse, YAMLParseError } from 'yaml';
import { BuildError } from '../lib/types';

export interface Parsed {
  data: Record<string, unknown>;
  body: string;
}

/** Splits `---` frontmatter from the markdown body. Invalid YAML throws a BuildError with file and line. */
export function parseFrontmatter(text: string, file: string): Parsed {
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(src);
  if (!m) return { data: {}, body: src };
  let data: unknown;
  try {
    data = parse(m[1]);
  } catch (err) {
    if (err instanceof YAMLParseError) {
      const line = (err.linePos?.[0].line ?? 1) + 1; // +1 for the opening ---
      throw new BuildError(`${file}:${line}: invalid YAML frontmatter: ${err.message.split('\n')[0]}`);
    }
    throw err;
  }
  if (data == null) return { data: {}, body: src.slice(m[0].length) };
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new BuildError(`${file}:1: frontmatter must be a YAML mapping`);
  }
  return { data: data as Record<string, unknown>, body: src.slice(m[0].length) };
}

export function parseJson(text: string, file: string): unknown {
  try {
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch (err) {
    const msg = (err as Error).message;
    const pos = /position (\d+)/.exec(msg);
    let where = '';
    if (pos) {
      const before = text.slice(0, Number(pos[1]));
      const line = before.split('\n').length;
      where = `:${line}`;
    }
    throw new BuildError(`${file}${where}: invalid JSON: ${msg}`);
  }
}

export const asString = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

export function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(asString).map((s) => s.trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

/** Plain-text version of markdown for the search index. */
export function stripMarkdown(md: string, max = 4000): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^[#>\-*+\s]+/gm, '')
    .replace(/[*_~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
