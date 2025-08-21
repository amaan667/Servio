import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

// Exclude auth callback & static
export const config = {
  matcher: [
    // apply to everything except:
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|api/test-openai|api/health).*)',
  ],
};
