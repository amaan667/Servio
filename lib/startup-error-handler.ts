/**
 * Startup Error Handler
 * 
 * This module sets up global error handlers to catch and log any unhandled errors
 * that occur during application startup, ensuring they are visible in Railway logs
 * even if the process crashes early.
 */

export function setupStartupErrorHandlers() {
  console.log('🚀 Setting up startup error handlers...');

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    console.error('💥 UNCAUGHT EXCEPTION - Application will exit:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
      platform: process.platform,
      nodeVersion: process.version
    });
    
    // Give some time for the log to be flushed
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('💥 UNHANDLED PROMISE REJECTION - Application will exit:', {
      reason: reason?.toString() || 'Unknown reason',
      stack: reason?.stack || 'No stack trace available',
      promise: promise.toString(),
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
      platform: process.platform,
      nodeVersion: process.version
    });
    
    // Give some time for the log to be flushed
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle process exit signals
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received - Graceful shutdown initiated');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received - Graceful shutdown initiated');
    process.exit(0);
  });

  console.log('✅ Startup error handlers configured successfully');
}

/**
 * Safe environment variable access with detailed logging
 */
export function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  
  if (!value) {
    const errorMsg = `❌ Required environment variable missing: ${name}`;
    console.error(errorMsg, {
      variable: name,
      availableVars: Object.keys(process.env).filter(key => 
        key.includes('SUPABASE') || 
        key.includes('STRIPE') || 
        key.includes('OPENAI') || 
        key.includes('GOOGLE') ||
        key.includes('APP_URL') ||
        key.includes('SITE_URL')
      ),
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV
    });
    throw new Error(errorMsg);
  }
  
  return value;
}

/**
 * Validate all required environment variables at startup
 */
export function validateEnvironmentVariables(): void {
  console.log('🔍 Validating environment variables...');
  
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  const optionalVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET', 
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'OPENAI_API_KEY',
    'GOOGLE_CREDENTIALS_B64',
    'APP_URL',
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_SITE_URL'
  ];

  const missing = [];
  const present = [];

  // Check required variables
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      present.push(varName);
      console.log(`✅ ${varName}: Present`);
    } else {
      missing.push(varName);
      console.error(`❌ ${varName}: MISSING (required)`);
    }
  }

  // Check optional variables
  for (const varName of optionalVars) {
    if (process.env[varName]) {
      present.push(varName);
      console.log(`✅ ${varName}: Present (optional)`);
    } else {
      console.warn(`⚠️ ${varName}: Missing (optional)`);
    }
  }

  console.log('📊 Environment validation summary:', {
    required: requiredVars.length,
    requiredPresent: requiredVars.filter(v => process.env[v]).length,
    requiredMissing: missing.length,
    optional: optionalVars.length,
    optionalPresent: optionalVars.filter(v => process.env[v]).length,
    totalPresent: present.length,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });

  // Only fail validation at runtime, not during build
  if (missing.length > 0 && process.env.NODE_ENV !== undefined) {
    const errorMsg = `Missing required environment variables: ${missing.join(', ')}`;
    console.error('💥 ENVIRONMENT VALIDATION FAILED:', errorMsg);
    
    // For now, just warn during build time to avoid breaking builds
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.warn('⚠️ Build-time validation warning:', errorMsg);
      console.warn('   This will cause runtime errors if not fixed before deployment');
      return;
    }
    
    throw new Error(errorMsg);
  }

  console.log('✅ Environment validation passed');
}

/**
 * Log startup information for debugging
 */
export function logStartupInfo(): void {
  console.log('🚀 APPLICATION STARTUP INFO:', {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    nodeEnv: process.env.NODE_ENV,
    memory: process.memoryUsage(),
    cwd: process.cwd(),
    pid: process.pid,
    uptime: process.uptime(),
    railwayEnv: {
      deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
      serviceId: process.env.RAILWAY_SERVICE_ID,
      projectId: process.env.RAILWAY_PROJECT_ID,
      environment: process.env.RAILWAY_ENVIRONMENT,
      replicaId: process.env.RAILWAY_REPLICA_ID
    }
  });
}