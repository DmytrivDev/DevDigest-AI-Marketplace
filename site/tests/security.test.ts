import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildCatalog } from '../src/data/build-catalog';
import { discoverComponents } from '../src/data/discover';
import { analyzePluginSecurity, broadCapability, leavesPlugin, splitTools } from '../src/data/security';
import { fsSource } from '../src/data/sources';
import { isQuiet, securitySummary } from '../src/lib/security-summary';
import { writeFileIn } from './helpers/repo';

// Plugin security panel: static analysis over a throwaway repository.

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'dd-sec-'));
  dirs.push(root);
  writeFileIn(root, '.claude-plugin/marketplace.json', JSON.stringify({ name: 'mk', plugins: [{ name: 'p', source: './plugins/p' }] }));
  writeFileIn(root, 'plugins/p/.claude-plugin/plugin.json', files['.claude-plugin/plugin.json'] ?? JSON.stringify({ name: 'p', version: '1.0.0' }));
  for (const [path, text] of Object.entries(files)) if (path !== '.claude-plugin/plugin.json') writeFileIn(root, `plugins/p/${path}`, text);
  return root;
}

function analyze(files: Record<string, string>) {
  const root = repo(files);
  const src = fsSource(root);
  const manifest = JSON.parse(src.read('plugins/p/.claude-plugin/plugin.json')!);
  return analyzePluginSecurity(src, 'plugins/p', manifest, discoverComponents(src, 'plugins/p', manifest));
}

const hooksJson = (hooks: unknown): string => JSON.stringify({ hooks });
const agent = (tools: string | null): string => `---\nname: a\ndescription: d\n${tools === null ? '' : `tools: ${tools}\n`}---\nbody\n`;

describe('hooks', () => {
  it('reports event, matcher, command and args, and tells exec form from a shell string', () => {
    const sec = analyze({
      'hooks/hooks.json': hooksJson({
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/scripts/check.js'] }] }],
        SessionStart: [{ hooks: [{ type: 'command', command: 'echo hi && date' }] }],
      }),
    });
    expect(sec.hooks).toEqual([
      { event: 'PreToolUse', matcher: 'Bash', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/scripts/check.js'], form: 'exec', file: 'plugins/p/hooks/hooks.json' },
      { event: 'SessionStart', matcher: '', command: 'echo hi && date', args: [], form: 'shell', file: 'plugins/p/hooks/hooks.json' },
    ]);
    expect(sec.outside).toEqual([]);
  });

  it('reads hooks written inline in plugin.json', () => {
    const sec = analyze({ '.claude-plugin/plugin.json': JSON.stringify({ name: 'p', version: '1.0.0', hooks: { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'true', args: [] }] }] } } }) });
    expect(sec.hooks).toHaveLength(1);
    expect(sec.hooks[0]).toMatchObject({ event: 'Stop', form: 'exec', file: 'plugins/p/.claude-plugin/plugin.json' });
  });
});

describe('MCP servers', () => {
  it('lists a process with its command and args, and environment variable names only', () => {
    const sec = analyze({ '.mcp.json': JSON.stringify({ mcpServers: { local: { command: 'npx', args: ['-y', 'srv'], env: { TOKEN: 'super-secret', API_URL: 'x' } } } }) });
    expect(sec.mcp).toEqual([{ name: 'local', kind: 'process', command: 'npx', args: ['-y', 'srv'], url: '', envNames: ['API_URL', 'TOKEN'], file: 'plugins/p/.mcp.json' }]);
    expect(JSON.stringify(sec)).not.toContain('super-secret');
  });

  it('lists a remote server by URL', () => {
    const sec = analyze({ '.mcp.json': JSON.stringify({ mcpServers: { remote: { type: 'http', url: 'https://mcp.example.com/sse' } } }) });
    expect(sec.mcp[0]).toMatchObject({ name: 'remote', kind: 'remote', url: 'https://mcp.example.com/sse', command: '', envNames: [] });
  });
});

describe('tools', () => {
  it('splits on commas outside parentheses', () => {
    expect(splitTools('Read, Bash(git diff:*, git log), Write')).toEqual(['Read', 'Bash(git diff:*, git log)', 'Write']);
    expect(splitTools(['Read', 'Edit'])).toEqual(['Read', 'Edit']);
  });

  it('flags a bare Bash, Write, Edit and WebFetch but not a scoped Bash', () => {
    expect(broadCapability('Bash')).toBe('run-commands');
    expect(broadCapability('Bash(*)')).toBe('run-commands');
    expect(broadCapability('Bash(git diff:*)')).toBeNull();
    expect(broadCapability('Write')).toBe('write-files');
    expect(broadCapability('Edit')).toBe('write-files');
    expect(broadCapability('WebFetch')).toBe('network');
    expect(broadCapability('Read')).toBeNull();
  });

  it('reads agent tools and skill allowed-tools', () => {
    const sec = analyze({
      'agents/a.md': agent('Read, Bash, Write'),
      'skills/s/SKILL.md': '---\nname: s\ndescription: d\nallowed-tools: Read, Bash(git diff:*), WebFetch\n---\nbody\n',
    });
    const a = sec.tools.find((u) => u.type === 'agent')!;
    expect(a.broad.map((b) => b.capability)).toEqual(['run-commands', 'write-files']);
    const s = sec.tools.find((u) => u.type === 'skill')!;
    expect(s.tools).toEqual(['Read', 'Bash(git diff:*)', 'WebFetch']);
    expect(s.broad).toEqual([{ tool: 'WebFetch', capability: 'network' }]);
  });

  it('treats an agent without a tools field as having every tool', () => {
    const [u] = analyze({ 'agents/a.md': agent(null) }).tools;
    expect(u.inheritsAll).toBe(true);
    expect(u.broad.map((b) => b.capability)).toEqual(['run-commands', 'write-files', 'network']);
  });
});

describe('network use', () => {
  it('finds indicators in scripts and hook commands with file and line, capped at 20', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `curl https://example.com/${i}`);
    const sec = analyze({
      'scripts/a.sh': ['#!/bin/sh', 'echo ok', 'wget http://x.test/file'].join('\n'),
      'skills/s/scripts/b.mjs': 'const r = await fetch(url);\n',
      'scripts/many.sh': lines.join('\n'),
      'scripts/clean.sh': 'echo nothing here\n',
      'hooks/hooks.json': hooksJson({ Stop: [{ hooks: [{ type: 'command', command: 'curl -s https://hooks.example.com' }] }] }),
    });
    expect(sec.network.total).toBe(33); // a.sh 1, b.mjs 1, many.sh 30, the hook command 1
    expect(sec.network.hits).toHaveLength(20);
    expect(sec.network.hits[0]).toEqual({ file: 'plugins/p/scripts/a.sh', line: 3, text: 'wget http://x.test/file' });
  });

  it('finds nothing in a clean plugin', () => {
    const sec = analyze({ 'scripts/ok.sh': 'echo hi\n' });
    expect(sec.network).toEqual({ hits: [], total: 0 });
    expect(isQuiet(sec)).toBe(true);
  });

  it('records the line of a hook command', () => {
    const sec = analyze({ 'hooks/hooks.json': hooksJson({ Stop: [{ hooks: [{ type: 'command', command: 'wget', args: ['https://x.test'] }] }] }) });
    expect(sec.network.hits).toHaveLength(1);
    expect(sec.network.hits[0]).toMatchObject({ file: 'plugins/p/hooks/hooks.json', text: 'wget https://x.test' });
  });
});

describe('self-contained', () => {
  it('allows ${CLAUDE_PLUGIN_ROOT} and plain relative commands', () => {
    expect(leavesPlugin('${CLAUDE_PLUGIN_ROOT}/scripts/x.js')).toBeNull();
    expect(leavesPlugin('node')).toBeNull();
    expect(leavesPlugin('https://example.com/a')).toBeNull();
  });

  it('flags .. and absolute paths in hooks, MCP servers and manifest paths', () => {
    expect(leavesPlugin('${CLAUDE_PLUGIN_ROOT}/../other/x.js')).toBe('parent');
    expect(leavesPlugin('/usr/local/bin/tool')).toBe('absolute');
    expect(leavesPlugin('C:\\tools\\x.exe')).toBe('absolute');
    expect(leavesPlugin('--config=~/x.json')).toBe('absolute');
    const sec = analyze({
      '.claude-plugin/plugin.json': JSON.stringify({ name: 'p', version: '1.0.0', skills: '../shared/skills' }),
      'hooks/hooks.json': hooksJson({ Stop: [{ hooks: [{ type: 'command', command: '/opt/run.sh', args: [] }] }] }),
      '.mcp.json': JSON.stringify({ mcpServers: { s: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/../srv.js'] } } }),
    });
    expect(sec.outside.map((o) => `${o.ref}:${o.reason}`)).toEqual(['../shared/skills:parent', '/opt/run.sh:absolute', '${CLAUDE_PLUGIN_ROOT}/../srv.js:parent']);
  });
});

describe('summary', () => {
  it('builds the one-line summary and flags only the risky parts', () => {
    const sec = analyze({
      'hooks/hooks.json': hooksJson({ Stop: [{ hooks: [{ type: 'command', command: 'node', args: ['a.js'] }] }] }),
      '.mcp.json': JSON.stringify({ mcpServers: { s: { command: 'node', args: ['s.js'] } } }),
      'agents/a.md': agent('Read, Bash'),
    });
    const items = securitySummary(sec);
    expect(items.map((i) => i.text).join(' · ')).toBe('Runs 1 hook · starts 1 MCP server · agents or skills can run shell commands · no network calls found · self-contained');
    expect(items.filter((i) => i.warn).map((i) => i.text)).toEqual(['agents or skills can run shell commands']);
    expect(isQuiet(sec)).toBe(false);
  });
});

describe('catalog integration', () => {
  it('exposes the analysis as details.security on the plugin only', () => {
    const root = repo({ 'agents/a.md': agent('Read, Write') });
    const { catalog } = buildCatalog({ root, commit: 'c'.repeat(40), generatedAt: '2026-10-01T00:00:00Z', repo: 'o/r', updatedAt: () => null });
    const plugin = catalog.artifacts.find((a) => a.type === 'plugin')!;
    expect(plugin.details.security?.tools[0].broad[0].capability).toBe('write-files');
    expect(catalog.artifacts.filter((a) => a.type !== 'plugin').every((a) => a.details.security === undefined)).toBe(true);
  });
});
