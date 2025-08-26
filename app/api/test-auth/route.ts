import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';

export async function GET() {
  try {
    const supabase = createClient();
    
    // Test basic Supabase connection
    const { data, error } = await supabase.auth.getSession();
    
    const debugInfo = {
      hasSession: !!data.session,
      sessionUser: data.session?.user?.id || null,
      error: error?.message || null,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(debugInfo);
  } catch (e: any) {
    return NextResponse.json({
      error: e.message,
      stack: e.stack,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
