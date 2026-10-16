import { t } from '../i18n/en';
import type { Capability, PluginSecurity } from './types';

export interface SummaryItem {
  text: string;
  /** Flagged items use the warning colour; the rest stay neutral. */
  warn: boolean;
}

const CAPS: Capability[] = ['run-commands', 'write-files', 'network'];

/** Capabilities that at least one agent, skill or command has. */
export function broadCapabilities(sec: PluginSecurity): Capability[] {
  const have = new Set(sec.tools.flatMap((u) => u.broad.map((b) => b.capability)));
  return CAPS.filter((c) => have.has(c));
}

/** True when there is nothing to report (no hooks, MCP servers, broad tools or network use). */
export const isQuiet = (sec: PluginSecurity): boolean =>
  !sec.hooks.length && !sec.mcp.length && !broadCapabilities(sec).length && !sec.network.total;

/** The one-line summary: "Runs 2 hooks · starts 1 MCP server · ... · self-contained". */
export function securitySummary(sec: PluginSecurity): SummaryItem[] {
  const s = t.security;
  const caps = broadCapabilities(sec);
  return [
    { text: s.hooks(sec.hooks.length), warn: false },
    { text: s.mcp(sec.mcp.length), warn: false },
    ...(caps.length ? caps.map((c) => ({ text: s.capSummary[c], warn: true })) : [{ text: s.noBroad, warn: false }]),
    { text: s.network(sec.network.total), warn: sec.network.total > 0 },
    sec.outside.length ? { text: s.notSelfContained(sec.outside.length), warn: true } : { text: s.selfContained, warn: false },
  ];
}
