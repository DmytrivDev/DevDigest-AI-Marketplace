import type { Artifact, Catalog } from './types';

// Commands by type (spec 7.5). Marketplace name and repo come from the catalog.

export interface MarketplaceInfo {
  name: string;
  repo: string;
}

export const addCommand = (m: MarketplaceInfo): string => `/plugin marketplace add ${m.repo}`;
export const installCommand = (plugin: string, m: MarketplaceInfo): string => `/plugin install ${plugin}@${m.name}`;
export const updateCommand = (m: MarketplaceInfo): string => `/plugin marketplace update ${m.name}`;
/** Installs a plugin into the project's settings (for teams that commit .claude/settings.json). */
export const projectInstallCommand = (plugin: string, m: MarketplaceInfo): string => `claude plugin install ${plugin}@${m.name} --scope project`;
export const removeCommand = (plugin: string, m: MarketplaceInfo): string => `/plugin uninstall ${plugin}@${m.name}`;
// Checked against https://code.claude.com/docs/en/plugins/cli-reference.md and plugins/install.md (2026-10-16):
// `marketplace update` only refreshes the catalog; installed plugins are upgraded with `claude plugin update`.
export const pluginUpdateCommand = (plugin: string, m: MarketplaceInfo): string => `claude plugin update ${plugin}@${m.name}`;
export const disableCommand = (plugin: string): string => `/plugin disable ${plugin}`;

export function isInvocable(a: Pick<Artifact, 'type'>): boolean {
  return a.type === 'skill' || a.type === 'command';
}

/** The primary command for the card button and the artifact page header. */
export function primaryCommand(a: Artifact, m: MarketplaceInfo): string {
  if (isInvocable(a) && a.invoke) return a.invoke;
  return installCommand(a.plugin, m);
}

export const marketplaceInfo = (c: Catalog): MarketplaceInfo => ({ name: c.marketplace.name, repo: c.marketplace.repo });
