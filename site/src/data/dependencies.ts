import type { Artifact, PluginCompatibility, PluginDependency } from '../lib/types';

// Plugin dependencies (plugin.json `dependencies`) and COMPATIBILITY.md, read by the indexer.
// Invalid entries never fail the build: they are skipped with a warning.

/** "name" or "name@marketplace": no spaces, at most one "@". */
const DEP_STRING = /^([^\s@]+)(?:@([^\s@]+))?$/;

/**
 * Normalizes plugin.json `dependencies`. Items are either a string ("name", "name@marketplace")
 * or an object `{ name, version?, marketplace? }`. `marketplace` is this marketplace's name: a
 * dependency without a marketplace, or with this one, is internal.
 */
export function parseDependencies(raw: unknown, marketplace: string, file: string, warn: (m: string) => void): PluginDependency[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    warn(`${file}: "dependencies" must be an array, ignored`);
    return [];
  }
  const out: PluginDependency[] = [];
  const seen = new Set<string>();
  raw.forEach((item: unknown, i) => {
    const where = `${file}: dependencies[${i}]`;
    let name = '';
    let version: string | null = null;
    let mp: string | null = null;
    if (typeof item === 'string') {
      const m = DEP_STRING.exec(item.trim());
      if (!m) return warn(`${where}: "${item}" is not "name" or "name@marketplace", skipped`);
      name = m[1];
      mp = m[2] ?? null;
    } else if (item && typeof item === 'object' && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      if (typeof o.name !== 'string' || !DEP_STRING.test(o.name.trim()) || o.name.includes('@'))
        return warn(`${where}: "name" must be a plugin name, skipped`);
      if (o.version != null && (typeof o.version !== 'string' || !o.version.trim()))
        return warn(`${where}: "version" must be a non-empty string, skipped`);
      if (o.marketplace != null && (typeof o.marketplace !== 'string' || !DEP_STRING.test(o.marketplace.trim()) || o.marketplace.includes('@')))
        return warn(`${where}: "marketplace" must be a marketplace name, skipped`);
      name = o.name.trim();
      version = typeof o.version === 'string' ? o.version.trim() : null;
      mp = typeof o.marketplace === 'string' ? o.marketplace.trim() : null;
    } else {
      return warn(`${where}: expected a string or an object with "name", skipped`);
    }
    const key = `${name}@${mp ?? marketplace}`;
    if (seen.has(key)) return warn(`${where}: "${name}" is listed twice, skipped`);
    seen.add(key);
    out.push({ name, version, marketplace: mp, internal: mp == null || mp === marketplace });
  });
  return out;
}

/** The line "**Claude Code:** `>=2.1.110`". Tolerates a missing bold, the colon inside or outside it, list markers. */
const CLAUDE_CODE_LINE = /^[\s>*_-]*Claude Code\**\s*:\s*\**\s*`([^`\n]+)`/im;

export function parseCompatibility(doc: string | null): PluginCompatibility {
  if (doc == null) return { claudeCode: null, doc: false };
  const range = CLAUDE_CODE_LINE.exec(doc)?.[1].trim();
  return { claudeCode: range || null, doc: true };
}

/**
 * Fills `usedBy` on every plugin record from the other plugins' internal dependencies, and warns
 * about internal dependencies that are not in the marketplace.
 */
export function linkDependencies(plugins: Artifact[], warn: (m: string) => void): void {
  const byName = new Map(plugins.map((p) => [p.name, p]));
  const usedBy = new Map<string, Set<string>>();
  for (const p of plugins) {
    for (const d of p.dependencies ?? []) {
      if (!d.internal) continue;
      if (!byName.has(d.name)) {
        warn(`${p.sourcePath}/.claude-plugin/plugin.json: dependency "${d.name}" is not a plugin of this marketplace`);
        continue;
      }
      if (d.name === p.name) {
        warn(`${p.sourcePath}/.claude-plugin/plugin.json: the plugin depends on itself`);
        continue;
      }
      if (!usedBy.has(d.name)) usedBy.set(d.name, new Set());
      usedBy.get(d.name)!.add(p.name);
    }
  }
  for (const p of plugins) p.usedBy = [...(usedBy.get(p.name) ?? [])].sort();
}
