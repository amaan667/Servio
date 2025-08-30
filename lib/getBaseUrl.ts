import { headers } from 'next/headers'

export async function getBaseUrl() {
  if (typeof window === 'undefined') {
    return (
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : '') ||
      'http://localhost:8080'
    );
  }
  return window.location.origin;
}
