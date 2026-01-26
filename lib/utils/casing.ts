/**
 * Casing Utilities
 * Converts between snake_case and camelCase
 */

export function toCamel(s: string): string {
  return s.replace(/([-_][a-z])/gi, ($1) => {
    return $1.toUpperCase().replace("-", "").replace("_", "");
  });
}

export function toSnake(s: string): string {
  return s.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function mapKeys(obj: unknown, fn: (key: string) => string): unknown {
  if (Array.isArray(obj)) {
    return obj.map((v) => mapKeys(v, fn));
  }
  if (obj !== null && typeof obj === "object" && obj.constructor === Object) {
    return Object.keys(obj).reduce(
      (result, key) => ({
        ...result,
        [fn(key)]: mapKeys((obj as Record<string, unknown>)[key], fn),
      }),
      {}
    );
  }
  return obj;
}

export function keysToCamel<T = unknown>(obj: T): T {
  return mapKeys(obj, toCamel) as T;
}

export function keysToSnake<T = unknown>(obj: T): T {
  return mapKeys(obj, toSnake) as T;
}
