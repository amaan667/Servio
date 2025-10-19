/**
 * Logger Type Definitions
 * Provides flexible, type-safe logging context types
 */

export type Primitive = string | number | boolean | null | undefined;

export type LogContext = Record<string, unknown> | Primitive | Error;
