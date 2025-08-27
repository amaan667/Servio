import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/server/supabase';

export const runtime = 'nodejs';
export async function GET() {
  const supabase = createServerSupabaseClient();
  const userRes = await createClient().auth.getUser();
  const venuesRes = userRes.data.user
    ? await createClient().from('venues').select('venue_id').eq('owner_id', userRes.data.user.id)
    : null;
  return NextResponse.json({ userRes, venuesRes });
}
