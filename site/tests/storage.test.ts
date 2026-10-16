import { describe, expect, it } from 'vitest';
import { readKey, removeKey, writeKey } from '../src/lib/storage';

const throwing = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('storage wrapper', () => {
  it('never throws when localStorage throws', () => {
    expect(readKey('k', throwing)).toBeNull();
    expect(writeKey('k', 'v', throwing)).toBe(false);
    expect(() => removeKey('k', throwing)).not.toThrow();
  });
  it('works with a normal store', () => {
    const m = new Map<string, string>();
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
    expect(writeKey('a', '1', store)).toBe(true);
    expect(readKey('a', store)).toBe('1');
    removeKey('a', store);
    expect(readKey('a', store)).toBeNull();
  });
  it('handles a missing store', () => {
    expect(readKey('a', null)).toBeNull();
    expect(writeKey('a', '1', null)).toBe(false);
  });
});
