import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET() {
  const h = headers();
  const jar = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        get: (n) => jar.get(n)?.value,
        set: () => {},
        remove: () => {},
    } }
  );

  const { data: sessionData } = await supabase.auth.getSession();
  const { data: userData } = await supabase.auth.getUser();

  const cookieNames = jar.getAll().map(c => c.name).sort();

  const out = {
    host: h.get('x-forwarded-host') ?? h.get('host'),
    proto: h.get('x-forwarded-proto'),
    cookieNames,
    hasSbAuth: cookieNames.some(n => n.startsWith('sb-')),
    session: !!sessionData?.session,
    userId: userData?.user?.id ?? null,
  };

  return NextResponse.json(out, { headers: { 'cache-control': 'no-store' } });
}
