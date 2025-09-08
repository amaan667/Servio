import { z } from "zod";
import "server-only";

export const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(), // server only
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
}).transform(e => e);

// Only validate environment variables at runtime, not during build
function getEnv() {
  // During build time or when required env vars are missing, return a mock object
  const isBuildTime = process.env.NODE_ENV === undefined || 
                     process.env.NEXT_PUBLIC_APP_URL === undefined ||
                     process.env.DATABASE_URL === undefined ||
                     process.env.SUPABASE_URL === undefined ||
                     process.env.SUPABASE_ANON_KEY === undefined;

  if (isBuildTime) {
    return {
      NODE_ENV: "production" as const,
      NEXT_PUBLIC_APP_URL: "https://servio-production.up.railway.app",
      DATABASE_URL: process.env.DATABASE_URL || "mock://database",
      SUPABASE_URL: process.env.SUPABASE_URL || "https://mock.supabase.co",
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "mock-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "mock-service-key",
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    };
  }

  // At runtime, validate the environment variables
  return Env.parse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  });
}

export const env = getEnv();

// Legacy export for backward compatibility
export const ENV = env;