import { describe, expect, it } from 'vitest';
import { releaseText, releaseTitle } from '../src/lib/site';
import { emptyCounts, type Release } from '../src/lib/types';

const ref = (type: Release['changes']['added'][number]['type'], name: string) => ({ id: `devdigest:${type}:${name}`, type, name, exists: true });
const release = (over: Partial<Release>): Release => ({
  id: 'devdigest@0.3.0',
  kind: 'release',
  plugin: 'devdigest',
  version: '0.3.0',
  previousVersion: '0.2.0',
  date: '2026-10-14T10:00:00Z',
  commit: 'a1b2c3d4e5f6',
  changes: { added: [], updated: [], removed: [] },
  notes: null,
  counts: emptyCounts(),
  ...over,
});

describe('RSS item text (8.5)', () => {
  it('lists added, updated and removed artifacts as plain text', () => {
    const r = release({
      changes: { added: [ref('skill', 'review'), ref('skill', 'pr-brief')], updated: [ref('agent', 'security-reviewer')], removed: [ref('command', 'summarize')] },
    });
    expect(releaseTitle(r)).toBe('devdigest 0.3.0');
    expect(releaseText(r)).toBe('Added (2): Skill review, Skill pr-brief. Updated (1): Agent security-reviewer. Removed (1): Command summarize.');
  });

  it('says so when a release changed nothing', () => {
    expect(releaseText(release({}))).toBe('No changes to contents.');
  });

  it('describes added and removed plugins', () => {
    expect(releaseText(release({ kind: 'plugin-added', changes: { added: [ref('hook', 'pre-commit')], updated: [], removed: [] } }))).toBe(
      'Plugin added. Added (1): Hook pre-commit.',
    );
    expect(releaseText(release({ kind: 'plugin-removed', version: null }))).toBe('Plugin removed.');
  });
});
