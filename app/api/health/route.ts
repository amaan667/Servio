import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Ultra-simple health check that just returns OK
export async function GET() {
  return new Response('OK', { 
    status: 200,
    headers: {
      'Content-Type': 'text/plain'
    }
  });
}
