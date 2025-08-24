export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/server/supabase';

export async function GET(req: NextRequest) {
  // Legacy endpoint retained for backward compatibility – redirect to home
  const base = process.env.NEXT_PUBLIC_APP_URL!;
  return NextResponse.redirect(new URL('/', base));
}
