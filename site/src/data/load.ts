import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildCatalog } from './build-catalog';
import { buildChangelog } from './build-changelog';
import { buildStats, fetchGithub } from './build-stats';
import { applyFreshness } from './freshness';
import { renderMarkdown } from './markdown';
import { git } from './sources';
import { runClaudeValidate } from './validation';
import type { Catalog, Changelog, Stats } from '../lib/types';

export interface SiteData {
  catalog: Catalog;
  changelog: Changelog;
  stats: Stats;
  /** Markdown bodies by artifact id. */
  bodies: Record<string, string>;
  /** Plugin README markdown by plugin name. */
  readmes: Record<string, string>;
  /** Plugin COMPATIBILITY.md markdown by plugin name. */
  compatDocs: Record<string, string>;
  warnings: string[];
}

const DEFAULT_REPO = 'DmytrivDev/DevDigest-AI-Marketplace';
let cached: Promise<SiteData> | null = null;
const dev = import.meta.env.DEV;

export function loadSiteData(): Promise<SiteData> {
  const g = globalThis as { __ddDirty?: boolean };
  if (g.__ddDirty) {
    g.__ddDirty = false;
    cached = null; // dev: plugins/** or .claude-plugin/** changed
  }
  return (cached ??= loadReal());
}

function repoRoot(): string {
  return process.env.DD_REPO_ROOT ?? resolve(process.cwd(), '..');
}

function detectRepo(root: string): string {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const remote = git(root, ['remote', 'get-url', 'origin'], { allowFail: true }).trim();
  const m = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(remote);
  return m ? m[1] : DEFAULT_REPO;
}

async function loadReal(): Promise<SiteData> {
  const root = repoRoot();
  const repo = detectRepo(root);
  const commit = process.env.GITHUB_SHA ?? (git(root, ['rev-parse', 'HEAD'], { allowFail: true }).trim() || '0000000000000000000000000000000000000000');
  const generatedAt = new Date().toISOString();

  // Plugin directories come from marketplace.json; validate them first so the result lands in the catalog.
  const mp = JSON.parse(readFileSync(resolve(root, '.claude-plugin/marketplace.json'), 'utf8')) as { plugins?: { name: string; source: unknown }[] };
  const locals = (mp.plugins ?? [])
    .filter((p) => typeof p.source === 'string' && p.source.startsWith('./') && !p.source.includes('..'))
    .map((p) => ({ name: p.name, dir: (p.source as string).replace(/^\.\//, '') }));
  // The dev server skips the slow CLI check and the GitHub call unless asked (DD_VALIDATE=1 / DD_GITHUB=1).
  const validation = dev && process.env.DD_VALIDATE !== '1' ? {} : runClaudeValidate(root, locals);

  const built = buildCatalog({ root, commit, generatedAt, repo, validation });
  const ids = new Set(built.catalog.artifacts.map((a) => a.id));
  const changelog = await buildChangelog({
    root,
    commit,
    generatedAt,
    currentIds: ids,
    renderNotes: (md) => renderMarkdown(md, { headingOffset: 2 }),
    warn: (m) => built.warnings.push(m),
  });
  const catalog = applyFreshness(built.catalog, changelog);
  const github = process.env.DD_SKIP_GITHUB === '1' || (dev && process.env.DD_GITHUB !== '1') ? undefined : await fetchGithub(repo, process.env.GITHUB_TOKEN);
  const stats = buildStats(catalog, changelog, github);
  built.warnings.forEach((w) => console.warn(`[catalog] ${w}`));
  return { catalog, changelog, stats, bodies: built.bodies, readmes: built.readmes, compatDocs: built.compatDocs, warnings: built.warnings };
}
