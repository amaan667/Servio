import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getBaseUrl } from '@/lib/getBaseUrl';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Get the OAuth URL that Supabase would generate
    const redirectTo = `${getBaseUrl()}/auth/callback`;

    const { data, error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { 
        flowType: "pkce",
        redirectTo
      },
    });

    return NextResponse.json({
      data,
      error,
      redirectTo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
