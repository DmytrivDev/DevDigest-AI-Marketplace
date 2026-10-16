import { islandStrings as t } from '../../i18n/en';
import { TYPE_LABEL, TYPE_PLURAL } from '../../lib/icons';
import { ALL_TYPES, type ArtifactType, type Freshness } from '../../lib/types';
import type { SearchResult } from '../../search/engine';
import type { CardItem } from './shared';

export type SortKey = 'relevance' | 'updated' | 'name';

export interface Filters {
  typeF: ArtifactType[];
  tagF: string[];
  freshF: Freshness[];
  plugF: string[];
  /** A type detected from the query that the user removed. */
  qTypeOff: ArtifactType | '';
}

export const emptyFilters = (): Filters => ({ typeF: [], tagF: [], freshF: [], plugF: [], qTypeOff: '' });

export interface Chip {
  key: string;
  label: string;
  aria: string;
  kind: 'qtype' | 'type' | 'fresh' | 'tag' | 'plugin';
  value: string;
}

export interface View {
  results: CardItem[];
  total: number;
  /** The type filter taken from the query, if still active. */
  qType: ArtifactType | null;
  /** Zero results with the automatic type filter: results are shown without it (spec 6.3). */
  fallbackType: ArtifactType | null;
  typeFacets: { type: ArtifactType; count: number; checked: boolean }[];
  tagFacets: { tag: string; count: number; checked: boolean }[];
  freshFacets: { value: Freshness; count: number; checked: boolean }[];
  /** Shown only when the catalog has more than one plugin. */
  pluginFacets: { plugin: string; count: number; checked: boolean }[];
  chips: Chip[];
  sort: SortKey;
  highlight: string[];
}

const freshLabel = (f: Freshness): string => t.fresh[f];
export { freshLabel };

/** "Updated" order with plugin cards first, so a plugin always leads its components. */
const byUpdated = (a: CardItem, b: CardItem): number =>
  Number(b.type === 'plugin') - Number(a.type === 'plugin') || b.ts - a.ts || a.name.localeCompare(b.name);

export function computeView(items: CardItem[], availableTypes: ArtifactType[], res: SearchResult | null, f: Filters, sortChoice: SortKey | ''): View {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ranked = res?.ranked ?? null;
  const pool: CardItem[] = ranked
    ? ranked.map((r) => byId.get(r.id)).filter((i): i is CardItem => !!i)
    : [...items].sort(byUpdated);

  const detected = res?.qType && availableTypes.includes(res.qType) && f.qTypeOff !== res.qType ? res.qType : null;
  const hasTagF = (x: CardItem) => !f.tagF.length || f.tagF.some((t) => x.tags.includes(t));
  const hasFreshF = (x: CardItem) => !f.freshF.length || (!!x.fresh && f.freshF.includes(x.fresh));
  const hasPlugF = (x: CardItem) => !f.plugF.length || f.plugF.includes(x.plugin);
  const typesFor = (qt: ArtifactType | null): ArtifactType[] => [...f.typeF, ...(qt && !f.typeF.includes(qt) ? [qt] : [])];
  const hasTypeF = (x: CardItem, types: ArtifactType[]) => !types.length || types.includes(x.type);

  let qType = detected;
  let types = typesFor(qType);
  let results = pool.filter((x) => hasTypeF(x, types) && hasTagF(x) && hasFreshF(x) && hasPlugF(x));
  let fallbackType: ArtifactType | null = null;
  if (!results.length && qType && !f.typeF.includes(qType)) {
    const alt = pool.filter((x) => hasTagF(x) && hasFreshF(x) && hasPlugF(x) && hasTypeF(x, f.typeF));
    if (alt.length) {
      fallbackType = qType;
      results = alt;
      qType = null;
      types = f.typeF;
    }
  }

  const sort: SortKey = sortChoice && (sortChoice !== 'relevance' || ranked) ? sortChoice : ranked ? 'relevance' : 'updated';
  if (sort === 'name') results = [...results].sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'updated') results = [...results].sort(byUpdated);

  const typeFacets = availableTypes.map((type) => ({
    type,
    count: pool.filter((x) => x.type === type && hasTagF(x) && hasFreshF(x) && hasPlugF(x)).length,
    checked: types.includes(type),
  }));
  const tagTotals = new Map<string, number>();
  items.forEach((i) => i.tags.forEach((t) => tagTotals.set(t, (tagTotals.get(t) ?? 0) + 1)));
  const allTags = [...tagTotals.keys()].sort((a, b) => tagTotals.get(b)! - tagTotals.get(a)! || a.localeCompare(b));
  const tagFacets = allTags.map((tag) => ({
    tag,
    count: pool.filter((x) => x.tags.includes(tag) && hasTypeF(x, types) && hasFreshF(x) && hasPlugF(x)).length,
    checked: f.tagF.includes(tag),
  }));
  const freshFacets = (['new', 'updated'] as Freshness[]).map((value) => ({
    value,
    count: pool.filter((x) => x.fresh === value && hasTypeF(x, types) && hasTagF(x) && hasPlugF(x)).length,
    checked: f.freshF.includes(value),
  }));
  const allPlugins = [...new Set(items.map((i) => i.plugin))].sort((a, b) => a.localeCompare(b));
  const pluginFacets = allPlugins.length > 1
    ? allPlugins.map((plugin) => ({
        plugin,
        count: pool.filter((x) => x.plugin === plugin && hasTypeF(x, types) && hasTagF(x) && hasFreshF(x)).length,
        checked: f.plugF.includes(plugin),
      }))
    : [];

  const chips: Chip[] = [];
  if (qType) chips.push({ key: 'q', kind: 'qtype', value: qType, label: t.home.chipTypeFromQuery(TYPE_LABEL[qType]), aria: t.home.chipRemove(t.home.chipType(TYPE_LABEL[qType])) });
  f.plugF.forEach((x) => chips.push({ key: `p-${x}`, kind: 'plugin', value: x, label: t.home.chipPlugin(x), aria: t.home.chipRemove(t.home.chipPlugin(x)) }));
  f.typeF.forEach((ty) => chips.push({ key: `t-${ty}`, kind: 'type', value: ty, label: t.home.chipType(TYPE_LABEL[ty]), aria: t.home.chipRemove(t.home.chipType(TYPE_LABEL[ty])) }));
  f.freshF.forEach((x) => chips.push({ key: `f-${x}`, kind: 'fresh', value: x, label: t.home.chipFreshness(freshLabel(x)), aria: t.home.chipRemove(t.home.chipFreshness(freshLabel(x))) }));
  f.tagF.forEach((tg) => chips.push({ key: `g-${tg}`, kind: 'tag', value: tg, label: t.home.chipTag(tg), aria: t.home.chipRemove(t.home.chipTag(tg)) }));

  return { results, total: items.length, qType, fallbackType, typeFacets, tagFacets, freshFacets, pluginFacets, chips, sort, highlight: res?.highlight ?? [] };
}

// ---------- URL state (spec 7.2): ?q=&type=skill,agent&plugin=x&tag=a,b&fresh=new&sort=name ----------

export interface UrlState {
  q: string;
  filters: Filters;
  sort: SortKey | '';
}

export function parseUrl(search: string, availableTypes: ArtifactType[], knownTags: string[], knownPlugins: string[] = []): UrlState {
  const p = new URLSearchParams(search);
  const list = (k: string) => (p.get(k) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const typeF = [...new Set(list('type'))].filter((t): t is ArtifactType => (ALL_TYPES as string[]).includes(t) && availableTypes.includes(t as ArtifactType));
  const tagF = [...new Set(list('tag'))].filter((t) => knownTags.includes(t));
  const freshF = [...new Set(list('fresh'))].filter((t): t is Freshness => t === 'new' || t === 'updated');
  const plugF = [...new Set(list('plugin'))].filter((x) => knownPlugins.includes(x));
  const s = p.get('sort');
  return {
    q: (p.get('q') ?? '').slice(0, 200),
    filters: { typeF, tagF, freshF, plugF, qTypeOff: '' },
    sort: s === 'relevance' || s === 'updated' || s === 'name' ? s : '',
  };
}

export function toSearch(state: UrlState): string {
  const p = new URLSearchParams();
  if (state.q.trim()) p.set('q', state.q.trim());
  if (state.filters.typeF.length) p.set('type', state.filters.typeF.join(','));
  if (state.filters.plugF.length) p.set('plugin', state.filters.plugF.join(','));
  if (state.filters.tagF.length) p.set('tag', state.filters.tagF.join(','));
  if (state.filters.freshF.length) p.set('fresh', state.filters.freshF.join(','));
  if (state.sort) p.set('sort', state.sort);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export { TYPE_PLURAL };
