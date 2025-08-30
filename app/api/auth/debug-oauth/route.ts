import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data, error, timestamp } = body;
    
    // Log to Railway logs
    console.log('[RAILWAY OAUTH DEBUG]', {
      action,
      data,
      error,
      timestamp,
      requestUrl: request.url,
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      }
    });
    
    return NextResponse.json({ success: true, logged: true });
    
  } catch (error: any) {
    console.log('[RAILWAY OAUTH DEBUG ERROR]', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Test Supabase connection
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      auth: {
        hasSession: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        sessionError: sessionError?.message,
      },
      request: {
        url: request.url,
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer'),
      }
    };
    
    console.log('[RAILWAY OAUTH DEBUG] GET request:', debugInfo);
    
    return NextResponse.json(debugInfo);
    
  } catch (error: any) {
    console.log('[RAILWAY OAUTH DEBUG] GET error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
