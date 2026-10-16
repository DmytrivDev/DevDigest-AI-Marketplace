// The .claude/settings.json snippet of the team settings builder. Shared by the page (build time)
// and the browser script (live update).
// Shape confirmed against the Claude Code docs, "Pre-install and require plugins":
//   https://code.claude.com/docs/en/plugins/org#pre-install-and-require-plugins
// (key reference: https://code.claude.com/docs/en/settings and /docs/en/settings-reference):
//   extraKnownMarketplaces: { "<marketplace name>": { source: { source: "github", repo: "<owner>/<repo>" } } }
//   enabledPlugins:         { "<plugin>@<marketplace name>": true }

export interface SettingsSnippet {
  extraKnownMarketplaces: Record<string, { source: { source: 'github'; repo: string } }>;
  enabledPlugins: Record<string, true>;
}

export function buildSettings(marketplace: string, repo: string, plugins: string[]): SettingsSnippet {
  const enabledPlugins: Record<string, true> = {};
  for (const p of plugins) enabledPlugins[`${p}@${marketplace}`] = true;
  return { extraKnownMarketplaces: { [marketplace]: { source: { source: 'github', repo } } }, enabledPlugins };
}

export const settingsText = (marketplace: string, repo: string, plugins: string[]): string =>
  JSON.stringify(buildSettings(marketplace, repo, plugins), null, 2);
