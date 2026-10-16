import { BuildError, type Artifact, type ArtifactDetails, type Catalog, type ValidationStatus } from '../lib/types';
import { discoverComponents, toSlug, type FileSource, type Manifest } from './discover';
import { asString, asStringList, parseJson, stripMarkdown } from './frontmatter';
import { fsSource, git } from './sources';

// Indexer (spec 5): .claude-plugin/ + plugins/** -> catalog.json (without markdown bodies).

export interface PluginValidation {
  status: ValidationStatus;
  messages: string[];
}

export interface CatalogOptions {
  root: string;
  commit: string;
  generatedAt: string;
  repo: string;
  /** Result of `claude plugin validate` per plugin name. Missing -> `unknown`. */
  validation?: Record<string, PluginValidation>;
  /** Injected in tests; defaults to `git log -1 --format=%cI -- <path>`. */
  updatedAt?: (path: string) => string | null;
  source?: FileSource & { size?: (p: string) => number };
}

export interface CatalogResult {
  catalog: Catalog;
  /** Markdown bodies by artifact id (not part of catalog.json). */
  bodies: Record<string, string>;
  /** Plugin README markdown by plugin name. */
  readmes: Record<string, string>;
  warnings: string[];
}

interface MarketplaceEntry {
  name: string;
  source: unknown;
  description?: string;
  category?: string;
  tags?: string[];
}

export function gitUpdatedAt(root: string): (path: string) => string | null {
  const cache = new Map<string, string | null>();
  return (path) => {
    if (!cache.has(path)) {
      const out = git(root, ['log', '-1', '--format=%cI', '--', path], { allowFail: true }).trim();
      cache.set(path, out || null);
    }
    return cache.get(path)!;
  };
}

export function buildCatalog(opts: CatalogOptions): CatalogResult {
  const src = opts.source ?? fsSource(opts.root);
  const updatedAt = opts.updatedAt ?? gitUpdatedAt(opts.root);
  const warnings: string[] = [];
  const mpFile = '.claude-plugin/marketplace.json';
  const mpText = src.read(mpFile);
  if (mpText == null) throw new BuildError(`${mpFile}: file not found`);
  const mp = parseJson(mpText, mpFile) as {
    name?: string;
    description?: string;
    plugins?: MarketplaceEntry[];
  };
  if (!mp.name || !Array.isArray(mp.plugins)) throw new BuildError(`${mpFile}: "name" and "plugins" are required`);

  const artifacts: Artifact[] = [];
  const bodies: Record<string, string> = {};
  const readmes: Record<string, string> = {};

  for (const entry of mp.plugins) {
    const entryTags = asStringList(entry.tags);
    const relative = typeof entry.source === 'string' && entry.source.startsWith('./') && !entry.source.includes('..');

    if (!relative) {
      const s = entry.source as { repo?: string; url?: string; path?: string } | string;
      const where = typeof s === 'string' ? s : s?.repo ?? s?.url ?? 'external';
      artifacts.push({
        id: `${entry.name}:plugin:${entry.name}`,
        type: 'plugin',
        name: entry.name,
        slug: toSlug(entry.name),
        plugin: entry.name,
        description: asString(entry.description),
        tags: entryTags,
        category: entry.category,
        searchText: stripMarkdown(asString(entry.description)),
        sourcePath: where.replace(/^https?:\/\//, '').replace(/\.git$/, ''),
        updatedAt: null,
        details: {},
        validation: { status: 'unknown', messages: [] },
        external: true,
      });
      continue;
    }

    const dir = (entry.source as string).replace(/^\.\//, '').replace(/\/+$/, '');
    const manifestFile = `${dir}/.claude-plugin/plugin.json`;
    const manifestText = src.read(manifestFile);
    const messages: string[] = [];
    let manifest: Manifest = {};
    if (manifestText == null) messages.push(`${manifestFile}: file not found`);
    else manifest = parseJson(manifestText, manifestFile) as Manifest;
    if (manifestText != null) {
      if (manifest.name !== entry.name)
        messages.push(`${manifestFile}: "name" is "${asString(manifest.name)}" but marketplace.json lists "${entry.name}"`);
      if (!manifest.version) messages.push(`${manifestFile}: "version" is missing`);
    }

    const pluginName = entry.name;
    const keywords = asStringList(manifest.keywords);
    const pluginTags = unique([...entryTags, ...keywords]);
    const description = asString(manifest.description) || asString(entry.description);
    const readme = src.read(`${dir}/README.md`);
    if (readme != null) readmes[pluginName] = readme;
    const author = manifest.author && typeof manifest.author === 'object' ? asString((manifest.author as { name?: unknown }).name) : asString(manifest.author);

    const supplied = opts.validation?.[pluginName];
    const validation: PluginValidation = messages.length
      ? { status: 'fail', messages: [...messages, ...(supplied?.status === 'fail' ? supplied.messages : [])] }
      : supplied ?? { status: 'unknown', messages: [] };

    const pluginArtifact: Artifact = {
      id: `${pluginName}:plugin:${pluginName}`,
      type: 'plugin',
      name: pluginName,
      slug: toSlug(pluginName),
      plugin: pluginName,
      description,
      tags: pluginTags,
      category: entry.category,
      version: asString(manifest.version) || undefined,
      searchText: stripMarkdown(readme ?? description),
      sourcePath: dir,
      updatedAt: updatedAt(dir),
      details: {
        author: author || undefined,
        homepage: asString(manifest.homepage) || undefined,
        repository: asString(manifest.repository) || undefined,
        hasReadme: readme != null,
      },
      validation,
    };
    artifacts.push(pluginArtifact);

    for (const c of discoverComponents(src, dir, manifest)) {
      warnings.push(...c.warnings);
      const id = `${pluginName}:${c.type}:${c.name}`;
      const fmTags = asStringList(c.frontmatter.tags);
      const art: Artifact = {
        id,
        type: c.type,
        name: c.name,
        slug: c.slug,
        plugin: pluginName,
        description: c.description,
        tags: unique([...pluginTags, ...fmTags]),
        category: entry.category,
        searchText: stripMarkdown(c.body || c.description),
        sourcePath: c.type === 'skill' ? c.mainPath.replace(/\/SKILL\.md$/, '') : c.mainPath,
        updatedAt: updatedAt(c.type === 'skill' ? c.mainPath.replace(/\/SKILL\.md$/, '') : c.mainPath),
        details: componentDetails(c, src),
      };
      if (c.type === 'skill' || c.type === 'command') {
        art.invoke = `/${pluginName}:${c.name}`;
        const hint = asString(c.frontmatter['argument-hint']).trim();
        if (c.type === 'command' && hint) art.invoke += ` ${hint}`;
      }
      artifacts.push(art);
      bodies[id] = c.body;
    }
  }

  const seen = new Set<string>();
  for (const a of artifacts) {
    if (seen.has(a.id)) throw new BuildError(`duplicate artifact id "${a.id}"`);
    seen.add(a.id);
  }
  artifacts.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    catalog: {
      schemaVersion: 1,
      generatedAt: opts.generatedAt,
      commit: opts.commit,
      marketplace: { name: mp.name, description: asString(mp.description), repo: opts.repo },
      artifacts,
    },
    bodies,
    readmes,
    warnings,
  };
}

const unique = (xs: string[]): string[] => [...new Set(xs)];

function componentDetails(c: ReturnType<typeof discoverComponents>[number], src: FileSource & { size?: (p: string) => number }): ArtifactDetails {
  if (c.hook) {
    return {
      fieldsTitle: 'Configuration',
      fields: [
        ['event', c.hook.event],
        ...(c.hook.matcher ? ([['matcher', c.hook.matcher]] as [string, string][]) : []),
        ...c.hook.commands.map((cmd): [string, string] => ['command', cmd]),
      ],
      files: [{ path: c.mainPath.split('/').slice(2).join('/') || c.mainPath, size: src.size?.(c.mainPath) ?? 0 }],
    };
  }
  if (c.mcp) {
    return {
      fieldsTitle: 'Configuration',
      fields: [
        ['server', c.name],
        ['command', [c.mcp.command, ...c.mcp.args].filter(Boolean).join(' ')],
        ...(c.mcp.envKeys.length ? ([['env', c.mcp.envKeys.join(', ')]] as [string, string][]) : []),
      ],
      files: [{ path: c.mainPath.split('/').slice(2).join('/') || c.mainPath, size: src.size?.(c.mainPath) ?? 0 }],
    };
  }
  const fields: [string, string][] = [];
  for (const [k, v] of Object.entries(c.frontmatter)) {
    fields.push([k, Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v ? JSON.stringify(v) : String(v)]);
  }
  const skillDir = c.type === 'skill' ? c.mainPath.replace(/SKILL\.md$/, '') : '';
  const files = (c.type === 'skill' ? c.files : [c.mainPath]).map((f) => ({
    path: skillDir ? f.slice(skillDir.length) : f.split('/').slice(2).join('/'),
    size: src.size?.(f) ?? 0,
  }));
  return { fieldsTitle: 'Frontmatter', fields, files };
}
