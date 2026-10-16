import { formatShortDate } from './format';
import { t } from '../i18n/en';
import { TYPE_ORDER, type ArtifactType, type Stats } from './types';

// Stepped line chart of artifacts per type after each release (spec 9.4). Static SVG geometry.

export interface ChartLine {
  type: ArtifactType;
  points: string;
  label: string;
  lx: number;
  ly: number;
}

export interface Chart {
  w: number;
  h: number;
  l: number;
  r: number;
  grid: { y: number; ty: number; tx: number; label: string }[];
  xt: { x: number; y: number; label: string }[];
  lines: ChartLine[];
  aria: string;
  caption: string;
}

export function buildChart(growth: Stats['growth'], now: string, narrow: boolean): Chart | null {
  if (growth.length < 2) return null;
  const types = TYPE_ORDER.filter((ty) => growth.some((g) => g.byType[ty] > 0));
  if (!types.length) return null;

  const W = narrow ? 328 : 720;
  const H = 220;
  const L = 28;
  const R = narrow ? 92 : 120;
  const T = 12;
  const B = 28;
  const pw = W - L - R;
  const ph = H - T - B;
  const t0 = Date.parse(growth[0].date);
  const end = Math.max(Date.parse(now), Date.parse(growth[growth.length - 1].date));
  const span = Math.max(1, end - t0);
  const max = Math.max(1, ...growth.flatMap((g) => types.map((ty) => g.byType[ty])));
  const step = max <= 4 ? 1 : Math.ceil(max / 4);
  const top = Math.ceil(max / step) * step;
  const X = (ms: number) => L + ((ms - t0) / span) * pw;
  const Y = (v: number) => T + ph - (v / top) * ph;

  const lines = types.map((type, i) => {
    const vals = growth.map((g) => g.byType[type]);
    const off = (i - (types.length - 1) / 2) * 2.5;
    const pts: [number, number][] = [];
    growth.forEach((g, j) => {
      const x = X(Date.parse(g.date));
      if (j) pts.push([x, Y(vals[j - 1]) + off]);
      pts.push([x, Y(vals[j]) + off]);
    });
    pts.push([X(end), Y(vals[vals.length - 1]) + off]);
    return {
      type,
      points: pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '),
      y0: Y(vals[vals.length - 1]) + off,
      label: t.stats.chartLabel(t.types.pluralShort[type], vals[vals.length - 1]),
      lx: X(end) + 8,
    };
  });
  // Keep the end labels from overlapping.
  const sorted = [...lines].sort((a, b) => a.y0 - b.y0);
  let prev = -99;
  const ly = new Map<ArtifactType, number>();
  sorted.forEach((l) => {
    const y = Math.max(l.y0 + 4, prev + 15);
    ly.set(l.type, y);
    prev = y;
  });
  const overflow = prev - (H - B + 4);
  if (overflow > 0) ly.forEach((v, k) => ly.set(k, v - overflow));

  const grid = Array.from({ length: top / step + 1 }, (_, i) => i * step).map((v) => ({ y: Y(v), ty: Y(v) + 4, tx: L - 8, label: String(v) }));
  const dates = growth.map((g) => formatShortDate(g.date));
  const totals = growth.map((g) => types.reduce((n, ty) => n + g.byType[ty], 0));
  const series = types.map((ty) => {
    const vals = growth.map((g) => g.byType[ty]);
    const label = t.types.pluralSeries[ty];
    return t.stats.chartSeries(label, vals.every((v) => v === vals[0]) ? String(vals[0]) : vals.join(', '));
  });
  const listDates = dates.length > 1 ? t.stats.chartDatesAnd(dates.slice(0, -1).join(', '), dates[dates.length - 1]) : dates[0];

  return {
    w: W,
    h: H,
    l: L,
    r: W - R + 4,
    grid,
    xt: growth.map((g, i) => ({ x: X(Date.parse(g.date)), y: H - 8, label: dates[i] })),
    lines: lines.map((l) => ({ type: l.type, points: l.points, label: l.label, lx: l.lx, ly: ly.get(l.type)! })),
    aria: t.stats.chartAria(series.join('; '), listDates),
    caption: t.stats.chartCaption(totals.map((n, i) => t.stats.chartCaptionItem(n, dates[i])).join(', ')),
  };
}
