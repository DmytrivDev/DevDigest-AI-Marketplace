// All user-facing UI text of the catalog site, in one place (spec 16: i18n).
// Components, pages and client scripts never hardcode words: they read `t.<area>.<key>`.
// Strings with variables are small functions; plurals go through `pick` (Intl.PluralRules).
// Not here on purpose: data from the repository (plugin names, descriptions, markdown bodies),
// the search dictionaries in src/search/ (search data, not UI copy), URLs, CSS, console/CLI output.
// A second language implements the `Dictionary` type (e.g. `export const t: Dictionary = {...}` in uk.ts).
import type { ArtifactType } from '../lib/types';

const rules = new Intl.PluralRules('en');
/** Picks the singular or plural form for a count. */
const pick = (n: number, one: string, other: string): string => (rules.select(n) === 'one' ? one : other);

const typeLabel: Record<ArtifactType, string> = {
  plugin: 'Plugin',
  skill: 'Skill',
  agent: 'Agent',
  command: 'Command',
  hook: 'Hook',
  mcp: 'MCP',
};
const typePlural: Record<ArtifactType, string> = {
  plugin: 'Plugins',
  skill: 'Skills',
  agent: 'Agents',
  command: 'Commands',
  hook: 'Hooks',
  mcp: 'MCP servers',
};
/** What "artifact" and "plugin" are called in counts on the home page: [singular, plural]. */
const homeNouns = { artifact: ['artifact', 'artifacts'], plugin: ['plugin', 'plugins'] } as const;
export type HomeNoun = keyof typeof homeNouns;

/**
 * Strings the browser script (src/client/site.ts) needs. Kept as a separate export of this file so
 * that script can import just these and the page bundles stay small (spec 13); `t` reuses them.
 */
export const clientStrings = {
  copy: {
    ariaCopy: (cmd: string) => `Copy command: ${cmd}`,
    ariaCopied: (cmd: string) => `Copied: ${cmd}`,
    copied: 'Copied',
    hint: 'Paste the command into a Claude Code session.',
    keyMac: '⌘C',
    keyOther: 'Ctrl+C',
    fail: (key: string) => `Couldn't copy automatically. The command is selected: press ${key}.`,
  },
  unseen: (n: number) => `${n} unseen ${pick(n, 'release', 'releases')}`,
} as const;

export const t = {
  site: {
    name: 'DevDigest Marketplace',
    brand: 'devdigest-marketplace',
    tagline: 'Claude Code plugins from DevDigest, the local-first AI PR reviewer.',
    htmlTitle: (page: string, site: string) => `${page} · ${site}`,
    ogImageAlt: (site: string) => `${site}: Claude Code plugins catalog`,
  },

  nav: {
    catalog: 'Catalog',
    whatsNew: "What's new",
    stats: 'Stats',
    guide: 'Guide',
    main: 'Main',
    menu: 'Menu',
    close: 'Close',
    github: 'GitHub',
    skipToResults: 'Skip to results',
    skipToContent: 'Skip to content',
    breadcrumb: 'Breadcrumb',
    theme: 'Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
  },

  footer: {
    label: 'Footer',
    built: (date: string) => `Built ${date} from commit`,
    repository: 'Repository',
    catalogJson: 'catalog.json',
    rss: 'RSS',
    noData: 'This site collects no visitor data.',
  },

  states: {
    stale: 'Catalog updated since this page was loaded.',
    reload: 'Reload page',
    noComponents: "This marketplace's plugins don't have any skills, agents or hooks yet.",
    noscript: 'Search needs JavaScript. The full list is below.',
  },

  /** Shared nouns, singular or plural by count. */
  nouns: {
    plugin: (n: number) => pick(n, 'plugin', 'plugins'),
    artifact: (n: number) => pick(n, 'artifact', 'artifacts'),
    tag: (n: number) => pick(n, 'tag', 'tags'),
  },

  types: {
    label: typeLabel,
    plural: typePlural,
    /** Column headers and chart labels: "MCP" instead of "MCP servers". */
    pluralShort: { ...typePlural, mcp: 'MCP' } as Record<ArtifactType, string>,
    /** Inside a sentence: "no hooks found". */
    pluralLower: Object.fromEntries(
      (Object.keys(typePlural) as ArtifactType[]).map((k) => [k, typePlural[k].toLowerCase()]),
    ) as Record<ArtifactType, string>,
    /** Chart descriptions for screen readers: lower case, but "MCP servers". */
    pluralSeries: { ...Object.fromEntries(
      (Object.keys(typePlural) as ArtifactType[]).map((k) => [k, typePlural[k].toLowerCase()]),
    ), mcp: 'MCP servers' } as Record<ArtifactType, string>,
  },

  fresh: {
    new: 'New',
    updated: 'Updated',
  },

  validation: {
    pass: 'Validation passed',
    fail: 'Validation failed',
    unknown: 'Not verified',
  },

  copy: clientStrings.copy,

  time: {
    today: 'today',
  },

  units: {
    bytes: (n: number) => `${n} B`,
    kilobytes: (n: string) => `${n} KB`,
  },

  /** Release descriptions, shared by What's new and the plugin page. */
  release: {
    added: (plugin: string, version: string | null) => (version ? `${plugin} added (${version})` : `${plugin} added`),
    removed: (plugin: string) => `${plugin} removed`,
    version: (plugin: string, version: string | null) => `${plugin} ${version}`,
    pluginAdded: 'Plugin added',
    pluginAddedWith: (n: number) => `Plugin added with ${n} ${pick(n, 'artifact', 'artifacts')}`,
    pluginRemoved: 'Plugin removed',
    nAdded: (n: number) => `${n} added`,
    nUpdated: (n: number) => `${n} updated`,
    nRemoved: (n: number) => `${n} removed`,
    noChanges: 'No changes to contents',
  },

  /** Rendered markdown (READMEs and artifact bodies). */
  markdown: {
    scrollTable: 'Scrollable table',
  },

  /** Plain-text release descriptions in /feed.xml (spec 8.5). */
  feed: {
    title: (site: string) => `What's new · ${site}`,
    added: 'Added',
    updated: 'Updated',
    removed: 'Removed',
    line: (label: string, n: number, items: string) => `${label} (${n}): ${items}.`,
    pluginAdded: 'Plugin added.',
    pluginRemoved: 'Plugin removed.',
    noChanges: 'No changes to contents.',
  },

  home: {
    heroCmd: 'Add this marketplace in Claude Code',
    pluginPlaceholder: '<plugin>',
    onboarding: {
      heading: 'New to Claude Code marketplaces? Three steps.',
      dismissAria: 'Dismiss getting started',
      step1Title: 'Add the marketplace',
      step1Text: 'Run once in Claude Code.',
      step2Title: 'Install a plugin',
      step2TextMany: 'Pick a plugin in the catalog below, for example:',
      step2TextOne: 'Installs all of its skills, agents and hooks.',
      step3Title: 'Find and invoke',
      step3Text: 'Search below and copy the command.',
      noInvoke: 'Commands for skills appear here once the plugin has any.',
      gotIt: 'Got it',
      learnMore: 'Learn more →',
    },
    summaryAria: 'Catalog summary',
    lastRelease: 'last release',
    noComponentsYet: 'no components yet',
    allStats: 'All stats →',
    emptyTitle: 'No artifacts in this marketplace yet',
    emptyText: "Plugins appear here after they're added to the repository and the site is rebuilt.",
    emptyLink: 'How to add a plugin →',
    /** Example search chips: "<type word> for <tag>" per plugin, then these fixed ones. */
    exampleTypeWord: {
      plugin: 'plugin',
      skill: 'skill',
      agent: 'agent',
      command: 'command',
      hook: 'hook',
      mcp: 'MCP server',
    } as Record<ArtifactType, string>,
    exampleFor: (typeWord: string, tag: string) => `${typeWord} for ${tag}`,
    exampleFallbacks: ['skill for PR review', 'security agent', 'pre-commit hooks'],
    /** The React island (src/components/home). */
    searchLabel: 'Search artifacts',
    placeholder: 'Describe what you need, e.g. a skill for PR review',
    clearSearch: 'Clear search',
    preparing: 'Preparing search…',
    offline: "You're offline. The list below is current as of the last build.",
    loadFail: "Couldn't load search. The list below is current as of the last build.",
    tryAgain: 'Try again',
    try: 'Try',
    ukrainianToo: 'Ukrainian works too.',
    newAndUpdated: 'New and updated',
    lastDays: (n: number) => `last ${n} days`,
    whatsNewLink: "What's new →",
    filters: 'Filters',
    filtersToggle: (n: number) => `Filters (${n})`,
    facetType: 'Type',
    facetPlugin: 'Plugin',
    facetFreshness: 'Freshness',
    facetTags: 'Tags',
    showFewer: 'Show fewer',
    moreTags: (n: number) => `${n} more ▾`,
    all: 'All ',
    resultsFor: (n: number, q: string) => `${n} ${pick(n, 'result', 'results')} for “${q}”`,
    ofTotal: (n: number, total: number, noun: HomeNoun) => `${n} of ${total} ${homeNouns[noun][1]}`,
    count: (n: number, noun: HomeNoun) => `${n} ${pick(n, homeNouns[noun][0], homeNouns[noun][1])}`,
    sort: 'Sort',
    sortRelevance: 'Relevance',
    sortUpdated: 'Updated',
    sortName: 'Name',
    noTypeFound: (typePluralLower: string) => `No ${typePluralLower} found — showing other artifacts for your query`,
    activeFilters: 'Active filters',
    clearFilters: 'Clear filters',
    chipType: (label: string) => `Type: ${label}`,
    chipTypeFromQuery: (label: string) => `Type: ${label} (from query)`,
    chipPlugin: (name: string) => `Plugin: ${name}`,
    chipFreshness: (label: string) => `Freshness: ${label}`,
    chipTag: (tag: string) => `Tag: ${tag}`,
    chipRemove: (chip: string) => `Remove filter ${chip}`,
    noMatchQuery: (noun: HomeNoun, q: string) => `No ${homeNouns[noun][1]} match “${q}”`,
    noMatchFilters: (noun: HomeNoun) => `No ${homeNouns[noun][1]} match these filters`,
    tryFewer: 'Try fewer words, or start from a popular tag:',
    suggest: 'Suggest an artifact',
    issueTitle: (q: string) => `Suggest an artifact: ${q}`,
    issueBody: (q: string) => `I looked for: ${q}`,
  },

  plugin: {
    pageTitle: (name: string) => `${name} plugin`,
    versionBadge: (v: string) => `v${v}`,
    external: 'External',
    detailsAria: 'Plugin details',
    tipExternal: "External plugins aren't checked by this marketplace's validator.",
    tipNoValidator: "The validator didn't run on the last build, so this plugin's manifest hasn't been checked.",
    failedHeading: (n: number) => `Validation failed: ${n} ${pick(n, 'error', 'errors')}`,
    checked: (date: string, sha: string) =>
      `Checked ${date} at commit ${sha}. The plugin can still be installed, but the files listed may not load.`,
    install: 'Install',
    installStep1: '1. Add the marketplace (once)',
    installStep2: '2. Install the plugin',
    unavailableLead: 'Contents unavailable:',
    unavailableText: " this plugin is hosted outside this repository, so its skills, agents and README aren't indexed here.",
    viewSource: "View the plugin's source →",
    contents: 'Contents',
    artifacts: 'Artifacts',
    readme: 'README',
    versionHistory: 'Version history',
    allReleases: "All releases in What's new →",
    noReleases: 'No releases yet.',
    metaVersion: 'Version',
    metaCategory: 'Category',
    metaAuthor: 'Author',
    metaArtifacts: 'Artifacts',
    metaLastRelease: 'Last release',
    metaSource: 'Source',
    unavailable: 'Unavailable',
    tags: 'Tags',
    sourceOnGithub: 'Source on GitHub →',
  },

  artifact: {
    pageTitle: (name: string, plugin: string, type: string) => `${name} — ${plugin} plugin ${type}`,
    notes: {
      agent: 'Claude delegates to this agent when a task matches its description. You can also mention it by name in a prompt.',
      hook: 'This hook is part of the plugin and runs automatically once the plugin is installed.',
      mcp: 'This server is part of the plugin and starts automatically once the plugin is installed.',
    } as Record<string, string>,
    invoke: 'Invoke in Claude Code',
    comesWithPlugin: 'Comes with the plugin. Install it',
    installCommand: 'Install command:',
    in: 'in',
    updated: (date: string) => ` · updated ${date}`,
    documentation: 'Documentation',
    openOnGithub: 'Open on GitHub',
    frontmatter: 'Frontmatter',
    skillFiles: 'Skill files',
    files: 'Files',
    moreFromPlugin: 'More from this plugin',
    allInPlugin: (n: number, plugin: string) => `All ${n} ${pick(n, 'artifact', 'artifacts')} in ${plugin} →`,
  },

  whatsNew: {
    title: "What's new",
    description: 'Plugin releases in this marketplace, newest first.',
    followFeed: 'Follow in a feed reader:',
    rssFeed: 'RSS feed',
    plugin: 'Plugin',
    allPlugins: 'All plugins',
    unreleased: 'Unreleased',
    unreleasedMeta: (plugin: string, since: string) => `${plugin}, since ${since}`,
    unreleasedLead: 'Changes in the repository not yet released in a new version:',
    added: '+ Added',
    updated: '~ Updated',
    removed: '− Removed',
    noReleasesTitle: 'No releases yet',
    noReleasesText: 'When a plugin publishes its first version, it appears here.',
    newForYou: 'New for you',
    releaseNotes: 'Release notes',
    andMore: (n: number) => `and ${n} more`,
    historyFrom: (date: string) => `History shown from ${date}`,
    unseen: clientStrings.unseen,
  },

  stats: {
    title: 'Stats',
    description: 'Plugins, artifacts, releases and quality of this marketplace.',
    fromBuild: (date: string, sha: string) => `From the build on ${date}, commit ${sha}.`,
    summaryAria: 'Summary',
    plugin: (n: number) => pick(n, 'Plugin', 'Plugins'),
    artifact: (n: number) => pick(n, 'Artifact', 'Artifacts'),
    tag: (n: number) => pick(n, 'Tag', 'Tags'),
    author: (n: number) => pick(n, 'Author', 'Authors'),
    byType: 'Contents by type',
    growth: 'Growth',
    chartTitle: 'Artifacts per type after each release',
    chartEmpty: 'Not enough releases yet to draw a chart. The chart appears after the second release.',
    showTable: 'Show as table',
    colDate: 'Date',
    colTotal: 'Total',
    noReleases: 'No releases yet.',
    chartLabel: (name: string, n: number) => `${name} ${n}`,
    chartSeries: (name: string, values: string) => `${name} ${values}`,
    chartAria: (series: string, dates: string) => `Stepped line chart of artifacts per type: ${series} on ${dates}.`,
    chartDatesAnd: (head: string, last: string) => `${head} and ${last}`,
    chartCaption: (totals: string) => `Artifacts of each type after every release. Total: ${totals}.`,
    chartCaptionItem: (n: number, date: string) => `${n} on ${date}`,
    freshness: 'Freshness',
    quality: 'Quality',
    lastRelease: 'Last release',
    releases30: 'Releases in 30 days',
    releases90: 'Releases in 90 days',
    unreleasedChanges: 'Unreleased changes',
    validation: 'Validation',
    validationPass: (n: number) => `${n} pass`,
    validationFail: (n: number) => `${n} fail`,
    validationUnknown: (n: number) => `${n} not verified`,
    descriptionPresent: 'Description present',
    readmePresent: 'README present',
    ofTotal: (n: number, total: number) => `${n} of ${total}`,
    plugins: 'Plugins',
    colPlugin: 'Plugin',
    colVersion: 'Version',
    colArtifacts: 'Artifacts',
    colLastRelease: 'Last release',
    colValidation: 'Validation',
    tags: 'Tags',
    noTags: 'No tags yet.',
    github: 'GitHub',
    stars: 'Stars',
    forks: 'Forks',
    openIssues: 'Open issues',
    contributors: 'Contributors',
    githubNote: 'From the GitHub API at build time.',
    notHereHeading: "What's not here and why",
    notHere: [
      {
        k: 'Install and download counts',
        v: "Claude Code doesn't report installs to marketplaces, and this site collects no visitor data.",
      },
      { k: 'Page views and popular searches', v: 'Search runs in your browser. Queries are never sent anywhere.' },
      {
        k: 'Ratings and reviews',
        v: 'The catalog is a static site with no accounts or backend. Use GitHub issues for feedback.',
      },
    ],
  },

  guide: {
    title: 'Guide',
    description: "How to add this marketplace to Claude Code, install plugins and use what's inside.",
    onThisPage: 'On this page',
    toc: {
      add: 'Add the marketplace',
      install: 'Install a plugin',
      invoke: 'Find and invoke',
      types: 'Artifact types',
      update: 'Update and remove',
      problems: 'Common problems',
      authors: 'For authors',
    },
    /** Placeholders shown in example commands when the catalog has no real one. */
    exampleSkill: (plugin: string) => `/${plugin}:<skill>`,
    exampleCommand: (plugin: string) => `/${plugin}:<command>`,
    add: {
      /** Text with `code` spans is rendered through <Rich>. */
      text: (name: string) =>
        `Run this once in Claude Code. It registers the repository as a marketplace named \`${name}\`.`,
    },
    install: {
      text: 'Install by plugin name and marketplace. Everything inside the plugin is installed together: skills, agents, commands, hooks and the MCP server.',
      restart: "If the new commands don't show up, restart Claude Code.",
    },
    invoke: {
      before: 'Search the ',
      catalog: 'catalog',
      after: ' in plain words, then copy the command from the card. Skills and commands are invoked by name:',
      agents:
        'Agents, hooks and MCP servers have no command of their own. Claude delegates to agents when a task matches, hooks run on their event, and MCP servers start with the plugin.',
    },
    typesTable: {
      aria: 'Artifact types',
      colType: 'Type',
      colWhat: 'What it is',
      colHow: 'How you use it',
      what: {
        plugin: 'A versioned bundle of the artifacts below.',
        skill: 'Instructions and files Claude loads for a specific task.',
        agent: 'A subagent with its own prompt and tools.',
        command: 'A slash command, optionally with arguments.',
        hook: 'A script that runs on a Claude Code event.',
        mcp: 'A server that gives Claude extra tools and data.',
      } as Record<ArtifactType, string>,
      /** `arg` is the install command for a plugin, the invoke command for skills and commands. */
      how: {
        plugin: (arg: string) => `Install it: \`${arg}\``,
        skill: (arg: string) => `Invoke by name, \`${arg}\`, or let Claude pick it from its description.`,
        agent: (_arg: string) => 'Claude delegates matching tasks. You can also ask for it by name.',
        command: (arg: string) => `Type it: \`${arg}\``,
        hook: (_arg: string) => 'Runs automatically once the plugin is installed.',
        mcp: (_arg: string) => 'Starts with the plugin. Set the env vars it needs, if the plugin page lists any.',
      } as Record<ArtifactType, (arg: string) => string>,
    },
    update: {
      pull: 'Pull the latest versions of every plugin in the marketplace:',
      remove: 'Remove a plugin:',
      seeBefore: 'See ',
      whatsNew: "What's new",
      seeAfter: ' for what changed in each release.',
    },
    problems: {
      aria: 'Common problems',
      colProblem: 'Problem',
      colCause: 'Cause',
      colFix: 'Fix',
      notFound: {
        problem: '“Marketplace not found”',
        cause: 'A typo in the repository path, or no access to it.',
        fix: (repo: string) => `Check the path \`${repo}\` and that you can open it on GitHub.`,
      },
      notRecognized: {
        problem: (invoke: string) => `\`${invoke}\` isn't recognized`,
        cause: "The plugin isn't installed, or the session started before the install.",
        fix: 'Install the plugin, then restart Claude Code.',
      },
      mcpFails: {
        problem: 'An MCP server fails to start',
        cause: "An environment variable it needs isn't set.",
        fix: 'Set the variables listed on the plugin page before starting Claude Code.',
      },
      blocked: {
        problem: 'A command is blocked',
        cause: 'A hook from an installed plugin matched its rule.',
        fix: 'Read the message the hook prints, fix the cause and run the command again.',
      },
    },
    authors: {
      text: 'Plugins live in the `plugins/` folder of the repository and are listed in `.claude-plugin/marketplace.json`. Open a pull request with your plugin. Validation runs on every build and its result appears as a badge on the plugin page.',
      link: 'Open the repository →',
    },
  },

  notFound: {
    title: 'Page not found',
    description: 'Nothing lives at this address.',
    text: 'Nothing lives at this address. If it was an artifact, it may have been renamed or removed in a recent release.',
    searchLabel: 'Search artifacts',
    placeholder: 'Search the catalog',
    submit: 'Search',
    guide: 'Read the guide →',
    back: 'Back to the catalog',
  },
} as const;

/** The same shape with plain `string`s, for other languages to implement. */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : T extends object
        ? { readonly [K in keyof T]: Widen<T[K]> }
        : T;
export type Dictionary = Widen<typeof t>;
