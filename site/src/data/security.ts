import type { Capability, HookUse, McpUse, NetworkHit, OutsideRef, PluginSecurity, ToolUse } from '../lib/types';
import { join, type Component, type FileSource, type Manifest } from './discover';
import { asString, asStringList, parseJson } from './frontmatter';

// Plugin security panel: static analysis of the plugin's files. It reports what the files say,
// it does not prove what the plugin does at run time.

export const MAX_NETWORK_HITS = 20;
const MAX_SCAN_BYTES = 256 * 1024;
const MAX_LINE = 160;

const NETWORK_PATTERNS: RegExp[] = [
  /\b(?:curl|wget)\b/i,
  /\bfetch\s*\(/,
  /https?:\/\//i,
  /\bInvoke-(?:WebRequest|RestMethod)\b/i,
  /\bnet\.request\b/,
  /\b(?:https?|axios|got)\.(?:get|post|put|request)\s*\(/,
  /\bXMLHttpRequest\b|\bWebSocket\s*\(/,
];
const isNetworkLine = (s: string): boolean => NETWORK_PATTERNS.some((re) => re.test(s));

/** Splits "Read, Bash(git diff:*), Write" on commas outside parentheses; also accepts a YAML list. */
export function splitTools(value: unknown): string[] {
  const list = Array.isArray(value) ? value.map((v) => asString(v)) : [asString(value)];
  const out: string[] = [];
  for (const item of list) {
    let depth = 0;
    let cur = '';
    for (const ch of item) {
      if (ch === '(') depth++;
      if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) {
        if (cur.trim()) out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
  }
  return out;
}

/** Which broad capability a tool grants, if any. `Bash(git diff:*)` is scoped, so it is not broad. */
export function broadCapability(tool: string): Capability | null {
  const m = /^([A-Za-z_]+)(?:\((.*)\))?$/.exec(tool.trim());
  if (!m) return null;
  const [, name, pattern] = m;
  if (name === 'Bash' || name === 'PowerShell') return pattern === undefined || pattern === '' || pattern === '*' || pattern === ':*' ? 'run-commands' : null;
  if (name === 'Write' || name === 'Edit' || name === 'MultiEdit' || name === 'NotebookEdit') return 'write-files';
  if (name === 'WebFetch' || name === 'WebSearch') return 'network';
  return null;
}

const ALL_CAPS: Capability[] = ['run-commands', 'write-files', 'network'];

function toolUses(components: Component[]): ToolUse[] {
  const out: ToolUse[] = [];
  for (const c of components) {
    if (c.type !== 'skill' && c.type !== 'agent' && c.type !== 'command') continue;
    const field = c.type === 'agent' ? c.frontmatter.tools : c.frontmatter['allowed-tools'];
    const tools = splitTools(field);
    const inheritsAll = c.type === 'agent' && field === undefined;
    if (!tools.length && !inheritsAll) continue;
    const broad = inheritsAll
      ? ALL_CAPS.map((capability) => ({ tool: '*', capability }))
      : tools.flatMap((tool) => {
          const capability = broadCapability(tool);
          return capability ? [{ tool, capability }] : [];
        });
    out.push({ type: c.type, name: c.name, slug: c.slug, tools, inheritsAll, broad });
  }
  return out;
}

function readJsonField(src: FileSource, pluginDir: string, field: unknown, defaultFile: string): { file: string; raw: unknown } | null {
  if (field && typeof field === 'object' && !Array.isArray(field)) return { file: `${pluginDir}/.claude-plugin/plugin.json`, raw: field };
  const p = typeof field === 'string' ? join(pluginDir, field) : `${pluginDir}/${defaultFile}`;
  const text = p ? src.read(p) : null;
  if (!p || text == null) return null;
  try {
    return { file: p, raw: parseJson(text, p) };
  } catch {
    return null;
  }
}

function hookUses(src: FileSource, pluginDir: string, manifest: Manifest): HookUse[] {
  const found = readJsonField(src, pluginDir, manifest.hooks, 'hooks/hooks.json');
  if (!found) return [];
  const root = (found.raw as { hooks?: unknown })?.hooks ?? found.raw;
  if (!root || typeof root !== 'object') return [];
  const out: HookUse[] = [];
  for (const [event, groups] of Object.entries(root as Record<string, unknown>)) {
    if (!Array.isArray(groups)) continue;
    for (const g of groups as { matcher?: unknown; hooks?: unknown }[]) {
      const hooks = Array.isArray(g?.hooks) ? (g.hooks as Record<string, unknown>[]) : [];
      for (const h of hooks) {
        const command = asString(h?.command);
        if (!command) continue;
        out.push({
          event,
          matcher: asString(g?.matcher).trim(),
          command,
          args: asStringList(h.args),
          form: Array.isArray(h.args) ? 'exec' : 'shell',
          file: found.file,
        });
      }
    }
  }
  return out;
}

function mcpUses(src: FileSource, pluginDir: string, manifest: Manifest): McpUse[] {
  const found = readJsonField(src, pluginDir, manifest.mcpServers, '.mcp.json');
  if (!found) return [];
  const servers = (found.raw as { mcpServers?: unknown })?.mcpServers ?? found.raw;
  if (!servers || typeof servers !== 'object') return [];
  return Object.entries(servers as Record<string, Record<string, unknown>>).map(([name, def]) => {
    const d = def && typeof def === 'object' ? def : {};
    const command = asString(d.command);
    const url = asString(d.url);
    const kind: McpUse['kind'] = command ? 'process' : url ? 'remote' : 'unknown';
    return {
      name,
      kind,
      command,
      args: asStringList(d.args),
      url,
      envNames: d.env && typeof d.env === 'object' ? Object.keys(d.env as object).sort() : [],
      file: found.file,
    };
  });
}

function scanText(file: string, text: string, hits: NetworkHit[]): void {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (isNetworkLine(lines[i])) hits.push({ file, line: i + 1, text: lines[i].trim().slice(0, MAX_LINE) });
  }
}

function networkHits(src: FileSource, pluginDir: string, hooks: HookUse[]): { hits: NetworkHit[]; total: number } {
  const all: NetworkHit[] = [];
  for (const f of src.list(`${pluginDir}/`)) {
    if (!/\/scripts\//.test(f.slice(pluginDir.length))) continue;
    const text = src.read(f);
    if (text == null || text.length > MAX_SCAN_BYTES || text.includes('\0')) continue;
    scanText(f, text, all);
  }
  for (const h of hooks) {
    const line = [h.command, ...h.args].join(' ');
    if (!isNetworkLine(line)) continue;
    const idx = (src.read(h.file) ?? '').split(/\r?\n/).findIndex((l) => l.includes(h.command));
    all.push({ file: h.file, line: idx < 0 ? 1 : idx + 1, text: line.slice(0, MAX_LINE) });
  }
  return { hits: all.slice(0, MAX_NETWORK_HITS), total: all.length };
}

/** `..` or an absolute / home path. `${CLAUDE_PLUGIN_ROOT}` is the plugin directory and is fine. */
export function leavesPlugin(token: string): 'parent' | 'absolute' | null {
  let v = token.replace(/^--?[\w-]+=/, '').replace(/^["']|["']$/g, '');
  if (v.length < 3 || v.includes('://')) return null;
  v = v.split('${CLAUDE_PLUGIN_ROOT}').join('ROOT');
  if (v.split(/[\\/]/).includes('..')) return 'parent';
  if (/^(?:[\\/]|~|[A-Za-z]:[\\/]|\$HOME\b|\$\{HOME\})/.test(v)) return 'absolute';
  return null;
}

function outsideRefs(manifest: Manifest, hooks: HookUse[], mcp: McpUse[], pluginDir: string): OutsideRef[] {
  const out: OutsideRef[] = [];
  const check = (file: string, value: string): void => {
    for (const token of value.split(/\s+/)) {
      const reason = leavesPlugin(token);
      if (reason) out.push({ file, ref: token.slice(0, MAX_LINE), reason });
    }
  };
  const manifestFile = `${pluginDir}/.claude-plugin/plugin.json`;
  for (const key of ['skills', 'agents', 'commands', 'hooks', 'mcpServers'] as const) {
    const v = manifest[key];
    for (const p of typeof v === 'string' ? [v] : Array.isArray(v) ? asStringList(v) : []) {
      const reason = leavesPlugin(p) ?? (/^[\\/]|^[A-Za-z]:[\\/]/.test(p) ? 'absolute' : null);
      if (reason) out.push({ file: manifestFile, ref: p, reason });
    }
  }
  for (const h of hooks) check(h.file, [h.command, ...h.args].join(' '));
  for (const m of mcp) check(m.file, [m.command, ...m.args].join(' '));
  const seen = new Set<string>();
  return out.filter((o) => {
    const k = `${o.file}|${o.ref}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function analyzePluginSecurity(src: FileSource, pluginDir: string, manifest: Manifest, components: Component[]): PluginSecurity {
  const hooks = hookUses(src, pluginDir, manifest);
  const mcp = mcpUses(src, pluginDir, manifest);
  return {
    hooks,
    mcp,
    tools: toolUses(components),
    network: networkHits(src, pluginDir, hooks),
    outside: outsideRefs(manifest, hooks, mcp, pluginDir),
  };
}
