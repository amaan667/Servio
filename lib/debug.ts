import { logger } from '@/lib/logger';
export const DEBUG = process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true';

export function log(...args: unknown[]) {
}
export function warn(...args: unknown[]) {
  if (DEBUG) logger.warn('[AUTH DEBUG]', ...args);
}
export function error(...args: unknown[]) {
  if (DEBUG) logger.error('[AUTH DEBUG]', ...args);
}
