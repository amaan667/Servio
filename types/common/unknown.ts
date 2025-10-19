/**
 * Common Unknown Types
 * Use these instead of 'any' when the type is truly unknown
 */

/**
 * Unknown JSON value
 */
export type JsonValue = 
  | string 
  | number 
  | boolean 
  | null 
  | JsonValue[] 
  | { [key: string]: JsonValue };

/**
 * Unknown object
 */
export type UnknownObject = Record<string, unknown>;

/**
 * Unknown array
 */
export type UnknownArray = unknown[];

/**
 * Generic unknown data
 */
export type UnknownData = unknown;

/**
 * Type guard for unknown object
 */
export function isUnknownObject(value: unknown): value is UnknownObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for unknown array
 */
export function isUnknownArray(value: unknown): value is UnknownArray {
  return Array.isArray(value);
}

/**
 * Type guard for JsonValue
 */
export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === 'object') return Object.values(value).every(isJsonValue);
  return false;
}

