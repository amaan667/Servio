import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookies().get(name)?.value,
        set: (name, value, options) => cookies().set({ name, value, ...options }),
        remove: (name, options) => cookies().set({ name, value: '', ...options }),
      },
    }
  );
  
  const { data: { user } } = await supabase.auth.getUser();
  
  return NextResponse.json({
    serverSeesUser: !!user,
    cookies: cookies().getAll()
  });
}