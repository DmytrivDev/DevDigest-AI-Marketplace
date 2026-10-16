// Shared data model (spec 5.2, 8.2, 9.2). Used by the build-time indexer and the client.

export type ArtifactType = 'plugin' | 'skill' | 'agent' | 'command' | 'hook' | 'mcp';
export type Freshness = 'new' | 'updated';
export type ValidationStatus = 'pass' | 'fail' | 'unknown';

export const TYPE_ORDER: ArtifactType[] = ['skill', 'agent', 'command', 'hook', 'mcp'];
export const ALL_TYPES: ArtifactType[] = ['plugin', ...TYPE_ORDER];

export interface FileInfo {
  path: string;
  size: number;
  description?: string;
}

/** Everything the artifact page needs besides the markdown body. */
export interface ArtifactDetails {
  /** "Frontmatter" for skills/agents/commands, "Configuration" for hooks and MCP servers. */
  fieldsTitle?: 'Frontmatter' | 'Configuration';
  fields?: [string, string][];
  files?: FileInfo[];
  /** Plugin only. */
  author?: string;
  homepage?: string;
  repository?: string;
  hasReadme?: boolean;
}

/** A plugin's `dependencies` entry from plugin.json, normalized. */
export interface PluginDependency {
  name: string;
  /** Semver range ("^1.0.0"), or null when any version is accepted. */
  version: string | null;
  /** Marketplace given in the entry ("name@marketplace" or `marketplace`), or null. */
  marketplace: string | null;
  /** True when the dependency is a plugin of this marketplace (no marketplace or the same one). */
  internal: boolean;
}

/** From the plugin's COMPATIBILITY.md. */
export interface PluginCompatibility {
  /** Claude Code version range from the "**Claude Code:** `>=x.y.z`" line, or null. */
  claudeCode: string | null;
  /** True when COMPATIBILITY.md exists. */
  doc: boolean;
}

export interface Artifact {
  id: string;
  type: ArtifactType;
  name: string;
  slug: string;
  plugin: string;
  description: string;
  tags: string[];
  category?: string;
  version?: string;
  searchText: string;
  sourcePath: string;
  updatedAt: string | null;
  invoke?: string;
  details: ArtifactDetails;
  validation?: { status: ValidationStatus; messages: string[] };
  external?: boolean;
  freshness?: Freshness;
  /** Plugin only: what this plugin depends on (plugin.json `dependencies`). */
  dependencies?: PluginDependency[];
  /** Plugin only: plugins of this marketplace that depend on this one, sorted. */
  usedBy?: string[];
  /** Plugin only. */
  compatibility?: PluginCompatibility;
}

export interface Catalog {
  schemaVersion: 1;
  generatedAt: string;
  commit: string;
  marketplace: { name: string; description: string; repo: string };
  artifacts: Artifact[];
}

export interface ArtifactRef {
  id: string;
  type: ArtifactType;
  name: string;
  exists: boolean;
}

export interface Changes {
  added: ArtifactRef[];
  updated: ArtifactRef[];
  removed: ArtifactRef[];
}

export type ReleaseNotes =
  | { source: 'changelog'; html: string }
  | { source: 'commits'; items: string[]; more: number }
  | null;

export interface Release {
  id: string;
  kind: 'plugin-added' | 'release' | 'plugin-removed';
  plugin: string;
  version: string | null;
  previousVersion: string | null;
  date: string;
  commit: string;
  changes: Changes;
  notes: ReleaseNotes;
  /** Artifact counts per type across the whole marketplace right after this event (feeds `growth`). */
  counts: Record<ArtifactType, number>;
}

export interface Changelog {
  schemaVersion: 1;
  generatedAt: string;
  commit: string;
  historyStart: string;
  truncated: boolean;
  releases: Release[];
  pending: { plugin: string; since: string; changes: Changes }[];
}

export interface Stats {
  schemaVersion: 1;
  generatedAt: string;
  commit: string;
  totals: {
    plugins: number;
    externalPlugins: number;
    artifacts: number;
    byType: Record<ArtifactType, number>;
    tags: number;
    categories: number;
    authors: number;
  };
  freshness: {
    lastReleaseAt: string | null;
    releases30d: number;
    releases90d: number;
    artifactsUpdated30d: number;
    unreleasedChanges: number;
  };
  quality: {
    validation: { pass: number; fail: number; unknown: number };
    withDescription: number;
    pluginsWithReadme: number;
  };
  growth: { date: string; byType: Record<ArtifactType, number> }[];
  topTags: { tag: string; count: number }[];
  plugins: {
    name: string;
    category: string | null;
    version: string | null;
    components: number;
    byType: Partial<Record<ArtifactType, number>>;
    updatedAt: string | null;
    validation: ValidationStatus;
  }[];
  github?: { stars: number; forks: number; openIssues: number; contributors: number; fetchedAt: string };
}

export const emptyCounts = (): Record<ArtifactType, number> => ({
  plugin: 0,
  skill: 0,
  agent: 0,
  command: 0,
  hook: 0,
  mcp: 0,
});

export class BuildError extends Error {}
