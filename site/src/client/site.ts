// Small vanilla enhancements shared by all pages: theme switch, copy buttons, onboarding banner,
// What's new counter, release filter, guide table of contents. No framework, no innerHTML.
import { clientStrings as ui } from '../i18n/en';
import { KEYS, readKey, writeKey } from '../lib/storage';

const root = document.documentElement;

/* ---------- Theme (System / Light / Dark) ---------- */
type Theme = 'system' | 'light' | 'dark';
function currentTheme(): Theme {
  const th = readKey(KEYS.theme);
  return th === 'light' || th === 'dark' ? th : 'system';
}
function applyTheme(th: Theme): void {
  if (th === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', th);
  document.querySelectorAll<HTMLButtonElement>('[data-theme-set]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.themeSet === th));
  });
}
applyTheme(currentTheme());
document.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>('[data-theme-set]');
  if (!b) return;
  const th = b.dataset.themeSet as Theme;
  writeKey(KEYS.theme, th);
  applyTheme(th);
});

/* ---------- Copy buttons (also used by the React island's cards) ---------- */
const timers = new WeakMap<Element, number>();
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

function selectText(el: Element): void {
  try {
    const r = document.createRange();
    r.selectNodeContents(el);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  } catch {
    /* ignore */
  }
}

document.addEventListener('click', async (e) => {
  const btn = (e.target as Element).closest<HTMLButtonElement>('.copy__btn');
  if (!btn) return;
  const box = btn.closest<HTMLElement>('.copy');
  if (!box) return;
  const cmd = btn.dataset.cmd ?? '';
  const label = box.querySelector('.copy__label');
  const note = box.querySelector<HTMLElement>('.copy__fail');
  window.clearTimeout(timers.get(box));
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(cmd);
    box.dataset.state = 'ok';
    if (label) label.textContent = ui.copy.copied;
    btn.setAttribute('aria-label', ui.copy.ariaCopied(cmd));
    if (note) {
      if (readKey(KEYS.copyHint) == null) {
        writeKey(KEYS.copyHint, '1');
        note.textContent = ui.copy.hint;
        note.hidden = false;
      } else {
        note.hidden = true;
      }
    }
    timers.set(
      box,
      window.setTimeout(() => {
        delete box.dataset.state;
        if (label) label.textContent = '';
        if (note) note.hidden = true;
        btn.setAttribute('aria-label', ui.copy.ariaCopy(cmd));
      }, 2000),
    );
  } catch {
    box.dataset.state = 'fail';
    if (label) label.textContent = '';
    const code = box.querySelector('.copy__code');
    if (code) selectText(code);
    if (note) {
      note.textContent = ui.copy.fail(isMac ? ui.copy.keyMac : ui.copy.keyOther);
      note.hidden = false;
    }
  }
});

/* ---------- Onboarding ---------- */
document.addEventListener('click', (e) => {
  if (!(e.target as Element).closest('[data-ob-dismiss]')) return;
  writeKey(KEYS.onboarding, 'dismissed');
  root.classList.add('ob-off');
});

/* ---------- Stale page ---------- */
document.addEventListener('click', (e) => {
  if ((e.target as Element).closest('[data-reload]')) location.reload();
});

/* ---------- What's new: unseen counter (spec 8.4) ---------- */
interface Head {
  releases: { id: string; date: string }[];
}
async function unseen(): Promise<void> {
  const url = document.body.dataset.releasesUrl;
  if (!url) return;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const head = (await res.json()) as Head;
    const newest = head.releases[0]?.date;
    if (!newest) return;
    const stored = readKey(KEYS.lastSeenRelease);
    const onPage = document.body.dataset.page === 'whats-new';
    const badges = document.querySelectorAll<HTMLElement>('[data-unseen]');

    if (onPage && stored) {
      const since = Date.parse(stored);
      document.querySelectorAll<HTMLElement>('[data-release-date]').forEach((el) => {
        if (Date.parse(el.dataset.releaseDate ?? '') > since) {
          const tag = el.querySelector<HTMLElement>('[data-new-for-you]');
          if (tag) tag.hidden = false;
        }
      });
    }
    if (onPage || stored == null) {
      // First visit: remember the newest release without showing a counter.
      writeKey(KEYS.lastSeenRelease, newest);
      badges.forEach((b) => (b.hidden = true));
      return;
    }
    const n = head.releases.filter((r) => Date.parse(r.date) > Date.parse(stored)).length;
    if (n > 0 && readKey(KEYS.lastSeenRelease) != null) {
      badges.forEach((b) => {
        b.textContent = `●${n > 9 ? '9+' : n}`;
        b.setAttribute('aria-label', ui.unseen(n));
        b.hidden = false;
      });
    }
  } catch {
    /* the counter is optional */
  }
}
void unseen();

/* ---------- What's new: plugin filter ---------- */
const relSelect = document.getElementById('rel-plugin') as HTMLSelectElement | null;
if (relSelect) {
  const apply = (): void => {
    const v = relSelect.value;
    document.querySelectorAll<HTMLElement>('[data-release]').forEach((el) => {
      el.hidden = v !== 'all' && el.dataset.plugin !== v;
    });
    document.querySelectorAll<HTMLElement>('[data-month]').forEach((m) => {
      m.hidden = !m.querySelector('[data-release]:not([hidden])');
    });
    try {
      const u = new URL(location.href);
      if (v === 'all') u.searchParams.delete('plugin');
      else u.searchParams.set('plugin', v);
      history.replaceState(null, '', u);
    } catch {
      /* ignore */
    }
  };
  const want = new URLSearchParams(location.search).get('plugin');
  if (want && [...relSelect.options].some((o) => o.value === want)) relSelect.value = want;
  relSelect.addEventListener('change', apply);
  apply();
}

/* ---------- Guide: highlight the current section in the table of contents ---------- */
const toc = document.querySelectorAll<HTMLAnchorElement>('[data-toc] a');
if (toc.length && 'IntersectionObserver' in window) {
  const byId = new Map([...toc].map((a) => [a.getAttribute('href')?.slice(1) ?? '', a]));
  const mark = (id: string): void => {
    byId.forEach((a, k) => (k === id ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
  };
  const sections = [...byId.keys()].map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
  const onScroll = (): void => {
    let act = sections[0]?.id ?? '';
    for (const s of sections) if (s.getBoundingClientRect().top < 140) act = s.id;
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) act = sections[sections.length - 1]?.id ?? act;
    mark(act);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
