import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { getBaseUrl } from '@/lib/getBaseUrl';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get the OAuth URL that Supabase would generate
    const redirectTo = `${getBaseUrl()}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo
      },
    });

    return NextResponse.json({
      data,
      error,
      redirectTo,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
