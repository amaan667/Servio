import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Simple health check to verify deployment and logging
export async function GET() {
  const timestamp = new Date().toISOString();
  
  logger.info('🏥 [HEALTH CHECK] Health endpoint called', {
    timestamp,
    env: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasResendKey: !!process.env.RESEND_API_KEY,
      nodeEnv: process.env.NODE_ENV,
    }
  });

  return NextResponse.json({
    status: 'ok',
    timestamp,
    deployment: {
      ready: true,
      loggingWorking: true
    },
    env: {
      supabaseConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      serviceRoleConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      emailConfigured: !!process.env.RESEND_API_KEY,
      environment: process.env.NODE_ENV
    }
  });
}
