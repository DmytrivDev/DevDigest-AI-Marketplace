import { describe, expect, it } from 'vitest';
import { computeView, emptyFilters, parseUrl, toSearch } from '../src/components/home/view';
import type { CardItem } from '../src/components/home/shared';
import { createEngine, parseQuery, splitHighlight, toSearchDoc } from '../src/search/engine';
import { typeOfWord } from '../src/search/intent';
import { normalize, stem, tokenize } from '../src/search/normalize';
import { STOP_WORDS } from '../src/search/stopwords';
import synonyms from '../src/search/synonyms.uk.json';
import { ALL_TYPES, type ArtifactType } from '../src/lib/types';
import { protoCatalog } from './helpers/fixtures';

// Golden queries run on the prototype fixture (TEST-ONLY data), as the spec allows until the repository has a review skill.
const catalog = protoCatalog();
const comps = catalog.artifacts.filter((a) => a.type !== 'plugin');
const engine = createEngine(comps.map(toSearchDoc));
const items: CardItem[] = comps.map((a) => ({
  id: a.id,
  type: a.type,
  name: a.name,
  description: a.description,
  tags: a.tags,
  plugin: a.plugin,
  href: '#',
  pluginHref: '#',
  date: '',
  ts: Date.parse(a.updatedAt ?? ''),
  fresh: a.freshness,
  cmd: a.invoke ?? '',
}));
const types = ALL_TYPES.filter((t) => items.some((i) => i.type === t));

/** Ids in the order the home page would show them for `query` (type filter from the query applied). */
function run(query: string): string[] {
  const view = computeView(items, types, engine.search(query), emptyFilters(), '');
  return view.results.map((r) => r.id);
}

describe('golden queries (spec 14)', () => {
  const cases: [string, string][] = [
    ['I need a skill for PR review', 'devdigest:skill:review'],
    ['review pull request', 'devdigest:skill:review'],
    ["Мені треба скіл для рев'ю PR", 'devdigest:skill:review'],
    ['ревю', 'devdigest:skill:review'],
    ['security agent', 'devdigest:agent:security-reviewer'],
    ['агент для безпеки', 'devdigest:agent:security-reviewer'],
    ['revew', 'devdigest:skill:review'],
    ['pre-commit hook', 'devdigest:hook:pre-tool-use-bash'],
  ];
  for (const [q, id] of cases) {
    it(`"${q}" -> ${id} in the top 3`, () => {
      expect(run(q).slice(0, 3)).toContain(id);
    });
  }
  it('"I need a skill for PR review" ranks the review skill first with a type chip', () => {
    const view = computeView(items, types, engine.search('I need a skill for PR review'), emptyFilters(), '');
    expect(view.results[0].id).toBe('devdigest:skill:review');
    expect(view.chips[0]).toMatchObject({ kind: 'qtype', label: 'Type: Skill (from query)' });
  });
  it('the Ukrainian query gives the same type chip', () => {
    const view = computeView(items, types, engine.search("Мені треба скіл для рев'ю PR"), emptyFilters(), '');
    expect(view.qType).toBe('skill');
    expect(view.results[0].id).toBe('devdigest:skill:review');
  });
  it('falls back without the automatic type filter when it gives no results (6.3)', () => {
    // "hook" is detected as a type, and no hook mentions dependencies.
    const view = computeView(items, types, engine.search('dependencies hook'), emptyFilters(), '');
    expect(view.fallbackType).toBe('hook');
    expect(view.results.length).toBeGreaterThan(0);
    expect(view.results.every((r) => r.type !== 'hook' || r.name !== '')).toBe(true);
  });
  it('a query with no match gives no results', () => {
    expect(run('terraform drift detector')).toEqual([]);
  });
});

describe('normalization', () => {
  it('lowercases, NFKC and strips apostrophes', () => {
    expect(normalize("Рев'ю")).toBe('ревю');
    expect(normalize('Рев’ю')).toBe('ревю');
    expect(normalize('ЁЖ')).toBe('еж');
    expect(normalize('ＡＢＣ')).toBe('abc');
  });
  it('tokenizes on Unicode boundaries and splits compounds', () => {
    expect(tokenize('pull-request, PR!')).toEqual(['pull-request', 'pull', 'request', 'pr']);
    expect(tokenize('агент для безпеки')).toEqual(['агент', 'для', 'безпеки']);
  });
  it('stems Cyrillic only, keeping at least 3 characters', () => {
    expect(stem('безпеки')).toBe('безпек');
    expect(stem('агента')).toBe('агент');
    expect(stem('ліс')).toBe('ліс');
    expect(stem('reviews')).toBe('reviews');
  });
  it('drops EN and UK stop words', () => {
    expect(STOP_WORDS.has('the')).toBe(true);
    expect(STOP_WORDS.has('мені')).toBe(true);
    expect(parseQuery('I need a skill for the review').groups.map((g) => g.term)).toEqual(['review']);
  });
  it('detects the type from either language', () => {
    expect(typeOfWord('skills')).toBe('skill');
    expect(typeOfWord('скіла')).toBe('skill');
    expect(typeOfWord('агенти')).toBe('agent');
    expect(typeOfWord('хук')).toBe('hook');
    expect(typeOfWord('review')).toBeNull();
    expect(parseQuery('security agent').qType).toBe('agent');
  });
});

describe('synonyms.uk.json', () => {
  it('is a flat { term: [en...] } object with normalized keys and no duplicates after stemming', () => {
    const seen = new Set<string>();
    for (const [k, v] of Object.entries(synonyms as Record<string, string[]>)) {
      expect(k).toBe(normalize(k));
      expect(Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x === x.toLowerCase())).toBe(true);
      const key = stem(k);
      expect(seen.has(key), `duplicate key ${k}`).toBe(false);
      seen.add(key);
    }
    expect(Object.keys(synonyms).length).toBeGreaterThanOrEqual(50);
  });
});

describe('highlighting', () => {
  it('marks prefix matches at word starts and never fuzzy ones', () => {
    expect(splitHighlight('Reviews a pull request', ['review'])).toEqual([
      { text: 'Review', hit: true },
      { text: 's a pull request', hit: false },
    ]);
    expect(splitHighlight('Reviews a pull request', ['revew'])).toEqual([{ text: 'Reviews a pull request', hit: false }]);
    expect(splitHighlight('xreview', ['review'])).toEqual([{ text: 'xreview', hit: false }]);
  });
});

describe('facets and URL state', () => {
  it('counts facets over the query and the other groups', () => {
    const view = computeView(items, types, null, { ...emptyFilters(), tagF: ['review'] }, '');
    const count = (t: ArtifactType) => view.typeFacets.find((f) => f.type === t)!.count;
    expect(count('skill')).toBe(1);
    expect(count('agent')).toBe(3);
    expect(view.results).toHaveLength(4);
  });
  it('sorts by updated and by name', () => {
    const byUpdated = computeView(items, types, null, emptyFilters(), 'updated').results;
    expect(byUpdated[0].ts).toBeGreaterThanOrEqual(byUpdated[byUpdated.length - 1].ts);
    const byName = computeView(items, types, null, emptyFilters(), 'name').results.map((r) => r.name);
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)));
  });
  it('round-trips and ignores unknown parameters', () => {
    const s = parseUrl('?q=hello&type=skill,agent,bogus&tag=review,nope&fresh=new&sort=name&x=1', types, ['review']);
    expect(s.filters.typeF).toEqual(['skill', 'agent']);
    expect(s.filters.tagF).toEqual(['review']);
    expect(s.filters.freshF).toEqual(['new']);
    expect(toSearch(s)).toBe('?q=hello&type=skill%2Cagent&tag=review&fresh=new&sort=name');
    expect(toSearch(parseUrl('', types, []))).toBe('');
  });
  it('shows a plugin facet only with more than one plugin', () => {
    expect(computeView(items, types, null, emptyFilters(), '').pluginFacets).toEqual([]);
    const other: CardItem = { ...items[0], id: 'other:plugin:other', type: 'plugin', name: 'other', plugin: 'other', tags: [] };
    const all = [...items, other];
    const allTypes = ALL_TYPES.filter((t) => all.some((i) => i.type === t));
    const view = computeView(all, allTypes, null, { ...emptyFilters(), plugF: ['other'] }, '');
    expect(view.pluginFacets.map((f) => [f.plugin, f.count])).toEqual([['devdigest', items.length], ['other', 1]]);
    expect(view.results.map((r) => r.id)).toEqual(['other:plugin:other']);
    expect(view.chips.map((c) => c.label)).toContain('Plugin: other');
  });
  it('lists plugin cards first and offers Plugins as the first type', () => {
    const plugin: CardItem = { ...items[0], id: 'devdigest:plugin:devdigest', type: 'plugin', name: 'devdigest', ts: 0 };
    const all = [...items, plugin];
    const allTypes = ALL_TYPES.filter((t) => all.some((i) => i.type === t));
    const view = computeView(all, allTypes, null, emptyFilters(), '');
    expect(view.results[0].id).toBe(plugin.id);
    expect(view.typeFacets[0]).toMatchObject({ type: 'plugin', count: 1 });
    const only = computeView(all, allTypes, null, { ...emptyFilters(), typeF: ['plugin'] }, '');
    expect(only.results.map((r) => r.type)).toEqual(['plugin']);
  });
  it('round-trips the plugin filter and drops unknown plugins', () => {
    const s = parseUrl('?plugin=other,ghost', types, [], ['devdigest', 'other']);
    expect(s.filters.plugF).toEqual(['other']);
    expect(toSearch(s)).toBe('?plugin=other');
  });
});
