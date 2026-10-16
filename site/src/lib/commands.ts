import type { Artifact, Catalog } from './types';

// Commands by type (spec 7.5). Marketplace name and repo come from the catalog.

export interface MarketplaceInfo {
  name: string;
  repo: string;
}

export const addCommand = (m: MarketplaceInfo): string => `/plugin marketplace add ${m.repo}`;
export const installCommand = (plugin: string, m: MarketplaceInfo): string => `/plugin install ${plugin}@${m.name}`;
export const updateCommand = (m: MarketplaceInfo): string => `/plugin marketplace update ${m.name}`;
export const removeCommand = (plugin: string, m: MarketplaceInfo): string => `/plugin uninstall ${plugin}@${m.name}`;

export function isInvocable(a: Pick<Artifact, 'type'>): boolean {
  return a.type === 'skill' || a.type === 'command';
}

/** The primary command for the card button and the artifact page header. */
export function primaryCommand(a: Artifact, m: MarketplaceInfo): string {
  if (isInvocable(a) && a.invoke) return a.invoke;
  return installCommand(a.plugin, m);
}

export const marketplaceInfo = (c: Catalog): MarketplaceInfo => ({ name: c.marketplace.name, repo: c.marketplace.repo });
