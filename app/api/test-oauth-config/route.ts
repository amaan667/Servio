import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = createServerSupabase();
    
    // Test the OAuth configuration
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://servio-production.up.railway.app/auth/callback',
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.status,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        url: data.url,
        provider: data.provider,
      },
    });
  } catch (error: any) {
    console.error('[AUTH DEBUG] OAuth config test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
    }, { status: 500 });
  }
}
