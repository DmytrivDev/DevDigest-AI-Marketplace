import MiniSearch from 'minisearch';
import type { ArtifactType } from '../lib/types';
import { typeOfWord } from './intent';
import { normalize, stem, tokenize } from './normalize';
import { STOP_WORDS } from './stopwords';
import synonymsUk from './synonyms.uk.json';

// Search pipeline (spec 6): normalize -> tokenize -> stop words -> type intent -> synonyms -> stemming,
// MiniSearch with field boosts, prefix and fuzzy matching.

export interface SearchDoc {
  id: string;
  name: string;
  tags: string;
  description: string;
  plugin: string;
  searchText: string;
}

export const BOOSTS = { name: 4, tags: 3, description: 2, plugin: 1.5, searchText: 1 } as const;
const SYNONYM_WEIGHT = 0.7;

/** Synonym keys are stored normalized; they are stemmed here so lookups work on stemmed query terms. */
const SYNONYMS: ReadonlyMap<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const [k, v] of Object.entries(synonymsUk as Record<string, string[]>)) {
    const key = stem(normalize(k));
    m.set(key, [...new Set([...(m.get(key) ?? []), ...v])]);
  }
  return m;
})();

export interface ParsedQuery {
  /** Terms left after stop words and type words, each with its synonym expansions. */
  groups: { term: string; synonyms: string[] }[];
  /** Type detected from the query (first type word wins). */
  qType: ArtifactType | null;
}

export function parseQuery(query: string): ParsedQuery {
  const groups: ParsedQuery['groups'] = [];
  let qType: ArtifactType | null = null;
  const seen = new Set<string>();
  for (const raw of tokenize(query)) {
    const type = typeOfWord(raw);
    if (type) {
      qType ??= type;
      continue;
    }
    if (STOP_WORDS.has(raw)) continue;
    const term = stem(raw);
    if (seen.has(term)) continue;
    seen.add(term);
    const syn = SYNONYMS.get(term) ?? [];
    groups.push({ term, synonyms: syn.flatMap((s) => tokenize(s)) });
  }
  return { groups, qType };
}

export interface SearchResult {
  /** Ranked ids, or null when the query had no searchable terms (everything matches). */
  ranked: { id: string; score: number }[] | null;
  qType: ArtifactType | null;
  /** Normalized terms to highlight (exact and prefix matches only). */
  highlight: string[];
}

export interface Engine {
  search(query: string): SearchResult;
}

export function createEngine(docs: SearchDoc[]): Engine {
  const index = new MiniSearch<SearchDoc>({
    fields: ['name', 'tags', 'description', 'plugin', 'searchText'],
    idField: 'id',
    tokenize: (text) => tokenize(text),
    processTerm: (term) => (STOP_WORDS.has(term) ? null : stem(term)),
    searchOptions: { boost: { ...BOOSTS }, prefix: true, fuzzy: (t) => (t.length >= 4 ? 0.2 : false), combineWith: 'OR' },
  });
  index.addAll(docs);

  return {
    search(query) {
      const { groups, qType } = parseQuery(query);
      if (!groups.length) return { ranked: null, qType, highlight: [] };
      const scores = new Map<string, number>();
      for (const g of groups) {
        const best = new Map<string, number>();
        const collect = (term: string, w: number) => {
          for (const hit of index.search(term)) {
            const sc = hit.score * w;
            if (sc > (best.get(hit.id) ?? 0)) best.set(hit.id, sc);
          }
        };
        collect(g.term, 1);
        // Synonyms expand a term that matched on its own (boost 0.7); for a foreign-language term with
        // no match of its own they act as its translation and count in full.
        const w = best.size ? SYNONYM_WEIGHT : 1;
        for (const syn of g.synonyms) collect(syn, w);
        for (const [id, s] of best) scores.set(id, (scores.get(id) ?? 0) + s);
      }
      const ranked = [...scores].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
      const highlight = [...new Set(groups.flatMap((g) => [g.term, ...g.synonyms]))];
      return { ranked, qType, highlight };
    },
  };
}

export const toSearchDoc = (a: { id: string; name: string; tags: string[]; description: string; plugin: string; searchText: string }): SearchDoc => ({
  id: a.id,
  name: a.name,
  tags: a.tags.join(' '),
  description: a.description,
  plugin: a.plugin,
  searchText: a.searchText,
});

/** Splits text into plain and highlighted parts. Prefix matches at word starts only; never fuzzy. */
export function splitHighlight(text: string, terms: string[]): { text: string; hit: boolean }[] {
  const clean = terms.filter(Boolean);
  if (!clean.length) return [{ text, hit: false }];
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${[...clean].sort((a, b) => b.length - a.length).map(esc).join('|')})`, 'giu');
  const out: { text: string; hit: boolean }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!m[0]) {
      re.lastIndex++;
      continue;
    }
    if (m.index > last) out.push({ text: text.slice(last, m.index), hit: false });
    out.push({ text: m[0], hit: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out.length ? out : [{ text, hit: false }];
}
