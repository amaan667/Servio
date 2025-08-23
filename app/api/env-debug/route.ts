export async function GET() {
  console.log('[ENV-DEBUG] Starting environment variable debug...');
  
  // Get all environment variables
  const allEnvVars = process.env;
  const requiredVars = [
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
    'GOOGLE_CREDENTIALS_B64',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'GOOGLE_PROJECT_ID',
    'GCS_BUCKET_NAME',
    'NEXT_PUBLIC_SITE_URL',
    'APP_URL',
    'NODE_ENV'
  ];

  const missingVars = [];
  const presentVars = {};

  console.log('[ENV-DEBUG] Checking required environment variables...');
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      presentVars[varName] = {
        exists: true,
        length: value.length,
        preview: value.length > 50 ? `${value.substring(0, 50)}...` : value,
        isBase64: varName.includes('CREDENTIALS_B64') ? 'Yes' : 'No'
      };
      console.log(`[ENV-DEBUG] ✅ ${varName}: exists (length: ${value.length})`);
    } else {
      missingVars.push(varName);
      console.log(`[ENV-DEBUG] ❌ ${varName}: MISSING`);
    }
  });

  // Check for any other environment variables that might be relevant
  const otherVars = Object.keys(allEnvVars).filter(key => 
    key.includes('SUPABASE') || 
    key.includes('GOOGLE') || 
    key.includes('OPENAI') || 
    key.includes('NEXT_PUBLIC') ||
    key.includes('APP_URL') ||
    key.includes('SITE_URL')
  );

  console.log('[ENV-DEBUG] Found additional relevant variables:', otherVars);

  const out = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    requiredVars: {
      present: presentVars,
      missing: missingVars,
      totalRequired: requiredVars.length,
      presentCount: Object.keys(presentVars).length,
      missingCount: missingVars.length
    },
    allRelevantVars: otherVars.reduce((acc, key) => {
      acc[key] = {
        exists: true,
        length: allEnvVars[key]?.length || 0,
        preview: allEnvVars[key]?.length > 50 ? `${allEnvVars[key].substring(0, 50)}...` : allEnvVars[key]
      };
      return acc;
    }, {}),
    summary: {
      hasSupabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasGoogle: !!(process.env.GOOGLE_CREDENTIALS_B64 || process.env.GOOGLE_APPLICATION_CREDENTIALS),
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      isProduction: process.env.NODE_ENV === 'production'
    }
  };

  console.log('[ENV-DEBUG] Environment debug completed:', JSON.stringify(out, null, 2));
  
  return new Response(JSON.stringify(out, null, 2), { 
    headers: { 
      'content-type': 'application/json',
      'cache-control': 'no-cache'
    } 
  });
}
