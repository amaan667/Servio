import { NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|api/auth/callback|auth/callback).*)',
  ],
};

export function middleware(req: Request) {
  // Minimal middleware: do not mutate cookies here to avoid Next.js warnings.
  // This exists mainly to be a placeholder for future auth routing if needed.
  return NextResponse.next();
}


