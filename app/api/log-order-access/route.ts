import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json().catch(() => ({}));

    const log = {
      tag: '[ORDER ACCESS]'.padEnd(16),
      timestamp: new Date().toISOString(),
      ip: req.ip || req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      url: data?.url || req.nextUrl?.toString(),
      venueSlug: data?.venueSlug,
      tableNumber: data?.tableNumber,
      counterNumber: data?.counterNumber,
      orderType: data?.orderType,
      orderLocation: data?.orderLocation,
      isDemo: data?.isDemo,
    };

    console.log(log);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[ORDER ACCESS] log failure:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}


