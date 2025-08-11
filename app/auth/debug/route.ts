import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        get: n => cookies().get(n)?.value,
        set: (n,v,o) => cookies().set({ name:n, value:v, ...o }),
        remove: (n,o) => cookies().set({ name:n, value:'', ...o }),
      } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return NextResponse.json({
    serverSeesUser: !!user,
    cookieNames: cookies().getAll().map(c => c.name),
  });
}