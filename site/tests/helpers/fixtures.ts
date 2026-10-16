import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyFreshness } from '../../src/data/freshness';
import type { Catalog, Changelog, Stats } from '../../src/lib/types';
import { PROTOTYPE } from './repo';

const json = <T>(f: string): T => JSON.parse(readFileSync(join(PROTOTYPE, f), 'utf8')) as T;

/** The design prototype's data (TEST-ONLY). */
export const protoChangelog = (): Changelog => json<Changelog>('changelog.json');
export const protoCatalog = (): Catalog => applyFreshness(json<Catalog>('catalog.json'), protoChangelog());
export const protoStats = (): Stats => json<Stats>('stats.json');
