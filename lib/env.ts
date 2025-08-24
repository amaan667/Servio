// lib/env.ts
console.log('[ENV] Loading environment variables...');
console.log('[ENV] NODE_ENV:', process.env.NODE_ENV);
console.log('[ENV] NEXT_PHASE:', process.env.NEXT_PHASE);

// Check if we're in build mode - more reliable detection
const isBuildTime = 
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NODE_ENV === undefined ||
  (typeof window === 'undefined' && process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_SUPABASE_URL);

console.log('[ENV] Available env vars:', Object.keys(process.env).filter(key => 
  key.includes('SUPABASE') || key.includes('APP_URL')
));

// Get environment variables with fallbacks for build time
const getEnvVar = (key: string, fallback: string) => {
  const value = process.env[key];
  if (!value && isBuildTime) {
    console.log(`[ENV] Using fallback for ${key} during build time`);
    return fallback;
  }
  return value || '';
};

export const ENV = {
  SUPABASE_URL: getEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'https://placeholder.supabase.co'),
  SUPABASE_ANON: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'placeholder_key'),
  APP_URL: getEnvVar('NEXT_PUBLIC_APP_URL', 'https://placeholder-app.railway.app'),
};

console.log('[ENV] Loaded values:', {
  hasUrl: !!ENV.SUPABASE_URL,
  hasKey: !!ENV.SUPABASE_ANON,
  hasApp: !!ENV.APP_URL,
  url: ENV.SUPABASE_URL ? `${ENV.SUPABASE_URL.substring(0, 20)}...` : 'undefined',
  appUrl: ENV.APP_URL ? `${ENV.APP_URL.substring(0, 20)}...` : 'undefined',
  isBuildTime
});

// Only validate environment variables in production runtime if they're not placeholders
const isPlaceholder = (value: string) => 
  value.includes('placeholder') || 
  value === 'placeholder_key' || 
  value === 'https://placeholder.supabase.co' ||
  value === 'https://placeholder-app.railway.app';

const hasValidValues = ENV.SUPABASE_URL && ENV.SUPABASE_ANON && ENV.APP_URL &&
  !isPlaceholder(ENV.SUPABASE_URL) && 
  !isPlaceholder(ENV.SUPABASE_ANON) && 
  !isPlaceholder(ENV.APP_URL);

if (!isBuildTime && !hasValidValues) {
  console.error('[ENV] Missing or invalid required env(s)', {
    hasUrl: !!ENV.SUPABASE_URL,
    hasKey: !!ENV.SUPABASE_ANON, 
    hasApp: !!ENV.APP_URL,
    urlIsPlaceholder: isPlaceholder(ENV.SUPABASE_URL),
    keyIsPlaceholder: isPlaceholder(ENV.SUPABASE_ANON),
    appUrlIsPlaceholder: isPlaceholder(ENV.APP_URL),
    supabaseUrl: ENV.SUPABASE_URL || 'MISSING',
    appUrl: ENV.APP_URL || 'MISSING'
  });
  console.error('[ENV] Railway deployment: Ensure variables are set in Railway dashboard');
  console.error('[ENV] Local development: Ensure .env.local file exists with correct values');
  
  // Don't throw error immediately - log warning and continue with placeholders
  console.warn('[ENV] WARNING: Running with placeholder environment variables');
}

if (isBuildTime) {
  console.log('[ENV] Build time detected - using placeholder environment variables');
}


