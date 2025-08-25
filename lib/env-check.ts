export function checkCriticalEnvVars() {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    console.error('[ENV CHECK] Missing critical environment variables:', missing);
    console.error('[ENV CHECK] Please set these variables in Railway dashboard');
    throw new Error(`Missing critical environment variables: ${missing.join(', ')}`);
  }

  if (missing.length > 0) {
    console.warn('[ENV CHECK] Missing environment variables (development):', missing);
  }
}
