import { getRequiredEnvVar } from './startup-error-handler';

// Safe environment variable access function
function getEnvVar(name: string, required: boolean = false): string | undefined {
  const value = process.env[name];
  
  if (required && !value) {
    console.error(`❌ Required environment variable missing: ${name}`);
    throw new Error(`Missing required environment variable: ${name}`);
  }
  
  return value;
}

// Define environment configuration with safe access
export const ENV = {
  // Required Supabase variables
  SUPABASE_URL: getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
  SUPABASE_ANON_KEY: getRequiredEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: getRequiredEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
  
  // Optional Stripe variables (will be undefined if not present)
  STRIPE_SECRET_KEY: getEnvVar('STRIPE_SECRET_KEY'),
  STRIPE_WEBHOOK_SECRET: getEnvVar('STRIPE_WEBHOOK_SECRET'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: getEnvVar('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
  
  // App URL with safe fallback logic
  APP_URL: (() => {
    // Never allow localhost in production; prefer explicit production URLs
    const fallbackUrl = 'https://servio-production.up.railway.app';
    
    if (process.env.NODE_ENV === 'production') {
      return (
        process.env.APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        fallbackUrl
      );
    } else {
      return (
        process.env.APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        fallbackUrl
      );
    }
  })(),
  
  // Optional API keys
  OPENAI_API_KEY: getEnvVar('OPENAI_API_KEY'),
  GOOGLE_CREDENTIALS_B64: getEnvVar('GOOGLE_CREDENTIALS_B64'),
};


