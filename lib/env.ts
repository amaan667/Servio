// lib/env.ts
export const ENV = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  APP_URL: process.env.NEXT_PUBLIC_APP_URL!,
};

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON || !ENV.APP_URL) {
  console.error('[ENV] Missing required env(s)', {
    hasUrl: !!ENV.SUPABASE_URL, 
    hasKey: !!ENV.SUPABASE_ANON, 
    hasApp: !!ENV.APP_URL
  });
  throw new Error('Missing env. See .env.*');
}


