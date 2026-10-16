import { t } from '../../i18n/en';
import { ICON, TYPE_LABEL } from '../../lib/icons';
import type { ArtifactType, Freshness } from '../../lib/types';

/** Display data for one home card, computed at build time. */
export interface CardItem {
  id: string;
  type: ArtifactType;
  name: string;
  description: string;
  tags: string[];
  plugin: string;
  href: string;
  pluginHref: string;
  /** "Oct 14, 2026" */
  date: string;
  /** For sorting; 0 when unknown. */
  ts: number;
  fresh?: Freshness;
  cmd: string;
}

export function TypeBadge({ type, label }: { type: ArtifactType; label?: string }) {
  return (
    <span className={`badge badge--${type}`}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d={ICON[type]} />
      </svg>
      <span>{label ?? TYPE_LABEL[type]}</span>
    </span>
  );
}

export function FreshBadge({ value }: { value?: Freshness }) {
  if (!value) return null;
  return <span className={`fresh fresh--${value}`}>{t.fresh[value]}</span>;
}

/** Same markup as CopyCommand.astro; behaviour comes from the page-level copy script. */
export function CopyButton({ cmd }: { cmd: string }) {
  return (
    <div className="copy" data-copy>
      <button type="button" className="copy__btn" data-cmd={cmd} aria-label={t.copy.ariaCopy(cmd)} title={cmd}>
        <code className="copy__code">{cmd}</code>
        <span className="copy__st" aria-live="polite">
          <svg className="copy__idle" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M5.5 5.5h8v8h-8z" />
            <path d="M10.5 5.5v-3h-8v8h3" />
          </svg>
          <svg className="copy__ok" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8.5 6.5 12 13 4.5" />
          </svg>
          <span className="copy__label" />
        </span>
      </button>
      <span className="copy__fail" role="status" hidden />
    </div>
  );
}
