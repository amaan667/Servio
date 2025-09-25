export const DEBUG = process.env.NEXT_PUBLIC_DEBUG_AUTH === 'true';

export function log(...args: any[]) {
}
export function warn(...args: any[]) {
  if (DEBUG) console.warn('[AUTH DEBUG]', ...args);
}
export function error(...args: any[]) {
  if (DEBUG) console.error('[AUTH DEBUG]', ...args);
}
