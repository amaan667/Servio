import { NextResponse } from 'next/server';

export async function GET() {
  console.log('[AUTH DEBUG] Environment debug endpoint called');
  
  const envVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'present' : 'missing',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NODE_ENV: process.env.NODE_ENV,
    // Don't expose sensitive keys in response
  };

  console.log('[AUTH DEBUG] Environment variables:', envVars);

  return NextResponse.json({
    message: 'Environment debug info',
    env: envVars,
    timestamp: new Date().toISOString()
  });
}
