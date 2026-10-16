import type { Artifact, Catalog, Changelog, Release } from './types';
import { artifactPath, url } from './url';

// Small helpers for pages (build time).

export const pluginHref = (plugin: string): string => url(`plugins/${plugin}/`);
export const artifactHref = (a: Artifact): string => (a.type === 'plugin' ? pluginHref(a.plugin) : url(artifactPath(a.plugin, a.type, a.slug)));
export const repoUrl = (c: Catalog): string => `https://github.com/${c.marketplace.repo}`;

export const components = (c: Catalog): Artifact[] => c.artifacts.filter((a) => a.type !== 'plugin');
export const plugins = (c: Catalog): Artifact[] => c.artifacts.filter((a) => a.type === 'plugin');

export function releaseTitle(r: Release): string {
  if (r.kind === 'plugin-added') return r.version ? `${r.plugin} added (${r.version})` : `${r.plugin} added`;
  if (r.kind === 'plugin-removed') return `${r.plugin} removed`;
  return `${r.plugin} ${r.version}`;
}

/** "2 added, 1 updated, 1 removed" for the version history. */
export function releaseSummary(r: Release): string {
  const { added, updated, removed } = r.changes;
  if (r.kind === 'plugin-added') {
    return added.length ? `Plugin added with ${added.length} artifact${added.length === 1 ? '' : 's'}` : 'Plugin added';
  }
  if (r.kind === 'plugin-removed') return 'Plugin removed';
  const parts = [
    added.length ? `${added.length} added` : '',
    updated.length ? `${updated.length} updated` : '',
    removed.length ? `${removed.length} removed` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'No changes to contents';
}

export const pendingFor = (cl: Changelog, plugin: string) => cl.pending.find((p) => p.plugin === plugin);

/** Splits "path/file: message" into file and message for validation errors. */
export function splitMessage(m: string): { file: string | null; msg: string } {
  const x = /^([^\s:]+\.[A-Za-z]+(?::\d+)?): (.*)$/.exec(m);
  return x ? { file: x[1], msg: x[2] } : { file: null, msg: m };
}
