// localStorage wrapper that never throws (spec 7.7 "Storage unavailable").

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getStore(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readKey(key: string, store: StorageLike | null = getStore()): string | null {
  try {
    return store ? store.getItem(key) : null;
  } catch {
    return null;
  }
}

export function writeKey(key: string, value: string, store: StorageLike | null = getStore()): boolean {
  try {
    if (!store) return false;
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string, store: StorageLike | null = getStore()): void {
  try {
    store?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  theme: 'dd:theme',
  onboarding: 'dd:onboarding',
  lastSeenRelease: 'dd:lastSeenRelease',
  copyHint: 'dd:copy-hint',
} as const;
