/**
 * Safe storage utilities that handle quota errors gracefully.
 * Mobile Safari (especially private mode) has very limited storage quota.
 */

export function safeGetItem(
  storage: Storage,
  key: string
): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(
  storage: Storage,
  key: string,
  value: string
): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    // Quota exceeded or storage unavailable
    // Try to clear old data and retry once
    try {
      // Clear all servio-related keys to make space
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && (
          k.startsWith("menu_") ||
          k.startsWith("categories_") ||
          k.startsWith("venue_name_") ||
          k.startsWith("servio-")
        )) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => storage.removeItem(k));
      // Retry
      storage.setItem(key, value);
      return true;
    } catch {
      // Still failed - storage is unavailable or value too large
      return false;
    }
  }
}

export function safeRemoveItem(
  storage: Storage,
  key: string
): void {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore
  }
}

export function safeParseJSON<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
