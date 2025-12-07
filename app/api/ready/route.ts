import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { redisCache } from '@/lib/cache/redis';
import { success, apiErrors } from '@/lib/api/standard-response';

export const runtime = 'nodejs';

export async function GET() {
  const checks: Record<string, { status: string; responseTime?: number }> = { /* Empty */ };
  let overallStatus = 'ready';

  // Check Supabase connectivity
  try {
    const supabaseStart = Date.now();
    const supabase = await createClient();
    const { error } = await supabase.from('organizations').select('id').limit(1);
    const supabaseTime = Date.now() - supabaseStart;
    
    if (error) {
      checks.supabase = { status: 'error', responseTime: supabaseTime };
      overallStatus = 'not_ready';
    } else {
      checks.supabase = { status: 'ok', responseTime: supabaseTime };
    }
  } catch {
    checks.supabase = { status: 'error' };
    overallStatus = 'not_ready';
  }

  // Check Redis connectivity
  try {
    const redisStart = Date.now();
    // Try to get a key to verify Redis is working
    await redisCache.exists('health-check');
    const redisTime = Date.now() - redisStart;
    checks.redis = { status: 'ok', responseTime: redisTime };
  } catch {
    checks.redis = { status: 'error' };
    overallStatus = 'not_ready';
  }

  if (overallStatus === 'ready') {
    return success({
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    });
  }

  return apiErrors.serviceUnavailable('Service health checks failed');
}

