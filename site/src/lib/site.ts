import { TYPE_LABEL } from './icons';
import type { Artifact, ArtifactRef, Catalog, Changelog, Release } from './types';
import { t } from '../i18n/en';
import { artifactPath, url } from './url';

// Small helpers for pages (build time).

export const pluginHref = (plugin: string): string => url(`plugins/${plugin}/`);
export const artifactHref = (a: Artifact): string => (a.type === 'plugin' ? pluginHref(a.plugin) : url(artifactPath(a.plugin, a.type, a.slug)));
export const repoUrl = (c: Catalog): string => `https://github.com/${c.marketplace.repo}`;

export const components = (c: Catalog): Artifact[] => c.artifacts.filter((a) => a.type !== 'plugin');
export const plugins = (c: Catalog): Artifact[] => c.artifacts.filter((a) => a.type === 'plugin');

export function releaseTitle(r: Release): string {
  if (r.kind === 'plugin-added') return t.release.added(r.plugin, r.version);
  if (r.kind === 'plugin-removed') return t.release.removed(r.plugin);
  return t.release.version(r.plugin, r.version);
}

/** "2 added, 1 updated, 1 removed" for the version history. */
export function releaseSummary(r: Release): string {
  const { added, updated, removed } = r.changes;
  if (r.kind === 'plugin-added') {
    return added.length ? t.release.pluginAddedWith(added.length) : t.release.pluginAdded;
  }
  if (r.kind === 'plugin-removed') return t.release.pluginRemoved;
  const parts = [
    added.length ? t.release.nAdded(added.length) : '',
    updated.length ? t.release.nUpdated(updated.length) : '',
    removed.length ? t.release.nRemoved(removed.length) : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : t.release.noChanges;
}

/** Plain-text list of changes for the RSS item description (spec 8.5). */
export function releaseText(r: Release): string {
  const line = (label: string, items: ArtifactRef[]) =>
    items.length ? t.feed.line(label, items.length, items.map((i) => `${TYPE_LABEL[i.type]} ${i.name}`).join(', ')) : '';
  const parts = [line(t.feed.added, r.changes.added), line(t.feed.updated, r.changes.updated), line(t.feed.removed, r.changes.removed)].filter(Boolean);
  if (r.kind === 'plugin-removed') parts.unshift(t.feed.pluginRemoved);
  else if (r.kind === 'plugin-added') parts.unshift(t.feed.pluginAdded);
  else if (!parts.length) parts.push(t.feed.noChanges);
  return parts.join(' ');
}

export const pendingFor = (cl: Changelog, plugin: string) => cl.pending.find((p) => p.plugin === plugin);

/** Splits "path/file: message" into file and message for validation errors. */
export function splitMessage(m: string): { file: string | null; msg: string } {
  const x = /^([^\s:]+\.[A-Za-z]+(?::\d+)?): (.*)$/.exec(m);
  return x ? { file: x[1], msg: x[2] } : { file: null, msg: m };
}
