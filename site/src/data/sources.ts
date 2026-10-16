import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { FileSource } from './discover';

export function git(cwd: string, args: string[], opts: { allowFail?: boolean } = {}): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    if (opts.allowFail) return '';
    throw err;
  }
}

const SKIP = new Set(['node_modules', '.git']);

function walk(root: string, rel: string, out: string[]): void {
  const abs = join(root, rel);
  if (!existsSync(abs)) return;
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const r = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(root, r, out);
    else if (entry.isFile()) out.push(r);
  }
}

/** The working tree under `root` (only `plugins/` and `.claude-plugin/`). */
export function fsSource(root: string): FileSource & { size(path: string): number } {
  const all: string[] = [];
  walk(root, 'plugins', all);
  walk(root, '.claude-plugin', all);
  all.sort();
  const cache = new Map<string, string | null>();
  const read = (p: string): string | null => {
    if (!cache.has(p)) {
      const abs = join(root, p);
      cache.set(p, existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : null);
    }
    return cache.get(p)!;
  };
  return {
    list: (prefix) => all.filter((f) => f.startsWith(prefix)),
    read,
    id: (p) => createHash('sha1').update(read(p) ?? '').digest('hex'),
    size: (p) => {
      const abs = join(root, p);
      return existsSync(abs) ? statSync(abs).size : 0;
    },
  };
}

/** A snapshot of a git commit, read without a checkout (spec 8.2). */
export function gitSource(root: string, sha: string, blobCache: Map<string, string>): FileSource {
  const tree = new Map<string, string>(); // path -> blob sha
  const out = git(root, ['ls-tree', '-r', '-z', sha, '--', 'plugins', '.claude-plugin']);
  for (const rec of out.split('\0')) {
    if (!rec) continue;
    const m = /^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(rec);
    if (m) tree.set(m[2], m[1]);
  }
  const paths = [...tree.keys()].sort();
  return {
    list: (prefix) => paths.filter((f) => f.startsWith(prefix)),
    read: (p) => {
      const blob = tree.get(p);
      if (!blob) return null;
      let text = blobCache.get(blob);
      if (text === undefined) {
        text = git(root, ['cat-file', 'blob', blob]);
        blobCache.set(blob, text);
      }
      return text;
    },
    id: (p) => tree.get(p) ?? '',
  };
}
