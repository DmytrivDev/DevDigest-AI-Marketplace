import { describe, expect, it } from 'vitest';
import { formatBytes, formatDate, formatMonth, formatShortDate, pluralize, relativeTime } from '../src/lib/format';

describe('format', () => {
  it('pluralizes with Intl.PluralRules', () => {
    expect(pluralize(1, 'artifact')).toBe('1 artifact');
    expect(pluralize(2, 'artifact')).toBe('2 artifacts');
    expect(pluralize(12, 'artifact')).toBe('12 artifacts');
    expect(pluralize(0, 'plugin')).toBe('0 plugins');
  });
  it('formats dates in UTC', () => {
    expect(formatDate('2026-10-14T10:00:00Z')).toBe('Oct 14, 2026');
    expect(formatDate('2026-10-14T23:30:00-05:00')).toBe('Oct 15, 2026');
    expect(formatMonth('2026-09-16T08:00:00Z')).toBe('September 2026');
    expect(formatShortDate('2026-10-02T09:00:00Z')).toBe('Oct 2');
  });
  it('formats relative dates', () => {
    const now = new Date('2026-10-16T12:00:00Z');
    expect(relativeTime('2026-10-13T12:00:00Z', now)).toBe('3 days ago');
    expect(relativeTime('2026-10-16T08:00:00Z', now)).toBe('today');
    expect(relativeTime('2026-07-16T12:00:00Z', now)).toBe('3 months ago');
  });
  it('formats sizes', () => {
    expect(formatBytes(614)).toBe('614 B');
    expect(formatBytes(3277)).toBe('3.2 KB');
  });
});
