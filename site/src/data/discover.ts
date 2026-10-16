import { BuildError, type ArtifactType } from '../lib/types';
import { asString, asStringList, parseFrontmatter, parseJson } from './frontmatter';

// Component discovery (spec 5.1), shared by the indexer (working tree) and the changelog (git snapshots).

export interface FileSource {
  /** All file paths (repo-relative, posix) starting with `prefix`. */
  list(prefix: string): string[];
  read(path: string): string | null;
  /** Content identity: a git blob SHA or a content hash. */
  id(path: string): string;
}

export type ComponentType = Exclude<ArtifactType, 'plugin'>;

export interface Component {
  type: ComponentType;
  name: string;
  slug: string;
  mainPath: string;
  mainId: string;
  description: string;
  frontmatter: Record<string, unknown>;
  body: string;
  /** Skill: every file in the skill directory. */
  files: string[];
  /** Hook / MCP specifics. */
  hook?: { event: string; matcher: string; commands: string[] };
  mcp?: { command: string; args: string[]; envKeys: string[] };
  warnings: string[];
}

export interface Manifest {
  name?: unknown;
  version?: unknown;
  description?: unknown;
  keywords?: unknown;
  author?: unknown;
  homepage?: unknown;
  repository?: unknown;
  commands?: unknown;
  agents?: unknown;
  skills?: unknown;
  hooks?: unknown;
  mcpServers?: unknown;
}

export const toSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const kebab = (s: string): string =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function hookName(event: string, matcher: string): string {
  const e = kebab(event);
  if (!matcher) return e;
  const m = matcher.trim() === '*' ? 'any' : kebab(matcher);
  return m ? `${e}-${m}` : e;
}

const join = (dir: string, p: string): string | null => {
  const parts = `${dir}/${p}`.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') return null; // never leave the plugin directory
    out.push(part);
  }
  return out.join('/');
};

function paths(field: unknown, dir: string, defaults: string[]): string[] {
  const list = field === undefined ? defaults : asStringList(Array.isArray(field) ? field : [field]);
  return list.map((p) => join(dir, p)).filter((p): p is string => !!p);
}

export function discoverComponents(src: FileSource, pluginDir: string, manifest: Manifest): Component[] {
  const out: Component[] = [];

  // skills: <dir>/<name>/SKILL.md, or a directory that is itself a skill
  const skillDirs = new Map<string, string>(); // dir -> fallback name
  for (const base of paths(manifest.skills, pluginDir, ['skills'])) {
    if (src.read(`${base}/SKILL.md`) != null) skillDirs.set(base, base.split('/').pop()!);
    else
      for (const f of src.list(`${base}/`)) {
        const m = /^(.+?)\/SKILL\.md$/.exec(f.slice(base.length + 1));
        if (m && !m[1].includes('/')) skillDirs.set(`${base}/${m[1]}`, m[1]);
      }
  }
  for (const [dir, fallback] of [...skillDirs].sort()) {
    const main = `${dir}/SKILL.md`;
    out.push(fromMarkdown(src, 'skill', main, fallback, src.list(`${dir}/`)));
  }

  for (const [type, field, def] of [
    ['agent', manifest.agents, ['agents']],
    ['command', manifest.commands, ['commands']],
  ] as const) {
    const files = new Set<string>();
    for (const p of paths(field, pluginDir, def)) {
      if (p.endsWith('.md')) {
        if (src.read(p) != null) files.add(p);
      } else
        for (const f of src.list(`${p}/`)) {
          if (f.endsWith('.md') && !f.slice(p.length + 1).includes('/')) files.add(f);
        }
    }
    for (const f of [...files].sort()) {
      out.push(fromMarkdown(src, type, f, f.split('/').pop()!.replace(/\.md$/, ''), []));
    }
  }

  out.push(...discoverHooks(src, pluginDir, manifest));
  out.push(...discoverMcp(src, pluginDir, manifest));
  return dedupe(out);
}

function fromMarkdown(src: FileSource, type: ComponentType, path: string, fallback: string, files: string[]): Component {
  const text = src.read(path) ?? '';
  const { data, body } = parseFrontmatter(text, path);
  const name = asString(data.name).trim() || fallback;
  const description = asString(data.description).trim();
  const warnings = description ? [] : [`${path}: missing "description" in frontmatter`];
  return {
    type,
    name,
    slug: toSlug(name),
    mainPath: path,
    mainId: src.id(path),
    description,
    frontmatter: data,
    body,
    files,
    warnings,
  };
}

function discoverHooks(src: FileSource, pluginDir: string, manifest: Manifest): Component[] {
  let file: string | null = null;
  let raw: unknown;
  if (manifest.hooks && typeof manifest.hooks === 'object' && !Array.isArray(manifest.hooks)) {
    raw = manifest.hooks;
    file = `${pluginDir}/.claude-plugin/plugin.json`;
  } else {
    const p = typeof manifest.hooks === 'string' ? join(pluginDir, manifest.hooks) : `${pluginDir}/hooks/hooks.json`;
    const text = p ? src.read(p) : null;
    if (!p || text == null) return [];
    file = p;
    raw = parseJson(text, p);
  }
  const root = (raw as { hooks?: unknown })?.hooks ?? raw;
  if (!root || typeof root !== 'object') return [];
  const out: Component[] = [];
  for (const [event, groups] of Object.entries(root as Record<string, unknown>)) {
    if (!Array.isArray(groups)) continue;
    for (const g of groups as { matcher?: unknown; hooks?: unknown }[]) {
      const matcher = asString(g?.matcher).trim();
      const commands = (Array.isArray(g?.hooks) ? (g.hooks as Record<string, unknown>[]) : [])
        .map((h) => [asString(h.command), ...asStringList(h.args)].filter(Boolean).join(' '))
        .filter(Boolean);
      const name = hookName(event, matcher);
      out.push({
        type: 'hook',
        name,
        slug: toSlug(name),
        mainPath: file,
        mainId: src.id(file),
        description: `Runs on ${event}${matcher ? ` for ${matcher}` : ''}${commands[0] ? `: ${commands[0]}` : ''}`,
        frontmatter: {},
        body: '',
        files: [],
        hook: { event, matcher, commands },
        warnings: [],
      });
    }
  }
  return out;
}

function discoverMcp(src: FileSource, pluginDir: string, manifest: Manifest): Component[] {
  let file: string;
  let raw: unknown;
  if (manifest.mcpServers && typeof manifest.mcpServers === 'object' && !Array.isArray(manifest.mcpServers)) {
    raw = manifest.mcpServers;
    file = `${pluginDir}/.claude-plugin/plugin.json`;
  } else {
    const p = typeof manifest.mcpServers === 'string' ? join(pluginDir, manifest.mcpServers) : `${pluginDir}/.mcp.json`;
    const text = p ? src.read(p) : null;
    if (!p || text == null) return [];
    file = p;
    raw = parseJson(text, p);
  }
  const servers = (raw as { mcpServers?: unknown })?.mcpServers ?? raw;
  if (!servers || typeof servers !== 'object') return [];
  const out: Component[] = [];
  for (const [key, def] of Object.entries(servers as Record<string, Record<string, unknown>>)) {
    const d = def && typeof def === 'object' ? def : {};
    out.push({
      type: 'mcp',
      name: key,
      slug: toSlug(key),
      mainPath: file,
      mainId: src.id(file),
      description: `MCP server ${key}${d.command ? `, started with ${asString(d.command)}` : ''}`,
      frontmatter: {},
      body: '',
      files: [],
      mcp: {
        command: asString(d.command),
        args: asStringList(d.args),
        envKeys: d.env && typeof d.env === 'object' ? Object.keys(d.env as object).sort() : [],
      },
      warnings: [],
    });
  }
  return out;
}

/** Hooks get -2, -3 on collisions; other types fail the build (5.1.1). */
function dedupe(list: Component[]): Component[] {
  const seen = new Map<string, number>();
  for (const c of list) {
    const key = `${c.type}:${c.slug}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n === 1) continue;
    if (c.type !== 'hook') throw new BuildError(`${c.mainPath}: duplicate ${c.type} slug "${c.slug}" in one plugin`);
    c.slug = `${c.slug}-${n}`;
    c.name = `${c.name}-${n}`;
  }
  return list;
}
