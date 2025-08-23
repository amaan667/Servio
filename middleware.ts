import { NextResponse } from 'next/server';

export const config = {
	matcher: ['/dashboard/:path*'],
};

export function middleware(req: Request) {
	// Minimal middleware: do not mutate cookies here to avoid Next.js warnings.
	// Only protecting dashboard paths; auth callback is not intercepted.
	return NextResponse.next();
}


