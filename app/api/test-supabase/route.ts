import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = createClient();
    
    // Test basic Supabase connection
    const { data, error } = await supabase.auth.getSession();
    
    return NextResponse.json({
      success: true,
      hasSession: !!data.session,
      error: error?.message || null,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
