// lib/env.ts
console.log('[ENV] Loading environment variables...');
console.log('[ENV] NODE_ENV:', process.env.NODE_ENV);
console.log('[ENV] Available env vars:', Object.keys(process.env).filter(key => 
  key.includes('SUPABASE') || key.includes('APP_URL')
));

export const ENV = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
};

console.log('[ENV] Loaded values:', {
  hasUrl: !!ENV.SUPABASE_URL,
  hasKey: !!ENV.SUPABASE_ANON,
  hasApp: !!ENV.APP_URL,
  url: ENV.SUPABASE_URL ? `${ENV.SUPABASE_URL.substring(0, 20)}...` : 'undefined',
  appUrl: ENV.APP_URL ? `${ENV.APP_URL.substring(0, 20)}...` : 'undefined'
});

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON || !ENV.APP_URL) {
  console.error('[ENV] Missing required env(s)', {
    hasUrl: !!ENV.SUPABASE_URL, 
    hasKey: !!ENV.SUPABASE_ANON, 
    hasApp: !!ENV.APP_URL,
    supabaseUrl: ENV.SUPABASE_URL || 'MISSING',
    appUrl: ENV.APP_URL || 'MISSING'
  });
  console.error('[ENV] This error occurs when environment variables are not properly set');
  console.error('[ENV] Railway deployment: Ensure variables are set in Railway dashboard');
  console.error('[ENV] Local development: Ensure .env.local file exists with correct values');
  throw new Error(`Missing required environment variables. Check Railway dashboard or .env.local file.`);
}


