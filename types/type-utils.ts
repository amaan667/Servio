// Type utilities for safe type handling without changing runtime behavior

/**
 * Safely cast unknown to a specific type
 * Use this when you know the runtime type but TypeScript doesn't
 */
export function asType<T>(value: unknown): T {
  return value as T;
}

/**
 * Safely access a property on an unknown object
 */
export function getProperty<T = unknown>(obj: unknown, key: string): T | undefined {
  if (obj && typeof obj === "object" && key in obj) {
    return (obj as Record<string, unknown>)[key] as T;
  }
  return undefined;
}

/**
 * Check if value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for objects
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard for arrays
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Safely parse JSON with type assertion
 */
export function safeJsonParse<T = unknown>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Assert that a value is not null/undefined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || "Value is null or undefined");
  }
}

/**
 * Create a typed record from unknown
 */
export function toRecord(value: unknown): Record<string, unknown> {
  if (isObject(value)) {
    return value;
  }
  return {
    /* Empty */
  };
}

/**
 * Safely get array from unknown value
 */
export function toArray<T = unknown>(value: unknown): T[] {
  if (isArray(value)) {
    return value as T[];
  }
  return [];
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (isObject(error) && "message" in error) {
    return String(error.message);
  }
  return "Unknown error";
}
