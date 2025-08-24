// lib/env.ts
console.log('[ENV] Loading environment variables...');
console.log('[ENV] NODE_ENV:', process.env.NODE_ENV);
console.log('[ENV] NEXT_PHASE:', process.env.NEXT_PHASE);

// Check if we're in build mode - more reliable detection
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

console.log('[ENV] Available env vars:', Object.keys(process.env).filter(key => 
  key.includes('SUPABASE') || key.includes('APP_URL')
));

// Get environment variables with proper validation
const getEnvVar = (key: string) => {
  const value = process.env[key];
  
  if (!value) {
    console.error(`[ENV] CRITICAL: Missing required environment variable ${key}`);
    return '';
  }
  
  return value;
};

export const ENV = {
  SUPABASE_URL: getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
  SUPABASE_ANON: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  APP_URL: getEnvVar('NEXT_PUBLIC_APP_URL'),
};

console.log('[ENV] Loaded values:', {
  hasUrl: !!ENV.SUPABASE_URL,
  hasKey: !!ENV.SUPABASE_ANON,
  hasApp: !!ENV.APP_URL,
  url: ENV.SUPABASE_URL ? `${ENV.SUPABASE_URL.substring(0, 20)}...` : 'undefined',
  appUrl: ENV.APP_URL ? `${ENV.APP_URL.substring(0, 20)}...` : 'undefined',
  isBuildTime
});

// Validate environment variables
const hasValidValues = ENV.SUPABASE_URL && ENV.SUPABASE_ANON && ENV.APP_URL;

if (!hasValidValues) {
  console.error('[ENV] Missing required environment variables', {
    hasUrl: !!ENV.SUPABASE_URL,
    hasKey: !!ENV.SUPABASE_ANON, 
    hasApp: !!ENV.APP_URL,
    supabaseUrl: ENV.SUPABASE_URL || 'MISSING',
    appUrl: ENV.APP_URL || 'MISSING'
  });
  console.error('[ENV] Railway deployment: Ensure variables are set in Railway dashboard');
  console.error('[ENV] Local development: Ensure .env.local file exists with correct values');
}


