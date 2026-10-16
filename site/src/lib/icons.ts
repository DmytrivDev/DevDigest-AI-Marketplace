import { t } from '../i18n/en';
import type { ArtifactType } from './types';

/** Type names live in src/i18n/en.ts; re-exported here for convenience. */
export const TYPE_LABEL: Record<ArtifactType, string> = t.types.label;
export const TYPE_PLURAL: Record<ArtifactType, string> = t.types.plural;

/** 16x16 stroke icons, taken from the design prototype. */
export const ICON: Record<ArtifactType, string> = {
  plugin: 'M2.5 4.75 8 2l5.5 2.75v6.5L8 14l-5.5-2.75zM2.5 4.75 8 7.5l5.5-2.75M8 7.5V14',
  skill: 'M9 1.5 3.5 9H8l-1 5.5L12.5 7H8z',
  agent: 'M8 2a2.6 2.6 0 1 1 0 5.2A2.6 2.6 0 0 1 8 2zM2.75 14c.4-2.9 2.5-4.6 5.25-4.6s4.85 1.7 5.25 4.6',
  command: 'M2.5 2.5h11v11h-11zM9.75 5 6.25 11',
  hook: 'M10.5 1.75v8a3.25 3.25 0 0 1-6.5 0V7.5l2 2',
  mcp: 'M5.5 1.5v3M10.5 1.5v3M3.5 4.5h9v2.75a4.5 4.5 0 0 1-9 0zM8 11.75v2.75',
};

export const IC_CHECK = 'M3 8.5 6.5 12 13 4.5';
export const IC_X = 'M4.5 4.5l7 7M11.5 4.5l-7 7';
export const IC_Q =
  'M8 1.75a6.25 6.25 0 1 0 0 12.5 6.25 6.25 0 0 0 0-12.5zM6.25 6.25a1.8 1.8 0 1 1 2.4 1.7c-.45.17-.65.5-.65.95v.35M8 11.25v.25';
