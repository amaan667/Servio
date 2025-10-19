import { logger } from '@/lib/logger';
export const DEBUG = process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true';

export function log(...args: any[]) {
}
export function warn(...args: any[]) {
  if (DEBUG) logger.warn('[AUTH DEBUG]', ...args);
}
export function error(...args: any[]) {
  if (DEBUG) logger.error('[AUTH DEBUG]', ...args);
}
