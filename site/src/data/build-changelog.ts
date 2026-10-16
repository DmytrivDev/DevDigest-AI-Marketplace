import {
  BuildError,
  emptyCounts,
  type ArtifactRef,
  type ArtifactType,
  type Changelog,
  type Changes,
  type Release,
  type ReleaseNotes,
} from '../lib/types';
import { discoverComponents, type FileSource, type Manifest } from './discover';
import { parseJson } from './frontmatter';
import { git, gitSource } from './sources';

// Release feed from git history (spec 8.1-8.2). Snapshots are read with `git ls-tree` / `git cat-file`,
// without checking anything out.

export interface ChangelogOptions {
  root: string;
  commit: string;
  generatedAt: string;
  limit?: number;
  /** ids present in the current catalog (-> ArtifactRef.exists). */
  currentIds: Set<string>;
  /** Markdown -> sanitized HTML for CHANGELOG.md sections. */
  renderNotes?: (md: string) => Promise<string>;
  warn?: (msg: string) => void;
}

interface SnapArtifact {
  type: Exclude<ArtifactType, 'plugin'>;
  name: string;
  mainId: string;
}
interface SnapPlugin {
  version: string;
  dir: string;
  artifacts: Map<string, SnapArtifact>; // key = type:name
  changelogMd: string | null;
}
type Snapshot = Map<string, SnapPlugin>; // by plugin name

interface Commit {
  sha: string;
  date: string;
  subject: string;
}

function snapshotOf(src: FileSource): Snapshot {
  const snap: Snapshot = new Map();
  const mpText = src.read('.claude-plugin/marketplace.json');
  if (mpText == null) return snap;
  const mp = parseJson(mpText, 'marketplace.json') as { plugins?: { name: string; source: unknown }[] };
  for (const entry of mp.plugins ?? []) {
    if (typeof entry.source !== 'string' || !entry.source.startsWith('./') || entry.source.includes('..')) continue;
    const dir = entry.source.replace(/^\.\//, '').replace(/\/+$/, '');
    const text = src.read(`${dir}/.claude-plugin/plugin.json`);
    if (text == null) continue;
    const manifest = parseJson(text, `${dir}/.claude-plugin/plugin.json`) as Manifest;
    const artifacts = new Map<string, SnapArtifact>();
    for (const c of discoverComponents(src, dir, manifest)) {
      artifacts.set(`${c.type}:${c.name}`, { type: c.type, name: c.name, mainId: c.mainId });
    }
    snap.set(entry.name, {
      version: String(manifest.version ?? ''),
      dir,
      artifacts,
      changelogMd: src.read(`${dir}/CHANGELOG.md`),
    });
  }
  return snap;
}

function countsOf(snap: Snapshot): Record<ArtifactType, number> {
  const counts = emptyCounts();
  for (const p of snap.values()) for (const a of p.artifacts.values()) counts[a.type]++;
  return counts;
}

/** Extracts the body of `## [x.y.z]` / `## x.y.z` from a Keep a Changelog file. */
export function changelogSection(md: string, version: string): string | null {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const head = new RegExp(`^##\\s+\\[?v?${esc}\\]?(\\s|$|-)`);
  const start = lines.findIndex((l) => head.test(l));
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end).join('\n').trim();
  return body || null;
}

function diff(before: SnapPlugin | undefined, after: SnapPlugin | undefined, ids: Set<string>, plugin: string): Changes {
  const ref = (a: SnapArtifact): ArtifactRef => ({
    id: `${plugin}:${a.type}:${a.name}`,
    type: a.type,
    name: a.name,
    exists: ids.has(`${plugin}:${a.type}:${a.name}`),
  });
  const changes: Changes = { added: [], updated: [], removed: [] };
  const b = before?.artifacts ?? new Map<string, SnapArtifact>();
  const a = after?.artifacts ?? new Map<string, SnapArtifact>();
  for (const [k, v] of a) {
    const old = b.get(k);
    if (!old) changes.added.push(ref(v));
    else if (old.mainId !== v.mainId) changes.updated.push(ref(v));
  }
  for (const [k, v] of b) if (!a.has(k)) changes.removed.push(ref(v));
  const byName = (x: ArtifactRef, y: ArtifactRef) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
  changes.added.sort(byName);
  changes.updated.sort(byName);
  changes.removed.sort(byName);
  return changes;
}

const isEmpty = (c: Changes): boolean => !c.added.length && !c.updated.length && !c.removed.length;

export async function buildChangelog(opts: ChangelogOptions): Promise<Changelog> {
  const limit = opts.limit ?? 300;
  const warn = opts.warn ?? (() => {});
  const log = git(opts.root, ['log', '--first-parent', '--format=%H%x09%cI%x09%s', '-n', String(limit + 1), '--', 'plugins', '.claude-plugin'], { allowFail: true });
  let commits: Commit[] = log
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [sha, date, ...rest] = l.split('\t');
      return { sha, date, subject: rest.join('\t') };
    });
  const truncated = commits.length > limit;
  commits = commits.slice(0, limit).reverse(); // oldest first

  const blobCache = new Map<string, string>();
  const releases: Release[] = [];
  const base = new Map<string, { snap: SnapPlugin; sha: string }>(); // per plugin: state at its last event
  let prev: Snapshot = new Map();
  let first = true;
  let last: Snapshot = new Map();

  for (const c of commits) {
    let snap: Snapshot;
    try {
      snap = snapshotOf(gitSource(opts.root, c.sha, blobCache));
    } catch (err) {
      if (err instanceof BuildError) {
        warn(`changelog: skipped ${c.sha.slice(0, 7)}: ${err.message}`);
        continue;
      }
      throw err;
    }
    last = snap;
    if (first && truncated) {
      // The oldest commit in a cut window is only a baseline.
      for (const [name, p] of snap) base.set(name, { snap: p, sha: c.sha });
      prev = snap;
      first = false;
      continue;
    }
    first = false;
    const counts = countsOf(snap);

    for (const [name, p] of snap) {
      const old = prev.get(name);
      if (!old) {
        releases.push(await mkRelease('plugin-added', name, p, undefined, c, undefined, counts));
        base.set(name, { snap: p, sha: c.sha });
      } else if (old.version !== p.version) {
        const b = base.get(name);
        releases.push(await mkRelease('release', name, p, old, c, b, counts));
        base.set(name, { snap: p, sha: c.sha });
      }
    }
    for (const [name, old] of prev) {
      if (!snap.has(name)) {
        releases.push(await mkRelease('plugin-removed', name, undefined, old, c, base.get(name), counts));
        base.delete(name);
      }
    }
    prev = snap;
  }

  async function mkRelease(
    kind: Release['kind'],
    plugin: string,
    now: SnapPlugin | undefined,
    old: SnapPlugin | undefined,
    c: Commit,
    b: { snap: SnapPlugin; sha: string } | undefined,
    counts: Record<ArtifactType, number>,
  ): Promise<Release> {
    const changes = diff(kind === 'release' ? (b?.snap ?? old) : kind === 'plugin-removed' ? (b?.snap ?? old) : undefined, now, opts.currentIds, plugin);
    let notes: ReleaseNotes = null;
    const section = now?.changelogMd && now.version ? changelogSection(now.changelogMd, now.version) : null;
    if (section && opts.renderNotes) {
      notes = { source: 'changelog', html: await opts.renderNotes(section) };
    } else if (now) {
      const range = b ? `${b.sha}..${c.sha}` : c.sha;
      const subjects = git(opts.root, ['log', '--no-merges', '--format=%s', range, '--', now.dir], { allowFail: true })
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (subjects.length) notes = { source: 'commits', items: subjects.slice(0, 10), more: Math.max(0, subjects.length - 10) };
    }
    const id = kind === 'release' ? `${plugin}@${now!.version}` : kind === 'plugin-added' ? `${plugin}@added` : `${plugin}@removed`;
    return {
      id,
      kind,
      plugin,
      version: now?.version ?? null,
      previousVersion: old?.version ?? null,
      date: c.date,
      commit: c.sha,
      changes,
      notes,
      counts,
    };
  }

  // Pending: changes since each plugin's last event, still in the current state.
  const pending: Changelog['pending'] = [];
  for (const [name, p] of [...last].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const b = base.get(name);
    if (!b) continue;
    const changes = diff(b.snap, p, opts.currentIds, name);
    if (!isEmpty(changes)) pending.push({ plugin: name, since: b.snap.version, changes });
  }

  return {
    schemaVersion: 1,
    generatedAt: opts.generatedAt,
    commit: opts.commit,
    historyStart: commits[0]?.date ?? opts.generatedAt,
    truncated,
    releases: releases.reverse(),
    pending,
  };
}
