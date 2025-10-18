import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const vitals = await req.json();
    
    // Store web vitals for monitoring
    // In production, send to analytics service (e.g., Vercel Analytics, Google Analytics)
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'Failed to log vitals' }, { status: 500 });
  }
}
