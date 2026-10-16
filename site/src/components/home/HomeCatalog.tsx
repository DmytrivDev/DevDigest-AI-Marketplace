import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ICON, TYPE_PLURAL } from '../../lib/icons';
import { pluralize } from '../../lib/format';
import type { ArtifactType, Catalog } from '../../lib/types';
import { createEngine, toSearchDoc, type Engine } from '../../search/engine';
import { Card } from './Card';
import { FreshBadge, TypeBadge, type CardItem } from './shared';
import { computeView, emptyFilters, freshLabel, parseUrl, toSearch, type Filters, type SortKey } from './view';

export interface HomeProps {
  items: CardItem[];
  availableTypes: ArtifactType[];
  hasComponents: boolean;
  commit: string;
  catalogUrl: string;
  whatsNewUrl: string;
  issueUrl: string;
  examples: string[];
  freshDays: number;
  noComponentsNote: string;
}

type Load = 'loading' | 'ready' | 'error';
const TAGS_SHOWN = 10;

export default function HomeCatalog(props: HomeProps) {
  const { items, availableTypes, hasComponents } = props;
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(emptyFilters());
  const [sortChoice, setSortChoice] = useState<SortKey | ''>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tagsAll, setTagsAll] = useState(false);
  const [load, setLoad] = useState<Load>('loading');
  const [attempt, setAttempt] = useState(0);
  const [offline, setOffline] = useState(false);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [slow, setSlow] = useState(false);
  const [synced, setSynced] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const knownTags = useMemo(() => [...new Set(items.flatMap((i) => i.tags))], [items]);
  const noun = hasComponents ? 'artifact' : 'plugin';

  // Restore state from the URL after hydration (keeps the server markup and first client render identical).
  useEffect(() => {
    const s = parseUrl(location.search, availableTypes, knownTags);
    setInput(s.q);
    setQuery(s.q);
    setFilters(s.filters);
    setSortChoice(s.sort);
    setSynced(true);
  }, [availableTypes, knownTags]);

  // Debounce 150 ms.
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(input), 150);
    return () => window.clearTimeout(id);
  }, [input]);

  // Keep the URL in sync (history.replaceState, spec 7.2).
  useEffect(() => {
    if (!synced) return;
    const next = `${location.pathname}${toSearch({ q: query, filters, sort: sortChoice })}${location.hash}`;
    if (next !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(null, '', next);
  }, [synced, query, filters, sortChoice]);

  // Load catalog.json and build the index.
  useEffect(() => {
    const ctrl = new AbortController();
    const timeout = window.setTimeout(() => ctrl.abort(), 10_000);
    setLoad('loading');
    (async () => {
      try {
        const res = await fetch(props.catalogUrl, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Catalog;
        if (data.schemaVersion !== 1 || !Array.isArray(data.artifacts)) throw new Error('unknown schemaVersion');
        const ids = new Set(items.map((i) => i.id));
        setEngine(createEngine(data.artifacts.filter((a) => ids.has(a.id)).map(toSearchDoc)));
        setLoad('ready');
        const page = document.querySelector('meta[name="dd-commit"]')?.getAttribute('content');
        if (page && data.commit && page !== data.commit) {
          const bar = document.getElementById('dd-stale');
          if (bar) bar.hidden = false;
        }
      } catch {
        setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
        setLoad('error');
      } finally {
        window.clearTimeout(timeout);
      }
    })();
    return () => {
      ctrl.abort();
      window.clearTimeout(timeout);
    };
  }, [attempt, props.catalogUrl, items]);

  // "Preparing search…" only after 300 ms, and only when there is something to search for.
  const waiting = load === 'loading' && query.trim() !== '';
  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return;
    }
    const id = window.setTimeout(() => setSlow(true), 300);
    return () => window.clearTimeout(id);
  }, [waiting]);

  // "/" focuses the field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const q = load === 'error' ? '' : query.trim();
  const res = useMemo(() => (q && engine ? engine.search(q) : null), [q, engine]);
  const view = useMemo(() => computeView(items, availableTypes, res, filters, sortChoice), [items, availableTypes, res, filters, sortChoice]);
  const n = view.results.length;
  const nActive = view.chips.length;
  const showSearchResultsLabel = !!q && !!engine;

  const toggle = <K extends 'typeF' | 'tagF' | 'freshF'>(key: K, value: Filters[K][number]) =>
    setFilters((f) => {
      const cur = f[key] as string[];
      const next = cur.includes(value as string) ? cur.filter((x) => x !== value) : [...cur, value as string];
      return { ...f, [key]: next } as Filters;
    });
  const toggleType = (t: ArtifactType) => {
    if (view.qType === t && !filters.typeF.includes(t)) setFilters((f) => ({ ...f, qTypeOff: t }));
    else toggle('typeF', t);
  };
  const clearAll = () => {
    setFilters(emptyFilters());
    setInput('');
    setQuery('');
  };
  const setExample = (text: string) => {
    setInput(text);
    setQuery(text);
    setFilters((f) => ({ ...f, qTypeOff: '' }));
  };
  const onInput = (v: string) => {
    setInput(v);
    if (v === '') setFilters((f) => ({ ...f, qTypeOff: '' }));
  };

  const removeChip = useCallback(
    (kind: string, value: string) => {
      if (kind === 'qtype') setFilters((f) => ({ ...f, qTypeOff: value as ArtifactType }));
      else if (kind === 'type') toggle('typeF', value as ArtifactType);
      else if (kind === 'fresh') toggle('freshF', value as 'new' | 'updated');
      else toggle('tagF', value);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const freshItems = items.filter((i) => i.fresh).sort((a, b) => b.ts - a.ts).slice(0, 6);
  const showNew = !q && nActive === 0 && freshItems.length > 0;
  const hasFreshFacet = items.some((i) => i.fresh);
  const popular = useMemo(() => {
    const c = new Map<string, number>();
    items.forEach((i) => i.tags.forEach((t) => c.set(t, (c.get(t) ?? 0) + 1)));
    return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4);
  }, [items]);

  const label = showSearchResultsLabel
    ? `${n} ${n === 1 ? 'result' : 'results'} for “${q}”`
    : nActive
      ? `${n} of ${view.total} ${noun}s`
      : pluralize(n, noun);
  const searchDisabled = load === 'error';
  const visibleTags = tagsAll ? view.tagFacets : view.tagFacets.slice(0, TAGS_SHOWN);

  return (
    <>
      <section className="search js-only" role="search" aria-label="Search artifacts">
        <label className="lbl" htmlFor="dd-q">
          Search artifacts
        </label>
        <div className="search__field">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M7 2.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM10.5 10.5l3 3" />
          </svg>
          <input
            id="dd-q"
            ref={inputRef}
            type="text"
            value={input}
            disabled={searchDisabled}
            placeholder="Describe what you need, e.g. a skill for PR review"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setInput('');
                setQuery('');
                setFilters((f) => ({ ...f, qTypeOff: '' }));
              }
            }}
          />
          {input.length > 0 && !searchDisabled ? (
            <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => { setInput(''); setQuery(''); setFilters((f) => ({ ...f, qTypeOff: '' })); inputRef.current?.focus(); }}>
              ×
            </button>
          ) : (
            !searchDisabled && <span className="kbd-hint" aria-hidden="true">/</span>
          )}
        </div>
        {slow && (
          <div className="status-line" role="status">
            <span className="spinner" aria-hidden="true" />
            <span>Preparing search…</span>
          </div>
        )}
        {load === 'error' && (
          <div className="alert-banner" role="alert">
            <span>{offline ? "You're offline. The list below is current as of the last build." : "Couldn't load search. The list below is current as of the last build."}</span>
            <button type="button" className="btn-ghost" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </button>
          </div>
        )}
        {!input && !searchDisabled && hasComponents && props.examples.length > 0 && (
          <div className="examples">
            <span>Try</span>
            {props.examples.map((ex) => (
              <button key={ex} type="button" className="chip-btn" onClick={() => setExample(ex)}>
                {ex}
              </button>
            ))}
            <span>Ukrainian works too.</span>
          </div>
        )}
      </section>

      {showNew && (
        <section className="stack js-only" aria-labelledby="h-new" style={{ gap: 8 }}>
          <div className="row-head">
            <h2 id="h-new" className="h2 h2--sm">New and updated</h2>
            <span className="muted" style={{ fontSize: 13 }}>last {props.freshDays} days</span>
            <a className="more" href={props.whatsNewUrl}>What&apos;s new →</a>
          </div>
          <ul className="new-list">
            {freshItems.map((i) => (
              <li key={i.id}>
                <a href={i.href}>
                  <TypeBadge type={i.type} />
                  <span className="name">{i.name}</span>
                  <FreshBadge value={i.fresh} />
                  <span className="date">{i.date}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div id="results" ref={resultsRef} tabIndex={-1} className="catalog">
        <aside className="filters js-only" aria-label="Filters">
          <button type="button" className="filters__toggle" aria-expanded={filtersOpen} aria-controls="f-panel" onClick={() => setFiltersOpen((o) => !o)}>
            <span>Filters ({nActive})</span>
            <span aria-hidden="true">{filtersOpen ? '▴' : '▾'}</span>
          </button>
          <div id="f-panel" className={`filters__panel${filtersOpen ? ' is-open' : ''}`}>
            {view.typeFacets.length > 0 && (
              <fieldset className="facet">
                <legend>Type</legend>
                {view.typeFacets.map((f) => (
                  <label key={f.type}>
                    <input type="checkbox" checked={f.checked} onChange={() => toggleType(f.type)} />
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ color: `var(--t-${f.type})` }}>
                      <path d={ICON[f.type]} />
                    </svg>
                    <span className="lbl-text">{TYPE_PLURAL[f.type]}</span>
                    <span className="count">{f.count}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {hasFreshFacet && (
              <fieldset className="facet">
                <legend>Freshness</legend>
                {view.freshFacets.map((f) => (
                  <label key={f.value}>
                    <input type="checkbox" checked={f.checked} onChange={() => toggle('freshF', f.value)} />
                    <span className="lbl-text">{freshLabel(f.value)}</span>
                    <span className="count">{f.count}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {view.tagFacets.length > 0 && (
              <fieldset className="facet">
                <legend>Tags</legend>
                {visibleTags.map((f) => (
                  <label key={f.tag}>
                    <input type="checkbox" checked={f.checked} onChange={() => toggle('tagF', f.tag)} />
                    <span className="lbl-text">{f.tag}</span>
                    <span className="count">{f.count}</span>
                  </label>
                ))}
                {view.tagFacets.length > TAGS_SHOWN && (
                  <button type="button" className="more-btn" onClick={() => setTagsAll((a) => !a)}>
                    {tagsAll ? 'Show fewer' : `${view.tagFacets.length - TAGS_SHOWN} more ▾`}
                  </button>
                )}
              </fieldset>
            )}
          </div>
        </aside>

        <section className="results" aria-labelledby="h-results">
          <div className="results__head">
            <h2 id="h-results" className="h2 h2--sm" aria-live="polite">
              {!showSearchResultsLabel && !nActive && <span className="nojs-only">All </span>}
              {label}
            </h2>
            <label className="sort js-only">
              <span>Sort</span>
              <select value={view.sort} onChange={(e) => setSortChoice(e.target.value as SortKey)}>
                {res?.ranked && <option value="relevance">Relevance</option>}
                <option value="updated">Updated</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
          {!hasComponents && <p className="results__note">{props.noComponentsNote}</p>}
          {view.fallbackType && (
            <p className="results__note" role="status">
              No {TYPE_PLURAL[view.fallbackType].toLowerCase()} found — showing other artifacts for your query
            </p>
          )}
          {nActive > 0 && (
            <div className="active-chips" aria-label="Active filters">
              {view.chips.map((c) => (
                <span className="chip" key={c.key}>
                  <span>{c.label}</span>
                  <button type="button" aria-label={c.aria} onClick={() => removeChip(c.kind, c.value)}>
                    ×
                  </button>
                </span>
              ))}
              <button type="button" className="link-btn" onClick={clearAll}>
                Clear filters
              </button>
            </div>
          )}
          {n === 0 && (
            <div className="no-results" role="status">
              <h3 className="h3" style={{ overflowWrap: 'anywhere' }}>{q ? `No ${noun}s match “${q}”` : `No ${noun}s match these filters`}</h3>
              <p>Try fewer words, or start from a popular tag:</p>
              <div className="tags">
                {popular.map(([tag, count]) => (
                  <button key={tag} type="button" className="chip-btn" onClick={() => { setInput(''); setQuery(''); setFilters({ ...emptyFilters(), tagF: [tag] }); }}>
                    <span>{tag}</span>
                    <span className="n">{count}</span>
                  </button>
                ))}
              </div>
              <div className="links">
                <a href={`${props.issueUrl}${q ? `?title=${encodeURIComponent(`Suggest an artifact: ${q}`)}&body=${encodeURIComponent(`I looked for: ${q}`)}` : ''}`} target="_blank" rel="noopener">
                  Suggest an artifact
                </a>
                <button type="button" className="link-btn" style={{ fontSize: 14 }} onClick={clearAll}>
                  Clear filters
                </button>
              </div>
            </div>
          )}
          <ul className="cards">
            {view.results.map((item) => (
              <Card key={item.id} item={item} terms={view.highlight} />
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
