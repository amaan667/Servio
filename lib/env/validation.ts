/**
 * Environment Variable Validation
 * Validates all environment variables at startup using Zod
 */

import { z } from "zod";

const envSchema = z.object({
  // Supabase

  // Stripe

  // Redis

  // App
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Cron

  // Sentry

  // Other

type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

/**
 * Validate and return environment variables
 */
export function getEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    validatedEnv = envSchema.parse(process.env);
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map((e) => e.path.join(".")).join(", ");
      
      throw new Error(`Missing or invalid environment variables: ${missing}`);
    }
    throw error;
  }
}

/**
 * Get environment variable with validation
 */
export function env<K extends keyof Env>(key: K): Env[K] {
  const env = getEnv();
  return env[key];
}

// Validate on import
if (typeof window === "undefined") {
  try {
    getEnv();
  } catch (error) {
    // Only log in development
    if (process.env.NODE_ENV === "development") {

    }
  }
}
