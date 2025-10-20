/**
 * API Test Helpers
 * Utilities for testing Next.js API routes
 */

import { NextRequest } from 'next/server';
import type { RequestInit as NextRequestInit } from 'next/dist/server/web/spec-extension/request';

export async function call(handler: (req: NextRequest) => Promise<Response>, init?: NextRequestInit) {
  const req = new NextRequest('http://localhost/api/test', init);
  const res = await handler(req);
  const json = await res.json();
  return { status: res.status, json };
}

