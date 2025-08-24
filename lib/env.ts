export const ENV = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY!,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET!,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  // Never allow localhost in production; prefer explicit production URLs
  APP_URL:
    process.env.NODE_ENV === 'production'
      ? (
          process.env.APP_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.NEXT_PUBLIC_SITE_URL ||
          'https://servio-production.up.railway.app'
        )
      : (
          process.env.APP_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          process.env.NEXT_PUBLIC_SITE_URL ||
          'https://servio-production.up.railway.app'
        ),
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
};

// Expose BASE URL for consistent redirects with fallback
export const BASE = process.env.NEXT_PUBLIC_APP_URL || 
                   process.env.NEXT_PUBLIC_SITE_URL || 
                   'https://servio-production.up.railway.app';


