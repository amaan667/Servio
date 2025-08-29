import { headers } from 'next/headers';

export function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin;

  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host  = h.get('x-forwarded-host') ?? h.get('host')!;
  return `${proto}://${host}`;
}
