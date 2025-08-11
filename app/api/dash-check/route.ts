import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export async function GET() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        get: (n)=>cookies().get(n)?.value,
        set: (n,v,o)=>cookies().set({ name:n, value:v, ...o }),
        remove: (n,o)=>cookies().set({ name:n, value:'', ...o }),
      } }
  );
  const userRes = await supabase.auth.getUser();
  const venuesRes = userRes.data.user
    ? await supabase.from('venues').select('venue_id').eq('owner_id', userRes.data.user.id)
    : null;
  return NextResponse.json({ userRes, venuesRes });
}
