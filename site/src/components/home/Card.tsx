import { richParts } from '../../lib/richtext';
import { splitHighlight } from '../../search/engine';
import { CopyButton, FreshBadge, TypeBadge, type CardItem } from './shared';

function Marked({ text, terms }: { text: string; terms: string[] }) {
  // Text nodes only, never innerHTML (spec 7.3).
  return (
    <>
      {richParts(text).map((p, i) => {
        const inner = splitHighlight(p.text, terms).map((s, j) =>
          s.hit ? (
            <mark key={j} className="hl" style={{ color: 'inherit' }}>
              {s.text}
            </mark>
          ) : (
            s.text
          ),
        );
        return p.code ? (
          <code key={i} className="ic">
            {inner}
          </code>
        ) : (
          <span key={i}>{inner}</span>
        );
      })}
    </>
  );
}

export function Card({ item, terms }: { item: CardItem; terms: string[] }) {
  const meta = item.tags.slice(0, 4).join(', ');
  return (
    <li>
      <article className="card">
        <div className="card__badges">
          <TypeBadge type={item.type} />
          <FreshBadge value={item.fresh} />
        </div>
        <h3>
          <a href={item.href}>
            <Marked text={item.name.replace(/`/g, '')} terms={terms} />
          </a>
        </h3>
        <p className="card__desc" title={item.description.replace(/`/g, '')}>
          <Marked text={item.description} terms={terms} />
        </p>
        <p className="card__meta">
          <a href={item.pluginHref}>{item.plugin}</a>
          {meta && (
            <>
              <span aria-hidden="true">·</span>
              <span>{meta}</span>
            </>
          )}
          {item.date && (
            <>
              <span aria-hidden="true">·</span>
              <span>{item.date}</span>
            </>
          )}
        </p>
        <div className="card__copy">
          <CopyButton cmd={item.cmd} />
        </div>
      </article>
    </li>
  );
}
