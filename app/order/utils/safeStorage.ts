/**
 * Safe storage utilities that handle quota errors gracefully.
 * Mobile Safari (especially private mode) has very limited storage quota.
 *
 * Storage Strategy:
 * - Essential data (cart, auth, payments) always attempted
 * - Performance optimizations (caching) only when storage available
 * - Graceful degradation in private browsing mode
 */

export function safeGetItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Essential storage keys that must be preserved in private browsing mode
 */
const ESSENTIAL_KEYS = [
  "servio-order-cart-", // Shopping cart
  "servio-checkout-data", // Payment data
  "servio-current-session", // Order session
  "servio-order-", // Order data
  "sb-auth-session", // Supabase auth
];

/**
 * Check if a key is essential for app functionality
 */
function isEssentialKey(key: string): boolean {
  return ESSENTIAL_KEYS.some((prefix) => key.startsWith(prefix));
}

export function safeSetItem(storage: Storage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    // Quota exceeded or storage unavailable
    // Try to clear non-essential data first, then essential if needed
    try {
      const keysToRemove: string[] = [];

      // First pass: clear non-essential keys
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (
          k &&
          !isEssentialKey(k) &&
          (k.startsWith("menu_") ||
            k.startsWith("categories_") ||
            k.startsWith("venue_name_") ||
            k.startsWith("has_pdf_images_") ||
            k.startsWith("pdf_images_") ||
            k.startsWith("user_role_") ||
            k.startsWith("venue_id_") ||
            k.startsWith("dashboard_"))
        ) {
          keysToRemove.push(k);
        }
      }

      // If no non-essential keys to clear, clear old essential keys
      if (keysToRemove.length === 0) {
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k && isEssentialKey(k) && k !== key) {
            // Don't clear the key we're trying to set
            keysToRemove.push(k);
          }
        }
      }

      keysToRemove.forEach((k) => storage.removeItem(k));

      // Retry with cleared space
      storage.setItem(key, value);
      return true;
    } catch {
      // Still failed - storage is completely unavailable
      return false;
    }
  }
}

export function safeRemoveItem(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore
  }
}

/** Scoped cart key used by useOrderCart — clear this after successful order so cart is empty on return. */
export function getScopedCartKey(venueId: string, tableOrCounter: string | number): string {
  return `servio-order-cart-${venueId}-${tableOrCounter}`;
}

export function safeParseJSON<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
