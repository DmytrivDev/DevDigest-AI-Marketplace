import { TYPE_LABEL, TYPE_PLURAL } from '../../lib/icons';
import { ALL_TYPES, type ArtifactType, type Freshness } from '../../lib/types';
import type { SearchResult } from '../../search/engine';
import type { CardItem } from './shared';

export type SortKey = 'relevance' | 'updated' | 'name';

export interface Filters {
  typeF: ArtifactType[];
  tagF: string[];
  freshF: Freshness[];
  /** A type detected from the query that the user removed. */
  qTypeOff: ArtifactType | '';
}

export const emptyFilters = (): Filters => ({ typeF: [], tagF: [], freshF: [], qTypeOff: '' });

export interface Chip {
  key: string;
  label: string;
  aria: string;
  kind: 'qtype' | 'type' | 'fresh' | 'tag';
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
  chips: Chip[];
  sort: SortKey;
  highlight: string[];
}

const freshLabel = (f: Freshness): string => (f === 'new' ? 'New' : 'Updated');
export { freshLabel };

const byUpdated = (a: CardItem, b: CardItem): number => b.ts - a.ts || a.name.localeCompare(b.name);

export function computeView(items: CardItem[], availableTypes: ArtifactType[], res: SearchResult | null, f: Filters, sortChoice: SortKey | ''): View {
  const byId = new Map(items.map((i) => [i.id, i]));
  const ranked = res?.ranked ?? null;
  const pool: CardItem[] = ranked
    ? ranked.map((r) => byId.get(r.id)).filter((i): i is CardItem => !!i)
    : [...items].sort(byUpdated);

  const detected = res?.qType && availableTypes.includes(res.qType) && f.qTypeOff !== res.qType ? res.qType : null;
  const hasTagF = (x: CardItem) => !f.tagF.length || f.tagF.some((t) => x.tags.includes(t));
  const hasFreshF = (x: CardItem) => !f.freshF.length || (!!x.fresh && f.freshF.includes(x.fresh));
  const typesFor = (qt: ArtifactType | null): ArtifactType[] => [...f.typeF, ...(qt && !f.typeF.includes(qt) ? [qt] : [])];
  const hasTypeF = (x: CardItem, types: ArtifactType[]) => !types.length || types.includes(x.type);

  let qType = detected;
  let types = typesFor(qType);
  let results = pool.filter((x) => hasTypeF(x, types) && hasTagF(x) && hasFreshF(x));
  let fallbackType: ArtifactType | null = null;
  if (!results.length && qType && !f.typeF.includes(qType)) {
    const alt = pool.filter((x) => hasTagF(x) && hasFreshF(x) && hasTypeF(x, f.typeF));
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
    count: pool.filter((x) => x.type === type && hasTagF(x) && hasFreshF(x)).length,
    checked: types.includes(type),
  }));
  const tagTotals = new Map<string, number>();
  items.forEach((i) => i.tags.forEach((t) => tagTotals.set(t, (tagTotals.get(t) ?? 0) + 1)));
  const allTags = [...tagTotals.keys()].sort((a, b) => tagTotals.get(b)! - tagTotals.get(a)! || a.localeCompare(b));
  const tagFacets = allTags.map((tag) => ({
    tag,
    count: pool.filter((x) => x.tags.includes(tag) && hasTypeF(x, types) && hasFreshF(x)).length,
    checked: f.tagF.includes(tag),
  }));
  const freshFacets = (['new', 'updated'] as Freshness[]).map((value) => ({
    value,
    count: pool.filter((x) => x.fresh === value && hasTypeF(x, types) && hasTagF(x)).length,
    checked: f.freshF.includes(value),
  }));

  const chips: Chip[] = [];
  if (qType) chips.push({ key: 'q', kind: 'qtype', value: qType, label: `Type: ${TYPE_LABEL[qType]} (from query)`, aria: `Remove filter Type: ${TYPE_LABEL[qType]}` });
  f.typeF.forEach((t) => chips.push({ key: `t-${t}`, kind: 'type', value: t, label: `Type: ${TYPE_LABEL[t]}`, aria: `Remove filter Type: ${TYPE_LABEL[t]}` }));
  f.freshF.forEach((x) => chips.push({ key: `f-${x}`, kind: 'fresh', value: x, label: `Freshness: ${freshLabel(x)}`, aria: `Remove filter Freshness: ${freshLabel(x)}` }));
  f.tagF.forEach((t) => chips.push({ key: `g-${t}`, kind: 'tag', value: t, label: `Tag: ${t}`, aria: `Remove filter Tag: ${t}` }));

  return { results, total: items.length, qType, fallbackType, typeFacets, tagFacets, freshFacets, chips, sort, highlight: res?.highlight ?? [] };
}

// ---------- URL state (spec 7.2): ?q=&type=skill,agent&tag=a,b&fresh=new&sort=name ----------

export interface UrlState {
  q: string;
  filters: Filters;
  sort: SortKey | '';
}

export function parseUrl(search: string, availableTypes: ArtifactType[], knownTags: string[]): UrlState {
  const p = new URLSearchParams(search);
  const list = (k: string) => (p.get(k) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const typeF = [...new Set(list('type'))].filter((t): t is ArtifactType => (ALL_TYPES as string[]).includes(t) && availableTypes.includes(t as ArtifactType));
  const tagF = [...new Set(list('tag'))].filter((t) => knownTags.includes(t));
  const freshF = [...new Set(list('fresh'))].filter((t): t is Freshness => t === 'new' || t === 'updated');
  const s = p.get('sort');
  return {
    q: (p.get('q') ?? '').slice(0, 200),
    filters: { typeF, tagF, freshF, qTypeOff: '' },
    sort: s === 'relevance' || s === 'updated' || s === 'name' ? s : '',
  };
}

export function toSearch(state: UrlState): string {
  const p = new URLSearchParams();
  if (state.q.trim()) p.set('q', state.q.trim());
  if (state.filters.typeF.length) p.set('type', state.filters.typeF.join(','));
  if (state.filters.tagF.length) p.set('tag', state.filters.tagF.join(','));
  if (state.filters.freshF.length) p.set('fresh', state.filters.freshF.join(','));
  if (state.sort) p.set('sort', state.sort);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export { TYPE_PLURAL };
