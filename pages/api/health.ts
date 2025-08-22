import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('🏥 Health check requested');
    
    // Check environment variables
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      NODE_ENV: process.env.NODE_ENV,
    };

    // Check if Supabase client can be imported without errors
    let supabaseStatus = 'unknown';
    try {
      // Dynamic import to catch any initialization errors
      await import('@/lib/supabase');
      supabaseStatus = 'ok';
    } catch (error) {
      console.error('Supabase import failed in health check:', error);
      supabaseStatus = 'error';
    }

    const healthData = {
      status: supabaseStatus === 'ok' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        nodeEnv: process.env.NODE_ENV,
      },
      services: {
        supabase: supabaseStatus,
      },
      environmentVariables: envCheck,
      railway: {
        deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || 'unknown',
        serviceId: process.env.RAILWAY_SERVICE_ID || 'unknown',
        environment: process.env.RAILWAY_ENVIRONMENT || 'unknown',
      }
    };

    console.log('✅ Health check completed:', { status: healthData.status });

    const statusCode = healthData.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthData);
    
  } catch (error) {
    console.error('💥 Health check failed:', error);
    
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
}
